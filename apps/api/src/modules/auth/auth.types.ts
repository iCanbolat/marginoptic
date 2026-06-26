/** Access JWT içeriği. `org` = aktif mağaza (store) id'si (tablo adı tarihsel). */
export interface JwtPayload {
  sub: string;
  email: string;
  org?: { id: string };
}

/** Strategy.validate sonrası `req.user` üzerine yazılan bağlam. */
export interface AuthContext {
  userId: string;
  email: string;
  org: { id: string } | null;
}
