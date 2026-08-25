import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, ShieldCheck, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import SkillEditor from "@/components/SkillEditor";
import SkillTester from "@/components/SkillTester";
import SkillMarketplace from "@/components/SkillMarketplace";
import { useAppStore } from "@/store/useAppStore";
import {
  approveSkill,
  generateSkillDraftFromUsage,
  installSkill,
  listSkills,
  rejectSkill,
  runSkillInSandbox,
  uninstallSkill,
  type SkillRecord,
  type SkillRuntime,
} from "@/lib/api";

type TabId = "marketplace" | "editor" | "tester";

const TABS: { id: TabId; label: string; hint: string; icon: typeof FlaskConical }[] = [
  { id: "marketplace", label: "Marketplace", hint: "Registre + demos", icon: ShieldCheck },
  { id: "editor", label: "Editeur", hint: "Code source + meta", icon: FlaskConical },
  { id: "tester", label: "Tester", hint: "Sandbox arguments / sortie", icon: CheckCircle2 },
];

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

export default function SkillLab() {
  const state = useAppStore((s) => ({
    skills: s.skills,
    skillsTotal: s.skillsTotal,
    skillsLoading: s.skillsLoading,
    skillsError: s.skillsLastError,
    skillRunResult: s.skillRunResult,
    skillRunLoading: s.skillRunLoading,
    setSkills: s.setSkills,
    setSkillsLoading: s.setSkillsLoading,
    setSkillsError: s.setSkillsError,
    addOrUpdateSkill: s.addOrUpdateSkill,
    removeSkill: s.removeSkill,
    setSkillRunResult: s.setSkillRunResult,
    setSkillRunLoading: s.setSkillRunLoading,
    setSkillEditorDraft: s.setSkillEditorDraft,
  }));

  const [tab, setTab] = useState<TabId>("marketplace");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [rejectingSkillId, setRejectingSkillId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveLoadingId, setApproveLoadingId] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const pendingApprovals = useMemo(
    () => state.skills.filter((s) => s.status === "pending_approval"),
    [state.skills],
  );

  const selectedSkill = useMemo<SkillRecord | null>(() => {
    if (selectedSkillId) {
      const found = state.skills.find((s) => s.id === selectedSkillId);
      if (found) return found;
    }
    const installed = state.skills.find((s) => s.status === "installed");
    return installed ?? null;
  }, [selectedSkillId, state.skills]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      state.setSkillsLoading(true);
      state.setSkillsError(null);
      try {
        const list = await listSkills();
        if (cancelled) return;
        state.setSkills(list.items, list.total);
      } catch (err) {
        if (cancelled) return;
        state.setSkillsError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) state.setSkillsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  const refreshSkills = async () => {
    state.setSkillsLoading(true);
    state.setSkillsError(null);
    try {
      const list = await listSkills();
      state.setSkills(list.items, list.total);
    } catch (err) {
      state.setSkillsError(err instanceof Error ? err.message : String(err));
    } finally {
      state.setSkillsLoading(false);
    }
  };

  const handleInstallFromEditor = async (payload: {
    name: string;
    version: string;
    description: string;
    runtime: SkillRuntime;
    category: string;
    author: string;
    sourceCode: string;
    trusted: boolean;
  }) => {
    state.setSkillsError(null);
    const created = await installSkill({
      name: payload.name,
      version: payload.version,
      description: payload.description,
      runtime: payload.runtime,
      category: payload.category,
      author: payload.author,
      sourceCode: payload.sourceCode,
      trusted: payload.trusted,
    });
    state.addOrUpdateSkill(created);
    if (created.status === "installed") {
      setSelectedSkillId(created.id);
    }
  };

  const handleUninstall = async (skillId: string) => {
    state.setSkillsError(null);
    await uninstallSkill(skillId);
    state.removeSkill(skillId);
    if (selectedSkillId === skillId) setSelectedSkillId(null);
  };

  const handleRun = async (skillId: string, argsJson: string) => {
    state.setSkillRunLoading(true);
    state.setSkillRunResult(null);
    try {
      const result = await runSkillInSandbox(skillId, {
        argsJson,
        timeoutMs: 30000,
        fuelLimit: 250000,
      });
      state.setSkillRunResult(result);
      return result;
    } finally {
      state.setSkillRunLoading(false);
    }
  };

  const handleGenerate = async (usage: string, runtime: SkillRuntime) => {
    setGenerateLoading(true);
    try {
      const draft = await generateSkillDraftFromUsage({
        usage,
        preferredRuntime: runtime,
      });
      state.setSkillEditorDraft(draft.sourceCode);
      const next = await installSkill({
        name: draft.name,
        version: draft.version || draft.suggestedVersion || "0.1.0",
        description: draft.description,
        runtime: draft.runtime,
        category: draft.category || "general",
        sourceCode: draft.sourceCode,
        trusted: false,
      });
      state.addOrUpdateSkill(next);
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleApprove = async (skillId: string) => {
    state.setSkillsError(null);
    try {
      setApproveLoadingId(skillId);
      const updated = await approveSkill(skillId);
      state.addOrUpdateSkill(updated);
    } catch (err) {
      state.setSkillsError(err instanceof Error ? err.message : String(err));
    } finally {
      setApproveLoadingId(null);
    }
  };

  const openRejectDialog = (skillId: string) => {
    setRejectingSkillId(skillId);
    setRejectReason("");
    setRejectError(null);
  };

  const closeRejectDialog = () => {
    setRejectingSkillId(null);
    setRejectError(null);
  };

  const confirmReject = async () => {
    if (!rejectingSkillId) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 8) {
      setRejectError("Motif trop court (min. 8 caracteres).");
      return;
    }
    try {
      const updated = await rejectSkill(rejectingSkillId, trimmed);
      state.addOrUpdateSkill(updated);
      closeRejectDialog();
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <header className="grid gap-5 rounded-3xl border border-white/10 bg-slate-950/40 p-6 backdrop-blur lg:grid-cols-[1fr_auto] items-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
            M7 · Skill Lab
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
            Registre, editeur et sandbox de skills Python / WASM
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Creez des skills depuis un usage decrit en langage naturel, validez les
            brouillons en attente avant installation, puis testez chaque skill dans un
            sandbox isole (Docker ou fallback local). Les skills installes sont
            disponibles pour toutes les missions M4, M5 et M6.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="emerald">Registre: {state.skillsTotal}</Badge>
          <Badge tone="amber">Approbations: {pendingApprovals.length}</Badge>
          <Badge tone="cyan">
            Selectionne: {selectedSkill ? selectedSkill.name.slice(0, 20) : "aucun"}
          </Badge>
        </div>
      </header>

      {pendingApprovals.length > 0 && (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-200/90">
                Approbations en attente
              </p>
              <Badge tone="amber">{pendingApprovals.length} skills</Badge>
            </div>
            <p className="text-xs text-slate-400">
              Synthese LLM ou skill non-trusted : validez humainement avant activation.
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingApprovals.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-white">
                    {s.name}
                  </h3>
                  <Badge tone="amber">pending approval</Badge>
                  <Badge tone={s.runtime === "wasm" ? "violet" : "cyan"}>
                    {s.runtime}
                  </Badge>
                  <span className="ml-auto font-mono text-[10px] text-slate-500">
                    v{s.version}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
                  {s.description || "Aucune description."}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprove(s.id)}
                    disabled={approveLoadingId === s.id}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500/20 px-3.5 py-2 text-xs font-medium text-emerald-100 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {approveLoadingId === s.id ? "..." : "Approuver"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openRejectDialog(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                    Rejeter
                  </button>
                  <span className="ml-auto font-mono text-[10px] text-slate-500">
                    Cree: {s.createdAt ? s.createdAt.slice(0, 19).replace("T", " ") : "n/a"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rejectingSkillId && (
        <section
          className="fixed inset-0 z-40 grid place-items-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={closeRejectDialog}
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-300" />
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-rose-200/80">
                Rejet de skill
              </p>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-white">
              Motif du rejet (min. 8 caracteres)
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Expliquez pourquoi ce skill ne peut pas etre installe. La raison sera
              ajoutee a la description pour audit.
            </p>
            <label className="mt-4 grid gap-1.5">
              <span className="text-xs text-slate-400">Motif</span>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: code suspect qui tente d'acceder au reseau."
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-rose-400/40"
              />
            </label>
            {rejectError && (
              <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {rejectError}
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRejectDialog}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="rounded-2xl bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-100 ring-1 ring-rose-400/25 hover:bg-rose-500/30"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </section>
      )}

      <nav
        aria-label="Onglets Skill Lab"
        className="inline-flex overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 p-1 backdrop-blur"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm transition ${
                active
                  ? "bg-white/10 text-white shadow-inner"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{t.label}</span>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:inline">
                {t.hint}
              </span>
            </button>
          );
        })}
      </nav>

      {tab === "marketplace" && (
        <SkillMarketplace
          skills={state.skills}
          loading={state.skillsLoading}
          total={state.skillsTotal}
          lastError={state.skillsError}
          onRefresh={refreshSkills}
          onSelect={(s) => setSelectedSkillId(s.id)}
          selectedId={selectedSkillId}
          onInstall={async (payload) => {
            const created = await installSkill({
              ...payload,
              author: payload.author || "curated-demo",
              version: payload.version || "0.1.0",
              trusted: true,
            });
            state.addOrUpdateSkill(created);
            if (created.status === "installed") setSelectedSkillId(created.id);
          }}
          onUninstall={handleUninstall}
        />
      )}

      {tab === "editor" && (
        <SkillEditor
          onInstall={handleInstallFromEditor}
          onGenerate={handleGenerate}
          generating={generateLoading}
        />
      )}

      {tab === "tester" && (
        <SkillTester
          skill={selectedSkill}
          onRun={handleRun}
          lastResult={state.skillRunResult}
          loading={state.skillRunLoading}
        />
      )}
    </div>
  );
}
