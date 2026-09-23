# Phase 4: As outras telas do financeiro-tria - Research

**Researched:** 2026-09-23
**Domain:** Autenticação servidor-a-servidor entre monorepos (Fastify → Express), releitura de dados legados no sistema de design de um segundo frontend (Next.js 16 App Router), corte controlado de um painel em produção
**Confidence:** HIGH (código lido nos dois repositórios) / MEDIUM (volumes e nomes de tabela vêm de `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md`, datado de 2026-09-15 — podem ter mudado) / LOW (nenhuma — nenhuma decisão desta fase depende de conhecimento não verificado em código)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D4-01..D4-16 — não re-litigar)

- **D4-01** — O navegador nunca fala com o `automation/`. `apps/web` → `apps/api` → `automation/`. JWT do Supabase autentica o Membro na borda do `apps/api` (hook de 01-02); do `apps/api` para o `automation/` vai uma credencial de serviço `Authorization: Bearer`, que nunca chega ao bundle. Mesmo desenho de D-15 e espelho exato da ponte de 03-11 (`apps/api/src/automacoes/invocar-agente.ts`).
- **D4-02** — Credencial própria, só de leitura: `PLATAFORMA_LEITURA_TOKEN`, separada de `PLATAFORMA_LANCAMENTO_TOKEN` (03-07/03-11). Escopo mínimo — vazamento do token de leitura não gasta dinheiro.
- **D4-03** — Superfície nova, autenticada desde o nascimento: `/v1/leituras/*`. As rotas de hoje (`GET /automation/runs`, `/financeiro/solicitacoes`, `/plano-contas`, `/workflows`) continuam intocadas e públicas durante a fase — só são removidas no plano de corte (D4-16). Reusa a DISCIPLINA de `webhooks-plataforma.ts`/`contas-a-pagar-routes.ts` (autenticação em tempo constante, envelope de erro sanitizado), não importa o módulo do contrato v1.
- **D4-04** — `apps/api` não lê o schema `public`, nunca. Dois bancos Supabase distintos (plataforma em projeto próprio, `sa-east-1` por D-23). Toda leitura do legado entra por HTTP no `automation/`.
- **D4-05** — Toda leitura é projetada, nunca repassada. Cada rota de `/v1/leituras/*` declara um DTO explícito com allowlist de campos; credencial por linha, chave Pix e documento completo não entram no DTO, e um teste prova a ausência por nome de campo.
- **D4-06** — Dashboard, Problemas e Aprovações pendentes são servidos computados. `buildDashboardStats` e `buildProblemRows` (hoje em `src/features/financeiro/data/solicitacoesPagamentos.ts`, que morre) são re-homed como funções puras com teste no `automation/`; as rotas devolvem linhas prontas. `realIntegrations` NÃO é portado (ficção de protótipo).
- **D4-07** — Leitura primeiro; escrita só onde não existe equivalente na plataforma. Portadas como escrita: CRUD + import do Plano de contas, edição de alíquota em Produtos, upload de Extratos, os dois gatilhos de emissão de NF (D4-12), e das ações de run só `retry-step`/`cancel`. NÃO portadas: `PATCH /financeiro/solicitacoes/:id/aprovado` e `approve`/`review` de run — aprovar é decisão da plataforma desde a Fase 2.
- **D4-08** — Um `/financeiro` de primeiro nível no shell do CRM N1, com as oito leituras como sub-rotas (`/financeiro/notas-fiscais`, `/produtos`, `/plano-contas`, `/extratos`, `/workflows`, `/problemas`, `/aprovacoes-pendentes`, Dashboard na raiz). Não vai debaixo de `ferramentas/`.
- **D4-09** — `Empresa` é um filtro (`?empresa=`), não um trocador de tenant. Modelar Empresa como Integração é TEN-01, Phase 5.
- **D4-10** — Plano de contas é portado com a verdade escrita na tela. `planos_de_contas` tem 0 linhas; o de-para real é o RAG em `conciliador_contas` (D3-02). A tela é a UI de manutenção de `conciliador_contas` — CRUD, import CSV/XLSX, embeddings — e diz visivelmente que não é ela que o Agente consulta via essa tabela vazia. Nada de virar editor de RAG (capacidade nova).
- **D4-11** — Aprovações pendentes nasce como vista legada, rotulada como tal. Deriva de `solicitacoes_pagamentos.Aprovado`; a fila viva é `/ia/aprovacoes` (D-08). Sem botão de decidir; esvazia sozinha com o tempo.
- **D4-12** — D10 respondida: a emissão manual de NF é um gatilho na tela de Notas fiscais, não uma Ação na Tarefa; Google Sheets não continua. O código só emite em LOTE: `markSeteDias()` e `emitirNotas()`, expostos como `POST /invoice/run/mark-7days` e `.../emit` (na prática, hoje, via `POST /workflows/tria-invoice-mark-7days/run` e `.../tria-invoice-emit/run` — ver Código do `financeiro-tria` abaixo). Não existe emissão por linha; inventar uma mudaria regra (proibido por DEC-16). A linha mostra `controle_emissao`/`emissao_nota_produto`/`emissao_nota_servico`.
- **D4-13** — Upload de Extratos sobe pelo `apps/api`. `POST /financeiro/extratos` recebe o arquivo, valida MIME e tamanho no servidor, repassa a `POST /webhook/receber-whatsapp-doc/:origem` com a credencial de serviço. Atenção operacional: a origem do proxy precisa entrar na allowlist de `MP_RECEBIMENTO_SOURCE`, ou o upload é recusado em produção e não em teste.
- **D4-14** — Quem alcança a Pasta "Financeiro" vê `/financeiro`. Reusa `memberReachesContainer` do domínio, aplicada na rota do `apps/api`: sem alcance, 403, item some da navegação. Nenhum sistema de permissão novo.
- **D4-15** — Sem Realtime e sem cache nesta fase. Recarregar sob demanda, botão de atualizar, revalidação ao focar a aba. Indisponibilidade do `automation/` é estado visível na tela, nunca lista vazia fingindo que não há dados.
- **D4-16** — O painel só sai do ar depois de uma semana de uso real. Ordem: (1) as oito leituras em uso; (2) confirmar com quem opera; (3) `financeiro-tria.vercel.app` PAUSADO, não deletado, por 30 dias; (4) remover a policy `anon_read` (`solicitacoes_pagamentos`, `financas_mp`, `automation_workflows*`, `conciliador_*`), `AuthContext` e rotas públicas legadas do `automation/`; (5) `npm run check` verde nos três workspaces. Rollback é despausar o Vercel — possível até a etapa 4.

### Claude's Discretion

- Forma exata das rotas de `/v1/leituras/*`, nomes dos DTOs e divisão em arquivos, desde que a allowlist de campos seja explícita e testada.
- Divisão dos planos e ondas, e como coordenar commits entre os dois repositórios sem tocar o worktree sujo do `financeiro-tria`.
- Layout fino de cada uma das oito telas, reusando `apps/web/src/design/` e os padrões de `features/`.
- Política de timeout, retry e como a falha do `automation/` é renderizada.

### Deferred Ideas (OUT OF SCOPE)

- Modelar `transacoes`, `produtos` ou plano de contas na ontologia — DEC-16 decidiu que não.
- Tela de Integrações e de Notificações — fora das oito de TELA-01.
- Editor de RAG / `conciliador_contas` pela tela — capacidade nova.
- Substituir as 13 tabelas vetoriais por empresa e as 7 views `_v` pela `conciliador_contas` unificada.
- Descartar as cinco tabelas de observabilidade (`automation_runs/steps/events`, `approval_tasks`, `automation_workflows`) praticamente sem uso.
- Realtime e cache das leituras — reavaliar com latência medida depois do corte.
- Empresa como Integração com credencial própria (CAND-01) — Phase 5, TEN-01.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TELA-01 | Portar como tela, no sistema de design do CRM N1, as oito leituras (Notas fiscais, Produtos, Plano de contas com CRUD+import, Extratos do Marcos com upload, Workflows, Dashboard, Problemas, Aprovações pendentes), chegando autenticadas — `anon_read` e `AuthContext` morrem com o painel | Inventário completo por tela (fonte real de dados, endpoint existente ou a criar, colunas exibidas, colunas proibidas) na seção "Inventário das 8 leituras"; o molde de rota autenticada (`contas-a-pagar-routes.ts`); o molde de cliente HTTP (`invocar-agente.ts`); o padrão de autorização por alcance (`memberReachesContainer`); o padrão de fetch fora do store (`estado-inicial.ts`); o checklist de corte (D4-16) com achado novo (RLS de `transacoes`/`produtos_cadastrados_emissao_notas` não rastreada em nenhuma migration) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` importa `./CONTEXT.md` e `./AGENTS.md` — ambos lidos e aplicados nesta pesquisa:

- **Regra de dependência (CONTEXT.md):** `packages/dominio` não conhece ninguém; `apps/web` e `apps/api` conhecem o domínio e NUNCA um ao outro. Esta fase é a prova extrema disso: `apps/web` nunca fala com `automation/`, nem sabe que ele existe — só fala com `apps/api`, que é o único lado que fala com `automation/`. Uma seta `web → automation/` (mesmo que só de leitura) é erro de arquitetura, não atalho.
- **Onde uma mudança nasce (CONTEXT.md):** mudou "o que a coisa é" → `packages/dominio`; "como aparece" → `apps/web`; "como se guarda/serve" → `apps/api`. Esta fase NÃO deveria tocar `packages/dominio` — DEC-16/D-22 já dividiram ontologia × telas portadas. Se um plano desta fase parecer precisar mudar o domínio, é sinal de modelagem errada, não de tarefa legítima (repetido explicitamente no objective do orquestrador).
- **Portão CON-05 (REQUIREMENTS.md/ROADMAP.md):** `npm run check` verde nos três workspaces; testes do domínio idênticos; `automation/` com o mesmo `git log` fora do que os planos desta fase tocam deliberadamente.
- **AGENTS.md (raiz e `apps/web/`):** "This is NOT the Next.js you know" — Next 16.3.4 tem mudanças que quebram o que o treinamento assume (ex.: `middleware.ts` virou `proxy.ts` neste repo). Antes de escrever qualquer código de App Router (Server Component, route handler, `page.tsx` novo) para as oito telas, ler `apps/web/node_modules/next/dist/docs/` — resolvido a partir de `apps/web/`, não da raiz do monorepo, porque `next` pode não estar visível dali.
- **Comandos (CONTEXT.md):** tudo roda da raiz — `npm run dev` (web 3001 + api 3002), `npm run check` (typecheck, lint, `verificar:tokens`, test nos três workspaces).

## Summary

A Fase 4 tem duas metades de tamanho muito diferente. A primeira — o caminho autenticado — é pequena e o molde já existe duas vezes em código real: `contas-a-pagar-routes.ts` (03-07, `financeiro-tria/automation`) mostra exatamente como nasce uma rota nova autenticada por Bearer em tempo constante dentro do Express legado, e `invocar-agente.ts` (03-11, `apps/api`) mostra exatamente como o `apps/api` já chama esse padrão de superfície por HTTP com timeout, classificação de erro transitório/permanente e `sanitizarErro()` importado de `outbox-worker.ts`. As oito rotas de `/v1/leituras/*` e o cliente que as chama de `apps/api` são composição desses dois moldes, não invenção.

A segunda metade — as oito telas — é onde o tamanho real está, e ele é desigual entre elas. Duas leituras (Dashboard, Problemas) e uma vista derivada (Aprovações pendentes) já têm endpoint pronto no `automation/` (`GET /financeiro/solicitacoes`) e só precisam de projeção server-side das funções `buildDashboardStats`/`buildProblemRows` (D4-06) mais a allowlist de campos (D4-05) — a tabela de origem, `solicitacoes_pagamentos`, tem 14 colunas e DUAS são credencial por linha (`app_key`, `app_secret`). Plano de contas já tem endpoint pronto e correto (`plano-contas-routes.ts`, que na verdade lê `conciliador_contas`, não a `planos_de_contas` vazia que o texto de TELA-01 sugere). Extratos já tem endpoint pronto (`bank-statement-webhooks.ts`, corpo bruto, 7 origens de banco/cartão). Workflows já tem endpoint pronto e já expõe os dois gatilhos de NF como execução manual genérica (`POST /workflows/:key/run` com `manualRunKey: "mark-7days"|"emit"`) — D4-12 não precisa de rota nova no `automation/`, só de um proxy autenticado em cima da que existe.

Notas fiscais e Produtos são a descoberta principal desta pesquisa: **não têm nenhum endpoint HTTP hoje**. O front do Vercel lê e escreve direto em `transacoes` (32 colunas, com `api_key`/`app_secret`/`cpf_cnpj`/endereço completo — 1.987 linhas) e `produtos_cadastrados_emissao_notas` (6 colunas, sem segredo — 42 linhas) via chave `anon` do Supabase, sem passar pelo `automation/` em nenhum momento. Duas rotas `/v1/leituras/*` novas precisam nascer do zero para essas duas telas — não é wrapper de autenticação em cima de algo existente, é a primeira vez que esse dado passa por um servidor. E a segunda descoberta: nenhuma migration em `supabase/migrations/` menciona `transacoes` ou `produtos_cadastrados_emissao_notas` — a policy `anon_read` explícita cobre `solicitacoes_pagamentos`, `financas_mp`, `automation_workflows*` e as seis `conciliador_contas_pagar_*`, mas essas duas tabelas não aparecem em nenhuma migration, o que sugere RLS nunca foi habilitada nelas (CRUD completo, não só leitura, via chave pública). O checklist de corte de D4-16 (item 4) lista as tabelas certas para o que ele cobriu, mas **não cobre `transacoes`/`produtos_cadastrados_emissao_notas`** — isso precisa virar um item novo do runbook de corte, verificado direto no Supabase Studio (dashboard/`pg_policies`), não por grep nas migrations.

**Primary recommendation:** tratar as oito leituras como três grupos de esforço bem diferentes — (A) Dashboard/Problemas/Aprovações pendentes/Plano de contas/Extratos/Workflows: uma rota `/v1/leituras/*` fina por cima de um endpoint que já existe, seguindo `contas-a-pagar-routes.ts` byte a byte na disciplina de autenticação; (B) Notas fiscais/Produtos: rota nova de verdade no `automation/`, com uma consulta direta às duas tabelas do `public` (a única leitura desta fase sem endpoint anterior) e allowlist de campos testada por nome; (C) o runbook de corte (D4-16), que precisa de um passo adicional para `transacoes`/`produtos_cadastrados_emissao_notas` que nenhum documento anterior cobriu.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Autenticação do Membro (JWT Supabase) | API / Backend (`apps/api`) | Browser (cookie da sessão) | Hook já existe desde 01-02; nenhuma rota nova precisa reimplementar isso — herda por registro na raiz de `app.ts` |
| Autorização por alcance à Pasta "Financeiro" | API / Backend (`apps/api`) | — | `memberReachesContainer` é puro no domínio; quem hidrata o Espaço e decide 403 é a rota, não o navegador nem o `automation/` |
| Projeção de DTO (allowlist de campos) | API / Backend (`automation/`, nas rotas `/v1/leituras/*`) | — | D4-05: quem lê o `public` é quem projeta — nunca repassar a linha inteira para o `apps/api` "confiar" em filtrar depois |
| Cálculo de estatísticas derivadas (Dashboard, Problemas) | API / Backend (`automation/`, funções puras re-homed) | — | D4-06: `buildDashboardStats`/`buildProblemRows` precisam de TODAS as 1.110 linhas de `solicitacoes_pagamentos` para calcular; mandar isso ao navegador para derivar lá violaria D4-05 |
| Cliente HTTP `apps/api` → `automation/` | API / Backend (`apps/api`) | — | Molde já existe em `invocar-agente.ts`; nenhuma chamada de rede nasce em `packages/dominio` |
| Renderização das 8 telas, filtro `?empresa=`, estado "backend indisponível" | Frontend Server + Browser (`apps/web`) | — | Composição de `src/design/`; fetch server-side (Server Component, seguindo `estado-inicial.ts`) ou client-side (React Query, seguindo o padrão do financeiro-tria) — decisão de discricionariedade, ver Pattern 3 |
| Upload de Extratos (validação de MIME/tamanho) | API / Backend (`apps/api`, proxy) | API / Backend (`automation/`, `bank-statement-webhooks.ts`, validação final) | D4-13: o navegador nunca fala com `automation/`; o `apps/api` é o primeiro ponto que pode recusar um arquivo malformado antes de gastar banda com o VPS |
| Gatilhos de emissão de NF (lote) | API / Backend (`automation/`, `markSeteDias`/`emitirNotas`, já existentes) | API / Backend (`apps/api`, proxy autenticado) | D4-12: nenhuma lógica nova — só autenticação em cima do `POST /workflows/:key/run` que já existe |
| Persistência de `transacoes`/`produtos_cadastrados_emissao_notas` | Database (Supabase `public`, projeto do financeiro-tria) | — | `apps/api` não alcança esse schema (D4-04); só o `automation/` lê/escreve ali |
| Corte do painel (`anon_read`, `AuthContext`, Vercel) | Database (RLS) + Infra (Vercel) | — | Fora do código desta fase até a etapa 4 do runbook D4-16; é operação, não feature |

## Standard Stack

Nenhum framework novo. As oito telas e as rotas novas reusam a stack já provada nesta fase e nas Fases 1–3. A única dependência nova identificada é `xlsx`, e só se a tela de Plano de contas portar a importação de planilha (D4-10 pede "import CSV" — o financeiro-tria de hoje importa `.xlsx` multi-aba via `PlanoContasImportDialog.tsx`).

### Core (já em uso — sem instalação nova)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | `^5.12.5` [VERIFIED: apps/api/package.json] | Servidor HTTP do `apps/api`; as rotas `/financeiro/*` registram como filhas da raiz de `app.ts`, herdando o hook de JWT | Já a base de toda a Fase 1–3 |
| `express` | (já em `financeiro-tria/automation/package.json`) [CITED: código lido em `automation/src/server.ts`] | Servidor do `automation/`; `/v1/leituras/*` é `Router` novo montado como os demais | CON-11: backend do financeiro-tria fica exatamente como está — nenhuma troca de framework |
| `zod` | `^4.6.5` (api) / `^4.6.1` (web) [VERIFIED: package.json] | Schemas `.strict()` nos DTOs de `/v1/leituras/*` e no proxy do `apps/api` | Mesma disciplina de `contas-a-pagar-routes.ts`/`esquemas-de-argumentos.ts` |
| `@supabase/supabase-js` | já em uso nos dois repos | Cliente service-role dentro do `automation/` para ler `public.transacoes`/`public.produtos_cadastrados_emissao_notas` (as duas únicas tabelas sem rota hoje) | Mesmo padrão de `plano-contas-routes.ts`/`workflow-store.ts` |
| `@tanstack/react-query` (opcional) | já em `apps/web`? — **verificar antes de assumir** | Se as telas usarem client-side fetch (padrão que o financeiro-tria usa hoje) em vez de Server Component | Ver Pattern 3 — nenhum precedente de React Query em `apps/web` foi encontrado nesta pesquisa; o precedente real é fetch em Server Component (`estado-inicial.ts`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `xlsx` (SheetJS) | `0.18.5` no npm registry (financeiro-tria já usa) [VERIFIED: npm view] | Parse de planilha multi-aba na importação do Plano de contas | Só se a tela de import for portada nesta fase, não adiada — ver Package Legitimacy Audit: **vulnerabilidade conhecida sem fix no registry npm** |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `xlsx` do registro npm (0.18.5) | `xlsx` 0.19.3+ via `https://cdn.sheetjs.com` (import direto, fora do npm registry) | O próprio SheetJS recomenda o CDN porque o fix de CVE-2023-30533 nunca foi publicado no npm; instalar via CDN é incomum no monorepo (não há precedente) e precisa de checkpoint humano |
| `xlsx` (parse client-side) | Exigir CSV (parse trivial, sem lib) e recusar `.xlsx` na tela nova | Reduz superfície de ataque a zero (nenhuma lib de parse de arquivo binário desconhecido); custa a paridade "mesma tela que o Financeiro já usa" se o Financeiro hoje importa `.xlsx` — decisão de produto, não técnica |
| Server Component fetch (`estado-inicial.ts`) | React Query client-side (precedente do financeiro-tria) | Server Component dá HTML já preenchido e reusa o padrão de erro 401/403/indisponível já testado; React Query dá `refetchInterval`/revalidação ao focar a aba "de graça" (D4-15 pede isso) — ver Pattern 3 |

**Installation:**
```bash
# Só se o import de Plano de contas entrar nesta fase (decisão do plano, não travada aqui):
npm install xlsx@0.18.5 -w @n1/web   # OU seguir a recomendação do SheetJS e importar de cdn.sheetjs.com — checkpoint humano obrigatório nos dois casos
```

**Version verification:** `npm view xlsx version` → `0.18.5` [VERIFIED: npm registry, 2026-09-23]. `npm view xlsx deprecated` → vazio (não depreciado no npm, mas tem CVE sem correção publicada — ver auditoria abaixo). Nenhuma outra dependência nova identificada para `apps/api`, `apps/web` ou `automation/` — todas as libs usadas pelas rotas novas já estão nos três `package.json`.

## Package Legitimacy Audit

Apenas `xlsx` é candidata a dependência nova nesta fase (só se a importação de Plano de contas entrar no escopo do plano, D4-10). Nenhuma outra biblioteca nova foi identificada — as rotas `/v1/leituras/*` reusam `express`/`zod`/`@supabase/supabase-js` já presentes em `financeiro-tria/automation`, e o proxy em `apps/api` reusa `fastify`/`zod` já presentes.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `xlsx` | npm | Última publicação 2022-03-24 (parada há ~4 anos) [VERIFIED: npm view] | 9.3M/semana [VERIFIED: npm view] | `github.com/SheetJS/sheetjs` | **OK** (seam) **mas SUS de fato** — ver nota abaixo | Flagged — planner deve inserir `checkpoint:human-verify` antes de instalar |

**Nota que a seam não captura:** o verdict `OK` do `gsd-tools query package-legitimacy check` reflete só existência/popularidade/repo — não CVEs. Busca dedicada [WebSearch, 2026-09-23] confirma **CVE-2023-30533** (prototype pollution, CWE-1321) em `xlsx` ≤0.19.2, e "uma versão não-vulnerável não pode ser encontrada via npm — o pacote no registro não é mais mantido; a correção (0.19.3+) só está disponível via `https://cdn.sheetjs.com`". Como a única consumidora seria um upload de arquivo `.xlsx` fornecido pelo usuário (dado não confiável, exatamente o vetor do CWE-1321), isto é um risco real, não teórico, mesmo com "OK" da seam.

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** `xlsx` — o plano que instalar esta dependência PRECISA de um `checkpoint:human-verify` decidindo entre (a) instalar `xlsx@0.18.5` do npm assumindo o risco documentado, (b) importar 0.19.3+ de `cdn.sheetjs.com` (fora do padrão do monorepo, precisa de justificativa registrada), ou (c) adiar a importação de planilha desta fase e a tela nascer só com CRUD manual + import por CSV sem lib (parse trivial de texto).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌────────────────────────────┐
│   apps/web (Next 16) │        │   apps/api (Fastify)      │        │  financeiro-tria/automation │
│   Browser + Server   │        │                            │        │  (Express)                   │
│   Component          │        │                            │        │                              │
│                       │  JWT   │                            │Bearer  │                              │
│  /financeiro/*  ─────┼───────>│ rotas/financeiro.ts (novo) ├───────>│ /v1/leituras/* (novo)        │
│  (fetch server-side   │Bearer  │  - registrarAutenticacao   │Service │   ├─ /notas-fiscais (NOVO,   │
│   ou client-side —    │(cookie)│    (hook herdado, root)    │Token   │   │  sem endpoint hoje)       │
│   Pattern 3)           │        │  - memberReachesContainer  │        │   ├─ /produtos (NOVO,        │
│                       │        │    (Pasta "Financeiro")    │        │   │  sem endpoint hoje)       │
│  Sem Realtime/cache    │        │  - proxy: fetch + timeout  │        │   ├─ /plano-contas (wrapper  │
│  (D4-15): botão        │        │    + sanitizarErro()       │        │   │  de GET /plano-contas)   │
│  "Atualizar", revalida │        │    (molde: invocar-        │        │   ├─ /extratos (upload,      │
│  ao focar a aba        │        │     agente.ts)             │        │   │  wrapper de POST         │
│                       │        │                            │        │   │  /webhook/receber-        │
│                       │        │  POST /financeiro/extratos │        │   │  whatsapp-doc/:origem)    │
│                       │        │    valida MIME/tamanho,    │        │   ├─ /workflows (wrapper de  │
│                       │        │    repassa corpo bruto      │        │   │  GET /workflows +        │
│                       │        │                            │        │   │  POST /workflows/:key/   │
│                       │        │                            │        │   │  run p/ D4-12)            │
│                       │        │                            │        │   └─ /dashboard,/problemas,  │
│                       │        │                            │        │      /aprovacoes-pendentes   │
│                       │        │                            │        │      (wrapper de GET          │
│                       │        │                            │        │      /financeiro/solicitacoes│
│                       │        │                            │        │      + buildDashboardStats/  │
│                       │        │                            │        │      buildProblemRows         │
│                       │        │                            │        │      re-homed, D4-06)         │
└─────────────────────┘        └──────────────────────────┘        └───────────┬──────────────────┘
                                                                                   │ service role
                                                                                   ▼
                                                                     ┌───────────────────────────┐
                                                                     │ Supabase `public` (projeto  │
                                                                     │ do financeiro-tria)          │
                                                                     │  solicitacoes_pagamentos     │
                                                                     │  transacoes                  │
                                                                     │  produtos_cadastrados_...    │
                                                                     │  conciliador_contas          │
                                                                     │  financas_mp                 │
                                                                     │  automation_workflow(_runs)  │
                                                                     └───────────────────────────┘

Rotas ANTIGAS (GET /automation/runs, /financeiro/solicitacoes, /plano-contas, /workflows,
PATCH /financeiro/solicitacoes/:id/aprovado) continuam públicas e intocadas até o corte
(D4-16, etapa 4) — o painel do Vercel ainda as usa.
```

### Recommended Project Structure

```
financeiro-tria/automation/src/http/
├── leituras-plataforma-routes.ts   # NOVO — /v1/leituras/* (ou um arquivo por leitura, discricionário)
├── leituras-plataforma-dtos.ts     # NOVO — allowlists explícitas (D4-05), testadas por nome de campo
└── financeiro-derivacoes.ts        # NOVO — buildDashboardStats/buildProblemRows re-homed (D4-06), puras, testadas

apps/api/src/
├── rotas/
│   └── financeiro.ts               # NOVO — GET /financeiro/{dashboard,notas-fiscais,produtos,plano-contas,
│                                    #        extratos-origens,workflows,problemas,aprovacoes-pendentes}
│                                    #        + POST /financeiro/extratos (upload)
│                                    #        + POST /financeiro/workflows/:key/executar (D4-12)
│                                    #        registrada em app.ts, filha da raiz (herda JWT), NÃO filha
│                                    #        do plugin PREFIXO_ROTAS_DE_SERVICO (esse é para automation→api)
└── automacoes/
    └── cliente-leituras-financeiro.ts  # NOVO — o "invocar-agente.ts" das leituras: fetch + timeout +
                                          #        classificar + sanitizarErro(), token PLATAFORMA_LEITURA_TOKEN

apps/web/src/
├── app/(shell)/financeiro/
│   ├── page.tsx                    # Dashboard (raiz de /financeiro)
│   ├── notas-fiscais/page.tsx
│   ├── produtos/page.tsx
│   ├── plano-contas/page.tsx
│   ├── extratos/page.tsx
│   ├── workflows/page.tsx
│   ├── problemas/page.tsx
│   └── aprovacoes-pendentes/page.tsx
└── features/financeiro/
    ├── dados/                      # fetch (Server Component ou client) — ver Pattern 3
    └── componentes/                # composição de src/design/ — sem CSS novo
```

### Pattern 1: Rota nova autenticada por Bearer em tempo constante (Express, `automation/`)
**What:** o exato molde já em produção para superfícies novas neste repositório.
**When to use:** toda rota sob `/v1/leituras/*`.
**Example:**
```typescript
// Source: financeiro-tria/automation/src/http/contas-a-pagar-routes.ts (03-07), lido nesta pesquisa
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
// 1) autenticar ANTES de tocar o corpo; 2) schema .strict(); 3) executar.
// MENSAGENS_FIXAS própria por arquivo — nunca pg.message, nunca stack, nunca eco do corpo.
```
Ordem obrigatória, replicada em toda rota nova: autenticar (401 sem tocar o corpo) → (idempotency-key só em escrita) → validar corpo com zod `.strict()` (400) → executar. O cabeçalho do arquivo real explica por que a disciplina é RECRIADA (não importada) em cada superfície nova — acoplar `/v1/leituras/*` ao módulo do contrato v1 (que é o sentido `automation/` → plataforma) seria o acoplamento errado.

### Pattern 2: Cliente HTTP `apps/api` → `automation/` (o "invocar-agente.ts" das leituras)
**What:** fetch com timeout, classificação transitório/permanente, log saneado.
**When to use:** toda chamada de `apps/api` para `/v1/leituras/*`.
**Example:**
```typescript
// Source: apps/api/src/automacoes/invocar-agente.ts (03-11), lido nesta pesquisa
async function chamar(caminho: string, corpo: unknown) {
  let resposta: Response | undefined;
  let erroDeRede: unknown;
  try {
    resposta = await fetchImpl(`${destinoUrl}${caminho}`, {
      method: "GET", // leituras são GET, sem idempotency-key (D4-03 nota: "GETs sem idempotência")
      headers: { authorization: `Bearer ${token}`, "x-request-id": randomUUID() },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (erro) { erroDeRede = erro; }
  // classificar(status, corpo, erroDeRede) — mesma lista fechada de STATUS_PERMANENTES
  // sanitizarErro() IMPORTADA de persistencia/outbox-worker — nunca reescrita
}
```
Diferença real com `invocar-agente.ts`: essa ponte é ESPECÍFICA (Contas a pagar, workspaceId/listId fixos, cache de aquecimento). O cliente de leituras é mais simples — sem cache, sem `rodarAgenda`, sem transação: é uma chamada HTTP por requisição HTTP recebida do `apps/web`, direto dentro do handler da rota (nunca dentro de uma Unidade de Trabalho — estas rotas não gravam no domínio).

### Pattern 3: Fetch fora do zustand store — duas opções com precedente, nenhuma travada
**What:** como uma tela do `apps/web` busca dado que NÃO está no `DataState` do domínio.
**When to use:** as oito telas do Financeiro — nenhuma delas grava/lê `plataforma.registros`.
**Precedente A — Server Component (usado hoje para a carga inicial do próprio store):**
```typescript
// Source: apps/web/src/dados/estado-inicial.ts, lido nesta pesquisa
import "server-only";
export const carregarEstadoInicial = cache(async (): Promise<EstadoInicial> => {
  const supabase = await clienteDoServidor();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { tipo: "semSessao" };
  const resposta = await fetch(`${apiUrl}/estado`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (resposta.status === 401) return { tipo: "semSessao" };
  if (resposta.status === 403) return { tipo: "semAcesso", motivo: ... };
  if (!resposta.ok) return { tipo: "indisponivel", erro: ... };
  // ...
});
```
Esse é o ÚNICO precedente real de fetch fora do store neste repositório, e já resolve exatamente o problema que D4-15 pede: distinguir 401 (sem sessão) / 403 (sem alcance) / indisponível (rede/500) — os três estados que a tela do Financeiro precisa renderizar. Recomendado como base: cada `page.tsx` do Financeiro é um Server Component que chama `GET /financeiro/<leitura>` do mesmo jeito.

**Precedente B — client-side com React Query (o padrão do financeiro-tria hoje, sem precedente em `apps/web`):**
dá `refetchInterval` "de graça" (D4-15 pede recarregar sob demanda + revalidar ao focar a aba — React Query tem isso built-in via `refetchOnWindowFocus`), mas exige confirmar se `@tanstack/react-query` já está instalado em `apps/web` (não confirmado nesta pesquisa — checar `apps/web/package.json` antes de assumir) e como um componente client soube o token (o cookie de sessão não é acessível a `fetch` client-side da mesma forma — precisaria de um route handler intermediário em `apps/web/src/app/api/financeiro/*` para repassar o cookie, uma camada a mais que o Precedente A não tem).
**Recomendação:** Precedente A (Server Component) para a carga inicial de cada tela + botão "Atualizar" que dispara uma Server Action ou um `router.refresh()` — sem introduzir React Query nem um route handler novo em `apps/web`, e sem inventar um mecanismo de refetch periódico que D4-15 nem pede ("sem Realtime e sem cache").

### Pattern 4: Autorização por alcance (D4-14)
**What:** `memberReachesContainer` já existe no domínio; a rota do `apps/api` decide.
**Example:**
```typescript
// Source: packages/dominio/src/derive.ts (lido nesta pesquisa) + apps/api/src/rotas/estado.ts (molde de rota não-operação)
import { memberReachesContainer } from "@n1/dominio/derive";
import { CP } from "@n1/dominio/operations/financeiro"; // CP.folderId === "fld_financeiro"

app.get("/financeiro/dashboard", async (request, reply) => {
  const cliente = await pool().connect();
  try {
    const { state } = await hidratar(cliente, request.membro.workspaceId);
    if (!memberReachesContainer(state, request.membro.id, "folder", CP.folderId)) {
      reply.code(403);
      return { error: "Sem acesso." };
    }
    // ... chamar automation/, projetar, devolver
  } finally {
    cliente.release();
  }
});
```
`CP.folderId` já é a constante existente (`fld_financeiro`, de `packages/dominio/src/operations/financeiro.ts`) — a mesma Pasta que 03-05 (PAG-06) e 03-15 usaram para visibilidade derivada de Tarefa. Nenhuma Concessão nova, nenhuma tabela de permissão nova: mesmo padrão que PAG-06 provou.
**Precedente de teste:** `packages/dominio/src/operations/pessoa-da-conta.test.ts` (03-05) — prova o caso negativo nos dois sentidos (quem alcança vê, quem não alcança recebe recusa nomeando o motivo). As rotas novas devem seguir a mesma forma de teste: um caso que prova 403 com Membro sem Grant nem Papel não-convidado, um caso que prova 200 com Membro que tem Papel base ≠ "convidado" na Pasta.

### Anti-Patterns to Avoid
- **Importar o módulo do contrato v1 em `/v1/leituras/*`:** o cabeçalho de `contas-a-pagar-routes.ts` é explícito — recriar a disciplina (auth, erro sanitizado) é intencional para não acoplar a superfície nova ao contrato `automation/`→plataforma, que é o sentido oposto.
- **Repassar a linha inteira de `solicitacoes_pagamentos`/`transacoes`:** é exatamente o que `GET /financeiro/solicitacoes` faz hoje (incluindo `app_key`/`app_secret`) e é a "pior consequência do desenho atual" segundo D4-05. Cada DTO novo é uma allowlist positiva, nunca um omit.
- **Tratar as 8 leituras como um bloco homogêneo de esforço:** Dashboard/Problemas/Aprovações/Plano de contas/Extratos/Workflows são wrappers finos sobre endpoints existentes; Notas fiscais/Produtos são rotas novas de verdade (sem precedente HTTP nenhum hoje). Um plano que estima as 8 igual vai subestimar essas duas.
- **Assumir que "Aprovações pendentes" tem uma tela de referência real no financeiro-tria:** `FinanceiroAprovacoes.tsx` (o arquivo com esse nome no financeiro-tria) é inteiramente mockado — "Solicitação #4821", "Cloudflare Brasil", checklist hardcoded. A tela real de Aprovações pendentes desta fase deriva de `solicitacoes_pagamentos.Aprovado !== true` (D4-11), do mesmo jeito que Problemas — não porta nenhuma linha desse arquivo mockado.
- **Confiar no checklist de tabelas de D4-16 como completo:** ele lista `solicitacoes_pagamentos`, `financas_mp`, `automation_workflows*`, `conciliador_*` — as únicas com migration de `anon_read` explícita. `transacoes` e `produtos_cadastrados_emissao_notas` não aparecem em nenhuma migration; o runbook de corte precisa de um passo extra para verificar RLS nelas diretamente no Supabase (ver Pitfall 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autenticação Bearer em tempo constante | Comparação de string ingênua (`===`) | `timingSafeEqual`/`createHash` do molde de `contas-a-pagar-routes.ts` | Timing attack — a disciplina já existe e é copiável |
| Classificação de erro de rede (retry ou não) | Heurística nova por rota | `classificar()`/`sanitizarErro()` de `invocar-agente.ts`/`outbox-worker.ts` | Evita reinventar a lista fechada de status permanentes/transitórios que já foi provada em 03-11 |
| Autorização "quem vê a Pasta Financeiro" | Tabela de permissão nova, Concessão manual por Membro | `memberReachesContainer` (domínio) | PAG-06 (03-05) já provou que visibilidade derivada é o caminho; Concessão escrita à mão é o antipadrão nomeado no CONTEXT |
| Cálculo de estatísticas do Dashboard no navegador | Buscar as 1.110 linhas e agregar em `useMemo` (como o financeiro-tria faz hoje implicitamente via `buildDashboardStats` chamada no cliente) | `buildDashboardStats`/`buildProblemRows` re-homed como função pura no `automation/`, chamada dentro da rota | D4-06: mandar 1.110 linhas ao navegador para agregar é o oposto de D4-05 (projeção mínima) |
| Parse de planilha para Plano de contas | Parser CSV/XLSX escrito à mão | `xlsx` (com a ressalva do Package Legitimacy Audit) ou exigir CSV puro | Parsers de formato binário à mão são a fonte clássica de bug de segurança em upload — mas a lib escolhida também precisa de escrutínio (ver auditoria) |

**Key insight:** nesta fase, "não hand-rollar" significa sobretudo NÃO reescrever disciplinas que já existem duas vezes no próprio código (Bearer em tempo constante, classificação de erro, alcance derivado) — o risco não é falta de biblioteca, é duplicar/divergir de um padrão que dois planos anteriores (03-05, 03-07/03-11) já pagaram o custo de acertar.

## Inventário exato das 8 leituras

Fontes: `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.7/§7 [CITED, medido 2026-09-15] + leitura direta do código do `financeiro-tria` nesta pesquisa [VERIFIED].

| # | Tela (rota atual) | Fonte de dados hoje | Endpoint HTTP já existe? | Linhas (§5.7) | Colunas que a tela exibe | Colunas que NUNCA podem cruzar a fronteira |
|---|---|---|---|---:|---|---|
| 1 | Notas fiscais (`/financeiro/notas-fiscais`) | `public.transacoes` via **anon direto** (sem backend) | **NÃO** — nenhuma rota HTTP toca essa tabela hoje | 1.987 | `id_pedido`, `nome_completo`, `email`, `status_pedido`, `plataforma`, `produtos`, `valor_total`, `forma_pagamento`, `controle_emissao`, `emissao_nota_produto`, `emissao_nota_servico`, `nota_cancelamento`, `"7 dias"`, `data_aprovacao_pagamento` | `api_key`, `app_secret` (credencial por linha), `cpf_cnpj` (documento completo), `telefone`, endereço completo (`cep`,`logradouro`,`numero`,`complemento`,`bairro`,`cidade`,`estado`,`pais`), `id_conta_corrente` |
| 2 | Produtos (`/financeiro/produtos`) | `public.produtos_cadastrados_emissao_notas` via **anon direto** | **NÃO** — nenhuma rota HTTP toca essa tabela hoje | 42 | `id_produto`, `nome_produto`, `porcentagem_servico`, `porcentagem_produto` | nenhuma — a tabela não tem coluna sensível (6 colunas ao todo, todas exibíveis) |
| 3 | Plano de contas (`/financeiro/plano-contas`) | `public.conciliador_contas` (filtro `metadata @> {empresa,tipo}`) — **NÃO** `planos_de_contas` (0 linhas, morta) | **SIM** — `GET/POST /plano-contas`, `DELETE /plano-contas/:id` (`plano-contas-routes.ts`) | 276 (unificada) + 62/51/31 nas 3 antigas ainda populadas | `id`, `content` (texto formatado: código, categoria, categoria ClickUp, descrição — parseado no cliente por regex) | nenhuma — a tabela não tem PII; `content` já é texto de RAG, sem segredo |
| 4 | Extratos do Marcos (`/financeiro/upload`) | Upload direto para `public.financas_mp` via webhook (nunca lido de volta nesta tela — é só formulário de envio) | **SIM** — `POST /webhook/receber-whatsapp-doc/:origem` (`bank-statement-webhooks.ts`), corpo bruto (`raw`, `type: "*/*"`, limite 25MB) | 469 (`financas_mp`, não exibidas nesta tela) | Nenhuma leitura nesta tela — é só formulário de upload por origem (nubank, itau_unibanco, btg_pactual, btg_cartao, nubank_violeta, personallite_black, azul_infinity) | N/A (não há leitura de linha aqui) |
| 5 | Workflows (`/financeiro/workflows`) | `SYSTEM_WORKFLOWS` (catálogo hardcoded em `catalog.ts`, não é tabela) + `automation_workflow_runs` (histórico) | **SIM** — `GET /workflows`, `GET /workflows/:key`, `GET /workflows/runs`, `POST /workflows/:key/run` (`workflow-routes.ts`) | 236 (`automation_workflow_runs`) | `key`, `name`, `description`, `tenant`, `trigger` (tipo+detalhe), `webhookPath`, `steps`, `lastRun` (status/started_at/finished_at) | nenhuma — catálogo e runs não carregam credencial |
| 6 | Dashboard (`/financeiro`) | `public.solicitacoes_pagamentos` (todas as linhas) → `buildDashboardStats` no cliente hoje | **SIM** (dado bruto) — `GET /financeiro/solicitacoes[?empresa=]`; **função de derivação re-homed** (D4-06) | 1.110 | 4 métricas agregadas (total, aguardando aprovação, contas a pagar, aprovadas) + até 3 itens "precisa da sua atenção" + 2 "problemas abertos" | as 14 colunas de `solicitacoes_pagamentos` — sobretudo `app_key`/`app_secret` — nunca cruzam; só os agregados e os campos projetados (`id`, título calculado, status, owner) |
| 7 | Problemas (`/financeiro/problemas`) | idem #6 → `buildProblemRows` no cliente hoje | idem #6 | idem #6 | `id` (`SP-<id>`), severidade, título, descrição (do `comentario_aprovacao`/`comentario`, formatado), `where` (categoria+fornecedor), `age` (previsão), `technical` (`TaskID`/categoria/tipo) | idem #6 |
| 8 | Aprovações pendentes (`/financeiro/aprovacoes-pendentes`) | idem #6, filtrado por `Aprovado !== true` (D4-11) — **a tela real do financeiro-tria com esse nome é mockada, não é a fonte** | idem #6 (mesmo endpoint, filtro diferente) | idem #6 | subconjunto de #6/#7 — id, fornecedor, status, previsão, sem botão de decidir | idem #6 |

**Colunas de `solicitacoes_pagamentos` (14, completas) [VERIFIED: `src/integrations/supabase/types.ts`]:** `id`, `app_key`, `app_secret`, `Aprovado`, `banco_de_categorias`, `centro_custo`, `comentario`, `comentario_aprovacao`, `ComentarioID`, `Data_previsao`, `id_responsavel`, `TaskID`, `ThreadID`, `tipo`.

**Colunas de `transacoes` (32, completas) [VERIFIED: `src/integrations/supabase/types.ts`]:** `id`, `"7 dias"`, `api_key`, `app_secret`, `bairro`, `centro_custo`, `cep`, `cidade`, `cod_categoria`, `complemento`, `controle_emissao`, `cpf_cnpj`, `data_aprovacao_pagamento`, `email`, `emissao_nota_produto`, `emissao_nota_servico`, `estado`, `forma_pagamento`, `id_conta_corrente`, `id_pedido`, `id_servico`, `logradouro`, `nome_completo`, `nota_cancelamento`, `numero`, `pais`, `plataforma`, `produtos`, `status_pedido`, `taxa_produto`, `taxa_servico`, `telefone`, `tipo_pessoa`, `valor_total`.

## Common Pitfalls

### Pitfall 1: D4-16 lista as tabelas erradas para o corte de RLS — `transacoes`/`produtos_cadastrados_emissao_notas` faltam
**What goes wrong:** um plano que segue D4-16 item 4 literalmente ("remover a policy `anon_read` de `solicitacoes_pagamentos`, `financas_mp`, `automation_workflows*`, `conciliador_*`") deixa `transacoes` e `produtos_cadastrados_emissao_notas` acessíveis por `anon` para sempre — incluindo ESCRITA (INSERT/UPDATE/DELETE), porque o front de hoje faz CRUD completo nelas via `supabase.from("transacoes").insert/update/delete`.
**Why it happens:** essas duas tabelas nunca apareceram em nenhuma migration versionada (`grep -rl "transacoes" supabase/migrations/*.sql` não encontra nada) — foram provavelmente criadas direto pelo Supabase Studio/Lovable antes do fluxo de migrations existir, então RLS pode nunca ter sido habilitada (comportamento padrão do Postgres: sem `ENABLE ROW LEVEL SECURITY`, qualquer role com `SELECT`/`INSERT`/`UPDATE`/`DELETE` na tabela — incluindo `anon`, se o Supabase concedeu por padrão — passa).
**How to avoid:** o runbook de corte (D4-16, etapa 4) precisa de um passo adicional, verificado direto no dashboard do Supabase (ou `select * from pg_policies where tablename in ('transacoes','produtos_cadastrados_emissao_notas')` e `select relrowsecurity from pg_class where relname in (...)`, não por grep no repositório) antes de considerar o corte completo.
**Warning signs:** `npm run check` verde não pega isso — é um estado de banco, não de código. Só aparece testando `curl` com a chave `anon` contra essas duas tabelas depois do corte.

### Pitfall 2: Tratar `/v1/leituras/*` como um espelho 1:1 das rotas antigas
**What goes wrong:** Notas fiscais e Produtos não têm rota antiga para espelhar — um plano que assume "toda rota nova é `contas-a-pagar-routes.ts` + trocar o nome" vai subdimensionar essas duas (que precisam de uma consulta nova ao `public.transacoes`/`public.produtos_cadastrados_emissao_notas`, não de um wrapper).
**Why it happens:** as outras 6 leituras TÊM endpoint hoje, então a tentação de generalizar é forte.
**How to avoid:** planejar Notas fiscais e Produtos como tarefas de tamanho comparável às rotas de escrita (D4-07), não às de wrapper — elas envolvem desenhar o DTO do zero, decidir paginação (1.987 linhas é acima do limite de 500 que `listSolicitacoesPagamentos()` já usa — `/v1/leituras/notas-fiscais` provavelmente precisa de paginação real, que nenhuma rota existente do `automation/` tem hoje) e escrever teste de allowlist do zero.
**Warning signs:** um plano com uma Task só para "as 8 rotas de `/v1/leituras/*`" sem diferenciar as duas sem-precedente.

### Pitfall 3: Confundir `planos_de_contas` (vazia, morta) com `conciliador_contas` (real, 276+144 linhas)
**What goes wrong:** REQUIREMENTS.md (TELA-01) e o texto solto de alguns documentos dizem "Plano de contas ... tabela hoje vazia" — um plano que porta literalmente a tabela `planos_de_contas` entrega uma tela sempre vazia, sem valor.
**Why it happens:** o nome da tela ("Plano de contas") e o nome da tabela vazia (`planos_de_contas`) são quase idênticos; o código real (`plano-contas-routes.ts`, `FinanceiroPlanoContas.tsx`) já corrigiu isso silenciosamente lendo `conciliador_contas`, sem que a documentação de mais alto nível tenha sido atualizada.
**How to avoid:** D4-10 já resolve isso em texto ("o de-para que funciona de verdade é o RAG em `conciliador_contas`") — mas um plano precisa apontar EXPLICITAMENTE para a tabela `conciliador_contas` (com filtro `metadata @> {empresa, tipo}`) e nunca para `planos_de_contas`, para não repetir o erro do nome.
**Warning signs:** qualquer menção a `planos_de_contas` (singular malformado / com "s" antes de "de") num plano ou numa rota nova é sinal de confusão com a tabela morta.

### Pitfall 4: Autenticar a rota nova de `apps/api` no plugin errado
**What goes wrong:** registrar `rotas/financeiro.ts` dentro do plugin `PREFIXO_ROTAS_DE_SERVICO` (o mesmo de `/v1/integrations/payment-requests/*`) faria essas rotas exigirem credencial de SERVIÇO (a de `automation/`→`apps/api`), não JWT de Membro — inversão de quem chama quem.
**Why it happens:** as duas famílias de rota ("serviço chamando `apps/api`" e "Membro chamando `apps/api`") vivem no mesmo arquivo `app.ts`, lado a lado, e é fácil copiar o bloco errado.
**How to avoid:** `rotas/financeiro.ts` registra como `rotasDeOperacoes`/`rotasDeEstado` — direto em `app.register(rotasDeFinanceiro)` na raiz, ANTES/depois do bloco `PREFIXO_ROTAS_DE_SERVICO`, herdando `registrarAutenticacao` (JWT) por estar na raiz, nunca dentro do `app.register(async (integracao) => {...}, { prefix: PREFIXO_ROTAS_DE_SERVICO })`.
**Warning signs:** teste de rota que espera 401 sem JWT mas passa sem cabeçalho nenhum (sinal de estar sob o hook errado ou sem hook).

## Code Examples

Ver Pattern 1–4 acima — todos os exemplos vêm de arquivos lidos nesta sessão (`contas-a-pagar-routes.ts`, `invocar-agente.ts`, `estado-inicial.ts`, `derive.ts`, `estado.ts`) e já são "verified patterns from the codebase", não de documentação externa. Dois trechos adicionais relevantes para D4-12 (gatilhos de NF):

### Disparo assíncrono já existente para os dois gatilhos de emissão
```typescript
// Source: financeiro-tria/automation/src/http/workflow-routes.ts, lido nesta pesquisa
router.post("/workflows/:key/run", async (req, res) => {
  const wf = getSystemWorkflow(String(req.params.key));
  if (!wf?.manualRunKey) return res.status(400).json({ ok: false, error: "..." });
  const runner = wf.manualRunKey === "mark-7days" ? () => markSeteDias("manual") : () => emitirNotas("manual");
  runner().catch((e) => console.error(...)); // dispara em background
  res.status(202).json({ ok: true, accepted: true, key: wf.key, message: "Execução iniciada..." });
});
```
D4-12 não precisa de rota nova no `automation/` para os dois botões — só precisa que `/v1/leituras/*` (ou um irmão de escrita, já que isto MUTA dados) exponha um proxy autenticado para `POST /workflows/tria-invoice-mark-7days/run` e `POST /workflows/tria-invoice-emit/run`. `manualRunKey` já é o union type fechado `"mark-7days" | "emit"` — nenhuma emissão por linha é alcançável por este caminho, confirmando a garantia de D4-12 por construção de tipo, não só por disciplina.

### Assinatura real de `markSeteDias`/`emitirNotas`
```typescript
// Source: financeiro-tria/automation/src/tenants/tria/invoice-emission/invoice-emission-service.ts, lido nesta pesquisa
export async function markSeteDias(triggerSource: string = "cron") {
  // devolve { processados: number, marcados: Array<{ id_pedido, cliente?, produto?, dias }> }
}
export async function emitirNotas(triggerSource: string = "cron") {
  // guarda contra execução concorrente (emitInFlight); devolve { processados, resultados: EmitResultado[] }
  // ou { skipped: true, processados: 0, resultados: [] } se já em execução
}
```
`controle_emissao`/`emissao_nota_produto`/`emissao_nota_servico`: `emissao_nota_produto` marca a NF de produto emitida (`IncluirPedido → FaturarPedido`); `controle_emissao` + `emissao_nota_servico` marcam a NF de serviço emitida (`IncluirOS → FaturarOS`). A tela renderiza os três como já pede D4-12 — nenhum precisa de interpretação nova, são flags booleanas diretas da linha de `transacoes`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Documentação de mais alto nível chama a tabela do Plano de contas de `planos_de_contas` (vazia) | O código real (`plano-contas-routes.ts`, escrito antes desta fase) já lê `conciliador_contas` | Já em produção antes desta fase — não é uma mudança que esta fase provoca, é uma correção de entendimento | Um plano baseado só em REQUIREMENTS.md/texto solto erraria a tabela; baseado no código lido nesta pesquisa, acerta |
| `AuthContext` + chave `anon` do Supabase como "autenticação" do painel do Vercel | JWT do Supabase Auth resolvido no `apps/api` (D-02, desde a Fase 1) + credencial de serviço `apps/api`→`automation/` (D4-01/D4-02) | Fase 1 (Membro real) + esta fase (leitura autenticada) | O painel nunca teve autenticação de usuário de verdade — só RLS aberta (`anon_read`) — esta fase é a primeira vez que "quem vê o quê" é decidido por identidade real |

**Deprecated/outdated:** `realIntegrations` (array fictício com `lastRun: "tempo real"` escrito à mão em `solicitacoesPagamentos.ts`) — nunca foi dado real e D4-06 confirma que não é portado.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `apps/web` não tem `@tanstack/react-query` instalado hoje (não confirmado por leitura direta de `apps/web/package.json` nesta sessão) | Pattern 3 | Se já estiver instalado, o Precedente B fica mais barato do que esta pesquisa assume — verificar antes de descartar |
| A2 | O runbook de corte (D4-16) pode ganhar um passo extra sem violar a decisão travada — interpretado como "detalhamento operacional", não como reabertura da decisão | Pitfall 1 | Se o dono entender que isso reabre D4-16, precisa virar uma pergunta de discuss-phase, não uma adição silenciosa do plano |
| A3 | `PLATAFORMA_LEITURA_TOKEN` segue a mesma convenção de nome de `PLATAFORMA_LANCAMENTO_TOKEN` (`optionalEnv`, nunca `requiredEnv`, string vazia nunca autentica) — inferido do padrão, não lido em nenhum `.env.example` (acesso negado nesta sessão) | Standard Stack / Pattern 1 | Baixo — é convenção já estabelecida em dois lugares (D-15, 02-09), improvável de divergir |
| A4 | A paginação de `/v1/leituras/notas-fiscais` (1.987 linhas) precisa ser desenhada do zero porque nenhuma rota existente do `automation/` pagina de verdade (`listSolicitacoesPagamentos` só faz `.limit(500)`, sem cursor) | Pitfall 2 | Médio — se o plano assumir que 1.987 linhas cabem numa resposta só sem paginação, pode funcionar (payload pequeno) mas destoa do padrão de D4-15 "recarregar sob demanda" |

**Se esta tabela estivesse vazia:** não está — quatro itens precisam de confirmação antes de virarem decisão travada de plano.

## Open Questions

1. **`transacoes`/`produtos_cadastrados_emissao_notas` têm RLS habilitada hoje?**
   - What we know: nenhuma migration versionada as menciona; o front faz CRUD completo via `anon` sem erro aparente.
   - What's unclear: se RLS está desabilitada (acesso total por `anon`) ou se há uma policy criada fora do fluxo de migrations (direto no dashboard) que não está no `git log`.
   - Recommendation: verificar direto no Supabase Studio do projeto do financeiro-tria antes de escrever o passo do runbook de corte; se motivo confirmado como "sem RLS", isso é uma exposição de segurança ATUAL (não desta fase) que talvez mereça um alerta separado ao dono, independente do cronograma de D4-16.

2. **`@tanstack/react-query` já está em `apps/web`?**
   - What we know: é dependência do financeiro-tria (`package.json` da raiz daquele repo); não foi confirmado em `apps/web/package.json` nesta sessão.
   - What's unclear: se instalar ou não muda o custo relativo do Pattern 3.
   - Recommendation: checar `apps/web/package.json` no início do planejamento; se ausente, Server Component (Precedente A) é a opção sem instalação nova e com precedente testado.

3. **Onde mora a paginação/filtro de Notas fiscais (1.987 linhas, com filtros por `status_pedido`/`plataforma`/`controle_emissao`/etc.)?**
   - What we know: hoje o filtro roda 100% no cliente (`useMemo` sobre `allTransacoes`, buscado inteiro em lotes de 1000 pelo Supabase JS).
   - What's unclear: se `/v1/leituras/notas-fiscais` deve aceitar query params de filtro (empurrando o filtro para o `automation/`/Postgres) ou devolver tudo projetado e deixar o filtro no `apps/web` (mais simples, mas manda ~1.987 linhas projetadas a cada carga).
   - Recommendation: como D4-05 já aceita mandar linhas projetadas (não é dado sensível depois do DTO), começar simples (sem filtro server-side) é aceitável dado o volume (1.987 linhas projetadas é payload pequeno) — mas isso é decisão de plano, não travada aqui.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|----------|----------|
| Node.js (ambos os repos) | `apps/api`, `automation/` | ✓ (assumido pelo monorepo já rodando) | não reverificado nesta sessão | — |
| `automation/` rodando localmente (`PORT=4100` por padrão) | Testes de integração ponta a ponta desta fase | Não verificado nesta sessão (fora do escopo de leitura) | — | testes que dependem de rede real pulam sem env — mesma disciplina de `tsx --test` já usada |
| Acesso de escrita ao worktree `../financeiro-tria` sem tocar os 89 arquivos não commitados | Todos os planos que tocam `automation/` | ✓ — worktree existe e é gravável, mas **89 arquivos modificados sem relação com esta fase** já estão lá | — | cada plano deve listar exatamente os arquivos que toca (`git status` antes/depois) e nunca `git add -A`/`git clean` nesse worktree |
| `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL` do projeto do financeiro-tria, no ambiente do `automation/` | Rotas novas que leem `transacoes`/`produtos_cadastrados_emissao_notas` diretamente | Não verificado nesta sessão (`.env` fora de alcance de leitura) | — | já é como `plano-contas-routes.ts`/`workflow-store.ts` leem hoje — mesma variável, sem novidade |

**Missing dependencies with no fallback:** nenhuma identificada — toda infraestrutura necessária já existe nos dois repositórios.

**Missing dependencies with fallback:** verificação de `automation/` rodando localmente para testes de integração — cai no padrão já estabelecido (`servidorFalso`/HTTP local em teste, testes de rede real pulam sem env).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (`apps/api`, `apps/web`, `packages/dominio`) | Vitest (`vitest.config.mts` em cada workspace) [VERIFIED: arquivos encontrados] |
| Framework (`financeiro-tria/automation`) | `node:test` via `tsx --test --test-concurrency=1 "src/**/*.test.ts"` [VERIFIED: `automation/package.json`] |
| Config file | `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts`; `automation/` sem config — script no `package.json` |
| Quick run command | `npm run test -w @n1/api -- financeiro` (ou o nome do arquivo) / `cd financeiro-tria/automation && npx tsx --test src/http/leituras-plataforma-routes.test.ts` |
| Full suite command | `npm run check` (raiz — typecheck+lint+tokens+test nos 3 workspaces) / `cd financeiro-tria/automation && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| TELA-01 (auth) | Rota `/v1/leituras/*` recusa sem Bearer / com Bearer errado, em tempo constante | unit | `cd financeiro-tria/automation && npx tsx --test src/http/leituras-plataforma-routes.test.ts` | ❌ Wave 0 |
| TELA-01 (DTO) | Cada DTO nunca contém `app_key`/`app_secret`/`api_key`/`cpf_cnpj`/campos de endereço — provado por nome de campo, não por snapshot | unit | idem acima | ❌ Wave 0 |
| TELA-01 (alcance) | `apps/api` devolve 403 para Membro sem alcance à Pasta "Financeiro", 200 para quem alcança | unit | `npm run test -w @n1/api -- financeiro` | ❌ Wave 0 |
| TELA-01 (cliente HTTP) | Timeout, classificação transitório/permanente, log saneado (mesma forma de `invocar-agente.test.ts`, casos (f)-(m)) | unit | `npm run test -w @n1/api -- cliente-leituras-financeiro` | ❌ Wave 0 |
| TELA-01 (Dashboard/Problemas) | `buildDashboardStats`/`buildProblemRows` re-homed produzem o MESMO resultado que as funções originais do financeiro-tria (fixture idêntica) | unit | `cd financeiro-tria/automation && npx tsx --test src/tenants/tria/financeiro-derivacoes.test.ts` | ❌ Wave 0 |
| TELA-01 (upload de Extratos) | Proxy do `apps/api` recusa MIME/tamanho fora do esperado ANTES de repassar ao `automation/` | unit | `npm run test -w @n1/api -- extratos` | ❌ Wave 0 |
| TELA-01 (E2E crítico) | Um Membro com alcance vê as 8 leituras carregadas via `apps/api`; um Membro sem alcance não vê `/financeiro` na navegação | e2e (Playwright, precedente de 02-01) | `npm run test -w @n1/web -- --grep financeiro` (Playwright) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** rodar o teste do arquivo tocado (`npm run test -w @n1/api -- <arquivo>` ou `npx tsx --test <arquivo>` no `automation/`).
- **Per wave merge:** `npm run check` na raiz do `crm-n1` + `npm test` no `automation/` (os dois repositórios, porque CON-05 exige `automation/` com `git log` limpo fora do que os planos tocam deliberadamente).
- **Phase gate:** as duas suítes verdes + a prova manual (ou Playwright) de que `financeiro-tria.vercel.app` continua respondendo (D4-16 exige "painel no ar" durante toda a fase, até a etapa 3 do corte).

### Wave 0 Gaps
- [ ] `financeiro-tria/automation/src/http/leituras-plataforma-routes.test.ts` — cobre TELA-01 (auth + DTO)
- [ ] `financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.test.ts` — cobre D4-06 (equivalência com as funções originais)
- [ ] `apps/api/src/rotas/financeiro.test.ts` — cobre TELA-01 (alcance, proxy, upload)
- [ ] `apps/api/src/automacoes/cliente-leituras-financeiro.test.ts` — cobre o cliente HTTP (timeout/classificação), seguindo os casos (f)-(m) de `invocar-agente.test.ts` como molde
- [ ] Fixture compartilhada de `solicitacoes_pagamentos`/`transacoes` (sem dado real, sem credencial real) para os testes de allowlist e de equivalência de `buildDashboardStats`/`buildProblemRows`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | yes | JWT do Supabase (Membro, já existente) + Bearer de serviço em tempo constante (`timingSafeEqual`, molde de `contas-a-pagar-routes.ts`) |
| V3 Session Management | yes (indireto) | Sessão do `apps/web` já gerida por `@supabase/ssr` (cookie); nenhuma sessão nova nasce nesta fase |
| V4 Access Control | yes | `memberReachesContainer` (Pasta "Financeiro") — mesmo padrão de PAG-06; NUNCA confiar em "o front escondeu o link" como controle |
| V5 Input Validation | yes | `zod().strict()` em todo DTO/corpo novo, dos dois lados (`apps/api` e `automation/`) — schema desconhecido é 400, nunca ignorado |
| V6 Cryptography | yes (parcial) | Comparação de credencial em tempo constante já resolvida pelo molde copiado (`createHash`+`timingSafeEqual`) — nenhuma criptografia nova a desenhar |
| V9 Communications | yes | `Authorization: Bearer` sobre HTTPS (VPS do `automation/`); nenhum dado sensível em query string |
| V12 Files | yes | Upload de Extratos: validar MIME/tamanho no `apps/api` ANTES de repassar (D4-13); `raw({ type: "*/*", limit })` no `automation/` já limita tamanho, mas não valida conteúdo — o proxy novo é a primeira camada real de validação |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Vazamento de credencial por linha (`app_key`/`app_secret`/`api_key`) via resposta de API | Information Disclosure | Allowlist positiva por DTO (D4-05), testada por nome de campo — nunca omit/blacklist |
| Timing attack na comparação do Bearer de serviço | Information Disclosure | `timingSafeEqual` (já no molde copiado) |
| RLS ausente/mal configurada permitindo escrita por `anon` (achado real em `transacoes`/`produtos_cadastrados_emissao_notas`) | Tampering / Elevation of Privilege | Verificar RLS direto no Postgres antes do corte (Pitfall 1); não depender só de grep em migrations |
| Prototype pollution via arquivo `.xlsx` malicioso no import de Plano de contas (CVE-2023-30533) | Tampering | Ver Package Legitimacy Audit — checkpoint humano antes de instalar `xlsx`, considerar exigir CSV puro como alternativa mais segura |
| Origem do upload de Extratos fora da allowlist (`MP_RECEBIMENTO_SOURCE`) recusada só em produção | Denial of Service (operacional, não malicioso) | D4-13 já nomeia o risco — validar a allowlist em ambiente de staging/local antes do deploy real |
| CORS mal configurado permitindo que qualquer origem chame `apps/api` com o JWT de quem estiver logado noutra aba | Spoofing | `apps/api/src/app.ts` já usa allowlist explícita (`webOrigin`, nunca `*`) — rotas novas herdam isso por estarem na raiz, não precisam de configuração extra |

## Sources

### Primary (HIGH confidence — código lido nesta sessão)
- `financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` — molde de rota nova autenticada
- `apps/api/src/automacoes/invocar-agente.ts` — molde de cliente HTTP
- `apps/api/src/app.ts`, `apps/api/src/rotas/estado.ts` — registro de rota, hook de autenticação, molde de rota não-operação
- `packages/dominio/src/derive.ts` (`memberReachesContainer`), `packages/dominio/src/operations/financeiro.ts` (`CP.folderId`)
- `financeiro-tria/automation/src/http/{routes.ts,plano-contas-routes.ts,workflow-routes.ts,bank-statement-webhooks.ts}`
- `financeiro-tria/automation/src/tenants/tria/invoice-emission/invoice-emission-service.ts`
- `financeiro-tria/automation/src/workflows/{catalog.ts,workflow-store.ts}`
- `financeiro-tria/automation/src/adapters/supabase.ts`
- `financeiro-tria/src/pages/{NotasFiscais.tsx,Produtos.tsx}`, `financeiro-tria/src/pages/financeiro/*.tsx`, `financeiro-tria/src/features/financeiro/data/solicitacoesPagamentos.ts`, `.../data/workflows.ts` (referência de leitura — nada portado como código)
- `financeiro-tria/src/integrations/supabase/types.ts` — colunas exatas de `solicitacoes_pagamentos`/`transacoes`/`produtos_cadastrados_emissao_notas`/`financas_mp`
- `financeiro-tria/supabase/migrations/*anon_read*.sql`, `*rls_conciliador_anon_read*.sql`
- `financeiro-tria/vercel.json`, `financeiro-tria/src/contexts/AuthContext.tsx` (localizado, não lido byte a byte)
- `apps/web/src/dados/estado-inicial.ts`, `apps/web/src/features/shell/app-shell.tsx`, `apps/web/src/proxy.ts`, `apps/web/src/dados/store.ts`
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md`

### Secondary (MEDIUM confidence)
- `npm view xlsx version|deprecated` — verificado via registro npm, 2026-09-23

### Tertiary (LOW confidence)
- WebSearch sobre CVE-2023-30533 (SheetJS/xlsx) — cruzado com GitHub Advisory Database e Snyk nos resultados de busca; não abri cada fonte individualmente, mas o consenso entre elas (npm sem fix, CDN oficial recomendado) é consistente

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma lib nova exceto `xlsx`, que foi verificada via `npm view`
- Architecture: HIGH — os quatro moldes (rota nova, cliente HTTP, fetch fora do store, alcance derivado) vêm de código real já em produção neste mesmo par de repositórios
- Pitfalls: HIGH para os achados de código (RLS ausente, tabela errada, plugin errado); MEDIUM para a extensão do runbook de corte (depende de confirmação no Supabase Studio, fora do alcance desta pesquisa)

**Research date:** 2026-09-23
**Valid until:** 30 dias (stack estável; o volume de linhas e o estado do worktree sujo do `financeiro-tria` podem mudar mais rápido — reconferir `git status` no início do planejamento)
