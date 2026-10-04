import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize Google GenAI client if key is available
const aiKey = process.env.GEMINI_API_KEY || '';
const aiClient = aiKey ? new GoogleGenAI({ apiKey: aiKey }) : null;

// Helper to execute Python CLI tool bridge
function callPythonBridge(command: string, args: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      '-c',
      `
import sys, json
from core.db import get_db_connection, init_db
from core.loader import load_all_profiles
from agents.tools import ToolRegistry
from agents.orchestrator import CopilotOrchestrator
from governance.permissions import Role, ForbiddenActionException, UnauthorizedRoleException
from governance.state_machine import WorkOrderStateMachine, WorkOrderStatus
from governance.audit import AuditLogger
from detectors.evaluate import run_evaluation

action = sys.argv[1]
payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

reg = ToolRegistry()
orch = CopilotOrchestrator(reg)

if action == "list_assets":
    res = reg.tool_list_assets()
    print(json.dumps(res))
elif action == "get_health":
    res = reg.tool_get_health(payload.get("asset_id", "M-204"))
    print(json.dumps(res))
elif action == "get_signals":
    res = reg.tool_get_signals(payload.get("asset_id", "M-204"), limit=payload.get("limit", 30))
    print(json.dumps(res))
elif action == "get_alerts":
    res = reg.tool_get_open_alerts()
    print(json.dumps(res))
elif action == "generate_brief":
    brief = orch.generate_decision_brief(payload.get("asset_id", "M-204"))
    print(json.dumps(brief.to_dict()))
elif action == "chat":
    res = orch.chat_response(payload.get("query", ""), asset_id=payload.get("asset_id"))
    print(json.dumps(res))
elif action == "get_work_orders":
    res = reg.cmms.get_work_orders(asset_id=payload.get("asset_id"), status=payload.get("status"))
    print(json.dumps(res))
elif action == "approve_work_order":
    role = payload.get("actor_role", "viewer")
    name = payload.get("actor_name", "Anonymous")
    wo_id = payload.get("work_order_id")
    target_status = payload.get("decision", "APPROVED")
    justification = payload.get("justification", "Approved by supervisor")

    sm = WorkOrderStateMachine()
    try:
        # Check authority
        sm.transition("PENDING_APPROVAL", target_status, actor_role=role, actor_name=name)
        reg.cmms.update_work_order_status(wo_id, target_status, role, name)
        reg.audit.append_log(role, name, "approve_work_order", {"work_order_id": wo_id, "decision": target_status, "justification": justification})
        print(json.dumps({"success": True, "new_status": target_status, "message": f"Work order {wo_id} transitioned to {target_status} by {name}."}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
elif action == "closeout_work_order":
    role = payload.get("actor_role", "technician")
    name = payload.get("actor_name", "Field Technician")
    wo_id = payload.get("work_order_id")
    acc = payload.get("diagnosis_accuracy", "CONFIRMED")
    actual_fm = payload.get("actual_failure_mode", "bearing_wear")
    downtime = float(payload.get("actual_downtime_hours", 3.5))
    notes = payload.get("notes", "")

    sm = WorkOrderStateMachine()
    try:
        sm.transition("WORK_ORDER_CREATED", "CLOSED", actor_role=role, actor_name=name)
        reg.cmms.update_work_order_status(wo_id, "CLOSED", role, name)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO feedback (id, work_order_id, technician_id, diagnosis_accuracy, actual_failure_mode, actual_downtime_hours, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            (f"FB-{wo_id}", wo_id, name, acc, actual_fm, downtime, notes)
        )
        conn.commit()
        conn.close()
        reg.audit.append_log(role, name, "closeout_work_order", {"work_order_id": wo_id, "accuracy": acc, "downtime": downtime})
        print(json.dumps({"success": True, "new_status": "CLOSED", "message": f"Work order {wo_id} closed successfully."}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
elif action == "get_metrics":
    if os.path.exists("data/metrics.json"):
        with open("data/metrics.json", "r") as f:
            print(f.read())
    else:
        m = run_evaluation()
        print(json.dumps(m))
elif action == "get_audit":
    res = reg.audit.verify_chain()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM audit_log ORDER BY sequence_num DESC LIMIT 50")
    entries = [dict(r) for r in cur.fetchall()]
    conn.close()
    for e in entries:
        try:
            e["payload"] = json.loads(e["payload"])
        except Exception:
            pass
    print(json.dumps({"verification": res, "entries": entries}))
elif action == "verify_audit":
    res = reg.audit.verify_chain()
    print(json.dumps(res))
else:
    print(json.dumps({"error": f"Unknown action {action}"}))
`,
      command,
      JSON.stringify(args)
    ]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0 && !output) {
        return reject(new Error(errorOutput || `Python exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(output.trim());
        resolve(parsed);
      } catch (err) {
        resolve({ raw: output, error: errorOutput });
      }
    });
  });
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// GET /api/assets
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await callPythonBridge('list_assets');
    res.json({ success: true, assets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assets/:id/health
app.get('/api/assets/:id/health', async (req, res) => {
  try {
    const health = await callPythonBridge('get_health', { asset_id: req.params.id });
    const signals = await callPythonBridge('get_signals', { asset_id: req.params.id, limit: 30 });
    res.json({ success: true, health, signals: signals.signals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await callPythonBridge('get_alerts');
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/investigate/:asset_id
app.post('/api/investigate/:asset_id', async (req, res) => {
  try {
    const brief = await callPythonBridge('generate_brief', { asset_id: req.params.asset_id });
    res.json({ success: true, brief });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/briefs/:id
app.get('/api/briefs/:id', async (req, res) => {
  try {
    const assetId = req.params.id.startsWith('DB-') ? req.params.id.split('-')[1] : req.params.id;
    const brief = await callPythonBridge('generate_brief', { asset_id: assetId });
    res.json({ success: true, brief });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { query, asset_id } = req.body;
    const chatResult = await callPythonBridge('chat', { query, asset_id: asset_id || 'M-204' });
    res.json({ success: true, ...chatResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/work-orders
app.get('/api/work-orders', async (req, res) => {
  try {
    const workOrders = await callPythonBridge('get_work_orders', {
      asset_id: req.query.asset_id as string,
      status: req.query.status as string,
    });
    res.json({ success: true, work_orders: workOrders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/approve (Supervisor only)
app.post('/api/approve', async (req, res) => {
  try {
    const { work_order_id, decision, actor_role, actor_name, justification } = req.body;
    
    // Strict governance enforcement
    if (actor_role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: `[GOVERNANCE PERMISSION DENIED] Only role 'supervisor' can authorize state '${decision}'. Actor role '${actor_role}' rejected.`
      });
    }

    const result = await callPythonBridge('approve_work_order', {
      work_order_id,
      decision: decision || 'APPROVED',
      actor_role,
      actor_name: actor_name || 'Shift Supervisor',
      justification: justification || 'Reviewed and authorized based on RUL window analysis.'
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/closeout (Technician or supervisor only)
app.post('/api/closeout', async (req, res) => {
  try {
    const { work_order_id, actor_role, actor_name, diagnosis_accuracy, actual_failure_mode, actual_downtime_hours, notes } = req.body;

    if (actor_role !== 'technician' && actor_role !== 'supervisor') {
      return res.status(403).json({
        success: false,
        error: `[GOVERNANCE PERMISSION DENIED] Closing a work order requires technician or supervisor role. Got '${actor_role}'.`
      });
    }

    const result = await callPythonBridge('closeout_work_order', {
      work_order_id,
      actor_role,
      actor_name: actor_name || 'Field Technician',
      diagnosis_accuracy: diagnosis_accuracy || 'CONFIRMED',
      actual_failure_mode,
      actual_downtime_hours,
      notes
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await callPythonBridge('get_metrics');
    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/audit
app.get('/api/audit', async (req, res) => {
  try {
    const auditData = await callPythonBridge('get_audit');
    res.json({ success: true, ...auditData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/audit/verify
app.post('/api/audit/verify', async (req, res) => {
  try {
    const verification = await callPythonBridge('verify_audit');
    res.json({ success: true, verification });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// VITE DEVELOPMENT MIDDLEWARE / PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[MaintainCopilot] Industrial Copilot Server running on http://localhost:${PORT}`);
  });
}

startServer();
