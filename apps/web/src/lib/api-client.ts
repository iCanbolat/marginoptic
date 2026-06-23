import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "./auth/store";
import { refreshSession } from "./auth/refresh";
import { ApiError, toApiError } from "./errors";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Tek bir 401 retry'ı işaretlemek için config'e eklenen bayrak. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** Tüm feature `api/` modüllerinin kullandığı global axios örneği. */
export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// İstek interceptor'ı: oturum varsa Bearer token ekle.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Yanıt interceptor'ı: 401'de bir kez refresh + retry; aksi halde ApiError'a normalize et.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    // Sadece token ile gönderilmiş istekler refresh edilir (public uçlar hariç).
    const hadToken = Boolean(original?.headers?.Authorization);
    if (status === 401 && hadToken && original && !original._retry) {
      original._retry = true;
      const next = await refreshSession();
      if (next) {
        original.headers.Authorization = `Bearer ${next}`;
        return apiClient(original);
      }
    }

    if (error.response) {
      throw toApiError(error.response.status, error.response.data);
    }
    // Ağ/iptal hatası — yanıt yok.
    throw new ApiError(0, error.message || "Ağ hatası");
  },
);

// --- Tipli yardımcılar: feature api fn'leri `T` döner (apiFetch ergonomisi). ---

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await apiClient.get<T>(url, config)).data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await apiClient.post<T>(url, body, config)).data;
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await apiClient.put<T>(url, body, config)).data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await apiClient.patch<T>(url, body, config)).data;
}

export async function apiDelete<T = void>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return (await apiClient.delete<T>(url, config)).data;
}
