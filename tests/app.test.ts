import { describe, expect, it } from "bun:test";

import { createApp } from "../src/server/http/app.ts";
import type { AppEnv } from "../src/server/config/env.ts";
import type { ChatProvider } from "../src/server/providers/chat-provider.ts";

const fakeEnv: AppEnv = {
  port: 3000,
  appName: "CubePath Test",
  appUrl: "http://localhost:3000",
  openRouterApiKey: "test-key",
  openRouterModel: "openrouter/free",
};

const mockProvider: ChatProvider = {
  async *streamChat(params) {
    yield {
      type: "meta",
      data: {
        provider: "openrouter",
        requestedModel: params.model,
      },
    };

    yield {
      type: "token",
      data: {
        text: "Hola",
      },
    };

    yield {
      type: "token",
      data: {
        text: " mundo",
      },
    };

    yield {
      type: "done",
      data: {
        actualModel: params.model,
      },
    };
  },
};

describe("CubePath Bun app", () => {
  const app = createApp({
    env: fakeEnv,
    provider: mockProvider,
  });

  it("responde el health check", async () => {
    const response = await app.fetch(new Request("http://localhost/health"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.defaultModel).toBe("openrouter/free");
    expect(body.apiKeyConfigured).toBe(true);
  });

  it("sirve la interfaz principal", async () => {
    const response = await app.fetch(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("CubePath Lab");
    expect(html).toContain("/health");
  });

  it("entrega eventos SSE al hacer streaming", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "user",
              content: "Di hola",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const payload = response.body ? await new Response(response.body).text() : "";
    expect(payload).toContain("event: meta");
    expect(payload).toContain("event: token");
    expect(payload).toContain('"text":"Hola"');
    expect(payload).toContain("event: done");
  });

  it("valida que haya mensajes", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [],
        }),
      }),
    );

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("al menos un mensaje");
  });
});
