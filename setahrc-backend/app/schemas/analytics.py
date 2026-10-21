from typing import List, Dict, Any
from pydantic import BaseModel
from app.schemas.hospital import HospitalResponse


class DashboardMetrics(BaseModel):
    active_cases: int
    critical_cases: int
    units_available: int
    receiving_hospitals: int
    total_cases: int
    resolved_today: int


class VolumeByDay(BaseModel):
    d: str
    cases: int
    urgent: int


class CategoryDistribution(BaseModel):
    category: str
    count: int
    percentage: float


class AnalyticsSummaryResponse(BaseModel):
    metrics: DashboardMetrics
    volume_by_day: List[VolumeByDay]
    category_breakdown: List[CategoryDistribution]
    resource_snapshot: List[HospitalResponse]


class EvaluationMetrics(BaseModel):
    seta_recommendation_avg_distance_km: float
    nearest_only_avg_distance_km: float
    capacity_avoidance_rate: float
    priority_queue_critical_wait_min: float
    fifo_critical_wait_min: float
    avg_scoring_latency_ms: float
    consistency_rate: float
    summary: str


class TextClassificationRequest(BaseModel):
    text: str


class TextClassificationResponse(BaseModel):
    predicted_category: str
    confidence: float
    suggested_priority: str
    uncertainty: float
    disclaimer: str
    limitations: str
