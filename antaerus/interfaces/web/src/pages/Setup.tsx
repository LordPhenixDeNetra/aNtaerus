import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import ApiKeyInput from "@/components/ApiKeyInput";
import type { ProviderName } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

const providerOptions: ProviderName[] = [
  "anthropic",
  "openai",
  "mistral",
  "ollama",
];

export default function Setup() {
  const config = useAppStore((state) => state.config);
  const updateConfig = useAppStore((state) => state.updateConfig);

  return (
    <main className="min-h-screen px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-300">
                Setup Wizard
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Configuration locale du frontend
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Les paramètres saisis ici restent dans le navigateur. Aucun
                secret n&apos;est envoyé au backend dans ce lot `M1.3`.
              </p>
            </div>

            <nav className="flex items-center gap-3">
              <Link
                to="/"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
              >
                Retour au chat
              </Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
              Identité & Transport
            </p>

            <div className="mt-5 space-y-5">
              <Field label="Nom affiché">
                <input
                  value={config.displayName}
                  onChange={(event) =>
                    updateConfig({ displayName: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  placeholder="Ex. Anta"
                />
              </Field>

              <Field label="Provider par défaut">
                <select
                  value={config.defaultProvider}
                  onChange={(event) =>
                    updateConfig({
                      defaultProvider: event.target.value as ProviderName,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                >
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Mode de chat">
                <div className="grid gap-3 md:grid-cols-2">
                  <ModeButton
                    active={config.chatTransport === "ws"}
                    title="WebSocket Go"
                    description="Canal principal pour le chat texte."
                    onClick={() => updateConfig({ chatTransport: "ws" })}
                  />
                  <ModeButton
                    active={config.chatTransport === "sse-dev"}
                    title="SSE direct brain"
                    description="Mode développement vers brain_python."
                    onClick={() => updateConfig({ chatTransport: "sse-dev" })}
                  />
                </div>
              </Field>
            </div>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
              Endpoints & Jeton dev
            </p>

            <div className="mt-5 space-y-5">
              <Field label="Gateway base URL">
                <input
                  value={config.gatewayBaseUrl}
                  onChange={(event) =>
                    updateConfig({ gatewayBaseUrl: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  placeholder="http://localhost:8080"
                />
              </Field>

              <Field label="Brain base URL">
                <input
                  value={config.brainBaseUrl}
                  onChange={(event) =>
                    updateConfig({ brainBaseUrl: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  placeholder="http://localhost:8000"
                />
              </Field>

              <ApiKeyInput
                id="websocket-dev-token"
                label="Jeton WebSocket de dev"
                value={config.websocketDevToken}
                placeholder="Collez ici un JWT de développement"
                onChange={(value) => updateConfig({ websocketDevToken: value })}
              />
            </div>
          </article>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
            Clés API locales
          </p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <ApiKeyInput
              id="anthropic-api-key"
              label="Anthropic"
              value={config.anthropicApiKey}
              onChange={(value) => updateConfig({ anthropicApiKey: value })}
            />
            <ApiKeyInput
              id="openai-api-key"
              label="OpenAI"
              value={config.openaiApiKey}
              onChange={(value) => updateConfig({ openaiApiKey: value })}
            />
            <ApiKeyInput
              id="mistral-api-key"
              label="Mistral"
              value={config.mistralApiKey}
              onChange={(value) => updateConfig({ mistralApiKey: value })}
            />
          </div>
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

type ModeButtonProps = {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
};

function ModeButton({
  active,
  title,
  description,
  onClick,
}: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-4 text-left transition ${
        active
          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-50"
          : "border-white/10 bg-white/5 text-slate-200"
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </button>
  );
}
