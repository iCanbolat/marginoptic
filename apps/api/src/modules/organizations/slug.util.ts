import { randomBytes } from "node:crypto";

/** İnsan-okunur, çakışma-dirençli slug üretir: "acme-store" -> "acme-store-9f3a1c". */
export function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "org";
  return `${base}-${randomBytes(3).toString("hex")}`;
}
