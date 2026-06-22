import { createHmac } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CryptoService } from "../../../common/crypto/crypto.service";
import type {
  BuildAuthUrlParams,
  ExchangeCodeParams,
  OAuthConnector,
  RegisterWebhooksParams,
  TokenSet,
} from "../connector.types";

const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
  "products/create",
  "products/update",
  "products/delete",
  "app/uninstalled",
  // GDPR zorunlu (Faz 9)
  "customers/redact",
  "shop/redact",
  "customers/data_request",
];

@Injectable()
export class ShopifyConnector implements OAuthConnector {
  readonly provider = "shopify" as const;
  private readonly logger = new Logger(ShopifyConnector.name);

  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    return this.config.getOrThrow<string>("SHOPIFY_API_SECRET");
  }

  buildAuthUrl({ shop, state, redirectUri }: BuildAuthUrlParams): string {
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("SHOPIFY_API_KEY"),
    );
    url.searchParams.set(
      "scope",
      this.config.getOrThrow<string>("SHOPIFY_SCOPES"),
    );
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode({ shop, code }: ExchangeCodeParams): Promise<TokenSet> {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: this.config.getOrThrow<string>("SHOPIFY_API_KEY"),
        client_secret: this.secret,
        code,
      }),
    });
    if (!res.ok) {
      throw new Error(`Shopify token değişimi başarısız (${res.status})`);
    }
    const data = (await res.json()) as { access_token: string; scope: string };
    return {
      accessToken: data.access_token,
      scopes: data.scope,
      externalAccountId: shop,
    };
  }

  /** Webhook gövdesinin HMAC-SHA256 (base64) doğrulaması. */
  verifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined): boolean {
    if (!hmacHeader) return false;
    const digest = createHmac("sha256", this.secret)
      .update(rawBody)
      .digest("base64");
    return CryptoService.safeEqual(digest, hmacHeader);
  }

  /** OAuth callback query'sinin HMAC-SHA256 (hex) doğrulaması. */
  verifyCallbackHmac(query: Record<string, string>): boolean {
    const { hmac, signature: _signature, ...rest } = query;
    if (!hmac) return false;
    const message = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join("&");
    const digest = createHmac("sha256", this.secret)
      .update(message)
      .digest("hex");
    return CryptoService.safeEqual(digest, hmac);
  }

  async registerWebhooks({
    shop,
    accessToken,
    callbackBaseUrl,
  }: RegisterWebhooksParams): Promise<void> {
    const version = this.config.getOrThrow<string>("SHOPIFY_API_VERSION");
    const address = `${callbackBaseUrl}/api/integrations/webhooks/shopify`;
    for (const topic of WEBHOOK_TOPICS) {
      try {
        const res = await fetch(
          `https://${shop}/admin/api/${version}/webhooks.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
          },
        );
        if (!res.ok) {
          this.logger.warn(`Webhook kaydı başarısız (${topic}): ${res.status}`);
        }
      } catch (err) {
        this.logger.warn(`Webhook kaydı hatası (${topic}): ${String(err)}`);
      }
    }
  }
}
