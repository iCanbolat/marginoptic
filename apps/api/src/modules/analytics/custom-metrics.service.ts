import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import {
  CUSTOM_METRIC_FIELDS,
  type AnalyticsFilter,
  type CustomMetricCreateInput,
  type CustomMetricSummary,
  type CustomMetricUpdateInput,
  type CustomMetricValuesResponse,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { customMetrics } from "../../database/schema/dashboards";
import { AnalyticsService } from "./analytics.service";
import { evaluateFormula, validateFormula } from "./custom-metric";

type Row = typeof customMetrics.$inferSelect;

const toSummary = (r: Row): CustomMetricSummary => ({
  id: r.id,
  name: r.name,
  formula: r.formula,
  format: r.format,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Faz 7 — Özel metrik CRUD + güvenli formül değerlendirme. */
@Injectable()
export class CustomMetricsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly analytics: AnalyticsService,
  ) {}

  async list(orgId: string): Promise<CustomMetricSummary[]> {
    const rows = await this.db
      .select()
      .from(customMetrics)
      .where(eq(customMetrics.organizationId, orgId))
      .orderBy(asc(customMetrics.name));
    return rows.map(toSummary);
  }

  async create(
    orgId: string,
    input: CustomMetricCreateInput,
  ): Promise<CustomMetricSummary> {
    this.assertFormula(input.formula);
    try {
      const [row] = await this.db
        .insert(customMetrics)
        .values({
          organizationId: orgId,
          name: input.name,
          formula: input.formula,
          format: input.format,
        })
        .returning();
      return toSummary(row);
    } catch (err) {
      throw this.conflictOr(err);
    }
  }

  async update(
    orgId: string,
    id: string,
    input: CustomMetricUpdateInput,
  ): Promise<CustomMetricSummary> {
    await this.assertExists(orgId, id);
    if (input.formula !== undefined) this.assertFormula(input.formula);
    try {
      const [row] = await this.db
        .update(customMetrics)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.formula !== undefined ? { formula: input.formula } : {}),
          ...(input.format !== undefined ? { format: input.format } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customMetrics.id, id),
            eq(customMetrics.organizationId, orgId),
          ),
        )
        .returning();
      return toSummary(row);
    } catch (err) {
      throw this.conflictOr(err);
    }
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.assertExists(orgId, id);
    await this.db
      .delete(customMetrics)
      .where(
        and(eq(customMetrics.id, id), eq(customMetrics.organizationId, orgId)),
      );
  }

  /** Org'un tüm özel metriklerini verilen filtre için değerlendirir. */
  async values(
    orgId: string,
    filter: AnalyticsFilter,
  ): Promise<CustomMetricValuesResponse> {
    const metrics = await this.list(orgId);
    const { currency, storeIds, values } = await this.analytics.fieldValues(
      orgId,
      filter,
    );
    return {
      from: filter.from,
      to: filter.to,
      storeIds,
      currency,
      values: metrics.map((m) => ({
        id: m.id,
        name: m.name,
        format: m.format,
        formula: m.formula,
        value: evaluateFormula(m.formula, values),
      })),
    };
  }

  // ---- iç ----

  private assertFormula(formula: string): void {
    const res = validateFormula(formula, CUSTOM_METRIC_FIELDS);
    if (!res.ok) {
      throw new BadRequestException({
        message: "Geçersiz formül",
        issues: [{ path: "formula", message: res.error ?? "Geçersiz formül" }],
      });
    }
  }

  private async assertExists(orgId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: customMetrics.id })
      .from(customMetrics)
      .where(
        and(eq(customMetrics.id, id), eq(customMetrics.organizationId, orgId)),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Özel metrik bulunamadı");
  }

  private conflictOr(err: unknown): Error {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return new ConflictException("Bu adda bir özel metrik zaten var");
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
