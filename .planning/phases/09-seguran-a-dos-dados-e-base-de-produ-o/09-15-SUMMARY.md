---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 15
subsystem: api
tags: [seguranca, suite-adversarial, vazamento, anexos, segredo-de-link, xff, trust-proxy, entrada-hostil, postgres-local, n1-api, seg-12, seg-01]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-12: job seguranca no CI, fabrica com Convidado e Administrador, matriz de Papeis, it.fails das lacunas do dominio"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-07: recorte de GET /estado e POST /operacoes, R3 do Arquivo orfao, segredos de link"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-09: tabela Quem pode e os achados de operacao sem conferencia"
provides:
  - "montarSegundoEspaco / semearSegundoEspaco / limparSegundoEspaco: um segundo Espaco sem Usuario em comum, com frase unica numa Sessao de Chat e numa Tarefa e um Contato em plataforma.contatos"
  - "dados-de-outro-membro.test.ts: B, Convidado e Administrador nao recebem frase de A por GET /estado nem por POST /operacoes; Convidado sem as cinco colecoes de IA; 403 e 404 entre Espacos com o resolvedor de Membro REAL (SQL por workspace_id)"
  - "anexos.test.ts: Arquivo orfao de A e anexo de conta de Gestao dao 404 a quem nao alcanca (Storage dublado, sem rede)"
  - "segredos-publicos.test.ts: 404 uniforme byte a byte (inexistente, malformado, desativado) e 429 com Retry-After nas duas rotas publicas"
  - "xff-e-trust-proxy.test.ts: o IP do balde e o que o nginx anexou a direita do XFF; XFF ignorado fora do loopback e com trustProxy vazio"
  - "entrada-hostil.test.ts: 413, 415, aninhamento 5.000 niveis, __proto__ e constructor.prototype em 4xx, nunca 500, nunca o banco"
  - "lacunas-do-dominio.test.ts: members.ts, stopTimer e runLancamentoAgent chamados por quem nao pode; runLancamentoAgent do Convidado marcado como falha conhecida"
  - "text/plain deixa de ter parser no app (415 em vez de 400 depois de ler o corpo)"
affects: [09-21]

actuals:
  tokens: 14200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Prova de vazamento sempre no resposta.body inteiro, com controle positivo (A recebe as frases de A) ao lado do negativo"
    - "Resolvedor de Membro real (membroPorUsuario) no teste de cruzamento entre Espacos: o isolamento por workspace_id e do SQL, nao de um dublê"
    - "Entrada hostil: pool() trocado por funcao que lanca e capturarErro espiado em afterEach; qualquer caso que toque o banco ou vire 500 falha"
    - "Falha conhecida do dominio: it.fails com a asserção CORRETA e comentario apontando para 09-09-SUMMARY"

key-files:
  created:
    - apps/api/src/seguranca/dados-de-outro-membro.test.ts
    - apps/api/src/seguranca/anexos.test.ts
    - apps/api/src/seguranca/segredos-publicos.test.ts
    - apps/api/src/seguranca/xff-e-trust-proxy.test.ts
    - apps/api/src/seguranca/entrada-hostil.test.ts
    - apps/api/src/seguranca/lacunas-do-dominio.test.ts
  modified:
    - apps/api/src/testes/espaco-de-vazamento.ts
    - apps/api/src/app.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "O teste de cruzamento entre Espacos monta o app com o resolvedor REAL (membroPorUsuario), nao com o dublê de appDoEspaco: o 403 'nao e Membro deste Espaco' vem do SQL por workspace_id + userId, e e isso que precisa ficar provado."
  - "O Storage e dublado em anexos.test.ts (vi.mock de urlDeDownload): os casos que passam da autorizacao devolvem 200 com URL de mentira, sem chamar o Supabase."
  - "text/plain passou a ser 415: o parser embutido do Fastify lia o corpo como texto e o schema recusava com 400. O plano exige 415; nenhuma rota usa text/plain, entao o parser foi removido na raiz do app."
  - "As lacunas de 09-09 que 09-12 deixou para este plano ganharam arquivo proprio (lacunas-do-dominio.test.ts), fora de files_modified do plano, porque a ordem do orquestrador as pedia e nenhum dos cinco arquivos previstos era o lugar delas."
  - "inviteMember NAO foi exercida: o caminho SERVICOS resolve e-mail no Supabase Auth (rede) e a suite nao monta dublê do servico de convite."

patterns-established:
  - "Cada recusa de operacao do dominio e provada por HTTP e pelo que ficou GRAVADO no Postgres, nao so pela resposta"
  - "Teste de rota publica sob forca bruta usa criarLimiteDeTaxa pequeno injetado e remoteAddress do inject como par TCP"

requirements-completed: [SEG-12, SEG-01]

duration: 12min
completed: 2026-10-23
status: complete
plan_head_before: ba0f3cb96e13c903316ca6ee1b591b4706881a70
plan_head_after: 8a0ec7223445668f92fe4b37ef2987105cac996e
commits: 4

coverage:
  - id: D1
    description: "B, o Convidado e o Administrador nao recebem por GET /estado nem por POST /operacoes (corpo inteiro) as frases privadas de A; o Convidado recebe vazias as cinco colecoes de IA; o Administrador le o e-mail do convite"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/dados-de-outro-membro.test.ts (15 testes, Postgres local 55615, como n1_api)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Usuario que so e Membro do segundo Espaco recebe 403 no primeiro; o GET /estado de A nao tem frase do segundo; Contato do segundo Espaco da 404 pelo app do primeiro"
    requirement: SEG-12
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/dados-de-outro-membro.test.ts#vazamento entre Espacos de Trabalho (6 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Arquivo orfao de A da 404 ao Convidado e a B; anexo de conta de Gestao da 404 a quem nao a ve; criador, Administrador e Proprietario passam da autorizacao"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/anexos.test.ts (13 testes; mutacao: sem membroVeArquivo na rota, 8 falham)"
        status: pass
    human_judgment: false
  - id: D4
    description: "20 segredos aleatorios, o link desativado e o malformado dao o mesmo 404; o mesmo IP passa do limite e recebe 429 com Retry-After, nas rotas de Formulario e de Tarefa"
    requirement: SEG-12
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/segredos-publicos.test.ts (8 testes, DATABASE_URL vazia; mutacao: 404 diferente para desativado, 1 falha)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O XFF forjado nao cria balde novo com trustProxy loopback; fora do loopback ou com trustProxy vazio o XFF e ignorado"
    requirement: SEG-12
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/xff-e-trust-proxy.test.ts (5 testes, DATABASE_URL vazia)"
        status: pass
    human_judgment: false
  - id: D6
    description: "POST /operacoes/:nome com 2 MiB (413), text/plain (415), aninhamento 5.000 niveis (400) e __proto__ (400): nunca 500, nunca o banco"
    requirement: SEG-12
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/entrada-hostil.test.ts (8 testes, DATABASE_URL vazia)"
        status: pass
    human_judgment: false
  - id: D7
    description: "alterarPapelDoMembro, grantGovernanceAccess, deleteRole, alterarEmailDoConvite e stopTimer recusam Convidado e Membro e o Postgres fica intacto; runLancamentoAgent do Convidado e falha conhecida"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/lacunas-do-dominio.test.ts (7 passam + 1 expected fail)"
        status: pass
    human_judgment: false
  - id: D8
    description: "O conjunto do job seguranca (src/seguranca, cofre, estado) roda inteiro como n1_api, sem falha e sem teste pulado"
    requirement: SEG-12
    verification:
      - kind: integration
        ref: "vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts como n1_api na 55615: 11 arquivos, 128 testes, 0 falhas, 0 pendentes, 0 todo (125 passam + 3 expected fail)"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 15: Suíte adversarial, segunda metade Summary

**Outro Membro, outro Espaço, anexo inalcançável, segredo de link sob força bruta, XFF forjado e entrada hostil provados por HTTP dentro do job `seguranca`; a prova achou que `text/plain` virava 400 em vez de 415 (corrigido) e mediu que o Convidado dispara o Agente de lançamento (falha conhecida do domínio).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-23T10:40:49Z
- **Completed:** 2026-10-23T10:52Z
- **Tasks:** 2 (mais um arquivo de lacunas do domínio pedido pelo orquestrador)
- **Files modified:** 9 (6 testes novos, 3 alterados)

## Accomplishments

- **Segundo Espaço na fábrica.** `montarSegundoEspaco` parte de `buildSeed()`, troca o `userId` de todo Membro por `usr_ws2_<8>` e põe `FRASE-OUTRO-ESPACO-<uuid>` numa Sessão de Chat e no título de uma Tarefa; `semearSegundoEspaco` grava o estado e o Contato direto em `plataforma.contatos`; `limparSegundoEspaco` apaga tudo.
- **Cruzamento entre Espaços com o resolvedor real.** O teste monta dois apps (um por `workspaceId`) com `membroPorUsuario` do banco: o Usuário que só existe no segundo recebe 200 e a frase dele no segundo, 403 "não é Membro deste Espaço" no primeiro (GET e escrita), e o Contato do segundo dá 404 pelo app do primeiro, com um Contato do primeiro dando 200 como controle.
- **Vazamento entre Membros repetido no job.** B, Convidado e Administrador sem nenhuma frase, id de Sessão, pasta, execução ou Visão de A no corpo inteiro; Convidado com `agents`, `automations`, `documents`, `collections` e `skills` vazios, e B com Agentes (controle); Administrador com o e-mail do convite; `POST /operacoes/setTaskFieldValue` de B sem o segredo do link nem frase de A.
- **Anexo inalcançável.** O Arquivo órfão de A: 404 para o Convidado e para B (mesmo corpo do Arquivo inexistente), 200 para A, não-404 para o Administrador. O anexo de uma conta de Gestão: 404 para quem não vê a conta (Convidado, A, B, Administrador), 200 para o Proprietário. Mutação feita: tirar `membroVeArquivo` da rota derruba 8 testes.
- **Enumeração e força bruta.** 20 segredos aleatórios, o link desativado e o malformado dão o mesmo 404 byte a byte, nas duas rotas públicas (Formulário e Tarefa); a sexta chamada do mesmo IP é 429 com `Retry-After` inteiro; estourado o limite, nem o segredo certo passa. Mutação feita: um corpo diferente para o Formulário desativado derruba o teste.
- **XFF.** Com `trustProxy: "loopback"` o balde é o IP anexado à direita (provado pelo `request.ip` numa rota de prova e pelo 429); variar a esquerda não cria balde; com o par fora do loopback o XFF é ignorado; com `trustProxy` vazio também.
- **Entrada hostil.** 2 MiB: 413; `text/plain`: 415; `application/x-www-form-urlencoded` e `application/xml`: 415; 5.000 níveis: 400 sem stack nem `RangeError` no corpo; `__proto__` e `constructor.prototype`: 400 sem poluir `Object.prototype`. Um `afterEach` falha o caso se `pool()` foi chamada ou se `capturarErro` (o 500) foi chamado.

## Task Commits

1. **Task 1: Outro Membro, outro Espaço e anexo inalcançável** — `cb46b09` (test)
2. **Task 2: segredo de link e XFF** — `3ce511d` (test)
3. **Task 2: entrada hostil + `text/plain` em 415** — `e397785` (feat)
4. **Lacunas do domínio deixadas por 09-12** — `8a0ec72` (test)

**Plan metadata:** commit `docs(09-15)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (`tdd="true"` por tarefa) e `workflow.tdd_mode` não está ligado; o classificador `tdd-red-evidence` não foi usado. Evidência = saída real do Vitest:

- **`dados-de-outro-membro`:** 1 falha no primeiro uso (14 de 15), erro do TESTE (o id do Contato criado vem em `dados.contato.id`); corrigido antes do commit. As demais nasceram verdes porque 09-07 já fechou os vazamentos: "unexpected green" investigado com mutação (veja `anexos`).
- **`anexos`:** nascido verde; mutação (remover `membroVeArquivo` de `rotas/estado.ts`, depois `git checkout -- apps/api/src/rotas/estado.ts`) derruba 8 dos 13 testes.
- **`segredos-publicos`:** nascido verde; mutação em `rotas/formularios-publicos.ts` (corpo diferente para o Formulário desativado, depois restaurado) derruba o caso dos 20 aleatórios.
- **`xff-e-trust-proxy`:** nascido verde (as quatro afirmações de IP e de balde passam).
- **`entrada-hostil` RED real:** `content-type: text/plain` respondeu `400 {"error":"Entrada inválida: Invalid input: expected object, received string"}` em vez de 415. Semanticamente é a falha planejada (alvo: o caso "text/plain: 415", asserção de status); não é erro de fixture. GREEN: `app.removeContentTypeParser("text/plain")`, 8 de 8.
- **`lacunas-do-dominio`:** o caso de `runLancamentoAgent` falhou na primeira execução com `ok: true, value: "Resumo de pagamento já publicado"` (a conta escolhida já tinha Resumo, a operação voltou cedo: prova rasa); trocada por uma conta sem Resumo, a resposta real passou a ser `ok: true, "Resumo publicado: TRIA · Prestação serviços - ADM (2.04.08)"` com o Comentário gravado. Isso confirma a lacuna; o caso virou `it.fails`.

## Casos marcados como falha conhecida (`it.fails`, 09-09-SUMMARY)

Três no conjunto do job; um é novo neste plano.

1. **`removeMember`** (09-09 achado 1, grave) — `matriz-de-papeis.test.ts` (09-12), inalterado. O Convidado remove outro Membro.
2. **`spawnNextOccurrence`** (09-09 achado 2, médio) — `matriz-de-papeis.test.ts` (09-12), inalterado.
3. **`runLancamentoAgent`** (09-09 item 3) — **NOVO**, `lacunas-do-dominio.test.ts`, bloco "runLancamentoAgent". O Convidado com `ver` na conta de Gestão (concessão acrescentada no estado da fábrica, porque o seed não dá nenhuma Tarefa ao Convidado) chama `POST /operacoes/runLancamentoAgent` com `agt_lancamento` e a operação responde `ok: true`, publicando o Resumo de pagamento como Comentário da conta e gravando a Execução. A asserção correta (recusa e nenhuma Execução nova no banco) está escrita e falha hoje. O Agente de lançamento vê 96 Tarefas (inclui as de Gestão), então o cenário é possível no seed com uma Concessão `ver`; `automationId` (`aut_revisao`) não é conferido pela operação.

## Operações de `members.ts` e `stopTimer` (09-09 item 4): exercidas, sem lacuna

`alterarPapelDoMembro`, `grantGovernanceAccess` (escalada: o Convidado se concede `administrar`), `deleteRole`, `alterarEmailDoConvite` recusam Convidado e Membro (`ok: false`) e o Postgres fica intacto (Papel, contagem de Concessões, Papel existente, e-mail do convite); o Administrador altera o e-mail do convite como controle positivo. `stopTimer` de outro Membro dá `ok: false` e a entrada de A segue aberta no banco; o dono fecha o próprio (controle).

**Não exercida:** `inviteMember`. O caminho `SERVICOS` resolve e-mail para Usuário no Supabase Auth (rede) e esta suíte não monta dublê do serviço de convite; tocar a rede real para isso não é permitido neste plano. O Suspenso nessas operações continua coberto pelo 403 de rota (`inventario-de-rotas` e a matriz).

## Verificação

Contra Postgres local `crm-n1-pg-0915` (porta 55615, `postgres:16`), removido ao fim:

- **Conjunto do job `seguranca` como `n1_api`** (`npm run migrar` + `npm run banco:conceder` pelo dono, depois `vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts` com JSON): 11 arquivos, **128 testes: 125 passam + 3 expected fail; 0 falhas, 0 pendentes, 0 todo** (o passo de checagem do job passaria).
- **Os três arquivos "sem banco" com `DATABASE_URL=`:** `segredos-publicos`, `xff-e-trust-proxy`, `entrada-hostil`: 3 arquivos, 21 testes passam.
- **Suíte inteira de `apps/api` (menos `lote-contas-a-pagar` e `latencia`), a lição de 4aec7b7:**
  - **Como dono:** 147 arquivos, 145 passaram + 2 pulados; **1561 passaram, 3 expected fail, 21 pulados, 1 todo (pré-existente), 0 falhas**. Inclui os e2e `canais-fluxo`, `criar-conta`, `crm-fluxo`, `dois-servicos`, `falhas-injetadas` e a mudança em `app.ts`.
  - **Como `n1_api`:** 141 passaram, 2 pulados, **4 falhas, todas de testes que fazem DDL por `pool()` e já eram assim antes deste plano** (veja Issues).
- `npx tsc --noEmit` (api) e `npm run typecheck` da raiz verdes; `npm run lint` da raiz: 0 erros (3 avisos pré-existentes em `apps/web`; `apps/api` não tem ESLint).

## Files Created/Modified

- `apps/api/src/testes/espaco-de-vazamento.ts` — `SegundoEspaco`, `montarSegundoEspaco`, `semearSegundoEspaco`, `limparSegundoEspaco`
- `apps/api/src/seguranca/dados-de-outro-membro.test.ts` — vazamento entre Membros e entre Espaços
- `apps/api/src/seguranca/anexos.test.ts` — Arquivo órfão e anexo de Gestão (Storage dublado)
- `apps/api/src/seguranca/segredos-publicos.test.ts` — 404 uniforme e 429 nos links públicos
- `apps/api/src/seguranca/xff-e-trust-proxy.test.ts` — XFF contra `trustProxy`
- `apps/api/src/seguranca/entrada-hostil.test.ts` — 413, 415, aninhamento, `__proto__`
- `apps/api/src/seguranca/lacunas-do-dominio.test.ts` — `members.ts`, `stopTimer`, `runLancamentoAgent`
- `apps/api/src/app.ts` — remove o parser embutido de `text/plain`
- `apps/api/src/rotas/CONTEXT.md` — o parágrafo da entrada hostil e do IP forjado

## Decisions Made

Veja `key-decisions` no frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Crítico] `text/plain` em `POST /operacoes` voltava 400, não 415**
- **Found during:** Task 2 (`entrada-hostil.test.ts`)
- **Issue:** o Fastify 5 traz um parser embutido de `text/plain` que entrega o corpo como texto; o schema do corpo recusava depois, com 400. O plano e a mitigação T-09-81 pedem 415 (tipo de conteúdo recusado antes do schema). Nenhuma rota recebe `text/plain` (JSON é `application/json`, o webhook da Meta registra o próprio parser, o Extrato é binário).
- **Fix:** `app.removeContentTypeParser("text/plain")` na raiz de `buildApp`, com comentário; parágrafo em `rotas/CONTEXT.md`.
- **Files modified:** `apps/api/src/app.ts`, `apps/api/src/rotas/CONTEXT.md` (nenhum dos dois em `files_modified` do plano)
- **Verification:** `entrada-hostil.test.ts` 8/8; suíte inteira de `apps/api` como dono: 0 falhas.
- **Committed in:** `e397785`

**2. [Escopo adicional pedido pelo orquestrador] `lacunas-do-dominio.test.ts`**
- Os itens 3 e 4 de 09-09 ("deixados para 09-15") não cabiam em nenhum dos cinco arquivos previstos; ganharam um sexto arquivo. Nenhum domínio foi tocado.
- **Committed in:** `8a0ec72`

**3. [Ajuste de critério] A fábrica ganhou três funções, não uma**
- O contrato de `<interfaces>` pede `montarSegundoEspaco`; para o Contato entrar no banco e sair dele, vieram `semearSegundoEspaco` e `limparSegundoEspaco` (a limpeza reaproveita `limparEspaco`, que já apaga `contatos`). `grep -c "export function montarSegundoEspaco"` = 1.

**Total deviations:** 1 auto-fixed (Rule 2) + 2 ajustes documentados.
**Impact on plan:** a correção de `text/plain` fecha uma mitigação que o plano declara; o resto é aditivo. O domínio não foi tocado.

## Issues Encountered

- **Quatro falhas como `n1_api` fora do conjunto do job (pré-existentes, fora de escopo):** `persistencia/canais-projetados.test.ts` ("banco só com 001..007"), `persistencia/colunas-geradas.test.ts` ("o planejador escolhe o índice…"), `persistencia/migrar-seco.test.ts` ("(a) num banco vazio…") e `repositorios/crm/canais-008.test.ts` (17, a 008 idempotente). Todas usam `pool()` para DDL (`create database`, reaplicar a 008) e dão `permission denied` quando o app é `n1_api`; como dono, passam. O job `seguranca` não as roda (`src/seguranca`, `cofre`, `estado`). Trocar `pool()` por `poolDoDono()` nelas é o mesmo conserto que 09-12 fez em `banco-n1-api.test.ts`; fica registrado, não feito aqui.
- O seed não dá nenhuma Tarefa ao Convidado (ele vê 0 Tarefas); os casos de `runLancamentoAgent` acrescentam uma Concessão `ver` no estado da fábrica antes de semear.

## Known Stubs

Nenhum.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: operacao-sem-conferencia | packages/dominio/src/operations/financeiro.ts | `runLancamentoAgent` não recusa Convidado: ele com `ver` na conta dispara o Agente, que publica o Resumo e grava a Execução (09-09 item 3, agora medido e coberto por `it.fails`) |

T-09-76 a T-09-81 mitigadas e provadas por teste: T-09-76 (`dados-de-outro-membro`), T-09-77 (cruzamento entre Espaços), T-09-78 (`anexos`), T-09-79 (404 uniforme), T-09-80 (429 e XFF), T-09-81 (413/415/400 antes do banco, com o 415 de `text/plain` corrigido). T-09-SC: nenhum pacote instalado. As lacunas `removeMember`, `spawnNextOccurrence` e `runLancamentoAgent` seguem abertas e têm um teste que fica vermelho no dia do conserto.

## User Setup Required

None - no external service configuration required. Teste local: container `crm-n1-pg-0915`, porta 55615, removido ao fim; nenhuma requisição hostil saiu da máquina (tudo `inject` em processo; o Storage do Supabase foi dublado).

## Next Phase Readiness

- **09-21** (passada exploratória em homologação) herda a suíte completa; todo achado crítico ou alto dela vira teste em `src/seguranca/` antes de ser dado como corrigido (D-15).
- Quem consertar `removeMember`, `spawnNextOccurrence` ou `runLancamentoAgent` no domínio verá o `it.fails` correspondente falhar e deve trocá-lo por `it`.
- `inviteMember` fica sem prova de recusa por HTTP até haver um dublê do serviço de convite.

## Self-Check: PASSED

Arquivos criados existem (`dados-de-outro-membro`, `anexos`, `segredos-publicos`, `xff-e-trust-proxy`, `entrada-hostil`, `lacunas-do-dominio`); `grep -c "export function montarSegundoEspaco" apps/api/src/testes/espaco-de-vazamento.ts` = 1; commits `cb46b09`, `3ce511d`, `e397785` e `8a0ec72` estão no histórico; container `crm-n1-pg-0915` removido e nenhum processo iniciado por este plano segue rodando.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
