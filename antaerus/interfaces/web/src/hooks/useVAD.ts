import { useMemo } from "react";

import { useAppStore } from "@/store/useAppStore";

export type VoiceVisualizerLevel = "idle" | "low" | "medium" | "high";

export function useVAD() {
  const voiceMode = useAppStore((state) => state.voiceMode);
  const vadState = useAppStore((state) => state.voiceVADState);

  const visualizerLevel = useMemo<VoiceVisualizerLevel>(() => {
    if (voiceMode === "speaking") {
      return "high";
    }
    if (voiceMode === "listening" && vadState === "speaking") {
      return "medium";
    }
    if (voiceMode === "listening") {
      return "low";
    }
    return "idle";
  }, [vadState, voiceMode]);

  return {
    vadState,
    isSpeaking: vadState === "speaking",
    isSilent: vadState === "silence",
    visualizerLevel,
  };
}
