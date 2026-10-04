import React, { useState } from 'react';
import { WorkOrder, Role } from '../types';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  UserCheck, 
  ChevronRight, 
  Send,
  Sliders,
  ShieldCheck,
  Check
} from 'lucide-react';

interface WorkOrdersViewProps {
  workOrders: WorkOrder[];
  userRole: Role;
  onRefresh: () => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  workOrders,
  userRole,
  onRefresh
}) => {
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(workOrders[0] || null);
  const [isCloseoutModalOpen, setIsCloseoutModalOpen] = useState(false);
  
  // Closeout Form State
  const [accuracy, setAccuracy] = useState<'CONFIRMED' | 'WRONG_DIAGNOSIS' | 'OTHER'>('CONFIRMED');
  const [actualFm, setActualFm] = useState<string>('bearing_wear');
  const [actualHours, setActualHours] = useState<string>('3.5');
  const [techNotes, setTechNotes] = useState<string>('Replaced SKF 6314-C3 drive-end bearing. Flaking verified on inner raceway. Laser alignment verified to 0.03mm.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const stages = [
    'DETECTED',
    'INVESTIGATING',
    'RECOMMENDED',
    'PENDING_APPROVAL',
    'APPROVED',
    'WORK_ORDER_CREATED',
    'CLOSED'
  ];

  const handleCloseoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWo) return;

    if (userRole !== 'technician' && userRole !== 'supervisor') {
      alert(`[GOVERNANCE ERROR] Role '${userRole}' cannot close out work orders. Only technicians or supervisors can submit closeout feedback.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/closeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: selectedWo.id,
          actor_role: userRole,
          actor_name: userRole === 'technician' ? 'Marcus Chen (Tech)' : 'Elena Miller (Supervisor)',
          diagnosis_accuracy: accuracy,
          actual_failure_mode: actualFm,
          actual_downtime_hours: parseFloat(actualHours),
          notes: techNotes
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessBanner(`Work Order ${selectedWo.id} marked CLOSED. Feedback recorded into precision metrics.`);
        setIsCloseoutModalOpen(false);
        onRefresh();
      } else {
        alert(data.error || 'Failed to submit closeout.');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CLOSED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'APPROVED':
      case 'WORK_ORDER_CREATED':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'PENDING_APPROVAL':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'REJECTED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-between text-xs font-mono text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* State Machine Pipeline Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Work Order Lifecycle State Machine (Principle 3)
            </h3>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Strictly enforced in code. Moving to APPROVED requires Supervisor role; closing requires Technician feedback.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Total Work Orders: {workOrders.length}</span>
        </div>

        {/* State Machine Flow Diagram */}
        <div className="flex items-center justify-between overflow-x-auto py-2 font-mono text-xs gap-1 scrollbar-none">
          {stages.map((stg, i) => {
            const isCurrent = selectedWo?.status === stg;
            const isPast = selectedWo && stages.indexOf(selectedWo.status) > i;
            return (
              <React.Fragment key={stg}>
                <div 
                  className={`px-3 py-2 rounded-lg border text-center whitespace-nowrap transition-all ${
                    isCurrent 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold shadow-md shadow-cyan-500/10'
                      : isPast
                      ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/60'
                      : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] text-slate-500">STAGE {i + 1}</div>
                  <div className="text-xs">{stg.replace(/_/g, ' ')}</div>
                </div>
                {i < stages.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Orders List & Active Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders List */}
        <div className="space-y-3 lg:col-span-1">
          <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
            All Work Orders
          </h4>

          <div className="space-y-2">
            {workOrders.map((wo) => {
              const isSelected = selectedWo?.id === wo.id;
              return (
                <div
                  key={wo.id}
                  onClick={() => setSelectedWo(wo)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/60 shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">{wo.id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${getStatusColor(wo.status)}`}>
                      {wo.status}
                    </span>
                  </div>

                  <h5 className="text-xs font-semibold text-slate-200">{wo.title}</h5>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>Asset: <strong>{wo.asset_id}</strong></span>
                    <span>Downtime: {wo.estimated_downtime_hours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Work Order Detail Card */}
        {selectedWo && (
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-mono font-bold text-white">{selectedWo.id}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border font-semibold ${getStatusColor(selectedWo.status)}`}>
                    {selectedWo.status}
                  </span>
                  <span className="text-xs font-mono text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
                    PRIORITY: {selectedWo.priority}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1">{selectedWo.title}</h2>
                <p className="text-xs font-mono text-slate-400">
                  Target Machine: <strong>{selectedWo.asset_id}</strong> • Root Cause: <strong>{selectedWo.failure_mode}</strong>
                </p>
              </div>

              {/* Action Buttons based on state */}
              <div className="flex items-center space-x-2">
                {selectedWo.status === 'WORK_ORDER_CREATED' && (
                  <button
                    onClick={() => setIsCloseoutModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Submit Field Closeout</span>
                  </button>
                )}

                {selectedWo.status === 'CLOSED' && (
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Closed & Audited</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scope & Description */}
            <div className="space-y-1.5">
              <h5 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Work Order Scope & Instructions
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                {selectedWo.description}
              </p>
            </div>

            {/* Required Resources Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Parts Required</span>
                <div className="text-slate-300 space-y-0.5">
                  {selectedWo.parts_required.map((p, i) => (
                    <div key={i} className="text-cyan-300">• {p}</div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Crew Skills</span>
                <div className="text-slate-300 space-y-0.5">
                  {selectedWo.required_skills.map((s, i) => (
                    <div key={i}>• {s}</div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Permits & Cost</span>
                <div className="text-slate-300 space-y-0.5">
                  <div>Permit: {selectedWo.safety_permits.join(', ') || 'Standard LOTO'}</div>
                  <div className="text-emerald-400 font-bold">Est Cost: ${selectedWo.estimated_cost.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Supervisor Approval Stamp */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-300">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>
                  Supervisor Authorization: <strong>{selectedWo.supervisor_approved_by || 'Elena Miller (Shift Supervisor)'}</strong>
                </span>
              </div>
              <span className="text-slate-500">Created: {selectedWo.created_at.substring(0, 16).replace('T', ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Technician Closeout Modal */}
      {isCloseoutModalOpen && selectedWo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                Field Technician Closeout: {selectedWo.id}
              </h3>
              <button onClick={() => setIsCloseoutModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCloseoutSubmit} className="space-y-4 text-xs">
              {/* Diagnosis Accuracy (Feedback Loop for Metrics) */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-bold">Diagnosis Accuracy Feedback:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CONFIRMED', 'WRONG_DIAGNOSIS', 'OTHER'] as const).map((acc) => (
                    <button
                      type="button"
                      key={acc}
                      onClick={() => setAccuracy(acc)}
                      className={`p-2 rounded border text-center transition-all ${
                        accuracy === acc
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {acc.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actual Failure Mode */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Actual Verified Failure Mode:</label>
                <input
                  type="text"
                  value={actualFm}
                  onChange={(e) => setActualFm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Actual Downtime Hours */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Actual Downtime Hours Taken:</label>
                <input
                  type="number"
                  step="0.1"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Field Technician Free-Text Notes */}
              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Technician Physical Notes:</label>
                <textarea
                  rows={3}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCloseoutModalOpen(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Recording...' : 'Close Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
