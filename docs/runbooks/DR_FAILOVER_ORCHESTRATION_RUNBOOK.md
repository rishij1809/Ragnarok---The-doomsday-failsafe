# Project Ragnarock — Phase 9: Automated Failover & Recovery Orchestration Runbook

## 1. Executive Summary & Architecture Overview

Project Ragnarock Phase 9 provides the central Finite State Machine (FSM) and automated orchestrator responsible for consuming cryptographic failure tokens from the Phase 7 3-point Quorum detector, isolating AWS Primary, promoting Azure Secondary PostgreSQL to active Read-Write Master, rapidly scaling Azure Container Apps compute, redirecting Anycast edge traffic via Phase 8 EdgeDirector, and executing reverse-recovery failback once AWS Primary returns to health.

```
                  +-----------------------------------+
                  |           STATE_NORMAL            | (AWS Primary Active)
                  +-----------------------------------+
                                    |
                                    v (Phase 7 Quorum Token Received)
                  +-----------------------------------+
                  |         TRIGGER_VALIDATED         | (Signature & Epoch Validated)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |           FENCE_PRIMARY           | (AWS Write Access Revoked)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |         PROMOTE_DATABASE          | (Azure Standby -> Read-Write Master)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |           SCALE_COMPUTE           | (Azure Replicas 1 -> 6 Burst)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        DIVERT_EDGE_TRAFFIC        | (Cloudflare / Anycast -> Azure)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |           VERIFY_HEALTH           | (Synthetic CRUD Smoke Test)
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |             DR_ACTIVE             | (Azure Active Read-Write)
                  +-----------------------------------+
```

---

## 2. Finite State Machine (FSM) Execution Flow

| State Code | Phase Name | Execution Action | Timeout Guard | Circuit Breaker Guard |
| :--- | :--- | :--- | :--- | :--- |
| `STATE_NORMAL` | Baseline Normal | AWS Primary serves 100% traffic; Azure Standby in warm state (1 replica). | N/A | Normal |
| `TRIGGER_VALIDATED` | Quorum Validation | Validates HMAC-SHA256 signature and epoch counter of fencing token. | 5.0s | Abort if invalid signature |
| `FENCE_PRIMARY` | Primary Fencing | Revokes AWS write permissions and isolates AWS write path to prevent split-brain. | 15.0s | State preserved |
| `PROMOTE_DATABASE` | DB Standby Promote | Flushes WAL, drops `ragnarock_sub`, promotes Azure PostgreSQL to Read-Write Master. | 30.0s | Fallback to Azure replica |
| `SCALE_COMPUTE` | Compute Rapid Burst | Scales Azure Container Apps from 1 to 6 replicas; sets `IS_DR_PROMOTED=True`. | 30.0s | Retries scale request |
| `DIVERT_EDGE_TRAFFIC` | Edge Traffic Swap | Invokes `EdgeDirector.execute_failover_to_azure()` to steer Anycast traffic to Azure. | 15.0s | Keep old pool if failure |
| `VERIFY_HEALTH` | Post-Failover Health | Runs synthetic CRUD benchmark operations against Azure DR endpoint. | 15.0s | Emit CRITICAL alert |
| `DR_ACTIVE` | Failover Complete | Azure serves 100% production read-write traffic with zero data loss. | Target RTO < 120s | Continuous Telemetry |

---

## 3. Standard Operating Procedures (SOP)

### A. Automated Quorum Execution (Hands-Off Operation)
When the Phase 7 Quorum Prober detects a catastrophic outage (>= 2 of 3 observers confirm AWS is unreachable and lease is expired), it dispatches the signed fencing token to the Failover Orchestration Engine:

```bash
python -m services.orchestrator.engine --token="EPOCH:2:HMAC:a8f9c1..." --actor="Automated Quorum"
```

### B. Manual SRE Emergency Override Failover
If automated probers are delayed or an SRE operator manually determines AWS must be drained immediately:

```bash
# Execute emergency manual failover via Django management command
python manage.py execute_failover --token="EPOCH:2" --actor="Manual SRE Override" --force
```

### C. Reverse Synchronization & Failback to AWS Primary
Once AWS Primary region, network, and database services are fully restored, verified healthy, and ready to accept traffic:

```bash
# Step 1: Execute reverse synchronization and failback via Django management command
python manage.py execute_failback --confirm --actor="Lead SRE Operator"
```

---

## 4. Audit Logging & REST API Endpoints

All failover and failback executions write an immutable record into the `DROrchestrationLog` table. SRE team members and monitoring dashboards can query execution records via REST API:

### GET `/api/dr/orchestration-log/`
Returns chronological audit records detailing execution steps, actor, state transitions, step durations, and final RTO/RPO metrics.

#### Sample JSON Payload Output:
```json
[
  {
    "id": "7b8f9a21-4c12-4e89-9123-0192837465ef",
    "timestamp": "2026-09-30T21:58:00Z",
    "action": "FAILOVER",
    "actor": "Automated Quorum",
    "status": "SUCCESS",
    "trigger_token": "EPOCH:2",
    "step_durations": {
      "1_fence_primary": 0.301,
      "2_promote_database": 0.512,
      "3_scale_compute": 0.405,
      "4_divert_edge_traffic": 0.502,
      "5_verify_health": 0.401
    },
    "rto_seconds": 2.121,
    "rpo_seconds": 0.05,
    "audit_trail": [
      {
        "timestamp": "2026-09-30T21:57:58Z",
        "state": "TRIGGER_VALIDATED",
        "message": "Quorum Fencing Token Validated. Target Fencing Epoch: 2",
        "status": "INFO"
      },
      {
        "timestamp": "2026-09-30T21:58:00Z",
        "state": "DR_ACTIVE",
        "message": "=== FAILOVER COMPLETED SUCCESSFULLY in 2.121s (RTO Target < 120s PASSED) ===",
        "status": "INFO"
      }
    ]
  }
]
```

---

## 5. Telemetry & Alerting Metrics

The Orchestrator exports key telemetry metrics to Prometheus and Datadog:

| Metric Name | Type | Description | Alert Threshold |
| :--- | :--- | :--- | :--- |
| `dr_status_code` | Gauge | `0`: AWS Normal, `1`: Failover In Progress, `2`: DR Active on Azure, `3`: Failback In Progress | Alert if status != 0 for > 10m |
| `dr_failover_duration_seconds` | Gauge / Histogram | Total time taken to complete failover FSM sequence. | Critical Alert if > 120.0s |
| `post_failover_error_rate` | Gauge | HTTP 5xx error rate post-failover on Azure backend. | Warning if > 0.01 (1%) |
| `dr_step_duration_seconds` | Gauge | Duration of individual FSM execution steps. | Warning if any step > 30s |

---

## 6. Multi-Channel Notification Dispatcher

The orchestrator broadcasts real-time milestone alerts to:
- **Slack:** `#dr-alerts-production` via `SLACK_WEBHOOK_URL`
- **Discord:** `#ops-war-room` via `DISCORD_WEBHOOK_URL`
- **PagerDuty:** Incident Trigger & Resolution via `PAGERDUTY_ROUTING_KEY`

---

## 7. Verification & Simulation Testing

To execute end-to-end simulation in non-production environment:

```bash
python tests/simulate_full_failover.py
```
This suite asserts:
1. Quorum consensus evaluation & fencing token epoch increment.
2. Stepwise state transitions (`STATE_NORMAL` -> `DR_ACTIVE` -> `STATE_NORMAL`).
3. Total RTO < 120s limit.
4. Zero checksum corruption / zero data loss (RPO ≈ 0s).
