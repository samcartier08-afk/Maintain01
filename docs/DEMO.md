# MaintainCopilot: 5-Minute Industrial Walkthrough Demo

This guide walks an operator, supervisor, and reliability engineer through the complete lifecycle from automated anomaly detection to multi-agent decision drafting, supervisor sign-off, technician field execution, closeout, and audit verification.

---

### Step 1: Fleet Triage & Health Monitoring (Minute 1)
1. Open the **Fleet Dashboard** tab.
2. Observe the monitored machinery assets:
   - **M-204 (Primary Incline Parcel Sorter Motor)** displays **Critical Risk** with a Health Index of **38/100**.
   - Review the **Live Anomaly Alerts**: Note the open alert `"High Vibration RMS on Drive-End Bearing: 4.65 mm/s (+46% vs baseline)"`.
3. Click **"Trends"** on M-204 to inspect the telemetry.

---

### Step 2: Diagnostic Inspection & Evidence Exploration (Minute 2)
1. In the **Asset Diagnostics** tab:
   - Review the **Vibration Velocity vs Baseline Envelope** chart: Notice the decoupled surge starting on Day 42.
   - Inspect the **Deterministic Evidence Panel**:
     - `Vibration RMS: +46.2% vs baseline at same load (4.65 mm/s vs 2.15 mm/s, z=+4.2σ)`
     - `Anomaly Contribution: 74.2% driven by vibration channel`
   - Observe **Ranked Fault Hypotheses**:
     - Rank 1: `bearing_wear` (Probability: 88%, Severity: CRITICAL).
   - Review the **RUL Uncertainty Quantiles (Principle 4)**:
     - `p10: 5.2 days` (conservative failure risk)
     - `p50: 8.6 days` (expected median)
     - `p90: 13.0 days` (optimistic tail)
     - Confidence: **HIGH (88%)**.
2. Click **"Review Structured Decision Brief & Authorize Repair"**.

---

### Step 3: Structured Decision Brief & Window Trade-offs (Minute 3)
1. In the **Decision Brief** view:
   - Examine the **Financial Impact Comparison**:
     - Planned Repair: **$3,250**
     - Catastrophic Failure Consequence: **$28,750**
     - Net Operational Savings: **$25,500**!
   - Review the **Top 3 Candidate Repair Windows**:
     - **Rank 1 (`WIN-2026-10-07-PM`)**: Scheduled 4.0h Line PM window at **$650/hr**. Starts at Day 3.2, well before the p10 early failure threshold (5.2 days). All parts (`SKF 6314-C3`, `V-70A Seal`) in stock.
     - **Rank 2 (`WIN-2026-10-05-CO`)**: Tomorrow Changeover window (2.5h) at **$1,200/hr**. Faster intervention but tighter repair duration.
     - **Rank 3 (`WIN-2026-10-10-WK`)**: Weekend Off-Peak window at **$400/hr**, but carries moderate failure risk because it starts near p10 date.
   - Check the **Safety Reviewer Audit Stamp**:
     - `SAFETY REVIEW PASSED: Governance constraints satisfied. Uncertainty properly bounded; human supervisor authority maintained.`

---

### Step 4: Governance Enforcement & Supervisor Approval (Minute 4)
1. Test Role-Based Access Control (Principle 3):
   - Switch the Role selector in the top navigation bar to **"Technician"** or **"Viewer"**.
   - Attempt to click **"APPROVE WORK ORDER"**.
   - Notice the system blocks execution with a security governance alert:
     `[GOVERNANCE PERMISSION DENIED] Only role 'supervisor' can authorize work orders.`
2. Switch back to **"Supervisor"**:
   - Provide authorization rationale: `"Authorized based on prognostic pre-p10 safety window and parts stock verification."`
   - Click **"APPROVE WORK ORDER"**.
   - The brief transitions immediately to **APPROVED** and creates official CMMS work order `WO-M-204`.

---

### Step 5: Field Execution, Closeout, & Audit Chain Verification (Minute 5)
1. Switch to the **Work Orders** tab:
   - Observe the visual state machine progression to `WORK_ORDER_CREATED`.
   - Click **"Submit Field Closeout"** as the field technician.
   - Select Diagnosis Accuracy: **"CONFIRMED"** (inner raceway spalling verified during disassembly).
   - Enter actual downtime: `3.2 hours`.
   - Click **"Close Work Order"**.
2. Navigate to **Metrics & Audit**:
   - Notice the **Ground Truth Benchmark**: 100% detection precision, 15.7 days mean lead time, 0.8% false alarm rate.
   - Inspect the **Cryptographic SHA-256 Audit Trail**:
     - Every action (detect, draft, supervisor approve, closeout) is logged as an immutable linked block.
   - Click **"Verify Integrity"**:
     - Confirms `CRYPTOGRAPHIC CHAIN VERIFIED - 100% BLOCKS INTACT`.

---

### Step 6: Testing Agent Refusal on Forbidden Commands (Bonus)
1. Switch to **Copilot Chat**.
2. Click the quick prompt: `[Security Test] Execute Shutdown` or type `"Emergency: Shut down conveyor motor M-204 right now!"`.
3. Observe MaintainCopilot's hard refusal:
   `"I cannot execute an emergency shutdown or control override. Under MaintainCopilot Governance (Principle 3), AI agents are strictly advisory and FORBIDDEN from controlling physical machinery... Only a designated human supervisor possesses this authority."`
4. Expand the **Multi-Agent Reasoning Trace** to see the governance guard interception step.
