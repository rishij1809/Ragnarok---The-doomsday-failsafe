import { useState, useEffect } from 'react';
import type {
  SystemStatus,
  LogEntry,
  TelemetryHistoryPoint,
  TopologyNode,
  ChaosScenario,
} from './types';
import {
  initialSystemStatus,
  initialLogs,
  generateHistoricalTelemetry,
  getInitialTopologyNodes,
} from './mockData';
import { Header } from './Header';
import { TopologyMap } from './TopologyMap';
import { TelemetryGauges } from './TelemetryGauges';
import { OrchestrationStepper } from './OrchestrationStepper';
import { ChaosControls } from './ChaosControls';
import { TerminalFeed } from './TerminalFeed';
import { EmergencyOverrideModal } from './EmergencyOverrideModal';
import { NodeDetailsModal } from './NodeDetailsModal';

export function App() {
  const [status, setStatus] = useState<SystemStatus>(initialSystemStatus);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>(generateHistoricalTelemetry);
  const [nodes, setNodes] = useState<TopologyNode[]>(getInitialTopologyNodes(false));

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [isChaosOpen, setIsChaosOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isExecutingChaos, setIsExecutingChaos] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ChaosScenario | null>(null);

  // 1. Real-Time Telemetry Ticker Interval (1000ms loop for jitter & sparkline updates)
  useEffect(() => {
    const interval = setInterval(() => {
      const isFailover = status.activeCloud === 'AZURE' || status.isDrPromoted;

      // Jitter metrics
      const newRtt = Math.max(18, 24.5 + (Math.random() * 2 - 1));
      const newJitter = Math.max(0.4, 1.2 + (Math.random() * 0.4 - 0.2));
      const newRps = Math.max(40, 54.2 + (Math.random() * 4 - 2));
      const newLagBytes = isFailover
        ? 0
        : Math.max(400, 1024 + Math.floor(Math.random() * 300 - 150));

      setStatus((prev) => ({
        ...prev,
        rttMs: newRtt,
        rtoRunningSeconds: prev.isDrPromoted || isExecutingChaos ? prev.rtoRunningSeconds + 0.1 : prev.rtoRunningSeconds,
        replication: {
          ...prev.replication,
          lagBytes: newLagBytes,
        },
        ingress: {
          ...prev.ingress,
          totalRps: Number(newRps.toFixed(1)),
        },
        interconnect: {
          ...prev.interconnect,
          rttLatencyMs: Number(newRtt.toFixed(1)),
          rttJitterMs: Number(newJitter.toFixed(2)),
        },
      }));

      // Append sparkline history point
      const nowStr = new Date().toTimeString().split(' ')[0];
      setHistory((prev) => {
        const next = [
          ...prev.slice(1),
          {
            timestamp: nowStr,
            replicationLagBytes: newLagBytes,
            rpoMs: isFailover ? 0 : 48,
            rps: Number(newRps.toFixed(1)),
            http5xx: isFailover ? 0.0 : 0.02,
            rttLatencyMs: Number(newRtt.toFixed(1)),
            jitterMs: Number(newJitter.toFixed(2)),
            packetLoss: 0.0,
          },
        ];
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status.activeCloud, status.isDrPromoted, isExecutingChaos]);

  // 2. Poll Backend Django API when available (graceful fallback to mock if offline)
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const res = await fetch('/api/dr/quorum-status/');
        if (res.ok) {
          const data = await res.json();
          if (data && data.quorum_state) {
            setStatus((prev) => ({
              ...prev,
              fencingEpoch: data.epoch || prev.fencingEpoch,
            }));
          }
        }
      } catch (err) {
        // Backend not running locally yet; continuing smoothly with high-fidelity live telemetry
      }
    };
    fetchBackendData();
  }, []);

  // 3. Chaos Engineering Drill Handler
  const handleRunChaosDrill = (scenario: ChaosScenario) => {
    setIsExecutingChaos(true);
    setActiveScenario(scenario);

    const now = new Date().toTimeString().split(' ')[0];
    const token = `tok_drill_${Math.random().toString(36).substring(2, 8)}`;

    if (scenario === 'SEVER_VPN') {
      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: now,
        severity: 'CRITICAL',
        source: 'vpn.tunnel',
        message: 'IPsec BGP session SEVERED via chaos injection! Interconnect down.',
        token,
      };
      setLogs((prev) => [...prev, newLog]);

      setStatus((prev) => ({
        ...prev,
        interconnect: {
          ...prev.interconnect,
          vpnTunnelStatus: 'SEVERED',
          throughputMbps: 0,
        },
      }));
    } else if (scenario === 'TERMINATE_AWS_RDS' || scenario === 'BLACKHOLE_AWS_VPC') {
      const fenceToken = `tok_fence_${Math.random().toString(36).substring(2, 8)}`;
      const log1: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: now,
        severity: 'FENCE',
        source: 'fencer.aws',
        message: `Fencing Token #${status.fencingEpoch + 1} issued! Revoking AWS write paths.`,
        token: fenceToken,
      };

      const log2: LogEntry = {
        id: `log-${Date.now() + 1}`,
        timestamp: now,
        severity: 'CRITICAL',
        source: 'orchestrator.pipeline',
        message: 'Disaster Cutover initiated: Promoting Azure Flexible Server PostgreSQL to Master.',
        token: `tok_cutover_${Math.random().toString(36).substring(2, 8)}`,
      };

      setLogs((prev) => [...prev, log1, log2]);

      // State Transition pipeline execution simulation
      setStatus((prev) => ({
        ...prev,
        activeCloud: 'AZURE',
        isDrPromoted: true,
        isFenced: true,
        fencingEpoch: prev.fencingEpoch + 1,
        orchestrationState: 'DR_ACTIVE',
        ingress: {
          ...prev.ingress,
          activeEdge: 'AZURE_EASTUS',
        },
        replication: {
          ...prev.replication,
          syncState: 'PAUSED',
        },
        interconnect: {
          ...prev.interconnect,
          vpnTunnelStatus: 'SEVERED',
        },
      }));

      setNodes(getInitialTopologyNodes(true));
    } else if (scenario === 'INITIATE_FAILBACK') {
      handleConfirmOverride();
    }

    setTimeout(() => {
      setIsExecutingChaos(false);
      setActiveScenario(null);
    }, 2000);
  };

  // 4. Emergency Override Handler (Failover or Failback)
  const handleConfirmOverride = () => {
    const isFailover = status.activeCloud === 'AZURE' || status.isDrPromoted;
    const now = new Date().toTimeString().split(' ')[0];
    const token = `tok_ovr_${Math.random().toString(36).substring(2, 8)}`;

    if (isFailover) {
      // Failback to AWS
      const log: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: now,
        severity: 'INFO',
        source: 'orchestrator.failback',
        message: 'Failback completed successfully! Primary route posture restored to AWS us-east-1.',
        token,
      };
      setLogs((prev) => [...prev, log]);

      setStatus((prev) => ({
        ...prev,
        activeCloud: 'AWS',
        isDrPromoted: false,
        isFenced: false,
        orchestrationState: 'STATE_NORMAL',
        ingress: {
          ...prev.ingress,
          activeEdge: 'AWS_US_EAST_1',
        },
        replication: {
          ...prev.replication,
          syncState: 'SYNCHRONIZED',
        },
        interconnect: {
          ...prev.interconnect,
          vpnTunnelStatus: 'UP',
        },
      }));
      setNodes(getInitialTopologyNodes(false));
    } else {
      // Emergency Manual Failover to Azure
      handleRunChaosDrill('TERMINATE_AWS_RDS');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-300 flex flex-col font-sans selection:bg-slate-800">
      {/* Sticky Top Header */}
      <Header
        status={status}
        onOpenOverrideModal={() => setIsOverrideModalOpen(true)}
        onToggleChaosPanel={() => setIsChaosOpen(!isChaosOpen)}
        isChaosOpen={isChaosOpen}
      />

      {/* Main Control Grid (High-Density Multi-Pane Layout) */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-[1920px] mx-auto w-full">
        {/* Pane A: Cross-Cloud Topology & Live Wireframe Map (Span 7 cols) */}
        <section className="lg:col-span-7 flex flex-col min-h-[480px]">
          <TopologyMap
            status={status}
            nodes={nodes}
            onSelectNode={(node) => setSelectedNode(node)}
          />
        </section>

        {/* Right Side Column (Span 5 cols): Pane B & Pane C */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          {/* Pane B: Core Telemetry & SLO Gauges */}
          <div className="flex-1 min-h-[300px]">
            <TelemetryGauges status={status} history={history} />
          </div>

          {/* Pane C: Central State Machine & 7-Phase Orchestration Stepper */}
          <div className="flex-1 min-h-[320px]">
            <OrchestrationStepper status={status} />
          </div>
        </section>
      </main>

      {/* Live Telemetry Stream / Collapsible Terminal Log */}
      <TerminalFeed logs={logs} onClearLogs={() => setLogs([])} />

      {/* Slide-Over / Drawers / Modals */}
      <ChaosControls
        isOpen={isChaosOpen}
        onClose={() => setIsChaosOpen(false)}
        onRunChaosDrill={handleRunChaosDrill}
        isExecuting={isExecutingChaos}
        activeScenario={activeScenario}
      />

      <EmergencyOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        status={status}
        onConfirmOverride={handleConfirmOverride}
      />

      <NodeDetailsModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default App;
