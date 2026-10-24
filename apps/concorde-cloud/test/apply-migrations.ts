import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import type { D1Migration } from "@cloudflare/vitest-plugin";

// Setup files rodam fora do isolamento por test file e podem rodar mais
// de uma vez; `applyD1Migrations()` é idempotente (grava em d1_migrations).
await applyD1Migrations(
	env.concorde_users as D1Database,
	(env as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS
);
