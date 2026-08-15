/**
 * Ragnarok - Multi-Cloud Disaster Recovery System Configuration
 */

module.exports = {
  projectName: 'Ragnarok',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  
  // Regions definition
  regions: {
    primary: {
      id: 'aws-us-east-1',
      name: 'AWS US-East (N. Virginia)',
      provider: 'AWS',
      role: 'primary',
      endpoint: 'https://primary.ragnarok-dr.internal/health',
      capacity: 100, // percentage target compute capacity
      dbRole: 'writer'
    },
    secondary: {
      id: 'azure-eastus',
      name: 'Azure East US',
      provider: 'Azure',
      role: 'secondary',
      endpoint: 'https://secondary.ragnarok-dr.internal/health',
      capacity: 20, // warm standby baseline percentage
      dbRole: 'reader'
    }
  },

  // SLA Targets
  sla: {
    rtoSeconds: 300, // < 5 minutes
    rpoSeconds: 60,  // < 1 minute
    mttdSeconds: 60  // Mean time to detect < 60 seconds
  },

  // Health check signals configuration (as specified in 3_Design.pdf)
  healthChecks: {
    confirmationWindowSeconds: 45, // Sustained down window before triggering failover
    checkIntervalMs: 5000, // Background health probe frequency
    signals: [
      {
        id: 'app_http',
        name: 'Application HTTP Synthetic Check',
        weight: 0.35,
        intervalSec: 10,
        failureThreshold: 3 // 3 consecutive failures
      },
      {
        id: 'db_replication',
        name: 'Database Connectivity & Replication Lag',
        weight: 0.30,
        intervalSec: 15,
        maxLagSec: 60
      },
      {
        id: 'lb_compute',
        name: 'Load Balancer & Compute Target Health',
        weight: 0.20,
        intervalSec: 15,
        maxUnhealthyRatio: 0.50 // >50% unhealthy targets
      },
      {
        id: 'network_reachability',
        name: 'Cross-Region Network Reachability',
        weight: 0.15,
        intervalSec: 30,
        failureThreshold: 3
      }
    ]
  },

  // Status thresholds
  thresholds: {
    degradedHealthScore: 70, // Below 70% composite health -> DEGRADED
    downHealthScore: 30       // Below 30% composite health -> DOWN
  },

  // Backup policy configuration
  backups: {
    schedule: '0 */6 * * *', // Every 6 hours
    retentionDays: 30,
    drillsIntervalHours: 24
  }
};
