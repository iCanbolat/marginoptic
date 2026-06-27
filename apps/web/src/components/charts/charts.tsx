import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  AXIS_PROPS,
  GRID_STROKE,
  resolveFormatters,
  seriesColor,
  type ChartValueKind,
} from "./chart-theme";
import {
  ChartTooltip,
  type ChartTooltipPayloadItem,
} from "./chart-tooltip";

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface BaseChartProps {
  data: Array<Record<string, string | number | null>>;
  xKey: string;
  series: ChartSeries[];
  /** Değer biçimi (eksen + tooltip). */
  kind?: ChartValueKind;
  currency?: string;
  height?: number;
  /** x ekseni etiket biçimlendirici (ör. tarih). */
  xFormatter?: (value: string | number) => string;
  /** Üst üste yığ (area/bar). */
  stacked?: boolean;
  className?: string;
}

const MARGIN = { top: 8, right: 12, bottom: 0, left: 4 };
const LEGEND_STYLE = { fontSize: 12, paddingTop: 8 };

/** Tema uyumlu çizgi grafiği (zaman serisi: net kâr/ciro trendi). */
export function LineChart({
  data,
  xKey,
  series,
  kind = "currency",
  currency = "USD",
  height = 280,
  xFormatter,
  className,
}: BaseChartProps) {
  const fmt = resolveFormatters(kind, currency);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={MARGIN}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} {...AXIS_PROPS} />
          <YAxis tickFormatter={fmt.axis} width={56} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: GRID_STROKE }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                label={p.label as string | number | undefined}
                payload={p.payload as unknown as ChartTooltipPayloadItem[]}
                labelFormatter={xFormatter}
                valueFormatter={fmt.full}
              />
            )}
          />
          {series.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? seriesColor(i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tema uyumlu alan grafiği (kümülatif/dolgu). */
export function AreaChart({
  data,
  xKey,
  series,
  kind = "currency",
  currency = "USD",
  height = 280,
  xFormatter,
  stacked = false,
  className,
}: BaseChartProps) {
  const fmt = resolveFormatters(kind, currency);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={MARGIN}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? seriesColor(i);
              return (
                <linearGradient
                  key={s.key}
                  id={`fill-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} {...AXIS_PROPS} />
          <YAxis tickFormatter={fmt.axis} width={56} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: GRID_STROKE }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                label={p.label as string | number | undefined}
                payload={p.payload as unknown as ChartTooltipPayloadItem[]}
                labelFormatter={xFormatter}
                valueFormatter={fmt.full}
              />
            )}
          />
          {series.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
          {series.map((s, i) => {
            const color = s.color ?? seriesColor(i);
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? "stack" : undefined}
                stroke={color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            );
          })}
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  kind?: ChartValueKind;
  currency?: string;
  height?: number;
  className?: string;
}

/** Tema uyumlu donut (maliyet kırılımı: COGS/kargo/ücret/reklam/gider payları).
   Lejant donut'un sağında dikey listelenir (altta değil) → dar widget'larda
   yatay alanı verimli kullanır. */
export function DonutChart({
  data,
  kind = "currency",
  currency = "USD",
  height = 280,
  className,
}: DonutChartProps) {
  const fmt = resolveFormatters(kind, currency);
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  return (
    <div
      className={cn("flex w-full items-center gap-4", className)}
      style={{ height }}
    >
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RPieChart>
            <Pie
              data={filtered}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="var(--background)"
              strokeWidth={2}
            >
              {filtered.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? seriesColor(i)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0];
                return (
                  <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="font-medium text-popover-foreground">
                      {p.name}
                    </div>
                    <div className="tabular-nums text-muted-foreground">
                      {fmt.full(Number(p.value))}
                    </div>
                  </div>
                );
              }}
            />
          </RPieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex max-h-full min-w-0 flex-1 flex-col justify-center gap-1.5 overflow-auto py-1 text-xs">
        {filtered.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: d.color ?? seriesColor(i) }}
              />
              <span className="truncate text-foreground">{d.name}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                %{pct.toFixed(0)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tema uyumlu sütun grafiği (kanal/kategori karşılaştırma, maliyet kırılımı). */
export function BarChart({
  data,
  xKey,
  series,
  kind = "currency",
  currency = "USD",
  height = 280,
  xFormatter,
  stacked = false,
  className,
}: BaseChartProps) {
  const fmt = resolveFormatters(kind, currency);
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={MARGIN}>
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={xFormatter} {...AXIS_PROPS} />
          <YAxis tickFormatter={fmt.axis} width={56} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.4 }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                label={p.label as string | number | undefined}
                payload={p.payload as unknown as ChartTooltipPayloadItem[]}
                labelFormatter={xFormatter}
                valueFormatter={fmt.full}
              />
            )}
          />
          {series.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? "stack" : undefined}
              fill={s.color ?? seriesColor(i)}
              radius={stacked ? 0 : [4, 4, 0, 0]}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
