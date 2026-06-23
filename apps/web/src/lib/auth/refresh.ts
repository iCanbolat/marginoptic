import type { SessionResponse } from "@churnify/shared";
import { useAuthStore } from "./store";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Aynı anda birden fazla 401 olursa (fetch + axios istemcileri dahil) tek bir
// refresh çalışsın diye in-flight promise paylaşılır.
let refreshing: Promise<string | null> | null = null;

/**
 * Refresh cookie ile oturumu yeniler. Başarılıysa yeni access token'ı döner ve
 * auth store'a yazar; başarısızsa store'u temizler ve `null` döner.
 *
 * Doğrudan `fetch` kullanır (axios'a bağlı değil) → axios 401 interceptor'ından
 * tekrar buraya düşüp döngü oluşmaz.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      useAuthStore.getState().clear();
      return null;
    }
    const session = (await res.json()) as SessionResponse;
    useAuthStore.getState().setSession(session);
    return session.accessToken;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}
