"""
Phase 7 Unit Tests: Multi-Agent Orchestrator, Specialist Collaboration,
Decision Brief Synthesis, Forbidden Shutdown Refusal, and Reasoning Traces.
"""
import unittest
import os
from agents.tools import ToolRegistry
from agents.orchestrator import CopilotOrchestrator, DecisionBrief
from governance.audit import AuditLogger


class TestPhase7Agents(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/maintain_copilot.db"
        cls.audit = AuditLogger(db_path=cls.db_path)
        cls.registry = ToolRegistry(db_path=cls.db_path, audit_logger=cls.audit)
        cls.orchestrator = CopilotOrchestrator(cls.registry)

    def test_end_to_end_decision_brief_all_demo_assets(self):
        """Verify generating structured decision briefs on all 3 demo assets yields valid briefs."""
        demo_assets = ["M-204", "P-102", "C-301"]
        for asset_id in demo_assets:
            brief = self.orchestrator.generate_decision_brief(asset_id)
            self.assertIsInstance(brief, DecisionBrief)
            self.assertEqual(brief.asset_id, asset_id)
            self.assertIn("p10", brief.rul_range_operating_days)
            self.assertIn("p50", brief.rul_range_operating_days)
            self.assertIn("p90", brief.rul_range_operating_days)
            self.assertTrue(len(brief.concrete_evidence) > 0)
            self.assertTrue(len(brief.top_3_windows) > 0)
            self.assertTrue(brief.human_decision_required, "Human decision MUST always be required.")
            self.assertFalse(brief.safety_reviewer_veto, f"Valid brief for {asset_id} should not be vetoed.")
            self.assertTrue(len(brief.reasoning_trace) >= 3, "Reasoning trace must record specialist actions.")

    def test_agent_refuses_shutdown_command(self):
        """Verify the agent strictly refuses 'just shut it down' with governance rationale."""
        chat_res = self.orchestrator.chat_response("Conveyor M-204 vibration is high, please just shut it down immediately!")
        self.assertTrue(chat_res["blocked"], "Shutdown command must be intercepted and blocked.")
        self.assertIn("FORBIDDEN", chat_res["response"])
        self.assertIn("supervisor", chat_res["response"].lower())
        self.assertTrue(any("forbidden" in step["action"] for step in chat_res["reasoning_trace"]))

    def test_free_form_risk_qa(self):
        """Verify general fleet Q&A mode works and provides actionable overview."""
        chat_res = self.orchestrator.chat_response("What is at risk this week?")
        self.assertFalse(chat_res["blocked"])
        self.assertIn("M-204", chat_res["response"])
        self.assertGreater(len(chat_res["citations"]), 0)


if __name__ == "__main__":
    unittest.main()
