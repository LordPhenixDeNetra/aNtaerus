import { Activity, ChevronDown, ChevronRight, Info, Play, RefreshCcw, RotateCcw, Sparkles } from "lucide-react";
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

const statusLabels: Record<Mission["status"], string> = {
  draft: "Brouillon",
  planned: "Planifiée",
  running: "En cours",
  paused: "En pause",
  completed: "Terminée",
  failed: "Échec",
  cancelled: "Annulée",
};

const statusIconText: Record<Mission["status"], string> = {
  draft: "📝",
  planned: "📋",
  running: "⏳",
  paused: "⏸️",
  completed: "✅",
  failed: "❌",
  cancelled: "🚫",
};

function computeProgress(steps: MissionStep[]): { done: number; total: number; percent: number } {
  const total = steps.length;
  if (total === 0) return { done: 0, total: 0, percent: 0 };
  const done = steps.filter((s) => s.status === "completed" || s.status === "failed" || s.status === "skipped").length;
  return { done, total, percent: Math.round((done * 100) / total) };
}

function displayMissionTitle(mission: Mission): string {
  const title = mission.title?.trim();
  const hasGoodTitle =
    !!title &&
    title.length >= 3 &&
    // interdit placeholder génériques de 1 mot souvent utilisés par backend avant génération
    !/^[a-zA-Z]$/.test(title) &&
    title !== "Mission" &&
    title !== "Untitled";
  if (hasGoodTitle) return title;
  const req = mission.userRequest?.trim() ?? "";
  if (!req) return `Mission ${mission.id.slice(0, 8)}`;
  if (req.length <= 72) return req;
  return `${req.slice(0, 72)}…`;
}

function formatCreatedAt(createdAt: string | undefined | null): string {
  if (!createdAt) return "";
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return createdAt;
    return `Créée le ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return createdAt;
  }
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
function canRestart(status: Mission["status"]): boolean {
  return status === "completed" || status === "cancelled";
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
  const titleText = useMemo(() => displayMissionTitle(mission), [mission]);
  const dateText = useMemo(() => formatCreatedAt(mission.createdAt), [mission.createdAt]);
  const isCompleted = mission.status === "completed";
  const isFailed = mission.status === "failed";

  return (
    <article
      data-testid={`mission-card-${mission.id}`}
      className={`${styleCard} p-5`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 text-slate-300" aria-hidden="true" />
            <h3 className="truncate text-base font-semibold text-slate-50" title={mission.userRequest || titleText}>
              {titleText}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${statusStyles[mission.status]}`}
              title={`Statut de la mission : ${statusLabels[mission.status]}`}
            >
              <span className="normal-case tracking-normal text-[11px]" aria-hidden="true">{statusIconText[mission.status]}</span>
              {statusLabels[mission.status]}
            </span>
          </div>
          {mission.userRequest && mission.userRequest.trim() !== titleText.replace(/…$/, "") ? (
            <p className="mt-2 line-clamp-2 text-xs text-slate-300" title={mission.userRequest}>
              {mission.userRequest}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
            <span className="normal-case tracking-normal text-[11px] text-slate-300">{dateText}</span>
            {dateText ? <span aria-hidden="true">·</span> : null}
            <span title={`Identifiant technique de la mission (UUID) : ${mission.id}`} className="inline-flex items-center gap-1">
              <Info className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span>ID {mission.id.slice(0, 8)}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-2xl font-semibold text-slate-50">{progress.percent}%</div>
            <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                style={{ width: `${progress.percent}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.percent}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
              {progress.done}/{progress.total} étapes{isCompleted ? " terminées" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition"
            data-testid={`expand-btn-${mission.id}`}
            title={open ? "Masquer la liste détaillée des sous-étapes de cette mission" : "Afficher toutes les étapes planifiées, en cours ou terminées de cette mission"}
          >
            <span className="font-mono uppercase tracking-[0.2em]">
              {open ? "Réduire" : "Étapes"}
            </span>
            {open ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
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

      {isCompleted ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100" role="status" aria-live="polite">
          <span className="font-mono uppercase tracking-[0.2em]">Résultat</span>{" "}
          {(() => {
            if (mission.reflexionReport?.summary) return mission.reflexionReport.summary;
            const reversed = [...mission.steps].reverse();
            const lastCompleted = reversed.find((s) => s.status === "completed" && (s.description || s.result?.outputSummary || s.result?.outputDetail));
            if (lastCompleted) {
              const content = [
                lastCompleted.result?.outputSummary,
                lastCompleted.result?.outputDetail,
                lastCompleted.description,
              ].filter(Boolean).join(" — ");
              if (content) return content.length > 220 ? `${content.slice(0, 220)}…` : content;
            }
            return "Cette mission a été exécutée avec succès.";
          })()}
        </div>
      ) : null}

      {isFailed && !mission.error ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <span className="font-mono uppercase tracking-[0.2em]">Conseil</span>{" "}
          Cette mission a échoué. Cliquez sur « Récupérer » pour la reprendre à la dernière étape réussie, ou « Réfléchir » pour analyser l'échec.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {canRun(mission.status) ? (
          <button
            type="button"
            disabled={loadingAction === "run"}
            onClick={() => onRun?.(mission)}
            data-testid={`run-btn-${mission.id}`}
            className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-50 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            title={mission.status === "failed"
              ? "Relancer la mission à partir de la première étape qui a échoué (ou depuis le début)."
              : mission.status === "paused"
              ? "Reprendre l'exécution là où la mission avait été mise en pause."
              : "Lancer l'exécution des étapes planifiées de cette mission."}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span className="uppercase tracking-[0.2em]">
              {loadingAction === "run" ? "Démarrage" : "Démarrer"}
            </span>
          </button>
        ) : null}

        {canRestart(mission.status) ? (
          <button
            type="button"
            disabled={loadingAction === "run"}
            onClick={() => onRun?.(mission)}
            className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            title="Remettre cette mission à zéro et la relancer entièrement depuis le début (nouvelle exécution)."
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            <span className="uppercase tracking-[0.2em]">
              {loadingAction === "run" ? "Redémarrage" : "Relancer à neuf"}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          disabled={!canRecover(mission.status) || loadingAction === "recover"}
          onClick={() => onRecover?.(mission)}
          data-testid={`recover-btn-${mission.id}`}
          className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          title={canRecover(mission.status)
            ? "Reprendre la mission À PARTIR DE LA DERNIÈRE ÉTAPE RÉUSSIE (pas depuis le début). Utile si vous avez corrigé le problème qui avait causé l'échec ou la pause."
            : "Disponible seulement pour les missions en échec ou en pause. Aucun besoin de récupérer une mission qui n'a jamais planté."}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "recover" ? "Reprise" : "Récupérer"}
          </span>
        </button>
        <button
          type="button"
          disabled={!canReflect(mission.status) || loadingAction === "reflect"}
          onClick={() => onReflect?.(mission)}
          data-testid={`reflect-btn-${mission.id}`}
          className="flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          title={canReflect(mission.status)
            ? "Demander à l'IA d'analyser l'histoire complète de cette mission : ce qui a bien fonctionné, ce qui a échoué et pourquoi, et comment faire mieux la prochaine fois."
            : "L'analyse rétrospective ne s'applique qu'après la fin d'une mission (réussie ou en échec)."}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span className="uppercase tracking-[0.2em]">
            {loadingAction === "reflect" ? "Analyse" : "Réfléchir"}
          </span>
        </button>
      </div>

      {open ? (
        <section className="mt-5 space-y-3" aria-label={`Étapes de la mission ${mission.id.slice(0, 8)}`}>
          {mission.steps.length === 0 ? (
            <p className="text-xs text-slate-400">Aucune étape planifiée pour le moment. Attendez que le moteur calcule le plan d'exécution.</p>
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
