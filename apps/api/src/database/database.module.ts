import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** DI token'ı — repository/servisler `@Inject(DRIZZLE)` ile veritabanına erişir. */
export const DRIZZLE = Symbol("DRIZZLE");
export type DrizzleDB = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDB => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>("DATABASE_URL"),
          max: 10,
        });
        return drizzle(pool, { schema, casing: "snake_case" });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
