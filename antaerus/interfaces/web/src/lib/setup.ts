export type ProviderName = "anthropic" | "openai" | "mistral" | "deepseek" | "ollama" | "google";

export type ChatTransportMode = "ws" | "sse-dev";

export type SetupEnabledModules = {
  voice: boolean;
  proactive: boolean;
  memory: boolean;
  computerUse: boolean;
};

export type SetupPortSuggestion = {
  port: number;
  label: string;
  busy: boolean;
  latencyMs: number | null;
};

export type WizardState = {
  step: 0 | 1 | 2 | 3 | 4;
  referencePhotoDataUrl: string | null;
  validatedProviders: Partial<Record<ProviderName, boolean>>;
  validatedProvidersMessage: Partial<Record<ProviderName, string>>;
  modules: SetupEnabledModules;
  portProbes: SetupPortSuggestion[];
};

export type LocalSetupConfig = {
  displayName: string;
  defaultProvider: ProviderName;
  gatewayBaseUrl: string;
  brainBaseUrl: string;
  websocketDevToken: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  mistralApiKey: string;
  deepseekApiKey: string;
  googleApiKey: string;
  chatTransport: ChatTransportMode;
  referencePhotoDataUrl: string | null;
  wizard: WizardState;
  modules: SetupEnabledModules;
  language: "fr" | "en";
};

export const DEFAULT_SETUP_CONFIG: LocalSetupConfig = {
  displayName: "",
  defaultProvider: "ollama",
  gatewayBaseUrl: "http://localhost:8080",
  brainBaseUrl: "http://localhost:8000",
  websocketDevToken: "",
  anthropicApiKey: "",
  openaiApiKey: "",
  mistralApiKey: "",
  deepseekApiKey: "",
  googleApiKey: "",
  chatTransport: "ws",
  referencePhotoDataUrl: null,
  wizard: {
    step: 0,
    referencePhotoDataUrl: null,
    validatedProviders: {},
    validatedProvidersMessage: {},
    modules: { voice: true, proactive: true, memory: true, computerUse: false },
    portProbes: [],
  },
  modules: { voice: true, proactive: true, memory: true, computerUse: false },
  language: "fr",
};
