# Requirements: Plataforma N1 Digital

**Defined:** 2026-09-15
**Core Value:** Um solicitante cria o pedido no CRM N1 e o Financeiro opera Contas a pagar de ponta a ponta sem abrir o ClickUp — dados no Postgres próprio, regras de `@n1/dominio` intactas.

**Proveniência.** Não há PRD. Os 35 requisitos vêm dos entregáveis por fase do SPEC `docs/08-migracao-financeiro/03-plano-de-migracao.md` (Fases 0–5 e peças transversais do §4), com aceite vindo dos "Pronto quando" (CON-12) e dos SPECs de processo (`docs/07-processos/`). Dois vêm de DOC e estão marcados (prioridade a confirmar). Onde não há aceite escrito, a entrada diz "aceite: não especificado" — o planejador da fase não deve inventar.

**Status verificado contra o código em 2026-09-15** (`.planning/intel/requirements.md`), não contra o que os documentos dizem: `feito` (4, marcados `[x]`) · `sobreposto` (1) · `em andamento` (4 — existem no protótipo em memória) · `bloqueado por decisão` (4) · `pendente` (22). Os IDs `REQ-…` entre parênteses são os da intel, para rastreio.

**Fase 0 fechada em 2026-09-17** (Plan 00-07): `feito` (7, marcados `[x]` — PREP-01/02/03/04/06 e PERS-01/02) · `risco aceito pelo dono` (1 — PREP-05, D-13) · `sobreposto` (1) · `em andamento` (4) · `bloqueado por decisão` (4) · `pendente` (18). Ver Coverage no fim deste arquivo para a contagem atualizada.

## v1 Requirements

### Fase 0 — Preparação (PREP)

- [x] **PREP-01**: Schema `plataforma` criado, vazio, sem tocar nas 26 tabelas do `public` (`REQ-f0-schema-plataforma`). Aceite: schema existe; `npm run migrar` aplica `001-plataforma.sql`. **Feito** no projeto próprio `epomplsskqpluxuujpxl` (DEC-08) — `apps/api/migracoes/001-plataforma.sql`, commit `b20597d`.
- [x] **PREP-02**: Exportação completa das Listas `901109104938` (Solicitação), `901107637383` (Contas a pagar) e `901107648977` (Contas a receber): Tarefas, Campos, Comentários, histórico de status, anexos, com paginação (`REQ-f0-exportacao-clickup`). Aceite: é o insumo da importação e a prova de paridade depois (CON-09). **Feito** — Plans 00-01/00-03/00-04/00-05 (`apps/api/src/importacao/clickup/`, `apps/api/exportacoes/MANIFESTO.md`/`.json`, commit `7df69cc`): 3.118 Tarefas, 4.412 Comentários, 3.120 `time_in_status`, 1.595 anexos, 11.001 arquivos/504 MB fora do git. Ressalva: "histórico de status" entregue como `time_in_status` (tempo acumulado por status) + Comentários datados — a API do ClickUp não expõe histórico cronológico de transições.
- [x] **PREP-03**: Escrever `docs/07-processos/solicitacao-de-pagamento.md` lendo a Lista real `901109104938`, no padrão de `contas-a-pagar.md` (`REQ-f0-spec-solicitacao-de-pagamento`). **A lacuna mais séria do levantamento e o maior risco do plano** — o processo foi reconstruído pelo código, que mostra o que está automatizado, não o que as pessoas fazem. Aceite: spec com Status, Campos, papéis, fluxo, automações, permissões e regras, lida da Lista real, que responda D6 e D8 (ou os deixe explicitamente abertos) e absorva OQ-CMP-01/02/04. Pré-requisito de toda a Fase 2. **Feito** — Plan 00-06 (`docs/07-processos/solicitacao-de-pagamento.md`, commits `f0311ac`/`f095369`): §1–§12, D6/D8 fechados, OQ-CMP-01/02/04 absorvidos; L-01, L-03, L-07, L-09, L-11 devolvidos ao dono em §12 antes/durante o planejamento da Fase 2.
- [x] **PREP-04**: De-para dos 6 IDs de usuário do ClickUp → Membros (CON-11: Elifas `81591229`, Fabíola `81581798`, Thiago `81581826`, Iallas `81582295`, Financeiro `81581816`, revisor FO `81581802`), ampliado às 38 variáveis `CLICKUP_*` (`REQ-f0-de-para-usuarios-clickup`). Aceite: não especificado além da tabela. Usado pelas importações das Fases 2 e 3. **Feito** — Plan 00-02 (`apps/api/src/importacao/clickup/de-para-usuarios.ts`, commits `3daa954`/`a7cc636`): 6 entradas + catálogo de 62 variáveis `CLICKUP_*`/`MP_CLICKUP_*`/`FO_CLICKUP_*`. Ressalva: 5/6 e-mails resolvidos pela API real; o revisor FO (`81581802`) fica com `fonteDoEmail: "nao-resolvido"` e `email: ""` — `inviteMember` recusa e-mail vazio, então esta entrada não convida Membro até o dono informar o e-mail real. Não bloqueia o fechamento de PREP-04 (o aceite era "não especificado além da tabela", e a tabela existe, tipada e testada); bloqueia só o uso desta entrada específica na importação (Fase 2/3).
- [x] **PREP-05**: **Retirado — risco aceito pelo dono em 2026-09-16 (D-13, `00-CONTEXT.md`).** As credenciais Omie do Marcos Paulo (hardcoded em `tenants/marcos-paulo/config.ts`, no histórico do git do financeiro-tria, e por linha em `solicitacoes_pagamentos`/`transacoes`) continuam em uso por decisão do dono; não há rotação nesta fase nem fase definida para ela (ver Deferred em `00-CONTEXT.md`). CON-10 continua valendo para o que a plataforma cria: credencial só na Integração, nunca por linha, nunca copiada na importação. Critério 4 da Fase 0 no ROADMAP: risco aceito — o verificador não deve cobrá-lo. (`REQ-f0-rotacao-credenciais-omie`)
- [x] **PREP-06**: Medir o volume das tabelas legadas (`REQ-f0-contagem-linhas-legado`). **Feito** 2026-09-15: maior tabela 9.510 linhas; `solicitacoes_pagamentos` 1.110; risco "volume desconhecido" fechado; subproduto CAND-03.

### Fase 1 — O CRM N1 ganha persistência e login (PERS)

Critério de pronto (CON-12 Fase 1, refinado por DEC-09): um Membro real cria uma Conta pela tela, ela está no Postgres, `npm run check` verde nos três workspaces; a prova hidratado ≡ seed vale pelos 214 testes. ClickUp e `automation/` intocados.

- [x] **PERS-01**: Repositórios + Unidade de Trabalho: carrega o `DataState` do Espaço de Trabalho, roda a operação pura sem alterá-la, grava o diff com revisão otimista; preserva `packages/dominio` e os 214 testes (`REQ-f1-persistencia-unidade-de-trabalho`). Aceite: os quatro testes de `persistencia.test.ts` (hidratado `toStrictEqual` ao seed; operação grava só o que tocou; recusa grava nada; estado 10×) contra Postgres local e Supabase. **Feito** — DEC-01..07, DEC-09, DEC-10; `apps/api/src/persistencia/` (`conexao.ts`, `migrar.ts`, `repositorio.ts`, `unidade-de-trabalho.ts`), `packages/dominio/src/colecoes.ts`; commits `9fb2754`, `3fd7e1b`, `b20597d`.
- [x] **PERS-02**: `/entrar` autentica (Supabase Auth, e-mail e senha) em vez de escolher Membro; Membro resolvido pelo Usuário (`Member.userId === usuario.id`), nunca escolhido; "Trocar de Membro" vira "Sair"; Membro `removido`/`pendente` ou inexistente vê "Sem acesso" (`REQ-f1-supabase-auth`). Aceite (verificado no dev server): redirecionamento sem sessão; rota pública aberta; Membro vendo a própria conta no HTML do servidor; Membro removido barrado; senha errada recusada; `/sair` apaga a sessão. **Feito** — commit `d713253`; `apps/web/src/autenticacao/`, `apps/web/src/proxy.ts`, `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` (`npm run usuarios:seed`). Subprodutos: `StoreProvider` por árvore; `(publico)` com `PublicoProvider` (abriu OQ-PF-01).
- [x] **PERS-04**: `apps/api` servindo o domínio — uma rota HTTP por operação dos 16 módulos de `packages/dominio/src/operations`, `POST /operacoes/:nome` (CON-02), cada rota executando a operação dentro da Unidade de Trabalho (hidratar → operação → diff → revisão), com o Membro atuante vindo da sessão autenticada (`REQ-f1-rotas-por-operacao`). Aceite: não especificado além de CON-02 e do critério da fase; regra fixa: a rota não reimplementa regra de negócio. **Feito** — `POST /operacoes/:nome` (despacho por `OPERACOES`, Plan 01-04) mais CR-02 fechado por inteiro: `ESQUEMAS` cobre as 132 operações sob `satisfies EsquemasCompletos` (Plans 01-11..01-16), sem fallback estrutural, `TypeError → 400` removido da rota (WR-11). `npm run check` verde nos três workspaces.
- [x] **PERS-05**: `apps/web/src/dados/store.ts` troca `run(op)` local sobre `buildProductSeed()` por `POST /operacoes/:nome` e hidrata o `DataState` do backend (`REQ-f1-store-post`). Aceite: a API pública do store (`useData`, `useSession`, `useRun`…) não muda — "os cem arquivos que a consomem não sabem de onde o store vem"; recarregar a página mantém o que foi criado. **Feito** — `store.ts` hidrata de `carregarEstadoInicial()`/`GET /estado` e grava por `transporteHttp()`/`POST /operacoes/:nome`; `run()` híbrido (D-05/D-06); `buildProductSeed()` só sobrevive em `PublicoProvider` (OQ-PF-01); Plan 01-07 (`4d40526`, `94ba111`, `dd27d53`). O critério "recarregar a página mantém o que foi criado" fica provável apenas depois de PERS-04 (`apps/api` respondendo de verdade) — código do lado do cliente já está pronto.
- [x] **PERS-06**: `seed-financeiro.ts` (e `seed-contas-a-receber.ts`) viram script de bootstrap do Espaço "Gestão" › Pasta "Financeiro" › Listas, Campos, Status, Tags, Papéis — **sem as Tarefas fictícias** (`REQ-f1-bootstrap-espaco-gestao`). Contas a pagar conforme CON-CP-01..04 e CON-CP-09; Contas a receber conforme CON-CR-01..03, CON-CR-05, CON-CR-07, CON-CR-08. Aceite: não especificado além do critério da fase. Decisões que tocam: CAND-02 (só a data nativa), OQ-CP-03 (não replicar `Equipe`/`Produto`), D9 (status `aprovado`). Pendente.
- [x] **PERS-07**: Colunas geradas (`generated always as (dados->>'…') stored`) e índices em `plataforma.registros` para o que a tela de Contas a pagar filtra — Tarefa primeiro: status, Lista, vencimento, Tag `conta *`, Responsável, Pessoa (`REQ-f1-colunas-geradas-indices`). Aceite: não especificado (o ADR dá o padrão SQL, não a lista de colunas). Escopo: migração `002-*.sql`. Pendente. Substitui a parte "colunas tipadas para o que se filtra" de PERS-03.
- [ ] **PERS-08**: Definir e executar onde o `apps/api` roda (`REQ-f1-deploy-apps-api`). Recomendação do plano: a mesma VPS do `automation/`, na nginx existente; o ADR lembra que a latência medida é de um notebook no Brasil a Oregon. Aceite: não especificado. **Bloqueado por D11** (interage com OQ-ADR-01, região do Supabase). Não bloqueia o código da fase; bloqueia o adapter da Fase 2 apontar para o `apps/api`.
- [x] **PERS-09**: RN-ET-11 — reconvidar um Usuário removido reativa o mesmo Membro; hoje `inviteMember` só casa por `invitedIdentity`, que some quando o Membro aceita (B27), quebrando INV-ET-04 (`REQ-f1-reconvite-por-usuario`). Derivado de DOC (`PENDENCIAS-FRONTEND.md` P2) — prioridade a confirmar. Aceite: não especificado. Escopo: `packages/dominio/src/operations/members.ts` + identidade de Usuário (Supabase Auth). Pendente — a pré-condição (Usuário real) agora existe.

#### Sobreposto por decisão travada (não executar; fica para rastreio)

- **PERS-03**: Uma tabela por entidade que o Financeiro toca, colunas tipadas para o que se filtra, `jsonb` para objetos de valor (`REQ-f1-tabelas-schema-plataforma`). **Sobreposto por DEC-02** (ADR > SPEC): tabela genérica `plataforma.registros` + `plataforma.workspaces`; a parte "colunas para o que se filtra" virou PERS-07. Ver `INGEST-CONFLICTS.md` INFO-02.

### Fase 2 — Solicitação de pagamento: o front substitui o ClickUp (SOL)

Pré-requisito: PREP-03. Critério de pronto: CON-12 Fase 2. Decisões abertas que a moldam: D6, D8, D9; OQ-PF-01 (A9) afeta o formulário; OQ-PLAN-01 é o ponto de revisão antes de começar.

- [ ] **SOL-01**: Lista "Solicitações de pagamento" na ontologia, com os Status de CON-04 (`recebida → em validação → aguardando aprovação → aprovada / não aprovada / em revisão → convertida`) e os Campos que o mapper já lê (`01-inventario` §4.3) (`REQ-f2-lista-solicitacoes`). Aceite: CON-04. **Bloqueado por D6** (Lista própria — recomendação — ou Status iniciais na Lista de Contas).
- [ ] **SOL-02**: Formulário de solicitação — substitui o formulário de Tarefa do ClickUp; "é por onde o pedido entra" (`REQ-f2-formulario-solicitacao`). Aceite: não especificado (depende da spec PREP-03). O protótipo já tem rotas públicas de Formulário (`/f/<segredo>`); OQ-PF-01 (em nome de quem age uma resposta anônima) afeta diretamente. Pendente.
- [ ] **SOL-03**: Tela de aprovação — a decisão vira Solicitação de Aprovação (B80): um clique, não um texto classificado por IA; substitui responder no thread do comentário (`REQ-f2-tela-aprovacao`). Aceite: não especificado; a regra de roteamento do aprovador (`APPROVAL_ROUTES` por centro de custo e valor, R$ 5.000 como corte) precisa existir na plataforma — "quatro Membros e uma regra de roteamento". Pendente.
- [ ] **SOL-04**: Timeline da solicitação: Comentários + Registros de Atividade — substitui a aba de comentários do ClickUp (`REQ-f2-timeline-solicitacao`). Aceite: não especificado. Pendente.
- [x] **SOL-05**: `adapters/plataforma.ts` no `automation/`: os 7 métodos (CON-01) contra o `apps/api` por HTTP (DEC-14); degrada enfileirando (CON-06); `clickup.ts` fica, desligado por env (`REQ-f2-adapter-plataforma`). Aceite: pipeline sem webhook do ClickUp; Omie recebe o mesmo `IncluirContaPagar`. Escopo: repositório `financeiro-tria`. Requer o contrato request/response dos 7 métodos escrito (CONCERNS.md) e tipos que não derivem (CON-13). Pendente — risco baixo, tamanho P.
- [x] **SOL-06**: `plataforma-payment-mapper.ts` substitui ~400 linhas de parsing do ClickUp por ~50 de leitura tipada de `fieldValues` — "a troca apaga código, não acrescenta"; não portar três vezes (`REQ-f2-mapper-plataforma`). Aceite: não especificado. Escopo: `financeiro-tria`. Pendente.
- [ ] **SOL-07**: `POST /webhooks/plataforma/solicitacao-criada` (CON-03), disparado pelo `apps/api` quando a Tarefa de Solicitação nasce — nova entrada do pipeline (`REQ-f2-endpoint-solicitacao-criada`). Aceite: não especificado. Escopo: `apps/api` (disparo) + `automation/` (recepção). Requer no `apps/api` um mecanismo de evento de saída, hoje inexistente — decidir se é a mesma peça do motor de Automações (OQ-SYN-02). Pendente.
- [ ] **SOL-08**: Classificador de comentário como fallback por 90 dias — quem responder por comentário em vez de clicar continua atendido (`REQ-f2-classificador-fallback`). **Bloqueado por D8** (recomendação: as duas, medir depois).
- [x] **SOL-09**: Importar `solicitacoes_pagamentos` (1.110 linhas): histórico vira Tarefas fechadas; `comentario` vira o Comentário do RESUMO; credenciais descartadas; `TaskID` + `origem` (CON-08, DEC-17) (`REQ-f2-importacao-solicitacoes`). **Feito** 2026-09-25 (Plan 02-25, run `957a5fdf`): 1.114 linhas = 843 Solicitações distintas; 245 completas importadas, idempotente, outbox intocado; sem Valor/CPF/CNPJ/data de criação (não existem como coluna na origem — D-25).

### Fase 3 — Contas a pagar (PAG)

"A parte mais barata, porque a tela já existe." Critério de pronto: CON-12 Fase 3 — o Financeiro opera uma semana sem abrir o ClickUp. Depende do motor de Automações (AUTO-01), colocado nesta fase.

- [x] **PAG-01**: Importar a Lista `901107637383` com `date_created`, `date_closed` e histórico de status como Registros de Atividade com a data original (CON-09, CON-CP-12); campo `L` copiado para a Data de vencimento nativa (CAND-02); de-para de usuários (PREP-04) (`REQ-f3-importacao-contas-a-pagar`). Aceite: "tempo em `para pagar`" preservado como métrica (29–31 dias é o ciclo normal); paginação (>200 ativas + histórico). Pendente.
- [x] **PAG-02**: A1–A9 rodando no motor de Automações (CON-CP-06): recorrência ao entrar em `pago` com dia útil anterior (A1, CON-CP-05, OQ-CP-06), data de fechamento e Responsável (A2), troca de Responsável (A3/A4), cobrança de nota D-5/D-2 com Menção à Pessoa (A5/A6 — a única mudança de comportamento proposta), invocação do Agente D-1 (A7/A8), Observadores (A9) (`REQ-f3-automacoes-a1-a9`). Aceite: CON-CP-06; RN-CP-04..06. **Em andamento** — existem como dados da ontologia no seed em memória; falta o motor que as execute (AUTO-01).
- [x] **PAG-03**: `runLancamentoAgent` deixa de simular: a Ferramenta chama o `automation/`, que já sabe lançar (`IncluirContaPagar`, `IncluirAnexo`, idempotência CON-07); conhecimento do Agente extraído para uma Coleção de Conhecimento (OQ-CP-04); autonomia: Ensaio na primeira semana, Política de aprovação depois (OQ-CMP-05) (`REQ-f3-agente-lancamento-omie-real`). Aceite: CON-CP-07, CON-CP-08 (formato exato do RESUMO), INV-CP-01. **Código completo** — 03-04 separou o que decide do que executa; 03-07 construiu `/resolver`/`/lancar` no `automation/`; 03-11 liga a chamada real (`invocar-agente.ts`) com o Ensaio de D3-03 provado (servidor real + Postgres real). Falta só o checkpoint de produção compartilhado com 03-07 (Task 4, `PLATAFORMA_LANCAMENTO_TOKEN` real na VPS) — não é gap de código.
- [x] **PAG-04**: Substituir `CATEGORIA_OMIE` (24 categorias com códigos inventados) e `CNPJ_POR_EMPRESA` (fictício) pelo plano real (`ListarCategorias`) ou pelo RAG do `automation/` (`conciliador_contas`), com validação contra o plano real e `REVISAR` abaixo do threshold; `CONTA_POR_TAG` + fallback por centro parcial; Departamento Omie falta (OQ-CMP-03) (`REQ-f3-de-para-categorias-real`). Aceite: não especificado. Depende de OQ-CP-04; com DEC-08, a leitura é por HTTP (OQ-SYN-03). **Código completo** — 03-04 entregou a FORMA; 03-07 lê a fonte real por HTTP; 03-11 fechou a metade CNPJ (`CNPJ_POR_EMPRESA` apagada de `financeiro.ts`, `{{cnpjEmpresa}}` lê `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` injetado, fallback textual sem número inventado). Falta só o mesmo checkpoint de produção de PAG-03.
- [x] **PAG-05**: Seleção múltipla + mudança de Status em lote na Lista (CON-CP-11) (`REQ-f3-pagamento-em-lote`). Aceite: 61 fechamentos num segundo; cada um dispara A1. **Código completo, domínio e tela** — `alterarStatusEmLote` (Plan 03-12) registrada em `OPERACOES`, alcançável por `POST /operacoes/alterarStatusEmLote`, uma transação por gesto, falha parcial como valor no relatório; testada em memória (11 casos) e contra o Postgres real (e2e, 6 casos). 03-13 ligou o gesto que já existia em `bulk-status-bar.tsx` a essa operação — um `run()`, não mais um laço de 61 — e `relatorio-de-lote.tsx` renderiza os quatro resultados, com `parcial` em bloco próprio. DEC-06 medido contra um Espaço isolado (tLote 45×–49× mais rápido que N transações individuais); a medida definitiva contra `ws_n1` com o volume real de 03-10 e a verificação humana do lote de 61 contra o banco real (Task 4 de 03-13) ficam pendentes — mesma família de bloqueio de produção que PAG-03/PAG-04/PAG-06, não gap de código.
- [x] **PAG-06**: Aplicar CON-CP-09 — a Pessoa da conta vê só as Tarefas em que é o valor do campo Pessoa (`comentar`; `editar` só Anexo e Data de Emissão); Aprovador `ver`/`editar` status e Responsável/`comentar`; demais Membros sem acesso (`REQ-f3-permissao-pessoa-da-conta`). Aceite: CON-CP-09. **Completo** — PERS-04 (Fase 1) já aplica a permissão no backend; 03-05 tornou `memberSeesTask` derivada do Campo Pessoa (`List.sharedWithDefinitionIds`) e fechou o domínio; 03-15 fechou a apresentação: "Compartilhadas comigo" (o caminho até a própria conta), busca global e "Minhas Tarefas" perguntam `memberSeesTask`/`memberReachesContainer` antes de desenhar, e a edição restrita a Anexo/Data de Emissão (Fase 1) segue intacta. A verificação humana em produção (Task 3 de 03-15) fica pendente por falta de acesso a VPS/credenciais reais — não é gap de código.

### Fase 4 — As outras telas do financeiro-tria (TELA)

Critério de pronto: `financeiro-tria.vercel.app` pode sair do ar. Regra: DEC-16 — portadas como tela, lendo a API do `automation/` direto; nenhuma regra muda.

- [ ] **TELA-01**: Portar como tela, no sistema de design do CRM N1, as leituras que o Financeiro precisa e que nunca viveram no ClickUp: Notas fiscais (`transacoes`), Produtos (`produtos_cadastrados_emissao_notas`), Plano de contas (CRUD + import; tabela hoje vazia), Extratos do Marcos (upload), Workflows (catálogo + runs), Dashboard, Problemas, Aprovações pendentes (`REQ-f4-telas-portadas`). Aceite: CON-12 Fase 4. Pré-requisito implícito: o `automation/` hoje é lido com `anon_read` e sem autenticação, e `AuthContext` + `anon_read` morrem — a plataforma precisa de um caminho autenticado para essas leituras (OQ-SYN-01, não especificado no plano). D10 (emissão manual de NF) afeta. Pendente.

### Fase 5 — Contas a receber e os outros tenants (REC, TEN)

- [x] **REC-01**: Contas a receber na plataforma conforme D7: se o recebimento migrou para o Omie, a Lista vira espelho de leitura da Integração; se não, `createReceivableSeries` já existe e R2–R7 viram Automações no motor. Restrições CON-CR-01..10; leituras conservadoras CAND-05 (`REQ-f5-contas-a-receber`). Aceite: não especificado (o próprio SPEC condiciona tudo a OQ-CR-01). **Bloqueado por D7**. Protótipo em memória existe.
- [x] **TEN-01**: Marcos Paulo e Family Office: as Empresas viram opções do Campo `Empresa`; as regras de cada `config.ts` viram configuração por Empresa — sem clonar serviço; uma Integração Omie por Empresa (CAND-01, a confirmar); prefixo numérico + `02-Empresas` do FO e status `em revisão` (OQ-CMP-02) absorvidos (`REQ-f5-tenants-marcos-paulo-family-office`). Aceite: não especificado (observável: solicitações dos dois tenants nascem no CRM N1 e seus webhooks ClickUp são desligados). Pendente.

### Transversal (AUTO)

- [x] **AUTO-01**: **Motor de Automações** — executa `Automation` da ontologia: gatilhos por evento (`AutomationTrigger.kind: evento`) e por agenda (`schedule`), ações `invocarAgente`, `solicitarAprovacao`, `aguardar`, `notificar` (tipos já existem em `packages/dominio/src/types/`), com Execuções auditáveis; necessário para A1–A9 (Fase 3), R2–R7 (Fase 5) e o gatilho "tempo em Status" que C34 pede (`REQ-x-motor-automacoes`). Peça **G, risco alto** — "infraestrutura genérica; o Financeiro é o primeiro cliente". Aceite: não especificado. Antipadrão a não repetir: o cron do `automation/` "sem fila, sem retry persistente: se o processo cair no minuto errado, o dia é pulado". OQ-PF-03 (C14) e OQ-SYN-02 (evento de saída) tocam o desenho. **Mapeado à Fase 3** (primeiro cliente). Pendente — não há código de execução de Automação em `apps/api`.
- [x] **AUTO-02**: Ação de notificar por Canal (WhatsApp via Evolution API) — a plataforma tem o campo `Z WhatsApp`; falta a Ação (`REQ-x-notificar-por-canal`). Derivado de DOC (`02-comparativo` §3.2) — prioridade a confirmar. Aceite: não especificado. **Mapeado à Fase 5** (tenant Marcos Paulo é quem usa a Evolution API hoje; o motor já existe desde a Fase 3). Pendente.

## v2 Requirements

Nenhum definido — o plano fecha na Fase 5. Candidatos naturais que já apareceram e ficam anotados sem ID: cache local/offline no frontend; troca de Espaço de Trabalho sem sair; recorte de hidratação por Lista quando um Espaço passar de ~2–3 mil registros (DEC-06); mover o `automation/` para o monorepo (D12); Go High Level (OQ-GHL-01); espelho Negócio → Tarefa (OQ-PF-02).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Reescrever o `automation/` dentro do `apps/api` | DEC-11: backend do financeiro-tria fica exatamente como está |
| SQL direto do `automation/` no schema `plataforma` | DEC-14: pularia Registro de Atividade, Requisito de saída e permissão |
| Uma tabela por entidade no schema `plataforma` (PERS-03) | DEC-02: tabela genérica + colunas geradas |
| Portar as 23 telas do financeiro-tria como código | DEC-12: morrem; porta-se a leitura (TELA-01) |
| Migrar observabilidade legada, `payment_requests`, 13 tabelas vetoriais + 7 views | CAND-03 (a confirmar): nunca pegaram / substituídas pela `conciliador_contas` unificada |
| Emissão de NF, Guru/Kiwify/TMB, extratos por WhatsApp, sync de clientes Omie como lógica na plataforma | Continuam no `automation/` (DEC-11); a plataforma só lê |
| Go High Level | Zero menções; pertence ao CRM; inventário próprio (OQ-GHL-01) |
| Validação de dígito de CPF e consulta cnpj.ws na plataforma | OQ-CMP-04 aberta; hoje fica no `automation/` via Solicitação — decidir na spec PREP-03 |
| Cerimônias, cronogramas, matriz de riscos | Uma pessoa + Claude |

### Fase 6 — Conferência do Resumo e anexos (RES)

Critério de pronto (ROADMAP Phase 6): o Financeiro vê o Resumo no fio antes do lançamento, confere ou pede ajuste, e o Agente só lança — com anexos e com o código conferido — quando a conta entra em "em lançamento omie" com a conferência feita. Fonte: `docs/08-migracao-financeiro/09-plano-conferencia-do-resumo-e-anexos.md` e `10-levantamento-fluxo-atual-x-documentacao-x-backend.md`; decisões em `.planning/phases/06-…/06-CONTEXT.md`.

- [x] **RES-01**: Fluxo 5 — o Agente publica o `📋 RESUMO DE PAGAMENTO` (CON-CP-08) no fio da conta completa, ANTES do lançamento, mencionando o Financeiro, sem resolvê-lo, e abre uma Conferência (`ApprovalRequest` de processo, `processStep: "resumo"`) que guarda conta · categoria · código e a impressão de lançamento como dado (`REQ-f6-resumo-para-conferencia`). Aceite: critério 1 da fase; mutação: sem o cancelamento da Conferência anterior o teste falha. Feito — provas em `06-PROVAS.md` (rodada de fechamento, 2026-09-30).
- [x] **RES-02**: Fluxo 6 — conferência por clique (card e fila) ou por "ok" no fio, resposta canônica no fio e fio resolvido, sem mudar Status; qualquer outra resposta de revisor é pedido de ajuste e gera Resumo revisado no mesmo fio com nova Conferência (`REQ-f6-conferencia-e-revisao`). Aceite: critério 2. Feito — provas em `06-PROVAS.md` (rodada de fechamento, 2026-09-30; segunda rodada 06-16..06-20, 2026-09-30: quem confere pelo fio = pelo clique, execução A com `RESULTADO: OK`, `/resolver`=3, `/lancar`=0, e crm2:CR-01 provado no real — desmarcar "Manual" invalida a dispensa e devolve o Resumo a uma pessoa).
- [ ] **RES-03**: Fluxo 7 — a ponte só chama `/lancar` com Conferência aprovada para os dados atuais, manda `codigoCategoriaConfirmado`, confirma no fio, move para "lançado omie"; falha permanente comenta o motivo e devolve a conta a "para pagar" (`REQ-f6-lancamento-com-conferencia`). Aceite: critério 3; zero `/lancar` sem conferência (teste). Pendente — código e testes completos (zero `/lancar` sem conferência: testes de 06-12/06-18/06-19, e a prova em `conferencia` na segunda rodada de 06-20 com `/lancar`=0 nas execuções A e B); falta a verificação humana 1 (passo 2B em `lancar`, `06-VERIFICATION.md`) — com o dono.
- [x] **RES-04**: Anexos no Omie — a ponte manda `anexos` (URLs assinadas de 5 min com o nome original) e o `/lancar` (v1.1) os sobe por `IncluirAnexo` com o nome certo; `teste:omie-real --anexo` prova no Omie real (`REQ-f6-anexos-no-omie`). Aceite: critério 4. Feito — provas em `06-PROVAS.md` (rodada de fechamento, 2026-09-30). fin2:IN-07 (dois anexos no mesmo título) continua sem prova real — o script de 06-17 aceita um anexo só; fica com o dono.
- [x] **RES-05**: S5/S6 na Solicitação (coorte plataforma) — depois de `aprovada`, o pipeline publica o Resumo na Solicitação; em `rejeitada`, avisa o Solicitante; tudo pela porta (`REQ-f6-s5-s6-plataforma`). Aceite: critério 5. Feito em 06-05 (financeiro-tria `2cd13cd`); o S5 assíncrono sem decisão velha (fin2:CR-01, 06-16) é reforço do mesmo requisito, com 769/769 testes verdes.
- [x] **RES-06**: Modo `conferencia` da ponte, jornada `cp-conferida`/`cp-ajuste`, specs e planos atualizados, provas registradas em `06-PROVAS.md` (`REQ-f6-provas-e-docs`). Aceite: critério 4 (zero `/lancar` nos modos sem caneta) e o relato. Feito em 06-06 (provas em `06-PROVAS.md`); segunda rodada de fechamento em 06-20 (2026-09-30): `npm run check` EXIT 0 (995/995 domínio, 275/275 web, 820 passados·205 pulados·1 todo·0 falhas api), contrato v1.2 igual nos dois repositórios (hash `0adf7a7b…595f71`), `financeiro-tria` 769/769, e as execuções A e B com `/lancar`=0 nas duas.

### Fase 7 — CRM: Contatos, Empresas, Funis e Negócios (CRM)

Critério de pronto (ROADMAP Phase 7): Contatos, Empresas, Funis (com Etapas) e Negócios criados, lidos, editados e excluídos direto pelo frontend, com isolamento por Espaço de Trabalho e acesso por Membro aplicados no backend. Os sete IDs abaixo são **derivados** do goal e das decisões D-01..D-15 (`.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-RESEARCH.md`, "Phase Requirements"; decisões em `07-CONTEXT.md`) — não vêm do SPEC de migração do Financeiro.

- [x] **CRM-D1**: Tipos, normalizadores e regras puras de Contato/Empresa/Funil/Etapa/Negócio em `@n1/dominio` (módulo novo `@n1/dominio/crm/*`, em português, espelhando a 007; o modelo inglês convive — D-01). Pendente.
- [x] **CRM-A1**: Repositórios + serviços + rotas REST (`/contatos`, `/empresas`, `/funis`, `/negocios`) com isolamento por `workspace_id` e permissão por Papel (D-03, D-10, D-11, D-14). Pendente.
- [x] **CRM-A2**: Integridade com 409 ricos: Funil/Etapa com Negócios (D-07), admin da Empresa (D-08, com a correção da 007 — D-12), último admin/Contato de Negócio (D-09), unicidade de Identificador. Pendente.
- [x] **CRM-A3**: Ações de Negócio: mover, ganhar, perder, reabrir, arquivar, restaurar, lixeira, excluir permanentemente (D-05, D-06). Pendente.
- [x] **CRM-W1**: Telas de Contatos, Empresas, Funis (+Etapas) e Negócios — lista, ficha, formulário criar/editar, lixeira/restaurar — lendo e gravando só por HTTP (D-04, D-02, D-15). Pendente.
- [x] **CRM-W2**: Quadro de Negócios (kanban em `/crm/negocios`) com mover/ganhar/perder/reabrir por REST (D-05). Pendente.
- [x] **CRM-V1**: `npm run check` verde; testes de domínio, de rota (`app.inject`) e de repositório contra Postgres local; a 007 aplicada no banco da plataforma depois da conferência de D-12. Pendente.

### Fase 8 — Canais de comunicação: conexão e omnichannel preparado (CXE)

Critério de pronto (ROADMAP Phase 8): o Administrador escolhe e conecta Canais (WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail) por uma página de orientação por provedor, sem provedor real; o Espaço tem mais de um Canal, inclusive dois WhatsApps lado a lado; Canal, Conversa e Mensagem têm tabela própria (008) e rotas REST; o chat mostra por qual Canal a Mensagem veio e deixa escolher por qual responder. Os nove IDs abaixo são **derivados** do goal e das decisões D-01..D-16 (`.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-RESEARCH.md`, "Phase Requirements"; decisões em `08-CONTEXT.md`).

- [x] **CXE-D1**: `@n1/dominio`: provedor do Canal (`ProvedorDeCanal`, `PROVEDORES`), Capacidades por (tipo, provedor), módulos `@n1/dominio/crm/{canais,conversas,mensagens}` com regras puras (Canal nasce `desconectada`, conexão em dois atos, identificador canônico, regra de envio por janela/modelo) e `podeNoCrm` com `canal`/`conversa`/`mensagem` (D-01..D-04, D-08). Pendente.
- [x] **CXE-D2**: todos os leitores de janela/modelo (domínio e web) passam por `capacidadesDoCanal`; Canal sem provedor mantém o comportamento de hoje (D-02). Pendente.
- [x] **CXE-A1**: migração `008-canais-conversas-mensagens.sql` com as invariantes da Caixa de Entrada no banco, idempotente, conferida por `migrar --seco` e aplicada no banco da plataforma (D-09, D-10). Pendente.
- [x] **CXE-A2**: repositórios, serviços e rotas REST `/canais`, `/conversas`, `/mensagens` com isolamento por `workspace_id`, Papel no backend e 400/403/404/409 no envelope do CRM (D-09, D-11). Pendente.
- [x] **CXE-A3**: Mensagem com o modelo 7.6 + `carga_bruta`, recebida idempotente por (Canal, id externo), envio pela regra de janela/modelo por (tipo, provedor) e `pendente` com Canal desconectado (D-02, D-10). Pendente.
- [x] **CXE-A4**: ponte — Canais relacionais projetados em `GET /estado` e em `executar()`, nunca gravados em `plataforma.registros`; contrato `automacao.notificar-canal.v1` intacto (D-11, D-12). Pendente.
- [x] **CXE-W1**: botão "Conectar Canal", tela dos quatro cartões, orientação por provedor (passos + espaço do QR/token + formulário real), Canal criado `desconectada` por REST, "Simular conexão" marcada, lista e ficha com selo do provedor e origem (D-04..D-08, D-12). Pendente.
- [x] **CXE-W2**: chat por Canal — abas por Canal, "Responder por" com padrão da última recebida, Canal + selo no topo do fio e separador "via …", item da lista com ícone + nome do Canal e filtro `?canal=` com o provedor (D-13..D-16). Pendente.
- [x] **CXE-V1**: `npm run check` verde; testes de domínio, de rota, de repositório e o e2e "dois WhatsApps lado a lado" contra Postgres local; a 008 aplicada no banco da plataforma depois da conferência do dono e a UAT de fim de fase. Pendente.

### Fase 9 — Segurança dos dados e base de produção (SEG)

Critério de pronto (ROADMAP Phase 9): a segurança dos dados fechada e a base de produção montada **antes de qualquer dado real de cliente entrar** (WhatsApp não oficial, Sessão 4 do plano em diante). Os doze IDs abaixo são **derivados** das tarefas 1.1 a 1.8 de `docs/09-planejamento/TAREFAS-POR-SESSAO.md` e das decisões D-01..D-23 (`.planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-CONTEXT.md`, "Requisitos derivados"; critérios ajustados pela pesquisa em `09-RESEARCH.md`).

- [x] **SEG-01**: Nenhum Membro recebe Sessão de Chat (inclusive o texto das mensagens e as `agentExecutions` de Sessão), pasta de chat, Memória de Usuário, Visão pessoal nem e-mail de convite de outro; quem não administra a Lista não recebe `publicShare.secret` nem `Form.secret` — nem por `GET /estado`, nem por `POST /operacoes` (inclusive o `value` do resultado e o caminho `SERVICOS`); o Arquivo órfão deixado por `removeAttachment` não é baixável por quem não o vê (D-01, D-22). Pendente.
- [x] **SEG-02**: Convidado não recebe `agents`, `automations`, `documents`, `collections` nem `skills`; o assunto IA some do trilho dele e `/ia/*` mostra "Sem acesso" (D-02, D-03). Pendente.
- [ ] **SEG-03**: Membro `suspenso` recebe 403 em `POST /operacoes`; Convidado recebe `ok: false` em `trashContact`, `sendMessage`, `winDeal`, `restoreList` e `createReceivableSeries`; a tabela "Quem pode" de `packages/dominio/CONTEXT.md` cobre todas as chaves do `REGISTRO` (286 operações). Pendente.
- [ ] **SEG-04**: `has_schema_privilege('anon'/'authenticated','plataforma','USAGE')` é `false`; a `009` aplicada em homologação e produção; o `apps/api` em produção conecta como `n1_api`; `drop table plataforma.migracoes` por `n1_api` é recusado; recuperação idempotente dos grants quando o papel nasce depois da `009` (D-04..D-07). Pendente.
- [x] **SEG-05**: Credencial gravada aparece só cifrada no banco (AES-256-GCM, chave fora do banco), lê de volta o mesmo valor, chave errada falha, linha copiada para outro dono não decifra e nenhuma rota devolve o segredo (D-17). Pendente.
- [ ] **SEG-06**: `/v1/public/forms/<segredo>` não deixa o segredo no log do `apps/api` nem nos do nginx (`access_log` e `error_log`) (D-18, D-20). Pendente.
- [ ] **SEG-07**: Em Docker, 50 `POST` seguidos do mesmo IP a `/v1/public/forms/x`: ≥ 30 recebem `429`, o primeiro entre a 11ª e a 20ª chamada; o `GET` tem teto próprio mais alto; `TRUST_PROXY` documentado (D-19, D-20). Pendente.
- [ ] **SEG-08**: Homologação no ar com login e banco próprios (segundo projeto Supabase, usuário `n1crm-hml`); push na branch `homologacao` publica a api (D-08, D-09, D-23). Pendente.
- [ ] **SEG-09**: Backup diário cifrado (`age`) no bucket com chave só de escrita e expiração de 14 dias; restauração feita e anotada num Postgres descartável, com `count(*)` de `plataforma.registros` igual ao de produção na hora do backup (D-10, D-21). Pendente.
- [ ] **SEG-10**: Sentry na api e na web com `beforeSend` que apaga corpo, cabeçalhos, cookies, query e a parte secreta da URL; erro forçado em homologação chega como alerta por e-mail em até 5 minutos (D-13). Pendente.
- [ ] **SEG-11**: Painel da Evolution API responde por HTTPS na VPS nova e a chave de API está anotada para a Sessão 4 (D-12). Pendente.
- [ ] **SEG-12**: Suíte adversarial verde no `npm run check` e no job `seguranca` do CI; `09-PENTEST.md` com a autorização do dono, achados por severidade e nenhum crítico ou alto aberto (D-14..D-16). Pendente.

## Traceability

Cada requisito mapeia a exatamente uma fase. Status GSD (coluna 3, atualizada pelas ferramentas): `Pending` · `In Progress` · `Blocked` · `Complete`. A coluna "Situação verificada" carrega o status da intel (código, 2026-09-15).

| Requirement | Phase | Status | Situação verificada (intel) | ID intel |
|-------------|-------|--------|-----------------------------|----------|
| PREP-01 | Phase 0 | Complete | feito (`b20597d`) | REQ-f0-schema-plataforma |
| PREP-02 | Phase 0 | Complete | feito (`7df69cc`) — 3.118 Tarefas, 11.001 arquivos; `time_in_status` é aproximado, não histórico cronológico | REQ-f0-exportacao-clickup |
| PREP-03 | Phase 0 | Complete | feito (`f095369`) — D6/D8 fechados; 5 lacunas (L-01/03/07/09/11) devolvidas ao dono para a Fase 2 | REQ-f0-spec-solicitacao-de-pagamento |
| PREP-04 | Phase 0 | Complete | feito (`a7cc636`) — 5/6 e-mails resolvidos; revisor FO (81581802) sem e-mail real, aguardando o dono | REQ-f0-de-para-usuarios-clickup |
| PREP-05 | Phase 0 | Complete | risco aceito pelo dono em 2026-09-16, D-13 — não rotacionar; critério 4 da Fase 0 não se aplica | REQ-f0-rotacao-credenciais-omie |
| PREP-06 | Phase 0 | Complete | feito (2026-09-15) | REQ-f0-contagem-linhas-legado |
| PERS-01 | Phase 1 | Complete | feito (`9fb2754`, `3fd7e1b`, `b20597d`) | REQ-f1-persistencia-unidade-de-trabalho |
| PERS-02 | Phase 1 | Complete | feito (`d713253`) | REQ-f1-supabase-auth |
| PERS-03 | — | Superseded | sobreposto por DEC-02 (ver PERS-07) | REQ-f1-tabelas-schema-plataforma |
| PERS-04 | Phase 1 | Complete | feito — CR-02 fechado por inteiro, Plan 01-16 | REQ-f1-rotas-por-operacao |
| PERS-05 | Phase 1 | Complete | pendente | REQ-f1-store-post |
| PERS-06 | Phase 1 | Complete | pendente | REQ-f1-bootstrap-espaco-gestao |
| PERS-07 | Phase 1 | Complete | pendente | REQ-f1-colunas-geradas-indices |
| PERS-08 | Phase 1 | Blocked | bloqueado por decisão (D11) | REQ-f1-deploy-apps-api |
| PERS-09 | Phase 1 | Complete | pendente — derivado de DOC, prioridade a confirmar | REQ-f1-reconvite-por-usuario |
| SOL-01 | Phase 2 | Blocked | bloqueado por decisão (D6) | REQ-f2-lista-solicitacoes |
| SOL-02 | Phase 2 | Pending | pendente | REQ-f2-formulario-solicitacao |
| SOL-03 | Phase 2 | Pending | pendente | REQ-f2-tela-aprovacao |
| SOL-04 | Phase 2 | Pending | pendente | REQ-f2-timeline-solicitacao |
| SOL-05 | Phase 2 | Complete | pendente — repositório `financeiro-tria` | REQ-f2-adapter-plataforma |
| SOL-06 | Phase 2 | Complete | pendente — repositório `financeiro-tria` | REQ-f2-mapper-plataforma |
| SOL-07 | Phase 2 | Pending | pendente | REQ-f2-endpoint-solicitacao-criada |
| SOL-08 | Phase 2 | Blocked | bloqueado por decisão (D8) | REQ-f2-classificador-fallback |
| SOL-09 | Phase 2 | Pending | pendente | REQ-f2-importacao-solicitacoes |
| PAG-01 | Phase 3 | Complete | pendente | REQ-f3-importacao-contas-a-pagar |
| PAG-02 | Phase 3 | In Progress | em andamento (dados no seed; falta o motor) | REQ-f3-automacoes-a1-a9 |
| PAG-03 | Phase 3 | Complete | 03-04 separou decidir de executar; Omie real em 03-07/03-11 | REQ-f3-agente-lancamento-omie-real |
| PAG-04 | Phase 3 | Complete | forma entregue em 03-04; fonte real e CNPJ em 03-07/03-11 | REQ-f3-de-para-categorias-real |
| PAG-05 | Phase 3 | Complete | domínio + e2e real em 03-12; tela em 03-13; medida final de DEC-06 e checkpoint de produção esperam 03-10/verificação humana | REQ-f3-pagamento-em-lote |
| PAG-06 | Phase 3 | Complete | domínio em 03-05, apresentação em 03-15; verificação humana em produção pendente (acesso) | REQ-f3-permissao-pessoa-da-conta |
| AUTO-01 | Phase 3 | Complete | pendente — peça G, risco alto, não iniciada | REQ-x-motor-automacoes |
| TELA-01 | Phase 4 | Pending | pendente | REQ-f4-telas-portadas |
| REC-01 | Phase 5 | Complete | entregue na Fase 5 — Critério 1 verdadeiro em produção | REQ-f5-contas-a-receber |
| TEN-01 | Phase 5 | Complete | code-complete; MP/FO recusados visivelmente — corte dos webhooks pendente (D5-20, ver 05-VERIFICATION Acknowledged Gaps) | REQ-f5-tenants-marcos-paulo-family-office |
| AUTO-02 | Phase 5 | Complete | code-complete e contrato ponta a ponta verde; 1º envio real pendente (deploy do automation/, PERS-08, Automação publicada) | REQ-x-notificar-por-canal |
| RES-01 | Phase 6 | Complete | planejado 2026-09-29 (06-01, 06-03) | REQ-f6-resumo-para-conferencia |
| RES-02 | Phase 6 | Complete | provado no real em 06-20 (crm2:CR-01, execução A/B) | REQ-f6-conferencia-e-revisao |
| RES-03 | Phase 6 | Pending | código e testes completos; falta a verificação humana 1 (passo 2B em `lancar`) — com o dono | REQ-f6-lancamento-com-conferencia |
| RES-04 | Phase 6 | Complete | planejado 2026-09-29 (06-02, 06-03); fin2:IN-07 (dois anexos) sem prova real — com o dono | REQ-f6-anexos-no-omie |
| RES-05 | Phase 6 | Complete | planejado 2026-09-29 (06-05); reforçado em 06-16 (fin2:CR-01) | REQ-f6-s5-s6-plataforma |
| RES-06 | Phase 6 | Complete | segunda rodada de fechamento em 06-20 (2026-09-30) | REQ-f6-provas-e-docs |
| CRM-D1 | Phase 7 | Complete | planejado 2026-10-09 (07-01..07-05, 07-08) | derivado (07-RESEARCH) |
| CRM-A1 | Phase 7 | Complete | planejado 2026-10-09 (07-01..07-05, 07-08, 07-12) | derivado (07-RESEARCH) |
| CRM-A2 | Phase 7 | Complete | planejado 2026-10-09 (07-02..07-05) | derivado (07-RESEARCH) |
| CRM-A3 | Phase 7 | Complete | planejado 2026-10-09 (07-08) | derivado (07-RESEARCH) |
| CRM-W1 | Phase 7 | Complete | planejado 2026-10-09 (07-01, 07-06, 07-07, 07-09..07-13) | derivado (07-RESEARCH) |
| CRM-W2 | Phase 7 | Complete | planejado 2026-10-09 (07-10, 07-11, 07-13) | derivado (07-RESEARCH) |
| CRM-V1 | Phase 7 | Complete | planejado 2026-10-09 (07-01, 07-02, 07-12, 07-13) | derivado (07-RESEARCH) |
| CXE-D1 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-02, 08-03, 08-05) | derivado (08-RESEARCH) |
| CXE-D2 | Phase 8 | Complete | planejado 2026-10-12 (08-02) | derivado (08-RESEARCH) |
| CXE-A1 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-04, 08-14) | derivado (08-RESEARCH) |
| CXE-A2 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-03, 08-04, 08-06, 08-12, 08-13) | derivado (08-RESEARCH) |
| CXE-A3 | Phase 8 | Complete | planejado 2026-10-12 (08-06, 08-12, 08-13) | derivado (08-RESEARCH) |
| CXE-A4 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-07, 08-13) | derivado (08-RESEARCH) |
| CXE-W1 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-08, 08-09, 08-15) | derivado (08-RESEARCH) |
| CXE-W2 | Phase 8 | Complete | planejado 2026-10-12 (08-05, 08-10, 08-11, 08-15) | derivado (08-RESEARCH) |
| CXE-V1 | Phase 8 | Complete | planejado 2026-10-12 (08-01, 08-13, 08-14, 08-15) | derivado (08-RESEARCH) |
| SEG-01 | Phase 9 | Complete | pendente — derivado (09-CONTEXT, 09-RESEARCH) | derivado (09-CONTEXT) |
| SEG-02 | Phase 9 | Complete | pendente | derivado (09-CONTEXT) |
| SEG-03 | Phase 9 | Pending | pendente | derivado (09-CONTEXT) |
| SEG-04 | Phase 9 | Pending | pendente — a conferência de 22/10 já fechou a parte de banco da 1.3.1 | derivado (09-CONTEXT) |
| SEG-05 | Phase 9 | Complete | pendente | derivado (09-CONTEXT) |
| SEG-06 | Phase 9 | Pending | pendente | derivado (09-CONTEXT) |
| SEG-07 | Phase 9 | Pending | pendente | derivado (09-CONTEXT) |
| SEG-08 | Phase 9 | Pending | pendente — checkpoints do dono | derivado (09-CONTEXT) |
| SEG-09 | Phase 9 | Pending | pendente — checkpoints do dono | derivado (09-CONTEXT) |
| SEG-10 | Phase 9 | Pending | pendente | derivado (09-CONTEXT) |
| SEG-11 | Phase 9 | Pending | pendente — checkpoint do dono | derivado (09-CONTEXT) |
| SEG-12 | Phase 9 | Pending | pendente | derivado (09-CONTEXT) |

**Coverage:**

- v1 requirements: 69 total (68 executáveis + 1 sobreposto por decisão travada) — RES-01..06 acrescentados em 2026-09-29 (Fase 6); CRM-D1..CRM-V1 (7, derivados) em 2026-10-09 (Fase 7); CXE-D1..CXE-V1 (9, derivados) em 2026-10-12 (Fase 8); SEG-01..SEG-12 (12, derivados) em 2026-10-22 (Fase 9)
- Mapped to phases: 68 (Phase 0: 6 · Phase 1: 8 · Phase 2: 9 · Phase 3: 7 · Phase 4: 1 · Phase 5: 3 · Phase 6: 6 · Phase 7: 7 · Phase 8: 9 · Phase 9: 12)
- Unmapped: 0 ✓ (PERS-03 não tem fase por ser sobreposto — sua parte viva é PERS-07)
- Já feitos: 8 (PREP-01, PREP-02, PREP-03, PREP-04, PREP-06 — Fase 0 fechada em 2026-09-17, Plan 00-07 — mais PERS-01, PERS-02 da Fase 1) · risco aceito pelo dono: 1 (PREP-05, D-13) · em andamento: 4 · bloqueados por decisão: 4 (D11, D6, D8, D7) · pendentes: 18

---
*Requirements defined: 2026-09-15*
*Last updated: 2026-09-17 after fechamento da Fase 0 (Plan 00-07)*
