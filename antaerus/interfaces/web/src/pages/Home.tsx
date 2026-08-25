import { useEffect, useMemo, useRef, useState } from "react";
import {
  type LucideIcon,
  Activity,
  BarChart3,
  Bot,
  BookOpen,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Heart,
  Home as HomeIcon,
  Layers,
  MessageSquare,
  Mic,
  Network,
  Radar,
  Rocket,
  Settings2,
  Shield,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const JOURS_FR = [
  "DIMANCHE",
  "LUNDI",
  "MARDI",
  "MERCREDI",
  "JEUDI",
  "VENDREDI",
  "SAMEDI",
];
const MOIS_FR = [
  "JANVIER",
  "FÉVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOÛT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DÉCEMBRE",
];

const PAD = (n: number, len = 2) => String(n).padStart(len, "0");

type NavIcon = {
  to: string;
  icon: LucideIcon;
  label: string;
  tone?: string;
};

const TOP_NAV: NavIcon[] = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/foundation", icon: Layers, label: "Foundation" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/system-health", icon: Shield, label: "Health" },
  { to: "/skill-lab", icon: Sparkles, label: "Skill Lab", tone: "text-cyan-300" },
];

const QUICK_ACTIONS = [
  {
    to: "/chat",
    accent: "from-cyan-500/20 via-cyan-400/10 to-transparent ring-cyan-400/30",
    icon: Bot,
    title: "Ouvrir Chat",
    tag: "TEXTE + VOIX",
    body: "Lancer une conversation en langage naturel.",
  },
  {
    to: "/missions",
    accent: "from-violet-500/20 via-violet-400/10 to-transparent ring-violet-400/30",
    icon: Rocket,
    title: "Creer mission",
    tag: "PLANIFICATION",
    body: "Decrire un objectif, laisser l'agent decomposer.",
  },
  {
    to: "/skill-lab",
    accent: "from-emerald-500/20 via-emerald-400/10 to-transparent ring-emerald-400/30",
    icon: BookOpen,
    title: "Skill Lab",
    tag: "PYTHON · WASM",
    body: "Creer, tester et installer de nouvelles capacites.",
  },
  {
    to: "/command-center",
    accent: "from-amber-500/20 via-amber-400/10 to-transparent ring-amber-400/30",
    icon: Zap,
    title: "Command Center",
    tag: "PROACTIF",
    body: "Activer collecteurs, initiatives et autonomie.",
  },
];

const SERVICES_HUD = [
  { name: "web_react", label: "WEB", port: 5173, tone: "text-cyan-300" },
  { name: "gateway_go", label: "GTW", port: 8080, tone: "text-indigo-300" },
  { name: "brain_python", label: "BRN", port: 8000, tone: "text-emerald-300" },
  { name: "engine_rust", label: "ENG", port: 7000, tone: "text-amber-300" },
];

type ServiceHudRow = (typeof SERVICES_HUD)[number] & {
  status: "healthy" | "degraded" | "offline";
  latency: number;
};

const MODULES_BADGES = [
  { icon: Network, label: "Foundation" },
  { icon: Bot, label: "Chat" },
  { icon: Rocket, label: "Missions" },
  { icon: Zap, label: "C&C" },
  { icon: Database, label: "Memoire" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Shield, label: "Health" },
  { icon: GitBranch, label: "Config" },
  { icon: Sparkles, label: "Skill Lab" },
  { icon: Settings2, label: "Setup" },
];

export default function Home() {
  const nav = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [uptimeS, setUptimeS] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [healthPulse, setHealthPulse] = useState<ServiceHudRow[]>(() =>
    SERVICES_HUD.map((s) => ({
      ...s,
      status: Math.random() > 0.08 ? "healthy" : "degraded",
      latency: 18 + Math.floor(Math.random() * 180),
    })),
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    const u = window.setInterval(() => setUptimeS((x) => x + 1), 1000);
    const h = window.setInterval(() => {
      setHealthPulse((prev) =>
        prev.map((s) => ({
          ...s,
          latency: Math.max(8, Math.min(520, s.latency + Math.floor((Math.random() - 0.5) * 40))),
          status: Math.random() > 0.04 ? "healthy" : Math.random() > 0.5 ? "degraded" : "healthy",
        })),
      );
    }, 1800);
    return () => {
      window.clearInterval(t);
      window.clearInterval(u);
      window.clearInterval(h);
    };
  }, []);

  const HHMM = `${PAD(now.getHours())}:${PAD(now.getMinutes())}`;
  const SS = PAD(now.getSeconds());
  const DATE_LINE = `${JOURS_FR[now.getDay()]}, ${PAD(now.getDate())} ${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`;
  const uptimeLine = useMemo(() => {
    const h = Math.floor(uptimeS / 3600);
    const m = Math.floor((uptimeS % 3600) / 60);
    const s = uptimeS % 60;
    return `${PAD(h)}:${PAD(m)}:${PAD(s)}`;
  }, [uptimeS]);
  const healthyCount = healthPulse.filter((s) => s.status === "healthy").length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const PARTICLE_COUNT = 1400;
    type P = { x: number; y: number; z: number; r: number; g: number; b: number; speed: number; phase: number };
    const ps: P[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.82 + Math.random() * 0.18;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      const hue = 195 + Math.random() * 40;
      ps.push({
        x,
        y,
        z,
        r: Math.floor(60 + Math.random() * 80),
        g: Math.floor(160 + Math.random() * 90),
        b: Math.floor(230 + Math.random() * 25),
        speed: 0.12 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const STAR_COUNT = 220;
    type Star = { x: number; y: number; a: number; twinkle: number };
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({ x: Math.random(), y: Math.random(), a: 0.15 + Math.random() * 0.8, twinkle: Math.random() * Math.PI * 2 });
    }

    const rings = [0.55, 0.78, 0.98];

    let t = 0;
    const render = () => {
      t += 0.0045;

      ctx.save();
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, "rgba(14, 116, 144, 0.12)");
      bg.addColorStop(0.4, "rgba(30, 64, 175, 0.04)");
      bg.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + s.twinkle));
        ctx.fillStyle = `rgba(180, 220, 255, ${s.a * tw})`;
        ctx.fillRect(s.x * W, s.y * H, 1, 1);
      }

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.34;

      const globeGlow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.45);
      globeGlow.addColorStop(0, "rgba(56, 189, 248, 0.22)");
      globeGlow.addColorStop(0.35, "rgba(59, 130, 246, 0.10)");
      globeGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = globeGlow;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < rings.length; i++) {
        const rr = R * rings[i];
        ctx.beginPath();
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.08 + 0.05 * Math.sin(t * 1.8 + i)})`;
        ctx.lineWidth = 1;
        ctx.ellipse(cx, cy, rr, rr * (0.16 + 0.08 * i), t * (0.2 + i * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }
      {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
        ctx.lineWidth = 1;
        ctx.ellipse(cx, cy, R * 1.25, R * 0.52, Math.sin(t * 0.9) * 0.18 - 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }

      const rotY = t * 0.6;
      const rotX = Math.sin(t * 0.22) * 0.25 + 0.18;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      type PP = { sx: number; sy: number; sz: number; depth: number; p: P };
      const projected: PP[] = [];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        let x = p.x;
        let y = p.y;
        let z = p.z;
        let nx = x * cosY - z * sinY;
        let nz = x * sinY + z * cosY;
        let ny = y * cosX - nz * sinX;
        nz = y * sinX + nz * cosX;
        x = nx; y = ny; z = nz;
        const persp = 2.4 / (2.4 - z);
        const sx = cx + x * R * persp;
        const sy = cy + y * R * persp;
        projected.push({ sx, sy, sz: z, depth: persp * 0.5 + (z + 1) * 0.5, p });
      }
      projected.sort((a, b) => a.sz - b.sz);

      for (let i = 0; i < projected.length; i++) {
        const pr = projected[i];
        const alpha = 0.18 + 0.78 * pr.depth + 0.12 * Math.sin(t * 3 + pr.p.phase);
        const size = 0.5 + 1.6 * pr.depth;
        ctx.globalAlpha = Math.min(1, Math.max(0.08, alpha));
        ctx.fillStyle = `rgb(${pr.p.r}, ${pr.p.g}, ${pr.p.b})`;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const latLines = 5;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.10)";
      ctx.lineWidth = 1;
      for (let i = 1; i < latLines; i++) {
        const phi = (i / latLines) * Math.PI;
        const ry = Math.cos(phi) * R;
        const rz = Math.sin(phi) * R;
        const persp = 2.4 / (2.4 + ry / R);
        ctx.beginPath();
        ctx.ellipse(cx, cy + ry * persp * 0.55, rz * persp, rz * persp * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      rafRef.current = window.requestAnimationFrame(render);
    };
    rafRef.current = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const submitPrompt = () => {
    const q = prompt.trim();
    if (!q) {
      nav("/chat");
      return;
    }
    nav(`/chat?prompt=${encodeURIComponent(q)}`);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.9), rgba(15,23,42,0))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
        style={{
          background:
            "linear-gradient(to top, rgba(2,6,23,0.95), rgba(2,6,23,0))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
          opacity: 0.35,
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6 lg:px-10 lg:py-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
            {TOP_NAV.map((n) => {
              const I = n.icon;
              return (
                <button
                  key={n.to}
                  type="button"
                  title={n.label}
                  onClick={() => nav(n.to)}
                  className={`group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition hover:border-cyan-400/30 hover:bg-cyan-500/10 ${n.tone ?? "text-slate-200"}`}
                >
                  <I className="h-4 w-4 transition group-hover:-translate-y-0.5" />
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/90 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300 opacity-0 transition group-hover:opacity-100 -translate-x-1/2">
                    {n.label}
                  </span>
                </button>
              );
            })}
            <div className="mx-1 h-7 w-px bg-white/10" />
            <button
              type="button"
              title="Microphone (Wake word M1.4 - TBD)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-end gap-3">
              <p className="pb-2 font-mono text-xs uppercase tracking-[0.42em] text-slate-500">
                aNtaerus
              </p>
              <p className="font-mono text-6xl font-semibold leading-none text-white drop-shadow-[0_0_24px_rgba(56,189,248,0.25)] sm:text-7xl">
                {HHMM}
                <span className="ml-1 align-top font-mono text-2xl font-medium text-cyan-300">
                  :{SS}
                </span>
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-400">
              {DATE_LINE}
            </p>
            <div className="mt-1 flex items-center gap-3 rounded-xl border border-cyan-400/10 bg-cyan-500/5 px-3 py-1.5 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/90">
                SESSION ONLINE · UPTIME {uptimeLine}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-4 flex flex-1 items-center justify-center gap-10">
          <div className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  Sante systeme
                </p>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                  {healthyCount}/4 en ligne
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                {healthPulse.map((s) => {
                  const I =
                    s.name === "engine_rust"
                      ? Cpu
                      : s.name === "gateway_go"
                        ? Network
                        : s.name === "brain_python"
                          ? Database
                          : Activity;
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl border border-white/5 bg-slate-950/80 ${s.tone}`}
                        >
                          <I className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-200">
                            {s.label} · {s.name.replace("_", " ")}
                          </p>
                          <p className="font-mono text-[10px] text-slate-500">
                            :{s.port} · {s.latency} ms
                          </p>
                        </div>
                      </div>
                      <span
                        className={`h-2 w-2 rounded-full ${s.status === "healthy"
                          ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                          : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]"}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-cyan-300" />
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  Modules charges
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {MODULES_BADGES.map((m) => {
                  const I = m.icon;
                  return (
                    <span
                      key={m.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300"
                    >
                      <I className="h-3 w-3 text-slate-400" />
                      {m.label}
                    </span>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl border border-cyan-400/10 bg-cyan-500/5 p-3">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-200/90">
                  <Heart className="h-3.5 w-3.5 text-rose-300" />
                  10 / 10 modules prets
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Couches polyglottes web · go · python · rust. Endpoints fondations verifies.
                </p>
              </div>
            </div>
          </div>

          <div className="flex w-full max-w-xl flex-col items-center text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.5em] text-cyan-300/90">
              Interface de commandement · Noyau aNtaerus
            </p>
            <h1 className="mt-4 bg-gradient-to-b from-white via-slate-100 to-cyan-200 bg-clip-text text-5xl font-semibold tracking-tight text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.15)] sm:text-6xl">
              Bienvenue, Operateur.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300/90">
              Quelle mission voulez-vous confier aujourd&apos;hui ? Dialoguez en langage naturel,
              creez des objectifs complexes, etendez les competences via Skill Lab ou supervisez
              l&apos;infrastructure en temps reel.
            </p>
            <div className="mt-8 w-full">
              <div className="group flex items-center gap-3 rounded-3xl border border-cyan-400/20 bg-slate-950/70 px-5 py-3 shadow-2xl shadow-cyan-950/40 ring-1 ring-white/5 backdrop-blur-xl transition focus-within:border-cyan-300/50 focus-within:shadow-cyan-500/10">
                <Terminal className="h-4 w-4 text-cyan-300" />
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitPrompt();
                  }}
                  placeholder="Demandez quelque chose a aNtaerus… (Entree pour ouvrir le chat)"
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={submitPrompt}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/20 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  Executer
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {[
                  "Resumer mes e-mails",
                  "Planifier semaine prochaine",
                  "Analyser les performances",
                  "Creer un skill python",
                  "Donner l'etat du systeme",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPrompt(s);
                      nav(`/chat?prompt=${encodeURIComponent(s)}`);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-300" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                    Documentation
                  </p>
                </div>
                <span className="font-mono text-[10px] text-slate-500">HTML · 0 dep</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Guide utilisateur autonome, installation 1 clic, demarrage Windows,
                configuration <code className="font-mono text-[11px] text-cyan-200">.env</code> et FAQ.
              </p>
              <button
                type="button"
                onClick={() => window.open("/docs/index.html", "_blank", "noopener,noreferrer")}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-500/25"
              >
                Ouvrir guide utilisateur
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-violet-300" />
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  Telemetrie live
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: "Latence P95", value: "312 ms", tone: "text-cyan-200" },
                  { label: "Messages", value: "1 / 24h", tone: "text-emerald-200" },
                  { label: "Skills", value: "2 installes", tone: "text-violet-200" },
                  { label: "Fournisseur", value: "deepseek", tone: "text-amber-200" },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      {k.label}
                    </p>
                    <p className={`mt-1 font-mono text-sm ${k.tone}`}>{k.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const I = a.icon;
            return (
              <button
                key={a.to}
                type="button"
                onClick={() => nav(a.to)}
                className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${a.accent} p-5 text-left shadow-2xl shadow-slate-950/40 ring-1 backdrop-blur-xl transition hover:-translate-y-0.5 hover:ring-white/20`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-white">
                    <I className="h-5 w-5 transition group-hover:scale-110" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.3em] text-slate-300">
                    {a.tag}
                  </span>
                </div>
                <p className="mt-5 text-lg font-semibold text-white">{a.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{a.body}</p>
                <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-3xl transition group-hover:bg-white/10" />
              </button>
            );
          })}
        </footer>
      </div>
    </main>
  );
}
