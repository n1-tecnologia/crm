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
- [ ] **Phase 3: Contas a pagar** - O Financeiro opera uma semana sem abrir o ClickUp: importação com histórico, motor de Automações executando A1–A9, Agente lançando no Omie de verdade, lote e permissões
- [ ] **Phase 4: As outras telas do financeiro-tria** - As leituras que nunca viveram no ClickUp portadas como tela; `financeiro-tria.vercel.app` sai do ar
- [ ] **Phase 5: Contas a receber e os outros tenants** - Marcos Paulo e Family Office como Empresas do Campo `Empresa`; Contas a receber na forma que D7 determinar; notificar por Canal

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
  5. As 1.110 solicitações históricas aparecem como Tarefas fechadas, com `comentario` como Comentário do RESUMO, `TaskID` apontando para a Tarefa da plataforma, `origem` preenchida e nenhuma credencial copiada.

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
- [ ] 02-15-PLAN.md — Topologia e região: decisão de `sa-east-1` (D-23), nginx/TLS na VPS (D-15/D11), CA do Postgres fixada e latência medida

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
- [ ] 02-25-PLAN.md — Importação: CLI dry-run/apply/resume, anexos históricos, manifesto sanitizado e execução real (SOL-09, D-25/D-26)

**Wave 7** *(blocked on Wave 6)*

- [ ] 02-26-PLAN.md — Contract tests nos dois repositórios + E2E entre processos + matriz de falhas injetadas

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
- [ ] 03-09-PLAN.md — `importarContaAPagarHistorica`: Tarefa já no status final, um `recordActivity` por transição com o `at` original, **sem nunca chamar `changeTaskStatus`** — nenhuma Automação dispara no replay (PAG-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-05-PLAN.md — A Pessoa da conta enxerga a própria Tarefa por visibilidade **derivada** do Campo Pessoa (`sharedWithDefinitionIds` + `memberNamedOnTask`), não por Grant escrita à mão; caso negativo provado nos dois sentidos (PAG-06)
- [ ] 03-06-PLAN.md — D3-08: a Solicitação aprovada vira Conta a pagar por `converterSolicitacaoEmContaAPagar`, com Vínculo `task→task` e `provenance` — sem Status `convertida` novo (PAG-01)
- [ ] 03-07-PLAN.md — `financeiro-tria/automation`: superfície nova `/v1/integrations/contas-a-pagar/{resolver,lancar}` que só calcula e lança, **nunca escreve status em Lista nenhuma** (PAG-03, PAG-04)
- [ ] 03-08-PLAN.md — `scheduler-worker.ts`: o relógio que faltava ao motor, com catch-up provado (a agenda não pula o dia se o processo cair) e a primeira volta em ensaio até liberação explícita (AUTO-01, PAG-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-10-PLAN.md — CLI de importação da Lista `901107637383` em lotes de 250, ledger `003` reusado, `MARCO_ZERO` gravado ao fim, e a corrida real `[BLOCKING]` provando que a segunda execução é no-op (PAG-01)
- [ ] 03-11-PLAN.md — A ponte HTTP de A7/A8: de-para resolvido **antes** da transação, Ensaio que falha para o lado seguro em três camadas, e a metade `CNPJ_POR_EMPRESA` de PAG-04 (PAG-03, PAG-04)
- [ ] 03-12-PLAN.md — `alterarStatusEmLote` numa transação só (61 < 250), com `RelatorioDeLote` de quatro resultados por item e o tempo de lock medido contra DEC-06 (PAG-05)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 03-13-PLAN.md — A tela do lote: liga o gesto que já existe a uma chamada só (hoje é um laço de 61 `POST` concorrentes), renderiza a falha parcial, e põe o botão da conversão D3-08 no card de Aprovação (PAG-05)
- [ ] 03-15-PLAN.md — A metade de tela de PAG-06: re-chaveia `SharedTasks` em `memberSeesTask` (o 03-05 apaga as Grants em que ela se apoia hoje) e fecha duas telas que listam Tarefa sem filtro de visibilidade nenhum (PAG-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 03-14-PLAN.md — Relatório do Ensaio × lançamento humano com `LIMIAR_DA_CANETA` declarado antes dos dados, e o runbook de corte em 11 passos terminando no arquivamento da Lista (PAG-03)

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

**Plans**: TBD
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

**Plans**: TBD

Antes de planejar: D7/OQ-CR-01 (perguntar ao Financeiro onde o recebimento é controlado hoje) decide o formato de REC-01; CAND-01 (uma Integração por Empresa) e CAND-05 (leituras conservadoras de C34) precisam ser confirmadas ou revistas; OQ-CR-02..06 e OQ-CMP-02 têm dono aqui.

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
Phases execute in numeric order: 0 ∥ 1 → 2 → 3 → 4 → 5 (0 e 1 em paralelo; inserções decimais entre os inteiros)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Preparação | 7/7 | Complete   | 2026-09-17 |
| 1. O CRM N1 ganha persistência e login | 16/16 | Complete   | 2026-09-17 |
| 2. Solicitação de pagamento — o front substitui o ClickUp | 23/28 | In Progress|  |
| 3. Contas a pagar | 4/15 | In Progress|  |
| 4. As outras telas do financeiro-tria | 0/TBD | Not started | - |
| 5. Contas a receber e os outros tenants | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-15 a partir de `.planning/intel/` (ingest de 9 documentos, 0 blockers) e `.planning/codebase/`*
