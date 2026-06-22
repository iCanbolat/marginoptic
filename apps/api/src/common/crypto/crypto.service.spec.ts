import { ConfigService } from "@nestjs/config";
import { CryptoService } from "./crypto.service";

function makeService(keyHex = "11".repeat(32)): CryptoService {
  return new CryptoService({
    getOrThrow: () => keyHex,
  } as unknown as ConfigService);
}

describe("CryptoService", () => {
  it("şifreler ve aynısını çözer (round-trip)", () => {
    const svc = makeService();
    const secret = "shpat_super_secret_token_value";
    const enc = svc.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it("her şifrelemede farklı IV üretir", () => {
    const svc = makeService();
    expect(svc.encrypt("x")).not.toBe(svc.encrypt("x"));
  });

  it("kurcalanmış veriyi reddeder (auth tag)", () => {
    const svc = makeService();
    const enc = svc.encrypt("hello");
    const [iv, tag, data] = enc.split(":");
    const tampered = [iv, tag, Buffer.from("zzzz").toString("base64")].join(":");
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it("32 byte olmayan anahtarı reddeder", () => {
    expect(() => makeService("00")).toThrow(/32 byte/);
  });

  it("safeEqual eşit/eşitsiz string'leri doğru karşılaştırır", () => {
    expect(CryptoService.safeEqual("abc", "abc")).toBe(true);
    expect(CryptoService.safeEqual("abc", "abd")).toBe(false);
    expect(CryptoService.safeEqual("abc", "abcd")).toBe(false);
  });
});
