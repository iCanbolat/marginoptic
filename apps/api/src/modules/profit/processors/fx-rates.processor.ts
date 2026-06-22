import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type Job } from "bullmq";
import { FxService } from "../fx.service";
import { FX_RATES_SCHEDULER, QUEUE_FX_RATES } from "../profit.constants";

interface FxApiResponse {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/**
 * Günlük FX güncelleme (repeatable). `FX_API_URL` yapılandırıldıysa o günün kurlarını
 * çeker ve `fx_rates`'e upsert eder; yapılandırılmadıysa no-op (offline güvenli).
 * Aynı para birimi çevrimi kod tarafında 1 olduğundan tek-para kurulumlar FX gerektirmez.
 */
@Processor(QUEUE_FX_RATES)
export class FxRatesProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(FxRatesProcessor.name);

  constructor(
    @InjectQueue(QUEUE_FX_RATES) private readonly queue: Queue,
    private readonly fx: FxService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her gün 01:00'de FX güncelle (rollup'tan önce).
    await this.queue.upsertJobScheduler(
      FX_RATES_SCHEDULER,
      { pattern: "0 1 * * *" },
      { name: "fetch", data: {} },
    );
  }

  async process(_job: Job): Promise<void> {
    const url = this.config.get<string>("FX_API_URL");
    if (!url) {
      this.logger.debug("FX güncelleme atlandı (FX_API_URL yapılandırılmamış)");
      return;
    }

    const base = (this.config.get<string>("FX_BASE_CURRENCY") ?? "USD").toUpperCase();
    const date = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`${url}?base=${base}`);
      if (!res.ok) throw new Error(`FX API ${res.status}`);
      const data = (await res.json()) as FxApiResponse;
      const rates = data.rates ?? {};
      let count = 0;
      for (const [quote, rate] of Object.entries(rates)) {
        if (!Number.isFinite(rate) || rate <= 0) continue;
        await this.fx.upsertRate(date, base, quote, rate, "api");
        count += 1;
      }
      this.logger.log(`FX güncellendi (${base}, ${date}): ${count} kur`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`FX güncelleme başarısız: ${message}`);
      throw err;
    }
  }
}
