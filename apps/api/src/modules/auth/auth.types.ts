import type { Role } from "@churnify/shared";

/** Access JWT içeriği. */
export interface JwtPayload {
  sub: string;
  email: string;
  org?: { id: string; role: Role };
}

/** Strategy.validate sonrası `req.user` üzerine yazılan bağlam. */
export interface AuthContext {
  userId: string;
  email: string;
  org: { id: string; role: Role } | null;
}
