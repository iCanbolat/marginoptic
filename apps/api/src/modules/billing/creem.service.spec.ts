import { createHmac } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { CreemService } from "./creem.service";

/** Sahte ConfigService — yalnız `get(key, default)` kullanılır. */
function makeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: unknown) => values[key] ?? def,
  } as unknown as ConfigService;
}

describe("CreemService", () => {
  describe("isConfigured / plan eşleme", () => {
    const creem = new CreemService(
      makeConfig({
        CREEM_API_KEY: "creem_live_x",
        CREEM_PRODUCT_BASIC: "prod_basic",
        CREEM_PRODUCT_PRO: "prod_pro",
      }),
    );

    it("anahtar varsa configured", () => {
      expect(creem.isConfigured).toBe(true);
    });

    it("anahtar yoksa dev mod", () => {
      const dev = new CreemService(makeConfig({}));
      expect(dev.isConfigured).toBe(false);
    });

    it("plan ↔ ürün eşlemesi çift yönlü", () => {
      expect(creem.productIdForPlan("basic")).toBe("prod_basic");
      expect(creem.productIdForPlan("pro")).toBe("prod_pro");
      expect(creem.planForProductId("prod_basic")).toBe("basic");
      expect(creem.planForProductId("prod_pro")).toBe("pro");
      expect(creem.planForProductId("prod_unknown")).toBeNull();
      expect(creem.planForProductId(null)).toBeNull();
    });
  });

  describe("verifyWebhookSignature", () => {
    const secret = "whsec_test";
    const creem = new CreemService(makeConfig({ CREEM_WEBHOOK_SECRET: secret }));
    const raw = JSON.stringify({ id: "evt_1", eventType: "subscription.active" });
    const sign = (body: string, key: string) =>
      createHmac("sha256", key).update(body).digest("hex");

    it("doğru imza → true", () => {
      expect(creem.verifyWebhookSignature(raw, sign(raw, secret))).toBe(true);
    });

    it("yanlış imza → false", () => {
      expect(creem.verifyWebhookSignature(raw, sign(raw, "wrong"))).toBe(false);
    });

    it("imza eksik → false", () => {
      expect(creem.verifyWebhookSignature(raw, undefined)).toBe(false);
    });

    it("Buffer gövde de doğrulanır", () => {
      const buf = Buffer.from(raw, "utf8");
      expect(creem.verifyWebhookSignature(buf, sign(raw, secret))).toBe(true);
    });

    it("secret yoksa (dev) doğrulama atlanır → true", () => {
      const dev = new CreemService(makeConfig({}));
      expect(dev.verifyWebhookSignature(raw, undefined)).toBe(true);
    });
  });
});
