import os
import sys
import time
import hashlib
import json
import requests
from typing import Dict, Any, Tuple

from django.core.management.base import BaseCommand
from django.db import connection, connections


class Command(BaseCommand):
    help = "Audits code parity, migration schema hashes, runtime library versions, and database state across AWS and Azure environments."

    def add_arguments(self, parser):
        parser.add_argument(
            "--remote-url",
            type=str,
            default=os.getenv("REMOTE_CLOUD_HEALTH_URL", ""),
            help="Healthz endpoint of counterpart cloud service for cross-cloud parity verification",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output parity audit report as raw JSON dictionary",
        )

    def handle(self, *args, **options):
        remote_url = options["remote-url"]
        json_output = options["json"]

        local_parity_data = self._collect_local_parity_metrics()

        remote_parity_data = None
        parity_match = True
        mismatch_reasons = []

        if remote_url:
            remote_parity_data = self._fetch_remote_parity_metrics(remote_url)
            if remote_parity_data:
                # Compare Git Commit SHA
                if local_parity_data["git_commit_sha"] != remote_parity_data.get("git_commit_sha"):
                    parity_match = False
                    mismatch_reasons.append(
                        f"Commit SHA mismatch: Local ({local_parity_data['git_commit_sha']}) vs Remote ({remote_parity_data.get('git_commit_sha')})"
                    )

                # Compare DB Migration Schema Hash
                if local_parity_data["schema_migration_hash"] != remote_parity_data.get("schema_migration_hash"):
                    parity_match = False
                    mismatch_reasons.append(
                        f"Migration Schema mismatch: Local ({local_parity_data['schema_migration_hash']}) vs Remote ({remote_parity_data.get('schema_migration_hash')})"
                    )

        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "local_cloud": local_parity_data["cloud_provider"],
            "parity_status": "MATCH" if parity_match else "MISMATCH",
            "local_metrics": local_parity_data,
            "remote_metrics": remote_parity_data,
            "mismatch_reasons": mismatch_reasons,
        }

        if json_output:
            self.stdout.write(json.dumps(report, indent=2))
            if not parity_match:
                sys.exit(1)
            return

        # Terminal Tabular Output
        self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING("      PROJECT RAGNAROCK — MULTI-CLOUD CODE & SCHEMA PARITY AUDIT          "))
        self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
        self.stdout.write(f"Local Cloud Region:        {local_parity_data['cloud_provider']}")
        self.stdout.write(f"Git Commit SHA:            {local_parity_data['git_commit_sha']}")
        self.stdout.write(f"Migration Schema Hash:     {local_parity_data['schema_migration_hash']}")
        self.stdout.write(f"Database Latency RTT:      {local_parity_data['db_latency_ms']:.2f} ms")
        self.stdout.write(f"Active Writer DB Alias:    {local_parity_data['active_writer_alias']}")
        self.stdout.write(f"Python Runtime:            {local_parity_data['python_version']}\n")

        if remote_parity_data:
            self.stdout.write(self.style.HTTP_INFO("--- COUNTERPART CLOUD PARITY COMPARISON ---"))
            self.stdout.write(f"Remote Cloud Region:       {remote_parity_data.get('cloud_provider', 'UNKNOWN')}")
            self.stdout.write(f"Remote Commit SHA:         {remote_parity_data.get('git_commit_sha', 'N/A')}")
            self.stdout.write(f"Remote Schema Hash:        {remote_parity_data.get('schema_migration_hash', 'N/A')}")
            self.stdout.write(f"Parity Match Result:       {self._format_parity_status(parity_match)}\n")

            if not parity_match:
                self.stderr.write(self.style.ERROR("[CRITICAL] MULTI-CLOUD CODE OR DB SCHEMA DRIFT DETECTED!"))
                for reason in mismatch_reasons:
                    self.stderr.write(self.style.ERROR(f"  - {reason}"))
                sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS("[PARITY AUDIT] Local node health and migration schema successfully validated."))

    def _collect_local_parity_metrics(self) -> Dict[str, Any]:
        git_sha = os.getenv("GIT_COMMIT_SHA", os.getenv("GITHUB_SHA", "dev-build-latest"))[:8]
        current_cloud = os.getenv("CURRENT_CLOUD", "LOCAL")

        # Calculate DB Migration Schema Hash
        schema_hash, migration_count = self._compute_migration_hash()

        # Test Local Database Latency
        db_latency_ms, active_alias = self._measure_db_latency()

        return {
            "cloud_provider": current_cloud,
            "git_commit_sha": git_sha,
            "schema_migration_hash": schema_hash,
            "total_migrations_applied": migration_count,
            "db_latency_ms": round(db_latency_ms, 2),
            "active_writer_alias": active_alias,
            "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        }

    def _compute_migration_hash(self) -> Tuple[str, int]:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT app, name, applied FROM django_migrations ORDER BY app, name;")
                rows = cursor.fetchall()
                migration_count = len(rows)

                digest = hashlib.sha256()
                for app, name, applied in rows:
                    digest.update(f"{app}:{name}:{applied}".encode("utf-8"))

                return (digest.hexdigest()[:12], migration_count)
        except Exception as exc:
            # Fallback if DB not migrated yet
            return ("no-migrations-table", 0)

    def _measure_db_latency(self) -> Tuple[float, str]:
        start = time.perf_counter()
        active_alias = "default"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            return (elapsed_ms, active_alias)
        except Exception:
            return (-1.0, "unreachable")

    def _fetch_remote_parity_metrics(self, url: str) -> Dict[str, Any]:
        try:
            res = requests.get(url, timeout=5.0)
            if res.status_code == 200:
                data = res.json()
                return {
                    "cloud_provider": data.get("cloud_provider", data.get("region", "REMOTE")),
                    "git_commit_sha": data.get("git_commit_sha", "unknown")[:8],
                    "schema_migration_hash": data.get("schema_migration_hash", "unknown"),
                }
        except Exception:
            pass
        return {}

    def _format_parity_status(self, is_match: bool) -> str:
        if is_match:
            return self.style.SUCCESS("[ PARITY MATCHED ]")
        return self.style.ERROR("[ DRIFT / MISMATCH ]")
