// CozyTunes — App Controller
import { startLogin, handleCallback, isLoggedIn, getToken, logout } from './auth.js';
import { analyzeTrack, getCurrentTrack, getUserProfile } from './engine.js';

let moodLocked = false, gemsOnly = false, currentData = null;

async function boot() {
  if (window.location.search.includes('code=')) {
    const ok = await handleCallback();
    if (!ok) { showError('Login failed. Please try again.'); return; }
  }
  if (!isLoggedIn()) { showLoginScreen(); return; }
  showAppShell();
  await loadUser();
  await fetchAndRender();
  startPolling();
}

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
  el.textContent = msg;
  el.style.display = 'block';
}
function showLoading(on) {
  document.getElementById('loadingBar').style.display = on ? 'block' : 'none';
}

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

async function fetchAndRender() {
  showLoading(true);
  try {
    const token = await getToken();
    const nowPlaying = await getCurrentTrack(token);
    const track = nowPlaying?.item;
    if (!track) { showNotPlaying(); return; }
    currentData = await analyzeTrack(track, token);
    renderAll(currentData);
  } catch(e) {
    console.error(e);
    showError('Something went wrong. Check console.');
  } finally {
    showLoading(false);
  }
}

function showNotPlaying() {
  document.getElementById('trackTitle').textContent = 'Nothing playing';
  document.getElementById('trackSub').textContent   = 'Open Spotify and play a track.';
  document.getElementById('moodChips').innerHTML    = '';
  document.getElementById('recList').innerHTML      = '<div class="panel" style="padding:14px;font-size:12px;color:var(--muted)">Play something on Spotify to get recommendations.</div>';
  ['matchScore','sceneName','sceneMini','personaWeight'].forEach(id => document.getElementById(id).textContent = '—');
}

function renderAll(d) {
  document.getElementById('trackTitle').textContent = d.track.title;
  document.getElementById('trackSub').textContent   = d.track.sub;
  if (d.track.albumArt) {
    const art = document.getElementById('albumArt');
    art.style.backgroundImage = `url(${d.track.albumArt})`;
    art.style.backgroundSize  = 'cover';
    art.style.backgroundPosition = 'center';
  }
  document.getElementById('openSpotifyBtn').onclick = () => d.track.spotifyUrl && window.open(d.track.spotifyUrl,'_blank');
  document.getElementById('matchScore').textContent   = d.matchScore;
  document.getElementById('sceneName').textContent    = d.scene;
  document.getElementById('sceneMini').textContent    = d.sceneMini;
  document.getElementById('personaTitle').textContent = d.persona[0];
  document.getElementById('personaDesc').textContent  = d.persona[1];
  document.getElementById('moodChips').innerHTML = d.chips.map((c,i)=>`<span class="chip ${i===0?'accent':''}">${c}</span>`).join('');
  document.getElementById('dnaBars').innerHTML = Object.entries(d.dna).map(([k,v])=>`<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div></div>`).join('');
  document.getElementById('contextList').innerHTML = d.context.map(t=>`<div class="ctx">${t}</div>`).join('');
  document.getElementById('signals').innerHTML = Object.entries(d.signals).map(([k,v])=>`<div class="sig"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('');
  document.getElementById('queueBox').innerHTML = '<div class="smallcap">Scene Queue</div>'+d.queue.map((q,i)=>`<div class="queue-item"><div class="qart"></div><div><div class="qtitle">${i+1}. ${q[0]}</div><div class="qsub">${q[1]}</div></div><div style="font-size:11px;color:var(--muted)">queue</div></div>`).join('');
  renderRecs(d.recs);
}

function renderRecs(recs) {
  let filtered = recs;
  if (gemsOnly) filtered = filtered.filter(r=>r.gem);
  if (moodLocked && currentData?.chips?.[0]) {
    const tag = currentData.chips[0].toLowerCase().split(' ')[0];
    filtered = filtered.filter(r=>r.tags.join(' ').toLowerCase().includes(tag));
  }
  document.getElementById('personaWeight').textContent = gemsOnly?'Selective':moodLocked?'Locked':'High';
  document.getElementById('gemsBanner').classList.toggle('show', gemsOnly);
  document.getElementById('recList').innerHTML = filtered.map(r=>
    `<div class="rec"><div class="thumb"></div><div><div class="rtitle">${r.title}</div><div class="rsub">${r.artist}</div><div class="why">${r.tags.map(t=>`<span>${t}</span>`).join('')}</div></div><div class="score">${r.score}</div></div>`
  ).join('')||'<div class="panel" style="padding:14px;font-size:12px;color:var(--muted)">No tracks match current filters.</div>';
}

function startPolling() {
  setInterval(async () => {
    const token = await getToken();
    const now   = await getCurrentTrack(token);
    if (now?.item?.id && now.item.id !== currentData?.track?.id) await fetchAndRender();
  }, 30000);
}

window.toggleQueue    = () => { document.getElementById('queueBox').classList.toggle('show'); document.getElementById('queueToggle').classList.toggle('on'); };
window.toggleMoodLock = () => { moodLocked=!moodLocked; document.getElementById('moodToggle').classList.toggle('on',moodLocked); if(currentData) renderRecs(currentData.recs); };
window.toggleGems     = () => { gemsOnly=!gemsOnly; document.getElementById('gemsToggle').classList.toggle('on',gemsOnly); if(currentData) renderRecs(currentData.recs); };
window.toggleDrop     = () => { document.getElementById('dropBody').classList.toggle('open'); document.getElementById('dropArrow').textContent = document.getElementById('dropBody').classList.contains('open')?'⌃':'⌄'; };
window.refreshApp     = () => fetchAndRender();
window.doLogin        = () => startLogin();
window.doLogout       = () => logout();

boot();
