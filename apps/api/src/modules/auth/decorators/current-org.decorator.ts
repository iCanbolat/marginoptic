import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { Role } from "@churnify/shared";
import type { AuthContext } from "../auth.types";

export interface ActiveOrg {
  id: string;
  role: Role;
}

/** Aktif organizasyonu (token'dan) döner; yoksa 403. Org-scoped route'larda kullanılır. */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveOrg => {
    const auth = ctx.switchToHttp().getRequest<{ user?: AuthContext }>().user;
    if (!auth?.org) {
      throw new ForbiddenException("Aktif organizasyon gerekli");
    }
    return auth.org;
  },
);
