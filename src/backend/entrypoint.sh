#!/usr/bin/env bash
set -e

echo "=========================================================================="
echo " PROJECT RAGNAROCK — MULTI-CLOUD CONTAINER RUNTIME INITIALIZATION "
echo "=========================================================================="

# 1. Dynamic Cloud Environment Detection
if [ -n "$AWS_EXECUTION_ENV" ] || [ -n "$ECS_CONTAINER_METADATA_URI_V4" ]; then
    export CURRENT_CLOUD="AWS"
elif [ -n "$CONTAINER_APP_NAME" ] || [ -n "$IDENTITY_HEADER" ]; then
    export CURRENT_CLOUD="AZURE"
else
    export CURRENT_CLOUD="${CURRENT_CLOUD:-LOCAL_DEV}"
fi

echo "[INIT] Detected Cloud Runtime: ${CURRENT_CLOUD}"
echo "[INIT] Hostname: $(hostname)"
echo "[INIT] Container User: $(whoami)"

# 2. Database Endpoint Configuration
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-ragnarock_admin}"

echo "[INIT] Verifying Database Reachability at ${DB_HOST}:${DB_PORT}..."

# Wait for PostgreSQL to become responsive before binding
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
        echo "[INIT] SUCCESS: PostgreSQL Database is responsive!"
        break
    fi

    # Fallback raw TCP check if pg_isready is restricted
    if nc -z -w 2 "$DB_HOST" "$DB_PORT" > /dev/null 2>&1; then
        echo "[INIT] SUCCESS: TCP Port ${DB_PORT} on ${DB_HOST} is open!"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "[INIT] Database not ready yet (${RETRY_COUNT}/${MAX_RETRIES}). Retrying in 2 seconds..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[WARNING] Could not connect to primary database within ${MAX_RETRIES} retries. Proceeding with application startup..."
fi

# 3. Collect Static Files (if enabled)
if [ "${RUN_COLLECTSTATIC:-true}" = "true" ]; then
    echo "[INIT] Executing Django collectstatic..."
    python manage.py collectstatic --noinput --clear || echo "[WARNING] collectstatic skipped or failed."
fi

# 4. Database Migrations Execution
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[INIT] Running Django database migrations..."
    python manage.py migrate --noinput || echo "[WARNING] Django migrations failed or skipped."
fi

echo "[INIT] Initialization complete! Handing over to application worker process..."
exec "$@"
