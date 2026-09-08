"""
Air Quality Pipeline DAG.

Orchestrates the existing Node/TypeScript ingestion and processing scripts.
This DAG intentionally does NOT reimplement pipeline logic in Python — it
just calls the same `npm run ingest` / `npm run process` commands you already
run manually, with proper dependency ordering, retries, and scheduling on top.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

# Path to the project INSIDE the Airflow container (see docker-compose.airflow.yml,
# which mounts the project directory to this path).
PROJECT_DIR = "/opt/airflow/project"

default_args = {
    "owner": "you",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="air_quality_pipeline",
    description="Ingest OpenAQ readings, then process/clean/detect anomalies",
    default_args=default_args,
    schedule_interval="*/30 * * * *",  # every 30 minutes, same cadence as before
    start_date=datetime(2026, 1, 1),
    catchup=False,  # don't backfill every missed interval since 2026-01-01
    tags=["air-quality", "etl"],
) as dag:

    ingest = BashOperator(
        task_id="ingest_openaq_readings",
        bash_command=f"cd {PROJECT_DIR} && npm run ingest",
    )

    process = BashOperator(
        task_id="process_and_detect_anomalies",
        bash_command=f"cd {PROJECT_DIR} && npm run process",
    )

    load_warehouse = BashOperator(
        task_id="load_to_bigquery",
        bash_command=f"cd {PROJECT_DIR} && npm run load:warehouse",
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=f"cd {PROJECT_DIR}/dbt && dbt run",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"cd {PROJECT_DIR}/dbt && dbt test",
    )

    # Full ELT chain: ingest -> process -> load into warehouse ->
    # transform with dbt -> test the transformed data. Each step only runs
    # if the one before it succeeded.
    ingest >> process >> load_warehouse >> dbt_run >> dbt_test
