import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const CHART_COLORS = {
  brand: "#B85E6C",
  brandSoft: "#DFACB2",
  emerald: "#10B981",
  amber: "#F59E0B",
  indigo: "#6366F1",
  sky: "#0EA5E9",
  violet: "#8B5CF6",
};

const countFormatter = new Intl.NumberFormat("fr-FR");
const compactFormatter = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const moneyFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function formatCount(value: number) {
  return countFormatter.format(value);
}

export function formatCompact(value: number) {
  return compactFormatter.format(value);
}

export function formatTND(value: number) {
  return `${moneyFormatter.format(value)} TND`;
}

export type Granularity = "day" | "month";

export function formatDateLabel(dateStr: string, granularity: Granularity = "day") {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  if (granularity === "month") {
    return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* ── Shared tooltip ── */

type TooltipPayloadEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  fill?: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number, dataKey?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">
        {labelFormatter && label != null ? labelFormatter(String(label)) : label}
      </p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-1.5 text-slate-600">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: entry.color ?? entry.fill ?? CHART_COLORS.brand }}
          />
          <span>{entry.name} :</span>
          <span className="font-semibold text-slate-900">
            {valueFormatter ? valueFormatter(Number(entry.value), String(entry.dataKey)) : entry.value}
          </span>
        </p>
      ))}
    </div>
  );
}

const AXIS_TICK = { fontSize: 11, fill: "#94A3B8" } as const;

function EmptyChart() {
  return <p className="text-slate-400 text-sm text-center py-10">Aucune donnée pour cette période.</p>;
}

/* ── Area chart over time (revenue) ── */

export function TimeSeriesAreaChart({
  data,
  dataKey,
  name,
  color = CHART_COLORS.brand,
  granularity = "day",
  valueFormatter = formatCount,
  height = 260,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  name: string;
  color?: string;
  granularity?: Granularity;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  const gradientId = `area-gradient-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDateLabel(v, granularity)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#E2E8F0" }}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatCompact(v)}
          allowDecimals={false}
        />
        <Tooltip
          content={
            <ChartTooltip
              labelFormatter={(l) => formatDateLabel(l, granularity)}
              valueFormatter={valueFormatter}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Bar chart over time (orders, reviews) ── */

export function TimeSeriesBarChart({
  data,
  dataKey,
  name,
  color = CHART_COLORS.brand,
  granularity = "day",
  valueFormatter = formatCount,
  height = 240,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  name: string;
  color?: string;
  granularity?: Granularity;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDateLabel(v, granularity)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#E2E8F0" }}
          minTickGap={24}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v: number) => formatCompact(v)}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          content={
            <ChartTooltip
              labelFormatter={(l) => formatDateLabel(l, granularity)}
              valueFormatter={valueFormatter}
            />
          }
        />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[5, 5, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Hourly distribution (client analytics) ── */

export function HourlyBarChart({
  data,
  height = 190,
}: {
  data: { hour: number; label: string; events: number }[];
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#E2E8F0" }}
          interval={2}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={30}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          content={<ChartTooltip valueFormatter={formatCount} />}
        />
        <Bar dataKey="events" name="Événements" fill={CHART_COLORS.brand} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Daily activity: cart adds (bars) + sessions (line) ── */

export function DailyActivityChart({
  data,
  height = 190,
}: {
  data: { date: string; cart_adds: number; product_views: number; sessions: number }[];
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => formatDateLabel(v)}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#E2E8F0" }}
          minTickGap={24}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          content={
            <ChartTooltip labelFormatter={(l) => formatDateLabel(l)} valueFormatter={formatCount} />
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
        <Bar dataKey="cart_adds" name="Ajouts panier" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Line
          type="monotone"
          dataKey="sessions"
          name="Sessions"
          stroke={CHART_COLORS.indigo}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
