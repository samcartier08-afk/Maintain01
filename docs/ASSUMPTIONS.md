# MaintainCopilot Assumptions and Design Decisions

## Environment & Dependency Constraints
1. **Runtime Context**: The project runs in Google AI Studio Build environment.
   - Node.js (v22+) is the primary execution and frontend hosting environment with port 3000 exposed.
   - Python 3.10+ is available in the Linux environment with full standard library (`sqlite3`, `json`, `math`, `statistics`, `hashlib`, `dataclasses`, `unittest`, `re`, `urllib`).
   - Third-party Python pip packages (like `pandas`, `sklearn`, `fastapi`) are not installed by default in this container; therefore, all Python modules are implemented with zero external dependency overhead using pure, deterministic Python standard library (providing statistical isolation-forest/z-score detectors, linear/exponential degradation models, pure YAML/JSON validators, SQLite DB layers, and cryptographic audit hashing).
   - Simultaneously, a TypeScript/Node engine with matching modular architecture powers the real-time server (`server.ts`) and interactive web dashboard in AI Studio, with 100% functional parity.

## Core Charter & Architectural Guarantees
1. **Asset Agnostic**: Core algorithms (detectors, prognostics, planning) inspect sensor names, normal ranges, and failure signatures dynamically from the Asset Profiles (`assets/profiles/*.yaml`). No machine-specific thresholds are hardcoded in core logic.
2. **Deterministic Computations**: All numbers (anomaly scores, statistical residuals, RUL percentiles p10/p50/p90, downtime costs) are computed strictly by deterministic algorithms. The LLM only explains, retrieves context, and drafts briefs.
3. **Strict Supervisor Authority**: In code, work-order status transitions to `APPROVED` or `WORK_ORDER_CREATED` require a valid supervisor role token (`supervisor`). Forbidden actions (equipment shutdown, control override, parameter change, LOTO issuance, work-order completion) raise a `ForbiddenActionError` and are permanently logged to the audit trail.
4. **Uncertainty Quantification**: Prognostics never output a single deterministic date; they return `{p10, p50, p90}` operating days alongside a confidence score (`LOW`, `MEDIUM`, `HIGH`) derived from data quality, sensor noise, and trend fit variance.
5. **Tamper-Evident Audit Trail**: Every tool execution, state change, and supervisor decision is hashed into an append-only cryptographic SHA-256 chain (`prev_hash + payload = current_hash`).
