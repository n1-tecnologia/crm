---
schema_version: 1
open_count: 27
waived_count: 2
fixed_count: 5
total_count: 34
last_updated: 2026-11-06T13:24:05.443Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/contatos/page.tsx |  | 07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T03:08:27.555Z | 2026-10-11T22:24:42.450Z |
| 2 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/empresas/page.tsx |  | 07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T04:16:05.984Z | 2026-10-11T22:24:42.511Z |
| 3 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/negocios/page.tsx |  | 07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T22:48:54.281Z | 2026-10-11T22:24:42.571Z |
| 4 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx |  | 07-11: ficha de Negocio (edicao, troca de Etapa e de Funil, Ganhar/Perder/Reabrir, ciclo de vida, recuo D-15) e a secao Negocios das fichas de Contato e Empresa nao foram exercitadas em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | fixed |  | 2026-10-10T23:26:16.496Z | 2026-10-11T22:24:42.645Z |
| 5 | 07 | deviation | apps/api/src/e2e/lote-contas-a-pagar.test.ts |  | 07-12: npm run check nao fica verde por duas falhas pre-existentes fora do CRM (lote-contas-a-pagar 5/6 contra o banco remoto; seed de formularios-publicos.test.ts) - registradas em deferred-items.md da fase | waived | Ressalva aceita pelo dono na UAT da Fase 7 (2026-10-11, teste 1): as duas falhas do portão são pré-existentes e exclusivas do Financeiro, fora dos arquivos da fase; registradas em deferred-items.md e como override em 07-VERIFICATION.md | 2026-10-11T00:08:40.828Z | 2026-10-11T22:24:42.705Z |
| 6 | 08 | unrun-verify | .planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md |  | 08-15: UAT de fim de fase (dez passos + conferencias visuais de 08-01/02/08/09/10/11) nao exercitada no app real; resultado do dono fica em branco em 08-PROVAS.md | open |  | 2026-10-12T22:25:12.544Z |  |
| 7 | 08 | deviation | apps/api/src/persistencia/colunas-geradas.test.ts | 111 | 08-15: portao npm run check falhou nesse arquivo uma vez (empate de vencimento sem desempate no order by) e passou isolado; alem das duas falhas pre-existentes da Fase 7; ver deferred-items.md da Fase 8 | open |  | 2026-10-12T22:25:12.604Z |  |
| 8 | 09 | deviation | packages/dominio/src/derive-visibilidade.ts |  | pentest 09-21 [medio] AgentExecution.contextComposition.readRecordIds pode listar ids de registros ocultos (vaza so o id) | open |  | 2026-10-28T18:14:48.432Z |  |
| 9 | 09 | deviation | packages/dominio/src/types/ai.ts |  | pentest 09-21 [baixo] AutomationExecution.childAgentExecutionIds pode listar ids de Execucoes ocultas (vaza so o id) | open |  | 2026-10-28T18:14:48.506Z |  |
| 10 | 09 | deviation | apps/api/src/app.ts |  | pentest 09-21 [baixo/informativo] apps/api e apps/web nao enviam cabecalhos de seguranca de resposta (X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, CSP) | open |  | 2026-10-28T18:14:48.569Z |  |
| 11 | 09 | deviation | apps/api/deploy/n1-crm-limites.conf |  | pentest 09-21 [informativo] limite de taxa por IP nao existe no ambiente local/homologacao (sem nginx); provado so em Docker (09-06), pendente repetir na VPS real no 09-20 | open |  | 2026-10-28T18:14:48.632Z |  |
| 12 | 15 | deviation | packages/dominio/src/operations/ferramentas/automacoes.ts |  | 15-07: as Acoes de Automacao contato.adicionarTag e contato.definirCampo falham (Contato do CRM novo nao guarda Tag/Campo de Automacao de Ferramentas); decidir o destino no 15-17/15-22 | open |  | 2026-11-06T09:50:50.940Z |  |
| 13 | 15 | deviation | apps/web/src/app/(shell)/ia/chat/page.tsx |  | 15-08: ancorar Chat ou ensaio num Negocio, Contato, Empresa ou Conversa no navegador recusa/nomeia pelo id ate o 15-21 mandar nomes (o servidor grava certo pelas tabelas) | open |  | 2026-11-06T10:06:57.673Z |  |
| 14 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/membros/page.tsx |  | 15-36: o dialogo de remover Membro e a pagina do Membro filtram o tipo conversation de previewSuccession (so contam as Conversas das tabelas); as Conversas de Grupo do modelo antigo agora passam ao Sucessor em removeMember mas nao aparecem na contagem ate o 3.5.4 tirar o modelo antigo | open |  | 2026-11-06T10:20:00.602Z |  |
| 15 | 15 | deviation | apps/api/src/repositorios/crm/atividades.ts |  | 15-37: a paginacao de GET /atividades por cursor de tempo (ate = at da ultima linha, ISO em ms, exclusivo) pode pular linhas gravadas no mesmo instante na fronteira da pagina (now() e da transacao: um gesto com varias Atividades compartilha o em; at perde os microssegundos). Aceito no desenho do plano; trocar por cursor composto (em, id) se a Auditoria (15-09) paginar paginas cheias | fixed |  | 2026-11-06T10:29:12.443Z | 2026-11-06T12:22:04.811Z |
| 16 | 15 | deviation | apps/web/src/features/ia/automacoes/editor-de-automacao.tsx |  | 15-39: ate o 15-21 passar os Funis de useFunis, inoperante() na tela da IA mostra Automacao de escopo Funil como 'escopo eliminado (Funil)' e a aplicacao otimista de criarAutomacao com escopo Funil recusa localmente; o servidor confere certo pela tabela. Tambem escopo na lixeira vira 'escopo eliminado' em vez de 'escopo na lixeira' | open |  | 2026-11-06T10:41:35.401Z |  |
| 17 | 15 | deviation | apps/web/src/features/ferramentas/pedidos-de-entrada.tsx |  | 15-17: ate o 15-22 mandar crm, a simulacao local de Pedido de Entrada e de clique de Captacao (e a importacao de Grupos) no navegador recusa com 'Contato do participante nao resolvido.' (ou 'Canal nao encontrado.'); o servidor so resolve e cria o Contato do Participante em importarGruposDoCanal, os eventos do provedor ainda nao tem rota em POST /operacoes | open |  | 2026-11-06T10:56:35.691Z |  |
| 18 | 15 | deviation | apps/web/src/features/crm/inbox-columns.tsx |  | 15-11: Sem Atribuido, Sem Fila e Adiadas ainda nao sao filtros de GET /conversas: a Caixa pede a pagina inteira (200) e recorta na tela, entao o contador e o 'de N' desses recortes sao os da pagina, nao os do Espaco; 'Mostrar mais' tambem para em 200. Trocar por filtros na api (semAtribuido, semFila, adiadas) se um Espaco passar de 200 Conversas ativas | open |  | 2026-11-06T11:12:17.121Z |  |
| 19 | 15 | deviation | apps/web/src/features/crm/inbox-columns.tsx |  | 15-11: a linha da Conversa na lista nao mostra mais a previa da ultima Mensagem (ConversaNaLista nao traz o texto dela); mostra o titulo quando difere do nome do Contato. Acrescentar a ultima Mensagem ao resumo da lista (mesma consulta de ultimaRecebidaEm) se o dono quiser a previa de volta | open |  | 2026-11-06T11:12:17.184Z |  |
| 20 | 15 | deviation | apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx |  | 15-12: a ficha e o cartao do Canal ja nao mostram Mensagens de modelo nem 'N modelo(s) aprovado(s)': plataforma.canais nao guarda modelos (so o Canal do seed tinha) e o Canal do seed ficou sem ficha (a operacao antiga configurarCanal saiu). O Proprietario padrao de Contato do Canal fica so leitura porque PATCH /canais/:id nao aceita esse campo. Se o dono quiser editar o Proprietario padrao ou sincronizar modelos, abrir campo na api e no dominio | open |  | 2026-11-06T11:29:14.941Z |  |
| 21 | 15 | deviation | apps/web/src/features/crm/adicionar-canal-dialog.tsx |  | 15-12: o popup 'Adicionar Canal' das Listas agora so escolhe; 'Conectar um Canal novo' navega para a pagina de conectar, entao um dialogo de criar Lista meio preenchido se perde ao sair (o popup nao cria mais Canal, D-15-12). A carga por Membro na pagina da Fila conta so Conversas abertas da Fila (situacao=aberta), antes contava todas as ativas inclusive resolvidas | open |  | 2026-11-06T11:29:15.005Z |  |
| 22 | 15 | deviation | apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx |  | 15-13: Busca, Lixeira antiga, Notificacoes, /crm/meus-negocios e Caixa de Entrada ainda produzem links para ids do modelo antigo; as fichas de Contato, Empresa e Negocio nao recuam mais, entao esses links abrem 'nao encontrado' ate cada superficie migrar para o CRM novo. Decisao do plano: sem ponte de id antigo para novo; depois do script de migracao (ids preservados) o mesmo endereco abre a ficha nova | open |  | 2026-11-06T11:36:42.762Z |  |
| 23 | 15 | deviation | apps/web/src/app/(shell)/buscar/page.tsx |  | 15-14: a Busca acha Conversa so pelo titulo (GET /conversas?q= nao olha o texto das Mensagens, como a do modelo antigo olhava). Se o dono quiser a busca por conteudo, abrir o filtro na api (junto de plataforma.mensagens) e no dominio | open |  | 2026-11-06T11:50:25.871Z |  |
| 24 | 15 | deviation | apps/web/src/features/inicio/panorama-do-robo.ts |  | 15-14: o panorama do robo do Inicio ainda conta Conversas abertas do Espaco (conversas.abertas), Contatos e Negocios de state.conversations/contacts/deals; so as Conversas atribuidas a pessoa vem da api (hook useNotificacoesDoMembro). Fica para o plano do Inicio (15-18/15-23) | open |  | 2026-11-06T11:50:25.932Z |  |
| 25 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/tags/page.tsx |  | 15-16: Tags, Campos e Catalogos nao mostram mais o uso em Contato, Empresa, Negocio e Conversa (mostram 'O uso no CRM nao aparece aqui.'); tambem some a contagem de Conversa em Tags e a de Empresa em Campos, que o plano nao citava. Para devolver o numero, abrir contagem por Tag, Campo e item de Catalogo nas rotas /contatos, /empresas, /negocios e /conversas. Sem tela para conceder acesso a Funil novo privado (a Governanca so reconhece Espaco, Pasta, Lista e Colecao): o Funil novo e governado por privado e Papel | open |  | 2026-11-06T11:59:35.240Z |  |
| 26 | 15 | deviation | apps/api/src/servicos/crm/negocios.ts |  | 15-09: criar, editar, ganhar, perder e reabrir Negocio, criar Contato/Empresa e mandar Contato/Empresa a lixeira pelo CRM novo NAO gravam Atividade (escopo de D-15-09 e so Conversa, transferir Identificador, consentimento, Nota e sucessao); as telas antigas gravavam. Pergunta ao dono: quer a linha do tempo desses gestos no CRM novo antes de remover o modelo antigo? | open |  | 2026-11-06T12:22:04.882Z |  |
| 27 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx |  | 15-09: o contador '{n} Registro(s) de Atividade' e o 'de N' da Auditoria contam o state.activity inteiro mais so as paginas ja lidas do CRM novo (GET /atividades nao devolve total); cresce a cada Mostrar mais. Abrir contagem na api se o dono quiser o numero exato | open |  | 2026-11-06T12:22:04.947Z |  |
| 28 | 15 | deviation | apps/api/src/rotas/crm/nomes.ts |  | 15-10: POST /crm/nomes e leitura mas e POST, entao o Membro suspenso recebe 403 (recusarSuspensoNaEscrita, WR-03 aberto/D-15-07) e useNomesDoCrm devolve erro em vez de nomes; quem consumir (15-21 IA, Contas a receber) mostra o id ate o WR-03 liberar leituras por POST. Nenhuma tela chama a rota ainda | open |  | 2026-11-06T12:33:07.842Z |  |
| 29 | 15 | deviation | apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx |  | 15-15: a Reuniao deixou de mostrar o Diagnostico da call, o Roteiro da call (campos fd_* do Negocio), a Temperatura do Contato e os perfis de LinkedIn e TikTok: plataforma.negocios nao tem Campos personalizados e o Contato novo nao tem Temperatura nem esses tipos de Identificador (so telefone, email, whatsapp, instagram). O retrato do palco sao as iniciais (sem foto no modelo novo). O Negocio da Empresa sem Contato mostra a Empresa e diz que falta o Contato. Se o dono quiser o roteiro de volta, abrir Campos personalizados de Negocio no dominio, na api e na migracao | open |  | 2026-11-06T12:42:54.967Z |  |
| 30 | 15 | deviation | apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx |  | 15-15: nao ha ida a useFunil na Reuniao: NegocioDetalhado (GET /negocios/:id) ja traz o nome do Funil e da Etapa, entao a tela usa esse payload e poupa um pedido; o plano citava useFunil. Efeito visivel: nenhum | waived | Sem efeito visivel: so registra que a Reuniao usa o payload de useNegocio em vez de useFunil; consta no SUMMARY | 2026-11-06T12:42:55.040Z | 2026-11-06T12:43:30.199Z |
| 31 | 15 | deviation | apps/web/src/features/crm/conversation-thread.tsx |  | 15-20: o fio nao tem mais Rascunho de IA (D-15-11, adiado para a Sessao 16) nem seletor de Mensagem de modelo (plataforma.canais nao guarda modelos, ver 15-12): fora da janela de 24 h do WhatsApp oficial o envio fica desligado dizendo 'a janela expirou e o Canal nao tem Mensagem de modelo aprovada'; e o aviso de consentimento de marketing do fio saiu e volta pela regra do CRM novo no 15-25. Se o dono quiser enviar modelo pelo fio, abrir modelos no Canal (dominio, api e migracao) e o campo modeloId em POST /mensagens | open |  | 2026-11-06T13:05:24.443Z |  |
| 32 | 15 | deviation | apps/web/src/features/crm/conversation-thread.tsx |  | 15-20: a aba Meet do fio acha as Reunioes pelos Vinculos da Tarefa com os ids dos Negocios do Contato em GET /negocios?contatoId=; os Vinculos de hoje apontam para ids de Negocio do modelo antigo, entao a aba fica sem Reunioes em producao ate o script de migracao preservar os ids (mesma regra das fichas, 15-13). Tambem: o fio mostra as 200 ultimas Mensagens da Conversa, sem carregar as mais antigas | open |  | 2026-11-06T13:05:24.509Z |  |
| 33 | 15 | deviation | apps/api/src/repositorios/crm/inicio.ts |  | 15-18: "Conversas resolvidas" das estatisticas do Inicio agora conta as Conversas resolvidas de que o Membro e o Atribuido (resolvida_em), nao as que ele clicou em resolver: o modelo novo nao guarda quem resolveu e resolver nao grava Atividade (D-15-09). Reabrir e resolver de novo conta uma vez (a Conversa), nao duas. Suposicao a confirmar com o dono; se ele quiser o ato de quem clicou, gravar o Ator ao resolver (dominio, api e migracao) | open |  | 2026-11-06T13:24:05.365Z |  |
| 34 | 15 | deviation | apps/web/src/features/inicio/panorama-do-robo.ts |  | 15-18: GET /crm/inicio/panorama, /leads-a-atender e /estatisticas e os hooks usePanoramaDoCrm, useLeadsAAtender e useEstatisticasDoCrm existem, mas nenhuma tela os chama ainda: o panorama do robo do Inicio (linha 24, 15-14), o painel de Leads e as estatisticas seguem no store ate o 15-23 trocar as telas. Nao ha mudanca visivel neste plano | open |  | 2026-11-06T13:24:05.443Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/contatos/page.tsx",
    "line": null,
    "description": "07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T03:08:27.555Z",
    "resolved_at": "2026-10-11T22:24:42.450Z",
    "milestone": "v1.0"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/empresas/page.tsx",
    "line": null,
    "description": "07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T04:16:05.984Z",
    "resolved_at": "2026-10-11T22:24:42.511Z",
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/negocios/page.tsx",
    "line": null,
    "description": "07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T22:48:54.281Z",
    "resolved_at": "2026-10-11T22:24:42.571Z",
    "milestone": "v1.0"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx",
    "line": null,
    "description": "07-11: ficha de Negocio (edicao, troca de Etapa e de Funil, Ganhar/Perder/Reabrir, ciclo de vida, recuo D-15) e a secao Negocios das fichas de Contato e Empresa nao foram exercitadas em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-10-10T23:26:16.496Z",
    "resolved_at": "2026-10-11T22:24:42.645Z",
    "milestone": "v1.0"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "07",
    "file": "apps/api/src/e2e/lote-contas-a-pagar.test.ts",
    "line": null,
    "description": "07-12: npm run check nao fica verde por duas falhas pre-existentes fora do CRM (lote-contas-a-pagar 5/6 contra o banco remoto; seed de formularios-publicos.test.ts) - registradas em deferred-items.md da fase",
    "status": "waived",
    "reason": "Ressalva aceita pelo dono na UAT da Fase 7 (2026-10-11, teste 1): as duas falhas do portão são pré-existentes e exclusivas do Financeiro, fora dos arquivos da fase; registradas em deferred-items.md e como override em 07-VERIFICATION.md",
    "recorded_at": "2026-10-11T00:08:40.828Z",
    "resolved_at": "2026-10-11T22:24:42.705Z",
    "milestone": "v1.0"
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "08",
    "file": ".planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md",
    "line": null,
    "description": "08-15: UAT de fim de fase (dez passos + conferencias visuais de 08-01/02/08/09/10/11) nao exercitada no app real; resultado do dono fica em branco em 08-PROVAS.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T22:25:12.544Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "08",
    "file": "apps/api/src/persistencia/colunas-geradas.test.ts",
    "line": 111,
    "description": "08-15: portao npm run check falhou nesse arquivo uma vez (empate de vencimento sem desempate no order by) e passou isolado; alem das duas falhas pre-existentes da Fase 7; ver deferred-items.md da Fase 8",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T22:25:12.604Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "09",
    "file": "packages/dominio/src/derive-visibilidade.ts",
    "line": null,
    "description": "pentest 09-21 [medio] AgentExecution.contextComposition.readRecordIds pode listar ids de registros ocultos (vaza so o id)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.432Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "09",
    "file": "packages/dominio/src/types/ai.ts",
    "line": null,
    "description": "pentest 09-21 [baixo] AutomationExecution.childAgentExecutionIds pode listar ids de Execucoes ocultas (vaza so o id)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.506Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "09",
    "file": "apps/api/src/app.ts",
    "line": null,
    "description": "pentest 09-21 [baixo/informativo] apps/api e apps/web nao enviam cabecalhos de seguranca de resposta (X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, CSP)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.569Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "09",
    "file": "apps/api/deploy/n1-crm-limites.conf",
    "line": null,
    "description": "pentest 09-21 [informativo] limite de taxa por IP nao existe no ambiente local/homologacao (sem nginx); provado so em Docker (09-06), pendente repetir na VPS real no 09-20",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-28T18:14:48.632Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas/automacoes.ts",
    "line": null,
    "description": "15-07: as Acoes de Automacao contato.adicionarTag e contato.definirCampo falham (Contato do CRM novo nao guarda Tag/Campo de Automacao de Ferramentas); decidir o destino no 15-17/15-22",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T09:50:50.940Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/ia/chat/page.tsx",
    "line": null,
    "description": "15-08: ancorar Chat ou ensaio num Negocio, Contato, Empresa ou Conversa no navegador recusa/nomeia pelo id ate o 15-21 mandar nomes (o servidor grava certo pelas tabelas)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:06:57.673Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/configuracoes/membros/page.tsx",
    "line": null,
    "description": "15-36: o dialogo de remover Membro e a pagina do Membro filtram o tipo conversation de previewSuccession (so contam as Conversas das tabelas); as Conversas de Grupo do modelo antigo agora passam ao Sucessor em removeMember mas nao aparecem na contagem ate o 3.5.4 tirar o modelo antigo",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:20:00.602Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/repositorios/crm/atividades.ts",
    "line": null,
    "description": "15-37: a paginacao de GET /atividades por cursor de tempo (ate = at da ultima linha, ISO em ms, exclusivo) pode pular linhas gravadas no mesmo instante na fronteira da pagina (now() e da transacao: um gesto com varias Atividades compartilha o em; at perde os microssegundos). Aceito no desenho do plano; trocar por cursor composto (em, id) se a Auditoria (15-09) paginar paginas cheias",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T10:29:12.443Z",
    "resolved_at": "2026-11-06T12:22:04.811Z",
    "milestone": "v1.0"
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ia/automacoes/editor-de-automacao.tsx",
    "line": null,
    "description": "15-39: ate o 15-21 passar os Funis de useFunis, inoperante() na tela da IA mostra Automacao de escopo Funil como 'escopo eliminado (Funil)' e a aplicacao otimista de criarAutomacao com escopo Funil recusa localmente; o servidor confere certo pela tabela. Tambem escopo na lixeira vira 'escopo eliminado' em vez de 'escopo na lixeira'",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:41:35.401Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/pedidos-de-entrada.tsx",
    "line": null,
    "description": "15-17: ate o 15-22 mandar crm, a simulacao local de Pedido de Entrada e de clique de Captacao (e a importacao de Grupos) no navegador recusa com 'Contato do participante nao resolvido.' (ou 'Canal nao encontrado.'); o servidor so resolve e cria o Contato do Participante em importarGruposDoCanal, os eventos do provedor ainda nao tem rota em POST /operacoes",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T10:56:35.691Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/inbox-columns.tsx",
    "line": null,
    "description": "15-11: Sem Atribuido, Sem Fila e Adiadas ainda nao sao filtros de GET /conversas: a Caixa pede a pagina inteira (200) e recorta na tela, entao o contador e o 'de N' desses recortes sao os da pagina, nao os do Espaco; 'Mostrar mais' tambem para em 200. Trocar por filtros na api (semAtribuido, semFila, adiadas) se um Espaco passar de 200 Conversas ativas",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:12:17.121Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/inbox-columns.tsx",
    "line": null,
    "description": "15-11: a linha da Conversa na lista nao mostra mais a previa da ultima Mensagem (ConversaNaLista nao traz o texto dela); mostra o titulo quando difere do nome do Contato. Acrescentar a ultima Mensagem ao resumo da lista (mesma consulta de ultimaRecebidaEm) se o dono quiser a previa de volta",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:12:17.184Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx",
    "line": null,
    "description": "15-12: a ficha e o cartao do Canal ja nao mostram Mensagens de modelo nem 'N modelo(s) aprovado(s)': plataforma.canais nao guarda modelos (so o Canal do seed tinha) e o Canal do seed ficou sem ficha (a operacao antiga configurarCanal saiu). O Proprietario padrao de Contato do Canal fica so leitura porque PATCH /canais/:id nao aceita esse campo. Se o dono quiser editar o Proprietario padrao ou sincronizar modelos, abrir campo na api e no dominio",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:29:14.941Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 21,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/adicionar-canal-dialog.tsx",
    "line": null,
    "description": "15-12: o popup 'Adicionar Canal' das Listas agora so escolhe; 'Conectar um Canal novo' navega para a pagina de conectar, entao um dialogo de criar Lista meio preenchido se perde ao sair (o popup nao cria mais Canal, D-15-12). A carga por Membro na pagina da Fila conta so Conversas abertas da Fila (situacao=aberta), antes contava todas as ativas inclusive resolvidas",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:29:15.005Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 22,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx",
    "line": null,
    "description": "15-13: Busca, Lixeira antiga, Notificacoes, /crm/meus-negocios e Caixa de Entrada ainda produzem links para ids do modelo antigo; as fichas de Contato, Empresa e Negocio nao recuam mais, entao esses links abrem 'nao encontrado' ate cada superficie migrar para o CRM novo. Decisao do plano: sem ponte de id antigo para novo; depois do script de migracao (ids preservados) o mesmo endereco abre a ficha nova",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:36:42.762Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 23,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/buscar/page.tsx",
    "line": null,
    "description": "15-14: a Busca acha Conversa so pelo titulo (GET /conversas?q= nao olha o texto das Mensagens, como a do modelo antigo olhava). Se o dono quiser a busca por conteudo, abrir o filtro na api (junto de plataforma.mensagens) e no dominio",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:50:25.871Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 24,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/inicio/panorama-do-robo.ts",
    "line": null,
    "description": "15-14: o panorama do robo do Inicio ainda conta Conversas abertas do Espaco (conversas.abertas), Contatos e Negocios de state.conversations/contacts/deals; so as Conversas atribuidas a pessoa vem da api (hook useNotificacoesDoMembro). Fica para o plano do Inicio (15-18/15-23)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:50:25.932Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/configuracoes/tags/page.tsx",
    "line": null,
    "description": "15-16: Tags, Campos e Catalogos nao mostram mais o uso em Contato, Empresa, Negocio e Conversa (mostram 'O uso no CRM nao aparece aqui.'); tambem some a contagem de Conversa em Tags e a de Empresa em Campos, que o plano nao citava. Para devolver o numero, abrir contagem por Tag, Campo e item de Catalogo nas rotas /contatos, /empresas, /negocios e /conversas. Sem tela para conceder acesso a Funil novo privado (a Governanca so reconhece Espaco, Pasta, Lista e Colecao): o Funil novo e governado por privado e Papel",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T11:59:35.240Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 26,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/servicos/crm/negocios.ts",
    "line": null,
    "description": "15-09: criar, editar, ganhar, perder e reabrir Negocio, criar Contato/Empresa e mandar Contato/Empresa a lixeira pelo CRM novo NAO gravam Atividade (escopo de D-15-09 e so Conversa, transferir Identificador, consentimento, Nota e sucessao); as telas antigas gravavam. Pergunta ao dono: quer a linha do tempo desses gestos no CRM novo antes de remover o modelo antigo?",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T12:22:04.882Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 27,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx",
    "line": null,
    "description": "15-09: o contador '{n} Registro(s) de Atividade' e o 'de N' da Auditoria contam o state.activity inteiro mais so as paginas ja lidas do CRM novo (GET /atividades nao devolve total); cresce a cada Mostrar mais. Abrir contagem na api se o dono quiser o numero exato",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T12:22:04.947Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 28,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/rotas/crm/nomes.ts",
    "line": null,
    "description": "15-10: POST /crm/nomes e leitura mas e POST, entao o Membro suspenso recebe 403 (recusarSuspensoNaEscrita, WR-03 aberto/D-15-07) e useNomesDoCrm devolve erro em vez de nomes; quem consumir (15-21 IA, Contas a receber) mostra o id ate o WR-03 liberar leituras por POST. Nenhuma tela chama a rota ainda",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T12:33:07.842Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 29,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx",
    "line": null,
    "description": "15-15: a Reuniao deixou de mostrar o Diagnostico da call, o Roteiro da call (campos fd_* do Negocio), a Temperatura do Contato e os perfis de LinkedIn e TikTok: plataforma.negocios nao tem Campos personalizados e o Contato novo nao tem Temperatura nem esses tipos de Identificador (so telefone, email, whatsapp, instagram). O retrato do palco sao as iniciais (sem foto no modelo novo). O Negocio da Empresa sem Contato mostra a Empresa e diz que falta o Contato. Se o dono quiser o roteiro de volta, abrir Campos personalizados de Negocio no dominio, na api e na migracao",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T12:42:54.967Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 30,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx",
    "line": null,
    "description": "15-15: nao ha ida a useFunil na Reuniao: NegocioDetalhado (GET /negocios/:id) ja traz o nome do Funil e da Etapa, entao a tela usa esse payload e poupa um pedido; o plano citava useFunil. Efeito visivel: nenhum",
    "status": "waived",
    "reason": "Sem efeito visivel: so registra que a Reuniao usa o payload de useNegocio em vez de useFunil; consta no SUMMARY",
    "recorded_at": "2026-11-06T12:42:55.040Z",
    "resolved_at": "2026-11-06T12:43:30.199Z",
    "milestone": "v1.0"
  },
  {
    "id": 31,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/conversation-thread.tsx",
    "line": null,
    "description": "15-20: o fio nao tem mais Rascunho de IA (D-15-11, adiado para a Sessao 16) nem seletor de Mensagem de modelo (plataforma.canais nao guarda modelos, ver 15-12): fora da janela de 24 h do WhatsApp oficial o envio fica desligado dizendo 'a janela expirou e o Canal nao tem Mensagem de modelo aprovada'; e o aviso de consentimento de marketing do fio saiu e volta pela regra do CRM novo no 15-25. Se o dono quiser enviar modelo pelo fio, abrir modelos no Canal (dominio, api e migracao) e o campo modeloId em POST /mensagens",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T13:05:24.443Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 32,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/conversation-thread.tsx",
    "line": null,
    "description": "15-20: a aba Meet do fio acha as Reunioes pelos Vinculos da Tarefa com os ids dos Negocios do Contato em GET /negocios?contatoId=; os Vinculos de hoje apontam para ids de Negocio do modelo antigo, entao a aba fica sem Reunioes em producao ate o script de migracao preservar os ids (mesma regra das fichas, 15-13). Tambem: o fio mostra as 200 ultimas Mensagens da Conversa, sem carregar as mais antigas",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T13:05:24.509Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 33,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/repositorios/crm/inicio.ts",
    "line": null,
    "description": "15-18: \"Conversas resolvidas\" das estatisticas do Inicio agora conta as Conversas resolvidas de que o Membro e o Atribuido (resolvida_em), nao as que ele clicou em resolver: o modelo novo nao guarda quem resolveu e resolver nao grava Atividade (D-15-09). Reabrir e resolver de novo conta uma vez (a Conversa), nao duas. Suposicao a confirmar com o dono; se ele quiser o ato de quem clicou, gravar o Ator ao resolver (dominio, api e migracao)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T13:24:05.365Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 34,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/inicio/panorama-do-robo.ts",
    "line": null,
    "description": "15-18: GET /crm/inicio/panorama, /leads-a-atender e /estatisticas e os hooks usePanoramaDoCrm, useLeadsAAtender e useEstatisticasDoCrm existem, mas nenhuma tela os chama ainda: o panorama do robo do Inicio (linha 24, 15-14), o painel de Leads e as estatisticas seguem no store ate o 15-23 trocar as telas. Nao ha mudanca visivel neste plano",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T13:24:05.443Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
