import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "raktdoot-test-"));
const env = { ...process.env, NODE_ENV: "test", DEMO_MODE: "true", APP_BASE_URL: "http://localhost:3000", DATABASE_URL: `file:${join(dir, "test.db").replaceAll("\\", "/")}` };
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit", cwd: process.cwd() });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Integration step failed (${result.status}): ${args[0]}`);
}
try {
  run([resolve("../../node_modules/prisma/build/index.js"), "migrate", "deploy"]);
  run(["prisma/seed.ts"]);
  run(["prisma/seed.ts"]); // Seed idempotency is checked below.
  run(["--test", "--test-concurrency=1", "tests/core.test.ts", "tests/http.test.ts", "tests/donors.test.ts", "tests/copilot.test.ts", "tests/outreach.test.ts", "tests/oauth.test.ts"]);
} finally {
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}