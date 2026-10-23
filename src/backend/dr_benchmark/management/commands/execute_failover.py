import json
import logging
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from services.orchestrator.engine import FailoverOrchestrator
from dr_benchmark.models import DROrchestrationLog

logger = logging.getLogger("ragnarock.management.execute_failover")


class Command(BaseCommand):
    help = "Executes automated multi-cloud DR failover from AWS Primary to Azure Standby."

    def add_arguments(self, parser):
        parser.add_argument(
            '--token',
            type=str,
            default="EPOCH:2",
            help="Phase 7 Quorum fencing token string (default: EPOCH:2)"
        )
        parser.add_argument(
            '--actor',
            type=str,
            default="Manual SRE Override",
            help="Entity initiating failover execution (e.g. Automated Quorum or Manual SRE Override)"
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help="Force failover execution regardless of fencing token signature validation"
        )

    def handle(self, *args, **options):
        token = options['token']
        actor = options['actor']
        force = options['force']

        self.stdout.write(self.style.WARNING(f"=== INITIATING DR FAILOVER EXECUTION (Actor: {actor}) ==="))

        orchestrator = FailoverOrchestrator()
        result = orchestrator.run_failover(fencing_token=token, actor=actor, force=force)

        # Log entry to immutable Django DROrchestrationLog model
        try:
            DROrchestrationLog.objects.create(
                action="FAILOVER",
                actor=actor,
                status="SUCCESS" if result.get("success") else "FAILED",
                trigger_token=token,
                step_durations=result.get("step_durations", {}),
                rto_seconds=result.get("rto_seconds", 0.0),
                rpo_seconds=result.get("rpo_seconds", 0.0),
                audit_trail=result.get("audit_trail", [])
            )
            self.stdout.write(self.style.SUCCESS("[AUDIT LOG] Failover execution logged to DROrchestrationLog table."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"[AUDIT LOG WARNING] Failed to persist audit log entry: {exc}"))

        self.stdout.write(json.dumps(result, indent=2))

        if not result.get("success"):
            raise CommandError(f"Failover execution failed: {result.get('error')}")

        self.stdout.write(self.style.SUCCESS(f"=== FAILOVER COMPLETED SUCCESSFULLY (RTO: {result.get('rto_seconds')}s) ==="))
