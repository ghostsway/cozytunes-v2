# CozyTunes v4 — Multi-Genre

A dark, cinematic Spotify discovery webapp with your own recommendation engine.

## Features
- 🎵 Multi-genre packs: City Pop, Punjabi Trap, Deep House, Metal, Ghazal, K-Pop
- 🧬 Track DNA — Energy, Danceability, Warmth, Smoothness, Tempo visualized
- 🔍 Vibe Search — type a mood, scene, or feeling
- 💎 Hidden Gems mode — surfaces underplayed tracks
- 🔒 Mood Lock — pin your current mood
- 📡 Scene Queue — genre-matched playback queue
- 🎯 Why these recs appear — expandable signal breakdown
- 👤 Listener Persona — adapts per genre pack

## Structure
```
cozytunes-v2/
├── index.html       # Main HTML shell
├── css/
│   └── styles.css   # All styles and CSS variables
├── js/
│   ├── data.js      # Genre packs data model
│   └── app.js       # App logic and rendering
└── README.md
```

## Tech Stack
- Vanilla HTML/CSS/JS (no build step needed)
- Spotify Web API (for live integration)
- Last.fm + MusicBrainz (recommendation engine)
- FastAPI backend (planned)

## Setup
Open `index.html` in a browser. For live Spotify data, wire up the backend with your Spotify Client ID.