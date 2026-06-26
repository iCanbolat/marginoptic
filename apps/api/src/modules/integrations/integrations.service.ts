import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, ne } from "drizzle-orm";
import type { Redis } from "ioredis";
import {
  AD_PROVIDERS,
  type AdProvider,
  type ConnectionSummary,
  type IntegrationProvider,
  type IntegrationsOverview,
  type ProviderInfo,
  type SalesChannel,
  type SyncAllResult,
  type SyncAllStatus,
} from "@churnify/shared";
import { CryptoService } from "../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { REDIS } from "../../redis/redis.module";
import {
  integrationConnections,
  channels,
} from "../../database/schema/channels";
import { AdConnectorRegistry } from "./ads/ad-connector.registry";
import { AdsSyncService } from "../ads/ads-sync.service";
import { SyncService } from "../sync/sync.service";
import { ProductTrafficService } from "../tracking/product-traffic.service";
import { ConnectorRegistry } from "./connector.registry";
import { EbayConnector } from "./ebay/ebay.connector";
import { AmazonConnector } from "./amazon/amazon.connector";
import type { TokenSet } from "./connector.types";

const PROVIDER_CATALOG: Omit<ProviderInfo, "connectable">[] = [
  { provider: "shopify", label: "Shopify", kind: "channel" },
  { provider: "ebay", label: "eBay", kind: "channel" },
  { provider: "amazon", label: "Amazon", kind: "channel" },
  { provider: "meta_ads", label: "Meta Ads", kind: "ads" },
  { provider: "google_ads", label: "Google Ads", kind: "ads" },
  { provider: "tiktok_ads", label: "TikTok Ads", kind: "ads" },
  { provider: "amazon_ads", label: "Amazon Ads", kind: "ads" },
  { provider: "ebay_ads", label: "eBay Marketing", kind: "ads" },
];

const STATE_TTL_SECONDS = 600;

/** Tüm sağlayıcılardan tek-buton senkron cooldown'ı (15 dk). */
const SYNC_ALL_COOLDOWN_SECONDS = 900;
const syncAllCooldownKey = (storeId: string) => `sync:all:cooldown:${storeId}`;

interface OAuthState {
  storeId: string;
  shop: string;
  provider: IntegrationProvider;
}

interface AdOAuthState {
  storeId: string;
  channelId: string;
  provider: AdProvider;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly registry: ConnectorRegistry,
    private readonly adRegistry: AdConnectorRegistry,
    private readonly adsSync: AdsSyncService,
    private readonly sync: SyncService,
    private readonly traffic: ProductTrafficService,
    private readonly ebay: EbayConnector,
    private readonly amazon: AmazonConnector,
  ) {}

  async overview(storeId: string): Promise<IntegrationsOverview> {
    const rows = await this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.storeId, storeId))
      .orderBy(integrationConnections.createdAt);

    return {
      providers: PROVIDER_CATALOG.map((p) => ({
        ...p,
        connectable: this.isConnectable(p.provider),
      })),
      connections: rows.map(
        (r): ConnectionSummary => ({
          id: r.id,
          provider: r.provider,
          status: r.status,
          channelId: r.channelId,
          externalAccountId: r.externalAccountId,
          scopes: r.scopes,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
    };
  }

  /** Shopify OAuth başlat: state üret (Redis), authorize URL döndür. */
  async startShopifyInstall(storeId: string, shop: string): Promise<string> {
    if (!this.config.get<string>("SHOPIFY_API_KEY")) {
      throw new BadRequestException("Shopify yapılandırılmamış (SHOPIFY_API_KEY)");
    }
    const state = randomBytes(16).toString("hex");
    const payload: OAuthState = { storeId, shop, provider: "shopify" };
    await this.redis.set(
      `oauth:state:${state}`,
      JSON.stringify(payload),
      "EX",
      STATE_TTL_SECONDS,
    );
    return this.registry.get("shopify").buildAuthUrl({
      shop,
      state,
      redirectUri: this.shopifyRedirectUri(),
    });
  }

  /** Shopify callback: HMAC + state doğrula, token al, store+connection kaydet, sync başlat. */
  async completeShopifyCallback(
    query: Record<string, string>,
  ): Promise<string> {
    const connector = this.registry.get("shopify");
    const raw = query.state
      ? await this.redis.getdel(`oauth:state:${query.state}`)
      : null;
    if (!raw) {
      throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    }
    const state = JSON.parse(raw) as OAuthState;
    if (query.shop !== state.shop) {
      throw new BadRequestException("Shop alan adı uyuşmuyor");
    }
    if (!connector.verifyCallbackHmac(query)) {
      throw new UnauthorizedException("HMAC doğrulanamadı");
    }

    const tokens = await connector.exchangeCode({
      shop: state.shop,
      code: query.code,
      redirectUri: this.shopifyRedirectUri(),
    });

    const { channelId, connectionId } = await this.persistConnection(
      state.storeId,
      "shopify",
      "shopify",
      state.shop,
      tokens,
    );

    await connector
      .registerWebhooks({
        shop: state.shop,
        accessToken: tokens.accessToken,
        callbackBaseUrl: this.config.getOrThrow<string>("APP_URL"),
      })
      .catch(() => undefined);

    await this.sync.enqueueShopifyBackfill({
      connectionId,
      channelId,
      shop: state.shop,
    });

    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/integrations?connected=shopify`;
  }

  /** Dev-only: gerçek Shopify olmadan bağlantı simülasyonu (pipeline doğrulaması). */
  async devConnectShopify(
    storeId: string,
    shop: string,
  ): Promise<{ channelId: string; connectionId: string }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      scopes: this.config.get<string>("SHOPIFY_SCOPES") ?? null,
      externalAccountId: shop,
    };
    const { channelId, connectionId } = await this.persistConnection(
      storeId,
      "shopify",
      "shopify",
      shop,
      tokens,
    );
    await this.sync.enqueueShopifyBackfill({ connectionId, channelId, shop });
    return { channelId, connectionId };
  }

  // ---- eBay OAuth2 (Faz 10) ----

  /** eBay OAuth başlat: state üret (Redis), authorize URL döndür. */
  async startEbayInstall(storeId: string): Promise<string> {
    if (!this.ebay.isConfigured()) {
      throw new BadRequestException("eBay yapılandırılmamış (EBAY_CLIENT_ID)");
    }
    const state = randomBytes(16).toString("hex");
    await this.redis.set(
      `oauth:ebay:state:${state}`,
      JSON.stringify({ storeId }),
      "EX",
      STATE_TTL_SECONDS,
    );
    return this.ebay.buildAuthUrl({
      state,
      redirectUri: this.ebayRedirectUri(),
    });
  }

  /** eBay callback: state doğrula, token al, satıcı çöz, kaydet, backfill başlat. */
  async completeEbayCallback(query: Record<string, string>): Promise<string> {
    const raw = query.state
      ? await this.redis.getdel(`oauth:ebay:state:${query.state}`)
      : null;
    if (!raw) throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    const { storeId } = JSON.parse(raw) as { storeId: string };
    if (!query.code) throw new BadRequestException("Yetkilendirme kodu yok");

    const tokens = await this.ebay.exchangeCode({
      code: query.code,
      redirectUri: this.ebayRedirectUri(),
    });
    const seller = await this.ebay.fetchSeller(tokens.accessToken);

    const { channelId, connectionId } = await this.persistConnection(
      storeId,
      "ebay",
      "ebay",
      seller.sellerName,
      { ...tokens, externalAccountId: seller.sellerId },
    );
    await this.sync.enqueueEbayBackfill({
      connectionId,
      channelId,
      shopId: seller.sellerId,
    });
    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/integrations?connected=ebay`;
  }

  /** Dev-only: gerçek eBay olmadan bağlantı simülasyonu (sentetik pipeline). */
  async devConnectEbay(
    storeId: string,
    shop: string,
  ): Promise<{ channelId: string; connectionId: string }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      externalAccountId: shop,
      scopes: this.config.get<string>("EBAY_SCOPES") ?? null,
    };
    const { channelId, connectionId } = await this.persistConnection(
      storeId,
      "ebay",
      "ebay",
      shop,
      tokens,
    );
    await this.sync.enqueueEbayBackfill({ connectionId, channelId, shopId: shop });
    return { channelId, connectionId };
  }

  private ebayRedirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/ebay/callback`;
  }

  // ---- Amazon SP-API / LWA (Faz 10) ----

  /** Amazon OAuth başlat: state üret (Redis), Seller Central consent URL döndür. */
  async startAmazonInstall(storeId: string): Promise<string> {
    if (!this.amazon.isConfigured()) {
      throw new BadRequestException("Amazon yapılandırılmamış (AMAZON_LWA_CLIENT_ID)");
    }
    const state = randomBytes(16).toString("hex");
    await this.redis.set(
      `oauth:amazon:state:${state}`,
      JSON.stringify({ storeId }),
      "EX",
      STATE_TTL_SECONDS,
    );
    return this.amazon.buildAuthUrl({
      state,
      redirectUri: this.amazonRedirectUri(),
    });
  }

  /** Amazon callback: state doğrula, token al, satıcı çöz, kaydet, backfill başlat. */
  async completeAmazonCallback(query: Record<string, string>): Promise<string> {
    const raw = query.state
      ? await this.redis.getdel(`oauth:amazon:state:${query.state}`)
      : null;
    if (!raw) throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    const { storeId } = JSON.parse(raw) as { storeId: string };
    // Amazon yetki kodunu `spapi_oauth_code` query parametresiyle döndürür.
    const code = query.spapi_oauth_code ?? query.code;
    if (!code) throw new BadRequestException("Yetkilendirme kodu yok");

    const tokens = await this.amazon.exchangeCode({
      code,
      redirectUri: this.amazonRedirectUri(),
    });
    const seller = await this.amazon.fetchSeller(tokens.accessToken);

    const { channelId, connectionId } = await this.persistConnection(
      storeId,
      "amazon",
      "amazon",
      seller.sellerName,
      { ...tokens, externalAccountId: seller.sellerId },
    );
    await this.sync.enqueueAmazonBackfill({
      connectionId,
      channelId,
      shopId: seller.sellerId,
    });
    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/integrations?connected=amazon`;
  }

  /** Dev-only: gerçek Amazon olmadan bağlantı simülasyonu (sentetik pipeline). */
  async devConnectAmazon(
    storeId: string,
    shop: string,
  ): Promise<{ channelId: string; connectionId: string }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      externalAccountId: shop,
      scopes: this.config.get<string>("AMAZON_SCOPES") ?? null,
    };
    const { channelId, connectionId } = await this.persistConnection(
      storeId,
      "amazon",
      "amazon",
      shop,
      tokens,
    );
    await this.sync.enqueueAmazonBackfill({ connectionId, channelId, shopId: shop });
    return { channelId, connectionId };
  }

  private amazonRedirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/amazon/callback`;
  }

  // ---- Reklam hesabı bağlama (Faz 6) ----

  private isAdProvider(provider: IntegrationProvider): provider is AdProvider {
    return (AD_PROVIDERS as readonly string[]).includes(provider);
  }

  private isConnectable(provider: IntegrationProvider): boolean {
    if (this.isAdProvider(provider)) return this.adRegistry.has(provider);
    // eBay: canlı OAuth yapılandırıldıysa ya da non-prod (dev-connect mevcut).
    if (provider === "ebay") {
      return this.ebay.isConfigured() || this.config.get("NODE_ENV") !== "production";
    }
    // Amazon: canlı OAuth yapılandırıldıysa ya da non-prod (dev-connect mevcut).
    if (provider === "amazon") {
      return this.amazon.isConfigured() || this.config.get("NODE_ENV") !== "production";
    }
    return this.registry.has(provider);
  }

  /** Reklam OAuth başlat: state üret (Redis), authorize URL döndür. */
  async startAdInstall(
    storeId: string,
    provider: AdProvider,
    channelId: string,
  ): Promise<string> {
    await this.assertStoreOwned(storeId, channelId);
    const connector = this.adRegistry.get(provider);
    if (!connector.isConfigured()) {
      throw new BadRequestException(`${provider} yapılandırılmamış`);
    }
    const state = randomBytes(16).toString("hex");
    const payload: AdOAuthState = { storeId, channelId, provider };
    await this.redis.set(
      `oauth:ad:state:${state}`,
      JSON.stringify(payload),
      "EX",
      STATE_TTL_SECONDS,
    );
    return connector.buildAuthUrl({
      state,
      redirectUri: this.adRedirectUri(provider),
    });
  }

  /** Reklam OAuth callback: state doğrula, token al, bağlantı kaydet, senkron başlat. */
  async completeAdCallback(
    provider: AdProvider,
    query: Record<string, string>,
  ): Promise<string> {
    const raw = query.state
      ? await this.redis.getdel(`oauth:ad:state:${query.state}`)
      : null;
    if (!raw) throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    const state = JSON.parse(raw) as AdOAuthState;
    if (state.provider !== provider) {
      throw new BadRequestException("Sağlayıcı uyuşmuyor");
    }

    const connector = this.adRegistry.get(provider);
    const tokens = await connector.exchangeCode({
      code: query.code,
      redirectUri: this.adRedirectUri(provider),
    });
    const externalAccountId =
      tokens.externalAccountId ?? query.account_id ?? null;
    if (!externalAccountId) {
      throw new BadRequestException("Reklam hesabı kimliği belirlenemedi");
    }

    const { connectionId } = await this.persistAdConnection(
      state.storeId,
      provider,
      state.channelId,
      externalAccountId,
      tokens,
    );
    await this.adsSync.enqueueBackfill({
      connectionId,
      channelId: state.channelId,
      provider,
      externalAccountId,
    });
    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/ads?connected=${provider}`;
  }

  /** Dev-only: gerçek reklam OAuth'u olmadan bağlantı simülasyonu (sentetik pipeline). */
  async devConnectAd(
    storeId: string,
    provider: AdProvider,
    channelId: string,
    externalAccountId: string,
  ): Promise<{ connectionId: string; provider: AdProvider }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    await this.assertStoreOwned(storeId, channelId);
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      externalAccountId,
    };
    const { connectionId } = await this.persistAdConnection(
      storeId,
      provider,
      channelId,
      externalAccountId,
      tokens,
    );
    await this.adsSync.enqueueBackfill({
      connectionId,
      channelId,
      provider,
      externalAccountId,
    });
    return { connectionId, provider };
  }

  private adRedirectUri(provider: AdProvider): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/ads/${provider}/callback`;
  }

  private async assertStoreOwned(storeId: string, channelId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
  }

  private async persistAdConnection(
    storeId: string,
    provider: AdProvider,
    channelId: string,
    externalAccountId: string,
    tokens: TokenSet,
  ): Promise<{ connectionId: string }> {
    const [connection] = await this.db
      .insert(integrationConnections)
      .values({
        storeId: storeId,
        channelId,
        provider,
        status: "active",
        accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken
          ? this.crypto.encrypt(tokens.refreshToken)
          : null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes ?? null,
        externalAccountId,
        metadata: tokens.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [
          integrationConnections.storeId,
          integrationConnections.provider,
          integrationConnections.externalAccountId,
        ],
        set: {
          channelId,
          status: "active",
          accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
          refreshTokenEnc: tokens.refreshToken
            ? this.crypto.encrypt(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt ?? null,
          scopes: tokens.scopes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: integrationConnections.id });
    return { connectionId: connection!.id };
  }

  async ingestShopifyWebhook(args: {
    raw: Buffer | undefined;
    hmac?: string;
    topic?: string;
    shop?: string;
    eventId?: string;
  }): Promise<void> {
    const connector = this.registry.get("shopify");
    if (!args.raw || !connector.verifyWebhookHmac(args.raw, args.hmac)) {
      throw new UnauthorizedException("HMAC doğrulanamadı");
    }
    const payload = JSON.parse(args.raw.toString("utf8")) as unknown;
    await this.sync.enqueueWebhook({
      provider: "shopify",
      topic: args.topic ?? "unknown",
      shop: args.shop ?? "unknown",
      payload,
      eventId: args.eventId,
    });
  }

  async disconnect(storeId: string, connectionId: string): Promise<void> {
    const [conn] = await this.db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.storeId, storeId),
          eq(integrationConnections.id, connectionId),
        ),
      )
      .limit(1);
    if (!conn) throw new NotFoundException("Bağlantı bulunamadı");

    await this.db
      .update(integrationConnections)
      .set({
        status: "disconnected",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId));

    if (conn.channelId) {
      await this.db
        .update(channels)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(eq(channels.id, conn.channelId));
    }
  }

  // ---- Tüm sağlayıcılardan tek-buton senkron (+ cooldown) ----

  /** Cooldown durumu (sayfa ilk yüklemede butonu doğru göstermek için). */
  async syncAllStatus(storeId: string): Promise<SyncAllStatus> {
    const ttl = await this.redis.ttl(syncAllCooldownKey(storeId));
    if (ttl > 0) {
      return {
        onCooldown: true,
        nextAvailableAt: new Date(Date.now() + ttl * 1000).toISOString(),
        cooldownSeconds: SYNC_ALL_COOLDOWN_SECONDS,
      };
    }
    return {
      onCooldown: false,
      nextAvailableAt: null,
      cooldownSeconds: SYNC_ALL_COOLDOWN_SECONDS,
    };
  }

  /**
   * Org'un tüm aktif bağlantılarını senkronlar: satış kanalları (backfill +
   * rollup zinciri), reklam hesapları (ads backfill) ve marketplace traffic.
   * 15 dk cooldown uygulanır; cooldown aktifse iş kuyruğa alınmaz (triggered=false).
   */
  async syncAllForOrg(storeId: string): Promise<SyncAllResult> {
    const key = syncAllCooldownKey(storeId);
    const ttl = await this.redis.ttl(key);
    if (ttl > 0) {
      return {
        triggered: false,
        nextAvailableAt: new Date(Date.now() + ttl * 1000).toISOString(),
        cooldownSeconds: SYNC_ALL_COOLDOWN_SECONDS,
        queued: { salesConnections: 0, adConnections: 0, trafficStores: 0 },
      };
    }

    const conns = await this.db
      .select({
        id: integrationConnections.id,
        provider: integrationConnections.provider,
        channelId: integrationConnections.channelId,
        externalAccountId: integrationConnections.externalAccountId,
      })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.storeId, storeId),
          eq(integrationConnections.status, "active"),
        ),
      );

    let salesConnections = 0;
    let adConnections = 0;
    const marketplaceStores = new Set<string>();

    for (const c of conns) {
      if (!c.channelId) continue;
      const account = c.externalAccountId ?? "";
      if (this.isAdProvider(c.provider)) {
        await this.adsSync.enqueueBackfill({
          connectionId: c.id,
          channelId: c.channelId,
          provider: c.provider,
          externalAccountId: account,
        });
        adConnections += 1;
        continue;
      }
      switch (c.provider) {
        case "shopify":
          await this.sync.enqueueShopifyBackfill({
            connectionId: c.id,
            channelId: c.channelId,
            shop: account,
          });
          break;
        case "ebay":
          await this.sync.enqueueEbayBackfill({
            connectionId: c.id,
            channelId: c.channelId,
            shopId: account,
          });
          marketplaceStores.add(c.channelId);
          break;
        case "amazon":
          await this.sync.enqueueAmazonBackfill({
            connectionId: c.id,
            channelId: c.channelId,
            shopId: account,
          });
          marketplaceStores.add(c.channelId);
          break;
        default:
          continue;
      }
      salesConnections += 1;
    }

    // Marketplace (Amazon/eBay) ürün-traffic'ini yenile (conversion kartı için).
    for (const channelId of marketplaceStores) {
      await this.traffic.syncMarketplaceTraffic(channelId);
    }

    // Cooldown'ı ayarla (15 dk).
    await this.redis.set(key, new Date().toISOString(), "EX", SYNC_ALL_COOLDOWN_SECONDS);

    return {
      triggered: true,
      nextAvailableAt: new Date(
        Date.now() + SYNC_ALL_COOLDOWN_SECONDS * 1000,
      ).toISOString(),
      cooldownSeconds: SYNC_ALL_COOLDOWN_SECONDS,
      queued: {
        salesConnections,
        adConnections,
        trafficStores: marketplaceStores.size,
      },
    };
  }

  private shopifyRedirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/shopify/callback`;
  }

  private async persistConnection(
    storeId: string,
    channel: SalesChannel,
    provider: IntegrationProvider,
    shop: string,
    tokens: TokenSet,
  ): Promise<{ channelId: string; connectionId: string }> {
    return this.db.transaction(async (tx) => {
      // Store başına kanal-tekilliği: aynı kanal yeniden bağlanırsa üzerine yazılır.
      const [store] = await tx
        .insert(channels)
        .values({
          storeId: storeId,
          channel,
          name: shop.replace(/\.myshopify\.com$/, ""),
          externalShopId: shop,
          domain: shop,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [channels.storeId, channels.channel],
          set: {
            name: shop.replace(/\.myshopify\.com$/, ""),
            externalShopId: shop,
            domain: shop,
            status: "active",
            updatedAt: new Date(),
          },
        })
        .returning({ id: channels.id });

      const [connection] = await tx
        .insert(integrationConnections)
        .values({
          storeId: storeId,
          channelId: store.id,
          provider,
          status: "active",
          accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
          refreshTokenEnc: tokens.refreshToken
            ? this.crypto.encrypt(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresAt ?? null,
          scopes: tokens.scopes ?? null,
          externalAccountId: tokens.externalAccountId ?? shop,
          metadata: tokens.metadata ?? {},
        })
        .onConflictDoUpdate({
          target: [
            integrationConnections.storeId,
            integrationConnections.provider,
            integrationConnections.externalAccountId,
          ],
          set: {
            channelId: store.id,
            status: "active",
            accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
            scopes: tokens.scopes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: integrationConnections.id });

      // Store başına kanal-tekilliği: aynı kanalın (farklı hesap/domain ile bağlanmış)
      // bayat bağlantılarını temizle — overview'da tek aktif kanal kalsın.
      await tx
        .delete(integrationConnections)
        .where(
          and(
            eq(integrationConnections.channelId, store.id),
            eq(integrationConnections.provider, provider),
            ne(integrationConnections.id, connection.id),
          ),
        );

      return { channelId: store.id, connectionId: connection.id };
    });
  }
}
