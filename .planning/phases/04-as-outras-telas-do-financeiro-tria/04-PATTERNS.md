# Phase 4: As outras telas do financeiro-tria - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 18 (arquivos novos/modificados citados em CONTEXT.md/RESEARCH.md)
**Analogs found:** 15 / 18

Esta fase atravessa **dois repositórios**. Nenhum código é movido entre eles —
cada seção abaixo indica o repositório do arquivo novo e o repositório (igual
ou diferente) do analog.

---

## File Classification

| New/Modified File | Repo | Role | Data Flow | Closest Analog | Repo do Analog | Match Quality |
|---|---|---|---|---|---|---|
| `automation/src/http/leituras-plataforma-routes.ts` (ou um arquivo por leitura) | financeiro-tria | route (Express) | request-response | `automation/src/http/contas-a-pagar-routes.ts` | financeiro-tria | exact (mesma disciplina, sentido HTTP oposto) |
| `automation/src/http/leituras-plataforma-routes.test.ts` | financeiro-tria | test | request-response | `automation/src/http/contas-a-pagar-routes.test.ts` | financeiro-tria | exact |
| `automation/src/http/leituras-plataforma-dtos.ts` (allowlists) | financeiro-tria | transform (DTO projection) | transform | `automation/src/http/contas-a-pagar-routes.ts` (schemas `.strict()` inline) | financeiro-tria | role-match — nenhum arquivo de DTO/allowlist isolado existe hoje; ver "No Analog Found" |
| `automation/src/tenants/tria/financeiro-derivacoes.ts` (re-home de `buildDashboardStats`/`buildProblemRows`) | financeiro-tria | service (pure transform) | batch/transform | `automation/src/tenants/tria/payment-rules.ts` | financeiro-tria | role-match (pure + tested module shape) |
| `automation/src/tenants/tria/financeiro-derivacoes.test.ts` | financeiro-tria | test | transform | `automation/src/tenants/tria/payment-rules.test.ts` | financeiro-tria | exact (mesmo runner `node:test`) |
| `apps/api/src/rotas/financeiro.ts` | crm-n1 | route (Fastify) | request-response | `apps/api/src/rotas/estado.ts` | crm-n1 | exact (rota não-operação, raiz, herda JWT) |
| `apps/api/src/rotas/financeiro.test.ts` | crm-n1 | test | request-response | analog de teste de `estado.ts` (não localizado nesta busca — ver nota) / `integracao-solicitacoes.ts` para forma de asserts de erro | crm-n1 | role-match |
| `apps/api/src/automacoes/cliente-leituras-financeiro.ts` | crm-n1 | service (outbound HTTP client) | request-response | `apps/api/src/automacoes/invocar-agente.ts` | crm-n1 | exact (molde explícito em D4-01) |
| `apps/api/src/automacoes/cliente-leituras-financeiro.test.ts` | crm-n1 | test | request-response | `apps/api/src/automacoes/invocar-agente.test.ts` | crm-n1 | exact |
| Upload proxy `POST /financeiro/extratos` (dentro de `apps/api/src/rotas/financeiro.ts`) | crm-n1 | route (file-I/O) | file-I/O | `automation/src/http/bank-statement-webhooks.ts` (padrão de `rawBody`/`:origem` do lado que RECEBE o arquivo) | financeiro-tria | role-match — o proxy em si não tem analog em `apps/api` (nenhuma rota de upload existe hoje ali); ver "No Analog Found" |
| `apps/web/src/app/(shell)/financeiro/page.tsx` (Dashboard) + as 7 sub-rotas | crm-n1 | route (Next App Router page) + component | request-response | `apps/web/src/features/estrutura/financeiro/contas-view.tsx` (composição de tabela financeira) — **ver ressalva abaixo** | crm-n1 | partial-match |
| `apps/web/src/features/financeiro/dados/*` (fetch por tela) | crm-n1 | utility (server fetch) | request-response | `apps/web/src/dados/estado-inicial.ts` | crm-n1 | exact (D4-15 pede exatamente os 3 estados que este arquivo já resolve: 401/403/indisponível) |
| `apps/web/src/features/financeiro/componentes/*` (tabelas, indicadores) | crm-n1 | component | CRUD/read | `apps/web/src/features/shell/ui.tsx` (`ActionMenu`, `Chip`, `Pilula`, `EmptyState`, `Select`) + `apps/web/src/features/shell/record-list.tsx` | crm-n1 | role-match |
| Nav registration `/financeiro` no shell | crm-n1 | provider/config (nav list) | request-response | `apps/web/src/features/shell/app-shell.tsx` (array `ASSUNTOS`, não `navegacao.ts` — ver nota) | crm-n1 | exact (depois de corrigir o arquivo certo) |
| `apps/web/src/features/shell/rotas.ts` (`formaDe`, `chaveDeChegada`) — precisa reconhecer os 8 novos pathnames | crm-n1 | utility (route classification) | transform | ele mesmo (arquivo existente a MODIFICAR, não a criar) | crm-n1 | exact |
| `apps/web/src/features/shell/rotas.test.ts` | crm-n1 | test | transform | ele mesmo (a estender) | crm-n1 | exact |
| Derived reachability check na rota `GET /financeiro/*` (`memberReachesContainer`) | crm-n1 | middleware (authorization) | request-response | `packages/dominio/src/operations/contas-a-receber.test.ts` (uso real de `memberReachesContainer` em PAG-06/03-05) + `packages/dominio/src/derive.ts:910` (a função) | crm-n1 | exact |
| Fixture compartilhada de `solicitacoes_pagamentos`/`transacoes` para testes | financeiro-tria + crm-n1 | test fixture | transform | nenhuma fixture equivalente localizada — **No Analog** | — | none |

---

## Pattern Assignments

### `automation/src/http/leituras-plataforma-routes.ts` (route, request-response) — financeiro-tria

**Analog:** `automation/src/http/contas-a-pagar-routes.ts` (409 linhas, lido integralmente nas linhas 1-120 + inventário do RESEARCH.md)

**Header comment pattern (linhas 1-38)** — copiar a disciplina do comentário de cabeçalho, adaptando o "porquê": este arquivo explica por que a rota NÃO importa `../contratos/v1.ts` (o contrato é `automation/`→plataforma; `/v1/leituras/*` é o sentido oposto — mesmo argumento, outra direção).

**Auth em tempo constante (linhas 40, a recriar; ver corpo completo do arquivo para `digestoConstante`/`credenciaisIguais`/`extrairBearer`):**
```typescript
import { createHash, timingSafeEqual } from "node:crypto";

function digestoConstante(valor: string): Buffer {
  return createHash("sha256").update(valor, "utf8").digest();
}
function credenciaisIguais(a: string, b: string): boolean {
  return timingSafeEqual(digestoConstante(a), digestoConstante(b));
}
function extrairBearer(req: Request): string | undefined {
  const cabecalho = req.header("authorization");
  if (!cabecalho) return undefined;
  const [esquema, ...resto] = cabecalho.split(" ");
  const valor = resto.join(" ");
  if ((esquema || "").toLowerCase() !== "bearer" || !valor) return undefined;
  return valor;
}
```
Recriar estas ~15 linhas em `leituras-plataforma-routes.ts` — não importar de `contas-a-pagar-routes.ts` (acoplaria duas superfícies novas sem motivo) nem do módulo do contrato v1 (D4-03 proíbe explicitamente).

**Schemas `.strict()` (linhas 60-107):**
```typescript
export const entradaDeResolucao = z
  .object({ taskId: z.string().min(1), /* ... */ })
  .strict();
```
Para `/v1/leituras/*`, os schemas validam **query params** (`empresa`, paginação), não corpo — GETs sem corpo. Mesma disciplina `.strict()` aplicada ao `req.query` via `z.object({...}).strict().safeParse(...)`.

**Envelope de erro sanitizado (linhas 109-120, `MENSAGENS_FIXAS`):**
```typescript
const MENSAGENS_FIXAS: Record<string, string> = {
  CREDENCIAL_AUSENTE: "Autenticação ausente.",
  CREDENCIAL_INVALIDA: "Autenticação inválida.",
  SCHEMA_INVALIDO: "Corpo da requisição não corresponde ao esperado.",
  ERRO_INTERNO: "Erro interno.",
};
```
Adaptar as chaves para o vocabulário de leitura (`SCHEMA_INVALIDO` continua igual; trocar mensagens de "lançamento" por "leitura" onde aplicável). Nunca `pg.message`, nunca stack, nunca eco do corpo.

**Env token — `optionalEnv`, nunca `requiredEnv` (comentário linhas 34-37):** `PLATAFORMA_LEITURA_TOKEN` lida por `optionalEnv(..., "")`, mesma convenção de `PLATAFORMA_LANCAMENTO_TOKEN`.

---

### `automation/src/http/leituras-plataforma-routes.test.ts` (test) — financeiro-tria

**Analog:** `automation/src/http/contas-a-pagar-routes.test.ts`
**Runner:** `tsx --test` (node:test), mesmo script de `automation/package.json`.
Casos a espelhar: 401 sem Bearer, 401 com Bearer errado (prova de tempo constante não é testável diretamente, mas a ausência de `===` ingênuo é), 400 com query fora do schema `.strict()`, 200 com allowlist provada por ausência de campo por nome (`expect(Object.keys(dto)).not.toContain("app_key")`).

---

### `automation/src/http/leituras-plataforma-dtos.ts` (transform/allowlist) — financeiro-tria

**No analog exato** — hoje a projeção de DTO vive inline nos schemas de `contas-a-pagar-routes.ts` (schemas de ENTRADA, não de SAÍDA/projeção). Nenhuma rota do `automation/` hoje declara uma allowlist de saída explícita — `GET /financeiro/solicitacoes` (o próprio problema que D4-05 resolve) repassa a linha inteira sem projeção. **Este é um formato genuinamente novo** — o planner deve tratá-lo como tal, não como cópia de um arquivo existente. Usar como inspiração de forma (não de conteúdo) o padrão de DTO explícito em `apps/api/src/servicos/dto-solicitacao.ts` (citado em `integracao-solicitacoes.ts` linha 55, `paraDtoV1`) — mesmo princípio "cada rota devolve um shape explícito, nunca a linha do banco".

---

### `automation/src/tenants/tria/financeiro-derivacoes.ts` (re-home de `buildDashboardStats`/`buildProblemRows`) — financeiro-tria

**Fonte da lógica (a portar, não copiar por referência):** `financeiro-tria/src/features/financeiro/data/solicitacoesPagamentos.ts`, funções `buildDashboardStats` (~l. 110) e `buildProblemRows` (~l. 137):
```typescript
export function buildDashboardStats(rows: SolicitacaoPagamento[]) {
  const pending = rows.filter((row) => row.Aprovado !== true);
  const approved = rows.filter((row) => row.Aprovado === true);
  const pagar = rows.filter((row) => classifySolicitacao(row).toLowerCase().includes("pagar"));
  const receber = rows.filter((row) => classifySolicitacao(row).toLowerCase().includes("receber"));
  return [ /* 4 métricas: total, aguardando aprovação, a pagar, aprovadas */ ];
}

export function buildProblemRows(rows: SolicitacaoPagamento[]) {
  return rows
    .filter((row) => row.Aprovado !== true)
    .map((row) => ({ id: `SP-${row.id}`, severity: ..., title: ..., description: ..., where: ..., age: ..., action: "Revisar", technical: ... }));
}
```
**Não portar** `realIntegrations` (linhas seguintes no mesmo arquivo) — é ficção de protótipo (D4-06), confirmado por leitura direta.

**Molde de módulo puro+testado no destino:** `automation/src/tenants/tria/payment-rules.ts` — funções puras, sem I/O, `optionalEnv` só para configuração, exportadas individualmente:
```typescript
export function resolveAccountConfig(centroCusto: string): AccountConfig { /* ... */ }
export function resolveResponsible(centroCusto: string, valor?: number | null): ResponsibleRule { /* ... */ }
```
`financeiro-derivacoes.ts` deve seguir a mesma forma: funções puras exportadas individualmente, tipos de entrada/saída explícitos, zero import de `express`/`supabase` no arquivo.

---

### `automation/src/tenants/tria/financeiro-derivacoes.test.ts` (test) — financeiro-tria

**Analog:** `automation/src/tenants/tria/payment-rules.test.ts`
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { resolveAccountConfig, resolveResponsible } from "./payment-rules";

test("resolve conta TRIA ou FINQ por centro de custo", () => {
  assert.equal(resolveAccountConfig("FINQ").key, "FINQ");
  assert.equal(resolveAccountConfig("Tria Tech").key, "TRIA");
});
```
Para `financeiro-derivacoes.test.ts`: D4-06/RESEARCH.md exige EQUIVALÊNCIA com as funções originais (mesma fixture, mesmo resultado) — não é só cobertura de caso, é prova de que o re-home não mudou comportamento. Fixture deve vir de `solicitacoesPagamentos.ts` sem dado real/credencial.

---

### `apps/api/src/rotas/financeiro.ts` (route, request-response) — crm-n1

**Analog:** `apps/api/src/rotas/estado.ts` (71 linhas, lido integralmente)
```typescript
import type { FastifyInstance } from "fastify";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";

export async function rotasDeFinanceiro(app: FastifyInstance): Promise<void> {
  app.get("/financeiro/dashboard", async (request, reply) => {
    const cliente = await pool().connect();
    try {
      const { state } = await hidratar(cliente, request.membro.workspaceId);
      if (!memberReachesContainer(state, request.membro.id, "folder", CP.folderId)) {
        reply.code(403);
        return { error: "Sem acesso." };
      }
      // chamar cliente-leituras-financeiro.ts, projetar, devolver
    } finally {
      cliente.release();
    }
  });
}
```
**Registro:** em `app.ts`, `app.register(rotasDeFinanceiro)` **na raiz** (como `rotasDeEstado`), herdando `registrarAutenticacao` (JWT). **NUNCA** dentro de `app.register(async (integracao) => {...}, { prefix: PREFIXO_ROTAS_DE_SERVICO })` — esse plugin é para o sentido `automation/`→`apps/api` (credencial de serviço), o oposto do que esta rota precisa (JWT de Membro). Ver Pitfall 4 do RESEARCH.md.

**Contraste explícito — o que NÃO copiar:** `apps/api/src/rotas/integracao-solicitacoes.ts` (linhas 1-60 lidas) vive sob o prefixo de serviço, exige `request.servico` (não `request.membro`), usa `comIdempotencia` (só faz sentido em escrita) e responde os DTOs do contrato v1 (`../contratos/v1.ts`) — nenhum desses três traços se aplica a `rotas/financeiro.ts`. Misturar os dois é o Pitfall 4 nomeado no RESEARCH.md.

---

### `apps/api/src/automacoes/cliente-leituras-financeiro.ts` (service, outbound HTTP) — crm-n1

**Analog:** `apps/api/src/automacoes/invocar-agente.ts` (498 linhas; lidas linhas 1-100)
```typescript
import { sanitizarErro } from "../persistencia/outbox-worker";

const STATUS_PERMANENTES: readonly number[] = [400, 401, 403, 404, 422];

function retryableDoEnvelope(corpo: unknown): boolean | undefined { /* ... */ }
function codigoDoEnvelope(corpo: unknown): string | undefined { /* ... */ }

// fetch com AbortSignal.timeout, Authorization: Bearer, x-request-id: randomUUID()
```
Diferença deliberada (já nomeada no RESEARCH.md Pattern 2): o cliente de leituras é mais simples que `invocar-agente.ts` — sem cache de aquecimento, sem `rodarAgenda`, sem transação; é uma chamada HTTP direta dentro do handler Fastify (nunca dentro de uma Unidade de Trabalho, porque não grava no domínio). Token: `PLATAFORMA_LEITURA_TOKEN` (D4-02), lido por `optionalEnv`.
`sanitizarErro()` é **importada** de `apps/api/src/persistencia/outbox-worker.ts`, nunca reescrita — mesma disciplina do analog.

---

### Upload proxy `POST /financeiro/extratos` (file-I/O) — crm-n1, dentro de `rotas/financeiro.ts`

**Analog do lado que RECEBE hoje:** `automation/src/http/bank-statement-webhooks.ts` (lido integralmente, 70 linhas):
```typescript
import { raw } from "express";
const UPLOAD_LIMIT = optionalEnv("EXTRATO_UPLOAD_LIMIT", "25mb");
const rawBody = raw({ type: "*/*", limit: UPLOAD_LIMIT });
router.post("/webhook/receber-whatsapp-doc/:origem", rawBody, handleUpload);
```
Headers que o proxy do `apps/api` precisa preservar/repassar: `X-File-Name`, `X-Source` (ou equivalente), `Content-Type` do arquivo original. `:origem` é allowlist fixa das 7 origens conhecidas (nubank, itau_unibanco, btg_pactual, btg_cartao, nubank_violeta, personallite_black, azul_infinity) — D4-13 avisa que a origem do proxy do `apps/api` precisa entrar em `MP_RECEBIMENTO_SOURCE` ou o upload é recusado em produção.
**Sem analog no lado Fastify** — `apps/api` nunca recebeu upload de arquivo binário antes desta fase; nenhuma rota Fastify existente faz `multipart`/raw body hoje (não localizado nesta busca). Tratar como formato novo: validar MIME e tamanho no Fastify ANTES de repassar (D4-13), então `fetch` com o corpo bruto para o webhook do `automation/` usando o mesmo cliente/token de `cliente-leituras-financeiro.ts` (ou um `PLATAFORMA_LEITURA_TOKEN` companheiro, a decidir no plano).

---

### As 8 telas em `apps/web/src/app/(shell)/financeiro/*` + `apps/web/src/features/financeiro/dados/*`

**Analog de fetch (o mais forte da fase):** `apps/web/src/dados/estado-inicial.ts` (69 linhas, lido integralmente):
```typescript
import "server-only";
import { cache } from "react";
import { clienteDoServidor } from "@/autenticacao/cliente-servidor";

export type EstadoInicial =
  | { readonly tipo: "ok"; readonly estado: EstadoDoServidor }
  | { readonly tipo: "semSessao" }
  | { readonly tipo: "semAcesso"; readonly motivo: string }
  | { readonly tipo: "indisponivel"; readonly erro: string };

export const carregarEstadoInicial = cache(async (): Promise<EstadoInicial> => {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { tipo: "semSessao" };
  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/estado`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch (erro) {
    return { tipo: "indisponivel", erro: erro instanceof Error ? erro.message : "Sem conexão com o servidor." };
  }
  if (resposta.status === 401) return { tipo: "semSessao" };
  if (resposta.status === 403) return { tipo: "semAcesso", motivo: (await corpoDeErro(resposta)) ?? "Sem acesso." };
  if (!resposta.ok) return { tipo: "indisponivel", erro: (await corpoDeErro(resposta)) ?? `O servidor respondeu ${resposta.status}.` };
  // ...
});
```
Cada `apps/web/src/features/financeiro/dados/<leitura>.ts` repete exatamente esta forma trocando o path (`/financeiro/dashboard`, `/financeiro/notas-fiscais`, etc.) — os mesmos 3 estados de erro cobrem exatamente o que D4-15 pede ("o backend financeiro não respondeu" nunca é lista vazia).

**Analog de composição visual — ressalva importante:** `apps/web/src/features/estrutura/financeiro/contas-view.tsx` (1090 linhas; lidas linhas 1-90) é uma LENTE sobre `useData`/`useRun`/`useSession` (o store zustand do domínio) — filtra/agrupa Tarefas já hidratadas em memória. As 8 telas novas **não devem imitar essa dependência de store**: D4-15/RESEARCH.md são explícitos que as leituras do Financeiro NÃO entram no `DataState`. Usar `contas-view.tsx` só como referência de **composição visual** (indicadores clicáveis, `BarraDeFiltros`, tabela agrupada, `ActionMenu`/`Chip`/`Pilula` de `@/features/shell/ui.tsx`), nunca de fonte de dado.

**Componentes de design a reusar (import direto, sem CSS novo):**
```typescript
import {
  ActionMenu, ActorAvatar, Button, Chip, ConfirmDialog, Divisor, EmptyState, Icone, Pilula, Select,
} from "@/features/shell/ui";
```
Mais `apps/web/src/features/shell/record-list.tsx` (100 linhas) para o miolo de lista/tabela — não lido byte a byte nesta sessão, mas confirmado como o componente de listagem genérico do shell (importar e verificar a API exata na hora do plano, sem re-especular aqui).

---

### Nav registration `/financeiro` — crm-n1

**Correção sobre a leitura do CONTEXT.md/RESEARCH.md:** o arquivo `apps/web/src/features/shell/navegacao.ts` **NÃO é** a lista de itens de navegação — é o store de "está navegando" (`useNavegar`, `marcarSeMuda`, barra de progresso). A lista real de seções/telas do shell vive em **`apps/web/src/features/shell/app-shell.tsx`**, no array `ASSUNTOS` (linhas 115-174, lido integralmente):
```typescript
const ASSUNTOS: ReadonlyArray<Assunto> = [
  { chave: "trabalho", rotulo: "Trabalho", icone: Home, comArvore: true, telas: [ /* ... */ ] },
  { chave: "crm", rotulo: "CRM", icone: Contact, comMeusNegocios: true, telas: [ /* ... */ ] },
  // ...
  { chave: "paineis", rotulo: "Painéis", icone: LayoutDashboard, telas: [{ href: "/paineis", rotulo: "Painéis", icone: LayoutDashboard, prefixo: true }] },
];

function assuntoDe(pathname: string): Assunto {
  if (pathname.startsWith("/crm")) return ASSUNTOS[1]!;
  // ...
  return ASSUNTOS[0]!;
}
```
Novo assunto `financeiro` (D4-08, não debaixo de `ferramentas/`): entrada própria em `ASSUNTOS` com `chave: "financeiro"`, `telas` apontando para as 8 sub-rotas, e um novo `if (pathname.startsWith("/financeiro")) return ASSUNTOS[N]!;` em `assuntoDe`. **O planner deve corrigir esta referência** — não editar `navegacao.ts` esperando encontrar a lista de seções lá.

`apps/web/src/features/shell/rotas.ts` (`formaDe`, `chaveDeChegada`) precisa reconhecer os 8 pathnames novos — hoje cai no padrão `"tabela"` por default (linha 26, `return "tabela";`), que já é a forma certa para 7 das 8 telas (Dashboard talvez precise de forma própria, a decidir no plano). `rotas.test.ts` (36 linhas, lido integralmente) mostra a forma exata de estender os testes:
```typescript
expect(formaDe("/ferramentas/grupos")).toBe("tabela");
```

---

### Derived reachability check (D4-14) — crm-n1, `packages/dominio`

**Não é um arquivo novo no domínio** — RESEARCH.md e CONTEXT.md são explícitos: esta fase não deveria tocar `packages/dominio`. `memberReachesContainer` já existe (`packages/dominio/src/derive.ts:910`) e `CP.folderId` já existe (`packages/dominio/src/operations/financeiro.ts`, usado por 03-05/PAG-06).

**Analog de uso real (chamado pela rota, não reescrito):**
```typescript
// packages/dominio/src/derive.ts:910
export function memberReachesContainer(state: DataState, memberId: Id, type: PathNode["type"], id: Id): boolean { /* ... */ }
```

**Analog de teste (a forma que a rota nova precisa reproduzir do lado `apps/api`, não do domínio):** `packages/dominio/src/operations/contas-a-receber.test.ts` (linhas 8, 43-44):
```typescript
import { containerAdminRefusal, effectiveListConfig, memberReachesContainer, memberSeesTask } from "../derive";
// ...
expect(memberReachesContainer(state, CP.aprovadorId, "list", CR.listId)).toBe(true);
expect(memberReachesContainer(state, CR.comercialId, "list", CR.listId)).toBe(false);
```
Um caso prova alcance, o outro prova recusa nomeando o motivo — mesma forma a replicar em `apps/api/src/rotas/financeiro.test.ts` (200 para quem alcança, 403 para quem não).

---

## Shared Patterns

### Auth Bearer em tempo constante (superfícies novas do `automation/`)
**Source:** `financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` linhas 1-120
**Apply to:** todo arquivo sob `/v1/leituras/*`
Recriar `digestoConstante`/`credenciaisIguais`/`extrairBearer` — nunca importar do contrato v1, nunca comparação `===` ingênua.

### Cliente HTTP `apps/api` → `automation/`
**Source:** `apps/api/src/automacoes/invocar-agente.ts` + `sanitizarErro()` de `apps/api/src/persistencia/outbox-worker.ts`
**Apply to:** `cliente-leituras-financeiro.ts` e o proxy de upload
`AbortSignal.timeout`, `STATUS_PERMANENTES = [400,401,403,404,422]`, `x-request-id: randomUUID()`, log saneado.

### Fetch fora do zustand store, com os 3 estados de erro
**Source:** `apps/web/src/dados/estado-inicial.ts`
**Apply to:** todo `apps/web/src/features/financeiro/dados/*`
`semSessao` (401) / `semAcesso` (403, motivo do corpo) / `indisponivel` (rede ou não-ok) — nunca lista vazia fingindo ausência de dado (D4-15).

### Autorização por alcance derivado
**Source:** `packages/dominio/src/derive.ts` (`memberReachesContainer`) + `packages/dominio/src/operations/financeiro.ts` (`CP.folderId`)
**Apply to:** toda rota `GET /financeiro/*` em `apps/api`
Nenhuma Concessão nova, nenhuma tabela de permissão — hidratar o Espaço, checar alcance, 403 sem alcance.

### Registro de rota na raiz (não no plugin de serviço)
**Source:** `apps/api/src/rotas/estado.ts` (correto) vs. `apps/api/src/rotas/integracao-solicitacoes.ts` (prefixo de serviço — NÃO copiar essa parte)
**Apply to:** `apps/api/src/rotas/financeiro.ts`
`app.register(rotasDeFinanceiro)` fora de `{ prefix: PREFIXO_ROTAS_DE_SERVICO }` — herda JWT de Membro, nunca credencial de serviço.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `automation/src/http/leituras-plataforma-dtos.ts` (projeção de SAÍDA/allowlist) | transform | transform | Nenhuma rota do `automation/` hoje declara allowlist de saída explícita — `GET /financeiro/solicitacoes` faz o oposto (repassa a linha inteira, o problema que D4-05 corrige). Único precedente parcial de forma (não de conteúdo): `apps/api/src/servicos/dto-solicitacao.ts` (`paraDtoV1`), em outro repositório e outro sentido de fluxo. |
| `/v1/leituras/notas-fiscais` e `/v1/leituras/produtos` (rotas E consulta ao `public.transacoes`/`produtos_cadastrados_emissao_notas`) | route | request-response | Confirmado pelo RESEARCH.md (Pitfall 2): nenhum endpoint HTTP toca essas duas tabelas hoje — front lê via `anon` direto. É a única rota nova de verdade entre as 8 (não wrapper); usar Pattern 1 (auth) mas desenhar a consulta e a paginação do zero. |
| Upload proxy Fastify (`POST /financeiro/extratos` do lado que ENVIA, em `apps/api`) | route | file-I/O | Nenhuma rota Fastify existente em `apps/api` recebe arquivo binário hoje (não localizada nesta busca) — o único precedente é do lado que RECEBE, no `automation/` (`bank-statement-webhooks.ts`), em outro framework. |
| Fixture compartilhada de `solicitacoes_pagamentos`/`transacoes` (sem dado real) | test fixture | transform | Nenhuma fixture equivalente localizada em nenhum dos dois repositórios — a criar do zero, usando as colunas exatas do inventário do RESEARCH.md como forma. |

---

## Metadata

**Analog search scope:** `financeiro-tria/automation/src/{http,tenants/tria}`, `apps/api/src/{rotas,automacoes}`, `apps/web/src/{dados,features/shell,features/estrutura/financeiro}`, `packages/dominio/src/{derive.ts,operations}`
**Files read integrally or in targeted ranges:** `contas-a-pagar-routes.ts` (1-120), `bank-statement-webhooks.ts` (integral), `payment-rules.ts`/`payment-rules.test.ts` (trechos), `solicitacoesPagamentos.ts` (95-160), `invocar-agente.ts` (1-100), `estado.ts` (integral), `integracao-solicitacoes.ts` (1-60), `estado-inicial.ts` (integral), `app-shell.tsx` (90-189), `rotas.ts`/`rotas.test.ts` (integral), `navegacao.ts` (integral — descartado como analog, ver nota), `contas-view.tsx` (1-90)
**Pattern extraction date:** 2026-09-23
