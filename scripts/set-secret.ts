/**
 * Encrypts one production secret into .env.production without echoing it.
 * The value is read from stdin (piped, or typed at a hidden prompt), so it never
 * lands in shell history, `bun run`'s command echo, or agent tool output.
 *
 *   bun run secrets:set KEY                       # prompts, input hidden
 *   openssl rand -base64 32 | bun run secrets:set BETTER_AUTH_SECRET
 */
const [key, file = ".env.production"] = Bun.argv.slice(2);
if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
  console.error("Usage: bun run secrets:set KEY  (value from stdin)");
  process.exit(1);
}

async function readValue(): Promise<string> {
  if (!process.stdin.isTTY) return (await Bun.stdin.text()).trim();
  process.stdout.write(`${key}: `);
  Bun.spawnSync(["stty", "-echo"], { stdin: "inherit" });
  try {
    for await (const line of console) return line.trim();
    return "";
  } finally {
    Bun.spawnSync(["stty", "echo"], { stdin: "inherit" });
    process.stdout.write("\n");
  }
}

const value = await readValue();
if (!value) {
  console.error(`No value given for ${key}.`);
  process.exit(1);
}

// dotenvx prints the key it set, never the value. It exits 0 even on errors
// such as a missing file, so treat an "[ERROR_CODE]" line as failure.
const result = Bun.spawnSync(
  ["dotenvx", "set", key, value, "-f", file, "--no-native"],
  { stderr: "inherit" },
);
const output = result.stdout.toString();
if (!result.success || /^\[[A-Z_]+\]/m.test(output)) {
  console.error(output.trim() || `dotenvx set failed for ${key}.`);
  process.exit(result.exitCode || 1);
}
console.log(`Encrypted ${key} into ${file}.`);
