import { generateApiKey, hashApiKey } from "./api-key.crypto";

describe("api-key.crypto", () => {
  it("üretilen anahtar 'chk_' önekiyle başlar (shared MCP_KEY_PREFIX)", () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith("chk_")).toBe(true);
  });

  it("keyPrefix ham anahtarın ilk 12 karakteridir", () => {
    const { raw, keyPrefix } = generateApiKey();
    expect(keyPrefix).toBe(raw.slice(0, 12));
    expect(keyPrefix.length).toBe(12);
  });

  it("hash deterministik ve 64 hex karakterdir", () => {
    const { raw, keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(raw)).toBe(keyHash);
  });

  it("her üretim benzersizdir (ham + hash)", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it("farklı girdiler farklı hash üretir", () => {
    expect(hashApiKey("chk_a")).not.toBe(hashApiKey("chk_b"));
  });
});
