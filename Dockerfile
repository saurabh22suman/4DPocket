ARG FDP_RELEASE_BASE=python:3.12-slim

# ─── Stage 1: Frontend Build ────────────────────────────────────
FROM node:22-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN npm install --global pnpm@11.22.0 && pnpm install --frozen-lockfile --ignore-scripts
COPY frontend/ ./
RUN pnpm build

# Reuse the running image for a release with unchanged runtime dependencies.
FROM ${FDP_RELEASE_BASE} AS release-refresh
COPY src/ /app/src/
ADD 4dpocket-release-assets.tar.gz /app/frontend/dist/

# ─── Stage 2: Python Dependencies ───────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* hatch_build.py ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project --extra all

COPY src/ ./src/

# ─── Stage 3: Production Runtime ────────────────────────────────
FROM python:3.12-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/onllm-dev/4DPocket"
LABEL org.opencontainers.image.description="Self-hosted AI-powered personal knowledge base"
LABEL org.opencontainers.image.licenses="GPL-3.0"

WORKDIR /app

# System dependencies
# ffmpeg: audio extraction/downsizing for ASR + frame sampling for video OCR.
# tesseract-ocr: OCR for scanned PDFs and on-screen text in video frames.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Runtime writes are confined to the persistent data directory.
RUN groupadd -r fourdpocket && useradd -r -g fourdpocket -d /data fourdpocket \
    && install -d -m 0700 -o fourdpocket -g fourdpocket /data

# Copy built assets
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/pyproject.toml /app/pyproject.toml
COPY --from=frontend /app/frontend/dist /app/frontend/dist
# alembic.ini is required at runtime — the entrypoint runs `alembic upgrade head`
# before uvicorn, and alembic looks for alembic.ini in the working directory.
COPY alembic.ini /app/alembic.ini

# Copy entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/data \
    FDP_STORAGE__BASE_PATH=/data \
    FDP_SERVER__HOST=0.0.0.0 \
    FDP_SERVER__PORT=4040

USER fourdpocket

VOLUME /data
EXPOSE 4040

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4040/api/v1/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["server"]
