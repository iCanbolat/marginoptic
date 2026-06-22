import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  metricsQuerySchema,
  type MetricsQuery,
  type ProductProfitRow,
  type RecomputeResult,
  type StoreMetricsSummary,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { MetricsService } from "./metrics.service";

/** Yeniden hesaplamayı tetikleme yetkisi: viewer hariç. */
const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("metrics")
@ApiBearerAuth()
@Controller("stores/:storeId/metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /** Gün+mağaza metrikleri (günlük seri + aralık toplamları). */
  @Get()
  get(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(metricsQuerySchema)) query: MetricsQuery,
  ): Promise<StoreMetricsSummary> {
    return this.metrics.getStoreMetrics(org.id, storeId, query.from, query.to);
  }

  /** Ürün kârlılık sıralaması (net kâra göre). */
  @Get("products")
  products(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(metricsQuerySchema)) query: MetricsQuery,
  ): Promise<ProductProfitRow[]> {
    return this.metrics.getProductRanking(
      org.id,
      storeId,
      query.from,
      query.to,
    );
  }

  /** Mağaza metriklerini yeniden hesapla (kuyruğa al). */
  @Post("recompute")
  @Roles(...EDIT_ROLES)
  @HttpCode(202)
  async recompute(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<RecomputeResult> {
    await this.metrics.requestRecompute(org.id, storeId);
    return { storeId, enqueued: true };
  }
}
