// CozyTunes — Spotify PKCE OAuth (no client secret, GitHub Pages compatible)

const CLIENT_ID = '9f61aa90ed9e465d9bfd9f8f8b4e91e4';
const REDIRECT_URI = window.location.origin + window.location.pathname;
// streaming scope required for /me/player/play
const SCOPES = 'user-read-currently-playing user-read-recently-played user-top-read user-library-read user-read-private user-modify-playback-state streaming';

async function sha256(plain) {
  const enc = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', enc);
}
function base64urlEncode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function generateCodeVerifier() {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64urlEncode(arr);
}
async function generateCodeChallenge(verifier) {
  return base64urlEncode(await sha256(verifier));
}

export async function startLogin() {
  const verifier   = generateCodeVerifier();
  const challenge  = await generateCodeChallenge(verifier);
  localStorage.setItem('ct_verifier', verifier);
  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  });
  window.location = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleCallback() {
  const params   = new URLSearchParams(window.location.search);
  const code     = params.get('code');
  if (!code) return false;
  const verifier = localStorage.getItem('ct_verifier');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem('ct_token',   data.access_token);
    localStorage.setItem('ct_refresh', data.refresh_token);
    localStorage.setItem('ct_expires', Date.now() + data.expires_in * 1000);
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  }
  return false;
}

export async function refreshAccessToken() {
  const rt = localStorage.getItem('ct_refresh');
  if (!rt) return null;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: rt,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    localStorage.setItem('ct_token',   data.access_token);
    localStorage.setItem('ct_expires', Date.now() + data.expires_in * 1000);
    return data.access_token;
  }
  return null;
}

export async function getToken() {
  const expires = parseInt(localStorage.getItem('ct_expires') || '0');
  if (Date.now() > expires - 60000) return await refreshAccessToken();
  return localStorage.getItem('ct_token');
}

export function isLoggedIn() { return !!localStorage.getItem('ct_token'); }

export function logout() {
  ['ct_token','ct_refresh','ct_expires','ct_verifier'].forEach(k => localStorage.removeItem(k));
  window.location.reload();
}
