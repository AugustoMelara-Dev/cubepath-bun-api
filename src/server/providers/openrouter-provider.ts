import { DEFAULT_SYSTEM_PROMPT } from "../../shared/chat.ts";
import type { AppEnv } from "../config/env.ts";
import { HttpError } from "../http/errors.ts";
import { parseSseStream } from "../http/sse.ts";
import type {
  ChatProvider,
  ChatStreamEvent,
  ChatStreamParams,
} from "./chat-provider.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterErrorPayload {
  error?: {
    message?: string;
  };
}

interface OpenRouterChunk {
  model?: string;
  provider?: string;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
  };
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string;
    };
  }>;
}

function buildMessages(params: ChatStreamParams) {
  const messages = params.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const systemPrompt = params.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    ...messages,
  ];
}

async function extractOpenRouterError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as OpenRouterErrorPayload;
    return payload.error?.message || `OpenRouter respondio con HTTP ${response.status}.`;
  } catch {
    return `OpenRouter respondio con HTTP ${response.status}.`;
  }
}

export class OpenRouterChatProvider implements ChatProvider {
  constructor(private readonly env: AppEnv) {}

  async *streamChat(
    params: ChatStreamParams,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    if (!this.env.openRouterApiKey) {
      throw new HttpError(
        500,
        "Falta OPENROUTER_API_KEY. Configurala para usar el stream real.",
      );
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.env.openRouterApiKey}`,
        "Content-Type": "application/json",
        ...(this.env.appUrl ? { "HTTP-Referer": this.env.appUrl } : {}),
        "X-Title": this.env.appName,
      },
      body: JSON.stringify({
        model: params.model,
        stream: true,
        messages: buildMessages(params),
      }),
    });

    if (!response.ok) {
      throw new HttpError(
        response.status,
        await extractOpenRouterError(response),
      );
    }

    if (!response.body) {
      throw new HttpError(
        502,
        "OpenRouter no devolvio un cuerpo de streaming utilizable.",
      );
    }

    yield {
      type: "meta",
      data: {
        provider: "openrouter",
        requestedModel: params.model,
      },
    };

    let actualModel: string | undefined;
    let providerName: string | undefined;
    let usage: Record<string, unknown> | undefined;

    for await (const event of parseSseStream(response.body)) {
      if (!event.data) {
        continue;
      }

      if (event.data === "[DONE]") {
        break;
      }

      let chunk: OpenRouterChunk;

      try {
        chunk = JSON.parse(event.data) as OpenRouterChunk;
      } catch {
        continue;
      }

      actualModel ||= chunk.model;
      providerName ||= chunk.provider;
      usage = chunk.usage ?? usage;

      if (chunk.error?.message) {
        yield {
          type: "error",
          data: {
            message: chunk.error.message,
          },
        };
        return;
      }

      const token = chunk.choices?.[0]?.delta?.content;
      if (token) {
        yield {
          type: "token",
          data: {
            text: token,
          },
        };
      }

      if (chunk.choices?.[0]?.finish_reason === "error") {
        yield {
          type: "error",
          data: {
            message: "El proveedor termino el streaming con error.",
          },
        };
        return;
      }
    }

    yield {
      type: "done",
      data: {
        actualModel,
        provider: providerName,
        usage,
      },
    };
  }
}
