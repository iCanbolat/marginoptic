import { AuthLayout } from "./auth-layout";

/**
 * Google OAuth dönüş sayfası. Asıl iş route'un `beforeLoad`'ında yapılır
 * (refresh cookie → oturum); bu yalnızca yönlendirme anındaki geçiş ekranı.
 */
export function AuthCallbackPage() {
  return (
    <AuthLayout title="Giriş yapılıyor…" subtitle="Lütfen bekleyin">
      <div className="flex justify-center py-2">
        <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    </AuthLayout>
  );
}
