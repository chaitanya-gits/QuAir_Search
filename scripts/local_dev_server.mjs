import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const FRONTEND_DIR = path.join(REPO_ROOT, "frontend");

const API_PROXY_ORIGIN = (process.env.API_PROXY_ORIGIN || "").replace(/\/+$/, "");

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

async function proxyToBackend(request, response, requestUrl) {
  if (!API_PROXY_ORIGIN) {
    sendJson(response, 503, { detail: "API proxy is not configured (set API_PROXY_ORIGIN)." });
    return;
  }

  const target = new URL(requestUrl.pathname + requestUrl.search, API_PROXY_ORIGIN);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    if (key.toLowerCase() === "host") continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  const method = request.method || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : request;

  const upstream = await fetch(target, { method, headers, body, redirect: "manual" });

  const passthroughHeaders = {};
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "transfer-encoding") return;
    passthroughHeaders[key] = value;
  });

  response.writeHead(upstream.status, passthroughHeaders);
  if (upstream.body) {
    upstream.body.pipe(response);
  } else {
    response.end();
  }
}

async function readRequestJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function buildStaticVersion() {
  const files = [
    path.join(FRONTEND_DIR, "index.html"),
    path.join(FRONTEND_DIR, "assets", "app.js"),
    path.join(FRONTEND_DIR, "assets", "styles.css"),
  ];
  const versions = await Promise.all(files.map(async (filePath) => (await stat(filePath)).mtimeMs));
  return String(Math.max(...versions));
}

async function handleApiRequest(request, response, requestUrl) {
  // Allow real OAuth/login flows in local mode by proxying auth routes to the backend.
  if (requestUrl.pathname.startsWith("/api/auth/")) {
    await proxyToBackend(request, response, requestUrl);
    return;
  }

  if (requestUrl.pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      services: {
        static_frontend: true,
        mock_api: true,
        docker: false,
      },
    });
    return;
  }

  if (requestUrl.pathname === "/api/dev/version") {
    sendJson(response, 200, { version: await buildStaticVersion() });
    return;
  }

  if (requestUrl.pathname === "/api/search") {
    const query = requestUrl.searchParams.get("q")?.trim() ?? "";
    if (!query) {
      sendJson(response, 400, {
        detail: {
          query: "",
          search_queries: [],
          sources: [],
          final_answer: "insufficient data",
        },
      });
      return;
    }

    sendJson(response, 200, {
      query,
      search_queries: [query],
      sources: [
        {
          title: "QuantumSEO local test result",
          url: "https://local.test/quantum-seo",
          summary: "Mocked semantic and quantum search result for frontend development.",
          score: 1.12,
          semantic_score: 0.82,
          pagerank_score: 0.45,
          quantum_score: 0.1,
          sources: ["semantic", "bm25"],
        },
      ],
      final_answer:
        "Local no-Docker test server is running. Search services are mocked in this mode.",
      search_modes: ["bm25", "semantic", "quantum-sim"],
      quantum: {
        algorithm: "grover",
        corpus_size: 256,
        candidate_count: 8,
        classical_steps: 256,
        simulated_quantum_steps: 6,
        estimated_speedup: 42.67,
        success_probability: 0.177,
      },
      analytics: {
        result_count: 1,
        semantic_hits: 1,
        average_pagerank: 0.45,
        source_mix: { semantic: 1, bm25: 1 },
        filters_active: 0,
      },
      empty_state: "",
      fallback_mode: "",
      index_status: {
        mode: "local-test",
        postgres_documents: 0,
        redis_connected: false,
        opensearch_connected: false,
      },
    });
    return;
  }

  if (requestUrl.pathname === "/api/suggest") {
    const query = requestUrl.searchParams.get("q")?.trim() ?? "";
    sendJson(response, 200, {
      query,
      suggestions: query ? [query, `${query} semantic`, `${query} grover`] : [],
      trending: ["quantum seo", "semantic search", "pagerank dashboard"],
    });
    return;
  }

  if (requestUrl.pathname === "/api/trending") {
    sendJson(response, 200, { topics: ["local search", "quantum seo", "frontend smoke test"] });
    return;
  }

  if (requestUrl.pathname === "/api/location/reverse") {
    sendJson(response, 200, {
      lat: Number(requestUrl.searchParams.get("lat") ?? 0),
      lng: Number(requestUrl.searchParams.get("lng") ?? 0),
      results: [],
    });
    return;
  }

  if (requestUrl.pathname === "/api/translate") {
    const payload = await readRequestJson(request);
    const text = payload.text ?? payload.query ?? "";
    sendJson(response, 200, { translatedText: text, sourceLanguage: "auto", targetLanguage: "en" });
    return;
  }

  if (requestUrl.pathname === "/api/attachments/analyze") {
    sendJson(response, 200, { summary: "", text: "", attachments: [] });
    return;
  }

  sendJson(response, 404, { detail: "Local test API route not found." });
}

async function handleStaticRequest(response, requestUrl) {
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(FRONTEND_DIR, relativePath);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const fileBuffer = await readFile(filePath);
    const contentType = MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
    });
    response.end(fileBuffer);
  } catch {
    sendText(response, 404, "Not found");
  }
}

export function createLocalDevServer() {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    try {
      if (requestUrl.pathname.startsWith("/api/")) {
        await handleApiRequest(request, response, requestUrl);
        return;
      }

      await handleStaticRequest(response, requestUrl);
    } catch (error) {
      sendJson(response, 500, {
        detail: error instanceof Error ? error.message : "Unexpected local server error.",
      });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createLocalDevServer();

  server.listen(port, host, () => {
    console.log(`Local no-Docker server running at http://${host}:${port}`);
  });
}
