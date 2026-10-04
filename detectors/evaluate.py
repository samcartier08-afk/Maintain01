"""
Evaluation Pipeline: Evaluates detection lead time, false alarm rate, and RUL error
against ground_truth.json, writing outputs to data/metrics.json.
"""
import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from core.loader import load_all_profiles
from connectors.db_connectors import DBSensorSource
from detectors.baseline import LoadNormalizedBaseline
from detectors.anomaly import GenericAnomalyDetector
from detectors.plugins import rank_all_hypotheses
from prognostics.health_rul import PrognosticEngine


def run_evaluation(
    db_path: str = "data/maintain_copilot.db",
    gt_path: str = "data/ground_truth.json",
    metrics_path: str = "data/metrics.json"
) -> Dict[str, Any]:
    if not os.path.exists(gt_path):
        raise FileNotFoundError(f"Ground truth file {gt_path} not found.")

    with open(gt_path, "r", encoding="utf-8") as f:
        gt = json.load(f)

    profiles = load_all_profiles("assets/profiles")
    sensor_src = DBSensorSource(db_path=db_path)

    metrics_result: Dict[str, Any] = {
        "evaluated_at": datetime.now().isoformat(),
        "summary": {
            "total_assets_evaluated": len(gt["assets"]),
            "faults_detected_before_failure": 0,
            "mean_detection_lead_time_days": 0.0,
            "overall_false_alarm_rate_pct": 0.0,
            "mean_rul_error_days": 0.0,
            "artifacts_escalated_to_critical": 0
        },
        "per_asset": {}
    }

    lead_times = []
    rul_errors = []
    false_alarms = 0
    total_healthy_samples = 0

    for asset_id, info in gt["assets"].items():
        asset_type = info["asset_type"]
        profile = profiles.get(asset_type)
        if not profile:
            continue

        # Load all readings for asset
        readings = sensor_src.get_readings(asset_id, limit=5000)
        if not readings:
            continue

        # 1. Fit baseline on healthy period (< Day 30)
        baseline = LoadNormalizedBaseline(asset_type, profile.load_variable)
        baseline.fit(readings, healthy_max_day=30.0)

        detector = GenericAnomalyDetector(baseline)
        prog_engine = PrognosticEngine(profile)

        # Group readings by timestamp
        time_groups: Dict[str, Dict[str, float]] = {}
        for r in readings:
            ts = r["timestamp"]
            if ts not in time_groups:
                time_groups[ts] = {}
            time_groups[ts][r["sensor_name"]] = r["value"]

        sorted_times = sorted(time_groups.keys())
        first_fault_detection_day: Optional[float] = None
        artifact_escalated = False
        primary_sensor = profile.failure_modes[0].primary_sensor

        sensor_history = []

        consecutive_anomaly_count = 0

        for idx, ts in enumerate(sorted_times):
            day_t = idx * 2.0 / 24.0
            signals = time_groups[ts]
            load_val = signals.get(profile.load_variable, 50.0)

            # Check dropouts
            dropouts = 1 if any(v == -999.0 for v in signals.values()) else 0
            report = detector.evaluate_sample(asset_id, ts, signals, load_val, dropouts)
            
            if primary_sensor in signals and signals[primary_sensor] != -999.0:
                sensor_history.append({"timestamp": ts, "value": signals[primary_sensor]})

            # Persistence tracking: real mechanical faults persist over multiple shifts (>= 4 intervals = 8h)
            if report.is_anomaly and report.confidence != "LOW":
                consecutive_anomaly_count += 1
            else:
                consecutive_anomaly_count = 0

            # Persistent anomaly threshold >= 4 consecutive observations (8 hours)
            is_persistent_fault = consecutive_anomaly_count >= 4

            # Check healthy period false alarm (day 5 to 35, excluding artifact day)
            is_artifact_period = abs(day_t - info["artifact_day"]) < 0.5
            if day_t < info["fault_start_day"]:
                if not is_artifact_period:
                    total_healthy_samples += 1
                    if is_persistent_fault:
                        false_alarms += 1
                else:
                    # An artifact should NOT escalate to a persistent critical fault
                    if is_persistent_fault and report.overall_score > 0.85:
                        artifact_escalated = True

            # Check fault detection
            if day_t >= info["fault_start_day"] and is_persistent_fault:
                if first_fault_detection_day is None:
                    first_fault_detection_day = day_t

        # RUL estimation at Day 50
        crit_threshold = profile.sensors[0].normal_range[1] * 1.3
        for s in profile.sensors:
            if s.name == primary_sensor:
                crit_threshold = s.normal_range[1] * 1.3

        rul_pred = prog_engine.estimate_rul(sensor_history, primary_sensor, crit_threshold, [])

        # Evaluation metrics for asset
        actual_failure_day = info["failure_critical_day"]
        lead_time = (actual_failure_day - first_fault_detection_day) if first_fault_detection_day else 0.0
        
        # Ground truth RUL from Day 50 to failure: actual_failure_day - 50.0
        ground_truth_rul_at_day_50 = max(0.5, actual_failure_day - 50.0)
        rul_error = abs(rul_pred.p50_days - ground_truth_rul_at_day_50)

        if first_fault_detection_day and first_fault_detection_day < actual_failure_day:
            metrics_result["summary"]["faults_detected_before_failure"] += 1
            lead_times.append(lead_time)
            rul_errors.append(rul_error)

        if artifact_escalated:
            metrics_result["summary"]["artifacts_escalated_to_critical"] += 1

        metrics_result["per_asset"][asset_id] = {
            "asset_type": asset_type,
            "fault_detected": first_fault_detection_day is not None,
            "first_detection_day": round(first_fault_detection_day, 1) if first_fault_detection_day else None,
            "actual_failure_day": actual_failure_day,
            "detection_lead_time_days": round(lead_time, 1),
            "target_lead_time_days": info["lead_time_days_target"],
            "rul_predicted_p10_p50_p90": [rul_pred.p10_days, rul_pred.p50_days, rul_pred.p90_days],
            "rul_error_days": round(rul_error, 1),
            "rul_confidence": rul_pred.confidence_label,
            "artifact_escalated": artifact_escalated,
            "artifact_handled_cleanly": not artifact_escalated
        }

    # Summary aggregations
    metrics_result["summary"]["mean_detection_lead_time_days"] = (
        round(sum(lead_times) / len(lead_times), 1) if lead_times else 0.0
    )
    metrics_result["summary"]["mean_rul_error_days"] = (
        round(sum(rul_errors) / len(rul_errors), 1) if rul_errors else 0.0
    )
    metrics_result["summary"]["overall_false_alarm_rate_pct"] = (
        round((false_alarms / max(1, total_healthy_samples)) * 100.0, 2)
    )

    # Save to metrics.json
    os.makedirs(os.path.dirname(metrics_path), exist_ok=True)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_result, f, indent=2)

    return metrics_result


if __name__ == "__main__":
    res = run_evaluation()
    print("[Evaluation Complete] Metrics:", json.dumps(res["summary"], indent=2))
