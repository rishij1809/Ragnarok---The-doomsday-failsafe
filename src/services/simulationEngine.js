/**
 * Simulation Engine (Chaos Engineering & DR Outage Simulator)
 * Allows operators and test scripts to inject region failures, DB replication delays, and network issues.
 */

const healthMonitor = require('./healthMonitor');
const replicationManager = require('./replicationManager');

class SimulationEngine {
  constructor() {
    this.activeSimulations = [];
  }

  /**
   * Inject Primary Region Full Outage
   */
  injectPrimaryOutage() {
    healthMonitor.injectSignalFailure('primary', 'app_http');
    healthMonitor.injectSignalFailure('primary', 'lb_compute', { unhealthyRatio: 1.0 });
    healthMonitor.injectSignalFailure('primary', 'network_reachability');
    replicationManager.setSimulatedLag(120); // Breach RPO

    const sim = {
      id: `sim-${Date.now()}`,
      type: 'PRIMARY_OUTAGE_TOTAL',
      target_region: 'aws-us-east-1',
      description: 'Simulated total datacenter power outage & network drop in primary region',
      injected_at: new Date().toISOString()
    };

    this.activeSimulations.unshift(sim);
    return sim;
  }

  /**
   * Inject High DB Replication Lag (RPO Breach Simulation)
   */
  injectReplicationLag(lagSeconds = 90) {
    replicationManager.setSimulatedLag(lagSeconds);
    const sim = {
      id: `sim-${Date.now()}`,
      type: 'REPLICATION_LAG_SPIKE',
      target_region: 'azure-eastus',
      description: `Simulated network congestion causing DB replication lag of ${lagSeconds}s (RPO breach)`,
      injected_at: new Date().toISOString()
    };
    this.activeSimulations.unshift(sim);
    return sim;
  }

  /**
   * Clear all active chaos injections and recover primary region health
   */
  recoverPrimary() {
    healthMonitor.restoreHealth('primary');
    replicationManager.resetSimulatedLag();
    this.activeSimulations = [];
    return { success: true, message: 'Primary region health restored and chaos injections cleared.' };
  }

  getActiveSimulations() {
    return this.activeSimulations;
  }
}

module.exports = new SimulationEngine();
