import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AD_PROVIDERS,
  productAdLinkCreateSchema,
  type AdEntityOption,
  type AdProvider,
  type ProductAdLink,
  type ProductAdLinkCreateInput,
} from "@churnify/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  type ActiveStore,
  CurrentStore,
} from "../auth/decorators/current-store.decorator";
import { ProductLinksService } from "./product-links.service";

const createPipe = new ZodValidationPipe(productAdLinkCreateSchema);

function parseProvider(raw: string | undefined): AdProvider | undefined {
  return (AD_PROVIDERS as readonly string[]).includes(raw ?? "")
    ? (raw as AdProvider)
    : undefined;
}

/**
 * Ürün↔reklam manuel eşleştirme uçları (store-scoped). Amazon/eBay ürünlerini
 * Meta/Google reklam varlıklarına bağlamak için. Yazma uçları owner/admin.
 */
@ApiTags("product-ad-links")
@ApiBearerAuth()
@Controller("channels/:channelId/product-ad-links")
export class ProductLinksController {
  constructor(private readonly links: ProductLinksService) {}

  @Get()
  list(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query("productExternalId") productExternalId?: string,
  ): Promise<ProductAdLink[]> {
    return this.links.list(org.id, channelId, productExternalId);
  }

  /** Eşleştirilebilir reklam varlıkları (kampanya/adset/ad). */
  @Get("ad-entities")
  adEntities(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Query("provider") provider?: string,
  ): Promise<AdEntityOption[]> {
    return this.links.adEntityOptions(org.id, channelId, parseProvider(provider));
  }

  @Post()
  create(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Body(createPipe) body: ProductAdLinkCreateInput,
  ): Promise<ProductAdLink> {
    return this.links.create(org.id, channelId, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentStore() org: ActiveStore,
    @Param("channelId") channelId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.links.remove(org.id, channelId, id);
  }
}
