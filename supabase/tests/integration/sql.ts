import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// SQL as the database owner, for tests that need to see past the API roles
// (legacy tables, information_schema). Goes through the Supabase CLI.

export type Row = Record<string, unknown>;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The balanced `{...}` or `[...]` starting at `start`, or null if it never closes. */
function balanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * The rows of the query result in the CLI's output, or null if there are none.
 * The shape depends on the CLI version: 2.105 prints `{"rows": [...]}` and
 * 2.114 (what CI pins) prints a bare array of rows. pnpm and the CLI can also
 * print other text around the result, so every `{` or `[` is tried as a start
 * until one parses into either shape.
 */
function resultRows(text: string): Row[] | null {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "{" && text[i] !== "[") continue;
    const candidate = balanced(text, i);
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed as Row[];
      const rows = (parsed as { rows?: unknown }).rows;
      if (Array.isArray(rows)) return rows as Row[];
    } catch {
      // Not the result; keep looking.
    }
  }
  return null;
}

/** Run SQL as the database owner and return the rows of the last statement. */
export function sql(statement: string): Row[] {
  try {
    const out = execFileSync(
      "pnpm",
      ["exec", "supabase", "db", "query", "--local", "--output-format", "json", statement],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const rows = resultRows(out);
    if (rows) return rows;
    // Statements that return nothing (INSERT, UPDATE) may print no JSON; a
    // SELECT that does is a harness problem, so show what the CLI printed.
    if (/^\s*select\b/i.test(statement)) {
      throw new Error(`no result for query. CLI output:\n${out.slice(0, 1500)}`);
    }
    return [];
  } catch (error) {
    // Our own diagnostic above already says what it needs to.
    if (error instanceof Error && error.message.startsWith("no result")) {
      throw error;
    }
    // The CLI error repeats the whole statement; keep only its message.
    const text = String((error as { stdout?: string }).stdout ?? error);
    const message = /"message":"([^"]*)"/.exec(text)?.[1] ?? text.slice(-400);
    throw new Error(`SQL failed: ${message}`);
  }
}
