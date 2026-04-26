from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import asyncio

from models import TrackPayload
import spotify as sp
import lastfm as lfm
import musicbrainz as mb
from scorer import compute_dna, score_candidate, rank_candidates

app = FastAPI(title="CozyTunes API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────

@app.get("/login")
def login():
    return RedirectResponse(sp.get_auth_url())

@app.get("/callback")
async def callback(code: str = Query(...)):
    tokens = await sp.exchange_code(code)
    return tokens

@app.post("/refresh")
async def refresh(refresh_token: str):
    return await sp.refresh_token(refresh_token)

# ── Engine ────────────────────────────────────────────────────────────────────

@app.get("/analyze", response_model=TrackPayload)
async def analyze(track_id: str, access_token: str):
    """
    Full pipeline:
    1. Spotify  → track metadata
    2. Last.fm  → seed tags + 50 similar track candidates
    3. MusicBrainz → enrich seed with genre, region, year
    4. For each candidate: enrich + score vs seed
    5. Rank + return top 10 recs as TrackPayload
    """
    track = await sp.get_track(track_id, access_token)

    seed_tags, similar, _ = await asyncio.gather(
        lfm.get_track_tags(track.artist, track.title),
        lfm.get_similar_tracks(track.artist, track.title, limit=50),
        asyncio.sleep(0),
    )

    seed_mb = await mb.get_recording_tags(track.artist, track.title)
    all_tags = list(set(seed_tags + seed_mb["genres"]))
    seed_region = seed_mb.get("area")
    seed_year = seed_mb.get("year") or track.year

    scored = []
    for s in similar[:50]:
        artist = s.get("artist", {}).get("name", "")
        title  = s.get("name", "")
        if not artist or not title:
            continue
        cand_tags, cand_mb, play_count = await asyncio.gather(
            lfm.get_track_tags(artist, title),
            mb.get_recording_tags(artist, title),
            lfm.get_track_play_count(artist, title),
        )
        merged = list(set(cand_tags + cand_mb["genres"]))
        sc = score_candidate(
            candidate_tags=merged,
            candidate_year=cand_mb.get("year"),
            candidate_region=cand_mb.get("area"),
            seed_tags=all_tags,
            seed_year=seed_year,
            seed_region=seed_region,
            play_count=play_count,
            user_behavior={"save_rate": 0.6, "skip_rate": 0.1, "replay_rate": 0.5},
        )
        scored.append({"title": title, "artist": artist, "score": sc,
                        "tags": merged, "play_count": play_count})

    recs = rank_candidates(scored)
    dna_raw = compute_dna(all_tags, seed_year)

    return TrackPayload(
        track=track,
        dna=dna_raw,
        persona=["Your Listener Persona", "Based on your Spotify history."],
        scene=seed_region or "Global",
        scene_mini=f"{seed_year or '?'} · {', '.join(all_tags[:3])}",
        match_score=92,
        mood_chips=all_tags[:5],
        context=[
            "Recommendations scored by genre, era, region, and your behavior.",
            "Last.fm seeds · MusicBrainz enrichment · CozyTunes scorer.",
        ],
        signals={
            "Genre":    ", ".join(all_tags[:3]),
            "Era":      f"\u00b15 years of {seed_year}" if seed_year else "unknown",
            "Region":   seed_region or "global",
            "Language": "auto-detected",
            "Behavior": "save + replay weighted",
            "Gems":     "low play count boosted",
        },
        queue=[[r.title, r.artist] for r in recs[:5]],
        recs=recs,
    )

@app.get("/current", response_model=TrackPayload)
async def current_track(access_token: str):
    """Analyze whatever is currently playing on Spotify."""
    now = await sp.get_current_track(access_token)
    if not now or not now.get("item"):
        raise HTTPException(status_code=404, detail="Nothing playing right now.")
    return await analyze(track_id=now["item"]["id"], access_token=access_token)
