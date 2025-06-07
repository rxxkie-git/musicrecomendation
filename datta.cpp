#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <ctime>
#include <chrono>
#include <thread>
#include <map>
using namespace std;

struct Song {
    string title;
    string genre;
    int rank;
};

string toLowerCase(string str) {
    transform(str.begin(), str.end(), str.begin(), ::tolower);
    return str;
}

void loadingAnimation() {
    cout << "\nLoading your personalized music recommendations...\n" << endl;
    cout << "[";
    for (int i = 0; i < 20; ++i) {
        cout << "*";
        cout.flush();
        this_thread::sleep_for(chrono::milliseconds(100));
    }
    cout << "]" << endl;
    cout << "\nDone!\n" << endl;
}

// [Selection Sort Added]
void selectionSortByRank(vector<Song>& songs) {
    int n = songs.size();
    for (int i = 0; i < n - 1; ++i) {
        int minIdx = i;
        for (int j = i + 1; j < n; ++j) {
            if (songs[j].rank < songs[minIdx].rank) {
                minIdx = j;
            }
        }
        swap(songs[i], songs[minIdx]);
    }
}

int main() {
    cout << "==============================================" << endl;
    cout << "      Welcome to the Music Recommender!        " << endl;
    cout << "==============================================" << endl;
    cout << endl;

    vector<Song> songs = {
        #include "top_250_songs_with_rank.cpp"
    };

    srand(time(0));

    cout << "Would you like to pick a mood instead of a song? (yes/no): ";
    string mood_choice;
    getline(cin, mood_choice);

    if (toLowerCase(mood_choice) == "yes") {
        cout << "Select a mood: happy, sad, energetic, chill: ";
        string mood;
        getline(cin, mood);

        map<string, vector<string>> moodGenres = {
            {"happy", {"Pop", "Dance", "Reggae"}},
            {"sad", {"Ballad", "Blues", "Indie"}},
            {"energetic", {"Rock", "EDM", "Hip-Hop"}},
            {"chill", {"Lo-fi", "Jazz", "Ambient"}}
        };


        if (moodGenres.find(toLowerCase(mood)) != moodGenres.end()) {
            vector<string> genres = moodGenres[toLowerCase(mood)];
            vector<Song> mood_songs;
            random_shuffle(mood_songs.begin(), mood_songs.end());
            for (auto& song : songs) {
                if (find(genres.begin(), genres.end(), song.genre) != genres.end()) {
                    mood_songs.push_back(song);
                }
            }

            // [Sort by rank before showing]
            selectionSortByRank(mood_songs);

            cout << "\nHere are some songs to match your " << mood << " mood:\n\n";
            for (int i = 0; i < min(5, (int)mood_songs.size()); ++i) {
                cout << "- " << mood_songs[i].title << " (" << mood_songs[i].genre << ", Rank: " << mood_songs[i].rank << ")\n";
            }

            cout << "\nThank you for using the Music Recommender! Have a great day!\n";
            return 0;
        } else {
            cout << "\nSorry, we don't recognize that mood. Try again with: happy, sad, energetic, or chill.\n";
            return 0;
        }
    }

    string name;
    cout << "Enter your name: ";
    getline(cin, name);

    string fav_song;
    cout << "Enter a song you like: ";
    getline(cin, fav_song);

    string fav_song_lower = toLowerCase(fav_song);

    bool song_found = false;
    string target_genre;
    for (auto& song : songs) {
        if (toLowerCase(song.title) == fav_song_lower) {
            song_found = true;
            target_genre = song.genre;
            break;
        }
    }

    if (!song_found) {
        cout << "\nSorry " << name << ", we couldn't find the song \"" << fav_song << "\" in our database.\n";
        return 0;
    }

    loadingAnimation();

    vector<Song> similar_songs;

    random_shuffle(similar_songs.begin(), similar_songs.end());

    for (auto& song : songs) {
        if (song.genre == target_genre && toLowerCase(song.title) != fav_song_lower) {
            similar_songs.push_back(song);
        }
    }

    // [Sort similar songs by rank before showing]
    selectionSortByRank(similar_songs);

    int num_to_show = min(5, (int)similar_songs.size());

    cout << "\nHi " << name << ", because you liked \"" << fav_song << "\", you might also enjoy these " << target_genre << " songs:\n" << endl;
    for (int i = 0; i < num_to_show; ++i) {
        cout << "- " << similar_songs[i].title << " (Rank: " << similar_songs[i].rank << ")" << endl;
    }

    cout << "\nThank you for using the Music Recommender! Have a great day!\n" << endl;

    return 0;
}
