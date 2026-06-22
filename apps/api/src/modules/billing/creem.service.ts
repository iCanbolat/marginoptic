import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PlanId } from "@churnify/shared";

/** Creem hosted checkout oluşturma girdisi. */
export interface CreemCheckoutInput {
  productId: string;
  successUrl: string;
  email: string;
  /** İzleme/idempotency kimliği — webhook'ta geri döner (biz orgId yazarız). */
  requestId: string;
  metadata: Record<string, string>;
}

/**
 * Faz 9 — creem.io REST istemcisi (ince sarmalayıcı).
 *
 * `CREEM_API_KEY` boşsa **dev sentetik** moddur: gerçek HTTP yapılmaz; çağıranlar
 * `isConfigured` ile bunu kontrol edip dev akışına (dev-activate) düşer.
 */
@Injectable()
export class CreemService {
  private readonly logger = new Logger(CreemService.name);

  constructor(private readonly config: ConfigService) {}

  /** Creem anahtarı tanımlı mı (canlı mod). Değilse dev sentetik akış kullanılır. */
  get isConfigured(): boolean {
    return this.config.get<string>("CREEM_API_KEY", "").length > 0;
  }

  private get baseUrl(): string {
    return this.config.get<string>("CREEM_API_URL", "https://api.creem.io").replace(/\/$/, "");
  }

  private get apiKey(): string {
    return this.config.get<string>("CREEM_API_KEY", "");
  }

  /** Plan → Creem ürün kimliği (env'den). */
  productIdForPlan(plan: PlanId): string {
    const id = this.config.get<string>(
      plan === "pro" ? "CREEM_PRODUCT_PRO" : "CREEM_PRODUCT_BASIC",
      "",
    );
    return id;
  }

  /** Creem ürün kimliği → plan (ters eşleme); eşleşmezse null. */
  planForProductId(productId: string | null | undefined): PlanId | null {
    if (!productId) return null;
    if (productId === this.config.get<string>("CREEM_PRODUCT_PRO", "")) return "pro";
    if (productId === this.config.get<string>("CREEM_PRODUCT_BASIC", "")) return "basic";
    return null;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.error(`Creem ${path} ${res.status}: ${text}`);
      throw new Error(`Creem isteği başarısız (${res.status})`);
    }
    return (await res.json()) as T;
  }

  /** Hosted checkout oturumu oluştur → ödeme URL'i. */
  async createCheckout(input: CreemCheckoutInput): Promise<{ id: string; checkoutUrl: string }> {
    const data = await this.request<{ id: string; checkout_url: string }>("/v1/checkouts", {
      product_id: input.productId,
      success_url: input.successUrl,
      request_id: input.requestId,
      customer: { email: input.email },
      metadata: input.metadata,
    });
    return { id: data.id, checkoutUrl: data.checkout_url };
  }

  /** Müşteri portalı linki (abonelik/ödeme yönetimi). */
  async createPortalLink(customerId: string): Promise<string> {
    const data = await this.request<{
      customer_portal_link?: string;
      billing_portal_url?: string;
    }>("/v1/customers/billing", { customer_id: customerId });
    const url = data.customer_portal_link ?? data.billing_portal_url;
    if (!url) throw new Error("Creem portal linki alınamadı");
    return url;
  }

  /**
   * Webhook imzasını doğrula: `creem-signature` = HMAC-SHA256(rawBody, secret) hex.
   * Secret tanımlı değilse (dev) doğrulama atlanır → true.
   */
  verifyWebhookSignature(raw: Buffer | string | undefined, signature: string | undefined): boolean {
    const secret = this.config.get<string>("CREEM_WEBHOOK_SECRET", "");
    if (!secret) return true; // dev: imza doğrulaması yok
    if (!raw || !signature) return false;
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
