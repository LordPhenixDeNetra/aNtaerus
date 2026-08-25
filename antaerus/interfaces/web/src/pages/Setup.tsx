import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  Globe2,
  Network,
  Radio,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";

import ApiKeyInput from "@/components/ApiKeyInput";
import { fetchDevToken, validateProviderKey, detectFreePorts } from "@/lib/api";
import type { ProviderName, SetupEnabledModules } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";
import type { ReactNode } from "react";

const providerOptions: ProviderName[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "deepseek",
  "ollama",
];

const DEFAULT_PORTS = [
  { port: 8080, label: "gateway Go" },
  { port: 8000, label: "brain Python" },
  { port: 3000, label: "frontend Vite" },
  { port: 11434, label: "Ollama" },
  { port: 7860, label: "TTS/STT" },
];

type StepDef = {
  key: string;
  title: string;
  icon: typeof UserRound;
  accent: string;
};

const steps: StepDef[] = [
  { key: "identity", title: "Identite", icon: UserRound, accent: "text-cyan-300" },
  { key: "photo", title: "Photo reference", icon: Camera, accent: "text-violet-300" },
  { key: "keys", title: "Cles API", icon: ShieldCheck, accent: "text-emerald-300" },
  { key: "modules", title: "Modules", icon: Cpu, accent: "text-amber-300" },
  { key: "network", title: "Reseau", icon: Network, accent: "text-rose-300" },
];

export default function Setup() {
  const navigate = useNavigate();
  const config = useAppStore((state) => state.config);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(config.wizard.step || 0);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    updateConfig({ wizard: { ...config.wizard, step } });
  }, [step]);

  const validated = config.wizard.validatedProviders;
  const validatedMsg = config.wizard.validatedProvidersMessage;
  const modules = config.modules;

  function setModules(next: Partial<SetupEnabledModules>) {
    updateConfig({ modules: { ...modules, ...next } });
  }

  async function testProvider(provider: ProviderName) {
    try {
      setLoading((m) => {
        const next = { ...m };
        next[`test-${provider}`] = true;
        return next;
      });
      const keyMap: Record<ProviderName, string> = {
        openai: config.openaiApiKey,
        anthropic: config.anthropicApiKey,
        mistral: config.mistralApiKey,
        deepseek: config.deepseekApiKey,
        google: config.googleApiKey,
        ollama: "http://localhost:11434",
      };
      const result = await validateProviderKey(provider, keyMap[provider]);
      const providerStatus: Record<ProviderName, boolean> = {
        ...(validated as Record<ProviderName, boolean>),
        [provider]: result.ok,
      };
      const providerMsg: Record<ProviderName, string> = {
        ...(validatedMsg as Record<ProviderName, string>),
        [provider]: result.message,
      };
      updateConfig({
        wizard: {
          ...config.wizard,
          validatedProviders: providerStatus,
          validatedProvidersMessage: providerMsg,
        },
      });
    } finally {
      setLoading((m) => {
        const next = { ...m };
        next[`test-${provider}`] = false;
        return next;
      });
    }
  }

  async function testAllProviders() {
    await Promise.all(
      providerOptions
        .filter((p) => p === "ollama" || (config as unknown as Record<string, string>)[`${p}ApiKey`]?.length > 0)
        .map((p) => testProvider(p)),
    );
  }

  async function runPortScan() {
    try {
      setLoading((m) => ({ ...m, "ports": true }));
      const result = await detectFreePorts(DEFAULT_PORTS.map((p) => p.port));
      const merged = result.probes.map((probe) => {
        const meta = DEFAULT_PORTS.find((p) => p.port === probe.port);
        return {
          port: probe.port,
          label: meta?.label ?? `port ${probe.port}`,
          busy: probe.busy,
          latencyMs: probe.latencyMs,
        };
      });
      updateConfig({ wizard: { ...config.wizard, portProbes: merged } });
    } finally {
      setLoading((m) => ({ ...m, "ports": false }));
    }
  }

  function onPhotoSelected(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      updateConfig({
        referencePhotoDataUrl: dataUrl,
        wizard: { ...config.wizard, referencePhotoDataUrl: dataUrl },
      });
    };
    reader.readAsDataURL(file);
  }

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return config.displayName.trim().length >= 2;
      case 1:
        return !!config.referencePhotoDataUrl;
      case 2:
        return Object.values(validated).some(Boolean) || config.defaultProvider === "ollama";
      case 3:
        return Object.values(modules).some(Boolean);
      case 4:
        return true;
    }
  }, [step, config.displayName, config.referencePhotoDataUrl, validated, modules]);

  async function onFinish() {
    try {
      setLoading((m) => ({ ...m, "finish": true }));
      const subject = config.displayName.trim() || "web-user";
      const tokenResp = await fetchDevToken(config.gatewayBaseUrl, subject);
      updateConfig({ websocketDevToken: tokenResp.token });
      setMessage("Wizard termine. JWT dev genere, configuration persistee.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur wizard finale.");
    } finally {
      setLoading((m) => ({ ...m, "finish": false }));
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.2 · Setup & Onboarding
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Assistant de configuration
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Identite, photo de reference, validation des cles API par test
                de connexion, activation des modules, detection de ports
                occupes. Persiste dans localStorage, zero envoi de secrets hors
                endpoints publics.
              </p>
            </div>
            <nav className="flex items-center gap-3">
              <Link
                to="/"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Accueil
              </Link>
              <Link
                to="/chat"
                className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Ouvrir Chat
              </Link>
            </nav>
          </div>

          <ol className="mt-8 grid gap-3 md:grid-cols-5" aria-label="Etapes">
            {steps.map((s, idx) => {
              const active = idx === step;
              const done = idx < step;
              return (
                <li
                  key={s.key}
                  className={`rounded-2xl border p-4 ${
                    active
                      ? "border-white/20 bg-white/10 ring-1 ring-white/20"
                      : done
                        ? "border-emerald-400/20 bg-emerald-500/5"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-xl border border-white/10 bg-slate-950/60 p-2 ${
                        done ? "text-emerald-300" : active ? s.accent : "text-slate-400"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <s.icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
                        Etape {idx + 1}/5
                      </p>
                      <p className="truncate text-sm font-medium text-white">{s.title}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </header>

        <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          {step === 0 ? (
            <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <Field label="Nom affiche">
                  <input
                    value={config.displayName}
                    onChange={(event) => updateConfig({ displayName: event.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                    placeholder="Ex. Anta"
                  />
                </Field>
                <Field label="Langue de l&apos;interface">
                  <div className="grid grid-cols-2 gap-3">
                    <RadioCard
                      active={config.language === "fr"}
                      title="Francais"
                      description="Locale par defaut"
                      onClick={() => updateConfig({ language: "fr" })}
                      icon={Globe2}
                    />
                    <RadioCard
                      active={config.language === "en"}
                      title="English"
                      description="Fallback global"
                      onClick={() => updateConfig({ language: "en" })}
                      icon={Globe2}
                    />
                  </div>
                </Field>
                <Field label="Provider par defaut">
                  <select
                    value={config.defaultProvider}
                    onChange={(event) =>
                      updateConfig({ defaultProvider: event.target.value as ProviderName })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                  >
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <aside className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-slate-300">
                  <UserRound className="h-3.5 w-3.5 text-cyan-300" /> Identite
                </div>
                <p className="text-sm leading-6 text-slate-300">
                  Les donnees saisies dans cet assistant restent dans votre
                  navigateur (localStorage) sauf validation ci-contre contre
                  endpoints publics des providers.
                </p>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                    Nom affiche utilise dans les enveloppes de message.
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                    Langue determine messages UI + prompt system.
                  </li>
                </ul>
              </aside>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
              <div className="space-y-5">
                <Field label="Photo de reference (optionnelle)">
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
                    >
                      <Camera className="h-4 w-4 text-violet-300" />
                      Choisir une photo locale
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPhotoSelected(f);
                      }}
                    />
                    {config.referencePhotoDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateConfig({
                            referencePhotoDataUrl: null,
                            wizard: { ...config.wizard, referencePhotoDataUrl: null },
                          })
                        }
                        className="inline-flex items-center gap-2 self-start rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200"
                      >
                        Retirer la photo
                      </button>
                    ) : null}
                  </div>
                </Field>
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  Image encodee en DataURL. Sera utilisee plus tard par les
                  modules de reconnaissance faciale (Moteur Rust + YOLO).
                </p>
              </div>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-3">
                {config.referencePhotoDataUrl ? (
                  <img
                    src={config.referencePhotoDataUrl}
                    alt="Reference"
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    <Camera className="mr-2 h-5 w-5" /> Aucune photo selectionnee
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Endpoints & Jeton dev
                </p>
                <button
                  type="button"
                  onClick={testAllProviders}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  <RefreshCw className={`h-4 w-4 ${loading["test-all"] ? "animate-spin" : ""}`} />
                  Tester toutes les cles configurees
                </button>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Gateway base URL">
                  <input
                    value={config.gatewayBaseUrl}
                    onChange={(event) => updateConfig({ gatewayBaseUrl: event.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                    placeholder="http://localhost:8080"
                  />
                </Field>
                <Field label="Brain base URL">
                  <input
                    value={config.brainBaseUrl}
                    onChange={(event) => updateConfig({ brainBaseUrl: event.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                    placeholder="http://localhost:8000"
                  />
                </Field>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <ApiKeyInput
                  id="setup-openai"
                  label="OpenAI"
                  value={config.openaiApiKey}
                  onChange={(value) => updateConfig({ openaiApiKey: value })}
                  onValidate={() => testProvider("openai")}
                  validateLabel={loading["test-openai"] ? "Test..." : "Tester"}
                  status={validated["openai"] ? "success" : validatedMsg["openai"] ? "error" : undefined}
                  statusMessage={validatedMsg["openai"]}
                />
                <ApiKeyInput
                  id="setup-anthropic"
                  label="Anthropic"
                  value={config.anthropicApiKey}
                  onChange={(value) => updateConfig({ anthropicApiKey: value })}
                  onValidate={() => testProvider("anthropic")}
                  validateLabel={loading["test-anthropic"] ? "Test..." : "Tester"}
                  status={validated["anthropic"] ? "success" : validatedMsg["anthropic"] ? "error" : undefined}
                  statusMessage={validatedMsg["anthropic"]}
                />
                <ApiKeyInput
                  id="setup-google"
                  label="Google Generative"
                  value={config.googleApiKey}
                  onChange={(value) => updateConfig({ googleApiKey: value })}
                  onValidate={() => testProvider("google")}
                  validateLabel={loading["test-google"] ? "Test..." : "Tester"}
                  status={validated["google"] ? "success" : validatedMsg["google"] ? "error" : undefined}
                  statusMessage={validatedMsg["google"]}
                />
                <ApiKeyInput
                  id="setup-mistral"
                  label="Mistral"
                  value={config.mistralApiKey}
                  onChange={(value) => updateConfig({ mistralApiKey: value })}
                  onValidate={() => testProvider("mistral")}
                  validateLabel={loading["test-mistral"] ? "Test..." : "Tester"}
                  status={validated["mistral"] ? "success" : validatedMsg["mistral"] ? "error" : undefined}
                  statusMessage={validatedMsg["mistral"]}
                />
                <ApiKeyInput
                  id="setup-deepseek"
                  label="DeepSeek"
                  value={config.deepseekApiKey}
                  onChange={(value) => updateConfig({ deepseekApiKey: value })}
                  onValidate={() => testProvider("deepseek")}
                  validateLabel={loading["test-deepseek"] ? "Test..." : "Tester"}
                  status={validated["deepseek"] ? "success" : validatedMsg["deepseek"] ? "error" : undefined}
                  statusMessage={validatedMsg["deepseek"]}
                />
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white">Ollama (local)</label>
                    <span className="rounded-full border border-white/10 bg-slate-950/50 px-2 py-0.5 text-[10px] text-slate-400">
                      par default
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => testProvider("ollama")}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
                    >
                      {loading["test-ollama"] ? "Test..." : "Tester /api/tags"}
                    </button>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-mono ${
                        validated["ollama"]
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : validatedMsg["ollama"]
                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                            : "border-white/10 bg-white/5 text-slate-300"
                      }`}
                    >
                      {validated["ollama"] ? "OK" : validatedMsg["ollama"] ?? "indetermine"}
                    </span>
                  </div>
                  {validatedMsg["ollama"] ? (
                    <p className="mt-3 text-xs text-slate-400">{validatedMsg["ollama"]}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                Modules actifs
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleToggle
                  title="Voix (STT + TTS + Wake word)"
                  description="Entrees micro, sortie audio, Whisper / Piper."
                  icon={Radio}
                  on={modules.voice}
                  onToggle={() => setModules({ voice: !modules.voice })}
                />
                <ModuleToggle
                  title="Moteur proactif"
                  description="Collecteurs meteo, news, RSS et initiatives planifiees."
                  icon={Zap}
                  on={modules.proactive}
                  onToggle={() => setModules({ proactive: !modules.proactive })}
                />
                <ModuleToggle
                  title="Memoire semantique"
                  description="Facts SQLite + graphe semantique + recherche vectorielle."
                  icon={Database}
                  on={modules.memory}
                  onToggle={() => setModules({ memory: !modules.memory })}
                />
                <ModuleToggle
                  title="Computer Use (exp.)"
                  description="Prise d&apos;ecran, controle souris/clavier, YOLO (Moteur Rust)."
                  icon={Cpu}
                  on={modules.computerUse}
                  onToggle={() => setModules({ computerUse: !modules.computerUse })}
                  danger
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                  Detection de ports (scan localhost)
                </p>
                <button
                  type="button"
                  onClick={runPortScan}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading["ports"] ? "animate-spin" : ""}`} />
                  Scanner les ports
                </button>
              </div>
              <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {(config.wizard.portProbes.length ? config.wizard.portProbes : DEFAULT_PORTS.map((p) => ({ ...p, busy: false, latencyMs: null }))).map((probe) => (
                  <li
                    key={probe.port}
                    className={`rounded-2xl border p-5 ${
                      probe.busy
                        ? "border-rose-400/30 bg-rose-500/5"
                        : "border-emerald-400/20 bg-emerald-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-slate-400">
                          {probe.label}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">{probe.port}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-mono ${
                          probe.busy
                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {probe.busy ? "OCCUPE" : "LIBRE"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">
                      {probe.latencyMs != null ? `Latence : ${probe.latencyMs} ms` : "Scan non realise."}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                Navigateur side : HTTP HEAD avec mode no-cors et timeout 250ms.
                Fournit une indication heuristique (&laquo; occup&eacute; &raquo;
                si la requete aboutit, &laquo; libre &raquo; sinon).
              </p>
            </div>
          ) : null}

          <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <div>
              {message ? (
                <p className="text-sm text-cyan-200">{message}</p>
              ) : (
                <p className="text-sm text-slate-400">
                  Etapes completees : {step}/5 {step === 4 ? "(finale)" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1) as 0 | 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Precedent
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep((s) => Math.min(4, s + 1) as 0 | 1 | 2 | 3 | 4)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading["finish"]}
                  onClick={async () => {
                    await onFinish();
                    setTimeout(() => navigate("/"), 700);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {loading["finish"] ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Finalisation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Terminer et retour accueil
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  children: ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}

type RadioCardProps = {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  icon: typeof Globe2;
};

function RadioCard({ active, title, description, onClick, icon: Icon }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-4 text-left transition ${
        active ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50" : "border-white/10 bg-white/5 text-slate-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span className="font-medium">{title}</span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </button>
  );
}

function ModuleToggle({
  title,
  description,
  on,
  onToggle,
  icon: Icon,
  danger,
}: {
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  icon: typeof Radio;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start justify-between gap-5 rounded-3xl border p-5 text-left transition ${
        on
          ? danger
            ? "border-rose-400/30 bg-rose-500/10"
            : "border-cyan-400/30 bg-cyan-500/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-slate-200">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        </div>
      </div>
      <div
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          on
            ? danger
              ? "border-rose-400/50 bg-rose-500/30"
              : "border-emerald-400/50 bg-emerald-500/30"
            : "border-white/10 bg-white/5"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}
