import { SetMetadata } from "@nestjs/common";
import type { Role } from "@churnify/shared";

export const ROLES_KEY = "roles";

/** Aktif organizasyondaki rolü kısıtlar. RolesGuard ile birlikte kullanılır. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
