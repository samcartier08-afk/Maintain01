"""
Phase 5 Unit Tests: Impact Estimator, Readiness Checker, Repair Window Scorer,
Parts-Missing, No-Crew, and Bottleneck Penalties.
"""
import unittest
import os
from datetime import datetime, timedelta
from connectors.db_connectors import DBERPClient, DBScheduleClient
from planning.impact import ImpactEstimator
from planning.readiness import ReadinessChecker
from planning.window_scorer import RepairWindowScorer
from prognostics.health_rul import RULPrediction


class TestPhase5Planning(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/maintain_copilot.db"
        cls.erp = DBERPClient(db_path=cls.db_path)
        cls.sched = DBScheduleClient(db_path=cls.db_path)
        cls.readiness = ReadinessChecker(cls.erp, cls.sched)
        cls.impact = ImpactEstimator()
        cls.scorer = RepairWindowScorer(cls.sched, cls.readiness, cls.impact)
        cls.ref_time = datetime(2026, 10, 4, 8, 0, 0)

    def test_top_window_falls_before_p10_p50_risk_range(self):
        """Verify for demo fault on M-204 that top repair window falls before p10-p50."""
        # M-204: 16.6 days lead time to failure at day 42; at Day 50 RUL is ~8.6 days (p10=5d, p50=8.6d)
        rul = RULPrediction(
            p10_days=5.2, p50_days=8.6, p90_days=13.0,
            confidence_label="HIGH", confidence_score=0.88,
            critical_threshold_value=4.5, current_value=4.1,
            degradation_rate_per_day=0.12, r_squared=0.85,
            factors_affecting_confidence=[]
        )

        plan = self.scorer.score_windows(
            asset_id="M-204",
            line_id="LINE_SORT_01",
            rul_prediction=rul,
            estimated_duration_hours=3.5,
            parts_required=["BRG-SKF-6314-C3", "SEAL-VR-70A"],
            required_skills=["VIBRATION_CAT_II", "RIGGING_MECHANICAL"],
            safety_permits=["LOTO-E02"],
            specialized_tools=["TOOL-PULL-10T"],
            reference_time=self.ref_time
        )

        self.assertIsNotNone(plan.recommended_window, "A recommended window must be produced.")
        top = plan.recommended_window
        self.assertEqual(top.rank, 1)
        self.assertTrue(top.is_before_p10 or top.is_before_p50, "Top window must fall before p10 or p50 risk dates.")
        self.assertGreater(len(plan.top_3_windows), 1, "Must return top candidate windows with trade-offs.")
        self.assertTrue(len(top.trade_offs) > 10)

    def test_parts_missing_scenario(self):
        """Verify unstocked parts (e.g. Impeller 7-day lead time) trigger readiness blocker."""
        readiness = self.readiness.check_readiness(
            parts_required=["IMP-BA-280"],  # Zero stock, 7 day lead time
            required_skills=["HYDRAULIC_PIPING"],
            window_start=(self.ref_time + timedelta(days=2)).isoformat(),
            window_end=(self.ref_time + timedelta(days=2, hours=4)).isoformat(),
            safety_permits=["LOTO-P01"],
            specialized_tools=[],
            reference_time=self.ref_time
        )
        self.assertFalse(readiness.is_ready_now, "Should be blocked due to missing parts.")
        self.assertFalse(readiness.parts_ready)
        self.assertEqual(readiness.parts_lead_time_days, 7)
        self.assertTrue(any("lead time" in b.lower() for b in readiness.blockers))

    def test_no_crew_scenario(self):
        """Verify non-existent or unstaffed specialized skill is flagged."""
        readiness = self.readiness.check_readiness(
            parts_required=["LUBE-POLYREX-EM"],
            required_skills=["NUCLEAR_SPECIALIST_TIER_IV"],  # Impossible skill
            window_start=(self.ref_time + timedelta(days=1)).isoformat(),
            window_end=(self.ref_time + timedelta(days=1, hours=3)).isoformat(),
            safety_permits=[],
            specialized_tools=[],
            reference_time=self.ref_time
        )
        self.assertFalse(readiness.is_ready_now)
        self.assertFalse(readiness.crew_available)
        self.assertTrue(any("skills" in b.lower() for b in readiness.blockers))

    def test_bottleneck_cost_penalty(self):
        """Verify running peak/bottleneck windows incur heavy cost penalties."""
        rul = RULPrediction(
            p10_days=8.0, p50_days=14.0, p90_days=20.0,
            confidence_label="HIGH", confidence_score=0.9,
            critical_threshold_value=4.5, current_value=3.0,
            degradation_rate_per_day=0.08, r_squared=0.88,
            factors_affecting_confidence=[]
        )
        plan = self.scorer.score_windows(
            asset_id="M-204",
            line_id="LINE_SORT_01",
            rul_prediction=rul,
            estimated_duration_hours=3.5,
            parts_required=["BRG-SKF-6314-C3"],
            required_skills=["VIBRATION_CAT_II"],
            safety_permits=["LOTO-E02"],
            specialized_tools=[],
            reference_time=self.ref_time
        )
        # Find peak bottleneck window
        bottleneck_window = next((w for w in plan.top_3_windows if w.window_id == "WIN-2026-10-06-PEAK"), None)
        if bottleneck_window:
            self.assertNotEqual(bottleneck_window.rank, 1, "Bottleneck window with $8,750/hr cost must not be Rank 1.")

    def test_impact_estimator_savings(self):
        """Verify cost comparison shows high savings vs catastrophic failure."""
        impact = self.impact.estimate_impact(
            planned_duration_hours=3.5,
            parts_cost=277.0,
            downtime_cost_per_hr=3500.0,
            is_bottleneck=False,
            criticality_class="A"
        )
        self.assertGreater(impact.catastrophic_failure_cost, impact.planned_repair_cost * 2.5)
        self.assertGreater(impact.cost_savings, 15000.0, "Planned intervention should yield significant financial savings.")


if __name__ == "__main__":
    unittest.main()
