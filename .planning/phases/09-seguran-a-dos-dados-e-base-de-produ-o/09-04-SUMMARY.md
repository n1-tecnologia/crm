---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 04
subsystem: database
tags: [postgres, migration, roles, grants, rls, vault, pg]

requires:
  - phase: 09-01
    provides: "apps/api autenticado e o script usuarios:criar; base do job de segurança"
provides:
  - "migração 009: plataforma fechada para anon/authenticated/public, RLS desligada, DML-only para n1_api, plataforma.credenciais, search_path fixo, revoke de rls_auto_enable"
  - "poolDeMigracao() e migrar(origem): migrações e conferência seca pelo dono do banco (DATABASE_URL_MIGRACAO)"
  - "npm run banco:conceder: concessões idempotentes de n1_api quando o papel nasce depois da 009"
  - "RLS adiada (decisão 12.1) documentada em persistencia/CONTEXT.md"
affects: [09-05, 09-11, 09-17, 09-20, cofre-de-credenciais, deploy, backup]

actuals:
  tokens: 13000
  tasks: 3
  commits: 6
plan_head_before: 71b88269cd85a1789e8e3f2dee5ce9faba021aa2
plan_head_after: 514ad95d2acd3e2bc0715fe11287b416368ccf2c

tech-stack:
  added: []
  patterns:
    - "SQL de concessão idempotente em apps/api/deploy/, fora de migracoes/, espelho do bloco (b) da 009 e comparado por teste"
    - "Provas de banco em Postgres descartável por caso (create database / drop database with force) com papéis do cluster criados e apagados pelo teste"
    - "Migrações de testes presas ao DATABASE_URL local (migrar(pool())), nunca ao DATABASE_URL_MIGRACAO"

key-files:
  created:
    - apps/api/migracoes/009-seguranca-e-cofre.sql
    - apps/api/deploy/conceder-n1-api.sql
    - apps/api/src/persistencia/conceder-n1-api.ts
    - apps/api/src/persistencia/conceder-n1-api.cli.ts
    - apps/api/src/seguranca/banco-n1-api.test.ts
    - .planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/deferred-items.md
  modified:
    - apps/api/src/persistencia/conexao.ts
    - apps/api/src/persistencia/conexao.test.ts
    - apps/api/src/persistencia/migrar.ts
    - apps/api/src/persistencia/migrar.cli.ts
    - apps/api/src/persistencia/migrar-seco.test.ts
    - apps/api/src/persistencia/canais-projetados.test.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/.env.example
    - apps/api/package.json
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "O administrador dos casos de banco-n1-api.test.ts é pool() (DATABASE_URL, que describeComBanco já exige local) e não poolDeMigracao(): um DATABASE_URL_MIGRACAO remoto no .env não pode levar create database para fora do Postgres local."
  - "prepararBancoCrm e o CLI de migrar-seco.test.ts ficam presos ao DATABASE_URL local (migrar(pool()), DATABASE_URL_MIGRACAO vazia no subprocesso) pela mesma razão."
  - "O bloco (e) da 009 revoga por papel existente em pg_roles e de public em seguida, dentro de begin/exception, para que a ausência de anon não impeça o revoke de public."
  - "O caso (b) constrói a sua própria matriz de referência (009 com o papel presente num segundo banco) em vez de depender da ordem de execução do caso (a)."

patterns-established:
  - "Toda migração futura que criar tabela em plataforma repete o desligamento de RLS (F7) se o ensure_rls existir no projeto."
  - "As duas linhas do api.env (DATABASE_URL e DATABASE_URL_MIGRACAO) mudam juntas."

requirements-completed: [SEG-04, SEG-05]

coverage:
  - id: D1
    description: "A 009 fecha plataforma para anon/authenticated/public (schema, tabelas, privilégios padrão, EXECUTE de rls_auto_enable), desliga a RLS ligada por event trigger em toda tabela, fixa o search_path das três funções da 007 e cria plataforma.credenciais com o índice único parcial, provada num banco novo que antes tinha os privilégios abertos."
    requirement: "SEG-04"
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#(a) fecha anon/authenticated/public, desliga a RLS, fixa o search_path, cria o cofre e concede só DML a n1_api"
        status: pass
    human_judgment: false
  - id: D2
    description: "n1_api só com DML: SELECT/INSERT/UPDATE/DELETE em toda tabela exceto escrita em plataforma.migracoes, USAGE nas sequências; conectado como n1_api, drop table, insert em migracoes e create table voltam SQLSTATE 42501."
    requirement: "SEG-04"
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#(a) fecha anon/authenticated/public, desliga a RLS, fixa o search_path, cria o cofre e concede só DML a n1_api"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 009 aplica sem erro num Postgres sem os papéis anon/authenticated e uma 009 que falha no meio não deixa a linha em plataforma.migracoes nem a tabela do cofre."
    requirement: "SEG-04"
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#(c) sem os papéis anon/authenticated (Postgres puro) a 009 aplica sem erro"
        status: pass
      - kind: integration
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#(d) uma 009 que falha no meio não deixa metade aplicada"
        status: pass
    human_judgment: false
  - id: D4
    description: "npm run banco:conceder concede a n1_api, depois da 009, a mesma matriz de privilégios e os mesmos privilégios padrão; rodar duas vezes dá o mesmo resultado; sem o papel não concede nada."
    requirement: "SEG-04"
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#(b) n1_api criado DEPOIS da 009"
        status: pass
      - kind: unit
        ref: "apps/api/src/seguranca/banco-n1-api.test.ts#um cliente cuja consulta a pg_roles não devolve linha"
        status: pass
      - kind: other
        ref: "DATABASE_URL=postgres://postgres:x@localhost:55604/postgres npm run --silent banco:conceder (imprime 'n1_api: concessões aplicadas')"
        status: pass
    human_judgment: false
  - id: D5
    description: "migrar(), migracoesPendentes() e os CLIs usam poolDeMigracao() (DATABASE_URL_MIGRACAO, ou DATABASE_URL se ausente) e encerrar() fecha os dois pools."
    requirement: "SEG-05"
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/conexao.test.ts#poolDeMigracao (D-07)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A aplicação real da 009 em homologação e produção, o papel n1_api criado nesses bancos e a troca do api.env pelo dono (09-17 e 09-20)."
    requirement: "SEG-04"
    verification: []
    human_judgment: true
    rationale: "Esta fase prova a 009 só em Postgres local; a aplicação em Supabase real, a existência de ensure_rls/rls_auto_enable lá e a conferência de relrowsecurity só o dono confere em 09-17 e 09-20."

duration: 10min
completed: 2026-10-23
status: complete
---

# Phase 9 Plan 04: Banco fechado, n1_api só com DML e cofre de credenciais Summary

**Migração 009 que fecha o schema `plataforma` para `anon`/`authenticated`/`public`, desliga a RLS, concede só DML ao papel `n1_api` (sem superusuário, sem escrever em `migracoes`) e cria `plataforma.credenciais`, mais `poolDeMigracao()` e `npm run banco:conceder` idempotente, tudo provado em Postgres local**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-23T00:25:52Z
- **Completed:** 2026-10-23T00:36:00Z
- **Tasks:** 3 (todas TDD: RED, GREEN)
- **Files modified:** 16 (incluindo o deferred-items.md)

## Accomplishments

- A `009-seguranca-e-cofre.sql` na ordem de D-06 (cofre, search_path, revoke guardado por `pg_roles`, desligamento de RLS, grants guardados de `n1_api`, revoke defensivo de `public.rls_auto_enable()`); aplica no Postgres puro dos testes e dentro da transação de `migrar()`.
- `poolDeMigracao()`: migrações, conferência seca e `banco:conceder` pelo dono do banco; o app continua em `pool()`; `encerrar()` fecha os dois pools; `.env.example` documenta `DATABASE_URL_MIGRACAO` e o usuário de pooler `n1_api.<ref>`.
- `npm run banco:conceder` e `deploy/conceder-n1-api.sql` (fora de `migracoes/`) recuperam as concessões quando `n1_api` nasce depois da `009`; um teste compara a matriz de privilégios e os privilégios padrão com o caminho "009 com o papel", em duas execuções.
- A RLS adiada pela decisão 12.1, os caminhos que consultam antes de saber o Espaço, o custo em `executar` e o lembrete F7 ficam escritos em `apps/api/src/persistencia/CONTEXT.md`.

## Prova do TDD

- **RED 1 (`conexao.test.ts`):** `poolDeMigracao is not a function` em 4 casos novos; avaliação semântica: o alvo executou e falhou na função inexistente planejada (não é falha de import: o módulo existe e exporta o resto).
- **RED 2 (`banco-n1-api.test.ts`, c/a/d):** (c) `expected [...] to include '009-seguranca-e-cofre.sql'`; (a) `anon USAGE: expected true to be false`; (d) `promise resolved ... instead of rejecting`. Cada um falhou na asserção do comportamento planejado, não em setup.
- **RED 3 (casos (b) e cliente falso):** `expected { papelExiste: false } to deeply equal { papelExiste: true }` e `expected [] to have a length of 1` contra um esqueleto de `concederN1Api`.
- **Mutação de sanidade:** trocar `disable row level security` por `enable ...` na 009 faz o caso (a) falhar (`expected [ 'automacao_agenda', 'canais', ... ] to deeply equal []`); trocar o `revoke ... from public` de `rls_auto_enable` por `select 1` também o derruba. A 009 foi restaurada e conferida byte a byte.
- O comando `gsd_run check tdd-red-evidence` não foi usado: a avaliação semântica acima foi feita à mão sobre a saída do vitest.

## Task Commits

1. **Task 1: poolDeMigracao (D-07)** - `3f934d0` (test, RED) e `a94b002` (feat, GREEN)
2. **Task 2: 009 provada em banco novo** - `ec5f347` (test, RED) e `b2c618d` (feat, GREEN)
3. **Task 3: banco:conceder e o RLS adiado escrito** - `3e8f002` (test, RED) e `514ad95` (feat, GREEN)

**Plan metadata:** commit `docs(09-04)` seguinte (SUMMARY e deferred-items), depois STATE/ROADMAP/REQUIREMENTS.

## Files Created/Modified

- `apps/api/migracoes/009-seguranca-e-cofre.sql` - a migração; a única migração tocada por este plano.
- `apps/api/deploy/conceder-n1-api.sql` - bloco (b) idempotente, fora de `migracoes/`.
- `apps/api/src/persistencia/conceder-n1-api.ts` e `.cli.ts` - `concederN1Api` e o CLI de `banco:conceder`.
- `apps/api/src/persistencia/conexao.ts` - `poolDeMigracao`, `criarPool` compartilhado, `encerrar()` dos dois pools.
- `apps/api/src/persistencia/migrar.ts` e `migrar.cli.ts` - `migrar(origem)` e conferência seca sobre `poolDeMigracao()`.
- `apps/api/src/seguranca/banco-n1-api.test.ts` - casos (a), (b), (c), (d) e o cliente falso.
- `apps/api/src/persistencia/CONTEXT.md` - "Banco fechado e RLS adiada (Fase 9)".
- `apps/api/.env.example`, `apps/api/package.json` - variável e script.
- `apps/api/src/testes/banco-crm.ts`, `migrar-seco.test.ts`, `canais-projetados.test.ts` - ajustes descritos em Deviations.

## Decisions Made

- Administrador dos casos de banco é `pool()` (local garantido por `describeComBanco`) e não `poolDeMigracao()`, para um `DATABASE_URL_MIGRACAO` remoto no `.env` nunca desviar `create database` ou `migrar` dos testes.
- O caso (b) calcula a sua referência num segundo banco em vez de depender de o (a) ter rodado antes; mais robusto com `-t` e execução isolada.
- O revoke de `rls_auto_enable` é feito por papel existente e depois de `public`, para que a ausência de `anon` não impeça a revogação de `public`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste de canais-projetados aplicava todas as migrações exceto a 008**
- **Found during:** Task 2 (verificação `canais-projetados.test.ts`)
- **Issue:** o caso "banco só com 001..007" filtrava `!startsWith("008-")` e passou a incluir a 009, que pressupõe a 008 e a tabela de controle criada por `migrar()`; falhou com `relation "plataforma.migracoes" does not exist`.
- **Fix:** o filtro passou a `/^00[1-7]-.*\.sql$/`, que é o que o nome do caso sempre quis dizer.
- **Files modified:** `apps/api/src/persistencia/canais-projetados.test.ts`
- **Verification:** `canais-projetados.test.ts` verde (14/14).
- **Committed in:** `b2c618d`

**2. [Rule 2 - Missing critical] Testes que migram ficaram presos ao DATABASE_URL local**
- **Found during:** Task 1 (depois de `migrar()` passar a usar `poolDeMigracao()`)
- **Issue:** com um `DATABASE_URL_MIGRACAO` remoto no `.env` (o estado de produção/homologação depois de 09-17), `prepararBancoCrm()` e o CLI de `migrar-seco.test.ts` aplicariam migrações no banco remoto enquanto `temBancoCrm` só confere `DATABASE_URL`. Isso reabriria a classe de risco T-07-08.
- **Fix:** `prepararBancoCrm` chama `migrar(pool())`; `migracoesPendentes(pool())` no caso (b) de `migrar-seco.test.ts`; o subprocesso do caso (c) recebe `DATABASE_URL_MIGRACAO: ""`.
- **Files modified:** `apps/api/src/testes/banco-crm.ts`, `apps/api/src/persistencia/migrar-seco.test.ts`
- **Verification:** `migrar-seco.test.ts` verde; a suíte do `apps/api` (abaixo).
- **Committed in:** `a94b002`

---

**Total deviations:** 2 auto-fixed (1 bug de teste causado pela 009, 1 segurança da suíte)
**Impact on plan:** nenhum escopo novo; os dois ajustes são consequência direta da 009 e de `poolDeMigracao`.

## Issues Encountered

- **Prova (d) não é um teste de atomicidade forte.** A falha provocada (uma VIEW com o nome do cofre) estoura no `create unique index` da própria seção (c), antes de qualquer `revoke`. O teste prova que a linha da 009 e a tabela do cofre não ficam e que `001`…`008` seguem aplicadas, como o plano pede, mas "nem os `revoke`" decorre da transação de `migrar()` (inalterada) e não de uma falha tardia provocada.
- **Falha que não é desta tarefa:** `src/e2e/canais-fluxo.test.ts` caso (e) devolve 500 no `GET /estado` por `recortarMembro` (`packages/dominio/src/derive-visibilidade.ts:67`) ler `membro.userMemory.enabled` num Membro sem `userMemory`. É código do plano 09-02; registrado em `deferred-items.md`. Fora ela, `apps/api` fechou com 133 arquivos / 1434 testes verdes, 21 pulados (sem banco ou por regra) e a e2e `lote-contas-a-pagar` excluída por ordem do orquestrador.

## Verificação do plano

- `DATABASE_URL=postgres://postgres:x@localhost:55604/postgres npx vitest run src/seguranca/banco-n1-api.test.ts src/persistencia/conexao.test.ts src/persistencia/migrar-seco.test.ts src/persistencia/canais-projetados.test.ts`: 4 arquivos, 31 testes, 0 pulados.
- `npm run typecheck` (raiz): web, domínio e api verdes.
- `npm run --silent banco:conceder` contra o container: `n1_api: concessões aplicadas`, saída 0.
- `git diff --name-only 71b8826..HEAD -- apps/api/migracoes` lista só `009-seguranca-e-cofre.sql`; `git ls-files apps/api/migracoes | grep conceder` não acha nada.
- Não rodado: `npm run check` completo (lint, tokens e os três workspaces); só `typecheck` e as provas acima.

## User Setup Required

None - nenhuma configuração externa neste plano. A aplicação da 009 (e a criação do papel `n1_api`) em homologação e produção é do dono em 09-17 e 09-20, depois de `npm run migrar -w @n1/api -- --seco`.

## Known Stubs

None.

## Threat Flags

None - nenhuma superfície nova além da registrada no `<threat_model>` do plano.

## Next Phase Readiness

- Pronto: 09-05 em diante pode contar com `plataforma.credenciais` para o cofre; 09-11 deve rodar `npm run banco:conceder` a cada deploy depois do `migrar`; 09-17 e 09-20 aplicam a 009 e trocam o `api.env` (as duas linhas juntas).
- Atenção para o dono em homologação: conferir `select to_regprocedure('public.rls_auto_enable()')` e `relrowsecurity` das tabelas antes de trocar `DATABASE_URL` para `n1_api` (F7).

## Self-Check: PASSED

Arquivos criados conferidos com `[ -f ]`; os seis commits `3f934d0`, `a94b002`, `ec5f347`, `b2c618d`, `3e8f002` e `514ad95` são ancestrais de HEAD.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
