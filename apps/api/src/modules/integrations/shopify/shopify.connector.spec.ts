import { createHmac } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { ShopifyConnector } from "./shopify.connector";

const cfg = (o: Record<string, string>) =>
  ({ getOrThrow: (k: string) => o[k] }) as unknown as ConfigService;

const connector = new ShopifyConnector(
  cfg({
    SHOPIFY_API_KEY: "test_key",
    SHOPIFY_API_SECRET: "test_secret",
    SHOPIFY_SCOPES: "read_orders,read_products",
    SHOPIFY_API_VERSION: "2025-01",
  }),
);

describe("ShopifyConnector", () => {
  it("authorize URL'i doğru kurar", () => {
    const url = new URL(
      connector.buildAuthUrl({
        shop: "demo.myshopify.com",
        state: "abc",
        redirectUri: "https://api.example.com/cb",
      }),
    );
    expect(url.host).toBe("demo.myshopify.com");
    expect(url.pathname).toBe("/admin/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test_key");
    expect(url.searchParams.get("scope")).toBe("read_orders,read_products");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/cb",
    );
  });

  it("geçerli webhook HMAC'ini doğrular, geçersizi reddeder", () => {
    const body = Buffer.from(JSON.stringify({ id: 1 }));
    const valid = createHmac("sha256", "test_secret")
      .update(body)
      .digest("base64");
    expect(connector.verifyWebhookHmac(body, valid)).toBe(true);
    expect(connector.verifyWebhookHmac(body, "bad")).toBe(false);
    expect(connector.verifyWebhookHmac(body, undefined)).toBe(false);
  });

  it("OAuth callback HMAC'ini doğrular", () => {
    const params: Record<string, string> = {
      code: "c",
      shop: "demo.myshopify.com",
      state: "s",
      timestamp: "123",
    };
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const hmac = createHmac("sha256", "test_secret")
      .update(message)
      .digest("hex");
    expect(connector.verifyCallbackHmac({ ...params, hmac })).toBe(true);
    expect(connector.verifyCallbackHmac({ ...params, hmac: "deadbeef" })).toBe(
      false,
    );
  });
});
