# Concorde v2 — Roadmap

> Lista viva do que falta. Ordem importa: segurança antes, dependências respeitadas.
> Auditoria de código em 18/10/2026: `[x]` = feito; nos parciais a linha "falta:" diz o que sobra.

## Release atual

- [ ] **Release 0.1.3** — commit da pilha, bump, redeploy cloud se preciso, publish, testar banner 0.1.2→0.1.3 (nunca visto funcionando).
  - parcial: 0.1.3 e 0.1.4 já publicadas (HEAD = 0.1.4, `25dc04a`); banner existe (`src/main/index.ts` electron-updater + `components/UpdateBanner/UpdateBanner.tsx`, checagem a cada 6h); falta testar o caminho de atualização, bumpar `packages/shared` (segue 0.1.0) e CI (`.github/workflows` vazio).

## Voz e transmissão

- [x] **Gate estágio B** — UI sensibilidade auto/manual/off + threshold (engine já integrada no mic). feito: `audio/SensitivityGate.ts` (+ `SensitivityGate.test.ts`), integração em `hooks/useLocalMedia.ts`, UI em `components/SettingsModal/AudioSettings.tsx` (radiogroup + slider com `MicMeter`), persistência em `hooks/useAudioSettings.ts`.
- [ ] **Trocar tela/janela sem parar o share** — `replaceTrack` em vídeo+áudio (padrão `switchScreenShare` da v1). não feito: `useCall.ts` `startScreenShare` chama `stopScreenShare` e recria a stream; o único `replaceTrack` do repo é `WebRTCManager.ts` `replaceAudioTrack` (mic).
- [ ] **Sistema de qualidade de transmissão** — ladder de bitrate, auto por rede, stats visíveis. parcial: ladder fixa por resolução + rate-share por peer (`WebRTCManager.ts` `screenMaxBitrate`, `SCREEN_TOTAL_BITRATE`, `degradationPreference`); escolha manual 480p/720p/1080p em `SourceModal.tsx`. falta: adaptação por rede (zero `getStats()`/jitter/perda) e UI de stats na chamada.
- [ ] **Mesh** — TURN (NAT restritivo), limite de peers, monitorar quedas pós-ICE-restart. não feito: `RTC_CONFIG` só STUN, sem teto de conexões por sala (`CallSession.ts` aceita join ilimitado). parcial: `restartIce` existe, mas não trata `disconnected` nem falha repetida.
- [ ] **Chamada em grupo** — multi-invite, merge sem fundir 1:1, UI adicionar participante, paginação no grid. parcial: multi-invite pronto (`useCallInvite.ts` `dialGroup`, limite 6 em `calls.service.ts`); merge só via `redirectCall` (convite vira grupo). falta: botão de adicionar participante dentro da chamada (`CallControls`/`CallHeader`/`VoiceList` não têm), paginação do grid (`CallGrid.tsx` renderiza todos).
- [x] **Volume por usuário na call** — gain por stream + slider. feito: `RemoteAudio.tsx` (GainNode por stream), `GlobalRemoteAudio.tsx`, `PeerAudioMenu.tsx` (voz 0–200% + volume/mudo da transmissão). ajuste pendente: `RemoteAudio.tsx` aplica `volume * 2` no ganho inicial e `volume` na atualização.
- [ ] **Share com áudio reabilitado** (só após o gate) — system audio + mix + UI. parcial: áudio por janela/processo (WASAPI loopback, `native/loopback-capture/capture.cpp` — restrição de projeto: nunca global), checkbox em `SourceModal.tsx`, mudo em `CallControls.tsx`. falta: system-audio global, mix de fontes e áudio em tela cheia (hoje aviso "disponível apenas para janelas").

## Social

- [x] **Grupos: acessar, membros, promover** — backend pronto, falta UI (detalhe do grupo, adicionar/remover, cargos). feito: `GroupDetail.tsx` (lista, adicionar, remover, promover/rebaixar com `roleLabels`/owner/admin) + `groups.routes.ts`/`groups.controller.ts`.
- [ ] **Listas que se atualizam sozinhas** — amizades e pendentes sem reload manual (invalidação via socket). parcial: presença atualiza sozinha (`useFriendsPresence.ts` + polling de 15s). falta: eventos de amizade no protocolo (`packages/shared/src/types.ts` não tem friend-*) e refetch de `useFriendsList`/`useIncomingRequests` fora de ação manual.
- [ ] **Pendentes enviados visíveis** — seção "Aguardando resposta" (backend: listar requests enviadas; hoje só as recebidas aparecem). não feito: `GET /friends/requests` filtra `friendId = ?` (só recebidas, `friends.repository.ts`); aba "Pendentes" em `Friends.tsx` só renderiza as recebidas.
- [ ] **Editar perfil** — `PATCH /auth/me` + tela (regra de username `^[a-z0-9_.]+$` já aplicada). parcial: regex pronta (`packages/shared/src/validations.ts`) e aplicada no cadastro. falta: rota `PATCH /auth/me` (só existem login/register/GET me) e tela (`AccountSettings.tsx` só exibe + sair).
- [ ] **Sistema de banimento** — flag/tabela no backend, bloqueio no middleware/auth, mensagem no front. não feito: zero ocorrências de ban; `middleware/auth.ts` só valida token; migrations sem flag/tabela.

## App e infra

- [ ] **Settings reais** — devices, volumes, qualidade de tela, tema + persistência. parcial: devices só de mic (`AudioSettings.tsx` filtra `audioinput`); volumes por usuário sem master; qualidade de tela é estado local perdido a cada share; persistência só de áudio + sessão (localStorage). falta: saída/câmera, volume master, preferência de qualidade e tema (não existe).
- [x] **Identidade do instalador** — logo/ícone (travado: falta o asset). feito: `resources/concorde.ico` (7 tamanhos 16→256, gerado por `scripts/generate-icon.py`, backup em `concorde-original.ico`) + `build.win.icon`/`extraResources` no `package.json` e no `electron-builder-beta.yml` + `trayIconPath` no main. falta: versionar `resources/` (hoje untracked).
- [ ] **Infra** — JWT refresh (expira em 7d), presença com auth, CSP de produção. parcial: presença com auth feita (`UserSession.ts` exige `auth` e valida token). falta: fluxo de refresh (token expira em 7d em `utils/JWT.ts` mas não há rota/renovação) e CSP (nenhum header, meta ou `webRequest`).
