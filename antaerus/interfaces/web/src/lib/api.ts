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

export type CollectorInfo = {
  name: string;
  enabled: boolean;
  lastRanAt: string | null;
  lastStatus: "idle" | "success" | "error" | null;
  lastError: string | null;
};

export type CollectorAlert = {
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  source?: string;
  severity: number;
  createdAt: string;
};

export type CollectorBriefing = {
  title: string;
  summary: string;
  source: string;
  facts: Record<string, unknown>;
  generatedAt: string;
};

export type CollectorRunResult = {
  collectorName: string;
  status: "success" | "error";
  ranAt: string;
  durationMs: number;
  alerts: CollectorAlert[];
  briefing: CollectorBriefing | null;
  error: string | null;
};

export type Initiative = {
  id: string;
  title: string;
  description: string | null;
  collectorSource: string | null;
  triggerType:
    | "manual"
    | "schedule"
    | "alert"
    | "event"
    | "curator"
    | "custom";
  triggerConfig: Record<string, unknown>;
  status:
    | "pending"
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "approved"
    | "rejected";
  autonomyLevel: number;
  budgetTokens: number;
  budgetTokensUsed: number;
  alertPayload: Record<string, unknown> | null;
  ranAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateInitiativeRequest = {
  title: string;
  description?: string;
  collectorSource?: string;
  triggerType?: Initiative["triggerType"];
  triggerConfig?: Record<string, unknown>;
  autonomyLevel?: number;
  budgetTokens?: number;
  alertPayload?: Record<string, unknown>;
};

export type PatchInitiativeRequest = {
  status?: Initiative["status"];
  autonomyLevel?: number;
  budgetTokens?: number;
  title?: string;
  description?: string | null;
};

export type ListInitiativesResponse = {
  items: Initiative[];
  total: number;
};

export type CuratorReport = {
  id: string;
  generatedAt: string;
  factsCount: number;
  patchesCount: number;
  summary: string;
  notes: string[];
};

export type CuratorPatch = {
  id: string;
  reportId: string;
  targetType: string;
  targetRef: string;
  title: string;
  rationale: string;
  decision: "proposed" | "approved" | "rejected" | "applied";
  requiresHuman: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type ListCuratorPatchesResponse = {
  items: CuratorPatch[];
  total: number;
};

export async function listCollectors(): Promise<CollectorInfo[]> {
  const response = await fetch(apiURL("/api/v1/proactive/collectors"));
  if (!response.ok) {
    throw new Error("Impossible de lister les collecteurs.");
  }
  return response.json() as Promise<CollectorInfo[]>;
}

export async function runCollector(name: string): Promise<CollectorRunResult> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/collectors/${encodeURIComponent(name)}/run`),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de lancer collecteur: ${response.status} ${text}`);
  }
  return response.json() as Promise<CollectorRunResult>;
}

export async function runAllCollectors(): Promise<{
  completed: number;
  results: Record<string, CollectorRunResult>;
  generatedAt: string;
}> {
  const response = await fetch(apiURL("/api/v1/proactive/collectors/run-all"), {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de lancer les collecteurs: ${response.status} ${text}`);
  }
  return response.json() as Promise<{
    completed: number;
    results: Record<string, CollectorRunResult>;
    generatedAt: string;
  }>;
}

export async function listInitiatives(params?: {
  status?: Initiative["status"];
  triggerType?: Initiative["triggerType"];
  limit?: number;
}): Promise<ListInitiativesResponse> {
  const response = await fetch(
    apiURL("/api/v1/proactive/initiatives", {
      status: params?.status,
      trigger_type: params?.triggerType,
      limit: params?.limit,
    }),
  );
  if (!response.ok) {
    throw new Error("Impossible de lister les initiatives.");
  }
  return response.json() as Promise<ListInitiativesResponse>;
}

export async function createInitiative(
  req: CreateInitiativeRequest,
): Promise<Initiative> {
  const response = await fetch(apiURL("/api/v1/proactive/initiatives"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de creer initiative: ${response.status} ${text}`);
  }
  return response.json() as Promise<Initiative>;
}

export async function getInitiative(id: string): Promise<Initiative> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/initiatives/${encodeURIComponent(id)}`),
  );
  if (!response.ok) {
    throw new Error("Initiative introuvable.");
  }
  return response.json() as Promise<Initiative>;
}

export async function patchInitiative(
  id: string,
  patch: PatchInitiativeRequest,
): Promise<Initiative> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/initiatives/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de mettre a jour initiative: ${response.status} ${text}`);
  }
  return response.json() as Promise<Initiative>;
}

export async function runInitiative(id: string): Promise<Initiative> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/initiatives/${encodeURIComponent(id)}/run`),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de lancer initiative: ${response.status} ${text}`);
  }
  return response.json() as Promise<Initiative>;
}

export async function getLastCuratorReport(): Promise<CuratorReport | null> {
  const response = await fetch(apiURL("/api/v1/proactive/curator/report"));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("Impossible de charger le rapport curator.");
  }
  return response.json() as Promise<CuratorReport>;
}

export async function runCurator(): Promise<CuratorReport> {
  const response = await fetch(apiURL("/api/v1/proactive/curator/run"), {
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de lancer le curator: ${response.status} ${text}`);
  }
  return response.json() as Promise<CuratorReport>;
}

export async function listCuratorPatches(params?: {
  reportId?: string;
  decision?: CuratorPatch["decision"];
  limit?: number;
}): Promise<ListCuratorPatchesResponse> {
  const response = await fetch(
    apiURL("/api/v1/proactive/curator/patches", {
      report_id: params?.reportId,
      decision: params?.decision,
      limit: params?.limit,
    }),
  );
  if (!response.ok) {
    throw new Error("Impossible de lister les patches curator.");
  }
  return response.json() as Promise<ListCuratorPatchesResponse>;
}

export async function approveCuratorPatch(patchId: string): Promise<CuratorPatch> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/curator/patches/${encodeURIComponent(patchId)}/approve`),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible d'approuver le patch: ${response.status} ${text}`);
  }
  return response.json() as Promise<CuratorPatch>;
}

export async function rejectCuratorPatch(patchId: string): Promise<CuratorPatch> {
  const response = await fetch(
    apiURL(`/api/v1/proactive/curator/patches/${encodeURIComponent(patchId)}/reject`),
    { method: "POST" },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de rejeter le patch: ${response.status} ${text}`);
  }
  return response.json() as Promise<CuratorPatch>;
}

export type SchedulerStatus = {
  running: boolean;
  cronHour: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const response = await fetch(apiURL("/api/v1/proactive/scheduler/status"));
  if (!response.ok) {
    throw new Error("Impossible de charger le statut du scheduler.");
  }
  return response.json() as Promise<SchedulerStatus>;
}

export async function startScheduler(): Promise<SchedulerStatus> {
  const response = await fetch(apiURL("/api/v1/proactive/scheduler/start"), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Impossible de demarrer le scheduler.");
  }
  return response.json() as Promise<SchedulerStatus>;
}

export async function stopScheduler(): Promise<SchedulerStatus> {
  const response = await fetch(apiURL("/api/v1/proactive/scheduler/stop"), {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Impossible d'arreter le scheduler.");
  }
  return response.json() as Promise<SchedulerStatus>;
}
