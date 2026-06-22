import type { IntegrationProvider } from "@churnify/shared";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string | null;
  externalAccountId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BuildAuthUrlParams {
  shop: string;
  state: string;
  redirectUri: string;
}

export interface ExchangeCodeParams {
  shop: string;
  code: string;
  redirectUri: string;
}

export interface RegisterWebhooksParams {
  shop: string;
  accessToken: string;
  callbackBaseUrl: string;
}

/** Tüm OAuth tabanlı sağlayıcıların (Shopify, ileride Meta/Google/TikTok) sözleşmesi. */
export interface OAuthConnector {
  readonly provider: IntegrationProvider;
  buildAuthUrl(params: BuildAuthUrlParams): string;
  exchangeCode(params: ExchangeCodeParams): Promise<TokenSet>;
  verifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined): boolean;
  verifyCallbackHmac(query: Record<string, string>): boolean;
  registerWebhooks(params: RegisterWebhooksParams): Promise<void>;
}

/** DI token'ı: tüm connector'ların listesi. */
export const CONNECTORS = Symbol("CONNECTORS");
