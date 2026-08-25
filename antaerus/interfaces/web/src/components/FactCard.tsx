import type { FactRecord } from "@/lib/api";
import { Database } from "lucide-react";

type Props = {
  fact: FactRecord;
  onUpdate?: (fact: FactRecord) => void;
};

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function FactCard({ fact, onUpdate }: Props) {
  const category = fact.category || "general";
  const confidence = Math.round((fact.confidence ?? 0.8) * 100);

  return (
    <article
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur"
      data-testid="fact-card"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1">
          <Database className="h-3.5 w-3.5 text-emerald-300" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-300">
            {category}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {confidence}%
          </span>
        </div>
        <time className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
          {formatDate(fact.observedAt || fact.createdAt)}
        </time>
      </header>

      <h3 className="mt-4 text-lg font-semibold leading-7 text-white">
        {fact.title || fact.content?.slice(0, 80) || "Sans titre"}
      </h3>

      {fact.content ? (
        <p className="mt-2 text-sm leading-6 text-slate-300 line-clamp-3">
          {fact.content}
        </p>
      ) : null}

      {Array.isArray(fact.tags) && fact.tags.length > 0 ? (
        <footer className="mt-4 flex flex-wrap gap-2">
          {fact.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-[11px] text-slate-300"
            >
              {tag}
            </span>
          ))}
        </footer>
      ) : null}

      {typeof onUpdate === "function" ? (
        <button
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          onClick={() => onUpdate(fact)}
          type="button"
        >
          Modifier localement
        </button>
      ) : null}
    </article>
  );
}
