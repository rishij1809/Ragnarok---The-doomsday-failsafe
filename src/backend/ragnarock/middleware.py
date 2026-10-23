import os
import socket


class DRHeaderMiddleware:
    """
    Custom Django Middleware for Project Ragnarock.
    Injects `X-Served-By-Cloud: AWS|AZURE` and `X-Instance-ID` into every HTTP response header
    for Anycast edge tracing, CDN routing audit, and cutover verification.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.current_cloud = os.getenv("CURRENT_CLOUD", "AWS")
        self.hostname = socket.gethostname()

    def __call__(self, request):
        response = self.get_response(request)

        # Inject Edge Tracing Headers
        response["X-Served-By-Cloud"] = self.current_cloud
        response["X-Instance-ID"] = self.hostname
        response["X-DR-Failover-Active"] = os.getenv("DR_FAILOVER_ACTIVE", "false")

        return response
