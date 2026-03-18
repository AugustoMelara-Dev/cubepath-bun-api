import { DEFAULT_OPENROUTER_MODEL } from "../../shared/chat.ts";

export interface AppEnv {
  port: number;
  appName: string;
  appUrl?: string;
  openRouterApiKey?: string;
  openRouterModel: string;
}

function parsePort(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? "3000", 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 3000;
  }

  return parsed;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    port: parsePort(source.PORT),
    appName: source.APP_NAME?.trim() || "CubePath Bun OpenRouter",
    appUrl: source.APP_URL?.trim() || undefined,
    openRouterApiKey: source.OPENROUTER_API_KEY?.trim() || undefined,
    openRouterModel:
      source.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
  };
}
