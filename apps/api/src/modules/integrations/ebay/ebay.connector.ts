import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TokenSet } from "../connector.types";

export interface EbaySellerInfo {
  sellerId: string;
  sellerName: string;
  currency: string;
}

/** Production / sandbox endpoint çiftleri (EBAY_ENV ile seçilir). */
const ENDPOINTS = {
  production: {
    authorize: "https://auth.ebay.com/oauth2/authorize",
    token: "https://api.ebay.com/identity/v1/oauth2/token",
    api: "https://api.ebay.com",
    apiz: "https://apiz.ebay.com",
  },
  sandbox: {
    authorize: "https://auth.sandbox.ebay.com/oauth2/authorize",
    token: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    api: "https://api.sandbox.ebay.com",
    apiz: "https://apiz.sandbox.ebay.com",
  },
} as const;

/**
 * Faz 10 — eBay connector (OAuth2 authorization code, Sell API).
 *
 * Etsy gibi Shopify'ın `OAuthConnector` arayüzünü uygulamaz (eBay'in webhook modeli
 * Shopify HMAC'ine uymaz; tazelik **zamanlanmış polling** ile sağlanır), bu yüzden ayrı
 * bir sınıf; `IntegrationsService` doğrudan kullanır. `EBAY_CLIENT_ID` yoksa `isConfigured`
 * false → canlı OAuth engellenir; dev-connect (sentetik) yine çalışır.
 */
@Injectable()
export class EbayConnector {
  readonly provider = "ebay" as const;
  private readonly logger = new Logger(EbayConnector.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("EBAY_CLIENT_ID"));
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>("EBAY_CLIENT_ID");
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>("EBAY_CLIENT_SECRET");
  }

  private get scopes(): string {
    return this.config.get<string>(
      "EBAY_SCOPES",
      "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    );
  }

  private get endpoints() {
    const env = this.config.get<"production" | "sandbox">("EBAY_ENV", "production");
    return ENDPOINTS[env] ?? ENDPOINTS.production;
  }

  buildAuthUrl(params: { state: string; redirectUri: string }): string {
    const url = new URL(this.endpoints.authorize);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("scope", this.scopes);
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  /** client_id:client_secret → Basic auth başlığı (eBay token ucu bunu ister). */
  private basicAuth(): string {
    return Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<TokenSet> {
    const res = await fetch(this.endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${this.basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`eBay token değişimi başarısız (${res.status})`);
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

  /** refresh_token ile yeni access token (eBay user token'ı ~2 saat → polling öncesi yenilenir). */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const res = await fetch(this.endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${this.basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: this.scopes,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`eBay token yenileme başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: this.scopes,
    };
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /** Token sahibinin eBay kullanıcısını çözer (canlı OAuth sonrası mağaza adı/kimliği). */
  async fetchSeller(accessToken: string): Promise<EbaySellerInfo> {
    const res = await fetch(`${this.endpoints.apiz}/commerce/identity/v1/user/`, {
      headers: this.headers(accessToken),
    });
    if (!res.ok) throw new Error(`eBay user çözümü başarısız (${res.status})`);
    const user = (await res.json()) as {
      userId?: string;
      username?: string;
      registrationMarketplaceId?: string;
    };
    const sellerId = user.userId ?? user.username ?? "";
    if (!sellerId) throw new Error("eBay satıcı kimliği bulunamadı");
    return {
      sellerId,
      sellerName: user.username ?? `ebay-${sellerId}`,
      currency: "USD",
    };
  }

  /**
   * Canlı eBay Sell API verisi. `customers` order'lardan türetilir. Dev token'da bu yol
   * kullanılmaz (sentetik veri devreye girer). `since` (ISO) verilirse orders artımlı çekilir.
   */
  async fetchResource(
    resource: "products" | "orders" | "customers",
    accessToken: string,
    since?: string,
  ): Promise<Record<string, unknown>[]> {
    const h = this.headers(accessToken);
    if (resource === "products") {
      const res = await fetch(
        `${this.endpoints.api}/sell/inventory/v1/inventory_item?limit=100`,
        { headers: h },
      );
      if (!res.ok) throw new Error(`eBay inventory başarısız (${res.status})`);
      const body = (await res.json()) as { inventoryItems?: Record<string, unknown>[] };
      return body.inventoryItems ?? [];
    }
    // orders + customers ikisi de Fulfillment API order'larından beslenir
    const url = new URL(`${this.endpoints.api}/sell/fulfillment/v1/order`);
    url.searchParams.set("limit", "100");
    if (since) {
      url.searchParams.set("filter", `lastmodifieddate:[${since}..]`);
    }
    const res = await fetch(url.toString(), { headers: h });
    if (!res.ok) throw new Error(`eBay orders başarısız (${res.status})`);
    const body = (await res.json()) as { orders?: Record<string, unknown>[] };
    const orders = body.orders ?? [];
    if (resource === "orders") return orders;
    // customers: order'lardan tekilleştirilmiş alıcılar
    const byId = new Map<string, Record<string, unknown>>();
    for (const o of orders) {
      const buyer = (o.buyer ?? {}) as Record<string, unknown>;
      const uid = String(buyer.username ?? "");
      if (uid && !byId.has(uid)) {
        byId.set(uid, {
          username: uid,
          email:
            ((buyer.buyerRegistrationAddress ?? {}) as Record<string, unknown>).email ??
            null,
          orders_count: 1,
        });
      }
    }
    return [...byId.values()];
  }
}
