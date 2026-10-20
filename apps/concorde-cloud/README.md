# Concorde — Cloud (Worker)

Backend do Concorde: Cloudflare Worker (Hono) com Durable Objects (`CallSession`, `UserSession`) e D1 (`concorde_users`).

## Scripts

- `pnpm server` (raiz) ou `pnpm dev` — dev local (`wrangler dev`), API em `localhost:8787` (usado pelo desktop).
- `pnpm deploy` — publica o worker.
- `pnpm test` — Vitest com plugin Cloudflare.
- `pnpm cf-typegen` — regenera `worker-configuration.d.ts` (types do runtime Cloudflare).

## Notas

- `worker-configuration.d.ts` é **gerado** e está no `.gitignore`: após um clone, rode `pnpm install` + `pnpm cf-typegen` antes de compilar (`tsc -b`) — o `tsconfig.json` usa os globals dele (`D1Database`, `DurableObjectNamespace`).
- `pnpm clean` (raiz) remove `.wrangler/` e artefatos de build quando precisar liberar disco.
