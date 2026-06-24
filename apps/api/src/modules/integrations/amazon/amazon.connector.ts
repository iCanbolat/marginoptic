import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TokenSet } from "../connector.types";

export interface AmazonSellerInfo {
  sellerId: string;
  sellerName: string;
  currency: string;
}

/** Login with Amazon (LWA) token ucu — tüm bölgeler için ortak. */
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

/** Bölge → SP-API host + Seller Central consent host. */
const REGIONS = {
  na: {
    spApi: "https://sellingpartnerapi-na.amazon.com",
    consent: "https://sellercentral.amazon.com",
  },
  eu: {
    spApi: "https://sellingpartnerapi-eu.amazon.com",
    consent: "https://sellercentral-europe.amazon.com",
  },
  fe: {
    spApi: "https://sellingpartnerapi-fe.amazon.com",
    consent: "https://sellercentral.amazon.co.jp",
  },
} as const;

/**
 * Faz 10 — Amazon connector (Selling Partner API, Login with Amazon).
 *
 * Etsy/eBay gibi Shopify'ın `OAuthConnector` arayüzünü uygulamaz (Amazon webhook'ları
 * SQS/EventBridge üzerinden gider, basit HTTP push yok; tazelik **zamanlanmış polling**
 * ile sağlanır). SP-API artık AWS SigV4 imzası istemez — yalnız LWA access token yeterli.
 * Access token ~1 saat ömürlüdür → fetch öncesi refresh edilir. `AMAZON_LWA_CLIENT_ID`
 * yoksa `isConfigured` false → canlı OAuth engellenir; dev-connect (sentetik) yine çalışır.
 */
@Injectable()
export class AmazonConnector {
  readonly provider = "amazon" as const;
  private readonly logger = new Logger(AmazonConnector.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("AMAZON_LWA_CLIENT_ID"));
  }

  private get clientId(): string {
    return this.config.getOrThrow<string>("AMAZON_LWA_CLIENT_ID");
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>("AMAZON_LWA_CLIENT_SECRET");
  }

  private get region() {
    const region = this.config.get<"na" | "eu" | "fe">("AMAZON_REGION", "na");
    return REGIONS[region] ?? REGIONS.na;
  }

  /** Seller Central uygulama yetkilendirme (consent) URL'i. */
  buildAuthUrl(params: { state: string; redirectUri: string }): string {
    const url = new URL(`${this.region.consent}/apps/authorize/consent`);
    // SP-API uygulama (App) kimliği; bu scaffold'da LWA client_id kullanılır.
    url.searchParams.set("application_id", this.clientId);
    url.searchParams.set("state", params.state);
    url.searchParams.set("redirect_uri", params.redirectUri);
    return url.toString();
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
  }): Promise<TokenSet> {
    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Amazon LWA token değişimi başarısız (${res.status})`);
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
      scopes: this.config.get<string>("AMAZON_SCOPES") ?? null,
    };
  }

  /** refresh_token ile yeni access token (Amazon access token'ı ~1 saat → fetch öncesi yenilenir). */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const res = await fetch(LWA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });
    if (!res.ok) {
      throw new Error(`Amazon LWA token yenileme başarısız (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    };
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      "x-amz-access-token": accessToken,
      "Content-Type": "application/json",
    };
  }

  /** Satıcının marketplace katılımını çözer (canlı OAuth sonrası mağaza adı/kimliği). */
  async fetchSeller(accessToken: string): Promise<AmazonSellerInfo> {
    const res = await fetch(
      `${this.region.spApi}/sellers/v1/marketplaceParticipations`,
      { headers: this.headers(accessToken) },
    );
    if (!res.ok) throw new Error(`Amazon seller çözümü başarısız (${res.status})`);
    const body = (await res.json()) as {
      payload?: {
        marketplace?: { id?: string; name?: string; defaultCurrencyCode?: string };
      }[];
    };
    const first = body.payload?.[0]?.marketplace;
    const sellerId = first?.id ?? "";
    if (!sellerId) throw new Error("Amazon marketplace kimliği bulunamadı");
    return {
      sellerId,
      sellerName: first?.name ?? `amazon-${sellerId}`,
      currency: first?.defaultCurrencyCode ?? "USD",
    };
  }

  /**
   * Canlı Amazon SP-API verisi. `customers` order'lardan türetilir (Amazon alıcı PII'sini
   * kısıtlar). Dev token'da bu yol kullanılmaz (sentetik veri devreye girer). `since` (ISO)
   * verilirse orders `LastUpdatedAfter` ile artımlı çekilir.
   */
  async fetchResource(
    resource: "products" | "orders" | "customers",
    accessToken: string,
    marketplaceId: string,
    since?: string,
  ): Promise<Record<string, unknown>[]> {
    const h = this.headers(accessToken);
    if (resource === "products") {
      const res = await fetch(
        `${this.region.spApi}/listings/2021-08-01/items?marketplaceIds=${marketplaceId}`,
        { headers: h },
      );
      if (!res.ok) throw new Error(`Amazon listings başarısız (${res.status})`);
      const body = (await res.json()) as { items?: Record<string, unknown>[] };
      return body.items ?? [];
    }
    // orders + customers ikisi de Orders API'den beslenir
    const url = new URL(`${this.region.spApi}/orders/v0/orders`);
    url.searchParams.set("MarketplaceIds", marketplaceId);
    url.searchParams.set(
      since ? "LastUpdatedAfter" : "CreatedAfter",
      since ?? new Date(Date.now() - 180 * 86_400_000).toISOString(),
    );
    const res = await fetch(url.toString(), { headers: h });
    if (!res.ok) throw new Error(`Amazon orders başarısız (${res.status})`);
    const body = (await res.json()) as {
      payload?: { Orders?: Record<string, unknown>[] };
    };
    const orders = body.payload?.Orders ?? [];
    if (resource === "orders") return orders;
    // customers: order'lardan tekilleştirilmiş alıcılar
    const byId = new Map<string, Record<string, unknown>>();
    for (const o of orders) {
      const buyer = (o.BuyerInfo ?? {}) as Record<string, unknown>;
      const email = String(buyer.BuyerEmail ?? "");
      if (email && !byId.has(email)) {
        byId.set(email, { email, orders_count: 1 });
      }
    }
    return [...byId.values()];
  }
}
