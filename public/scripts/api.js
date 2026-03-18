import { consumeSseStream } from "./sse.js";

async function extractError(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await response.json();
    return body.error ?? `Error HTTP ${response.status}`;
  }

  const rawText = await response.text();
  return rawText || `Error HTTP ${response.status}`;
}

export async function fetchHealth() {
  const response = await fetch("/health");

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  return response.json();
}

export async function streamChat(payload, handlers) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  if (!response.body) {
    throw new Error("El navegador no recibio un cuerpo de streaming.");
  }

  await consumeSseStream(response.body, (event) => {
    switch (event.event) {
      case "meta":
        handlers.onMeta?.(event.data);
        break;
      case "token":
        handlers.onToken?.(event.data);
        break;
      case "done":
        handlers.onDone?.(event.data);
        break;
      case "error":
        throw new Error(event.data?.message ?? "Se interrumpio el streaming.");
      default:
        break;
    }
  });
}
