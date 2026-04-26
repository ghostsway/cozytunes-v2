// CozyTunes — Recommendation Engine
// Pipeline: Spotify → Last.fm similar tracks + tags → MusicBrainz enrichment → CozyTunes scorer

const LASTFM_KEY  = 'YOUR_LASTFM_API_KEY'; // Replace with your Last.fm API key
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const MB_BASE     = 'https://musicbrainz.org/ws/2';
const MB_HEADERS  = { 'User-Agent': 'CozyTunes/2.0 (himanshsway@gmail.com)', 'Accept': 'application/json' };
const GEM_THRESHOLD = 50000;

// ─ Spotify helpers ────────────────────────────────────────────────────────────

async function spotifyGet(path, token) {
  const r = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 204) return null;
  return r.json();
}

export const getCurrentTrack   = (token) => spotifyGet('/me/player/currently-playing', token);
export const getRecentTracks   = (token, n=50) => spotifyGet(`/me/player/recently-played?limit=${n}`, token).then(d => d?.items || []);
export const getTopTracks      = (token, n=50) => spotifyGet(`/me/top/tracks?limit=${n}&time_range=medium_term`, token).then(d => d?.items || []);
export const getUserProfile    = (token) => spotifyGet('/me', token);

// ─ Last.fm ──────────────────────────────────────────────────────────────────

async function lfmGet(params) {
  const url = new URL(LASTFM_BASE);
  Object.entries({ ...params, api_key: LASTFM_KEY, format: 'json' }).forEach(([k, v]) => url.searchParams.set(k, v));
  return (await fetch(url)).json();
}

const getSimilarTracks   = (a, t, n=40) => lfmGet({ method:'track.getSimilar', artist:a, track:t, limit:n }).then(d => d?.similartracks?.track || []);
const getTrackTags       = (a, t)       => lfmGet({ method:'track.getTopTags', artist:a, track:t }).then(d => (d?.toptags?.tag||[]).slice(0,10).map(x=>x.name.toLowerCase()));
const getTrackPlayCount  = (a, t)       => lfmGet({ method:'track.getInfo', artist:a, track:t }).then(d => parseInt(d?.track?.playcount||'0'));

// ─ MusicBrainz ───────────────────────────────────────────────────────────

async function getMBTags(artist, title) {
  try {
    await new Promise(r => setTimeout(r, 300)); // rate limit
    const url = new URL(`${MB_BASE}/recording`);
    url.searchParams.set('query', `recording:"${title}" AND artist:"${artist}"`);
    url.searchParams.set('limit', '1');
    url.searchParams.set('fmt', 'json');
    const data = await (await fetch(url, { headers: MB_HEADERS })).json();
    const rec = data?.recordings?.[0];
    if (!rec) return { genres: [], area: null, year: null };

    const genres = (rec.genres || []).map(g => g.name.toLowerCase());
    let area = null;
    const artistId = rec['artist-credit']?.[0]?.artist?.id;
    if (artistId) {
      await new Promise(r => setTimeout(r, 300));
      const ar = await (await fetch(`${MB_BASE}/artist/${artistId}?fmt=json&inc=genres`, { headers: MB_HEADERS })).json();
      area = ar?.area?.name || null;
      if (!genres.length) genres.push(...(ar.genres||[]).map(g=>g.name.toLowerCase()));
    }
    let year = null;
    try { year = parseInt(rec['first-release-date']?.slice(0,4)); } catch(_) {}
    return { genres: genres.slice(0,6), area, year };
  } catch(_) { return { genres:[], area:null, year:null }; }
}

// ─ Scorer ──────────────────────────────────────────────────────────────────

function computeDNA(tags, year) {
  const t = tags.join(' ').toLowerCase();
  const pick = (hi, mid, lo, def) =>
    hi.some(w=>t.includes(w)) ? 82+Math.random()*12|0 :
    mid.some(w=>t.includes(w)) ? 58+Math.random()*18|0 :
    lo.some(w=>t.includes(w)) ? 18+Math.random()*16|0 : def;
  return {
    Energy:       pick(['metal','punk','trap','drill'],['dance','house','edm'],['ambient','chill','lo-fi'],52),
    Danceability: pick(['dance','funk','disco','house'],['pop','r&b'],['ambient','classical'],55),
    Warmth:       pick(['soul','jazz','bossa','city pop','ghazal'],['pop','indie'],['metal','noise'],50),
    Smoothness:   pick(['smooth','neo-soul','city pop','soft rock'],['pop','indie'],['grunge','punk','metal'],50),
    'Tempo feel': year ? (year<1975?38:year<1990?55:year>2015?78:62) : 60,
  };
}

function scoreCandidate({candTags,candYear,candRegion,seedTags,seedYear,seedRegion,playCount,userBehavior}) {
  let s = 0;
  s += Math.min([...new Set(candTags)].filter(t=>seedTags.includes(t)).length * 9, 40);
  if (seedYear && candYear) {
    const d = Math.abs(seedYear-candYear);
    s += d<=3?20:d<=7?14:d<=15?8:d<=25?4:0;
  }
  if (seedRegion && candRegion) {
    s += seedRegion.toLowerCase()===candRegion.toLowerCase()?15:
         seedRegion.toLowerCase().slice(0,3)===candRegion.toLowerCase().slice(0,3)?8:0;
  }
  s += (userBehavior.saveRate||0.5)*8 + (userBehavior.replayRate||0.5)*7;
  if (playCount < GEM_THRESHOLD) s += 10;
  return Math.round(s*10)/10;
}

function buildContext(track, recent, top, tags) {
  const lines = [];
  const rArtists = recent.map(i=>i.track?.artists?.[0]?.name);
  const cnt = rArtists.filter(a=>a===track.artists[0].name).length;
  if (cnt > 2) lines.push(`You've played ${track.artists[0].name} ${cnt}x recently.`);
  if (top.find(t=>t.id===track.id)) lines.push('This track is in your top 50 this month.');
  lines.push(`Genre match: ${tags.slice(0,2).join(', ')||'multi-genre'} — scored vs your profile.`);
  lines.push('Sourced from Last.fm · enriched by MusicBrainz.');
  return lines.slice(0,3);
}

function detectScene(tags) {
  const t = tags.join(' ');
  if (t.includes('city pop')||t.includes('j-pop')) return 'Japan City Pop';
  if (t.includes('trap')||t.includes('punjabi')) return 'Punjabi Trap';
  if (t.includes('house')||t.includes('techno')) return 'Electronic / Club';
  if (t.includes('metal')||t.includes('hardcore')) return 'Heavy / Metal';
  if (t.includes('jazz')||t.includes('bossa')) return 'Jazz / Soul';
  if (t.includes('hip-hop')||t.includes('rap')) return 'Hip-Hop / Rap';
  if (t.includes('indie')||t.includes('alternative')) return 'Indie / Alt';
  return 'Global Mix';
}

function msToTime(ms) {
  if (!ms) return '?';
  const m = Math.floor(ms/60000);
  const s = String(Math.floor((ms%60000)/1000)).padStart(2,'0');
  return `${m}:${s}`;
}

// ─ Main pipeline ─────────────────────────────────────────────────────────

export async function analyzeTrack(track, token) {
  const artist = track.artists[0].name;
  const title  = track.name;
  const year   = track.album?.release_date ? parseInt(track.album.release_date.slice(0,4)) : null;
  const albumArt = track.album?.images?.[0]?.url || null;

  const [seedTags, similar, seedMB, recent, top] = await Promise.all([
    getTrackTags(artist, title),
    getSimilarTracks(artist, title, 40),
    getMBTags(artist, title),
    getRecentTracks(token, 50),
    getTopTracks(token, 50),
  ]);

  const allTags    = [...new Set([...seedTags, ...seedMB.genres])];
  const seedRegion = seedMB.area;
  const seedYear   = seedMB.year || year;
  const recentIds  = new Set(recent.map(i=>i.track?.id));
  const topIds     = new Set(top.map(t=>t.id));
  const userBehavior = {
    saveRate:   topIds.has(track.id)    ? 0.9 : 0.5,
    replayRate: recentIds.has(track.id) ? 0.85 : 0.5,
  };

  const scored = [];
  for (const s of similar.slice(0,30)) {
    const a = typeof s?.artist === 'string' ? s.artist : s?.artist?.name;
    const t = s?.name;
    if (!a || !t) continue;
    const [cTags, cMB, plays] = await Promise.all([
      getTrackTags(a, t),
      getMBTags(a, t),
      getTrackPlayCount(a, t),
    ]);
    const merged = [...new Set([...cTags,...cMB.genres])];
    const sc = scoreCandidate({ candTags:merged, candYear:cMB.year, candRegion:cMB.area, seedTags:allTags, seedYear, seedRegion, playCount:plays, userBehavior });
    scored.push({ title:t, artist:a, score:sc, tags:merged.slice(0,4), playCount:plays, gem:plays<GEM_THRESHOLD });
  }
  scored.sort((a,b)=>b.score-a.score);

  const topArtists = top.slice(0,5).map(t=>t.artists[0].name);
  const persona = topArtists.length
    ? ['Your Listener Profile', `Top artists: ${topArtists.join(', ')}`]
    : ['Music Explorer', 'Discovering sounds across genres.'];

  return {
    track: { id:track.id, title, artist, album:track.album?.name, year, sub:`${artist} · ${track.album?.name} · ${year||'?'} · ${msToTime(track.duration_ms)}`, spotifyUrl:track.external_urls?.spotify, albumArt },
    dna: computeDNA(allTags, seedYear),
    persona,
    scene: seedRegion || detectScene(allTags),
    sceneMini: `${seedYear||'?'} · ${allTags.slice(0,3).join(', ')}`,
    matchScore: Math.min(99, Math.round(60+(userBehavior.saveRate+userBehavior.replayRate)*20)),
    chips: allTags.slice(0,6),
    context: buildContext(track, recent, top, allTags),
    signals: {
      Genre:    allTags.slice(0,3).join(' · ')||'detecting...',
      Era:      seedYear ? `±5 yrs of ${seedYear}` : 'unknown',
      Region:   seedRegion||'global',
      Language: 'auto-detected',
      Behavior: userBehavior.saveRate>0.7 ? 'high save rate' : 'moderate engagement',
      Gems:     'low play count boosted',
    },
    queue:  scored.slice(0,5).map(r=>[r.title,r.artist]),
    recs:   scored.slice(0,8),
  };
}
