FROM python:3.11-slim

WORKDIR /app

# Build deps for psycopg2 + lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default command is overridden by docker-compose (worker vs beat).
CMD ["celery", "-A", "celery_app", "worker", "--loglevel=info"]
