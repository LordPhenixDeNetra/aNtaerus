import { useEffect, useRef, useState } from "react";
import {
  type LucideIcon,
  Activity,
  BarChart3,
  Grid3X3,
  Heart,
  Home as HomeIcon,
  Layers,
  MessageSquare,
  Mic,
  Network,
  Settings2,
  Shield,
  Sparkles,
  Terminal,
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
  { to: "/dashboard", icon: Grid3X3, label: "Modules", tone: "text-violet-200" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/foundation", icon: Layers, label: "Foundation" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/system-health", icon: Shield, label: "Health" },
  { to: "/skill-lab", icon: Sparkles, label: "Skill Lab", tone: "text-cyan-300" },
  { to: "/settings", icon: Settings2, label: "Settings", tone: "text-slate-200" },
];

const SERVICES_PILL = [
  { name: "web", port: 5173, tone: "bg-cyan-400" },
  { name: "gtw", port: 8080, tone: "bg-indigo-400" },
  { name: "brn", port: 8000, tone: "bg-emerald-400" },
  { name: "eng", port: 7000, tone: "bg-amber-400" },
];

export default function Home() {
  const nav = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [uptimeS, setUptimeS] = useState(0);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    const u = window.setInterval(() => setUptimeS((x) => x + 1), 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(u);
    };
  }, []);

  const HHMM = `${PAD(now.getHours())}:${PAD(now.getMinutes())}`;
  const SS = PAD(now.getSeconds());
  const DATE_LINE = `${JOURS_FR[now.getDay()]}, ${PAD(now.getDate())} ${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`;
  const uptimeLine = `${PAD(Math.floor(uptimeS / 3600))}:${PAD(Math.floor((uptimeS % 3600) / 60))}:${PAD(uptimeS % 60)}`;

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

    const PARTICLE_COUNT = 1800;
    type P = { x: number; y: number; z: number; r: number; g: number; b: number; phase: number };
    const ps: P[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.86 + Math.random() * 0.14;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      ps.push({
        x,
        y,
        z,
        r: Math.floor(70 + Math.random() * 80),
        g: Math.floor(170 + Math.random() * 80),
        b: Math.floor(232 + Math.random() * 23),
        phase: Math.random() * Math.PI * 2,
      });
    }

    const STAR_COUNT = 260;
    type Star = { x: number; y: number; a: number; twinkle: number };
    const stars: Star[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({ x: Math.random(), y: Math.random(), a: 0.12 + Math.random() * 0.8, twinkle: Math.random() * Math.PI * 2 });
    }

    const rings = [0.58, 0.8, 1.0];

    let t = 0;
    const render = () => {
      t += 0.0042;
      ctx.save();
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, Math.max(W, H) * 0.75);
      bg.addColorStop(0, "rgba(14, 116, 144, 0.18)");
      bg.addColorStop(0.45, "rgba(30, 64, 175, 0.05)");
      bg.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.2 + s.twinkle));
        ctx.fillStyle = `rgba(180, 220, 255, ${s.a * tw})`;
        ctx.fillRect(s.x * W, s.y * H, 1, 1);
      }

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.46;

      const globeGlow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.55);
      globeGlow.addColorStop(0, "rgba(56, 189, 248, 0.28)");
      globeGlow.addColorStop(0.4, "rgba(59, 130, 246, 0.12)");
      globeGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = globeGlow;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < rings.length; i++) {
        const rr = R * rings[i];
        ctx.beginPath();
        ctx.strokeStyle = `rgba(103, 232, 249, ${0.09 + 0.05 * Math.sin(t * 1.8 + i)})`;
        ctx.lineWidth = 1;
        ctx.ellipse(cx, cy, rr, rr * (0.16 + 0.08 * i), t * (0.2 + i * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
      ctx.lineWidth = 1;
      ctx.ellipse(cx, cy, R * 1.25, R * 0.52, Math.sin(t * 0.9) * 0.18 - 0.1, 0, Math.PI * 2);
      ctx.stroke();

      const rotY = t * 0.55;
      const rotX = Math.sin(t * 0.22) * 0.22 + 0.16;
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
        const nx = x * cosY - z * sinY;
        const nz = x * sinY + z * cosY;
        const ny = y * cosX - nz * sinX;
        z = y * sinX + nz * cosX;
        x = nx; y = ny;
        const persp = 2.4 / (2.4 - z);
        projected.push({
          sx: cx + x * R * persp,
          sy: cy + y * R * persp,
          sz: z,
          depth: persp * 0.5 + (z + 1) * 0.5,
          p,
        });
      }
      projected.sort((a, b) => a.sz - b.sz);

      for (let i = 0; i < projected.length; i++) {
        const pr = projected[i];
        const alpha = 0.22 + 0.76 * pr.depth + 0.1 * Math.sin(t * 3 + pr.p.phase);
        const size = 0.5 + 1.7 * pr.depth;
        ctx.globalAlpha = Math.min(1, Math.max(0.1, alpha));
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
    nav(`/chat${q ? `?prompt=${encodeURIComponent(q)}` : ""}`);
  };

  return (
    <main className="relative h-[100vh] min-h-[640px] w-full overflow-hidden bg-[#020617] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse at center, black 45%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 45%, transparent 90%)",
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

      <div className="pointer-events-none absolute inset-0 z-10">
        <header className="flex items-start justify-between px-8 pt-8">
          <nav className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/10 bg-slate-950/55 px-2.5 py-2 shadow-xl shadow-cyan-950/30 backdrop-blur-xl">
            {TOP_NAV.map((n) => {
              const I = n.icon;
              return (
                <button
                  key={n.to}
                  type="button"
                  title={n.label}
                  onClick={() => nav(n.to)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition hover:border-cyan-400/30 hover:bg-cyan-500/10 ${n.tone ?? "text-slate-200"}`}
                >
                  <I className="h-4 w-4" />
                </button>
              );
            })}
            <div className="mx-1 h-7 w-px bg-white/10" />
            <button
              type="button"
              title="Microphone"
              onClick={() => nav("/chat")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-slate-300 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <Mic className="h-4 w-4" />
            </button>
          </nav>

          <div className="pointer-events-auto flex flex-col items-end gap-1.5 text-right">
            <p className="font-mono text-[22px] font-semibold uppercase tracking-[0.35em] text-slate-700/60 sm:text-[34px] md:text-[44px]">
              aNtaerus
            </p>
            <p className="font-mono font-semibold leading-none text-slate-100 drop-shadow-[0_0_18px_rgba(56,189,248,0.12)] text-[64px] sm:text-[80px] md:text-[96px]">
              {HHMM}
              <span className="ml-1 align-top font-mono font-medium text-cyan-300/90 text-lg sm:text-xl md:text-2xl">
                :{SS}
              </span>
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-400/90 md:text-xs">
              {DATE_LINE}
            </p>
          </div>
        </header>

        <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between gap-6">
          <div className="pointer-events-auto max-w-xs rounded-2xl border border-white/10 bg-slate-950/55 p-3.5 shadow-xl shadow-slate-950/40 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-3.5 w-3.5 text-slate-300" />
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
                  System status
                </p>
              </div>
              <p className="font-mono text-[10px] text-slate-500">up {uptimeLine}</p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {SERVICES_PILL.map((s) => {
                const I = s.name === "eng" ? Activity : s.name === "brn" ? Heart : Network;
                return (
                  <div
                    key={s.name}
                    className="flex flex-1 items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.03] px-2 py-1.5"
                    title={`${s.name} :${s.port}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.tone} shadow-[0_0_6px_currentColor]`} />
                    <I className="h-3 w-3 text-slate-300" />
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      {s.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pointer-events-auto w-full max-w-md">
            <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-slate-950/60 px-4 py-2.5 shadow-xl shadow-cyan-950/30 backdrop-blur-xl">
              <Terminal className="h-4 w-4 text-cyan-300" />
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPrompt();
                }}
                placeholder="Parlez a aNtaerus… (Entree)"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitPrompt}
                className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
