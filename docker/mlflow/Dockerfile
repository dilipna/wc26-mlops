FROM python:3.10-slim

RUN pip install --no-cache-dir mlflow==3.2.0

EXPOSE 5000

CMD ["mlflow", "server", \
     "--host", "0.0.0.0", \
     "--port", "5000", \
     "--backend-store-uri", "sqlite:////mlflow/mlflow.db", \
     "--default-artifact-root", "mlflow-artifacts:/", \
     "--artifacts-destination", "/mlflow/artifacts", \
     "--serve-artifacts"]
