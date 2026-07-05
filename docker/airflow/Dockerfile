FROM apache/airflow:2.9.3-python3.10@sha256:1f395499be0fbc834e0a8a634754715a3938b08ca161b11cf9c837e4372aa9d2

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
