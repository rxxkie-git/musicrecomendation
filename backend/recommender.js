const fs = require('fs');
const path = require('path');

const SPOTIFY_GENRES = ["Pop", "Rap", "Rock", "Latin", "R&B", "EDM"];
const SPOTIFY_FEATURES = ["energy", "danceability", "valence", "acousticness", "popularity"];

const SPOTIFY_MOOD_GENRES = {
    "happy": ["Pop", "Latin"],
    "sad": ["R&B", "Rock"],
    "energetic": ["EDM", "Rock", "Rap"],
    "chill": ["R&B", "Pop"]
};

function getDeterministicFeatures(title, genre, rank = 1) {
    const baseFeatures = {
        'Pop':        {energy: 0.70, danceability: 0.80, valence: 0.75, acousticness: 0.15},
        'Rock':       {energy: 0.85, danceability: 0.50, valence: 0.55, acousticness: 0.08},
        'Rap':        {energy: 0.75, danceability: 0.85, valence: 0.60, acousticness: 0.10},
        'Latin':      {energy: 0.80, danceability: 0.82, valence: 0.85, acousticness: 0.18},
        'R&B':        {energy: 0.50, danceability: 0.65, valence: 0.55, acousticness: 0.30},
        'EDM':        {energy: 0.90, danceability: 0.88, valence: 0.70, acousticness: 0.05},
    };
    const feats = Object.assign({}, baseFeatures[genre] || {energy: 0.5, danceability: 0.5, valence: 0.5, acousticness: 0.5});
    let titleHash = 0;
    for (let i = 0; i < title.length; i++) {
        titleHash += title.charCodeAt(i);
    }
    feats.energy = Math.max(0.01, Math.min(0.99, feats.energy + ((titleHash % 7) - 3) * 0.04));
    feats.danceability = Math.max(0.01, Math.min(0.99, feats.danceability + ((titleHash % 11) - 5) * 0.03));
    feats.valence = Math.max(0.01, Math.min(0.99, feats.valence + ((titleHash % 13) - 6) * 0.03));
    feats.acousticness = Math.max(0.01, Math.min(0.99, feats.acousticness + ((titleHash % 17) - 8) * 0.02));
    feats.popularity = Math.max(0.1, Math.min(1.0, 1.0 - (Math.min(32, rank) - 1) * 0.016));
    return feats;
}

function songToVector(song) {
    const vec = [];
    const genreName = song.genre || '';
    for (const g of SPOTIFY_GENRES) {
        vec.push(g.toLowerCase() === genreName.toLowerCase() ? 1.0 : 0.0);
    }
    const feats = song.features;
    for (const f of SPOTIFY_FEATURES) {
        vec.push(feats[f]);
    }
    return vec;
}

function cosineSimilarity(v1, v2) {
    let dot = 0;
    let n1 = 0;
    let n2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        n1 += v1[i] * v1[i];
        n2 += v2[i] * v2[i];
    }
    n1 = Math.sqrt(n1);
    n2 = Math.sqrt(n2);
    if (n1 === 0 || n2 === 0) return 0;
    return dot / (n1 * n2);
}

function vectorToProfileDict(profileVec) {
    const profileDict = {
        energy: Math.round(profileVec[6] * 100) / 100,
        danceability: Math.round(profileVec[7] * 100) / 100,
        valence: Math.round(profileVec[8] * 100) / 100,
        acousticness: Math.round(profileVec[9] * 100) / 100,
    };
    const genreWeights = profileVec.slice(0, 6);
    let maxIdx = 0;
    let maxVal = genreWeights[0];
    for (let i = 1; i < genreWeights.length; i++) {
        if (genreWeights[i] > maxVal) {
            maxVal = genreWeights[i];
            maxIdx = i;
        }
    }
    profileDict.top_genre = SPOTIFY_GENRES[maxIdx];
    return profileDict;
}

class SpotifyRecommender {
    constructor() {
        this.songs = [];
        this.songByTitle = {};
        this.isSpotify = true;
        this.client_id = process.env.SPOTIFY_CLIENT_ID || '';
        this.client_secret = process.env.SPOTIFY_CLIENT_SECRET || '';
        this.accessToken = null;
        this.tokenExpires = 0;
        this.isOnline = false;

        // Load local fallback dataset
        const jsonPath = path.join(__dirname, 'spotify_songs.json');
        if (fs.existsSync(jsonPath)) {
            try {
                const spotifyData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                for (const song of spotifyData) {
                    const s = {
                        title: song.title,
                        artist: song.artist,
                        genre: song.genre,
                        rank: parseInt(101 - song.popularity),
                        features: {
                            energy: song.energy,
                            danceability: song.danceability,
                            valence: song.valence,
                            acousticness: song.acousticness,
                            popularity: song.popularity / 100.0
                        }
                    };
                    s.vector = songToVector(s);
                    this.songs.push(s);

                    const keyTitle = s.title.toLowerCase().trim();
                    const keyFull = `${keyTitle} - ${s.artist.toLowerCase().trim()}`;
                    this.songByTitle[keyTitle] = s;
                    this.songByTitle[keyFull] = s;
                }
            } catch (err) {
                console.error("Warning: Failed to load spotify_songs.json:", err);
            }
        }

        // Initial check
        if (this.client_id && this.client_secret) {
            this.checkAuth().then(() => {
                if (this.isOnline) {
                    console.log("Spotify Recommender active (Spotify Web API connected).");
                } else {
                    console.log("Warning: Failed to authenticate with Spotify API. Running in Offline Fallback Demo Mode.");
                }
            });
        } else {
            console.log("Warning: Spotify Client Credentials not configured. Running in Offline Fallback Demo Mode.");
        }
    }

    async checkAuth() {
        if (!this.client_id || !this.client_secret) {
            this.isOnline = false;
            return;
        }

        if (!this.accessToken || Date.now() >= this.tokenExpires) {
            try {
                const response = await fetch("https://accounts.spotify.com/api/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        grant_type: "client_credentials",
                        client_id: this.client_id,
                        client_secret: this.client_secret
                    })
                });
                if (response.ok) {
                    const resData = await response.json();
                    this.accessToken = resData.access_token;
                    this.tokenExpires = Date.now() + (resData.expires_in - 60) * 1000;
                    this.isOnline = true;
                } else {
                    this.isOnline = false;
                }
            } catch (err) {
                console.error("Spotify token request failed:", err);
                this.isOnline = false;
            }
        }
    }

    async fetchSpotify(url) {
        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                }
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (err) {
            console.error(`Spotify API request to ${url} failed:`, err);
        }
        return null;
    }

    async searchSongs(query) {
        query = query.trim();
        if (!query) return [];

        const queryLower = query.toLowerCase();

        if (this.isOnline) {
            await this.checkAuth();
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`;
            const res = await this.fetchSpotify(url);
            if (res && res.tracks) {
                const tracks = res.tracks.items || [];
                const results = [];
                for (const t of tracks) {
                    const title = t.name;
                    const artist = t.artists && t.artists[0] ? t.artists[0].name : '';
                    if (title && artist) {
                        if (title.toLowerCase().includes(queryLower) || artist.toLowerCase().includes(queryLower)) {
                            results.push(`${title} - ${artist}`);
                        }
                    }
                }
                return results.slice(0, 5);
            }
        }

        // Offline Fallback Search
        const results = [];
        const seen = new Set();
        for (const song of this.songs) {
            const title = song.title;
            const artist = song.artist;
            const fullStr = `${title} - ${artist}`;
            if (title.toLowerCase().includes(queryLower) || artist.toLowerCase().includes(queryLower)) {
                if (!seen.has(fullStr.toLowerCase())) {
                    seen.add(fullStr.toLowerCase());
                    results.push(fullStr);
                    if (results.length >= 5) break;
                }
            }
        }
        return results;
    }

    _estimateGenre(title, artist) {
        const combined = `${title} ${artist}`.toLowerCase();
        if (["rap", "hip hop", "hiphop", "trap", "lil", "drake", "eminem", "kendrick", "post malone"].some(w => combined.includes(w))) {
            return "Rap";
        } else if (["rock", "metal", "grunge", "band", "queen", "zeppelin", "pink floyd", "nirvana"].some(w => combined.includes(w))) {
            return "Rock";
        } else if (["latin", "reggaeton", "bad bunny", "j balvin", "spanish", "maluma"].some(w => combined.includes(w))) {
            return "Latin";
        } else if (["r&b", "soul", "rb", "funk", "lofi", "lo-fi", "weeknd", "sza", "frank ocean"].some(w => combined.includes(w))) {
            return "R&B";
        } else if (["edm", "dance", "electronic", "house", "techno", "dj", "avicii", "daft punk", "calvin harris"].some(w => combined.includes(w))) {
            return "EDM";
        }
        return "Pop";
    }

    async getSong(songTitle) {
        songTitle = songTitle.trim();

        // Parse Title and Artist
        let trackName = songTitle;
        let artistName = '';
        if (songTitle.includes(" - ")) {
            const parts = songTitle.split(" - ");
            trackName = parts[0].trim();
            artistName = parts[1].trim();
        }

        const keyFull = `${trackName.toLowerCase()} - ${artistName.toLowerCase()}`;
        const keyTitle = trackName.toLowerCase();

        // Check cache
        if (this.songByTitle[keyFull]) return this.songByTitle[keyFull];
        if (this.songByTitle[keyTitle]) return this.songByTitle[keyTitle];

        // Online fetch
        if (this.isOnline) {
            await this.checkAuth();
            let queryStr = `track:${trackName}`;
            if (artistName) {
                queryStr += ` artist:${artistName}`;
            }
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(queryStr)}&type=track&limit=1`;
            const res = await this.fetchSpotify(url);
            if (res && res.tracks) {
                const tracks = res.tracks.items || [];
                if (tracks.length > 0) {
                    const topMatch = tracks[0];
                    const tId = topMatch.id;
                    const tName = topMatch.name;
                    const aName = topMatch.artists && topMatch.artists[0] ? topMatch.artists[0].name : 'Unknown Artist';
                    const popularity = topMatch.popularity || 50;

                    // Fetch audio features
                    const featUrl = `https://api.spotify.com/v1/audio-features/${tId}`;
                    const featRes = await this.fetchSpotify(featUrl);

                    let features;
                    if (featRes) {
                        features = {
                            energy: featRes.energy || 0.5,
                            danceability: featRes.danceability || 0.5,
                            valence: featRes.valence || 0.5,
                            acousticness: featRes.acousticness || 0.5,
                            popularity: popularity / 100.0
                        };
                    } else {
                        const genre = this._estimateGenre(tName, aName);
                        features = getDeterministicFeatures(tName, genre, 1);
                    }

                    const genre = this._estimateGenre(tName, aName);
                    const songObj = {
                        id: tId,
                        title: tName,
                        artist: aName,
                        genre: genre,
                        rank: parseInt(101 - popularity),
                        features: features
                    };
                    songObj.vector = songToVector(songObj);

                    // Cache
                    this.songByTitle[`${tName.toLowerCase()} - ${aName.toLowerCase()}`] = songObj;
                    this.songByTitle[tName.toLowerCase()] = songObj;
                    return songObj;
                }
            }
        }

        // Offline fallback Dummy Object
        const genre = this._estimateGenre(trackName, artistName);
        const features = getDeterministicFeatures(trackName, genre, 1);
        const songObj = {
            id: 'fallback_dummy',
            title: trackName,
            artist: artistName || 'Unknown Artist',
            genre: genre,
            rank: 1,
            features: features
        };
        songObj.vector = songToVector(songObj);
        return songObj;
    }

    initProfileFromGenre(genre) {
        const genreClean = genre.trim().toLowerCase();
        const baseFeatures = {
            'pop':        {energy: 0.70, danceability: 0.80, valence: 0.75, acousticness: 0.15},
            'rock':       {energy: 0.85, danceability: 0.50, valence: 0.55, acousticness: 0.08},
            'rap':        {energy: 0.75, danceability: 0.85, valence: 0.60, acousticness: 0.10},
            'latin':      {energy: 0.80, danceability: 0.82, valence: 0.85, acousticness: 0.18},
            'r&b':        {energy: 0.50, danceability: 0.65, valence: 0.55, acousticness: 0.30},
            'edm':        {energy: 0.90, danceability: 0.88, valence: 0.70, acousticness: 0.05},
        };
        const feats = baseFeatures[genreClean] || {energy: 0.5, danceability: 0.5, valence: 0.5, acousticness: 0.5};
        
        const vec = [];
        for (const g of SPOTIFY_GENRES) {
            vec.push(g.toLowerCase() === genreClean ? 1.0 : 0.0);
        }
        vec.push(feats.energy);
        vec.push(feats.danceability);
        vec.push(feats.valence);
        vec.push(feats.acousticness);
        vec.push(0.8); // Default popularity weight
        return vec;
    }

    async initProfileFromSong(songTitle) {
        const song = await this.getSong(songTitle);
        if (song) {
            return [...song.vector];
        }
        return Array(6).fill(0.0).concat(Array(5).fill(0.5));
    }

    updateProfile(profileVec, songVec, isLike, learningRate = 0.35) {
        const newVec = [];
        for (let i = 0; i < profileVec.length; i++) {
            let updated;
            if (isLike) {
                updated = profileVec[i] + learningRate * (songVec[i] - profileVec[i]);
            } else {
                updated = profileVec[i] - learningRate * (songVec[i] - profileVec[i]);
            }
            newVec.push(updated);
        }

        // Genre weights bounds
        for (let i = 0; i < 6; i++) {
            newVec[i] = Math.max(-1.0, Math.min(2.0, newVec[i]));
        }

        // Features bounds
        for (let i = 6; i < 11; i++) {
            newVec[i] = Math.max(0.0, Math.min(1.0, newVec[i]));
        }

        return newVec;
    }

    async recommend(profileVec, likedTitles, dislikedTitles, count = 5) {
        if (!this.isOnline) {
            return this._recommendOffline(profileVec, likedTitles, dislikedTitles, count);
        }

        await this.checkAuth();
        const profileDict = vectorToProfileDict(profileVec);
        const topGenre = profileDict.top_genre;

        const candidates = [];
        const likedSet = new Set(likedTitles.map(t => t.toLowerCase().trim()));
        const dislikedSet = new Set(dislikedTitles.map(t => t.toLowerCase().trim()));

        // Search top genre candidates
        const genreQuery = `genre:${topGenre.toLowerCase()}`;
        const urlGenre = `https://api.spotify.com/v1/search?q=${encodeURIComponent(genreQuery)}&type=track&limit=25`;
        const resGenre = await this.fetchSpotify(urlGenre);
        if (resGenre && resGenre.tracks) {
            candidates.push(...(resGenre.tracks.items || []));
        }

        // Search artist candidates from liked tracks
        const seenArtists = new Set();
        for (const song of likedTitles) {
            if (song.includes(" - ")) {
                const artist = song.split(" - ")[1].trim();
                if (!seenArtists.has(artist.toLowerCase())) {
                    seenArtists.add(artist.toLowerCase());
                    const artistQuery = `artist:"${artist}"`;
                    const urlArtist = `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistQuery)}&type=track&limit=10`;
                    const resArtist = await this.fetchSpotify(urlArtist);
                    if (resArtist && resArtist.tracks) {
                        candidates.push(...(resArtist.tracks.items || []));
                    }
                }
            }
        }

        const recommendedTracks = [];
        const trackIds = [];
        const seenKeys = new Set();

        for (const t of candidates) {
            const title = t.name;
            const artist = t.artists && t.artists[0] ? t.artists[0].name : '';
            const tId = t.id;
            if (!title || !artist || !tId) continue;

            const tKeyFull = `${title.toLowerCase()} - ${artist.toLowerCase()}`;
            const titleOnly = title.toLowerCase().trim();

            if (likedSet.has(tKeyFull) || likedSet.has(titleOnly) || dislikedSet.has(tKeyFull) || dislikedSet.has(titleOnly)) {
                continue;
            }

            if (seenKeys.has(tKeyFull)) continue;

            seenKeys.add(tKeyFull);
            recommendedTracks.append = recommendedTracks.push({
                id: tId,
                title: title,
                artist: artist,
                popularity: t.popularity || 50
            });
            trackIds.push(tId);
        }

        if (recommendedTracks.length === 0) {
            return this._recommendOffline(profileVec, likedTitles, dislikedTitles, count);
        }

        // Batch fetch audio features
        const featUrl = `https://api.spotify.com/v1/audio-features?ids=${trackIds.slice(0, 10).join(',')}`;
        const featRes = await this.fetchSpotify(featUrl);

        const featuresById = {};
        if (featRes && featRes.audio_features) {
            for (const f of featRes.audio_features) {
                if (f) featuresById[f.id] = f;
            }
        }

        const scoredRecommendations = [];
        for (const track of recommendedTracks) {
            const tId = track.id;
            const title = track.title;
            const artist = track.artist;
            const popularity = track.popularity;

            const genre = this._estimateGenre(title, artist);
            const feat = featuresById[tId];

            let features;
            if (feat) {
                features = {
                    energy: feat.energy || 0.5,
                    danceability: feat.danceability || 0.5,
                    valence: feat.valence || 0.5,
                    acousticness: feat.acousticness || 0.5,
                    popularity: popularity / 100.0
                };
            } else {
                features = getDeterministicFeatures(title, genre, 1);
            }

            const songObj = {
                id: tId,
                title: title,
                artist: artist,
                genre: genre,
                rank: parseInt(101 - popularity),
                features: features
            };
            songObj.vector = songToVector(songObj);

            // Cache it
            this.songByTitle[`${title.toLowerCase()} - ${artist.toLowerCase()}`] = songObj;
            this.songByTitle[title.toLowerCase()] = songObj;

            // Score similarity
            const sim = cosineSimilarity(profileVec, songObj.vector);
            const matchPct = Math.max(1, Math.min(99, parseInt(((sim + 1.0) / 2.0) * 100.0)));

            scoredRecommendations.push({
                title: title,
                artist: artist,
                genre: genre,
                rank: parseInt(101 - popularity),
                features: features,
                match_score: matchPct
            });
        }

        scoredRecommendations.sort((a, b) => b.match_score - a.match_score);
        return scoredRecommendations.slice(0, count);
    }

    _recommendOffline(profileVec, likedTitles, dislikedTitles, count = 5) {
        const recommendations = [];
        const likedSet = new Set(likedTitles.map(t => t.toLowerCase().trim()));
        const dislikedSet = new Set(dislikedTitles.map(t => t.toLowerCase().trim()));

        for (const s of this.songs) {
            const titleLower = s.title.toLowerCase().trim();
            const keyFull = `${titleLower} - ${s.artist.toLowerCase().trim()}`;
            if (likedSet.has(titleLower) || dislikedSet.has(titleLower) || likedSet.has(keyFull) || dislikedSet.has(keyFull)) {
                continue;
            }

            const sim = cosineSimilarity(profileVec, s.vector);
            const matchPct = Math.max(1, Math.min(99, parseInt(((sim + 1.0) / 2.0) * 100.0)));

            const rec = Object.assign({}, s);
            rec.match_score = matchPct;
            recommendations.push(rec);
        }

        recommendations.sort((a, b) => b.match_score - a.match_score);

        const formattedRecs = [];
        for (const r of recommendations.slice(0, count)) {
            formattedRecs.push({
                title: r.title,
                artist: r.artist || 'Unknown Artist',
                genre: r.genre,
                rank: r.rank,
                features: r.features,
                match_score: r.match_score
            });
        }
        return formattedRecs;
    }
}

module.exports = {
    SpotifyRecommender,
    vectorToProfileDict
};
