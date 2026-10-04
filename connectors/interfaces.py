"""
Connector interfaces for SCADA/Sensors, CMMS, ERP, and Production Scheduling.
Production implementations swap out mock DB connectors with real OPC-UA, SAP, Maximo APIs.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class SensorSource(ABC):
    @abstractmethod
    def get_readings(
        self,
        asset_id: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        sensor_name: Optional[str] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_latest_reading(self, asset_id: str, sensor_name: str) -> Optional[Dict[str, Any]]:
        pass


class CMMSClient(ABC):
    @abstractmethod
    def get_maintenance_history(self, asset_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_work_orders(self, asset_id: Optional[str] = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def create_work_order(self, wo_data: Dict[str, Any]) -> str:
        pass

    @abstractmethod
    def update_work_order_status(self, wo_id: str, new_status: str, actor_role: str, actor_name: str) -> bool:
        pass


class ERPClient(ABC):
    @abstractmethod
    def get_part_stock(self, part_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def check_parts_availability(self, part_ids: List[str]) -> Dict[str, Any]:
        """Returns {all_available: bool, parts: List[Dict], max_lead_time_days: int, total_cost: float}"""
        pass


class ScheduleClient(ABC):
    @abstractmethod
    def get_candidate_windows(self, line_id: str, horizon_days: int = 14) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_available_crew(self, window_start: str, window_end: str, required_skills: List[str]) -> Dict[str, Any]:
        pass
