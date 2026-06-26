// Shared sözleşmeleri feature içi tek import noktası olarak yeniden ihraç et.
export type {
  OrderRow,
  Paginated,
  ChannelSummary,
  StoreSyncStatus,
} from "@churnify/shared";

/** Sipariş listesi sorgu parametreleri (axios `params` olarak gönderilir). */
export interface OrdersParams {
  /** 1-tabanlı sayfa. */
  page?: number;
  pageSize?: number;
  financialStatus?: string;
  search?: string;
}

/** Varsayılan sayfa boyutu + "Sayfa başına" seçenekleri. */
export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** Select'te "tümü" sentinel'i (boş string SelectItem'a verilemez). */
export const ALL_STATUSES = "__all__";

/** Finansal durum: etiket + duruma özel rozet rengi (tek kaynak). */
export const FINANCIAL_STATUSES = [
  {
    value: "paid",
    label: "Ödendi",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  {
    value: "pending",
    label: "Beklemede",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  {
    value: "refunded",
    label: "İade edildi",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  },
  {
    value: "partially_refunded",
    label: "Kısmi iade",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  },
  {
    value: "voided",
    label: "İptal",
    className: "bg-foreground/10 text-muted-foreground",
  },
] as const;

interface FinancialStatusMeta {
  label: string;
  className: string;
}

const FINANCIAL_STATUS_BY_VALUE: Record<string, FinancialStatusMeta> =
  Object.fromEntries(
    FINANCIAL_STATUSES.map((s) => [
      s.value,
      { label: s.label, className: s.className },
    ]),
  );

/** Bir finansal durum değerine karşılık rozet etiketi + rengi (bilinmeyenler için fallback). */
export function financialStatusMeta(
  status: string | null,
): FinancialStatusMeta {
  if (status && FINANCIAL_STATUS_BY_VALUE[status]) {
    return FINANCIAL_STATUS_BY_VALUE[status];
  }
  return {
    label: status ?? "—",
    className: "bg-foreground/10 text-muted-foreground",
  };
}
