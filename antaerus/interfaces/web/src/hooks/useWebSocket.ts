import { useCallback, useEffect, useRef } from "react";

import { fetchDevToken } from "@/lib/api";
import {
  buildWebSocketUrl,
  createVoiceBargeInEnvelope,
  createVoiceStartEnvelope,
  createVoiceStopEnvelope,
  createChatMessageEnvelope,
  parseWebSocketServerMessage,
} from "@/lib/ws";
import { useAppStore } from "@/store/useAppStore";

export function useWebSocket(sessionId: string) {
  const config = useAppStore((state) => state.config);
  const connectionState = useAppStore((state) => state.connectionState);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const setConnectionState = useAppStore((state) => state.setConnectionState);
  const setLastError = useAppStore((state) => state.setLastError);
  const appendAssistantChunk = useAppStore((state) => state.appendAssistantChunk);
  const finalizeAssistantMessage = useAppStore(
    (state) => state.finalizeAssistantMessage,
  );
  const setHeartbeat = useAppStore((state) => state.setHeartbeat);
  const setVoiceMode = useAppStore((state) => state.setVoiceMode);
  const setVoiceSessionActive = useAppStore((state) => state.setVoiceSessionActive);
  const setVoiceTranscript = useAppStore((state) => state.setVoiceTranscript);
  const setVoiceVADState = useAppStore((state) => state.setVoiceVADState);
  const setVoiceWakeState = useAppStore((state) => state.setVoiceWakeState);
  const resetVoiceState = useAppStore((state) => state.resetVoiceState);
  const mergeMissionUpdate = useAppStore((state) => state.mergeMissionUpdate);
  const mergeInitiativeUpdate = useAppStore((state) => state.mergeInitiativeUpdate);
  const socketRef = useRef<WebSocket | null>(null);
  const connectPromiseRef = useRef<Promise<boolean> | null>(null);

  const shouldResetVoiceState = useCallback((message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("no active voice session") ||
      normalized.includes("voice control failed") ||
      normalized.includes("voice runtime stream failed") ||
      normalized.includes("voice synthesis failed") ||
      normalized.includes("voice brain stream failed") ||
      normalized.includes("voice feature is disabled") ||
      normalized.includes("missing antaerus_engine") ||
      normalized.includes("capture error") ||
      normalized.includes("stt init error") ||
      normalized.includes("tts init error")
    );
  }, []);

  const ensureDevToken = useCallback(async (force: boolean = false) => {
    if (!force && config.websocketDevToken.trim()) {
      return config.websocketDevToken;
    }

    const subject = config.displayName.trim() || "web-dev-user";
    const response = await fetchDevToken(config.gatewayBaseUrl, subject);
    updateConfig({ websocketDevToken: response.token });
    return response.token;
  }, [
    config.displayName,
    config.gatewayBaseUrl,
    config.websocketDevToken,
    updateConfig,
  ]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    connectPromiseRef.current = null;

    setConnectionState("idle");
    resetVoiceState();
  }, [resetVoiceState, setConnectionState]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return true;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      return connectPromiseRef.current ?? false;
    }

    setConnectionState("connecting");
    setLastError(null);

    let token = "";
    try {
      token = await ensureDevToken();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de générer un jeton de développement.";
      setLastError(message);
      setConnectionState("error");
      return false;
    }

    const wsAbsoluteUrl = buildWebSocketUrl(config.gatewayBaseUrl, token);
    try {
      const httpCheck = new URL(wsAbsoluteUrl);
      httpCheck.protocol = httpCheck.protocol === "wss:" ? "https:" : "http:";
      const probe = await fetch(httpCheck.toString(), {
        method: "GET",
        headers: { Accept: "*/*" },
      });
      if (probe.status === 401) {
        setLastError(
          "JWT invalide (401). Vérifiez que ANTAERUS_GATEWAY_JWT_SECRET est identique dans .env lors de la génération et de la validation. Cliquez sur « Générer JWT dev » puis reconnectez.",
        );
        setConnectionState("error");
        return false;
      }
      if (probe.status === 429) {
        setLastError(
          "Trop de connexions WebSocket simultanées (429). Attendez 10 secondes puis réessayez.",
        );
        setConnectionState("error");
        return false;
      }
      if (probe.status === 404 || probe.status < 100) {
        setLastError(
          `Gateway Go introuvable (${probe.status === 404 ? "404" : "hors ligne"}). Vérifiez que dev-gateway.ps1 est démarré sur le port 8080.`,
        );
        setConnectionState("error");
        return false;
      }
      if (probe.status >= 500) {
        setLastError(`Erreur interne gateway Go (${probe.status}). Consultez les logs gateway.`);
        setConnectionState("error");
        return false;
      }
    } catch (networkError) {
      const hint =
        networkError instanceof Error ? networkError.message : "NetworkError";
      setLastError(
        `Connexion réseau impossible au Gateway Go. Vérifiez que dev-gateway.ps1 est bien STARTING sur le port 8080 (${hint}).`,
      );
      setConnectionState("error");
      return false;
    }

    const socket = new WebSocket(wsAbsoluteUrl);
    socketRef.current = socket;

    const connectPromise = new Promise<boolean>((resolve) => {
      socket.addEventListener(
        "open",
        () => {
          setConnectionState("connected");
          connectPromiseRef.current = null;
          resolve(true);
        },
        { once: true },
      );

      socket.addEventListener(
        "error",
        () => {
          setConnectionState("error");
          setLastError("Connexion WebSocket impossible.");
          connectPromiseRef.current = null;
          resolve(false);
        },
        { once: true },
      );

      socket.addEventListener("close", () => {
        socketRef.current = null;
        connectPromiseRef.current = null;
        setConnectionState("idle");
        resetVoiceState();
      });

      socket.addEventListener("message", (event) => {
        const message = parseWebSocketServerMessage(String(event.data));
        if (!message) {
          return;
        }

        switch (message.type) {
          case "chat.token":
            appendAssistantChunk(message.payload.token, "ws");
            if (useAppStore.getState().voiceSessionActive) {
              setVoiceMode("speaking");
            }
            break;
          case "chat.complete":
            finalizeAssistantMessage(message.payload.message, "ws");
            setVoiceMode(useAppStore.getState().voiceSessionActive ? "listening" : "idle");
            break;
          case "voice.transcript":
            setVoiceTranscript(message.payload.transcript);
            break;
          case "voice.vad_state":
            setVoiceVADState(message.payload.state);
            if (
              useAppStore.getState().voiceSessionActive &&
              useAppStore.getState().voiceMode !== "speaking"
            ) {
              setVoiceMode("listening");
            }
            break;
          case "voice.wake_state":
            setVoiceWakeState(message.payload.state);
            if (useAppStore.getState().voiceSessionActive) {
              setVoiceMode("listening");
            }
            break;
          case "system.alert":
            setLastError(message.payload.message);
            if (shouldResetVoiceState(message.payload.message)) {
              resetVoiceState();
            }
            break;
          case "health.heartbeat":
            setHeartbeat(message.payload.services);
            break;
          case "mission.update":
            mergeMissionUpdate(message.payload);
            break;
          case "initiative.update":
            mergeInitiativeUpdate(message.payload);
            break;
          default:
            break;
        }
      });
    });
    connectPromiseRef.current = connectPromise;
    return connectPromise;
  }, [
    appendAssistantChunk,
    config.gatewayBaseUrl,
    ensureDevToken,
    finalizeAssistantMessage,
    mergeInitiativeUpdate,
    mergeMissionUpdate,
    resetVoiceState,
    setConnectionState,
    setHeartbeat,
    setLastError,
    setVoiceMode,
    setVoiceTranscript,
    setVoiceVADState,
    setVoiceWakeState,
    shouldResetVoiceState,
  ]);

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!sessionId) {
        setLastError("Session introuvable.");
        return false;
      }

      const connected = await connect();
      if (!connected || !socketRef.current) {
        return false;
      }

      socketRef.current.send(
        JSON.stringify(createChatMessageEnvelope(sessionId, content)),
      );
      return true;
    },
    [connect, sessionId, setLastError],
  );

  const sendVoiceStart = useCallback(async () => {
    if (!sessionId) {
      setLastError("Session introuvable.");
      return false;
    }

    const connected = await connect();
    if (!connected || !socketRef.current) {
      return false;
    }

    setVoiceTranscript("");
    setVoiceVADState(null);
    setVoiceWakeState("waiting");
    setVoiceSessionActive(true);
    setVoiceMode("listening");
    socketRef.current.send(JSON.stringify(createVoiceStartEnvelope(sessionId)));
    return true;
  }, [
    connect,
    sessionId,
    setLastError,
    setVoiceMode,
    setVoiceSessionActive,
    setVoiceTranscript,
    setVoiceVADState,
    setVoiceWakeState,
  ]);

  const sendVoiceStop = useCallback(async () => {
    if (!sessionId) {
      setLastError("Session introuvable.");
      return false;
    }

    const connected = await connect();
    if (!connected || !socketRef.current) {
      return false;
    }

    socketRef.current.send(JSON.stringify(createVoiceStopEnvelope(sessionId)));
    resetVoiceState();
    return true;
  }, [connect, resetVoiceState, sessionId, setLastError]);

  const sendVoiceBargeIn = useCallback(async () => {
    if (!sessionId) {
      setLastError("Session introuvable.");
      return false;
    }

    const connected = await connect();
    if (!connected || !socketRef.current) {
      return false;
    }

    socketRef.current.send(JSON.stringify(createVoiceBargeInEnvelope(sessionId)));
    setVoiceTranscript("");
    setVoiceVADState(null);
    setVoiceWakeState("waiting");
    setVoiceSessionActive(true);
    setVoiceMode("listening");
    return true;
  }, [
    connect,
    sessionId,
    setLastError,
    setVoiceMode,
    setVoiceSessionActive,
    setVoiceTranscript,
    setVoiceVADState,
    setVoiceWakeState,
  ]);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    connect,
    disconnect,
    ensureDevToken,
    sendChatMessage,
    sendVoiceStart,
    sendVoiceStop,
    sendVoiceBargeIn,
    connectionState,
  };
}
