import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  adsPerformanceQuerySchema,
  type AdsPerformanceQuery,
  type AdsPerformanceResponse,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { AdsQueryService } from "./ads-query.service";

@ApiTags("ads")
@ApiBearerAuth()
@Controller("stores/:storeId/ads")
export class AdsController {
  constructor(private readonly ads: AdsQueryService) {}

  /** Reklam performansı: kırılım (campaign/adset/ad) + blended ROAS/POAS + gün serisi. */
  @Get("performance")
  performance(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(adsPerformanceQuerySchema))
    query: AdsPerformanceQuery,
  ): Promise<AdsPerformanceResponse> {
    return this.ads.getPerformance(
      org.id,
      storeId,
      query.from,
      query.to,
      query.level,
    );
  }
}
