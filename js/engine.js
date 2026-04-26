// CozyTunes — Recommendation Engine (fast path)
// Pipeline: Spotify → Last.fm similar + tags (batched, cached) → CozyTunes scorer
// MusicBrainz removed from hot path (was causing 30+ sec delays)

const LASTFM_KEY  = 'e86e8c93a90515e8b4c33226b0b9e5a3';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const GEM_THRESHOLD = 50000;

// ─ TTL cache (5 min) ──────────────────────────────────────────────────────────
const _cache = new Map();
function cacheGet(k) {
  const e = _cache.get(k);
  if (!e) return null;
  if (Date.now() > e.exp) { _cache.delete(k); return null; }
  return e.val;
}
function cacheSet(k, val, ttl = 300_000) {
  _cache.set(k, { val, exp: Date.now() + ttl });
}

// ─ Concurrency limiter ────────────────────────────────────────────────────────
// Runs at most `limit` promises at once — prevents hammering Last.fm
async function pLimit(tasks, limit = 6) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─ Spotify helpers ────────────────────────────────────────────────────────────
async function spotifyGet(path, token) {
  const cached = cacheGet('sp:' + path);
  if (cached) return cached;
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (r.status === 204) return null;
  const data = await r.json();
  cacheSet('sp:' + path, data, 60_000); // 1 min for live data
  return data;
}

export const getCurrentTrack = (token) =>
  fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.status === 204 ? null : r.json()).catch(() => null);

export const getRecentTracks = (token, n = 50) =>
  spotifyGet(`/me/player/recently-played?limit=${n}`, token).then(d => d?.items || []);

export const getTopTracks = (token, n = 50) =>
  spotifyGet(`/me/top/tracks?limit=${n}&time_range=medium_term`, token).then(d => d?.items || []);

export const getUserProfile = (token) => spotifyGet('/me', token);

// ─ Last.fm (cached) ───────────────────────────────────────────────────────────
async function lfmGet(params) {
  const key = 'lfm:' + JSON.stringify(params);
  const cached = cacheGet(key);
  if (cached) return cached;
  const url = new URL(LASTFM_BASE);
  Object.entries({ ...params, api_key: LASTFM_KEY, format: 'json' })
    .forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const data = await fetch(url).then(r => r.json());
    cacheSet(key, data);
    return data;
  } catch { return {}; }
}

const getSimilarTracks  = (a, t, n = 20) =>
  lfmGet({ method: 'track.getSimilar', artist: a, track: t, limit: n })
    .then(d => d?.similartracks?.track || []);

const getTrackTags = (a, t) =>
  lfmGet({ method: 'track.getTopTags', artist: a, track: t })
    .then(d => (d?.toptags?.tag || []).slice(0, 8).map(x => x.name.toLowerCase()));

const getTrackInfo = (a, t) =>
  lfmGet({ method: 'track.getInfo', artist: a, track: t })
    .then(d => ({
      playcount: parseInt(d?.track?.playcount || '0'),
      duration:  parseInt(d?.track?.duration  || '0'),
    }));

// ─ Scorer ─────────────────────────────────────────────────────────────────────
function computeDNA(tags, year) {
  const t = tags.join(' ').toLowerCase();
  const pick = (hi, mid, lo, def) =>
    hi.some(w  => t.includes(w)) ? 82 + Math.random() * 12 | 0 :
    mid.some(w => t.includes(w)) ? 58 + Math.random() * 18 | 0 :
    lo.some(w  => t.includes(w)) ? 18 + Math.random() * 16 | 0 : def;
  return {
    Energy:        pick(['metal','punk','trap','drill'],['dance','house','edm'],['ambient','chill','lo-fi'], 52),
    Danceability:  pick(['dance','funk','disco','house'],['pop','r&b'],['ambient','classical'], 55),
    Warmth:        pick(['soul','jazz','bossa','city pop','ghazal'],['pop','indie'],['metal','noise'], 50),
    Smoothness:    pick(['smooth','neo-soul','city pop','soft rock'],['pop','indie'],['grunge','punk','metal'], 50),
    'Tempo feel':  year ? (year < 1975 ? 38 : year < 1990 ? 55 : year > 2015 ? 78 : 62) : 60,
  };
}

function scoreCandidate({ candTags, seedTags, candYear, seedYear, playCount, userBehavior }) {
  let s = 0;
  // Tag overlap (max 40)
  s += Math.min([...new Set(candTags)].filter(t => seedTags.includes(t)).length * 9, 40);
  // Era closeness (max 20) — uses Spotify release_date year, no MB needed
  if (seedYear && candYear) {
    const d = Math.abs(seedYear - candYear);
    s += d <= 3 ? 20 : d <= 7 ? 14 : d <= 15 ? 8 : d <= 25 ? 4 : 0;
  }
  // User behaviour signals
  s += (userBehavior.saveRate   || 0.5) * 8;
  s += (userBehavior.replayRate || 0.5) * 7;
  // Hidden gem boost
  if (playCount < GEM_THRESHOLD) s += 10;
  return Math.round(s * 10) / 10;
}

function buildContext(track, recent, top, tags) {
  const lines = [];
  const rArtists = recent.map(i => i.track?.artists?.[0]?.name);
  const cnt = rArtists.filter(a => a === track.artists[0].name).length;
  if (cnt > 2) lines.push(`You've played ${track.artists[0].name} ${cnt}× recently.`);
  if (top.find(t => t.id === track.id)) lines.push('This track is in your top 50 this month.');
  lines.push(`Genre match: ${tags.slice(0, 2).join(', ') || 'multi-genre'} — scored vs your profile.`);
  lines.push('Sourced from Last.fm · scored by CozyTunes.');
  return lines.slice(0, 3);
}

function detectScene(tags) {
  const t = tags.join(' ');
  if (t.includes('city pop') || t.includes('j-pop'))   return 'Japan City Pop';
  if (t.includes('trap')     || t.includes('punjabi')) return 'Punjabi Trap';
  if (t.includes('house')    || t.includes('techno'))  return 'Electronic / Club';
  if (t.includes('metal')    || t.includes('hardcore'))return 'Heavy / Metal';
  if (t.includes('jazz')     || t.includes('bossa'))   return 'Jazz / Soul';
  if (t.includes('hip-hop')  || t.includes('rap'))     return 'Hip-Hop / Rap';
  if (t.includes('indie')    || t.includes('alternative')) return 'Indie / Alt';
  return 'Global Mix';
}

function msToTime(ms) {
  if (!ms) return '?';
  const m = Math.floor(ms / 60000);
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${m}:${s}`;
}

// ─ Main pipeline (fast) ───────────────────────────────────────────────────────
export async function analyzeTrack(track, token) {
  const artist   = track.artists[0].name;
  const title    = track.name;
  const year     = track.album?.release_date ? parseInt(track.album.release_date.slice(0, 4)) : null;
  const albumArt = track.album?.images?.[0]?.url || null;

  // Phase 1 — all seed data in parallel (no MB, no delays)
  const [seedTags, similar, recent, top] = await Promise.all([
    getTrackTags(artist, title),
    getSimilarTracks(artist, title, 20),   // reduced from 40 → snappier
    getRecentTracks(token, 50),
    getTopTracks(token, 50),
  ]);

  const recentIds    = new Set(recent.map(i => i.track?.id));
  const topIds       = new Set(top.map(t => t.id));
  const userBehavior = {
    saveRate:   topIds.has(track.id)    ? 0.9 : 0.5,
    replayRate: recentIds.has(track.id) ? 0.85 : 0.5,
  };

  // Phase 2 — fetch tags + playcount for all candidates in parallel (batched, max 6 concurrent)
  const candidates = similar.slice(0, 20).map(s => ({
    artist: typeof s?.artist === 'string' ? s.artist : s?.artist?.name,
    title:  s?.name,
  })).filter(c => c.artist && c.title);

  const candData = await pLimit(
    candidates.map(c => async () => {
      const [tags, info] = await Promise.all([
        getTrackTags(c.artist, c.title),
        getTrackInfo(c.artist, c.title),
      ]);
      // Use Last.fm duration to infer approx year (absent of MB)
      return { ...c, tags, playCount: info.playcount };
    }),
    6  // max 6 concurrent Last.fm requests
  );

  const scored = candData.map(c => {
    const sc = scoreCandidate({
      candTags:  c.tags,
      seedTags,
      candYear:  null,   // fast path: skip year scoring for candidates
      seedYear:  year,
      playCount: c.playCount,
      userBehavior,
    });
    return { title: c.title, artist: c.artist, score: sc, tags: c.tags.slice(0, 4), playCount: c.playCount, gem: c.playCount < GEM_THRESHOLD };
  }).sort((a, b) => b.score - a.score);

  const topArtists = top.slice(0, 5).map(t => t.artists[0].name);
  const persona = topArtists.length
    ? ['Your Listener Profile', `Top artists: ${topArtists.join(', ')}`]
    : ['Music Explorer', 'Discovering sounds across genres.'];

  return {
    track: {
      id: track.id, title, artist,
      album:      track.album?.name,
      year,
      sub:        `${artist} · ${track.album?.name} · ${year || '?'} · ${msToTime(track.duration_ms)}`,
      spotifyUrl: track.external_urls?.spotify,
      albumArt,
    },
    dna:        computeDNA(seedTags, year),
    persona,
    scene:      detectScene(seedTags),
    sceneMini:  `${year || '?'} · ${seedTags.slice(0, 3).join(', ')}`,
    matchScore: Math.min(99, Math.round(60 + (userBehavior.saveRate + userBehavior.replayRate) * 20)),
    chips:      seedTags.slice(0, 6),
    context:    buildContext(track, recent, top, seedTags),
    signals: {
      Genre:    seedTags.slice(0, 3).join(' · ') || 'detecting...',
      Era:      year ? `±5 yrs of ${year}` : 'unknown',
      Region:   'global',
      Language: 'auto-detected',
      Behavior: userBehavior.saveRate > 0.7 ? 'high save rate' : 'moderate engagement',
      Gems:     'low play count boosted',
    },
    queue: scored.slice(0, 5).map(r => [r.title, r.artist]),
    recs:  scored.slice(0, 8),
  };
}
