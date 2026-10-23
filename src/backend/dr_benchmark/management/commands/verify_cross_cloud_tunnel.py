import os
import sys
import time
import socket
import json
import subprocess
import platform
import statistics
import logging
from typing import Dict, Any, List, Tuple

from django.core.management.base import BaseCommand

logger = logging.getLogger("ragnarock.dr_telemetry")


class Command(BaseCommand):
    help = "Verifies cross-cloud Site-to-Site IPsec VPN tunnel connectivity, measures latency/RTT, MTU fragmentation, and PostgreSQL socket reachability."

    def add_arguments(self, parser):
        parser.add_argument(
            "--target-host",
            type=str,
            default=os.getenv("CROSS_CLOUD_TARGET_HOST", "10.200.20.5"),
            help="Remote cloud private IP address or database endpoint (e.g. 10.200.20.5 or 10.100.30.10)",
        )
        parser.add_argument(
            "--target-port",
            type=int,
            default=int(os.getenv("CROSS_CLOUD_TARGET_PORT", "5432")),
            help="Remote target TCP port (default: 5432 for PostgreSQL)",
        )
        parser.add_argument(
            "--latency-threshold",
            type=float,
            default=float(os.getenv("VPN_LATENCY_THRESHOLD_MS", "35.0")),
            help="Maximum acceptable round-trip time latency threshold in milliseconds (default: 35.0 ms)",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=5,
            help="Number of telemetry probe samples to collect (default: 5)",
        )
        parser.add_argument(
            "--packet-size",
            type=int,
            default=1350,
            help="Ping payload packet size in bytes for MTU testing (default: 1350 bytes)",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Output telemetry results as raw JSON payload for CloudWatch / Azure Monitor log collectors",
        )

    def handle(self, *args, **options):
        target_host = options["target_host"]
        target_port = options["target_port"]
        threshold_ms = options["latency-threshold"]
        count = options["count"]
        packet_size = options["packet-size"]
        json_output = options["json"]

        if not json_output:
            self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
            self.stdout.write(self.style.MIGRATE_HEADING("  PROJECT RAGNAROCK — CROSS-CLOUD IPSEC VPN TELEMETRY & NETWORK PROBER   "))
            self.stdout.write(self.style.MIGRATE_HEADING("=========================================================================="))
            self.stdout.write(f"Target Endpoint:  {target_host}:{target_port}")
            self.stdout.write(f"Latency Warning:  > {threshold_ms:.1f} ms")
            self.stdout.write(f"Probe Samples:    {count}")
            self.stdout.write(f"MTU Packet Size:  {packet_size} bytes\n")

        # 1. TCP Socket Port Handshake Probe
        socket_success, socket_latencies, socket_error = self._probe_tcp_socket(target_host, target_port, count)

        # 2. ICMP Ping & MTU Packet Fragmentation Probe
        icmp_success, icmp_latencies, packet_loss_pct, mtu_fragmented = self._probe_icmp_ping(target_host, count, packet_size)

        # 3. Calculate Combined Metrics
        all_latencies = socket_latencies if socket_latencies else icmp_latencies
        
        avg_rtt = statistics.mean(all_latencies) if all_latencies else 0.0
        min_rtt = min(all_latencies) if all_latencies else 0.0
        max_rtt = max(all_latencies) if all_latencies else 0.0
        jitter = statistics.stdev(all_latencies) if len(all_latencies) > 1 else 0.0

        # Tunnel Status Assessment
        is_healthy = socket_success and packet_loss_pct == 0.0 and avg_rtt <= threshold_ms and not mtu_fragmented
        is_degraded = (socket_success or icmp_success) and (avg_rtt > threshold_ms or packet_loss_pct > 0.0 or mtu_fragmented)
        is_down = not socket_success and not icmp_success

        if is_healthy:
            status_str = "HEALTHY"
        elif is_degraded:
            status_str = "DEGRADED"
        else:
            status_str = "DOWN"

        telemetry_payload = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source_cloud": os.getenv("CURRENT_CLOUD", "AWS-Primary"),
            "target_host": target_host,
            "target_port": target_port,
            "tunnel_status": status_str,
            "tcp_socket_reachable": socket_success,
            "tcp_socket_error": socket_error,
            "icmp_reachable": icmp_success,
            "packet_loss_percent": packet_loss_pct,
            "mtu_packet_size_bytes": packet_size,
            "mtu_fragmentation_detected": mtu_fragmented,
            "metrics_ms": {
                "avg_rtt": round(avg_rtt, 2),
                "min_rtt": round(min_rtt, 2),
                "max_rtt": round(max_rtt, 2),
                "jitter": round(jitter, 2),
                "threshold_ms": threshold_ms,
            },
            "threshold_exceeded": avg_rtt > threshold_ms,
        }

        if json_output:
            self.stdout.write(json.dumps(telemetry_payload, indent=2))
            return

        # Terminal Formatted Table Output
        self.stdout.write(self.style.HTTP_INFO("--- PROBE SUMMARY & TUNNEL TELEMETRY ---"))
        self.stdout.write(f"Tunnel Status:           {self._format_status(status_str)}")
        self.stdout.write(f"TCP Handshake (Port {target_port}): {'SUCCESS' if socket_success else 'FAILED (' + str(socket_error) + ')'}")
        self.stdout.write(f"ICMP Reachability:       {'SUCCESS' if icmp_success else 'FAILED'}")
        self.stdout.write(f"Packet Loss Rate:        {packet_loss_pct:.1f}%")
        self.stdout.write(f"Average Latency (RTT):   {avg_rtt:.2f} ms")
        self.stdout.write(f"Latency Range (Min/Max): {min_rtt:.2f} ms / {max_rtt:.2f} ms")
        self.stdout.write(f"Network Jitter (StdDev): {jitter:.2f} ms")
        self.stdout.write(f"MTU Payload ({packet_size}B): {'PASS (No Fragmentation)' if not mtu_fragmented else 'FRAGMENTED (Adjust MTU/MSS)'}\n")

        # Warning Diagnostics
        if avg_rtt > threshold_ms:
            self.stdout.write(
                self.style.WARNING(
                    f"[WARNING] Cross-Cloud Latency ({avg_rtt:.2f} ms) EXCEEDS SLO Threshold ({threshold_ms:.1f} ms)! "
                    f"Check IPsec tunnel route optimization and cross-cloud region latency."
                )
            )

        if mtu_fragmented:
            self.stdout.write(
                self.style.WARNING(
                    "[WARNING] Packet fragmentation detected over IPsec tunnel! "
                    "Ensure TCP MSS Clamping is configured to 1350 bytes on cloud firewall gateways."
                )
            )

        if is_down:
            self.stderr.write(
                self.style.ERROR(
                    f"[CRITICAL] IPsec VPN Tunnel DOWN or Security Group / NSG blocking port {target_port}! "
                    f"Verify AWS SG 'ragnarock-aws-rds-sg' and Azure NSG 'nsg-ragnarock-db' rules."
                )
            )
            sys.exit(1)

    def _probe_tcp_socket(self, host: str, port: int, count: int) -> Tuple[bool, List[float], str]:
        latencies = []
        last_error = ""
        success_count = 0

        for _ in range(count):
            start_time = time.perf_counter()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(3.0)
            try:
                sock.connect((host, port))
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                latencies.append(elapsed_ms)
                success_count += 1
                sock.close()
            except socket.timeout:
                last_error = "Connection Timed Out"
            except ConnectionRefusedError:
                last_error = "Connection Refused by Remote Host"
            except Exception as e:
                last_error = str(e)

        return (success_count > 0, latencies, last_error)

    def _probe_icmp_ping(self, host: str, count: int, packet_size: int) -> Tuple[bool, List[float], float, bool]:
        system_os = platform.system().lower()
        latencies = []
        mtu_fragmented = False

        if system_os == "windows":
            cmd = ["ping", "-n", str(count), "-l", str(packet_size), "-f", host]
        else:
            cmd = ["ping", "-c", str(count), "-s", str(packet_size), "-M", "do", host]

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
            output = res.stdout + res.stderr

            if "fragment" in output.lower() or "packet needs to be fragmented" in output.lower():
                mtu_fragmented = True

            # Extract latency lines
            for line in output.splitlines():
                if "time=" in line.lower():
                    try:
                        part = line.lower().split("time=")[1].split("ms")[0].strip()
                        latencies.append(float(part))
                    except (IndexError, ValueError):
                        pass

            loss_pct = 100.0 * (1.0 - (len(latencies) / count))
            return (len(latencies) > 0, latencies, loss_pct, mtu_fragmented)
        except Exception as exc:
            logger.debug(f"ICMP Ping probe exception: {exc}")
            return (False, [], 100.0, False)

    def _format_status(self, status: str) -> str:
        if status == "HEALTHY":
            return self.style.SUCCESS("[ HEALTHY ]")
        elif status == "DEGRADED":
            return self.style.WARNING("[ DEGRADED ]")
        else:
            return self.style.ERROR("[ DOWN ]")
