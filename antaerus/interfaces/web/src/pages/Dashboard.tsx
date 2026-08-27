import {
  Activity,
  BookOpen,
  Bot,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  GitBranch,
  LineChart,
  Network,
  Rocket,
  Settings2,
  Shield,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

type CardDef = {
  to: string;
  accent: string;
  icon: typeof Rocket;
  title: string;
  tag: string;
  description: string;
};

const cards: CardDef[] = [
  {
    to: "/chat",
    accent: "border-cyan-400/20 shadow-cyan-950/20 text-cyan-300",
    icon: Bot,
    title: "Chat",
    tag: "Texte & Voix",
    description:
      "Conversations multimodales temps reel : WebSocket, streaming LLM, wake word, STT, TTS.",
  },
  {
    to: "/foundation",
    accent: "border-indigo-400/20 shadow-indigo-950/20 text-indigo-300",
    icon: Network,
    title: "Foundation Dashboard",
    tag: "Observabilite",
    description:
      "Supervision des 4 couches polyglottes, endpoints fondamentaux et capacites declarees.",
  },
  {
    to: "/missions",
    accent: "border-violet-400/20 shadow-violet-950/20 text-violet-300",
    icon: Rocket,
    title: "Mission Engine",
    tag: "Planification · Execution · Reflexion",
    description:
      "Creation, pilotage et bilan des missions autonomes : etapes, progression, reprise sur echec, reflexion LLM.",
  },
  {
    to: "/command-center",
    accent: "border-sky-400/20 shadow-sky-950/20 text-sky-300",
    icon: Zap,
    title: "Command Center",
    tag: "Proactif · Collecteurs · Curateur",
    description:
      "Pilotage du moteur proactif : collecteurs meteo/news/systeme, initiatives, autonomie globale et curateur nocturne.",
  },
  {
    to: "/setup",
    accent: "border-emerald-400/20 shadow-emerald-950/20 text-emerald-300",
    icon: Settings2,
    title: "Configuration",
    tag: "Setup local",
    description:
      "URL du gateway, clefs API, mode voix, langue par defaut. Persiste dans localStorage.",
  },
  {
    to: "/settings",
    accent: "border-slate-200/20 shadow-slate-950/20 text-slate-200",
    icon: FolderOpen,
    title: "Parametres",
    tag: "Securite · Dossiers autorises",
    description:
      "Dossiers autorises de la whitelist filesystem (outils), etat des outils declares et sources par couche (yaml/overlay/env/SQL).",
  },
  {
    to: "/memory",
    accent: "border-cyan-400/20 shadow-cyan-950/20 text-cyan-300",
    icon: Database,
    title: "Memoire",
    tag: "Explorateur semantique",
    description:
      "Recherche, creation et graphe des faits semantiques stockes dans le brain Python.",
  },
  {
    to: "/analytics",
    accent: "border-violet-400/20 shadow-violet-950/20 text-violet-300",
    icon: LineChart,
    title: "Analytique",
    tag: "KPIs et series",
    description:
      "Latence P95, tokens depenses, messages traites et series temporelles 24h.",
  },
  {
    to: "/system-health",
    accent: "border-rose-400/20 shadow-rose-950/20 text-rose-300",
    icon: Shield,
    title: "Sante systeme",
    tag: "Heartbeat + logs",
    description:
      "Vue agregée des 4 couches, extraction de logs et demande de redemarrage par service.",
  },
  {
    to: "/config",
    accent: "border-amber-400/20 shadow-amber-950/20 text-amber-300",
    icon: GitBranch,
    title: "Inventaire config",
    tag: "Snapshot runtime",
    description: "Lecture seule de la configuration des services. Cles sensibles masquees.",
  },
  {
    to: "/skill-lab",
    accent: "border-emerald-400/20 shadow-emerald-950/20 text-emerald-300",
    icon: BookOpen,
    title: "Skill Lab",
    tag: "Marketplace · Editeur · Tester",
    description:
      "Creation, test et gestion des skills Python/WASM. Sandbox isole, validation humaine et marketplace interne.",
  },
];

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <Icon className="h-4 w-4 text-slate-200" />
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

export default function Dashboard() {
  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                aNtaerus · Modules
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white">
                Un agent autonome, multi-langues, observable et pilotable par
                niveaux d&apos;autonomie.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                Acces direct aux modules de la fondation : dialogue texte/voix,
                supervision systeme, moteur de mission autonome et
                configuration locale.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <Metric icon={Activity} label="Modules" value="10 / 10" />
              <Metric icon={Cpu} label="Couches" value="web · go · python · rust" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-400/20 bg-sky-950/30 p-5 shadow-lg shadow-sky-950/30 backdrop-blur">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
                <FileText className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Documentation utilisateur (HTML autonome)
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                  Guide complet d&apos;installation (.env), de configuration, de
                  demarrage 1 clic et d&apos;utilisation des 10 ecrans, de Skill
                  Lab M7 et FAQ depannage.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  window.open("/docs/index.html", "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/30"
              >
                <BookOpen className="h-4 w-4" />
                Ouvrir le guide utilisateur
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(
                    "https://github.com/LordPhenixDeNetra/aNtaerus/blob/main/README.md",
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.09]"
              >
                Voir le README GitHub
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className={`group rounded-3xl border bg-white/[0.04] p-6 shadow-2xl backdrop-blur transition hover:bg-white/[0.08] ${card.accent}`}
              data-testid={`home-card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <card.icon className="h-4 w-4" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-300">
                      {card.tag}
                    </p>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-white">
                    {card.title}
                  </h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                  <card.icon className="h-6 w-6 text-slate-100 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">{card.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
