# Phase 1: O CRM N1 ganha persistência e login - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 14 (novos ou modificados, extraídos de CONTEXT.md/RESEARCH.md)
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/api/src/app.ts` | config/bootstrap | request-response | `apps/api/src/persistencia/conexao.ts` (`pool()` singleton) + `apps/api/src/index.ts` (ponto de composição vazio) | role-match |
| `apps/api/src/index.ts` (reescrito) | config | request-response | ele mesmo, hoje `export {}` — segue o contrato descrito no `apps/api/CONTEXT.md` | exact (contrato já documentado) |
| `apps/api/src/plugins/autenticacao.ts` | middleware | request-response | `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (uso do client admin do Supabase) + `apps/web/src/autenticacao/sessao.ts` (padrão "validar, não confiar no cookie") | role-match |
| `apps/api/src/rotas/operacoes.ts` | route/controller | request-response | `apps/api/src/persistencia/unidade-de-trabalho.ts` (`executar()` é o corpo da rota) | role-match (a rota é casca fina em volta de código já existente) |
| `apps/api/src/rotas/estado.ts` | route/controller | request-response | `apps/api/src/persistencia/repositorio.ts` (`hidratar()`) | role-match |
| `apps/api/src/persistencia/repositorio.ts` (`gravar()` estendido) | service/repository | CRUD | ele mesmo — extensão do `Diferenca` para carregar os registros, não só contagens | exact |
| `apps/api/src/persistencia/unidade-de-trabalho.ts` (ajuste no retorno) | service | CRUD/transaction | ele mesmo — hoje descarta `diferenca` no `ok:false`/conflito, precisa repassar upserts/removidos | exact |
| `apps/api/migracoes/002-*.sql` | migration | batch/DDL | `apps/api/migracoes/001-plataforma.sql` | exact |
| `apps/api/src/bootstrap/gestao.ts` | script/service | batch (seed) | `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (script idempotente standalone) + `apps/api/src/persistencia/repositorio.ts` `semear()` | role-match |
| `packages/dominio/src/seed-financeiro.ts` (refatorado: separar config de fixture) | model/config | transform | ele mesmo | exact |
| `packages/dominio/src/operations/members.ts` (`inviteMember` estendido p/ reconvite por `userId`) | service (domínio puro) | CRUD | ele mesmo, função já existente lida integralmente | exact |
| `apps/api/src/autenticacao/resolver-usuario.ts` | service | event-driven (I/O contra Admin API) | `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (mesmo client `createClient` + `admin.*`) | role-match |
| `apps/web/src/dados/store.ts` (`run()` reescrito) | store/provider | request-response (fetch) | ele mesmo — muda de mutação em lugar para clone+POST+diff | exact |
| `apps/web/src/app/(shell)/layout.tsx` + `apps/web/src/dados/sessao-provider.tsx` (troca do mapa do seed por chamada à API) | provider/component | request-response | eles mesmos | exact |
| `apps/api/vitest.config.mts`-style tests (`operacoes.test.ts`, `autenticacao.test.ts`, `bootstrap/gestao.test.ts`, `colunas-geradas.test.ts`, `e2e/criar-conta.test.ts`) | test | integration | `apps/api/src/persistencia/persistencia.test.ts` (padrão `temBanco ? describe : describe.skip`) | exact |

## Pattern Assignments

### `apps/api/src/app.ts` + `apps/api/src/index.ts` (config, request-response)

**Analog:** `apps/api/src/persistencia/conexao.ts` (padrão de singleton lazy + leitura de env) e o próprio `apps/api/src/index.ts` atual.

**Contrato já documentado** (`apps/api/CONTEXT.md`, linhas 20-30):
```
| `src/index.ts` | Ponto de composição: lê config, monta repositórios, injeta nos serviços, entrega ao transporte. |
```
RESEARCH.md (Pattern 3) já prescreve a separação `app.ts` (monta, não dá `listen()`) / `index.ts` (só chama `.listen()`), para permitir `app.inject` nos testes — ver Code do RESEARCH.md linhas 289-307.

**Padrão de leitura de env a copiar** (`apps/api/src/persistencia/conexao.ts` linhas 8-22):
```typescript
export function carregarEnv(caminho = new URL("../../.env", import.meta.url)): void {
  let texto: string;
  try {
    texto = readFileSync(caminho, "utf8");
  } catch {
    return;
  }
  for (const linha of texto.split("\n")) {
    const corte = linha.indexOf("=");
    if (corte <= 0 || linha.trimStart().startsWith("#")) continue;
    const chave = linha.slice(0, corte).trim();
    if (process.env[chave] === undefined) process.env[chave] = linha.slice(corte + 1).trim();
  }
}
```
`app.ts`/`plugins/autenticacao.ts` devem chamar `carregarEnv()` do mesmo jeito que `criar-usuarios-do-seed.ts` já faz, em vez de reimplementar leitura de `.env`.

**Padrão de singleton lazy** (`conexao.ts` linhas 24-44): `pool()` só cria a instância na primeira chamada. `app.ts` pode seguir o mesmo formato para o client Supabase Admin, evitando recriar a cada requisição.

---

### `apps/api/src/plugins/autenticacao.ts` (middleware, request-response)

**Analog:** `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (como instanciar o client admin) + `apps/web/src/autenticacao/sessao.ts` (a disciplina "validar contra o servidor, não confiar no que chegou").

**Imports/instanciação do client Supabase** (`criar-usuarios-do-seed.ts` linhas 13-23):
```typescript
import { createClient } from "@supabase/supabase-js";
import { USUARIOS_DO_SEED, emailDoSeed } from "@n1/dominio";
import { carregarEnv } from "../persistencia/conexao";

carregarEnv();
const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar em apps/api/.env.");

const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
```
Mesmo padrão para o client usado em `getClaims()` dentro do hook `onRequest` (RESEARCH.md Pattern 2, linhas 247-286) — não reinventar a instanciação.

**Disciplina "validar, não confiar"** (`apps/web/src/autenticacao/sessao.ts` linhas 3-11):
```typescript
/**
 * `getUser()` e não `getSession()`: o segundo devolve o que está no cookie
 * sem conferir com o servidor; o primeiro valida o token. É a diferença entre
 * acreditar no cliente e verificar.
 */
```
No backend o equivalente é `supabase.auth.getClaims(token)` (verifica assinatura contra JWKS) em vez de decodificar o JWT sem checar — ver RESEARCH.md Pattern 2 completo, já com o `declare module "fastify"` para decorar `request.membro`.

**Regra de acesso a replicar** (`apps/web/src/dados/sessao-provider.tsx` linhas 28-32):
```typescript
const member = useMemo(
  () => (memberId ? buildProductSeed().members.find((m) => m.id === memberId) : undefined),
  [memberId],
);
const podeAgir = member !== undefined && (member.state === "ativo" || member.state === "suspenso");
```
O hook do Fastify precisa da mesma checagem de `state` (`ativo`/`suspenso` passam; `pendente`/`removido` não) — hoje só o front barra; o backend passa a aplicar de verdade (ver RESEARCH.md, Security Domain, V4 Access Control).

---

### `apps/api/src/rotas/operacoes.ts` + `apps/api/src/rotas/estado.ts` (controller, request-response)

**Analog:** `apps/api/src/persistencia/unidade-de-trabalho.ts` — a rota é uma casca fina em volta de `executar()`.

**O que a rota chama, sem reimplementar** (`unidade-de-trabalho.ts` linhas 32-76):
```typescript
export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao = {},
): Promise<ResultadoTransacao<T>> {
  // hidratar → operação pura → revisão otimista (3 tentativas) → gravar()
}
```
`ResultadoTransacao<T>` já é `(OperationResult<T> & { diferenca: Diferenca }) | Conflito` — a rota só precisa traduzir isso pro corpo HTTP (200 com `ok:false` do domínio; 409 se `conflito:true`; nunca lançar).

**Erro-como-valor, nunca exceção pela borda** — convenção geral (não específica de um arquivo), confirmada em `unidade-de-trabalho.ts` linha 47-52: a recusa do domínio faz `rollback` e devolve normalmente, nunca lança. A rota deve preservar isso (RESEARCH.md Pitfall 2).

**`GET /estado`** reaproveita `hidratar()` diretamente (`repositorio.ts` linhas 63-101) — ver assinatura de `EstadoHidratado { state, revisao, original, ordem }`; a rota só expõe `state` e `revisao`.

---

### `apps/api/src/persistencia/repositorio.ts` — `gravar()` estendido (service, CRUD)

**O que já existe e precisa ser estendido, não recriado** (`repositorio.ts` linhas 157-223):
```typescript
export async function gravar(
  cliente: PoolClient,
  workspaceId: string,
  depois: DataState,
  antes: EstadoHidratado,
): Promise<Diferenca> {
  // ...calcula upserts: Array<[colecao, id, json, ordem]> e removidos: Array<[colecao, id]>
  return { gravados: upserts.length, removidos: removidos.length };
}
```
D-03 exige devolver os próprios registros (coleção, id, dados, ordem), não só contagens — a lista `upserts`/`removidos` já existe dentro da função (linhas 164, 191); só falta incluí-la no retorno de `Diferenca` (ou um tipo novo, `DiferencaDetalhada`) em vez de descartá-la. Não recalcular o diff em outro lugar — é aqui que ele já é computado corretamente (comparação por `canonico()`).

---

### `apps/api/migracoes/002-*.sql` (migration, batch)

**Analog:** `apps/api/migracoes/001-plataforma.sql` — estilo de comentário "por quê" antes de cada bloco DDL.

**Estilo de comentário a seguir** (`001-plataforma.sql` linhas 9-23):
```sql
/*
 * Um registro por entidade com identidade da ontologia.
 *
 * `colecao` é o nome do array em `DataState` (...). A forma genérica
 * é deliberada nesta etapa: o domínio tem 45 coleções, e tipar as 45 antes de
 * saber quais são consultadas por coluna seria decidir no escuro. As que forem
 * — Tarefa em primeiro lugar — ganham colunas geradas depois, sem migrar dado:
 *
 *   alter table plataforma.registros
 *     add column status_id text generated always as (dados->>'statusId') stored;
 */
```
`001` já anuncia literalmente a migração `002` neste comentário — é a prova de que a decisão de design (colunas geradas sobre `dados->>'campo'`) já estava prevista. Usar o SQL do RESEARCH.md (Code Examples #4, linhas 440-480) como o corpo da migração; `migrar.ts` (já existente, linhas 1-62) aplica arquivos `.sql` em ordem alfabética sem mudança nenhuma — só adicionar o arquivo novo.

---

### `apps/api/src/bootstrap/gestao.ts` (script, batch/seed)

**Analog:** `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (script standalone, idempotente, roda via `vite-node`) + `semear()` de `repositorio.ts`.

**Formato de script standalone a copiar** (`criar-usuarios-do-seed.ts` linhas 13-47): `carregarEnv()` no topo, validação de env com `throw` explícito, loop idempotente com log por item, resumo no final (`console.log(`\n${criados} criado(s)...`)`).

**O que grava** (`repositorio.ts` linhas 226-234):
```typescript
export async function semear(cliente: PoolClient, workspaceId: string, state: DataState): Promise<number> {
  await cliente.query(
    "insert into plataforma.workspaces (workspace_id) values ($1) on conflict do nothing",
    [workspaceId],
  );
  const vazio: EstadoHidratado = { state: {} as DataState, revisao: 1, original: new Map(), ordem: new Map() };
  const { gravados } = await gravar(cliente, workspaceId, state, vazio);
  return gravados;
}
```
O bootstrap monta um `DataState` só com a config do Financeiro (ver próxima seção) e chama `semear()` — não reimplementar a escrita.

---

### `packages/dominio/src/seed-financeiro.ts` (refatoração: separar config de fixture)

**O que existe hoje e precisa dividir-se em duas funções** (`seed-financeiro.ts` linhas 1-47):
```typescript
export function applyContasAPagar(state: DataState, clock: Clock): void {
  const { at, day, workspaceId } = clock;
  /* ── Membros ─────────────────────────────────────────────────────────── */
  const mk = (id: Id, displayName: string, roleId: Id): Member => ({ ... });
  // ...e depois Tarefas fictícias
}
```
D-07/D-08 (CONTEXT.md) exigem que o bootstrap não traga `mk(...)` (Membros fictícios: Thiago, Rafael, Marcos Paulo, Walter) nem Tarefas fictícias — só Espaço → Automações. RESEARCH.md (Pattern 5, linhas 349-354) recomenda dividir `applyContasAPagar` em uma função de config pura e outra que adiciona fixtures por cima, preservando a função combinada para os 214 testes de domínio existentes. Mesmo tratamento se aplica a `seed-contas-a-receber.ts`.

---

### `packages/dominio/src/operations/members.ts` — `inviteMember` (reconvite por `userId`)

**Função já existente, ponto exato onde entra o casamento por `userId`** (`members.ts` linhas 299-337):
```typescript
export function inviteMember(
  state: DataState,
  actingMemberId: Id,
  input: { readonly email: string; readonly roleId: Id },
): OperationResult<Member> {
  // ...
  const existing = state.members.find(
    (member) => member.invitedIdentity?.value.toLowerCase() === email,
  );
  if (existing && existing.state !== "removido") {
    return fail(/* ... */);
  }
  // RN-ET-23 — Membros `pendente` contam para o limite, e reconvidar um
```
PERS-09 precisa estender essa busca (ou a assinatura da função) para também casar por `userId` quando o serviço da API já tiver resolvido o e-mail contra o Supabase Auth (`resolver-usuario.ts`) — o domínio continua puro, só recebe o dado extra como `input.userId?`. Ver RESEARCH.md Pitfall 5 (linhas 400-404) para o porquê (e-mail não fica salvo após aceitação, então a ponte precisa vir de fora).

---

### `apps/api/src/autenticacao/resolver-usuario.ts` (service, event-driven/I-O)

**Analog:** `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` — mesmo client, mesmo uso de `admin.*`:
```typescript
const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: existentes, error: erroLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
```
`resolver-usuario.ts` usa o mesmo client para achar (ou criar) um Usuário por e-mail antes de chamar `inviteMember` — ver RESEARCH.md Open Questions #1 para o formato exato (verificar se `inviteUserByEmail` falha de forma identificável quando o e-mail já existe, ou se é preciso paginar `listUsers()` e filtrar).

---

### `apps/web/src/dados/store.ts` — `run()` reescrito (store/provider, request-response)

**Analog:** ele mesmo — o arquivo já documenta por que muta em lugar hoje; PERS-05 inverte isso só para escritas que vão à API.

**`run()` atual, a mutar em lugar** (`store.ts` linhas 59-64):
```typescript
run: (operation) => {
  const { data, session } = get();
  const result = operation(data, session.memberId);
  set({ revision: get().revision + 1, lastResult: { ...result, at: Date.now() } });
  return result;
},
```
**Esboço do novo, do RESEARCH.md** (Pattern 4, linhas 314-346): clonar com `structuredClone`, rodar a operação pura na cópia, se `ok:false` parar aí sem rede (nada de `fetch`), se `ok:true` descartar a cópia e mandar `POST /operacoes/:nome`, aplicar só o diff (`gravados`/`removidos`) no estado real preservando `ordem`, e se vier 409 (revisão defasada) re-hidratar via `GET /estado` em vez de aplicar qualquer coisa parcial.

**API pública que não pode mudar** (comentário do próprio arquivo, linhas 22-24):
```
* A API pública (`useData`, `useSession`, `useRun`…) não muda: os cem arquivos
* que a consomem não sabem de onde o store vem.
```
Ver RESEARCH.md Open Question #2 sobre se `run()` mantém a assinatura `(operation) => ...` extraindo o nome via `operation.name` ou se vira `(nome, entrada)` — decisão do planejador, mas o vínculo com `useRun()` (linha 118-120) não muda de qualquer forma.

`buildProductSeed()` (linha 28, 51, 66) sai de `store.ts` conforme a Discretion do CONTEXT.md — fica só em testes e no bootstrap.

---

### `apps/web/src/app/(shell)/layout.tsx` + `sessao-provider.tsx` (provider, request-response)

**Analog:** eles mesmos — troca do mapa do seed por uma chamada à API.

**Resolução hoje via mapa do seed** (`layout.tsx` linhas 26-30):
```typescript
const usuario = await usuarioAtual();
if (!usuario) redirect("/entrar");
const memberId = Object.entries(USUARIOS_DO_SEED).find(([, uid]) => uid === usuario.id)?.[0];
```
Passa a ser uma chamada a `GET /estado` (ou `/sessao`) com o token de `usuario` — o padrão de "Server Component decide antes de a casca subir" continua o mesmo, só a fonte de dado muda (RESEARCH.md, Integration Points).

**Checagem de acesso que se mantém** (`sessao-provider.tsx` linhas 28-32, já citada acima) — mesma lógica, dado que passa a vir da API em vez de `buildProductSeed()`.

**De onde sai o access token para o `Authorization: Bearer`** (D-02): `apps/web/src/autenticacao/cliente-navegador.ts` (browser) e `cliente-servidor.ts` (SSR) já expõem os clients Supabase — o `fetch` de `store.ts` usa `clienteDoNavegador().auth.getSession()` (ou equivalente) para pegar o `access_token` atual.

---

### Testes de integração (`operacoes.test.ts`, `autenticacao.test.ts`, `bootstrap/gestao.test.ts`, `colunas-geradas.test.ts`, `e2e/criar-conta.test.ts`)

**Analog:** `apps/api/src/persistencia/persistencia.test.ts` — o único padrão de teste contra Postgres real no repo.

**Padrão a copiar literalmente** (`persistencia.test.ts` linhas 15-33):
```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarEnv, encerrar, pool } from "./conexao";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

const WS = "ws_spike";

d("persistência do DataState", () => {
  beforeAll(async () => { /* limpa e semeia o workspace de teste */ });
  afterAll(async () => { await encerrar(); });
  it("...", async () => { /* ... */ });
});
```
Todo teste de integração novo desta fase deve usar `temBanco ? describe : describe.skip` (D-DEC-09) e limpar/encerrar o pool em `afterAll`, exatamente como aqui — nunca falhar `npm run check` por falta de `DATABASE_URL`. Para `app.inject` (testes de rota Fastify), ver RESEARCH.md Pattern 3 (linhas 289-307) que soma este padrão ao de `buildApp()` sem `listen()`.

## Shared Patterns

### Erro é valor, nunca exceção pela borda
**Source:** `apps/api/src/persistencia/unidade-de-trabalho.ts` linhas 47-52 (rollback silencioso em `ok:false`) + convenção geral do domínio (`OperationResult`).
**Apply to:** `rotas/operacoes.ts`, `rotas/estado.ts`, `plugins/autenticacao.ts` (401/403 são falha de transporte, não de domínio), `store.ts` (`run()` nunca lança para uma recusa de negócio).

### Leitura de `.env` sem dotenv
**Source:** `apps/api/src/persistencia/conexao.ts` linhas 8-22 (`carregarEnv`).
**Apply to:** todo arquivo novo em `apps/api` que lê `process.env.*` diretamente (`app.ts`, `plugins/autenticacao.ts`, `bootstrap/gestao.ts`, `autenticacao/resolver-usuario.ts`) — chamar `carregarEnv()` no topo, nunca reimplementar o parsing.

### Client Supabase Admin, instanciado uma vez
**Source:** `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` linhas 13-23 (`createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } })`).
**Apply to:** `plugins/autenticacao.ts` (verificação de JWT), `autenticacao/resolver-usuario.ts` (reconvite) — mesmas opções (`autoRefreshToken: false, persistSession: false` — é um processo servidor, sem sessão persistida).

### Testes de integração pulam sem `DATABASE_URL`
**Source:** `apps/api/src/persistencia/persistencia.test.ts` linhas 23-25.
**Apply to:** todo teste de `apps/api` que precisa de Postgres real (ver lista de "Wave 0 Gaps" no RESEARCH.md).

### Comentário "por quê", não "o quê", em pt-BR
**Source:** convenção observada em todos os arquivos lidos (`unidade-de-trabalho.ts`, `repositorio.ts`, `store.ts`, `sessao-provider.tsx`, `001-plataforma.sql`) — bloco de comentário no topo do arquivo explicando a decisão de design, não o funcionamento linha a linha.
**Apply to:** todos os arquivos novos desta fase.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/api/src/autenticacao/resolver-usuario.ts` (parte "buscar por e-mail" da Admin API) | service | event-driven | Nenhum código do repo hoje faz "e-mail → userId" contra a Admin API (`criar-usuarios-do-seed.ts` só cria por id conhecido); RESEARCH.md Open Question #1 marca isso como não verificado — usar `admin.listUsers()` + filtro em memória como ponto de partida, confirmando a assinatura na versão instalada antes de codar. |
| `apps/api/src/servicos/` (camada de "casos de uso" prevista no CONTEXT.md mas ainda vazia) | service | — | `apps/api/src/servicos/CONTEXT.md` define o contrato ("compõem operações do domínio e falam com repositórios; a transação começa e termina aqui") mas nenhum arquivo existe lá ainda — nesta fase a UoW (`persistencia/unidade-de-trabalho.ts`) já cobre esse papel para operações simples; se o reconvite (PERS-09) precisar compor mais de um passo de I/O (resolver e-mail + chamar `inviteMember` + persistir), é candidato natural a virar o primeiro arquivo desta pasta — decisão do planejador. |

## Metadata

**Analog search scope:** `apps/api/src/persistencia/`, `apps/api/src/autenticacao/`, `apps/api/migracoes/`, `apps/web/src/dados/`, `apps/web/src/autenticacao/`, `apps/web/src/app/(shell)/`, `packages/dominio/src/operations/`, `packages/dominio/src/seed-financeiro.ts`, `packages/dominio/src/colecoes.ts`, `apps/api/CONTEXT.md` e subpastas.
**Files scanned:** ~14 lidos integralmente ou por seção relevante (ver lista acima); nenhum excedeu 2.000 linhas.
**Pattern extraction date:** 2026-09-16
