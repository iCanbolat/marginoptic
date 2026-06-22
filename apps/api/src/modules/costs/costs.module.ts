import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CogsService } from "./cogs.service";
import { CostResolverService } from "./cost-resolver.service";
import { CostRulesService } from "./cost-rules.service";
import { CostsController } from "./costs.controller";
import { QUEUE_RECURRING_EXPENSES } from "./costs.constants";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { RecurringExpensesProcessor } from "./processors/recurring-expenses.processor";

/**
 * Faz 4 — Maliyet modelleme.
 * COGS/kargo/ücret/vergi kuralları + özel giderler ve gün+mağaza materializasyonu.
 * `CostResolverService` Faz 5 kâr motoruna export edilir.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_RECURRING_EXPENSES }),
  ],
  controllers: [CostsController, ExpensesController],
  providers: [
    CogsService,
    CostRulesService,
    CostResolverService,
    ExpensesService,
    RecurringExpensesProcessor,
  ],
  exports: [CostResolverService, ExpensesService],
})
export class CostsModule {}
