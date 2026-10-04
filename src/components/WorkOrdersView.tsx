import React, { useState } from 'react';
import { WorkOrder, Role } from '../types';
import { 
  CheckCircle2, 
  ChevronRight, 
  Wrench, 
  UserCheck 
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
        return 'text-emerald-400';
      case 'APPROVED':
      case 'WORK_ORDER_CREATED':
        return 'text-cyan-400';
      case 'PENDING_APPROVAL':
        return 'text-amber-400';
      case 'REJECTED':
        return 'text-rose-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Banner */}
      {successBanner && (
        <div className="p-3 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {successBanner}
          </span>
          <button onClick={() => setSuccessBanner(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* State Machine Minimal Stepper */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Work Order Lifecycle State Machine (Principle 3)
            </span>
            <span className="text-[11px] text-slate-500">
              Only Supervisor role can authorize approval; closing requires technician feedback.
            </span>
          </div>
          <span className="text-slate-400">{workOrders.length} orders total</span>
        </div>

        {/* Minimal Stepper Bar */}
        <div className="flex items-center justify-between overflow-x-auto py-2 gap-1 scrollbar-none text-[11px]">
          {stages.map((stg, i) => {
            const isCurrent = selectedWo?.status === stg;
            const isPast = selectedWo && stages.indexOf(selectedWo.status) > i;
            return (
              <React.Fragment key={stg}>
                <div 
                  className={`px-2.5 py-1.5 rounded border text-center whitespace-nowrap transition-colors ${
                    isCurrent 
                      ? 'border-cyan-800 bg-slate-900 text-cyan-300 font-bold'
                      : isPast
                      ? 'border-slate-800 text-slate-400'
                      : 'border-transparent text-slate-600'
                  }`}
                >
                  {i + 1}. {stg.replace(/_/g, ' ')}
                </div>
                {i < stages.length - 1 && (
                  <span className="text-slate-700">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Grid: Order List + Order Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders List */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Work Order Registry
          </span>

          <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/60 divide-y divide-slate-800/80">
            {workOrders.map((wo) => {
              const isSelected = selectedWo?.id === wo.id;
              return (
                <div
                  key={wo.id}
                  onClick={() => setSelectedWo(wo)}
                  className={`p-3 transition-colors cursor-pointer space-y-1 ${
                    isSelected ? 'bg-slate-900/80' : 'hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{wo.id}</span>
                    <span className={`text-[11px] font-bold ${getStatusColor(wo.status)}`}>
                      {wo.status}
                    </span>
                  </div>
                  <div className="text-slate-300 font-sans font-medium text-xs truncate">{wo.title}</div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{wo.asset_id}</span>
                    <span>{wo.estimated_downtime_hours}h downtime</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Work Order Detail */}
        {selectedWo && (
          <div className="lg:col-span-2 border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-bold text-white">{selectedWo.id}</span>
                  <span className="text-slate-600">·</span>
                  <span className={`font-bold ${getStatusColor(selectedWo.status)}`}>
                    {selectedWo.status}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">Priority {selectedWo.priority}</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1 font-sans">{selectedWo.title}</h3>
                <div className="text-[11px] text-slate-500">
                  Asset: {selectedWo.asset_id} · Failure Mode: {selectedWo.failure_mode}
                </div>
              </div>

              {/* Action Button */}
              {selectedWo.status === 'WORK_ORDER_CREATED' && (
                <button
                  onClick={() => setIsCloseoutModalOpen(true)}
                  className="px-3 py-1.5 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Submit Field Closeout</span>
                </button>
              )}

              {selectedWo.status === 'CLOSED' && (
                <div className="text-emerald-400 text-[11px] flex items-center gap-1 border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1 rounded">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Closed & Audited</span>
                </div>
              )}
            </div>

            {/* Scope */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Work Scope & Instructions
              </span>
              <p className="text-slate-300 leading-relaxed bg-slate-900/40 p-2.5 rounded border border-slate-900">
                {selectedWo.description}
              </p>
            </div>

            {/* Resources Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-800/60 rounded p-px border border-slate-800/80 overflow-hidden text-[11px]">
              <div className="bg-slate-950 p-3 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase">Parts Required</span>
                <div className="text-cyan-300">{selectedWo.parts_required.join(', ') || 'Standard consumables'}</div>
              </div>

              <div className="bg-slate-950 p-3 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase">Crew Skills</span>
                <div className="text-slate-300">{selectedWo.required_skills.join(', ') || 'General mechanics'}</div>
              </div>

              <div className="bg-slate-950 p-3 space-y-0.5">
                <span className="text-[10px] text-slate-500 uppercase">Financials</span>
                <div className="text-emerald-400 font-bold">${selectedWo.estimated_cost.toLocaleString()} est.</div>
              </div>
            </div>

            {/* Supervisor sign-off */}
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-900 flex items-center justify-between">
              <span>Supervisor: <strong className="text-slate-300">{selectedWo.supervisor_approved_by || 'Elena Miller (Shift Supervisor)'}</strong></span>
              <span>Created: {selectedWo.created_at.substring(0, 16).replace('T', ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Technician Closeout Modal */}
      {isCloseoutModalOpen && selectedWo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-white uppercase tracking-wider text-xs">
                Technician Closeout: {selectedWo.id}
              </span>
              <button onClick={() => setIsCloseoutModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCloseoutSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Diagnosis Accuracy:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['CONFIRMED', 'WRONG_DIAGNOSIS', 'OTHER'] as const).map((acc) => (
                    <button
                      type="button"
                      key={acc}
                      onClick={() => setAccuracy(acc)}
                      className={`p-1.5 rounded border text-center text-[11px] transition-colors ${
                        accuracy === acc
                          ? 'border-cyan-800 bg-slate-800 text-cyan-300 font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      {acc.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Actual Failure Mode:</label>
                <input
                  type="text"
                  value={actualFm}
                  onChange={(e) => setActualFm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Actual Downtime (hours):</label>
                <input
                  type="number"
                  step="0.1"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Physical Notes:</label>
                <textarea
                  rows={2}
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCloseoutModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 font-bold"
                >
                  {isSubmitting ? 'Closing...' : 'Close Work Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
