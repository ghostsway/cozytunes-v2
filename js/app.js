// CozyTunes — App Logic
let moodLocked = false;
let gemsOnly = false;

function renderApp() {
  const p = trackData;
  document.getElementById('personaTitle').textContent = p.persona[0];
  document.getElementById('personaDesc').textContent = p.persona[1];
  document.getElementById('trackTitle').textContent = p.track;
  document.getElementById('trackSub').textContent = p.sub;
  document.getElementById('matchScore').textContent = p.score;
  document.getElementById('sceneName').textContent = p.scene;
  document.getElementById('sceneMini').textContent = p.sceneMini;
  document.getElementById('railTitle').textContent = 'Recommended for you';
  document.getElementById('moodChips').innerHTML = p.chips
    .map((c, i) => `<span class="chip ${i === 0 ? 'accent' : ''}">${c}</span>`).join('');
  document.getElementById('dnaBars').innerHTML = Object.entries(p.dna)
    .map(([k, v]) => `<div class="bar-row"><div class="bar-label">${k}</div><div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div></div>`).join('');
  document.getElementById('contextList').innerHTML = p.context
    .map(t => `<div class="ctx">${t}</div>`).join('');
  document.getElementById('signals').innerHTML = Object.entries(p.signals)
    .map(([k, v]) => `<div class="sig"><div class="label">${k}</div><div class="value">${v}</div></div>`).join('');
  document.getElementById('queueBox').innerHTML =
    `<div class="smallcap">Scene Queue</div>` +
    p.queue.map((q, i) => `<div class="queue-item"><div class="qart"></div><div><div class="qtitle">${i + 1}. ${q[0]}</div><div class="qsub">${q[1]}</div></div><div style="font-size:11px;color:var(--muted)">queue</div></div>`).join('');

  let recs = p.recs;
  if (gemsOnly) recs = recs.filter(r => r.gem);
  if (moodLocked) {
    const firstTag = p.chips[0].toLowerCase().split(' ')[0];
    recs = recs.filter(r => r.tags.join(' ').toLowerCase().includes(firstTag));
  }
  document.getElementById('recList').innerHTML = recs.map(r =>
    `<div class="rec"><div class="thumb"></div><div><div class="rtitle">${r.t}</div><div class="rsub">${r.a}</div><div class="why">${r.tags.map(t => `<span>${t}</span>`).join('')}</div></div><div class="score">${r.s}</div></div>`
  ).join('') || `<div class="panel" style="padding:14px;font-size:12px;color:var(--muted)">No tracks match current filters.</div>`;

  document.getElementById('personaWeight').textContent = gemsOnly ? 'Selective' : (moodLocked ? 'Locked' : 'High');
  document.getElementById('gemsBanner').classList.toggle('show', gemsOnly);
}

function toggleQueue() {
  document.getElementById('queueBox').classList.toggle('show');
  document.getElementById('queueToggle').classList.toggle('on');
}
function toggleMoodLock() {
  moodLocked = !moodLocked;
  document.getElementById('moodToggle').classList.toggle('on', moodLocked);
  renderApp();
}
function toggleGems() {
  gemsOnly = !gemsOnly;
  document.getElementById('gemsToggle').classList.toggle('on', gemsOnly);
  renderApp();
}
function toggleDrop() {
  document.getElementById('dropBody').classList.toggle('open');
  document.getElementById('dropArrow').textContent =
    document.getElementById('dropBody').classList.contains('open') ? '⌃' : '⌄';
}
function refreshApp() { renderApp(); }

renderApp();