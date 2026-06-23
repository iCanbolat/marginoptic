import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaymentFees } from "../hooks/use-payment-fees";
import {
  paymentFeeRuleInputSchema,
  type PaymentFeeRuleInput,
} from "../types/cost-types";
import { optionalText } from "../utils/format";
import { FieldError } from "./field-error";

type FormValues = z.input<typeof paymentFeeRuleInputSchema>;

const EMPTY: FormValues = { gateway: "", percentage: "", fixedFee: "" };

export function PaymentFeesCard({
  storeId,
  canEdit,
}: {
  storeId: string;
  canEdit: boolean;
}) {
  const { feesQ, create, remove } = usePaymentFees(storeId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, PaymentFeeRuleInput>({
    resolver: zodResolver(paymentFeeRuleInputSchema),
    defaultValues: EMPTY,
  });

  function submit(values: PaymentFeeRuleInput) {
    create.mutate(values, { onSuccess: () => reset(EMPTY) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ödeme / işlem ücretleri</CardTitle>
        <CardDescription>
          Ücret = tutar × yüzde + sabit. Gateway boşsa tüm gateway'ler için
          varsayılan kuraldır.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <form
            onSubmit={handleSubmit(submit)}
            noValidate
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <div className="space-y-1">
              <Label>Gateway</Label>
              <Input
                placeholder="shopify_payments"
                aria-invalid={!!errors.gateway}
                {...register("gateway", { setValueAs: optionalText })}
              />
              <FieldError message={errors.gateway?.message} />
            </div>
            <div className="space-y-1">
              <Label>Yüzde (%)</Label>
              <Input
                inputMode="decimal"
                placeholder="2.9"
                aria-invalid={!!errors.percentage}
                {...register("percentage", { setValueAs: optionalText })}
              />
              <FieldError message={errors.percentage?.message} />
            </div>
            <div className="space-y-1">
              <Label>Sabit ücret</Label>
              <Input
                inputMode="decimal"
                placeholder="0.30"
                aria-invalid={!!errors.fixedFee}
                {...register("fixedFee", { setValueAs: optionalText })}
              />
              <FieldError message={errors.fixedFee?.message} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={create.isPending}>
                Ekle
              </Button>
            </div>
          </form>
        ) : null}

        {feesQ.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : feesQ.data && feesQ.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gateway</TableHead>
                <TableHead className="text-right">Yüzde</TableHead>
                <TableHead className="text-right">Sabit</TableHead>
                {canEdit ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {feesQ.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.gateway ?? "Tümü (varsayılan)"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    %{r.percentage}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.fixedFee} {r.currency ?? ""}
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(r.id)}
                      >
                        Sil
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Henüz ödeme ücreti kuralı yok.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
