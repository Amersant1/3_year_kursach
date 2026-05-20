FROM python:3.12-slim AS base

# uv for fast, reproducible installs (binary copied from official image).
COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependency layer — cached unless lock/manifest change.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# Application code.
COPY app ./app
COPY migrations ./migrations
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
