import os
import time
import json
import logging
import requests
from typing import Dict, Any

logger = logging.getLogger("ragnarock.webhook_dispatcher")

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
PAGERDUTY_EVENTS_URL = os.getenv("PAGERDUTY_EVENTS_URL", "https://events.pagerduty.com/v2/enqueue")
PAGERDUTY_ROUTING_KEY = os.getenv("PAGERDUTY_ROUTING_KEY", "")


class WebhookDispatcher:
    """
    Automated Webhook Dispatcher for Quorum State Transitions & Failover Alerts.
    Broadcasts state transitions: PRIMARY_HEALTHY, PARTITION_DETECTED, PRIMARY_DOWN_QUORUM_CONFIRMED.
    """

    @staticmethod
    def dispatch_alert(event_type: str, details: Dict[str, Any]):
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        logger.info(f"[WEBHOOK] Dispatching Event: {event_type} | Details: {details}")

        if event_type == "PRIMARY_HEALTHY":
            color = "#36a64f"
            summary = "AWS Primary is HEALTHY. Normal Operations."
            severity = "info"
        elif event_type == "PARTITION_DETECTED":
            color = "#ffcc00"
            summary = "WARNING: Cross-Cloud Network Partition Detected! AWS Primary is STILL HEALTHY externally. Split-Brain BLOCKED."
            severity = "warning"
        elif event_type == "PRIMARY_DOWN_QUORUM_CONFIRMED":
            color = "#ff0000"
            summary = "CRITICAL: 2 of 3 Quorum Observers confirm AWS Primary Failure! Fencing Token Issued for Azure Failover."
            severity = "critical"
        else:
            color = "#808080"
            summary = f"Quorum Event: {event_type}"
            severity = "info"

        # 1. Slack / Discord Webhook Payload
        if SLACK_WEBHOOK_URL:
            slack_payload = {
                "attachments": [
                    {
                        "color": color,
                        "title": f"Project Ragnarock DR Alert — {event_type}",
                        "text": summary,
                        "fields": [
                            {"title": "Timestamp", "value": timestamp, "short": True},
                            {"title": "Vantage Votes", "value": f"{details.get('positive_votes', 0)}/3 AWS Available", "short": True},
                            {"title": "Fencing Epoch", "value": str(details.get("fencing_epoch", 0)), "short": True},
                            {"title": "Failover Authorized", "value": str(details.get("failover_authorized", False)), "short": True},
                        ],
                    }
                ]
            }
            try:
                requests.post(SLACK_WEBHOOK_URL, json=slack_payload, timeout=3.0)
            except Exception as exc:
                logger.error(f"Failed to post to Slack webhook: {exc}")

        # 2. PagerDuty Alert Event
        if PAGERDUTY_ROUTING_KEY and severity in ("warning", "critical"):
            pd_payload = {
                "routing_key": PAGERDUTY_ROUTING_KEY,
                "event_action": "trigger",
                "payload": {
                    "summary": f"[RAGNAROCK DR] {event_type}: {summary}",
                    "timestamp": timestamp,
                    "severity": severity,
                    "source": "quorum-witness-node",
                    "custom_details": details,
                },
            }
            try:
                requests.post(PAGERDUTY_EVENTS_URL, json=pd_payload, timeout=3.0)
            except Exception as exc:
                logger.error(f"Failed to post to PagerDuty: {exc}")
