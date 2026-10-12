import { afterEach, describe, expect, it } from "vitest";
import { connect } from "node:net";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import { getSecrets } from "../src/secretgate/client.js";
import { getSocketPath, loadSecretsFromFile, setSecrets, startBroker, stopBroker } from "../src/secretgate/broker.js";

afterEach(async () => { await stopBroker(); });

// Some sandboxed CI environments prohibit Unix-domain sockets. Set this to 1
// in an environment that permits them to run the real broker integration suite.
describe.runIf(process.env.AIRLOCK_TEST_UNIX_SOCKETS === "1" || platform() === "win32")("Secret Gate", () => {
  it("parses normal dotenv syntax and serves fragmented requests", async () => {
    const temp = await mkdtemp(join(tmpdir(), "airlock-test-"));
    const envFile = join(temp, "fixture.env");
    await writeFile(envFile, "# fake fixture\r\nTOKEN='fake=value'\r\nSECOND = hello world\r\n");
    await loadSecretsFromFile(envFile);
    await startBroker();
    await expect(getSecrets(["TOKEN", "SECOND", "MISSING"])).resolves.toEqual({ TOKEN: "fake=value", SECOND: "hello world" });
    await rm(temp, { recursive: true, force: true });
  });

  it("rejects malformed client keys before connecting", async () => {
    await expect(getSecrets(["bad-key"])).rejects.toThrow("valid environment-variable names");
    await expect(getSecrets([])).rejects.toThrow("valid environment-variable names");
  });

  it("uses an owner-only Unix socket", async () => {
    setSecrets(new Map([["FAKE", "value"]]));
    await startBroker();
    if (platform() !== "win32") expect((await stat(getSocketPath())).mode & 0o777).toBe(0o600);
  });

  it("rejects malformed wire requests", async () => {
    setSecrets(new Map([["FAKE", "value"]]));
    await startBroker();
    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(getSocketPath());
      let data = "";
      socket.on("connect", () => socket.end("bad-key\n\n"));
      socket.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      socket.on("end", () => resolve(data));
      socket.on("error", reject);
    });
    expect(JSON.parse(response)).toEqual({ error: "Invalid secret request" });
  });
});
