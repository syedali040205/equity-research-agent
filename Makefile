.PHONY: up down build logs ps psql worker-logs beat-logs flower clean reset migrate seed test

# --- Lifecycle ---
up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

reset:
	docker compose down -v
	@echo "Volumes wiped. Run 'make up' to rebuild from scratch."

ps:
	docker compose ps

# --- Logs ---
logs:
	docker compose logs -f --tail=100

worker-logs:
	docker compose logs -f --tail=100 worker

beat-logs:
	docker compose logs -f --tail=100 beat

# --- DB ---
psql:
	docker compose exec postgres psql -U finagent -d finagent

migrate:
	docker compose exec worker python -m db migrate

# --- Manual ETL triggers ---
seed-companies:
	docker compose exec worker python -c "from tasks.companies import bootstrap_companies; print(bootstrap_companies.run())"

seed-news:
	docker compose exec worker python -c "from tasks.news import run_all; print(run_all.run())"

seed-filings:
	docker compose exec worker python -c "from tasks.filings import run_all; print(run_all.run())"

seed-all:
	docker compose exec worker python -c "from tasks.pipeline import run_full_pipeline; print(run_full_pipeline.run())"

# --- Observability ---
flower:
	@echo "Open http://localhost:5555"

etl-status:
	docker compose exec postgres psql -U finagent -d finagent -c "\
		SELECT pipeline, status, COUNT(*), MAX(run_at) as last_run \
		FROM etl_runs WHERE run_at > NOW() - INTERVAL '24 hours' \
		GROUP BY pipeline, status ORDER BY pipeline, status;"

# --- Tests ---
test:
	docker compose exec worker python -m pytest tests/ -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
