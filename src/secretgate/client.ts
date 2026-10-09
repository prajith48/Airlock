/**
 * Secret Gate Client
 *
 * Helper module for applications to fetch secrets from the Airlock broker
 * instead of reading .env files directly from disk.
 *
 * Usage in your application:
 *   import { getSecrets } from 'airlock/secretgate/client';
 *   const secrets = await getSecrets(['DATABASE_URL', 'API_KEY']);
 *   console.log(secrets.DATABASE_URL);
 */

import { connect, type Socket } from "node:net";
import { platform } from "node:os";

const SOCKET_PATH =
  platform() === "win32"
    ? "\\\\.\\pipe\\airlock-secrets"
    : "/tmp/airlock-secrets.sock";

/**
 * Fetches secrets from the Airlock Secret Gate broker
 *
 * @param keys - Array of environment variable names to retrieve
 * @returns Promise resolving to object with requested secrets
 */
export function getSecrets(keys: string[]): Promise<Record<string, string | undefined>> {
  return new Promise((resolve, reject) => {
    const socket: Socket = connect(SOCKET_PATH);

    let responseData = "";

    socket.on("connect", () => {
      // Send requested keys (newline-separated, terminated with double newline)
      const request = keys.join("\n") + "\n\n";
      socket.write(request);
    });

    socket.on("data", (chunk) => {
      responseData += chunk.toString();
    });

    socket.on("end", () => {
      try {
        const secrets = JSON.parse(responseData);
        resolve(secrets);
      } catch (error) {
        reject(new Error(`Failed to parse secrets response: ${error}`));
      }
    });

    socket.on("error", (err) => {
      reject(new Error(`Failed to connect to Secret Gate broker: ${err.message}`));
    });
  });
}

/**
 * Loads all secrets and injects them into process.env
 * This allows legacy code that reads process.env directly to continue working
 *
 * @param keys - Array of environment variable names to load
 */
export async function loadIntoProcessEnv(keys: string[]): Promise<void> {
  const secrets = await getSecrets(keys);

  for (const [key, value] of Object.entries(secrets)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}
