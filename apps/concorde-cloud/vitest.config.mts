import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
	const migrations = await readD1Migrations({ migrationsDir: "migrations" });

	return {
		plugins: [
			cloudflareTest({
				wrangler: { configPath: "./wrangler.jsonc" },
				miniflare: {
					bindings: {
						TEST_MIGRATIONS: migrations,
						RATE_LIMIT_DISABLED: "1",
						DISCORD_CLIENT_ID: "test-client",
						DISCORD_CLIENT_SECRET: "test-secret",
						DISCORD_REDIRECT_URI: "concorde://oauth/discord",
						DISCORD_API_BASE_URL: "https://discord.test/api"
					}
				}
			}),
		],
		test: {
			setupFiles: ["./test/apply-migrations.ts"],
		},
	};
});
