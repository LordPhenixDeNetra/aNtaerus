import { useMemo } from "react";
import { Lock, RefreshCw, ServerCog } from "lucide-react";
import type { ConfigSnapshot } from "@/lib/api";

type Props = {
  snapshot: ConfigSnapshot | null;
  loading?: boolean;
  onRefresh?: () => void;
};

export default function ConfigForm({ snapshot, loading, onRefresh }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<ConfigSnapshot["settings"]>>();
    (snapshot?.settings ?? []).forEach((s) => {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    });
    return map;
  }, [snapshot]);

  return (
    <form
      className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur"
      data-testid="config-form"
      onSubmit={(e) => e.preventDefault()}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1">
            <Lock className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-300">
              Lecture seule
            </span>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            Snapshot configuration runtime
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            Etat immuable des services au demarrage. Toute modification requiert
            un redemarrage planifie des couches correspondantes.
          </p>
        </div>
        {typeof onRefresh === "function" ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Rafraichir
          </button>
        ) : null}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
            Version snapshot
          </p>
          <p className="mt-2 font-mono text-sm text-slate-100">
            {snapshot?.snapshotVersion ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
            Pris le
          </p>
          <p className="mt-2 font-mono text-sm text-slate-100">
            {snapshot?.takenAt ? new Date(snapshot.takenAt).toLocaleString() : "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
            Nombre de cles
          </p>
          <p className="mt-2 font-mono text-sm text-slate-100">
            {snapshot?.settings.length ?? 0}
          </p>
        </div>
      </section>

      {loading || !snapshot ? (
        <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          Chargement du snapshot...
        </p>
      ) : grouped.size === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          Aucun parametre declare.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category} className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
              <header className="flex items-center gap-2">
                <ServerCog className="h-4 w-4 text-slate-300" />
                <h3 className="font-mono text-xs uppercase tracking-[0.28em] text-slate-300">
                  {category}
                </h3>
                <span className="ml-auto font-mono text-[11px] text-slate-500">
                  {items.length} cle(s)
                </span>
              </header>
              <div className="mt-4 divide-y divide-white/5">
                {items.map((item) => (
                  <div
                    key={`${category}-${item.key}`}
                    className="grid gap-3 py-4 md:grid-cols-[0.9fr_1.1fr_auto] md:items-start"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{item.key}</p>
                      {item.description ? (
                        <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                      ) : null}
                    </div>
                    <div>
                      <input
                        readOnly
                        type={item.sensitive ? "password" : "text"}
                        value={item.sensitive ? "••••••••" : String(item.value ?? "")}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100"
                      />
                    </div>
                    <div className="flex items-center gap-2 md:justify-end">
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-mono ${
                          item.sensitive
                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                            : "border-white/10 bg-white/5 text-slate-300"
                        }`}
                      >
                        {item.sensitive ? "SENSIBLE" : "PUBLIC"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono text-slate-400">
                        {item.source || "runtime"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        La modification a chaud des parametres runtime n&apos;est pas supportee
        (CDC §5.1). Utilisez les fichiers .env sous chaque module puis
        redemarrez les services concernes via la page Sante systeme.
      </p>
    </form>
  );
}
