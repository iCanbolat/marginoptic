import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "@/router";
import { queryClient } from "@/lib/query-client";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

/** Açılışta refresh cookie ile oturumu geri yükle; sonra router'ı render et. */
async function bootstrap(): Promise<void> {
  try {
    await authApi.refresh();
  } catch {
    /* refresh cookie yok/geçersiz — login'e yönlenecek */
  }
  useAuthStore.getState().setBootstrapped(true);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root öğesi bulunamadı");
}

void bootstrap().finally(() => {
  // NOT: StrictMode kaldırıldı — React 19 altında çift-mount, react-grid-layout
  // (react-draggable) sürükle-bırak'ını bozuyor. Üretimde StrictMode etkisizdir.
  createRoot(rootEl).render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>,
  );
});
