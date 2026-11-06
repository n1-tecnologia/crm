---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 38
subsystem: api
tags: [contatos, filtro, identificador, whatsapp, swr, tdd, ucr-08]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-07: resumidosPorIds e ContatoDaFerramenta (a leitura de Contatos que as Ferramentas conferem)"
provides:
  - "GET /contatos?comIdentificador=<tipo>: so Contatos do estado pedido com ao menos um Identificador do tipo; tipo fora de TIPOS_IDENTIFICADOR_CONTATO e 400 antes do servico"
  - "QUERY_LISTA_DE_CONTATOS (rotas/crm/contatos.ts): QUERY_LISTA.extend local; o QUERY_LISTA de comum.ts nao mudou"
  - "FiltroDeContatos.comIdentificador no servico e no repositorio (exists em contato_identificadores amarrado ao Espaco)"
  - "web: FiltroDeContatos.comIdentificador e chaveDeContatos/useContatos levam o filtro na chave do SWR e na query"
affects: [15-22]

plan_head_before: f724bc38c88baefc4acde9cc4334a870aaea8fef
plan_head_after: 5a70409b5897098ceecc054b2a988e791b9320c7

actuals:
  tokens: 3350
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Filtro de lista que so uma rota aceita: o esquema compartilhado (QUERY_LISTA) fica intacto e a rota estende com .extend().strict()"
    - "Parametro do filtro entra na chave do SWR so quando presente, para que a chave sem filtro continue identica a de antes"

key-files:
  created: []
  modified:
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.test.ts
    - apps/web/src/dados/crm/contatos.ts
    - apps/web/src/dados/crm/contatos.test.ts

key-decisions:
  - "O tipo do filtro reusa TipoIdentificadorContato/TIPOS_IDENTIFICADOR_CONTATO do dominio, que ja existiam; nenhum arquivo do dominio mudou"
  - "O filtro vale junto com `estado` (padrao ativo): Contato na lixeira com WhatsApp nao aparece entre os ativos"
  - "A chave da web poe comIdentificador entre `q` e `limite`; sem o filtro a chave e a de antes, entao invalidarCrm('/contatos') e os testes antigos seguem valendo"

requirements-completed: [UCR-08]

duration: 5 min
completed: 2026-11-06
---

# Phase 15 Plan 38: filtro comIdentificador da lista de Contatos Summary

**`GET /contatos?comIdentificador=whatsapp` filtra no banco por tipo de Identificador (exists amarrado ao Espaco, tipo por `$n`, `z.enum` do dominio) e `useContatos({ comIdentificador })` leva o filtro na chave do SWR, para o seletor de Contatos com WhatsApp das Ferramentas.**

## Accomplishments

- Rota: `QUERY_LISTA_DE_CONTATOS = QUERY_LISTA.extend({ comIdentificador: z.enum(TIPOS_IDENTIFICADOR_CONTATO).optional() }).strict()`; `fax` responde 400 sem chegar ao servico (T-15-90).
- Repositorio: `exists (select 1 from plataforma.contato_identificadores ci where ci.workspace_id = c.workspace_id and ci.contato_id = c.id and ci.tipo = $n)`, somado a `busca` e portanto ao `count` e a pagina (T-15-90, T-15-91).
- Web: `FiltroDeContatos.comIdentificador` e `chaveDeContatos` com o parametro so quando presente; ligar e desligar o filtro troca a chave e volta a lista de hoje.

## TDD

- **RED API** (`ecf87be`): tres casos novos falham pela asserção planejada. O fake `comIdentificador=whatsapp repassa o tipo ao servico` falha porque o `.strict()` da `QUERY_LISTA` devolvia 400 em vez de 200; os dois de banco falham pelo mesmo 400 (`expected 400 to be 200`). `semanticAssessment`: o alvo executou e falhou pela razao pretendida (o parametro nao existia), nao por import, fixture ou erro de sintaxe. O caso `fax -> 400` passa ja no RED por acidente (o `.strict()` recusa qualquer parametro desconhecido); ele so passa a provar o `z.enum` depois que o caso `whatsapp -> 200` passa, e os dois juntos fecham a borda.
- **GREEN API** (`d6cc3cf`): rota, servico e repositorio; 85/85 em `rotas/crm/contatos.test.ts` + `servicos/crm/contatos.test.ts`, nenhum skipped.
- **RED web** (`214be13`): os dois casos novos falham em `expect(...).toBe(...)` (a chave nao trazia `comIdentificador`).
- **GREEN web** (`5a70409`): 16/16 em `contatos.test.ts`.
- Sem REFACTOR: nada a limpar.

## Verificacao

- Task 1 (`<automated>` do plano, em contentor novo `crm-n1-pg-1538`, porta 55738, duas URLs explicitas, migracoes 001-012 aplicadas): `rotas/crm/contatos.test.ts` + `servicos/crm/contatos.test.ts` 85/85, `tsc --noEmit` da api = 0.
- Task 2: `apps/web` `vitest run src/dados/crm/contatos.test.ts` 16/16, `tsc --noEmit` = 0, `eslint` dos dois arquivos sem achados.
- Criterios: `grep -c comIdentificador` = 2 (rota), 3 (repositorio), 3 (web); `git diff --stat -- apps/api/src/rotas/crm/comum.ts` vazio.
- O contentor foi removido no fim; nao se usou `npm test` puro nem o `.env`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `FiltroDeContatos` do servico tambem precisou do campo**
- **Found during:** Task 1 (GREEN)
- **Issue:** o plano lista `packages/dominio/src/crm/contatos.ts` e fala em "`FiltroDeContatos.comIdentificador` no dominio", mas `FiltroDeContatos` nao mora no dominio: existem uma interface no repositorio e outra em `servicos/crm/contatos.ts`, e o servico copia campo a campo o filtro para o repositorio. Sem o campo no servico o filtro nao chegaria ao SQL (e a rota nao passaria no `tsc`).
- **Fix:** o campo entrou nas duas interfaces e na copia do servico; o dominio nao mudou, porque `TipoIdentificadorContato` e `TIPOS_IDENTIFICADOR_CONTATO` ja existiam la (o plano mandava "confira o nome da constante dos tipos").
- **Files modified:** `apps/api/src/servicos/crm/contatos.ts` (fora de `files_modified`), `apps/api/src/repositorios/crm/contatos.ts`
- **Commit:** `d6cc3cf`

**2. [Process] Ledger do plano gravado depois do primeiro commit**
- **Found during:** Task 1 (RED)
- **Issue:** o arquivo `gsd-plan-head-before-15-38` (protocolo 0c) so foi criado depois do commit RED.
- **Fix:** gravado com o pai desse commit (`f724bc3`, o HEAD de antes do plano); `rev-list` confere 4 commits.
- **Impacto:** nenhum nos numeros de `commits`.

**Total deviations:** 2 (1 Rule 3, 1 de processo). **Impact:** nenhum no comportamento; nao ha desvio visivel que fique para outro plano, entao nada foi aberto em `.planning/WINDOWS.md`.

## Known Stubs

None.

## Threat Flags

None. O unico limite novo e o parametro `comIdentificador`, ja coberto por T-15-90 e T-15-91 do plano.

## Self-Check: PASSED

- FOUND: os seis arquivos de `key-files.modified` (com diff no historico do plano).
- FOUND: commits `ecf87be`, `d6cc3cf`, `214be13`, `5a70409` (`git rev-list --count f724bc3..HEAD` = 4).
- Portas TDD: RED (`test(15-38)`) antes de GREEN (`feat(15-38)`) nas duas tarefas.

## Next

Pronto para o proximo plano da fase; o seletor de Contatos com WhatsApp das Ferramentas (15-22) ja tem rota e hook.
