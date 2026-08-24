import { Activity, ChevronDown, ChevronRight, Play, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Mission, MissionStep } from "@/lib/api";
import MissionStepRow from "@/components/MissionStep";

type MissionCardProps = {
  mission: Mission;
  onRun?: (mission: Mission) => Promise<void> | void;
  onRecover?: (mission: Mission) => Promise<void> | void;
  onReflect?: (mission: Mission) => Promise<void> | void;
  loadingAction?: string;
};

const statusStyles: Record<Mission["status"], string> = {
  draft: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  planned: "bg-indigo-500/20 text-indigo-100 border-indigo-500/40",
  running: "bg-sky-500/20 text-sky-100 border-sky-500/40",
  paused: "bg-amber-500/20 text-amber-100 border-amber-500/40",
  completed: "bg-emerald-500/20 text-emerald-50 border-emerald-500/40",
  failed: "bg-rose-500/20 text-rose-50 border-rose-500/40",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

function computeProgress(steps: MissionStep[]): { done: number; total: number; percent: number } {
  const total = steps.length;
  if (total === 0) return { done: 0, total: 0, percent: 0 };
  const done = steps.filter((s) => s.status === "completed" || s.status === "failed" || s.status === "skipped").length;
  return { done, total, percent: Math.round((done * 100) / total) };
}

function canRun(status: Mission["status"]): boolean {
  return status === "draft" || status === "planned" || status === "paused" || status === "failed";
}
function canRecover(status: Mission["status"]): boolean {
  return status === "failed" || status === "paused";
}
function canReflect(status: Mission["status"]): boolean {
  return status === "completed" || status === "failed";
}

export default function MissionCard({
  mission,
  onRun,
  onRecover,
  onReflect,
  loadingAction,
}: MissionCardProps) {
  const [open, setOpen] = useState(false);
  const progress = useMemo(() => computeProgress(mission.steps), [mission.steps]);
  const styleCard = `rounded-3xl border-white/10 border bg-white/[0.04] shadow-2xl shadow-slate-950/40 backdrop-blur-2xl`;
  return (
    <article
      data-testid={`mission-card-${mission.id}`}
      className={`${styleCard} p-5`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-slate-300" />
            <h3 className="truncate text-base font-semibold text-slate-50">
              {mission.title}
            </h3>
            <span
              className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${statusStyles[mission.status]}`}
            >
              {mission.status}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-slate-300">
            {mission.userRequest}
          </p>
          <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
            <span>ID {mission.id.slice(0, 8)}</span>
            <span>·</span>
            <span>{mission.createdAt}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-50">{progress.percent}%</div>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
              {progress.done}/{progress.total}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
            data-testid={`expand-btn-${mission.id}`}
          >
            <span className="font-mono uppercase tracking-[0.2em]">
              {open ? "reduire" : "etapes"}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {mission.error ? (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          <span className="font-mono uppercase tracking-[0.2em]">Erreur</span>{" "}
          {mission.error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canRun(mission.status) || loadingAction === "run"}
          onClick={() => onRun?.(mission)}
          data-testid={`run-btn-${mission.id}`}
          className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "run" ? "Demarrage" : "Demarrer"}
          </span>
        </button>
        <button
          type="button"
          disabled={!canRecover(mission.status) || loadingAction === "recover"}
          onClick={() => onRecover?.(mission)}
          data-testid={`recover-btn-${mission.id}`}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "recover" ? "Reprise" : "Recuperer"}
          </span>
        </button>
        <button
          type="button"
          disabled={!canReflect(mission.status) || loadingAction === "reflect"}
          onClick={() => onReflect?.(mission)}
          data-testid={`reflect-btn-${mission.id}`}
          className="flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-50 transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "reflect" ? "Analyse" : "Reflechir"}
          </span>
        </button>
      </div>

      {open ? (
        <section className="mt-5 space-y-3">
          {mission.steps.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune etape planifiee.</p>
          ) : (
            mission.steps.map((step) => (
              <MissionStepRow key={step.id} step={step} />
            ))
          )}
        </section>
      ) : null}
    </article>
  );
}
