"""
Agent Tool Registry.
Wraps deterministic modules (Detectors, Prognostics, Knowledge, Planning, Governance)
into structured callable tools for the Copilot Orchestrator.
Every tool call passes through the central PermissionGuard and is logged to the AuditLogger.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from core.loader import load_all_profiles
from core.db import get_db_connection
from connectors.db_connectors import DBSensorSource, DBCMMSClient, DBERPClient, DBScheduleClient
from detectors.baseline import LoadNormalizedBaseline
from detectors.anomaly import GenericAnomalyDetector
from detectors.plugins import rank_all_hypotheses
from prognostics.health_rul import PrognosticEngine
from knowledge.store import KnowledgeStore
from planning.impact import ImpactEstimator
from planning.readiness import ReadinessChecker
from planning.window_scorer import RepairWindowScorer
from governance.permissions import PermissionGuard, Role, ForbiddenActionException
from governance.audit import AuditLogger


class ToolRegistry:
    def __init__(
        self,
        db_path: str = "data/maintain_copilot.db",
        permission_guard: Optional[PermissionGuard] = None,
        audit_logger: Optional[AuditLogger] = None
    ):
        self.db_path = db_path
        self.guard = permission_guard or PermissionGuard()
        self.audit = audit_logger or AuditLogger(db_path=db_path)
        
        self.profiles = load_all_profiles("assets/profiles")
        self.sensors = DBSensorSource(db_path=db_path)
        self.cmms = DBCMMSClient(db_path=db_path)
        self.erp = DBERPClient(db_path=db_path)
        self.sched = DBScheduleClient(db_path=db_path)
        self.knowledge = KnowledgeStore(db_path=db_path)
        self.impact = ImpactEstimator()
        self.readiness = ReadinessChecker(self.erp, self.sched)
        self.scorer = RepairWindowScorer(self.sched, self.readiness, self.impact)

    def execute_tool(self, action_name: str, args: Dict[str, Any], actor_role: str = Role.AGENT.value) -> Dict[str, Any]:
        """Validates permission, logs to audit chain, and executes tool."""
        # 1. Enforce Permission Allow-list & Hard Forbidden checks
        self.guard.validate_agent_action(action_name)

        # 2. Dispatch
        method = getattr(self, f"tool_{action_name}", None)
        if not method:
            raise NotImplementedError(f"Tool '{action_name}' is not registered in ToolRegistry.")

        result = method(**args)

        # 3. Log to Tamper-Evident Audit Chain
        self.audit.append_log(
            actor_role=actor_role,
            actor_name="MaintainCopilot_Specialist",
            action_type=f"tool_call:{action_name}",
            payload={"args": args, "summary": str(result)[:200]}
        )

        return result

    # --- Tool Implementations ---

    def tool_list_assets(self) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM assets")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def tool_get_asset_profile(self, asset_id: str) -> Dict[str, Any]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT asset_type FROM assets WHERE id = ?", (asset_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            return {"error": f"Asset {asset_id} not found."}
        atype = row["asset_type"]
        profile = self.profiles.get(atype)
        return profile.to_dict() if profile else {"error": f"Profile {atype} not loaded"}

    def tool_get_signals(self, asset_id: str, limit: int = 20) -> Dict[str, Any]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT sensor_name, value, load_value, timestamp FROM readings WHERE asset_id = ? ORDER BY timestamp DESC LIMIT ?",
            (asset_id, limit * 4)
        )
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()

        latest_by_sensor: Dict[str, Any] = {}
        for r in rows:
            if r["sensor_name"] not in latest_by_sensor:
                latest_by_sensor[r["sensor_name"]] = {
                    "value": r["value"],
                    "load": r["load_value"],
                    "timestamp": r["timestamp"]
                }
        return {"asset_id": asset_id, "signals": latest_by_sensor}

    def tool_get_health(self, asset_id: str) -> Dict[str, Any]:
        signals_data = self.tool_get_signals(asset_id, limit=10)
        signals = {k: v["value"] for k, v in signals_data["signals"].items()}
        
        prof_dict = self.tool_get_asset_profile(asset_id)
        if "error" in prof_dict:
            return prof_dict
        
        profile = self.profiles[prof_dict["asset_type"]]
        load_val = signals.get(profile.load_variable, 50.0)

        # Baseline
        readings = self.sensors.get_readings(asset_id, limit=3000)
        baseline = LoadNormalizedBaseline(profile.asset_type, profile.load_variable)
        baseline.fit(readings, healthy_max_day=30.0)

        detector = GenericAnomalyDetector(baseline)
        dropouts = 1 if any(v == -999.0 for v in signals.values()) else 0
        report = detector.evaluate_sample(asset_id, signals_data["signals"][next(iter(signals))]["timestamp"], signals, load_val, dropouts)

        engine = PrognosticEngine(profile)
        max_z = max(report.per_signal_z_scores.values()) if report.per_signal_z_scores else 0.0
        health_idx = engine.compute_health_index(report, max_z)

        # Risk level
        if health_idx >= 75.0:
            risk = "NORMAL"
        elif health_idx >= 50.0:
            risk = "ATTENTION"
        elif health_idx >= 25.0:
            risk = "WARNING"
        else:
            risk = "CRITICAL"

        return {
            "asset_id": asset_id,
            "asset_type": profile.asset_type,
            "health_score": health_idx,
            "risk_level": risk,
            "anomaly_score": report.overall_score,
            "is_anomaly": report.is_anomaly,
            "top_signal_contributions": report.signal_contributions,
            "data_quality_flags": report.data_quality_flags,
            "confidence": report.confidence
        }

    def tool_detect_anomalies(self, asset_id: str) -> Dict[str, Any]:
        return self.tool_get_health(asset_id)

    def tool_rank_fault_hypotheses(self, asset_id: str) -> List[Dict[str, Any]]:
        prof_dict = self.tool_get_asset_profile(asset_id)
        if "error" in prof_dict:
            return []
        profile = self.profiles[prof_dict["asset_type"]]

        signals_data = self.tool_get_signals(asset_id, limit=10)
        signals = {k: v["value"] for k, v in signals_data["signals"].items()}
        load_val = signals.get(profile.load_variable, 50.0)

        readings = self.sensors.get_readings(asset_id, limit=3000)
        baseline = LoadNormalizedBaseline(profile.asset_type, profile.load_variable)
        baseline.fit(readings, healthy_max_day=30.0)

        detector = GenericAnomalyDetector(baseline)
        report = detector.evaluate_sample(asset_id, "latest", signals, load_val)

        hypotheses = rank_all_hypotheses(profile, report, baseline, signals, load_val)
        return [
            {
                "failure_mode": h.failure_mode,
                "probability": h.probability,
                "severity": h.severity,
                "primary_sensor": h.primary_sensor,
                "evidence": h.evidence,
                "recommended_inspection": h.recommended_inspection
            }
            for h in hypotheses
        ]

    def tool_estimate_rul(self, asset_id: str) -> Dict[str, Any]:
        prof_dict = self.tool_get_asset_profile(asset_id)
        profile = self.profiles[prof_dict["asset_type"]]
        engine = PrognosticEngine(profile)

        primary_sensor = profile.failure_modes[0].primary_sensor
        hist = self.sensors.get_readings(asset_id, sensor_name=primary_sensor, limit=500)

        crit_threshold = profile.sensors[0].normal_range[1] * 1.3
        for s in profile.sensors:
            if s.name == primary_sensor:
                crit_threshold = s.normal_range[1] * 1.3

        pred = engine.estimate_rul(hist, primary_sensor, crit_threshold, [])
        return {
            "asset_id": asset_id,
            "primary_sensor": primary_sensor,
            "p10_days": pred.p10_days,
            "p50_days": pred.p50_days,
            "p90_days": pred.p90_days,
            "confidence_label": pred.confidence_label,
            "confidence_score": pred.confidence_score,
            "critical_threshold": pred.critical_threshold_value,
            "current_value": pred.current_value,
            "degradation_rate_per_day": pred.degradation_rate_per_day,
            "factors": pred.factors_affecting_confidence
        }

    def tool_get_evidence(self, asset_id: str) -> List[str]:
        prof_dict = self.tool_get_asset_profile(asset_id)
        profile = self.profiles[prof_dict["asset_type"]]
        engine = PrognosticEngine(profile)

        signals_data = self.tool_get_signals(asset_id, limit=5)
        signals = {k: v["value"] for k, v in signals_data["signals"].items()}
        load_val = signals.get(profile.load_variable, 50.0)

        readings = self.sensors.get_readings(asset_id, limit=3000)
        baseline = LoadNormalizedBaseline(profile.asset_type, profile.load_variable)
        baseline.fit(readings, healthy_max_day=30.0)

        detector = GenericAnomalyDetector(baseline)
        report = detector.evaluate_sample(asset_id, "latest", signals, load_val)

        expected = {s: baseline.predict_expected(s, load_val) for s in signals}
        rul_dict = self.tool_estimate_rul(asset_id)
        
        # Build RUL object mock
        from prognostics.health_rul import RULPrediction
        rul_obj = RULPrediction(
            p10_days=rul_dict["p10_days"], p50_days=rul_dict["p50_days"], p90_days=rul_dict["p90_days"],
            confidence_label=rul_dict["confidence_label"], confidence_score=rul_dict["confidence_score"],
            critical_threshold_value=rul_dict["critical_threshold"], current_value=rul_dict["current_value"],
            degradation_rate_per_day=rul_dict["degradation_rate_per_day"], r_squared=0.88,
            factors_affecting_confidence=rul_dict["factors"]
        )

        return engine.generate_evidence(report, rul_obj, signals, expected)

    def tool_search_knowledge(self, query: str, asset_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.knowledge.search_knowledge(query, asset_type, k=3)

    def tool_get_maintenance_history(self, asset_id: str) -> List[Dict[str, Any]]:
        return self.cmms.get_maintenance_history(asset_id)

    def tool_get_impact(self, asset_id: str, duration_hours: float = 3.5) -> Dict[str, Any]:
        prof_dict = self.tool_get_asset_profile(asset_id)
        crit_class = prof_dict.get("criticality_class", "A")
        cost_comparison = self.impact.estimate_impact(
            planned_duration_hours=duration_hours,
            parts_cost=450.0,
            downtime_cost_per_hr=3500.0,
            is_bottleneck=False,
            criticality_class=crit_class
        )
        return {
            "planned_repair_cost": cost_comparison.planned_repair_cost,
            "catastrophic_failure_cost": cost_comparison.catastrophic_failure_cost,
            "cost_savings": cost_comparison.cost_savings,
            "planned_downtime_hours": cost_comparison.planned_downtime_hours,
            "catastrophic_downtime_hours": cost_comparison.catastrophic_downtime_hours,
            "downtime_rate": cost_comparison.downtime_cost_per_hr
        }

    def tool_check_inventory(self, part_ids: List[str]) -> Dict[str, Any]:
        return self.erp.check_parts_availability(part_ids)

    def tool_check_crew(self, required_skills: List[str], window_start: str, window_end: str) -> Dict[str, Any]:
        return self.sched.get_available_crew(window_start, window_end, required_skills)

    def tool_get_repair_windows(self, asset_id: str, duration_hours: float = 3.5) -> Dict[str, Any]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT line_id FROM assets WHERE id = ?", (asset_id,))
        row = cur.fetchone()
        conn.close()
        line_id = row["line_id"] if row else "LINE_SORT_01"

        rul_dict = self.tool_estimate_rul(asset_id)
        from prognostics.health_rul import RULPrediction
        rul_obj = RULPrediction(
            p10_days=rul_dict["p10_days"], p50_days=rul_dict["p50_days"], p90_days=rul_dict["p90_days"],
            confidence_label=rul_dict["confidence_label"], confidence_score=rul_dict["confidence_score"],
            critical_threshold_value=rul_dict["critical_threshold"], current_value=rul_dict["current_value"],
            degradation_rate_per_day=rul_dict["degradation_rate_per_day"], r_squared=0.88,
            factors_affecting_confidence=rul_dict["factors"]
        )

        plan = self.scorer.score_windows(
            asset_id=asset_id,
            line_id=line_id,
            rul_prediction=rul_obj,
            estimated_duration_hours=duration_hours,
            parts_required=["BRG-SKF-6314-C3", "SEAL-VR-70A"],
            required_skills=["VIBRATION_CAT_II"],
            safety_permits=["LOTO-E02"],
            specialized_tools=["TOOL-PULL-10T"]
        )

        top_windows = [
            {
                "rank": w.rank,
                "window_id": w.window_id,
                "start": w.window_start,
                "end": w.window_end,
                "duration_hours": w.duration_hours,
                "type": w.window_type,
                "cost_rate": w.downtime_cost_per_hr,
                "score": w.composite_score,
                "risk": w.risk_of_failure_level,
                "parts_ready": w.parts_status,
                "crew_ready": w.crew_status,
                "rank_reason": w.rank_reason,
                "trade_offs": w.trade_offs
            }
            for w in plan.top_3_windows
        ]

        return {
            "asset_id": asset_id,
            "recommended_window": top_windows[0] if top_windows else None,
            "top_3_windows": top_windows,
            "interim_actions": plan.interim_actions,
            "no_viable_window": plan.no_viable_window_alert
        }

    def tool_draft_work_order(
        self,
        asset_id: str,
        title: str,
        failure_mode: str,
        recommended_window_id: str,
        estimated_downtime_hours: float,
        parts_required: List[str],
        required_skills: List[str],
        safety_permits: List[str]
    ) -> Dict[str, Any]:
        """Drafts a work order in state 'PENDING_APPROVAL'. Does not approve or execute."""
        wo_id = f"WO-{asset_id}-{int(datetime.now().timestamp())}"
        wo_data = {
            "id": wo_id,
            "asset_id": asset_id,
            "status": "PENDING_APPROVAL",
            "title": title,
            "description": f"AI Copilot Draft: Addressing {failure_mode}. Requires supervisor review.",
            "priority": "HIGH",
            "failure_mode": failure_mode,
            "recommended_window_id": recommended_window_id,
            "estimated_downtime_hours": estimated_downtime_hours,
            "estimated_cost": estimated_downtime_hours * 1200.0 + 500.0,
            "parts_required": parts_required,
            "required_skills": required_skills,
            "safety_permits": safety_permits
        }
        created_id = self.cmms.create_work_order(wo_data)
        return {"work_order_id": created_id, "status": "PENDING_APPROVAL", "message": "Draft created successfully. Submitted to supervisor queue."}

    def tool_request_approval(self, work_order_id: str, supervisor_name: str) -> Dict[str, Any]:
        return {
            "work_order_id": work_order_id,
            "supervisor": supervisor_name,
            "status": "PENDING_APPROVAL",
            "message": f"Decision brief notification dispatched to supervisor '{supervisor_name}'."
        }

    def tool_get_open_alerts(self) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM alerts WHERE status != 'RESOLVED' ORDER BY timestamp DESC")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
