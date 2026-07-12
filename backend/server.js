require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { SpotifyRecommender, vectorToProfileDict } = require('./recommender');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Spotify Recommender
const recommender = new SpotifyRecommender();

// In-memory sessions store
const SESSIONS = {};

// 1. API Status check
app.get('/api/status', (req, res) => {
    res.json({ online: recommender.isOnline });
});

// 2. Autocomplete search route
app.get('/api/songs', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) {
        return res.json([]);
    }
    try {
        const titles = await recommender.searchSongs(q);
        res.json(titles);
    } catch (err) {
        console.error("Autocomplete search failed:", err);
        res.status(500).json({ error: "Failed to perform autocomplete search" });
    }
});

// 3. Recommend By Genre route
app.post('/api/recommend/genre', async (req, res) => {
    const { genre, sessionId } = req.body;
    
    if (!genre || !genre.trim()) {
        return res.status(400).json({ error: "Genre is required" });
    }
    if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    const genreClean = genre.trim().toLowerCase();
    const validGenres = ["pop", "rap", "rock", "latin", "r&b", "edm"];
    if (!validGenres.includes(genreClean)) {
        return res.status(404).json({
            error: `Sorry, we don't recognize the genre '${genre}'. Try again with: Pop, Rap, Rock, Latin, R&B, or EDM.`
        });
    }
    
    try {
        // Initialize fresh session profile DNA
        SESSIONS[sessionId] = {
            profile: recommender.initProfileFromGenre(genreClean),
            liked: [],
            disliked: [],
            initial_type: 'genre',
            initial_value: genreClean
        };
        
        const session = SESSIONS[sessionId];
        const recommendations = await recommender.recommend(
            session.profile,
            session.liked,
            session.disliked,
            10
        );
        
        res.json({
            genre: genreClean,
            recommendations: recommendations,
            profile: vectorToProfileDict(session.profile),
            liked_songs: session.liked
        });
    } catch (err) {
        console.error("Genre recommendation failed:", err);
        res.status(500).json({ error: "Failed to get recommendations" });
    }
});

// 4. Recommend By Favorite Song route
app.post('/api/recommend/song', async (req, res) => {
    const { song, name, sessionId } = req.body;
    const userName = (name || 'Friend').trim();
    
    if (!song || !song.trim()) {
        return res.status(400).json({ error: "Favorite song title is required" });
    }
    if (!sessionId || !sessionId.trim()) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    try {
        const songObj = await recommender.getSong(song);
        if (!songObj) {
            return res.status(404).json({
                error: `Sorry ${userName}, we couldn't find the song '${song}' in the database.`
            });
        }
        
        const fullTitle = `${songObj.title} - ${songObj.artist}`;
        const profileVec = await recommender.initProfileFromSong(song);
        
        // Initialize fresh session profile DNA
        SESSIONS[sessionId] = {
            profile: profileVec,
            liked: [fullTitle], // Pre-add the favorite song to liked list
            disliked: [],
            initial_type: 'song',
            initial_value: fullTitle
        };
        
        const session = SESSIONS[sessionId];
        const recommendations = await recommender.recommend(
            session.profile,
            session.liked,
            session.disliked,
            10
        );
        
        res.json({
            name: userName,
            input_song: songObj.title,
            genre: songObj.genre,
            recommendations: recommendations,
            profile: vectorToProfileDict(session.profile),
            liked_songs: session.liked
        });
    } catch (err) {
        console.error("Song recommendation failed:", err);
        res.status(500).json({ error: "Failed to get recommendations" });
    }
});

// 5. User Feedback (Like / Dislike) route
app.post('/api/feedback', async (req, res) => {
    const { sessionId, song, like } = req.body;
    
    if (!sessionId || !song || like === undefined) {
        return res.status(400).json({ error: "sessionId, song, and like fields are required" });
    }
    
    const session = SESSIONS[sessionId];
    if (!session) {
        return res.status(404).json({ error: "Session not found or expired. Please search again." });
    }
    
    try {
        const songObj = await recommender.getSong(song);
        if (!songObj) {
            return res.status(404).json({ error: `Song '${song}' not found in database.` });
        }
        
        // Update user profile DNA vector based on feedback
        session.profile = recommender.updateProfile(
            session.profile,
            songObj.vector,
            like
        );
        
        const titleActual = `${songObj.title} - ${songObj.artist}`;
        if (like) {
            if (!session.liked.includes(titleActual)) {
                session.liked.push(titleActual);
            }
            const disIdx = session.disliked.indexOf(titleActual);
            if (disIdx > -1) {
                session.disliked.splice(disIdx, 1);
            }
        } else {
            if (!session.disliked.includes(titleActual)) {
                session.disliked.push(titleActual);
            }
            const likIdx = session.liked.indexOf(titleActual);
            if (likIdx > -1) {
                session.liked.splice(likIdx, 1);
            }
        }
        
        const recommendations = await recommender.recommend(
            session.profile,
            session.liked,
            session.disliked,
            10
        );
        
        res.json({
            recommendations: recommendations,
            profile: vectorToProfileDict(session.profile),
            liked_songs: session.liked
        });
    } catch (err) {
        console.error("Feedback processing failed:", err);
        res.status(500).json({ error: "Failed to process feedback" });
    }
});

// 6. Reset Session route
app.post('/api/reset', async (req, res) => {
    const { sessionId } = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    const session = SESSIONS[sessionId];
    if (!session) {
        return res.json({ success: true, message: "Session already clean." });
    }
    
    try {
        const initialType = session.initial_type;
        const initialValue = session.initial_value;
        
        if (initialType === 'genre') {
            session.profile = recommender.initProfileFromGenre(initialValue);
            session.liked = [];
            session.disliked = [];
        } else if (initialType === 'song') {
            session.profile = await recommender.initProfileFromSong(initialValue);
            session.liked = [initialValue];
            session.disliked = [];
        } else {
            session.profile = Array(6).fill(0.0).concat(Array(5).fill(0.5));
            session.liked = [];
            session.disliked = [];
        }
        
        const recommendations = await recommender.recommend(
            session.profile,
            session.liked,
            session.disliked,
            10
        );
        
        res.json({
            recommendations: recommendations,
            profile: vectorToProfileDict(session.profile),
            liked_songs: session.liked
        });
    } catch (err) {
        console.error("Reset failed:", err);
        res.status(500).json({ error: "Failed to reset session" });
    }
});

// Start backend server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`======================================================================`);
    console.log(`Spotifind Node.js Backend Server running on http://0.0.0.0:${PORT}`);
    console.log(`======================================================================`);
});
