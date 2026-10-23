import React, { useState, useRef, useEffect } from 'react';
import type { LogEntry } from './types';
import {
  Terminal,
  Copy,
  Check,
  Search,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowDown,
} from 'lucide-react';

interface TerminalFeedProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const TerminalFeed: React.FC<TerminalFeedProps> = ({
  logs,
  onClearLogs,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isCollapsed]);

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSeverity =
      severityFilter === 'ALL' || log.severity === severityFilter;
    const matchesSearch =
      searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.token && log.token.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSeverity && matchesSearch;
  });

  return (
    <div className="w-full bg-[#0B0F17] border-t border-[#1E293B] font-mono text-xs flex flex-col shadow-2xl z-40">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#0F172A] border-b border-[#1E293B]">
        {/* Left Title & Collapse Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              LIVE TELEMETRY STREAM // TERMINAL LOG ({filteredLogs.length})
            </span>
          </div>
        </div>

        {/* Center: Search & Severity Filters */}
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-500 absolute left-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs or tokens..."
                className="bg-[#0B0F17] border border-[#1E293B] rounded pl-6 pr-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 w-44"
              />
            </div>

            {/* Severity Micro-Pills */}
            <div className="flex items-center gap-1 text-[10px]">
              {['ALL', 'INFO', 'WARN', 'CRITICAL', 'FENCE'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    severityFilter === sev
                      ? 'bg-blue-950 border-blue-700 text-blue-300 font-bold'
                      : 'bg-[#0B0F17] border-[#1E293B] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right: Actions */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                autoScroll
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                  : 'bg-[#0B0F17] border-[#1E293B] text-slate-500'
              }`}
            >
              <ArrowDown className="w-3 h-3" />
              <span>{autoScroll ? 'AUTOSCROLL: ON' : 'PAUSED'}</span>
            </button>
            <button
              onClick={onClearLogs}
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
              title="Clear terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Log Feed Stream */}
      {!isCollapsed && (
        <div
          ref={scrollRef}
          className="h-44 overflow-y-auto p-3 bg-[#0B0F17] space-y-1 font-mono text-[11px] select-text"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic text-center py-4">
              No log entries match current filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-3 py-0.5 hover:bg-[#0F172A]/60 rounded px-1 group"
              >
                <div className="flex items-start gap-2.5 overflow-hidden">
                  <span className="text-slate-500 shrink-0">{log.timestamp}</span>

                  {/* Severity Badge */}
                  <span
                    className={`shrink-0 text-[9px] px-1.5 py-0.2 rounded border font-bold ${
                      log.severity === 'INFO'
                        ? 'bg-slate-900 border-slate-700 text-blue-300'
                        : log.severity === 'WARN'
                        ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                        : log.severity === 'CRITICAL'
                        ? 'bg-rose-950/80 border-rose-800 text-rose-400 font-bold'
                        : 'bg-purple-950/80 border-purple-800 text-purple-300 font-bold'
                    }`}
                  >
                    {log.severity}
                  </span>

                  {/* Source */}
                  <span className="text-amber-400 font-semibold shrink-0">
                    [{log.source}]
                  </span>

                  {/* Message */}
                  <span className="text-slate-200 break-all">{log.message}</span>
                </div>

                {/* Token Copy Action */}
                {log.token && (
                  <button
                    onClick={() => handleCopyToken(log.token!)}
                    className="shrink-0 flex items-center gap-1 text-[10px] bg-[#0F172A] border border-[#1E293B] hover:border-slate-600 text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity"
                    title="Copy incident response token"
                  >
                    {copiedToken === log.token ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>{log.token}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
