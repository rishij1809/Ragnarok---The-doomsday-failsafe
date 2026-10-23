import os
import logging
from django.conf import settings
from django.core.files.storage import Storage

try:
    from storages.backends.s3boto3 import S3Boto3Storage
except ImportError:
    S3Boto3Storage = None

try:
    from storages.backends.azure_storage import AzureStorage
except ImportError:
    AzureStorage = None

logger = logging.getLogger("ragnarock.resilient_storage")


class ResilientCloudStorage(Storage):
    """
    Custom Dual-Cloud Resilient Storage Engine for Project Ragnarock.
    Delegates writes to primary cloud storage (AWS S3 or Azure Blob based on CURRENT_CLOUD).
    If a read operation encounters replication lag or missing object, seamlessly falls back to reading from alternate cloud.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.current_cloud = os.getenv("CURRENT_CLOUD", getattr(settings, "CLOUD_PROVIDER", "AWS")).upper()

        self.s3_backend = None
        self.azure_backend = None

        if S3Boto3Storage:
            try:
                self.s3_backend = S3Boto3Storage()
            except Exception as exc:
                logger.warning(f"Could not initialize S3Boto3Storage: {exc}")

        if AzureStorage:
            try:
                self.azure_backend = AzureStorage()
            except Exception as exc:
                logger.warning(f"Could not initialize AzureStorage: {exc}")

    def _get_primary_backend(self) -> Storage:
        if self.current_cloud == "AZURE" and self.azure_backend:
            return self.azure_backend
        if self.s3_backend:
            return self.s3_backend
        # Fallback to Azure if S3 is unconfigured
        return self.azure_backend if self.azure_backend else super()

    def _get_secondary_backend(self) -> Storage:
        if self.current_cloud == "AZURE":
            return self.s3_backend
        return self.azure_backend

    def _open(self, name, mode="rb"):
        primary = self._get_primary_backend()
        secondary = self._get_secondary_backend()

        try:
            return primary._open(name, mode)
        except Exception as exc:
            logger.warning(f"[STORAGE-FALLBACK] Object '{name}' not found on primary ({self.current_cloud}). Attempting fallback to secondary storage backend: {exc}")
            if secondary:
                try:
                    return secondary._open(name, mode)
                except Exception as sec_exc:
                    logger.error(f"[STORAGE-ERROR] Object '{name}' missing on both AWS S3 and Azure Blob: {sec_exc}")
                    raise sec_exc
            raise exc

    def _save(self, name, content):
        primary = self._get_primary_backend()
        return primary._save(name, content)

    def exists(self, name):
        primary = self._get_primary_backend()
        secondary = self._get_secondary_backend()

        if primary and primary.exists(name):
            return True
        if secondary and secondary.exists(name):
            return True
        return False

    def url(self, name):
        primary = self._get_primary_backend()
        return primary.url(name)

    def delete(self, name):
        primary = self._get_primary_backend()
        secondary = self._get_secondary_backend()

        if primary:
            primary.delete(name)
        if secondary:
            secondary.delete(name)
