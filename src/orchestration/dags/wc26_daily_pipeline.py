"""Daily WC26 pipeline DAG.

Wraps the entry points documented in PROJECT_BRAIN.md #10 in a fixed
daily schedule:

1. daily_update.py       -- pull results/odds, rebuild features, score
                             fixtures, append to the predictions log.
2. verify_predictions.py -- grade every fixture that finished today
                             against its last pre-kickoff prediction
                             (the "model vs reality" proof tracker).
3. export_dashboard_data.py -- convert the updated logs into the JSON
                             files the dashboard reads at build time.

check_drift.py (Evidently feature-drift check, appended to
data/monitoring/drift_history.csv) and check_data_quality.py (missing
values/schema/duplicate checks, appended to
data/monitoring/data_quality_history.csv) both run as independent parallel
branches off daily_update, not chained into the predictions path above --
same "never blocks the pipeline" philosophy as every other optional-infra
integration in this project (see PROJECT_BRAIN.md #9). Their output may
therefore lag the same day's export by one run if they finish after
export_dashboard_data; each record is self-timestamped so the admin
dashboard is honest about which day's check it's showing.

Runs at 06:00 UTC so the prior day's completed matches are reflected
before backup. Project root is mounted read-write at /opt/airflow/project
by docker-compose.airflow.yml so both scripts' relative paths (data/,
dashboard/data/) resolve exactly as they do when run locally.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

PROJECT_DIR = "/opt/airflow/project"

default_args = {
    "owner": "wc26-mlops",
    "retries": 1,
    "retry_delay": timedelta(minutes=10),
}

with DAG(
    dag_id="wc26_daily_pipeline",
    description="Daily results/odds ingestion -> Layer 1 scoring -> predictions log -> dashboard export",
    default_args=default_args,
    schedule="0 6 * * *",
    start_date=datetime(2026, 7, 1),
    catchup=False,
    max_active_runs=1,
    tags=["wc26"],
) as dag:
    daily_update = BashOperator(
        task_id="daily_update",
        bash_command=f"cd {PROJECT_DIR} && python scripts/daily_update.py",
    )

    verify_predictions = BashOperator(
        task_id="verify_predictions",
        bash_command=f"cd {PROJECT_DIR} && python scripts/verify_predictions.py",
    )

    export_dashboard_data = BashOperator(
        task_id="export_dashboard_data",
        bash_command=f"cd {PROJECT_DIR} && python scripts/export_dashboard_data.py",
    )

    check_drift = BashOperator(
        task_id="check_drift",
        bash_command=f"cd {PROJECT_DIR} && python scripts/check_drift.py",
    )

    check_data_quality = BashOperator(
        task_id="check_data_quality",
        bash_command=f"cd {PROJECT_DIR} && python scripts/check_data_quality.py",
    )

    # Runs after export_dashboard_data because the ledger reads the freshly
    # exported upcoming_matches.json (pending fixtures) alongside the graded
    # proof_tracker.json -- see scripts/build_proof_ledger.py.
    build_proof_ledger = BashOperator(
        task_id="build_proof_ledger",
        bash_command=f"cd {PROJECT_DIR} && python scripts/build_proof_ledger.py",
    )

    daily_update >> verify_predictions >> export_dashboard_data >> build_proof_ledger
    daily_update >> check_drift
    daily_update >> check_data_quality
