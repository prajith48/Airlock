/** Local, in-memory Secret Gate broker. This is a convenience boundary, not
 * authentication against another process running as the same OS user. */
import { Server, connect, type Socket } from "node:net";
import { platform } from "node:os";
import { chmod, lstat, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createLogger } from "../utils/logger.js";
import { getSocketPath } from "../utils/socketPath.js";

const logger = createLogger("secretgate");
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_KEYS = 128;
const REQUEST_TIMEOUT_MS = 5_000;
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
let secretsStore = new Map<string, string>();
let brokerServer: Server | null = null;

function parseEnvFile(content: string): Map<string, string> {
  const parsed = dotenv.parse(content);
  const secrets = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed)) {
    if (!KEY_NAME.test(key)) throw new Error(`Invalid environment variable name: ${key}`);
    secrets.set(key, value);
  }
  return secrets;
}

/** Load only: source-file deletion is deliberately a CLI-controlled action. */
export async function loadSecretsFromFile(envFilePath: string): Promise<void> {
  const content = await readFile(envFilePath, "utf8");
  secretsStore = parseEnvFile(content);
  logger.info({ count: secretsStore.size }, "Secrets loaded into memory");
}

export function setSecrets(secrets: Map<string, string>): void {
  for (const key of secrets.keys()) if (!KEY_NAME.test(key)) throw new Error(`Invalid environment variable name: ${key}`);
  secretsStore = new Map(secrets);
}

function reject(socket: Socket, message: string): void { socket.end(JSON.stringify({ error: message })); }

function handleClient(socket: Socket): void {
  let buffer = "";
  let complete = false;
  const timeout = setTimeout(() => { if (!complete) reject(socket, "Request timed out"); }, REQUEST_TIMEOUT_MS);
  timeout.unref();
  const finish = (): void => { complete = true; clearTimeout(timeout); };
  socket.once("error", finish);
  socket.once("close", finish);
  socket.on("data", (chunk: Buffer) => {
    if (complete) return;
    buffer += chunk.toString("utf8");
    if (Buffer.byteLength(buffer) > MAX_REQUEST_BYTES) { finish(); reject(socket, "Request too large"); return; }
    const terminator = buffer.indexOf("\n\n");
    if (terminator < 0) return;
    const trailing = buffer.slice(terminator + 2);
    const keys = buffer.slice(0, terminator).split("\n").map((key) => key.trim()).filter(Boolean);
    if (trailing.trim() || keys.length === 0 || keys.length > MAX_KEYS || keys.some((key) => !KEY_NAME.test(key))) {
      finish(); reject(socket, "Invalid secret request"); return;
    }
    finish();
    const response: Record<string, string | undefined> = {};
    for (const key of keys) response[key] = secretsStore.get(key);
    socket.end(JSON.stringify(response));
  });
}

async function removeStaleSocket(socketPath: string): Promise<void> {
  if (platform() === "win32" || !existsSync(socketPath)) return;
  const stat = await lstat(socketPath);
  if (!stat.isSocket()) throw new Error(`Refusing to replace non-socket path: ${socketPath}`);
  const active = await new Promise<boolean>((resolve) => {
    const probe = connect(socketPath);
    probe.once("connect", () => { probe.destroy(); resolve(true); });
    probe.once("error", () => resolve(false));
  });
  if (active) throw new Error("Secret Gate broker already running");
  await rm(socketPath);
}

export async function startBroker(): Promise<void> {
  if (brokerServer) throw new Error("Secret Gate broker already running in this process");
  const socketPath = getSocketPath();
  await removeStaleSocket(socketPath);
  const server = new Server(handleClient);
  brokerServer = server;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => { server.off("listening", onListening); brokerServer = null; reject(error); };
    const onListening = (): void => { server.off("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(socketPath);
  });
  if (platform() !== "win32") await chmod(socketPath, 0o600);
  logger.info({ socketPath, count: secretsStore.size }, "Secret Gate broker listening");
}

export async function stopBroker(): Promise<void> {
  const server = brokerServer;
  brokerServer = null;
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (platform() !== "win32") {
    try { await rm(getSocketPath()); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}

export { getSocketPath, MAX_REQUEST_BYTES, MAX_KEYS };
