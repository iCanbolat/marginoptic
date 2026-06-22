import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Queue, type Job } from "bullmq";
import {
  MaterializeExpenseJob,
  QUEUE_RECURRING_EXPENSES,
  RECURRING_EXPENSES_SCHEDULER,
} from "../costs.constants";
import { ExpensesService } from "../expenses.service";

function isoOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Yinelenen giderleri gün+mağaza seviyesine materialize eder.
 * - Tek-gider job'ı (create/update sonrası): verilen aralığı yeniden hesaplar.
 * - Günlük scheduler (data boş): tüm aktif giderleri dünden bugüne materialize eder
 *   (yeni gün + amortizasyon güncellemeleri için).
 */
@Processor(QUEUE_RECURRING_EXPENSES)
export class RecurringExpensesProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(RecurringExpensesProcessor.name);

  constructor(
    @InjectQueue(QUEUE_RECURRING_EXPENSES)
    private readonly queue: Queue<MaterializeExpenseJob>,
    private readonly expenses: ExpensesService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // Her gün 02:00'de tüm aktif giderleri materialize et (idempotent).
    await this.queue.upsertJobScheduler(
      RECURRING_EXPENSES_SCHEDULER,
      { pattern: "0 2 * * *" },
      { name: "materialize-daily", data: {} },
    );
  }

  async process(job: Job<MaterializeExpenseJob>): Promise<void> {
    const { customExpenseId, from, to } = job.data ?? {};

    if (customExpenseId && from && to) {
      const written = await this.expenses.materialize(customExpenseId, from, to);
      this.logger.log(
        `Materialize gider=${customExpenseId} ${from}→${to}: ${written} satır`,
      );
      return;
    }

    // Günlük scheduler: dün + bugün (geç çalışmaya karşı pencere).
    const yesterday = isoOffset(-1);
    const today = isoOffset(0);
    const written = await this.expenses.materializeAllActive(yesterday, today);
    this.logger.log(
      `Günlük materialize ${yesterday}→${today}: ${written} satır`,
    );
  }
}
