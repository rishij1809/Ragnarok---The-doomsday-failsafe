/**
 * Ragnarok Express API Router
 * Endpoints for Region Health, Replication Metrics, Failover/Failback Orchestration, Backup Restore Drills, and Chaos Simulation.
 */

const express = require('express');
const router = express.Router();

const healthMonitor = require('../services/healthMonitor');
const replicationManager = require('../services/replicationManager');
const failoverOrchestrator = require('../services/failoverOrchestrator');
const backupManager = require('../services/backupManager');
const notificationService = require('../services/notificationService');
const simulationEngine = require('../services/simulationEngine');

// 1. Health Monitoring Endpoint
router.get('/regions/health', (req, res) => {
  const data = healthMonitor.checkHealth();
  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    data
  });
});

// 2. Replication Status Endpoint
router.get('/replication/status', (req, res) => {
  const data = replicationManager.getStatus();
  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    data
  });
});

// 3. Trigger Failover (Manual Override / DR Drill)
router.post('/failover/trigger', async (req, res) => {
  try {
    const role = req.headers['x-user-role'] || req.body.role || 'SRE_OPERATOR';
    const reason = req.body.reason || 'Manual Failover Triggered from Operator Dashboard';
    const result = await failoverOrchestrator.manualTriggerFailover(role, reason);
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(403).json({ status: 'error', message: err.message });
  }
});

// 4. Abort In-Progress Failover
router.post('/failover/abort', (req, res) => {
  try {
    const role = req.headers['x-user-role'] || req.body.role || 'SRE_OPERATOR';
    const reason = req.body.reason || 'Manual Abort Triggered from Dashboard';
    const result = failoverOrchestrator.abortFailover(role, reason);
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(403).json({ status: 'error', message: err.message });
  }
});

// 5. Initiate Failback to Primary Region
router.post('/failover/failback', async (req, res) => {
  try {
    const role = req.headers['x-user-role'] || req.body.role || 'SRE_OPERATOR';
    const result = await failoverOrchestrator.executeFailback(role);
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(403).json({ status: 'error', message: err.message });
  }
});

// 6. List Historical Failover & Failback Audit Events
router.get('/failover/events', (req, res) => {
  const orchestratorStatus = failoverOrchestrator.getStatus();
  res.json({
    status: 'success',
    data: {
      current_state: orchestratorStatus.current_state,
      active_region: orchestratorStatus.active_traffic_region,
      events: orchestratorStatus.events_history
    }
  });
});

// 7. Get Backup Jobs and Verification Status
router.get('/backups/:resource_id?', (req, res) => {
  const resourceId = req.params.resource_id !== 'all' ? req.params.resource_id : null;
  const jobs = backupManager.getBackupJobs(resourceId);
  const restoreDrills = backupManager.getRestoreDrillHistory();
  res.json({
    status: 'success',
    data: {
      backup_jobs: jobs,
      restore_drills: restoreDrills
    }
  });
});

// 8. Trigger Automated Restore Drill (FR-12)
router.post('/backups/restore-test', (req, res) => {
  const resourceId = req.body.resource_id || 'ragnarok-db-aurora';
  const drillResult = backupManager.triggerRestoreDrill(resourceId);
  res.json({
    status: 'success',
    message: 'Automated backup restore drill executed successfully.',
    data: drillResult
  });
});

// 9. Notification Delivery Logs
router.get('/notifications/logs', (req, res) => {
  const logs = notificationService.getNotificationLogs();
  res.json({ status: 'success', data: logs });
});

// 10. Chaos Engineering: Inject Region Outage
router.post('/simulation/inject-failure', (req, res) => {
  const failureType = req.body.type || 'OUTAGE';
  let sim;
  if (failureType === 'LAG') {
    sim = simulationEngine.injectReplicationLag(req.body.lagSeconds || 90);
  } else {
    sim = simulationEngine.injectPrimaryOutage();
  }
  res.json({
    status: 'success',
    message: 'Chaos failure injected into Primary Region.',
    data: sim
  });
});

// 11. Chaos Engineering: Clear Injections & Recover Primary
router.post('/simulation/recover', (req, res) => {
  const result = simulationEngine.recoverPrimary();
  res.json({ status: 'success', data: result });
});

module.exports = router;
