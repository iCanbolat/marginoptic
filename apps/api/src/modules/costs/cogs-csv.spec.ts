import { parseCogsCsv } from "./cogs-csv";

describe("parseCogsCsv", () => {
  it("temel başlık + satırları ayrıştırır ve parayı normalize eder", () => {
    const { rows, headerError } = parseCogsCsv(
      "sku,cost,handling\nABC-1,10,1.5\nABC-2,7.25,",
    );
    expect(headerError).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      sku: "ABC-1",
      costAmount: "10.0000",
      handlingFee: "1.5000",
      valid: true,
      error: null,
    });
    // handling boş → null, hata yok
    expect(rows[1]).toMatchObject({
      sku: "ABC-2",
      costAmount: "7.2500",
      handlingFee: null,
      valid: true,
    });
  });

  it("kolon sırasından bağımsız, alias ve büyük/küçük harf toleranslı eşler", () => {
    const { rows, headerError } = parseCogsCsv(
      "Cost Amount,Variant SKU,Country,Min Qty\n12.00,XY,de,3",
    );
    expect(headerError).toBeNull();
    expect(rows[0]).toMatchObject({
      sku: "XY",
      costAmount: "12.0000",
      country: "DE",
      minQty: 3,
      valid: true,
    });
  });

  it("zorunlu kolon yoksa headerError döner", () => {
    const res = parseCogsCsv("name,price\nfoo,1");
    expect(res.rows).toHaveLength(0);
    expect(res.headerError).toMatch(/sku.*cost/i);
  });

  it("geçersiz hücreleri satır bazında işaretler, geçerlileri korur", () => {
    const { rows } = parseCogsCsv(
      "sku,cost\nGOOD,5\nBAD,abc\n,9\nQTY,10",
    );
    expect(rows[0]).toMatchObject({ sku: "GOOD", valid: true });
    expect(rows[1]).toMatchObject({ sku: "BAD", valid: false });
    expect(rows[1]!.error).toMatch(/cost/);
    expect(rows[2]).toMatchObject({ valid: false, error: "sku boş" });
    expect(rows[3]).toMatchObject({ sku: "QTY", valid: true });
  });

  it("tırnaklı alan, kaçışlı tırnak ve CRLF işler; boş kuyruk satırlarını atar", () => {
    const { rows } = parseCogsCsv(
      'sku,cost,handling\r\n"A,1","10","0.50"\r\n"He said ""hi""",3,\r\n\r\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sku: "A,1",
      costAmount: "10.0000",
      handlingFee: "0.5000",
    });
    expect(rows[1]!.sku).toBe('He said "hi"');
  });

  it("para sembolü/binlik ayraç içeren tutarı temizler", () => {
    const { rows } = parseCogsCsv("sku,cost\nX,$12.50");
    expect(rows[0]).toMatchObject({ costAmount: "12.5000", valid: true });
  });
});
