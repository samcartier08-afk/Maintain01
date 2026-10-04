# MaintainCopilot System Architecture

```mermaid
graph TD
    subgraph Data Layer
        P[Asset YAML Profiles] --> |Schema Validation| Core[Core Config & Registry]
        Sensors[(Sensor Telemetry Readings)] --> Conn[SensorSource Connector]
        CMMS[(CMMS Work Orders & History)] --> ConnCMMS[CMMSClient Connector]
        ERP[(ERP Spare Parts Inventory)] --> ConnERP[ERPClient Connector]
        Sched[(Production Schedule & Changeovers)] --> ConnSched[ScheduleClient Connector]
    end

    subgraph Deterministic Engine [No LLM - Math & Logic Only]
        Conn --> Base[Load-Normalized Baseline Estimator]
        Base --> Det[Generic Anomaly Detector: Residual Z-Score + Anomaly Scoring]
        Det --> Plugins[FaultDetector Plugins: Vibration, Thermal, Pressure/Flow]
        Plugins --> Prog[Prognostics: Health Index & RUL Estimator p10/p50/p90]
        Prog --> Evidence[Evidence Delta Builder: e.g. RMS +42% vs Baseline]
        
        ConnERP & ConnSched & Prog --> Plan[Planning Engine]
        Plan --> Impact[Downtime Impact Estimator]
        Plan --> Ready[Readiness Checker: Parts, Lead Time, Crew Skills]
        Plan --> Windows[Candidate Repair Window Scorer: Top 3 with Trade-offs]
    end

    subgraph Knowledge & RAG [Untrusted Data Boundary]
        Docs[Manuals, SOPs, Historical Notes] --> Chroma[Knowledge Store / Vector Store]
        Chroma --> Sanitize[Sanitization & Delimiter Boundary Layer]
        Sanitize --> Search[search_knowledge & get_similar_failures]
    end

    subgraph Governance & Safety Layer [Enforced In Code]
        Perms[Central Action Allowlist & Forbidden Rule Engine]
        Roles[RBAC: Supervisor, Technician, Viewer]
        StateMachine[Work Order State Machine: DETECTED -> INVESTIGATING -> RECOMMENDED -> PENDING_APPROVAL -> APPROVED -> WORK_ORDER_CREATED -> CLOSED]
        Audit[Append-Only SHA-256 Tamper-Evident Hash Chain Log]
        Perms --> StateMachine
        Roles --> StateMachine
        StateMachine --> Audit
    end

    subgraph Agentic Orchestration [Anthropic / Gemini Tool Use]
        Orch[Multi-Agent Orchestrator]
        Diag[Specialist: Diagnosis Agent]
        PlanAgent[Specialist: Planning Agent]
        SafetyRev[Specialist: Safety Reviewer - Independent VETO Power]
        
        Orch --> Diag
        Orch --> PlanAgent
        Orch --> SafetyRev
        
        Diag --> |Tool Calls| Det
        Diag --> |Tool Calls| Search
        PlanAgent --> |Tool Calls| Windows
        PlanAgent --> |Tool Calls| Ready
        SafetyRev --> |Validate Constraints| Perms
        
        Orch --> Brief[Structured Pydantic Decision Brief]
    end

    subgraph Presentation & Control
        API[FastAPI / Express REST API]
        UI[Precision Industrial Telemetry & Copilot UI]
        API --> Orch
        API --> StateMachine
        API --> Audit
        UI --> API
    end
```

## Core Subsystems
1. **Asset Profiles (`assets/profiles/`)**: Machine specifications with sensor normal ranges, sampling rates, derived features, failure modes, criticality classes, and reference manuals.
2. **Deterministic Processing (`detectors/`, `prognostics/`, `planning/`)**: Computes quantitative metrics without hallucination risk.
3. **Knowledge Retrieval (`knowledge/`)**: Strips command instructions, treats all technical manuals as untrusted DATA, wraps outputs in strict XML/markdown delimiters.
4. **Governance (`governance/`)**: The human supervisor is the single point of authority for state transition into APPROVED and WORK_ORDER_CREATED. Shuts downs and overrides are hard-blocked for AI agents.
5. **Multi-Agent Orchestrator (`agents/`)**: Executes structured tool calls, generates reasoning traces, and subjects briefs to an independent Safety Reviewer veto.
6. **Audit & Traceability (`governance/audit.py`)**: Every input, tool call, model version, and human decision forms an immutable hash-chained block.
