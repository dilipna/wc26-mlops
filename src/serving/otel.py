"""OpenTelemetry instrumentation for the FastAPI serving layer
(PROJECT_BRAIN #12 item 2). No collector (Jaeger/Tempo/etc.) is running
in this project yet, so spans print to the console by default -- set
OTEL_EXPORTER_OTLP_ENDPOINT to ship them to a real collector instead.
Import failures (package not installed) degrade to a no-op, same
best-effort philosophy as the rest of this project's optional infra.
"""

import os


def instrument(app) -> bool:
    try:
        from opentelemetry import trace
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import (
            BatchSpanProcessor,
            ConsoleSpanExporter,
        )
    except ImportError:
        print("[otel] opentelemetry packages not installed, skipping instrumentation")
        return False

    provider = TracerProvider(resource=Resource.create({"service.name": "wc26-serving"}))

    otlp_endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if otlp_endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=otlp_endpoint)))
    else:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    return True
