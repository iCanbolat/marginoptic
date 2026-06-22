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
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { IngestionQueryService } from "./ingestion-query.service";

@ApiTags("ingestion")
@ApiBearerAuth()
@Controller("stores/:storeId")
export class IngestionController {
  constructor(private readonly query: IngestionQueryService) {}

  /** Mağazanın backfill/sync durumunu döner (ilerleme + tazelik UI'ı için). */
  @Get("sync")
  syncStatus(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
  ): Promise<StoreSyncStatus> {
    return this.query.syncStatus(org.id, storeId);
  }

  /** Ham siparişler (cursor sayfalı, debug/iç görünürlük). */
  @Get("orders")
  orders(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query(new ZodValidationPipe(ordersQuerySchema)) query: OrdersQuery,
  ): Promise<Paginated<OrderRow>> {
    return this.query.listOrders(org.id, storeId, query);
  }
}
