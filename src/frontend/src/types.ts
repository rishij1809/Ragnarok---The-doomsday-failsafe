export type CloudProvider = 'AWS' | 'AZURE';

export type OrchestrationState = 
  | 'STATE_NORMAL'
  | 'TRIGGER_VALIDATED'
  | 'FENCE_PRIMARY'
  | 'PROMOTE_DATABASE'
  | 'SCALE_COMPUTE'
  | 'DIVERT_EDGE_TRAFFIC'
  | 'VERIFY_HEALTH'
  | 'DR_ACTIVE'
  | 'STATE_FAILBACK_INITIATED'
  | 'STATE_FAILED';

export interface VantagePoint {
  id: string;
  name: string;
  location: string;
  provider: 'AWS' | 'AZURE' | 'GCP';
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  lastHeartbeat: string;
  ipAddress: string;
}

export interface ReplicationTelemetry {
  lagBytes: number;
  lagSeconds: number;
  lsnHex: string;
  estimatedRpoMs: number;
  replayQueueSize: number;
  syncState: 'SYNCHRONIZED' | 'LAGGING' | 'SPLIT-BRAIN RISK' | 'PAUSED';
}

export interface IngressTelemetry {
  totalRps: number;
  http2xxRate: number;
  http5xxRate: number;
  dnsDurationMs: number;
  activeEdge: 'AWS_US_EAST_1' | 'AZURE_EASTUS';
}

export interface InterconnectTelemetry {
  vpnTunnelStatus: 'UP' | 'DEGRADED' | 'DOWN' | 'SEVERED';
  rttLatencyMs: number;
  rttJitterMs: number;
  packetLossPercent: number;
  fragmentationRate: number;
  throughputMbps: number;
}

export interface TelemetryHistoryPoint {
  timestamp: string;
  replicationLagBytes: number;
  rpoMs: number;
  rps: number;
  http5xx: number;
  rttLatencyMs: number;
  jitterMs: number;
  packetLoss: number;
}

export interface OrchestrationStep {
  stepId: number;
  name: string;
  phase: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
  timestamp?: string;
  details?: string;
  logs?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL' | 'FENCE';
  source: string;
  message: string;
  token?: string;
  nodeId?: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  role: string;
  cloud: 'CLOUDFLARE' | 'AWS' | 'AZURE' | 'VPN';
  status: 'HEALTHY' | 'DEGRADED' | 'FENCED' | 'DOWN' | 'PRIMARY' | 'REPLICA';
  ipAddress: string;
  subnet?: string;
  metrics: {
    label: string;
    value: string;
  }[];
  details: string;
}

export interface SystemStatus {
  activeCloud: CloudProvider;
  isDrPromoted: boolean;
  isFenced: boolean;
  fencingEpoch: number;
  commitSha: string;
  rtoRunningSeconds: number;
  rttMs: number;
  vantagePoints: VantagePoint[];
  replication: ReplicationTelemetry;
  ingress: IngressTelemetry;
  interconnect: InterconnectTelemetry;
  orchestrationState: OrchestrationState;
  orchestrationSteps: OrchestrationStep[];
}

export type ChaosScenario = 
  | 'SEVER_VPN'
  | 'TERMINATE_AWS_RDS'
  | 'BLACKHOLE_AWS_VPC'
  | 'INITIATE_FAILBACK';
