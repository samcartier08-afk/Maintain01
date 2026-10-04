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
        { label: 'Vibration RMS', actual: '4.65 mm/s', expected: '2.15 mm/s', delta: '+46.2%', z: '+4.2σ', share: '74.2%' },
        { label: 'Stator Current', actual: '78.2 A', expected: '75.1 A', delta: '+4.1%', z: '+0.8σ', share: '6.4%' },
        { label: 'Winding Temp', actual: '79.4 °C', expected: '65.0 °C', delta: '+14.5°C', z: '+2.1σ', share: '19.4%' },
        { label: 'Belt Speed', actual: '1.98 m/s', expected: '2.05 m/s', delta: '-3.4%', z: '-0.7σ', share: '0.0%' },
      ]
    : isPump
    ? [
        { label: 'Casing Vibration', actual: '4.35 mm/s', expected: '1.80 mm/s', delta: '+58.4%', z: '+3.8σ', share: '68.0%' },
        { label: 'Suction Pressure', actual: '1.42 bar', expected: '2.45 bar', delta: '-42.0%', z: '-3.1σ', share: '24.5%' },
        { label: 'Discharge Press', actual: '8.80 bar', expected: '11.5 bar', delta: '-23.5%', z: '-2.4σ', share: '7.5%' },
        { label: 'Flow Rate', actual: '340 m3/h', expected: '372 m3/h', delta: '-8.5%', z: '-1.1σ', share: '0.0%' },
      ]
    : [
        { label: 'Discharge Temp', actual: '101.4 °C', expected: '81.7 °C', delta: '+24.1°C', z: '+4.1σ', share: '71.0%' },
        { label: 'Oil Pressure', actual: '3.12 bar', expected: '5.05 bar', delta: '-38.2%', z: '-3.4σ', share: '22.0%' },
        { label: 'Vibration Vel', actual: '3.85 mm/s', expected: '3.25 mm/s', delta: '+18.5%', z: '+1.8σ', share: '7.0%' },
        { label: 'Motor Power', actual: '118 kW', expected: '112 kW', delta: '+5.3%', z: '+0.9σ', share: '0.0%' },
      ];

  const hypotheses = isMotor
    ? [
        {
          name: 'bearing_wear',
          prob: 88,
          sensor: 'vibration_rms',
          hints: 'Progressive exponential elevation in vibration velocity RMS decoupled from current load.',
          inspection: 'Perform high-frequency demodulated FFT; inspect SKF 6314-C3 inner raceway.'
        },
        {
          name: 'winding_overheating',
          prob: 12,
          sensor: 'winding_temp',
          hints: 'Secondary thermal rise correlated with bearing friction heat conduction.',
          inspection: 'Measure stator resistance and check cooling fan shroud.'
        }
      ]
    : isPump
    ? [
        {
          name: 'cavitation',
          prob: 82,
          sensor: 'casing_vibration',
          hints: 'Acoustic chattering vibration accompanied by suction header pressure loss below NPSHa margin.',
          inspection: 'Clear inlet suction strainer and inspect bronze-aluminum impeller vane tips.'
        },
        {
          name: 'mechanical_seal_leakage',
          prob: 18,
          sensor: 'casing_vibration',
          hints: 'Shaft runout causing face deflection on cartridge seal.',
          inspection: 'Check seal buffer barrier fluid reservoir level.'
        }
      ]
    : [
        {
          name: 'oil_starvation_overheating',
          prob: 85,
          sensor: 'discharge_temp',
          hints: 'Rise in discharge air/oil temperature with simultaneous dip in lube oil injection pressure.',
          inspection: 'Inspect 71C thermostatic bypass valve element and replace oil filter cartridge.'
        },
        {
          name: 'rotor_unbalance',
          prob: 15,
          sensor: 'vibration_velocity',
          hints: 'Moderate elevation in 1X running frequency.',
          inspection: 'Check compressor airend coupling alignment.'
        }
      ];

  const rulDetails = isMotor
    ? { p10: 5.2, p50: 8.6, p90: 13.0, confidence: 'HIGH', score: 0.88, rate: '+0.12 mm/s/day', limit: '4.5 mm/s ISO limit' }
    : isPump
    ? { p10: 7.1, p50: 11.4, p90: 16.5, confidence: 'HIGH', score: 0.84, rate: '+0.09 mm/s/day', limit: '4.2 mm/s ISO limit' }
    : { p10: 9.0, p50: 14.2, p90: 20.0, confidence: 'MEDIUM', score: 0.78, rate: '+1.4°C/day', limit: '105°C Trip limit' };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Machine Header */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-white text-sm">{asset.id}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 font-sans font-medium text-sm">{asset.name}</span>
              <span className="text-slate-600">·</span>
              <span className={asset.criticality_class === 'A' ? 'text-rose-400' : 'text-amber-400'}>
                Class {asset.criticality_class}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {asset.location} · Line: {asset.line_id} · Commissioned: {asset.install_date}
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
              className="px-3 py-1.5 rounded bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-800/60 transition-colors flex items-center gap-1 font-medium"
            >
              <span>Decision Brief</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Telemetry Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/60 rounded-lg p-px border border-slate-800/80 overflow-hidden">
        {evidenceDeltas.map((m, idx) => (
          <div key={idx} className="bg-slate-950 p-4 space-y-1">
            <div className="text-[11px] text-slate-500 uppercase flex items-center justify-between">
              <span>{m.label}</span>
              <span className="text-cyan-400/90">{m.share}</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white tabular-nums">{m.actual}</span>
              <span className={`text-[11px] font-semibold ${
                m.delta.startsWith('+') && !m.label.includes('Current') && !m.label.includes('Power')
                  ? 'text-rose-400' 
                  : 'text-slate-400'
              }`}>
                {m.delta}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900 flex items-center justify-between">
              <span>Base: {m.expected}</span>
              <span>{m.z}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Telemetry Chart: Sensor Trend vs Baseline Envelope */}
      <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              {isMotor ? 'Vibration Velocity RMS (mm/s)' : isPump ? 'Casing Vibration (mm/s)' : 'Discharge Temperature (°C)'} vs Load-Normalized Baseline
            </span>
            <span className="text-[11px] text-slate-500">
              Decoupled from operational load cycles. Injected fault onset: Day 42.0.
            </span>
          </div>

          <div className="flex items-center space-x-1 text-[11px]">
            <button
              onClick={() => setTimeframe('60d')}
              className={`px-2 py-0.5 rounded border transition-colors ${
                timeframe === '60d' ? 'bg-slate-800 text-white border-slate-700' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              60 Days
            </button>
            <button
              onClick={() => setTimeframe('14d')}
              className={`px-2 py-0.5 rounded border transition-colors ${
                timeframe === '14d' ? 'bg-slate-800 text-white border-slate-700' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              Fault Period
            </button>
            <button
              onClick={() => setTimeframe('artifact')}
              className={`px-2 py-0.5 rounded border transition-colors ${
                timeframe === 'artifact' ? 'bg-slate-800 text-white border-slate-700' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              Artifact Day 25
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
            <text x="680" y="40" fill="#e11d48" fontSize="9" fontFamily="monospace">
              CRITICAL LIMIT ({rulDetails.limit})
            </text>

            {/* Baseline Normal Envelope */}
            <polygon 
              points="40,135 200,138 350,134 480,140 600,136 780,138 780,175 600,172 480,176 350,170 200,174 40,172"
              fill="#0369a1"
              fillOpacity="0.08"
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
            <text x="525" y="25" fill="#d97706" fontSize="9" fontFamily="monospace">
              Fault Onset (Day 42)
            </text>

            {/* Actual Observed Telemetry */}
            <path
              d="M 40 154 L 90 151 L 140 157 L 180 150 L 220 155 L 270 152 L 320 153 
                 L 330 90 L 340 150 
                 L 380 152 L 430 151 L 480 154 L 515 152 
                 L 540 140 L 570 126 L 610 108 L 660 85 L 710 62 L 760 45 L 780 40"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="2"
            />

            <circle cx="780" cy="40" r="4" fill="#f43f5e" />
          </svg>

          {/* Minimal Legend */}
          <div className="flex items-center space-x-4 text-[10px] text-slate-500 pt-2 border-t border-slate-900">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-rose-500"></span> Sensor Telemetry
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-sky-500 border-dashed"></span> Expected Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-sky-500/20"></span> ±2σ Envelope
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Ranked Hypotheses & RUL Quantiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ranked Hypotheses */}
        <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Ranked Fault Hypotheses
            </span>
            <span className="text-[11px] text-slate-500">Plugin Rule Engine</span>
          </div>

          <div className="space-y-3">
            {hypotheses.map((h, i) => (
              <div key={i} className="p-3 rounded border border-slate-800/60 bg-slate-900/30 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">
                    {i + 1}. {h.name.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-cyan-400 font-bold tabular-nums">{h.prob}% prob</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">{h.hints}</p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                  <span className="text-slate-400">Action:</span> {h.inspection}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: RUL Quantile Uncertainty Range */}
        <div className="border border-slate-800/80 rounded-lg p-5 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              RUL Uncertainty Range (Principle 4)
            </span>
            <span className="text-[11px] text-slate-400">
              Confidence: {rulDetails.confidence} ({Math.round(rulDetails.score * 100)}%)
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Prognostic degradation rate: {rulDetails.rate}. Output represented as probabilistic range, never a single point date.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-3 rounded border border-slate-800 bg-slate-900/40">
              <div className="text-[10px] text-rose-400 uppercase font-semibold">p10 (Early)</div>
              <div className="text-xl font-bold text-white mt-1 tabular-nums">{rulDetails.p10}d</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Conservative</div>
            </div>

            <div className="p-3 rounded border border-slate-800 bg-slate-900/40">
              <div className="text-[10px] text-amber-300 uppercase font-semibold">p50 (Median)</div>
              <div className="text-xl font-bold text-white mt-1 tabular-nums">{rulDetails.p50}d</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Expected</div>
            </div>

            <div className="p-3 rounded border border-slate-800 bg-slate-900/40">
              <div className="text-[10px] text-cyan-400 uppercase font-semibold">p90 (Tail)</div>
              <div className="text-xl font-bold text-white mt-1 tabular-nums">{rulDetails.p90}d</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Optimistic</div>
            </div>
          </div>

          <div className="p-3 rounded border border-slate-800 bg-slate-900/20 text-[11px] text-slate-400 flex items-center justify-between mt-2">
            <span>Recommended window starts before p10 threshold</span>
            <button
              onClick={() => onOpenDecisionBrief(asset.id)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium flex items-center gap-1"
            >
              Review Decision Brief →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
