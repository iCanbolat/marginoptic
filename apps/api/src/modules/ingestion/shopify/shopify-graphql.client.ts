import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: { cost?: { throttleStatus?: ThrottleStatus } };
}

const MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Shopify Admin GraphQL istemcisi — maliyet-duyarlı throttle.
 * Her yanıttaki `extensions.cost.throttleStatus`'u izler; kullanılabilir puan
 * azaldığında veya `THROTTLED` hatasında `restoreRate`'e göre bekleyip tekrar dener.
 */
@Injectable()
export class ShopifyGraphqlClient {
  private readonly logger = new Logger(ShopifyGraphqlClient.name);
  private readonly throttle = new Map<string, ThrottleStatus>();

  constructor(private readonly config: ConfigService) {}

  private endpoint(shop: string): string {
    const version = this.config.getOrThrow<string>("SHOPIFY_API_VERSION");
    return `https://${shop}/admin/api/${version}/graphql.json`;
  }

  async query<T>(
    shop: string,
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await this.awaitCapacity(shop);

      const res = await fetch(this.endpoint(shop), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        await this.backoff(shop, attempt);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Shopify GraphQL HTTP ${res.status}`);
      }

      const body = (await res.json()) as GraphqlResponse<T>;
      const status = body.extensions?.cost?.throttleStatus;
      if (status) this.throttle.set(shop, status);

      const throttled = body.errors?.some(
        (e) => e.extensions?.code === "THROTTLED",
      );
      if (throttled) {
        await this.backoff(shop, attempt);
        continue;
      }
      if (body.errors?.length) {
        throw new Error(
          `Shopify GraphQL hata: ${body.errors.map((e) => e.message).join("; ")}`,
        );
      }
      if (!body.data) throw new Error("Shopify GraphQL boş yanıt");
      return body.data;
    }
    throw new Error(`Shopify GraphQL throttle: ${MAX_RETRIES} deneme aşıldı`);
  }

  /** Bilinen throttle durumuna göre yeterli puan birikene kadar bekler. */
  private async awaitCapacity(shop: string): Promise<void> {
    const status = this.throttle.get(shop);
    if (!status) return;
    // ~%10 tampon: kullanılabilir puan çok düşükse kısa bekle.
    const buffer = status.maximumAvailable * 0.1;
    if (status.currentlyAvailable >= buffer || status.restoreRate <= 0) return;
    const waitMs = ((buffer - status.currentlyAvailable) / status.restoreRate) * 1000;
    await sleep(Math.min(waitMs, 5000));
  }

  private async backoff(shop: string, attempt: number): Promise<void> {
    const status = this.throttle.get(shop);
    const base = status?.restoreRate
      ? (status.maximumAvailable / status.restoreRate) * 1000
      : 1000;
    const waitMs = Math.min(base * (attempt + 1), 10_000);
    this.logger.warn(`${shop} throttle — ${Math.round(waitMs)}ms bekleniyor`);
    await sleep(waitMs);
  }
}
