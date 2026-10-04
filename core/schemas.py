"""
AssetProfile schema and validation definitions.
Asset-agnostic: machine knowledge lives strictly in YAML profiles and plugins.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Tuple, Optional


class CriticalityClass(str, Enum):
    A = "A"  # Unplanned downtime halts entire production line
    B = "B"  # Degraded production or buffer line capacity
    C = "C"  # Non-bottleneck auxiliary equipment


@dataclass
class SensorSpec:
    name: str
    unit: str
    normal_range: Tuple[float, float]
    sampling_hz: float = 1.0
    description: str = ""

    def validate(self) -> None:
        if not self.name or not isinstance(self.name, str):
            raise ValueError("SensorSpec: 'name' must be a non-empty string.")
        if not self.unit or not isinstance(self.unit, str):
            raise ValueError(f"SensorSpec [{self.name}]: 'unit' must be a non-empty string.")
        if not (isinstance(self.normal_range, (list, tuple)) and len(self.normal_range) == 2):
            raise ValueError(f"SensorSpec [{self.name}]: 'normal_range' must be a 2-element [min, max] list/tuple.")
        min_val, max_val = float(self.normal_range[0]), float(self.normal_range[1])
        if min_val > max_val:
            raise ValueError(f"SensorSpec [{self.name}]: normal_range min ({min_val}) cannot exceed max ({max_val}).")
        if self.sampling_hz <= 0:
            raise ValueError(f"SensorSpec [{self.name}]: sampling_hz must be positive.")


@dataclass
class FailureMode:
    name: str
    signature_hints: List[str]
    severity: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    primary_sensor: str
    description: str = ""

    def validate(self, known_sensors: List[str]) -> None:
        if not self.name:
            raise ValueError("FailureMode: 'name' must not be empty.")
        if not self.signature_hints or not isinstance(self.signature_hints, list):
            raise ValueError(f"FailureMode [{self.name}]: 'signature_hints' must be a non-empty list.")
        if self.primary_sensor and self.primary_sensor not in known_sensors:
            raise ValueError(
                f"FailureMode [{self.name}]: primary_sensor '{self.primary_sensor}' "
                f"not found in defined sensors {known_sensors}."
            )


@dataclass
class AssetProfile:
    asset_type: str
    criticality_class: CriticalityClass
    load_variable: str
    sensors: List[SensorSpec]
    derived_features: List[str] = field(default_factory=list)
    failure_modes: List[FailureMode] = field(default_factory=list)
    manual_references: List[str] = field(default_factory=list)
    description: str = ""

    def validate(self) -> None:
        if not self.asset_type or not isinstance(self.asset_type, str):
            raise ValueError("AssetProfile: 'asset_type' must be a non-empty string.")
        
        try:
            CriticalityClass(self.criticality_class)
        except ValueError:
            raise ValueError(f"AssetProfile [{self.asset_type}]: invalid criticality_class '{self.criticality_class}'. Must be A, B, or C.")
        
        if not self.sensors or not isinstance(self.sensors, list):
            raise ValueError(f"AssetProfile [{self.asset_type}]: 'sensors' must be a non-empty list of sensor specs.")
        
        sensor_names = []
        for s in self.sensors:
            s.validate()
            if s.name in sensor_names:
                raise ValueError(f"AssetProfile [{self.asset_type}]: duplicate sensor name '{s.name}'.")
            sensor_names.append(s.name)

        if self.load_variable and self.load_variable not in sensor_names:
            raise ValueError(
                f"AssetProfile [{self.asset_type}]: load_variable '{self.load_variable}' "
                f"is not listed among defined sensors {sensor_names}."
            )

        if not self.failure_modes or not isinstance(self.failure_modes, list):
            raise ValueError(f"AssetProfile [{self.asset_type}]: must specify at least one failure_mode.")

        for fm in self.failure_modes:
            fm.validate(sensor_names)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset_type": self.asset_type,
            "criticality_class": str(self.criticality_class),
            "load_variable": self.load_variable,
            "sensors": [
                {
                    "name": s.name,
                    "unit": s.unit,
                    "normal_range": list(s.normal_range),
                    "sampling_hz": s.sampling_hz,
                    "description": s.description
                }
                for s in self.sensors
            ],
            "derived_features": list(self.derived_features),
            "failure_modes": [
                {
                    "name": fm.name,
                    "signature_hints": list(fm.signature_hints),
                    "severity": fm.severity,
                    "primary_sensor": fm.primary_sensor,
                    "description": fm.description
                }
                for fm in self.failure_modes
            ],
            "manual_references": list(self.manual_references),
            "description": self.description,
        }
