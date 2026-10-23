import os
import json
import logging
import requests
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ragnarock.notifications")

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
PAGERDUTY_ROUTING_KEY = os.getenv("PAGERDUTY_ROUTING_KEY", "")


class NotificationDispatcher:
    """
    Multi-Channel DR Event Notification Dispatcher.
    Broadcasts real-time failover and failback milestones to Slack, Discord, and PagerDuty.
    """

    def __init__(self):
        self.slack_url = SLACK_WEBHOOK_URL
        self.discord_url = DISCORD_WEBHOOK_URL
        self.pagerduty_key = PAGERDUTY_ROUTING_KEY

    def send_notification(self, event_type: str, message: str, details: Optional[Dict[str, Any]] = None) -> bool:
        """
        Broadcasts notification across configured channels.
        """
        details = details or {}
        logger.info(f"[NOTIFY - {event_type.upper()}] {message}")

        success_count = 0

        # 1. Dispatch to Slack Webhook
        if self.slack_url:
            try:
                slack_payload = {
                    "text": f"🚨 *[PROJECT RAGNAROCK DR ALERT - {event_type.upper()}]*\n{message}",
                    "attachments": [
                        {
                            "color": "#FF0000" if "FAIL" in event_type.upper() or "ERROR" in event_type.upper() else "#36a64f",
                            "fields": [
                                {"title": key, "value": str(val), "short": True}
                                for key, val in details.items()
                            ]
                        }
                    ]
                }
                res = requests.post(self.slack_url, json=slack_payload, timeout=3.0)
                if res.status_code == 200:
                    success_count += 1
            except Exception as exc:
                logger.error(f"Failed to post to Slack: {exc}")

        # 2. Dispatch to Discord Webhook
        if self.discord_url:
            try:
                discord_payload = {
                    "content": f"🚨 **[PROJECT RAGNAROCK DR ALERT - {event_type.upper()}]**\n{message}",
                    "embeds": [
                        {
                            "title": "Orchestration Milestone Details",
                            "color": 15158332 if "FAIL" in event_type.upper() or "ERROR" in event_type.upper() else 3066993,
                            "fields": [
                                {"name": key, "value": str(val), "inline": True}
                                for key, val in details.items()
                            ]
                        }
                    ]
                }
                res = requests.post(self.discord_url, json=discord_payload, timeout=3.0)
                if res.status_code in (200, 204):
                    success_count += 1
            except Exception as exc:
                logger.error(f"Failed to post to Discord: {exc}")

        # 3. Dispatch to PagerDuty Events v2 API
        if self.pagerduty_key:
            try:
                pd_payload = {
                    "routing_key": self.pagerduty_key,
                    "event_action": "trigger" if "FAILOVER" in event_type.upper() else "resolve",
                    "payload": {
                        "summary": f"Ragnarock DR Orchestration: {event_type} - {message}",
                        "source": "ragnarock-orchestrator",
                        "severity": "critical" if "FAILOVER" in event_type.upper() else "info",
                        "custom_details": details
                    }
                }
                res = requests.post("https://events.pagerduty.com/v2/enqueue", json=pd_payload, timeout=3.0)
                if res.status_code in (200, 202):
                    success_count += 1
            except Exception as exc:
                logger.error(f"Failed to post to PagerDuty: {exc}")

        return True
