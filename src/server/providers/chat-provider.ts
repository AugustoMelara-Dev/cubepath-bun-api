import type { ChatMessage } from "../../shared/chat.ts";

export interface ChatStreamParams {
  messages: ChatMessage[];
  model: string;
  systemPrompt?: string;
}

export type ChatStreamEvent =
  | {
      type: "meta";
      data: {
        provider: "openrouter";
        requestedModel: string;
      };
    }
  | {
      type: "token";
      data: {
        text: string;
      };
    }
  | {
      type: "done";
      data: {
        actualModel?: string;
        provider?: string;
        usage?: Record<string, unknown>;
      };
    }
  | {
      type: "error";
      data: {
        message: string;
      };
    };

export interface ChatProvider {
  streamChat(
    params: ChatStreamParams,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent>;
}
