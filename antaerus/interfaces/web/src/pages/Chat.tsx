import { useQuery } from "@tanstack/react-query";
import { Activity, Settings2, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";

import MessageBubble from "@/components/MessageBubble";
import MessageInput from "@/components/MessageInput";
import { fetchBrainProviders, fetchSystemStatus } from "@/lib/api";
import { useChatStream } from "@/hooks/useChatStream";
import { useSession } from "@/hooks/useSession";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAppStore } from "@/store/useAppStore";

const queryOptions = {
  queryKey: ["system-status"],
  queryFn: fetchSystemStatus,
  refetchInterval: 10000,
};

export default function Chat() {
  const { sessionId, resetSession } = useSession();
  const config = useAppStore((state) => state.config);
  const messages = useAppStore((state) => state.messages);
  const lastError = useAppStore((state) => state.lastError);
  const lastHeartbeat = useAppStore((state) => state.lastHeartbeat);
  const addUserMessage = useAppStore((state) => state.addUserMessage);
  const clearMessages = useAppStore((state) => state.clearMessages);
  const { connectionState, connect, disconnect, sendChatMessage } =
    useWebSocket(sessionId);
  const { isStreaming, streamPrompt } = useChatStream();

  const statusQuery = useQuery(queryOptions);
  const providersQuery = useQuery({
    queryKey: ["brain-providers", config.brainBaseUrl],
    queryFn: () => fetchBrainProviders(config.brainBaseUrl),
    enabled: config.chatTransport === "sse-dev",
    retry: false,
  });

  useEffect(() => {
    if (config.chatTransport === "ws" && config.websocketDevToken.trim()) {
      void connect();
    }
  }, [config.chatTransport, config.websocketDevToken, connect]);

  const handleSend = async (content: string) => {
    addUserMessage(content, config.chatTransport);

    if (config.chatTransport === "sse-dev") {
      await streamPrompt(content);
      return;
    }

    await sendChatMessage(content);
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
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                >
                  Nouvelle session
                </button>
              </div>
            </div>

            {lastError && (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {lastError}
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-slate-400">
                  Envoyez un premier message pour initialiser la conversation.
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            <MessageInput
              disabled={isStreaming}
              onSend={(content) => handleSend(content)}
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
                <p>
                  Provider défaut local :{" "}
                  <span className="font-mono text-cyan-200">
                    {config.defaultProvider}
                  </span>
                </p>
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
                {!providersQuery.data && (
                  <p className="text-slate-400">
                    Providers chargés uniquement en mode `sse-dev`.
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
