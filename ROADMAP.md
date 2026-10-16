# Concorde v2 — Roadmap

> Lista viva do que falta. Ordem importa: segurança antes, dependências respeitadas.

## Release atual

- [ ] **Release 0.1.3** — commit da pilha, bump, redeploy cloud se preciso, publish, testar banner 0.1.2→0.1.3 (nunca visto funcionando).

## Voz e transmissão

- [ ] **Gate estágio B** — UI sensibilidade auto/manual/off + threshold (engine já integrada no mic).
- [ ] **Trocar tela/janela sem parar o share** — `replaceTrack` em vídeo+áudio (padrão `switchScreenShare` da v1).
- [ ] **Sistema de qualidade de transmissão** — ladder de bitrate, auto por rede, stats visíveis.
- [ ] **Mesh** — TURN (NAT restritivo), limite de peers, monitorar quedas pós-ICE-restart.
- [ ] **Chamada em grupo** — multi-invite, merge sem fundir 1:1, UI adicionar participante, paginação no grid.
- [ ] **Volume por usuário na call** — gain por stream + slider.
- [ ] **Share com áudio reabilitado** (só após o gate) — system audio + mix + UI.

## Social

- [ ] **Grupos: acessar, membros, promover** — backend pronto, falta UI (detalhe do grupo, adicionar/remover, cargos).
- [ ] **Listas que se atualizam sozinhas** — amizades e pendentes sem reload manual (invalidação via socket; casa com a camada de dados).
- [ ] **Pendentes enviados visíveis** — seção "Aguardando resposta" (backend: listar requests enviadas; hoje só as recebidas aparecem).
- [ ] **Editar perfil** — `PATCH /auth/me` + tela (regra de username `^[a-z0-9_.]+$` já aplicada).
- [ ] **Sistema de banimento** — flag/tabela no backend, bloqueio no middleware/auth, mensagem no front.

## App e infra

- [ ] **Settings reais** — devices, volumes, qualidade de tela, tema + persistência.
- [ ] **Identidade do instalador** — logo/ícone (travado: falta o asset).
- [ ] **Infra** — JWT refresh (expira em 7d), presença com auth, CSP de produção.
