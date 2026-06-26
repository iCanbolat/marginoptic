import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ordersQuerySchema,
  type OrderRow,
  type OrdersQuery,
  type Paginated,
  type StoreSyncStatus,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { IngestionQueryService } from "./ingestion-query.service";

@ApiTags("ingestion")
@ApiBearerAuth()
@Controller("channels/:channelId")
export class IngestionController {
  constructor(private readonly query: IngestionQueryService) {}

  /** Mağazanın backfill/sync durumunu döner (ilerleme + tazelik UI'ı için). */
  @Get("sync")
  syncStatus(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
  ): Promise<StoreSyncStatus> {
    return this.query.syncStatus(org.id, channelId);
  }

  /** Ham siparişler (cursor sayfalı, debug/iç görünürlük). */
  @Get("orders")
  orders(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query(new ZodValidationPipe(ordersQuerySchema)) query: OrdersQuery,
  ): Promise<Paginated<OrderRow>> {
    return this.query.listOrders(org.id, channelId, query);
  }
}
