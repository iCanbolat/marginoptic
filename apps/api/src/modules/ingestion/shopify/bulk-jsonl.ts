type Json = Record<string, unknown>;

/** "gid://shopify/LineItem/123" → "LineItem". */
function gidType(id: string): string {
  if (!id.startsWith("gid://")) return "";
  const parts = id.split("/");
  return parts[parts.length - 2] ?? "";
}

/** JSONL metnini satır satır parse eder (boş satırları atar). */
export function parseJsonl(text: string): Json[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as Json);
}

/**
 * Shopify Bulk Operations JSONL çıktısını yeniden iç içe yapıya çevirir.
 * Bağlantı (connection) alanları ayrı satır olarak gelir ve `__parentId` ile
 * ebeveynine işaret eder. `childFieldByType` her GID tipini ebeveynde hangi
 * dizi alanına ekleyeceğimizi söyler (ör. `LineItem` → `lineItems`).
 * Shopify ebeveyni çocuktan önce yazdığı için tek geçiş yeterlidir.
 */
export function reconstructBulkObjects(
  lines: Json[],
  childFieldByType: Record<string, string>,
): Json[] {
  const byId = new Map<string, Json>();
  const roots: Json[] = [];

  for (const obj of lines) {
    const id = obj.id != null ? String(obj.id) : "";
    if (id) byId.set(id, obj);

    const parentId = obj.__parentId;
    if (parentId == null) {
      roots.push(obj);
      continue;
    }
    const parent = byId.get(String(parentId));
    if (!parent) continue; // ebeveyn henüz görülmedi → güvenli atla
    const field = childFieldByType[gidType(id)];
    if (!field) continue;
    const arr = (parent[field] as Json[] | undefined) ?? [];
    arr.push(obj);
    parent[field] = arr;
  }

  return roots;
}
