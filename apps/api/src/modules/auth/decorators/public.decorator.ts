import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Global JwtAuthGuard'ı atlayan endpoint'leri işaretler (login, register, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
