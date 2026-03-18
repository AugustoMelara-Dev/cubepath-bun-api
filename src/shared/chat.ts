export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatStreamRequest {
  messages: ChatMessage[];
  model?: string;
  systemPrompt?: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  provider: "openrouter";
  defaultModel: string;
  apiKeyConfigured: boolean;
  timestamp: string;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Answer clearly and in the user's language whenever possible.";

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
