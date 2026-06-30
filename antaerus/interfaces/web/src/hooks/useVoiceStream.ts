import { useMemo } from "react";

import type { ConnectionState, VoiceMode, VoiceVADState } from "@/store/useAppStore";
import { useAppStore } from "@/store/useAppStore";

type VoiceStreamArgs = {
  sessionId: string;
  connectionState: ConnectionState;
  sendVoiceStart: () => Promise<boolean>;
  sendVoiceStop: () => Promise<boolean>;
  sendVoiceBargeIn: () => Promise<boolean>;
};

export function useVoiceStream({
  sessionId,
  connectionState,
  sendVoiceStart,
  sendVoiceStop,
  sendVoiceBargeIn,
}: VoiceStreamArgs) {
  const config = useAppStore((state) => state.config);
  const voiceMode = useAppStore((state) => state.voiceMode);
  const voiceTranscript = useAppStore((state) => state.voiceTranscript);
  const voiceSessionActive = useAppStore((state) => state.voiceSessionActive);
  const voiceVADState = useAppStore((state) => state.voiceVADState);

  const isVoiceAvailable = config.chatTransport === "ws";
  const hasSession = Boolean(sessionId);
  const canStart = isVoiceAvailable && hasSession && !voiceSessionActive;
  const canStop = isVoiceAvailable && voiceSessionActive;
  const canBargeIn =
    isVoiceAvailable && voiceSessionActive && voiceMode === "speaking";

  const statusLabel = useMemo(() => {
    if (!isVoiceAvailable) {
      return "Voix indisponible en mode SSE dev";
    }
    if (voiceMode === "speaking") {
      return "Réponse vocale en cours";
    }
    if (voiceMode === "listening" && voiceVADState === "speaking") {
      return "Écoute active";
    }
    if (voiceMode === "listening") {
      return "Écoute prête";
    }
    if (connectionState === "connecting") {
      return "Connexion WebSocket en cours";
    }
    return "Voix inactive";
  }, [connectionState, isVoiceAvailable, voiceMode, voiceVADState]);

  const primaryActionLabel = useMemo(() => {
    if (voiceMode === "speaking" || voiceMode === "listening") {
      return "Arrêter la voix";
    }
    return "Démarrer la voix";
  }, [voiceMode]);

  const startVoice = async () => {
    if (!canStart) {
      return false;
    }
    return sendVoiceStart();
  };

  const stopVoice = async () => {
    if (!canStop) {
      return false;
    }
    return sendVoiceStop();
  };

  const bargeIn = async () => {
    if (!canBargeIn) {
      return false;
    }
    return sendVoiceBargeIn();
  };

  return {
    voiceMode: voiceMode as VoiceMode,
    voiceTranscript,
    voiceVADState: voiceVADState as VoiceVADState,
    voiceSessionActive,
    isVoiceAvailable,
    canStart,
    canStop,
    canBargeIn,
    statusLabel,
    primaryActionLabel,
    startVoice,
    stopVoice,
    bargeIn,
  };
}
