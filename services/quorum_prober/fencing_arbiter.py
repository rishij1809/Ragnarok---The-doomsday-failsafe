import os
import time
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger("ragnarock.fencing_arbiter")


class FencingArbiter:
    """
    Strongly Consistent Distributed Fencing & Lease Arbiter.
    Manages primary cloud heartbeat leases and issues monotonically increasing fencing tokens
    (epoch_counter + 1) to prevent split-brain write corruption.
    """

    def __init__(self, lease_ttl_seconds: int = 10):
        self.lease_ttl = lease_ttl_seconds
        self.active_leader = "AWS"
        self.fencing_epoch = 1
        self.last_heartbeat_timestamp = time.time()
        self.failover_authorized = False

    def receive_heartbeat(self, source_cloud: str, token: int) -> bool:
        """
        Receives signed heartbeat lease renewal from Primary cloud node.
        """
        if token < self.fencing_epoch:
            logger.warning(f"[FENCING REJECT] Stale heartbeat token {token} from {source_cloud} rejected! Current Epoch: {self.fencing_epoch}")
            return False

        if source_cloud == self.active_leader:
            self.last_heartbeat_timestamp = time.time()
            logger.debug(f"[HEARTBEAT] Lease renewed for {source_cloud} (Epoch: {self.fencing_epoch}).")
            return True

        return False

    def is_lease_valid(self) -> bool:
        """
        Checks if Primary cloud heartbeat lease is active and unexpired.
        """
        elapsed = time.time() - self.last_heartbeat_timestamp
        return elapsed <= self.lease_ttl

    def evaluate_quorum_and_issue_fencing_token(
        self,
        vantage_a_aws_ok: bool,
        vantage_b_aws_ok: bool,
        vantage_c_aws_ok: bool
    ) -> Tuple[bool, int, str]:
        """
        Strict Majority Quorum Evaluation:
        Consensus rule: 2 of 3 vantage points must agree AWS is DOWN before issuing failover authorization.
        """
        votes = [vantage_a_aws_ok, vantage_b_aws_ok, vantage_c_aws_ok]
        aws_healthy_votes = sum(1 for vote in votes if vote)

        logger.info(f"[QUORUM EVALUATION] Observer Votes (AWS Reachable): A={vantage_a_aws_ok}, B={vantage_b_aws_ok}, C={vantage_c_aws_ok} | Total: {aws_healthy_votes}/3")

        # Scenario 1: Strict Majority (>= 2 votes) confirm AWS is HEALTHY
        if aws_healthy_votes >= 2:
            self.failover_authorized = False
            
            # Check for cross-cloud VPN partition (Vantage B down, but A & C up)
            if not vantage_b_aws_ok:
                return (False, self.fencing_epoch, "PARTITION_DETECTED")
            
            return (False, self.fencing_epoch, "PRIMARY_HEALTHY")

        # Scenario 2: AWS Lease expired AND >= 2 observers confirm AWS is DOWN
        if not self.is_lease_valid() and aws_healthy_votes < 2:
            if not self.failover_authorized:
                self.fencing_epoch += 1
                self.active_leader = "AZURE"
                self.failover_authorized = True
                logger.critical(f"[FENCING TOKEN ISSUED] Failover Authorized for Azure! New Fencing Epoch: {self.fencing_epoch}")

            return (True, self.fencing_epoch, "PRIMARY_DOWN_QUORUM_CONFIRMED")

        return (False, self.fencing_epoch, "WAITING_FOR_LEASE_EXPIRATION")
