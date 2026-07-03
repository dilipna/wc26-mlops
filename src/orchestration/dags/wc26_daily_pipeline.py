"""Daily WC26 pipeline DAG.

Wraps the two manual entry points documented in PROJECT_BRAIN.md #10 in a
fixed daily schedule:

1. daily_update.py       -- pull results/odds, rebuild features, score
                             fixtures, append to the predictions log.
2. export_dashboard_data.py -- convert the updated logs into the JSON
                             files the dashboard reads at build time.

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

    export_dashboard_data = BashOperator(
        task_id="export_dashboard_data",
        bash_command=f"cd {PROJECT_DIR} && python scripts/export_dashboard_data.py",
    )

    daily_update >> export_dashboard_data
