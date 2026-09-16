# Phase 0: Preparação - Research

**Researched:** 2026-09-16
**Domain:** Exportação da API do ClickUp v2 (paginação, custom fields, histórico), design de script idempotente em Node/TypeScript, de-para de identidade para `inviteMember`, e a forma de um SPEC de processo lido de dados reais.
**Confidence:** MEDIUM — a mecânica da API do ClickUp está bem documentada (MEDIUM/HIGH); a ausência de um endpoint de histórico completo é o achado mais importante e muda o desenho de PREP-02/PREP-03; os 38 nomes de variáveis `CLICKUP_*` não puderam ser enumerados aqui (fora deste monorepo) — ver Open Questions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Exportação do ClickUp (PREP-02)**
- **D-01:** O exportador vive no monorepo, em `apps/api/src/importacao/clickup/`, ao lado do futuro importador das Fases 2/3. `CLICKUP_API_TOKEN` só no `.env` do `apps/api` (via `carregarEnv()`), documentado em `.env.example`. Entra no `npm run check`. O `automation/` do financeiro-tria não muda (D-DEC-11).
- **D-02:** Os dados exportados ficam fora do git, numa pasta ignorada (ex.: `apps/api/exportacoes/clickup/`, entrada no `.gitignore`). No repositório entra só um manifesto commitado: data da exportação, contagens por Lista e por recurso, hashes dos arquivos. O manifesto é a prova de paridade (CON-09) sem expor CPF/CNPJ, dados bancários e NFs que vivem em comentários e anexos.
- **D-03:** Formato: JSON bruto da API do ClickUp, sem transformar — um arquivo por recurso e por página. O mapper nasce na importação, não aqui. Nenhum índice normalizado nesta fase.
- **D-04:** Anexos são baixados agora, para a mesma pasta fora do git, nomeados por `<task id>/<attachment id>-<nome original>`, com hash no manifesto. Motivo: as URLs do ClickUp podem deixar de valer quando a Lista for arquivada.

**Spec da Solicitação de pagamento (PREP-03)**
- **D-05:** Fonte da verdade: a exportação real da Lista `901109104938` + o código do `automation/` (`payment-rules.ts`, `clickup-payment-mapper.ts`, prompts). Claude rascunha `docs/07-processos/solicitacao-de-pagamento.md` no padrão de `contas-a-pagar.md` (mesmas seções §1–§12), marcando explicitamente o que os dados não mostram. PREP-02 vem antes de PREP-03.
- **D-06 (fecha D6):** A Solicitação vive numa Lista própria, com Vínculo Solicitação → Conta a pagar.
- **D-07 (fecha D8):** Aprovação por clique é o caminho oficial. Classificador de comentário por IA fica como fallback por 90 dias, medido.
- **D-08 (OQ-CMP-01/02/04):** A spec absorve e decide pelo que a exportação mostrar: `Cartão`/`Link de pagamento` como opções se a Lista real os usa; `em revisão` como Status se aparece no histórico; validação de CPF/CNPJ fica no `automation/` — a spec diz onde roda, não reimplementa. O que não aparecer vai para §12.

**De-para de usuários (PREP-04)**
- **D-09:** O de-para mapeia ClickUp user ID → e-mail (identidade) + Papel esperado, resolvido **na importação** (Fases 2/3): o e-mail vira Membro por `inviteMember`. Não exige Membros existirem agora.
- **D-10:** Mora em `apps/api/src/importacao/clickup/de-para-usuarios.ts` — tipado, ao lado do exportador; entra no typecheck; com teste.
- **D-11:** Os 6 e-mails reais ficam no arquivo versionado (Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`, revisor FO `81581802`). Nada de senha, token ou credencial.
- **D-12:** Autores fora dos 6: o exportador lista todos os user ids encontrados (Tarefas, comentários, histórico) com contagem; quem não está no de-para vira, na importação, Ator `sistema` / origem `clickup` preservando o nome original — nenhum Membro fantasma. As 38 variáveis `CLICKUP_*` são catalogadas no mesmo arquivo (id, uso); só as que são ids de usuário entram no de-para.

**Credenciais Omie (PREP-05)**
- **D-13:** Não rotacionar. As credenciais Omie atuais continuam em uso — decisão do dono em 2026-09-16. PREP-05 e o critério 4 do ROADMAP da Fase 0 devem ser marcados como "risco aceito pelo dono", não pendentes. CON-10 continua valendo para o que a plataforma cria.

### Claude's Discretion
- Nome exato da pasta fora do git e do script (`npm run exportar:clickup -w @n1/api`, no padrão de `migrar` / `bootstrap:gestao` com `vite-node`).
- Formato do manifesto (JSON vs. markdown), granularidade dos hashes (por arquivo), e se o manifesto guarda o `date_updated` mais recente por Lista para permitir re-exportação incremental depois.
- Paginação, rate limit (100 req/min no ClickUp) e retomada de exportação interrompida.
- Como catalogar as 38 `CLICKUP_*` (tabela no mesmo arquivo TS vs. arquivo irmão).
- Se a Lista de Contas a receber (`901107648977`, dormente desde out/2025) é exportada com o mesmo cuidado de anexos ou só Tarefas + campos + histórico.
- Ordem entre PREP-02 e PREP-04 (independentes); PREP-03 depende de PREP-02.

### Deferred Ideas (OUT OF SCOPE)
- Rotação das credenciais Omie — retirada por D-13.
- Limpeza do histórico do git do `financeiro-tria` — não discutida.
- Índice normalizado por Lista (CSV/JSON achatado) — descartado em D-03.
- Supabase Storage para a exportação — descartado em D-02.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREP-01 | Schema `plataforma` criado — **já feito** (`b20597d`) | N/A — nada a planejar |
| PREP-02 | Exportação completa das 3 Listas (Tarefas, Campos, Comentários, histórico de status, anexos, paginação) | Seção "ClickUp API v2 — fatos verificados", "Pitfalls", "Code Examples", "Architecture Patterns" — cobre paginação exata de `/list/{id}/task` e `/task/{id}/comment`, rate limit, formas de valor de custom field, e a ausência de endpoint de histórico completo (decide o desenho de D-02/D-03 para o recurso "histórico de status") |
| PREP-03 | `docs/07-processos/solicitacao-de-pagamento.md` no padrão `contas-a-pagar.md`, lida da Lista real | Seção "O molde de `contas-a-pagar.md`" — decompõe as 12 seções e de onde cada uma se alimenta da exportação; depende de PREP-02 estar completo, inclusive o achado sobre histórico |
| PREP-04 | De-para dos 6 IDs de usuário do ClickUp → Membros + 38 `CLICKUP_*` | Seção "De-para de usuários" — forma exata que `inviteMember` espera, quais `roleId` existem de fato no bootstrap de produção, e o caso especial do Financeiro (`81581816` = Maryane, já Membro) |
| PREP-05 | Rotação Omie — **retirado por D-13** | Nenhuma pesquisa técnica necessária; apenas atualizar REQUIREMENTS.md/ROADMAP.md para "risco aceito pelo dono" (ver Open Questions) |
| PREP-06 | Volume do legado medido — **já feito** (2026-09-15) | N/A |
</phase_requirements>

## Summary

O trabalho técnico real desta fase é escrever um exportador ClickUp e um de-para de identidade — os dois em TypeScript, no mesmo padrão de scripts `vite-node` que `apps/api` já usa (`migrar.cli.ts`, `gestao.cli.ts`). Nenhuma biblioteca nova precisa entrar: `fetch` nativo do Node 20+ cobre as chamadas HTTP, `zod` (já dependência do `apps/api`) tipa as respostas e o de-para, e `node:crypto` cobre os hashes do manifesto. O risco técnico não é de stack — é de **paginação e de um endpoint que não existe**: a API pública do ClickUp v2 não expõe histórico cronológico de mudança de status (confirmado na página oficial de feedback de produto, `feedback.clickup.com/public-api/p/get-task-history` — "esta funcionalidade já existe internamente, mas não é exposta via API pública"). O único proxy disponível é `GET /task/{id}/time_in_status`, que devolve tempo acumulado por status (`total_time.by_minute` + `since`), não uma lista de eventos — reconstrói transições razoavelmente bem só quando a Tarefa passa por cada status uma vez (sem voltar), e depende do ClickApp "Total time in Status" estar habilitado no Workspace. Isso importa porque `contas-a-pagar.md` (o molde que PREP-03 deve seguir) tem uma seção "Transições observadas no histórico" com deltas de horas — ela foi escrita assim porque alguém leu Comentários + a sequência de valores de `date_updated`/`time_in_status` de tarefas específicas, não porque existe um endpoint de auditoria. A exportação de PREP-02 deve gravar `time_in_status` por Tarefa (best-effort) e deixar explícito no manifesto que esse recurso é aproximado, não uma trilha de auditoria.

A segunda descoberta com peso no planejamento é sobre PREP-04: o usuário ClickUp "Financeiro" (`81581816`, "Contas a Pagar") é a mesma pessoa que já é `mem_maryane` na plataforma — mas o Membro de produção (`bootstrapGestao()`) hoje tem `email = emailDoSeed("mem_maryane")`, um e-mail de teste (`@n1.teste`), não o e-mail corporativo real dela (D-09 da Fase 1: "e-mail de teste por enquanto"). O de-para desta fase precisa registrar essa colisão como um caso especial: quando o e-mail real da Maryane substituir o de teste, `inviteMember` vai encontrar (ou não) o Membro certo dependendo de qual e-mail for usado — é um ponto que a spec do de-para deve deixar aberto e sinalizado, não resolver aqui (a resolução é da importação, Fases 2/3, por D-09 desta fase).

**Primary recommendation:** Escrever o exportador como um pipeline "uma função por recurso, um arquivo por página", com um cliente HTTP fino que faz backoff em 429 usando `X-RateLimit-Reset`; gravar `time_in_status` por Tarefa como recurso adicional (não pedido explicitamente em PREP-02, mas é o único substituto parcial de histórico e o D-05 da spec depende dele); e no de-para, tipar a entrada com um campo opcional `memberIdConhecido` para cobrir o caso Maryane/Financeiro sem forçar todos os 6 pelo mesmo molde de "convite novo".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Exportação da API do ClickUp (leitura, paginação, download de anexos) | `apps/api` (script CLI, fora do request/response) | — | É I/O externo que só o backend deve fazer (D-01); não é uma rota HTTP, é um script batch — mesmo tier de `migrar.cli.ts`/`gestao.cli.ts` |
| Armazenamento dos dados exportados (JSON bruto + anexos) | Filesystem local (`apps/api/exportacoes/`, fora do git) | — | D-02: nenhum dado pessoal/financeiro no repositório; não é responsabilidade do schema `plataforma` (isso é da importação, Fases 2/3) |
| Manifesto de paridade (contagens + hashes) | `apps/api` (gerado pelo script), versionado no repo | Documentação (`docs/`) | É prova de auditoria, não dado operacional — cabe como artefato committed pequeno, não como tabela de banco |
| Spec do processo (`solicitacao-de-pagamento.md`) | Documentação (`docs/07-processos/`) | — | Não é código executável; é o contrato lido por humanos e pela Fase 2 para desenhar a Lista/Campos/Automações reais |
| De-para de usuários (ClickUp ID → e-mail + Papel) | `apps/api/src/importacao/clickup/` (módulo TypeScript tipado) | `packages/dominio` (consome via `inviteMember`, mas não o possui) | O de-para é dado de infraestrutura de importação, não regra de negócio do domínio — mora ao lado do exportador (D-10), e é chamado pelo futuro importador, nunca o contrário |
| Resolução de identidade (e-mail → Membro/Papel real) | `apps/api` (na importação, Fases 2/3) | `packages/dominio` (`inviteMember`, puro) | Mesma separação já estabelecida em `convidarMembro`/`resolverUsuarioPorEmail`: I/O de identidade fica no serviço do backend, a regra de negócio pura fica no domínio |
| Credenciais (`CLICKUP_API_TOKEN`) | `apps/api/.env` (via `carregarEnv()`) | — | Mesmo padrão de `DATABASE_URL`/`SUPABASE_SECRET_KEY`; nunca no `apps/web`, nunca commitado |

## Standard Stack

Nenhuma dependência nova precisa entrar em `package.json`. O exportador e o de-para reaproveitam o que `apps/api` já tem:

### Core
| Ferramenta | Versão (já no monorepo) | Propósito | Por que já é o padrão aqui |
|---|---|---|---|
| `fetch` nativo do Node | Node 24 (`.nvmrc`/engines do monorepo; confirmado `node --version` = v26.5.0 no ambiente de dev, mas o runtime mínimo do projeto não exige biblioteca HTTP externa) | Chamadas à API do ClickUp | `apps/api` não usa `axios`/`node-fetch`; introduzir um cliente HTTP novo só para 6 endpoints é hand-roll desnecessário quando `fetch` global já cobre headers, JSON e streaming de download de anexos |
| `zod` | `^4.6.5` (já em `apps/api/package.json`) | Tipar as respostas da API (defensivamente, sem travar a exportação se um campo novo aparecer) e tipar `de-para-usuarios.ts` | Já é a ferramenta de validação do resto do `apps/api` (schemas de `POST /operacoes/:nome`) |
| `node:crypto` (`createHash("sha256")`) | builtin | Hash de cada arquivo exportado para o manifesto | D-02 pede hashes; nenhuma lib de checksum é necessária |
| `node:fs/promises` | builtin | Gravação incremental de arquivos por página/recurso | Mesmo padrão de `carregarEnv()` (leitura síncrona simples, sem dependência) |
| `vite-node` | `^6.0.0` (já dev dependency) | Rodar o script como `npm run exportar:clickup -w @n1/api` | Mesmo padrão de `migrar`, `usuarios:seed`, `bootstrap:gestao` |

### Supporting
| Ferramenta | Versão | Propósito | Quando usar |
|---|---|---|---|
| `vitest` | `^5.0.0` (já dev dependency) | Testes do parser do manifesto, do de-para e da lógica de paginação contra fixtures gravadas | Já é o runner de todo o monorepo; testes de integração reais (contra a API do ClickUp) pulam sem `CLICKUP_API_TOKEN`, no mesmo padrão de `DATABASE_URL` (D-DEC-09) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch` nativo + loop manual de paginação | SDK oficial/comunitário do ClickUp (`clickup.js`, `clickup-api-ts` etc.) | Um SDK de terceiros para 6-7 chamadas é peso e superfície de confiança extra (ver Package Legitimacy Audit) para algo que 100 linhas de `fetch` resolvem; D-03 já pede o JSON bruto sem transformação, o que um SDK tende a atrapalhar (ele normalmente desserializa para um formato próprio) |
| Backoff manual em 429 | Biblioteca de retry (`p-retry`, `async-retry`) | Aceitável se o time preferir, mas o backoff aqui é de um caso só (429 com `X-RateLimit-Reset` conhecido) — não é hand-roll de retry genérico, é uma função de 10 linhas |

**Installation:** nenhuma — todas as ferramentas já estão instaladas em `apps/api`. Se o planejador decidir por um SDK do ClickUp mesmo assim, ver Package Legitimacy Audit abaixo antes de recomendar um nome específico.

**Version verification:** não aplicável — nenhum pacote novo.

## Package Legitimacy Audit

**Não aplicável nesta fase.** PREP-02 e PREP-04 não precisam de nenhum pacote novo no `package.json` — `fetch`, `zod`, `node:crypto` e `node:fs/promises` já estão disponíveis em `apps/api` (ver Standard Stack). Se durante o planejamento ou execução surgir a tentação de instalar um SDK de terceiros para o ClickUp (ex.: um pacote npm chamado algo como `clickup.js` ou `node-clickup`), ele **deve** passar pelo Package Legitimacy Gate antes de entrar — nomes de SDK de APIs de nicho são um vetor conhecido de "slopsquatting" e nenhum nome de pacote foi verificado nesta pesquisa (não há necessidade, dado que a recomendação é não usar SDK).

**Packages removed due to [SLOP] verdict:** nenhum — nenhum pacote foi avaliado, pois nenhum é recomendado.
**Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```text
                         ┌─────────────────────────────┐
                         │   ClickUp API v2 (externa)   │
                         │  api.clickup.com/api/v2/...  │
                         └───────────────┬──────────────┘
                                         │ HTTPS + Authorization: <token>
                                         │ (fetch nativo, 1 req por vez,
                                         │  backoff em 429 por X-RateLimit-Reset)
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  apps/api/src/importacao/clickup/         │
                    │  exportar.cli.ts (vite-node, script CLI)  │
                    │                                            │
                    │  1. listar Listas (fixas: 3 ids)          │
                    │  2. paginar /list/{id}/field  (Campos)    │
                    │  3. paginar /list/{id}/member (Membros)   │
                    │  4. paginar /list/{id}/task               │
                    │     (page=0,1,2… até last_page=true;      │
                    │      include_closed=true, archived=true,  │
                    │      subtasks=true)                       │
                    │  5. para cada task: /task/{id}/comment    │
                    │     (paginar por start/start_id)          │
                    │  6. para cada task: /task/{id}/time_in_status │
                    │     (best-effort — 400 se ClickApp        │
                    │      desligado; grava erro, não aborta)   │
                    │  7. para cada attachment na task:         │
                    │     baixar bytes de attachment.url        │
                    │  8. coletar todo user id visto (assignee, │
                    │     watcher, autor de comentário) → tabela│
                    │     de contagem                           │
                    └───────────────┬────────────────────────────┘
                                    │ grava, 1 arquivo por recurso/página
                                    ▼
              ┌───────────────────────────────────────────────┐
              │  apps/api/exportacoes/clickup/  (fora do git)  │
              │  <lista_id>/tasks/page-0.json, page-1.json...  │
              │  <lista_id>/fields.json                        │
              │  <lista_id>/members.json                       │
              │  <lista_id>/comments/<task_id>/page-0.json     │
              │  <lista_id>/time-in-status/<task_id>.json      │
              │  <lista_id>/attachments/<task_id>/<att_id>-... │
              └───────────────┬─────────────────────────────────┘
                              │ hash sha256 de cada arquivo
                              ▼
              ┌───────────────────────────────────────────────┐
              │  apps/api/exportacoes/MANIFESTO.md (committed) │
              │  data · contagens por Lista/recurso · hashes   │
              │  · lista de user ids vistos com contagem       │
              └───────────────┬─────────────────────────────────┘
                              │ é lido por
                              ▼
       ┌───────────────────────────────┐      ┌──────────────────────────────┐
       │ PREP-03: docs/07-processos/    │      │ PREP-04: de-para-usuarios.ts  │
       │ solicitacao-de-pagamento.md    │      │ (mesma pasta do exportador)   │
       │ (Claude lê os JSONs brutos +   │      │ ClickUp user id → email +     │
       │  automation/payment-rules.ts)  │      │ roleId esperado (6 conhecidos │
       └───────────────┬─────────────────┘      │ + tabela dos 38 CLICKUP_*)    │
                       │                        └──────────────┬────────────────┘
                       ▼                                       ▼
              (consumido pela Fase 2,               (consumido por inviteMember
               desenho da Lista real)                 na importação, Fases 2/3)
```

### Recommended Project Structure
```
apps/api/src/importacao/
├── CONTEXT.md                    # regra de dependência da pasta nova
└── clickup/
    ├── CONTEXT.md                # o que este módulo é e não é (D-01/D-03)
    ├── cliente.ts                 # fetch fino: header de auth, backoff em 429, JSON parse
    ├── paginacao.ts               # paginação por page/last_page e por start/start_id (dois padrões distintos!)
    ├── exportar.ts                # orquestra listas → campos → membros → tarefas → comentários → time_in_status → anexos
    ├── exportar.cli.ts            # `npm run exportar:clickup -w @n1/api` — só composição, sem lógica
    ├── manifesto.ts                # gera contagens + hash sha256 por arquivo; escreve MANIFESTO.md
    ├── manifesto.test.ts           # testa o parser/gerador do manifesto contra fixtures, sem rede
    ├── de-para-usuarios.ts         # tabela tipada ClickUp ID → email + roleId esperado + os 38 CLICKUP_*
    └── de-para-usuarios.test.ts    # valida forma, unicidade de email, roleId existente no bootstrap
```

### Pattern 1: Paginação por `page`/`last_page` (Tarefas, Campos, Membros)
**What:** Requisitar página por página incrementando `page`, parando quando `last_page === true` ou quando a página vier vazia.
**When to use:** `GET /list/{list_id}/task`, `GET /team/{team_id}/member` e endpoints análogos que documentam `last_page` na resposta.
**Example:**
```typescript
// Padrão da API — Get Tasks (developer.clickup.com/reference/gettasks)
async function* paginarTarefas(listId: string, token: string) {
  let page = 0;
  for (;;) {
    const resposta = await clienteClickUp(token, `/list/${listId}/task`, {
      page: String(page),
      include_closed: "true",
      archived: "false", // arquivadas viram uma segunda passada com archived=true
      subtasks: "true",
    });
    yield { page, tarefas: resposta.tasks as unknown[] };
    if (resposta.last_page || resposta.tasks.length === 0) break;
    page += 1;
  }
}
```

### Pattern 2: Paginação por `start`/`start_id` (Comentários)
**What:** Diferente de Tarefas — Comentários não têm `page`. Cada resposta traz até 25 comentários (mais novo primeiro); para a próxima página, enviar `start` (o `date` do último comentário recebido) e `start_id` (o `id` dele).
**When to use:** `GET /task/{task_id}/comment`.
**Example:**
```typescript
// Padrão da API — Get Task Comments (developer.clickup.com/reference/gettaskcomments)
async function* paginarComentarios(taskId: string, token: string) {
  let cursor: { start: string; start_id: string } | undefined;
  for (;;) {
    const resposta = await clienteClickUp(token, `/task/${taskId}/comment`, cursor as Record<string, string> | undefined);
    const comentarios = resposta.comments as { id: string; date: string }[];
    yield comentarios;
    if (comentarios.length === 0) break;
    const ultimo = comentarios[comentarios.length - 1]!;
    cursor = { start: ultimo.date, start_id: ultimo.id };
    if (comentarios.length < 25) break; // página parcial = última página
  }
}
```

### Pattern 3: Backoff em 429 por `X-RateLimit-Reset`
**What:** Ao receber 429, esperar até o timestamp Unix em `X-RateLimit-Reset` (não um backoff exponencial arbitrário) antes de repetir a mesma chamada.
**When to use:** Toda chamada ao ClickUp — 1.110 solicitações geram bem mais de 1.110 requisições (task + comments + time_in_status cada), o que estoura o orçamento de 100 req/min várias vezes numa exportação completa (orçamento mínimo estimado: 15–20 minutos só para a Lista de Solicitação).
**Example:**
```typescript
async function clienteClickUp(token: string, caminho: string, query?: Record<string, string>) {
  const url = new URL(`https://api.clickup.com/api/v2${caminho}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const resposta = await fetch(url, { headers: { Authorization: token } }); // sem "Bearer" — token pessoal
  if (resposta.status === 429) {
    const resetEm = Number(resposta.headers.get("X-RateLimit-Reset")) * 1000;
    const esperaMs = Math.max(0, resetEm - Date.now()) + 250;
    await new Promise((r) => setTimeout(r, esperaMs));
    return clienteClickUp(token, caminho, query);
  }
  if (!resposta.ok) throw new Error(`ClickUp ${resposta.status} em ${caminho}`);
  return resposta.json();
}
```

### Pattern 4: Manifesto como prova de paridade, não como índice
**What:** O manifesto grava contagens e hashes, nunca os dados em si. Re-rodar a exportação deve produzir o **mesmo hash** por arquivo se nada mudou no ClickUp — o que exige gravar os bytes crus da resposta (sem reordenar chaves, sem "pretty print" diferente a cada execução) e usar sempre a mesma serialização determinística.
**When to use:** Toda gravação de arquivo exportado.
**Example:**
```typescript
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

async function gravarPagina(caminho: string, corpoCru: string): Promise<{ readonly sha256: string; readonly bytes: number }> {
  await writeFile(caminho, corpoCru, "utf8"); // grava o texto exatamente como a API respondeu
  const sha256 = createHash("sha256").update(corpoCru).digest("hex");
  return { sha256, bytes: Buffer.byteLength(corpoCru) };
}
```
Nota: gravar `await resposta.text()` (a string crua) em vez de `JSON.stringify(await resposta.json())` — reserializar via `JSON.stringify` do Node pode reordenar ou reformatar de forma sutilmente diferente entre versões, quebrando a promessa de hash estável.

### Anti-Patterns to Avoid
- **Confundir `time_in_status` com histórico de status:** `time_in_status` dá tempo acumulado por status, não uma lista de transições com timestamp exato. Não escrever na spec (PREP-03) frases como "o histórico mostra que…" sem qualificar que a granularidade real é "tempo acumulado", especialmente para Tarefas que voltam a um status já visitado (ex.: `negado` → `lançado omie` de novo).
- **Paginar Comentários com `page`:** não existe esse parâmetro no endpoint de comentários — só `start`/`start_id`. Um exportador que tenta `?page=1` em `/task/{id}/comment` silenciosamente ignora o parâmetro e devolve sempre a primeira página, criando duplicatas se o código achar que avançou.
- **Usar `Authorization: Bearer <token>` com token pessoal:** o formato correto para token pessoal é `Authorization: <token>` sem prefixo `Bearer` (esse prefixo é só para OAuth2). Um erro aqui não falha claramente — a API pode devolver 401 genérico.
- **Achar que `drop_down` guarda o `orderindex`:** o valor de um custom field `drop_down` no objeto da Tarefa é o **id da opção** (string), não o `orderindex` (inteiro). O `orderindex` só aparece dentro de `type_config.options[]`, na definição do Campo. Ler errado aqui faz a spec (PREP-03) atribuir a opção errada a uma Solicitação.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backoff genérico de retry HTTP | Uma camada de retry configurável com jitter exponencial | A função de 10 linhas do Pattern 3, específica para 429 + `X-RateLimit-Reset` | O caso real é um só (rate limit conhecido, com timestamp exato de reset); uma lib de retry genérica adiciona configuração (tentativas, jitter, códigos retryable) que nada aqui usa |
| Cliente HTTP com tipos fortes para toda a API do ClickUp | Um SDK completo tipado (todas as ~130 rotas do ClickUp) | Chamar só os ~6 endpoints necessários com `fetch` + `zod.passthrough()` para validar frouxamente | D-03 pede o JSON bruto sem transformar; tipar 100% da API é trabalho que nenhuma tarefa desta fase precisa — a importação (Fases 2/3) é quem eventualmente tipa fundo os campos que vai consumir |
| Detecção de "última página" por heurística de contagem | Inferir fim da paginação contando itens < limite esperado, arriscando off-by-one | Usar exatamente o campo que a API expõe: `last_page` (Tarefas) e comprimento da página (Comentários, ver Pattern 2) | A API já diz quando parar; inventar heurística é a causa mais comum de exportação incompleta silenciosa |
| Reconstrução de histórico de status a partir de heurísticas de comentário | Tentar inferir toda transição de status via NLP sobre texto de Comentários | Gravar o que existe (Comentários com timestamp + `time_in_status`) e deixar explícito na spec (§12, seguindo o molde de `contas-a-pagar.md`) que a granularidade é aproximada | `contas-a-pagar.md` já fez isso com sucesso citando poucas Tarefas específicas como evidência, não reconstrução automática — é o padrão a repetir, não a automatizar |

**Key insight:** o maior risco de "hand-roll" nesta fase não é técnico (a API é simples), é epistemológico — tratar dados aproximados (tempo acumulado, texto de comentário) como se fossem uma trilha de auditoria completa. A spec deve citar a limitação, não escondê-la atrás de uma heurística que parece precisa.

## Common Pitfalls

### Pitfall 1: A API não tem endpoint de histórico completo
**What goes wrong:** Planejar PREP-02 assumindo que dá para exportar "histórico de status" como uma lista de eventos (status, timestamp, autor) equivalente a um audit log.
**Why it happens:** `contas-a-pagar.md` fala em "histórico" e mostra deltas precisos de hora ("29d → 6h40 → 1h18…"), dando a impressão de que existe um endpoint assim. Na verdade essa reconstrução veio de leitura manual de poucas Tarefas (8, citadas no cabeçalho do documento) combinando Comentários + `time_in_status` + o objeto da Tarefa, não de uma chamada de API que devolve histórico para todas as 1.110+200+240 Tarefas.
**How to avoid:** PREP-02 exporta `time_in_status` por Tarefa (best-effort, ver Pitfall 2) e todos os Comentários (que têm timestamp e às vezes narram a mudança, ex.: "Aprovado!"). PREP-03 usa essas duas fontes exatamente como `contas-a-pagar.md` fez — por amostragem qualitativa de poucas Tarefas representativas, não por processamento das 1.110.
**Warning signs:** um plano que promete "reconstruir 100% das transições de status de todas as Solicitações" está prometendo algo que a API não sustenta.

### Pitfall 2: `time_in_status` pode falhar por Tarefa (ClickApp desligado)
**What goes wrong:** O endpoint `GET /task/{task_id}/time_in_status` depende do ClickApp "Total time in Status" estar habilitado pelo dono/admin do Workspace. Se não estiver, a chamada falha (não confirmado neste research se 400 ou payload vazio — não verificado na documentação oficial).
**Why it happens:** É um ClickApp opcional, não uma feature sempre-ligada da API.
**How to avoid:** Tratar cada chamada de `time_in_status` como best-effort: gravar o erro no manifesto (contagem de "tarefas sem time_in_status disponível") em vez de abortar a exportação inteira.
**Warning signs:** a primeira chamada de teste a este endpoint (contra a Lista `901107637383`, que já tem `contas-a-pagar.md` como referência) deve ser feita cedo no plano, antes de rodar contra as 1.110+ Tarefas da Solicitação — se falhar lá, falha em todas.

### Pitfall 3: Volume de requisições e orçamento de tempo
**What goes wrong:** Subestimar quantas chamadas a exportação completa faz. Só a Lista de Solicitação (1.110 linhas no legado, PREP-06) implica: ~12 páginas de Tarefas + até 1.110+ chamadas de Comentários (cada Tarefa, pelo menos uma chamada; mais se tiver >25 comentários) + até 1.110 chamadas de `time_in_status` + N chamadas de anexo. Em 100 req/min, só os Comentários+time_in_status já são ~2.220 requisições ⇒ ~22 minutos no limite teórico, sem contar anexos nem retries.
**Why it happens:** É fácil pensar em "paginar Tarefas" e esquecer que Comentários e `time_in_status` são **por Tarefa**, não por Lista.
**How to avoid:** Rodar o script com log de progresso e ser resumível (ver Pitfall 4); orçar pelo menos 20-30 minutos de execução para a Lista de Solicitação sozinha; considerar não baixar `time_in_status`/comentários de Tarefas cuja Lista é a de Contas a receber dormente (901107648977) com o mesmo rigor — é uma decisão de discrição já sinalizada em CONTEXT.md.
**Warning signs:** um plano que trata a exportação como "um script que roda em 1 minuto" não orçou o rate limit real.

### Pitfall 4: Exportação interrompida (rede cai, token expira, processo morre)
**What goes wrong:** Sem alguma forma de retomada, uma interrupção aos 40 minutos de uma exportação de ~1h obriga a recomeçar do zero e reconsome o orçamento de rate limit.
**Why it happens:** Scripts de exportação "burros" mantêm estado só em memória.
**How to avoid:** Como D-03 já grava "um arquivo por recurso e por página" no disco imediatamente após cada chamada bem-sucedida, a retomada natural é: antes de requisitar uma página, checar se o arquivo já existe (e, opcionalmente, se tem conteúdo válido) e pular. Isso não exige um mecanismo de checkpoint separado — o próprio filesystem é o checkpoint. Vale também para anexos: pular download se o arquivo já existe com o mesmo nome (hash pode ser conferido depois, no manifesto).
**Warning signs:** um design que só grava o manifesto ao final (não incrementalmente) perde a granularidade de retomada — o manifesto deve poder ser reconstruído a partir do que já está em disco, inclusive depois de uma interrupção.

### Pitfall 5: Formas de custom field variam por tipo, e só aparecem quando preenchidos
**What goes wrong:** Assumir que todo `custom_fields[]` de uma Tarefa tem a mesma forma, ou que um Campo aparece mesmo vazio.
**Why it happens:** A API omite o campo `value` quando o Custom Field nunca foi setado naquela Tarefa (o objeto do campo aparece, mas sem `value`); e o tipo do `value` depende do `type` do Campo (`drop_down` → id da opção; `date` → epoch ms como string; `currency` → número; `checkbox` → boolean; `labels` → array de ids). Um parser que assume `value` sempre presente ou sempre string quebra ao primeiro Campo vazio ou do tipo errado.
**Why it matters for PREP-03:** a spec descreve "24 Campos" (no caso de Contas a pagar) e precisa fazer o mesmo levantamento para a Solicitação — ler `GET /list/901109104938/field` para pegar `type_config.options` (nomes reais das opções de seleção) e cruzar com os valores usados de fato nas Tarefas exportadas.
**How to avoid:** No parser da exportação (ou no futuro mapper), tratar `value` como opcional e despachar por `field.type`.
**Warning signs:** qualquer código que faça `task.custom_fields.find(f => f.name === "Forma de pagamento").value.toUpperCase()` sem checar `value !== undefined` primeiro.

### Pitfall 6: `date_created`/`date_updated`/`date_closed` são strings, não números
**What goes wrong:** Comparar ou ordenar datas assumindo tipo `number`.
**Why it happens:** A API devolve esses campos como **string** contendo milissegundos epoch (ex.: `"1567780450202"`), não como número JSON.
**How to avoid:** Sempre `Number(task.date_created)` antes de comparar; gravar no JSON exportado exatamente como veio (string), sem coagir — a transformação é trabalho da importação, não da exportação (D-03).

### Pitfall 7: Fuso horário na descrição da spec
**What goes wrong:** `contas-a-pagar.md` já registra datas "em horário de Brasília" explicitamente — a API devolve epoch UTC; toda conversão para horário local deve ser feita na hora de escrever a spec (leitura humana), nunca alterando o dado exportado.
**How to avoid:** Manter o export em UTC/epoch cru (D-03); só a prosa da spec (PREP-03) converte para horário de Brasília ao narrar exemplos, exatamente como `contas-a-pagar.md` já faz.

## Code Examples

### Cliente HTTP mínimo com backoff (consolidação dos padrões acima)
```typescript
// apps/api/src/importacao/clickup/cliente.ts
const BASE = "https://api.clickup.com/api/v2";

export async function clickup(
  token: string,
  caminho: string,
  query: Record<string, string> = {},
): Promise<{ readonly corpoCru: string; readonly json: unknown }> {
  const url = new URL(BASE + caminho);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const resposta = await fetch(url, { headers: { Authorization: token } });

  if (resposta.status === 429) {
    const resetEm = Number(resposta.headers.get("X-RateLimit-Reset") ?? "0") * 1000;
    const esperaMs = Math.max(1000, resetEm - Date.now() + 250);
    await new Promise((r) => setTimeout(r, esperaMs));
    return clickup(token, caminho, query);
  }
  const corpoCru = await resposta.text();
  if (!resposta.ok) throw new Error(`ClickUp ${resposta.status} em ${caminho}: ${corpoCru.slice(0, 300)}`);
  return { corpoCru, json: JSON.parse(corpoCru) as unknown };
}
```

### Forma de valor por tipo de Custom Field (para o futuro leitor da exportação, não desta fase)
```typescript
// Fonte: developer.clickup.com/docs/customfields (fetch direto em 2026-09-16)
type ValorDoCampo =
  | { readonly type: "drop_down"; readonly value?: string }        // id da opção
  | { readonly type: "date"; readonly value?: string }             // epoch ms como STRING
  | { readonly type: "currency"; readonly value?: number }
  | { readonly type: "text" | "url" | "phone"; readonly value?: string }
  | { readonly type: "checkbox"; readonly value?: boolean }
  | { readonly type: "labels"; readonly value?: readonly string[] }; // array de ids
```

### Forma do de-para (PREP-04) — o que `inviteMember` espera
```typescript
// packages/dominio/src/operations/members.ts — assinatura real (já existe, não muda nesta fase)
// inviteMember(state, actingMemberId, { email: string, roleId: Id, userId?: Id }): OperationResult<Member>

// apps/api/src/importacao/clickup/de-para-usuarios.ts — o que esta fase produz
export interface EntradaDeParaUsuario {
  readonly clickupUserId: string;
  readonly email: string;
  /** Um dos 4 Papéis de sistema que o bootstrap de produção realmente cria. */
  readonly roleIdEsperado: "role_prop" | "role_adm" | "role_mem" | "role_conv";
  /**
   * Preenchido só quando o ClickUp ID já corresponde a um Membro existente
   * na plataforma (caso Financeiro/81581816 = mem_maryane, hoje com e-mail
   * de teste — ver Open Questions). Quando presente, a importação NÃO deve
   * chamar inviteMember: deve mapear diretamente para este Member.id.
   */
  readonly memberIdConhecido?: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Ler o processo de Solicitação só pelo código do `automation/` (o que a lacuna do inventário aponta) | Ler a Lista real via API + o código, seguindo o molde de `contas-a-pagar.md`/`contas-a-receber.md` | Decisão do plano de migração, confirmada nesta fase (D-05) | A spec passa a descrever o que as pessoas fazem, não só o que está automatizado — a mesma virada que já funcionou para Contas a pagar/receber |
| Tentar obter histórico de status via API pública | Aceitar que não existe (feedback aberto desde antes de 2026, sem ETA) e usar `time_in_status` + Comentários como aproximação | Fato permanente da API, não uma mudança recente | Muda a redação esperada da seção "Transições observadas" de PREP-03: deve citar evidência pontual (poucas Tarefas), não afirmar cobertura total |

**Deprecated/outdated:** nenhuma mudança de versão de API relevante — o ClickUp API v2 é estável desde 2021 e não há sinalização de v3 nas páginas consultadas em 2026-09-16.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O `postinstall`/comportamento de `attachments[].url` do ClickUp pode expirar quando uma Lista é arquivada (motivo citado em D-04 do CONTEXT.md) | Architecture Patterns, Pitfall (anexos) | Se a URL não expira mesmo com a Lista arquivada, D-04 continua sendo a decisão certa por LGPD/D-02 de qualquer forma (não depender de storage do ClickUp), mas o "motivo" citado na spec do exportador ficaria impreciso — baixo risco, decisão não muda |
| A2 | `GET /task/{id}/time_in_status` responde com erro (não silenciosamente vazio) quando o ClickApp "Total time in Status" está desligado no Workspace Tria | Common Pitfalls #2 | Se responder vazio em vez de erro, o script precisa distinguir "sem histórico de status ainda" de "ClickApp desligado" de forma diferente (checar se `status_history` é `[]` vs. ausente) — afeta só a robustez do tratamento de erro, não a decisão de exportar |
| A3 | O e-mail de produção de `mem_maryane` hoje é o de teste (`emailDoSeed`), não o e-mail corporativo real, e por isso o ClickUp ID `81581816` (Financeiro) não resolve automaticamente para o Membro existente via e-mail | Summary, Code Examples (de-para) | Confirmado por leitura direta do código (`bootstrap-gestao.ts`, D-09 da Fase 1) — não é uma suposição de baixa confiança, é `[VERIFIED: código do repositório]`; mantido aqui só porque a implicação (precisa de `memberIdConhecido`) é uma decisão de design nova, não travada em CONTEXT.md |
| A4 | Os 38 nomes de variáveis `CLICKUP_*` citados em D-12/PREP-04 não puderam ser enumerados nesta pesquisa — o repositório `financeiro-tria` (onde vivem `.env.example`/`.env`) está fora deste monorepo e não foi disponibilizado | Open Questions | Se o plano assumir que a lista completa já está disponível, uma tarefa vai travar esperando um arquivo que ninguém tem; precisa virar uma tarefa explícita de "obter `.env.example` do `financeiro-tria` ou da VPS" antes de codificar a tabela completa |

**Se esta tabela estivesse vazia:** não está — A4 em particular é uma lacuna de dado, não de arquitetura, e deve virar uma tarefa/checkpoint explícito no plano.

## Open Questions

1. **Onde estão os 38 nomes de variáveis `CLICKUP_*` e os valores dos que já não são os 6 conhecidos?**
   - What we know: `01-inventario-financeiro-tria.md §4.1` cita `CLICKUP_TEAM_ID`, `CLICKUP_LIST_SOLICITACAO_PAGAMENTO_ID`, `CLICKUP_LIST_CONTAS_PAGAR_ID`, `CLICKUP_LIST_CONTAS_RECEBER_ID`, `MP_CLICKUP_TEAM_ID`, `FO_CLICKUP_TEAM_ID`, `MP_CLICKUP_LIST_*`, `FO_CLICKUP_LIST_CONTAS_PAGAR_ID`, `FO_CLICKUP_LIST_*`, `CLICKUP_RESPONSAVEL_*` (pelo menos 4-5, um por aprovador), `CLICKUP_REVIEWER_IDS`, `CLICKUP_CF_MANUAL_OPTION_ID`, `CLICKUP_API_TOKEN` — isso é bem menos que 38.
   - What's unclear: o restante das 38 (o número vem do CONTEXT.md, presumivelmente contado no `.env.example` real do `financeiro-tria`, que não está neste monorepo).
   - Recommendation: o plano deve ter uma tarefa explícita ("obter `.env.example`/`.env` do `financeiro-tria` — VPS ou repositório separado — e listar as 38 chaves") antes da tarefa que escreve a tabela completa em `de-para-usuarios.ts`; sem isso, PREP-04 só consegue cobrir os 6 IDs de usuário conhecidos com certeza.

2. **`GET /task/{id}/time_in_status` está habilitado no Workspace Tria (`9011731314`)?** (RESOLVED: não — precisa ser verificado na execução, não é uma decisão de projeto)
   - What we know: o endpoint depende do ClickApp "Total time in Status", habilitável por dono/admin.
   - What's unclear: se está ligado hoje para o Team `9011731314`.
   - Recommendation: primeira chamada do exportador (ou um passo de smoke-test antes da exportação completa) deve testar este endpoint contra uma Tarefa conhecida (ex.: `868k8tn50`, citada em `contas-a-pagar.md`) e decidir se o recurso entra no manifesto ou fica marcado "indisponível".

3. **Colisão de identidade Financeiro (ClickUp `81581816`) × `mem_maryane` (e-mail de teste hoje)**
   - What we know: são a mesma pessoa (`02-comparativo-com-a-plataforma.md §3.3`); o Membro de produção existe mas com e-mail `@n1.teste` (D-09 da Fase 1).
   - What's unclear: quando o e-mail real da Maryane substituir o de teste (fora do escopo desta fase — Fase 1 ainda não resolveu isso), como a importação evita criar um segundo Membro para ela via este de-para.
   - Recommendation: o de-para desta fase deve incluir o campo opcional `memberIdConhecido` (ver Code Examples) para o ClickUp ID `81581816`, apontando para `mem_maryane`, e deixar uma nota explícita no arquivo de que a importação (Fases 2/3) deve checar esse campo antes de chamar `inviteMember`. Não é uma decisão a tomar agora — é um risco a documentar para não ser esquecido.

4. **PREP-05 (rotação Omie) — atualização de status nos documentos (RESOLVED por D-13, falta só a mecânica de edição)**
   - What we know: D-13 decide não rotacionar; CONTEXT.md já registra isso como decisão travada.
   - What's unclear: nada tecnicamente — falta só o planejador incluir uma tarefa (não de código) que edita `REQUIREMENTS.md` (linha PREP-05) e `ROADMAP.md` (critério 4 da Fase 0) trocando "Pendente"/o critério de credenciais rotacionadas por "risco aceito pelo dono (D-13)".
   - Recommendation: tratar como uma tarefa de documentação de uma linha, não como pesquisa técnica — incluída aqui só para não ser esquecida no plano.

5. **A Lista de Contas a receber dormente (`901107648977`) recebe o mesmo tratamento de anexos que as outras duas?**
   - What we know: CONTEXT.md deixa isso a critério do planejador; a Lista está "dormente desde out/2025" (`02-comparativo §3.7`).
   - What's unclear: se vale o custo de rate limit/tempo baixar anexos de uma Lista que provavelmente não muda de decisão de arquitetura.
   - Recommendation: exportar Tarefas + Campos + histórico com o mesmo rigor (é barato — poucas linhas, `contas_a_receber` tem só 10 linhas no Supabase legado, PREP-06 §5.7); anexos podem ser adiados/pulados nesta Lista sem risco, já que D-04 justifica anexos pela urgência de "Contas a pagar" (Lista ativa que será arquivada em breve, Fase 3) — a Lista dormente não tem esse relógio correndo.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `CLICKUP_API_TOKEN` | Exportador (PREP-02), smoke-test de `time_in_status` (Open Question 2) | ✗ (não definida no ambiente desta pesquisa) | — | Nenhum — sem o token, PREP-02 não roda; o script/teste de integração deve pular graciosamente sem essa variável, no mesmo padrão de `DATABASE_URL` (D-DEC-09) |
| `DATABASE_URL` | Não é usado por PREP-02/PREP-04 diretamente (a exportação não grava no Postgres) | ✗ (não definida) | — | Não bloqueia esta fase — só a importação (Fases 2/3) grava no schema `plataforma` |
| Node.js | Rodar o exportador via `vite-node` | ✓ | v26.5.0 (ambiente de pesquisa; monorepo não fixa uma versão mínima observável nesta pesquisa) | — |
| Acesso de rede a `api.clickup.com` | Exportador | Não verificado nesta pesquisa (instrução explícita: não acessar a API real durante a pesquisa) | — | — |
| `.env.example` do `financeiro-tria` (para as 38 `CLICKUP_*`) | PREP-04 (tabela completa) | ✗ (repositório fora deste monorepo, não disponibilizado) | — | Ver Open Question 1 — precisa virar tarefa de obtenção de dado antes de codificar a tabela completa |

**Missing dependencies with no fallback:**
- `CLICKUP_API_TOKEN` — bloqueia toda execução real de PREP-02 (mas não bloqueia planejamento; testes unitários/parsers seguem rodando sem ele).
- `.env.example`/`.env` do `financeiro-tria` — bloqueia a cobertura completa das 38 variáveis em PREP-04 (os 6 IDs conhecidos e nomeados em CONTEXT.md não dependem disso).

**Missing dependencies with fallback:** nenhum crítico — os itens acima não têm fallback técnico, só uma tarefa de obtenção de dado.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 (já configurado em `apps/api/vitest.config.mts`) |
| Config file | `apps/api/vitest.config.mts` (existente — `testTimeout: 60s`) |
| Quick run command | `npm run test -w @n1/api -- de-para-usuarios manifesto` |
| Full suite command | `npm run check` (raiz — typecheck + lint + tokens + testes dos três workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREP-02 | Paginação de Tarefas para (`page`/`last_page`) monta a lista correta a partir de fixtures gravadas (sem rede) | unit | `npm run test -w @n1/api -- paginacao` | ❌ Wave 0 — `apps/api/src/importacao/clickup/paginacao.test.ts` |
| PREP-02 | Paginação de Comentários (`start`/`start_id`) avança corretamente e para na página parcial | unit | `npm run test -w @n1/api -- paginacao` | ❌ Wave 0 — mesmo arquivo acima |
| PREP-02 | Backoff em 429 espera até `X-RateLimit-Reset` antes de repetir (mock de `fetch`) | unit | `npm run test -w @n1/api -- cliente` | ❌ Wave 0 — `apps/api/src/importacao/clickup/cliente.test.ts` |
| PREP-02 | Manifesto: hash sha256 de um arquivo de fixture bate com o valor esperado; contagens por recurso somam corretamente | unit | `npm run test -w @n1/api -- manifesto` | ❌ Wave 0 — `apps/api/src/importacao/clickup/manifesto.test.ts` |
| PREP-02 | Exportação real contra a API do ClickUp (integração) | integration | `npm run test -w @n1/api -- exportar.integration` (pula sem `CLICKUP_API_TOKEN`) | ❌ Wave 0 — segue o padrão de `persistencia.test.ts` (skip sem env) |
| PREP-02 | Manifesto commitado bate com as contagens reais das 3 Listas (critério 2 do ROADMAP) | manual-only (checkpoint humano) | — | justificativa: exige comparar contra o ClickUp de produção; não é reproduzível em CI sem o token e sem tocar dados reais de novo a cada verificação |
| PREP-03 | `solicitacao-de-pagamento.md` existe com as 12 seções do molde de `contas-a-pagar.md` | manual-only | — | justificativa: é um documento markdown, não código — a verificação é de conteúdo/estrutura, feita por leitura humana (ou por um checker de seções, se o plano incluir um) |
| PREP-04 | Toda entrada do de-para tem um `roleIdEsperado` que existe em `bootstrap-gestao.ts` (`role_prop`/`role_adm`/`role_mem`/`role_conv`) | unit | `npm run test -w @n1/api -- de-para-usuarios` | ❌ Wave 0 — `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` |
| PREP-04 | Os 6 e-mails conhecidos (Elifas, Fabíola, Thiago, Iallas, Financeiro, revisor FO) estão presentes e são únicos | unit | `npm run test -w @n1/api -- de-para-usuarios` | ❌ Wave 0 — mesmo arquivo |
| PREP-04 | `EntradaDeParaUsuario` tipa corretamente contra a assinatura real de `inviteMember` (campo `memberIdConhecido` não quebra o shape esperado pela importação futura) | unit (typecheck) | `npm run typecheck -w @n1/api` | ✅ — coberto pelo `tsc --noEmit` já existente, uma vez que o tipo exista |

### Sampling Rate
- **Per task commit:** `npm run test -w @n1/api -- <arquivo relevante>`
- **Per wave merge:** `npm run check` (raiz)
- **Phase gate:** `npm run check` verde antes de `/gsd-verify-work`; para PREP-02, checkpoint humano confere o manifesto contra o ClickUp real (não automatizável sem repetir a exportação)

### Wave 0 Gaps
- [ ] `apps/api/src/importacao/clickup/paginacao.test.ts` — cobre PREP-02 (dois padrões de paginação)
- [ ] `apps/api/src/importacao/clickup/cliente.test.ts` — cobre PREP-02 (backoff 429, header de auth sem "Bearer")
- [ ] `apps/api/src/importacao/clickup/manifesto.test.ts` — cobre PREP-02 (hash, contagens)
- [ ] `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` — cobre PREP-04 (forma, unicidade, `roleId` válido)
- [ ] Fixtures de resposta do ClickUp (JSON gravado à mão ou copiado de exemplos da documentação oficial, nunca de dados reais de produção) para os testes unitários acima rodarem sem rede
- [ ] Framework: nenhuma instalação nova — Vitest já configurado

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não (esta fase não autentica usuários finais) | — |
| V3 Session Management | não | — |
| V4 Access Control | parcial | O exportador roda como script local/CLI, não como rota HTTP — não há controle de acesso de usuário a aplicar aqui; o controle relevante é "quem tem acesso ao arquivo `.env` com `CLICKUP_API_TOKEN`" (mesmo tratamento que `DATABASE_URL`/`SUPABASE_SECRET_KEY`) |
| V5 Input Validation | sim | `zod` para validar frouxamente a forma das respostas do ClickUp antes de gravar (evita gravar `undefined`/`null` inesperado que quebre o parser da importação depois); nenhuma validação de entrada de usuário nesta fase (não há formulário) |
| V6 Cryptography | sim (uso mínimo) | `node:crypto` `createHash("sha256")` só para integridade do manifesto (não é uma decisão de sigilo) — não hand-rolar hashing customizado |
| V9 Data Protection (dados sensíveis) | sim — é o coração de D-02/D-04 | CPF/CNPJ, dados bancários (chave Pix) e NFs (anexos) vivem em Campos, Comentários e anexos das Tarefas exportadas — **nunca** entram no manifesto commitado (só contagens/hashes) nem em qualquer log de console do exportador; a pasta de exportação fica fora do git (`.gitignore`) |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vazamento de PII/dados financeiros via commit acidental da pasta de exportação | Information Disclosure | `.gitignore` cobrindo `apps/api/exportacoes/` (ou o nome escolhido); teste/checkpoint humano que roda `git status` depois da primeira exportação para confirmar que nada além do `MANIFESTO.md` aparece como novo arquivo rastreável |
| Vazamento de `CLICKUP_API_TOKEN` em log ou em mensagem de erro | Information Disclosure | Nunca logar o header `Authorization`; mensagens de erro do cliente HTTP (Pattern 3/Code Examples) devem incluir o caminho da chamada, não os headers enviados |
| Token do ClickUp com escopo além do necessário (é um token pessoal — herda todas as permissões do usuário dono) | Elevation of Privilege | Fora de controle desta fase (é uma decisão de quem gera o token no ClickUp, não de código); documentar em `CONTEXT.md` da pasta nova que o token deve ser de uma conta com acesso só de leitura às 3 Listas, se o ClickUp permitir esse escopo — caso contrário, aceitar o risco e não ampliar (D-01 já assume reuso do token existente do `automation/`, mas coloca-o num `.env` próprio do `apps/api`, não compartilhado em runtime com o `automation/`) |
| `.gitignore` com exceção mal-configurada deixando um arquivo dentro da pasta ignorada ser commitado sem querer | Tampering (integridade do repositório) | Verificar explicitamente (checkpoint) que `MANIFESTO.md`, se ficar **dentro** da pasta ignorada, precisa de uma exceção `!apps/api/exportacoes/MANIFESTO.md` no `.gitignore` — ou, mais simples e sem risco de erro de padrão glob, colocar o manifesto **fora** da pasta ignorada desde o início (ex.: `apps/api/exportacoes/clickup/` ignorada, `apps/api/exportacoes/MANIFESTO.md` num nível acima, fora do padrão ignorado) |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código do repositório (`apps/api/src/persistencia/conexao.ts`, `apps/api/package.json`, `apps/api/src/bootstrap/gestao.ts`, `apps/api/src/bootstrap/gestao.cli.ts`, `packages/dominio/src/operations/members.ts`, `packages/dominio/src/bootstrap-gestao.ts`, `apps/api/src/servicos/convidar-membro.ts`, `.gitignore`, `apps/api/.env.example`) — `[VERIFIED: repositório local]`.
- `docs/07-processos/contas-a-pagar.md` (302 linhas, lido por completo) — o molde estrutural exato que PREP-03 deve seguir — `[VERIFIED: repositório local]`.
- `.planning/phases/00-prepara-o/00-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md` — decisões travadas — `[VERIFIED: repositório local]`.
- `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §3–§5.7, `02-comparativo-com-a-plataforma.md`, `03-plano-de-migracao.md` §3/§7 — `[VERIFIED: repositório local]`.

### Secondary (MEDIUM confidence)
- `developer.clickup.com/reference/gettasks` (WebFetch direto, 2026-09-16) — parâmetros de `GET /list/{list_id}/task`, limite de 100/página, `last_page` — `[CITED: developer.clickup.com/reference/gettasks]`.
- `developer.clickup.com/docs/rate-limits` (WebFetch direto) — limites por plano, headers `X-RateLimit-*`, comportamento 429 — `[CITED: developer.clickup.com/docs/rate-limits]`.
- `developer.clickup.com/docs/customfields` (WebFetch direto) — forma de valor por tipo de Custom Field — `[CITED: developer.clickup.com/docs/customfields]`.
- `developer.clickup.com/reference/gettaskstimeinstatus` (WebFetch direto) — forma da resposta de `time_in_status`, confirmação de que é tempo acumulado, não histórico de eventos — `[CITED: developer.clickup.com/reference/gettaskstimeinstatus]`.
- `developer.clickup.com/reference/gettask` (WebFetch direto) — forma do objeto `attachments[]`, tipos de `date_created`/`date_updated`/`date_closed` como string — `[CITED: developer.clickup.com/reference/gettask]`.
- `developer.clickup.com/docs/authentication` (WebFetch direto) — formato exato do header `Authorization` para token pessoal (sem "Bearer") — `[CITED: developer.clickup.com/docs/authentication]`.
- `developer.clickup.com/docs/task-comments-pagination` (via WebSearch, conteúdo do próprio domínio oficial) — mecânica `start`/`start_id` — `[CITED: developer.clickup.com/docs/task-comments-pagination]`.
- `developer.clickup.com/reference/getaccessiblecustomfields`, `getlistmembers` (via WebSearch, citando o domínio oficial) — endpoints de Campos e Membros da Lista — `[CITED: developer.clickup.com]`.

### Tertiary (LOW confidence)
- `feedback.clickup.com/public-api/p/get-task-history` (WebFetch direto) — confirma ausência de endpoint público de histórico completo; é uma página de feedback de produto, não documentação formal, mas a citação direta do próprio ClickUp ("esta funcionalidade já existe, mas não é exposta via API pública") é o dado mais importante desta pesquisa — tratado como `[CITED: feedback.clickup.com]` apesar de não ser doc de referência, por ser declaração direta do fornecedor.
- Resumos de WebSearch que agregam blogs de terceiros (ex.: `consultevo.com`, `rollout.com`) sobre rate limit e custom fields, usados só para triangular o que os fetches diretos de `developer.clickup.com` já confirmaram — `[ASSUMED]` onde não há confirmação direta da doc oficial acima.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova, tudo já presente e verificado no código do repositório.
- Architecture (exportador/de-para): MEDIUM — os padrões de paginação e o cliente HTTP vêm de fetch direto na documentação oficial; o desenho concreto de pastas/arquivos é uma recomendação desta pesquisa, não uma verificação de código existente.
- Pitfalls: MEDIUM-HIGH — a ausência de histórico completo é `[CITED]` da própria página oficial de feedback do ClickUp; os demais pitfalls (formas de custom field, paginação de comentários, rate limit) são `[CITED]` de fetch direto da documentação de referência.
- De-para/PREP-04: MEDIUM — a assinatura de `inviteMember` e o estado real do bootstrap de produção são `[VERIFIED: repositório local]`; a recomendação de `memberIdConhecido` é uma proposta de design desta pesquisa, não uma decisão travada.

**Research date:** 2026-09-16
**Valid until:** 2026-10-16 (30 dias — a API do ClickUp é estável, mas o estado de "sem endpoint de histórico" deve ser reconfirmado se a exportação real demorar a começar, já que é o item de maior impacto no plano)
