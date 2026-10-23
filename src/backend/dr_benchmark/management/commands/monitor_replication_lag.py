import os
import sys
import time
import json
import logging
from typing import Dict, Any, List

from django.core.management.base import BaseCommand
from django.db import connection, connections

logger = logging.getLogger("ragnarock.replication_monitoring")


class Command(BaseCommand):
    help = "Monitors PostgreSQL logical replication lag, byte delay, and estimated RPO across AWS and Azure."

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-lag-seconds",
            type=float,
            default=float(os.getenv("MAX_REPLICATION_LAG_SEC", "30.0")),
            help="Maximum acceptable replication lag in seconds (default: 30.0s)",
        )
        parser.add_argument(
            "--max-byte-lag",
            type=int,
            default=int(os.getenv("MAX_REPLICATION_BYTE_LAG", "52428800")), # 50MB
            help="Maximum acceptable byte lag in bytes (default: 50MB / 52,428,800 bytes)",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output replication telemetry as raw JSON payload",
        )

    def handle(self, *args, **options):
        max_lag_sec = options["max-lag-seconds"]
        max_byte_lag = options["max-byte-lag"]
        json_output = options["json"]

        current_cloud = os.getenv("CURRENT_CLOUD", "AWS")
        dr_failover_active = os.getenv("DR_FAILOVER_ACTIVE", "false").lower() in ("true", "1", "yes")

        metrics = self.collect_replication_metrics(current_cloud, dr_failover_active)

        is_exceeded = metrics.get("lag_warning", False)

        if json_output:
            self.stdout.write(json.dumps(metrics, indent=2))
            if is_exceeded:
                sys.exit(1)
            return

        # Terminal Tabular Output
        self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING("   PROJECT RAGNAROCK — POSTGRESQL LOGICAL REPLICATION TELEMETRY AUDIT      "))
        self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
        self.stdout.write(f"Cloud Region:              {metrics['cloud']}")
        self.stdout.write(f"Replication Role:          {metrics['role']}")
        self.stdout.write(f"Failover Status:           {'ACTIVE (DR Mode)' if dr_failover_active else 'PRIMARY (Normal)'}")
        
        if metrics["role"] == "publisher":
            self.stdout.write(f"Active Slots Count:        {len(metrics['replication_slots'])}")
            for slot in metrics["replication_slots"]:
                self.stdout.write(f"  - Slot Name:             {slot['slot_name']}")
                self.stdout.write(f"    Active:                {slot['active']}")
                self.stdout.write(f"    Byte Lag:              {slot['byte_lag']:,} bytes")
                self.stdout.write(f"    Estimated RPO:         {slot['estimated_rpo_seconds']:.3f} seconds")
        else:
            self.stdout.write(f"Active Subscriptions:      {len(metrics['subscriptions'])}")
            for sub in metrics["subscriptions"]:
                self.stdout.write(f"  - Sub Name:              {sub['sub_name']}")
                self.stdout.write(f"    Received LSN:          {sub['received_lsn']}")
                self.stdout.write(f"    Last Receipt Delay:    {sub['receipt_delay_seconds']:.3f} seconds")

        self.stdout.write(f"Lag Status:                {self.style.WARNING('[ ELEVATED RPO ]') if is_exceeded else self.style.SUCCESS('[ OK (< 2s) ]')}\n")

        if is_exceeded:
            self.stderr.write(self.style.ERROR(f"[WARNING] Replication lag exceeds configured threshold (Lag > {max_lag_sec}s or Byte Lag > {max_byte_lag}B)!"))
            sys.exit(1)

    @staticmethod
    def collect_replication_metrics(current_cloud: str, is_failover: bool) -> Dict[str, Any]:
        role = "subscriber" if is_failover or current_cloud == "AZURE" else "publisher"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        payload = {
            "timestamp": timestamp,
            "cloud": current_cloud,
            "role": role,
            "lag_warning": False,
            "replication_slots": [],
            "subscriptions": [],
        }

        try:
            with connection.cursor() as cursor:
                if role == "publisher":
                    # Query pg_stat_replication for WAL Publisher byte lag
                    cursor.execute("""
                        SELECT 
                            application_name,
                            client_addr,
                            state,
                            sent_lsn,
                            write_lsn,
                            flush_lsn,
                            replay_lsn,
                            pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS byte_lag
                        FROM pg_stat_replication;
                    """)
                    rows = cursor.fetchall()

                    for row in rows:
                        byte_lag = int(row[7]) if row[7] is not None else 0
                        est_rpo_sec = byte_lag / (1024 * 1024 * 5.0) # Estimated at 5MB/s network throughput
                        
                        slot_info = {
                            "slot_name": row[0] or "ragnarock_sub",
                            "client_addr": str(row[1]),
                            "state": row[2],
                            "sent_lsn": str(row[3]),
                            "replay_lsn": str(row[6]),
                            "byte_lag": byte_lag,
                            "estimated_rpo_seconds": round(est_rpo_sec, 3),
                        }
                        payload["replication_slots"].append(slot_info)

                        if byte_lag > 52428800 or est_rpo_sec > 30.0:
                            payload["lag_warning"] = True

                else:
                    # Query pg_stat_subscription for Subscriber status
                    cursor.execute("""
                        SELECT 
                            subname,
                            received_lsn,
                            last_msg_receipt_time,
                            latest_end_lsn,
                            EXTRACT(EPOCH FROM (NOW() - last_msg_receipt_time)) AS receipt_delay_sec
                        FROM pg_stat_subscription;
                    """)
                    rows = cursor.fetchall()

                    for row in rows:
                        delay_sec = float(row[4]) if row[4] is not None else 0.0
                        sub_info = {
                            "sub_name": row[0],
                            "received_lsn": str(row[1]),
                            "last_msg_receipt_time": str(row[2]),
                            "latest_end_lsn": str(row[3]),
                            "receipt_delay_seconds": round(delay_sec, 3),
                        }
                        payload["subscriptions"].append(sub_info)

                        if delay_sec > 30.0:
                            payload["lag_warning"] = True

        except Exception as exc:
            logger.error(f"Error querying replication metrics: {exc}")
            payload["error"] = str(exc)

        return payload
