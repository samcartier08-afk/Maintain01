"""
SQLite Database Layer and Data Models for MaintainCopilot.
Provides persistent storage, transaction helpers, and typed access.
"""
import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from pathlib import Path


DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    criticality_class TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'HEALTHY',
    location TEXT NOT NULL,
    line_id TEXT NOT NULL,
    install_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    sensor_name TEXT NOT NULL,
    value REAL NOT NULL,
    load_value REAL NOT NULL,
    is_fault_injected INTEGER DEFAULT 0,
    is_artifact INTEGER DEFAULT 0,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);
CREATE INDEX IF NOT EXISTS idx_readings_asset_time ON readings(asset_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_readings_sensor ON readings(sensor_name);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    metric_values TEXT,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS maintenance_history (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    failure_mode TEXT NOT NULL,
    corrective_action TEXT NOT NULL,
    free_text_notes TEXT NOT NULL,
    technician_name TEXT NOT NULL,
    downtime_hours REAL NOT NULL,
    parts_replaced TEXT,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS inventory (
    part_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    quantity_on_hand INTEGER NOT NULL,
    minimum_stock INTEGER NOT NULL,
    lead_time_days INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    bin_location TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    skills TEXT NOT NULL,
    certification_level TEXT NOT NULL,
    hourly_rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    technician_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    shift_start TEXT NOT NULL,
    shift_end TEXT NOT NULL,
    is_on_call INTEGER DEFAULT 0,
    FOREIGN KEY(technician_id) REFERENCES technicians(id)
);

CREATE TABLE IF NOT EXISTS production_calendar (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    window_type TEXT NOT NULL,
    downtime_cost_per_hr REAL NOT NULL,
    is_bottleneck INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    failure_mode TEXT NOT NULL,
    recommended_window_id TEXT,
    estimated_downtime_hours REAL NOT NULL,
    estimated_cost REAL NOT NULL,
    parts_required TEXT NOT NULL,
    required_skills TEXT NOT NULL,
    safety_permits TEXT NOT NULL,
    supervisor_approved_by TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    FOREIGN KEY(asset_id) REFERENCES assets(id)
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    approver_role TEXT NOT NULL,
    approver_name TEXT NOT NULL,
    decision TEXT NOT NULL,
    justification TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY(work_order_id) REFERENCES work_orders(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    sequence_num INTEGER NOT NULL,
    prev_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    is_tamper_verified INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_log(sequence_num);

CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    technician_id TEXT NOT NULL,
    diagnosis_accuracy TEXT NOT NULL,
    actual_failure_mode TEXT NOT NULL,
    actual_downtime_hours REAL NOT NULL,
    notes TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY(work_order_id) REFERENCES work_orders(id)
);
"""


def get_db_connection(db_path: str = "data/maintain_copilot.db") -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = "data/maintain_copilot.db") -> None:
    conn = get_db_connection(db_path)
    with conn:
        conn.executescript(DB_SCHEMA)
    conn.close()
