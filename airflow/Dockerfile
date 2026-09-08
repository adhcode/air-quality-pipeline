# Extends the official Airflow image with Node.js, so BashOperator tasks
# can actually run `npm run ingest` / `npm run process` inside the container.
FROM apache/airflow:2.9.3

USER root
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean

USER airflow
RUN pip install --no-cache-dir dbt-bigquery==1.8.2
