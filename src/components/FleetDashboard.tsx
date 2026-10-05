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
      {/* Friendly Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-lg p-px border border-slate-800/80 overflow-hidden font-sans">
        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Machines Monitored</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">{assets.length}</div>
          <div className="text-xs text-slate-500">Live sensors connected</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Average Fleet Health</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {avgHealth}<span className="text-xs text-slate-500 font-normal">/100</span>
          </div>
          <div className="text-xs text-amber-400">1 machine needs attention</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Active Sensor Alerts</div>
          <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">{alerts.length}</div>
          <div className="text-xs text-slate-500">Readings outside normal limits</div>
        </div>

        <div className="bg-slate-950 p-4 space-y-1">
          <div className="text-xs text-slate-400 font-medium">Ready for Approval</div>
          <div className="text-2xl font-bold text-amber-300 font-mono tabular-nums">1</div>
          <button 
            onClick={() => onOpenDecisionBrief('M-204')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors flex items-center gap-1"
          >
            Review M-204 Plan <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Layout: Asset List + Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High-Density Asset List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Minimal Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search machine name, ID, or line..."
                className="w-full bg-slate-900/60 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-slate-700"
              >
                <option value="all">All Machines</option>
                <option value="conveyor_motor">Conveyor Motors</option>
                <option value="centrifugal_pump">Water Pumps</option>
                <option value="compressor">Air Compressors</option>
                <option value="industrial_gearbox">Gearboxes</option>
                <option value="A">High Priority (Class A)</option>
                <option value="B">Medium Priority (Class B)</option>
              </select>

              <button
                onClick={onRefresh}
                className="p-1.5 rounded bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Refresh Live Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Minimalist Asset Table / Rows */}
          <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/60 divide-y divide-slate-800/60">
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
                        <span className="font-bold text-white font-mono">{asset.id}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-200 font-medium text-sm">{asset.name}</span>
                        <span className="text-slate-600">·</span>
                        <span className={`text-xs ${
                          asset.criticality_class === 'A' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {asset.criticality_class === 'A' ? 'High Priority' : 'Standard Priority'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Location: {asset.location} · Production Line: {asset.line_id}
                      </div>
                    </div>

                    {/* Health & Actions */}
                    <div className="flex items-center space-x-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Health Score</div>
                        <div className={`text-base font-bold font-mono tabular-nums ${
                          isDegraded ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {healthScore}%
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onSelectAsset(asset.id)}
                          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white border border-slate-800 rounded hover:bg-slate-800/80 transition-colors font-medium"
                        >
                          Diagnostics
                        </button>
                        <button
                          onClick={() => onOpenDecisionBrief(asset.id)}
                          className="px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800/60 rounded bg-cyan-950/20 transition-colors font-medium"
                        >
                          Review Plan →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Diagnosed Condition */}
                  {asset.id === 'M-204' && (
                    <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-900 pt-2 gap-1">
                      <span className="text-rose-300">
                        ⚠ Motor vibration is 46% above normal (bearing wear detected). Expected life: 5 to 9 days.
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">Suggested repair: Wed Oct 7 PM</span>
                    </div>
                  )}

                  {asset.id === 'P-102' && (
                    <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-900 pt-2 gap-1">
                      <span className="text-amber-300">
                        ⚠ Water suction pressure dropped 42% (pump cavitation). Expected life: 7 to 11 days.
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">Check inlet strainer</span>
                    </div>
                  )}

                  {asset.id === 'C-301' && (
                    <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-900 pt-2 gap-1">
                      <span className="text-amber-300">
                        ⚠ Discharge air running hot (101°C vs 82°C normal). Oil pressure low (3.1 bar).
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">Expected life: 9 to 14 days</span>
                    </div>
                  )}

                  {asset.id === 'GBX-401' && (
                    <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-900 pt-2">
                      <span className="text-emerald-400">
                        ✓ Running smoothly. Vibration and sump temperature are within normal limits.
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">Next routine check: 45 days</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Live Anomaly Stream & Fast Prompts */}
        <div className="space-y-4">
          <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Sensor Alerts ({alerts.length})
              </span>
              <span className="text-xs text-slate-500">Real-time</span>
            </div>

            <div className="space-y-2.5">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className="p-3 rounded border border-slate-800/60 bg-slate-900/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono">{alert.asset_id}</span>
                    <span className={`text-[11px] font-medium ${
                      alert.severity === 'CRITICAL' ? 'text-rose-400 font-semibold' : 'text-amber-400'
                    }`}>
                      {alert.severity === 'CRITICAL' ? 'Critical Warning' : 'Moderate Warning'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-medium">{alert.title}</p>
                  <p className="text-xs text-slate-400 leading-normal">{alert.description}</p>

                  <div className="pt-1.5 flex items-center justify-between border-t border-slate-900 text-xs">
                    <span className="text-slate-500 font-mono text-[11px]">
                      {alert.timestamp.replace('T', ' ').substring(5, 16)}
                    </span>
                    <button
                      onClick={() => onAskCopilot(`Investigate alert ${alert.id} on ${alert.asset_id}: ${alert.title}`, alert.asset_id)}
                      className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                    >
                      Ask AI Assistant →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Prompts Panel */}
          <div className="border border-slate-800/80 rounded-lg p-4 bg-slate-950/60 space-y-2.5 text-xs">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block font-mono">
              Quick Questions
            </span>
            <div className="space-y-1.5">
              <button
                onClick={() => onAskCopilot("What is at risk this week across the fleet?")}
                className="w-full text-left p-2 rounded border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
              >
                Which machines need attention this week?
              </button>
              <button
                onClick={() => onAskCopilot("Analyze M-204 bearing vibration and recommend optimal repair window.", "M-204")}
                className="w-full text-left p-2 rounded border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
              >
                Why is conveyor motor M-204 vibrating?
              </button>
              <button
                onClick={() => onAskCopilot("Can we delay M-204 repair to the weekend off-peak window?", "M-204")}
                className="w-full text-left p-2 rounded border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
              >
                Can we wait until Saturday to fix M-204?
              </button>
              <button
                onClick={() => onAskCopilot("Shut down conveyor motor M-204 immediately!", "M-204")}
                className="w-full text-left p-2 rounded border border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 transition-colors flex items-center justify-between"
              >
                <span>Shut down motor M-204 now</span>
                <span className="text-[10px] text-rose-400 font-mono">[Tests Safety Guard]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
