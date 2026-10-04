"""
Phase 3 Unit Tests: Baseline Fitting, Anomaly Detection, Plugin Hypothesis Ranking,
Prognostics RUL Uncertainty, and Metric Evaluation.
"""
import unittest
import os
import json
from data.generators.seed import seed_database
from core.loader import load_all_profiles
from connectors.db_connectors import DBSensorSource
from detectors.baseline import LoadNormalizedBaseline
from detectors.anomaly import GenericAnomalyDetector
from detectors.plugins import rank_all_hypotheses, VibrationFaultDetector, ThermalFaultDetector, PressureFlowFaultDetector
from prognostics.health_rul import PrognosticEngine
from detectors.evaluate import run_evaluation


class TestPhase3Detectors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/maintain_copilot.db"
        if not os.path.exists(cls.db_path):
            seed_database(db_path=cls.db_path, seed_val=42)
        cls.profiles = load_all_profiles("assets/profiles")
        cls.sensor_src = DBSensorSource(db_path=cls.db_path)

    def test_load_normalized_baseline(self):
        """Verify that baseline decouples load from sensor signals."""
        profile = self.profiles["conveyor_motor"]
        readings = self.sensor_src.get_readings("M-204", limit=5000)
        baseline = LoadNormalizedBaseline("conveyor_motor", profile.load_variable)
        baseline.fit(readings, healthy_max_day=30.0)

        # Predict expected vibration at 30A vs 80A
        exp_low = baseline.predict_expected("vibration_rms", 30.0)
        exp_high = baseline.predict_expected("vibration_rms", 80.0)
        self.assertGreater(exp_high, exp_low, "Expected vibration should vary logically with mechanical current load.")

        # Residual of healthy point should be near 0 z-score
        res, z = baseline.compute_residual("vibration_rms", exp_low, 30.0)
        self.assertAlmostEqual(z, 0.0, delta=0.5)

    def test_anomaly_detector_and_contributions(self):
        """Verify multivariate score 0-1 and signal contribution summation."""
        profile = self.profiles["conveyor_motor"]
        readings = self.sensor_src.get_readings("M-204", limit=5000)
        baseline = LoadNormalizedBaseline("conveyor_motor", profile.load_variable)
        baseline.fit(readings)
        detector = GenericAnomalyDetector(baseline)

        # Normal sample
        normal_signals = {"vibration_rms": 1.7, "winding_temp": 62.0, "belt_speed": 2.0}
        norm_rep = detector.evaluate_sample("M-204", "2026-10-01T10:00:00", normal_signals, 50.0)
        self.assertFalse(norm_rep.is_anomaly)
        self.assertLess(norm_rep.overall_score, 0.50)

        # Severe degraded sample (high vibration)
        faulty_signals = {"vibration_rms": 4.8, "winding_temp": 82.0, "belt_speed": 2.0}
        fault_rep = detector.evaluate_sample("M-204", "2026-10-04T10:00:00", faulty_signals, 70.0)
        self.assertTrue(fault_rep.is_anomaly)
        self.assertGreater(fault_rep.overall_score, 0.65)
        self.assertIn("vibration_rms", fault_rep.signal_contributions)
        # Total contributions should sum to ~100%
        self.assertAlmostEqual(sum(fault_rep.signal_contributions.values()), 100.0, delta=1.5)

    def test_missing_data_and_dropouts_handled(self):
        """Verify dropouts (-999) penalize confidence and flag gaps instead of crashing."""
        profile = self.profiles["centrifugal_pump"]
        readings = self.sensor_src.get_readings("P-102", limit=5000)
        baseline = LoadNormalizedBaseline("centrifugal_pump", profile.load_variable)
        baseline.fit(readings)
        detector = GenericAnomalyDetector(baseline)

        # Sample with dropout
        dropout_signals = {"flow_rate": 300.0, "suction_pressure": 2.5, "casing_vibration": -999.0}
        rep = detector.evaluate_sample("P-102", "2026-09-10T12:00:00", dropout_signals, 300.0, recent_window_dropouts=2)
        self.assertEqual(rep.confidence, "LOW")
        self.assertTrue(len(rep.data_quality_flags) > 0)

    def test_plugin_hypothesis_ranking(self):
        """Verify domain plugins rank bearing_wear top for high vibration on conveyor motor."""
        profile = self.profiles["conveyor_motor"]
        readings = self.sensor_src.get_readings("M-204", limit=5000)
        baseline = LoadNormalizedBaseline("conveyor_motor", profile.load_variable)
        baseline.fit(readings)
        detector = GenericAnomalyDetector(baseline)

        fault_signals = {"stator_current": 78.0, "vibration_rms": 4.6, "winding_temp": 80.0, "belt_speed": 2.0}
        rep = detector.evaluate_sample("M-204", "2026-10-04T10:00:00", fault_signals, 78.0)
        
        hypotheses = rank_all_hypotheses(profile, rep, baseline, fault_signals, 78.0)
        self.assertGreater(len(hypotheses), 0)
        top = hypotheses[0]
        self.assertEqual(top.failure_mode, "bearing_wear")
        self.assertGreater(top.probability, 0.70)
        self.assertTrue(len(top.evidence) >= 2)

    def test_prognostics_rul_quantiles(self):
        """Verify RUL returns p10 < p50 < p90 and confidence label."""
        profile = self.profiles["conveyor_motor"]
        engine = PrognosticEngine(profile)

        # Synthetic history ramping up
        history = [{"timestamp": f"2026-09-01T{h:02d}:00:00", "value": 1.5 + (h / 60.0) * 2.8} for h in range(60)]
        pred = engine.estimate_rul(history, "vibration_rms", critical_limit=4.5, data_quality_flags=[])
        
        self.assertLessEqual(pred.p10_days, pred.p50_days)
        self.assertLessEqual(pred.p50_days, pred.p90_days)
        self.assertIn(pred.confidence_label, ["HIGH", "MEDIUM", "LOW"])

    def test_full_evaluation_pipeline(self):
        """Verify evaluation against ground truth detects all 3 faults and produces metrics.json."""
        metrics = run_evaluation(db_path=self.db_path, metrics_path="data/metrics.json")
        self.assertTrue(os.path.exists("data/metrics.json"))
        summary = metrics["summary"]
        self.assertEqual(summary["faults_detected_before_failure"], 3, "All 3 faults must be detected prior to failure.")
        self.assertGreater(summary["mean_detection_lead_time_days"], 10.0, "Mean lead time should exceed 10 days.")
        self.assertLess(summary["overall_false_alarm_rate_pct"], 5.0, "False alarm rate should be under 5%.")
        self.assertEqual(summary["artifacts_escalated_to_critical"], 0, "Artifacts should not escalate to critical faults.")


if __name__ == "__main__":
    unittest.main()
