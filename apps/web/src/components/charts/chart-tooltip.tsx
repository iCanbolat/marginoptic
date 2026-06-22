/**
 * Tema uyumlu özel grafik tooltip'i (popover stilinde).
 * Recharts'ın `content` prop'una verilir; değerler tam biçimlendiriciyle yazılır.
 */
export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ChartTooltipPayloadItem[];
  /** x ekseni etiket biçimlendirici (ör. tarih). */
  labelFormatter?: (label: string | number) => string;
  /** değer biçimlendirici (tam). */
  valueFormatter?: (value: number) => string;
}

export function ChartTooltip({
  active,
  label,
  payload,
  labelFormatter,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {label != null && (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const value = Number(item.value ?? 0);
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="ml-auto font-medium tabular-nums">
                {valueFormatter ? valueFormatter(value) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
