import React, { useState } from 'react';
import { Asset, AlertItem } from '../types';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Cpu, 
  Flame, 
  Gauge, 
  Search, 
  Sparkles,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';

interface FleetDashboardProps {
  assets: Asset[];
  alerts: AlertItem[];
  onSelectAsset: (assetId: string) => void;
  onOpenDecisionBrief: (assetId: string) => void;
  onAskCopilot: (prompt: string, assetId?: string) => void;
  onRefresh: () => void;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
  assets,
  alerts,
  onSelectAsset,
  onOpenDecisionBrief,
  onAskCopilot,
  onRefresh
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredAssets = assets.filter(a => {
    const matchesType = filterType === 'all' || a.asset_type === filterType || a.criticality_class === filterType;
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const avgHealth = Math.round(
    assets.reduce((acc, a) => acc + (a.health_score || 75), 0) / (assets.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1: Fleet Assets */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Monitored Fleet</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{assets.length}</span>
            <span className="text-xs text-slate-400 font-mono">Machinery Assets</span>
          </div>
          <div className="mt-2 text-xs font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            100% Deterministic Sensor Ingestion
          </div>
        </div>

        {/* KPI 2: Fleet Health Index */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Mean Fleet Health</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{avgHealth}%</span>
            <span className="text-xs text-amber-400 font-mono">1 Critical Degraded</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                avgHealth < 50 ? 'bg-rose-500' : avgHealth < 75 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${avgHealth}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Open Alerts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Active Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">{alerts.length}</span>
            <span className="text-xs text-slate-400 font-mono">Across 3 Lines</span>
          </div>
          <div className="mt-2 text-xs font-mono text-rose-300/80 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
            M-204 Vibration Surge +46%
          </div>
        </div>

        {/* KPI 4: Pending Supervisor Action */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Decision Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-amber-300 font-mono">1</span>
            <span className="text-xs text-slate-400 font-mono">Brief Awaiting Approval</span>
          </div>
          <button
            onClick={() => onOpenDecisionBrief('M-204')}
            className="mt-2 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            Review M-204 Decision Brief <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Layout: Asset Table + Live Alerts Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fleet Telemetry & Asset Cards */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset ID, line location, motor..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Asset Types & Criticalities</option>
                <option value="conveyor_motor">Conveyor Motors</option>
                <option value="centrifugal_pump">Centrifugal Pumps</option>
                <option value="compressor">Air Compressors</option>
                <option value="industrial_gearbox">Gearboxes</option>
                <option value="A">Criticality Class A Only</option>
                <option value="B">Criticality Class B Only</option>
              </select>

              <button 
                onClick={onRefresh}
                className="p-1.5 rounded border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Refresh Live Telemetry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Asset List */}
          <div className="space-y-3">
            {filteredAssets.map((asset) => {
              const healthScore = asset.health_score || (
                asset.id === 'M-204' ? 38 : asset.id === 'P-102' ? 52 : asset.id === 'C-301' ? 64 : 94
              );
              const isCritical = healthScore < 50;
              const isWarning = healthScore >= 50 && healthScore < 75;

              return (
                <div 
                  key={asset.id}
                  className={`bg-slate-900/90 border rounded-xl p-4 transition-all duration-200 hover:border-slate-700 shadow-sm ${
                    isCritical ? 'border-rose-500/40 bg-rose-950/10' : isWarning ? 'border-amber-500/30' : 'border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Identification */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-white tracking-wide">{asset.id}</span>
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                          asset.criticality_class === 'A'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}>
                          CLASS {asset.criticality_class}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {asset.asset_type.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-200">{asset.name}</h4>
                      <p className="text-[11px] font-mono text-slate-400">{asset.location} • Line: {asset.line_id}</p>
                    </div>

                    {/* Health Score Gauge */}
                    <div className="flex items-center space-x-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-xs font-mono text-slate-400">Health Index</div>
                        <div className={`text-xl font-bold font-mono ${
                          isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {healthScore}<span className="text-xs text-slate-500">/100</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => onSelectAsset(asset.id)}
                          className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          Trends
                        </button>
                        <button
                          onClick={() => onOpenDecisionBrief(asset.id)}
                          className="px-3 py-1.5 text-xs font-mono font-semibold rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors flex items-center gap-1"
                        >
                          Brief <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Diagnosis Footnote */}
                  {asset.id === 'M-204' && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-rose-300/90">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        Fault Hypothesis: <strong>bearing_wear</strong> (Prob: 88%) • RUL: p10=5.2d / p50=8.6d
                      </span>
                      <span className="text-slate-400">Recommended window: Wed Oct 7 PM</span>
                    </div>
                  )}

                  {asset.id === 'P-102' && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-amber-300/90">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        Fault Hypothesis: <strong>cavitation</strong> (Prob: 82%) • Suction Pressure Dropped 22%
                      </span>
                      <span className="text-slate-400">RUL: p10=7.1d / p50=11.4d</span>
                    </div>
                  )}

                  {asset.id === 'C-301' && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-amber-300/90">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        Fault Hypothesis: <strong>oil_starvation_overheating</strong> • Temp: 101.4°C
                      </span>
                      <span className="text-slate-400">RUL: p10=9.0d / p50=14.2d</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Active Alerts & Copilot Fast Triage */}
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Live Anomaly Alerts ({alerts.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Real-time Stream</span>
            </div>

            <div className="mt-3 space-y-3">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-white">{alert.asset_id}</span>
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>

                  <h5 className="text-xs font-medium text-slate-200">{alert.title}</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                    <span className="text-[10px] font-mono text-slate-500">
                      {alert.timestamp.replace('T', ' ').substring(5, 16)}
                    </span>
                    <button
                      onClick={() => onAskCopilot(`Investigate alert ${alert.id} on asset ${alert.asset_id}: ${alert.title}`, alert.asset_id)}
                      className="text-[11px] font-mono font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Triage with Copilot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick AI Command Center */}
          <div className="bg-gradient-to-br from-slate-900 to-cyan-950/40 border border-cyan-900/40 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-cyan-300">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Copilot Fast Prompts</h4>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic numbers computed; LLM specialist reasons on windows, SOPs, and governance trade-offs.
            </p>
            <div className="space-y-1.5 font-mono text-xs">
              <button
                onClick={() => onAskCopilot("What is at risk this week across the fleet?")}
                className="w-full text-left p-2 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                ▸ "What is at risk this week across the fleet?"
              </button>
              <button
                onClick={() => onAskCopilot("Analyze M-204 bearing vibration and recommend optimal repair window.", "M-204")}
                className="w-full text-left p-2 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              >
                ▸ "Analyze M-204 bearing and recommend window"
              </button>
              <button
                onClick={() => onAskCopilot("Shut down conveyor motor M-204 immediately!", "M-204")}
                className="w-full text-left p-2 rounded bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-900/50 transition-colors flex items-center justify-between"
              >
                <span>▸ "Shut down M-204 immediately"</span>
                <span className="text-[10px] text-rose-400 font-bold">[Tests Refusal]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
