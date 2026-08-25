import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type ApiKeyInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onValidate?: () => void;
  validateLabel?: string;
  status?: "success" | "error";
  statusMessage?: string;
};

export default function ApiKeyInput({
  id,
  label,
  value,
  placeholder,
  onChange,
  onValidate,
  validateLabel = "Valider",
  status,
  statusMessage,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <label className="block" htmlFor={id}>
        <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        {typeof onValidate === "function" ? (
          <button
            type="button"
            onClick={onValidate}
            className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
          >
            {validateLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="rounded-full border border-white/10 bg-slate-950/50 p-2 text-slate-300 transition hover:text-white"
          aria-label={visible ? "Masquer la cle" : "Afficher la cle"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {status || statusMessage ? (
        <p
          className={`mt-3 text-xs ${
            status === "success"
              ? "text-emerald-300"
              : status === "error"
                ? "text-rose-300"
                : "text-slate-400"
          }`}
        >
          {statusMessage || (status === "success" ? "Cle valide." : "Cle invalide.")}
        </p>
      ) : null}
    </div>
  );
}
