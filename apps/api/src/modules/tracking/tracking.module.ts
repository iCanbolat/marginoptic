import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ProductTrafficService } from "./product-traffic.service";
import { TrackingController } from "./tracking.controller";
import { QUEUE_TRAFFIC_SYNC } from "./tracking.constants";
import { TrafficSyncProcessor } from "./processors/traffic-sync.processor";

/**
 * Dönüşüm izleme. Shopify Web Pixel olay alıcısı (public `/track/pixel`) + Amazon/eBay
 * ürün-traffic senkronu → `product_traffic_daily`. Conversion rate ürün analizi
 * okuma katmanında purchases/sessions olarak türetilir
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_TRAFFIC_SYNC })],
  controllers: [TrackingController],
  providers: [ProductTrafficService, TrafficSyncProcessor],
  exports: [ProductTrafficService],
})
export class TrackingModule {}
