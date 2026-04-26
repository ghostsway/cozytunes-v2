// CozyTunes — App Controller (SPA, 4 views)
import { startLogin, handleCallback, isLoggedIn, getToken, logout } from './auth.js';
import { analyzeTrack, getCurrentTrack, getUserProfile, getTopTracks, getRecentTracks } from './engine.js';
import { renderSceneExplorer } from './views/scene.js';
import { renderTasteDrift }    from './views/drift.js';
import { renderInsightLab }    from './views/insight.js';

let moodLocked = false, gemsOnly = false, currentData = null;
let activeView = 'home';

// ── Boot ──────────────────────────────────────────────────────────────────────
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

// ── Screens ───────────────────────────────────────────────────────────────────
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
  el.textContent = msg; el.style.display = 'block';
}
function showLoading(on) {
  document.getElementById('loadingBar').style.display = on ? 'block' : 'none';
}

// ── View router ───────────────────────────────────────────────────────────────
window.switchView = async function(view) {
  activeView = view;
  // Update nav
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  // Hide/show right rail toggle-row based on view
  const toggleRow = document.querySelector('.toggle-row');
  const rightRail = document.querySelector('.right');
  toggleRow.style.display  = view === 'home' ? 'flex' : 'none';
  rightRail.style.display  = view === 'home' ? 'flex' : 'none';

  const main = document.getElementById('mainContent');
  showLoading(true);
  try {
    const token = await getToken();
    if (view === 'home') {
      main.innerHTML = getHomeHTML();
      rebindHome();
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

// ── User ──────────────────────────────────────────────────────────────────────
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
    document.getElementById('avatarInitial').textContent = (profile.display_name||profile.id)[0].toUpperCase();
  }
}

// ── Home view ─────────────────────────────────────────────────────────────────
function getHomeHTML() {
  return `
  <div class="search-row">
    <input class="input" id="vibeInput" placeholder="Type a feeling, scene, artist, region, or genre..." />
  </div>
  <section class="panel hero">
    <div class="art" id="albumArt"><div class="glow"></div><div class="disc"></div><div class="disc2"></div><div class="dot"></div></div>
    <div class="meta">
      <div class="now">Now analyzing</div>
      <h1 id="trackTitle">Waiting for Spotify...</h1>
      <div class="sub" id="trackSub">Play a track on Spotify</div>
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
      <div><div style="font-size:13px;font-weight:700">Why these recommendations appear</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Scored by genre, mood, era, region, language, scene, and your behavior</div></div>
      <div id="dropArrow" style="color:var(--muted)">⌄</div>
    </div>
    <div class="drop-body" id="dropBody"><div class="sig-grid" id="signals"></div></div>
  </section>`;
}

function rebindHome() {
  // toggle-row buttons reference elements recreated in getHomeHTML
  // re-expose globals so onclick attrs still work after innerHTML swap
}

async function fetchAndRender() {
  showLoading(true);
  try {
    const token = await getToken();
    const nowPlaying = await getCurrentTrack(token);
    const track = nowPlaying?.item;
    if (!track) { showNotPlaying(); return; }
    currentData = await analyzeTrack(track, token);
    renderAll(currentData);
  } catch(e) { console.error(e); showError('Something went wrong.'); }
  finally { showLoading(false); }
}

function showNotPlaying() {
  document.getElementById('trackTitle').textContent = 'Nothing playing';
  document.getElementById('trackSub').textContent   = 'Open Spotify and play a track.';
  document.getElementById('moodChips').innerHTML    = '';
  const rl = document.getElementById('recList');
  if (rl) rl.innerHTML = '<div class="panel" style="padding:14px;font-size:12px;color:var(--muted)">Play something on Spotify to get recommendations.</div>';
  ['matchScore','sceneName','sceneMini','personaWeight'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent='—'; });
}

function renderAll(d) {
  const $= id => document.getElementById(id);
  $('trackTitle').textContent = d.track.title;
  $('trackSub').textContent   = d.track.sub;
  if (d.track.albumArt) {
    const art = $('albumArt');
    art.style.backgroundImage    = `url(${d.track.albumArt})`;
    art.style.backgroundSize     = 'cover';
    art.style.backgroundPosition = 'center';
  }
  $('openSpotifyBtn').onclick = () => d.track.spotifyUrl && window.open(d.track.spotifyUrl,'_blank');
  $('matchScore').textContent    = d.matchScore;
  $('sceneName').textContent     = d.scene;
  $('sceneMini').textContent     = d.sceneMini;
  $('personaTitle').textContent  = d.persona[0];
  $('personaDesc').textContent   = d.persona[1];
  $('moodChips').innerHTML = d.chips.map((c,i)=>`<span class="chip ${i===0?'accent':''}">${c}</span>`).join('');
  $('dnaBars').innerHTML   = Object.entries(d.dna).map(([k,v])=>`<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div></div>`).join('');
  $('contextList').innerHTML = d.context.map(t=>`<div class="ctx">${t}</div>`).join('');
  $('signals').innerHTML     = Object.entries(d.signals).map(([k,v])=>`<div class="sig"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('');
  $('queueBox').innerHTML    = '<div class="smallcap">Scene Queue</div>'+d.queue.map((q,i)=>`<div class="queue-item"><div class="qart"></div><div><div class="qtitle">${i+1}. ${q[0]}</div><div class="qsub">${q[1]}</div></div><div style="font-size:11px;color:var(--muted)">queue</div></div>`).join('');
  // right rail
  const rl = document.getElementById('recList');
  if (rl) renderRecs(d.recs);
}

function renderRecs(recs) {
  let filtered = recs;
  if (gemsOnly) filtered = filtered.filter(r=>r.gem);
  if (moodLocked && currentData?.chips?.[0]) {
    const tag = currentData.chips[0].toLowerCase().split(' ')[0];
    filtered = filtered.filter(r=>r.tags.join(' ').toLowerCase().includes(tag));
  }
  const pw = document.getElementById('personaWeight');
  if (pw) pw.textContent = gemsOnly?'Selective':moodLocked?'Locked':'High';
  document.getElementById('gemsBanner')?.classList.toggle('show', gemsOnly);
  const rl = document.getElementById('recList');
  if (!rl) return;
  rl.innerHTML = filtered.map(r=>
    `<div class="rec"><div class="thumb"></div><div><div class="rtitle">${r.title}</div><div class="rsub">${r.artist}</div><div class="why">${r.tags.map(t=>`<span>${t}</span>`).join('')}</div></div><div class="score">${r.score}</div></div>`
  ).join('')||'<div class="panel" style="padding:14px;font-size:12px;color:var(--muted)">No tracks match current filters.</div>';
}

function startPolling() {
  setInterval(async () => {
    if (activeView !== 'home') return;
    const token = await getToken();
    const now = await getCurrentTrack(token);
    if (now?.item?.id && now.item.id !== currentData?.track?.id) await fetchAndRender();
  }, 30000);
}

// ── Globals ───────────────────────────────────────────────────────────────────
window.toggleQueue    = () => { document.getElementById('queueBox')?.classList.toggle('show'); document.getElementById('queueToggle')?.classList.toggle('on'); };
window.toggleMoodLock = () => { moodLocked=!moodLocked; document.getElementById('moodToggle')?.classList.toggle('on',moodLocked); if(currentData) renderRecs(currentData.recs); };
window.toggleGems     = () => { gemsOnly=!gemsOnly; document.getElementById('gemsToggle')?.classList.toggle('on',gemsOnly); if(currentData) renderRecs(currentData.recs); };
window.toggleDrop     = () => { document.getElementById('dropBody')?.classList.toggle('open'); const da=document.getElementById('dropArrow'); if(da) da.textContent=document.getElementById('dropBody')?.classList.contains('open')?'⌃':'⌄'; };
window.refreshApp     = () => fetchAndRender();
window.doLogin        = () => startLogin();
window.doLogout       = () => logout();

boot();
