import json
import logging
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from tests.chaos.chaos_runner import ChaosRunner
from tests.chaos.traffic_benchmark import TrafficBenchmarkHarness
from services.orchestrator.engine import FailoverOrchestrator
from dr_benchmark.models import DROrchestrationLog

logger = logging.getLogger("ragnarock.management.run_disaster_drill")


class Command(BaseCommand):
    help = "Executes automated chaos engineering disaster drill and evaluates SLO compliance (RTO < 120s, RPO < 10s)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--scenario',
            type=str,
            choices=['blackhole', 'db_kill', 'partition'],
            default='blackhole',
            help="Chaos catastrophe scenario to inject"
        )
        parser.add_argument(
            '--rps',
            type=int,
            default=50,
            help="Traffic load generator requests/sec"
        )

    def handle(self, *args, **options):
        scenario = options['scenario']
        rps = options['rps']

        self.stdout.write(self.style.WARNING(f"=== INITIATING DISASTER DRILL (Scenario: {scenario.upper()}, Load: {rps} RPS) ==="))

        runner = ChaosRunner()
        harness = TrafficBenchmarkHarness(target_rps=rps)
        orchestrator = FailoverOrchestrator()

        try:
            # 1. Inject Chaos Scenario
            if scenario == "blackhole":
                runner.scenario_a_region_blackhole()
            elif scenario == "db_kill":
                runner.scenario_b_db_catastrophic_kill()
            elif scenario == "partition":
                runner.scenario_c_partition_interconnect_sever()

            # 2. Run Benchmark & Orchestration
            failover_res = orchestrator.run_failover(fencing_token="EPOCH:2", actor=f"Disaster Drill ({scenario})", force=True)
            bench_res = harness.run_benchmark(duration_seconds=10)

            rto = failover_res.get("rto_seconds", 0.0)
            rpo = bench_res.get("empirical_results", {}).get("realized_rpo_seconds", 0.0)

            rto_pass = rto < 120.0
            rpo_pass = rpo < 10.0
            drill_success = rto_pass and rpo_pass and failover_res.get("success", False)

            # 3. Log Audit Entry into Django DB
            DROrchestrationLog.objects.create(
                action=f"DRILL_{scenario.upper()}",
                actor=f"Disaster Drill ({scenario})",
                status="SUCCESS" if drill_success else "FAILED",
                trigger_token="EPOCH:2",
                step_durations=failover_res.get("step_durations", {}),
                rto_seconds=rto,
                rpo_seconds=rpo,
                audit_trail=failover_res.get("audit_trail", [])
            )

            self.stdout.write(self.style.SUCCESS(f"Realized RTO: {rto}s (SLO < 120s) -> {'PASS' if rto_pass else 'FAIL'}"))
            self.stdout.write(self.style.SUCCESS(f"Realized RPO: {rpo}s (SLO < 10s)  -> {'PASS' if rpo_pass else 'FAIL'}"))

            if not drill_success:
                raise CommandError(f"Disaster drill failed SLO compliance criteria! RTO: {rto}s, RPO: {rpo}s.")

            self.stdout.write(self.style.SUCCESS("=== DISASTER DRILL PASSED ALL SLO COMPLIANCE CRITERIA ==="))

        finally:
            self.stdout.write(self.style.NOTICE("[TEARDOWN] Executing auto-remediation teardown routine..."))
            runner.remediate_all()
