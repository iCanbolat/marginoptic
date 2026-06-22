import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { CreemService } from "./creem.service";

/**
 * Faz 9 — Faturalandırma (creem.io). Plan/abonelik durumu + checkout/portal + webhook.
 * `BillingService.assertCanAddStore` plan gating için `IntegrationsModule`'ce kullanılır.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService, CreemService],
  exports: [BillingService],
})
export class BillingModule {}
