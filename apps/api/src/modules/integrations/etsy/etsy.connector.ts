import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TokenSet } from "../connector.types";

export interface EtsyPkce {
  verifier: string;
  challenge: string;
}

export interface EtsyShopInfo {
  shopId: string;
  shopName: string;
  currency: string;
}

const ETSY_OAUTH_CONNECT = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_API_BASE = "https://api.etsy.com/v3/application";

/**
 * Faz 9 — Etsy connector (OAuth2 **PKCE**, Open API v3).
 *
 * Shopify'ın `OAuthConnector` arayüzünden farklı (PKCE + webhook HMAC yok), bu yüzden
 * ayrı bir sınıf; `IntegrationsService` doğrudan kullanır. Anahtar yoksa `isConfigured`
 * false → canlı OAuth engellenir; dev-connect (sentetik) yine çalışır.
 */
@Injectable()
export class EtsyConnector {
  readonly provider = "etsy" as const;
  private readonly logger = new Logger(EtsyConnector.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("ETSY_API_KEY"));
  }

  private get apiKey(): string {
    return this.config.getOrThrow<string>("ETSY_API_KEY");
  }

  private get scopes(): string {
    return this.config.get<string>("ETSY_SCOPES", "transactions_r listings_r shops_r");
  }

  /** PKCE çifti üret (S256). `verifier` Redis'te state ile saklanır, callback'te kullanılır. */
  static generatePkce(): EtsyPkce {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
  }

  buildAuthUrl(params: {
    state: string;
    challenge: string;
    redirectUri: string;
  }): string {
    const url = new URL(ETSY_OAUTH_CONNECT);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.apiKey);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("scope", this.scopes);
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(params: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<TokenSet> {
    const res = await fetch(ETSY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.apiKey,
        redirect_uri: params.redirectUri,
        code: params.code,
        code_verifier: params.verifier,
      }),
    });
    if (!res.ok) {
      throw new Error(`Etsy token değişimi başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: this.scopes,
    };
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      Authorization: `Bearer ${accessToken}`,
    };
  }

  /** Token sahibinin mağazasını çözer (canlı OAuth sonrası). */
  async fetchShop(accessToken: string): Promise<EtsyShopInfo> {
    const meRes = await fetch(`${ETSY_API_BASE}/users/me`, {
      headers: this.headers(accessToken),
    });
    if (!meRes.ok) throw new Error(`Etsy /users/me başarısız (${meRes.status})`);
    const me = (await meRes.json()) as { shop_id?: number; user_id?: number };
    const shopId = me.shop_id;
    if (!shopId) throw new Error("Etsy mağaza kimliği bulunamadı");
    const shopRes = await fetch(`${ETSY_API_BASE}/shops/${shopId}`, {
      headers: this.headers(accessToken),
    });
    const shop = shopRes.ok
      ? ((await shopRes.json()) as { shop_name?: string; currency_code?: string })
      : {};
    return {
      shopId: String(shopId),
      shopName: shop.shop_name ?? `etsy-${shopId}`,
      currency: shop.currency_code ?? "USD",
    };
  }

  /**
   * Canlı Etsy Open API v3 verisi (listings/receipts). `customers` receipt'lerden
   * türetilir. Dev token'da bu yol kullanılmaz (sentetik veri devreye girer).
   */
  async fetchResource(
    resource: "products" | "orders" | "customers",
    shopId: string,
    accessToken: string,
  ): Promise<Record<string, unknown>[]> {
    const h = this.headers(accessToken);
    if (resource === "products") {
      const res = await fetch(
        `${ETSY_API_BASE}/shops/${shopId}/listings/active?limit=100`,
        { headers: h },
      );
      if (!res.ok) throw new Error(`Etsy listings başarısız (${res.status})`);
      const body = (await res.json()) as { results?: Record<string, unknown>[] };
      return body.results ?? [];
    }
    // orders + customers ikisi de receipts'ten beslenir
    const res = await fetch(
      `${ETSY_API_BASE}/shops/${shopId}/receipts?limit=100`,
      { headers: h },
    );
    if (!res.ok) throw new Error(`Etsy receipts başarısız (${res.status})`);
    const body = (await res.json()) as { results?: Record<string, unknown>[] };
    const receipts = body.results ?? [];
    if (resource === "orders") return receipts;
    // customers: receipt'lerden tekilleştirilmiş alıcılar
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of receipts) {
      const uid = String(r.buyer_user_id ?? "");
      if (uid && !byId.has(uid)) {
        byId.set(uid, {
          user_id: r.buyer_user_id,
          primary_email: r.buyer_email,
          first_name: r.name,
          orders_count: 1,
        });
      }
    }
    return [...byId.values()];
  }
}
