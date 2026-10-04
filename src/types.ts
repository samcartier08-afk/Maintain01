export type Role = 'supervisor' | 'technician' | 'viewer';

export interface Asset {
  id: string;
  name: string;
  asset_type: string;
  criticality_class: 'A' | 'B' | 'C';
  status: 'HEALTHY' | 'DEGRADED' | 'WARNING' | 'CRITICAL';
  location: string;
  line_id: string;
  install_date: string;
  health_score?: number;
  anomaly_score?: number;
  risk_level?: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
}

export interface TelemetryReading {
  value: number;
  load: number;
  timestamp: string;
}

export interface AssetHealthResponse {
  asset_id: string;
  asset_type: string;
  health_score: number;
  risk_level: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';
  anomaly_score: number;
  is_anomaly: boolean;
  top_signal_contributions: Record<string, number>;
  data_quality_flags: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AlertItem {
  id: string;
  asset_id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  metric_values: string;
}

export interface ScoredWindow {
  rank: number;
  window_id: string;
  start: string;
  end: string;
  duration_hours: number;
  type: string;
  cost_rate: number;
  score: number;
  risk: string;
  parts_ready: string;
  crew_ready: string;
  rank_reason: string;
  trade_offs: string;
}

export interface DecisionBrief {
  brief_id: string;
  asset_id: string;
  asset_name: string;
  criticality_class: string;
  risk_level: string;
  overall_health_score: number;
  primary_fault_hypothesis: string;
  fault_probability: number;
  confidence_score: number;
  confidence_label: string;
  rul_range_operating_days: {
    p10: number;
    p50: number;
    p90: number;
  };
  concrete_evidence: string[];
  citations: string[];
  recommended_action: string;
  parts_required: string[];
  parts_ready: boolean;
  estimated_downtime_hours: number;
  cost_comparison: {
    planned_repair_cost: number;
    catastrophic_failure_cost: number;
    cost_savings: number;
    planned_downtime_hours: number;
    catastrophic_downtime_hours: number;
    downtime_rate: number;
  };
  top_3_windows: ScoredWindow[];
  interim_advisory: string[];
  what_would_change_my_mind: string[];
  safety_reviewer_veto: boolean;
  safety_reviewer_comments: string;
  human_decision_required: boolean;
  reasoning_trace: Array<{
    step: number;
    agent: string;
    action: string;
    rationale: string;
  }>;
}

export interface WorkOrder {
  id: string;
  asset_id: string;
  status: 'DETECTED' | 'INVESTIGATING' | 'RECOMMENDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'EDITED' | 'POSTPONED' | 'REJECTED' | 'WORK_ORDER_CREATED' | 'CLOSED';
  title: string;
  description: string;
  priority: string;
  failure_mode: string;
  recommended_window_id?: string;
  estimated_downtime_hours: number;
  estimated_cost: number;
  parts_required: string[];
  required_skills: string[];
  safety_permits: string[];
  supervisor_approved_by?: string;
  created_at: string;
  closed_at?: string;
}

export interface AuditBlock {
  id: string;
  sequence_num: number;
  prev_hash: string;
  current_hash: string;
  timestamp: string;
  actor_role: string;
  actor_name: string;
  action_type: string;
  payload: any;
  model_version?: string;
}

export interface EvaluationMetrics {
  evaluated_at: string;
  summary: {
    total_assets_evaluated: number;
    faults_detected_before_failure: number;
    mean_detection_lead_time_days: number;
    overall_false_alarm_rate_pct: number;
    mean_rul_error_days: number;
    artifacts_escalated_to_critical: number;
  };
  per_asset: Record<string, any>;
}
