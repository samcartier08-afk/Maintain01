import React, { useState } from 'react';
import { DecisionBrief, Role } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  Lock, 
  HelpCircle, 
  Check, 
  X, 
  Edit2 
} from 'lucide-react';

interface DecisionBriefViewProps {
  brief: DecisionBrief | null;
  userRole: Role;
  onApprove: (briefId: string, decision: 'APPROVED' | 'EDITED' | 'POSTPONED' | 'REJECTED', justification: string) => void;
  onAskCopilot: (prompt: string, assetId?: string) => void;
  isLoading?: boolean;
}

export const DecisionBriefView: React.FC<DecisionBriefViewProps> = ({
  brief,
  userRole,
  onApprove,
  onAskCopilot,
  isLoading = false
}) => {
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [justification, setJustification] = useState<string>('Authorized based on prognostic pre-p10 safety margin and verified inventory availability.');
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  if (isLoading || !brief) {
    return (
      <div className="border border-slate-800 rounded-lg p-12 text-center space-y-3 font-mono text-xs text-slate-400">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div>Generating structured decision brief...</div>
      </div>
    );
  }

  const isSupervisor = userRole === 'supervisor';

  const handleAction = (decision: 'APPROVED' | 'EDITED' | 'POSTPONED' | 'REJECTED') => {
    if (!isSupervisor) {
      alert(`[GOVERNANCE ERROR] Role '${userRole}' is not authorized to approve work orders. Under Principle 3, only a human supervisor possesses operational sign-off authority.`);
      return;
    }
    onApprove(brief.brief_id, decision, justification);
    setActionStatus(`Action '${decision}' recorded and logged to cryptographic audit chain.`);
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Action Notification */}
      {actionStatus && (
        <div className="p-3 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {actionStatus}
          </span>
          <button onClick={() => setActionStatus(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Brief Header */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-cyan-400 font-bold font-mono">{brief.brief_id}</span>
              <span className="text-slate-600">·</span>
              <span className="text-white font-bold text-base font-sans">{brief.asset_id}: {brief.asset_name}</span>
              <span className="text-slate-600">·</span>
              <span className={brief.risk_level === 'CRITICAL' ? 'text-rose-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {brief.risk_level === 'CRITICAL' ? 'Critical Action Required' : 'Moderate Priority'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Machine Health Score: <strong>{brief.overall_health_score}/100</strong> · Requires Supervisor Sign-Off
            </div>
          </div>

          <div className="text-xs text-slate-300 flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Active Role: <strong className="text-white uppercase font-mono">{userRole}</strong></span>
          </div>
        </div>

        {/* 3 Overview Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-800/60 rounded p-px border border-slate-800/80 overflow-hidden font-sans">
          <div className="bg-slate-950 p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Diagnosed Issue</span>
            <div className="text-sm font-bold text-white">
              Motor Bearing Wear
            </div>
            <span className="text-xs text-cyan-400">
              {Math.round(brief.fault_probability * 100)}% likelihood · High confidence
            </span>
          </div>

          <div className="bg-slate-950 p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Safe Time Remaining</span>
            <div className="text-sm font-bold text-amber-300 font-mono">
              5 to 9 operating days
            </div>
            <span className="text-xs text-slate-400">Earliest failure risk: Day 5.2</span>
          </div>

          <div className="bg-slate-950 p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Net Cost Savings</span>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              Save ${brief.cost_comparison.cost_savings.toLocaleString()}
            </div>
            <span className="text-xs text-slate-400">
              Planned fix: ${brief.cost_comparison.planned_repair_cost.toLocaleString()} vs Emergency stop: ${brief.cost_comparison.catastrophic_failure_cost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Plain-English Evidence Summary */}
        <div className="space-y-1.5">
          <span className="text-xs uppercase text-slate-400 font-bold tracking-wider block font-mono">
            Sensor Findings & Physical Evidence
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {brief.concrete_evidence.map((ev, i) => (
              <div key={i} className="p-2.5 rounded bg-slate-900/40 border border-slate-800/80 text-slate-300 flex items-start gap-2">
                <span className="text-cyan-400 font-bold">▸</span>
                <span>{ev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Citations */}
        {brief.citations && brief.citations.length > 0 && (
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
            <span className="text-slate-500">Technical Manuals Referenced:</span>
            {brief.citations.map((c, i) => (
              <span key={i} className="text-cyan-400/90 underline cursor-pointer">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 Candidate Repair Windows */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3 font-sans">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block font-mono">
              Candidate Repair Windows (Ranked Options)
            </span>
            <span className="text-xs text-slate-400">
              We scored production schedules, replacement parts readiness, and downtime costs.
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {brief.top_3_windows.map((win) => {
            const isSelected = selectedWindowId === win.window_id || (!selectedWindowId && win.rank === 1);
            return (
              <div
                key={win.window_id}
                onClick={() => setSelectedWindowId(win.window_id)}
                className={`p-4 rounded border transition-colors cursor-pointer space-y-2 ${
                  isSelected 
                    ? 'border-cyan-800 bg-slate-900/60' 
                    : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-cyan-400 font-mono">#{win.rank}</span>
                    <span className="font-bold text-white font-mono">{win.window_id}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-200 font-medium">
                      {win.rank === 1 ? 'Wednesday Scheduled PM (Recommended)' : win.rank === 2 ? 'Tomorrow Changeover' : 'Saturday Weekend Shift'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-emerald-400 font-semibold font-mono">${win.cost_rate.toLocaleString()}/hr rate</span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-slate-300">Downtime: <strong>{win.duration_hours} hours</strong></span>
                    <span className={win.risk === 'LOW' ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      Risk: {win.risk === 'LOW' ? 'Low Failure Risk' : 'Moderate Failure Risk'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded border border-slate-900 leading-relaxed">
                  <strong className="text-white">Why this window: </strong>
                  {win.trade_offs}
                </div>

                <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                  <span>Parts in stock: <strong className="text-slate-200">{win.parts_ready}</strong> · Crew available: <strong className="text-slate-200">{win.crew_ready}</strong></span>
                  <span className="font-mono text-[11px] text-slate-400">Starts: {win.start.replace('T', ' ').substring(0, 16)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Falsification & Safety Reviewer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
            What Would Change This Recommendation?
          </span>
          <div className="space-y-1.5 text-xs text-slate-300">
            {brief.what_would_change_my_mind.map((m, i) => (
              <div key={i} className="p-2 rounded bg-slate-900/30 border border-slate-900 leading-normal">
                ▸ {m}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
            Safety Review & Governance
          </span>
          <div className="p-3 rounded border border-slate-800 bg-slate-900/30 text-xs space-y-2 text-slate-300 leading-relaxed">
            <div>✓ {brief.safety_reviewer_comments}</div>
            <div className="text-xs text-slate-400 border-t border-slate-800 pt-2">
              The AI assistant cannot stop machinery or create purchases. Only a human supervisor can sign off on physical repairs.
            </div>
          </div>
        </div>
      </div>

      {/* Human Supervisor Action Bar */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/80 space-y-3 font-sans">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
          <div>
            <span className="text-sm font-bold text-white block">
              Supervisor Approval & Dispatch
            </span>
            <span className="text-xs text-slate-400">
              Only users logged in as <strong>Supervisor</strong> can approve this repair plan and create the official work order.
            </span>
          </div>

          {!isSupervisor && (
            <span className="text-xs text-rose-300 bg-rose-950/50 px-2.5 py-1 rounded border border-rose-900/60 font-medium">
              Switch role to Supervisor in top-right to approve
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400 block font-medium">Supervisor Notes & Approval Reason:</label>
          <input
            type="text"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            disabled={!isSupervisor}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-700 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAction('APPROVED')}
            disabled={!isSupervisor}
            className="px-4 py-2 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve Repair Plan
          </button>

          <button
            onClick={() => handleAction('EDITED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Adjust Time / Parts
          </button>

          <button
            onClick={() => handleAction('POSTPONED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Postpone
          </button>

          <button
            onClick={() => handleAction('REJECTED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-rose-950/40 text-rose-400 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
