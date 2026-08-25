import {
  CheckCircle2,
  DatabaseZap,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AutonomySlider from "@/components/AutonomySlider";
import InitiativeCard, {
  initiativeStatusStyles,
} from "@/components/InitiativeCard";
import { useProactive } from "@/hooks/useProactive";
import type {
  CreateInitiativeRequest,
  Initiative,
  PatchInitiativeRequest,
} from "@/lib/api";

type CollectorStatusStyle = {
  color: string;
  label: string;
};

function collectorStatusStyle(status: string | null): CollectorStatusStyle {
  switch (status) {
    case "success":
      return {
        color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-100",
        label: "OK",
      };
    case "error":
      return {
        color: "bg-rose-500/20 border-rose-500/40 text-rose-100",
        label: "Erreur",
      };
    case "idle":
    default:
      return {
        color: "bg-slate-500/20 border-slate-500/40 text-slate-200",
        label: "Inactif",
      };
  }
}

type DecisionStyle = {
  color: string;
  label: string;
};

function patchDecisionStyle(decision: string): DecisionStyle {
  switch (decision) {
    case "approved":
      return {
        color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-100",
        label: "Approuve",
      };
    case "rejected":
      return {
        color: "bg-amber-500/20 border-amber-500/40 text-amber-100",
        label: "Rejete",
      };
    case "applied":
      return {
        color: "bg-teal-500/20 border-teal-500/40 text-teal-100",
        label: "Applique",
      };
    case "proposed":
    default:
      return {
        color: "bg-sky-500/20 border-sky-500/40 text-sky-100",
        label: "Propose",
      };
  }
}

export default function CommandCenter() {
  const proactive = useProactive();
  const {
    collectors,
    collectorsLoading,
    initiatives,
    initiativesLoading,
    initiativesLastError,
    globalAutonomyLevel,
    lastCuratorReport,
    curatorPatches,
    actionLoading,
    refreshAll,
    runCollector,
    runAllCollectors,
    create,
    run,
    patch,
    setGlobalAutonomyLevel,
    runCurator,
    approvePatch,
    rejectPatch,
    getScheduler,
    startScheduler,
    stopScheduler,
  } = proactive;

  const [scheduler, setScheduler] = useState<{
    running: boolean;
    cronHour: number;
  } | null>(null);

  const [request, setRequest] = useState<CreateInitiativeRequest>({
    title: "",
    description: "",
    triggerType: "manual",
    autonomyLevel: globalAutonomyLevel,
    budgetTokens: 1000,
  });

  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const status = await getScheduler();
      if (status) setScheduler(status);
    })();
  }, [getScheduler]);

  const initiativeStats = useMemo(() => {
    const total = initiatives.length;
    const running = initiatives.filter((i) => i.status === "running").length;
    const succeeded = initiatives.filter((i) => i.status === "succeeded")
      .length;
    const failed = initiatives.filter((i) => i.status === "failed").length;
    const pending = initiatives.filter((i) => i.status === "pending").length;
    return { total, running, succeeded, failed, pending };
  }, [initiatives]);

  const handleRunCollector = (name: string) => {
    void runCollector(name);
  };

  const handleRunAll = () => {
    void runAllCollectors();
  };

  const handleRunInitiative = (initiative: Initiative) => {
    void run(initiative);
  };

  const handlePatchInitiative = (
    initiative: Initiative,
    patchReq: PatchInitiativeRequest,
  ) => {
    void patch(initiative, patchReq);
  };

  const handleSubmitCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCreateError(null);
    if (!request.title.trim()) {
      setCreateError("Le titre de l'initiative est obligatoire.");
      return;
    }
    setCreateLoading(true);
    try {
      const created = await create(request);
      if (!created) {
        setCreateError("Impossible de creer l'initiative (voir erreur generale).");
      } else {
        setRequest({
          title: "",
          description: "",
          triggerType: "manual",
          autonomyLevel: globalAutonomyLevel,
          budgetTokens: 1000,
        });
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartScheduler = async () => {
    const next = await startScheduler();
    if (next) setScheduler(next);
  };

  const handleStopScheduler = async () => {
    const next = await stopScheduler();
    if (next) setScheduler(next);
  };

  return (
    <main
      data-testid="command-center-page"
      className="min-h-screen px-6 py-10 text-slate-100"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-sky-400/20 bg-slate-950/70 p-8 shadow-2xl shadow-sky-950/20 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-300">
                Command Center
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white">
                Moteur proactif : collecteurs, initiatives, curateur et
                autonomie.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Tableau de bord du moteur proactif M5. Les collecteurs produisent
                des alertes, le command center transforme les alertes en
                initiatives, le curateur nocturne genere rapport et patches, et
                le slider d'autonomie controle le niveau d'intervention humaine
                requis. Toute mise a jour transite par WebSocket
                `initiative.update`.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Rafraichir
                </button>
                <button
                  type="button"
                  onClick={handleRunAll}
                  disabled={!!actionLoading || collectorsLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  Lancer tous les collecteurs
                </button>
              </div>
            </div>
            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl">
              <AutonomySlider
                value={globalAutonomyLevel}
                onChange={setGlobalAutonomyLevel}
                disabled={false}
              />
              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-300" />
                    <span className="text-sm font-semibold text-slate-100">
                      Scheduler Curateur
                    </span>
                  </div>
                  {scheduler ? (
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${
                        scheduler.running
                          ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/40"
                          : "bg-slate-500/20 text-slate-200 border-slate-500/40"
                      }`}
                    >
                      {scheduler.running ? "Actif" : "Arrete"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Heure de declenchement UTC :{" "}
                  <span className="font-mono text-slate-200">
                    {scheduler ? scheduler.cronHour : 2}h
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleStartScheduler}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Demarrer scheduler
                  </button>
                  <button
                    type="button"
                    onClick={handleStopScheduler}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Arreter scheduler
                  </button>
                  <button
                    type="button"
                    onClick={() => void runCurator()}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <DatabaseZap className="h-4 w-4" />
                    Lancer curateur maintenant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          data-testid="collectors-panel"
          className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-slate-950/20"
        >
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl font-semibold text-white">Collecteurs</h2>
            </div>
            {collectorsLoading ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Chargement...
              </span>
            ) : null}
          </header>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {collectors.length === 0 ? (
              <p className="col-span-full text-sm text-slate-400">
                Aucun collecteur configure (tous desactives dans settings ou
                brain offline).
              </p>
            ) : (
              collectors.map((collector) => {
                const style = collectorStatusStyle(collector.lastStatus);
                return (
                  <div
                    key={collector.name}
                    data-testid={`collector-card-${collector.name}`}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-50">
                          {collector.name}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
                          {collector.lastRanAt
                            ? `Dernier run : ${collector.lastRanAt.slice(0, 19)}`
                            : "Pas encore de run"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${style.color}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRunCollector(collector.name)}
                      disabled={!collector.enabled || !!actionLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Run
                    </button>
                    {collector.lastError ? (
                      <p className="line-clamp-2 text-[11px] text-rose-300">
                        {collector.lastError}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div
            data-testid="create-initiative-form"
            className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-slate-950/20 lg:col-span-2"
          >
            <h2 className="text-xl font-semibold text-white">
              Nouvelle initiative
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Les initiatives sont executees par le brain Python.
            </p>
            <form
              onSubmit={handleSubmitCreate}
              className="mt-5 space-y-4"
              data-testid="create-initiative-form"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Titre
                </label>
                <input
                  type="text"
                  value={request.title}
                  onChange={(ev) =>
                    setRequest((r) => ({ ...r, title: ev.target.value }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-50 outline-none ring-sky-500/30 focus:ring-2"
                  placeholder="Par exemple : Relancer collecteur meteo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Description
                </label>
                <textarea
                  value={request.description ?? ""}
                  onChange={(ev) =>
                    setRequest((r) => ({ ...r, description: ev.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-50 outline-none ring-sky-500/30 focus:ring-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Trigger
                  </label>
                  <select
                    value={request.triggerType ?? "manual"}
                    onChange={(ev) =>
                      setRequest((r) => ({
                        ...r,
                        triggerType: ev.target.value as
                          | CreateInitiativeRequest["triggerType"]
                          | undefined,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-50 outline-none"
                  >
                    <option value="manual">Manuel</option>
                    <option value="schedule">Planifie</option>
                    <option value="alert">Alerte</option>
                    <option value="event">Evenement</option>
                    <option value="curator">Curateur</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Budget tokens
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={request.budgetTokens ?? 1000}
                    onChange={(ev) =>
                      setRequest((r) => ({
                        ...r,
                        budgetTokens: Math.max(0, Number(ev.target.value) || 0),
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-slate-50 outline-none"
                  />
                </div>
              </div>
              {createError ? (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {createError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={createLoading || !!actionLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Creer l'initiative
              </button>
            </form>
          </div>

          <div
            data-testid="initiatives-panel"
            className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-slate-950/20 lg:col-span-3"
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <h2 className="text-xl font-semibold text-white">Initiatives</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                  Total {initiativeStats.total}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${initiativeStatusStyles.running}`}
                >
                  En cours {initiativeStats.running}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${initiativeStatusStyles.succeeded}`}
                >
                  Succes {initiativeStats.succeeded}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${initiativeStatusStyles.failed}`}
                >
                  Echec {initiativeStats.failed}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 ${initiativeStatusStyles.pending}`}
                >
                  Pending {initiativeStats.pending}
                </span>
              </div>
            </header>
            {initiativesLoading ? (
              <p className="mt-6 text-sm text-slate-400">
                Chargement des initiatives...
              </p>
            ) : initiativesLastError ? (
              <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {initiativesLastError}
              </p>
            ) : initiatives.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">
                Aucune initiative pour le moment. Creez la premiere via le
                formulaire.
              </p>
            ) : (
              <div className="mt-6 flex max-h-[720px] flex-col gap-4 overflow-auto pr-1">
                {initiatives.map((initiative) => (
                  <InitiativeCard
                    key={initiative.id}
                    initiative={initiative}
                    onRun={handleRunInitiative}
                    onPatch={handlePatchInitiative}
                    loadingAction={actionLoading}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          data-testid="curator-panel"
          className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-slate-950/20"
        >
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DatabaseZap className="h-5 w-5 text-violet-300" />
              <h2 className="text-xl font-semibold text-white">
                Rapport nocturne & Patches
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void runCurator()}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-50 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Regenerer rapport
            </button>
          </header>
          {!lastCuratorReport ? (
            <p className="mt-6 text-sm text-slate-400">
              Aucun rapport nocturne disponible. Lancez le curateur manuellement
              ou patientez le prochain declenchement automatique.
            </p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-violet-300">
                    Rapport #{lastCuratorReport.id.slice(0, 8)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {lastCuratorReport.generatedAt}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {lastCuratorReport.summary || "Resume nocturne"}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Facts
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-50">
                      {lastCuratorReport.factsCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Patches proposes
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-50">
                      {lastCuratorReport.patchesCount}
                    </div>
                  </div>
                </div>
                {lastCuratorReport.notes?.length ? (
                  <ul className="mt-5 list-disc space-y-1 pl-5 text-xs text-slate-300">
                    {lastCuratorReport.notes.slice(0, 5).map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="lg:col-span-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Patches ({curatorPatches.length})
                </h3>
                {curatorPatches.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Aucun patch propose pour ce rapport.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {curatorPatches.map((patch) => {
                      const style = patchDecisionStyle(patch.decision);
                      return (
                        <div
                          key={patch.id}
                          data-testid={`patch-card-${patch.id}`}
                          className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-slate-50">
                                {patch.title}
                              </h4>
                              <span
                                className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${style.color}`}
                              >
                                {style.label}
                              </span>
                              {patch.requiresHuman ? (
                                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-100">
                                  Validation humaine
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              Cible {patch.targetType} / {patch.targetRef}
                            </p>
                            <p className="mt-2 text-xs text-slate-300">
                              {patch.rationale}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                patch.decision === "approved" ||
                                patch.decision === "applied" ||
                                !!actionLoading
                              }
                              onClick={() => void approvePatch(patch.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approuver
                            </button>
                            <button
                              type="button"
                              disabled={
                                patch.decision === "rejected" ||
                                !!actionLoading
                              }
                              onClick={() => void rejectPatch(patch.id)}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Rejeter
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
