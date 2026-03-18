import { createApp } from "./http/app.ts";

export function startServer() {
  const app = createApp();

  const server = Bun.serve({
    port: app.env.port,
    fetch: app.fetch,
  });

  console.log(
    `[${app.env.appName}] escuchando en http://localhost:${server.port} con modelo ${app.env.openRouterModel}`,
  );

  return server;
}
