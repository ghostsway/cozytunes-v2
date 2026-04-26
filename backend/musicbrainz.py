import httpx
from config import MUSICBRAINZ_APP

BASE = "https://musicbrainz.org/ws/2"
HEADERS = {"User-Agent": MUSICBRAINZ_APP, "Accept": "application/json"}

async def get_recording_tags(artist: str, title: str) -> dict:
    """
    Fetch genre, era (decade), and region tags from MusicBrainz.
    Returns: { genres: [...], area: str | None, year: int | None }
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{BASE}/recording",
            params={"query": f'recording:"{title}" AND artist:"{artist}"', "limit": 1, "fmt": "json"},
            headers=HEADERS
        )
        data = r.json()
        recordings = data.get("recordings", [])
        if not recordings:
            return {"genres": [], "area": None, "year": None}

        rec = recordings[0]
        genres = [g["name"].lower() for g in rec.get("genres", [])]

        area = None
        artist_credits = rec.get("artist-credit", [])
        if artist_credits:
            artist_id = artist_credits[0].get("artist", {}).get("id")
            if artist_id:
                ar = await client.get(
                    f"{BASE}/artist/{artist_id}",
                    params={"fmt": "json", "inc": "genres+tags"},
                    headers=HEADERS
                )
                artist_data = ar.json()
                area = artist_data.get("area", {}).get("name")
                if not genres:
                    genres = [g["name"].lower() for g in artist_data.get("genres", [])]

        year = None
        first_release = rec.get("first-release-date", "")
        if first_release:
            try:
                year = int(first_release[:4])
            except ValueError:
                pass

        return {"genres": genres[:8], "area": area, "year": year}
