.PHONY: demo backend test

# Dashboard only, from already-committed JSON -- zero cloud creds, zero
# Docker. This is the interview-safe path: it works on a fresh clone with
# nothing but Node installed. See PROJECT_BRAIN.md section 4/5.
demo:
	cd dashboard && npm install && npm run dev

# Full pipeline stack (Postgres + Airflow + MLflow + serving), for
# demoing the pipeline actually running live rather than just its output.
backend:
	docker compose -f docker-compose.airflow.yml up -d

test:
	python -m pytest tests/ -q
