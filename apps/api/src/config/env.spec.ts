import { validateEnv } from "./env";

describe("validateEnv", () => {
  it("varsayılanları uygular ve tipleri coerce eder", () => {
    const env = validateEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    });
    expect(env.PORT).toBe(3000);
    expect(env.REDIS_PORT).toBe(6379);
    expect(env.NODE_ENV).toBe("development");
  });

  it("DATABASE_URL yoksa hata fırlatır", () => {
    expect(() => validateEnv({})).toThrow(/Geçersiz ortam/);
  });

  it("string PORT değerini sayıya çevirir", () => {
    const env = validateEnv({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      PORT: "8080",
    });
    expect(env.PORT).toBe(8080);
  });
});
