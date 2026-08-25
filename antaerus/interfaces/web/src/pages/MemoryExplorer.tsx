import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Database, GitBranch } from "lucide-react";
import FactCard from "@/components/FactCard";
import FactGraph from "@/components/FactGraph";
import { useAppStore } from "@/store/useAppStore";
import {
  createOrUpdateFact,
  fetchFactGraph,
  listFacts,
  type FactRecord,
} from "@/lib/api";

export default function MemoryExplorer() {
  const {
    memoryFacts,
    memoryFactsLoading,
    memoryFactsLastError,
    memoryGraph,
    memoryGraphLoading,
    setMemoryFacts,
    setMemoryFactsLoading,
    setMemoryFactsError,
    addOrUpdateMemoryFact,
    setMemoryGraph,
    setMemoryGraphLoading,
  } = useAppStore();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState<"list" | "graph">("list");
  const [draft, setDraft] = useState<Partial<FactRecord>>({
    title: "",
    content: "",
    category: "general",
    tags: [],
    confidence: 0.85,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    memoryFacts.forEach((f) => f.category && set.add(f.category));
    return Array.from(set);
  }, [memoryFacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memoryFacts.filter((f) => {
      if (category && f.category !== category) return false;
      if (!q) return true;
      return (
        (f.title || "").toLowerCase().includes(q) ||
        (f.content || "").toLowerCase().includes(q) ||
        (f.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [memoryFacts, query, category]);

  async function refresh() {
    try {
      setMemoryFactsLoading(true);
      setMemoryGraphLoading(true);
      setMemoryFactsError(null);
      const [factsResp, graphResp] = await Promise.all([
        listFacts({ limit: 100 }),
        fetchFactGraph(),
      ]);
      setMemoryFacts(factsResp.facts);
      setMemoryGraph(graphResp);
    } catch (e) {
      setMemoryFactsError(e instanceof Error ? e.message : "Erreur chargement memoire");
    } finally {
      setMemoryFactsLoading(false);
      setMemoryGraphLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submitFact(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title && !draft.content) return;
    const payload: Parameters<typeof createOrUpdateFact>[0] = {
      id: draft.id ?? undefined,
      subject: draft.subject ?? undefined,
      predicate: draft.predicate ?? undefined,
      object: draft.object ?? undefined,
      title: draft.title ?? undefined,
      content: draft.content ?? "",
      category: (draft.category as FactRecord["category"]) || "general",
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      confidence: Number(draft.confidence ?? 0.8),
      status: draft.status ?? "active",
    };
    const upserted = await createOrUpdateFact(payload);
    addOrUpdateMemoryFact(upserted);
    setDraft({ title: "", content: "", category: "general", tags: [], confidence: 0.85 });
    void refresh();
  }

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.1 · Memoire semantique
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Explorateur memoire
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Recherche, creation et visualisation des faits semantiques
                stockes dans le brain Python. Graphe SVG fait main, zero
                dependance externe.
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              data-testid="memory-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un fait (titre, contenu, tag)"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
            >
              <option value="">Toutes categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 inline-flex gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
            {([
              ["list", "Liste", Database],
              ["graph", "Graphe", GitBranch],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                  tab === key
                    ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/20"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {tab === "list" ? "Faits semantiques" : "Graphe des relations"}
              </h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                {tab === "list" ? `${filtered.length} / ${memoryFacts.length}` : "relations"}
              </span>
            </div>

            <div className="mt-6">
              {memoryFactsLoading && tab === "list" ? (
                <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
                  Chargement memoire...
                </p>
              ) : tab === "graph" ? (
                memoryGraphLoading || !memoryGraph ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
                    Graphe indisponible.
                  </p>
                ) : (
                  <FactGraph graph={memoryGraph} />
                )
              ) : filtered.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
                  Aucun fait correspondant.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((f) => (
                    <FactCard
                      key={f.id}
                      fact={f}
                      onUpdate={(next) => {
                        setDraft({
                          id: next.id,
                          title: next.title,
                          content: next.content,
                          category: next.category,
                          tags: next.tags,
                          confidence: next.confidence,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
              {memoryFactsLastError ? (
                <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {memoryFactsLastError}
                </p>
              ) : null}
            </div>
          </section>

          <form
            onSubmit={submitFact}
            className="sticky top-6 self-start space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur"
          >
            <h2 className="text-lg font-semibold text-white">Nouveau fait</h2>
            <input
              type="hidden"
              name="id"
              value={draft.id || ""}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
            />
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Titre
              </label>
              <input
                type="text"
                value={draft.title || ""}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                placeholder="Ex: Adresse du gateway par defaut"
              />
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Contenu
              </label>
              <textarea
                value={draft.content || ""}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                placeholder="Description detaillee semantique..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Categorie
                </label>
                <input
                  type="text"
                  value={draft.category || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Confiance
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={Number(draft.confidence ?? 0.8)}
                  onChange={(e) => setDraft((d) => ({ ...d, confidence: Number(e.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Tags (separes par des virgules)
              </label>
              <input
                type="text"
                value={(draft.tags || []).join(", ")}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                placeholder="setup, config, reference"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-cyan-500/15 py-3 text-sm font-medium text-cyan-200 ring-1 ring-cyan-400/30 transition hover:bg-cyan-500/25"
            >
              Enregistrer le fait
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
