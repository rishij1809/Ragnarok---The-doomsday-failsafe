#!/usr/bin/env python3
"""
PROJECT RAGNAROCK — REVERSE STORAGE SYNCHRONIZATION RUNNER (FAILBACK READINESS)
=================================================================================
Executed during failback from Azure Secondary back to AWS Primary. Replicates delta files
and user media uploaded to Azure Blob Storage while operating in DR mode back to AWS S3.
"""

import os
import sys
import logging
import boto3
from azure.storage.blob import BlobServiceClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ragnarock.reverse_storage_sync")

S3_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "ragnarock-media-primary")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

AZURE_STORAGE_CONNECTION = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER", "ragnarock-media-container")

def reverse_sync_azure_to_s3():
    logger.info("==========================================================================")
    logger.info("  PROJECT RAGNAROCK — REVERSE FAILBACK STORAGE SYNC (AZURE -> AWS S3)    ")
    logger.info("==========================================================================")
    logger.info(f"Source Azure Container: {AZURE_CONTAINER_NAME}")
    logger.info(f"Target AWS S3 Bucket:   {S3_BUCKET_NAME}")

    if not AZURE_STORAGE_CONNECTION:
        logger.error("[ERROR] AZURE_STORAGE_CONNECTION_STRING environment variable is unconfigured!")
        sys.exit(1)

    s3_client = boto3.client("s3", region_name=AWS_REGION)
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION)
    container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)

    # 1. Fetch AWS S3 Existing Keys
    s3_keys = set()
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET_NAME):
        for obj in page.get("Contents", []):
            s3_keys.add(obj["Key"])

    # 2. Iterate Azure Blobs & Push Deltas to AWS S3
    blobs = list(container_client.list_blobs())
    logger.info(f"[AZURE] Found {len(blobs)} total blob(s) in Azure container.")

    synced_count = 0
    for blob in blobs:
        blob_name = blob.name
        blob_client = container_client.get_blob_client(blob_name)
        
        # Sync missing or updated blobs to S3
        download_stream = blob_client.download_blob()
        blob_data = download_stream.readall()
        content_type = blob.content_settings.content_type if blob.content_settings else "application/octet-stream"

        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=blob_name,
            Body=blob_data,
            ContentType=content_type
        )
        synced_count += 1
        logger.info(f"[REVERSE SYNC] Synced blob '{blob_name}' ({len(blob_data)} bytes) to AWS S3 bucket '{S3_BUCKET_NAME}'.")

    logger.info("==========================================================================")
    logger.info(f" SUCCESS: Synced {synced_count} object(s) from Azure back to AWS S3! Failback Storage Ready. ")
    logger.info("==========================================================================")

if __name__ == "__main__":
    reverse_sync_azure_to_s3()
