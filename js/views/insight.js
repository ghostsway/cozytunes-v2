// Insight Lab — listening stats, genre breakdown, play patterns
import { getTopTracks, getRecentTracks } from '../engine.js';

async function fetchTopArtists(token, term='medium_term', limit=20) {
  const r = await fetch(`https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=${term}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return (await r.json()).items || [];
}

function genreFrequency(artists) {
  const freq = {};
  artists.forEach(a => (a.genres||[]).forEach(g => { freq[g]=(freq[g]||0)+1; }));
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]);
}

function hourFromTimestamp(ts) {
  return new Date(ts).getHours();
}

export async function renderInsightLab(container, token) {
  container.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:20px">Crunching your stats...</div>`;

  const [topArtists, topTracks, recent] = await Promise.all([
    fetchTopArtists(token, 'medium_term', 20),
    getTopTracks(token, 50),
    getRecentTracks(token, 50),
  ]);

  const genres = genreFrequency(topArtists).slice(0,10);
  const maxGenreCount = genres[0]?.[1] || 1;

  // Play hour distribution from recent tracks
  const hourBuckets = Array(24).fill(0);
  recent.forEach(i => { if (i.played_at) hourBuckets[hourFromTimestamp(i.played_at)]++; });
  const maxHour = Math.max(...hourBuckets, 1);
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  const peakLabel = peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour-12} PM`;

  // Unique artists in recent 50
  const uniqueArtists = new Set(recent.map(i=>i.track?.artists?.[0]?.name).filter(Boolean)).size;
  const uniqueTracks  = new Set(recent.map(i=>i.track?.id).filter(Boolean)).size;
  const repeatRate    = recent.length ? Math.round((1 - uniqueTracks/recent.length)*100) : 0;

  container.innerHTML = `
    <div style="margin-bottom:18px">
      <div style="font-size:22px;font-weight:900;margin-bottom:4px">Insight Lab</div>
      <div style="font-size:13px;color:var(--muted)">Deep dive into your listening DNA. Stats based on your Spotify history.</div>
    </div>

    <div class="grid3" style="margin-bottom:14px">
      <div class="panel stat">
        <div class="label">Unique Artists</div>
        <div class="value">${uniqueArtists}</div>
        <div class="mini">in recent 50 plays</div>
      </div>
      <div class="panel stat">
        <div class="label">Repeat Rate</div>
        <div class="value" style="color:var(--gold)">${repeatRate}%</div>
        <div class="mini">tracks played more than once</div>
      </div>
      <div class="panel stat">
        <div class="label">Peak Hour</div>
        <div class="value" style="color:var(--accent)">${peakLabel}</div>
        <div class="mini">most active listening time</div>
      </div>
    </div>

    <div class="twobox" style="margin-bottom:14px">
      <div class="panel box">
        <div class="smallcap" style="margin-bottom:14px">Genre Fingerprint</div>
        ${genres.map(([g,c])=>`
          <div class="bar-row">
            <div class="bar-label" style="width:120px;font-size:11px">${g}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c/maxGenreCount*100)}%"></div></div>
            <div style="font-size:11px;color:var(--muted);width:20px;text-align:right">${c}</div>
          </div>
        `).join('')}
      </div>
      <div class="panel box">
        <div class="smallcap" style="margin-bottom:14px">Listen Clock <span style="font-size:10px;color:var(--muted)">(recent 50 plays)</span></div>
        <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
          ${hourBuckets.map((c,h)=>{
            const intensity = Math.round(c/maxHour*100);
            const label = h===0?'12a':h<12?`${h}a`:h===12?'12p':`${h-12}p`;
            return `<div style="text-align:center">
              <div style="height:40px;background:linear-gradient(to top,var(--accent2),var(--accent));opacity:${0.1+intensity/100*0.9};border-radius:4px;margin-bottom:3px"></div>
              <div style="font-size:9px;color:var(--muted)">${label}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--muted)">Peak listening: <span style="color:var(--accent)">${peakLabel}</span></div>
      </div>
    </div>

    <div class="panel box">
      <div class="smallcap" style="margin-bottom:14px">Top Artists This Month</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
        ${topArtists.slice(0,12).map((a,i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:var(--panel2);border:1px solid var(--line)">
            <div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;background:${a.images?.[0]?.url?`url(${a.images[0].url}) center/cover`:'linear-gradient(135deg,var(--accent2),var(--accent))'}"></div>
            <div style="overflow:hidden">
              <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${i+1} ${a.name}</div>
              <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(a.genres||[]).slice(0,1).join('')||'artist'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
