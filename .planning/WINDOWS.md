---
schema_version: 1
open_count: 54
waived_count: 2
fixed_count: 22
total_count: 78
last_updated: 2026-11-07T00:07:24.279Z
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
| 13 | 15 | deviation | apps/web/src/app/(shell)/ia/chat/page.tsx |  | 15-08: ancorar Chat ou ensaio num Negocio, Contato, Empresa ou Conversa no navegador recusa/nomeia pelo id ate o 15-21 mandar nomes (o servidor grava certo pelas tabelas) | fixed |  | 2026-11-06T10:06:57.673Z | 2026-11-06T13:55:39.705Z |
| 14 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/membros/page.tsx |  | 15-36: o dialogo de remover Membro e a pagina do Membro filtram o tipo conversation de previewSuccession (so contam as Conversas das tabelas); as Conversas de Grupo do modelo antigo agora passam ao Sucessor em removeMember mas nao aparecem na contagem ate o 3.5.4 tirar o modelo antigo | open |  | 2026-11-06T10:20:00.602Z |  |
| 15 | 15 | deviation | apps/api/src/repositorios/crm/atividades.ts |  | 15-37: a paginacao de GET /atividades por cursor de tempo (ate = at da ultima linha, ISO em ms, exclusivo) pode pular linhas gravadas no mesmo instante na fronteira da pagina (now() e da transacao: um gesto com varias Atividades compartilha o em; at perde os microssegundos). Aceito no desenho do plano; trocar por cursor composto (em, id) se a Auditoria (15-09) paginar paginas cheias | fixed |  | 2026-11-06T10:29:12.443Z | 2026-11-06T12:22:04.811Z |
| 16 | 15 | deviation | apps/web/src/features/ia/automacoes/editor-de-automacao.tsx |  | 15-39: ate o 15-21 passar os Funis de useFunis, inoperante() na tela da IA mostra Automacao de escopo Funil como 'escopo eliminado (Funil)' e a aplicacao otimista de criarAutomacao com escopo Funil recusa localmente; o servidor confere certo pela tabela. Tambem escopo na lixeira vira 'escopo eliminado' em vez de 'escopo na lixeira' | fixed |  | 2026-11-06T10:41:35.401Z | 2026-11-06T13:55:39.779Z |
| 17 | 15 | deviation | apps/web/src/features/ferramentas/pedidos-de-entrada.tsx |  | 15-17: ate o 15-22 mandar crm, a simulacao local de Pedido de Entrada e de clique de Captacao (e a importacao de Grupos) no navegador recusa com 'Contato do participante nao resolvido.' (ou 'Canal nao encontrado.'); o servidor so resolve e cria o Contato do Participante em importarGruposDoCanal, os eventos do provedor ainda nao tem rota em POST /operacoes | fixed |  | 2026-11-06T10:56:35.691Z | 2026-11-06T14:14:34.729Z |
| 18 | 15 | deviation | apps/web/src/features/crm/inbox-columns.tsx |  | 15-11: Sem Atribuido, Sem Fila e Adiadas ainda nao sao filtros de GET /conversas: a Caixa pede a pagina inteira (200) e recorta na tela, entao o contador e o 'de N' desses recortes sao os da pagina, nao os do Espaco; 'Mostrar mais' tambem para em 200. Trocar por filtros na api (semAtribuido, semFila, adiadas) se um Espaco passar de 200 Conversas ativas | open |  | 2026-11-06T11:12:17.121Z |  |
| 19 | 15 | deviation | apps/web/src/features/crm/inbox-columns.tsx |  | 15-11: a linha da Conversa na lista nao mostra mais a previa da ultima Mensagem (ConversaNaLista nao traz o texto dela); mostra o titulo quando difere do nome do Contato. Acrescentar a ultima Mensagem ao resumo da lista (mesma consulta de ultimaRecebidaEm) se o dono quiser a previa de volta | open |  | 2026-11-06T11:12:17.184Z |  |
| 20 | 15 | deviation | apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx |  | 15-12: a ficha e o cartao do Canal ja nao mostram Mensagens de modelo nem 'N modelo(s) aprovado(s)': plataforma.canais nao guarda modelos (so o Canal do seed tinha) e o Canal do seed ficou sem ficha (a operacao antiga configurarCanal saiu). O Proprietario padrao de Contato do Canal fica so leitura porque PATCH /canais/:id nao aceita esse campo. Se o dono quiser editar o Proprietario padrao ou sincronizar modelos, abrir campo na api e no dominio | open |  | 2026-11-06T11:29:14.941Z |  |
| 21 | 15 | deviation | apps/web/src/features/crm/adicionar-canal-dialog.tsx |  | 15-12: o popup 'Adicionar Canal' das Listas agora so escolhe; 'Conectar um Canal novo' navega para a pagina de conectar, entao um dialogo de criar Lista meio preenchido se perde ao sair (o popup nao cria mais Canal, D-15-12). A carga por Membro na pagina da Fila conta so Conversas abertas da Fila (situacao=aberta), antes contava todas as ativas inclusive resolvidas | open |  | 2026-11-06T11:29:15.005Z |  |
| 22 | 15 | deviation | apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx |  | 15-13: Busca, Lixeira antiga, Notificacoes, /crm/meus-negocios e Caixa de Entrada ainda produzem links para ids do modelo antigo; as fichas de Contato, Empresa e Negocio nao recuam mais, entao esses links abrem 'nao encontrado' ate cada superficie migrar para o CRM novo. Decisao do plano: sem ponte de id antigo para novo; depois do script de migracao (ids preservados) o mesmo endereco abre a ficha nova | fixed |  | 2026-11-06T11:36:42.762Z | 2026-11-06T19:45:26.075Z |
| 23 | 15 | deviation | apps/web/src/app/(shell)/buscar/page.tsx |  | 15-14: a Busca acha Conversa so pelo titulo (GET /conversas?q= nao olha o texto das Mensagens, como a do modelo antigo olhava). Se o dono quiser a busca por conteudo, abrir o filtro na api (junto de plataforma.mensagens) e no dominio | open |  | 2026-11-06T11:50:25.871Z |  |
| 24 | 15 | deviation | apps/web/src/features/inicio/panorama-do-robo.ts |  | 15-14: o panorama do robo do Inicio ainda conta Conversas abertas do Espaco (conversas.abertas), Contatos e Negocios de state.conversations/contacts/deals; so as Conversas atribuidas a pessoa vem da api (hook useNotificacoesDoMembro). Fica para o plano do Inicio (15-18/15-23) | fixed |  | 2026-11-06T11:50:25.932Z | 2026-11-06T17:53:47.740Z |
| 25 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/tags/page.tsx |  | 15-16: Tags, Campos e Catalogos nao mostram mais o uso em Contato, Empresa, Negocio e Conversa (mostram 'O uso no CRM nao aparece aqui.'); tambem some a contagem de Conversa em Tags e a de Empresa em Campos, que o plano nao citava. Para devolver o numero, abrir contagem por Tag, Campo e item de Catalogo nas rotas /contatos, /empresas, /negocios e /conversas. Sem tela para conceder acesso a Funil novo privado (a Governanca so reconhece Espaco, Pasta, Lista e Colecao): o Funil novo e governado por privado e Papel | open |  | 2026-11-06T11:59:35.240Z |  |
| 26 | 15 | deviation | apps/api/src/servicos/crm/negocios.ts |  | 15-09: criar, editar, ganhar, perder e reabrir Negocio, criar Contato/Empresa e mandar Contato/Empresa a lixeira pelo CRM novo NAO gravam Atividade (escopo de D-15-09 e so Conversa, transferir Identificador, consentimento, Nota e sucessao); as telas antigas gravavam. Pergunta ao dono: quer a linha do tempo desses gestos no CRM novo antes de remover o modelo antigo? | open |  | 2026-11-06T12:22:04.882Z |  |
| 27 | 15 | deviation | apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx |  | 15-09: o contador '{n} Registro(s) de Atividade' e o 'de N' da Auditoria contam o state.activity inteiro mais so as paginas ja lidas do CRM novo (GET /atividades nao devolve total); cresce a cada Mostrar mais. Abrir contagem na api se o dono quiser o numero exato | open |  | 2026-11-06T12:22:04.947Z |  |
| 28 | 15 | deviation | apps/api/src/rotas/crm/nomes.ts |  | 15-10: POST /crm/nomes e leitura mas e POST, entao o Membro suspenso recebe 403 (recusarSuspensoNaEscrita, WR-03 aberto/D-15-07) e useNomesDoCrm devolve erro em vez de nomes; quem consumir (15-21 IA, Contas a receber) mostra o id ate o WR-03 liberar leituras por POST. Nenhuma tela chama a rota ainda | open |  | 2026-11-06T12:33:07.842Z |  |
| 29 | 15 | deviation | apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx |  | 15-15: a Reuniao deixou de mostrar o Diagnostico da call, o Roteiro da call (campos fd_* do Negocio), a Temperatura do Contato e os perfis de LinkedIn e TikTok: plataforma.negocios nao tem Campos personalizados e o Contato novo nao tem Temperatura nem esses tipos de Identificador (so telefone, email, whatsapp, instagram). O retrato do palco sao as iniciais (sem foto no modelo novo). O Negocio da Empresa sem Contato mostra a Empresa e diz que falta o Contato. Se o dono quiser o roteiro de volta, abrir Campos personalizados de Negocio no dominio, na api e na migracao | open |  | 2026-11-06T12:42:54.967Z |  |
| 30 | 15 | deviation | apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx |  | 15-15: nao ha ida a useFunil na Reuniao: NegocioDetalhado (GET /negocios/:id) ja traz o nome do Funil e da Etapa, entao a tela usa esse payload e poupa um pedido; o plano citava useFunil. Efeito visivel: nenhum | waived | Sem efeito visivel: so registra que a Reuniao usa o payload de useNegocio em vez de useFunil; consta no SUMMARY | 2026-11-06T12:42:55.040Z | 2026-11-06T12:43:30.199Z |
| 31 | 15 | deviation | apps/web/src/features/crm/conversation-thread.tsx |  | 15-20: o fio nao tem mais Rascunho de IA (D-15-11, adiado para a Sessao 16) nem seletor de Mensagem de modelo (plataforma.canais nao guarda modelos, ver 15-12): fora da janela de 24 h do WhatsApp oficial o envio fica desligado dizendo 'a janela expirou e o Canal nao tem Mensagem de modelo aprovada'; e o aviso de consentimento de marketing do fio saiu e volta pela regra do CRM novo no 15-25. Se o dono quiser enviar modelo pelo fio, abrir modelos no Canal (dominio, api e migracao) e o campo modeloId em POST /mensagens | open |  | 2026-11-06T13:05:24.443Z |  |
| 32 | 15 | deviation | apps/web/src/features/crm/conversation-thread.tsx |  | 15-20: a aba Meet do fio acha as Reunioes pelos Vinculos da Tarefa com os ids dos Negocios do Contato em GET /negocios?contatoId=; os Vinculos de hoje apontam para ids de Negocio do modelo antigo, entao a aba fica sem Reunioes em producao ate o script de migracao preservar os ids (mesma regra das fichas, 15-13). Tambem: o fio mostra as 200 ultimas Mensagens da Conversa, sem carregar as mais antigas | fixed |  | 2026-11-06T13:05:24.509Z | 2026-11-06T19:45:26.144Z |
| 33 | 15 | deviation | apps/api/src/repositorios/crm/inicio.ts |  | 15-18: "Conversas resolvidas" das estatisticas do Inicio agora conta as Conversas resolvidas de que o Membro e o Atribuido (resolvida_em), nao as que ele clicou em resolver: o modelo novo nao guarda quem resolveu e resolver nao grava Atividade (D-15-09). Reabrir e resolver de novo conta uma vez (a Conversa), nao duas. Suposicao a confirmar com o dono; se ele quiser o ato de quem clicou, gravar o Ator ao resolver (dominio, api e migracao) | open |  | 2026-11-06T13:24:05.365Z |  |
| 34 | 15 | deviation | apps/web/src/features/inicio/panorama-do-robo.ts |  | 15-18: GET /crm/inicio/panorama, /leads-a-atender e /estatisticas e os hooks usePanoramaDoCrm, useLeadsAAtender e useEstatisticasDoCrm existem, mas nenhuma tela os chama ainda: o panorama do robo do Inicio (linha 24, 15-14), o painel de Leads e as estatisticas seguem no store ate o 15-23 trocar as telas. Nao ha mudanca visivel neste plano | fixed |  | 2026-11-06T13:24:05.443Z | 2026-11-06T17:53:47.911Z |
| 35 | 15 | deviation | packages/dominio/src/operations/automations.ts |  | 15-19: as Automacoes de Contas a receber ({{cliente}}, {{donoDoCliente}}, mentionClientOwner) ainda leem nome e dono do cliente em state.contacts (contatoDoCliente); clienteDe agora so devolve a referencia. Uma serie criada para um Contato de plataforma.contatos (id fora do modelo antigo) faz o comentario de cobranca dizer 'o cliente' e nao mencionar o dono dele; as contas do modelo antigo seguem como antes. automations.ts entrou na lista CONGELADOS do sem-crm-antigo do dominio. Resolver injetando nome e dono por OpcoesDaAgenda (como cnpjPorEmpresa) lidos das tabelas, antes do 3.5.4 tirar state.contacts | fixed |  | 2026-11-06T13:42:09.740Z | 2026-11-06T22:38:14.159Z |
| 36 | 15 | deviation | apps/web/src/features/estrutura/financeiro/use-nomes-dos-clientes.ts |  | 15-19: o nome do cliente de Contas a receber vem de POST /crm/nomes; sem nome (carregando, Membro suspenso por WR-03, Papel sem ler Contato) a lista, o cartao e a busca mostram 'Cliente'; o cartao financeiro faz uma chamada por cartao visivel; a serie so aceita Contato como cliente (Empresa nao, o input da operacao tem so contactId); createReceivableSeries ganhou o 4o argumento clientes (opcional, vazio recusa) | open |  | 2026-11-06T13:42:09.807Z |  |
| 37 | 15 | deviation | apps/web/src/features/ferramentas/criar-grupo-dialog.tsx |  | 15-22: o link de convite do Novo Grupo nao sai para os convidados: enviarLinkDeConvite abre a Conversa 1:1 por startConversation, que ainda le Canal e Contato do modelo antigo (state.contacts), e o Contato da ficha nova nao esta la; o Grupo nasce e a tela avisa 'o link de convite nao saiu: <nome>: Contato nao encontrado.'. Resolver quando a Conversa 1:1 do convite passar ao modelo novo (Sessao 6 / 3.5.4) | fixed |  | 2026-11-06T14:14:34.792Z | 2026-11-06T22:38:14.226Z |
| 38 | 15 | deviation | apps/web/src/features/ferramentas/conversa-do-grupo.tsx |  | 15-22: na Conversa do Grupo a Mensagem recebida de um participante mostra 'Participante' em vez do nome: o Identificador da Mensagem (viaIdentifierId) era de um Contato do modelo antigo e o Contato da ficha nova nao tem como casar com ele. Volta a ter nome quando a Mensagem de Grupo passar ao modelo novo (Sessao 6) | open |  | 2026-11-06T14:14:34.854Z |  |
| 39 | 15 | deviation | apps/web/src/features/ferramentas/flow-popup.tsx |  | 15-22: enviar o Flow a um Contato continua escolhendo uma Conversa 1:1 de state.conversations (enviarFlow recebe conversationId, F14-D-05), nao o seletor de Contatos com WhatsApp que o plano citava; o nome vem de POST /crm/nomes (sem nome, o titulo da Conversa). Um Contato da ficha nova sem Conversa no modelo antigo nao e enviavel. Resolver quando o envio e a resposta de Flow passarem ao modelo novo (Sessao 7) | open |  | 2026-11-06T14:14:34.917Z |  |
| 40 | 15 | deviation | apps/web/src/features/crm/coluna-do-contato.tsx |  | 15-24: a coluna do Contato da Caixa nao tem mais o ponto verde de janela de resposta aberta, as acoes LinkedIn e Tarefa (virou Instagram e Abrir ficha), o resumo escrito pelo Agente Enriquecedor (mostra a descricao do Contato) nem a temperatura (D-15-06); o painel Tags da Conversa saiu porque plataforma.conversas nao guarda Tags. Se o dono quiser o ponto da janela ou as Tags da Conversa de volta, abrir na api e no dominio | open |  | 2026-11-06T14:33:24.856Z |  |
| 41 | 15 | deviation | apps/web/src/features/crm/conversa-de-grupo-na-caixa.tsx |  | 15-24: a Conversa de grupo aberta na Caixa (id que a api responde 404 e o store conhece como Conversa de grupo, F14-D-05) ainda resolve, reabre, atribui e manda para a lixeira pelas operacoes antigas do store; so sai quando o Grupo passar ao modelo novo (Sessoes 6 e 7). Nenhuma outra tela da Caixa usa essas operacoes | open |  | 2026-11-06T14:33:24.919Z |  |
| 42 | 15 | deviation | apps/web/src/features/estrutura/tarefa-completa.tsx |  | 15-25: a lista de Vinculos da ficha da Tarefa mostra 'Registro indisponivel' (sem atalho) para Negocio, Contato e Conversa cujo id POST /crm/nomes nao conhece; os Vinculos de hoje em producao apontam para ids do modelo antigo, entao ate o script de migracao preservar os ids a ficha cai no layout de sempre com o aviso 'sem Contato' (resumo.contato null) e os nomes dos Vinculos nao aparecem. Antes o nome vinha do estado antigo | fixed |  | 2026-11-06T14:45:41.424Z | 2026-11-06T19:45:26.216Z |
| 43 | 15 | deviation | apps/web/src/features/crm/conversation-thread.tsx |  | 15-25: o aviso de consentimento de marketing do fio e so aviso (nao bloqueia o envio) e aparece sempre que o consentimento vigente de Marketing no tipo do Canal da aba nao e 'concedido', inclusive Contato sem nenhum registro, porque o fio nao tem seletor de modelo (antes o aviso so existia com um modelo de marketing escolhido). Se o dono achar ruidoso para quem nunca teve consentimento registrado, restringir a 'revogado' ou ligar ao modelo quando houver Mensagem de modelo | open |  | 2026-11-06T14:45:41.486Z |  |
| 44 | 15 | deviation | apps/web/src/app/(shell)/crm/negocios/page.tsx |  | 15-26: o plano e F14-D-06 mandam o filtro Meus para o quadro de /crm/funis/[funil], mas essa rota e a ficha do Funil e nao tem quadro; o quadro (QuadroDoFunil) mora em /crm/negocios. O botao Meus (?meus=1) e o atalho do menu foram para /crm/negocios; o dono decide se quer tambem um quadro na ficha do Funil | open |  | 2026-11-06T14:59:26.597Z |  |
| 45 | 15 | deviation | apps/web/src/features/shell/app-shell.tsx |  | 15-26: o painel do CRM perdeu o grupo Pastas de Negocios (arvore da Pasta Meus negocios) para todos os Espacos e ganhou o atalho Meus negocios para /crm/negocios?meus=1; favoritos de /crm/meus-negocios agora caem no 404 do app (T-15-63 aceito) | open |  | 2026-11-06T14:59:26.663Z |  |
| 46 | 15 | deviation | apps/web/src/features/inicio/resumo-do-inicio.tsx |  | 15-23: Mensagens novas do Inicio perdeu o trecho da ultima Mensagem (a lista GET /conversas nao o traz; o dono ve so nome, quantas nao lidas e quando). Quando o total de Conversas com Mensagem nova passa de 200 o atalho diz 'nas primeiras N de M Conversas' e a soma de nao lidas e so das lidas. Leads a atender mostra iniciais no avatar (o modelo novo nao tem foto) e a api devolve no maximo 50 (o atalho avisa) | open |  | 2026-11-06T17:53:48.102Z |  |
| 47 | 15 | deviation | apps/web/src/features/inicio/resumo-do-inicio.tsx |  | 15-23: Estatisticas do Inicio pedem duas janelas a api (atual e anterior; a api aceita 400 dias e o ano com o anterior passa de 700) e comparam por dia inteiro: o primeiro dia do periodo anterior entra inteiro, nao so a partir do instante exato. Sem escolha da pessoa a metrica aberta e a de maior valor do periodo atual (antes so da semana) e pode mudar ao trocar de periodo ate o primeiro clique. Se a api recusa, as tres metricas do CRM ficam zeradas com um aviso | open |  | 2026-11-06T17:53:48.270Z |  |
| 48 | 15 | deviation | apps/web/src/app/(shell)/paineis/[painel]/page.tsx |  | 15-23: Paineis semeados (SDR, Closer, Atendimento) tem Fonte com ids do modelo antigo (fnl_sdr, fnl_closer, fila_com, inbox_n1): lendo o CRM novo eles abrem zerados ate a Fonte apontar para um Funil/Fila novo (Sessao 20.3). Widgets de Origem e Motivo de Perda ficam sem linhas porque NegocioResumo nao traz origem/motivoPerda (texto livre no Negocio novo). Cada Widget le ate 200 registros por recurso e diz 'Parcial: primeiros 200' quando ha mais; Etapas vem de uma GET /funis/:id por Funil lido | open |  | 2026-11-06T17:53:48.437Z |  |
| 49 | 15 | deviation | apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx |  | 15-40: a Lista conversacional so afirma 'sem canais' (aviso, Atende por e recusa de criar Tarefa) com a resposta de GET /canais na mao (so os Canais ativos, ate 200); enquanto carrega, ou se a api falha, o aviso e a linha 'Atende por' nao aparecem e o botao Nova Tarefa nao e desligado por falta de Canal (o servidor continua barrando). Uma Lista cujo canaisDeAtendimento guarda ids que nao estao em plataforma.canais (ids do Canal antigo, antes do script de migracao preservar ids) mostra o aviso de Lista sem Canal. O quadro da Lista conversacional ficou: quadro-negocios.tsx virou quadro-conversacional.tsx (so o card de Negocio e o subtotal em dinheiro sairam), em vez de ser apagado como o plano dizia | fixed |  | 2026-11-06T18:25:31.533Z | 2026-11-06T19:45:26.283Z |
| 50 | 15 | deviation | apps/api/src/migracao-crm/migrar-crm-antigo.ts |  | 15-27: o --migrar do script so cobre o Funil: recusa, antes de escrever, o Espaco com Contatos, Empresas, Vinculos, Negocios, Canais ou Conversas comuns ('use --guardar'); o mapeador dessas entidades e o plano 15-28. A decisao do Funil (--funil=migrar ou guardar) vale antes da primeira escrita: depois de um --guardar o Funil ja saiu de registros e o script nao o le da copia (trazer depois = recriar pela tela de Funis) | fixed |  | 2026-11-06T19:14:14.649Z | 2026-11-06T19:45:26.348Z |
| 51 | 15 | deviation | apps/api/src/migracao-crm/pasta-meus-negocios.ts |  | 15-27: a Pasta Meus negocios com Tarefa em qualquer Lista nao sai (esperado nos 17 Espacos de teste; o dono ve no --seco) e, quando sai, o script nao reescreve referencias de fora as Listas removidas (Automacao ou Formulario com escopo na Lista). No ws_n1 a Pasta provavelmente nem existe (o bootstrap nao a cria); o dono confere no --seco antes do corte | open |  | 2026-11-06T19:14:14.718Z |  |
| 52 | 15 | deviation | apps/api/src/migracao-crm/funil.ts |  | 15-27: nenhum id antigo e reescrito e nenhum link, Vinculo ou canaisDeAtendimento para Negocio, Contato ou Canal antigo e resolvido por este plano: as linhas antigas ficam em registros_crm_antigo com o id original, e so Funil (id preservado) e Etapa (id novo, crm_de_para colecao_antiga funnels/stages, id_antigo funil/etapa) chegam ao CRM novo. Os avisos 22, 32, 42 e 49 (15-40) seguem abertos ate o 15-28 preservar os ids dos Negocios, Contatos e Canais e o corte (15-34/15-35) rodar | fixed |  | 2026-11-06T19:14:14.783Z | 2026-11-06T19:45:26.412Z |
| 53 | 15 | deviation | apps/api/src/migracao-crm/mapeador.ts |  | 15-28: o que o --migrar NAO leva as tabelas novas (fica so em registros_crm_antigo e aparece em 'Nao migrados' do --seco): temperatura e Tags dos Contatos; Identificadores de LinkedIn, TikTok e chat do site; Canal do LinkedIn e do chat do site e as Conversas deles (os Vinculos de Tarefa para essas Conversas seguem 'Registro indisponivel'); Empresa sem vinculo admin vigente e os Negocios dela; no Negocio, codigo legivel, campos personalizados, historico de Etapas e os Contatos alem do dono (todo Negocio com Empresa perde o Contato); vinculos Empresa-Empresa e 'distinto de'; Mensagem de Flow migra sem o Flow. No seed sintetico: 35 temperaturas, 25 Contatos com Tags, 32 Identificadores sem destino, 5 Conversas de canal sem destino, 19 Negocios com detalhes perdidos. O dono le a lista no --seco de cada Espaco antes do corte (15-34/15-35) | open |  | 2026-11-06T19:45:42.126Z |  |
| 54 | 15 | deviation | apps/api/src/migracao-crm/mapeador.ts |  | 15-28: campos personalizados de Contato e Empresa entram em campos_adicionais com o id da Definicao como chave (ex. fd_signo), sem rotulo, e valor em lista fica de fora; o Canal migrado entra desconectado (a conexao real so vem do provedor); Qualificacao e Origem do Contato levam o id do Catalogo como texto (a tela mostra o rotulo so se o id existe no Catalogo) | open |  | 2026-11-06T19:45:42.191Z |  |
| 55 | 15 | unrun-verify | apps/api/src/migracao-crm/migrar-entidades.test.ts |  | 15-28: os avisos 22, 32, 42, 49, 50 e 52 foram dados como corrigidos pelo codigo e pelos testes em Docker (ids antigos preservados, Vinculos achando o id); em producao o efeito so existe depois que o dono rodar o --migrar nos Espacos com CRM antigo (15-34/15-35). Antes disso os Vinculos a ids antigos seguem 'nao encontrado'. Nada foi rodado contra banco real | open |  | 2026-11-06T19:45:42.257Z |  |
| 56 | 15 | deviation | apps/api/src/bootstrap/crm-demo.test.ts |  | 15-29: o teste dos Vinculos do demo le buildSeed().links; quando o 15-31 tirar o CRM e os Vinculos do seed, procurados fica 0 e o teste (que exige contact, conversation e deal achados) quebra. O 15-31 precisa trocar a fonte dos Vinculos (por exemplo, a lista de ids que o proprio seed novo guarda em registros) ou ajustar o caso, sem perder a prova de que os ids preservados acham o registro. | fixed |  | 2026-11-06T19:59:51.284Z | 2026-11-06T20:48:49.716Z |
| 57 | 15 | deviation | apps/api/src/bootstrap/crm-demo.json |  | 15-29: o demo traz so o que o mapeador do 15-28 migra para as tabelas novas: sem temperatura e Tags dos Contatos, sem o Canal do LinkedIn e do chat do site e as Conversas deles (3 Canais e 16 Conversas, contra 5 e 23 do seed antigo), Canais desconectada e 160 itens listados em naoMigrados. A Caixa de dev fica mais magra que a do seed antigo; nao ha Canal conectado nem envio real. | open |  | 2026-11-06T19:59:51.351Z |  |
| 58 | 15 | unrun-verify | apps/api/src/bootstrap/crm-demo.cli.ts |  | 15-29: bootstrap:crm-demo foi provado so em Postgres de Docker (testes e uma execucao de npm run em Espaco criado a mao); nenhuma tela do apps/web foi aberta sobre o Espaco carregado, entao a Caixa cheia em desenvolvimento nao foi vista no navegador. | open |  | 2026-11-06T19:59:51.413Z |  |
| 59 | 15 | deviation | .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md |  | 15-30: o ensaio rodou sobre a copia de 2026-11-05 (dump 11:13, CSV 10:11), nao sobre uma copia renovada: o dono nao renovou e mandou 'pode fazer o que precisar para fechar a fase'. Vale para aquele momento; o corte (15-34/15-35) precisa rodar o --seco do dia em cada Espaco, e o dono pode renovar a copia e repetir o ensaio antes. A copia tem 19 Espacos e nao 18 (ws_agendaworker_* sem nenhuma linha em registros); no dump o ws_n1 tem no CRM novo 2 Contatos, 1 Empresa, 2 Funis, 6 Etapas e 1 Negocio, que nao foram recopiados | open |  | 2026-11-06T20:19:25.592Z |  |
| 60 | 15 | deviation | .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md |  | 15-30: decisao do Funil do ws_n1 e achados da Pasta. O CRM antigo do ws_n1 tem so o Funil fnl_padrao 'Padrao' (1 Etapa 'Novo', nenhum Negocio, nenhum Contato); --funil=guardar deixa o CRM novo como esta (2 Funis, 6 Etapas), --funil=migrar acrescenta 1 Funil vazio e 1 Etapa (3 Funis, 7 Etapas, 2 linhas de crm_de_para), sem nome em uso. A Pasta Meus negocios nao existe no ws_n1; em 16 dos 18 Espacos de teste ela tem Tarefa em 4 Listas (18 Tarefas) e por isso nao sai (atualiza o aviso 51: sao 16, nao 17). O dono decide o Funil no --seco do dia | open |  | 2026-11-06T20:19:25.669Z |  |
| 61 | 15 | deviation | packages/dominio/src/seed.ts |  | 15-31: as Automacoes do seed com escopo de Lista espelho (aut_clo_proposta, escopo lst_funil_closer) e as Acoes criar_tarefa com alvo lst_funil_sdr/lst_funil_closer apontam para Listas que sairam do seed com a Pasta Meus negocios; num estado novo a aut_clo_proposta nasce inoperante (escopo eliminado (Lista)). seed-ia.test.ts e ia/automacoes.test.ts passaram a esperar isso. Alguem precisa decidir o destino delas (mover para o Funil, ou remover) antes do 15-41. | open |  | 2026-11-06T20:48:44.453Z |  |
| 62 | 15 | deviation | packages/dominio/src/seed-ferramentas.ts |  | 15-31: sem Contato, Canal e Conversa do CRM no seed, saiu do seed o que as Ferramentas faziam SOBRE eles: os Envios e Respostas de Flow nas Conversas cnv_5/9/13/17 (4 Mensagens e 2 Registros de Atividade), a Tag Em grupo de alunos nos Contatos e o groupsEnabled do Canal chn_wpp. O Flow, as versoes, os Grupos, as Participacoes por id e as Conversas de Grupo ficam. As metricas do Flow nascem com zero envios e o demo (bootstrap:crm-demo) nao liga Grupos no Canal. | open |  | 2026-11-06T20:48:44.567Z |  |
| 63 | 15 | deviation | packages/dominio/src/operations/ferramentas.test.ts |  | 15-31: ferramentas.test.ts (Grupo, Comunidade e Flow, 15-07/15-17) depende do Canal, dos Contatos e das Conversas do CRM antigo e dos Envios de Flow; reescrever as 933 linhas passou do escopo do plano, entao o beforeEach usa semearCrmAntigo(buildSeed()). O 15-43 apaga semearCrmAntigo mas Grupo/Flow ficam ate as Sessoes 6 e 7: este teste precisa montar Canal, Contatos e Conversas proprios antes do 15-43. | fixed |  | 2026-11-06T20:48:44.683Z | 2026-11-06T22:38:14.292Z |
| 64 | 15 | deviation | packages/dominio/src/seed-produto.ts |  | 15-31: as Reunioes do processo comercial (tsk_reuniao_1/2/3 e tsk_call_ref, ligadas a Negocio) moravam no seed do produto na Lista de Meus negocios do Funil; sem a Pasta, a poda as leva junto com a arvore de demonstracao, e buildProductSeed() nasce sem Tarefa de hoje para o Thiago. rehomeMeetings saiu. O seed do produto so e usado em testes; derive-resumo.test.ts passou a conferir o seed completo. | open |  | 2026-11-06T20:48:44.782Z |  |
| 65 | 15 | deviation | packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts |  | 15-32: o plano mandava apagar operations/conversations.ts e tirar os 11 nomes de Conversa de OPERACOES, mas Grupo, Flow e Automacao (F14-D-05) ainda chamam startConversation, sendMessage, sendMessageSemConferencia e receiveMessage, e a Conversa de grupo na Caixa ainda resolve, reabre, atribui, estrela e manda para a lixeira pelo store (linha 41). Ficaram em ferramentas/conversa-de-grupo.ts (com recusaDeEscritaNoCrmAntigo, que era de crm-antigo.ts): so resolveConversation, reopenConversation, assignConversation, trashConversation e toggleConversationStar seguem em OPERACOES e no barril; por isso 40 nomes (nao 45) respondem 404 em POST /operacoes/:nome. Sai com Grupo e Flow (Sessoes 6 e 7); 15-42 e 15-43 nao podem apagar este arquivo, e a linha 37 (startConversation le Canal e Contato antigos) continua valendo. | open |  | 2026-11-06T21:19:55.942Z |  |
| 66 | 15 | deviation | packages/dominio/src/operations/sobre-o-crm-antigo.test.ts |  | 15-32: os blocos de operations.test.ts que nao testavam so operacao apagada (Mensageria e Adocao de Rascunho de sendMessage/receiveMessage, Suspeita de Duplicidade, Leitura de Widget, Barra global, Modelo de Tarefa da Lista com Contato antigo) foram movidos sem mudar para sobre-o-crm-antigo.test.ts, que ainda usa semearCrmAntigo; crm/capacidades.test.ts tambem (sendMessage fora da janela, estado antigo). operations.test.ts ficou sem semearCrmAntigo. O 15-42 apaga as leituras antigas com os blocos delas e o 15-43 apaga semearCrmAntigo: o que valer para o CRM novo precisa ser reescrito sobre as tabelas antes. | fixed |  | 2026-11-06T21:19:56.005Z | 2026-11-06T22:38:14.359Z |
| 67 | 15 | deviation | packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts |  | 15-33: com a ponte dos Canais fora de GET /estado e de executar(), state.channels deixou de ter o Canal de plataforma.canais. Para Grupo, Flow e Automacao continuarem enviando, sendMessage, startConversation e receiveMessage (conversa-de-grupo.ts) acham o Canal primeiro em state.channels e, na falta dele, no crm.canais que o servidor le da tabela (canalPeloId + canalComoChannel; SendMessageInput ganhou crm opcional; grupos.ts, flows.ts e automacoes.ts o repassam). NAO e projecao: o Canal nao entra no estado nem e gravado. Mensagens de modelo seguem vazias (a tabela nao guarda modelos, linha 20). Sai com o arquivo, nas Sessoes 6 e 7; as linhas 35, 37 e 41 continuam abertas (Contato antigo ainda e lido de state.contacts). | open |  | 2026-11-06T21:40:47.161Z |  |
| 68 | 15 | deviation | apps/api/src/servicos/crm/canais.ts |  | 15-33: criar ou renomear um Canal deixou de conferir nome e conta contra os Canais antigos de plataforma.registros (canalAntigoEmConflito saiu; o Canal so existe em plataforma.canais). Antes do corte, um Canal novo pode repetir nome ou numero de um chn_* antigo; o --seco e o --migrar do 15-28 relatam canal-repetido e id-ja-existe, e o chn_* antigo repetido fica de fora do que o --migrar leva (so em registros_crm_antigo). Tambem saiu o campo canaisMs da medicao de executar() (MedicaoDaExecucao e a linha 'gravacao medida'): nao ha mais leitura de Canal para medir; idasEVoltas de uma gravacao comum e 2 tambem na primeira do processo. | open |  | 2026-11-06T21:40:47.230Z |  |
| 69 | 15 | deviation | apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx |  | 15-41: a Lista da Pasta Meus negocios ainda esconde as Tarefas com proveniencia 'deal' (filtro pastaDeNegocios, que le MEUS_NEGOCIOS_ID); o resto da tela ja a trata como Pasta comum. Sai com a Pasta (script de migracao, D-15-14) e com a constante (15-43), ou antes se o dono quiser ver essas Tarefas nos Espacos de teste | fixed |  | 2026-11-06T22:01:19.208Z | 2026-11-06T23:04:48.601Z |
| 70 | 15 | deviation | packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts |  | 15-42: com o Contato lido de crm.contatos (WINDOWS #37), receiveMessage nao devolve mais a ativo o Contato arquivado ou na lixeira que recebe Mensagem (RN-CON-13): a tabela plataforma.contatos nao e gravada por esta composicao, entao a Resposta de Flow e a Mensagem recebida entram na Conversa e o estado do Contato fica como o servidor o leu. Tambem saiu a conferencia do consentimento de marketing do Contato antigo no envio (o Canal da tabela nao guarda Mensagens de modelo, linha 20). Se o dono quiser a restauracao por Mensagem recebida, ela precisa de um aoConfirmar que grave o Contato | open |  | 2026-11-06T22:38:24.018Z |  |
| 71 | 15 | deviation | packages/dominio/src/operations/automations.ts |  | 15-42: o nome e o dono do cliente das Automacoes de Contas a receber (R4/R5) chegam por OpcoesDaAgenda.clientes, lidos de plataforma.contatos pelo scheduler-worker na transacao da volta (apps/api/src/automacoes/clientes-da-lista.ts) e mesclados pela ponte do Agente. A Execucao disparada por EVENTO (statusAlterado, tarefaCriada etc., dentro de uma operacao) nao recebe o dado: a Automacao com {{cliente}} ou mentionClientOwner diz 'o cliente' e nao menciona o dono. Hoje so a agenda (R4 D+30, R5) usa esses tokens; se uma Automacao por evento passar a usa-los, executar() precisa ler os clientes antes da operacao | open |  | 2026-11-06T22:38:24.083Z |  |
| 72 | 15 | deviation | packages/dominio/src/operations/members.ts |  | 15-42: o Registro de Atividade do ato de governanca 'acesso concedido a Recurso privado' (grantGovernanceAccess) nomeia o Recurso pelo id quando ele e um Funil: o nome do Funil antigo (state.funnels) saiu de resourceName e o Funil novo vive em plataforma.funis, que o dominio nao le. Espaco, Pasta, Lista e Colecao seguem nomeados. Se o dono quiser o nome do Funil no Registro, a rota precisa injeta-lo como faz com os nomes do CRM | open |  | 2026-11-06T22:38:24.149Z |  |
| 73 | 15 | deviation | apps/web/src/features/ferramentas/flow-popup.tsx | 438 | 15-34: depois do corte o 'Enviar Flow' a um Contato nao tem a quem enviar. O seletor escolhe Conversas 1:1 de state.conversations (flow-popup.tsx:438, !groupIdentifier e contactId), e o migrar:crm-antigo tira as Conversas 1:1 de plataforma.registros; so as de Grupo ficam. Em producao a lista de destinatarios do envio de Flow fica vazia (efeito do aviso 39, agora medido no codigo final). Decisao do dono: aceitar ate a Sessao 7 (Flow nas tabelas) ou pedir um seletor de Contatos com WhatsApp antes do corte. | open |  | 2026-11-06T23:29:16.501Z |  |
| 74 | 15 | deviation | apps/api/src/migracao-crm/colecoes.ts |  | 15-44 (H-02): o criterio de Conversa do CRM antigo (nao e de Grupo e o contactId e um id da colecao contacts do mesmo Espaco) trata como antigo o Contato cujo id existe nas duas colecoes antes do corte, e deixa em registros (nunca migra) a Conversa 1:1 sem contactId, inclusive uma antiga com unresolvedIdentifier; nenhuma das duas aparece na copia de 2026-11-05. O aviso 73 segue valendo para as Conversas 1:1 de Contatos antigos (saem no corte); as 1:1 que Flow, Automacao e convite de Grupo abrirem DEPOIS ficam em registros. | open |  | 2026-11-07T00:07:24.016Z |  |
| 75 | 15 | deviation | apps/api/src/persistencia/conexao.ts |  | 15-44 (M-01, resto): HOST_LOCAL em conexao.ts (regex localhost ou 127.0.0.1 sem ancora, usada por construirSsl) desliga o TLS quando localhost aparece em qualquer parte da connection string (senha, nome do banco, query). Nao e a trava de banco local (essa agora e persistencia/host-local.ts), mas pode desligar o TLS de uma URL remota disfarcada. Nao corrigido neste plano (fora dos arquivos dele): ancorar ao host analisado e testar em conexao.test.ts. | open |  | 2026-11-07T00:07:24.086Z |  |
| 76 | 15 | deviation | apps/api/src/persistencia/unidade-de-trabalho.ts | 532 | 15-44 (L-03 da revisao): depois do corte syncIdSequence usa o maior id que esta no estado, e Contatos, Conversas e Mensagens antigos deixam de estar nele; um msg_ ou cnv_ novo em registros pode repetir o id de uma linha migrada ou de uma chave de registros_crm_antigo (a copia seguinte seria pulada por on conflict do nothing). Nao importa para o ws_n1 (so o Funil). Nao corrigido: sugestao da revisao e passar a syncIdSequence um minimo lido de registros_crm_antigo. | open |  | 2026-11-07T00:07:24.150Z |  |
| 77 | 15 | deviation | apps/api/src/migracao-crm/mapeador.ts |  | 15-44 (L-04 da revisao): matriz e filial em ciclo, divididas entre pedacos de 500 linhas de inserir.ts, quebram a FK da matriz e o Espaco volta inteiro (nada se perde, o corte daquele Espaco trava). Borda; nao aparece na copia. Nao corrigido: relatar empresa-matriz-perdida e matriz_id nulo no ciclo. | open |  | 2026-11-07T00:07:24.214Z |  |
| 78 | 15 | deviation | apps/api/src/migracao-crm/funil.ts |  | 15-44 (L-05 e L-06 da revisao): Etapa antiga sem id, ou com id repetido no mesmo Funil, e engolida no de-para (os Negocios dela vao para a Etapa da primeira); instanteValido do Funil devolve o texto cru e um formato que o V8 aceita e o Postgres recusa derruba o Espaco no timestamptz. Bordas: so o Funil do ws_n1 passa por aqui no corte (id e datas do bootstrap). Nao corrigidos: recusar o Funil com motivo Etapa sem id ou repetida e usar o instante() do mapeador. | open |  | 2026-11-07T00:07:24.279Z |  |

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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T10:06:57.673Z",
    "resolved_at": "2026-11-06T13:55:39.705Z",
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T10:41:35.401Z",
    "resolved_at": "2026-11-06T13:55:39.779Z",
    "milestone": "v1.0"
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/pedidos-de-entrada.tsx",
    "line": null,
    "description": "15-17: ate o 15-22 mandar crm, a simulacao local de Pedido de Entrada e de clique de Captacao (e a importacao de Grupos) no navegador recusa com 'Contato do participante nao resolvido.' (ou 'Canal nao encontrado.'); o servidor so resolve e cria o Contato do Participante em importarGruposDoCanal, os eventos do provedor ainda nao tem rota em POST /operacoes",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T10:56:35.691Z",
    "resolved_at": "2026-11-06T14:14:34.729Z",
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T11:36:42.762Z",
    "resolved_at": "2026-11-06T19:45:26.075Z",
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T11:50:25.932Z",
    "resolved_at": "2026-11-06T17:53:47.740Z",
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T13:05:24.509Z",
    "resolved_at": "2026-11-06T19:45:26.144Z",
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
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T13:24:05.443Z",
    "resolved_at": "2026-11-06T17:53:47.911Z",
    "milestone": "v1.0"
  },
  {
    "id": 35,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/automations.ts",
    "line": null,
    "description": "15-19: as Automacoes de Contas a receber ({{cliente}}, {{donoDoCliente}}, mentionClientOwner) ainda leem nome e dono do cliente em state.contacts (contatoDoCliente); clienteDe agora so devolve a referencia. Uma serie criada para um Contato de plataforma.contatos (id fora do modelo antigo) faz o comentario de cobranca dizer 'o cliente' e nao mencionar o dono dele; as contas do modelo antigo seguem como antes. automations.ts entrou na lista CONGELADOS do sem-crm-antigo do dominio. Resolver injetando nome e dono por OpcoesDaAgenda (como cnpjPorEmpresa) lidos das tabelas, antes do 3.5.4 tirar state.contacts",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T13:42:09.740Z",
    "resolved_at": "2026-11-06T22:38:14.159Z",
    "milestone": "v1.0"
  },
  {
    "id": 36,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/estrutura/financeiro/use-nomes-dos-clientes.ts",
    "line": null,
    "description": "15-19: o nome do cliente de Contas a receber vem de POST /crm/nomes; sem nome (carregando, Membro suspenso por WR-03, Papel sem ler Contato) a lista, o cartao e a busca mostram 'Cliente'; o cartao financeiro faz uma chamada por cartao visivel; a serie so aceita Contato como cliente (Empresa nao, o input da operacao tem so contactId); createReceivableSeries ganhou o 4o argumento clientes (opcional, vazio recusa)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T13:42:09.807Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 37,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/criar-grupo-dialog.tsx",
    "line": null,
    "description": "15-22: o link de convite do Novo Grupo nao sai para os convidados: enviarLinkDeConvite abre a Conversa 1:1 por startConversation, que ainda le Canal e Contato do modelo antigo (state.contacts), e o Contato da ficha nova nao esta la; o Grupo nasce e a tela avisa 'o link de convite nao saiu: <nome>: Contato nao encontrado.'. Resolver quando a Conversa 1:1 do convite passar ao modelo novo (Sessao 6 / 3.5.4)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T14:14:34.792Z",
    "resolved_at": "2026-11-06T22:38:14.226Z",
    "milestone": "v1.0"
  },
  {
    "id": 38,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/conversa-do-grupo.tsx",
    "line": null,
    "description": "15-22: na Conversa do Grupo a Mensagem recebida de um participante mostra 'Participante' em vez do nome: o Identificador da Mensagem (viaIdentifierId) era de um Contato do modelo antigo e o Contato da ficha nova nao tem como casar com ele. Volta a ter nome quando a Mensagem de Grupo passar ao modelo novo (Sessao 6)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:14:34.854Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 39,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/flow-popup.tsx",
    "line": null,
    "description": "15-22: enviar o Flow a um Contato continua escolhendo uma Conversa 1:1 de state.conversations (enviarFlow recebe conversationId, F14-D-05), nao o seletor de Contatos com WhatsApp que o plano citava; o nome vem de POST /crm/nomes (sem nome, o titulo da Conversa). Um Contato da ficha nova sem Conversa no modelo antigo nao e enviavel. Resolver quando o envio e a resposta de Flow passarem ao modelo novo (Sessao 7)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:14:34.917Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 40,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/coluna-do-contato.tsx",
    "line": null,
    "description": "15-24: a coluna do Contato da Caixa nao tem mais o ponto verde de janela de resposta aberta, as acoes LinkedIn e Tarefa (virou Instagram e Abrir ficha), o resumo escrito pelo Agente Enriquecedor (mostra a descricao do Contato) nem a temperatura (D-15-06); o painel Tags da Conversa saiu porque plataforma.conversas nao guarda Tags. Se o dono quiser o ponto da janela ou as Tags da Conversa de volta, abrir na api e no dominio",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:33:24.856Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 41,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/conversa-de-grupo-na-caixa.tsx",
    "line": null,
    "description": "15-24: a Conversa de grupo aberta na Caixa (id que a api responde 404 e o store conhece como Conversa de grupo, F14-D-05) ainda resolve, reabre, atribui e manda para a lixeira pelas operacoes antigas do store; so sai quando o Grupo passar ao modelo novo (Sessoes 6 e 7). Nenhuma outra tela da Caixa usa essas operacoes",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:33:24.919Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 42,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/estrutura/tarefa-completa.tsx",
    "line": null,
    "description": "15-25: a lista de Vinculos da ficha da Tarefa mostra 'Registro indisponivel' (sem atalho) para Negocio, Contato e Conversa cujo id POST /crm/nomes nao conhece; os Vinculos de hoje em producao apontam para ids do modelo antigo, entao ate o script de migracao preservar os ids a ficha cai no layout de sempre com o aviso 'sem Contato' (resumo.contato null) e os nomes dos Vinculos nao aparecem. Antes o nome vinha do estado antigo",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T14:45:41.424Z",
    "resolved_at": "2026-11-06T19:45:26.216Z",
    "milestone": "v1.0"
  },
  {
    "id": 43,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/crm/conversation-thread.tsx",
    "line": null,
    "description": "15-25: o aviso de consentimento de marketing do fio e so aviso (nao bloqueia o envio) e aparece sempre que o consentimento vigente de Marketing no tipo do Canal da aba nao e 'concedido', inclusive Contato sem nenhum registro, porque o fio nao tem seletor de modelo (antes o aviso so existia com um modelo de marketing escolhido). Se o dono achar ruidoso para quem nunca teve consentimento registrado, restringir a 'revogado' ou ligar ao modelo quando houver Mensagem de modelo",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:45:41.486Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 44,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/crm/negocios/page.tsx",
    "line": null,
    "description": "15-26: o plano e F14-D-06 mandam o filtro Meus para o quadro de /crm/funis/[funil], mas essa rota e a ficha do Funil e nao tem quadro; o quadro (QuadroDoFunil) mora em /crm/negocios. O botao Meus (?meus=1) e o atalho do menu foram para /crm/negocios; o dono decide se quer tambem um quadro na ficha do Funil",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:59:26.597Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 45,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/shell/app-shell.tsx",
    "line": null,
    "description": "15-26: o painel do CRM perdeu o grupo Pastas de Negocios (arvore da Pasta Meus negocios) para todos os Espacos e ganhou o atalho Meus negocios para /crm/negocios?meus=1; favoritos de /crm/meus-negocios agora caem no 404 do app (T-15-63 aceito)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T14:59:26.663Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 46,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/inicio/resumo-do-inicio.tsx",
    "line": null,
    "description": "15-23: Mensagens novas do Inicio perdeu o trecho da ultima Mensagem (a lista GET /conversas nao o traz; o dono ve so nome, quantas nao lidas e quando). Quando o total de Conversas com Mensagem nova passa de 200 o atalho diz 'nas primeiras N de M Conversas' e a soma de nao lidas e so das lidas. Leads a atender mostra iniciais no avatar (o modelo novo nao tem foto) e a api devolve no maximo 50 (o atalho avisa)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T17:53:48.102Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 47,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/inicio/resumo-do-inicio.tsx",
    "line": null,
    "description": "15-23: Estatisticas do Inicio pedem duas janelas a api (atual e anterior; a api aceita 400 dias e o ano com o anterior passa de 700) e comparam por dia inteiro: o primeiro dia do periodo anterior entra inteiro, nao so a partir do instante exato. Sem escolha da pessoa a metrica aberta e a de maior valor do periodo atual (antes so da semana) e pode mudar ao trocar de periodo ate o primeiro clique. Se a api recusa, as tres metricas do CRM ficam zeradas com um aviso",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T17:53:48.270Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 48,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/paineis/[painel]/page.tsx",
    "line": null,
    "description": "15-23: Paineis semeados (SDR, Closer, Atendimento) tem Fonte com ids do modelo antigo (fnl_sdr, fnl_closer, fila_com, inbox_n1): lendo o CRM novo eles abrem zerados ate a Fonte apontar para um Funil/Fila novo (Sessao 20.3). Widgets de Origem e Motivo de Perda ficam sem linhas porque NegocioResumo nao traz origem/motivoPerda (texto livre no Negocio novo). Cada Widget le ate 200 registros por recurso e diz 'Parcial: primeiros 200' quando ha mais; Etapas vem de uma GET /funis/:id por Funil lido",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T17:53:48.437Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 49,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx",
    "line": null,
    "description": "15-40: a Lista conversacional so afirma 'sem canais' (aviso, Atende por e recusa de criar Tarefa) com a resposta de GET /canais na mao (so os Canais ativos, ate 200); enquanto carrega, ou se a api falha, o aviso e a linha 'Atende por' nao aparecem e o botao Nova Tarefa nao e desligado por falta de Canal (o servidor continua barrando). Uma Lista cujo canaisDeAtendimento guarda ids que nao estao em plataforma.canais (ids do Canal antigo, antes do script de migracao preservar ids) mostra o aviso de Lista sem Canal. O quadro da Lista conversacional ficou: quadro-negocios.tsx virou quadro-conversacional.tsx (so o card de Negocio e o subtotal em dinheiro sairam), em vez de ser apagado como o plano dizia",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T18:25:31.533Z",
    "resolved_at": "2026-11-06T19:45:26.283Z",
    "milestone": "v1.0"
  },
  {
    "id": 50,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/migrar-crm-antigo.ts",
    "line": null,
    "description": "15-27: o --migrar do script so cobre o Funil: recusa, antes de escrever, o Espaco com Contatos, Empresas, Vinculos, Negocios, Canais ou Conversas comuns ('use --guardar'); o mapeador dessas entidades e o plano 15-28. A decisao do Funil (--funil=migrar ou guardar) vale antes da primeira escrita: depois de um --guardar o Funil ja saiu de registros e o script nao o le da copia (trazer depois = recriar pela tela de Funis)",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T19:14:14.649Z",
    "resolved_at": "2026-11-06T19:45:26.348Z",
    "milestone": "v1.0"
  },
  {
    "id": 51,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/pasta-meus-negocios.ts",
    "line": null,
    "description": "15-27: a Pasta Meus negocios com Tarefa em qualquer Lista nao sai (esperado nos 17 Espacos de teste; o dono ve no --seco) e, quando sai, o script nao reescreve referencias de fora as Listas removidas (Automacao ou Formulario com escopo na Lista). No ws_n1 a Pasta provavelmente nem existe (o bootstrap nao a cria); o dono confere no --seco antes do corte",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:14:14.718Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 52,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/funil.ts",
    "line": null,
    "description": "15-27: nenhum id antigo e reescrito e nenhum link, Vinculo ou canaisDeAtendimento para Negocio, Contato ou Canal antigo e resolvido por este plano: as linhas antigas ficam em registros_crm_antigo com o id original, e so Funil (id preservado) e Etapa (id novo, crm_de_para colecao_antiga funnels/stages, id_antigo funil/etapa) chegam ao CRM novo. Os avisos 22, 32, 42 e 49 (15-40) seguem abertos ate o 15-28 preservar os ids dos Negocios, Contatos e Canais e o corte (15-34/15-35) rodar",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T19:14:14.783Z",
    "resolved_at": "2026-11-06T19:45:26.412Z",
    "milestone": "v1.0"
  },
  {
    "id": 53,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/mapeador.ts",
    "line": null,
    "description": "15-28: o que o --migrar NAO leva as tabelas novas (fica so em registros_crm_antigo e aparece em 'Nao migrados' do --seco): temperatura e Tags dos Contatos; Identificadores de LinkedIn, TikTok e chat do site; Canal do LinkedIn e do chat do site e as Conversas deles (os Vinculos de Tarefa para essas Conversas seguem 'Registro indisponivel'); Empresa sem vinculo admin vigente e os Negocios dela; no Negocio, codigo legivel, campos personalizados, historico de Etapas e os Contatos alem do dono (todo Negocio com Empresa perde o Contato); vinculos Empresa-Empresa e 'distinto de'; Mensagem de Flow migra sem o Flow. No seed sintetico: 35 temperaturas, 25 Contatos com Tags, 32 Identificadores sem destino, 5 Conversas de canal sem destino, 19 Negocios com detalhes perdidos. O dono le a lista no --seco de cada Espaco antes do corte (15-34/15-35)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:45:42.126Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 54,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/mapeador.ts",
    "line": null,
    "description": "15-28: campos personalizados de Contato e Empresa entram em campos_adicionais com o id da Definicao como chave (ex. fd_signo), sem rotulo, e valor em lista fica de fora; o Canal migrado entra desconectado (a conexao real so vem do provedor); Qualificacao e Origem do Contato levam o id do Catalogo como texto (a tela mostra o rotulo so se o id existe no Catalogo)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:45:42.191Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 55,
    "kind": "unrun-verify",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/migrar-entidades.test.ts",
    "line": null,
    "description": "15-28: os avisos 22, 32, 42, 49, 50 e 52 foram dados como corrigidos pelo codigo e pelos testes em Docker (ids antigos preservados, Vinculos achando o id); em producao o efeito so existe depois que o dono rodar o --migrar nos Espacos com CRM antigo (15-34/15-35). Antes disso os Vinculos a ids antigos seguem 'nao encontrado'. Nada foi rodado contra banco real",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:45:42.257Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 56,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/bootstrap/crm-demo.test.ts",
    "line": null,
    "description": "15-29: o teste dos Vinculos do demo le buildSeed().links; quando o 15-31 tirar o CRM e os Vinculos do seed, procurados fica 0 e o teste (que exige contact, conversation e deal achados) quebra. O 15-31 precisa trocar a fonte dos Vinculos (por exemplo, a lista de ids que o proprio seed novo guarda em registros) ou ajustar o caso, sem perder a prova de que os ids preservados acham o registro.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T19:59:51.284Z",
    "resolved_at": "2026-11-06T20:48:49.716Z",
    "milestone": "v1.0"
  },
  {
    "id": 57,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/bootstrap/crm-demo.json",
    "line": null,
    "description": "15-29: o demo traz so o que o mapeador do 15-28 migra para as tabelas novas: sem temperatura e Tags dos Contatos, sem o Canal do LinkedIn e do chat do site e as Conversas deles (3 Canais e 16 Conversas, contra 5 e 23 do seed antigo), Canais desconectada e 160 itens listados em naoMigrados. A Caixa de dev fica mais magra que a do seed antigo; nao ha Canal conectado nem envio real.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:59:51.351Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 58,
    "kind": "unrun-verify",
    "phase": "15",
    "file": "apps/api/src/bootstrap/crm-demo.cli.ts",
    "line": null,
    "description": "15-29: bootstrap:crm-demo foi provado so em Postgres de Docker (testes e uma execucao de npm run em Espaco criado a mao); nenhuma tela do apps/web foi aberta sobre o Espaco carregado, entao a Caixa cheia em desenvolvimento nao foi vista no navegador.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T19:59:51.413Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 59,
    "kind": "deviation",
    "phase": "15",
    "file": ".planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md",
    "line": null,
    "description": "15-30: o ensaio rodou sobre a copia de 2026-11-05 (dump 11:13, CSV 10:11), nao sobre uma copia renovada: o dono nao renovou e mandou 'pode fazer o que precisar para fechar a fase'. Vale para aquele momento; o corte (15-34/15-35) precisa rodar o --seco do dia em cada Espaco, e o dono pode renovar a copia e repetir o ensaio antes. A copia tem 19 Espacos e nao 18 (ws_agendaworker_* sem nenhuma linha em registros); no dump o ws_n1 tem no CRM novo 2 Contatos, 1 Empresa, 2 Funis, 6 Etapas e 1 Negocio, que nao foram recopiados",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T20:19:25.592Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 60,
    "kind": "deviation",
    "phase": "15",
    "file": ".planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md",
    "line": null,
    "description": "15-30: decisao do Funil do ws_n1 e achados da Pasta. O CRM antigo do ws_n1 tem so o Funil fnl_padrao 'Padrao' (1 Etapa 'Novo', nenhum Negocio, nenhum Contato); --funil=guardar deixa o CRM novo como esta (2 Funis, 6 Etapas), --funil=migrar acrescenta 1 Funil vazio e 1 Etapa (3 Funis, 7 Etapas, 2 linhas de crm_de_para), sem nome em uso. A Pasta Meus negocios nao existe no ws_n1; em 16 dos 18 Espacos de teste ela tem Tarefa em 4 Listas (18 Tarefas) e por isso nao sai (atualiza o aviso 51: sao 16, nao 17). O dono decide o Funil no --seco do dia",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T20:19:25.669Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 61,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/seed.ts",
    "line": null,
    "description": "15-31: as Automacoes do seed com escopo de Lista espelho (aut_clo_proposta, escopo lst_funil_closer) e as Acoes criar_tarefa com alvo lst_funil_sdr/lst_funil_closer apontam para Listas que sairam do seed com a Pasta Meus negocios; num estado novo a aut_clo_proposta nasce inoperante (escopo eliminado (Lista)). seed-ia.test.ts e ia/automacoes.test.ts passaram a esperar isso. Alguem precisa decidir o destino delas (mover para o Funil, ou remover) antes do 15-41.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T20:48:44.453Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 62,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/seed-ferramentas.ts",
    "line": null,
    "description": "15-31: sem Contato, Canal e Conversa do CRM no seed, saiu do seed o que as Ferramentas faziam SOBRE eles: os Envios e Respostas de Flow nas Conversas cnv_5/9/13/17 (4 Mensagens e 2 Registros de Atividade), a Tag Em grupo de alunos nos Contatos e o groupsEnabled do Canal chn_wpp. O Flow, as versoes, os Grupos, as Participacoes por id e as Conversas de Grupo ficam. As metricas do Flow nascem com zero envios e o demo (bootstrap:crm-demo) nao liga Grupos no Canal.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T20:48:44.567Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 63,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas.test.ts",
    "line": null,
    "description": "15-31: ferramentas.test.ts (Grupo, Comunidade e Flow, 15-07/15-17) depende do Canal, dos Contatos e das Conversas do CRM antigo e dos Envios de Flow; reescrever as 933 linhas passou do escopo do plano, entao o beforeEach usa semearCrmAntigo(buildSeed()). O 15-43 apaga semearCrmAntigo mas Grupo/Flow ficam ate as Sessoes 6 e 7: este teste precisa montar Canal, Contatos e Conversas proprios antes do 15-43.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T20:48:44.683Z",
    "resolved_at": "2026-11-06T22:38:14.292Z",
    "milestone": "v1.0"
  },
  {
    "id": 64,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/seed-produto.ts",
    "line": null,
    "description": "15-31: as Reunioes do processo comercial (tsk_reuniao_1/2/3 e tsk_call_ref, ligadas a Negocio) moravam no seed do produto na Lista de Meus negocios do Funil; sem a Pasta, a poda as leva junto com a arvore de demonstracao, e buildProductSeed() nasce sem Tarefa de hoje para o Thiago. rehomeMeetings saiu. O seed do produto so e usado em testes; derive-resumo.test.ts passou a conferir o seed completo.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T20:48:44.782Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 65,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts",
    "line": null,
    "description": "15-32: o plano mandava apagar operations/conversations.ts e tirar os 11 nomes de Conversa de OPERACOES, mas Grupo, Flow e Automacao (F14-D-05) ainda chamam startConversation, sendMessage, sendMessageSemConferencia e receiveMessage, e a Conversa de grupo na Caixa ainda resolve, reabre, atribui, estrela e manda para a lixeira pelo store (linha 41). Ficaram em ferramentas/conversa-de-grupo.ts (com recusaDeEscritaNoCrmAntigo, que era de crm-antigo.ts): so resolveConversation, reopenConversation, assignConversation, trashConversation e toggleConversationStar seguem em OPERACOES e no barril; por isso 40 nomes (nao 45) respondem 404 em POST /operacoes/:nome. Sai com Grupo e Flow (Sessoes 6 e 7); 15-42 e 15-43 nao podem apagar este arquivo, e a linha 37 (startConversation le Canal e Contato antigos) continua valendo.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T21:19:55.942Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 66,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/sobre-o-crm-antigo.test.ts",
    "line": null,
    "description": "15-32: os blocos de operations.test.ts que nao testavam so operacao apagada (Mensageria e Adocao de Rascunho de sendMessage/receiveMessage, Suspeita de Duplicidade, Leitura de Widget, Barra global, Modelo de Tarefa da Lista com Contato antigo) foram movidos sem mudar para sobre-o-crm-antigo.test.ts, que ainda usa semearCrmAntigo; crm/capacidades.test.ts tambem (sendMessage fora da janela, estado antigo). operations.test.ts ficou sem semearCrmAntigo. O 15-42 apaga as leituras antigas com os blocos delas e o 15-43 apaga semearCrmAntigo: o que valer para o CRM novo precisa ser reescrito sobre as tabelas antes.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T21:19:56.005Z",
    "resolved_at": "2026-11-06T22:38:14.359Z",
    "milestone": "v1.0"
  },
  {
    "id": 67,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts",
    "line": null,
    "description": "15-33: com a ponte dos Canais fora de GET /estado e de executar(), state.channels deixou de ter o Canal de plataforma.canais. Para Grupo, Flow e Automacao continuarem enviando, sendMessage, startConversation e receiveMessage (conversa-de-grupo.ts) acham o Canal primeiro em state.channels e, na falta dele, no crm.canais que o servidor le da tabela (canalPeloId + canalComoChannel; SendMessageInput ganhou crm opcional; grupos.ts, flows.ts e automacoes.ts o repassam). NAO e projecao: o Canal nao entra no estado nem e gravado. Mensagens de modelo seguem vazias (a tabela nao guarda modelos, linha 20). Sai com o arquivo, nas Sessoes 6 e 7; as linhas 35, 37 e 41 continuam abertas (Contato antigo ainda e lido de state.contacts).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T21:40:47.161Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 68,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/servicos/crm/canais.ts",
    "line": null,
    "description": "15-33: criar ou renomear um Canal deixou de conferir nome e conta contra os Canais antigos de plataforma.registros (canalAntigoEmConflito saiu; o Canal so existe em plataforma.canais). Antes do corte, um Canal novo pode repetir nome ou numero de um chn_* antigo; o --seco e o --migrar do 15-28 relatam canal-repetido e id-ja-existe, e o chn_* antigo repetido fica de fora do que o --migrar leva (so em registros_crm_antigo). Tambem saiu o campo canaisMs da medicao de executar() (MedicaoDaExecucao e a linha 'gravacao medida'): nao ha mais leitura de Canal para medir; idasEVoltas de uma gravacao comum e 2 tambem na primeira do processo.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T21:40:47.230Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 69,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx",
    "line": null,
    "description": "15-41: a Lista da Pasta Meus negocios ainda esconde as Tarefas com proveniencia 'deal' (filtro pastaDeNegocios, que le MEUS_NEGOCIOS_ID); o resto da tela ja a trata como Pasta comum. Sai com a Pasta (script de migracao, D-15-14) e com a constante (15-43), ou antes se o dono quiser ver essas Tarefas nos Espacos de teste",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-11-06T22:01:19.208Z",
    "resolved_at": "2026-11-06T23:04:48.601Z",
    "milestone": "v1.0"
  },
  {
    "id": 70,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts",
    "line": null,
    "description": "15-42: com o Contato lido de crm.contatos (WINDOWS #37), receiveMessage nao devolve mais a ativo o Contato arquivado ou na lixeira que recebe Mensagem (RN-CON-13): a tabela plataforma.contatos nao e gravada por esta composicao, entao a Resposta de Flow e a Mensagem recebida entram na Conversa e o estado do Contato fica como o servidor o leu. Tambem saiu a conferencia do consentimento de marketing do Contato antigo no envio (o Canal da tabela nao guarda Mensagens de modelo, linha 20). Se o dono quiser a restauracao por Mensagem recebida, ela precisa de um aoConfirmar que grave o Contato",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T22:38:24.018Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 71,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/automations.ts",
    "line": null,
    "description": "15-42: o nome e o dono do cliente das Automacoes de Contas a receber (R4/R5) chegam por OpcoesDaAgenda.clientes, lidos de plataforma.contatos pelo scheduler-worker na transacao da volta (apps/api/src/automacoes/clientes-da-lista.ts) e mesclados pela ponte do Agente. A Execucao disparada por EVENTO (statusAlterado, tarefaCriada etc., dentro de uma operacao) nao recebe o dado: a Automacao com {{cliente}} ou mentionClientOwner diz 'o cliente' e nao menciona o dono. Hoje so a agenda (R4 D+30, R5) usa esses tokens; se uma Automacao por evento passar a usa-los, executar() precisa ler os clientes antes da operacao",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T22:38:24.083Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 72,
    "kind": "deviation",
    "phase": "15",
    "file": "packages/dominio/src/operations/members.ts",
    "line": null,
    "description": "15-42: o Registro de Atividade do ato de governanca 'acesso concedido a Recurso privado' (grantGovernanceAccess) nomeia o Recurso pelo id quando ele e um Funil: o nome do Funil antigo (state.funnels) saiu de resourceName e o Funil novo vive em plataforma.funis, que o dominio nao le. Espaco, Pasta, Lista e Colecao seguem nomeados. Se o dono quiser o nome do Funil no Registro, a rota precisa injeta-lo como faz com os nomes do CRM",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T22:38:24.149Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 73,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/web/src/features/ferramentas/flow-popup.tsx",
    "line": 438,
    "description": "15-34: depois do corte o 'Enviar Flow' a um Contato nao tem a quem enviar. O seletor escolhe Conversas 1:1 de state.conversations (flow-popup.tsx:438, !groupIdentifier e contactId), e o migrar:crm-antigo tira as Conversas 1:1 de plataforma.registros; so as de Grupo ficam. Em producao a lista de destinatarios do envio de Flow fica vazia (efeito do aviso 39, agora medido no codigo final). Decisao do dono: aceitar ate a Sessao 7 (Flow nas tabelas) ou pedir um seletor de Contatos com WhatsApp antes do corte.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-06T23:29:16.501Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 74,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/colecoes.ts",
    "line": null,
    "description": "15-44 (H-02): o criterio de Conversa do CRM antigo (nao e de Grupo e o contactId e um id da colecao contacts do mesmo Espaco) trata como antigo o Contato cujo id existe nas duas colecoes antes do corte, e deixa em registros (nunca migra) a Conversa 1:1 sem contactId, inclusive uma antiga com unresolvedIdentifier; nenhuma das duas aparece na copia de 2026-11-05. O aviso 73 segue valendo para as Conversas 1:1 de Contatos antigos (saem no corte); as 1:1 que Flow, Automacao e convite de Grupo abrirem DEPOIS ficam em registros.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-07T00:07:24.016Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 75,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/persistencia/conexao.ts",
    "line": null,
    "description": "15-44 (M-01, resto): HOST_LOCAL em conexao.ts (regex localhost ou 127.0.0.1 sem ancora, usada por construirSsl) desliga o TLS quando localhost aparece em qualquer parte da connection string (senha, nome do banco, query). Nao e a trava de banco local (essa agora e persistencia/host-local.ts), mas pode desligar o TLS de uma URL remota disfarcada. Nao corrigido neste plano (fora dos arquivos dele): ancorar ao host analisado e testar em conexao.test.ts.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-07T00:07:24.086Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 76,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/persistencia/unidade-de-trabalho.ts",
    "line": 532,
    "description": "15-44 (L-03 da revisao): depois do corte syncIdSequence usa o maior id que esta no estado, e Contatos, Conversas e Mensagens antigos deixam de estar nele; um msg_ ou cnv_ novo em registros pode repetir o id de uma linha migrada ou de uma chave de registros_crm_antigo (a copia seguinte seria pulada por on conflict do nothing). Nao importa para o ws_n1 (so o Funil). Nao corrigido: sugestao da revisao e passar a syncIdSequence um minimo lido de registros_crm_antigo.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-07T00:07:24.150Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 77,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/mapeador.ts",
    "line": null,
    "description": "15-44 (L-04 da revisao): matriz e filial em ciclo, divididas entre pedacos de 500 linhas de inserir.ts, quebram a FK da matriz e o Espaco volta inteiro (nada se perde, o corte daquele Espaco trava). Borda; nao aparece na copia. Nao corrigido: relatar empresa-matriz-perdida e matriz_id nulo no ciclo.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-07T00:07:24.214Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 78,
    "kind": "deviation",
    "phase": "15",
    "file": "apps/api/src/migracao-crm/funil.ts",
    "line": null,
    "description": "15-44 (L-05 e L-06 da revisao): Etapa antiga sem id, ou com id repetido no mesmo Funil, e engolida no de-para (os Negocios dela vao para a Etapa da primeira); instanteValido do Funil devolve o texto cru e um formato que o V8 aceita e o Postgres recusa derruba o Espaco no timestamptz. Bordas: so o Funil do ws_n1 passa por aqui no corte (id e datas do bootstrap). Nao corrigidos: recusar o Funil com motivo Etapa sem id ou repetida e usar o instante() do mapeador.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-07T00:07:24.279Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
