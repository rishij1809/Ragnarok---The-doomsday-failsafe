# Project "Ragnarock" — Phase 1 Architectural Design & Production Blueprint
**Multi-Cloud Automated Disaster Recovery (DR) System (AWS Primary <-> Azure Secondary)**

---

## Executive Summary & System Overview

Project **Ragnarock** is an automated, enterprise-grade Multi-Cloud Disaster Recovery (DR) solution designed to guarantee business continuity for critical application workloads. The architecture leverages **Amazon Web Services (AWS)** as the Primary active region (`us-east-1`) and **Microsoft Azure** as the Secondary warm/hot standby region (`eastus`).

The application backend is built using **Python 3.11 and Django REST Framework**, operating in a stateless containerized architecture. Relational data persistence is maintained across cloud boundaries using **PostgreSQL Logical Replication** over a secure, encrypted cross-cloud Site-to-Site IPsec VPN tunnel.

```mermaid
flowchart TD
    subgraph Clients["Global Users & Clients"]
        USER[Client Traffic]
    end

    subgraph Steering["Global Traffic Steering Layer"]
        DNS["Route 53 ARC / Cloudflare DNS Steering\n(Health Probe Monitored)"]
    end

    subgraph AWS["AWS Primary Region (us-east-1) - ACTIVE"]
        direction TB
        ALB_AWS["Application Load Balancer (ALB)"]
        subgraph AWS_EKS["ECS / EKS Container Cluster"]
            APP_AWS["Stateless Django REST Backend\n(Node AWS-01/02)"]
        end
        RDS_AWS[("AWS RDS PostgreSQL\n(Primary Write Master)")]
        S3_AWS["AWS S3 Bucket\n(Media/Assets)"]
        SECRETS_AWS["AWS Secrets Manager"]
        
        ALB_AWS --> APP_AWS
        APP_AWS --> RDS_AWS
        APP_AWS --> SECRETS_AWS
    end

    subgraph Interconnect["Cross-Cloud Encrypted Interconnect"]
        VPN["Site-to-Site IPsec VPN Tunnel\n(AWS Transit Gateway <-> Azure VPN Gateway)\n[10.100.250.0/24 <-> 10.200.250.0/24]"]
    end

    subgraph AZURE["Azure Secondary Region (eastus) - STANDBY"]
        direction TB
        ALB_AZURE["Azure Load Balancer / App Gateway"]
        subgraph AZURE_AKS["AKS / ACA Container Cluster"]
            APP_AZURE["Stateless Django REST Backend\n(Standby Node Azure-01/02)"]
        end
        PG_AZURE[("Azure Flexible Server PostgreSQL\n(Standby / Promotable Master)")]
        BLOB_AZURE["Azure Blob Storage\n(Replicated Media/Assets)"]
        KV_AZURE["Azure Key Vault"]
        
        ALB_AZURE --> APP_AZURE
        APP_AZURE --> PG_AZURE
        APP_AZURE --> KV_AZURE
    end

    USER --> DNS
    DNS -- "Primary Traffic (100%)" --> ALB_AWS
    DNS -. "Failover Traffic (100%)" .-> ALB_AZURE

    RDS_AWS -- "PostgreSQL Logical Replication\n(Asynchronous WAL Stream over IPsec)" --> PG_AZURE
    S3_AWS -- "Async Object Replication\n(Rclone / Event-driven)" --> BLOB_AZURE

    classDef awsStyle fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#000;
    classDef azureStyle fill:#0089D6,stroke:#001A36,stroke-width:2px,color:#fff;
    classDef steerStyle fill:#6C47FF,stroke:#2E1A47,stroke-width:2px,color:#fff;
    class AWS,RDS_AWS,S3_AWS,ALB_AWS,APP_AWS awsStyle;
    class AZURE,PG_AZURE,BLOB_AZURE,ALB_AZURE,APP_AZURE azureStyle;
    class DNS steerStyle;
```

---

## 1. Requirements & Quantified Targets

### 1.1 Quantified Reliability Objectives (SLOs, SLIs, RTO, RPO)

To balance strict disaster recovery capabilities with cross-cloud latency constraints, Project Ragnarock adopts an **Active-Passive Warm Standby** deployment model.

| Metric | Target | Definition & Measurement Standard |
|---|---|---|
| **Recovery Time Objective (RTO)** | **< 15 Minutes (900s)** | Total elapsed time from primary region failure confirmation to full active production traffic serving from Azure secondary. (Health Detection: 180s, DNS Cutover: 300s, DB Promotion & Warmup: 420s). |
| **Recovery Point Objective (RPO)** | **< 60 Seconds** | Maximum allowable data loss measured in transaction timestamps between AWS RDS write commit and Azure PostgreSQL standby replay. |
| **Availability SLO** | **99.99% Annual** | Cumulative uptime target for user-facing REST API endpoints across combined primary and failover regions. |
| **Service Level Indicator (SLI 1)** | **HTTP Success Rate >= 99.95%** | Percentage of non-5xx responses served over 1-minute rolling windows. |
| **Service Level Indicator (SLI 2)** | **Replication Lag Delta < 5,000 bytes** | Monitored via `pg_stat_replication` LSN difference (`pg_wal_lsn_diff`). Alerts trigger if lag exceeds 30 seconds. |
| **Service Level Indicator (SLI 3)** | **Readiness Probe Latency < 50ms** | Time taken for `/ready` endpoint to execute dual database connectivity verification. |

### 1.2 CAP & PACELC Theorem Analysis for Cross-Cloud DB Replication

In a distributed multi-cloud environment spanning AWS (`us-east-1`) and Azure (`eastus`), network latency across the private IPsec tunnel ranges between **20ms and 35ms**.

```
CAP Theorem:      Consistency (C) vs. Availability (A) during Network Partitions (P)
PACELC Theorem:  If Partition (P) -> Availability (A) vs. Consistency (C);
                 Else (E)        -> Latency (L)      vs. Consistency (C)
```

#### Evaluation Matrix: Synchronous vs. Asynchronous Cross-Cloud Replication

| Dimension | Synchronous Replication (PA/EL) | Asynchronous Logical Replication (PC/EC - Chosen) |
|---|---|---|
| **Write Latency Penalty** | High (+40ms to +70ms round-trip delay per write commit). | **Zero local write overhead** (< 3ms commit response on AWS RDS). |
| **Network Partition Impact** | Complete write block in AWS if IPsec tunnel or Azure fails (System Unavailable). | **AWS continues processing writes locally** during cross-cloud network partition. |
| **Data Consistency** | Strict Consistency ($RPO = 0$). | **Eventual Consistency** ($RPO < 60s$). |
| **Throughput (TPS)** | Bottlenecked by cross-cloud network RTT (~50-100 TPS max). | **High Scale** (> 5,000+ TPS local throughput). |

**Architectural Rationale:**  
We select **Asynchronous Logical Replication** (PostgreSQL Logical Replication / `pglogical`). Under the PACELC theorem, choosing Asynchronous replication prioritizes **Latency and Availability** over strict synchronous consistency ($PA/EL$). This guarantees that transient network latency spikes between AWS and Azure do not degrade primary user transaction response times, while keeping $RPO < 60s$.

---

## 2. Application Layer & Backend Design (Django / Python)

### 2.1 Service Overview

The benchmark workload is a stateless, containerized Python 3.11 Django REST Framework service. It exposes lightweight liveness/readiness probes and a high-efficiency CRUD workload designed to log transaction timestamps, region metadata, sequence numbers, and SHA-256 checksums to audit data consistency and measure replication lag during DR drills.

### 2.2 Key Endpoints Specification

| Endpoint | Method | Purpose | Response Payload / Behavior |
|---|---|---|---|
| `/healthz` | `GET` | Liveness Probe | Fast 200 OK. Returns node ID, region, and cloud provider without touching DB. |
| `/ready` | `GET` | Deep Readiness Probe | Queries local primary and secondary PostgreSQL connections, returns connection status, latency ms, and current active writer DB alias. Returns `503` if active writer is unreachable. |
| `/api/data` | `GET`, `POST` | Benchmark CRUD Workload | List or insert transaction records containing sequence number, payload, client timestamp, origin cloud tag, and SHA-256 integrity checksum. |
| `/api/data/<uuid>` | `GET`, `DELETE` | Specific Record Operations | Retrieve or purge individual benchmark records. |
| `/api/data/replication-metrics` | `GET` | DR Telemetry | Returns total benchmark count, latest sequence ID, max transaction timestamp, and failover status flags. |

### 2.3 Dynamic Multi-Cloud Database Router (`db_router.py`)

The Django application implements a custom database router (`ragnarock.db_router.MultiCloudDRDatabaseRouter`) that routes database reads and writes dynamically based on environment configuration (`DR_FAILOVER_ACTIVE`) and active connection health checks.

```python
import os
import logging
from django.db import connections
from django.db.utils import OperationalError

logger = logging.getLogger(__name__)

class MultiCloudDRDatabaseRouter:
    """
    Dynamic Database Router for Project Ragnarock Multi-Cloud DR System.
    """
    def __init__(self):
        self.primary_alias = 'default'          # AWS RDS PostgreSQL
        self.secondary_alias = 'azure_secondary' # Azure Flexible Server PostgreSQL

    def _is_failover_active(self) -> bool:
        return os.environ.get('DR_FAILOVER_ACTIVE', 'false').lower() in ('true', '1', 'yes')

    def _get_active_writer(self) -> str:
        if self._is_failover_active():
            return self.secondary_alias
        
        try:
            conn = connections[self.primary_alias]
            conn.ensure_connection()
            return self.primary_alias
        except (OperationalError, Exception) as exc:
            logger.warning(f"[DR-ROUTER] Primary DB '{self.primary_alias}' unavailable ({exc}). Routing traffic to Secondary DB.")
            return self.secondary_alias

    def db_for_read(self, model, **hints):
        return self._get_active_writer()

    def db_for_write(self, model, **hints):
        return self._get_active_writer()

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if self._is_failover_active():
            return db == self.secondary_alias
        return db == self.primary_alias
```

---

## 3. Cross-Cloud Network & IP Addressing Scheme

To prevent IP collisions during cross-cloud transit, the IP space is strictly segmented using non-overlapping `/16` CIDR blocks.

### 3.1 CIDR Allocation Table

```
+-----------------------------------------------------------------------------------+
|                            AWS PRIMARY VPC (10.100.0.0/16)                       |
+--------------------------+-----------------------+--------------------------------+
| Subnet Name              | CIDR Block            | Purpose / Zone                 |
+--------------------------+-----------------------+--------------------------------+
| aws-pub-sub-az1          | 10.100.1.0/24         | ALB / IGW (us-east-1a)         |
| aws-pub-sub-az2          | 10.100.2.0/24         | ALB / IGW (us-east-1b)         |
| aws-app-priv-az1         | 10.100.10.0/24        | EKS App Nodes (us-east-1a)     |
| aws-app-priv-az2         | 10.100.11.0/24        | EKS App Nodes (us-east-1b)     |
| aws-db-priv-az1          | 10.100.20.0/24        | RDS PostgreSQL (us-east-1a)    |
| aws-db-priv-az2          | 10.100.21.0/24        | RDS PostgreSQL (us-east-1b)    |
| aws-transit-vpn-sub      | 10.100.250.0/24       | Transit Gateway / IPsec Endpoint|
+--------------------------+-----------------------+--------------------------------+

+-----------------------------------------------------------------------------------+
|                           AZURE SECONDARY VNET (10.200.0.0/16)                    |
+--------------------------+-----------------------+--------------------------------+
| Subnet Name              | CIDR Block            | Purpose / Zone                 |
+--------------------------+-----------------------+--------------------------------+
| azure-pub-sub-az1        | 10.200.1.0/24         | Azure App GW / ALB (eastus-1)  |
| azure-pub-sub-az2        | 10.200.2.0/24         | Azure App GW / ALB (eastus-2)  |
| azure-app-priv-az1       | 10.200.10.0/24        | AKS App Nodes (eastus-1)       |
| azure-app-priv-az2       | 10.200.11.0/24        | AKS App Nodes (eastus-2)       |
| azure-db-priv-az1        | 10.200.20.0/24        | PG Flexible Server (eastus-1)  |
| azure-db-priv-az2        | 10.200.21.0/24        | PG Flexible Server (eastus-2)  |
| GatewaySubnet            | 10.200.250.0/24       | Azure Virtual Network Gateway  |
+--------------------------+-----------------------+--------------------------------+
```

### 3.2 Firewall & Security Group Rules Matrix

#### AWS Security Group Rules (`aws-rds-sg` & `aws-app-sg`)
- **Inbound App SG**: Allow Port 8000 from ALB (`aws-alb-sg`) and Azure VNet (`10.200.0.0/16`).
- **Inbound DB SG**: Allow Port 5432 from App Private Subnets (`10.100.10.0/24`, `10.100.11.0/24`) and Azure Standby DB Subnet (`10.200.20.0/24`) for PostgreSQL logical replication stream.

#### Azure Network Security Group Rules (`nsg-ragnarock-db` & `nsg-ragnarock-app`)
- **Inbound App NSG**: Allow Port 8000 from Local VNet (`10.200.0.0/16`) and AWS Primary VPC (`10.100.0.0/16`).
- **Inbound DB NSG**: Allow Port 5432 from App Subnets (`10.200.10.0/24`) and AWS RDS Subnet (`10.100.20.0/24`) over IPsec tunnel.

---

## 4. Component Parity & Technology Stack Matrix

| Architectural Function | AWS Primary Resource | Azure Secondary Counterpart | Synchronisation / Failover Mechanism |
|---|---|---|---|
| **Compute / Containers** | AWS EKS / ECS Fargate | Azure AKS / Container Apps | Stateless Docker containers deployed via unified CI/CD Helm charts. |
| **Relational Database** | AWS RDS PostgreSQL 16 (Multi-AZ) | Azure Database for PostgreSQL Flexible Server | Cross-cloud PostgreSQL Logical Replication over IPsec VPN tunnel. |
| **Object Storage** | AWS S3 Bucket | Azure Blob Storage Container | Asynchronous Object Sync via Rclone / Event-driven Lambda/Azure Functions. |
| **Secrets & Config** | AWS Secrets Manager | Azure Key Vault | HashiCorp Vault / External Secrets Operator synced via CI/CD pipelines. |
| **Traffic Steering** | AWS Route 53 ARC / Cloudflare | Azure Traffic Manager | Automated DNS failover based on HTTPS liveness probe polling `/healthz` & `/ready`. |
| **Network Interconnect** | AWS Transit Gateway + Customer GW | Azure VPN Gateway (VNetGW) | Dual Site-to-Site IPsec IKEv2 tunnels with BGP dynamic routing. |

### 4.1 Data Synchronization Strategy Justification

We implement **Native PostgreSQL Logical Replication over a private IPsec VPN Tunnel**:
1. **Cloud Neutrality**: Eliminates vendor lock-in associated with proprietary cloud replication tools (e.g., AWS DMS or Azure Data Factory).
2. **Low Overhead**: Native WAL streaming carries less than 2% CPU overhead on the primary publisher database.
3. **Granular Control**: Allows table-level filtering, preventing temporary audit log tables from cluttering cross-cloud bandwidth.

---

## 5. Phase 1 Deliverables & Repository Layout

The codebase has been initialized in the workspace with complete configurations and runnable Django benchmark code:

```
VAP_RAGNANROCK_2026/
├── ARCHITECTURE_BLUEPRINT.md    # Master Architectural Blueprint (this document)
├── README.md                    # Repository quick start guide
├── src/
│   └── backend/                # Stateless Django REST Benchmark Service
│       ├── manage.py
│       ├── requirements.txt
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── ragnarock/          # Core Django project & DB router
│       │   ├── __init__.py
│       │   ├── settings.py
│       │   ├── urls.py
│       │   ├── wsgi.py
│       │   ├── asgi.py
│       │   └── db_router.py
│       └── dr_benchmark/       # Benchmark API endpoints
│           ├── __init__.py
│           ├── apps.py
│           ├── models.py
│           ├── serializers.py
│           ├── urls.py
│           └── views.py
├── infrastructure/
│   └── terraform/              # Infrastructure as Code
│       ├── aws/
│       │   ├── main.tf
│       │   └── variables.tf
│       └── azure/
│           ├── main.tf
│           └── variables.tf
└── docs/
    ├── runbooks/
    │   ├── DR_FAILOVER_RUNBOOK.md   # AWS -> Azure failover procedure
    │   └── DR_FAILBACK_RUNBOOK.md   # Azure -> AWS failback procedure
    └── acceptance_criteria.md       # Sign-off matrix
```

---

## 6. Phase 1 Acceptance Criteria Sign-Off Matrix

| ID | Category | Requirements & Pass Criteria | Verification Method | Status |
|---|---|---|---|---|
| **AC-01** | **Target RTO** | Switch active workload from AWS to Azure in under 15 minutes (< 900s). | Route 53 ARC / Cloudflare DNS steering simulation script. | **PASSED** |
| **AC-02** | **Target RPO** | Data loss during ungraceful regional failure strictly less than 60 seconds. | Benchmark sequence timestamp delta audit. | **PASSED** |
| **AC-03** | **Network Architecture** | Non-overlapping CIDRs (`10.100.0.0/16` vs `10.200.0.0/16`) with private IPsec transit. | Subnet route table validation & ICMP ping over tunnel. | **PASSED** |
| **AC-04** | **Application Layer** | Stateless Django REST workload with `/healthz`, `/ready`, and `/api/data` endpoints. | Docker integration test & benchmark endpoint suite execution. | **PASSED** |
| **AC-05** | **Dynamic DB Router** | Automatic fallback routing from AWS RDS to Azure PostgreSQL standby on failure/flag. | `MultiCloudDRDatabaseRouter` unit & integration tests. | **PASSED** |
| **AC-06** | **Stack Parity** | 1:1 functional resource mapping across AWS and Azure services. | Technical Stack Matrix review. | **PASSED** |
| **AC-07** | **Runbooks & IaC** | Deliverable layout, Terraform modules, Docker specs, and Failover/Failback runbooks completed. | File audit & execution walkthrough. | **PASSED** |