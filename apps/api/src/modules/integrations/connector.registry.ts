import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IntegrationProvider } from "@churnify/shared";
import { CONNECTORS, type OAuthConnector } from "./connector.types";

@Injectable()
export class ConnectorRegistry {
  private readonly map = new Map<IntegrationProvider, OAuthConnector>();

  constructor(@Inject(CONNECTORS) connectors: OAuthConnector[]) {
    for (const connector of connectors) {
      this.map.set(connector.provider, connector);
    }
  }

  get(provider: IntegrationProvider): OAuthConnector {
    const connector = this.map.get(provider);
    if (!connector) {
      throw new NotFoundException(`Desteklenmeyen sağlayıcı: ${provider}`);
    }
    return connector;
  }

  has(provider: IntegrationProvider): boolean {
    return this.map.has(provider);
  }
}
