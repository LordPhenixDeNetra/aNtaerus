import { Play, Sliders } from "lucide-react";
import type { Initiative, PatchInitiativeRequest } from "@/lib/api";

type InitiativeCardProps = {
  initiative: Initiative;
  onRun?: (initiative: Initiative) => Promise<void> | void;
  onPatch?: (
    initiative: Initiative,
    patch: PatchInitiativeRequest,
  ) => Promise<void> | void;
  loadingAction?: string | null;
};

export const initiativeStatusStyles: Record<Initiative["status"], string> = {
  pending: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  queued: "bg-indigo-500/20 text-indigo-100 border-indigo-500/40",
  running: "bg-sky-500/20 text-sky-100 border-sky-500/40",
  succeeded: "bg-emerald-500/20 text-emerald-50 border-emerald-500/40",
  failed: "bg-rose-500/20 text-rose-50 border-rose-500/40",
  approved: "bg-teal-500/20 text-teal-50 border-teal-500/40",
  rejected: "bg-amber-500/20 text-amber-50 border-amber-500/40",
};

export const autonomyLabels: Array<{ value: number; label: string }> = [
  { value: 0, label: "Manuel" },
  { value: 1, label: "Suggestions" },
  { value: 2, label: "Semi-Auto" },
  { value: 3, label: "Auto Approve" },
  { value: 4, label: "Full Auto" },
  { value: 5, label: "Superviseur" },
];

export function autonomyLabel(level: number): string {
  const match = autonomyLabels.find((l) => l.value === level);
  return match ? match.label : `Niveau ${level}`;
}

function canRun(status: Initiative["status"]): boolean {
  return (
    status === "pending" ||
    status === "queued" ||
    status === "failed" ||
    status === "rejected"
  );
}

function budgetPercent(initiative: Initiative): number {
  if (initiative.budgetTokens <= 0) return 0;
  return Math.min(
    100,
    Math.round(
      (initiative.budgetTokensUsed / initiative.budgetTokens) * 100,
    ),
  );
}

export default function InitiativeCard({
  initiative,
  onRun,
  onPatch,
  loadingAction,
}: InitiativeCardProps) {
  const percent = budgetPercent(initiative);
  const styleCard = `rounded-3xl border-white/10 border bg-white/[0.04] shadow-2xl shadow-slate-950/40 backdrop-blur-2xl`;

  const advanceStatus = () => {
    let next: Initiative["status"] | null = null;
    switch (initiative.status) {
      case "pending":
      case "queued":
        next = "queued";
        break;
      case "succeeded":
        next = "approved";
        break;
      case "failed":
        next = "rejected";
        break;
      default:
        next = null;
    }
    if (next && next !== initiative.status) {
      onPatch?.(initiative, { status: next });
    }
  };

  const toggleAutonomy = () => {
    const next = (initiative.autonomyLevel + 1) % 6;
    onPatch?.(initiative, { autonomyLevel: next });
  };

  return (
    <article
      data-testid={`initiative-card-${initiative.id}`}
      className={`${styleCard} p-5`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-50">
              {initiative.title}
            </h3>
            <span
              className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${initiativeStatusStyles[initiative.status]}`}
              data-testid={`status-badge-${initiative.id}`}
            >
              {initiative.status}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-300">
              {autonomyLabel(initiative.autonomyLevel)}
            </span>
          </div>
          {initiative.description ? (
            <p className="mt-2 line-clamp-2 text-xs text-slate-300">
              {initiative.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
            <span>ID {initiative.id.slice(0, 8)}</span>
            <span>·</span>
            <span>Trigger {initiative.triggerType}</span>
            {initiative.collectorSource ? (
              <>
                <span>·</span>
                <span>Source {initiative.collectorSource}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-slate-50">
            {initiative.budgetTokensUsed}/{initiative.budgetTokens}
          </div>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
            <div
              data-testid={`budget-bar-${initiative.id}`}
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
            Budget tokens
          </p>
        </div>
      </header>

      {initiative.error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          <span className="font-mono uppercase tracking-[0.2em]">Erreur</span>{" "}
          {initiative.error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canRun(initiative.status) || loadingAction === "run"}
          onClick={() => onRun?.(initiative)}
          data-testid={`run-btn-${initiative.id}`}
          className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "run" ? "Execution" : "Executer"}
          </span>
        </button>
        <button
          type="button"
          disabled={loadingAction === "patch-status"}
          onClick={advanceStatus}
          data-testid={`patch-status-btn-${initiative.id}`}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sliders className="h-4 w-4" />
          <span className="uppercase tracking-[0.2em]">Prochain statut</span>
        </button>
        <button
          type="button"
          disabled={loadingAction === "patch-autonomy"}
          onClick={toggleAutonomy}
          data-testid={`toggle-autonomy-btn-${initiative.id}`}
          className="flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="uppercase tracking-[0.2em]">
            Autonomie +1
          </span>
        </button>
      </div>
    </article>
  );
}
