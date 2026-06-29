import { useState } from "react";

type MessageInputProps = {
  disabled?: boolean;
  onSend: (message: string) => Promise<void> | void;
};

export default function MessageInput({
  disabled = false,
  onSend,
}: MessageInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }

    await onSend(trimmed);
    setValue("");
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-3 backdrop-blur">
      <label className="sr-only" htmlFor="chat-message-input">
        Message
      </label>
      <textarea
        id="chat-message-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        disabled={disabled}
        placeholder="Décrivez votre demande pour aNtaerus..."
        className="min-h-28 w-full resize-none rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne.
        </p>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
