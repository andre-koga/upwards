import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSupabaseEnv } from "./helpers";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function queryLocal(sql: string): string {
  return execFileSync("pnpm", ["exec", "supabase", "db", "query", "--local", sql], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

describe("sync_operations Realtime configuration", () => {
  beforeAll(() => {
    loadSupabaseEnv();
  });

  it("publishes sync_operations to supabase_realtime with FULL replica identity", () => {
    const published = queryLocal(
      "SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sync_operations';"
    );
    expect(Number(published.replace(/\D/g, ""))).toBeGreaterThanOrEqual(1);

    const replident = queryLocal(
      "SELECT relreplident::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'sync_operations';"
    );
    expect(replident).toContain("f");
  });
});
