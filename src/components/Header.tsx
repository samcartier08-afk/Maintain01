import React from 'react';
import { Role } from '../types';
import { 
  Activity, 
  ShieldAlert, 
  FileText, 
  MessageSquareCode, 
  Wrench, 
  CheckCircle2, 
  Sliders, 
  Lock, 
  Cpu, 
  AlertTriangle 
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: Role;
  setUserRole: (role: Role) => void;
  openAlertsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  userRole,
  setUserRole,
  openAlertsCount,
}) => {
  const tabs = [
    { id: 'fleet', label: 'Fleet Dashboard', icon: Activity },
    { id: 'asset', label: 'Asset Diagnostics', icon: Cpu },
    { id: 'brief', label: 'Decision Brief', icon: FileText },
    { id: 'chat', label: 'Copilot Chat', icon: MessageSquareCode },
    { id: 'orders', label: 'Work Orders', icon: Wrench },
    { id: 'audit', label: 'Metrics & Audit', icon: ShieldAlert },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & System Mode */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wider text-white uppercase font-mono">
                  MAINTAIN<span className="text-cyan-400">COPILOT</span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  L2: DRAFT-ONLY
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Industrial Machinery Asset-Agnostic Decision Intelligence
              </p>
            </div>
          </div>

          {/* Role Switcher (Principle 3: Human Supervisor Authority) */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-xs font-mono text-slate-400 px-2 flex items-center gap-1">
                <Lock className="w-3 h-3 text-cyan-400" />
                ROLE:
              </span>
              {(['supervisor', 'technician', 'viewer'] as Role[]).map((r) => {
                const isActive = userRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setUserRole(r)}
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all uppercase ${
                      isActive
                        ? r === 'supervisor'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : r === 'technician'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'bg-slate-800 text-slate-200 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                    title={
                      r === 'supervisor'
                        ? 'Supervisor: Sole authority for Work Order approval, shutdowns, and purchasing'
                        : r === 'technician'
                        ? 'Technician: Executes repairs and submits diagnostic closeouts'
                        : 'Viewer: Read-only audit observer'
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Open Alerts Pill */}
            {openAlertsCount > 0 && (
              <div 
                onClick={() => setCurrentTab('fleet')}
                className="cursor-pointer hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{openAlertsCount} ACTIVE ALERTS</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
