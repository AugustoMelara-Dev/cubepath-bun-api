const encoder = new TextEncoder();

export interface ParsedSseMessage {
  event?: string;
  data?: string;
}

function parseSseBlock(block: string): ParsedSseMessage | null {
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!eventName && !dataLines.length) {
    return null;
  }

  return {
    event: eventName,
    data: dataLines.join("\n"),
  };
}

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedSseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (parsed) {
        yield parsed;
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed) {
      yield parsed;
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createSseResponse(
  producer: (send: (event: string, payload: unknown) => void) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const send = (event: string, payload: unknown) => {
        if (closed) {
          return;
        }

        const serialized =
          typeof payload === "string" ? payload : JSON.stringify(payload);

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${serialized}\n\n`),
        );
      };

      try {
        await producer(send);
      } catch (error) {
        if (!isAbortError(error)) {
          send("error", {
            message:
              error instanceof Error ? error.message : "Streaming interrumpido.",
          });
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
