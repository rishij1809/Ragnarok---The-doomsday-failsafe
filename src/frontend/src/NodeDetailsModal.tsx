import React from 'react';
import type { TopologyNode } from './types';
import { Server, X, Activity, Terminal } from 'lucide-react';

interface NodeDetailsModalProps {
  node: TopologyNode | null;
  onClose: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({
  node,
  onClose,
}) => {
  if (!node) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0B0F17] border-l border-[#1E293B] shadow-2xl flex flex-col font-mono text-xs">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-slate-100 tracking-wider">
            INSPECTION PANEL // {node.name}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Node Overview Card */}
        <div className="bg-[#0F172A] p-3 rounded border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold">{node.role}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                node.status === 'HEALTHY' || node.status === 'PRIMARY'
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                  : node.status === 'REPLICA'
                  ? 'bg-blue-950 border-blue-800 text-blue-300'
                  : 'bg-rose-950 border-rose-800 text-rose-300'
              }`}
            >
              {node.status}
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-slate-300">
            <div>IP Address / Endpoint: <span className="text-amber-400 font-bold">{node.ipAddress}</span></div>
            {node.subnet && <div>Subnet Scope: <span className="text-slate-200">{node.subnet}</span></div>}
            <div>Cloud Environment: <span className="text-blue-300 font-bold">{node.cloud}</span></div>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="space-y-2">
          <div className="text-slate-400 text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Node Telemetry Metrics</span>
          </div>
          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            {node.metrics.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 border-b border-[#1E293B] last:border-0 hover:bg-[#1E293B]/40"
              >
                <span className="text-slate-400">{m.label}:</span>
                <span className="text-slate-100 font-bold">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Architectural Notes */}
        <div className="space-y-2">
          <div className="text-slate-400 text-[11px] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Infrastructure Architecture</span>
          </div>
          <div className="bg-[#0B0F17] p-3 rounded border border-[#1E293B] text-slate-300 text-[11px] leading-relaxed">
            {node.details}
          </div>
        </div>
      </div>
    </div>
  );
};
