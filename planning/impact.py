"""
Impact Estimator: Computes financial and operational impact of failure-now vs planned repair.
Deterministic numbers only.
"""
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class CostComparison:
    planned_repair_cost: float
    catastrophic_failure_cost: float
    cost_savings: float
    planned_downtime_hours: float
    catastrophic_downtime_hours: float
    downtime_cost_per_hr: float
    is_bottleneck: bool
    breakdown_planned: Dict[str, float]
    breakdown_catastrophic: Dict[str, float]


class ImpactEstimator:
    def __init__(self, default_cost_per_hr: float = 3500.0, bottleneck_mult: float = 2.5):
        self.default_cost_per_hr = default_cost_per_hr
        self.bottleneck_mult = bottleneck_mult

    def estimate_impact(
        self,
        planned_duration_hours: float,
        parts_cost: float,
        downtime_cost_per_hr: float = 3500.0,
        is_bottleneck: bool = False,
        criticality_class: str = "A"
    ) -> CostComparison:
        rate = downtime_cost_per_hr if downtime_cost_per_hr > 0 else self.default_cost_per_hr
        if is_bottleneck:
            rate *= self.bottleneck_mult

        # Planned repair costs
        planned_downtime_cost = planned_duration_hours * rate
        planned_labor = planned_duration_hours * 2 * 85.0  # 2 techs @ $85/hr
        planned_total = planned_downtime_cost + parts_cost + planned_labor

        # Unplanned catastrophic failure consequences:
        # 1. 3.5x longer downtime (clearing jammed line, emergency response, expediting)
        # 2. 2.5x parts cost (secondary damage: bent shaft, ruined seals, motor rewind)
        # 3. Emergency premium labor (overtime weekend callouts @ 2x rate)
        cat_downtime_hours = planned_duration_hours * 3.5
        if criticality_class == "A":
            cat_downtime_hours = max(12.0, cat_downtime_hours)

        cat_downtime_cost = cat_downtime_hours * rate
        cat_parts_cost = parts_cost * 2.8 + 1200.0  # Secondary damage
        cat_labor = cat_downtime_hours * 2 * 170.0  # Overtime rates
        cat_total = cat_downtime_cost + cat_parts_cost + cat_labor

        return CostComparison(
            planned_repair_cost=round(planned_total, 2),
            catastrophic_failure_cost=round(cat_total, 2),
            cost_savings=round(cat_total - planned_total, 2),
            planned_downtime_hours=planned_duration_hours,
            catastrophic_downtime_hours=round(cat_downtime_hours, 1),
            downtime_cost_per_hr=rate,
            is_bottleneck=is_bottleneck,
            breakdown_planned={
                "downtime_loss": round(planned_downtime_cost, 2),
                "parts_cost": round(parts_cost, 2),
                "labor_cost": round(planned_labor, 2)
            },
            breakdown_catastrophic={
                "downtime_loss": round(cat_downtime_cost, 2),
                "secondary_damage_parts": round(cat_parts_cost, 2),
                "emergency_overtime_labor": round(cat_labor, 2)
            }
        )
