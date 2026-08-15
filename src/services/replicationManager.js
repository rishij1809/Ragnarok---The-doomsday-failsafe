/**
 * Replication Manager Service (Phase 2 Data Layer)
 * Manages database cross-region replication lag, object storage sync, RPO metric tracking, and standby promotion.
 */

const config = require('../config');

class ReplicationManager {
  constructor() {
    this.primaryRegion = config.regions.primary;
    this.secondaryRegion = config.regions.secondary;

    // Replication State
    this.dbReplication = {
      resource_id: 'ragnarok-db-aurora',
      resource_type: 'RelationalDatabase',
      source_region: this.primaryRegion.id,
      target_region: this.secondaryRegion.id,
      replication_mode: 'Asynchronous (Aurora Global DB / CDC)',
      lag_seconds: 1.2, // Base healthy lag ~1.2s
      rpo_target_seconds: config.sla.rpoSeconds,
      rpo_breach: false,
      last_synced_at: new Date().toISOString(),
      standby_promoted: false,
      writer_region: this.primaryRegion.id
    };

    this.storageReplication = {
      resource_id: 'ragnarok-s3-storage',
      resource_type: 'ObjectStorage',
      source_region: this.primaryRegion.id,
      target_region: this.secondaryRegion.id,
      replication_mode: 'S3 Cross-Region Replication (CRR) -> Azure Blob GRS',
      lag_seconds: 4.5,
      objects_synced_per_min: 1420,
      rpo_target_seconds: config.sla.rpoSeconds,
      rpo_breach: false,
      last_synced_at: new Date().toISOString()
    };

    this.lagHistory = [];
    this.startPeriodicTelemetry();
  }

  /**
   * Start simulating live continuous replication updates
   */
  startPeriodicTelemetry() {
    const timer = setInterval(() => {
      // Add slight normal jitter unless manual lag override is active
      if (!this.manualLagOverride) {
        const jitter = (Math.random() * 0.8 - 0.4); // +/- 0.4s
        this.dbReplication.lag_seconds = Math.max(0.2, Number((this.dbReplication.lag_seconds + jitter).toFixed(2)));
        this.storageReplication.lag_seconds = Math.max(0.5, Number((this.storageReplication.lag_seconds + jitter).toFixed(2)));
      }

      this.dbReplication.last_synced_at = new Date().toISOString();
      this.storageReplication.last_synced_at = new Date().toISOString();

      // Check RPO Breach
      this.dbReplication.rpo_breach = this.dbReplication.lag_seconds > config.sla.rpoSeconds;
      this.storageReplication.rpo_breach = this.storageReplication.lag_seconds > config.sla.rpoSeconds;

      // Log historical metric for dashboard charts
      this.lagHistory.push({
        timestamp: new Date().toLocaleTimeString(),
        db_lag: this.dbReplication.lag_seconds,
        storage_lag: this.storageReplication.lag_seconds,
        rpo_limit: config.sla.rpoSeconds
      });

      // Keep maximum 30 data points in memory
      if (this.lagHistory.length > 30) {
        this.lagHistory.shift();
      }
    }, 3000);

    if (timer.unref) timer.unref();
  }

  /**
   * Get current replication status and telemetry
   */
  getStatus() {
    return {
      db_replication: this.dbReplication,
      storage_replication: this.storageReplication,
      historical_lag: this.lagHistory,
      rpo_status: {
        target_seconds: config.sla.rpoSeconds,
        compliant: !this.dbReplication.rpo_breach && !this.storageReplication.rpo_breach,
        current_db_lag: this.dbReplication.lag_seconds,
        current_storage_lag: this.storageReplication.lag_seconds
      }
    };
  }

  /**
   * Manually override replication lag (for simulation / chaos testing)
   */
  setSimulatedLag(lagSeconds) {
    this.manualLagOverride = true;
    this.dbReplication.lag_seconds = lagSeconds;
    this.storageReplication.lag_seconds = lagSeconds * 1.5;
    this.dbReplication.rpo_breach = this.dbReplication.lag_seconds > config.sla.rpoSeconds;
    this.storageReplication.rpo_breach = this.storageReplication.lag_seconds > config.sla.rpoSeconds;
  }

  /**
   * Reset simulated lag back to normal healthy baseline
   */
  resetSimulatedLag() {
    this.manualLagOverride = false;
    this.dbReplication.lag_seconds = 1.2;
    this.storageReplication.lag_seconds = 4.5;
    this.dbReplication.rpo_breach = false;
    this.storageReplication.rpo_breach = false;
  }

  /**
   * Promote Standby Database to Primary Writer (Failover Action - Step 4)
   */
  promoteStandbyDatabase() {
    this.dbReplication.standby_promoted = true;
    this.dbReplication.writer_region = this.secondaryRegion.id;
    this.dbReplication.replication_mode = 'Reversed Replication (Azure Primary -> AWS Standby)';
    this.dbReplication.lag_seconds = 0.5; // Instant promotion
    return {
      success: true,
      promoted_region: this.secondaryRegion.id,
      new_role: 'PRIMARY_WRITER',
      promoted_at: new Date().toISOString()
    };
  }

  /**
   * Demote Secondary back to Standby (Failback Action)
   */
  demoteSecondaryDatabase() {
    this.dbReplication.standby_promoted = false;
    this.dbReplication.writer_region = this.primaryRegion.id;
    this.dbReplication.replication_mode = 'Asynchronous (Aurora Global DB / CDC)';
    this.dbReplication.lag_seconds = 1.2;
    return {
      success: true,
      demoted_region: this.secondaryRegion.id,
      new_role: 'STANDBY_READER',
      restored_at: new Date().toISOString()
    };
  }
}

module.exports = new ReplicationManager();
