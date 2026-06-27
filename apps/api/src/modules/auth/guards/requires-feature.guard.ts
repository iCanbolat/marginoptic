import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { planAllows, type Feature } from "@churnify/shared";
import { BillingService } from "../../billing/billing.service";
import type { AuthContext } from "../auth.types";
import { REQUIRES_FEATURE_KEY } from "../decorators/requires-feature.decorator";

/**
 * `@RequiresFeature("...")` ile işaretlenmiş endpoint'leri planın özellik haritasına
 * göre korur. Global `JwtAuthGuard`'tan SONRA çalıştığından `req.user` doludur.
 * Metadata yoksa geçer — böylece gated/ungated handler'lar aynı controller'da yaşar.
 */
@Injectable()
export class RequiresFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(
      REQUIRES_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthContext }>();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException("Kimlik doğrulanamadı");

    const ent = await this.billing.getEntitlement(userId);
    if (!planAllows(ent.plan, feature)) {
      throw new ForbiddenException({
        code: "FEATURE_LOCKED",
        feature,
        message: "Bu özellik Pro plana özeldir. Planınızı yükseltin.",
      });
    }
    return true;
  }
}
