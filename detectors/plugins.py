"""
FaultDetector plugin interface and domain plugins (Vibration, Thermal, Pressure/Flow).
Generates ranked hypotheses with concrete numerical evidence without LLM.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from core.schemas import AssetProfile
from detectors.anomaly import AnomalyReport
from detectors.baseline import LoadNormalizedBaseline


@dataclass
class FaultHypothesis:
    failure_mode: str
    probability: float  # 0.0 to 1.0
    severity: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    primary_sensor: str
    evidence: List[str]
    recommended_inspection: str


class FaultDetectorPlugin(ABC):
    @abstractmethod
    def can_handle(self, profile: AssetProfile) -> bool:
        pass

    @abstractmethod
    def evaluate(
        self,
        profile: AssetProfile,
        anomaly_report: AnomalyReport,
        baseline: LoadNormalizedBaseline,
        recent_readings: Dict[str, float],
        load_value: float
    ) -> List[FaultHypothesis]:
        pass


class VibrationFaultDetector(FaultDetectorPlugin):
    """Detects mechanical rotating faults: bearing wear, unbalance, gear mesh spalling."""
    VIB_SENSORS = ["vibration_rms", "casing_vibration", "vibration_velocity", "gear_mesh_vibration"]

    def can_handle(self, profile: AssetProfile) -> bool:
        return any(s.name in self.VIB_SENSORS for s in profile.sensors)

    def evaluate(
        self,
        profile: AssetProfile,
        anomaly_report: AnomalyReport,
        baseline: LoadNormalizedBaseline,
        recent_readings: Dict[str, float],
        load_value: float
    ) -> List[FaultHypothesis]:
        hypotheses = []
        for s_name in self.VIB_SENSORS:
            if s_name not in recent_readings:
                continue
            
            actual_val = recent_readings[s_name]
            expected_val = baseline.predict_expected(s_name, load_value)
            pct_delta = ((actual_val - expected_val) / max(0.1, expected_val)) * 100.0
            z_score = anomaly_report.per_signal_z_scores.get(s_name, 0.0)

            # Check for bearing wear / unbalance
            if z_score >= 2.5:
                prob = min(0.95, 0.50 + (z_score - 2.5) * 0.12)
                fm_name = "bearing_wear"
                # If pump, could be cavitation
                if profile.asset_type == "centrifugal_pump":
                    fm_name = "cavitation"
                elif profile.asset_type == "industrial_gearbox":
                    fm_name = "gear_tooth_pitting"

                evidence = [
                    f"{s_name} is +{pct_delta:.1f}% above load-normalized baseline ({actual_val:.2f} vs expected {expected_val:.2f})",
                    f"Statistical residual z-score: +{z_score:.2f} sigma outside normal healthy envelope",
                    f"Sensor contribution accounts for {anomaly_report.signal_contributions.get(s_name, 0):.1f}% of total anomaly energy",
                ]
                
                # Check for secondary thermal symptom
                temp_sensor = next((s.name for s in profile.sensors if "temp" in s.name), None)
                if temp_sensor and temp_sensor in recent_readings:
                    t_z = anomaly_report.per_signal_z_scores.get(temp_sensor, 0.0)
                    if t_z > 1.5:
                        evidence.append(f"Corroborating friction heating on {temp_sensor} (z=+{t_z:.1f})")

                hypotheses.append(
                    FaultHypothesis(
                        failure_mode=fm_name,
                        probability=round(prob, 2),
                        severity="CRITICAL" if z_score >= 3.5 else "HIGH",
                        primary_sensor=s_name,
                        evidence=evidence,
                        recommended_inspection="Perform high-frequency demodulation analysis and inspect drive-end bearing raceway for spalling."
                    )
                )

        return hypotheses


class ThermalFaultDetector(FaultDetectorPlugin):
    """Detects cooling failures, insulation breakdown, and lubrication starvation."""
    TEMP_SENSORS = ["winding_temp", "discharge_temp", "oil_sump_temp"]

    def can_handle(self, profile: AssetProfile) -> bool:
        return any(s.name in self.TEMP_SENSORS for s in profile.sensors)

    def evaluate(
        self,
        profile: AssetProfile,
        anomaly_report: AnomalyReport,
        baseline: LoadNormalizedBaseline,
        recent_readings: Dict[str, float],
        load_value: float
    ) -> List[FaultHypothesis]:
        hypotheses = []
        for s_name in self.TEMP_SENSORS:
            if s_name not in recent_readings:
                continue
            
            actual_val = recent_readings[s_name]
            expected_val = baseline.predict_expected(s_name, load_value)
            deg_delta = actual_val - expected_val
            z_score = anomaly_report.per_signal_z_scores.get(s_name, 0.0)

            if z_score >= 2.2:
                prob = min(0.92, 0.45 + (z_score - 2.2) * 0.11)
                fm_name = "winding_overheating" if "winding" in s_name else "oil_starvation_overheating"
                
                evidence = [
                    f"{s_name} is +{deg_delta:.1f} deg C above baseline at {load_value:.1f} load",
                    f"Thermal residual deviation z=+{z_score:.2f} standard deviations",
                ]

                # Check if pressure sensor dropped (classic oil starvation signature)
                p_sensor = next((s.name for s in profile.sensors if "oil_press" in s.name), None)
                if p_sensor and p_sensor in recent_readings:
                    p_val = recent_readings[p_sensor]
                    p_z = anomaly_report.per_signal_z_scores.get(p_sensor, 0.0)
                    if p_z < -1.5:
                        evidence.append(f"Coupled with drop in {p_sensor} ({p_val:.2f} bar, z={p_z:.1f})")

                hypotheses.append(
                    FaultHypothesis(
                        failure_mode=fm_name,
                        probability=round(prob, 2),
                        severity="CRITICAL" if z_score >= 3.8 else "HIGH",
                        primary_sensor=s_name,
                        evidence=evidence,
                        recommended_inspection="Inspect thermostatic valve bypass element, oil filter pressure drop, and cooling heat exchanger."
                    )
                )

        return hypotheses


class PressureFlowFaultDetector(FaultDetectorPlugin):
    """Detects hydraulic issues: cavitation, seal leakage, suction blockage."""
    P_SENSORS = ["suction_pressure", "discharge_pressure", "oil_pressure"]

    def can_handle(self, profile: AssetProfile) -> bool:
        return any(s.name in self.P_SENSORS for s in profile.sensors)

    def evaluate(
        self,
        profile: AssetProfile,
        anomaly_report: AnomalyReport,
        baseline: LoadNormalizedBaseline,
        recent_readings: Dict[str, float],
        load_value: float
    ) -> List[FaultHypothesis]:
        hypotheses = []
        if "suction_pressure" in recent_readings and profile.asset_type == "centrifugal_pump":
            suct = recent_readings["suction_pressure"]
            suct_exp = baseline.predict_expected("suction_pressure", load_value)
            suct_z = anomaly_report.per_signal_z_scores.get("suction_pressure", 0.0)

            # Cavitation check: suction drops and vibration rises
            if suct_z <= -2.0:
                casing_vib = recent_readings.get("casing_vibration", 0.0)
                vib_z = anomaly_report.per_signal_z_scores.get("casing_vibration", 0.0)
                
                evidence = [
                    f"Suction pressure dropped to {suct:.2f} bar ({suct_z:.1f} sigma below baseline {suct_exp:.2f} bar)",
                ]
                if vib_z > 2.0:
                    evidence.append(f"Induced cavitation shock vibration surging to {casing_vib:.2f} mm/s (z=+{vib_z:.1f})")

                hypotheses.append(
                    FaultHypothesis(
                        failure_mode="cavitation",
                        probability=0.88 if vib_z > 2.0 else 0.65,
                        severity="CRITICAL",
                        primary_sensor="suction_pressure",
                        evidence=evidence,
                        recommended_inspection="Inspect suction strainer for fouling, check NPSHa margin, and inspect impeller leading edge."
                    )
                )

        return hypotheses


def rank_all_hypotheses(
    profile: AssetProfile,
    anomaly_report: AnomalyReport,
    baseline: LoadNormalizedBaseline,
    recent_readings: Dict[str, float],
    load_value: float
) -> List[FaultHypothesis]:
    """Execute all matching plugins and return sorted hypotheses by probability."""
    plugins: List[FaultDetectorPlugin] = [
        VibrationFaultDetector(),
        ThermalFaultDetector(),
        PressureFlowFaultDetector(),
    ]

    all_hypo: List[FaultHypothesis] = []
    for plugin in plugins:
        if plugin.can_handle(profile):
            all_hypo.extend(plugin.evaluate(profile, anomaly_report, baseline, recent_readings, load_value))

    # Sort descending by probability
    all_hypo.sort(key=lambda h: h.probability, reverse=True)
    return all_hypo
