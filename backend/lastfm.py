import httpx
from config import LASTFM_API_KEY

BASE = "https://ws.audioscrobbler.com/2.0/"

async def get_similar_tracks(artist: str, title: str, limit: int = 50) -> list[dict]:
    """Seed ~50 candidates from Last.fm similar tracks."""
    async with httpx.AsyncClient() as client:
        r = await client.get(BASE, params={
            "method": "track.getSimilar",
            "artist": artist,
            "track": title,
            "api_key": LASTFM_API_KEY,
            "format": "json",
            "limit": limit,
        })
        return r.json().get("similartracks", {}).get("track", [])

async def get_track_tags(artist: str, title: str) -> list[str]:
    """Get top genre/mood tags for a track."""
    async with httpx.AsyncClient() as client:
        r = await client.get(BASE, params={
            "method": "track.getTopTags",
            "artist": artist,
            "track": title,
            "api_key": LASTFM_API_KEY,
            "format": "json",
        })
        tags = r.json().get("toptags", {}).get("tag", [])
        return [t["name"].lower() for t in tags[:10]]

async def get_artist_tags(artist: str) -> list[str]:
    """Get top genre tags for an artist."""
    async with httpx.AsyncClient() as client:
        r = await client.get(BASE, params={
            "method": "artist.getTopTags",
            "artist": artist,
            "api_key": LASTFM_API_KEY,
            "format": "json",
        })
        tags = r.json().get("toptags", {}).get("tag", [])
        return [t["name"].lower() for t in tags[:10]]

async def get_track_play_count(artist: str, title: str) -> int:
    """Return global play count — low count flags Hidden Gems."""
    async with httpx.AsyncClient() as client:
        r = await client.get(BASE, params={
            "method": "track.getInfo",
            "artist": artist,
            "track": title,
            "api_key": LASTFM_API_KEY,
            "format": "json",
        })
        info = r.json().get("track", {})
        return int(info.get("playcount", 0))
