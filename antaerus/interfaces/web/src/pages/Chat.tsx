import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

import MessageBubble from "@/components/MessageBubble";
import MessageInput from "@/components/MessageInput";
import {
  fetchBrainProviders,
  fetchChatSessionHistory,
  fetchSystemStatus,
} from "@/lib/api";
import { useChatStream } from "@/hooks/useChatStream";
import { useSession } from "@/hooks/useSession";
import { useVAD } from "@/hooks/useVAD";
import { useVoiceStream } from "@/hooks/useVoiceStream";
import { useWebSocket } from "@/hooks/useWebSocket";
import { fromHistoryMessage } from "@/lib/chat";
import { useAppStore } from "@/store/useAppStore";

const queryOptions = {
  queryKey: ["system-status"],
  queryFn: fetchSystemStatus,
  refetchInterval: 10000,
};

export default function Chat() {
  const { sessionId, resetSession } = useSession();
  const config = useAppStore((state) => state.config);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const messages = useAppStore((state) => state.messages);
  const lastError = useAppStore((state) => state.lastError);
  const setLastError = useAppStore((state) => state.setLastError);
  const lastHeartbeat = useAppStore((state) => state.lastHeartbeat);
  const addUserMessage = useAppStore((state) => state.addUserMessage);
  const clearMessages = useAppStore((state) => state.clearMessages);
  const replaceMessages = useAppStore((state) => state.replaceMessages);
  const resetVoiceState = useAppStore((state) => state.resetVoiceState);
  const {
    connectionState,
    connect,
    disconnect,
    ensureDevToken,
    sendChatMessage,
    sendVoiceStart,
    sendVoiceStop,
    sendVoiceBargeIn,
    wsStreaming,
    cancelWsStream,
  } = useWebSocket(sessionId);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isStreaming, streamPrompt, cancelStream } = useChatStream();
  const { visualizerLevel } = useVAD();
  const voice = useVoiceStream({
    sessionId,
    connectionState,
    sendVoiceStart,
    sendVoiceStop,
    sendVoiceBargeIn,
  });

  const [pendingSend, setPendingSend] = useState(false);
  const aiThinking = useMemo(
    () => isStreaming || wsStreaming || pendingSend,
    [isStreaming, wsStreaming, pendingSend],
  );

  const cancelBoth = useCallback(() => {
    cancelStream();
    cancelWsStream("Réponse annulée par l'utilisateur.");
    setPendingSend(false);
  }, [cancelStream, cancelWsStream]);

  const statusQuery = useQuery(queryOptions);
  const providersQuery = useQuery({
    queryKey: ["brain-providers", config.brainBaseUrl],
    queryFn: () => fetchBrainProviders(config.brainBaseUrl),
    enabled: true,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["chat-history", config.gatewayBaseUrl, sessionId],
    queryFn: () => fetchChatSessionHistory(config.gatewayBaseUrl, sessionId),
    enabled: Boolean(sessionId),
  });

  useEffect(() => {
    if (!historyQuery.data?.messages) {
      return;
    }

    replaceMessages(
      historyQuery.data.messages.map((message) => fromHistoryMessage(message)),
    );
  }, [historyQuery.data, replaceMessages]);

  useEffect(() => {
    if (config.chatTransport === "ws") {
      void connect();
    }
  }, [config.chatTransport, connect]);

  useEffect(() => {
    if (!successMessage && !lastError) {
      return;
    }
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      /* noop */
    }
  }, [successMessage, lastError]);

  async function toggleTransport() {
    const nextTransport = config.chatTransport === "ws" ? "sse-dev" : "ws";
    updateConfig({ chatTransport: nextTransport });
    setLastError(null);
    if (nextTransport === "ws") {
      setTimeout(() => void connect(), 50);
    } else {
      disconnect();
    }
  }

  const handleSend = async (content: string) => {
    if (aiThinking) {
      return;
    }
    setSuccessMessage(null);
    setLastError(null);
    addUserMessage(content, config.chatTransport);
    setPendingSend(true);

    try {
      if (config.chatTransport === "sse-dev") {
        await streamPrompt(content);
        return;
      }

      const ok = await sendChatMessage(content);
      if (!ok) {
        const hint =
          connectionState === "error"
            ? lastError ?? "La connexion WebSocket est en erreur."
            : connectionState === "idle"
              ? "La connexion WebSocket n'a pas été établie."
              : "Échec d'envoi du message.";
        setLastError(
          `Impossible d'envoyer le message. ${hint} Cliquez sur « Générer JWT dev » puis « Connecter » pour rétablir la liaison.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue d'envoi.";
      setLastError(message);
    } finally {
      setTimeout(() => setPendingSend(false), 1200);
    }
  };

  return (
    <main className="min-h-screen px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-6 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-300">
                UI Core
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Chat texte aNtaerus
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Cette interface prépare `M1.4` avec un mode WebSocket Go et un
                mode SSE direct vers `brain_python` pour le développement.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100"
              >
                Chat
              </Link>
              <Link
                to="/setup"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
              >
                <Settings2 className="h-4 w-4" />
                Setup
              </Link>
              <button
                type="button"
                onClick={toggleTransport}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                  config.chatTransport === "ws"
                    ? "border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
                    : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                }`}
                title="Basculer entre SSE direct Brain et WebSocket Gateway (voix WS seulement)"
              >
                <Zap className="h-4 w-4" />
                Mode:{" "}
                <span className="font-mono uppercase tracking-[0.15em]">
                  {config.chatTransport}
                </span>
              </button>
            </nav>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr]">
          <div className="flex min-h-[70vh] flex-col gap-4 rounded-[32px] border border-white/10 bg-slate-950/70 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill label="Mode" value={config.chatTransport} />
                <StatusPill label="Session" value={sessionId || "initialisation"} />
                <StatusPill label="Connexion" value={connectionState} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void connect()}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100"
                >
                  <Wifi className="h-4 w-4" />
                  Connecter
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setLastError(null);
                      setSuccessMessage(null);
                      const generated = await ensureDevToken(true);
                      if (!generated) {
                        throw new Error("Jeton vide retourné par le gateway.");
                      }
                      const short =
                        generated.length > 24
                          ? `${generated.slice(0, 12)}...${generated.slice(-8)}`
                          : generated;
                      setSuccessMessage(
                        `Jeton JWT dev régénéré (${short}). Cliquez sur « Connecter » pour établir la WebSocket.`,
                      );
                    } catch (error) {
                      const hint =
                        error instanceof Error ? error.message : "Erreur inconnue.";
                      setLastError(
                        `Impossible de générer un jeton JWT dev : ${hint}`,
                      );
                      setSuccessMessage(null);
                    }
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                >
                  Générer JWT dev
                </button>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                >
                  <WifiOff className="h-4 w-4" />
                  Déconnecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetSession();
                    clearMessages();
                    resetVoiceState();
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                >
                  Nouvelle session
                </button>
              </div>
            </div>

            {successMessage ? (
              <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <div className="flex flex-wrap items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-200" />
                  <p className="flex-1 font-medium">{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => void connect()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-400/20"
                  >
                    <Wifi className="h-3.5 w-3.5" />
                    Connecter maintenant
                  </button>
                </div>
              </div>
            ) : null}

            {lastError && (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <div className="flex flex-wrap items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-rose-200" />
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">{lastError}</p>
                    {lastError.toLowerCase().includes("websocket") ? (
                      <ul className="list-disc space-y-1 pl-5 text-xs text-rose-200/90">
                        <li>
                          Verifiez que le gateway Go est bien demarre sur le port 8080
                          (onglet dev-all PowerShell "starting gateway_go on :8080").
                        </li>
                        <li>
                          Cliquez sur le bouton <span className="font-mono">Connecter</span>{" "}
                          ci-dessous pour retenter.
                        </li>
                        <li>
                          Si besoin, cliquez sur{" "}
                          <span className="font-mono">Générer JWT dev</span> pour forcer un
                          nouveau jeton.
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  {lastError.toLowerCase().includes("websocket") ? (
                    <button
                      type="button"
                      onClick={() => void connect()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-100 hover:bg-rose-400/20"
                    >
                      <Wifi className="h-3.5 w-3.5" />
                      Reconnecter
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {!lastError && config.chatTransport === "sse-dev" ? (
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-200/90">
                Mode SSE dev actif : la voix est{" "}
                <span className="font-semibold text-amber-200">desactivee</span>. Utilisez le
                bouton <span className="font-mono">Mode: sse-dev</span> pour basculer en
                WebSocket.
              </div>
            ) : null}

            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {historyQuery.isLoading && (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                  Chargement de l&apos;historique de session...
                </div>
              )}
              {messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-slate-400">
                  Envoyez un premier message pour initialiser la conversation.
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}

              {aiThinking ? (
                <div className="flex items-end gap-3">
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10">
                    <span className="text-[10px] font-bold text-violet-200">IA</span>
                  </div>
                  <div className="rounded-3xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3 text-slate-200 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3" aria-label="IA ecrit">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-200"></span>
                        <span className="ml-3 text-xs text-slate-400">
                          aNtaerus ecrit une reponse...
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={cancelBoth}
                        className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-500/30 bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-500/20"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <MessageInput
              disabled={isStreaming || wsStreaming}
              onSend={(content) => handleSend(content)}
              voice={{
                mode: voice.voiceMode,
                transcript: voice.voiceTranscript,
                vadState: voice.voiceVADState,
                wakeState: voice.voiceWakeState,
                visualizerLevel,
                statusLabel: voice.statusLabel,
                disabled: !voice.isVoiceAvailable || connectionState === "connecting",
                canBargeIn: voice.canBargeIn,
                onPrimaryAction: voice.handlePrimaryAction,
                onBargeIn: voice.bargeIn,
              }}
            />
          </div>

          <aside className="space-y-6">
            <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Activity className="h-4 w-4 text-cyan-200" />
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
                    État système
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    {statusQuery.data?.environment ?? "indisponible"}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <p>Services visibles : {statusQuery.data?.services.length ?? 0}</p>
                <p>Heartbeat WS : {lastHeartbeat.length}</p>
                <p>Messages persistés : {historyQuery.data?.messages?.length ?? 0}</p>
                {providersQuery.data ? (
                  <p>
                    Provider (Brain · mode&nbsp;
                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-slate-100">
                      {config.chatTransport}
                    </code>
                    ) :{" "}
                    <span className="font-mono text-cyan-200">
                      {providersQuery.data.defaultProvider}
                    </span>
                    {" · "}
                    <span className="font-mono text-[12px] text-slate-200">
                      {providersQuery.data.providers.find(
                        (p) => p.name === providersQuery.data.defaultProvider,
                      )?.model ?? "modèle inconnu"}
                    </span>
                  </p>
                ) : providersQuery.isLoading ? (
                  <p>
                    Provider Brain :{" "}
                    <span className="text-cyan-200">chargement…</span>
                  </p>
                ) : (
                  <p>
                    Fallback local (sse-dev) :{" "}
                    <span className="font-mono text-amber-300">
                      {config.defaultProvider}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-400">
                      (Brain non joignable sur {config.brainBaseUrl})
                    </span>
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-slate-950/70 p-5 backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
                Providers Brain
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {providersQuery.data?.providers?.map((provider) => (
                  <div
                    key={provider.name}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="font-mono text-cyan-200">{provider.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{provider.model}</p>
                  </div>
                ))}
                {!providersQuery.data && providersQuery.isLoading && (
                  <p className="text-cyan-200/70">Chargement des providers…</p>
                )}
                {!providersQuery.data && !providersQuery.isLoading && (
                  <p className="text-amber-200/80">
                    Impossible de charger les providers. Brain Python joignable
                    sur {config.brainBaseUrl} ?
                  </p>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

type StatusPillProps = {
  label: string;
  value: string;
};

function StatusPill({ label, value }: StatusPillProps) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
      <span className="font-mono uppercase tracking-[0.25em] text-slate-500">
        {label}
      </span>
      <span className="ml-3 font-medium text-white">{value}</span>
    </div>
  );
}
