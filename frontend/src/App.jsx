import React, { useState, useEffect, useRef } from 'react';

function App() {
  // Generate random sessionId once on component mount
  const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

  // Application States
  const [activeTab, setActiveTab] = useState('song');
  const [onlineStatus, setOnlineStatus] = useState('loading'); // 'loading', 'online', 'offline'

  const [userName, setUserName] = useState('');
  const [favSong, setFavSong] = useState('');
  const [autocompleteMatches, setAutocompleteMatches] = useState([]);
  const [isAutocompleteActive, setIsAutocompleteActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [resultsActive, setResultsActive] = useState(false);
  const [resultsTitle, setResultsTitle] = useState('');
  const [resultsSubtitle, setResultsSubtitle] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [showGenre, setShowGenre] = useState(true);

  const [profile, setProfile] = useState({
    energy: 0.5,
    danceability: 0.5,
    valence: 0.5,
    acousticness: 0.5,
    top_genre: '-'
  });
  const [likedSongs, setLikedSongs] = useState([]);

  // Refs for DOM nodes and 3D animation
  const vinylRef = useRef(null);
  const containerRef = useRef(null);
  const autocompleteContainerRef = useRef(null);

  // Debounce autocomplete search timer
  const debounceTimerRef = useRef(null);

  // Chart refs for GFG ML Insights
  const similarityChartRef = useRef(null);
  const genreChartRef = useRef(null);
  const similarityChartInst = useRef(null);
  const genreChartInst = useRef(null);

  // Check Spotify API connection status on load
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setOnlineStatus(data.online ? 'online' : 'offline');
        } else {
          setOnlineStatus('offline');
        }
      } catch (err) {
        setOnlineStatus('offline');
      }
    }
    checkStatus();
  }, []);

  // Fetch song autocomplete suggestions when favSong input changes
  useEffect(() => {
    if (!favSong.trim()) {
      setAutocompleteMatches([]);
      setIsAutocompleteActive(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/songs?q=${encodeURIComponent(favSong)}`);
        if (res.ok) {
          const data = await res.json();
          setAutocompleteMatches(data);
          setIsAutocompleteActive(data.length > 0);
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete matches:", err);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [favSong]);

  // Click listener to close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteContainerRef.current && !autocompleteContainerRef.current.contains(event.target)) {
        setIsAutocompleteActive(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Chart rendering for GFG ML Insights
  useEffect(() => {
    if (!resultsActive || recommendations.length === 0 || !window.Chart) return;

    // Destroy existing charts to prevent memory leaks and overlapping canvas bugs
    if (similarityChartInst.current) similarityChartInst.current.destroy();
    if (genreChartInst.current) genreChartInst.current.destroy();

    try {
      // 1. Render Cosine Similarity Chart
      const ctxSim = similarityChartRef.current.getContext('2d');
      const songLabels = recommendations.map(r => r.title.length > 15 ? r.title.substring(0, 15) + '...' : r.title);
      const matchScores = recommendations.map(r => r.match_score);

      similarityChartInst.current = new window.Chart(ctxSim, {
        type: 'bar',
        data: {
          labels: songLabels,
          datasets: [{
            label: 'Cosine Similarity Match (%)',
            data: matchScores,
            backgroundColor: 'rgba(34, 211, 238, 0.45)',
            borderColor: '#22d3ee',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Match Strength: ${ctx.raw.toFixed(1)}%`
              }
            }
          },
          scales: {
            x: {
              min: 50,
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { family: 'Outfit', size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: 'rgba(255, 255, 255, 0.8)', font: { family: 'Outfit', size: 10 } }
            }
          }
        }
      });

      // 2. Render Genre Distribution Chart
      const ctxGenre = genreChartRef.current.getContext('2d');

      const genreCounts = {};
      recommendations.forEach(r => {
        const g = r.genre || 'Other';
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });

      genreChartInst.current = new window.Chart(ctxGenre, {
        type: 'doughnut',
        data: {
          labels: Object.keys(genreCounts),
          datasets: [{
            data: Object.values(genreCounts),
            backgroundColor: [
              'rgba(6, 182, 212, 0.65)',
              'rgba(139, 92, 246, 0.65)',
              'rgba(236, 72, 153, 0.65)',
              'rgba(245, 158, 11, 0.65)',
              'rgba(16, 185, 129, 0.65)',
              'rgba(239, 68, 68, 0.65)'
            ],
            borderColor: 'rgba(10, 10, 10, 0.95)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: 'rgba(255, 255, 255, 0.7)', font: { family: 'Outfit', size: 10 } }
            }
          }
        }
      });
    } catch (err) {
      console.error("Error creating Chart.js charts:", err);
    }

    return () => {
      if (similarityChartInst.current) similarityChartInst.current.destroy();
      if (genreChartInst.current) genreChartInst.current.destroy();
    };
  }, [resultsActive, recommendations]);

  // Vinyl 3D interactive parallax loop
  useEffect(() => {
    let mouseX = 0;
    let mouseY = 0;
    let frameId;

    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) - 0.5;
      mouseY = (e.clientY / window.innerHeight) - 0.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      const vinyl = vinylRef.current;
      if (vinyl) {
        const scrollY = window.scrollY;
        const time = Date.now() * 0.001;

        const baseSpin = time * 20; // 20 deg/sec
        const scrollSpin = scrollY * 0.25;
        const rotZ = baseSpin + scrollSpin;

        const rotX = 25 + (mouseY * 18) + (scrollY * 0.015);
        const rotY = -30 + (mouseX * 18) + (scrollY * 0.02);

        vinyl.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`;
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameId);
    };
  }, []);

  // Utility to handle progress bar loading simulation
  const runLoadingAnimation = (callback) => {
    setLoading(true);
    setResultsActive(false);
    setLoadingProgress(0);

    let width = 0;
    const interval = setInterval(() => {
      width += 10;
      setLoadingProgress(width);
      if (width >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setLoading(false);
          callback();
        }, 300);
      }
    }, 30);
  };

  // Trigger Genre Search
  const handleGenreSelect = (genre) => {
    runLoadingAnimation(async () => {
      try {
        const response = await fetch('/api/recommend/genre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre, sessionId })
        });

        const data = await response.json();
        if (response.ok) {
          setRecommendations(data.recommendations);
          setProfile(data.profile);
          setLikedSongs(data.liked_songs);
          setResultsTitle(`Recommendations for ${genre.toUpperCase()} Genre`);
          setResultsSubtitle(`We found some matching tracks using content-based cosine similarity:`);
          setShowGenre(true);
          setResultsActive(true);
        } else {
          setResultsTitle('Error');
          setResultsSubtitle(data.error || "Failed to load recommendations.");
          setRecommendations([]);
          setResultsActive(true);
        }
      } catch (err) {
        setResultsTitle('Network Error');
        setResultsSubtitle("Could not reach the recommendation server.");
        setRecommendations([]);
        setResultsActive(true);
      }
    });
  };

  // Helper to fetch recommendation by song name
  const getSongRecommendations = (songName) => {
    const cleanSong = songName.trim();
    if (!cleanSong) return;

    runLoadingAnimation(async () => {
      try {
        const response = await fetch('/api/recommend/song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userName, song: cleanSong, sessionId })
        });

        const data = await response.json();
        if (response.ok) {
          setRecommendations(data.recommendations);
          setProfile(data.profile);
          setLikedSongs(data.liked_songs);
          setResultsTitle(`Hey ${data.name}, here is your playlist!`);
          setResultsSubtitle(`Because you like "${data.input_song}", we recommend these similar ${data.genre} tracks:`);
          setShowGenre(false);
          setResultsActive(true);
        } else {
          setResultsTitle('Recommendation Failed');
          setResultsSubtitle(data.error || "Failed to find similar songs.");
          setRecommendations([]);
          setResultsActive(true);
        }
      } catch (err) {
        setResultsTitle('Network Error');
        setResultsSubtitle("Could not reach the recommendation server.");
        setRecommendations([]);
        setResultsActive(true);
      }
    });
  };

  // Trigger Favorite Song Search
  const handleSongSubmit = (e) => {
    if (e) e.preventDefault();
    getSongRecommendations(favSong);
  };

  // Submit Feedback (Like / Dislike)
  const handleFeedback = async (songTitle, isLike, event) => {
    const btn = event.currentTarget;
    const parentActions = btn.closest('.feedback-actions');
    if (parentActions) {
      parentActions.style.pointerEvents = 'none';
      parentActions.style.opacity = '0.5';
    }
    btn.classList.add('clicked');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          song: songTitle,
          like: isLike
        })
      });

      const data = await response.json();
      if (response.ok) {
        const row = btn.closest('.result-item');
        if (row) {
          row.style.transition = 'all 0.35s ease';
          row.style.opacity = '0';
          row.style.transform = isLike ? 'scale(0.96)' : 'translateX(-60px)';
        }

        setTimeout(() => {
          setRecommendations(data.recommendations);
          setProfile(data.profile);
          setLikedSongs(data.liked_songs);
          if (parentActions) {
            parentActions.style.pointerEvents = '';
            parentActions.style.opacity = '';
          }
        }, 350);
      } else {
        console.error("Feedback failed:", data.error);
        if (parentActions) {
          parentActions.style.pointerEvents = '';
          parentActions.style.opacity = '';
        }
      }
    } catch (err) {
      console.error("Feedback error:", err);
      if (parentActions) {
        parentActions.style.pointerEvents = '';
        parentActions.style.opacity = '';
      }
    }
  };

  // Reset Preferences
  const handleResetProfile = async () => {
    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      if (response.ok) {
        setRecommendations(data.recommendations);
        setProfile(data.profile);
        setLikedSongs(data.liked_songs);
      }
    } catch (err) {
      console.error("Error resetting profile:", err);
    }
  };

  // Return to Search Dashboard
  const handleBackToSearch = () => {
    setResultsActive(false);
  };

  return (
    <div className={`container ${resultsActive ? 'wide-container' : ''}`} ref={containerRef}>

      {/* 3D Vinyl Scene */}
      <div className="scene3d">
        <div className="vinyl-3d" ref={vinylRef}>
          <div className="vinyl-disc">
            <div className="vinyl-grooves"></div>
            <div className="vinyl-label">
              <div className="vinyl-label-center">🎵</div>
            </div>
          </div>
        </div>
        <div className="vinyl-shadow"></div>
      </div>

      {/* Header Navbar */}
      <header className="navbar">
        <div className="nav-left">
          <div className="logo">
            <svg className="logo-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
              <circle cx="50" cy="40" r="18" stroke="#22d3ee" strokeWidth="6" />
              <circle cx="50" cy="40" r="8" stroke="#06b6d4" strokeWidth="3" strokeDasharray="6 4" />
              <path d="M68 40 L68 64 C68 78, 56 86, 44 86 C30 86, 22 76, 24 64 C26 54, 38 48, 50 48" stroke="#22d3ee" strokeWidth="6" />
              <circle cx="50" cy="48" r="4" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
              <circle cx="68" cy="40" r="3.5" fill="#22d3ee" />
            </svg>
            <h1>Spootifind</h1>
            <span className={`status-badge ${onlineStatus}`}>
              {onlineStatus === 'loading' ? 'Checking status...' : onlineStatus === 'online' ? 'Spotify API Online' : 'Offline Demo Mode'}
            </span>
          </div>
        </div>
        <div className="nav-right">
          <button
            className={`nav-link ${activeTab === 'song' ? 'active' : ''}`}
            onClick={() => setActiveTab('song')}
          >
            By Favorite Song
          </button>
          <button
            className={`nav-link ${activeTab === 'genre' ? 'active' : ''}`}
            onClick={() => setActiveTab('genre')}
          >
            By Genre
          </button>
        </div>
      </header>

      {/* Subtitle / Intro */}
      <div className="hero-section">
        <p className="subtitle">Discover your next favorite track using Spootifind</p>
      </div>

      {/* Main Dashboard Panel */}
      <main className={`dashboard-card ${resultsActive ? 'wide-dashboard' : ''}`}>

        {/* Render Form / Selector when NOT in Results View */}
        {!resultsActive && !loading && (
          <>

            {/* Content: Genre Tab */}
            {activeTab === 'genre' && (
              <div className="tab-content active">
                <p className="section-desc">Select a genre to find top tracks and matching suggestions.</p>
                <div className="mood-grid">
                  <div className="mood-card happy" onClick={() => handleGenreSelect('Pop')}>
                    <div className="mood-icon">🎤</div>
                    <h3>Pop</h3>
                    <p className="genres">Pop, Dance, Reggae</p>
                  </div>
                  <div className="mood-card sad" onClick={() => handleGenreSelect('Rap')}>
                    <div className="mood-icon">🎧</div>
                    <h3>Rap</h3>
                    <p className="genres">Hip-Hop, Trap, Rap</p>
                  </div>
                  <div className="mood-card energetic" onClick={() => handleGenreSelect('Rock')}>
                    <div className="mood-icon">🎸</div>
                    <h3>Rock</h3>
                    <p className="genres">Rock, Metal, Grunge</p>
                  </div>
                  <div className="mood-card chill" onClick={() => handleGenreSelect('Latin')}>
                    <div className="mood-icon">💃</div>
                    <h3>Latin</h3>
                    <p className="genres">Latino, Reggaeton, Salsa</p>
                  </div>
                  <div className="mood-card happy" onClick={() => handleGenreSelect('R&B')}>
                    <div className="mood-icon">🎷</div>
                    <h3>R&B</h3>
                    <p className="genres">R&B, Soul, Funk</p>
                  </div>
                  <div className="mood-card energetic" onClick={() => handleGenreSelect('EDM')}>
                    <div className="mood-icon">⚡</div>
                    <h3>EDM</h3>
                    <p className="genres">EDM, House, Techno</p>
                  </div>
                </div>
              </div>
            )}

            {/* Content: Song Tab */}
            {activeTab === 'song' && (
              <div className="tab-content active">
                <p className="section-desc">Enter your favorite song to get recommendations in the same genre.</p>
                <form id="song-form" onSubmit={handleSongSubmit} autoComplete="off">
                  <div className="form-group">
                    <label htmlFor="user-name">Your Name</label>
                    <input
                      type="text"
                      id="user-name"
                      placeholder="What should we call you?"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group autocomplete-container" ref={autocompleteContainerRef}>
                    <label htmlFor="fav-song">Your Favorite Song</label>
                    <div className="search-input-wrapper">
                      <input
                        type="text"
                        id="fav-song"
                        placeholder="Start typing a song title..."
                        value={favSong}
                        onChange={(e) => setFavSong(e.target.value)}
                        required
                      />
                      <span className="search-icon">🔍</span>
                    </div>

                    {isAutocompleteActive && (
                      <div className="autocomplete-list active">
                        {autocompleteMatches.map((match, idx) => {
                          const valLower = favSong.toLowerCase();
                          const startIdx = match.toLowerCase().indexOf(valLower);
                          let before = match;
                          let highlight = "";
                          let after = "";

                          if (startIdx >= 0) {
                            before = match.substring(0, startIdx);
                            highlight = match.substring(startIdx, startIdx + favSong.length);
                            after = match.substring(startIdx + favSong.length);
                          }

                          return (
                            <div
                              key={idx}
                              className="autocomplete-item"
                              onClick={() => {
                                setFavSong(match);
                                setIsAutocompleteActive(false);
                                getSongRecommendations(match);
                              }}
                            >
                              {before}<strong>{highlight}</strong>{after}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button type="submit" className="submit-btn">
                    Get Recommendations
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Loading progress bars */}
        {loading && (
          <div className="loading-container active">
            <div className="spinner">
              <div className="double-bounce1"></div>
              <div className="double-bounce2"></div>
            </div>
            <p className="loading-text">Analyzing database and selecting matches...</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${loadingProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Results Screen */}
        {resultsActive && !loading && (
          <div className="results-container active">
            <div className="results-header">
              <h2 style={{ color: resultsTitle === 'Error' || resultsTitle === 'Recommendation Failed' ? '#ef4444' : '' }}>
                {resultsTitle}
              </h2>
              <p>{resultsSubtitle}</p>
            </div>

            <div className="results-layout-grid">
              {/* Left Column: Recommendations list */}
              <div className="results-songs-column">
                <div className="results-list">
                  {recommendations.length === 0 ? (
                    <div className="empty-recs-card">
                      <p>No more recommendations available. Add more genres or reset your preferences!</p>
                    </div>
                  ) : (
                    recommendations.map((song, idx) => (
                      <div key={idx} className="result-item" style={{ animationDelay: `${idx * 0.08}s` }}>
                        <div className="result-number">{idx + 1}</div>
                        <div className="song-details">
                          <div className="song-title-row">
                            <span className="song-title">{song.title}</span>
                            <span className="genre-badge">{song.genre}</span>
                          </div>
                          <div className="song-artist">by {song.artist}</div>
                        </div>
                        <div className="song-meta">
                          <span className="match-score-badge">{song.match_score}% Match</span>
                        </div>
                        <div className="feedback-actions">
                          <button
                            className="feedback-btn thumbs-up"
                            onClick={(e) => handleFeedback(`${song.title} - ${song.artist}`, true, e)}
                            title="Like song"
                          >
                            👍
                          </button>
                          <button
                            className="feedback-btn thumbs-down"
                            onClick={(e) => handleFeedback(`${song.title} - ${song.artist}`, false, e)}
                            title="Dislike song"
                          >
                            👎
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button className="reset-btn" onClick={handleBackToSearch}>
                  Back to Search
                </button>
              </div>

              {/* Right Column: AI DNA metrics dashboard */}
              <div className="results-profile-column">
                <div className="profile-dna-card">
                  <h3>🧬 AI Preference Profile</h3>
                  <p className="profile-dna-subtitle">Updates dynamically in real time from your likes/dislikes</p>

                  <div className="profile-stats">
                    <div className="stat-row">
                      <div className="stat-label">
                        <span>Energy</span>
                        <span>{Math.round(profile.energy * 100)}%</span>
                      </div>
                      <div className="stat-progress-bar-container">
                        <div className="stat-progress-bar" style={{ width: `${profile.energy * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="stat-row">
                      <div className="stat-label">
                        <span>Danceability</span>
                        <span>{Math.round(profile.danceability * 100)}%</span>
                      </div>
                      <div className="stat-progress-bar-container">
                        <div className="stat-progress-bar" style={{ width: `${profile.danceability * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="stat-row">
                      <div className="stat-label">
                        <span>Valence (Positivity)</span>
                        <span>{Math.round(profile.valence * 100)}%</span>
                      </div>
                      <div className="stat-progress-bar-container">
                        <div className="stat-progress-bar" style={{ width: `${profile.valence * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="stat-row">
                      <div className="stat-label">
                        <span>Acousticness</span>
                        <span>{Math.round(profile.acousticness * 100)}%</span>
                      </div>
                      <div className="stat-progress-bar-container">
                        <div className="stat-progress-bar" style={{ width: `${profile.acousticness * 100}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="top-genre-affinity">
                    <span className="affinity-label">Top Genre Focus:</span>
                    <span className="affinity-val">{profile.top_genre}</span>
                  </div>

                  <div className="liked-history">
                    <h4>💚 Liked Songs (Current Session)</h4>
                    <div className="liked-tags">
                      {likedSongs.length === 0 ? (
                        <span className="no-liked-songs">No liked songs yet. Click 👍 on recommendations!</span>
                      ) : (
                        likedSongs.map((song, idx) => (
                          <span key={idx} className="liked-song-tag">💚 {song}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <button className="reset-profile-btn" onClick={handleResetProfile}>
                    Reset preferences
                  </button>
                </div>

                {/* Similarity Strength comparison chart */}
                <div className="ml-insights-bubble">
                  <h3>📊 Similarity Strength (ML Cosine)</h3>
                  <div className="chart-container" style={{ height: '220px', position: 'relative', marginTop: '10px' }}>
                    <canvas ref={similarityChartRef}></canvas>
                  </div>
                </div>

                {/* Genre distribution chart */}
                <div className="ml-insights-bubble">
                  <h3>🎵 Recommendation Genre Distribution</h3>
                  <div className="chart-container" style={{ height: '220px', position: 'relative', marginTop: '10px' }}>
                    <canvas ref={genreChartRef}></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>Spootifind • Powered by React & Node.js • Created by Srinand</p>
      </footer>
    </div>
  );
}

export default App;
