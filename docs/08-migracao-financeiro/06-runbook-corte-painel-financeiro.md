# Runbook do corte — `financeiro-tria.vercel.app` e o fim do `anon_read`

**Plano:** 04-14 (fecha a Fase 4 — as oito leituras do Financeiro dentro do CRM N1).
**Escrito em:** 2026-09-23, no modo **PREPARE-ONLY**: o usuário, num checkpoint
explícito, escolheu "preparar tudo, parar antes do irreversível". Este
documento e a migração `20261001120000_remove_anon_read_painel.sql` (no
repositório `financeiro-tria`) são os únicos artefatos desta sessão. Nada foi
pausado, nada foi removido, nenhuma migração foi aplicada.

Não confundir com `06-runbook-de-corte.md`, neste mesmo diretório — aquele é o
corte do **ClickUp** (Plano 03-14, a Lista `901107637383`), um sistema e uma
decisão diferentes. Este runbook é o corte do **painel Vercel do financeiro-tria**
e da policy `anon_read` que o sustenta. Os dois compartilham o padrão (passo
verificável, nunca narrativa), não o conteúdo.

## O que esta sessão fez, e o que não fez

**Fez:**
- Escreveu este runbook, com o inventário de policies lido diretamente das
  migrations (não do texto de D4-16, que está incompleto) e as duas consultas
  de verificação prontas para copiar e colar no Supabase Studio.
- Autorou `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql`
  como ARQUIVO — commitado no repositório `financeiro-tria`, mas nunca
  aplicado a nenhum Postgres. O arquivo tem um banner `NOT YET APPLIED` no
  próprio cabeçalho SQL.
- Rodou e registrou os `grep` de prova para cada rota candidata a remoção do
  Passo 4 de D4-16 (seção "Prova de que ninguém mais chama", abaixo).

**Não fez, e por que nenhum destes é seguro de automatizar hoje:**
- Não tocou o Vercel — não há credencial disponível ao executor, e pausar o
  projeto é uma decisão do dono do produto, não uma ação de código.
- Não removeu nenhuma rota de `automation/src/http/routes.ts`,
  `plano-contas-routes.ts` ou `workflow-routes.ts`, nem editou `server.ts` ou
  `src/contexts/AuthContext.tsx`. D4-16 ordena essas remoções DEPOIS da
  pausa do Vercel (etapa 3), e a pausa não aconteceu.
- Não rodou `supabase db push` nem qualquer consulta contra o banco do
  `financeiro-tria`. A migração escrita é um arquivo no disco, não um fato do
  Postgres.
- Não preencheu a seção "Resultado real" da verificação de RLS abaixo — isso
  exige acesso ao Supabase Studio do projeto do `financeiro-tria`, que só o
  dono do produto tem.

## As cinco etapas de D4-16, com entrada, ação e rollback

| # | Etapa | Condição de entrada | Ação | Rollback |
|---|---|---|---|---|
| 1 | Oito leituras em uso | As oito rotas de `/financeiro/*` compilam e têm teste verde no CRM N1 | **FEITO** — Ondas 1-5 da Fase 4 (`next build` emite as 8 rotas) | Reverter para o painel antigo é trivial: ele continua no ar |
| 2 | Confirmação de quem opera | Uma semana de uso real das oito leituras | **NÃO FEITO** — nenhuma semana de uso real decorreu ainda | N/A — nada a desfazer, nada foi decidido |
| 3 | Vercel pausado | Confirmação da etapa 2 | **NÃO FEITO** — pausar (nunca deletar) `financeiro-tria.vercel.app` no painel da Vercel, e confirmar com `curl -I` que o domínio responde | Despausar o projeto — ação de um clique, reversível a qualquer momento até a etapa 4 |
| 4 | Remoção do `anon_read`, do `AuthContext` e das rotas públicas legadas | Vercel pausado por tempo suficiente (D4-16 fala em 30 dias) | **NÃO FEITO.** Este é o **PONTO DE NÃO RETORNO** da fase. A migração `20261001120000` está escrita e commitada, mas NÃO aplicada — ver seção própria abaixo | Antes de aplicar: despausar o Vercel. Depois de aplicar: recriar as policies com o SQL das migrations originais + despausar — deixa de ser trivial |
| 5 | `npm run check` verde | Etapas 1-4 completas | A VERIFICAR NO MOMENTO DO CORTE — o verde de hoje não garante o verde daquele dia | N/A |

**A remoção do `anon_read` (etapa 4) é a última ação da fase.** Até ela, o
rollback inteiro do corte é "despausar o Vercel". Depois dela, não é.

## Inventário completo das policies a remover

Lido diretamente das migrations em `../financeiro-tria/supabase/migrations/`,
não do texto de D4-16 (que lista só quatro grupos e erra o nome de uma).

| Tabela | Policy | Criada por |
|---|---|---|
| `public.solicitacoes_pagamentos` | `anon_read` | `20260511130000_rls_solicitacoes_pagamentos.sql` |
| `public.financas_mp` | `anon_read` | `20260525170000_create_financas_mp.sql` |
| `public.automation_workflows` | `anon_read` | `20260525180000_create_automation_workflows.sql` |
| `public.automation_workflow_runs` | `anon_read` | `20260525180000_create_automation_workflows.sql` |
| `public.conciliador_contas_pagar_tria` | `anon_read` | `20260525190000_rls_conciliador_anon_read.sql` (laço `do $$`) |
| `public.conciliador_contas_pagar_finq` | `anon_read` | idem |
| `public.conciliador_contas_pagar_pf` | `anon_read` | idem |
| `public.conciliador_contas_pagar_exo_loteamentos` | `anon_read` | idem |
| `public.conciliador_contas_pagar_exo_participacoes` | `anon_read` | idem |
| `public.conciliador_contas_pagar_oliveira_participacoes` | `anon_read` | idem |
| `public.conciliador_contas` | **`anon read conciliador_contas`** (nome com ESPAÇOS) | `20260526120000_create_conciliador_contas_unificado.sql` |

Um `drop policy anon_read` literal, aplicado a todas as tabelas, **não
alcançaria** `conciliador_contas` — o nome real da policy tem espaços e
precisa de aspas duplas (`"anon read conciliador_contas"`). A migração
`20261001120000` já trata isso à parte (ver seção seguinte).

O laço de `20260525190000` pula, com `to_regclass('public.' || t) is null`,
qualquer tabela que não exista neste projeto — a migração de remoção espelha
essa defensividade: `drop policy if exists` sempre, e o mesmo guard de
existência antes de tentar dropar nas seis `conciliador_contas_pagar_*`, para
que a ausência de uma tabela nunca derrube a transação inteira.

## A migração que remove o `anon_read` — escrita, não aplicada

**Arquivo:** `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql`
(commit `3860ed4` no repositório `financeiro-tria`, branch `main`).

Contém, nesta ordem: as quatro `drop policy if exists anon_read` diretas
(`solicitacoes_pagamentos`, `financas_mp`, `automation_workflows`,
`automation_workflow_runs`); um laço `do $$` idêntico ao padrão de
`20260525190000` para as seis `conciliador_contas_pagar_*`; e o `drop policy`
com aspas e espaços para `conciliador_contas`. O cabeçalho do arquivo tem um
banner `NOT YET APPLIED` em SQL, e comentários explicando por que agora, o
que continua funcionando (`automation/` usa `service_role`, que passa por
cima de RLS) e qual é o rollback.

**Este arquivo é a última etapa de D4-16, e é a única deste plano que toca o
repositório `financeiro-tria` no schema.** Ela é a etapa 4 da tabela acima —
não roda antes das etapas 1-3, e "existir no disco" não é "ter sido aplicada".

## A verificação que só o Postgres responde

Nenhuma migration de `../financeiro-tria/supabase/migrations/` menciona
`transacoes` ou `produtos_cadastrados_emissao_notas` — ao contrário de todas
as outras tabelas do painel, que têm `anon_read` explícita. Isso não prova
que RLS está desligada nelas (podem ter sido configuradas fora do fluxo de
migrations, direto no Supabase Studio/Lovable), mas também não prova o
contrário. `grep` não responde isso; só uma consulta direta ao Postgres do
projeto do `financeiro-tria` responde.

**Consulta 1 — RLS ligada ou desligada, tabela por tabela:**

```sql
select relname, relrowsecurity
from pg_class
where relname in (
  'transacoes',
  'produtos_cadastrados_emissao_notas',
  'automation_runs',
  'automation_steps',
  'automation_events',
  'approval_tasks',
  'conciliador_contas',
  'solicitacoes_pagamentos',
  'financas_mp',
  'automation_workflows',
  'automation_workflow_runs'
);
```

**Consulta 2 — todas as policies hoje ativas no schema `public`:**

```sql
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename;
```

**Resultado real (data, quem rodou):**

```
[AGUARDANDO EXECUÇÃO NO SUPABASE STUDIO DO PROJETO financeiro-tria —
 colar aqui a saída literal das duas consultas acima, com a data e o
 nome de quem rodou. Não inventar nem assumir um resultado.]
```

**Leitura do resultado, escrita de antemão:** se `relrowsecurity` vier
`false` para `transacoes` ou `produtos_cadastrados_emissao_notas`, o front
atual tem **CRUD irrestrito** (não só leitura) por chave `anon` nessas
tabelas — uma exposição ATUAL, anterior a esta fase. Neste caso: ligar RLS
nas duas e **não criar policy nenhuma** (o `automation/` usa `service_role`,
que passa por cima de RLS; o CRM N1 nunca fala com esse banco direto — D4-04),
numa migração própria, aplicada DEPOIS de o Vercel estar pausado. As duas
linhas comentadas no final de `20261001120000_remove_anon_read_painel.sql`
(`alter table ... enable row level security`) existem prontas para esse caso
— descomentar SÓ se o resultado colado acima confirmar `false`.

## Prova de que ninguém mais chama — grep registrado antes de cada remoção

D4-16 (Passo 1 do Plano 04-14, Task 3) exige que nenhuma rota seja removida
sem `grep` registrado provando que só a própria declaração e o front pausado
a chamam. Executado nesta sessão contra `../financeiro-tria/src`,
`../financeiro-tria/automation/src`, `apps/` e `packages/` do CRM N1
(excluindo `node_modules`, `.next`, `dist`, `build`, `coverage`, `.turbo`).

### `GET /automation/runs`, `/automation/runs/:id`, e as ações de run

```
grep -rn "/automation/runs" ../financeiro-tria/src ../financeiro-tria/automation/src apps/ packages/
../financeiro-tria/src/lib/automation-api.ts:90-108   -- front Vercel (pausado quando isto rodar)
../financeiro-tria/automation/src/http/routes.ts:283-320 -- a própria declaração
```

Nenhuma ocorrência em `apps/` ou `packages/` do CRM N1. As únicas duas fontes
são o front do Vercel (que estará pausado) e a declaração da rota — condição
segura para remover, satisfeita.

### `GET/PATCH /financeiro/solicitacoes*`

```
grep -rn "/financeiro/solicitacoes" ../financeiro-tria/src ../financeiro-tria/automation/src apps/ packages/
../financeiro-tria/src/App.tsx:60
../financeiro-tria/src/features/financeiro/components/FinanceiroShell.tsx:31
../financeiro-tria/src/features/financeiro/data/solicitacoesPagamentos.ts:23,27,32
../financeiro-tria/src/pages/financeiro/FinanceiroSolicitacoes.tsx:41,47   -- front Vercel
../financeiro-tria/automation/src/http/routes.ts:328,338,347               -- a própria declaração
apps/api/src/rotas/financeiro.ts:170                                       -- COMENTÁRIO explicando por que NÃO existe equivalente
apps/api/src/rotas/financeiro.test.ts:235                                  -- teste (i) provando 404 em "/financeiro/solicitacoes/1/aprovado" no apps/api
```

O `apps/api` só MENCIONA este caminho para provar, por teste, que ele **não
existe** nesse servidor (`financeiro.test.ts` caso "(i) a rota de aprovar não
existe — 404 em dois caminhos plausíveis", T-4-09). Nenhuma chamada real.
Condição segura para remover, satisfeita.

### `plano-contas-routes.ts` inteiro (`GET/POST/DELETE /plano-contas*`)

```
grep -rn "/plano-contas" ../financeiro-tria/src ../financeiro-tria/automation/src apps/ packages/
../financeiro-tria/src/App.tsx:59, .../FinanceiroPlanoContas.tsx:125,293   -- front Vercel
../financeiro-tria/automation/src/http/plano-contas-routes.ts:85,102,129   -- a própria declaração
../financeiro-tria/automation/src/http/leituras-plano-contas-routes.ts     -- rotas NOVAS (/v1/leituras/plano-contas*), substitutas (04-12)
apps/web/..., apps/api/...                                                 -- todos falam com /financeiro/plano-contas* (apps/api) e /v1/leituras/plano-contas* (automation), NUNCA com /plano-contas bare
```

O caminho novo (`/v1/leituras/plano-contas*`) já está em produção desde 04-12
e usa um arquivo diferente (`leituras-plano-contas-routes.ts`). O caminho
velho (`plano-contas-routes.ts`, sem `/v1/leituras`) só tem o front do Vercel
como chamador. Condição segura para remover, satisfeita.

### `workflow-routes.ts` inteiro (`GET /workflows*`, `POST /workflows/:key/run`)

```
grep -rn "/workflows" ../financeiro-tria/src ../financeiro-tria/automation/src apps/ packages/
../financeiro-tria/src/features/financeiro/data/workflows.ts:67,72,78,90   -- front Vercel
../financeiro-tria/automation/src/http/workflow-routes.ts:25,31,36,40      -- a própria declaração
../financeiro-tria/automation/src/http/leituras-plataforma-routes.ts:138   -- rota NOVA (/v1/leituras/workflows), substituta (04-07/04-12)
```

**Confirmação extra que o Passo 2 exige antes de remover `workflow-routes.ts`:**
o cron de `server.ts` (linhas 107-120) chama `markSeteDias()` e `emitirNotas()`
**direto**, importados de `./tenants/tria/invoice-emission/invoice-emission-service`
— nunca através de `workflow-routes.ts`. Confirmado por leitura de
`server.ts:17,107-120`. Condição do Passo 2 satisfeita: seguro remover.

### `bank-statement-webhooks.ts` — NÃO remover

Preservado de propósito: é o path original do n8n e o destino do proxy de
Extratos (`POST /financeiro/extratos` no `apps/api`, D4-13, repassando com
credencial de serviço). `server.ts:50` monta `bankStatementWebhooksRouter()`
antes de qualquer `express.json()` — ordem load-bearing, porque o upload
chega como corpo bruto. Nada nesta sessão tocou este arquivo.

## Risco residual conhecido: `POST /webhook/receber-whatsapp-doc/:origem`

Esta rota sobrevive ao corte porque não é uma rota de painel — é o path
original do n8n para o upload de Extratos, e o proxy de D4-13
(`POST /financeiro/extratos` no `apps/api`) repassa para ela com a credencial
de serviço. Ela continua **pública** (sem Bearer) mesmo depois da etapa 4,
porque desligá-la quebraria o n8n, que não faz parte desta fase.

Fica registrado como trabalho posterior, fora do escopo de D4-16: exigir
Bearer nesta rota e negociar a credencial com quem opera o n8n. Ver T-4-33 no
`threat_model` do Plano 04-14 (`accept`, exposição pré-existente).

## `src/contexts/AuthContext.tsx` — nota para quando a etapa 4 rodar

`AuthContext.tsx` já está entre os 89 arquivos modificados sem relação com
esta fase no worktree do `financeiro-tria`. `git status --porcelain` confirma
que `src/App.tsx` — que também poderia importar o contexto — **não** está
modificado, então remover `AuthContext.tsx` sozinho, com `git add` do caminho
exato, não deve arrastar mudança de terceiro nenhuma. Confirmar de novo no
dia, porque os 89 arquivos podem ter mudado entre esta sessão e a etapa 4.

## Checklist de saída (preencher no dia da etapa 4/5)

- [ ] Etapa 1 — oito leituras em uso: **feita** (Ondas 1-5, `next build` 8/8)
- [ ] Etapa 2 — semana de uso real + confirmação nominal: pendente
- [ ] Etapa 3 — Vercel pausado, domínio respondendo, data registrada: pendente
- [ ] Verificação de RLS de `transacoes`/`produtos_cadastrados_emissao_notas`: pendente (seção acima)
- [ ] Etapa 4 — `supabase db push` da migração `20261001120000`, com a saída colada aqui e a policy ausente confirmada por nova consulta `pg_policies`: pendente
- [ ] Prova negativa: chave `anon` tentando ler `solicitacoes_pagamentos` devolve vazio/erro de permissão: pendente
- [ ] Remoção das rotas legadas (`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`, mounts em `server.ts`) e do `AuthContext.tsx`: pendente
- [ ] Etapa 5 — `npm run check` verde nos três workspaces do `crm-n1`: pendente

## Quem faz o quê a partir daqui

| Passo | Dono |
|---|---|
| Confirmar uso real de uma semana e assinar a confirmação nominal | Financeiro (operador) |
| Pausar o Vercel e confirmar `curl -I` antes/depois | Dono do produto |
| Rodar as duas consultas do Studio e colar o resultado aqui | Dono do produto (acesso ao Supabase do `financeiro-tria`) |
| Remover as rotas legadas e o `AuthContext`, com os greps já registrados acima como prova | Executor, depois das etapas 1-3 confirmadas |
| Aplicar `20261001120000` com `supabase db push` e colar a prova no banco | Dono do produto ou executor com credencial |
