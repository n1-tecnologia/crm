// Parte a do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "0",
    "n": "Fechar o v1.0 e abrir o novo marco",
    "dias": [
      1,
      1
    ],
    "dep": [],
    "desc": "O GSD (a ferramenta de planejamento que vive em `.planning/`) está no marco v1.0, com 9 fases (0 a 8): 6 concluídas e 3 abertas. A Fase 08 (Canais) terminou o código e espera a UAT do dono; a Fase 02 (Solicitação de pagamento) tem o ensaio de duas semanas e o corte do ClickUp por fazer; a Fase 04 (telas do Financeiro) tem o corte do painel `financeiro-tria.vercel.app` só preparado. Esta sessão fecha a 08, dá destino às 02 e 04 e abre o v2.0 com as sessões deste plano.",
    "partida": [
      "`.planning/STATE.md`: `status: verifying`, Fase 08, 147 de 148 planos com resumo; o único sem resumo é `02-28-PLAN.md`.",
      "`08-UAT.md` (em `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/`): 4 testes, todos `[pending]`. `08-VERIFICATION.md`: `status: human_needed`, 13 de 13 verdades verificadas no código, nenhum gap.",
      "`.planning/WINDOWS.md`: `open_count: 2` (a UAT da 08 e um teste instável); o `/gsd-ship` fica bloqueado enquanto houver janela aberta.",
      "Fase 02: `02-27-PLAN.md` com as Tasks 1 e 2 feitas e a Task 3 (o ensaio real de 14 dias) aberta; `02-28-PLAN.md` (o corte) nunca executado.",
      "Fase 04: `04-14-PLAN.md` parou antes do passo irreversível, por decisão do dono; `04-UAT.md` com 13 de 13 testes aprovados."
    ],
    "pronto": "`.planning/WINDOWS.md` com `open_count: 0`; `.planning/ROADMAP.md` com o v1.0 arquivado e o v2.0 listando as 17 sessões deste plano como fases; o destino das Fases 02 e 04 escrito em `.planning/STATE.md`.",
    "tarefas": [
      {
        "id": "0.1",
        "n": "Verificar e fechar a Fase 08",
        "objetivo": "A Fase 08 tem todo o código verificado, mas a UAT de fim de fase nunca rodou no app real: as 4 linhas de `08-UAT.md` estão `[pending]` e a coluna “Resultado” do roteiro de `08-PROVAS.md` está em branco. Esta tarefa faz a UAT com você, corrige o que ela apontar, fecha as observações baratas da revisão de código e marca a fase concluída.",
        "pronto": "`08-UAT.md` com `status: complete`, `08-VERIFICATION.md` com `status: passed`, a linha da Phase 8 com `[x]` no `ROADMAP.md` e as janelas #6 e #7 fechadas em `WINDOWS.md`.",
        "subs": [
          {
            "n": "Preparar os dois logins da UAT",
            "cam": [
              "voce"
            ],
            "hoje": "O roteiro (`08-PROVAS.md`, seção “Roteiro da UAT”) pede dois usuários reais do Supabase no mesmo Espaço: um de Papel base Administrador ou Proprietário e um de base Membro. Um convite novo não manda e-mail (isso chega na Sessão 12), então é preciso usar dois Membros que já entram hoje.",
            "fazer": [
              "Escolher dois Membros `ativo` do Espaço `ws_n1` que já têm conta no Supabase: um Administrador ou a Proprietária, e um de base Membro.",
              "Subir `npm run dev` na raiz (web em 3001, api em 3002) com o `apps/api/.env` da plataforma."
            ],
            "pronto": "Os dois entram em `http://localhost:3001/entrar` e abrem `/crm/caixa-de-entrada` sem erro."
          },
          {
            "n": "Percorrer os 10 passos da UAT e anotar o resultado",
            "cam": [
              "voce"
            ],
            "hoje": "`08-UAT.md` agrupa os 10 passos de `08-PROVAS.md` em 4 testes, todos `[pending]`. O passo 1 agora começa pela engrenagem do cabeçalho da coluna de Conversas (correção `0b5c5b3`), não pela URL.",
            "fazer": [
              "Rodar `/gsd-verify-work 8`, que lê `08-UAT.md` e pergunta teste a teste.",
              "Teste 1 (passos 1 a 3): como Administrador, engrenagem › “Conectar Canal” › cartão WhatsApp oficial › criar “Comercial” com o número A; cartão não oficial › criar “Suporte” com o número B; repetir o não oficial com o número A, que deve ser recusado com “Esta conta já está conectada em outro Canal ativo.” e um link para o Canal que usa o número.",
              "Teste 2 (passos 4 e 5): “Simular conexão” em cada ficha; na lista de Canais, conferir os selos oficial, não oficial, cadastrado e demo.",
              "Teste 3 (passos 6 a 8): abrir um Contato do seed com WhatsApp, trocar “Responder por” para Suporte, enviar texto livre sem modelo e usar o filtro “Canal” da Caixa de Entrada.",
              "Teste 4 (passos 9 e 10): entrar como Membro (“Conectar Canal” desabilitado, ficha sem “Simular conexão”); voltar como Administrador, “Desconectar” e “Arquivar” o Suporte.",
              "Recarregar a página depois de cada gravação: o dado tem de vir da api, não da memória da tela.",
              "Preencher a coluna “Resultado” de `08-PROVAS.md` com o que viu, inclusive o que estiver feio ou confuso."
            ],
            "pronto": "Nenhum teste `[pending]` em `08-UAT.md`: cada um está `pass` ou `issue` com a descrição do problema."
          },
          {
            "n": "Corrigir cada problema que a UAT apontar",
            "cam": [
              "web",
              "api"
            ],
            "hoje": "Não há falha conhecida; a lista nasce do passo anterior.",
            "fazer": [
              "Para cada teste marcado `issue` em `08-UAT.md`, escrever primeiro um teste que reproduz o problema (de componente em `apps/web` ou de rota em `apps/api`) e depois a correção.",
              "Refazer na tela só o passo que falhou."
            ],
            "pronto": "Os 4 testes de `08-UAT.md` em `pass`."
          },
          {
            "n": "Corrigir as duas observações baratas da revisão de código e dar destino às outras",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "`08-REVIEW-DISPOSITION.md` tem WR-01 a WR-06 e IN-01 a IN-04, todas `open`. WR-02: reabrir uma Conversa não zera `resolvida_em` (`apps/api/src/repositorios/crm/conversas.ts:181-185`, função `definirSituacao`). WR-06: os atalhos WhatsApp e E-mail da ficha do Contato dizem “Nenhum Canal … ativo alcança este Contato” quando o Canal existe mas está desconectado (`apps/web/src/features/crm/contact-card.tsx:311-343`).",
            "fazer": [
              "WR-02: no `UPDATE` de `definirSituacao`, gravar `resolvida_em = null` quando a situação volta para `aberta`.",
              "WR-06: trocar a frase de `contact-card.tsx` para “Nenhum Canal conectado alcança este Contato.”",
              "Em `08-REVIEW-DISPOSITION.md`: WR-02 e WR-06 viram `fixed`; WR-01 (janela de 24 h na primeira mensagem) vira `deferred` para a Sessão 7; WR-03, WR-04 e WR-05 viram `deferred` para a Sessão 3; IN-01 a IN-04 viram `accepted`."
            ],
            "pronto": "Um teste novo em `apps/api/src/repositorios/crm/conversas.test.ts` resolve e reabre uma Conversa e lê `resolvida_em` nulo; `08-REVIEW-DISPOSITION.md` não tem nenhuma linha `open`."
          },
          {
            "n": "Tirar o empate do teste instável `colunas-geradas`",
            "cam": [
              "api"
            ],
            "hoje": "Janela #7 de `WINDOWS.md`: `apps/api/src/persistencia/colunas-geradas.test.ts:111` ordena só por `due_date` (`order by due_date`), e duas linhas com o mesmo vencimento saem em ordem aleatória.",
            "fazer": "Trocar para `order by due_date, id` nessa consulta do teste.",
            "pronto": "Em `apps/api`, `npx vitest run src/persistencia/colunas-geradas.test.ts` passa 20 vezes seguidas; a janela #7 vira `closed`."
          },
          {
            "n": "Dar destino às pendências do dono que a Fase 08 deixou",
            "cam": [],
            "hoje": "`08-PROVAS.md`, seção “Fica com o dono”, tem 4 decisões abertas: (1) o popup legado de Canal das Listas nasce `conectada`; (2) a aba “Todas” para o separador “via …”; (3) “Simular conexão” visível no Espaço de produção; (4) qual dos dois WhatsApps um Flow usa.",
            "fazer": "Anotar no `STATE.md` do v2.0 onde cada uma vai ser decidida: (1) e (2) na Sessão 3 (unificação do CRM), (3) na Sessão 4 (a subtarefa que troca “Simular conexão” por conexão real), (4) na Sessão 7 (Flows).",
            "pronto": "As 4 linhas de “Fica com o dono” apontam para uma sessão do v2.0."
          },
          {
            "n": "Marcar a Fase 08 como concluída",
            "cam": [],
            "hoje": "`.planning/state.json` mostra a fase 8 `in_progress`; `ROADMAP.md` mostra `[ ] Phase 8`.",
            "fazer": [
              "Com os 4 testes em `pass`, deixar o `/gsd-verify-work 8` fechar `08-UAT.md` e passar `08-VERIFICATION.md` para `passed`.",
              "Fechar a janela #6 de `WINDOWS.md`.",
              "Conferir `ROADMAP.md` (`[x] Phase 8`) e `state.json` (fase 8 `complete`)."
            ],
            "pronto": "`WINDOWS.md` com `open_count: 0` e a Phase 8 com `[x]` no `ROADMAP.md`."
          }
        ]
      },
      {
        "id": "0.2",
        "n": "Decidir o destino das Fases 02 e 04 do Financeiro",
        "objetivo": "As duas fases estão abertas não por falta de código, mas por falta de operação com dado real (14 dias de ensaio, uma semana de uso, 30 dias com o painel antigo pausado) e por dois passos irreversíveis: desligar os webhooks do ClickUp e tirar o acesso anônimo do banco do `financeiro-tria`. O plano anterior dizia que faltava a tela de aprovação (SOL-03): ela existe desde o plano `02-14` (`/ia/aprovacoes` e o cartão de Aprovação na Tarefa).",
        "pronto": "Cada uma das duas fases tem o destino escrito em `.planning/STATE.md`, e o que ficou para depois virou fase ou item de backlog do v2.0.",
        "subs": [
          {
            "n": "Escrever a lista do que falta na Fase 02",
            "cam": [],
            "hoje": "`02-27-SUMMARY.md`: Tasks 1 e 2 feitas (código de integração Omie determinístico, `ConsultarContaPagar` antes de `IncluirContaPagar`, `npm run reconciliar`); Task 3 aberta: escrever `docs/08-migracao-financeiro/06-ensaio-e-coortes.md` e operar 14 dias de ensaio. Ninguém produz ainda o `--resumo=<json>` diário que `npm run reconciliar` precisa para o lado do `automation/`. `02-28-PLAN.md` (corte: runbook `07-runbook-corte-e-rollback.md`, desligar os webhooks Tria do ClickUp, arquivar a Lista de Solicitação, reavaliar a decisão D12, fechar SOL-01 a SOL-09) nunca rodou. Em `REQUIREMENTS.md`, SOL-01, 02, 03, 04, 07 e 08 seguem sem `[x]`, embora o código exista.",
            "fazer": [
              "Copiar para `STATE.md`, numa seção “Fase 02 — o que falta”, os quatro itens acima, cada um com dono (você ou o time) e tempo de calendário.",
              "Listar os pré-requisitos do ensaio que o `STATE.md` já cita: emitir a credencial de serviço do `automation/` (`npm run credencial -w @n1/api`), ligar `PAYMENT_REQUEST_SOURCE=plataforma` para a coorte nova e fixar `FALLBACK_COMENTARIO_ATE` no deploy."
            ],
            "pronto": "A seção existe em `STATE.md`, com dono e prazo por item."
          },
          {
            "n": "Escrever a lista do que falta na Fase 04",
            "cam": [],
            "hoje": "`04-14-SUMMARY.md` e `STATE.md`: o runbook `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` está escrito; a migração `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` existe e nunca foi aplicada. Faltam: uma semana de uso real das oito telas pelo Financeiro; rodar as duas consultas de RLS no Supabase Studio e colar o resultado no runbook; pausar (não apagar) `financeiro-tria.vercel.app` por 30 dias; só então remover as rotas legadas e o `AuthContext` e aplicar a migração. A policy de `conciliador_contas` se chama `anon read conciliador_contas`, com espaços: um `drop policy anon_read` literal não a remove.",
            "fazer": "Copiar esses cinco passos para `STATE.md`, numa seção “Fase 04 — o que falta”, com dono e data de cada um.",
            "pronto": "A seção existe em `STATE.md`, com dono e data por passo."
          },
          {
            "n": "Listar as pendências de fases já marcadas como concluídas",
            "cam": [],
            "hoje": "O `ROADMAP.md` marca `[x]` em fases que ainda têm passos abertos: `05-05` (corte de Marcos Paulo e Family Office: deploy, webhooks, 48 h e arquivamento pendentes), `05-10` Task 4 (ligar o relógio de Contas a receber: ensaio, ler o relato e `npm run automacoes:liberar`), e RES-03 da Fase 6 (verificação humana do passo 2B em `lancar`). PERS-08 (onde o `apps/api` roda) segue sem `[x]` em `REQUIREMENTS.md`, mas o `apps/api` já está na VPS (`apps/api/deploy/CONTEXT.md`).",
            "fazer": [
              "Marcar PERS-08 como concluído em `REQUIREMENTS.md`, com a prova `apps/api/deploy/CONTEXT.md`.",
              "Juntar `05-05`, `05-10` Task 4 e RES-03 à mesma decisão da subtarefa seguinte."
            ],
            "pronto": "Nenhum requisito do v1.0 fica sem status quando o `/gsd-audit-milestone` rodar."
          },
          {
            "n": "O que fazer com o que falta do Financeiro?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O código das Fases 02 e 04 está pronto. O que falta é operação com dado real e dois cortes irreversíveis. Somado: cerca de 1,5 dia de trabalho do time e 3 a 6 semanas de calendário com o Financeiro usando.",
            "opcoes": [
              "(A) Terminar antes de começar o v2.0",
              "(B) Levar para o v2.0 como uma trilha paralela “Financeiro: ensaio e cortes”, sem bloquear as sessões",
              "(C) Encerrar as duas fases como estão e registrar o que ficou de fora como backlog"
            ],
            "muda": "(A) adia o início da Sessão 1 em 3 a 6 semanas. (B) acrescenta uma trilha no cronograma, com cerca de 1,5 dia de trabalho espalhado e o resto em tempo de calendário; o time não para. (C) não muda as datas, mas o ClickUp e o painel antigo continuam ligados sem data para sair.",
            "recomendo": "(B): o Financeiro já opera no CRM N1, e os cortes dependem de calendário, não de código.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "0.3",
        "n": "Trocar de marco",
        "objetivo": "Fechar o v1.0 no GSD e abrir o v2.0 com as sessões deste plano como fases, para que `/gsd-plan-phase` e `/gsd-execute-phase` passem a trabalhar nelas.",
        "pronto": "`.planning/ROADMAP.md` lista o v2.0 com as 20 fases, e o v1.0 está arquivado.",
        "subs": [
          {
            "n": "Auditar o v1.0 antes de arquivar",
            "cam": [],
            "hoje": "Nenhuma auditoria do marco foi feita.",
            "fazer": "Rodar `/gsd-audit-milestone`, que confere cada requisito de `REQUIREMENTS.md` contra as fases.",
            "pronto": "O relatório da auditoria não aponta requisito sem status nem fase sem destino."
          },
          {
            "n": "Arquivar o v1.0",
            "cam": [],
            "hoje": "`.planning/milestone.lock`, `.planning/state.json` e `docs/09-planejamento/` estão fora do git (`git status`).",
            "fazer": [
              "Commitar `docs/09-planejamento/` e `.planning/state.json`.",
              "Rodar `/gsd-complete-milestone`."
            ],
            "pronto": "O v1.0 aparece arquivado em `.planning`, e `git status` não mostra nada de `.planning` solto."
          },
          {
            "n": "Abrir o v2.0 com as sessões deste plano",
            "cam": [],
            "hoje": "Não existe v2.0.",
            "fazer": [
              "Rodar `/gsd-new-milestone`, dando `docs/09-planejamento/TAREFAS-POR-SESSAO.md` como entrada: as Sessões 1 a 20 viram as fases 1 a 20, na ordem e com as dependências do plano.",
              "Registrar a trilha de escopo da IA e, se a 0.2 escolher (B), a trilha do Financeiro como itens de backlog com data, não como fases."
            ],
            "pronto": "O `ROADMAP.md` lista as 20 fases do v2.0 e o `STATE.md` aponta para a Fase 1 (Segurança dos dados)."
          }
        ]
      }
    ]
  },
  {
    "id": "1",
    "n": "Segurança dos dados e base de produção",
    "dias": [
      3,
      5
    ],
    "dep": [
      "0"
    ],
    "desc": "Vem antes de qualquer dado real de cliente (da Sessão 4 em diante). Hoje `GET /estado` manda a todo Membro logado as Sessões de Chat, a Memória de Usuário e os e-mails de convite dos outros, e os segredos dos links públicos; um Membro suspenso ainda grava pelas operações que não conferem o estado; o banco não tem RLS e o `apps/api` conecta como `postgres`; não há onde guardar token de provedor; o log grava o segredo que vai na URL das rotas públicas; o limite de taxa vive só na memória do processo; e só existe produção, sem alerta de erro.",
    "partida": [
      "O token do Supabase é verificado em toda requisição (`verificarTokenDoSupabase`, `apps/api/src/autenticacao/verificar-token.ts`, por `auth.getClaims`).",
      "O Espaço de Trabalho vem de `WORKSPACE_ID` no servidor, nunca do cliente (`apps/api/src/plugins/autenticacao.ts:78`).",
      "O ator de uma operação é o Membro da sessão, e os argumentos passam por schema zod próprio de cada operação (`apps/api/src/rotas/operacoes.ts:284`).",
      "`GET /estado` já recorta Espaço, Pasta, Lista, Tarefa, Atividade, Aprovação e Arquivo pelo alcance do Membro (`visibilidadePara`, `packages/dominio/src/derive-visibilidade.ts:36`).",
      "As rotas do CRM novo leem o Papel no banco a cada chamada (`exigir`, `apps/api/src/servicos/crm/acesso.ts:39`).",
      "Os segredos dos links públicos são aleatórios (`crypto.getRandomValues`, `packages/dominio/src/operations/scale.ts:46`).",
      "Anexos ficam em bucket privado e saem por URL assinada, autorizada por Tarefa (`GET /anexos/:fileId/url`, `apps/api/src/rotas/estado.ts:70`).",
      "A tela não consulta o banco: usa o Supabase só para login (não há `.from(` nem `.storage` em `apps/web/src`)."
    ],
    "pronto": "Um teste em `apps/api` prova que o Membro A não recebe Sessão de Chat, Memória de Usuário, e-mail de convite nem segredo de link do Membro B, nem por `GET /estado` nem por `POST /operacoes`; `select has_schema_privilege('anon','plataforma','USAGE')` responde `false`; a `009` está aplicada em homologação e em produção; uma credencial gravada pelo cofre aparece cifrada no banco; nenhum log tem segredo de URL; homologação responde com login; um erro forçado chega como alerta.",
    "tarefas": [
      {
        "id": "1.1",
        "n": "Fechar o que o `GET /estado` envia a mais",
        "objetivo": "`visibilidadePara` (`packages/dominio/src/derive-visibilidade.ts:36`) só recorta a Estrutura; o resto do `DataState` vai inteiro para todo Membro logado, inclusive o que é pessoal de outro Membro e segredos de link. O recorte passa a tirar o que é pessoal e a esconder campos de segredo, e a mesma regra vale para a resposta de `POST /operacoes`.",
        "pronto": "Um teste em `apps/api/src/rotas/estado.test.ts`, com dois Membros reais no Postgres local, prova que nenhum recebe a Sessão de Chat, a pasta de chat, a Memória de Usuário nem a Visão pessoal do outro, e que um Membro sem administrar a Lista não recebe `publicShare.secret` nem `Form.secret`.",
        "subs": [
          {
            "n": "Filtrar as Sessões de Chat e as pastas de chat no recorte de visibilidade",
            "cam": [
              "dom"
            ],
            "hoje": "`visibilidadePara` devolve `state.chatSessions` e `state.chatFolders` inteiros (o comentário em `derive-visibilidade.ts:18-20` diz que IA não é recortada). Quem esconde é a tela: `apps/web/src/features/shell/app-shell.tsx:915-920` filtra por `ownerMemberId`, e a regra de quem pode ler uma Sessão (DO-CHT-09: só o dono e quem a recebeu compartilhada) mora só na página `apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:126-132`.",
            "fazer": [
              "Criar `membroVeSessaoDeChat(state, memberId, sessao)` em `packages/dominio/src/derive.ts`, com a regra da página: dono, ou `sharedWithMemberIds` contém o Membro, ou uma Equipe de `sharedWithTeamIds` o contém.",
              "Em `visibilidadePara`, manter só as Sessões que passam nessa regra e só as `chatFolders` com `ownerMemberId` igual ao Membro; pôr os ids que saem em `ocultos`.",
              "A página `ia/chat/[sessao]/page.tsx` passa a chamar `membroVeSessaoDeChat` em vez da conta própria."
            ],
            "pronto": "Teste em `packages/dominio/src/derive-visibilidade.test.ts`: o Membro A não recebe a Sessão do Membro B; recebe quando B a compartilha com A ou com uma Equipe de A; nunca recebe a pasta de chat de B.",
            "nota": "O diálogo de remover Membro (`apps/web/src/app/(shell)/configuracoes/membros/page.tsx`) usa `previewSuccession`, que conta as Sessões de Chat do outro Membro (`packages/dominio/src/operations/members.ts:93`). Com o recorte, a tela passa a contar zero: tirar esse número do texto do diálogo."
          },
          {
            "n": "Esconder a Memória de Usuário, os e-mails de convite e as Visões pessoais dos outros Membros",
            "cam": [
              "dom"
            ],
            "hoje": "Cada `Member` vai com `userMemory` (`packages/dominio/src/types/workspace.ts:126`) e, se pendente, `invitedIdentity` (`:114`). O convite grava o e-mail também em `displayName` (`members.ts:521`), então esconder só `invitedIdentity` não basta. As Visões com `ownerKind: “member”` (Visão pessoal, `packages/dominio/src/types/structure.ts:113`) também vão para todos.",
            "fazer": [
              "Criar `recortarRegistro(colecao, dados, state, memberId)` em `derive-visibilidade.ts`, que devolve uma cópia sem os campos que o Membro não pode ler.",
              "Para `members`: nos outros Membros, `userMemory` vira `{ enabled, items: [] }`; para quem não tem Papel base Administrador ou Proprietário, um Membro `pendente` perde `invitedIdentity` e o `displayName` vira “Convite pendente”.",
              "Para `views`: tirar as Visões `ownerKind: “member”` de outro Membro e pôr os ids em `ocultos`.",
              "`visibilidadePara` aplica `recortarRegistro` a cada coleção antes de devolver."
            ],
            "pronto": "Teste em `derive-visibilidade.test.ts`: um Membro comum vê a própria `userMemory` com itens e a de outro vazia, não vê o e-mail de um convite pendente e não recebe a Visão pessoal de outro; um Administrador vê o e-mail do convite."
          },
          {
            "n": "Esconder os segredos dos links públicos de quem não administra a Lista",
            "cam": [
              "dom"
            ],
            "hoje": "`Task.publicShare.secret` (`packages/dominio/src/types/structure.ts:349`) e `Form.secret` (`:148`) vão para todo Membro que vê a Tarefa ou para todos, no caso dos Formulários. Quem pode criar ou renovar esses links é quem administra a Lista (`containerAdminRefusal`, `packages/dominio/src/derive.ts:1053`, usado em `shareTaskPublicly`, `scale.ts:604`, e `rotateFormSecret`, `scale.ts:413`). Os Formulários de Listas que o Membro não alcança também vão.",
            "fazer": [
              "Em `recortarRegistro`: para `tasks`, tirar `publicShare.secret` quando `containerAdminRefusal(state, memberId, “list”, task.listId)` recusa; para `forms`, fazer o mesmo com `secret`.",
              "Em `visibilidadePara`, tirar os Formulários cuja `listId` está em `ocultos`."
            ],
            "pronto": "Teste em `derive-visibilidade.test.ts`: um Membro de base Membro vê a Tarefa com link público, mas sem `publicShare.secret`; o Administrador da Lista vê o segredo; o Formulário de uma Lista privada não chega a quem não a alcança.",
            "nota": "Conferir antes, com `grep`, que nenhuma tela de quem não administra lê `publicShare.secret` ou `form.secret`; se ler, a tela precisa mostrar “Só quem administra a Lista vê o link”."
          },
          {
            "n": "O que mais o `GET /estado` deve esconder?",
            "cam": [
              "dec",
              "dom"
            ],
            "decisao": true,
            "hoje": "Agentes, Automações, Documentos de Conhecimento, Coleções e o CRM antigo (`contacts`, `deals`, `conversations`) vão inteiros para todos, inclusive para Convidados. Não existe regra de quem vê um Agente ou Documento: a concessão de Coleção é dada a Agente, não a Membro (`CollectionGrant`, `packages/dominio/src/types/ai.ts:606`). O CRM antigo sai do código na Sessão 3.",
            "opcoes": [
              "(A) Convidado não recebe nenhuma coleção de IA (`agents`, `automations`, `documents`, `collections`, `skills`); os demais Papéis recebem tudo, como hoje",
              "(B) Criar agora uma regra de visibilidade por registro para Documentos e Agentes (dono, Equipe, compartilhamento)",
              "(C) Deixar como está até as Sessões 13 a 18 (IA)"
            ],
            "muda": "(A) custa cerca de meio dia, em `visibilidadePara`. (B) custa cerca de 2 dias e pede que você diga quem vê cada Documento. (C) não custa nada agora, mas um Convidado continua lendo os Documentos de Conhecimento. Nas três, o CRM antigo fica como está até a Sessão 3 removê-lo.",
            "recomendo": "(A) agora, e a regra fina de (B) na Sessão 17 (Conhecimento indexado).",
            "peso": "produto"
          },
          {
            "n": "Aplicar o mesmo recorte à resposta de `POST /operacoes`",
            "cam": [
              "api",
              "dom"
            ],
            "hoje": "`apps/api/src/rotas/operacoes.ts:364-365` filtra o diff só por id (`filtrarDiferenca`, `derive-visibilidade.ts:109`), mas cada `gravados[]` carrega `dados` com o registro inteiro (`RegistroGravado`, `packages/dominio/src/diferenca.ts:17`). Gravar a própria Tarefa devolve o `publicShare.secret`; gravar qualquer coisa que toque outro Membro devolve a `userMemory` dele. E `inviteMember`, que passa por `SERVICOS` (`operacoes.ts:234`), volta sem recorte nenhum, porque `depois` fica indefinido (`operacoes.ts:302-303`). `GET /estado/revisao` devolve só um número e não precisa de recorte.",
            "fazer": [
              "Criar `recortarDiferenca(diferenca, state, memberId)` em `derive-visibilidade.ts`: tira os ids de `ocultos` e passa cada `gravados[].dados` por `recortarRegistro`.",
              "Em `operacoes.ts`, trocar `filtrarDiferenca` por `recortarDiferenca`.",
              "No caminho de `SERVICOS`, recortar também: `convidarMembro` (`apps/api/src/servicos/convidar-membro.ts`) passa a devolver o estado depois da operação, e a rota aplica `recortarDiferenca`."
            ],
            "pronto": "Teste em `apps/api/src/rotas/operacoes.test.ts`: um Membro sem administrar a Lista grava um Campo de uma Tarefa com link público e a resposta não contém o segredo."
          },
          {
            "n": "Escrever o teste de vazamento de ponta a ponta",
            "cam": [
              "api"
            ],
            "hoje": "`apps/api/src/rotas/estado.test.ts:140` prova só o recorte da Estrutura (PRIV-03); não há teste de dado pessoal.",
            "fazer": "Em `estado.test.ts` (Postgres local, pula sem `DATABASE_URL`), semear dois Membros, cada um com Sessão de Chat, pasta de chat, item de Memória de Usuário e Visão pessoal, um convite pendente e uma Tarefa com link público; chamar `GET /estado` como cada um e procurar no corpo os ids e segredos do outro.",
            "pronto": "O teste roda no `npm run check` e falha se qualquer um desses dados do outro Membro aparecer."
          }
        ]
      },
      {
        "id": "1.2",
        "n": "Fechar as escritas sem conferência",
        "objetivo": "Toda operação que grava deveria conferir quem chama, mas a conferência mora dentro de cada uma das cerca de 200 operações de `packages/dominio/src/operations/registro.ts`, e falta em parte delas, sobretudo no CRM antigo. Além disso, um Membro `suspenso` passa pela autenticação (`apps/api/src/plugins/autenticacao.ts:85`) e chega a `POST /operacoes`, onde só é barrado pelas operações que conferem o estado.",
        "pronto": "Um Membro suspenso recebe 403 em qualquer `POST /operacoes`; um Convidado recebe `ok: false` em `trashContact`, `sendMessage` e `winDeal`; a tabela de quem confere o quê cobre todas as operações do registro.",
        "subs": [
          {
            "n": "Barrar o Membro suspenso em `POST /operacoes`",
            "cam": [
              "api"
            ],
            "hoje": "O hook de autenticação deixa passar `ativo` e `suspenso` (`plugins/autenticacao.ts:85`), de propósito: o suspenso consulta. O CRM novo barra a escrita dele (`podeNoCrm`, `packages/dominio/src/crm/permissoes.ts:71`), mas as operações do registro que não olham o estado do Membro gravam, por exemplo `trashContact` (`packages/dominio/src/operations/contacts.ts:333`).",
            "fazer": "Em `apps/api/src/rotas/operacoes.ts`, logo depois de `ehNomeDeOperacao(nome)` (linha 252), responder 403 com “Seu acesso está suspenso: você consulta, mas não altera.” quando `request.membro.state !== “ativo”`. Toda operação do registro grava (regra de inclusão, `registro.ts:7-13`), então a recusa vale para todas.",
            "pronto": "Teste em `operacoes.test.ts`: um Membro suspenso chama `trashContact` e recebe 403, e o Contato continua `ativo` no banco."
          },
          {
            "n": "Pôr a conferência nas operações do CRM antigo",
            "cam": [
              "dom"
            ],
            "hoje": "`contacts.ts` tem uma conferência de Papel em 19 operações (perto da linha 981); `conversations.ts`, uma em 11 (perto da linha 700); `deals.ts` tem `mayWriteDeal` (`deals.ts:34`) mas não o chama em `moveDealToStage` (`:131`), `winDeal` (`:194`), `loseDeal` (`:236`), `removeStage` e `migrateDealsToFunnel`. Exemplos sem nada: `trashContact` (`contacts.ts:333`), `addContactNote` (`contacts.ts:761`), `sendMessage` (`conversations.ts:164`), `resolveConversation` (`conversations.ts:257`). O plano anterior dizia que `collaboration.ts` não confere nada: confere, por `activeTask` (`collaboration.ts:15`), que chama `taskWriteRefusal`.",
            "fazer": [
              "Mover `mayWriteDeal` para um arquivo novo `packages/dominio/src/operations/crm-antigo.ts`, com o nome `recusaDeEscritaNoCrmAntigo` (Membro `ativo` e Papel base diferente de Convidado, a mesma regra de `podeNoCrm` para escrita).",
              "Chamar essa recusa na primeira linha de toda operação de `contacts.ts`, `conversations.ts` e `deals.ts` que ainda não confere."
            ],
            "pronto": "Um teste por arquivo (`contacts.test.ts`, `conversations.test.ts`, `deals.test.ts`, criando os que não existem): um Convidado chama `trashContact`, `sendMessage` e `winDeal`, recebe `ok: false` e o estado não muda.",
            "nota": "A Sessão 3 apaga essas operações; isto custa cerca de meio dia e fecha a porta até lá."
          },
          {
            "n": "Pôr a conferência nas outras operações que gravam sem olhar quem chama",
            "cam": [
              "dom"
            ],
            "hoje": "Fora do CRM antigo, a varredura achou duas: `restoreList` (`packages/dominio/src/operations/tasks.ts:816`) restaura sem conferir quem chama, enquanto `restoreContainer` (`structure.ts:776`) e `restoreTask` (`tasks.ts:694`, via `mayWriteTask`) conferem; `createReceivableSeries` (`financeiro.ts:1807`) cria parcelas sem conferir escrita na Lista de Contas a receber.",
            "fazer": [
              "`restoreList` passa a chamar `restoreContainer(state, actingMemberId, “list”, listId)` ou a mesma recusa que ele usa.",
              "`createReceivableSeries` passa a chamar `listWriteRefusal(state, actingMemberId, CR.listId)` (`tasks.ts:1373`) antes de criar."
            ],
            "pronto": "Dois testes: um Convidado chama cada uma e recebe `ok: false`."
          },
          {
            "n": "Escrever a tabela de quem confere o quê",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe. A varredura rápida desta revisão olhou 167 das cerca de 200 operações; as outras têm assinatura que a busca não pegou.",
            "fazer": "Em `packages/dominio/CONTEXT.md`, uma seção “Quem pode” com uma linha por operação de `REGISTRO`: o arquivo, a função de recusa que ela chama (`taskWriteRefusal`, `containerAdminRefusal`, `listWriteRefusal`, `recusaDeEscritaNoCrmAntigo`, dono do registro) ou a justificativa de não ter.",
            "pronto": "Toda chave de `REGISTRO` aparece na tabela, e nenhuma linha diz “sem conferência” sem justificativa."
          }
        ]
      },
      {
        "id": "1.3",
        "n": "Fechar o banco para que só o `apps/api` o acesse",
        "objetivo": "Nenhuma migração (`apps/api/migracoes/001` a `008`) liga RLS, cria policy ou faz `grant`/`revoke`, e o `apps/api` conecta com `DATABASE_URL` (`apps/api/src/persistencia/conexao.ts:135`), que no `.env.example` é o usuário `postgres` do pooler, dono de tudo. Toda a proteção está no `apps/api`. Esta tarefa confere se a chave pública do navegador alcança o schema `plataforma` e troca o usuário do `apps/api` por um usuário de banco com só o que ele precisa.",
        "pronto": "`select has_schema_privilege('anon','plataforma','USAGE')` e o mesmo para `authenticated` respondem `false`; o `apps/api` de produção conecta como `n1_api`; a `009` está aplicada.",
        "subs": [
          {
            "n": "Conferir se o schema `plataforma` está exposto à chave pública",
            "cam": [
              "infra",
              "voce"
            ],
            "hoje": "A tela carrega a chave pública (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `apps/web/.env.example:2`). Se `plataforma` estiver em “Exposed schemas” e `anon` tiver `USAGE` nele, qualquer pessoa com essa chave lê o banco pela API REST do Supabase. Não consegui conferir daqui: o conector do Supabase não tem permissão no projeto.",
            "fazer": [
              "No SQL Editor do Supabase, rodar `select has_schema_privilege('anon','plataforma','USAGE') as anon, has_schema_privilege('authenticated','plataforma','USAGE') as autenticado;`.",
              "Em Project Settings › Data API › Exposed schemas, conferir que `plataforma` não está na lista; se estiver, tirar.",
              "Em Authentication › Sign In / Providers, desligar “Allow new users to sign up”: usuário só nasce por convite (Sessão 12)."
            ],
            "pronto": "As duas colunas voltam `false`, e `curl` em `https://<ref>.supabase.co/rest/v1/registros` com a chave pública e o cabeçalho `Accept-Profile: plataforma` responde erro.",
            "nota": "É o item mais urgente do plano: leva minutos e vale fazer hoje, antes de começar a sessão."
          },
          {
            "n": "Como proteger o banco?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O banco confia em quem conecta. A mesma `DATABASE_URL`, do usuário `postgres`, serve o `apps/api` e roda as migrações no deploy (`apps/api/deploy/instalar-release.sh:42`).",
            "opcoes": [
              "(A) Banco fechado: revogar tudo de `anon` e `authenticated` no schema `plataforma` e criar um usuário de banco `n1_api`, sem superusuário, só com leitura e escrita nas tabelas de `plataforma`; as migrações seguem com o usuário dono, numa variável nova `DATABASE_URL_MIGRACAO`",
              "(B) Tudo de (A), mais RLS em todas as tabelas, com policy por `workspace_id` lido de `current_setting('app.workspace_id')`, que o `apps/api` fixa a cada transação"
            ],
            "muda": "(A) custa cerca de 1 dia. (B) soma cerca de 2 dias: `executar` (`apps/api/src/persistencia/unidade-de-trabalho.ts`) e os repositórios do CRM passam a abrir toda transação com `set_config('app.workspace_id', …)`, e um erro de Espaço vira recusa do banco, não só do código.",
            "recomendo": "(A) agora; (B) quando houver mais de uma empresa no sistema (decisão 12.1 da Sessão 12).",
            "peso": "arrumacao"
          },
          {
            "n": "Escrever a migração `009`",
            "cam": [
              "banco"
            ],
            "hoje": "A `008` é a última e é imutável. O deploy aplica sozinho toda migração nova a cada merge na `main` (`instalar-release.sh:42`), então a `009` chega em produção no primeiro deploy depois do merge.",
            "fazer": [
              "Criar `apps/api/migracoes/009-seguranca-e-cofre.sql` com: `revoke all on schema plataforma from public, anon, authenticated`; `revoke all on all tables in schema plataforma from anon, authenticated`; `alter default privileges in schema plataforma revoke all on tables from anon, authenticated`.",
              "Na mesma migração, se o papel `n1_api` existir (bloco `do $$ … if exists (select 1 from pg_roles where rolname = 'n1_api') …`), dar `usage` no schema e `select, insert, update, delete` em todas as tabelas, e o mesmo em `alter default privileges` para tabelas futuras.",
              "Na mesma migração, a tabela do cofre (tarefa 1.4).",
              "Criar o papel à mão, uma vez por banco, no SQL Editor: `create role n1_api login password '<senha forte>'`. A senha nunca entra no arquivo.",
              "Aplicar primeiro em homologação (tarefa 1.7) e só depois fazer o merge."
            ],
            "pronto": "`npm run migrar -w @n1/api -- --seco` lista `pendente 009-seguranca-e-cofre.sql`; depois de aplicada, `select has_table_privilege('n1_api','plataforma.registros','SELECT')` é `true` e o mesmo para `anon` é `false`."
          },
          {
            "n": "Trocar a conexão do `apps/api` para o usuário `n1_api`",
            "cam": [
              "api",
              "infra"
            ],
            "hoje": "`conexao.ts:135` lê só `DATABASE_URL`, e `migrar.cli.ts` usa o mesmo pool. Na VPS, o ambiente fica em `/opt/n1-crm/shared/api.env`. Em desenvolvimento, `DATABASE_SSL_INSECURE=true` desliga a verificação de TLS (decisão da Fase 2, `08-PROVAS.md` item 5); fora do notebook, `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` é obrigatório.",
            "fazer": [
              "Em `apps/api/src/persistencia/migrar.cli.ts`, usar `DATABASE_URL_MIGRACAO` quando existir, e `DATABASE_URL` quando não.",
              "Pôr `DATABASE_URL_MIGRACAO` no `apps/api/.env.example`, com a explicação.",
              "No `api.env` de produção: `DATABASE_URL` com o usuário `n1_api`, `DATABASE_URL_MIGRACAO` com o dono, e conferir que há `DATABASE_CA_CERT` ou `DATABASE_CA_PATH` e não há `DATABASE_SSL_INSECURE`."
            ],
            "pronto": "Depois de reiniciar `n1-crm-api`, `/saude` e `GET /estado` respondem em produção, e um `drop table plataforma.migracoes` feito com o usuário `n1_api` é recusado."
          }
        ]
      },
      {
        "id": "1.4",
        "n": "Criar o cofre de credenciais",
        "objetivo": "As Sessões 4, 7, 8 e 9 vão guardar tokens de provedor (Evolution, Meta, e-mail). Hoje não há tabela nem utilitário de cifra: a `008` não tem coluna de segredo, de propósito, e `Integration.omie` guarda só o rótulo da conta (`packages/dominio/src/types/workspace.ts:203`). O cofre guarda o segredo cifrado com uma chave que fica fora do banco.",
        "pronto": "Um teste grava uma credencial, lê de volta o mesmo valor e prova que a coluna no banco só tem bytes cifrados; nenhuma rota devolve o segredo.",
        "subs": [
          {
            "n": "Criar a tabela `plataforma.credenciais` na `009`",
            "cam": [
              "banco"
            ],
            "hoje": "Não existe. A única tabela de credencial é `plataforma.service_credentials` (`003-integracao-e-importacao.sql:99`), que guarda hash da credencial do `automation/`, não segredo que se lê de volta.",
            "fazer": "Na `009`: `plataforma.credenciais` com `id`, `workspace_id`, `dono_tipo` (`canal` ou `integracao`), `dono_id`, `tipo` (por exemplo `token_de_acesso`), `segredo_cifrado bytea`, `iv bytea`, `etiqueta bytea`, `versao_da_chave int`, `criado_em`, `atualizado_em`, `revogado_em`; índice único em (`workspace_id`, `dono_tipo`, `dono_id`, `tipo`) onde `revogado_em is null`.",
            "pronto": "`\\d plataforma.credenciais` no banco de homologação mostra as colunas e o índice."
          },
          {
            "n": "Cifrar e decifrar no `apps/api`",
            "cam": [
              "api"
            ],
            "hoje": "Não há `createCipheriv` nem `pgcrypto` em nenhum lugar do repositório.",
            "fazer": [
              "Criar `apps/api/src/servicos/cofre.ts` com `guardarCredencial(cliente, { workspaceId, donoTipo, donoId, tipo, segredo })` e `lerCredencial(cliente, …)`, usando AES-256-GCM do `node:crypto`, com IV novo a cada gravação.",
              "A chave vem de `COFRE_CHAVE` (32 bytes em base64) e a versão de `COFRE_CHAVE_VERSAO`; pôr as duas no `.env.example` e no `api.env` de homologação e de produção, cada ambiente com a sua.",
              "Só os serviços de provedor (Sessões 4, 7, 8 e 9) chamam `lerCredencial`; nenhuma rota devolve o valor."
            ],
            "pronto": "Teste em `apps/api/src/servicos/cofre.test.ts` (Postgres local): grava, lê o mesmo texto, e um `select segredo_cifrado` direto não contém o texto; com a chave errada, `lerCredencial` lança erro.",
            "nota": "Escolhi chave fora do banco em vez do Supabase Vault: quem levar uma cópia do banco não leva os segredos."
          }
        ]
      },
      {
        "id": "1.5",
        "n": "Tirar segredos dos logs",
        "objetivo": "O `apps/api` sobe com o logger padrão do Fastify (`apps/api/src/index.ts:97`, `buildApp({ logger: true })`), sem `redact`, e o nginx grava toda URL no log de acesso. As rotas públicas levam o segredo na URL (`/v1/public/forms/:secret`, `formularios-publicos.ts:193`; `/v1/public/tasks/:secret`, `tarefas-publicas.ts:50`), então o segredo vai para os dois logs.",
        "pronto": "Uma chamada a `/v1/public/forms/<segredo>` não deixa o segredo nem no log do `apps/api` nem em `/var/log/nginx/n1-crm-api.access.log`.",
        "subs": [
          {
            "n": "Configurar `redact` e mascarar a URL no logger do `apps/api`",
            "cam": [
              "api"
            ],
            "hoje": "`index.ts:97` passa `logger: true`; `app.ts:108` repassa ao Fastify. `LOG_LEVEL` está em `apps/api/.env.example:24`, mas nenhum código o lê.",
            "fazer": [
              "Criar `apps/api/src/observabilidade/log.ts` com `opcoesDoLogger()`: `level` de `LOG_LEVEL` (padrão `info`); `redact` com `req.headers.authorization` e os caminhos `*.segredo`, `*.secret`, `*.token`, `*.senha`, censura “[oculto]”; serializador de `req` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`.",
              "`index.ts` passa `buildApp({ logger: opcoesDoLogger() })`, e `OpcoesDoApp.logger` (`app.ts:61`) passa a aceitar o objeto."
            ],
            "pronto": "Teste em `apps/api/src/observabilidade/log.test.ts`: com o logger escrevendo num fluxo de memória, `GET /v1/public/forms/abc123` produz linha sem `abc123`."
          },
          {
            "n": "Mascarar o segredo no log de acesso do nginx",
            "cam": [
              "infra"
            ],
            "hoje": "`apps/api/deploy/nginx-n1-crm-api.conf` usa `access_log` com o formato padrão, que grava a URL inteira.",
            "fazer": [
              "Num arquivo `conf.d` do nginx, criar um `map` sobre `$request_uri` que troca o segmento depois de `/v1/public/forms/` e `/v1/public/tasks/` por `***`, e um `log_format` próprio que usa a variável do `map` no lugar da URL.",
              "Trocar o `access_log` do site para esse formato, no repositório e à mão na VPS."
            ],
            "pronto": "Depois de `nginx -s reload`, `curl` em `/v1/public/forms/teste123` e `grep teste123 /var/log/nginx/n1-crm-api.access.log` não acha nada.",
            "nota": "Depois da primeira emissão do certificado, o arquivo da VPS é a fonte e `preparar-vps.sh` não o reescreve (cabeçalho de `nginx-n1-crm-api.conf`): a mudança precisa ser feita também na VPS."
          }
        ]
      },
      {
        "id": "1.6",
        "n": "Proteger as rotas públicas contra abuso",
        "objetivo": "O Formulário e a Tarefa pública aceitam chamada sem login. O limite de taxa vive na memória do processo e zera a cada reinício, e o comentário de `limite-de-taxa.ts:7-8` diz que o nginx limita na borda, mas `nginx-n1-crm-api.conf` não tem `limit_req`. O limite passa a valer no nginx, antes do `apps/api`.",
        "pronto": "50 chamadas seguidas do mesmo IP a `/v1/public/forms/x` recebem `429` a partir de cerca da 40ª.",
        "subs": [
          {
            "n": "Pôr `limit_req` no nginx para `/v1/public/`",
            "cam": [
              "infra"
            ],
            "hoje": "`criarLimiteDeTaxa` (`apps/api/src/servicos/limite-de-taxa.ts:43`) conta em memória: 30 por minuto por IP e 60 por segredo no Formulário (`formularios-publicos.ts:188-189`), 60 por minuto por IP na Tarefa pública (`tarefas-publicas.ts:48`). O `apps/api` roda num processo só (`n1-crm-api.service`).",
            "fazer": [
              "Em `/etc/nginx/conf.d/n1-crm-limites.conf`: `limit_req_zone $binary_remote_addr zone=n1_publico:10m rate=30r/m;`.",
              "No site, um `location /v1/public/` com `limit_req zone=n1_publico burst=10 nodelay;`, `limit_req_status 429;` e os mesmos `proxy_*` do `location /`.",
              "Manter o limite em memória como segunda camada e corrigir o comentário de `limite-de-taxa.ts`."
            ],
            "pronto": "Um laço de 50 `curl` contra `https://crm-n1-api.85.155.186.214.nip.io/v1/public/forms/x` mostra `429` nas últimas respostas.",
            "nota": "Uma contagem no banco só vale a pena quando o `apps/api` rodar em mais de um processo."
          },
          {
            "n": "Documentar o `TRUST_PROXY`",
            "cam": [
              "api"
            ],
            "hoje": "`app.ts:106` lê `TRUST_PROXY`, e o serviço da VPS o fixa em `loopback` (`apps/api/deploy/n1-crm-api.service:23`), mas o `apps/api/.env.example` não tem a variável. Sem ela, o limite por IP conta o IP do nginx para todo mundo.",
            "fazer": "Acrescentar `TRUST_PROXY=` ao `.env.example`, explicando: vazio em desenvolvimento, `loopback` atrás do nginx.",
            "pronto": "`grep TRUST_PROXY apps/api/.env.example` acha a linha com a explicação."
          }
        ]
      },
      {
        "id": "1.7",
        "n": "Ambientes, backup e monitoramento",
        "objetivo": "Só existe produção: uma VPS compartilhada com nginx para o `apps/api` e a Vercel para a web, e o workflow `.github/workflows/deploy-api.yml` só conhece o ambiente `production`. Não há onde validar uma sessão antes de produção, nenhum backup testado no repositório e nenhum alerta de erro (não há Sentry nem outro serviço em `apps/api` ou `apps/web`).",
        "pronto": "Homologação no ar com login e banco próprios, uma restauração de backup feita e anotada, e um erro forçado em homologação chegando como alerta.",
        "subs": [
          {
            "n": "Onde fica o banco de homologação?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Há um projeto Supabase (o de produção), com Postgres, Auth e Storage.",
            "opcoes": [
              "(A) Um segundo projeto Supabase só para homologação",
              "(B) O mesmo projeto, com um Espaço de Trabalho de teste (outro `WORKSPACE_ID`)"
            ],
            "muda": "(A) custa a mensalidade de mais um projeto e separa banco, usuários e arquivos. (B) não custa nada, mas uma migração errada em homologação já é em produção, e a `009` não pode ser testada antes.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          },
          {
            "n": "Subir o ambiente de homologação",
            "cam": [
              "infra"
            ],
            "hoje": "Produção: serviço `n1-crm-api` em `127.0.0.1:3020`, código em `/opt/n1-crm`, site `crm-n1-api.85.155.186.214.nip.io` (`apps/api/deploy/CONTEXT.md`); a web lê `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.",
            "fazer": [
              "Criar o banco de homologação conforme a decisão anterior, rodar `npm run migrar -w @n1/api` e `npm run bootstrap:gestao -w @n1/api` nele.",
              "Na VPS, um segundo serviço `n1-crm-api-hml` (cópia de `n1-crm-api.service` com `PORT=3021` e pasta `/opt/n1-crm-hml`) e um site nginx `crm-n1-api-hml.85.155.186.214.nip.io` com certificado próprio.",
              "Em `deploy-api.yml`, um job para a branch `homologacao` com `environment: homologacao` e os segredos desse ambiente.",
              "Na Vercel, as três variáveis `NEXT_PUBLIC_*` do ambiente Preview apontando para a homologação."
            ],
            "pronto": "Um push na branch `homologacao` publica a api; a URL de Preview da Vercel abre `/entrar`, aceita um login de homologação e carrega o Início."
          },
          {
            "n": "Ligar o backup diário e testar uma restauração",
            "cam": [
              "infra"
            ],
            "hoje": "Não há script de backup nem registro de restauração no repositório. Não conferi o que o plano do Supabase guarda.",
            "fazer": [
              "Conferir em Database › Backups o que o plano do Supabase guarda e por quantos dias.",
              "Na VPS, um `systemd timer` diário `n1-crm-backup` que roda `pg_dump --schema=plataforma` com `DATABASE_URL_MIGRACAO`, cifra o arquivo e o copia para fora da VPS, guardando 14 dias.",
              "Restaurar o último arquivo no banco de homologação."
            ],
            "pronto": "Depois da restauração, `select count(*) from plataforma.registros` em homologação bate com o número de produção na hora do backup, e a data fica anotada em `apps/api/deploy/CONTEXT.md`."
          },
          {
            "n": "Ligar o monitoramento de erros na api e na web",
            "cam": [
              "api",
              "web",
              "infra"
            ],
            "hoje": "Erro inesperado no `apps/api` só vai ao log do processo (`app.ts:137`, `request.log.error(erro)`); a web não registra erro em lugar nenhum.",
            "fazer": [
              "No `apps/api`: `@sentry/node`, iniciado em `index.ts` antes de `buildApp`, com `SENTRY_DSN` do ambiente; `Sentry.captureException(erro)` no `setErrorHandler` de `app.ts`; `beforeSend` que apaga corpo, cabeçalhos e a parte da URL com segredo.",
              "Na web: `@sentry/nextjs` pelo arquivo de instrumentação do Next 16 (ler antes o guia em `node_modules/next/dist/docs/`).",
              "No Sentry, uma regra de alerta por e-mail para erro novo em produção e em homologação."
            ],
            "pronto": "Um erro forçado em homologação (uma rota de teste que lança, removida depois) gera alerta por e-mail em até 5 minutos."
          },
          {
            "n": "Preparar o servidor da Evolution API",
            "cam": [
              "infra",
              "voce"
            ],
            "hoje": "O `automation/` do `financeiro-tria` já usa uma instância própria da Evolution para os avisos do Financeiro (Sessão 4, decisão 4.3). Não há servidor da Evolution para o CRM N1.",
            "fazer": [
              "Escolher o servidor: a mesma Evolution do `automation/`, a VPS compartilhada (Docker, com Postgres e Redis próprios) ou uma VPS nova.",
              "Deixar a Evolution respondendo atrás de HTTPS, com a chave de API guardada para o cofre da tarefa 1.4."
            ],
            "pronto": "O painel da Evolution responde por HTTPS e a chave de API está anotada para a Sessão 4."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: são 7 frentes (recorte do `GET /estado`, conferências de permissão, migração `009` com usuário de banco próprio, cofre, logs, nginx, homologação com backup e monitoramento)."
  },
  {
    "id": "12",
    "n": "Superadmin, usuários e permissões",
    "dias": [
      5,
      7
    ],
    "dep": [
      "1"
    ],
    "desc": "Vem logo antes das sessões de IA, para que os Agentes já nasçam respeitando quem pode o quê. Hoje um convite cria o Membro `pendente`, mas não manda e-mail, e não existe operação que o torne `ativo`: o convidado recebe 403 ao entrar. Não dá para criar Papel nem Equipe pela tela, nem dar acesso a um Espaço, Pasta ou Lista depois de criado. Não há “esqueci a senha”. O servidor atende um Espaço só (`WORKSPACE_ID`). E todo Membro vê todos os módulos no menu, menos o Financeiro.",
    "partida": [
      "Tipos `Member`, `Role`, `Grant`, `Team` e `Workspace` em `packages/dominio/src/types/workspace.ts`; `Member.state` com `pendente`, `ativo`, `suspenso` e `removido` (linha 13).",
      "Operações em `packages/dominio/src/operations/members.ts`: `inviteMember` (`:420`), `alterarEmailDoConvite` (`:128`), `alterarPapelDoMembro` (`:173`), `removeMember` com sucessor (`:217`), `transferWorkspaceOwnership` (`:376`), `deleteRole` (`:572`) e `grantGovernanceAccess` (`:722`).",
      "Login real por e-mail e senha em `/entrar` (`apps/web/src/app/entrar/actions.ts`, `signInWithPassword`); `apps/web/src/proxy.ts` manda para `/entrar` quem não tem sessão.",
      "Telas: `/configuracoes/membros` convida e remove; `/configuracoes/membros/[membro]` muda o Papel e o e-mail do convite; `/configuracoes/papeis` só lista e exclui; `/configuracoes/equipes` só lista.",
      "O CRM novo recusa por Papel no servidor (`podeNoCrm`, `packages/dominio/src/crm/permissoes.ts:57`); o Financeiro recusa quem não alcança a Pasta (`apps/api/src/rotas/financeiro.ts`)."
    ],
    "pronto": "Um Administrador convida um e-mail pela tela; a pessoa recebe o e-mail, cria a senha, entra e vê no menu só os módulos do Papel dela; chamar a rota de um módulo não liberado devolve 403; um Papel e uma Equipe criados pela tela mudam o que o Membro faz; quem esquece a senha a redefine sozinho.",
    "tarefas": [
      {
        "id": "12.1",
        "n": "Definir o escopo",
        "objetivo": "Cinco respostas mudam o tamanho da sessão: se haverá várias empresas, o que é o Superadmin, como os módulos são liberados, se a lista de permissões do Papel passa a valer e o que um Membro suspenso pode. Elas precisam sair no primeiro dia.",
        "pronto": "As cinco decisões respondidas e anotadas no `CONTEXT.md` da fase.",
        "subs": [
          {
            "n": "A plataforma vai atender mais de uma empresa?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Só a Tria, num Espaço fixo: `buildApp` lê `WORKSPACE_ID` (`apps/api/src/app.ts:101`) e o hook resolve o Membro sempre dentro dele (`plugins/autenticacao.ts:78`). As tabelas já têm `workspace_id`, e `plataforma.registros` também.",
            "opcoes": [
              "(A) Sim, em breve: cada cliente com o seu Espaço de Trabalho",
              "(B) Não por agora: só a Tria"
            ],
            "muda": "(A) soma cerca de 2 dias: o servidor passa a descobrir o Espaço pelo usuário, as rotas públicas passam a achar o Espaço pelo segredo, e a tela ganha um seletor de Espaço. (B) mantém o Espaço fixo.",
            "recomendo": "Responder pelo plano comercial. Se não houver cliente novo nos próximos 3 meses, (B).",
            "peso": "produto"
          },
          {
            "n": "O Superadmin fica acima das empresas?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Ninguém fica acima do Espaço; o Proprietário é o topo. Um Espaço novo só nasce por script (`npm run bootstrap:gestao -w @n1/api`).",
            "opcoes": [
              "(A) Sim: o Superadmin é da plataforma, cria empresas e gere os usuários de todas",
              "(B) Não: “Superadmin” é o Proprietário ou um Administrador do Espaço, com a tela de Membros completa"
            ],
            "muda": "(A) só faz sentido se a anterior for (A): soma uma tabela de Superadmins, uma área `/plataforma` e um registro de auditoria fora do Espaço (cerca de 1,5 dia). (B) não cria conceito novo.",
            "recomendo": "Seguir a anterior: várias empresas → (A); só a Tria → (B).",
            "peso": "produto"
          },
          {
            "n": "Como os módulos são liberados?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O menu tem seis assuntos (`ASSUNTOS`, `apps/web/src/features/shell/app-shell.tsx:116`): Trabalho, CRM, IA, Ferramentas, Painéis e Financeiro. Só o Financeiro some, para quem não alcança a Pasta (`app-shell.tsx:365`).",
            "opcoes": [
              "(A) Por Papel: cada Papel liga ou desliga cada um dos seis módulos, e os Papéis personalizados viram os perfis (Comercial, Financeiro, Gestão)",
              "(B) Por Membro: seis chaves na ficha de cada pessoa",
              "(C) Os dois: o Papel dá o padrão e a ficha do Membro só pode tirar"
            ],
            "muda": "(A) custa cerca de 1 dia e um caso novo vira um Papel novo. (B) custa o mesmo, mas a configuração fica espalhada pessoa a pessoa. (C) soma meio dia a (A).",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "A lista de permissões do Papel passa a valer?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "`Role.permissions` (`workspace.ts:62`) é lida em só dois lugares: o Convidado que comenta (`packages/dominio/src/derive.ts:971`) e o Convidado que muda só o Status (`packages/dominio/src/operations/tasks.ts:1233`), os dois usados pelo “Agente do pipeline” do Financeiro. Quem decide o resto é a base do Papel e o acesso ao Espaço, Pasta ou Lista.",
            "opcoes": [
              "(A) Ler a lista em todas as conferências (`taskWriteRefusal`, `containerAdminRefusal`, `podeNoCrm`)",
              "(B) O Papel personalizado escolhe base e módulos; a lista fica só para os dois casos que já a usam, e a tela não a oferece"
            ],
            "muda": "(A) soma cerca de 3 dias e mexe em toda conferência do domínio. (B) não soma nada; um Papel personalizado restringe por módulo e por base, não ação a ação.",
            "recomendo": "(B), e voltar ao assunto se surgir um caso que módulo e base não resolvem.",
            "peso": "produto"
          },
          {
            "n": "O que um Membro suspenso pode fazer?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O código trata `suspenso` como “só consulta”: o hook deixa entrar (`plugins/autenticacao.ts:85`), `podeNoCrm` deixa ler e recusa escrever (`permissoes.ts:67` e `:71`), e a Sessão 1 barra a escrita em `POST /operacoes`. Mas não existe operação que suspenda alguém.",
            "opcoes": [
              "(A) Só consulta: entra, vê, não altera nada",
              "(B) Sem acesso: não entra, como um removido, mas volta com o histórico ao ser reativado"
            ],
            "muda": "(A) só cria as operações de suspender e reativar. (B) também muda `plugins/autenticacao.ts:85` e `podeNoCrm` para recusar o suspenso, cerca de meio dia a mais.",
            "recomendo": "(B): quem suspende alguém quase sempre quer cortar o acesso.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "12.2",
        "n": "Modelo de dados",
        "objetivo": "Guardar que módulos cada Papel libera e, se a 12.1 decidir por várias empresas, quem é Superadmin e em que Espaço cada usuário está. Hoje não existe conceito de módulo no domínio.",
        "pronto": "Tipos e regras no domínio com testes; as tabelas novas, se houver, aplicadas em homologação.",
        "subs": [
          {
            "n": "Criar o tipo `Modulo` e a regra `membroAcessaModulo`",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe. As chaves dos módulos só existem na tela (`Assunto.chave`, `app-shell.tsx:102`).",
            "fazer": [
              "Em `packages/dominio/src/types/workspace.ts`: `export type Modulo = “trabalho” | “crm” | “ia” | “ferramentas” | “paineis” | “financeiro”` e o campo `Role.modulos?: readonly Modulo[]`; ausente quer dizer todos, o que mantém os Papéis de hoje como estão.",
              "Criar `packages/dominio/src/derive-modulos.ts` com `membroAcessaModulo(state, memberId, modulo)`: o Papel do Membro libera o módulo; para `financeiro`, o Membro também precisa alcançar a Pasta (`memberReachesContainer`, como `vePastaFinanceiro` faz hoje).",
              "A tela (`app-shell.tsx`) e a api passam a chamar essa função; ninguém repete a regra."
            ],
            "pronto": "Teste em `packages/dominio/src/derive-modulos.test.ts`: Papel com `modulos: [“trabalho”]` não acessa `crm`; Papel sem `modulos` acessa tudo; Papel com `financeiro`, sem alcance à Pasta, não acessa `financeiro`."
          },
          {
            "n": "Criar as tabelas de Superadmin e de empresa",
            "cam": [
              "banco"
            ],
            "hoje": "Não existem. Um usuário já pode ser Membro de mais de um Espaço, porque o Membro mora em `plataforma.registros` com `workspace_id` e `dados->>'userId'` (índice `registros_members_user_id_idx`, migração `002`).",
            "fazer": "Numa migração nova, depois da `009`: `plataforma.superadmins (user_id text primary key, criado_em, criado_por)`; o primeiro Superadmin entra por SQL à mão.",
            "pronto": "Migração aplicada em homologação, com o primeiro Superadmin gravado.",
            "nota": "Só se a 12.1 escolher (A) nas duas primeiras decisões."
          },
          {
            "n": "Tirar o Espaço fixo do servidor",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "`app.ts:101` lê `WORKSPACE_ID` e passa o valor ao hook de autenticação e às rotas públicas de Formulário e Tarefa. O CORS só aceita os cabeçalhos `authorization` e `content-type` (`app.ts:172`).",
            "fazer": [
              "No hook (`plugins/autenticacao.ts`), ler o Espaço do cabeçalho `x-espaco`, conferir que o usuário é Membro dele (consulta em `plataforma.registros` por `colecao = 'members'` e `dados->>'userId'`) e, sem cabeçalho, usar o único Espaço do usuário ou responder 400 pedindo a escolha.",
              "Acrescentar `x-espaco` a `allowedHeaders` do CORS.",
              "As rotas públicas acham o Espaço pelo segredo do Formulário ou da Tarefa, não pela configuração.",
              "Na web, um seletor de Espaço no menu do usuário; `apps/web/src/dados/transporte.ts` passa a mandar `x-espaco`."
            ],
            "pronto": "Teste em `apps/api/src/plugins/autenticacao.test.ts`: um usuário Membro de dois Espaços recebe o Espaço certo pelo cabeçalho e 403 para um Espaço de que não é Membro.",
            "nota": "Só se a 12.1 decidir por várias empresas."
          }
        ]
      },
      {
        "id": "12.3",
        "n": "Ciclo de vida do usuário",
        "objetivo": "Hoje “Convite enviado” (`apps/web/src/app/(shell)/configuracoes/membros/page.tsx:113`) não envia nada: `convidarMembro` (`apps/api/src/servicos/convidar-membro.ts`) só procura o e-mail no Supabase Auth e grava o Membro `pendente`. Não há operação de aceitar, e o hook responde 403 “Seu convite ainda não foi aceito.” (`plugins/autenticacao.ts:86-88`). Também não há “esqueci a senha”, troca de senha nem como suspender. Esta tarefa liga o convite de ponta a ponta e fecha esses buracos.",
        "pronto": "Um convite feito pela tela chega por e-mail; a pessoa clica, cria a senha, informa o nome e cai no Início como Membro `ativo`; outra pessoa redefine a senha esquecida sozinha.",
        "subs": [
          {
            "n": "Configurar o envio de e-mail do Supabase Auth",
            "cam": [
              "voce",
              "infra"
            ],
            "hoje": "Não conferi o SMTP do projeto. O envio padrão do Supabase tem limite baixo de e-mails por hora e serve só para teste.",
            "fazer": [
              "Em Authentication › Emails › SMTP Settings, configurar um SMTP próprio, com remetente do domínio da Tria.",
              "Nos modelos “Invite user” e “Reset password”, apontar o link para `{{ .SiteURL }}/entrar/confirmar?token_hash={{ .TokenHash }}&type=invite` e `…&type=recovery`.",
              "Em URL Configuration, pôr o endereço de produção da web como Site URL e os de homologação nas Redirect URLs."
            ],
            "pronto": "Um e-mail de teste enviado pelo painel chega na caixa de entrada, não no spam."
          },
          {
            "n": "Enviar o convite por e-mail de verdade",
            "cam": [
              "api"
            ],
            "hoje": "`convidarMembro` chama `resolverUsuarioPorEmail` (`apps/api/src/autenticacao/resolver-usuario.ts:31`), que procura o e-mail em `auth.admin.listUsers`, e depois `inviteMember` dentro de `executar`. Nenhum e-mail sai.",
            "fazer": [
              "Em `convidarMembro`, quando o e-mail não tem usuário, chamar `clienteAdmin().auth.admin.inviteUserByEmail(email, { redirectTo: <origem da web>/entrar/confirmar })` antes da transação e passar o `user.id` devolvido como `userId` para `inviteMember`.",
              "Se `inviteMember` recusar, apagar o usuário recém-criado com `auth.admin.deleteUser`.",
              "Quando o e-mail já tem usuário, não mandar convite: a pessoa entra com a senha que já tem e o aceite acontece no primeiro acesso (subtarefa seguinte).",
              "Criar a rota `POST /membros/:id/convite` (só Administrador ou Proprietário, Membro `pendente`) que reenvia o e-mail, e um botão “Reenviar convite” em `configuracoes/membros/[membro]/page.tsx`."
            ],
            "pronto": "Teste em `apps/api/src/servicos/convidar-membro.test.ts` com o cliente do Auth falso: convidar um e-mail novo chama `inviteUserByEmail` uma vez e grava o Membro com o `userId` devolvido; uma recusa do domínio apaga o usuário criado."
          },
          {
            "n": "Aceitar o convite no primeiro acesso",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existe operação de aceite; o comentário em `members.ts:515-518` diz que ela “não é operação desta fase”. O hook barra `pendente` em toda rota.",
            "fazer": [
              "Criar `aceitarConvite(state, actingMemberId, { nome })` em `packages/dominio/src/operations/members.ts`: o Membro que chama precisa estar `pendente` e ter `userId`; passa a `ativo`, ganha `joinedAt`, perde `invitedIdentity`, e o `displayName` vira o nome informado; grava a Atividade “Convite aceito”.",
              "Criar a rota `POST /convites/aceitar` no `apps/api`, com `config: { aceitaPendente: true }`; no hook (`plugins/autenticacao.ts:85`), deixar passar o `pendente` só nas rotas com essa marca. A rota roda `executar` com `aceitarConvite`.",
              "Registrar a operação em `registro.ts` e o schema em `apps/api/src/rotas/esquemas/membros.ts`: `ESQUEMAS satisfies EsquemasCompletos` não compila sem ele."
            ],
            "pronto": "Teste em `apps/api` (Postgres local): com o token de um Membro pendente, `GET /estado` dá 403, `POST /convites/aceitar` dá 200, e o `GET /estado` seguinte dá 200 com o Membro `ativo`."
          },
          {
            "n": "Criar as páginas de confirmar o link e de criar a senha",
            "cam": [
              "web"
            ],
            "hoje": "Só existe `/entrar` (`apps/web/src/app/entrar/page.tsx` e `actions.ts`). As rotas públicas do `proxy.ts` são `/entrar` e `/sair` (`apps/web/src/proxy.ts:17`).",
            "fazer": [
              "Criar `apps/web/src/app/entrar/confirmar/route.ts`: lê `token_hash` e `type`, chama `supabase.auth.verifyOtp` com o cliente do servidor (`@/autenticacao/cliente-servidor`) e redireciona para `/entrar/nova-senha?tipo=<type>`; link vencido leva a `/entrar` com a frase “Este link venceu. Peça outro a quem te convidou.”",
              "Criar `apps/web/src/app/entrar/nova-senha/page.tsx` com ação no servidor: nova senha (mínimo 8 caracteres) e confirmação, `supabase.auth.updateUser({ password })`; se `tipo=invite`, pede também o nome e chama `POST /convites/aceitar`; no fim, vai para `/`.",
              "Pôr `/entrar/confirmar` e `/entrar/esqueci` em `PUBLICAS` no `proxy.ts`."
            ],
            "pronto": "Em homologação, o fluxo vai do e-mail de convite até o Início sem erro, e o Membro aparece `ativo` em `/configuracoes/membros`.",
            "nota": "Antes de escrever, ler o guia de route handlers e de ações no servidor em `node_modules/next/dist/docs/` (`AGENTS.md`: este Next 16 tem mudanças)."
          },
          {
            "n": "Criar o “Esqueci a senha”",
            "cam": [
              "web"
            ],
            "hoje": "A tela de entrar não tem o link; não existe página de redefinição.",
            "fazer": [
              "Link “Esqueci a senha” em `entrar/page.tsx` para `/entrar/esqueci`.",
              "Página `apps/web/src/app/entrar/esqueci/page.tsx` com ação que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origem>/entrar/confirmar })` e responde sempre “Se o e-mail estiver cadastrado, enviamos um link.”, sem dizer se o e-mail existe (mesmo cuidado de `actions.ts`).",
              "O link do e-mail cai em `/entrar/nova-senha?tipo=recovery`, da subtarefa anterior."
            ],
            "pronto": "Em homologação, uma pessoa pede o link, troca a senha e entra com a senha nova; a senha antiga é recusada."
          },
          {
            "n": "Trocar a senha em Minha conta",
            "cam": [
              "web"
            ],
            "hoje": "`apps/web/src/app/(shell)/minha-conta/page.tsx` mostra o Membro e a Memória de Usuário; não mexe em senha.",
            "fazer": "Uma seção “Senha” com senha atual, nova e confirmação; a ação confere a atual com `signInWithPassword` no e-mail da sessão e grava a nova com `updateUser({ password })`.",
            "pronto": "A senha nova vale no próximo login; com a senha atual errada, aparece “Senha atual incorreta.” e nada muda."
          },
          {
            "n": "Suspender e reativar um Membro",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "O estado `suspenso` existe (`workspace.ts:13`), mas nenhuma operação chega nele.",
            "fazer": [
              "Criar `suspenderMembro(state, actingMemberId, memberId)` e `reativarMembro(…)` em `members.ts`: só Administrador ou Proprietário; não suspende o Proprietário (`workspace.ownerMemberId`) nem a si mesmo; `ativo` → `suspenso` e volta; Atividade em cada ato; o Membro continua nas Equipes (RN-ET-12 aceita `suspenso`).",
              "Registrar as duas em `registro.ts` e os schemas em `apps/api/src/rotas/esquemas/membros.ts`.",
              "Se a 12.1 escolher “sem acesso”, `plugins/autenticacao.ts:85` passa a recusar `suspenso` com “Seu acesso foi suspenso.” e `podeNoCrm` (`permissoes.ts:67`) deixa de aceitar leitura.",
              "Botões “Suspender” e “Reativar” em `configuracoes/membros/[membro]/page.tsx`."
            ],
            "pronto": "Testes no domínio (recusas e ida e volta) e um teste de rota: o Membro suspenso recebe a resposta que a 12.1 decidiu em `GET /estado` e 403 em `POST /operacoes`; reativado, volta a gravar."
          },
          {
            "n": "Fechar o redirecionamento aberto do login",
            "cam": [
              "web"
            ],
            "hoje": "`apps/web/src/app/entrar/actions.ts:29` aceita qualquer `para` que comece com `/` e não com `//`. Um `para` como `/\\evil.com` passa, e o navegador lê a barra invertida como barra: depois do login, a pessoa vai para outro site.",
            "fazer": "Extrair a regra para `apps/web/src/autenticacao/destino-seguro.ts`: aceitar só caminho que comece com uma `/`, sem `//` nem `\\`, e cuja `new URL(para, origem)` tenha a mesma origem; senão, `/`.",
            "pronto": "Teste em `destino-seguro.test.ts`: `/crm` passa; `//evil.com`, `/\\evil.com` e `https://evil.com` viram `/`."
          }
        ]
      },
      {
        "id": "12.4",
        "n": "Papéis, Equipes e acessos pela tela",
        "objetivo": "Papéis personalizados, Equipes e Concessões só nascem por dados iniciais ou ao criar um contêiner (`state.grants.push` em `structure.ts:135`, `:241`, `:375`, `members.ts:337` e `:767`). A tela de Papéis só lista e exclui (`configuracoes/papeis/page.tsx`) e a de Equipes só lista (`configuracoes/equipes/page.tsx`). Administradores passam a criar e editar os três pela tela.",
        "pronto": "Um Papel criado pela tela, sem o módulo CRM, tira o CRM do menu de quem o recebe; uma Equipe criada pela tela recebe acesso a uma Lista privada e os Membros dela passam a ver a Lista.",
        "subs": [
          {
            "n": "Criar e editar Papel personalizado",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Só existe `deleteRole` (`members.ts:572`). Um Papel de sistema é imutável (`Role.system`, `workspace.ts:60`).",
            "fazer": [
              "Criar `createRole(state, actingMemberId, { nome, base, modulos })` e `updateRole(state, actingMemberId, roleId, { nome?, modulos? })` em `members.ts`: só Administrador ou Proprietário; `base` entre `administrador`, `membro` e `convidado`, nunca `proprietario`; nome único no Espaço; Papel de sistema recusa edição; a base não muda depois de criada; Atividade em cada ato.",
              "Registrar as duas em `registro.ts` e os schemas em `apps/api/src/rotas/esquemas/membros.ts`."
            ],
            "pronto": "Testes no domínio: cria, edita nome e módulos, recusa nome repetido, base Proprietário e edição de Papel de sistema."
          },
          {
            "n": "Criar e editar Equipe",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não há operação de Equipe; o tipo `Team` (`workspace.ts:75`) só nasce pelo seed.",
            "fazer": [
              "Criar `createTeam`, `updateTeam` (nome e descrição), `addMemberToTeam`, `removeMemberFromTeam` e `deleteTeam` num arquivo novo `packages/dominio/src/operations/equipes.ts`: só Administrador ou Proprietário; só Membro `ativo` ou `suspenso` entra (RN-ET-12); `deleteTeam` recusa enquanto a Equipe tiver Concessões e diz quantas.",
              "Registrar e criar os schemas, como na subtarefa anterior."
            ],
            "pronto": "Testes no domínio de cada operação, incluindo a recusa de um Membro `removido` e de apagar Equipe com Concessão."
          },
          {
            "n": "Conceder e revogar acesso a um Espaço, Pasta ou Lista",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Uma Concessão só nasce ao criar o contêiner (`structure.ts`), ao transferir na sucessão (`members.ts:337`) ou no acesso de governança (`grantGovernanceAccess`, `members.ts:722`).",
            "fazer": [
              "Criar `concederAcesso(state, actingMemberId, { subjectKind, subjectId, action, resourceType, resourceId })` e `revogarAcesso(state, actingMemberId, grantId)` em `packages/dominio/src/operations/acessos.ts`: quem chama precisa administrar o contêiner (`containerAdminRefusal`, `derive.ts:1053`); `subjectKind` entre `member`, `team` e `role`; `action` entre `ver`, `comentar`, `editar` e `administrar`; `scope: “subarvore”`, `origin: “concessaoDireta”`; Atividade em cada ato.",
              "`revogarAcesso` recusa tirar a última concessão `administrar` de um contêiner privado, que ficaria sem ninguém (B38a: privado sem concessão não existe para ninguém).",
              "Registrar e criar os schemas."
            ],
            "pronto": "Teste no domínio: conceder `ver` de uma Lista privada a uma Equipe faz `memberReachesContainer` ser verdadeiro para os Membros dela; revogar volta a falso."
          },
          {
            "n": "Telas de Papéis, Equipes e acessos editáveis",
            "cam": [
              "web"
            ],
            "hoje": "`configuracoes/papeis/page.tsx` (154 linhas) tem só “Excluir”; `configuracoes/equipes/page.tsx` (113 linhas) não tem botão; não há diálogo de acesso a contêiner (o `share-task-dialog.tsx` é do link público da Tarefa).",
            "fazer": [
              "Em Papéis: botão “Novo Papel” e “Editar”, com diálogo de nome, base e as seis chaves de módulo.",
              "Em Equipes: “Nova Equipe”, “Editar” e a lista de Membros com adicionar e tirar.",
              "Criar `apps/web/src/features/estrutura/acessos-do-conteiner-dialog.tsx`, aberto pelo menu das páginas de Espaço, Pasta e Lista, que lista as Concessões e permite conceder e revogar."
            ],
            "pronto": "Pela tela, em homologação: criar um Papel, uma Equipe com dois Membros e dar à Equipe acesso a uma Lista privada; os dois Membros passam a ver a Lista depois de recarregar.",
            "nota": "A Sessão 2 limpa as páginas de Espaço, Pasta e Lista: combinar onde fica o botão de acessos."
          }
        ]
      },
      {
        "id": "12.5",
        "n": "Área de gestão de usuários",
        "objetivo": "Ter um lugar onde quem gere usuários faz tudo: convidar, reenviar convite, mudar Papel, suspender, reativar e remover. Se a 12.1 decidir por Superadmin acima das empresas, essa área também cria empresas.",
        "pronto": "Quem gere usuários faz o ciclo completo de uma pessoa (convite, aceite, Papel, suspensão, remoção) sem sair da área, e cada ato aparece em `/configuracoes/auditoria`.",
        "subs": [
          {
            "n": "Completar `/configuracoes/membros`",
            "cam": [
              "web"
            ],
            "hoje": "A lista (`configuracoes/membros/page.tsx`, 526 linhas) convida e remove; a ficha (`membros/[membro]/page.tsx`, 403 linhas) muda Papel e e-mail do convite.",
            "fazer": "Filtro por estado (pendente, ativo, suspenso, removido); na ficha, os botões “Reenviar convite”, “Suspender” e “Reativar” (tarefa 12.3) e os módulos que o Papel libera, só para leitura.",
            "pronto": "Pela tela, em homologação, uma pessoa passa por pendente, ativo, suspenso, ativo e removido."
          },
          {
            "n": "Criar empresa com o primeiro Proprietário",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "Só por script: `npm run bootstrap:gestao -w @n1/api` (`apps/api/src/bootstrap/gestao.cli.ts`), que monta o Espaço “Gestão” do Financeiro.",
            "fazer": [
              "Rota `POST /plataforma/espacos`, só para quem está em `plataforma.superadmins`: cria o Espaço com nome e o Proprietário por e-mail, que recebe o convite da 12.3.",
              "Tela `apps/web/src/app/(shell)/plataforma/page.tsx` com a lista de Espaços e o formulário."
            ],
            "pronto": "Uma empresa criada pela tela, e o Proprietário dela entra pelo convite.",
            "nota": "Só se a 12.1 decidir por várias empresas e por Superadmin da plataforma."
          },
          {
            "n": "Registrar as ações de gestão de usuários",
            "cam": [
              "dom"
            ],
            "hoje": "`inviteMember` e `alterarPapelDoMembro` já gravam Atividade (`members.ts:530` e `:205`), e `/configuracoes/auditoria` existe.",
            "fazer": "Garantir que toda operação nova desta sessão (`aceitarConvite`, `suspenderMembro`, `reativarMembro`, `createRole`, `updateRole`, as de Equipe e as de acesso) grava Atividade com quem, quando, antes e depois.",
            "pronto": "Teste no domínio para cada operação nova conferindo a Atividade gravada; as ações de teste aparecem em `/configuracoes/auditoria`."
          }
        ]
      },
      {
        "id": "12.6",
        "n": "Aplicar o acesso por módulo",
        "objetivo": "Quem não tem o módulo não o vê no menu nem o usa por fora da tela. Hoje só o Financeiro é escondido (`app-shell.tsx:365`) e recusado (`rotas/financeiro.ts`); CRM, IA, Ferramentas e Painéis abrem para todos.",
        "pronto": "Um Membro com Papel sem CRM não vê o assunto CRM, cai na página “sem acesso” ao abrir `/crm/contatos` e recebe 403 em `GET /contatos` e em `POST /operacoes/createDeal`.",
        "subs": [
          {
            "n": "Esconder no menu e nas páginas",
            "cam": [
              "web"
            ],
            "hoje": "`app-shell.tsx:365` filtra só o Financeiro, por `vePastaFinanceiro`. As páginas abrem para qualquer Membro.",
            "fazer": [
              "Trocar o filtro de `assuntosVisiveis` por `membroAcessaModulo(data, memberId, a.chave)`.",
              "No `AppShell`, quando o módulo da rota atual (`assuntoDe(pathname)`) não está liberado, mostrar um estado “Você não tem acesso a este módulo. Fale com quem administra o Espaço.” no lugar da página."
            ],
            "pronto": "Teste de componente em `apps/web`: com um Papel só de Trabalho, o trilho mostra só Trabalho, e a rota `/crm/contatos` mostra o estado sem acesso."
          },
          {
            "n": "Recusar na api por módulo",
            "cam": [
              "api",
              "dom"
            ],
            "hoje": "As rotas do CRM conferem só a base do Papel (`exigir`, `servicos/crm/acesso.ts:39`); `POST /operacoes` não sabe a que módulo uma operação pertence.",
            "fazer": [
              "Em `packages/dominio/src/operations/registro.ts`, um mapa `MODULO_DA_OPERACAO` com tipo `Record<NomeDeOperacao, Modulo>`, para que uma operação nova sem módulo não compile.",
              "Em `operacoes.ts`, antes do despacho, responder 403 quando `membroAcessaModulo` recusa o módulo da operação.",
              "Em `exigir`, conferir o módulo `crm` (a consulta `papelDoMembro`, `apps/api/src/repositorios/crm/membros.ts:20`, passa a devolver `modulos` do Papel).",
              "Em `rotas/financeiro.ts`, conferir o módulo `financeiro` junto com o alcance à Pasta.",
              "Em `visibilidadePara`, não mandar as coleções de módulo desligado: `contacts`, `companies`, `deals`, `conversations` e `channels` sem CRM; `agents`, `chatSessions`, `automations`, `documents` e `skills` sem IA; `grupos`, `comunidades`, `flows` e `linksDeCaptacao` sem Ferramentas; `panels` sem Painéis."
            ],
            "pronto": "Testes de rota: um Membro sem CRM recebe 403 em `GET /contatos` e em `POST /operacoes/createDeal`, e o `GET /estado` dele vem sem `contacts`; um Membro com CRM continua recebendo tudo."
          }
        ]
      }
    ],
    "ajuste": "+2 dias se for só a Tria (convite real, Papéis e Equipes editáveis, módulos). Cerca de +4 se a plataforma atender várias empresas."
  }
];
