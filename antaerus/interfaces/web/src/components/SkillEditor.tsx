import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Save, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { SkillRuntime } from "@/lib/api";

export default function SkillEditor({
  onInstall,
  onGenerate,
  generating,
}: {
  onInstall?: (payload: {
    name: string;
    version: string;
    description: string;
    runtime: SkillRuntime;
    category: string;
    author: string;
    sourceCode: string;
    trusted: boolean;
  }) => Promise<void> | void;
  onGenerate?: (usage: string, runtime: SkillRuntime) => Promise<void>;
  generating?: boolean;
}) {
  const storedDraft = useAppStore((s) => s.skillEditorDraft);
  const setEditorDraft = useAppStore((s) => s.setSkillEditorDraft);
  const nameRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<SkillRuntime>("python");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [author, setAuthor] = useState("");
  const [trusted, setTrusted] = useState(false);
  const [usagePrompt, setUsagePrompt] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const code = storedDraft;

  const lineCount = useMemo(() => {
    const lines = code.split("\n").length;
    return Math.max(1, lines);
  }, [code]);

  const lineNumbersCss = useMemo(() => {
    const arr: string[] = [];
    for (let i = 1; i <= lineCount; i++) arr.push(String(i));
    return arr;
  }, [lineCount]);

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    const key = "skill-editor-draft";
    try {
      const fromStorage = localStorage.getItem(key);
      if (fromStorage && !storedDraft) {
        setEditorDraft(fromStorage);
      }
    } catch {
      /* ignore */
    }
  }, [storedDraft, setEditorDraft]);

  const handleSaveDraft = () => {
    try {
      localStorage.setItem("skill-editor-draft", code);
      setEditorDraft(code);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      /* ignore */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${code.slice(0, start)}  ${code.slice(end)}`;
      setEditorDraft(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSaveDraft();
    }
  };

  const handleDownload = () => {
    const ext = runtime === "wasm" ? "wat" : "py";
    const filename = `${name || "skill-draft"}.${ext}`;
    try {
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  const handleInstall = async () => {
    setInstallError(null);
    if (!name.trim()) {
      setInstallError("Nom du skill requis.");
      nameRef.current?.focus();
      return;
    }
    if (!code.trim()) {
      setInstallError("Code source vide.");
      return;
    }
    if (!onInstall) return;
    try {
      setInstalling(true);
      await onInstall({
        name: name.trim(),
        version: version.trim() || "0.1.0",
        description: description.trim(),
        runtime,
        category: category.trim() || "general",
        author: author.trim(),
        sourceCode: code,
        trusted,
      });
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;
    if (!usagePrompt.trim() || usagePrompt.trim().length < 4) {
      setInstallError("Description d'usage trop courte (min. 4 caracters).");
      return;
    }
    setInstallError(null);
    try {
      await onGenerate(usagePrompt.trim(), runtime);
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
              Editeur Skill
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Code source <span className="text-slate-500">(0 dep)</span>
            </h2>
          </div>
          <div className="inline-flex overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-sm font-medium">
            {(["python", "wasm"] as SkillRuntime[]).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setRuntime(rt)}
                className={`px-4 py-2 transition ${
                  runtime === rt
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {rt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 relative flex overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
          <div
            ref={lineNumbersRef}
            className="w-14 shrink-0 select-none overflow-hidden border-r border-white/5 bg-slate-950/50 py-3 pr-2 text-right font-mono text-[11px] leading-6 text-slate-500"
            style={{ height: "528px" }}
          >
            {lineNumbersCss.map((n) => (
              <div key={n} className="px-2">
                {n}
              </div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={code}
            onChange={(e) => setEditorDraft(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder={
              runtime === "wasm"
                ? "(module\n  (func (export \"run\") (param i32) (result i32)\n    local.get 0 i32.const 42 i32.add)\n  (memory (export \"memory\") 1))"
                : '"""\nSkill Python stdlib seulement.\n"""\nimport json\n\ndef main(args: dict) -> dict:\n    return {"ok": True, "echo": args}\n\n\nif __name__ == "__main__":\n    import sys\n    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}\n    print(json.dumps(main(payload)))'
            }
            className="min-h-[528px] w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-6 text-slate-100 outline-none"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10"
          >
            <Save className="h-4 w-4" />
            Enregistrer brouillon Ctrl+S
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-slate-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Telecharger .{runtime === "wasm" ? "wat" : "py"}
          </button>
          {savedAt && (
            <span className="font-mono uppercase tracking-[0.25em] text-emerald-400/80">
              Enregistre a {savedAt}
            </span>
          )}
          <span className="ml-auto font-mono">
            {lineCount} lignes · {code.length} octets
          </span>
        </div>
      </div>
      <div className="grid gap-5 content-start">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
            Meta Skill
          </p>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-400">Nom (obligatoire)</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mon-skill-exemple"
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-400">Version</span>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="0.1.0"
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-400">Categorie</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                >
                  {["general", "data", "assistant", "system", "domotic"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-400">Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumé court du role du skill."
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-slate-400">Auteur</span>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="user ou service"
                className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={trusted}
                onChange={(e) => setTrusted(e.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
              Skill de confiance (skip approval - status installe directement)
            </label>
            {installError && (
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {installError}
              </div>
            )}
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 px-4 py-2.5 font-medium text-emerald-100 ring-1 ring-emerald-400/25 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {installing ? "Installation..." : "Installer le skill dans le registre"}
            </button>
          </div>
        </div>
        {onGenerate && (
          <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
              Synthesizer LLM
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs text-slate-400">
                  Decrivez l&apos;usage du skill a generer
                </span>
                <textarea
                  rows={4}
                  value={usagePrompt}
                  onChange={(e) => setUsagePrompt(e.target.value)}
                  placeholder="Ex: un skill qui retourne les top 5 mots d'une chaine JSON."
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
                />
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500/20 px-4 py-2.5 font-medium text-violet-100 ring-1 ring-violet-400/25 transition hover:bg-violet-500/30 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? "Generation..." : "Generer le brouillon via LLM"}
              </button>
              <p className="text-[11px] leading-5 text-slate-500">
                Le skill genere arrive avec un statut pending_approval : passez par
                l&apos;onglet Approbations pour l&apos;installer definitivement.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
