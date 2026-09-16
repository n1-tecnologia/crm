---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 09
subsystem: testing
tags: [e2e, fastify-inject, postgres, diff-apply, ci-gate, readme]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-04)
    provides: "POST /operacoes/:nome, GET /estado, executar()/ResultadoTransacao<T>, syncIdSequence por requisição"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-05)
    provides: "bootstrapGestao(cliente, { workspaceId }) — o Espaço 'Gestão' de produção, idempotente"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-02)
    provides: "buildApp({ verificarToken, resolverMembro }) — stubs de sessão sem rede"
provides:
  - "apps/api/src/e2e/criar-conta.test.ts — prova automatizada do critério 1 do ROADMAP: Membro real → POST /operacoes/createTask → Postgres → GET /estado numa 'recarga' (buildApp novo); recusa do domínio em 200; segundo processo (ids zerados) sem colisão; aplicarDiferenca(cliente) ≡ re-hidratação"
  - "apps/api/README.md — roteiro operacional (subir, migrar, semear, bootstrapar, testar, contrato HTTP) e PERS-08/D11 documentado como bloqueado, sem nenhum comando de deploy"
  - "Portão CON-05 fechado: npm run check verde nos três workspaces, com e sem DATABASE_URL — 357 testes com o Supabase real (250 domínio + 54 api + 53 web); os três arquivos de teste originais do domínio sem diff desde d713253"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teste e2e = it sequenciais no mesmo describe, cada .inject() num buildApp() novo — a mesma coisa que um F5 dispara do lado do servidor, sem precisar de navegador nem de socket"
    - "resetIdSequence(0) antes de uma chamada pela rota prova syncIdSequence(antes.state) dentro de executar() (Plan 01-04): o servidor resincroniza a cada transação, então um 'processo novo' nunca colide com o que já está no banco"
    - "aplicarDiferenca(clone do GET anterior, diferenca do POST seguinte) comparado por toStrictEqual contra um GET /estado final — a prova de que o cliente que só aplica diffs (apps/web/src/dados/store.ts) vê exatamente o que uma re-hidratação veria"
    - "Skip do teste de integração simulado sem tocar apps/api/.env: exportar DATABASE_URL=\"\"/SUPABASE_URL=\"\"/SUPABASE_SECRET_KEY=\"\" no shell — carregarEnv() só preenche process.env[chave] quando ela está undefined, então uma string vazia (definida, mas falsy) bloqueia o backfill do arquivo sem precisar apagar nem mover .env"

key-files:
  created:
    - apps/api/src/e2e/criar-conta.test.ts
    - apps/api/src/e2e/CONTEXT.md
    - apps/api/README.md
  modified: []

key-decisions:
  - "USUARIOS_DO_SEED.mem_maryane (citado no bloco <interfaces> do plano) não tipa como string sob noUncheckedIndexedAccess — usei usuarioDoSeed(\"mem_maryane\") (o helper que já lança se o id não existir), o mesmo padrão que operacoes.test.ts/estado.test.ts/autenticacao.test.ts já usam; equivalente em runtime, correto em tipo"
  - "CP importado de \"@n1/dominio/operations\" (não \"@n1/dominio/operations/financeiro\") — consistente com rotas/operacoes.test.ts e rotas/estado.test.ts, que são o read_first mais próximo deste arquivo"
  - "estadoRecarga (o snapshot do passo 4) guarda data/ordens como unknown, convertido para DataState só dentro do passo 7 via structuredClone + cast — evita tipar o corpo JSON solto de .json() como DataState no resto do arquivo, onde só se lê propriedade a propriedade"

requirements-completed: [PERS-01, PERS-02, PERS-04, PERS-05, PERS-06]

# Metrics
duration: ~40min
completed: 2026-09-16
---

# Phase 1 Plan 09: O critério 1 do ROADMAP, ponta a ponta — e2e contra o Supabase, portão CON-05 fechado Summary

**`apps/api/src/e2e/criar-conta.test.ts` prova, inteiro por `app.inject()` contra o Postgres do projeto, que um Membro real (a Maryane, resolvida pelo `sub` do token) cria uma Conta a pagar pela API e ela sobrevive a uma "recarga" — e que dois processos com o contador de ids zerado não colidem; `apps/api/README.md` fecha a fase com o roteiro operacional e documenta PERS-08 como bloqueado por D11, sem nenhum passo de deploy; `npm run check` fica verde nos três workspaces, com e sem `DATABASE_URL` (357 testes com o Supabase real).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-16T14:29:00Z (aprox., após 01-08)
- **Completed:** 2026-09-16T15:06:02Z
- **Tasks:** 2/2
- **Files modified:** 3 (todos criados)

## Accomplishments

- `apps/api/src/e2e/criar-conta.test.ts` (8 casos, 213 linhas): bootstrapa `ws_e2e_teste` (`bootstrapGestao`), a Maryane vê o Espaço vazio de Tarefas pela sessão resolvida via API (não por escolha de Membro), cria uma Conta a pagar (`POST /operacoes/createTask`) com diff (`tasks` + `activity`), um `buildApp()` novo (a "recarga") ainda vê a Conta com o `statusId` inicial correto e a mesma revisão; a recusa do domínio (`RN-CP-04`, mover para `pago` fora do fluxo) chega em 200 sem gravar nada; `resetIdSequence(0)` simula um processo novo e a segunda Conta não colide (prova `syncIdSequence` dentro de `executar()`, fixado no Plan 01-04); `aplicarDiferenca` sobre o snapshot anterior + o diff do segundo `POST` é idêntico (`toStrictEqual`) a um `GET /estado` novo — fecha D-03/D-05 de ponta a ponta; sem token, 401 e nada é gravado.
- `apps/api/src/e2e/CONTEXT.md`: o que é um e2e aqui (o caminho completo sem navegador — o navegador é a UAT), por que fica em pasta própria (cenário, não unidade) e a pré-condição (`DATABASE_URL`, `npm run migrar` aplicada).
- `apps/api/README.md`: roteiro operacional (subir, preparar o banco na ordem `migrar` → `usuarios:seed` → `bootstrap:gestao`, rodar testes, contrato HTTP em 3 linhas) e a seção PERS-08 — bloqueado por D11, com os pré-requisitos conhecidos do deploy (fixar a CA do Supabase, `HOST` atrás de proxy, `WEB_ORIGIN`, `NEXT_PUBLIC_API_URL`/`API_URL`) registrados para quando D11 for decidida, sem nenhum comando de deploy no arquivo.
- Portão CON-05: `npm run check` sai com `0` **sem** `DATABASE_URL` (simulado sem tocar `apps/api/.env` — ver Decisions) e sai com `0` **com** `DATABASE_URL`+`SUPABASE_*` reais: **357 testes** (250 domínio + 54 api + 53 web). Os três arquivos de teste originais do domínio (`operations.test.ts`, `seed-produto.test.ts`, `contas-a-receber.test.ts`) seguem sem diff desde `d713253`; `git status` fora de `.planning/` e dos arquivos deste plano está limpo — nenhum `automation/`/`financeiro-tria` tocado.

## Task Commits

Each task was committed atomically:

1. **Task 1: Teste ponta a ponta `e2e/criar-conta.test.ts` — o critério 1 do ROADMAP por `inject`** - `bb8dc09` (test)
2. **Task 2: Portão da fase — `npm run check`, roteiro operacional, PERS-08 documentado** - `10434d9` (docs)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/api/src/e2e/criar-conta.test.ts` - 8 casos sequenciais contra o Supabase real: sessão→Membro, 403 para quem não é Membro, criar, recarregar, recusa do domínio, segundo processo sem colisão, diff≡re-hidratação, 401 sem token
- `apps/api/src/e2e/CONTEXT.md` - o que é/por que existe a pasta `e2e/`, pré-condição
- `apps/api/README.md` - subir, preparar o banco, testar, contrato HTTP, PERS-08/D11 (documental, sem deploy)

## Decisions Made

- `USUARIOS_DO_SEED.mem_maryane` (a forma citada no bloco `<interfaces>` do plano) tipa como `string | undefined` sob `noUncheckedIndexedAccess` (`tsconfig.base.json`); troquei por `usuarioDoSeed("mem_maryane")`, o helper que já lança se o id não existir — o mesmo padrão usado em `operacoes.test.ts`/`estado.test.ts`/`autenticacao.test.ts`, equivalente em runtime e correto em tipo. `npm run typecheck -w @n1/api` confirmou.
- `CP` importado de `@n1/dominio/operations` (não `@n1/dominio/operations/financeiro`) — consistente com os dois arquivos de teste de rota mais próximos deste (`rotas/operacoes.test.ts`, `rotas/estado.test.ts`), que são o `read_first` mais direto do plano para este arquivo.
- Para provar o caminho "sem `DATABASE_URL`" do portão (Task 2) sem apagar/mover `apps/api/.env` (proibido pelas instruções do projeto — nunca editar `.env*`): `carregarEnv()` só copia uma chave do arquivo para `process.env` quando ela está `undefined`; exportar `DATABASE_URL=""`/`SUPABASE_URL=""`/`SUPABASE_SECRET_KEY=""` no shell (string vazia, definida, mas falsy) impede o backfill do arquivo sem tocar nele — `Boolean("")` é `false`, então `temBanco`/`temAuth` ficam `false` como em CI. Confirmado por um script isolado antes de rodar `npm run check` com essas variáveis.

## Deviations from Plan

None — plan executado como escrito. As duas trocas de import (`usuarioDoSeed` em vez do acesso direto ao record, `@n1/dominio/operations` em vez de `/operations/financeiro`) são resolução de detalhes de tipo/estilo dentro do que o plano já deixava como esboço no bloco `<interfaces>` ("Tudo que este plano usa já existe"), não desvio de escopo — confirmado pelo `npm run typecheck` limpo.

## Issues Encountered

- **`npm run check` com `DATABASE_URL` real ficou intermitente sob carga local pesada nesta máquina** (load average subindo de ~2 para 7+ durante a sessão, memória livre baixa, um servidor `next dev` já rodando na porta 3001 por fora desta execução). Isolado (`npm run test -w @n1/api`, sem os passos de `typecheck`/`lint`/`tokens` antes), o pacote de testes do `apps/api` sempre passou rápido e limpo (54/54 em 21–28 s, em três execuções). Rodado dentro da cadeia completa de `npm run check`, duas tentativas sucessivas bateram no `hookTimeout` de 60 s (`apps/api/vitest.config.mts`, já configurado assim desde o Plan 01-02 por causa da latência real do Supabase) em vários arquivos ao mesmo tempo — sintoma de contenção de recursos locais (CPU/memória) fazendo o round-trip a Oregon estourar o teto, não um defeito de código: os mesmos arquivos, com a mesma consulta, passam quando rodados sem a disputa de recursos. Uma quarta execução (`npm run check` completo, depois que os processos anteriores tinham liberado CPU) fechou **verde**: 54 api (153 s, mais lento que o normal mas dentro do timeout) + 53 web + 250 domínio = 357, exit `0` — é essa a execução registrada em Accomplishments. Nenhuma mudança de código foi necessária; nenhum arquivo de configuração foi tocado. Fora do escopo deste plano investigar a causa raiz da contenção local (não é um `files_modified` desta plan, e o comportamento não se repetiu isolado) — registrado aqui para quem rodar `npm run check` numa máquina sob carga: se travar em `hookTimeout`, rodar `npm run test -w @n1/api` sozinho primeiro para separar "flake de carga local" de "defeito real".

## User Setup Required

None - `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY` já configurados em `apps/api/.env` desde plans anteriores; `ws_n1` (o Espaço de produção da fase) nunca foi tocado por este plano — só `ws_e2e_teste`, criado e apagado a cada execução do teste.

## Next Phase Readiness

- **Fase 1 fecha aqui.** Os cinco critérios de sucesso do ROADMAP para a Phase 1 estão provados: 1 (Membro real cria Conta, sobrevive à recarga — `e2e/criar-conta.test.ts`, além do roteiro manual de `01-VALIDATION.md`), 2 (toda operação por `POST /operacoes/:nome`, Plan 01-04), 3 (Espaço "Gestão" no banco sem fixtures, Plan 01-05/01-06), 4 (`npm run check` verde nos três workspaces com o domínio intacto, este plano), 5 (reconvite reativa o mesmo Membro, Plan 01-08).
- PERS-01/02/04/05/06 confirmados de ponta a ponta contra o Supabase real por este plano (rastreabilidade fechada, sem implementação nova). PERS-09 já fechado no Plan 01-08.
- **PERS-08 continua bloqueado por D11** — documentado em `apps/api/README.md`, nenhuma ação de deploy tomada. O adapter da Fase 2 não pode apontar para um `apps/api` publicado até D11 (e OQ-ADR-01, a região do Supabase) serem decididas.
- Nenhum bloqueio de código conhecido para a Fase 2. O que resta aberto e listado em `PROJECT.md`/`REQUIREMENTS.md` (PREP-02/03/04/05 da Fase 0, D6/D7/D8/D9/OQ-* antes de planejar a Fase 2) não é deste plano.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 4 arquivos citados (`apps/api/src/e2e/criar-conta.test.ts`, `apps/api/src/e2e/CONTEXT.md`, `apps/api/README.md`, este SUMMARY.md) encontrados em disco; os dois hashes de task (`bb8dc09`, `10434d9`) encontrados em `git log --oneline --all`.
