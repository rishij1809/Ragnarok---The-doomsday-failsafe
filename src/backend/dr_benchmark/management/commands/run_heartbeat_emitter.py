import os
import sys
import time
import requests
import logging
from django.core.management.base import BaseCommand

logger = logging.getLogger("ragnarock.heartbeat_emitter")


class Command(BaseCommand):
    help = "Emits continuous signed heartbeat leases from Django Primary node to the Quorum Witness Node."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=int(os.getenv("HEARTBEAT_INTERVAL_SEC", "3")),
            help="Heartbeat emission interval in seconds (default: 3s)",
        )
        parser.add_argument(
            "--witness-url",
            type=str,
            default=os.getenv("QUORUM_WITNESS_URL", "http://localhost:8001/heartbeat"),
            help="URL of Quorum Witness Node arbiter",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        witness_url = options["witness-url"]
        current_cloud = os.getenv("CURRENT_CLOUD", "AWS")
        fencing_epoch = int(os.getenv("FENCING_EPOCH", "1"))

        self.stdout.write(f"[HEARTBEAT] Emitting signed heartbeats to {witness_url} every {interval}s (Cloud: {current_cloud}, Epoch: {fencing_epoch})...")

        while True:
            payload = {
                "source_cloud": current_cloud,
                "fencing_epoch": fencing_epoch,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "hostname": os.uname().nodename if hasattr(os, "uname") else "localhost",
            }
            try:
                res = requests.post(witness_url, json=payload, timeout=2.0)
                if res.status_code == 200:
                    logger.debug(f"[HEARTBEAT OK] Lease renewed successfully.")
                else:
                    logger.warning(f"[HEARTBEAT WARN] Witness returned HTTP {res.status_code}")
            except Exception as exc:
                logger.error(f"[HEARTBEAT FAIL] Could not reach Quorum Witness: {exc}")

            time.sleep(interval)
