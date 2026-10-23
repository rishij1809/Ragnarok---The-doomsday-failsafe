import os
import urllib.parse
import logging
import boto3
from azure.storage.blob import BlobServiceClient, ContentSettings

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_CONTAINER_NAME = os.getenv("AZURE_CONTAINER_NAME", "ragnarock-media-container")


def lambda_handler(event, context):
    """
    AWS Lambda event-driven handler for real-time S3 to Azure Blob Storage synchronization.
    Triggered on s3:ObjectCreated:* and s3:ObjectRemoved:* events.
    """
    logger.info(f"[S3-AZURE-SYNC] Processing {len(event.get('Records', []))} S3 event record(s).")

    if not AZURE_STORAGE_CONNECTION_STRING:
        logger.error("[S3-AZURE-SYNC] Missing AZURE_STORAGE_CONNECTION_STRING environment variable!")
        return {"statusCode": 500, "body": "Azure storage connection string unconfigured."}

    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)

    for record in event.get("Records", []):
        event_name = record["eventName"]
        bucket_name = record["s3"]["bucket"]["name"]
        object_key = urllib.parse.unquote_plus(record["s3"]["object"]["key"], encoding="utf-8")

        logger.info(f"[EVENT] Event: {event_name} | Bucket: {bucket_name} | Key: {object_key}")

        blob_client = container_client.get_blob_client(object_key)

        if "ObjectCreated" in event_name:
            # Stream Object from S3 directly to Azure Blob
            try:
                s3_response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
                content_type = s3_response.get("ContentType", "application/octet-stream")
                metadata = s3_response.get("Metadata", {})
                body_stream = s3_response["Body"].read()

                content_settings = ContentSettings(content_type=content_type)

                blob_client.upload_blob(
                    body_stream,
                    overwrite=True,
                    content_settings=content_settings,
                    metadata=metadata
                )
                logger.info(f"[SUCCESS] Replicated S3 object '{object_key}' ({len(body_stream)} bytes) to Azure Blob container '{AZURE_CONTAINER_NAME}'.")
            except Exception as exc:
                logger.error(f"[ERROR] Failed to replicate S3 object '{object_key}' to Azure Blob: {exc}")
                raise exc

        elif "ObjectRemoved" in event_name:
            # Delete Object from Azure Blob Storage
            try:
                if blob_client.exists():
                    blob_client.delete_blob()
                    logger.info(f"[SUCCESS] Deleted blob '{object_key}' from Azure Blob container '{AZURE_CONTAINER_NAME}'.")
                else:
                    logger.info(f"[INFO] Blob '{object_key}' already removed or non-existent in Azure Blob container.")
            except Exception as exc:
                logger.error(f"[ERROR] Failed to delete blob '{object_key}' from Azure Blob: {exc}")
                raise exc

    return {"statusCode": 200, "body": "Storage synchronization complete."}
