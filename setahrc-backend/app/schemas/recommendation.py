from typing import List, Optional
from pydantic import BaseModel


class RecommendationFactorBreakdown(BaseModel):
    capability_fit: float
    available_resources: float
    route_distance_km: float
    distance_score: float
    operational_load: float
    load_penalty: float


class RecommendationResponse(BaseModel):
    hospital_id: str
    hospital_name: str
    location: str
    distance_km: float
    rank: int
    total_score: float
    capability_score: float
    resource_score: float
    distance_score: float
    load_score: float
    factors: RecommendationFactorBreakdown
    explanation: str
    missing_data_flags: List[str]
    beds_available: int
    icu_available: int
    oxygen_available: bool
    status: str
    override_reason: Optional[str] = None


class RecommendationApprovalRequest(BaseModel):
    hospital_id: str
    reason: str
    override: bool = False
