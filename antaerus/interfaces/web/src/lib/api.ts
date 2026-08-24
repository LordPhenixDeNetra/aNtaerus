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

export type StepResult = {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  durationMs?: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  outputSummary?: string;
  outputDetail?: string;
  extractedArtifacts?: string[];
  error?: string;
};

export type MissionStep = {
  id: string;
  index: number;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  dependencyIds?: string[];
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  result?: StepResult;
  estimatedDurationMs?: number;
  maxAttempts?: number;
  attempt?: number;
};

export type ReflexionReport = {
  missionId: string;
  reflexion: string;
  summary: string;
  scoreQuality: number;
  scoreConfidence: number;
  issues: string[];
  corrections: string[];
  lessonsLearned: string[];
  generatedAt: string;
};

export type Mission = {
  id: string;
  title: string;
  userRequest: string;
  description?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  autonomyLevel?: "guided" | "semi-autonomous" | "fully-autonomous";
  status:
    | "draft"
    | "planned"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  steps: MissionStep[];
  reflexionReport?: ReflexionReport;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type CreateMissionRequest = {
  sessionId?: string;
  userRequest: string;
  provider?: string;
  model?: string;
  autonomyLevel?: "guided" | "semi-autonomous" | "fully-autonomous";
};

export type ListMissionsResponse = {
  items: Mission[];
  total: number;
};

export type MissionEvent = {
  id: string;
  missionId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type MissionEventsResponse = {
  items: MissionEvent[];
};

function apiURL(path: string, query?: Record<string, string | number | undefined>): string {
  let url = path;
  if (query) {
    const entries = Object.entries(query).filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    );
    if (entries.length > 0) {
      const params = new URLSearchParams(
        entries.map(([k, v]) => [k, String(v)]),
      );
      url = `${url}?${params.toString()}`;
    }
  }
  return url;
}

export async function createMission(
  request: CreateMissionRequest,
): Promise<Mission> {
  const response = await fetch(apiURL("/api/v1/missions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de creer la mission: ${response.status} ${text}`);
  }
  return response.json() as Promise<Mission>;
}

export async function listMissions(params?: {
  sessionId?: string;
  status?: Mission["status"];
  limit?: number;
}): Promise<ListMissionsResponse> {
  const response = await fetch(
    apiURL("/api/v1/missions", {
      sessionId: params?.sessionId,
      status: params?.status,
      limit: params?.limit,
    }),
  );
  if (!response.ok) {
    throw new Error("Impossible de lister les missions.");
  }
  return response.json() as Promise<ListMissionsResponse>;
}

export async function getMission(id: string): Promise<Mission> {
  const response = await fetch(apiURL(`/api/v1/missions/${encodeURIComponent(id)}`));
  if (!response.ok) {
    throw new Error("Mission introuvable.");
  }
  return response.json() as Promise<Mission>;
}

export async function runMission(
  id: string,
  params?: { provider?: string; model?: string },
): Promise<Mission> {
  const response = await fetch(
    apiURL(`/api/v1/missions/${encodeURIComponent(id)}/run`, {
      provider: params?.provider,
      model: params?.model,
    }),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de demarrer la mission: ${response.status} ${text}`);
  }
  return response.json() as Promise<Mission>;
}

export async function recoverMission(id: string): Promise<Mission> {
  const response = await fetch(
    apiURL(`/api/v1/missions/${encodeURIComponent(id)}/recover`),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de recuperer la mission: ${response.status} ${text}`);
  }
  return response.json() as Promise<Mission>;
}

export async function reflectMission(
  id: string,
  params?: { provider?: string; model?: string },
): Promise<ReflexionReport> {
  const response = await fetch(
    apiURL(`/api/v1/missions/${encodeURIComponent(id)}/reflect`, {
      provider: params?.provider,
      model: params?.model,
    }),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de refleter la mission: ${response.status} ${text}`);
  }
  return response.json() as Promise<ReflexionReport>;
}

export async function listMissionEvents(id: string): Promise<MissionEventsResponse> {
  const response = await fetch(
    apiURL(`/api/v1/missions/${encodeURIComponent(id)}/events`),
  );
  if (!response.ok) {
    throw new Error("Impossible de charger les evenements de mission.");
  }
  return response.json() as Promise<MissionEventsResponse>;
}
