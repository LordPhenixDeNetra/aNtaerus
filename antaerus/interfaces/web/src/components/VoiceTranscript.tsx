import type { VoiceMode, VoiceVADState } from "@/store/useAppStore";

type VoiceTranscriptProps = {
  mode: VoiceMode;
  transcript: string;
  vadState: VoiceVADState;
  statusLabel: string;
};

function buildPlaceholder(mode: VoiceMode, vadState: VoiceVADState) {
  if (mode === "speaking") {
    return "Réponse en cours...";
  }
  if (mode === "listening" && vadState === "speaking") {
    return "Parole détectée...";
  }
  if (mode === "listening") {
    return "Écoute en attente...";
  }
  return "La transcription temps réel apparaîtra ici.";
}

export default function VoiceTranscript({
  mode,
  transcript,
  vadState,
  statusLabel,
}: VoiceTranscriptProps) {
  const content = transcript.trim() || buildPlaceholder(mode, vadState);

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">
        Transcript voix
      </p>
      <p aria-live="polite" className="mt-2 text-sm leading-7 text-slate-200">
        {content}
      </p>
      <p className="mt-2 text-xs text-slate-400">{statusLabel}</p>
    </div>
  );
}
