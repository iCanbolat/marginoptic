import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type {
  ApiKeyCreatedResponse,
  ApiKeyCreateInput,
  ApiKeySummary,
  McpScope,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { apiKeys } from "../../database/schema/mcp";
import { generateApiKey, hashApiKey } from "./api-key.crypto";

/** MCP auth doğrulaması sonucu (org + kapsamlar). */
export interface VerifiedApiKey {
  id: string;
  storeId: string;
  scopes: McpScope[];
}

/** `last_used_at` yazımını seyreltme eşiği (her istekte yazmamak için). */
const LAST_USED_THROTTLE_MS = 60_000;

type Row = typeof apiKeys.$inferSelect;

const toSummary = (r: Row): ApiKeySummary => ({
  id: r.id,
  name: r.name,
  keyPrefix: r.keyPrefix,
  scopes: r.scopes,
  lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  revokedAt: r.revokedAt?.toISOString() ?? null,
});

/**
 * Faz 8 — MCP API key CRUD + doğrulama.
 * Ham anahtar yalnız oluşturmada döner; DB'de sha256 hash + prefix saklanır.
 */
@Injectable()
export class ApiKeysService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(storeId: string): Promise<ApiKeySummary[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.storeId, storeId))
      .orderBy(desc(apiKeys.createdAt));
    return rows.map(toSummary);
  }

  async create(
    storeId: string,
    userId: string,
    input: ApiKeyCreateInput,
  ): Promise<ApiKeyCreatedResponse> {
    const { raw, keyHash, keyPrefix } = generateApiKey();
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        storeId: storeId,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes,
        createdBy: userId,
      })
      .returning();
    return { ...toSummary(row), key: raw };
  }

  /** İptal (soft-delete). İdempotent: zaten iptalliyse no-op. */
  async revoke(storeId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ revokedAt: apiKeys.revokedAt })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException("API key bulunamadı");
    if (row.revokedAt) return;
    await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.storeId, storeId)));
  }

  /**
   * MCP auth: ham anahtarı doğrular. Geçerli + iptalsiz ise org + kapsamları döner;
   * aksi halde null. `last_used_at` seyrekçe (60s) güncellenir.
   */
  async verify(raw: string | undefined | null): Promise<VerifiedApiKey | null> {
    if (!raw) return null;
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hashApiKey(raw)))
      .limit(1);
    if (!row || row.revokedAt) return null;

    const now = Date.now();
    if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
      await this.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, row.id));
    }

    return { id: row.id, storeId: row.storeId, scopes: row.scopes };
  }
}
