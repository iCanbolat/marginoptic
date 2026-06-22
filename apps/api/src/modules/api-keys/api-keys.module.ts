import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";

/**
 * Faz 8 — MCP API key'leri. CRUD (owner/admin) + ham-anahtar doğrulama.
 * `ApiKeysService.verify` MCP modülünce (auth) yeniden kullanılır.
 */
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
