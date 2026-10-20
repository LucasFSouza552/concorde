# Concorde — Desktop (Electron)

Cliente desktop do Concorde (monorepo pnpm), construído com electron-vite (main + preload + renderer) React e publicado com electron-builder.

## Scripts

- `pnpm dev` — dev API local (`pnpm server` na raiz sobe o worker em `localhost:8787`).
- `pnpm dev:online` — dev apontando para o worker publicado do cloud.
- `pnpm build` — `tsc -b` + `electron-vite build` + `electron-builder --win` (gera instalador).
- `pnpm dist` — `electron-builder --win` (empacota usando o `out/` existente).
- `pnpm dist:beta` — build + empacotamento com o canal beta (`electron-builder-beta.yml`).
- `pnpm lint` — ESLint. `pnpm test` — Vitest (`src/renderer/audio/SensitivityGate.test.ts`).

## Recursos

- **Ícone**: `resources/concorde.ico` é gerado a partir de `resources/concorde-original.ico` pelo pipeline manual `scripts/generate-icon.py` (raíz do monorepo).
- **Áudio de janela compartilhada**: `resources/loopback/concorde-loopback-capture.exe` (WASAPI process loopback). Fonte em `native/loopback-capture/`; recompilar com `build.ps1`. O binário é gitignored (`*.exe`) — regenerável.
- **Config única do Vite**: `electron.vite.config.ts` (não existe config de web separada).
