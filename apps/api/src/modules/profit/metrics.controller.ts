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
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { MetricsService } from "./metrics.service";

/** Yeniden hesaplamayı tetikleme yetkisi: viewer hariç. */
const EDIT_ROLES = ["owner", "admin", "analyst"] as const;

@ApiTags("metrics")
@ApiBearerAuth()
@Controller("channels/:channelId/metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /** Gün+mağaza metrikleri (günlük seri + aralık toplamları). */
  @Get()
  get(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(metricsQuerySchema)) query: MetricsQuery,
  ): Promise<StoreMetricsSummary> {
    return this.metrics.getStoreMetrics(org.id, channelId, query.from, query.to);
  }

  /** Ürün kârlılık sıralaması (net kâra göre). */
  @Get("products")
  products(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(metricsQuerySchema)) query: MetricsQuery,
  ): Promise<ProductProfitRow[]> {
    return this.metrics.getProductRanking(
      org.id,
      channelId,
      query.from,
      query.to,
    );
  }

  /** Mağaza metriklerini yeniden hesapla (kuyruğa al). */
  @Post("recompute")
  @HttpCode(202)
  async recompute(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<RecomputeResult> {
    await this.metrics.requestRecompute(org.id, channelId);
    return { channelId, enqueued: true };
  }
}
