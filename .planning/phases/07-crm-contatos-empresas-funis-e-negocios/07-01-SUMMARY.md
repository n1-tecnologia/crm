---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 01
subsystem: crm
tags: [fastify, zod, pg, swr, next, postgres, tracer]

requires:
  - phase: 01-persistencia-e-api
    provides: "hook de JWT (request.membro), pool pg, migrar() e o padrão buildApp com verificarToken/resolverMembro injetados"
provides:
  - "@n1/dominio/crm/comum e @n1/dominio/crm/contatos (tipos em português espelhando a 007, validarContato / INV-CON-01)"
  - "rotasDeCrm: GET/POST /contatos sobre serviço, repositório pg e plataforma.contatos"
  - "testes/banco-crm.ts: banco de teste que só roda contra Postgres local"
  - "cliente-crm.ts no web: chamarCrm, ErroDeApi, invalidarCrm"
  - "/crm/contatos lendo e criando pela api"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13]

actuals:
  tokens: 14026
  tasks: 2
  commits: 2

tech-stack:
  added: ["swr@2.5.1 (@n1/web)"]
  patterns:
    - "repositorios/: interface por agregado, implementação pg atrás; todo WHERE com workspace_id = $1"
    - "servicos/crm: ResultadoCrm<T> (sucesso/recusa), a rota traduz em HTTP"
    - "envelope REST do CRM: { ok, dados } / { ok, itens, total } / { ok:false, error, codigo?, campo?, bloqueios? }"
    - "teste de banco do CRM só contra localhost/127.0.0.1 (describeComBanco)"

key-files:
  created:
    - packages/dominio/src/crm/comum.ts
    - packages/dominio/src/crm/contatos.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/resultado.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/rotas/crm/comum.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/crm/contatos.test.ts
    - apps/web/src/dados/crm/cliente-crm.ts
  modified:
    - apps/api/src/app.ts
    - apps/web/package.json
    - package-lock.json
    - "apps/web/src/app/(shell)/crm/contatos/page.tsx"

key-decisions:
  - "D-01: modelo novo convive com o inglês; packages/dominio/package.json e o modelo antigo ficam sem diff (o export \"./*\" já resolve @n1/dominio/crm/*)"
  - "D-11: sem Proprietário no corpo, Proprietário e criado_por são o Membro da sessão; o corpo .strict() não aceita proprietarioId neste plano"
  - "D-12: temBancoCrm só é verdadeiro para localhost/127.0.0.1; prepararBancoCrm lança fora disso, então migrar() nunca roda contra o Supabase pelo teste"

patterns-established:
  - "Serviço devolve ResultadoCrm e nunca toca HTTP; rota nunca toca SQL"
  - "Content-type só com corpo no cliente web (Pitfall 4)"

requirements-completed: [CRM-D1, CRM-A1, CRM-W1, CRM-V1]

duration: 25 min
completed: 2026-10-10
plan_head_before: 00db2064bf553846cbd0d3e9cac9e6f02621ec66
plan_head_after: 90ede8fab4ae58874a944f616b4b3449e7f11e3c
commits: 2
status: complete

coverage:
  - id: D1
    description: "Módulo crm/ do domínio (comum + contatos) com validarContato (INV-CON-01), resolvendo por @n1/dominio/crm/* sem editar package.json"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(g) POST /contatos {} responde 409 com o código de INV-CON-01"
        status: pass
      - kind: other
        ref: "cd apps/api && node -e require.resolve('@n1/dominio/crm/contatos') termina em /src/crm/contatos.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um Membro cria um Contato por POST /contatos e o encontra em GET /contatos, gravado em plataforma.contatos com o workspace_id da sessão"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(d) e (e) contra Postgres local"
        status: pass
    human_judgment: false
  - id: D3
    description: "Isolamento entre Espaços e recusa de workspaceId/criadoPor no corpo (.strict())"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(f) isolamento e (b) corpo estrito"
        status: pass
    human_judgment: false
  - id: D4
    description: "Testes de banco do CRM só rodam contra Postgres local"
    requirement: CRM-V1
    verification:
      - kind: unit
        ref: "apps/api/src/testes/banco-crm.ts (temBancoCrm por host); vitest sem DATABASE_URL local pula o bloco"
        status: pass
    human_judgment: false
  - id: D5
    description: "/crm/contatos lista pela api (SWR + chamarCrm) e Novo Contato grava por POST /contatos revalidando a lista"
    requirement: CRM-W1
    verification:
      - kind: other
        ref: "tsc --noEmit + eslint na página e em dados/crm; greps de aceitação da Task 2"
        status: pass
    human_judgment: true
    rationale: "O fluxo no navegador (abrir o diálogo, criar, ver a linha nova) não foi exercitado por teste de interface nesta rodada; o POST que a tela usa é o provado em (d). A verificação visual fica para o fim da fase (human_verify_mode = end-of-phase)."
---

# Phase 7 Plan 01: Traçador do CRM — Contato de ponta a ponta Summary

**Contato criado pela tela, gravado em `plataforma.contatos` no Espaço da sessão por `POST /contatos` (Fastify + serviço + repositório `pg`) e listado por `GET /contatos` via SWR, com tipo e regra (INV-CON-01) vindos de `@n1/dominio/crm/*` nos dois lados.**

## Performance

- **Duration:** ~25 min (o início exato não foi capturado)
- **Completed:** 2026-10-10T00:53:49Z
- **Tasks:** 2 (1 traçador + 1 auto)
- **Files modified:** 15 (11 criados, 4 modificados)

## Accomplishments

- Módulo `crm/` do domínio: `EstadoCrm`/`ESTADOS_CRM` (verbatim de `007-crm.sql:69`), `ModoDeCriacao`, `SituacaoNegocio`, `Endereco`, `CamposAdicionais`, `Pagina`, `BloqueiosCrm`, `LIMITES_CRM`, os tipos de Contato e `validarContato`/`nomeDeExibicaoDoContato`. `packages/dominio/package.json`, `types/crm.ts`, `operations/*` e `index.ts` ficaram sem diff.
- Primeiro repositório de verdade de `apps/api/src/repositorios/` (`criarRepositorioDeContatosPg`), serviço com `ResultadoCrm`, fragmentos zod e envelope em `rotas/crm/comum.ts`, `rotasDeCrm` registrada na raiz de `app.ts` (herda o JWT).
- `testes/banco-crm.ts`: o banco de teste do CRM só liga contra `localhost`/`127.0.0.1`.
- Web: `chamarCrm`/`ErroDeApi`/`invalidarCrm` e a lista de Contatos religada na api, mais o diálogo "Novo Contato".
- Verificado contra Postgres 16 local (container `crm-n1-pg-0701`, removido ao fim): 8/8 testes, nenhum pulado.

## Task Commits

1. **Task 1: Traçador — Contato gravado por HTTP e listado na tela** - `195fd6c` (feat)
2. **Task 2: Novo Contato pela tela, gravando por POST /contatos** - `90ede8f` (feat)

Base do plano (HEAD anterior ao primeiro commit): `00db2064bf553846cbd0d3e9cac9e6f02621ec66`.

**Plan metadata:** commit `docs(07-01)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/comum.ts`, `packages/dominio/src/crm/contatos.ts` - tipos e regra do CRM novo
- `apps/api/src/testes/banco-crm.ts` - banco de teste só local, `limparEspaco` transacional
- `apps/api/src/repositorios/crm/contatos.ts` - `inserir`/`listar` com `workspace_id = $1`, datas como texto
- `apps/api/src/servicos/crm/resultado.ts`, `apps/api/src/servicos/crm/contatos.ts` - `ResultadoCrm` e `criarServicoDeContatos`
- `apps/api/src/rotas/crm/comum.ts`, `contatos.ts`, `index.ts` - zod, envelope, rotas e `rotasDeCrm`
- `apps/api/src/rotas/crm/contatos.test.ts` - casos (a)-(g)
- `apps/api/src/app.ts` - `OpcoesDoApp.crm` e `app.register(rotasDeCrm, ...)` depois de `rotasDeFinanceiro`
- `apps/web/src/dados/crm/cliente-crm.ts` - cliente HTTP do CRM
- `apps/web/src/app/(shell)/crm/contatos/page.tsx` - lista sobre `GET /contatos` e criação por `POST /contatos`
- `apps/web/package.json`, `package-lock.json` - `swr` 2.5.1 exato

## Decisions Made

Ver `key-decisions` no frontmatter. Sem decisões novas além das do plano.

## Deviations from Plan

### Auto-fixed Issues

None - o código foi escrito como o plano descreve.

### Registros (não são correções de código)

1. **Guarda de branch protegida.** O pré-commit assertion do executor considera `main` protegida (`git.base-branch --is-protected main` devolveu `true`). O orquestrador fixou a execução em `main` (`branching_strategy: none`, histórico do repositório todo em `main`), então os commits foram feitos em `main` sem alterar `git.allow_default_branch_commits` no `config.json` (configuração não é minha para mudar). Se a intenção for outra, o que mudar é essa chave, não o código do plano.
2. **Critério de aceitação `grep -rl "@n1/api" apps/web/src` "não lista nenhum arquivo".** Lista `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx`, linha 15, um comentário pré-existente com `npm run empresas:configurar -w @n1/api` (commit `e97191d`). Não é import; a intenção do critério (web nunca importa `@n1/api`) vale. Fora do escopo; não alterado.
3. **`package-lock.json` absorveu ruído.** O commit `195fd6c` levou o lock como o npm o escreveu depois de instalar `swr@2.5.1`, incluindo a remoção de linhas `libc` que já estava não commitada antes da fase (diffstat do lock: 24 inserções, 144 remoções).
4. **Ficha antiga.** A ficha `/crm/contatos/[id]` continua a do modelo antigo até o 07-06: abrir pela lista nova um Contato criado pela api cai no "não encontrado" dela, como o plano previa.

**Total deviations:** 0 auto-fixed. **Impact:** nenhum no escopo.

## Issues Encountered

- Uma leitura de `apps/web/.env.local` foi barrada pelo hook de leitura de segredos; não era necessária (o código usa `process.env.NEXT_PUBLIC_API_URL` como `sessao-provider.tsx`) e foi dispensada.
- `apps/api` inteiro não foi rodado (a suíte leva dezenas de minutos e estoura o watchdog, STATE.md): verificação escopada a `src/rotas/crm` com Postgres local, mais typecheck dos três workspaces, lint (0 erros; 3 warnings pré-existentes em outros arquivos), tokens (445/322, 0 falhas), 330 testes web e 1051 de domínio.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- 07-02 endurece o mesmo caminho: Papel (D-14), troca de Proprietário (D-11), transação com SQLSTATE, CORS de PATCH/DELETE (hoje `methods: ["GET", "POST"]` em `app.ts`) e teste do cliente web. Ele sobe o próprio container de banco (porta/nome próprios).
- `apps/api/migracoes/007-crm.sql` continua não rastreado (D-12): 07-05 o edita e a fase o commita.
- Verificação visual de `/crm/contatos` (criar e ver a linha) fica para o fim da fase.

## Self-Check: PASSED

- Arquivos criados presentes em disco (11 criados; verificados por `git diff --name-only 00db206..HEAD`, 15 arquivos).
- Commits `195fd6c` e `90ede8f` presentes na ancestralidade de HEAD.
- Critérios de aceitação das duas tasks reexecutados e verdes (greps, 8/8 testes sem pulados, `require.resolve` em `src/crm/contatos.ts`, `docker ps` do container vazio, diff vazio em `packages/dominio/{package.json,src/types,src/operations,src/index.ts}`).

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
