import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { MissionStep } from "@/lib/api";

type MissionStepProps = {
  step: MissionStep;
};

const stepStatusStyles: Record<MissionStep["status"], { dot: string; text: string; border: string; pill: string }> = {
  pending: {
    dot: "text-slate-500",
    text: "text-slate-400",
    border: "border-slate-700/60",
    pill: "bg-slate-500/10 text-slate-300",
  },
  running: {
    dot: "text-sky-400 animate-pulse",
    text: "text-sky-100",
    border: "border-sky-400/40",
    pill: "bg-sky-500/20 text-sky-100",
  },
  completed: {
    dot: "text-emerald-400",
    text: "text-emerald-50",
    border: "border-emerald-400/40",
    pill: "bg-emerald-500/20 text-emerald-50",
  },
  failed: {
    dot: "text-rose-500",
    text: "text-rose-50",
    border: "border-rose-500/50",
    pill: "bg-rose-500/20 text-rose-50",
  },
  skipped: {
    dot: "text-slate-500",
    text: "text-slate-400",
    border: "border-slate-700/60",
    pill: "bg-slate-500/10 text-slate-300",
  },
};

function StatusIcon({ status }: { status: MissionStep["status"] }) {
  const className = `h-5 w-5 flex-shrink-0 ${stepStatusStyles[status].dot}`;
  if (status === "running") {
    return <Loader2 data-testid="icon-running" className={`${className} animate-spin`} />;
  }
  if (status === "completed") {
    return <CheckCircle2 data-testid="icon-completed" className={className} />;
  }
  if (status === "failed") {
    return <XCircle data-testid="icon-failed" className={className} />;
  }
  return <Circle data-testid="icon-pending" className={className} />;
}

export default function MissionStepRow({ step }: MissionStepProps) {
  const [open, setOpen] = useState(false);
  const styles = stepStatusStyles[step.status];
  const hasDetails = Boolean(
    step.description || step.toolName || step.toolArgs || step.result,
  );
  return (
    <div
      data-testid={`mission-step-${step.id}`}
      className={`rounded-3xl border ${styles.border} bg-white/5 px-4 py-3 shadow-lg shadow-slate-950/20 backdrop-blur`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 text-left"
      >
        <StatusIcon status={step.status} />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
            {String(step.index + 1).padStart(2, "0")}
          </span>
          <h4 className={`min-w-0 flex-1 truncate text-sm font-semibold ${styles.text}`}>
            {step.title}
          </h4>
          <span
            data-testid={`step-status-pill-${step.id}`}
            className={`rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${styles.pill}`}
          >
            {step.status}
          </span>
        </div>
        {hasDetails ? (
          open ? (
            <ChevronDown className="h-4 w-4 text-slate-400" data-testid="chevron-down" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" data-testid="chevron-right" />
          )
        ) : null}
      </button>
      {open && hasDetails ? (
        <div className="mt-3 space-y-3 border-t border-white/5 pt-3 pl-8 text-xs text-slate-300">
          {step.description ? <p>{step.description}</p> : null}
          {step.toolName ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
                Outil
              </p>
              <p className="font-mono text-[11px] text-slate-200">{step.toolName}</p>
              {step.toolArgs ? (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-400">
                  {JSON.stringify(step.toolArgs, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}
          {step.result ? (
            <div data-testid={`step-result-${step.id}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
                Resultat
              </p>
              {step.result.outputSummary ? (
                <p className="text-slate-200">{step.result.outputSummary}</p>
              ) : null}
              {step.result.durationMs ? (
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  duree : {step.result.durationMs} ms
                </p>
              ) : null}
              {step.result.error ? (
                <p className="mt-2 font-mono text-[11px] text-rose-300">{step.result.error}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
