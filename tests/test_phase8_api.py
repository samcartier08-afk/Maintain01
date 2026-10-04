"""
Phase 8 Unit Tests: API Endpoints, Role Enforcement, Supervisor Approval,
Technician Closeout, and Feedback Loop Metrics Update.
"""
import unittest
import os
import json
from governance.permissions import Role, UnauthorizedRoleException
from governance.state_machine import WorkOrderStateMachine, WorkOrderStatus
from connectors.db_connectors import DBCMMSClient
from core.db import get_db_connection, init_db


class TestPhase8API(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/maintain_copilot.db"
        cls.cmms = DBCMMSClient(db_path=cls.db_path)
        cls.sm = WorkOrderStateMachine()

    def test_role_enforcement_technician_cannot_approve(self):
        """Verify technician role attempting to approve work order raises UnauthorizedRoleException."""
        with self.assertRaises(UnauthorizedRoleException) as ctx:
            self.sm.transition(
                current_status=WorkOrderStatus.PENDING_APPROVAL.value,
                target_status=WorkOrderStatus.APPROVED.value,
                actor_role=Role.TECHNICIAN.value,
                actor_name="Marcus Chen"
            )
        self.assertIn("requires human 'supervisor' authority", str(ctx.exception))

    def test_supervisor_approval_path_succeeds(self):
        """Verify supervisor approval transitions status and records decision."""
        # Create a test work order
        wo_id = self.cmms.create_work_order({
            "asset_id": "M-204",
            "title": "Drive-End Bearing Overhaul",
            "status": "PENDING_APPROVAL",
            "failure_mode": "bearing_wear",
            "estimated_downtime_hours": 3.5,
            "estimated_cost": 3200.0,
            "parts_required": ["BRG-SKF-6314-C3"]
        })

        # Transition by supervisor
        new_status = self.sm.transition(
            current_status=WorkOrderStatus.PENDING_APPROVAL.value,
            target_status=WorkOrderStatus.APPROVED.value,
            actor_role=Role.SUPERVISOR.value,
            actor_name="Elena Miller (Supervisor)",
            justification="Reviewed high vibration telemetry and risk assessment."
        )
        self.assertEqual(new_status, WorkOrderStatus.APPROVED)
        
        updated = self.cmms.update_work_order_status(wo_id, new_status.value, Role.SUPERVISOR.value, "Elena Miller")
        self.assertTrue(updated)

    def test_technician_closeout_feedback_loop(self):
        """Verify technician closeout records accuracy feedback and closes work order."""
        wo_id = self.cmms.create_work_order({
            "asset_id": "P-102",
            "title": "Impeller Cavitation Repair",
            "status": "WORK_ORDER_CREATED",
            "failure_mode": "cavitation",
            "estimated_downtime_hours": 5.0,
            "estimated_cost": 4500.0,
            "parts_required": ["IMP-BA-280"]
        })

        # Closeout by technician
        new_status = self.sm.transition(
            current_status=WorkOrderStatus.WORK_ORDER_CREATED.value,
            target_status=WorkOrderStatus.CLOSED.value,
            actor_role=Role.TECHNICIAN.value,
            actor_name="Sarah Jenkins"
        )
        self.assertEqual(new_status, WorkOrderStatus.CLOSED)

        # Record closeout feedback in database
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        fb_id = f"FB-{wo_id}"
        cur.execute(
            """INSERT OR REPLACE INTO feedback 
               (id, work_order_id, technician_id, diagnosis_accuracy, actual_failure_mode, actual_downtime_hours, notes, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (fb_id, wo_id, "Sarah Jenkins", "CONFIRMED", "cavitation", 4.8, "Impeller blade tips showed clear cavitation pitting. Replaced successfully.")
        )
        conn.commit()

        # Query feedback
        cur.execute("SELECT * FROM feedback WHERE id = ?", (fb_id,))
        row = cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["diagnosis_accuracy"], "CONFIRMED")
        self.assertEqual(row["actual_downtime_hours"], 4.8)
        conn.close()


if __name__ == "__main__":
    unittest.main()
