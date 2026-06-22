import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import {
  AD_PROVIDERS,
  type AdProvider,
  type ConnectionSummary,
  type IntegrationProvider,
  type IntegrationsOverview,
  type ProviderInfo,
  type SalesChannel,
} from "@churnify/shared";
import { CryptoService } from "../../common/crypto/crypto.service";
import { DRIZZLE, type DrizzleDB } from "../../database/database.module";
import { REDIS } from "../../redis/redis.module";
import {
  integrationConnections,
  stores,
} from "../../database/schema/stores";
import { AdConnectorRegistry } from "./ads/ad-connector.registry";
import { AdsSyncService } from "../ads/ads-sync.service";
import { SyncService } from "../sync/sync.service";
import { BillingService } from "../billing/billing.service";
import { ConnectorRegistry } from "./connector.registry";
import { EtsyConnector } from "./etsy/etsy.connector";
import type { TokenSet } from "./connector.types";

const PROVIDER_CATALOG: Omit<ProviderInfo, "connectable">[] = [
  { provider: "shopify", label: "Shopify", kind: "channel" },
  { provider: "etsy", label: "Etsy", kind: "channel" },
  { provider: "meta_ads", label: "Meta Ads", kind: "ads" },
  { provider: "google_ads", label: "Google Ads", kind: "ads" },
  { provider: "tiktok_ads", label: "TikTok Ads", kind: "ads" },
];

const STATE_TTL_SECONDS = 600;

interface OAuthState {
  orgId: string;
  shop: string;
  provider: IntegrationProvider;
}

interface AdOAuthState {
  orgId: string;
  storeId: string;
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
    private readonly billing: BillingService,
    private readonly etsy: EtsyConnector,
  ) {}

  async overview(orgId: string): Promise<IntegrationsOverview> {
    const rows = await this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.organizationId, orgId))
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
          storeId: r.storeId,
          externalAccountId: r.externalAccountId,
          scopes: r.scopes,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
    };
  }

  /** Shopify OAuth başlat: state üret (Redis), authorize URL döndür. */
  async startShopifyInstall(orgId: string, shop: string): Promise<string> {
    if (!this.config.get<string>("SHOPIFY_API_KEY")) {
      throw new BadRequestException("Shopify yapılandırılmamış (SHOPIFY_API_KEY)");
    }
    const state = randomBytes(16).toString("hex");
    const payload: OAuthState = { orgId, shop, provider: "shopify" };
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

    const { storeId, connectionId } = await this.persistConnection(
      state.orgId,
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
      storeId,
      shop: state.shop,
    });

    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/integrations?connected=shopify`;
  }

  /** Dev-only: gerçek Shopify olmadan bağlantı simülasyonu (pipeline doğrulaması). */
  async devConnectShopify(
    orgId: string,
    shop: string,
  ): Promise<{ storeId: string; connectionId: string }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      scopes: this.config.get<string>("SHOPIFY_SCOPES") ?? null,
      externalAccountId: shop,
    };
    const { storeId, connectionId } = await this.persistConnection(
      orgId,
      "shopify",
      "shopify",
      shop,
      tokens,
    );
    await this.sync.enqueueShopifyBackfill({ connectionId, storeId, shop });
    return { storeId, connectionId };
  }

  // ---- Etsy OAuth2 PKCE (Faz 9) ----

  /** Etsy OAuth başlat: PKCE üret, verifier+state Redis'te, authorize URL döndür. */
  async startEtsyInstall(orgId: string): Promise<string> {
    if (!this.etsy.isConfigured()) {
      throw new BadRequestException("Etsy yapılandırılmamış (ETSY_API_KEY)");
    }
    const state = randomBytes(16).toString("hex");
    const pkce = EtsyConnector.generatePkce();
    await this.redis.set(
      `oauth:etsy:state:${state}`,
      JSON.stringify({ orgId, verifier: pkce.verifier }),
      "EX",
      STATE_TTL_SECONDS,
    );
    return this.etsy.buildAuthUrl({
      state,
      challenge: pkce.challenge,
      redirectUri: this.etsyRedirectUri(),
    });
  }

  /** Etsy callback: state+verifier doğrula, token al, mağaza çöz, kaydet, backfill başlat. */
  async completeEtsyCallback(query: Record<string, string>): Promise<string> {
    const raw = query.state
      ? await this.redis.getdel(`oauth:etsy:state:${query.state}`)
      : null;
    if (!raw) throw new BadRequestException("Geçersiz veya süresi dolmuş state");
    const { orgId, verifier } = JSON.parse(raw) as {
      orgId: string;
      verifier: string;
    };
    if (!query.code) throw new BadRequestException("Yetkilendirme kodu yok");

    const tokens = await this.etsy.exchangeCode({
      code: query.code,
      verifier,
      redirectUri: this.etsyRedirectUri(),
    });
    const shop = await this.etsy.fetchShop(tokens.accessToken);

    const { storeId, connectionId } = await this.persistConnection(
      orgId,
      "etsy",
      "etsy",
      shop.shopName,
      { ...tokens, externalAccountId: shop.shopId },
    );
    await this.sync.enqueueEtsyBackfill({
      connectionId,
      storeId,
      shopId: shop.shopId,
    });
    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/integrations?connected=etsy`;
  }

  /** Dev-only: gerçek Etsy olmadan bağlantı simülasyonu (sentetik pipeline). */
  async devConnectEtsy(
    orgId: string,
    shop: string,
  ): Promise<{ storeId: string; connectionId: string }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      externalAccountId: shop,
      scopes: "transactions_r listings_r shops_r",
    };
    const { storeId, connectionId } = await this.persistConnection(
      orgId,
      "etsy",
      "etsy",
      shop,
      tokens,
    );
    await this.sync.enqueueEtsyBackfill({ connectionId, storeId, shopId: shop });
    return { storeId, connectionId };
  }

  private etsyRedirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/etsy/callback`;
  }

  // ---- Reklam hesabı bağlama (Faz 6) ----

  private isAdProvider(provider: IntegrationProvider): provider is AdProvider {
    return (AD_PROVIDERS as readonly string[]).includes(provider);
  }

  private isConnectable(provider: IntegrationProvider): boolean {
    if (this.isAdProvider(provider)) return this.adRegistry.has(provider);
    // Etsy: canlı OAuth yapılandırıldıysa ya da non-prod (dev-connect mevcut).
    if (provider === "etsy") {
      return this.etsy.isConfigured() || this.config.get("NODE_ENV") !== "production";
    }
    return this.registry.has(provider);
  }

  /** Reklam OAuth başlat: state üret (Redis), authorize URL döndür. */
  async startAdInstall(
    orgId: string,
    provider: AdProvider,
    storeId: string,
  ): Promise<string> {
    await this.assertStoreOwned(orgId, storeId);
    const connector = this.adRegistry.get(provider);
    if (!connector.isConfigured()) {
      throw new BadRequestException(`${provider} yapılandırılmamış`);
    }
    const state = randomBytes(16).toString("hex");
    const payload: AdOAuthState = { orgId, storeId, provider };
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
      state.orgId,
      provider,
      state.storeId,
      externalAccountId,
      tokens,
    );
    await this.adsSync.enqueueBackfill({
      connectionId,
      storeId: state.storeId,
      provider,
      externalAccountId,
    });
    return `${this.config.getOrThrow<string>("WEB_ORIGIN")}/ads?connected=${provider}`;
  }

  /** Dev-only: gerçek reklam OAuth'u olmadan bağlantı simülasyonu (sentetik pipeline). */
  async devConnectAd(
    orgId: string,
    provider: AdProvider,
    storeId: string,
    externalAccountId: string,
  ): Promise<{ connectionId: string; provider: AdProvider }> {
    if (this.config.get("NODE_ENV") === "production") {
      throw new NotFoundException();
    }
    await this.assertStoreOwned(orgId, storeId);
    const tokens: TokenSet = {
      accessToken: `dev_${randomBytes(12).toString("hex")}`,
      externalAccountId,
    };
    const { connectionId } = await this.persistAdConnection(
      orgId,
      provider,
      storeId,
      externalAccountId,
      tokens,
    );
    await this.adsSync.enqueueBackfill({
      connectionId,
      storeId,
      provider,
      externalAccountId,
    });
    return { connectionId, provider };
  }

  private adRedirectUri(provider: AdProvider): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/ads/${provider}/callback`;
  }

  private async assertStoreOwned(orgId: string, storeId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.organizationId, orgId)))
      .limit(1);
    if (!row) throw new NotFoundException("Mağaza bulunamadı");
  }

  private async persistAdConnection(
    orgId: string,
    provider: AdProvider,
    storeId: string,
    externalAccountId: string,
    tokens: TokenSet,
  ): Promise<{ connectionId: string }> {
    const [connection] = await this.db
      .insert(integrationConnections)
      .values({
        organizationId: orgId,
        storeId,
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
          integrationConnections.organizationId,
          integrationConnections.provider,
          integrationConnections.externalAccountId,
        ],
        set: {
          storeId,
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

  async disconnect(orgId: string, connectionId: string): Promise<void> {
    const [conn] = await this.db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, orgId),
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

    if (conn.storeId) {
      await this.db
        .update(stores)
        .set({ status: "disconnected", updatedAt: new Date() })
        .where(eq(stores.id, conn.storeId));
    }
  }

  private shopifyRedirectUri(): string {
    return `${this.config.getOrThrow<string>("APP_URL")}/api/integrations/shopify/callback`;
  }

  private async persistConnection(
    orgId: string,
    channel: SalesChannel,
    provider: IntegrationProvider,
    shop: string,
    tokens: TokenSet,
  ): Promise<{ storeId: string; connectionId: string }> {
    // Plan gating: yeni mağaza limiti aşılıyorsa 403 (reconnect muaf).
    await this.billing.assertCanAddStore(orgId, shop);
    return this.db.transaction(async (tx) => {
      const [store] = await tx
        .insert(stores)
        .values({
          organizationId: orgId,
          channel,
          name: shop.replace(/\.myshopify\.com$/, ""),
          externalShopId: shop,
          domain: shop,
          status: "active",
        })
        .onConflictDoUpdate({
          target: [stores.organizationId, stores.channel, stores.externalShopId],
          set: { status: "active", updatedAt: new Date() },
        })
        .returning({ id: stores.id });

      const [connection] = await tx
        .insert(integrationConnections)
        .values({
          organizationId: orgId,
          storeId: store.id,
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
            integrationConnections.organizationId,
            integrationConnections.provider,
            integrationConnections.externalAccountId,
          ],
          set: {
            storeId: store.id,
            status: "active",
            accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
            scopes: tokens.scopes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: integrationConnections.id });

      return { storeId: store.id, connectionId: connection.id };
    });
  }
}
