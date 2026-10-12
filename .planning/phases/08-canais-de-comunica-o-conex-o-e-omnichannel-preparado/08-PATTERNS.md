# Fase 8: Canais de comunicação - Mapa de padrões

**Mapeado:** 2026-10-12
**Arquivos analisados:** 38 (novos ou modificados)
**Análogos encontrados:** 36 / 38 (todos os análogos citados são rastreados pelo git; nenhum espelho `.gsd/capabilities`)

Referência cruzada: `07-PATTERNS.md` (mesma pilha repositório → serviço → rota → cliente HTTP → tela). Os trechos abaixo foram reextraídos do código ATUAL.

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Análogo mais próximo | Qualidade |
|---|---|---|---|---|
| `packages/dominio/src/provedores-de-canal.ts` | utilitário (folha) | transform | `packages/dominio/src/crm/comum.ts` (`ESTADOS_CRM`, `LIMITES_CRM`) + `operations/canais.ts:37-56` | role-match |
| `packages/dominio/src/types/crm.ts` (`Channel.provider?`, `relational?`, `simulatedConnection?`) | modelo | transform | o próprio `Channel` (`:379-392`) | exato |
| `packages/dominio/src/operations/conversations.ts` (`capacidadesDoCanal`) | utilitário | transform | `CHANNEL_CAPABILITIES` (`:17`) no mesmo arquivo | exato |
| `packages/dominio/src/derive.ts` (`responseWindowOpenUntil`), `derive-conversacional.ts` (`canaisQueAlcancam`, `canalPadraoDeResposta`) | utilitário | transform | `derive-conversacional.ts:145-157` | exato |
| `packages/dominio/src/crm/{canais,conversas,mensagens}.ts` | modelo + regras puras | request-response | `packages/dominio/src/crm/funis.ts` | exato |
| `packages/dominio/src/crm/permissoes.ts` (+ `canal`/`conversa`/`mensagem`) | utilitário | request-response | o próprio arquivo | exato |
| `packages/dominio/src/crm/{canais,conversas,mensagens}.test.ts`, `permissoes.test.ts` | teste | transform | `crm/funis.test.ts`, `crm/permissoes.test.ts` | exato |
| `apps/api/migracoes/008-canais-conversas-mensagens.sql` | migração | CRUD | `apps/api/migracoes/007-crm.sql` (funis `:309-329`) | exato |
| `apps/api/src/repositorios/crm/{canais,conversas,mensagens}.ts` | repositório | CRUD | `repositorios/crm/funis.ts` | exato |
| `apps/api/src/repositorios/crm/referencias.ts` | repositório | CRUD (leitura de `registros`) | `repositorios/crm/membros.ts` | role-match |
| `apps/api/src/servicos/crm/{canais,conversas,mensagens}.ts` | serviço | CRUD / transacional | `servicos/crm/funis.ts` | exato |
| `apps/api/src/servicos/crm/contatos.ts` (FRASES + pré-check de Conversas) | serviço | CRUD | o próprio arquivo (`FRASES` `:72`) | exato |
| `apps/api/src/rotas/crm/{canais,conversas,mensagens}.ts` | rota | request-response | `rotas/crm/funis.ts` | exato |
| `apps/api/src/rotas/crm/index.ts` (`OpcoesDeCrm`) | rota (registro) | request-response | o próprio arquivo | exato |
| `apps/api/src/rotas/crm/comum.ts` (`QUERY_LISTA_DE_CANAIS/CONVERSAS`) | utilitário | request-response | `QUERY_LISTA` (`:21`) | exato |
| `apps/api/src/persistencia/canais-projetados.ts` | serviço (ponte) | transform | `persistencia/repositorio.ts` (`hidratar`/`gravar`) | role-match |
| `apps/api/src/rotas/estado.ts` e `persistencia/unidade-de-trabalho.ts` (ganchos da projeção) | rota / UoW | request-response | os próprios | exato |
| `apps/api/src/testes/banco-crm.ts` (`limparEspaco`, `semearCanal`) | teste (helper) | CRUD | o próprio arquivo | exato |
| `apps/api/src/rotas/crm/{canais,conversas,mensagens}.test.ts` | teste | request-response | `rotas/crm/funis.test.ts` | exato |
| `apps/api/src/repositorios/crm/*.test.ts`, `canais-008.test.ts`, `persistencia/canais-projetados.test.ts` | teste | CRUD | `repositorios/crm/*` testes da Fase 7 + `testes/banco-crm.ts` | role-match |
| `apps/api/src/e2e/canais-fluxo.test.ts` | teste e2e | request-response | `e2e/crm-fluxo.test.ts` | exato |
| `apps/web/src/dados/crm/canais.ts` (+ `.test.ts`) | cliente HTTP | CRUD | `dados/crm/funis.ts` | exato |
| `.../configuracoes/page.tsx` (botão "Conectar Canal", selo/origem na lista) | componente (página) | request-response | o próprio arquivo (`:68-100`) | exato |
| `.../configuracoes/canais/conectar/page.tsx` | componente (página) | request-response | seção "Canais" de `configuracoes/page.tsx` (`grade-solta`/`item-solto`) | role-match |
| `.../configuracoes/canais/conectar/[provedor]/page.tsx` | componente (página) | CRUD | `canais/[canal]/page.tsx` (`use(params)`) + `features/crm/adicionar-canal-dialog.tsx` | role-match |
| `.../configuracoes/canais/[canal]/page.tsx` (PATCH/simular/desconectar) | componente (página) | CRUD | o próprio arquivo | exato |
| `apps/web/src/features/crm/{selo-do-provedor,seletor-de-canal}.tsx` | componente | request-response | `Pilula` em `design/basicos.tsx:191` | role-match |
| `apps/web/src/features/crm/conversation-thread.tsx` (abas por Canal, "Responder por") | componente | event-driven | o próprio arquivo | exato |
| `apps/web/src/features/crm/inbox-columns.tsx` (ícone + nome, filtro com selo) | componente | request-response | o próprio arquivo | exato |
| `apps/web/src/features/crm/conversation-thread.test.tsx`, `inbox-columns.test.tsx` | teste | event-driven | `dados/crm/cliente-crm.test.ts` (mock) + vitest jsdom | parcial |
| `apps/web/src/features/shell/rotas.test.ts` | teste | transform | o próprio arquivo | exato |
| 4 chamadores de `ConversationThread` + `legado/ficha-de-*` | componente | request-response | `[conversa]/page.tsx:431` etc. | exato |
| `CONTEXT.md` da raiz e de `apps/api/src/{rotas,repositorios,persistencia}`, `apps/web` | documentação viva | — | texto atual de cada um | exato |

## Atribuições de padrão

### `apps/api/migracoes/008-canais-conversas-mensagens.sql` (migração, CRUD)

**Análogo:** `apps/api/migracoes/007-crm.sql`. O SQL completo, provado em Postgres 16, está no `08-RESEARCH.md` (Code Example 1, linhas 412-590): copiar de lá. O que vem da 007:

**Trigger reaproveitado** (007, linhas 31-38; NÃO recriar, só usar):
```sql
create or replace function plataforma.crm_toque_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
```

**Forma de tabela** (007, `funis`, linhas 309-329): `id text not null default gen_random_uuid()::text`, `workspace_id text not null`, `primary key (workspace_id, id)`, `constraint <tabela>_<regra>_ck check (...)`, `criado_em/atualizado_em timestamptz not null default now()`. Em seguida `create unique index if not exists ... where estado = 'ativo'` e
```sql
drop trigger if exists canais_atualizado_em on plataforma.canais;
create trigger canais_atualizado_em before update on plataforma.canais
  for each row execute function plataforma.crm_toque_atualizado_em();
```
Tudo idempotente (`if not exists`, `drop trigger if exists`). Nunca editar a 007.

**Cuidados:** os nomes de constraint (`canais_nome_uq`, `canais_conta_uq`, `conversas_nao_resolvida_uq`, `mensagens_id_externo_uq`, `conversas_workspace_id_contato_id_fkey`...) são o contrato com o `FRASES` dos serviços. `mensagens.identificador_id` fica SEM FK (Pitfall 2). O teste com "dois WhatsApps" usa dois números distintos (Pitfall 12).

---

### `apps/api/src/repositorios/crm/{canais,conversas,mensagens}.ts` (repositório, CRUD)

**Análogo:** `apps/api/src/repositorios/crm/funis.ts`

**Imports e cabeçalho** (linhas 15-18):
```typescript
import type { Pool, PoolClient } from "pg";
import type { EstadoCrm, Pagina } from "@n1/dominio/crm/comum";
import { CLAUSULA_ESCAPE, contemTexto } from "./sql";
```

**Interface + fábrica** (linhas 54, 199): `export interface RepositorioDeX { listar(workspaceId, filtro): Promise<Pagina<...>>; obter(workspaceId, id, opcoes?: { travar?: boolean }) ... }` e `export function criarRepositorioDeXPg(cliente: Pool | PoolClient): RepositorioDeX`. Todo método recebe `workspaceId` primeiro.

**Mapeamento linha → domínio** (linhas 131-148): interface `LinhaDoBanco...` com `snake_case` e `Date`, função `linhaParaX` exportada; `criado_em.toISOString()`; `string | null` do banco vira `null`, não `undefined`.

**Listagem com contagem + busca** (linhas 201-226):
```typescript
const parametros: unknown[] = [workspaceId, filtro.estado];
...
if (texto !== "") {
  parametros.push(contemTexto(texto));
  busca = `and f.nome ilike $${parametros.length} ${CLAUSULA_ESCAPE}`;
}
const total = await cliente.query<{ total: number }>(
  `select count(*)::int as total from plataforma.funis f where f.workspace_id = $1 and f.estado = $2 ${busca}`, parametros);
parametros.push(filtro.limite, filtro.deslocamento);
... `order by ... limit $${parametros.length - 1} offset $${parametros.length}`
```
Regras (cabeçalho, linhas 5-12): todo `WHERE` leva `workspace_id = $1`; valores sempre `$n`; colunas de `UPDATE` de lista fixa; `ORDER BY` fixo. `Mensagem`: `carga_bruta` NÃO entra nas colunas de lista (A9); ordenar por `(criado_em, seq)`. `registrarRecebida`: `insert ... on conflict (workspace_id, canal_id, id_externo) where id_externo is not null do nothing returning ...`.

---

### `apps/api/src/servicos/crm/{canais,conversas,mensagens}.ts` (serviço, CRUD transacional)

**Análogo:** `apps/api/src/servicos/crm/funis.ts`

**Imports** (linhas 20-54): `Pool, PoolClient` de `pg`; regras puras de `@n1/dominio/crm/<x>`; `type AcaoCrm` de `@n1/dominio/crm/permissoes`; `MembroDaSessao` de `../../plugins/autenticacao`; `exigir, type AcessoAoCrm` de `./acesso`; `recusa, sucesso, type ResultadoCrm` de `./resultado`; `comTransacao, type FrasesDeRestricao` de `./transacao`.

**Fábrica e assinatura** (linhas 65-85, 134):
```typescript
export interface ServicoDeFunis {
  listar(membro: MembroDaSessao, filtro: FiltroDeFunis): Promise<ResultadoCrm<Pagina<FunilResumo>>>;
  criar(membro: MembroDaSessao, entrada: NovoFunil): Promise<ResultadoCrm<FunilDetalhado>>;
  ...
}
export function criarServicoDeFunis(deps: { readonly pool: () => Pool; readonly acesso: AcessoAoCrm }): ServicoDeFunis {
```

**FRASES (rede contra corrida; sem nome de constraint na frase)** (linhas 88-105):
```typescript
const FRASES: FrasesDeRestricao = {
  funis_nome_uq: { codigo: "FUNIL_NOME_EM_USO", error: "Já existe um Funil com este nome." },
  negocios_workspace_id_funil_id_fkey: { codigo: "FUNIL_COM_NEGOCIOS", error: "..." },
};
```
Equivalentes da fase: `canais_nome_uq` → `CANAL_NOME_EM_USO`, `canais_conta_uq` → `CANAL_CONTA_EM_USO`, `conversas_nao_resolvida_uq` → `CONVERSA_JA_ABERTA`, `mensagens_id_externo_uq` (idempotente, não vira erro em `registrarRecebida`).

**Recusas como valor** (linhas 107-121):
```typescript
const naoEncontrado = () => recusa<never>(404, "Funil não encontrado.", { codigo: "FUNIL_NAO_ENCONTRADO" });
function valorInvalido(falha: { readonly error: string; readonly field?: string | undefined }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", ...(falha.field !== undefined ? { campo: falha.field } : {}) });
}
```

**Núcleo: papel → validação sem banco → transação** (linhas 147-169):
```typescript
const negado = await exigir(deps.acesso, membro, acao, "funil");
if (negado) return { ok: false, ...negado };
const invalido = opcoes.validar?.();
if (invalido) return invalido;
return comTransacao(deps.pool, async (cliente) => {
  const repositorio = criarRepositorioDeFunisPg(cliente);
  const funil = await repositorio.obter(membro.workspaceId, id, { travar: true });
  if (!funil) return naoEncontrado();
  ...
}, FRASES);
```
Leitura (linhas 211-221): `exigir(..., "ler", recurso)` e `criarRepositorioDe...Pg(deps.pool())` sem transação. `workspaceId` SEMPRE de `membro.workspaceId`.

Específico da fase: `POST /conversas` cria Conversa + 1ª Mensagem na MESMA `comTransacao` (INV-CXE-05); guarda entre acervos (Canal antigo em `registros` com mesmo nome/(tipo, identificador)) antes do insert (A5); escritas de Canal fazem `update plataforma.workspaces set revisao = revisao + 1` na mesma transação (A4).

**Ajuste obrigatório em `servicos/crm/contatos.ts`** (`FRASES` em `:72`): somar `conversas_workspace_id_contato_id_fkey` → `CONTATO_COM_CONVERSAS` e pré-check `conversasDoContato` em `excluirPermanentemente` (hoje viraria 500).

---

### `apps/api/src/rotas/crm/{canais,conversas,mensagens}.ts` (rota, request-response)

**Análogo:** `apps/api/src/rotas/crm/funis.ts`

**Imports** (linhas 28-33):
```typescript
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ServicoDeFunis } from "../../servicos/crm/funis";
import { PARAMS_ID, QUERY_LISTA, responder, responderLista, TEXTO_CURTO, TEXTO_LONGO } from "./comum";
```

**Esquemas `.strict()` sem campos de servidor** (linhas 68-92): `NOVO_CANAL` (Code Example 3 da pesquisa: `provedor`, `nome`, `identificador`, `filaPadraoId?`, `origemPadraoId?`; sem `tipo`, `conexao`, `estado`, `configuradoPor`, `workspaceId`); edição com `.refine((corpo) => Object.keys(corpo).length > 0, { message: "Informe ao menos um campo para editar." })`.

**Registro** (linhas 107-125, 151-153):
```typescript
export async function rotasDeFunis(app: FastifyInstance, opcoes: { readonly servico: ServicoDeFunis }): Promise<void> {
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const { servico } = opcoes;
  rotas.get("/funis", { schema: { querystring: QUERY_LISTA } }, async (request, reply) =>
    responderLista(reply, await servico.listar(request.membro, request.query)));
  rotas.post("/funis", { schema: { body: NOVO_FUNIL } }, async (request, reply) =>
    responder(reply, await servico.criar(request.membro, request.body), 201));
  rotas.post("/funis/:id/arquivar", { schema: { params: PARAMS_ID } }, async (request, reply) =>
    responder(reply, await servico.arquivar(request.membro, request.params.id)));
}
```
Ações sem corpo (`simular-conexao`, `desconectar`, `arquivar`, `resolver`, `reabrir`) NÃO declaram `body` (cabeçalho `:24-26`, Fastify 5 recusa `content-type: json` sem corpo). Sem rota `DELETE` de Canal (DO-CXE-03) e sem rota humana de Mensagem `recebida`.

**`rotas/crm/index.ts`** (linhas 27-53): acrescentar `canais?`, `conversas?`, `mensagens?` em `OpcoesDeCrm` e, em `rotasDeCrm`:
```typescript
const canais = opcoes.canais ?? criarServicoDeCanais({ pool: obterPool, acesso });
await app.register(rotasDeCanais, { servico: canais });
```

**`rotas/crm/comum.ts`**: criar `QUERY_LISTA_DE_CANAIS` e `QUERY_LISTA_DE_CONVERSAS` copiando `QUERY_LISTA` (linhas 21-28) mas com enum próprio de estado (`ativo|arquivado` e `ativo|na_lixeira`); NÃO reusar `ESTADO` (Pitfall 10).

---

### `packages/dominio/src/crm/{canais,conversas,mensagens}.ts` e `permissoes.ts` (modelo + regras, request-response)

**Análogo:** `packages/dominio/src/crm/funis.ts` (cabeçalho `:1-40`): tipos camelCase espelhando as colunas, nenhum tipo com `workspaceId`, imports `import { fail, ok, type OperationResult } from "../state"; import { LIMITES_CRM, type EstadoCrm } from "./comum";`, regras `validarX(entrada): OperationResult<...>` puras, sem barril (resolve por `"./*": "./src/*.ts"`). Reuse `identificadorCanonico`/`FORMA_DO_IDENTIFICADOR` de `../operations/canais` (`:56`, `:41`).

**`permissoes.ts`** (linhas 27-41, 64-70): estender
```typescript
export type RecursoCrm = "contato" | "empresa" | "funil" | "negocio";   // + "canal" | "conversa" | "mensagem"
export type AcaoCrm = "ler" | "criar" | ... | "definir_padrao";          // + "conectar" | "simular_conexao" | "desconectar"
...
if (recurso === "funil" && !ehAdministracao(base)) {
  return "Só Administrador ou Proprietário configura Funis e Etapas (RN-FUN-17).";
}
```
com um `if (recurso === "canal" && acao !== "ler" && !ehAdministracao(base)) return "Só Administrador ou Proprietário ... Canais (B35)."`; `conversa`/`mensagem` ficam no "resto → pode" para `membro`. Estender `permissoes.test.ts`.

**`capacidadesDoCanal`** (em `operations/conversations.ts`, ao lado de `CHANNEL_CAPABILITIES` `:17`): esboço no `08-RESEARCH.md` Pattern 1 (remove `responseWindowHours` e zera `requiresTemplateOutsideWindow` para `whatsapp-nao-oficial`). Sítios a migrar de `CHANNEL_CAPABILITIES[channel.channelType]`: `conversations.ts:108` (`windowOpenUntil`), `:158` (`sendMessage`), `derive.ts:347` (callback por tipo vira por Canal), e na web `configuracoes/page.tsx:76`, `canais/[canal]/page.tsx:70`, `[conversa]/page.tsx:114`, `inbox-columns.tsx:527`, `contact-card.tsx:163`, `conversation-thread.tsx:362,367`, `flow-popup.tsx:447`. `resolvesIdentifierTypes` (`conversations.ts:389,696`, `derive-conversacional.ts:154`) NÃO muda.

**`canaisQueAlcancam`/`canalPadraoDeResposta`**: modelo em `derive-conversacional.ts:145-157` (já existe `canaisQueAlcancam(state, contact)` filtrando `lifecycle === "ativo"` e `resolvesIdentifierTypes`); a derivação da fase soma "só `connection === "conectada"`" e "padrão = Canal da última `recebida`".

---

### `apps/api/src/persistencia/canais-projetados.ts` + ganchos (ponte D-11)

**Análogo:** `persistencia/repositorio.ts` (`hidratar`/`gravar`) e os dois pontos de entrada. Não há análogo de projeção: seguir o `08-RESEARCH.md` Pattern 5 e Code Example 4.

**Gancho em `executar`** (`unidade-de-trabalho.ts:128`, depois de `hidratar`, e `:173` antes de `gravar`):
```typescript
const antes = await hidratar(cliente, workspaceId);
// + carregarCanaisProjetados / acrescentarCanaisProjetados(antes.state, ...)
syncIdSequence(antes.state);
...
// + retirarCanaisProjetados(antes.state, ids, jsonAntes)  <- ANTES de gravar
const diferenca = await gravar(cliente, workspaceId, antes.state, antes);
```
**Por que:** `gravar` (`repositorio.ts:161-197`) faz `upserts.push` de todo registro cujo JSON difere de `antes.original[colecao]`, então um Canal projetado vazaria para `registros` (Pitfall 3). Teste: `count(*) from plataforma.registros where colecao='channels'` inalterado.

**Gancho em `GET /estado`** (`rotas/estado.ts:31-35`):
```typescript
const { state, revisao, ordem } = await hidratar(cliente, request.membro.workspaceId);
// + acrescentarCanaisProjetados(state, await carregarCanaisProjetados(cliente, workspaceId))  (sem retirar)
return { data: state, revisao, ordens: ordensComoObjeto(ordem), sessao: { memberId: request.membro.id } };
```
**Guarda:** `select to_regclass('plataforma.canais')` antes de consultar (Pitfall 1); teste com banco 001..007 ⇒ `/estado` 200. NÃO projetar dentro de `hidratar()`. Ids: UUID cru da tabela (sem colisão com `chn_*`).

---

### `apps/web/src/dados/crm/canais.ts` (cliente HTTP, CRUD)

**Análogo:** `apps/web/src/dados/crm/funis.ts`

**Imports/cabeçalho** (linhas 1, 19-30): `"use client"; import useSWR from "swr"; import { chamarCrm, ErroDeApi, invalidarCrm } from "./cliente-crm";` e tipos de `@n1/dominio/crm/canais`. Nada de importar `apps/api`.

**Chave + leitura SWR** (linhas 44-61, 63-79):
```typescript
export function chaveDeFunis(filtro: FiltroDeFunis): string { ... return `/funis?${parametros.toString()}`; }
export function useFunis(filtro, opcoes: { readonly pausado?: boolean } = {}) {
  return useSWR<RespostaDaListaDeFunis, Error>(opcoes.pausado ? null : chave, (k: string) => chamarCrm<RespostaDaListaDeFunis>(k), { keepPreviousData: true });
}
function valeRepetir(erro: Error): boolean { return !(erro instanceof ErroDeApi) || erro.status === 0 || erro.status >= 500; }
```

**Gravação + invalidação só no sucesso** (linhas 81-95):
```typescript
async function gravar<T>(caminho: string, verbo: Verbo, corpo?: unknown, tambemInvalida: readonly string[] = []): Promise<T> {
  const resposta = await chamarCrm<{ ok: true; dados: T }>(caminho, { method: verbo, ...(corpo !== undefined ? { corpo } : {}) });
  await invalidarCrm("/funis");
  for (const prefixo of tambemInvalida) await invalidarCrm(prefixo);
  return resposta.dados;
}
export function criarFunil(entrada: NovoFunil) { return gravar("/funis", "POST", entrada); }
export function arquivarFunil(id: string) { return gravar(`${chaveDoFunil(id)}/arquivar`, "POST"); }
```
Ações sem corpo (`simular-conexao`, `desconectar`) não passam `corpo` (sem `content-type`). Depois de gravar, quem chama também faz `useStore().rehidratar()` (o chat vive no store) antes de `router.push`.

**Teste:** `dados/crm/cliente-crm.test.ts:11-60` (mock hoisted de `@/autenticacao/cliente-navegador`, `vi.stubGlobal("fetch", fetchMock)`, `respostaFalsa(status, corpo)`; provar ausência de `content-type` em ação sem corpo e 409 → `ErroDeApi`).

---

### Páginas de conexão (web): `canais/conectar/page.tsx` e `canais/conectar/[provedor]/page.tsx`

**Análogos:** `configuracoes/page.tsx` (cartões) e `canais/[canal]/page.tsx` (`use(params)`) e `features/crm/adicionar-canal-dialog.tsx` (formulário).

**Cartões `grade-solta`/`item-solto`** (`configuracoes/page.tsx:80-110`):
```tsx
<ul className="grade-solta sm:grid-cols-2">
  {channels.map((channel) => (
    <li key={channel.id}>
      <Link href={`/crm/caixa-de-entrada/configuracoes/canais/${channel.id}`} className="item-solto h-full" data-bloco="true">
        <p className="flex items-start justify-between gap-2">
          <span className="app-md" style={{ color: "var(--texto)" }}>{channel.name}</span>
          <StateSeal state={channel.lifecycle} />
        </p>
        <p className="app-meta mt-1">...</p>
```
Quatro cartões vêm de `PROVEDORES_DE_CANAL`; botão "Conectar Canal" no `Section title="Canais"` (`:68`). A lista ganha selo do provedor (`Pilula`) e origem tabela×demo (D-12).

**Página dinâmica Next 16** (`canais/[canal]/page.tsx:1-60`):
```tsx
"use client";
import { use, useState } from "react";
export default function CanalPage({ params }: { params: Promise<{ canal: string }> }) {
  const { canal } = use(params);
  ...
  if (!channel) { return (<div className="flex h-full flex-col"><PageHeader title="Canal não encontrado" /> ... <EmptyState .../>
```
Para `[provedor]`: `params: Promise<{ provedor: string }>`, `use(params)`, slug fora de `PROVEDORES_DE_CANAL` ⇒ `notFound()` (ler `node_modules/next/dist/docs/` antes, conforme `AGENTS.md`). Cabeçalho: `PageHeader path={<>Caixa de Entrada › Configurações</>}` (`:90-100`).

**Formulário** (`adicionar-canal-dialog.tsx:60-78`, `:127-172`): reaproveitar o encadeamento de `motivo` (permissão → nome → identificador → forma) e os `Field`/`TextInput`/`Select` de Nome, Identificador (`forma.rotulo/dica/exemplo` de `FORMA_DO_IDENTIFICADOR`, `invalid={formaInvalida}`), Setor (Fila, `state.queues` ativo) e Origem (`state.catalog` `kind === "origem"` ativo). Troca: em vez de `run(criarCanal(...))` chamar `criarCanal` do REST (`dados/crm/canais.ts`) com `provedor`; o tipo vem do provedor. Nasce `desconectada`; "Simular conexão" só com `usePodeNoCrm("simular_conexao","canal")` e com marca visível.

**Ficha** (`canais/[canal]/page.tsx:69-83`): `configurar` hoje usa `run((data, me) => configurarCanal(...))`; para Canal `relational` passa a `PATCH /canais/:id` + `rehidratar()`, para o do seed (demo) fica igual. `CHANNEL_CAPABILITIES[channel.channelType]` (`:70`) vira `capacidadesDoCanal(channel)`.

---

### `features/crm/conversation-thread.tsx` e `inbox-columns.tsx` (componente, event-driven)

**Análogo:** os próprios arquivos (reescrita contida; 1409 e 536 linhas). Extrair a lógica para funções puras no domínio ANTES de ligar (Pitfall 6).

**Pontos de mudança no thread:**
- `channelsOf(contact)` (`:191-199`) e `ORDEM_DOS_CANAIS` (`:114-120`): hoje retornam `ChannelType[]` por ordem fixa da plataforma; viram `canaisQueAlcancam(state, contact): Channel[]` (por Canal).
- `canal`/`doCanal`/`conversa`/`channel` (`:348-366`): de `ChannelType` para `channelId`:
```tsx
const doCanal = canal ? conversas.filter((c) => state.channels.find((ch) => ch.id === c.channelId)?.channelType === canal) : [];
const conversa = doCanal.find((c) => c.state !== "resolvida") ?? doCanal[0];
const capacidades = canal ? CHANNEL_CAPABILITIES[canal] : undefined;
const abertaAte = conversa ? responseWindowOpenUntil(state, conversa, (tipo) => CHANNEL_CAPABILITIES[tipo as ChannelType]) : null;
```
- `canalAtivoId()` (`:393-400`): "primeiro Canal ativo do tipo" é o que D-15 elimina; passa a ser `canal.id`.
- Abas (`:522-545`): `ORDEM_DOS_CANAIS.map((tipo) => ...)` com `role="tab"`, `aria-selected`, `aria-disabled={!alcancavel}`, `title={motivo}` ("Este Contato não tem ..."): manter o mesmo JSX/ARIA, iterando Canais ativos e rotulando com `rotuloDoCanal`.
- "Responder por": novo `Select` no compositor; trocar chama `startConversation(data, me, channelId, contact.id)`, que já devolve a existente (`conversations.ts:706-713`).

**Pontos de mudança na lista (`inbox-columns.tsx`):** item (`:282-283`) `const canal = channel?.channelType; const IconeDoCanal = canal ? CHANNEL_ICON[canal] : undefined;` ganha `channel.name`; filtro (`:465-475`) `label: \`${c.name} · ${CHANNEL_TYPE_LABEL[c.channelType] ?? c.channelType}\`` ganha selo; `isOutsideWindow` (`:522-532`) usa `capacidadesDoCanal(channel)`.

**Chamadores a atualizar:** `[conversa]/page.tsx:431`, `deal-screen.tsx:658`, `legado/ficha-de-contato-legado.tsx:254`, `estrutura/tarefa-completa.tsx:2124`; `legado/ficha-de-empresa-legado.tsx:121,257` e `ficha-de-contato-legado.tsx:138` importam `channelsOf`.

---

### Testes

**`apps/api/src/rotas/crm/canais.test.ts` etc.** (molde `funis.test.ts:12-80`): duas partes. 1) serviço falso, sem banco:
```typescript
function opcoesDeAutenticacao(workspaceId: string) {
  return { logger: false, workspaceId,
    verificarToken: async (token: string) => (token === "token-maryane" ? { sub: MARYANE } : null),
    resolverMembro: async (_w: string, userId: string) => membros.find((m) => m.userId === userId) };
}
const responder = (nome: keyof ServicoDeFunis, ...argumentos: unknown[]) => { chamadas.push([nome, ...argumentos]); return Promise.resolve((respostas[nome] ?? sucesso(detalheFalso)) as never); };
```
com `buildApp({ ...opcoesDeAutenticacao(ws), crm: { canais: servicoFalso, acesso: acessoFalso } })`; 2) `describeComBanco` com serviço real: `prepararBancoCrm`, `novoEspacoDeTeste`, `semearMembro`, `limparEspaco`, `encerrar` em `afterAll`.

**`testes/banco-crm.ts`** (`limparEspaco`, linhas 60-68): acrescentar `"mensagens", "conversas", "canais"` ANTES de `"negocios", ..., "contatos"` na lista de tabelas (FK; Pitfall 2). Container por plano: `crm-n1-pg-08NN`, porta `555NN` (comentário `:10-13`).

**`e2e/canais-fluxo.test.ts`** (molde `e2e/crm-fluxo.test.ts:33-70`): `SESSOES` por token (`token-admin`, `token-membro`, `token-de-fora`), `appDoEspaco(workspaceId)` com `buildApp` real, `it`s sequenciais compartilhando estado; cenário "dois WhatsApps" com números distintos; Membro de outro Espaço recebe 404.

**`rotas.test.ts`** (web): acrescentar asserções dentro de `reconhece cada família pelo prefixo` e `não colapsa as configurações da Caixa`:
```typescript
expect(formaDe("/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-cloud")).toBe("tabela");
expect(chaveDeChegada("/crm/caixa-de-entrada/configuracoes/canais/conectar")).toBe("/crm/caixa-de-entrada/configuracoes/canais/conectar");
```
(sem mudar `rotas.ts`).

## Padrões compartilhados

### Autorização por Papel (backend aplica, tela espelha)
**Fonte:** `apps/api/src/servicos/crm/acesso.ts:39-52` e `packages/dominio/src/crm/permissoes.ts`
**Aplicar em:** todo método de todo serviço novo, ANTES da transação.
```typescript
const negado = await exigir(deps.acesso, membro, "criar", "canal");
if (negado) return { ok: false, ...negado };
```
A tela usa o mesmo `podeNoCrm` (via `usePodeNoCrm`) só para esconder; nunca como única barreira.

### Isolamento por Espaço
**Fonte:** `repositorios/crm/funis.ts` (cabeçalho `:5-8`). `workspaceId` só de `request.membro.workspaceId`; `workspace_id = $1` em todo `WHERE`; id de outro Espaço ⇒ 404 (`recusa(404, ...)`), nunca 403; teste IDOR por Canal/Conversa/Mensagem.

### Transação + tradução de SQLSTATE
**Fonte:** `servicos/crm/transacao.ts:24-80`. `comTransacao(deps.pool, fn, FRASES)`: `begin` → `fn` → `commit`/`rollback`; `23505`/`23503`/`23514` com frase cadastrada viram 409 sem o nome do constraint; sem frase, relança (500 genérico).

### Envelope HTTP e erros
**Fonte:** `rotas/crm/comum.ts:59-75`. Sucesso `{ ok: true, dados }` / lista `{ ok: true, itens, total }` / erro `{ ok: false, error, codigo?, campo?, bloqueios? }`. 400 forma, 403 Papel, 404, 409. Recusa de regra nunca viaja em 200.

### Cliente HTTP único no web
**Fonte:** `apps/web/src/dados/crm/cliente-crm.ts` (`chamarCrm`, `ErroDeApi`, `invalidarCrm`). Token só no header; `content-type` só com corpo; chaves SWR começam pelo prefixo do recurso (`/canais`) para `invalidarCrm("/canais")`.

### Regra de dependência
`packages/dominio` não importa ninguém; `apps/web` e `apps/api` só importam `@n1/dominio` (subcaminhos `@n1/dominio/crm/canais`). Mudança nasce no domínio e desce. Cor só via `src/estilos/tokens.css` (`var(--aviso)`, `var(--texto)`...).

### Documentos vivos
Atualizar no mesmo plano que muda o fato: `CONTEXT.md` da raiz ("Estado atual"), `apps/api/src/{rotas,repositorios,persistencia}/CONTEXT.md`, `apps/web/CONTEXT.md`.

## Sem análogo próximo

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `apps/api/src/persistencia/canais-projetados.ts` | serviço (ponte) | transform | Não existe projeção de tabela relacional no `DataState`; usar `08-RESEARCH.md` Pattern 5 + Code Example 4 e os pontos de gancho acima |
| `apps/web/src/features/crm/conversation-thread.test.tsx`, `inbox-columns.test.tsx` | teste de componente | event-driven | Nenhum teste de componente desses dois existe; copiar só a mecânica de mock de `cliente-crm.test.ts` (`vi.hoisted`, `vi.stubGlobal`), `// @vitest-environment jsdom` na 1ª linha e `SWRConfig provider: () => new Map()` |

Observação: separador "via Comercial (...)" de D-13 não tem host depois de D-14 (Open Question 2 da pesquisa); implementar só a derivação pura + componente com teste, sem criar visão mista.

## Metadados

**Escopo da busca:** `apps/api/{migracoes,src/{rotas,servicos,repositorios,persistencia,testes,e2e}}`, `packages/dominio/src/{crm,operations,types}`, `apps/web/src/{dados,features,app/(shell)/crm/caixa-de-entrada}`
**Arquivos lidos:** ~22
**Verificação de rastreio (git ls-files):** `rotas/crm/funis.ts`, `repositorios/crm/funis.ts`, `dados/crm/funis.ts`, `007-crm.sql`, `crm/funis.ts` confirmados rastreados
**Data da extração:** 2026-10-12
