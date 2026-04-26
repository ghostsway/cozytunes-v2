from models import RecTrack

GEM_THRESHOLD = 50_000

def compute_dna(tags: list[str], year: int | None) -> dict:
    """Derive DNA bar values (0-100) from tags and release year."""
    tag_str = " ".join(tags).lower()

    energy = 50
    if any(w in tag_str for w in ["metal", "punk", "trap", "hardcore", "drill"]): energy = 90
    elif any(w in tag_str for w in ["dance", "house", "techno", "edm"]): energy = 78
    elif any(w in tag_str for w in ["chill", "ambient", "sleep", "lo-fi"]): energy = 28

    danceability = 50
    if any(w in tag_str for w in ["dance", "funk", "disco", "house", "pop"]): danceability = 82
    elif any(w in tag_str for w in ["ambient", "drone", "classical"]): danceability = 20

    warmth = 50
    if any(w in tag_str for w in ["soul", "jazz", "bossa", "city pop", "ghazal", "folk"]): warmth = 82
    elif any(w in tag_str for w in ["metal", "industrial", "noise"]): warmth = 18

    smoothness = 50
    if any(w in tag_str for w in ["smooth", "r&b", "neo-soul", "city pop", "soft rock"]): smoothness = 88
    elif any(w in tag_str for w in ["grunge", "noise", "black metal", "punk"]): smoothness = 15

    tempo_feel = 60
    if year:
        if year < 1975: tempo_feel = 40
        elif year < 1990: tempo_feel = 55
        elif year > 2015: tempo_feel = 75

    return {
        "energy": energy, "danceability": danceability,
        "warmth": warmth, "smoothness": smoothness, "tempo_feel": tempo_feel,
    }

def score_candidate(
    candidate_tags: list[str], candidate_year: int | None, candidate_region: str | None,
    seed_tags: list[str], seed_year: int | None, seed_region: str | None,
    play_count: int, user_behavior: dict,
) -> float:
    """
    Score a candidate track vs seed.
    Breakdown: genre overlap (40) + era (20) + region (15) + behavior (15) + gem (10) = 100 max
    """
    score = 0.0

    # Genre/tag overlap
    overlap = len(set(seed_tags) & set(candidate_tags))
    score += min(overlap * 8, 40)

    # Era proximity
    if seed_year and candidate_year:
        diff = abs(seed_year - candidate_year)
        if diff <= 3:   score += 20
        elif diff <= 7: score += 14
        elif diff <= 15: score += 8
        elif diff <= 25: score += 4

    # Region match
    if seed_region and candidate_region:
        if seed_region.lower() == candidate_region.lower():  score += 15
        elif seed_region.lower()[:3] == candidate_region.lower()[:3]: score += 8

    # User behavior
    score += user_behavior.get("save_rate", 0.5) * 8
    score += user_behavior.get("replay_rate", 0.5) * 7

    # Hidden gem bonus
    if play_count < GEM_THRESHOLD:
        score += 10

    return round(score, 1)

def rank_candidates(candidates: list[dict]) -> list[RecTrack]:
    """Sort + return top 10 scored candidates."""
    sorted_cands = sorted(candidates, key=lambda x: x["score"], reverse=True)
    return [
        RecTrack(
            title=c["title"], artist=c["artist"], score=c["score"],
            tags=c["tags"][:4], gem=c["play_count"] < GEM_THRESHOLD,
        )
        for c in sorted_cands[:10]
    ]
