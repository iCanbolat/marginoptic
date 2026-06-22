import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthContext } from "../auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext =>
    ctx.switchToHttp().getRequest<{ user: AuthContext }>().user,
);
