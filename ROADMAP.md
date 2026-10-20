# Concorde v2 — Roadmap

> Lista viva do que falta. Ordem importa: segurança antes, dependências respeitadas.
> Auditoria de código em 19/10/2026 (HEAD `993e567`): `[x]` = feito; nos parciais a linha "falta:" diz o que sobra.

## Desempenho e app

- [x] **Aceleração GPU no Electron** — flags no boot (`apps/desktop/src/main/index.ts:243-246`): VaapiVideoEncoder/VaapiVideoDecoder + HEVC, `enable-gpu-rasterization`, `enable-zero-copy`, `ignore-gpu-blocklist`.
- [x] **backgroundThrottling desativado** — `backgroundThrottling: false` no `webPreferences` da janela (`main/index.ts:182`).
- [x] **Preview local de tela apenas com Concorde ativo** — tile local esconde o preview quando a janela perde foco/visibilidade (`ParticipantTile.tsx:29-44`, placeholder "Você está compartilhando a tela"); `ScreenVideo.tsx:21-31` retoma `play()` ao voltar o foco.
- [x] **Chamadas ativas na sidebar** — `hooks/useActiveCalls.ts` alimenta "Chamadas ativas" na sidebar (`SideBar.tsx:91-123`, entrar/voltar + VoiceList) e "Grupos em Chamada" na Home (`Home.tsx:193-241`).
- [x] **Remoção de "Minhas salas" na sidebar** — sidebar sem seção de salas/canais (`SideBar.tsx:54-124`); `useChannels.ts` sobrevive só como contador de DMs na Home (`Home.tsx:52,61`).
- [x] **Separação visual/funcional entre amigos e chat** — lista de amigos (4 abas) e chat se revezam por cima (`Friends.tsx:69,118,174-180`), sem colunas misturadas.
- [ ] **Desempenho e responsividade** — parcial: polling 15s + deltas em tempo real via WS (`peer-status`/`peer-call-state`), heartbeat 60s, reconexão com backoff e jitter, share só flui para quem assiste (`setShareReceiveEnabled`). falta: endpoint em lote de presença (hoje N+1 HTTP em `useActiveCalls` e `GroupPage`) e virtualização de listas (mensagens/amigos).
- [ ] **Redução de armazenamento e peso em disco** — parcial: nenhum artefato de build versionado. falta: `worker-configuration.d.ts` (616 KB, gerado pela Cloudflare) ainda no git — regenerável/ignorável para encolher o repo.

## Voz e transmissão

- [x] **Gate estágio B** — UI sensibilidade auto/manual/off + threshold (engine já integrada no mic). feito: `audio/SensitivityGate.ts` (+ `SensitivityGate.test.ts`), integração em `hooks/useLocalMedia.ts`, UI em `components/SettingsModal/AudioSettings.tsx` (radiogroup + slider com `MicMeter`), persistência em `hooks/useAudioSettings.ts`.
- [ ] **Trocar tela/janela sem parar o share** — `replaceTrack` em vídeo+áudio (padrão `switchScreenShare` da v1). não feito: `startScreenShare` chama `stopScreenShare` e recria a stream (`useCall.ts:247-259`); o único `replaceTrack` do repo é `replaceAudioTrack` do mic (`WebRTCManager.ts:255-263`).
- [ ] **Sistema de qualidade de transmissão** — ladder de bitrate, auto por rede, stats visíveis. parcial: ladder fixa por resolução + rate-share por peer (`WebRTCManager.ts` `screenMaxBitrate`, `SCREEN_TOTAL_BITRATE`, `degradationPreference`); escolha manual 480p/720p/1080p em `SourceModal.tsx`. falta: adaptação por rede (zero `getStats()`/jitter/perda) e UI de stats na chamada.
- [ ] **Mesh** — TURN (NAT restritivo), limite de peers, monitorar quedas pós-ICE-restart. não feito: `RTC_CONFIG` só STUN, sem teto de conexões por sala (`CallSession.ts` aceita join ilimitado). parcial: `restartIce` existe, mas não trata `disconnected` nem falha repetida (cooldown 5s em `WebRTCManager.ts:21,93-106`).
- [ ] **Chamada em grupo** — multi-invite, convite em grupo (convite vira grupo), UI adicionar participante, paginação no grid. parcial: multi-invite pronto (`useCallInvite.ts` `dialGroup`, limite 6 em `calls.service.ts`). falta: botão de adicionar participante dentro da chamada (`CallControls`/`CallHeader`/`VoiceList` não têm), paginação do grid (`CallGrid.tsx` renderiza todos) e "promover" chamada 1:1 a grupo (o antigo `redirectCall`/`call-redirect` foi removido — hoje 1:1 e grupo são fluxos independentes).
- [ ] **Share com áudio reabilitado** (só após o gate) — system audio + mix + UI. parcial: áudio por janela/processo (WASAPI loopback, `native/loopback-capture/capture.cpp` — restrição de projeto: nunca global), checkbox em `SourceModal.tsx`, mudo em `CallControls.tsx:89-93`. falta: system-audio global, mix de fontes e áudio em tela cheia (hoje aviso "disponível apenas para janelas").

## Social

- [ ] **Listas que se atualizam sozinhas** — amizades e pendentes sem reload manual (invalidação via socket). parcial: presença atualiza sozinha (`useFriendsPresence.ts:54-84` + deltas via `peer-status`). falta: eventos de amizade no protocolo (`packages/shared/src/types.ts` não tem friend-*) e refetch de `useFriendsList`/`useIncomingRequests` fora de ação manual.
- [ ] **Pendentes enviados visíveis** — seção "Aguardando resposta" (backend: listar requests enviadas; hoje só as recebidas aparecem). não feito: `GET /friends/requests` filtra `friendId = ?` (só recebidas, `friends.repository.ts`); aba "Pendentes" em `Friends.tsx` só renderiza as recebidas.
- [ ] **Sistema de banimento** — flag/tabela no backend, bloqueio no middleware/auth, mensagem no front. não feito: zero ocorrências de ban; `middleware/auth.ts` só valida token; migrations sem flag/tabela.

## Novas funcionalidades

- [ ] **Edição de perfil (Display Name)** — não feito: sem `PATCH /auth/me` no backend (`auth.routes.ts` só tem login/register/GET me) e `AccountSettings.tsx` é somente leitura (exibe + sair). regex de username pronta (`packages/shared/src/validations.ts`).
- [ ] **Sistema de presença** — parcial: status via WS (`set-status`/`peer-status` em `UserSession.ts:123-158`), presença HTTP + `call-state`, polling 15s com deltas, exibição em sidebar/Home/abas de amigos. falta: status persistente entre conexões (default "online" ao reconectar, `UserSession.ts:53`), auto-away/idle, "invisível" hoje reportado como offline (`UserSession.ts:207`).
- [ ] **Gerenciamento de grupos** — parcial: criar grupo (modal), adicionar/remover membro, promover/rebaixar admin (UI `GroupDetail.tsx:69-100` + rotas `groups.routes.ts:18-23`). falta: "sair do grupo" (sem rota e sem botão) e "dissolver grupo" (não existe `DELETE /groups/:id`).
- [x] **Botão "assistir compartilhamento" ao iniciar share** — feito: quando o peer inicia share, o tile dele mostra "Assistir compartilhamento" (`ParticipantTile.tsx:88-103` → `watchShare`, `useCall.ts:223-225`); não é automático, exige clique; overlay "Parar de assistir" enquanto assiste.
- [ ] **Trocar janela compartilhada sem parar o share** — não feito: `startScreenShare` para e recria a stream (`useCall.ts:247-259`); sem `replaceTrack` de vídeo da tela.

## Correções

- [ ] **Demora ao entrar em chamadas** — parcial: sem delays artificiais no fluxo join/offer (offer sai logo após `setLocalDescription`, candidatos ICE enfileirados, reconexão 1s→10s com backoff). sobra: a cadeia de mídia local (RNNOISE + gate de sensibilidade + AudioContext) roda antes do primeiro offer (`useLocalMedia.ts:77-111,141`) e atrasa o áudio inicial de quem entra.
- [x] **Tela compartilhada anterior não aparece para novos entrantes** — feito: o servidor sincroniza o estado de share no `join` (`CallSession.ts:63-71`, `screen-share {sharing, from}`); cliente liga "Assistir compartilhamento" → transceiver `recvonly` → vídeo em `remoteScreenStreams`.
- [x] **Controle de volume de voz/transmissão** — feito: GainNode por stream (`RemoteAudio.tsx`), slider de voz 0–200% + volume/mudo da transmissão por usuário (`PeerAudioMenu.tsx:56-93`), mudo global (`CallControls.tsx:89-93`). bug conhecido: `RemoteAudio.tsx:94` aplica `volume * 2` no ganho inicial e `volume` na atualização (100% na UI = 2× real).
- [x] **Share oculto em segundo plano/minimizado** — feito: nenhum handler interrompe o `screenStream` em blur/minimize; `backgroundThrottling: false` + bandeja mantêm a captura viva. nota: sem `powerSaveBlocker` (risco de throttle do OS com tela bloqueada/suspensa).
- [x] **Chamada 1:1 de usuário em grupo redirecionava para a chamada do grupo** — feito: redirect removido de ponta a ponta — sem rota `/calls/:id/redirect`, sem `redirectCallController`/`redirectCall` no cloud, sem evento `call-redirect` no protocolo e sem case no cliente (`types.ts`, `calls.routes/controller/service`, `useCallInvite.ts`); `dial`/`acceptIncoming`/`cancelDial`/`hangUp` limpam `joinedGroup`; tipo `CallInvite` unificado (1 declaração, com `concordeGroupId?`).
- [x] **Tiles da sala anterior apareciam na chamada nova** (ex.: atender 1:1 durante chamada de grupo) — feito: cleanup do efeito principal do `useCall` zera todos os estados de participantes ao sair da sala (`useCall.ts:200-213`: `peers`, `peerMuted`, `peerSharing`, `remoteStreams`, `remoteScreenStreams`, `remoteScreenAudioStreams`).
- [ ] **Limpeza de artefatos gerados (dist, out, caches)** — parcial: `.gitignore` cobre `node_modules/ out/ dist/ release/ *.exe` e nada está versionado. falta: script `clean`/`prune` no `package.json` para apagar builds do disco (ex.: `apps/desktop/out` ~0,5 MB).

## App e infra

- [ ] **Settings reais** — devices, volumes, qualidade de tela, tema + persistência. parcial: devices só de mic (`AudioSettings.tsx` filtra `audioinput`); volumes por usuário sem master; qualidade de tela é estado local perdido a cada share; persistência só de áudio + sessão (localStorage). falta: saída/câmera, volume master, preferência de qualidade e tema (não existe).
- [x] **Identidade do instalador** — logo/ícone commitado: `resources/concorde.ico` (7 tamanhos 16→256, backup em `concorde-original.ico`) + janela (`BrowserWindow` `icon: trayIconPath()`), bandeja (`main/index.ts:204-229`), `build.win.icon`/`extraResources` no `package.json` e no `electron-builder-beta.yml`. nota: `concorde-loopback-capture.exe` (165 KB) permanece ignorado por `*.exe` — clone novo não terá o binário de áudio de tela.
- [ ] **Infra** — JWT refresh (expira em 7d), presença com auth, CSP de produção. parcial: presença com auth feita (`UserSession.ts` exige `auth` e valida token). falta: fluxo de refresh (token expira em 7d em `utils/JWT.ts` mas não há rota/renovação) e CSP (nenhum header, meta ou `webRequest`).
