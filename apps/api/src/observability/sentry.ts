import * as Sentry from "@sentry/node";

/**
 * Faz 9 — Sentry hata izleme. `SENTRY_DSN` tanımlıysa init eder; aksi halde no-op
 * (init edilmeden `captureException` çağrısı sessizce yok sayılır).
 */
let enabled = false;

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  });
  enabled = true;
  return true;
}

/** Yakalanan istisnayı Sentry'ye iletir (init edilmemişse no-op). */
export function captureException(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
