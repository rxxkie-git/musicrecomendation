# Music Recommender 🎵

Welcome to the **Music Recommender** — a highly interactive and visually stunning web application. The application features a React/Vite frontend and a Node.js Express backend, providing smart, personalized song recommendations with Spotify integration.

---

## 💡 Features

* **Modern Web Interface:** Built using React, Vite, and custom CSS featuring a glassmorphic dark theme, glowing selection cards, instant auto-complete suggestions, dynamic charts for visual analytics, and smooth progress indicators.
* **Smart Recommendations:** Recommends songs based on genre preference or similarity to a favorite song using cosine similarity of acoustic features.
* **Popularity Ranking:** Sorts matching tracks using a custom Selection Sort algorithm to show the most popular recommendations first.
* **Spotify Integration:** Fetches real-time songs and features via the Spotify Web API. Automatically falls back to offline mode using local datasets if credentials are not provided or API limit is reached.

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (version 18 or higher is recommended)
* npm (comes bundled with Node.js)

### Setup and Configuration

1. **Spotify Web API Setup (Optional but Recommended):**
   - Create a free Spotify Developer account and register an app at [https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) to retrieve a Client ID and Client Secret.
   - Once you receive your credentials, create or edit the `.env` file in the `backend/` directory (a copy is already provided) and paste them:
     ```env
     SPOTIFY_CLIENT_ID=your_client_id
     SPOTIFY_CLIENT_SECRET=your_client_secret
     ```
   - *Note: If no credentials are specified or if they are invalid, the application will run in **Offline Fallback Mode** using local Spotify tracks.*

2. **Install Dependencies:**
   - In the **backend** directory:
     ```bash
     cd backend
     npm install
     ```
   - In the **frontend** directory:
     ```bash
     cd ../frontend
     npm install
     ```

### How to Run

You need to run both the backend and the frontend servers simultaneously.

1. **Start the backend server:**
   - Navigate to the `backend/` directory and run:
     ```bash
     npm start
     ```
   - The backend API server will start on [http://127.0.0.1:5000](http://127.0.0.1:5000).

2. **Start the frontend development server:**
   - Open a new terminal window, navigate to the `frontend/` directory, and run:
     ```bash
     npm run dev
     ```
   - The Vite development server will start (usually on [http://localhost:5173](http://localhost:5173)).
   - Open the URL shown in the terminal in your web browser.

---

**📝 Author**: Srinand  
**📅 Last Updated**: July 2026
