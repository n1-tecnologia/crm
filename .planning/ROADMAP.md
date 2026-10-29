# Roadmap: Plataforma N1 Digital

## Overview

O CRM N1 sai de protótipo em memória e vira o front único do Financeiro da Tria, substituindo o ClickUp e o painel do financeiro-tria — sem tocar no backend do financeiro-tria. A estrutura segue as Fases 0–5 do SPEC `docs/08-migracao-financeiro/03-plano-de-migracao.md`, na ordem do plano: **Fase 0** prepara os insumos (a spec da Solicitação é o maior risco); **Fase 1** dá persistência e login ao CRM N1 (metade feita); **Fase 2** move a Solicitação de pagamento para o CRM N1 e liga o `automation/` ao `apps/api` por HTTP; **Fase 3** move Contas a pagar, com o motor de Automações como primeiro cliente real; **Fase 4** porta as outras leituras e desliga o painel; **Fase 5** traz Contas a receber e os tenants Marcos Paulo e Family Office.

Fase 0 e Fase 1 correm em paralelo: o que resta da Fase 0 não bloqueia terminar a Fase 1, mas **bloqueia a Fase 2**. Portão permanente (CON-05): `npm run check` verde nos três workspaces; testes do domínio idênticos; `automation/` com o mesmo `git log` fora o adapter.

**Granularidade:** standard (sem `config.json`; 6 fases derivadas do plano, não impostas). Sem estimativas de tempo aqui — as do plano (11–14 semanas de uma pessoa) são referência de tamanho.

## Phases

**Phase Numbering:**

- Integer phases (0, 1, 2 …): trabalho planejado, numeração espelha as Fases do plano
- Decimal phases (2.1, 2.2): inserções urgentes via `/gsd-phase --insert` (marcadas INSERTED)

- [x] **Phase 0: Preparação** - Insumos e decisões que a Fase 2 precisa: spec da Solicitação lida da Lista real, exportação do ClickUp, de-para de usuários, rotação Omie retirada (D-13) (6/6 feitos) (completed 2026-09-17)
- [x] **Phase 1: O CRM N1 ganha persistência e login** - Um Membro real entra, cria uma Conta pela tela e ela está no Postgres; rotas por operação, store falando `POST`, bootstrap do Espaço "Gestão", colunas geradas (persistência e autenticação já entregues) (completed 2026-09-16)
- [ ] **Phase 2: Solicitação de pagamento — o front substitui o ClickUp** - Toda solicitação nova nasce no CRM N1, o aprovador decide com um clique e o pipeline do `automation/` roda sem webhook do ClickUp
- [x] **Phase 3: Contas a pagar** - O Financeiro opera uma semana sem abrir o ClickUp: importação com histórico, motor de Automações executando A1–A9, Agente lançando no Omie de verdade, lote e permissões (completed 2026-09-23)
- [ ] **Phase 4: As outras telas do financeiro-tria** - As leituras que nunca viveram no ClickUp portadas como tela; `financeiro-tria.vercel.app` sai do ar
- [x] **Phase 5: Contas a receber e os outros tenants** - Marcos Paulo e Family Office como Empresas do Campo `Empresa`; Contas a receber na forma que D7 determinar; notificar por Canal (gaps_found 2026-09-24 — fechamento de lacunas 05-13..05-25 planejado) (completed 2026-09-25)
- [x] **Phase 6: Conferência do Resumo e anexos** - Os Fluxos 5, 6 e 7 da documentação v2 na plataforma: o Agente publica o Resumo ANTES do lançamento, aberto ao Financeiro; conferência por clique ou "ok" no fio, ajuste vira Resumo revisado; o lançamento só sai com conferência, com a categoria confirmada e os anexos no Omie; S5/S6 na Solicitação (planejado 2026-09-29, à mão, a partir dos docs 09 e 10) (completed 2026-09-30)
- [x] **Phase 7: CRM: Contatos, Empresas, Funis e Negócios (backend e frontend)** - CRUD de ponta a ponta: regras no `@n1/dominio`, `apps/api` sobre a migração 007 e as telas no `apps/web` para criar, listar, editar e excluir direto pela interface (completed 2026-10-11)
- [ ] **Phase 8: Canais de comunicação: conexão e omnichannel preparado** - Tela de escolha do Canal e orientação (mockup) por tipo — WhatsApp oficial e não oficial, Instagram, E-mail —, mais de um Canal por tipo; Canal/Conversa/Mensagem modelados no Postgres (migração 008) com rotas REST; o chat mostra de qual Canal a Mensagem veio e por qual responde. Sem provedor real.

## Phase Details

### Phase 0: Preparação

**Goal**: Tudo o que a Fase 2 consome existe e é confiável — o processo de Solicitação de pagamento está escrito a partir da Lista real, o ClickUp está exportado como insumo e prova de paridade, os usuários do ClickUp têm Membro correspondente e nenhuma credencial exposta continua válida.
**Depends on**: Nothing (first phase) — corre em paralelo com a Phase 1
**Requirements**: PREP-01, PREP-02, PREP-03, PREP-04, PREP-05, PREP-06
**Success Criteria** (what must be TRUE):

  1. `docs/07-processos/solicitacao-de-pagamento.md` existe, no padrão de `contas-a-pagar.md`, lido da Lista real `901109104938` (Status, Campos, papéis, fluxo, automações, permissões, regras), e responde D6 e D8 — ou os deixa explicitamente abertos — e absorve `Cartão`/`Link de pagamento`, `em revisão` e a validação CPF/CNPJ (OQ-CMP-01/02/04).
  2. As três Listas (`901109104938`, `901107637383`, `901107648977`) estão exportadas em disco com Tarefas, Campos, Comentários, histórico de status e anexos, paginadas — dá para contar e comparar depois da importação.
  3. Existe uma tabela de de-para dos 6 IDs de usuário do ClickUp (e das 38 variáveis `CLICKUP_*`) para Membros da plataforma, pronta para as importações das Phases 2 e 3.
  4. (risco aceito pelo dono em 2026-09-16, D-13 — não cobrar) As credenciais Omie do Marcos Paulo que estão no histórico do git continuam em uso por decisão do dono; nenhuma rotação nesta fase. CON-10 vale para o que a plataforma cria.
  5. (já verdadeiro) O schema `plataforma` existe no projeto Supabase próprio e `npm run migrar` o aplica; o volume das tabelas legadas está medido.

**Plans**: 7 plans
Plans:
**Wave 1**

- [x] 00-01-PLAN.md — Cliente HTTP do ClickUp (auth sem Bearer, backoff 429) + paginação (page/last_page e start/start_id) + esqueleto do módulo, `.env.example`, `.gitignore` (PREP-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 00-02-PLAN.md — De-para dos 6 ids → e-mail + Papel (`memberIdConhecido` para a Maryane) + catálogo das 38 `CLICKUP_*` + CLI de resolução de e-mails (PREP-04)
- [x] 00-03-PLAN.md — `exportarClickUp`: exportação bruta por Lista/recurso/página, retomável, anexos sanitizados, smoke test de `time_in_status` (PREP-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 00-04-PLAN.md — Manifesto (sha256 por arquivo, sem PII) + CLI `npm run exportar:clickup` + teste de integração que pula sem token (PREP-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 00-05-PLAN.md — Execução real da exportação das 3 Listas + commit de `MANIFESTO.md/.json` (PREP-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 00-06-PLAN.md — Spec `solicitacao-de-pagamento.md` §1–§12 lida da Lista real, lacunas respondidas pelo dono (PREP-03)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 00-07-PLAN.md — Fechamento: PREP-05 como risco aceito (D-13), REQUIREMENTS/README, `npm run check`, instrução para o critério 4 (PREP-01, PREP-05, PREP-06)

Estado em 2026-09-15: PREP-01 e PREP-06 feitos. PREP-03 é o item não mecânico e o maior risco do plano — "a primeira tarefa da Fase 0". PREP-05 acontece fora deste repositório (financeiro-tria + Omie). Nada aqui bloqueia a Phase 1; PREP-03 e PREP-04 bloqueiam a Phase 2; PREP-02 e PREP-04 alimentam a Phase 3.

### Phase 1: O CRM N1 ganha persistência e login

**Goal**: O CRM N1 deixa de ser protótipo — um Membro real entra com e-mail e senha, cria uma Conta pela tela e ela está no Postgres da plataforma; toda operação do domínio chega ao backend por HTTP e roda na Unidade de Trabalho, sem que o domínio ou os 214 testes mudem.
**Depends on**: Nothing (first phase) — corre em paralelo com a Phase 0
**Requirements**: PERS-01, PERS-02, PERS-04, PERS-05, PERS-06, PERS-07, PERS-08, PERS-09
**Success Criteria** (what must be TRUE):

  1. Um Membro real entra em `/entrar` com e-mail e senha, é resolvido pelo Usuário (nunca escolhido), cria uma Conta a pagar pela tela e, ao recarregar a página, a Conta continua lá — está no Postgres, não no seed.
  2. Toda operação dos 16 módulos do domínio chega ao `apps/api` por `POST /operacoes/:nome` e roda dentro da Unidade de Trabalho (hidratar → operação → diff → revisão) com o Membro da sessão; a API pública do store (`useData`, `useSession`, `useRun`) não muda e nenhum componente sabe de onde o store vem.
  3. O Espaço "Gestão" › Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber" existem no banco com Status, Campos, Tags e Papéis conforme os SPECs de processo — sem Tarefas fictícias; a Lista de Contas a pagar filtra por status, vencimento, Tag `conta *`, Responsável e Pessoa com coluna gerada e índice.
  4. `npm run check` verde nos três workspaces; os 214 testes do domínio são os mesmos; a prova hidratado ≡ seed vale contra o Supabase; ClickUp e `automation/` intocados.
  5. Reconvidar um Usuário removido reativa o mesmo Membro (RN-ET-11), sem criar um segundo.

**Plans**: 16 plans (9 executados + 2 de fechamento de lacunas da verificação + 5 da segunda rodada de fechamento, CR-02 residual)
**UI hint**: yes
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Portão de legitimidade do `fastify` (checkpoint humano antes do `npm install`, T-1-SC)
- [x] 01-03-PLAN.md — Domínio: registro `OPERACOES`, gravador de chamadas, `syncIdSequence`, `aplicarDiferenca`
- [x] 01-06-PLAN.md — Migração `002`: colunas geradas e índices em `plataforma.registros`
- [x] 01-10-PLAN.md — Fechamento de lacuna CR-01 (PERS-09, critério 5): `inviteMember` casa `existing` por `userId` E por `invitedIdentity` (`porUserId ?? porEmail`) — nunca um segundo Membro para o mesmo e-mail; testes no domínio e no serviço
- [x] 01-11-PLAN.md — Fechamento de lacuna CR-02 (PERS-04, critério 2): schemas por operação (tasks/financeiro/automations) + estrutural para as demais em `apps/api/src/rotas/esquemas-de-argumentos.ts`; `TypeError` dentro da operação → 400, nunca 500 nem `jsonb` malformado

**Segunda rodada de fechamento de lacunas (CR-02 residual — re-verificação de 2026-09-16T20:16Z; opção (b), cobertura total, porque `apps/web` chama 128/132 operações e o critério 2 exige que todas cheguem por HTTP)** — ondas relativas entre si, executar com `/gsd-execute-phase 1 --gaps-only`:

- [x] 01-12-PLAN.md — Onda 1: WR-10 (`reviverArgumentos` em `try/catch` na rota, `RangeError` → 400, caso (s)); `esquemas/fragmentos.ts` (fragmentos compartilhados + portão de enum `Igual<>`); os 23 schemas movidos para `esquemas/tarefas.ts`/`automacoes.ts`/`financeiro.ts`; `esquemas-de-argumentos.ts` vira composição
- [x] 01-13-PLAN.md — Onda 2 (paralelo): schemas de `deals`/`conversations`/`contacts` (40) em `esquemas/negocios.ts`, `conversas.ts`, `contatos.ts` + testes puros (cobertura, formas literais do web, hostis)
- [x] 01-14-PLAN.md — Onda 2 (paralelo): schemas de `ai`/`chat-folders`/`agent-builder`/`configuration`/`collaboration` (36) em `esquemas/ia.ts`, `pastas-de-chat.ts`, `construtor-de-agentes.ts`, `configuracao.ts`, `colaboracao.ts` + testes
- [x] 01-15-PLAN.md — Onda 2 (paralelo): schemas de `planning`/`scale`/`members`/`structure` (33) em `esquemas/planejamento.ts`, `escala.ts`, `membros.ts` (`inviteMember` com `.strip()`, T-1-08), `estrutura.ts` + testes — inclui as duas formas hostis do verificador (`createGoal` `kind:42`, `saveView` `filters` arbitrário)
- [x] 01-16-PLAN.md — Onda 3: `ESQUEMAS` = composição dos 15 módulos `satisfies EsquemasCompletos` (operação sem schema não compila); `ARGUMENTOS_GENERICOS` removido; mapeamento `TypeError → 400` removido (WR-11); (q) reapontado, (t)/(u)/(v) provam `createGoal`/`saveView` → 400 e nada persistido; `CONTEXT.md`s

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Fastify em `apps/api`: `buildApp()`, hook de autenticação (JWT do Supabase → Membro por `userId`), CORS, `npm run dev` web + api
- [x] 01-07-PLAN.md — `store.ts` → API: `run()` híbrido (clone, recusa na hora, POST, diff, re-hidratação); casca hidrata por `GET /estado`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — `POST /operacoes/:nome` e `GET /estado`; `gravar()` devolve o diff; `executar()` devolve `revisao`/`revisaoAnterior`
- [x] 01-05-PLAN.md — Bootstrap do Espaço "Gestão" (só configuração do Financeiro; Maryane Proprietária; sem fixtures)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-08-PLAN.md — Reconvite por Usuário: `inviteMember` casa por `userId`; e-mail resolvido no servidor (Admin API)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-09-PLAN.md — Teste ponta a ponta (critério 1) e portão da fase (`npm run check`); PERS-08 documentado (bloqueado por D11)

Estado em 2026-09-15: **metade feita**. PERS-01 (persistência + Unidade de Trabalho) e PERS-02 (Supabase Auth) entregues, validados e commitados (`9fb2754` → `d713253`). Restam PERS-04 (rotas por operação — inclui escolher a camada HTTP), PERS-05 (`store.ts` → `POST`), PERS-06 (bootstrap do Espaço "Gestão"), PERS-07 (colunas geradas/índices, migração `002`), PERS-09 (reconvite). PERS-08 (onde o `apps/api` roda) está bloqueado por D11 e conversa com OQ-ADR-01 (região do Supabase — barata de mudar agora, cara depois): não bloqueia o código desta fase, mas precisa estar decidido antes de o adapter da Phase 2 apontar para o `apps/api`. PERS-03 (sobreposto por DEC-02) não é executado. Lacunas de teste a fechar aqui (CONCERNS.md): ponta a ponta tela → Postgres; resolução de sessão → Membro.

### Phase 2: Solicitação de pagamento — o front substitui o ClickUp

**Goal**: Toda solicitação de pagamento nova nasce no CRM N1 e percorre o pipeline do `automation/` sem o ClickUp — o solicitante preenche o formulário no CRM N1, o aprovador decide com um clique, e o Omie recebe o mesmo lançamento de sempre.
**Depends on**: Phase 1 (persistência, rotas por operação, `apps/api` no ar — PERS-08/D11) e Phase 0 (PREP-03 spec da Solicitação, PREP-04 de-para de usuários)
**Requirements**: SOL-01, SOL-02, SOL-03, SOL-04, SOL-05, SOL-06, SOL-07, SOL-08, SOL-09
**Success Criteria** (what must be TRUE):

  1. Um solicitante cria o pedido pelo formulário do CRM N1 (não pelo formulário de Tarefa do ClickUp) e a Tarefa nasce na Lista "Solicitações de pagamento" com os Status de CON-04, com a resposta anônima atribuída conforme OQ-PF-01.
  2. O aprovador certo (roteado por centro de custo e valor) vê a solicitação no CRM N1 e decide com um clique — Solicitação de Aprovação, não texto classificado por IA — sem abrir o ClickUp; a decisão, o RESUMO e o progresso aparecem na timeline (Comentários + Registros de Atividade).
  3. O pipeline do `automation/` roda de ponta a ponta sem webhook do ClickUp: começa em `POST /webhooks/plataforma/solicitacao-criada` disparado pelo `apps/api` e fala com ele só pelos 7 métodos de `adapters/plataforma.ts`; com o `apps/api` fora do ar, o adapter enfileira e repete em vez de falhar o run; `clickup.ts` continua no repositório, desligado por env.
  4. Por duas semanas, o Omie recebe o mesmo `IncluirContaPagar` pelos dois caminhos — conferido por `ConsultarContaPagar` com `codigo_lancamento_integracao` idêntico; ao fim, os webhooks Tria do ClickUp são desligados e a Lista de Solicitação é arquivada.
  5. As solicitações históricas completas aparecem como Tarefas fechadas, com `comentario` como Comentário do RESUMO, `TaskID` apontando para a Tarefa da plataforma, `origem` preenchida e nenhuma credencial copiada. *(Reescrito em 2026-09-25, decisão do dono: a origem tem 1.114 linhas mas só 843 Solicitações distintas, e só 245 com Centro de Custo e decisão — essas foram importadas; as demais ficam na tabela antiga, contadas por motivo no manifesto. Ver `02-25-SUMMARY.md`.)*

**Plans**: 28 plans
**UI hint**: yes
Plans:
**Wave 1** *(fundações independentes)*

- [x] 02-01-PLAN.md — Wave 0 do `crm-n1`: Playwright contra build de produção, servidor HTTP falso e relógio injetável (portão de legitimidade de `@playwright/test`, T-02-SC)
- [x] 02-02-PLAN.md — Contrato HTTP v1 dos 7 métodos (D-16/CON-13): `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`, schemas zod em `apps/api/src/contratos/`, fixtures canônicas em `contratos/payment-requests-v1/`
- [x] 02-03-PLAN.md — Migração `003`: outbox, idempotência HTTP, credenciais de serviço, sessões de upload e ledger de importação + `[BLOCKING] npm run migrar`
- [x] 02-04-PLAN.md — Domínio: `ApprovalRequest` vira união discriminada (D-06), `solicitarAprovacao` e `decideProcessApproval` (D-09/D-11)
- [x] 02-05-PLAN.md — Domínio: `submitForm` com Ator `sistema/Formulário` (D-03), envio atômico com anexos e `WorkspaceFile` com referência de Storage
- [x] 02-06-PLAN.md — Domínio: catálogo da Lista `Solicitações de pagamento` — 4 Status, 25 Campos, Tag, 5 Papéis e roteamento por Centro de Custo/Valor (D-01/D-07/D-13/D-14)
- [x] 02-07-PLAN.md — Wave 0 do `financeiro-tria`: fábrica do router Express, servidor falso, Omie falso e relógio (runner `tsx --test` confirmado)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-09-PLAN.md — Credencial de serviço com hash + Membro `Agente do pipeline` (D-15); `.env.example` completo da fase
- [x] 02-10-PLAN.md — Outbox transacional na UoW + worker de entrega com lease e backoff (D-18/D-19/SOL-07)
- [x] 02-11-PLAN.md — Storage privado: tickets de upload assinados, verificação server-side e download por URL curta (D-04)
- [x] 02-12-PLAN.md — `financeiro-tria`: porta `PaymentRequestAdapter`, injeção no serviço e seletor `PAYMENT_REQUEST_SOURCE` (D-17/D-21)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-08-PLAN.md — Evolver idempotente da Lista + elevação de `tasksPerList` + CLI `solicitacoes:configurar` (SOL-01)
- [x] 02-13-PLAN.md — `apps/api`: as 7 rotas `/v1/integrations/payment-requests/*` + idempotência HTTP + projeção `PaymentRequestDtoV1` (SOL-05, D-20/D-22)
- [x] 02-14-PLAN.md — `apps/web`: fila `/ia/aprovacoes` discriminando origem + card de Aprovação na Tarefa + Fluxo manual (SOL-03, D-08/D-12)
- [x] 02-15-PLAN.md — Topologia e região: decisão de `sa-east-1` (D-23), nginx/TLS na VPS (D-15/D11), CA do Postgres fixada e latência medida

**Wave 4** *(blocked on Wave 3)*

- [x] 02-16-PLAN.md — `apps/api`: as 3 rotas públicas do Formulário com submissão atômica + outbox (SOL-02/SOL-07, D-02/D-19)
- [x] 02-17-PLAN.md — `financeiro-tria`: `adapters/plataforma.ts` + fila persistente `platform_adapter_commands` + migração (SOL-05, D-19/D-20)
- [x] 02-18-PLAN.md — `financeiro-tria`: `plataforma-payment-mapper.ts` tipado + `unique (origem, TaskID)` na tabela legada (SOL-06)
- [x] 02-19-PLAN.md — `apps/web`: painel `Timeline` único (Comentários + Atividades) e anexos com download assinado (SOL-04)

**Wave 5** *(blocked on Wave 4)*

- [x] 02-20-PLAN.md — `apps/web`: transporte público + formulário `/f/[segredo]` com seções, campos condicionais e validação (SOL-02)
- [x] 02-21-PLAN.md — `financeiro-tria`: os 3 webhooks `/webhooks/plataforma/*` com receipt idempotente + seleção do mapper (SOL-07)
- [x] 02-22-PLAN.md — Importação histórica: operação de domínio, leitura sanitizada por allowlist e fixture hostil (SOL-09, D-24/D-25)

**Wave 6** *(blocked on Wave 5)*

- [x] 02-23-PLAN.md — `apps/web`: upload direto ao bucket privado, confirmação pública e jornada Playwright (SOL-02, D-04/D-05)
- [x] 02-24-PLAN.md — Fallback por comentário: janela de 90 dias, `POST /v1/integrations/payment-approvals/classifications` e classificador (SOL-08, D-08/D-10)
- [x] 02-25-PLAN.md — Importação: CLI dry-run/apply/resume, anexos históricos, manifesto sanitizado e execução real (SOL-09, D-25/D-26)

**Wave 7** *(blocked on Wave 6)*

- [x] 02-26-PLAN.md — Contract tests nos dois repositórios + E2E entre processos + matriz de falhas injetadas

**Wave 8** *(blocked on Wave 7)*

- [ ] 02-27-PLAN.md — Ensaio de duas semanas por coortes, código Omie determinístico, métricas e reconciliação diária (D-27)

**Wave 9** *(blocked on Wave 8)*

- [ ] 02-28-PLAN.md — Corte final: runbook, desligar webhooks ClickUp, arquivar a Lista, reavaliar D12 e fechar SOL-01..09 (D-28)

Planejada em 2026-09-21 a partir de `02-CONTEXT.md` (D-01..D-28), `02-RESEARCH.md`, `02-PATTERNS.md`, `02-UI-SPEC.md` e `02-VALIDATION.md`. As decisões que o ROADMAP listava como pendentes foram fechadas no CONTEXT e estão distribuídas pelos planos: OQ-PLAN-01/DEC-16 → D-22 (Plan 02-13); D6 → D-01 (02-06); D8 → D-08/D-10 (02-14/02-24); D9 → D-01/D-14 (02-06); OQ-PF-01 → D-03 (02-05); OQ-SYN-02 → D-18, outbox mínimo sem motor genérico (02-10); CON-13 → D-16, contrato escrito antes de SOL-05 (02-02); OQ-SYN-01 → D-15/D-22, credencial de serviço desenhada junto do adapter (02-09/02-13); D11 → D-15 (02-15); D12 reavaliada no fechamento (02-28).

### Phase 3: Contas a pagar

**Goal**: O Financeiro opera as Contas a pagar inteiramente no CRM N1 — as Tarefas vêm do ClickUp com o histórico, as automações A1–A9 acontecem sozinhas num motor que não perde o dia se o processo cair, o Agente lança no Omie de verdade e as permissões são as que o processo precisa.
**Depends on**: Phase 2 (a semana sem ClickUp inclui as Solicitações; adapter e contrato estáveis) e Phase 0 (PREP-02 exportação, PREP-04 de-para)
**Requirements**: PAG-01, PAG-02, PAG-03, PAG-04, PAG-05, PAG-06, AUTO-01
**Success Criteria** (what must be TRUE):

  1. O Financeiro passa uma semana sem abrir o ClickUp; a Lista `901107637383` está arquivada.
  2. As Tarefas importadas preservam `date_created`, `date_closed` e o histórico de status como Registros de Atividade com a data original — "tempo em `para pagar`" continua medível (29–31 dias é o ciclo normal); a data de vencimento vive só no campo nativo.
  3. Ao mover uma conta recorrente para `pago`, a ocorrência do mês seguinte aparece sozinha com vencimento no dia útil anterior (A1) — uma por fechamento, mesmo reabrindo (RN-CP-06); a troca de Responsável (A3/A4), a cobrança de nota D-5/D-2 com Menção à Pessoa (A5/A6), a invocação do Agente D-1 (A7/A8) e os Observadores (A9) acontecem sem ninguém acionar, cada uma com Execução auditável; se o processo cair no minuto errado, a agenda não é pulada.
  4. O Agente lança a conta no Omie de verdade via `automation/` (idempotente por `codigo_lancamento_integracao`), publica o RESUMO no formato exato de CON-CP-08 atribuído ao Financeiro e move para `lançado omie`; categorias e contas vêm do plano real do Omie (não de códigos inventados), com `REVISAR` abaixo do threshold; na primeira semana roda em Ensaio.
  5. O Financeiro fecha 61 contas em lote num só gesto e cada uma dispara A1; a Pessoa da conta vê só as Tarefas em que é o campo Pessoa (e edita só Anexo e Data de Emissão); demais Membros não veem a Lista.

**Plans**: 15 plans
**UI hint**: yes
Plans:
**Wave 1** — o domínio, tudo em paralelo

- [x] 03-01-PLAN.md — Migração `005-agenda-de-automacoes.sql`: `plataforma.automacao_agenda` por (Espaço, Lista, dia civil), exclusão mútua entre instâncias e auditoria de "o dia foi processado", com o apply `[BLOCKING]` (AUTO-01)
- [x] 03-02-PLAN.md — Vocabulário do executor: `runAction` passa a tratar `aguardar`/`notificar`/`solicitarAprovacao`/`encerrar` (o tipo já os contém); base de tempo única `instante()`/`mesmoDiaCivil`; A2–A9 cobertas em arquivo próprio (PAG-02, AUTO-01)
- [x] 03-03-PLAN.md — A regra de A1 travada por teste: saturação de `addMonths` (D3-07), feriado tratado como dia útil (D3-06), uma ocorrência por fechamento mesmo reabrindo (PAG-02)
- [x] 03-04-PLAN.md — O de-para vira parâmetro: `buildResumoDePagamento` para de ler tabelas fictícias, o RESUMO de CON-CP-08 fica byte a byte, e `rehearsal` deixa de ser `false` fixo (PAG-03, PAG-04)
- [x] 03-09-PLAN.md — `importarContaAPagarHistorica`: Tarefa já no status final, um `recordActivity` por transição com o `at` original, **sem nunca chamar `changeTaskStatus`** — nenhuma Automação dispara no replay (PAG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-05-PLAN.md — A Pessoa da conta enxerga a própria Tarefa por visibilidade **derivada** do Campo Pessoa (`sharedWithDefinitionIds` + `memberNamedOnTask`), não por Grant escrita à mão; caso negativo provado nos dois sentidos (PAG-06)
- [x] 03-06-PLAN.md — D3-08: a Solicitação aprovada vira Conta a pagar por `converterSolicitacaoEmContaAPagar`, com Vínculo `task→task` e `provenance` — sem Status `convertida` novo (PAG-01)
- [x] 03-07-PLAN.md — `financeiro-tria/automation`: superfície nova `/v1/integrations/contas-a-pagar/{resolver,lancar}` que só calcula e lança, **nunca escreve status em Lista nenhuma** (PAG-03, PAG-04)
- [x] 03-08-PLAN.md — `scheduler-worker.ts`: o relógio que faltava ao motor, com catch-up provado (a agenda não pula o dia se o processo cair) e a primeira volta em ensaio até liberação explícita (AUTO-01, PAG-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-10-PLAN.md — CLI de importação da Lista `901107637383` em lotes de 250, ledger `003` reusado, `MARCO_ZERO` gravado ao fim, e a corrida real `[BLOCKING]` provando que a segunda execução é no-op (PAG-01)
- [x] 03-11-PLAN.md — A ponte HTTP de A7/A8: de-para resolvido **antes** da transação, Ensaio que falha para o lado seguro em três camadas, e a metade `CNPJ_POR_EMPRESA` de PAG-04 (PAG-03, PAG-04)
- [x] 03-12-PLAN.md — `alterarStatusEmLote` numa transação só (61 < 250), com `RelatorioDeLote` de quatro resultados por item e o tempo de lock medido contra DEC-06 (PAG-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-13-PLAN.md — A tela do lote: liga o gesto que já existe a uma chamada só (hoje é um laço de 61 `POST` concorrentes), renderiza a falha parcial, e põe o botão da conversão D3-08 no card de Aprovação (PAG-05)
- [x] 03-15-PLAN.md — A metade de tela de PAG-06: re-chaveia `SharedTasks` em `memberSeesTask` (o 03-05 apaga as Grants em que ela se apoia hoje) e fecha duas telas que listam Tarefa sem filtro de visibilidade nenhum (PAG-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-14-PLAN.md — Relatório do Ensaio × lançamento humano com `LIMIAR_DA_CANETA` declarado antes dos dados, e o runbook de corte em 11 passos terminando no arquivamento da Lista (PAG-03)

**Cross-cutting constraints:** o domínio nasce primeiro (a onda 1 é inteira `packages/dominio` fora a migração); nenhuma chamada de rede entra em `packages/dominio`; `sanitizarErro()` e `pool()` são reusados por import, nunca duplicados; o tempo é injetado (`today: Date`, `Relogio`) em todo o caminho de agenda; e o portão CON-05 vale em cada onda.

**Motor de Automações (AUTO-01) mora aqui.** É a única peça G de risco alto ainda não iniciada e é transversal: o Financeiro (A1–A9) é o primeiro cliente, Contas a receber (R2–R7, Phase 5) o segundo, e o gatilho "tempo em Status" (C34) o terceiro. Planejar como infraestrutura genérica de `apps/api` — gatilho por evento (sobre o mesmo evento de saída de SOL-07, OQ-SYN-02) e por agenda com fila e retry persistente (o cron do `automation/` "sem fila, sem retry persistente" é o antipadrão) — executando `Automation` da ontologia com as quatro ações (`invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar` — `notificar` in-app aqui; por Canal na Phase 5) e registrando Execuções. OQ-PF-03 (C14) toca o escopo das Automações de Espaço de Trabalho. Merece pesquisa própria em `/gsd-plan-phase 3`. Antes de codificar A1, confirmar a regra da recorrência com o Financeiro (OQ-CP-06); antes do Agente real, resolver OQ-CP-04 (de-para ERP alcançável pela API) e OQ-CMP-03/05; com DEC-08, `conciliador_contas` e `omie_clientes` são lidos por HTTP (OQ-SYN-03). Medir o lote de 61 contra a serialização de escritas por Espaço (DEC-06).

### Phase 4: As outras telas do financeiro-tria

**Goal**: Tudo o que o Financeiro lia no painel do financeiro-tria está no CRM N1, no seu sistema de design, lendo a API do `automation/` por um caminho autenticado — e o painel sai do ar.
**Depends on**: Phase 3 (ordem do plano; o Financeiro já opera no CRM N1) e o caminho autenticado para leituras do `automation/` (OQ-SYN-01, desenhado na Phase 2)
**Requirements**: TELA-01
**Success Criteria** (what must be TRUE):

  1. O Financeiro encontra no CRM N1 as oito leituras: Notas fiscais, Produtos, Plano de contas (com CRUD e import), Extratos do Marcos (upload), Workflows (catálogo + runs), Dashboard, Problemas e Aprovações pendentes — mesma leitura de hoje, visual do CRM N1, nenhuma regra alterada (DEC-16).
  2. Nenhuma dessas leituras usa `anon_read` nem credencial embutida no bundle: chegam ao CRM N1 autenticadas.
  3. `financeiro-tria.vercel.app` pode sair do ar sem ninguém sentir falta; `AuthContext` e a policy `anon_read` morrem com ele.
  4. A emissão manual de NF segue o que D10 decidir (ação na Tarefa, recomendação do plano — ou Google Sheets continua).

**Plans**: 14 plans em 6 ondas
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Onda 1 · `automation/`: a fixture compartilhada e os DTOs com allowlist positiva de campos (D4-05)
- [x] 04-02-PLAN.md — Onda 1 · `apps/api`: o cliente HTTP de leituras com `PLATAFORMA_LEITURA_TOKEN`, timeout e erro saneado (D4-01/D4-02)
- [x] 04-03-PLAN.md — Onda 1 · `apps/web`: o assunto Financeiro na casca, visível por alcance à Pasta, e as formas de esqueleto das oito rotas (D4-08/D4-14)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-04-PLAN.md — Onda 2 · `automation/`: `buildDashboardStats`/`buildProblemRows` re-homed como funções puras, com o RESUMO sanitizado (D4-06/D4-11)
- [x] 04-05-PLAN.md — Onda 2 · `apps/api`: as sete rotas `GET /financeiro/*` com guarda de alcance e registro na raiz de `app.ts` (D4-14/D4-04)
- [x] 04-06-PLAN.md — Onda 2 · `apps/web`: a fundação das telas (os três estados de D4-15, botão Atualizar, revalidar ao focar) e o Dashboard

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-07-PLAN.md — Onda 3 · `automation/`: a superfície `/v1/leituras/*` autenticada em tempo constante e as quatro leituras derivadas (D4-03/D4-02)
- [x] 04-08-PLAN.md — Onda 3 · `apps/web`: Problemas, Aprovações pendentes (vista legada, sem porta de decisão) e Workflows (D4-11)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-09-PLAN.md — Onda 4 · `automation/`: Notas fiscais e Produtos — a única consulta desenhada do zero, com colunas nomeadas (D4-05/D4-07)
- [x] 04-10-PLAN.md — Onda 4 · `apps/api`: as escritas de D4-07 e o proxy de upload de Extratos com validação de MIME e tamanho (D4-13/D4-12)
- [x] 04-11-PLAN.md — Onda 4 · `apps/web`: Notas fiscais (com os dois gatilhos de lote) e Produtos (alíquota inline) (D4-12/D4-07)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-12-PLAN.md — Onda 5 · `automation/`: Plano de contas sobre `conciliador_contas`, gatilhos de NF e ações de execução (D4-10/D4-10b/D4-12)
- [x] 04-13-PLAN.md — Onda 5 · `apps/web`: Plano de contas (import CSV com confirmação que afirma a consequência) e Extratos (D4-10/D4-10b/D4-09/D4-13)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 04-14-PLAN.md — Onda 6 · o corte: runbook, verificação de RLS no Postgres, Vercel pausado e a remoção do `anon_read` por último (D4-16)
  - **PREPARADO, NÃO EXECUTADO** (2026-09-23, escopo decidido pelo usuário em checkpoint). Runbook e migração `20261001120000` escritos; NADA aplicado, Vercel intocado, rotas legadas e `AuthContext` byte-idênticos. Falta: uma semana de uso real, confirmação do Financeiro, as duas consultas de RLS no Supabase Studio, pausar o Vercel 30 dias — e só então o ponto de não retorno. Ver `04-14-SUMMARY.md` e `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md`.

**UI hint**: yes

Antes de planejar: decidir os 89 arquivos não commitados do frontend do financeiro-tria (regeneração shadcn/Lovable) só como referência de leitura — nada dali é portado como código. `planos_de_contas` está vazia hoje; o de-para real é o RAG em `conciliador_contas` (Phase 3).

### Phase 5: Contas a receber e os outros tenants

**Goal**: Marcos Paulo e Family Office operam no CRM N1 como Empresas do Campo `Empresa`, cada uma com a sua Integração Omie e sem um terceiro clone do serviço; Contas a receber vive na plataforma na forma que D7 determinar; uma Automação sabe notificar por Canal.
**Depends on**: Phase 3 (motor de Automações para R2–R7; Integração Omie por Empresa) — ordenada depois da Phase 4 pelo plano
**Requirements**: REC-01, TEN-01, AUTO-02
**Success Criteria** (what must be TRUE):

  1. Cada uma das 6 Empresas é opção do Campo `Empresa` e tem a própria Integração Omie (credencial só na Integração); as regras de cada `config.ts` viram configuração por Empresa — o prefixo numérico + `02-Empresas` do Family Office e o status `em revisão` são absorvidos, não clonados.
  2. Solicitações de Marcos Paulo e Family Office nascem no CRM N1 e percorrem o mesmo pipeline; os webhooks ClickUp dos dois tenants e as Listas `901109642259`/`901111928443` são desligados/arquivados.
  3. Contas a receber conforme D7: se o recebimento está no Omie, a Lista da plataforma espelha a Integração em leitura; se não, `createReceivableSeries` cria a série (Entrada + N parcelas) e R2–R7 rodam no motor com os prazos que o Financeiro confirmar (OQ-CR-05); a importação leva Data de pagamento sobre `date_closed` (CON-CR-10).
  4. Uma Automação consegue notificar por Canal (WhatsApp via Evolution API) usando o campo `WhatsApp` da Tarefa — prioridade a confirmar.

**Plans**: 25 plans (12 originais + 13 de fechamento de lacunas)
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Configuração por Empresa no domínio: `Integration` guarda rótulo da conta Omie, nunca segredo; evolver idempotente e CLI (TEN-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — A tela: Integrações por Empresa e o 5º Status `em revisão` bloqueado por Empresa (TEN-01)
- [x] 05-03-PLAN.md — O 5º Status atravessa o contrato v1 nos dois repositórios, com fixture e documento (TEN-01)
- [x] 05-06-PLAN.md — `notificar` por Canal no domínio: destino declarado, vazio é recusa, nenhum I/O (AUTO-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Roteamento por Empresa no `automation/`: o fim do `tenantId: "tria"`, Empresa desconhecida é recusa (TEN-01)
- [x] 05-07-PLAN.md — O evento `automacao.notificar-canal.v1` no outbox e as duas costuras que o produzem (AUTO-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-05-PLAN.md — O corte único de Marcos Paulo e Family Office: inventário, webhooks desligados, Listas arquivadas (TEN-01) — **ABERTO por decisão do dono (2026-09-24):** inventário pronto (`05-CORTE-MP-FO.md`), deploy/webhooks/48h/arquivamento pendentes
- [x] 05-08-PLAN.md — A rota `notificar-canal` no `automation/`: Bearer, idempotência, Evolution (AUTO-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 05-09-PLAN.md — D7: a conferência somente-leitura de `ws_n1` e a única pergunta ao Financeiro (REC-01)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 05-10-PLAN.md — Contas a receber: fechar o que a conferência achou, prazos ajustáveis, ligar o relógio (REC-01) — **ABERTO (Task 4, o relógio):** evolver/prazos/R7 entregues; Ensaio → ler relato → `automacoes:liberar` é o próximo passo de operador, agora que as 240 foram importadas e o MARCO_ZERO gravado

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 05-11-PLAN.md — A importação das 240 contas a receber, sem acordar Automação nenhuma (REC-01)
- [x] 05-12-PLAN.md — As telas: preview da série de parcelas e a régua de Empresa (REC-01)

**Ondas de execução:** 1 → [05-01] · 2 → [05-02, 05-03, 05-06] · 3 → [05-04, 05-07] · 4 → [05-05, 05-08] · 5 → [05-09] · 6 → [05-10] · 7 → [05-11, 05-12]

**Fechamento de lacunas (2026-09-24, `/gsd-plan-phase 5 --gaps`, a partir de `05-VERIFICATION.md` e `05-REVIEW.md`; decisões D5-19..D5-21).** Ondas próprias, numeradas de novo a partir de 1. O corte 05-05 continua bloqueado (D5-20) e não faz parte deste conjunto.

**Gap wave 1**

- [x] 05-13-PLAN.md — O Canal fala de Solicitação (D5-19/CR-02, domínio), um evento por passo (WR-04) e a barreira do histórico importado (WR-11) (AUTO-02, REC-01)
- [x] 05-14-PLAN.md — D5-06 vira regra de domínio: `changeTaskStatus` recusa “em revisão” fora da Empresa que o declara, fechado por padrão (CR-04) (TEN-01)
- [x] 05-15-PLAN.md — `automation/`: MP/FO recusam visivelmente (CR-01 por D5-20), receipts com retentativa num módulo neutro (CR-03) e a migração de receipts NOT YET APPLIED (TEN-01, AUTO-02)
- [x] 05-16-PLAN.md — Importação de Contas a receber: Data de pagamento no dia de Brasília (CR-06, código) e `MARCO_ZERO` só com `--apply` e sem rejeição (WR-07); tabela “Deferred to follow-up” (REC-01)

**Gap wave 2** *(blocked on gap wave 1)*

- [x] 05-17-PLAN.md — O evento de Canal nasce na Unidade de Trabalho; importação trava por construção (CR-05) (AUTO-02)
- [x] 05-18-PLAN.md — `automation/`: rota de Canal alinhada à Solicitação, gate de Empresa, retentativa e log sem número (CR-02, WR-02, CR-03, WR-03) (AUTO-02)
- [x] 05-19-PLAN.md — Testes não vazam para o outbox real e as órfãs saem, sob checkpoint (CR-07) (AUTO-02)
- [x] 05-20-PLAN.md — Configuração por Empresa aplicada em `ws_n1`, com “Marcos Paulo” nos dois Campos Empresa e conferência de `avisosPorCanal`/`statusDeclarados` (Critério 1, WR-05) (TEN-01)

**Gap wave 3** *(blocked on gap wave 2)*

- [x] 05-21-PLAN.md — Índice único de eventos de Canal (migração 006), aplicado sob checkpoint (WR-04) (AUTO-02)
- [x] 05-22-PLAN.md — Correção auditada das Datas de pagamento já importadas em `ws_n1` (CR-06, dados) (REC-01)
- [x] 05-24-PLAN.md — Contrato ponta a ponta do Canal entre crm-n1 e `automation/` (Critério 4, `missing` do verificador) (AUTO-02)

**Gap wave 4** *(blocked on gap wave 3)*

- [x] 05-23-PLAN.md — Migração de receipts no Supabase do `automation/` (o dono aplica) e deploy do `automation/` (o dono pode recusar) (TEN-01, AUTO-02)
- [x] 05-25-PLAN.md — O relógio de Contas a receber: pré-voo, R7 com o Valor do dono, Ensaio × simulação, liberação (05-10 Task 4) (REC-01)

**Ondas do fechamento de lacunas:** 1 → [05-13, 05-14, 05-15, 05-16] · 2 → [05-17, 05-18, 05-19, 05-20] · 3 → [05-21, 05-22, 05-24] · 4 → [05-23, 05-25]

Antes de planejar: D7/OQ-CR-01 (perguntar ao Financeiro onde o recebimento é controlado hoje) decide o formato de REC-01; CAND-01 (uma Integração por Empresa) e CAND-05 (leituras conservadoras de C34) precisam ser confirmadas ou revistas; OQ-CR-02..06 e OQ-CMP-02 têm dono aqui.

### Phase 6: Conferência do Resumo e anexos

**Goal**: A plataforma reproduz os Fluxos 5, 6 e 7 do módulo TRIA (`Documentação - Projeto Financeiro Pagamentos.v2.docx`) do mesmo jeito que o `financeiro-tria/automation` faz no ClickUp: o Agente publica o `📋 RESUMO DE PAGAMENTO` no fio da conta ANTES do lançamento, mencionando o Financeiro, e abre uma Conferência; o Financeiro confere (clique ou "ok" no fio) ou pede ajuste (qualquer outra resposta), e o Agente republica o Resumo revisado; ao entrar em "em lançamento omie" a ponte só chama `/lancar` com Conferência aprovada para os dados atuais, com a categoria confirmada e os anexos; confirma no fio e move para "lançado omie"; na falha permanente a conta volta a "para pagar". A Solicitação (coorte plataforma) ganha o Resumo depois da aprovação (S5) e o aviso ao Solicitante na reprovação (S6).
**Depends on**: Phase 3 (a ponte, o contrato `contas-a-pagar-v1`, `runLancamentoAgent` parametrizado) e a rodada pós-auditoria de 2026-09-28/29 (`docs/08-migracao-financeiro/07`, `08`, `09`, `10`)
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06
**Success Criteria** (what must be TRUE):

  1. Uma conta completa em "para pagar" recebe, no fio, o Resumo do Agente aberto ao Financeiro (com Menção), e uma Conferência pendente aparece no card da conta e na fila `/ia/aprovacoes`; nenhum Resumo nasce resolvido pelo próprio Agente.
  2. "Conferido, pode lançar" (clique) ou "ok" no fio produzem a resposta canônica `✅ Resumo conferido por …` e resolvem o fio, sem mudar o Status; qualquer outra resposta de um revisor gera `🔁 Ajuste pedido por …` e um Resumo revisado no mesmo fio, com nova Conferência.
  3. Em modo `lancar`, a conta que entra em "em lançamento omie" com Conferência aprovada para os dados atuais é lançada com `codigoCategoriaConfirmado` e `anexos` (URLs assinadas com o nome original), recebe `✅ Lançado no Omie — título …` no fio e vai para "lançado omie"; sem Conferência aprovada, ZERO requisições a `/lancar`; na falha permanente, comentário com o motivo e a conta volta a "para pagar".
  4. Nos modos `ensaio` e `conferencia` a contagem de requisições a `/lancar` é zero em qualquer ciclo (asserido com servidor falso); o contrato v1.1 é aditivo e igual nos dois repositórios (hash); `teste:omie-real --lancar --anexo` sobe um anexo de verdade no Omie da Tria e exclui o título no fim.
  5. `handlePlatformApprovalDecision` publica o Resumo na Solicitação depois de `aprovada` e avisa o Solicitante em `rejeitada`, pela porta, nunca por `legacyClickUpRaw()`.

**Plans**: 22 plans (6 + 9 + 5 + 1 + 1 de fechamento)
Plans:
**Wave 1** — domínio e contrato, em paralelo (repositórios diferentes)

- [x] 06-01-PLAN.md — Domínio: a Conferência do Resumo (tipos, impressão de lançamento, `publicarResumoParaConferencia`, `decideProcessApproval` ramo `resumo`, `registrarLancamentoNoOmie`, `registrarFalhaDoLancamento`, heurística da resposta) (RES-01, RES-02, RES-03)
- [x] 06-02-PLAN.md — `financeiro-tria`: contrato v1.1 aditivo (`pedidoDeRevisao`, `codigoCategoriaConfirmado`, `anexos` com nome), fixtures nos dois lados, `teste:omie-real --anexo` (RES-03, RES-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-03-PLAN.md — A ponte em dois momentos: Resumo → conferência/revisão pelo fio → lançamento com anexos; modos `ensaio`/`conferencia`/`lancar`; cutucão em processo; variáveis de decisão (RES-01..RES-04, RES-06)
- [x] 06-04-PLAN.md — Tela: card "Conferência do Resumo" na conta e na fila, pílula de estado; jornada com `cp-conferida` e `cp-ajuste` (RES-02, RES-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-05-PLAN.md — `financeiro-tria`: S5/S6 na coorte plataforma, pela porta (RES-05)
- [x] 06-06-PLAN.md — Specs e planos atualizados; as provas (jornada em modo `conferencia`, Omie real com anexo) e o que fica com o dono `[BLOCKING]` (RES-06)

**Ondas de execução:** 1 → [06-01, 06-02] · 2 → [06-03, 06-04] · 3 → [06-05, 06-06]

**Fechamento (gap closure, planejado 2026-09-30)** — a verificação (`06-VERIFICATION.md`: "ok no fio" sem gesto na tela) e a revisão de código (`06-REVIEW.md`, `06-REVIEW-FINANCEIRO-TRIA.md`: 7 críticos) abriram a rodada; escopo "tudo" decidido pelo dono; esboço em `06-GAPS-OUTLINE.md`. Execução estritamente sequencial numa árvore só:

- [x] 06-07-PLAN.md — `financeiro-tria`: anexos seguros e honestos no `/lancar` (allowlist `CONTAS_A_PAGAR_ANEXOS_HOSTS`, `https:`, prazo, teto, `jaExistia`, códigos fechados; contrato v1.2) (RES-04)
- [x] 06-08-PLAN.md — `financeiro-tria`: `/resolver` e `/lancar` só aceitam o que é certo (categoria de despesa/folha/ativa, `TITULO_EXISTENTE_DIVERGENTE`, `CONTA_DIVERGENTE`) (RES-03)
- [x] 06-09-PLAN.md — `financeiro-tria`: S5 fora do turno do webhook, idempotente por evento, repetição só do Resumo (RES-05)
- [x] 06-10-PLAN.md — `financeiro-tria`: S5 relê a Solicitação, recusa Centro de Custo sem rota, textos fixos, avisos (RES-05)
- [x] 06-11-PLAN.md — Domínio: Conferência mais estrita (classificador, todas as respostas, sem conferir desatualizada/sem código, tudo ou nada) (RES-02, RES-03)
- [x] 06-12-PLAN.md — Ponte: sem lançar de snapshot velho; os 422 v1.2; anexos v1.2; adota 06-11 (RES-01..RES-04)
- [x] 06-13-PLAN.md — Ponte: timeouts do ciclo, G3 fechado, chave e avisos persistentes, logs, evento/métrica/classificação por `processStep`, cutucadas (RES-01..RES-03)
- [x] 06-14-PLAN.md — Tela: "Responder" no fio, card e fila sem ambiguidade, jornada respondendo no fio (RES-02, RES-06)
- [x] 06-15-PLAN.md — Docs e as provas de novo (jornada respondendo no fio, 0 `/lancar`) `[BLOCKING]` (RES-06)

**Segunda rodada de fechamento (2026-09-30)** — as revisões do código da primeira rodada (`06-REVIEW-2.md`, `06-REVIEW-FINANCEIRO-TRIA-2.md`: um crítico em cada repositório) abriram a rodada; esboço em `06-GAPS-OUTLINE-2.md`; duas trilhas em paralelo (F: financeiro-tria; C: crm-n1):

- [x] 06-16-PLAN.md — `financeiro-tria`: S5 assíncrono sem decisão velha, sem dedup que engole evento, sem varredura em série, sem receipt preso (RES-05)
- [x] 06-17-PLAN.md — `financeiro-tria`: `/lancar` com orçamento desde a entrada, Storage por prefixo, reaproveitado honesto (RES-04)
- [x] 06-18-PLAN.md — Dispensa só enquanto Manual; reaproveitado conferido na ponte; quem confere pelo fio = pelo clique (RES-02, RES-03)
- [x] 06-19-PLAN.md — Marca persistida de lançamento em curso; G3 no meio do ciclo; orçamento de gravações justo (RES-01, RES-03)
- [x] 06-20-PLAN.md — Testes completos e as provas de novo, com a autorização do dono `[BLOCKING]` (RES-03, RES-06)

**Terceira rodada — resíduos de 06-REVIEW-3.md (2026-09-30):** a revisão do
diff 06-18/06-19 achou 1 crítico (remarcar "Integração manual" engole uma
resposta humana pendente) e o resíduo do aviso crm2:WR-05 (log mentindo que
respondeu). Financeiro-tria: 0 críticos nesta rodada (06-REVIEW-FINANCEIRO-TRIA-3.md).

- [x] 06-21-PLAN.md — O crítico (dispensar não engole resposta pendente) e o resíduo do WR-05, mais 3 informativos (RES-02, RES-03)

**Quarta rodada — regressão achada por 06-REVIEW-4.md (2026-09-30):** a
revisão do diff do 06-21 confirmou o Crítico fechado, mas achou um Warning
novo introduzido pelo próprio 06-21 (política de comentário fixa em `true`
trava a dispensa para sempre quando o espaço desliga a conferência por
comentário). 0 Críticos.

- [x] 06-22-PLAN.md — A checagem de resposta pendente respeita a política real de conferência por comentário (RES-02, RES-03)

Decisões desta fase, com padrão e variável de troca, em `06-CONTEXT.md` (D6-01 quando o Resumo aparece; D6-02 "ok" por comentário; D6-03 falha volta a "para pagar"; D6-04 Integração manual; D6-05 contrato aditivo; D6-06 S5/S6; D6-07 conversão continua botão; D6-08 2 dias úteis; D6-09 revisores; D6-10 códigos como dado; D6-11 três modos; D6-12 cutucão; D6-13 sem nº de NF por IA). O dono ainda não respondeu às quatro perguntas de `docs/08-migracao-financeiro/10-levantamento…`; os padrões seguem "do mesmo jeito que está no ClickUp", exceto D6-04 (o seguro).

## Decisões a tomar antes de cada fase

| Antes de | Decisão | Fonte | Recomendação da fonte |
|----------|---------|-------|-----------------------|
| Fim da Phase 1 | OQ-ADR-01 — região do Supabase (`us-west-2` → `sa-east-1`); barata agora, cara depois | ADR | Decisão do dono; o plano segue igual |
| Adapter da Phase 2 | D11 — onde o `apps/api` roda (PERS-08) | Plano §7 | Mesma VPS do `automation/`, nginx existente |
| Phase 2 | D6 (SOL-01), D8 (SOL-08), D9 — devem sair da spec PREP-03 | Plano §7 | Lista própria; clique + classificador 90 dias; remover `aprovado` |
| Phase 2 | OQ-PLAN-01 — divisão ontologia × telas portadas (DEC-16) | Plano §2.4 | "É o ponto a corrigir antes da Fase 2" |
| Phase 2 | OQ-PF-01 (A9) — em nome de quem age a resposta anônima ao formulário | PENDENCIAS-FRONTEND | `form.ownerMemberId` + Ator `sistema` (decisão de ontologia) |
| Phase 2 | OQ-SYN-02 — evento de saída de SOL-07 é a semente do motor? | Síntese | Mínimo na Phase 2, generalizado na Phase 3 |
| Phase 3 | OQ-CP-04 (de-para ERP alcançável), OQ-CP-06 (regra da recorrência), OQ-CMP-03/05 | SPEC contas-a-pagar §12; comparativo | Exportar do Omie ou ditar pelo Financeiro; confirmar antes de codificar A1; Ensaio na primeira semana |
| Phase 4 | D10 — emissão manual de NF; OQ-SYN-01 — caminho autenticado para o `automation/` | Plano §7; síntese | Ação na Tarefa; desenhar junto do adapter |
| Fim da Phase 2 | D12 — mover o `automation/` para o monorepo | Plano §7 (DEC-15) | Reavaliar com o contrato estável |
| Phase 5 | D7/OQ-CR-01, OQ-CR-02..06, CAND-01, CAND-05 | SPEC contas-a-receber §12; comparativo | Perguntar ao Financeiro |

## Progress

**Execution Order:**
Phases execute in numeric order: 0 ∥ 1 → 2 → 3 → 4 → 5 → 6 (0 e 1 em paralelo; inserções decimais entre os inteiros; a 6 depende só da 3 e pode correr antes de 2/4 fecharem)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Preparação | 7/7 | Complete   | 2026-09-17 |
| 1. O CRM N1 ganha persistência e login | 16/16 | Complete   | 2026-09-17 |
| 2. Solicitação de pagamento — o front substitui o ClickUp | 26/28 | In Progress|  |
| 3. Contas a pagar | 15/15 | Complete   | 2026-09-23 |
| 4. As outras telas do financeiro-tria | 13/14 | In Progress|  |
| 5. Contas a receber e os outros tenants | 25/25 | Complete    | 2026-09-25 |
| 6. Conferência do Resumo e anexos | 22/22 | Complete   | 2026-09-30 |
| 7. CRM: Contatos, Empresas, Funis e Negócios (backend e frontend) | 13/13 | Complete   | 2026-10-11 |
| 8. Canais de comunicação: conexão e omnichannel preparado | 15/15 | In Progress |  |

### Phase 7: CRM: Contatos, Empresas, Funis e Negócios (backend e frontend)

**Goal:** Contatos, Empresas, Funis (com Etapas) e Negócios podem ser criados, lidos, editados e excluídos direto pelo frontend. Cobre as três camadas, começando pelo domínio: tipos e regras em `@n1/dominio` (fonte: `ontologia/03-crm`); repositórios e rotas em `apps/api` sobre `apps/api/migracoes/007-crm.sql`, com isolamento por Espaço de Trabalho e acesso por Membro aplicados no backend; e, em `apps/web`, todas as telas, formulários, listas e navegação que ainda não existem (a web fala com a api só por HTTP, nunca importa dela). Fora do escopo: Caixa de Entrada/Conversas/Mensagens e catálogos (Tag, Origem, Motivo de Perda, Qualificação).
**Requirements**: CRM-D1, CRM-A1, CRM-A2, CRM-A3, CRM-W1, CRM-W2, CRM-V1 (critérios derivados em `07-RESEARCH.md` "Phase Requirements"; registrados em REQUIREMENTS.md, Fase 7)
**Depends on:** Phase 1 (persistência e login); independe das fases abertas 2 e 4
**Plans:** 13/13 plans complete

Plans:
**Wave 1** — o traçador
- [x] 07-01-PLAN.md — Traçador: Contato criado pela tela e listado, de ponta a ponta (domínio → api → Postgres → web) (CRM-D1, CRM-A1, CRM-W1, CRM-V1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md — Endurecimento do traçador: Papel (D-14) e Proprietário (D-11) no backend, transação com SQLSTATE, CORS PATCH/PUT/DELETE, cliente HTTP provado (CRM-D1, CRM-A1, CRM-A2, CRM-V1)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md — API de Contatos completa: normalização, Identificadores, ciclo de vida, D-09 e RN-CON-11 (CRM-D1, CRM-A1, CRM-A2)
- [x] 07-04-PLAN.md — API de Funis e Etapas: padrão automático (D-13), administração (D-14), 409 de D-07 com migrar/remapear (CRM-D1, CRM-A1, CRM-A2)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-05-PLAN.md — A 007 corrigida (D-12) e a API de Empresas e vínculos com admin (D-08, RN-EMP-09/10) (CRM-D1, CRM-A1, CRM-A2)
- [x] 07-06-PLAN.md — Telas de Contato religadas e as peças compartilhadas do CRM (CRM-W1)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 07-07-PLAN.md — Telas de Funis e os diálogos de D-07 sobre a api (CRM-W1)
- [x] 07-08-PLAN.md — API de Negócios: mover, ganhar, perder, reabrir (D-05, D-14) (CRM-D1, CRM-A1, CRM-A3)
- [x] 07-09-PLAN.md — Telas de Empresa com o admin no formulário e na ficha (D-08) (CRM-W1)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 07-10-PLAN.md — Quadro de Negócios religado e Novo Negócio (CRM-W2, CRM-W1)

**Wave 7**
- [x] 07-11-PLAN.md — Ficha de Negócio e Negócios nas fichas de Contato/Empresa (CRM-W1, CRM-W2)

**Wave 8**
- [x] 07-12-PLAN.md — `migrar --seco`, e2e do CRM por HTTP, documentação e portão verde (CRM-V1, CRM-A1, CRM-W1)

**Wave 9**
- [x] 07-13-PLAN.md — A 007 no banco da plataforma com a conferência de D-12 (dono) e a UAT `[BLOCKING]` (CRM-V1, CRM-W1, CRM-W2)

**Ondas de execução:** 1 → [07-01] · 2 → [07-02] · 3 → [07-03, 07-04] · 4 → [07-05, 07-06] · 5 → [07-07, 07-08, 07-09] · 6 → [07-10] · 7 → [07-11] · 8 → [07-12] · 9 → [07-13]

### Phase 8: Canais de comunicação: conexão e omnichannel preparado

**Goal:** O campo preparado para o omnichannel, sem integrar nenhum provedor de verdade. Em `apps/web`, uma tela onde o Administrador escolhe qual Canal vai conectar (WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail) e, para cada tipo, uma tela de orientação de como conectar — por enquanto um mockup por tipo, a ser configurado quando a integração chegar. O Espaço de Trabalho pode ter mais de um Canal, inclusive mais de um WhatsApp (um oficial e um não oficial lado a lado). Começa pelo domínio: o Canal ganha o provedor/variante (oficial × não oficial) e o estado de conexão em dois atos (`desconectada` → `conectada`, ontologia 12.2), em vez de nascer `conectada` como hoje (C36). Em `apps/api`, a modelagem relacional de Canal, Conversa e Mensagem no Postgres (migração 008, no padrão da 007), incluindo a Mensagem recebida de cada Canal como será renderizada depois — ids externos do provedor, direção, status de entrega, anexos — e as rotas REST por recurso. No chat (Caixa de Entrada e fio da Conversa), toda Mensagem mostra por qual Canal chegou e quem responde escolhe por qual Canal responde — hoje a aba é por TIPO de Canal, o que não distingue dois WhatsApps. Esquema omnichannel tradicional; nada inventado.
**Requirements**: CXE-D1, CXE-D2, CXE-A1, CXE-A2, CXE-A3, CXE-A4, CXE-W1, CXE-W2, CXE-V1 (critérios derivados em `08-RESEARCH.md` "Phase Requirements"; registrados em REQUIREMENTS.md, Fase 8)
**Depends on:** Phase 7 (Contato e a 007: a Conversa aponta para o Contato relacional); independe das fases abertas 2 e 4
**Plans:** 15/15 plans executed

Plans:
**Wave 1** — o traçador
- [x] 08-01-PLAN.md — Traçador: Canal `desconectada` criado pela página de orientação, gravado na 008, projetado em `GET /estado` e listado com o selo (CXE-D1, CXE-A1, CXE-A2, CXE-A4, CXE-W1, CXE-V1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Capacidades por (tipo, provedor) em todo leitor de janela e modelo (CXE-D2, CXE-D1)
- [x] 08-03-PLAN.md — API do Canal completa: ficha, configuração, conexão em dois atos, arquivar (CXE-A2, CXE-D1)
- [x] 08-04-PLAN.md — A 008 provada (17 invariantes) e Contato com Conversa na Fase 7 (CXE-A1, CXE-A2)
- [x] 08-05-PLAN.md — Domínio do chat: Conversa e Mensagem relacionais e as derivações por Canal (CXE-D1, CXE-W2)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-06-PLAN.md — API de Conversas: abrir com a 1ª Mensagem, resolver, reabrir (CXE-A2, CXE-A3)
- [x] 08-07-PLAN.md — A ponte no `executar()`: operação antiga sobre Canal relacional sem vazar para `registros` (CXE-A4)
- [x] 08-08-PLAN.md — Jornada de conexão: "Conectar Canal", quatro cartões e a orientação completa (CXE-W1)
- [x] 08-09-PLAN.md — Ficha do Canal: Simular conexão, desconectar, arquivar, Fila/Origem por REST (CXE-W1)
- [x] 08-10-PLAN.md — Fio por Canal: abas por Canal, "Responder por", Canal no topo e separador (CXE-W2)
- [x] 08-11-PLAN.md — Lista de Conversas com o nome do Canal e filtro por provedor (CXE-W2)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-12-PLAN.md — API de Mensagens: envio por (tipo, provedor), recebida idempotente, `carga_bruta` (CXE-A3, CXE-A2)

**Wave 5**
- [x] 08-13-PLAN.md — e2e "dois WhatsApps lado a lado" por HTTP e documentos da api (CXE-V1, CXE-A2, CXE-A3, CXE-A4)

**Wave 6**
- [x] 08-14-PLAN.md — A 008 no banco da plataforma: decisão do dono sobre o contrato, `--seco`, aplicação, confirmação (CXE-A1, CXE-V1)

**Wave 7**
- [x] 08-15-PLAN.md — Documentos vivos, portão `npm run check` + `build` e o roteiro da UAT `[BLOCKING]` (CXE-V1, CXE-W1, CXE-W2)

**Ondas de execução:** 1 → [08-01] · 2 → [08-02, 08-03, 08-04, 08-05] · 3 → [08-06, 08-07, 08-08, 08-09, 08-10, 08-11] · 4 → [08-12] · 5 → [08-13] · 6 → [08-14] · 7 → [08-15]

### Phase 9: Segurança dos dados e base de produção

**Goal:** Fechar a segurança dos dados e montar a base de produção antes de qualquer dado real de cliente entrar (WhatsApp não oficial em diante). Sete frentes, na ordem do `docs/09-planejamento/TAREFAS-POR-SESSAO.md`, Sessão 1: (1.1) o recorte de `GET /estado` e da resposta de `POST /operacoes` passa a tirar o que é pessoal de outro Membro (Sessão de Chat, pasta de chat, Memória de Usuário, e-mail de convite, Visão pessoal) e os segredos de link público (`publicShare.secret`, `Form.secret`) de quem não administra a Lista; (1.2) Membro `suspenso` recebe 403 em `POST /operacoes`, o CRM antigo e as duas operações soltas (`restoreList`, `createReceivableSeries`) passam a conferir quem chama, e `packages/dominio/CONTEXT.md` ganha a tabela "Quem pode" cobrindo todo o `REGISTRO`; (1.3) o schema `plataforma` fica fechado para `anon` e `authenticated`, a migração `009` revoga o acesso público, e o `apps/api` conecta como `n1_api` (sem superusuário) com as migrações em `DATABASE_URL_MIGRACAO`; (1.4) cofre de credenciais cifrado (`plataforma.credenciais`, AES-256-GCM, chave fora do banco) para os tokens de provedor das Sessões 4, 7, 8 e 9; (1.5) nenhum log do `apps/api` nem do nginx guarda o segredo que vai na URL das rotas públicas; (1.6) `limit_req` no nginx para `/v1/public/`; (1.7) ambiente de homologação com login e banco próprios, backup diário com restauração testada, monitoramento de erro (Sentry) na api e na web, e o servidor da Evolution API preparado. Três decisões do dono dentro da fase: o que mais o `GET /estado` esconde (1.1.4), como proteger o banco, só fechado ou com RLS (1.3.2), e onde fica o banco de homologação (1.7.1). A 1.3.1 (conferir se `anon` alcança `plataforma` e desligar o cadastro aberto no Supabase) é ação do dono, leva minutos e vale fazer antes de a fase começar. A conferência do projeto Supabase de 22/10 fechou a parte de banco da 1.3.1 (`anon` e `authenticated` sem `USAGE` em `plataforma`, schema não exposto na REST) e deixou pendente o cadastro aberto, o papel `n1_api`, três funções com `search_path` mutável e o bucket público `guias`; detalhes e a proposta de um teste de invasão (tarefa 1.8, a decidir) em `09-NOTAS-DA-CONFERENCIA.md`.
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, SEG-05, SEG-06, SEG-07, SEG-08, SEG-09, SEG-10, SEG-11, SEG-12
**Depends on:** Phase 8 (a `008` já está aplicada e é imutável; a `009` desta fase é a próxima migração). A UAT da Fase 8 segue aberta e não bloqueia o código desta fase, mas o `/gsd-ship` fica bloqueado enquanto `WINDOWS.md` tiver janela aberta
**Plans:** 16/22 plans executed

Plans:
**Wave 1** — o traçador
- [x] 09-01-PLAN.md — Traçador: a Sessão de Chat de um Membro não chega a outro (domínio → `GET /estado` → tela), depois do commit da ponte `usuarios:criar` do dono (SEG-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md — Domínio: o recorte completo (Memória, convite, Visão pessoal, segredos de link, Convidado sem IA, Arquivo órfão, `recortarDiferenca`/`recortarValor`) (SEG-01, SEG-02)
- [x] 09-03-PLAN.md — Domínio: escritas com conferência no CRM antigo, `restoreList` e `createReceivableSeries` (SEG-03)
- [x] 09-04-PLAN.md — Banco fechado: a `009`, `n1_api`, `DATABASE_URL_MIGRACAO` e `banco:conceder`, provados em Postgres local (SEG-04, SEG-05)
- [x] 09-05-PLAN.md — Logs do `apps/api` sem segredo (`mascararSegredoDeUrl` no domínio) (SEG-06)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-06-PLAN.md — nginx: `limit_req` por IP no POST, teto próprio do GET, máscara nos logs, provado em Docker; `TRUST_PROXY` (SEG-06, SEG-07)
- [x] 09-07-PLAN.md — api: resposta de `POST /operacoes` recortada (incl. `value` e `inviteMember`), 403 do suspenso, teste de vazamento completo (SEG-01, SEG-03)
- [x] 09-08-PLAN.md — Web: link público sem segredo, IA fora do trilho do Convidado e `/ia/*` "sem acesso" (SEG-01, SEG-02)
- [x] 09-09-PLAN.md — Tabela "Quem pode" das 286 operações e o teste que a cobra (SEG-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 09-10-PLAN.md — Cofre de credenciais AES-256-GCM (SEG-05)
- [x] 09-11-PLAN.md — Homologação no repositório: scripts por `AMBIENTE`, usuário `n1crm-hml`, job `homologacao` (SEG-08)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 09-12-PLAN.md — Suíte adversarial 1: inventário de rotas, matriz de Papéis, suspenso nas rotas REST, job `seguranca` do CI (SEG-12, SEG-03)
- [x] 09-13-PLAN.md — Sentry na api, depois do portão de legitimidade dos pacotes (SEG-10)
- [x] 09-14-PLAN.md — Backup cifrado e restauração provados em Docker; arquivos da Evolution API (SEG-09, SEG-11)
- [ ] 09-17-PLAN.md — Homologação no ar e a `009`/`n1_api` provados nela `[BLOCKING]` (SEG-08, SEG-04) — **PULADO por decisão do dono em 2026-10-23, não executado** (ver `09-17-SUMMARY.md`)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 09-15-PLAN.md — Suíte adversarial 2: outro Membro e outro Espaço, anexos, segredos, XFF, entrada hostil (SEG-12, SEG-01)
- [x] 09-16-PLAN.md — Sentry na web pelo arquivo de instrumentação do Next 16 (SEG-10)
- [ ] 09-18-PLAN.md — Backup ligado na VPS e restauração provada no Mac do dono `[BLOCKING]` (SEG-09) — **PULADO por decisão do dono em 2026-10-27, não executado** (ver `09-18-SUMMARY.md`)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 09-19-PLAN.md — Alerta do Sentry provado em homologação e Evolution API no ar `[BLOCKING]` (SEG-10, SEG-11) — **prova do alerta em BACKLOG por decisão do dono em 2026-10-28; Evolution API ainda aberta, não pulada** (ver `09-19-SUMMARY.md`)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 09-20-PLAN.md — Produção: `n1_api`, merge, `009` aplicada, app como `n1_api`, nginx da VPS, ações do Auth `[BLOCKING]` (SEG-04, SEG-06, SEG-07) — **executado em 2026-10-28**: `n1_api`, merge, `009`, nginx e cadastro aberto desligado, todos provados contra produção; duas tarefas administrativas (conector do claude.ai, `.env` local) ficam com o dono (ver `09-20-SUMMARY.md`)
- [x] 09-21-PLAN.md — Teste de invasão exploratório em homologação com autorização do dono, `09-PENTEST.md` (SEG-12) — **executado em 2026-10-28 com desvio da D-16** (sem VPS/Vercel de homologação, que o 09-17 não entregou): passada contra a `apps/api` no Mac ligada ao banco e Auth reais de homologação (ver `09-21-SUMMARY.md`)

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 09-22-PLAN.md — Rota de prova removida, documentos vivos e portão final (SEG-10, SEG-12)

**Ondas de execução:** 1 → [09-01] · 2 → [09-02, 09-03, 09-04, 09-05] · 3 → [09-06, 09-07, 09-08, 09-09] · 4 → [09-10, 09-11] · 5 → [09-12, 09-13, 09-14, 09-17] · 6 → [09-15, 09-16, 09-18] · 7 → [09-19] · 8 → [09-20, 09-21] · 9 → [09-22]

### Phase 10: Clone ClickUp: Contêineres (Espaço, Pasta e Lista)

**Goal:** Fechar a Estrutura de Trabalho no nível dos contêineres: telas sem peça de protótipo, mover e reordenar Pasta e Lista, a Carga fora e as lacunas do modelo de herança. Sessão 2 do cronograma, parte A, dividida em três fases por decisão do dono em 2026-10-28 (as Fases 11 e 12 são as outras partes). Fonte: `docs/09-planejamento/TAREFAS-POR-SESSAO.md`, Sessão 2, linhas 405–779 (os números de linha do código citados lá deslocaram com a Fase 9: procurar de novo antes de planejar).
**Entra (23 subtarefas):** 2.1.1–2.1.10 limpar a UI · 2.3.1–2.3.3 mover e reordenar · 2.5.1–2.5.5 remover a Carga · 2.6.1–2.6.5 Visualizações padrão do Espaço, tirar o bloqueio da Lista, operação de bloquear aspecto.
**Decisões do dono antes de planejar:** 2.1.2 (o que roda a recorrência sem o botão), 2.1.7 (manter Lista e Tabela), 2.5.5 (capacidade semanal do Membro).
**Ordem interna:** domínio e migração antes da tela; a `010` junta 2.5.3 e 2.6.3 (a próxima migração depois da `009`); na página da Lista, 2.1.6 → 2.5.4 → 2.6.2 em sequência; 2.1.8 (Configurações em abas) antes de 2.6.2 e 2.6.5. A 2.1.10 toca `tarefa-completa.tsx`, a única ponta compartilhada com a Fase 11.
**Itens da 2.7** (relatados nos testes) que mexam em Espaço, Pasta, Lista ou nas Configurações entram aqui, um por subtarefa.
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05, EST-06, EST-07, EST-08, EST-09, EST-10, EST-11 (derivados em `10-CONTEXT.md` "Requisitos derivados"; registrados em REQUIREMENTS.md, Fase 10)
**Depends on:** Phase 9
**Plans:** 13/21 plans executed

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Visualizações padrão no domínio (`setContainerDefaultViews`) e `saveView` sem tipo indisponível (EST-08, EST-11)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-20-PLAN.md — A Lista sem `blocks` e sem o modo de bloqueio, com as limpezas que o `tsc` aponta (EST-09)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-02-PLAN.md — Bloqueio de aspecto no domínio: `setContainerBlock`, `sobrescritasAbaixo`, `criarAutomacao` sob bloqueio (EST-10, EST-11)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-03-PLAN.md — `moveContainer` traçador: cadeia de registro, recusas básicas, Conjunto que muda, B37 e o laço de `moveTask` compartilhado (EST-05, EST-11)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-04-PLAN.md — `reorderContainers` por fatia (desvio declarado do D-08), ordem estável, prova pela API e suíte de segurança (EST-05, EST-06, EST-11)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 10-18-PLAN.md — `moveContainer` expansão: profundidade, bloqueio, colisão, Formulário, estruturas fixas, L2 e `order` nas criações (EST-05)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 10-05-PLAN.md — O relógio gera a recorrência: catálogo, ator e regime por Lista, volta que drena (EST-01)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 10-06-PLAN.md — Página da Lista limpa e abaixo de 1.000 linhas: `SelecaoEmLote`, frases fora, extrações (EST-02)
- [x] 10-08-PLAN.md — Configurações em abas com `?aba=` e a linha de origem (EST-03)
- [x] 10-14-PLAN.md — Os 13 códigos de regra fora dos textos e o teste de varredura (EST-04)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 10-07-PLAN.md — A Carga fora, de ponta a ponta (EST-07)
- [x] 10-09-PLAN.md — Página do Espaço no formato da Pasta (EST-03)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 10-10-PLAN.md — Visualizações padrão na Lista e nas Configurações; salvas somem e voltam (EST-08)
- [ ] 10-21-PLAN.md — A capacidade semanal do Membro fora; contagem final 289 (EST-07, EST-11)

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 10-11-PLAN.md — Interruptor "Bloquear para os níveis abaixo" (EST-10)
- [ ] 10-12-PLAN.md — Diálogo "Mover para…" e o item na árvore e na Lista (EST-06)

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 10-19-PLAN.md — Subir/Descer, a árvore e a Pasta por `order`, "Mais ações" da Pasta (EST-06)

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 10-13-PLAN.md — Arrastar na árvore com HTML5 nativo (EST-06)

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 10-15-PLAN.md — Prévia do relógio, decisão Q3 da lixeira `[BLOCKING]` e a ponte com os três relógios (EST-01)

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 10-16-PLAN.md — D-04 `[BLOCKING]`: agendador em produção (merge A), Q1, e só então o botão sai (EST-01, EST-02)

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 10-17-PLAN.md — A `010` ensaiada, aplicada em produção após `--seco` `[BLOCKING]` (merge B), a lista da UAT e o fechamento da fase (EST-11)

**Ondas de execução:** 1 → [10-01] · 2 → [10-20] · 3 → [10-02] · 4 → [10-03] · 5 → [10-04] · 6 → [10-18] · 7 → [10-05] · 8 → [10-06, 10-08, 10-14] · 9 → [10-07, 10-09] · 10 → [10-10, 10-21] · 11 → [10-11, 10-12] · 12 → [10-19] · 13 → [10-13] · 14 → [10-15] · 15 → [10-16] · 16 → [10-17]

### Phase 11: Clone ClickUp: Tarefa (checklist, descrição e tempo)

**Goal:** Converter item do checklist em Subtarefa sem susto e fechar as lacunas da Tarefa: menção na descrição, histórico com o texto anterior e tempo registrado calculado no domínio. Sessão 2 do cronograma, parte B. Fonte: `docs/09-planejamento/TAREFAS-POR-SESSAO.md`, Sessão 2, tarefas 2.4 e 2.6.6–2.6.9.
**Entra (9 subtarefas):** 2.4.1–2.4.5 converter checklist · 2.6.6–2.6.9 menção na descrição, texto anterior no histórico, tempo registrado.
**Decisões do dono antes de planejar:** 2.4.3 (confirmação por nome digitado), 2.4.4 (subitens de checklist), 2.4.5 (converter pelo cartão do Quadro), 2.6.7 (menção na descrição avisa a pessoa).
**Independência:** não depende da Fase 10 (`tasks.ts` e `tarefa-completa.tsx` contra `structure.ts`, `configuration.ts` e as páginas de contêiner). Fica depois dela só porque o GSD daqui executa uma fase por vez; a 2.1.10 da Fase 10 já passa por `tarefa-completa.tsx`.
**Itens da 2.7** que mexam na Tarefa entram aqui.
**Requirements**: TBD — definidos no `/gsd-discuss-phase 11`
**Depends on:** Phase 9
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 11 to break down)

### Phase 12: Clone ClickUp: gravação mais rápida

**Goal:** Medir quanto leva uma gravação (hoje cada uma hidrata o Espaço de Trabalho inteiro e disputa uma revisão única) e cortar o custo onde ele está. Sessão 2 do cronograma, parte C. Fonte: `docs/09-planejamento/TAREFAS-POR-SESSAO.md`, Sessão 2, tarefa 2.2.
**Começa por medir:** 2.2.1 (instrumentar `executar()` e rodar em produção os quatro gestos) vem antes de qualquer plano; a decisão 2.2.2 depende desses números e as três saídas são projetos diferentes.
**Caminhos da 2.2.2:** (B) ficar em `plataforma.registros`, travar no começo, encadear as chamadas e mostrar a mudança na hora: 2.2.3, 2.2.4, 2.2.5 e 2.2.10, cerca de 2 dias, e é a recomendação · (A) tabelas próprias de Espaço, Pasta e Lista: 2.2.6–2.2.9, 4 a 5 dias; se for a escolhida, esta fase passa a ir antes da Fase 10, porque a `010` mexe nas linhas de Lista de `plataforma.registros` · (C) tabelas para a Estrutura inteira: sessão própria, fora daqui (8 a 10 dias; só se `hidratar` passar de 300 ms na mediana).
**Requirements**: TBD — definidos no `/gsd-discuss-phase 12`
**Depends on:** Phase 9 (medir exige o `apps/api` em produção, entregue no 09-20)
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 12 to break down)

---
*Roadmap created: 2026-09-15 a partir de `.planning/intel/` (ingest de 9 documentos, 0 blockers) e `.planning/codebase/`*
