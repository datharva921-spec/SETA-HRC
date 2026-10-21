import re
from typing import Tuple


CRITICAL_PATTERNS = [
    r"chest\s*(pain|pressure|tightness)",
    r"unconscious|unresponsive|collapsed",
    r"not breathing|apnea|gasping|respiratory arrest",
    r"cardiac\s*arrest",
    r"stroke|facial\s*droop|slurred\s*speech|hemiparesis|fast[- ]positive",
    r"severe\s*bleed(ing)?|arterial|hemorrhag",
    r"anaphylax|throat\s*closing|severe\s*allergic",
    r"severe\s*head\s*injury|skull\s*fracture",
]

HIGH_PATTERNS = [
    r"fracture|broken\s*bone|fall\s*from\s*height",
    r"asthma|wheez(ing)?|shortness\s*of\s*breath|dyspnea",
    r"burn|scald",
    r"pediatric|infant|child.*fever",
    r"seizure|convulsion",
    r"diabetic|ketoacidosis|hypoglycem",
]


def assess_triage(symptoms: str, category: str) -> Tuple[str, str]:
    """
    Deterministic clinical triage assessment with transparent rationale.
    Returns: (priority, priority_reason)
    Priority is one of: 'Critical', 'High', 'Moderate', 'Low'
    """
    text = f"{category} {symptoms}".lower()
    
    for pat in CRITICAL_PATTERNS:
        match = re.search(pat, text)
        if match:
            return (
                "Critical",
                f"Red-flag cue identified ('{match.group(0)}'); immediate resuscitation/stabilization required."
            )
            
    for pat in HIGH_PATTERNS:
        match = re.search(pat, text)
        if match:
            return (
                "High",
                f"High-acuity clinical indicator identified ('{match.group(0)}'); prompt medical intervention required."
            )
            
    if category in ["Trauma", "Respiratory", "Cardiac", "Stroke"]:
        return (
            "High",
            f"Category '{category}' warrants elevated priority; awaiting clinical confirmation."
        )
        
    if "mild" in text or "minor" in text or "stable" in text:
        return (
            "Low",
            "Symptoms indicate stable condition without red flags; standard queue assigned."
        )
        
    return (
        "Moderate",
        "Initial symptom review indicates non-critical urgency; controlled monitoring required."
    )
