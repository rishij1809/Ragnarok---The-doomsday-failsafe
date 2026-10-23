import logging
from typing import Dict, Any

logger = logging.getLogger("ragnarock.metrics")


class MetricsExporter:
    """
    Prometheus and Datadog Metric Exporter for DR Failover Telemetry.
    Tracks failover durations, system status codes, error rates, and step timings.
    """

    STATUS_NORMAL_AWS = 0
    STATUS_FAILOVER_IN_PROGRESS = 1
    STATUS_DR_ACTIVE_AZURE = 2
    STATUS_FAILBACK_IN_PROGRESS = 3

    def __init__(self):
        self.metrics = {
            "dr_failover_duration_seconds": 0.0,
            "dr_status_code": self.STATUS_NORMAL_AWS,
            "post_failover_error_rate": 0.0,
            "dr_step_duration_seconds": {}
        }

    def set_dr_status_code(self, code: int):
        """
        Updates dr_status_code metric gauge.
        """
        self.metrics["dr_status_code"] = code
        logger.info(f"[METRIC EMITTED] dr_status_code={code}")

    def record_failover_duration(self, seconds: float):
        """
        Records overall failover execution time in seconds.
        """
        self.metrics["dr_failover_duration_seconds"] = round(seconds, 3)
        logger.info(f"[METRIC EMITTED] dr_failover_duration_seconds={seconds:.3f}")

    def record_step_duration(self, step_name: str, seconds: float):
        """
        Records individual step execution duration.
        """
        self.metrics["dr_step_duration_seconds"][step_name] = round(seconds, 3)
        logger.info(f"[METRIC EMITTED] dr_step_duration_seconds[{step_name}]={seconds:.3f}")

    def set_post_failover_error_rate(self, rate: float):
        """
        Updates post-failover error rate gauge.
        """
        self.metrics["post_failover_error_rate"] = round(rate, 4)
        logger.info(f"[METRIC EMITTED] post_failover_error_rate={rate:.4f}")

    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Returns full telemetry snapshot for Prometheus scraping / Datadog push.
        """
        return self.metrics
