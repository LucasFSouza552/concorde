import { rmSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

// Artefatos de build/pacotes — todos regeneráveis.
const targets = [
	"apps/desktop/out",
	"apps/desktop/dist",
	"apps/desktop/dist-ssr",
	"apps/desktop/release",
	"apps/desktop/release-beta",
	"apps/desktop/node_modules/.tmp",
	"apps/desktop/node_modules/.vite",
	"apps/concorde-cloud/dist",
	"apps/concorde-cloud/node_modules/.tmp",
	"packages/shared/dist"
];

// Bundles temporários do wrangler dev. NUNCA apagar `.wrangler/state`
// (contém os dados do D1 local e o estado dos DOs em dev).
const wranglerTmpRoot = join(root, "apps/concorde-cloud/.wrangler");

if (existsSync(wranglerTmpRoot)) {
	for (const name of readdirSync(wranglerTmpRoot)) {
		if (name.startsWith("tmp")) {
			targets.push(join("apps/concorde-cloud/.wrangler", name));
		}
	}
}

for (const target of targets) {
	try {
		const path = join(root, target);
		if (existsSync(path) && statSync(path).isDirectory()) {
			rmSync(path, { recursive: true, force: true });
			console.log(`clean: ${target}`);
		}
	} catch {
		console.warn(`clean: ${target} em uso, ignorado (fecha o processo e rode de novo).`);
	}
}
