import { parseJsonl, reconstructBulkObjects } from "./bulk-jsonl";

describe("bulk JSONL", () => {
  const jsonl = [
    JSON.stringify({ id: "gid://shopify/Order/1", name: "#1" }),
    JSON.stringify({
      id: "gid://shopify/LineItem/10",
      __parentId: "gid://shopify/Order/1",
      quantity: 1,
    }),
    JSON.stringify({
      id: "gid://shopify/LineItem/11",
      __parentId: "gid://shopify/Order/1",
      quantity: 2,
    }),
    JSON.stringify({ id: "gid://shopify/Order/2", name: "#2" }),
    JSON.stringify({
      id: "gid://shopify/LineItem/20",
      __parentId: "gid://shopify/Order/2",
      quantity: 3,
    }),
    "", // boş satır atlanmalı
  ].join("\n");

  it("parseJsonl boş satırları atlar", () => {
    expect(parseJsonl(jsonl)).toHaveLength(5);
  });

  it("çocukları ebeveynin dizi alanına yerleştirir", () => {
    const roots = reconstructBulkObjects(parseJsonl(jsonl), {
      LineItem: "lineItems",
    });
    expect(roots).toHaveLength(2);
    expect((roots[0].lineItems as unknown[]).length).toBe(2);
    expect((roots[1].lineItems as unknown[]).length).toBe(1);
    expect(roots[0].name).toBe("#1");
  });

  it("eşlenmeyen alt-tipleri yok sayar", () => {
    const roots = reconstructBulkObjects(parseJsonl(jsonl), {});
    expect(roots).toHaveLength(2);
    expect(roots[0].lineItems).toBeUndefined();
  });
});
