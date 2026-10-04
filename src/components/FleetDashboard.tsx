import React, { useState } from 'react';
import { Asset, AlertItem } from '../types';
import { 
  Activity, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Search, 
  Filter, 
  RefreshCw,
  SlidersHorizontal,
  ChevronRight
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
      {/* Minimal Stat Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-lg p-px border border-slate-800/80 overflow-hidden font-mono">
        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Monitored Assets</div>
          <div className="text-2xl font-bold text-white tabular-nums">{assets.length}</div>
          <div className="text-[11px] text-slate-400">4 total units registered</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Fleet Health Index</div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {avgHealth}<span className="text-xs text-slate-500 font-normal">/100</span>
          </div>
          <div className="text-[11px] text-amber-400/90">1 unit in degraded state</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Active Telemetry Alerts</div>
          <div className="text-2xl font-bold text-rose-400 tabular-nums">{alerts.length}</div>
          <div className="text-[11px] text-slate-400">High residual deviations</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider">Decision Queue</div>
          <div className="text-2xl font-bold text-amber-300 tabular-nums">1</div>
          <button 
            onClick={() => onOpenDecisionBrief('M-204')}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
          >
            Review M-204 brief <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Layout: Asset List + Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High-Density Asset List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Minimal Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search machine ID, line, location..."
                className="w-full bg-slate-900/60 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-slate-700"
              >
                <option value="all">All Profiles</option>
                <option value="conveyor_motor">Conveyor Motors</option>
                <option value="centrifugal_pump">Centrifugal Pumps</option>
                <option value="compressor">Air Compressors</option>
                <option value="industrial_gearbox">Industrial Gearboxes</option>
                <option value="A">Criticality A</option>
                <option value="B">Criticality B</option>
              </select>

              <button
                onClick={onRefresh}
                className="p-1.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Refresh Telemetry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Minimalist Asset Table / Rows */}
          <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/60 divide-y divide-slate-800/60 font-mono">
            {filteredAssets.map((asset) => {
              const healthScore = asset.health_score || (
                asset.id === 'M-204' ? 38 : asset.id === 'P-102' ? 52 : asset.id === 'C-301' ? 64 : 94
              );
              const isDegraded = healthScore < 50;
              const isWarning = healthScore >= 50 && healthScore < 75;

              return (
                <div 
                  key={asset.id}
                  className="p-4 hover:bg-slate-900/40 transition-colors space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    {/* Identification */}
                    <div>
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-white">{asset.id}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-300 font-sans font-medium">{asset.name}</span>
                        <span className="text-slate-600">·</span>
                        <span className={`text-[11px] ${
                          asset.criticality_class === 'A' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          Class {asset.criticality_class}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {asset.location} · {asset.line_id}
                      </div>
                    </div>

                    {/* Health & Actions */}
                    <div className="flex items-center space-x-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase">Health</div>
                        <div className={`text-base font-bold tabular-nums ${
                          isDegraded ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {healthScore}%
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSelectAsset(asset.id)}
                          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white border border-slate-800 rounded hover:bg-slate-800/80 transition-colors"
                        >
                          Diagnostics
                        </button>
                        <button
                          onClick={() => onOpenDecisionBrief(asset.id)}
                          className="px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800/60 rounded bg-cyan-950/20 transition-colors"
                        >
                          Brief →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Diagnosed Condition */}
                  {asset.id === 'M-204' && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900 pt-2">
                      <span className="text-rose-400/90">
                        bearing_wear (88%) · Vibration RMS +46% vs baseline · RUL: p10=5.2d / p50=8.6d
                      </span>
                      <span className="text-slate-500">Rec: Wed Oct 7 PM</span>
                    </div>
                  )}

                  {asset.id === 'P-102' && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900 pt-2">
                      <span className="text-amber-400/90">
                        cavitation (82%) · Casing vibration acoustic chatter · Suction drop -42%
                      </span>
                      <span className="text-slate-500">RUL: p10=7.1d</span>
                    </div>
                  )}

                  {asset.id === 'C-301' && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900 pt-2">
                      <span className="text-amber-400/90">
                        oil_starvation_overheating · Discharge temp 101.4°C · Oil press 3.12 bar
                      </span>
                      <span className="text-slate-500">RUL: p10=9.0d</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Live Anomaly Stream & Fast Prompts */}
        <div className="space-y-4">
          <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Telemetry Alerts ({alerts.length})
              </span>
              <span className="text-[11px] text-slate-500">Live stream</span>
            </div>

            <div className="space-y-2.5">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="p-3 rounded border border-slate-800/60 bg-slate-900/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{alert.asset_id}</span>
                    <span className={`text-[10px] ${
                      alert.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-sans font-medium">{alert.title}</p>
                  <p className="text-[11px] text-slate-500 leading-normal">{alert.description}</p>

                  <div className="pt-1.5 flex items-center justify-between border-t border-slate-900 text-[11px]">
                    <span className="text-slate-500">
                      {alert.timestamp.replace('T', ' ').substring(5, 16)}
                    </span>
                    <button
                      onClick={() => onAskCopilot(`Investigate alert ${alert.id} on ${alert.asset_id}: ${alert.title}`, alert.asset_id)}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Triage with Copilot →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Prompts Panel */}
          <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2.5 font-mono text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Operator Queries
            </span>
            <div className="space-y-1.5">
              <button
                onClick={() => onAskCopilot("What is at risk this week across the fleet?")}
                className="w-full text-left p-2 rounded border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
              >
                What is at risk this week across the fleet?
              </button>
              <button
                onClick={() => onAskCopilot("Analyze M-204 bearing vibration and recommend optimal repair window.", "M-204")}
                className="w-full text-left p-2 rounded border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
              >
                Analyze M-204 bearing and repair window
              </button>
              <button
                onClick={() => onAskCopilot("Shut down conveyor motor M-204 immediately!", "M-204")}
                className="w-full text-left p-2 rounded border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 transition-colors flex items-center justify-between"
              >
                <span>Emergency shutdown M-204</span>
                <span className="text-[10px] text-rose-400">[Test Refusal]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
