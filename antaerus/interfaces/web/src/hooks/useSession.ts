import { useEffect } from "react";

import { createSessionId, loadSessionId, saveSessionId } from "@/lib/storage";
import { useAppStore } from "@/store/useAppStore";

export function useSession() {
  const sessionId = useAppStore((state) => state.sessionId);
  const setSessionId = useAppStore((state) => state.setSessionId);

  useEffect(() => {
    if (sessionId) {
      return;
    }

    const storedSessionId = loadSessionId();
    const nextSessionId = storedSessionId ?? createSessionId();
    saveSessionId(nextSessionId);
    setSessionId(nextSessionId);
  }, [sessionId, setSessionId]);

  const resetSession = () => {
    const nextSessionId = createSessionId();
    saveSessionId(nextSessionId);
    setSessionId(nextSessionId);
  };

  return {
    sessionId: sessionId ?? "",
    resetSession,
  };
}
