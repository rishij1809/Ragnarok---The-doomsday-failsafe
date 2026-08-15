# Ragnarok - Multi-Cloud Disaster Recovery Operational Runbook

**System Name**: Ragnarok Multi-Cloud DR Engine  
**Primary Region**: AWS `us-east-1` (N. Virginia)  
**Secondary Standby Region**: Azure `eastus` (East US)  
**RTO Target**: < 300 seconds (5 minutes)  
**RPO Target**: < 60 seconds (1 minute)  

---

## 1. Multi-Signal Health Monitoring Criteria

Region health is determined by a weighted composite score across four independent health probes:

| Signal ID | Probe Description | Check Freq | Weight | Failure Threshold |
| :--- | :--- | :--- | :--- | :--- |
| `app_http` | Synthetic HTTP GET `/health` transaction | 10 sec | 35% | 3 consecutive HTTP 5xx / timeouts |
| `db_replication` | Database connectivity & replication lag | 15 sec | 30% | Lag > 60s or DB connection reset |
| `lb_compute` | Load Balancer target pool health ratio | 15 sec | 20% | > 50% unhealthy target instances |
| `network_reachability` | Inter-region cross-cloud VPN ping probe | 30 sec | 15% | 3 consecutive packet drops |

### Regional State Transitions
- **`HEALTHY`**: Composite health score **≥ 70%**.
- **`DEGRADED`**: Composite health score **30% - 69%**. Alerts dispatched to `#sre-dr-alerts`.
- **`DOWN`**: Composite health score **< 30%** sustained for **45 seconds** (Confirmation Window).

---

## 2. Failover Finite State Machine (FSM) Lifecycle

```
[HEALTHY] ──(Health < 70%)──> [MONITORING] ──(Sustained 45s DOWN)──> [FAILOVER_INITIATED]
                                                                             │
                                                                       (Promote DB)
                                                                             ▼
[FAILED_OVER] <──(Notify)── [TRAFFIC_SWITCHED] <──(Update DNS)── [COMPUTE_READY] <──(Scale VMSS)── [DB_PROMOTED]
      │
 (Failback Initiated)
      ▼
[FAILBACK_PENDING] ──(Data Re-synced & Primary Verified)──> [HEALTHY]
```

---

## 3. Manual Override & Disaster Recovery Drill Execution

### Manual Failover Trigger
To execute a manual failover (e.g. for scheduled maintenance or DR drill):
```bash
curl -X POST http://localhost:3000/api/v1/failover/trigger \
  -H "Content-Type: application/json" \
  -H "x-user-role: SRE_OPERATOR" \
  -d '{"reason": "Scheduled Annual Disaster Recovery Drill"}'
```

### Aborting In-Progress Failover
If a false positive is detected prior to full traffic cutover:
```bash
curl -X POST http://localhost:3000/api/v1/failover/abort \
  -H "Content-Type: application/json" \
  -H "x-user-role: SRE_OPERATOR" \
  -d '{"reason": "Primary region recovered prior to cutover"}'
```

---

## 4. Primary Region Failback Procedure

Once the primary AWS region has been fully restored and validated by SRE:

1. **Verify Primary Uptime**: Ensure composite score for `us-east-1` has returned to 100% for at least 15 minutes.
2. **Execute Failback Command**:
```bash
curl -X POST http://localhost:3000/api/v1/failover/failback \
  -H "Content-Type: application/json" \
  -H "x-user-role: SRE_OPERATOR"
```
3. **Verify Traffic Shift**: Confirm Route 53 / Azure Traffic Manager DNS records resolve back to `aws-us-east-1`.
4. **Demote Secondary Standby**: Secondary Azure region automatically scales back down to warm-standby baseline (20% capacity).

---

## 5. Automated Backup & Restore Verification Drills

- Backups run on a 6-hour automated cycle (`0 */6 * * *`) with a 30-day retention policy.
- To execute an automated backup restore drill on isolated staging resources (FR-12):
```bash
curl -X POST http://localhost:3000/api/v1/backups/restore-test \
  -H "Content-Type: application/json" \
  -d '{"resource_id": "ragnarok-db-aurora"}'
```
- Verify `checksum_matched: true` and `duration_seconds < 60`.
