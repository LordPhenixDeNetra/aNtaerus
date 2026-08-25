import { AlertTriangle, CheckCircle2, FileText, RotateCcw, WifiOff } from "lucide-react";
import type { ServiceLogBundle } from "@/lib/api";
import type { HealthHeartbeatPayload } from "@/lib/ws";

type Props = {
  service: HealthHeartbeatPayload["services"][number];
  logs?: ServiceLogBundle | null;
  logsLoading?: boolean;
  restartLoading?: boolean;
  onViewLogs?: () => void;
  onRestart?: () => void;
};

const statusStyles = {
  healthy: "border-cyan-400/30 bg-cyan-500/10",
  degraded: "border-amber-400/30 bg-amber-500/10",
  offline: "border-rose-400/30 bg-rose-500/10",
} as const;

const statusLabels: Record<string, string> = {
  healthy: "Sain",
  degraded: "Degrade",
  offline: "Hors ligne",
};

const statusIcons = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  offline: WifiOff,
} as const;

export default function ServiceStatus({
  service,
  logs,
  logsLoading,
  restartLoading,
  onViewLogs,
  onRestart,
}: Props) {
  const Icon = statusIcons[service.status as keyof typeof statusIcons] ?? CheckCircle2;

  return (
    <article
      className={`rounded-3xl border p-6 shadow-xl backdrop-blur ${statusStyles[service.status as keyof typeof statusStyles] ?? "border-white/10 bg-white/5"}`}
      data-testid="service-status"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-300">
            {service.name}
          </p>
          <h3 className="mt-3 text-lg font-semibold text-white">
            {service.url || `localhost:${service.port}`}
          </h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Statut</dt>
          <dd className="font-mono uppercase">{statusLabels[service.status] ?? service.status}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Version</dt>
          <dd className="font-mono">{service.version || "-"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Port</dt>
          <dd className="font-mono">{service.port || "-"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-400">Verifie a</dt>
          <dd className="font-mono text-[11px]">
            {service.checkedAt ? new Date(service.checkedAt).toLocaleTimeString() : "-"}
          </dd>
        </div>
      </dl>

      {service.details ? (
        <p className="mt-4 text-sm text-slate-200">{service.details}</p>
      ) : null}

      {typeof onViewLogs === "function" || typeof onRestart === "function" ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={onViewLogs}
            disabled={logsLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            {logsLoading ? "Chargement logs..." : "Voir les logs"}
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={restartLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {restartLoading ? "Redemarrage..." : "Redemarrer"}
          </button>
        </div>
      ) : null}

      {logs && logs.lines.length > 0 ? (
        <pre className="mt-6 max-h-40 overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-[11px] leading-5 text-slate-200">
{logs.lines.slice(-80).join("\n")}
        </pre>
      ) : null}
    </article>
  );
}
