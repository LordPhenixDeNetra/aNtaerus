import { useState } from "react";
import { Play, RotateCcw, Server } from "lucide-react";
import type { SkillRecord, SkillRunResult } from "@/lib/api";

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "rose" | "amber" | "cyan" | "violet";
}) {
  const tones: Record<string, string> = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    rose: "border-rose-400/25 bg-rose-500/10 text-rose-200",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    violet: "border-violet-400/25 bg-violet-500/10 text-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function SkillTester({
  skill,
  onRun,
  lastResult,
  loading,
}: {
  skill: SkillRecord | null;
  onRun: (skillId: string, argsJson: string) => Promise<SkillRunResult> | SkillRunResult;
  lastResult: SkillRunResult | null;
  loading: boolean;
}) {
  const [argsJson, setArgsJson] = useState("{\n  \"ping\": 1\n}");
  const [parseError, setParseError] = useState<string | null>(null);
  const [sandboxWarning, setSandboxWarning] = useState<string | null>(null);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(argsJson);
      setArgsJson(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch (err) {
      setParseError(`JSON invalide: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRun = async () => {
    setParseError(null);
    setSandboxWarning(null);
    try {
      JSON.parse(argsJson);
    } catch (err) {
      setParseError(`JSON invalide: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!skill) {
      setParseError("Selectionnez un skill dans la liste Marketplace pour le tester.");
      return;
    }
    try {
      const out = await onRun(skill.id, argsJson);
      if (out.sandboxKind && out.sandboxKind.includes("fallback")) {
        setSandboxWarning("Docker absent : sandbox local non isole.");
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReset = () => {
    setParseError(null);
    setSandboxWarning(null);
    setArgsJson("{\n  \"ping\": 1\n}");
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
          Skill selectionne
        </p>
        {skill ? (
          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{skill.name}</h3>
              <Badge tone={skill.runtime === "wasm" ? "violet" : "cyan"}>
                {skill.runtime}
              </Badge>
              <Badge
                tone={
                  skill.status === "installed"
                    ? "emerald"
                    : skill.status === "pending_approval"
                      ? "amber"
                      : skill.status === "rejected"
                        ? "rose"
                        : "slate"
                }
              >
                {skill.status.replace("_", " ")}
              </Badge>
              <span className="ml-auto font-mono text-[11px] text-slate-500">
                v{skill.version}
              </span>
            </div>
            <p className="text-sm leading-6 text-slate-300">
              {skill.description || "Aucune description."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                <span className="font-mono uppercase tracking-[0.25em] text-slate-500">
                  Categorie
                </span>
                <p className="mt-1 text-slate-200">{skill.category || "general"}</p>
              </div>
              <div>
                <span className="font-mono uppercase tracking-[0.25em] text-slate-500">
                  Auteur
                </span>
                <p className="mt-1 text-slate-200">{skill.author || "inconnu"}</p>
              </div>
              <div>
                <span className="font-mono uppercase tracking-[0.25em] text-slate-500">
                  Checksum
                </span>
                <p className="mt-1 truncate font-mono text-slate-200">
                  {skill.checksum.slice(0, 16)}...
                </p>
              </div>
              <div>
                <span className="font-mono uppercase tracking-[0.25em] text-slate-500">
                  Installe le
                </span>
                <p className="mt-1 text-slate-200">
                  {skill.installedAt ? skill.installedAt.slice(0, 19).replace("T", " ") : "n/a"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">
            Aucun skill selectionne. Utilisez le Marketplace pour choisir un skill installe
            avant execution dans le sandbox.
          </div>
        )}
        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
              Arguments JSON
            </p>
            <button
              type="button"
              onClick={handleFormatJson}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Formater JSON
            </button>
          </div>
          <textarea
            rows={10}
            value={argsJson}
            onChange={(e) => setArgsJson(e.target.value)}
            spellCheck={false}
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-3 font-mono text-[12px] leading-6 text-slate-100 outline-none focus:border-emerald-400/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={loading || !skill || skill.status !== "installed"}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-4 py-2.5 font-medium text-emerald-100 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {loading ? "Execution..." : "TEST DANS SANDBOX"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            {parseError && (
              <span className="text-xs text-rose-300">{parseError}</span>
            )}
            {sandboxWarning && (
              <Badge tone="amber">
                <Server className="h-3 w-3" />
                {sandboxWarning}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
            Resultat sandbox
          </p>
          {lastResult && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lastResult.exitCode === 0 ? "emerald" : "rose"}>
                exit {lastResult.exitCode}
              </Badge>
              <Badge tone="cyan">{lastResult.durationMs} ms</Badge>
              {typeof lastResult.fuelUsed === "number" && (
                <Badge tone="violet">fuel {lastResult.fuelUsed}</Badge>
              )}
              <Badge tone={lastResult.sandboxKind?.includes("fallback") ? "amber" : "slate"}>
                {lastResult.sandboxKind || "sandbox"}
              </Badge>
            </div>
          )}
        </div>
        {lastResult ? (
          <div className="mt-4 grid gap-4">
            {lastResult.error && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {lastResult.error}
              </div>
            )}
            <div className="grid gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-300/80">
                stdout
              </p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/5 bg-slate-950/70 p-3 font-mono text-[12px] leading-6 text-emerald-200">
                {lastResult.stdout || "\u2014"}
              </pre>
            </div>
            <div className="grid gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-rose-300/80">
                stderr
              </p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/5 bg-slate-950/70 p-3 font-mono text-[12px] leading-6 text-rose-200">
                {lastResult.stderr || "\u2014"}
              </pre>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">
            Aucune execution. Lancez un test pour voir le resultat du sandbox ici.
          </div>
        )}
      </div>
    </section>
  );
}
