import math
from typing import List, Dict, Any, Tuple
from app.models.hospital import Hospital
from app.models.emergency import Emergency


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two points on Earth in kilometers.
    """
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


CATEGORY_SPECIALTIES = {
    "Cardiac": ["Cardiac", "Cardiology", "ICU"],
    "Stroke": ["Stroke", "Neurology", "ICU"],
    "Trauma": ["Trauma", "Orthopedics", "Surgery", "ICU"],
    "Respiratory": ["Respiratory", "Pulmonology", "ICU"],
    "Injury": ["Injury", "Surgery", "Orthopedics", "General"],
    "Medical": ["Medical", "Internal Medicine", "General"],
}


def score_hospital(
    hospital: Hospital,
    emergency: Emergency
) -> Dict[str, Any]:
    """
    Computes deterministic multi-factor recommendation score for a hospital given an emergency.
    Returns:
      - total_score
      - capability_score
      - resource_score
      - distance_score
      - load_score
      - distance_km
      - factors breakdown
      - explanation
      - missing_data_flags
    """
    missing_flags = []

    # 1. Distance Calculation
    if emergency.lat and emergency.lng and hospital.lat and hospital.lng:
        dist_km = haversine_distance(emergency.lat, emergency.lng, hospital.lat, hospital.lng)
    else:
        dist_km = hospital.distance_km or 5.0
        missing_flags.append("Approximate route distance used (coordinates unverified)")

    distance_score = max(0.0, round(100.0 - (dist_km * 6.5), 2))

    # 2. Capability Fit Score (0 to 100)
    needed_specialties = CATEGORY_SPECIALTIES.get(emergency.category, ["General"])
    hospital_caps = hospital.capabilities or []
    if isinstance(hospital_caps, str):
        import json
        try:
            hospital_caps = json.loads(hospital_caps)
        except Exception:
            hospital_caps = [hospital_caps]

    hospital_caps_lower = [str(c).lower() for c in hospital_caps]
    matches = [s for s in needed_specialties if s.lower() in hospital_caps_lower or "general" in hospital_caps_lower]

    if matches:
        cap_ratio = len(matches) / len(needed_specialties)
        capability_score = round(min(100.0, 50.0 + (cap_ratio * 50.0)), 2)
    else:
        capability_score = 25.0
        missing_flags.append(f"Primary specialty for {emergency.category} not listed in facility capabilities")

    # Check department availability
    dept_avail = hospital.department_availability or []
    if isinstance(dept_avail, str):
        import json
        try:
            dept_avail = json.loads(dept_avail)
        except Exception:
            dept_avail = []

    for d in dept_avail:
        if isinstance(d, dict) and d.get("available") is False:
            if d.get("department", "").lower() in [s.lower() for s in needed_specialties]:
                capability_score = max(10.0, capability_score - 30.0)
                missing_flags.append(f"Department '{d.get('department')}' currently marked unavailable")

    # 3. Resource Availability Score (0 to 100)
    # Check bed capacity
    bed_pts = min(40.0, (hospital.beds_available or 0) * 4.0)
    
    # Check ICU capacity
    if emergency.priority in ["Critical", "High"] or emergency.category in ["Cardiac", "Stroke", "Trauma"]:
        icu_pts = min(40.0, (hospital.icu_available or 0) * 15.0)
        if (hospital.icu_available or 0) <= 0:
            missing_flags.append("Critical case but 0 ICU beds currently available")
    else:
        icu_pts = 30.0 if (hospital.icu_available or 0) > 0 else 15.0

    # Oxygen availability
    oxygen_pts = 20.0 if hospital.oxygen_available else 0.0
    if not hospital.oxygen_available:
        missing_flags.append("Oxygen supply reported limited/unavailable")

    resource_score = round(bed_pts + icu_pts + oxygen_pts, 2)

    # 4. Operational Load Score (0 to 100)
    load = float(hospital.operational_load if hospital.operational_load is not None else 0.5)
    load_score = round(max(0.0, 100.0 * (1.0 - load)), 2)

    # Status penalty
    status_multiplier = 1.0
    if hospital.status == "Busy":
        status_multiplier = 0.8
        missing_flags.append("Facility operational status is currently 'Busy'")
    elif hospital.status == "Offline":
        status_multiplier = 0.1
        missing_flags.append("Facility operational status is 'Offline'")

    # 5. Total Weighted Score
    # Weights: Capability (35%), Resources (30%), Proximity (20%), Load (15%)
    weighted = (
        (0.35 * capability_score) +
        (0.30 * resource_score) +
        (0.20 * distance_score) +
        (0.15 * load_score)
    ) * status_multiplier

    total_score = round(max(0.0, min(100.0, weighted)), 2)

    # Human-readable explanation
    explanation = (
        f"Match Score: {total_score}/100. "
        f"Capability fit for {emergency.category} is {capability_score}/100; "
        f"available resources score {resource_score}/100 ({hospital.beds_available} beds, {hospital.icu_available} ICU); "
        f"route distance is {dist_km} km (score {distance_score}/100); "
        f"facility operational load is {int(load * 100)}% (score {load_score}/100)."
    )

    return {
        "hospital_id": hospital.id,
        "hospital_name": hospital.name,
        "location": hospital.location,
        "distance_km": dist_km,
        "total_score": total_score,
        "capability_score": capability_score,
        "resource_score": resource_score,
        "distance_score": distance_score,
        "load_score": load_score,
        "factors": {
            "capability_fit": capability_score,
            "available_resources": resource_score,
            "route_distance_km": dist_km,
            "distance_score": distance_score,
            "operational_load": load,
            "load_penalty": round(100.0 - load_score, 2),
        },
        "explanation": explanation,
        "missing_data_flags": missing_flags,
        "beds_available": hospital.beds_available or 0,
        "icu_available": hospital.icu_available or 0,
        "oxygen_available": hospital.oxygen_available,
        "status": hospital.status
    }


def rank_hospitals(
    hospitals: List[Hospital],
    emergency: Emergency
) -> List[Dict[str, Any]]:
    scored = [score_hospital(h, emergency) for h in hospitals]
    # Sort descending by total_score, then ascending by distance_km
    scored.sort(key=lambda s: (-s["total_score"], s["distance_km"]))
    for i, s in enumerate(scored, 1):
        s["rank"] = i
    return scored
