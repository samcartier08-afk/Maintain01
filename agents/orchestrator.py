"""
Multi-Agent Copilot Orchestrator.
Coordinates Diagnosis Specialist, Planner Specialist, and Safety Reviewer.
Produces structured Pydantic/dataclass Decision Briefs and handles free-form Q&A
while enforcing strict governance refusal on forbidden commands.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, List, Optional
from agents.tools import ToolRegistry
from agents.specialists import DiagnosisSpecialist, PlannerSpecialist, SafetyReviewer
from governance.permissions import Role, ForbiddenActionException


@dataclass
class ReasoningTraceStep:
    agent: str
    action: str
    rationale: str
    result_summary: str


@dataclass
class DecisionBrief:
    brief_id: str
    asset_id: str
    asset_name: str
    criticality_class: str
    risk_level: str
    overall_health_score: float
    primary_fault_hypothesis: str
    fault_probability: float
    confidence_score: float
    confidence_label: str
    rul_range_operating_days: Dict[str, float]
    concrete_evidence: List[str]
    citations: List[str]
    recommended_action: str
    parts_required: List[str]
    parts_ready: bool
    estimated_downtime_hours: float
    cost_comparison: Dict[str, float]
    top_3_windows: List[Dict[str, Any]]
    interim_advisory: List[str]
    what_would_change_my_mind: List[str]
    safety_reviewer_veto: bool
    safety_reviewer_comments: str
    human_decision_required: bool  # Always True
    reasoning_trace: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "brief_id": self.brief_id,
            "asset_id": self.asset_id,
            "asset_name": self.asset_name,
            "criticality_class": self.criticality_class,
            "risk_level": self.risk_level,
            "overall_health_score": self.overall_health_score,
            "primary_fault_hypothesis": self.primary_fault_hypothesis,
            "fault_probability": self.fault_probability,
            "confidence_score": self.confidence_score,
            "confidence_label": self.confidence_label,
            "rul_range_operating_days": self.rul_range_operating_days,
            "concrete_evidence": self.concrete_evidence,
            "citations": self.citations,
            "recommended_action": self.recommended_action,
            "parts_required": self.parts_required,
            "parts_ready": self.parts_ready,
            "estimated_downtime_hours": self.estimated_downtime_hours,
            "cost_comparison": self.cost_comparison,
            "top_3_windows": self.top_3_windows,
            "interim_advisory": self.interim_advisory,
            "what_would_change_my_mind": self.what_would_change_my_mind,
            "safety_reviewer_veto": self.safety_reviewer_veto,
            "safety_reviewer_comments": self.safety_reviewer_comments,
            "human_decision_required": self.human_decision_required,
            "reasoning_trace": self.reasoning_trace
        }


class CopilotOrchestrator:
    def __init__(self, tool_registry: Optional[ToolRegistry] = None):
        self.registry = tool_registry or ToolRegistry()
        self.diagnostician = DiagnosisSpecialist(self.registry)
        self.planner = PlannerSpecialist(self.registry)
        self.safety_reviewer = SafetyReviewer()

    def generate_decision_brief(self, asset_id: str) -> DecisionBrief:
        """Executes multi-agent workflow to build a structured decision brief."""
        trace: List[Dict[str, Any]] = []

        # 1. Diagnosis
        trace.append({
            "step": 1,
            "agent": "DiagnosisSpecialist",
            "action": "evaluate_telemetry_and_anomalies",
            "rationale": f"Analyze load-normalized residuals and multi-channel telemetry for {asset_id}"
        })
        diag = self.diagnostician.diagnose_asset(asset_id)
        
        prof = self.registry.tool_get_asset_profile(asset_id)
        asset_name = prof.get("description", asset_id)

        # 2. Planning
        trace.append({
            "step": 2,
            "agent": "PlannerSpecialist",
            "action": "evaluate_candidate_windows_and_parts",
            "rationale": "Query ERP inventory, crew rosters, and production changeovers to optimize schedule"
        })
        plan = self.planner.plan_repair(asset_id, estimated_hours=3.5)

        rul_data = diag["rul"]
        rul_dict = {
            "p10": rul_data.get("p10_days", 5.0),
            "p50": rul_data.get("p50_days", 8.0),
            "p90": rul_data.get("p90_days", 14.0)
        }

        # 3. Formulate Draft Action
        primary_fm = diag["primary_hypothesis"]["failure_mode"]
        rec_window = plan["top_window"]
        w_id = rec_window["window_id"] if rec_window else "NEXT_SCHEDULED_PM"
        
        recommended_action = (
            f"Schedule preventative replacement of {primary_fm.replace('_', ' ')} components during "
            f"candidate window {w_id} ({rec_window['start'][:16] if rec_window else 'TBD'}). "
            f"Requires physical human supervisor approval to create official CMMS work order."
        )

        parts_needed = ["BRG-SKF-6314-C3", "SEAL-VR-70A"] if "motor" in prof.get("asset_type", "") else ["IMP-BA-280"]
        parts_stock = self.registry.tool_check_inventory(parts_needed)

        draft_dict: Dict[str, Any] = {
            "asset_id": asset_id,
            "primary_fault_hypothesis": primary_fm,
            "rul_range_operating_days": rul_dict,
            "concrete_evidence": diag["evidence"],
            "recommended_action": recommended_action,
            "human_decision_required": True
        }

        # 4. Safety Reviewer Audit
        trace.append({
            "step": 3,
            "agent": "SafetyReviewer",
            "action": "audit_decision_brief_guardrails",
            "rationale": "Verify uncertainty bounds, ensure no safe-to-operate claims, check supervisor prerogative"
        })
        review = self.safety_reviewer.review_decision_brief(draft_dict)

        trace.append({
            "step": 4,
            "agent": "Orchestrator",
            "action": "finalize_decision_brief",
            "rationale": f"Review passed: {not review['veto']}. Presenting structured brief to supervisor UI."
        })

        what_would_change = [
            "Sudden step increase in vibration velocity > 5.5 mm/s would require immediate manual supervisor emergency intervention.",
            "Arrival of expedited spare parts earlier than expected would enable taking earlier 2-hour changeover window.",
            "Production schedule cancellation of sortation shift would open zero-downtime repair opportunity."
        ]

        brief = DecisionBrief(
            brief_id=f"DB-{asset_id}-{int(datetime.now().timestamp())}",
            asset_id=asset_id,
            asset_name=asset_name,
            criticality_class=prof.get("criticality_class", "A"),
            risk_level=diag["health"]["risk_level"],
            overall_health_score=diag["health"]["health_score"],
            primary_fault_hypothesis=primary_fm,
            fault_probability=diag["primary_hypothesis"]["probability"],
            confidence_score=rul_data.get("confidence_score", 0.85),
            confidence_label=rul_data.get("confidence_label", "HIGH"),
            rul_range_operating_days=rul_dict,
            concrete_evidence=diag["evidence"],
            citations=diag["citations"],
            recommended_action=recommended_action,
            parts_required=parts_needed,
            parts_ready=parts_stock["all_available"],
            estimated_downtime_hours=3.5,
            cost_comparison=plan["financial_impact"],
            top_3_windows=plan["windows_plan"]["top_3_windows"],
            interim_advisory=plan["interim_advisory"],
            what_would_change_my_mind=what_would_change,
            safety_reviewer_veto=review["veto"],
            safety_reviewer_comments=review["comments"],
            human_decision_required=True,
            reasoning_trace=trace
        )
        return brief

    def chat_response(self, query: str, asset_id: Optional[str] = "M-204") -> Dict[str, Any]:
        """
        Handles free-form operator Q&A.
        Refuses forbidden actions ('shut it down', 'override lock') with explicit governance reasoning.
        """
        q_lower = query.lower()
        trace = []

        # Check for forbidden requests
        forbidden_terms = ["shut it down", "turn it off", "emergency shutdown", "override lock", "issue loto", "change setpoint"]
        for term in forbidden_terms:
            if term in q_lower:
                trace.append({
                    "step": 1,
                    "agent": "GovernanceGuard",
                    "action": "intercept_forbidden_command",
                    "rationale": f"User query requested forbidden action: '{term}'"
                })
                # Log attempt in audit chain
                self.registry.audit.append_log(
                    actor_role=Role.AGENT.value,
                    actor_name="MaintainCopilot_GovernanceGuard",
                    action_type="forbidden_action_blocked",
                    payload={"query": query, "blocked_action": term}
                )
                return {
                    "response": (
                        f"I cannot execute an emergency shutdown or control override. "
                        f"Under MaintainCopilot Governance (Principle 3), AI agents are strictly advisory "
                        f"and FORBIDDEN from controlling physical machinery, issuing LOTO, or shutting down equipment. "
                        f"Only a designated human supervisor (role: supervisor) possesses the operational authority "
                        f"to execute shutdowns through certified plant safety controls."
                    ),
                    "blocked": True,
                    "reasoning_trace": trace,
                    "citations": []
                }

        # Handle 'what is at risk this week?'
        if "risk" in q_lower or "fleet" in q_lower or "alerts" in q_lower:
            trace.append({
                "step": 1,
                "agent": "Orchestrator",
                "action": "query_fleet_alerts_and_prognostics",
                "rationale": "Aggregate active degradation alerts across all production assets"
            })
            alerts = self.registry.tool_get_open_alerts()
            m204_rul = self.registry.tool_estimate_rul("M-204")
            
            resp = (
                f"Fleet Risk Summary for this week:\n"
                f"1. **Conveyor Motor M-204** (Criticality A): Bearing wear progressing. "
                f"Estimated RUL {m204_rul['p10_days']}-{m204_rul['p90_days']} operating days (p50={m204_rul['p50_days']}d). "
                f"Recommended window: Wed Oct 7 Planned Maintenance.\n"
                f"2. **Pump P-102** (Criticality A): Cavitation acoustic chattering with suction drop. "
                f"3. **Compressor C-301** (Criticality A): Discharge thermal elevation (101°C).\n\n"
                f"Active open alerts: {len(alerts)}. No unmitigated immediate catastrophe expected within 48h, "
                f"provided planned intervention on M-204 occurs before Day 5."
            )
            return {
                "response": resp,
                "blocked": False,
                "reasoning_trace": trace,
                "citations": ["CMMS:ActiveAlerts", "PrognosticEngine:RUL_Estimator"]
            }

        # Default asset-specific inquiry
        target_asset = asset_id or "M-204"
        brief = self.generate_decision_brief(target_asset)
        top_w = brief.top_3_windows[0] if brief.top_3_windows else None
        
        resp = (
            f"Asset **{brief.asset_id}** ({brief.asset_name}) is currently at **{brief.risk_level}** risk "
            f"(Health Score: {brief.overall_health_score}/100).\n\n"
            f"**Diagnosis**: {brief.primary_fault_hypothesis.replace('_', ' ').title()} "
            f"(Probability: {int(brief.fault_probability*100)}%, Confidence: {brief.confidence_label}).\n"
            f"**RUL Quantiles**: p10={brief.rul_range_operating_days['p10']}d | p50={brief.rul_range_operating_days['p50']}d | p90={brief.rul_range_operating_days['p90']}d.\n\n"
            f"**Recommended Repair Window**: {top_w['window_id'] if top_w else 'Pending'} ({top_w['type'] if top_w else 'N/A'})\n"
            f"Estimated downtime: {brief.estimated_downtime_hours}h. Net savings vs catastrophic failure: ${brief.cost_comparison['cost_savings']:,.0f}.\n\n"
            f"*{brief.safety_reviewer_comments}*"
        )
        return {
            "response": resp,
            "blocked": False,
            "reasoning_trace": brief.reasoning_trace,
            "citations": brief.citations,
            "decision_brief": brief.to_dict()
        }
