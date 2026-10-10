# Phase 7: CRM: Contatos, Empresas, Funis e Negócios (backend e frontend) - Research

**Researched:** 2026-10-09
**Domain:** CRUD relacional em três camadas (`@n1/dominio` → `apps/api` Fastify/pg → `apps/web` Next 16 client) sobre `apps/api/migracoes/007-crm.sql`
**Confidence:** HIGH (código e SQL lidos e provados em Postgres 16 descartável); MEDIUM nas escolhas de desenho que são do Claude's Discretion

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modelo de domínio × 007**
- **D-01:** Criar tipos novos em português (Contato, Empresa, Funil, Etapa, Negócio, Identificadores, vínculo Contato-Empresa) num módulo novo de `@n1/dominio`, espelhando a 007, com regras puras. Os tipos em inglês (`Contact`, `Company`, `Deal`, `Pipeline`…) e o seed continuam vivos ao lado, porque Caixa de Entrada/Conversas ainda dependem deles; serão aposentados em fase futura. — **Reversibility:** costly — dois modelos coexistem; a unificação depois toca a web, o seed e as ~40 operações de CRM.
- **D-02:** O que o modelo antigo tem e a 007 não (tags, consentimentos, comentários, anexos, mesclagem/estado `mesclado`, temperatura, histórico de etapas) fica fora do CRUD desta fase. As telas ocultam ou desabilitam esses blocos; voltam em fase própria, com migração própria.

**Contrato HTTP**
- **D-03:** Rotas REST por recurso em `apps/api` (`/contatos`, `/empresas`, `/funis`, `/negocios`: GET/POST/PATCH/DELETE), com esquemas validados e regras importadas de `@n1/dominio`. Não passa por `POST /operacoes/:nome` nem pelo estado hidratado de `GET /estado`.

**Telas**
- **D-04:** Religar as telas existentes (`apps/web/src/app/(shell)/crm/{contatos,empresas,negocios,funis}` e `features/crm/*`) à api, trocando a fonte de dados do store em memória por HTTP, e completar o que falta (editar, excluir, restaurar, formulários). Mesmas rotas e layout.
- **D-05:** O quadro de Negócios (kanban) entra: mover de Etapa, ganhar, perder e reabrir são rotas da api, aplicando `exige_motivo_perda` / `exige_valor_ganho` do Funil.

**Excluir, arquivar e integridade**
- **D-06:** "Excluir" na interface manda para `na_lixeira`, com ações de restaurar e de excluir permanentemente; arquivar é ação separada (estados `ativo`/`arquivado`/`na_lixeira` da 007).
- **D-07:** Excluir Funil ou Etapa que ainda tem Negócios é recusado (409 com a contagem de Negócios que bloqueiam). `migrate-funnel-dialog` e `remove-stage-dialog` são o caminho para o usuário resolver antes.
- **D-08:** Criar Empresa exige o Contato admin no mesmo formulário/transação (a 007 tem constraint trigger deferido). Excluir Empresa encerra os vínculos vigentes (`fim` preenchido) e preserva os Contatos. Trocar o último admin exige indicar o novo.
- **D-09:** Excluir Contato que é o último admin de uma Empresa ou vínculo de um Negócio é recusado (409 listando Empresas/Negócios afetados); o usuário nomeia outro admin ou troca o Contato do Negócio e tenta de novo.

**Acesso e Proprietário**
- **D-10:** Backend aplica isolamento por Espaço de Trabalho (Membro resolvido pelo JWT) mais permissão do Papel sobre o recurso CRM para criar/editar/excluir, reaproveitando o mecanismo de permissão do domínio. Escopo `próprios` (vendedor vê só seus Negócios) e visibilidade de Funil privado ficam para fase futura; `privado` é só gravado.
- **D-11:** Proprietário de Contato/Empresa/Negócio padrão = Membro que cria (também `criado_por`), editável no formulário para outro Membro ativo.

### Claude's Discretion
- Estrutura interna dos repositórios, nomes de módulo e de esquemas, paginação/filtros das listagens, formato exato dos erros 409, normalização de Identificadores (e-mail, telefone, domínio, documento) conforme os comentários da 007.

### Deferred Ideas (OUT OF SCOPE)
- Escopo de acesso `próprios` e visibilidade de Funil privado
- Tags, comentários, anexos, consentimentos, mesclagem de Contatos/Empresas, temperatura e histórico de etapas (exigem migração própria)
- Catálogos do Espaço de Trabalho (Origem, Qualificação, Motivo de Perda)
- Aposentar o modelo antigo em inglês (`Contact`/`Deal`/…) e o seed de CRM
- Caixa de Entrada, Conversas e Mensagens
</user_constraints>

<phase_requirements>
## Phase Requirements

O ROADMAP marca `Requirements: TBD` e nenhum ID está mapeado. Os critérios abaixo são **derivados** do goal e das decisões D-01..D-11 (não existem em `REQUIREMENTS.md`; o planner deve registrá-los lá ou usá-los como `must_haves`).

| ID (derivado) | Descrição | Research Support |
|----|-----------|------------------|
| CRM-D1 | Tipos, normalizadores e regras puras de Contato/Empresa/Funil/Etapa/Negócio em `@n1/dominio` (módulo novo, subcaminho `@n1/dominio/crm`) | Seções Standard Stack, Pattern 1, Don't Hand-Roll |
| CRM-A1 | Repositórios + serviços + rotas REST (`/contatos`, `/empresas`, `/funis`, `/negocios`) com isolamento por `workspace_id` e permissão por Papel | Patterns 2-4, Security Domain |
| CRM-A2 | Integridade: 409 com contagens/listas (D-07, D-09), admin da Empresa (D-08), unicidade de Identificador | Pitfalls 1-3, 6; Code Examples |
| CRM-A3 | Ações de Negócio: mover, ganhar, perder, reabrir, arquivar, restaurar, lixeira, excluir permanentemente (D-05, D-06) | Pattern 4 |
| CRM-W1 | Telas de Contatos, Empresas, Funis (+Etapas) e Negócios (lista, ficha, formulário criar/editar, lixeira/restaurar) lendo/gravando só por HTTP | Pattern 5, Pitfalls 8-10 |
| CRM-W2 | Quadro de Negócios (kanban em `/crm/negocios`) com mover/ganhar/perder/reabrir por REST | Pitfall 9 |
| CRM-V1 | `npm run check` verde; testes de domínio, de rota (`app.inject`) e de repositório contra Postgres | Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Fonte: `/Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/CLAUDE.md` (inclui `CONTEXT.md` e `AGENTS.md` da raiz) e `CONTEXT.md` de `apps/api`, `apps/web`, `packages/dominio`.

- **Regra de dependência (inegociável):** `packages/dominio` não importa de ninguém; `apps/web` e `apps/api` importam só `@n1/dominio` e **nunca um ao outro**. Seta de `web` para `api` (ou de `dominio` para qualquer um) é erro de arquitetura. [VERIFIED: CONTEXT.md raiz, "A regra de dependência"]
- **Onde a mudança nasce:** "o que a coisa é" → `packages/dominio/`; "como aparece" → `apps/web/`; "como se guarda ou se serve" → `apps/api/`. Quando for "as três", começar pelo domínio e descer. [VERIFIED: CONTEXT.md raiz]
- **Next.js 16.3.4 tem breaking changes** — ler `node_modules/next/dist/docs/` antes de codar. Feito nesta pesquisa (ver Pitfall 10). [VERIFIED: `AGENTS.md`; `node_modules/next/package.json` → `"version": "16.3.4"`]
- **`apps/api`:** direção `rotas → servicos → repositorios`; rota não tem regra nem SQL; `src/repositorios/` "nasce vazia" e esta fase inaugura o padrão (uma interface por agregado, implementação atrás). [VERIFIED: `apps/api/CONTEXT.md`, `apps/api/src/repositorios/CONTEXT.md`]
- **Erros em pt-BR**, frases para o usuário, não códigos; `OperationResult`/`fail(error, field?)` é o idioma do domínio. [VERIFIED: `.planning/codebase/CONVENTIONS.md`; `packages/dominio/src/state.ts:128-133`]
- **TS estrito** (`strict`, `noUncheckedIndexedAccess`): todo acesso a array/objeto indexado é guardado. [CITED: `.planning/codebase/CONVENTIONS.md`]
- **Web:** cor só via `src/estilos/tokens.css` (`npm run verificar:tokens` barra hex cru); alias único `@/*`; testes de componente declaram `// @vitest-environment jsdom` na 1ª linha. [VERIFIED: `apps/web/CONTEXT.md`, `apps/web/vitest.config.mts`]
- **Testes do api rodam em série** (`fileParallelism: false`) porque falam com Postgres real pelo pooler do Supabase. [VERIFIED: `apps/api/vitest.config.mts`]
- Nenhum `.claude/skills/` nem `.agents/skills/` existe no repo. [VERIFIED: `ls`]

## Summary

A Fase 7 é um CRUD de quatro agregados (Contato, Empresa, Funil+Etapas, Negócio) sobre tabelas relacionais próprias que já existem no arquivo `007-crm.sql` (untracked). O desenho está bem determinado pelas decisões D-01..D-11: o domínio ganha um módulo **novo e separado** (`@n1/dominio/crm`) com tipos em português e regras puras; o `apps/api` ganha o primeiro **repositório de verdade** (SQL parametrizado sobre `pg`, transação por caso de uso) e rotas REST por recurso com zod; o `apps/web` troca a fonte de dados das telas `/crm/{contatos,empresas,funis,negocios}` de `useData(state)` para HTTP.

Quatro achados mudam o plano e **precisam ser tratados cedo**: (1) o CORS do `apps/api` só libera `GET, POST` — PATCH/DELETE (D-03) falham no preflight do navegador; (2) o constraint trigger de admin da Empresa na 007 **impede** o que D-08 manda (enviar a Empresa à lixeira encerrando os vínculos) — provado em Postgres 16; (3) o driver `pg` devolve colunas `date` como `Date` com deslocamento de fuso (`1990-05-17` vira `…T03:00:00.000Z`), corrompendo `data_nascimento`/`data_prevista_fechamento`/`inicio`/`fim`; (4) `features/estrutura/quadro-negocios.tsx`, citado no CONTEXT como "kanban de Negócios", na verdade é o quadro das **Listas conversacionais** (Tarefas-espelho) — o kanban real de Negócios está embutido em `app/(shell)/crm/negocios/page.tsx`.

A "religação" das telas é, na prática, uma **reescrita das camadas de dados** delas: as telas e `features/crm/*` leem o modelo antigo (`state.contacts`, `Deal.stageId`, `Stage.defaultProbability`, `lifecycle: "naLixeira"`…), cujos nomes e formas diferem da 007 (`estado: "na_lixeira"`, `etapa_id`, `probabilidade_padrao`). O layout e os primitivos (`PageHeader`, `RecordList`, `ColunaDeQuadro`, `Button`, `Field`…) são reaproveitados; os componentes de ficha pesados (`deal-screen.tsx` 968 linhas, `contact-card.tsx` 533, páginas de ficha de Contato 537 / Empresa 542) estão acoplados a Conversa/Tag/Consentimento/Requisitos e devem ser **refeitos enxutos** sobre o modelo novo, não adaptados.

**Primary recommendation:** Execute em ondas domínio → api → web. Antes de qualquer código de Empresa, resolva o conflito trigger×lixeira (migração `008` ou edição da 007 se ainda não foi aplicada — ver Open Question 1) e abra o CORS para `PATCH`/`DELETE`. Use `swr@2.5.1` como único acréscimo de dependência (web), um cliente HTTP fino em `apps/web/src/dados/`, e mantenha o store zustand antigo intocado para tudo que não é CRUD.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tipos, enums e normalização de Identificadores (e-mail, telefone, domínio, documento) | Domínio (`@n1/dominio/crm`) | — | "O que a coisa é"; a mesma regra precisa valer na tela (validação de formulário) e no endpoint |
| Regras de negócio (INV-CON-01, nome da Empresa, Funil padrão, encerramento ganhar/perder, matriz sem ciclo) | Domínio | API (aplica), Web (pré-valida) | Funções puras `(entrada, contexto) → resultado`; nenhuma toca banco |
| Matriz de permissão por Papel sobre recursos CRM (D-10) | Domínio (função pura `podeNoCrm`) | API (carrega Membro+Papel e aplica) | O domínio já decide por `Role.base` (ver `mayWriteDeal`); API só fornece os dados |
| Persistência, unicidade, FKs compostas, trigger de admin | Banco (007) | API/repositórios | Integridade que o banco garante sozinho; API traduz SQLSTATE → 409 |
| Isolamento por Espaço de Trabalho | API (`request.membro.workspaceId` em todo `WHERE`) | Banco (FKs compostas `(workspace_id, id)`) | O `workspaceId` nunca vem do cliente |
| Transações/casos de uso (criar Empresa+admin, migrar Negócios, remapear Etapa) | API (`servicos/`) | Repositórios | "A transação começa e termina aqui" |
| Contrato HTTP/validação de forma | API (`rotas/` + zod) | — | Esquemas de transporte; regras vêm do domínio |
| Cache de leitura, revalidação, invalidação após mutação | Web (SWR) | — | Substitui "hidratar tudo" só para o CRM |
| Telas, formulários, kanban, diálogos | Web | — | "Como aparece" |
| Lista de Membros ativos para o seletor de Proprietário | Web (store antigo, `state.members`) | API valida | Membros continuam em `plataforma.registros`; API revalida `ativo` no servidor |

## Standard Stack

### Core (já no repositório — nenhuma instalação)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.12.5 (instalado 5.12.5) | HTTP | Já é o transporte do `apps/api` [VERIFIED: `apps/api/package.json`; probe `fastify 5.12.5`] |
| @fastify/type-provider-zod | ^1.0.0 | Validação/serialização por zod nas rotas | Padrão de `rotas/operacoes.ts` (`app.withTypeProvider<ZodTypeProvider>()`) [VERIFIED: `apps/api/src/rotas/operacoes.ts`] |
| zod | ^4.6.5 (api) / ^4.6.1 (dominio, web) | Esquemas de transporte | Já usado; `.strict()` em objetos [VERIFIED: `apps/api/src/rotas/esquemas/CONTEXT.md` regra 2] |
| pg | ^8.23.0 | Postgres | `pool()` singleton em `persistencia/conexao.ts` [VERIFIED: `apps/api/src/persistencia/conexao.ts`] |
| @fastify/cors | ^11.3.0 (instalado 11.3.0) | CORS | **Precisa liberar PATCH/DELETE** (Pitfall 1) |
| vitest | ^5.0.0 | Testes nos 3 workspaces | [VERIFIED: package.json dos 3 workspaces] |
| next / react | 16.3.4 / 19.2.8 | Web | [VERIFIED: `apps/web/package.json`] |

### Supporting (novo)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| swr | 2.5.1 (publicado 2026-08-12) | Cache de cliente, revalidação em foco, `mutate` após escrita | Todas as telas de CRM em Client Components. Citado na doc oficial do Next 16 instalada: `node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/swr.md`. Peer `react ^16.11 … ^19`, deps `dequal`, `use-sync-external-store`, sem `postinstall` [VERIFIED: `npm view swr`; `gsd-tools package-legitimacy check` → `OK`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| swr | `@tanstack/react-query` 5.104.1 | O verificador de legitimidade devolveu `SUS` só por `too-new` (versão publicada em 2026-10-02; 66.9M downloads/semana, repo oficial) — falso positivo, mas exigiria `checkpoint:human-verify` sem ganho aqui. Também citado na doc do Next. Não usar. |
| swr | `fetch` + `useEffect` à mão | Sem dedupe/revalidação/invalidação; o app tem ≥8 telas lendo as mesmas listas. Contraria "Don't Hand-Roll". |
| SWR | `use(promise)` com Server Component | A doc do Next admite para leitura única; aqui há mutações e revalidação frequente → biblioteca de cache. |

**Installation:**
```bash
npm install swr@2.5.1 -w @n1/web
```

**Version verification:** `npm view swr version` → `2.5.1`; `npm view @tanstack/react-query version` → `5.104.1` (data da consulta 2026-10-09). [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| swr | npm | publicado 2026-08-12 (projeto antigo, Vercel) | 18.6M/sem | github.com/vercel/swr | OK | Approved |
| @tanstack/react-query | npm | última versão 2026-10-02 | 66.9M/sem | github.com/TanStack/query | SUS (`too-new`) | Não usado (alternativa descartada; se o planner preferir, inserir `checkpoint:human-verify`) |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** `@tanstack/react-query` — não recomendado nesta fase; se escolhido, o planner insere `checkpoint:human-verify` antes do install.
`swr` foi descoberto na doc oficial do Next instalada em `node_modules` (fonte autêntica) e retornou `OK` no seam — tag `[VERIFIED: npm registry]` legítima. `postinstall` ausente (`"postinstall": null`). Nenhum pacote novo em `apps/api` nem `packages/dominio`.

## Architecture Patterns

### System Architecture Diagram

```
 Browser (Client Components, SWR cache)
   │  fetch + Authorization: Bearer <access_token do Supabase (clienteDoNavegador().auth.getSession())>
   │  (NEXT_PUBLIC_API_URL; nunca importa de apps/api)
   ▼
 apps/api (Fastify 5)
   ├─ CORS delegator  ── methods hoje ["GET","POST"]  ──► PRECISA incluir PATCH, DELETE
   ├─ hook onRequest autenticacao.ts: verifica JWT → resolverMembro(workspaceId, sub) → request.membro {id, workspaceId, state}
   ├─ rotas/crm/*.ts  (zod .strict(); traduz HTTP ↔ serviço; mapeia erro → 400/403/404/409)
   │       │  ErroDeNegocio / resultado do domínio
   ├─ servicos/crm/*.ts  (casos de uso; abre transação; chama regras puras de @n1/dominio/crm;
   │       │               carrega Membro+Papel → podeNoCrm(); valida Proprietário ativo)
   ├─ repositorios/crm/*.ts  (interface por agregado + implementação pg; SQL parametrizado;
   │       │                  TODO WHERE leva workspace_id = $1; datas ::text; numeric → string)
   ▼
 Postgres (schema plataforma): contatos, contato_identificadores, empresas, empresa_identificadores,
   contato_empresa, funis, etapas, negocios  (+ plataforma.registros p/ Membro e Papel — leitura)
   └─ 23505/23503/23514 → serviço traduz para 409 com contagens/listas

 @n1/dominio/crm  ◄── importado por rotas/serviços (api) E por formulários/validação (web)
```

### Recommended Project Structure
```
packages/dominio/src/
├── crm.ts                    # barril do módulo novo → import "@n1/dominio/crm" (exports "./*" → ./src/*.ts)
├── crm-tipos.ts              # Contato, Empresa, Funil, Etapa, Negocio, Identificadores, Vinculo… (pt-BR, espelha a 007)
├── crm-normalizacao.ts       # normalizarEmail/Telefone/Dominio/Documento
├── crm-regras.ts             # validarContato, validarEmpresa, validarFunil, validarEncerramento…
├── crm-permissoes.ts         # podeNoCrm(baseDoPapel, estadoDoMembro, acao, recurso)
└── crm*.test.ts
apps/api/src/
├── repositorios/crm/         # contatos.ts, empresas.ts, funis.ts, negocios.ts (+ interfaces), membros-e-papeis.ts
├── servicos/crm/             # contatos.ts, empresas.ts, funis.ts, negocios.ts (transações e 409)
├── rotas/crm/                # contatos.ts, empresas.ts, funis.ts, negocios.ts
└── rotas/esquemas/crm.ts     # zod de transporte (params/query/body) — só forma, regra vem do domínio
apps/web/src/
├── dados/crm/                # cliente-crm.ts (fetch+token), swr-provider.tsx, hooks use-contatos.ts…
├── features/crm/             # componentes novos sobre o modelo 007 (nomes pt-BR); os antigos convivem
└── app/(shell)/crm/{contatos,empresas,funis,negocios}/…  # páginas religadas
```

### Pattern 1: Módulo novo do domínio, fora do barril principal
**What:** um arquivo/família `crm*.ts` exposto como `@n1/dominio/crm`, **sem** reexportar em `src/index.ts`. O `package.json` do domínio tem `"./*": "./src/*.ts"` — uma pasta `src/crm/index.ts` **não** resolve; use arquivo `src/crm.ts`. [VERIFIED: `packages/dominio/package.json` exports: `".": "./src/index.ts"`, `"./*": "./src/*.ts"`]
**Why:** `src/index.ts` faz `export * from "./types"` etc.; nomes novos em português não colidem hoje (grep `Contato|Etapa|Funil|Empresa|Negocio` em `src/types` e `state.ts` não achou declaração), mas o barril já exporta `Address`, `Money`, `ContactIdentifier`; manter o módulo novo fora do barril evita colisão futura e deixa claro que o modelo antigo convive (D-01).
**Forma recomendada (espelha a 007, `snake_case` do banco → `camelCase` no tipo):**
```typescript
// Fonte dos valores: apps/api/migracoes/007-crm.sql linhas 69-71, 110, 177, 404-405
export type EstadoCrm = "ativo" | "arquivado" | "na_lixeira";
export type ModoDeCriacao = "manual" | "importacao" | "automatico_mensagem" | "automatico_automacao";
export type TipoIdentificadorContato = "telefone" | "email" | "whatsapp" | "instagram";
export type TipoIdentificadorEmpresa = "dominio" | "documento_fiscal" | "telefone";
export type SituacaoNegocio = "aberto" | "ganho" | "perdido";
```
Valores acima são **citação verbatim** da 007 (ver "Valores discretos" abaixo).

### Pattern 2: Repositório = interface + implementação pg + fake em memória
**What:** `interface RepositorioDeFunis { … }` em `repositorios/crm/funis.ts` com `criarRepositorioDeFunisPg(cliente: Queryable)`; o serviço recebe o repositório por parâmetro. Rotas testáveis com `app.inject()` e fake em memória (sem `DATABASE_URL`, igual a `autenticacao.test.ts`), e o repositório pg é testado contra Postgres de verdade.
**Transação:** `const c = await pool().connect(); try { await c.query("begin"); …; await c.query("commit") } catch { await c.query("rollback"); throw } finally { c.release() }`. (Mesma forma de `migrar.ts`.) Os repositórios recebem o `PoolClient`/`Pool` — assim um caso de uso compõe vários repositórios na mesma transação (criar Empresa + vínculo admin; migrar Negócios).
**Não usar** `persistencia/unidade-de-trabalho.ts::executar`: ela hidrata o `DataState` inteiro de `plataforma.registros` com revisão otimista por Espaço — modelo do store antigo, não das tabelas da 007. [VERIFIED: cabeçalho de `unidade-de-trabalho.ts`]

### Pattern 3: Permissão por Papel reaproveitando o mecanismo do domínio (D-10)
**O que existe:** as operações de CRM do domínio decidem por **`Role.base`** + estado do Membro, em funções privadas; não há `can()` genérico exportado.
```typescript
// packages/dominio/src/operations/deals.ts:31-38
function mayWriteDeal(state: DataState, actingMemberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === actingMemberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo altera Negócio.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") {
    return "Um Convidado não altera Negócio: ele alcança só o que foi compartilhado com ele.";
  }
  return undefined;
}
```
`Role.permissions` (action/resourceType/scope) existe, mas só é lido em `derive.ts:947` (`comentar` em `task`); os Papéis de sistema do seed têm `permissions: []`. [VERIFIED: `packages/dominio/src/seed.ts:123-126`, `derive.ts:947`]
**Recomendação:** novo `podeNoCrm(base: SystemRole, estadoDoMembro: MemberState, acao, recurso): string | undefined` (retorna a frase de recusa, mesmo idioma de `mayWriteDeal`) em `crm-permissoes.ts`:
- `Membro` não `ativo` → recusa (todas as escritas); `suspenso` pode ler (o hook já deixa passar).
- `convidado` → só leitura (recusa criar/editar/excluir).
- `membro` → criar/editar/excluir/arquivar/restaurar Contato, Empresa, Negócio; ganhar/perder/mover.
- **Funil e Etapa (criar, excluir, definir padrão): somente `administrador`/`proprietario`** — RN-FUN-17 (`ontologia/03-crm/funis.md:290`). Editar Etapas de Funil existente: mesma restrição nesta fase (o conceito `administrar` por-Funil é Deferred).
- Reabrir Negócio `ganho`: somente `administrador`/`proprietario` (RN-NEG-10, `negocios.md:365`).
**Como a API obtém Papel:** `request.membro` é `{ id, workspaceId, state }` (`plugins/autenticacao.ts:25-29`) e o teste `autenticacao.test.ts:96` faz `toEqual({ id: "mem_maryane", workspaceId: "ws_teste", state: "ativo" })` — **acrescentar `roleId` ao decorator quebraria esse teste**. Prefira um repositório `membros-e-papeis.ts` com uma consulta: `select m.dados->>'state', r.dados->>'base' from plataforma.registros m join plataforma.registros r on r.workspace_id = m.workspace_id and r.colecao = 'roles' and r.id = m.dados->>'roleId' where m.workspace_id = $1 and m.colecao = 'members' and m.id = $2` (colunas `workspace_id, colecao, id, dados` — `001-plataforma.sql`; `colecao='members'` e `dados->>'userId'` — `persistencia/membros.ts`). [VERIFIED: leitura dos dois arquivos; o join é ASSUMED até ser testado — A2]. Se o planner preferir estender `MembroDaSessao`, deve atualizar `autenticacao.test.ts:96` no mesmo commit.
**Proprietário (D-11):** validar no servidor que `proprietario_id` é Membro `ativo` do mesmo Espaço (RN-CON-03/INV-ET-03; a 007 **não** tem FK de `proprietario_id`/`criado_por` — são `text not null` soltos). Mesma consulta acima.

### Pattern 4: Rotas REST por recurso, erros e 409
Contrato sugerido (Claude's Discretion — o planner pode ajustar nomes, mantendo semântica):

| Verbo + rota | Efeito |
|---|---|
| `GET /contatos?estado=&q=&proprietarioId=&limite=&deslocamento=` | lista paginada `{ itens, total }` (default `estado=ativo`) |
| `GET /contatos/:id` | agregado: Contato + `identificadores[]` + `vinculos[]` (Empresas) |
| `POST /contatos` | cria (+ identificadores iniciais opcionais) — INV-CON-01 |
| `PATCH /contatos/:id` | campos escalares + `proprietarioId` |
| `POST/DELETE /contatos/:id/identificadores[/:identId]`, `PATCH …` (principal/verificado) | sub-recurso |
| `POST /contatos/:id/empresas`, `PATCH /vinculos/:id` (cargo, admin, `fim`) | vínculo Contato-Empresa |
| `DELETE /contatos/:id` | **envia à lixeira** (D-06); 409 se último admin/vínculo de Negócio (D-09) |
| `POST /contatos/:id/arquivar`, `/restaurar`; `DELETE /contatos/:id/permanente` | ciclo de vida; permanente → 409 se FK 23503 |
| `POST /empresas` | corpo exige `admin: { contatoId } \| { novoContato: {…} }`, tudo em **uma transação** (D-08) |
| `GET/PATCH/DELETE /empresas/:id`, `…/identificadores`, `…/contatos` | idem |
| `POST /funis` (≥1 Etapa — RN-FUN-04), `GET/PATCH/DELETE /funis/:id`, `POST /funis/:id/padrao` | |
| `POST /funis/:id/etapas`, `PATCH/DELETE /etapas/:id`, `PUT /funis/:id/etapas/ordem` | reordenar em **1 UPDATE** (Pitfall 7) |
| `POST /funis/:id/migrar-negocios`, `POST /etapas/:id/remapear` | endpoints que `migrate-funnel-dialog`/`remove-stage-dialog` chamam para resolver o 409 (D-07) |
| `GET /negocios?funilId=&situacao=&estado=&empresaId=&contatoId=` | alimenta o kanban |
| `POST /negocios`, `PATCH /negocios/:id`, `POST /negocios/:id/{mover,ganhar,perder,reabrir,arquivar,restaurar}`, `DELETE /negocios/:id` (lixeira), `DELETE /negocios/:id/permanente` | D-05 |

**Envelope de erro (compatível com o existente `{ ok:false, error }`):** `{ ok:false, error: "<frase pt-BR>", codigo?: "FUNIL_COM_NEGOCIOS", bloqueios?: {…} }`. 400 = forma (zod, tratado pelo `setErrorHandler` de `app.ts`); 403 = Papel; 404 = não existe **neste Espaço**; 409 = integridade/regra (com contagens/listas); 422 não é usado no resto do código — manter 409 para regra de negócio recusada e 400 para forma. Regra de domínio recusada **não** vira 200 aqui (diferente de `/operacoes`): D-03 manda REST.
**SQLSTATE → 409** (códigos verificados em Postgres 16, 007 aplicada): `23505` + constraint `contato_identificadores_unico` (Identificador duplicado — devolver o Contato detentor, RN-CON-11), `23503` (`negocios_workspace_id_etapa…_fkey`, `…_funil_id_fkey`, `…_contato_id_fkey` ao excluir), `23514` + constraint `funis_padrao_ck` / `empresa_exige_admin` (a função faz `raise … using errcode='check_violation', constraint='empresa_exige_admin'`). [VERIFIED: execução em container; ver Pitfall 2/3]. **Prefira pré-checar no serviço** (contagens para o 409 de D-07/D-09) e usar o SQLSTATE só como rede de segurança contra corrida.

### Pattern 5: Cliente HTTP único + SWR no web
```typescript
// apps/web/src/dados/crm/cliente-crm.ts  (esboço)
// NUNCA setar content-type em requisição sem corpo (Pitfall 4). Token: mesmo caminho de sessao-provider.tsx.
export async function chamarCrm<T>(caminho: string, init: { method?: string; corpo?: unknown } = {}): Promise<T> {
  const token = (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
  if (!token) throw new ErroDeApi(401, "Sua sessão expirou. Entre de novo.");
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (init.corpo !== undefined) headers["content-type"] = "application/json";
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${caminho}`, {
    method: init.method ?? "GET", headers, ...(init.corpo !== undefined ? { body: JSON.stringify(init.corpo) } : {}),
  });
  if (!r.ok) throw await ErroDeApi.de(r); // carrega status, error, codigo, bloqueios
  return (await r.json()) as T;
}
```
- Hooks `useContatos(filtro)`, `useContato(id)`… = `useSWR(chave, () => chamarCrm(…))`; depois de cada mutação, `mutate((k) => k.startsWith("/contatos"))` (invalidação por prefixo de chave).
- **Um** `<SWRConfig>` no `SessaoProvider` (já é Client Component) ou numa fronteira própria em `(shell)/crm/layout.tsx`.
- Em testes, `vi.stubGlobal("fetch", …)` — exatamente como `transporte.test.ts` faz com `fetchMock`. [VERIFIED: `apps/web/src/dados/transporte.test.ts:18-23`]
- O seletor de Proprietário lê os Membros do store antigo (`useData((d) => d.members)`, `state === "ativo"`) e o Membro da sessão de `useSession().memberId`: os ids são os mesmos de `plataforma.registros`. O servidor revalida.

### Anti-Patterns to Avoid
- **Importar `apps/api` no web, ou `apps/web` no api** — erro de arquitetura (CONTEXT raiz).
- **Passar CRM por `POST /operacoes/:nome` ou pelo `DataState`** — contraria D-03 e quebra o diff/revisão do store.
- **Reusar os tipos ingleses (`Contact`, `Deal`) como DTO** — D-01 manda tipos novos; as formas divergem (Pitfall 8).
- **Aceitar `workspaceId`, `criadoPor` ou `proprietarioId` sem validar do corpo** — workspace só de `request.membro.workspaceId`; `criado_por` = `request.membro.id`.
- **SQL com identificador interpolado** (ordenação/filtro dinâmicos): usar allowlist de colunas; valores sempre `$n`.
- **Mexer em `quadro-negocios.tsx`, `/crm/meus-negocios`, `/crm/caixa-de-entrada`, `/crm/reunioes`** — pertencem ao modelo antigo/Inbox (fora do escopo).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache/revalidação/invalidação de leituras no cliente | `useEffect`+`useState`+pub/sub próprio | `swr` | dedupe, revalidate-on-focus, `mutate` por prefixo; citado na doc do Next 16 |
| Unicidade de Identificador, Funil padrão único, nome único, `ordem` única, Negócio↔Etapa do próprio Funil, Negócio de Empresa XOR Contato, admin da Empresa | Checagem só em código | **Constraints da 007** (já existem) + tradução de SQLSTATE | Corridas só o banco resolve; o serviço pré-checa apenas para produzir a mensagem rica |
| Isolamento entre Espaços | `if (row.workspace_id !== …)` pós-consulta | `WHERE workspace_id = $1` em toda consulta + FKs compostas da 007 | O banco já recusa referência cruzada |
| Atualização de `atualizado_em` | `set atualizado_em = now()` em cada UPDATE | trigger `crm_toque_atualizado_em` da 007 | Já criado nas 4 tabelas com `atualizado_em` |
| UUID de registro | gerador próprio | `default gen_random_uuid()::text` da 007 | IDs gerados no banco; INSERT … RETURNING |
| Validação de forma HTTP | `if (typeof …)` manual | zod via `@fastify/type-provider-zod` | Já é o padrão; erro 400 uniforme no `setErrorHandler` |
| Troca de posição de Etapas | Loop de UPDATEs com `ordem` temporária | **um** `UPDATE … SET ordem = CASE id …` | `etapas_ordem_uq` é `deferrable initially immediate`; provado: swap em 1 statement passa |
| Telefone E.164 completo | regex ad hoc que finge ser completa | normalizador mínimo documentado (A4) ou, se o dono quiser rigor, `libphonenumber-js` (**decisão do dono**: dependência nova no domínio) | Telefone internacional é deceptivamente complexo |

**Key insight:** a 007 já codifica a maior parte da integridade. O trabalho do serviço é (a) pré-checar para dar a mensagem útil de D-07/D-09 e (b) montar a transação certa — não reimplementar a integridade.

## Runtime State Inventory

Fase **não** é de rename/refactor/migração de dados: é aditiva (tabelas e telas novas). Mesmo assim, o modelo antigo convive (D-01); o inventário relevante:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `plataforma.registros` guarda `contacts`, `companies`, `deals`, `funnels` do modelo antigo (jsonb). As tabelas novas da 007 nascem **vazias**; nada migra (D-01/D-02). | Nenhuma migração de dados. Documentar na UI/CONTEXT que existem dois acervos até a fase de aposentadoria |
| Live service config | Nenhum serviço externo referencia as novas rotas. | None |
| OS-registered state | None — verificado: nenhum serviço/worker depende de CRM | None |
| Secrets/env vars | `NEXT_PUBLIC_API_URL`, `WEB_ORIGIN`, `WORKSPACE_ID`, `DATABASE_URL` já existem; nenhuma variável nova. | Nenhuma |
| Build artifacts | `apps/api/migracoes/007-crm.sql` é **untracked**; `npm run migrar` o aplicaria como está. `plataforma.migracoes` guarda o nome do arquivo → renomear/alterar depois de aplicado "faz rodar de novo" ou diverge. | Decidir antes de aplicar (Open Question 1) |
| Modelo antigo × Gestão | `bootstrap-gestao.ts:185` empurra um `funilPadrao` ("Padrão", etapa "Novo") **no modelo antigo**; o Espaço novo não tem Funil na tabela `funis`. | Definir como nasce o primeiro Funil padrão (Open Question 2) |

## Common Pitfalls

### Pitfall 1: CORS bloqueia PATCH e DELETE
**What goes wrong:** o navegador faz preflight `OPTIONS` e recebe `Access-Control-Allow-Methods: GET, POST`; PATCH/DELETE falham como "CORS error", com a API intacta.
**Why:** `app.ts` fixa os métodos, com comentário explicando que as escritas da Fase 4 eram POST:
```typescript
// apps/api/src/app.ts:158-162
  const opcoesDeCors = {
    credentials: false,
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
  };
```
**Prova:** preflight de PATCH contra `@fastify/cors 11.3.0` com essa configuração → status 204 e `access-control-allow-methods= GET, POST`. [VERIFIED: probe executado nesta sessão]
**How to avoid:** `methods: ["GET", "POST", "PATCH", "DELETE"]`; acrescentar teste em `app.test.ts` (preflight com `access-control-request-method: PATCH`). Mantém `origin: false` para `/v1/integrations` (o `delegator` já faz).
**Warning signs:** `fetch` rejeita com `TypeError: Failed to fetch` só em PATCH/DELETE; funciona no curl.

### Pitfall 2: O trigger de admin da 007 contradiz D-08 (lixeira da Empresa)
**What goes wrong:** D-08 manda "Excluir Empresa encerra os vínculos vigentes (`fim` preenchido)". Enviar a Empresa à lixeira (`estado='na_lixeira'`) e preencher `fim` no último vínculo admin **falha no commit** com `Empresa e1 precisa de ao menos um Contato admin vigente`, porque `crm_confere_admin` só testa se a Empresa existe — não olha o `estado`.
**Prova (container `postgres:16`, 007 aplicada):** `update empresas set estado='na_lixeira'…; update contato_empresa set fim=current_date…; commit;` → `ERROR: Empresa e1 precisa de ao menos um Contato admin vigente`. Só o `DELETE` físico da Empresa (cascata) passa. [VERIFIED: execução desta sessão]
**How to avoid — correção validada:** migração nova (ou edição da 007 se ainda não aplicada) que (a) faz `crm_confere_admin` exigir admin só para `estado <> 'na_lixeira'` e (b) cria `constraint trigger empresas_exige_admin_estado after update of estado on plataforma.empresas deferrable initially deferred … execute function plataforma.crm_exige_admin_na_empresa()` para **restaurar** exigir admin. Provado: lixeira+encerrar vínculos → OK; restaurar sem admin vigente → erro; restaurar inserindo novo admin na mesma transação → OK. [VERIFIED: execução desta sessão — SQL em "Code Examples"]
**Alternativa sem SQL:** na lixeira não tocar nos vínculos e só encerrá-los na exclusão permanente (que apaga a Empresa e cascateia) — mas isso contradiz o texto de D-08 ("encerra… `fim` preenchido… preserva histórico") e RN-CON-07 (`contatos.md:344`: "apenas encerra (na eliminação, remove) os Vínculos"). Recomendo a correção SQL.

### Pitfall 3: Excluir Contato = trigger no commit + FKs sem cascade para Negócio
- `contato_empresa` tem `on delete cascade` a partir de `contatos`; apagar (permanente) um Contato que é o último admin dispara o constraint trigger → erro no commit. Provado: `delete from contatos where id='c5'` → `Empresa e5 precisa de ao menos um Contato admin vigente`; rebaixar o único admin (`admin=false`) idem; **trocar admin na mesma transação** (inserir novo admin + rebaixar o antigo) passa. [VERIFIED]
- Lixeira de Contato (`estado='na_lixeira'`) **não** dispara o trigger (não mexe em `contato_empresa`): a regra "último admin" de D-09 tem de ser **pré-checada no serviço** (consulta: Empresas onde este Contato é o único `admin and fim is null`) e devolvida no 409.
- `negocios.contato_id/empresa_id/funil_id/etapa_id` são FK sem `ON DELETE` (= restrict). Provado: `23503` em `negocios_workspace_id_contato_id_fkey`, `…_funil_id_fkey`, `…_funil_id_etapa_id_fkey`. [VERIFIED] A exclusão **permanente** de Contato/Empresa/Funil/Etapa com Negócio deve virar 409; `empresas.matriz_id` (FK própria) bloqueia apagar matriz com filiais (RN-EMP-09/10, `empresas.md:327-328`).
- Pré-check de D-09 sobre Negócio: Negócios em qualquer estado/situação que referenciem o Contato (RN-EMP-10 vale por analogia: não apagar fato comercial).

### Pitfall 4: `DELETE` com `content-type: application/json` e sem corpo → 400
**What goes wrong:** o cliente (ou um wrapper de `fetch` que sempre põe `content-type: application/json`) manda DELETE sem corpo e o Fastify 5 responde `400 FST_ERR_CTP_EMPTY_JSON_BODY` ("Body cannot be empty when content-type is set to 'application/json'").
**Prova:** `DELETE /x/1` com o header e sem corpo → 400; sem o header → 200 (Fastify 5.12.5). [VERIFIED: probe]
**How to avoid:** o cliente só seta `content-type` quando há corpo (esboço do Pattern 5). Em `POST …/restaurar` sem corpo, idem. Teste de rota: DELETE sem corpo e sem header → 200.

### Pitfall 5: `pg` devolve `date` como `Date` com fuso, `numeric` como string, `count` como string
**Prova (TZ do Mac = BRT):** `data_nascimento` `1990-05-17` → `1990-05-17T03:00:00.000Z` (`instanceof Date`); `valor numeric(15,2)` → `'1234.50'`; `count(*)` → `'1'`; `moeda char(3)` → `'BRL'`. [VERIFIED: probe com `pg` 8.23]
**Impacto:** colunas `date` da 007: `contatos.data_nascimento`, `contato_empresa.inicio/fim`, `negocios.data_prevista_fechamento`. Serializar o `Date` mostra o dia errado (ou o dia anterior em fusos negativos). **Não** chamar `types.setTypeParser(1082, …)` globalmente (vazaria para as outras partes do `apps/api` que usam `pg`).
**How to avoid:** `SELECT … data_nascimento::text` (ou `to_char`) nos repositórios; `valor::text`; `count(*)::int`; no tipo do domínio, datas são `CivilDate = string` (`primitives.ts:13`) e dinheiro é `string` decimal na fronteira HTTP (conversão para número só na tela). Teste de repositório com `TZ=America/Sao_Paulo` e `TZ=UTC`.

### Pitfall 6: Constraints que o serviço precisa antecipar (provados ou lidos)
- `funis_padrao_ck`: enviar à lixeira/privatizar o Funil `padrao` → `23514` (provado). RN-FUN-16 proíbe arquivar/lixeira/eliminar/privatizar o padrão. Pré-checar.
- `funis_nome_uq` exclui `na_lixeira` (`where estado <> 'na_lixeira'`): **restaurar** Funil com nome em uso → `23505` → 409 pedindo renomear (RN-FUN-02).
- `etapas_nome_uq` (por Funil, `lower(btrim(nome))`); `etapas_funil_id_uq` habilita a FK composta do Negócio.
- Um Funil precisa de ≥1 Etapa (RN-FUN-04, INV-FUN-02) — **a 007 não impõe**; criar Funil e Etapas na mesma transação e recusar remover a última Etapa no serviço.
- `negocios_encerramento_ck`: `(situacao='aberto') = (encerrado_em is null)` → ganhar/perder **precisa** setar `encerrado_em = now()`; reabrir precisa zerar `encerrado_em`, `motivo_perda`, `motivo_ganho`, `nota_encerramento` (RN-NEG-11).
- `negocios_motivo_perda_ck`: `motivo_perda is null or situacao = 'perdido'`.
- `negocios_dono_ck`: `num_nonnulls(empresa_id, contato_id) = 1` — XOR; `PATCH` que troca Empresa por Contato precisa zerar o outro no mesmo UPDATE.
- `contatos` não exige "nome ou identificador" (INV-CON-01) no banco — regra do **domínio** (`validarContato`).
- `contato_identificadores_principal_uq` / `empresa_identificadores_principal_uq`: no máx. 1 principal por tipo; primeiro identificador de cada tipo nasce principal (`contatos.md:134`); trocar principal = rebaixar o anterior e promover o novo no **mesmo UPDATE/transação**.
- `empresa_identificadores_pais_ck`: `documento_fiscal` exige `pais`.
- `contato_empresa_vigente_uq`: 1 vínculo vigente por par; "mudar de Empresa" = preencher `fim` do antigo e inserir novo.

### Pitfall 7: Reordenar Etapas
`etapas_ordem_uq` é `deferrable initially immediate`: checado no **fim do statement**, não por linha. Um único `UPDATE … SET ordem = CASE …` que troca duas Etapas passa; dois UPDATEs sequenciais não. Provado (`swap OK`). [VERIFIED] Inserir no meio: `UPDATE … SET ordem = ordem + 1 WHERE ordem >= $x` e depois o INSERT. A Etapa inicial é a de menor `ordem` (RN-FUN-06).

### Pitfall 8: Divergência de vocabulário modelo antigo × 007 nas telas
| Antigo (telas/domínio atual) | 007 / novo |
|---|---|
| `lifecycle: "ativo" \| "arquivado" \| "naLixeira"` (`primitives.ts:55`) | `estado: 'ativo' \| 'arquivado' \| 'na_lixeira'` |
| `ContactIdentifierType`: `identidadeDeWhatsApp`, `usuarioDeInstagram`, … | `telefone`, `email`, `whatsapp`, `instagram` |
| `CompanyIdentifier.type`: `documentoFiscal` | `documento_fiscal` |
| `Deal.stageId`, `situation`, `ownerMemberId`, `value: Money` | `etapa_id`, `situacao`, `proprietario_id`, `valor`+`moeda` |
| `Stage.defaultProbability`, `requirements`, `allowedTransitionStageIds` | `probabilidade_padrao`; **sem** Requisitos/Transições (D-02) |
| `Funnel.closingRules.requireLossReason/requireValueOnWin` | `exige_motivo_perda` / `exige_valor_ganho` |
| `StateSeal state={lifecycle}`, `IDENTIFIER_TYPE_LABEL`, `DEAL_SITUATION_LABEL` (em `features/shell/format`) | precisam de variantes para o vocabulário novo ou mapeamento explícito na fronteira |
Consequência: criar **componentes novos** (nomes pt-BR) sobre os tipos do `@n1/dominio/crm` em vez de adaptar os antigos. Os campos que a 007 não tem (tags, consentimentos, mesclagem, temperatura, histórico de Etapas, Requisitos) ficam ocultos ou desabilitados (D-02).

### Pitfall 9: O "kanban de Negócios" não é `quadro-negocios.tsx`
`features/estrutura/quadro-negocios.tsx` desenha as colunas de **Status de Tarefa** nas Listas conversacionais (Tarefa-espelho de Negócio; arrastar muda o Status da Tarefa — seu cabeçalho diz isso). O kanban real de Negócios (colunas = Etapas do Funil, soltar chama `moveDealToStage`) está **inline** em `app/(shell)/crm/negocios/page.tsx` e usa `ColunaDeQuadro`/`VazioDaColuna` de `features/shell/quadro.tsx`. [VERIFIED: leitura dos dois arquivos] **Reuse `ColunaDeQuadro`/`VazioDaColuna` e o `DealCard` como referência visual; não toque `quadro-negocios.tsx` nem `/crm/meus-negocios`** (modelo de Tarefas).
Drag-and-drop com REST: UI otimista opcional via `mutate(chave, dadosOtimistas, { revalidate: true })`; em recusa 409 (ex.: Funil arquivado) reverter e mostrar `error`.

### Pitfall 10: Next 16 — `params` é `Promise`; Client Component usa `use(params)`
As páginas de ficha já fazem `const { negocio } = use(params)` com `params: Promise<{ negocio: string }>` — confirmado pela doc (`03-file-conventions/page.md`: `params: Promise<{ slug: string }>`). Manter o padrão ao criar páginas novas (ex.: `crm/negocios/[negocio]/page.tsx`). Leitura de dados em Client Component: doc oficial recomenda SWR/TanStack para cache compartilhado (`02-guides/client-side-data-fetching/index.md`). `useSearchParams()` exige fronteira `<Suspense>` — o `(shell)/layout.tsx` já envolve a casca num `<Suspense>`; não remover (o layout documenta que sem ela o build falha). `useCreateRecordDialog` usa `?criar=<família>`; manter o mecanismo para o botão "Novo …".
Também: o layout `(shell)` roda `carregarEstadoInicial()` (`GET /estado`, ~475 KB) em toda navegação do shell e hidrata o store — **continua necessário** (Membros, Papéis, rotas do resto do app). Não tente removê-lo nesta fase.

### Pitfall 11: Testes de api contra o Supabase remoto
`carregarEnv()` só preenche variáveis **ausentes** (`if (process.env[chave] === undefined)`), então `DATABASE_URL=… npm run test` no shell vence o `.env`. Sem isso, os testes que checam `Boolean(process.env.DATABASE_URL)` rodam contra o Supabase real. Para a Fase 7, **use um Postgres local descartável**: provado que `docker run postgres:16` + `DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres npx vite-node src/persistencia/migrar.cli.ts` aplica 001-007 sem erro (hosts `localhost`/`127.0.0.1` dispensam TLS — `HOST_LOCAL` em `conexao.ts`). [VERIFIED: execução]. Cada teste usa `workspace_id` único (`ws_crm_teste_*`) e limpa no `afterAll`.

## Code Examples

### Valores discretos da 007 (citação verbatim — fonte única para os tipos)
```sql
-- 007-crm.sql:69  constraint contatos_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
-- 007-crm.sql:70-71  constraint contatos_modo_criacao_ck check (modo_criacao in
--                      ('manual', 'importacao', 'automatico_mensagem', 'automatico_automacao')),
-- 007-crm.sql:110 constraint contato_identificadores_tipo_ck check (tipo in ('telefone', 'email', 'whatsapp', 'instagram')),
-- 007-crm.sql:177 constraint empresa_identificadores_tipo_ck check (tipo in ('dominio', 'documento_fiscal', 'telefone')),
-- 007-crm.sql:309 constraint funis_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
-- 007-crm.sql:404 constraint negocios_situacao_ck check (situacao in ('aberto', 'ganho', 'perdido')),
-- 007-crm.sql:405 constraint negocios_estado_ck check (estado in ('ativo', 'arquivado', 'na_lixeira')),
```
Tabelas (007): `plataforma.contatos`, `contato_identificadores`, `empresas`, `empresa_identificadores`, `contato_empresa`, `funis`, `etapas`, `negocios` [VERIFIED: `007-crm.sql:46,96,125,164,197,292,334,368`]. PK de todas: `(workspace_id, id)`; `negocios.moeda char(3) default 'BRL'`; `negocios.valor numeric(15,2)`; `etapas.probabilidade_padrao smallint` (0-100); `negocios.probabilidade smallint` (nula = usa a da Etapa).

### Correção do trigger de admin (validada em Postgres 16 sobre a 007)
```sql
-- Empresa na lixeira não exige admin vigente; voltar da lixeira exige.
create or replace function plataforma.crm_confere_admin(p_workspace text, p_empresa text) returns void
language plpgsql as $$
begin
  if exists (select 1 from plataforma.empresas
              where workspace_id = p_workspace and id = p_empresa and estado <> 'na_lixeira')
     and not exists (
       select 1 from plataforma.contato_empresa
        where workspace_id = p_workspace and empresa_id = p_empresa
          and admin and fim is null)
  then
    raise exception 'Empresa % precisa de ao menos um Contato admin vigente', p_empresa
      using errcode = 'check_violation', constraint = 'empresa_exige_admin';
  end if;
end;
$$;
drop trigger if exists empresas_exige_admin_estado on plataforma.empresas;
create constraint trigger empresas_exige_admin_estado
  after update of estado on plataforma.empresas
  deferrable initially deferred
  for each row execute function plataforma.crm_exige_admin_na_empresa();
```
(`crm_exige_admin_na_empresa` da 007 já trata `tg_table_name = 'empresas'` usando `new.workspace_id/new.id`.) [VERIFIED: executado em container nesta sessão]

### Criar Empresa + admin numa transação (D-08)
```typescript
// servicos/crm/empresas.ts (esboço)
export async function criarEmpresa(deps: { pool: Pool; repos: (c: PoolClient) => ReposCrm }, membro: MembroDaSessao, entrada: CriarEmpresa) {
  const c = await deps.pool.connect();
  try {
    await c.query("begin");
    const r = deps.repos(c);
    const empresa = await r.empresas.inserir(membro.workspaceId, { ...entrada.empresa, proprietarioId: entrada.proprietarioId ?? membro.id, criadoPor: membro.id });
    const contatoId = "contatoId" in entrada.admin
      ? entrada.admin.contatoId                        // existente do mesmo Espaço (a FK composta já recusa outro)
      : (await r.contatos.inserir(membro.workspaceId, { ...entrada.admin.novoContato, proprietarioId: membro.id, criadoPor: membro.id })).id;
    await r.vinculos.inserir(membro.workspaceId, { contatoId, empresaId: empresa.id, admin: true, cargo: entrada.admin.cargo, criadoPor: membro.id });
    await c.query("commit");                            // o constraint trigger deferido roda AQUI
    return empresa;
  } catch (e) { await c.query("rollback"); throw traduzirErroDePg(e); }
  finally { c.release(); }
}
```

### Rota REST com zod (mesmo molde de `rotas/operacoes.ts`)
```typescript
// rotas/crm/funis.ts (esboço)
export async function rotasDeFunis(app: FastifyInstance, opcoes: { servico: ServicoDeFunis }): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.delete("/funis/:id", { schema: { params: z.object({ id: z.string().min(1) }) } }, async (request, reply) => {
    const res = await opcoes.servico.enviarParaLixeira(request.membro, request.params.id);
    if (res.tipo === "bloqueado") return reply.code(409).send({ ok: false, error: res.frase, codigo: "FUNIL_COM_NEGOCIOS", bloqueios: { negocios: res.negocios } });
    if (res.tipo === "naoEncontrado") return reply.code(404).send({ ok: false, error: "Funil não encontrado." });
    return reply.code(200).send({ ok: true });
  });
}
```
Registro em `app.ts` depois do hook de autenticação, como as demais: `app.register(rotasDeFunis, { servico })` (aceitar injeção em `OpcoesDoApp` para testar sem banco, como `financeiro`/`classificacoes`).

### Pré-check do 409 de excluir Funil/Etapa (D-07)
```sql
select count(*)::int as negocios from plataforma.negocios where workspace_id = $1 and funil_id = $2;           -- Funil
select count(*)::int as negocios from plataforma.negocios where workspace_id = $1 and etapa_id  = $2;          -- Etapa
```
(inclui `na_lixeira`/encerrados: RN-FUN-10/13 e RN-NEG-17.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tudo no `DataState` jsonb + `POST /operacoes/:nome` + `GET /estado` | Tabelas relacionais próprias + REST por recurso para o CRM | 007 (esta fase) | CRM sai do diff/revisão do Espaço; escrita concorrente por registro, não por Espaço |
| `params` síncrono | `params: Promise<…>` (`use(params)` em client) | Next 15/16 | Já seguido nas páginas de ficha |
| Hidratar 475 KB e filtrar no cliente | Listas paginadas por HTTP | esta fase (só CRM) | Resto do app continua no store |

**Deprecated/outdated (nesta fase):** nada é removido; o modelo inglês de CRM convive até a fase de aposentadoria (D-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `007-crm.sql` ainda **não** foi aplicada no Supabase remoto (arquivo untracked) — por isso pode ser editada em vez de criar `008` | Pitfall 2, Open Q1 | Se já aplicada, editar não surte efeito e diverge do histórico: tem de ser `008` |
| A2 | O `join` `registros` members→roles (`m.dados->>'roleId'` = `r.id`, `colecao='roles'`) devolve a `base` do Papel | Pattern 3 | Consulta de permissão errada; trocar por duas consultas simples — baixo custo, mas testar |
| A3 | Matriz de permissão: `membro` pode criar/editar/excluir Contato/Empresa/Negócio; só `administrador`/`proprietario` cria/exclui Funil e edita Etapas; só eles reabrem `ganho` | Pattern 3 | O dono pode querer vendedor sem poder excluir; é decisão de produto (RN-FUN-17/RN-NEG-10 sustentam, `ontologia/03-crm`) |
| A4 | Normalização de telefone mínima (só dígitos, `+`, prefixo `55` para 10-11 dígitos) é aceitável sem `libphonenumber-js` | Don't Hand-Roll | Telefones estrangeiros mal normalizados → duplicidade perdida ou falso positivo |
| A5 | Lista de provedores públicos de e-mail para recusar `dominio` (RN-EMP-05) é uma constante curta no domínio (gmail, hotmail, outlook, yahoo, icloud, uol, bol…) | Don't Hand-Roll | Domínio aceito/recusado indevidamente |
| A6 | Valores monetários trafegam como `string` decimal e a tela converte com `Number()` | Pitfall 5 | Baixo: `numeric(15,2)` cabe em `Number` com margem; mudar para número é trivial |
| A7 | Sem controle otimista (last-write-wins) nos `PATCH` desta fase; `atualizado_em` poderia virar ETag depois | Pattern 4 | Edições simultâneas se sobrescrevem silenciosamente |
| A8 | Paginação por `limite`/`deslocamento` (default 50, teto 200) e busca `ILIKE` simples bastam para o volume atual (Gestão: dezenas/centenas) | Pattern 4 | Se o volume crescer, trocar por keyset + índice trigram |
| A9 | Registro de Atividade (RN-*-22) das ações de CRM **não** é gravado nesta fase (a 007 não tem tabela de atividade; `activity` vive em `registros`) | Open Q4 | Auditoria ausente nas novas entidades até a fase própria |

## Open Questions (RESOLVED)

Todas resolvidas no plan-phase de 2026-10-09; a decisão de cada uma está em `07-CONTEXT.md`.

1. **A 007 já foi aplicada em algum banco?** — RESOLVED: D-12.
   - What we know: está untracked; `migrar.ts` registra o **nome do arquivo** e o aplica uma vez (`migrar.ts` cabeçalho: "os arquivos são imutáveis depois de aplicados").
   - What's unclear: se alguém rodou `npm run migrar` contra o Supabase remoto.
   - Recommendation: o plano começa com um passo de conferência (`select nome from plataforma.migracoes`). Se **não** aplicada: incorporar a correção do trigger (Pitfall 2) e quaisquer ajustes direto na 007 antes do primeiro `migrar`, e commitá-la. Se aplicada: `008-crm-admin-lixeira.sql`.
   - Resolution (D-12): a 007 não foi aplicada em nenhum banco; a correção do trigger entra direto na 007, que é commitada, e o plano ainda confere `plataforma.migracoes` (`migrar --seco`) antes do primeiro `migrar` no banco da plataforma.
2. **Como nasce o primeiro Funil padrão?** — RESOLVED: D-13. `funis_padrao_uq` permite no máximo um; RN-FUN-16 diz que o padrão existe desde a criação do Espaço; Negócio sem Funil usa o padrão (RN-NEG-03). Hoje a tabela está vazia.
   - Recommendation: regra de serviço — o **primeiro Funil criado** num Espaço sem padrão vira `padrao=true` automaticamente; `POST /funis/:id/padrao` troca (só Administrador/Proprietário). Alternativa: script de bootstrap. Confirmar com o dono.
   - Resolution (D-13): adotada a regra de serviço da recomendação; a troca é só de Administrador/Proprietário (D-14).
3. **Extensão dos formulários além do que a 007 comporta:** — RESOLVED: D-02. A ficha antiga mostra Requisitos de Etapa, Transições permitidas, probabilidade sobrescrita descartada ao mover (RN-NEG-05), Vínculo Contato-Negócio com papéis, múltiplos Contatos por Negócio. A 007 tem 1 Contato **ou** 1 Empresa por Negócio e nenhuma tabela de Requisitos. O plano deve listar explicitamente o que a UI esconde (D-02).
   - Resolution (D-02 + Deferred Ideas de `07-CONTEXT.md`): o que a 007 não guarda fica fora do CRUD desta fase; as telas ocultam ou desabilitam esses blocos, e cada plano de tela lista o que esconde.
4. **Registro de Atividade e notificações:** — RESOLVED: Deferred Ideas de `07-CONTEXT.md` ("Registro de Atividade das ações de CRM (RN-CON-22, RN-NEG-15): a 007 não tem tabela de atividade") e D-15 (Notificações seguem no modelo antigo). Fora do escopo, mas `ontologia` exige (RN-CON-22, RN-NEG-15).
   - Resolution: a fase aceita a ausência (A9); volta em fase própria, com tabela de atividade.
5. **`/crm/meus-negocios`, busca global (`/buscar`), Lixeira (`/configuracoes/lixeira`), Notificações e Caixa de Entrada continuam lendo o modelo antigo.** — RESOLVED: D-15. Contatos criados pela nova API não aparecerão nelas. Aceitável por D-01? Se não, abrir item para a fase de unificação.
   - Resolution (D-15): limitação aceita e registrada para a fase de unificação (Deferred Ideas).
6. **Escopo de busca/filtros por `campos_adicionais`** (índice GIN existe): — RESOLVED: Claude's Discretion de `07-CONTEXT.md` (paginação/filtros das listagens). Não requerido pelo goal; tratar `campos_adicionais` apenas como leitura/edição de pares chave→valor.
   - Resolution: `campos_adicionais` é só lido e editado como pares chave→valor (limites em `LIMITES_CRM`); a busca `q` das listagens não filtra por ele.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tudo | ✓ | v24.14.0 | — |
| npm | workspaces | ✓ | 11.x (probe `npm --version` impresso junto) | — |
| Docker | Postgres descartável para testes de repositório | ✓ | 29.3.1; imagem `postgres:16` já local | usar `DATABASE_URL` remoto (evitar) |
| psql | inspeção/queries manuais | ✓ | `/opt/homebrew/bin/psql` | — |
| Postgres local em :5432 | — | ✗ | `pg_isready` → no response | subir container (`docker run -d --rm -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16`) |
| `apps/api/.env` / `DATABASE_URL` remoto | testes de integração existentes | não inspecionado (arquivo protegido contra leitura) | — | testes pulam sem `DATABASE_URL` |
| Supabase (JWT) | login real nas telas / UAT | depende do `.env` do web | — | injetar `verificarToken`/`resolverMembro` nos testes de rota |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** Postgres local → container Docker (provado: `migrar` aplica 001-007).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 nos 3 workspaces |
| Config file | `packages/dominio/vitest.config.mts` (node), `apps/api/vitest.config.mts` (node, `fileParallelism:false`, timeouts 180 s), `apps/web/vitest.config.mts` (node por padrão; `// @vitest-environment jsdom` por arquivo `.tsx`) |
| Quick run command | `npm run test -w @n1/dominio -- crm` · `npm run test -w @n1/api -- rotas/crm` · `npm run test -w @n1/web -- dados/crm` |
| Full suite command | `npm run check` (typecheck + lint + verificar:tokens + verificar:contratos + test, os 3 workspaces) |

`npm run test -w @n1/api` completo leva ~554 s (43+ arquivos em série — `vitest.config.mts`); rodar só os arquivos de CRM por tarefa.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRM-D1 | `normalizarEmail/Telefone/Dominio/Documento`, `validarContato` (INV-CON-01), `validarEmpresa`, `validarEncerramento`, `podeNoCrm` | unit (puro) | `npm run test -w @n1/dominio -- crm` | ❌ Wave 0 (`packages/dominio/src/crm*.test.ts`) |
| CRM-A1 | 401 sem token; 403 Convidado escreve; 404 de outro Espaço; 400 corpo inválido (`.strict()`); `workspaceId` do corpo ignorado | route (`app.inject`, fake em memória, sem banco) | `npm run test -w @n1/api -- rotas/crm` | ❌ Wave 0 |
| CRM-A1 | CORS preflight PATCH/DELETE | route | `npm run test -w @n1/api -- app.test` | ✅ estender `app.test.ts` |
| CRM-A2 | 409 Funil/Etapa com Negócios (contagem); 409 último admin; 409 Identificador duplicado; Empresa+admin atômico; trocar admin | integração (Postgres container) | `DATABASE_URL=postgres://postgres:x@localhost:55432/postgres npm run test -w @n1/api -- repositorios/crm servicos/crm` | ❌ Wave 0 |
| CRM-A2 | trigger×lixeira corrigido (lixeira+`fim` OK; restaurar sem admin falha) | integração SQL | idem | ❌ Wave 0 |
| CRM-A3 | mover/ganhar(exige valor)/perder(exige motivo)/reabrir; `encerrado_em` coerente; reabrir `ganho` só admin | integração + route | idem | ❌ Wave 0 |
| CRM-A2 | `date` volta como `'YYYY-MM-DD'` sob `TZ=America/Sao_Paulo` | integração | `TZ=America/Sao_Paulo npm run test -w @n1/api -- repositorios/crm` | ❌ Wave 0 |
| CRM-W1 | cliente HTTP: header `authorization`, sem `content-type` em DELETE, parse de erro 409 | unit com `fetch` falso | `npm run test -w @n1/web -- dados/crm` | ❌ Wave 0 |
| CRM-W1/W2 | listas e kanban renderizam, formulário chama a rota certa, 409 vira mensagem | componente (jsdom, `fetch` falso, `vi.mock("next/navigation")` como em `compartilhadas-comigo.test.tsx`) | `npm run test -w @n1/web -- features/crm` | ❌ Wave 0 |
| CRM-W1 | fluxo real login→criar Empresa→Negócio→mover | manual/UAT (`human_verify_mode: end-of-phase`) | UAT guiado + opcional Playwright (`apps/web/e2e/`) | ❌ UAT |

### Sampling Rate
- **Por commit de tarefa:** o `-- <filtro>` do workspace tocado + `npm run typecheck -w <ws>`.
- **Por merge de onda:** `npm run typecheck && npm run test -w @n1/dominio && npm run test -w @n1/web` + arquivos CRM do api contra o container.
- **Gate da fase:** `npm run check` verde (com `DATABASE_URL` apontando ao container ou testes de banco pulando) antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/dominio/src/crm*.test.ts` — normalização/regras/permissão.
- [ ] Helper de teste do api: sobe/aponta Postgres (`DATABASE_URL` local), roda `migrar()`, gera `workspace_id` único, limpa no `afterAll` (padrão de `estado.test.ts`: `temBanco ? describe : describe.skip`).
- [ ] Fakes em memória dos repositórios (para `rotas/crm/*.test.ts` sem banco).
- [ ] Fixture de `membro`/`papel` para a consulta de permissão.
- [ ] `apps/web`: helper `fetch` falso e `SWRConfig` com `provider: () => new Map()` para isolar cache entre testes.
- [ ] Framework install: `npm install swr@2.5.1 -w @n1/web`.

## Security Domain

`security_enforcement` está habilitado (ASVS nível 1, `security_block_on: high` em `.planning/config.json`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | herdado | JWT do Supabase no hook `onRequest` (`plugins/autenticacao.ts`); rotas novas **não** se marcam `publica` |
| V3 Session Management | herdado | Token vem de `getSession()` do Supabase no cliente; sem cookie próprio |
| V4 Access Control | **sim (núcleo)** | `workspaceId` só de `request.membro`; `podeNoCrm` por Papel; 404 (não 403) para id de outro Espaço; FKs compostas da 007 como segunda barreira |
| V5 Input Validation | **sim** | zod `.strict()` em params/query/body; limites (`max` de strings, `campos_adicionais` chaves/tamanho, `limite` ≤ 200); regras do domínio |
| V6 Cryptography | não | nada novo; sem segredos |
| V7 Error handling/logging | sim | 500 genérico (`setErrorHandler`); não logar corpo com dados pessoais; `request.log` sem PII |
| V8 Data protection | parcial | dados pessoais (nome, e-mail, telefone, data de nascimento): sem cache compartilhado em CDN; resposta só ao Membro do Espaço |

### Known Threat Patterns for Fastify + pg + Next client
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR entre Espaços (id de outro workspace) | Information disclosure | `WHERE workspace_id = $1 AND id = $2` em toda consulta; teste "Membro do WS A não lê/edita recurso do WS B" |
| Mass assignment (`proprietarioId`, `criadoPor`, `workspaceId`, `estado`, `padrao` no corpo) | Tampering | zod `.strict()` com schema de entrada próprio por rota; `criado_por` = `request.membro.id`; `proprietarioId` revalidado como Membro ativo |
| Escalada por Papel (Convidado/Membro cria Funil, reabre `ganho`) | Elevation of privilege | `podeNoCrm` no serviço + teste por Papel |
| SQL injection (ordenação/filtro dinâmicos) | Tampering | Parâmetros `$n`; `ORDER BY` por allowlist; `ILIKE` com `%` escapado |
| JSONB abusivo (`campos_adicionais`, `enderecos`) | DoS | `bodyLimit` do Fastify + schema (nº máx. de chaves, tamanho de valor); o banco só garante a forma objeto/array |
| Vazamento de erro do Postgres (nome de constraint/esquema) | Information disclosure | traduzir SQLSTATE conhecido em frase pt-BR; desconhecido → 500 genérico |
| CORS aberto ao abrir PATCH/DELETE | Spoofing/CSRF-like | manter allowlist de origens (`webOrigins`), `credentials:false`, `Authorization` por header (não cookie) |
| Enumeração de e-mail/telefone via 409 de duplicidade | Information disclosure | aceitável dentro do Espaço (RN-CON-11 exige indicar o Contato existente); nunca cruzar Espaços |

## Sources

### Primary (HIGH confidence)
- Código lido nesta sessão: `apps/api/migracoes/007-crm.sql` (inteiro), `apps/api/src/app.ts`, `plugins/autenticacao.ts`, `persistencia/{conexao,migrar,membros,unidade-de-trabalho}.ts`, `rotas/{estado,operacoes}.ts`, `rotas/esquemas/{CONTEXT,fragmentos,contatos}.ts`, `apps/web/src/dados/{store,transporte,sessao-provider,estado-inicial}.ts(x)`, páginas `app/(shell)/crm/*`, `features/crm/create-record-dialog.tsx`, `features/estrutura/quadro-negocios.tsx`, `packages/dominio/{package.json,src/types/{crm,workspace}.ts,src/operations/deals.ts,src/seed.ts,src/state.ts}`, os `CONTEXT.md` de cada camada.
- Experimentos executados (Postgres 16 em Docker, `pg` 8.23, Fastify 5.12.5, `@fastify/cors` 11.3.0): trigger de admin × lixeira; delete de último admin; swap de `ordem`; códigos SQLSTATE; parsing de `date`/`numeric`/`count`; DELETE com `content-type` sem corpo; preflight PATCH; `migrar` 001-007.
- Docs do Next 16.3.4 instalado: `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md`, `02-guides/client-side-data-fetching/{index,swr}.md`, `03-api-reference/03-file-conventions/page.md`.
- `ontologia/03-crm/{contatos,empresas,funis,negocios}.md` (regras RN-/INV-) citadas por número de linha.
- npm registry via `npm view` + `gsd-tools query package-legitimacy check` (swr OK; @tanstack/react-query SUS/too-new).

### Secondary (MEDIUM confidence)
- `.planning/codebase/{CONVENTIONS,TESTING}.md` (mapeamento de 2026-09-15).

### Tertiary (LOW confidence)
- Itens `[ASSUMED]` do Assumptions Log (A2-A9).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tudo já no repo exceto `swr`, verificado (OK + doc do Next).
- Architecture: HIGH nas camadas/regras (CONTEXT + código); MEDIUM no contrato REST exato (Claude's Discretion).
- Pitfalls: HIGH — 1, 2, 3, 4, 5, 7, 11 foram reproduzidos nesta sessão; 8, 9, 10 por leitura direta do código/docs.

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (30 dias; reavaliar se a 007 mudar ou se o Next/Fastify subirem de major)
