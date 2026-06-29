import type { ChatMessage } from "@/lib/chat";

type MessageBubbleProps = {
  message: ChatMessage;
};

const bubbleStyles: Record<ChatMessage["role"], string> = {
  user: "ml-auto border-cyan-400/30 bg-cyan-500/10 text-cyan-50",
  assistant: "mr-auto border-white/10 bg-white/5 text-slate-100",
  system: "mx-auto border-amber-400/30 bg-amber-500/10 text-amber-50",
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <article
      className={`max-w-3xl rounded-3xl border px-4 py-3 shadow-xl shadow-slate-950/20 ${bubbleStyles[message.role]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
          {message.role}
        </p>
        <p className="text-xs text-slate-400">
          {message.status === "streaming" ? "En cours..." : message.transport}
        </p>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.content}</p>
    </article>
  );
}
