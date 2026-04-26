// Taste Drift — how your listening has shifted over short / medium / long term
import { getTopTracks } from '../engine.js';

async function fetchTermTracks(token, term) {
  const r = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${term}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await r.json()).items || [];
}

async function fetchTopArtists(token, term) {
  const r = await fetch(`https://api.spotify.com/v1/me/top/artists?limit=10&time_range=${term}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await r.json()).items || [];
}

function topGenres(artists) {
  const freq = {};
  artists.forEach(a => (a.genres||[]).forEach(g => { freq[g] = (freq[g]||0)+1; }));
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([g])=>g);
}

export async function renderTasteDrift(container, token) {
  container.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:20px">Loading your taste history...</div>`;

  const [shortTracks, medTracks, longTracks, shortArtists, medArtists, longArtists] = await Promise.all([
    fetchTermTracks(token,'short_term'),
    fetchTermTracks(token,'medium_term'),
    fetchTermTracks(token,'long_term'),
    fetchTopArtists(token,'short_term'),
    fetchTopArtists(token,'medium_term'),
    fetchTopArtists(token,'long_term'),
  ]);

  const terms = [
    { label:'Last 4 Weeks',  tracks:shortTracks, artists:shortArtists, color:'var(--accent)' },
    { label:'Last 6 Months', tracks:medTracks,   artists:medArtists,   color:'var(--accent2)' },
    { label:'All Time',      tracks:longTracks,  artists:longArtists,  color:'var(--gold)' },
  ];

  container.innerHTML = `
    <div style="margin-bottom:18px">
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">Taste Drift</div>
      <div style="font-size:13px;color:var(--muted)">How your listening has evolved across time. Your top tracks and genres by period.</div>
    </div>
    <div class="drift-tabs" id="driftTabs">
      ${terms.map((t,i)=>`<button class="drift-tab ${i===0?'active':''}" onclick="window.__driftTab(${i})" data-idx="${i}" style="--tc:${t.color}">${t.label}</button>`).join('')}
    </div>
    <div id="driftContent"></div>
  `;

  function renderTerm(idx) {
    const { label, tracks, artists, color } = terms[idx];
    const genres = topGenres(artists);
    document.getElementById('driftContent').innerHTML = `
      <div class="twobox" style="margin-top:14px">
        <div class="panel box">
          <div class="smallcap" style="margin-bottom:12px">Top Tracks — ${label}</div>
          ${tracks.map((t,i)=>`
            <div class="rec" style="margin-bottom:8px">
              <div class="thumb" style="${t.album?.images?.[0]?.url?`background-image:url(${t.album.images[0].url});background-size:cover`:''}"></div>
              <div><div class="rtitle">#${i+1} ${t.name}</div><div class="rsub">${t.artists[0].name}</div></div>
              <a href="${t.external_urls?.spotify}" target="_blank" style="font-size:11px;color:${color};text-decoration:none">↗</a>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="panel box">
            <div class="smallcap" style="margin-bottom:12px">Top Artists — ${label}</div>
            ${artists.map((a,i)=>`
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:36px;height:36px;border-radius:50%;background:${a.images?.[0]?.url?`url(${a.images[0].url}) center/cover`:'var(--line)'};flex-shrink:0"></div>
                <div><div style="font-size:13px;font-weight:700">#${i+1} ${a.name}</div><div style="font-size:11px;color:var(--muted)">${(a.genres||[]).slice(0,2).join(', ')}</div></div>
              </div>
            `).join('')}
          </div>
          <div class="panel box">
            <div class="smallcap" style="margin-bottom:10px">Dominant Genres</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${genres.map(g=>`<span class="chip" style="border-color:${color};color:${color};background:rgba(255,255,255,.04)">${g}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.__driftTab = (idx) => {
    document.querySelectorAll('.drift-tab').forEach(b => b.classList.toggle('active', parseInt(b.dataset.idx)===idx));
    renderTerm(idx);
  };
  renderTerm(0);
}
