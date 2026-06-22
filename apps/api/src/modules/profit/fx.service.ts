import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, lte } from "drizzle-orm";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { fxRates } from "../../database/schema/metrics";

/**
 * Döviz çevrimi (Faz 5). Sipariş para birimi mağaza para biriminden farklıysa
 * `fx_rates`'ten o güne en yakın (≤ tarih) kuru bulur; aynı paraysa 1.
 * Kur bulunamazsa 1 döner (uyarı loglar) — eksik FX verisi katkıyı sıfırlamaz.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  /** Aynı rollup içinde tekrar tekrar sorgu atmamak için süreç-içi önbellek. */
  private readonly cache = new Map<string, number>();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** `from→to` kuru; verilen güne en yakın (≤) kayıt. Aynı para → 1. */
  async rate(from: string, to: string, date: string): Promise<number> {
    const base = from.toUpperCase();
    const quote = to.toUpperCase();
    if (base === quote) return 1;

    const key = `${base}:${quote}:${date}`;
    const hit = this.cache.get(key);
    if (hit != null) return hit;

    const [row] = await this.db
      .select({ rate: fxRates.rate })
      .from(fxRates)
      .where(
        and(
          eq(fxRates.base, base),
          eq(fxRates.quote, quote),
          lte(fxRates.date, date),
        ),
      )
      .orderBy(desc(fxRates.date))
      .limit(1);

    const value = row ? Number(row.rate) : null;
    if (value == null || !Number.isFinite(value) || value <= 0) {
      this.logger.warn(`FX kuru yok: ${base}→${quote} (${date}); 1 varsayıldı`);
      this.cache.set(key, 1);
      return 1;
    }
    this.cache.set(key, value);
    return value;
  }

  /** Tutarı `from` para biriminden `to`'ya çevirir. */
  async convert(
    amount: number,
    from: string | null | undefined,
    to: string,
    date: string,
  ): Promise<number> {
    if (!amount) return 0;
    if (!from) return amount; // para birimi bilinmiyorsa olduğu gibi al
    const r = await this.rate(from, to, date);
    return amount * r;
  }

  /** Bir kuru kaydeder/günceller (FX job + manuel). */
  async upsertRate(
    date: string,
    base: string,
    quote: string,
    rate: number,
    source = "manual",
  ): Promise<void> {
    await this.db
      .insert(fxRates)
      .values({
        date,
        base: base.toUpperCase(),
        quote: quote.toUpperCase(),
        rate: String(rate),
        source,
      })
      .onConflictDoUpdate({
        target: [fxRates.date, fxRates.base, fxRates.quote],
        set: { rate: String(rate), source },
      });
    this.cache.clear();
  }
}
