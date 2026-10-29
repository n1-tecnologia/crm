---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 10
current_phase_name: "Clone ClickUp: Contêineres (Espaço, Pasta e Lista)"
status: executing
stopped_at: Completed 10-10-PLAN.md
last_updated: "2026-10-29T10:20:32.765Z"
last_activity: 2026-10-29
last_activity_desc: Phase 10 execution started
state_head: 2f7b4f861861b952847dd5af5db891ecad7aacf6
progress:
  total_phases: 12
  completed_phases: 6
  total_plans: 191
  completed_plans: 181
milestone_name: milestone
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-11)

**Core value:** Um solicitante cria o pedido no CRM N1 e o Financeiro opera Contas a pagar de ponta a ponta sem abrir o ClickUp — dados no Postgres próprio, regras de `@n1/dominio` intactas.
**Current focus:** Phase 10 — Clone ClickUp: Contêineres (Espaço, Pasta e Lista)

## Current Position

Phase: 10 (Clone ClickUp: Contêineres (Espaço, Pasta e Lista)) — EXECUTING
Plan: 14 of 21
Status: Ready to execute
Last activity: 2026-10-29 — Phase 10 execution started

**Fase 06 planejada à mão em 2026-09-29 (Conferência do Resumo e anexos), pronta para `/gsd-execute-phase 6`:**
`.planning/phases/06-conferencia-do-resumo-e-anexos/` — `06-CONTEXT.md` (13 decisões com padrão e variável de troca) e seis planos em três ondas: 06-01 domínio · 06-02 contrato v1.1 no `financeiro-tria` · 06-03 ponte em dois momentos · 06-04 tela e jornada · 06-05 S5/S6 na Solicitação · 06-06 docs e provas `[BLOCKING]`. Origem: `docs/08-migracao-financeiro/09-…` (desenho) e `10-…` (levantamento etapa por etapa com `arquivo:linha`). Ponto de partida do código: `crm-n1-integracao@3d6f735` (branch `integra-frontend-main`, sem push) e `financeiro-tria@c272dad` (`main`, 99 commits sem push, 89 arquivos sujos só de EOL — `git add` sempre por caminho). O dono ainda não respondeu às quatro perguntas do doc 10; os padrões de D6-01..D6-04 seguem "como no ClickUp", exceto Integração manual (o seguro).

**Achados do 02-26 — corrigidos em 2026-09-25:**

1. `rotas/operacoes.ts` grava `aprovacao-decidida` (clique) e `comentario-criado` (resposta pela tela numa Solicitação) — `48f48f0`.
2. O Agente do pipeline comenta pelo Papel em toda Tarefa que vê (`guestCommentsByRole`, `derive.ts`) — `dae2a91`.
3. `eventIdDoComentario` gera UUID v5 válido — `financeiro-tria@7dfc441`.

**Plan 02-27 — Tasks 1-2 (código) prontas, Task 3 (ensaio) aberta:**

- `financeiro-tria@7c74681` + `@549ceb5`: consulta `ConsultarContaPagar` antes de `IncluirContaPagar` (e de novo após erro); coorte plataforma com código determinístico `tria:payment-request:plataforma:<taskId>` que nunca cede ao código extraído do resumo da IA; coorte clickup intocada.
- `crm-n1@973aa8f`: `apps/api/src/observabilidade/` (métricas + `npm run reconciliar`). Lacuna: as contagens do lado do `automation/` (comandos, runs, códigos Omie) entram por `--resumo=<json>`, não por leitura automática — o `automation/` não tem tabela de runs persistida. Antes do ensaio, decidir quem gera esse resumo diário.
- Pré-requisitos do ensaio (Task 3): publicar `apps/api` na VPS atrás do nginx, emitir a credencial do `automation/`, ligar `PAYMENT_REQUEST_SOURCE=plataforma` para a coorte nova, `FALLBACK_COMENTARIO_ATE` no deploy. Tudo com o dono.
- Fora de escopo, anotado: `payment-rules.test.ts` (financeiro-tria) falha antes de hoje — roteamento de aprovador com fallback devolve "Elifas" onde o teste espera FINQ.

**Plan 02-25 — o que ficou decidido e o que resta:**

1. A origem tem 1.114 linhas mas só **843 Solicitações distintas** (até 20 linhas por TaskID); só **245** têm Centro de Custo e decisão — essas entraram. Critério 5 do ROADMAP reescrito (decisão do dono).
2. Sem Valor, CPF/CNPJ e data de criação: não existem como coluna na origem (D-25). Empresa por de-para do identificador do legado; Data Vencimento só do vencimento real (DD/MM/AAAA).
3. Bucket privado `anexos-solicitacoes` criado no CRM N1 (também é o do Formulário público). Migração dos anexos para servidor próprio: fase futura (pedido do dono).
4. Pendente com o dono: inspecionar 3 Tarefas importadas na interface; trocar a senha do servidor próprio que apareceu no chat.
5. Credencial de leitura do legado: role `leitura_importacao` (bypassrls, só SELECT em solicitacoes_pagamentos). As duas linhas `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` com o superusuário `postgres` ainda estão no `apps/api/.env` — o dono precisa apagá-las (o agente só consegue acrescentar linhas nesse arquivo).
6. Para o 02-28: rodar mais um `--apply` (idempotente) logo antes do corte, para pegar solicitações novas gravadas pelo pipeline antigo depois de hoje.

**Plan 02-15 — decisão e pendências:**

1. Decisão de região registrada: **permanecer em `us-west-2`** (não migrar para `sa-east-1` agora) — zero downtime, latência transcontinental aceita e medida quando possível.
2. `apps/api/src/persistencia/conexao.ts`: `rejectUnauthorized: false` foi substituído por verificação real de TLS (`DATABASE_CA_CERT`/`DATABASE_CA_PATH`/`DATABASE_SSL_INSECURE`). **Efeito colateral encontrado no post-merge**: qualquer ambiente com `DATABASE_URL` mas sem uma dessas três variáveis agora falha ao abrir conexão — os e2e locais (`criar-conta`, `lote-contas-a-pagar`, `dois-servicos`, `falhas-injetadas`, `latencia`) pararam de rodar até `DATABASE_SSL_INSECURE=true` ser adicionado ao `.env` local (dono aprovou; feito nesta sessão, arquivo não versionado).
3. Medição real de latência (p50/p95/p99) **não foi obtida**: rodar 200 transações sequenciais contra `us-west-2` a partir deste laptop levou tempo suficiente para o processo sofrer uma queda de rede local (`ENOTFOUND`/`EADDRNOTAVAIL` após ~28min) antes de completar. Isso não é uma medição válida de VPS↔Postgres — precisa rodar a partir da VPS mesmo (que é o ponto real da cadeia), não do laptop do desenvolvedor. `apps/api/src/e2e/latencia.test.ts` timeout do teste ampliado de 120s→300s (`3d41285`) para dar folga em runs locais, mas a medição autoritativa continua pendente.
4. **Checkpoint humano real, ainda aberto** (ver `docs/08-migracao-financeiro/05-topologia-e-regiao.md` §4 e `02-15-SUMMARY.md`): confirmar bucket privado no Supabase Dashboard; publicar `apps/api` na VPS compartilhada (`85.155.186.214`) atrás do nginx existente, expondo só `/saude`, `/v1/public/forms/*`, `/v1/integrations/*`; emitir a credencial de serviço do `automation/`; rodar `latencia.test.ts` a partir da VPS e colar os números no §5 do doc; confirmar via `curl` que só as rotas permitidas respondem publicamente.

**Plan 02-26 — três achados reais de produção, não corrigidos (fora do escopo do plano), que bloqueiam o ensaio de duas semanas:**

1. O caminho de CLIQUE de aprovação (D-09, o principal) não emite evento de outbox — `apps/api/src/rotas/operacoes.ts` nunca passa `opcoes.eventos` a `executar()`. Só o callback de classificação por comentário emite hoje.
2. `eventIdDoComentario` em `../financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts` gera "uuid" que `z.uuid()` (mesma versão em produção) rejeita na maioria dos casos — o fallback por comentário está efetivamente quebrado.
3. O Convidado "Agente do pipeline" não tem `comentar` em nenhuma Tarefa por padrão (só `ver` a nível de Lista) — a automação real vai falhar ao publicar o comentário de roteamento em Tarefa nova até existir uma concessão automática.

Caso (i) da Fault-Injection Matrix (retomada de importação por `--resume`) ficou `it.todo`: depende do Plan 02-25, não executado. Ver `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-26-SUMMARY.md` para detalhes e reprodução de cada achado.

**Pendência de git (não afeta código, só atribuição de commit):** o commit do lado `crm-n1` da Task 1 de 02-26 (`scripts/verificar-contratos.mjs` + `package.json`) foi absorvido dentro de `91d1ae7 "test(03): complete UAT"`, de outro processo concorrente rodando nesta mesma sessão multi-agente. Conteúdo correto e no lugar certo, confirmado por `git show --stat 91d1ae7`; não reescrito por não estar pushado e por essa reescrita arriscar outros processos concorrentes ainda ativos no branch.

**Onda 5 — 04-12** (sibling, `f06da55`/`d4cca79`/`49d71af`): módulo de acesso ao
`conciliador_contas` e as seis rotas de plano de contas/workflows/execuções, autenticadas pelo
`exigirCredencial` de 04-07, projetando por `dtoDeLinhaDoPlanoDeContas`. Três mounts de
`/v1/leituras` agora coexistem em `server.ts` (linhas 55, 61, 66), todos ANTES do `express.json()`
na 67 — ordem preservada. Rotas legadas com diff vazio. 146/147 na suíte do `automation`.

**Decisão de segurança que 04-12 tomou e o plano não especificava:** `repetir-passo` e `cancelar`
respondem `{ ok: true }` e nada mais, em vez de repassar o retorno de
`PaymentAutomationService#retryRun`/`#cancelRun` — que podem carregar a Task inteira do ClickUp e a
linha inteira de `solicitacoes_pagamentos`, com `app_key`/`app_secret`. Resposta de ação de escrita
também é porta de saída de dado; o envelope mínimo é a escolha certa sob D4-05.

**Onda 6 — 04-14 O CORTE: PREPARADO, NÃO EXECUTADO.** O usuário foi apresentado ao que o plano faz
e escolheu "preparar só, parar antes do irreversível". Dos SETE `files_modified` do plano, dois
foram criados e cinco ficaram byte-idênticos (verificado com `git diff --stat`):

- CRIADO `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` (278 linhas, `8b1d414`)
  — arquivo NOVO, não confundir com `06-runbook-de-corte.md` do Plano 03-14, que é outro corte e
  ficou intocado. Traz o inventário completo das 11 policies lido das migrations, as duas consultas
  de RLS prontas para colar no Supabase Studio com bloco EM BRANCO para o resultado (nada inventado),
  e as provas de `grep` de que ninguém mais chama cada rota legada.

- CRIADO `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql`
  (101 linhas, `3860ed4`) — **NUNCA APLICADO**, com banner `NOT YET APPLIED` no topo. Idempotente,
  tolerante a tabela ausente, e trata AMBOS os nomes de policy.

- INTOCADOS: `automation/src/http/{routes,plano-contas-routes,workflow-routes}.ts`,
  `automation/src/server.ts`, `src/contexts/AuthContext.tsx` (este último tem diff, mas é
  pré-existente — mtime de 13/mai/2026, um dos 89 sujos originais; a sessão não escreveu nele).

**A armadilha que o runbook existe para evitar:** `conciliador_contas` tem a policy chamada
`anon read conciliador_contas`, COM ESPAÇOS. Um `drop policy anon_read` literal não a removeria — a
porta ficaria aberta e o corte pareceria completo. As outras dez policies se chamam `anon_read`
mesmo. E `transacoes` e `produtos_cadastrados_emissao_notas` não aparecem em NENHUMA migration: o
estado de RLS delas é desconhecido e `grep` não responde, só a consulta no Studio.

**O que falta para o corte, com dono (nenhum item é de código):**

1. Uma semana de uso real das oito telas — dono: Financeiro. Tempo de calendário, não tarefa.
2. Confirmação nominal de quem opera — dono: dono do produto.
3. Rodar as duas consultas de RLS no Supabase Studio e colar o resultado no runbook — dono: dono do
   produto (só ele tem acesso).

4. Pausar (NUNCA deletar) `financeiro-tria.vercel.app` por 30 dias, domínio respondendo — dono:
   dono do produto.

5. Só depois: remover as rotas legadas e o `AuthContext`, e aplicar a migração — o PONTO DE NÃO
   RETORNO. Até ele, o rollback é despausar o Vercel.

**MEDIÇÃO FINAL DA FASE — a suíte inteira de `apps/api`, a única que faltava, rodada sem pipe, sem
watchdog e com carga normal (20,2 min):**

```
Test Files  1 failed | 58 passed (59)
Tests       1 failed | 529 passed | 12 skipped (542)     exit 1
```

A única falha é `src/e2e/lote-contas-a-pagar.test.ts > (d) o piso e o teto do lock (DEC-06)`,
estourando o `testTimeout` em 180014ms. **Não é da Fase 4**: é medição de tempo de PAG-05/DEC-06,
escrita na Fase 3, e 04-01 já a viu estourar na ONDA 1, antes de qualquer código desta fase entrar
no `app.ts`. Resolve o item 3 do `deferred-items.md`: dos dois arquivos relatados, esse é real e
`rotas/classificacoes.test.ts` era ruído.

**Números finais das outras camadas:** `@n1/web` 167 testes (17 arquivos), `@n1/dominio` 480,
`automation` 146/147 (a falha é o item 1, pré-existente), `next build` verde com as OITO rotas
`/financeiro` emitidas, typecheck nos três workspaces + lint + tokens (392/254) verdes.

**Dois itens abertos que pedem decisão humana, nenhum bloqueia nada agora:** o filtro Plataforma
(exige ALARGAR a allowlist positiva de D4-05 — escolha de exposição de dado, item 5) e o
`timingSafeEqual` sem teste que o proteja (item 4, correção honesta é teste estrutural, não de
relógio).

**Onda 4 — o que entrou.** 04-09 (sibling, `cd0ed5a`/`02259dd`/`5f90410`): módulo de consulta com
TODAS as colunas nomeadas (nenhum `select("*")`), paginação por `.range()` em lotes de 1000 com
teto de 20 lotes, e três rotas sob `/v1/leituras` autenticadas pelo `exigirCredencial` de 04-07,
projetando pelos DTOs de 04-01 — **a allowlist de D4-05 NÃO foi alargada** (verificado: a única
ocorrência de `plataforma` no arquivo de DTOs é o nome de um arquivo dentro de um comentário).
Mount em `server.ts` na linha 60, ainda antes do `express.json()` na 61 — a ordem é load-bearing
(upload de extrato chega como body BRUTO) e foi preservada. 04-13 (`464b4fe`): leitor de CSV
escrito à mão (zero dependência nova, evita CVE-2023-30533), Plano de contas com remoção e import,
Extratos com progresso, e o botão "Executar agora" de Workflows finalmente LIGADO com a cópia de
`ConfirmDialog` que 04-08 deixou reservada — resultado por `Toast` neutro com "Atualizar agora",
porque o `apps/api` responde 202 e a tela não finge saber o desfecho na hora.

**Portão de pós-merge da Onda 4 — verde, com uma ressalva minha.** typecheck nos três workspaces,
lint, tokens (392/254), 480 de domínio, **167 de web** (17 arquivos), e `next build` emitindo
**todas as oito rotas** `/financeiro`: raiz, aprovacoes-pendentes, extratos, notas-fiscais,
plano-contas, problemas, produtos, workflows.

A ressalva: `rotas/financeiro.test.ts` reprovou 1 de 25 nesse portão, com
`Connection terminated unexpectedly` depois de 55,8s — e o script do portão IMPRIMIU
"all checks passed" por cima disso, porque o bloco rodava em subshell e o `exit` nunca chegou ao
acumulador. Erro meu, corrigido para o portão final. O teste em si é flake de conexão, não
regressão: nenhum commit tocou `apps/api` desde o 25/25 da Onda 3, e a re-execução imediata deu
**25/25 em 7,78s**. Registrado como item 8 do `deferred-items.md`.

**`deferred-items.md` agora abre com uma TABELA DE VEREDITOS** — de oito achados relatados por
agentes, só **dois** (itens 1 e 4) são defeitos reais e pendentes; um é decisão humana (5) e
**quatro são ruído de ambiente** (2, 6, 7, 8). Metade dos "achados" era o ambiente, não o código.
Ler a tabela antes de agir sobre qualquer item.

**Onda 3 — o que entrou.** 04-07 (sibling, `6924703`/`c3dea4a`/`39dcc35`): `/v1/leituras/*`
autenticado desde o nascimento, montado ANTES do `express.json()` (linha 53 < 54, verificado),
projetando pelos DTOs de 04-01 e computando pelas derivações de 04-04; rotas legadas
byte-a-byte intactas. 04-08: as telas Problemas, Aprovações pendentes (vista legada rotulada,
D4-11) e Workflows, com o botão "Executar agora" permanentemente desabilitado e com
`disabledReason` até 04-13 existir (T-4-24). 04-10: SEIS rotas de escrita (não cinco — a
aritmética do plano era inconsistente; D4-07 autoriza seis) mais o proxy de upload de Extratos
com `addContentTypeParser` restrito a 8 MIME e `bodyLimit` de 25MB; nenhuma rota de aprovação
existe, e isso é provado por 404 em teste, não por comentário. 04-11: Notas fiscais e Produtos
saem da leitura direta ao Supabase com chave `anon` (D4-04) e passam pelo `apps/api`, mais
`acoes.ts` com as Server Actions.

**04-10 achou e corrigiu um BUG REAL fora do seu escopo declarado (`apps/api/src/app.ts`).**
O `setErrorHandler` convertia em 500 genérico qualquer erro nativo do Fastify que já trouxesse
o próprio `statusCode` — o 413 do `bodyLimit` e o 415 do content-type parser inclusive. Veio
com 04-05. Efeito prático: a mitigação T-4-05 do próprio 04-10 ("413 do Fastify") pareceria
implementada e não funcionaria em produção. Correção estreita: preserva o 4xx atribuído pelo
Fastify quando `erro.statusCode` existe, mantém o 500 opaco para bug interno de verdade
(T-1-06 intacto). Verificado sem regressão: `operacoes.test.ts` 22/22 no checkout principal.

**Portão de pós-merge da Onda 3 — pegou um defeito que nenhum executor podia ver.**
`painel-de-workflows.tsx:38` reprovava `tsc` com TS2322: com `noUncheckedIndexedAccess`, o
fallback `?? COR_DE_EXECUCAO.pendente` também é `string | undefined`, então não estreitava
nada. Causa: 04-08 reescreveu `corDeExecucao` de template string para tabela literal DEPOIS do
seu último typecheck (era a correção do "token fantasma"), e não re-verificou. typecheck E
`next build` falhavam; corrigido em `1d69a90` com constante nomeada, ambos verdes.

Resto do portão, tudo verde e com três perguntas respondidas de propósito:

- `@n1/web` **157/157 em 10,6s** com carga baixa → as 14 falhas que 04-08 relatou eram
  artefato de carga (load 141-244 com quatro agentes), não defeito. Item 6 do `deferred-items.md`.

- `rotas/financeiro.test.ts` **25/25** no checkout principal (era 14 passed / 11 skipped no
  worktree) → o caso (l) de sanitização de nome de arquivo, que 04-10 não pôde exercitar, passa.

- `operacoes.test.ts` **22/22 em 196s** → o raio de alcance da mudança no `app.ts` está limpo.
- `next build` verde: seis das oito rotas `/financeiro` emitidas (faltam `plano-contas` e
  `extratos`, que são 04-13, Onda 4). typecheck nos três workspaces, lint, tokens 392/245.

**Duas pendências abertas registradas em `deferred-items.md` (itens 4 e 5), nenhuma bloqueia a Onda 4:**

1. `timingSafeEqual` está no código mas NENHUM teste o protege — 04-07 provou por mutação que
   trocar por `===` deixa os 11 casos verdes. Correção honesta é teste estrutural, não de relógio.

2. O filtro "Plataforma" de Notas fiscais que o UI-SPEC pede NÃO é construível: o `NotaFiscalDto`
   não projeta esse campo. Fechar exige ACRESCENTAR `plataforma` à allowlist positiva de D4-05 —
   decisão humana de exposição de dado, não detalhe de implementação.

**Lição de orquestração:** quatro executores paralelos levaram o load a 141-244 num host de 8
núcleos e a verificação deixou de ser sinal (falsos timeouts, worker-spawn falhando). As ondas
4, 5 e 6 têm no máximo dois planos, então o problema não reaparece nesta fase.

**CONTRATO CRUZADO — o nome do hook mudou (04-06 → 04-08, 04-11, 04-13).** O hook de
revalidação exporta-se como **`useRevalidarAoFocar`**, NÃO `usarRevalidarAoFocar` como o
plano e o UI-SPEC escreviam. Motivo: `eslint-plugin-react-hooks` (`rules-of-hooks`) exige o
prefixo literal em inglês `use`, e todo hook desta base já segue isso apesar de corpo em
português (`useFormat`, `useAgir`, `useNomeDoAtor`, `useAlvo`). O CAMINHO do arquivo não
mudou: continua `apps/web/src/features/financeiro/dados/usar-revalidar-ao-focar.ts`. Quem
consumir nas ondas 3 e 4 importa `useRevalidarAoFocar` desse caminho.

**Onda 2 — o que entrou.** 04-04 (sibling repo, `29587f1`/`ef926ec`/`fbe95f9`):
`financeiro-derivacoes.ts`, 444 linhas puras e SEM imports, com `ROTULOS_PERMITIDOS` como
allowlist positiva de rótulos; os 7 exports do plano existem, nenhum escreve (D4-11), e o
`key_link` para a fixture de 04-01 verifica. 04-05 (`4564fa9`): `rotas/financeiro.ts` + as
sete leituras registradas na raiz de `app.ts`, com a matriz 401/403/400/200/503/502. 04-06
(`798c5d5`): `leitura.ts` (quatro desfechos), `useRevalidarAoFocar`, os três estados de
D4-15 (`estado-de-falha`, `botao-atualizar`, `moldura-de-leitura`) e o Dashboard em
`/financeiro`.

**Portão de pós-merge da Onda 2 — verde, e com duas lacunas de worktree FECHADAS de propósito
no checkout principal:**

- `rotas/financeiro.test.ts` rodou **9/9 em 128s** no checkout principal (com `.env`), contra
  4 passed / 5 skipped dentro do worktree. Os cinco casos de banco foram de verdade contra o
  Postgres real — verificação que worktree nenhum consegue dar.

- `npm run build -w @n1/web` (Next.js 16) rodou pela primeira vez sobre as páginas novas:
  exit 0, zero avisos, `/financeiro` aparece como rota dinâmica. As outras sete rotas só
  ganham arquivo de página nas ondas 3 e 4; 04-03 declarou só as FORMAS em `rotas.ts`.

- typecheck nos três workspaces, lint, tokens (392/224 arquivos), 480 de domínio, 157 de web.

**Onda 1 — o que entrou.** 04-01 (no repositório irmão `../financeiro-tria`, commits `3f5303c`/`6477baa`/`a45fd87`): `fixture-financeiro.ts` com os campos proibidos de propósito e `leituras-plataforma-dtos.ts` com allowlist POSITIVA por DTO (D4-05), provada por nome de campo e com mutação de controle. 04-02 (`cbaa8ab`): `cliente-leituras-financeiro.ts` + 19 testes sem rede e sem banco, e `FINANCEIRO_LEITURAS_URL`/`PLATAFORMA_LEITURA_TOKEN` documentados no `.env.example` (D4-01/D4-02, token de leitura deliberadamente distinto do de lançamento). 04-03 (`80ce9c1`): `navegacao-financeiro.ts` como módulo puro + o sexto assunto no trilho e as formas de esqueleto das oito rotas (D4-08/D4-14). Portão de pós-merge verde: typecheck nos três workspaces, lint, tokens (392/215 arquivos), 480 testes de domínio, 149 de web, 19 do cliente novo.

**Três achados operacionais desta onda (não são código da fase, mas custaram agentes).**

1. Seis dos catorze planos escrevem no repositório irmão `../financeiro-tria`, que é OUTRO repositório git. Em `isolation="worktree"` esse caminho relativo não existe — esses planos têm de rodar sem worktree, no checkout principal. Vale para 04-04, 04-07, 04-09, 04-12 e 04-14, que ainda não rodaram.
2. A suíte de `apps/api` (57 arquivos, `fileParallelism: false`, `testTimeout: 180_000`, Postgres real) leva 40-50 min no checkout principal e estoura o watchdog de 600s do subagente. Três agentes morreram por isso. Planos que tocam `apps/api` (faltam 04-05 e 04-10) precisam de verificação ESCOPADA: typecheck do workspace + só os arquivos de teste do próprio plano, com transporte stubado.
3. Worktree não carrega `.env` (gitignored), então sem `DATABASE_URL` os testes de banco pulam — e pelo menos um FALHA em falso. Isso gerou um "defeito pré-existente" inventado contra o Plano 03-08 que não existe (`scheduler-worker.test.ts` passa 19/19 no checkout principal). Toda falha relatada por agente em worktree precisa de reprodução no checkout principal antes de virar registro. Ver `deferred-items.md` da fase.

**Pendência herdada, intocada por decisão do dono:** o worktree órfão `worktree-agent-a5e400fc9712c6c4f` (c131ad0) carrega três commits NÃO MERJADOS do Plano 02-15 (fixação da CA do Postgres em `conexao.ts`, `latencia.test.ts`, runbook de topologia e o próprio 02-15-SUMMARY.md). Existem só ali. A Fase 4 foi iniciada sobre um base SEM essa correção de TLS, deliberadamente. 02-15 continua contando como incompleto.

Progress: [░░░░░░░░░░░░░░░░░░░░] 132/133 plans — Phases 0, 1, 3, 5, 6 e 7 completas; 2 e 4 abertas

**Fase 1 fechada (segunda rodada de CR-02 concluída):** os 9 planos originais (01-01..01-09), o gap-closure de CR-01 (01-10) e as cinco rodadas de fechamento de CR-02 (01-11..01-16) estão feitos e commitados. A re-verificação de 2026-09-16T20:16Z (`01-VERIFICATION.md`) tinha encontrado CR-02 parcialmente aberto (efeito 2 — `ARGUMENTOS_GENERICOS` não barrava tipo/enum errado nas ~109 operações fora de `ESQUEMAS` — e WR-10 — `reviverArgumentos` sem limite de profundidade); a decisão de cobertura total em 5 planos (01-12 fundação+WR-10; 01-13/14/15 schemas por módulo em paralelo; 01-16 composição final) está executada: `ESQUEMAS` cobre as 132 operações sob `satisfies EsquemasCompletos`, sem fallback, e o mapeamento `TypeError → 400` saiu da rota (WR-11). `npm run check` verde nos três workspaces (dominio 253, web 53, api 163). PERS-08 (deploy do `apps/api`) continua bloqueado por D11 — não é gap de código, é decisão de infraestrutura fora do escopo desta fase. Pronta para nova rodada de `/gsd-verify-phase 1`.

**Aberto na Phase 0 (paralela):** spec da Solicitação de pagamento (PREP-03 — maior risco do plano), exportação do ClickUp (PREP-02), de-para de usuários (PREP-04), rotação das credenciais Omie (PREP-05, fora deste repo). Nada disso bloqueia terminar a Phase 1; PREP-03 e PREP-04 **bloqueiam a Phase 2**.

## Performance Metrics

**Velocity:**

- Total plans completed: 38
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 25 | - | - |
| 07 | 13 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P03 | 35min | 2 tasks | 9 files |
| Phase 01 P06 | 22min | 3 tasks | 3 files |
| Phase 01 P02 | 75min | 3 tasks | 17 files |
| Phase 01 P07 | 25min | 3 tasks | 10 files |
| Phase 01 P04 | 55min | 2 tasks | 10 files |
| Phase 01 P05 | 45min | 3 tasks | 11 files |
| Phase 01 P08 | 50min | 2 tasks | 10 files |
| Phase 01 P09 | 40min | 2 tasks | 3 files |
| Phase 01 P11 | 25min | 3 tasks | 5 files |
| Phase 01 P10 | 10min | 2 tasks | 3 files |
| Phase 00 P01 | 20min | 3 tasks | 10 files |
| Phase 00 P02 | 24min | 2 tasks | 3 files |
| Phase 00 P03 | 16min | 2 tasks | 2 files |
| Phase 00 P04 | 30min | 3 tasks | 7 files |
| Phase 00 P05 | 130min | 2 tasks | 2 files |
| Phase 00 P06 | 35min | 3 tasks | 1 files |
| Phase 00 P07 | 35min | 2 tasks | 3 files |
| Phase 01 P12 | 35min | 3 tasks | 8 files |
| Phase 01 P13 | 20min | 2 tasks | 6 files |
| Phase 01 P14 | 40min | 2 tasks | 10 files |
| Phase 01 P15 | 35min | 2 tasks | 8 files |
| Phase 01 P16 | 40min | 2 tasks | 7 files |
| Phase 03 P01 | 52min | 3 tasks | 3 files |
| Phase 03 P03 | 20min | 3 tasks | 3 files |
| Phase 03 P04 | 30min | 3 tasks | 4 files |
| Phase 03 P09 | 15min | 2 tasks | 5 files |
| Phase 03 P05 | 38min | 3 tasks | 4 files |
| Phase 03 P06 | 27min | 3 tasks | 8 files |
| Phase 03 P08 | 64min | 3 tasks | 8 files |
| Phase 03 P10 | 180min | 3 tasks | 10 files |
| Phase 03 P11 | 300min | 3 tasks | 9 files |
| Phase 03 P12 | 75min | 4 tasks | 11 files |
| Phase 03 P15 | 60min | 2 tasks | 7 files |
| Phase 03 P13 | 110min | 4 tasks | 7 files |
| Phase 3 P14 | 120min | 3 tasks | 10 files |
| Phase 05 P01 | 45min | 3 tasks | 13 files |
| Phase 02 P26 | ~5h | 3 tasks | 10 files |
| Phase 06 P01 | 25min | 3 tasks | 9 files |
| Phase 06 P02 | 25min | 3 tasks | 21 files |
| Phase 06 P03 | 30min | 3 tasks | 15 files |
| Phase 06 P04 | ~25min | 2 tasks | 6 files |
| Phase 06 P05 | 75min | 1 tasks | 3 files |
| Phase 06 P06 | 120min | 2 tasks | 6 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 07 P01 | 25 min | 2 tasks | 15 files |
| Phase 07 P02 | 6 min | 2 tasks | 15 files |
| Phase 07 P03 | 14 min | 3 tasks | 12 files |
| Phase 07 P04 | 11 min | 3 tasks | 8 files |
| Phase 07 P05 | 12 min | 3 tasks | 12 files |
| Phase 07 P06 | 13 min | 3 tasks | 14 files |
| Phase 07 P07 | 22 min | 3 tasks | 12 files |
| Phase 07 P08 | 10 min | 3 tasks | 8 files |
| Phase 07 P09 | 14 min | 3 tasks | 12 files |
| Phase 07 P10 | 15 min | 2 tasks | 10 files |
| Phase 07 P11 | 22 min | 2 tasks | 9 files |
| Phase 07 P12 | 21 min | 2 tasks | 11 files |
| Phase 07 P13 | 2 min | 2 tasks | 1 files |
| Phase 08 P01 | 9 min | 2 tasks | 24 files |
| Phase 08 P02 | 8 min | 2 tasks | 12 files |
| Phase 08 P03 | 7 min | 3 tasks | 8 files |
| Phase 08 P04 | 3 min | 2 tasks | 4 files |
| Phase 08 P05 | 6 min | 3 tasks | 6 files |
| Phase 08 P06 | 10 min | 3 tasks | 7 files |
| Phase 08 P07 | 12 min | 2 tasks | 4 files |
| Phase 08 P08 | 14 min | 3 tasks | 6 files |
| Phase 08 P09 | 14 min | 2 tasks | 4 files |
| Phase 08 P10 | 15 min | 3 tasks | 10 files |
| Phase 08 P11 | 6 min | 2 tasks | 2 files |
| Phase 08 P12 | 11 min | 3 tasks | 7 files |
| Phase 08 P13 | 15 min | 2 tasks | 4 files |
| Phase 08 P14 | 10min | 3 tasks | 1 files |
| Phase 08 P15 | 22min | 3 tasks | 5 files |
| Phase 09 P01 | 12 min | 3 tasks | 9 files |
| Phase 09 P02 | 8 min | 3 tasks | 3 files |
| Phase 09 P03 | 7 min | 3 tasks | 15 files |
| Phase 09 P04 | 10 min | 3 tasks | 16 files |
| Phase 09 P05 | 12 min | 2 tasks | 7 files |
| Phase 09 P06 | 55 min | 2 tasks | 7 files |
| Phase 09 P07 | 8 min | 3 tasks | 8 files |
| Phase 09 P08 | 25 min | 3 tasks | 16 files |
| Phase 09 P09 | 11 min | 2 tasks | 2 files |
| Phase 09 P10 | 3 min | 2 tasks | 4 files |
| Phase 09 P11 | 14 min | 2 tasks | 6 files |
| Phase 09 P12 | 10 min | 3 tasks | 11 files |
| Phase 09 P14 | 25 min | 2 tasks | 11 files |
| Phase 09 P13 | 11 min | 3 tasks | 8 files |
| Phase 09 P15 | 12min | 2 tasks | 9 files |
| Phase 09 P16 | 10 min | 2 tasks | 11 files |
| Phase 10 P01 | 5 min | 2 tasks | 13 files |
| Phase 10 P20 | 6 min | 2 tasks | 11 files |
| Phase 10 P02 | 6 min | 2 tasks | 11 files |
| Phase 10 P03 | 8 min | 2 tasks | 10 files |
| Phase 10 P04 | 8min | 2 tasks | 12 files |
| Phase 10 P18 | 12 min | 3 tasks | 5 files |
| Phase 10 P05 | 14 min | 2 tasks | 7 files |
| Phase 10 P06 | 14 min | 3 tasks | 11 files |
| Phase 10 P08 | 11 min | 2 tasks | 7 files |
| Phase 10 P14 | 8 min | 2 tasks | 8 files |
| Phase 10 P07 | 12 min | 2 tasks | 10 files |
| Phase 10 P09 | 8 min | 2 tasks | 2 files |
| Phase 10 P10 | 14 min | 2 tasks | 10 files |

## Accumulated Context

### Roadmap Evolution

- Phase 7 added (2026-10-09): CRM (backend e frontend) — CRUD de Contatos, Empresas, Funis e Negócios, do domínio à tela, sobre `007-crm.sql`
- Phase 8 added (2026-10-12): Canais de comunicação — escolher e conectar Canais (WhatsApp oficial/não oficial, Instagram, E-mail) com orientação por tipo (mockup), mais de um Canal por tipo, Canal/Conversa/Mensagem no Postgres (008) e o chat ciente do Canal de origem/resposta; sem provedor real
- Phase 9 added (2026-10-22): Segurança dos dados e base de produção — Sessão 1 do cronograma (`docs/09-planejamento/TAREFAS-POR-SESSAO.md`): recorte do `GET /estado`/`POST /operacoes`, conferências de escrita, migração `009` + usuário `n1_api`, cofre de credenciais, logs sem segredo, `limit_req` no nginx, homologação/backup/monitoramento. Aberta antes da Sessão 0 por decisão do dono; a Fase 8 segue em verificação e as Fases 2 e 4 seguem abertas
- Phases 10, 11 e 12 added (2026-10-28): Sessão 2 do cronograma (Clone ClickUp: ajustes e lacunas, 42 subtarefas) dividida em três fases por decisão do dono, cortadas pelos arquivos que cada parte toca e não pela numeração do doc: Phase 10 Contêineres (2.1, 2.3, 2.5, 2.6.1–2.6.5; 23 subtarefas), Phase 11 Tarefa (2.4, 2.6.6–2.6.9; 9), Phase 12 gravação mais rápida (2.2; 10, começa por medir). A 2.7 (itens relatados nos testes) não vira fase: cada item entra na fase que mexe na tela dele. A lista de testes da Estrutura estava vazia em 2026-10-28

### Decisions

Decisões travadas (DEC-01..DEC-17) no bloco `<decisions>` de PROJECT.md; candidatas (CAND-01..07) e questões abertas (D6–D12, OQ-*) nas tabelas logo abaixo dele. As que pesam agora:

- [Phase 1]: DEC-01/02/06 — hidratar o `DataState` inteiro por Espaço, tabela genérica `plataforma.registros`, revisão otimista por Espaço (3 tentativas); as rotas só compõem hidratar → operação → diff.
- [Phase 1]: DEC-08 — projeto Supabase próprio `epomplsskqpluxuujpxl`; nada de JOIN com o `public` do financeiro; cabeçalho de `001-plataforma.sql` está desatualizado quanto a isso.
- [Phase 1]: DEC-09/10 — testes de persistência pulam sem `DATABASE_URL`; migrações numeradas e imutáveis (`002-*.sql` para colunas geradas).
- [Phase 2]: DEC-11/14 — backend do financeiro-tria intacto; `automation/` fala com o `apps/api` só por HTTP pelos 7 métodos.
- [Phase 3]: motor de Automações (AUTO-01) colocado explicitamente na Phase 3 como infraestrutura genérica; o Financeiro é o primeiro cliente.
- [Phase 01]: OPERACOES (registro.ts) tem 132 operações — allowlist de despacho de POST /operacoes/:nome; receiveMessage ficou de fora por não ter actingMemberId como segundo parâmetro — Plan 01-03
- [Phase 01]: PERS-07 fechado: migração 002 (colunas geradas status_id/list_id/due_date + 6 índices parciais, 5 GIN jsonb_path_ops para arrays) aplicada e imutável no Supabase do projeto — Testada contra o banco real (8 casos); persistencia.test.ts continua verde — colunas geradas não entram em hidratar()/gravar()
- [Phase 01]: T-1-SC tratado — checkpoint humano bloqueante aprovou `fastify` 5.12.5, `@fastify/type-provider-zod` 1.0.0 (peer `zod >=4.2.0`, aceita o `zod ^4.6.1` do monorepo, sem fallback), `@fastify/cors` 11.3.0 e `concurrently` 10.0.5 nos repositórios oficiais no npm, antes de qualquer `npm install` da fase — Plan 01-02 liberado
- [Phase 01]: D-02 materializado — apps/api verifica o JWT do Supabase por getClaims() e resolve o Membro por userId dentro do WORKSPACE_ID configurado, nunca por id que o cliente mande (T-1-02); state ativo/suspenso passam, removido/pendente 403 — a mesma regra do front, agora aplicada de verdade pelo backend — Plan 01-02
- [Phase 01]: .gitignore ganhou exceção !.env.example/!.env.local.example — o padrão .env* pré-existente ignorava também os exemplos, então apps/api/.env.example nunca tinha sido commitado; sem segredo real nos três .example agora rastreados — Plan 01-02
- [Phase 01]: Plan 01-07: store.ts hidrata de GET /estado e grava por POST /operacoes/:nome via um Transporte (transporteHttp/transporteEmMemoria); run() clona o DataState e decide a recusa do domínio sem rede (D-05); revisão defasada ou 409 sempre re-hidratam (D-06) — API pública do store (useData/useSession/useCurrentMember/useRun/useLastResult) inalterada; buildProductSeed() só sobrevive em PublicoProvider (OQ-PF-01)
- [Phase 01]: PERS-04 fechado: POST /operacoes/:nome (despacho por OPERACOES) e GET /estado servem os 132 casos de uso do domínio pela Unidade de Trabalho; gravar() devolve registros (não contagens), executar() sincroniza nextId e devolve revisao/revisaoAnterior (D-03/D-06) — Plan 01-04
- [Phase 01]: syncIdSequence (packages/dominio/src/operations/activity.ts) casava qualquer id hand-authored de 6+ caracteres como sequência base36, estourando Number.MAX_SAFE_INTEGER com ids reais do seed (agt_classificador) e gerando ids duplicados — corrigido para casar só exatamente 6 caracteres, a largura que nextId() produz — Plan 01-04, Rule 1
- [Phase 01]: PERS-06 fechado: applyContasAPagar/applyContasAReceber ganham opcoes.fixtures (padrao true) preservando buildSeed() byte a byte (233 testes provam); buildGestaoBootstrap() monta o DataState de producao so com a config do Financeiro + Maryane Proprietaria; bootstrapGestao() grava via semear() guardado por count(*)>0 - rodado contra o Supabase real, ws_n1 criado com 98 registros sem tasks/contacts/activity, segunda execucao confirmada no-op
- [Phase 01]: PERS-09 fechado: inviteMember casa existing por userId antes de invitedIdentity quando o input traz o dado; resolverUsuarioPorEmail (apps/api) pagina admin.listUsers (sem filtro nativo por e-mail, A1 confirmada) e convidarMembro compõe I/O + operação antes de executar() — reconvite reativa o mesmo Membro removido de ponta a ponta, provado contra Postgres e Auth reais; SERVICOS na rota descarta qualquer userId do corpo (T-1-08)
- [Phase 01]: Fase 1 fechada: e2e/criar-conta.test.ts prova o critério 1 do ROADMAP inteiro por app.inject() contra o Supabase real (bootstrap → Membro real cria Conta → recarga → recusa em 200 → segundo processo sem colisão de ids → aplicarDiferenca ≡ re-hidratação); apps/api/README.md fecha o roteiro operacional e documenta PERS-08 como bloqueado por D11, sem nenhuma ação de deploy; npm run check verde nos três workspaces com e sem DATABASE_URL (357 testes com o Supabase real; os três arquivos de teste originais do domínio sem diff desde d713253) — Plan 01-09
- [Phase 01]: Plan 01-11 fechado: CR-02 (gap 2 de 01-VERIFICATION.md) — esquemaDeArgumentos(nome) valida a FORMA dos args de POST /operacoes/:nome (23 schemas por operação via satisfies contra ArgumentosDe<N>, fallback estrutural de profundidade 6 para as demais) ANTES do despacho; TypeError dentro de uma operação sem schema próprio vira 400 com rollback (nunca 500); inviteMember fica fora de ESQUEMAS de propósito (T-1-08 preservado); app.ts e packages/dominio/apps/web intocados
- [Phase 01]: Plan 01-10 fechado: CR-01 — inviteMember casa existing por porUserId ?? porEmail (porEmail sempre calculado); casos (g)/(h)/(i) em members-reconvite.test.ts e (e) em convidar-membro.test.ts provam que o caminho pendente-so-por-invitedIdentity nunca gera um segundo Membro quando o e-mail resolve um userId depois. Fase 1: 11/11 planos executados, pronta para nova rodada de /gsd-verify-phase 1.
- [Phase 00 P01]: paginarPorCursor para em página PARCIAL (comprimento bruto < COMENTARIOS_POR_PAGINA), nunca em página cheia — RESEARCH.md Pattern 2 ('página parcial = última página'); testes (d)/(g) só passam juntos com essa regra, não com a leitura literal do texto de ação do plano
- [Phase 00 P01]: campo cursor de PaginaPorCursor guarda o cursor da PRÓXIMA chamada (undefined na última página), não o usado na atual — semântica não especificada pelo plano, escolhida para facilitar retomada externa
- [Phase 00]: Plan 00-02: 5/6 e-mails do de-para resolvidos via GET /team real; revisor FO 81581802 não encontrado (provável Team Family Office/Marcos Paulo 9011658148, fora do alcance do token da Tria) — entrada explícita fonteDoEmail: nao-resolvido, email vazio recusado por inviteMember, sem inventar valor; PREP-04 fica parcial até o dono informar o e-mail real
- [Phase 00]: Plan 00-02: CLICKUP_CONTAS_A_PAGAR_ID e variantes MP_/FO_ reclassificadas de id-de-lista para id-de-usuario no catálogo (Rule 1) — o código real usa contasAPagarUserId=81581816, o ClickUp user id do Financeiro, não uma Lista; a heurística de nome do plano estava imprecisa para esta variável
- [Phase 00]: exportarClickUp: time_in_status é smoke-testado por execução inteira (não por Lista) — a primeira falha 4xx desliga o recurso globalmente; anexo já em disco conta em anexosBaixados para a retomada produzir as mesmas contagens da execução original — Plan 00-03
- [Phase 00]: Plan 00-04: exportar.cli.ts CLICKUP_API_TOKEN= (variável definida vazia) prova o caminho sem token, não env -u sozinho — carregarEnv() repõe do .env qualquer chave ainda ausente
- [Phase 00]: Plan 00-04: time_in_status confirmado DISPONÍVEL no Workspace Tria (smoke test real na Tarefa 868k8tn50) — responde Open Question 2 do RESEARCH.md; Plan 00-05 exporta o recurso sem o smoke test desligá-lo
- [Phase 00]: Plan 00-05: exportação real das 3 Listas do ClickUp concluída sem interrupções (2h01m35s, 11.000 requisições, 0 avisos); MANIFESTO.md/.json commitados (11.001 arquivos, hashAgregado adf52d27...6d68); PREP-02 fechado
- [Phase 00]: Plan 00-05: achado real — Lista 901109104938 (Solicitação de pagamento) só tem 19 Tarefas em disco, não as ~1.110 do inventário legado; as ~1.110 são linhas de solicitacoes_pagamentos no Supabase do financeiro-tria, não Tarefas retidas no ClickUp (verificado por list.json.task_count=18, paginação completa, 0 avisos) — impacta Plan 00-06 (spec lê Lista pequena) e a origem de dado da importação de histórico na Fase 2/3
- [Phase 00]: Plan 00-06: PREP-03 fechado — docs/07-processos/solicitacao-de-pagamento.md (326 linhas, §1-§12) lida da exportação real da Lista 901109104938 (19 Tarefas) + código do automation/ (payment-rules.ts, clickup-payment-mapper.ts, payment-automation-service.ts, adapters/ai.ts, http/routes.ts); D6 e D8 fechados por texto; OQ-CMP-01/02/04 absorvidos. Diretriz geral do dono (2026-09-17) fechou L-02 (só os 4 Status atuais são oficiais) e L-08 (RESUMO funciona como no ClickUp, Markdown nos Comentarios); L-04, L-05, L-06, L-10 fechados por derivacao de codigo/exportacao (Cartao vira 4a opcao, W-Equipe fica como esta, creator=ClickBot em 6/19 Tarefas confirma Formulario coexistindo com Membro, mesma funcao resolveAccountConfig/resolveCategoryCodeAgainstOmie usada por Solicitacao e Contas a pagar). L-01 (momento em que a Conta a pagar nasce), L-03 (divergencia nao bloqueante em 868jxd42g), L-07 (cobranca quando Aprovador nao responde), L-09 (data de revisao do fallback) e L-11 (Revisor do RESUMO como Papel oficial) continuam abertos em §12 sem marcador, devolvidos ao dono para decisao antes/durante o planejamento da Fase 2. — A spec e pre-requisito de toda a Fase 2 (SOL-01..09); fechar o maximo possivel por dado real e codigo (em vez de esperar resposta item-a-item do dono) reduz o numero de decisoes humanas pendentes a so 5, todas genuinamente fora do alcance da exportacao/automation.
- [Phase 00]: Plan 00-07: Fase 0 fechada — PREP-01..06 com status Complete/[x] e prova (commit ou decisão D-13) em REQUIREMENTS.md; PREP-05 (rotação Omie) é risco aceito pelo dono em 2026-09-16, não pendente; ROADMAP.md não editado pelas tasks de código (a Task 1 verificou git diff --quiet), mas ajustado no fechamento do plano — critério 4 e linha do índice da Phase 0 (ver SUMMARY 00-07 para o texto exato e o porquê de não ficar pendente para um orquestrador separado); README.md do apps/api ganha a seção de exportação do ClickUp; npm run check verde (dominio 253, api 120, web 53) com e sem CLICKUP_API_TOKEN/DATABASE_URL no shell
- [Phase 01]: Plan 01-12 fechou WR-10 (reviverArgumentos dentro de try/catch na rota, RangeError vira 400, caso (s) 10.000 níveis) e criou a fundação dos schemas por módulo — esquemas/fragmentos.ts (portão de enum bidirecional Igual<A,B>/Confere<T>, IN-10) + esquemas/{tarefas,automacoes,financeiro}.ts, esquemas-de-argumentos.ts reduzido à composição por spread; molde que os Plans 01-13/14/15 copiam para os outros 12 módulos do domínio. Cobertura total (opção b) escolhida sobre 404-para-sem-schema (opção a): 128/132 operações são chamadas de fato por apps/web — nenhuma foi marcada como fechando PERS-04 (o gap CR-02 só fecha por inteiro no Plan 01-16)
- [Phase 01]: Plan 01-13 fechou esquemas/negocios.ts (12), esquemas/conversas.ts (11) e esquemas/contatos.ts (17) — 40/40 operações do CRM (deals/conversations/contacts) com schema próprio satisfies Esquemas, DEAL_CONTACT_ROLE/CONTACT_IDENTIFIER_TYPE/COMPANY_IDENTIFIER_TYPE fechados por Igual/Confere; provado contra os call sites reais de apps/web. Roda em paralelo com 01-14/01-15; ESQUEMAS e a rota só mudam no Plan 01-16 (composição final). PERS-04 continua com a ressalva de 01-VERIFICATION.md.
- [Phase 01]: Plan 01-14 fechou esquemas/ia.ts (7), esquemas/pastas-de-chat.ts (4), esquemas/construtor-de-agentes.ts (2), esquemas/configuracao.ts (14) e esquemas/colaboracao.ts (9) — 36/36 operações de IA/Chat/configuração/colaboração com schema próprio satisfies Esquemas, CHAT_ANCHOR_TYPE/FIELD_TYPE/FEATURE/DEPENDENCY_KIND/MEDIA_TYPE fechados por Igual/Confere; provado contra os call sites reais de apps/web, inclusive AgentDraft (4 níveis) e RecurrenceRule (copies aninhado). createChatFolder ganha { name: z.string() }.strict() — o caso (q) de operacoes.test.ts passa a cair no schema, não mais em TypeError; o reapontamento é do Plan 01-16. Roda em paralelo com 01-13/01-15; ESQUEMAS e a rota só mudam no Plan 01-16 (composição final). PERS-04 continua com a ressalva de 01-VERIFICATION.md.
- [Phase 01]: Plan 01-15 fechou esquemas/planejamento.ts (11), esquemas/escala.ts (14), esquemas/membros.ts (5) e esquemas/estrutura.ts (3) — 33/33 operações de planejamento/escala/Membros/estrutura com schema próprio satisfies Esquemas. As duas formas hostis que o verificador reproduziu contra ARGUMENTOS_GENERICOS (createGoal kind:42+anchor.lixo, saveView filters arbitrário) caem em teste puro. inviteMember ganha entrada em ESQUEMAS com o único .strip() da pasta — segunda barreira de T-1-08, SERVICOS.inviteMember em operacoes.ts intocado. Roda em paralelo com 01-13/01-14; ESQUEMAS e a rota só mudam no Plan 01-16 (composição final). PERS-04 continua com a ressalva de 01-VERIFICATION.md.
- [Phase 01]: Plan 01-16 fechou CR-02 por inteiro: ESQUEMAS = spread dos 15 arquivos de esquemas/ satisfies EsquemasCompletos (portão de completude — operação de OPERACOES sem schema não compila), ARGUMENTOS_GENERICOS/fallback estrutural removidos, mapeamento TypeError->400 removido da rota (WR-11, por remoção — não existe mais operação sem schema). createGoal (kind:42+anchor.lixo) e saveView (filters arbitrário) provados 400 por HTTP com nada persistido (casos (t)/(u)/(v)); (q) reapontado para cair pelo schema de createChatFolder. npm run check verde (dominio 253, web 53, api 163); packages/dominio, apps/web e apps/api/src/app.ts sem diff em toda a rodada 01-12..01-16. PERS-04 marcado como requisito concluido — a ressalva de 01-VERIFICATION.md se dissolve. Fase 1: 16/16 planos GSD executados — instrução explícita do orquestrador para este plano de fechamento (onda 3 de 3 da segunda rodada de CR-02)
- [Phase 03]: Plan 03-01: plataforma.automacao_agenda (005) aplicada no Supabase da plataforma — PK (workspace_id, list_id, dia_civil) é o invariante 'um dia civil por Lista', índice parcial + for update skip locked dão exclusão mútua entre instâncias do apps/api, e 'processando' com locked_at vencido volta a 'falhou' (critério 3 do ROADMAP verificável). A tabela NÃO é fonte de idempotência: essa continua em AutomationExecution/jaRodou (runScheduledAutomations). — Duplicar a idempotência no banco criaria duas fontes de verdade a manter sincronizadas; o que só o banco dá é lease entre processos e auditoria do dia processado. As quatro garantias estão provadas contra o Postgres real em agenda-de-automacoes.test.ts; nenhum ledger novo — a importação de Contas a pagar reusa importacao_ledger com origem = 'clickup:901107637383'.
- [Phase 03]: Plan 03-03: as regras de vencimento de A1 (D3-05/D3-06/D3-07) passam a ser provadas por par de datas exato em recorrencia-contas-a-pagar.test.ts (19 casos) — 2026-01-31 satura em 28/02 e, com dia útil anterior, vence em 27/02; Carnaval e Natal não deslocam; domingo recua dois dias. Nenhuma linha de lógica nova: o diff de collaboration.ts é só de comentário e operations.test.ts ficou intocado (CON-05). O teste lê o package.json da camada e exige dependencies == [zod], tornando a proibição de dependência de datas de D3-06 executável.
- [Phase 03]: Plan 03-03, achado registrado sem reabrir decisão: a saturação de D3-07 é absorvente — com businessDays 'anterior' (regra real do seed) uma conta de dia 31 percorre 2026-01-31 → 02-27 → 03-27 → 04-27 → 05-27 → 06-26, isto é, o dia recua e não volta. Corrigir exigiria guardar o dia âncora da série (código novo, fora do plano); o comportamento foi PINADO por teste para que mudá-lo seja deliberado. Também: a evidência de D3-06 em 03-RESEARCH.md está mal atribuída (2025-02-17 é segunda comum com 11 Tarefas, não Carnaval com 4; nenhuma das 2.830 Tarefas com vencimento do export cai em feriado nacional) — D3-06 segue valendo como decisão do usuário.
- [Phase 03]: Plan 03-04: a decisão do lançamento foi separada da execução — `buildResumoDePagamento` e `runLancamentoAgent` RECEBEM um `DeParaDeLancamento` (`contaPorTag` + `categoriaPorCampo` + `origem` obrigatória) por parâmetro opcional no fim, com `DE_PARA_DO_PROTOTIPO` como padrão, e o domínio segue sem `fetch`/env (D3-02: recebe, nunca busca). `veredito` `"revisar"`/`"ausente"` faz `runLancamentoAgent` devolver `fail` — `execute` interrompe o laço e A8 não move para "lançado omie": quem formata tolera, quem executa recusa (T-3-10). `rehearsal: true` (campo antigo de B82, até aqui `false` fixo) vira Ensaio estrito: zero Comentário/Status/Atividade, só a `AgentExecution` de sombra, uma por conta, guardando a TRIPLA conta/categoria/código e nunca o texto do RESUMO, que carrega chave Pix e código de barras (T-3-09). O texto de CON-CP-08 está travado por dois literais golden capturados ANTES do refactor (commit be88ef9, verde contra o código antigo) — vencimento fixado à mão porque o seed usa data relativa a hoje, e o NBSP que o `Intl` pt-BR emite depois de `R$` escapado como ` `. Transporte endurecido no `apps/api`: `opcional(OPCOES_DE_LANCAMENTO)` com `.strict()` e o portão `Confere<[Igual<…>]>` (IN-10). 409 testes no domínio, `npm run check` verde nos três workspaces (decomposto por workspace — o monolítico estoura o teto de 600s por causa dos ~11min do `apps/api` contra o Supabase remoto).
- [Phase 03]: Plan 03-04, desvio Rule 2 e pendência a realocar: a recusa do Agente também NÃO escreve na Tarefa durante o Ensaio — um helper `recusar()` transforma o pedido ao Financeiro em passo de raciocínio. O plano bifurcava o Ensaio só depois de `buildResumoDePagamento`, deixando o caminho de `erpMissingFields` publicar Comentário em sombra: furo direto na invariante T-3-08, e justamente no caminho mais provável na primeira semana. Fora do Ensaio o comportamento é byte a byte o de antes. E a metade CNPJ de PAG-04 (`CNPJ_POR_EMPRESA`) segue ABERTA por conflito de arquivo dentro da onda 1 — quem a lê é `automations.ts:118` (`fillTemplate`, `{{cnpjEmpresa}}` de A5/A6), arquivo de 03-02; candidatos a receber o item são 03-02 (dono do arquivo) ou 03-11 (que já injeta o de-para resolvido).
- [Phase 03]: Plan 03-09: PAG-01 fechado no domínio — `importarContaAPagarHistorica` cria a Tarefa JÁ no Status final via `createTask(..., { runAutomations: false })` e escreve a trilha com `recordActivity({ at })`, sem tocar `changeTaskStatus` (o código fora de comentário tem 0 ocorrências). É a divergência consciente do precedente `importarSolicitacaoHistorica`, cuja autorização (`importacao.ts:34-41`) vale só porque aquela Lista não tem Automação; esta tem sete + a Recorrência A1, e o replay ingênuo pariria recorrência fantasma por conta paga, cobrança de nota em conta fechada e Responsável reescrito. Prova não-vazia em `importacao-contas-a-pagar.test.ts` (9 casos): afirma `>=7` Automações ativas na Lista ANTES de afirmar `automationExecutions === 0`; `diasEmStatus` lê só `state.activity` e devolve 30 dias para um ciclo real. `completedAt` = `fechadaEm ?? instante da última transição` e só em categoria terminal; Status final que `statusDefinition` não resolve é recusa (T-3-08, porque `createTask` cai no primeiro `naoIniciado` em silêncio); divergência entre Status final e histórico vira lacuna `status_final_diverge_do_historico`, não recusa. `jaImportada` passou a ser exportada de `importacao.ts` (1 palavra) em vez de duplicada (T-3-02); `ORIGEM_CONTAS_A_PAGAR = 'clickup:901107637383'` é fonte única com `importacao_ledger.origem` de 03-10 — nenhum ledger novo. Verificação por mutação antes de confiar no verde: ligar `runAutomations` faz o caso (a) falhar com 3 Execuções. 418 testes no domínio; `npm run check` decomposto verde nos três workspaces sem DATABASE_URL (api 380 passed/12 skipped).
- [Phase 03]: Plan 03-05: PAG-06 fechado por DERIVAÇÃO, não por concessão — o checkpoint bloqueante da Task 1 foi auto-resolvido como option-a sob o modo autônomo da fase (não é aprovação humana; o ponto de reversão é um único ramo em memberSeesTask). List.sharedWithDefinitionIds declara, como dado na Lista, quais Campos 'person' nomeiam quem enxerga a Tarefa; memberNamedOnTask (derive.ts) lê o Valor ativo com guarda obrigatória de type === 'person' (T-3-11: texto igual a um id de Membro não abre nada) e entra em memberSeesTask ENTRE a Grant da Tarefa-raiz e memberReachesContainer — nenhuma resposta já verdadeira muda. As quatro Grants gr_cp_pessoa_* saíram do seed e tsk_cp_konq ganhou val(F.pessoa) — as duas fontes de verdade que já tinham divergido viraram uma. Não há Grant a criar nem a revogar, então o caminho de 'revoke perdido' de T-3-01 deixa de existir. pessoa-da-conta.test.ts (12 casos) prova o negativo nos dois sentidos, a guarda de tipo, Administrador/Membro ainda sem a Lista, e os três momentos que a Grant estática nunca cobriu — inclusive que a ocorrência de A1 nasce visível (antes a Pessoa era Observadora de uma Tarefa que não enxergava). 430 testes no domínio, web 107, api 380+12 skipped; tasks.ts/automations.ts e os três testes de CON-05 sem diff.
- [Phase 03]: Plan 03-05, dois registros de fronteira para quem vier depois: (1) T-3-12 fica ACCEPT com endereço em 03-14 — apagar as Grants gr_cp_pessoa_* do seed NÃO apaga as já persistidas no Postgres da plataforma por um bootstrap anterior; enquanto existirem, o comportamento é idêntico ao desejado (o Pedro É a Pessoa das três contas), e nenhuma migração foi criada por isto. (2) A9 só roda em tarefaCriada, então a Pessoa preenchida DEPOIS da criação (o caminho real, porque createTask não aceita Valores de Campo) não vira Observadora — a VISIBILIDADE deixou de depender disso, o OBSERVADOR ainda depende; é trabalho de PAG-02 (03-02), não de 03-05. Efeito de interface para 03-15: a tela configuracoes/membros/[membro] mostra 'Concessões diretas' e o Pedro/Lucas passam a aparecer com MENOS linhas — a visibilidade deles saiu da Grant e foi para a configuração da Lista. E correção de comando: 03-VALIDATION.md mapeia PAG-06 a 'npm run test --workspace=@n1/dominio -- tasks'; o real é '-- pessoa-da-conta'.
- [Phase 03]: Plan 03-06: D3-08 fechado — `converterSolicitacaoEmContaAPagar` (`operations/conversao-de-solicitacao.ts`, arquivo próprio para não criar o ciclo `financeiro ⇄ automations`) cria a Conta a pagar a partir da Solicitação aprovada dentro da plataforma, registrada em `OPERACOES` e alcançável por `POST /operacoes/converterSolicitacaoEmContaAPagar`. É a metade do critério 1 que PAG-01 não cobre: 03-09 resolveu o histórico, esta resolve o fluxo dali para frente. `convertida` NÃO virou quinto Status: a premissa da pesquisa (Open Question #1) estava errada e o caso (a) a confere em código — o catálogo sempre teve quatro Status, e o que D-14 prometeu à Fase 3 foi *a Conta a pagar e o Vínculo estruturado*, que é o que nasceu (`Link` `task→task` com `role: "conta a pagar gerada"` + `provenance.kind = "task"`). Os três custos verificados de um quinto Status (os dois testes do domínio e a união `PaymentRequestDtoV1["status"]` do contrato v1) ficaram escritos em `packages/dominio/CONTEXT.md` para quem quiser revisitar. O de-para dos 25 Campos é travado por aritmética (21 pares + 3 órfãos + 1 vencimento nativo), e o gatilho `tarefaCriada` é ADIADO, não desligado — espelho invertido de 03-09. 447 testes no domínio (17 novos), web 107, api 380+12 skipped.
- [Phase 03]: Plan 03-06, a fronteira que decide e o buraco que a mutação achou: (1) valor que a Lista destino não REPRESENTA (a Forma de pagamento tem 4 opções na origem e 3 no destino) vira Registro `Lacuna de conversão` com o NOME do Campo, nunca o valor (D-25), e a conta NASCE — RN-CP-02 a segura em "para pagar" até alguém decidir; qualquer outra recusa (Campo arquivado, Campo fora da Lista) é rollback das quatro contagens. Sem a pré-conferência de `options`, o caso do Cartão viraria rollback e o Financeiro voltaria ao ClickUp exatamente pelo caso que o critério 1 quer eliminar. (2) A barreira de dupla conversão NÃO filtra `lifecycle` (a Conta na lixeira continua barrando — dinheiro em dobro é pior que conta apagada) e roda ANTES de `createTask`, para que a recusa não queime um identificador legível. (3) A verificação por mutação achou prova vazia: com `runAutomations: true` na criação A9 roda DUAS vezes e a segunda volta adiciona a Pessoa assim mesmo — a asserção "a Pessoa está entre os Observadores" não distinguia desenho de acidente. Corrigida para afirmar UMA Execução de `aut_cp_a9`. (4) Desvio Rule 3: `apps/api/src/rotas/esquemas-de-argumentos.test.ts` fixa o total de operações registradas em literal (200 → 201); 03-09 não tocou nisso porque registrou a operação FORA de `OPERACOES`. (5) Fora de escopo e agora única peça faltando: o gatilho automático ao entrar em `aprovado`, que mora em `tasks.ts` ou `automations.ts` — posse de arquivo da onda, não dificuldade.
- [Phase 03]: Plan 03-07 (Tasks 1-3): superficie HTTP nova (POST /v1/integrations/contas-a-pagar/resolver e /lancar em ../financeiro-tria/automation) confirmada como irma do contrato v1 de Solicitacao de pagamento, nao um 8o metodo -- direcao oposta dos 7 metodos existentes, contrato v1 congelado por §9, §1 ja fora de escopo, credencial PLATAFORMA_LANCAMENTO_TOKEN de escopo minimo (D-15). resolverDeParaDeLancamento nao tem porta de escrita (D3-03, estrutural); lancarContaAPagar consulta antes de incluir (T-3-11), codigo tria:contas-a-pagar:<taskId> determinístico. payment-automation-service.ts e payment-rules.ts intocados (CON-05). Task 4 (provisionar credencial + verificar contra Omie real) PARADA por falta de acesso a producao -- ver blocker e 03-07-SUMMARY.md.
- [Phase 03]: Plan 03-08: criarSchedulerWorker() (apps/api/src/automacoes/scheduler-worker.ts) da o relogio ao motor de Automacoes -- lease for update skip locked sobre plataforma.automacao_agenda (03-01), catch-up do dia perdido provado contra Postgres real (o dia falta e reivindicado com a SUA data civil, nao a de hoje), Ator de sistema por resolverMembroAgenteDoPipeline (D-15, nunca sessao humana). A primeira volta REAL de cada (Espaco, Lista) roda em ensaio (D3-03): rodarAgenda e chamada dentro da transacao e o resultado e forcado a ok:false para a Unidade de Trabalho desfazer -- MARCO_ZERO (escrito por 03-10) e ENSAIO_PRIMEIRA_VOLTA compartilham a coluna last_error_code sem migracao nova; liberar e ato explicito (npm run automacoes:liberar). 19 casos verdes contra o Postgres real (19/19 com DATABASE_URL, 6 passam/13 pulam sem -- DEC-09). index.ts liga por AUTOMACOES_WORKER_ATIVO, bloco irmao do outbox. Prova end-to-end contra ws_n1 de producao (grant real ao Agente do pipeline) NAO foi feita -- nao existe ainda Membro com esse Papel em producao; registrado como pendencia de decisao humana, nao bloqueio de codigo.
- [Phase 03]: Plan 03-10 (Tasks 1-3): classificador (contas-a-pagar.ts) provado contra as 2.861 Tarefas reais do export com os numeros exatos do plano (2861 validas, 0 rejeitadas, 12490 transicoes, 2830 com vencimento, 630 com reentrada, 82/83 divergencia de vencimento); orquestracao por lotes (250) com ledger na mesma transacao, atomicidade provada por injecao de falha; MARCO_ZERO corrigido para idempotencia por (workspaceId,listId) em vez de por dia civil (Rule 1 -- o texto do plano so protegia o mesmo dia). npm run check verde nos tres workspaces (dominio 447, web 107, api 430+12 skipped). Task 4 (apply real contra ws_n1) e checkpoint bloqueante, aguardando o operador.
- [Phase 03]: Plan 03-11 (Tasks 1-3): OpcoesDaAgenda (uniao discriminada em automations.ts) faz rehearsal:false sem tarefasLancadas nao compilar (T-3-36); invocar-agente.ts resolve o de-para via POST /resolver de 03-07 num pre-passo fora da transacao (aquecer(), cache por workspaceId/listId/diaCivil) e injeta no scheduler de 03-08 pela opcao rodarAgenda; resolverModo() so aceita o literal exato lancar, qualquer outro valor cai em ensaio com aviso; payableId mock- e recusado antes de tarefasLancadas (T-3-37, achado de 03-07). CNPJ_POR_EMPRESA apagada de financeiro.ts (PAG-04) -- fillTemplate le AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA injetado, fallback "da Empresa <nome>" sem mapa. index.ts liga por AGENTE_CONTAS_A_PAGAR_ATIVO, irmao do outbox e do scheduler. Boot local real confirma modo=ensaio, POST real a /resolver e ZERO a /lancar (Postgres real, automation/ substituido por servidor HTTP local). Task 3 (ligar contra o automation/ e o Postgres de PRODUCAO) fica no checkpoint bloqueante -- mesma familia de pendencia que 03-07 (PLATAFORMA_LANCAMENTO_TOKEN) e parcialmente 03-08 (identidade de producao). 47 testes novos (7 dominio + 40 api); npm run check verde nos tres workspaces com e sem DATABASE_URL.
- [Phase 03]: Plan 03-12: alterarStatusEmLote (packages/dominio/src/operations/lote.ts) fecha PAG-05 -- uma transacao para o lote inteiro (61 < 250, a mesma aritmetica de 03-10 aplicada a um N menor), LIMITE_DO_LOTE=200 recusado no dominio antes de qualquer escrita, zero permissao propria (delega a changeTaskStatus item a item; a unica excecao e o curto-circuito jaEstava que consulta memberSeesTask), falha parcial e valor no relatorio (RelatorioDeLote com 4 resultados por item), Registro consolidado por Lista. Achado pinado por teste: RN-CP-05 diz que negado/aprovado nao disparam recorrencia mas isTerminalCategory inclui concluido -- lote para negado CRIA ocorrencia hoje (caso k), correcao fora de escopo. DEC-06 medido contra ws_lote_teste (isolado): tLote 45x-49x mais rapido que tN (61 transacoes individuais); a medida definitiva contra ws_n1 com o volume real fica pendente porque 03-10 Task 4 (importacao real) ainda nao rodou -- ws_n1 confirmado intocado (revisao=3 antes/depois). e2e (6 casos) verde contra o Supabase real da plataforma (epomplsskqpluxuujpxl).
- [Phase 03]: Plan 03-15: compartilhadas-comigo.tsx re-keyed em memberSeesTask && !memberReachesContainer (T-3-77) reabre o caminho da Pessoa da conta ate a propria Tarefa que 03-05 sem querer fechou ao apagar as Grants gr_cp_pessoa_*; buscar/page.tsx (useSession + memberSeesTask/memberReachesContainer, T-3-75) e estrutura/tarefas/page.tsx (memberSeesTask em ativas, aba renomeada para 'Todas que eu vejo', T-3-76) param de listar o Espaco inteiro. Task 3 (checkpoint bloqueante de producao) PARADA -- mesma familia de pendencia que 03-07/03-08/03-10/03-11 (sem VPS, sem credenciais reais de Auth, apps/api/.env bloqueado pelo sandbox desta sessao).
- [Phase 03]: Plan 03-13: BulkStatusBar chama alterarStatusEmLote (03-12) uma vez em vez de um laco de changeTaskStatus (gravarMock chamado 1x para um lote de 61, args=[ids, statusId] sem actingMemberId); RelatorioDeLotePainel (arquivo proprio, sem tasks/useData -- T-3-55 estrutural) renderiza os quatro resultados com parcial em bloco proprio, sem botao de repetir; teto do lote (LIMITE_DO_LOTE) recusado antes do clique; o gatilho de D3-08 entra como botao no card de Aprovacao da Solicitacao (converterSolicitacaoEmContaAPagar). 12+16 testes novos/estendidos verdes em @n1/web (140 no total). Task 4 (checkpoint bloqueante de producao: lote de 61 contra o banco real, login como Financeiro/Aprovador) PARADA -- mesma familia de bloqueio de 03-07/03-08/03-10/03-11/03-15 (sem VPS, sem credenciais reais, apps/api/.env bloqueado pelo sandbox desta sessao).
- [Phase 3]: Plan 03-14: Tasks 1-3 (contrato do domínio, o diálogo do lançamento humano, o relatório executável ensaio:relatorio) code-complete e verificadas, incluindo rodada real contra ws_n1 de produção (INCONCLUSIVO — zero linhas em automacao_agenda, correto dado que 03-10 Task 4/03-11 Task 3 seguem parados). Task 4 (o runbook de corte, checkpoint bloqueante) tem o documento escrito (06-runbook-de-corte.md) mas NAO executado — os 11 passos exigem importação real, ponte HTTP em produção, uma semana de calendário de Ensaio e uma decisão irreversível (arquivar a Lista 901107637383), nenhuma alcançável neste ambiente. Mesma família de bloqueio de 03-07/03-08/03-10/03-11/03-13/03-15.
- [Phase 05]: 05-01: config por Empresa modelada na Integration (empresa/omie/avisosPorCanal/statusDeclarados), nunca em Campos da Lista — nenhum campo para app_key/app_secret (D5-03)
- [Phase 05]: 05-01: em revisão entra como 5º Status (sts_sp_em_revisao, order 4) da Lista de Solicitações — os 4 Status de D-01 mantêm o mesmo order
- [Phase 02]: D-16 fechado por hash: contrato v1 copiado verbatim para financeiro-tria e comparado por sha256 agregado (scripts/verificar-contratos.mjs), nunca pacote npm compartilhado
- [Phase 02]: Achado real: caminho de aprovação por CLIQUE (rotas/operacoes.ts) não emite evento de outbox hoje — só o callback de classificação por comentário notifica o automation/. Bloqueia o ensaio de duas semanas até corrigido
- [Phase 02]: Achado real: eventIdDoComentario (financeiro-tria/automation/classificador-de-aprovacao.ts) gera uuid que z.uuid() rejeita na maioria dos casos — fallback por comentário quebrado em produção até corrigido no repositório irmão
- [Phase 02]: Achado real: Convidado Agente do pipeline não tem grant de comentar por padrão em nenhuma Tarefa — createComment via service credential falha 422 até o evolver ou uma exceção tipo guestStatusWriter resolver isso
- [Phase 06]: 06-01: textos canônicos da Conferência em operations/financeiro-textos.ts (evita o ciclo ai ↔ financeiro), reexportados por financeiro.ts
- [Phase 06]: 06-01: a tripla conta · categoria · código e a impressão de lançamento vivem em ApprovalRequest.origin (ramo resumo); o lançamento só se registra com conferenciaDoResumo = conferida para a impressão atual (D6-10)
- [Phase 06]: 06-01: registrarFalhaDoLancamento muda o Status antes de comentar — o aviso só diz que a conta voltou para para pagar quando voltou
- [Phase 06]: 06-02: contrato contas-a-pagar v1.1 aditivo no mesmo endereço (D6-05) — codigoCategoriaConfirmado validado no plano de contas real sem chamar o RAG (plano inalcançável ⇒ revisar); pedidoDeRevisao no fim da consulta, nunca em log
- [Phase 06]: 06-02: anexos string | { url, nome } no /lancar; o nome vai para dentro do zip e para cNomeArquivo; anexos[].nome só volta quando pedido com nome; anexo string vazio passou a 400
- [Phase 06]: 06-03: a ponte em dois momentos; /lancar só com Conferência aprovada; zero /lancar em ensaio e conferencia; portas de teste G1 (legado importado nunca varrido), G2 (AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM), G3 (AGENTE_CONTAS_A_PAGAR_AVISAR_ID)
- [Phase 06]: 06-04: botões da Conferência só para quem alcança a conta (memberSeesTask) e pode decidir (aprovador ou revisor Administrador); cp-conferida/cp-ajuste só rodam pedidos pelo nome
- [Phase 06]: 06-21 (terceira rodada, achado de 06-REVIEW-3.md): remarcar "Integração manual" não engole mais uma resposta pendente no fio — defesa em duas camadas (precheck na ponte + re-checagem no domínio dentro da transação, `dispensarConferenciaDoResumo` recusa com `recusaDispensaComRespostaPendente`). O "give-up" de uma resposta sem efeito ficou local ao id do comentário (`semEfeitoDesistidoId`/`tentativasSemEfeito`), nunca em `estado.parada` — a primeira versão do design tocava `estado.parada`, mas `chaveDaPonte()` não reage a comentário e `PARADA_RESTAURADA` só dispara em reinício de processo; o gsd-plan-checker bloqueou esse desenho antes da execução.
- [Phase 06]: 06-22 (quarta rodada, regressão achada por 06-REVIEW-4.md no próprio 06-21): as três checagens novas de 06-21 fixavam `aprovacaoPorComentario: true`, travando para sempre a dispensa por Integração manual em espaços com `conferenciaPorComentario: false` diante de um "ok" trivial e desatualizado. Corrigido roteando `decisoes.conferenciaPorComentario` de verdade pelos 3 call sites via um parâmetro opcional novo em `dispensarConferenciaDoResumo` (padrão `true`, preserva todo chamador antigo). Teste de mutação (reverter para `true` fixo) reproduz o próprio achado do revisor.
- [Phase 06]: Fase 06 fechada em 2026-09-30 — 22/22 planos, cinco rodadas de revisão adversarial (crm-n1: 06-REVIEW..06-REVIEW-5; financeiro-tria: 06-REVIEW-FINANCEIRO-TRIA..3), a última (06-REVIEW-5.md) limpa e escopada só ao diff final. RES-01/02/04/05/06 Complete; RES-03 Pending — único item que falta é verificação humana (passo 2B em modo `lancar`, `06-VERIFICATION.md`), não código. Lista do que fica com o dono, fora do alcance deste agente: (1) RES-03 — rodar o modo `lancar` de verdade e confirmar o passo 2B; (2) deploy do `automation/` com o contrato v1.2 + `PLATAFORMA_MEMBRO_POR_CLICKUP_ID`; (3) S5/S6 ao vivo contra produção, só depois do deploy; (4) configuração do `apps/api` em produção para a ponte; (5) push e merge de `integra-frontend-main` (branch local, nunca enviada); (6) decidir se algum padrão D6-01..D6-04 deve deixar de espelhar o ClickUp; (7) o residual fin2:CR-01 (índice/migração de banco, se o dono quiser fechar por completo); (8) fin2:IN-07 — prova real de dois anexos no mesmo lançamento (o script `teste:omie-real` só aceita um `--anexo` hoje).
- [Phase 07]: 07-01 D-12: temBancoCrm só é verdadeiro para localhost/127.0.0.1; prepararBancoCrm lança fora disso, então migrar() nunca roda contra o Supabase pelo teste
- [Phase 07]: 07-01 D-11: sem Proprietário informado, Proprietário e criado_por do Contato são o Membro da sessão; corpo de POST /contatos .strict() sem proprietarioId até o 07-02
- [Phase 07]: 07-02 D-14/D-10: podeNoCrm devolve a frase de recusa e o Papel é lido de plataforma.registros (members -> roles) a cada requisição; MembroDaSessao intocado
- [Phase 07]: 07-02 T-07-06: comTransacao traduz só 23505/23503/23514 com constraint cadastrado; o resto é relançado e vira 500 genérico
- [Phase 07]: 07-03: forma invalida de Contato (normalizacao, limites) e 400 VALOR_INVALIDO; regra (RN-CON-11, D-09) e 409 com bloqueios; valor canonico de Identificador nao se edita
- [Phase 07]: 07-03: vinculo com Empresa na lixeira fica oculto na ficha do Contato e nao conta em empresasEmQueEhUnicoAdmin
- [Phase 07]: 07-04: Funil/Etapa so se editam quando ativos (FUNIL_INATIVO); ContagemDeNegocios e disjunta; remapear nao toca a probabilidade sobrescrita do Negocio; padrao decidido sob lock consultivo por Espaco
- [Phase 07]: 07-05: RN-EMP-05 (dominio de provedor publico) e INV-EMP-01 sao 409 (DOMINIO_PUBLICO, EMPRESA_SEM_NOME); forma mal formada de Identificador de Empresa e 400 — Regra de negocio recusa em 409 com codigo; forma invalida e 400, como em 07-03
- [Phase 07]: 07-05: trocarAdmin so rebaixa o admin anterior (vinculo segue vigente); arquivar Empresa nao toca vinculos; so a lixeira encerra (D-08); restaurar da lixeira cria vinculo admin novo — Preserva historico e a regra de que a Empresa nunca fica sem admin
- [Phase 07]: 07-05: 007 corrigida (D-12) e commitada; 07-13 Task 1 ainda deve conferir plataforma.migracoes antes do primeiro migrar real — T-07-20: a edicao so vale porque a 007 nunca foi aplicada
- [Phase 07]: 07-06: FormularioDeContato e o corpo controlado (valores/onChange/erros); o servidor normaliza Identificadores e e a autoridade, a tela so pre-valida com o dominio
- [Phase 07]: 07-06: editores de Endereco e Campos adicionais sao de rascunho e devolvem (valor, erro?); a ficha grava por secao
- [Phase 07]: 07-06: ficha antiga movida com git mv para features/crm/legado (D-15); 404 da api + id em state.contacts abre FichaDeContatoLegado
- [Phase 07]: 07-07: lista de Funis com Funil padrao e Privado como Pilulas no Nome (UI-SPEC), sem colunas separadas
- [Phase 07]: 07-07: MigrateFunnelDialog sem escopo abertos/todos (a rota migra todos os Negocios) e com mapeamento sugerido por nome sem caixa ou Etapa inicial
- [Phase 07]: 07-07: useFunis aceita pausado e dialogos fechados nao leem a api; Cor do Funil e Select de tokens var(--...)
- [Phase 07]: 07-08: Empresa so ativa recebe Negocio novo ou trocado (RN-NEG-06); Contato so e recusado na lixeira (RN-CON-19)
- [Phase 07]: 07-08: Restaurar Negocio aberto recusa Funil nao ativo alem da Empresa na lixeira (INV-NEG-03, RN-NEG-18)
- [Phase 07]: 07-08: Corpos de ganhar, perder e reabrir sao nullish; mover recusa Negocio perdido alem do ganho (RN-NEG-04)
- [Phase 07]: 07-09: SeletorDeRegistro so busca com texto digitado (300 ms, limite 10, estado ativo) e devolve {id, nome}; 07-10/07-11 o reusam passando rotulo e, dentro de Field, o id
- [Phase 07]: 07-09: retirar o unico admin de Empresa e recusado pelo dominio no clique (frase + botao Trocar admin) em vez de desabilitar Toggle/Encerrar; Trocar admin e POST unico /trocar-admin; restaurar da lixeira pede o Contato admin pre-preenchido com o ultimo admin encerrado
- [Phase 07]: 07-10: atualizacao otimista do mover do quadro e lista.mutate(otimista, { revalidate: false }) seguida de moverNegocio (que invalida /negocios); a recusa revalida a chave e o cartao volta. Nao usar mutate(chave, promessa, { optimisticData }): o SWR descarta a revalidacao disparada dentro da mutacao
- [Phase 07]: 07-10: o menu do cartao do quadro traz 'Mover para {Etapa}' por Etapa de destino (UI-SPEC §4, WCAG 2.5.7) alem de Abrir/Ganhar/Perder, pelo mesmo moverNegocio
- [Phase 07]: 07-10: no POST /negocios a moeda so acompanha o valor e o Proprietario vazio nao vai no corpo (backend usa o Membro da sessao); ao criar, marcarChegada + router.push para a ficha (o Toast viaja com a navegacao)
- [Phase 07]: 07-12: migrar --seco (migracoesPendentes) e leitura pura provada contra banco vazio e pelo CLI; e o comando que 07-13 roda contra o banco da plataforma antes do migrar com a 007
- [Phase 07]: 07-12: npm run check sai 1 por duas falhas pre-existentes do Financeiro contra o banco remoto (lote-contas-a-pagar 5/6; seed de formularios-publicos.test.ts), reproduzidas isoladas e registradas em deferred-items.md e WINDOWS.md #5 - nao corrigidas, fora do CRM; o resto do portao e o build estao verdes
- [Phase 07]: 07-13: a 007 esta aplicada no banco da plataforma depois da conferencia de D-12 (--seco: 1 pendente -> migrar pelo dono, 984 ms -> --seco: 0 pendentes), provas em 07-PROVAS.md; qualquer ajuste de schema do CRM daqui em diante e 008
- [Phase 07]: 07-13: o roteiro da UAT de fim de fase (8 passos em 07-PROVAS.md) e o que fecha as janelas #1-#4 do WINDOWS.md; a janela #5 (portao com duas falhas pre-existentes fora do CRM) fica como decisao aberta do dono
- [Phase 07]: fechada em 2026-10-11 — UAT 9/9 pelo dono (07-UAT.md), 07-VERIFICATION.md `passed` com 1 override aceita (CRM-V1: `npm run check` com a ressalva das duas falhas pré-existentes do Financeiro), janelas #1-#4 `fixed` e #5 `waived`; qualquer ajuste de schema do CRM é `008`
- [Phase 08]: 08-01: a 008 nasce inteira (Canal, Conversa, Mensagem); o INSERT de POST /canais nunca envia conexao, e o default da 008 garante Canal desconectada
- [Phase 08]: 08-01: a projecao de Canais relacionais entra so em GET /estado (acrescentarCanaisProjetados), nunca em hidratar(); guarda to_regclass cobre banco sem a 008
- [Phase 08]: 08-02: capacidadesDoCanal sobrepoe so o que o provedor muda (whatsapp-nao-oficial sem janela e sem modelo); Canal sem provider = tabela do tipo
- [Phase 08]: 08-03: a decisao de conexao/arquivamento do Canal e funcao pura do dominio (proximaConexao, validarArquivamento); o servico so a grava e os CHECK da 008 ficam como rede contra corrida.
- [Phase 08]: 08-03: unicidade de nome e conta de Canal vale entre a tabela nova e o channels do seed (canalAntigoEmConflito), e toda escrita de Canal soma 1 em plataforma.workspaces.revisao na mesma transacao.
- [Phase 08]: 08-04: pre-checagem CONTATO_COM_CONVERSAS fica entre Negocios e Empresas na exclusao permanente; lixeira nao checa Conversas; FRASES_DE_CONTATOS exportada para o teste da corrida
- [Phase 08]: 08-05: canalPadraoDeResposta e canalPadraoDoTipo so enxergam Canais de resposta (conectados que alcancam o Contato); validarEnvio libera ate o instante exato do fim da janela
- [Phase 08]: 08-06: a Conversa relacional nao avanca a revisao do Espaco (nao e projetada em GET /estado); criar confere Canal, Contato, Identificador do tipo do Canal e o par aberto antes de gravar Conversa e 1a Mensagem no mesmo PoolClient
- [Phase 08]: 08-07: semCanaisProjetados lanca tambem quando um Canal projetado some do estado; hidratar() continua sem a projecao (so GET /estado e executar())
- [Phase 08]: 08-08: botão Conectar Canal serve de action da Section e do EmptyState; erros 409 por campo vão ao Field, bloqueios.canais vira link ver o Canal
- [Phase 08]: 08-09: a ficha do Canal decide por channel.relational — REST (PATCH e POST sem corpo) para o relacional, configurarCanal para o seed; Simular conexão em produção só para quem administra, sempre marcada (assunção do dono, Open Question 7).
- [Phase 08]: 08-10: a aba do fio abre no Canal da ultima recebida (canalPadraoDeResposta), depois canalDaAbaInicial; sem aba 'Todas' o separador via nao aparece (Open Question 2 sinalizada).
- [Phase 08]: 08-11: disco do Canal na lista mantém fallback CHANNEL_TYPE_LABEL para Conversa órfã; rótulo do Canal sempre via rotuloDoCanal do domínio
- [Phase 08]: 08-12: registrarRecebida grava sempre no Canal da Conversa e e idempotente por (Canal, id externo); a recebida nao tem rota humana e nenhuma resposta carrega carga_bruta
- [Phase 08]: 08-13: o e2e dois WhatsApps lado a lado roda sobre as rotas ja entregues sem mudar producao; nao-vacuidade provada por mutacao restaurada, sem RED fabricado
- [Phase 08]: 08-14: contrato da 008 (A1 slugs, A2 canais_conta_uq por tipo+identificador, A6 colunas extras, A9 carga_bruta fora do HTTP) confirmado pelo dono e aplicado no banco da plataforma; 008 imutavel, ajuste futuro e 009
- [Phase 08]: 08-14: aplicacao da 008 feita pelo agente orquestrador sob autorizacao explicita e unica do dono na sessao (desvio registrado em 08-PROVAS.md)
- [Phase 08]: 08-15: portao nao registrado como verde limpo — colunas-geradas.test.ts (empate de vencimento) falhou uma vez no check completo e passou isolado; aceitar ou corrigir fica com o dono/verificador
- [Phase 08]: 08-15: suites describeComBanco (198 pulados contra o Supabase) re-executadas num Postgres 16 descartavel: 23 arquivos, 319 testes verdes
- [Phase 09]: 09-01: visibilidadePara sempre monta o estado recortado (sem retorno antecipado); a IA pessoal (Sessão de Chat, pasta, Execução de Sessão) sai de GET /estado para todo Papel via membroVeSessaoDeChat — DO-CHT-09/D-01: nem o Proprietário lê Sessão alheia; ids em ocultos recortam também ordens e diferenças
- [Phase 09]: 09-01: testes que semeiam dado em estado.test.ts usam describeComBanco (Postgres local) e a fábrica espaco-de-vazamento.ts; container crm-n1-pg-09NN porta 556NN — F9: o guarda antigo mirava o Supabase do .env
- [Phase 09]: 09-02: recortarValor também caminha em objeto de id desconhecido (não só sem id), para um objeto com Tarefa dentro não abrir o segredo de link
- [Phase 09]: 09-02: a fronteira do Convidado é baseDoPapel === 'convidado' (Papel personalizado de base convidado também recebe as cinco coleções de IA vazias)
- [Phase 09]: 09-03: startConversation não ganhou variante SemConferencia (já recusava Convidado e Membro não ativo); só a Automação envia por sendMessageSemConferencia, fora de OPERACOES
- [Phase 09]: 09-03: restoreList reaproveita memberReachesContainer + containerTrashRefusal em vez de delegar a restoreContainer (que também recusa colisão de nome)
- [Phase 09]: 09-04: administrador dos casos de banco e migrar dos testes ficam presos a pool() (DATABASE_URL local), nunca a poolDeMigracao() — Um DATABASE_URL_MIGRACAO remoto no .env nao pode levar create database nem migrar para fora do Postgres local
- [Phase 09]: 09-04: 009 + banco:conceder; as duas linhas do api.env (DATABASE_URL n1_api e DATABASE_URL_MIGRACAO dono) mudam juntas; RLS desligada (D-05) e adiada pela decisao 12.1 — Pitfall 9 e F7: app em n1_api sem a variavel de migracao trava o deploy; RLS ligada sem policy zera as linhas de n1_api
- [Phase 09]: 09-05: redact do logger lista cada campo secreto no topo e como *.campo (o curinga do pino nao casa o topo)
- [Phase 09]: 09-05: mascararSegredoDeUrl mora no dominio (url-segura.ts); log da api, Sentry e nginx dependem da mesma regra
- [Phase 09]: 09-06: POST por IP a 30/min e GET/HEAD com zona propria a 120/min (burst 60) em /v1/public/ no nginx, porque /f/ e /p/ chegam pelo IP de saida da Vercel
- [Phase 09]: 09-06: segredo de link fora do error_log do nginx via limit_req_log_level info mais error_log crit no location /v1/public/; preparar-vps.sh nao sobrescreve o conf.d da VPS e desfaz o que instalou se nginx -t falhar
- [Phase 09]: 09-07: a resposta de POST /operacoes sai recortada (diferenca e value) depois de executar(), com um unico visibilidadePara, nos dois ramos (executar e SERVICOS via deps.aoTerminar); o suspenso recebe 403 logo depois de ehNomeDeOperacao
- [Phase 09]: 09-08: ia/layout.tsx envolve o NoAccessState em PageHeader+CorpoDeTela (A1); forms-editor sem segredo não renderiza Copiar link (A2); rótulos locais do ator (tarefa-completa, timeline) alinhados a actorLabel do domínio (S4)
- [Phase 09]: 09-09: a coluna Conferência da tabela Quem pode nomeia só quem pode (Papel, estado, alcance, dono); recusas de estado do ativo (recusaExternaNoGrupo, recusaDoCanal…) ficam na Observação
- [Phase 09]: 09-09: lacuna real não vira justificativa — removeMember e spawnNextOccurrence ficam 'sem conferência' com LACUNA e vão como achado à suíte adversarial (09-12/09-15) e à passada 09-21; o domínio não foi tocado
- [Phase 09]: 09-10: AAD do cofre = JSON de [workspaceId, donoTipo, donoId, tipo, versaoDaChave]; mudar depois da Sessão 4 obriga a re-cifrar todas as credenciais. — Amarra cada texto cifrado à sua linha (T-09-48); decisão costly, barata agora porque nenhuma credencial existe.
- [Phase 09]: 09-10: nenhuma rota importa servicos/cofre; só serviços de provedor chamam lerCredencial. Re-cifrar com chave nova fica para depois (COFRE_CHAVE_ANTERIOR lê por versão). — T-09-50 e T-09-51; teste estrutural em cofre.test.ts.
- [Phase 09]: 09-11: AMBIENTE=producao e o padrao dos scripts de deploy; a homologacao (n1crm-hml, /opt/n1-crm-hml, 3021, n1-crm-api-hml) e opt-in e o job de producao do deploy-api continua so para a main — Producao renderiza identica (site byte a byte; servico so ganha comentario) e nenhum chamador precisa mudar
- [Phase 09]: 09-11: concorrencia por job (deploy-api-producao, deploy-api-homologacao), nao por workflow — Um grupo so faria um deploy pendente de homologacao cancelar um pendente de producao
- [Phase 09]: 09-12: o job seguranca roda o app como n1_api e o DDL de teste pelo dono local (poolDoDono); it.todo e proibido na suite do CI porque pendente+todo conta como teste pulado
- [Phase 09]: 09-12: o suspenso nao grava por nenhuma rota REST (recusarSuspensoNaEscrita em Financeiro, anexos e CRM); removeMember e spawnNextOccurrence do Convidado ficam como it.fails ate o dominio ser consertado
- [Phase 09]: 09-14: pg_restore roda dentro do conteiner descartavel (PG_IMAGEM); URL do banco decomposta em PG* para a senha nao aparecer no ps
- [Phase 09]: 09-14: Evolution API fixada em evoapicloud/evolution-api:v2.3.7 (tag existe no registro); dono confirma versao e variaveis em 09-19
- [Phase 09]: 09-13: @sentry/node fixado em 10.76.2 (escolha do dono em 2026-10-23); a web (09-16) instala a mesma versao exata
- [Phase 09]: 09-13: dataCollection todo explicito tambem na 10.76.2 (campo omitido volta a LIGADO); URLs perdem query e segredo; Sentry so recebe o ramo 500
- [Phase 09]: 09-15: text/plain removido do app (415 em vez de 400) e resolvedor de Membro real no teste de cruzamento entre Espacos
- [Phase 09]: 09-15: runLancamentoAgent do Convidado medido como lacuna do dominio (ok:true, publica o Resumo) e marcado it.fails; inviteMember nao exercida (rede)
- [Phase 09]: 09-16: @sentry/nextjs 10.76.2 exato na web (igual a @sentry/node da api); SDK so inicia com DSN; withSentryConfig por @sentry/nextjs/config
- [Phase 09]: 09-16: segredo de /f/ e /p/ mascarado tambem no meio do texto (regra do dominio so ve o comeco); global-error usa py-12 (escala) no lugar de py-10; 'O erro foi registrado.' so e verdade com DSN (UI-SPEC I3)
- [Phase 10]: 10-01: a Atividade 'Visualizações padrão alteradas' compara a definição própria do nó, não a efetiva
- [Phase 10]: 10-01: viewsDefinedAt acrescentado a EffectiveListConfig para a tela dizer 'Herdado de X' (10-08)
- [Phase 10]: 10-20: blocks sai de StructuralContainerBase (so Space e Folder); InheritanceMode sem bloqueado; blockedAbove ignora blocks legado em Lista
- [Phase 10]: 10-02: definesAspect conta só Campo de Tarefa ativo e Tipo não-plataforma; contagemAcumulada exclui Tipos da plataforma; a recusa de setContainerBlock nomeia só o que o ator alcança (B38a) e conta o resto
- [Phase 10]: 10-03: moveContainer grava a Atividade com o caminho do próprio movido, entra no fim do grupo de destino (max(order)+1) e renumera a origem 0..n-1; movido na lixeira é recusado, arquivado não.
- [Phase 10]: 10-04: reorderContainers reordena por fatia (A3, pending): reocupa as vagas dos ids recebidos e deixa os escondidos no lugar; Espacos exigem Administrador/Proprietario; 'editar no pai' e mayBuild (A4, pending)
- [Phase 10]: 10-04: o pedido de reordenar deve conter so ids que o Membro alcanca; a operacao recusa o lote inteiro com 'nao encontrado' se um id e inalcancavel (a arvore de 10-12 filtra)
- [Phase 10]: 10-18: moveContainer mede a colisao de nome de Campo/Tipo com o movido ja no caminho novo (nao no escopo inteiro do destino); estruturas fixas ficam em estruturas-fixas.ts por causa de ciclo de carga (A5, Q2, Q4, Q5 pending na UAT 10-17)
- [Phase 10]: 10-05: ator do relógio escolhido por Lista dentro do executar() (atorDoRelogio); o Agente do pipeline não ganha administrar (T-10-14). Autoria humana da Atividade é assunção Q1/A1 a confirmar no checkpoint D-04 do 10-16.
- [Phase 10]: 10-05: Lista só com recorrência por calendário nasce direta (regimeDaPrimeiraVolta, D-02); com Automação por vencimento mantém o ensaio. parar() interrompe a drenagem entre linhas; worker ganhou escolherAtor/escolherRegime como pontos de extensão de teste.
- [Phase 10]: 10-06: botão de seleção em lote desligado por criacaoRecusada nas três lentes (só fora da seleção); precedência das lentes da barra financeira > espelhoComercial > conversacional > comum.
- [Phase 10]: 10-06: página da Lista em 923 linhas; diálogos e detalhes do cabeçalho extraídos (dialogos-da-lista.tsx, detalhes-da-lista.tsx) para dar folga a 2.5.4/2.6.2.
- [Phase 10]: 10-08: a frase de bloqueio por ancestral mora so na linha de origem (CabecalhoDoAspecto); FeaturesEditor mostra apenas a nota de permissao
- [Phase 10]: 10-08: ?aba=visualizacoes cai em geral ate 10-10 trazer o editor; Abas ganha idBase e teclado (A13) sem mudar o visual
- [Phase 10]: 10-14: texto visivel da Estrutura nao mostra codigo de regra; so o codigo e o espaco saem, dois-pontos fica colado na palavra anterior; comentarios com codigo ficam e o teste de varredura os descarta
- [Phase 10]: 10-07: abaDaView total (string | undefined) — Visualizacao salva carga abre na aba Lista ate a 010 converte-la; VIEW_KIND sem carga recusa saveView (400)
- [Phase 10]: 10-09: Espaco arquivado e vazio mostra o EmptyState sem 'Nova Lista'; itens de Lista/Pasta repetem o markup da Pasta (extracao prematura).
- [Phase 10]: 10-10: a aba mostrada na Lista e derivada na renderizacao (sem setState em efeito); padrao salva de tipo escondido nao abre nem aplica filtros; a contagem de salvas guardadas e feita na copia do run() e so conta Listas que deixaram de oferecer o tipo

### Pending Todos

Nenhum em `.planning/todos/` ainda. Decisões com prazo (ver ROADMAP.md "Decisões a tomar antes de cada fase"):

- OQ-ADR-01 região do Supabase — decidir até o fim da Phase 1 (barata agora, cara depois)
- D11 onde o `apps/api` roda — antes do adapter da Phase 2
- D6, D8, D9, OQ-PLAN-01, OQ-PF-01, OQ-SYN-02 — antes de planejar a Phase 2

### Blockers/Concerns

- **SEC-01 (Phase 05, `05-SECURITY.md`, aceito pelo dono em 2026-09-25 com condição):** nenhuma fase ou mudança pode liberar a fonte "plataforma" para `marcos-paulo`/`family-office` sem executar ANTES o corte 05-05 (Tasks 2/3, ordem D-28: desligar webhooks ClickUp → 48h de silêncio → conferir gêmeas → arquivar 901109642259/901111928443). Sem isso, T-5-15 (double-write no Omie, HIGH) volta a ser possível. **SEC-02:** nenhuma Automação de Canal real é publicada em `ws_n1` antes do 05-23 (migração de receipts sozinha no Supabase do `automation/`, depois o deploy).
- **Antes de ligar qualquer worker de scheduler em produção:** remover ou excluir do catálogo os ~14 Espaços de teste com Automações temporais ativas no Postgres de produção (WR-A, 05-25).
- **Agentes não conseguem escrever em produção:** o classificador de permissão do Claude Code recusa `--apply`/`migrar` contra o banco real (05-19/05-20/05-21) — o dono roda o comando e cola a saída; o agente faz o dry-run antes e a confirmação somente-leitura depois.
- **Portão `npm run check` vermelho por duas falhas fora do CRM (aceito pelo dono em 2026-10-11, override em `07-VERIFICATION.md`):** `apps/api/src/e2e/lote-contas-a-pagar.test.ts` (5/6 contra o banco remoto, desde a Fase 4) e o seed da suíte "Automação de Canal publicada na Lista de Solicitações" em `apps/api/src/rotas/formularios-publicos.test.ts`. Quem revisitar DEC-06 ou o bootstrap da Lista de Solicitações (`solicitacoes:configurar`) deve fechá-las; detalhe em `07-.../deferred-items.md`.
- **CRM em dois modelos (D-15, Phase 07):** Busca global, Lixeira, Notificações, `/crm/meus-negocios` e Caixa de Entrada ainda leem o modelo antigo em inglês e não mostram os registros das rotas `/contatos`, `/empresas`, `/funis`, `/negocios`; limitação aceita até a fase de unificação.

- **ROADMAP.md agora mostra "Phase 3: Contas a pagar" como `[x]` Complete (15/15, 2026-09-23)** — isso é `roadmap update-plan-progress` contando EXISTÊNCIA de SUMMARY.md por plano, não fechamento verificado. Sete dos quinze planos da fase (03-07, 03-08, 03-10, 03-11, 03-13, 03-14, 03-15) têm, dentro do próprio SUMMARY, um checkpoint bloqueante de produção ainda ABERTO — e o critério 1 da própria fase (uma semana sem ClickUp + o corte) é exatamente o que 03-14 Task 4 não executou. Uma rodada de `/gsd-verify-phase 3` deve pegar isso e não assinar a fase como pronta para a Phase 4 só porque a tabela diz "Complete". Não revertido aqui de propósito — é o comportamento padrão da ferramenta, e mascarar isso escondendo o "Complete" seria pior do que registrar a ressalva.
- PERS-08 bloqueado por D11 (deploy do `apps/api`); não trava o código da Phase 1.
- SOL-01 (D6), SOL-08 (D8) e REC-01 (D7) bloqueados por decisão aberta.
- `rejectUnauthorized: false` em `apps/api/src/persistencia/conexao.ts` — fixar a CA do Supabase antes de o `apps/api` ir para a VPS.
- Sem teste ponta a ponta tela → Postgres nem de sessão → Membro (CONCERNS.md) — fechar na Phase 1.
- Plan 00-06 (PREP-03): 5 decisoes abertas em docs/07-processos/solicitacao-de-pagamento.md §12 (L-01, L-03, L-07, L-09, L-11) que so o dono/Financeiro pode responder antes/durante o planejamento da Fase 2 -- nao bloqueiam PREP-03 em si (spec ja fecha D6/D8), mas devem ser revisitadas ao planejar SOL-01..09.
- Credenciais Omie no histórico do git do financeiro-tria e por linha em `solicitacoes_pagamentos`/`transacoes` — risco aceito pelo dono (D-13, 2026-09-16); nunca copiar na importação.
- PREP-04 fechado (Plan 00-07), mas o revisor FO (ClickUp id 81581802) segue sem e-mail real em de-para-usuarios.ts — dono precisa informar o e-mail corporativo ou confirmar acesso ao Team Family Office/Marcos Paulo (9011658148) para nova tentativa de usuarios.cli.ts antes de a Fase 2/3 convidar esta entrada.
- Plan 03-07 (rota de calculo/lancamento de Conta a pagar no Omie): Tasks 1-3 completas e commitadas em ../financeiro-tria (372a64f, 20f38a0, a0ae13c) + a06803d em crm-n1 (contrato escrito). Task 4 (checkpoint bloqueante) parada: falta gerar PLATAFORMA_LANCAMENTO_TOKEN e escreve-lo nos .env de producao do automation/ e do apps/api (D-15), confirmar se OMIE_TRIA_APP_KEY/OMIE_TRIA_APP_SECRET existem em producao, e chamar /resolver de verdade contra uma Tarefa real -- nenhuma dessas acoes e alcancavel sem acesso a VPS/producao. Ver 03-07-SUMMARY.md.
- Plan 03-08 (scheduler de Automacoes): codigo, testes (19/19 contra Postgres real) e wiring em index.ts completos e commitados. A prova end-to-end contra producao (ws_n1) fica pendente: nao existe ainda nenhum Membro com roleId rol_sp_agente_pipeline em nenhum Espaco de producao, entao grantGovernanceAccess real e um ciclo ao vivo do worker nao foram executados (decisao deliberada de nao escalar producao sem essa identidade -- ver 03-08-SUMMARY.md Known Gaps). Falta: (1) convidar/confirmar o Membro Agente do pipeline em ws_n1, (2) grantGovernanceAccess administrar sobre lst_contas_a_pagar/lst_contas_a_receber, (3) subir apps/api com AUTOMACOES_WORKER_ATIVO=true e decidir quando liberar a primeira volta em ensaio. Nao bloqueia 03-09/03-10/03-11 (o worker funciona; falta so a identidade de producao).
- Plan 03-10 (importacao real de Contas a pagar): Tasks 1-3 completas e commitadas (classificador provado contra as 2861 Tarefas reais, orquestracao por lotes com ledger transacional, MARCO_ZERO). Task 4 (checkpoint bloqueante) parada aguardando o operador rodar 'npm run contas-a-pagar:importar -w @n1/api -- --apply' contra ws_n1 de producao, ler o relatorio de lacunas (em particular vencimento_l_diverge_do_nativo, decisao do Financeiro) antes de gravar, confirmar a prova de no-op na segunda execucao, e liberar a agenda com automacoes:liberar. Nenhuma dessas acoes e alcancavel sem DATABASE_URL de producao e o export em disco -- ver 03-10-SUMMARY.md.
- Plan 03-11 (ponte HTTP do Agente de lancamento): Tasks 1-2 completas e commitadas (7d19af0, a385fec) -- OpcoesDaAgenda no dominio, invocar-agente.ts com os 15 casos de teste, 47 testes novos verdes. Task 3 (index.ts/.env.example/CONTEXT.md) codigo completo e commitado (f506788), verificado por boot local real (Postgres real, automation/ substituido por servidor HTTP local -- log confirma modo=ensaio, POST real a /resolver, ZERO a /lancar). O checkpoint bloqueante da Task 3 (ligar contra o automation/ real na VPS e o Postgres de producao ws_n1, com o PLATAFORMA_LANCAMENTO_TOKEN que 03-07 escreveu no .env de producao) fica parado -- nenhuma dessas acoes e alcancavel sem acesso a VPS/producao. Mesma familia de pendencia que 03-07 (Task 4, mesma credencial) e parcialmente 03-08 (identidade de producao). Ver 03-11-SUMMARY.md.
- Plan 03-12 (fechamento em lote de Contas a pagar): Tasks 1-3 completas e commitadas (bee84a5, 14325a2, b6783b5, e93309d) -- alterarStatusEmLote registrada, testada em memoria (11 casos) e contra o Postgres real da plataforma (e2e, 6 casos, ws_lote_teste). Task 4 (medir DEC-06 contra ws_n1 com o volume real de 03-10) auto-aprovada com achado registrado, nao com a medida definitiva: importacao_ledger para clickup:901107637383 = 0, ou seja a Task 4 de 03-10 (--apply contra ws_n1) ainda nao rodou -- mesma pendencia ja rastreada, nao um blocker novo. A medida contra ws_lote_teste (isolado) deu tLote 45x-49x mais rapido que tN, com folga larga nas duas aspercoes do e2e; quando o operador rodar a importacao real de 03-10, repetir 'npm run test -w @n1/api -- lote-contas-a-pagar' com DATABASE_URL de producao e colar a nova linha [lote] no lugar desta. ws_n1 confirmado intocado (revisao=3 antes/depois). Ver 03-12-SUMMARY.md.
- Plan 03-15 (Compartilhadas comigo + busca/tarefas filtradas por visibilidade): Tasks 1-2 completas e commitadas (96efff0, 2d1636e, f84bc07, a5b0317) -- compartilhadas-comigo.tsx re-keyed em memberSeesTask, buscar/page.tsx e estrutura/tarefas/page.tsx filtrados, 16 testes novos verdes. Task 3 (checkpoint bloqueante de producao: login real como Pedro/Lucas/Rafael/Maryane contra apps/api + apps/web no ar e o Supabase da plataforma) PARADA -- sem VPS, sem credenciais de Auth reais, apps/api/.env bloqueado pelo sandbox de permissoes desta sessao. Mesma familia de pendencia que 03-07 (Task 4)/03-08 (identidade de producao)/03-10 (Task 4)/03-11 (Task 3). Ver 03-15-SUMMARY.md.
- Plan 03-13 (o gesto de lote vira uma chamada + gatilho de D3-08): Tasks 1-3 completas e commitadas (c33a37f, 9814117, 58ea740) -- BulkStatusBar chama alterarStatusEmLote (03-12) uma vez, RelatorioDeLotePainel renderiza os quatro resultados (parcial em bloco proprio, T-3-55 estrutural), painel-aprovacao.tsx ganha o botao "Converter em Conta a pagar" (D3-08). 12+5 testes novos verdes (140 no total em @n1/web); npm run typecheck/lint/verificar:tokens verdes nos tres workspaces. Task 4 (checkpoint bloqueante: lote de 61 contra o banco real, login como mem_maryane/mem_marcos_paulo/mem_walter, aba de rede, conversao de Solicitacao real) PARADA -- mesma familia de pendencia que 03-07/03-08/03-10/03-11/03-15 (sem VPS, sem browser, sem credenciais reais, apps/api/.env bloqueado pelo sandbox desta sessao). Achado carregado do proprio plano (nao corrigido aqui, ja registrado em 03-05/03-15): a Pessoa da conta enxerga a Tarefa pelo dominio mas [lista]/page.tsx fecha a Lista para quem nao passa em memberReachesContainer -- e PAG-06, nao PAG-05. Ver 03-13-SUMMARY.md.
- Plan 03-14 (a conferencia do Ensaio, o relatorio e o runbook do corte -- fecha a fase): Tasks 1-3 completas e commitadas (afbba99 de sessao anterior, 6bec6c4, d6b0946) -- compararEnsaio/PREFIXO_LANCAMENTO_HUMANO/LIMIAR_DA_CANETA no dominio; DialogoLancamentoNoOmie captura o lancamento humano em texto livre (T-3-67, sem mostrar a resposta do Agente); npm run ensaio:relatorio -w @n1/api (coberturaDaJanela/agregar/renderizar) computa os sete portoes G1-G7 e foi RODADO DE VERDADE contra ws_n1 de producao (janela 2026-09-01/23): saiu INCONCLUSIVO (exit 2) porque plataforma.automacao_agenda nao tem nenhuma linha ainda -- prova de que o relatorio nao inventa taxa sobre dado que nao existe (o artefato dessa corrida foi descartado antes do commit, precedente de 03-10). 10 testes novos em @n1/api (9 puros + 1 contra Postgres real), 4 em @n1/web; dominio 480, web 144; npm run typecheck/lint/verificar:tokens verdes nos tres workspaces. Task 4 (o runbook do corte, docs/08-migracao-financeiro/06-runbook-de-corte.md, 1167a83) tem o DOCUMENTO escrito com os onze passos, dono e condicao verificavel -- mas NAO EXECUTADO: exige a importacao historica real (03-10 Task 4), a ponte HTTP do Agente ligada em producao (03-11 Task 3, mesmo PLATAFORMA_LANCAMENTO_TOKEN de 03-07 Task 4), uma semana de calendario inteira de operacao real do Financeiro, e o arquivamento IRREVERSIVEL da Lista 901107637383 -- nenhuma dessas quatro condicoes e alcancavel neste ambiente, e a ultima nunca deveria ser executada autonomamente de qualquer forma. Deliberadamente NAO executado nem o passo 3 do runbook (inventario read-only de Grants gr_cp_pessoa_*), porque so faz sentido depois do passo 2 (importacao real), que tambem nao rodou -- executar um passo isolado de 11 sequenciais produziria um estado parcial sem decisao nenhuma tomada. Ver 03-14-SUMMARY.md.

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Decisão | D12 — mover o `automation/` para o monorepo | Reavaliar ao fim da Phase 2 (DEC-15) | Plano §7 |
| Requisito | PERS-03 — uma tabela por entidade | Sobreposto por DEC-02; parte viva é PERS-07 | Ingest 2026-09-15 |
| Escopo | Cache local/offline; troca de Espaço na sessão; recorte de hidratação por Lista | Depois da Phase 5, se doer | CONCERNS.md |
| Escopo | Go High Level | Inventário próprio, fora deste plano | 00-LEIA-PRIMEIRO |
| Deploy | `automation/` na VPS (49 commits, `PLATAFORMA_*` no `.env`, `package*.json` sujo) | Adiado pelo dono — checklist em 05-23-SUMMARY.md | Phase 05 (2026-09-25) |
| Dados | Índice único `(origem, "TaskID")` — 180 TaskID duplicados sem destino | Decisão do dono | Phase 05 (2026-09-25) |
| Corte | MP/FO: 10 webhooks ClickUp + 2 Listas (D5-20) | Sem fase no ROADMAP | Phase 05 (2026-09-25) |
| Infra | Backend do CRM N1 na VPS (`/opt/n1/crm-n1`, porta 3102) e reorganização das pastas N1 | Dono pediu para depois | Phase 05 (2026-09-25) |
| Verificação | RES-03 — passo 2B em modo `lancar`, verificação humana (`06-VERIFICATION.md`) | Código e testes completos; falta o dono rodar | Phase 06 (2026-09-30) |
| Deploy | `automation/` com contrato v1.2 + `PLATAFORMA_MEMBRO_POR_CLICKUP_ID`; S5/S6 ao vivo e `integra-frontend-main` (local, sem push) dependem disso | Adiado pelo dono, mesma família do deploy da Phase 05 | Phase 06 (2026-09-30) |
| Prova | fin2:IN-07 — dois anexos no mesmo lançamento contra o Omie real | Script `teste:omie-real` só aceita um `--anexo`; opcional | Phase 06 (2026-09-30) |
| Dados | Residual fin2:CR-01 (índice/migração de banco) | Aceito sem migração; decisão do dono se quiser fechar | Phase 06 (2026-09-30) |
| Defeito | A conta nova abre no popup com o id da cópia local de `run()` (D-05), não o do servidor — diverge quando a ponte ou outra pessoa grava no meio; achado pela jornada final (`06-PROVAS.md`, achado 1: `cmt_tark9u`) | Correção proposta (abrir só com o id confirmado pelo servidor), aguarda o dono | Phase 06 (2026-09-30) |
| Comportamento | O ajuste por texto livre não muda a categoria do Resumo revisado (o RAG do `/resolver` busca com o Campo "Categoria de pagamento" e o pedido só no fim) e o revisado sai igual, marcado "Revisado a pedido de"; só o código na resposta troca com certeza (`06-PROVAS.md`, achado 4) | Decisão do dono: avisar no revisado quando nada mudou e/ou dar peso ao pedido | Phase 06 (2026-09-30) |
| UX | O popup da conta não vê sozinho o que a ponte grava (sem tempo real, consulta periódica nem revalidação ao focar; só re-hidrata por D-06) | Recomendação: consulta leve à revisão do Espaço com a conta aberta; Realtime depois | Phase 06 (2026-09-30) |
| Teste | `lote-contas-a-pagar.test.ts` 5/6 contra o banco remoto (PAG-05, DEC-06) — fora do CRM | Aceito como ressalva da Fase 7; fecha com quem revisitar DEC-06 com volume real | Phase 07 (2026-10-11) |
| Teste | Seed da suíte "Automação de Canal publicada na Lista de Solicitações" (`formularios-publicos.test.ts`) aponta Campo que a Lista não tem | Aceito como ressalva da Fase 7; precisa de quem conheça `solicitacoes:configurar` | Phase 07 (2026-10-11) |
| Escopo | CRM: tags, consentimentos, comentários, anexos, mesclagem, temperatura e histórico de etapas (D-02); Busca global/Lixeira/Notificações no modelo antigo (D-15) | Fase própria de unificação, com migração `008+` | Phase 07 (2026-10-11) |

## Session Continuity

Last session: 2026-10-29T10:20:32.548Z
Stopped at: Completed 10-10-PLAN.md
Resume file: None
