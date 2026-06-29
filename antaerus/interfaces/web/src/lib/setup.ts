export type ProviderName = "anthropic" | "openai" | "mistral" | "ollama";

export type ChatTransportMode = "ws" | "sse-dev";

export type LocalSetupConfig = {
  displayName: string;
  defaultProvider: ProviderName;
  gatewayBaseUrl: string;
  brainBaseUrl: string;
  websocketDevToken: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  mistralApiKey: string;
  chatTransport: ChatTransportMode;
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
  chatTransport: "ws",
};
