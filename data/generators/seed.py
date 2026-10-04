"""
Deterministic Synthetic Data Generator and Database Seeder.
Generates 60 days of telemetry, developing faults, artifacts, maintenance history,
inventory, technicians, shifts, and production calendar.
"""
import os
import math
import json
import random
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List
from core.db import init_db, get_db_connection


def seed_database(db_path: str = "data/maintain_copilot.db", seed_val: int = 42) -> Dict[str, Any]:
    random.seed(seed_val)
    init_db(db_path)
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Clear existing data for idempotency
    tables = [
        "readings", "alerts", "work_orders", "approvals", "audit_log",
        "feedback", "maintenance_history", "inventory", "technicians",
        "shifts", "production_calendar", "assets"
    ]
    for tbl in tables:
        cur.execute(f"DELETE FROM {tbl}")

    # 1. Assets
    assets_data = [
        ("M-204", "Primary Incline Parcel Sorter Motor", "conveyor_motor", "A", "DEGRADED", "Sortation Hall B - Bay 4", "LINE_SORT_01", "2023-03-15"),
        ("P-102", "Chilled Water Primary Feed Pump", "centrifugal_pump", "A", "DEGRADED", "Central Utility Plant - Pump Room 2", "LINE_CHILL_02", "2022-11-01"),
        ("C-301", "Plant Instrument Air Compressor A", "compressor", "A", "DEGRADED", "Compressor House 1", "LINE_AIR_01", "2021-08-20"),
        ("GBX-401", "Intermediate Rotary Kiln Drive Reducer", "industrial_gearbox", "B", "HEALTHY", "Kiln Agitation Area", "LINE_KILN_03", "2024-01-10"),
    ]
    cur.executemany(
        "INSERT INTO assets (id, name, asset_type, criticality_class, status, location, line_id, install_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        assets_data
    )

    # 2. Inventory
    inventory_data = [
        ("BRG-SKF-6314-C3", "SKF Explorer 6314-2Z/C3 Deep Groove Ball Bearing", "conveyor_motor", 3, 2, 2, 245.0, "BIN-MTR-A14"),
        ("SEAL-VR-70A", "V-Ring NBR V-70A Shaft Slinger Seal", "conveyor_motor", 8, 4, 1, 32.0, "BIN-MTR-A18"),
        ("LUBE-POLYREX-EM", "Mobil Polyrex EM Electric Motor Grease 400g", "conveyor_motor", 15, 5, 1, 18.5, "BIN-LUBE-C01"),
        ("IMP-BA-280", "Bronze-Aluminum Closed Impeller D-280mm", "centrifugal_pump", 0, 1, 7, 1850.0, "BIN-PMP-B04"),  # Low stock / 7 day lead time
        ("SEAL-MECH-55C", "Cartridge Mechanical Seal 55mm SiC/SiC/Viton", "centrifugal_pump", 2, 1, 3, 620.0, "BIN-PMP-B09"),
        ("GSK-SW-316", "Spiral Wound Gasket 316SS with Graphite Fill", "centrifugal_pump", 6, 2, 1, 45.0, "BIN-PMP-B12"),
        ("VLV-THERM-71C", "Thermostatic Valve Insert 71C Wax Element", "compressor", 2, 1, 2, 380.0, "BIN-CMP-C03"),
        ("FLT-OIL-10U", "Atlas Copco 10-micron High-Efficiency Oil Filter", "compressor", 4, 2, 1, 85.0, "BIN-CMP-C07"),
        ("OIL-ROTO-20L", "Roto-Inject Fluid High-Temp Compressor Oil 20L", "compressor", 6, 3, 2, 310.0, "BIN-CMP-C11"),
        ("GR-PIN-MC4", "Helical Pinion Gear Intermediate Shaft 24T", "industrial_gearbox", 1, 1, 14, 2400.0, "BIN-GBX-D02"),
    ]
    cur.executemany(
        "INSERT INTO inventory (part_id, name, asset_type, quantity_on_hand, minimum_stock, lead_time_days, unit_cost, bin_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        inventory_data
    )

    # 3. Technicians & Shifts
    techs_data = [
        ("TECH-001", "Marcus Chen", json.dumps(["VIBRATION_CAT_II", "RIGGING_MECHANICAL", "LASER_ALIGNMENT"]), "MASTER", 85.0),
        ("TECH-002", "Sarah Jenkins", json.dumps(["HYDRAULIC_PIPING", "DYNAMIC_BALANCING", "PUMP_OVERHAUL"]), "SENIOR", 75.0),
        ("TECH-003", "David O'Connor", json.dumps(["COMPRESSOR_REFRIG", "ELECTRICAL_LOTO", "THERMOGRAPHY"]), "SENIOR", 72.0),
        ("TECH-004", "Elena Rodriguez", json.dumps(["RIGGING_MECHANICAL", "VIBRATION_CAT_I", "PREDICTIVE_MAINT"]), "JOURNEYMAN", 60.0),
    ]
    cur.executemany(
        "INSERT INTO technicians (id, name, skills, certification_level, hourly_rate) VALUES (?, ?, ?, ?, ?)",
        techs_data
    )

    shifts_data = [
        # Marcus Chen (Mon-Fri 06:00-14:30)
        ("SHF-001", "TECH-001", 0, "06:00", "14:30", 0),
        ("SHF-002", "TECH-001", 1, "06:00", "14:30", 0),
        ("SHF-003", "TECH-001", 2, "06:00", "14:30", 0),
        ("SHF-004", "TECH-001", 3, "06:00", "14:30", 0),
        ("SHF-005", "TECH-001", 4, "06:00", "14:30", 0),
        # Sarah Jenkins (Mon-Fri 14:00-22:30, Sat on call)
        ("SHF-006", "TECH-002", 0, "14:00", "22:30", 0),
        ("SHF-007", "TECH-002", 1, "14:00", "22:30", 0),
        ("SHF-008", "TECH-002", 2, "14:00", "22:30", 0),
        ("SHF-009", "TECH-002", 3, "14:00", "22:30", 0),
        ("SHF-010", "TECH-002", 4, "14:00", "22:30", 0),
        ("SHF-011", "TECH-002", 5, "08:00", "16:00", 1),
        # David O'Connor (Tue-Sat 07:00-15:30)
        ("SHF-012", "TECH-003", 1, "07:00", "15:30", 0),
        ("SHF-013", "TECH-003", 2, "07:00", "15:30", 0),
        ("SHF-014", "TECH-003", 3, "07:00", "15:30", 0),
        ("SHF-015", "TECH-003", 4, "07:00", "15:30", 0),
        ("SHF-016", "TECH-003", 5, "07:00", "15:30", 0),
        # Elena Rodriguez (Sun-Thu 22:00-06:30 Night Shift)
        ("SHF-017", "TECH-004", 0, "22:00", "06:30", 0),
        ("SHF-018", "TECH-004", 1, "22:00", "06:30", 0),
        ("SHF-019", "TECH-004", 2, "22:00", "06:30", 0),
        ("SHF-020", "TECH-004", 3, "22:00", "06:30", 0),
        ("SHF-021", "TECH-004", 6, "22:00", "06:30", 0),
    ]
    cur.executemany(
        "INSERT INTO shifts (id, technician_id, day_of_week, shift_start, shift_end, is_on_call) VALUES (?, ?, ?, ?, ?, ?)",
        shifts_data
    )

    # 4. Production Calendar (Candidate Repair Windows from current reference date)
    now = datetime(2026, 10, 4, 8, 0, 0)
    windows_data = [
        # Window 1: Tomorrow Changeover (2.5 hrs) - Best short window
        ("WIN-2026-10-05-CO", "LINE_SORT_01", (now + timedelta(days=1, hours=4)).isoformat(), (now + timedelta(days=1, hours=7)).isoformat(), "CHANGEOVER", 1200.0, 0),
        # Window 2: Mid-week Scheduled Line PM (4.0 hrs) - Optimal for full bearing replacement
        ("WIN-2026-10-07-PM", "LINE_SORT_01", (now + timedelta(days=3, hours=2)).isoformat(), (now + timedelta(days=3, hours=6, minutes=30)).isoformat(), "PLANNED_DOWNTIME", 650.0, 0),
        # Window 3: Weekend Off-Peak Shift (8.0 hrs)
        ("WIN-2026-10-10-WK", "LINE_SORT_01", (now + timedelta(days=6, hours=0)).isoformat(), (now + timedelta(days=6, hours=8)).isoformat(), "OFF_PEAK", 400.0, 0),
        # Window 4: High-cost peak running time (bottleneck)
        ("WIN-2026-10-06-PEAK", "LINE_SORT_01", (now + timedelta(days=2, hours=10)).isoformat(), (now + timedelta(days=2, hours=14)).isoformat(), "RUNNING", 8750.0, 1),
        
        # Windows for pump line (LINE_CHILL_02)
        ("WIN-2026-10-08-CH", "LINE_CHILL_02", (now + timedelta(days=4, hours=1)).isoformat(), (now + timedelta(days=4, hours=7)).isoformat(), "PLANNED_DOWNTIME", 900.0, 0),
        ("WIN-2026-10-11-CH", "LINE_CHILL_02", (now + timedelta(days=7, hours=2)).isoformat(), (now + timedelta(days=7, hours=10)).isoformat(), "OFF_PEAK", 550.0, 0),

        # Windows for compressor line (LINE_AIR_01)
        ("WIN-2026-10-06-AIR", "LINE_AIR_01", (now + timedelta(days=2, hours=3)).isoformat(), (now + timedelta(days=2, hours=6)).isoformat(), "CHANGEOVER", 800.0, 0),
        ("WIN-2026-10-09-AIR", "LINE_AIR_01", (now + timedelta(days=5, hours=2)).isoformat(), (now + timedelta(days=5, hours=8)).isoformat(), "PLANNED_DOWNTIME", 600.0, 0),
    ]
    cur.executemany(
        "INSERT INTO production_calendar (id, line_id, window_start, window_end, window_type, downtime_cost_per_hr, is_bottleneck) VALUES (?, ?, ?, ?, ?, ?, ?)",
        windows_data
    )

    # 5. Maintenance History (2+ past failures per machine type)
    history_data = [
        # Conveyor Motor past incidents
        ("MH-2024-041", "M-204", "2024-04-12T09:30:00", "bearing_wear", "Replaced DE bearing with 6314-2Z/C3 and balanced rotor", 
         "Drive-end bearing showed severe inner race flaking. Vibration had escalated past 4.8 mm/s before scheduled shutdown. Re-alignment completed to 0.03mm.", "Marcus Chen", 4.2, json.dumps(["BRG-SKF-6314-C3", "SEAL-VR-70A"])),
        ("MH-2025-019", "M-204", "2025-01-28T14:15:00", "belt_slip", "Tensioned drive belt and replaced worn drive sheave", 
         "Conveyor speed was lagging by 18% during 90A parcel surges. Belt tensioner spring had lost tension. Re-tensioned to 65Hz sonic reading.", "Elena Rodriguez", 2.0, json.dumps([])),
        
        # Centrifugal Pump past incidents
        ("MH-2023-112", "P-102", "2023-10-05T11:00:00", "cavitation", "Cleaned suction strainer, cleared suction line debris, replaced impeller", 
         "Heavy cavitation caused by plastic sheet blocking suction inlet strainer. Severe pitting observed on trailing edges of impeller vanes.", "Sarah Jenkins", 6.5, json.dumps(["IMP-BA-280", "GSK-SW-316"])),
        ("MH-2024-088", "P-102", "2024-07-19T16:45:00", "mechanical_seal_leakage", "Replaced cartridge mechanical seal", 
         "Buffer fluid leakage detected at outboard gland. Silicon carbide seal faces showed thermal crazing due to temporary dry run.", "Sarah Jenkins", 3.8, json.dumps(["SEAL-MECH-55C"])),
        
        # Compressor past incidents
        ("MH-2023-094", "C-301", "2023-09-14T08:20:00", "oil_starvation_overheating", "Flushed oil cooler and replaced thermostatic bypass valve", 
         "Discharge air temperature tripped high at 108C. Thermostatic element was stuck in bypass mode, starving injection manifold of chilled oil.", "David O'Connor", 3.0, json.dumps(["VLV-THERM-71C", "OIL-ROTO-20L"])),
        ("MH-2024-150", "C-301", "2024-11-03T13:00:00", "intake_valve_leakage", "Rebuilt unloader valve and replaced diaphragm", 
         "Compressor failed to unload at 8.5 bar, causing continuous loaded cycling and elevated electrical power draw.", "David O'Connor", 2.5, json.dumps([])),
    ]
    cur.executemany(
        "INSERT INTO maintenance_history (id, asset_id, timestamp, failure_mode, corrective_action, free_text_notes, technician_name, downtime_hours, parts_replaced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        history_data
    )

    # 6. Time-Series Telemetry Generation (60 days, 1 sample every 2 hours = 720 points per asset)
    # Start date: 60 days before reference date 2026-10-04T08:00:00
    start_time = now - timedelta(days=60)
    total_steps = 720
    dt_hours = 2.0

    ground_truth = {
        "generated_at": datetime.now().isoformat(),
        "reference_now": now.isoformat(),
        "assets": {
            "M-204": {
                "asset_type": "conveyor_motor",
                "injected_fault": "bearing_wear",
                "fault_start_day": 42.0,
                "fault_start_time": (start_time + timedelta(days=42)).isoformat(),
                "failure_critical_day": 58.6,
                "failure_critical_time": (start_time + timedelta(days=58, hours=14, minutes=24)).isoformat(),
                "artifact_day": 25.0,
                "artifact_type": "load_spike_parcel_jam",
                "artifact_time": (start_time + timedelta(days=25, hours=4)).isoformat(),
                "lead_time_days_target": 16.6
            },
            "P-102": {
                "asset_type": "centrifugal_pump",
                "injected_fault": "cavitation",
                "fault_start_day": 40.0,
                "fault_start_time": (start_time + timedelta(days=40)).isoformat(),
                "failure_critical_day": 55.4,
                "failure_critical_time": (start_time + timedelta(days=55, hours=9, minutes=36)).isoformat(),
                "artifact_day": 20.0,
                "artifact_type": "sensor_dropout_packet_gap",
                "artifact_time": (start_time + timedelta(days=20, hours=10)).isoformat(),
                "lead_time_days_target": 15.4
            },
            "C-301": {
                "asset_type": "compressor",
                "injected_fault": "oil_starvation_overheating",
                "fault_start_day": 44.0,
                "fault_start_time": (start_time + timedelta(days=44)).isoformat(),
                "failure_critical_day": 59.2,
                "failure_critical_time": (start_time + timedelta(days=59, hours=4, minutes=48)).isoformat(),
                "artifact_day": 30.0,
                "artifact_type": "ambient_heatwave_transient",
                "artifact_time": (start_time + timedelta(days=30, hours=12)).isoformat(),
                "lead_time_days_target": 15.2
            }
        }
    }

    readings_batch = []

    for step in range(total_steps):
        t = start_time + timedelta(hours=step * dt_hours)
        day_frac = step * dt_hours / 24.0
        time_iso = t.isoformat()
        
        # Diurnal load cycle (sinusoid with 24h period + shift noise)
        hour_of_day = t.hour
        daily_load_factor = 0.65 + 0.30 * math.sin(2 * math.pi * (hour_of_day - 6) / 24.0) + random.uniform(-0.03, 0.03)
        daily_load_factor = max(0.2, min(1.0, daily_load_factor))

        # --- Asset 1: Conveyor Motor M-204 ---
        # Load: stator_current 20 - 110 A
        curr_load = 25.0 + daily_load_factor * 65.0 + random.gauss(0, 1.2)
        base_vib = 1.4 + (curr_load / 100.0) * 0.7 + random.gauss(0, 0.08)
        base_temp = 50.0 + (curr_load / 100.0) * 22.0 + random.gauss(0, 0.5)
        base_speed = 2.05 - (curr_load / 100.0) * 0.05 + random.gauss(0, 0.01)
        
        is_fault = 0
        is_art = 0

        # Artifact on Day 25 (step 300 to 301 = 2-4 hours): Parcel jam temporary spike
        if 25.0 <= day_frac < 25.2:
            curr_load += 42.0  # Surge to ~105A
            base_vib += 0.8    # Temporary vibration blip due to heavy load
            base_speed -= 0.3
            is_art = 1

        # Developing fault: Day 42 to Day 60 (bearing wear)
        if day_frac >= 42.0:
            fault_progression = (day_frac - 42.0) / (58.6 - 42.0)  # reaches 1.0 at day 58.6
            fault_progression = max(0.0, fault_progression)
            # Exponential growth in vibration
            vib_growth = 2.8 * (fault_progression ** 1.8)
            base_vib += vib_growth
            base_temp += 12.0 * fault_progression
            is_fault = 1

        readings_batch.append(("M-204", time_iso, "stator_current", round(curr_load, 2), round(curr_load, 2), is_fault, is_art))
        readings_batch.append(("M-204", time_iso, "vibration_rms", round(base_vib, 3), round(curr_load, 2), is_fault, is_art))
        readings_batch.append(("M-204", time_iso, "winding_temp", round(base_temp, 2), round(curr_load, 2), is_fault, is_art))
        readings_batch.append(("M-204", time_iso, "belt_speed", round(base_speed, 3), round(curr_load, 2), is_fault, is_art))

        # --- Asset 2: Centrifugal Pump P-102 ---
        # Load: flow_rate 120 - 480 m3/h
        pump_flow = 160.0 + daily_load_factor * 260.0 + random.gauss(0, 3.5)
        suction_p = 2.8 - (pump_flow / 500.0) * 0.6 + random.gauss(0, 0.03)
        discharge_p = 9.5 + (pump_flow / 500.0) * 4.8 + random.gauss(0, 0.08)
        casing_vib = 1.2 + (pump_flow / 500.0) * 0.6 + random.gauss(0, 0.04)
        impeller_rpm = 1485.0 + random.gauss(0, 2.0)

        p_fault = 0
        p_art = 0

        # Artifact on Day 20: Sensor dropout / zero communication glitch
        if 20.0 <= day_frac < 20.15:
            casing_vib = -999.0  # Missing/dropout indicator
            p_art = 1

        # Developing fault: Day 40 to 55.4 (cavitation)
        if day_frac >= 40.0:
            prog = (day_frac - 40.0) / (55.4 - 40.0)
            prog = max(0.0, prog)
            suction_p -= 1.4 * (prog ** 1.3)  # Suction drops
            casing_vib += 3.2 * (prog ** 2.0) + random.uniform(-0.15, 0.35)  # Acoustic chatter
            discharge_p -= 2.2 * prog
            p_fault = 1

        readings_batch.append(("P-102", time_iso, "flow_rate", round(pump_flow, 2), round(pump_flow, 2), p_fault, p_art))
        readings_batch.append(("P-102", time_iso, "suction_pressure", round(suction_p, 3), round(pump_flow, 2), p_fault, p_art))
        readings_batch.append(("P-102", time_iso, "discharge_pressure", round(discharge_p, 3), round(pump_flow, 2), p_fault, p_art))
        readings_batch.append(("P-102", time_iso, "casing_vibration", round(casing_vib, 3), round(pump_flow, 2), p_fault, p_art))
        readings_batch.append(("P-102", time_iso, "impeller_speed", round(impeller_rpm, 1), round(pump_flow, 2), p_fault, p_art))

        # --- Asset 3: Compressor C-301 ---
        # Load: motor_power 35 - 160 kW
        comp_power = 45.0 + daily_load_factor * 95.0 + random.gauss(0, 1.8)
        disch_temp = 72.0 + (comp_power / 160.0) * 16.0 + random.gauss(0, 0.4)
        oil_press = 5.2 - (comp_power / 160.0) * 0.4 + random.gauss(0, 0.05)
        vib_vel = 1.8 + (comp_power / 160.0) * 1.1 + random.gauss(0, 0.06)
        suct_p = 1.01 - (comp_power / 160.0) * 0.02 + random.gauss(0, 0.005)

        c_fault = 0
        c_art = 0

        # Artifact on Day 30: Ambient heatwave transient for 4 hours
        if 30.0 <= day_frac < 30.25:
            disch_temp += 8.5  # Temporary ambient shift, but oil pressure normal
            c_art = 1

        # Developing fault: Day 44 to 59.2 (oil starvation & overheating)
        if day_frac >= 44.0:
            prog = (day_frac - 44.0) / (59.2 - 44.0)
            prog = max(0.0, prog)
            disch_temp += 28.0 * (prog ** 1.5)
            oil_press -= 2.1 * (prog ** 1.2)
            vib_vel += 2.0 * prog
            c_fault = 1

        readings_batch.append(("C-301", time_iso, "motor_power", round(comp_power, 2), round(comp_power, 2), c_fault, c_art))
        readings_batch.append(("C-301", time_iso, "discharge_temp", round(disch_temp, 2), round(comp_power, 2), c_fault, c_art))
        readings_batch.append(("C-301", time_iso, "oil_pressure", round(oil_press, 3), round(comp_power, 2), c_fault, c_art))
        readings_batch.append(("C-301", time_iso, "vibration_velocity", round(vib_vel, 3), round(comp_power, 2), c_fault, c_art))
        readings_batch.append(("C-301", time_iso, "suction_pressure", round(suct_p, 3), round(comp_power, 2), c_fault, c_art))

    cur.executemany(
        "INSERT INTO readings (asset_id, timestamp, sensor_name, value, load_value, is_fault_injected, is_artifact) VALUES (?, ?, ?, ?, ?, ?, ?)",
        readings_batch
    )

    # 7. Initial Active Alerts
    initial_alerts = [
        ("ALT-M204-01", "M-204", (now - timedelta(hours=14)).isoformat(), "CRITICAL",
         "High Vibration RMS on Drive-End Bearing",
         "Vibration velocity RMS reached 4.65 mm/s (normal max 3.50 mm/s) at 78A nominal load (+46% above baseline).",
         "OPEN", json.dumps({"vibration_rms": 4.65, "baseline_expected": 2.15, "stator_current": 78.2})),
        ("ALT-P102-01", "P-102", (now - timedelta(hours=8)).isoformat(), "HIGH",
         "Acoustic Cavitation & Pressure Ratio Drop",
         "Casing vibration surging to 4.35 mm/s accompanied by 22% reduction in differential head.",
         "INVESTIGATING", json.dumps({"casing_vibration": 4.35, "suction_pressure": 1.42, "flow_rate": 340.0})),
        ("ALT-C301-01", "C-301", (now - timedelta(hours=2)).isoformat(), "HIGH",
         "Discharge Temperature Thermal Elevation",
         "Airend discharge temperature elevated to 101.4 C with oil pressure dropping to 3.12 bar.",
         "OPEN", json.dumps({"discharge_temp": 101.4, "oil_pressure": 3.12, "motor_power": 118.0})),
    ]
    cur.executemany(
        "INSERT INTO alerts (id, asset_id, timestamp, severity, title, description, status, metric_values) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        initial_alerts
    )

    # 8. Sample Work Orders
    initial_wos = [
        ("WO-2026-0881", "M-204", "RECOMMENDED", "M-204 Drive-End Bearing Replacement", 
         "Replace failing SKF 6314-C3 drive-end ball bearing before cage failure. Alignment and vibration re-test required.",
         "CRITICAL", "bearing_wear", "WIN-2026-10-07-PM", 3.5, 3250.0,
         json.dumps(["BRG-SKF-6314-C3", "SEAL-VR-70A", "LUBE-POLYREX-EM"]),
         json.dumps(["VIBRATION_CAT_II", "RIGGING_MECHANICAL"]),
         json.dumps(["LOTO-E02"]), None, (now - timedelta(hours=6)).isoformat(), None),
    ]
    cur.executemany(
        "INSERT INTO work_orders (id, asset_id, status, title, description, priority, failure_mode, recommended_window_id, estimated_downtime_hours, estimated_cost, parts_required, required_skills, safety_permits, supervisor_approved_by, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        initial_wos
    )

    conn.commit()
    conn.close()

    # Save ground truth to data/ground_truth.json
    os.makedirs("data", exist_ok=True)
    with open("data/ground_truth.json", "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)

    return ground_truth


if __name__ == "__main__":
    gt = seed_database()
    print(f"[Seed Complete] Generated deterministic database and saved ground truth to data/ground_truth.json.")
