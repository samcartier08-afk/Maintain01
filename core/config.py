"""
Configuration and Environment Settings for MaintainCopilot.
"""
import os
from dataclasses import dataclass


@dataclass
class MaintainCopilotConfig:
    # Site autonomy level: L0 (Advisory Only), L1 (Assisted Triage), L2 (Draft Only - Default), L3 (Autonomous Execution - Supervisor Override Still Required)
    autonomy_level: str = "L2"
    
    # Model configuration
    llm_provider: str = "gemini"  # or "anthropic"
    model_name: str = "models/gemini-2.5-flash"
    api_key: str = ""
    
    # Database and paths
    db_path: str = "data/maintain_copilot.db"
    profiles_dir: str = "assets/profiles"
    data_dir: str = "data"
    audit_chain_path: str = "data/audit_chain.json"
    metrics_path: str = "data/metrics.json"
    ground_truth_path: str = "data/ground_truth.json"
    
    # Cost parameters
    default_downtime_cost_per_hr: float = 3500.0
    bottleneck_multiplier: float = 2.5
    
    def __post_init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", os.getenv("ANTHROPIC_API_KEY", ""))
        self.autonomy_level = os.getenv("AUTONOMY_LEVEL", self.autonomy_level)


def get_config() -> MaintainCopilotConfig:
    return MaintainCopilotConfig()
