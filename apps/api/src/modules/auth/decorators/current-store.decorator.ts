import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { AuthContext } from "../auth.types";

/** Aktif mağaza (store) bağlamı — token'dan gelen `org` claim'i. */
export interface ActiveStore {
  id: string;
}

/** Aktif mağazayı (token'dan) döner; yoksa 403. Store-scoped route'larda kullanılır. */
export const CurrentStore = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActiveStore => {
    const auth = ctx.switchToHttp().getRequest<{ user?: AuthContext }>().user;
    if (!auth?.org) {
      throw new ForbiddenException("Aktif mağaza gerekli");
    }
    return auth.org;
  },
);
