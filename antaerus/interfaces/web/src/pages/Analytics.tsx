import { useEffect } from "react";
import { Activity, MessageSquare, Gauge, Sparkles, RefreshCw } from "lucide-react";
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

export default function Analytics() {
  const { analytics, analyticsLoading, setAnalytics, setAnalyticsLoading } = useAppStore();

  async function refresh() {
    try {
      setAnalyticsLoading(true);
      const data = await fetchAnalytics();
      setAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const series: AnalyticsSeries[] = analytics?.series ?? [];
  const latency = series.find((s) => s.name === "latencyMs");
  const tokens = series.find((s) => s.name === "tokensPerMinute");
  const messages = series.find((s) => s.name === "messagesPerMinute");

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
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={Gauge}
              label="Latence p95"
              value={analytics ? `${Math.round(analytics.latencyP95Ms)} ms` : "-- ms"}
              hint="SLA cible < 800ms"
              accent="text-cyan-300"
            />
            <Kpi
              icon={Sparkles}
              label="Tokens depenses"
              value={analytics ? analytics.totalTokensSpent.toLocaleString() : "--"}
              hint="Total dernieres 24h"
              accent="text-violet-300"
            />
            <Kpi
              icon={MessageSquare}
              label="Messages traites"
              value={analytics ? analytics.messagesProcessed.toLocaleString() : "--"}
              hint="Inclut voix + texte"
              accent="text-emerald-300"
            />
            <Kpi
              icon={Activity}
              label="Fautes memoire"
              value={analytics ? analytics.factCount.toLocaleString() : "--"}
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
            {latency ? (
              <MetricsChart series={latency} color={palette.latencyMs} />
            ) : null}
            {tokens ? (
              <MetricsChart series={tokens} color={palette.tokensPerMinute} />
            ) : null}
            {messages ? (
              <MetricsChart series={messages} color={palette.messagesPerMinute} />
            ) : null}
            {!latency && !tokens && !messages ? (
              <p className="col-span-full rounded-3xl border border-white/10 bg-slate-950/50 p-10 text-center text-sm text-slate-400">
                Aucune serie disponible pour le moment.
              </p>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
