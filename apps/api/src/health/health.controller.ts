import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { sql } from "drizzle-orm";
import type { Redis } from "ioredis";
import { DRIZZLE, type DrizzleDB } from "../database/database.module";
import { REDIS } from "../redis/redis.module";
import { Public } from "../modules/auth/decorators/public.decorator";

@ApiTags("health")
@Public()
@Controller()
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness — süreç ayakta mı. */
  @Get("health")
  health() {
    return { status: "ok", uptime: process.uptime() };
  }

  /** Readiness — bağımlılıklar (db + redis) hazır mı; değilse 503. */
  @Get("ready")
  async ready() {
    const [db, redis] = await Promise.allSettled([
      this.db.execute(sql`select 1`),
      this.redis.ping(),
    ]);

    const services = {
      database: db.status === "fulfilled" ? "up" : "down",
      redis: redis.status === "fulfilled" ? "up" : "down",
    };

    if (db.status !== "fulfilled" || redis.status !== "fulfilled") {
      throw new ServiceUnavailableException({ status: "error", services });
    }
    return { status: "ok", services };
  }
}
