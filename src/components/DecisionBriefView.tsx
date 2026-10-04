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
    <div className="space-y-6 font-mono text-xs">
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
              <span className="text-cyan-400 font-bold">{brief.brief_id}</span>
              <span className="text-slate-600">·</span>
              <span className="text-white font-bold text-sm font-sans">{brief.asset_id}: {brief.asset_name}</span>
              <span className="text-slate-600">·</span>
              <span className={brief.risk_level === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}>
                {brief.risk_level} Risk
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Class {brief.criticality_class} · Health Score: {brief.overall_health_score}/100 · Human Decision Required
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <Lock className="w-3 h-3 text-cyan-400" />
            <span>Role: <strong className="text-white uppercase">{userRole}</strong></span>
          </div>
        </div>

        {/* 3 Metric Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-800/60 rounded p-px border border-slate-800/80 overflow-hidden">
          <div className="bg-slate-950 p-3 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase">Primary Diagnosis</span>
            <div className="text-sm font-bold text-white">
              {brief.primary_fault_hypothesis.replace('_', ' ').toUpperCase()}
            </div>
            <span className="text-[11px] text-cyan-400">
              {Math.round(brief.fault_probability * 100)}% prob · {brief.confidence_label} confidence
            </span>
          </div>

          <div className="bg-slate-950 p-3 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase">RUL Quantiles (Principle 4)</span>
            <div className="text-sm font-bold text-amber-300">
              p10={brief.rul_range_operating_days.p10}d · p50={brief.rul_range_operating_days.p50}d · p90={brief.rul_range_operating_days.p90}d
            </div>
            <span className="text-[11px] text-slate-500">Operating days remaining</span>
          </div>

          <div className="bg-slate-950 p-3 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase">Financial Impact</span>
            <div className="text-sm font-bold text-emerald-400">
              Save ${brief.cost_comparison.cost_savings.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-500">
              Planned ${brief.cost_comparison.planned_repair_cost.toLocaleString()} vs Failure ${brief.cost_comparison.catastrophic_failure_cost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Evidence Deltas */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider block">
            Deterministic Residual Evidence
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
            {brief.concrete_evidence.map((ev, i) => (
              <div key={i} className="p-2 rounded bg-slate-900/40 border border-slate-800/80 text-slate-300 flex items-start gap-2">
                <span className="text-cyan-400">▸</span>
                <span>{ev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Citations */}
        {brief.citations && brief.citations.length > 0 && (
          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-900">
            <span>Citations:</span>
            {brief.citations.map((c, i) => (
              <span key={i} className="text-cyan-400/90 underline cursor-pointer">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 Candidate Repair Windows */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Candidate Repair Windows (Top 3 Scored Options)
          </span>
          <span className="text-[11px] text-slate-500">Multi-criteria optimization</span>
        </div>

        <div className="space-y-2">
          {brief.top_3_windows.map((win) => {
            const isSelected = selectedWindowId === win.window_id || (!selectedWindowId && win.rank === 1);
            return (
              <div
                key={win.window_id}
                onClick={() => setSelectedWindowId(win.window_id)}
                className={`p-3.5 rounded border transition-colors cursor-pointer space-y-2 ${
                  isSelected 
                    ? 'border-cyan-800 bg-slate-900/60' 
                    : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-cyan-400">#{win.rank}</span>
                    <span className="font-bold text-white">{win.window_id}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-300 uppercase text-[11px]">{win.type}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-emerald-400 font-semibold">${win.cost_rate.toLocaleString()}/hr</span>
                  </div>

                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="text-slate-400">Duration: {win.duration_hours}h</span>
                    <span className={win.risk === 'LOW' ? 'text-emerald-400' : 'text-amber-400'}>
                      Risk: {win.risk}
                    </span>
                    <span className="text-cyan-400 font-bold">Score: {win.score}</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/30 p-2 rounded border border-slate-900">
                  <span className="text-slate-300 font-bold">Trade-offs: </span>
                  {win.trade_offs}
                </div>

                <div className="text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Parts: {win.parts_ready} · Crew: {win.crew_ready}</span>
                  <span>Start: {win.start.replace('T', ' ').substring(0, 16)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Falsification & Safety Reviewer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Falsification: What Would Change My Mind
          </span>
          <div className="space-y-1 text-[11px] text-slate-400">
            {brief.what_would_change_my_mind.map((m, i) => (
              <div key={i} className="p-1.5 rounded bg-slate-900/30 border border-slate-900">
                ▸ {m}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Safety Reviewer Audit Stamp
          </span>
          <div className="p-2.5 rounded border border-slate-800 bg-slate-900/30 text-[11px] space-y-1.5 text-slate-300">
            <div>{brief.safety_reviewer_comments}</div>
            <div className="text-[10px] text-slate-500 border-t border-slate-800 pt-1.5">
              Governed by Central Action Allowlist · Physical control actions strictly forbidden for AI agent.
            </div>
          </div>
        </div>
      </div>

      {/* Human Supervisor Action Bar */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Supervisor Sign-Off & Authorization
            </span>
            <span className="text-[11px] text-slate-500">
              Only role 'supervisor' can authorize work order creation or status changes.
            </span>
          </div>

          {!isSupervisor && (
            <span className="text-[11px] text-rose-400 bg-rose-950/40 px-2.5 py-0.5 rounded border border-rose-900/60">
              Switch role to Supervisor above to approve
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-500 block">Supervisor Justification (Logged to SHA-256 chain):</label>
          <input
            type="text"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            disabled={!isSupervisor}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-slate-700 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAction('APPROVED')}
            disabled={!isSupervisor}
            className="px-4 py-2 rounded bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/80 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve Work Order
          </button>

          <button
            onClick={() => handleAction('EDITED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Edit Plan
          </button>

          <button
            onClick={() => handleAction('POSTPONED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Postpone
          </button>

          <button
            onClick={() => handleAction('REJECTED')}
            disabled={!isSupervisor}
            className="px-3 py-2 rounded bg-slate-900 hover:bg-rose-950/40 text-rose-400 border border-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
