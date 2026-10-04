import React, { useState } from 'react';
import { DecisionBrief, Role } from '../types';
import { 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Wrench, 
  HelpCircle, 
  Lock, 
  ChevronRight, 
  Calendar,
  XCircle,
  Edit3,
  ThumbsUp,
  AlertOctagon,
  Sparkles
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
  const [justification, setJustification] = useState<string>('Authorized based on prognostic pre-p10 safety window and parts stock verification.');
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  if (isLoading || !brief) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto"></div>
        <h3 className="text-base font-mono font-bold text-white">Synthesizing Decision Brief...</h3>
        <p className="text-xs font-mono text-slate-400">
          Orchestrator running Diagnosis Specialist, Planner Specialist, and Safety Reviewer Veto checks.
        </p>
      </div>
    );
  }

  const isSupervisor = userRole === 'supervisor';
  const defaultWindow = brief.top_3_windows[0];

  const handleAction = (decision: 'APPROVED' | 'EDITED' | 'POSTPONED' | 'REJECTED') => {
    if (!isSupervisor) {
      alert(`[GOVERNANCE ERROR] Role '${userRole}' is not authorized to approve work orders. Under Principle 3, only the human supervisor possesses operational authority.`);
      return;
    }
    onApprove(brief.brief_id, decision, justification);
    setActionStatus(`Action '${decision}' successfully recorded in tamper-evident audit log.`);
  };

  return (
    <div className="space-y-6">
      {/* Action Status Banner */}
      {actionStatus && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-xl flex items-center justify-between text-emerald-200 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionStatus}</span>
          </div>
          <button onClick={() => setActionStatus(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Brief Header */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-800/60">
                STRUCTURED DECISION BRIEF
              </span>
              <span className="text-xs font-mono text-slate-400">{brief.brief_id}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {brief.risk_level} RISK
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1.5">{brief.asset_id}: {brief.asset_name}</h1>
            <p className="text-xs font-mono text-slate-400">
              Criticality: <strong>Class {brief.criticality_class}</strong> • Health Score: <strong>{brief.overall_health_score}/100</strong>
            </p>
          </div>

          {/* Supervisor Authority Indicator */}
          <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
            <ShieldAlert className={`w-4 h-4 ${isSupervisor ? 'text-amber-400' : 'text-slate-500'}`} />
            <div>
              <span className="text-slate-400 block text-[10px]">CURRENT ROLE:</span>
              <span className={`font-bold ${isSupervisor ? 'text-amber-300' : 'text-slate-300'}`}>
                {userRole.toUpperCase()} {isSupervisor ? '(Full Approval Authority)' : '(Read Only)'}
              </span>
            </div>
          </div>
        </div>

        {/* Diagnosis & Prognostic Quantiles Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400">Primary Diagnosis</span>
            <div className="text-sm font-bold font-mono text-white mt-0.5">
              {brief.primary_fault_hypothesis.replace('_', ' ').toUpperCase()}
            </div>
            <span className="text-xs font-mono text-cyan-400">
              Probability: {Math.round(brief.fault_probability * 100)}% • Confidence: {brief.confidence_label}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400">RUL Uncertainty Quantiles (Principle 4)</span>
            <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
              p10: {brief.rul_range_operating_days.p10}d | p50: {brief.rul_range_operating_days.p50}d | p90: {brief.rul_range_operating_days.p90}d
            </div>
            <span className="text-xs font-mono text-slate-400">Operating days to critical threshold</span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400">Financial Impact (Planned vs Failure)</span>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
              Save ${brief.cost_comparison.cost_savings.toLocaleString()}
            </div>
            <span className="text-xs font-mono text-slate-400">
              Planned ${brief.cost_comparison.planned_repair_cost.toLocaleString()} vs Catastrophic ${brief.cost_comparison.catastrophic_failure_cost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Concrete Numerical Evidence */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-bold uppercase text-slate-300 tracking-wider">
            Deterministic Evidence & Concrete Deltas
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
            {brief.concrete_evidence.map((ev, i) => (
              <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0"></span>
                <span>{ev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reference Citations */}
        {brief.citations && brief.citations.length > 0 && (
          <div className="pt-2 border-t border-slate-800 text-xs font-mono text-slate-400 flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-bold">CITATIONS:</span>
            {brief.citations.map((cite, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[11px]">
                {cite}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 Candidate Repair Windows Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Candidate Repair Windows (Top 3 Scored Trade-offs)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Multi-Criteria Optimization</span>
        </div>

        <div className="space-y-3">
          {brief.top_3_windows.map((win) => {
            const isSelected = selectedWindowId === win.window_id || (!selectedWindowId && win.rank === 1);
            return (
              <div
                key={win.window_id}
                onClick={() => setSelectedWindowId(win.window_id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                  isSelected 
                    ? 'bg-cyan-950/20 border-cyan-500/60 shadow-md shadow-cyan-500/10' 
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                      win.rank === 1 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      #{win.rank}
                    </span>
                    <span className="font-mono font-bold text-sm text-white">{win.window_id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                      {win.type}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-semibold">
                      ${win.cost_rate.toLocaleString()}/hr
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <span className="text-slate-400">
                      Duration: <strong>{win.duration_hours}h</strong>
                    </span>
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      win.risk === 'LOW' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      Risk: {win.risk}
                    </span>
                    <span className="text-cyan-400 font-bold">Score: {win.score} pts</span>
                  </div>
                </div>

                <div className="text-xs font-mono text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                  <span className="text-slate-400 font-bold">Trade-offs & Rationale: </span>
                  {win.trade_offs}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span>Parts: <strong className="text-slate-200">{win.parts_ready}</strong></span>
                  <span>Crew: <strong className="text-slate-200">{win.crew_ready}</strong></span>
                  <span className="text-cyan-400">Window Start: {win.start.replace('T', ' ').substring(0, 16)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What Would Change My Mind & Interim Advisory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-amber-300">
            <HelpCircle className="w-4 h-4" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
              Falsification: What Would Change My Mind
            </h4>
          </div>
          <ul className="space-y-2 text-xs font-mono text-slate-300">
            {brief.what_would_change_my_mind.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 bg-slate-950 p-2.5 rounded border border-slate-800/80">
                <span className="text-amber-400 font-bold">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Safety Reviewer Veto & Audit Stamp */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
              Safety Reviewer Audit & Compliance Stamp
            </h4>
          </div>
          <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono text-emerald-200 space-y-2">
            <p className="font-semibold">{brief.safety_reviewer_comments}</p>
            <div className="text-[11px] text-slate-400 border-t border-emerald-900/40 pt-2 space-y-1">
              <div>✓ Principle 1: Asset-agnostic schema verified</div>
              <div>✓ Principle 2: Numbers computed by deterministic engine only</div>
              <div>✓ Principle 3: Enforcing human supervisor sole authority</div>
              <div>✓ Principle 4: Uncertainty represented as p10-p90 ranges</div>
              <div>✓ Principle 5: Cryptographic SHA-256 audit chain logged</div>
            </div>
          </div>
        </div>
      </div>

      {/* Human Supervisor Action Bar (Enforced by Role) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-amber-900/40 rounded-xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" /> Human Supervisor Operational Decision Authority
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              The AI Copilot does not possess execution authority. A designated supervisor must sign off.
            </p>
          </div>
          {!isSupervisor && (
            <span className="text-xs font-mono text-rose-400 bg-rose-950/60 border border-rose-900 px-3 py-1 rounded font-bold">
              LOCKED: Role '{userRole}' cannot authorize. Switch to 'Supervisor' above.
            </span>
          )}
        </div>

        {/* Justification input */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 block">Supervisor Authorization Rationale (Audited):</label>
          <input
            type="text"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            disabled={!isSupervisor}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
          />
        </div>

        {/* Decision Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => handleAction('APPROVED')}
            disabled={!isSupervisor}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-mono font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <ThumbsUp className="w-4 h-4" />
            <span>APPROVE WORK ORDER</span>
          </button>

          <button
            onClick={() => handleAction('EDITED')}
            disabled={!isSupervisor}
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 font-mono font-medium text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Edit3 className="w-4 h-4 text-cyan-400" />
            <span>Edit Plan</span>
          </button>

          <button
            onClick={() => handleAction('POSTPONED')}
            disabled={!isSupervisor}
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 font-mono font-medium text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Postpone</span>
          </button>

          <button
            onClick={() => handleAction('REJECTED')}
            disabled={!isSupervisor}
            className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 disabled:bg-slate-800 disabled:text-slate-600 text-rose-300 font-mono font-medium text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Reject</span>
          </button>
        </div>
      </div>
    </div>
  );
};
