import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type ApiKeyInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export default function ApiKeyInput({
  id,
  label,
  value,
  placeholder,
  onChange,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="rounded-full border border-white/10 bg-slate-950/50 p-2 text-slate-300 transition hover:text-white"
          aria-label={visible ? "Masquer la clé" : "Afficher la clé"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
