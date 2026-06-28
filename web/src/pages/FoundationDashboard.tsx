import { Activity, Cpu, Network, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ServiceStatusCard from "@/components/ServiceStatusCard";
import { fetchSystemStatus, type SystemStatus } from "@/lib/api";

const endpoints = [
  { path: "/health", description: "Santé du gateway" },
  { path: "/api/v1/system/services", description: "Liste des services connus" },
  { path: "/api/v1/system/status", description: "Statut agrégé pour le dashboard" },
];

export default function FoundationDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setError(null);
      const payload = await fetchSystemStatus();
      setStatus(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  const totalHealthy = useMemo(
    () => status?.services.filter((service) => service.status === "healthy").length ?? 0,
    [status],
  );

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-cyan-400/20 bg-slate-950/70 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">Foundation Dashboard</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white">
                aNtaerus pose sa base d&apos;exécution polyglotte, observable et extensible.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Cette interface supervise la première itération d&apos;ingénierie: `web`, `gateway_go`,
                `brain_python` et `engine_rust`, connectés via contrats JSON et orchestration hybride.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Rafraîchir
                </button>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Phase active: fondation
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
              <MetricCard icon={Network} label="Services sains" value={`${totalHealthy}/4`} />
              <MetricCard icon={Cpu} label="Environnement" value={status?.environment ?? "indisponible"} />
              <MetricCard icon={Activity} label="Produit" value={status?.product ?? "aNtaerus"} />
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-100">
            {error}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="grid gap-6 md:grid-cols-2">
            {loading && !status
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
                ))
              : status?.services.map((service) => (
                  <ServiceStatusCard
                    key={service.name}
                    service={service}
                    capabilities={status.capabilities.find((item) => item.name === service.name)}
                  />
                ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Endpoints Fondamentaux</p>
              <div className="mt-5 space-y-4">
                {endpoints.map((endpoint) => (
                  <div key={endpoint.path} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="font-mono text-sm text-cyan-200">{endpoint.path}</p>
                    <p className="mt-2 text-sm text-slate-300">{endpoint.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Couches Présentes</p>
              <ul className="mt-5 space-y-3 text-sm text-slate-300">
                <li>`web/` supervise l&apos;état agrégé et expose la base UI.</li>
                <li>`gateway_go/` orchestre les appels de santé et unifie les réponses.</li>
                <li>`brain_python/` réserve le futur cerveau LLM et mémoire.</li>
                <li>`engine_rust/` réserve le futur moteur temps réel, audio et sandbox.</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

type MetricCardProps = {
  icon: typeof Network;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <Icon className="h-4 w-4 text-cyan-200" />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
          <p className="mt-2 text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
