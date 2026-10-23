import os
import time
import socket
import logging
from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics

from .models import ReplicationBenchmark, DROrchestrationLog
from .serializers import ReplicationBenchmarkSerializer, DROrchestrationLogSerializer
from dr_benchmark.management.commands.monitor_replication_lag import Command as LagMonitorCommand
from dr_benchmark.management.commands.audit_storage_sync import Command as StorageAuditCommand

logger = logging.getLogger(__name__)


class LivenessCheckView(APIView):
    """
    GET /healthz
    Kubernetes / Load Balancer Liveness Probe.
    Returns 200 OK fast response to signal application process is running.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        return Response({
            "status": "healthy",
            "service": "ragnarock-backend",
            "timestamp": timezone.now().isoformat(),
            "cloud_provider": getattr(settings, 'CLOUD_PROVIDER', 'AWS'),
            "cloud_region": getattr(settings, 'CLOUD_REGION', 'us-east-1'),
            "node_id": getattr(settings, 'NODE_ID', 'node-01'),
        }, status=status.HTTP_200_OK)


class ReadinessCheckView(APIView):
    """
    GET /ready
    Deep Readiness Probe.
    Checks database read/write connectivity, evaluates PostgreSQL replication lag,
    audits object storage sync drift, and reports failover readiness status.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        readiness_details = {
            "status": "ready",
            "timestamp": timezone.now().isoformat(),
            "active_node": getattr(settings, 'NODE_ID', 'node-01'),
            "cloud_provider": getattr(settings, 'CLOUD_PROVIDER', 'AWS'),
            "cloud_region": getattr(settings, 'CLOUD_REGION', 'us-east-1'),
            "databases": {},
            "replication_rpo_warning": False,
            "storage_drift_detected": False,
        }
        
        is_ready = True
        
        # Test AWS Primary DB
        try:
            start_time = time.time()
            cursor = connections['default'].cursor()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            latency_ms = round((time.time() - start_time) * 1000, 2)
            readiness_details["databases"]["aws_primary"] = {
                "status": "UP",
                "latency_ms": latency_ms,
                "host": getattr(settings, 'AWS_DB_HOST', 'localhost')
            }
        except OperationalError as exc:
            readiness_details["databases"]["aws_primary"] = {
                "status": "DOWN",
                "error": str(exc),
                "host": getattr(settings, 'AWS_DB_HOST', 'localhost')
            }
            if not getattr(settings, 'DR_FAILOVER_ACTIVE', False):
                is_ready = False

        # Test Azure Secondary DB
        try:
            start_time = time.time()
            cursor = connections['azure_secondary'].cursor()
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            latency_ms = round((time.time() - start_time) * 1000, 2)
            readiness_details["databases"]["azure_secondary"] = {
                "status": "UP",
                "latency_ms": latency_ms,
                "host": getattr(settings, 'AZURE_DB_HOST', 'localhost')
            }
        except OperationalError as exc:
            readiness_details["databases"]["azure_secondary"] = {
                "status": "DOWN",
                "error": str(exc),
                "host": getattr(settings, 'AZURE_DB_HOST', 'localhost')
            }

        # Check DB Router target
        from ragnarock.db_router import MultiCloudDRDatabaseRouter
        router = MultiCloudDRDatabaseRouter()
        active_writer = router._get_active_writer()
        readiness_details["active_db_writer"] = active_writer

        # Check Replication Lag Warning
        current_cloud = os.getenv("CURRENT_CLOUD", getattr(settings, 'CLOUD_PROVIDER', 'AWS'))
        is_failover = getattr(settings, 'DR_FAILOVER_ACTIVE', False)
        repl_metrics = LagMonitorCommand.collect_replication_metrics(current_cloud, is_failover)
        
        if repl_metrics.get("lag_warning", False):
            readiness_details["replication_rpo_warning"] = True

        # Check Storage Sync Audit
        storage_metrics = StorageAuditCommand.collect_storage_metrics()
        if storage_metrics.get("sync_drift_detected", False):
            readiness_details["storage_drift_detected"] = True

        # If active writer DB is DOWN, readiness fails
        if readiness_details["databases"].get(
            "aws_primary" if active_writer == "default" else "azure_secondary", {}
        ).get("status") != "UP":
            is_ready = False

        http_status = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
        readiness_details["status"] = "ready" if is_ready else "degraded"
        return Response(readiness_details, status=http_status)


class BenchmarkDataListCreateView(generics.ListCreateAPIView):
    queryset = ReplicationBenchmark.objects.all()
    serializer_class = ReplicationBenchmarkSerializer

    def perform_create(self, serializer):
        serializer.save(
            origin_cloud=getattr(settings, 'CLOUD_PROVIDER', 'AWS'),
            origin_region=getattr(settings, 'CLOUD_REGION', 'us-east-1')
        )


class BenchmarkDataDetailView(generics.RetrieveDestroyAPIView):
    queryset = ReplicationBenchmark.objects.all()
    serializer_class = ReplicationBenchmarkSerializer
    lookup_field = 'id'


class ReplicationMetricsView(APIView):
    def get(self, request, *args, **kwargs):
        total_records = ReplicationBenchmark.objects.count()
        latest_record = ReplicationBenchmark.objects.first()
        
        metrics = {
            "timestamp": timezone.now().isoformat(),
            "total_benchmark_records": total_records,
            "latest_sequence_number": latest_record.sequence_number if latest_record else 0,
            "latest_tx_timestamp": latest_record.created_at.isoformat() if latest_record else None,
            "origin_cloud": latest_record.origin_cloud if latest_record else None,
            "origin_region": latest_record.origin_region if latest_record else None,
            "dr_status": {
                "failover_active": getattr(settings, 'DR_FAILOVER_ACTIVE', False),
                "cloud_provider": getattr(settings, 'CLOUD_PROVIDER', 'AWS'),
            }
        }
        return Response(metrics, status=status.HTTP_200_OK)


class ReplicationStatusView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        current_cloud = os.getenv("CURRENT_CLOUD", getattr(settings, 'CLOUD_PROVIDER', 'AWS'))
        is_failover = getattr(settings, 'DR_FAILOVER_ACTIVE', False)
        telemetry = LagMonitorCommand.collect_replication_metrics(current_cloud, is_failover)
        return Response(telemetry, status=status.HTTP_200_OK)


class StorageStatusView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        storage_metrics = StorageAuditCommand.collect_storage_metrics()
        return Response(storage_metrics, status=status.HTTP_200_OK)


class QuorumStatusView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        quorum_state = {
            "timestamp": timezone.now().isoformat(),
            "active_leader": os.getenv("CURRENT_CLOUD", "AWS"),
            "fencing_epoch": int(os.getenv("FENCING_EPOCH", "1")),
            "vantage_points": {
                "vantage_a_observer_gcp": {"status": "UP", "vote": "AWS_HEALTHY"},
                "vantage_b_azure_app": {"status": "UP", "vote": "AWS_HEALTHY"},
                "vantage_c_aws_app": {"status": "UP", "vote": "AWS_HEALTHY"},
            },
            "consensus_status": "PRIMARY_HEALTHY",
            "failover_authorized": False,
        }
        return Response(quorum_state, status=status.HTTP_200_OK)


class OriginVerifyView(APIView):
    """
    GET /api/dr/origin-verify/
    Returns origin cloud identity, container instance ID, edge POP header details,
    and failover promotion status for Anycast cutover propagation auditing.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        cf_ray = request.headers.get("CF-Ray", "")
        azure_ref = request.headers.get("X-Azure-Ref", "")
        forwarded_for = request.headers.get("X-Forwarded-For", request.META.get("REMOTE_ADDR", ""))

        edge_pop = "DIRECT"
        if cf_ray:
            pop_code = cf_ray.split("-")[-1] if "-" in cf_ray else cf_ray
            edge_pop = f"Cloudflare-{pop_code}"
        elif azure_ref:
            edge_pop = "Azure-FrontDoor"

        is_promoted = os.getenv("DR_FAILOVER_ACTIVE", "false").lower() in ("true", "1", "yes")

        data = {
            "timestamp": timezone.now().isoformat(),
            "current_cloud": os.getenv("CURRENT_CLOUD", getattr(settings, 'CLOUD_PROVIDER', 'AWS')),
            "instance_id": socket.gethostname(),
            "edge_pop": edge_pop,
            "client_ip": forwarded_for.split(",")[0].strip(),
            "is_dr_promoted": is_promoted,
            "x_served_by_cloud": os.getenv("CURRENT_CLOUD", "AWS"),
        }
        return Response(data, status=status.HTTP_200_OK)


class DROrchestrationLogView(generics.ListAPIView):
    """
    GET /api/dr/orchestration-log/
    Exposes an immutable audit log detailing timestamps, actor (Automated Quorum vs. Manual SRE Override),
    step execution durations, and final RTO/RPO achieved.
    """
    permission_classes = []
    authentication_classes = []
    queryset = DROrchestrationLog.objects.all()
    serializer_class = DROrchestrationLogSerializer


class ChaosAuditView(APIView):
    """
    GET /api/dr/chaos-audit/
    Exposes real-time disaster drill chaos audit telemetry: sequence numbers,
    database commit timestamps, current cloud provider, active write node, and replication lag deltas.
    """
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        latest_tx = ReplicationBenchmark.objects.first()
        total_tx = ReplicationBenchmark.objects.count()
        latest_log = DROrchestrationLog.objects.first()

        current_cloud = os.getenv("CURRENT_CLOUD", getattr(settings, 'CLOUD_PROVIDER', 'AWS'))
        is_promoted = os.getenv("DR_FAILOVER_ACTIVE", "false").lower() in ("true", "1", "yes")

        data = {
            "timestamp": timezone.now().isoformat(),
            "chaos_audit": {
                "active_cloud_provider": current_cloud,
                "is_dr_promoted": is_promoted,
                "total_committed_records": total_tx,
                "latest_sequence_number": latest_tx.sequence_number if latest_tx else 0,
                "latest_commit_timestamp": latest_tx.created_at.isoformat() if latest_tx else None,
                "latest_checksum": latest_tx.checksum if latest_tx else None,
            },
            "last_drill_result": {
                "action": latest_log.action if latest_log else "N/A",
                "actor": latest_log.actor if latest_log else "N/A",
                "status": latest_log.status if latest_log else "N/A",
                "rto_seconds": latest_log.rto_seconds if latest_log else 0.0,
                "rpo_seconds": latest_log.rpo_seconds if latest_log else 0.0,
            }
        }
        return Response(data, status=status.HTTP_200_OK)


