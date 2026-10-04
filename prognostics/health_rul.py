"""
Prognostics: Health Index, Degradation Trend Fitting, RUL Quantiles {p10, p50, p90},
Confidence Scoring, and Concrete Evidence Generation.
Deterministic calculation only - never outputs a single-date prediction.
"""
import math
from dataclasses import dataclass
from typing import Dict, Any, List, Tuple, Optional
from core.schemas import AssetProfile
from detectors.anomaly import AnomalyReport


@dataclass
class RULPrediction:
    p10_days: float  # Conservative 90% survival threshold (early failure risk)
    p50_days: float  # Median expected days
    p90_days: float  # Optimistic 10% survival tail
    confidence_label: str  # "HIGH", "MEDIUM", "LOW"
    confidence_score: float  # 0.0 to 1.0
    critical_threshold_value: float
    current_value: float
    degradation_rate_per_day: float
    r_squared: float
    factors_affecting_confidence: List[str]


@dataclass
class HealthAssessment:
    asset_id: str
    timestamp: str
    health_index: float  # 0 to 100 (100 = brand new, <40 = degraded, <15 = critical)
    risk_level: str  # "NORMAL", "ATTENTION", "WARNING", "CRITICAL"
    rul: Optional[RULPrediction]
    key_evidence: List[str]
    concrete_deltas: List[str]


class PrognosticEngine:
    def __init__(self, profile: AssetProfile):
        self.profile = profile

    def compute_health_index(
        self,
        anomaly_report: AnomalyReport,
        max_z: float,
        critical_sensor_name: Optional[str] = None
    ) -> float:
        """
        Derives an asset health index (0 to 100) combining overall anomaly score
        and peak standardized residual z-score.
        """
        # Baseline score: 100 - (anomaly_score * 50) - (min(max_z, 6.0) * 8.0)
        penalty = (anomaly_report.overall_score * 55.0) + (min(max(0.0, max_z), 6.0) * 7.5)
        raw_health = 100.0 - penalty
        return round(max(5.0, min(100.0, raw_health)), 1)

    def estimate_rul(
        self,
        time_series_history: List[Dict[str, Any]],
        sensor_name: str,
        critical_limit: float,
        data_quality_flags: List[str]
    ) -> RULPrediction:
        """
        Fits degradation trajectory y(t) = a * exp(b * t) or linear regression on degraded points.
        Generates p10, p50, p90 operating days to failure with confidence quantification.
        """
        if len(time_series_history) < 10:
            return RULPrediction(
                p10_days=14.0, p50_days=25.0, p90_days=40.0,
                confidence_label="LOW", confidence_score=0.35,
                critical_threshold_value=critical_limit,
                current_value=0.0, degradation_rate_per_day=0.0,
                r_squared=0.0, factors_affecting_confidence=["Insufficient historical trend samples (<10)"]
            )

        # Extract (day_offset, sensor_value)
        t0 = time_series_history[0]["timestamp"]
        valid_points: List[Tuple[float, float]] = []
        
        # Estimate reference time
        for i, pt in enumerate(time_series_history):
            val = pt["value"]
            if val == -999.0 or math.isnan(val):
                continue
            # Assume constant delta T ~ 2 hours per sample = 1/12 day
            day_t = i / 12.0
            valid_points.append((day_t, val))

        if len(valid_points) < 8:
            return RULPrediction(
                p10_days=10.0, p50_days=20.0, p90_days=35.0,
                confidence_label="LOW", confidence_score=0.40,
                critical_threshold_value=critical_limit,
                current_value=valid_points[-1][1] if valid_points else 0.0,
                degradation_rate_per_day=0.0, r_squared=0.0,
                factors_affecting_confidence=["Excessive missing sensor packets in analysis window"]
            )

        # Focus on degraded segment (last 40% of observations or upward trending tail)
        tail_start = int(len(valid_points) * 0.50)
        tail_points = valid_points[tail_start:]
        current_val = tail_points[-1][1]

        # Linear fit on tail: val = slope * day_t + intercept
        n = len(tail_points)
        sx = sum(p[0] for p in tail_points)
        sy = sum(p[1] for p in tail_points)
        sxx = sum(p[0] ** 2 for p in tail_points)
        sxy = sum(p[0] * p[1] for p in tail_points)

        denom = (n * sxx - sx ** 2)
        slope = (n * sxy - sx * sy) / denom if abs(denom) > 1e-9 else 0.01
        intercept = (sy - slope * sx) / n

        # Residual variance and R^2
        y_mean = sy / n
        ss_tot = sum((p[1] - y_mean) ** 2 for p in tail_points)
        ss_res = sum((p[1] - (slope * p[0] + intercept)) ** 2 for p in tail_points)
        r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-9 else 0.50
        r_squared = max(0.0, min(0.99, r_squared))
        
        residual_std = math.sqrt(ss_res / max(1, n - 2)) if n > 2 else 0.2

        current_day = tail_points[-1][0]
        remaining_delta = critical_limit - current_val

        # If already at or past limit
        if remaining_delta <= 0:
            return RULPrediction(
                p10_days=0.5, p50_days=1.5, p90_days=3.0,
                confidence_label="HIGH", confidence_score=0.92,
                critical_threshold_value=critical_limit,
                current_value=current_val, degradation_rate_per_day=round(slope, 3),
                r_squared=r_squared,
                factors_affecting_confidence=["Asset has already exceeded critical threshold limit."]
            )

        if slope <= 0.001:
            # Stable / non-degrading signal
            p50 = 60.0
            p10 = 45.0
            p90 = 90.0
        else:
            p50 = max(0.1, remaining_delta / slope)
            # Uncertainty envelope based on residual variance and fit quality
            uncertainty_margin = (2.0 * residual_std / slope) + (p50 * (1.0 - r_squared) * 0.4)
            p10 = max(0.1, min(p50, p50 - uncertainty_margin))
            p90 = max(p50, p50 + (uncertainty_margin * 1.3))

        # Confidence assessment
        conf_factors = []
        conf_score = 0.85

        if r_squared < 0.65:
            conf_factors.append(f"Substantial fit dispersion (R2={r_squared:.2f})")
            conf_score -= 0.20
        if len(data_quality_flags) > 0:
            conf_factors.extend(data_quality_flags)
            conf_score -= 0.15 * len(data_quality_flags)
        if residual_std > 0.4:
            conf_factors.append("High high-frequency telemetry jitter on sensor channel")
            conf_score -= 0.10

        conf_score = max(0.20, min(0.95, conf_score))
        if conf_score >= 0.75:
            conf_label = "HIGH"
        elif conf_score >= 0.50:
            conf_label = "MEDIUM"
        else:
            conf_label = "LOW"

        return RULPrediction(
            p10_days=round(p10, 1),
            p50_days=round(p50, 1),
            p90_days=round(p90, 1),
            confidence_label=conf_label,
            confidence_score=round(conf_score, 2),
            critical_threshold_value=critical_limit,
            current_value=round(current_val, 2),
            degradation_rate_per_day=round(slope, 3),
            r_squared=round(r_squared, 2),
            factors_affecting_confidence=conf_factors
        )

    def generate_evidence(
        self,
        anomaly_report: AnomalyReport,
        rul_pred: Optional[RULPrediction],
        current_readings: Dict[str, float],
        expected_readings: Dict[str, float]
    ) -> List[str]:
        """Produce concrete, numerical, non-hallucinated delta statements."""
        statements = []
        for s_name, act in current_readings.items():
            if s_name in expected_readings:
                exp = expected_readings[s_name]
                pct = ((act - exp) / max(0.01, exp)) * 100.0
                z = anomaly_report.per_signal_z_scores.get(s_name, 0.0)
                if abs(pct) >= 15.0 or abs(z) >= 2.0:
                    sign = "+" if pct >= 0 else ""
                    statements.append(
                        f"{s_name.replace('_', ' ').title()}: {sign}{pct:.1f}% vs baseline "
                        f"({act:.2f} vs expected {exp:.2f}, z={z:+.1f}σ)"
                    )

        if rul_pred:
            statements.append(
                f"Prognostic RUL: {rul_pred.p10_days}-{rul_pred.p90_days} operating days "
                f"(p50={rul_pred.p50_days}d, confidence={rul_pred.confidence_label})"
            )
            statements.append(
                f"Degradation rate: +{rul_pred.degradation_rate_per_day:.3f}/day towards critical threshold {rul_pred.critical_threshold_value}"
            )

        return statements
