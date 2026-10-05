import React from 'react';
import { Role } from '../types';
import { 
  Activity, 
  Cpu, 
  FileText, 
  MessageSquareCode, 
  Wrench, 
  ShieldCheck, 
  AlertCircle 
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
    { id: 'fleet', label: 'Fleet Overview' },
    { id: 'asset', label: 'Machine Diagnostics' },
    { id: 'brief', label: 'Repair Plan' },
    { id: 'chat', label: 'AI Assistant' },
    { id: 'orders', label: 'Work Orders' },
    { id: 'audit', label: 'Audit & History' },
  ];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Zone 1: Clean Brand Wordmark */}
          <div className="flex items-center space-x-3">
            <span 
              onClick={() => setCurrentTab('fleet')}
              className="text-sm font-semibold tracking-tight text-white font-mono cursor-pointer hover:text-slate-200 transition-colors"
            >
              Maintain<span className="text-cyan-400">Copilot</span>
            </span>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <span className="text-xs text-slate-400 font-sans hidden sm:inline">
              Smart Maintenance Assistant
            </span>
            <span className="text-[11px] font-sans text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Advisor Mode
            </span>
          </div>

          {/* Zone 2: Clean Typography Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-sans transition-all rounded ${
                    isActive
                      ? 'text-cyan-400 font-semibold bg-slate-900 border border-slate-800'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quiet Role Switcher & Alert Indicator */}
          <div className="flex items-center space-x-3">
            {/* Active Alerts Count */}
            {openAlertsCount > 0 && (
              <button 
                onClick={() => setCurrentTab('fleet')}
                className="flex items-center space-x-1.5 text-xs font-sans text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded hover:bg-rose-950/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                <span>{openAlertsCount} alerts</span>
              </button>
            )}

            {/* Minimal Segmented Role Selector */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-xs font-sans">
              <span className="text-[10px] text-slate-500 uppercase px-1.5 hidden sm:inline font-mono">Role:</span>
              {(['supervisor', 'technician', 'viewer'] as Role[]).map((r) => {
                const isActive = userRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setUserRole(r)}
                    className={`px-2 py-1 rounded transition-colors text-[11px] capitalize ${
                      isActive
                        ? r === 'supervisor'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold'
                          : r === 'technician'
                          ? 'bg-slate-800 text-cyan-300 font-semibold'
                          : 'bg-slate-800 text-slate-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={
                      r === 'supervisor'
                        ? 'Supervisor: Has sole authority to approve repairs and work orders'
                        : r === 'technician'
                        ? 'Technician: Performs repairs and logs field completion'
                        : 'Viewer: Read-only observer'
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden space-x-1 overflow-x-auto py-1.5 border-t border-slate-900 font-sans text-xs">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`px-2.5 py-1 whitespace-nowrap rounded ${
                  isActive ? 'bg-slate-800 text-cyan-400 font-medium' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
