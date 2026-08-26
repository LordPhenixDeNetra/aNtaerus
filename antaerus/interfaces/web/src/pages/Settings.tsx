import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  addFilesystemAllowedRoot,
  fetchFilesystemAllowedRoots,
  fetchToolsSummary,
  removeFilesystemAllowedRoot,
  validateFilesystemAllowedRoot,
  type FilesystemAllowedRootsResponse,
  type ToolsSummaryResponse,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

type PathStatus =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "valid"; normalized: string; exists: boolean; is_dir: boolean; readable: boolean }
  | { kind: "error"; message: string };

function SourceBadge({ label, value }: { label: string; value: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
        value > 0
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-400"
      }`}
    >
      {label}
      <span className="font-mono">{value}</span>
    </span>
  );
}

export default function Settings() {
  const { language } = useAppStore((s) => s.config);
  const fr = language !== "en";

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<FilesystemAllowedRootsResponse | null>(null);
  const [summary, setSummary] = useState<ToolsSummaryResponse | null>(null);

  const [inputPath, setInputPath] = useState("");
  const [inputStatus, setInputStatus] = useState<PathStatus>({ kind: "idle" });
  const [addInProgress, setAddInProgress] = useState(false);
  const [flash, setFlash] = useState<{ level: "ok" | "err"; message: string } | null>(null);

  async function loadEverything() {
    setLoading(true);
    setLoadError(null);
    try {
      const [roots, summ] = await Promise.all([
        fetchFilesystemAllowedRoots(),
        fetchToolsSummary(),
      ]);
      setAllowed(roots);
      setSummary(summ);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEverything();
  }, []);

  useEffect(() => {
    if (!flash) {
      return;
    }
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const debouncedValidate = useMemo(() => {
    let timer: number | null = null;
    return (value: string) => {
      if (timer) {
        window.clearTimeout(timer);
      }
      setInputStatus({ kind: "validating" });
      if (!value.trim()) {
        setInputStatus({ kind: "idle" });
        return;
      }
      timer = window.setTimeout(async () => {
        try {
          const r = await validateFilesystemAllowedRoot(value);
          setInputStatus({
            kind: "valid",
            normalized: r.normalized,
            exists: r.exists,
            is_dir: r.is_dir,
            readable: r.readable,
          });
        } catch (e) {
          setInputStatus({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }, 350);
    };
  }, []);

  function onInputPathChange(v: string) {
    setInputPath(v);
    debouncedValidate(v);
  }

  async function onAdd() {
    const toAdd =
      inputStatus.kind === "valid" ? inputStatus.normalized : inputPath.trim();
    if (!toAdd) {
      setFlash({ level: "err", message: fr ? "Chemin vide." : "Empty path." });
      return;
    }
    setAddInProgress(true);
    try {
      const resp = await addFilesystemAllowedRoot(toAdd);
      setFlash({
        level: "ok",
        message: fr
          ? `Dossier ajouté : ${resp.added}`
          : `Folder added: ${resp.added}`,
      });
      setInputPath("");
      setInputStatus({ kind: "idle" });
      void loadEverything();
    } catch (e) {
      setFlash({
        level: "err",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAddInProgress(false);
    }
  }

  async function onRemove(path: string) {
    try {
      const resp = await removeFilesystemAllowedRoot(path);
      setFlash({
        level: "ok",
        message: resp.existed
          ? fr
            ? `Dossier retiré : ${resp.removed}`
            : `Folder removed: ${resp.removed}`
          : fr
            ? `Dossier non présent en préférences utilisateur.`
            : `Folder not present in user preferences.`,
      });
      void loadEverything();
    } catch (e) {
      setFlash({
        level: "err",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const allowedMerged = allowed?.allowed_roots ?? [];
  const sqlUserPaths: string[] = allowed?.source
    ? // On considère que le user ne peut retirer QUE les chemins qu'il a ajoutés via NIV4
      // Pour distinguer: allowed_roots fusionné - (yaml + overlay + env). On ne les compte
      // pas individuellement car on n'a pas la décomposition exacte. On propose donc
      // de retirer TOUS les chemins de la fusion (le backend normalise + compare, donc
      // un chemin provenant de yaml/overlay/env retournera existed=false avec un message).
      []
    : [];

  const inputValid =
    inputStatus.kind === "valid" &&
    inputStatus.exists &&
    inputStatus.is_dir &&
    inputStatus.readable;

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.3 · Settings
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {fr ? "Paramètres & Dossiers Autorisés" : "Settings & Allowed Folders"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                {fr
                  ? "Gérez les répertoires du système de fichiers que l'agent peut parcourir. Les chemins sont validés sur le serveur avant insertion."
                  : "Manage the filesystem directories the agent can browse. Paths are validated on the server before insertion."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadEverything()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {fr ? "Actualiser" : "Refresh"}
            </button>
          </div>
          {flash ? (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                flash.level === "ok"
                  ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-400/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {flash.message}
            </div>
          ) : null}
        </header>

        <section className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-slate-950/60 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {fr ? "Dossiers Autorisés (allowed_roots)" : "Allowed Folders (allowed_roots)"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">
                {fr
                  ? "Fusion 4 niveaux (priorité ↑) : tools.yaml → tools.user.yaml (overlay) → variable d'environnement → préférences utilisateur SQL. Niveau 4 = cette page."
                  : "4-layer merge (priority ↑): tools.yaml → tools.user.yaml (overlay) → env var → user SQL preferences. Layer 4 = this page."}
              </p>
            </div>
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {loadError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <SourceBadge
              label={fr ? "1 · yaml  :" : "1 · yaml  :"}
              value={allowed?.source?.yaml ?? 0}
            />
            <SourceBadge
              label={fr ? "2 · overlay:" : "2 · overlay:"}
              value={allowed?.source?.overlay ?? 0}
            />
            <SourceBadge
              label={fr ? "3 · env    :" : "3 · env    :"}
              value={allowed?.source?.env ?? 0}
            />
            <SourceBadge
              label={fr ? "4 · sql    :" : "4 · sql    :"}
              value={allowed?.source?.user_preferences_sql ?? 0}
            />
            <span className="ml-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {fr ? "Total fusionné" : "Merged total"}
              <span className="font-mono text-slate-100">{allowedMerged.length}</span>
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs font-medium uppercase tracking-widest text-slate-400">
              {fr ? "Ajouter un dossier" : "Add a folder"}
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 focus-within:border-emerald-400/60">
                  <FolderOpen className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={inputPath}
                    onChange={(e) => onInputPathChange(e.target.value)}
                    placeholder={
                      fr
                        ? "Chemin absolu ou relatif (ex: ./docs , C:/Projets)"
                        : "Absolute or relative path (e.g. ./docs , C:/Projects)"
                    }
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                  {inputStatus.kind === "validating" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                  ) : inputStatus.kind === "valid" ? (
                    inputValid ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-400" />
                    )
                  ) : inputStatus.kind === "error" ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : null}
                </div>
                <div className="mt-2 min-h-[1.25rem] text-xs text-slate-400">
                  {inputStatus.kind === "valid" ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-black/40 px-2 py-0.5 font-mono">
                        {inputStatus.normalized}
                      </code>
                      <span
                        className={
                          inputStatus.exists
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {inputStatus.exists ? (fr ? "existe" : "exists") : (fr ? "introuvable" : "not found")}
                      </span>
                      <span
                        className={
                          inputStatus.is_dir
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {inputStatus.is_dir
                          ? fr
                            ? "dossier"
                            : "directory"
                          : fr
                            ? "pas un dossier"
                            : "not a directory"}
                      </span>
                      <span
                        className={
                          inputStatus.readable
                            ? "text-emerald-300"
                            : "text-amber-300"
                        }
                      >
                        {inputStatus.readable
                          ? fr
                            ? "lisible"
                            : "readable"
                          : fr
                            ? "illisible"
                            : "unreadable"}
                      </span>
                    </span>
                  ) : inputStatus.kind === "error" ? (
                    <span className="text-rose-300">{inputStatus.message}</span>
                  ) : inputStatus.kind === "validating" ? (
                    <span className="text-slate-400">
                      {fr ? "Validation côté serveur…" : "Server-side validation…"}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {fr
                        ? "La validation est automatique après 350 ms d'inactivité."
                        : "Auto-validates 350 ms after you stop typing."}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={addInProgress || !inputPath.trim() || (inputStatus.kind === "valid" && !inputValid)}
                onClick={() => void onAdd()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {addInProgress ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {fr ? "Ajouter" : "Add"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                {fr ? "Chemins fusionnés (final)" : "Merged paths (final)"}
              </h3>
              <span className="text-xs text-slate-500">
                {summary?.filesystem?.overlay_path ? (
                  <span>
                    overlay · <code className="font-mono">{summary.filesystem.overlay_path}</code>
                  </span>
                ) : null}
              </span>
            </div>
            {loading && !allowed ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                {fr ? "Chargement…" : "Loading…"}
              </div>
            ) : allowedMerged.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                <Shield className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                {fr
                  ? "Aucun dossier autorisé pour l'instant. Ajoutez-en un ci-dessus."
                  : "No allowed folders yet. Add one above."}
              </div>
            ) : (
              <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
                {allowedMerged.map((p) => (
                  <li
                    key={p}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <FolderOpen className="h-4 w-4 text-slate-400" />
                    <code className="flex-1 break-all rounded-md bg-black/40 px-2 py-1 font-mono text-slate-200">
                      {p}
                    </code>
                    <button
                      type="button"
                      onClick={() => void onRemove(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
                      title={
                        fr
                          ? "Retirer de la couche SQL préférences (si le chemin vient d'une autre couche, existed=false)."
                          : "Remove from SQL user preferences layer (if from another layer, existed=false)."
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {fr ? "Retirer" : "Remove"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {fr
                ? "Note: retirer un chemin provenant de tools.yaml / overlay.yaml / env var retournera 'non présent' (il faut modifier la source). Seuls les ajouts via cette page (NIV 4 SQL) sont réellement supprimables ici."
                : "Note: removing a path from tools.yaml / overlay.yaml / env var will return 'not present' (edit the source). Only paths added via this page (LAYER 4 SQL) are truly deletable here."}
              {sqlUserPaths.length > 0 ? (
                <span className="ml-1 text-slate-400">
                  {fr ? "SQL user only:" : "SQL user only:"}{" "}
                  <code className="font-mono">{sqlUserPaths.join(", ")}</code>
                </span>
              ) : null}
            </p>
          </div>
        </section>

        {summary ? (
          <section className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-slate-950/60 p-8 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200">
                <FileCodeIcon />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {fr ? "État outils (summary)" : "Tools summary"}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  tools.yaml ·{" "}
                  <code className="font-mono text-slate-400">{summary.tools_config_path}</code>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <StatCard
                label={fr ? "Outils déclarés" : "Declared tools"}
                value={summary.tools.tools.length}
              />
              <StatCard
                label={fr ? "Filesystem" : "Filesystem"}
                value={summary.filesystem_enabled ? (fr ? "ON" : "ON") : (fr ? "OFF" : "OFF")}
                ok={summary.filesystem_enabled}
              />
              <StatCard
                label={fr ? "CLI" : "CLI"}
                value={summary.cli_enabled ? (fr ? "ON" : "ON") : (fr ? "OFF" : "OFF")}
                ok={summary.cli_enabled}
              />
              <StatCard
                label={fr ? "Dossiers autorisés" : "Allowed folders"}
                value={summary.filesystem.allowed_roots.length}
              />
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 text-xs">
              <ul className="divide-y divide-white/5">
                {summary.tools.tools.map((t) => (
                  <li key={t.name} className="flex flex-wrap items-center gap-2 py-2">
                    <code className="font-mono text-emerald-300">{t.name}</code>
                    {t.category ? (
                      <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                        {t.category}
                      </span>
                    ) : null}
                    <span className="ml-2 flex-1 text-slate-300">
                      {t.description ?? (fr ? "— pas de description —" : "— no description —")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  ok,
}: {
  label: string;
  value: string | number;
  ok?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        ok === undefined
          ? "border-white/10 bg-white/5"
          : ok
            ? "border-emerald-400/30 bg-emerald-500/10"
            : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
      <div
        className={`mt-1 font-mono text-2xl ${
          ok === undefined
            ? "text-slate-100"
            : ok
              ? "text-emerald-200"
              : "text-slate-500"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FileCodeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
