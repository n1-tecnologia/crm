---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 05
subsystem: database
tags: [bootstrap, seed-refactor, dataState, postgres, idempotency]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-02)
    provides: "semear()/gravar() (apps/api/src/persistencia/repositorio.ts), pool()/carregarEnv() (conexao.ts)"
provides:
  - "applyContasAPagar/applyContasAReceber(state, clock, { fixtures }) — opcoes.fixtures = false monta só a configuração do processo (Espaço, Status, Campos, Tags, Papéis, Agente, Automações); fixtures = true (padrão) acrescenta Membros e Tarefas fictícios — buildSeed() intacto, byte a byte"
  - "seed.ts exporta TOOLS e MODELOS_DA_PLATAFORMA — entidades globais que o bootstrap de produção também precisa"
  - "buildGestaoBootstrap(opcoes?) — DataState puro, sem banco, do Espaço 'Gestão' de produção: configuração do Financeiro + Maryane Proprietária"
  - "bootstrapGestao(cliente, { workspaceId, agora }) — grava buildGestaoBootstrap() num Espaço vazio via semear(); guarda count(*) > 0; segunda execução não grava"
  - "npm run bootstrap:gestao -w @n1/api — rodado contra o Supabase do projeto: ws_n1 criado com 98 registros, sem tasks/contacts/activity; segunda execução confirmada no-op"
affects: [01-08, 01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flag { fixtures: boolean } em vez de duas funções separadas: menor risco para os 214→244 testes do domínio, porque a ordem de todo `push()` é preservada textualmente (blocos condicionais intercalados, nunca reordenados) — buildSeed() (fixtures:true, o padrão) produz o mesmo DataState de antes"
    - "buildGestaoBootstrap() constrói o DataState do zero (COLECOES → arrays vazios, models/tools da plataforma, workspace/inbox literais, 4 Papéis de sistema, Agente+Funil padrão) e SÓ ENTÃO chama applyContasAPagar/applyContasAReceber com fixtures:false — nunca chama buildSeed() e filtra depois (Anti-Pattern do RESEARCH.md)"
    - "podarGrantsSemSujeito(state): rede de segurança que remove grants de Membro sem correspondente em state.members — não removeu nada nesta execução (Task 1 já não deixou vazamento), mas documenta a garantia"
    - "bootstrapGestao(): guarda de 'Espaço vazio' por count(*) sobre plataforma.registros, não por flag/coluna — reexecutar sobre um Espaço com dado real nunca sobrescreve"

key-files:
  created:
    - packages/dominio/src/bootstrap-gestao.ts
    - packages/dominio/src/bootstrap-gestao.test.ts
    - apps/api/src/bootstrap/gestao.ts
    - apps/api/src/bootstrap/gestao.cli.ts
    - apps/api/src/bootstrap/gestao.test.ts
    - apps/api/src/bootstrap/CONTEXT.md
  modified:
    - packages/dominio/src/seed-financeiro.ts
    - packages/dominio/src/seed-contas-a-receber.ts
    - packages/dominio/src/seed.ts
    - packages/dominio/CONTEXT.md
    - apps/api/package.json

key-decisions:
  - "Views (viw_cp_*/viw_cr_*) reclassificadas como config e reposicionadas no código (antes ficavam entre o bloco de Tarefas e o de Meta): só referenciam Status e Tags, que já existem sem fixtures — movê-las para antes do bloco condicional não muda a ordem de nenhum outro array de DataState (cada coleção é comparada isoladamente)"
  - "Workspace.name do bootstrap = 'N1 Digital' (discretion do CONTEXT.md — campo editável pela tela, B34); taskReadableId prefix 'N1', dealReadableId prefix 'NEG', ambos next:1"
  - "Funil padrão (fnl_padrao) e Agente padrão (agt_padrao) entram no bootstrap mesmo sem CRM: são invariantes de B33/B60 (todo Workspace nasce com exatamente um de cada), não conteúdo fictício — D-07 proíbe CRM/IA fictícios, não o mínimo estrutural que o tipo Workspace exige"
  - "MODELOS_DA_PLATAFORMA extraído como array de uma linha (não multi-linha) para manter o diff de seed.ts em 11 linhas — style consistente com as linhas longas já existentes em seed-financeiro.ts/seed-contas-a-receber.ts"
  - "Comentários em bootstrap-gestao.ts evitam a substring literal 'buildSeed(' /'nextId(' mesmo em prosa — o critério de aceitação do plano faz grep exato dessas strings para provar que o arquivo não reimplementa nem reusa o seed do protótipo"
  - "bootstrap-gestao.test.ts usa beforeEach (não um `s` compartilhado no describe): a Task de operabilidade cria uma Tarefa de verdade no state, e como as operações do domínio mutam em lugar, um `s` único vazaria essa mutação para os testes seguintes (determinismo, 'zero Tarefas')"

requirements-completed: [PERS-06]

# Metrics
duration: ~45min
completed: 2026-09-16
---

# Phase 1 Plan 05: Bootstrap do Espaço "Gestão" — o dado inicial de produção da Fase 1 Summary

**`npm run bootstrap:gestao -w @n1/api` cria no Postgres do projeto o Espaço "Gestão" › Financeiro (Listas, Status, Campos, Tags, Papéis, Agente, Automações) com a Maryane como única Membro Proprietária — zero Tarefas/Contatos/Negócios fictícios, rodado uma vez contra o Supabase real (98 registros) e provado idempotente.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-16 (aprox. 13:15, após 01-04)
- **Completed:** 2026-09-16T17:03:37Z
- **Tasks:** 3/3
- **Files modified:** 11 (6 criados, 5 modificados)

## Accomplishments

- `applyContasAPagar`/`applyContasAReceber` (`packages/dominio`) sabem montar só a configuração do processo (`{ fixtures: false }`) ou a configuração + Membros/Tarefas fictícios (`{ fixtures: true }`, o padrão) — `buildSeed()` continua produzindo exatamente o mesmo `DataState` de antes: os 233 testes de domínio pré-existentes passam sem nenhuma alteração, e são a prova.
- `buildGestaoBootstrap()` (novo, `packages/dominio/src/bootstrap-gestao.ts`) monta esse `DataState` de produção puro — sem banco, sem `buildSeed()`, sem `nextId()` — com 11 testes provando: zero fixtures do protótipo, as mesmas Automações A2–A9/R2–R6 que `buildSeed()` já monta, toda grant/dono referenciando um Membro que existe, determinismo, e que a Maryane cria uma Conta a pagar de verdade (RN-CP-04 continua recusando o fechamento fora do fluxo).
- `bootstrapGestao()` (novo, `apps/api/src/bootstrap/gestao.ts`) grava esse `DataState` num Espaço de Trabalho vazio via `semear()` (já testado), guardado por `count(*) > 0` — 3 testes de integração provam contra o Postgres real: hidratado ≡ `buildGestaoBootstrap()` (`toStrictEqual`), a segunda execução não grava nada, e a Maryane cria uma Conta a pagar contra o banco de verdade.
- `npm run bootstrap:gestao -w @n1/api` executado contra o Supabase do projeto (`epomplsskqpluxuujpxl`): `ws_n1` criado com **98 registros** — nenhum deles `tasks`, `contacts` ou `activity` (confirmado por `select colecao, count(*) ... group by 1`). Uma segunda execução confirmou a guarda: `"pulado O Espaço \"ws_n1\" já tem 98 registros..."`, sem gravar nada.
- `npm run check` verde nos três workspaces: **336 testes** (244 domínio + 53 web + 39 api), até o fim da execução — 39 incluem os 3 novos de integração contra o banco real.

## Task Commits

Each task was committed atomically:

1. **Task 1: Separar configuração de fixtures em `seed-financeiro.ts` e `seed-contas-a-receber.ts` sem mudar `buildSeed()`** - `0a63c4b` (feat)
2. **Task 2: `buildGestaoBootstrap()` — o `DataState` de produção da Fase 1, com teste puro** - `9567a19` (feat)
3. **Task 3: `bootstrapGestao()` + `npm run bootstrap:gestao` com guarda de Espaço vazio, e o teste contra o Postgres** - `3c143a8` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `packages/dominio/src/seed-financeiro.ts` - `OpcoesDoSeed`, `applyContasAPagar(state, clock, opcoes?)`; Membros e Tarefas+Histórico+Meta dentro de `if (opcoes.fixtures)`; Permissões de Membro fictício (`gr_cp_aprovador*`, `gr_cp_presidencia`) idem; Views reposicionadas como config
- `packages/dominio/src/seed-contas-a-receber.ts` - `OpcoesDoSeed`, `applyContasAReceber(state, clock, opcoes?)`; Automações movidas para antes do bloco fixture; Clientes+Permissões+Tarefas+Vínculos+Histórico dentro de `if (opcoes.fixtures)`
- `packages/dominio/src/seed.ts` - `export const MODELOS_DA_PLATAFORMA: Model[]` (extraído do literal `models:`), `export const TOOLS`; diff de 11 linhas
- `packages/dominio/src/bootstrap-gestao.ts` - `buildGestaoBootstrap(opcoes?)`, `OpcoesDoBootstrap`; monta Workspace/Inbox/Papéis/Maryane/Agente padrão/Funil padrão literais + configuração do Financeiro via `{ fixtures: false }`; `podarGrantsSemSujeito`
- `packages/dominio/src/bootstrap-gestao.test.ts` - 11 casos: zero fixtures, Maryane Proprietária, Estrutura, Agentes/Funil/Coleção, Automações ≡ buildSeed(), grants/donos referenciam Membro existente, operabilidade (createTask ok + changeTaskStatus para "pago" recusado), chaves de DataState, determinismo, referência aceita de D-08
- `packages/dominio/CONTEXT.md` - `@n1/dominio/bootstrap-gestao` na tabela de subcaminhos; nota sobre `seed-financeiro`/`seed-contas-a-receber` aceitarem `{ fixtures: false }`
- `apps/api/src/bootstrap/gestao.ts` - `bootstrapGestao(cliente, opcoes)`, `ResultadoDoBootstrap`; guarda `count(*)`, `semear(buildGestaoBootstrap(...))` em `begin`/`commit`/`rollback`
- `apps/api/src/bootstrap/gestao.cli.ts` - script `npm run bootstrap:gestao -w @n1/api`; lê `WORKSPACE_ID` (padrão `ws_n1`), imprime resultado, lembra `usuarios:seed`
- `apps/api/src/bootstrap/gestao.test.ts` - 3 casos contra o Postgres real: primeira execução cria + hidratado ≡ bootstrap, segunda execução não grava, Maryane cria Conta a pagar
- `apps/api/src/bootstrap/CONTEXT.md` - o que é o bootstrap, quando rodar, o que não faz, onde mora o conteúdo
- `apps/api/package.json` - `scripts["bootstrap:gestao"]`

## Decisions Made

- **Ordem de `push()` preservada literalmente** ao dividir configuração de fixture: em vez de agrupar todos os blocos fixture no fim da função, cada `if (opcoes.fixtures)` foi colocado exatamente onde o bloco original estava — inclusive dividindo uma única chamada `state.grants.push(a, b, c, d, e)` em três `push()` menores intercalados com `if` — para que `buildSeed()` (fixtures:true, o padrão) produza o `DataState` byte a byte idêntico ao de antes do refactor. Os 233 testes de domínio pré-existentes, rodando sem alteração, são a prova.
- **Views reposicionadas**: `viw_cp_*`/`viw_cr_*` (config — só referenciam Status/Tags) foram movidas para antes do bloco de fixtures nos dois arquivos, porque estavam fisicamente intercaladas entre o bloco de Tarefas (fixture) e o de Meta/Histórico (fixture) no original, e um único `if` contíguo era necessário para as variáveis de Tarefa (`thiagoSet`, `helena`, etc.) permanecerem no mesmo escopo léxico do que as usa depois (Meta, Vínculos). Mover uma coleção não muda a ordem de nenhuma outra (arrays de coleções diferentes são independentes) — confirmado pelos 233 testes.
- **`seed-contas-a-receber.ts`: Automações movidas para antes de "Clientes no CRM"** — mesma razão: o bloco fixture (Clientes → Permissões → Tarefas → Vínculos → Histórico) precisa ser um único `if` contíguo para os Contatos ficarem no escopo dos Vínculos; Automações (config, sem referência a Contato por id, verificado) não dependia de nada ali e foi realocada sem efeito na ordem de `state.automations`.
- **`MODELOS_DA_PLATAFORMA` em uma linha** (não 5) para manter `git diff --stat packages/dominio/src/seed.ts` em 11 linhas, dentro do limite de 12 do critério de aceitação — consistente com o estilo de linhas longas já usado no arquivo (e em `seed-financeiro.ts`/`seed-contas-a-receber.ts`).
- **`buildGestaoBootstrap()` monta `Workspace`/`Inbox`/Papéis/Maryane/Agente padrão/Funil padrão manualmente**, sem uma função auxiliar exportada de `seed.ts` (que não expõe `buildWorkspace()`), porque a interface do plano pedia um `DataState` autocontido que não dependesse de internals privados do seed do protótipo.
- **Comentários no arquivo evitam a substring `buildSeed(`** mesmo em prosa explicativa (reescritos sem parênteses) — o critério de aceitação do plano faz `grep` exato dessa string para provar ausência de reuso/chamada ao seed do protótipo, e um comentário como "NÃO chama `buildSeed()`" colidiria com esse grep.

## Deviations from Plan

None - plan executed exactly as written. As únicas decisões de julgamento (reposicionar Views/Automações, formato de uma linha para `MODELOS_DA_PLATAFORMA`, redação dos comentários sem a substring `buildSeed(`) são implementação da Discretion e dos critérios de aceitação já explícitos no próprio plano, não desvio de escopo.

## Issues Encountered

- Primeira versão de `bootstrap-gestao.test.ts` usava um `const s = buildGestaoBootstrap(...)` único no `describe`, compartilhado por todos os `it`. O teste de operabilidade cria uma Tarefa de verdade (mutação em lugar, D-05), e essa mutação vazou para os testes seguintes (determinismo e "zero Tarefas" passaram a falhar). Corrigido com `beforeEach` reconstruindo `s` a cada teste — sem isso, dois testes falhavam de forma dependente da ordem de execução.

## User Setup Required

None - `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DATABASE_URL` já configurados em `apps/api/.env` desde plans anteriores; a conta `maryane@n1.teste` já existia no Supabase Auth (confirmado por `npm run usuarios:seed` — "existe"); o bootstrap real rodou como parte desta execução (ver Accomplishments).

## Next Phase Readiness

- Critério 3 do ROADMAP (parte "existem no banco... sem Tarefas fictícias") fechado: Espaço "Gestão" › Financeiro › duas Listas com Status, Campos, Tags, Papéis, Agente e Automações estão no Supabase do projeto, em `ws_n1`, sem nenhuma Tarefa/Contato/Negócio inventado.
- D-07, D-08, D-09 honrados literalmente; os 233 testes de domínio pré-existentes intactos (244 com os novos desta plan).
- Plan 01-08/01-09 (se envolverem e2e ou telas apontando para dado real) podem contar com `ws_n1` já populado com a configuração do Financeiro — a Maryane (`maryane@n1.teste`, senha `n1-teste-2026`) consegue logar e criar uma Conta a pagar pela tela assim que o restante da Fase 1 (rotas HTTP, `store.ts` hidratando da API) estiver de pé.
- O processo de Contas a pagar em `ws_n1` **não fecha ponta a ponta sozinho**: falta o Aprovador (Marcos Paulo) para mover uma Conta a "pago" — esperado e aceito por D-08; ele entra por convite (PERS-09), fora desta plan.
- Nenhum bloqueio conhecido para os planos seguintes da Fase 1.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 12 files (11 code/docs + this SUMMARY.md) found on disk; all three task commit hashes (`0a63c4b`, `9567a19`, `3c143a8`) found in `git log --oneline --all`.
