import React from 'react';
import type { SystemStatus } from './types';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Server,
  ArrowRightLeft,
  Radio,
  Cpu,
} from 'lucide-react';

interface HeaderProps {
  status: SystemStatus;
  onOpenOverrideModal: () => void;
  onToggleChaosPanel: () => void;
  isChaosOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenOverrideModal,
  onToggleChaosPanel,
  isChaosOpen,
}) => {
  const isFailoverActive = status.activeCloud === 'AZURE' || status.isDrPromoted;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1E293B] bg-[#0B0F17]/95 backdrop-blur-md px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: System Identifier & Deployment Metadata */}
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded border transition-colors ${
              isFailoverActive
                ? 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
            }`}
          >
            {isFailoverActive ? (
              <ShieldAlert className="w-4 h-4 animate-pulse" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wider text-slate-100">
                RAGNAROCK <span className="text-slate-600">//</span> MULTI-CLOUD DR CONSOLE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E293B] text-emerald-400 border border-emerald-900/50 font-semibold">
                PRODUCTION
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">SHA:</span>
                <span className="text-slate-200 font-semibold">{status.commitSha}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">EPOCH:</span>
                <span className="text-amber-400 font-bold">#{status.fencingEpoch}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">SYNC:</span>
                <span
                  className={
                    status.replication.syncState === 'SYNCHRONIZED'
                      ? 'text-emerald-400 font-medium'
                      : 'text-rose-400 font-medium'
                  }
                >
                  {status.replication.syncState}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Routing Posture Indicator & Quorum Consensus Matrix */}
        <div className="flex items-center gap-3 bg-[#0F172A] px-3 py-1.5 rounded border border-[#1E293B]">
          {/* Active Ingress Routing Posture */}
          <div className="flex items-center gap-2">
            <Radio
              className={`w-3.5 h-3.5 ${
                isFailoverActive ? 'text-rose-400 animate-ping' : 'text-emerald-400'
              }`}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Active Ingress:
            </span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                isFailoverActive
                  ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                  : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              }`}
            >
              {isFailoverActive
                ? 'DISASTER CUTOVER: AZURE (eastus) ACTIVE'
                : 'ACTIVE ROUTE: AWS (us-east-1) -> 100% INGRESS'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Quorum Consensus Matrix Micro-Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Quorum:</span>
            {status.vantagePoints.map((vp) => (
              <div
                key={vp.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  vp.status === 'HEALTHY'
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : vp.status === 'DEGRADED'
                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                }`}
                title={`Vantage ${vp.name} (${vp.location}) [${vp.ipAddress}] - Latency ${vp.latencyMs.toFixed(1)}ms`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    vp.status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span className="font-semibold">{vp.name}</span>
                <span className="opacity-80">
                  [{vp.status === 'HEALTHY' ? 'OK' : 'DOWN'}]
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Realized RTO Counter, RTT & Control Toggles */}
        <div className="flex items-center gap-2.5">
          {/* Latency Indicator */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300 bg-[#0F172A] px-2.5 py-1 rounded border border-[#1E293B]">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">RTT:</span>
            <span className="text-blue-300 font-bold">{status.interconnect.rttLatencyMs.toFixed(1)}ms</span>
          </div>

          {/* Realized RTO Counter */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300 bg-[#0F172A] px-2.5 py-1 rounded border border-[#1E293B]">
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">RTO:</span>
            <span className="text-amber-300 font-bold">{status.rtoRunningSeconds.toFixed(3)}s</span>
          </div>

          {/* Disaster Drill Chaos Panel Toggle Button */}
          <button
            onClick={onToggleChaosPanel}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-colors border ${
              isChaosOpen
                ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                : 'bg-[#0F172A] border-[#1E293B] text-slate-300 hover:border-slate-700'
            }`}
            title="Toggle Chaos Engineering Control Deck"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>CHAOS DRILLS</span>
          </button>

          {/* Authenticated Emergency Override Toggle Button */}
          <button
            onClick={onOpenOverrideModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all border shadow-sm ${
              isFailoverActive
                ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-700 text-emerald-300'
                : 'bg-rose-950/80 hover:bg-rose-900 border-rose-700 text-rose-300'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isFailoverActive ? 'FAILBACK TO AWS' : 'EMERGENCY OVERRIDE'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
