import { useEffect } from "react";
import { FileCode } from "lucide-react";
import ConfigForm from "@/components/ConfigForm";
import { useAppStore } from "@/store/useAppStore";
import { fetchConfigSnapshot } from "@/lib/api";

export default function Config() {
  const {
    configSnapshot,
    configSnapshotLoading,
    setConfigSnapshot,
    setConfigSnapshotLoading,
  } = useAppStore();

  async function refresh() {
    try {
      setConfigSnapshotLoading(true);
      const snap = await fetchConfigSnapshot();
      setConfigSnapshot(snap);
    } finally {
      setConfigSnapshotLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">
                M6.1 · Configuration
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Inventaire runtime
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Snapshot immuable de la configuration des services Gateway Go,
                Brain Python et variables locales frontend. Cles sensibles
                masquees, lecture seule.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200">
              <FileCode className="h-6 w-6" />
            </div>
          </div>
        </header>

        <ConfigForm
          snapshot={configSnapshot}
          loading={configSnapshotLoading}
          onRefresh={() => void refresh()}
        />
      </div>
    </main>
  );
}
