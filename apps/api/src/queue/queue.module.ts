import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

/**
 * BullMQ kök yapılandırması. Özellik kuyrukları (shopify-sync, ads-sync,
 * metrics-rollup, webhooks, recurring-expenses, token-refresh) ilgili
 * fazlarda `BullModule.registerQueue(...)` ile eklenir.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>("REDIS_HOST"),
          port: config.getOrThrow<number>("REDIS_PORT"),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
