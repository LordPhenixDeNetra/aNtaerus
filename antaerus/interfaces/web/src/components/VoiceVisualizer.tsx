import type { VoiceVisualizerLevel } from "@/hooks/useVAD";

type VoiceVisualizerProps = {
  level: VoiceVisualizerLevel;
};

const levelHeights: Record<VoiceVisualizerLevel, number[]> = {
  idle: [16, 22, 18, 24, 18, 16],
  low: [24, 34, 28, 38, 28, 24],
  medium: [36, 52, 40, 58, 40, 36],
  high: [54, 74, 62, 84, 62, 54],
};

export default function VoiceVisualizer({ level }: VoiceVisualizerProps) {
  return (
    <div
      className="flex h-24 items-end justify-between gap-2 rounded-[28px] border border-white/10 bg-white/5 px-4 py-3"
      data-level={level}
      aria-hidden="true"
    >
      {levelHeights[level].map((height, index) => (
        <span
          // Fixed inline heights keep the animation deterministic in tests.
          key={`${level}-${index}`}
          className="w-full rounded-full bg-gradient-to-t from-cyan-400/40 via-cyan-300/70 to-white/80 transition-all duration-300"
          style={{ height }}
        />
      ))}
    </div>
  );
}
