import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

/**
 * Faz 9 — OpenTelemetry trace. `OTEL_EXPORTER_OTLP_ENDPOINT` tanımlıysa NodeSDK'yı
 * auto-instrumentations ile başlatır (HTTP/Express/pg/ioredis vb. otomatik trace).
 * Tanımlı değilse no-op. **NestFactory'den ÖNCE** çağrılmalı (en üstte).
 */
let sdk: NodeSDK | null = null;

export function startTracing(): boolean {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return false;
  sdk = new NodeSDK({
    // URL'i env'den okur (OTEL_EXPORTER_OTLP_TRACES_ENDPOINT / ..._ENDPOINT).
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  return true;
}

export async function stopTracing(): Promise<void> {
  if (sdk) await sdk.shutdown().catch(() => undefined);
}
