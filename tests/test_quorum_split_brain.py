#!/usr/bin/env python3
"""
PROJECT RAGNAROCK — QUORUM CONSENSUS & SPLIT-BRAIN CHAOS SIMULATION SUITE
==========================================================================
Tests 3-point synthetic probing mesh, sliding window filtering, and fencing token arbiter
under transient network jitter, cross-cloud VPN partitions, and catastrophic regional failure.
"""

import sys
import os
import unittest

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.quorum_prober.fencing_arbiter import FencingArbiter


class TestQuorumSplitBrainScenarios(unittest.TestCase):

    def setUp(self):
        self.arbiter = FencingArbiter(lease_ttl_seconds=10)

    def test_scenario_a_transient_network_jitter(self):
        """
        Scenario A (Transient Jitter):
        Drop 1 probe for 2 seconds (Vantage Point A down, but B & C up).
        Expected: Quorum (2/3 majority) recognizes AWS is still healthy. No failover authorized.
        """
        vantage_a_aws_ok = False # Transient drop
        vantage_b_aws_ok = True
        vantage_c_aws_ok = True

        failover_auth, epoch, event_type = self.arbiter.evaluate_quorum_and_issue_fencing_token(
            vantage_a_aws_ok, vantage_b_aws_ok, vantage_c_aws_ok
        )

        self.assertFalse(failover_auth, "Failover should NOT be authorized during transient jitter!")
        self.assertEqual(event_type, "PRIMARY_HEALTHY")
        self.assertEqual(epoch, 1)
        print("[TEST PASSED] Scenario A (Transient Jitter): Split-brain BLOCKED. AWS Primary maintained.")

    def test_scenario_b_cross_cloud_vpn_partition(self):
        """
        Scenario B (Cross-Cloud VPN Partition):
        IPsec VPN between AWS and Azure fails (Vantage Point B sees AWS down),
        but external observer (Vantage Point A) and AWS internal (Vantage Point C) see AWS up.
        Expected: Quorum (2/3 majority) detects PARTITION, blocks split-brain promotion, and triggers VPN alert.
        """
        vantage_a_aws_ok = True  # Neutral Observer sees AWS UP
        vantage_b_aws_ok = False # Azure sees AWS DOWN over broken VPN
        vantage_c_aws_ok = True  # AWS Internal sees AWS UP

        failover_auth, epoch, event_type = self.arbiter.evaluate_quorum_and_issue_fencing_token(
            vantage_a_aws_ok, vantage_b_aws_ok, vantage_c_aws_ok
        )

        self.assertFalse(failover_auth, "Failover must NOT trigger during VPN partition when AWS is externally healthy!")
        self.assertEqual(event_type, "PARTITION_DETECTED")
        self.assertEqual(epoch, 1)
        print("[TEST PASSED] Scenario B (Cross-Cloud VPN Partition): VPN Partition detected & split-brain promotion BLOCKED!")

    def test_scenario_c_catastrophic_aws_regional_failure(self):
        """
        Scenario C (Catastrophic AWS Failure):
        AWS Primary region fails completely (Vantage Points A, B, and C all vote AWS DOWN)
        and Primary lease expires.
        Expected: 3/3 Observers vote down, Arbiter issues Fencing Token (Epoch 2), and authorizes Azure failover.
        """
        # Force lease expiration
        self.arbiter.last_heartbeat_timestamp = 0.0

        vantage_a_aws_ok = False # Neutral Observer votes DOWN
        vantage_b_aws_ok = False # Azure votes DOWN
        vantage_c_aws_ok = False # AWS Internal votes DOWN

        failover_auth, epoch, event_type = self.arbiter.evaluate_quorum_and_issue_fencing_token(
            vantage_a_aws_ok, vantage_b_aws_ok, vantage_c_aws_ok
        )

        self.assertTrue(failover_auth, "Failover MUST be authorized when 3/3 observers confirm AWS failure!")
        self.assertEqual(event_type, "PRIMARY_DOWN_QUORUM_CONFIRMED")
        self.assertEqual(epoch, 2)
        self.assertEqual(self.arbiter.active_leader, "AZURE")
        print("[TEST PASSED] Scenario C (Catastrophic AWS Failure): Quorum confirmed failure & Fencing Token Epoch 2 issued!")


if __name__ == "__main__":
    unittest.main()
