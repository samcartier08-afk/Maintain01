"""
Load-Normalized Baseline Estimator.
Fits baseline models (mean, slope, variance) on healthy operating periods to decouple
normal operational load fluctuations from genuine equipment degradation.
"""
import math
from typing import Dict, Any, List, Tuple, Optional


class LoadNormalizedBaseline:
    def __init__(self, asset_type: str, load_variable: str):
        self.asset_type = asset_type
        self.load_variable = load_variable
        # Per sensor: (slope, intercept, residual_mean, residual_std)
        self.models: Dict[str, Dict[str, float]] = {}

    def fit(self, readings: List[Dict[str, Any]], healthy_max_day: float = 30.0) -> None:
        """
        Fit linear baseline model y = slope * load + intercept on healthy period.
        Stores residual standard deviation for z-score normalization.
        """
        sensor_data: Dict[str, List[Tuple[float, float]]] = {}
        for r in readings:
            if r.get("is_fault_injected", 0) == 1:
                continue
            sensor = r["sensor_name"]
            val = r["value"]
            load = r.get("load_value", 0.0)
            
            # Filter dropouts
            if val == -999.0 or math.isnan(val):
                continue
            
            if sensor not in sensor_data:
                sensor_data[sensor] = []
            sensor_data[sensor].append((load, val))

        for sensor, points in sensor_data.items():
            if len(points) < 5:
                continue
            n = len(points)
            sum_x = sum(p[0] for p in points)
            sum_y = sum(p[1] for p in points)
            sum_xx = sum(p[0] ** 2 for p in points)
            sum_xy = sum(p[0] * p[1] for p in points)

            denom = (n * sum_xx - sum_x ** 2)
            if abs(denom) > 1e-9:
                slope = (n * sum_xy - sum_x * sum_y) / denom
                intercept = (sum_y - slope * sum_x) / n
            else:
                slope = 0.0
                intercept = sum_y / n

            # Calculate residuals
            residuals = [p[1] - (slope * p[0] + intercept) for p in points]
            res_mean = sum(residuals) / len(residuals)
            res_var = sum((r - res_mean) ** 2 for r in residuals) / max(1, len(residuals) - 1)
            res_std = math.sqrt(res_var) if res_var > 1e-9 else 0.1

            self.models[sensor] = {
                "slope": slope,
                "intercept": intercept,
                "residual_mean": res_mean,
                "residual_std": res_std,
                "n_samples": n,
            }

    def predict_expected(self, sensor_name: str, load_value: float) -> float:
        """Predict expected nominal sensor value at given load."""
        if sensor_name not in self.models:
            return 0.0
        m = self.models[sensor_name]
        return m["slope"] * load_value + m["intercept"]

    def compute_residual(self, sensor_name: str, actual_value: float, load_value: float) -> Tuple[float, float]:
        """Returns (raw_residual, z_score)."""
        if sensor_name not in self.models:
            return 0.0, 0.0
        m = self.models[sensor_name]
        expected = m["slope"] * load_value + m["intercept"]
        raw_res = actual_value - expected
        z_score = (raw_res - m["residual_mean"]) / m["residual_std"]
        return raw_res, z_score
