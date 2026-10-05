import React, { useState } from 'react';
import { Asset } from '../types';
import { 
  ArrowRight, 
  ChevronRight, 
  Clock, 
  TrendingUp, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle 
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

  const isMotor = asset.id === 'M-204';
  const isPump = asset.id === 'P-102';
  const isCompressor = asset.id === 'C-301';

  // Metrics
  const evidenceDeltas = isMotor
    ? [
        { label: 'Vibration Level', actual: '4.65 mm/s', expected: '2.15 mm/s', delta: '+46.2% high', z: 'High severity', share: 'Main symptom' },
        { label: 'Motor Current', actual: '78.2 A', expected: '75.1 A', delta: 'Normal', z: 'Normal range', share: 'Steady load' },
        { label: 'Motor Temp', actual: '79.4 °C', expected: '65.0 °C', delta: '+14.5°C warm', z: 'Elevated', share: 'Bearing heat' },
        { label: 'Belt Speed', actual: '1.98 m/s', expected: '2.05 m/s', delta: 'Nominal', z: 'Normal', share: 'On speed' },
      ]
    : isPump
    ? [
        { label: 'Pump Vibration', actual: '4.35 mm/s', expected: '1.80 mm/s', delta: '+58.4% high', z: 'High severity', share: 'Acoustic chatter' },
        { label: 'Suction Pressure', actual: '1.42 bar', expected: '2.45 bar', delta: '-42.0% low', z: 'Severe drop', share: 'Inlet restriction' },
        { label: 'Discharge Press', actual: '8.80 bar', expected: '11.5 bar', delta: '-23.5% low', z: 'Reduced head', share: 'Flow drop' },
        { label: 'Water Flow', actual: '340 m³/h', expected: '372 m³/h', delta: '-8.5%', z: 'Slightly low', share: 'Throttled' },
      ]
    : [
        { label: 'Air Temp', actual: '101.4 °C', expected: '81.7 °C', delta: '+24.1°C hot', z: 'High severity', share: 'Thermal spike' },
        { label: 'Oil Pressure', actual: '3.12 bar', expected: '5.05 bar', delta: '-38.2% low', z: 'Low lube flow', share: 'Valve bypass' },
        { label: 'Vibration Level', actual: '3.85 mm/s', expected: '3.25 mm/s', delta: '+18.5%', z: 'Moderate', share: 'Coupling' },
        { label: 'Motor Power', actual: '118 kW', expected: '112 kW', delta: '+5.3%', z: 'Normal', share: 'Full load' },
      ];

  const hypotheses = isMotor
    ? [
        {
          name: 'Motor Bearing Wear',
          prob: 88,
          sensor: 'vibration_rms',
          hints: 'Vibration is climbing steadily while electrical motor load stays steady. This indicates the inner bearing raceway is wearing down mechanically.',
          inspection: 'Inspect the drive-end bearing (SKF 6314-C3) for roughness, flaking, or metal dust.'
        },
        {
          name: 'Stator Heat Buildup',
          prob: 12,
          sensor: 'winding_temp',
          hints: 'Motor winding temperature is slightly elevated, primarily caused by heat conducted from the worn bearing.',
          inspection: 'Blow out cooling fan shroud and check electrical resistance across motor phases.'
        }
      ]
    : isPump
    ? [
        {
          name: 'Pump Cavitation (Suction Loss)',
          prob: 82,
          sensor: 'casing_vibration',
          hints: 'Suction water pressure dropped below safe margin, causing bubbles to collapse against the impeller blades.',
          inspection: 'Clear the inlet suction strainer basket and check pump inlet valve position.'
        },
        {
          name: 'Mechanical Seal Leakage',
          prob: 18,
          sensor: 'casing_vibration',
          hints: 'Vibration from slight shaft deflection may be putting stress on the mechanical face seal.',
          inspection: 'Inspect seal reservoir barrier fluid level and look for moisture around the shaft sleeve.'
        }
      ]
    : [
        {
          name: 'Oil Starvation & Overheating',
          prob: 85,
          sensor: 'discharge_temp',
          hints: 'Discharge air is running hot because lube oil injection pressure dropped below normal.',
          inspection: 'Inspect the thermostatic bypass valve and replace the lube oil filter element.'
        },
        {
          name: 'Coupling Alignment',
          prob: 15,
          sensor: 'vibration_velocity',
          hints: 'Slight vibration elevation at 1X rotational frequency.',
          inspection: 'Check compressor motor coupling alignment with a dial indicator or laser tool.'
        }
      ];

  const rulDetails = isMotor
    ? { p10: 5.2, p50: 8.6, p90: 13.0, confidence: 'High', score: 0.88, rate: '+0.12 mm/s per day', limit: '4.5 mm/s safe limit' }
    : isPump
    ? { p10: 7.1, p50: 11.4, p90: 16.5, confidence: 'High', score: 0.84, rate: '+0.09 mm/s per day', limit: '4.2 mm/s safe limit' }
    : { p10: 9.0, p50: 14.2, p90: 20.0, confidence: 'Medium', score: 0.78, rate: '+1.4°C per day', limit: '105°C trip limit' };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Machine Header */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-white text-base font-mono">{asset.id}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-200 font-semibold text-base">{asset.name}</span>
              <span className="text-slate-600">·</span>
              <span className={asset.criticality_class === 'A' ? 'text-rose-400 font-medium' : 'text-amber-400 font-medium'}>
                {asset.criticality_class === 'A' ? 'High Priority Machine' : 'Standard Priority Machine'}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Location: {asset.location} · Line: {asset.line_id} · Installed: {asset.install_date}
            </div>
          </div>

          <div className="flex items-center space-x-2 self-stretch sm:self-auto">
            <select
              value={selectedAssetId}
              onChange={(e) => onSelectAssetId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
              ))}
            </select>

            <button
              onClick={() => onOpenDecisionBrief(asset.id)}
              className="px-3 py-1.5 rounded bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/60 transition-colors flex items-center gap-1 font-semibold"
            >
              <span>View Repair Plan</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Telemetry Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-lg p-px border border-slate-800/80 overflow-hidden">
        {evidenceDeltas.map((m, idx) => (
          <div key={idx} className="bg-slate-950 p-4 space-y-1">
            <div className="text-xs text-slate-400 flex items-center justify-between font-medium">
              <span>{m.label}</span>
              <span className="text-cyan-400 text-[11px]">{m.share}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white font-mono tabular-nums">{m.actual}</span>
              <span className={`text-xs font-medium ${
                m.delta.includes('high') || m.delta.includes('hot') || m.delta.includes('warm')
                  ? 'text-rose-400' 
                  : 'text-slate-400'
              }`}>
                {m.delta}
              </span>
            </div>
            <div className="text-xs text-slate-400 pt-1 border-t border-slate-900 flex items-center justify-between">
              <span>Normal: {m.expected}</span>
              <span className="font-mono text-[11px] text-slate-400">{m.z}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Telemetry Chart: Sensor Trend vs Baseline Envelope */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block font-mono">
              Vibration Trend vs Safe Operating Range
            </span>
            <span className="text-xs text-slate-400">
              The blue shaded band shows the safe normal range. Notice how vibration climbs into the danger zone around Day 42.
            </span>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={() => setTimeframe('60d')}
              className={`px-2.5 py-1 rounded border transition-colors ${
                timeframe === '60d' ? 'bg-slate-800 text-white border-slate-700 font-medium' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              Full 60 Days
            </button>
            <button
              onClick={() => setTimeframe('14d')}
              className={`px-2.5 py-1 rounded border transition-colors ${
                timeframe === '14d' ? 'bg-slate-800 text-white border-slate-700 font-medium' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              Fault Period (Last 14d)
            </button>
            <button
              onClick={() => setTimeframe('artifact')}
              className={`px-2.5 py-1 rounded border transition-colors ${
                timeframe === 'artifact' ? 'bg-slate-800 text-white border-slate-700 font-medium' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              Sensor Spike (Day 25)
            </button>
          </div>
        </div>

        {/* Minimal SVG Chart */}
        <div className="h-60 w-full relative bg-slate-950 rounded p-1">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 800 220" preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1="40" y1="30" x2="780" y2="30" stroke="#172033" strokeDasharray="3" />
            <line x1="40" y1="75" x2="780" y2="75" stroke="#172033" strokeDasharray="3" />
            <line x1="40" y1="120" x2="780" y2="120" stroke="#172033" strokeDasharray="3" />
            <line x1="40" y1="165" x2="780" y2="165" stroke="#172033" strokeDasharray="3" />

            {/* Critical Limit Line */}
            <line x1="40" y1="45" x2="780" y2="45" stroke="#e11d48" strokeWidth="1" strokeDasharray="4" />
            <text x="680" y="40" fill="#e11d48" fontSize="10" fontFamily="sans-serif" fontWeight="bold">
              SAFE LIMIT ({rulDetails.limit})
            </text>

            {/* Baseline Normal Envelope */}
            <polygon 
              points="40,135 200,138 350,134 480,140 600,136 780,138 780,175 600,172 480,176 350,170 200,174 40,172"
              fill="#0369a1"
              fillOpacity="0.10"
            />
            {/* Expected Baseline Curve */}
            <path
              d="M 40 152 Q 200 154, 350 150 T 600 154 T 780 152"
              fill="none"
              stroke="#0284c7"
              strokeWidth="1.5"
              strokeDasharray="3"
            />

            {/* Day 42 Fault Line */}
            <line x1="520" y1="20" x2="520" y2="190" stroke="#d97706" strokeWidth="1" strokeDasharray="2" />
            <text x="525" y="25" fill="#d97706" fontSize="10" fontFamily="sans-serif">
              Problem Begins (Day 42)
            </text>

            {/* Actual Observed Telemetry */}
            <path
              d="M 40 154 L 90 151 L 140 157 L 180 150 L 220 155 L 270 152 L 320 153 
                 L 330 90 L 340 150 
                 L 380 152 L 430 151 L 480 154 L 515 152 
                 L 540 140 L 570 126 L 610 108 L 660 85 L 710 62 L 760 45 L 780 40"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2.5"
            />

            <circle cx="780" cy="40" r="4.5" fill="#f43f5e" />
          </svg>

          {/* Minimal Legend */}
          <div className="flex items-center space-x-5 text-xs text-slate-400 pt-2 border-t border-slate-900">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-500 rounded"></span> Actual Live Sensor Reading
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-500 border-dashed rounded"></span> Expected Normal Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-sky-500/20 rounded"></span> Safe Normal Range Band
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Ranked Hypotheses & RUL Quantiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ranked Hypotheses */}
        <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Diagnosed Root Causes
            </span>
            <span className="text-xs text-slate-400">Automated Fault Identification</span>
          </div>

          <div className="space-y-3">
            {hypotheses.map((h, i) => (
              <div key={i} className="p-3.5 rounded border border-slate-800/60 bg-slate-900/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white text-sm">
                    {i + 1}. {h.name}
                  </span>
                  <span className="text-cyan-400 font-bold font-mono tabular-nums">{h.prob}% likelihood</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{h.hints}</p>
                <div className="text-xs text-slate-400 pt-1.5 border-t border-slate-900">
                  <strong className="text-slate-200">Recommended physical check:</strong> {h.inspection}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: RUL Quantile Uncertainty Range */}
        <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Safe Operating Life Remaining
            </span>
            <span className="text-xs text-slate-400">
              Confidence: {rulDetails.confidence}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Machine wear accumulates over time ({rulDetails.rate}). To avoid surprise breakdowns, we calculate three planning windows rather than guessing a single date:
          </p>

          <div className="grid grid-cols-3 gap-2 text-center pt-1 font-sans">
            <div className="p-3 rounded border border-rose-900/40 bg-rose-950/20">
              <div className="text-xs text-rose-300 font-semibold">Earliest Risk</div>
              <div className="text-xl font-bold text-white mt-1 font-mono tabular-nums">{rulDetails.p10} days</div>
              <div className="text-[11px] text-rose-200/70 mt-0.5">Plan repair before this</div>
            </div>

            <div className="p-3 rounded border border-amber-900/40 bg-amber-950/20">
              <div className="text-xs text-amber-300 font-semibold">Most Likely</div>
              <div className="text-xl font-bold text-white mt-1 font-mono tabular-nums">{rulDetails.p50} days</div>
              <div className="text-[11px] text-amber-200/70 mt-0.5">Expected failure point</div>
            </div>

            <div className="p-3 rounded border border-slate-800 bg-slate-900/40">
              <div className="text-xs text-cyan-300 font-semibold">Best Case</div>
              <div className="text-xl font-bold text-white mt-1 font-mono tabular-nums">{rulDetails.p90} days</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Under ideal conditions</div>
            </div>
          </div>

          <div className="p-3 rounded border border-slate-800 bg-slate-900/20 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
            <span>✓ The recommended Wednesday window starts comfortably before the 5.2-day risk limit.</span>
            <button
              onClick={() => onOpenDecisionBrief(asset.id)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold flex items-center gap-1 shrink-0"
            >
              Review Repair Plan →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
