import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { QueueModule } from "./queue/queue.module";
import { HealthModule } from "./health/health.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { ChannelsModule } from "./modules/channels/channels.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { CostsModule } from "./modules/costs/costs.module";
import { ProfitModule } from "./modules/profit/profit.module";
import { AdsModule } from "./modules/ads/ads.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ApiKeysModule } from "./modules/api-keys/api-keys.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { BillingModule } from "./modules/billing/billing.module";
import { TrackingModule } from "./modules/tracking/tracking.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: [".env"],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get("NODE_ENV") === "production";
        return {
          pinoHttp: {
            level: isProd ? "info" : "debug",
            transport: isProd
              ? undefined
              : { target: "pino-pretty", options: { singleLine: true } },
            redact: ["req.headers.authorization", "req.headers.cookie"],
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new ThrottlerStorageRedisService({
          host: config.getOrThrow<string>("REDIS_HOST"),
          port: config.getOrThrow<number>("REDIS_PORT"),
        }),
      }),
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    ChannelsModule,
    IntegrationsModule,
    IngestionModule,
    CostsModule,
    ProfitModule,
    AdsModule,
    AnalyticsModule,
    ApiKeysModule,
    McpModule,
    BillingModule,
    TrackingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
