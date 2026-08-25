import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, MessageSquare, Gauge, Sparkles, RefreshCw } from "lucide-react";
import MetricsChart from "@/components/MetricsChart";
import { useAppStore } from "@/store/useAppStore";
import { fetchAnalytics, type AnalyticsSeries } from "@/lib/api";

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
            {label}
          </p>
          <p className={`mt-3 text-2xl font-semibold ${accent}`}>{value}</p>
          {hint ? (
            <p className="mt-2 text-xs text-slate-400">{hint}</p>
          ) : null}
        </div>
        <div className={`rounded-2xl border border-white/10 bg-slate-950/60 p-3 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

const palette: Record<AnalyticsSeries["name"] | string, string> = {
  latencyMs: "#22d3ee",
  tokensPerMinute: "#a78bfa",
  messagesPerMinute: "#34d399",
  default: "#f59e0b",
};

const EMPTY_SERIES: AnalyticsSeries[] = [
  {
    name: "latencyMs",
    lastValue: 0,
    points: [],
  },
  {
    name: "tokensPerMinute",
    lastValue: 0,
    points: [],
  },
  {
    name: "messagesPerMinute",
    lastValue: 0,
    points: [],
  },
];

export default function Analytics() {
  const analytics = useAppStore((s) => s.analytics);
  const analyticsLoading = useAppStore((s) => s.analyticsLoading);
  const setAnalytics = useAppStore((s) => s.setAnalytics);
  const setAnalyticsLoading = useAppStore((s) => s.setAnalyticsLoading);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setAnalyticsLoading(true);
      const data = await fetchAnalytics();
      setAnalytics(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de recuperer les metriques analytiques.",
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const series: AnalyticsSeries[] = useMemo(() => {
    const raw = analytics?.series ?? [];
    if (raw.length === 0) return EMPTY_SERIES;
    const byName: Record<string, AnalyticsSeries> = {};
    for (const s of raw) {
      byName[s.name] = s;
    }
    const latency = byName["latencyMs"] ?? byName["latency_ms"] ?? EMPTY_SERIES[0];
    const tokens = byName["tokensPerMinute"] ?? byName["tokens_per_hour"] ?? byName["tokens_per_minute"] ?? EMPTY_SERIES[1];
    const messages = byName["messagesPerMinute"] ?? byName["messages_per_hour"] ?? byName["messages_per_minute"] ?? EMPTY_SERIES[2];
    return [
      { ...latency, name: "latencyMs" },
      { ...tokens, name: "tokensPerMinute" },
      { ...messages, name: "messagesPerMinute" },
    ];
  }, [analytics?.series]);
  const latency = series[0];
  const tokens = series[1];
  const messages = series[2];
  const displayPlaceholder = !analytics && !analyticsLoading;

  const totalTokens = analytics?.totalTokensSpent ?? 0;
  const totalMessages = analytics?.messagesProcessed ?? analytics?.totalMessagesProcessed ?? 0;
  const p95 = analytics?.latencyP95Ms ?? analytics?.averageLatencyMs ?? 0;
  const factCount = analytics?.factCount ?? 0;

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.1 · Analytique
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Tableau de bord analytique
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                KPI agreges et series temporelles des 24 dernieres heures :
                latence gateway, tokens par minute, messages echanges.
                Visualisation SVG fait main, zero dependance chart.
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-200/95">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-rose-300" />
                <span>
                  <span className="font-medium">Donnees analytiques indisponibles</span> : {error}
                  <br />
                  Cause habituelle : endpoint <span className="font-mono">/api/v1/analytics</span> du
                  gateway Go non implemente ou gateway eteint. Reessayez plus tard ou cliquez
                  Actualiser.
                </span>
              </p>
            </div>
          ) : null}

          {displayPlaceholder && !error ? (
            <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/95">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                <span>
                  <span className="font-medium">Aucune donnee recue pour le moment</span> : les
                  graphiques ci-dessous affichent une structure vide en attendant les premieres
                  mesures (24h de donnees). Les KPI vont s&apos;actualiser automatiquement.
                </span>
              </p>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={Gauge}
              label="Latence p95"
              value={analytics ? `${Math.round(p95)} ms` : "-- ms"}
              hint="SLA cible < 800ms"
              accent="text-cyan-300"
            />
            <Kpi
              icon={Sparkles}
              label="Tokens depenses"
              value={analytics ? totalTokens.toLocaleString() : "--"}
              hint="Total dernieres 24h"
              accent="text-violet-300"
            />
            <Kpi
              icon={MessageSquare}
              label="Messages traites"
              value={analytics ? totalMessages.toLocaleString() : "--"}
              hint="Inclut voix + texte"
              accent="text-emerald-300"
            />
            <Kpi
              icon={Activity}
              label="Fautes memoire"
              value={analytics ? factCount.toLocaleString() : "--"}
              hint="Faits semantiques stockes"
              accent="text-amber-300"
            />
          </div>
        </header>

        {analyticsLoading ? (
          <p className="rounded-3xl border border-white/10 bg-slate-950/50 p-10 text-center text-sm text-slate-400">
            Chargement des metriques...
          </p>
        ) : (
          <section className="grid gap-6 lg:grid-cols-2">
            <MetricsChart
              series={latency}
              color={palette.latencyMs}
            />
            <MetricsChart
              series={tokens}
              color={palette.tokensPerMinute}
            />
            <MetricsChart
              series={messages}
              color={palette.messagesPerMinute}
            />
          </section>
        )}
      </div>
    </main>
  );
}
