import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

/** Genel amaçlı Redis bağlantısı (cache, dedup, rate-limit buckets). */
export const REDIS = Symbol("REDIS");

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis =>
        new Redis({
          host: config.getOrThrow<string>("REDIS_HOST"),
          port: config.getOrThrow<number>("REDIS_PORT"),
          maxRetriesPerRequest: null,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
