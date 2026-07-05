FROM python:3.10-slim@sha256:5f9928ea39771e8ddf4fb9a96ab24f65f087793635614405a1dc9384f040852e

RUN pip install --no-cache-dir mlflow==3.2.0

EXPOSE 5000

CMD ["mlflow", "server", \
     "--host", "0.0.0.0", \
     "--port", "5000", \
     "--backend-store-uri", "sqlite:////mlflow/mlflow.db", \
     "--default-artifact-root", "mlflow-artifacts:/", \
     "--artifacts-destination", "/mlflow/artifacts", \
     "--serve-artifacts"]
