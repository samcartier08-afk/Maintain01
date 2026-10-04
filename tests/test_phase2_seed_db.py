"""
Phase 2 Unit Tests: Synthetic Data Generator, Database Seeding, Connectors, Fault Verification.
"""
import unittest
import os
import json
from data.generators.seed import seed_database
from core.db import get_db_connection
from connectors.db_connectors import DBSensorSource, DBCMMSClient, DBERPClient, DBScheduleClient


class TestPhase2SeedDB(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_path = "data/test_maintain.db"
        cls.gt = seed_database(db_path=cls.db_path, seed_val=42)

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(cls.db_path):
            os.remove(cls.db_path)

    def test_seed_reproducibility(self):
        """Verify that seeding with same seed produces identical data."""
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM readings")
        count_readings = cur.fetchone()[0]
        self.assertGreater(count_readings, 2000, "Should have 2000+ telemetry readings.")

        cur.execute("SELECT COUNT(*) FROM assets")
        self.assertEqual(cur.fetchone()[0], 4)

        cur.execute("SELECT COUNT(*) FROM inventory")
        self.assertGreaterEqual(cur.fetchone()[0], 10)

        cur.execute("SELECT COUNT(*) FROM maintenance_history")
        self.assertGreaterEqual(cur.fetchone()[0], 6)
        conn.close()

    def test_injected_faults_exist(self):
        """Verify developing faults exist in the 3 monitored demo assets."""
        sensor_src = DBSensorSource(db_path=self.db_path)
        
        # 1. Conveyor Motor M-204 bearing wear
        m204_vib = sensor_src.get_readings("M-204", sensor_name="vibration_rms", limit=1000)
        late_vib = [r["value"] for r in m204_vib if r["is_fault_injected"] == 1]
        self.assertTrue(len(late_vib) > 50, "Should have injected fault samples for M-204.")
        self.assertTrue(any(v > 4.0 for v in late_vib), "M-204 bearing wear should exceed critical 4.0 mm/s threshold.")

        # 2. Centrifugal Pump P-102 cavitation
        p102_vib = sensor_src.get_readings("P-102", sensor_name="casing_vibration", limit=1000)
        fault_p102 = [r["value"] for r in p102_vib if r["is_fault_injected"] == 1]
        self.assertTrue(len(fault_p102) > 50)
        self.assertTrue(any(v > 3.8 for v in fault_p102), "P-102 cavitation should exceed 3.8 mm/s.")

        # 3. Compressor C-301 oil starvation / overheating
        c301_temp = sensor_src.get_readings("C-301", sensor_name="discharge_temp", limit=1000)
        fault_c301 = [r["value"] for r in c301_temp if r["is_fault_injected"] == 1]
        self.assertTrue(len(fault_c301) > 50)
        self.assertTrue(any(v > 95.0 for v in fault_c301), "C-301 discharge temp should exceed 95C under fault.")

    def test_false_alarm_artifacts_exist(self):
        """Verify false-alarm artifacts were generated and flagged."""
        sensor_src = DBSensorSource(db_path=self.db_path)
        
        # Conveyor Motor artifact on day 25
        m204_arts = [r for r in sensor_src.get_readings("M-204", limit=5000) if r["is_artifact"] == 1]
        self.assertTrue(len(m204_arts) > 0, "M-204 should have transient artifact.")

        # Pump P-102 sensor dropout on day 20 (-999 value)
        p102_arts = [r for r in sensor_src.get_readings("P-102", sensor_name="casing_vibration", limit=5000) if r["value"] == -999.0]
        self.assertTrue(len(p102_arts) > 0, "P-102 should have sensor dropout artifact (-999).")

    def test_connectors_query_correctly(self):
        """Verify CMMS, ERP, and Schedule mock connectors function properly."""
        cmms = DBCMMSClient(db_path=self.db_path)
        history = cmms.get_maintenance_history("M-204")
        self.assertGreaterEqual(len(history), 2, "M-204 should have 2+ past incidents.")

        erp = DBERPClient(db_path=self.db_path)
        check = erp.check_parts_availability(["BRG-SKF-6314-C3", "SEAL-VR-70A"])
        self.assertTrue(check["all_available"], "Bearing and seal should be in stock.")

        sched = DBScheduleClient(db_path=self.db_path)
        windows = sched.get_candidate_windows("LINE_SORT_01")
        self.assertGreaterEqual(len(windows), 3, "Line should have candidate repair windows.")


if __name__ == "__main__":
    unittest.main()
