// Scene Explorer — browse music by genre/region scene
import { getTopTracks, getRecentTracks } from '../engine.js';

const SCENES = [
  { id:'citypop',   label:'Japan City Pop',    tags:['city pop','j-pop','japanese'],       emoji:'🇯🇵' },
  { id:'hiphop',    label:'Hip-Hop / Rap',      tags:['hip-hop','rap','trap'],               emoji:'🎤' },
  { id:'electronic',label:'Electronic / Club',  tags:['house','techno','edm','electronic'],  emoji:'🔊' },
  { id:'indie',     label:'Indie / Alt',         tags:['indie','alternative','indie pop'],    emoji:'🎸' },
  { id:'jazz',      label:'Jazz / Soul',         tags:['jazz','soul','blues','bossa nova'],   emoji:'🎷' },
  { id:'metal',     label:'Heavy / Metal',       tags:['metal','hardcore','punk','rock'],     emoji:'🤘' },
  { id:'lofi',      label:'Lo-Fi / Chill',       tags:['lo-fi','chill','ambient','sleep'],    emoji:'☕' },
  { id:'rnb',       label:'R&B / Neo-Soul',      tags:['r&b','neo-soul','smooth','funk'],     emoji:'💃' },
  { id:'pop',       label:'Global Pop',          tags:['pop','dance pop','synth-pop'],        emoji:'🌍' },
  { id:'folk',      label:'Folk / Acoustic',     tags:['folk','acoustic','singer-songwriter'],emoji:'🎻' },
  { id:'punjabi',   label:'Punjabi / Desi',      tags:['punjabi','bhangra','desi','bollywood'],emoji:'🇮🇳' },
  { id:'latin',     label:'Latin',               tags:['latin','reggaeton','salsa','cumbia'], emoji:'🔥' },
];

export async function renderSceneExplorer(container, token) {
  // Get user's top tracks to detect which scenes they already listen to
  const top = await getTopTracks(token, 50);
  const recent = await getRecentTracks(token, 50);
  const allTracks = [
    ...top.map(t => ({ name:t.name, artist:t.artists[0].name, album:t.album?.name, art:t.album?.images?.[0]?.url, url:t.external_urls?.spotify })),
    ...recent.map(i => ({ name:i.track?.name, artist:i.track?.artists?.[0]?.name, album:i.track?.album?.name, art:i.track?.album?.images?.[0]?.url, url:i.track?.external_urls?.spotify })),
  ];

  container.innerHTML = `
    <div style="margin-bottom:18px">
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">Scene Explorer</div>
      <div style="font-size:13px;color:var(--muted)">Browse music by region and genre scene. Tap a scene to see your tracks from it.</div>
    </div>
    <div class="scene-grid" id="sceneGrid">
      ${SCENES.map(s => `
        <div class="scene-card" onclick="window.__sceneClick('${s.id}')" data-scene="${s.id}">
          <div class="scene-emoji">${s.emoji}</div>
          <div class="scene-label">${s.label}</div>
          <div class="scene-tags">${s.tags.slice(0,3).join(' · ')}</div>
        </div>
      `).join('')}
    </div>
    <div id="sceneDetail" style="margin-top:18px"></div>
  `;

  window.__sceneClick = (id) => {
    const scene = SCENES.find(s => s.id === id);
    if (!scene) return;
    // highlight selected
    document.querySelectorAll('.scene-card').forEach(c => c.classList.toggle('active', c.dataset.scene === id));
    // filter tracks that match scene tags
    const matched = allTracks.filter(t => {
      const str = `${t.name} ${t.artist} ${t.album}`.toLowerCase();
      return scene.tags.some(tag => str.includes(tag.toLowerCase()));
    });
    const detail = document.getElementById('sceneDetail');
    if (!matched.length) {
      detail.innerHTML = `<div class="panel" style="padding:16px;font-size:13px;color:var(--muted)">
        No tracks from <strong>${scene.label}</strong> found in your recent or top 50 listening history.
      </div>`;
      return;
    }
    detail.innerHTML = `
      <div class="panel" style="padding:16px">
        <div class="smallcap" style="margin-bottom:12px">${scene.emoji} Your ${scene.label} tracks (${matched.length})</div>
        ${[...new Map(matched.map(t=>[t.name+t.artist,t])).values()].slice(0,20).map(t=>`
          <div class="rec" style="margin-bottom:8px">
            <div class="thumb" style="${t.art?`background-image:url(${t.art});background-size:cover;background-position:center`:''}"></div>
            <div><div class="rtitle">${t.name}</div><div class="rsub">${t.artist}</div></div>
            ${t.url ? `<a href="${t.url}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none">open ↗</a>` : ''}
          </div>
        `).join('')}
      </div>`;
  };
}
