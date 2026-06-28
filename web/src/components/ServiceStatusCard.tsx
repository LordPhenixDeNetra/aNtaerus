import { AlertTriangle, CheckCircle2, WifiOff } from "lucide-react";

import type { ServiceCapabilities, ServiceHealth } from "@/lib/api";

type ServiceStatusCardProps = {
  service: ServiceHealth;
  capabilities?: ServiceCapabilities;
};

const statusStyles: Record<ServiceHealth["status"], string> = {
  healthy: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  degraded: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  offline: "border-rose-400/30 bg-rose-500/10 text-rose-100",
};

const statusIcons = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  offline: WifiOff,
};

export default function ServiceStatusCard({ service, capabilities }: ServiceStatusCardProps) {
  const Icon = statusIcons[service.status];

  return (
    <article className={`rounded-3xl border p-6 shadow-2xl shadow-slate-950/30 ${statusStyles[service.status]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-300">{service.name}</p>
          <h3 className="mt-3 text-lg font-semibold text-white">{service.url}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-slate-200">
        <div className="flex items-center justify-between">
          <span>Statut</span>
          <span className="font-mono uppercase">{service.status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Version</span>
          <span className="font-mono">{service.version}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Port</span>
          <span className="font-mono">{service.port}</span>
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-300">{service.details ?? "Aucun détail supplémentaire."}</p>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">Capacités</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(capabilities?.capabilities ?? []).map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 font-mono text-xs text-slate-200"
            >
              {capability}
            </span>
          ))}
          {!capabilities && <span className="text-xs text-slate-400">Non déclarées</span>}
        </div>
      </div>
    </article>
  );
}
