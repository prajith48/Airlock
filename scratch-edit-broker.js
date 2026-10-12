import fs from 'fs';

let content = fs.readFileSync('src/secretgate/broker.ts', 'utf8');

// Replace SOCKET_PATH
content = content.replace(/const SOCKET_PATH[\s\S]*?airlock-secrets\.sock";/, `import { getSocketPath } from "../utils/socketPath.js";\nconst SOCKET_PATH = getSocketPath();`);
content = content.replace(/export function getSocketPath\(\): string {[\s\S]*?}/, `export { getSocketPath };`);

// Update loadSecretsFromFile to NOT delete the file
content = content.replace(/\s*\/\/ FR-11: Delete the plaintext file after loading\s*await unlink\(envFilePath\);\s*logger\.info\(`✓ Plaintext secrets file removed: \$\{envFilePath\}`\);/, '');

// Update startBroker to handle stale sockets and set permissions
const staleSocketLogic = `  // Clean up any existing socket file
  if (platform() !== "win32" && existsSync(SOCKET_PATH)) {
    try {
      await new Promise<void>((resolve, reject) => {
        const client = import("node:net").then(({ connect }) => {
          const sock = connect(SOCKET_PATH)
            .on("connect", () => {
               sock.destroy();
               reject(new Error("Socket is active"));
            })
            .on("error", () => {
               resolve();
            });
        });
      });
      await unlink(SOCKET_PATH);
    } catch (err) {
      if ((err as Error).message === "Socket is active") {
         logger.error(\`Socket \${SOCKET_PATH} is already actively in use.\`);
         throw new Error("Secret Gate broker already running");
      }
      await unlink(SOCKET_PATH);
    }
  }`;

content = content.replace(/  \/\/ Clean up any existing socket file\s*if \(platform\(\) !== "win32" && existsSync\(SOCKET_PATH\)\) \{\s*await unlink\(SOCKET_PATH\);\s*\}/, staleSocketLogic);

const listenLogic = `  brokerServer.listen(SOCKET_PATH, () => {
    if (platform() !== "win32") {
      import("node:fs").then(fs => fs.chmodSync(SOCKET_PATH, 0o600)).catch(() => {});
    }
    logger.info(\`Secret Gate broker listening on \${SOCKET_PATH}\`);
    logger.info(\`Serving \${secretsStore.size} secrets\`);
  });`;

content = content.replace(/  brokerServer\.listen\(SOCKET_PATH, \(\) => \{\s*logger\.info\(`Secret Gate broker listening on \$\{SOCKET_PATH\}`\);\s*logger\.info\(`Serving \$\{secretsStore\.size\} secrets`\);\s*\}\);/, listenLogic);

fs.writeFileSync('src/secretgate/broker.ts', content);

// Update client.ts
let clientContent = fs.readFileSync('src/secretgate/client.ts', 'utf8');
clientContent = clientContent.replace(/const SOCKET_PATH[\s\S]*?airlock-secrets\.sock";/, `import { getSocketPath } from "../utils/socketPath.js";\nconst SOCKET_PATH = getSocketPath();`);
fs.writeFileSync('src/secretgate/client.ts', clientContent);

// Update cli.ts for Secret Gate
let cliContent = fs.readFileSync('src/cli.ts', 'utf8');
// Fix import
cliContent = cliContent.replace(/import \{ loadSecretsFromFile, startBroker \} from "\.\/secretgate\/broker\.js";/, `import { loadSecretsFromFile, startBroker } from "./secretgate/broker.js";\nimport { getSocketPath } from "./utils/socketPath.js";`);
cliContent = cliContent.replace(/const sockPath = "\/tmp\/airlock-secrets\.sock";/, `const sockPath = getSocketPath();`);

// Update start command
const startCommandReplacement = `.command("start")
  .description("Start secrets broker daemon")
  .option("-e, --env <path>", "Path to the .env file to consume", ".env")
  .option("--delete-source", "Explicitly authorize deletion of the source .env file after successful load")
  .action(async (options) => {`;

cliContent = cliContent.replace(/\.command\("start"\)[\s\S]*?\.action\(async \(options\) => \{/, startCommandReplacement);

// Update deletion logic in cli.ts start command
const cliDeleteLogic = `      if (existsSync(envPath)) {
        logger.info(\`Loading secrets from \${envPath}\`);
        await loadSecretsFromFile(envPath);
        printOk(\`Secrets loaded into memory\`);
      } else {
        printWarn(\`No .env file found at \${envPath} — starting with empty keystore\`);
        logger.warn(\`No .env file found at \${envPath}. Starting with empty keystore.\`);
      }

      printStatus("Socket path", getSocketPath(), "ok");
      printStatus("Broker status", "listening", "ok");
      process.stdout.write("\\n");
      printTip("Connect with: import { getSecrets } from 'airlock/secretgate/client'");
      process.stdout.write("\\n");

      // Start socket broker (FR-12, FR-13)
      await startBroker();
      
      // Delete source AFTER broker starts successfully, if requested
      if (options.deleteSource && existsSync(envPath)) {
         await import("node:fs/promises").then(fs => fs.unlink(envPath));
         printOk(\`Plaintext secrets file securely removed: \${envPath}\`);
      } else if (existsSync(envPath)) {
         printWarn(\`Source file \${envPath} was NOT deleted (use --delete-source to authorize)\`);
      }`;

cliContent = cliContent.replace(/      if \(existsSync\(envPath\)\) \{[\s\S]*?await startBroker\(\);/, cliDeleteLogic);
fs.writeFileSync('src/cli.ts', cliContent);

// Add missing unlink for clean
let packageJson = fs.readFileSync('package.json', 'utf8');
packageJson = packageJson.replace(/rm -f \/tmp\/airlock-secrets\.sock/, `rm -f /tmp/airlock-secrets.sock /tmp/airlock-*/secrets.sock`);
fs.writeFileSync('package.json', packageJson);

console.log("Broker, Client, and CLI updated.");
