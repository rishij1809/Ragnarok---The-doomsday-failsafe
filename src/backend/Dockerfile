# Multi-Stage Production Dockerfile for Django REST Framework (Project Ragnarock)
# Stage 1: Build Dependencies and Static Asset Collection
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into wheel cache
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Final Lightweight Security Hardened Runtime Image
FROM python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:$PATH" \
    PYTHONPATH="/install/lib/python3.11/site-packages:$PYTHONPATH"

# Install minimal runtime libraries and network diagnostic tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    postgresql-client \
    curl \
    iputils-ping \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user and group for zero-trust container security
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

WORKDIR /app

# Copy python packages from builder
COPY --from=builder /install /install

# Copy application source code
COPY --chown=appuser:appgroup . .

# Ensure entrypoint script is executable
RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /app/staticfiles && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser:appgroup

# Expose Django application port
EXPOSE 8000

# Set production entrypoint and default Gunicorn + Uvicorn worker startup command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "-k", "uvicorn.workers.UvicornWorker", "--timeout", "30", "--access-logfile", "-", "ragnarock.wsgi:application"]
