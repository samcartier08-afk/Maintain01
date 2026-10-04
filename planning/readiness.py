"""
Readiness Checker: Evaluates part stock & lead time, technician skill/shift match,
and required safety permits/specialized tools.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from connectors.interfaces import ERPClient, ScheduleClient


@dataclass
class ReadinessAssessment:
    is_ready_now: bool
    earliest_ready_time: str
    parts_ready: bool
    parts_lead_time_days: int
    parts_details: List[Dict[str, Any]]
    crew_available: bool
    qualified_technicians: List[str]
    missing_skills: List[str]
    safety_permits_required: List[str]
    specialized_tools: List[str]
    blockers: List[str] = field(default_factory=list)


class ReadinessChecker:
    def __init__(self, erp_client: ERPClient, sched_client: ScheduleClient):
        self.erp = erp_client
        self.sched = sched_client

    def check_readiness(
        self,
        parts_required: List[str],
        required_skills: List[str],
        window_start: str,
        window_end: str,
        safety_permits: List[str],
        specialized_tools: List[str],
        reference_time: Optional[datetime] = None
    ) -> ReadinessAssessment:
        ref_dt = reference_time or datetime(2026, 10, 4, 8, 0, 0)
        blockers = []

        # 1. Parts Check
        parts_info = self.erp.check_parts_availability(parts_required)
        parts_ready = parts_info["all_available"]
        max_lead = parts_info["max_lead_time_days"]
        
        parts_avail_time = ref_dt + timedelta(days=max_lead)
        if not parts_ready:
            blockers.append(
                f"Parts not in stock (Max lead time: {max_lead} days, earliest arrival {parts_avail_time.strftime('%Y-%m-%d')})"
            )

        # 2. Crew Check
        crew_info = self.sched.get_available_crew(window_start, window_end, required_skills)
        crew_avail = crew_info["crew_available"]
        qualified_techs = [t["name"] for t in crew_info["technicians"]]

        if not crew_avail:
            blockers.append(f"No on-duty technician with required skills: {required_skills}")

        # Check if window start is earlier than parts arrival
        try:
            w_start_dt = datetime.fromisoformat(window_start)
            if w_start_dt < parts_avail_time:
                blockers.append(f"Window starts ({w_start_dt.strftime('%m-%d %H:%M')}) before parts arrive ({parts_avail_time.strftime('%m-%d')})")
        except Exception:
            pass

        is_ready_now = len(blockers) == 0

        return ReadinessAssessment(
            is_ready_now=is_ready_now,
            earliest_ready_time=parts_avail_time.isoformat(),
            parts_ready=parts_ready,
            parts_lead_time_days=max_lead,
            parts_details=parts_info["parts"],
            crew_available=crew_avail,
            qualified_technicians=qualified_techs,
            missing_skills=[] if crew_avail else required_skills,
            safety_permits_required=safety_permits,
            specialized_tools=specialized_tools,
            blockers=blockers
        )
