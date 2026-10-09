// This stands in for a real dev server (Vite, Webpack, etc.) so we can
// test Airlock's proxy without needing a real project yet.
import http from "node:http";

const PORT = process.env.PORT ? Number(process.env.PORT) : 49152;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(`Hello from the fake dev server! You requested: ${req.url}\n`);
});

// Bind ONLY to 127.0.0.1 — this is the "hidden" behavior Dev Server Guard
// will enforce for real later. For now we set it manually to prove the
// concept.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[fake-dev-server] listening on 127.0.0.1:${PORT}`);
});