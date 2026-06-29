import { useCallback, useEffect, useRef } from "react";

import {
  buildWebSocketUrl,
  createChatMessageEnvelope,
  parseWebSocketServerMessage,
} from "@/lib/ws";
import { useAppStore } from "@/store/useAppStore";

export function useWebSocket(sessionId: string) {
  const config = useAppStore((state) => state.config);
  const connectionState = useAppStore((state) => state.connectionState);
  const setConnectionState = useAppStore((state) => state.setConnectionState);
  const setLastError = useAppStore((state) => state.setLastError);
  const appendAssistantChunk = useAppStore((state) => state.appendAssistantChunk);
  const finalizeAssistantMessage = useAppStore(
    (state) => state.finalizeAssistantMessage,
  );
  const setHeartbeat = useAppStore((state) => state.setHeartbeat);
  const socketRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnectionState("idle");
  }, [setConnectionState]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!config.websocketDevToken.trim()) {
      setLastError("Ajoutez un jeton WebSocket de dev dans Setup avant de vous connecter.");
      setConnectionState("error");
      return false;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return true;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      return false;
    }

    setConnectionState("connecting");
    setLastError(null);

    const socket = new WebSocket(
      buildWebSocketUrl(config.gatewayBaseUrl, config.websocketDevToken),
    );
    socketRef.current = socket;

    return new Promise<boolean>((resolve) => {
      socket.addEventListener(
        "open",
        () => {
          setConnectionState("connected");
          resolve(true);
        },
        { once: true },
      );

      socket.addEventListener(
        "error",
        () => {
          setConnectionState("error");
          setLastError("Connexion WebSocket impossible.");
          resolve(false);
        },
        { once: true },
      );

      socket.addEventListener("close", () => {
        socketRef.current = null;
        setConnectionState("idle");
      });

      socket.addEventListener("message", (event) => {
        const message = parseWebSocketServerMessage(String(event.data));
        if (!message) {
          return;
        }

        switch (message.type) {
          case "chat.token":
            appendAssistantChunk(message.payload.token, "ws");
            break;
          case "chat.complete":
            finalizeAssistantMessage(message.payload.message, "ws");
            break;
          case "health.heartbeat":
            setHeartbeat(message.payload.services);
            break;
          default:
            break;
        }
      });
    });
  }, [
    appendAssistantChunk,
    config.gatewayBaseUrl,
    config.websocketDevToken,
    finalizeAssistantMessage,
    setConnectionState,
    setHeartbeat,
    setLastError,
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

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    connect,
    disconnect,
    sendChatMessage,
    connectionState,
  };
}
