from pydantic import BaseModel
from typing import Optional

class TrackInfo(BaseModel):
    id: str
    title: str
    artist: str
    album: str
    year: Optional[int] = None
    duration_ms: int
    spotify_url: str
    genres: list[str] = []
    tags: list[str] = []
    region: Optional[str] = None
    era: Optional[str] = None

class DNABars(BaseModel):
    energy: float
    danceability: float
    warmth: float
    smoothness: float
    tempo_feel: float

class RecTrack(BaseModel):
    title: str
    artist: str
    score: float
    tags: list[str]
    gem: bool

class TrackPayload(BaseModel):
    track: TrackInfo
    dna: DNABars
    persona: list[str]
    scene: str
    scene_mini: str
    match_score: int
    mood_chips: list[str]
    context: list[str]
    signals: dict[str, str]
    queue: list[list[str]]
    recs: list[RecTrack]
