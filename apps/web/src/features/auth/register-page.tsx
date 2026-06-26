import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { registerSchema, type RegisterInput } from "@churnify/shared";
import { ApiError, authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/store";
import { AuthLayout } from "./auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const session = await authApi.register(values);
      setSession(session);
      await navigate({ to: "/" });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Kayıt başarısız");
    }
  });

  return (
    <AuthLayout title="Kayıt ol" subtitle="Yeni bir hesap oluştur">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Ad Soyad</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {errors.name ? (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-posta</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Parola</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="storeName">Mağaza adı (opsiyonel)</Label>
          <Input id="storeName" {...register("storeName")} />
        </div>
        {serverError ? (
          <p className="text-sm text-destructive">{serverError}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Oluşturuluyor…" : "Kayıt ol"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Zaten hesabın var mı?{" "}
        <Link to="/login" className="text-foreground underline">
          Giriş yap
        </Link>
      </p>
    </AuthLayout>
  );
}
