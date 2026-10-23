import React from 'react';
import type { SystemStatus, TelemetryHistoryPoint } from './types';
import {
  Activity,
  Database,
  Globe,
  Wifi,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface TelemetryGaugesProps {
  status: SystemStatus;
  history: TelemetryHistoryPoint[];
}

export const TelemetryGauges: React.FC<TelemetryGaugesProps> = ({
  status,
  history,
}) => {
  const isFailover = status.activeCloud === 'AZURE' || status.isDrPromoted;

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] border border-[#1E293B] rounded-md overflow-hidden shadow-md">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold tracking-wider uppercase">Pane B // Core Telemetry & Real-Time SLO Sparklines</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>SAMPLING:</span>
          <span className="text-emerald-400 font-bold">1000ms</span>
          <span className="text-slate-600">|</span>
          <span>WINDOW:</span>
          <span className="text-slate-300">LAST 30 SLOTS</span>
        </div>
      </div>

      {/* Gauges Grid */}
      <div className="p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3.5 flex-1 overflow-y-auto bg-[#0B0F17]">
        
        {/* 1. RPO & WAL REPLICATION GAUGE */}
        <div className="flex flex-col justify-between bg-[#0F172A] border border-[#1E293B] rounded p-3 font-mono">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>RPO // REPLICATION LAG</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                  status.replication.syncState === 'SYNCHRONIZED'
                    ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-800 text-rose-300'
                }`}
              >
                {status.replication.syncState}
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">LAG BYTES</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {status.replication.lagBytes.toLocaleString()} B
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">ESTIMATED RPO</div>
                <div className="text-amber-400 font-bold text-sm">
                  {status.replication.estimatedRpoMs} ms
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">WAL LSN HEX</div>
                <div className="text-slate-200 font-bold text-[11px] truncate">
                  {status.replication.lsnHex}
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">REPLAY QUEUE</div>
                <div className="text-blue-400 font-bold text-sm">
                  {status.replication.replayQueueSize} items
                </div>
              </div>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="h-24 w-full bg-[#0B0F17] p-1 rounded border border-[#1E293B]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRpo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', fontSize: '11px' }}
                  formatter={(val: any) => [`${val} Bytes`, 'Replication Lag']}
                />
                <Area
                  type="monotone"
                  dataKey="replicationLagBytes"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#colorRpo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. EDGE INGRESS HEALTH GAUGE */}
        <div className="flex flex-col justify-between bg-[#0F172A] border border-[#1E293B] rounded p-3 font-mono">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>EDGE INGRESS // SLO HEALTH</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-950/70 border-blue-800 text-blue-300 font-bold">
                {isFailover ? 'AZURE INGRESS' : 'AWS INGRESS'}
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">TOTAL RPS</div>
                <div className="text-blue-400 font-bold text-sm">
                  {status.ingress.totalRps.toFixed(1)} req/s
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">HTTP 2XX RATIO</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {status.ingress.http2xxRate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">HTTP 5XX RATIO</div>
                <div className="text-rose-400 font-bold text-sm">
                  {status.ingress.http5xxRate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">DNS RESOLUTION</div>
                <div className="text-amber-400 font-bold text-sm">
                  {status.ingress.dnsDurationMs.toFixed(1)} ms
                </div>
              </div>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="h-24 w-full bg-[#0B0F17] p-1 rounded border border-[#1E293B]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', fontSize: '11px' }}
                  formatter={(val: any) => [`${val} req/s`, 'Volume']}
                />
                <Area
                  type="monotone"
                  dataKey="rps"
                  stroke="#3B82F6"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#colorRps)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. CROSS-CLOUD INTERCONNECT HEALTH GAUGE */}
        <div className="flex flex-col justify-between bg-[#0F172A] border border-[#1E293B] rounded p-3 font-mono">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Wifi className="w-4 h-4 text-purple-400" />
                <span>INTERCONNECT // VPN TELEMETRY</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                  status.interconnect.vpnTunnelStatus === 'UP'
                    ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-800 text-rose-300'
                }`}
              >
                {status.interconnect.vpnTunnelStatus}
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">RTT LATENCY</div>
                <div className="text-purple-400 font-bold text-sm">
                  {status.interconnect.rttLatencyMs.toFixed(1)} ms
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">JITTER</div>
                <div className="text-amber-400 font-bold text-sm">
                  ±{status.interconnect.rttJitterMs.toFixed(2)} ms
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">PACKET LOSS</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {status.interconnect.packetLossPercent.toFixed(2)}%
                </div>
              </div>
              <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
                <div className="text-slate-500 text-[10px]">THROUGHPUT</div>
                <div className="text-slate-200 font-bold text-sm">
                  {status.interconnect.throughputMbps} Mbps
                </div>
              </div>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="h-24 w-full bg-[#0B0F17] p-1 rounded border border-[#1E293B]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', fontSize: '11px' }}
                  formatter={(val: any) => [`${val} ms`, 'RTT Latency']}
                />
                <Line
                  type="monotone"
                  dataKey="rttLatencyMs"
                  stroke="#A855F7"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="jitterMs"
                  stroke="#F59E0B"
                  strokeWidth={1}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};
