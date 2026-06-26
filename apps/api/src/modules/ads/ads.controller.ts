import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  adsPerformanceQuerySchema,
  type AdsPerformanceQuery,
  type AdsPerformanceResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { AdsQueryService } from "./ads-query.service";

@ApiTags("ads")
@ApiBearerAuth()
@Controller("channels/:channelId/ads")
export class AdsController {
  constructor(private readonly ads: AdsQueryService) {}

  /** Reklam performansı: kırılım (campaign/adset/ad) + blended ROAS/POAS + gün serisi. */
  @Get("performance")
  performance(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(adsPerformanceQuerySchema))
    query: AdsPerformanceQuery,
  ): Promise<AdsPerformanceResponse> {
    return this.ads.getPerformance(
      org.id,
      channelId,
      query.from,
      query.to,
      query.level,
    );
  }
}
