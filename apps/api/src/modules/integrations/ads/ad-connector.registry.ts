import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdProvider } from "@churnify/shared";
import { AD_CONNECTORS, type AdConnector } from "./ad-connector.types";

@Injectable()
export class AdConnectorRegistry {
  private readonly map = new Map<AdProvider, AdConnector>();

  constructor(@Inject(AD_CONNECTORS) connectors: AdConnector[]) {
    for (const connector of connectors) {
      this.map.set(connector.provider, connector);
    }
  }

  get(provider: AdProvider): AdConnector {
    const connector = this.map.get(provider);
    if (!connector) {
      throw new NotFoundException(`Desteklenmeyen reklam sağlayıcı: ${provider}`);
    }
    return connector;
  }

  has(provider: AdProvider): boolean {
    return this.map.has(provider);
  }
}
