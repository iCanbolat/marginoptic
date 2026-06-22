import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * OAuth token'ları gibi gizli verileri AES-256-GCM ile şifreler.
 * Çıktı biçimi: base64(iv):base64(authTag):base64(ciphertext)
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = Buffer.from(
      config.getOrThrow<string>("TOKEN_ENCRYPTION_KEY"),
      "hex",
    );
    if (this.key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY 32 byte (64 hex karakter) olmalı");
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":");
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error("Bozuk şifreli veri biçimi");
    }
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  /** Zamanlama-güvenli string karşılaştırma (HMAC doğrulamada kullanılır). */
  static safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
