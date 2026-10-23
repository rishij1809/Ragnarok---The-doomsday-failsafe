# Project Ragnarock — Multi-Cloud Automated Disaster Recovery (DR) System

**Phase 1 Architectural Design & Production Blueprint**  
**Primary Region:** AWS (`us-east-1`)  
**Secondary Region:** Azure (`eastus`)  
**Backend Workload:** Python 3.11 / Django REST Framework  

---

## Workspace Structure

```
.
├── ARCHITECTURE_BLUEPRINT.md    # Complete Phase 1 Design Specification & Blueprint
├── README.md                    # Project Overview & Quick Start
├── src/
│   └── backend/                # Stateless Django REST DR Benchmark Application
│       ├── manage.py
│       ├── requirements.txt
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── ragnarock/          # Core Django settings & dynamic cross-cloud DB router
│       │   ├── db_router.py
│       │   ├── settings.py
│       │   └── urls.py
│       └── dr_benchmark/       # /healthz, /ready, /api/data endpoints
│           ├── models.py
│           ├── serializers.py
│           ├── views.py
│           └── urls.py
├── infrastructure/
│   └── terraform/              # Infrastructure as Code modules
│       ├── aws/                # AWS Primary VPC, Subnets, SG definitions
│       ├── azure/              # Azure Standby VNet, Subnets, NSG definitions
│       └── modules/            # Cross-cloud Site-to-Site IPsec VPN module
└── docs/
    ├── runbooks/
    │   ├── DR_FAILOVER_RUNBOOK.md   # Automated AWS -> Azure failover procedure
    │   └── DR_FAILBACK_RUNBOOK.md   # Automated Azure -> AWS failback procedure
    └── acceptance_criteria.md       # Formal Phase 1 sign-off checklist
```

---

## Quick Start (Local DR Benchmarking)

To spin up the dual-database multi-cloud DR simulation locally using Docker Compose:

```bash
cd src/backend
docker-compose up --build -d
```

### Test Endpoints:
- **Liveness Probe**: `curl http://localhost:8000/healthz`
- **Readiness Probe**: `curl http://localhost:8000/ready`
- **Create Benchmark Transaction**:
  ```bash
  curl -X POST http://localhost:8000/api/data \
    -H "Content-Type: application/json" \
    -d '{"sequence_number": 1, "payload_data": "ragnarock-dr-test-01"}'
  ```
- **Replication Metrics**: `curl http://localhost:8000/api/data/replication-metrics`
