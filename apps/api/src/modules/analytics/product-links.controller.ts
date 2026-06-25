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
  type ActiveOrg,
  CurrentOrg,
} from "../auth/decorators/current-org.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
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
@Controller("stores/:storeId/product-ad-links")
export class ProductLinksController {
  constructor(private readonly links: ProductLinksService) {}

  @Get()
  list(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query("productExternalId") productExternalId?: string,
  ): Promise<ProductAdLink[]> {
    return this.links.list(org.id, storeId, productExternalId);
  }

  /** Eşleştirilebilir reklam varlıkları (kampanya/adset/ad). */
  @Get("ad-entities")
  adEntities(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Query("provider") provider?: string,
  ): Promise<AdEntityOption[]> {
    return this.links.adEntityOptions(org.id, storeId, parseProvider(provider));
  }

  @Roles("owner", "admin")
  @Post()
  create(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Body(createPipe) body: ProductAdLinkCreateInput,
  ): Promise<ProductAdLink> {
    return this.links.create(org.id, storeId, body);
  }

  @Roles("owner", "admin")
  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentOrg() org: ActiveOrg,
    @Param("storeId") storeId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.links.remove(org.id, storeId, id);
  }
}
