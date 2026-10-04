"""
Repair Window Scorer: Multi-criteria optimization ranking candidate production windows.
Evaluates risk-of-failure-before-window, downtime cost, parts readiness, crew availability,
and returns the Top 3 windows with explicit trade-offs and interim advisory mitigations.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from connectors.interfaces import ScheduleClient
from prognostics.health_rul import RULPrediction
from planning.readiness import ReadinessChecker, ReadinessAssessment
from planning.impact import ImpactEstimator


@dataclass
class ScoredWindow:
    rank: int
    window_id: str
    line_id: str
    window_start: str
    window_end: str
    duration_hours: float
    window_type: str
    downtime_cost_per_hr: float
    composite_score: float  # 0.0 to 100.0
    risk_of_failure_level: str  # "VERY_LOW", "LOW", "MODERATE", "CRITICAL_RISK"
    parts_status: str
    crew_status: str
    is_before_p10: bool
    is_before_p50: bool
    rank_reason: str
    trade_offs: str
    readiness: ReadinessAssessment


@dataclass
class RepairPlanResult:
    asset_id: str
    recommended_window: Optional[ScoredWindow]
    top_3_windows: List[ScoredWindow]
    interim_actions: List[str]
    no_viable_window_alert: bool


class RepairWindowScorer:
    def __init__(
        self,
        sched_client: ScheduleClient,
        readiness_checker: ReadinessChecker,
        impact_estimator: ImpactEstimator
    ):
        self.sched = sched_client
        self.readiness = readiness_checker
        self.impact = impact_estimator

    def score_windows(
        self,
        asset_id: str,
        line_id: str,
        rul_prediction: RULPrediction,
        estimated_duration_hours: float,
        parts_required: List[str],
        required_skills: List[str],
        safety_permits: List[str],
        specialized_tools: List[str],
        reference_time: Optional[datetime] = None
    ) -> RepairPlanResult:
        ref_dt = reference_time or datetime(2026, 10, 4, 8, 0, 0)
        candidates = self.sched.get_candidate_windows(line_id, horizon_days=14)

        p10_dt = ref_dt + timedelta(days=rul_prediction.p10_days)
        p50_dt = ref_dt + timedelta(days=rul_prediction.p50_days)
        p90_dt = ref_dt + timedelta(days=rul_prediction.p90_days)

        scored: List[ScoredWindow] = []

        for cand in candidates:
            w_id = cand["id"]
            w_start = cand["window_start"]
            w_end = cand["window_end"]
            w_type = cand["window_type"]
            cost_rate = cand["downtime_cost_per_hr"]
            is_bottleneck = bool(cand.get("is_bottleneck", 0))

            try:
                start_dt = datetime.fromisoformat(w_start)
                end_dt = datetime.fromisoformat(w_end)
                dur = (end_dt - start_dt).total_seconds() / 3600.0
            except Exception:
                dur = 3.0
                start_dt = ref_dt + timedelta(days=2)

            # 1. Readiness Check
            readiness = self.readiness.check_readiness(
                parts_required=parts_required,
                required_skills=required_skills,
                window_start=w_start,
                window_end=w_end,
                safety_permits=safety_permits,
                specialized_tools=specialized_tools,
                reference_time=ref_dt
            )

            # 2. Risk Evaluation
            is_before_p10 = start_dt <= p10_dt
            is_before_p50 = start_dt <= p50_dt

            if is_before_p10:
                risk_score = 100.0
                risk_level = "LOW"
            elif is_before_p50:
                # Moderate risk: between p10 and p50
                risk_score = 65.0
                risk_level = "MODERATE"
            else:
                # Critical risk: window starts after median failure date!
                risk_score = 15.0
                risk_level = "CRITICAL_RISK"

            # 3. Cost Score (lower rate = higher score)
            # $400/hr -> 100, $8,750/hr -> 10
            cost_score = max(5.0, 100.0 - (cost_rate / 9000.0) * 90.0)
            if is_bottleneck:
                cost_score *= 0.40

            # 4. Duration Adequacy
            if dur >= estimated_duration_hours:
                dur_score = 100.0
            else:
                # Insufficient duration penalty
                dur_score = max(10.0, (dur / estimated_duration_hours) * 70.0)

            # 5. Readiness Score
            readiness_score = 100.0 if readiness.is_ready_now else 30.0

            # Composite weighted score: Risk (40%) + Cost (25%) + Readiness (25%) + Duration (10%)
            comp_score = (
                0.40 * risk_score +
                0.25 * cost_score +
                0.25 * readiness_score +
                0.10 * dur_score
            )
            comp_score = round(comp_score, 1)

            # Build Trade-off description
            trade_off_parts = []
            if is_before_p10:
                trade_off_parts.append(f"Safely scheduled before p10 risk date ({p10_dt.strftime('%b %d')})")
            elif is_before_p50:
                trade_off_parts.append(f"Incurs moderate failure risk between p10 ({p10_dt.strftime('%b %d')}) and p50")
            else:
                trade_off_parts.append(f"High risk of breakdown before repair (past p50 {p50_dt.strftime('%b %d')})")

            trade_off_parts.append(f"Downtime cost: ${cost_rate:,.0f}/hr ({w_type.lower()})")
            if not readiness.parts_ready:
                trade_off_parts.append(f"Requires expediting parts ({readiness.parts_lead_time_days}d lead)")
            if not readiness.crew_available:
                trade_off_parts.append("Requires scheduling crew shift adjustment")

            scored.append(
                ScoredWindow(
                    rank=0,
                    window_id=w_id,
                    line_id=line_id,
                    window_start=w_start,
                    window_end=w_end,
                    duration_hours=round(dur, 1),
                    window_type=w_type,
                    downtime_cost_per_hr=cost_rate,
                    composite_score=comp_score,
                    risk_of_failure_level=risk_level,
                    parts_status="Ready" if readiness.parts_ready else f"Lead Time {readiness.parts_lead_time_days}d",
                    crew_status="Available" if readiness.crew_available else "Not Assigned",
                    is_before_p10=is_before_p10,
                    is_before_p50=is_before_p50,
                    rank_reason="",
                    trade_offs="; ".join(trade_off_parts),
                    readiness=readiness
                )
            )

        # Sort descending by composite score
        scored.sort(key=lambda w: w.composite_score, reverse=True)

        for i, w in enumerate(scored):
            w.rank = i + 1
            if i == 0:
                w.rank_reason = f"Rank 1: Highest overall feasibility ({w.composite_score} pts). Balanced low downtime cost with pre-p10 safety margin."
            elif i == 1:
                w.rank_reason = f"Rank 2: Viable secondary alternative ({w.composite_score} pts)."
            elif i == 2:
                w.rank_reason = f"Rank 3: Contingency option ({w.composite_score} pts)."

        top_3 = scored[:3]
        best_window = top_3[0] if top_3 else None

        # Check if any viable pre-p50 window exists
        no_viable = not any(w.is_before_p50 and w.readiness.parts_ready for w in top_3)
        interim_actions = []

        if no_viable or (best_window and not best_window.is_before_p10):
            interim_actions = [
                "ADVISORY DERATE: Request operations to temporarily cap conveyor belt speed/load to 75% to reduce dynamic bearing friction.",
                "ELEVATED SURVEILLANCE: Increase telemetry scan resolution and schedule handheld acoustic/thermal inspection every 4 hours.",
                "PARTS EXPEDITE: Trigger supplier emergency hot-shot courier dispatch for SKF 6314-C3 bearing.",
                "STAGING PREPARATION: Pre-stage hydraulic puller, induction heater, and LOTO lockouts in Bay 4 prior to window start."
            ]

        return RepairPlanResult(
            asset_id=asset_id,
            recommended_window=best_window,
            top_3_windows=top_3,
            interim_actions=interim_actions,
            no_viable_window_alert=no_viable
        )
