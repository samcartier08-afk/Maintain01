# MaintainCopilot: General-Purpose Industrial Maintenance AI Copilot

MaintainCopilot is an asset-agnostic, production-grade agentic copilot for industrial machinery reliability. It delivers deterministic prognostics, strict human-in-the-loop supervisor governance, bounded RUL uncertainty ranges, and tamper-evident cryptographic audit logging.

---

## 5 Foundational Charter Principles

1. **Asset-Agnostic Core**: Core engine contains zero machine-specific heuristics. Machine knowledge resides exclusively in declarative YAML profiles (`assets/profiles/*.yaml`) and domain detector plugins.
2. **Deterministic Computation**: All numbers (anomaly scores, baseline residuals, RUL quantiles `{p10, p50, p90}`, and downtime costs) are computed by deterministic code. The LLM only reasons, explains, retrieves context, and drafts briefs.
3. **Supervisor Authority (Enforced in Code)**: The human supervisor is the sole authority for machine shutdowns, work-order creation, lockout/tagout, purchases, and closeouts. Enforced via hard permission guards, never prompts.
4. **Uncertainty Quantification**: Every prediction outputs uncertainty ranges `{p10, p50, p90}` operating days with confidence ratings (`HIGH`, `MEDIUM`, `LOW`). Single-date deterministic predictions are forbidden.
5. **Tamper-Evident Audit Logging**: Every tool execution, state transition, and human decision is hashed into an append-only SHA-256 cryptographic chain.

---

## Architecture Overview

```
maintain_copilot/
├── assets/profiles/           # Machine profiles (conveyor_motor, pump, compressor, gearbox)
├── core/                      # Schemas, YAML profile loader, database models, config
├── connectors/                # SensorSource, CMMSClient, ERPClient, ScheduleClient
├── detectors/                 # Load-normalized baseline, generic anomaly detector, fault plugins
├── prognostics/               # Continuous health index, RUL quantile estimation {p10, p50, p90}
├── knowledge/                 # Technical manuals, SOPs, delimited RAG & injection sanitization
├── planning/                  # Impact estimator, readiness checker, multi-criteria window scorer
├── governance/                # L0-L3 autonomy levels, permission guards, state machine, SHA-256 audit
├── agents/                    # Tool registry, specialists (Diagnosis, Planner, Safety Reviewer veto)
├── data/                      # 60-day deterministic generator, SQLite DB, ground truth, metrics
├── docs/                      # ARCHITECTURE.md, EVAL.md, DEMO.md, ASSUMPTIONS.md
├── tests/                     # Comprehensive test suite covering all phases & demo walkthrough
├── server.ts                  # Full-stack Express REST API + Vite middleware
└── src/                       # React 19 + Tailwind CSS precision industrial telemetry dashboard
```

---

## Quickstart & Verification Commands

### 1. Run Unit Test Suite
Executes 39 unit tests across all 10 phases:
```bash
make test
# Or: python3 -m unittest discover -s tests -p "test_*.py"
```

### 2. Seed Deterministic Database
Generates 60 days of multi-channel telemetry with progressive faults, load variation, and false-alarm artifacts:
```bash
make seed
# Or: python3 -m data.generators.seed
```

### 3. Run Automated 5-Minute Demo
Simulates full lifecycle from detection to supervisor approval, closeout, and audit verification:
```bash
make demo
# Or: python3 -m tests.demo_walkthrough
```

### 4. Launch Interactive Web Dashboard
Starts full-stack Express server on port 3000 mounting the real-time Vite dashboard:
```bash
npm run dev
# Or: make run
```

---

## How to Add a New Asset Type (Zero Core Code Changes)

MaintainCopilot is designed so that adding a 4th or 50th asset type requires **no modifications to core logic**.

1. Create a new YAML profile in `assets/profiles/your_machine.yaml`:
   ```yaml
   asset_type: "cooling_tower_fan"
   criticality_class: "A"
   load_variable: "motor_current"
   description: "Induced draft cooling tower axial fan drive"

   sensors:
     - name: "blade_pass_vibration"
       unit: "mm/s"
       normal_range: [0.8, 3.2]
       sampling_hz: 10.0
     - name: "gearbox_temp"
       unit: "deg_C"
       normal_range: [35.0, 75.0]
       sampling_hz: 0.2
     - name: "motor_current"
       unit: "A"
       normal_range: [15.0, 65.0]
       sampling_hz: 1.0

   derived_features:
     - "vibration_to_current_ratio"

   failure_modes:
     - name: "blade_imbalance"
       signature_hints: ["1X rotational vibration surge", "aerodynamic flutter"]
       severity: "CRITICAL"
       primary_sensor: "blade_pass_vibration"

   manual_references:
     - "SOP-CTF-01: Cooling Tower Blade Pitch Alignment and Dynamic Balancing"
   ```
2. Place relevant markdown manuals or SOPs into `knowledge/docs/`.
3. The baseline estimator, anomaly detector, fault plugins, and RUL engine will automatically ingest and monitor the asset. (See `tests/test_phase10_hardening.py::test_generality_zero_code_changes` for automated verification).

---

## Connecting Real SCADA, CMMS, & ERP

The mock connectors implement clean abstract interfaces defined in `connectors/interfaces.py`:

| Interface | Mock Implementation | Real Production Integration |
| :--- | :--- | :--- |
| `SensorSource` | `DBSensorSource` (SQLite) | OPC-UA client, MQTT sparkplug B, OSIsoft PI, Aveva, InfluxDB |
| `CMMSClient` | `DBCMMSClient` (SQLite) | IBM Maximo REST API, SAP PM BAPI / OData, Infor EAM |
| `ERPClient` | `DBERPClient` (SQLite) | SAP MM / NetWeaver, Oracle SCM, NetSuite Inventory API |
| `ScheduleClient` | `DBScheduleClient` (SQLite) | AspenTech, SAP PP (Production Planning), MES schedules |

To swap in a live connection:
```python
class OpcUaSensorSource(SensorSource):
    def __init__(self, endpoint_url: str):
        self.client = Client(endpoint_url)
    
    def get_readings(self, asset_id, start_time, end_time, sensor_name=None, limit=1000):
        # Read live nodes from OPC-UA server
        return live_readings
```
Pass your new client into `ToolRegistry(sensor_source=OpcUaSensorSource(...))` without altering any diagnostic, planning, or governance logic.

---

## License & Compliance
Built under strict Industrial Safety Governance Charter principles. All code and prompts enforce human supervisor authority and bounded uncertainty.
