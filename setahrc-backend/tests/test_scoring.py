from app.core.scoring import haversine_distance, score_hospital
from app.models.hospital import Hospital
from app.models.emergency import Emergency


def test_haversine_distance():
    # MG Road (12.9716, 77.5946) to Indiranagar (12.9784, 77.6408) is ~5.07 km
    d = haversine_distance(12.9716, 77.5946, 12.9784, 77.6408)
    assert 4.8 <= d <= 5.3


def test_deterministic_scoring_reproducibility():
    h = Hospital(
        id="H-TEST", name="Test Hospital", location="Indiranagar",
        lat=12.9784, lng=77.6408, distance_km=5.0,
        capabilities=["Cardiac", "ICU"],
        beds_available=15, icu_available=4, oxygen_available=True,
        status="Available", operational_load=0.4
    )
    e = Emergency(
        id="SE-TEST", patient_name="Test", age=50, caller_name="C", phone="123",
        location="MG Road", lat=12.9716, lng=77.5946,
        category="Cardiac", symptoms="Chest pain", priority="Critical"
    )

    s1 = score_hospital(h, e)
    s2 = score_hospital(h, e)

    # Determinism check: Identical inputs must yield identical scores and factor breakdowns
    assert s1["total_score"] == s2["total_score"]
    assert s1["capability_score"] == s2["capability_score"]
    assert s1["resource_score"] == s2["resource_score"]
    assert s1["distance_score"] == s2["distance_score"]
    assert s1["load_score"] == s2["load_score"]
    assert s1["explanation"] == s2["explanation"]
    assert s1["total_score"] > 70.0  # Strong match due to Cardiology + ICU + good load
