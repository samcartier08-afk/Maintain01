"""
Specialist Agents: Diagnosis Specialist, Planner Specialist, and Independent Safety Reviewer.
The Safety Reviewer exercises binding VETO power over any AI draft that violates governance constraints.
"""
from typing import Dict, Any, List
from agents.tools import ToolRegistry


class DiagnosisSpecialist:
    def __init__(self, registry: ToolRegistry):
        self.registry = registry

    def diagnose_asset(self, asset_id: str) -> Dict[str, Any]:
        """Runs diagnostics, anomaly detectors, hypothesis ranker, and evidence builder."""
        health = self.registry.execute_tool("get_health", {"asset_id": asset_id})
        hypotheses = self.registry.execute_tool("rank_fault_hypotheses", {"asset_id": asset_id})
        evidence = self.registry.execute_tool("get_evidence", {"asset_id": asset_id})
        rul = self.registry.execute_tool("estimate_rul", {"asset_id": asset_id})
        
        top_hypo = hypotheses[0] if hypotheses else {
            "failure_mode": "unspecified_wear",
            "probability": 0.50,
            "severity": "MEDIUM",
            "evidence": []
        }

        # Retrieve citations from technical manuals
        citations = []
        search_res = self.registry.execute_tool("search_knowledge", {
            "query": f"{top_hypo['failure_mode']} inspection replacement protocol",
            "asset_type": health.get("asset_type")
        })
        for s in search_res:
            citations.append(s["citation"])

        return {
            "asset_id": asset_id,
            "health": health,
            "primary_hypothesis": top_hypo,
            "all_hypotheses": hypotheses,
            "rul": rul,
            "evidence": evidence,
            "citations": citations
        }


class PlannerSpecialist:
    def __init__(self, registry: ToolRegistry):
        self.registry = registry

    def plan_repair(self, asset_id: str, estimated_hours: float = 3.5) -> Dict[str, Any]:
        """Evaluates candidate windows, parts readiness, and financial impact."""
        windows_plan = self.registry.execute_tool("get_repair_windows", {
            "asset_id": asset_id,
            "duration_hours": estimated_hours
        })
        impact = self.registry.execute_tool("get_impact", {
            "asset_id": asset_id,
            "duration_hours": estimated_hours
        })

        return {
            "asset_id": asset_id,
            "windows_plan": windows_plan,
            "financial_impact": impact,
            "top_window": windows_plan.get("recommended_window"),
            "interim_advisory": windows_plan.get("interim_actions", [])
        }


class SafetyReviewer:
    """
    Independent Safety Reviewer Agent.
    Strictly audits all drafted decisions for safety compliance, uncertainty ranges,
    and governance guardrails. Has binding VETO power.
    """
    def review_decision_brief(self, brief: Dict[str, Any]) -> Dict[str, Any]:
        veto_reasons: List[str] = []
        
        # Rule 1: Never claim 'safe to operate'
        raw_text = str(brief).lower()
        if "safe to operate" in raw_text or "guaranteed safe" in raw_text:
            veto_reasons.append("VETO: Draft violates rule against claiming absolute operational safety.")

        # Rule 2: Single-date predictions forbidden (Must show uncertainty ranges)
        rul_dict = brief.get("rul_range_operating_days", {})
        if not (rul_dict.get("p10") is not None and rul_dict.get("p90") is not None):
            veto_reasons.append("VETO: Prognostics must express uncertainty as a p10-p90 range, not a single point.")

        # Rule 3: Must require human supervisor decision
        if not brief.get("human_decision_required", True):
            veto_reasons.append("VETO: AI Copilot cannot bypass human supervisor decision authority.")

        # Rule 4: Must cite concrete evidence
        if not brief.get("concrete_evidence"):
            veto_reasons.append("VETO: Decision brief lacks concrete numerical evidence comparison.")

        # Rule 5: Forbidden action check
        for forbidden in ["shutdown", "emergency_stop", "override", "loto_issue"]:
            if forbidden in brief.get("recommended_action", "").lower():
                veto_reasons.append(f"VETO: Recommended action contains unauthorized physical/control action '{forbidden}'.")

        has_veto = len(veto_reasons) > 0
        comments = (
            f"SAFETY VETO TRIGGERED: {'; '.join(veto_reasons)}"
            if has_veto else
            "SAFETY REVIEW PASSED: Governance constraints satisfied. Uncertainty properly bounded; human supervisor authority maintained."
        )

        return {
            "veto": has_veto,
            "reasons": veto_reasons,
            "comments": comments
        }
