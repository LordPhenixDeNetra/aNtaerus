import {
  DEFAULT_SETUP_CONFIG,
  type LocalSetupConfig,
} from "@/lib/setup";

const SETUP_STORAGE_KEY = "antaerus.setup";
const SESSION_STORAGE_KEY = "antaerus.session";

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSetupConfig(): LocalSetupConfig {
  if (!hasLocalStorage()) {
    return DEFAULT_SETUP_CONFIG;
  }

  const raw = window.localStorage.getItem(SETUP_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETUP_CONFIG;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalSetupConfig>;
    return { ...DEFAULT_SETUP_CONFIG, ...parsed };
  } catch {
    return DEFAULT_SETUP_CONFIG;
  }
}

export function saveSetupConfig(config: LocalSetupConfig): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(config));
}

export function loadSessionId(): string | null {
  if (!hasLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function saveSessionId(sessionId: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

export function createSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}`;
}
