---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 12
subsystem: api
tags: [seguranca, inventario-de-rotas, onRoute, matriz-de-papeis, suspenso, ci, postgres-local, n1-api, seg-12, seg-03]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-07: fabrica espaco-de-vazamento.ts, FRASE_DE_SUSPENSO, recusaDeSuspenso e o 403 do suspenso em POST /operacoes"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-04: a 009 (papel n1_api so DML) e conceder-n1-api, que o job do CI roda como o deploy"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-10: servicos/cofre.test.ts, entra na suite do job seguranca"
provides:
  - "recusarSuspensoNaEscrita (plugins/autenticacao.ts) como hook preValidation nos plugins de Financeiro, anexos da Tarefa e CRM: o suspenso consulta e nao grava em nenhuma familia de rota"
  - "inventario-de-rotas.test.ts: onRoute ouve toda rota e prova 401 sem sessao, 401 com token recusado e 403 do suspenso na escrita, sem banco; ROTAS_PUBLICAS com motivo"
  - "matriz-de-papeis.test.ts: tabela CELULAS Papel x familia (operacoes, CRM contatos, CRM canais, estado, anexos, Financeiro) por HTTP contra Postgres local"
  - "fabrica com membros.convidado e membros.administrador e os tokens; appDoEspaco aceita opcoes extras (financeiro falso)"
  - "job seguranca em .github/workflows/check.yml: Postgres de servico, n1_api como em producao, migrar/banco:conceder pelo dono, falha se nada rodou, se algo falhou ou se algo foi pulado"
  - "poolDoDono() em testes/banco-crm.ts: DDL de teste pelo dono local quando o app roda como n1_api"
affects: [09-15, 09-21]

actuals:
  tokens: 14400
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Inventario por onRoute: o teste ouve as rotas que os plugins declaram; rota nova com JWT nasce coberta, rota publica nova falha ate entrar em ROTAS_PUBLICAS com motivo"
    - "Matriz como dado: CELULAS (as const) e um it.each; controle positivo em cada familia (Membro 201, Proprietario 202 no Financeiro)"
    - "Falha conhecida do dominio: it.fails com a asserção CORRETA, no lugar de afirmar o comportamento inseguro ou pular"
    - "Job de CI com a topologia de producao: dono migra, n1_api roda o app, e o job falha se a suite ficou verde sem rodar"

key-files:
  created:
    - apps/api/src/seguranca/inventario-de-rotas.test.ts
    - apps/api/src/seguranca/matriz-de-papeis.test.ts
  modified:
    - apps/api/src/plugins/autenticacao.ts
    - apps/api/src/rotas/financeiro.ts
    - apps/api/src/rotas/anexos-da-tarefa.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/testes/espaco-de-vazamento.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/seguranca/banco-n1-api.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - .github/workflows/check.yml

key-decisions:
  - "O suspenso da fabrica passou a ser um Membro de Papel base membro (mem_maryane): o unico Administrador do seed (mem_rafael) era o suspenso, e a matriz precisa dos quatro estados ao mesmo tempo."
  - "A matriz ganhou uma celula do Proprietario no Financeiro como controle positivo (202): sem ela, '403 para todos' passaria tambem com a rota quebrada. O Financeiro decide por alcance a Pasta Financeiro (D4-14), nao por Papel; no seed so o Proprietario (e quem tem Concessao em Gestao) a alcanca."
  - "O envio de anexo da Tarefa so tem celulas de recusa: o caminho de sucesso fala com o Storage do Supabase e nao roda em teste local."
  - "Sem it.todo no que o CI executa: o job conta pendente + todo como teste pulado e falha. runLancamentoAgent ficou como comentario no arquivo e neste SUMMARY, nao como todo."
  - "Fora do plano, necessario para o job existir: poolDoDono() em banco-crm.ts e banco-n1-api.test.ts passando a criar banco/papel pelo dono; sem isso a suite inteira falha como n1_api (prepararBancoCrm migra com pool() e o teste da 009 cria banco e papel)."

patterns-established:
  - "Todo plugin REST que grava registra recusarSuspensoNaEscrita na primeira linha; o inventario prova"
  - "Teste que precisa de DDL usa poolDoDono(), nunca pool(), para valer tambem com o app como n1_api"

requirements-completed: [SEG-12, SEG-03]

duration: 10min
completed: 2026-10-23
status: complete
plan_head_before: 708e7fdf7715207287b1f9e6d3744e003ff32bd4
plan_head_after: 15934bbc1a188369715e0f4c68f86ccf587ed319
commits: 5

coverage:
  - id: D1
    description: "Toda rota com JWT (hoje e as que vierem) responde 401 sem Authorization, 401 com token recusado e 403 com a frase do suspenso em metodo de escrita; as rotas sem JWT sao exatamente ROTAS_PUBLICAS; /v1/integrations recusa o JWT de Membro com 401"
    requirement: SEG-12
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/inventario-de-rotas.test.ts (7 testes, DATABASE_URL vazia)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O Membro suspenso deixa de gravar pelas rotas REST de Financeiro, anexos da Tarefa e CRM (hook preValidation recusarSuspensoNaEscrita, antes de validar o corpo)"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/inventario-de-rotas.test.ts#o Membro suspenso recebe 403 em toda rota de escrita com JWT"
        status: pass
      - kind: integration
        ref: "apps/api/src/seguranca/matriz-de-papeis.test.ts (celulas suspenso das seis familias)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Convidado, Membro, Administrador e suspenso recebem, em uma rota de cada familia, o status, ok e codigo que a regra diz (inclui B35, D-02 e o Financeiro por alcance)"
    requirement: SEG-03
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/matriz-de-papeis.test.ts#matriz Papel x familia de rota (26 celulas, Postgres local 55612)"
        status: pass
    human_judgment: false
  - id: D4
    description: "removeMember e spawnNextOccurrence chamados pelo Convidado: asserção do comportamento correto marcada como falha conhecida (it.fails), apontando para 09-09-SUMMARY"
    requirement: SEG-03
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/matriz-de-papeis.test.ts#lacunas conhecidas do dominio (2 expected fail)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Job seguranca no CI: Postgres de servico, n1_api sem superusuario, migracao pelo dono, suite como n1_api, e falha se nada passou, se algo falhou ou se algo foi pulado"
    requirement: SEG-12
    verification:
      - kind: other
        ref: "node -e (yaml) sobre .github/workflows/check.yml: job seguranca, postgres:16, n1_api, create role, src/seguranca, numPendingTests, check sem banco"
        status: pass
      - kind: integration
        ref: "ensaio local dos passos do job num cluster novo (porta 55612): 71 passaram, 0 falharam, 0 pulados, exit 0"
        status: pass
    human_judgment: true
    rationale: "O workflow so roda no GitHub Actions; o ensaio local reproduz os passos, mas a primeira execucao real do job (e a imagem do runner) so se confere depois do push."
---

# Phase 9 Plan 12: Inventário de rotas, matriz de Papéis e o job `seguranca` do CI Summary

**Um hook `onRoute` prova, sem banco, que toda rota com JWT recusa sessão ausente, token recusado e Membro suspenso na escrita; o suspenso passou a ser barrado também no Financeiro, nos anexos da Tarefa e no CRM REST; uma matriz de 26 células prova cada Papel por HTTP contra Postgres; e o job `seguranca` roda tudo como `n1_api` no CI e falha se a suíte não rodou.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-23T02:47:34Z
- **Completed:** 2026-10-23T02:58Z
- **Tasks:** 3
- **Files modified:** 11 (2 criados, 9 alterados)

## Accomplishments

- **O inventário acha sozinho o que faltava.** No RED, o `onRoute` mostrou que o suspenso ainda gravava em 80 rotas de escrita: todo o Financeiro (6 POSTs mais o upload de Extratos), os dois POSTs de anexos da Tarefa e as rotas REST de Contatos, Funis, Empresas, Negócios, Canais, Conversas e Mensagens (nelas só a `podeNoCrm` barrava, com outro código e sem a frase do suspenso; no Financeiro e nos anexos, ninguém). O hook `recusarSuspensoNaEscrita` nos três plugins fechou todas; o teste exige a frase do suspenso, não qualquer 403.
- **Rota nova nasce coberta.** `ROTAS_PUBLICAS` (9 entradas, cada uma com motivo; `/saude` à parte porque nasce síncrona antes do gancho) é comparada com as rotas `publica: true` que o `onRoute` vê: uma rota pública nova falha o teste até ganhar motivo. As de `/v1/integrations` são provadas à parte: JWT de Membro ativo dá 401.
- **A matriz por HTTP.** `CELULAS` cobre `POST /operacoes/trashContact`, `POST /contatos`, `POST /canais`, `GET /estado`, `POST /tarefas/:taskId/anexos/ticket` e `POST /financeiro/workflows/:key/executar` nos quatro estados (mais o Proprietário no Financeiro, como controle positivo). Confere status, `ok`, `codigo`, a frase do suspenso só no suspenso, `agents: []` para o Convidado (D-02), dados no `GET /estado` do suspenso e ausência de `uploadUrl` nas recusas de anexo.
- **O CI deixa de ficar verde sem rodar.** O job `seguranca` sobe `postgres:16`, cria `n1_api` antes da migração, migra e concede pelo dono (`npm run migrar`, `npm run banco:conceder`, o que o deploy faz), roda `src/seguranca`, `cofre.test.ts` e `estado.test.ts` como `n1_api` e, num último passo, lê o JSON do Vitest e sai com 1 se `numPassedTests === 0`, `numFailedTests > 0` ou `numPendingTests + numTodoTests > 0`. Confirmado localmente que, sem banco, o mesmo JSON dá 0 passados e 28 pendentes (o passo derrubaria o job).

## Task Commits

1. **Task 1: inventário de rotas + recusa do suspenso nas rotas REST** — RED `e6ca89f` (test), GREEN `fbca9fb` (feat)
2. **Task 2: matriz Papel × família de rota** — `c264d15` (test); `0a1f817` (test, `spawnNextOccurrence` vira falha conhecida real)
3. **Task 3: job `seguranca` do CI** — `15934bb` (feat)

**Plan metadata:** commit `docs(09-12)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (`tdd="true"` por tarefa) e `workflow.tdd_mode` é `false`; o classificador `tdd-red-evidence` não foi usado. Evidência = saída real do Vitest:

- **Task 1 RED (`e6ca89f`):** com `DATABASE_URL` vazia, 5 de 7 passam e 1 falha pelo motivo planejado: `escritas que o suspenso consegue fazer:` listando `POST /tarefas/:taskId/anexos/ticket -> 400`, `POST /financeiro/... -> 400/500`, `POST /contatos -> 500` e as demais rotas REST (400 por validação do corpo e 500 por chegar ao acesso/banco, em vez de 403). A segunda falha da primeira execução (HEAD espelhando GET público) era erro do teste e foi corrigida antes do commit. GREEN: 7/7.
- **Task 2 (nascida verde):** as células passam no primeiro uso porque o comportamento já existia (09-03, 09-07, B35); "unexpected green" investigado: foi conferido o corpo real de três recusas (ticket: `Você não tem acesso a esta Tarefa.`, Financeiro: `Sem acesso ao Financeiro.`) e que `removeMember` do Convidado volta `200 ok:true` removendo o Membro. Sem o hook da Task 1, as células `suspenso` do CRM e do Financeiro falhariam (código `PERMISSAO` em vez de `SUSPENSO`, ou 202).
- **Falhas conhecidas:** as duas `it.fails` foram viradas para `it` por um instante e falham com `expected true to be false` (a operação devolve `ok: true`), ou seja, a lacuna é real e não erro do teste; arquivo restaurado.

## Verificação

Contra Postgres local `crm-n1-pg-0912` (porta 55612, `postgres:16`), removido ao fim:

- `inventario-de-rotas.test.ts` com `DATABASE_URL` vazia: 7/7. `npx tsc --noEmit` (api) verde; `npm run typecheck` e `npm run lint` da raiz: 0 erros (3 avisos pré-existentes em `apps/web`).
- `matriz-de-papeis.test.ts` como dono: 26 passaram + 2 falhas esperadas, nenhum pulado.
- **Ensaio do job, num cluster novo, passo a passo** (`create role n1_api`; `npm run migrar`; `npm run banco:conceder`; `npx vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts --reporter=default --reporter=json`; o `node -e` do último passo) com `DATABASE_URL=postgres://n1_api:x@…` e `DATABASE_URL_MIGRACAO=postgres://postgres:x@…`: 5 arquivos, **71 passaram, 0 falharam, 0 pulados, exit 0**.
- **Regressão contra `GET /estado` e `POST /operacoes` (a lição de 4aec7b7), como dono:** `src/rotas`, `src/plugins`, `src/servicos`, `src/seguranca`, `src/testes` e os e2e `canais-fluxo`, `criar-conta`, `dois-servicos`, `falhas-injetadas`, `crm-fluxo`: **71 arquivos passaram, 2 pulados; 676 testes passaram, 2 falhas esperadas, 18 pulados, 1 todo (pré-existente), 0 falhas.** Inclui `estado.test.ts` (13/13 com banco) e `operacoes.test.ts`. Não rodado, por ordem do orquestrador: `lote-contas-a-pagar` e `latencia`.
- A regressão `src/rotas` rodada logo no começo, num container ainda sem migração, reprovou `formularios-publicos`, `operacoes` e `integracao-solicitacoes` por `relation "plataforma.registros" does not exist`: efeito de ordem num banco virgem (esses arquivos não chamam `prepararBancoCrm`), não da mudança. Migrado o container, os três passam (63 testes). É o motivo do passo explícito `npm run migrar` no job.

## Files Created/Modified

- `apps/api/src/plugins/autenticacao.ts` — `recusarSuspensoNaEscrita` (403 `SUSPENSO` antes de validar o corpo)
- `apps/api/src/rotas/financeiro.ts`, `anexos-da-tarefa.ts`, `crm/index.ts` — hook `preValidation` na primeira linha do plugin (no CRM, antes dos filhos)
- `apps/api/src/seguranca/inventario-de-rotas.test.ts` — novo: `ROTAS_PUBLICAS`, `PARAMETRO_DE_TESTE`, `CONTEUDO_POR_ROTA`, `ESCRITA_PERMITIDA_AO_SUSPENSO` (vazia)
- `apps/api/src/seguranca/matriz-de-papeis.test.ts` — novo: `CELULAS` e o bloco de lacunas conhecidas
- `apps/api/src/testes/espaco-de-vazamento.ts` — `membros.convidado`/`administrador`, tokens, `appDoEspaco(espaco, extras)`
- `apps/api/src/testes/banco-crm.ts` — `poolDoDono()`; `prepararBancoCrm` migra por ele
- `apps/api/src/seguranca/banco-n1-api.test.ts` — banco e papel descartáveis criados pelo dono
- `apps/api/src/rotas/CONTEXT.md` — o hook e o inventário
- `.github/workflows/check.yml` — job `seguranca`

## Casos marcados como falha conhecida (09-09-SUMMARY)

Dois, ambos em `matriz-de-papeis.test.ts`, bloco "lacunas conhecidas do domínio", com Espaço próprio para a operação perigosa não contaminar a matriz. Cada um escreve o comportamento correto (`ok: false`) e usa `it.fails`:

1. **`removeMember`** (achado 1, grave): o Convidado chama `POST /operacoes/removeMember` e remove outro Membro; resposta real `200 ok:true`, `state: "removido"`.
2. **`spawnNextOccurrence`** (achado 2, médio): o Convidado cria a próxima ocorrência de uma Tarefa recorrente concluída que ele nem enxerga; resposta real `ok:true`.

**Não exercida:** `runLancamentoAgent` (item 3, conferência fraca) exige um Agente com concessão sobre uma Tarefa de lançamento que o seed não tem; fica para 09-15. Não virou `it.todo` porque o job do CI conta todo como teste pulado e falharia. As outras operações de `members.ts` (item 4) também não foram exercidas aqui. O domínio não foi tocado.

## Decisions Made

- O suspenso da fábrica deixou de ser o único Administrador do seed (veja `key-decisions`).
- Controle positivo do Proprietário no Financeiro e células só de recusa nos anexos (veja `key-decisions`).
- O hook é `preValidation`, não `onRequest`: o `request.membro` já existe e a recusa vem antes da validação do corpo, mas depois do parse do conteúdo. Por isso uma rota que só aceita outro tipo de conteúdo (o upload de Extratos) responde 415 a um corpo JSON antes de o hook rodar; `CONTEUDO_POR_ROTA` manda o inventário usar o conteúdo certo, e uma rota nova nessa situação falha o teste com o nome dela.
- O job migra explicitamente pelo dono antes da suíte (o plano só listava papel, suíte e checagem): sem isso `estado.test.ts`, que não chama `prepararBancoCrm`, depende da ordem dos arquivos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A suíte inteira falhava como `n1_api` (DDL de teste pelo app)**
- **Found during:** Task 3 (ensaio local do comando do passo 2)
- **Issue:** `prepararBancoCrm` migrava com `pool()` (a `DATABASE_URL`) e `banco-n1-api.test.ts` criava banco e papéis por ela; como `n1_api` isso dá `permission denied to create database/role` e `relation "plataforma.registros" does not exist`. O próprio plano antecipa a falha em `<fails_when>` ("DDL em teste fora do poolDeMigracao"), mas não lista os dois arquivos em `files_modified`.
- **Fix:** `poolDoDono()` em `testes/banco-crm.ts` (usa `DATABASE_URL_MIGRACAO` só se também for local, preservando a trava de T-07-08); `prepararBancoCrm` e `banco-n1-api.test.ts` passam por ele; `urlDoBanco` do teste da 009 parte da URL do dono.
- **Files modified:** `apps/api/src/testes/banco-crm.ts`, `apps/api/src/seguranca/banco-n1-api.test.ts`
- **Verification:** ensaio do job num cluster novo: 71 passaram, 0 falharam, 0 pulados; regressão com dono inalterada.
- **Committed in:** `15934bb`

**2. [Rule 3 - Blocking] `it.todo` derrubaria o job do CI**
- **Found during:** Task 3
- **Issue:** a primeira versão da matriz marcava `spawnNextOccurrence` e `runLancamentoAgent` com `it.todo`, e a checagem do plano falha com `numPendingTests + numTodoTests > 0`.
- **Fix:** `spawnNextOccurrence` virou um `it.fails` de verdade (Tarefa recorrente concluída montada no estado antes de semear); `runLancamentoAgent` ficou como comentário e neste SUMMARY.
- **Files modified:** `apps/api/src/seguranca/matriz-de-papeis.test.ts`
- **Committed in:** `0a1f817`

**3. [Rule 2 - Crítico] Passo `migrar`/`banco:conceder` no job**
- **Found during:** Task 3
- **Issue:** sem migração prévia, `estado.test.ts` (que não migra) só passa se outro arquivo migrar antes.
- **Fix:** passo explícito "migrar como o dono e conceder ao n1_api", o que o deploy faz (também exercita `banco:conceder`).
- **Files modified:** `.github/workflows/check.yml`
- **Committed in:** `15934bb`

**4. [Ajuste de critério] `grep -c "recusarSuspensoNaEscrita"` = 2, não 1**
- Cada um dos três plugins tem a linha de `import` e a de `addHook`; o critério "= 1" é incompatível com importar o nome. A intenção (o hook está registrado, uma vez, em cada plugin) está cumprida e provada pelo inventário.

**5. Fábrica: suspenso trocado.** `mem_rafael`, o único Administrador do seed, era o suspenso da fábrica; passou a ser `mem_maryane` (Papel base `membro`). Os testes de 09-07 seguem verdes (`estado.test.ts`, `operacoes.test.ts`, `operacoes-suspenso.test.ts`).

**Total deviations:** 3 auto-fixed (2 Rule 3, 1 Rule 2) + 2 ajustes documentados.
**Impact on plan:** todos necessários para o job rodar como `n1_api` e para a suíte não ficar vermelha por motivo de infraestrutura; nenhum desvio de escopo de produto. O domínio não foi tocado.

## Issues Encountered

- A matriz e o inventário mostraram que a barreira do suspenso no CRM REST era só a `podeNoCrm` (código `PERMISSAO`, frase diferente) e que Financeiro e anexos da Tarefa não tinham barreira nenhuma. Corrigido no GREEN da Task 1 (a Open Question 7 da pesquisa).
- `ESLint` não roda por arquivo de fora de `apps/*` (config na raiz do workspace): a checagem foi `npm run lint` da raiz, 0 erros.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo. T-09-58 a T-09-62 mitigadas e provadas (inventário, hook, matriz, job com checagem de pulados, app como `n1_api`). T-09-SC: nenhum pacote instalado; a imagem `postgres:16` já era usada. As duas lacunas do domínio (`removeMember`, `spawnNextOccurrence`) seguem abertas e agora têm um teste que vira vermelho no dia em que forem consertadas.

## User Setup Required

None - no external service configuration required. A primeira execução real do job `seguranca` acontece depois do push (nenhuma chamada ao GitHub foi feita aqui). Teste local: container `crm-n1-pg-0912`, porta 55612, parado e removido ao fim.

## Next Phase Readiness

- **09-15** (segunda metade da suíte adversarial): herda a fábrica com Convidado e Administrador, `appDoEspaco(espaco, extras)`, o inventário e o job. Falta provar `runLancamentoAgent` e as operações de `members.ts` (itens 3 e 4 de 09-09), e repetir o Arquivo órfão com o Convidado.
- Quem consertar `removeMember` ou `spawnNextOccurrence` no domínio verá os dois `it.fails` falharem e deve trocá-los por `it`.
- Rota nova com JWT: coberta sozinha. Rota nova pública: entra em `ROTAS_PUBLICAS` com motivo.

## Self-Check: PASSED

Arquivos criados existem (`inventario-de-rotas.test.ts`, `matriz-de-papeis.test.ts`); commits `e6ca89f`, `fbca9fb`, `c264d15`, `0a1f817` e `15934bb` estão no histórico; `recusarSuspensoNaEscrita` presente nos três plugins e exportada de `autenticacao.ts`; `grep -c "seguranca:"` = 1 e `"image: postgres:16"` = 1 em `check.yml`; `grep -c "CELULAS"` na matriz ≥ 2; verificação YAML do plano retorna 0; container `crm-n1-pg-0912` removido e nenhum processo iniciado por este plano segue rodando.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
