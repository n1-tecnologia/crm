---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 02
subsystem: api
tags: [fastify, jwt, supabase-auth, cors, zod, dev-experience]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-01)
    provides: "checkpoint humano de legitimidade de pacote aprovado — fastify, @fastify/type-provider-zod, @fastify/cors, concurrently"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-06)
    provides: "índice de expressão registros_members_user_id_idx sobre dados->>'userId', usado por membroPorUsuario"
provides:
  - "buildApp(opcoes?) — monta o Fastify inteiro (CORS, zod, erro, autenticação, GET /saude) sem listen(), para app.inject() nos testes"
  - "index.ts — boot: carregarEnv() + buildApp({ logger: true }) + listen()"
  - "registrarAutenticacao(app, opcoes) — hook onRequest que verifica o JWT do Supabase e decora request.membro; rota se isenta com config: { publica: true }"
  - "verificarTokenDoSupabase(token) — via supabase.auth.getClaims(token)"
  - "membroPorUsuario(workspaceId, userId) — uma consulta só, sem hidratar o Espaço"
  - "npm run dev (raiz) sobe web (3001) + api (3002) via concurrently; npm run dev:web só a interface"
  - "apps/api/.env.example e apps/web/.env.local.example commitáveis (exceção nova no .gitignore) com todas as variáveis desta fase"
affects: [01-04, 01-07, 01-08, 01-09]

# Tech tracking
tech-stack:
  added: ["fastify@5.12.5", "@fastify/type-provider-zod@1.0.0", "@fastify/cors@11.3.0", "zod@^4.6.5 (dependência direta de @n1/api)", "concurrently@10.0.5 (dev, raiz)"]
  patterns:
    - "app.ts monta sem listen(); index.ts só chama listen() — permite app.inject() nos testes sem socket nem banco (D-DEC-09)"
    - "Hook onRequest registrado direto na instância raiz (sem wrapper de encapsulamento), antes de qualquer rota: alcança tudo que nasce depois; uma rota se isenta com config: { publica: true }"
    - "verificarToken/resolverMembro injetáveis via OpcoesDoApp — produção usa os defaults reais (verificarTokenDoSupabase, membroPorUsuario), testes injetam stubs sem rede nem banco"
    - "workspaceId sempre da configuração do servidor (WORKSPACE_ID), nunca do cliente — a resolução de Membro é 'este sub dentro DESTE Espaço', nunca 'qualquer Membro com este userId' (T-1-02)"
    - "Formato de erro de transporte uniforme: toda resposta não-200 é { ok: false, error } em pt-BR, sem stack"

key-files:
  created:
    - apps/api/src/app.ts
    - apps/api/src/app.test.ts
    - apps/api/src/plugins/autenticacao.ts
    - apps/api/src/plugins/autenticacao.test.ts
    - apps/api/src/plugins/CONTEXT.md
    - apps/api/src/autenticacao/verificar-token.ts
    - apps/api/src/persistencia/membros.ts
    - apps/api/.env.example (agora commitável)
    - apps/web/.env.example (agora commitável — já existia no disco)
    - apps/web/.env.local.example (novo)
  modified:
    - apps/api/src/index.ts
    - apps/api/package.json
    - package.json (raiz)
    - .gitignore
    - apps/api/CONTEXT.md
    - apps/api/src/rotas/CONTEXT.md
    - CONTEXT.md (raiz)

key-decisions:
  - "membroPorUsuario(workspaceId, userId) mantida com a assinatura exata do contrato <interfaces> (sem parâmetro de cliente Postgres opcional) — usa pool() direto, igual ao padrão de conexao.ts"
  - "Task 1 cria OpcoesDoApp só com workspaceId/webOrigin/logger (sem autenticação ainda); Task 2 estende com verificarToken/resolverMembro e conecta registrarAutenticacao — refletindo a divisão do plano em duas tarefas, cada uma com seu commit"
  - "Comentários que citavam '.listen(' ou 'fastify-plugin' como substring literal foram reescritos para não colidir com os greps de aceitação (T-1 acceptance criteria), preservando o mesmo significado"
  - "[Rule 2] .gitignore ganhou exceção (!.env.example, !.env.local.example): o padrão .env* pré-existente ignorava também os arquivos de exemplo, então apps/api/.env.example nunca havia sido commitado — o done-criterion explícito da Task 3 ('quem clona o repositório encontra todas as variáveis documentadas') não se sustentava sem isso. Conferido que nenhum dos três .example agora tracked contém segredo real (só placeholder e o project ref público, que já está em PROJECT.md)"
  - "apps/web/.env.local.example ganhou apenas as duas chaves novas (NEXT_PUBLIC_API_URL, API_URL) com uma nota apontando para apps/web/.env.example (Supabase) — não duplicou as chaves já documentadas lá, para não ter duas fontes da mesma informação"

requirements-completed: [PERS-04]

# Metrics
duration: ~75min
completed: 2026-09-16
---

# Phase 1 Plan 02: Fastify em `apps/api` com JWT do Supabase e Membro por `userId` Summary

**`apps/api` responde em `http://127.0.0.1:3002`: `buildApp()`/`app.inject()` sem socket, hook `onRequest` que verifica `getClaims()` e resolve o Membro por `userId` dentro do Espaço configurado (401/403 aplicados pelo backend, não só pela tela), CORS por allowlist, e `npm run dev` subindo web+api juntos.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-09-16 (aprox. 14:35 UTC)
- **Completed:** 2026-09-16T15:52:00Z
- **Tasks:** 3/3
- **Files modified:** 17 (10 criados, 7 modificados)

## Accomplishments

- `apps/api` deixou de ser um `export {}`: agora é um servidor Fastify 5 de verdade, com `buildApp()` separado de `.listen()` especificamente para permitir `app.inject()` nos testes (Pattern 3, RESEARCH.md) — sem abrir socket, sem `DATABASE_URL`/`SUPABASE_*` nas partes que não precisam.
- D-02 materializado: `GET /saude` é a única rota pública; qualquer outra exige `Authorization: Bearer`, verificado por `supabase.auth.getClaims(token)` (nunca reimplementado com `jose`), e o Membro é resolvido por `userId === sub` **dentro do `WORKSPACE_ID` configurado no servidor** — nunca por um id que o cliente mande (T-1-02).
- A regra de acesso do front (`state === "ativo" || "suspenso"`) agora também é aplicada pelo backend: Membro `removido`/`pendente` recebe 403 com a mesma frase que `sessao-provider.tsx` já usa.
- CORS por allowlist explícita (`origin: [WEB_ORIGIN]`), nunca `*`; provado por dois casos de `app.inject` (origem permitida recebe o header, outra origem não).
- Todo 4xx/5xx do transporte responde `{ ok: false, error }` em pt-BR; erro não tratado vai ao log do processo, nunca ao corpo da resposta (T-1-06).
- `npm run dev` na raiz sobe `apps/web` (3001) e `apps/api` (3002) juntos via `concurrently`, com prefixo de log por processo; `npm run dev:web` preserva o comportamento anterior. Smoke-testado nesta execução: `GET /saude` → 200, `GET /estado` → 401, `Ctrl+C`/kill encerra o processo limpo.
- `apps/api/.env.example` e `apps/web/.env.local.example` (novo) documentam `PORT`, `HOST`, `WEB_ORIGIN`, `WORKSPACE_ID`, `LOG_LEVEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_API_URL`, `API_URL` — e agora chegam a quem clona o repositório (ver Deviations).
- `npm run check` verde nos três workspaces: 24 testes em `@n1/api` (12 novos desta plan), 33 em `@n1/web`, 232 em `@n1/dominio` — 289 no total.

## Task Commits

Each task was committed atomically:

1. **Task 1: Instalar a camada HTTP e criar `buildApp()` com CORS, saúde e tratamento de erro** - `307f1c3` (feat)
2. **Task 2: Hook de autenticação — JWT do Supabase verificado e Membro resolvido por `userId` (D-02)** - `8deabfa` (feat)
3. **Task 3: `npm run dev` sobe web + api; variáveis de ambiente e CONTEXT.md atualizados** - `64876c4` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/api/src/app.ts` - `buildApp(opcoes?): FastifyInstance`; monta CORS, zod validator/serializer, `setNotFoundHandler`/`setErrorHandler`, `registrarAutenticacao`, `GET /saude`; nunca chama `.listen()`
- `apps/api/src/index.ts` - reescrito: só `carregarEnv()` + `buildApp({ logger: true })` + `.listen()`
- `apps/api/src/app.test.ts` - 4 casos via `app.inject`: saúde 200, rota inexistente 401 (autenticação antes do 404), CORS permitido/negado
- `apps/api/src/plugins/autenticacao.ts` - `registrarAutenticacao`, `MembroDaSessao`, `OpcoesDeAutenticacao`; `declare module "fastify"` para `request.membro`/`FastifyContextConfig.publica`
- `apps/api/src/plugins/autenticacao.test.ts` - 6 casos sem banco (401 sem token, 401 token inválido, 403 sem Membro, 403 removido, 200 ativo com `workspaceId` da config, `/saude` público) + 2 contra o Postgres real (`membroPorUsuario`, pula sem `DATABASE_URL`)
- `apps/api/src/plugins/CONTEXT.md` - o que é um plugin aqui, o contrato de `autenticacao.ts`, a regra de acesso replicada do front
- `apps/api/src/autenticacao/verificar-token.ts` - `verificarTokenDoSupabase`, `VerificarToken`, `ClaimsDaSessao`; client Supabase singleton preguiçoso, mesmo padrão de `pool()`
- `apps/api/src/persistencia/membros.ts` - `membroPorUsuario(workspaceId, userId)`, uma consulta sobre o índice de expressão da migração 002
- `apps/api/package.json` - `scripts.dev` (`vite-node --watch src/index.ts`); `fastify`, `@fastify/type-provider-zod`, `@fastify/cors`, `zod` em `dependencies`
- `package.json` (raiz) - `scripts.dev` via `concurrently`; `scripts["dev:web"]` novo; `concurrently` em `devDependencies`
- `.gitignore` - exceção `!.env.example`/`!.env.local.example` sobre o padrão `.env*`
- `apps/api/.env.example` - acrescenta `PORT`, `HOST`, `WEB_ORIGIN`, `WORKSPACE_ID`, `LOG_LEVEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (mantido `DATABASE_URL` pré-existente)
- `apps/web/.env.example` - agora commitável (já existia no disco, sem alteração de conteúdo)
- `apps/web/.env.local.example` - novo: `NEXT_PUBLIC_API_URL`, `API_URL`
- `apps/api/CONTEXT.md` - "Estado: servidor HTTP no ar" substitui "esqueleto"; tabela de pastas ganha `src/plugins/`, `src/app.ts`, `src/bootstrap/`; seção "O que decidir" vira "O que já foi decidido"
- `apps/api/src/rotas/CONTEXT.md` - descreve `operacoes.ts`/`estado.ts` que chegam no Plan 01-04
- `CONTEXT.md` (raiz) - linha de `apps/api/` atualizada; "Estado atual" descreve autenticação real; tabela de comandos ganha `npm run dev` (web+api) e `npm run dev:web`

## Decisions Made

- `membroPorUsuario` manteve a assinatura de dois parâmetros exata do contrato `<interfaces>` do plano (`workspaceId, userId`), sem parâmetro de cliente Postgres opcional que eu havia cogitado inicialmente — evita divergência do que os Plans 01-04/01-08/01-09 esperam encontrar.
- A divisão de `app.ts` em duas tarefas (Task 1 sem autenticação, Task 2 completando com `registrarAutenticacao`) seguiu literalmente a orientação do plano — cada arquivo aparece modificado em dois commits, refletindo o "casca primeiro, depois a regra de acesso" do desenho original.
- Comentários que continham `.listen(` (como parte de `` `.listen()` `` em prosa) ou `fastify-plugin` como substring foram reescritos para não colidir com os `grep` de critério de aceitação — sem perder o "porquê" que o comentário original carregava.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `.env.example` nunca era commitado — `.gitignore` ignorava por padrão de nome**
- **Found during:** Task 3, ao tentar `git add` de `apps/api/.env.example`
- **Issue:** O `.gitignore` da raiz tem `.env*` sem exceção — isso ignora `.env`/`.env.local` (correto) mas também `.env.example`/`.env.local.example`. `apps/api/.env.example` já existia no disco (de uma sessão anterior) mas `git ls-files` confirmou que nunca havia sido commitado. O done-criterion explícito da Task 3 — "quem clona o repositório encontra todas as variáveis documentadas" — não se sustentava: ninguém que clonasse o repo veria esse arquivo.
- **Fix:** Acrescentadas duas linhas de exceção ao `.gitignore` (`!.env.example`, `!.env.local.example`), sem tocar em nenhum padrão de `.env`/`.env.local` real. Conferido, com `python3` (sem imprimir os valores), que os três arquivos agora rastreáveis (`apps/api/.env.example`, `apps/web/.env.example`, `apps/web/.env.local.example`) contêm só placeholder — nenhuma credencial real, nenhuma senha, nenhuma chave secreta. A única menção ao id do projeto Supabase (`epomplsskqpluxuujpxl`) é um comentário explicativo que já é público em `PROJECT.md`.
- **Files modified:** `.gitignore`, `apps/api/.env.example`, `apps/web/.env.example`, `apps/web/.env.local.example`
- **Verification:** `git check-ignore -v` confirma que os três `.example` não são mais ignorados; `git status --short` os lista como `??`/staged, nunca como `!!`; `npm run check` continua verde.
- **Committed in:** `64876c4` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — funcionalidade crítica faltante: documentação de ambiente inacessível a quem clona)
**Impact on plan:** Necessário para o próprio critério de sucesso que a Task 3 declara. Nenhum segredo real foi exposto — conferido antes de commitar.

## Issues Encountered

- `app.decorateRequest("membro", null)` não compilava (TS2345: `null` não é atribuível a `MembroDaSessao`) — a sobrecarga de tipos do Fastify para decorar com `null`/`undefined` exige um terceiro argumento `dependencies: string[]`. Corrigido para `app.decorateRequest("membro", null, [])`.
- `USUARIOS_DO_SEED.mem_maryane`/`.mem_tiago` no teste do hook tinham tipo `string | undefined` (o `Record<Id, string>` é um index signature, e `noUncheckedIndexedAccess` degrada o acesso por propriedade também) — trocado para `usuarioDoSeed("mem_maryane")`/`usuarioDoSeed("mem_tiago")`, que já existe no domínio e devolve `string` (lança se o Membro não tiver Usuário no seed).
- Dois comentários em prosa continham as substrings literais `.listen(` e `fastify-plugin`, colidindo com os `grep` de critério de aceitação do próprio plano (que checam a AUSÊNCIA dessas strings em `app.ts`/`autenticacao.ts`). Reescritos para preservar o sentido sem a colisão textual.

## User Setup Required

None - `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DATABASE_URL` já estavam configurados em `apps/api/.env` de plans anteriores (confirmado indiretamente: os 2 testes de `membroPorUsuario` contra o banco real rodaram, não pularam).

## Next Phase Readiness

- Plan 01-04 (rotas HTTP por operação) pode registrar `POST /operacoes/:nome`/`GET /estado` na instância que `buildApp()` já monta — o hook de autenticação já protege qualquer rota nova por padrão, sem precisar repetir a checagem.
- Plan 01-07 (`store.ts` → API) tem `NEXT_PUBLIC_API_URL`/`API_URL` documentados em `apps/web/.env.local.example` e sabe que toda resposta não-200 é `{ ok: false, error }`.
- Plan 01-08/01-09 podem reutilizar `verificarTokenDoSupabase`/`membroPorUsuario` (client Supabase e consulta já existem, mesmos padrões de singleton preguiçoso de `conexao.ts`).
- Nenhum bloqueio conhecido para os planos seguintes desta fase. PERS-08 (onde o `apps/api` roda) continua bloqueado por D11, fora do escopo desta plan.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 16 arquivos citados em Files Created/Modified (mais este SUMMARY.md) encontrados em disco; os três hashes de task (`307f1c3`, `8deabfa`, `64876c4`) encontrados em `git log --oneline --all`.
