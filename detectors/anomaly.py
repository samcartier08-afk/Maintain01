"""
Generic Anomaly Detector for multi-channel industrial numeric telemetry.
Combines load-normalized residual z-scores with multivariate anomaly scoring
and per-sensor contribution attribution. Explicitly handles missing data & sensor dropouts.
"""
import math
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from detectors.baseline import LoadNormalizedBaseline


@dataclass
class AnomalyReport:
    asset_id: str
    timestamp: str
    overall_score: float  # 0.0 (perfectly normal) to 1.0 (severe anomaly)
    is_anomaly: bool
    per_signal_z_scores: Dict[str, float]
    per_signal_residuals: Dict[str, float]
    signal_contributions: Dict[str, float]  # Percentage contribution per sensor, sums to 100%
    data_quality_flags: List[str] = field(default_factory=list)
    confidence: str = "HIGH"  # "HIGH", "MEDIUM", "LOW"
    summary_evidence: str = ""


class GenericAnomalyDetector:
    def __init__(self, baseline: LoadNormalizedBaseline, z_threshold: float = 3.0):
        self.baseline = baseline
        self.z_threshold = z_threshold

    def evaluate_sample(
        self,
        asset_id: str,
        timestamp: str,
        current_readings: Dict[str, float],
        load_value: float,
        recent_window_dropouts: int = 0
    ) -> AnomalyReport:
        per_z: Dict[str, float] = {}
        per_res: Dict[str, float] = {}
        data_flags: List[str] = []
        confidence = "HIGH"

        # Check for sensor dropouts or missing channels
        valid_channels: Dict[str, float] = {}
        for sensor, val in current_readings.items():
            if val == -999.0 or math.isnan(val):
                data_flags.append(f"Sensor dropout/gap detected on '{sensor}' (value={val})")
                confidence = "LOW"
            else:
                valid_channels[sensor] = val

        if recent_window_dropouts > 0:
            data_flags.append(f"Recent communication packet loss ({recent_window_dropouts} dropped samples in window)")
            confidence = "MEDIUM" if confidence != "LOW" else "LOW"

        if not valid_channels:
            return AnomalyReport(
                asset_id=asset_id,
                timestamp=timestamp,
                overall_score=0.0,
                is_anomaly=False,
                per_signal_z_scores={},
                per_signal_residuals={},
                signal_contributions={},
                data_quality_flags=["All sensor channels offline/unreachable"],
                confidence="LOW",
                summary_evidence="Telemetry unavailable"
            )

        # Compute residuals & z-scores
        squared_deviations: Dict[str, float] = {}
        for sensor, val in valid_channels.items():
            raw_res, z = self.baseline.compute_residual(sensor, val, load_value)
            per_res[sensor] = round(raw_res, 3)
            per_z[sensor] = round(z, 2)
            # Focus on absolute z-score deviation above 1.5
            effective_z = max(0.0, abs(z) - 1.0)
            squared_deviations[sensor] = effective_z ** 2

        # Multivariate anomaly score via sigmoid transformation of root-mean-squared-z
        total_sq = sum(squared_deviations.values())
        rms_z = math.sqrt(total_sq / max(1, len(squared_deviations)))
        
        # Sigmoid scaling: 0 at z=1.5, 0.5 at z=3.0, >0.9 at z=5.0
        overall_score = 1.0 / (1.0 + math.exp(-1.2 * (rms_z - 2.8)))
        overall_score = round(max(0.0, min(1.0, overall_score)), 4)
        is_anomaly = overall_score >= 0.55

        # Per-signal contribution percentages
        contributions: Dict[str, float] = {}
        if total_sq > 1e-6:
            for s, sq in squared_deviations.items():
                contributions[s] = round((sq / total_sq) * 100.0, 1)
        else:
            eq_share = round(100.0 / len(valid_channels), 1)
            for s in valid_channels:
                contributions[s] = eq_share

        # Construct concise summary evidence
        top_driver = max(contributions.items(), key=lambda x: x[1]) if contributions else ("none", 0.0)
        summary_evidence = (
            f"Anomaly score {overall_score:.2f} driven by {top_driver[0]} "
            f"({contributions.get(top_driver[0], 0):.1f}% contribution, z={per_z.get(top_driver[0], 0):.1f})"
        )

        return AnomalyReport(
            asset_id=asset_id,
            timestamp=timestamp,
            overall_score=overall_score,
            is_anomaly=is_anomaly,
            per_signal_z_scores=per_z,
            per_signal_residuals=per_res,
            signal_contributions=contributions,
            data_quality_flags=data_flags,
            confidence=confidence,
            summary_evidence=summary_evidence
        )
