import { platform, userInfo, tmpdir } from "node:os";
import { join } from "node:path";
import { chmodSync, lstatSync, mkdirSync } from "node:fs";

let socketPath = "\\\\.\\pipe\\airlock-secrets";

export function getSocketPath(): string {
  if (platform() !== "win32") {
    try {
      const uid = userInfo().uid;
      const dir = join(tmpdir(), `airlock-${uid}`);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const stat = lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Unsafe Airlock runtime directory");
      chmodSync(dir, 0o700);
      return join(dir, "secrets.sock");
    } catch {
      // Fallback if userInfo or mkdirSync fails
      return join(tmpdir(), "airlock-secrets.sock");
    }
  }
  return socketPath;
}
