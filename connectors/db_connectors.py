"""
Database-backed implementations of Connector interfaces.
Reads and writes to the MaintainCopilot SQLite database.
"""
import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from connectors.interfaces import SensorSource, CMMSClient, ERPClient, ScheduleClient
from core.db import get_db_connection


class DBSensorSource(SensorSource):
    def __init__(self, db_path: str = "data/maintain_copilot.db"):
        self.db_path = db_path

    def get_readings(
        self,
        asset_id: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        sensor_name: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        
        query = "SELECT id, asset_id, timestamp, sensor_name, value, load_value, is_fault_injected, is_artifact FROM readings WHERE asset_id = ?"
        params: List[Any] = [asset_id]

        if sensor_name:
            query += " AND sensor_name = ?"
            params.append(sensor_name)
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time)

        query += " ORDER BY timestamp ASC LIMIT ?"
        params.append(limit)

        cur.execute(query, params)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def get_latest_reading(self, asset_id: str, sensor_name: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT id, asset_id, timestamp, sensor_name, value, load_value FROM readings WHERE asset_id = ? AND sensor_name = ? ORDER BY timestamp DESC LIMIT 1",
            (asset_id, sensor_name)
        )
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None


class DBCMMSClient(CMMSClient):
    def __init__(self, db_path: str = "data/maintain_copilot.db"):
        self.db_path = db_path

    def get_maintenance_history(self, asset_id: str) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT id, asset_id, timestamp, failure_mode, corrective_action, free_text_notes, technician_name, downtime_hours, parts_replaced FROM maintenance_history WHERE asset_id = ? ORDER BY timestamp DESC",
            (asset_id,)
        )
        res = []
        for r in cur.fetchall():
            d = dict(r)
            d["parts_replaced"] = json.loads(d["parts_replaced"]) if d["parts_replaced"] else []
            res.append(d)
        conn.close()
        return res

    def get_work_orders(self, asset_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        query = "SELECT * FROM work_orders WHERE 1=1"
        params: List[Any] = []
        if asset_id:
            query += " AND asset_id = ?"
            params.append(asset_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC"
        cur.execute(query, params)
        wos = []
        for r in cur.fetchall():
            d = dict(r)
            d["parts_required"] = json.loads(d["parts_required"]) if d.get("parts_required") else []
            d["required_skills"] = json.loads(d["required_skills"]) if d.get("required_skills") else []
            d["safety_permits"] = json.loads(d["safety_permits"]) if d.get("safety_permits") else []
            wos.append(d)
        conn.close()
        return wos

    def create_work_order(self, wo_data: Dict[str, Any]) -> str:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        wo_id = wo_data.get("id") or f"WO-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        cur.execute(
            """INSERT INTO work_orders 
               (id, asset_id, status, title, description, priority, failure_mode, recommended_window_id, estimated_downtime_hours, estimated_cost, parts_required, required_skills, safety_permits, supervisor_approved_by, created_at, closed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                wo_id,
                wo_data["asset_id"],
                wo_data.get("status", "RECOMMENDED"),
                wo_data["title"],
                wo_data.get("description", ""),
                wo_data.get("priority", "HIGH"),
                wo_data.get("failure_mode", ""),
                wo_data.get("recommended_window_id"),
                float(wo_data.get("estimated_downtime_hours", 2.0)),
                float(wo_data.get("estimated_cost", 1000.0)),
                json.dumps(wo_data.get("parts_required", [])),
                json.dumps(wo_data.get("required_skills", [])),
                json.dumps(wo_data.get("safety_permits", [])),
                wo_data.get("supervisor_approved_by"),
                wo_data.get("created_at", datetime.now().isoformat()),
                wo_data.get("closed_at")
            )
        )
        conn.commit()
        conn.close()
        return wo_id

    def update_work_order_status(self, wo_id: str, new_status: str, actor_role: str, actor_name: str) -> bool:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("UPDATE work_orders SET status = ? WHERE id = ?", (new_status, wo_id))
        updated = cur.rowcount > 0
        conn.commit()
        conn.close()
        return updated


class DBERPClient(ERPClient):
    def __init__(self, db_path: str = "data/maintain_copilot.db"):
        self.db_path = db_path

    def get_part_stock(self, part_id: str) -> Optional[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT * FROM inventory WHERE part_id = ?", (part_id,))
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    def check_parts_availability(self, part_ids: List[str]) -> Dict[str, Any]:
        if not part_ids:
            return {"all_available": True, "parts": [], "max_lead_time_days": 0, "total_cost": 0.0}

        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(part_ids))
        cur.execute(f"SELECT * FROM inventory WHERE part_id IN ({placeholders})", part_ids)
        rows = {r["part_id"]: dict(r) for r in cur.fetchall()}
        conn.close()

        parts_list = []
        all_avail = True
        max_lead = 0
        total_cost = 0.0

        for pid in part_ids:
            if pid in rows:
                p = rows[pid]
                in_stock = p["quantity_on_hand"] > 0
                if not in_stock:
                    all_avail = False
                    max_lead = max(max_lead, p["lead_time_days"])
                total_cost += p["unit_cost"]
                parts_list.append({
                    "part_id": pid,
                    "name": p["name"],
                    "in_stock": in_stock,
                    "quantity_on_hand": p["quantity_on_hand"],
                    "lead_time_days": p["lead_time_days"] if not in_stock else 0,
                    "unit_cost": p["unit_cost"]
                })
            else:
                all_avail = False
                max_lead = max(max_lead, 14)  # Unknown part default lead time
                parts_list.append({
                    "part_id": pid,
                    "name": "Unknown Part",
                    "in_stock": False,
                    "quantity_on_hand": 0,
                    "lead_time_days": 14,
                    "unit_cost": 0.0
                })

        return {
            "all_available": all_avail,
            "parts": parts_list,
            "max_lead_time_days": max_lead,
            "total_cost": total_cost
        }


class DBScheduleClient(ScheduleClient):
    def __init__(self, db_path: str = "data/maintain_copilot.db"):
        self.db_path = db_path

    def get_candidate_windows(self, line_id: str, horizon_days: int = 14) -> List[Dict[str, Any]]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM production_calendar WHERE line_id = ? ORDER BY window_start ASC",
            (line_id,)
        )
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows

    def get_available_crew(self, window_start: str, window_end: str, required_skills: List[str]) -> Dict[str, Any]:
        conn = get_db_connection(self.db_path)
        cur = conn.cursor()
        cur.execute("SELECT id, name, skills, certification_level, hourly_rate FROM technicians")
        techs = []
        for r in cur.fetchall():
            t = dict(r)
            t["skills"] = json.loads(t["skills"]) if t.get("skills") else []
            techs.append(t)
        conn.close()

        qualified = []
        for t in techs:
            has_skills = any(skill in t["skills"] for skill in required_skills) if required_skills else True
            if has_skills:
                qualified.append(t)

        return {
            "crew_available": len(qualified) > 0,
            "qualified_count": len(qualified),
            "technicians": qualified
        }
