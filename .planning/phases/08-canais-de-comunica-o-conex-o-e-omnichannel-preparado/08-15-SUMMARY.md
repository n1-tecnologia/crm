---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 15
subsystem: docs-e-portao
tags: [documentacao, portao, uat, canais, caixa-de-entrada, provas]

requires:
  - phase: 08-14
    provides: 008 aplicada no banco da plataforma (0 pendentes) e 08-PROVAS.md com a decisao, a conferencia e a aplicacao
  - phase: 08-08
    provides: jornada de conexao de Canal (quatro cartoes, passos, formulario)
  - phase: 08-09
    provides: ficha do Canal por REST com "Simular conexao" marcada
  - phase: 08-10
    provides: fio da Conversa por Canal, "Responder por"
  - phase: 08-11
    provides: lista da Caixa de Entrada por Canal
provides:
  - CONTEXT.md da raiz e apps/web/CONTEXT.md descrevendo a Fase 8
  - Portao da fase (npm run check e npm run build) registrado em 08-PROVAS.md, contra o banco da plataforma com a 008
  - Roteiro da UAT de fim de fase (dez passos, Resultado em branco) e 14 Limitacoes aceitas
  - deferred-items.md da Fase 8
affects: [verificacao da fase 08, UAT do dono, fase de unificacao, qualquer ajuste de schema da Caixa de Entrada (009)]

tech-stack:
  added: []
  patterns:
    - "Portao registrado sem maquiagem: terceira falha fora da lista aceita e re-executada isolada e anotada com as duas execucoes"
    - "Suites com describeComBanco que pulam contra o banco remoto sao re-executadas uma vez num Postgres 16 descartavel e o resultado entra nas provas"

key-files:
  created:
    - .planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/deferred-items.md
  modified:
    - CONTEXT.md
    - apps/web/CONTEXT.md
    - .planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md
    - .planning/WINDOWS.md

key-decisions:
  - "O portao NAO e registrado como verde limpo: alem das duas falhas pre-existentes aceitas, colunas-geradas.test.ts falhou uma vez no check completo (empate de vencimento sem desempate) e passou 8/8 isolado; fica em deferred-items.md e como janela de deviation no WINDOWS.md"
  - "As suites de banco do CRM e da Caixa de Entrada que pulam contra o Supabase (198 testes) foram re-executadas num Postgres 16 descartavel: 23 arquivos, 319 testes verdes"
  - "O resultado da UAT entra em 'Fica com o dono' (item 7) e a UAT aberta vira janela unrun-verify #6 no WINDOWS.md"

patterns-established:
  - "Roteiro da UAT com duas tabelas: os passos funcionais e, ao lado, 'o que olhar com olho humano' mapeando cada conferencia visual ao plano que a deixou"

requirements-completed: [CXE-V1, CXE-W1, CXE-W2]

actuals:
  tokens: 7000
  tasks: 3
  commits: 3
plan_head_before: 7084b45013e8807f2a7a0c2538efe1c4c4ac0419
plan_head_after: 796f73c537212c324ed367238e7cc504e9835292

coverage:
  - id: D1
    description: "CONTEXT.md da raiz e apps/web/CONTEXT.md descrevem a Fase 8 (008, rotas /canais /conversas /mensagens, provedor no Canal, Canal novo desconectada, popup legado conectada, ponte em GET /estado e executar(), chat por Canal, pecas web)"
    requirement: "CXE-V1"
    verification:
      - kind: other
        ref: "grep -c '008-canais-conversas-mensagens' CONTEXT.md (1) && grep -c 'dados/crm/canais' apps/web/CONTEXT.md (1); conectar-provedor e 'Responder por' presentes no web"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run check e npm run build rodados contra o banco da plataforma com a 008; resultado por workspace e arquivos que falharam registrados em 08-PROVAS.md 'Portao'"
    requirement: "CXE-V1"
    verification:
      - kind: integration
        ref: "npm run check: typecheck/lint/tokens/contratos verdes; web 546/546, dominio 1785/1785, api 1214 passam, 6 falham em 3 arquivos (2 pre-existentes aceitos + colunas-geradas flaky, 8/8 isolado); NAO verde limpo, registrado como tal"
        status: pass
      - kind: integration
        ref: "npm run build exit 0, rotas /conectar e /conectar/[provedor] listadas; git grep dangerouslySetInnerHTML= vazio (exit 1)"
        status: pass
      - kind: integration
        ref: "vitest run canais conversas mensagens crm contato-com 008 contra Postgres 16 descartavel: 23 arquivos, 319 testes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Roteiro da UAT (dez passos, Resultado em branco), conferencias visuais dos planos 08-01/02/08/09/10/11 e Limitacoes aceitas em 08-PROVAS.md; secoes de 08-14 intactas"
    requirement: "CXE-W1, CXE-W2"
    verification:
      - kind: other
        ref: "grep -c '## Roteiro da UAT|## Limitacoes aceitas' 08-PROVAS.md (3, inclui a referencia em 'Fica com o dono'); git diff --numstat 7084b45..HEAD -- 08-PROVAS.md = 248 linhas adicionadas, 0 removidas"
        status: pass
    human_judgment: false
  - id: D4
    description: "UAT de fim de fase no app real: dois WhatsApps (Comercial oficial, Suporte nao oficial) conectados pela pagina nova, simulados, vistos na lista com selo e origem, no fio como duas abas, com 'Responder por' e envio livre pelo nao oficial; aparencia dos cartoes, passos, faixa de simulacao, selos, abas e meta do item"
    requirement: "CXE-W1, CXE-W2"
    verification: []
    human_judgment: true
    rationale: "Depende de JWT real do Supabase, navegador e banco da plataforma com a 008, e o visual (hierarquia, legibilidade, truncamento) nao e afirmado por nenhum teste; o dono preenche a coluna Resultado. Janela unrun-verify #6 aberta no WINDOWS.md"

duration: 22min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 15: Fechamento da fase, portao e roteiro da UAT Summary

**A Fase 8 esta documentada nos dois CONTEXT.md, o portao completo rodou contra o banco da plataforma com a 008 (web 546/546, dominio 1785/1785, api com so as duas falhas pre-existentes mais uma instabilidade nova e isolada) e o roteiro da UAT dos dois WhatsApps lado a lado espera o resultado do dono.**

## Performance

- **Duration:** ~22 min (14 min so do `npm run check`)
- **Started:** 2026-10-12T22:05Z
- **Completed:** 2026-10-12T22:26Z
- **Tasks:** 3
- **Files modified:** 5 (1 criado)

## Accomplishments

- **Task 1.** `CONTEXT.md` da raiz ganhou o paragrafo "A partir da Fase 8" (008, `plataforma.canais/conversas/mensagens`, rotas `/canais` `/conversas` `/mensagens`, provedor e `capacidadesDoCanal`, Canal novo `desconectada` com "Simular conexao" marcada, popup de Lista como caminho legado `conectada`, projecao em `GET /estado` e `executar()` nunca em `hidratar()`, a 008 imutavel e a `009`). `apps/web/CONTEXT.md` ganhou a "terceira fronteira": `dados/crm/canais.ts`, as paginas `conectar/` e `conectar/[provedor]` com `features/crm/conectar-provedor.tsx`, a ficha por REST so para Canal relacional, selo/seletor/separador e o chat por Canal ("o chat segue no store; so a conexao e a ficha falam REST").
- **Task 2.** `npm run check` rodou uma vez inteiro (836,71 s so o `@n1/api`). Tipos, lint (0 erros, 3 avisos pre-existentes), tokens (445 definidos, 0 falhas) e contratos verdes; `@n1/web` 60 arquivos / 546 testes; `@n1/dominio` 83 / 1785; `@n1/api` 133 arquivos (3 falharam, 115 passaram, 15 pulados), 1419 testes (6 falharam, 1214 passaram, 198 pulados, 1 todo). `npm run build` exit 0 com as duas rotas novas de conexao listadas; o grep de seguranca saiu vazio.
- **Task 3.** `08-PROVAS.md` ganhou "Roteiro da UAT" (dez passos com Resultado em branco, mais a tabela do que julgar visualmente por plano de origem) e "Limitacoes aceitas" (14 itens); "Fica com o dono" ganhou o item 7, o resultado da UAT. As secoes de 08-14 seguem intactas (0 linhas removidas).

## Task Commits

1. **Task 1: CONTEXT da raiz e do web com a Fase 8** - `79304b6` (docs)
2. **Task 2: portao da fase 8, check, build e grep de seguranca** - `58615b2` (chore)
3. **Task 3: roteiro da UAT e limitacoes aceitas** - `796f73c` (docs)

**Plan metadata:** commit `docs(08-15): complete ...` a seguir (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `CONTEXT.md` - paragrafo "A partir da Fase 8" em "Estado atual"
- `apps/web/CONTEXT.md` - a terceira fronteira (Canal relacional por REST) e as pecas web da fase
- `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md` - "Portao", "Roteiro da UAT", "Limitacoes aceitas", item 7 de "Fica com o dono"
- `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/deferred-items.md` - o empate de vencimento de `colunas-geradas.test.ts`
- `.planning/WINDOWS.md` - janela #6 (`unrun-verify`, a UAT) e #7 (`deviation`, o portao), ambas abertas

## Decisions Made

- O portao nao e registrado como verde limpo (ver Deviations).
- As suites de banco que pulam contra o Supabase foram re-executadas num Postgres 16 descartavel (`crm-n1-pg-0815`, porta 55595, removido depois) para o "pulado" nao passar por "provado": 23 arquivos, 319 testes verdes.
- O Portao e o roteiro foram escritos em `08-PROVAS.md` sem `DATABASE_URL`, host ou senha (a URL do container descartavel e a unica citada, sem relacao com a plataforma).

## Deviations from Plan

### Auto-fixed Issues

Nenhum codigo foi alterado.

### Gate result differs from the plan's expectation

**1. [Rule 1 - Bug, out of scope] `colunas-geradas.test.ts` falhou no `check` completo e nao e uma das duas falhas aceitas**
- **Found during:** Task 2
- **Issue:** "due_date: coluna gerada ordena como dueDate.value" comparou a ordem do `select ... order by due_date` com a do sort em JS; tres Tarefas de mesmo vencimento (`tsk_cp_aluguel_out`, `tsk_cp_condominio`, `tsk_cp_energia`) vieram em ordem diferente porque a consulta nao tem desempate.
- **Investigation:** o arquivo e a migracao 002 nao foram tocados pela Fase 8 (ultimo commit `0c1a26b`, Plan 01-06) e o teste nao le `plataforma.canais`. Re-executado sozinho, no mesmo checkout e `.env`: 8/8 passam. Nenhum arquivo de Canal, Conversa, Mensagem, ponte ou `estado.test.ts` falhou; `outbox-worker.test.ts` passou em serie.
- **Fix:** nenhum no codigo (fora de escopo, causada por dados do banco compartilhado). Registrado em `08-PROVAS.md` ("Portao", com as duas execucoes), em `deferred-items.md` da Fase 8 (correcao sugerida: `order by due_date, id` e o mesmo desempate no sort) e como janela `deviation` #7 no `WINDOWS.md`.
- **Files modified:** nenhum de codigo
- **Commit:** `58615b2`

**Total deviations:** 1 (nao e regressao da fase; o portao fica registrado como "nao verde limpo"). **Impact:** o criterio "so as duas falhas pre-existentes" nao foi cumprido ao pe da letra; a decisao de aceitar a terceira como instabilidade, ou corrigi-la antes de fechar a fase, fica com o dono/verificador.

## Issues Encountered

- O `npm run check` terminou com exit 1 por causa das tres falhas acima; web e dominio rodaram normalmente depois do `@n1/api` (o `npm run test --workspaces` nao para na primeira falha).
- O `sed -i` do BSD recusou a forma GNU usada para corrigir um typo; corrigido por script Python, sem efeito no conteudo.

## Verification

- Task 1: `grep -c "008-canais-conversas-mensagens" CONTEXT.md` = 1; `grep -c "dados/crm/canais" apps/web/CONTEXT.md` = 1; `desconectada`, `GET /estado`, `/canais` no raiz; `conectar-provedor` e `Responder por` no web.
- Task 2: `npm run build` exit 0; rotas `/crm/caixa-de-entrada/configuracoes/canais/conectar` e `/conectar/[provedor]` na listagem; `git grep -n "dangerouslySetInnerHTML=" -- apps/web/src/features/crm "apps/web/src/app/(shell)/crm/caixa-de-entrada"` sem saida (exit 1). `npm run check`: exit 1, ver Deviations.
- Task 3: `## Roteiro da UAT` com dez linhas de passo e Resultado em branco; `## Limitações aceitas` com os itens da acao; `git diff --numstat 7084b45..HEAD -- 08-PROVAS.md` = `248 0`.
- Gate de ID compartilhado (`requirements.ready-ids`): `3/3 requirement(s) ready to mark complete` (CXE-V1, CXE-W1, CXE-W2; 08-15 e a ultima das planos que declaram CXE-V1). Os tres foram marcados concluidos em REQUIREMENTS.md.

## Known Stubs

Nenhum introduzido. O "Simular conexao" (conexao marcada, sem provedor real) e decisao documentada de 08-09/08-03, nao um stub deste plano.

## Threat Flags

Nenhuma superficie nova: o plano so escreve documentacao e roda o portao. T-08-55 mitigado (a terceira falha esta nomeada, com a razao e as duas execucoes; o portao nao e dado como verde); T-08-56 mitigado (grep de HTML cru vazio); T-08-57 mitigado (so resumos do vitest, nomes de arquivo e lista de rotas; nenhum segredo).

## Next Phase Readiness

Fase 8 com os 15 planos executados. Pendente: verificacao da fase (verificador, revisao, regressao), a decisao do dono sobre a terceira falha do portao e o preenchimento da coluna "Resultado" do Roteiro da UAT em `08-PROVAS.md`.

## Self-Check: PASSED

- FOUND: `CONTEXT.md`, `apps/web/CONTEXT.md`, `08-PROVAS.md`, `deferred-items.md`
- FOUND: commits `79304b6`, `58615b2`, `796f73c` (ancestrais de HEAD)
- Portao: registrado com a verdade (nao verde limpo); o PASSED acima refere-se a existencia dos artefatos e commits, nao a um portao verde
