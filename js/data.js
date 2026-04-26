// CozyTunes — Track Data
// This will be replaced by live Spotify + Last.fm + MusicBrainz API data.
// Shape: one trackData object per currently analyzed track.

const trackData = {
  persona: ['Late-Night Nostalgic', 'Smooth grooves, replay-heavy after dark, scene-led listening.'],
  track: 'Stay With Me',
  sub: 'Miki Matsubara · Pocket Park · 1980 · 4:56',
  score: '96',
  scene: 'Japan City Pop',
  sceneMini: 'Tokyo · 1978–1988 · neon-night nostalgia',
  chips: ['Japanese City Pop', 'Nostalgic', 'Disco Groove', 'Female Vocal', 'Late Night'],
  dna: { Energy: 62, Danceability: 78, Warmth: 88, Smoothness: 92, 'Tempo feel': 55 },
  context: [
    'You replay this scene mostly between 10 PM and 1 AM.',
    'You saved 14 adjacent city-pop or J-funk tracks in the last month.',
    'Skip rate for smooth 80s Japanese tracks is under 5%.'
  ],
  signals: {
    Genre: 'city pop · j-funk · disco',
    Mood: 'wistful · silky · neon-night',
    Era: '±5 years around 1980',
    Region: 'Japan / Tokyo cluster',
    Language: 'Japanese preference boost',
    Behavior: 'high save + replay rate'
  },
  queue: [
    ['Plastic Love', 'Mariya Takeuchi'],
    ['Flyday Chinatown', 'Yasuha'],
    ['4:00 A.M.', 'Taeko Onuki'],
    ['September', 'Piper'],
    ['Ride on Time', 'Tatsuro Yamashita']
  ],
  recs: [
    { t: 'Plastic Love', a: 'Mariya Takeuchi', s: 96, tags: ['city pop', '80s Japan', 'night groove'], gem: false },
    { t: '4:00 A.M.', a: 'Taeko Onuki', s: 93, tags: ['urban mood', 'soft funk', 'female vocal'], gem: false },
    { t: 'Flyday Chinatown', a: 'Yasuha', s: 91, tags: ['city pop', 'era match', 'danceable'], gem: true },
    { t: 'Telephone Number', a: 'Junko Ohashi', s: 88, tags: ['retro-pop', 'Japan', 'bright groove'], gem: true }
  ]
};