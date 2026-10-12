import { connect, type Socket } from "node:net";
import { getSocketPath } from "../utils/socketPath.js";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const KEY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function getSecrets(keys: string[]): Promise<Record<string, string | undefined>> {
  if (keys.length === 0 || keys.length > 128 || keys.some((key) => !KEY_NAME.test(key))) return Promise.reject(new Error("Secret keys must be valid environment-variable names (1-128 keys)"));
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: NodeJS.Timeout;
    const settle = (fn: () => void): void => { if (!settled) { settled = true; clearTimeout(timeout); fn(); } };
    const socket: Socket = connect(getSocketPath());
    let responseData = "";
    timeout = setTimeout(() => { socket.destroy(); settle(() => reject(new Error("Secret Gate request timed out"))); }, REQUEST_TIMEOUT_MS);
    timeout.unref();
    socket.once("connect", () => socket.write(`${keys.join("\n")}\n\n`));
    socket.on("data", (chunk: Buffer) => {
      responseData += chunk.toString("utf8");
      if (Buffer.byteLength(responseData) > MAX_RESPONSE_BYTES) socket.destroy(new Error("Secret Gate response too large"));
    });
    socket.once("end", () => settle(() => {
      try {
        const response: unknown = JSON.parse(responseData);
        if (!response || typeof response !== "object" || Array.isArray(response) || "error" in response) throw new Error("Broker rejected request");
        resolve(response as Record<string, string | undefined>);
      } catch (error) { reject(error instanceof Error ? error : new Error("Invalid Secret Gate response")); }
    }));
    socket.once("error", (error) => settle(() => reject(new Error(`Secret Gate connection failed: ${error.message}`))));
  });
}

export async function loadIntoProcessEnv(keys: string[]): Promise<void> {
  const secrets = await getSecrets(keys);
  for (const [key, value] of Object.entries(secrets)) if (value !== undefined) process.env[key] = value;
}
