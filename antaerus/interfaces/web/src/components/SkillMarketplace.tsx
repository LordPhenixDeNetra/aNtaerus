import { useMemo, useState } from "react";
import { Download, Package, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import type { SkillRecord, SkillRuntime, SkillStatus } from "@/lib/api";

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

export default function SkillMarketplace({
  skills,
  loading,
  total,
  lastError,
  onRefresh,
  onSelect,
  selectedId,
  onInstall,
  onUninstall,
}: {
  skills: SkillRecord[];
  loading: boolean;
  total: number;
  lastError: string | null;
  onRefresh: () => void;
  onSelect: (skill: SkillRecord) => void;
  selectedId: string | null;
  onInstall?: (payload: {
    name: string;
    version: string;
    description: string;
    runtime: SkillRuntime;
    category: string;
    author?: string;
    sourceCode: string;
  }) => Promise<void> | void;
  onUninstall?: (skillId: string) => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [runtimeFilter, setRuntimeFilter] = useState<"all" | SkillRuntime>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SkillStatus>("all");
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [installDemoError, setInstallDemoError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (runtimeFilter !== "all" && s.runtime !== runtimeFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.author.toLowerCase().includes(q)
      );
    });
  }, [skills, search, runtimeFilter, statusFilter]);

  const demoSkills: Array<{
    name: string;
    description: string;
    runtime: SkillRuntime;
    category: string;
    code: string;
  }> = [
    {
      name: "echo-json",
      description: "Skill echo stdlib : retourne args + timestamp iso.",
      runtime: "python",
      category: "assistant",
      code: `import json
import datetime


def main(args: dict) -> dict:
    return {
        "ok": True,
        "echo": args,
        "now": datetime.datetime.utcnow().isoformat() + "Z",
    }


if __name__ == "__main__":
    import sys

    payload = {}
    if len(sys.argv) > 1:
        payload = json.loads(sys.argv[1])
    print(json.dumps(main(payload)))
`,
    },
    {
      name: "sha256-hasher",
      description: "Hash en sha256 du champ 'input' fourni dans args JSON.",
      runtime: "python",
      category: "data",
      code: `import hashlib
import json


def main(args: dict) -> dict:
    raw = args.get("input", "")
    if isinstance(raw, (dict, list)):
        raw = json.dumps(raw, sort_keys=True)
    digest = hashlib.sha256(str(raw).encode("utf-8")).hexdigest()
    return {"ok": True, "sha256": digest, "size": len(str(raw))}


if __name__ == "__main__":
    import sys

    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    print(json.dumps(main(payload)))
`,
    },
    {
      name: "wasm-add-forty-two",
      description: "Exemple WAT minimal : ajoute 42 a l'entier i32 fourni.",
      runtime: "wasm",
      category: "system",
      code: `(module
  (func (export "run") (param i32) (result i32)
    local.get 0
    i32.const 42
    i32.add)
  (memory (export "memory") 1))
`,
    },
  ];

  const handleInstallDemo = async (
    demo: (typeof demoSkills)[number],
  ) => {
    setInstallDemoError(null);
    try {
      await onInstall?.({
        name: demo.name,
        version: "0.1.0",
        description: demo.description,
        runtime: demo.runtime,
        category: demo.category,
        sourceCode: demo.code,
      });
    } catch (err) {
      setInstallDemoError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUninstall = async (skillId: string) => {
    if (!onUninstall) return;
    try {
      setUninstallingId(skillId);
      await onUninstall(skillId);
    } finally {
      setUninstallingId(null);
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
              Registre local
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Skills installes
              <span className="ml-3 font-mono text-sm text-slate-500">
                {filtered.length} / {total}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] items-stretch">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom / description / auteur..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-400/40"
            />
          </div>
          <select
            value={runtimeFilter}
            onChange={(e) => setRuntimeFilter(e.target.value as typeof runtimeFilter)}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
          >
            <option value="all">Tous runtimes</option>
            <option value="python">PYTHON</option>
            <option value="wasm">WASM</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
          >
            <option value="all">Tous statuts</option>
            <option value="installed">installe</option>
            <option value="pending_approval">en attente</option>
            <option value="disabled">desactive</option>
            <option value="rejected">rejete</option>
          </select>
        </div>
        {lastError && (
          <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {lastError}
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 animate-pulse h-44"
              />
            ))
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400 md:col-span-2">
              Aucun skill pour cette combinaison de filtres. Installez un des exemples
              disponibles sur la droite ou utilisez l&apos;Editeur.
            </div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                  selectedId === s.id
                    ? "border-emerald-400/40 bg-emerald-500/5 ring-1 ring-emerald-400/20"
                    : "border-white/10 bg-slate-950/50 hover:bg-white/5"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">
                    <Package className="h-4 w-4 text-slate-200" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">{s.name}</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      v{s.version} · {s.category}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <Badge tone={s.runtime === "wasm" ? "violet" : "cyan"}>
                      {s.runtime}
                    </Badge>
                    <Badge
                      tone={
                        s.status === "installed"
                          ? "emerald"
                          : s.status === "pending_approval"
                            ? "amber"
                            : s.status === "rejected"
                              ? "rose"
                              : "slate"
                      }
                    >
                      {s.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
                  {s.description || "Aucune description."}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                    Selectionner pour tester
                  </span>
                  {onUninstall && (
                    <span className="ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUninstall(s.id);
                        }}
                        disabled={uninstallingId === s.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {uninstallingId === s.id ? "..." : "Desinstaller"}
                      </button>
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
              Marketplace · Curated demos
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Demarrez avec des exemples
            </h2>
          </div>
          <Badge tone="emerald">stdlib 0 dep</Badge>
        </div>
        {installDemoError && (
          <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {installDemoError}
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {demoSkills.map((demo) => {
            const already = skills.find((s) => s.name === demo.name);
            return (
              <div
                key={demo.name}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    {demo.runtime === "wasm" ? (
                      <Download className="h-4 w-4 text-violet-200" />
                    ) : (
                      <Upload className="h-4 w-4 text-cyan-200" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{demo.name}</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      {demo.runtime} · {demo.category}
                    </p>
                  </div>
                  <span className="ml-auto">
                    <Badge tone={demo.runtime === "wasm" ? "violet" : "cyan"}>
                      {demo.runtime}
                    </Badge>
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {demo.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <pre className="max-h-28 max-w-full flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-slate-950/70 p-3 font-mono text-[10px] leading-5 text-slate-300">
                    {demo.code.slice(0, 280)}
                    {demo.code.length > 280 ? "\n..." : ""}
                  </pre>
                  <button
                    type="button"
                    disabled={Boolean(already) || !onInstall}
                    onClick={() => void handleInstallDemo(demo)}
                    className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {already ? "Deja present" : "Installer demo"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
