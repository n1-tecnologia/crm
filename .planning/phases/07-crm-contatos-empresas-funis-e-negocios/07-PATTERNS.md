# Phase 7: CRM - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** 22 (novos/modificados)
**Analogs found:** 17 exatos ou parciais / 22 (5 sem analogo: repositorios, servicos/crm, cliente SWR, SQL de correcao, dominio crm-*)

Todos os analogos abaixo foram conferidos como rastreados no git (`git ls-files`). `apps/api/migracoes/007-crm.sql` ainda e untracked (D-12 manda commita-la).

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analogo mais proximo | Qualidade |
|---|---|---|---|---|
| `apps/api/migracoes/007-crm.sql` (editar: trigger admin x lixeira) | migration | batch | `apps/api/src/persistencia/migrar.ts` (runner) + RESEARCH "Correcao do trigger" | no-analog (SQL pronto no RESEARCH) |
| `packages/dominio/src/crm.ts` (barril) | utility | transform | `packages/dominio/src/state.ts` (`ok`/`fail`) + exports `"./*"` de `package.json` | role-match |
| `packages/dominio/src/crm-tipos.ts` | model | transform | `packages/dominio/src/types/` (modelo antigo, so referencia de estilo) | partial |
| `packages/dominio/src/crm-normalizacao.ts` | utility | transform | nenhum | no-analog |
| `packages/dominio/src/crm-regras.ts` | service (regras puras) | transform | `packages/dominio/src/operations/deals.ts` (`mayWriteDeal`, `ok`/`fail`) | role-match |
| `packages/dominio/src/crm-permissoes.ts` | utility | request-response | `packages/dominio/src/operations/deals.ts:31-38` (`mayWriteDeal`) | exact (mesma ideia) |
| `packages/dominio/src/crm*.test.ts` | test | transform | `packages/dominio/src/solicitacao-de-pagamento.test.ts` | role-match |
| `apps/api/src/app.ts` (modificar: CORS + registro) | config | request-response | o proprio `app.ts:157-162`, `:194-200` | exact |
| `apps/api/src/rotas/esquemas/crm.ts` | schema | request-response | `apps/api/src/rotas/financeiro.ts:64-69` (zod `.strict()`) e `rotas/esquemas/CONTEXT.md` | role-match |
| `apps/api/src/rotas/crm/{contatos,empresas,funis,negocios}.ts` | route/controller | CRUD | `apps/api/src/rotas/financeiro.ts` (rota por recurso, DI via opcoes) + `rotas/operacoes.ts` | role-match |
| `apps/api/src/servicos/crm/*.ts` | service | CRUD + transacao | `apps/api/src/persistencia/migrar.ts:43-57` e `servicos/convidar-membro.ts` | partial |
| `apps/api/src/repositorios/crm/*.ts` | repository | CRUD | `apps/api/src/persistencia/membros.ts` (SQL parametrizado) | partial |
| `apps/api/src/repositorios/crm/membros-e-papeis.ts` | repository | request-response | `apps/api/src/persistencia/membros.ts` | exact |
| testes `rotas/crm/*.test.ts` | test | request-response | `apps/api/src/plugins/autenticacao.test.ts` e `rotas/financeiro.test.ts` | exact |
| testes de repositorio pg | test | CRUD | `apps/api/src/persistencia/colunas-geradas.test.ts` | exact |
| `apps/web/src/dados/crm/cliente-crm.ts` | service (HTTP client) | request-response | `apps/web/src/dados/transporte.ts:92-138` | exact |
| `apps/web/src/dados/crm/use-*.ts` + SWRConfig | hook/provider | request-response | `apps/web/src/dados/sessao-provider.tsx` (obterToken) | partial |
| `apps/web/src/dados/crm/*.test.ts` | test | request-response | `apps/web/src/dados/transporte.test.ts` (stub `fetch`) | exact |
| `apps/web/src/app/(shell)/crm/{contatos,empresas,funis,negocios}/**/page.tsx` | component (page) | CRUD | as paginas atuais, p.ex. `.../crm/negocios/page.tsx` | exact (layout) |
| `apps/web/src/features/crm/*` novos (formularios, lixeira) | component | CRUD | `features/crm/create-record-dialog.tsx`, `migrate-funnel-dialog.tsx`, `remove-stage-dialog.tsx` | role-match |
| kanban de Negocios (inline em `crm/negocios/page.tsx`) | component | event-driven (drag) | `features/shell/quadro.tsx` (`ColunaDeQuadro`, `VazioDaColuna`) | exact |

## Pattern Assignments

### `apps/api/src/app.ts` (config, request-response) - modificar

**Pitfall 1 (CORS)** - mudar a linha e adicionar teste de preflight em `app.test.ts`.

CORS atual (`app.ts:157-162`):
```typescript
const opcoesDeCors = {
  credentials: false,
  methods: ["GET", "POST"],            // -> ["GET", "POST", "PATCH", "DELETE"]
  allowedHeaders: ["authorization", "content-type"],
};
```
Remover/atualizar o comentario da linha 157 ("escritas de 04-10 nascem como POST") no mesmo commit.

Registro de rota (`app.ts:194-200`) - rotas CRM entram depois de `registrarAutenticacao` (linha 179), na raiz, para herdar o JWT:
```typescript
app.register(rotasDeOperacoes);
app.register(rotasDeEstado);
app.register(rotasDeFinanceiro, opcoes.financeiro ?? {});
```
Seguir o molde de `OpcoesDoApp` (`app.ts:85-86`): campo opcional `crm?: OpcoesDeCrm` para injetar servicos/repositorios falsos em testes sem `DATABASE_URL`.

Handler de erro global ja cobre 400 do zod (`app.ts:110-133`): `{ ok:false, error: "Entrada invalida: ..." }`. Nao duplicar; rotas CRM so mapeiam 403/404/409.

---

### `apps/api/src/rotas/crm/funis.ts` (e `contatos|empresas|negocios.ts`) (route, CRUD)

**Analogo:** `apps/api/src/rotas/financeiro.ts` (modulo por recurso, `z.object(...).strict()`, opcoes injetaveis) e `apps/api/src/rotas/operacoes.ts` (Membro atuante sempre `request.membro`, nunca do corpo).

**Imports/schemas pattern** (`financeiro.ts:36-69`):
```typescript
import type { FastifyInstance } from "fastify";
import { z } from "zod";
const QUERY_COM_EMPRESA = z.object({ empresa: EMPRESA.optional() }).strict();
const QUERY_SEM_FILTRO = z.object({}).strict();
export interface OpcoesDeFinanceiro {
  readonly cliente?: ClienteDeLeituras;     // injetavel so para teste
  readonly hidratarEstado?: (workspaceId: string) => Promise<DataState>;
}
```

**Type provider + rota** (`operacoes.ts:29-33` imports; esboco do RESEARCH "Rota REST com zod"):
```typescript
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
export async function rotasDeFunis(app: FastifyInstance, opcoes: { servico: ServicoDeFunis }): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.delete("/funis/:id", { schema: { params: z.object({ id: z.string().min(1) }) } }, async (request, reply) => {
    const res = await opcoes.servico.enviarParaLixeira(request.membro, request.params.id);
    if (res.tipo === "bloqueado") return reply.code(409).send({ ok: false, error: res.frase, codigo: "FUNIL_COM_NEGOCIOS", bloqueios: { negocios: res.negocios } });
    if (res.tipo === "naoEncontrado") return reply.code(404).send({ ok: false, error: "Funil nao encontrado." });
    return reply.code(200).send({ ok: true });
  });
}
```

**Regras de contrato:**
- Membro atuante e workspace: sempre `request.membro.id` / `request.membro.workspaceId` (`operacoes.ts:25-27`); nunca do corpo (T-1-02). `criado_por` = `request.membro.id`.
- Envelope de erro `{ ok:false, error }` (mesmo de `autenticacao.ts:65`), mais `codigo` e `bloqueios` nos 409.
- Divergencia deliberada de `/operacoes`: recusa de dominio NAO viaja em 200 (`operacoes.ts:8-23`); aqui 400/403/404/409 (D-03).
- Rota sem regra e sem SQL (`rotas/CONTEXT.md`): chama servico e formata resposta.
- `DELETE`/restaurar sem corpo: nao exigir body (Pitfall 4).

---

### `apps/api/src/servicos/crm/*.ts` (service, CRUD + transacao)

**Analogo:** `apps/api/src/persistencia/migrar.ts:43-57` (forma de transacao com `pool().connect()`) e o esboco do RESEARCH "Criar Empresa + admin".

**Transacao** (`migrar.ts:25-61`):
```typescript
const cliente = await pool().connect();
try {
  await cliente.query("begin");
  try {
    /* ...queries... */
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback");
    throw /* traduzir SQLSTATE */;
  }
} finally {
  cliente.release();
}
```
**NAO usar** `persistencia/unidade-de-trabalho.ts::executar` (hidrata `DataState` de `plataforma.registros`; modelo antigo).

**Servico recebe repositorios por parametro** (`deps: { pool; repos: (c: PoolClient) => ReposCrm }`) para compor varios repositorios na mesma transacao (D-08: Empresa+admin; D-07: migrar Negocios). O constraint trigger deferido roda no `commit` - o `catch` ao redor do `commit` e obrigatorio.

**Traducao de erros pg -> 409:** `23505` (`contato_identificadores_unico`, `funis_nome_uq`), `23503` (`negocios_*_fkey`), `23514` (`funis_padrao_ck`, `empresa_exige_admin`). Pre-checar no servico (contagens D-07/D-09); SQLSTATE e rede de seguranca contra corrida.

---

### `apps/api/src/repositorios/crm/*.ts` (repository, CRUD)

**Analogo:** `apps/api/src/persistencia/membros.ts:14-28` (unica consulta SQL parametrizada, enxuta, escopada por workspace). `repositorios/CONTEXT.md` diz "Nasce vazia" - esta fase inaugura o padrao: interface por agregado + `criarRepositorioDe...Pg(cliente: Queryable)` + fake em memoria.

**Core pattern** (`membros.ts:17-28`):
```typescript
export async function membroPorUsuario(workspaceId: string, userId: string): Promise<Member | undefined> {
  const resultado = await pool().query<{ dados: Member }>(
    `select dados
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'members'
        and dados->>'userId' = $2
      limit 1`,
    [workspaceId, userId],
  );
  return resultado.rows[0]?.dados;
}
```
Regras: todo `WHERE` leva `workspace_id = $1`; valores sempre `$n`; ordenacao/filtro dinamico por allowlist de colunas; `data_nascimento::text`, `valor::text`, `count(*)::int` (Pitfall 5, nunca `setTypeParser` global); UUID via `default gen_random_uuid()::text` + `INSERT ... RETURNING`; `atualizado_em` pelo trigger da 007.

**`membros-e-papeis.ts`:** mesma forma de `membros.ts`, consulta join members->roles (`dados->>'roleId'`, `colecao='roles'`, assuncao A2 - testar) para obter `base` do Papel e `state` do Membro. NAO alterar `MembroDaSessao` (`plugins/autenticacao.ts:25-29`) - `autenticacao.test.ts` faz `toEqual({id, workspaceId, state})`.

---

### `packages/dominio/src/crm-permissoes.ts` (utility, request-response)

**Analogo:** `packages/dominio/src/operations/deals.ts:31-38`:
```typescript
function mayWriteDeal(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "So um Membro ativo altera Negocio.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado nao altera Negocio: ele alcanca so o que foi compartilhado com ele.";
  }
  return undefined;
}
```
Novo `podeNoCrm(base, estadoDoMembro, acao, recurso): string | undefined` - retorna a frase pt-BR de recusa ou `undefined`, sem `DataState` (a API fornece `base`/`state`). Matriz D-14: `membro` cria/edita/exclui Contato/Empresa/Negocio; so `administrador`/`proprietario` cria/exclui Funil, edita Etapas, reabre Negocio `ganho`; `convidado` so le.

### `packages/dominio/src/crm-regras.ts` (service pura, transform)

**Analogo:** `packages/dominio/src/state.ts:128-133` - idioma do dominio:
```typescript
export type OperationResult<T = void> =
  | { readonly ok: true; readonly value: T; readonly id?: Id }
  | { readonly ok: false; readonly error: string; readonly field?: string };
export const ok = <T>(value: T, id?: Id): OperationResult<T> => ...;
export const fail = <T = never>(error: string, field?: string): OperationResult<T> => ...;
```
Funcoes `(entrada, contexto) -> OperationResult`, erros em pt-BR, sem banco. Reusar `ok`/`fail`.

### `packages/dominio/src/crm.ts` (barril)

`packages/dominio/package.json` exporta `"./*": "./src/*.ts"` e `".": "./src/index.ts"`. Logo o modulo e `src/crm.ts` (arquivo, nao pasta) -> `import ... from "@n1/dominio/crm"`. NAO reexportar em `src/index.ts` (evita colisao com `Address`, `Money`, `ContactIdentifier`; D-01 convivencia). Valores discretos (enums) copiados verbatim da 007 (lista no RESEARCH "Valores discretos"). Datas = `CivilDate` string (`primitives.ts:13`), dinheiro = string decimal.

---

### `apps/api/src/rotas/crm/*.test.ts` (test, request-response)

**Analogo:** `apps/api/src/plugins/autenticacao.test.ts:13-48` (`buildApp` com `verificarToken`/`resolverMembro` injetados, `app.inject`):
```typescript
function appDeTeste() {
  const app = buildApp({
    logger: false,
    workspaceId: "ws_teste",
    verificarToken: async (token) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_workspaceId, userId) => membros.find((m) => m.userId === userId),
  });
  return app;
}
const resposta = await appDeTeste().inject({ method: "GET", url: "/...", headers: { authorization: "Bearer token-maryane" } });
```
`usuarioDoSeed` de `@n1/dominio`, `buildSeed` de `@n1/dominio/seed`. Injetar servico/repositorio fake em memoria via `buildApp({ crm: ... })` para rodar sem `DATABASE_URL` (molde `financeiro.test.ts`: bloco "sem banco" sempre roda).

### Testes de repositorio pg

**Analogo:** `apps/api/src/persistencia/colunas-geradas.test.ts:13-45`:
```typescript
carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;
const WS = "ws_colunas_teste";             // -> "ws_crm_teste_<recurso>" unico por arquivo
async function limpar() { const c = await pool().connect(); try { await c.query("delete ... where workspace_id = $1", [WS]); } finally { c.release(); } }
```
Rodar contra Postgres local descartavel (Docker `postgres:16`, `DATABASE_URL=postgres://...@localhost`, ver Pitfall 11); limpar em `afterAll`; testes api sao em serie.

---

### `apps/web/src/dados/crm/cliente-crm.ts` (HTTP client, request-response)

**Analogo:** `apps/web/src/dados/transporte.ts:92-138` (`gravarUma`) e `sessao-provider.tsx:38-39` (obterToken):
```typescript
const token = await obterToken();
if (!token) return { tipo: "falha", erro: "Sua sessao expirou. Entre de novo.", sessaoExpirada: true };
resposta = await fetch(`${apiUrl}/operacoes/${chamada.nome}`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(...),
});
// catch -> "Sem conexao com o servidor."; 401 -> sessaoExpirada; !ok -> corpoDeErro(resposta) (transporte.ts:77-84)
```
Token: `(await clienteDoNavegador().auth.getSession()).data.session?.access_token` (`import { clienteDoNavegador } from "@/autenticacao/cliente-navegador"`); URL: `process.env.NEXT_PUBLIC_API_URL!`. Diferenca vs analogo: so setar `content-type` quando ha corpo (Pitfall 4: DELETE sem corpo + content-type json -> 400). Erros 409 carregam `codigo`/`bloqueios` (classe `ErroDeApi`). O web nao importa de `apps/api`; so `@n1/dominio/crm`.

### Testes web de dados

**Analogo:** `apps/web/src/dados/transporte.test.ts:18-23` (`vi.stubGlobal("fetch", ...)`). Testes `.tsx` declaram `// @vitest-environment jsdom` na 1a linha.

### SWR (hooks)

Sem analogo no repo (`swr` ainda nao instalado: `npm install swr@2.5.1 -w @n1/web`). Um `<SWRConfig>` unico no `SessaoProvider` (`apps/web/src/dados/sessao-provider.tsx`, Client Component) ou em `(shell)/crm/layout.tsx`. Invalidar por prefixo de chave apos mutacao. Nao tocar `store.ts`/`GET /estado` (ainda necessarios: Membros, Papeis).

---

### Paginas `apps/web/src/app/(shell)/crm/negocios/page.tsx` (component, CRUD + drag)

**Analogo:** a propria pagina atual (`"use client"`, imports de UI):
```typescript
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { Button, CorpoDeTela, EmptyState, Icone, PageHeader, Pilula, RolagemNoTopo, Section, Select, Toast } from "@/features/shell/ui";
import { CreateRecordDialog, useCreateRecordDialog } from "@/features/crm/create-record-dialog";
import { useRecente } from "@/features/shell/recente";
```
Manter: layout, `PageHeader`, `ColunaDeQuadro` por Etapa, `useCreateRecordDialog("negocio")` (`?criar=<familia>`). Trocar: `useData((d)=>d.funnels)`, `useRun`, `moveDealToStage` (`@n1/dominio/operations`), `DEAL_SITUATION_LABEL` por hooks SWR + `chamarCrm` + vocabulario novo (`estado: "na_lixeira"`, `etapa_id`, `situacao`). Drag otimista via `mutate(chave, dados, { revalidate: true })`, reverter e mostrar `Toast` em 409 (Pitfall 9).
**NAO tocar** `features/estrutura/quadro-negocios.tsx` (kanban de Tarefas conversacionais) nem `crm/meus-negocios`, `caixa-de-entrada`, `reunioes`.
Paginas de ficha: `params: Promise<...>` + `use(params)` (Pitfall 10). Antes de codar ler `node_modules/next/dist/docs/` (AGENTS.md). Fichas pesadas (`deal-screen.tsx`, `contact-card.tsx`, paginas `[contato]`/`[empresa]`) acopladas a Conversa/Tag/Consentimento: refazer enxutas sobre o modelo 007 (nomes pt-BR), nao adaptar.

---

## Shared Patterns

### Autenticacao e identidade do Membro
**Fonte:** `apps/api/src/plugins/autenticacao.ts:46-96`
**Aplicar a:** todas as rotas CRM (herdam o hook da raiz automaticamente se registradas depois dele em `app.ts`).
- 401 sem token, 403 nao-Membro/pendente/removido; `suspenso` passa (leitura).
```typescript
request.membro = { id: membro.id, workspaceId: opcoes.workspaceId, state: membro.state };
```
`workspaceId` nunca vem do cliente (T-1-02).

### Isolamento por Espaco de Trabalho
**Fonte:** `persistencia/membros.ts` (WHERE com `workspace_id = $1`) + FKs compostas `(workspace_id, id)` da 007.
**Aplicar a:** todo repositorio; `proprietario_id`/`criado_por` sao `text` sem FK na 007 - servico valida Membro `ativo` do mesmo Espaco (D-11).

### Formato de erro
**Fonte:** `app.ts:110-133`, `autenticacao.ts:65`.
`{ ok:false, error: "<frase pt-BR>" }` (+ `codigo`, `bloqueios` em 409). 500 nunca vaza stack.

### Regra de camadas
`web` e `api` so importam `@n1/dominio` (ou `@n1/dominio/crm`), nunca um ao outro. Mudou "o que e" -> dominio primeiro, depois api, depois web.

### Convencoes TS/estilo
`strict` + `noUncheckedIndexedAccess` (guardar todo acesso indexado); zod `.strict()` em objetos; cor so por `tokens.css`; alias `@/*`; comentarios de cabecalho em pt-BR explicando o porque (estilo de todos os arquivos lidos).

## No Analog Found

| Arquivo | Role | Data Flow | Motivo |
|---|---|---|---|
| `repositorios/crm/*` (interface + impl pg + fake) | repository | CRUD | `repositorios/` nasce vazia; so ha `membros.ts` como referencia de SQL |
| `servicos/crm/*` (casos de uso transacionais) | service | transaction | nenhum servico compoe repositorios em transacao; usar `migrar.ts` + esbocos do RESEARCH |
| `dominio/crm-normalizacao.ts` | utility | transform | nenhum normalizador de email/telefone/dominio/documento existe (A4, A5) |
| `007-crm.sql` fix do trigger admin x lixeira | migration | batch | SQL validado em RESEARCH "Correcao do trigger de admin" (D-12: editar a 007 antes do 1o `migrar`; conferir `plataforma.migracoes`) |
| hooks/`SWRConfig` | hook | request-response | `swr` novo na dependencia; sem uso previo no repo |

## Metadata

**Analog search scope:** `apps/api/src/{app.ts,rotas,plugins,persistencia,servicos,repositorios}`, `packages/dominio/src`, `apps/web/src/{dados,features,app/(shell)/crm}`
**Files scanned:** ~20 lidos, ~150 listados
**Pattern extraction date:** 2026-10-09
