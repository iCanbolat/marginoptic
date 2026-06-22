import { initSentry } from "./sentry";
import { startTracing } from "./tracing";

/**
 * Faz 9 — Observability bootstrap. **main.ts'te ilk import** olmalı: OTel
 * auto-instrumentation, izlenecek modüller (http/express/pg/ioredis) require
 * edilmeden önce başlamalı. İkisi de env-gated (yapılandırılmamışsa no-op).
 */
startTracing();
initSentry();
