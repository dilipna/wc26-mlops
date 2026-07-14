.PHONY: demo backend test k8s-up k8s-down

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

# Local kind cluster running the same stack as `make backend` (Airflow
# scheduler+webserver on LocalExecutor, MLflow, FastAPI serving) -- see
# k8s/README section in the repo README. Requires: kind, kubectl, Docker.
# UIs after it settles: Airflow http://localhost:8081 (admin/admin),
# MLflow http://localhost:5001, serving API http://localhost:8001/docs.
k8s-up:
	sed 's#$${PROJECT_DIR}#'"$$(pwd)"'#' k8s/kind-config.yaml | kind create cluster --config -
	docker build -t wc26/airflow:local -f docker/airflow/Dockerfile .
	docker build -t wc26/mlflow:local -f docker/mlflow/Dockerfile .
	docker build -t wc26/serving:local -f docker/serving/Dockerfile .
	kind load docker-image wc26/airflow:local wc26/mlflow:local wc26/serving:local --name wc26
	kubectl apply -f k8s/namespace.yaml
	-kubectl -n wc26 create secret generic wc26-env --from-env-file=.env 2>/dev/null || true
	kubectl apply -f k8s/postgres.yaml -f k8s/mlflow.yaml -f k8s/serving.yaml -f k8s/airflow.yaml
	kubectl -n wc26 get pods

k8s-down:
	kind delete cluster --name wc26
