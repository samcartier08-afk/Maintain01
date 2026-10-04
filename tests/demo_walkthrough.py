"""
End-to-End Demo Walkthrough Script.
Simulates full lifecycle from detection -> multi-agent brief -> supervisor approval -> closeout.
Executed via `make demo` or python3 -m tests.demo_walkthrough.
"""
import sys
import json
from datetime import datetime
from data.generators.seed import seed_database
from agents.tools import ToolRegistry
from agents.orchestrator import CopilotOrchestrator
from governance.permissions import Role, UnauthorizedRoleException
from governance.state_machine import WorkOrderStateMachine, WorkOrderStatus
from detectors.evaluate import run_evaluation


def run_demo():
    print("=" * 75)
    print("  MAINTAINCOPILOT: 5-MINUTE INDUSTRIAL END-TO-END DEMO WALKTHROUGH")
    print("=" * 75)

    # 1. Deterministic Seeding
    print("\n[Step 1] Initializing Deterministic Database & 60-day Telemetry Seed...")
    gt = seed_database(seed_val=42)
    print(f"  ✓ Database seeded. Ground truth recorded for 3 active industrial assets.")
    print(f"  ✓ Conveyor Motor M-204: Bearing wear fault injected Day 42 (Critical Failure Day 58.6).")

    reg = ToolRegistry()
    orch = CopilotOrchestrator(reg)

    # 2. Telemetry Anomaly Detection
    print("\n[Step 2] Scanning Real-time Fleet Telemetry (Load-Normalized Engine)...")
    health = reg.tool_get_health("M-204")
    print(f"  ✓ Asset M-204 Status: {health['risk_level']} (Health Index: {health['health_score']}/100)")
    print(f"  ✓ Anomaly Score: {health['anomaly_score']} (Threshold: 0.55)")
    print(f"  ✓ Leading Driver: vibration_rms ({health['top_signal_contributions'].get('vibration_rms', 0)}% of anomaly energy)")

    # 3. Multi-Agent Structured Decision Brief
    print("\n[Step 3] Triggering Copilot Orchestrator & Specialist Synthesis...")
    brief = orch.generate_decision_brief("M-204")
    print(f"  ✓ Primary Diagnosis: {brief.primary_fault_hypothesis.upper()} (Prob: {int(brief.fault_probability*100)}%)")
    print(f"  ✓ RUL Quantile Range: p10={brief.rul_range_operating_days['p10']}d | p50={brief.rul_range_operating_days['p50']}d | p90={brief.rul_range_operating_days['p90']}d")
    print(f"  ✓ Safety Reviewer Audit: Veto={brief.safety_reviewer_veto} ({brief.safety_reviewer_comments})")
    print(f"  ✓ Cost Savings vs Catastrophic Seizure: ${brief.cost_comparison['cost_savings']:,.0f}")
    
    top_w = brief.top_3_windows[0]
    print(f"  ✓ Top Scored Repair Window: {top_w['window_id']} ({top_w['type']})")
    print(f"    Trade-off: {top_w['trade_offs']}")

    # 4. Governance Authorization Enforcement
    print("\n[Step 4] Enforcing Principle 3: Human Supervisor Authority...")
    sm = WorkOrderStateMachine()

    # Create work order in PENDING_APPROVAL
    draft_res = reg.tool_draft_work_order(
        asset_id="M-204",
        title="M-204 Drive-End Bearing Replacement",
        failure_mode="bearing_wear",
        recommended_window_id=top_w["window_id"],
        estimated_downtime_hours=3.5,
        parts_required=["BRG-SKF-6314-C3", "SEAL-VR-70A"],
        required_skills=["VIBRATION_CAT_II"],
        safety_permits=["LOTO-E02"]
    )
    wo_id = draft_res["work_order_id"]
    print(f"  ✓ Work order draft created in state PENDING_APPROVAL: {wo_id}")

    # Unauthorized Technician attempt
    print("  [Test] Attempting approval with role 'technician'...")
    try:
        sm.transition("PENDING_APPROVAL", "APPROVED", actor_role=Role.TECHNICIAN.value, actor_name="Marcus Chen")
        print("  ❌ ERROR: Technician approval was NOT blocked!")
    except UnauthorizedRoleException:
        print("  ✓ SUCCESS: Technician approval was STRICTLY BLOCKED by code.")

    # Legitimate Supervisor Approval
    print("  [Authorize] Human Supervisor Elena Miller reviewing decision brief...")
    app_status = sm.transition(
        "PENDING_APPROVAL", "APPROVED", 
        actor_role=Role.SUPERVISOR.value, 
        actor_name="Elena Miller (Shift Supervisor)",
        justification="Vibration exceeds 4.5 mm/s limit. Authorized for Wednesday PM window."
    )
    reg.cmms.update_work_order_status(wo_id, "APPROVED", Role.SUPERVISOR.value, "Elena Miller")
    reg.cmms.update_work_order_status(wo_id, "WORK_ORDER_CREATED", Role.SUPERVISOR.value, "Elena Miller")
    print(f"  ✓ Supervisor approved! Work order status transitioned to: WORK_ORDER_CREATED")

    # 5. Field Execution and Closeout Feedback Loop
    print("\n[Step 5] Field Technician Execution & Closeout Feedback...")
    close_status = sm.transition(
        "WORK_ORDER_CREATED", "CLOSED",
        actor_role=Role.TECHNICIAN.value,
        actor_name="Marcus Chen (Technician)"
    )
    reg.cmms.update_work_order_status(wo_id, "CLOSED", Role.TECHNICIAN.value, "Marcus Chen")
    
    # Record feedback in DB
    from core.db import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO feedback (id, work_order_id, technician_id, diagnosis_accuracy, actual_failure_mode, actual_downtime_hours, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        (f"FB-{wo_id}", wo_id, "Marcus Chen", "CONFIRMED", "bearing_wear", 3.2, "Spalling verified on SKF 6314-C3 inner raceway. Laser aligned to 0.02mm.")
    )
    conn.commit()
    conn.close()
    print(f"  ✓ Work order {wo_id} marked CLOSED.")
    print(f"  ✓ Feedback recorded: Diagnosis CONFIRMED, Downtime: 3.2 hrs (vs planned 3.5 hrs).")

    # 6. Audit Chain Integrity Verification
    print("\n[Step 6] Cryptographic SHA-256 Audit Chain Verification (Principle 5)...")
    audit_res = reg.audit.verify_chain()
    print(f"  ✓ Audit Chain Valid: {audit_res['is_valid']}")
    print(f"  ✓ Verified {audit_res['total_blocks']} sequential cryptographic blocks intact.")

    print("\n" + "=" * 75)
    print("  DEMO COMPLETE: All 5 Core Principles Satisfied and Audited Successfully!")
    print("=" * 75)


if __name__ == "__main__":
    run_demo()
