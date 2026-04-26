// CozyTunes — App Controller (SPA, 4 views)
import { startLogin, handleCallback, isLoggedIn, getToken, logout } from './auth.js';
import { analyzeTrack, getCurrentTrack, getUserProfile, getTopTracks, getRecentTracks } from './engine.js';
import { renderSceneExplorer } from './views/scene.js';
import { renderTasteDrift }    from './views/drift.js';
import { renderInsightLab }    from './views/insight.js';

let moodLocked = false, gemsOnly = false, currentData = null;
let activeView = 'home', vinylMode = false;
let searchTimer = null;

// ── Boot ───────────────────────────────────────────────────────────────
async function boot() {
  if (window.location.search.includes('code=')) {
    const ok = await handleCallback();
    if (!ok) { showError('Login failed. Please try again.'); return; }
  }
  if (!isLoggedIn()) { showLoginScreen(); return; }
  showAppShell();
  await loadUser();
  await switchView('home');
  startPolling();
}

// ── Screens ───────────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display    = 'none';
}
function showAppShell() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display    = 'grid';
}
function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function showLoading(on) {
  document.getElementById('loadingBar').style.display = on ? 'block' : 'none';
}

// ── View router ──────────────────────────────────────────────────────────────
window.switchView = async function(view) {
  activeView = view;
  document.querySelectorAll('.nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.view === view)
  );
  const rightRail = document.querySelector('.right');
  const fixedBar  = document.getElementById('globalToggleRow');
  rightRail.style.display = view === 'home' ? 'flex' : 'none';
  if (fixedBar) fixedBar.style.display = view === 'home' ? 'flex' : 'none';

  const main = document.getElementById('mainContent');
  showLoading(true);
  try {
    const token = await getToken();
    if (view === 'home') {
      main.innerHTML = getHomeHTML();
      bindSearchBar();
      await fetchAndRender();
    } else if (view === 'scene') {
      main.innerHTML = '<div id="sceneView"></div>';
      await renderSceneExplorer(document.getElementById('sceneView'), token);
    } else if (view === 'drift') {
      main.innerHTML = '<div id="driftView"></div>';
      await renderTasteDrift(document.getElementById('driftView'), token);
    } else if (view === 'insight') {
      main.innerHTML = '<div id="insightView"></div>';
      await renderInsightLab(document.getElementById('insightView'), token);
    }
  } catch(e) { console.error(e); showError('Failed to load view.'); }
  finally { showLoading(false); }
};

// ── User ───────────────────────────────────────────────────────────────────
async function loadUser() {
  const token = await getToken();
  const profile = await getUserProfile(token);
  if (!profile) return;
  document.getElementById('userName').textContent = profile.display_name || profile.id;
  const img = profile.images?.[0]?.url;
  if (img) {
    document.getElementById('avatarImg').src = img;
    document.getElementById('avatarImg').style.display = 'block';
    document.getElementById('avatarInitial').style.display = 'none';
  } else {
    document.getElementById('avatarInitial').textContent =
      (profile.display_name || profile.id)[0].toUpperCase();
  }
}

// ── Home HTML ──────────────────────────────────────────────────────────────
function getHomeHTML() {
  return `
  <div class="search-row">
    <div class="search-wrap">
      <input class="input" id="vibeInput" placeholder="Search any track or artist to play &amp; analyze..." autocomplete="off" />
      <div id="searchResults" class="search-results"></div>
    </div>
    <button class="btn vinyl-btn" id="vinylBtn" onclick="toggleVinyl()" title="Vinyl Mode">
      ● Vinyl
    </button>
  </div>
  <section class="panel hero" id="heroSection">
    <div class="art" id="albumArt">
      <div class="glow"></div><div class="disc"></div><div class="disc2"></div><div class="dot"></div>
    </div>
    <div class="meta">
      <div class="now">Now analyzing</div>
      <h1 id="trackTitle">Waiting for Spotify...</h1>
      <div class="sub" id="trackSub">Play a track on Spotify or search above</div>
      <div class="chips" id="moodChips"></div>
      <div class="actions">
        <button class="btn primary">Save to playlist</button>
        <button class="btn" id="openSpotifyBtn">Open in Spotify</button>
        <button class="btn" onclick="refreshApp()">Refresh</button>
      </div>
    </div>
  </section>
  <section class="panel queue" id="queueBox"></section>
  <section class="grid3">
    <div class="panel stat"><div class="label">Match score</div><div class="value" id="matchScore">—</div><div class="mini">vs your listening profile</div></div>
    <div class="panel stat"><div class="label">Dominant scene</div><div class="value" id="sceneName" style="font-size:18px">—</div><div class="mini" id="sceneMini">—</div></div>
    <div class="panel stat"><div class="label">Persona weight</div><div class="value" id="personaWeight" style="color:var(--gold)">—</div><div class="mini">Based on saves, repeats, skips</div></div>
  </section>
  <section class="twobox">
    <div class="panel box"><div class="smallcap">Track DNA</div><div id="dnaBars"></div></div>
    <div class="panel box"><div class="smallcap">Personal Context</div><div id="contextList"></div></div>
  </section>
  <section class="panel dropdown">
    <div class="drop-head" onclick="toggleDrop()">
      <div>
        <div style="font-size:13px;font-weight:700">Why these recommendations appear</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Scored by genre, mood, era, region, language, scene, and your behavior</div>
      </div>
      <div id="dropArrow" style="color:var(--muted)">⌄</div>
    </div>
    <div class="drop-body" id="dropBody"><div class="sig-grid" id="signals"></div></div>
  </section>`;
}

// ── Spotify playback ───────────────────────────────────────────────────────────
async function playTrackOnSpotify(spotifyUri) {
  const token = await getToken();
  const res = await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [spotifyUri] }),
  });

  if (res.status === 204) return { ok: true };          // played fine
  if (res.status === 403) return { ok: false, reason: 'premium' }; // not premium
  if (res.status === 404) return { ok: false, reason: 'no_device' }; // no active device
  return { ok: false, reason: 'error' };
}

function showPlayToast(msg, type = 'ok') {
  let toast = document.getElementById('playToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'playToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `play-toast ${type}`;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Search bar ─────────────────────────────────────────────────────────────
function bindSearchBar() {
  const input   = document.getElementById('vibeInput');
  const results = document.getElementById('searchResults');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; results.classList.remove('open'); return; }
    searchTimer = setTimeout(() => doSearch(q), 380);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      results.innerHTML = '';
      results.classList.remove('open');
    }
  });
}

async function doSearch(query) {
  const results = document.getElementById('searchResults');
  if (!results) return;
  results.innerHTML = '<div class="sr-loading">Searching...</div>';
  results.classList.add('open');

  try {
    const token = await getToken();
    const r = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data   = await r.json();
    const tracks = data?.tracks?.items || [];

    if (!tracks.length) {
      results.innerHTML = '<div class="sr-loading">No results found.</div>';
      return;
    }

    results.innerHTML = tracks.map(t => `
      <div class="sr-item" data-id="${t.id}" data-uri="${t.uri}">
        <div class="sr-art" style="${t.album?.images?.[2]?.url
          ? `background-image:url(${t.album.images[2].url});background-size:cover;background-position:center`
          : ''}"></div>
        <div class="sr-info">
          <div class="sr-title">${t.name}</div>
          <div class="sr-sub">${t.artists[0].name} · ${t.album?.name}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <div class="sr-year">${t.album?.release_date?.slice(0, 4) || ''}</div>
          <button class="sr-play-btn" data-uri="${t.uri}" title="Play on Spotify">
            ▶
          </button>
        </div>
      </div>
    `).join('');

    // Click row → analyze only
    results.querySelectorAll('.sr-item').forEach(el => {
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.sr-play-btn')) return; // handled separately
        closeSearch();
        await analyzeById(el.dataset.id);
      });
    });

    // Click ▶ button → play on Spotify + analyze
    results.querySelectorAll('.sr-play-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uri = btn.dataset.uri;
        const trackId = btn.closest('.sr-item').dataset.id;
        closeSearch();

        // Analyze immediately (fast, no wait for playback)
        analyzeById(trackId);

        // Send play command in parallel
        const result = await playTrackOnSpotify(uri);
        if (result.ok) {
          showPlayToast('▶ Playing on Spotify');
        } else if (result.reason === 'premium') {
          showPlayToast('⚠ Spotify Premium required to control playback', 'warn');
        } else if (result.reason === 'no_device') {
          showPlayToast('⚠ Open Spotify on any device first, then retry', 'warn');
        } else {
          showPlayToast('⚠ Could not start playback', 'warn');
        }
      });
    });

  } catch(e) {
    console.error(e);
    results.innerHTML = '<div class="sr-loading">Search failed.</div>';
  }
}

function closeSearch() {
  const results = document.getElementById('searchResults');
  const input   = document.getElementById('vibeInput');
  if (results) { results.innerHTML = ''; results.classList.remove('open'); }
  if (input)   input.value = '';
}

async function analyzeById(trackId) {
  showLoading(true);
  try {
    const token = await getToken();
    const r     = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const track = await r.json();
    currentData = await analyzeTrack(track, token);
    renderAll(currentData);
  } catch(e) {
    console.error(e);
    showError('Could not analyze that track.');
  } finally {
    showLoading(false);
  }
}

// ── Vinyl mode ─────────────────────────────────────────────────────────────
window.toggleVinyl = function() {
  vinylMode = !vinylMode;
  const btn  = document.getElementById('vinylBtn');
  const art  = document.getElementById('albumArt');
  const hero = document.getElementById('heroSection');
  btn?.classList.toggle('on', vinylMode);
  if (vinylMode) {
    if (art) { art.style.backgroundImage = ''; art.style.backgroundSize = ''; art.classList.add('vinyl-spin'); }
    hero?.classList.add('vinyl-mode');
  } else {
    if (art) {
      art.classList.remove('vinyl-spin');
      if (currentData?.track?.albumArt) {
        art.style.backgroundImage    = `url(${currentData.track.albumArt})`;
        art.style.backgroundSize     = 'cover';
        art.style.backgroundPosition = 'center';
      }
    }
    hero?.classList.remove('vinyl-mode');
  }
};

// ── Fetch + render ────────────────────────────────────────────────────────────
async function fetchAndRender() {
  showLoading(true);
  try {
    const token      = await getToken();
    const nowPlaying = await getCurrentTrack(token);
    const track      = nowPlaying?.item;
    if (!track) { showNotPlaying(); return; }
    currentData = await analyzeTrack(track, token);
    renderAll(currentData);
  } catch(e) { console.error(e); showError('Something went wrong.'); }
  finally { showLoading(false); }
}

function showNotPlaying() {
  const $ = id => document.getElementById(id);
  $('trackTitle').textContent = 'Nothing playing';
  $('trackSub').textContent   = 'Search a track above or play one on Spotify.';
  $('moodChips').innerHTML    = '';
  const rl = $('recList');
  if (rl) rl.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--muted)">Play something on Spotify or search above.</div>';
  ['matchScore','sceneName','sceneMini','personaWeight'].forEach(id => { const el=$(id); if(el) el.textContent='—'; });
}

function renderAll(d) {
  const $ = id => document.getElementById(id);
  $('trackTitle').textContent = d.track.title;
  $('trackSub').textContent   = d.track.sub;
  if (!vinylMode && d.track.albumArt) {
    const art = $('albumArt');
    if (art) {
      art.style.backgroundImage    = `url(${d.track.albumArt})`;
      art.style.backgroundSize     = 'cover';
      art.style.backgroundPosition = 'center';
    }
  }
  $('openSpotifyBtn').onclick = () => d.track.spotifyUrl && window.open(d.track.spotifyUrl, '_blank');
  $('matchScore').textContent   = d.matchScore;
  $('sceneName').textContent    = d.scene;
  $('sceneMini').textContent    = d.sceneMini;
  $('personaTitle').textContent = d.persona[0];
  $('personaDesc').textContent  = d.persona[1];
  $('moodChips').innerHTML = d.chips.map((c,i) =>
    `<span class="chip ${i===0?'accent':''}">${c}</span>`).join('');
  $('dnaBars').innerHTML = Object.entries(d.dna).map(([k,v]) =>
    `<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div></div>`).join('');
  $('contextList').innerHTML = d.context.map(t => `<div class="ctx">${t}</div>`).join('');
  $('signals').innerHTML     = Object.entries(d.signals).map(([k,v]) =>
    `<div class="sig"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('');
  $('queueBox').innerHTML = '<div class="smallcap">Scene Queue</div>' +
    d.queue.map((q,i) =>
      `<div class="queue-item"><div class="qart"></div><div><div class="qtitle">${i+1}. ${q[0]}</div><div class="qsub">${q[1]}</div></div><div style="font-size:11px;color:var(--muted)">queue</div></div>`
    ).join('');
  renderRecs(d.recs);
}

function renderRecs(recs) {
  let filtered = recs;
  if (gemsOnly)   filtered = filtered.filter(r => r.gem);
  if (moodLocked && currentData?.chips?.[0]) {
    const tag = currentData.chips[0].toLowerCase().split(' ')[0];
    filtered  = filtered.filter(r => r.tags.join(' ').toLowerCase().includes(tag));
  }
  const pw = document.getElementById('personaWeight');
  if (pw) pw.textContent = gemsOnly ? 'Selective' : moodLocked ? 'Locked' : 'High';
  document.getElementById('gemsBanner')?.classList.toggle('show', gemsOnly);
  const rl = document.getElementById('recList');
  if (!rl) return;
  rl.innerHTML = filtered.map(r =>
    `<div class="rec"><div class="thumb"></div><div><div class="rtitle">${r.title}</div><div class="rsub">${r.artist}</div><div class="why">${r.tags.map(t=>`<span>${t}</span>`).join('')}</div></div><div class="score">${r.score}</div></div>`
  ).join('') || '<div style="padding:14px;font-size:12px;color:var(--muted)">No tracks match current filters.</div>';
}

function startPolling() {
  setInterval(async () => {
    if (activeView !== 'home') return;
    const token = await getToken();
    const now   = await getCurrentTrack(token);
    if (now?.item?.id && now.item.id !== currentData?.track?.id) await fetchAndRender();
  }, 30000);
}

// ── Globals ─────────────────────────────────────────────────────────────────
window.toggleQueue    = () => { document.getElementById('queueBox')?.classList.toggle('show'); document.getElementById('queueToggle')?.classList.toggle('on'); };
window.toggleMoodLock = () => { moodLocked=!moodLocked; document.getElementById('moodToggle')?.classList.toggle('on',moodLocked); if(currentData) renderRecs(currentData.recs); };
window.toggleGems     = () => { gemsOnly=!gemsOnly; document.getElementById('gemsToggle')?.classList.toggle('on',gemsOnly); if(currentData) renderRecs(currentData.recs); };
window.toggleDrop     = () => { document.getElementById('dropBody')?.classList.toggle('open'); const da=document.getElementById('dropArrow'); if(da) da.textContent=document.getElementById('dropBody')?.classList.contains('open')?'⌃':'⌄'; };
window.refreshApp     = () => fetchAndRender();
window.doLogin        = () => startLogin();
window.doLogout       = () => logout();

boot();
