from django.urls import path
from .views import (
    LivenessCheckView,
    ReadinessCheckView,
    BenchmarkDataListCreateView,
    BenchmarkDataDetailView,
    ReplicationMetricsView,
    ReplicationStatusView,
    StorageStatusView,
    QuorumStatusView,
    OriginVerifyView,
    DROrchestrationLogView,
    ChaosAuditView,
)

urlpatterns = [
    # Health and Readiness Probes
    path('healthz', LivenessCheckView.as_view(), name='liveness-check'),
    path('ready', ReadinessCheckView.as_view(), name='readiness-check'),
    
    # DR Telemetry, Replication, Storage, Quorum, Edge, Chaos, & Audit Log Endpoints
    path('api/dr/origin-verify/', OriginVerifyView.as_view(), name='origin-verify'),
    path('api/dr/replication-status/', ReplicationStatusView.as_view(), name='replication-status'),
    path('api/dr/storage-status/', StorageStatusView.as_view(), name='storage-status'),
    path('api/dr/quorum-status/', QuorumStatusView.as_view(), name='quorum-status'),
    path('api/dr/orchestration-log/', DROrchestrationLogView.as_view(), name='orchestration-log'),
    path('api/dr/chaos-audit/', ChaosAuditView.as_view(), name='chaos-audit'),
    path('api/data/replication-metrics', ReplicationMetricsView.as_view(), name='replication-metrics'),
    
    # Benchmark Workload CRUD Endpoints
    path('api/data', BenchmarkDataListCreateView.as_view(), name='benchmark-list-create'),
    path('api/data/<uuid:id>', BenchmarkDataDetailView.as_view(), name='benchmark-detail'),
]


