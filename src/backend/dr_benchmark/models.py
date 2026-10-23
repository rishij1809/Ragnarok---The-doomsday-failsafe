import uuid
import hashlib
from django.db import models
from django.utils import timezone

class ReplicationBenchmark(models.Model):
    """
    Benchmark workload model designed for measuring cross-cloud database
    replication latency, transaction consistency, and data loss (RPO testing)
    during simulated or actual DR failovers between AWS and Azure.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sequence_number = models.BigIntegerField(db_index=True)
    payload_data = models.TextField(help_text="Benchmark transaction payload")
    client_tx_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    origin_cloud = models.CharField(max_length=20, default='AWS')
    origin_region = models.CharField(max_length=30, default='us-east-1')
    checksum = models.CharField(max_length=64, blank=True, help_text="SHA-256 integrity checksum")

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at', 'origin_cloud']),
            models.Index(fields=['sequence_number']),
        ]

    def save(self, *args, **kwargs):
        if not self.checksum:
            raw_content = f"{self.id}:{self.sequence_number}:{self.payload_data}:{self.origin_cloud}"
            self.checksum = hashlib.sha256(raw_content.encode('utf-8')).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"BenchmarkTx #{self.sequence_number} [{self.origin_cloud}:{self.origin_region}] @ {self.created_at}"


class DROrchestrationLog(models.Model):
    """
    Immutable Audit Log storing multi-cloud failover & failback orchestration telemetry:
    timestamps, actor (Automated Quorum vs. Manual SRE Override), step execution durations,
    and achieved RTO/RPO metrics.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    action = models.CharField(max_length=30, help_text="FAILOVER, FAILBACK, or SIMULATION")
    actor = models.CharField(max_length=100, default="Automated Quorum", help_text="Entity initiating the workflow")
    status = models.CharField(max_length=30, default="SUCCESS", help_text="SUCCESS, FAILED, or IN_PROGRESS")
    trigger_token = models.TextField(blank=True, help_text="Phase 7 Quorum fencing token string")
    step_durations = models.JSONField(default=dict, help_text="Execution durations per FSM step")
    rto_seconds = models.FloatField(default=0.0, help_text="Final Recovery Time Objective achieved in seconds")
    rpo_seconds = models.FloatField(default=0.0, help_text="Final Recovery Point Objective achieved in seconds")
    audit_trail = models.JSONField(default=list, help_text="Detailed chronological audit events")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp', 'action']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"DROrchestrationLog [{self.action}] by {self.actor} - {self.status} @ {self.timestamp} (RTO: {self.rto_seconds}s)"

