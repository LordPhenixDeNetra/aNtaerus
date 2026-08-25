import type { AnalyticsSeries } from "@/lib/api";

type Props = {
  series: AnalyticsSeries;
  height?: number;
  color?: string;
  fillOpacity?: number;
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function formatValue(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 100) / 100);
}

export default function MetricsChart({
  series,
  height = 220,
  color = "#22d3ee",
  fillOpacity = 0.18,
}: Props) {
  const width = 640;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const points = (series.points || []).slice(-96);
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const minV = Math.min(0, ...points.map((p) => p.value));
  const range = Math.max(0.0001, maxV - minV);

  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const toY = (v: number) => padT + innerH - ((v - minV) / range) * innerH;

  const pathD = points.reduce<string>((acc, p, i) => {
    const x = padL + i * stepX;
    const y = toY(p.value);
    return `${acc}${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }, "");

  const areaD = points.length
    ? `${pathD} L ${(padL + (points.length - 1) * stepX).toFixed(2)} ${(padT + innerH).toFixed(2)} L ${padL} ${(padT + innerH).toFixed(2)} Z`
    : "";

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minV + (range * i) / yTicks;
    return { value: val, y: toY(val) };
  });
  const gradId = `mchart-grad-${series.name.replace(/\W+/g, "-")}`;

  return (
    <figure
      className="w-full rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-inner"
      data-testid="metrics-chart"
    >
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-300">
            {series.name}
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          {formatValue(series.lastValue ?? 0)} · max {formatValue(maxV)} ·{" "}
          {points.length} p.
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={series.name}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity + 0.1} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={t.y}
              y2={t.y}
              stroke="rgba(148,163,184,0.12)"
              strokeDasharray="3 6"
            />
            <text
              x={padL - 8}
              y={t.y + 3}
              textAnchor="end"
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              {formatValue(t.value)}
            </text>
          </g>
        ))}

        {areaD ? <path d={areaD} fill={`url(#${gradId})`} /> : null}
        {pathD ? (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {points.filter((_, i) => i % 8 === 0).map((p, i) => {
          const x = padL + i * 8 * stepX;
          return (
            <text
              key={`xt-${i}`}
              x={x}
              y={height - 10}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
            >
              {formatTime(p.timestamp)}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
