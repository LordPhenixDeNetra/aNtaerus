import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, Server, Shield } from "lucide-react";
import ServiceStatus from "@/components/ServiceStatus";
import { useAppStore } from "@/store/useAppStore";
import {
  fetchServiceLogs,
  requestServiceRestart,
  type LogBundle,
  type ServiceLogBundle,
} from "@/lib/api";
import type { HealthHeartbeatPayload } from "@/lib/ws";

function aggregateStatus(
  services: HealthHeartbeatPayload["services"],
): "healthy" | "degraded" | "offline" {
  if (!services.length) return "degraded";
  const hasOffline = services.some((s) => s.status === "offline");
  if (hasOffline) return "offline";
  const hasDegraded = services.some((s) => s.status === "degraded");
  if (hasDegraded) return "degraded";
  return "healthy";
}

const FALLBACK_SERVICES: HealthHeartbeatPayload["services"] = [
  {
    name: "web_react",
    status: "healthy",
    version: "0.0.0",
    port: 5173,
    url: "http://localhost:5173",
    checkedAt: new Date().toISOString(),
    details: "UI React Vite — dev server local",
  },
  {
    name: "gateway_go",
    status: "degraded",
    version: "unknown",
    port: 8080,
    url: "http://localhost:8080",
    checkedAt: new Date().toISOString(),
    details: "Gateway Go HTTP. Aucun heartbeat WS recu (verifiez port 8080).",
  },
  {
    name: "brain_python",
    status: "degraded",
    version: "unknown",
    port: 8000,
    url: "http://localhost:8000",
    checkedAt: new Date().toISOString(),
    details: "Brain Python FastAPI. Verifiez `dev-brain.ps1` ou port 8000.",
  },
  {
    name: "engine_rust",
    status: "offline",
    version: "unknown",
    port: 7000,
    url: "http://localhost:7000",
    checkedAt: new Date().toISOString(),
    details:
      "Engine Rust API. Si erreur LLVM/libclang: re-executez `winget install LLVM.LLVM` puis redemarrez dev-all, ou mode core sans voice.",
  },
];

export default function SystemHealth() {
  const heartbeat = useAppStore((s) => s.lastHeartbeat);
  const services = heartbeat.length > 0 ? heartbeat : FALLBACK_SERVICES;
  const [logsByService, setLogsByService] = useState<Record<string, ServiceLogBundle>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});
  const [loadingRestart, setLoadingRestart] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

  const overall = aggregateStatus(services);
  const healthy = services.filter((s) => s.status === "healthy").length;
  const degraded = services.filter((s) => s.status === "degraded").length;
  const offline = services.filter((s) => s.status === "offline").length;

  async function viewLogs(serviceName: string) {
    try {
      setLoadingLogs((m) => ({ ...m, [serviceName]: true }));
      const bundle: ServiceLogBundle = await fetchServiceLogs(serviceName);
      const normalized: ServiceLogBundle = {
        service: bundle.service ?? serviceName,
        lines: bundle.lines ?? [],
        generatedAt: bundle.generatedAt ?? new Date().toISOString(),
      };
      setLogsByService((m) => ({ ...m, [serviceName]: normalized }));
      setMessages((m) => ({ ...m, [serviceName]: "" }));
    } catch (e) {
      setMessages((m) => ({
        ...m,
        [serviceName]: e instanceof Error ? e.message : "Logs indisponibles",
      }));
    } finally {
      setLoadingLogs((m) => ({ ...m, [serviceName]: false }));
    }
  }

  async function restart(serviceName: string) {
    try {
      setLoadingRestart((m) => ({ ...m, [serviceName]: true }));
      const resp = await requestServiceRestart(serviceName);
      const ok =
        resp.success ??
        (resp.status === "requested" || resp.status === "ok" || resp.status === "planned");
      setMessages((m) => ({
        ...m,
        [serviceName]: ok
          ? `Redemarrage demande (${resp.message})`
          : `Echec redemarrage: ${resp.message}`,
      }));
    } catch (e) {
      setMessages((m) => ({
        ...m,
        [serviceName]: e instanceof Error ? e.message : "Erreur redemarrage",
      }));
    } finally {
      setLoadingRestart((m) => ({ ...m, [serviceName]: false }));
    }
  }

  useEffect(() => {
    services.forEach((svc) => {
      if (svc.status === "offline") {
        void viewLogs(svc.name);
      }
    });
  }, [services.map((s) => s.name).join(",")]);

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.1 · Sante systeme
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Supervision temps reel
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Vue agregée des 4 couches CDC, extraction de logs par service
                et demande de redemarrage planifiee (idempotent, sans effet de
                bord critique).
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              <RefreshCw className={`h-4 w-4 ${heartbeat.length ? "animate-spin" : "opacity-50"}`} />
              {heartbeat.length ? "Heartbeat WebSocket actif" : "Mode fallback : liste statique 4 services"}
            </div>
          </div>

          {heartbeat.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4 text-xs text-amber-200/95">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                <span>
                  Aucun heartbeat WebSocket recu depuis le gateway Go. Les cartes ci-dessous sont une estimation de l&apos;etat initial (port 5173 React OK, autres services a verifier).
                  <br />
                  Pour les actualiser : ouvrez <span className="font-mono">/chat</span>, passez en mode{" "}
                  <span className="font-mono">ws</span> et cliquez{" "}
                  <span className="font-mono">Connecter</span>, ou relancez{" "}
                  <span className="font-mono">dev-all.ps1</span> si gateway Go est eteint.
                </span>
              </p>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Etat global
                  </p>
                  <p
                    className={`mt-3 text-2xl font-semibold ${
                      overall === "healthy"
                        ? "text-cyan-300"
                        : overall === "degraded"
                          ? "text-amber-300"
                          : "text-rose-300"
                    }`}
                  >
                    {overall.toUpperCase()}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-slate-100">
                  <Shield className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-5 shadow-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300">
                Sains
              </p>
              <p className="mt-3 text-2xl font-semibold text-cyan-200">{healthy}</p>
            </div>
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-5 shadow-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300">
                Degrades
              </p>
              <p className="mt-3 text-2xl font-semibold text-amber-200">{degraded}</p>
            </div>
            <div className="rounded-3xl border border-rose-400/20 bg-rose-500/5 p-5 shadow-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-rose-300">
                Hors ligne
              </p>
              <p className="mt-3 text-2xl font-semibold text-rose-200">{offline}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <div key={svc.name} className="flex flex-col gap-3">
              <ServiceStatus
                service={svc}
                logs={logsByService[svc.name] ?? null}
                logsLoading={!!loadingLogs[svc.name]}
                restartLoading={!!loadingRestart[svc.name]}
                onViewLogs={() => void viewLogs(svc.name)}
                onRestart={() => void restart(svc.name)}
              />
              {messages[svc.name] ? (
                <p
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    messages[svc.name].startsWith("Echec") ||
                    messages[svc.name].startsWith("Erreur") ||
                    messages[svc.name].startsWith("Logs")
                      ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                      : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                  }`}
                >
                  <Server className="mr-2 inline h-4 w-4 align-[-3px]" />
                  {messages[svc.name]}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
