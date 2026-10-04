"""
Phase 6 Unit Tests: Governance, Hard Forbidden Action Enforcement,
State Machine Role Authorization, and Tamper-Evident Hash Chain Verification.
"""
import unittest
import os
import sqlite3
from governance.permissions import (
    PermissionGuard, AutonomyLevel, Role,
    ForbiddenActionException, UnauthorizedRoleException
)
from governance.state_machine import WorkOrderStateMachine, WorkOrderStatus
from governance.audit import AuditLogger, compute_block_hash
from core.db import get_db_connection, init_db


class TestPhase6Governance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/test_gov.db"
        cls.audit_json = "data/test_audit.json"
        init_db(cls.db_path)
        cls.logger = AuditLogger(db_path=cls.db_path, json_export_path=cls.audit_json)
        cls.guard = PermissionGuard(autonomy_level=AutonomyLevel.L2)

    @classmethod
    def tearDownClass(cls):
        for p in [cls.db_path, cls.audit_json]:
            if os.path.exists(p):
                os.remove(p)

    def test_forbidden_actions_raise_exception_at_all_levels(self):
        """Verify forbidden actions (emergency_shutdown, issue_loto, control_override) raise ForbiddenActionException."""
        forbidden_list = [
            "emergency_shutdown",
            "parameter_change",
            "control_override",
            "issue_loto",
            "purchase_order_commit",
            "complete_work_order",
            "claim_safe_to_operate"
        ]
        for level in [AutonomyLevel.L0, AutonomyLevel.L1, AutonomyLevel.L2, AutonomyLevel.L3]:
            guard = PermissionGuard(autonomy_level=level)
            for action in forbidden_list:
                with self.assertRaises(ForbiddenActionException, msg=f"Action '{action}' must be forbidden at {level.value}"):
                    guard.validate_agent_action(action)

    def test_state_machine_blocks_agent_or_technician_approval(self):
        """Verify only SUPERVISOR role can transition work order to APPROVED."""
        sm = WorkOrderStateMachine()

        # Technician attempting to approve -> UnauthorizedRoleException
        with self.assertRaises(UnauthorizedRoleException):
            sm.transition(
                current_status=WorkOrderStatus.PENDING_APPROVAL.value,
                target_status=WorkOrderStatus.APPROVED.value,
                actor_role=Role.TECHNICIAN.value,
                actor_name="Marcus Chen"
            )

        # AI Agent attempting to approve -> UnauthorizedRoleException
        with self.assertRaises(UnauthorizedRoleException):
            sm.transition(
                current_status=WorkOrderStatus.PENDING_APPROVAL.value,
                target_status=WorkOrderStatus.APPROVED.value,
                actor_role=Role.AGENT.value,
                actor_name="MaintainCopilot_Agent"
            )

        # Human Supervisor approving -> SUCCESS
        target = sm.transition(
            current_status=WorkOrderStatus.PENDING_APPROVAL.value,
            target_status=WorkOrderStatus.APPROVED.value,
            actor_role=Role.SUPERVISOR.value,
            actor_name="Elena Miller (Shift Supervisor)",
            justification="Bearing vibration exceeds 4.5 mm/s. Approved for Wednesday PM window."
        )
        self.assertEqual(target, WorkOrderStatus.APPROVED)

    def test_audit_hash_chain_integrity_and_tamper_detection(self):
        """Verify cryptographic verification passes on genuine chain, and detects database tampering."""
        # 1. Log 3 legitimate events
        e1 = self.logger.append_log(Role.AGENT.value, "CopilotAgent", "detect_anomalies", {"asset": "M-204", "z_score": 4.2})
        e2 = self.logger.append_log(Role.AGENT.value, "CopilotAgent", "draft_work_order", {"wo_id": "WO-101", "action": "replace_bearing"})
        e3 = self.logger.append_log(Role.SUPERVISOR.value, "Elena Miller", "approve_work_order", {"wo_id": "WO-101", "decision": "APPROVED"})

        # Verify intact chain
        verification = self.logger.verify_chain()
        self.assertTrue(verification["is_valid"], f"Authentic chain must be valid. Got: {verification}")
        self.assertGreaterEqual(verification["total_blocks"], 3)

        # 2. Tamper deliberate modification in SQLite table
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        # Tamper payload of block #2
        cur.execute("UPDATE audit_log SET payload = '{\"tampered\": true}' WHERE sequence_num = 2")
        conn.commit()
        conn.close()

        # Verify tampered chain is caught!
        tampered_check = self.logger.verify_chain()
        self.assertFalse(tampered_check["is_valid"], "Tamper detection MUST catch modified payload!")
        self.assertEqual(tampered_check["tampered_sequence"], 2)


if __name__ == "__main__":
    unittest.main()
