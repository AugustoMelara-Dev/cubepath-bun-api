import type {
  ChatMessage,
  ChatStreamRequest,
  HealthResponse,
} from "../../shared/chat.ts";
import type { AppEnv } from "../config/env.ts";
import { loadEnv } from "../config/env.ts";
import { HttpError } from "./errors.ts";
import { createSseResponse } from "./sse.ts";
import { serveStatic } from "./static.ts";
import type { ChatProvider } from "../providers/chat-provider.ts";
import { OpenRouterChatProvider } from "../providers/openrouter-provider.ts";

interface AppDependencies {
  env: AppEnv;
  provider: ChatProvider;
}

function isValidRole(role: unknown): role is ChatMessage["role"] {
  return role === "system" || role === "user" || role === "assistant";
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) {
    throw new HttpError(400, "Debes enviar un arreglo `messages`.");
  }

  const messages = input
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = "role" in message ? message.role : undefined;
      const content = "content" in message ? message.content : undefined;

      if (!isValidRole(role) || typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        role,
        content: content.trim(),
      } satisfies ChatMessage;
    })
    .filter((message): message is ChatMessage => message !== null);

  if (!messages.length) {
    throw new HttpError(
      400,
      "Debes enviar al menos un mensaje valido en `messages`.",
    );
  }

  return messages;
}

async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "El cuerpo JSON es invalido.");
  }
}

function buildHealthResponse(env: AppEnv): HealthResponse {
  return {
    status: "ok",
    service: env.appName,
    provider: "openrouter",
    defaultModel: env.openRouterModel,
    apiKeyConfigured: Boolean(env.openRouterApiKey),
    timestamp: new Date().toISOString(),
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  console.error(error);

  return Response.json(
    {
      error: "Se produjo un error interno en el servidor.",
    },
    {
      status: 500,
    },
  );
}

async function handleChatStream(
  request: Request,
  env: AppEnv,
  provider: ChatProvider,
): Promise<Response> {
  const body = await parseRequestBody<ChatStreamRequest>(request);
  const messages = sanitizeMessages(body.messages);
  const model = body.model?.trim() || env.openRouterModel;
  const systemPrompt = body.systemPrompt?.trim() || undefined;

  return createSseResponse(async (send) => {
    for await (const event of provider.streamChat(
      {
        messages,
        model,
        systemPrompt,
      },
      request.signal,
    )) {
      send(event.type, event.data);
    }
  });
}

export function createApp(dependencies?: Partial<AppDependencies>) {
  const env = dependencies?.env ?? loadEnv();
  const provider = dependencies?.provider ?? new OpenRouterChatProvider(env);

  return {
    env,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);

      try {
        if (request.method === "GET" && url.pathname === "/health") {
          return Response.json(buildHealthResponse(env));
        }

        if (request.method === "POST" && url.pathname === "/api/chat/stream") {
          return await handleChatStream(request, env, provider);
        }

        if (request.method === "GET") {
          const staticResponse = await serveStatic(url.pathname);
          if (staticResponse) {
            return staticResponse;
          }
        }

        return Response.json(
          {
            error: "Ruta no encontrada.",
          },
          {
            status: 404,
          },
        );
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
