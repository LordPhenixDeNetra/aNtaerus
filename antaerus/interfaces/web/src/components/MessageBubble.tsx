import type { ChatMessage } from "@/lib/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
            strong: ({ children }) => (
              <strong className="font-semibold text-white">{children}</strong>
            ),
            em: ({ children }) => <em className="italic">{children}</em>,
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-cyan-400/60 underline-offset-4 hover:text-cyan-100"
              >
                {children}
              </a>
            ),
            ul: ({ children }) => (
              <ul className="mb-3 list-disc space-y-1 pl-6 last:mb-0">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 list-decimal space-y-1 pl-6 last:mb-0">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-6">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="mb-3 border-l-2 border-white/10 pl-4 text-slate-200 last:mb-0">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="rounded-lg border border-white/10 bg-slate-950/40 px-1.5 py-0.5 font-mono text-xs text-slate-200">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="mb-3 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40 p-3 font-mono text-xs text-slate-200 last:mb-0">
                {children}
              </pre>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
