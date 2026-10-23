import React from 'react';
import type { SystemStatus, TopologyNode } from './types';
import {
  Cloud,
  Server,
  Database,
  Lock,
  Maximize2,
  Radio,
  Layers,
} from 'lucide-react';

interface TopologyMapProps {
  status: SystemStatus;
  nodes: TopologyNode[];
  onSelectNode: (node: TopologyNode) => void;
}

export const TopologyMap: React.FC<TopologyMapProps> = ({
  status,
  nodes,
  onSelectNode,
}) => {
  const isFailover = status.activeCloud === 'AZURE' || status.isDrPromoted;
  const isVpnSevered = status.interconnect.vpnTunnelStatus === 'SEVERED' || isFailover;

  const edgeNode = nodes.find((n) => n.cloud === 'CLOUDFLARE') || nodes[0];
  const awsNode = nodes.find((n) => n.cloud === 'AWS') || nodes[1];
  const azureNode = nodes.find((n) => n.cloud === 'AZURE') || nodes[2];
  const vpnNode = nodes.find((n) => n.cloud === 'VPN') || nodes[3];

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] border border-[#1E293B] rounded-md overflow-hidden shadow-md">
      {/* Pane Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-bold tracking-wider uppercase">Pane A // Cross-Cloud Topology & Live Wireframe Map</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-slate-500">VPN TUNNEL:</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              isVpnSevered
                ? 'bg-rose-950/70 border-rose-800 text-rose-400'
                : 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
            }`}
          >
            {isVpnSevered ? 'SEVERED / FENCED' : 'IPsec ESTABLISHED'}
          </span>
          <span className="text-slate-500">WAL REPLICATION:</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
              isFailover
                ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                : 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
            }`}
          >
            {isFailover ? 'REVERSE PREP' : 'ACTIVE LSN: 0/1F8A9C0'}
          </span>
        </div>
      </div>

      {/* Visual Diagram Canvas */}
      <div className="relative flex-1 p-4 bg-[#0B0F17] overflow-auto min-h-[380px] flex flex-col justify-between select-none">
        {/* Wireframe Grid Accent Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        {/* 1. Global Edge Layer (Cloudflare Anycast) */}
        <div className="relative z-10 flex justify-center mb-4">
          <div
            onClick={() => onSelectNode(edgeNode)}
            className="group cursor-pointer relative bg-[#0F172A] hover:bg-[#1E293B]/70 border border-slate-700 hover:border-blue-500 rounded p-3 w-full max-w-lg transition-all shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-100">
                      CLOUDFLARE ANYCAST EDGE
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 rounded">
                      172.64.0.1
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Ingress Router // Target Pool:{' '}
                    <span className={isFailover ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {isFailover ? 'Azure East US (Standby Cutover)' : 'AWS us-east-1 (Primary Active)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span className="text-slate-300">54.2 RPS</span>
                </div>
                <Maximize2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* Ingress Flow Splitters (SVG Wire Lines) */}
        <div className="relative z-0 h-10 w-full flex justify-around items-center -my-2 pointer-events-none">
          {/* Left Flow: Edge to AWS */}
          <div className="flex-1 flex justify-center items-center">
            <div
              className={`h-full w-0.5 border-l-2 transition-all ${
                isFailover
                  ? 'border-rose-900/40 border-dashed'
                  : 'border-emerald-500/80'
              }`}
            />
          </div>

          {/* Right Flow: Edge to Azure */}
          <div className="flex-1 flex justify-center items-center">
            <div
              className={`h-full w-0.5 border-r-2 transition-all ${
                isFailover
                  ? 'border-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  : 'border-slate-800 border-dashed'
              }`}
            />
          </div>
        </div>

        {/* 2. Dual Cloud Core Infrastructure Grid (AWS vs Azure) */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* AWS PRIMARY VPC NODE */}
          <div
            onClick={() => onSelectNode(awsNode)}
            className={`group cursor-pointer relative bg-[#0F172A] rounded border p-3.5 transition-all shadow-md ${
              isFailover
                ? 'border-rose-900/60 bg-rose-950/10 hover:border-rose-700'
                : 'border-emerald-800/60 hover:border-emerald-500'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] mb-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded border ${
                    isFailover
                      ? 'bg-rose-950 border-rose-800 text-rose-400'
                      : 'bg-emerald-950 border-emerald-800 text-emerald-400'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>AWS PRIMARY VPC</span>
                    <span className="text-[10px] text-amber-400 font-normal">us-east-1</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    CIDR: 10.100.0.0/16
                  </div>
                </div>
              </div>

              <div
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isFailover
                    ? 'bg-rose-950 border-rose-800 text-rose-300'
                    : 'bg-emerald-950 border-emerald-800 text-emerald-300'
                }`}
              >
                {isFailover ? 'FENCED (0% INGRESS)' : 'PRIMARY (100% INGRESS)'}
              </div>
            </div>

            {/* AWS Internal Components */}
            <div className="space-y-2 font-mono text-[11px]">
              {/* ALB */}
              <div className="flex items-center justify-between bg-[#0B0F17] px-2.5 py-1.5 rounded border border-[#1E293B]">
                <span className="text-slate-400">ALB Ingress:</span>
                <span className={isFailover ? 'text-rose-400 line-through' : 'text-slate-200'}>
                  10.100.1.50 (HTTP 200)
                </span>
              </div>
              {/* Compute Cluster */}
              <div className="flex items-center justify-between bg-[#0B0F17] px-2.5 py-1.5 rounded border border-[#1E293B]">
                <span className="text-slate-400">ECS Compute Task:</span>
                <span className={isFailover ? 'text-rose-400' : 'text-emerald-400 font-bold'}>
                  {isFailover ? '0 Tasks (Drained)' : '8 Tasks Active'}
                </span>
              </div>
              {/* Database */}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded border ${
                  isFailover
                    ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                    : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Aurora PostgreSQL:</span>
                </div>
                <span className="font-bold">
                  {isFailover ? 'FENCED (READ-ONLY)' : 'MASTER (READ-WRITE)'}
                </span>
              </div>
            </div>
          </div>

          {/* AZURE STANDBY VNET NODE */}
          <div
            onClick={() => onSelectNode(azureNode)}
            className={`group cursor-pointer relative bg-[#0F172A] rounded border p-3.5 transition-all shadow-md ${
              isFailover
                ? 'border-rose-600 bg-rose-950/20 shadow-[0_0_12px_rgba(244,63,94,0.2)] hover:border-rose-500'
                : 'border-slate-800 hover:border-blue-500'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-2 border-b border-[#1E293B] mb-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded border ${
                    isFailover
                      ? 'bg-rose-950 border-rose-800 text-rose-300 animate-pulse'
                      : 'bg-blue-950 border-blue-800 text-blue-400'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>AZURE STANDBY VNET</span>
                    <span className="text-[10px] text-blue-400 font-normal">eastus</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    CIDR: 10.200.0.0/16
                  </div>
                </div>
              </div>

              <div
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isFailover
                    ? 'bg-rose-950 border-rose-800 text-rose-300 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isFailover ? 'DISASTER CUTOVER ACTIVE' : 'HOT STANDBY (0% INGRESS)'}
              </div>
            </div>

            {/* Azure Internal Components */}
            <div className="space-y-2 font-mono text-[11px]">
              {/* App Gateway */}
              <div className="flex items-center justify-between bg-[#0B0F17] px-2.5 py-1.5 rounded border border-[#1E293B]">
                <span className="text-slate-400">App Gateway:</span>
                <span className={isFailover ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                  10.200.1.50 (100% Traffic)
                </span>
              </div>
              {/* Compute Cluster */}
              <div className="flex items-center justify-between bg-[#0B0F17] px-2.5 py-1.5 rounded border border-[#1E293B]">
                <span className="text-slate-400">Container Apps:</span>
                <span className={isFailover ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                  {isFailover ? '6 Replicas (Burst Scaled)' : '1 Standby Instance'}
                </span>
              </div>
              {/* Database */}
              <div
                className={`flex items-center justify-between px-2.5 py-1.5 rounded border ${
                  isFailover
                    ? 'bg-rose-950/50 border-rose-700 text-rose-300 font-bold animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Flexible PostgreSQL:</span>
                </div>
                <span>
                  {isFailover ? 'PROMOTED (READ-WRITE)' : 'REPLICA (READ-ONLY)'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 3. IPsec VPN Interconnect & WAL Streaming Pipeline (Bottom Bar) */}
        <div className="relative z-10 mt-4">
          <div
            onClick={() => onSelectNode(vpnNode)}
            className={`group cursor-pointer bg-[#0F172A] border rounded p-2.5 transition-all flex flex-wrap items-center justify-between gap-3 ${
              isVpnSevered
                ? 'border-rose-900/60 bg-rose-950/10'
                : 'border-blue-900/50 hover:border-blue-500'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded border ${
                  isVpnSevered
                    ? 'bg-rose-950 border-rose-800 text-rose-400'
                    : 'bg-blue-950 border-blue-800 text-blue-400'
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-200">
                    CROSS-CLOUD IPSEC VPN TUNNEL // 10.100.0.0/16 ↔ 10.200.0.0/16
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold ${
                      isVpnSevered
                        ? 'bg-rose-950 border-rose-800 text-rose-400'
                        : 'bg-emerald-950 border-emerald-800 text-emerald-300'
                    }`}
                  >
                    {isVpnSevered ? 'TUNNEL SEVERED' : 'BGP UP (24.5ms)'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  WAL Replication Stream:{' '}
                  {isVpnSevered ? (
                    <span className="text-rose-400 font-bold">FENCED / STREAM PAUSED</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">
                      AWS Aurora → Azure Standby (LSN: 0/1F8A9C0 | Lag: 1,024 B)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Pulse Animation Bar */}
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <div className="relative w-28 h-2 bg-slate-900 rounded overflow-hidden border border-slate-800">
                {!isVpnSevered && (
                  <div className="absolute inset-y-0 w-1/3 bg-emerald-500/80 rounded animate-[pulse_1.5s_infinite]" />
                )}
                {isVpnSevered && (
                  <div className="absolute inset-0 bg-rose-900/60" />
                )}
              </div>
              <span className="text-slate-400">
                {isVpnSevered ? '0.0 Mbps' : '450 Mbps'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
