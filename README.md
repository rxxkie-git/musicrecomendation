# Music Recommender 🎵

Welcome to the **Music Recommender** — a fun and interactive C++ console application that suggests songs based on your mood or favorite track!

## 💡 Features

* Mood-based recommendations (Happy, Sad, Energetic, Chill)
* Personalized suggestions based on your favorite song
* Genre matching logic
* Selection Sort implementation to order songs by popularity
* Fun loading animation

## 🚀 Getting Started

### Prerequisites

* C++ compiler (e.g., g++, clang++)
* C++11 support or higher

### Files Included

* `musicrecomendation.cpp` — The core application code
* `top_250_songs_with_rank.cpp` — The list of top songs (included in `musicrecomendation.cpp`)

## 🎭 How It Works

1. User is welcomed to the interface.
2. User chooses:

   * Mood-based suggestion
   * Song-based suggestion
3. System uses genre-matching and selection sort to provide top 5 matches.
4. A loading animation adds a bit of fun 😄

## 🧠 Core Logic

### Mood-Based Suggestion

Maps mood ➡️ genre ➡️ finds 5 best matching songs:

```cpp
map<string, vector<string>> moodGenres = {
    {"happy", {"Pop", "Dance", "Reggae"}},
    {"sad", {"Ballad", "Blues", "Indie"}},
    {"energetic", {"Rock", "EDM", "Hip-Hop"}},
    {"chill", {"Lo-fi", "Jazz", "Ambient"}}
};
```

### Song-Based Suggestion

Matches the genre of the favorite song and finds top 5 similar tracks.

### Sorting

```cpp
void selectionSortByRank(vector<Song>& songs) {
    // Sorts songs by ascending rank
}
```

### Animation

```cpp
void loadingAnimation() {
    // Simple progress bar using * characters
}
```

## 📸 Screenshots

> 💡 To embed screenshots, upload images to your repo and use:

```md
![Alt text](screenshots/sample.png)
```

## 🧾 Sample Output

```
Would you like to pick a mood instead of a song? (yes/no): yes
Select a mood: chill

Here are some songs to match your chill mood:
- Sunset Dreams (Lo-fi, Rank: 3)
- Jazz & Rain (Jazz, Rank: 4)
...
```

## 📂 Directory Structure

```
📁 music-recommender/
├── musicrecomendation.cpp
├── top_250_songs_with_rank.cpp
└── README.md
```

**📝 Author**: Srinand  
**📅 Last Updated**: June 2025
