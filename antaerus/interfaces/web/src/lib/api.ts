export type ServiceHealth = {
  name: string;
  status: "healthy" | "degraded" | "offline";
  version: string;
  port: number;
  url: string;
  checkedAt: string;
  details?: string;
};

export type ServiceCapabilities = {
  name: string;
  version: string;
  runtime: "web" | "go" | "python" | "rust";
  capabilities: string[];
};

export type SystemStatus = {
  product: "aNtaerus";
  phase: "foundation";
  environment: string;
  services: ServiceHealth[];
  capabilities: ServiceCapabilities[];
};

export type BrainProvider = {
  name: string;
  model: string;
};

export type BrainProvidersResponse = {
  defaultProvider: string;
  providers: BrainProvider[];
};

export type DevTokenResponse = {
  token: string;
};

export type ChatHistoryMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string;
  createdAt: string;
};

export type ChatHistoryResponse = {
  sessionId: string;
  messages: ChatHistoryMessage[];
};

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch("/api/v1/system/status");

  if (!response.ok) {
    throw new Error("Impossible de charger l'état système.");
  }

  return response.json() as Promise<SystemStatus>;
}

export async function fetchBrainProviders(
  brainBaseUrl: string,
): Promise<BrainProvidersResponse> {
  const response = await fetch(new URL("/llm/providers", brainBaseUrl));

  if (!response.ok) {
    throw new Error("Impossible de charger les providers du brain.");
  }

  return response.json() as Promise<BrainProvidersResponse>;
}

export async function fetchDevToken(
  gatewayBaseUrl: string,
  subject: string,
): Promise<DevTokenResponse> {
  const response = await fetch(new URL("/api/v1/auth/dev-token", gatewayBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject,
      role: "user",
    }),
  });

  if (!response.ok) {
    throw new Error("Impossible de générer un JWT de développement.");
  }

  return response.json() as Promise<DevTokenResponse>;
}

export async function fetchChatSessionHistory(
  gatewayBaseUrl: string,
  sessionId: string,
): Promise<ChatHistoryResponse> {
  const response = await fetch(
    new URL(`/api/v1/chat/sessions/${sessionId}`, gatewayBaseUrl),
  );

  if (!response.ok) {
    throw new Error("Impossible de charger l'historique de session.");
  }

  return response.json() as Promise<ChatHistoryResponse>;
}
