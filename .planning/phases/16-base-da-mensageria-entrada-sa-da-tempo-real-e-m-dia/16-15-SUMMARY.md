---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 15
subsystem: pre-voo
tags: [tempo-real, listen-notify, nginx, evolution, pre-voo, prova-ao-vivo, roteiro]

requires:
  - phase: 16-01 a 16-14
    provides: o código da mensageria, o comando canal:ligar-evolution e a documentação que o pré-voo exercita
provides:
  - "npm run tempo-real:provar -w @n1/api: uma volta de LISTEN/NOTIFY pela DATABASE_URL, imprime só papel, porta e milissegundos (a prova da suposição A9)"
  - "apps/api/deploy/provar-nginx.sh: a prova do fluxo SSE atrás do nginx, quatro linhas ok, sem segredo na saída"
  - "16-PROVA-AO-VIVO.md: o roteiro do dono (pré-voo, publicação, prova), com os resultados do pré-voo preenchidos"
  - "pré-voo respondido: Evolution 2.4.0 (licença ativa) aceita o adaptador (A10), SEG-11 ok, A9 provada pelo pooler de produção (52 ms)"
affects: [16-16, Sessão 4]

actuals:
  tokens: 0
  tasks: 3
  commits: 7
plan_head_before: 06503367a3fdd7b4d131ad25016b2158d1c1db73
plan_head_after: 74554abb1e08274415c0d0995cdff5ea1c11857f

tech-stack:
  added: []
  patterns:
    - "teste que precisa de banco usa it.skipIf(!hostEhLocal(DATABASE_URL)): o check do CI não tem Postgres e não pode falhar por isso"
    - "CLI de prova imprime só o que é seguro (papel, porta, ms) e recusa vazar a URL em qualquer mensagem de erro"

key-files:
  created:
    - apps/api/src/mensageria/provar-tempo-real.ts
    - apps/api/src/mensageria/provar-tempo-real.cli.ts
    - apps/api/src/mensageria/provar-tempo-real.test.ts
    - apps/api/deploy/provar-nginx.sh
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/16-PROVA-AO-VIVO.md
  modified:
    - apps/api/package.json
    - apps/api/deploy/CONTEXT.md
    - apps/api/src/mensageria/CONTEXT.md
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/deferred-items.md

key-decisions:
  - "Seguir na Evolution 2.4.0 em vez de fixar a 2.3.7 (decisão do dono, 2026-11-09): A1 e A10 provados no --seco e no webhook ao vivo, não por leitura de nota de versão"
  - "A chave global da Evolution (AUTHENTICATION_API_KEY) não entra no .env nem no api.env: só a linha de comando de canal:ligar-evolution a lê. Desvio consciente do texto do plano, herdado de 16-13 e 16-14"
  - "O pré-voo foi fechado em produção, não em ensaio: o dono pediu para publicar e testar direto (ver 16-PROVAS.md, 'Como a prova foi feita')"

requirements-completed: [MSG-03, MSG-06]

coverage:
  - id: D1
    description: "tempo-real:provar mede uma volta de LISTEN/NOTIFY e não vaza a URL do banco"
    verification:
      - kind: other
        ref: "provar-tempo-real.test.ts: 6 testes; contra Postgres 16 local passam os 6, sem banco pulam 4 e rodam 2 (porta sem banco devolve 1 sem a URL; sem DATABASE_URL devolve 2); rodado em produção: papel=n1_api porta=5432 recebido_em_ms=52, 53, 52"
        status: pass
    human_judgment: false
  - id: D2
    description: "A prova do SSE atrás do nginx e o roteiro do dono existem e não carregam segredo"
    verification:
      - kind: other
        ref: "provar-nginx.sh imprime quatro linhas ok (prova 4 prova o caminho, não que X-Accel-Buffering é o que faz funcionar); 16-PROVA-AO-VIVO.md sem chave, token nem telefone"
        status: pass
    human_judgment: true
    rationale: "Se o roteiro é claro o bastante para o dono seguir sozinho é leitura humana; o dono o seguiu, com ajuda, e o resultado está em 16-PROVAS.md"
  - id: D3
    description: "O pré-voo responde: versão da Evolution, SEG-11, evolution.env, A9, A10, --seco"
    verification:
      - kind: other
        ref: "16-PROVAS.md, seção Pré-voo: 2.4.0 ativa, HTTPS 200 e 8080 fechada, DATABASE_SAVE_DATA_INSTANCE=true, A9 em 52 ms pelo pooler de produção, --seco ok na VM"
        status: pass
    human_judgment: false
  - id: D4
    description: "O fluxo /eventos atrás do nginx de produção devolve ': aberto' na hora, com o proxy da VM"
    verification:
      - kind: other
        ref: "não conferido em produção: exige o token de login do dono; só o script de ensaio (quatro linhas ok) e o ouvinte conectado no journal"
        status: unknown
    human_judgment: true
    rationale: "Só o dono tem o token; DevTools, Rede, filtro 'eventos', aba EventStream"

duration: n/d
completed: 2026-11-10
status: complete
---

# Phase 16 Plan 15: Pré-voo contra a Evolution e o banco de produção Summary

**O pré-voo respondeu sem bloqueio: a Evolution 2.4.0 aceita o adaptador, o painel está atrás de HTTPS, e a volta de `LISTEN/NOTIFY` pelo pooler de produção leva cerca de 52 ms (A9 provada). O que o plano chamava de ensaio virou a própria publicação, por pedido do dono.**

## Accomplishments

- **`tempo-real:provar` (Tasks 1 e 2 do plano).** CLI que abre uma conexão pela `DATABASE_URL`, faz `LISTEN`, dispara um `NOTIFY` e mede o tempo. A saída é só `papel=… porta=… recebido_em_ms=…`; nenhuma mensagem de erro carrega a URL. Em produção: `n1_api`, porta 5432, 52 ms em três voltas.
- **`provar-nginx.sh`.** Ensaia o fluxo SSE atrás de um nginx com a mesma configuração da VM e imprime quatro linhas `ok`. A quarta prova o caminho, não que o cabeçalho `X-Accel-Buffering` seja o que faz funcionar; a conferência real é o passo 15 do roteiro, na VM.
- **Roteiro `16-PROVA-AO-VIVO.md`.** Pré-voo, publicação e prova, com os resultados do pré-voo preenchidos (versão, SEG-11, `evolution.env`).
- **Pré-voo (Task 3, o checkpoint do dono).** Evolution 2.4.0 com licença ativa; `fetchInstances` por nome devolve o token da instância mesmo com a exposição desligada; instância `igor-dev` aberta; `canal:ligar-evolution --seco` fecha na VM.

## Task Commits

1. **Task 1: `tempo-real:provar` (teste e implementação)** — `2b24c97` (test), `e335091` (feat)
2. **Task 2: prova do nginx e roteiro** — `3b8ef4f` (feat)
3. **Task 3: pré-voo do dono** — `0bfdb09` (pausa), `efaa76f` e `b7ffeea` (resultados dos passos 1 a 4 e achados), `74554ab` (fix do `check` do CI)

## Deviations from Plan

**1. [Rule 1 - Bug] Quatro testes de `provar-tempo-real.test.ts` falhavam no `check` do CI**
- **Found during:** a publicação, quando o `check` ficou vermelho em `b7ffeea`
- **Issue:** quatro dos seis testes precisam de `DATABASE_URL` de um Postgres local, e o `check` do CI não tem banco
- **Fix:** `it.skipIf(!hostEhLocal(process.env.DATABASE_URL))`, a mesma regra de `describeComBanco`; os dois que não precisam de banco seguem rodando
- **Verified:** sem banco, com Docker (Postgres 16) e numa réplica limpa em UTC; o CI voltou a verde em `74554ab`
- **Committed in:** `74554ab`

**2. Chave global da Evolution fora do `.env`.** Texto do plano a listava no `.env`; 16-13 e 16-14 decidiram que só a linha de comando a lê. Mantido.

**3. Pré-voo e publicação na mesma volta.** O plano 16-15 previa o pré-voo antes de qualquer publicação (T-16-59); o dono mandou publicar e testar em produção. Os passos 5 e 8 do roteiro foram rodados depois, já na VM, e deram verde.

## Issues Encountered

- A primeira rodada de `migrar --seco` deu tempo esgotado (transitório); a segunda respondeu.
- O `SERVER_URL` da Evolution está em http (o campo `manager` da raiz aponta para http). Trocar para https.
- A chave global da Evolution foi colada na conversa pelo dono e precisa ser rotacionada (reiniciar a Evolution é seguro; a instância sobrevive).
- A `acordar()` do `processador-de-entrada` tem um teste de temporização intermitente sob carga (causa não provada).

## Known Stubs

None.

## Threat Flags

None novos. T-16-59 (executor agindo em produção) foi aceito pelo dono por pedido escrito; ver `16-PROVAS.md`.

## Next Phase Readiness

O plano 16-16 e a verificação da fase recebem: Canal "Igor Business" ligado, workers ligados em produção, SHA `74554ab` em toda parte, `16-PROVAS.md` com a prova ao vivo e a decisão do áudio.

## Self-Check: PASSED
