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

export type FactRecord = {
  id: string;
  subject?: string | null;
  predicate?: string | null;
  object?: string | null;
  title?: string | null;
  content?: string | null;
  tags?: string[] | null;
  category: string;
  confidence: number;
  status: string;
  sourceEventId?: string | null;
  factId?: string | null;
  observedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FactRelation = {
  id: string;
  factId?: string;
  relatedFactId?: string;
  sourceFactId?: string;
  targetFactId?: string;
  relationType: string;
  createdAt: string;
};

export type FactGraphResponse = {
  facts: FactRecord[];
  relations: FactRelation[];
};

export type SearchFactsResponse = {
  facts: FactRecord[];
};

export type AnalyticsMetricPoint = {
  timestamp: string;
  value: number;
};

export type AnalyticsSeries = {
  name: string;
  points: AnalyticsMetricPoint[];
  lastValue?: number | null;
};

export type AnalyticsSummary = {
  totalTokensSpent: number;
  totalMessagesProcessed: number;
  messagesProcessed: number;
  totalMissionsCompleted: number;
  totalInitiativesRun: number;
  averageLatencyMs: number;
  latencyP95Ms: number;
  estimatedCostUsd: number;
  factCount: number;
  series: AnalyticsSeries[];
};

export type ConfigSetting = {
  key: string;
  value: string | number | boolean | object | null;
  defaultValue?: string | number | boolean | object | null;
  description?: string | null;
  type: "string" | "number" | "boolean" | "object";
  category: string;
  readOnly?: boolean;
  sensitive?: boolean;
  source?: string;
};

export type ConfigSnapshot = {
  generatedAt: string;
  version: string;
  snapshotVersion: string;
  takenAt: string;
  environment: string;
  settings: ConfigSetting[];
};

export type ServiceLogBundle = {
  service: string | null;
  lines: string[];
  generatedAt: string;
};

export type LogBundle = ServiceLogBundle;

export type ServiceRestartRequest = {
  serviceName: string;
};

export type ServiceRestartResponse = {
  serviceName: string;
  status: string;
  message: string;
  restartedAt: string;
  success: boolean;
};

export type ProviderKeyTest = {
  provider: "openai" | "anthropic" | "google" | "local" | "custom";
  apiKey: string;
  baseUrl?: string | null;
  model?: string | null;
};

export type ProviderKeyTestResult = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

export type PortProbe = {
  port: number;
  busy: boolean;
  latencyMs: number | null;
};

export type PortDetectionResult = {
  requestedPort: number;
  usedPorts: number[];
  freePort: number;
  isFree: boolean;
  probes: PortProbe[];
};

export type SetupWizardState = {
  step: number;
  totalSteps: number;
  identity: {
    ownerName: string;
    agentName: string;
    locale: string;
    photoReferenceDataUrl?: string | null;
  };
  keys: { provider: ProviderKeyTest["provider"]; apiKey: string; baseUrl?: string | null; model?: string | null; valid: boolean | null }[];
  modules: { chat: boolean; missions: boolean; proactive: boolean; memory: boolean; voice: boolean };
  network: { gatewayPort: number; brainPort: number; autoSelect: boolean; detection?: PortDetectionResult | null };
};

export async function listFacts(params?: { query?: string | null; limit?: number | null }): Promise<SearchFactsResponse> {
  const response = await fetch(
    apiURL("/api/v1/memory/facts", {
      query: params?.query ?? undefined,
      limit: params?.limit ?? undefined,
    }),
  );
  if (!response.ok) {
    throw new Error("Impossible de charger les facts memoire.");
  }
  return response.json() as Promise<SearchFactsResponse>;
}

export async function createOrUpdateFact(fact: Omit<FactRecord, "id" | "createdAt" | "updatedAt"> & { id?: string | null }): Promise<FactRecord> {
  const response = await fetch(apiURL("/api/v1/memory/facts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fact),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de creer le fact: ${response.status} ${text}`);
  }
  const wrapper = (await response.json()) as { fact: FactRecord };
  return wrapper.fact;
}

export async function fetchFactGraph(params?: { limit?: number | null }): Promise<FactGraphResponse> {
  const response = await fetch(
    apiURL("/api/v1/memory/graph", { limit: params?.limit ?? undefined }),
  );
  if (!response.ok) {
    throw new Error("Impossible de charger le graphe memoire.");
  }
  return response.json() as Promise<FactGraphResponse>;
}

export async function fetchAnalytics(): Promise<AnalyticsSummary> {
  const response = await fetch(apiURL("/api/v1/analytics"));
  if (!response.ok) {
    throw new Error("Impossible de charger les metriques d'usage.");
  }
  return response.json() as Promise<AnalyticsSummary>;
}

export async function fetchConfigSnapshot(): Promise<ConfigSnapshot> {
  const response = await fetch(apiURL("/api/v1/config"));
  if (!response.ok) {
    throw new Error("Impossible de charger la configuration.");
  }
  return response.json() as Promise<ConfigSnapshot>;
}

export async function fetchServiceLogs(service?: string | null): Promise<ServiceLogBundle> {
  const url = apiURL("/api/v1/system/services/logs", { service: service ?? undefined });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de charger les logs.");
  }
  return response.json() as Promise<ServiceLogBundle>;
}

export async function requestServiceRestart(serviceName: string): Promise<ServiceRestartResponse> {
  const payload: ServiceRestartRequest = { serviceName };
  const response = await fetch(apiURL("/api/v1/system/services/restart"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Redemarrage impossible: ${response.status} ${text}`);
  }
  return response.json() as Promise<ServiceRestartResponse>;
}

export async function validateProviderKey(
  testOrProvider:
    | ProviderKeyTest
    | "openai"
    | "anthropic"
    | "google"
    | "mistral"
    | "deepseek"
    | "ollama",
  maybeApiKey?: string,
): Promise<ProviderKeyTestResult> {
  let test: ProviderKeyTest;
  if (typeof testOrProvider === "string") {
    const provider = testOrProvider;
    if (provider === "ollama") {
      test = { provider: "local", apiKey: "", baseUrl: maybeApiKey ?? "http://localhost:11434" };
    } else if (provider === "mistral") {
      test = {
        provider: "custom",
        apiKey: maybeApiKey ?? "",
        baseUrl: "https://api.mistral.ai",
        model: "mistral-small-latest",
      };
    } else if (provider === "deepseek") {
      test = {
        provider: "custom",
        apiKey: maybeApiKey ?? "",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
      };
    } else {
      test = { provider, apiKey: maybeApiKey ?? "" };
    }
  } else {
    test = testOrProvider;
  }

  const start = performance.now();
  let endpoint: string | null = null;
  let authHeader: string | null = null;
  let testBody: object | null = null;
  if (test.provider === "openai") {
    endpoint = `${test.baseUrl ?? "https://api.openai.com"}/v1/models`;
    authHeader = `Bearer ${test.apiKey}`;
  } else if (test.provider === "anthropic") {
    endpoint = `${test.baseUrl ?? "https://api.anthropic.com"}/v1/messages`;
    authHeader = `Bearer ${test.apiKey}`;
    testBody = {
      model: test.model ?? "claude-3-5-sonnet-20241022",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    };
  } else if (test.provider === "google") {
    endpoint = `${test.baseUrl ?? "https://generativelanguage.googleapis.com"}/v1beta/models?key=${encodeURIComponent(test.apiKey)}`;
  } else if (test.provider === "local") {
    endpoint = `${test.baseUrl ?? "http://localhost:11434"}/api/tags`;
  } else if (test.provider === "custom") {
    endpoint = `${test.baseUrl ?? "https://api.example.com"}/v1/chat/completions`;
    authHeader = `Bearer ${test.apiKey}`;
    testBody = {
      model: test.model ?? "gpt-4o-mini",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    };
  } else {
    const latency = Math.round(performance.now() - start);
    return { ok: false, latencyMs: latency, message: `Fournisseur ${test.provider} non supporte pour validation.` };
  }
  try {
    const init: RequestInit = { method: testBody ? "POST" : "GET" };
    if (authHeader) {
      init.headers = {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
    }
    if (testBody) {
      init.body = JSON.stringify(testBody);
    }
    const response = await fetch(endpoint, init);
    const latency = Math.round(performance.now() - start);
    if (response.ok) {
      const providerLabel =
        typeof testOrProvider === "string" ? testOrProvider : test.provider;
      return { ok: true, latencyMs: latency, message: `Cle valide pour ${providerLabel} (latence ${latency} ms).` };
    }
    const text = await response.text().catch(() => "");
    return { ok: false, latencyMs: latency, message: `Echec validation (${response.status}): ${text.slice(0, 200)}` };
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    return { ok: false, latencyMs: latency, message: `Erreur reseau validation cle: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function detectFreePorts(portsOrStart?: number | number[], probeRange = 10): Promise<PortDetectionResult> {
  const ports: number[] = Array.isArray(portsOrStart)
    ? portsOrStart
    : typeof portsOrStart === "number"
      ? Array.from({ length: probeRange }, (_, i) => (portsOrStart ?? 8080) + i)
      : [8080, 8000, 3000, 11434, 7860];
  const probes: PortProbe[] = await Promise.all(
    ports.map(async (port) => {
      try {
        const started = performance.now();
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 250);
        await fetch(`http://127.0.0.1:${port}/`, {
          method: "HEAD",
          signal: ctrl.signal,
          mode: "no-cors",
        });
        clearTimeout(timeout);
        return { port, busy: true, latencyMs: Math.round(performance.now() - started) };
      } catch {
        return { port, busy: false, latencyMs: null };
      }
    }),
  );
  const usedPorts = probes.filter((p) => p.busy).map((p) => p.port);
  const firstFree = probes.find((p) => !p.busy);
  return {
    requestedPort: ports[0] ?? 8080,
    usedPorts,
    freePort: firstFree ? firstFree.port : ports[0] ?? 8080,
    isFree: !usedPorts.includes(ports[0] ?? 8080),
    probes,
  };
}

export type SkillRuntime = "python" | "wasm";
export type SkillStatus = "installed" | "pending_approval" | "disabled" | "rejected";

export type SkillRecord = {
  id: string;
  name: string;
  version: string;
  description: string;
  runtime: SkillRuntime;
  category: string;
  author: string;
  installedAt: string;
  checksum: string;
  status: SkillStatus;
  sourceCode: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillListResponse = {
  items: SkillRecord[];
  total: number;
};

export type SkillInstallRequest = {
  name: string;
  version?: string;
  description?: string;
  runtime?: SkillRuntime;
  category?: string;
  author?: string;
  sourceCode?: string;
  sourceTarballB64?: string;
  trusted?: boolean;
};

export type SkillUpdateRequest = {
  name?: string;
  version?: string;
  description?: string;
  category?: string;
  sourceCode?: string;
  status?: SkillStatus;
};

export type SkillRunRequest = {
  argsJson?: string;
  timeoutMs?: number;
  fuelLimit?: number;
};

export type SkillRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  fuelUsed?: number | null;
  sandboxKind: string;
  error?: string | null;
};

export type SkillApprovalDecision = {
  by?: string;
  reason?: string;
};

export type SkillGeneratedDraft = {
  name: string;
  description: string;
  runtime: SkillRuntime;
  sourceCode: string;
  category: string;
  suggestedVersion: string;
  version?: string;
  inlineTests: string;
};

export async function listSkills(params?: {
  category?: string;
  runtime?: SkillRuntime;
  status?: SkillStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<SkillListResponse> {
  const response = await fetch(
    apiURL("/api/v1/skills", {
      category: params?.category,
      runtime: params?.runtime,
      status: params?.status,
      search: params?.search,
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
    }),
  );
  if (!response.ok) {
    throw new Error("Impossible de lister les skills.");
  }
  return response.json() as Promise<SkillListResponse>;
}

export async function getSkill(id: string): Promise<SkillRecord> {
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}`),
  );
  if (!response.ok) {
    throw new Error("Skill introuvable.");
  }
  return response.json() as Promise<SkillRecord>;
}

export async function installSkill(
  req: SkillInstallRequest,
): Promise<SkillRecord> {
  const payload: SkillInstallRequest = {
    version: "0.1.0",
    runtime: "python",
    ...req,
  };
  const response = await fetch(apiURL("/api/v1/skills"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible d'installer le skill: ${response.status} ${text}`);
  }
  return response.json() as Promise<SkillRecord>;
}

export async function updateSkill(
  id: string,
  patch: SkillUpdateRequest,
): Promise<SkillRecord> {
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de mettre a jour le skill: ${response.status} ${text}`);
  }
  return response.json() as Promise<SkillRecord>;
}

export async function uninstallSkill(id: string): Promise<void> {
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}`),
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de desinstaller le skill: ${response.status} ${text}`);
  }
}

export async function runSkillInSandbox(
  id: string,
  params?: SkillRunRequest,
): Promise<SkillRunResult> {
  const payload: SkillRunRequest = {
    argsJson: "{}",
    timeoutMs: 30000,
    fuelLimit: 250000,
    ...params,
  };
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}/run`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de lancer le skill dans le sandbox: ${response.status} ${text}`);
  }
  return response.json() as Promise<SkillRunResult>;
}

export async function approveSkill(
  id: string,
  decision?: SkillApprovalDecision,
): Promise<SkillRecord> {
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}/approve`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true, by: decision?.by, reason: decision?.reason ?? "" }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible d'approuver le skill: ${response.status} ${text}`);
  }
  return response.json() as Promise<SkillRecord>;
}

export async function rejectSkill(
  id: string,
  decision?: SkillApprovalDecision | string,
): Promise<SkillRecord> {
  const normalized: SkillApprovalDecision =
    typeof decision === "string" ? { reason: decision } : decision ?? {};
  const reason = normalized.reason ?? "refus utilisateur sans motif detaille";
  const response = await fetch(
    apiURL(`/api/v1/skills/${encodeURIComponent(id)}/reject`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: false, by: normalized.by, reason }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Impossible de rejeter le skill: ${response.status} ${text}`);
  }
  return response.json() as Promise<SkillRecord>;
}

export async function generateSkillDraftFromUsage(req: {
  usage: string;
  preferredRuntime?: SkillRuntime;
}): Promise<SkillGeneratedDraft> {
  const runtime = req.preferredRuntime ?? "python";
  const usage = req.usage;
  try {
    const response = await fetch(apiURL("/api/v1/skills/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usage, preferredRuntime: runtime }),
    });
    if (response.ok) {
      return (await response.json()) as SkillGeneratedDraft;
    }
  } catch {
    /* fall through vers draft minimal local genere en JS pur */
  }
  const fallbackName = (usage || "skill-auto")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "skill-auto";
  const minimal: SkillGeneratedDraft =
    runtime === "wasm"
      ? {
          name: fallbackName,
          description: usage,
          runtime: "wasm",
          sourceCode: `(module
  (func (export "run") (param i32) (result i32)
    local.get 0 i32.const 42 i32.add)
  (memory (export "memory") 1))
`,
          category: "general",
          suggestedVersion: "0.1.0",
          inlineTests: "",
        }
      : {
          name: fallbackName,
          description: usage,
          runtime: "python",
          sourceCode: `"""Skill auto-genere fallback stdlib seulement."""
import json


def main(args: dict) -> dict:
    return {"ok": True, "echo": args, "usage": ${JSON.stringify(usage.slice(0, 120))}}


if __name__ == "__main__":
    import sys
    payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    print(json.dumps(main(payload)))
`,
          category: "general",
          suggestedVersion: "0.1.0",
          inlineTests: `assert main({"ping": 1}).get("ok") is True`,
        };
  return minimal;
}
