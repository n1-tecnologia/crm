---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 73
files_reviewed_list:
  - apps/api/migracoes/008-canais-conversas-mensagens.sql
  - apps/api/src/e2e/canais-fluxo.test.ts
  - apps/api/src/persistencia/canais-projetados.test.ts
  - apps/api/src/persistencia/canais-projetados.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/repositorios/crm/canais-008.test.ts
  - apps/api/src/repositorios/crm/canais.ts
  - apps/api/src/repositorios/crm/contatos.ts
  - apps/api/src/repositorios/crm/conversas.ts
  - apps/api/src/repositorios/crm/mensagens.test.ts
  - apps/api/src/repositorios/crm/mensagens.ts
  - apps/api/src/repositorios/crm/referencias.ts
  - apps/api/src/rotas/crm/canais.test.ts
  - apps/api/src/rotas/crm/canais.ts
  - apps/api/src/rotas/crm/conversas.test.ts
  - apps/api/src/rotas/crm/conversas.ts
  - apps/api/src/rotas/crm/index.ts
  - apps/api/src/rotas/crm/mensagens.test.ts
  - apps/api/src/rotas/crm/mensagens.ts
  - apps/api/src/rotas/estado.ts
  - apps/api/src/servicos/crm/canais.test.ts
  - apps/api/src/servicos/crm/canais.ts
  - apps/api/src/servicos/crm/contatos.test.ts
  - apps/api/src/servicos/crm/contatos.ts
  - apps/api/src/servicos/crm/conversas.test.ts
  - apps/api/src/servicos/crm/conversas.ts
  - apps/api/src/servicos/crm/mensagens.test.ts
  - apps/api/src/servicos/crm/mensagens.ts
  - apps/api/src/testes/banco-crm.ts
  - apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx
  - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx
  - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page.tsx
  - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx
  - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx
  - apps/web/src/dados/crm/canais.test.ts
  - apps/web/src/dados/crm/canais.ts
  - apps/web/src/features/crm/conectar-canal.test.tsx
  - apps/web/src/features/crm/conectar-canal.ts
  - apps/web/src/features/crm/conectar-provedor.test.tsx
  - apps/web/src/features/crm/conectar-provedor.tsx
  - apps/web/src/features/crm/contact-card.tsx
  - apps/web/src/features/crm/conversation-thread.test.tsx
  - apps/web/src/features/crm/conversation-thread.tsx
  - apps/web/src/features/crm/deal-screen.tsx
  - apps/web/src/features/crm/ficha-do-canal.test.tsx
  - apps/web/src/features/crm/inbox-columns.test.tsx
  - apps/web/src/features/crm/inbox-columns.tsx
  - apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx
  - apps/web/src/features/crm/legado/ficha-de-empresa-legado.tsx
  - apps/web/src/features/crm/seletor-de-canal.tsx
  - apps/web/src/features/crm/selo-do-provedor.tsx
  - apps/web/src/features/crm/separador-de-canal.tsx
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - apps/web/src/features/ferramentas/flow-popup.tsx
  - apps/web/src/features/shell/rotas.test.ts
  - packages/dominio/src/crm/canais.test.ts
  - packages/dominio/src/crm/canais.ts
  - packages/dominio/src/crm/comum.ts
  - packages/dominio/src/crm/conversas.test.ts
  - packages/dominio/src/crm/conversas.ts
  - packages/dominio/src/crm/mensagens.test.ts
  - packages/dominio/src/crm/mensagens.ts
  - packages/dominio/src/crm/permissoes.test.ts
  - packages/dominio/src/crm/permissoes.ts
  - packages/dominio/src/derive-conversacional.test.ts
  - packages/dominio/src/derive-conversacional.ts
  - packages/dominio/src/derive.ts
  - packages/dominio/src/operations/canais.test.ts
  - packages/dominio/src/operations/canais.ts
  - packages/dominio/src/operations/capacidades-do-canal.test.ts
  - packages/dominio/src/operations/conversations.ts
  - packages/dominio/src/provedores-de-canal.ts
  - packages/dominio/src/types/crm.ts
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 73 (48 source read in full or by diff against `7d376b2`; 25 test files skimmed for coverage of what the source promises)
**Status:** issues_found

## Summary

The Fase 8 core is sound. Every repository query is scoped by `workspace_id` and parameterised. The Role is checked before any read or transaction. Constraint names in the `FRASES` tables match what Postgres generates for the 008 DDL, including the auto-named composite FKs. The `FOR UPDATE` locking, the `ON CONFLICT ... WHERE id_externo IS NOT NULL` idempotency, and the `carga_bruta` exclusion from `COLUNAS_DE_MENSAGEM` all hold up. The Canais bridge (`canais-projetados.ts` plus `semCanaisProjetados`) keeps a second source of truth out of `plataforma.registros`. I found no injection, authorization-bypass or cross-tenant path, and nothing that contradicts a closed 08-SECURITY mitigation.

There are no BLOCKER-class defects. The warnings are:
- a business rule (RN-CXE-19) that the server never applies to the first outbound message;
- a reopen path that leaves stale data and ignores the Canal's state;
- two web flows that report success or navigate while the store is stale;
- a "Responder por" selector that writes on selection;
- a quick-action regression with a misleading reason.

The infos are dead code, a mislabel, a global sequence exposed to tenants, and list ordering.

## Warnings

### WR-01: RN-CXE-19 is never enforced on a Conversa's first outbound Mensagem (server accepts cold free text on WhatsApp oficial / Instagram)

**File:** `apps/api/src/servicos/crm/conversas.ts:216-223`, `packages/dominio/src/crm/mensagens.ts:158-163` (`validarEnvio`), `apps/api/src/servicos/crm/mensagens.ts:114-124`
**Issue:**
- `criar` writes the opening `enviada` Mensagem without calling `validarEnvio` or `capacidadesDoCanal`.
- `validarEnvio` itself returns `ok` whenever `ultimaRecebidaEm === null`, so `enviar` has the same gap.
- A Conversa that has never received anything therefore accepts free text on a `whatsapp-cloud` or `instagram-graph` Canal, where `requiresTemplateOutsideWindow` is `true`.
- The phase's own wording contradicts this. `startConversation`'s doc (`operations/conversations.ts`) says "quem inicia fala sob as regras do Canal, e é `sendMessage` que as aplica na primeira Mensagem". But `sendMessage` and `windowOpenUntil` return no window when nothing was received, so the rule is never applied.
- `servicos/crm/mensagens.ts` promises "É o servidor que recusa, independente da tela". For a Conversa that was never answered, no one refuses.
- The Meta Cloud API rejects a business-initiated free-text message. When the real provider lands, the first Mensagem will fail with a status the model has no path for.

**Fix:** Decide the product rule explicitly and encode it in `validarEnvio`. If a cold start must also require a template, treat `ultimaRecebidaEm === null` as "outside the window" when `requiresTemplateOutsideWindow` is true, and call `validarEnvio` from `criar` as well:
```ts
// mensagens.ts (domínio)
if (!capacidades.requiresTemplateOutsideWindow) return ok(undefined);
const horas = capacidades.responseWindowHours;
if (horas === undefined) return ok(undefined);
const dentro = ultimaRecebidaEm !== null && agora <= Date.parse(ultimaRecebidaEm) + horas * 3_600_000;
if (dentro) return ok(undefined);
// ...restante (modelos aprovados)
```
If the current behaviour is intended, delete the contradicting comment in `startConversation` and add a test that pins "no inbound means free text allowed". That way the gap is a recorded decision.

### WR-02: Reabrir a Conversa keeps `resolvida_em`, unlike the legacy operation it mirrors

**File:** `apps/api/src/repositorios/crm/conversas.ts:181-185`
**Issue:**
- `definirSituacao` for `aberta` sets `reaberta_em` and increments `reaberturas`, but never clears `resolvida_em`.
- The legacy `reopenConversation` does `delete conversation.resolvedAt` (`operations/conversations.ts:297`).
- A reopened Conversa is therefore `situacao = 'aberta'` with a populated `resolvidaEm`. Any consumer that derives "resolved" from the timestamp (the Caixa relational is Deferred) will misread it, and the two models disagree on the same transition.
- `conversas.test.ts` only asserts `resolvidaEm` after resolving, not after reopening.

**Fix:**
```sql
update plataforma.conversas
   set situacao = $3, reaberta_em = now(), reaberturas = reaberturas + 1, resolvida_em = null
 where workspace_id = $1 and id = $2
 returning ...
```
Add an assertion that `resolvidaEm` is `null` after `reabrir`.

### WR-03: Resolver/reabrir ignore the Canal's state: a Conversa can be reopened in an archived Canal

**File:** `apps/api/src/servicos/crm/conversas.ts:111-137` (`mudarSituacao`)
**Issue:**
- `criar` refuses an archived Canal (line 170) and `enviar` refuses it (`mensagens.ts:109`).
- `reabrir` loads the Canal only to build the summary, after the write, and never checks `canal.estado`.
- The result is an `aberta` Conversa in a dead Canal. It occupies `conversas_nao_resolvida_uq` for the (Contato, Canal) pair, and nothing can be sent in it.
- The same applies to `registrarRecebida`, which writes into an archived Canal or a `na_lixeira` Conversa without a check.

**Fix:** In `mudarSituacao`, for `acao === "reabrir"`, load the Canal before writing and return 409 `CANAL_ARQUIVADO` when `canal.estado === "arquivado"`. Add the same guard (or an explicit comment that ingestion into archived Canais is deliberate) in `registrarRecebida`.

### WR-04: "Responder por" performs a persisted write on mere selection and leaves empty Conversas behind

**File:** `apps/web/src/features/crm/conversation-thread.tsx:387-403` (`trocarCanalDeResposta`), `apps/web/src/features/crm/seletor-de-canal.tsx:44-46`
**Issue:**
- Choosing a Canal in the dropdown runs `startConversation`. That creates an empty `aberta` Conversa (`messages: []`) in `registros`, writes an Activity Record, and bumps the Espaço revision for every other browser.
- Switching through three WhatsApp Canais to compare them leaves three empty Conversas in the inbox, each assigned to the user. This is the opposite of INV-CXE-05 ("não existe Conversa sem Mensagem"), which the relational side enforces in `POST /conversas`.
- Selection is expected to be a view operation. The docblock does state this is intentional (D-15), but it is a side-effecting write on `onChange`, with no confirmation and no undo.

**Fix:** Make the switch a pure view change (`setCanalAtivo`, `onCanalChange`) and create the Conversa only when the first Mensagem is sent, or when the user clicks "Abrir atendimento". The composer already has the `!conversa` branch, which says "Abra o atendimento antes de escrever". If the eager create is kept, say so in the placeholder or ask for confirmation.

### WR-05: `rehidratar()` swallows failures, so the Canal screens report success or navigate against a stale store

**File:** `apps/web/src/features/crm/conectar-provedor.tsx:82-97`, `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx:135-146`, `apps/web/src/dados/store.ts:255-260`
**Issue:**
- `rehidratar` returns normally on `{ tipo: "falha" }` (it only sets `lastResult`) and also on the stale-revision early return.
- In `confirmar`, after `criarCanal` succeeds, the code `await`s `rehidratar()` and then `router.push(.../canais/${canal.id})`. If the hydrate fails, the ficha renders "Canal não encontrado", because the Canal exists only in the server projection.
- In `executar`, the same swallow means the toast says "Conexão simulada." while the screen still shows "desconectada" and the "Simular conexão" button.
- A user who retries "Conectar" after the first blank page gets 409 `CANAL_NOME_EM_USO` for their own Canal.

**Fix:** Make `rehidratar` report its outcome (return a boolean or throw), and handle it at the call sites:
```ts
const ok = await rehidratar();
if (!ok) { setErro({ texto: "O Canal foi criado, mas não deu para recarregar. Atualize a página.", campo: undefined, canalId: canal.id }); setEnviando(false); return; }
```
Alternatively, have the ficha fall back to `GET /canais/:id` when the id is missing from `state.channels`.

### WR-06: Quick actions "WhatsApp"/"E-mail" regress for Contatos whose only Canal is not `conectada`, and the stated reason is wrong

**File:** `apps/web/src/features/crm/contact-card.tsx:311-343`
**Issue:**
- `canalPadraoDoTipo` goes through `canaisDeResposta`, which keeps only `connection === "conectada"`. Every Canal created by `POST /canais` is born `desconectada` (D-08), so until someone clicks "Simular conexão" the shortcuts are disabled, even though the Contato has the Identificador and an active Canal exists.
- The text shown is "Nenhum Canal de WhatsApp **ativo** alcança este Contato.", which is false. The Canal is active and reaches the Contato; it is disconnected. The person is sent to hunt for a missing Canal instead of connecting it.
- Before this phase the same action worked for any Contato with the Identificador.

**Fix:** Distinguish the two cases. If a Canal of the type reaches the Contato but none is connected, say "Nenhum Canal de WhatsApp conectado alcança este Contato. Conecte um em Configurações." (or fall back to the first reachable Canal so the shortcut still navigates). Only use the current "não alcança" text when `canaisDoFio(...).every(c => !c.alcancavel)` for that type.

## Info

### IN-01: Legacy-created Canais are labelled "demo" ("Canal de demonstração do seed")

**File:** `apps/web/src/features/crm/selo-do-provedor.tsx:41-46`
**Issue:**
- `SeloDeOrigem` shows "demo" for every Canal without `relational`. That includes Canais a user really created through `AdicionarCanalDialog` (`features/crm/adicionar-canal-dialog.tsx` still calls the legacy `criarCanal`, which persists in `registros`).
- Those Canais appear as "demo" with a tooltip saying they are seed data that will disappear at unification.

**Fix:** Either remove the legacy dialog's route to creation, or derive the label from the id (`chn_*` seed vs. user-created), or soften the tooltip to "Canal do modelo antigo".

### IN-02: Dead exports in `dados/crm/canais.ts`

**File:** `apps/web/src/dados/crm/canais.ts:35-62`
**Issue:**
- `useCanais`, `chaveDeCanais`, `FiltroDeCanais` and `RespostaDaListaDeCanais` are referenced only by their own test. The screens read Canais from the store, as the header comment says.
- That is unreachable code and a second read path that can silently disagree with `state.channels`.

**Fix:** Drop them (and `GET /canais`'s web client) until a screen needs them, or add the consumer.

### IN-03: `plataforma.mensagens.seq` is a database-global identity exposed to every tenant

**File:** `apps/api/migracoes/008-canais-conversas-mensagens.sql:137`, `apps/api/src/repositorios/crm/mensagens.ts:109`
**Issue:**
- `seq bigint generated always as identity` is a single sequence shared by all Espaços, and `seq` is returned in every Mensagem.
- The gaps between consecutive `seq` values in one Conversa reveal other tenants' message volume. It is minor, but it is cross-tenant metadata.

**Fix:** Either do not return `seq` (order by it internally only), or keep it and accept the leak explicitly. A per-conversation counter would remove it but costs a lock.

### IN-04: Conversas list is ordered by `atualizado_em`, which a new Mensagem never touches

**File:** `apps/api/src/repositorios/crm/conversas.ts:166`
**Issue:**
- `order by atualizado_em desc` is the natural "most recent first" order for an inbox. The `atualizado_em` trigger fires only on updates to `conversas`, and inserting a row in `mensagens` does not update the Conversa.
- A Conversa with a message sent just now sorts below one resolved yesterday.
- A related minor point: `emRespostaAId` pointing at a non-existent id (not only one in another Conversa) is also reported as "A Mensagem respondida é de outra Conversa." (`servicos/crm/mensagens.ts:57-60`).

**Fix:** Order by `greatest(atualizado_em, (select max(criado_em) from plataforma.mensagens m where m.workspace_id = c.workspace_id and m.conversa_id = c.id))`, or add a `ultima_atividade_em` column maintained when a Mensagem is inserted. Broaden the FK phrase to "A Mensagem respondida não existe nesta Conversa."

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
