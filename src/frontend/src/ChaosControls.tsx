import React, { useState } from 'react';
import type { ChaosScenario } from './types';
import {
  Flame,
  ShieldAlert,
  Lock,
  X,
  Play,
} from 'lucide-react';

interface ChaosControlsProps {
  isOpen: boolean;
  onClose: () => void;
  onRunChaosDrill: (scenario: ChaosScenario) => void;
  isExecuting: boolean;
  activeScenario?: ChaosScenario | null;
}

export const ChaosControls: React.FC<ChaosControlsProps> = ({
  isOpen,
  onClose,
  onRunChaosDrill,
  isExecuting,
  activeScenario,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<ChaosScenario | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [sliderValue, setSliderValue] = useState(0);

  if (!isOpen) return null;

  const scenarios: {
    id: ChaosScenario;
    title: string;
    description: string;
    impact: string;
    color: string;
  }[] = [
    {
      id: 'SEVER_VPN',
      title: 'Sever IPsec VPN Tunnel',
      description: 'Simulates network partition across cross-cloud IPSec interconnect BGP session.',
      impact: 'Triggers quorum heartbeat timeouts (24ms -> Infinity) & pauses WAL stream.',
      color: 'amber',
    },
    {
      id: 'TERMINATE_AWS_RDS',
      title: 'Terminate AWS RDS Primary DB',
      description: 'Issues AWS API reboot-with-failover or forced node termination on Aurora Primary.',
      impact: 'Fences AWS DB parameter group & promotes Azure Flexible Server to Read-Write.',
      color: 'rose',
    },
    {
      id: 'BLACKHOLE_AWS_VPC',
      title: 'Blackhole AWS VPC Route Table',
      description: 'Simulates complete AWS us-east-1 regional blackout by blackholing 10.100.0.0/16.',
      impact: 'Full 7-phase disaster cutover pipeline triggered automatically.',
      color: 'rose',
    },
    {
      id: 'INITIATE_FAILBACK',
      title: 'Initiate Failback to AWS Primary',
      description: 'Establishes reverse catch-up WAL replication from Azure back to AWS us-east-1.',
      impact: 'Restores primary route posture to AWS after smoke testing passes.',
      color: 'emerald',
    },
  ];

  const handleSelectScenario = (sc: ChaosScenario) => {
    setSelectedScenario(sc);
    setConfirmInput('');
    setSliderValue(0);
  };

  const isConfirmed = confirmInput.toUpperCase() === 'EXECUTE' && sliderValue >= 100;

  const handleConfirmAndExecute = () => {
    if (selectedScenario && isConfirmed) {
      onRunChaosDrill(selectedScenario);
      setSelectedScenario(null);
      setConfirmInput('');
      setSliderValue(0);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#0B0F17] border-l border-[#1E293B] shadow-2xl flex flex-col font-mono">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
          <span className="font-bold text-sm text-slate-100 tracking-wider">
            DISASTER DRILL SIMULATOR // CHAOS ENGINEERING
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Safety Notice */}
      <div className="p-3 bg-amber-950/30 border-b border-amber-900/50 flex items-center gap-2 text-xs text-amber-300">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
        <span>
          Safety Interlock Engaged: All chaos triggers require 2-step verification and safety slider unlock.
        </span>
      </div>

      {/* Scenario List */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        {scenarios.map((sc) => {
          const isSelected = selectedScenario === sc.id;
          const isCurrentlyActive = activeScenario === sc.id && isExecuting;

          return (
            <div
              key={sc.id}
              onClick={() => !isExecuting && handleSelectScenario(sc.id)}
              className={`p-3.5 rounded border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#0F172A] border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : isCurrentlyActive
                  ? 'bg-rose-950/40 border-rose-600 animate-pulse'
                  : 'bg-[#0F172A]/70 border-[#1E293B] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-slate-100">{sc.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                    sc.color === 'emerald'
                      ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                      : sc.color === 'amber'
                      ? 'bg-amber-950 border-amber-800 text-amber-300'
                      : 'bg-rose-950 border-rose-800 text-rose-300'
                  }`}
                >
                  [{sc.id}]
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mb-2">{sc.description}</div>
              <div className="text-[10px] text-slate-500 bg-[#0B0F17] p-1.5 rounded border border-slate-900">
                <span className="text-slate-400 font-bold">IMPACT:</span> {sc.impact}
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Interlock Modal Drawer section when a scenario is selected */}
      {selectedScenario && (
        <div className="p-4 bg-[#0F172A] border-t border-[#1E293B] space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-400">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>SAFETY INTERLOCK VERIFICATION</span>
            </div>
            <button
              onClick={() => setSelectedScenario(null)}
              className="text-[10px] text-slate-400 hover:text-slate-200 underline"
            >
              CANCEL
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <label className="block text-slate-300 text-[11px]">
              1. Type <span className="text-amber-400 font-bold">"EXECUTE"</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type EXECUTE..."
              className="w-full bg-[#0B0F17] border border-[#1E293B] rounded px-3 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-[11px] text-slate-300">
              <span>2. Slide Safety Switch to 100%:</span>
              <span className="font-bold text-amber-400">{sliderValue}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full h-2 bg-slate-900 rounded appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <button
            disabled={!isConfirmed || isExecuting}
            onClick={handleConfirmAndExecute}
            className={`w-full py-2.5 rounded font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
              isConfirmed && !isExecuting
                ? 'bg-rose-950 hover:bg-rose-900 border-rose-600 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>
              {isExecuting
                ? 'EXECUTING CHAOS DRILL...'
                : `FIRE DRILL: ${selectedScenario}`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
