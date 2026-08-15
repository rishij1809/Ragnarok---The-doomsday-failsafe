/**
 * Ragnarok End-to-End Test Suite (Phases 1 - 4 Verification)
 * Validates RTO (<5 min), RPO (<1 min), Multi-Signal Health Scoring,
 * Failover FSM, Restore Drills, and Role Authorization.
 */

const request = require('supertest');
const { app } = require('../src/server');
const healthMonitor = require('../src/services/healthMonitor');
const replicationManager = require('../src/services/replicationManager');
const failoverOrchestrator = require('../src/services/failoverOrchestrator');
const simulationEngine = require('../src/services/simulationEngine');

describe('Ragnarok Multi-Cloud Disaster Recovery System Test Suite', () => {

  afterEach(() => {
    // Reset state after each test
    simulationEngine.recoverPrimary();
  });

  // --- PHASE 1 TESTS: Foundation & Backups ---
  describe('Phase 1: Foundation & Automated Backups', () => {
    test('GET /api/v1/backups/all should return scheduled backup jobs', async () => {
      const res = await request(app).get('/api/v1/backups/all');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.backup_jobs.length).toBeGreaterThan(0);
      
      const dbJob = res.body.data.backup_jobs.find(j => j.resource_id === 'ragnarok-db-aurora');
      expect(dbJob).toBeDefined();
      expect(dbJob.verified).toBe(true);
    });

    test('POST /api/v1/backups/restore-test should execute automated restore drill (FR-12)', async () => {
      const res = await request(app)
        .post('/api/v1/backups/restore-test')
        .send({ resource_id: 'ragnarok-db-aurora' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.checksum_matched).toBe(true);
      expect(res.body.data.status).toBe('SUCCESS');
    });
  });

  // --- PHASE 2 TESTS: Data Layer & Replication Sync ---
  describe('Phase 2: Data Layer Replication & RPO Metric Tracking', () => {
    test('GET /api/v1/replication/status should export replication metrics and RPO compliance', async () => {
      const res = await request(app).get('/api/v1/replication/status');
      expect(res.status).toBe(200);
      expect(res.body.data.rpo_status.target_seconds).toBe(60);
      expect(res.body.data.db_replication.lag_seconds).toBeLessThan(60);
      expect(res.body.data.rpo_status.compliant).toBe(true);
    });

    test('High replication lag should trigger RPO breach alert', async () => {
      replicationManager.setSimulatedLag(90);
      const status = replicationManager.getStatus();
      expect(status.db_replication.rpo_breach).toBe(true);
      expect(status.rpo_status.compliant).toBe(false);
    });
  });

  // --- PHASE 3 TESTS: Health Monitoring & Failover FSM ---
  describe('Phase 3: Multi-Signal Health Checks & Failover Orchestration', () => {
    test('GET /api/v1/regions/health should return weighted composite health score', async () => {
      const res = await request(app).get('/api/v1/regions/health');
      expect(res.status).toBe(200);
      expect(res.body.data.regions[0].health_score).toBe(100); // Primary healthy
      expect(res.body.data.regions[0].status).toBe('HEALTHY');
    });

    test('Primary signal failure should drop health score to DEGRADED (<70%)', async () => {
      healthMonitor.injectSignalFailure('primary', 'app_http');
      const data = healthMonitor.checkHealth();
      expect(data.regions[0].health_score).toBe(65); // 100 - 35
      expect(data.regions[0].status).toBe('DEGRADED');
    });

    test('POST /api/v1/failover/trigger should transition state to FAILED_OVER with RTO < 300s', async () => {
      const res = await request(app)
        .post('/api/v1/failover/trigger')
        .set('x-user-role', 'SRE_OPERATOR')
        .send({ reason: 'Integration Test Drill' });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.event.status).toBe('SUCCESS');
      expect(res.body.data.rto_seconds).toBeLessThan(300); // Target RTO < 5m
      
      const orchestratorStatus = failoverOrchestrator.getStatus();
      expect(orchestratorStatus.current_state).toBe('FAILED_OVER');
      expect(orchestratorStatus.active_traffic_region).toBe('azure-eastus');
    });
  });

  // --- PHASE 4 TESTS: Resilience, Failback & Chaos Testing ---
  describe('Phase 4: Resilience, Abort, Failback & Role Security', () => {
    test('Unauthorized role should be rejected from triggering manual failover', async () => {
      const res = await request(app)
        .post('/api/v1/failover/trigger')
        .set('x-user-role', 'VIEWER')
        .send({ reason: 'Unauthorized attempt' });

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });

    test('Full DR Cycle: Chaos Outage -> Failover -> Primary Recover -> Failback', async () => {
      // 1. Inject Chaos Outage in Primary
      await request(app).post('/api/v1/simulation/inject-failure').send({ type: 'OUTAGE' });
      
      // 2. Trigger Failover
      await request(app)
        .post('/api/v1/failover/trigger')
        .set('x-user-role', 'SRE_OPERATOR')
        .send({ reason: 'Chaos Test' });

      expect(failoverOrchestrator.getStatus().current_state).toBe('FAILED_OVER');

      // 3. Execute Failback
      const failbackRes = await request(app)
        .post('/api/v1/failover/failback')
        .set('x-user-role', 'SRE_OPERATOR');

      expect(failbackRes.status).toBe(200);
      expect(failbackRes.body.data.success).toBe(true);
      expect(failoverOrchestrator.getStatus().current_state).toBe('HEALTHY');
      expect(failoverOrchestrator.getStatus().active_traffic_region).toBe('aws-us-east-1');
    });
  });
});
