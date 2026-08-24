import { Activity, Cpu, Network, RefreshCcw, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import MissionCard from "@/components/MissionCard";
import { useMissions } from "@/hooks/useMissions";
import type { CreateMissionRequest, Mission } from "@/lib/api";

const statusOptions: Array<{ label: string; value: CreateMissionRequest["autonomyLevel"] }> = [
  { label: "Tous statuts", value: undefined as unknown as CreateMissionRequest["autonomyLevel"] },
];

const statusFilterOptions: Array<{ label: string; value: Mission["status"] | undefined }> = [
  { label: "Tous", value: undefined },
  { label: "Brouillon", value: "draft" },
  { label: "Planifie", value: "planned" },
  { label: "En cours", value: "running" },
  { label: "En pause", value: "paused" },
  { label: "Termine", value: "completed" },
  { label: "Echec", value: "failed" },
  { label: "Annule", value: "cancelled" },
];

export default function Missions() {
  const {
    missions,
    missionsTotal,
    missionsLoading,
    missionsLastError,
    missionsFilter,
    refresh,
    create,
    run,
    recover,
    reflect,
    setMissionsFilter,
  } = useMissions();

  const [sessionId, setSessionId] = useState<string>(missionsFilter.sessionId ?? "");
  const [status, setStatus] = useState<Mission["status"] | undefined>(missionsFilter.status);
  const [limit, setLimit] = useState<number>(missionsFilter.limit ?? 20);

  const [request, setRequest] = useState<CreateMissionRequest>({
    userRequest: "",
    autonomyLevel: "semi-autonomous",
    provider: undefined,
    model: undefined,
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    setMissionsFilter({
      sessionId: sessionId.trim() || undefined,
      status,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
    });
  }, [sessionId, status, limit, setMissionsFilter]);

  const stats = useMemo(() => {
    const total = missions.length;
    const running = missions.filter((m) => m.status === "running").length;
    const completed = missions.filter((m) => m.status === "completed").length;
    const failed = missions.filter((m) => m.status === "failed").length;
    return { total, running, completed, failed, declaredTotal: missionsTotal };
  }, [missions, missionsTotal]);

  const onSubmitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    if (!request.userRequest.trim()) {
      setCreateError("La requete utilisateur est obligatoire.");
      return;
    }
    setCreateLoading(true);
    try {
      const created = await create({
        ...request,
        sessionId: sessionId.trim() || undefined,
      });
      if (!created) {
        setCreateError("Impossible de creer la mission (voir erreur generale).");
      } else {
        setRequest({ userRequest: "", autonomyLevel: "semi-autonomous", provider: undefined, model: undefined });
      }
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-violet-400/20 bg-slate-950/70 p-8 shadow-2xl shadow-violet-950/20 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-violet-300">
                Mission Engine
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white">
                Suivi, pilotage et reflexion sur les missions autonomes
                d&apos;aNtaerus.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Cette page liste les missions transférées depuis le brain Python
                via le gateway Go, propose les filtres `sessionId`, `status`,
                `limit`, et expose les actions `Demarrer`, `Recuperer` et
                `Reflechir`. Toute mise a jour transite par WebSocket sur le
                type `mission.update`.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-400/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-400/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Rafraichir
                </button>
                <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Total declare : {missionsTotal}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <MetricCard icon={Activity} label="Missions vues" value={String(stats.total)} />
              <MetricCard icon={Cpu} label="En cours" value={String(stats.running)} />
              <MetricCard icon={Network} label="Terminees" value={`${stats.completed} ok · ${stats.failed} KO`} />
            </div>
          </div>
        </section>

        {(missionsLastError || createError) && (
          <section className="space-y-3">
            {missionsLastError ? (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                {missionsLastError}
              </div>
            ) : null}
            {createError ? (
              <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100">
                {createError}
              </div>
            ) : null}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
          <aside className="space-y-6">
            <form
              onSubmit={(event) => void onSubmitCreate(event)}
              data-testid="create-mission-form"
              className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-violet-300" />
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">
                  Nouvelle mission
                </p>
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <label className="block space-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    Requete utilisateur
                  </span>
                  <textarea
                    value={request.userRequest}
                    onChange={(event) =>
                      setRequest((prev) => ({ ...prev, userRequest: event.target.value }))
                    }
                    className="h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-violet-400/50 focus:bg-white/[0.08]"
                    placeholder="Ex : scanner ma boite aux lettres et resumer les 3 plus importants messages recus"
                  />
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      Niveau autonomie
                    </span>
                    <select
                      value={request.autonomyLevel ?? "semi-autonomous"}
                      onChange={(event) =>
                        setRequest((prev) => ({
                          ...prev,
                          autonomyLevel: event.target.value as NonNullable<
                            CreateMissionRequest["autonomyLevel"]
                          >,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-violet-400/50"
                    >
                      <option value="guided">Guided</option>
                      <option value="semi-autonomous">Semi-autonomous</option>
                      <option value="fully-autonomous">Fully-autonomous</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      Limite affichage
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={limit}
                      onChange={(event) => setLimit(Number(event.target.value || 1))}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-violet-400/50"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      Session ID (filtre + create)
                    </span>
                    <input
                      type="text"
                      value={sessionId}
                      onChange={(event) => setSessionId(event.target.value)}
                      placeholder="session-xyz"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-violet-400/50"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      Statut
                    </span>
                    <select
                      value={status ?? ""}
                      onChange={(event) =>
                        setStatus(
                          (event.target.value || undefined) as Mission["status"] | undefined,
                        )
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-violet-400/50"
                    >
                      {statusFilterOptions.map((option) => (
                        <option key={option.value ?? "all"} value={option.value ?? ""}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/20 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-50 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" />
                  {createLoading ? "Creation" : "Creer mission"}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">
                Filtres rapides statut
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value ?? "all"}
                    type="button"
                    onClick={() => setStatus(option.value)}
                    className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] transition ${
                      status === option.value
                        ? "border border-violet-400/50 bg-violet-500/20 text-violet-50"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            {missionsLoading && missions.length === 0 ? (
              Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/5"
                />
              ))
            ) : missions.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-10 text-center text-sm text-slate-300">
                Aucune mission pour le moment. Utilisez le formulaire pour creer
                une premiere mission, puis cliquez sur `Demarrer` pour la
                soumettre au moteur Python.
              </div>
            ) : (
              missions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  mission={mission}
                  onRun={(current) => {
                    void run(current);
                  }}
                  onRecover={(current) => {
                    void recover(current);
                  }}
                  onReflect={(current) => {
                    void reflect(current);
                  }}
                />
              ))
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

type MetricCardProps = {
  icon: typeof Activity;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <Icon className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-lg font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

// re-export unused to avoid unused warnings if strict, and keep unused var import placeholder undefined value statusOptions if unused
void statusOptions;
