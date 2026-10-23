import React, { useState } from 'react';
import type { SystemStatus } from './types';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

interface EmergencyOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus;
  onConfirmOverride: () => void;
}

export const EmergencyOverrideModal: React.FC<EmergencyOverrideModalProps> = ({
  isOpen,
  onClose,
  status,
  onConfirmOverride,
}) => {
  const [typedConfirm, setTypedConfirm] = useState('');

  if (!isOpen) return null;

  const isFailover = status.activeCloud === 'AZURE' || status.isDrPromoted;
  const targetAction = isFailover ? 'FAILBACK' : 'FAILOVER';

  const isMatching = typedConfirm.toUpperCase() === targetAction;

  const handleConfirm = () => {
    if (isMatching) {
      onConfirmOverride();
      setTypedConfirm('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#0B0F17] border border-rose-800/80 rounded-lg max-w-md w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 bg-rose-950/40 border-b border-rose-900/60">
          <div className="flex items-center gap-2 text-rose-300">
            <ShieldAlert className="w-5 h-5 animate-pulse text-rose-400" />
            <span className="font-bold text-sm tracking-wider">
              EMERGENCY OVERRIDE // DISASTER RECOVERY
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3.5 text-xs text-slate-300">
          <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded space-y-1">
            <div className="font-bold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Target Operation: {targetAction} TO {isFailover ? 'AWS (us-east-1)' : 'AZURE (eastus)'}</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              {isFailover
                ? 'This will fence Azure Standby PostgreSQL, restore reverse WAL replication slot to AWS Aurora, and update Cloudflare Anycast edge DNS pool back to AWS.'
                : 'This will issue Fencing Epoch #' + (status.fencingEpoch + 1) + ', revoke write permissions on AWS us-east-1, promote Azure Flexible Server to Master, and divert 100% ingress to Azure.'}
            </p>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="text-slate-400">Current Epoch: <span className="text-slate-200 font-bold">#{status.fencingEpoch}</span></div>
            <div className="text-slate-400">Quorum Consensus: <span className="text-emerald-400 font-bold">3/3 Voters Healthy</span></div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-300 text-[11px]">
              Type <span className="text-rose-400 font-bold">"{targetAction}"</span> to confirm manual override:
            </label>
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder={`Type ${targetAction}...`}
              className="w-full bg-[#0F172A] border border-[#1E293B] rounded px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-rose-500 text-xs"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#0F172A] border-t border-[#1E293B] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#1E293B] text-slate-400 hover:text-slate-200 text-xs"
          >
            Cancel
          </button>
          <button
            disabled={!isMatching}
            onClick={handleConfirm}
            className={`px-4 py-1.5 rounded font-mono text-xs font-bold transition-all border ${
              isMatching
                ? 'bg-rose-950 hover:bg-rose-900 border-rose-600 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            CONFIRM {targetAction}
          </button>
        </div>
      </div>
    </div>
  );
};
