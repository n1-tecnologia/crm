# Tarefas por sessão

Desdobramento do [PLANO-DE-IMPLEMENTACAO.md](PLANO-DE-IMPLEMENTACAO.md) em tarefas e subtarefas, conferido contra o código em 18/10/2026.

> Este arquivo é gerado. Para mudar uma tarefa, edite o `dados/parte-*.mjs` da sessão e rode `node docs/09-planejamento/gerar.mjs`. O mesmo comando atualiza o `cronograma.html`.

**Como ler cada item:**
- **Tarefa:** o objetivo e quando ela fica pronta.
- **Subtarefa de fazer:** o que fazer, como está hoje e como saber que ficou pronta.
- **Subtarefa de decisão:** como está hoje, o que você decide, o que muda depois de cada resposta e a minha recomendação. Cada decisão diz se **muda o produto** (precisa da sua resposta) ou é **arrumação** (pode seguir a recomendação).

Este documento é a entrada do `/gsd-discuss-phase` de cada sessão. Os planos detalhados (arquivos, ondas e testes) são do GSD, no `/gsd-plan-phase`, e não ficam aqui.

**Camadas:** `domínio` = `packages/dominio` · `banco` = migração em `apps/api/migracoes` · `api` = `apps/api` · `web` = `apps/web` · `infra` = servidor, ambiente e serviços · `decisão` = precisa de você antes de seguir · `você` = ação sua fora do código

---

## Prazos: plano e com ajustes

O **plano** usa a velocidade medida nas Fases 06 a 08 do GSD: 65 dias úteis, com fim em **qui 21/01/2027**.

O cenário **com ajustes** usa o tamanho que a conferência no código encontrou em cada sessão: 102 dias úteis, com fim em **seg 15/03/2027**. É uma estimativa de escopo, mais pessimista que a velocidade do GSD. O número real deve ficar entre os dois; vale reestimar depois das Sessões 0 e 1, com a velocidade medida nelas.

| Sessão | Plano | Com ajustes | Por quê |
|---|---|---|---|
| 1 · Segurança dos dados e base de produção | 3 | **5** | +2 dias: são 7 frentes (recorte do `GET /estado`, conferências de permissão, migração `009` com usuário de banco próprio, cofre, logs, nginx, homologação com backup e monitoramento). |
| 2 · Clone ClickUp: ajustes e lacunas | 3 | **8** | +5 dias: a conferência no código achou 42 subtarefas, incluindo mover e reordenar contêineres e as lacunas do modelo. Se a otimização for por tabelas próprias, soma mais 2 a 3 dias. |
| 3 · Base da mensageria e unificação do CRM | 4 | **13** | +9 dias: o modelo antigo do CRM é usado por cerca de 70 arquivos da tela e 33 do domínio, e a sessão recebeu a Tarefa conversacional (que estava na Sessão 5) e a ponte do Painel. |
| 4 · WhatsApp não oficial (Evolution API) | 1 | **2** | +1 dia: provisionar a instância é rápido, mas a sessão também liga o QR code na tela, o webhook, o envio de texto e mídia, os tiques de entrega e o número com e sem o nono dígito. |
| 6 · Ferramentas: Grupos e Comunidades | 3 | **5** | +2 dias: cerca de 12 rotas novas, telas passando a falar por HTTP, sincronização pelo webhook e a página pública do Link de captação. |
| 7 · WhatsApp oficial (Cloud API) e Flows | 4 | **6** | +2 dias: Cloud API, modelos de mensagem e Flows, incluindo traduzir o Flow para o formato da Meta. Pode virar duas sessões: Cloud API e modelos (4 dias) e Flows (3 dias). |
| 9 · E-mail | 3 | **4** | +1 dia, ou +2 se a decisão for login OAuth, que o Microsoft 365 exige. |
| 12 · Superadmin, usuários e permissões | 5 | **7** | +2 dias se for só a Tria (convite real, Papéis e Equipes editáveis, módulos). Cerca de +4 se a plataforma atender várias empresas. |
| 13 · IA: ligação com o modelo e Chat respondendo | 4 | **5** | +1 dia: cliente do modelo, catálogo, teto de custo, rota com streaming, tela, ações da Sessão, anexos e os dois defeitos. |
| 14 · IA: Agentes e seus poderes | 5 | **7** | +2 dias: Skills em .md com leitura sob demanda, um passo do Construtor para cada poder, retomada depois da aprovação e expiração dos pedidos. |
| 15 · IA: Integrações da empresa e pessoais | 4 | **5** | +1 dia: além da ponte com o Composio, cada Integração (Omie, Google Agenda, Miro) precisa de teste com conta real. |
| 16 · IA: Agente na Caixa de Entrada | 3 | **5** | +2 dias: tabela de rascunhos, atribuição, acionamento, Ferramentas do CRM com o Agente como ator, assumir e devolver, e limites. |
| 17 · IA: Conhecimento indexado | 3 | **5** | +2 dias: seis frentes (armazenamento real, extração de texto, embeddings, busca, citação do trecho e Fontes). |
| 18 · IA: Automações em código e Plugins | 4 | **6** | +2 dias: o tamanho depende da lista de Automações, que ainda não chegou. |
| 19 · Saída do protótipo: LGPD, rotinas e dados reais | 3 | **5** | +2 dias: rotinas em todas as Listas, lixeira do CRM com coluna nova, LGPD e testes no navegador. |
| 20 · Painel | 4 | **5** | +1 dia: leitura dos Painéis no servidor, com as 8 contas e o período. |

O cronograma em HTML mostra os dois cenários no botão **Plano / Com ajustes**.

---

## Sessão 0 · Fechar o v1.0 e abrir o novo marco

O GSD (a ferramenta de planejamento que vive em `.planning/`) está no marco v1.0, com 9 fases (0 a 8): 6 concluídas e 3 abertas. A Fase 08 (Canais) terminou o código e espera a UAT do dono; a Fase 02 (Solicitação de pagamento) tem o ensaio de duas semanas e o corte do ClickUp por fazer; a Fase 04 (telas do Financeiro) tem o corte do painel `financeiro-tria.vercel.app` só preparado. Esta sessão fecha a 08, dá destino às 02 e 04 e abre o v2.0 com as sessões deste plano.

**Ponto de partida:**
- `.planning/STATE.md`: `status: verifying`, Fase 08, 147 de 148 planos com resumo; o único sem resumo é `02-28-PLAN.md`.
- `08-UAT.md` (em `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/`): 4 testes, todos `[pending]`. `08-VERIFICATION.md`: `status: human_needed`, 13 de 13 verdades verificadas no código, nenhum gap.
- `.planning/WINDOWS.md`: `open_count: 2` (a UAT da 08 e um teste instável); o `/gsd-ship` fica bloqueado enquanto houver janela aberta.
- Fase 02: `02-27-PLAN.md` com as Tasks 1 e 2 feitas e a Task 3 (o ensaio real de 14 dias) aberta; `02-28-PLAN.md` (o corte) nunca executado.
- Fase 04: `04-14-PLAN.md` parou antes do passo irreversível, por decisão do dono; `04-UAT.md` com 13 de 13 testes aprovados.

### 0.1 Verificar e fechar a Fase 08

**Objetivo:** A Fase 08 tem todo o código verificado, mas a UAT de fim de fase nunca rodou no app real: as 4 linhas de `08-UAT.md` estão `[pending]` e a coluna “Resultado” do roteiro de `08-PROVAS.md` está em branco. Esta tarefa faz a UAT com você, corrige o que ela apontar, fecha as observações baratas da revisão de código e marca a fase concluída.

**Pronto quando:** `08-UAT.md` com `status: complete`, `08-VERIFICATION.md` com `status: passed`, a linha da Phase 8 com `[x]` no `ROADMAP.md` e as janelas #6 e #7 fechadas em `WINDOWS.md`.

- [ ] **0.1.1 Preparar os dois logins da UAT** `você`
  - **Hoje:** O roteiro (`08-PROVAS.md`, seção “Roteiro da UAT”) pede dois usuários reais do Supabase no mesmo Espaço: um de Papel base Administrador ou Proprietário e um de base Membro. Um convite novo não manda e-mail (isso chega na Sessão 12), então é preciso usar dois Membros que já entram hoje.
  - **O que fazer:**
    1. Escolher dois Membros `ativo` do Espaço `ws_n1` que já têm conta no Supabase: um Administrador ou a Proprietária, e um de base Membro.
    2. Subir `npm run dev` na raiz (web em 3001, api em 3002) com o `apps/api/.env` da plataforma.
  - **Pronto quando:** Os dois entram em `http://localhost:3001/entrar` e abrem `/crm/caixa-de-entrada` sem erro.
- [ ] **0.1.2 Percorrer os 10 passos da UAT e anotar o resultado** `você`
  - **Hoje:** `08-UAT.md` agrupa os 10 passos de `08-PROVAS.md` em 4 testes, todos `[pending]`. O passo 1 agora começa pela engrenagem do cabeçalho da coluna de Conversas (correção `0b5c5b3`), não pela URL.
  - **O que fazer:**
    1. Rodar `/gsd-verify-work 8`, que lê `08-UAT.md` e pergunta teste a teste.
    2. Teste 1 (passos 1 a 3): como Administrador, engrenagem › “Conectar Canal” › cartão WhatsApp oficial › criar “Comercial” com o número A; cartão não oficial › criar “Suporte” com o número B; repetir o não oficial com o número A, que deve ser recusado com “Esta conta já está conectada em outro Canal ativo.” e um link para o Canal que usa o número.
    3. Teste 2 (passos 4 e 5): “Simular conexão” em cada ficha; na lista de Canais, conferir os selos oficial, não oficial, cadastrado e demo.
    4. Teste 3 (passos 6 a 8): abrir um Contato do seed com WhatsApp, trocar “Responder por” para Suporte, enviar texto livre sem modelo e usar o filtro “Canal” da Caixa de Entrada.
    5. Teste 4 (passos 9 e 10): entrar como Membro (“Conectar Canal” desabilitado, ficha sem “Simular conexão”); voltar como Administrador, “Desconectar” e “Arquivar” o Suporte.
    6. Recarregar a página depois de cada gravação: o dado tem de vir da api, não da memória da tela.
    7. Preencher a coluna “Resultado” de `08-PROVAS.md` com o que viu, inclusive o que estiver feio ou confuso.
  - **Pronto quando:** Nenhum teste `[pending]` em `08-UAT.md`: cada um está `pass` ou `issue` com a descrição do problema.
- [ ] **0.1.3 Corrigir cada problema que a UAT apontar** `web` `api`
  - **Hoje:** Não há falha conhecida; a lista nasce do passo anterior.
  - **O que fazer:**
    1. Para cada teste marcado `issue` em `08-UAT.md`, escrever primeiro um teste que reproduz o problema (de componente em `apps/web` ou de rota em `apps/api`) e depois a correção.
    2. Refazer na tela só o passo que falhou.
  - **Pronto quando:** Os 4 testes de `08-UAT.md` em `pass`.
- [ ] **0.1.4 Corrigir as duas observações baratas da revisão de código e dar destino às outras** `api` `web`
  - **Hoje:** `08-REVIEW-DISPOSITION.md` tem WR-01 a WR-06 e IN-01 a IN-04, todas `open`. WR-02: reabrir uma Conversa não zera `resolvida_em` (`apps/api/src/repositorios/crm/conversas.ts:181-185`, função `definirSituacao`). WR-06: os atalhos WhatsApp e E-mail da ficha do Contato dizem “Nenhum Canal … ativo alcança este Contato” quando o Canal existe mas está desconectado (`apps/web/src/features/crm/contact-card.tsx:311-343`).
  - **O que fazer:**
    1. WR-02: no `UPDATE` de `definirSituacao`, gravar `resolvida_em = null` quando a situação volta para `aberta`.
    2. WR-06: trocar a frase de `contact-card.tsx` para “Nenhum Canal conectado alcança este Contato.”
    3. Em `08-REVIEW-DISPOSITION.md`: WR-02 e WR-06 viram `fixed`; WR-01 (janela de 24 h na primeira mensagem) vira `deferred` para a Sessão 7; WR-03, WR-04 e WR-05 viram `deferred` para a Sessão 3; IN-01 a IN-04 viram `accepted`.
  - **Pronto quando:** Um teste novo em `apps/api/src/repositorios/crm/conversas.test.ts` resolve e reabre uma Conversa e lê `resolvida_em` nulo; `08-REVIEW-DISPOSITION.md` não tem nenhuma linha `open`.
- [ ] **0.1.5 Tirar o empate do teste instável `colunas-geradas`** `api`
  - **Hoje:** Janela #7 de `WINDOWS.md`: `apps/api/src/persistencia/colunas-geradas.test.ts:111` ordena só por `due_date` (`order by due_date`), e duas linhas com o mesmo vencimento saem em ordem aleatória.
  - **O que fazer:** Trocar para `order by due_date, id` nessa consulta do teste.
  - **Pronto quando:** Em `apps/api`, `npx vitest run src/persistencia/colunas-geradas.test.ts` passa 20 vezes seguidas; a janela #7 vira `closed`.
- [ ] **0.1.6 Dar destino às pendências do dono que a Fase 08 deixou**
  - **Hoje:** `08-PROVAS.md`, seção “Fica com o dono”, tem 4 decisões abertas: (1) o popup legado de Canal das Listas nasce `conectada`; (2) a aba “Todas” para o separador “via …”; (3) “Simular conexão” visível no Espaço de produção; (4) qual dos dois WhatsApps um Flow usa.
  - **O que fazer:** Anotar no `STATE.md` do v2.0 onde cada uma vai ser decidida: (1) e (2) na Sessão 3 (unificação do CRM), (3) na Sessão 4 (a subtarefa que troca “Simular conexão” por conexão real), (4) na Sessão 7 (Flows).
  - **Pronto quando:** As 4 linhas de “Fica com o dono” apontam para uma sessão do v2.0.
- [ ] **0.1.7 Marcar a Fase 08 como concluída**
  - **Hoje:** `.planning/state.json` mostra a fase 8 `in_progress`; `ROADMAP.md` mostra `[ ] Phase 8`.
  - **O que fazer:**
    1. Com os 4 testes em `pass`, deixar o `/gsd-verify-work 8` fechar `08-UAT.md` e passar `08-VERIFICATION.md` para `passed`.
    2. Fechar a janela #6 de `WINDOWS.md`.
    3. Conferir `ROADMAP.md` (`[x] Phase 8`) e `state.json` (fase 8 `complete`).
  - **Pronto quando:** `WINDOWS.md` com `open_count: 0` e a Phase 8 com `[x]` no `ROADMAP.md`.

### 0.2 Decidir o destino das Fases 02 e 04 do Financeiro

**Objetivo:** As duas fases estão abertas não por falta de código, mas por falta de operação com dado real (14 dias de ensaio, uma semana de uso, 30 dias com o painel antigo pausado) e por dois passos irreversíveis: desligar os webhooks do ClickUp e tirar o acesso anônimo do banco do `financeiro-tria`. O plano anterior dizia que faltava a tela de aprovação (SOL-03): ela existe desde o plano `02-14` (`/ia/aprovacoes` e o cartão de Aprovação na Tarefa).

**Pronto quando:** Cada uma das duas fases tem o destino escrito em `.planning/STATE.md`, e o que ficou para depois virou fase ou item de backlog do v2.0.

- [ ] **0.2.1 Escrever a lista do que falta na Fase 02**
  - **Hoje:** `02-27-SUMMARY.md`: Tasks 1 e 2 feitas (código de integração Omie determinístico, `ConsultarContaPagar` antes de `IncluirContaPagar`, `npm run reconciliar`); Task 3 aberta: escrever `docs/08-migracao-financeiro/06-ensaio-e-coortes.md` e operar 14 dias de ensaio. Ninguém produz ainda o `--resumo=<json>` diário que `npm run reconciliar` precisa para o lado do `automation/`. `02-28-PLAN.md` (corte: runbook `07-runbook-corte-e-rollback.md`, desligar os webhooks Tria do ClickUp, arquivar a Lista de Solicitação, reavaliar a decisão D12, fechar SOL-01 a SOL-09) nunca rodou. Em `REQUIREMENTS.md`, SOL-01, 02, 03, 04, 07 e 08 seguem sem `[x]`, embora o código exista.
  - **O que fazer:**
    1. Copiar para `STATE.md`, numa seção “Fase 02 — o que falta”, os quatro itens acima, cada um com dono (você ou o time) e tempo de calendário.
    2. Listar os pré-requisitos do ensaio que o `STATE.md` já cita: emitir a credencial de serviço do `automation/` (`npm run credencial -w @n1/api`), ligar `PAYMENT_REQUEST_SOURCE=plataforma` para a coorte nova e fixar `FALLBACK_COMENTARIO_ATE` no deploy.
  - **Pronto quando:** A seção existe em `STATE.md`, com dono e prazo por item.
- [ ] **0.2.2 Escrever a lista do que falta na Fase 04**
  - **Hoje:** `04-14-SUMMARY.md` e `STATE.md`: o runbook `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` está escrito; a migração `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` existe e nunca foi aplicada. Faltam: uma semana de uso real das oito telas pelo Financeiro; rodar as duas consultas de RLS no Supabase Studio e colar o resultado no runbook; pausar (não apagar) `financeiro-tria.vercel.app` por 30 dias; só então remover as rotas legadas e o `AuthContext` e aplicar a migração. A policy de `conciliador_contas` se chama `anon read conciliador_contas`, com espaços: um `drop policy anon_read` literal não a remove.
  - **O que fazer:** Copiar esses cinco passos para `STATE.md`, numa seção “Fase 04 — o que falta”, com dono e data de cada um.
  - **Pronto quando:** A seção existe em `STATE.md`, com dono e data por passo.
- [ ] **0.2.3 Listar as pendências de fases já marcadas como concluídas**
  - **Hoje:** O `ROADMAP.md` marca `[x]` em fases que ainda têm passos abertos: `05-05` (corte de Marcos Paulo e Family Office: deploy, webhooks, 48 h e arquivamento pendentes), `05-10` Task 4 (ligar o relógio de Contas a receber: ensaio, ler o relato e `npm run automacoes:liberar`), e RES-03 da Fase 6 (verificação humana do passo 2B em `lancar`). PERS-08 (onde o `apps/api` roda) segue sem `[x]` em `REQUIREMENTS.md`, mas o `apps/api` já está na VPS (`apps/api/deploy/CONTEXT.md`).
  - **O que fazer:**
    1. Marcar PERS-08 como concluído em `REQUIREMENTS.md`, com a prova `apps/api/deploy/CONTEXT.md`.
    2. Juntar `05-05`, `05-10` Task 4 e RES-03 à mesma decisão da subtarefa seguinte.
  - **Pronto quando:** Nenhum requisito do v1.0 fica sem status quando o `/gsd-audit-milestone` rodar.
- [ ] **0.2.4 O que fazer com o que falta do Financeiro?** `decisão` · *muda o produto*
  - **Como é hoje:** O código das Fases 02 e 04 está pronto. O que falta é operação com dado real e dois cortes irreversíveis. Somado: cerca de 1,5 dia de trabalho do time e 3 a 6 semanas de calendário com o Financeiro usando.
  - **Você decide:**
    - (A) Terminar antes de começar o v2.0
    - (B) Levar para o v2.0 como uma trilha paralela “Financeiro: ensaio e cortes”, sem bloquear as sessões
    - (C) Encerrar as duas fases como estão e registrar o que ficou de fora como backlog
  - **O que muda depois:** (A) adia o início da Sessão 1 em 3 a 6 semanas. (B) acrescenta uma trilha no cronograma, com cerca de 1,5 dia de trabalho espalhado e o resto em tempo de calendário; o time não para. (C) não muda as datas, mas o ClickUp e o painel antigo continuam ligados sem data para sair.
  - **Recomendo:** (B): o Financeiro já opera no CRM N1, e os cortes dependem de calendário, não de código.

### 0.3 Trocar de marco

**Objetivo:** Fechar o v1.0 no GSD e abrir o v2.0 com as sessões deste plano como fases, para que `/gsd-plan-phase` e `/gsd-execute-phase` passem a trabalhar nelas.

**Pronto quando:** `.planning/ROADMAP.md` lista o v2.0 com as 20 fases, e o v1.0 está arquivado.

- [ ] **0.3.1 Auditar o v1.0 antes de arquivar**
  - **Hoje:** Nenhuma auditoria do marco foi feita.
  - **O que fazer:** Rodar `/gsd-audit-milestone`, que confere cada requisito de `REQUIREMENTS.md` contra as fases.
  - **Pronto quando:** O relatório da auditoria não aponta requisito sem status nem fase sem destino.
- [ ] **0.3.2 Arquivar o v1.0**
  - **Hoje:** `.planning/milestone.lock`, `.planning/state.json` e `docs/09-planejamento/` estão fora do git (`git status`).
  - **O que fazer:**
    1. Commitar `docs/09-planejamento/` e `.planning/state.json`.
    2. Rodar `/gsd-complete-milestone`.
  - **Pronto quando:** O v1.0 aparece arquivado em `.planning`, e `git status` não mostra nada de `.planning` solto.
- [ ] **0.3.3 Abrir o v2.0 com as sessões deste plano**
  - **Hoje:** Não existe v2.0.
  - **O que fazer:**
    1. Rodar `/gsd-new-milestone`, dando `docs/09-planejamento/TAREFAS-POR-SESSAO.md` como entrada: as Sessões 1 a 20 viram as fases 1 a 20, na ordem e com as dependências do plano.
    2. Registrar a trilha de escopo da IA e, se a 0.2 escolher (B), a trilha do Financeiro como itens de backlog com data, não como fases.
  - **Pronto quando:** O `ROADMAP.md` lista as 20 fases do v2.0 e o `STATE.md` aponta para a Fase 1 (Segurança dos dados).

**A sessão fica pronta quando:** `.planning/WINDOWS.md` com `open_count: 0`; `.planning/ROADMAP.md` com o v1.0 arquivado e o v2.0 listando as 17 sessões deste plano como fases; o destino das Fases 02 e 04 escrito em `.planning/STATE.md`.

---

## Sessão 1 · Segurança dos dados e base de produção

Vem antes de qualquer dado real de cliente (da Sessão 4 em diante). Hoje `GET /estado` manda a todo Membro logado as Sessões de Chat, a Memória de Usuário e os e-mails de convite dos outros, e os segredos dos links públicos; um Membro suspenso ainda grava pelas operações que não conferem o estado; o banco não tem RLS e o `apps/api` conecta como `postgres`; não há onde guardar token de provedor; o log grava o segredo que vai na URL das rotas públicas; o limite de taxa vive só na memória do processo; e só existe produção, sem alerta de erro.

**Depende de:** Sessão 0.

> **Ajuste sugerido:** +2 dias: são 7 frentes (recorte do `GET /estado`, conferências de permissão, migração `009` com usuário de banco próprio, cofre, logs, nginx, homologação com backup e monitoramento).

**Ponto de partida:**
- O token do Supabase é verificado em toda requisição (`verificarTokenDoSupabase`, `apps/api/src/autenticacao/verificar-token.ts`, por `auth.getClaims`).
- O Espaço de Trabalho vem de `WORKSPACE_ID` no servidor, nunca do cliente (`apps/api/src/plugins/autenticacao.ts:78`).
- O ator de uma operação é o Membro da sessão, e os argumentos passam por schema zod próprio de cada operação (`apps/api/src/rotas/operacoes.ts:284`).
- `GET /estado` já recorta Espaço, Pasta, Lista, Tarefa, Atividade, Aprovação e Arquivo pelo alcance do Membro (`visibilidadePara`, `packages/dominio/src/derive-visibilidade.ts:36`).
- As rotas do CRM novo leem o Papel no banco a cada chamada (`exigir`, `apps/api/src/servicos/crm/acesso.ts:39`).
- Os segredos dos links públicos são aleatórios (`crypto.getRandomValues`, `packages/dominio/src/operations/scale.ts:46`).
- Anexos ficam em bucket privado e saem por URL assinada, autorizada por Tarefa (`GET /anexos/:fileId/url`, `apps/api/src/rotas/estado.ts:70`).
- A tela não consulta o banco: usa o Supabase só para login (não há `.from(` nem `.storage` em `apps/web/src`).

### 1.1 Fechar o que o `GET /estado` envia a mais

**Objetivo:** `visibilidadePara` (`packages/dominio/src/derive-visibilidade.ts:36`) só recorta a Estrutura; o resto do `DataState` vai inteiro para todo Membro logado, inclusive o que é pessoal de outro Membro e segredos de link. O recorte passa a tirar o que é pessoal e a esconder campos de segredo, e a mesma regra vale para a resposta de `POST /operacoes`.

**Pronto quando:** Um teste em `apps/api/src/rotas/estado.test.ts`, com dois Membros reais no Postgres local, prova que nenhum recebe a Sessão de Chat, a pasta de chat, a Memória de Usuário nem a Visão pessoal do outro, e que um Membro sem administrar a Lista não recebe `publicShare.secret` nem `Form.secret`.

- [ ] **1.1.1 Filtrar as Sessões de Chat e as pastas de chat no recorte de visibilidade** `domínio`
  - **Hoje:** `visibilidadePara` devolve `state.chatSessions` e `state.chatFolders` inteiros (o comentário em `derive-visibilidade.ts:18-20` diz que IA não é recortada). Quem esconde é a tela: `apps/web/src/features/shell/app-shell.tsx:915-920` filtra por `ownerMemberId`, e a regra de quem pode ler uma Sessão (DO-CHT-09: só o dono e quem a recebeu compartilhada) mora só na página `apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:126-132`.
  - **O que fazer:**
    1. Criar `membroVeSessaoDeChat(state, memberId, sessao)` em `packages/dominio/src/derive.ts`, com a regra da página: dono, ou `sharedWithMemberIds` contém o Membro, ou uma Equipe de `sharedWithTeamIds` o contém.
    2. Em `visibilidadePara`, manter só as Sessões que passam nessa regra e só as `chatFolders` com `ownerMemberId` igual ao Membro; pôr os ids que saem em `ocultos`.
    3. A página `ia/chat/[sessao]/page.tsx` passa a chamar `membroVeSessaoDeChat` em vez da conta própria.
  - **Pronto quando:** Teste em `packages/dominio/src/derive-visibilidade.test.ts`: o Membro A não recebe a Sessão do Membro B; recebe quando B a compartilha com A ou com uma Equipe de A; nunca recebe a pasta de chat de B.
  - **Atenção:** O diálogo de remover Membro (`apps/web/src/app/(shell)/configuracoes/membros/page.tsx`) usa `previewSuccession`, que conta as Sessões de Chat do outro Membro (`packages/dominio/src/operations/members.ts:93`). Com o recorte, a tela passa a contar zero: tirar esse número do texto do diálogo.
- [ ] **1.1.2 Esconder a Memória de Usuário, os e-mails de convite e as Visões pessoais dos outros Membros** `domínio`
  - **Hoje:** Cada `Member` vai com `userMemory` (`packages/dominio/src/types/workspace.ts:126`) e, se pendente, `invitedIdentity` (`:114`). O convite grava o e-mail também em `displayName` (`members.ts:521`), então esconder só `invitedIdentity` não basta. As Visões com `ownerKind: “member”` (Visão pessoal, `packages/dominio/src/types/structure.ts:113`) também vão para todos.
  - **O que fazer:**
    1. Criar `recortarRegistro(colecao, dados, state, memberId)` em `derive-visibilidade.ts`, que devolve uma cópia sem os campos que o Membro não pode ler.
    2. Para `members`: nos outros Membros, `userMemory` vira `{ enabled, items: [] }`; para quem não tem Papel base Administrador ou Proprietário, um Membro `pendente` perde `invitedIdentity` e o `displayName` vira “Convite pendente”.
    3. Para `views`: tirar as Visões `ownerKind: “member”` de outro Membro e pôr os ids em `ocultos`.
    4. `visibilidadePara` aplica `recortarRegistro` a cada coleção antes de devolver.
  - **Pronto quando:** Teste em `derive-visibilidade.test.ts`: um Membro comum vê a própria `userMemory` com itens e a de outro vazia, não vê o e-mail de um convite pendente e não recebe a Visão pessoal de outro; um Administrador vê o e-mail do convite.
- [ ] **1.1.3 Esconder os segredos dos links públicos de quem não administra a Lista** `domínio`
  - **Hoje:** `Task.publicShare.secret` (`packages/dominio/src/types/structure.ts:349`) e `Form.secret` (`:148`) vão para todo Membro que vê a Tarefa ou para todos, no caso dos Formulários. Quem pode criar ou renovar esses links é quem administra a Lista (`containerAdminRefusal`, `packages/dominio/src/derive.ts:1053`, usado em `shareTaskPublicly`, `scale.ts:604`, e `rotateFormSecret`, `scale.ts:413`). Os Formulários de Listas que o Membro não alcança também vão.
  - **O que fazer:**
    1. Em `recortarRegistro`: para `tasks`, tirar `publicShare.secret` quando `containerAdminRefusal(state, memberId, “list”, task.listId)` recusa; para `forms`, fazer o mesmo com `secret`.
    2. Em `visibilidadePara`, tirar os Formulários cuja `listId` está em `ocultos`.
  - **Pronto quando:** Teste em `derive-visibilidade.test.ts`: um Membro de base Membro vê a Tarefa com link público, mas sem `publicShare.secret`; o Administrador da Lista vê o segredo; o Formulário de uma Lista privada não chega a quem não a alcança.
  - **Atenção:** Conferir antes, com `grep`, que nenhuma tela de quem não administra lê `publicShare.secret` ou `form.secret`; se ler, a tela precisa mostrar “Só quem administra a Lista vê o link”.
- [ ] **1.1.4 O que mais o `GET /estado` deve esconder?** `decisão` `domínio` · *muda o produto*
  - **Como é hoje:** Agentes, Automações, Documentos de Conhecimento, Coleções e o CRM antigo (`contacts`, `deals`, `conversations`) vão inteiros para todos, inclusive para Convidados. Não existe regra de quem vê um Agente ou Documento: a concessão de Coleção é dada a Agente, não a Membro (`CollectionGrant`, `packages/dominio/src/types/ai.ts:606`). O CRM antigo sai do código na Sessão 3.
  - **Você decide:**
    - (A) Convidado não recebe nenhuma coleção de IA (`agents`, `automations`, `documents`, `collections`, `skills`); os demais Papéis recebem tudo, como hoje
    - (B) Criar agora uma regra de visibilidade por registro para Documentos e Agentes (dono, Equipe, compartilhamento)
    - (C) Deixar como está até as Sessões 13 a 18 (IA)
  - **O que muda depois:** (A) custa cerca de meio dia, em `visibilidadePara`. (B) custa cerca de 2 dias e pede que você diga quem vê cada Documento. (C) não custa nada agora, mas um Convidado continua lendo os Documentos de Conhecimento. Nas três, o CRM antigo fica como está até a Sessão 3 removê-lo.
  - **Recomendo:** (A) agora, e a regra fina de (B) na Sessão 17 (Conhecimento indexado).
- [ ] **1.1.5 Aplicar o mesmo recorte à resposta de `POST /operacoes`** `api` `domínio`
  - **Hoje:** `apps/api/src/rotas/operacoes.ts:364-365` filtra o diff só por id (`filtrarDiferenca`, `derive-visibilidade.ts:109`), mas cada `gravados[]` carrega `dados` com o registro inteiro (`RegistroGravado`, `packages/dominio/src/diferenca.ts:17`). Gravar a própria Tarefa devolve o `publicShare.secret`; gravar qualquer coisa que toque outro Membro devolve a `userMemory` dele. E `inviteMember`, que passa por `SERVICOS` (`operacoes.ts:234`), volta sem recorte nenhum, porque `depois` fica indefinido (`operacoes.ts:302-303`). `GET /estado/revisao` devolve só um número e não precisa de recorte.
  - **O que fazer:**
    1. Criar `recortarDiferenca(diferenca, state, memberId)` em `derive-visibilidade.ts`: tira os ids de `ocultos` e passa cada `gravados[].dados` por `recortarRegistro`.
    2. Em `operacoes.ts`, trocar `filtrarDiferenca` por `recortarDiferenca`.
    3. No caminho de `SERVICOS`, recortar também: `convidarMembro` (`apps/api/src/servicos/convidar-membro.ts`) passa a devolver o estado depois da operação, e a rota aplica `recortarDiferenca`.
  - **Pronto quando:** Teste em `apps/api/src/rotas/operacoes.test.ts`: um Membro sem administrar a Lista grava um Campo de uma Tarefa com link público e a resposta não contém o segredo.
- [ ] **1.1.6 Escrever o teste de vazamento de ponta a ponta** `api`
  - **Hoje:** `apps/api/src/rotas/estado.test.ts:140` prova só o recorte da Estrutura (PRIV-03); não há teste de dado pessoal.
  - **O que fazer:** Em `estado.test.ts` (Postgres local, pula sem `DATABASE_URL`), semear dois Membros, cada um com Sessão de Chat, pasta de chat, item de Memória de Usuário e Visão pessoal, um convite pendente e uma Tarefa com link público; chamar `GET /estado` como cada um e procurar no corpo os ids e segredos do outro.
  - **Pronto quando:** O teste roda no `npm run check` e falha se qualquer um desses dados do outro Membro aparecer.

### 1.2 Fechar as escritas sem conferência

**Objetivo:** Toda operação que grava deveria conferir quem chama, mas a conferência mora dentro de cada uma das cerca de 200 operações de `packages/dominio/src/operations/registro.ts`, e falta em parte delas, sobretudo no CRM antigo. Além disso, um Membro `suspenso` passa pela autenticação (`apps/api/src/plugins/autenticacao.ts:85`) e chega a `POST /operacoes`, onde só é barrado pelas operações que conferem o estado.

**Pronto quando:** Um Membro suspenso recebe 403 em qualquer `POST /operacoes`; um Convidado recebe `ok: false` em `trashContact`, `sendMessage` e `winDeal`; a tabela de quem confere o quê cobre todas as operações do registro.

- [ ] **1.2.1 Barrar o Membro suspenso em `POST /operacoes`** `api`
  - **Hoje:** O hook de autenticação deixa passar `ativo` e `suspenso` (`plugins/autenticacao.ts:85`), de propósito: o suspenso consulta. O CRM novo barra a escrita dele (`podeNoCrm`, `packages/dominio/src/crm/permissoes.ts:71`), mas as operações do registro que não olham o estado do Membro gravam, por exemplo `trashContact` (`packages/dominio/src/operations/contacts.ts:333`).
  - **O que fazer:** Em `apps/api/src/rotas/operacoes.ts`, logo depois de `ehNomeDeOperacao(nome)` (linha 252), responder 403 com “Seu acesso está suspenso: você consulta, mas não altera.” quando `request.membro.state !== “ativo”`. Toda operação do registro grava (regra de inclusão, `registro.ts:7-13`), então a recusa vale para todas.
  - **Pronto quando:** Teste em `operacoes.test.ts`: um Membro suspenso chama `trashContact` e recebe 403, e o Contato continua `ativo` no banco.
- [ ] **1.2.2 Pôr a conferência nas operações do CRM antigo** `domínio`
  - **Hoje:** `contacts.ts` tem uma conferência de Papel em 19 operações (perto da linha 981); `conversations.ts`, uma em 11 (perto da linha 700); `deals.ts` tem `mayWriteDeal` (`deals.ts:34`) mas não o chama em `moveDealToStage` (`:131`), `winDeal` (`:194`), `loseDeal` (`:236`), `removeStage` e `migrateDealsToFunnel`. Exemplos sem nada: `trashContact` (`contacts.ts:333`), `addContactNote` (`contacts.ts:761`), `sendMessage` (`conversations.ts:164`), `resolveConversation` (`conversations.ts:257`). O plano anterior dizia que `collaboration.ts` não confere nada: confere, por `activeTask` (`collaboration.ts:15`), que chama `taskWriteRefusal`.
  - **O que fazer:**
    1. Mover `mayWriteDeal` para um arquivo novo `packages/dominio/src/operations/crm-antigo.ts`, com o nome `recusaDeEscritaNoCrmAntigo` (Membro `ativo` e Papel base diferente de Convidado, a mesma regra de `podeNoCrm` para escrita).
    2. Chamar essa recusa na primeira linha de toda operação de `contacts.ts`, `conversations.ts` e `deals.ts` que ainda não confere.
  - **Pronto quando:** Um teste por arquivo (`contacts.test.ts`, `conversations.test.ts`, `deals.test.ts`, criando os que não existem): um Convidado chama `trashContact`, `sendMessage` e `winDeal`, recebe `ok: false` e o estado não muda.
  - **Atenção:** A Sessão 3 apaga essas operações; isto custa cerca de meio dia e fecha a porta até lá.
- [ ] **1.2.3 Pôr a conferência nas outras operações que gravam sem olhar quem chama** `domínio`
  - **Hoje:** Fora do CRM antigo, a varredura achou duas: `restoreList` (`packages/dominio/src/operations/tasks.ts:816`) restaura sem conferir quem chama, enquanto `restoreContainer` (`structure.ts:776`) e `restoreTask` (`tasks.ts:694`, via `mayWriteTask`) conferem; `createReceivableSeries` (`financeiro.ts:1807`) cria parcelas sem conferir escrita na Lista de Contas a receber.
  - **O que fazer:**
    1. `restoreList` passa a chamar `restoreContainer(state, actingMemberId, “list”, listId)` ou a mesma recusa que ele usa.
    2. `createReceivableSeries` passa a chamar `listWriteRefusal(state, actingMemberId, CR.listId)` (`tasks.ts:1373`) antes de criar.
  - **Pronto quando:** Dois testes: um Convidado chama cada uma e recebe `ok: false`.
- [ ] **1.2.4 Escrever a tabela de quem confere o quê** `domínio`
  - **Hoje:** Não existe. A varredura rápida desta revisão olhou 167 das cerca de 200 operações; as outras têm assinatura que a busca não pegou.
  - **O que fazer:** Em `packages/dominio/CONTEXT.md`, uma seção “Quem pode” com uma linha por operação de `REGISTRO`: o arquivo, a função de recusa que ela chama (`taskWriteRefusal`, `containerAdminRefusal`, `listWriteRefusal`, `recusaDeEscritaNoCrmAntigo`, dono do registro) ou a justificativa de não ter.
  - **Pronto quando:** Toda chave de `REGISTRO` aparece na tabela, e nenhuma linha diz “sem conferência” sem justificativa.

### 1.3 Fechar o banco para que só o `apps/api` o acesse

**Objetivo:** Nenhuma migração (`apps/api/migracoes/001` a `008`) liga RLS, cria policy ou faz `grant`/`revoke`, e o `apps/api` conecta com `DATABASE_URL` (`apps/api/src/persistencia/conexao.ts:135`), que no `.env.example` é o usuário `postgres` do pooler, dono de tudo. Toda a proteção está no `apps/api`. Esta tarefa confere se a chave pública do navegador alcança o schema `plataforma` e troca o usuário do `apps/api` por um usuário de banco com só o que ele precisa.

**Pronto quando:** `select has_schema_privilege('anon','plataforma','USAGE')` e o mesmo para `authenticated` respondem `false`; o `apps/api` de produção conecta como `n1_api`; a `009` está aplicada.

- [ ] **1.3.1 Conferir se o schema `plataforma` está exposto à chave pública** `infra` `você`
  - **Hoje:** A tela carrega a chave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `apps/web/.env.example:2`). Se `plataforma` estiver em “Exposed schemas” e `anon` tiver `USAGE` nele, qualquer pessoa com essa chave lê o banco pela API REST do Supabase. Não consegui conferir daqui: o conector do Supabase não tem permissão no projeto.
  - **O que fazer:**
    1. No SQL Editor do Supabase, rodar `select has_schema_privilege('anon','plataforma','USAGE') as anon, has_schema_privilege('authenticated','plataforma','USAGE') as autenticado;`.
    2. Em Project Settings › Data API › Exposed schemas, conferir que `plataforma` não está na lista; se estiver, tirar.
    3. Em Authentication › Sign In / Providers, desligar “Allow new users to sign up”: usuário só nasce por convite (Sessão 12).
  - **Pronto quando:** As duas colunas voltam `false`, e `curl` em `https://<ref>.supabase.co/rest/v1/registros` com a chave pública e o cabeçalho `Accept-Profile: plataforma` responde erro.
  - **Atenção:** É o item mais urgente do plano: leva minutos e vale fazer hoje, antes de começar a sessão.
- [ ] **1.3.2 Como proteger o banco?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** O banco confia em quem conecta. A mesma `DATABASE_URL`, do usuário `postgres`, serve o `apps/api` e roda as migrações no deploy (`apps/api/deploy/instalar-release.sh:42`).
  - **Você decide:**
    - (A) Banco fechado: revogar tudo de `anon` e `authenticated` no schema `plataforma` e criar um usuário de banco `n1_api`, sem superusuário, só com leitura e escrita nas tabelas de `plataforma`; as migrações seguem com o usuário dono, numa variável nova `DATABASE_URL_MIGRACAO`
    - (B) Tudo de (A), mais RLS em todas as tabelas, com policy por `workspace_id` lido de `current_setting('app.workspace_id')`, que o `apps/api` fixa a cada transação
  - **O que muda depois:** (A) custa cerca de 1 dia. (B) soma cerca de 2 dias: `executar` (`apps/api/src/persistencia/unidade-de-trabalho.ts`) e os repositórios do CRM passam a abrir toda transação com `set_config('app.workspace_id', …)`, e um erro de Espaço vira recusa do banco, não só do código.
  - **Recomendo:** (A) agora; (B) quando houver mais de uma empresa no sistema (decisão 12.1 da Sessão 12).
- [ ] **1.3.3 Escrever a migração `009`** `banco`
  - **Hoje:** A `008` é a última e é imutável. O deploy aplica sozinho toda migração nova a cada merge na `main` (`instalar-release.sh:42`), então a `009` chega em produção no primeiro deploy depois do merge.
  - **O que fazer:**
    1. Criar `apps/api/migracoes/009-seguranca-e-cofre.sql` com: `revoke all on schema plataforma from public, anon, authenticated`; `revoke all on all tables in schema plataforma from anon, authenticated`; `alter default privileges in schema plataforma revoke all on tables from anon, authenticated`.
    2. Na mesma migração, se o papel `n1_api` existir (bloco `do $$ … if exists (select 1 from pg_roles where rolname = 'n1_api') …`), dar `usage` no schema e `select, insert, update, delete` em todas as tabelas, e o mesmo em `alter default privileges` para tabelas futuras.
    3. Na mesma migração, a tabela do cofre (tarefa 1.4).
    4. Criar o papel à mão, uma vez por banco, no SQL Editor: `create role n1_api login password '<senha forte>'`. A senha nunca entra no arquivo.
    5. Aplicar primeiro em homologação (tarefa 1.7) e só depois fazer o merge.
  - **Pronto quando:** `npm run migrar -w @n1/api -- --seco` lista `pendente 009-seguranca-e-cofre.sql`; depois de aplicada, `select has_table_privilege('n1_api','plataforma.registros','SELECT')` é `true` e o mesmo para `anon` é `false`.
- [ ] **1.3.4 Trocar a conexão do `apps/api` para o usuário `n1_api`** `api` `infra`
  - **Hoje:** `conexao.ts:135` lê só `DATABASE_URL`, e `migrar.cli.ts` usa o mesmo pool. Na VPS, o ambiente fica em `/opt/n1-crm/shared/api.env`. Em desenvolvimento, `DATABASE_SSL_INSECURE=true` desliga a verificação de TLS (decisão da Fase 2, `08-PROVAS.md` item 5); fora do notebook, `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` é obrigatório.
  - **O que fazer:**
    1. Em `apps/api/src/persistencia/migrar.cli.ts`, usar `DATABASE_URL_MIGRACAO` quando existir, e `DATABASE_URL` quando não.
    2. Pôr `DATABASE_URL_MIGRACAO` no `apps/api/.env.example`, com a explicação.
    3. No `api.env` de produção: `DATABASE_URL` com o usuário `n1_api`, `DATABASE_URL_MIGRACAO` com o dono, e conferir que há `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` e não há `DATABASE_SSL_INSECURE`.
  - **Pronto quando:** Depois de reiniciar `n1-crm-api`, `/saude` e `GET /estado` respondem em produção, e um `drop table plataforma.migracoes` feito com o usuário `n1_api` é recusado.

### 1.4 Criar o cofre de credenciais

**Objetivo:** As Sessões 4, 7, 8 e 9 vão guardar tokens de provedor (Evolution, Meta, e-mail). Hoje não há tabela nem utilitário de cifra: a `008` não tem coluna de segredo, de propósito, e `Integration.omie` guarda só o rótulo da conta (`packages/dominio/src/types/workspace.ts:203`). O cofre guarda o segredo cifrado com uma chave que fica fora do banco.

**Pronto quando:** Um teste grava uma credencial, lê de volta o mesmo valor e prova que a coluna no banco só tem bytes cifrados; nenhuma rota devolve o segredo.

- [ ] **1.4.1 Criar a tabela `plataforma.credenciais` na `009`** `banco`
  - **Hoje:** Não existe. A única tabela de credencial é `plataforma.service_credentials` (`003-integracao-e-importacao.sql:99`), que guarda hash da credencial do `automation/`, não segredo que se lê de volta.
  - **O que fazer:** Na `009`: `plataforma.credenciais` com `id`, `workspace_id`, `dono_tipo` (`canal` ou `integracao`), `dono_id`, `tipo` (por exemplo `token_de_acesso`), `segredo_cifrado bytea`, `iv bytea`, `etiqueta bytea`, `versao_da_chave int`, `criado_em`, `atualizado_em`, `revogado_em`; índice único em (`workspace_id`, `dono_tipo`, `dono_id`, `tipo`) onde `revogado_em is null`.
  - **Pronto quando:** `\d plataforma.credenciais` no banco de homologação mostra as colunas e o índice.
- [ ] **1.4.2 Cifrar e decifrar no `apps/api`** `api`
  - **Hoje:** Não há `createCipheriv` nem `pgcrypto` em nenhum lugar do repositório.
  - **O que fazer:**
    1. Criar `apps/api/src/servicos/cofre.ts` com `guardarCredencial(cliente, { workspaceId, donoTipo, donoId, tipo, segredo })` e `lerCredencial(cliente, …)`, usando AES-256-GCM do `node:crypto`, com IV novo a cada gravação.
    2. A chave vem de `COFRE_CHAVE` (32 bytes em base64) e a versão de `COFRE_CHAVE_VERSAO`; pôr as duas no `.env.example` e no `api.env` de homologação e de produção, cada ambiente com a sua.
    3. Só os serviços de provedor (Sessões 4, 7, 8 e 9) chamam `lerCredencial`; nenhuma rota devolve o valor.
  - **Pronto quando:** Teste em `apps/api/src/servicos/cofre.test.ts` (Postgres local): grava, lê o mesmo texto, e um `select segredo_cifrado` direto não contém o texto; com a chave errada, `lerCredencial` lança erro.
  - **Atenção:** Escolhi chave fora do banco em vez do Supabase Vault: quem levar uma cópia do banco não leva os segredos.

### 1.5 Tirar segredos dos logs

**Objetivo:** O `apps/api` sobe com o logger padrão do Fastify (`apps/api/src/index.ts:97`, `buildApp({ logger: true })`), sem `redact`, e o nginx grava toda URL no log de acesso. As rotas públicas levam o segredo na URL (`/v1/public/forms/:secret`, `formularios-publicos.ts:193`; `/v1/public/tasks/:secret`, `tarefas-publicas.ts:50`), então o segredo vai para os dois logs.

**Pronto quando:** Uma chamada a `/v1/public/forms/<segredo>` não deixa o segredo nem no log do `apps/api` nem em `/var/log/nginx/n1-crm-api.access.log`.

- [ ] **1.5.1 Configurar `redact` e mascarar a URL no logger do `apps/api`** `api`
  - **Hoje:** `index.ts:97` passa `logger: true`; `app.ts:108` repassa ao Fastify. `LOG_LEVEL` está em `apps/api/.env.example:24`, mas nenhum código o lê.
  - **O que fazer:**
    1. Criar `apps/api/src/observabilidade/log.ts` com `opcoesDoLogger()`: `level` de `LOG_LEVEL` (padrão `info`); `redact` com `req.headers.authorization` e os caminhos `*.segredo`, `*.secret`, `*.token`, `*.senha`, censura “[oculto]”; serializador de `req` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`.
    2. `index.ts` passa `buildApp({ logger: opcoesDoLogger() })`, e `OpcoesDoApp.logger` (`app.ts:61`) passa a aceitar o objeto.
  - **Pronto quando:** Teste em `apps/api/src/observabilidade/log.test.ts`: com o logger escrevendo num fluxo de memória, `GET /v1/public/forms/abc123` produz linha sem `abc123`.
- [ ] **1.5.2 Mascarar o segredo no log de acesso do nginx** `infra`
  - **Hoje:** `apps/api/deploy/nginx-n1-crm-api.conf` usa `access_log` com o formato padrão, que grava a URL inteira.
  - **O que fazer:**
    1. Num arquivo `conf.d` do nginx, criar um `map` sobre `$request_uri` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`, e um `log_format` próprio que usa a variável do `map` no lugar da URL.
    2. Trocar o `access_log` do site para esse formato, no repositório e à mão na VPS.
  - **Pronto quando:** Depois de `nginx -s reload`, `curl` em `/v1/public/forms/teste123` e `grep teste123 /var/log/nginx/n1-crm-api.access.log` não acha nada.
  - **Atenção:** Depois da primeira emissão do certificado, o arquivo da VPS é a fonte e `preparar-vps.sh` não o reescreve (cabeçalho de `nginx-n1-crm-api.conf`): a mudança precisa ser feita também na VPS.

### 1.6 Proteger as rotas públicas contra abuso

**Objetivo:** O Formulário e a Tarefa pública aceitam chamada sem login. O limite de taxa vive na memória do processo e zera a cada reinício, e o comentário de `limite-de-taxa.ts:7-8` diz que o nginx limita na borda, mas `nginx-n1-crm-api.conf` não tem `limit_req`. O limite passa a valer no nginx, antes do `apps/api`.

**Pronto quando:** 50 chamadas seguidas do mesmo IP a `/v1/public/forms/x` recebem `429` a partir de cerca da 40ª.

- [ ] **1.6.1 Pôr `limit_req` no nginx para `/v1/public/`** `infra`
  - **Hoje:** `criarLimiteDeTaxa` (`apps/api/src/servicos/limite-de-taxa.ts:43`) conta em memória: 30 por minuto por IP e 60 por segredo no Formulário (`formularios-publicos.ts:188-189`), 60 por minuto por IP na Tarefa pública (`tarefas-publicas.ts:48`). O `apps/api` roda num processo só (`n1-crm-api.service`).
  - **O que fazer:**
    1. Em `/etc/nginx/conf.d/n1-crm-limites.conf`: `limit_req_zone $binary_remote_addr zone=n1_publico:10m rate=30r/m;`.
    2. No site, um `location /v1/public/` com `limit_req zone=n1_publico burst=10 nodelay;`, `limit_req_status 429;` e os mesmos `proxy_*` do `location /`.
    3. Manter o limite em memória como segunda camada e corrigir o comentário de `limite-de-taxa.ts`.
  - **Pronto quando:** Um laço de 50 `curl` contra `https://crm-n1-api.85.155.186.214.nip.io/v1/public/forms/x` mostra `429` nas últimas respostas.
  - **Atenção:** Uma contagem no banco só vale a pena quando o `apps/api` rodar em mais de um processo.
- [ ] **1.6.2 Documentar o `TRUST_PROXY`** `api`
  - **Hoje:** `app.ts:106` lê `TRUST_PROXY`, e o serviço da VPS o fixa em `loopback` (`apps/api/deploy/n1-crm-api.service:23`), mas o `apps/api/.env.example` não tem a variável. Sem ela, o limite por IP conta o IP do nginx para todo mundo.
  - **O que fazer:** Acrescentar `TRUST_PROXY=` ao `.env.example`, explicando: vazio em desenvolvimento, `loopback` atrás do nginx.
  - **Pronto quando:** `grep TRUST_PROXY apps/api/.env.example` acha a linha com a explicação.

### 1.7 Ambientes, backup e monitoramento

**Objetivo:** Só existe produção: uma VPS compartilhada com nginx para o `apps/api` e a Vercel para a web, e o workflow `.github/workflows/deploy-api.yml` só conhece o ambiente `production`. Não há onde validar uma sessão antes de produção, nenhum backup testado no repositório e nenhum alerta de erro (não há Sentry nem outro serviço em `apps/api` ou `apps/web`).

**Pronto quando:** Homologação no ar com login e banco próprios, uma restauração de backup feita e anotada, e um erro forçado em homologação chegando como alerta.

- [ ] **1.7.1 Onde fica o banco de homologação?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** Há um projeto Supabase (o de produção), com Postgres, Auth e Storage.
  - **Você decide:**
    - (A) Um segundo projeto Supabase só para homologação
    - (B) O mesmo projeto, com um Espaço de Trabalho de teste (outro `WORKSPACE_ID`)
  - **O que muda depois:** (A) custa a mensalidade de mais um projeto e separa banco, usuários e arquivos. (B) não custa nada, mas uma migração errada em homologação já é em produção, e a `009` não pode ser testada antes.
  - **Recomendo:** (A).
- [ ] **1.7.2 Subir o ambiente de homologação** `infra`
  - **Hoje:** Produção: serviço `n1-crm-api` em `127.0.0.1:3020`, código em `/opt/n1-crm`, site `crm-n1-api.85.155.186.214.nip.io` (`apps/api/deploy/CONTEXT.md`); a web lê `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  - **O que fazer:**
    1. Criar o banco de homologação conforme a decisão anterior, rodar `npm run migrar -w @n1/api` e `npm run bootstrap:gestao -w @n1/api` nele.
    2. Na VPS, um segundo serviço `n1-crm-api-hml` (cópia de `n1-crm-api.service` com `PORT=3021` e pasta `/opt/n1-crm-hml`) e um site nginx `crm-n1-api-hml.85.155.186.214.nip.io` com certificado próprio.
    3. Em `deploy-api.yml`, um job para a branch `homologacao` com `environment: homologacao` e os segredos desse ambiente.
    4. Na Vercel, as três variáveis `NEXT_PUBLIC_*` do ambiente Preview apontando para a homologação.
  - **Pronto quando:** Um push na branch `homologacao` publica a api; a URL de Preview da Vercel abre `/entrar`, aceita um login de homologação e carrega o Início.
- [ ] **1.7.3 Ligar o backup diário e testar uma restauração** `infra`
  - **Hoje:** Não há script de backup nem registro de restauração no repositório. Não conferi o que o plano do Supabase guarda.
  - **O que fazer:**
    1. Conferir em Database › Backups o que o plano do Supabase guarda e por quantos dias.
    2. Na VPS, um `systemd timer` diário `n1-crm-backup` que roda `pg_dump --schema=plataforma` com `DATABASE_URL_MIGRACAO`, cifra o arquivo e o copia para fora da VPS, guardando 14 dias.
    3. Restaurar o último arquivo no banco de homologação.
  - **Pronto quando:** Depois da restauração, `select count(*) from plataforma.registros` em homologação bate com o número de produção na hora do backup, e a data fica anotada em `apps/api/deploy/CONTEXT.md`.
- [ ] **1.7.4 Ligar o monitoramento de erros na api e na web** `api` `web` `infra`
  - **Hoje:** Erro inesperado no `apps/api` só vai ao log do processo (`app.ts:137`, `request.log.error(erro)`); a web não registra erro em lugar nenhum.
  - **O que fazer:**
    1. No `apps/api`: `@sentry/node`, iniciado em `index.ts` antes de `buildApp`, com `SENTRY_DSN` do ambiente; `Sentry.captureException(erro)` no `setErrorHandler` de `app.ts`; `beforeSend` que apaga corpo, cabeçalhos e a parte da URL com segredo.
    2. Na web: `@sentry/nextjs` pelo arquivo de instrumentação do Next 16 (ler antes o guia em `node_modules/next/dist/docs/`).
    3. No Sentry, uma regra de alerta por e-mail para erro novo em produção e em homologação.
  - **Pronto quando:** Um erro forçado em homologação (uma rota de teste que lança, removida depois) gera alerta por e-mail em até 5 minutos.
- [ ] **1.7.5 Preparar o servidor da Evolution API** `infra` `você`
  - **Hoje:** O `automation/` do `financeiro-tria` já usa uma instância própria da Evolution para os avisos do Financeiro (Sessão 4, decisão 4.3). Não há servidor da Evolution para o CRM N1.
  - **O que fazer:**
    1. Escolher o servidor: a mesma Evolution do `automation/`, a VPS compartilhada (Docker, com Postgres e Redis próprios) ou uma VPS nova.
    2. Deixar a Evolution respondendo atrás de HTTPS, com a chave de API guardada para o cofre da tarefa 1.4.
  - **Pronto quando:** O painel da Evolution responde por HTTPS e a chave de API está anotada para a Sessão 4.

**A sessão fica pronta quando:** Um teste em `apps/api` prova que o Membro A não recebe Sessão de Chat, Memória de Usuário, e-mail de convite nem segredo de link do Membro B, nem por `GET /estado` nem por `POST /operacoes`; `select has_schema_privilege('anon','plataforma','USAGE')` responde `false`; a `009` está aplicada em homologação e em produção; uma credencial gravada pelo cofre aparece cifrada no banco; nenhum log tem segredo de URL; homologação responde com login; um erro forçado chega como alerta.

---

## Sessão 2 · Clone ClickUp: ajustes e lacunas

Fecha a Estrutura de Trabalho (Espaço, Pasta, Lista e Tarefa) antes da mensageria. Entra aqui o que você pediu (limpar as telas, gravar mais rápido, converter item do checklist, tirar a Carga) e o que falta no modelo em relação ao artefato “Estrutura de Trabalho N1” e à ontologia (`ontologia/02-estrutura-de-trabalho/`). A lista dos seus testes da Estrutura precisa fechar até a véspera do início; o que vier dela entra na 2.7.

**Depende de:** Sessão 1.

> **Ajuste sugerido:** +5 dias: a conferência no código achou 42 subtarefas, incluindo mover e reordenar contêineres e as lacunas do modelo. Se a otimização for por tabelas próprias, soma mais 2 a 3 dias.

**Ponto de partida:**
- Espaço, Pasta e Lista têm criar, editar, arquivar, desarquivar, enviar à lixeira e restaurar (`packages/dominio/src/operations/structure.ts`). Não existe mover nem reordenar contêiner.
- Toda gravação passa por `POST /operacoes/:nome` (`apps/api/src/rotas/operacoes.ts`), que hidrata o Espaço de Trabalho inteiro de `plataforma.registros` (`hidratar`, `apps/api/src/persistencia/repositorio.ts:63`) e disputa a revisão de `plataforma.workspaces` (`executar`, `apps/api/src/persistencia/unidade-de-trabalho.ts:116`).
- A página da Lista (`apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`) tem 1.404 linhas e 6 abas: Lista, Quadro, Calendário, Tabela, Linha do tempo e Carga.
- `convertChecklistItem` (`packages/dominio/src/operations/tasks.ts:590`) funciona. A única tela que o chama é `apps/web/src/features/estrutura/tarefa-completa.tsx`, a mesma peça usada na página da Tarefa, no popup (`task-panel.tsx`) e no drawer do Financeiro (`financeiro/conta-drawer.tsx`).
- O bloqueio por aspecto (`blocks`) existe no tipo e é conferido por `blockedAbove` (`packages/dominio/src/operations/configuration.ts:42`), mas só o seed o preenche (`packages/dominio/src/seed.ts:290`, Espaço Marketing).

### 2.1 Limpar a UI das subpáginas

**Objetivo:** As telas da Estrutura ainda têm peças de protótipo: um botão de depuração, frases que explicam a regra, códigos internos como “(B25)” e uma tabela didática nas Configurações. A página da Lista tem 1.404 linhas, com dois componentes inteiros dentro dela. Depois desta tarefa, cada tela mostra só o que a pessoa usa.

**Pronto quando:** Você abre a Lista, o Espaço, a Pasta e as Configurações e aprova cada uma; a página da Lista fica abaixo de 1.000 linhas.

- [ ] **2.1.1 Tirar o botão “Rodar agenda da Lista (hoje)” e o item “Rodar automações por vencimento (hoje)”** `web`
  - **Hoje:** `RunScheduledButton` (`apps/web/src/features/estrutura/bulk-status-bar.tsx:189`) aparece em duas barras da página da Lista (`listas/[lista]/page.tsx:716`, Lista conversacional, e `:784`, Lista comum) sempre que a Lista tem Automação por vencimento ou Tarefa recorrente por calendário. Ele roda `runScheduledAutomations` e `runCalendarRecurrences` na hora, pelo navegador. No Financeiro, o menu “Automatizar” tem o mesmo gesto (`features/estrutura/financeiro/contas-view.tsx:381`). O agendador do servidor (`apps/api/src/automacoes/scheduler-worker.ts`) já roda as duas coisas sozinho.
  - **O que fazer:**
    1. Cumprir antes a decisão abaixo, para nenhuma Lista perder a recorrência.
    2. Apagar `RunScheduledButton` de `bulk-status-bar.tsx` e as duas chamadas em `listas/[lista]/page.tsx`.
    3. Apagar o item “Rodar automações por vencimento (hoje)” do menu “Automatizar” em `contas-view.tsx`; se o menu ficar vazio, apagar o menu.
  - **Pronto quando:** Numa Lista com Tarefa recorrente por calendário, o botão não aparece; `grep -rn 'Rodar agenda' apps/web/src` e `grep -rn 'Rodar automações por vencimento' apps/web/src` não acham nada.
- [ ] **2.1.2 O que roda a recorrência das Listas sem Automação depois que o botão sair?** `decisão` `api` · *muda o produto*
  - **Como é hoje:** O agendador só visita as Listas que têm uma Automação publicada com gatilho `condicaoTemporal` (`scheduler-worker.ts:268–302`). Uma Lista que só tem Tarefa recorrente por calendário (`recurrence.triggerMode = porCalendario`) depende do botão para gerar a próxima ocorrência. A Sessão 19 (19.1, “Lixeira e recorrência em todas as Listas”) resolve isso, mas vem bem depois.
  - **Você decide:**
    - (A) Trazer para cá a subtarefa da 19.1: o agendador passa a visitar também as Listas com Tarefa recorrente por calendário e as com Tarefa vencida na lixeira
    - (B) Tirar o botão da barra e deixá-lo só no menu “…” da Lista, para quem administra, até a Sessão 19
    - (C) Tirar o botão e aceitar que a recorrência por calendário fique parada nessas Listas até a Sessão 19
  - **O que muda depois:** (A) soma cerca de meio dia aqui e tira meio dia da 19.1: muda a consulta que monta os pares (Espaço de Trabalho, Lista) em `scheduler-worker.ts`. (B) custa uma hora e deixa um gesto manual escondido. (C) não custa nada, mas Tarefas recorrentes deixam de nascer sem aviso.
  - **Recomendo:** (A): é a mesma consulta que a 19.1 mudaria, e o botão sai de vez.
- [ ] **2.1.3 Confirmar que o agendador está ligado em produção** `infra` `você`
  - **Hoje:** O agendador só sobe com `AUTOMACOES_WORKER_ATIVO=true` (`apps/api/src/index.ts:192`); o exemplo de ambiente traz `false` (`apps/api/.env.example:101`). A primeira volta de cada Lista roda em ensaio e não grava até alguém liberar (`scheduler-worker.ts:39`).
  - **O que fazer:**
    1. Conferir no ambiente de produção do `apps/api` que `AUTOMACOES_WORKER_ATIVO=true`.
    2. Liberar cada Lista em ensaio com `npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>`.
  - **Pronto quando:** O log de produção do `apps/api` mostra “scheduler de Automações ativo” (`apps/api/src/index.ts:217`) e, no dia seguinte, uma linha nova em `plataforma.automacao_agenda` para cada Lista com agenda.
- [ ] **2.1.4 Juntar as duas barras de seleção em lote numa só** `web`
  - **Hoje:** `BulkStatusBar` é montada em dois lugares da página da Lista: dentro da barra do Financeiro, no lugar de `FinanceToolbar`, só com itens marcados (`listas/[lista]/page.tsx:795`), e no corpo da página nas outras Listas (`:849`). O botão “Selecionar várias” está escrito duas vezes (`:702` e `:770`), e a lente financeira tem um terceiro botão, “Sair da seleção” (`:805`).
  - **O que fazer:**
    1. Criar `apps/web/src/features/estrutura/selecao-em-lote.tsx` com o componente `SelecaoEmLote`: recebe `tasks`, `definitions`, `selecionadas`, `onSelecionar`, `onRelatorio` e `report`; desenha o botão “Selecionar várias” / “Sair da seleção” e, com itens marcados, a `BulkStatusBar`.
    2. A página monta `SelecaoEmLote` uma vez, logo abaixo das abas, nas três lentes (comum, conversacional e financeira). A barra do Financeiro passa a mostrar sempre `FinanceToolbar`.
    3. O relatório do lote continua guardado fora da seleção (`relatorioDeLote`, `page.tsx:173`), como hoje.
  - **Pronto quando:** Os testes de `bulk-status-bar.test.tsx` passam; na Lista comum e em Contas a pagar, marcar duas Tarefas mostra a mesma barra no mesmo lugar; `listas/[lista]/page.tsx` não importa mais `BulkStatusBar`.
- [ ] **2.1.5 Tirar da Lista as frases de explicação e o botão que nasce desligado** `web`
  - **Hoje:** A página da Lista tem: a nota sob o Quadro “Arrastar altera o Status. As validações da Lista continuam valendo…” (`listas/[lista]/page.tsx:1268`); o complemento “— o filtro vale em todas as Visualizações” depois da contagem filtrada (`:893`); as frases de ajuda ao lado do botão principal nas Listas de Meus negócios (`:680`) e na conversacional (`:697`); e o botão “De modelo” da Lista conversacional, que nasce sempre desligado com o motivo `TAREFA_SEM_CONTATO` (`:698`).
  - **O que fazer:**
    1. Apagar a nota do Quadro e as duas frases de ajuda.
    2. Trocar a frase da contagem por “Mostrando X de Y Tarefas.”
    3. Apagar o botão “De modelo” da barra conversacional.
  - **Pronto quando:** Na Lista conversacional (Pós-venda) a barra mostra só “Nova Tarefa” e “Selecionar várias”; no Quadro de qualquer Lista não há texto abaixo das colunas.
- [ ] **2.1.6 Tirar `Quadro`, `Tabela` e as barras de criação de dentro da página da Lista** `web`
  - **Hoje:** As funções `Quadro` (`listas/[lista]/page.tsx:1175`, cerca de 100 linhas) e `Tabela` (`:1282`, cerca de 120 linhas) moram no arquivo da página. As três barras de criação (Meus negócios, conversacional e comum, `:668–788`) estão escritas em sequência no JSX.
  - **O que fazer:**
    1. Mover `Quadro` para `apps/web/src/features/estrutura/quadro-de-tarefas.tsx` e `Tabela` para `apps/web/src/features/estrutura/tabela-plana.tsx`, sem mudar o comportamento.
    2. Mover as três barras de criação para `apps/web/src/features/estrutura/barra-de-criacao.tsx`, um componente `BarraDeCriacao` que recebe a lente (`comum`, `conversacional`, `espelhoComercial`, `financeira`) e os callbacks que a página já tem (`create`, `setNovaConversacional`, `setIniciandoConversa`).
  - **Pronto quando:** `wc -l` da página dá menos de 1.000; `npm run check` passa; criar uma Tarefa pela barra e arrastar um cartão no Quadro funcionam como antes.
- [ ] **2.1.7 Manter as abas Lista e Tabela separadas?** `decisão` `web` · *muda o produto*
  - **Como é hoje:** As 6 abas da Lista (`listas/[lista]/page.tsx:658`): Lista (`TabelaDeTarefas`, `tabela-de-tarefas.tsx`: grupos por Status, “+” por grupo, seleção e ações rápidas; no Financeiro, `FinanceTable` e `FinanceCards`); Quadro (colunas por Status, arrastar muda o Status; na conversacional, `QuadroNegocios`); Calendário (`CalendarioMensal`); Tabela (`Tabela`: lista plana com 6 colunas fixas — Título, Status, Categoria, Prioridade, Vencimento, Responsáveis — e edição na linha de Status, Prioridade e Vencimento, sem Campos); Linha do tempo (`LinhaDoTempo`, `planning-views.tsx`); Carga (sai na 2.5). A Lista financeira esconde a Carga; a conversacional esconde a Carga e a Linha do tempo (`:660–662`). Lista e Tabela mostram quase o mesmo.
  - **Você decide:**
    - (A) Manter as duas como estão
    - (B) Tirar a aba Tabela
    - (C) Fazer a Tabela virar planilha: sem grupos, uma coluna por Campo da Lista, editável na célula, como a visualização Tabela do ClickUp
  - **O que muda depois:** (A) não custa nada. (B) custa uma hora; as Visualizações salvas do tipo `tabela` passam a abrir na aba Lista. (C) custa cerca de 1,5 dia e entraria na 2.7 ou numa sessão própria.
  - **Recomendo:** (A) nesta sessão; (C) depois, se você sentir falta dos Campos na Tabela durante os testes.
- [ ] **2.1.8 Organizar as Configurações do contêiner em abas** `web`
  - **Hoje:** `ContainerSettings` (`apps/web/src/features/estrutura/container-settings.tsx:91`) empilha tudo numa rolagem só, nesta ordem: a tabela “Aspectos configuráveis” (`:220`, 6 linhas com a explicação da regra e as colunas “Neste nível”, “Origem do valor” e “Como compõe”); a grade com Conjunto de Status efetivo, Funcionalidades efetivas, Definições de Campo acumuladas, Formulários (só Lista) e Tipos de Tarefa acumulados (`:274–364`); Modelo de Tarefa (só Lista, `:370`); Canais de atendimento (só Lista conversacional, `:400`); e, por último, Identidade e Ciclo de vida (`:430`). A tabela lista Visualizações padrão e Automações, que não têm editor nesta tela.
  - **O que fazer:**
    1. Trocar a rolagem por `Abas` (`features/shell/ui`), com a aba ativa na URL (`?aba=`): Geral (Identidade, Privado, quem criou e Ciclo de vida), Status, Funcionalidades, Campos, Tipos de Tarefa, Visualizações (o editor nasce na 2.6) e, só na Lista, Formulários e “Modelo e canais”.
    2. Apagar a tabela “Aspectos configuráveis”, a constante `ASPECTS` e `REGRA_DOS_MODOS`.
    3. No topo de cada aba de aspecto, uma linha curta: “Herdado de Espaço Comercial” ou “Definido aqui”. Se um ancestral bloqueia o aspecto, “Bloqueado por Pasta X” e os editores desligados com esse motivo. O botão de bloquear nasce na 2.6.
  - **Pronto quando:** Abrir `/estrutura/listas/<id>/configuracoes?aba=campos` cai direto na aba Campos; o texto “Aspectos configuráveis” não aparece em nenhuma tela.
- [ ] **2.1.9 Deixar a página do Espaço no mesmo formato da página da Pasta** `web`
  - **Hoje:** A página do Espaço (`apps/web/src/app/(shell)/estrutura/espacos/[espaco]/page.tsx`) usa caixas (`Painel`): Listas diretas e atalhos, Pastas, Painéis (sempre, mesmo vazio, com a dica “Um Painel é criado em Painéis…”) e o painel lateral “Atributos” (`:147`), que só mostra Criado por e Privado. Não tem botão de criar. A página da Pasta (`pastas/[pasta]/page.tsx`) já usa seções com `ReguaDeSecao`, mostra as Tarefas abertas de cada Lista e tem o menu “Criar” (`useCreateContainerDialog`).
  - **O que fazer:**
    1. Reescrever a página do Espaço no formato da Pasta: seções Listas (com os atalhos e a contagem de abertas) e Pastas, e o menu “Criar” com Pasta e Lista, pelo `openCreate` de `useCreateContainerDialog`.
    2. Apagar o painel “Atributos”: Privado vira um selo ao lado do título (`Pilula` “Privado”), e Criado por vai para a aba Geral das Configurações.
    3. Mostrar a seção Painéis só quando houver Painel ancorado no Espaço.
  - **Pronto quando:** Num Espaço sem Painel, a página mostra só Listas e Pastas; “Criar › Lista” abre o diálogo com o Espaço já escolhido.
- [ ] **2.1.10 Tirar os códigos de regra dos textos da Estrutura** `web` `domínio`
  - **Hoje:** Há 9 códigos em texto visível em `apps/web/src/features/estrutura`: `create-container-dialog.tsx:383` (A3.4), `:428` (B38), `:441` (RN-ESP-03) e `:442` (B25); `tarefa-completa.tsx:1496` (INV-CP-01), `:1524` (RN-CR-02) e `:1537` (RN-CR-07); `financeiro/serie-dialog.tsx:117` (RN-CR-01) e `:150` (RN-CR-07). Mais 4 em recusas do domínio que chegam às telas da Estrutura: `packages/dominio/src/operations/structure.ts:430` (B47) e `operations/financeiro.ts:1810`, `:1824` e `:1827`. O de `pastas/[pasta]/page.tsx:167` está num comentário e não aparece.
  - **O que fazer:**
    1. Apagar o código entre parênteses de cada um dos 13 textos, sem mudar o resto da frase.
    2. Criar o teste `apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts`: lê os `.tsx` de `features/estrutura` e de `app/(shell)/estrutura`, descarta comentários e falha se achar `(RN-…)`, `(INV-…)`, `(B<número>)` ou `(A<número>.<número>)`.
  - **Pronto quando:** O teste novo passa; o diálogo “Criar Espaço” mostra a ajuda sem “(RN-ESP-03)”; criar uma série de parcelas sem Centro de Custo mostra “Centro de Custo é obrigatório.”

### 2.2 Otimizar o backend do CRUD de Espaço, Pasta e Lista

**Objetivo:** Cada gravação, de um nome de Lista a um Status de Tarefa, carrega o Espaço de Trabalho inteiro, roda a operação e disputa uma única revisão por Espaço de Trabalho: duas pessoas gravando ao mesmo tempo, mesmo em coisas diferentes, fazem uma delas recomeçar do zero. A tela só mostra a mudança quando o servidor responde. Nunca se mediu quanto disso pesa; esta tarefa mede, decide e corta o custo onde ele está.

**Pronto quando:** Os tempos de `createList`, `updateContainer`, `trashContainer` e `changeTaskStatus` medidos em produção antes e depois estão anotados; criar uma Lista aparece na árvore antes da resposta do servidor; duas gravações simultâneas no mesmo Espaço de Trabalho não hidratam de novo.

- [ ] **2.2.1 Medir quanto leva cada etapa de uma gravação** `api` `banco`
  - **Hoje:** `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`) faz, por tentativa: `hidratar` (um `select` de todo `plataforma.registros` do Espaço de Trabalho, `repositorio.ts:63`), `syncIdSequence`, a operação, o `update plataforma.workspaces set revisao = revisao + 1 where revisao = $2` e `gravar` (diff por JSON canônico de todos os registros, `repositorio.ts:161`). Nada disso é medido. O único número é o comentário de `repositorio.ts:9`, “cerca de 900 registros e 475 KB”, de antes do Financeiro e do CRM.
  - **O que fazer:**
    1. Em `executar()`, medir com `performance.now()` a duração de `hidratar`, da operação, da trava da revisão e de `gravar`, mais o número de tentativas e de linhas lidas, e devolver isso num campo `medicao` de `ResultadoTransacao`.
    2. Em `rotasDeOperacoes` (`apps/api/src/rotas/operacoes.ts`), registrar `medicao` com `request.log.info` junto do nome da operação.
    3. Rodar em produção, 10 vezes cada: criar Lista, renomear Lista, enviar à lixeira um Espaço com Listas e mudar o Status de uma Tarefa. Anotar mediana e pior caso de cada etapa.
    4. Rodar no banco de produção: `select colecao, count(*), pg_size_pretty(sum(pg_column_size(dados))::bigint) from plataforma.registros where workspace_id = '<id>' group by colecao order by sum(pg_column_size(dados)) desc;` e anotar o total.
  - **Pronto quando:** Uma tabela com os quatro gestos e as etapas (hidratar, operação, trava, gravar, tentativas), mais o tamanho real de `plataforma.registros`, anotada nesta tarefa antes da decisão abaixo.
- [ ] **2.2.2 Como otimizar?** `decisão` `banco` `api` `web` · *muda o produto*
  - **Como é hoje:** Gravar um contêiner custa o mesmo que gravar uma Tarefa: hidratar tudo, operar e comparar tudo. Mas contêiner se edita pouco; o que se grava o tempo todo é Tarefa. As operações de contêiner também escrevem fora dele: `createSpace` cria Tipo de Tarefa, Pasta e concessões (`structure.ts:103–135`); `trashContainer` e `archiveContainer` fecham cronômetros das Tarefas abaixo (`structure.ts:552`). E 23 arquivos do domínio e cerca de 22 da tela leem `state.spaces`, `state.folders` e `state.lists` direto do `DataState`.
  - **Você decide:**
    - (A) Tabelas próprias só para Espaço, Pasta e Lista, com rotas REST como as do CRM e uma projeção que os devolve ao `DataState`
    - (B) Ficar em `plataforma.registros` e cortar o custo onde ele está: travar no começo em vez de repetir, encadear as chamadas de um gesto e mostrar a mudança na hora
    - (C) Tabelas próprias para a Estrutura inteira (contêineres e Tarefas), numa sessão nova depois desta
  - **O que muda depois:** (A) custa 4 a 5 dias: migração, repositório, serviço, rotas, projeção de leitura e escrita (como a dos Canais) e troca das telas. Só acelera a gravação de contêiner, que é rara; a de Tarefa continua igual. (B) custa cerca de 2 dias e vale para toda gravação, Tarefa inclusive. (C) é o que resolve de vez, mas são 8 a 10 dias e mexe na maior parte do domínio.
  - **Recomendo:** (B) agora. Se a medição mostrar `hidratar` acima de 300 ms na mediana, planejar (C) como sessão própria. (A) não compensa: paga o preço de uma migração para acelerar o gesto menos usado.
- [ ] **2.2.3 Travar o Espaço de Trabalho no começo da transação em vez de repetir a gravação** `api`
  - **Hoje:** `executar()` lê a revisão, hidrata, roda a operação e só no fim tenta `update plataforma.workspaces … where revisao = $2` (`unidade-de-trabalho.ts:162`). Se outra gravação entrou no meio, desfaz e recomeça, até 3 vezes: quem perde hidrata o Espaço de Trabalho de novo, e no terceiro conflito a tela recebe 409 e re-hidrata tudo por `GET /estado` (`apps/web/src/dados/store.ts:172`).
  - **O que fazer:**
    1. Logo depois de `inicioDaTransacao()`, rodar `select revisao from plataforma.workspaces where workspace_id = $1 for update` e só então `hidratar`.
    2. O `update … revisao = revisao + 1` deixa de conferir a revisão (a linha já está travada). O `55P03` do `lock_timeout` continua virando conflito, como manda `apps/api/src/persistencia/CONTEXT.md`.
    3. Atualizar a seção “Os prazos do servidor e a trava esgotada” do `CONTEXT.md` da persistência.
  - **Pronto quando:** Um teste novo em `unidade-de-trabalho-trava.test.ts` dispara duas `executar()` ao mesmo tempo no mesmo Espaço de Trabalho: as duas gravam com uma tentativa cada e `hidratar` roda exatamente 2 vezes (pula sem `DATABASE_URL`, como os outros).
  - **Atenção:** Só com (B).
- [ ] **2.2.4 Aplicar todas as respostas de um gesto com várias chamadas, sem re-hidratar** `web`
  - **Hoje:** Quando um `run` chama mais de uma operação, `transporteHttp.gravar` (`apps/web/src/dados/transporte.ts:171`) manda as chamadas em sequência, todas com a mesma `pedido.revisao`, e devolve só a última resposta. O store compara a `revisaoAnterior` dessa última com a sua (`store.ts:129`), elas não batem, e ele re-hidrata o Espaço de Trabalho inteiro. O caso conhecido é `(shell)/page.tsx` (cria a Sessão de Chat e manda a mensagem). A ação em lote de Status não entra aqui: é uma operação só, `alterarStatusEmLote`.
  - **O que fazer:**
    1. `gravar` passa a devolver a lista de respostas, uma por chamada, parando na primeira que não for `diferenca`.
    2. `enviar` (`store.ts:123`) aplica as diferenças em ordem: cada uma só se a `revisaoAnterior` dela for a revisão atual do store; se uma não encaixar, aí sim re-hidrata.
  - **Pronto quando:** Um teste em `apps/web/src/dados/store.test.ts` com transporte falso: um `run` com duas chamadas aplica as duas diferenças e não chama `hidratar`.
  - **Atenção:** Só com (B).
- [ ] **2.2.5 Mostrar a mudança na tela antes da resposta do servidor** `web`
  - **Hoje:** `rodarNaCopia` (`apps/web/src/dados/store.ts:205`) roda a operação numa cópia, manda as chamadas e descarta a cópia: o `data` real só muda quando a diferença volta (`store.ts:142`). Criar uma Lista pelo diálogo (`features/estrutura/create-container-dialog.tsx:217`) espera essa volta para navegar.
  - **O que fazer:**
    1. O store guarda dois estados: `confirmado` (o que o servidor já devolveu) e `data` (o que a tela mostra). Uma operação aceita localmente vira o novo `data` na hora.
    2. Quando a diferença volta, aplicá-la em `confirmado` e refazer por cima as chamadas ainda pendentes, pelo registro `OPERACOES` (`@n1/dominio/operations/registro`), para obter o novo `data`.
    3. Se o servidor recusar, `data` volta a ser `confirmado` mais as pendentes, e `lastResult` mostra o erro, como hoje.
    4. O diálogo de criação continua esperando o id do servidor para navegar (`runConfirmado`), mas a árvore (`StructureTree`, `features/shell/app-shell.tsx:600`) já mostra a Lista nova.
  - **Pronto quando:** Um teste em `store.test.ts` com transporte lento: depois de `run(createList)`, `data.lists` já tem a Lista antes de o transporte responder; se o transporte devolver `ok: false`, a Lista some e `lastResult.error` traz a mensagem.
  - **Atenção:** Só com (B). O empurrão de mudanças entre telas abertas (trocar a pergunta a cada 5 s por tempo real) é da 3.4.
- [ ] **2.2.6 Criar as tabelas de Espaço, Pasta e Lista** `banco`
  - **Hoje:** Espaço, Pasta e Lista são linhas de `plataforma.registros` com `colecao` igual a `spaces`, `folders` ou `lists` e o objeto inteiro em `dados` (jsonb).
  - **O que fazer:**
    1. Migração nova com `plataforma.espacos`: `workspace_id`, `id`, `nome`, `descricao`, `icone`, `cor`, `ordem` (double precision), `privado` (boolean), `estado` (`ativo`, `arquivado`, `naLixeira`), `estado_antes_da_lixeira`, `arquivado_em`, `na_lixeira_em`, `modos` (jsonb), `bloqueios` (jsonb), `conjunto_de_status` (jsonb, obrigatório), `funcionalidades` (jsonb), `visualizacoes_padrao` (jsonb), `atalhos` (jsonb), `campos_herdados_fora` (jsonb), `proveniencia` (jsonb), `criado_por` (jsonb), `criado_em`, `atualizado_em`, chave `(workspace_id, id)`.
    2. `plataforma.pastas`: as mesmas colunas (sem `atalhos`, com `conjunto_de_status` opcional) mais `pai_tipo` (`space` ou `folder`), `pai_id`, `espaco_id` e `sprint` (jsonb).
    3. `plataforma.listas`: as colunas comuns (sem `bloqueios`) mais `pai_tipo`, `pai_id`, `espaco_id`, `modelo_de_tarefa`, `canais_de_atendimento`, `periodo_planejado`, `campos_editaveis_por_convidado` e `compartilhada_por_campos` (jsonb).
    4. Índice único do nome entre irmãos fora da lixeira, com a mesma regra de `nameTaken` (`structure.ts:33`: sem diferença de maiúsculas).
    5. Copiar os dados de `plataforma.registros` para as três tabelas e apagar as linhas copiadas na mesma migração.
  - **Pronto quando:** `npm run migrar -w @n1/api -- --seco` lista a migração; aplicada em homologação, `select count(*)` de cada tabela bate com o de `plataforma.registros` antes dela.
  - **Atenção:** Só com (A).
- [ ] **2.2.7 Criar o serviço e as rotas REST de contêiner** `api`
  - **Hoje:** Tudo passa por `POST /operacoes/:nome` com `createSpace`, `createFolder`, `createList`, `updateContainer`, `archiveContainer`, `unarchiveContainer`, `trashContainer` e `restoreContainer` (`apps/api/src/rotas/esquemas/estrutura.ts:92–99`).
  - **O que fazer:**
    1. `apps/api/src/repositorios/estrutura/conteineres.ts`: o SQL das três tabelas, no padrão de `repositorios/crm/funis.ts`.
    2. `apps/api/src/servicos/estrutura/conteineres.ts`: numa transação, trava o Espaço de Trabalho, monta o `DataState` com os contêineres das tabelas e o resto de `plataforma.registros`, roda a operação que já existe em `structure.ts` (a regra fica onde está), grava os contêineres nas tabelas e o resto (Tipos de Tarefa, concessões, Atividade, Tarefas da cascata) em `plataforma.registros`, e soma 1 à revisão do Espaço de Trabalho.
    3. Rotas em `apps/api/src/rotas/estrutura/`: `GET`/`POST /espacos`, `PATCH /espacos/:id`, `POST /espacos/:id/arquivar`, `/desarquivar`, `/restaurar`, `DELETE /espacos/:id` (lixeira), e o mesmo para `/pastas` e `/listas`.
    4. Tirar as 8 operações de `POST /operacoes/:nome`: o nome devolve 404 dizendo a rota nova.
  - **Pronto quando:** Testes em `apps/api/src/rotas/estrutura/*.test.ts` no padrão dos do CRM: criar, editar, arquivar e enviar à lixeira cada um, e `POST /operacoes/createList` devolve 404.
  - **Atenção:** Só com (A).
- [ ] **2.2.8 Projetar os contêineres das tabelas no `DataState`** `api`
  - **Hoje:** Os Canais da 008 fazem isso (`apps/api/src/persistencia/canais-projetados.ts`): entram em `GET /estado` e em `executar()`, nunca em `hidratar()`.
  - **O que fazer:**
    1. Criar `apps/api/src/persistencia/conteineres-projetados.ts` no mesmo formato: carregar as três tabelas para `state.spaces`, `state.folders` e `state.lists` em `rotas/estado.ts` e em `executar()`.
    2. Ao contrário dos Canais, a projeção também escreve: `overrideStatusSet`, `setContainerFeature`, `alterarModeloDaLista` e `definirCanaisDaLista` mudam o contêiner por `POST /operacoes`. Comparar a fotografia de antes com a de depois e gravar o que mudou nas tabelas, e tirar os projetados do estado antes de `gravar()`.
  - **Pronto quando:** Um teste prova que `setContainerFeature` por `POST /operacoes` grava em `plataforma.listas` e que nenhuma linha `colecao = 'lists'` volta para `plataforma.registros`.
  - **Atenção:** Só com (A).
- [ ] **2.2.9 Trocar as telas de contêiner para as rotas novas** `web`
  - **Hoje:** O diálogo de criação (`create-container-dialog.tsx:217`) e a Identidade e o Ciclo de vida (`identidade-e-ciclo-de-vida.tsx:68`, `:206`, `:217`, `:241`, `:262`) chamam as operações por `run`/`runConfirmado`.
  - **O que fazer:**
    1. Criar `apps/web/src/dados/estrutura/conteineres.ts` com `criarEspaco`, `criarPasta`, `criarLista`, `editarConteiner`, `arquivar`, `desarquivar`, `enviarParaLixeira` e `restaurar`, sobre um `chamarApi` igual a `chamarCrm` (`dados/crm/cliente-crm.ts:50`).
    2. As duas telas passam a chamá-las; depois de cada uma, o store aplica o registro devolvido em `data` (uma função nova `aplicarRegistro` em `store.ts`).
  - **Pronto quando:** Criar uma Lista pela tela grava uma linha em `plataforma.listas` e nenhuma em `plataforma.registros`.
  - **Atenção:** Só com (A).
- [ ] **2.2.10 Medir de novo depois da mudança** `api`
  - **Hoje:** Os números de antes ficam anotados na primeira subtarefa.
  - **O que fazer:** Repetir as mesmas medições, com os mesmos quatro gestos, depois do que a decisão escolheu.
  - **Pronto quando:** A tabela desta tarefa tem as colunas “antes” e “depois” preenchidas.

### 2.3 Mover e reordenar Pastas e Listas

**Objetivo:** Hoje só a Tarefa se move (`moveTask`, `packages/dominio/src/operations/tasks.ts:469`); Pasta e Lista ficam para sempre onde nasceram, e a ordem é a de criação. A ontologia descreve mover, promover, rebaixar e reordenar (RN-ESP-19, RN-SUB-11 e RN-SUB-12, “Reordenar” em `ontologia/02-estrutura-de-trabalho/espaco.md:222`). Esta tarefa cria as duas operações e o gesto na árvore.

**Pronto quando:** Arrastar uma Lista para outra Pasta na árvore leva as Tarefas junto, pede o mapeamento de Status quando o Conjunto muda, e a ordem nova continua depois de recarregar.

- [ ] **2.3.1 Criar a operação `moveContainer` para Pasta e Lista** `domínio`
  - **Hoje:** Não existe. `parentType` e `parentId` são `readonly` em `Folder` e `List` (`packages/dominio/src/types/structure.ts:221` e `:232`).
  - **O que fazer:**
    1. Tirar `readonly` de `parentType` e `parentId` em `Folder` e `List`.
    2. Criar `moveContainer(state, actingMemberId, tipo: "folder" | "list", id, destino: { parentType, parentId }, mapeamento?: StatusMapping[])` em `structure.ts`, reusando `StatusMapping` de `tasks.ts:455`.
    3. Recusar quando: falta `administrar` no movido ou `criar` no destino; o destino não está efetivamente ativo; o nome já existe entre os irmãos do destino (`nameTaken`); uma Pasta com Subpastas iria para dentro de outra Pasta (RN-SUB-11) ou qualquer Pasta iria para dentro de uma Subpasta (RN-SUB-02); o destino bloqueia um aspecto que o movido ou um descendente sobrescreve (RN-ESP-09, via `blockedAbove`); o destino fica no mesmo lugar ou abaixo do próprio movido.
    4. Se o Conjunto de Status herdado muda, exigir o mapeamento de cada Status em uso nas Tarefas abaixo, como `moveTask` faz, e aplicá-lo.
    5. Valores de Campo cujas Definições deixam de valer passam a `state: "arquivado"` (B37), como em `moveTask`.
    6. Uma Pasta que vai para o Espaço vira Pasta de nível 1 (“Subpasta promovida a Pasta”); uma Pasta sem Subpastas que vai para outra Pasta vira Subpasta (“Pasta rebaixada a Subpasta”). Cada caso grava a Atividade com esse nome; os outros gravam “Lista movida” ou “Pasta movida”, com origem e destino em `before` e `after`.
    7. Registrar em `operations/registro.ts`, `operations/index.ts` e no esquema `apps/api/src/rotas/esquemas/estrutura.ts` (sem esquema o `satisfies EsquemasCompletos` não compila).
  - **Pronto quando:** Um teste novo `packages/dominio/src/operations/mover-conteiner.test.ts` cobre: Lista para outra Pasta com o mesmo Conjunto (as Tarefas ficam e não mudam de Status); para um Espaço com outro Conjunto sem mapeamento (recusa) e com mapeamento (Status trocados); Campo que deixa de valer (Valor arquivado); Pasta com Subpastas para dentro de Pasta (recusa); promoção e rebaixamento (Atividade com o nome certo); destino que bloqueia Status sobrescrito no movido (recusa).
- [ ] **2.3.2 Criar a operação `reorderContainers`** `domínio`
  - **Hoje:** `order` nasce como o número de irmãos na criação (`structure.ts:93`, `:227`, `:352`) e nenhuma operação a muda. A árvore ordena por `order` (`features/shell/app-shell.tsx:645`).
  - **O que fazer:**
    1. Criar `reorderContainers(state, actingMemberId, pai: { type: "workspace" | "space" | "folder", id }, ids: Id[])` em `structure.ts`: recebe a permutação completa dos irmãos (Pastas e Listas do mesmo pai, ou os Espaços do Espaço de Trabalho), como `PUT /funis/:id/etapas/ordem` faz com as Etapas.
    2. Recusar se faltar ou sobrar id, se faltar `editar` no pai, ou se o pai não estiver ativo; gravar uma Atividade “Ordem alterada” no pai.
    3. Registrar em `registro.ts`, `index.ts` e `esquemas/estrutura.ts`.
  - **Pronto quando:** Teste em `mover-conteiner.test.ts`: reordenar três Listas de uma Pasta grava `order` 0, 1 e 2 na ordem pedida, e uma lista de ids incompleta é recusada.
- [ ] **2.3.3 Arrastar e soltar na árvore e “Mover para…” no menu** `web`
  - **Hoje:** A árvore (`StructureTree`, `features/shell/app-shell.tsx:600`, com `TreeSpace` `:667`, `TreeFolder` `:764`, `TreeList` `:840` e o menu de cada item em `TreeRow` `:1040`, com o `ActionMenu` em `:1140`) não arrasta nada. A árvore de Chat ao lado já move Sessão entre pastas (`moveChatSessionToFolder`, `app-shell.tsx:931`).
  - **O que fazer:**
    1. Arrastar uma Lista ou Pasta sobre outro item da árvore: soltar no meio de um Espaço ou Pasta chama `moveContainer`; soltar entre dois irmãos chama `reorderContainers`.
    2. Item “Mover para…” no menu de Pasta e de Lista, abrindo um diálogo novo `features/estrutura/mover-conteiner-dialog.tsx` com a escolha do destino; quando o Conjunto de Status muda, o diálogo mostra a tabela de mapeamento, no mesmo formato de `move-task-dialog.tsx`.
    3. A recusa do domínio aparece no diálogo ou num `Toast`, sem mover nada.
  - **Pronto quando:** Arrastar a Lista “Propostas” para a Pasta “Clientes” na árvore move a Lista e as Tarefas dela; arrastar uma Pasta com Subpastas para dentro de outra Pasta mostra a recusa e nada muda.

### 2.4 Converter item do checklist em Subtarefa

**Objetivo:** A conversão existe e funciona, mas assusta e engana: o botão é vermelho, a confirmação exige digitar o nome do item, o botão aparece numa Lista sem Subtarefas e no limite de níveis, e a mensagem de limite pede uma escolha que a tela não oferece. Subitem de checklist nem aparece na tela, e nenhuma operação o cria. Depois desta tarefa, o botão só aparece quando dá para converter, e converter é um clique e uma confirmação.

**Pronto quando:** Numa Lista com Subtarefas, converter um item cria a Subtarefa e o aviso leva até ela; numa Lista sem Subtarefas ou numa Tarefa no último nível, o botão não aparece.

- [ ] **2.4.1 Criar no domínio a recusa da conversão antes do clique** `domínio`
  - **Hoje:** As recusas só aparecem depois da confirmação: `convertChecklistItem` (`packages/dominio/src/operations/tasks.ts:590`) recusa o item de segundo nível (`:606`) e o nível acima de `state.workspace.maxSubtaskDepth` (`:612`), e quem recusa a Lista sem Subtarefas é o `createTask` chamado por dentro (`tasks.ts:137`, “Esta Lista não usa Subtarefas.”).
  - **O que fazer:**
    1. Criar `conversaoDeItemRecusada(state, actingMemberId, taskId)` em `packages/dominio/src/derive.ts`, devolvendo o motivo ou `undefined`: sem escrita na Tarefa, `features.subtarefas` desligada na Lista, ou `taskLevel(state, task) + 1 > state.workspace.maxSubtaskDepth` (`derive.ts:307`).
    2. `convertChecklistItem` passa a chamar essa função primeiro.
    3. Trocar a mensagem de `tasks.ts:614` (“Escolha outra Tarefa pai ou converta a partir de um nível acima.”) por “Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui.”
  - **Pronto quando:** Teste em `packages/dominio/src/operations/operations.test.ts`: `conversaoDeItemRecusada` devolve o motivo para Lista sem Subtarefas e para Tarefa no nível máximo, e `undefined` numa Tarefa de primeiro nível com Subtarefas ligadas; a mensagem nova aparece na recusa de `convertChecklistItem`.
- [ ] **2.4.2 Mostrar o botão só quando a conversão é possível, na cor normal** `web`
  - **Hoje:** Em `apps/web/src/features/estrutura/tarefa-completa.tsx:1783` o botão “Converter em Subtarefa” aparece sempre que a Tarefa é editável, com `style={{ color: "var(--erro)" }}` (`:1789`). A confirmação é `destructive` (`:802`), exige digitar o texto do item (`:803–820`) e, ao converter, usa `run` e mostra “Item convertido em Subtarefa: X” sem caminho até ela (`:410–416`).
  - **O que fazer:**
    1. Mostrar o botão só se `conversaoDeItemRecusada` devolver `undefined`.
    2. Tirar a cor de erro do botão e o `destructive` da confirmação.
    3. Trocar `run` por `runConfirmado` e pôr no aviso o link “Abrir” para a Subtarefa, com o id que o servidor devolveu.
    4. A confirmação por texto digitado segue a decisão abaixo.
  - **Pronto quando:** Numa Lista sem Subtarefas o botão não aparece; numa com Subtarefas ele aparece na cor normal, converter mostra o aviso com “Abrir”, e o link abre a Subtarefa nova.
- [ ] **2.4.3 Manter a confirmação por nome digitado?** `decisão` `web` · *muda o produto*
  - **Como é hoje:** Para converter, a pessoa digita o texto inteiro do item (`tarefa-completa.tsx:803`). A conversão não tem volta, mas não apaga nada: o item fica marcado como convertido, com o link para a Subtarefa. No ClickUp, converter é um clique no menu do item.
  - **Você decide:**
    - (A) Manter a digitação do nome
    - (B) Confirmar com um clique, sem digitar, com o aviso de que não há volta
    - (C) Converter direto, sem confirmação
  - **O que muda depois:** (A) não muda nada. (B) e (C) custam minutos. Com (C), um clique errado deixa uma Subtarefa a mais para enviar à lixeira.
  - **Recomendo:** (B).
- [ ] **2.4.4 O que fazer com os subitens de checklist?** `decisão` `domínio` `web` · *muda o produto*
  - **Como é hoje:** O tipo prevê subitem (`ChecklistItem.parentItemId`, `types/structure.ts:282`), e `convertChecklistItem` leva os subitens para um Checklist da Subtarefa nova (`tasks.ts:627`). Mas nenhuma operação cria subitem (`addChecklistItem`, `tasks.ts:896`, não aceita pai), nenhum seed tem subitem, e a Tarefa completa esconde os que existirem (`tarefa-completa.tsx:1693`). Na prática, subitem não existe.
  - **Você decide:**
    - (A) Criar subitens: `addChecklistItem` aceita `parentItemId`, a tela mostra o subitem recuado sob o item, e um subitem também pode virar Subtarefa
    - (B) Deixar subitens fora: tirar `parentItemId` do tipo e a migração de subitens de `convertChecklistItem`
  - **O que muda depois:** (A) custa cerca de 1 dia (domínio, esquema da API e tela) e entra nesta tarefa. (B) custa uma hora e simplifica o modelo; se um dia quiser subitens, eles voltam como trabalho novo.
  - **Recomendo:** (B) nesta sessão: ninguém usa subitem hoje, e o checklist de um nível cobre os seus testes.
- [ ] **2.4.5 Converter também pelo cartão do Quadro?** `decisão` `web` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** Só dá para converter com a Tarefa aberta (página, popup ou drawer, todos pela `tarefa-completa.tsx`). O cartão do Quadro (`features/estrutura/cartao-de-tarefa.tsx`) não mostra os itens do checklist.
  - **Você decide:**
    - (A) Sim: o cartão ganha um menu com os itens do checklist e “Converter em Subtarefa”
    - (B) Não: só com a Tarefa aberta
  - **O que muda depois:** (A) custa cerca de meio dia de tela. (B) não custa nada.
  - **Recomendo:** (B): para converter a pessoa precisa ver o item no contexto, e a Tarefa aberta dá esse contexto.

### 2.5 Remover a visualização de carga

**Objetivo:** A aba Carga soma a estimativa das Tarefas por Responsável e por semana, contra a capacidade semanal de cada Membro. Você pediu para tirá-la. Ela está espalhada por domínio, API e tela, e há Visualizações salvas que podem guardar o tipo `carga` no banco.

**Pronto quando:** Nenhuma Lista oferece a Carga; a API recusa salvar uma Visualização do tipo `carga`; nenhuma Visualização gravada tem esse tipo.

- [ ] **2.5.1 Tirar o tipo `carga` e o cálculo `workload` do domínio** `domínio`
  - **Hoje:** `View.kind` aceita `carga` (`packages/dominio/src/types/structure.ts:111`). `workload()` e `WorkloadCell` estão em `packages/dominio/src/derive.ts:1196–1227`. O teste “Carga: estimativa cai na semana do vencimento…” está em `operations/operations.test.ts:3361`.
  - **O que fazer:**
    1. Tirar `carga` da união `View.kind`.
    2. Apagar `workload` e `WorkloadCell` de `derive.ts`. `weekStartOf` (`derive.ts:1173`) fica: a Linha do tempo usa (`planning-views.tsx:71`).
    3. Apagar do teste de `operations.test.ts:3361` a parte da carga; a parte de capacidade segue a decisão abaixo.
  - **Pronto quando:** `npm run check` passa; `grep -rn workload packages apps --include='*.ts' --include='*.tsx'` não acha nada fora de `node_modules`.
- [ ] **2.5.2 Tirar `carga` do esquema da API** `api`
  - **Hoje:** `VIEW_KIND` em `apps/api/src/rotas/esquemas/escala.ts:12` aceita `carga`, e a linha `:104` confere que o esquema é igual ao tipo do domínio.
  - **O que fazer:** Tirar `carga` de `VIEW_KIND`; a conferência de `:104` passa a valer sozinha.
  - **Pronto quando:** Um teste em `apps/api/src/rotas/esquemas/escala.test.ts` prova que `saveView` com `kind: carga` é recusado com 400.
- [ ] **2.5.3 Trocar as Visualizações gravadas do tipo `carga` para `lista`** `banco`
  - **Hoje:** Uma Visualização salva com a aba Carga aberta guarda `kind: carga` em `plataforma.registros` (`colecao = 'views'`). Depois da mudança, `abaDaView` (`apps/web/src/features/estrutura/tipo-de-visualizacao.ts:22`) devolveria uma aba que não existe.
  - **O que fazer:**
    1. Contar antes: `select count(*) from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga';`.
    2. Migração nova (só dados): `update plataforma.registros set dados = jsonb_set(dados, '{kind}', '"lista"') where colecao = 'views' and dados->>'kind' = 'carga';`. Pode ser a mesma migração de dados da 2.6 (Listas sem `blocks`).
  - **Pronto quando:** Depois da migração, a contagem acima dá 0.
- [ ] **2.5.4 Tirar a aba Carga da tela** `web`
  - **Hoje:** A aba está em `listas/[lista]/page.tsx:658` (com os filtros das lentes em `:660` e `:662`) e desenha `CargaDeTrabalho` (`:993`; componente em `features/estrutura/planning-views.tsx:293`). `TipoDeAba` e `ROTULO_DA_ABA` têm `carga` (`tipo-de-visualizacao.ts:11` e `:19`). Não há teste de tela da Carga.
  - **O que fazer:**
    1. Tirar `carga` de `TipoDeAba` e de `ROTULO_DA_ABA`.
    2. Tirar `carga` do array de abas da página e simplificar os dois filtros: a financeira deixa de filtrar; a conversacional filtra só `linha`.
    3. Apagar `CargaDeTrabalho` de `planning-views.tsx` e os imports que sobrarem (`workload`, `memberCapacityMinutes`).
  - **Pronto quando:** A Lista mostra 5 abas (Lista, Quadro, Calendário, Tabela, Linha do tempo); a Lista conversacional mostra 4.
- [ ] **2.5.5 A capacidade semanal do Membro sai junto?** `decisão` `domínio` `web` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** Cada Membro tem `weeklyCapacityMinutes` (`packages/dominio/src/types/workspace.ts:128`), editado por `setMemberCapacity` (`operations/planning.ts:42`) no `CapacityEditor` (`app/(shell)/configuracoes/membros/page.tsx:468`) e mostrado na coluna “Capacidade/sem” (`:346`). Só a Carga lê esse número.
  - **Você decide:**
    - (A) Sai junto: tipo, operação, esquema da API, editor e coluna
    - (B) Fica, para um uso futuro
  - **O que muda depois:** (A) custa cerca de uma hora: tira `weeklyCapacityMinutes`, `memberCapacityMinutes`, `setMemberCapacity` (de `planning.ts`, `registro.ts`, `index.ts` e `apps/api/src/rotas/esquemas/planejamento.ts`), o `CapacityEditor`, a coluna e o trecho de capacidade do teste de `operations.test.ts:3373–3376`. (B) deixa um campo na tela de Membros que não muda nada.
  - **Recomendo:** (A).

### 2.6 Fechar as lacunas do modelo da Estrutura

**Objetivo:** Comparando o modelo com o artefato “Estrutura de Trabalho N1” e com a ontologia, faltam cinco coisas: as Visualizações padrão do Espaço não têm onde morar; a Lista aceita bloqueio, que não tem efeito nela; nenhuma operação grava bloqueio; a descrição da Tarefa não aceita menção e o histórico não guarda o texto anterior; e o tempo registrado é somado só na tela, de dois jeitos diferentes. Cada lacuna sai com tipo, operação, teste e tela.

**Pronto quando:** Mudar as Visualizações no Espaço muda as abas das Listas abaixo; bloquear os Status num Espaço impede uma Lista de mudá-los; uma menção na descrição avisa a pessoa; o histórico mostra o texto anterior da descrição; e a Tarefa e o seu editor de tempo mostram o mesmo total.

- [ ] **2.6.1 Criar as Visualizações padrão no Espaço, herdadas pelas Listas** `domínio` `api`
  - **Hoje:** `defaultViews` existe só como nome de aspecto (`ConfigurableAspect`, `types/structure.ts:84`) e como linha da tabela das Configurações; não há campo nem operação. Hoje a Lista abre na Visualização salva marcada `isDefault` dela, ou na aba Lista (`listas/[lista]/page.tsx:121–124`), e as abas são fixas. A ontologia diz que o Espaço define “quais tipos de Visualização estão disponíveis e qual é a inicial nas Listas descendentes que herdam” (`ontologia/02-estrutura-de-trabalho/espaco.md:94`), e que o aspecto substitui (RN-ESP-08).
  - **O que fazer:**
    1. Em `types/structure.ts`: `type TipoDeVisualizacao = View["kind"]` e `interface VisualizacoesPadrao { disponiveis: TipoDeVisualizacao[]; inicial: TipoDeVisualizacao }`; campo opcional `defaultViews?: VisualizacoesPadrao` em `StructuralContainerBase`; campo `views: VisualizacoesPadrao` em `EffectiveListConfig`.
    2. Constante `VISUALIZACOES_DA_PLATAFORMA` (as cinco abas, inicial `lista`) para o Espaço que ainda não definiu: assim os dados atuais não precisam de migração.
    3. `effectiveContainerConfig` (`derive.ts:176`) resolve `views` pelo ponto de definição mais próximo, como faz com `features`.
    4. Operação `setContainerDefaultViews(state, actingMemberId, tipo, id, valor | null)` em `operations/configuration.ts`, ao lado de `setContainerFeature` (`:825`): exige administrar, contêiner ativo e `blockedAbove(…, "defaultViews")` vazio; recusa `disponiveis` vazio e `inicial` fora de `disponiveis`; `null` volta a herdar; grava `modes.defaultViews` e uma Atividade “Visualizações padrão alteradas” com antes e depois.
    5. `saveView` (`operations/scale.ts:117`) recusa salvar uma Visualização de tipo que a Lista não tem disponível.
    6. Registrar em `registro.ts`, `index.ts` e `apps/api/src/rotas/esquemas/configuracao.ts`.
  - **Pronto quando:** Teste novo `packages/dominio/src/operations/visualizacoes-padrao.test.ts`: o Espaço tira o Calendário e as Listas abaixo deixam de tê-lo; uma Pasta sobrescreve e a Lista dela segue a Pasta; `null` volta ao Espaço; `inicial` fora de `disponiveis` é recusado; `saveView` de tipo indisponível é recusado.
- [ ] **2.6.2 Usar as Visualizações padrão na Lista e editá-las nas Configurações** `web`
  - **Hoje:** As abas são uma lista fixa em `listas/[lista]/page.tsx:658`, filtrada só pela lente (financeira, conversacional). Não há editor.
  - **O que fazer:**
    1. A página monta as abas de `config.views.disponiveis`, ainda filtradas pela lente.
    2. A aba inicial passa a ser: a Visualização salva `isDefault` da Lista, se o tipo dela estiver disponível; senão, `config.views.inicial`.
    3. Aba “Visualizações” nas Configurações (a da 2.1): uma caixa por tipo e a escolha da inicial, chamando `setContainerDefaultViews`, com “Voltar a herdar” quando o contêiner tem definição própria.
  - **Pronto quando:** Desmarcar “Calendário” nas Configurações do Espaço Entrega faz a aba sumir de todas as Listas dele; escolher “Quadro” como inicial faz as Listas sem Visualização padrão própria abrirem no Quadro.
- [ ] **2.6.3 Tirar o bloqueio da Lista** `domínio` `banco`
  - **Hoje:** `blocks` está em `StructuralContainerBase` (`types/structure.ts:184`), herdado também por `List`, e `createList` grava `blocks: {}` (`operations/structure.ts:358`). Bloquear impede os níveis ABAIXO de sobrescrever; abaixo da Lista só há Tarefa, que nunca define nada (ontologia, `espaco.md:344`). Bloqueio na Lista não tem efeito.
  - **O que fazer:**
    1. Mover `blocks` de `StructuralContainerBase` para `Space` e `Folder`.
    2. Tirar `blocks: {}` de `createList` e de `solicitacao-de-pagamento-evolver.ts:158`.
    3. Em `blockedAbove` (`configuration.ts:42`) e em `instantiateListTemplate` (`operations/planning.ts:391`), ler `blocks` só de Espaço e Pasta.
    4. Na migração de dados da 2.5: `update plataforma.registros set dados = dados - 'blocks' where colecao = 'lists';`.
  - **Pronto quando:** `npm run check` passa (o tipo não deixa escrever `blocks` numa Lista); depois da migração, `select count(*) from plataforma.registros where colecao = 'lists' and dados ? 'blocks'` dá 0.
- [ ] **2.6.4 Tirar o modo `bloqueado` que ninguém grava** `domínio` `web`
  - **Hoje:** `InheritanceMode` tem `herdado`, `sobrescrito` e `bloqueado` (`types/structure.ts:73`), e o bloqueio também mora em `blocks`. Nenhum código grava `modes[…] = "bloqueado"`; só `container-settings.tsx` lê, para pintar a etiqueta. Um contêiner pode sobrescrever e bloquear ao mesmo tempo, coisa que um modo único não expressa.
  - **O que fazer:**
    1. Tirar `bloqueado` de `InheritanceMode`; o bloqueio fica só em `blocks`.
    2. Tirar `MODE_LABEL.bloqueado` de `container-settings.tsx` (a tabela já sai na 2.1).
  - **Pronto quando:** `grep -rn 'bloqueado' packages/dominio/src/types/structure.ts` não acha nada; `npm run check` passa.
- [ ] **2.6.5 Criar a operação `setContainerBlock` e o botão de bloquear** `domínio` `api` `web`
  - **Hoje:** `blockedAbove` confere o bloqueio ao sobrescrever Status (`configuration.ts:660`), ao criar Campo (`:146`), ao criar Tipo de Tarefa (`:737`), ao mudar Funcionalidade (`:838`) e ao instanciar Template de Lista (`planning.ts:389`). Não confere ao criar Automação (`criarAutomacao`, `operations/ia/automacoes-editor.ts:194`). Nenhuma operação grava `blocks`: só o seed (`seed.ts:290`).
  - **O que fazer:**
    1. Criar `setContainerBlock(state, actingMemberId, tipo: "space" | "folder", id, aspecto, bloqueado: boolean)` em `configuration.ts`: exige administrar e contêiner ativo.
    2. Para os aspectos que substituem (`statusSet`, `features`, `defaultViews`), recusar enquanto algum descendente sobrescrever o aspecto, e listar quais na mensagem (RN-ESP-09). Para os que acumulam (`fieldDefinitions`, `taskTypes`, `automations`), bloquear vale só para o que for criado depois.
    3. Função auxiliar `sobrescritasAbaixo(state, tipo, id, aspecto)` em `derive.ts`, usada pela operação e pela tela.
    4. Passar a chamar `blockedAbove(…, "automations")` em `criarAutomacao` quando o escopo for Pasta ou Lista.
    5. Atividade “Aspecto bloqueado” / “Aspecto desbloqueado” com o aspecto em `detail`.
    6. Registrar em `registro.ts`, `index.ts` e `esquemas/configuracao.ts`.
    7. Nas abas de aspecto das Configurações de Espaço e Pasta (2.1), um interruptor “Bloquear para os níveis abaixo”; com sobrescritas abaixo, ele fica desligado e mostra a lista delas, cada uma com link para as Configurações dela.
  - **Pronto quando:** Teste novo `packages/dominio/src/operations/bloqueio-de-aspecto.test.ts`: bloquear Status num Espaço sem sobrescrita abaixo funciona e `overrideStatusSet` numa Lista dele passa a ser recusado; com uma Pasta que sobrescreve, o bloqueio é recusado e a mensagem nomeia a Pasta; bloquear Campos deixa os existentes e recusa um novo; bloquear Automações recusa `criarAutomacao` numa Lista abaixo.
- [ ] **2.6.6 Aceitar menções na descrição da Tarefa** `domínio` `api` `web`
  - **Hoje:** A descrição é texto simples, editada em `TaskTitleDescriptionEditor` (`apps/web/src/features/estrutura/task-editors.tsx:41`) e mostrada em `tarefa-completa.tsx:963–976`. Menção existe só no Comentário: `Comment.mentions` (`types/primitives.ts:189`), o menu do “@” do `CommentComposer` (`task-editors.tsx:471–520`) e `pendingMentions` (`derive.ts:1071`), que alimenta “Menções a você” em `app/(shell)/notificacoes/page.tsx:77`.
  - **O que fazer:**
    1. Campo `descriptionMentions?: { type: "member"; id: Id }[]` em `Task` (`types/structure.ts`).
    2. `UpdateTaskInput` (`tasks.ts:1419`) ganha `descriptionMentions`; `updateTask` grava junto com a descrição e recusa Membro inexistente, como `addTaskComment` faz (`tasks.ts:1764`). Atualizar o esquema de `updateTask` em `apps/api/src/rotas/esquemas/tarefas.ts`.
    3. Tirar do `CommentComposer` a lógica do “@” para um hook `useMencoes` em `features/estrutura/mencoes.ts`, e usá-lo no editor da descrição.
    4. Na Tarefa completa, o nome mencionado aparece destacado na descrição.
    5. O aviso à pessoa mencionada segue a decisão abaixo.
  - **Pronto quando:** Teste em `operations.test.ts`: `updateTask` com descrição “@Júlia revisar” e a menção grava `descriptionMentions`; Membro inexistente é recusado. Na tela, digitar “@Jú” na descrição abre o menu de Membros.
- [ ] **2.6.7 Uma menção na descrição avisa a pessoa?** `decisão` `domínio` `web` · *muda o produto*
  - **Como é hoje:** A menção num Comentário aparece em Notificações › “Menções a você” até a conversa ser resolvida (`pendingMentions`, `derive.ts:1071`). A descrição não tem “resolvido”, e não existe registro de “já vi”.
  - **Você decide:**
    - (A) Não avisa: a menção só destaca o nome
    - (B) Avisa em “Menções a você” enquanto o nome estiver na descrição e a Tarefa estiver aberta (fora de categoria terminal)
  - **O que muda depois:** (A) não custa nada além da subtarefa acima. (B) custa cerca de 2 horas: `pendingMentions` passa a ler também `descriptionMentions`, e a tela de Notificações mostra o trecho da descrição.
  - **Recomendo:** (B): é o que o ClickUp faz, e a regra sai do dado, sem guardar estado novo.
- [ ] **2.6.8 Guardar o texto anterior a cada edição da descrição** `domínio` `web`
  - **Hoje:** `updateTask` grava só “Descrição alterada”, sem `before` nem `after` (`packages/dominio/src/operations/tasks.ts:1458`). O Título grava os dois (`:1453`). A linha do tempo mostra `(antes → depois)` no meio da frase (`apps/web/src/features/tarefa/timeline.tsx:294`), o que não serve para um texto longo.
  - **O que fazer:**
    1. Em `tasks.ts:1458`, gravar `before` e `after` com a descrição antiga e a nova, cortadas em 2.000 caracteres com “…” no fim.
    2. Em `timeline.tsx`, para a ação “Descrição alterada”, mostrar só “Descrição alterada” e um botão “Ver alteração”, que abre o texto anterior e o novo, um embaixo do outro.
  - **Pronto quando:** Teste em `operations.test.ts`: editar a descrição de “A” para “B” grava uma Atividade com `before: "A"` e `after: "B"`; uma descrição de 3.000 caracteres grava 2.000 e “…”. Na tela, “Ver alteração” mostra os dois textos.
- [ ] **2.6.9 Calcular o tempo registrado no domínio** `domínio` `web`
  - **Hoje:** Há duas somas diferentes na tela: `tarefa-completa.tsx:1199` soma `durationMinutes` de todos os lançamentos (o aberto conta 0) e o editor `TaskTime` soma só os fechados (`features/estrutura/collaboration-editors.tsx:199`). Painéis e IA não têm de onde ler.
  - **O que fazer:**
    1. Criar `tempoRegistrado(state, taskId)` em `packages/dominio/src/derive.ts`, devolvendo `{ minutos, lancamentos, emAndamento, minutosComSubtarefas }`: soma os fechados, diz se há cronômetro aberto e soma também as Subtarefas.
    2. `tarefa-completa.tsx:1199` e `collaboration-editors.tsx:199` passam a usar a função.
  - **Pronto quando:** Teste novo `packages/dominio/src/tempo-registrado.test.ts`: uma Tarefa com lançamentos de 30 e 45 min e um cronômetro aberto devolve 75 min e `emAndamento: true`; com uma Subtarefa de 20 min, `minutosComSubtarefas` é 95. Na tela, a linha “Rastrear tempo” e o editor mostram o mesmo número.

### 2.7 Itens relatados nos testes

**Objetivo:** O que você relatar nos testes da Estrutura entra aqui, um por subtarefa, no mesmo formato das outras.

**Pronto quando:** Cada item aprovado por você.

_Nenhuma subtarefa ainda._

**A sessão fica pronta quando:** Você aprova as telas da Lista, do Espaço, da Pasta e das Configurações depois da limpeza; os tempos de gravação antes e depois estão anotados na 2.2; mover uma Lista para outra Pasta funciona pela árvore; nenhuma Lista oferece a Carga; e `npm run check` passa com os testes novos de bloqueio, visualizações padrão, menções na descrição e tempo registrado.

---

## Sessão 3 · Base da mensageria e unificação do CRM

Duas coisas, nesta ordem. Primeiro, acabar com as duas bases do CRM: as telas novas (`/crm/contatos`, `/crm/empresas`, `/crm/negocios`, `/crm/funis`) já leem as tabelas da 007, mas a Caixa de Entrada, a Tarefa conversacional, Meus negócios, Busca, Lixeira, Notificações, Início, Ferramentas, IA, Painel e Contas a receber ainda leem `state.contacts`, `state.conversations`, `state.deals`, `state.funnels` e `state.channels`, guardados em `plataforma.registros`. Depois, construir uma vez só o que os quatro provedores (Sessões 4, 7, 8 e 9) usam: porta de entrada, porta de saída, tempo real e mídia. Esta sessão recebeu da Sessão 5 o trabalho de levar a Tarefa conversacional para as tabelas novas (tarefa 3.3).

**Depende de:** Sessão 1.

> **Ajuste sugerido:** +9 dias: o modelo antigo do CRM é usado por cerca de 70 arquivos da tela e 33 do domínio, e a sessão recebeu a Tarefa conversacional (que estava na Sessão 5) e a ponte do Painel.

**Ponto de partida:**
- Tabelas `plataforma.canais`, `plataforma.conversas` e `plataforma.mensagens` (008), com as rotas `GET/POST /conversas`, `POST /conversas/:id/resolver`, `POST /conversas/:id/reabrir` e `GET/POST /mensagens`. Nenhuma tela chama as de Conversa e Mensagem: `apps/web/src/dados/crm/` não tem cliente para elas.
- Mensagem repetida já é barrada pelo índice `mensagens_id_externo_uq`, em `(workspace_id, canal_id, id_externo)`.
- `registrarRecebida` (`apps/api/src/servicos/crm/mensagens.ts:141`) grava a recebida, mas não tem rota, exige uma Conversa já existente, não acha nem cria Contato e não reabre Conversa resolvida.
- A janela de 24 h é decidida por (tipo, provedor) em `validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) e aplicada por `ServicoDeMensagens.enviar` (`servicos/crm/mensagens.ts:91`). O envio só grava: nada sai do sistema.
- Há o molde de fila com `for update skip locked` (`reivindicar`, `apps/api/src/persistencia/outbox-worker.ts:157`) e o upload em duas fases por URL assinada (`apps/api/src/servicos/storage-uploads.ts`), hoje só para Formulário e anexo de Tarefa.
- O modelo antigo é lido por cerca de 70 arquivos de `apps/web/src` e 33 de `packages/dominio/src` (sem contar testes). A ponte `apps/api/src/persistencia/canais-projetados.ts` traduz os Canais novos para `state.channels`, em `GET /estado` e em `executar()`.

### 3.1 Decidir o corte e dar ao modelo novo o que falta

**Objetivo:** As tabelas novas não guardam várias coisas que as telas antigas usam: notas, consentimento, mesclagem, estrela e leitura da Conversa, Conversa de Grupo, vários Contatos por Negócio. Antes de trocar qualquer tela, é preciso decidir o que vem junto e criar as colunas e tabelas numa migração nova.

**Pronto quando:** As quatro decisões têm resposta escrita e a migração nova está aplicada em homologação.

- [ ] **3.1.1 Como fazer o corte?** `decisão` · *muda o produto*
  - **Como é hoje:** Há duas bases de Contatos, Empresas, Negócios, Funis, Canais e Conversas. Uma Conversa aberta pelo fio da Caixa (`startConversation`, `packages/dominio/src/operations/conversations.ts:694`) ou por “Iniciar conversa” em Meus negócios (`iniciarConversa`, `packages/dominio/src/operations/iniciar-conversa.ts:52`) grava na base antiga; uma aberta por `POST /conversas` grava na nova.
  - **Você decide:**
    - (A) De uma vez: preparar tudo, rodar o script de migração (3.5) em homologação e trocar todas as telas no mesmo deploy
    - (B) Tela por tela, com as duas bases convivendo
  - **O que muda depois:** (A) concentra o risco num dia, mas não precisa de ponte nova e acaba logo. (B) exige que cada tela traduza ids antigos e novos enquanto a outra base ainda grava: cerca de +2 dias de pontes que depois são jogadas fora.
  - **Recomendo:** (A), primeiro em homologação. A produção nasce sem dados de demonstração (`bootstrap:gestao`), então o que há de real no modelo antigo deve ser pouco; o modo `--seco` do script conta antes.
- [ ] **3.1.2 O que o modelo novo precisa ganhar antes de o antigo sair?** `decisão` · *muda o produto*
  - **Como é hoje:** As fichas novas avisam o que a 007 não guarda (`apps/web/src/features/crm/ficha-de-contato.tsx:11`, `ficha-de-negocio.tsx:8`): Tags, Consentimentos, Comentários, Anexos, mesclagem, temperatura, vários Contatos por Negócio com papel e histórico de Etapas. A Conversa da 008 não tem estrela, leitura, rascunho nem Tags. Tudo isso existe no modelo antigo, e alguma tela usa.
  - **Você decide:**
    - (A) Trazer tudo antes do corte
    - (B) Trazer só o que a Caixa usa no dia a dia ou que a mensageria exige: notas do Contato, consentimento, mesclagem, transferir Identificador, mover Conversa, atribuir, estrela, leitura e lixeira da Conversa
    - (C) Não trazer nada: as telas perdem esses recursos
  - **O que muda depois:** (A) cerca de +4 dias. (B) cerca de +2 dias; Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio somem da tela até uma sessão própria. (C) +0, mas a porta de entrada vai criar Contatos duplicados sem jeito de juntá-los.
  - **Recomendo:** (B). As subtarefas da 3.2 e a migração abaixo estão escritas para (B).
- [ ] **3.1.3 Quando a Conversa de Grupo e as Mensagens de Flow saem do modelo antigo?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** As Ferramentas acham a Conversa do Grupo por `groupIdentifier` (`conversaDoGrupo`, `packages/dominio/src/derive-ferramentas.ts:145`) e contam envios e respostas de Flow pelas Mensagens antigas (`enviosDoFlow`, `:275`; `respostasDoFlow`, `:287`; `receiveMessage` em `operations/ferramentas/flows.ts:922`). A 008 não aceita Conversa sem Contato (`contato_id not null`) e a Mensagem nova não tem campo de Flow.
  - **Você decide:**
    - (A) Migração nova: `conversas.contato_id` aceita nulo quando há `identificador_de_grupo`, e `mensagens` ganha `flow` e `resposta_de_flow` (jsonb); as Ferramentas passam inteiras para as tabelas
    - (B) Conversas de Grupo e Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7, que já refazem essas telas com o provedor real; aqui só os Contatos e Canais das Ferramentas passam para os ids novos
  - **O que muda depois:** (A) cerca de +1,5 dia aqui, e o modelo antigo sai por inteiro nesta sessão. (B) +0 aqui; um resto de `Conversation` (só Grupo e Flow) vive até a Sessão 7. Com (B), a Sessão 6 decide como guardar a Conversa de Grupo nas tabelas novas (6.6.5) e a leva para lá, e a Sessão 7 faz o mesmo com as Mensagens de Flow.
  - **Recomendo:** (B): as Sessões 6 e 7 vão reescrever Grupos e Flows; fazer duas vezes é desperdício.
- [ ] **3.1.4 Meus negócios continua como Listas espelho?** `decisão` · *muda o produto*
  - **Como é hoje:** A Pasta “Meus negócios” tem uma Lista por Funil antigo, achada pelo formato do id (`funilDaLista`: `lst_funil_<x>` ↔ `fnl_<x>`, `operations/iniciar-conversa.ts:30`), e cada Negócio aparece como Tarefa espelho no quadro (`QuadroNegocios`, `apps/web/src/features/estrutura/quadro-negocios.tsx:32`), com a `DealScreen` antiga embutida (`app/(shell)/estrutura/listas/[lista]/page.tsx:1131`). O CRM novo já tem quadro próprio em `/crm/funis/[funil]` (`features/crm/quadro-do-funil.tsx`). Os Funis novos têm id UUID: a regra do formato do id quebra.
  - **Você decide:**
    - (A) Manter as Listas espelho: a Lista ganha o campo `funilId` (id de `plataforma.funis`) e a Tarefa espelho aponta para o Negócio novo
    - (B) Aposentar as Listas espelho: “Meus negócios” vira o quadro de `/crm/funis/[funil]` com o filtro “meus”, e as Reuniões continuam como Tarefas ligadas ao Negócio novo
  - **O que muda depois:** (A) cerca de +1 dia e mantém duas telas para o mesmo Negócio. (B) cerca de +0,5 dia e some uma tela; quem trabalha pela Lista muda de lugar.
  - **Recomendo:** (B), se a equipe já usa o quadro do Funil novo; (A), se o dia a dia é pela Lista.
- [ ] **3.1.5 Escrever a migração nova com o que as decisões pedirem** `banco`
  - **Hoje:** A 007 e a 008 estão aplicadas e são imutáveis. `contatos_estado_ck` (007) não aceita `mesclado`; não há tabela de consentimento, de nota, de marcação de Conversa, de fila de entrada nem de de-para de ids.
  - **O que fazer:**
    1. `plataforma.contatos`: colunas `mesclado_em_id text` e `mesclado_em timestamptz`; recriar `contatos_estado_ck` aceitando `mesclado`.
    2. `plataforma.contato_consentimentos` (só inserção): `contato_id`, `finalidade_id` (o item de Catálogo `finalidadeConsentimento`), `tipo_de_canal` (`whatsapp`, `instagram`, `email` ou `todos`), `decisao` (`concedido` ou `revogado`), `em`, `origem`, `evidencia_mensagem_id`, `registrado_por`, `registrado_em`.
    3. `plataforma.contato_notas`: `contato_id`, `conteudo`, `autor_id`, `criado_em`.
    4. `plataforma.conversa_marcacoes`: chave `(workspace_id, conversa_id, membro_id)`, com `estrela boolean` e `lida_ate timestamptz`. Estrela e leitura são por Membro, como o `starredBy` antigo.
    5. `plataforma.webhooks_recebidos` (fila de entrada, ver 3.6) e o índice único do evento `mensagem.enviar.v1` em `plataforma.integration_outbox` (ver 3.7).
    6. `plataforma.crm_de_para` (`workspace_id`, `colecao_antiga`, `id_antigo`, `tabela_nova`, `id_novo`, `migrado_em`; chave `(workspace_id, colecao_antiga, id_antigo)`) e `plataforma.registros_crm_antigo` (cópia de segurança das linhas antigas, mesmo formato de `registros`), para o script da 3.5.
  - **Pronto quando:** `npm run migrar -w @n1/api -- --seco` lista só a migração nova em homologação; depois de aplicada, um teste em `apps/api/src/persistencia/` prova que `contatos_estado_ck` aceita `mesclado` e que `contato_consentimentos` recusa `decisao = 'talvez'`.
  - **Atenção:** Se a decisão sobre Grupos e Flows for (A), entram aqui também `conversas.identificador_de_grupo` e `mensagens.flow` / `mensagens.resposta_de_flow`.

### 3.2 Levar ao modelo novo as operações que só existem no antigo

**Objetivo:** Mesclar Contatos, transferir um Identificador, mover uma Conversa, registrar consentimento e os gestos da Caixa (atribuir, estrela, lixeira) só existem sobre `state.contacts` e `state.conversations`. Sem eles no modelo novo, a porta de entrada cria duplicados que ninguém junta e a Caixa perde gestos que usa hoje.

**Pronto quando:** Cada operação tem a regra em `packages/dominio/src/crm/`, a rota no `apps/api` e teste de serviço contra o Postgres real.

- [ ] **3.2.1 Criar o caminho para gestos que gravam nas tabelas do CRM e em `plataforma.registros` no mesmo commit** `api`
  - **Hoje:** As rotas do CRM gravam por `comTransacao` (`apps/api/src/servicos/crm/transacao.ts`) e as operações do Espaço por `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`): são duas transações. Mesclar Contatos (que move Vínculos de Tarefa) e criar Tarefa conversacional (Tarefa em `registros`, Conversa em `plataforma.conversas`) precisam das duas juntas.
  - **O que fazer:**
    1. Criar `apps/api/src/servicos/crm/gesto-misto.ts` com `executarGestoMisto(workspaceId, { lerDoCrm, operacao, gravarNoCrm })`.
    2. `lerDoCrm(cliente)` roda logo depois de `hidratar()`, no mesmo `PoolClient`, e o que devolve chega à `operacao` pura (Contato, Canal, Conversa já conferidos). Para isso `executar()` ganha a opção `lerDoCrm`.
    3. `gravarNoCrm(cliente, valor)` roda pela opção `aoConfirmar` que já existe (`unidade-de-trabalho.ts:74`): mesmo cliente, antes do `commit`.
    4. Os ids das linhas novas do CRM são gerados antes (`randomUUID`), para a operação pura já gravar o Vínculo com o id certo.
    5. Erro em `gravarNoCrm` desfaz tudo; um `23505` (unicidade) vira 409 com a frase do domínio.
  - **Pronto quando:** Teste em `apps/api/src/servicos/crm/gesto-misto.test.ts`: forçar erro em `gravarNoCrm` deixa `plataforma.registros` e `plataforma.conversas` sem nenhuma linha nova.
- [ ] **3.2.2 Mesclar Contatos no modelo novo** `domínio` `api` `web`
  - **Hoje:** `mergeContacts` (`packages/dominio/src/operations/contacts.ts:143`) mexe só em `state.contacts` e nos Vínculos. O diálogo `apps/web/src/features/crm/merge-contacts-dialog.tsx` só abre na ficha antiga (`features/crm/legado/ficha-de-contato-legado.tsx:171`).
  - **O que fazer:**
    1. Domínio: `validarMesclagem(sobrevivente, absorvido)` em `packages/dominio/src/crm/contatos.ts`: os dois diferentes, `ativo` ou `arquivado`, nenhum `mesclado`. Com teste das recusas.
    2. API: rota `POST /contatos/:id/mesclar` com `{ absorvidoId }`, por `executarGestoMisto`. Nas tabelas: passa ao sobrevivente os Identificadores, as Conversas (resolvendo antes a do absorvido que colidir em `conversas_nao_resolvida_uq`), os Negócios (`negocios.contato_id`) e os vínculos com Empresa; marca o absorvido `mesclado` com `mesclado_em_id`. Em `registros`: troca o `toId` dos Vínculos de Tarefa do absorvido para o sobrevivente.
    3. `GET /contatos/:id` de um `mesclado` devolve `mescladoEmId`, e `app/(shell)/crm/contatos/[contato]/page.tsx` redireciona para o sobrevivente.
    4. Web: ação “Mesclar com…” em `features/crm/ficha-de-contato.tsx`, reaproveitando `merge-contacts-dialog.tsx` com o seletor de Contato de `dados/crm/contatos.ts` (`useContatos`).
  - **Pronto quando:** Mesclar A em B pela ficha: as Conversas e Negócios de A aparecem em B, a Tarefa conversacional de A mostra B e abrir `/crm/contatos/<A>` leva a B. Um teste de serviço cobre a colisão de Conversa aberta no mesmo Canal.
  - **Atenção:** “Restaurar cópia” de um mesclado (`restoreMergedCopy`, `contacts.ts:403`) e “marcar como distintos” (`markContactsAsDistinct`, `:713`) não são trazidos: só a ficha antiga os oferece.
- [ ] **3.2.3 Transferir um Identificador para outro Contato** `domínio` `api` `web`
  - **Hoje:** `transferContactIdentifier` (`packages/dominio/src/operations/contacts.ts:93`) muda só quem recebe as próximas mensagens (DO-CON-12): as Conversas passadas ficam no Contato de origem. Só a ficha antiga oferece (`features/crm/transfer-identifier-dialog.tsx`).
  - **O que fazer:**
    1. Rota `POST /contatos/:id/identificadores/:identificadorId/transferir` com `{ paraContatoId }` em `apps/api/src/rotas/crm/contatos.ts`, chamando o método novo `transferirIdentificador` de `servicos/crm/contatos.ts`.
    2. Troca `contato_identificadores.contato_id`; o Identificador só chega como principal se o destino não tiver um principal do mesmo tipo (`rebaixarPrincipal` já existe no repositório).
    3. Recusa destino `mesclado` ou na lixeira, com a frase em `packages/dominio/src/crm/contatos.ts`.
    4. Na ficha nova, ação “Transferir” na linha do Identificador, reaproveitando o diálogo.
  - **Pronto quando:** Teste de serviço: depois de transferir o WhatsApp de A para B, uma recebida desse número (3.6) cai numa Conversa de B, e a Conversa antiga continua em A.
- [ ] **3.2.4 Registrar e respeitar consentimento** `domínio` `api` `web`
  - **Hoje:** O consentimento é uma lista no Contato antigo (`ConsentRecord`, `packages/dominio/src/types/crm.ts:59`), lida por `marketingConsentMissing` (`packages/dominio/src/derive.ts:443`), que `sendMessage` e o fio (`features/crm/conversation-thread.tsx:352`) usam para barrar modelo de marketing. Não existe operação que registre consentimento: só o seed preenche.
  - **O que fazer:**
    1. Domínio: `consentimentoVigente(registros, finalidadeId, tipoDeCanal)` em `packages/dominio/src/crm/consentimentos.ts` (novo), com a mesma conta de `marketingConsentMissing`: vale o registro mais recente da finalidade para o tipo do Canal ou para `todos`.
    2. API: `GET` e `POST /contatos/:id/consentimentos` sobre `plataforma.contato_consentimentos`. Revogar é inserir um registro `revogado`; nada é apagado.
    3. `ServicoDeMensagens.enviar` (`servicos/crm/mensagens.ts:91`) recusa com 409 `SEM_CONSENTIMENTO` quando o modelo usado é de marketing e não há consentimento vigente. Os modelos chegam na Sessão 7; a regra já fica pronta e testada.
    4. Web: seção “Consentimentos” na ficha nova, com o histórico e o botão de registrar.
  - **Pronto quando:** Teste de domínio dos casos concedido, revogado depois e “todos”; registrar pela ficha grava uma linha em `plataforma.contato_consentimentos`.
- [ ] **3.2.5 Mover uma Conversa para outro Contato** `api` `web`
  - **Hoje:** `moveConversationToContact` (`packages/dominio/src/operations/conversations.ts:495`) troca o Contato e recusa se o destino já tem Conversa não resolvida no mesmo Canal, a menos que ela seja resolvida no mesmo ato. A tela é `features/crm/move-conversation-dialog.tsx`, aberta em `app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx:360`.
  - **O que fazer:**
    1. Rota `POST /conversas/:id/mover` com `{ contatoId, resolverExistente }` em `apps/api/src/rotas/crm/conversas.ts`.
    2. No serviço, numa transação: destino `ativo`; se ele tem Conversa aberta no mesmo Canal, resolvê-la quando `resolverExistente`, senão 409 `CONVERSA_JA_ABERTA`; trocar `conversas.contato_id`. As Mensagens e o Canal não mudam (INV-CXE-04).
    3. O diálogo passa a chamar a rota.
  - **Pronto quando:** Testes de serviço dos dois caminhos, com e sem Conversa aberta no destino.
- [ ] **3.2.6 Dar à Conversa nova os gestos da Caixa que faltam** `api`
  - **Hoje:** Para a Conversa da 008 só há abrir, resolver e reabrir. A Caixa antiga também atribui (`assignConversation`, `[conversa]/page.tsx:157`), manda para a lixeira (`trashConversation`, `:391`), restaura (`restoreConversation`, `app/(shell)/configuracoes/lixeira/page.tsx:189`) e marca estrela (`toggleConversationStar`, `features/crm/inbox-columns.tsx:420`).
  - **O que fazer:**
    1. Rotas em `apps/api/src/rotas/crm/conversas.ts`: `POST /conversas/:id/atribuir` com `{ tipo: 'membro' | 'agente', id }` ou `null`; `POST /conversas/:id/lixeira` (só Conversa resolvida, `conversas_lixeira_ck`); `POST /conversas/:id/restaurar`; `PUT /conversas/:id/marcacao` com `{ estrela?, lidaAte? }`, gravando em `conversa_marcacoes` do Membro da sessão.
    2. `GET /conversas` ganha os filtros `atribuidoId`, `filaId`, `comEstrela` e `q` (título), e cada item traz `naoLidas` (recebidas depois de `lida_ate`) e o nome do Contato.
  - **Pronto quando:** Testes de rota de cada gesto; uma Conversa na lixeira não aparece em `GET /conversas?estado=ativo`.
  - **Atenção:** Rascunhos (`Draft`, inclusive os que um Agente sugere, e `discardDraft` em `conversation-thread.tsx:482`) ficam para a Sessão 16, que define o Agente na Caixa.
- [ ] **3.2.7 Guardar as notas do Contato nas tabelas** `api` `web`
  - **Hoje:** `addContactNote` (`packages/dominio/src/operations/contacts.ts:761`) é chamado pelo fio (`features/crm/conversation-thread.tsx:768`) e pela Reunião (`app/(shell)/crm/reunioes/[reuniao]/page.tsx:738`) e grava no Contato antigo.
  - **O que fazer:**
    1. Rotas `GET` e `POST /contatos/:id/notas` sobre `plataforma.contato_notas`.
    2. O fio e a Reunião passam a chamar `POST /contatos/:id/notas`; a ficha nova mostra as notas.
  - **Pronto quando:** Uma nota escrita no fio aparece na ficha nova do Contato e grava uma linha em `plataforma.contato_notas`.
- [ ] **3.2.8 Passar ao sucessor o que o Membro removido tem nas tabelas** `api` `web`
  - **Hoje:** `previewSuccession` (`packages/dominio/src/operations/members.ts:23`) e `removeMember` (`:217`) passam ao sucessor os Contatos, Empresas, Negócios e Conversas ANTIGOS. Nas tabelas, `proprietario_id` e `atribuido_id` continuam apontando para quem saiu.
  - **O que fazer:**
    1. Em `apps/api/src/rotas/operacoes.ts`, a chamada de `removeMember` passa um `aoConfirmar` que, no mesmo cliente, troca `proprietario_id` em `contatos`, `empresas` e `negocios` e `atribuido_id` nas `conversas` abertas para o sucessor.
    2. Rota `GET /membros/:id/sucessao-no-crm` com as contagens; o diálogo de `app/(shell)/configuracoes/membros/page.tsx:95` mostra esses números no lugar dos de `previewSuccession`.
  - **Pronto quando:** Teste de rota: remover um Membro dono de 2 Contatos e 1 Negócio deixa os três com o sucessor em `plataforma.contatos` e `plataforma.negocios`.

### 3.3 Levar a Tarefa conversacional para as tabelas novas

**Objetivo:** A Tarefa conversacional cria a Conversa na base antiga e lê Contato, Canal, Conversa e Negócio de `state.*`. Aqui ela passa a abrir a Conversa em `plataforma.conversas` e a ler tudo pela api. Este trabalho estava na Sessão 5 (5.1) e na 3.1 antiga, duplicado.

**Pronto quando:** Criar, trocar o Canal e ligar ou criar o Negócio de uma Tarefa conversacional não grava nada em `registros` nas coleções `conversations` e `deals`, e o cartão da Lista mostra Contato, Canal e última Mensagem vindos da api.

- [ ] **3.3.1 A Conversa da Tarefa pode nascer sem Mensagem?** `decisão` · *muda o produto*
  - **Como é hoje:** `criarTarefaConversacional` abre a Conversa com `startConversation`, que cria uma Conversa vazia ou reaproveita a aberta. O serviço novo (`criar`, `apps/api/src/servicos/crm/conversas.ts:158`) exige a primeira Mensagem (INV-CXE-05) e recusa com 409 `CONVERSA_JA_ABERTA` se já existe uma aberta no par (Contato, Canal).
  - **Você decide:**
    - (A) O diálogo pede a primeira Mensagem quando não há Conversa aberta; havendo, reaproveita sem mensagem nova
    - (B) Abrir Conversa vazia só por este caminho, como exceção a INV-CXE-05
  - **O que muda depois:** (A) mantém a regra da 008 e acrescenta um campo ao diálogo; no WhatsApp oficial, fora da janela, essa primeira Mensagem terá de ser modelo (Sessão 7). (B) não muda o diálogo, mas põe Conversas mudas na Caixa.
  - **Recomendo:** (A).
- [ ] **3.3.2 Trocar as leituras da Tarefa conversacional por ids** `domínio`
  - **Hoje:** `contatoDaTarefa` (`packages/dominio/src/derive-conversacional.ts:70`), `conversaDaTarefa` (`:83`), `canalDaTarefa` (`:94`), `negocioDaTarefa` (`:105`) e `ultimaMensagemDaTarefa` (`:120`) seguem o Vínculo e buscam o registro em `state.contacts`, `state.conversations`, `state.channels` e `state.deals`. `vinculoRefusal` (`operations/tasks.ts:70`) confere os alvos de Vínculo nessas mesmas coleções.
  - **O que fazer:**
    1. Criar `vinculosDoCrmDaTarefa(state, task)` → `{ contatoId?, conversaId?, negocioId? }`, que só lê `state.links`, com as mesmas regras de hoje (Subtarefa lê a raiz; o papel “… da Tarefa” vem primeiro).
    2. Apagar `contatoAlcancado` (`:54`): quem resolve um `mesclado` passa a ser a api.
    3. `canaisDaLista` (`:166`) e `canaisDaListaQueAlcancam` (`:175`) passam a receber `canais: readonly Canal[]` (tipo de `crm/canais.ts`) em vez de ler `state.channels`.
    4. `VinculoDeNascimento` (`operations/tasks.ts:61`) ganha `alvoConferido: true`, preenchido por quem já conferiu o alvo na tabela; `vinculoRefusal` deixa de procurar em `state.contacts`, `state.conversations` e `state.deals`.
  - **Pronto quando:** `packages/dominio/src/derive-conversacional.test.ts`, reescrito, passa com um estado de teste sem `contacts`, `conversations`, `channels` e `deals`.
- [ ] **3.3.3 Criar a leitura em lote das Tarefas conversacionais** `api` `web`
  - **Hoje:** O cartão (`apps/web/src/features/estrutura/cartao-conversacional.tsx:42-45`), a tabela (`tabela-de-tarefas.tsx:290`), o cartão de Reunião (`cartao-de-tarefa.tsx:53`) e a ficha (`tarefa-completa.tsx:336-339`) montam Contato, Canal, Negócio e última Mensagem a partir do `DataState` em memória.
  - **O que fazer:**
    1. Rota `POST /tarefas-conversacionais/resumo` em `apps/api/src/rotas/crm/tarefas-conversacionais.ts` (novo), recebendo `{ vinculos: [{ taskId, contatoId?, conversaId?, negocioId? }] }` (até 200).
    2. Devolve por Tarefa: o nome do Contato (seguindo `mesclado_em_id`), o Canal (nome, tipo, provedor, conexão), a última Mensagem não interna (trecho, direção, `criadoEm`) e o Negócio (título, Etapa). Confere o Papel e ignora ids de outro Espaço.
    3. Web: `apps/web/src/dados/crm/tarefas-conversacionais.ts` com `useResumoDasTarefas(tarefas)` (SWR), usado pelo cartão, pela tabela, pelo cartão de Reunião e pela ficha.
    4. A página da Lista (`app/(shell)/estrutura/listas/[lista]/page.tsx:496`) conta Contatos distintos pelos ids dos Vínculos, sem chamar a api.
  - **Pronto quando:** Abrir uma Lista conversacional com 50 Tarefas faz uma chamada só ao resumo; um teste de rota prova que um id de outro Espaço volta vazio.
- [ ] **3.3.4 Trocar a criação da Tarefa conversacional para as tabelas novas** `domínio` `api` `web`
  - **Hoje:** `criarTarefaConversacional` (`packages/dominio/src/operations/tarefas-conversacionais.ts:154`) procura o Contato em `state.contacts` e o Canal em `state.channels`, abre a Conversa com `startConversation` (grava em `plataforma.registros`) e cria a Tarefa com Vínculos para esses ids antigos. É chamada pelo diálogo da Lista (`features/estrutura/nova-tarefa-conversacional-dialog.tsx:134`) e pelo fio da Caixa (`features/crm/conversation-thread.tsx:834`).
  - **O que fazer:**
    1. Extrair de `criar` (`servicos/crm/conversas.ts:158`) a função `abrirConversaNoCliente(cliente, membro, entrada, id?)`, usada por `POST /conversas` e pela rota nova.
    2. Criar `POST /tarefas-conversacionais` em `rotas/crm/tarefas-conversacionais.ts`, por `executarGestoMisto`: `lerDoCrm` confere o Contato em `plataforma.contatos`, o Canal em `plataforma.canais` e a Conversa aberta do par (`abertaDoPar`, `repositorios/crm/conversas.ts:138`); a operação pura cria a Tarefa com Vínculos para os ids novos; `gravarNoCrm` abre a Conversa (com a primeira Mensagem, conforme a decisão) quando não havia uma aberta.
    3. No domínio, `criarTarefaConversacional(state, membro, input, referencias)` recebe `{ contato: { id, nome }, canal: { id, nome, conexao }, conversaId, negocio? }` e deixa de chamar `startConversation`.
    4. O diálogo e o botão do fio passam a chamar a rota; o seletor de Contato usa `useContatos` e o de Canal usa `useCanais` (`dados/crm/canais.ts`).
  - **Pronto quando:** Criar uma Tarefa pela Lista grava uma linha em `plataforma.conversas` e nenhuma Conversa nova em `plataforma.registros`; um teste em `apps/api` prova isso, e outro prova que uma recusa da Tarefa não deixa Conversa nova.
- [ ] **3.3.5 Trocar o Canal da Tarefa pela api** `domínio` `api` `web`
  - **Hoje:** `trocarCanalDaTarefa` (`operations/tarefas-conversacionais.ts:255`) abre a Conversa no Canal novo com `startConversation` e troca o Vínculo. A ficha chama em `features/estrutura/tarefa-completa.tsx:1288`.
  - **O que fazer:**
    1. Rota `POST /tarefas-conversacionais/:taskId/canal` com `{ canalId, mensagem? }`, por `executarGestoMisto`: reaproveita a Conversa aberta do Contato no Canal novo ou abre uma; a operação pura só troca o Vínculo “conversa da Tarefa”.
    2. A Conversa anterior continua na Caixa, sem mudança.
  - **Pronto quando:** Trocar de WhatsApp para E-mail na ficha deixa a Conversa antiga na Caixa e o Vínculo apontando para uma Conversa de `plataforma.conversas`; teste de rota.
- [ ] **3.3.6 Ligar e criar o Negócio da Tarefa pela api** `domínio` `api` `web`
  - **Hoje:** `vincularNegocioATarefa` (`operations/tarefas-conversacionais.ts:306`) confere o Negócio em `state.deals` pelos `contactLinks` (`negocioDoContato`, `:148`); `criarNegocioDaTarefa` (`:362`) cria pelo `createDeal` antigo. A ficha chama em `tarefa-completa.tsx:728` e `:1398`.
  - **O que fazer:**
    1. Rota `POST /tarefas-conversacionais/:taskId/negocio` com `{ negocioId }` ou `null`: a api confere em `plataforma.negocios` que o Negócio está `ativo` e que `contato_id` é o Contato da Tarefa (a 007 tem um Contato só por Negócio, `negocios_dono_ck`); o domínio troca o Vínculo.
    2. Rota `POST /tarefas-conversacionais/:taskId/negocio/novo` com `{ funilId, titulo?, valor? }`: cria o Negócio na 1ª Etapa pelo mesmo código de `servicos/crm/negocios.ts` e grava o Vínculo, por `executarGestoMisto`.
    3. O seletor de Negócio da ficha usa `useNegocios({ contatoId })` (`dados/crm/negocios.ts`).
  - **Pronto quando:** Criar Negócio pela ficha grava uma linha em `plataforma.negocios` e o Vínculo “Negócio da Tarefa” com esse id; se o Vínculo for recusado, o Negócio não fica (teste).
  - **Atenção:** Um Negócio cujo dono é a Empresa do Contato não aparece para ligar. Se isso fizer falta, é decisão à parte.
- [ ] **3.3.7 Conferir os Canais da Lista conversacional na tabela** `domínio` `api` `web`
  - **Hoje:** `definirCanaisDaLista` (`operations/tarefas-conversacionais.ts:102`) chama `validarCanaisDeAtendimento` (`operations/canais.ts:133`), que procura os ids em `state.channels`; só funciona porque `executar()` projeta os Canais novos (`unidade-de-trabalho.ts:137`). O mesmo vale para `canalForaDaLista` (`canais.ts:150`) e `nomesDosCanais` (`operations/structure.ts:406`). A tela é `features/estrutura/canais-de-atendimento.tsx`.
  - **O que fazer:**
    1. As três funções passam a receber `canais: readonly Canal[]`.
    2. Em `apps/api/src/rotas/operacoes.ts`, as operações que precisam de Canal (`definirCanaisDaLista` e a criação de Lista conversacional) usam a opção `lerDoCrm` de `executar()` para ler `plataforma.canais` (`todos`, `repositorios/crm/canais.ts:268`) dentro da transação; o que vier do navegador nesse argumento é descartado.
    3. Na execução local da tela, os Canais vêm de `useCanais`.
  - **Pronto quando:** Com `canais-projetados.ts` desligado, marcar um Canal novo na Lista funciona e um id inexistente é recusado; teste em `apps/api/src/rotas/operacoes.test.ts`.

### 3.4 Trocar as telas para o modelo novo

**Objetivo:** Cerca de 70 arquivos da tela leem o modelo antigo. Cada grupo abaixo diz quais arquivos mudam e para que rota. Com a decisão (A) da 3.1, todos entram no mesmo deploy.

**Pronto quando:** Nenhum arquivo de `apps/web/src` lê `contacts`, `companies`, `deals`, `funnels`, `channels` ou `conversations` do store (salvo Grupos e Flows, se a decisão for (B)).

- [ ] **3.4.1 Caixa de Entrada: lista e gestos da Conversa** `web`
  - **Hoje:** `app/(shell)/crm/caixa-de-entrada/page.tsx:22` filtra `data.conversations`; `features/crm/inbox-columns.tsx` monta as colunas e a estrela (`:420`); `[conversa]/page.tsx` atribui (`:157`), reabre (`:321`), resolve (`:332`), manda para a lixeira (`:391`) e move (`:360`) com operações antigas.
  - **O que fazer:**
    1. Criar `apps/web/src/dados/crm/conversas.ts`, no molde de `dados/crm/contatos.ts`: `useConversas(filtro)`, `useConversa(id)`, `abrirConversa`, `resolverConversa`, `reabrirConversa`, `atribuirConversa`, `moverConversa`, `marcarConversa`, `conversaParaLixeira` e `restaurarConversa`.
    2. A lista e as colunas leem `useConversas`; a página da Conversa lê `useConversa`, e cada botão chama a função correspondente.
  - **Pronto quando:** Responder, resolver, reabrir, atribuir, mover e marcar estrela pela Caixa não muda `select count(*) from plataforma.registros where colecao = 'conversations'`; testes em `inbox-columns.test.tsx` com o cliente da api falso.
- [ ] **3.4.2 Caixa de Entrada: fio e envio** `web` `domínio`
  - **Hoje:** `features/crm/conversation-thread.tsx` abre Conversa com `startConversation` (`:371`, `:389`), envia com `sendMessage` (`:424`), descarta rascunho (`:482`), grava nota (`:768`), cria Tarefa (`:834`) e confere consentimento (`:352`), tudo no modelo antigo. As abas por Canal vêm de `canaisDoFio` (`derive-conversacional.ts:218`), que lê `state.channels`.
  - **O que fazer:**
    1. Criar `apps/web/src/dados/crm/mensagens.ts` com `useMensagens(conversaId)` (`GET /mensagens?conversaId=`) e `enviarMensagem` (`POST /mensagens`).
    2. Abrir Conversa pelo fio passa a ser `abrirConversa` com a primeira Mensagem; nota vai para `POST /contatos/:id/notas`; “Criar Tarefa” vai para `POST /tarefas-conversacionais`; consentimento usa `consentimentoVigente`.
    3. `canaisDoFio`, `canaisDeResposta` e `canalPadraoDeResposta` (`derive-conversacional.ts:271`) passam a receber os Canais de `useCanais` e os Identificadores do `ContatoDetalhado`.
    4. O descarte de rascunho sai do fio até a Sessão 16.
  - **Pronto quando:** Responder no fio grava uma linha em `plataforma.mensagens`; `conversation-thread.test.tsx` passa com o cliente da api falso e sem `conversations` no store.
- [ ] **3.4.3 Caixa de Entrada: configurações, Filas e Canais** `web`
  - **Hoje:** `crm/caixa-de-entrada/configuracoes/page.tsx:145` conta Conversas antigas; `configuracoes/filas/[fila]/page.tsx` (`:43` a `:172`) lista Conversas e Contatos antigos da Fila; `configuracoes/canais/[canal]/page.tsx:127` salva com `configurarCanal` antigo; o popup legado das Listas (`features/crm/adicionar-canal-dialog.tsx:95`) cria Canal `conectada` em `registros` com `criarCanal` antigo.
  - **O que fazer:**
    1. As contagens e a lista da Fila usam `GET /conversas?filaId=`.
    2. A ficha do Canal salva por `PATCH /canais/:id`.
    3. O popup legado passa a usar `criarCanal` de `dados/crm/canais.ts:76` (nasce `desconectada`, como a página de conexão) ou leva o usuário para `/crm/caixa-de-entrada/configuracoes/canais/conectar`.
    4. Filas (`Queue`) e a Caixa (`Inbox`, com `reopenWindowHours`) continuam em `plataforma.registros`: são configuração, e a 008 guarda só o id da Fila (`fila_id`).
  - **Pronto quando:** Criar um Canal pelo popup das Listas grava em `plataforma.canais` e nada em `registros` na coleção `channels`.
- [ ] **3.4.4 Fichas de Contato, Empresa e Negócio só no modelo novo** `web`
  - **Hoje:** Quando a api devolve 404, a página abre a ficha antiga: `crm/contatos/[contato]/page.tsx:27-30` (`FichaDeContatoLegado`), `crm/empresas/[empresa]/page.tsx:30` (`FichaDeEmpresaLegado`) e `crm/negocios/[negocio]/page.tsx:27-31` (`DealScreen`, que move, ganha, perde e reabre com operações antigas em `deal-screen.tsx:274-325`). `contact-card.tsx:176` grava a qualificação com `setContactCatalogValue`.
  - **O que fazer:**
    1. Tirar o caminho de reserva das três páginas: 404 mostra “não encontrado”.
    2. Apagar `features/crm/legado/ficha-de-contato-legado.tsx`, `legado/ficha-de-empresa-legado.tsx`, `deal-screen.tsx`, `restore-copy-dialog.tsx` e `import-contacts-dialog.tsx` (este último não é montado em lugar nenhum).
    3. `contact-card.tsx` grava a qualificação por `PATCH /contatos/:id` com `{ qualificacao }`.
  - **Pronto quando:** Abrir `/crm/contatos/<id antigo>` mostra “Contato não encontrado.”; os arquivos apagados não existem e `npm run check -w @n1/web` passa.
- [ ] **3.4.5 Meus negócios e Reuniões** `web` `domínio`
  - **Hoje:** `estrutura/listas/[lista]/page.tsx` monta `QuadroNegocios` (`:949`), `IniciarConversaDialog` (`:1089`) e a `DealScreen` embutida (`:1131`); `quadro-negocios.tsx` usa `DealCard` e `dealOfTask` (`:32`); `crm/reunioes/[reuniao]/page.tsx` lê `state.deals`, `contacts`, `companies` e `funnels` (`:138` a `:215`). `iniciarConversa` cria Negócio, Tarefa espelho e Conversa no modelo antigo.
  - **O que fazer:**
    1. Com (B) da decisão de Meus negócios: tirar a Pasta “Meus negócios” do seed e da navegação, apagar `QuadroNegocios`, `deal-card.tsx`, `iniciar-conversa-dialog.tsx` e `operations/iniciar-conversa.ts`, e pôr o filtro “meus” (`proprietario_id` = Membro da sessão) no quadro de `/crm/funis/[funil]`.
    2. Com (A): a Lista ganha `funilId`; `funilDaLista` lê esse campo; o quadro lê `useNegocios({ funilId })`; `iniciarConversa` vira rota `POST /negocios/iniciar-conversa` por `executarGestoMisto` (Negócio e Conversa nas tabelas, Tarefa espelho em `registros`).
    3. Nos dois casos, a Reunião lê Negócio, Contato e Empresa pela api (`useNegocio`, `useContato`) a partir do Vínculo.
  - **Pronto quando:** Abrir uma Reunião mostra o Negócio de `plataforma.negocios`; com (B), `/crm/meus-negocios` não existe mais; com (A), mover um cartão no quadro da Lista chama `POST /negocios/:id/mover`.
- [ ] **3.4.6 Busca, Lixeira e Notificações** `web` `api`
  - **Hoje:** `app/(shell)/buscar/page.tsx:112-153` procura em `state.contacts`, `companies`, `deals` e `conversations`; `configuracoes/lixeira/page.tsx:101-134` lista os antigos na lixeira e restaura com `restoreContact` (`:186`) e `restoreConversation` (`:189`); `notificacoes/page.tsx:139-144` mostra “Conversas atribuídas a você” das antigas.
  - **O que fazer:**
    1. Busca: `GET /contatos?q=`, `GET /empresas?q=` e `GET /negocios?q=` (já aceitam `q`) e `GET /conversas?q=` (novo, da 3.2).
    2. Lixeira: a mesma lista com `estado=na_lixeira` em cada rota; restaurar por `POST /contatos/:id/restaurar`, `/empresas/:id/restaurar`, `/negocios/:id/restaurar` e `/conversas/:id/restaurar`.
    3. Notificações: `GET /conversas?atribuidoId=<Membro>&situacao=aberta`.
  - **Pronto quando:** Buscar o nome de um Contato criado pela ficha nova o encontra; um Contato enviado à lixeira pela ficha nova aparece na Lixeira e volta ao restaurar.
- [ ] **3.4.7 Início, Configurações e Painel** `web` `domínio`
  - **Hoje:** Início: `derive-resumo.ts:70`, `:134` e `:448`, `features/inicio/panorama-do-robo.ts:25-37` e `resumo-do-inicio.tsx:502` e `:561` leem Conversas e Contatos antigos. Configurações: `configuracoes/campos/page.tsx:102-107`, `tags/page.tsx:68-71` e `catalogos/page.tsx:54-55` contam uso nos registros antigos; `configuracoes/page.tsx:110` mostra `workspace.defaultFunnelId` (Funil antigo); `features/configuracoes/governance-access-dialog.tsx:221` concede acesso a Funil antigo. Painel: `widgetReading` (`derive.ts:744-760`) lê `state.deals`, `conversations` e `contacts`.
  - **O que fazer:**
    1. As funções de `derive-resumo.ts` e `widgetReading` passam a receber as linhas como argumento (`conversas`, `contatos`, `negocios`); a tela as busca com `useConversas`, `useContatos` e `useNegocios`.
    2. As páginas de Campos, Tags e Catálogos deixam de contar uso no CRM: a 007 não usa essas definições (os Campos adicionais do CRM são chaves livres).
    3. O Funil padrão vem de `useFunis` (`plataforma.funis.padrao`); `defaultFunnelId` sai do `Workspace`.
    4. O diálogo de acesso deixa de oferecer Funil: o Funil novo é governado por `privado` e pelo Papel (`podeNoCrm`).
  - **Pronto quando:** Início, Configurações e os Painéis de demonstração abrem sem `deals`, `contacts` e `conversations` no store, com os números vindos da api.
  - **Atenção:** Para o Painel, isto é uma ponte para ele não quebrar quando o CRM antigo sair. A Sessão 20 (tarefa 20.3) troca a ponte pela leitura no servidor.
- [ ] **3.4.8 Ferramentas: Contatos e Canais pelos ids novos** `domínio` `web` `api`
  - **Hoje:** As operações de `packages/dominio/src/operations/ferramentas/` (`grupos.ts:110`, `:139`, `:256`, `:278`, `:296`, `participacoes.ts`, `comunidades.ts`, `permissoes.ts`, `provedor-simulado.ts`) acham Canal e Contatos dos Participantes em `state.channels` e `state.contacts`; `contatosComWhatsApp` (`derive-ferramentas.ts:318`) filtra `identidadeDeWhatsApp`. As telas em `apps/web/src/features/ferramentas/` (abas, popups, `criar-grupo-dialog.tsx`, `importar-grupos-dialog.tsx`, `participacoes.tsx`, `pedidos-de-entrada.tsx`) seguem o mesmo caminho.
  - **O que fazer:**
    1. As operações recebem `canais` e `contatos` já conferidos, pela opção `lerDoCrm` em `rotas/operacoes.ts` (como na 3.3).
    2. `Grupo.canalId` e o Contato da Participação passam a guardar ids de `plataforma.canais` e `plataforma.contatos` (o script da 3.5 reescreve os existentes).
    3. `contatosComWhatsApp` vira `GET /contatos?comIdentificador=whatsapp` (filtro novo).
    4. Com (B) da decisão de Grupos e Flows, `conversaDoGrupo`, `enviosDoFlow`, `respostasDoFlow` e `receiveMessage` de `flows.ts:922` continuam no `Conversation` antigo, isolado num arquivo `types/conversa-de-grupo.ts`, até as Sessões 6 e 7.
  - **Pronto quando:** Criar um Grupo com dois Contatos da ficha nova grava as Participações com os ids de `plataforma.contatos`; os testes de `operations/ferramentas/` passam sem `state.contacts`.
- [ ] **3.4.9 IA: alvos, escopos e âncoras pelos ids novos** `domínio` `web`
  - **Hoje:** `operations/ai.ts:989-997` e `operations/ia/agentes.ts:371-377` dão nome ao alvo (Negócio, Contato, Empresa, Conversa) pelo modelo antigo; `ia/agentes.ts:144` percorre `state.conversations`; `derive-ia.ts:309` confere Automação com escopo Funil em `state.funnels`. Na tela: `features/ia/ancora-do-chat.tsx:44-50`, `agentes/agente-completo.tsx`, `agentes/ensaiar-dialog.tsx`, `automacoes/automacao-spec.ts:455`, `editor-de-automacao.tsx` e `nova-automacao-dialog.tsx`.
  - **O que fazer:**
    1. O nome do alvo vem de uma rota em lote `POST /crm/nomes` com `{ alvos: [{ tipo, id }] }` (até 200), que a tela chama.
    2. O escopo Funil das Automações e Agentes guarda o id de `plataforma.funis`; `derive-ia.ts` recebe a lista de Funis ativos como argumento.
    3. A âncora do Chat em Negócio, Contato ou Conversa usa `useNegocio`, `useContato` e `useConversa`; o Canal das Automações vem de `useCanais`.
  - **Pronto quando:** Ancorar um Chat num Negócio novo mostra o título certo; os testes de `operations/ia/` passam sem `deals`, `contacts` e `conversations` no estado.
- [ ] **3.4.10 Contas a receber: o cliente pelas tabelas** `domínio` `api` `web`
  - **Hoje:** O cliente da conta a receber é um Contato ou Empresa antigo: `clienteDe` (`packages/dominio/src/operations/financeiro.ts:1747`) e `createReceivableSeries` (`:1808`) leem `state.contacts`; `features/estrutura/financeiro/serie-dialog.tsx:78` e `lens.ts:176` mostram o nome; a importação do ClickUp monta o catálogo de clientes de `state.contacts` e `state.companies` (`apps/api/src/importacao/clickup/importar-contas-a-receber.ts:62`; `operations/importacao-contas-a-receber.ts:173`).
  - **O que fazer:**
    1. `clienteDe` devolve só `{ tipo: 'contact' | 'company', id }` do Vínculo “cliente”; o nome vem de `POST /crm/nomes`.
    2. `createReceivableSeries` recebe o cliente conferido pela opção `lerDoCrm` em `rotas/operacoes.ts` (Contato `ativo` em `plataforma.contatos`).
    3. `construirCatalogoDeClientes` lê `plataforma.contatos` e `plataforma.empresas` com `estado = 'ativo'`.
    4. O seletor de cliente do `serie-dialog.tsx` usa `useContatos`.
  - **Pronto quando:** Criar uma série de contas para um Contato da ficha nova grava o Vínculo “cliente” com o id de `plataforma.contatos`; `contas-a-receber.test.ts` da importação passa lendo as tabelas.

### 3.5 Migrar os dados antigos e remover o modelo antigo

**Objetivo:** Os registros antigos precisam ir para as tabelas com os ids trocados em todos os lugares que apontam para eles. Depois disso, tipos, operações, coleções e a ponte de Canais saem do código.

**Pronto quando:** Homologação e produção rodaram o script; `npm run check` passa sem o modelo antigo.

- [ ] **3.5.1 Escrever o script de migração do CRM antigo** `api` `banco`
  - **Hoje:** Os dados antigos estão em `plataforma.registros`, nas coleções `contacts`, `companies`, `contactCompanyLinks`, `funnels`, `deals`, `channels` e `conversations` (com as Mensagens dentro de cada Conversa). Não existe script de cópia.
  - **O que fazer:**
    1. Criar `apps/api/src/importacao/crm-antigo/migrar-crm-antigo.ts` e `.cli.ts`, com o comando `npm run migrar:crm-antigo -w @n1/api -- --espaco <id> [--seco]`. `--seco` só conta e lista o que não tem destino.
    2. Uma transação por Espaço. Cada registro copiado grava uma linha em `plataforma.crm_de_para`; rodar de novo pula o que já está lá.
    3. Contato → `contatos`: `firstName`/`lastName` → `nome`/`sobrenome`; `ownerMemberId` → `proprietario_id`; `creationMode` (`automaticoPorMensagem` → `automatico_mensagem`; `automaticoPorAutomacaoOuAgente` e `automaticoPorGrupo` → `automatico_automacao`; `desdobradoDeMesclagem` → `manual`); `lifecycle` (`naLixeira` → `na_lixeira`; `mesclado` → `mesclado` com `mesclado_em_id` pelo de-para); `qualificationId` → `qualificacao`; `fieldValues` → `campos_adicionais` pelo nome do Campo; `consents` → `contato_consentimentos`; `comments` → `contato_notas`.
    4. Identificadores: `telefone` → `telefone`, `email` → `email`, `identidadeDeWhatsApp` → `whatsapp`, `usuarioDeInstagram` → `instagram`. `perfilDeLinkedIn`, `perfilDeTikTok` e `identificadorDeChatDoSite` não têm tipo na 007 e vão para o relatório de não migrados.
    5. Empresa → `empresas` e `empresa_identificadores` (`documentoFiscal` → `documento_fiscal`); `ContactCompanyLink` → `contato_empresa` (`role` → `cargo`).
    6. Funil → `funis` e `etapas` (nome, ordem, probabilidade); Negócio → `negocios` com `funil_id` e `etapa_id` pelo de-para. Dono: `companyId` → `empresa_id`; sem Empresa, o Contato principal de `contactLinks` → `contato_id` (`negocios_dono_ck` exige um só).
    7. Canal: os de tipo `whatsapp`, `instagram` e `email` sem `relational` → `canais`, com o provedor padrão do tipo (`PROVEDOR_PADRAO_DO_TIPO`) e `conexao = 'desconectada'`. `linkedin` e `chatDoSite` não cabem em `canais_tipo_ck` e vão para o relatório.
    8. Conversa → `conversas` (sem as de Grupo, se a decisão for (B)); sem `contactId`, vai para o relatório; na lixeira, entra `resolvida` e `na_lixeira` (`conversas_lixeira_ck`). Cada `Message` → `mensagens`, em ordem de `createdAt`; recebida sem `externalId` ganha `id_externo = 'migrado:<id antigo>'`, porque a 008 exige id externo na recebida.
    9. Reescrever o que fica em `registros` apontando para ids antigos: `links` (`toId` de `contact`, `company`, `deal`, `conversation`), `tasks[].provenance.sourceId`, `lists[].canaisDeAtendimento`, `grupos[].canalId` e Participações, escopos `funnel` de Automações, Agentes e Painéis, e `grants` de Funil.
    10. Por fim, copiar as linhas antigas para `plataforma.registros_crm_antigo` e apagá-las de `plataforma.registros`. Isso é obrigatório: `hidratar()` (`apps/api/src/persistencia/repositorio.ts:96`) carrega qualquer coleção que estiver no banco, então linha que fica volta no `GET /estado`.
  - **Pronto quando:** Teste de integração `apps/api/src/importacao/crm-antigo/migrar-crm-antigo.test.ts` sobre um Espaço semeado: depois de rodar, `select colecao, count(*) from plataforma.registros where colecao in ('contacts','companies','deals','funnels','channels','conversations','contactCompanyLinks') group by 1` volta vazio, todo Vínculo de Tarefa aponta para um id que existe nas tabelas, e rodar de novo não muda nada.
- [ ] **3.5.2 Rodar a migração em homologação e em produção** `você` `infra`
  - **O que fazer:**
    1. Backup do banco antes (Sessão 1).
    2. Em homologação: `--seco`, conferir com você o relatório de não migrados, rodar, abrir Caixa, fichas, Listas conversacionais e Contas a receber.
    3. Em produção: o mesmo, junto com o deploy das telas trocadas (3.4).
  - **Pronto quando:** Você aprova o relatório de não migrados e a conferência das telas nos dois ambientes.
- [ ] **3.5.3 Tirar o CRM antigo do seed** `domínio`
  - **Hoje:** `seed.ts`, `seed-comercial.ts`, `seed-pos-venda.ts`, `seed-produto.ts`, `seed-ferramentas.ts` e `seed-contas-a-receber.ts` (este em `:223`) criam Contatos, Empresas, Negócios, Funis, Canais e Conversas antigos para a demonstração.
  - **O que fazer:**
    1. Tirar do seed tudo o que é do CRM antigo.
    2. Para o ambiente de desenvolvimento: rodar o script da subtarefa anterior uma vez sobre um Espaço semeado com a versão atual e salvar o resultado como `apps/api/src/bootstrap/crm-demo.sql` (só dados), aplicado por `npm run bootstrap:crm-demo -w @n1/api`.
  - **Pronto quando:** `npm run check -w @n1/dominio` passa com o seed novo; um Espaço de desenvolvimento novo, depois de `bootstrap:crm-demo`, mostra Contatos e Conversas na Caixa.
- [ ] **3.5.4 Remover o modelo antigo** `domínio` `api` `web`
  - **Hoje:** Os dois modelos convivem; a ponte `canais-projetados.ts` existe só por isso.
  - **O que fazer:**
    1. Em `packages/dominio/src/types/crm.ts`: apagar `Contact`, `Company`, `Deal`, `Funnel`, `Stage`, `Channel`, `Conversation`, `Message`, `Participant`, `Draft`, `ContactCompanyLink`, `CompanyCompanyLink`, `DistinctFromLink` e afins. Ficam `Queue`, `Inbox` e `BusinessHours` (Filas e Caixa continuam em `registros`).
    2. Mover `ChannelType`, `ProvedorDeCanal`, `ChannelCapabilities`, `CHANNEL_CAPABILITIES` e `capacidadesDoCanal` (`operations/conversations.ts:20` e `:115`, usados por `apps/api/src/servicos/crm/mensagens.ts:37`) para `packages/dominio/src/crm/capacidades.ts`, e ajustar `provedores-de-canal.ts`.
    3. Apagar `operations/contacts.ts`, `conversations.ts`, `deals.ts`, `iniciar-conversa.ts`, `criarCanal` e `configurarCanal` de `operations/canais.ts`, e `marketingConsentMissing` (`derive.ts:443`); tirar essas operações de `OPERACOES` (`operations/registro.ts:420`) e de `apps/api/src/rotas/esquemas-de-argumentos.ts`.
    4. Tirar `contacts`, `companies`, `deals`, `funnels`, `contactCompanyLinks`, `companyCompanyLinks`, `distinctFromLinks`, `channels` e `conversations` de `DataState` (`state.ts`) e de `TODAS` (`colecoes.ts`).
    5. Apagar `apps/api/src/persistencia/canais-projetados.ts` e o teste, as chamadas em `rotas/estado.ts:41` e `persistencia/unidade-de-trabalho.ts:137` e `:189`, e `canalAntigoEmConflito` (`repositorios/crm/referencias.ts:63`).
    6. Atualizar `CONTEXT.md` da raiz (parágrafos da Fase 7 e 8 sobre convivência) e `apps/api/src/persistencia/CONTEXT.md` (seção “A ponte dos Canais”).
  - **Pronto quando:** `npm run check` passa; uma busca por `state.contacts`, `state.conversations`, `state.deals`, `state.channels` e `canais-projetados` em `packages/` e `apps/` não acha nada (salvo o resto de Grupos e Flows, se a decisão for (B)).

### 3.6 Porta de entrada de mensagens

**Objetivo:** Hoje não existe endereço para um provedor entregar mensagem: `registrarRecebida` não tem rota e só grava numa Conversa já aberta. Aqui nasce o caminho único (webhook, fila de entrada, recebimento) que as Sessões 4, 7, 8 e 9 só precisam ligar.

**Pronto quando:** Uma chamada do provedor de teste ao webhook, com o worker ligado, cria Contato, Conversa e Mensagem nas tabelas; a mesma chamada repetida não grava nada novo.

- [ ] **3.6.1 Definir a interface do provedor de mensageria** `api`
  - **Hoje:** Não existe interface de provedor de mensagens. As Ferramentas têm um provedor simulado próprio só para Grupos (`packages/dominio/src/operations/ferramentas/provedor-simulado.ts`).
  - **O que fazer:**
    1. Arquivo novo `apps/api/src/mensageria/provedor.ts` com `interface ProvedorDeMensageria`. Mora no `apps/api` porque é entrada e saída de rede; os tipos que ela usa vêm do domínio (`TipoIdentificadorContato`, `StatusDeEntrega`, `ConexaoDoCanal`).
    2. `readonly provedor: ProvedorDeCanal`: `whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph` ou `email-imap-smtp`.
    3. `verificarChamada(chamada: { cabecalhos: Record<string, string>; corpoCru: Buffer }, segredo: string): boolean`: confere a assinatura ou o token da chamada ao webhook.
    4. `interpretarChamada(corpo: unknown): readonly EventoDoProvedor[]`, com três formas: `{ tipo: 'mensagem', idExterno, criadoEm, remetente: { tipo: TipoIdentificadorContato, valor, nomeExibido? }, conteudo?, anexos?: { referenciaNoProvedor, tipoDeMidia, nome }[], emRespostaAIdExterno?, assunto?, cargaBruta }`; `{ tipo: 'status', idExterno, status: StatusDeEntrega, em, motivo? }`; `{ tipo: 'conexao', conexao: ConexaoDoCanal, motivo? }`.
    5. `enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio>` (ver 3.7), `baixarMidia(canal, referenciaNoProvedor): Promise<{ bytes: Uint8Array; tipoDeMidia: string; nome?: string }>` (ver 3.9) e `estadoDaConexao(canal): Promise<ConexaoDoCanal>`.
    6. `CanalParaProvedor` = o `Canal` de `crm/canais.ts` mais a credencial decifrada do cofre (Sessão 1, 1.4). Só existe dentro do `apps/api` e nunca vai para log.
    7. `apps/api/src/mensageria/registro.ts`: `provedorDoCanal(canal)` devolve o provedor de teste quando `conexao_simulada = true`, senão a implementação do `canal.provedor`; sem implementação, erro `PROVEDOR_INDISPONIVEL`.
    8. Provedor de teste `apps/api/src/mensageria/provedores/teste.ts`: guarda em memória o que recebeu em `enviar`, aceita o segredo fixo de teste e lê um JSON simples em `interpretarChamada`.
  - **Pronto quando:** `apps/api/src/mensageria/provedor.test.ts` é um conjunto de testes que recebe uma implementação e passa com o provedor de teste; as Sessões 4, 7, 8 e 9 rodam o mesmo conjunto contra a sua.
- [ ] **3.6.2 Fazer o recebimento completo: Contato, Conversa e Mensagem** `domínio` `api`
  - **Hoje:** `registrarRecebida` (`apps/api/src/servicos/crm/mensagens.ts:141`) exige `conversaId` e não muda a situação da Conversa. A regra completa só existe no modelo antigo: `receiveMessage` (`packages/dominio/src/operations/conversations.ts:315`) entra na Conversa aberta, reabre a resolvida dentro da janela da Caixa (`inbox.reopenWindowHours`), senão abre outra (RN-CXE-09), e devolve a `ativo` o Contato arquivado ou na lixeira (RN-CON-13).
  - **O que fazer:**
    1. Domínio, `packages/dominio/src/crm/recebimento.ts` (novo): `destinoDaRecebida({ aberta, ultimaResolvida, janelaDeReaberturaHoras, agora })` → `{ acao: 'usar', conversaId } | { acao: 'reabrir', conversaId } | { acao: 'abrir' }`, com a regra de `receiveMessage` (pendente volta a aberta); e `contatoDaRecebida(estado)` para RN-CON-13 (`mesclado` segue para o sobrevivente).
    2. Serviço `apps/api/src/servicos/crm/recebimento.ts` (novo): `receberMensagem(workspaceId, canalId, evento)`, numa transação.
    3. Passo 1: se `obterPorIdExterno` (`repositorios/crm/mensagens.ts:236`) já acha a Mensagem, devolve `repetida: true` sem tocar em nada.
    4. Passo 2: normaliza o remetente (`normalizarIdentificadorDeContato`, `packages/dominio/src/crm/normalizacao.ts:118`) e acha o Contato por `detentorDoIdentificador` (`repositorios/crm/contatos.ts:380`), ou cria com `modo_criacao = 'automatico_mensagem'`, dono `canal.proprietario_padrao_id`, senão `canal.configurado_por`, e `origem = canal.origem_padrao_id`.
    5. Passo 3: aplica `destinoDaRecebida` com a janela de `inbox.reopenWindowHours` (lida de `plataforma.registros`, coleção `inbox`); Conversa nova nasce com `fila_id = canal.fila_padrao_id` e sem atribuído.
    6. Passo 4: grava a Mensagem com o `inserirRecebida` atual.
    7. Devolve `{ mensagem, conversa, contato, contatoNovo, conversaNova, conversaReaberta, repetida }`: é o que a Sessão 5 (Tarefa) e a Sessão 16 (Agente) usam para o passo seguinte.
    8. `registrarRecebida` sai da interface `ServicoDeMensagens` e vira o passo 4.
  - **Pronto quando:** Testes de serviço contra o Postgres real: Contato novo; Contato arquivado volta a `ativo`; Conversa aberta reaproveitada; resolvida dentro da janela reabre (`reaberturas` soma 1); resolvida fora da janela abre outra; a mesma Mensagem duas vezes grava uma linha só.
- [ ] **3.6.3 Criar a rota de webhook por Canal** `api`
  - **Hoje:** Não existe. As rotas públicas de hoje (`apps/api/src/rotas/formularios-publicos.ts`) mostram o molde: fora do hook de JWT, com limite de taxa.
  - **O que fazer:**
    1. `POST /webhooks/mensageria/:canalId` em `apps/api/src/rotas/webhooks-de-mensageria.ts` (novo), registrada fora do hook de JWT, com limite de taxa e o corpo cru preservado para conferir assinatura.
    2. Acha o Canal pelo id (o Espaço vem do Canal, não da chamada) e pede ao provedor `verificarChamada` com o segredo do webhook guardado no cofre.
    3. Canal inexistente, arquivado ou chamada não verificada: a mesma resposta 401, sem dizer o motivo, para não revelar quais Canais existem.
    4. Verificada: grava a chamada em `plataforma.webhooks_recebidos` e responde 200 na hora; nada é processado dentro da requisição.
  - **Pronto quando:** Testes de rota: sem assinatura → 401 e nada gravado; com a do provedor de teste → 200 e uma linha `pendente` em `webhooks_recebidos`.
- [ ] **3.6.4 Processar a fila de entrada** `api`
  - **Hoje:** Não existe fila de entrada. O worker do outbox (`apps/api/src/persistencia/outbox-worker.ts`) já tem o molde de reivindicar, tentar de novo e desistir.
  - **O que fazer:**
    1. Tabela `plataforma.webhooks_recebidos` (migração nova da 3.1): `id`, `workspace_id`, `canal_id`, `provedor`, `corpo jsonb`, `recebido_em`, `estado` (`pendente`, `processando`, `processado`, `falhou`), `tentativas`, `locked_at`, `locked_by`, `ultimo_erro`.
    2. Worker `apps/api/src/mensageria/processador-de-entrada.ts`: reivindica com `for update skip locked` (molde de `reivindicar`, `outbox-worker.ts:157`), roda `interpretarChamada` e trata cada evento: `mensagem` → `receberMensagem`; `status` → subtarefa seguinte; `conexao` → `definirConexao` do Canal (`repositorios/crm/canais.ts:209`).
    3. Falha → volta a `pendente` com `backoff` (`outbox-worker.ts:84`); `processando` com `locked_at` vencido volta a `pendente`. Reprocessar é seguro porque `receberMensagem` reconhece a repetida.
    4. Ligado em `apps/api/src/index.ts` por `MENSAGERIA_WORKER_ATIVO=true`, como o worker do outbox (`index.ts:175`).
    5. O `corpo` tem dado pessoal: as linhas `processado` são apagadas no prazo de retenção da Sessão 19.
  - **Pronto quando:** Teste: gravar uma chamada, simular queda do worker no meio (`locked_at` vencido) e religar processa a Mensagem uma vez só.
- [ ] **3.6.5 Gravar o status de entrega que o provedor informa** `domínio` `api`
  - **Hoje:** `plataforma.mensagens` tem `status_entrega`, `status_entrega_em` e `motivo_falha`, mas só o envio preenche (`statusInicialDeEnvio`, `packages/dominio/src/crm/mensagens.ts:192`).
  - **O que fazer:**
    1. Domínio: `proximoStatusDeEntrega(atual, novo)` em `crm/mensagens.ts`, que só avança (`pendente` → `enviada` → `entregue` → `lida`; `falhou` só a partir de `pendente` ou `enviada`).
    2. Repositório: `atualizarStatusDeEntrega(workspaceId, canalId, idExterno, status, em, motivo?)` em `repositorios/crm/mensagens.ts`, chamado pelo processador para eventos `status`.
  - **Pronto quando:** Teste: um `lida` seguido de um `entregue` atrasado continua `lida`.
  - **Atenção:** A Sessão 4 (4.2, “Status, reações e mensagens apagadas”) só traduz o formato da Evolution para este evento.

### 3.7 Porta de saída de mensagens

**Objetivo:** Hoje a Mensagem enviada fica gravada como `enviada` e não sai para lugar nenhum. Aqui ela passa pela fila de saída que já existe (outbox) e é entregue pelo provedor do Canal, com tentativas e status.

**Pronto quando:** Uma resposta escrita na Caixa, num Canal simulado, chega ao provedor de teste e fica `enviada` com `id_externo`; com erro transitório, a fila tenta de novo.

- [ ] **3.7.1 Enfileirar o envio na mesma transação da Mensagem** `domínio` `api` `banco`
  - **Hoje:** `ServicoDeMensagens.enviar` (`apps/api/src/servicos/crm/mensagens.ts:91`) grava a Mensagem com `statusInicialDeEnvio` (`enviada` se o Canal está `conectada`, `pendente` se não) e para aí.
  - **O que fazer:**
    1. Evento novo `mensagem.enviar.v1` em `EVENTOS` (`apps/api/src/persistencia/outbox.ts:33`), com payload `{ mensagemId, conversaId, canalId }`: sem texto e sem telefone, como os outros eventos.
    2. `statusInicialDeEnvio` passa a devolver sempre `pendente` para `enviada`: só o provedor diz que saiu.
    3. Em `enviar`, se a direção é `enviada` e o Canal está `conectada`, gravar o evento com `gravarEventos(cliente, …)` no mesmo cliente da Mensagem.
    4. Índice único (migração nova da 3.1) `(workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'mensagem.enviar.v1'`: a mesma Mensagem nunca entra duas vezes na fila.
    5. Quando o Canal volta a `conectada` (evento `conexao` da 3.6), enfileirar as Mensagens `pendente` dele: nada é descartado (B69).
  - **Pronto quando:** Teste de serviço: enviar grava a Mensagem `pendente` e uma linha `mensagem.enviar.v1` no outbox; se o insert do evento falha, a Mensagem também não fica.
- [ ] **3.7.2 Entregar pelo provedor em vez de HTTP** `api`
  - **Hoje:** O worker (`entregar`, `apps/api/src/persistencia/outbox-worker.ts:230`) só faz POST no serviço `automation/`, pelo caminho de `CAMINHO_POR_EVENTO` (`:63`), e só liga com `OUTBOX_DESTINO_URL` e `OUTBOX_TOKEN` (`apps/api/src/index.ts:175`).
  - **O que fazer:**
    1. `OpcoesOutboxWorker` (`outbox-worker.ts:116`) ganha `tiposDeEvento?: readonly NomeDeEvento[]` (`reivindicar` filtra por `event_type`) e `entregador?: (linha) => Promise<ResultadoDeEntrega>`, usado no lugar do POST.
    2. Entregador `apps/api/src/mensageria/entregar-mensagem.ts`: carrega Mensagem, Conversa, Canal e o Identificador do Contato do tipo que o Canal resolve (`TIPO_DE_IDENTIFICADOR_DO_CANAL`, `packages/dominio/src/crm/conversas.ts:92`), monta o envio e chama `provedorDoCanal(canal).enviar`.
    3. `EnvioAoProvedor` = `{ mensagemId, destino: { tipo, valor }, conteudo?, anexos?: { urlAssinada, tipoDeMidia, nome }[], emRespostaAIdExterno?, assunto?, modelo?: { idNoProvedor, idioma, variaveis } }`. `ResultadoDoEnvio` = `{ ok: true, idExterno } | { ok: false, transitorio: boolean, motivo }`.
    4. Aceito: grava `id_externo`, `status_entrega = 'enviada'` e `status_entrega_em`. Recusa permanente: `falhou` com `motivo_falha`. Transitória: a linha volta a `pending` com o backoff de hoje.
    5. Um segundo worker em `index.ts`, ligado por `MENSAGERIA_WORKER_ATIVO`, só com `mensagem.enviar.v1`; o worker atual passa `tiposDeEvento` com os quatro eventos de hoje.
  - **Pronto quando:** Teste em `apps/api/src/e2e/mensageria.test.ts`: enviar por `POST /mensagens` num Canal simulado faz o provedor de teste receber uma chamada e a Mensagem ficar `enviada` com `id_externo`; com o provedor devolvendo erro transitório duas vezes, a terceira tentativa entrega.
- [ ] **3.7.3 Mostrar a entrega no fio e deixar tentar de novo** `api` `web`
  - **Hoje:** O fio antigo mostra `deliveryStatus` da Mensagem antiga; não há como reenviar uma que falhou.
  - **O que fazer:**
    1. Rota `POST /mensagens/:id/reenviar`: só para `falhou`; volta a `pendente` e enfileira de novo.
    2. No fio (`features/crm/conversation-thread.tsx`), cada Mensagem enviada mostra pendente, enviada, entregue ou lida; `falhou` mostra o `motivo_falha` e o botão “Tentar de novo”.
  - **Pronto quando:** Com o provedor de teste recusando de vez, a Mensagem aparece “falhou” com o motivo; “Tentar de novo” com o provedor aceitando a deixa “enviada”.

### 3.8 Tempo real

**Objetivo:** Hoje a tela pergunta a cada 5 s se a revisão do Espaço mudou, e as tabelas do CRM não mexem nessa revisão: uma Mensagem que chega não aparece sem recarregar. Aqui o servidor passa a avisar a tela.

**Pronto quando:** Com duas abas abertas na mesma Conversa, a Mensagem que chega pelo webhook aparece nas duas em menos de 2 s.

- [ ] **3.8.1 Como mandar as novidades para a tela?** `decisão` · *muda o produto*
  - **Como é hoje:** `AcompanhanteDaRevisao` (`apps/web/src/dados/store.ts:319`) chama `GET /estado/revisao` (`apps/api/src/rotas/estado.ts:63`) a cada `INTERVALO_DA_REVISAO_MS` = 5 s (`store.ts:312`) e, se mudou, recarrega o Espaço inteiro. As telas do CRM leem por SWR e não são avisadas.
  - **Você decide:**
    - (A) Supabase Realtime, que já vem com o banco
    - (B) Canal próprio no `apps/api` (SSE), alimentado por `LISTEN/NOTIFY` do Postgres
  - **O que muda depois:** (A) exige expor o schema `plataforma` ao Realtime com regras por linha, o contrário do que a Sessão 1 fecha. (B) cerca de 1 dia, e a regra de acesso continua no `apps/api`, onde já está.
  - **Recomendo:** (B).
- [ ] **3.8.2 Publicar os eventos do CRM no banco** `api`
  - **Hoje:** Nenhuma escrita do CRM avisa ninguém; só a escrita de Canal soma a revisão do Espaço (`avancarRevisaoDoEspaco`, `repositorios/crm/referencias.ts`).
  - **O que fazer:**
    1. `apps/api/src/mensageria/avisar.ts`: `avisarCrm(cliente, evento)` faz `pg_notify('crm_eventos', json)` no mesmo cliente da transação; o Postgres só entrega no `commit`.
    2. Payload só com ids: `{ workspaceId, tipo: 'mensagem.nova' | 'mensagem.status' | 'conversa.mudou', conversaId, mensagemId? }`.
    3. Chamado por `receberMensagem`, `enviar`, `atualizarStatusDeEntrega` e pelos gestos da Conversa (resolver, reabrir, atribuir, mover, lixeira).
  - **Pronto quando:** Teste: uma conexão em `LISTEN crm_eventos` recebe o evento depois do `commit` e nada depois de um `rollback`.
- [ ] **3.8.3 Abrir a rota de eventos para a tela** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. `GET /eventos` em `apps/api/src/rotas/eventos.ts` (novo), `text/event-stream`, com o JWT no `Authorization`, como as outras rotas.
    2. Uma conexão `LISTEN crm_eventos` por processo, fora do pool; cada assinante recebe só os eventos do próprio Espaço e só se pode `ler` `conversa` (`exigir`, `apps/api/src/servicos/crm/acesso.ts:39`).
    3. Batida a cada 25 s, para o proxy não cortar a conexão.
  - **Pronto quando:** Teste de rota: um Membro de outro Espaço conectado em `/eventos` não recebe o evento; sem token, 401.
- [ ] **3.8.4 Ouvir na tela** `web`
  - **Hoje:** Só a releitura a cada 5 s.
  - **O que fazer:**
    1. `apps/web/src/dados/tempo-real.ts`: `fetch` com o token e leitura do corpo em fluxo (o `EventSource` do navegador não manda `Authorization`).
    2. Montado no `StoreProvider` (`store.ts:296`), ao lado de `AcompanhanteDaRevisao`.
    3. A cada evento, `mutate` das chaves de `useConversas`, `useMensagens(conversaId)` e do resumo das Tarefas conversacionais.
    4. Reconecta com espera crescente; sem conexão, volta à releitura de 5 s.
  - **Pronto quando:** Duas abas na mesma Conversa: a recebida simulada pelo webhook aparece nas duas em menos de 2 s; derrubar a api e religar reconecta sozinho.

### 3.9 Mídia nas mensagens

**Objetivo:** Hoje a Mensagem nova só tem texto: o anexo é uma referência externa sem arquivo, o upload não aceita áudio nem vídeo e a Caixa só envia texto. Aqui áudio, imagem, vídeo e documento passam a ir e vir guardados no bucket.

**Pronto quando:** Um áudio recebido pelo provedor de teste toca na Conversa mesmo depois de o link do provedor expirar, e uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada.

- [ ] **3.9.1 Ligar o anexo da Mensagem a um arquivo guardado** `domínio`
  - **Hoje:** `AnexoDaMensagem` (`packages/dominio/src/crm/mensagens.ts:61`) tem só `tipoDeMidia`, `nome` e `referenciaExterna`; `validarNovaMensagem` (`:128`) exige texto e não aceita anexo.
  - **O que fazer:**
    1. `AnexoDaMensagem` ganha `objectKey?: string` (o arquivo no bucket), `tamanhoBytes?: number` e `baixado: boolean` (falso enquanto só há a referência do provedor). A coluna `mensagens.anexos` já é jsonb: não muda o schema.
    2. `NovaMensagem` ganha `anexos?: readonly { objectKey, nome, tipoDeMidia }[]`; `validarNovaMensagem` aceita texto ou anexo (INV-CXE-07) e confere o tipo contra `sendableMediaTypes` das capacidades do Canal.
  - **Pronto quando:** Testes de domínio: Mensagem só com anexo é aceita; vídeo num Canal de e-mail (que não envia vídeo) é recusado.
- [ ] **3.9.2 Aceitar áudio e vídeo nos anexos de Mensagem** `api`
  - **Hoje:** `TIPOS_ACEITOS` (`apps/api/src/servicos/storage-uploads.ts:53`) tem só PDF, XML, JPEG, PNG e WebP, e é a mesma lista do Formulário público (`rotas/formularios-publicos.ts:46`).
  - **O que fazer:**
    1. Lista própria `TIPOS_ACEITOS_NA_MENSAGEM` (os de hoje mais `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `video/mp4`, `video/3gpp`), sem alargar o Formulário.
    2. `assinaturaConfereComTipo` (`storage-uploads.ts:114`) ganha as assinaturas de OGG (`OggS`), MP3 (`ID3` ou `0xFF 0xFB`) e MP4/3GP (`ftyp` no byte 4).
    3. Teto de tamanho próprio para vídeo, por variável de ambiente, como `UPLOAD_MAX_BYTES`.
  - **Pronto quando:** Teste: um OGG verdadeiro é aceito, um arquivo de texto renomeado para `.ogg` é recusado, e o Formulário público continua recusando áudio.
- [ ] **3.9.3 Rotas de upload e download de anexo de Mensagem** `api`
  - **Hoje:** O anexo de Tarefa já faz isso (`apps/api/src/rotas/anexos-da-tarefa.ts:108`, com `formIdDaTarefa`); para Mensagem não existe.
  - **O que fazer:**
    1. `POST /mensagens/anexos` com `{ conversaId, nome, tipoDeMidia, tamanhoBytes }`: abre a sessão (`abrirSessaoDeUpload` com `formId = conversa-<id>`) e emite o ticket; a chave segue `workspace/<ws>/conversas/<conversaId>/<uuid>`.
    2. `POST /mensagens` aceita `anexos` com o `objectKey` confirmado (`confirmarObjeto`) e consome a sessão na mesma transação.
    3. `GET /mensagens/:id/anexos/:indice` confere o acesso à Conversa e devolve `urlDeDownload` (`storage-uploads.ts:289`).
  - **Pronto quando:** Teste de rota: um `objectKey` de outra Conversa é recusado; o download de um Membro sem acesso volta 403.
- [ ] **3.9.4 Baixar a mídia do provedor ao receber** `api`
  - **Hoje:** Não existe: a recebida guarda só o que vier em `anexos`.
  - **O que fazer:**
    1. No processador de entrada, antes da transação: para cada anexo com `referenciaNoProvedor`, chamar `baixarMidia`, subir ao bucket com a chave da subtarefa anterior e gravar `objectKey` com `baixado: true`.
    2. Se o download falhar, a Mensagem é gravada assim mesmo com `baixado: false` e a referência; uma nova tentativa roda na próxima passada do worker.
  - **Pronto quando:** Teste com o provedor de teste: o link do provedor deixa de responder depois do recebimento e o anexo continua abrindo pela URL assinada.
- [ ] **3.9.5 Anexar e tocar mídia no fio** `web`
  - **Hoje:** O compositor de `features/crm/conversation-thread.tsx` envia só texto; `apps/web/src/dados/envio-ao-bucket.ts` já sobe arquivo por URL assinada para Formulário e Tarefa.
  - **O que fazer:**
    1. Botão de anexar no compositor, usando `envio-ao-bucket.ts`; só oferece os tipos que o Canal envia (`sendableMediaTypes`).
    2. No fio: `<audio>`, `<video>`, `<img>` e link de documento, com a URL de `GET /mensagens/:id/anexos/:indice`.
  - **Pronto quando:** Anexar uma imagem pela Caixa mostra a imagem no fio e o provedor de teste recebe a URL assinada.
- [ ] **3.9.6 Ligar a limpeza de arquivos órfãos** `api`
  - **Hoje:** `coletarOrfaos` (`apps/api/src/servicos/storage-uploads.ts:305`) apaga do bucket o que foi enviado e nunca virou anexo, mas só o teste a chama.
  - **O que fazer:**
    1. Rodar uma vez por dia a partir de `apps/api/src/index.ts`, ligado por `COLETA_DE_ORFAOS_ATIVA=true`, protegido por `pg_try_advisory_lock` para só uma instância rodar.
    2. Logar só as contagens (`sessoesExpiradas`, `objetosRemovidos`).
  - **Pronto quando:** Teste: uma sessão expirada criada no teste some do bucket na rodada seguinte.

**A sessão fica pronta quando:** Uma chamada simulada ao webhook de um Canal cria (ou acha) o Contato em `plataforma.contatos`, abre ou reabre a Conversa em `plataforma.conversas` e aparece na Caixa de Entrada de outra aba em menos de 2 s, com o áudio tocando; a resposta escrita na tela passa pela fila e chega ao provedor de teste; e uma busca por `state.contacts`, `state.conversations`, `state.deals` e `state.channels` em `packages/` e `apps/` não acha nada (salvo o que a decisão sobre Grupos e Flows, na 3.1, deixar para as Sessões 6 e 7).

---

## Sessão 4 · WhatsApp não oficial (Evolution API)

Liga o primeiro provedor real: números comuns de WhatsApp, conectados por QR code pela Evolution API. A Evolution é um servidor que conversa com o WhatsApp como se fosse um aparelho conectado ao celular. Cada número vira um Canal `whatsapp-nao-oficial` com a sua própria instância na Evolution (instância = uma sessão de WhatsApp lá dentro). Vem antes dos outros provedores porque destrava a Lista conversacional (Sessão 5) e as Ferramentas (Sessão 6).

**Depende de:** Sessão 3.

> **Ajuste sugerido:** +1 dia: provisionar a instância é rápido, mas a sessão também liga o QR code na tela, o webhook, o envio de texto e mídia, os tiques de entrega e o número com e sem o nono dígito.

**Ponto de partida:**
- O Canal `whatsapp-nao-oficial` já nasce `desconectada` em `plataforma.canais` pela página `/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-nao-oficial` (`apps/web/src/features/crm/conectar-provedor.tsx`).
- A única conexão é o botão “Simular conexão” da ficha do Canal (`apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx:318-326`), que chama `POST /canais/:id/simular-conexao` (`apps/api/src/rotas/crm/canais.ts:93`) e grava `conexao_simulada = true` pela regra `proximaConexao` (`packages/dominio/src/crm/canais.ts:131`).
- As capacidades do não oficial já estão certas: sem janela de 24 h e sem modelo (`capacidadesDoCanal`, `packages/dominio/src/operations/conversations.ts:115`).
- Da Sessão 1: o cofre de credenciais cifradas e o servidor onde a Evolution vai rodar.
- Da Sessão 3: a interface de provedor, a rota de webhook por provedor com fila de entrada, a porta de saída pela outbox, o tempo real, a mídia nas mensagens e o CRM unificado nas tabelas novas.
- Os avisos das Automações do Financeiro já saem por uma Evolution, mas de fora: o evento `automacao.notificar-canal.v1` vai pela outbox ao serviço externo `automation/` (`/webhooks/plataforma/notificar-canal`, `apps/api/src/persistencia/outbox-worker.ts:67`), que envia pela instância fixa `numeropvmarcos`.

### 4.1 Pré-requisitos

**Objetivo:** Ter os números e a Evolution prontos antes de escrever código. Hoje não há número escolhido nem Evolution instalada, e sem os dois nada desta sessão pode ser testado.

**Pronto quando:** A lista de números está anotada e a Evolution responde no servidor.

- [ ] **4.1.1 Separar os números e os celulares** `você`
  - **Hoje:** Nenhum número escolhido.
  - **O que fazer:**
    1. Escolher pelo menos dois números para testar. Um deles pode ser o que vai para produção.
    2. Cada número precisa estar ativo no WhatsApp (de preferência o WhatsApp Business) num celular que fique ligado e com internet: a Evolution funciona como um aparelho conectado a ele.
    3. Não usar o número da instância `numeropvmarcos`: ela é do `automation/` (ver a decisão de 4.5).
    4. Anotar nesta tarefa, para cada número: o número, o nome do Canal (ex.: “Comercial”) e quem fica com o celular.
  - **Pronto quando:** A lista está anotada nesta tarefa.
  - **Atenção:** A API não oficial vai contra os termos do WhatsApp: um número pode ser bloqueado se mandar muita mensagem para quem não o tem salvo. Use números que aguentem esse risco.
- [ ] **4.1.2 Instalar a Evolution API no servidor da Sessão 1** `infra`
  - **Hoje:** A Sessão 1 (1.6) deixa o servidor pronto, sem a Evolution.
  - **O que fazer:**
    1. Subir a Evolution API v2 por Docker, com um Postgres só dela (variáveis `DATABASE_PROVIDER=postgresql` e `DATABASE_CONNECTION_URI`). Nunca o banco da plataforma.
    2. Definir a chave global `AUTHENTICATION_API_KEY` e o endereço público `SERVER_URL`, atrás de HTTPS.
    3. Fechar o painel `/manager` da Evolution para fora (só por VPN ou por IP liberado).
    4. Gravar no `.env` do `apps/api` duas variáveis novas, `EVOLUTION_URL` e `EVOLUTION_API_KEY`, e documentá-las em `apps/api/.env.example`.
  - **Pronto quando:** Uma chamada a `GET /instance/fetchInstances` na Evolution, com a chave global no cabeçalho `apikey`, responde 200 com a lista vazia.
  - **Atenção:** Conferir no repositório oficial (`EvolutionAPI/evolution-api`) o nome atual da imagem Docker e das variáveis antes de instalar.

### 4.2 Conexão por QR code

**Objetivo:** Conectar um número de verdade lendo um QR code na ficha do Canal. Hoje a ficha só tem “Simular conexão”, que marca o Canal como conectado sem falar com ninguém.

**Pronto quando:** Criar um Canal não oficial, clicar em “Conectar” e ler o QR code com o celular deixa o Canal “conectada” na tela, sem recarregar.

- [ ] **4.2.1 Ensinar a conexão real ao domínio** `domínio`
  - **Hoje:** `AcaoDeConexao` (`packages/dominio/src/crm/canais.ts:129`) só tem `simular_conexao` e `desconectar`, e `proximaConexao` (`:131`) só trata essas duas. `AcaoCrm` (`packages/dominio/src/crm/permissoes.ts:47`) não tem “conectar”.
  - **O que fazer:**
    1. Acrescentar a `AcaoDeConexao` três ações: `conectar` (a pessoa pede o QR code), `conexao_confirmada` (o provedor avisou que conectou) e `conexao_perdida` (o provedor avisou que caiu). `desconectar` fica.
    2. Em `proximaConexao`: `conexao_confirmada` leva a `conectada` com `conexaoSimulada` falso; `conexao_perdida` leva a `com_erro`; `conectar` é recusado num Canal arquivado ou já conectado e não muda a conexão.
    3. Acrescentar `conectar` a `AcaoCrm` em `permissoes.ts`, com a mesma regra de quem pode `simular_conexao` hoje.
    4. Nova função `conferirNumeroConectado(canal, numeroDoProvedor)` em `canais.ts`: compara o número que o provedor diz ter conectado com o `identificadorExterno` do Canal e recusa se forem diferentes.
  - **Pronto quando:** Testes em `packages/dominio/src/crm/canais.test.ts` cobrem as quatro ações e o caso do número diferente.
- [ ] **4.2.2 Criar o cliente da Evolution no apps/api** `api`
  - **Hoje:** Nenhum código do `apps/api` chama a Evolution. O único que chama está no `automation/` (`adapters/evolution.ts`, fora deste repositório).
  - **O que fazer:**
    1. Criar `apps/api/src/provedores/evolution/cliente.ts` (dentro da pasta de provedores que a Sessão 3 criar), com `fetch`, cabeçalho `apikey` e tempo limite em toda chamada.
    2. Uma função por chamada da Evolution v2: `criarInstancia` (`POST /instance/create`, com `integration: WHATSAPP-BAILEYS` e `qrcode: true`), `pedirQrCode` (`GET /instance/connect/{instancia}`), `estadoDaConexao` (`GET /instance/connectionState/{instancia}`), `configurarWebhook` (`POST /webhook/set/{instancia}`), `sairDaSessao` (`DELETE /instance/logout/{instancia}`), `apagarInstancia` (`DELETE /instance/delete/{instancia}`), `enviarTexto` (`POST /message/sendText/{instancia}`), `enviarMidia` (`POST /message/sendMedia/{instancia}`), `enviarAudio` (`POST /message/sendWhatsAppAudio/{instancia}`) e `baixarMidia` (`POST /chat/getBase64FromMediaMessage/{instancia}`).
    3. Nome da instância: `n1-<workspaceId>-<canalId>`, para nunca colidir entre Espaços de Trabalho nem com a `numeropvmarcos`.
    4. Os erros da Evolution viram os erros da interface de provedor da Sessão 3 (transitório ou permanente) e passam por `sanitizarErro` (`apps/api/src/persistencia/outbox-worker.ts:108`) antes de ir para o log.
  - **Pronto quando:** Testes em `apps/api/src/provedores/evolution/cliente.test.ts` contra `criarServidorFalso` (`apps/api/src/testes/servidor-falso.ts`) cobrem cada função, uma resposta 401 e um tempo esgotado.
  - **Atenção:** Os caminhos acima são os da Evolution API v2. Conferir na documentação da versão instalada antes de codificar.
- [ ] **4.2.3 Criar a rota de conectar** `api`
  - **Hoje:** `POST /canais/:id/simular-conexao` (`apps/api/src/rotas/crm/canais.ts:93`) chama `simularConexao` (`apps/api/src/servicos/crm/canais.ts:255`), que só grava a marca no banco.
  - **O que fazer:**
    1. Nova rota `POST /canais/:id/conectar` em `rotas/crm/canais.ts`, servida por uma função nova `conectar` em `servicos/crm/canais.ts`.
    2. O serviço confere o Papel com `exigir` e a ação `conectar`. Para `whatsapp-nao-oficial`: cria a instância se ainda não existe; guarda no cofre da Sessão 1 o token da instância que a Evolution devolve; aponta o webhook da instância para a rota de webhook da Sessão 3 (ver 4.4); devolve o QR code (imagem em base64) e o código de pareamento.
    3. Se a instância já existe e está desconectada, só pede um QR code novo (`pedirQrCode`).
    4. Nada grava `conectada` aqui: o Canal só muda quando a Evolution confirmar (4.3).
  - **Pronto quando:** Teste em `apps/api/src/rotas/crm/canais.test.ts`: `POST /canais/:id/conectar` devolve o QR code, a credencial fica cifrada no cofre e o Canal continua `desconectada`.
- [ ] **4.2.4 Mostrar o QR code na ficha do Canal** `web`
  - **Hoje:** A página de conectar mostra um quadro tracejado “disponível quando a integração chegar” (`apps/web/src/features/crm/conectar-provedor.tsx:136-145`, texto em `apps/web/src/features/crm/conectar-canal.ts:40-43`). Depois de criar, ela só abre a ficha (`conectar-provedor.tsx:91`). A ficha mostra “Simular conexão” (`[canal]/page.tsx:318-326`).
  - **O que fazer:**
    1. Na ficha `[canal]/page.tsx`, para o provedor `whatsapp-nao-oficial`, trocar “Simular conexão” por “Conectar”. O clique chama `conectarCanal(id)` (nova, em `apps/web/src/dados/crm/canais.ts`) e abre um painel com o QR code e os passos de `ORIENTACAO_DO_PROVEDOR` (`conectar-canal.ts:33`).
    2. O QR code expira em poucos segundos: trocar a imagem a cada QR novo que chegar pelo tempo real (evento `QRCODE_UPDATED`, 4.3) ou, na falta, pedir outro a cada 30 s enquanto o painel estiver aberto.
    3. Quando o Canal chegar `conectada` pelo tempo real da Sessão 3, mostrar “Conectado” e fechar o painel.
    4. Na página de conectar, depois de criar o Canal, abrir a ficha já com o painel do QR code.
    5. Trocar o texto do quadro reservado em `conectar-canal.ts` por “Depois de criar o Canal, o QR code aparece aqui.”
  - **Pronto quando:** Criar um Canal não oficial e ler o QR code com o celular põe o Canal em “conectada” na tela, sem recarregar.

### 4.3 Estado da conexão

**Objetivo:** O Canal mostra o estado real do número. Hoje o estado só muda pelos botões da ficha: se o celular desliga, a tela continua dizendo “conectada” e as mensagens somem sem aviso.

**Pronto quando:** Desligar a internet do celular muda o Canal para “com erro”; remover o aparelho no celular muda para “desconectada”.

- [ ] **4.3.1 Tratar os eventos de conexão da Evolution** `api`
  - **Hoje:** Nenhum evento de fora chega ao Canal.
  - **O que fazer:**
    1. No tratador da Evolution na rota de webhook da Sessão 3, tratar `CONNECTION_UPDATE`: estado `open` gera `conexao_confirmada`; `close` com o motivo de sessão encerrada (o aparelho foi removido no celular) gera `desconectar`; `close` por outro motivo gera `conexao_perdida`; `connecting` não muda nada.
    2. Na confirmação, ler o número conectado (vem no evento ou em `GET /instance/fetchInstances`) e passar por `conferirNumeroConectado`. Se for outro número: sair da sessão (`sairDaSessao`), pôr o Canal em `com_erro` e mostrar “Este QR code foi lido por outro número.”
    3. Gravar pela `definirConexao` de `apps/api/src/repositorios/crm/canais.ts:209`, avançar a revisão do Espaço e avisar a tela pelo tempo real.
    4. Tratar `QRCODE_UPDATED` repassando o QR novo à tela pelo tempo real.
  - **Pronto quando:** Teste em `apps/api` com eventos `CONNECTION_UPDATE` de exemplo: `open` deixa o Canal `conectada` com `conexao_simulada = false`; `close` por queda deixa `com_erro`; número diferente deixa `com_erro`.
- [ ] **4.3.2 Conferir a conexão de tempos em tempos** `api`
  - **Hoje:** Não existe. Um webhook perdido deixaria o estado errado para sempre.
  - **O que fazer:**
    1. Rotina no `apps/api`, no mesmo molde de `apps/api/src/automacoes/scheduler-worker.ts`, que a cada 5 min chama `estadoDaConexao` para cada Canal `whatsapp-nao-oficial` ativo e corrige o banco quando diverge.
    2. Ligada pela variável `EVOLUTION_CONFERENCIA_ATIVA`, desligada no ambiente local, e iniciada em `apps/api/src/index.ts` como os outros workers.
  - **Pronto quando:** Com o celular desligado, mudar à mão `conexao` para `conectada` no banco: em até 5 min ela volta para `com_erro`.
- [ ] **4.3.3 Desconectar e arquivar de verdade** `api`
  - **Hoje:** `desconectar` e `arquivar` (`apps/api/src/servicos/crm/canais.ts:257` e `:259`) só mudam o banco; o celular continua conectado à Evolution.
  - **O que fazer:**
    1. `desconectar` chama `sairDaSessao` antes de gravar `desconectada`.
    2. `arquivar` chama `sairDaSessao` e `apagarInstancia` e apaga a credencial do Canal no cofre.
    3. Se a Evolution falhar, nada é gravado e a rota devolve “Não foi possível falar com o WhatsApp. Tente de novo.”
  - **Pronto quando:** Desconectar pela ficha faz o aparelho sumir de “Aparelhos conectados” no celular.
- [ ] **4.3.4 Tirar “Simular conexão” da produção** `api` `web`
  - **Hoje:** A rota `POST /canais/:id/simular-conexao`, o serviço `simularConexao`, o botão da ficha e a marca `MarcaDeConexaoSimulada` (`apps/web/src/features/crm/selo-do-provedor.tsx`) valem para todo mundo.
  - **O que fazer:**
    1. Registrar a rota só quando a variável `PERMITIR_CONEXAO_SIMULADA=true` (homologação e testes; nunca em produção).
    2. O botão da ficha só aparece quando a api diz que a simulação está ligada (um campo novo na resposta de `GET /estado`).
    3. Os testes que simulam conexão ligam a variável: `apps/api/src/e2e/canais-fluxo.test.ts`, `apps/api/src/rotas/crm/canais.test.ts`, `apps/api/src/servicos/crm/canais.test.ts` e `apps/web/src/features/crm/ficha-do-canal.test.tsx`.
    4. A coluna `conexao_simulada` fica: ela marca os Canais simulados que já existem.
  - **Pronto quando:** Em produção, `POST /canais/:id/simular-conexao` devolve 404 e o botão não aparece; `npm run check` passa.

### 4.4 Mensagens

**Objetivo:** Receber e responder pela Caixa de Entrada. Hoje a Sessão 3 deixa pronta a porta de entrada e de saída, mas nada entende o formato da Evolution, nem tiques, reações ou mensagens apagadas.

**Pronto quando:** Uma mensagem mandada do celular aparece na Caixa de Entrada; a resposta chega no celular; os tiques e as reações aparecem na tela.

- [ ] **4.4.1 Proteger o webhook da Evolution** `api`
  - **Hoje:** A rota de webhook da Sessão 3 confere a origem por provedor. A Evolution não assina o webhook como a Meta assina.
  - **O que fazer:**
    1. Ao configurar o webhook da instância (`configurarWebhook`), usar um endereço com um segredo aleatório por Canal, guardado no cofre: `/webhooks/evolution/<canalId>/<segredo>`, dentro da rota da Sessão 3.
    2. A rota confere o segredo em tempo constante e confere que o campo `instance` do corpo é a instância daquele Canal. Senão, 401 sem processar.
    3. Assinar só os eventos usados: `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `MESSAGES_DELETE`. Os de grupo entram na Sessão 6.
  - **Pronto quando:** Teste: uma chamada com segredo errado, ou com a instância de outro Canal, recebe 401 e não grava nada na fila de entrada.
- [ ] **4.4.2 Traduzir a mensagem recebida da Evolution** `api`
  - **Hoje:** O recebimento completo (achar ou criar Contato e Conversa) vem da Sessão 3; ele recebe `MensagemRecebidaDoProvedor` (`packages/dominio/src/crm/mensagens.ts:110`) e nada traduz o formato da Evolution para ela.
  - **O que fazer:**
    1. Criar `apps/api/src/provedores/evolution/traduzir.ts`, que transforma o evento `MESSAGES_UPSERT` na entrada do recebimento.
    2. Mapear: `key.id` para `idExterno`; `key.remoteJid` para o número do Contato; `pushName` para o nome sugerido do Contato novo; `messageTimestamp` para `criadoEm`; o texto de `message.conversation` ou `message.extendedTextMessage.text` para `conteudo`; imagem, vídeo, áudio, documento e figurinha para anexo, baixado por `baixarMidia` e guardado pela mídia da Sessão 3; a mensagem citada (`contextInfo.stanzaId`) para `emRespostaAId`, quando a citada existir aqui.
    3. `key.fromMe` verdadeiro (digitada no próprio celular): gravar como `enviada`, ator `integration` (o Canal), status `enviada`. Se o `key.id` já existe porque a plataforma enviou, o índice `mensagens_id_externo_uq` (008, linha 194) descarta a repetida.
    4. Guardar o evento inteiro em `carga_bruta`.
    5. Ignorar por enquanto as mensagens de grupo (`remoteJid` terminado em `@g.us`) e de status (`status@broadcast`): grupos são da Sessão 6.
  - **Pronto quando:** Testes em `apps/api/src/provedores/evolution/traduzir.test.ts` com eventos reais gravados: texto, imagem, áudio, resposta citada, `fromMe` e mensagem de grupo ignorada.
  - **Atenção:** Para ter eventos reais: apontar o webhook da instância de teste para um endereço de captura e salvar os corpos em `apps/api/src/provedores/evolution/exemplos/`, sem dados de clientes. Conferir se a versão instalada entrega o remetente como `@lid` (identificador oculto do WhatsApp, sem número) em vez do número; se entregar, tratar antes de ligar em produção.
- [ ] **4.4.3 Juntar o número com e sem o nono dígito** `domínio`
  - **Hoje:** `normalizarWhatsapp` (`packages/dominio/src/crm/normalizacao.ts:72`) só repassa para `normalizarTelefone` (`:57`), que aceita +55 com 12 ou 13 dígitos sem juntar os dois. O WhatsApp entrega muitos celulares antigos sem o nono dígito (`551187654321`), e o mesmo Contato pode estar cadastrado com ele (`+5511987654321`): viraria um Contato repetido.
  - **O que fazer:**
    1. Nova função `variantesDoNumeroBrasileiro(numero)` em `normalizacao.ts`: para +55 com DDD e celular, devolve as duas formas, com e sem o 9.
    2. O recebimento da Sessão 3 procura o Contato pelas duas formas antes de criar um novo. Contato novo grava a forma com o 9 como `valor` do identificador `whatsapp`.
    3. O envio usa o número como o WhatsApp o conhece: o `remoteJid` da última mensagem recebida na Conversa.
  - **Pronto quando:** Teste: uma mensagem de `551187654321@s.whatsapp.net` cai no Contato cadastrado com `+5511987654321`, sem criar outro.
- [ ] **4.4.4 Enviar texto e mídia pela Evolution** `api`
  - **Hoje:** A porta de saída da Sessão 3 entrega a um provedor de teste; não há provedor Evolution.
  - **O que fazer:**
    1. Implementar `enviar` da interface de provedor em `apps/api/src/provedores/evolution/`: texto por `enviarTexto`; imagem, vídeo e documento por `enviarMidia`, com a URL assinada do arquivo; áudio por `enviarAudio` (chega como mensagem de voz).
    2. Resposta citada: mandar o `idExterno` da Mensagem respondida no campo de citação.
    3. Na volta, gravar o `key.id` devolvido em `id_externo` da Mensagem `enviada`: é ele que liga os tiques depois.
    4. Canal fora de `conectada`: não tentar. A Mensagem fica `pendente` (regra B69) e a outbox tenta de novo quando o Canal voltar.
  - **Pronto quando:** Pela Caixa de Entrada, um texto, uma imagem e um áudio chegam ao celular, e no banco as três Mensagens têm `id_externo` preenchido.
- [ ] **4.4.5 Gravar tiques, reações, edições e mensagens apagadas** `domínio` `api` `web`
  - **Hoje:** As colunas `status_entrega`, `status_entrega_em`, `reacoes`, `marcacao_exclusao` e `edicoes_externas` existem em `plataforma.mensagens` (008, linhas 153-159), mas o repositório (`apps/api/src/repositorios/crm/mensagens.ts`) só insere e lê, e o tipo `Mensagem` as declara como `unknown` (`packages/dominio/src/crm/mensagens.ts:96-99`).
  - **O que fazer:**
    1. No domínio: tipar `Reacao` (`autor`, `emoji`, `em`), `MarcacaoDeExclusao` (`porQuem`, `em`) e `EdicaoExterna` (`conteudoAnterior`, `em`), e criar `proximoStatusDeEntrega(atual, novo)`, que só avança (`enviada`, depois `entregue`, depois `lida`); `falhou` é final.
    2. No repositório: `atualizarStatusDeEntrega`, `registrarReacao`, `marcarExclusao` e `registrarEdicaoExterna`, achando a Mensagem por (`canal_id`, `id_externo`).
    3. No tratador da Evolution: `MESSAGES_UPDATE` vira status (`DELIVERY_ACK` = entregue; `READ` e `PLAYED` = lida; `ERROR` = falhou); a reação (`reactionMessage` dentro de `MESSAGES_UPSERT`) vira reação na Mensagem citada, nunca uma Mensagem nova; `MESSAGES_DELETE` vira marcação de exclusão (o conteúdo fica guardado); a edição (`editedMessage`) vira edição externa.
    4. No fio da Conversa (`apps/web/src/features/crm/conversation-thread.tsx`): mostrar os tiques, as reações embaixo da Mensagem e “mensagem apagada”.
  - **Pronto quando:** Ler no celular uma mensagem enviada pela plataforma vira tique de lida na tela, e reagir a ela no celular mostra a reação embaixo dela; um teste em `apps/api` cobre os quatro eventos.

### 4.5 Vários números

**Objetivo:** Dois ou mais números ao mesmo tempo, cada um com as suas Conversas. Hoje isso só foi testado com Canais simulados, e os avisos do Financeiro seguem por uma Evolution de fora.

**Pronto quando:** Dois números conectados em homologação, sem misturar Conversas, e a decisão dos avisos do Financeiro tomada.

- [ ] **4.5.1 Testar com dois números reais** `você`
  - **Hoje:** Testado só com Canais simulados (`apps/api/src/e2e/canais-fluxo.test.ts`).
  - **O que fazer:**
    1. Conectar em homologação os dois números da lista de 4.1.
    2. Do mesmo celular, mandar mensagem para os dois números e responder pelos dois na Caixa de Entrada.
    3. Conferir que o mesmo Contato tem uma Conversa por Canal e que cada resposta sai pelo número da Conversa.
  - **Pronto quando:** A consulta `select canal_id, count(*) from plataforma.conversas where contato_id = '<id do Contato>' group by canal_id` devolve duas linhas, e cada resposta chegou pelo número certo.
- [ ] **4.5.2 Os avisos do Financeiro passam a sair por um Canal daqui?** `decisão` `api` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** As Automações do Financeiro gravam o evento `automacao.notificar-canal.v1` (`apps/api/src/persistencia/eventos-de-canal.ts`). O worker da outbox o entrega ao `automation/`, que busca o número na Tarefa e envia pela instância `numeropvmarcos` (`sendText` e `sendListMessage`). Os textos dos avisos (`gasto-novo` e `relatorio`) moram no `automation/`. A mesma instância recebe os extratos que chegam por WhatsApp (`/webhook/receber-whatsapp-doc/:origem`).
  - **Você decide:**
    - (A) Sim: o worker monta a Mensagem e envia pela porta de saída, por um Canal conectado aqui
    - (B) Não: continuam pelo `automation/` como estão
  - **O que muda depois:** (A) tira a dependência do `automation/` para avisar, mas exige trazer os textos `gasto-novo` e `relatorio` para o domínio, escolher qual Canal envia e abrir a Conversa com o solicitante na Caixa de Entrada: cerca de 1 dia. E o número `numeropvmarcos` não pode virar Canal aqui sem antes tirar do `automation/` a recepção de extratos, porque cada instância da Evolution tem um endereço de webhook configurado. (B) não muda nada.
  - **Recomendo:** (B) nesta sessão. (A) numa sessão do Financeiro, depois de duas semanas com os números estáveis, usando um número novo e não o `numeropvmarcos`.

**A sessão fica pronta quando:** Dois números conectados por QR code pela ficha do Canal recebem e respondem texto, imagem e áudio pela Caixa de Entrada, cada um nas suas Conversas; os tiques de entregue e lida aparecem; desligar o celular muda o estado do Canal sem ninguém clicar nada; e “Simular conexão” não existe mais em produção.

---

## Sessão 5 · Lista conversacional

Liga a Lista conversacional ao WhatsApp real: a mensagem que chega cria ou atualiza a Tarefa, e a resposta escrita na Tarefa sai pelo WhatsApp. Depende da Evolution (Sessão 4) e da porta de entrada da Sessão 3. Levar a Tarefa conversacional para as tabelas novas saiu daqui e foi para a Sessão 3 (tarefa 3.3).

**Depende de:** Sessão 4.

**Ponto de partida:**
- A Tarefa conversacional cria, troca o Canal e liga o Negócio pelas tabelas novas (Sessão 3, 3.3).
- `receberMensagem` (Sessão 3, 3.6) devolve `{ contato, conversa, contatoNovo, conversaNova, conversaReaberta, repetida }` para o passo seguinte.
- A ficha da Tarefa mostra o fio com o mesmo `ConversationThread` da Caixa (`apps/web/src/features/estrutura/tarefa-completa.tsx:2189`), e o envio sai pela fila de saída (Sessão 3, 3.7).
- Um número conectado pela Evolution (Sessão 4).

### 5.1 Entrada automática pela Lista conversacional

**Objetivo:** Hoje a Tarefa conversacional só nasce quando alguém a cria. Com o WhatsApp real, a mensagem de um Contato novo cai só na Caixa de Entrada. Aqui se decide e se constrói o que a mensagem faz na Lista.

**Pronto quando:** A primeira mensagem de um número novo cria Contato, Conversa e uma Tarefa na Lista; as seguintes não criam outra.

- [ ] **5.1.1 Mensagem nova cria Tarefa?** `decisão` · *muda o produto*
  - **Como é hoje:** A Tarefa conversacional só nasce pelo diálogo da Lista ou pelo botão do fio.
  - **Você decide:**
    - (A) Sim: mensagem de um Contato sem Tarefa aberta na Lista cria uma; com Tarefa aberta, só atualiza o cartão
    - (B) Não: a mensagem só aparece na Caixa de Entrada, e alguém cria a Tarefa
  - **O que muda depois:** Com (A), a Lista vira a fila de atendimento. Com (B), a Caixa de Entrada continua sendo a fila e esta tarefa encolhe para meio dia.
  - **Recomendo:** (A), porque é o propósito da Lista conversacional.
- [ ] **5.1.2 E se o Canal estiver em mais de uma Lista conversacional?** `decisão` · *muda o produto*
  - **Como é hoje:** `validarCanaisDeAtendimento` (`packages/dominio/src/operations/canais.ts:133`) deixa o mesmo Canal em várias Listas.
  - **Você decide:**
    - (A) Um Canal só pode estar em uma Lista conversacional: marcar em outra é recusado
    - (B) A Tarefa nasce na primeira Lista, pela ordem da Estrutura
    - (C) Nasce uma Tarefa em cada Lista
  - **O que muda depois:** (A) é uma recusa a mais na configuração e deixa a regra óbvia. (B) esconde de onde a Tarefa veio. (C) duplica o atendimento.
  - **Recomendo:** (A).
- [ ] **5.1.3 E se a Tarefa do Contato já estiver concluída?** `decisão` · *muda o produto*
  - **Como é hoje:** Nada acontece com a Tarefa quando chega mensagem.
  - **Você decide:**
    - (A) Reabre a Tarefa concluída, voltando ao Status inicial da Lista
    - (B) Cria uma Tarefa nova e deixa a concluída como histórico
    - (C) Segue a Conversa: se a Conversa reabriu (dentro da janela da Caixa), reabre a Tarefa; se nasceu Conversa nova, cria Tarefa nova
  - **O que muda depois:** (A) junta atendimentos diferentes na mesma Tarefa. (B) cria Tarefa até para um “obrigado” logo depois de concluir. (C) usa a mesma janela que já decide a Conversa.
  - **Recomendo:** (C).
- [ ] **5.1.4 Decidir no domínio o que a mensagem faz com a Tarefa** `domínio`
  - **Hoje:** Não existe regra; `tarefasConversacionaisDoContato` (`packages/dominio/src/derive-conversacional.ts:137`) já acha as Tarefas do Contato.
  - **O que fazer:**
    1. `tarefaDaRecebida(state, { canalId, contatoId, conversaId, conversaNova, conversaReaberta })` em `packages/dominio/src/operations/tarefas-conversacionais.ts` → `{ acao: 'nada' } | { acao: 'criar', listId } | { acao: 'atualizar', taskId, statusId? }`.
    2. Acha a Lista conversacional cujo `canaisDeAtendimento` tem o Canal, as Tarefas ativas dela com Vínculo para o Contato, e aplica as três decisões acima.
    3. Se a decisão de “mais de uma Lista” for (A), `validarCanaisDeAtendimento` passa a recusar Canal já usado em outra Lista conversacional.
  - **Pronto quando:** Testes de domínio de cada caso: Contato sem Tarefa; com Tarefa aberta; com Tarefa concluída e Conversa reaberta; com Tarefa concluída e Conversa nova; Canal fora de qualquer Lista.
- [ ] **5.1.5 Criar ou atualizar a Tarefa quando a mensagem chega** `api`
  - **Hoje:** O processador de entrada (Sessão 3, `apps/api/src/mensageria/processador-de-entrada.ts`) para em `receberMensagem`.
  - **O que fazer:**
    1. Depois de `receberMensagem` com `repetida: false`, chamar `executar()` com `tarefaDaRecebida` e, conforme o resultado, `criarTarefaConversacional` (com Contato, Canal e Conversa já lidos, sem abrir Conversa) ou a troca de Status.
    2. Ator: o Membro “Agente do pipeline” (`resolverMembroAgenteDoPipeline`, `apps/api/src/persistencia/credenciais-de-servico.ts:96`), como as integrações já fazem. Responsável da Tarefa nova: o atribuído da Conversa, se houver; senão nenhum.
    3. Roda depois do `commit` da Mensagem: falhar aqui não perde a Mensagem. A linha de `webhooks_recebidos` volta a `pendente`, e reprocessar é seguro porque `tarefaDaRecebida` acha a Tarefa já criada.
  - **Pronto quando:** Teste em `apps/api` com o provedor de teste: a primeira chamada de um número novo cria Contato, Conversa e Tarefa; a segunda não cria outra Tarefa; repetir a mesma chamada do webhook não duplica nada.
- [ ] **5.1.6 Mostrar a Tarefa nova na Lista sem recarregar** `web`
  - **Hoje:** A Tarefa criada pelo servidor só aparece na próxima releitura da revisão (até 5 s), e o cartão não sabe que chegou mensagem.
  - **O que fazer:**
    1. Em `apps/web/src/dados/tempo-real.ts` (Sessão 3), um evento `mensagem.nova` também chama `verificarRevisao()` do store.
    2. O resumo das Tarefas conversacionais (`useResumoDasTarefas`) é revalidado no mesmo evento.
  - **Pronto quando:** Com a Lista aberta, a Tarefa nova aparece em menos de 2 s, e o cartão mostra o trecho da última mensagem.

### 5.2 Responder pela Tarefa pelo WhatsApp

**Objetivo:** A ficha da Tarefa já embute o fio da Caixa. Depois da Sessão 3 o envio sai pela fila; falta garantir que, na Tarefa, a resposta vai pela Conversa da Tarefa e que quem atende vê se chegou.

**Pronto quando:** A resposta escrita na ficha da Tarefa chega no WhatsApp e mostra “entregue” na ficha.

- [ ] **5.2.1 Responder sempre pela Conversa da Tarefa** `web`
  - **Hoje:** No fio, “Responder por” escolhe o Canal pelo padrão do Contato (`canalPadraoDeResposta`, `packages/dominio/src/derive-conversacional.ts:271`); dentro da Tarefa, pode cair num Canal que não é o da Lista.
  - **O que fazer:**
    1. `ConversationThread` ganha a prop `conversaFixaId`, passada pela ficha (`tarefa-completa.tsx:2189`) com a Conversa do Vínculo “conversa da Tarefa”.
    2. Com ela, “Responder por” mostra só os Canais da Lista (`canaisDaLista`), com o da Tarefa marcado; escolher outro chama a troca de Canal da Tarefa (Sessão 3, 3.3).
  - **Pronto quando:** Teste de componente: responder na ficha grava a Mensagem com o `conversaId` do Vínculo, e o seletor não mostra Canal fora da Lista.
- [ ] **5.2.2 Testar a resposta contra a Evolution de homologação** `api`
  - **Hoje:** Os testes de envio da Sessão 3 usam o provedor de teste.
  - **O que fazer:** Teste em `apps/api/src/e2e/` que roda só com as variáveis da Evolution de homologação: cria a Tarefa conversacional num Canal Evolution, envia por `POST /mensagens` e espera a Mensagem ficar `enviada` com `id_externo` e depois `entregue` pelo webhook.
  - **Pronto quando:** O teste passa contra a Evolution de homologação e é pulado sem as variáveis.

### 5.3 Validar de ponta a ponta com número real

**Objetivo:** Ver o fluxo inteiro com um celular de verdade, antes de liberar para a equipe.

**Pronto quando:** Você aprova os seis passos do roteiro.

- [ ] **5.3.1 Percorrer o roteiro com um celular** `você`
  - **O que fazer:**
    1. 1. Conectar o número de teste pela Evolution (Sessão 4) e marcá-lo como Canal da Lista conversacional.
    2. 2. Do seu celular, mandar “oi” para o número.
    3. 3. Conferir: a Tarefa nasce na Lista com o nome do Contato (ou o número), e o cartão mostra “oi”.
    4. 4. Abrir a Tarefa e responder; conferir no celular e ver “entregue” na ficha.
    5. 5. Mandar um áudio do celular; conferir que ele toca na ficha.
    6. 6. Concluir a Tarefa e mandar outra mensagem; conferir que acontece o que a decisão da 5.1 manda.
  - **Pronto quando:** Os seis passos funcionam; o que falhar vira subtarefa nesta tarefa.

**A sessão fica pronta quando:** Uma mensagem de um celular para o número conectado cria (ou atualiza) a Tarefa na Lista conversacional certa, e a resposta escrita na ficha da Tarefa chega no celular.

---

## Sessão 6 · Ferramentas: Grupos e Comunidades

Grupos e Comunidades de WhatsApp deixam de ser simulados e passam a ser os grupos reais dos números conectados pela Evolution na Sessão 4. Hoje o domínio e as telas estão prontos, mas o “provedor” é uma lista fixa em código, e toda operação grava direto em `plataforma.registros` sem falar com ninguém. Esta sessão separa a regra (domínio) da chamada ao WhatsApp (api), cria rotas próprias para os gestos que mexem no WhatsApp e põe um seletor de número no topo da seção.

**Depende de:** Sessão 4.

> **Ajuste sugerido:** +2 dias: cerca de 12 rotas novas, telas passando a falar por HTTP, sincronização pelo webhook e a página pública do Link de captação.

> **Atenção:** Os Flows foram para a Sessão 7: são recurso da API oficial da Meta, e a Evolution não os suporta.

**Ponto de partida:**
- Domínio pronto: 23 operações de Grupo (`packages/dominio/src/operations/ferramentas/grupos.ts`), 13 de Comunidade (`comunidades.ts`), captação (`captacao.ts`), participações (`participacoes.ts`) e notas; tipos em `packages/dominio/src/types/ferramentas.ts`.
- O provedor é simulado e mora dentro das operações: `GRUPOS_NO_PROVEDOR`, `gerarJid` e `gerarEnderecoDeConvite` (`provedor-simulado.ts`) são chamados em `grupos.ts:156`, `:165`, `:298`, `:382` e `:528` e em `comunidades.ts:70` e `:89`.
- Toda operação roda pelo `run()` da tela e por `POST /operacoes/:nome`, gravando em `plataforma.registros`.
- As capacidades são por tipo de Canal, não por provedor: `CAPACIDADES_DE_ATIVOS.whatsapp` (`capacidades.ts:36`) dá grupos e Flows a qualquer WhatsApp, oficial ou não.
- Telas prontas em `apps/web/src/app/(shell)/ferramentas/` e `apps/web/src/features/ferramentas/`, com um filtro `?canal=` em cada aba e um seletor de Canal em cada diálogo.
- Três botões de simulação (“Simular pedido”, “Simular clique” e “Simular entrada”) que só mudam a tela, porque as funções estão fora do registro de operações.
- Não existe página pública para o Link de captação: clicar nele hoje não leva a lugar nenhum.
- Da Sessão 4: o cliente da Evolution, o webhook protegido por Canal e os números conectados.

### 6.1 Levantar o que a Evolution faz com grupos

**Objetivo:** Saber o que dá para ligar antes de ligar. O domínio prevê Comunidades, Pedidos de Entrada e aprovação de entrada, e ninguém conferiu se a Evolution faz isso.

**Pronto quando:** Existe a tabela operação do domínio → chamada da Evolution, e a decisão sobre o que falta está tomada.

- [ ] **6.1.1 Montar a tabela operação → chamada da Evolution** `api`
  - **Hoje:** O plano supunha que a Evolution faz tudo o que o domínio prevê.
  - **O que fazer:**
    1. Na documentação da versão instalada, achar a chamada de cada gesto: criar grupo (`POST /group/create`), listar grupos com participantes (`GET /group/fetchAllGroups`), participantes (`GET /group/participants`), adicionar, remover, promover e rebaixar (`POST /group/updateParticipant` com `add`, `remove`, `promote` e `demote`), nome (`POST /group/updateGroupSubject`), descrição (`POST /group/updateGroupDescription`), foto (`POST /group/updateGroupPicture`), configurações (`POST /group/updateSetting` com `announcement` ou `not_announcement` e `locked` ou `unlocked`), link de convite (`GET /group/inviteCode` e `POST /group/revokeInviteCode`) e sair (`DELETE /group/leaveGroup`).
    2. Marcar o que não tiver chamada: criar Comunidade, vincular Grupo a Comunidade, Grupo de avisos, listar, aprovar e recusar Pedido de Entrada, e a configuração “administradores aprovam entrada” (`administradoresAprovamEntrada`).
    3. Testar cada chamada uma vez contra um número de homologação e anotar o formato da resposta.
  - **Pronto quando:** A tabela está anexada a esta tarefa, com “existe”, “não existe” ou “existe com diferença” para cada operação exportada de `grupos.ts` e `comunidades.ts`.
  - **Atenção:** Os caminhos acima são os da Evolution API v2. A tarefa existe justamente para não supor.
- [ ] **6.1.2 O que fazer com o que a Evolution não faz?** `decisão` `web` · *muda o produto*
  - **Como é hoje:** O domínio tem 13 operações de Comunidade e o fluxo de Pedido de Entrada (`receberPedidoDeEntrada`, `aprovarPedidoDeEntrada` e `recusarPedidoDeEntrada`, `grupos.ts:704-760`), e as telas os mostram.
  - **Você decide:**
    - (A) Esconder na tela o que não existe no provedor e deixar o domínio parado até haver suporte
    - (B) Deixar visível como “só na plataforma”, sem efeito no WhatsApp
    - (C) Implementar direto na biblioteca que a Evolution usa por baixo (Baileys), fora da API dela
  - **O que muda depois:** (A) é o mais honesto e só custa esconder. (B) engana: a pessoa aprova um pedido que não existe no WhatsApp. (C) exige manter uma versão própria da Evolution: vários dias, e quebra a cada versão nova.
  - **Recomendo:** (A), revendo a cada versão nova da Evolution.

### 6.2 Capacidades por provedor

**Objetivo:** Cada número só oferece o que o provedor dele faz. Hoje as capacidades de Ferramentas são do tipo `whatsapp`, então um número oficial aceita criar Grupo e um não oficial aceita Flow.

**Pronto quando:** Criar Grupo num número oficial e publicar Flow num número não oficial são recusados pelo domínio.

- [ ] **6.2.1 Fazer as capacidades de Ferramentas dependerem do provedor** `domínio`
  - **Hoje:** `CAPACIDADES_DE_ATIVOS` (`packages/dominio/src/operations/ferramentas/capacidades.ts:35`) é indexado por `ChannelType`, e `recusaDoCanal` (`permissoes.ts:42-53`) lê `CAPACIDADES_DE_ATIVOS[canal.channelType]`. Há 9 leituras desse objeto no domínio e na tela.
  - **O que fazer:**
    1. Criar `capacidadesDeAtivosDoCanal(canal)` em `capacidades.ts`, no mesmo molde de `capacidadesDoCanal` (`operations/conversations.ts:115`): parte do tipo e sobrepõe por provedor.
    2. `whatsapp-nao-oficial`: grupos sim; Comunidades e Pedidos de Entrada conforme a decisão de 6.1; Flows não.
    3. `whatsapp-cloud`: Flows sim; Grupos e Comunidades não.
    4. Trocar as 9 leituras de `CAPACIDADES_DE_ATIVOS[...]` pela função nova, e a frase de `recusaDoCanal` para “Este número não administra grupos.” (e equivalentes).
  - **Pronto quando:** Testes no domínio: `criarGrupo` com um Canal `whatsapp-cloud` recusa com “Este número não administra grupos.”; `publicarVersao` de um Flow com Canal `whatsapp-nao-oficial` recusa.

### 6.3 Tirar o provedor de dentro das operações

**Objetivo:** As operações passam a receber o que o WhatsApp respondeu, em vez de inventar. Hoje elas geram o identificador do grupo e o link de convite no meio da regra, e o domínio não pode chamar o WhatsApp porque não faz entrada e saída.

**Pronto quando:** Nenhuma operação de `packages/dominio/src/operations/ferramentas/` importa `provedor-simulado.ts` fora dos testes e do seed.

- [ ] **6.3.1 Separar a conferência do efeito em cada operação externa** `domínio`
  - **Hoje:** `criarGrupo` gera o identificador com `gerarJid` e o link com `gerarEnderecoDeConvite` (`grupos.ts:156` e `:165`); `importarGruposDoCanal` lê `GRUPOS_NO_PROVEDOR` (`:298`); `sincronizarGrupo` inventa um link (`:382`); `regenerarLinkDeConvite` também (`:528`); `criarComunidade` gera dois identificadores (`comunidades.ts:70` e `:89`).
  - **O que fazer:**
    1. Para cada operação com efeito no WhatsApp, criar uma função pura `conferir<Operacao>(state, membroId, entrada)` que só valida e devolve o que pedir ao provedor. A operação atual passa a receber na entrada um campo `doProvedor` com o que o WhatsApp respondeu (identificador do grupo, link, lista de grupos, participantes).
    2. Operações: `criarGrupo`, `importarGruposDoCanal`, `sincronizarGrupo`, `editarGrupo`, `adicionarParticipantes`, `removerParticipante`, `promoverParticipante`, `rebaixarParticipante`, `regenerarLinkDeConvite`, `enviarLinkDeConvite`, `sairDoGrupo` e `enviarMensagemAoGrupo`, mais as de Comunidade que a decisão de 6.1 mantiver.
    3. Os eventos que já vêm de fora ficam como estão: `registrarEntradaNoGrupo` (`grupos.ts:795`), `registrarSaidaDoGrupo` (`:825`) e `receberPedidoDeEntrada` (`:704`).
    4. `provedor-simulado.ts` fica só para os testes e o seed (`seed-ferramentas.ts`).
  - **Pronto quando:** Os testes do domínio passam com o `doProvedor` montado à mão, e um teste novo prova que `criarGrupo` grava o identificador que veio em `doProvedor`.

### 6.4 Rotas de Ferramentas que falam com o WhatsApp

**Objetivo:** Os gestos que mexem no WhatsApp passam por rotas próprias no `apps/api`. Hoje tudo vai por `POST /operacoes/:nome`, que aplica a operação sem efeito externo, e a tela aplica antes de o servidor confirmar.

**Pronto quando:** Criar um Grupo pela tela faz o grupo aparecer no celular do número escolhido, e `POST /operacoes/criarGrupo` não existe mais.

- [ ] **6.4.1 Criar as rotas e o serviço de Grupos** `api` `domínio`
  - **Hoje:** Não há rota de Ferramentas: tudo passa por `POST /operacoes/:nome` (`apps/api/src/rotas/operacoes.ts`).
  - **O que fazer:**
    1. Criar `apps/api/src/rotas/ferramentas.ts`, registrada em `apps/api/src/app.ts`, e o serviço `apps/api/src/servicos/ferramentas/grupos.ts`.
    2. Cada rota: (1) roda `conferir<Operacao>` sobre o estado; (2) chama a Evolution pelo cliente da Sessão 4, com a credencial do Canal tirada do cofre; (3) roda a operação com `doProvedor` dentro de `executar` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`).
    3. Rotas: `POST /ferramentas/grupos`, `POST /ferramentas/canais/:canalId/importar-grupos`, `POST /ferramentas/grupos/:id/sincronizar`, `PATCH /ferramentas/grupos/:id`, `POST /ferramentas/grupos/:id/participantes`, `DELETE /ferramentas/grupos/:id/participantes/:participacaoId`, `POST /ferramentas/grupos/:id/participantes/:participacaoId/promover` e `.../rebaixar`, `POST /ferramentas/grupos/:id/link/regenerar`, `POST /ferramentas/grupos/:id/convites`, `POST /ferramentas/grupos/:id/sair` e `POST /ferramentas/grupos/:id/mensagens`.
    4. Se a Evolution aceitou e a gravação falhou, registrar no log e marcar o Grupo para sincronizar: o WhatsApp não desfaz criar grupo.
    5. Tirar essas operações de `OPERACOES` em `packages/dominio/src/operations/registro.ts` (bloco de `ferramentas/grupos.ts`, linhas 237-261), para ninguém criar um Grupo sem passar pelo WhatsApp. Ficam lá as que não saem da plataforma: captação, notas, arquivar, restaurar e lixeira.
  - **Pronto quando:** Teste em `apps/api` com `criarServidorFalso` no lugar da Evolution: `POST /ferramentas/grupos` chama `/group/create` e grava o Grupo com o identificador devolvido; `POST /operacoes/criarGrupo` responde 404.
- [ ] **6.4.2 Fazer as telas chamarem as rotas novas** `web`
  - **Hoje:** Os diálogos e popups chamam as operações pelo `run()` (`apps/web/src/dados/store.ts:373`), que aplica na tela na hora e depois manda para `POST /operacoes`.
  - **O que fazer:**
    1. Criar `apps/web/src/dados/ferramentas.ts`, no molde de `apps/web/src/dados/crm/canais.ts`: uma função por rota, e `rehidratar()` depois do sucesso.
    2. Trocar o `run(...)` por essas funções em `criar-grupo-dialog.tsx`, `importar-grupos-dialog.tsx`, `grupo-popup.tsx`, `participacoes.tsx`, `conversa-do-grupo.tsx` e no menu de sincronizar de `tela-de-ferramentas.tsx` (que hoje chama `sincronizarGrupo` e `sincronizarComunidade` direto).
    3. Enquanto a chamada roda, o botão fica ocupado com “Enviando ao WhatsApp…”; na recusa, mostra a frase da api.
  - **Pronto quando:** Criar um Grupo pela tela faz o grupo aparecer no celular do número escolhido, e a tela só mostra o Grupo depois que a api confirma.

### 6.5 Seletor de número

**Objetivo:** Escolher o número uma vez, no topo, e tudo vir dele. Hoje cada aba tem o seu filtro de Canal e cada diálogo pergunta o Canal de novo, misturando números oficiais e não oficiais.

**Pronto quando:** Trocar o número no topo troca os Grupos e Comunidades mostrados, e nenhum diálogo pergunta o número.

- [ ] **6.5.1 Pôr o seletor no topo de Ferramentas** `web`
  - **Hoje:** Cada aba tem o seu filtro `?canal=` (`aba-grupos.tsx:44`, `aba-comunidades.tsx:25`, `aba-flows.tsx:25`), com todo Canal `whatsapp` ativo, de qualquer provedor (`aba-grupos.tsx:42`).
  - **O que fazer:**
    1. Em `tela-de-ferramentas.tsx`, um `Select` no `PageHeader` com os Canais da aba: Grupos e Comunidades listam os `whatsapp-nao-oficial` conectados; Flows lista os `whatsapp-cloud` (Sessão 7).
    2. O número escolhido fica em `?canal=` (para sobreviver ao F5, como pede `url.ts`) e a última escolha fica no `localStorage`, com leitura e escrita dentro de try/catch.
    3. Tirar os filtros de Canal das três abas: elas leem o `?canal=` do topo.
    4. Sem número conectado: estado vazio com o link para conectar um (`/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-nao-oficial`).
  - **Pronto quando:** Trocar o número no topo troca a lista de Grupos; recarregar a página mantém o número escolhido.
- [ ] **6.5.2 Tirar os seletores de Canal dos diálogos** `web`
  - **Hoje:** `criar-grupo-dialog.tsx:203` (“Canal administrador”), `importar-grupos-dialog.tsx:54`, `criar-comunidade-dialog.tsx:60` e `criar-flow-dialog.tsx:59` (“Canal publicador”) pedem o Canal de novo.
  - **O que fazer:**
    1. Os quatro diálogos recebem o Canal do topo e mostram só o nome dele, sem campo.
    2. `definirCanalDoGrupo` (`grupos.ts:453`) continua no popup do Grupo, para trocar o número administrador.
  - **Pronto quando:** Nenhum diálogo de criar ou importar tem campo de Canal, e o Grupo criado fica no número do topo.

### 6.6 Sincronização

**Objetivo:** O que está no WhatsApp aparece aqui e continua atualizado. Hoje importar lê uma lista fixa e nada muda sozinho.

**Pronto quando:** Um grupo criado no celular do número conectado aparece em Ferramentas em até 10 s, sem clicar em importar.

- [ ] **6.6.1 Receber os eventos de grupo da Evolution** `api`
  - **Hoje:** A Sessão 4 ignora tudo o que vem de `@g.us`.
  - **O que fazer:**
    1. Assinar no webhook da instância os eventos `GROUPS_UPSERT`, `GROUP_UPDATE` e `GROUP_PARTICIPANTS_UPDATE`.
    2. `GROUPS_UPSERT` (o número entrou num grupo, ou alguém criou um no celular): `importarGruposDoCanal` só daquele grupo.
    3. `GROUP_UPDATE`: nome, descrição e configurações pela `sincronizarGrupo` com `doProvedor`.
    4. `GROUP_PARTICIPANTS_UPDATE`: `add` chama `registrarEntradaNoGrupo`; `remove` chama `registrarSaidaDoGrupo`; `promote` e `demote` mudam o papel da participação.
    5. Tudo pela fila de entrada da Sessão 3, como as mensagens.
  - **Pronto quando:** Teste em `apps/api` com os três eventos de exemplo; e, com o celular, criar um grupo faz ele aparecer na tela em até 10 s.
- [ ] **6.6.2 Importar tudo ao conectar e conferir uma vez por dia** `api`
  - **Hoje:** Importar é um botão (`importar-grupos-dialog.tsx`) que lê `GRUPOS_NO_PROVEDOR`.
  - **O que fazer:**
    1. Quando um Canal `whatsapp-nao-oficial` conecta (4.3), importar os grupos dele por `GET /group/fetchAllGroups` com participantes, respeitando `LIMITE_DE_GRUPOS_POR_ESPACO` (200, `capacidades.ts:53`).
    2. Uma rotina diária confere cada Grupo e corrige o que divergiu, porque um webhook pode se perder.
  - **Pronto quando:** Conectar um número que já está em 5 grupos faz os 5 aparecerem sem nenhum clique.
- [ ] **6.6.3 Criar o endereço público do Link de captação** `api`
  - **Hoje:** Não existe página pública para o Link de captação: `apps/web/src/app/(publico)/` só tem `f/[segredo]` e `p/[segredo]`. `registrarClique` (`captacao.ts:165`) só roda pelo botão “Simular clique”.
  - **O que fazer:**
    1. Rota pública `GET /captacao/:slug` no `apps/api`, sem login, com o limite de taxa das rotas públicas (Sessão 1): roda `registrarClique` dentro de `executar` e responde 302 para o link de convite do Grupo escolhido.
    2. Quem clicou e entrou é casado depois pelo `GROUP_PARTICIPANTS_UPDATE` do item acima, e não por `simularEntradaPorClique`.
  - **Pronto quando:** Abrir o endereço do link num celular leva ao convite do grupo no WhatsApp, e o contador de cliques do link sobe.
- [ ] **6.6.4 Tabelas próprias para Grupos e Comunidades?** `decisão` `banco` `api` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** Grupos, Comunidades, Links de captação e Flows estão em `plataforma.registros` e vão inteiros em todo `GET /estado` e em cada `executar`.
  - **Você decide:**
    - (A) Tabelas próprias numa migração nova, com rotas REST, como o CRM na 007
    - (B) Continuam em `plataforma.registros`
  - **O que muda depois:** (A) soma de 2 a 3 dias (tabelas, repositório, rotas de leitura e trocar as telas de `state.grupos` para HTTP), mas Grupos com centenas de participações deixam de pesar no carregamento de toda tela. (B) não custa nada agora, mas cada Grupo importado engorda o estado que todo usuário baixa.
  - **Recomendo:** (B) nesta sessão, medindo o tamanho do `GET /estado` depois de importar os grupos reais; (A) numa sessão própria se passar de 1 MB.
- [ ] **6.6.5 Como guardar a Conversa de um Grupo nas tabelas novas?** `decisão` `banco` · *muda o produto*
  - **Como é hoje:** A Conversa de grupo é do modelo antigo: `conversaDoGrupoOuCriar` (`grupos.ts:844`) cria uma `Conversation` com `groupIdentifier` em `state.conversations`. A tabela nova `plataforma.conversas` exige `contato_id` (008, linha 78) e não tem campo de grupo, e a Sessão 3 tira o modelo antigo.
  - **Você decide:**
    - (A) Migração nova: `contato_id` passa a aceitar vazio e entra `grupo_id`, com a regra de que um dos dois existe
    - (B) Tabela própria para as mensagens de grupo
    - (C) Não guardar mensagens de grupo: Ferramentas só administra o grupo, e enviar ao grupo é só saída
  - **O que muda depois:** (A) reaproveita o fio, o tempo real e a mídia da Caixa de Entrada (cerca de 1 dia), mas mexe no índice `conversas_nao_resolvida_uq`. (B) duplica o fio. (C) é o mais rápido, mas `enviarMensagemAoGrupo` e a aba de conversa do Grupo (`conversa-do-grupo.tsx`) perdem o histórico.
  - **Recomendo:** (A). Se a 3.1.3 ficar em (B), as Conversas de Grupo continuam no modelo antigo até esta sessão, e é aqui que elas passam para as tabelas novas.
- [ ] **6.6.6 Levar a Conversa de Grupo para as tabelas novas e apagar o resto do modelo antigo de Grupos** `domínio` `api` `banco`
  - **Hoje:** `conversaDoGrupoOuCriar` (`packages/dominio/src/operations/ferramentas/grupos.ts:844`) cria uma `Conversation` antiga em `state.conversations`, e `conversaDoGrupo` (`packages/dominio/src/derive-ferramentas.ts:145`) a procura lá.
  - **O que fazer:**
    1. Aplicar a forma escolhida na decisão anterior (migração nova).
    2. Trocar `conversaDoGrupoOuCriar` e `conversaDoGrupo` para ler e gravar em `plataforma.conversas`.
    3. Copiar as Conversas de Grupo que já existem em `plataforma.registros` para a tabela nova e apagar as linhas antigas.
  - **Pronto quando:** Uma consulta mostra zero linhas `colecao = 'conversations'` com `groupIdentifier` em `plataforma.registros`, e a aba de conversa do Grupo mostra o histórico vindo da tabela nova.

### 6.7 Limpeza

**Objetivo:** Tirar o que só existia para o protótipo. Hoje há botões que fingem ser o WhatsApp e códigos de regra (como `RN-FLW-01`) nos textos que a pessoa lê.

**Pronto quando:** Nenhum botão de simular e nenhum código de regra na tela de Ferramentas.

- [ ] **6.7.1 Tirar os três botões de simulação** `web` `domínio`
  - **Hoje:** “Simular pedido” (`apps/web/src/features/ferramentas/pedidos-de-entrada.tsx:44-45`, diálogo em `:120-137`), “Simular clique” (`links-de-captacao.tsx:95`) e “Simular entrada” (`links-de-captacao.tsx:126`) chamam `receberPedidoDeEntrada`, `registrarClique` e `simularEntradaPorClique` pelo `run()`. Essas funções estão fora do registro (`packages/dominio/src/operations/registro.ts:226-233`), então o servidor não as executa: a tela muda e volta no próximo carregamento. (O plano anterior falava em 5 botões; são 3.)
  - **O que fazer:**
    1. Apagar os três botões e o diálogo de pedido simulado.
    2. Apagar `simularEntradaPorClique` (`captacao.ts:188`) do domínio; `registrarClique` fica, usada pela rota pública de 6.6.
    3. Os Pedidos de Entrada passam a vir só do webhook, se a decisão de 6.1 os mantiver.
    4. Atualizar o comentário de `tela-de-ferramentas.tsx:8` (“O provedor é simulado.”).
  - **Pronto quando:** Nenhuma ocorrência de “Simular” em `apps/web/src/features/ferramentas/` fora dos testes, e os testes de tela que clicavam nesses botões foram apagados ou trocados.
- [ ] **6.7.2 Tirar os códigos de regra dos textos** `web` `domínio`
  - **Hoje:** Cerca de 60 códigos (como `RN-FLW-01`, `INV-COM-02`, `RN-GRP-08`) aparecem nos textos de `apps/web/src/features/ferramentas/`, e outros cerca de 50 nas frases de recusa de `packages/dominio/src/operations/ferramentas/` (ex.: “… (INV-COM-02).” em `comunidades.ts`), que a tela mostra no aviso.
  - **O que fazer:**
    1. Apagar os códigos e as referências de seção, como “(20.3)”, dos textos visíveis nos dois lugares. Nos comentários do código eles ficam.
    2. Acrescentar um teste em `apps/web` que renderiza as três abas de Ferramentas e os popups e falha se achar o padrão `RN-`, `INV-` ou `DO-` no texto.
  - **Pronto quando:** O teste novo passa, e nenhuma frase de `fail(` em `operations/ferramentas/` contém `(RN-`, `(INV-` ou `(DO-`.

**A sessão fica pronta quando:** Ao escolher um número no topo de Ferramentas, aparecem os Grupos reais dele; criar um Grupo, mudar o nome e adicionar ou remover participante pela tela muda o grupo no WhatsApp; um grupo criado no celular aparece na tela em segundos; o Link de captação leva ao convite do grupo; nenhum botão “Simular” nem código de regra aparece na tela.

---

## Sessão 7 · WhatsApp oficial (Cloud API) e Flows

Liga o WhatsApp oficial da Meta (Cloud API): um número da empresa conectado por token, com a janela de 24 h, os modelos de mensagem aprovados pela Meta para falar fora dela e os Flows (formulários interativos dentro do WhatsApp), que só existem na API oficial. Só começa com a empresa verificada na Meta e o número dedicado registrado (7.1).

**Depende de:** Sessão 3, Sessão 6, aprovação da Meta.

> **Ajuste sugerido:** +2 dias: Cloud API, modelos de mensagem e Flows, incluindo traduzir o Flow para o formato da Meta. Pode virar duas sessões: Cloud API e modelos (4 dias) e Flows (3 dias).

**Ponto de partida:**
- O Canal `whatsapp-cloud` já nasce pela página de conectar; o quadro do token é só texto (`apps/web/src/features/crm/conectar-canal.ts:21-32`).
- A janela de 24 h já é aplicada no servidor: `validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) recusa fora dela, e o serviço passa `modelosAprovados: []` fixo (`apps/api/src/servicos/crm/mensagens.ts:119`). Fora da janela, nunca sai nada.
- O modelo de mensagem só existe como tipo (`MessageTemplate`, `packages/dominio/src/types/crm.ts:368`) e no seed; o Canal da tabela nova chega à tela com `messageTemplates: []` (`apps/api/src/persistencia/canais-projetados.ts:55`).
- A Caixa de Entrada já troca o texto livre por um seletor de modelo quando a janela fecha (`apps/web/src/features/crm/conversation-thread.tsx:345-357` e `:1298`), lendo `channel.messageTemplates` do modelo antigo.
- Domínio de Flows pronto (`packages/dominio/src/operations/ferramentas/flows.ts`, 27 operações, com versões, telas e componentes) e construtor visual (`apps/web/src/features/ferramentas/flow-builder.tsx`). Publicar, enviar e receber resposta são simulados (`publicarVersao` `:624`, `enviarFlow` `:845`, `receberRespostaDeFlow` `:908`).
- Da Sessão 3: interface de provedor, webhook com fila de entrada, porta de saída, mídia e CRM unificado. Da Sessão 4: `POST /canais/:id/conectar` e `proximoStatusDeEntrega`.

### 7.1 Pré-requisitos na Meta

**Objetivo:** Ter a conta da Meta pronta antes da sessão. Sem empresa verificada, app criado e número registrado, nada desta sessão pode ser testado, e a Meta leva de dias a semanas.

**Pronto quando:** Empresa verificada, app ao vivo, número registrado e os cinco dados de 7.1 entregues.

- [ ] **7.1.1 Verificar a empresa no Meta Business** `você`
  - **Hoje:** Não iniciado.
  - **O que fazer:**
    1. Em business.facebook.com, abrir Configurações do negócio › Central de segurança › Verificação da empresa.
    2. Enviar razão social e CNPJ exatamente como no cartão CNPJ, endereço, telefone e site; confirmar o domínio ou o telefone quando a Meta pedir.
    3. Anotar nesta tarefa o ID do portfólio empresarial.
  - **Pronto quando:** A Central de segurança mostra a empresa como verificada.
  - **Atenção:** Começar na primeira semana do plano: a Meta pode levar de dias a semanas e às vezes pede documentos de novo.
- [ ] **7.1.2 Separar o número dedicado** `você`
  - **Hoje:** Não iniciado.
  - **O que fazer:**
    1. Ter um número que receba SMS ou ligação e que não esteja em uso no aplicativo WhatsApp. Se estiver, apagar a conta do WhatsApp nele antes (não basta desinstalar).
    2. Não usar nenhum dos números da Sessão 4.
    3. Escolher o nome de exibição seguindo as regras da Meta: o nome da empresa ou da marca, como aparece no site.
  - **Pronto quando:** Número e nome de exibição anotados nesta tarefa.
  - **Atenção:** A Meta tem um modo de coexistência que deixa o mesmo número no aplicativo WhatsApp Business e na API. Conferir se está disponível para a conta antes de apagar a conta do aplicativo.
- [ ] **7.1.3 Criar o app, registrar o número e gerar o token** `você`
  - **Hoje:** Não iniciado.
  - **O que fazer:**
    1. Em developers.facebook.com, criar um app do tipo Empresa, ligado ao portfólio verificado, e adicionar o produto WhatsApp.
    2. Em WhatsApp › Configuração da API, adicionar o número dedicado, confirmar pelo código e definir o PIN de duas etapas (guardar o PIN).
    3. No Meta Business, cadastrar uma forma de pagamento na conta do WhatsApp Business: a Meta cobra os modelos de mensagem.
    4. Criar um usuário do sistema administrador, dar a ele o app e a conta do WhatsApp Business, e gerar um token permanente com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
    5. Publicar uma página de política de privacidade e pôr o app no modo Ao vivo: em modo de desenvolvimento a Meta não manda os webhooks de produção.
    6. Entregar por um canal seguro, nunca por mensagem: ID do app, chave secreta do app, ID da conta do WhatsApp Business (WABA), ID do número (Phone Number ID) e o token. O token vai direto no formulário de conectar (7.2); a chave secreta, no `.env` do `apps/api`.
  - **Pronto quando:** Na Configuração da API do app, o número aparece conectado, e um envio de teste da própria página da Meta chega ao seu celular.
  - **Atenção:** Para usar o número da própria empresa não é preciso revisão de app. Ela só entra se outras empresas forem conectar números delas pela plataforma (ver a decisão de 7.2).

### 7.2 Conexão e mensagens

**Objetivo:** Receber e enviar pela API oficial. Hoje o Canal oficial só existe no banco, desconectado, e nada fala com a Meta.

**Pronto quando:** Um número oficial conectado pela tela conversa pela Caixa de Entrada, com os tiques de entregue e lida.

- [ ] **7.2.1 Como o número oficial se conecta?** `decisão` `web` `api` · *muda o produto*
  - **Como é hoje:** A página de conectar diz que o token “será pedido aqui quando a integração existir” (`conectar-canal.ts:26`).
  - **Você decide:**
    - (A) Manual: a pessoa cola o ID do número, o ID da WABA e o token do usuário do sistema num formulário
    - (B) Cadastro incorporado da Meta (Embedded Signup): um botão abre o login da Meta e devolve tudo sozinho
  - **O que muda depois:** (A) cabe nesta sessão e serve para os números da própria empresa. (B) é o que serve para outras empresas conectarem os números delas, mas exige revisão de app, o app como Provedor de Tecnologia e cerca de 2 dias a mais.
  - **Recomendo:** (A) agora; (B) só se a plataforma for usada por outras empresas.
- [ ] **7.2.2 Criar o cliente da Cloud API** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Criar `apps/api/src/provedores/whatsapp-cloud/cliente.ts`, chamando a Graph API da Meta (`https://graph.facebook.com/<versão>`, com a versão fixa na variável `META_GRAPH_VERSAO`) com o token do Canal tirado do cofre.
    2. Funções: `enviarMensagem` (`POST /{phone-number-id}/messages`, com os tipos `text`, `image`, `audio`, `video`, `document`, `template`, `interactive` e `reaction`), `subirMidia` (`POST /{phone-number-id}/media`), `baixarMidia` (`GET /{media-id}` devolve um endereço temporário, baixado com o mesmo token), `marcarComoLida` (`POST /{phone-number-id}/messages` com `status: read`) e `dadosDoNumero` (`GET /{phone-number-id}`).
    3. Os erros da Graph (`error.code`) viram transitório ou permanente, como pede a interface da Sessão 3; o código 131047 (mensagem fora da janela) vira a mesma recusa de janela de `validarEnvio`.
  - **Pronto quando:** Testes em `apps/api/src/provedores/whatsapp-cloud/cliente.test.ts` contra `criarServidorFalso` cobrem cada função e um token vencido.
  - **Atenção:** Conferir os nomes dos campos na versão da Graph API escolhida antes de codificar.
- [ ] **7.2.3 Conectar pelo token** `api`
  - **Hoje:** `POST /canais/:id/conectar` (Sessão 4) só trata o não oficial.
  - **O que fazer:**
    1. Para `whatsapp-cloud`, a rota recebe `phoneNumberId`, `wabaId` e `token`, guarda o token no cofre, chama `dadosDoNumero` e confere que `display_phone_number` é o `identificadorExterno` do Canal (por `conferirNumeroConectado`, da Sessão 4).
    2. Inscreve o app na conta (`POST /{waba-id}/subscribed_apps`) para os webhooks chegarem.
    3. Tudo certo: grava `conexao_confirmada` na hora (aqui não há QR code).
  - **Pronto quando:** Teste: com o servidor falso respondendo o número certo, o Canal fica `conectada`; com outro número, fica `desconectada` e a rota devolve “Este token é de outro número.”
- [ ] **7.2.4 Receber pelo webhook da Meta** `api` `infra`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Na rota de webhook da Sessão 3, o tratador `whatsapp-cloud`: no `GET`, responder `hub.challenge` quando `hub.verify_token` é igual à variável `META_WEBHOOK_VERIFY_TOKEN`; no `POST`, conferir a assinatura `X-Hub-Signature-256` contra `META_APP_SECRET` sobre o corpo cru, antes de qualquer leitura.
    2. A conferência de assinatura fica em `apps/api/src/provedores/meta/assinatura.ts`, para o Instagram (Sessão 8) usar a mesma.
    3. Achar o Canal pelo `metadata.phone_number_id` do evento.
    4. Traduzir `messages` (texto, mídia, `context.id` da mensagem citada, `reaction`, `interactive`) para o recebimento da Sessão 3, e `statuses` (`sent`, `delivered`, `read`, `failed`) para `proximoStatusDeEntrega`.
    5. Responder 200 logo depois de pôr na fila de entrada: a Meta reenvia se demorar.
    6. No painel do app da Meta, em WhatsApp › Configuração, cadastrar o endereço do webhook e o token de verificação e assinar o campo `messages`.
  - **Pronto quando:** Teste: corpo com assinatura errada recebe 401 e não entra na fila; um evento `messages` de exemplo cria a Mensagem na Conversa do Contato.
- [ ] **7.2.5 Formulário de conectar da Cloud API** `web`
  - **Hoje:** Só o quadro reservado “Token de acesso e número verificado” (`conectar-canal.ts:28-31`) e três passos genéricos (`:23-27`).
  - **O que fazer:**
    1. Na ficha do Canal `whatsapp-cloud` (`[canal]/page.tsx`), o botão “Conectar” abre um formulário com três campos (ID do número, ID da conta do WhatsApp Business e token), cada um dizendo onde achar o dado no painel da Meta.
    2. O token é campo de senha, nunca volta da api e não aparece em log.
    3. Trocar os passos de `ORIENTACAO_DO_PROVEDOR` para `whatsapp-cloud` pelos passos de 7.1.
  - **Pronto quando:** Você conecta o número oficial pela tela, sem ajuda, e o Canal fica “conectada”.
- [ ] **7.2.6 Exigir modelo também antes da primeira mensagem do Contato** `domínio` `web`
  - **Hoje:** `validarEnvio` libera texto livre quando o Contato nunca mandou nada (`ultimaRecebidaEm === null`, `packages/dominio/src/crm/mensagens.ts:166`). No WhatsApp oficial é o contrário: a empresa só abre conversa com modelo aprovado.
  - **O que fazer:**
    1. Em `validarEnvio`, com `requiresTemplateOutsideWindow` verdadeiro e nenhuma recebida, exigir modelo como se estivesse fora da janela.
    2. Ajustar a frase da Caixa de Entrada (`conversation-thread.tsx:409-415`) para o caso “o Contato ainda não mandou mensagem”.
  - **Pronto quando:** Teste em `packages/dominio/src/crm/mensagens.test.ts`: numa Conversa nova de um Canal `whatsapp-cloud`, sem recebida, texto livre é recusado e modelo aprovado passa.

### 7.3 Modelos de mensagem

**Objetivo:** Falar com o cliente depois das 24 h usando modelos aprovados pela Meta. Hoje não há onde guardar modelo, o servidor passa uma lista vazia, e por isso nada sai fora da janela.

**Pronto quando:** Fora da janela, a resposta escolhe um modelo aprovado, preenche as variáveis e chega ao celular.

- [ ] **7.3.1 Criar as tabelas de modelos e de respostas de Flow** `banco` `domínio`
  - **Hoje:** A 008 deixou modelos de fora de propósito (comentário da linha 17). O tipo `MessageTemplate` (`types/crm.ts:368`) só tem `providerId`, `name`, `language`, `body`, `category` e `approval`: não tem onde guardar variáveis, cabeçalho e botões.
  - **O que fazer:**
    1. Migração nova com `plataforma.modelos_de_mensagem`: `workspace_id`, `id`, `canal_id` (FK composta para `plataforma.canais`), `id_no_provedor`, `nome`, `idioma`, `categoria` (`utilidade`, `marketing`, `autenticacao`), `estado` (`aprovado`, `pendente`, `rejeitado`, `pausado`, `desativado`), `motivo_rejeicao`, `componentes` (jsonb, como a Meta devolve), `quantidade_de_variaveis` e `sincronizado_em`; único por (`workspace_id`, `canal_id`, `nome`, `idioma`).
    2. Na mesma migração, `plataforma.respostas_de_flow` (ver 7.4): `workspace_id`, `id`, `mensagem_id` (FK composta para `plataforma.mensagens`), `flow_id`, `versao_id`, `valores` (jsonb), `nao_conforme` e `recebida_em`.
    3. No domínio, `packages/dominio/src/crm/modelos.ts` com o tipo `ModeloDeMensagem` em camelCase e `validarVariaveis(modelo, valores)`: quantidade certa e nenhuma vazia.
  - **Pronto quando:** `npm run migrar -w @n1/api -- --seco` lista a migração nova, ela está aplicada em homologação, e há testes de `validarVariaveis`.
- [ ] **7.3.2 Sincronizar os modelos com a Meta** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. `sincronizarModelos(canal)` em `apps/api/src/provedores/whatsapp-cloud/modelos.ts`: lê `GET /{waba-id}/message_templates` (paginado) e grava na tabela nova, apagando os que sumiram na Meta.
    2. Roda ao conectar o Canal, de hora em hora e quando chega o webhook `message_template_status_update` (assinar esse campo no painel do app).
    3. Rota `GET /canais/:id/modelos` em `apps/api/src/rotas/crm/canais.ts`, para a tela.
  - **Pronto quando:** Um modelo criado no Gerenciador do WhatsApp aparece em `GET /canais/:id/modelos`, e quando a Meta o aprova o estado muda sozinho.
- [ ] **7.3.3 Criar modelos pela plataforma?** `decisão` `web` `api` · *muda o produto*
  - **Como é hoje:** A ficha do Canal só lista modelos (`[canal]/page.tsx:210-252`), sem criar.
  - **Você decide:**
    - (A) Só sincronizar: os modelos são criados no Gerenciador do WhatsApp, na Meta
    - (B) Criar e mandar para aprovação pela plataforma (`POST /{waba-id}/message_templates`)
  - **O que muda depois:** (A) cabe nesta sessão. (B) soma cerca de 1,5 dia: formulário com corpo, variáveis com exemplo, cabeçalho e botões, e as regras de categoria da Meta.
  - **Recomendo:** (A) agora; (B) se os modelos mudarem toda semana.
- [ ] **7.3.4 Usar os modelos aprovados no envio** `domínio` `api`
  - **Hoje:** `modelosAprovados: []` está fixo em `apps/api/src/servicos/crm/mensagens.ts:119`. `NovaMensagem` (`packages/dominio/src/crm/mensagens.ts:103`) e o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40`) não têm campo de modelo.
  - **O que fazer:**
    1. Acrescentar `modeloId` e `variaveis` a `NovaMensagem` e ao esquema da rota.
    2. No serviço, ler os ids aprovados do Canal na tabela nova e passar em `modelosAprovados`; validar as variáveis com `validarVariaveis`.
    3. Gravar `modelo_usado` (`idNoProvedor` e `nome`, coluna que a 008 já tem) e o texto final, com as variáveis preenchidas, em `conteudo`.
    4. O provedor envia como mensagem `template`, com os `components` e os parâmetros.
    5. Na recusa `JANELA_EXPIRADA`, devolver a lista de modelos aprovados do Canal.
  - **Pronto quando:** Teste em `apps/api/src/servicos/crm/mensagens.test.ts`: fora da janela, sem modelo, dá 409 `JANELA_EXPIRADA` com a lista de modelos; com modelo aprovado e variáveis, grava `modelo_usado` e sai pelo provedor.
- [ ] **7.3.5 Escolher o modelo na Caixa de Entrada** `web`
  - **Hoje:** O seletor existe (`conversation-thread.tsx:345-357` e `:1298`), mas lê `channel.messageTemplates`, que chega vazio para o Canal da tabela nova, e não pede variáveis. (O plano anterior dizia que não existia.)
  - **O que fazer:**
    1. Ler os modelos aprovados de `GET /canais/:id/modelos` (função nova em `apps/web/src/dados/crm/canais.ts`).
    2. Ao escolher, mostrar a prévia do corpo e um campo por variável (`{{1}}`, `{{2}}`…), pré-preenchendo `{{1}}` com o primeiro nome do Contato.
    3. Na ficha do Canal (`[canal]/page.tsx:210-252`), a lista de modelos lê a mesma rota e mostra o motivo de rejeição.
  - **Pronto quando:** Numa Conversa com a janela fechada, escolher um modelo, preencher a variável e enviar faz a mensagem chegar ao celular.

### 7.4 Flows

**Objetivo:** Mandar formulários interativos pelo WhatsApp e guardar as respostas. Hoje o construtor monta o Flow, mas publicar, enviar e receber são de mentira, e o documento gerado não está no formato que a Meta aceita.

**Pronto quando:** Um Flow publicado pela tela aparece na Meta, é enviado a um Contato, e a resposta fica guardada e pode ser copiada para o Contato por uma Automação.

- [ ] **7.4.1 Quais Flows entram nesta sessão?** `decisão` · *muda o produto*
  - **Como é hoje:** O domínio tem Flows simples (telas que navegam e concluem) e Flows com ponto de troca de dados (`definirPontoDeTrocaDeDados`, `flows.ts:224`), em que o WhatsApp chama um servidor nosso a cada tela, com o corpo cifrado.
  - **Você decide:**
    - (A) Só Flows sem ponto de troca de dados
    - (B) Os dois
  - **O que muda depois:** (A) cabe nesta sessão. (B) soma cerca de 2 dias: o endereço público, a cifra com a chave enviada à Meta e responder em poucos segundos a cada tela.
  - **Recomendo:** (A), escondendo o ponto de troca de dados na tela até haver um caso de uso.
- [ ] **7.4.2 Gerar o JSON do Flow no formato da Meta** `domínio`
  - **Hoje:** `definicaoPublicavel` (`packages/dominio/src/operations/ferramentas/flows-validacao.ts:249`) gera um documento com os nomes do domínio em português (`type: c.tipo`, como `campoDeTexto`, `formulario` e `rodape`, e propriedades como `rotulo`), que a Meta não aceita.
  - **O que fazer:**
    1. Nova função `flowJsonDaMeta(flow, versao)` em `packages/dominio/src/operations/ferramentas/flow-json-meta.ts`, que traduz cada `TipoDeComponente` (`types/ferramentas.ts:240`) para o componente da Meta (ex.: `titulo` → `TextHeading`, `campoDeTexto` → `TextInput`, `areaDeTexto` → `TextArea`, `escolhaUnica` → `RadioButtonsGroup`, `multiplaEscolha` → `CheckboxGroup`, `menuSuspenso` → `Dropdown`, `seletorDeData` → `DatePicker`, `consentimento` → `OptIn`, `formulario` → `Form`, `condicional` → `If`, `rodape` → `Footer`) e cada `TipoDeAcao` para a ação da Meta (`navegar` → `navigate`, `concluir` → `complete`, `trocaDeDados` → `data_exchange`, `abrirEndereco` → `open_url`, `atualizarDados` → `update_data`).
    2. `version` sai de `versaoDeEsquemaDoFlow` (`capacidades.ts:44`, hoje 6.3).
    3. Componente sem equivalente na versão do esquema: a validação de `flows-validacao.ts` recusa antes de publicar.
  - **Pronto quando:** Teste com o Flow do seed (`seed-ferramentas.ts`): o JSON gerado, colado no construtor de Flows do Gerenciador do WhatsApp, não mostra erro.
  - **Atenção:** Conferir a tabela de componentes e ações na documentação da versão de esquema escolhida.
- [ ] **7.4.3 Publicar o Flow na Meta** `api` `web` `domínio`
  - **Hoje:** `publicarVersao` (`flows.ts:624`) inventa o id com `gerarIdentificadorDeFlow` e marca `publicado` sem falar com ninguém.
  - **O que fazer:**
    1. Rota `POST /ferramentas/flows/:id/publicar` em `apps/api/src/rotas/ferramentas.ts`, no padrão de 6.4: conferir no domínio; criar o Flow na Meta na primeira vez (`POST /{waba-id}/flows`, com nome e categoria); subir o JSON (`POST /{flow-id}/assets`, arquivo `flow.json`); ler `validation_errors` e, se houver, devolver as mensagens; publicar (`POST /{flow-id}/publish`); gravar com `publicarVersao` recebendo o id real em `doProvedor`.
    2. `despublicarFlow` (`flows.ts:662`) chama `POST /{flow-id}/deprecate`; `sincronizarFlow` (`flows.ts:796`) lê `GET /{flow-id}` para o estado na Meta.
    3. Tirar `publicarVersao`, `despublicarFlow`, `sincronizarFlow` e `enviarFlow` de `OPERACOES` em `registro.ts`; o botão de publicar de `flow-builder.tsx` e de `flow-popup.tsx` chama a rota.
  - **Pronto quando:** Publicar pela tela faz o Flow aparecer como publicado no Gerenciador do WhatsApp; um erro de validação da Meta aparece na tela com o texto dela.
- [ ] **7.4.4 Enviar o Flow e receber a resposta** `api` `domínio`
  - **Hoje:** `enviarFlow` (`flows.ts:845`) grava no modelo antigo pelo `sendMessage` e confere a capacidade por `CHANNEL_CAPABILITIES[canal.channelType]` (`:859`), que deixa o não oficial enviar Flow. `receberRespostaDeFlow` (`:908`) inventa o id da resposta com `gerarIdentificadorDeResposta`.
  - **O que fazer:**
    1. Trocar a conferência de `:859` por `capacidadesDeAtivosDoCanal` (6.2).
    2. Enviar pela porta de saída uma mensagem `interactive` do tipo `flow`, com `flow_id`, `flow_cta` (o rótulo do botão), `flow_action: navigate`, a tela inicial e `flow_token` igual ao id da Mensagem enviada. Fora da janela, só por modelo com botão de Flow.
    3. No webhook da Cloud API, a mensagem `interactive` do tipo `nfm_reply` traz `response_json`: achar a Mensagem de origem pelo `flow_token` e chamar `receberRespostaDeFlow` com os valores e o id da mensagem como `identificadorDeRespostaDoProvedor`.
    4. Gravar a resposta estruturada em `plataforma.respostas_de_flow` (7.3), porque `plataforma.mensagens` não tem campo para ela.
  - **Pronto quando:** Enviar um Flow a um Contato real, preencher no celular e concluir grava uma linha em `plataforma.respostas_de_flow`, e a resposta aparece no fio da Conversa.
- [ ] **7.4.5 Copiar as respostas para o Contato por Automação** `domínio` `web`
  - **Hoje:** Pela regra RN-FLW-14, o Contato não muda sozinho com a resposta: `receberRespostaDeFlow` emite o evento `respostaDeFlowRecebida` (`flows.ts:943`) para as Automações. Mas a ação `contato.definirCampo` (`runAction` em `packages/dominio/src/operations/ferramentas/automacoes.ts`) só grava um valor fixo (`spec.value`), não o que o Contato respondeu. (O plano anterior mandava gravar no Contato direto, o que fere a regra.)
  - **O que fazer:**
    1. Escrever no catálogo de Automações em código (Sessão 18) a Automação “Copiar resposta de Flow para o Contato”: gatilho no evento `respostaDeFlowRecebida` (`flows.ts:943`), parâmetros “qual Flow” e “de qual campo do Flow para qual Campo do Contato”.
    2. Ela grava no Contato da tabela nova (`plataforma.contatos`), conforme a unificação da Sessão 3.
    3. Não mexer no editor visual de Automações: ele sai na Sessão 18, como decidido em 19/10.
  - **Pronto quando:** Teste: uma Automação “Resposta de Flow recebida → definir o Campo E-mail com o campo `email` do Flow” grava no Contato o e-mail que veio na resposta.
  - **Atenção:** Se a Sessão 7 vier antes da 16, esta Automação nasce como exemplo do catálogo e a 18.2 reaproveita o formato.
- [ ] **7.4.6 Levar as Mensagens de Flow para as tabelas novas e apagar o resto do modelo antigo** `domínio` `api` `banco`
  - **Hoje:** Envios e respostas de Flow são contados pelas Mensagens antigas: `enviosDoFlow` e `respostasDoFlow` (`packages/dominio/src/derive-ferramentas.ts:275` e `:287`) e `receiveMessage` (`packages/dominio/src/operations/ferramentas/flows.ts:922`).
  - **O que fazer:**
    1. Trocar as três funções para ler e gravar nas tabelas de respostas de Flow criadas na 7.3.
    2. Copiar o que existir em `plataforma.registros` e apagar as linhas antigas.
    3. Com isso, o tipo `Conversation` antigo deixa de ter uso: apagar o tipo, as operações e a coleção `conversations` de `colecoes.ts` e `state.ts`.
  - **Pronto quando:** `npm run check` passa sem o tipo `Conversation` antigo, e um Flow enviado e respondido aparece contado na tela do Flow.

**A sessão fica pronta quando:** Um número oficial conectado pela tela conversa pela Caixa de Entrada; fora da janela de 24 h, a resposta só sai escolhendo um modelo aprovado, e chega; um Flow publicado pela tela aparece na conta da Meta, é enviado a um Contato e a resposta dele fica guardada na Conversa.

---

## Sessão 8 · Instagram

Mensagens diretas (Direct) de uma conta profissional do Instagram entram e saem pela Caixa de Entrada. O Instagram tem regras próprias: só se responde a quem escreveu primeiro, dentro de 24 h, e não existe modelo aprovado para falar depois disso. E a pessoa chega identificada por um número interno do Instagram, não pelo @.

**Depende de:** Sessão 3, aprovação da Meta.

**Ponto de partida:**
- O provedor `instagram-graph` existe (`packages/dominio/src/provedores-de-canal.ts:32`), e o Canal nasce pela página de conectar com o @ da conta como identificador (`identificadorCanonico`, `packages/dominio/src/operations/canais.ts:92-99`).
- As capacidades do tipo `instagram` (`packages/dominio/src/operations/conversations.ts:37-52`): janela de 24 h, status `enviada` e `lida`, reações e mídia só de imagem, vídeo e áudio. Mas `requiresTemplateOutsideWindow: true` faz a recusa falar em “Mensagem de modelo”, que o Instagram não tem.
- O Contato tem o identificador do tipo `instagram` em `plataforma.contato_identificadores` (`apps/api/migracoes/007-crm.sql:113`), pensado para o @ digitado na ficha.
- Da Sessão 3: interface de provedor, webhook com fila de entrada, porta de saída e mídia. Da Sessão 7, se já feita: a conferência de assinatura da Meta em `apps/api/src/provedores/meta/assinatura.ts` e o app da Meta.

### 8.1 Pré-requisitos

**Objetivo:** Ter a conta e as permissões de mensagem antes da sessão. A permissão de mensagens pode depender de revisão da Meta, que leva semanas.

**Pronto quando:** Conta profissional pronta, produto Instagram no app da Meta e a permissão de mensagens funcionando.

- [ ] **8.1.1 Preparar a conta do Instagram e o app da Meta** `você`
  - **Hoje:** Não iniciado.
  - **O que fazer:**
    1. No aplicativo do Instagram, mudar a conta para profissional (Empresa ou Criador de conteúdo), se ainda não for.
    2. No mesmo aplicativo, permitir o acesso de ferramentas conectadas às mensagens (fica em Configurações, na parte de mensagens; o nome do item muda com a versão do aplicativo).
    3. Se a decisão de 8.2 for o login do Facebook: ligar a conta a uma Página do Facebook no Meta Business.
    4. No app da Meta da Sessão 7 (o mesmo serve; se a Sessão 7 ainda não foi feita, criar como em 7.1), adicionar o produto Instagram.
    5. Entregar: o @ da conta e acesso de administrador ao app para quem vai desenvolver.
  - **Pronto quando:** A conta aparece como profissional e o app da Meta tem o produto Instagram.
- [ ] **8.1.2 Pedir a permissão de mensagens, se for preciso** `você`
  - **Hoje:** Não iniciado.
  - **O que fazer:**
    1. No painel do app, ver se a permissão de mensagens (`instagram_business_manage_messages` no login do Instagram, ou `instagram_manage_messages` no login do Facebook) está em acesso padrão ou avançado.
    2. Se a conta conectada for de quem tem papel no app, o acesso padrão pode bastar. Se não, pedir o acesso avançado na Revisão do app, com um vídeo da tela mostrando uma mensagem chegando e sendo respondida (dá para gravar em homologação no fim da sessão).
    3. A empresa precisa estar verificada (7.1) e o app no modo Ao vivo.
  - **Pronto quando:** A permissão aparece aprovada, ou o acesso padrão funciona com a conta da empresa.
  - **Atenção:** A revisão costuma levar de 1 a 4 semanas: pedir logo depois da verificação da empresa.

### 8.2 Conexão

**Objetivo:** Ligar a conta profissional do Instagram pela ficha do Canal. Hoje a página de conectar só tem um texto reservado e o `apps/api` não tem nenhum login da Meta.

**Pronto quando:** Você conecta a conta pela tela e a ficha mostra “Conectado como @conta”.

- [ ] **8.2.1 Login do Instagram ou do Facebook?** `decisão` · *muda o produto*
  - **Como é hoje:** Os passos de hoje (`apps/web/src/features/crm/conectar-canal.ts:45-56`) supõem o login do Facebook com uma Página ligada.
  - **Você decide:**
    - (A) API do Instagram com login do Instagram: a pessoa entra com a conta do Instagram, sem Página do Facebook
    - (B) API do Instagram com login do Facebook: entra pela conta do Facebook que administra a Página ligada
  - **O que muda depois:** (A) é mais simples para quem conecta e não depende de Página. (B) serve se a empresa já administra tudo pela Página e quer o mesmo token para o Messenger depois. O resto da sessão muda pouco: endereços da API e nomes das permissões.
  - **Recomendo:** (A).
- [ ] **8.2.2 Ligar a conta pelo login da Meta** `api`
  - **Hoje:** Não existe login OAuth no `apps/api`.
  - **O que fazer:**
    1. Rota `GET /canais/:id/instagram/autorizar`: redireciona ao login escolhido em 8.2, com um `state` aleatório guardado por 10 min (contra falsificação).
    2. Rota de volta `GET /canais/instagram/retorno`: troca o código pelo token, troca o token curto pelo de longa duração, guarda no cofre, lê o @ da conta e confere com o `identificadorExterno` do Canal (por `conferirNumeroConectado`, da Sessão 4, generalizada para identificador).
    3. Inscreve a conta nos webhooks de mensagens (campo `messages`) e grava `conexao_confirmada`.
    4. Rotina que renova o token de longa duração antes de vencer (cerca de 60 dias) e põe o Canal `com_erro` se a renovação falhar.
  - **Pronto quando:** Teste com `criarServidorFalso` no lugar da Meta: o retorno grava a credencial cifrada e o Canal fica `conectada`; um `state` desconhecido é recusado.
- [ ] **8.2.3 Botão de conectar na ficha do Canal** `web`
  - **Hoje:** Só o quadro reservado “Autorização da conta” com texto (`conectar-canal.ts:52-55`).
  - **O que fazer:**
    1. Na ficha do Canal `instagram-graph` (`[canal]/page.tsx`), o botão “Conectar” leva à rota de autorizar; na volta, a ficha mostra “Conectado como @conta”.
    2. Trocar os passos de `ORIENTACAO_DO_PROVEDOR` para `instagram-graph` pelos de 8.1.
  - **Pronto quando:** Você conecta a conta pela tela, sem ajuda.

### 8.3 Mensagens

**Objetivo:** Receber e responder o Direct. Hoje nada fala com o Instagram, a identidade do Contato não tem onde ficar e a regra da janela fala de um modelo que não existe lá.

**Pronto quando:** Uma mensagem direta chega no Contato certo e é respondida; fora das 24 h, a tela explica por que não dá para responder.

- [ ] **8.3.1 Como guardar a identidade do Contato no Instagram?** `decisão` `banco` `domínio` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** O webhook identifica quem mandou por um id próprio da conta conectada (IGSID), não pelo @, e o @ pode mudar. O tipo `instagram` de `plataforma.contato_identificadores` (007, linha 113) foi pensado para o @ digitado na ficha.
  - **Você decide:**
    - (A) Migração nova: mais um tipo de identificador, para o id do Instagram, com o @ em `valor_exibido`
    - (B) Guardar o id no tipo `instagram` mesmo, e o @ em `valor_exibido`
  - **O que muda depois:** (A) separa o @ digitado à mão do id do webhook, e o recebimento acha o Contato pelo id. Custa a migração que muda o `check` de tipos (meio dia). (B) não tem migração, mas mistura @ e id no mesmo campo, e a busca por @ quebra.
  - **Recomendo:** (A).
- [ ] **8.3.2 Receber pelo webhook** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Tratador `instagram-graph` na rota de webhook da Sessão 3: verificação por `GET` (`hub.challenge`) e assinatura `X-Hub-Signature-256` pela mesma função de `apps/api/src/provedores/meta/assinatura.ts` (criar aqui se a Sessão 7 ainda não criou).
    2. Achar o Canal pelo id da conta em `entry[].id`.
    3. Traduzir `messaging[].message` (texto, anexos de imagem, vídeo e áudio, `reply_to`), `messaging[].read` e as reações para o recebimento da Sessão 3. Mensagem com `is_echo` (mandada pela própria conta, inclusive pelo aplicativo) vira `enviada`, sem duplicar a que a plataforma mandou.
    4. Contato novo: buscar nome e @ pela API de perfil (`GET /{igsid}` com `fields=name,username`) e gravar o identificador decidido acima.
    5. No painel do app da Meta, cadastrar o endereço do webhook do Instagram e assinar o campo `messages`.
  - **Pronto quando:** Teste com um evento de exemplo: cria o Contato com o @ e o nome, e a Mensagem na Conversa do Canal.
- [ ] **8.3.3 Enviar** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Implementar `enviar` da interface de provedor em `apps/api/src/provedores/instagram/`: `POST /{ig-id}/messages` com `recipient.id` igual ao id do Contato e `message.text` ou `message.attachment`.
    2. Respeitar as mídias de `capacidadesDoCanal` (`sendableMediaTypes` do Instagram: imagem, vídeo e áudio).
    3. Ler a confirmação de leitura (`messaging[].read`) por `proximoStatusDeEntrega`.
  - **Pronto quando:** Uma resposta escrita na Caixa de Entrada chega no Direct e, quando lida, aparece como lida.
- [ ] **8.3.4 Corrigir a regra da janela do Instagram** `domínio` `web`
  - **Hoje:** As capacidades do `instagram` (`conversations.ts:38-40`) dizem `requiresTemplateOutsideWindow: true`; fora da janela, `validarEnvio` responde “Este Canal não tem Mensagem de modelo aprovada”, e o Instagram não tem modelo.
  - **O que fazer:**
    1. Trocar em `ChannelCapabilities` (`packages/dominio/src/types/crm.ts`) o booleano `requiresTemplateOutsideWindow` por um campo de três valores para “depois da janela”: `livre`, `so_modelo` (WhatsApp oficial) e `bloqueado` (Instagram).
    2. `validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) responde, no `bloqueado`: “Passaram 24 h desde a última mensagem do Contato: só ele pode reabrir a conversa.” O mesmo vale antes da primeira mensagem dele.
    3. A Caixa de Entrada (`conversation-thread.tsx:345-357`) desliga o campo com essa frase, sem seletor de modelo.
  - **Pronto quando:** Teste em `mensagens.test.ts`: Instagram fora da janela recusa com a frase nova; WhatsApp oficial continua pedindo modelo; não oficial e e-mail continuam livres.
  - **Atenção:** A Meta permite responder até 7 dias depois com a etiqueta `HUMAN_AGENT`, para atendimento humano, se o app tiver essa permissão. Fica fora desta sessão.

**A sessão fica pronta quando:** Uma mensagem mandada ao Direct da conta conectada aparece na Caixa de Entrada no Contato certo, com o @ e o nome; a resposta chega no Instagram; e depois de 24 h sem mensagem do Contato a tela explica que só ele pode reabrir a conversa.

---

## Sessão 9 · E-mail

Uma caixa de e-mail que a empresa já tem vira Canal: os e-mails que chegam viram Conversas na Caixa de Entrada, e a resposta sai pela mesma caixa, no mesmo fio, com assunto e cópias. Antes de tudo é preciso saber de que serviço são as caixas, porque o Microsoft 365 não aceita mais entrar por senha.

**Depende de:** Sessão 3.

> **Ajuste sugerido:** +1 dia, ou +2 se a decisão for login OAuth, que o Microsoft 365 exige.

**Ponto de partida:**
- O provedor `email-imap-smtp` existe (`packages/dominio/src/provedores-de-canal.ts:33`), e o Canal nasce com o endereço como identificador (`identificadorCanonico`, `packages/dominio/src/operations/canais.ts:88-91`).
- A 008 já tem em `plataforma.mensagens` as colunas `assunto`, `enderecos_adicionais` (para, cópia e cópia oculta) e `em_resposta_a_id` (linhas 148-150), e o tipo `EnderecoAdicional` existe (`packages/dominio/src/crm/mensagens.ts:67`).
- A Caixa de Entrada já mostra um campo de assunto quando o Canal tem `hasSubjectAndCopies` (`apps/web/src/features/crm/conversation-thread.tsx:1182-1190`), mas o envio não o leva: `NovaMensagem` (`mensagens.ts:103`) e o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40-47`, `strict`) não têm assunto nem endereços.
- As capacidades do `email` (`packages/dominio/src/operations/conversations.ts:73-87`): sem janela, com assunto e cópias, qualquer arquivo e vários por mensagem, corpo formatado.
- Da Sessão 3: interface de provedor, fila de entrada, porta de saída, mídia e CRM unificado. Da Sessão 4: `POST /canais/:id/conectar`.

### 9.1 Escolher como a caixa se conecta

**Objetivo:** Decidir o jeito de entrar na caixa. O resto da sessão depende disso, e o plano anterior supunha que IMAP com senha serve para qualquer caixa, o que não vale para o Microsoft 365.

**Pronto quando:** As caixas estão listadas e a decisão está tomada.

- [ ] **9.1.1 Dizer quais caixas e de que serviço** `você`
  - **Hoje:** Não se sabe que serviço de e-mail a empresa usa.
  - **O que fazer:**
    1. Listar as caixas que vão virar Canal (ex.: contato@, financeiro@).
    2. Dizer de que serviço é cada uma: Google Workspace (Gmail), Microsoft 365 (Outlook) ou outro (hospedagem com IMAP).
    3. Para Gmail: confirmar que a conta tem verificação em duas etapas e que o administrador do Workspace permite senha de app e IMAP.
  - **Pronto quando:** Lista anotada nesta tarefa.
- [ ] **9.1.2 IMAP/SMTP com senha, ou login do Google e da Microsoft?** `decisão` · *muda o produto*
  - **Como é hoje:** Não há nenhuma integração de e-mail. A Microsoft desligou o acesso IMAP por senha no Microsoft 365: lá só se entra com login OAuth (a conta autoriza o app, sem senha).
  - **Você decide:**
    - (A) IMAP/SMTP com senha ou senha de app: serve para Gmail com senha de app e para hospedagens comuns, não para Microsoft 365
    - (B) IMAP/SMTP com login OAuth do Google e da Microsoft: o mesmo protocolo, entrando pela conta em vez da senha
    - (C) APIs próprias de cada um (Gmail API e Microsoft Graph)
  - **O que muda depois:** (A) é o mais rápido e cabe nos 3 dias, mas deixa o Microsoft 365 de fora. (B) cobre os três casos e soma cerca de 1,5 dia (dois logins e renovação de token; o Google pode exigir verificação do app para o acesso ao e-mail). (C) dá aviso instantâneo de e-mail novo, mas é uma integração por serviço e exige valor novo em `provedor` (migração).
  - **Recomendo:** (A) se a lista de 9.1 não tiver Microsoft 365; (B) se tiver.

### 9.2 Conexão

**Objetivo:** Ligar uma caixa de e-mail pela ficha do Canal. Hoje a página só tem um texto reservado e nada testa servidor nenhum.

**Pronto quando:** Você conecta uma caixa pela tela, e uma senha errada é avisada na hora.

- [ ] **9.2.1 Guardar a credencial e testar a conexão** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. `POST /canais/:id/conectar` (Sessão 4) recebe, para `email-imap-smtp`: servidor, porta e segurança do IMAP e do SMTP, usuário e senha (ou o token do login, se a decisão for (B)).
    2. Testar antes de gravar: abrir a sessão IMAP (biblioteca `imapflow`) e listar a caixa de entrada; abrir a sessão SMTP (biblioteca `nodemailer`, função `verify`).
    3. Se os dois responderem, guardar a credencial no cofre e gravar `conexao_confirmada`; se não, devolver qual dos dois falhou e a frase do servidor, sem a senha.
  - **Pronto quando:** Teste com servidores IMAP e SMTP de teste: senha errada devolve “O servidor IMAP recusou o usuário ou a senha.” e nada é gravado; senha certa deixa o Canal `conectada`.
- [ ] **9.2.2 Formulário de conexão** `web`
  - **Hoje:** Só o quadro reservado “Servidores IMAP e SMTP” com texto (`apps/web/src/features/crm/conectar-canal.ts:64-67`).
  - **O que fazer:**
    1. Na ficha do Canal `email-imap-smtp` (`[canal]/page.tsx`), o botão “Conectar” abre o formulário de IMAP e SMTP.
    2. Preencher sozinho servidor e porta pelo domínio do endereço: Gmail (`imap.gmail.com` 993 e `smtp.gmail.com` 465) e Outlook (`outlook.office365.com` 993 e `smtp.office365.com` 587).
    3. A senha é campo de senha e nunca volta da api.
  - **Pronto quando:** Você conecta uma caixa pela tela, sem ajuda.

### 9.3 Receber

**Objetivo:** O e-mail que chega vira Conversa, e as respostas ficam no mesmo fio. Hoje nada lê caixa nenhuma, e o recebimento da Sessão 3 junta por Contato e Canal, sem olhar os cabeçalhos do e-mail.

**Pronto quando:** Um e-mail novo aparece na Caixa de Entrada em até 2 min, e uma troca de três e-mails fica numa Conversa só.

- [ ] **9.3.1 Guardar onde a leitura parou** `banco`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Migração nova com `plataforma.cursores_de_canal`: `workspace_id`, `canal_id`, `pasta`, `uidvalidity`, `ultimo_uid` e `atualizado_em`.
    2. Serve para ler só o que é novo e não repetir e-mail quando o processo reinicia.
  - **Pronto quando:** Migração aplicada em homologação.
- [ ] **9.3.2 Buscar os e-mails novos** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Leitor em `apps/api/src/provedores/email/leitor.ts`: uma sessão IMAP por Canal conectado, escutando a caixa de entrada (`IDLE`) e, como reserva, conferindo a cada 2 min.
    2. Para cada e-mail com UID maior que o do cursor: ler o MIME com a biblioteca `mailparser` e pôr na fila de entrada da Sessão 3 com `idExterno` igual ao `Message-ID`, o `assunto`, `remetenteExterno` igual ao endereço do `From` e os endereços de `To` e `Cc` em `enderecosAdicionais`; depois, avançar o cursor.
    3. Corpo: o texto puro vai para `conteudo`; o HTML vai para a mídia como anexo `text/html` e só aparece na tela depois de limpo (sem scripts e sem imagens remotas carregando sozinhas).
    4. Ignorar respostas automáticas (`Auto-Submitted`) e avisos de não entrega, para não abrir Conversa com o servidor.
    5. Ligado pela variável `EMAIL_LEITOR_ATIVO`, desligado no ambiente local, e iniciado em `apps/api/src/index.ts`.
  - **Pronto quando:** Mandar um e-mail para a caixa conectada faz a Conversa aparecer em até 2 min; reiniciar o `apps/api` não cria Mensagem repetida.
- [ ] **9.3.3 Juntar as respostas na mesma Conversa** `domínio`
  - **Hoje:** O recebimento da Sessão 3 acha a Conversa aberta do par Contato e Canal (`abertaDoPar`, `apps/api/src/repositorios/crm/conversas.ts:138`) e não olha cabeçalhos.
  - **O que fazer:**
    1. Função pura `mensagemRespondida(cabecalhos, buscarPorIdExterno)` em `packages/dominio/src/crm/mensagens.ts`: procura o `In-Reply-To` e, se não achar, cada id de `References`, do último para o primeiro, entre as Mensagens do Canal.
    2. Achou: a Mensagem nova vai para a Conversa daquela (reabrindo se estiver resolvida) e grava `em_resposta_a_id`. Não achou: segue a regra da Sessão 3 (Conversa aberta do par, ou nova).
    3. Assunto começando com “Re:” sem cabeçalho não junta sozinho, para não misturar e-mails de assuntos iguais por acaso.
  - **Pronto quando:** Teste em `mensagens.test.ts` com uma troca de três e-mails (enviado, resposta, resposta da resposta): os três ficam na mesma Conversa, cada um apontando para o anterior.

### 9.4 Enviar

**Objetivo:** A resposta sai pela caixa conectada, no mesmo fio, com assunto, cópias e anexos. Hoje o assunto digitado na tela não chega ao servidor e nada envia e-mail.

**Pronto quando:** A resposta aparece no Gmail do remetente na mesma conversa, e um PDF vai e volta.

- [ ] **9.4.1 Levar assunto e cópias no envio** `domínio` `api` `web`
  - **Hoje:** `NovaMensagem` (`packages/dominio/src/crm/mensagens.ts:103-108`) só tem `conversaId`, `direcao`, `conteudo` e `emRespostaAId`; o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40-47`) é `strict` e recusa qualquer campo a mais; o assunto digitado na tela (`conversation-thread.tsx:1182-1190`) não chega ao servidor.
  - **O que fazer:**
    1. Acrescentar `assunto` e `enderecosAdicionais` a `NovaMensagem` e ao esquema, aceitos só quando o Canal tem `hasSubjectAndCopies` (`validarNovaMensagem` recusa nos outros).
    2. Resposta sem assunto: usar “Re: ” mais o assunto da última recebida.
    3. O serviço `enviar` (`apps/api/src/servicos/crm/mensagens.ts:91`) grava as duas colunas.
    4. A tela manda os dois campos e ganha os campos de cópia e cópia oculta.
  - **Pronto quando:** Teste em `apps/api/src/servicos/crm/mensagens.test.ts`: uma Mensagem `enviada` num Canal de e-mail grava `assunto` e `enderecos_adicionais`; num Canal de WhatsApp, o assunto é recusado.
- [ ] **9.4.2 Enviar pelo SMTP mantendo o fio** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Implementar `enviar` da interface de provedor em `apps/api/src/provedores/email/`: `nodemailer` com a credencial do cofre; `From` igual ao endereço do Canal; `Message-ID` gerado por nós e gravado em `id_externo` antes de enviar; `In-Reply-To` e `References` com o `Message-ID` da Mensagem respondida e os anteriores do fio.
    2. Corpo em texto e em HTML simples (o texto da tela com as quebras de linha).
    3. Gravar uma cópia na pasta de enviados por IMAP (`APPEND`), para o e-mail aparecer em Enviados no programa de e-mail; a pasta é a que o servidor marca como de enviados.
  - **Pronto quando:** A resposta enviada pela Caixa de Entrada aparece no Gmail do remetente dentro da mesma conversa, e na pasta Enviados da caixa conectada.
  - **Atenção:** No Gmail, o envio por SMTP já guarda em Enviados: pular o `APPEND` quando o servidor for do Google, senão aparece duas vezes.
- [ ] **9.4.3 Anexos** `api`
  - **Hoje:** A mídia da Sessão 3 guarda e serve arquivos; o e-mail aceita qualquer tipo e vários por mensagem (`sendableMediaTypes` do `email`, `conversations.ts:85`).
  - **O que fazer:**
    1. Na entrada: cada anexo do MIME vira arquivo pela mídia da Sessão 3, com nome e tipo; as imagens embutidas no corpo (`cid:`) também.
    2. Na saída: os anexos da Mensagem vão como partes do e-mail, lidos do armazenamento.
    3. Recusar acima de 20 MB no total, com a frase “O e-mail passa de 20 MB: muitos servidores recusam.”
  - **Pronto quando:** Um PDF recebido abre na Conversa, e um PDF enviado chega ao remetente.
- [ ] **9.4.4 Validar com a caixa real** `você`
  - **O que fazer:**
    1. Conectar em homologação uma das caixas da lista de 9.1.
    2. Mandar de outro endereço um e-mail com anexo, responder pela Caixa de Entrada, responder de volta pelo programa de e-mail.
  - **Pronto quando:** Os três e-mails ficam numa Conversa só, o anexo abre, e a conversa aparece inteira no programa de e-mail do remetente.

**A sessão fica pronta quando:** Um e-mail mandado para a caixa conectada vira Conversa no Contato do remetente; a resposta escrita na Caixa de Entrada chega a ele com o mesmo assunto e aparece no mesmo fio no programa de e-mail dele; um anexo vai e volta; e a resposta seguinte dele cai na mesma Conversa.

---

## Sessão 10 · Canal Reunião: investigação

Na Lista conversacional entra um Canal novo, “Reunião”: o closer cria uma sala de vídeo e manda o link para o cliente entrar, e um gestor pode entrar na chamada sem que o closer nem o cliente vejam. Antes de implementar, dois dias para decidir a base: um serviço pronto, como o LiveKit, ou a conexão WebRTC feita do zero. O resultado define a Sessão 11.

**Depende de:** Sessão 5.

**Ponto de partida:**
- Os tipos de Canal são só `whatsapp`, `instagram` e `email` (`packages/dominio/src/provedores-de-canal.ts`), e o banco recusa outros (`canais_tipo_ck`, migração 008, linha 45).
- A Lista conversacional define os Canais por onde as conversas nascem (`canaisDeAtendimento`, em `List`, `packages/dominio/src/types/structure.ts`).
- Existe a tela da chamada do Closer (`apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx`), mas sem vídeo: o próprio arquivo diz que o protótipo não tem mídia nem servidor. A “Reunião” é uma Tarefa do Tipo Reunião ligada ao Negócio.

### 10.1 Testar as duas opções

**Objetivo:** Ver funcionando, com o caso real: closer e cliente na sala, e um gestor entrando sem aparecer.

**Pronto quando:** Uma página com o resultado de cada opção: o que funcionou, o custo e o esforço.

- [ ] **10.1.1 Testar o LiveKit** `infra` `api`
  - **Hoje:** Não existe nenhuma chamada de vídeo no produto.
  - **O que fazer:**
    1. Criar uma sala de teste no LiveKit Cloud (ou num LiveKit no nosso servidor, em Docker).
    2. Gerar um link de entrada para um convidado sem conta (o cliente), com um token de curta duração gerado pelo `apps/api`.
    3. Testar a entrada oculta: um terceiro participante que vê e ouve, não publica áudio nem vídeo e não aparece para os outros. Conferir na documentação do LiveKit a permissão de participante oculto.
    4. Testar no celular do cliente (navegador, sem instalar nada) e com rede ruim.
    5. Anotar o custo (LiveKit Cloud cobra por minuto de participante; o servidor próprio custa a máquina) e se a gravação é possível.
  - **Pronto quando:** Closer, cliente e um gestor oculto numa chamada de teste, com o resultado anotado.
- [ ] **10.1.2 Levantar o custo do WebRTC próprio** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Listar o que teria de ser construído: servidor de sinalização (quem entra, quem sai), servidores STUN e TURN (para atravessar redes de empresa e de celular) e um servidor que distribui o vídeo entre os participantes (SFU), porque com o gestor oculto já são três pessoas.
    2. Estimar o esforço de construir e o custo de manter cada peça, incluindo as quedas de conexão e a qualidade no celular.
  - **Pronto quando:** Estimativa em dias e em custo mensal, na mesma página.
- [ ] **10.1.3 Confirmar as regras de gravação e da entrada oculta** `você`
  - **Hoje:** Não há regra definida.
  - **O que fazer:**
    1. Definir se as chamadas são gravadas e se a gravação vai para a IA (transcrição, resumo).
    2. Confirmar com quem cuida de LGPD e do jurídico na Tria como fica a entrada oculta do gestor e a gravação: por exemplo, se o convite e a página da sala avisam que a chamada pode ser acompanhada e gravada.
  - **Pronto quando:** Regras escritas na página.
  - **Atenção:** A entrada sem aviso numa chamada com cliente pode ter implicação legal. Vale fechar isso antes de construir.

### 10.2 Decidir a base

**Objetivo:** Escolher a base com o resultado dos testes.

**Pronto quando:** Decisão tomada e a Sessão 11 reescrita com ela.

- [ ] **10.2.1 LiveKit ou WebRTC próprio?** `decisão` · *muda o produto*
  - **Como é hoje:** Nenhuma das duas existe no produto.
  - **Você decide:**
    - (A) LiveKit Cloud: o LiveKit hospeda as salas e cobra por uso
    - (B) LiveKit no nosso servidor: mesmo código, nós mantemos a máquina
    - (C) WebRTC próprio, feito do zero
  - **O que muda depois:** Define a base da Sessão 11. A duração e as tarefas da Sessão 11 saem desta investigação.
  - **Recomendo:** (A) para começar; (B) se o custo por minuto pesar.
- [ ] **10.2.2 Escrever a Sessão 11 com o resultado** `você`
  - **Hoje:** A Sessão 11 está no cronograma só como marcador de 1 dia, sem tarefas.
  - **O que fazer:** Com a decisão tomada, me mandar o resultado: eu escrevo as tarefas e as subtarefas da Sessão 11 e ajusto a duração e as datas.
  - **Pronto quando:** Sessão 11 com tarefas, subtarefas e duração.

**A sessão fica pronta quando:** A decisão “LiveKit ou WebRTC próprio” tomada, e a Sessão 11 escrita com as tarefas e a duração que saírem da investigação.

---

## Sessão 11 · Canal Reunião: implementação

A implementação do Canal Reunião na Lista conversacional. O que será feito, em quantos dias e com quais subtarefas depende do resultado da investigação (Sessão 10).

**Depende de:** Sessão 10.

> **Bloqueada:** Só começa depois da investigação (Sessão 10). O 1 dia é só um marcador no cronograma: a duração real e as subtarefas ainda não são conhecidas e saem da Sessão 10.

**Ponto de partida:**
- A tela da chamada do Closer existe sem vídeo (`apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx`).

### 11.1 A definir depois da investigação

**Objetivo:** As tarefas, as subtarefas e a duração desta sessão saem da Sessão 10. Quando a investigação terminar, você me manda o resultado e eu escrevo esta sessão.

**Pronto quando:** Sessão escrita com o resultado da investigação.

_Nenhuma subtarefa ainda._

**A sessão fica pronta quando:** A definir depois da investigação.

---

## Sessão 12 · Superadmin, usuários e permissões

Vem logo antes das sessões de IA, para que os Agentes já nasçam respeitando quem pode o quê. Hoje um convite cria o Membro `pendente`, mas não manda e-mail, e não existe operação que o torne `ativo`: o convidado recebe 403 ao entrar. Não dá para criar Papel nem Equipe pela tela, nem dar acesso a um Espaço, Pasta ou Lista depois de criado. Não há “esqueci a senha”. O servidor atende um Espaço só (`WORKSPACE_ID`). E todo Membro vê todos os módulos no menu, menos o Financeiro.

**Depende de:** Sessão 1.

> **Ajuste sugerido:** +2 dias se for só a Tria (convite real, Papéis e Equipes editáveis, módulos). Cerca de +4 se a plataforma atender várias empresas.

**Ponto de partida:**
- Tipos `Member`, `Role`, `Grant`, `Team` e `Workspace` em `packages/dominio/src/types/workspace.ts`; `Member.state` com `pendente`, `ativo`, `suspenso` e `removido` (linha 13).
- Operações em `packages/dominio/src/operations/members.ts`: `inviteMember` (`:420`), `alterarEmailDoConvite` (`:128`), `alterarPapelDoMembro` (`:173`), `removeMember` com sucessor (`:217`), `transferWorkspaceOwnership` (`:376`), `deleteRole` (`:572`) e `grantGovernanceAccess` (`:722`).
- Login real por e-mail e senha em `/entrar` (`apps/web/src/app/entrar/actions.ts`, `signInWithPassword`); `apps/web/src/proxy.ts` manda para `/entrar` quem não tem sessão.
- Telas: `/configuracoes/membros` convida e remove; `/configuracoes/membros/[membro]` muda o Papel e o e-mail do convite; `/configuracoes/papeis` só lista e exclui; `/configuracoes/equipes` só lista.
- O CRM novo recusa por Papel no servidor (`podeNoCrm`, `packages/dominio/src/crm/permissoes.ts:57`); o Financeiro recusa quem não alcança a Pasta (`apps/api/src/rotas/financeiro.ts`).

### 12.1 Definir o escopo

**Objetivo:** Cinco respostas mudam o tamanho da sessão: se haverá várias empresas, o que é o Superadmin, como os módulos são liberados, se a lista de permissões do Papel passa a valer e o que um Membro suspenso pode. Elas precisam sair no primeiro dia.

**Pronto quando:** As cinco decisões respondidas e anotadas no `CONTEXT.md` da fase.

- [ ] **12.1.1 A plataforma vai atender mais de uma empresa?** `decisão` · *muda o produto*
  - **Como é hoje:** Só a Tria, num Espaço fixo: `buildApp` lê `WORKSPACE_ID` (`apps/api/src/app.ts:101`) e o hook resolve o Membro sempre dentro dele (`plugins/autenticacao.ts:78`). As tabelas já têm `workspace_id`, e `plataforma.registros` também.
  - **Você decide:**
    - (A) Sim, em breve: cada cliente com o seu Espaço de Trabalho
    - (B) Não por agora: só a Tria
  - **O que muda depois:** (A) soma cerca de 2 dias: o servidor passa a descobrir o Espaço pelo usuário, as rotas públicas passam a achar o Espaço pelo segredo, e a tela ganha um seletor de Espaço. (B) mantém o Espaço fixo.
  - **Recomendo:** Responder pelo plano comercial. Se não houver cliente novo nos próximos 3 meses, (B).
- [ ] **12.1.2 O Superadmin fica acima das empresas?** `decisão` · *muda o produto*
  - **Como é hoje:** Ninguém fica acima do Espaço; o Proprietário é o topo. Um Espaço novo só nasce por script (`npm run bootstrap:gestao -w @n1/api`).
  - **Você decide:**
    - (A) Sim: o Superadmin é da plataforma, cria empresas e gere os usuários de todas
    - (B) Não: “Superadmin” é o Proprietário ou um Administrador do Espaço, com a tela de Membros completa
  - **O que muda depois:** (A) só faz sentido se a anterior for (A): soma uma tabela de Superadmins, uma área `/plataforma` e um registro de auditoria fora do Espaço (cerca de 1,5 dia). (B) não cria conceito novo.
  - **Recomendo:** Seguir a anterior: várias empresas → (A); só a Tria → (B).
- [ ] **12.1.3 Como os módulos são liberados?** `decisão` · *muda o produto*
  - **Como é hoje:** O menu tem seis assuntos (`ASSUNTOS`, `apps/web/src/features/shell/app-shell.tsx:116`): Trabalho, CRM, IA, Ferramentas, Painéis e Financeiro. Só o Financeiro some, para quem não alcança a Pasta (`app-shell.tsx:365`).
  - **Você decide:**
    - (A) Por Papel: cada Papel liga ou desliga cada um dos seis módulos, e os Papéis personalizados viram os perfis (Comercial, Financeiro, Gestão)
    - (B) Por Membro: seis chaves na ficha de cada pessoa
    - (C) Os dois: o Papel dá o padrão e a ficha do Membro só pode tirar
  - **O que muda depois:** (A) custa cerca de 1 dia e um caso novo vira um Papel novo. (B) custa o mesmo, mas a configuração fica espalhada pessoa a pessoa. (C) soma meio dia a (A).
  - **Recomendo:** (A).
- [ ] **12.1.4 A lista de permissões do Papel passa a valer?** `decisão` · *muda o produto*
  - **Como é hoje:** `Role.permissions` (`workspace.ts:62`) é lida em só dois lugares: o Convidado que comenta (`packages/dominio/src/derive.ts:971`) e o Convidado que muda só o Status (`packages/dominio/src/operations/tasks.ts:1233`), os dois usados pelo “Agente do pipeline” do Financeiro. Quem decide o resto é a base do Papel e o acesso ao Espaço, Pasta ou Lista.
  - **Você decide:**
    - (A) Ler a lista em todas as conferências (`taskWriteRefusal`, `containerAdminRefusal`, `podeNoCrm`)
    - (B) O Papel personalizado escolhe base e módulos; a lista fica só para os dois casos que já a usam, e a tela não a oferece
  - **O que muda depois:** (A) soma cerca de 3 dias e mexe em toda conferência do domínio. (B) não soma nada; um Papel personalizado restringe por módulo e por base, não ação a ação.
  - **Recomendo:** (B), e voltar ao assunto se surgir um caso que módulo e base não resolvem.
- [ ] **12.1.5 O que um Membro suspenso pode fazer?** `decisão` · *muda o produto*
  - **Como é hoje:** O código trata `suspenso` como “só consulta”: o hook deixa entrar (`plugins/autenticacao.ts:85`), `podeNoCrm` deixa ler e recusa escrever (`permissoes.ts:67` e `:71`), e a Sessão 1 barra a escrita em `POST /operacoes`. Mas não existe operação que suspenda alguém.
  - **Você decide:**
    - (A) Só consulta: entra, vê, não altera nada
    - (B) Sem acesso: não entra, como um removido, mas volta com o histórico ao ser reativado
  - **O que muda depois:** (A) só cria as operações de suspender e reativar. (B) também muda `plugins/autenticacao.ts:85` e `podeNoCrm` para recusar o suspenso, cerca de meio dia a mais.
  - **Recomendo:** (B): quem suspende alguém quase sempre quer cortar o acesso.

### 12.2 Modelo de dados

**Objetivo:** Guardar que módulos cada Papel libera e, se a 12.1 decidir por várias empresas, quem é Superadmin e em que Espaço cada usuário está. Hoje não existe conceito de módulo no domínio.

**Pronto quando:** Tipos e regras no domínio com testes; as tabelas novas, se houver, aplicadas em homologação.

- [ ] **12.2.1 Criar o tipo `Modulo` e a regra `membroAcessaModulo`** `domínio`
  - **Hoje:** Não existe. As chaves dos módulos só existem na tela (`Assunto.chave`, `app-shell.tsx:102`).
  - **O que fazer:**
    1. Em `packages/dominio/src/types/workspace.ts`: `export type Modulo = “trabalho” | “crm” | “ia” | “ferramentas” | “paineis” | “financeiro”` e o campo `Role.modulos?: readonly Modulo[]`; ausente quer dizer todos, o que mantém os Papéis de hoje como estão.
    2. Criar `packages/dominio/src/derive-modulos.ts` com `membroAcessaModulo(state, memberId, modulo)`: o Papel do Membro libera o módulo; para `financeiro`, o Membro também precisa alcançar a Pasta (`memberReachesContainer`, como `vePastaFinanceiro` faz hoje).
    3. A tela (`app-shell.tsx`) e a api passam a chamar essa função; ninguém repete a regra.
  - **Pronto quando:** Teste em `packages/dominio/src/derive-modulos.test.ts`: Papel com `modulos: [“trabalho”]` não acessa `crm`; Papel sem `modulos` acessa tudo; Papel com `financeiro`, sem alcance à Pasta, não acessa `financeiro`.
- [ ] **12.2.2 Criar as tabelas de Superadmin e de empresa** `banco`
  - **Hoje:** Não existem. Um usuário já pode ser Membro de mais de um Espaço, porque o Membro mora em `plataforma.registros` com `workspace_id` e `dados->>'userId'` (índice `registros_members_user_id_idx`, migração `002`).
  - **O que fazer:** Numa migração nova, depois da `009`: `plataforma.superadmins (user_id text primary key, criado_em, criado_por)`; o primeiro Superadmin entra por SQL à mão.
  - **Pronto quando:** Migração aplicada em homologação, com o primeiro Superadmin gravado.
  - **Atenção:** Só se a 12.1 escolher (A) nas duas primeiras decisões.
- [ ] **12.2.3 Tirar o Espaço fixo do servidor** `api` `web`
  - **Hoje:** `app.ts:101` lê `WORKSPACE_ID` e passa o valor ao hook de autenticação e às rotas públicas de Formulário e Tarefa. O CORS só aceita os cabeçalhos `authorization` e `content-type` (`app.ts:172`).
  - **O que fazer:**
    1. No hook (`plugins/autenticacao.ts`), ler o Espaço do cabeçalho `x-espaco`, conferir que o usuário é Membro dele (consulta em `plataforma.registros` por `colecao = 'members'` e `dados->>'userId'`) e, sem cabeçalho, usar o único Espaço do usuário ou responder 400 pedindo a escolha.
    2. Acrescentar `x-espaco` a `allowedHeaders` do CORS.
    3. As rotas públicas acham o Espaço pelo segredo do Formulário ou da Tarefa, não pela configuração.
    4. Na web, um seletor de Espaço no menu do usuário; `apps/web/src/dados/transporte.ts` passa a mandar `x-espaco`.
  - **Pronto quando:** Teste em `apps/api/src/plugins/autenticacao.test.ts`: um usuário Membro de dois Espaços recebe o Espaço certo pelo cabeçalho e 403 para um Espaço de que não é Membro.
  - **Atenção:** Só se a 12.1 decidir por várias empresas.

### 12.3 Ciclo de vida do usuário

**Objetivo:** Hoje “Convite enviado” (`apps/web/src/app/(shell)/configuracoes/membros/page.tsx:113`) não envia nada: `convidarMembro` (`apps/api/src/servicos/convidar-membro.ts`) só procura o e-mail no Supabase Auth e grava o Membro `pendente`. Não há operação de aceitar, e o hook responde 403 “Seu convite ainda não foi aceito.” (`plugins/autenticacao.ts:86-88`). Também não há “esqueci a senha”, troca de senha nem como suspender. Esta tarefa liga o convite de ponta a ponta e fecha esses buracos.

**Pronto quando:** Um convite feito pela tela chega por e-mail; a pessoa clica, cria a senha, informa o nome e cai no Início como Membro `ativo`; outra pessoa redefine a senha esquecida sozinha.

- [ ] **12.3.1 Configurar o envio de e-mail do Supabase Auth** `você` `infra`
  - **Hoje:** Não conferi o SMTP do projeto. O envio padrão do Supabase tem limite baixo de e-mails por hora e serve só para teste.
  - **O que fazer:**
    1. Em Authentication › Emails › SMTP Settings, configurar um SMTP próprio, com remetente do domínio da Tria.
    2. Nos modelos “Invite user” e “Reset password”, apontar o link para `{{ .SiteURL }}/entrar/confirmar?token_hash={{ .TokenHash }}&type=invite` e `…&type=recovery`.
    3. Em URL Configuration, pôr o endereço de produção da web como Site URL e os de homologação nas Redirect URLs.
  - **Pronto quando:** Um e-mail de teste enviado pelo painel chega na caixa de entrada, não no spam.
- [ ] **12.3.2 Enviar o convite por e-mail de verdade** `api`
  - **Hoje:** `convidarMembro` chama `resolverUsuarioPorEmail` (`apps/api/src/autenticacao/resolver-usuario.ts:31`), que procura o e-mail em `auth.admin.listUsers`, e depois `inviteMember` dentro de `executar`. Nenhum e-mail sai.
  - **O que fazer:**
    1. Em `convidarMembro`, quando o e-mail não tem usuário, chamar `clienteAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: <origem da web>/entrar/confirmar })` antes da transação e passar o `user.id` devolvido como `userId` para `inviteMember`.
    2. Se `inviteMember` recusar, apagar o usuário recém-criado com `auth.admin.deleteUser`.
    3. Quando o e-mail já tem usuário, não mandar convite: a pessoa entra com a senha que já tem e o aceite acontece no primeiro acesso (subtarefa seguinte).
    4. Criar a rota `POST /membros/:id/convite` (só Administrador ou Proprietário, Membro `pendente`) que reenvia o e-mail, e um botão “Reenviar convite” em `configuracoes/membros/[membro]/page.tsx`.
  - **Pronto quando:** Teste em `apps/api/src/servicos/convidar-membro.test.ts` com o cliente do Auth falso: convidar um e-mail novo chama `inviteUserByEmail` uma vez e grava o Membro com o `userId` devolvido; uma recusa do domínio apaga o usuário criado.
- [ ] **12.3.3 Aceitar o convite no primeiro acesso** `domínio` `api`
  - **Hoje:** Não existe operação de aceite; o comentário em `members.ts:515-518` diz que ela “não é operação desta fase”. O hook barra `pendente` em toda rota.
  - **O que fazer:**
    1. Criar `aceitarConvite(state, actingMemberId, { nome })` em `packages/dominio/src/operations/members.ts`: o Membro que chama precisa estar `pendente` e ter `userId`; passa a `ativo`, ganha `joinedAt`, perde `invitedIdentity`, e o `displayName` vira o nome informado; grava a Atividade “Convite aceito”.
    2. Criar a rota `POST /convites/aceitar` no `apps/api`, com `config: { aceitaPendente: true }`; no hook (`plugins/autenticacao.ts:85`), deixar passar o `pendente` só nas rotas com essa marca. A rota roda `executar` com `aceitarConvite`.
    3. Registrar a operação em `registro.ts` e o schema em `apps/api/src/rotas/esquemas/membros.ts`: `ESQUEMAS satisfies EsquemasCompletos` não compila sem ele.
  - **Pronto quando:** Teste em `apps/api` (Postgres local): com o token de um Membro pendente, `GET /estado` dá 403, `POST /convites/aceitar` dá 200, e o `GET /estado` seguinte dá 200 com o Membro `ativo`.
- [ ] **12.3.4 Criar as páginas de confirmar o link e de criar a senha** `web`
  - **Hoje:** Só existe `/entrar` (`apps/web/src/app/entrar/page.tsx` e `actions.ts`). As rotas públicas do `proxy.ts` são `/entrar` e `/sair` (`apps/web/src/proxy.ts:17`).
  - **O que fazer:**
    1. Criar `apps/web/src/app/entrar/confirmar/route.ts`: lê `token_hash` e `type`, chama `supabase.auth.verifyOtp` com o cliente do servidor (`@/autenticacao/cliente-servidor`) e redireciona para `/entrar/nova-senha?tipo=<type>`; link vencido leva a `/entrar` com a frase “Este link venceu. Peça outro a quem te convidou.”
    2. Criar `apps/web/src/app/entrar/nova-senha/page.tsx` com ação no servidor: nova senha (mínimo 8 caracteres) e confirmação, `supabase.auth.updateUser({ password })`; se `tipo=invite`, pede também o nome e chama `POST /convites/aceitar`; no fim, vai para `/`.
    3. Pôr `/entrar/confirmar` e `/entrar/esqueci` em `PUBLICAS` no `proxy.ts`.
  - **Pronto quando:** Em homologação, o fluxo vai do e-mail de convite até o Início sem erro, e o Membro aparece `ativo` em `/configuracoes/membros`.
  - **Atenção:** Antes de escrever, ler o guia de route handlers e de ações no servidor em `node_modules/next/dist/docs/` (`AGENTS.md`: este Next 16 tem mudanças).
- [ ] **12.3.5 Criar o “Esqueci a senha”** `web`
  - **Hoje:** A tela de entrar não tem o link; não existe página de redefinição.
  - **O que fazer:**
    1. Link “Esqueci a senha” em `entrar/page.tsx` para `/entrar/esqueci`.
    2. Página `apps/web/src/app/entrar/esqueci/page.tsx` com ação que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origem>/entrar/confirmar })` e responde sempre “Se o e-mail estiver cadastrado, enviamos um link.”, sem dizer se o e-mail existe (mesmo cuidado de `actions.ts`).
    3. O link do e-mail cai em `/entrar/nova-senha?tipo=recovery`, da subtarefa anterior.
  - **Pronto quando:** Em homologação, uma pessoa pede o link, troca a senha e entra com a senha nova; a senha antiga é recusada.
- [ ] **12.3.6 Trocar a senha em Minha conta** `web`
  - **Hoje:** `apps/web/src/app/(shell)/minha-conta/page.tsx` mostra o Membro e a Memória de Usuário; não mexe em senha.
  - **O que fazer:** Uma seção “Senha” com senha atual, nova e confirmação; a ação confere a atual com `signInWithPassword` no e-mail da sessão e grava a nova com `updateUser({ password })`.
  - **Pronto quando:** A senha nova vale no próximo login; com a senha atual errada, aparece “Senha atual incorreta.” e nada muda.
- [ ] **12.3.7 Suspender e reativar um Membro** `domínio` `api` `web`
  - **Hoje:** O estado `suspenso` existe (`workspace.ts:13`), mas nenhuma operação chega nele.
  - **O que fazer:**
    1. Criar `suspenderMembro(state, actingMemberId, memberId)` e `reativarMembro(…)` em `members.ts`: só Administrador ou Proprietário; não suspende o Proprietário (`workspace.ownerMemberId`) nem a si mesmo; `ativo` → `suspenso` e volta; Atividade em cada ato; o Membro continua nas Equipes (RN-ET-12 aceita `suspenso`).
    2. Registrar as duas em `registro.ts` e os schemas em `apps/api/src/rotas/esquemas/membros.ts`.
    3. Se a 12.1 escolher “sem acesso”, `plugins/autenticacao.ts:85` passa a recusar `suspenso` com “Seu acesso foi suspenso.” e `podeNoCrm` (`permissoes.ts:67`) deixa de aceitar leitura.
    4. Botões “Suspender” e “Reativar” em `configuracoes/membros/[membro]/page.tsx`.
  - **Pronto quando:** Testes no domínio (recusas e ida e volta) e um teste de rota: o Membro suspenso recebe a resposta que a 12.1 decidiu em `GET /estado` e 403 em `POST /operacoes`; reativado, volta a gravar.
- [ ] **12.3.8 Fechar o redirecionamento aberto do login** `web`
  - **Hoje:** `apps/web/src/app/entrar/actions.ts:29` aceita qualquer `para` que comece com `/` e não com `//`. Um `para` como `/\evil.com` passa, e o navegador lê a barra invertida como barra: depois do login, a pessoa vai para outro site.
  - **O que fazer:** Extrair a regra para `apps/web/src/autenticacao/destino-seguro.ts`: aceitar só caminho que comece com uma `/`, sem `//` nem `\`, e cuja `new URL(para, origem)` tenha a mesma origem; senão, `/`.
  - **Pronto quando:** Teste em `destino-seguro.test.ts`: `/crm` passa; `//evil.com`, `/\evil.com` e `https://evil.com` viram `/`.

### 12.4 Papéis, Equipes e acessos pela tela

**Objetivo:** Papéis personalizados, Equipes e Concessões só nascem por dados iniciais ou ao criar um contêiner (`state.grants.push` em `structure.ts:135`, `:241`, `:375`, `members.ts:337` e `:767`). A tela de Papéis só lista e exclui (`configuracoes/papeis/page.tsx`) e a de Equipes só lista (`configuracoes/equipes/page.tsx`). Administradores passam a criar e editar os três pela tela.

**Pronto quando:** Um Papel criado pela tela, sem o módulo CRM, tira o CRM do menu de quem o recebe; uma Equipe criada pela tela recebe acesso a uma Lista privada e os Membros dela passam a ver a Lista.

- [ ] **12.4.1 Criar e editar Papel personalizado** `domínio` `api`
  - **Hoje:** Só existe `deleteRole` (`members.ts:572`). Um Papel de sistema é imutável (`Role.system`, `workspace.ts:60`).
  - **O que fazer:**
    1. Criar `createRole(state, actingMemberId, { nome, base, modulos })` e `updateRole(state, actingMemberId, roleId, { nome?, modulos? })` em `members.ts`: só Administrador ou Proprietário; `base` entre `administrador`, `membro` e `convidado`, nunca `proprietario`; nome único no Espaço; Papel de sistema recusa edição; a base não muda depois de criada; Atividade em cada ato.
    2. Registrar as duas em `registro.ts` e os schemas em `apps/api/src/rotas/esquemas/membros.ts`.
  - **Pronto quando:** Testes no domínio: cria, edita nome e módulos, recusa nome repetido, base Proprietário e edição de Papel de sistema.
- [ ] **12.4.2 Criar e editar Equipe** `domínio` `api`
  - **Hoje:** Não há operação de Equipe; o tipo `Team` (`workspace.ts:75`) só nasce pelo seed.
  - **O que fazer:**
    1. Criar `createTeam`, `updateTeam` (nome e descrição), `addMemberToTeam`, `removeMemberFromTeam` e `deleteTeam` num arquivo novo `packages/dominio/src/operations/equipes.ts`: só Administrador ou Proprietário; só Membro `ativo` ou `suspenso` entra (RN-ET-12); `deleteTeam` recusa enquanto a Equipe tiver Concessões e diz quantas.
    2. Registrar e criar os schemas, como na subtarefa anterior.
  - **Pronto quando:** Testes no domínio de cada operação, incluindo a recusa de um Membro `removido` e de apagar Equipe com Concessão.
- [ ] **12.4.3 Conceder e revogar acesso a um Espaço, Pasta ou Lista** `domínio` `api`
  - **Hoje:** Uma Concessão só nasce ao criar o contêiner (`structure.ts`), ao transferir na sucessão (`members.ts:337`) ou no acesso de governança (`grantGovernanceAccess`, `members.ts:722`).
  - **O que fazer:**
    1. Criar `concederAcesso(state, actingMemberId, { subjectKind, subjectId, action, resourceType, resourceId })` e `revogarAcesso(state, actingMemberId, grantId)` em `packages/dominio/src/operations/acessos.ts`: quem chama precisa administrar o contêiner (`containerAdminRefusal`, `derive.ts:1053`); `subjectKind` entre `member`, `team` e `role`; `action` entre `ver`, `comentar`, `editar` e `administrar`; `scope: “subarvore”`, `origin: “concessaoDireta”`; Atividade em cada ato.
    2. `revogarAcesso` recusa tirar a última concessão `administrar` de um contêiner privado, que ficaria sem ninguém (B38a: privado sem concessão não existe para ninguém).
    3. Registrar e criar os schemas.
  - **Pronto quando:** Teste no domínio: conceder `ver` de uma Lista privada a uma Equipe faz `memberReachesContainer` ser verdadeiro para os Membros dela; revogar volta a falso.
- [ ] **12.4.4 Telas de Papéis, Equipes e acessos editáveis** `web`
  - **Hoje:** `configuracoes/papeis/page.tsx` (154 linhas) tem só “Excluir”; `configuracoes/equipes/page.tsx` (113 linhas) não tem botão; não há diálogo de acesso a contêiner (o `share-task-dialog.tsx` é do link público da Tarefa).
  - **O que fazer:**
    1. Em Papéis: botão “Novo Papel” e “Editar”, com diálogo de nome, base e as seis chaves de módulo.
    2. Em Equipes: “Nova Equipe”, “Editar” e a lista de Membros com adicionar e tirar.
    3. Criar `apps/web/src/features/estrutura/acessos-do-conteiner-dialog.tsx`, aberto pelo menu das páginas de Espaço, Pasta e Lista, que lista as Concessões e permite conceder e revogar.
  - **Pronto quando:** Pela tela, em homologação: criar um Papel, uma Equipe com dois Membros e dar à Equipe acesso a uma Lista privada; os dois Membros passam a ver a Lista depois de recarregar.
  - **Atenção:** A Sessão 2 limpa as páginas de Espaço, Pasta e Lista: combinar onde fica o botão de acessos.

### 12.5 Área de gestão de usuários

**Objetivo:** Ter um lugar onde quem gere usuários faz tudo: convidar, reenviar convite, mudar Papel, suspender, reativar e remover. Se a 12.1 decidir por Superadmin acima das empresas, essa área também cria empresas.

**Pronto quando:** Quem gere usuários faz o ciclo completo de uma pessoa (convite, aceite, Papel, suspensão, remoção) sem sair da área, e cada ato aparece em `/configuracoes/auditoria`.

- [ ] **12.5.1 Completar `/configuracoes/membros`** `web`
  - **Hoje:** A lista (`configuracoes/membros/page.tsx`, 526 linhas) convida e remove; a ficha (`membros/[membro]/page.tsx`, 403 linhas) muda Papel e e-mail do convite.
  - **O que fazer:** Filtro por estado (pendente, ativo, suspenso, removido); na ficha, os botões “Reenviar convite”, “Suspender” e “Reativar” (tarefa 12.3) e os módulos que o Papel libera, só para leitura.
  - **Pronto quando:** Pela tela, em homologação, uma pessoa passa por pendente, ativo, suspenso, ativo e removido.
- [ ] **12.5.2 Criar empresa com o primeiro Proprietário** `api` `web`
  - **Hoje:** Só por script: `npm run bootstrap:gestao -w @n1/api` (`apps/api/src/bootstrap/gestao.cli.ts`), que monta o Espaço “Gestão” do Financeiro.
  - **O que fazer:**
    1. Rota `POST /plataforma/espacos`, só para quem está em `plataforma.superadmins`: cria o Espaço com nome e o Proprietário por e-mail, que recebe o convite da 12.3.
    2. Tela `apps/web/src/app/(shell)/plataforma/page.tsx` com a lista de Espaços e o formulário.
  - **Pronto quando:** Uma empresa criada pela tela, e o Proprietário dela entra pelo convite.
  - **Atenção:** Só se a 12.1 decidir por várias empresas e por Superadmin da plataforma.
- [ ] **12.5.3 Registrar as ações de gestão de usuários** `domínio`
  - **Hoje:** `inviteMember` e `alterarPapelDoMembro` já gravam Atividade (`members.ts:530` e `:205`), e `/configuracoes/auditoria` existe.
  - **O que fazer:** Garantir que toda operação nova desta sessão (`aceitarConvite`, `suspenderMembro`, `reativarMembro`, `createRole`, `updateRole`, as de Equipe e as de acesso) grava Atividade com quem, quando, antes e depois.
  - **Pronto quando:** Teste no domínio para cada operação nova conferindo a Atividade gravada; as ações de teste aparecem em `/configuracoes/auditoria`.

### 12.6 Aplicar o acesso por módulo

**Objetivo:** Quem não tem o módulo não o vê no menu nem o usa por fora da tela. Hoje só o Financeiro é escondido (`app-shell.tsx:365`) e recusado (`rotas/financeiro.ts`); CRM, IA, Ferramentas e Painéis abrem para todos.

**Pronto quando:** Um Membro com Papel sem CRM não vê o assunto CRM, cai na página “sem acesso” ao abrir `/crm/contatos` e recebe 403 em `GET /contatos` e em `POST /operacoes/createDeal`.

- [ ] **12.6.1 Esconder no menu e nas páginas** `web`
  - **Hoje:** `app-shell.tsx:365` filtra só o Financeiro, por `vePastaFinanceiro`. As páginas abrem para qualquer Membro.
  - **O que fazer:**
    1. Trocar o filtro de `assuntosVisiveis` por `membroAcessaModulo(data, memberId, a.chave)`.
    2. No `AppShell`, quando o módulo da rota atual (`assuntoDe(pathname)`) não está liberado, mostrar um estado “Você não tem acesso a este módulo. Fale com quem administra o Espaço.” no lugar da página.
  - **Pronto quando:** Teste de componente em `apps/web`: com um Papel só de Trabalho, o trilho mostra só Trabalho, e a rota `/crm/contatos` mostra o estado sem acesso.
- [ ] **12.6.2 Recusar na api por módulo** `api` `domínio`
  - **Hoje:** As rotas do CRM conferem só a base do Papel (`exigir`, `servicos/crm/acesso.ts:39`); `POST /operacoes` não sabe a que módulo uma operação pertence.
  - **O que fazer:**
    1. Em `packages/dominio/src/operations/registro.ts`, um mapa `MODULO_DA_OPERACAO` com tipo `Record<NomeDeOperacao, Modulo>`, para que uma operação nova sem módulo não compile.
    2. Em `operacoes.ts`, antes do despacho, responder 403 quando `membroAcessaModulo` recusa o módulo da operação.
    3. Em `exigir`, conferir o módulo `crm` (a consulta `papelDoMembro`, `apps/api/src/repositorios/crm/membros.ts:20`, passa a devolver `modulos` do Papel).
    4. Em `rotas/financeiro.ts`, conferir o módulo `financeiro` junto com o alcance à Pasta.
    5. Em `visibilidadePara`, não mandar as coleções de módulo desligado: `contacts`, `companies`, `deals`, `conversations` e `channels` sem CRM; `agents`, `chatSessions`, `automations`, `documents` e `skills` sem IA; `grupos`, `comunidades`, `flows` e `linksDeCaptacao` sem Ferramentas; `panels` sem Painéis.
  - **Pronto quando:** Testes de rota: um Membro sem CRM recebe 403 em `GET /contatos` e em `POST /operacoes/createDeal`, e o `GET /estado` dele vem sem `contacts`; um Membro com CRM continua recebendo tudo.

**A sessão fica pronta quando:** Um Administrador convida um e-mail pela tela; a pessoa recebe o e-mail, cria a senha, entra e vê no menu só os módulos do Papel dela; chamar a rota de um módulo não liberado devolve 403; um Papel e uma Equipe criados pela tela mudam o que o Membro faz; quem esquece a senha a redefine sozinho.

---

## Reunião 1 de escopo da IA (realizada)

Realizada em 19/10. Abaixo, o que ficou decidido, o que cada decisão muda no plano e os pontos que merecem atenção. O que não foi decidido foi para o levantamento de escopo da IA (T2), com prazos.

**Realizada em 19/10/2026.**

**Ponto de partida:**
- Nenhuma IA de verdade estava ligada ao produto: as telas existiam, mas as respostas eram texto pronto ou não aconteciam.

**O vocabulário.** Pense num funcionário novo na empresa:

| Peça | O que é | Exemplo no CRM N1 |
|---|---|---|
| **Agente** | O funcionário virtual. Recebe poderes: Ferramentas, Conhecimento, Integrações, Plugins, Skills e as Automações que pode acionar. | Atendente comercial que responde leads no WhatsApp |
| **Ferramenta** | Uma ação que o Agente executa no sistema ou fora dele: ler e gravar registros, chamar um endereço HTTP. | Criar uma Tarefa; consultar uma conta no Omie |
| **Skill** | Um arquivo .md com as instruções de como fazer um trabalho. | qualificar-lead.md |
| **Conhecimento** | A biblioteca que o Agente consulta, buscada por significado num banco vetorial. | Tabela de preços, política de reembolso |
| **Automação** | Uma rotina escrita em código pelo time, que o Agente pode acionar. Não se cria pela tela. | A lista ainda vai ser definida por você |
| **Integração** | Uma conexão com um sistema de fora. Da empresa (todos usam a mesma) ou pessoal (cada um conecta a sua). | Omie (empresa); Google Agenda (pessoal); Miro |
| **Plugin** | Um pacote que junta Skills, Conhecimento e Automações e se instala num Agente de uma vez. | Plugin Financeiro: Skill de conferência, base do plano de contas e a Automação de lançamento |

### T.1 O que foi decidido

**Objetivo:** As seis decisões da reunião de 19/10, com o que cada uma muda no plano.

**Pronto quando:** Decisões registradas.

- [x] **T.1.1 O que é um Plugin** `decisão` · *decidida*
  - **Decidido:** Um pacote que junta Skills, Conhecimento e Automações e se instala num Agente de uma vez.
  - **O que muda no plano:** Plugin vira um tipo novo no domínio e uma tela própria, na Sessão 18. A aba atual “Plugins”, que só lista Ferramentas, passa a se chamar “Ferramentas”.
  - **Ponto de atenção:** Na sua nota, o Plugin não inclui Ferramentas nem Integrações. Um Plugin que dependa de uma Integração (por exemplo, um Plugin Financeiro que usa o Omie) só funciona onde ela estiver conectada.
- [x] **T.1.2 O que é uma Integração** `decisão` · *decidida*
  - **Decidido:** Uma conexão que o time escolhe colocar, em dois níveis: da empresa (todos usam a mesma, como o Omie) e pessoal (cada pessoa conecta a sua, como a Google Agenda). Começa com Omie, Google Agenda e Miro. Usar o Composio, se der.
  - **O que muda no plano:** Entra uma sessão nova, a Sessão 15 · Integrações. Hoje a Integração não tem dono (`Integration`, `packages/dominio/src/types/workspace.ts:182`) e conectar só troca o estado na tela; ela ganha o nível empresa ou pessoal e passa a conectar de verdade.
  - **Ponto de atenção:** O Composio tem Google Agenda e Miro e foi feito para conexões por usuário, mas não tem o Omie: a página do toolkit não existe. O Omie fica como Ferramenta nossa, chamando a API do Omie com a chave da empresa guardada no cofre da Sessão 1. Preço por chamada e onde os tokens dos usuários ficam guardados ainda precisam ser confirmados: as fontes que achei se contradizem. Por isso o levantamento de escopo da IA traz uma prova de conceito do Composio (T2.2).
- [x] **T.1.3 O que é o Conhecimento** `decisão` · *decidida*
  - **Decidido:** Banco vetorial padrão.
  - **O que muda no plano:** Confirma o `pgvector` no Postgres que já usamos, na Sessão 17. Falta escolher o modelo que gera os embeddings (decisão 17.4.1).
- [x] **T.1.4 O que é uma Automação** `decisão` · *decidida*
  - **Decidido:** Uma rotina escrita em código pelo time, sem botão de criar na tela. O Agente consegue acioná-la. A lista das Automações ainda vai ser definida.
  - **O que muda no plano:** A Sessão 18 troca o editor visual por um catálogo em código e deixa o Agente acionar as Automações. Saem as tarefas antigas de completar o editor: ramificar, acionar pela tela e consertar Notificar e Aguardar.
  - **Ponto de atenção:** Hoje existe um editor visual de 1.310 linhas, e as Automações do Financeiro rodam sozinhas, por evento e por horário. Ficaram em aberto duas perguntas: uma Automação também roda sozinha ou só quando um Agente chama? E o que acontece com as do Financeiro? A Sessão 18 fica bloqueada até a lista chegar.
- [x] **T.1.5 O que é uma Habilidade** `decisão` · *decidida*
  - **Decidido:** Uma Skill em arquivo .md.
  - **O que muda no plano:** A Habilidade de hoje (com versões, contratos de entrada e saída e requisitos de Ferramenta, `packages/dominio/src/types/ai.ts:58-84`) vira um texto `SKILL.md`: nome e descrição no cabeçalho e as instruções no corpo. É o mesmo formato dos Agent Skills do Claude. Entra na Sessão 14, e a aba “Habilidades” passa a se chamar “Skills”.
- [x] **T.1.6 O que um Agente pode receber** `decisão` · *decidida*
  - **Decidido:** Cinco poderes: Ferramenta, Base de conhecimento, Integração, Plugin e Skill. Avaliar se existe um framework para construir os Agentes.
  - **O que muda no plano:** O Construtor, na Sessão 14, passa a ter um passo para cada poder. A escolha do framework é o primeiro item do levantamento (T2.1), em 20/10.
  - **Ponto de atenção:** Dois pontos: falta decidir se uma Ferramenta nova se cria só no código ou também pela tela (por exemplo, uma chamada HTTP configurada com endereço e credencial), o que foi para o levantamento (T2.4). E as Automações também precisam entrar como poder, porque a sua nota diz que o Agente as aciona.

**A sessão fica pronta quando:** Realizada em 19/10. Seis decisões registradas.

---

## Levantamento de escopo da IA

Três dias de pesquisa, não de desenvolvimento. Você pesquisa cada ponto que ficou aberto na Reunião 1 e decide no dia marcado para ele. Cada item diz o que pesquisar, as opções, o que cada opção muda no plano e a minha recomendação. Quando decidir um item, me mande a resposta: eu registro no planejamento (o item vira “Decidida”) e ajusto as sessões que ele afeta.

**Depende de:** Reunião 1 de escopo da IA.

**De 20/10 a 22/10.** Cada item tem prazo. Quando decidir um item, mande a resposta: ela é registrada aqui e as sessões afetadas são ajustadas.

**Ponto de partida:**
- Seis decisões tomadas na Reunião 1 (19/10).
- 18 decisões em aberto e a lista de Automações, agrupadas por assunto abaixo.

### T2.1 Base da IA: framework e modelo

**Período:** 20/10 a 20/10

**Objetivo:** As duas escolhas que tudo o mais da IA usa. Precisam vir primeiro.

**Pronto quando:** Framework e modelo decididos.

- [ ] **T2.1.1 Qual framework usar para os Agentes?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 20/10 · destrava a Sessão 13
  - **Como é hoje:** Não há IA ligada ao produto.
  - **O que pesquisar:**
    1. Ler a documentação do Tool Runner do SDK da Anthropic (TypeScript), de Managed Agents e do Claude Agent SDK.
    2. Responder para cada um: o Agente roda no nosso servidor, com a permissão de quem pergunta? Dá para pedir aprovação antes de uma Ferramenta que grava? A resposta chega aos poucos na tela? Como se mede o custo?
    3. Opcional: uma prova de conceito no `apps/api`, com uma Ferramenta que lista as Tarefas do Membro. Posso fazer em paralelo enquanto você pesquisa os outros itens.
  - **Você decide:**
    - (A) SDK da Anthropic com o Tool Runner, rodando no nosso servidor
    - (B) Managed Agents: a Anthropic roda o Agente e um ambiente de arquivos para ele
    - (C) Claude Agent SDK: o Claude Code como biblioteca
  - **O que muda depois:** Define a base da Sessão 13 e de todas as sessões de IA depois dela.
  - **Recomendo:** (A). As Ferramentas são operações do nosso domínio e precisam rodar no nosso servidor, com a permissão do Membro. O Tool Runner dá o laço pronto e um ponto para pedir aprovação antes de executar. O mesmo SDK aceita servidores MCP, como o do Composio.
- [ ] **T2.1.2 Qual modelo de IA usar?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 20/10 · destrava a Sessão 13
  - **Como é hoje:** Os três modelos que aparecem no seletor do Chat são fictícios.
  - **O que pesquisar:**
    1. Ver a página de preços da Anthropic.
    2. No Console da Anthropic, fazer a mesma tarefa típica (por exemplo, resumir uma Conversa e sugerir a resposta) nos três modelos e comparar qualidade e tempo.
  - **Você decide:**
    - (A) Um só, o mais forte: Claude Opus 5.5 (US$ 4 por milhão de tokens de entrada e US$ 20 de saída)
    - (B) Dois: Claude Haiku 5.5 (US$ 0,10 e US$ 0,50) para respostas simples e Claude Opus 5.5 para tarefas complexas, com cada Agente escolhendo o seu
    - (C) Um só, intermediário: Claude Sonnet 5.5 (US$ 2 e US$ 10)
  - **O que muda depois:** A Sessão 13 liga o produto aos modelos escolhidos. Preços da tabela da Anthropic de outubro de 2026.
  - **Recomendo:** (B).

### T2.2 Integrações

**Período:** 20/10 a 20/10

**Objetivo:** Como as Integrações da empresa e as pessoais funcionam, e se o Composio serve.

**Pronto quando:** As três escolhas feitas.

- [ ] **T2.2.1 Usar o Composio para Google Agenda e Miro?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 20/10 · destrava a Sessão 15
  - **Como é hoje:** Nenhuma Integração conecta de verdade: conectar só troca o estado na tela.
  - **O que pesquisar:**
    1. Criar uma conta gratuita no Composio, conectar a sua Google Agenda e um quadro do Miro, e testar uma ação de cada (listar eventos, listar quadros).
    2. Anotar: o preço do plano que serve; onde ficam guardados os tokens das pessoas; se dá para rodar no nosso servidor; como uma conexão fica “da empresa” ou “de uma pessoa”.
    3. Conferir se a Google Agenda e o Miro têm servidor MCP oficial, que seria a alternativa sem o Composio.
    4. Lembrar: o Composio não tem o Omie.
  - **Você decide:**
    - (A) Composio para tudo o que ele tiver; o Omie e o que faltar viram Ferramentas nossas
    - (B) Integrações nossas para tudo, uma por uma
  - **O que muda depois:** Com (A), a Sessão 15 faz só a ponte com o Composio e as telas de conexão, e cada Integração nova do catálogo dele custa pouco; em troca, paga-se por chamada e depende-se de um serviço de fora. Com (B), cada Integração é código nosso, cerca de 1 a 2 dias por Integração.
  - **Recomendo:** (A), se o preço e o lugar onde os dados ficam forem aceitáveis.
- [ ] **T2.2.2 Onde a pessoa conecta as Integrações?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Prazo:** decidir até 20/10 · destrava a Sessão 15
  - **Para ver na tela:** Configurações › Integrações e IA › Personalizar › Integrações.
  - **Como é hoje:** Duas telas listam as mesmas Integrações: IA › Personalizar › Integrações e Configurações › Integrações.
  - **O que pesquisar:** Ver como o ClickUp, o HubSpot ou o Notion separam as integrações da empresa das pessoais.
  - **Você decide:**
    - (A) As da empresa em Configurações › Integrações (só administrador); as pessoais em Minha conta › Conexões (cada um a sua)
    - (B) Tudo numa tela só, com uma coluna “empresa / pessoal”
  - **O que muda depois:** Define as telas da Sessão 15. Nos dois casos, a aba de Integrações de IA › Personalizar sai do menu.
  - **Recomendo:** (A).
- [ ] **T2.2.3 Quando o Agente usa uma Integração pessoal, de quem é a conexão?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 20/10 · destrava a Sessão 15
  - **Como é hoje:** Ainda não existe conexão pessoal.
  - **O que pesquisar:** Pensar em três casos reais da Tria. Por exemplo: o Agente marca uma reunião, na agenda de quem? Cria uma nota no Miro, no quadro de quem?
  - **Você decide:**
    - (A) De quem está conversando com o Agente no Chat; num atendimento de cliente pela Caixa de Entrada, só as conexões da empresa
    - (B) Sempre a do dono do Agente
  - **O que muda depois:** Define a regra de permissão das Integrações nas Sessões 15 e 16. Com (B), um Agente compartilhado usaria a agenda do dono para todo mundo.
  - **Recomendo:** (A).

### T2.3 Custo, memória e telas do Chat

**Período:** 21/10 a 21/10

**Objetivo:** O que a Sessão 13 precisa saber para ligar a IA com segurança: quanto gastar, o que guardar e o que a pessoa vê.

**Pronto quando:** As três escolhas feitas, com os valores do teto.

- [ ] **T2.3.1 Quanto a IA pode gastar por mês?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 13
  - **Como é hoje:** Não há limite, porque não há IA ligada.
  - **O que pesquisar:**
    1. Estimar quantas conversas com IA a Tria terá por dia: no Chat interno e, mais tarde, no atendimento a clientes.
    2. Multiplicar pelo custo de uma resposta medido no teste do modelo (T2.1).
  - **Você decide:**
    - Teto mensal por empresa, por Agente ou os dois: diga o valor em reais
    - Ao chegar no teto: (A) só avisa; (B) pausa o Agente; (C) passa a pedir aprovação para tudo
  - **O que muda depois:** A Sessão 13 grava quanto cada resposta custou e confere o teto antes de chamar a IA.
  - **Recomendo:** Os dois tetos; aviso ao chegar em 80% e pausa em 100%.
- [ ] **T2.3.2 O que o Agente lembra de uma conversa para outra?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 14
  - **Como é hoje:** Existe um espaço de memória do Agente, mas nada grava nele. O histórico de cada trabalho do Agente fica guardado para sempre.
  - **O que pesquisar:**
    1. Listar o que vale o Agente lembrar (por exemplo, como o cliente prefere ser chamado, o que ele já comprou).
    2. Confirmar com quem cuida de LGPD na Tria por quanto tempo guardar o histórico.
  - **Você decide:**
    - Entre conversas: (A) o Agente guarda fatos úteis, e a pessoa pode ver e apagar; ou (B) cada conversa começa do zero
    - Histórico de cada trabalho do Agente: guardar por 90 dias, 1 ano ou para sempre
  - **O que muda depois:** Define a memória da Sessão 14 e a limpeza automática da Sessão 19.
  - **Recomendo:** (A), e guardar o histórico por 1 ano.
- [ ] **T2.3.3 O que a pessoa vê no Chat depois de mandar uma mensagem?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 13
  - **Para ver na tela:** IA › Chat: mande uma mensagem.
  - **Como é hoje:** A mensagem fica gravada e aparece um aviso de protótipo. Não há resposta.
  - **O que pesquisar:** Usar o Claude.ai, o ChatGPT e o Copilot numa tarefa com várias etapas e anotar o que cada um mostra enquanto trabalha e como pede confirmação antes de agir.
  - **Você decide:**
    - Enquanto o Agente trabalha, mostrar o que ele está fazendo (“consultando suas Tarefas…”)? Sim ou não
    - Quando ele precisa de licença, o botão Aprovar aparece na própria conversa? Ou só na fila de aprovações?
    - No fim, a conversa lista o que ele fez (Tarefa criada, mensagem enviada)? Sim ou não
  - **O que muda depois:** Define a tela do Chat da Sessão 13 e onde ficam as aprovações da Sessão 14.
  - **Recomendo:** Sim, na própria conversa, e sim.

### T2.4 Agentes e Ferramentas

**Período:** 21/10 a 21/10

**Objetivo:** Como nasce uma Ferramenta nova e como se cria um Agente.

**Pronto quando:** As duas escolhas feitas.

- [ ] **T2.4.1 Como nasce uma Ferramenta nova?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 14
  - **Como é hoje:** As Ferramentas são uma lista fixa no código (`TOOLS`, `packages/dominio/src/seed.ts:2596`), e nenhuma executa de verdade.
  - **O que pesquisar:**
    1. Listar as 10 primeiras Ferramentas que os Agentes da Tria vão precisar (por exemplo: criar Tarefa, consultar Contato, consultar conta no Omie, marcar reunião).
    2. Marcar em cada uma se ela é do nosso sistema ou de um sistema de fora (chamada HTTP).
  - **Você decide:**
    - (A) Só no código: o time escreve cada Ferramenta
    - (B) Também pela tela: um administrador configura uma Ferramenta de HTTP (endereço, método, credencial do cofre) ou de tabela (quais campos o Agente lê e grava)
    - (C) (A) agora e (B) depois
  - **O que muda depois:** (A) cabe na Sessão 14. (B) soma cerca de 3 dias e abre um risco: um Agente com acesso a qualquer endereço da internet.
  - **Recomendo:** (C).
- [ ] **T2.4.2 Quais são os passos para criar um Agente?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 14
  - **Para ver na tela:** IA › Agentes › Novo Agente.
  - **Como é hoje:** O Construtor pergunta nome, descrição, instruções e uma frase de abertura, e a prévia responde texto pronto.
  - **O que pesquisar:** Criar um agente em dois produtos (por exemplo, os GPTs do ChatGPT e os agentes do Copilot Studio) e anotar os passos de cada um.
  - **Você decide:**
    - (A) 1) o que ele faz; 2) como se comporta; 3) Ferramentas; 4) Conhecimento; 5) Integrações; 6) Plugins; 7) Skills; 8) Automações que pode acionar; 9) quanto age sozinho; 10) onde atende; 11) testar numa conversa de ensaio; 12) publicar
    - (B) Os passos com mudanças (diga quais)
  - **O que muda depois:** A Sessão 14 constrói o Construtor nesses passos, com uma IA que ajuda a preencher cada um.
  - **Recomendo:** (A).

### T2.5 O Agente atendendo clientes

**Período:** 21/10 a 21/10

**Objetivo:** Como o Agente pega uma Conversa de cliente, com quanta liberdade, e o que acontece quando ninguém aprova a tempo.

**Pronto quando:** As três escolhas feitas.

- [ ] **T2.5.1 Como o Agente pega uma Conversa de cliente?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 16
  - **Como é hoje:** O Construtor tem um campo “Onde atende” (Chat, WhatsApp, API, Webhook), mas nada usa esse campo.
  - **O que pesquisar:** Mapear como o atendimento da Tria funciona hoje: quem atende primeiro, quando a conversa passa para outra pessoa e por quê.
  - **Você decide:**
    - (A) Por Conversa: cada Canal tem um Agente padrão que recebe as Conversas novas, e uma pessoa pode clicar em “Assumir” a qualquer momento e depois devolver
    - (B) Por canal: o Agente atende tudo o que chega pelos canais marcados, sem uma pessoa poder assumir
  - **O que muda depois:** Com (A), a Sessão 16 cria o Agente padrão do Canal e o botão “Assumir”, e o campo “Onde atende” sai do Construtor.
  - **Recomendo:** (A).
- [ ] **T2.5.2 Com quanta liberdade o Agente começa a responder clientes?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 16
  - **Como é hoje:** Três níveis: assistido (pede licença para quase tudo), supervisionado (pede licença para mandar mensagem a cliente e para o que não dá para desfazer) e autônomo (não pede).
  - **O que pesquisar:** Escolher os dois primeiros Agentes que vão atender clientes e decidir, para cada um, o que ele pode responder sozinho.
  - **Você decide:**
    - (A) Supervisionado: a resposta fica como rascunho na Conversa e uma pessoa aprova com um clique
    - (B) Autônomo desde o início
  - **O que muda depois:** Define o modo que todo Agente novo recebe. Os dois modos são construídos na Sessão 16.
  - **Recomendo:** (A) nas primeiras semanas; depois, autônomo Agente por Agente.
- [ ] **T2.5.3 Onde a pessoa aprova, e o que acontece se ninguém aprovar a tempo?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 21/10 · destrava a Sessão 14
  - **Para ver na tela:** IA › Aprovações.
  - **Como é hoje:** Há dois tipos de aprovação na mesma tela (IA › Aprovações): o do Financeiro, que funciona e não tem prazo, e o do Agente, que ainda não existe de verdade e teria prazo de 72 h.
  - **O que pesquisar:** Definir quem vai aprovar as respostas do Agente e em quanto tempo essa pessoa consegue responder num dia normal.
  - **Você decide:**
    - Onde: (A) numa fila só, com atalho na barra do topo, ao lado de Minhas Tarefas; ou (B) cada tipo no seu lugar: pagamento no Financeiro e pedido do Agente dentro da própria Conversa
    - Quanto tempo o pedido do Agente espera numa Conversa com cliente: 72 h ou 4 h
    - Se ninguém aprovar a tempo: o Agente desiste, ou a Conversa passa para uma pessoa
  - **O que muda depois:** Define onde a Sessão 14 mostra os pedidos e o que a Sessão 16 faz quando um pedido vence.
  - **Recomendo:** (A), 4 h, e a Conversa passa para uma pessoa: um cliente não pode ficar três dias sem resposta.

### T2.6 Automações

**Período:** 22/10 a 22/10

**Objetivo:** Como as Automações em código convivem com o que já roda, e quais são.

**Pronto quando:** As duas escolhas feitas e a lista entregue.

- [ ] **T2.6.1 Uma Automação roda sozinha ou só quando um Agente chama?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 22/10 · destrava a Sessão 18
  - **Como é hoje:** As Automações do Financeiro rodam sozinhas: por evento (Tarefa criada, mudança de status) e por horário (vencimento).
  - **O que pesquisar:** Ver as Automações do Financeiro que rodam hoje (IA › Personalizar › Automação) e o que acontece no Contas a pagar se elas pararem.
  - **Você decide:**
    - (A) As duas coisas: roda sozinha quando tiver um gatilho no código, e um Agente também pode acioná-la
    - (B) Só quando um Agente chama
  - **O que muda depois:** (B) obriga a reescrever as Automações do Financeiro como algo que um Agente dispara, ou elas param de rodar.
  - **Recomendo:** (A).
- [ ] **T2.6.2 O que acontece com o editor e as Automações que já existem?** `decisão` · *muda o produto*
  - **Prazo:** decidir até 22/10 · destrava a Sessão 18
  - **Para ver na tela:** IA › Personalizar › Automação.
  - **Como é hoje:** Há um editor visual de Automações (`apps/web/src/features/ia/automacoes/editor-de-automacao.tsx`, 1.310 linhas), e as Automações do Financeiro rodam pelo motor do domínio.
  - **O que pesquisar:** Mesma consulta do item anterior: quais Automações existem e quem depende delas.
  - **Você decide:**
    - (A) O editor sai; as Automações que existem continuam rodando e aparecem numa lista só de leitura
    - (B) O editor sai, e as do Financeiro são reescritas como código no catálogo novo
  - **O que muda depois:** (A) cabe na Sessão 18. (B) soma cerca de 2 dias e exige cuidado para não parar o Financeiro.
  - **Recomendo:** (A) agora; (B) quando as Automações em código estiverem rodando.
- [ ] **T2.6.3 Entregar a lista das Automações** `você`
  - **Prazo:** até 22/10 · destrava a Sessão 18
  - **Hoje:** A lista ainda não existe.
  - **O que fazer:** Listar as Automações a implementar. Para cada uma: o que faz, quando roda (sozinha ou acionada por um Agente), quem pode acionar e quais dados usa.
  - **Pronto quando:** Lista entregue. A Sessão 18 só começa com ela.

### T2.7 Arrumação

**Período:** 22/10 a 22/10

**Objetivo:** Três escolhas de organização. Não pedem pesquisa: basta concordar ou não com a recomendação.

**Pronto quando:** As três escolhas feitas.

- [ ] **T2.7.1 Onde se define o que o Agente pode consultar?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Prazo:** decidir até 22/10 · destrava a Sessão 14
  - **Como é hoje:** No Construtor você marca as bases do Agente, mas é só um rótulo; o que vale de verdade é o acesso dado na Coleção.
  - **O que pesquisar:** Nenhuma: ler a situação e a recomendação.
  - **Você decide:**
    - (A) Vale o acesso da Coleção; o Construtor só mostra e edita esse acesso
    - (B) Vale o que o Construtor marca, e ele cria o acesso
  - **O que muda depois:** Nos dois casos sobra um lugar só. (A) mantém a regra de permissão onde ela já está.
  - **Recomendo:** (A).
- [ ] **T2.7.2 No Chat, a pessoa pode escolher uma Skill para a conversa?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Prazo:** decidir até 22/10 · destrava a Sessão 14
  - **Como é hoje:** Dá para escolher uma Habilidade no Chat, mas o sistema aceita qualquer uma se o pedido vier por fora da tela.
  - **O que pesquisar:** Nenhuma: ler a situação e a recomendação.
  - **Você decide:**
    - (A) Fica, só com as Skills que o Agente da conversa tem
    - (B) Sai: o Agente decide sozinho qual Skill usar
  - **O que muda depois:** (A) corrige a regra. (B) tira o botão. Meio dia, na Sessão 14.
  - **Recomendo:** (A).
- [ ] **T2.7.3 O que fazer com os “Agentes” do Financeiro que não usam IA?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Prazo:** decidir até 22/10 · destrava a Sessão 14
  - **Como é hoje:** O “Agente de lançamento” é uma rotina fixa que lança contas no Omie, e o “Agente do pipeline” é um usuário de serviço.
  - **O que pesquisar:** Nenhuma: ler a situação e a recomendação.
  - **Você decide:**
    - (A) Renomear para o que são: “Rotina de lançamento” e “Usuário de serviço”
    - (B) Transformar em Agentes de verdade, com IA
  - **O que muda depois:** (A) troca só textos, meio dia. (B) é um projeto à parte, com custo de IA a cada lançamento.
  - **Recomendo:** (A) agora; (B) depois, se fizer sentido.

### T2.8 Fechamento

**Período:** 22/10 a 22/10

**Objetivo:** Conferir, no fim do terceiro dia, que tudo foi decidido e registrado.

**Pronto quando:** Planejamento atualizado com todas as decisões.

- [ ] **T2.8.1 Atualizar o planejamento com as decisões** `você`
  - **Prazo:** até 22/10 · destrava a Sessão 13
  - **Hoje:** Cada decisão é registrada à medida que você me manda a resposta.
  - **O que fazer:**
    1. Conferir que nenhum item ficou sem resposta.
    2. Eu ajusto as Sessões 13 a 18 e as datas com o que foi decidido, e escrevo `docs/09-planejamento/ESCOPO-DA-IA.md` com todas as decisões da Reunião 1 e do levantamento.
    3. Você revisa e aprova.
  - **Pronto quando:** Nenhum item em aberto, e o documento de escopo aprovado.

**A sessão fica pronta quando:** Todos os itens decididos e registrados no planejamento até qui 22/10.

---

## Sessão 13 · IA: ligação com o modelo e Chat respondendo

A base de todas as sessões de IA. O `apps/api` passa a falar com o Claude por um único arquivo, grava tokens e custo de cada chamada e serve uma rota de streaming. O Chat deixa de ser protótipo: a pergunta vira uma Execução, e a resposta chega aos poucos e fica gravada como mensagem do assistente.

**Depende de:** Levantamento de escopo da IA.

> **Ajuste sugerido:** +1 dia: cliente do modelo, catálogo, teto de custo, rota com streaming, tela, ações da Sessão, anexos e os dois defeitos.

**Ponto de partida:**
- `sendChatMessage` (`packages/dominio/src/operations/ai.ts:955`) grava só a mensagem do usuário, com `fileIds: []`; a tela avisa que é protótipo (`apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:221`).
- `createChatSession` e `configureChatSession` (`ai.ts:675` e `:773`) já gravam Agente, Modelo, Habilidade, Âncora e pasta; sem Agente escolhido, responde o Assistente padrão (`workspace.defaultAgentId` = `agt_padrao`, também criado pelo bootstrap de produção).
- `AgentExecution` (`packages/dominio/src/types/ai.ts:256`) tem passos, custo (`ExecutionCost`, `:249`) e referências; hoje só o ensaio determinístico (`ensaiarAgente`, `operations/ia/agentes.ts:428`) cria Execuções.
- Os modelos são três fictícios (`MODELOS_DA_PLATAFORMA`, `seed.ts:2595`), copiados por Espaço em `plataforma.registros`.
- Toda gravação passa por `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`), uma transação com `statement_timeout` de 80% de 30 s: uma chamada ao modelo não cabe dentro dela.
- Dois defeitos achados: criar Agente pelo Construtor recebe 400, e “Permitir Ferramenta” não grava.

### 13.1 Ligação com o modelo

**Objetivo:** Não existe chamada a modelo em lugar nenhum. Aqui nasce o único ponto do `apps/api` que fala com o Claude, com streaming, contagem de tokens e teto de gasto, e o catálogo de modelos passa a ser o real.

**Pronto quando:** `npm run ia:conferir -w @n1/api` responde em homologação, e a linha da chamada aparece em `plataforma.consumo_de_ia` com tokens e custo.

- [ ] **13.1.1 Criar as chaves da Anthropic** `você`
  - **Hoje:** Não existe chave nem variável de IA em `apps/api/.env.example`.
  - **O que fazer:**
    1. No Console da Anthropic, criar um workspace para o CRM N1 com limite de gasto mensal.
    2. Criar uma chave para homologação e outra para produção.
    3. Pôr cada uma em `ANTHROPIC_API_KEY` no ambiente do `apps/api` correspondente.
  - **Pronto quando:** Em homologação, `npm run ia:conferir -w @n1/api` (subtarefa seguinte) responde “ok”.
  - **Atenção:** A chave fica no ambiente do servidor, não no cofre de credenciais da Sessão 1 (1.4), que guarda as credenciais dos Canais.
- [ ] **13.1.2 Criar o cliente do modelo no apps/api** `api`
  - **Hoje:** Não existe. `apps/api/package.json` não tem pacote de IA.
  - **O que fazer:**
    1. Instalar `@anthropic-ai/sdk` em `@n1/api` (`npm i @anthropic-ai/sdk -w @n1/api`).
    2. Criar `apps/api/src/ia/modelo/porta-do-modelo.ts`: a interface neutra `PortaDoModelo` com `responder(pedido, aoEvento, sinal)`. O pedido leva modelo, sistema, mensagens, ferramentas e `maxTokens`; a resposta devolve texto, chamadas de Ferramenta, uso (`entrada`, `saida`, `leituraDeCache`, `escritaDeCache`) e motivo de parada.
    3. Criar `apps/api/src/ia/modelo/cliente-anthropic.ts`, o único arquivo que importa o SDK. Usa `client.messages.stream(...)`, repassa cada trecho de texto a `aoEvento`, pega a resposta final com `finalMessage()` e lê `usage.input_tokens`, `output_tokens`, `cache_read_input_tokens` e `cache_creation_input_tokens`.
    4. Criar `apps/api/src/ia/modelo/modelo-falso.ts`, uma `PortaDoModelo` roteirizada para os testes, sem rede.
    5. Variáveis novas, lidas por `carregarEnv()` (`apps/api/src/persistencia/conexao.ts`) e documentadas em `apps/api/.env.example`: `ANTHROPIC_API_KEY`, `IA_ATIVA` (padrão `false`; desligada, as rotas de IA respondem 503 com motivo) e `IA_TEMPO_LIMITE_MS` (padrão 120000).
    6. Criar o comando `npm run ia:conferir -w @n1/api` (`apps/api/src/ia/conferir.cli.ts`), que faz uma pergunta curta e imprime tokens e custo.
  - **Pronto quando:** `apps/api/src/ia/modelo/cliente-anthropic.test.ts` faz uma pergunta real e recebe texto com `uso.entrada > 0`; o teste pula sem `ANTHROPIC_API_KEY`, como os testes de banco pulam sem `DATABASE_URL`.
  - **Atenção:** Usa o framework escolhido no levantamento (T2.1). Se houver prova de conceito, ela já deixa o esqueleto pronto.
- [ ] **13.1.3 Trocar o catálogo de modelos pelos reais** `domínio` `api`
  - **Hoje:** `MODELOS_DA_PLATAFORMA` (`packages/dominio/src/seed.ts:2595`) tem `mdl_base`, `mdl_rapido` e `mdl_legado`. O tipo `Model` (`types/ai.ts:18`) não tem provedor nem preço. A coleção `models` é copiada para cada Espaço (`packages/dominio/src/colecoes.ts:24`).
  - **O que fazer:**
    1. `Model` ganha `idNoProvedor` (por exemplo, `claude-opus-5-5`) e `preco` em US$ por milhão de tokens (`entrada`, `saida`, `leituraDeCache`, `escritaDeCache`).
    2. Reescrever `MODELOS_DA_PLATAFORMA` com os modelos escolhidos na T.4. Manter os ids `mdl_base` (forte) e `mdl_rapido` (rápido), para não mexer nas Versões e Sessões que já os referenciam; `mdl_legado` continua descontinuado.
    3. Criar `apps/api/src/bootstrap/modelos-de-ia.cli.ts` (`npm run ia:modelos -w @n1/api`, com `--seco`), que regrava a coleção `models` de cada Espaço existente.
  - **Pronto quando:** `select id, dados->>'idNoProvedor' from plataforma.registros where colecao = 'models'` devolve os modelos reais em homologação, e o seletor de Modelo do Chat mostra os nomes novos.
- [ ] **13.1.4 Gravar o consumo e aplicar o teto de gasto** `domínio` `banco` `api`
  - **Hoje:** `ExecutionCost` (`types/ai.ts:249`) só tem `modelUnits`, `toolCalls`, `childExecutions` e `durationMs`. `Agent.costLimit` (`types/ai.ts:344`) existe e nada o lê. O Espaço de Trabalho não tem cota.
  - **O que fazer:**
    1. No domínio, `ExecutionCost` ganha `tokens` (entrada, saída, leitura e escrita de cache) e `custoUsd`; uma função pura `custoDaChamada(modelo, uso)` em `packages/dominio/src/derive-ia.ts` calcula o valor pelo `preco` do Modelo.
    2. O Espaço de Trabalho ganha o teto mensal decidido na T.4 (`types/workspace.ts`).
    3. Migração nova: tabela `plataforma.consumo_de_ia` (workspace_id, id, origem, agente_id, execucao_id, conversa_id, modelo, tokens de entrada, saída e cache, custo_usd, criado_em). Toda chamada da `PortaDoModelo` grava uma linha, inclusive as que não são Execução (assistente do Construtor, 14.4).
    4. Antes de chamar o modelo, `apps/api/src/ia/teto.ts` soma o mês em `plataforma.consumo_de_ia` e compara com o teto do Espaço e o `costLimit` do Agente. Acima do teto, a Execução falha antes de consumir (regra RN-AGE-08); em 80%, grava um aviso ao Proprietário do Agente.
  - **Pronto quando:** Um teste em `apps/api` com teto de US$ 0,01 e o `modelo-falso` prova que a segunda pergunta falha com o motivo “Limite de custo atingido” sem chamar o modelo.

### 13.2 Chat respondendo

**Objetivo:** Hoje enviar no Chat grava a mensagem e nada responde. Aqui a mensagem abre uma Execução, o `apps/api` chama o modelo fora da transação, a resposta chega aos poucos por streaming e fica gravada como mensagem do assistente.

**Pronto quando:** Uma pergunta em `/ia/chat/<sessão>` recebe resposta aparecendo aos poucos, e depois de recarregar a resposta continua lá, com o link da Execução.

- [ ] **13.2.1 Criar as operações do turno do Chat no domínio** `domínio`
  - **Hoje:** Só existe `sendChatMessage` (`operations/ai.ts:955`). A verificação de disponibilidade existe (`disponibilidadeDoAgente`, `derive-ia.ts:221`) e a resolução do modelo também, mas é privada (`modeloResolvido`, `operations/ia/agentes.ts:388`).
  - **O que fazer:**
    1. Criar `packages/dominio/src/operations/ia/turno-do-chat.ts` com quatro funções puras.
    2. `abrirTurnoDoChat(state, memberId, sessionId, conteudo, fileIds)`: as mesmas recusas de `sendChatMessage`, mais Agente ativo (RN-AGE-10) e disponível (RN-AGE-08); grava a mensagem `usuario` e uma `AgentExecution` com origem `sessaoDeChat`, estado `executando`, delegante o Membro, `chatSessionId` e a Âncora.
    3. `montarContextoDoTurno(state, executionId)`: devolve sistema (instruções da Versão), mensagens (histórico da Sessão) e a `ContextComposition`, só com o que o Membro vê (RN-AGE-16; Âncora de Tarefa passa por `memberSeesTask`). Nada do formato da Anthropic: o domínio não conhece o provedor.
    4. `fecharTurnoDoChat(state, executionId, saida)`: grava a mensagem `assistente` com `executionId` e `complete: true`, o custo e a Execução `concluida`.
    5. `falharTurnoDoChat(state, executionId, motivo, textoParcial?)`: com texto parcial, grava `assistente` com `complete: false`; sem texto, uma mensagem `sistema` com o motivo (chat.md, seção do ciclo da Sessão).
    6. Exportar `modeloResolvido` de `agentes.ts` para as duas usarem a mesma regra.
    7. As quatro NÃO entram em `operations/registro.ts`: só o `apps/api` as chama, senão qualquer cliente poderia forjar uma resposta do assistente por `POST /operacoes/:nome`. Acrescentá-las à lista de proibidas do teste `registro.test.ts:39`.
  - **Pronto quando:** `turno-do-chat.test.ts` cobre: turno aberto e fechado, Agente pausado recusado, Âncora que o Membro não vê fora do contexto, texto parcial gravado como incompleto.
- [ ] **13.2.2 Criar a rota de streaming do Chat** `api`
  - **Hoje:** Não existe rota de IA. Nenhuma rota do `apps/api` usa `text/event-stream`.
  - **O que fazer:**
    1. Criar `apps/api/src/rotas/ia/chat.ts`, registrada em `apps/api/src/app.ts` junto das outras.
    2. `POST /ia/sessoes/:sessaoId/mensagens`, corpo validado por zod `{ conteudo, fileIds? }`, Membro sempre de `request.membro`.
    3. Passo 1: `executar()` com `abrirTurnoDoChat`; a transação fecha aqui.
    4. Passo 2: abrir a resposta com `reply.hijack()` e `reply.raw.writeHead(200, ...)`, copiando os cabeçalhos de CORS de `reply.getHeaders()` (com `hijack`, o `@fastify/cors` não escreve sozinho).
    5. Passo 3: conferir o teto (13.1), chamar `PortaDoModelo.responder` com um `AbortController` e mandar eventos SSE: `aceita` (`{ mensagemId, execucaoId }`), `texto` (`{ delta }`), `fim` (`{ mensagemId, custo }`) e `erro` (`{ erro }`). A Sessão 14 acrescenta `passo` e `aprovacao`.
    6. Passo 4: `executar()` com `fecharTurnoDoChat`, ou `falharTurnoDoChat` se o modelo falhar ou a pessoa fechar a conexão.
    7. Criar `apps/api/src/ia/reconciliar-turnos.ts`, chamado ao subir a API em `apps/api/src/index.ts`: Execuções `executando` mais velhas que `IA_TEMPO_LIMITE_MS` viram `falhou` com motivo “Interrompida”, para um processo derrubado no meio não deixar Sessão travada.
  - **Pronto quando:** `apps/api/src/rotas/ia/chat.test.ts`, com o `modelo-falso`, recebe `aceita`, dois `texto` e `fim`; depois, em `plataforma.registros`, a Sessão tem a mensagem `assistente` com `executionId` e a Execução está `concluida` com custo.
- [ ] **13.2.3 Mostrar a resposta chegando no Chat** `web`
  - **Hoje:** A tela da Sessão envia com `run(sendChatMessage)` (`ia/chat/[sessao]/page.tsx:163`), e a home do Chat também (`ia/chat/page.tsx:114`). A nota de protótipo está em `page.tsx:221` e no comentário do topo (linhas 10 a 13).
  - **O que fazer:**
    1. Criar `apps/web/src/dados/ia/chat-ao-vivo.ts` com `enviarNoChat(sessaoId, conteudo, aoEvento, sinal)`: `fetch` em `${NEXT_PUBLIC_API_URL}/ia/sessoes/:id/mensagens` com o token de `clienteDoNavegador().auth.getSession()` (o mesmo de `dados/sessao-provider.tsx:39`), lendo `response.body.getReader()` e separando os eventos SSE. `EventSource` não serve: não faz POST nem manda `Authorization`.
    2. As duas páginas trocam `run(sendChatMessage)` por `enviarNoChat`. Enquanto chega texto, um balão do assistente cresce na tela; no `fim`, chamar `verificarRevisao()` do store (`dados/store.ts`) para trazer a mensagem gravada.
    3. Botão “Parar” no compositor: aborta o `fetch`; o servidor grava o parcial como incompleto.
    4. Tirar a nota de protótipo (`page.tsx:221`) e o trecho do comentário que diz que não há Modelo.
  - **Pronto quando:** Em homologação, a resposta aparece palavra a palavra; recarregar a página mostra a mesma resposta; “Parar” deixa o balão marcado como incompleto.
- [ ] **13.2.4 Renomear, arquivar e compartilhar a Sessão** `domínio` `api` `web`
  - **Hoje:** Não existem operações para isso. O tipo já tem `title`, `titleEdited`, `lifecycle` e `sharedWithMemberIds`/`sharedWithTeamIds` (`types/ai.ts:403`).
  - **O que fazer:**
    1. Em `packages/dominio/src/operations/ai.ts`: `renomearSessaoDeChat`, `arquivarSessaoDeChat`, `desarquivarSessaoDeChat` (RN-CHT-06: escrever em arquivada exige desarquivar antes), `compartilharSessaoDeChat` e `revogarCompartilhamentoDaSessao`. Só o Proprietário (RN-CHT-07), com Registro de Atividade (RN-CHT-28).
    2. Registrar as cinco em `operations/registro.ts` e em `operations/index.ts`, e os esquemas em `apps/api/src/rotas/esquemas/ia.ts`.
    3. Na tela da Sessão, um menu no cabeçalho (`PageHeader`, ações) com as três ações.
  - **Pronto quando:** Testes de domínio para as cinco; pela tela, renomear muda o título na lista do Chat e arquivar deixa a Sessão só leitura.
  - **Atenção:** Compartilhar só é seguro depois que a Sessão 1 (1.1) parar de mandar as Sessões de Chat de todos pelo `GET /estado`.

### 13.3 Anexos e voz

**Objetivo:** O “+” do compositor mostra “Anexar arquivo” e “Anexar imagem” desligados, e o microfone também (P34 e P35). Aqui o anexo passa a ir junto para o modelo, e você decide o ditado.

**Pronto quando:** Uma pergunta sobre um PDF anexado é respondida com o conteúdo do PDF.

- [ ] **13.3.1 Anexar arquivo e imagem no Chat** `domínio` `api` `web`
  - **Hoje:** Os itens estão desligados com `SEM_ARQUIVOS` e `SEM_IMAGENS` (`apps/web/src/features/ia/compositor-do-chat.tsx:77-78`, usados em `:186-187`). `ChatMessage.fileIds` existe (`types/ai.ts:371`), mas `sendChatMessage` grava sempre `[]` (`ai.ts:975`) e recusa texto vazio. O envio de arquivo da Tarefa já existe: `POST /tarefas/:taskId/anexos/ticket` e `/confirmar` (`apps/api/src/rotas/anexos-da-tarefa.ts:96` e `:119`), sobre `apps/api/src/servicos/storage-uploads.ts`.
  - **O que fazer:**
    1. No domínio, `abrirTurnoDoChat` aceita `fileIds` e texto vazio quando há arquivo; quando o Modelo efetivo não lê o tipo (`Model.capabilities.inputs`), grava a mensagem `sistema` da regra RN-CHT-19.
    2. No `apps/api`, `POST /ia/sessoes/:sessaoId/anexos/ticket` e `/confirmar`, no mesmo molde dos anexos da Tarefa.
    3. Em `rotas/ia/chat.ts`, baixar cada arquivo do bucket e mandar ao modelo: PDF como bloco `document` em base64, imagem como bloco `image`.
    4. Na tela, ligar os dois itens do “+”, mostrar os arquivos como fichas no compositor e no balão.
  - **Pronto quando:** Em homologação, anexar um PDF de 3 páginas e perguntar “qual é o total da página 2?” recebe o valor certo.
- [ ] **13.3.2 Decidir o ditado no Chat** `decisão` · *muda o produto*
  - **Como é hoje:** O microfone está desligado com `SEM_VOZ` (`compositor-do-chat.tsx:79`, `:433`). A pendência P35 lembra que você pediu, em 2026-09-23, que o áudio não fosse guardado em lugar nenhum. O Claude não transcreve áudio.
  - **Você decide:**
    - (A) Ditado pelo navegador (Web Speech API): rápido, mas no Chrome o áudio vai para os servidores do Google
    - (B) Gravar e transcrever no servidor, com um serviço de transcrição contratado à parte
    - (C) Sem ditado por agora
  - **O que muda depois:** (A): um gancho `useDitado` no compositor, reaproveitando as mensagens de falha do microfone do Início; meio dia. (B): rota de upload de áudio, contrato com outro provedor e o áudio passando pelo servidor; 1 a 2 dias. (C): o botão sai do compositor.
  - **Recomendo:** (C) agora, para não contrariar o pedido de não mandar áudio para fora; (A) se você aceitar o Google.

### 13.4 Corrigir o que está quebrado

**Objetivo:** Dois defeitos da IA que existem hoje, sem modelo nenhum: criar Agente pelo Construtor volta 400, e permitir ou retirar uma Ferramenta mostra sucesso e não grava.

**Pronto quando:** Os dois corrigidos, cada um com teste.

- [ ] **13.4.1 Corrigir o 400 ao criar Agente pelo Construtor** `api`
  - **Hoje:** A tela chama `createAgent(data, id, entrada, { ativar })` (`apps/web/src/features/ia/agent-builder/agent-builder.tsx:131`), e o gravador manda dois argumentos: o rascunho e `{ ativar }`. O esquema aceita só um: `createAgent: z.tuple([AGENT_DRAFT])` (`apps/api/src/rotas/esquemas/construtor-de-agentes.ts:37`). Uma tupla do zod recusa elemento a mais, e `POST /operacoes/createAgent` responde 400. O teste `construtor-de-agentes.test.ts` (caso b) passa porque manda só `[rascunho]`.
  - **O que fazer:**
    1. Trocar para `createAgent: z.tuple([AGENT_DRAFT, opcional(z.object({ ativar: z.boolean().optional() }).strict())])`, com `opcional` de `./fragmentos`.
    2. No teste, acrescentar o caso `[rascunho, { ativar: true }]` e o caso `[rascunho, { ativar: true, lixo: 1 }]` (recusado).
  - **Pronto quando:** `construtor-de-agentes.test.ts` passa com os dois casos novos, e publicar um Agente novo pela tela, com e sem “Ativar”, cria o Agente sem erro.
- [ ] **13.4.2 Fazer “Permitir Ferramenta” e “Retirar” gravarem** `domínio` `api`
  - **Hoje:** `permitirFerramenta` e `retirarFerramenta` (`packages/dominio/src/operations/ia/agentes.ts:351` e `:355`) funcionam, mas não estão em `operations/registro.ts` (os imports de `ia/agentes` em `:332-342` e a lista em `:675-683` não as têm) nem em `operations/index.ts`. O gravador não as vê: a cópia local aceita, a tela mostra sucesso (`features/ia/agentes/permitir-ferramenta-dialog.tsx:65` e `agente-completo.tsx:186`) e nada vai ao servidor.
  - **O que fazer:**
    1. Acrescentar as duas a `registro.ts` (import e lista) e a `operations/index.ts` (`instrumentar`).
    2. Acrescentar `permitirFerramenta: z.tuple([ID, z.string()])` e `retirarFerramenta: z.tuple([ID, z.string()])` em `apps/api/src/rotas/esquemas/ia-agentes.ts` e ajustar o teste de cobertura dele (8 para 10 operações).
  - **Pronto quando:** `registro.test.ts` e `ia-agentes.test.ts` passam; pela tela, permitir uma Ferramenta e recarregar mostra a Ferramenta permitida e a Versão nova.

**A sessão fica pronta quando:** Com `IA_ATIVA=true` em homologação, uma pergunta em `/ia/chat/<sessão>` recebe a resposta do Claude aparecendo aos poucos; a mensagem `assistente` fica gravada com `executionId`, a Execução fica `concluida` com tokens e custo, e a chamada aparece em `plataforma.consumo_de_ia`. Criar Agente pelo Construtor funciona, e uma Ferramenta permitida continua permitida depois de recarregar.

---

## Sessão 14 · IA: Agentes e seus poderes

Os Agentes deixam de ser roteiro e passam a agir, com os poderes decididos em 19/10: Ferramentas, Conhecimento, Integrações, Plugins, Skills e as Automações que podem acionar. Tudo dentro da permissão de quem os aciona.

**Depende de:** Sessão 13.

> **Ajuste sugerido:** +2 dias: Skills em .md com leitura sob demanda, um passo do Construtor para cada poder, retomada depois da aprovação e expiração dos pedidos.

**Ponto de partida:**
- CRUD de Agente com Versões (`operations/agent-builder.ts`, `operations/ia/agentes.ts`), Concessões de Habilidade (`operations/ia/habilidades.ts:537`), autonomia e política de aprovação na Versão (`types/ai.ts:298`).
- Catálogo de Ferramentas com classe de efeito (`TOOLS`, `packages/dominio/src/seed.ts:2596`).
- O ensaio é determinístico: um passo por Ferramenta permitida, leitura `concluido` e escrita `simulado` (`ensaiarAgente`, `operations/ia/agentes.ts:485-512`).
- Aprovar um pedido de Agente marca a Execução `concluida` sem executar a Ferramenta (`decideApproval`, `operations/ai.ts:180`); nenhuma operação cria esse pedido; expirar só acontece no clique (`ai.ts:153`).
- Cancelar Execução e apagar Item de Memória já funcionam e estão ligados na ficha (`agentes.ts:548` e `:593`; `agente-completo.tsx:442` e `:704`).
- A rota de streaming e a `PortaDoModelo` existem desde a Sessão 13.

### 14.1 Ferramentas executando

**Objetivo:** As Ferramentas existem só no Catálogo; nenhuma executa. Aqui o modelo recebe as Ferramentas que o Agente pode usar, o `apps/api` executa cada chamada sobre o domínio com as duas verificações da regra DO-HAB-14 (a Ferramenta está permitida e o Sujeito pode mexer no registro) e cada uma vira um passo da Execução.

**Pronto quando:** No Chat, “crie uma Tarefa ‘Ligar para o João’ na Lista Comercial” cria a Tarefa, com o Agente como autor e o Membro como delegante.

- [ ] **14.1.1 Ligar as Ferramentas da Estrutura às operações do domínio** `domínio`
  - **Hoje:** Não existe ligação entre o id da Ferramenta e uma operação. As operações que existem: `createTask`, `addTaskComment`, `changeTaskStatus` (`operations/tasks.ts`); a leitura de Conhecimento só existe no ensaio (`referenciasDoEnsaio`, `agentes.ts:400`).
  - **O que fazer:**
    1. Criar `packages/dominio/src/operations/ia/ferramentas-do-agente.ts` com a tabela `EXECUTORES`: `ler_tarefa` (leitura), `criar_tarefa` → `createTask`, `criar_comentario` → `addTaskComment`, `alterar_status` → `changeTaskStatus`, `consultar_conhecimento` (primeiros Fragmentos das Coleções concedidas, até a Sessão 17) e `lembrar` (14.4).
    2. `executarFerramenta(state, executionId, toolId, entrada)` roda a operação como o Membro delegante e depois marca o registro criado com `createdBy` = o Agente e `createdByDelegate` = o Membro (`types/primitives.ts:67-69`); grava o passo `ferramenta` na Execução.
    3. As outras Ferramentas do Catálogo ficam fora da tabela; o Construtor as mostra como “ainda não executa”. As do CRM (`ler_contato`, `ler_negocio`, `ler_conversa`, `enviar_mensagem`, `sugerir_resposta`, `atualizar_qualificacao`, `atualizar_campos_contato`) entram na Sessão 16.
  - **Pronto quando:** `ferramentas-do-agente.test.ts`: `criar_tarefa` cria a Tarefa com o Agente como autor; Ferramenta fora da tabela devolve passo `falhou` com motivo.
  - **Atenção:** Se o levantamento escolher Ferramentas configuráveis pela tela (T2.4), entram aqui mais cerca de 3 dias: Ferramenta de HTTP (endereço, método, credencial do cofre) e de tabela (quais campos o Agente lê e grava).
- [ ] **14.1.2 Conferir a permissão de quem aciona** `domínio`
  - **Hoje:** Existem as peças, não a conta. Lado do Agente: `agentSeesTask` (`packages/dominio/src/derive.ts:1037`) e as concessões com `subjectKind` = 'agent'; o Agente nasce com o Papel Convidado (regra B76). Lado do Membro: `taskWriteRefusal` (`derive.ts:932`), `taskCommentRefusal` (`derive.ts:952`), `listWriteRefusal` (`operations/tasks.ts:1373`).
  - **O que fazer:**
    1. Criar `recusaDaFerramenta(state, execucao, toolId, alvo)` em `ferramentas-do-agente.ts`: a Ferramenta está em `allowedToolIds` da Versão da Execução e não foi tirada pela restrição da Sessão (`toolRestriction`); o Agente alcança o registro; e, havendo delegante Membro, o Membro também alcança (regra A9.3: a permissão efetiva é a interseção).
    2. `executarFerramenta` chama a recusa antes de rodar; recusado, o passo fica `negada`, com `toolAllowed` e `resourcePermitted` preenchidos.
    3. Função pura `exigeAprovacao(autonomia, classeDeEfeito)` com a tabela da regra RN-AGE-12: `assistido` pede para tudo que não é leitura; `supervisionado`, para `escritaIrreversivel` e `externa`; `autonomo`, nunca.
  - **Pronto quando:** Teste: um Agente acionado por um Convidado tenta `criar_tarefa` numa Lista que o Convidado não edita e o passo fica `negada`; a mesma chamada por um Membro com acesso cria a Tarefa.
- [ ] **14.1.3 Rodar o laço do Agente no apps/api** `api`
  - **Hoje:** A rota do Chat (13.2) faz uma chamada só, sem Ferramentas.
  - **O que fazer:**
    1. Criar `apps/api/src/ia/execucao/laco-do-agente.ts`: monta `tools` com as Ferramentas executáveis da Versão (nome = id da Ferramenta, descrição = `Tool.description`, esquema de entrada de `apps/api/src/ia/execucao/esquemas-das-ferramentas.ts`, em zod convertido por `z.toJSONSchema`, com `strict: true`) e `tool_choice` `auto`.
    2. Com `stop_reason` `tool_use`: validar cada entrada pelo zod; para cada chamada, um `executar()` curto com `executarFerramenta`; devolver todos os `tool_result` numa mensagem só, com `is_error` na recusa; repetir até `end_turn` ou até `IA_MAX_PASSOS` (variável nova, padrão 10).
    3. A rota do Chat passa a usar o laço e manda um evento `passo` por Ferramenta. Cada chamada também grava uma mensagem `ferramenta` na Sessão, que a tela já desenha (`ia/chat/[sessao]/page.tsx:305`).
  - **Pronto quando:** `laco-do-agente.test.ts`, com o `modelo-falso` roteirizado para chamar `ler_tarefa` e depois `criar_tarefa`, termina com dois passos `concluido` na Execução e a Tarefa em `plataforma.registros`; a tela `/ia/execucoes/<id>` mostra os dois.

### 14.2 Skills em arquivo .md

**Objetivo:** Na reunião de 19/10 ficou decidido que uma Habilidade é uma Skill em arquivo .md. A Habilidade de hoje, com contratos e requisitos, vira um texto `SKILL.md` que o Agente lê quando precisa.

**Pronto quando:** Você envia um `SKILL.md`, concede a um Agente, e o Agente segue as instruções dele no Chat.

- [ ] **14.2.1 Trocar a Habilidade por Skill em `.md`** `domínio`
  - **Hoje:** `Skill` e `SkillVersion` (`packages/dominio/src/types/ai.ts:58-84`) guardam instruções, contratos de entrada e saída, requisitos de Ferramenta e dependências, com rascunho e versões (`packages/dominio/src/operations/ia/habilidades.ts`).
  - **O que fazer:**
    1. A Skill passa a ser um texto `SKILL.md`: um cabeçalho com `name` e `description` e as instruções em Markdown no corpo.
    2. Mantém versões e a Concessão a Agente; saem contratos, requisitos e dependências.
    3. Migrar as Habilidades que existem: as instruções viram o corpo; o nome e a descrição viram o cabeçalho.
  - **Pronto quando:** Teste: uma Skill criada a partir de um `SKILL.md` volta igual ao ser lida.
- [ ] **14.2.2 Enviar e editar a Skill na tela** `web`
  - **Hoje:** A aba “Habilidades” (`/ia/personalizar/habilidades`) tem formulário com contratos e requisitos.
  - **O que fazer:**
    1. A aba passa a se chamar “Skills”.
    2. Botão para enviar um arquivo `.md` e um editor de texto para ajustar.
    3. Erro claro se faltar `name` ou `description` no cabeçalho.
  - **Pronto quando:** Você envia `qualificar-lead.md` e ele aparece na lista, pronto para conceder.
- [ ] **14.2.3 Usar as Skills do Agente na conversa** `api`
  - **Hoje:** As Habilidades nunca entram na conversa com o modelo.
  - **O que fazer:**
    1. No começo de cada conversa, o Agente recebe o nome e a descrição de todas as Skills dele.
    2. Quando precisa de uma, chama a Ferramenta `ler_skill` e recebe o corpo do `.md`, como nos Agent Skills do Claude. Assim uma Skill longa só ocupa a conversa quando é usada.
  - **Pronto quando:** Teste: o Agente com a Skill “Qualificar lead” lê a Skill e faz as perguntas dela.
- [ ] **14.2.4 Recusar Skill sem Concessão na Sessão** `domínio`
  - **Hoje:** `createChatSession` e `configureChatSession` aceitam qualquer Habilidade ativa (`operations/ai.ts:703` e `:808`); o `agt_padrao` não tem Concessão (P36).
  - **O que fazer:**
    1. Se a T.2 escolheu (A): as duas operações recusam com a frase de `motivoDeHabilidadeForaDoAgente` (`derive-ia.ts:135`); `seed.ts` e `bootstrap-gestao.ts` dão ao `agt_padrao` as Concessões das Habilidades da plataforma.
    2. Se escolheu (B): tirar `skillId` de `ChatSession` e o chip do compositor.
  - **Pronto quando:** Teste: escolher na Sessão uma Habilidade não concedida ao Agente é recusado.

### 14.3 Aprovações de Agente

**Objetivo:** Nenhuma operação cria pedido de aprovação de Agente, aprovar não executa nada e o prazo só vence quando alguém clica. Aqui o Agente para quando a autonomia exige, o pedido aparece onde a T.2 decidiu, e aprovar retoma a Execução de onde parou.

**Pronto quando:** Um Agente `assistido` para antes de criar a Tarefa; aprovado pela fila, a Tarefa é criada e a resposta continua no Chat; um pedido vencido expira sozinho.

- [ ] **14.3.1 Criar o pedido de aprovação quando a autonomia exige** `domínio` `banco`
  - **Hoje:** Só o seed tem pedido de Agente (`seed.ts:3067`). O tipo já tem o objeto fixo (Ferramenta, entrada, alvo, classe; `ApprovalRequest`, `types/ai.ts:146`) e a origem com prazo (`:104`).
  - **O que fazer:**
    1. Criar `solicitarAprovacaoDaFerramenta(state, executionId, toolId, entrada, alvo)` em `ferramentas-do-agente.ts`: o aprovador vem de `approvalPolicy` (regra RN-AGE-18), o prazo de `timeoutHours` ou do prazo decidido na T.2; a Execução fica `aguardandoAprovacao` e o passo `aguardando`. Fora do registro de operações.
    2. O laço (14.1) chama `exigeAprovacao` antes de cada escrita e, quando exige, para e grava o pedido.
    3. Migração nova: tabela `plataforma.continuacoes_de_execucao` (workspace_id, execucao_id, mensagens jsonb, criado_em) com a conversa exata com o modelo até a parada. Retomar precisa devolver ao modelo o mesmo conteúdo do assistente com o `tool_use` pendente; a Execução só guarda referências (regra DO-AGE-09). A linha é apagada quando a Execução termina.
  - **Pronto quando:** Teste em `apps/api`: Agente `assistido` pede `criar_tarefa`, a Execução fica `aguardandoAprovacao`, o pedido existe em `plataforma.registros` (coleção `approvals`) e a continuação em `plataforma.continuacoes_de_execucao`.
- [ ] **14.3.2 Retomar a Execução depois da decisão** `domínio` `api`
  - **Hoje:** `decideApproval` (`operations/ai.ts:118`), aprovado, empurra um passo `concluido` e marca a Execução `concluida` (`ai.ts:176-191`) sem rodar a Ferramenta. A fila chama a operação pelo `run` (`ia/aprovacoes/page.tsx:153`).
  - **O que fazer:**
    1. `decideApproval`, aprovado, passa a deixar a Execução `executando`, sem passo novo; recusado, devolve a decisão ao Agente (regra RN-AGE-17).
    2. Rota nova `POST /ia/aprovacoes/:id/decisao` em `apps/api/src/rotas/ia/aprovacoes.ts`, corpo `{ decisao, motivo? }`: `executar()` com `decideApproval`; se aprovado, `executarFerramenta` com o objeto exato do pedido, refazendo as duas verificações; depois o laço continua com o `tool_result`, a partir de `plataforma.continuacoes_de_execucao`, e a resposta vira mensagem `assistente` na Sessão.
    3. A fila (`ia/aprovacoes/page.tsx:153`) passa a chamar essa rota para pedidos de Agente; os de processo continuam como estão.
  - **Pronto quando:** Teste da rota: aprovar cria a Tarefa e a Execução termina `concluida` com o passo da Ferramenta; recusar termina `falhou` com o motivo; a Sessão tem a mensagem de resposta.
- [ ] **14.3.3 Expirar os pedidos vencidos sozinho** `domínio` `api`
  - **Hoje:** A expiração está dentro de `decideApproval` (`ai.ts:153-172`) e só roda quando alguém tenta decidir depois do prazo.
  - **O que fazer:**
    1. Extrair para `expirarAprovacoesVencidas(state, agora)` em `operations/ai.ts`, com ator Sistema e o mesmo Registro de Atividade.
    2. Criar o trabalhador `apps/api/src/ia/expirar-aprovacoes.ts`, ligado em `apps/api/src/index.ts`, rodando a cada `IA_EXPIRACAO_INTERVALO_MS` (padrão 300000).
  - **Pronto quando:** Teste: um pedido com prazo no passado vira `expirada` e a Execução `cancelada` sem ninguém clicar.
- [ ] **14.3.4 Mostrar os pedidos reais na fila e na conversa** `web`
  - **Hoje:** `/ia/aprovacoes` lista `state.approvals` (`aprovacoes/page.tsx:144`); na demonstração só aparece o do seed. A mensagem `ferramenta` do Chat mostra “aguardando aprovação” como texto (`ia/chat/[sessao]/page.tsx:61`).
  - **O que fazer:**
    1. Mostrar os pedidos de Agente no lugar decidido na T.2.
    2. Se a T.3 escolheu aprovar dentro da conversa: Aprovar e Recusar na mensagem `ferramenta` com `toolResult` `aguardandoAprovacao`, chamando a rota de decisão.
  - **Pronto quando:** Um pedido real aparece na fila e na conversa, e aprovar por qualquer um dos dois lugares retoma a Execução.

### 14.4 Construtor, ensaio e prévia

**Objetivo:** O assistente do Construtor é um roteiro de quatro perguntas, a prévia responde texto pronto, o ensaio inventa passos e a autonomia não tem campo. Aqui os três passam a usar o modelo, nos passos aprovados na T.3, e cancelar uma Execução para o modelo de verdade.

**Pronto quando:** Você cria um Agente pelo Construtor conversando com o assistente, escolhe a autonomia, testa na prévia com respostas reais e publica.

- [ ] **14.4.1 Um passo do Construtor para cada poder** `web` `domínio`
  - **Hoje:** O Construtor pergunta nome, descrição, instruções e uma frase de abertura (`apps/web/src/features/ia/agent-builder/build-assistant.ts`).
  - **O que fazer:**
    1. Montar o Construtor nos passos decididos no levantamento (T2.4).
    2. Um passo para cada poder: Ferramentas, Conhecimento, Integrações (Sessão 15), Plugins (Sessão 18), Skills e Automações (Sessão 18). Os passos de Integrações, Plugins e Automações aparecem quando essas sessões estiverem prontas.
  - **Pronto quando:** Você cria um Agente com uma Ferramenta, uma Coleção e uma Skill pelo Construtor, e a ficha mostra os três.
- [ ] **14.4.2 Fazer o ensaio chamar o modelo** `domínio` `api` `web`
  - **Hoje:** `ensaiarAgente` (`operations/ia/agentes.ts:428`) cria passos fixos (`:485-512`) sem modelo; o diálogo o chama pelo `run` (`features/ia/agentes/ensaiar-dialog.tsx:65`).
  - **O que fazer:**
    1. Separar de `ensaiarAgente` as verificações (Agente em rascunho ou ativo, instruções, modelo) numa função `abrirEnsaio`, fora do registro de operações; o laço fixo sai.
    2. Rota `POST /ia/agentes/:id/ensaio` (SSE), com o laço da 14.1 em modo ensaio: leituras rodam; escritas viram passo `simulado` sem chamar a operação; nada vai para a Memória (regra B82).
    3. `ensaiar-dialog.tsx` chama a rota e mostra a resposta chegando.
  - **Pronto quando:** Teste: um ensaio que pede `criar_tarefa` termina com o passo `simulado` e nenhuma Tarefa nova em `plataforma.registros`.
- [ ] **14.4.3 Pôr autonomia e aprovadores no Construtor** `domínio` `api` `web`
  - **Hoje:** `AgentDraft` (`operations/agent-builder.ts:19-29`) não tem autonomia; `conteudoDoRascunho` grava `assistido` e o próprio autor como aprovador (`agent-builder.ts:78-79`). `accessPoints` é obrigatório (`agent-builder.ts:50`).
  - **O que fazer:**
    1. `AgentDraft` e `AGENT_DRAFT` (`apps/api/src/rotas/esquemas/construtor-de-agentes.ts:15`) ganham `autonomy` (padrão da T.5) e `approverMemberIds`.
    2. Aplicar a T.2 (Conhecimento por Concessão) e a T.5 (`accessPoints` sai, se escolhida a opção A) no rascunho, no esquema e em `features/ia/agent-builder/agent-config-panel.tsx`.
    3. A ficha (`agente-completo.tsx:494`) passa a abrir o Construtor para trocar a autonomia, criando Versão nova.
  - **Pronto quando:** Testes do esquema e de `createAgent`; pela tela, um Agente publicado como `supervisionado` mostra esse nível na ficha.
- [ ] **14.4.4 Fazer o assistente do Construtor usar o modelo** `api` `web`
  - **Hoje:** O roteiro mora em `features/ia/agent-builder/build-assistant.ts` e é chamado em `agent-builder.tsx:187-203` (`construir`).
  - **O que fazer:**
    1. Rota `POST /ia/construtor/assistente`, corpo `{ rascunho, historico, mensagem }`: chama o modelo com saída estruturada (`output_config.format`) no formato `{ fala, alteracoes }`, onde `alteracoes` são campos do rascunho; não cria Execução, mas grava o consumo em `plataforma.consumo_de_ia` (13.1).
    2. `construir` aplica `alteracoes` com `alterar` e mostra `fala`; `build-assistant.ts` sai.
  - **Pronto quando:** Em homologação, “quero um Agente que responda dúvidas de preço no WhatsApp” preenche nome, descrição e instruções.
- [ ] **14.4.5 Decidir como a prévia funciona para um Agente ainda não salvo** `decisão` · *muda o produto*
  - **Como é hoje:** A prévia (`agent-builder.tsx:158-171`) roda antes de o Agente existir. A regra B82 diz que o ensaio é uma Execução gravada, e uma Execução precisa de `agentId`.
  - **Você decide:**
    - (A) A primeira prévia salva o Agente em rascunho e roda um ensaio de verdade
    - (B) A prévia chama o modelo com o rascunho sem gravar Execução; só o consumo fica registrado
  - **O que muda depois:** (A): a prévia usa a rota de ensaio, com passos e custo na ficha; aparecem Agentes em rascunho que ninguém publicou. (B): uma rota a mais, `POST /ia/construtor/previa`, e a prévia não mostra passos.
  - **Recomendo:** (A): uma regra só para testar Agente.
- [ ] **14.4.6 Fazer cancelar parar o modelo** `api`
  - **Hoje:** `cancelarExecucao` (`agentes.ts:548`) já grava e está ligada na ficha (`agente-completo.tsx:442`), mas só muda o registro: o modelo continuaria respondendo.
  - **O que fazer:**
    1. Criar `apps/api/src/ia/execucao/em-curso.ts`, um mapa `executionId → AbortController`, preenchido pelo laço.
    2. Em `apps/api/src/rotas/operacoes.ts`, depois de confirmar `cancelarExecucao`, abortar o controlador da Execução.
    3. O laço relê o estado da Execução antes de cada Ferramenta, para o caso de outro processo da API ter cancelado.
  - **Pronto quando:** Teste: cancelar durante uma resposta do `modelo-falso` interrompe o streaming e nenhuma Ferramenta posterior roda.
- [ ] **14.4.7 Fazer a Ferramenta “lembrar” gravar na Memória** `domínio`
  - **Hoje:** Nenhuma operação cria `AgentMemoryItem` (`types/ai.ts:285`); apagar já funciona (`agentes.ts:593`).
  - **O que fazer:**
    1. Se a T.4 escolheu (A): o executor de `lembrar` grava o Item com `executionId` e `originDelegateMemberId`, só com `memoryEnabled` e fora de ensaio (regra RN-AGE-22).
    2. `montarContextoDoTurno` inclui os Itens de mesmo delegante (DO-AGE-07) e grava os ids em `memoryItemIds`.
  - **Pronto quando:** Teste: “me chame de Zé” numa Sessão aparece no contexto de outra Sessão do mesmo Membro e não na de outro Membro.

**A sessão fica pronta quando:** No Chat, um Agente `supervisionado` lê uma Tarefa e cria outra a pedido; ao tentar uma escrita que exige aprovação, para, o pedido aparece na fila e na própria conversa, e depois de aprovado a Ferramenta roda e a resposta continua. Os passos reais aparecem em `/ia/execucoes/<id>`.

---

## Sessão 15 · IA: Integrações da empresa e pessoais

As Integrações passam a conectar de verdade, em dois níveis: da empresa (todos usam a mesma, como o Omie) e pessoal (cada pessoa conecta a sua, como a Google Agenda). Começa com Omie, Google Agenda e Miro. Esta sessão supõe as escolhas recomendadas no levantamento (T2.2: Composio para o que ele tiver); se a escolha for outra, as tarefas 15.2 e 15.5 mudam.

**Depende de:** Sessão 1, Sessão 14.

> **Ajuste sugerido:** +1 dia: além da ponte com o Composio, cada Integração (Omie, Google Agenda, Miro) precisa de teste com conta real.

**Ponto de partida:**
- `Integration` (`packages/dominio/src/types/workspace.ts:182`) tem estado, quem configurou e Ferramentas expostas, mas não tem dono nem nível.
- `conectarIntegracao` e `desconectarIntegracao` (`packages/dominio/src/operations/ia/integracoes.ts:89` e `:125`) só trocam o estado: nenhuma conexão real.
- O lançamento no Omie acontece no serviço externo `automation/`, chamado pela ponte `apps/api/src/automacoes/invocar-agente.ts`; a Integração guarda só o rótulo da conta (`contaRotulo`).
- O cofre de credenciais da Sessão 1 guarda segredos cifrados.

### 15.1 Conexões da empresa e pessoais no domínio

**Objetivo:** Hoje uma Integração não tem dono: não dá para ter a Google Agenda de cada pessoa. Ela passa a ter nível (empresa ou pessoal) e, no pessoal, um dono.

**Pronto quando:** Testes do domínio provam que um Membro não vê nem usa a conexão pessoal de outro.

- [ ] **15.1.1 Dar nível e dono à conexão** `domínio`
  - **Hoje:** `Integration` (`packages/dominio/src/types/workspace.ts:182`) não tem dono, e a ontologia diz que Integração não tem Proprietário (regra B35).
  - **O que fazer:**
    1. Criar o tipo `Conexao` no domínio: a Integração (Omie, Google Agenda, Miro), o nível (`empresa` ou `pessoal`), o Membro dono quando é pessoal, o estado (conectada, desconectada, com erro) e a referência à credencial no cofre.
    2. Regras: só administrador conecta e desconecta a da empresa; só o próprio Membro mexe na pessoal; ninguém lê a credencial.
    3. Registrar em Atividade quem conectou e desconectou, sem a credencial.
  - **Pronto quando:** Testes do domínio para as três regras.
- [ ] **15.1.2 Criar a tabela de conexões** `banco`
  - **Hoje:** Não existe.
  - **O que fazer:** Migração nova com `plataforma.conexoes`: `id`, `workspace_id`, `integracao`, `nivel`, `membro_id` (vazio quando é da empresa), `estado`, `credencial_id` (no cofre) ou o id da conta conectada no Composio, `conectado_em` e `conectado_por`.
  - **Pronto quando:** Migração aplicada em homologação.
- [ ] **15.1.3 Escolher a conexão certa quando o Agente usa uma Integração** `domínio`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. No Chat, usar a conexão pessoal de quem está conversando; na falta dela, a da empresa.
    2. Num atendimento de cliente (Caixa de Entrada, Sessão 16), usar só as conexões da empresa.
    3. Seguir a regra que o levantamento escolher (T2.2), se for diferente.
  - **Pronto quando:** Teste: o mesmo Agente, perguntado por dois Membros, lê a agenda de cada um.

### 15.2 Ponte com o Composio

**Objetivo:** Usar o Composio para as Integrações que ele tem, em vez de escrever o login e as chamadas de cada sistema.

**Pronto quando:** Uma conexão pessoal e uma da empresa feitas pelo Composio, usadas pelo Agente.

- [ ] **15.2.1 Criar a ponte com o Composio** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Criar `apps/api/src/integracoes/composio.ts`, o único arquivo que fala com o Composio, com a chave no ambiente (`COMPOSIO_API_KEY`).
    2. Usar como “usuário” do Composio o id do Membro, para as conexões pessoais, e o id do Espaço de Trabalho, para as da empresa.
  - **Pronto quando:** Teste de integração contra a conta de homologação do Composio.
- [ ] **15.2.2 Conectar pela tela** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Rota `POST /conexoes/:integracao/iniciar`: pede ao Composio o link de autorização e devolve para a tela abrir.
    2. Rota `POST /conexoes/:id/confirmar`: na volta, grava a conexão como conectada.
    3. Rota `DELETE /conexoes/:id`: desconecta no Composio e aqui.
  - **Pronto quando:** Conectar e desconectar a Google Agenda de um usuário de teste pela tela.
- [ ] **15.2.3 Oferecer ao Agente as ações da conexão certa** `api`
  - **Hoje:** As Ferramentas de Integração existem só no catálogo, sem executar.
  - **O que fazer:** Ao montar a conversa do Agente, pedir ao Composio as ações das Integrações que o Agente tem como poder, usando a conexão escolhida pela regra da 15.1, pelo servidor MCP do Composio ou pelo SDK dele (o que a prova de conceito indicar).
  - **Pronto quando:** No Chat, o Agente lista os próximos eventos da Google Agenda de quem pergunta.

### 15.3 Telas de conexão

**Objetivo:** Cada pessoa conecta as suas Integrações, e o administrador conecta as da empresa.

**Pronto quando:** As duas telas funcionando e a aba antiga fora do menu.

- [ ] **15.3.1 Integrações da empresa em Configurações** `web`
  - **Hoje:** `/configuracoes/integracoes` é só leitura (contas do Omie por Empresa) e `/ia/personalizar/conectores` repete a lista.
  - **O que fazer:**
    1. `/configuracoes/integracoes` lista as Integrações da empresa com Conectar e Desconectar, só para administrador.
    2. Tirar a aba Integrações de IA › Personalizar (`apps/web/src/features/ia/personalizar/secoes.ts:17`).
  - **Pronto quando:** O administrador conecta o Miro da empresa pela tela.
- [ ] **15.3.2 Conexões pessoais em Minha conta** `web`
  - **Hoje:** Minha conta não tem conexões.
  - **O que fazer:** Nova seção Conexões em Minha conta: as Integrações pessoais disponíveis, com Conectar e Desconectar, e o estado de cada uma.
  - **Pronto quando:** Um Membro conecta a própria Google Agenda e vê “Conectada”.

### 15.4 Omie como Ferramenta nossa

**Objetivo:** O Composio não tem o Omie. As ações do Omie que o Agente usa viram Ferramentas nossas, com a chave da empresa no cofre.

**Pronto quando:** O Agente consulta uma conta a pagar no Omie a pedido no Chat.

- [ ] **15.4.1 Escolher as primeiras ações do Omie para o Agente** `você`
  - **Hoje:** Hoje o Omie só recebe lançamentos, pelo serviço externo `automation/`.
  - **O que fazer:** Escolher de duas a quatro ações para começar (por exemplo: consultar uma conta a pagar, consultar um fornecedor, listar contas a vencer).
  - **Pronto quando:** Lista de ações escolhida.
- [ ] **15.4.2 Escrever as Ferramentas do Omie** `api`
  - **Hoje:** As chaves do Omie ficam no `automation/`; a Integração guarda só o rótulo da conta (`contaRotulo`, `packages/dominio/src/types/workspace.ts`).
  - **O que fazer:**
    1. Guardar a chave do Omie de cada Empresa no cofre da Sessão 1, como conexão da empresa.
    2. Escrever cada ação escolhida como Ferramenta em `apps/api`, chamando a API do Omie com essa chave.
    3. O lançamento que já funciona pelo `automation/` continua como está.
  - **Pronto quando:** Teste: a Ferramenta “consultar conta a pagar” devolve a conta certa da Empresa certa.

### 15.5 Google Agenda e Miro

**Objetivo:** As duas primeiras Integrações pelo Composio, prontas para o Agente usar.

**Pronto quando:** As duas aparecem como poder no Construtor e funcionam no Chat.

- [ ] **15.5.1 Ligar a Google Agenda (pessoal)** `api`
  - **Hoje:** Não existe.
  - **O que fazer:** Habilitar no Composio as ações de listar eventos, criar evento e procurar horário livre, e oferecê-las ao Agente que tem a Google Agenda como poder.
  - **Pronto quando:** No Chat, o Agente marca um evento na agenda de quem pediu, depois de aprovado.
- [ ] **15.5.2 Ligar o Miro** `api`
  - **Hoje:** Não existe.
  - **O que fazer:** Habilitar no Composio as ações de listar quadros e criar notas num quadro.
  - **Pronto quando:** No Chat, o Agente cria uma nota num quadro de teste.

**A sessão fica pronta quando:** Um Membro conecta a própria Google Agenda pela tela e o Agente lista os eventos dele no Chat; outro Membro não vê esses eventos; o Agente consulta uma conta a pagar no Omie com a conexão da empresa.

---

## Sessão 16 · IA: Agente na Caixa de Entrada

O Agente passa a atender Contatos pelos Canais conectados. A mensagem chega pela porta de entrada da Sessão 3; se a Conversa está atribuída a um Agente ativo, ele é acionado só com as próprias permissões (não há pessoa delegante, regra RN-AGE-11); o modelo responde com o contexto da Conversa; em `autonomo` a resposta sai pela porta de saída da Sessão 3 e pelo provedor da Sessão 4; nos outros níveis vira rascunho com pedido de aprovação; e uma pessoa pode assumir a qualquer momento.

**Depende de:** Sessão 4, Sessão 7, Sessão 14.

> **Ajuste sugerido:** +2 dias: tabela de rascunhos, atribuição, acionamento, Ferramentas do CRM com o Agente como ator, assumir e devolver, e limites.

**Ponto de partida:**
- A regra RN-AGE-14 (`ontologia/04-ia/agentes.md:460`) define o caminho: Agente atribuído a uma Conversa é acionado a cada mensagem recebida; a autonomia decide envio direto ou rascunho com aprovação; transferir a Conversa cancela a Execução em curso.
- `plataforma.conversas` (migração 008) aceita `atribuido_tipo` = 'agente'; o domínio já tem `Conversa.atribuido` (`packages/dominio/src/crm/conversas.ts:54`); não há rota que atribua (`ServicoDeConversas`, `apps/api/src/servicos/crm/conversas.ts:56`, só lista, obtém, cria, resolve e reabre).
- `plataforma.canais` tem `fila_padrao_id` e `proprietario_padrao_id`, sem Agente. Fila não tem tabela (decisão D-09 da 008).
- Rascunho de Conversa ficou fora da 008 de propósito (comentário do topo da migração).
- `plataforma.mensagens` aceita `ator_tipo` = 'agent'. A janela de 24 h só vale no WhatsApp oficial: o não oficial não tem janela (`capacidadesDoCanal`, `packages/dominio/src/operations/conversations.ts:115-125`).
- Das sessões anteriores: porta de entrada e de saída (3.2 e 3.3), tempo real (3.4), Caixa de Entrada nas tabelas novas (3.1), Evolution (4.2) e o laço do Agente com aprovações (14.1 e 14.3).

### 16.1 Atribuição

**Objetivo:** A tabela aceita um Agente como responsável pela Conversa, mas nada atribui, o Canal não tem Agente padrão e arquivar um Agente não solta as Conversas dele. Aqui nascem a coluna, a rota e as regras.

**Pronto quando:** Uma Conversa nova num Canal com Agente padrão já nasce atribuída a ele, e arquivar o Agente devolve a Conversa sem responsável.

- [ ] **16.1.1 Criar a migração do Agente padrão e do rascunho** `banco`
  - **Hoje:** `plataforma.canais` não tem coluna de Agente; não existe tabela de rascunho.
  - **O que fazer:**
    1. Migração nova: `alter table plataforma.canais add column agente_padrao_id text` (sem FK: o Agente vive em `plataforma.registros`).
    2. Na mesma migração, `plataforma.rascunhos_de_conversa` (workspace_id, id, conversa_id, origem 'agente' ou 'membro', autor_tipo, autor_id, execucao_id, aprovacao_id, conteudo, situacao 'aberto' / 'enviado' / 'descartado', criado_em), com FK composta para `plataforma.conversas` e no máximo um rascunho aberto de Agente por Conversa.
    3. Rodar `npm run migrar -w @n1/api -- --seco` antes de aplicar.
  - **Pronto quando:** Migração aplicada em homologação; `npm run migrar -w @n1/api -- --seco` não lista mais nada.
- [ ] **16.1.2 Atribuir e desatribuir a Conversa** `domínio` `api`
  - **Hoje:** Não existe operação nem rota. A regra RN-AGE-20 diz que só Agente `ativo` pode ser atribuído.
  - **O que fazer:**
    1. Em `packages/dominio/src/crm/conversas.ts`, `validarAtribuicao(alvo, { agenteAtivo })`.
    2. Em `servicos/crm/conversas.ts`, `atribuir(membro, id, alvo)`, com `alvo` = `{ tipo: 'membro' | 'agente', id }` ou `null`; o estado do Agente é lido direto em `plataforma.registros` (colecao = 'agents').
    3. Rota `PATCH /conversas/:id/atribuicao` em `apps/api/src/rotas/crm/conversas.ts`.
  - **Pronto quando:** Teste da rota: atribuir a um Agente pausado volta 409; a um ativo grava `atribuido_tipo` = 'agente' em `plataforma.conversas`.
- [ ] **16.1.3 Configurar o Agente padrão do Canal** `domínio` `api` `web`
  - **Hoje:** `Canal` (`packages/dominio/src/crm/canais.ts:34`) tem `filaPadraoId` e `proprietarioPadraoId`; a ficha do Canal é `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx`.
  - **O que fazer:**
    1. `Canal` e `EdicaoDeCanal` (`canais.ts:107`) ganham `agentePadraoId`; `validarEdicaoDeCanal` aceita.
    2. Repositório e serviço de Canais gravam a coluna nova.
    3. Na ficha do Canal, um seletor com os Agentes ativos.
    4. No recebimento completo da Sessão 3 (3.2), a Conversa nova nasce atribuída ao Agente padrão quando ele está ativo; senão, ao proprietário padrão.
  - **Pronto quando:** Uma mensagem simulada pelo webhook num Canal com Agente padrão cria a Conversa com `atribuido_tipo` = 'agente'.
- [ ] **16.1.4 Soltar as Conversas ao arquivar o Agente** `api`
  - **Hoje:** `arquivarAgente` e `enviarAgenteALixeira` (`operations/ia/agentes.ts:221` e `:254`) mudam só o Agente. A regra RN-AGE-20 diz: pausado mantém as Conversas sem agir; arquivado e na lixeira as liberam.
  - **O que fazer:**
    1. Em `apps/api/src/rotas/operacoes.ts`, ao rodar essas duas operações, passar a `executar()` um `aoConfirmar` (`persistencia/unidade-de-trabalho.ts:74`) que, na mesma transação, limpa `atribuido_tipo`/`atribuido_id` das Conversas do Agente e `agente_padrao_id` dos Canais.
    2. Pausado não muda nada nas tabelas: o acionamento (16.2) é que confere o estado.
  - **Pronto quando:** Teste: arquivar um Agente com duas Conversas deixa as duas sem responsável e o Canal sem Agente padrão.

### 16.2 Acionar o Agente

**Objetivo:** Nada acontece quando chega mensagem numa Conversa de Agente. Aqui a porta de entrada passa a abrir uma Execução para cada mensagem recebida, com o contexto da Conversa e só as permissões do Agente.

**Pronto quando:** A mensagem chega pelo webhook e nasce uma Execução com origem `caixaDeEntrada`, visível em `/ia/execucoes/<id>`.

- [ ] **16.2.1 Abrir a Execução ao chegar mensagem** `domínio` `api`
  - **Hoje:** Não existe. A origem `caixaDeEntrada` já está no tipo (`AgentExecution.origin`, `types/ai.ts:262`).
  - **O que fazer:**
    1. No domínio, `abrirExecucaoDaCaixa(state, agentId, conversa)` em `packages/dominio/src/operations/ia/execucao-da-caixa.ts`, fora do registro: Agente ativo e disponível, origem `caixaDeEntrada`, invocador Sistema, sem delegante, Âncora `conversation`.
    2. Criar `apps/api/src/ia/caixa-de-entrada/acionar-agente.ts` com `acionarAgenteDaConversa(workspaceId, conversaId, mensagemId)`, chamado pela fila de entrada da Sessão 3 depois de gravar uma mensagem `recebida` que não é repetida.
    3. Uma Execução por mensagem (regra RN-AGE-14), uma de cada vez por Conversa (`pg_advisory_xact_lock` pelo id da Conversa).
  - **Pronto quando:** Teste: duas mensagens seguidas numa Conversa de Agente geram duas Execuções, a segunda começando depois de a primeira terminar; numa Conversa de pessoa, nenhuma.
- [ ] **16.2.2 Montar o contexto da Conversa** `domínio` `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. No domínio, `montarContextoDaConversa({ versao, contato, mensagens, trechos, memoria })`, pura: os dados vêm das tabelas e o `apps/api` os passa.
    2. O `apps/api` lê as últimas mensagens em `plataforma.mensagens` (variável `IA_HISTORICO_DA_CONVERSA`, padrão 30), o Contato em `plataforma.contatos` e os trechos de `consultar_conhecimento` (primeiros Fragmentos até a Sessão 17).
    3. A `ContextComposition` grava os ids lidos.
  - **Pronto quando:** Em homologação, o Agente responde chamando o Contato pelo nome e citando um trecho da Coleção concedida.
- [ ] **16.2.3 Executar as Ferramentas do CRM com as permissões do Agente** `domínio` `api`
  - **Hoje:** As Ferramentas do CRM existem só no Catálogo. Os serviços do CRM recebem um `MembroDaSessao` (`apps/api/src/plugins/autenticacao.ts`), nunca um Agente.
  - **O que fazer:**
    1. Criar `apps/api/src/ia/execucao/ferramentas-do-crm.ts` com `ler_contato`, `ler_conversa`, `ler_negocio`, `sugerir_resposta`, `atualizar_qualificacao` e `enviar_mensagem`, chamando os serviços de `apps/api/src/servicos/crm/`.
    2. Os serviços passam a aceitar um ator Agente além do Membro, gravando `ator_tipo` = 'agent'.
    3. No domínio, `recusaDoAgenteNoCrm(state, agentId, toolId, alvo)` usa só as concessões do Agente e o Papel dele (Convidado, regra B76), sem interseção com pessoa (regra RN-AGE-11).
  - **Pronto quando:** Teste: um Agente sem `editar` no Contato tenta `atualizar_qualificacao` e o passo fica `negada`.

### 16.3 Responder

**Objetivo:** Hoje nada sai em nome do Agente. Aqui a resposta sai direto em `autonomo` ou vira rascunho com pedido de aprovação nos outros níveis, como manda a regra RN-AGE-14.

**Pronto quando:** Os dois caminhos funcionando com um número da Evolution.

- [ ] **16.3.1 Enviar direto em autônomo** `api`
  - **Hoje:** `ServicoDeMensagens.enviar` (`apps/api/src/servicos/crm/mensagens.ts:46`) só envia em nome de um Membro.
  - **O que fazer:**
    1. `enviarComoAgente(workspaceId, agentId, { conversaId, conteudo, execucaoId })` em `servicos/crm/mensagens.ts`: grava a mensagem `enviada` com `ator_tipo` = 'agent', sem delegante, e a manda pela porta de saída da Sessão 3 (3.3), que entrega à Evolution (4.2).
    2. O executor de `enviar_mensagem` chama `enviarComoAgente` quando `exigeAprovacao` (14.1) diz que não precisa.
  - **Pronto quando:** Com um Agente `autonomo`, a mensagem mandada do celular recebe a resposta no celular.
- [ ] **16.3.2 Rascunho e aprovação nos outros níveis** `domínio` `api`
  - **Hoje:** Não existe rascunho de Conversa até a migração da 16.1.
  - **O que fazer:**
    1. Quando `enviar_mensagem` exige aprovação: gravar o texto em `plataforma.rascunhos_de_conversa` com `execucao_id`, e criar o pedido com `solicitarAprovacaoDaFerramenta` (14.3), objeto fixo { Ferramenta `enviar_mensagem`, texto, Conversa }, prazo da T.2.
    2. Aprovado pela rota de decisão (14.3): `enviarComoAgente` com exatamente o texto do pedido (regra RN-AGE-17) e o rascunho vira `enviado`.
    3. Recusado: o rascunho fica aberto para a pessoa. Expirado: a Conversa passa para o proprietário padrão do Canal, como decidido na T.2.
  - **Pronto quando:** Teste em `apps/api`: Agente `supervisionado` responde, o rascunho e o pedido existem, aprovar envia o texto e marca o rascunho `enviado`.
- [ ] **16.3.3 Respeitar a janela de 24 h do WhatsApp oficial** `api`
  - **Hoje:** Só o WhatsApp oficial tem janela; o não oficial não (`capacidadesDoCanal`, `operations/conversations.ts:120`). Modelos de mensagem aprovados só chegam na Sessão 7 (7.3).
  - **O que fazer:**
    1. Antes de enviar, ler as capacidades do Canal; fora da janela, o Agente não manda texto livre: grava rascunho e passa a Conversa para uma pessoa.
    2. Quando a Sessão 7 estiver pronta, o Agente pode escolher um modelo aprovado.
  - **Pronto quando:** Teste com um Canal `whatsapp-cloud` e a última mensagem recebida há 25 h: nada é enviado, e a Conversa fica com o proprietário padrão.
  - **Atenção:** Depende da Sessão 7 para a parte dos modelos; com só a Evolution conectada, esta subtarefa fica no teste.

### 16.4 Pessoa e Agente

**Objetivo:** Uma pessoa precisa assumir a Conversa a qualquer momento e poder devolver. Pela regra RN-AGE-14, transferir cancela o que o Agente estiver fazendo, e o texto que já tinha saído vira rascunho.

**Pronto quando:** Ao clicar “Assumir”, o Agente para na hora, e “Devolver” faz a próxima mensagem ser respondida por ele.

- [ ] **16.4.1 Assumir a Conversa** `domínio` `api`
  - **Hoje:** `cancelarExecucao` (`operations/ia/agentes.ts:548`) exige um Membro que administre o Agente; não há cancelamento pelo Sistema.
  - **O que fazer:**
    1. No domínio, `cancelarPorTransferencia(state, executionId)`, ator Sistema, motivo “Conversa transferida”; cancela também os pedidos pendentes da Execução.
    2. A rota de atribuição (16.1), ao trocar de Agente para Membro, chama essa operação, aborta o modelo pelo `em-curso.ts` (14.4) e grava o texto parcial como rascunho (regra RN-AGE-21).
  - **Pronto quando:** Teste: assumir durante uma resposta do `modelo-falso` deixa a Execução `cancelada` e nenhuma mensagem `enviada` do Agente.
- [ ] **16.4.2 Devolver ao Agente** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. A mesma rota de atribuição, de Membro para Agente ativo.
    2. A próxima mensagem `recebida` aciona o Agente; o que chegou antes não é respondido de novo.
  - **Pronto quando:** Teste: depois de devolver, a mensagem seguinte gera uma Execução.
- [ ] **16.4.3 Mostrar o atendimento do Agente na Caixa de Entrada** `web`
  - **Hoje:** O fio da Conversa é `apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` e não mostra quem atende nem rascunho.
  - **O que fazer:**
    1. No cabeçalho do fio, “Atendido por <Agente>” e os botões Assumir e Devolver.
    2. Acima do campo de resposta, o rascunho aberto do Agente com Aprovar (rota de decisão da 14.3), Editar (assume a Conversa, põe o texto no campo e recusa o pedido com motivo “editado pela pessoa”) e Descartar.
    3. Na lista (`caixa-de-entrada/page.tsx`), um filtro “Com Agente”.
    4. O rascunho aparece sem recarregar pelo tempo real da Sessão 3 (3.4).
  - **Pronto quando:** Você opera uma Conversa com Agente só pela tela: vê o rascunho, aprova, assume e devolve.

### 16.5 Limites do atendimento

**Objetivo:** Sem limite, um Agente pode conversar sem fim com um Contato e gastar além do teto. Aqui ele tem teto por Conversa e por dia, e você decide se ele atende em horário definido.

**Pronto quando:** Ao passar do teto, a Conversa vai para uma pessoa com uma nota interna.

- [ ] **16.5.1 Teto por Conversa e por dia** `api`
  - **Hoje:** Só existe o teto mensal da Sessão 13 (`apps/api/src/ia/teto.ts`).
  - **O que fazer:**
    1. Variáveis `IA_MAX_RESPOSTAS_POR_CONVERSA_DIA` (padrão 30) e `IA_MAX_CUSTO_POR_CONVERSA_DIA_USD`, somadas em `plataforma.consumo_de_ia` pela coluna `conversa_id`.
    2. Ao atingir, `acionarAgenteDaConversa` não chama o modelo: atribui a Conversa ao proprietário padrão do Canal e grava uma mensagem `interna` “O Agente atingiu o limite do dia”.
  - **Pronto quando:** Teste com teto de 2 respostas: a terceira mensagem passa a Conversa para a pessoa e não cria Execução.
- [ ] **16.5.2 Decidir se o Agente atende em horário definido** `decisão` · *muda o produto*
  - **Como é hoje:** Não há horário de atendimento nos Canais (`plataforma.canais`, migração 008).
  - **Você decide:**
    - (A) O tempo todo
    - (B) Só em horário definido; fora dele, avisa que alguém responde depois
    - (C) Só fora do horário comercial, quando não há pessoas
  - **O que muda depois:** (A) não muda nada. (B) e (C) exigem a coluna `horario_de_atendimento` (jsonb) em `plataforma.canais` numa migração nova, o campo na ficha do Canal e a conferência em `acionarAgenteDaConversa`: meio dia.
  - **Recomendo:** (C): é onde o Agente mais ajuda no começo.

**A sessão fica pronta quando:** Num número da Evolution conectado, uma mensagem do celular numa Conversa atribuída a um Agente recebe resposta dele: direto em `autonomo`, ou como rascunho que uma pessoa aprova pela Caixa de Entrada nos outros níveis; clicar “Assumir” para o Agente na hora.

---

## Sessão 17 · IA: Conhecimento indexado

Hoje o Conhecimento guarda Coleções, Fontes, Documentos e Versões de verdade, mas o conteúdo de arquivo e de URL é inventado: vira um único trecho “(simulado)”, nada é indexado e o Agente recebe sempre o primeiro trecho de até três Documentos. Nesta sessão o arquivo sobe ao armazenamento, o texto é extraído e fatiado, cada trecho ganha um vetor de significado (embedding) guardado no Postgres com a extensão `pgvector`, a Ferramenta `consultar_conhecimento` passa a buscar por significado só nas Coleções que o Agente pode ler, e as Fontes de URL se atualizam sozinhas.

**Depende de:** Sessão 13, Sessão 14.

> **Ajuste sugerido:** +2 dias: seis frentes (armazenamento real, extração de texto, embeddings, busca, citação do trecho e Fontes).

**Ponto de partida:**
- CRUD de Coleção, Fonte, Documento, Versão e Concessão em `packages/dominio/src/operations/ia/conhecimento.ts` (20 operações), gravado em `plataforma.registros` pelo `POST /operacoes/:nome`.
- Texto colado já é fatiado por parágrafo em `fragmentarTexto` (`packages/dominio/src/derive-ia.ts:405`).
- Arquivo e URL são simulados em `prepararConteudo` (`conhecimento.ts:363`): o arquivo nasce com `objectKey: legado/<id>` (`conhecimento.ts:385`), a URL nunca é baixada (`conhecimento.ts:371`) e os dois rendem um trecho “Conteúdo de … (simulado)” (`fragmentoSimulado`, `conhecimento.ts:354`).
- O envio real em duas fases já existe em `apps/api/src/servicos/storage-uploads.ts` (ticket assinado, conferência dos bytes, `urlDeDownload`) e já serve a Tarefa em `apps/api/src/rotas/anexos-da-tarefa.ts`.
- As Coleções que um Agente pode ler já são calculadas por `conhecimentoAcessivel` (`derive-ia.ts:242`).
- As telas já mostram a referência: o Chat (`apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:355`) e a Execução (`apps/web/src/app/(shell)/ia/execucoes/[execucao]/page.tsx:267`) ligam para o Documento consultado.

### 17.1 Arquivo de verdade no Conhecimento

**Objetivo:** Hoje escolher um arquivo no diálogo só lê nome, tamanho e tipo; nenhum byte sobe, e o Arquivo nasce com uma chave fictícia. O arquivo passa a subir pelo mesmo envio em duas fases da Tarefa, e o Documento aponta para o objeto guardado no bucket privado.

**Pronto quando:** Um PDF enviado pela tela fica no bucket, aparece na coleção `files` de `plataforma.registros` com `objectKey` começando com `workspace/` e baixa pelo botão “Baixar” do Documento.

- [ ] **17.1.1 Criar as rotas de envio de arquivo do Conhecimento** `api`
  - **Hoje:** Só a Tarefa e o Formulário público pedem ticket de envio: `POST /tarefas/:taskId/anexos/ticket` (`apps/api/src/rotas/anexos-da-tarefa.ts:96`) e `POST /tarefas/:taskId/anexos/confirmar` (`anexos-da-tarefa.ts:119`), com `abrirSessaoDeUpload`, `emitirTicket` e `confirmarObjeto` de `storage-uploads.ts`.
  - **O que fazer:**
    1. Criar `apps/api/src/rotas/conhecimento-arquivos.ts` com `POST /conhecimento/colecoes/:colecaoId/arquivos/ticket` e `POST /conhecimento/colecoes/:colecaoId/arquivos/confirmar`, copiando o desenho de `anexos-da-tarefa.ts`.
    2. A sessão de envio usa o `formId` sintético `colecao-<colecaoId>`, do mesmo jeito que a Tarefa usa `tarefa-<taskId>` (`formIdDaTarefa`, `anexos-da-tarefa.ts`).
    3. Antes de emitir o ticket, hidratar o Espaço e recusar com 403 quando `recusaNaColecao(state, membroId, colecao, 'criar')` (de `operations/ia/permissoes-ia.ts`) devolver motivo.
    4. Na confirmação, conferir o objeto com `confirmarObjeto` e chamar `adicionarDocumentoEnviado` (subtarefa seguinte) dentro de `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts`), na mesma transação que consome a sessão.
    5. Registrar `rotasDeArquivosDoConhecimento` em `apps/api/src/app.ts`, ao lado de `rotasDeAnexosDaTarefa` (`app.ts:208`).
  - **Pronto quando:** Teste novo `apps/api/src/rotas/conhecimento-arquivos.test.ts`: um Convidado sem `criar` na Coleção recebe 403 no ticket; um Membro com permissão faz ticket, envio e confirmação, e o Documento fica gravado com o `objectKey` do bucket.
- [ ] **17.1.2 Aceitar os tipos de documento no envio** `api`
  - **Hoje:** `TIPOS_ACEITOS` (`apps/api/src/servicos/storage-uploads.ts:53`) aceita só PDF, XML, JPEG, PNG e WebP, e `assinaturaConfereComTipo` (`storage-uploads.ts:114`) só conhece as assinaturas desses.
  - **O que fazer:**
    1. Criar em `storage-uploads.ts` a lista `TIPOS_DO_CONHECIMENTO`: PDF, `text/plain`, `text/markdown`, `text/csv` e DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
    2. Em `assinaturaConfereComTipo`, aceitar DOCX pela assinatura de ZIP (`PK` seguido de `03 04`) e texto puro quando os primeiros bytes não têm byte nulo.
    3. As rotas do Conhecimento usam `TIPOS_DO_CONHECIMENTO`; Tarefa e Formulário continuam com `TIPOS_ACEITOS`.
  - **Pronto quando:** Teste na “Seção pura” de `storage-uploads.test.ts`: um DOCX real passa, um PNG renomeado para `.docx` é recusado.
  - **Atenção:** A Sessão 2.5 também mexe em `TIPOS_ACEITOS` (áudio e vídeo). Quem vier depois junta as duas listas.
- [ ] **17.1.3 Gravar o Documento a partir do arquivo conferido** `domínio`
  - **Hoje:** No caso `arquivo` de `prepararConteudo` (`conhecimento.ts:373-389`) o domínio inventa o `WorkspaceFile` com `objectKey: legado/${fileId}` e já marca a Versão como `processado`, com um `fragmentoSimulado`.
  - **O que fazer:**
    1. Criar em `conhecimento.ts` a operação `adicionarDocumentoEnviado(state, membroId, colecaoId, { title, labels, arquivo })`, em que `arquivo` é o tipo `ArquivoEnviado` que já existe em `packages/dominio/src/operations/anexos-enviados.ts:33`.
    2. O `WorkspaceFile` nasce com o `objectKey` conferido pelo servidor e `state: enviado`. A Versão 1 nasce com `processing: pendente` e `fragments: []`: o texto chega depois, pelo processador da 17.3.
    3. Criar do mesmo jeito `novaVersaoDoDocumentoEnviado` para a Versão nova por arquivo.
    4. Não registrar as duas em `operations/registro.ts`: só a rota de confirmação pode chamá-las, como já acontece com `anexarArquivoEnviado`.
    5. Tirar o caso `kind: arquivo` de `EntradaDeConteudo` (`conhecimento.ts:281-284`) e apagar `fragmentoSimulado` quando ninguém mais o usar.
  - **Pronto quando:** Teste em `operations/ia/conhecimento.test.ts`: o Documento criado por `adicionarDocumentoEnviado` tem Versão 1 `pendente`, sem Fragmentos, e o Arquivo com o `objectKey` recebido.
- [ ] **17.1.4 Ligar o diálogo e a ficha do Documento ao envio real** `web`
  - **Hoje:** `apps/web/src/features/ia/conhecimento/adicionar-documento-dialog.tsx` lê só nome, tamanho e tipo do arquivo (`ArquivoEscolhido`, linhas 20-24) e chama `adicionarDocumento` pelo `run` (linha 96). A ficha (`documento-completo.tsx`) não tem botão de baixar.
  - **O que fazer:**
    1. Criar `apps/web/src/dados/arquivos-do-conhecimento.ts` com `enviarArquivoAoConhecimento(colecaoId, arquivo, metadados)`, no molde de `enviarArquivoDaTarefa` (`apps/web/src/dados/anexos-da-tarefa.ts:55`) e `envio-ao-bucket.ts`: pede o ticket, sobe os bytes, confirma.
    2. Na aba “Arquivo” do diálogo, trocar o `run(adicionarDocumento)` por essa função e, ao terminar, pedir ao store que confira a revisão (`verificarRevisao`, `store.ts:322`) para o Documento aparecer.
    3. Mostrar no Documento “Processando…” enquanto a Versão estiver `pendente` e “Falhou: <motivo>” quando estiver `comErro`.
    4. Pôr o botão “Baixar” em `documento-completo.tsx`, usando `pedirUrlDeDownload` (`anexos-da-tarefa.ts:90`), que chama `GET /anexos/:fileId/url` (`apps/api/src/rotas/estado.ts:70`).
    5. Apagar o comentário “Fragmentos simulados (D9)” do topo do diálogo (linha 8).
  - **Pronto quando:** Você envia um PDF pelo diálogo, vê “Processando…”, recarrega e baixa o mesmo arquivo pelo botão.

### 17.2 Captura de URL de verdade

**Objetivo:** Hoje uma URL vira o texto fixo “Conteúdo capturado de … (simulado)” e a página nunca é baixada. O servidor passa a baixar a página, tirar o texto legível e guardá-lo na Versão.

**Pronto quando:** Um Documento criado com a URL de uma página pública mostra, na ficha, o texto real da página.

- [ ] **17.2.1 Deixar a Versão de URL pendente no domínio** `domínio`
  - **Hoje:** O caso `url` de `prepararConteudo` (`conhecimento.ts:369-372`) grava o texto fixo e um `fragmentoSimulado`, já como `processado`.
  - **O que fazer:**
    1. Trocar o caso `url` para gravar a Versão com `processing: pendente`, `content: {}` e `fragments: []`. A URL já fica guardada na Proveniência (`specificOrigin`, preenchida por `origemEspecifica`).
    2. Tirar a frase “A captura é simulada neste protótipo…” do campo Endereço em `adicionar-documento-dialog.tsx:160`.
  - **Pronto quando:** Teste em `conhecimento.test.ts`: `adicionarDocumento` com URL cria a Versão `pendente`, sem texto e sem Fragmentos.
- [ ] **17.2.2 Baixar a página com segurança** `api`
  - **Hoje:** Não existe nenhum código que faça requisição a uma URL do usuário.
  - **O que fazer:**
    1. Criar `apps/api/src/conhecimento/capturar-url.ts` com `capturarUrl(url): { texto, titulo, tipo } | { erro }`.
    2. Regras: só `http` e `https`; resolver o DNS e recusar endereço privado, loopback ou link-local (para ninguém usar o servidor para ler a rede interna); até 3 redirecionamentos, 15 s de tempo e 5 MB.
    3. HTML: tirar o texto legível com `@mozilla/readability` sobre `linkedom` (duas dependências novas no `apps/api`). PDF por URL: passar pelo extrator da 17.3.
    4. Quem chama é o processador de Documentos da 17.3, que grava o resultado com `registrarProcessamentoDaVersao`.
  - **Pronto quando:** Teste `capturar-url.test.ts`: `http://127.0.0.1` e `http://169.254.169.254` são recusados; uma página HTML de exemplo servida pelo teste devolve o texto do corpo, sem menu e sem rodapé.

### 17.3 Extrair e fatiar o texto

**Objetivo:** Nada extrai texto de PDF ou DOCX hoje, e o fatiamento só corta por parágrafo, o que gera trechos enormes num PDF. Um processador no servidor pega cada Versão pendente, extrai o texto, fatia em trechos de tamanho controlado e grava no Documento.

**Pronto quando:** Um PDF de 10 páginas enviado vira, em menos de um minuto, uma Versão `processado` com trechos de até cerca de 2.000 caracteres, cada um com a página no localizador.

- [ ] **17.3.1 Criar o extrator de texto** `api`
  - **Hoje:** Não existe; o `apps/api/package.json` não tem nenhuma biblioteca de PDF ou DOCX.
  - **O que fazer:**
    1. Criar `apps/api/src/servicos/extrair-texto.ts` com `extrairTexto(bytes, mime): { texto, paginas?: string[] }`.
    2. PDF com `unpdf` (devolve o texto por página); DOCX com `mammoth`; `text/*` lido como UTF-8.
    3. PDF sem texto (escaneado) devolve erro “PDF sem texto: é imagem”, conforme a decisão abaixo.
  - **Pronto quando:** Teste `extrair-texto.test.ts` com um PDF de duas páginas e um DOCX de exemplo guardados em `apps/api/src/testes/`: o texto e a contagem de páginas batem.
  - **Atenção:** A Sessão 15.3 (PDF anexado no Chat) precisa do mesmo extrator. Quem fizer primeiro cria; a outra reaproveita.
- [ ] **17.3.2 PDF escaneado entra no Conhecimento?** `decisão` · *muda o produto*
  - **Como é hoje:** Não há extração de texto, então a pergunta nunca apareceu. Um PDF que é só imagem não tem texto para extrair.
  - **Você decide:**
    - (A) Recusar com o aviso “PDF sem texto” e pedir outro arquivo
    - (B) Ler a imagem com o modelo (visão do Claude) e guardar a transcrição
    - (C) Usar um serviço de OCR à parte
  - **O que muda depois:** (A) não custa nada. (B) soma cerca de 1 dia e custo de modelo por página. (C) soma cerca de 1 dia e mais um fornecedor.
  - **Recomendo:** (A) agora; (B) quando aparecer o primeiro caso real.
- [ ] **17.3.3 Fatiar por tamanho, guardando a página** `domínio`
  - **Hoje:** `fragmentarTexto` (`derive-ia.ts:405`) corta só em linha em branco e dá o localizador `p<n>`. Um PDF extraído vira poucos trechos gigantes.
  - **O que fazer:**
    1. Mudar `fragmentarTexto(texto, opcoes?)` para cortar em parágrafos e juntar até `maxCaracteres` (padrão 2.000), com `sobreposicao` (padrão 200) entre um trecho e o seguinte.
    2. Aceitar `paginas?: string[]`: o localizador vira `pag<n>§<m>` (página e trecho dentro da página).
    3. Texto colado curto continua dando um trecho por parágrafo; os testes atuais de `fragmentarTexto` continuam passando.
  - **Pronto quando:** Teste em `derive-ia.test.ts`: um texto de 9.000 caracteres vira 5 trechos de até 2.000, com sobreposição, e um texto de 3 páginas tem localizadores `pag1§1`, `pag2§1`, `pag3§1`.
- [ ] **17.3.4 Gravar o resultado do processamento no domínio** `domínio`
  - **Hoje:** Não existe operação que leve uma Versão de `pendente` para `processado`. `derivedRepresentations` é `readonly` em `DocumentVersion` (`packages/dominio/src/types/ai.ts:561`).
  - **O que fazer:**
    1. Criar em `conhecimento.ts` `registrarProcessamentoDaVersao(state, documentId, numero, resultado)`, em que `resultado` é `{ ok: true, texto, paginas? }` ou `{ ok: false, motivo }`. O ator é o Sistema (`kind: system`, `types/primitives.ts:36`), porque o Fragmento só é criado pelo Sistema (B97).
    2. Com sucesso: acrescentar a representação `{ kind: extracao, text, by: Sistema, at }`, gerar os Fragmentos com o novo `fragmentarTexto` e marcar `processado`. Com falha: marcar `comErro` e registrar o motivo na Atividade do Documento.
    3. Recusar quando a Versão já não está `pendente`, para duas voltas do processador não gravarem duas vezes.
    4. Tirar o `readonly` de `derivedRepresentations` em `types/ai.ts:561`.
  - **Pronto quando:** Teste em `conhecimento.test.ts`: a Versão `pendente` vira `processado` com N Fragmentos; a segunda chamada é recusada; a falha deixa `comErro` com o motivo.
- [ ] **17.3.5 Criar o processador de Documentos pendentes** `api`
  - **Hoje:** Não existe. O `apps/api` já tem trabalhadores em segundo plano no mesmo processo: o outbox e o agendador, ligados em `apps/api/src/index.ts:187`.
  - **O que fazer:**
    1. Criar `apps/api/src/conhecimento/processador-de-documentos.ts` com `criarProcessadorDeDocumentos()`, no molde de `criarOutboxWorker`, e ligá-lo em `apps/api/src/index.ts`.
    2. A cada volta (padrão 30 s): achar por SQL em `plataforma.registros` (coleção `documents`) os Documentos cuja Versão corrente está `pendente`; para cada um, baixar o objeto do bucket (arquivo) ou chamar `capturarUrl` (URL), extrair o texto e gravar com `registrarProcessamentoDaVersao` dentro de `executar()`.
    3. Depois de gravar, chamar a indexação da 17.4 para os Fragmentos novos.
    4. Áudio e vídeo continuam `pendente` (transcrição fica fora desta sessão) e o processador os ignora.
  - **Pronto quando:** Teste de integração `processador-de-documentos.test.ts` (pula sem `DATABASE_URL`): um Documento enviado fica `processado` depois de uma volta do processador.

### 17.4 Índice por significado

**Objetivo:** Hoje não existe nenhum vetor, então não há como achar o trecho “parecido” com a pergunta. Cada trecho ganha um embedding, guardado numa tabela própria com `pgvector`, e toda Versão nova é indexada sozinha.

**Pronto quando:** Depois de enviar um Documento, `select count(*) from plataforma.fragmentos_indexados where documento_id = '<id>'` devolve o mesmo número de Fragmentos da Versão corrente.

- [ ] **17.4.1 Qual modelo gera os embeddings?** `decisão` · *muda o produto*
  - **Como é hoje:** Nenhum. A Anthropic, que é o modelo de conversa da Sessão 13, não oferece embeddings; é preciso outro fornecedor.
  - **Você decide:**
    - (A) Voyage AI `voyage-2.5` (1.024 dimensões, indicado pela Anthropic, bom em português)
    - (B) OpenAI `text-embedding-3-small` (1.536 dimensões)
    - (C) Modelo aberto rodando no nosso servidor (por exemplo `multilingual-e5`)
  - **O que muda depois:** Fixa o tamanho da coluna `embedding` e cria mais uma chave de API no servidor. (A) e (B) cobram por volume, cerca de centavos por mil páginas. (C) não cobra por uso, mas soma cerca de 1 dia de infraestrutura e precisa de máquina com mais memória.
  - **Recomendo:** (A).
- [ ] **17.4.2 Criar a tabela de trechos com `pgvector`** `banco`
  - **Hoje:** Não existe. Os Fragmentos vivem dentro do JSON do Documento, em `plataforma.registros`; nenhuma migração liga extensão (a última é a `008-canais-conversas-mensagens.sql`).
  - **O que fazer:**
    1. Migração nova em `apps/api/migracoes/` com `create extension if not exists vector with schema extensions;`.
    2. Tabela `plataforma.fragmentos_indexados`: `workspace_id text`, `fragmento_id text`, `documento_id text`, `colecao_id text`, `versao int`, `localizador text`, `conteudo text`, `embedding extensions.vector(<dimensão da decisão>)`, `modelo text`, `criado_em timestamptz default now()`; chave primária `(workspace_id, fragmento_id)`.
    3. Índice `hnsw (embedding vector_cosine_ops)` e índice comum em `(workspace_id, colecao_id)` para o filtro de acesso.
    4. Conferir antes com `npm run migrar -w @n1/api -- --seco`.
  - **Pronto quando:** `npm run migrar -w @n1/api -- --seco` lista a migração nova, e depois de aplicada em homologação `select extname from pg_extension where extname = 'vector'` devolve uma linha.
  - **Atenção:** Confirmado na reunião de 19/10: banco vetorial padrão.
- [ ] **17.4.3 Gerar e guardar os embeddings** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Criar `apps/api/src/conhecimento/embeddings.ts` com `gerarEmbeddings(textos): number[][]`, falando com o fornecedor da decisão; chave numa variável de ambiente nova (por exemplo `VOYAGE_API_KEY`) documentada em `apps/api/.env.example`.
    2. Criar `apps/api/src/conhecimento/indexar.ts` com `indexarVersao(workspaceId, documento, versao)`: manda os Fragmentos em lotes de até 100, grava em `plataforma.fragmentos_indexados` e apaga as linhas das Versões anteriores do mesmo Documento (só a corrente é consultável, B98).
    3. Chamado pelo processador da 17.3 depois de `registrarProcessamentoDaVersao`, e também quando texto colado cria ou restaura Versão (essas já nascem `processado`): o processador procura Versões `processado` sem linha na tabela.
    4. Documento enviado à lixeira, arquivado ou movido de Coleção: apagar ou atualizar `colecao_id` das linhas na mesma volta.
  - **Pronto quando:** Teste de integração `indexar.test.ts` (pula sem `DATABASE_URL`, com o fornecedor trocado por um falso): restaurar a Versão 1 troca as linhas da Versão 2 pelas da Versão 3 nova.

### 17.5 Busca e citação

**Objetivo:** Hoje o ensaio pega o primeiro trecho de até três Documentos (`referenciasDoEnsaio`), sem olhar a pergunta. A Ferramenta `consultar_conhecimento` passa a buscar os trechos mais próximos da pergunta, só nas Coleções que o Agente e a pessoa podem ler, e a resposta mostra de onde veio cada trecho.

**Pronto quando:** Num Espaço com a Política de reembolso e a Tabela de preços, a pergunta “posso devolver depois de 10 dias?” traz o trecho da Política em primeiro lugar, e a citação abre o Documento nesse trecho.

- [ ] **17.5.1 Buscar por significado nas Coleções permitidas** `api`
  - **Hoje:** A Ferramenta `consultar_conhecimento` está só no catálogo (`packages/dominio/src/seed.ts:2604`). O ensaio usa `referenciasDoEnsaio` (`packages/dominio/src/operations/ia/agentes.ts:400`), que devolve o primeiro Fragmento dos três primeiros Documentos.
  - **O que fazer:**
    1. Criar `apps/api/src/conhecimento/buscar.ts` com `buscarConhecimento({ workspaceId, agentId, membroId?, pergunta, k = 6 })`.
    2. Coleções permitidas: as de `conhecimentoAcessivel(state, agentId)` (`derive-ia.ts:242`); quando uma pessoa aciona o Agente, cruzar com as Coleções que ela vê (`recusaNaColecao(..., 'ver')`), a regra de “permissão de quem aciona” da Sessão 16.1.
    3. Gerar o embedding da pergunta e consultar `plataforma.fragmentos_indexados where workspace_id = $1 and colecao_id = any($2) order by embedding <=> $3 limit $4`.
    4. Devolver os trechos e as `KnowledgeReference` (`types/ai.ts:232`) já montadas, com `fragmentIds` dos trechos usados.
    5. Ligar como executor da Ferramenta `consultar_conhecimento` no mecanismo de Ferramentas da Sessão 16.1.
  - **Pronto quando:** Teste `buscar.test.ts` (pula sem `DATABASE_URL`, embeddings falsos e determinísticos): um Agente sem Concessão na Coleção B nunca recebe trecho de B, mesmo quando é o mais próximo.
- [ ] **17.5.2 Ensaio com a busca real** `domínio`
  - **Hoje:** `ensaiarAgente` (`agentes.ts:428`) chama `referenciasDoEnsaio` (`agentes.ts:510`) e não recebe nada de fora.
  - **O que fazer:**
    1. Acrescentar ao `EnsaioInput` o campo opcional `referencias: KnowledgeReference[]`, preenchido pelo `apps/api` com o resultado de `buscarConhecimento`.
    2. Quando vier, `ensaiarAgente` usa essas referências; quando não vier, nenhuma (e não mais os primeiros trechos).
    3. Apagar `referenciasDoEnsaio`.
  - **Pronto quando:** Teste em `operations/ia/agentes.test.ts`: o ensaio grava em `contextComposition.fragmentRefs` exatamente os trechos recebidos.
- [ ] **17.5.3 Citar o trecho, não só o Documento** `web`
  - **Hoje:** O Chat (`ia/chat/[sessao]/page.tsx:355-363`) e a Execução (`ia/execucoes/[execucao]/page.tsx:267-290`) já ligam para `/ia/conhecimento/documentos/<id>`, mas sem dizer qual trecho. A lista de Fragmentos da ficha (`documento-completo.tsx:255-266`) não tem âncora.
  - **O que fazer:**
    1. Em `documento-completo.tsx`, dar a cada item de Fragmento o `id` HTML `frg-<fragmentId>` e destacar o que vier no endereço.
    2. No Chat e na Execução, o link passa a ser `/ia/conhecimento/documentos/<id>?versao=<n>#frg-<primeiro fragmentId>`, com o localizador (`pag3§2`) ao lado do título.
    3. Quando a referência tem `marker` (Documento na lixeira, Versão eliminada…), mostrar o marcador em vez do link, como a Execução já faz.
  - **Pronto quando:** Você clica na citação de uma resposta e a ficha do Documento abre rolada até o trecho, destacado.

### 17.6 Atualização das Fontes de URL

**Objetivo:** Uma Fonte de URL guarda a política “periódica a cada N horas”, mas nada roda (P16 em `docs/PENDENCIAS-FRONTEND.md:409`). Passa a existir “Atualizar agora” e uma rotina que revisita as Fontes no prazo.

**Pronto quando:** Mudar o texto da página de uma Fonte periódica de 1 hora gera, na volta seguinte, uma Versão nova com origem “atualização” no Documento.

- [ ] **17.6.1 Operação de atualizar a Fonte** `domínio`
  - **Hoje:** `adicionarFonte` (`conhecimento.ts:175`) grava `updatePolicy`, `state` e os campos `lastUpdateAt` e `lastUpdateResult` (`types/ai.ts:537-549`), que ninguém preenche. A origem `atualizacao` de Versão (`DocumentVersion.origin`) nunca é usada.
  - **O que fazer:**
    1. Criar `registrarAtualizacaoDaFonte(state, colecaoId, fonteId, resultado)`, com ator Sistema: se o texto mudou, cria a Versão N+1 com `origin.kind: atualizacao` e `processing: pendente`; se não mudou, só atualiza `lastUpdateAt`; se falhou, põe a Fonte em `comErro` com o motivo em `lastUpdateResult`.
    2. Criar `pedirAtualizacaoDaFonte(state, membroId, colecaoId, fonteId)`, registrada em `operations/registro.ts` e com esquema em `apps/api/src/rotas/esquemas/ia-conhecimento.ts`: marca a Fonte para a próxima volta (exige `editar` na Coleção).
    3. Comparar pelo `originVersionMark` (já existe no tipo): guardar ali um hash do texto capturado.
  - **Pronto quando:** Testes em `conhecimento.test.ts` para os três casos: mudou, não mudou e falhou.
- [ ] **17.6.2 Rotina que revisita as Fontes** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. No processador de Documentos da 17.3, acrescentar uma etapa: achar as Fontes `url` ativas com `updatePolicy.kind: periodica` cujo `lastUpdateAt + intervalHours` já passou, ou marcadas por `pedirAtualizacaoDaFonte`; capturar com `capturarUrl` e gravar com `registrarAtualizacaoDaFonte`.
    2. Fontes de Integração ficam de fora: nenhuma Integração real traz documentos hoje; a Fonte continua mostrando “sem sincronização” na tela.
  - **Pronto quando:** Teste de integração com relógio injetado: uma Fonte de 1 hora não roda aos 59 minutos e roda aos 61.
- [ ] **17.6.3 Botão “Atualizar agora” na Fonte** `web`
  - **Hoje:** A Coleção lista as Fontes (`apps/web/src/features/ia/conhecimento/colecao-completa.tsx`) sem nenhuma ação de atualizar.
  - **O que fazer:** Pôr “Atualizar agora” em cada Fonte de URL, chamando `pedirAtualizacaoDaFonte` pelo `run`, e mostrar `lastUpdateAt` e `lastUpdateResult`.
  - **Pronto quando:** Você clica em “Atualizar agora”, e em até um minuto a data da última atualização muda.

**A sessão fica pronta quando:** Você envia um PDF de verdade a uma Coleção concedida a um Agente, pergunta no Chat algo que só está na página 3, e a resposta cita esse Documento; o link abre o Documento já no trecho usado. Nenhum Documento novo tem `objectKey` começando com `legado/`.

---

## Sessão 18 · IA: Automações em código e Plugins

As Automações deixam de ser criadas pela tela e passam a ser rotinas escritas em código pelo time, que o Agente pode acionar. Entram também os Plugins: pacotes de Skills, Conhecimento e Automações que se instalam num Agente de uma vez. Esta sessão supõe as escolhas recomendadas no levantamento (T2.6). Fica bloqueada até a lista de Automações chegar.

**Depende de:** Sessão 14, Sessão 17.

> **Bloqueada:** Só começa com a lista de Automações (item T2.6.3 do levantamento).

> **Ajuste sugerido:** +2 dias: o tamanho depende da lista de Automações, que ainda não chegou.

**Ponto de partida:**
- Editor visual de Automações em `apps/web/src/features/ia/automacoes/editor-de-automacao.tsx` (1.310 linhas), aberto em `/ia/automacoes/[automacao]`.
- Motor no domínio (`runListAutomations`, `packages/dominio/src/operations/automations.ts:696`) que já roda as Automações do Financeiro por evento e por horário.
- A aba “Plugins” (`apps/web/src/features/ia/personalizar/secoes.ts:19`) só lista as Ferramentas; não existe tipo Plugin.

### 18.1 Tirar o editor visual

**Objetivo:** Na reunião de 19/10 ficou decidido que Automação não se cria pela tela. O editor sai, sem parar o que já roda.

**Pronto quando:** Não há como criar ou editar Automação pela tela, e as do Financeiro continuam disparando.

- [ ] **18.1.1 Tirar o editor e os botões de criar e editar** `web`
  - **Hoje:** O editor existe em `apps/web/src/features/ia/automacoes/editor-de-automacao.tsx`, com rota em `/ia/automacoes/[automacao]` e botão de criar na lista de IA › Personalizar › Automação.
  - **O que fazer:**
    1. Apagar o editor e a rota de edição.
    2. Manter a lista em IA › Personalizar › Automação, só de leitura: nome, o que faz, quando roda e a última execução.
  - **Pronto quando:** A lista abre, sem botão de criar nem de editar.
- [ ] **18.1.2 Manter as Automações do Financeiro rodando** `domínio`
  - **Hoje:** As Automações do Financeiro são registros em `plataforma.registros`, rodados por `runListAutomations` e pelo agendador (`apps/api/src/automacoes/scheduler-worker.ts`).
  - **O que fazer:**
    1. Não mexer no motor nesta sessão.
    2. Tirar do domínio as operações do editor que ficam sem uso (`packages/dominio/src/operations/ia/automacoes-editor.ts`), mantendo as que o motor usa.
  - **Pronto quando:** Uma Solicitação de pagamento nova continua disparando as Automações do Financeiro em homologação.

### 18.2 Catálogo de Automações em código

**Objetivo:** Ter um lugar no código onde cada Automação nova é escrita, descrita para o Agente e registrada.

**Pronto quando:** Uma Automação de exemplo no catálogo roda por horário e aparece na lista.

- [ ] **18.2.1 Criar o formato do catálogo** `domínio`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Criar `packages/dominio/src/automacoes/catalogo/`, com um arquivo por Automação.
    2. Cada arquivo diz: id, nome, descrição (que o Agente lê), parâmetros com tipos, efeito (leitura, escrita ou externo), gatilho opcional (evento ou horário) e a função que executa.
    3. Cada execução gera um registro de Execução de Automação, como hoje.
  - **Pronto quando:** Teste da Automação de exemplo.
- [ ] **18.2.2 Rodar as Automações com gatilho** `api`
  - **Hoje:** O agendador só conhece as Automações gravadas no banco.
  - **O que fazer:** O agendador e o motor de eventos passam a rodar também as Automações do catálogo que têm gatilho.
  - **Pronto quando:** A Automação de exemplo roda sozinha no horário marcado.

### 18.3 O Agente aciona Automações

**Objetivo:** Na reunião de 19/10 ficou decidido que o Agente consegue acessar as Automações. Cada Automação do catálogo vira um poder que o Agente pode receber.

**Pronto quando:** No Chat, o Agente aciona a Automação de exemplo e a Execução aparece registrada.

- [ ] **18.3.1 Transformar cada Automação em Ferramenta do Agente** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Cada Automação do catálogo vira uma Ferramenta com o nome, a descrição e os parâmetros dela.
    2. O Agente só vê as Automações que recebeu como poder no Construtor (Sessão 14).
    3. Automação de efeito externo passa pela aprovação da Sessão 14.
  - **Pronto quando:** Teste: o Agente sem o poder não vê a Automação; com o poder, aciona e a Execução é registrada.

### 18.4 Implementar as Automações da lista

**Objetivo:** Escrever no catálogo as Automações que você listar. Esta tarefa ganha uma subtarefa por Automação quando a lista chegar.

**Pronto quando:** Todas as Automações da lista no catálogo, cada uma com teste.

- [ ] **18.4.1 Escrever cada Automação da lista no catálogo** `domínio` `api`
  - **Hoje:** A lista ainda não chegou (item T2.6.3 do levantamento).
  - **O que fazer:** Uma subtarefa por Automação, criada quando a lista chegar, no padrão da 18.2.
  - **Pronto quando:** Cada Automação com teste e aparecendo na lista.
  - **Atenção:** Bloqueada até a lista chegar.

### 18.5 Plugins

**Objetivo:** Um Plugin junta Skills, Conhecimento e Automações e se instala num Agente de uma vez.

**Pronto quando:** Instalar um Plugin num Agente faz aparecer na ficha dele, de uma vez, as Skills, as Coleções e as Automações do Plugin.

- [ ] **18.5.1 Criar o tipo Plugin no domínio** `domínio`
  - **Hoje:** Não existe tipo Plugin; “Plugins” é só o nome da aba que lista Ferramentas.
  - **O que fazer:**
    1. Criar `Plugin` em `packages/dominio/src/types/ai.ts`: nome, descrição, Skills, Coleções de Conhecimento e Automações do catálogo.
    2. Operações: criar, editar, arquivar, instalar num Agente e desinstalar.
    3. Instalar concede as Skills, o acesso às Coleções e o acionamento das Automações. Desinstalar retira só o que veio do Plugin, sem mexer no que o Agente já tinha.
  - **Pronto quando:** Testes de instalar e desinstalar, incluindo um Agente que já tinha uma das Skills.
- [ ] **18.5.2 Telas de Plugins** `web`
  - **Hoje:** A aba “Plugins” (`apps/web/src/features/ia/personalizar/secoes.ts:19`) lista Ferramentas.
  - **O que fazer:**
    1. A aba atual passa a se chamar “Ferramentas”.
    2. Nova aba “Plugins”, com a lista de pacotes e a tela de montar um Plugin escolhendo Skills, Coleções e Automações.
    3. No Construtor (Sessão 14), o passo Plugins instala e desinstala.
  - **Pronto quando:** Você monta um Plugin pela tela e o instala num Agente.
- [ ] **18.5.3 Quem pode criar um Plugin?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** Não existe Plugin.
  - **Você decide:**
    - (A) Administrador, pela tela, juntando Skills, Coleções e Automações que já existem
    - (B) Só o time, no código
  - **O que muda depois:** (A) é a tela da tarefa anterior. (B) tira a tela de montar e deixa só a de instalar.
  - **Recomendo:** (A): o Plugin só junta peças que já existem, então não há risco de criar algo que o time não escreveu.

**A sessão fica pronta quando:** Ninguém cria Automação pela tela; as do Financeiro continuam rodando; o Agente aciona uma Automação do catálogo; um Plugin instalado num Agente traz as Skills, o Conhecimento e as Automações dele.

---

## Sessão 19 · Saída do protótipo: LGPD, rotinas e dados reais

O que separa o protótipo do produto em produção. As rotinas de limpeza da lixeira e de recorrência só rodam nas Listas que, por acaso, têm uma Automação de vencimento; só Tarefa expira na lixeira; não há como exportar nem anonimizar os dados de um Contato; a porta fictícia `/login` e vários avisos de “protótipo” continuam na tela; e o teste no navegador cobre só a tela de entrar e o formulário público.

**Depende de:** Sessão 1, Sessão 3, Sessão 18.

> **Ajuste sugerido:** +2 dias: rotinas em todas as Listas, lixeira do CRM com coluna nova, LGPD e testes no navegador.

**Ponto de partida:**
- Expurgo da lixeira (`purgeExpiredTasks`, `packages/dominio/src/operations/tasks.ts:780`) e recorrência por calendário (`runCalendarRecurrences`, `packages/dominio/src/operations/collaboration.ts:546`) já existem e rodam no `agendaDoDia` do agendador (`apps/api/src/automacoes/scheduler-worker.ts:184`).
- Produção já nasce sem dados de demonstração: `bootstrap:gestao` (`packages/dominio/src/bootstrap-gestao.ts`) parte de um estado vazio e aplica só os processos do Financeiro.
- As rotas públicas `/f/<segredo>` e `/p/<segredo>` já leem do servidor (`GET /v1/public/forms/:secret` e `GET /v1/public/tasks/:secret`); o `apps/web/CONTEXT.md:39-41` ainda diz o contrário.
- A tabela `plataforma.mensagens` (008) já tem as colunas `anonimizada` e `carga_bruta`, e uma regra que aceita mensagem anonimizada sem conteúdo.
- 7 testes ponta a ponta na API (`apps/api/src/e2e/`) e 3 testes Playwright na web (`apps/web/e2e/fumaca.spec.ts` e `formulario-publico.spec.ts`), fora do CI.

### 19.1 Rotinas diárias em todas as Listas

**Objetivo:** Hoje o agendador só visita as Listas que têm uma Automação ativa com gatilho de vencimento; numa Lista comum, a lixeira nunca esvazia e a recorrência por calendário nunca cria a próxima Tarefa. A manutenção passa a ser uma rotina própria, que visita todas as Listas uma vez por dia.

**Pronto quando:** Numa Lista sem nenhuma Automação, uma Tarefa na lixeira há 31 dias é eliminada e a Tarefa recorrente de amanhã é criada, sem ninguém abrir a tela.

- [ ] **19.1.1 Separar a manutenção da agenda de Automações** `domínio` `api`
  - **Hoje:** `agendaDoDia` (`scheduler-worker.ts:184-197`) roda Automações, recorrência e expurgo juntos, mas só para os pares de `catalogoDeListasComAgenda` (`scheduler-worker.ts:278-303`): Listas com Automação ativa de escopo Lista e Versão publicada com gatilho `condicaoTemporal`. `semear` (`scheduler-worker.ts:413`) semeia só esses pares. As duas operações exigem administrar a Lista (`containerAdminRefusal`).
  - **O que fazer:**
    1. Criar `packages/dominio/src/operations/manutencao.ts` com `manutencaoDoDia(state, dia)`, ator Sistema: percorre todas as Listas ativas do Espaço e chama o miolo de `runCalendarRecurrences` e de `purgeExpiredTasks` sem a checagem de administrador (a checagem fica só nas versões chamadas por pessoa). Não registrar em `operations/registro.ts`.
    2. Criar `apps/api/src/rotinas/manutencao-diaria.ts`: uma vez por dia civil e por Espaço de Trabalho, hidrata, chama `manutencaoDoDia` dentro de `executar()` e grava que rodou.
    3. Migração nova com `plataforma.rotinas_do_dia (workspace_id, rotina, dia_civil, iniciada_em, concluida_em, erro)`, chave `(workspace_id, rotina, dia_civil)`, para não rodar duas vezes com dois processos.
    4. Tirar `runCalendarRecurrences` e `purgeExpiredTasks` de `agendaDoDia`, que volta a cuidar só de Automações.
    5. Ligar a rotina em `apps/api/src/index.ts`, ao lado do agendador.
  - **Pronto quando:** Teste `manutencao-diaria.test.ts` (pula sem `DATABASE_URL`): uma Lista sem Automação, com uma Tarefa na lixeira há 31 dias e uma recorrência vencida, termina a volta sem a Tarefa e com a ocorrência nova; rodar duas vezes no mesmo dia não duplica nada.
- [ ] **19.1.2 Quais famílias expiram na lixeira?** `decisão` · *muda o produto*
  - **Como é hoje:** Só Tarefa expira (`previsaoDeEliminacao`, `tasks.ts:768`). Documento, Agente, Automação, Pasta, Lista e, no CRM, Contato, Empresa, Negócio, Funil e Conversa ficam na lixeira para sempre.
  - **Você decide:**
    - (A) Tarefa e as entidades do CRM (Contato, Empresa, Negócio, Funil, Conversa)
    - (B) Todas as famílias que têm lixeira
  - **O que muda depois:** (A) é a subtarefa seguinte. (B) soma cerca de 1 dia para Documento, Agente, Automação, Pasta e Lista.
  - **Recomendo:** (A) agora: é onde há dado pessoal. (B) depois.
- [ ] **19.1.3 Expirar as entidades do CRM na lixeira** `banco` `api` `domínio`
  - **Hoje:** As tabelas do CRM têm `estado = 'na_lixeira'` (`apps/api/migracoes/007-crm.sql:72`, `:148`, `:326`, `:422`; `plataforma.conversas` na `008:104`), mas nenhuma guarda quando entrou na lixeira. `excluirPermanentemente` do Contato (`apps/api/src/servicos/crm/contatos.ts:424`) recusa quando há Negócio ou Conversa.
  - **O que fazer:**
    1. Migração nova: coluna `na_lixeira_em timestamptz` em `plataforma.contatos`, `empresas`, `negocios`, `funis` e `conversas`, preenchida com `atualizado_em` para quem já está na lixeira.
    2. Nos repositórios de `apps/api/src/repositorios/crm/` (`definirEstado`, `contatos.ts:299`, e os equivalentes), gravar `na_lixeira_em = now()` ao entrar e `null` ao sair.
    3. No domínio, criar a função pura `vencidoNaLixeira(naLixeiraEm, retentionDays, hoje)` ao lado de `previsaoDeEliminacao` e usar nas duas.
    4. Na rotina diária, excluir o que venceu pelos mesmos serviços de `apps/api/src/servicos/crm/` (respeitando as recusas). Contato vencido que não pode ser excluído por ter Conversa é anonimizado (19.2).
  - **Pronto quando:** Teste de integração: um Negócio na lixeira há 31 dias some na volta da rotina; um Contato com Conversa vencido fica anonimizado, com a Conversa preservada.
- [ ] **19.1.4 Conferir a saúde dos Canais conectados** `api`
  - **Hoje:** Nada confere se um Canal `conectada` continua conectado; a queda só aparece quando uma mensagem falha.
  - **O que fazer:**
    1. Na rotina, a cada hora, chamar o estado da conexão de cada Canal `conectada` pela interface de provedor da Sessão 2.3 e, se caiu, gravar `desconectada` em `plataforma.canais.conexao` e avisar o dono do Canal.
    2. As sincronizações de Grupos (6.3), modelos de mensagem (7.3) e Fontes (17.6) ficam nas sessões delas; aqui não se repete.
  - **Pronto quando:** Teste com um provedor falso que responde “desconectado”: o Canal muda de estado e o aviso nasce.

### 19.2 LGPD: exportar e anonimizar um Contato

**Objetivo:** Hoje não há como atender a um pedido de dados pessoais: nada exporta o que existe de um Contato, e a exclusão permanente é recusada quando ele tem Conversa. Um Administrador passa a exportar tudo do Contato num arquivo e a anonimizá-lo, apagando os dados pessoais dele e das mensagens, sem perder as contagens.

**Pronto quando:** Pela ficha do Contato, um Administrador baixa o arquivo com os dados e depois anonimiza o Contato; a Conversa continua na Caixa de Entrada como “Contato anonimizado”, sem texto, e os Painéis contam a mesma quantidade de mensagens.

- [ ] **19.2.1 Exportar os dados de um Contato** `domínio` `api` `web`
  - **Hoje:** Não existe. As rotas do Contato (`apps/api/src/rotas/crm/contatos.ts:108-161`) vão de listar a excluir permanentemente.
  - **O que fazer:**
    1. No domínio, criar o tipo `ExportacaoDeContato` e a função pura `montarExportacaoDoContato(...)` em `packages/dominio/src/operations/lgpd.ts`, com a lista fechada do que entra.
    2. Criar `GET /contatos/:id/exportacao` em `apps/api/src/rotas/crm/contatos.ts` e o serviço `exportarDadosDoContato` em `apps/api/src/servicos/crm/contatos.ts`, só para Administrador.
    3. O serviço junta: a linha de `plataforma.contatos`, `contato_identificadores`, `contato_empresa`, os Negócios em que ele está, as Conversas e Mensagens dele (texto, data, Canal e o link assinado de cada anexo), e as Tarefas com Vínculo a ele em `plataforma.registros`.
    4. Devolver JSON como download (`Content-Disposition: attachment`) e registrar na Atividade quem exportou e quando.
    5. Na ficha do Contato (`apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx`), botão “Exportar dados (LGPD)”, visível só para Administrador.
  - **Pronto quando:** Teste do serviço em `contatos.test.ts`: o arquivo de um Contato com uma Conversa de 3 mensagens traz as 3 mensagens e os identificadores; um Membro comum recebe 403.
- [ ] **19.2.2 Anonimizar um Contato** `domínio` `api` `web`
  - **Hoje:** Não existe. `excluirPermanentemente` recusa Contato com Conversa (`apps/api/src/servicos/crm/contatos.ts:441-449`). A 008 já preparou `plataforma.mensagens.anonimizada` e o aviso de que `carga_bruta` precisa ser zerada (`008-canais-conversas-mensagens.sql:131`).
  - **O que fazer:**
    1. No domínio (`operations/lgpd.ts`), escrever a regra do que se apaga e do que fica: apaga nome, sobrenome, nascimento, foto, descrição, endereços, campos adicionais e identificadores; fica o id, a Origem, a Qualificação, as datas e os vínculos com Negócio e Conversa.
    2. Criar `POST /contatos/:id/anonimizar` e o serviço `anonimizarContato`, numa transação: limpar as colunas pessoais de `plataforma.contatos` e gravar o nome “Contato anonimizado”; apagar as linhas de `contato_identificadores`; em `plataforma.mensagens` do Contato, gravar `conteudo = null`, `anexos = '[]'`, `carga_bruta = null`, `remetente_externo = null` e `anonimizada = true`; apagar do bucket os objetos dos anexos.
    3. Uma migração nova acrescenta `anonimizado_em` em `plataforma.contatos`, para a tela e para a exportação saberem.
    4. Na ficha, botão “Anonimizar (LGPD)” com confirmação que exige digitar o nome do Contato; depois disso a ficha fica só leitura.
  - **Pronto quando:** Teste em `apps/api/src/e2e/` (pula sem `DATABASE_URL`): depois de anonimizar, `select count(*) from plataforma.mensagens where conteudo is not null and conversa_id in (<conversas do Contato>)` devolve 0, e a contagem total de mensagens não muda.
- [ ] **19.2.3 Por quanto tempo guardar as mensagens?** `decisão` · *muda o produto*
  - **Como é hoje:** Sem prazo: mensagem nunca é apagada. O prazo dos registros de Execução da IA é decidido na T.4.
  - **Você decide:**
    - (A) 1 ano
    - (B) 5 anos
    - (C) Para sempre, só anonimizando sob pedido
  - **O que muda depois:** Com (A) ou (B), a rotina diária da 19.1 anonimiza as mensagens que passarem do prazo (cerca de meio dia a mais). Com (C), nada muda.
  - **Recomendo:** (B): cobre prazos de cobrança e disputa comercial.
- [ ] **19.2.4 Aplicar os prazos de guarda** `api`
  - **Hoje:** Não existe.
  - **O que fazer:** Na rotina diária da 19.1, anonimizar as mensagens mais velhas que o prazo decidido acima e apagar as Execuções de IA mais velhas que o prazo da T.4 (coleções `agentExecutions` e `automationExecutions` em `plataforma.registros`).
  - **Pronto quando:** Teste com relógio injetado: uma mensagem um dia além do prazo é anonimizada; uma um dia antes, não.

### 19.3 Tirar o protótipo da tela

**Objetivo:** Uma pessoa que usa o produto ainda encontra a porta fictícia `/login` (“qualquer usuário e senha entram”) e frases como “neste protótipo”. Tudo isso sai, e a documentação para de dizer que as rotas públicas estão em memória.

**Pronto quando:** `/login` responde 404, `grep -rni 'protótipo' apps/web/src --include=*.tsx` só acha comentários de código, e você aprova a revisão final.

- [ ] **19.3.1 Apagar a porta fictícia `/login`** `web`
  - **Hoje:** `apps/web/src/app/login/page.tsx` aceita qualquer usuário e senha (aviso na linha 85). A porta real é `/entrar` (`apps/web/src/app/entrar/page.tsx`), e o `proxy.ts` (`apps/web/src/proxy.ts:17`) nem lista `/login` como pública.
  - **O que fazer:** Apagar a pasta `apps/web/src/app/login/` e o CSS dela (`.login-marca` em `componentes.css`, se só ela usar).
  - **Pronto quando:** Teste novo em `apps/web/e2e/fumaca.spec.ts`: sem sessão, `/login` leva a `/entrar`; com sessão, dá 404.
- [ ] **19.3.2 Trocar os avisos de protótipo** `web`
  - **Hoje:** Avisos na tela: descrição do site (`apps/web/src/app/layout.tsx:18`); Chat (`ia/chat/[sessao]/page.tsx:221`); chamada de vídeo (`crm/reunioes/[reuniao]/page.tsx:375`); Minha conta (`minha-conta/page.tsx:212`); Lixeira (`configuracoes/lixeira/page.tsx:325`); anexar e gravar no Construtor (`features/ia/agent-builder/chat-composer.tsx:36` e `:64`); Automações (`features/ia/rotulos.ts:53-54`, `automacao-spec.ts:298-322`, `:411`, `:506`, `editor-de-automacao.tsx:334`, `:1120`); Conhecimento (`adicionar-documento-dialog.tsx:160`, `colecao-completa.tsx:629`).
  - **O que fazer:**
    1. Para cada aviso: se a função ficou pronta numa sessão anterior (Chat na 11, Automações na 15, Conhecimento na 14), apagar; se não ficou, trocar por texto de produto (por exemplo “Em breve”) e esconder o botão.
    2. `layout.tsx`: descrição “Plataforma de trabalho, CRM e IA”.
  - **Pronto quando:** O `grep` do pronto da tarefa só acha comentários.
- [ ] **19.3.3 Corrigir a documentação das rotas públicas** `web`
  - **Hoje:** `apps/web/CONTEXT.md:39-41` diz que `/f` e `/p` “continuam em memória, com o seed do produto”, mas as duas páginas já são Server Components que chamam o `apps/api` por `transportePublico` (`apps/web/src/app/(publico)/f/[segredo]/page.tsx` e `(publico)/p/[segredo]/page.tsx`).
  - **O que fazer:** Reescrever o trecho de `apps/web/CONTEXT.md` e conferir o mesmo erro no `CONTEXT.md` da raiz (“`store.ts` ainda monta o seed”).
  - **Pronto quando:** Os dois `CONTEXT.md` descrevem o que o código faz.
- [ ] **19.3.4 Tirar o seed de demonstração do caminho de produção** `domínio`
  - **Hoje:** `buildSeed()` (`packages/dominio/src/seed.ts:118`) e `buildProductSeed()` (`seed-produto.ts:18`) não são mais usados pela tela nem pela API em produção, mas `seed.ts` também exporta o catálogo real (`TOOLS`, `MODELOS_DA_PLATAFORMA`), importado por `bootstrap-gestao.ts:21`. Cerca de 156 arquivos de teste usam `buildSeed`.
  - **O que fazer:**
    1. Mover o catálogo para `packages/dominio/src/catalogo-da-plataforma.ts`.
    2. Mover `seed.ts`, `seed-produto.ts`, `seed-comercial.ts`, `seed-pos-venda.ts` e `seed-ferramentas.ts` para `packages/dominio/src/testes/` e tirá-los do `exports` de `packages/dominio/package.json`, deixando só para os testes.
    3. `MEUS_NEGOCIOS_ID`, importado pela tela de `@n1/dominio/seed-comercial` (`apps/web/src/app/(shell)/crm/meus-negocios/page.tsx:13`), vira constante de produto num arquivo próprio.
    4. Manter `seed-financeiro.ts` e `seed-contas-a-receber.ts`: são os processos reais que o `bootstrap:gestao` aplica.
  - **Pronto quando:** `grep -rn '@n1/dominio/seed' apps/web/src apps/api/src | grep -v test` só acha `seed-financeiro` e `seed-contas-a-receber`, e `npm run check` passa.

### 19.4 Testes no navegador dos fluxos principais

**Objetivo:** Hoje o Playwright abre a tela de entrar e o formulário público, e nem roda no CI (`.github/workflows/check.yml` só roda `npm run check` e `npm run test`). Passam a existir testes dos cinco fluxos principais, rodando no CI contra homologação.

**Pronto quando:** O CI tem um passo de Playwright verde com os cinco fluxos, e um teste quebrado de propósito deixa o passo vermelho.

- [ ] **19.4.1 Usuário de teste e login no Playwright** `web` `infra`
  - **Hoje:** `apps/web/playwright.config.ts` sobe `next start` local e nenhum teste faz login. Homologação nasce na Sessão 1.6.
  - **O que fazer:**
    1. Criar em homologação um usuário de teste do Supabase, com senha nos segredos do GitHub (`E2E_EMAIL`, `E2E_SENHA`).
    2. Criar `apps/web/e2e/autenticar.setup.ts`, que entra por `/entrar` e guarda a sessão (`storageState`) para os outros testes; ligar como projeto de setup em `playwright.config.ts`, usando `E2E_BASE_URL` de homologação.
  - **Pronto quando:** Rodar `npm run test:e2e -w @n1/web` com `E2E_BASE_URL` de homologação passa o setup.
- [ ] **19.4.2 Escrever os cinco fluxos** `web`
  - **Hoje:** Só `fumaca.spec.ts` (1 teste) e `formulario-publico.spec.ts` (2 testes).
  - **O que fazer:**
    1. `e2e/tarefa.spec.ts`: criar Tarefa, mudar Status, comentar, anexar arquivo.
    2. `e2e/caixa-de-entrada.spec.ts`: abrir uma Conversa de teste, responder, ver a mensagem no fio.
    3. `e2e/chat.spec.ts`: perguntar ao Agente e ver a resposta chegar (modelo de homologação).
    4. `e2e/superadmin.spec.ts`: convidar um usuário e dar acesso a um módulo (Sessão 12).
    5. `e2e/entrar.spec.ts`: entrar, sair e ser levado a `/entrar` ao abrir uma página protegida.
  - **Pronto quando:** Os cinco arquivos passam contra homologação.
- [ ] **19.4.3 Rodar no CI** `infra`
  - **Hoje:** `.github/workflows/check.yml` não instala navegador nem roda Playwright.
  - **O que fazer:** Criar o job `e2e` em `.github/workflows/check.yml`, depois do `check`: `npx playwright install --with-deps chromium` e `npm run test:e2e -w @n1/web`, com os segredos de homologação.
  - **Pronto quando:** Um pull request mostra o job `e2e` verde.

**A sessão fica pronta quando:** Em produção: uma Lista sem Automação expurga a lixeira e cria as recorrências do dia; um Contato enviado à lixeira some depois do prazo; um Administrador exporta e anonimiza um Contato pela ficha; `/login` dá 404; e o CI roda os testes de navegador dos fluxos principais contra homologação.

---

## Sessão 20 · Painel

Por último porque o Painel lê dados de todo o resto. Hoje o modelo é rico, mas as telas são só leitura dos 4 Painéis de demonstração, não existe operação de criar ou editar, a leitura só conhece 4 das 11 fontes e 2 das 8 contas (contar e somar), ignora o período e a posição dos Widgets, e lê o CRM antigo, que a Sessão 3 tira do código. Um dia para desenhar com você e o resto para construir.

**Depende de:** Sessão 3, Sessão 19.

> **Ajuste sugerido:** +1 dia: leitura dos Painéis no servidor, com as 8 contas e o período.

**Ponto de partida:**
- Tipos em `packages/dominio/src/types/panels.ts`: `Panel` (`panels.ts:137`), `Widget` (`panels.ts:103`), 11 fontes (`DataSourceTarget`, `panels.ts:9`), 9 tipos de visualização (`DataViewType`, `panels.ts:23`) e 8 contas (`Aggregation`, `panels.ts:60`).
- A leitura `widgetReading` (`packages/dominio/src/derive.ts:592`) confere se quem olha alcança o escopo e devolve número, valor por moeda, série ou “sem acesso”; `recordsOfTarget` (`derive.ts:734-764`) só conhece `deal`, `conversation`, `task` e `contact`.
- Telas `apps/web/src/app/(shell)/paineis/page.tsx` e `paineis/[painel]/page.tsx`; gráficos `Barras`, `Colunas`, `Funil` e `Rosca` em `apps/web/src/features/paineis/graficos.tsx`.
- Os 4 Painéis (SDR, Closer, Atendimento, Operações) existem só no seed de demonstração (`packages/dominio/src/seed.ts:1953-1982`); produção não tem nenhum.

### 20.1 Desenhar com você

**Objetivo:** Sem saber quem olha e o que precisa ver, a sessão constrói fontes e gráficos que ninguém usa. Fechar no primeiro dia o primeiro Painel real e como ele é montado.

**Pronto quando:** Um esboço aprovado por você, com a lista de Widgets (título, fonte, conta, dimensão, período e gráfico).

- [ ] **20.1.1 O que o primeiro Painel mostra e para quem?** `decisão` · *muda o produto*
  - **Como é hoje:** Quatro Painéis de demonstração (SDR, Closer, Atendimento, Operações), só leitura, que não existem em produção.
  - **Você decide:**
    - (A) Um Painel de gestão: vendas (Negócios por Etapa, valor ganho no mês) e atendimento (Conversas abertas por Fila, tempo de primeira resposta)
    - (B) Um Painel por pessoa: as minhas Tarefas, os meus Negócios e as minhas Conversas
    - (C) Os dois
  - **O que muda depois:** Define quais fontes de dados e gráficos a 20.3 e a 20.4 constroem primeiro. (C) soma cerca de 1 dia.
  - **Recomendo:** (A).
- [ ] **20.1.2 Como se posicionam os Widgets?** `decisão` · *arrumação: pode seguir a recomendação*
  - **Como é hoje:** O Painel guarda `layout` com x, y, largura e altura por Widget (`LayoutCell`, `panels.ts:121`), mas a tela ignora e põe os Widgets numa grade fixa (`paineis/[painel]/page.tsx:112` e `:125`).
  - **Você decide:**
    - (A) Grade de 12 colunas com larguras fixas (um terço, metade, inteira) e ordem por arrastar na lista
    - (B) Arrastar e redimensionar livre, como no ClickUp
  - **O que muda depois:** (A) cabe na sessão. (B) soma cerca de 1 dia e uma biblioteca de grade.
  - **Recomendo:** (A).

### 20.2 Criar e editar Painel no domínio

**Objetivo:** Não existe nenhuma operação de Painel: o único lugar que grava em `state.panels` é a transferência de dono ao remover um Membro (`operations/members.ts:246`). Passam a existir as operações de criar, editar, arquivar e montar Widgets, com as regras do documento 21.

**Pronto quando:** Testes cobrem criar, editar, arquivar e montar Widgets, e as recusas por permissão e por Widget inválido.

- [ ] **20.2.1 Operações de Painel e Widget** `domínio` `api`
  - **Hoje:** Não existem; `docs/PENDENCIAS-FRONTEND.md:383` lista Painel e Widget entre o que continua sem criação.
  - **O que fazer:**
    1. Criar `packages/dominio/src/operations/paineis.ts` com `criarPainel`, `editarPainel` (nome, descrição, âncora), `arquivarPainel`, `restaurarPainel`, `enviarPainelALixeira`, `adicionarWidget`, `editarWidget`, `removerWidget` e `posicionarWidgets` (grava `layout`).
    2. Regras: o dono é sempre um Membro (A7); só o dono ou um Administrador edita; `texto` não tem Fonte e os outros têm exatamente uma (INV-PAI-03); a conta só usa atributo da entidade-alvo (RN-PAI-08); um Widget por célula de `layout`.
    3. Registrar todas em `operations/registro.ts` e criar `apps/api/src/rotas/esquemas/paineis.ts` com os esquemas de argumento.
  - **Pronto quando:** Testes em `operations/paineis.test.ts`, incluindo a recusa de um Membro que não é dono nem Administrador.
- [ ] **20.2.2 Validar o Widget por quem olha** `domínio`
  - **Hoje:** `WidgetValidity` (`panels.ts:148`) existe, mas nada o calcula.
  - **O que fazer:** Criar `validadeDoWidget(state, widget)` em `derive.ts`: Fonte eliminada, Funil ou Lista arquivados, atributo que não existe mais; a tela mostra a causa no lugar do gráfico (RN-PAI-20).
  - **Pronto quando:** Teste: arquivar o Funil de um Widget o deixa inválido com a causa “Funil arquivado”.

### 20.3 Leitura com dados reais

**Objetivo:** A leitura de hoje só conta e soma, ignora o período, devolve vazio para 7 das 11 fontes e lê `state.deals`, `state.contacts` e `state.conversations`, o modelo antigo que a Sessão 3 apaga. Ela passa a ser feita no servidor, por uma rota própria, com a regra de conta no domínio e a busca dos registros nas tabelas novas.

**Pronto quando:** O Widget “Negócios por Etapa” do Painel de gestão mostra os mesmos números da tela do Funil, e muda quando um Negócio muda de Etapa.

- [ ] **20.3.1 Separar o plano da leitura do cálculo** `domínio`
  - **Hoje:** `widgetReading` (`derive.ts:592`) faz tudo junto sobre o `DataState`: escolhe os registros (`recordsOfTarget`, `derive.ts:734`), filtra, agrupa e soma.
  - **O que fazer:**
    1. Criar em `packages/dominio/src/paineis/leitura.ts` duas funções puras: `planoDaLeitura(state, widget, membroId, agora)`, que devolve alvo, escopos, filtros fixos, período resolvido (por exemplo `esteMes` vira datas) e a conta, ou “sem acesso”; e `calcularLeitura(plano, linhas)`, que recebe as linhas já buscadas e devolve o `WidgetReading`.
    2. `calcularLeitura` implementa as 8 contas de `Aggregation`: contagem, soma, média, mínimo, máximo, taxa, duração e percentual (hoje `valueOf`, `derive.ts:679-689`, só trata contagem e soma de `value` e `estimate`).
    3. Aplicar o `period` do Widget, que hoje nem entra no tipo aceito por `widgetReading` (`derive.ts:594-611`).
    4. Manter a regra de moedas (RN-PAI-13) que já existe em `derive.ts:653-675`.
  - **Pronto quando:** Testes em `paineis/leitura.test.ts` para cada conta e para `esteMes`, com linhas montadas no teste.
  - **Atenção:** A Sessão 3 (tarefa 3.4) deixa uma ponte para o Painel ler as tabelas novas pela tela. Esta tarefa substitui a ponte pela leitura no servidor.
- [ ] **20.3.2 Buscar os registros de cada fonte** `api`
  - **Hoje:** Não existe; os Painéis vêm inteiros no `GET /estado` e são lidos na tela.
  - **O que fazer:**
    1. Criar `apps/api/src/servicos/paineis/linhas.ts` com uma função por fonte: `deal` em `plataforma.negocios`, `contact` em `plataforma.contatos`, `company` em `plataforma.empresas`, `conversation` em `plataforma.conversas`, `message` em `plataforma.mensagens`; `task`, `agentExecution`, `automationExecution`, `approvalRequest`, `activityRecord` e `knowledgeDocument` do `DataState` hidratado.
    2. Filtrar por quem olha, registro a registro: Tarefa por `memberSeesTask`, Negócio e Contato pela regra de acesso das rotas do CRM (`apps/api/src/servicos/crm/acesso.ts`). Hoje `widgetReading` só confere o escopo, e um escopo `workspace` devolve todas as Tarefas, mesmo as que a pessoa não vê.
    3. Fazer as contas simples no SQL (`count`, `sum` com `group by`) quando a fonte é tabela, para não trazer milhares de linhas.
  - **Pronto quando:** Teste de integração (pula sem `DATABASE_URL`): dois Membros com acessos diferentes recebem números diferentes no mesmo Widget de Tarefas.
- [ ] **20.3.3 Rota de leitura do Painel** `api`
  - **Hoje:** Não existe.
  - **O que fazer:**
    1. Criar `apps/api/src/rotas/paineis.ts` com `GET /paineis/:id/leituras`: hidrata, monta o plano de cada Widget, busca as linhas e devolve `{ widgetId, leitura, validade, momento }` para cada um (o `DataReferenceMoment`, `panels.ts:156`).
    2. Registrar em `apps/api/src/app.ts`.
  - **Pronto quando:** Teste da rota: um Painel com 3 Widgets devolve 3 leituras, e um Widget de Funil que a pessoa não vê devolve “sem acesso”, não zero.

### 20.4 Telas do Painel

**Objetivo:** A tela só lê os Painéis do seed, põe todo Widget que não é número, funil ou pizza em barras, e ignora a posição guardada. Passa a ter editor, os gráficos que faltam e a grade decidida na 20.1.

**Pronto quando:** Você monta pela tela o Painel desenhado na 20.1, do zero, e ele fica igual ao esboço.

- [ ] **20.4.1 Ler da rota nova** `web`
  - **Hoje:** `paineis/[painel]/page.tsx:69` chama `widgetReading` na tela, sobre o `DataState` do store.
  - **O que fazer:** Criar `apps/web/src/dados/paineis.ts` com `lerPainel(id)`, chamando `GET /paineis/:id/leituras` com o JWT, e trocar a página para usá-la, com estado de carregando por Widget.
  - **Pronto quando:** A página do Painel faz uma requisição a `/paineis/:id/leituras` e mostra os mesmos números de antes no Espaço de homologação.
- [ ] **20.4.2 Editor de Painel** `web`
  - **Hoje:** Não existe. `paineis/page.tsx` lista os Painéis sem botão de criar.
  - **O que fazer:**
    1. Em `paineis/page.tsx`, botão “Novo Painel” (nome, descrição, âncora opcional) chamando `criarPainel`.
    2. No Painel, modo “Editar”: “Adicionar Widget” abre um diálogo novo `apps/web/src/features/paineis/widget-dialog.tsx` com Fonte, escopo, conta, dimensão, filtros fixos, período e tipo de gráfico, com prévia da leitura.
    3. Posicionar conforme a decisão da 20.1, gravando por `posicionarWidgets`; a página passa a respeitar `layout`.
  - **Pronto quando:** Você cria o Painel, adiciona quatro Widgets, troca a ordem, recarrega e tudo continua no lugar.
- [ ] **20.4.3 Gráficos que faltam** `web`
  - **Hoje:** Na leitura em série, `paineis/[painel]/page.tsx:342-347` desenha `Funil` para `funil`, `Rosca` para `pizza` e `Barras` para todo o resto: `linhas`, `tabela`, `listaDeRegistros` e `calendario` aparecem como barras.
  - **O que fazer:**
    1. Criar em `apps/web/src/features/paineis/graficos.tsx` os componentes `Linhas` (série no tempo), `Tabela` (linhas e colunas com total) e `ListaDeRegistros` (registros com os `displayedAttributes`, ligando à ficha).
    2. `calendario`: decidir na 20.1 se entra; se não entrar, tirar do diálogo de Widget.
  - **Pronto quando:** Um Widget de cada tipo aparece com o desenho certo no Painel de teste.

**A sessão fica pronta quando:** O Painel desenhado com você está no ar em produção, montado pela tela, com números que batem com as telas do CRM e das Listas.

---
