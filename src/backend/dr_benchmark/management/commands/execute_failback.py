import json
import logging
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from services.orchestrator.failback import FailbackOrchestrator
from dr_benchmark.models import DROrchestrationLog

logger = logging.getLogger("ragnarock.management.execute_failback")


class Command(BaseCommand):
    help = "Executes reverse synchronization and failback from Azure Standby back to AWS Primary."

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help="Confirm failback execution and AWS Primary restoration"
        )
        parser.add_argument(
            '--actor',
            type=str,
            default="Manual SRE Override",
            help="Entity initiating failback execution"
        )

    def handle(self, *args, **options):
        confirm = options['confirm']
        actor = options['actor']

        if not confirm:
            raise CommandError("Failback execution requires explicit confirmation flag '--confirm'.")

        self.stdout.write(self.style.WARNING(f"=== INITIATING REVERSE FAILBACK RECOVERY (Actor: {actor}) ==="))

        orchestrator = FailbackOrchestrator()
        result = orchestrator.run_failback(confirm=confirm, actor=actor)

        # Log entry to immutable Django DROrchestrationLog model
        try:
            DROrchestrationLog.objects.create(
                action="FAILBACK",
                actor=actor,
                status="SUCCESS" if result.get("success") else "FAILED",
                trigger_token="N/A (FAILBACK_RESTORE)",
                step_durations=result.get("step_durations", {}),
                rto_seconds=result.get("duration_seconds", 0.0),
                rpo_seconds=0.0,
                audit_trail=result.get("audit_trail", [])
            )
            self.stdout.write(self.style.SUCCESS("[AUDIT LOG] Failback execution logged to DROrchestrationLog table."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"[AUDIT LOG WARNING] Failed to persist audit log entry: {exc}"))

        self.stdout.write(json.dumps(result, indent=2))

        if not result.get("success"):
            raise CommandError(f"Failback execution failed: {result.get('error')}")

        self.stdout.write(self.style.SUCCESS(f"=== FAILBACK COMPLETED SUCCESSFULLY in {result.get('duration_seconds')}s ==="))
