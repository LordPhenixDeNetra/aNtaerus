import type { FactGraphResponse } from "@/lib/api";

type Props = {
  graph: FactGraphResponse;
  width?: number;
  height?: number;
};

export default function FactGraph({
  graph,
  width = 640,
  height = 420,
}: Props) {
  const { facts, relations } = graph;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 48;

  const positions = facts.map((fact, i) => {
    const angle = (i / Math.max(facts.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: fact.id,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      label: fact.title?.slice(0, 20) || fact.id.slice(0, 10),
    };
  });

  const byId = new Map(positions.map((p) => [p.id, p]));
  const accentRel = "#22d3ee";
  const deriveAccent = "#a78bfa";

  return (
    <figure
      className="w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-4 shadow-inner"
      data-testid="fact-graph"
    >
      <figcaption className="mb-3 flex items-center justify-between px-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
          Graphe memoire
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          {facts.length} faits · {relations.length} relations
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Graphe des faits memoire"
      >
        <defs>
          <radialGradient id="fact-graph-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34,211,238,0.08)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="url(#fact-graph-bg)" rx={24} />

        {relations.map((rel, idx) => {
          const src = byId.get(rel.sourceFactId);
          const tgt = byId.get(rel.targetFactId);
          if (!src || !tgt) return null;
          const mx = (src.x + tgt.x) / 2;
          const my = (src.y + tgt.y) / 2;
          const curved = rel.relationType && rel.relationType !== "related";
          const stroke = curved ? deriveAccent : accentRel;
          const dx = curved ? (tgt.y - src.y) * 0.15 : 0;
          const dy = curved ? (src.x - tgt.x) * 0.15 : 0;
          const d = `M ${src.x} ${src.y} Q ${mx + dx} ${my + dy} ${tgt.x} ${tgt.y}`;
          return (
            <path
              key={`rel-${idx}`}
              d={d}
              stroke={stroke}
              strokeOpacity="0.55"
              strokeWidth="1.5"
              fill="none"
            />
          );
        })}

        {positions.map((p) => (
          <g key={p.id} className="transition hover:opacity-90">
            <circle cx={p.x} cy={p.y} r="10" fill="#0f172a" stroke={accentRel} strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="4" fill={accentRel} />
            <text
              x={p.x}
              y={p.y - 16}
              textAnchor="middle"
              className="fill-slate-200"
              fontSize="10"
              fontFamily="monospace"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
