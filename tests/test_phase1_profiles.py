"""
Phase 1 Unit Tests: Scaffolding, Asset Profiles, Schema Validation, Error Handling.
"""
import unittest
import os
import tempfile
from core.schemas import AssetProfile, SensorSpec, FailureMode, CriticalityClass
from core.loader import load_profile_from_file, load_profile_from_dict, load_all_profiles, parse_simple_yaml


class TestPhase1Profiles(unittest.TestCase):
    def test_load_all_standard_profiles(self):
        """Verify the 3 required profiles + 4th profile load cleanly without errors."""
        profiles = load_all_profiles("assets/profiles")
        expected_types = ["conveyor_motor", "centrifugal_pump", "compressor", "industrial_gearbox"]
        for exp in expected_types:
            self.assertIn(exp, profiles, f"Profile '{exp}' should be loaded successfully.")
            prof = profiles[exp]
            self.assertIsInstance(prof, AssetProfile)
            self.assertGreater(len(prof.sensors), 0)
            self.assertGreater(len(prof.failure_modes), 0)
            self.assertIn(prof.load_variable, [s.name for s in prof.sensors])
            self.assertIn(prof.criticality_class, [CriticalityClass.A, CriticalityClass.B, CriticalityClass.C])

    def test_fourth_profile_needs_no_code_changes(self):
        """Verifies that an entirely new asset type (industrial_gearbox) functions seamlessly."""
        prof = load_profile_from_file("assets/profiles/industrial_gearbox.yaml")
        self.assertEqual(prof.asset_type, "industrial_gearbox")
        self.assertEqual(prof.criticality_class, CriticalityClass.B)
        self.assertEqual(prof.load_variable, "input_torque")
        self.assertTrue(any(fm.name == "gear_tooth_pitting" for fm in prof.failure_modes))

    def test_reject_missing_required_fields(self):
        """Verify missing fields produce explicit errors."""
        bad_dict = {
            "asset_type": "broken_machine",
            # missing criticality_class, sensors, failure_modes
        }
        with self.assertRaises(ValueError) as ctx:
            load_profile_from_dict(bad_dict)
        self.assertIn("missing required field", str(ctx.exception).lower())

    def test_reject_inverted_normal_range(self):
        """Verify min > max in normal_range is rejected with clear message."""
        bad_dict = {
            "asset_type": "inverted_sensor_machine",
            "criticality_class": "A",
            "load_variable": "pressure",
            "sensors": [
                {
                    "name": "pressure",
                    "unit": "bar",
                    "normal_range": [10.0, 2.0]  # Inverted!
                }
            ],
            "failure_modes": [
                {
                    "name": "overpressure",
                    "signature_hints": ["pressure surge"],
                    "severity": "HIGH",
                    "primary_sensor": "pressure"
                }
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            load_profile_from_dict(bad_dict)
        self.assertIn("cannot exceed max", str(ctx.exception).lower())

    def test_reject_invalid_load_variable(self):
        """Verify load variable not in sensor list raises error."""
        bad_dict = {
            "asset_type": "mystery_load_machine",
            "criticality_class": "B",
            "load_variable": "non_existent_sensor",
            "sensors": [
                {
                    "name": "vibration",
                    "unit": "mm/s",
                    "normal_range": [0.1, 2.5]
                }
            ],
            "failure_modes": [
                {
                    "name": "vibration_fault",
                    "signature_hints": ["high vibe"],
                    "severity": "MEDIUM",
                    "primary_sensor": "vibration"
                }
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            load_profile_from_dict(bad_dict)
        self.assertIn("not listed among defined sensors", str(ctx.exception))

    def test_reject_invalid_criticality(self):
        """Verify invalid criticality class is rejected."""
        bad_dict = {
            "asset_type": "bad_crit",
            "criticality_class": "X",  # Invalid
            "load_variable": "rpm",
            "sensors": [{"name": "rpm", "unit": "rpm", "normal_range": [0, 1000]}],
            "failure_modes": [{"name": "stall", "signature_hints": ["0 rpm"], "severity": "HIGH", "primary_sensor": "rpm"}]
        }
        with self.assertRaises(ValueError) as ctx:
            load_profile_from_dict(bad_dict)
        self.assertIn("invalid criticality_class", str(ctx.exception).lower())

    def test_reject_malformed_yaml(self):
        """Verify corrupt/malformed YAML files are caught with helpful messages."""
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as f:
            f.write("asset_type: [unclosed bracket\n  broken: :::\n")
            temp_path = f.name
        
        try:
            with self.assertRaises(ValueError) as ctx:
                load_profile_from_file(temp_path)
            self.assertTrue(len(str(ctx.exception)) > 0)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


if __name__ == "__main__":
    unittest.main()
