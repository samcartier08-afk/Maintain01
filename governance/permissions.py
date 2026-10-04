"""
Governance & Permission Enforcement Layer.
Autonomy levels L0-L3 and strict central allow-list.
HARD FORBIDDEN in code (never relies on prompts) for any agent at every autonomy level:
- equipment shutdowns
- control overrides & parameter changes
- LOTO issuance
- purchase orders
- work-order completion / closeout
- 'safe to operate' safety claims
"""
from enum import Enum
from typing import Set, Dict, Any, Optional


class AutonomyLevel(str, Enum):
    L0 = "L0"  # Advisory Only: observation, metrics display
    L1 = "L1"  # Assisted Triage: alerts, diagnostics, no drafting
    L2 = "L2"  # Draft Only: can draft work orders & briefs for supervisor review (DEFAULT)
    L3 = "L3"  # Autonomous Dispatch: can schedule routine changes, shutdown strictly forbidden


class Role(str, Enum):
    SUPERVISOR = "supervisor"
    TECHNICIAN = "technician"
    VIEWER = "viewer"
    AGENT = "agent"


# Actions strictly callable by the AI Agent
AGENT_ALLOWED_ACTIONS: Set[str] = {
    "list_assets",
    "get_asset_profile",
    "get_health",
    "get_signals",
    "detect_anomalies",
    "get_evidence",
    "rank_fault_hypotheses",
    "estimate_rul",
    "search_knowledge",
    "get_maintenance_history",
    "get_impact",
    "check_inventory",
    "check_crew",
    "get_repair_windows",
    "draft_work_order",
    "request_approval",
    "get_open_alerts",
    "explain_uncertainty"
}

# HARD FORBIDDEN for the agent at every autonomy level
AGENT_FORBIDDEN_ACTIONS: Set[str] = {
    "emergency_shutdown",
    "parameter_change",
    "control_override",
    "issue_loto",
    "purchase_order_commit",
    "complete_work_order",
    "close_work_order",
    "claim_safe_to_operate",
    "bypass_supervisor"
}


class ForbiddenActionException(PermissionError):
    """Raised when an agent attempts a forbidden physical, purchasing, or safety action."""
    pass


class UnauthorizedRoleException(PermissionError):
    """Raised when an unauthorized role attempts a restricted state transition."""
    pass


class PermissionGuard:
    def __init__(self, autonomy_level: AutonomyLevel = AutonomyLevel.L2):
        self.autonomy_level = autonomy_level

    def validate_agent_action(self, action_name: str) -> None:
        """
        Enforce permissions on agent tool calls.
        Raises ForbiddenActionException for forbidden actions.
        """
        action = action_name.lower().strip()

        if action in AGENT_FORBIDDEN_ACTIONS:
            raise ForbiddenActionException(
                f"[SECURITY VIOLATION] Action '{action_name}' is STRICTLY FORBIDDEN for AI agents "
                f"at all autonomy levels ({self.autonomy_level.value}). "
                f"Only a human supervisor possesses physical and purchasing authority."
            )

        if action not in AGENT_ALLOWED_ACTIONS:
            raise ForbiddenActionException(
                f"Action '{action_name}' is not in the agent allow-list for autonomy level {self.autonomy_level.value}."
            )

        # Autonomy level restrictions
        if self.autonomy_level == AutonomyLevel.L0:
            if action in ["draft_work_order", "request_approval"]:
                raise ForbiddenActionException(f"Autonomy L0 is Advisory Only; '{action}' is disabled.")
        elif self.autonomy_level == AutonomyLevel.L1:
            if action in ["draft_work_order"]:
                raise ForbiddenActionException(f"Autonomy L1 is Assisted Triage; drafting is disabled.")

    @staticmethod
    def validate_supervisor_authority(actor_role: str, action_description: str) -> None:
        if actor_role != Role.SUPERVISOR.value:
            raise UnauthorizedRoleException(
                f"[GOVERNANCE ERROR] {action_description} requires role '{Role.SUPERVISOR.value}', "
                f"got actor role '{actor_role}'."
            )
