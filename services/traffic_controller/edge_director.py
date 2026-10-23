import os
import sys
import time
import json
import logging
import requests
from typing import Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ragnarock.edge_director")

CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CLOUDFLARE_ZONE_ID = os.getenv("CLOUDFLARE_ZONE_ID", "abcdef0123456789abcdef0123456789")
CLOUDFLARE_LB_ID = os.getenv("CLOUDFLARE_LB_ID", "lb-ragnarock-global-id")
AWS_POOL_ID = os.getenv("AWS_PRIMARY_POOL_ID", "pool-aws-primary-id")
AZURE_POOL_ID = os.getenv("AZURE_SECONDARY_POOL_ID", "pool-azure-secondary-id")


class EdgeDirector:
    """
    Automated Dynamic Edge Director & Traffic Steering Controller.
    Interfaces with Cloudflare / Anycast Edge API to execute instant forced origin swaps
    upon receiving a valid Phase 7 Quorum Failover Authorization Token.
    """

    def __init__(self):
        self.api_token = CLOUDFLARE_API_TOKEN
        self.zone_id = CLOUDFLARE_ZONE_ID
        self.lb_id = CLOUDFLARE_LB_ID
        self.aws_pool_id = AWS_POOL_ID
        self.azure_pool_id = AZURE_POOL_ID
        self.headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def execute_failover_to_azure(self, fencing_epoch: int) -> bool:
        """
        Executes immediate forced origin swap:
        Re-orders origin pools so Azure Container App is Priority 1 and AWS ALB is removed or demoted.
        """
        logger.info("==========================================================================")
        logger.info(f" [EMERGENCY CUTOVER] Executing Edge Failover to Azure (Epoch: {fencing_epoch}) ")
        logger.info("==========================================================================")

        if not self.api_token:
            logger.warning("[MOCK-MODE] CLOUDFLARE_API_TOKEN unconfigured. Simulating API Cutover Payload...")
            time.sleep(0.5) # Simulate network API call latency (500ms)
            logger.info(f"[MOCK-SUCCESS] Edge Load Balancer '{self.lb_id}' updated! Active Pool: AZURE (Priority 1).")
            return True

        url = f"https://api.cloudflare.com/client/v4/zones/{self.zone_id}/load_balancers/{self.lb_id}"
        payload = {
            "default_pools": [self.azure_pool_id, self.aws_pool_id],
            "fallback_pool": self.aws_pool_id,
            "steering_policy": "priority",
            "pop_pools": {},
        }

        try:
            res = requests.patch(url, headers=self.headers, json=payload, timeout=5.0)
            if res.status_code == 200:
                logger.info(f"[EDGE CUTOVER SUCCESS] Re-routed traffic to Azure Pool '{self.azure_pool_id}' in < 1s!")
                return True
            else:
                logger.error(f"[EDGE CUTOVER ERROR] Cloudflare API returned HTTP {res.status_code}: {res.text}")
                return False
        except Exception as exc:
            logger.critical(f"[EDGE CUTOVER CRITICAL] Exception communicating with Edge API: {exc}")
            return False

    def route_traffic_to_aws(self) -> bool:
        """
        Idempotent restore function:
        Re-routes traffic back to AWS Primary ALB (Priority 1) for post-incident recovery.
        """
        logger.info("==========================================================================")
        logger.info(" [FAILBACK RESTORE] Re-routing Edge Traffic to AWS Primary ALB (Priority 1)")
        logger.info("==========================================================================")

        if not self.api_token:
            logger.warning("[MOCK-MODE] CLOUDFLARE_API_TOKEN unconfigured. Simulating Failback API Call...")
            time.sleep(0.5)
            logger.info(f"[MOCK-SUCCESS] Edge Load Balancer '{self.lb_id}' restored! Active Pool: AWS (Priority 1).")
            return True

        url = f"https://api.cloudflare.com/client/v4/zones/{self.zone_id}/load_balancers/{self.lb_id}"
        payload = {
            "default_pools": [self.aws_pool_id, self.azure_pool_id],
            "fallback_pool": self.azure_pool_id,
            "steering_policy": "priority",
        }

        try:
            res = requests.patch(url, headers=self.headers, json=payload, timeout=5.0)
            if res.status_code == 200:
                logger.info(f"[FAILBACK SUCCESS] Re-routed traffic back to AWS Primary ALB '{self.aws_pool_id}'!")
                return True
            else:
                logger.error(f"[FAILBACK ERROR] Cloudflare API returned HTTP {res.status_code}: {res.text}")
                return False
        except Exception as exc:
            logger.error(f"[FAILBACK EXCEPTION] {exc}")
            return False


if __name__ == "__main__":
    director = EdgeDirector()
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        director.route_traffic_to_aws()
    else:
        director.execute_failover_to_azure(fencing_epoch=2)
