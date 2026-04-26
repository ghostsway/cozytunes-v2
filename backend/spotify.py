import httpx
from config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI
from models import TrackInfo

AUTH_URL  = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
API_BASE  = "https://api.spotify.com/v1"

SCOPES = "user-read-currently-playing user-read-recently-played user-library-read user-top-read"

def get_auth_url() -> str:
    from urllib.parse import urlencode
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": SCOPES,
    }
    return f"{AUTH_URL}?{urlencode(params)}"

async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": SPOTIFY_REDIRECT_URI,
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        })
        return r.json()

async def refresh_token(refresh_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": SPOTIFY_CLIENT_ID,
            "client_secret": SPOTIFY_CLIENT_SECRET,
        })
        return r.json()

async def get_current_track(access_token: str) -> dict | None:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_BASE}/me/player/currently-playing",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if r.status_code == 204:
            return None
        return r.json()

async def get_track(track_id: str, access_token: str) -> TrackInfo:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_BASE}/tracks/{track_id}",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        data = r.json()
        return TrackInfo(
            id=data["id"],
            title=data["name"],
            artist=data["artists"][0]["name"],
            album=data["album"]["name"],
            year=int(data["album"]["release_date"][:4]) if data["album"].get("release_date") else None,
            duration_ms=data["duration_ms"],
            spotify_url=data["external_urls"]["spotify"],
        )

async def search_tracks(query: str, access_token: str, limit: int = 20) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_BASE}/search",
            params={"q": query, "type": "track", "limit": limit},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        return r.json().get("tracks", {}).get("items", [])

async def get_user_top_tracks(access_token: str, limit: int = 50) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_BASE}/me/top/tracks",
            params={"limit": limit, "time_range": "medium_term"},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        return r.json().get("items", [])

async def get_recently_played(access_token: str, limit: int = 50) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_BASE}/me/player/recently-played",
            params={"limit": limit},
            headers={"Authorization": f"Bearer {access_token}"}
        )
        return r.json().get("items", [])
