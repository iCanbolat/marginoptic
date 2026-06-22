import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@churnify/shared";
import type { AuthContext } from "../auth.types";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const auth = context
      .switchToHttp()
      .getRequest<{ user?: AuthContext }>().user;

    if (!auth?.org) {
      throw new ForbiddenException("Aktif organizasyon gerekli");
    }
    if (!required.includes(auth.org.role)) {
      throw new ForbiddenException("Bu işlem için yetkiniz yok");
    }
    return true;
  }
}
