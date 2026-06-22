import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_TOKEN_REFRESH } from "../sync.constants";

@Processor(QUEUE_TOKEN_REFRESH)
export class TokenRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(TokenRefreshProcessor.name);

  process(): Promise<void> {
    // FAZ 6: süresi dolmak üzere olan reklam (Meta/Google/TikTok) token'larını
    // yenile. Shopify offline access token'ları süresizdir.
    this.logger.debug("token-refresh taraması (Faz 6'da uygulanacak)");
    return Promise.resolve();
  }
}
