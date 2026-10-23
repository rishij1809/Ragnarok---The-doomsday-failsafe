# Project Ragnarock — Formal DR Operational Runbook

## 1. Severity 1 Incident Declaration Criteria

A **Severity 1 (Sev-1) Disaster Declaration** MUST be declared immediately upon meeting any of the following empirical trigger conditions:

1. **Catastrophic Cloud Outage:** Unplanned total loss of connectivity to AWS us-east-1 Primary VPC or ALB lasting $> 30\text{ seconds}$.
2. **Database Primary Hard Failure:** AWS RDS PostgreSQL instance failure, unrecoverable WAL stream corruption, or host loss.
3. **Quorum Consensus Confirmation:** Phase 7 Quorum Arbiter issues a signed fencing token when $\ge 2\text{ of }3$ independent vantage observers confirm AWS is unreachable and the primary heartbeat lease has expired.
4. **Anycast Edge Isolation:** Global edge director reports $100\%$ origin probe failures on AWS primary pool.

---

## 2. Automated vs. Manual Emergency Override Procedures

### A. Automated Failover Mode (Default Operation)
Under standard operations, the Phase 7 Quorum Observer automatically detects failure and invokes the Phase 9 Failover Orchestrator:

```bash
# Automated invocation by Quorum Observer daemon
python -m services.orchestrator.engine --token="EPOCH:<N>:HMAC:<SIG>" --actor="Automated Quorum"
```

### B. Manual SRE Emergency Override Failover
If the automated Quorum prober daemon is unreachable or network partitions isolate the observer node, an SRE Lead can manually force immediate failover to Azure:

```bash
# Option 1: Execute via Django Management Command
python manage.py execute_failover --token="EPOCH:2" --actor="Manual SRE Override" --force

# Option 2: Execute directly via Orchestration Engine Module
python -m services.orchestrator.engine --token="EPOCH:2" --actor="Manual SRE Override" --force
```

---

## 3. Step-by-Step Failback (Reverse Synchronization) Runbook

Once AWS Primary region, network routes, and database infrastructure have been fully restored and verified:

```text
  [ Azure DR Active ] 
         │
         ▼ (Step 1: Drain Traffic & Lock Maintenance Mode)
  [ IS_DR_READONLY=True ]
         │
         ▼ (Step 2: Bootstrap Reverse Logical Replication)
  [ Azure (Publisher) ──> AWS RDS (Subscriber) ]
         │
         ▼ (Step 3: Reverse Storage Sync)
  [ Azure Blob Storage ──> AWS S3 ]
         │
         ▼ (Step 4: Restore Anycast Edge Traffic)
  [ EdgeDirector.route_traffic_to_aws() ]
         │
         ▼ (Step 5: Demote Azure & Restore Baseline Topology)
  [ AWS Primary Active ]
```

### Execution Commands:

```bash
# Step 1: Execute reverse synchronization and failback
python manage.py execute_failback --confirm --actor="Lead SRE Operator"

# Step 2: Audit reverse sync status via API
curl -s http://localhost:8000/api/dr/orchestration-log/ | jq .
```

---

## 4. Split-Brain Resolution & Conflict Reconciliation Runbook

In the improbable event of a dual-active split-brain hazard (where both AWS and Azure accepted writes concurrently due to human override errors):

### Step 1: Emergency Write Isolation
Immediately lock write operations on BOTH clouds to freeze transaction state:

```bash
export IS_DR_READONLY="true"
export MAINTENANCE_MODE="true"
```

### Step 2: Extract Transaction Deltas & Timestamp Reconciliation
Export all transactions committed after the network partition timestamp ($T_{\text{partition}}$) from both databases:

```sql
-- Run on AWS RDS Primary PostgreSQL
SELECT id, sequence_number, payload_data, client_tx_timestamp, checksum 
FROM dr_benchmark_replicationbenchmark 
WHERE created_at >= '2026-09-30 21:00:00+00' 
ORDER BY sequence_number ASC;

-- Run on Azure Flexible Server PostgreSQL
SELECT id, sequence_number, payload_data, client_tx_timestamp, checksum 
FROM dr_benchmark_replicationbenchmark 
WHERE created_at >= '2026-09-30 21:00:00+00' 
ORDER BY sequence_number ASC;
```

### Step 3: Sequence & Timestamp Merge
1. Merge transaction sets sorting by `client_tx_timestamp` (monotonic high-resolution client timestamp).
2. Deduplicate matching `sequence_number` entries using SHA-256 `checksum` verification.
3. Re-apply missing deltas to AWS Primary.

### Step 4: Re-establish Single Primary Topology
Demote Azure back to subscriber standby and re-enable standard database router operations:

```bash
python manage.py execute_failback --confirm --actor="SRE Split-Brain Arbiter"
```
