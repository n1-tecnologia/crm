# Plataforma N1 Digital

## What This Is

O CRM N1 (`apps/web` + `@n1/dominio`) é a plataforma da Tria que passa a ser o **front único do Financeiro**: substitui o ClickUp (formulário, conversa, decisão do aprovador, progresso) e o painel atual do financeiro-tria (`financeiro-tria.vercel.app`). O backend do financeiro-tria (`automation/` na VPS, schema `public`) fica exatamente como está e passa a conversar com o `apps/api` por HTTP, pelos mesmos 7 métodos do adapter que hoje falam com o ClickUp. Quem usa: o Financeiro da Tria, os aprovadores (Elifas, Fabíola, Thiago, Iallas), as Pessoas das contas, o Agente de lançamento e, na última fase, os tenants Marcos Paulo e Family Office.

## Core Value

Um solicitante cria o pedido no CRM N1 e o Financeiro opera Contas a pagar de ponta a ponta (solicitação, aprovação, lançamento no Omie, pagamento, recorrência) **sem abrir o ClickUp** — com os dados no Postgres próprio da plataforma e as regras de `@n1/dominio` (214 testes) intactas.

## Requirements

### Validated

<!-- Entregue, verificado contra o código, commitado na branch reestrutura-monorepo-e-plano-financeiro. -->

- ✓ Persistência do `DataState` por Espaço de Trabalho (hidratar → operação pura sem alteração → diff canônico → revisão otimista), provada contra Postgres 17 local e contra o Supabase real — Fase 1 (`9fb2754`, `3fd7e1b`, `b20597d`)
- ✓ Autenticação Supabase (e-mail e senha) em `/entrar`; Membro resolvido pelo Usuário (`Member.userId`), nunca escolhido; `/sair`; "Sem acesso" para Membro removido ou pendente; `StoreProvider` por árvore (bug de singleton no SSR corrigido) — Fase 1 (`d713253`)
- ✓ Schema `plataforma` (`registros` + `workspaces` + `migracoes`) no projeto Supabase próprio `epomplsskqpluxuujpxl`, aplicado por `npm run migrar` com migrações numeradas e imutáveis — Fase 0 (`b20597d`)
- ✓ Volume do banco legado medido: maior tabela 9.510 linhas, `solicitacoes_pagamentos` 1.110 — risco "volume desconhecido" fechado — Fase 0 (2026-09-15)
- ✓ Contas a receber na plataforma (Critério 1 verdadeiro em produção); Marcos Paulo e Family Office como Empresas do Campo `Empresa`, recusados visivelmente pelo `automation/` até a fonte "plataforma" chegar aos serviços deles; Ação de notificar por Canal code-complete com contrato ponta a ponta verde — Fase 5 (2026-09-25, com lacunas aceitas: deploy do `automation/` adiado, corte MP/FO e 1º WhatsApp real pendentes — `05-VERIFICATION.md` § Acknowledged Gaps)

### Active

<!-- Escopo atual. Detalhe por requisito em REQUIREMENTS.md; ordem em ROADMAP.md. -->

- [ ] Fase 0 (restante): spec da Solicitação de pagamento lida da Lista real — **o maior risco do plano**; exportação completa das três Listas do ClickUp; de-para dos usuários ClickUp → Membros; rotação das credenciais Omie expostas
- [ ] Fase 1 (restante): uma rota HTTP por operação do domínio (`POST /operacoes/:nome`); `store.ts` hidratando do backend em vez do seed; bootstrap do Espaço "Gestão" › "Financeiro" sem Tarefas fictícias; colunas geradas e índices em `plataforma.registros`; onde o `apps/api` roda (D11); reconvite por Usuário
- [ ] Fase 2: toda solicitação nova nasce no CRM N1 (formulário, tela de aprovação por clique, timeline); `automation/` fala com o `apps/api` pelo `adapters/plataforma.ts`; pipeline entra por `POST /webhooks/plataforma/solicitacao-criada`; 1.110 solicitações históricas importadas
- [ ] Fase 3: Contas a pagar importadas com histórico; A1–A9 rodando no motor de Automações; Agente lançando no Omie de verdade; de-para de categorias real; pagamento em lote; permissão da Pessoa da conta
- [ ] Fase 4: as outras leituras do financeiro-tria (Notas fiscais, Produtos, Plano de contas, Extratos, Workflows, Dashboard, Problemas, Aprovações pendentes) portadas como tela no CRM N1 — o painel sai do ar
- [ ] Transversal: **motor de Automações** (gatilho por evento e por agenda; ações `invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar`) — peça G, risco alto, a única ainda não iniciada; o Financeiro (Fase 3) é o primeiro cliente, Contas a receber (Fase 5) o segundo

### Out of Scope

<!-- Limites explícitos, com o porquê, para ninguém reabrir sem querer. -->

- Reescrever o `automation/` dentro do `apps/api` — a v1 do plano fazia isso; DEC-11 descartou: mesmo código, mesmo banco, mesmas variáveis, mesmo deploy.
- `automation/` escrevendo por SQL direto no schema `plataforma` — DEC-14: pularia Registro de Atividade, Requisito de saída e permissão, corrompendo RN-CP-02, RN-CP-04 e INV-CP-01.
- Mover o `automation/` para o monorepo agora — DEC-15 (D12): reavaliar ao fim da Fase 2, quando o contrato estiver estável.
- Portar as 23 telas Vite/React do financeiro-tria como código — DEC-12: elas morrem; o que se porta é **a leitura** que cada uma dá ao Financeiro (Fase 4).
- Uma tabela por entidade no schema `plataforma` — sobreposto por DEC-02 (tabela genérica `plataforma.registros` + colunas geradas para o que se filtra).
- Migrar a observabilidade legada (`automation_runs/steps/events`, `approval_tasks`, `integration_jobs`), `payment_requests` (0 linhas) e as 13 tabelas vetoriais por empresa + 7 views — CAND-03 (a confirmar): nunca pegaram ou a `conciliador_contas` unificada as substitui.
- Emissão de NF, ingestão Guru/Kiwify/TMB, extratos por WhatsApp, sync semanal de clientes Omie como lógica na plataforma — continuam no `automation/` (DEC-11); a plataforma só lê (Fase 4).
- Go High Level — zero menções nos dois repositórios; pertence ao CRM, não ao Financeiro; precisa de inventário próprio feito da conta (OQ-GHL-01).
- Cache local/offline no frontend; troca de Espaço de Trabalho sem sair da sessão — não estão no plano (ver `.planning/codebase/CONCERNS.md`); depois da Fase 5, se doer.
- Cerimônias, cronogramas, matriz de riscos — uma pessoa e o Claude; as estimativas do plano (11–14 semanas) são referência de tamanho, não compromisso.

## Context

- **Monorepo npm workspaces**: `apps/web` (Next.js 16 App Router + Turbopack, React 19, Tailwind 4, Zustand 5, Zod 4), `apps/api` (persistência e autenticação prontas; transporte HTTP **não escolhido** — `apps/api/src/rotas/` nasce vazia, `index.ts` exporta `{}`), `packages/dominio` (puro, só zod; 16 módulos de operações; `derive.ts`; 214 testes). Node 26.5. PostgreSQL 17 no Supabase próprio `epomplsskqpluxuujpxl` (região `us-west-2` — OQ-ADR-01). Detalhe em `.planning/codebase/STACK.md` e `ARCHITECTURE.md`.
- **Estado na branch** `reestrutura-monorepo-e-plano-financeiro`: último commit de código `d713253`; `345682c` mapeou o código. Fase 0 e Fase 1 foram trabalhadas em paralelo; o que resta da Fase 1 é mecânico (CON-14: risco baixo) e destrava tudo; o que resta da Fase 0 não bloqueia a Fase 1, mas **bloqueia a Fase 2**.
- **O CRM N1 está mais adiantado do que parece — mas em memória**: `seed-financeiro.ts` (677 l.) + `seed-contas-a-receber.ts` (359 l.) com Espaço/Pasta/Listas, Tipo "Conta", Conjuntos de Status, Campos, Tags, Papéis, Agente, Automações A1–A9 e R1–R7 como dados da ontologia, Regra de Recorrência; `operations/financeiro.ts` (469 l.) com `runLancamentoAgent` (Omie simulado), `buildResumoDePagamento`, `createReceivableSeries`; `contas-view.tsx` (1.038 l.) com indicadores, grupos e ações em lote. `store.ts` ainda cria `data: buildProductSeed()` e roda a operação localmente.
- **financeiro-tria** (repositório separado): Express 4 + Mastra, Node 20, VPS com PM2 + nginx na porta 4100, três tenants clones (tria, marcos-paulo, family-office), Supabase `qewznpnmaqhqfyhncdnx` (26 tabelas + 7 views + 33 RPCs). Sem autenticação (`anon_read`). Pipeline de Solicitação em 7 etapas, 80% leitura/escrita de Tarefa, comentário e status. Acoplamento com o ClickUp = 7 métodos em 132 linhas (`adapters/clickup.ts`). Cron interno sem fila nem retry persistente — antipadrão a não repetir no motor de Automações.
- **Dois processos, não um**: a Solicitação de pagamento (Lista `901109104938`, automatizada pelo financeiro-tria, **sem spec escrita**) e a Conta a pagar (Lista `901107637383`, modelada na plataforma, spec em `docs/07-processos/contas-a-pagar.md`). Encontram-se no `📋 RESUMO DE PAGAMENTO` — que hoje é reparseado por regex e na plataforma vira **saída**, não entrada.
- **Fontes**: `docs/08-migracao-financeiro/` (00-LEIA-PRIMEIRO, 01-inventario, 02-comparativo, 03-plano, 04-spike-persistencia = ADR), `docs/07-processos/` (contas-a-pagar, contas-a-receber), `docs/PENDENCIAS-FRONTEND.md`. Intel sintetizada em `.planning/intel/*.md`; conflitos em `.planning/INGEST-CONFLICTS.md` (0 blockers; 1 warning aprovado pelo usuário; 12 info).
- **Riscos já conhecidos no código**: `rejectUnauthorized: false` na conexão com o Supabase (`conexao.ts`); credenciais Omie por linha em `solicitacoes_pagamentos` e `transacoes` e hardcoded no histórico do git do financeiro-tria; 89 arquivos sem commit no financeiro-tria (regeneração shadcn/Lovable); `automation/.env` com credenciais reais no diretório; sem testes de permissão por borda, sem testes de rotas públicas, sem teste ponta a ponta tela → Postgres.
- **Latência medida**: hidratar 906 registros (475 KB) = 18 ms local, ~82 ms de trabalho real no Supabase; ~234 ms por ida e volta de um notebook no Brasil a Oregon — o `apps/api` não vai rodar num notebook (D11 e OQ-ADR-01 andam juntas).

## Constraints

- **Verificação (CON-05, DEC-09)**: `npm run check` verde nos três workspaces, sempre; os testes do domínio são os mesmos antes e depois do banco; os testes de persistência pulam sem `DATABASE_URL`; a prova de que os 214 valem contra o banco é hidratado ≡ seed. O `automation/` roda com o mesmo `git log` da Fase 0, fora o adapter.
- **Contrato entre os dois sistemas (CON-01, CON-02, CON-03, CON-13)**: os 7 métodos do adapter por HTTP contra o `apps/api`; `POST /operacoes/:nome`, uma rota por operação, nenhuma regra de negócio na rota; `POST /webhooks/plataforma/solicitacao-criada` disparado pelo `apps/api` quando a Tarefa nasce; tipos compartilhados não podem derivar (pacote compartilhado ou revisão a cada mudança).
- **Degradação (CON-06)**: `apps/api` fora do ar não derruba o pipeline — o adapter enfileira e repete, como hoje degrada sem token.
- **Idempotência no Omie (CON-07)**: `codigo_lancamento_integracao` determinístico e igual nos dois caminhos; `ConsultarContaPagar` antes de incluir.
- **Importação (CON-09, CON-CP-12, CON-CR-10, CON-08)**: paginação; `date_created`, `date_closed` e histórico de status viram Registros de Atividade com a data original; Data de pagamento sobre `date_closed`; `TaskID` + `origem`; credenciais **nunca** copiadas.
- **Segurança e LGPD (CON-10, CON-CP-09, CON-CR-08)**: credencial Omie só na Integração, nunca por linha; a Pessoa da conta vê só as Tarefas em que é o campo Pessoa; demais Membros sem acesso à Lista; Cliente sem acesso; sem `anon_read` no que a plataforma serve.
- **Schema `public` do financeiro (DEC-17)**: a única alteração admitida é `TaskID` apontar para a Tarefa da plataforma + coluna `origem` (`clickup` | `plataforma`). Os dois schemas vivem em projetos Supabase distintos: nenhuma leitura cruzada por JOIN, tudo por HTTP (OQ-SYN-03).
- **Backend (`apps/api/src/index.ts`)**: nada reimplementa regra de negócio; a rota hidrata, roda a operação do domínio na Unidade de Trabalho, grava o diff; toda consulta filtra por `workspace_id`.
- **Frontend (CAND-07, confirmado pelo ADR)**: `app/` não calcula — lê `derive.ts`, escreve por `operations/`, formata por `format.ts`; `OperationResult` é valor, nunca exceção pela fronteira; `readonly` é invariante; nada derivado é armazenado; toda mutação chama `recordActivity`; a API do store (`useData`, `useSession`, `useRun`) não muda quando o backend entra. Next.js 16 difere do conhecido: ler `node_modules/next/dist/docs/` antes de codar.
- **Processos (CON-CP-01..12, CON-CR-01..10)**: Status, Campos, Tags, Automações, Papéis, regras RN-* e invariantes INV-* dos SPECs valem para a versão persistida; o formato do RESUMO (CON-CP-08) é contrato entre os dois sistemas.
- **Escala aceita (DEC-06)**: escritas serializadas por Espaço de Trabalho; medir no fechamento em lote de 61 contas (CON-CP-11); o caminho de escala previsto é recorte por Lista, sem mudar o formato do `DataState`.
- **Idioma**: identificadores em inglês; strings visíveis, documentos e mensagens de erro em pt-BR.

## Key Decisions

<decisions>
### Travadas por ADR — `docs/08-migracao-financeiro/04-spike-persistencia.md` (locked, precedence 0)

- **D-DEC-01:** Hidratar o `DataState` inteiro por Espaço de Trabalho, rodar a operação pura **sem alterá-la**, gravar só o diff — assim `packages/dominio` e os 214 testes sobrevivem intactos. Validado contra Postgres local e Supabase.
- **D-DEC-02:** Tabela genérica `plataforma.registros` (um registro por entidade, `dados jsonb`, PK `(workspace_id, colecao, id)`, índice por `ordem`) + `plataforma.workspaces (workspace_id, revisao)`; colunas geradas só para o que se filtra, Tarefa primeiro. Sobrepõe "uma tabela por entidade" do plano.
- **D-DEC-03:** Diff por comparação canônica de JSON (chaves ordenadas, recursiva); `undefined` e ausente viram a mesma forma.
- **D-DEC-04:** Posição fracionária (`ordem double precision`) com relabeling mínimo; renumera a partir do ponto quando a fração não cabe mais.
- **D-DEC-05:** Hidratação em uma consulta só, revisão do Espaço por `LEFT JOIN` em cada linha (11.413 → 316 ms).
- **D-DEC-06:** Revisão otimista por Espaço de Trabalho (não por registro), 3 tentativas; escritas serializadas por Espaço; escala futura por recorte de Lista.
- **D-DEC-07:** Registro explícito de coleções em `packages/dominio/src/colecoes.ts` (`Record<ChaveDeColecao, true>` — coleção nova sem entrada não compila).
- **D-DEC-08:** O banco da plataforma é um projeto Supabase **próprio** (`epomplsskqpluxuujpxl`), separado do financeiro (`qewznpnmaqhqfyhncdnx`). Sobrepõe "mesmo Supabase" do plano; consequência: nada de JOIN entre `plataforma` e `public`.
- **D-DEC-09:** Testes de persistência pulam sem `DATABASE_URL`; a prova de que os 214 testes valem contra o banco é a equivalência hidratado ≡ seed, não a re-execução contra o banco.
- **D-DEC-10:** Migrações SQL numeradas em `apps/api/migracoes/NNN-*.sql`, aplicadas uma vez por `npm run migrar`, registradas em `plataforma.migracoes`, imutáveis depois de aplicadas.

### Travadas pelo dono do projeto — SPEC `03-plano-de-migracao.md` §2 (por instrução do orquestrador; um ADR futuro que as contradiga é BLOCKER, não sobreposição automática)

- **D-DEC-11:** O backend do financeiro-tria continua exatamente como está — mesmo código, mesmo banco, mesmas variáveis de ambiente, mesmo deploy. No `automation/` mudam três pontos: nasce `adapters/plataforma.ts`, `clickup-payment-mapper.ts` encolhe para `plataforma-payment-mapper.ts`, nasce `POST /webhooks/plataforma/solicitacao-criada`.
- **D-DEC-12:** O CRM N1 (`apps/web` + `@n1/dominio`) é o front único: substitui o ClickUp **e** o painel do financeiro-tria; as 23 telas Vite/React morrem; `financeiro-tria.vercel.app` sai do ar ao fim da Fase 4.
- **D-DEC-13:** `apps/api` é o backend do CRM e dono do schema `plataforma` (a ontologia); `automation/` é dono do schema `public` (Solicitações, RAG, espelhos do Omie, emissão de NF). Com D-DEC-08: em projetos Supabase distintos.
- **D-DEC-14:** `automation/` fala com o `apps/api` por HTTP, pelos mesmos 7 métodos do adapter (`getTask`, `createComment`, `getCommentReplies`, `updateTaskStatus`, `updateTaskDueDate`, `addTaskTag`, `listPaymentRequestTasks`); **nunca** SQL direto no schema `plataforma`.
- **D-DEC-15:** `automation/` fica no repositório `financeiro-tria`; mover para o monorepo é decisão adiada (D12), reavaliar ao fim da Fase 2.
- **D-DEC-16:** Só o que substitui o ClickUp usa a ontologia (Solicitações, Contas a pagar, Contas a receber); as demais telas do financeiro-tria são portadas como tela lendo a API do `automation/` — **com ponto de revisão antes da Fase 2** (OQ-PLAN-01).
- **D-DEC-17:** `solicitacoes_pagamentos.TaskID` passa a apontar para a Tarefa da plataforma; coluna `origem` (`clickup` | `plataforma`) desambigua o histórico sem migrar nada.
</decisions>

### Candidatas — propostas, NÃO travadas (confirmar antes de depender delas)

| ID | Proposta | Origem | Onde pesa |
|----|----------|--------|-----------|
| CAND-01 | Uma Integração Omie por Empresa (6), selecionada pelo Campo `Empresa` | DOC 02-comparativo §3.6 (chama de "Decisão", sem autoridade de ADR) | Fase 3 (Agente), Fase 5 (tenants) |
| CAND-02 | Só a Data de vencimento nativa; o import copia `L-Data Vencimento` para ela | SPEC contas-a-pagar §12 + DOC 02-comparativo §3.2 (convergentes) | Fase 1 (bootstrap), Fase 3 (importação) |
| CAND-03 | Descartar observabilidade legada, `payment_requests` e as 13 tabelas vetoriais + 7 views em vez de migrar | DOC 01-inventario §5.7/§10 + nota riscada do plano | Fase 0/2 (o que exportar/importar) |
| CAND-04 | C32 (b): rebaixar Proprietário de registros exige transferência no mesmo ato | DOC PENDENCIAS-FRONTEND (auto-declarada reversível) | `deleteRole` em `members.ts` |
| CAND-05 | Três leituras conservadoras de Contas a receber (R1 como operação na Lista; R4/R5 por vencimento + 30/60; cliente = Contato por Vínculo) | DOC PENDENCIAS-FRONTEND C34; SPEC contas-a-receber §8 sanciona a primeira | Fase 5 |
| CAND-06 | Sessão pública (`/f/<segredo>`, `/p/<segredo>`) age como o Proprietário via `PublicoProvider` | Provisório no commit `d713253` | Fase 2 (formulário) — ver OQ-PF-01 |
| CAND-07 | Princípios de arquitetura do frontend (`app/` não calcula; `OperationResult`; `readonly`; `recordActivity`) continuam valendo no monorepo | DOC ARQUITETURA (histórico), confirmado pelo ADR | Todas as fases |

### Questões abertas — perguntas, não requisitos (planejar quem decide e quando)

| ID | Pergunta | Recomendação da fonte | Bloqueia | Decidir antes de |
|----|----------|-----------------------|----------|------------------|
| OQ-ADR-01 | Região do Supabase: `us-west-2` (250 ms) → `sa-east-1` (99 ms)? Barata agora (um `npm run migrar`), cara depois (migração de dados) | Decisão do dono; o plano segue igual | — (custo cresce com o tempo) | Fim da Fase 1 — **primeira decisão a tomar** |
| D11 | Onde o `apps/api` roda? | Mesma VPS do `automation/`, na nginx existente | PERS-08 | Adapter da Fase 2 apontar para ele |
| D6 | Solicitação: Lista própria com Vínculo à Conta, ou Status iniciais na Lista de Contas? | Lista própria (aprovador e prazo próprios; nem toda Conta nasce de Solicitação) | SOL-01 | Fase 2 (deve sair da spec — PREP-03) |
| D8 | Aprovação só por clique ou manter o classificador de comentário? | As duas; classificador como fallback por 90 dias, depois medir | SOL-08 | Fase 2 (idem) |
| D9 / OQ-CP-01 | Status `aprovado` da Lista de Contas (configurado, nunca usado) | Remover ao criar a Lista de Solicitações | — | Fase 2 |
| D7 / OQ-CR-01 | Onde o recebimento é controlado hoje (Lista dormente desde out/2025)? | Perguntar ao Financeiro; se Omie, a Lista vira espelho de leitura | REC-01 | Fase 5 |
| D10 | Emissão manual de NF: ação na Tarefa ou manter Google Sheets? | Ação na Tarefa | — | Fase 4 |
| D12 | Quando mover o `automation/` para o monorepo? | Reavaliar ao fim da Fase 2 | — | Fim da Fase 2 |
| OQ-PLAN-01 | A divisão ontologia × telas portadas (D-DEC-16) é a desejada? | É "o ponto a corrigir antes da Fase 2" | — | Fase 2 |
| OQ-PF-01 (A9) | Em nome de quem age uma resposta anônima a Formulário: `form.ownerMemberId` + Ator `sistema`? | Decisão de ontologia (Proveniência) | Afeta SOL-02 | Fase 2 |
| OQ-CP-04 | De-para ERP (Centro de Custo, Tag, Categoria) → (Conta, Categoria Omie, Código) não está onde a API alcance | Exportar do Omie ou ditar pelo Financeiro; o `automation/` já resolve parte por RAG + `ListarCategorias` | PAG-03, PAG-04 | Fase 3 |
| OQ-CP-06 | Regra exata da recorrência ("mesmo dia, dia útil anterior" inferida de três vencimentos) | Confirmar com o Financeiro antes de codificar A1 | — | Fase 3 |
| OQ-CP-02/03/05 | Campo L duplicado (→ CAND-02); `Equipe`/`Produto` herdados vazios; quem gera a remessa CNAB | Ver fontes | — | Fase 1 (bootstrap) / Fase 3 |
| OQ-CMP-01..05 | `Cartão` + `Link de pagamento`; status `em revisão` (FO); Departamento Omie; validação CPF/CNPJ (cnpj.ws) fica onde; autonomia do Agente no ERP | Provavelmente pertencem à spec da Solicitação (PREP-03) | — | Fase 0 (spec) / Fase 3 |
| OQ-CR-02..06 | Cliente = Contato ou Empresa; status nunca usados; Valor dos Saques; prazos 30/60; Tag `conta tria` | Ver `contas-a-receber.md` §12 | — | Fase 5 |
| OQ-PF-02 (C33) | Espelho Negócio → Tarefa: qual lado manda | Fora do plano do Financeiro | — | Depois |
| OQ-PF-03 (C14) | Definições de Campo de Tarefa em Automação de escopo Espaço de Trabalho | Aberta na ontologia | Relevante para AUTO-01 | Fase 3 |
| OQ-SYN-01 | Como o CRM N1 autentica as leituras do `automation/` que hoje são `anon_read`? Não está em documento nenhum | — | TELA-01 | Fase 4 (desenhar na Fase 2 junto do adapter) |
| OQ-SYN-02 | O webhook de saída de SOL-07 e o motor de Automações são a mesma peça de "evento de saída"? | — | SOL-07, AUTO-01 | Planejar a Fase 2 |
| OQ-SYN-03 | Quais leituras deixam de poder ser JOIN com o banco separado (`omie_clientes`, `conciliador_contas`, `solicitacoes_pagamentos`)? | Tudo por HTTP | — | Fase 2/3 |
| OQ-GHL-01 | Go High Level | Inventário próprio, fora deste plano | — | Depois |

## Evolution

Depois de cada transição de fase: requisitos invalidados → Out of Scope com motivo; validados → Validated com a fase; novos → Active; decisões novas → tabela acima (candidatas que forem confirmadas sobem para o bloco `<decisions>`); "What This Is" ainda vale? Depois de cada marco: revisão completa, Core Value ainda é a prioridade certa?

---
*Last updated: 2026-09-25 after Phase 5 (Contas a receber e os outros tenants)*
