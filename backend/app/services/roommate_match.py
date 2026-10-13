"""
Roommate compatibility scoring.

Pure functions only (no DB access) so the logic is easy to unit test and
explain in a demo: each trait produces a 0..1 similarity, traits are
combined with fixed weights into a 0..100 score, and the strongest
agreements / disagreements are returned as human-readable reasons.
"""

from typing import Any

WEIGHTS = {
    "budget": 25,
    "sleep": 20,
    "cleanliness": 20,
    "noise": 15,
    "guests": 10,
    "area": 10,
}

SLEEP_LABEL = {"early": "early risers", "late": "night owls", "flexible": "flexible on sleep"}


def _scale_similarity(a: int, b: int) -> float:
    """1-5 scales: identical = 1.0, opposite ends = 0.0."""
    return 1 - abs(a - b) / 4


def _budget_similarity(a: Any, b: Any) -> float:
    lo = max(a.budget_min, b.budget_min)
    hi = min(a.budget_max, b.budget_max)
    if hi < lo:
        return 0.0
    span = min(a.budget_max - a.budget_min, b.budget_max - b.budget_min)
    if span <= 0:
        return 1.0
    return max(0.1, min(1.0, (hi - lo) / span))


def _sleep_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if "flexible" in (a, b):
        return 0.7
    return 0.0


def _area_similarity(a: Any, b: Any) -> float:
    if not a.preferred_area or not b.preferred_area:
        return 0.5  # neutral when unknown
    return 1.0 if a.preferred_area.strip().lower() == b.preferred_area.strip().lower() else 0.0


def gender_compatible(a: Any, b: Any) -> bool:
    if a.same_gender_only or b.same_gender_only:
        return a.gender == b.gender
    return True


def score_pair(a: Any, b: Any) -> dict:
    sims = {
        "budget": _budget_similarity(a, b),
        "sleep": _sleep_similarity(a.sleep_schedule, b.sleep_schedule),
        "cleanliness": _scale_similarity(a.cleanliness, b.cleanliness),
        "noise": _scale_similarity(a.noise_tolerance, b.noise_tolerance),
        "guests": _scale_similarity(a.guests_comfort, b.guests_comfort),
        "area": _area_similarity(a, b),
    }
    total_weight = sum(WEIGHTS.values())
    score = round(sum(WEIGHTS[k] * sims[k] for k in WEIGHTS) / total_weight * 100)

    reasons: list[str] = []
    cautions: list[str] = []

    if sims["budget"] >= 0.8:
        reasons.append("Similar budget")
    elif sims["budget"] == 0.0:
        cautions.append("Budgets don't overlap")

    if a.sleep_schedule == b.sleep_schedule:
        reasons.append(f"Both {SLEEP_LABEL[a.sleep_schedule]}")
    elif sims["sleep"] == 0.0:
        cautions.append("Different sleep schedules")

    if sims["cleanliness"] >= 0.75:
        reasons.append("Similar cleanliness standards")
    elif sims["cleanliness"] <= 0.25:
        cautions.append("Very different cleanliness standards")

    if sims["noise"] >= 0.75:
        reasons.append("Similar noise tolerance")
    elif sims["noise"] <= 0.25:
        cautions.append("Different noise tolerance")

    if sims["guests"] >= 0.75:
        reasons.append("Similar views on guests")
    elif sims["guests"] <= 0.25:
        cautions.append("Different views on guests")

    if a.preferred_area and b.preferred_area and sims["area"] == 1.0:
        reasons.append(f"Both want {a.preferred_area.strip()}")

    smoke_conflict = (a.smokes and not b.accepts_smoking) or (b.smokes and not a.accepts_smoking)
    if smoke_conflict:
        cautions.insert(0, "Smoking preference conflict")
        score = min(score, 25)

    return {"score": int(score), "reasons": reasons[:3], "cautions": cautions[:2]}
