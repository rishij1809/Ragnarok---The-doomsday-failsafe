from rest_framework import serializers
from .models import ReplicationBenchmark, DROrchestrationLog

class ReplicationBenchmarkSerializer(serializers.ModelSerializer):
    replication_lag_seconds = serializers.SerializerMethodField()

    class Meta:
        model = ReplicationBenchmark
        fields = [
            'id',
            'sequence_number',
            'payload_data',
            'client_tx_timestamp',
            'created_at',
            'origin_cloud',
            'origin_region',
            'checksum',
            'replication_lag_seconds',
        ]
        read_only_fields = ['id', 'created_at', 'checksum', 'replication_lag_seconds']

    def get_replication_lag_seconds(self, obj):
        if obj.created_at and obj.client_tx_timestamp:
            return round((obj.created_at - obj.client_tx_timestamp).total_seconds(), 4)
        return 0.0


class DROrchestrationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DROrchestrationLog
        fields = [
            'id',
            'timestamp',
            'action',
            'actor',
            'status',
            'trigger_token',
            'step_durations',
            'rto_seconds',
            'rpo_seconds',
            'audit_trail',
        ]
        read_only_fields = ['id', 'timestamp']

