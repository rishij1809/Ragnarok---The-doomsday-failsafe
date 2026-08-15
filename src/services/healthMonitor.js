/**
 * Health Monitor Service (Phase 3 Automation)
 * Performs continuous multi-signal health checks, calculates weighted composite health score,
 * tracks failure confirmation window (45s), and emits region state updates.
 */

const config = require('../config');
const replicationManager = require('./replicationManager');
const notificationService = require('./notificationService');

class HealthMonitor {
  constructor() {
    this.primaryRegion = { ...config.regions.primary };
    this.secondaryRegion = { ...config.regions.secondary };

    // Initial signal statuses for Primary (AWS)
    this.primarySignals = {
      app_http: { pass: true, latency_ms: 24, consecutive_failures: 0 },
      db_replication: { pass: true, latency_ms: 12, lag_seconds: 1.2 },
      lb_compute: { pass: true, unhealthy_ratio: 0.0, healthy_instances: 8, total_instances: 8 },
      network_reachability: { pass: true, latency_ms: 38, consecutive_timeouts: 0 }
    };

    // Initial signal statuses for Secondary (Azure)
    this.secondarySignals = {
      app_http: { pass: true, latency_ms: 32, consecutive_failures: 0 },
      db_replication: { pass: true, latency_ms: 18, lag_seconds: 1.2 },
      lb_compute: { pass: true, unhealthy_ratio: 0.0, healthy_instances: 2, total_instances: 2 },
      network_reachability: { pass: true, latency_ms: 38, consecutive_timeouts: 0 }
    };

    this.primaryHealthScore = 100;
    this.secondaryHealthScore = 100;
    this.primaryStatus = 'HEALTHY'; // HEALTHY | DEGRADED | DOWN
    this.secondaryStatus = 'HEALTHY';

    this.primaryDownStartedAt = null; // Track confirmation window (45s)
    this.history = [];

    this.listeners = [];
  }

  /**
   * Register state transition listener (e.g. Failover Orchestrator)
   */
  onStateChange(listener) {
    this.listeners.push(listener);
  }

  /**
   * Evaluate multi-signal composite health for a region
   */
  evaluateRegionHealth(signals) {
    let score = 0;

    // Signal 1: App HTTP synthetic check (35% weight)
    if (signals.app_http.pass && signals.app_http.consecutive_failures < 3) {
      score += 35;
    }

    // Signal 2: Database connectivity & replication lag (30% weight)
    const currentDbLag = replicationManager.getStatus().db_replication.lag_seconds;
    if (signals.db_replication.pass && currentDbLag <= config.sla.rpoSeconds) {
      score += 30;
    }

    // Signal 3: Load Balancer & compute target health (20% weight)
    if (signals.lb_compute.pass && signals.lb_compute.unhealthy_ratio <= 0.50) {
      score += 20;
    }

    // Signal 4: Cross-region network reachability (15% weight)
    if (signals.network_reachability.pass && signals.network_reachability.consecutive_timeouts < 3) {
      score += 15;
    }

    return score;
  }

  /**
   * Main background health check execution tick
   */
  checkHealth() {
    this.primaryHealthScore = this.evaluateRegionHealth(this.primarySignals);
    this.secondaryHealthScore = this.evaluateRegionHealth(this.secondarySignals);

    // Evaluate Primary Region Status
    const prevPrimaryStatus = this.primaryStatus;
    if (this.primaryHealthScore >= config.thresholds.degradedHealthScore) {
      this.primaryStatus = 'HEALTHY';
      this.primaryDownStartedAt = null;
    } else if (this.primaryHealthScore >= config.thresholds.downHealthScore) {
      this.primaryStatus = 'DEGRADED';
      this.primaryDownStartedAt = null;
    } else {
      // Health score < 30% (DOWN candidate)
      if (!this.primaryDownStartedAt) {
        this.primaryDownStartedAt = Date.now();
      }

      const elapsedDownSec = (Date.now() - this.primaryDownStartedAt) / 1000;
      if (elapsedDownSec >= config.healthChecks.confirmationWindowSeconds) {
        this.primaryStatus = 'DOWN';
      } else {
        this.primaryStatus = 'DEGRADED'; // Pending confirmation window
      }
    }

    // Emit notification on status change
    if (prevPrimaryStatus !== this.primaryStatus) {
      const severity = this.primaryStatus === 'DOWN' ? 'CRITICAL' : (this.primaryStatus === 'DEGRADED' ? 'WARNING' : 'INFO');
      notificationService.sendAlert(
        `evt-health-${Date.now()}`,
        `Primary Region (${this.primaryRegion.name}) health state changed from ${prevPrimaryStatus} to ${this.primaryStatus} (Score: ${this.primaryHealthScore}%)`,
        severity
      );

      // Notify listeners (Failover Orchestrator)
      this.listeners.forEach(fn => fn(this.primaryStatus, this.primaryHealthScore, this.getHealthData()));
    }

    // Record health check result for time series telemetry
    const record = {
      timestamp: new Date().toLocaleTimeString(),
      primary_score: this.primaryHealthScore,
      primary_status: this.primaryStatus,
      secondary_score: this.secondaryHealthScore,
      secondary_status: this.secondaryStatus,
      primary_down_duration_sec: this.primaryDownStartedAt ? Math.floor((Date.now() - this.primaryDownStartedAt) / 1000) : 0
    };

    this.history.push(record);
    if (this.history.length > 30) this.history.shift();

    return this.getHealthData();
  }

  /**
   * Return formatted health data for API endpoint (/api/v1/regions/health)
   */
  getHealthData() {
    return {
      regions: [
        {
          region_id: this.primaryRegion.id,
          provider: this.primaryRegion.provider,
          name: this.primaryRegion.name,
          role: this.primaryRegion.role,
          status: this.primaryStatus,
          health_score: this.primaryHealthScore,
          signals: this.primarySignals
        },
        {
          region_id: this.secondaryRegion.id,
          provider: this.secondaryRegion.provider,
          name: this.secondaryRegion.name,
          role: this.secondaryRegion.role,
          status: this.secondaryStatus,
          health_score: this.secondaryHealthScore,
          signals: this.secondarySignals
        }
      ],
      confirmation_window: {
        required_seconds: config.healthChecks.confirmationWindowSeconds,
        current_down_duration_seconds: this.primaryDownStartedAt ? Math.floor((Date.now() - this.primaryDownStartedAt) / 1000) : 0
      },
      telemetry_history: this.history
    };
  }

  /**
   * Inject health signal failure for testing / chaos simulation
   */
  injectSignalFailure(region, signalId, options = {}) {
    const targetSignals = region === 'primary' ? this.primarySignals : this.secondarySignals;
    if (targetSignals[signalId]) {
      targetSignals[signalId].pass = false;
      if (signalId === 'app_http') targetSignals[signalId].consecutive_failures = 3;
      if (signalId === 'lb_compute') targetSignals[signalId].unhealthy_ratio = options.unhealthyRatio || 0.75;
      if (signalId === 'network_reachability') targetSignals[signalId].consecutive_timeouts = 3;
    }
  }

  /**
   * Restore health signals back to 100% healthy
   */
  restoreHealth(region = 'primary') {
    const targetSignals = region === 'primary' ? this.primarySignals : this.secondarySignals;
    Object.keys(targetSignals).forEach(key => {
      targetSignals[key].pass = true;
      if (targetSignals[key].consecutive_failures !== undefined) targetSignals[key].consecutive_failures = 0;
      if (targetSignals[key].unhealthy_ratio !== undefined) targetSignals[key].unhealthy_ratio = 0.0;
      if (targetSignals[key].consecutive_timeouts !== undefined) targetSignals[key].consecutive_timeouts = 0;
    });
    if (region === 'primary') {
      this.primaryDownStartedAt = null;
      this.primaryStatus = 'HEALTHY';
      this.primaryHealthScore = 100;
    }
  }
}

module.exports = new HealthMonitor();
