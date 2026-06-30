import { AudioLines, Mic, PauseCircle, Square } from "lucide-react";

import type { VoiceMode } from "@/store/useAppStore";

type VoiceButtonProps = {
  mode: VoiceMode;
  statusLabel: string;
  disabled?: boolean;
  canBargeIn?: boolean;
  onPrimaryAction: () => Promise<boolean> | boolean | Promise<void> | void;
  onBargeIn?: () => Promise<boolean> | boolean | Promise<void> | void;
};

const primaryStyles: Record<VoiceMode, string> = {
  idle: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20",
  listening:
    "border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20",
  speaking:
    "border-violet-400/40 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20",
};

const primaryLabels: Record<VoiceMode, string> = {
  idle: "Démarrer la voix",
  listening: "Arrêter la voix",
  speaking: "Arrêter la voix",
};

const primaryIcons = {
  idle: Mic,
  listening: Square,
  speaking: AudioLines,
} satisfies Record<VoiceMode, typeof Mic>;

export default function VoiceButton({
  mode,
  statusLabel,
  disabled = false,
  canBargeIn = false,
  onPrimaryAction,
  onBargeIn,
}: VoiceButtonProps) {
  const Icon = primaryIcons[mode];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onPrimaryAction()}
        disabled={disabled}
        aria-pressed={mode !== "idle"}
        aria-label={primaryLabels[mode]}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500 ${primaryStyles[mode]}`}
      >
        <Icon className="h-4 w-4" />
        {primaryLabels[mode]}
      </button>

      {canBargeIn && onBargeIn && (
        <button
          type="button"
          onClick={() => void onBargeIn()}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          aria-label="Interrompre la réponse vocale"
        >
          <PauseCircle className="h-4 w-4" />
          Interrompre
        </button>
      )}

      <span className="text-xs text-slate-400">{statusLabel}</span>
    </div>
  );
}
