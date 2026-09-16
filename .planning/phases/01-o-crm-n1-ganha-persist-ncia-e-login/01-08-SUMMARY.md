---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 08
subsystem: api
tags: [domain, auth, supabase-admin-api, service-layer, dispatch-registry]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-04)
    provides: "POST /operacoes/:nome — despacho por OPERACOES, executar()/ResultadoTransacao<T>, MembroDaSessao"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-02)
    provides: "verificar-token.ts — client Supabase Admin (createClient com SUPABASE_SECRET_KEY)"
provides:
  - "inviteMember(state, acting, { email, roleId, userId? }) — casa existing por userId antes de invitedIdentity; reativa o mesmo Membro removido mesmo sem invitedIdentity (B27)"
  - "resolverUsuarioPorEmail(email) — Promise<string | undefined>, pagina admin.listUsers e compara case-insensitive (Admin API sem filtro por e-mail, A1 confirmada)"
  - "clienteAdmin() — fábrica lazy exportada de verificar-token.ts, reutilizada por resolver-usuario.ts"
  - "convidarMembro(pedido, deps?) — primeiro arquivo de apps/api/src/servicos/: resolve e-mail ANTES de executar(), compõe o userId dentro de inviteMember"
  - "SERVICOS (rotas/operacoes.ts) — despacho de inviteMember para convidarMembro(); demais operações direto por executar(); zod .strip() descarta userId do corpo"
affects: [01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serviço = I/O ANTES da Unidade de Trabalho, operação pura DENTRO dela — apps/api/src/servicos/convidar-membro.ts é o primeiro exemplo do contrato que CONTEXT.md já previa"
    - "SERVICOS (Partial<Record<NomeDeOperacao, ...>>) na rota: uma operação sem entrada aqui segue o caminho de hoje (executar() direto); só entra quando precisa de I/O antes da transação"
    - "Erro de validação de um serviço vira classe local (ErroDeEntrada) capturada na própria rota — 400, nunca sobe ao setErrorHandler genérico (500)"

key-files:
  created:
    - packages/dominio/src/operations/members-reconvite.test.ts
    - apps/api/src/autenticacao/resolver-usuario.ts
    - apps/api/src/autenticacao/resolver-usuario.test.ts
    - apps/api/src/autenticacao/CONTEXT.md
    - apps/api/src/servicos/convidar-membro.ts
    - apps/api/src/servicos/convidar-membro.test.ts
  modified:
    - packages/dominio/src/operations/members.ts
    - apps/api/src/autenticacao/verificar-token.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/servicos/CONTEXT.md

key-decisions:
  - "existing (em inviteMember) casa por userId quando input.userId vem preenchido; só cai para o casamento por invitedIdentity quando userId está ausente — retrocompatível com toda chamada existente (apps/web ainda não passa userId)"
  - "Membro pendente pode carregar userId E invitedIdentity ao mesmo tempo na criação: o tipo já permitia (Member.userId? é opcional em qualquer state); o aceite do convite (mudança para ativo) continua fora do escopo desta fase"
  - "Validação de entrada de um serviço (SERVICOS.inviteMember) é uma classe local ErroDeEntrada, capturada por um try/catch só ao redor da chamada ao serviço na própria rota — mais simples que introduzir um tipo de erro compartilhado entre rotas e serviços para um único caso de uso"
  - "clienteAdmin() nasce por renomear a fábrica lazy já existente em verificar-token.ts (era função interna cliente()) — resolver-usuario.ts reutiliza a mesma instância de processo, sem duplicar a leitura de SUPABASE_SECRET_KEY"
  - "convidar-membro.test.ts (c) — o caso ponta a ponta pela rota usa sempre o resolvedor REAL (a rota nunca injeta deps.resolverUsuario), então só roda com SUPABASE_*+DATABASE_URL; rodou de fato nesta execução (ambos configurados) e provou o userId forjado no corpo sendo ignorado"

requirements-completed: [PERS-09]

# Metrics
duration: ~50min
completed: 2026-09-16
---

# Phase 1 Plan 08: Reconvite reativa o mesmo Membro (RN-ET-11) — a ponte e-mail → userId nasce em apps/api Summary

**`inviteMember` (domínio puro) passa a casar por `userId` quando o input traz o dado; `apps/api/src/autenticacao/resolver-usuario.ts` resolve esse `userId` contra a Admin API do Supabase (paginando `listUsers`, sem filtro nativo por e-mail); `apps/api/src/servicos/convidar-membro.ts` — o primeiro arquivo da pasta — compõe as duas peças antes de entrar na Unidade de Trabalho, e `POST /operacoes/inviteMember` despacha para lá, descartando qualquer `userId` que o cliente mande.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-16T17:07:00Z (aprox., após 01-05)
- **Completed:** 2026-09-16T17:57:00Z (aprox.)
- **Tasks:** 2/2
- **Files modified:** 10 (6 criados, 4 modificados)

## Accomplishments

- `inviteMember` (`packages/dominio/src/operations/members.ts`) ganha `input.userId?`: a busca por `existing` casa primeiro por `member.userId === input.userId` quando o dado vem preenchido, só caindo para `invitedIdentity` quando não vem — fecha a lacuna descrita no Pitfall 5 do RESEARCH.md (o e-mail some do estado depois do aceite, B27, então o domínio puro não tinha como reencontrar um Membro que já foi `ativo`).
- `members-reconvite.test.ts` (arquivo novo, 6 casos): reativa `mem_tiago` (fixture `removido` do seed, com `userId` e sem `invitedIdentity` — exatamente o estado pós-aceite) pelo `userId`; sem `userId` o mesmo e-mail cria um Membro novo (documenta a lacuna que o serviço fecha); `userId` de um Membro ativo recusa; e-mail+`userId` inéditos criam um Membro com os dois campos; e-mail inválido recusa antes da busca por `userId`; o limite RN-ET-23 vale também no caminho por `userId`. `operations.test.ts` sem diff.
- `apps/api/src/autenticacao/resolver-usuario.ts`: `resolverUsuarioPorEmail(email)` pagina `admin.auth.admin.listUsers({ page, perPage: 1000 })` até `data.nextPage` ser `null` ou até 10 páginas, comparando `email` case-insensitive — confirma a Assumption A1 do RESEARCH.md: a Admin API instalada (`@supabase/auth-js` via `supabase-js` 2.116.0) não tem filtro por e-mail, só `page`/`perPage`.
- `apps/api/src/autenticacao/verificar-token.ts`: a fábrica lazy do client Supabase Admin (antes `cliente()`, interna) vira `clienteAdmin()`, exportada — `resolver-usuario.ts` reutiliza a mesma instância de processo em vez de outro `createClient`.
- `apps/api/src/servicos/convidar-membro.ts` — o primeiro arquivo da pasta, o exemplo do contrato que `CONTEXT.md` já previa: `convidarMembro(pedido, deps?)` resolve o e-mail ANTES de `executar()`, e o `userId` resolvido entra em `inviteMember` dentro da transação. `deps.resolverUsuario` existe só para teste.
- `apps/api/src/rotas/operacoes.ts`: `SERVICOS` (um `Partial<Record<NomeDeOperacao, ...>>`) intercepta `inviteMember` antes de `executar()` direto; o schema `z.object({ email, roleId }).strip()` descarta qualquer `userId` que o cliente mande no corpo (T-1-08) — a única fonte de `userId` é `resolverUsuarioPorEmail`, nunca a requisição. Uma entrada inválida lança `ErroDeEntrada` (classe local), capturada na própria rota como 400 — nunca sobe ao `setErrorHandler` genérico (500).
- Testes: `resolver-usuario.test.ts` (3 casos, contra o Supabase Auth real — roda porque `SUPABASE_*` está configurado neste ambiente) e `convidar-membro.test.ts` (4 casos: reativa `mem_tiago` com resolvedor falso; cria Membro sem conta no Auth; 400 sem banco; e a rota ponta a ponta com `userId` forjado ignorado — rodou de verdade porque `DATABASE_URL`+`SUPABASE_*` estavam configurados).
- `npm run check` verde nos três workspaces: **250 domínio** (244 anteriores + 6 novos) + **46 api** (39 anteriores + 7 novos) + **53 web** = **349 testes**.

## Task Commits

Each task was committed atomically:

1. **Task 1: `inviteMember` casa por `userId` (domínio puro) — teste em arquivo novo** - `cb45654` (feat)
2. **Task 2: `resolverUsuarioPorEmail` (Admin API), serviço `convidarMembro` e despacho na rota** - `74cd275` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `packages/dominio/src/operations/members.ts` - `inviteMember` ganha `input.userId?`; `existing` casa por `userId` antes de `invitedIdentity`; reativação e criação gravam `userId` quando presente
- `packages/dominio/src/operations/members-reconvite.test.ts` - 6 casos de reconvite por `userId` (RN-ET-11), arquivo novo
- `apps/api/src/autenticacao/resolver-usuario.ts` - `resolverUsuarioPorEmail`, `ResolverUsuario`; pagina `listUsers`, teto de 10 páginas
- `apps/api/src/autenticacao/resolver-usuario.test.ts` - 3 casos contra o Auth real, pula sem `SUPABASE_*`
- `apps/api/src/autenticacao/CONTEXT.md` - pasta nova documentada: `verificar-token.ts`, `criar-usuarios-do-seed.ts`, `resolver-usuario.ts`; regra "toda fala com o Auth passa por aqui"
- `apps/api/src/autenticacao/verificar-token.ts` - `cliente()` interna vira `clienteAdmin()` exportada
- `apps/api/src/servicos/convidar-membro.ts` - `convidarMembro`, `PedidoDeConvite` — o primeiro arquivo da pasta
- `apps/api/src/servicos/convidar-membro.test.ts` - 4 casos: (a)/(b) contra o banco com resolvedor falso, (c) pela rota com o Auth real, (d) 400 sem banco
- `apps/api/src/servicos/CONTEXT.md` - regra "serviço existe quando a operação precisa de I/O antes da UoW", exemplo `convidar-membro.ts`
- `apps/api/src/rotas/operacoes.ts` - `SERVICOS`, `ErroDeEntrada`, `ENTRADA_INVITE_MEMBER`; despacho condicional antes de `executar()`

## Decisions Made

- `existing` em `inviteMember` casa por `userId` só quando `input.userId !== undefined`; sem o dado, o comportamento é idêntico ao de antes (busca por `invitedIdentity`) — nenhuma chamada existente muda de resultado, incluindo as 5 chamadas de `apps/web` que ainda não passam `userId`.
- Um Membro `pendente` pode nascer com `userId` E `invitedIdentity` ao mesmo tempo (caso (d) do teste de domínio) — o tipo já permitia (`userId?` é opcional em qualquer `state`); o aceite do convite (mudança para `ativo`) continua sendo uma operação fora desta fase.
- Validação de entrada de um serviço na rota é uma classe local `ErroDeEntrada`, capturada por um `try/catch` só ao redor da chamada a `servico(...)` — mais simples que um tipo de erro compartilhado entre `rotas` e `servicos` para o único caso de uso desta fase; documentado no comentário do arquivo como a escolha entre as duas opções que o plano deixava em aberto.
- `clienteAdmin()` nasce de renomear a fábrica lazy já existente em `verificar-token.ts` (era `cliente()`, interna) — evita duplicar a leitura de `SUPABASE_SECRET_KEY` num segundo `createClient`.
- O caso (c) de `convidar-membro.test.ts` (ponta a ponta pela rota) usa sempre o resolvedor REAL — a rota nunca injeta `deps.resolverUsuario` — então só roda com `SUPABASE_*` e `DATABASE_URL` configurados; rodou de fato nesta execução e confirmou o `userId` forjado no corpo sendo ignorado, com o Auth real resolvendo `tiago@n1.teste` para o `userId` de `mem_tiago`.

## Deviations from Plan

None — plan executed exactly as written. A escolha entre "lançar `ErroDeEntrada`" e "validar antes de chamar" (deixada em aberto pelo plano) foi decidida a favor da primeira opção, documentada acima; não é um desvio de escopo, é a resolução da Discretion explícita do próprio plano.

## Issues Encountered

Nenhum. O ambiente já tinha `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DATABASE_URL` configurados em `apps/api/.env` desde plans anteriores, então todos os blocos de integração (banco real e Auth real) rodaram de verdade nesta execução — inclusive o caso (c), o mais arriscado (Open Question #1 do RESEARCH.md), que só teria sido exercitado parcialmente sem essas credenciais.

## User Setup Required

None - `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DATABASE_URL` já configurados em `apps/api/.env` desde plans anteriores; os 11 Usuários `<nome>@n1.teste` já existiam no Auth (`npm run usuarios:seed` de uma execução anterior) — `resolver-usuario.test.ts` e o caso (c) de `convidar-membro.test.ts` rodaram contra eles sem setup adicional.

## Next Phase Readiness

- Critério 5 do ROADMAP fechado: reconvidar um Usuário removido reativa o mesmo Membro — provado no domínio (`members-reconvite.test.ts`), contra o Postgres real (`convidar-membro.test.ts` (a)/(b)) e contra o Auth real (`convidar-membro.test.ts` (c), `resolver-usuario.test.ts`).
- Assumption A1 do RESEARCH.md confirmada e registrada em comentário no código (`resolver-usuario.ts`): não há filtro por e-mail em `admin.listUsers()` na versão instalada — a paginação em memória é necessária, não uma escolha por cautela.
- Nenhuma dependência nova instalada.
- Plan 01-09 (o último da fase) não depende de nenhum contrato novo específico deste plano além do que já valia — `inviteMember` continua compatível com toda chamada existente de `apps/web`.
- Nenhum bloqueio conhecido para o plano seguinte. PERS-08 (onde o `apps/api` roda) continua bloqueado por D11, fora do escopo desta fase.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 10 arquivos de código citados + este SUMMARY.md encontrados em disco; os dois hashes de task (`cb45654`, `74cd275`) encontrados em `git log --oneline --all`.
