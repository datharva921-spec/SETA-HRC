import { apiClient } from "../lib/api-client";
import type { AuditEvent, Hospital } from "../lib/types";

export interface DashboardMetrics {
  active_cases: number;
  critical_cases: number;
  units_available: number;
  receiving_hospitals: number;
  total_cases: number;
  resolved_today: number;
}

export interface VolumeByDay {
  d: string;
  cases: number;
  urgent: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface AnalyticsSummary {
  metrics: DashboardMetrics;
  volume_by_day: VolumeByDay[];
  category_breakdown: CategoryBreakdown[];
  resource_snapshot: Hospital[];
}

export interface EvaluationMetrics {
  seta_recommendation_avg_distance_km: number;
  nearest_only_avg_distance_km: number;
  capacity_avoidance_rate: number;
  priority_queue_critical_wait_min: number;
  fifo_critical_wait_min: number;
  avg_scoring_latency_ms: number;
  consistency_rate: number;
  summary: string;
}

export interface TextClassificationResult {
  predicted_category: string;
  confidence: number;
  suggested_priority: string;
  uncertainty: number;
  disclaimer: string;
  limitations: string;
}

export const analyticsService = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const res = await apiClient.get<DashboardMetrics>("/dashboard/metrics");
    return res.data;
  },

  getSummary: async (): Promise<AnalyticsSummary> => {
    const res = await apiClient.get<AnalyticsSummary>("/analytics/summary");
    return res.data;
  },

  getEvaluation: async (): Promise<EvaluationMetrics> => {
    const res = await apiClient.get<EvaluationMetrics>("/analytics/evaluate");
    return res.data;
  },

  classifyText: async (text: string): Promise<TextClassificationResult> => {
    const res = await apiClient.post<TextClassificationResult>("/analytics/classify-text", { text });
    return res.data;
  },

  getAuditLogs: async (params?: { limit?: number; action?: string; actor?: string }): Promise<AuditEvent[]> => {
    const res = await apiClient.get<AuditEvent[]>("/audit", { params });
    return res.data;
  }
};
