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

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch("/api/v1/system/status");

  if (!response.ok) {
    throw new Error("Impossible de charger l'état système.");
  }

  return response.json() as Promise<SystemStatus>;
}
