import { extname, join, normalize } from "node:path";

const PUBLIC_DIR = normalize(join(import.meta.dir, "../../../public"));

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolvePublicFile(pathname: string): string {
  const relativePath =
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  return normalize(join(PUBLIC_DIR, relativePath));
}

export async function serveStatic(pathname: string): Promise<Response | null> {
  const filePath = resolvePublicFile(pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }

  return new Response(file, {
    headers: {
      "Content-Type":
        CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
    },
  });
}
