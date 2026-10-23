import React, { useState } from 'react';
import type { SystemStatus } from './types';
import {
  GitCommit,
  Clock,
  ChevronDown,
  ChevronRight,
  Terminal,
} from 'lucide-react';

interface OrchestrationStepperProps {
  status: SystemStatus;
}

export const OrchestrationStepper: React.FC<OrchestrationStepperProps> = ({
  status,
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const toggleStep = (stepId: number) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const totalOrchestrationTimeMs = status.orchestrationSteps.reduce(
    (acc, step) => acc + (step.durationMs || 0),
    0
  );

  return (
    <div className="flex flex-col h-full bg-[#0B0F17] border border-[#1E293B] rounded-md overflow-hidden shadow-md">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0F172A] border-b border-[#1E293B]">
        <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
          <GitCommit className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold tracking-wider uppercase">
            Pane C // Central State Machine & 7-Phase Orchestration Pipeline
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>STATE:</span>
          <span className="text-amber-400 font-bold">{status.orchestrationState}</span>
          <span className="text-slate-600">|</span>
          <span>TOTAL DRILL RTO:</span>
          <span className="text-emerald-400 font-bold">{(totalOrchestrationTimeMs / 1000).toFixed(3)}s</span>
        </div>
      </div>

      {/* Stepper Pipeline Container */}
      <div className="p-3.5 flex-1 overflow-y-auto space-y-2 bg-[#0B0F17]">
        {status.orchestrationSteps.map((step) => {
          const isExpanded = expandedStep === step.stepId;
          const isCompleted = step.status === 'COMPLETED';
          const isRunning = step.status === 'RUNNING';
          const isFailed = step.status === 'FAILED';

          return (
            <div
              key={step.stepId}
              className={`border rounded-md transition-all ${
                isCompleted
                  ? 'bg-[#0F172A]/80 border-[#1E293B]'
                  : isRunning
                  ? 'bg-amber-950/20 border-amber-800/80 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : isFailed
                  ? 'bg-rose-950/20 border-rose-800'
                  : 'bg-[#0B0F17] border-slate-900 opacity-60'
              }`}
            >
              {/* Step Header */}
              <div
                onClick={() => toggleStep(step.stepId)}
                className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-[#1E293B]/40 transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  {/* Step Status Badge Icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                      isCompleted
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        : isRunning
                        ? 'bg-amber-950 border border-amber-600 text-amber-300 animate-pulse'
                        : isFailed
                        ? 'bg-rose-950 border border-rose-700 text-rose-300'
                        : 'bg-slate-900 border border-slate-700 text-slate-500'
                    }`}
                  >
                    {step.stepId}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-100">
                      <span>{step.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal border border-slate-700">
                        {step.phase}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {step.details}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{step.timestamp}</span>
                    <span className="text-slate-600">({step.durationMs}ms)</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      isCompleted
                        ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                        : isRunning
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-300 animate-pulse'
                        : isFailed
                        ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {step.status}
                  </span>

                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Step Expanded Details Panel */}
              {isExpanded && step.logs && step.logs.length > 0 && (
                <div className="p-3 bg-[#0B0F17] border-t border-[#1E293B] font-mono text-[11px] space-y-1.5">
                  <div className="text-slate-500 text-[10px] flex items-center gap-1 uppercase tracking-wider">
                    <Terminal className="w-3 h-3 text-amber-400" />
                    <span>Step Audit Trait Trail:</span>
                  </div>
                  {step.logs.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-600">›</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
