import {
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  DashboardCreateInput,
  DashboardDetail,
  DashboardSummary,
  DashboardUpdateInput,
  DashboardWidget,
  DashboardWidgetsInput,
} from "@churnify/shared";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { dashboards, dashboardWidgets } from "../../database/schema/dashboards";

/** Faz 7 — Pano CRUD + widget layout persist (org başına bir varsayılan). */
@Injectable()
export class DashboardsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(storeId: string): Promise<DashboardSummary[]> {
    const rows = await this.db
      .select({
        id: dashboards.id,
        name: dashboards.name,
        isDefault: dashboards.isDefault,
        createdAt: dashboards.createdAt,
        updatedAt: dashboards.updatedAt,
      })
      .from(dashboards)
      .where(eq(dashboards.storeId, storeId))
      .orderBy(asc(dashboards.createdAt));
    if (rows.length === 0) return [];

    const counts = await this.db
      .select({
        dashboardId: dashboardWidgets.dashboardId,
        count: sql<number>`count(*)::int`,
      })
      .from(dashboardWidgets)
      .where(
        inArray(
          dashboardWidgets.dashboardId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(dashboardWidgets.dashboardId);
    const countById = new Map(counts.map((c) => [c.dashboardId, c.count]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      widgetCount: countById.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async get(storeId: string, id: string): Promise<DashboardDetail> {
    const dash = await this.assertExists(storeId, id);
    const widgets = await this.loadWidgets(id);
    return {
      id: dash.id,
      name: dash.name,
      isDefault: dash.isDefault,
      widgetCount: widgets.length,
      createdAt: dash.createdAt.toISOString(),
      updatedAt: dash.updatedAt.toISOString(),
      widgets,
    };
  }

  async create(
    storeId: string,
    userId: string,
    input: DashboardCreateInput,
  ): Promise<DashboardDetail> {
    return this.db.transaction(async (tx) => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(dashboards)
        .where(eq(dashboards.storeId, storeId));
      // İlk pano her zaman varsayılan; aksi halde istek belirler.
      const makeDefault = input.isDefault === true || count === 0;
      if (makeDefault) await this.clearDefault(tx, storeId);

      const [row] = await tx
        .insert(dashboards)
        .values({
          storeId: storeId,
          createdBy: userId,
          name: input.name,
          isDefault: makeDefault,
        })
        .returning();
      return {
        id: row.id,
        name: row.name,
        isDefault: row.isDefault,
        widgetCount: 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        widgets: [],
      };
    });
  }

  async update(
    storeId: string,
    id: string,
    input: DashboardUpdateInput,
  ): Promise<DashboardDetail> {
    await this.assertExists(storeId, id);
    await this.db.transaction(async (tx) => {
      if (input.isDefault === true) await this.clearDefault(tx, storeId);
      await tx
        .update(dashboards)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(dashboards.id, id), eq(dashboards.storeId, storeId)),
        );
    });
    return this.get(storeId, id);
  }

  async remove(storeId: string, id: string): Promise<void> {
    const dash = await this.assertExists(storeId, id);
    await this.db
      .delete(dashboards)
      .where(and(eq(dashboards.id, id), eq(dashboards.storeId, storeId)));
    // Sildiğimiz varsayılansa, kalan ilk panoyu varsayılan yap.
    if (dash.isDefault) {
      const [next] = await this.db
        .select({ id: dashboards.id })
        .from(dashboards)
        .where(eq(dashboards.storeId, storeId))
        .orderBy(asc(dashboards.createdAt))
        .limit(1);
      if (next) {
        await this.db
          .update(dashboards)
          .set({ isDefault: true })
          .where(eq(dashboards.id, next.id));
      }
    }
  }

  /** Pano widget'larını + layout'unu toplu kaydeder (tam değiştir). */
  async saveWidgets(
    storeId: string,
    id: string,
    input: DashboardWidgetsInput,
  ): Promise<DashboardDetail> {
    await this.assertExists(storeId, id);
    await this.db.transaction(async (tx) => {
      await tx
        .delete(dashboardWidgets)
        .where(eq(dashboardWidgets.dashboardId, id));
      if (input.widgets.length > 0) {
        await tx.insert(dashboardWidgets).values(
          input.widgets.map((w, i) => ({
            dashboardId: id,
            widgetKey: w.id,
            type: w.type,
            config: w.config,
            x: w.layout.x,
            y: w.layout.y,
            w: w.layout.w,
            h: w.layout.h,
            sort: i,
          })),
        );
      }
      await tx
        .update(dashboards)
        .set({ updatedAt: new Date() })
        .where(eq(dashboards.id, id));
    });
    return this.get(storeId, id);
  }

  // ---- iç ----

  private async loadWidgets(dashboardId: string): Promise<DashboardWidget[]> {
    const rows = await this.db
      .select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.dashboardId, dashboardId))
      .orderBy(asc(dashboardWidgets.sort));
    return rows.map((r) => ({
      id: r.widgetKey,
      type: r.type,
      config: r.config ?? {},
      layout: { x: r.x, y: r.y, w: r.w, h: r.h },
    }));
  }

  private async assertExists(storeId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(dashboards)
      .where(and(eq(dashboards.id, id), eq(dashboards.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException("Pano bulunamadı");
    return row;
  }

  /** Org'un mevcut varsayılanını temizler (partial-unique ihlalini önler). */
  private async clearDefault(
    tx: Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0],
    storeId: string,
  ): Promise<void> {
    await tx
      .update(dashboards)
      .set({ isDefault: false })
      .where(
        and(
          eq(dashboards.storeId, storeId),
          eq(dashboards.isDefault, true),
        ),
      );
  }
}
