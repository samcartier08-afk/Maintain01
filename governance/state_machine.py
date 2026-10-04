"""
Work Order Lifecycle State Machine.
Enforces valid transitions and role authority in code.
DETECTED -> INVESTIGATING -> RECOMMENDED -> PENDING_APPROVAL -> 
(APPROVED | EDITED | POSTPONED | REJECTED) -> WORK_ORDER_CREATED -> CLOSED
"""
from enum import Enum
from typing import Dict, Set, Optional, Any
from governance.permissions import Role, UnauthorizedRoleException


class WorkOrderStatus(str, Enum):
    DETECTED = "DETECTED"
    INVESTIGATING = "INVESTIGATING"
    RECOMMENDED = "RECOMMENDED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    EDITED = "EDITED"
    POSTPONED = "POSTPONED"
    REJECTED = "REJECTED"
    WORK_ORDER_CREATED = "WORK_ORDER_CREATED"
    CLOSED = "CLOSED"


# Legal transitions
VALID_TRANSITIONS: Dict[WorkOrderStatus, Set[WorkOrderStatus]] = {
    WorkOrderStatus.DETECTED: {WorkOrderStatus.INVESTIGATING, WorkOrderStatus.RECOMMENDED},
    WorkOrderStatus.INVESTIGATING: {WorkOrderStatus.RECOMMENDED, WorkOrderStatus.REJECTED},
    WorkOrderStatus.RECOMMENDED: {WorkOrderStatus.PENDING_APPROVAL},
    WorkOrderStatus.PENDING_APPROVAL: {
        WorkOrderStatus.APPROVED,
        WorkOrderStatus.EDITED,
        WorkOrderStatus.POSTPONED,
        WorkOrderStatus.REJECTED
    },
    WorkOrderStatus.APPROVED: {WorkOrderStatus.WORK_ORDER_CREATED},
    WorkOrderStatus.EDITED: {WorkOrderStatus.WORK_ORDER_CREATED, WorkOrderStatus.PENDING_APPROVAL},
    WorkOrderStatus.POSTPONED: {WorkOrderStatus.PENDING_APPROVAL, WorkOrderStatus.REJECTED},
    WorkOrderStatus.REJECTED: set(),  # Terminal state unless new detection
    WorkOrderStatus.WORK_ORDER_CREATED: {WorkOrderStatus.CLOSED},
    WorkOrderStatus.CLOSED: set()  # Terminal state
}

# Transitions strictly requiring human SUPERVISOR role
SUPERVISOR_ONLY_TARGETS: Set[WorkOrderStatus] = {
    WorkOrderStatus.APPROVED,
    WorkOrderStatus.EDITED,
    WorkOrderStatus.POSTPONED,
    WorkOrderStatus.REJECTED,
    WorkOrderStatus.WORK_ORDER_CREATED
}


class WorkOrderStateMachine:
    @staticmethod
    def transition(
        current_status: str,
        target_status: str,
        actor_role: str,
        actor_name: str,
        justification: Optional[str] = None
    ) -> WorkOrderStatus:
        try:
            curr = WorkOrderStatus(current_status)
            target = WorkOrderStatus(target_status)
        except ValueError as e:
            raise ValueError(f"Invalid status value: {e}")

        # Check if transition path is legal
        if target not in VALID_TRANSITIONS.get(curr, set()):
            raise ValueError(
                f"Illegal state transition from '{curr.value}' to '{target.value}'. "
                f"Valid next states: {[s.value for s in VALID_TRANSITIONS.get(curr, set())]}"
            )

        # Check Supervisor Authority
        if target in SUPERVISOR_ONLY_TARGETS:
            if actor_role != Role.SUPERVISOR.value:
                raise UnauthorizedRoleException(
                    f"[GOVERNANCE ENFORCEMENT] Transition to '{target.value}' requires human '{Role.SUPERVISOR.value}' authority. "
                    f"Attempted by role '{actor_role}' ({actor_name}). AI Agents cannot approve work orders."
                )

        # Closeout requires Technician or Supervisor
        if target == WorkOrderStatus.CLOSED:
            if actor_role not in [Role.TECHNICIAN.value, Role.SUPERVISOR.value]:
                raise UnauthorizedRoleException(
                    f"[GOVERNANCE ENFORCEMENT] Closing a work order requires technician or supervisor closeout. "
                    f"Role '{actor_role}' is not authorized."
                )

        return target
