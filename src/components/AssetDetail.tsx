import React, { useState } from 'react';
import { Asset, TelemetryReading } from '../types';
import { 
  Activity, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Flame, 
  Gauge, 
  Info, 
  Sliders, 
  TrendingUp, 
  Wrench,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface AssetDetailProps {
  selectedAssetId: string;
  onSelectAssetId: (id: string) => void;
  assets: Asset[];
  onOpenDecisionBrief: (assetId: string) => void;
  onAskCopilot: (prompt: string, assetId?: string) => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  selectedAssetId,
  onSelectAssetId,
  assets,
  onOpenDecisionBrief,
  onAskCopilot,
}) => {
  const [timeframe, setTimeframe] = useState<'60d' | '14d' | 'artifact'>('60d');

  const asset = assets.find((a) => a.id === selectedAssetId) || assets[0] || {
    id: 'M-204',
    name: 'Primary Incline Parcel Sorter Motor',
    asset_type: 'conveyor_motor',
    criticality_class: 'A',
    status: 'DEGRADED',
    location: 'Sortation Hall B - Bay 4',
    line_id: 'LINE_SORT_01',
    install_date: '2023-03-15',
  };

  // Specific telemetry mock data based on asset type
  const isMotor = asset.id === 'M-204';
  const isPump = asset.id === 'P-102';
  const isCompressor = asset.id === 'C-301';

  // Concrete deltas
  const evidenceDeltas = isMotor
    ? [
        { label: 'Vibration RMS', delta: '+46.2%', actual: '4.65 mm/s', expected: '2.15 mm/s', z: '+4.2σ', contribution: '74.2%' },
        { label: 'Stator Current', delta: '+4.1%', actual: '78.2 A', expected: '75.1 A', z: '+0.8σ', contribution: '6.4%' },
        { label: 'Winding Temp', delta: '+14.5°C', actual: '79.4 °C', expected: '65.0 °C', z: '+2.1σ', contribution: '19.4%' },
      ]
    : isPump
    ? [
        { label: 'Casing Vibration', delta: '+58.4%', actual: '4.35 mm/s', expected: '1.80 mm/s', z: '+3.8σ', contribution: '68.0%' },
        { label: 'Suction Pressure', delta: '-42.0%', actual: '1.42 bar', expected: '2.45 bar', z: '-3.1σ', contribution: '24.5%' },
        { label: 'Flow Rate', delta: '-8.5%', actual: '340 m3/h', expected: '372 m3/h', z: '-1.1σ', contribution: '7.5%' },
      ]
    : [
        { label: 'Discharge Temp', delta: '+24.1°C', actual: '101.4 °C', expected: '81.7 °C', z: '+4.1σ', contribution: '71.0%' },
        { label: 'Oil Pressure', delta: '-38.2%', actual: '3.12 bar', expected: '5.05 bar', z: '-3.4σ', contribution: '22.0%' },
        { label: 'Vibration Vel', delta: '+18.5%', actual: '3.85 mm/s', expected: '3.25 mm/s', z: '+1.8σ', contribution: '7.0%' },
      ];

  // Hypotheses
  const hypotheses = isMotor
    ? [
        {
          name: 'bearing_wear',
          prob: 88,
          severity: 'CRITICAL',
          sensor: 'vibration_rms',
          hints: 'Progressive exponential elevation in vibration_rms uncoupled from stator current load. Drive-end bearing raceway micro-spalling.',
          inspection: 'Perform high-frequency demodulated FFT; inspect SKF 6314-C3 inner raceway.'
        },
        {
          name: 'winding_overheating',
          prob: 12,
          severity: 'MEDIUM',
          sensor: 'winding_temp',
          hints: 'Secondary thermal rise correlated with bearing friction heat conduction.',
          inspection: 'Measure stator resistance and check cooling fan shroud for parcel dust clogging.'
        }
      ]
    : isPump
    ? [
        {
          name: 'cavitation',
          prob: 82,
          severity: 'CRITICAL',
          sensor: 'casing_vibration',
          hints: 'Acoustic chattering vibration accompanied by suction header pressure loss below NPSHa margin.',
          inspection: 'Clear inlet suction strainer and inspect bronze-aluminum impeller vane tips.'
        },
        {
          name: 'mechanical_seal_leakage',
          prob: 18,
          severity: 'HIGH',
          sensor: 'casing_vibration',
          hints: 'Shaft runout causing face deflection on cartridge seal.',
          inspection: 'Check seal buffer barrier fluid reservoir level.'
        }
      ]
    : [
        {
          name: 'oil_starvation_overheating',
          prob: 85,
          severity: 'CRITICAL',
          sensor: 'discharge_temp',
          hints: 'Steep rise in discharge air/oil temperature with simultaneous dip in lube oil injection pressure.',
          inspection: 'Inspect 71C thermostatic bypass valve element and replace oil filter cartridge.'
        },
        {
          name: 'rotor_unbalance',
          prob: 15,
          severity: 'MEDIUM',
          sensor: 'vibration_velocity',
          hints: 'Moderate elevation in 1X running frequency.',
          inspection: 'Check compressor airend coupling alignment.'
        }
      ];

  // RUL details
  const rulDetails = isMotor
    ? { p10: 5.2, p50: 8.6, p90: 13.0, confidence: 'HIGH', score: 0.88, rate: '+0.12 mm/s per day', limit: '4.5 mm/s ISO Class III' }
    : isPump
    ? { p10: 7.1, p50: 11.4, p90: 16.5, confidence: 'HIGH', score: 0.84, rate: '+0.09 mm/s per day', limit: '4.2 mm/s ISO' }
    : { p10: 9.0, p50: 14.2, p90: 20.0, confidence: 'MEDIUM', score: 0.78, rate: '+1.4°C per day', limit: '105°C Trip' };

  return (
    <div className="space-y-6">
      {/* Top Header & Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-0.5 rounded">
                SELECTED ASSET
              </span>
              <span className="text-xs font-mono font-bold text-white tracking-wider">{asset.id}</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                asset.criticality_class === 'A'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                CRITICALITY {asset.criticality_class}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {asset.asset_type}
              </span>
            </div>

            <h2 className="text-lg font-bold text-white">{asset.name}</h2>
            <p className="text-xs font-mono text-slate-400">
              Location: {asset.location} • Production Line: <strong>{asset.line_id}</strong> • Commissioned: {asset.install_date}
            </p>
          </div>

          {/* Asset Switcher Dropdown */}
          <div className="flex items-center space-x-3 self-stretch md:self-auto">
            <div className="flex-1 md:flex-initial">
              <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                Switch Machinery Target
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => onSelectAssetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} - {a.name} ({a.asset_type})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onOpenDecisionBrief(asset.id)}
              className="mt-4 md:mt-0 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <span>Generate Brief</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {evidenceDeltas.map((metric, idx) => (
          <div 
            key={idx}
            className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>{metric.label}</span>
              <span className="text-[10px] text-cyan-400 font-semibold">{metric.contribution} Anomaly Share</span>
            </div>
            
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-white">{metric.actual}</span>
              <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                metric.delta.startsWith('+') && !metric.delta.includes('Current')
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {metric.delta}
              </span>
            </div>

            <div className="mt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span>Baseline: {metric.expected}</span>
              <span className="text-slate-300 font-bold">{metric.z}</span>
            </div>
          </div>
        ))}

        {/* Health Score Tile */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-mono">Continuous Health Index</div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-rose-400">
              {isMotor ? '38.2' : isPump ? '52.0' : '64.5'}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
            <span className="text-xs font-mono text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded font-semibold ml-auto">
              {isMotor ? 'CRITICAL RISK' : 'WARNING'}
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-slate-400 border-t border-slate-800/60 pt-2 flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Deterministic Baseline Model Active
          </div>
        </div>
      </div>

      {/* Middle Section: Sensor Trend vs Baseline Envelope SVG Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                {isMotor ? 'Vibration Velocity RMS (mm/s)' : isPump ? 'Casing Vibration & Differential Head' : 'Discharge Temperature (°C)'} vs Load-Normalized Baseline Envelope
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Decoupled from load cycle variations ({isMotor ? 'Stator Current' : isPump ? 'Discharge Flow' : 'Motor Power'}). Injected fault starts at Day 42.
            </p>
          </div>

          {/* Timeframe Toggles */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setTimeframe('60d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeframe === '60d' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full 60 Days
            </button>
            <button
              onClick={() => setTimeframe('14d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeframe === '14d' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Last 14d Fault
            </button>
            <button
              onClick={() => setTimeframe('artifact')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeframe === 'artifact' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Day 25 Artifact
            </button>
          </div>
        </div>

        {/* SVG Telemetry Visualization */}
        <div className="h-64 w-full relative bg-slate-950/70 rounded-lg p-2 border border-slate-800/80">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 800 240" preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1="50" y1="30" x2="780" y2="30" stroke="#1e293b" strokeDasharray="4" />
            <line x1="50" y1="80" x2="780" y2="80" stroke="#1e293b" strokeDasharray="4" />
            <line x1="50" y1="130" x2="780" y2="130" stroke="#1e293b" strokeDasharray="4" />
            <line x1="50" y1="180" x2="780" y2="180" stroke="#1e293b" strokeDasharray="4" />

            {/* Critical Threshold Line (e.g. 4.5 mm/s ISO limit) */}
            <line x1="50" y1="50" x2="780" y2="50" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6" />
            <text x="700" y="44" fill="#f43f5e" fontSize="10" fontFamily="monospace" fontWeight="bold">
              CRITICAL LIMIT ({rulDetails.limit})
            </text>

            {/* Baseline Normal Operating Envelope Shaded Area */}
            <polygon 
              points="50,140 200,142 350,138 480,145 600,140 780,142 780,185 600,182 480,186 350,180 200,184 50,182"
              fill="#0284c7"
              fillOpacity="0.12"
            />
            {/* Baseline Expected Mean Curve */}
            <path
              d="M 50 160 Q 200 162, 350 158 T 600 162 T 780 160"
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="2"
              strokeDasharray="4"
            />

            {/* Injected Fault Annotation Line at Day 42 */}
            <line x1="520" y1="20" x2="520" y2="210" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2" />
            <text x="525" y="28" fill="#fbbf24" fontSize="10" fontFamily="monospace" fontWeight="bold">
              Fault Onset (Day 42)
            </text>

            {/* Day 25 Artifact Annotation */}
            <line x1="330" y1="70" x2="330" y2="210" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2" />
            <text x="335" y="85" fill="#94a3b8" fontSize="9" fontFamily="monospace">
              Day 25 Spike (Non-critical Artifact)
            </text>

            {/* Actual Observed Telemetry Path */}
            <path
              d="M 50 162 L 90 159 L 140 165 L 180 158 L 220 163 L 270 160 L 320 161 
                 L 330 95 L 340 158 
                 L 380 160 L 430 159 L 480 162 L 515 160 
                 L 540 148 L 570 134 L 610 115 L 660 92 L 710 68 L 760 48 L 780 44"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />

            {/* Latest point highlight */}
            <circle cx="780" cy="44" r="5" fill="#f43f5e" className="animate-pulse" />
          </svg>

          {/* Chart Legend */}
          <div className="absolute bottom-3 left-6 flex items-center space-x-4 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded border border-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500"></span> Actual Sensor Telemetry
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-500 border-dashed"></span> Load-Normalized Expected Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-sky-500/20 border border-sky-500/40"></span> ±2σ Normal Envelope
            </span>
          </div>
        </div>
      </div>

      {/* Bottom 2 Columns: Ranked Hypotheses & Prognostics RUL Quantiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ranked Fault Hypotheses */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                Ranked Fault Hypotheses
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Plugin Rule Engine</span>
          </div>

          <div className="space-y-3">
            {hypotheses.map((h, i) => (
              <div 
                key={i}
                className="bg-slate-950 p-4 rounded-lg border border-slate-800/90 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                      #{i + 1} {h.name.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                      h.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {h.severity}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-mono text-slate-400">Probability:</span>
                    <span className="text-sm font-mono font-bold text-white">{h.prob}%</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {h.hints}
                </p>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-start gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span><strong>Inspection Recommendation:</strong> {h.inspection}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: RUL Quantiles & Uncertainty Envelope */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                RUL Uncertainty Envelope (Principle 4)
              </h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              Confidence: {rulDetails.confidence} ({Math.round(rulDetails.score * 100)}%)
            </span>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Every output represents an uncertainty range based on degradation rate ({rulDetails.rate}). Never outputs a single deterministic date.
          </p>

          {/* RUL Quantiles Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-rose-500/30 text-center">
              <div className="text-[10px] font-mono text-rose-400 uppercase font-semibold">p10 (Conservative)</div>
              <div className="text-2xl font-bold font-mono text-rose-300 mt-1">{rulDetails.p10}d</div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">Early Risk Threshold</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-amber-500/40 text-center">
              <div className="text-[10px] font-mono text-amber-300 uppercase font-semibold">p50 (Median)</div>
              <div className="text-2xl font-bold font-mono text-amber-200 mt-1">{rulDetails.p50}d</div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">Expected Operating Days</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">p90 (Optimistic)</div>
              <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{rulDetails.p90}d</div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">Tail Endurance</div>
            </div>
          </div>

          {/* Call to Action Box */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-slate-950 to-cyan-950/40 border border-cyan-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-white uppercase">Optimal Repair Window Status</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">Pre-p10 Margin Intact</span>
            </div>
            <p className="text-xs text-slate-300 font-mono">
              The recommended intervention window (Wed Oct 7 Scheduled PM) starts at Day 3.2, comfortably before the p10 early failure threshold ({rulDetails.p10} days).
            </p>
            <div className="pt-2">
              <button
                onClick={() => onOpenDecisionBrief(asset.id)}
                className="w-full py-2 px-3 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Review Structured Decision Brief & Authorize Repair</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
