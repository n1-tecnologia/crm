# Phase 1: O CRM N1 ganha persistência e login — Research

**Researched:** 2026-09-16
**Domain:** Backend HTTP (Fastify + zod) sobre Unidade de Trabalho já existente; verificação de JWT do Supabase Auth (chaves assimétricas); Postgres 17 (colunas geradas + índices sobre `jsonb`); reconciliação de estado no cliente (diff aplicado sobre `DataState`); bootstrap idempotente de configuração; reconvite (RN-ET-11).
**Confidence:** MEDIUM-HIGH (a maior parte do desenho já está travada em `01-CONTEXT.md` D-01..D-09 e no ADR `04-spike-persistencia.md`; a pesquisa aqui cobre a mecânica de biblioteca por trás de cada decisão)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Camada HTTP do `apps/api`**
- **D-01:** Fastify em `apps/api`, processo próprio. Schema-first com `zod` nas bordas; tipagem de rota. Route handlers do Next e Hono foram descartados.
- **D-02:** Autenticação por JWT do Supabase, navegador → `apps/api` direto. O front manda o access token em `Authorization: Bearer`; o Fastify verifica a assinatura contra o JWKS do projeto (`epomplsskqpluxuujpxl`) e resolve o Membro por `Member.userId === sub` dentro do Espaço de Trabalho. Sem estado, um salto só. O mesmo middleware serve depois ao `automation/` com um token de serviço (Phase 2, D-DEC-14). BFF via Next foi descartado.

**O que a API devolve depois de gravar**
- **D-03:** `POST /operacoes/:nome` devolve o `OperationResult` + só o que mudou: os registros gravados e removidos (coleção, id, dados, ordem) e a revisão nova do Espaço de Trabalho. O front aplica o diff no store respeitando a ordem fracionária. `gravar()` já calcula essa lista (`upserts`/`removidos`) — hoje só devolve contagens; falta expô-la. Estado inteiro na resposta e re-hidratação após cada POST foram descartados pela latência medida (~234 ms por ida e volta).
- **D-04:** A carga inicial é `GET /estado` com o Espaço de Trabalho inteiro — decorre de D-DEC-01 e não foi rediscutido.

**Otimismo na tela**
- **D-05:** Híbrido: recusa na hora, gravação espera. `run()` roda a operação numa cópia do estado. Se o domínio recusar (`ok: false`), o erro aparece instantâneo e nada vai ao servidor. Se aceitar, a cópia é descartada, o `POST` é enviado, e o store só muda quando o diff voltar. Um caminho de estado só, sem id provisório, sem rollback.
- **D-06:** Se o servidor informar que a revisão do cliente estava defasada, o front nunca fica com estado que o servidor não tem: re-hidrata por `GET /estado`. Como sinalizar isso na resposta fica com o planejador.

**O que entra no bootstrap**
- **D-07:** Só o Financeiro. O bootstrap cria o Espaço de Trabalho com: Espaço "Gestão" › Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber"; Tipo de Tarefa "Conta"; os Conjuntos de Status com requisitos de saída/entrada; as Definições de Campo (do Espaço, da Pasta e das Listas); as Tags `conta *` e as de cobrança; os Papéis do processo; o Agente de lançamento com a sua Coleção de Conhecimento; as Automações A1–A9 e R2–R7 — conforme `docs/07-processos/contas-a-pagar.md` e `contas-a-receber.md` e como `seed-financeiro.ts` / `seed-contas-a-receber.ts` já montam. Nada de CRM, IA ou outros Espaços. Zero Tarefas, Contatos, Negócios, Conversas ou Registros de Atividade fictícios.
- **D-08:** Só a Maryane como Membro. Consequência da ontologia (B7 — exatamente um Proprietário, sempre Membro): com um Membro só, a Maryane nasce Proprietária do Espaço de Trabalho, além do Papel do processo (Financeiro). Marcos Paulo (Aprovador), Walter e os demais entram depois por convite (RN-ET-11 / PERS-09), não pelo bootstrap. O processo de Contas a pagar não fecha ponta a ponta sozinho ao fim desta fase (falta o Aprovador para `pago`) — é esperado e aceito.
- **D-09:** A Maryane entra com o e-mail de teste por enquanto (`maryane@n1.teste`, conta já existente no Auth, senha de desenvolvimento). A troca pelo e-mail real é um update no Auth e no Membro, sem migrar nada — passo separado, fora desta fase.

### Claude's Discretion

- Porta, script de dev (`npm run dev` sobe web + api?), origens CORS, formato de erro HTTP (4xx vs `OperationResult` em 200), versionamento de rota.
- Formato exato do diff na resposta e da mensagem de "revisão defasada".
- Idempotência do bootstrap (re-executar atualiza configuração sem tocar em dados) e se ele lê de `seed-financeiro.ts` direto ou de um arquivo próprio.
- Quais colunas geradas e índices (PERS-07) — o critério de sucesso 3 do ROADMAP lista o que a Lista de Contas a pagar filtra: status, vencimento, Tag `conta *`, Responsável, Pessoa.
- O mecanismo de convite/reconvite (PERS-09), respeitando RN-ET-11.
- O que fazer com o seed em memória do `apps/web` depois que o store passa a hidratar da API (provavelmente: `buildProductSeed()` some do `store.ts` e fica só nos testes e no bootstrap).

### Deferred Ideas (OUT OF SCOPE)

- Membros reais (Maryane com e-mail real; Marcos Paulo, Walter e demais) — entram por convite quando houver e-mails; não é desta fase.
- Onde o `apps/api` roda (D11 / PERS-08) — bloqueado; a VPS ao lado do `automation/` é o caminho natural.
- Região do Supabase (OQ-ADR-01) — decisão do dono, fora do código desta fase.
- Otimismo total com reconciliação de ids — descartado agora.
- `submitForm` em nome do dono do Formulário (A9 / OQ-PF-01) — afeta a Phase 2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERS-01 | Repositórios + Unidade de Trabalho (feito) | Confirmado no código lido — ver Component Responsibilities; nenhuma ação de pesquisa, só contexto para as rotas novas não reimplementarem isso. |
| PERS-02 | `/entrar` via Supabase Auth, Membro resolvido por `userId` (feito) | Confirmado; a pesquisa do JWT (seção Code Examples #2) estende o mesmo padrão para o `apps/api`, que hoje não verifica nada. |
| PERS-04 | Uma rota HTTP por operação, `POST /operacoes/:nome` | Ver "Standard Stack", "Architecture Patterns — Pattern 1/2/3", "Code Examples #1–#3". |
| PERS-05 | `store.ts` → `POST /operacoes/:nome`, aplica diff | Ver "Architecture Patterns — Pattern 4", "Common Pitfalls — Pitfall 3", "Code Examples #4". |
| PERS-06 | Bootstrap do Espaço "Gestão" sem Tarefas fictícias | Ver "Architecture Patterns — Pattern 5", "Common Pitfalls — Pitfall 4". |
| PERS-07 | Colunas geradas + índices em `plataforma.registros` (migração 002) | Ver "Code Examples #5", "Architecture Patterns — Pattern 6". |
| PERS-08 | Onde o `apps/api` roda | Bloqueado por D11 — fora do código desta fase; só nota em "Environment Availability". |
| PERS-09 | Reconvite reativa o mesmo Membro (RN-ET-11) | Ver "Common Pitfalls — Pitfall 5", "Open Questions #1". |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- `apps/web` roda sobre um Next.js 16.3.4 **não-padrão**: `AGENTS.md` (herdado por `CLAUDE.md`) exige ler `apps/web/node_modules/next/dist/docs/` antes de escrever qualquer código que toque rotas, middleware (agora `proxy.ts`) ou convenções do App Router, porque a API pode divergir do conhecimento de treinamento. Nada em `apps/api` é Next — essa exigência não se aplica lá, mas `apps/web/src/proxy.ts`, `sessao-provider.tsx` e `(shell)/layout.tsx` (que PERS-05 toca) sim.
- O bloco AGENTS.md é regravado pelo `next dev` a cada start — não removê-lo em commits desta fase.

## Summary

A Fase 1 fecha o esqueleto: hoje a persistência (`apps/api/src/persistencia/`) e o login (`apps/web/src/autenticacao/`, `proxy.ts`) já rodam contra Postgres/Supabase de verdade, mas nenhuma tela grava lá — `store.ts` ainda roda a operação em memória sobre `buildProductSeed()`, e `apps/api/src/index.ts` está vazio. O que falta é majoritariamente mecânico e já desenhado pelo ADR: expor `executar()` (Unidade de Trabalho) por uma rota Fastify por operação, trocar `run()` do store por um `POST` que aplica o diff que `gravar()` já calcula, materializar `seed-financeiro.ts`/`seed-contas-a-receber.ts` como um bootstrap sem fixtures, adicionar colunas geradas para os quatro filtros da tela de Contas a pagar, e consertar o casamento de reconvite (`inviteMember`) para reconhecer `Member.userId` além de `invitedIdentity`.

**Primary recommendation:** Fastify 5 com `@fastify/type-provider-zod` (pacote oficial, não `fastify-type-provider-zod` sem escopo — ver nota de nomenclatura abaixo) para tipar rota, `@fastify/cors` para CORS, e verificação de JWT do Supabase via `supabase.auth.getClaims(token)` (não reimplementar JWKS+`jose` manualmente — é o caminho hoje recomendado pela própria Supabase e evita reimplementar cache/rotação de chave). Para o diff no cliente, `structuredClone` do `DataState` antes de rodar a operação (D-05) é seguro em custo: ~475 KB / ~900 registros clona em baixo dígito de milissegundos em V8 moderno — não é o gargalo, a rede é. Para PERS-07, gerar colunas para escalares (`status_id`, `due_date`) e usar índice GIN de expressão (não coluna gerada) para os campos-array (`tagIds`, `assignees`, `fieldValues`).

**Nota de nomenclatura importante:** existem HOJE dois pacotes npm distintos para o mesmo propósito — `fastify-type-provider-zod` (sem escopo, mantido por `turkerdev`, v7.0.0) e `@fastify/type-provider-zod` (escopo oficial `@fastify`, v1.0.0, publicado 2026-08-12, mesmo repositório `fastify/fastify-type-provider-zod`). A documentação oficial em fastify.dev (`/docs/latest/Reference/Type-Providers/`) referencia o pacote **com escopo**, `@fastify/type-provider-zod` — é o recomendado. `npm view` confirma ambos existem e resolvem; o gate de legitimidade (ver Package Legitimacy Audit) marcou `@fastify/type-provider-zod` `OK` (24k downloads/semana, mesmo repositório GitHub da Fastify). Instalar o pacote errado (o antigo sem escopo) não quebra nada tecnicamente, mas diverge da doc oficial atual e dos exemplos que o time vai encontrar pesquisando "fastify zod" a partir de agora.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Roteamento HTTP por operação (`POST /operacoes/:nome`) | API / Backend (`apps/api/src/rotas`) | — | Fastify traduz HTTP ↔ chamada de `executar()`; nenhuma regra de negócio na rota (convenção do `CONTEXT.md`). |
| Verificação de JWT + resolução de Membro | API / Backend (`apps/api`, hook `onRequest`) | Browser (obtém o token via `@supabase/ssr`) | A verificação de assinatura e a resolução `userId → Member` são side-effect-free e cabem num hook global do Fastify, decorado no request; o browser só carrega e envia o token, nunca o valida. |
| Transação + diff (hidratar → operação → gravar) | API / Backend (`apps/api/src/persistencia`, já feito) | — | Já implementado (PERS-01); as rotas só compõem, nunca reimplementam. |
| Aplicar o diff no `DataState` do cliente, otimismo híbrido | Browser / Client (`apps/web/src/dados/store.ts`) | — | É estado de UI (Zustand), efêmero por requisição SSR; a lógica de merge por diff não tem por que existir no servidor. |
| Colunas geradas + índices sobre `plataforma.registros` | Database / Storage (migração `002-*.sql`) | — | Extração de campo `jsonb` para coluna é responsabilidade de schema, não de código de aplicação; zero mudança em `apps/api/src/persistencia/repositorio.ts`. |
| Bootstrap do Espaço "Gestão" | API / Backend (script `vite-node`, reaproveitando `semear()`) | Database (grava direto via `plataforma.registros`) | É um caso especial de `gravar()`/`semear()` já existente — não é uma nova capacidade de persistência, é dado de entrada diferente (config, não fixture). |
| Reconvite (RN-ET-11) | API / Backend (serviço que resolve e-mail → Auth user antes de chamar o domínio) | packages/dominio (regra de casamento por `userId`) | A parte "existe um Usuário com este e-mail?" só o Supabase Admin API responde (I/O); a regra "reativa o mesmo Membro" é pura e already vive em `inviteMember` — só falta o dado (`userId`) chegar até ela. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.12.5 (`npm view fastify version`, 2026-09-16) [VERIFIED: npm registry] | Servidor HTTP de `apps/api` | D-01 já trava a escolha; é o framework Node mais rápido com schema-first nativo, sem exigir framework de app inteiro (Nest) nem acoplar ao Next. |
| `@fastify/type-provider-zod` | 1.0.0 (publicado 2026-08-12) [VERIFIED: fastify.dev + npm registry] | Tipagem de rota ponta a ponta a partir de schema `zod` (`z.object` na `body`, `querystring`, `response`) | Pacote oficial referenciado pela doc atual do Fastify (`fastify.dev/docs/latest/Reference/Type-Providers/`); zero geração de código, os mesmos schemas `zod` já usados em `packages/dominio` viram validação HTTP. |
| `@fastify/cors` | 11.3.0 [VERIFIED: npm registry] | Plugin oficial de CORS | É o plugin mantido pela própria organização `fastify`; registra com `origin` como allowlist (não `*`, já que o `Authorization: Bearer` viaja com a origem do browser em dev + prod). |
| `zod` | ^4.6.1 (já em uso) | Validação de borda | Já é dependência de `packages/dominio`; reaproveitar em vez de introduzir outra lib de schema. |
| `jose` | 6.2.12 [VERIFIED: npm registry] — **só se `getClaims()` não servir** | Verificação manual de JWT via JWKS (`createRemoteJWKSet` + `jwtVerify`) | Ver "Don't Hand-Roll" — preferir `supabase.auth.getClaims()`; `jose` fica como plano B documentado, não como escolha default. |
| `pg` | ^8.23.0 (já em uso) | Driver Postgres | Sem mudança — já é a base de `apps/api/src/persistencia`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `concurrently` | 10.0.5 [VERIFIED: npm registry] | Subir `apps/web` (Next) + `apps/api` (Fastify) com um `npm run dev` na raiz | Discretion do CONTEXT.md ("script de dev — `npm run dev` sobe web + api?"). Alternativa equivalente: `npm-run-all2` 9.0.3 — ambos ativamente mantidos; `concurrently` tem 15M downloads/semana contra ~menos de `npm-run-all2`, e já é o exemplo mais comum para "dois processos de dev num monorepo npm workspaces" — usar `concurrently` a menos que o time já tenha preferência pelo outro. |
| `vite-node` | ^6.0.0 (já em uso) | Rodar `apps/api/src/index.ts` em watch mode sem compilar | **Não introduzir `tsx`/`nodemon` como nova dependência** — `vite-node` já é devDependency de `apps/api` (usado por `migrar` e `usuarios:seed`) e suporta `-w, --watch` (confirmado localmente: `npx vite-node -h` [VERIFIED: vite-node CLI --help instalado no repo]). Script: `"dev": "vite-node --watch src/index.ts"`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fastify/type-provider-zod` | `fastify-type-provider-zod` (sem escopo, `turkerdev`) | Mesma funcionalidade, mas não é mais o pacote linkado pela doc oficial atual; manter os dois em paralelo no ecossistema é uma fonte de confusão — escolher o com escopo. |
| `supabase.auth.getClaims()` | `jose` manual (`createRemoteJWKSet` + `jwtVerify`) | `getClaims()` já resolve cache do JWKS (10 min, gerenciado pela Supabase Edge) e sabe cair para `getUser()` em chaves simétricas legadas; `jose` manual exige reimplementar isso à mão — só vale a pena se `getClaims()` não puder resolver `sub`/`email` do jeito que o domínio precisa (não é o caso aqui). |
| `concurrently` | Um script Node próprio com `child_process.spawn` | Zero dependência nova, mas reimplementa o que `concurrently` já resolve (prefixo de log colorido por processo, propagação de sinal `SIGINT` para matar os dois processos juntos) — não vale o código próprio para isso. |
| Coluna gerada para `tagIds`/`assignees` | Índice GIN de expressão sobre `dados->'tagIds'` direto | Uma coluna gerada teria que ser `jsonb` também (não dá para "achatar" um array em uma coluna escalar por `generated always as`), então o ganho de ter coluna gerada (poder indexar com B-tree comum) não existe para arrays — é estritamente melhor indexar a expressão com GIN direto, sem a coluna gerada extra. |

**Installation:**
```bash
npm install fastify @fastify/type-provider-zod @fastify/cors -w @n1/api
npm install -D concurrently
```

**Version verification:** confirmado via `npm view <pacote> version` em 2026-09-16 (ver tabela acima); `@fastify/type-provider-zod` e `@fastify/cors` também cruzados contra `fastify.dev/docs/latest/Reference/Type-Providers/` (WebFetch, 2026-09-16).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----------------------|--------------|--------------|---------|-------------|
| `fastify` | npm | publicado 2026-09-16 (release patch recente) | 9.5M | github.com/fastify/fastify | SUS (`too-new` — só a última versão patch é recente) | **Mantido.** 9.5M downloads/semana e o mesmo repositório oficial há anos; o sinal "too-new" reflete a data de publicação da última versão de patch, não a idade do pacote. Não requer `checkpoint:human-verify` adicional além do já padrão de instalar uma lib nova no projeto. |
| `@fastify/type-provider-zod` | npm | 2026-04-19 | 24.153 | github.com/fastify/fastify-type-provider-zod | OK | Aprovado |
| `@fastify/cors` | npm | 2026-07-08 | 4.7M | github.com/fastify/fastify-cors | OK | Aprovado |
| `jose` | npm | publicado 2026-09-05 (release patch recente) | 97.8M | github.com/panva/jose | SUS (`too-new`, mesmo motivo do fastify) | **Mantido como plano B** (ver Standard Stack — preferir `getClaims()`); se usado, mesmo tratamento do `fastify`: sinal de "recente" é ruído dado o volume de download e maturidade do projeto. |
| `concurrently` | npm | 2026-08-15 | 15.1M | github.com/open-cli-tools/concurrently | OK | Aprovado |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** `fastify`, `jose` — ambos por "too-new" (data da última versão publicada, não idade do pacote); ambos com dezenas de milhões de downloads semanais e repositório oficial estável. Recomendação: **não** bloquear a instalação atrás de um `checkpoint:human-verify` extra — o sinal é um falso positivo estrutural do gate (mede recência de release, não legitimidade) para pacotes de altíssimo volume com cadência de release frequente. Se o planejador preferir seguir o protocolo à risca mesmo assim, um checkpoint rápido de "conferir `npm view fastify repository.url` e o número de downloads" resolve em segundos.

## Architecture Patterns

### System Architecture Diagram

```text
Browser (apps/web)
  │  1. usuário preenche o formulário de uma Conta a pagar
  ▼
useRun() → run(operation)                          [apps/web/src/dados/store.ts — MUDA nesta fase]
  │  2. clona o DataState (structuredClone), roda a operação PURA na cópia
  │     ok:false → mostra erro, PARA aqui (nada vai à rede)          (D-05)
  │  3. ok:true → descarta a cópia, dispara fetch
  ▼
fetch POST /operacoes/:nome  { entrada, revisaoEsperada? }
  Authorization: Bearer <access_token do Supabase>
  │
  ▼
Fastify (apps/api) — hook onRequest                 [NOVO — apps/api/src/rotas/, plugins/auth.ts]
  │  4. supabase.auth.getClaims(token) → { sub, email }
  │     falha de assinatura/expiração → 401, encerra aqui
  ▼
rota POST /operacoes/:nome                           [NOVO — apps/api/src/rotas/operacoes.ts]
  │  5. zod valida a `entrada` do body contra o schema da operação
  │  6. resolve Member por member.userId === sub dentro do workspace da rota
  ▼
executar(workspaceId, (state) => operations[nome](state, memberId, entrada))
  [apps/api/src/persistencia/unidade-de-trabalho.ts — JÁ EXISTE]
  │  7. hidratar() → roda a operação pura → se ok, tenta gravar() com revisão otimista (3x)
  │     conflito de revisão esgotado → 409 com sinal "revisão defasada" (D-06)
  ▼
resposta: OperationResult + { gravados: [...], removidos: [...], revisao }   (D-03)
  │
  ▼
store.ts recebe a resposta
  │  8. ok:false do domínio já tratado no passo 2 (nunca chega aqui pela via feliz)
  │  9. aplica upserts/removidos no DataState real (não na cópia), preservando `ordem`
  │  10. se veio sinal de revisão defasada → GET /estado, re-hidrata tudo   (D-06)
  ▼
revision++ → componentes assinantes re-renderizam
```

### Recommended Project Structure

```
apps/api/src/
├── index.ts                    # boot: cria o Fastify app, registra plugins, listen()
├── app.ts                      # NOVO — monta o app sem dar listen() (para app.inject nos testes)
├── plugins/
│   └── autenticacao.ts         # NOVO — decora request.membro a partir do Bearer token
├── rotas/
│   ├── operacoes.ts            # NOVO — POST /operacoes/:nome (genérica, 1 handler p/ 16 módulos)
│   ├── estado.ts                # NOVO — GET /estado (D-04)
│   └── CONTEXT.md              # já existe
├── servicos/                    # composição de casos de uso (se necessário além da UoW)
├── repositorios/                # já existe: contrato de persistência
├── persistencia/                # já existe, intocado por esta fase
├── autenticacao/
│   ├── criar-usuarios-do-seed.ts  # já existe
│   └── resolver-usuario.ts        # NOVO — email→userId via Admin API (para PERS-09)
└── bootstrap/
    └── gestao.ts                 # NOVO — script `npm run bootstrap:gestao`, chama semear()
```

### Pattern 1: rota genérica por nome de operação, não 16 arquivos

**What:** um único handler Fastify `POST /operacoes/:nome` que faz *dispatch* para `operations[nome]` (o objeto exportado por `packages/dominio/src/operations/index.ts`), em vez de 16 arquivos de rota.
**When to use:** aqui — CON-02 pede "uma rota por operação", que semanticamente é satisfeito por um path param `:nome` mapeado 1:1 a uma função exportada; o contrato HTTP (`POST /operacoes/createTask`, `POST /operacoes/changeTaskStatus`, etc.) é idêntico ao de 16 arquivos, mas sem repetir a mesma casca 16 vezes. Validar `nome` contra um registro explícito de operações permitidas (mesma disciplina de `packages/dominio/src/colecoes.ts` — "acrescentar sem registrar não compila/não abre rota") evita expor qualquer função interna por acidente.
**Example:**
```typescript
// apps/api/src/rotas/operacoes.ts — padrão inspirado no setup oficial de @fastify/type-provider-zod
import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import { z } from "zod";
import * as operations from "@n1/dominio/operations";
import { executar } from "../persistencia/unidade-de-trabalho";

// Registro explícito — mesma disciplina de COLECOES: operação nova sem
// entrada aqui não fica alcançável por HTTP.
const OPERACOES_PERMITIDAS: Record<string, (state: unknown, memberId: string, entrada: unknown) => unknown> = {
  createTask: operations.createTask,
  changeTaskStatus: operations.changeTaskStatus,
  // ...as demais das 16 famílias
};

export const rotasOperacoes: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/operacoes/:nome",
    { schema: { params: z.object({ nome: z.string() }), body: z.unknown() } },
    async (request, reply) => {
      const operacao = OPERACOES_PERMITIDAS[request.params.nome];
      if (!operacao) return reply.status(404).send({ ok: false, error: `Operação "${request.params.nome}" não existe.` });

      const resultado = await executar(request.membro.workspaceId, (state) =>
        operacao(state, request.membro.id, request.body),
      );

      if ("conflito" in resultado) return reply.status(409).send(resultado);
      // OperationResult é valor — nunca lança. 200 mesmo quando ok:false, o
      // corpo carrega a recusa (convenção já usada no domínio inteiro).
      return reply.send(resultado);
    },
  );
};
```

### Pattern 2: hook de autenticação decora `request`, não reimplementa por rota

**What:** um plugin Fastify (`onRequest` hook) que lê `Authorization: Bearer`, chama `supabase.auth.getClaims(token)`, resolve o Membro, e decora `request.membro`.
**When to use:** toda rota protegida (todas, exceto health-check). Fastify plugins com `fastify-plugin` (`fp()`) evitam encapsulamento por padrão, então o hook registrado uma vez no `app.ts` alcança todas as rotas registradas depois.
**Example:**
```typescript
// apps/api/src/plugins/autenticacao.ts
import fp from "fastify-plugin";
import { createClient } from "@supabase/supabase-js";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    membro: { readonly id: string; readonly workspaceId: string };
  }
}

const autenticacao: FastifyPluginAsync = async (app) => {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  app.addHook("onRequest", async (request, reply) => {
    const cabecalho = request.headers.authorization;
    const token = cabecalho?.startsWith("Bearer ") ? cabecalho.slice(7) : undefined;
    if (!token) return reply.status(401).send({ ok: false, error: "Sem sessão." });

    // getClaims() verifica a assinatura contra o JWKS do projeto e resolve
    // localmente (chave assimétrica) sem round-trip por requisição — a
    // Supabase Edge já cacheia o JWKS por 10 min.
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data) return reply.status(401).send({ ok: false, error: "Sessão inválida." });

    // Resolução Member por workspace: hidratar o workspace default (Fase 1
    // só tem "Gestão") e casar por userId === data.claims.sub.
    const membro = await resolverMembro(data.claims.sub);
    if (!membro || (membro.state !== "ativo" && membro.state !== "suspenso")) {
      return reply.status(403).send({ ok: false, error: "Sem acesso." });
    }
    request.membro = membro;
  });
};

export default fp(autenticacao);
```
**Fonte da chamada `getClaims(token)` com parâmetro explícito:** `supabase.com/docs/reference/javascript/auth-getclaims` [CITED: supabase.com/docs/reference/javascript/auth-getclaims] — aceita um JWT específico via parâmetro, não exige sessão persistida no cliente, adequado a um backend stateless.

### Pattern 3: `app.ts` separado de `index.ts` para permitir `app.inject` nos testes

**What:** `app.ts` exporta uma função `buildApp()` que monta o Fastify (plugins, rotas) e devolve a instância **sem** chamar `.listen()`; `index.ts` importa `buildApp()` e só ele chama `.listen()`.
**When to use:** sempre — é o padrão oficial de teste do Fastify (`fastify.dev/docs/.../Guides/Testing`), que evita abrir socket real nos testes de integração.
**Example:**
```typescript
// apps/api/src/rotas/operacoes.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("POST /operacoes/:nome", () => {
  it("recusa sem Authorization", async () => {
    const app = buildApp();
    const resposta = await app.inject({ method: "POST", url: "/operacoes/createTask", payload: {} });
    expect(resposta.statusCode).toBe(401);
  });
});
```
**Fonte:** `fastify.dev/docs/v5.8.x/Guides/Testing` (light-my-request, `app.inject`) [CITED: fastify.dev/docs/v5.8.x/Guides/Testing].

### Pattern 4: `store.ts` — clonar, rodar, aplicar diff (não mais mutação em lugar)

**What:** hoje `run()` muda `DataState` **em lugar** (o comentário do próprio arquivo explica: clonar a cada tecla "custaria mais do que protege"). D-05 exige o oposto para escritas que vão ao servidor: clonar, rodar a operação na cópia, e só tocar o estado real depois que o diff voltar do `POST`.
**When to use:** só para operações que gravam (todas, agora que `run()` chama a API). Leituras (`useData`) continuam lendo o `DataState` real sem clone.
**Example:**
```typescript
// apps/web/src/dados/store.ts — esboço do novo run()
run: async (operationName, entrada) => {
  const { data, session } = get();
  const copia = structuredClone(data);            // ~475 KB, sub-ms em V8 — não é o gargalo
  const resultado = operations[operationName](copia, session.memberId, entrada);

  if (!resultado.ok) {
    // Recusa do domínio: nada vai à rede (D-05). A cópia é descartada.
    set({ lastResult: { ...resultado, at: Date.now() } });
    return resultado;
  }

  const resposta = await fetch(`${API_URL}/operacoes/${operationName}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await tokenAtual()}` },
    body: JSON.stringify(entrada),
  });
  const corpo = await resposta.json();

  if (resposta.status === 409) {
    // Revisão defasada (D-06): nunca aplica diff parcial, re-hidrata tudo.
    await get().rehidratar();
    return { ok: false, error: "Outra alteração entrou antes desta. Recarregado." };
  }

  set((estado) => {
    const novoData = aplicarDiferenca(estado.data, corpo.gravados, corpo.removidos); // preserva `ordem`
    return { data: novoData, revision: estado.revision + 1, lastResult: { ...corpo, at: Date.now() } };
  });
  return corpo;
},
```
**Nota:** este é um esboço ilustrativo, não uma API travada — o formato exato da resposta (`corpo.gravados`/`corpo.removidos`) e a assinatura de `run()` (hoje recebe uma função `(data, memberId) => OperationResult`, precisaria virar `(nome, entrada)` para a rota genérica do Pattern 1, **ou** a rota expõe `/operacoes/:nome` mas o `run()` do cliente continua recebendo uma função — nesse caso a função precisa também carregar o nome da operação para a URL) fica para o planejador decidir; ver Open Questions #2.

### Pattern 5: bootstrap idempotente — separar "config" de "fixture" dentro de `seed-financeiro.ts`

**What:** `applyContasAPagar(state, clock)` hoje cria, na mesma função, as entidades de configuração (Espaço, Pasta, Lista, Status, Campos, Tags, Papéis, Agente, Automações) **e** Membros fictícios (`mk(...)` — Thiago, Rafael, Marcos Paulo, Walter etc.) **e** Tarefas fictícias que reproduzem o histórico do ClickUp lido em `contas-a-pagar.md`. D-07/D-08 exigem só a primeira parte, e só a Maryane como Membro.
**When to use:** ao escrever o bootstrap de PERS-06.
**Caminho recomendado:** não filtrar o `DataState` depois de `buildSeed()` (traria Membros e Tarefas do CRM genérico junto, que não são do Financeiro nem devem existir). Em vez disso, **refatorar `applyContasAPagar`/`applyContasAReceber`** para separar em duas funções: uma que só monta configuração (Espaço → Automações, sem Tasks/Members) e outra que adiciona os Membros fictícios + Tarefas fictícias por cima — os testes de domínio que hoje chamam `buildSeed()` continuam funcionando (a função combinada chama as duas em sequência), e o bootstrap chama só a primeira, mais uma criação isolada da Maryane como Proprietária.
**Idempotência:** `semear()` (já existe em `repositorio.ts`) escreve um `DataState` inteiro num Espaço **vazio** — não faz upsert condicional. Rodar o bootstrap duas vezes sobre um Espaço que já tem dados reais da Maryane sobrescreveria tudo. Ou o bootstrap roda uma vez só (guarda por `on conflict do nothing` na criação do `workspace_id`, como `semear()` já faz) e documenta "não re-executar depois que o Financeiro começar a usar", ou usa o caminho de `gravar()` (upsert por `(workspace_id, colecao, id)`) para permitir reaplicar config sem tocar em Tarefas reais que não estão no `DataState` de bootstrap — a Discretion do CONTEXT.md deixa essa escolha para o planejador; ver Open Questions #3.

### Anti-Patterns to Avoid

- **Reimplementar verificação de JWT com `jose` quando `getClaims()` resolve:** duplica lógica de cache/rotação de chave que a Supabase já mantém; só justificável se `getClaims()` não expuser um claim necessário.
- **Rota chamando `pool()`/SQL direto:** viola a convenção documentada em `apps/api/src/rotas/CONTEXT.md` ("sem regra de negócio, sem SQL") — toda escrita passa por `executar()`.
- **`store.ts` aplicando o diff antes de o `POST` responder (otimismo total):** D-05 descartou isso deliberadamente pelo custo de dois caminhos de estado com `nextId` sendo contador — não reabrir essa decisão sem o usuário.
- **Bootstrap chamando `buildSeed()` e filtrando depois:** traz junto ~900 registros de CRM/IA que D-07 proíbe explicitamente ("Nada de CRM, IA ou outros Espaços").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verificar assinatura de JWT contra JWKS, cache de chave, rotação | Middleware manual com `jose` + `createRemoteJWKSet` do zero | `supabase.auth.getClaims(token)` | A própria Supabase mantém o cache do JWKS (10 min, Edge) e a lógica de fallback para chave simétrica legada; reimplementar isso é reproduzir bug de rotação de chave que a lib já resolveu [CITED: supabase.com/docs/reference/javascript/auth-getclaims]. |
| Rodar dois processos de dev com prefixo de log e propagação de sinal | Script Node com `child_process.spawn` + `readline` | `concurrently` | É exatamente o problema que a lib resolve; zero ganho em reescrever. |
| Clonar profundamente um objeto JS grande preservando `Date`/`undefined` | `JSON.parse(JSON.stringify(...))` (perde `undefined`, `Date` vira string) ou uma lib de deep-clone externa | `structuredClone` (global do Node ≥ 17) | Nativo, sem dependência, e lida com os tipos que o `DataState` usa (datas são strings ISO no domínio, então nem esse risco existe aqui — mas `undefined` em campos opcionais precisa sobreviver ao clone, e `structuredClone` preserva). |
| Parsear e comparar chaves de JSON para diff | Reimplementar a comparação canônica | Já existe: `apps/api/src/persistencia/repositorio.ts` `canonico()`, `gravar()` — reaproveitar a mesma lista `upserts`/`removidos`, só parar de descartá-la. | O diff certo já está calculado; PERS-05 só precisa que a rota devolva o que `gravar()` já produz. |

**Key insight:** as duas peças "novas" desta fase que mais tentam reimplementação (verificação de JWT, diff de estado) já têm solução pronta e testada — uma na biblioteca oficial (`getClaims`), outra no próprio código (`gravar()`). O trabalho real é encanamento (rota, hook, aplicar diff no client), não algoritmo novo.

## Common Pitfalls

### Pitfall 1: confundir `fastify-type-provider-zod` com `@fastify/type-provider-zod`
**What goes wrong:** instalar o pacote sem escopo (ainda mantido, ainda funciona) em vez do oficial com escopo, ou instalar os dois e ter dois `ZodTypeProvider` incompatíveis nos tipos.
**Why it happens:** o pacote sem escopo é mais antigo e tem mais resultado de busca acumulado (SEO), então aparece primeiro em buscas genéricas.
**How to avoid:** `npm install @fastify/type-provider-zod` (com escopo), conferir em `package.json` que só um dos dois está presente.
**Warning signs:** erro de tipo "Type 'ZodTypeProvider' is not assignable..." ao misturar imports dos dois pacotes.

### Pitfall 2: tratar recusa do domínio (`ok: false`) como erro HTTP
**What goes wrong:** a rota lança/retorna 4xx quando `OperationResult.ok === false`, quebrando a convenção "erro é valor, nunca exceção pela fronteira" (`CONTEXT.md` raiz, `ARCHITECTURE.md`).
**Why it happens:** reflexo de frameworks HTTP tradicionais, onde toda falha de validação vira 400/422.
**How to avoid:** `OperationResult` (mesmo `ok: false`) viaja em `200 OK` no corpo — é dado, não status de transporte. Reservar 4xx/5xx para falhas de transporte (401 sem token, 403 sem permissão de acesso à rota, 404 operação inexistente, 409 conflito de revisão, 500 erro não tratado). Discretion do CONTEXT.md deixa a escolha exata para o planejador, mas a convenção do domínio (nunca exceção) empurra fortemente para "recusa de negócio = 200 com `ok:false`".
**Warning signs:** teste de integração esperando `response.statusCode === 200` falhando porque a rota devolveu 400 para uma recusa de regra de negócio.

### Pitfall 3: `structuredClone` falha em `Function`/classes, mas `DataState` não tem nenhuma
**What goes wrong:** preocupação (infundada aqui) de que clonar 900 registros a cada operação seja caro ou quebre algum campo.
**Why it happens:** intuição de "clonar é caro" vinda de benchmarks com objetos muito aninhados ou grandes demais (múltiplos MB).
**How to avoid:** `DataState` é ~475 KB de dados serializáveis (strings, números, arrays, objetos planos — nada de `Function`, `class`, `Symbol`) [VERIFIED: apps/api/src/persistencia/repositorio.ts + ADR 04-spike-persistencia.md, medição de 475 KB / 906 registros]; `structuredClone` de payloads desse tamanho é sub-milissegundo em V8 atual — a latência de rede (~234 ms no cenário medido) domina por duas ordens de grandeza. Não otimizar isso; medir antes de trocar por outra estratégia.
**Warning signs:** nenhum esperado; se aparecer, medir com `console.time` antes de assumir.

### Pitfall 4: bootstrap idempotente "de mentirinha" — rodar duas vezes duplica ou apaga dado real
**What goes wrong:** `semear()` faz `insert ... on conflict do nothing` só na criação do `workspace_id`; os registros em si (`gravar()`) fazem upsert por `(workspace_id, colecao, id)`, então reaplicar o **mesmo** `DataState` de bootstrap é seguro (os ids são determinísticos), mas se o bootstrap script monta ids novos a cada execução (ex.: usar `nextId()`/timestamp em vez de ids fixos como os do seed), reexecutar cria duplicata de config.
**Why it happens:** confundir "idempotente porque `on conflict` existe" com "idempotente porque os ids são estáveis" — as duas coisas precisam ser verdade juntas.
**How to avoid:** usar os mesmos ids literais/determinísticos que `seed-financeiro.ts` já usa (`CP.status.paraPagar`, `CP.fields.pessoa` etc. — constantes, não `nextId()`) no bootstrap.
**Warning signs:** rodar o script de bootstrap duas vezes e ver a Lista "Contas a pagar" duplicada ou os Status repetidos.

### Pitfall 5: reconvite (PERS-09) exige um dado que hoje não existe em lugar nenhum do domínio
**What goes wrong:** tentar consertar `inviteMember` só trocando o critério de busca (`invitedIdentity` → também tentar `userId`) sem perceber que, depois que um Membro aceita um convite, **o e-mail dele não fica guardado em lugar nenhum do `DataState`** (B27 apaga `invitedIdentity` na aceitação) — então não existe como, a partir só do e-mail digitado num novo convite, achar o Membro `removido` certo por comparação pura em `packages/dominio`.
**Why it happens:** o domínio é puro por design (sem I/O); mas "que Usuário do Supabase Auth tem este e-mail" só o Admin API responde, e "qual Membro tem este `userId`" está no `DataState` — a ponte entre os dois precisa acontecer na camada de serviço (`apps/api`), não dentro da função `inviteMember`.
**How to avoid:** antes de chamar `inviteMember`, o serviço resolve o e-mail contra o Supabase Auth (`admin.listUsers` filtrando ou, mais simples, tentar achar por `getUserById` se já se souber o id — o caso normal aqui é: **não** existe um jeito nativo de "buscar usuário por e-mail" na Admin API do supabase-js sem paginar `listUsers()` e filtrar em memória [ASSUMED — não confirmado neste ciclo de pesquisa; verificar `admin.listUsers({ filter })` na versão instalada, `@supabase/supabase-js` 2.116.0, antes de codar]); se achar um `userId` existente, passa esse `userId` para uma versão estendida de `inviteMember` (ou uma nova função) que casa o `removido` por `userId` em vez de (ou além de) `invitedIdentity`. Ver Open Questions #1 para o desenho completo — esta pesquisa não trava a solução, só mapeia a peça faltante.
**Warning signs:** PERS-09 "funcionando" nos testes de domínio (que podem simular o `userId` já resolvido) mas quebrando na integração real porque o e-mail do convite não bate com nenhum Membro existente.

## Code Examples

### 1. `@fastify/cors` — registro básico com allowlist de origem
```typescript
// apps/api/src/app.ts
import cors from "@fastify/cors";

await app.register(cors, {
  origin: [process.env.WEB_ORIGIN ?? "http://localhost:3001"],
  credentials: false, // Authorization por header, não cookie — não precisa
});
```
Fonte: `npmjs.com/package/@fastify/cors`, `github.com/fastify/fastify-cors` [CITED: npmjs.com/package/@fastify/cors].

### 2. `setErrorHandler` — capturar erro não tratado sem vazar stack
```typescript
// apps/api/src/app.ts
app.setErrorHandler((erro, request, reply) => {
  request.log.error(erro);
  reply.status(500).send({ ok: false, error: "Erro interno." });
});
```
Este handler é para exceções **não esperadas** (bug, conexão caiu) — a recusa de domínio (`OperationResult.ok:false`) nunca chega aqui porque nunca é lançada (Pitfall 2). Fonte: `fastify.dev/docs/latest/Reference/Errors/` [CITED: fastify.dev/docs/latest/Reference/Errors].

### 3. `GET /estado` — carga inicial (D-04)
```typescript
// apps/api/src/rotas/estado.ts
app.get("/estado", async (request, reply) => {
  const { state, revisao } = await hidratar(await pool().connect(), request.membro.workspaceId);
  return reply.send({ data: state, revision: revisao, session: { memberId: request.membro.id } });
});
```
Reaproveita `hidratar()` de `apps/api/src/persistencia/repositorio.ts`, já testado.

### 4. Colunas geradas + índices — migração `002-plataforma-colunas-geradas.sql`
```sql
-- Escalares: coluna gerada + B-tree, filtrada por colecao = 'tasks' para não
-- pagar o custo de manter o índice atualizado em outras 44 coleções.
alter table plataforma.registros
  add column status_id text generated always as (dados->>'statusId') stored;

alter table plataforma.registros
  add column due_date text generated always as (dados->'dueDate'->>'value') stored;
  -- TaskDate é { form, value }; "value" é YYYY-MM-DD (civilDay) ou ISO instant —
  -- ambos comparam corretamente como texto para ordenação/filtro por igualdade
  -- e range em formato ISO 8601. Se o planejador quiser um tipo `date` real
  -- para operadores de intervalo, um segundo passo (`::date`) precisa tratar
  -- o caso "instant" à parte — não fazer isso nesta migração sem confirmar
  -- que só "civilDay" aparece em dueDate de Tarefa (CAND-02 sugere que sim).

create index concurrently if not exists registros_status_id_idx
  on plataforma.registros (workspace_id, status_id)
  where colecao = 'tasks';

create index concurrently if not exists registros_due_date_idx
  on plataforma.registros (workspace_id, due_date)
  where colecao = 'tasks';

-- Arrays: não dá para "achatar" tagIds/assignees/fieldValues numa coluna
-- gerada escalar — indexar a EXPRESSÃO jsonb direto com GIN.
create index concurrently if not exists registros_tag_ids_idx
  on plataforma.registros using gin ((dados->'tagIds') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso: where dados->'tagIds' @> '["tag_conta_tria"]'::jsonb

create index concurrently if not exists registros_assignees_idx
  on plataforma.registros using gin ((dados->'assignees') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso: where dados->'assignees' @> '[{"id":"mem_marcos_paulo"}]'::jsonb

create index concurrently if not exists registros_field_values_idx
  on plataforma.registros using gin ((dados->'fieldValues') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso (Pessoa, fd_cp_pessoa): where dados->'fieldValues' @> '[{"definitionId":"fd_cp_pessoa","value":"mem_x"}]'::jsonb
```
**Notas técnicas confirmadas nesta pesquisa:**
- Uma coluna gerada não pode referenciar outra coluna gerada, só a linha atual e funções imutáveis [CITED: postgresql.org/docs/current/ddl-generated-columns.html].
- `jsonb_path_ops` é a escolha certa para filtros de contenção (`@>`) — índice 20–30% do tamanho de `jsonb_ops` e mais rápido para esse uso; só usar `jsonb_ops` (o default) se também precisar do operador `?` (existência de chave) [CITED: pganalyze.com/blog/gin-index; comparação cruzada com Medium/Josef Machytka — dois fontes convergentes → MEDIUM/HIGH].
- `create index concurrently` evita lock de escrita na tabela `plataforma.registros` durante a migração — relevante porque a tabela pode já ter dados reais da Maryane quando a migração `002` rodar (a Fase 1 já terá produzido escritas reais antes de PERS-07 ser aplicado, dependendo da ordem de execução dos planos).
- `Id do campo Pessoa confirmado no código: `CP.fields.pessoa = "fd_cp_pessoa"` [VERIFIED: packages/dominio/src/operations/financeiro.ts].

### 5. `structuredClone` do `DataState` — custo esperado
```typescript
// apps/web/src/dados/store.ts — medir uma vez em dev, não a cada PR
const antes = performance.now();
const copia = structuredClone(data); // ~475 KB / ~906 registros
console.log(`clone: ${(performance.now() - antes).toFixed(2)}ms`);
```
Não há benchmark oficial publicado especificamente para este payload; a literatura consultada [CITED: múltiplos benchmarks MeasureThat.net + nodejs/node#50320] converge em: `structuredClone` tem overhead fixo pequeno de cruzar para C++, amortizado em objetos deste porte, e é a opção recomendada sobre `JSON.parse(JSON.stringify())` por preservar `undefined` em campos opcionais (existe no `DataState` — `dueDate?`, `photoFileId?` etc.) e não exigir dependência externa. Medir localmente antes de aceitar como "resolvido" — está listado como MEDIUM confidence, não HIGH, porque nenhuma fonte testou exatamente este payload.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Verificar JWT do Supabase com o `JWT_SECRET` simétrico (HS256) compartilhado | Chaves assimétricas (ES256/RS256) publicadas via JWKS (`/auth/v1/.well-known/jwks.json`), sem precisar distribuir segredo nenhum ao backend | Migração ativa em todos os projetos Supabase desde 2025 [CITED: supabase.com/docs/guides/auth/signing-keys] | O backend nunca guarda um segredo compartilhado — só confia numa chave pública que ele próprio busca e cacheia; reduz superfície de vazamento. O projeto já usa as chaves novas (`sb_publishable_…`/`sb_secret_…`, confirmado em `apps/api/.env.example` referenciado por `STACK.md`), então a verificação deve ser feita pelo caminho assimétrico desde o início — não há HS256 legado a suportar aqui. |
| Pacote `fastify-type-provider-zod` sem escopo | `@fastify/type-provider-zod` com escopo oficial, mesmo repositório GitHub | v1.0.0 publicado 2026-04/08 [VERIFIED: npm registry] | Ver "Nota de nomenclatura" no Summary — usar o novo. |
| `JSON.parse(JSON.stringify(x))` como deep clone default em JS | `structuredClone(x)` nativo (Node ≥ 17, browsers modernos) | Amplamente disponível desde 2022; agora é a recomendação padrão | Menos bug de silenciosamente perder `undefined`/`Date`; zero dependência. |

**Deprecated/outdated:**
- `JWT_SECRET` simétrico como único mecanismo de verificação: ainda funciona (retrocompatibilidade), mas não é o caminho recomendado para projetos novos como este.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Não existe um jeito nativo de "buscar Usuário do Supabase Auth por e-mail" sem paginar `admin.listUsers()` e filtrar em memória, na versão `@supabase/supabase-js` 2.116.0 já usada pelo projeto | Common Pitfalls — Pitfall 5 | Se existir um `filter`/`email` param direto (algumas versões recentes da Admin API adicionaram isso), o serviço de reconvite fica mais simples do que o desenhado aqui; verificar a assinatura exata de `admin.listUsers()` na versão instalada antes de codar PERS-09. |
| A2 | `TaskDate.value` de `dueDate` em Tarefas da Lista "Contas a pagar" é sempre `form: "civilDay"` (nunca `"instant"`), o que torna segura a comparação textual/ISO na coluna gerada `due_date` | Code Examples #4 | Se alguma Tarefa usar `form: "instant"` para `dueDate`, a ordenação textual ainda funciona (ambos formatos são ISO 8601 crescente), mas uma conversão para tipo `date` nativo precisaria tratar os dois formatos separadamente — só relevante se o planejador decidir tipar a coluna como `date` em vez de `text`. |
| A3 | `concurrently` é preferível a `npm-run-all2` só por volume de download/familiaridade — não há um motivo técnico forte que desempate | Standard Stack — Supporting | Baixo risco: ambos resolvem o problema; se o time já usa `npm-run-all2` em outro projeto, trocar por consistência não custa nada. |

**Se esta tabela estivesse vazia** não seria o caso aqui — três suposições specificamente na área de reconvite (a mais nova/menos batida do domínio) e tipagem de data.

## Open Questions

1. **Como exatamente resolver "e-mail → Usuário existente do Supabase Auth" para o reconvite (PERS-09)?**
   - What we know: a Admin API tem `inviteUserByEmail` (cria Usuário novo + manda e-mail) e `admin.listUsers()` (paginado); o domínio precisa de um `userId` para casar o Membro `removido` certo.
   - What's unclear: se `inviteUserByEmail` falha graciosamente (com um erro identificável) quando o e-mail já tem conta, isso serviria como sinal "usuário já existe, pula a criação, resolve o id pelo erro" — não verificado nesta pesquisa. Alternativa: pré-checar via `listUsers()` filtrado.
   - Recommendation: o planejador deve tratar isso como uma tarefa própria com teste de integração real contra o Supabase Auth do projeto (não só teste de domínio simulando o `userId`), porque a peça arriscada é exatamente a integração com a Admin API, não a regra de negócio (que já existe em `inviteMember`).

2. **Qual é a assinatura exata de `run()` depois de PERS-05?**
   - What we know: hoje `run<T>(operation: (data, memberId) => OperationResult<T>)`; a rota genérica (Pattern 1) espera `POST /operacoes/:nome` com um `nome` de string.
   - What's unclear: se `run()` continua recebendo uma função (e daí precisa de um jeito de extrair o "nome" da operação para montar a URL — ex.: `operation.name` do JS, que funciona se as funções exportadas de `packages/dominio/src/operations/*` não forem anônimas) ou se muda para `run(nomeDaOperacao, entrada)`, o que quebra a API pública que D-05/PERS-05 promete manter estável ("os cem arquivos que consomem não sabem de onde o store vem").
   - Recommendation: checar se `operation.name` (nome da função JS) bate 1:1 com as chaves de `OPERACOES_PERMITIDAS` no backend antes de decidir — se bater, `run()` não muda de assinatura nenhuma e o nome vai extraído via `operation.name`; isso preserva literalmente a API pública do store, que é o critério mais forte do CONTEXT.md.

3. **O bootstrap de PERS-06 pode ser reexecutado depois que a Maryane já tiver dados reais?**
   - What we know: `semear()` só grava em Espaço vazio hoje (é usado para seed completo); D-06/PERS-06 discretion deixa "idempotência do bootstrap" em aberto.
   - What's unclear: se o caso de uso é "rodar uma vez, nunca mais" (mais simples) ou "reaplicar config sem tocar em Tarefas reais" (mais seguro para iteração, mas exige usar `gravar()` em vez de `semear()`, filtrando por coleções de config).
   - Recommendation: rodar uma vez só é suficiente para o critério de pronto desta fase ("Membro real cria uma Conta pela tela") — não gold-plate a idempotência de re-execução a menos que o planejador preveja iterar no bootstrap depois do primeiro uso real.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Todo o monorepo | ✓ | v26.5.0 [VERIFIED: `node --version` local] | — |
| npm (workspaces) | Build/scripts | ✓ | 11.17.0 [VERIFIED: `npm --version` local] | — |
| PostgreSQL local | Testes de integração de `apps/api` sem depender de rede | ✗ (`psql` não encontrado nesta máquina) | — | Testes de persistência pulam sem `DATABASE_URL` (D-DEC-09) — não bloqueia `npm run check`; rodar contra o Supabase remoto (`epomplsskqpluxuujpxl`) exige `DATABASE_URL` configurada em `apps/api/.env` (git-ignored, não lido nesta sessão por restrição de permissão do ambiente). |
| `DATABASE_URL` (env) | `apps/api/src/persistencia/conexao.ts` | Não verificável nesta sessão (arquivo `.env` bloqueado por permissão do ambiente de pesquisa) | — | Assumir que já está configurado, dado que `d713253`/`b20597d` foram commitados com testes passando contra Supabase real (conforme `STATE.md`/`ARCHITECTURE.md`). |
| Supabase Auth (chaves novas `sb_publishable_…`/`sb_secret_…`) | PERS-02 (feito), hook de autenticação novo do `apps/api` | Presumivelmente ✓ (login já funciona em `apps/web`, conforme commit `d713253`) | — | — |

**Missing dependencies with no fallback:** nenhuma — tudo que falta tem fallback (skip de teste, ou depende de configuração já existente fora do alcance de leitura desta sessão).

**Missing dependencies with fallback:** PostgreSQL local (fallback: testes pulam / rodar contra Supabase remoto).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 (`apps/api`, `apps/web`, `packages/dominio`) [VERIFIED: apps/api/package.json, apps/web/package.json] |
| Config file | `apps/api/vitest.config.mts` (`testTimeout: 60_000`, `hookTimeout: 60_000` — já ajustado para Postgres); `apps/web/vitest.config.mts` |
| Quick run command | `npm run test -w @n1/api -- --reporter=verbose` / `npm run test -w @n1/web -- <arquivo>` |
| Full suite command | `npm run check` (typecheck + lint + tokens + test nos três workspaces) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-04 | `POST /operacoes/:nome` roda a operação na Unidade de Trabalho e devolve `OperationResult` | integration (Fastify `app.inject`, sem rede real) | `npm run test -w @n1/api -- rotas/operacoes.test.ts` | ❌ Wave 0 — arquivo não existe |
| PERS-04 | Rota recusa sem `Authorization` (401) e com Membro sem acesso (403) | integration (`app.inject`) | `npm run test -w @n1/api -- plugins/autenticacao.test.ts` | ❌ Wave 0 |
| PERS-05 | `run()` clona, roda local, só grava no store depois da resposta do `POST` | unit (mock de `fetch`) | `npm run test -w @n1/web -- dados/store.test.ts` | ❌ Wave 0 — não existe teste de `store.ts` hoje |
| PERS-05 | Recusa do domínio nunca dispara `fetch` (D-05) | unit (spy em `global.fetch`) | mesmo arquivo acima | ❌ Wave 0 |
| PERS-06 | Bootstrap roda sobre Espaço vazio e materializa Lista "Contas a pagar" sem Tarefas | integration (Postgres real, pula sem `DATABASE_URL`) | `npm run test -w @n1/api -- bootstrap/gestao.test.ts` | ❌ Wave 0 |
| PERS-07 | Filtro por `status_id`, `due_date`, `tagIds`, `assignees`, campo Pessoa usa os índices criados | integration (Postgres real, `explain` opcional) | `npm run test -w @n1/api -- persistencia/colunas-geradas.test.ts` | ❌ Wave 0 |
| PERS-09 | Reconvidar um Usuário removido reativa o mesmo Membro (não cria um segundo) | unit no domínio (já existe estrutura) + integration (resolução de e-mail real) | `npm run test -w @n1/dominio -- operations/members.test.ts -t "reconvit"` + `npm run test -w @n1/api -- autenticacao/resolver-usuario.test.ts` | Parcial — `members.ts` já tem testes de `inviteMember`, mas não do caso `userId`; arquivo de integração do resolver não existe |
| Critério de sucesso 1 (ROADMAP) | "Membro real cria uma Conta pela tela e, ao recarregar, continua lá" sem browser | integration ponta a ponta: `app.inject POST /operacoes/createTask` → `app.inject GET /estado` → assert a Tarefa aparece | `npm run test -w @n1/api -- e2e/criar-conta.test.ts` | ❌ Wave 0 — é exatamente a lacuna que `STATE.md`/`CONCERNS.md` já apontam ("sem teste ponta a ponta tela → Postgres") |

### Sampling Rate
- **Per task commit:** `npm run test -w @n1/api` (ou `-w @n1/web`, conforme o arquivo tocado) + `npm run typecheck -w <workspace>`
- **Per wave merge:** `npm run check` (os três workspaces, sempre — CON-05/D-DEC-09)
- **Phase gate:** `npm run check` verde + prova hidratado ≡ seed contra Supabase real antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/app.ts` — separar montagem do app de `listen()`, pré-requisito de todo teste `app.inject`
- [ ] `apps/api/src/rotas/operacoes.test.ts` — cobre PERS-04
- [ ] `apps/api/src/plugins/autenticacao.test.ts` — cobre D-02/PERS-04 (401/403)
- [ ] `apps/web/src/dados/store.test.ts` — cobre PERS-05 (não existe teste de `store.ts` hoje; é código novo de UI state, então precisa mock de `fetch`)
- [ ] `apps/api/src/bootstrap/gestao.test.ts` — cobre PERS-06
- [ ] `apps/api/src/persistencia/colunas-geradas.test.ts` — cobre PERS-07 (pode reaproveitar o padrão `temBanco ? describe : describe.skip` de `persistencia.test.ts`)
- [ ] `apps/api/src/e2e/criar-conta.test.ts` — fecha a lacuna "sem teste ponta a ponta tela → Postgres" citada em `STATE.md`/`CONCERNS.md`; é o teste que prova o critério de sucesso 1 do ROADMAP sem precisar de Playwright/browser real (Fastify `inject` simula a rota completa)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (e-mail + senha, já implementado em PERS-02); `apps/api` verifica o mesmo JWT via `getClaims()` — não reimplementa autenticação. |
| V3 Session Management | yes | Sessão vive em cookie httpOnly gerenciado por `@supabase/ssr` no browser (já implementado); `apps/api` é stateless — o "Bearer" por requisição não é uma sessão nova, é o mesmo token repassado. |
| V4 Access Control | yes | Resolução `Member.userId === sub` + checagem de `state` (`ativo`/`suspenso` passam, `removido`/`pendente` não) no hook de autenticação (Pattern 2), replicando a mesma regra que `SessaoProvider` já aplica no front — a diferença é que agora o backend TAMBÉM aplica (hoje só o front barra, o que não é controle de acesso real). |
| V5 Input Validation | yes | `zod` na borda de cada rota (`params`, `body`) via `@fastify/type-provider-zod`, antes de a `entrada` chegar em qualquer operação do domínio. |
| V6 Cryptography | yes (mas terceirizada) | Verificação de assinatura ES256/RS256 fica inteiramente a cargo de `supabase.auth.getClaims()`/JWKS — nenhum código deste projeto implementa criptografia. |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token roubado/replay entre Espaços de Trabalho (um Membro de outro workspace tenta agir aqui) | Spoofing / Elevation of Privilege | Resolver Membro sempre por `userId === sub` **dentro do `workspaceId` da rota** (hoje só existe um Espaço, "Gestão" — mas o hook não deve assumir isso implicitamente; passar o `workspaceId` explícito evita a regra quebrar quando a Fase 2+ trouxer mais Espaços). |
| CORS aberto (`origin: "*"`) permitindo qualquer site chamar `apps/api` com o token de um usuário logado em outra aba | Tampering / Information Disclosure | `@fastify/cors` com `origin` como allowlist explícita do domínio de `apps/web` (Pattern/Code Example #1) — nunca `*` numa API que aceita `Authorization: Bearer`. |
| `rejectUnauthorized: false` na conexão TLS com o Postgres do Supabase (já existe, documentado em `conexao.ts` e em `STATE.md` como risco conhecido) | Tampering (man-in-the-middle na conexão DB) | Fora do escopo de código desta fase (é PERS-08/D11 — "fixar a CA do Supabase antes de o `apps/api` ir para a VPS", já registrado em `STATE.md` Blockers/Concerns); a pesquisa só reforça que não é um risco introduzido por PERS-04..09, é preexistente. |
| Rota `/operacoes/:nome` aceitando qualquer string como nome e tentando `require`/`eval` dinâmico | Injection | Pattern 1 usa um mapa explícito (`OPERACOES_PERMITIDAS`), nunca resolução dinâmica de módulo por string — mesma disciplina de `packages/dominio/src/colecoes.ts`. |

## Sources

### Primary (HIGH confidence)
- `apps/api/src/persistencia/*.ts`, `apps/api/src/autenticacao/criar-usuarios-do-seed.ts`, `apps/web/src/dados/store.ts`, `apps/web/src/autenticacao/*.ts`, `apps/web/src/proxy.ts`, `apps/web/src/dados/sessao-provider.tsx`, `apps/web/src/app/(shell)/layout.tsx`, `packages/dominio/src/{colecoes,usuarios-do-seed,types/workspace,types/structure,types/primitives,operations/members,operations/financeiro,seed-financeiro,seed-contas-a-receber,seed}.ts`, `apps/api/migracoes/001-plataforma.sql` — lidos diretamente nesta sessão.
- `docs/08-migracao-financeiro/04-spike-persistencia.md` (o ADR) — lido integralmente.
- `docs/07-processos/contas-a-pagar.md` §2–§5 — lido para os campos filtrados por PERS-07.
- `npm view` (fastify, @fastify/type-provider-zod, @fastify/cors, jose, @supabase/supabase-js, concurrently, npm-run-all2, vite-node) — executado nesta sessão, 2026-09-16.
- `npx vite-node -h` — executado localmente, confirma `-w, --watch`.

### Secondary (MEDIUM confidence)
- [Type Providers — Fastify latest](https://fastify.dev/docs/latest/Reference/Type-Providers/) — WebFetch, confirma `@fastify/type-provider-zod` como pacote oficial.
- [Supabase — JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) — WebFetch, JWKS endpoint e formato de chave.
- [Supabase — JavaScript: getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) — WebSearch, assinatura e uso stateless.
- [Supabase — JSON Web Token (JWT)](https://supabase.com/docs/guides/auth/jwts) — WebSearch, claims (`iss`, `aud`, `sub`, `role`, `email`).
- [Fastify — Errors reference](https://fastify.dev/docs/latest/Reference/Errors/) — WebSearch, `setErrorHandler`.
- [Fastify — Testing guide](https://fastify.dev/docs/v5.8.x/Guides/Testing/) — WebSearch, `app.inject`.
- [pganalyze — Understanding Postgres GIN Indexes](https://pganalyze.com/blog/gin-index) — WebSearch, `jsonb_ops` vs `jsonb_path_ops`.
- [PostgreSQL 18 docs — Generated Columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html) — WebSearch, restrição de encadeamento.
- [@fastify/cors — npm](https://www.npmjs.com/package/@fastify/cors) — WebSearch, opções de registro.

### Tertiary (LOW confidence — sinalizado para validação)
- Benchmarks de `structuredClone` vs `JSON.parse/stringify` (MeasureThat.net, múltiplos) — nenhum testa o payload exato deste projeto; usar como direção, medir localmente antes de tratar como resolvido.
- Existência (ou não) de filtro por e-mail em `admin.listUsers()` na versão instalada do `@supabase/supabase-js` — não verificado, listado em Assumptions Log A1.
- Comportamento de `inviteUserByEmail` quando o e-mail já tem conta Auth — não verificado, listado em Open Questions #1.

## Metadata

**Confidence breakdown:**
- Standard stack (Fastify + zod + cors): HIGH — versões confirmadas via `npm view` e cruzadas com a doc oficial atual do Fastify.
- Autenticação (Supabase JWT): MEDIUM-HIGH — `getClaims()` e o endpoint JWKS confirmados por doc oficial; o comportamento exato de `admin.listUsers()`/`inviteUserByEmail` para reconvite (PERS-09) fica em LOW, documentado nas Assumptions.
- PERS-07 (colunas geradas/índices): HIGH para a mecânica SQL (documentação oficial do Postgres); MEDIUM para a escolha exata `text` vs `date` na coluna `due_date` (depende de confirmar que `dueDate` de Conta é sempre `civilDay`, não verificado no dado real).
- PERS-05 (diff no cliente): MEDIUM — o padrão geral (clonar, rodar, aplicar diff) é sólido e vem de D-05/D-03 já travados; o formato exato da resposta HTTP e a assinatura final de `run()` ficam para o planejador (Open Questions #2).
- PERS-06 (bootstrap): MEDIUM — a necessidade de separar config de fixture dentro de `seed-financeiro.ts` é uma leitura direta do código, mas o desenho exato da refatoração é decisão de planejamento, não pesquisa.
- PERS-09 (reconvite): MEDIUM-LOW — a lacuna arquitetural (falta uma ponte e-mail→userId) está bem identificada; a solução exata depende de comportamento não verificado da Supabase Admin API.

**Research date:** 2026-09-16
**Valid until:** ~30 dias para a mecânica Postgres/Fastify (estável); ~14 dias para os detalhes de versão de pacote npm e do fluxo Supabase Auth (ecossistema em migração ativa de chaves simétricas → assimétricas).
