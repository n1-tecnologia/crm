// Parte c do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "3",
    "n": "Base da mensageria e unificação do CRM",
    "dias": [
      4,
      13
    ],
    "dep": [
      "1"
    ],
    "desc": "Duas coisas, nesta ordem. Primeiro, acabar com as duas bases do CRM: as telas novas (`/crm/contatos`, `/crm/empresas`, `/crm/negocios`, `/crm/funis`) já leem as tabelas da 007, mas a Caixa de Entrada, a Tarefa conversacional, Meus negócios, Busca, Lixeira, Notificações, Início, Ferramentas, IA, Painel e Contas a receber ainda leem `state.contacts`, `state.conversations`, `state.deals`, `state.funnels` e `state.channels`, guardados em `plataforma.registros`. Depois, construir uma vez só o que os quatro provedores (Sessões 4, 7, 8 e 9) usam: porta de entrada, porta de saída, tempo real e mídia. Esta sessão recebeu da Sessão 5 o trabalho de levar a Tarefa conversacional para as tabelas novas (tarefa 3.3).",
    "partida": [
      "Tabelas `plataforma.canais`, `plataforma.conversas` e `plataforma.mensagens` (008), com as rotas `GET/POST /conversas`, `POST /conversas/:id/resolver`, `POST /conversas/:id/reabrir` e `GET/POST /mensagens`. Nenhuma tela chama as de Conversa e Mensagem: `apps/web/src/dados/crm/` não tem cliente para elas.",
      "Mensagem repetida já é barrada pelo índice `mensagens_id_externo_uq`, em `(workspace_id, canal_id, id_externo)`.",
      "`registrarRecebida` (`apps/api/src/servicos/crm/mensagens.ts:141`) grava a recebida, mas não tem rota, exige uma Conversa já existente, não acha nem cria Contato e não reabre Conversa resolvida.",
      "A janela de 24 h é decidida por (tipo, provedor) em `validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) e aplicada por `ServicoDeMensagens.enviar` (`servicos/crm/mensagens.ts:91`). O envio só grava: nada sai do sistema.",
      "Há o molde de fila com `for update skip locked` (`reivindicar`, `apps/api/src/persistencia/outbox-worker.ts:157`) e o upload em duas fases por URL assinada (`apps/api/src/servicos/storage-uploads.ts`), hoje só para Formulário e anexo de Tarefa.",
      "O modelo antigo é lido por cerca de 70 arquivos de `apps/web/src` e 33 de `packages/dominio/src` (sem contar testes). A ponte `apps/api/src/persistencia/canais-projetados.ts` traduz os Canais novos para `state.channels`, em `GET /estado` e em `executar()`."
    ],
    "pronto": "Uma chamada simulada ao webhook de um Canal cria (ou acha) o Contato em `plataforma.contatos`, abre ou reabre a Conversa em `plataforma.conversas` e aparece na Caixa de Entrada de outra aba em menos de 2 s, com o áudio tocando; a resposta escrita na tela passa pela fila e chega ao provedor de teste; e uma busca por `state.contacts`, `state.conversations`, `state.deals` e `state.channels` em `packages/` e `apps/` não acha nada (salvo o que a decisão sobre Grupos e Flows, na 3.1, deixar para as Sessões 6 e 7).",
    "tarefas": [
      {
        "id": "3.1",
        "n": "Decidir o corte e dar ao modelo novo o que falta",
        "objetivo": "As tabelas novas não guardam várias coisas que as telas antigas usam: notas, consentimento, mesclagem, estrela e leitura da Conversa, Conversa de Grupo, vários Contatos por Negócio. Antes de trocar qualquer tela, é preciso decidir o que vem junto e criar as colunas e tabelas numa migração nova.",
        "pronto": "As quatro decisões têm resposta escrita e a migração nova está aplicada em homologação.",
        "subs": [
          {
            "n": "Como fazer o corte?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Há duas bases de Contatos, Empresas, Negócios, Funis, Canais e Conversas. Uma Conversa aberta pelo fio da Caixa (`startConversation`, `packages/dominio/src/operations/conversations.ts:694`) ou por “Iniciar conversa” em Meus negócios (`iniciarConversa`, `packages/dominio/src/operations/iniciar-conversa.ts:52`) grava na base antiga; uma aberta por `POST /conversas` grava na nova.",
            "opcoes": [
              "(A) De uma vez: preparar tudo, rodar o script de migração (3.5) em homologação e trocar todas as telas no mesmo deploy",
              "(B) Tela por tela, com as duas bases convivendo"
            ],
            "muda": "(A) concentra o risco num dia, mas não precisa de ponte nova e acaba logo. (B) exige que cada tela traduza ids antigos e novos enquanto a outra base ainda grava: cerca de +2 dias de pontes que depois são jogadas fora.",
            "recomendo": "(A), primeiro em homologação. A produção nasce sem dados de demonstração (`bootstrap:gestao`), então o que há de real no modelo antigo deve ser pouco; o modo `--seco` do script conta antes.",
            "peso": "produto"
          },
          {
            "n": "O que o modelo novo precisa ganhar antes de o antigo sair?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "As fichas novas avisam o que a 007 não guarda (`apps/web/src/features/crm/ficha-de-contato.tsx:11`, `ficha-de-negocio.tsx:8`): Tags, Consentimentos, Comentários, Anexos, mesclagem, temperatura, vários Contatos por Negócio com papel e histórico de Etapas. A Conversa da 008 não tem estrela, leitura, rascunho nem Tags. Tudo isso existe no modelo antigo, e alguma tela usa.",
            "opcoes": [
              "(A) Trazer tudo antes do corte",
              "(B) Trazer só o que a Caixa usa no dia a dia ou que a mensageria exige: notas do Contato, consentimento, mesclagem, transferir Identificador, mover Conversa, atribuir, estrela, leitura e lixeira da Conversa",
              "(C) Não trazer nada: as telas perdem esses recursos"
            ],
            "muda": "(A) cerca de +4 dias. (B) cerca de +2 dias; Tags, vários Contatos por Negócio, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio somem da tela até uma sessão própria. (C) +0, mas a porta de entrada vai criar Contatos duplicados sem jeito de juntá-los.",
            "recomendo": "(B). As subtarefas da 3.2 e a migração abaixo estão escritas para (B).",
            "peso": "produto"
          },
          {
            "n": "Quando a Conversa de Grupo e as Mensagens de Flow saem do modelo antigo?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "As Ferramentas acham a Conversa do Grupo por `groupIdentifier` (`conversaDoGrupo`, `packages/dominio/src/derive-ferramentas.ts:145`) e contam envios e respostas de Flow pelas Mensagens antigas (`enviosDoFlow`, `:275`; `respostasDoFlow`, `:287`; `receiveMessage` em `operations/ferramentas/flows.ts:922`). A 008 não aceita Conversa sem Contato (`contato_id not null`) e a Mensagem nova não tem campo de Flow.",
            "opcoes": [
              "(A) Migração nova: `conversas.contato_id` aceita nulo quando há `identificador_de_grupo`, e `mensagens` ganha `flow` e `resposta_de_flow` (jsonb); as Ferramentas passam inteiras para as tabelas",
              "(B) Conversas de Grupo e Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7, que já refazem essas telas com o provedor real; aqui só os Contatos e Canais das Ferramentas passam para os ids novos"
            ],
            "muda": "(A) cerca de +1,5 dia aqui, e o modelo antigo sai por inteiro nesta sessão. (B) +0 aqui; um resto de `Conversation` (só Grupo e Flow) vive até a Sessão 7. Com (B), a Sessão 6 decide como guardar a Conversa de Grupo nas tabelas novas (6.6.5) e a leva para lá, e a Sessão 7 faz o mesmo com as Mensagens de Flow.",
            "recomendo": "(B): as Sessões 6 e 7 vão reescrever Grupos e Flows; fazer duas vezes é desperdício.",
            "peso": "arrumacao"
          },
          {
            "n": "Meus negócios continua como Listas espelho?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "A Pasta “Meus negócios” tem uma Lista por Funil antigo, achada pelo formato do id (`funilDaLista`: `lst_funil_<x>` ↔ `fnl_<x>`, `operations/iniciar-conversa.ts:30`), e cada Negócio aparece como Tarefa espelho no quadro (`QuadroNegocios`, `apps/web/src/features/estrutura/quadro-negocios.tsx:32`), com a `DealScreen` antiga embutida (`app/(shell)/estrutura/listas/[lista]/page.tsx:1131`). O CRM novo já tem quadro próprio em `/crm/funis/[funil]` (`features/crm/quadro-do-funil.tsx`). Os Funis novos têm id UUID: a regra do formato do id quebra.",
            "opcoes": [
              "(A) Manter as Listas espelho: a Lista ganha o campo `funilId` (id de `plataforma.funis`) e a Tarefa espelho aponta para o Negócio novo",
              "(B) Aposentar as Listas espelho: “Meus negócios” vira o quadro de `/crm/funis/[funil]` com o filtro “meus”, e as Reuniões continuam como Tarefas ligadas ao Negócio novo"
            ],
            "muda": "(A) cerca de +1 dia e mantém duas telas para o mesmo Negócio. (B) cerca de +0,5 dia e some uma tela; quem trabalha pela Lista muda de lugar.",
            "recomendo": "(B), se a equipe já usa o quadro do Funil novo; (A), se o dia a dia é pela Lista.",
            "peso": "produto"
          },
          {
            "n": "Escrever a migração nova com o que as decisões pedirem",
            "cam": [
              "banco"
            ],
            "hoje": "A 007 e a 008 estão aplicadas e são imutáveis. `contatos_estado_ck` (007) não aceita `mesclado`; não há tabela de consentimento, de nota, de marcação de Conversa, de fila de entrada nem de de-para de ids.",
            "fazer": [
              "`plataforma.contatos`: colunas `mesclado_em_id text` e `mesclado_em timestamptz`; recriar `contatos_estado_ck` aceitando `mesclado`.",
              "`plataforma.contato_consentimentos` (só inserção): `contato_id`, `finalidade_id` (o item de Catálogo `finalidadeConsentimento`), `tipo_de_canal` (`whatsapp`, `instagram`, `email` ou `todos`), `decisao` (`concedido` ou `revogado`), `em`, `origem`, `evidencia_mensagem_id`, `registrado_por`, `registrado_em`.",
              "`plataforma.contato_notas`: `contato_id`, `conteudo`, `autor_id`, `criado_em`.",
              "`plataforma.conversa_marcacoes`: chave `(workspace_id, conversa_id, membro_id)`, com `estrela boolean` e `lida_ate timestamptz`. Estrela e leitura são por Membro, como o `starredBy` antigo.",
              "`plataforma.webhooks_recebidos` (fila de entrada, ver 3.6) e o índice único do evento `mensagem.enviar.v1` em `plataforma.integration_outbox` (ver 3.7).",
              "`plataforma.crm_de_para` (`workspace_id`, `colecao_antiga`, `id_antigo`, `tabela_nova`, `id_novo`, `migrado_em`; chave `(workspace_id, colecao_antiga, id_antigo)`) e `plataforma.registros_crm_antigo` (cópia de segurança das linhas antigas, mesmo formato de `registros`), para o script da 3.5."
            ],
            "pronto": "`npm run migrar -w @n1/api -- --seco` lista só a migração nova em homologação; depois de aplicada, um teste em `apps/api/src/persistencia/` prova que `contatos_estado_ck` aceita `mesclado` e que `contato_consentimentos` recusa `decisao = 'talvez'`.",
            "nota": "Se a decisão sobre Grupos e Flows for (A), entram aqui também `conversas.identificador_de_grupo` e `mensagens.flow` / `mensagens.resposta_de_flow`."
          }
        ]
      },
      {
        "id": "3.2",
        "n": "Levar ao modelo novo as operações que só existem no antigo",
        "objetivo": "Mesclar Contatos, transferir um Identificador, mover uma Conversa, registrar consentimento e os gestos da Caixa (atribuir, estrela, lixeira) só existem sobre `state.contacts` e `state.conversations`. Sem eles no modelo novo, a porta de entrada cria duplicados que ninguém junta e a Caixa perde gestos que usa hoje.",
        "pronto": "Cada operação tem a regra em `packages/dominio/src/crm/`, a rota no `apps/api` e teste de serviço contra o Postgres real.",
        "subs": [
          {
            "n": "Criar o caminho para gestos que gravam nas tabelas do CRM e em `plataforma.registros` no mesmo commit",
            "cam": [
              "api"
            ],
            "hoje": "As rotas do CRM gravam por `comTransacao` (`apps/api/src/servicos/crm/transacao.ts`) e as operações do Espaço por `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`): são duas transações. Mesclar Contatos (que move Vínculos de Tarefa) e criar Tarefa conversacional (Tarefa em `registros`, Conversa em `plataforma.conversas`) precisam das duas juntas.",
            "fazer": [
              "Criar `apps/api/src/servicos/crm/gesto-misto.ts` com `executarGestoMisto(workspaceId, { lerDoCrm, operacao, gravarNoCrm })`.",
              "`lerDoCrm(cliente)` roda logo depois de `hidratar()`, no mesmo `PoolClient`, e o que devolve chega à `operacao` pura (Contato, Canal, Conversa já conferidos). Para isso `executar()` ganha a opção `lerDoCrm`.",
              "`gravarNoCrm(cliente, valor)` roda pela opção `aoConfirmar` que já existe (`unidade-de-trabalho.ts:74`): mesmo cliente, antes do `commit`.",
              "Os ids das linhas novas do CRM são gerados antes (`randomUUID`), para a operação pura já gravar o Vínculo com o id certo.",
              "Erro em `gravarNoCrm` desfaz tudo; um `23505` (unicidade) vira 409 com a frase do domínio."
            ],
            "pronto": "Teste em `apps/api/src/servicos/crm/gesto-misto.test.ts`: forçar erro em `gravarNoCrm` deixa `plataforma.registros` e `plataforma.conversas` sem nenhuma linha nova."
          },
          {
            "n": "Mesclar Contatos no modelo novo",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`mergeContacts` (`packages/dominio/src/operations/contacts.ts:143`) mexe só em `state.contacts` e nos Vínculos. O diálogo `apps/web/src/features/crm/merge-contacts-dialog.tsx` só abre na ficha antiga (`features/crm/legado/ficha-de-contato-legado.tsx:171`).",
            "fazer": [
              "Domínio: `validarMesclagem(sobrevivente, absorvido)` em `packages/dominio/src/crm/contatos.ts`: os dois diferentes, `ativo` ou `arquivado`, nenhum `mesclado`. Com teste das recusas.",
              "API: rota `POST /contatos/:id/mesclar` com `{ absorvidoId }`, por `executarGestoMisto`. Nas tabelas: passa ao sobrevivente os Identificadores, as Conversas (resolvendo antes a do absorvido que colidir em `conversas_nao_resolvida_uq`), os Negócios (`negocios.contato_id`) e os vínculos com Empresa; marca o absorvido `mesclado` com `mesclado_em_id`. Em `registros`: troca o `toId` dos Vínculos de Tarefa do absorvido para o sobrevivente.",
              "`GET /contatos/:id` de um `mesclado` devolve `mescladoEmId`, e `app/(shell)/crm/contatos/[contato]/page.tsx` redireciona para o sobrevivente.",
              "Web: ação “Mesclar com…” em `features/crm/ficha-de-contato.tsx`, reaproveitando `merge-contacts-dialog.tsx` com o seletor de Contato de `dados/crm/contatos.ts` (`useContatos`)."
            ],
            "pronto": "Mesclar A em B pela ficha: as Conversas e Negócios de A aparecem em B, a Tarefa conversacional de A mostra B e abrir `/crm/contatos/<A>` leva a B. Um teste de serviço cobre a colisão de Conversa aberta no mesmo Canal.",
            "nota": "“Restaurar cópia” de um mesclado (`restoreMergedCopy`, `contacts.ts:403`) e “marcar como distintos” (`markContactsAsDistinct`, `:713`) não são trazidos: só a ficha antiga os oferece."
          },
          {
            "n": "Transferir um Identificador para outro Contato",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`transferContactIdentifier` (`packages/dominio/src/operations/contacts.ts:93`) muda só quem recebe as próximas mensagens (DO-CON-12): as Conversas passadas ficam no Contato de origem. Só a ficha antiga oferece (`features/crm/transfer-identifier-dialog.tsx`).",
            "fazer": [
              "Rota `POST /contatos/:id/identificadores/:identificadorId/transferir` com `{ paraContatoId }` em `apps/api/src/rotas/crm/contatos.ts`, chamando o método novo `transferirIdentificador` de `servicos/crm/contatos.ts`.",
              "Troca `contato_identificadores.contato_id`; o Identificador só chega como principal se o destino não tiver um principal do mesmo tipo (`rebaixarPrincipal` já existe no repositório).",
              "Recusa destino `mesclado` ou na lixeira, com a frase em `packages/dominio/src/crm/contatos.ts`.",
              "Na ficha nova, ação “Transferir” na linha do Identificador, reaproveitando o diálogo."
            ],
            "pronto": "Teste de serviço: depois de transferir o WhatsApp de A para B, uma recebida desse número (3.6) cai numa Conversa de B, e a Conversa antiga continua em A."
          },
          {
            "n": "Registrar e respeitar consentimento",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "O consentimento é uma lista no Contato antigo (`ConsentRecord`, `packages/dominio/src/types/crm.ts:59`), lida por `marketingConsentMissing` (`packages/dominio/src/derive.ts:443`), que `sendMessage` e o fio (`features/crm/conversation-thread.tsx:352`) usam para barrar modelo de marketing. Não existe operação que registre consentimento: só o seed preenche.",
            "fazer": [
              "Domínio: `consentimentoVigente(registros, finalidadeId, tipoDeCanal)` em `packages/dominio/src/crm/consentimentos.ts` (novo), com a mesma conta de `marketingConsentMissing`: vale o registro mais recente da finalidade para o tipo do Canal ou para `todos`.",
              "API: `GET` e `POST /contatos/:id/consentimentos` sobre `plataforma.contato_consentimentos`. Revogar é inserir um registro `revogado`; nada é apagado.",
              "`ServicoDeMensagens.enviar` (`servicos/crm/mensagens.ts:91`) recusa com 409 `SEM_CONSENTIMENTO` quando o modelo usado é de marketing e não há consentimento vigente. Os modelos chegam na Sessão 7; a regra já fica pronta e testada.",
              "Web: seção “Consentimentos” na ficha nova, com o histórico e o botão de registrar."
            ],
            "pronto": "Teste de domínio dos casos concedido, revogado depois e “todos”; registrar pela ficha grava uma linha em `plataforma.contato_consentimentos`."
          },
          {
            "n": "Mover uma Conversa para outro Contato",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "`moveConversationToContact` (`packages/dominio/src/operations/conversations.ts:495`) troca o Contato e recusa se o destino já tem Conversa não resolvida no mesmo Canal, a menos que ela seja resolvida no mesmo ato. A tela é `features/crm/move-conversation-dialog.tsx`, aberta em `app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx:360`.",
            "fazer": [
              "Rota `POST /conversas/:id/mover` com `{ contatoId, resolverExistente }` em `apps/api/src/rotas/crm/conversas.ts`.",
              "No serviço, numa transação: destino `ativo`; se ele tem Conversa aberta no mesmo Canal, resolvê-la quando `resolverExistente`, senão 409 `CONVERSA_JA_ABERTA`; trocar `conversas.contato_id`. As Mensagens e o Canal não mudam (INV-CXE-04).",
              "O diálogo passa a chamar a rota."
            ],
            "pronto": "Testes de serviço dos dois caminhos, com e sem Conversa aberta no destino."
          },
          {
            "n": "Dar à Conversa nova os gestos da Caixa que faltam",
            "cam": [
              "api"
            ],
            "hoje": "Para a Conversa da 008 só há abrir, resolver e reabrir. A Caixa antiga também atribui (`assignConversation`, `[conversa]/page.tsx:157`), manda para a lixeira (`trashConversation`, `:391`), restaura (`restoreConversation`, `app/(shell)/configuracoes/lixeira/page.tsx:189`) e marca estrela (`toggleConversationStar`, `features/crm/inbox-columns.tsx:420`).",
            "fazer": [
              "Rotas em `apps/api/src/rotas/crm/conversas.ts`: `POST /conversas/:id/atribuir` com `{ tipo: 'membro' | 'agente', id }` ou `null`; `POST /conversas/:id/lixeira` (só Conversa resolvida, `conversas_lixeira_ck`); `POST /conversas/:id/restaurar`; `PUT /conversas/:id/marcacao` com `{ estrela?, lidaAte? }`, gravando em `conversa_marcacoes` do Membro da sessão.",
              "`GET /conversas` ganha os filtros `atribuidoId`, `filaId`, `comEstrela` e `q` (título), e cada item traz `naoLidas` (recebidas depois de `lida_ate`) e o nome do Contato."
            ],
            "pronto": "Testes de rota de cada gesto; uma Conversa na lixeira não aparece em `GET /conversas?estado=ativo`.",
            "nota": "Rascunhos (`Draft`, inclusive os que um Agente sugere, e `discardDraft` em `conversation-thread.tsx:482`) ficam para a Sessão 16, que define o Agente na Caixa."
          },
          {
            "n": "Guardar as notas do Contato nas tabelas",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "`addContactNote` (`packages/dominio/src/operations/contacts.ts:761`) é chamado pelo fio (`features/crm/conversation-thread.tsx:768`) e pela Reunião (`app/(shell)/crm/reunioes/[reuniao]/page.tsx:738`) e grava no Contato antigo.",
            "fazer": [
              "Rotas `GET` e `POST /contatos/:id/notas` sobre `plataforma.contato_notas`.",
              "O fio e a Reunião passam a chamar `POST /contatos/:id/notas`; a ficha nova mostra as notas."
            ],
            "pronto": "Uma nota escrita no fio aparece na ficha nova do Contato e grava uma linha em `plataforma.contato_notas`."
          },
          {
            "n": "Passar ao sucessor o que o Membro removido tem nas tabelas",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "`previewSuccession` (`packages/dominio/src/operations/members.ts:23`) e `removeMember` (`:217`) passam ao sucessor os Contatos, Empresas, Negócios e Conversas ANTIGOS. Nas tabelas, `proprietario_id` e `atribuido_id` continuam apontando para quem saiu.",
            "fazer": [
              "Em `apps/api/src/rotas/operacoes.ts`, a chamada de `removeMember` passa um `aoConfirmar` que, no mesmo cliente, troca `proprietario_id` em `contatos`, `empresas` e `negocios` e `atribuido_id` nas `conversas` abertas para o sucessor.",
              "Rota `GET /membros/:id/sucessao-no-crm` com as contagens; o diálogo de `app/(shell)/configuracoes/membros/page.tsx:95` mostra esses números no lugar dos de `previewSuccession`."
            ],
            "pronto": "Teste de rota: remover um Membro dono de 2 Contatos e 1 Negócio deixa os três com o sucessor em `plataforma.contatos` e `plataforma.negocios`."
          }
        ]
      },
      {
        "id": "3.3",
        "n": "Levar a Tarefa conversacional para as tabelas novas",
        "objetivo": "A Tarefa conversacional cria a Conversa na base antiga e lê Contato, Canal, Conversa e Negócio de `state.*`. Aqui ela passa a abrir a Conversa em `plataforma.conversas` e a ler tudo pela api. Este trabalho estava na Sessão 5 (5.1) e na 3.1 antiga, duplicado.",
        "pronto": "Criar, trocar o Canal e ligar ou criar o Negócio de uma Tarefa conversacional não grava nada em `registros` nas coleções `conversations` e `deals`, e o cartão da Lista mostra Contato, Canal e última Mensagem vindos da api.",
        "subs": [
          {
            "n": "A Conversa da Tarefa pode nascer sem Mensagem?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "`criarTarefaConversacional` abre a Conversa com `startConversation`, que cria uma Conversa vazia ou reaproveita a aberta. O serviço novo (`criar`, `apps/api/src/servicos/crm/conversas.ts:158`) exige a primeira Mensagem (INV-CXE-05) e recusa com 409 `CONVERSA_JA_ABERTA` se já existe uma aberta no par (Contato, Canal).",
            "opcoes": [
              "(A) O diálogo pede a primeira Mensagem quando não há Conversa aberta; havendo, reaproveita sem mensagem nova",
              "(B) Abrir Conversa vazia só por este caminho, como exceção a INV-CXE-05"
            ],
            "muda": "(A) mantém a regra da 008 e acrescenta um campo ao diálogo; no WhatsApp oficial, fora da janela, essa primeira Mensagem terá de ser modelo (Sessão 7). (B) não muda o diálogo, mas põe Conversas mudas na Caixa.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "Trocar as leituras da Tarefa conversacional por ids",
            "cam": [
              "dom"
            ],
            "hoje": "`contatoDaTarefa` (`packages/dominio/src/derive-conversacional.ts:70`), `conversaDaTarefa` (`:83`), `canalDaTarefa` (`:94`), `negocioDaTarefa` (`:105`) e `ultimaMensagemDaTarefa` (`:120`) seguem o Vínculo e buscam o registro em `state.contacts`, `state.conversations`, `state.channels` e `state.deals`. `vinculoRefusal` (`operations/tasks.ts:70`) confere os alvos de Vínculo nessas mesmas coleções.",
            "fazer": [
              "Criar `vinculosDoCrmDaTarefa(state, task)` → `{ contatoId?, conversaId?, negocioId? }`, que só lê `state.links`, com as mesmas regras de hoje (Subtarefa lê a raiz; o papel “… da Tarefa” vem primeiro).",
              "Apagar `contatoAlcancado` (`:54`): quem resolve um `mesclado` passa a ser a api.",
              "`canaisDaLista` (`:166`) e `canaisDaListaQueAlcancam` (`:175`) passam a receber `canais: readonly Canal[]` (tipo de `crm/canais.ts`) em vez de ler `state.channels`.",
              "`VinculoDeNascimento` (`operations/tasks.ts:61`) ganha `alvoConferido: true`, preenchido por quem já conferiu o alvo na tabela; `vinculoRefusal` deixa de procurar em `state.contacts`, `state.conversations` e `state.deals`."
            ],
            "pronto": "`packages/dominio/src/derive-conversacional.test.ts`, reescrito, passa com um estado de teste sem `contacts`, `conversations`, `channels` e `deals`."
          },
          {
            "n": "Criar a leitura em lote das Tarefas conversacionais",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "O cartão (`apps/web/src/features/estrutura/cartao-conversacional.tsx:42-45`), a tabela (`tabela-de-tarefas.tsx:290`), o cartão de Reunião (`cartao-de-tarefa.tsx:53`) e a ficha (`tarefa-completa.tsx:336-339`) montam Contato, Canal, Negócio e última Mensagem a partir do `DataState` em memória.",
            "fazer": [
              "Rota `POST /tarefas-conversacionais/resumo` em `apps/api/src/rotas/crm/tarefas-conversacionais.ts` (novo), recebendo `{ vinculos: [{ taskId, contatoId?, conversaId?, negocioId? }] }` (até 200).",
              "Devolve por Tarefa: o nome do Contato (seguindo `mesclado_em_id`), o Canal (nome, tipo, provedor, conexão), a última Mensagem não interna (trecho, direção, `criadoEm`) e o Negócio (título, Etapa). Confere o Papel e ignora ids de outro Espaço.",
              "Web: `apps/web/src/dados/crm/tarefas-conversacionais.ts` com `useResumoDasTarefas(tarefas)` (SWR), usado pelo cartão, pela tabela, pelo cartão de Reunião e pela ficha.",
              "A página da Lista (`app/(shell)/estrutura/listas/[lista]/page.tsx:496`) conta Contatos distintos pelos ids dos Vínculos, sem chamar a api."
            ],
            "pronto": "Abrir uma Lista conversacional com 50 Tarefas faz uma chamada só ao resumo; um teste de rota prova que um id de outro Espaço volta vazio."
          },
          {
            "n": "Trocar a criação da Tarefa conversacional para as tabelas novas",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`criarTarefaConversacional` (`packages/dominio/src/operations/tarefas-conversacionais.ts:154`) procura o Contato em `state.contacts` e o Canal em `state.channels`, abre a Conversa com `startConversation` (grava em `plataforma.registros`) e cria a Tarefa com Vínculos para esses ids antigos. É chamada pelo diálogo da Lista (`features/estrutura/nova-tarefa-conversacional-dialog.tsx:134`) e pelo fio da Caixa (`features/crm/conversation-thread.tsx:834`).",
            "fazer": [
              "Extrair de `criar` (`servicos/crm/conversas.ts:158`) a função `abrirConversaNoCliente(cliente, membro, entrada, id?)`, usada por `POST /conversas` e pela rota nova.",
              "Criar `POST /tarefas-conversacionais` em `rotas/crm/tarefas-conversacionais.ts`, por `executarGestoMisto`: `lerDoCrm` confere o Contato em `plataforma.contatos`, o Canal em `plataforma.canais` e a Conversa aberta do par (`abertaDoPar`, `repositorios/crm/conversas.ts:138`); a operação pura cria a Tarefa com Vínculos para os ids novos; `gravarNoCrm` abre a Conversa (com a primeira Mensagem, conforme a decisão) quando não havia uma aberta.",
              "No domínio, `criarTarefaConversacional(state, membro, input, referencias)` recebe `{ contato: { id, nome }, canal: { id, nome, conexao }, conversaId, negocio? }` e deixa de chamar `startConversation`.",
              "O diálogo e o botão do fio passam a chamar a rota; o seletor de Contato usa `useContatos` e o de Canal usa `useCanais` (`dados/crm/canais.ts`)."
            ],
            "pronto": "Criar uma Tarefa pela Lista grava uma linha em `plataforma.conversas` e nenhuma Conversa nova em `plataforma.registros`; um teste em `apps/api` prova isso, e outro prova que uma recusa da Tarefa não deixa Conversa nova."
          },
          {
            "n": "Trocar o Canal da Tarefa pela api",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`trocarCanalDaTarefa` (`operations/tarefas-conversacionais.ts:255`) abre a Conversa no Canal novo com `startConversation` e troca o Vínculo. A ficha chama em `features/estrutura/tarefa-completa.tsx:1288`.",
            "fazer": [
              "Rota `POST /tarefas-conversacionais/:taskId/canal` com `{ canalId, mensagem? }`, por `executarGestoMisto`: reaproveita a Conversa aberta do Contato no Canal novo ou abre uma; a operação pura só troca o Vínculo “conversa da Tarefa”.",
              "A Conversa anterior continua na Caixa, sem mudança."
            ],
            "pronto": "Trocar de WhatsApp para E-mail na ficha deixa a Conversa antiga na Caixa e o Vínculo apontando para uma Conversa de `plataforma.conversas`; teste de rota."
          },
          {
            "n": "Ligar e criar o Negócio da Tarefa pela api",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`vincularNegocioATarefa` (`operations/tarefas-conversacionais.ts:306`) confere o Negócio em `state.deals` pelos `contactLinks` (`negocioDoContato`, `:148`); `criarNegocioDaTarefa` (`:362`) cria pelo `createDeal` antigo. A ficha chama em `tarefa-completa.tsx:728` e `:1398`.",
            "fazer": [
              "Rota `POST /tarefas-conversacionais/:taskId/negocio` com `{ negocioId }` ou `null`: a api confere em `plataforma.negocios` que o Negócio está `ativo` e que `contato_id` é o Contato da Tarefa (a 007 tem um Contato só por Negócio, `negocios_dono_ck`); o domínio troca o Vínculo.",
              "Rota `POST /tarefas-conversacionais/:taskId/negocio/novo` com `{ funilId, titulo?, valor? }`: cria o Negócio na 1ª Etapa pelo mesmo código de `servicos/crm/negocios.ts` e grava o Vínculo, por `executarGestoMisto`.",
              "O seletor de Negócio da ficha usa `useNegocios({ contatoId })` (`dados/crm/negocios.ts`)."
            ],
            "pronto": "Criar Negócio pela ficha grava uma linha em `plataforma.negocios` e o Vínculo “Negócio da Tarefa” com esse id; se o Vínculo for recusado, o Negócio não fica (teste).",
            "nota": "Um Negócio cujo dono é a Empresa do Contato não aparece para ligar. Se isso fizer falta, é decisão à parte."
          },
          {
            "n": "Conferir os Canais da Lista conversacional na tabela",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`definirCanaisDaLista` (`operations/tarefas-conversacionais.ts:102`) chama `validarCanaisDeAtendimento` (`operations/canais.ts:133`), que procura os ids em `state.channels`; só funciona porque `executar()` projeta os Canais novos (`unidade-de-trabalho.ts:137`). O mesmo vale para `canalForaDaLista` (`canais.ts:150`) e `nomesDosCanais` (`operations/structure.ts:406`). A tela é `features/estrutura/canais-de-atendimento.tsx`.",
            "fazer": [
              "As três funções passam a receber `canais: readonly Canal[]`.",
              "Em `apps/api/src/rotas/operacoes.ts`, as operações que precisam de Canal (`definirCanaisDaLista` e a criação de Lista conversacional) usam a opção `lerDoCrm` de `executar()` para ler `plataforma.canais` (`todos`, `repositorios/crm/canais.ts:268`) dentro da transação; o que vier do navegador nesse argumento é descartado.",
              "Na execução local da tela, os Canais vêm de `useCanais`."
            ],
            "pronto": "Com `canais-projetados.ts` desligado, marcar um Canal novo na Lista funciona e um id inexistente é recusado; teste em `apps/api/src/rotas/operacoes.test.ts`."
          }
        ]
      },
      {
        "id": "3.4",
        "n": "Trocar as telas para o modelo novo",
        "objetivo": "Cerca de 70 arquivos da tela leem o modelo antigo. Cada grupo abaixo diz quais arquivos mudam e para que rota. Com a decisão (A) da 3.1, todos entram no mesmo deploy.",
        "pronto": "Nenhum arquivo de `apps/web/src` lê `contacts`, `companies`, `deals`, `funnels`, `channels` ou `conversations` do store (salvo Grupos e Flows, se a decisão for (B)).",
        "subs": [
          {
            "n": "Caixa de Entrada: lista e gestos da Conversa",
            "cam": [
              "web"
            ],
            "hoje": "`app/(shell)/crm/caixa-de-entrada/page.tsx:22` filtra `data.conversations`; `features/crm/inbox-columns.tsx` monta as colunas e a estrela (`:420`); `[conversa]/page.tsx` atribui (`:157`), reabre (`:321`), resolve (`:332`), manda para a lixeira (`:391`) e move (`:360`) com operações antigas.",
            "fazer": [
              "Criar `apps/web/src/dados/crm/conversas.ts`, no molde de `dados/crm/contatos.ts`: `useConversas(filtro)`, `useConversa(id)`, `abrirConversa`, `resolverConversa`, `reabrirConversa`, `atribuirConversa`, `moverConversa`, `marcarConversa`, `conversaParaLixeira` e `restaurarConversa`.",
              "A lista e as colunas leem `useConversas`; a página da Conversa lê `useConversa`, e cada botão chama a função correspondente."
            ],
            "pronto": "Responder, resolver, reabrir, atribuir, mover e marcar estrela pela Caixa não muda `select count(*) from plataforma.registros where colecao = 'conversations'`; testes em `inbox-columns.test.tsx` com o cliente da api falso."
          },
          {
            "n": "Caixa de Entrada: fio e envio",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "`features/crm/conversation-thread.tsx` abre Conversa com `startConversation` (`:371`, `:389`), envia com `sendMessage` (`:424`), descarta rascunho (`:482`), grava nota (`:768`), cria Tarefa (`:834`) e confere consentimento (`:352`), tudo no modelo antigo. As abas por Canal vêm de `canaisDoFio` (`derive-conversacional.ts:218`), que lê `state.channels`.",
            "fazer": [
              "Criar `apps/web/src/dados/crm/mensagens.ts` com `useMensagens(conversaId)` (`GET /mensagens?conversaId=`) e `enviarMensagem` (`POST /mensagens`).",
              "Abrir Conversa pelo fio passa a ser `abrirConversa` com a primeira Mensagem; nota vai para `POST /contatos/:id/notas`; “Criar Tarefa” vai para `POST /tarefas-conversacionais`; consentimento usa `consentimentoVigente`.",
              "`canaisDoFio`, `canaisDeResposta` e `canalPadraoDeResposta` (`derive-conversacional.ts:271`) passam a receber os Canais de `useCanais` e os Identificadores do `ContatoDetalhado`.",
              "O descarte de rascunho sai do fio até a Sessão 16."
            ],
            "pronto": "Responder no fio grava uma linha em `plataforma.mensagens`; `conversation-thread.test.tsx` passa com o cliente da api falso e sem `conversations` no store."
          },
          {
            "n": "Caixa de Entrada: configurações, Filas e Canais",
            "cam": [
              "web"
            ],
            "hoje": "`crm/caixa-de-entrada/configuracoes/page.tsx:145` conta Conversas antigas; `configuracoes/filas/[fila]/page.tsx` (`:43` a `:172`) lista Conversas e Contatos antigos da Fila; `configuracoes/canais/[canal]/page.tsx:127` salva com `configurarCanal` antigo; o popup legado das Listas (`features/crm/adicionar-canal-dialog.tsx:95`) cria Canal `conectada` em `registros` com `criarCanal` antigo.",
            "fazer": [
              "As contagens e a lista da Fila usam `GET /conversas?filaId=`.",
              "A ficha do Canal salva por `PATCH /canais/:id`.",
              "O popup legado passa a usar `criarCanal` de `dados/crm/canais.ts:76` (nasce `desconectada`, como a página de conexão) ou leva o usuário para `/crm/caixa-de-entrada/configuracoes/canais/conectar`.",
              "Filas (`Queue`) e a Caixa (`Inbox`, com `reopenWindowHours`) continuam em `plataforma.registros`: são configuração, e a 008 guarda só o id da Fila (`fila_id`)."
            ],
            "pronto": "Criar um Canal pelo popup das Listas grava em `plataforma.canais` e nada em `registros` na coleção `channels`."
          },
          {
            "n": "Fichas de Contato, Empresa e Negócio só no modelo novo",
            "cam": [
              "web"
            ],
            "hoje": "Quando a api devolve 404, a página abre a ficha antiga: `crm/contatos/[contato]/page.tsx:27-30` (`FichaDeContatoLegado`), `crm/empresas/[empresa]/page.tsx:30` (`FichaDeEmpresaLegado`) e `crm/negocios/[negocio]/page.tsx:27-31` (`DealScreen`, que move, ganha, perde e reabre com operações antigas em `deal-screen.tsx:274-325`). `contact-card.tsx:176` grava a qualificação com `setContactCatalogValue`.",
            "fazer": [
              "Tirar o caminho de reserva das três páginas: 404 mostra “não encontrado”.",
              "Apagar `features/crm/legado/ficha-de-contato-legado.tsx`, `legado/ficha-de-empresa-legado.tsx`, `deal-screen.tsx`, `restore-copy-dialog.tsx` e `import-contacts-dialog.tsx` (este último não é montado em lugar nenhum).",
              "`contact-card.tsx` grava a qualificação por `PATCH /contatos/:id` com `{ qualificacao }`."
            ],
            "pronto": "Abrir `/crm/contatos/<id antigo>` mostra “Contato não encontrado.”; os arquivos apagados não existem e `npm run check -w @n1/web` passa."
          },
          {
            "n": "Meus negócios e Reuniões",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "`estrutura/listas/[lista]/page.tsx` monta `QuadroNegocios` (`:949`), `IniciarConversaDialog` (`:1089`) e a `DealScreen` embutida (`:1131`); `quadro-negocios.tsx` usa `DealCard` e `dealOfTask` (`:32`); `crm/reunioes/[reuniao]/page.tsx` lê `state.deals`, `contacts`, `companies` e `funnels` (`:138` a `:215`). `iniciarConversa` cria Negócio, Tarefa espelho e Conversa no modelo antigo.",
            "fazer": [
              "Com (B) da decisão de Meus negócios: tirar a Pasta “Meus negócios” do seed e da navegação, apagar `QuadroNegocios`, `deal-card.tsx`, `iniciar-conversa-dialog.tsx` e `operations/iniciar-conversa.ts`, e pôr o filtro “meus” (`proprietario_id` = Membro da sessão) no quadro de `/crm/funis/[funil]`.",
              "Com (A): a Lista ganha `funilId`; `funilDaLista` lê esse campo; o quadro lê `useNegocios({ funilId })`; `iniciarConversa` vira rota `POST /negocios/iniciar-conversa` por `executarGestoMisto` (Negócio e Conversa nas tabelas, Tarefa espelho em `registros`).",
              "Nos dois casos, a Reunião lê Negócio, Contato e Empresa pela api (`useNegocio`, `useContato`) a partir do Vínculo."
            ],
            "pronto": "Abrir uma Reunião mostra o Negócio de `plataforma.negocios`; com (B), `/crm/meus-negocios` não existe mais; com (A), mover um cartão no quadro da Lista chama `POST /negocios/:id/mover`."
          },
          {
            "n": "Busca, Lixeira e Notificações",
            "cam": [
              "web",
              "api"
            ],
            "hoje": "`app/(shell)/buscar/page.tsx:112-153` procura em `state.contacts`, `companies`, `deals` e `conversations`; `configuracoes/lixeira/page.tsx:101-134` lista os antigos na lixeira e restaura com `restoreContact` (`:186`) e `restoreConversation` (`:189`); `notificacoes/page.tsx:139-144` mostra “Conversas atribuídas a você” das antigas.",
            "fazer": [
              "Busca: `GET /contatos?q=`, `GET /empresas?q=` e `GET /negocios?q=` (já aceitam `q`) e `GET /conversas?q=` (novo, da 3.2).",
              "Lixeira: a mesma lista com `estado=na_lixeira` em cada rota; restaurar por `POST /contatos/:id/restaurar`, `/empresas/:id/restaurar`, `/negocios/:id/restaurar` e `/conversas/:id/restaurar`.",
              "Notificações: `GET /conversas?atribuidoId=<Membro>&situacao=aberta`."
            ],
            "pronto": "Buscar o nome de um Contato criado pela ficha nova o encontra; um Contato enviado à lixeira pela ficha nova aparece na Lixeira e volta ao restaurar."
          },
          {
            "n": "Início, Configurações e Painel",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "Início: `derive-resumo.ts:70`, `:134` e `:448`, `features/inicio/panorama-do-robo.ts:25-37` e `resumo-do-inicio.tsx:502` e `:561` leem Conversas e Contatos antigos. Configurações: `configuracoes/campos/page.tsx:102-107`, `tags/page.tsx:68-71` e `catalogos/page.tsx:54-55` contam uso nos registros antigos; `configuracoes/page.tsx:110` mostra `workspace.defaultFunnelId` (Funil antigo); `features/configuracoes/governance-access-dialog.tsx:221` concede acesso a Funil antigo. Painel: `widgetReading` (`derive.ts:744-760`) lê `state.deals`, `conversations` e `contacts`.",
            "fazer": [
              "As funções de `derive-resumo.ts` e `widgetReading` passam a receber as linhas como argumento (`conversas`, `contatos`, `negocios`); a tela as busca com `useConversas`, `useContatos` e `useNegocios`.",
              "As páginas de Campos, Tags e Catálogos deixam de contar uso no CRM: a 007 não usa essas definições (os Campos adicionais do CRM são chaves livres).",
              "O Funil padrão vem de `useFunis` (`plataforma.funis.padrao`); `defaultFunnelId` sai do `Workspace`.",
              "O diálogo de acesso deixa de oferecer Funil: o Funil novo é governado por `privado` e pelo Papel (`podeNoCrm`)."
            ],
            "pronto": "Início, Configurações e os Painéis de demonstração abrem sem `deals`, `contacts` e `conversations` no store, com os números vindos da api.",
            "nota": "Para o Painel, isto é uma ponte para ele não quebrar quando o CRM antigo sair. A Sessão 20 (tarefa 20.3) troca a ponte pela leitura no servidor."
          },
          {
            "n": "Ferramentas: Contatos e Canais pelos ids novos",
            "cam": [
              "dom",
              "web",
              "api"
            ],
            "hoje": "As operações de `packages/dominio/src/operations/ferramentas/` (`grupos.ts:110`, `:139`, `:256`, `:278`, `:296`, `participacoes.ts`, `comunidades.ts`, `permissoes.ts`, `provedor-simulado.ts`) acham Canal e Contatos dos Participantes em `state.channels` e `state.contacts`; `contatosComWhatsApp` (`derive-ferramentas.ts:318`) filtra `identidadeDeWhatsApp`. As telas em `apps/web/src/features/ferramentas/` (abas, popups, `criar-grupo-dialog.tsx`, `importar-grupos-dialog.tsx`, `participacoes.tsx`, `pedidos-de-entrada.tsx`) seguem o mesmo caminho.",
            "fazer": [
              "As operações recebem `canais` e `contatos` já conferidos, pela opção `lerDoCrm` em `rotas/operacoes.ts` (como na 3.3).",
              "`Grupo.canalId` e o Contato da Participação passam a guardar ids de `plataforma.canais` e `plataforma.contatos` (o script da 3.5 reescreve os existentes).",
              "`contatosComWhatsApp` vira `GET /contatos?comIdentificador=whatsapp` (filtro novo).",
              "Com (B) da decisão de Grupos e Flows, `conversaDoGrupo`, `enviosDoFlow`, `respostasDoFlow` e `receiveMessage` de `flows.ts:922` continuam no `Conversation` antigo, isolado num arquivo `types/conversa-de-grupo.ts`, até as Sessões 6 e 7."
            ],
            "pronto": "Criar um Grupo com dois Contatos da ficha nova grava as Participações com os ids de `plataforma.contatos`; os testes de `operations/ferramentas/` passam sem `state.contacts`."
          },
          {
            "n": "IA: alvos, escopos e âncoras pelos ids novos",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "`operations/ai.ts:989-997` e `operations/ia/agentes.ts:371-377` dão nome ao alvo (Negócio, Contato, Empresa, Conversa) pelo modelo antigo; `ia/agentes.ts:144` percorre `state.conversations`; `derive-ia.ts:309` confere Automação com escopo Funil em `state.funnels`. Na tela: `features/ia/ancora-do-chat.tsx:44-50`, `agentes/agente-completo.tsx`, `agentes/ensaiar-dialog.tsx`, `automacoes/automacao-spec.ts:455`, `editor-de-automacao.tsx` e `nova-automacao-dialog.tsx`.",
            "fazer": [
              "O nome do alvo vem de uma rota em lote `POST /crm/nomes` com `{ alvos: [{ tipo, id }] }` (até 200), que a tela chama.",
              "O escopo Funil das Automações e Agentes guarda o id de `plataforma.funis`; `derive-ia.ts` recebe a lista de Funis ativos como argumento.",
              "A âncora do Chat em Negócio, Contato ou Conversa usa `useNegocio`, `useContato` e `useConversa`; o Canal das Automações vem de `useCanais`."
            ],
            "pronto": "Ancorar um Chat num Negócio novo mostra o título certo; os testes de `operations/ia/` passam sem `deals`, `contacts` e `conversations` no estado."
          },
          {
            "n": "Contas a receber: o cliente pelas tabelas",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "O cliente da conta a receber é um Contato ou Empresa antigo: `clienteDe` (`packages/dominio/src/operations/financeiro.ts:1747`) e `createReceivableSeries` (`:1808`) leem `state.contacts`; `features/estrutura/financeiro/serie-dialog.tsx:78` e `lens.ts:176` mostram o nome; a importação do ClickUp monta o catálogo de clientes de `state.contacts` e `state.companies` (`apps/api/src/importacao/clickup/importar-contas-a-receber.ts:62`; `operations/importacao-contas-a-receber.ts:173`).",
            "fazer": [
              "`clienteDe` devolve só `{ tipo: 'contact' | 'company', id }` do Vínculo “cliente”; o nome vem de `POST /crm/nomes`.",
              "`createReceivableSeries` recebe o cliente conferido pela opção `lerDoCrm` em `rotas/operacoes.ts` (Contato `ativo` em `plataforma.contatos`).",
              "`construirCatalogoDeClientes` lê `plataforma.contatos` e `plataforma.empresas` com `estado = 'ativo'`.",
              "O seletor de cliente do `serie-dialog.tsx` usa `useContatos`."
            ],
            "pronto": "Criar uma série de contas para um Contato da ficha nova grava o Vínculo “cliente” com o id de `plataforma.contatos`; `contas-a-receber.test.ts` da importação passa lendo as tabelas."
          }
        ]
      },
      {
        "id": "3.5",
        "n": "Migrar os dados antigos e remover o modelo antigo",
        "objetivo": "Os registros antigos precisam ir para as tabelas com os ids trocados em todos os lugares que apontam para eles. Depois disso, tipos, operações, coleções e a ponte de Canais saem do código.",
        "pronto": "Homologação e produção rodaram o script; `npm run check` passa sem o modelo antigo.",
        "subs": [
          {
            "n": "Escrever o script de migração do CRM antigo",
            "cam": [
              "api",
              "banco"
            ],
            "hoje": "Os dados antigos estão em `plataforma.registros`, nas coleções `contacts`, `companies`, `contactCompanyLinks`, `funnels`, `deals`, `channels` e `conversations` (com as Mensagens dentro de cada Conversa). Não existe script de cópia.",
            "fazer": [
              "Criar `apps/api/src/importacao/crm-antigo/migrar-crm-antigo.ts` e `.cli.ts`, com o comando `npm run migrar:crm-antigo -w @n1/api -- --espaco <id> [--seco]`. `--seco` só conta e lista o que não tem destino.",
              "Uma transação por Espaço. Cada registro copiado grava uma linha em `plataforma.crm_de_para`; rodar de novo pula o que já está lá.",
              "Contato → `contatos`: `firstName`/`lastName` → `nome`/`sobrenome`; `ownerMemberId` → `proprietario_id`; `creationMode` (`automaticoPorMensagem` → `automatico_mensagem`; `automaticoPorAutomacaoOuAgente` e `automaticoPorGrupo` → `automatico_automacao`; `desdobradoDeMesclagem` → `manual`); `lifecycle` (`naLixeira` → `na_lixeira`; `mesclado` → `mesclado` com `mesclado_em_id` pelo de-para); `qualificationId` → `qualificacao`; `fieldValues` → `campos_adicionais` pelo nome do Campo; `consents` → `contato_consentimentos`; `comments` → `contato_notas`.",
              "Identificadores: `telefone` → `telefone`, `email` → `email`, `identidadeDeWhatsApp` → `whatsapp`, `usuarioDeInstagram` → `instagram`. `perfilDeLinkedIn`, `perfilDeTikTok` e `identificadorDeChatDoSite` não têm tipo na 007 e vão para o relatório de não migrados.",
              "Empresa → `empresas` e `empresa_identificadores` (`documentoFiscal` → `documento_fiscal`); `ContactCompanyLink` → `contato_empresa` (`role` → `cargo`).",
              "Funil → `funis` e `etapas` (nome, ordem, probabilidade); Negócio → `negocios` com `funil_id` e `etapa_id` pelo de-para. Dono: `companyId` → `empresa_id`; sem Empresa, o Contato principal de `contactLinks` → `contato_id` (`negocios_dono_ck` exige um só).",
              "Canal: os de tipo `whatsapp`, `instagram` e `email` sem `relational` → `canais`, com o provedor padrão do tipo (`PROVEDOR_PADRAO_DO_TIPO`) e `conexao = 'desconectada'`. `linkedin` e `chatDoSite` não cabem em `canais_tipo_ck` e vão para o relatório.",
              "Conversa → `conversas` (sem as de Grupo, se a decisão for (B)); sem `contactId`, vai para o relatório; na lixeira, entra `resolvida` e `na_lixeira` (`conversas_lixeira_ck`). Cada `Message` → `mensagens`, em ordem de `createdAt`; recebida sem `externalId` ganha `id_externo = 'migrado:<id antigo>'`, porque a 008 exige id externo na recebida.",
              "Reescrever o que fica em `registros` apontando para ids antigos: `links` (`toId` de `contact`, `company`, `deal`, `conversation`), `tasks[].provenance.sourceId`, `lists[].canaisDeAtendimento`, `grupos[].canalId` e Participações, escopos `funnel` de Automações, Agentes e Painéis, e `grants` de Funil.",
              "Por fim, copiar as linhas antigas para `plataforma.registros_crm_antigo` e apagá-las de `plataforma.registros`. Isso é obrigatório: `hidratar()` (`apps/api/src/persistencia/repositorio.ts:96`) carrega qualquer coleção que estiver no banco, então linha que fica volta no `GET /estado`."
            ],
            "pronto": "Teste de integração `apps/api/src/importacao/crm-antigo/migrar-crm-antigo.test.ts` sobre um Espaço semeado: depois de rodar, `select colecao, count(*) from plataforma.registros where colecao in ('contacts','companies','deals','funnels','channels','conversations','contactCompanyLinks') group by 1` volta vazio, todo Vínculo de Tarefa aponta para um id que existe nas tabelas, e rodar de novo não muda nada."
          },
          {
            "n": "Rodar a migração em homologação e em produção",
            "cam": [
              "voce",
              "infra"
            ],
            "hoje": "—",
            "fazer": [
              "Backup do banco antes (Sessão 1).",
              "Em homologação: `--seco`, conferir com você o relatório de não migrados, rodar, abrir Caixa, fichas, Listas conversacionais e Contas a receber.",
              "Em produção: o mesmo, junto com o deploy das telas trocadas (3.4)."
            ],
            "pronto": "Você aprova o relatório de não migrados e a conferência das telas nos dois ambientes."
          },
          {
            "n": "Tirar o CRM antigo do seed",
            "cam": [
              "dom"
            ],
            "hoje": "`seed.ts`, `seed-comercial.ts`, `seed-pos-venda.ts`, `seed-produto.ts`, `seed-ferramentas.ts` e `seed-contas-a-receber.ts` (este em `:223`) criam Contatos, Empresas, Negócios, Funis, Canais e Conversas antigos para a demonstração.",
            "fazer": [
              "Tirar do seed tudo o que é do CRM antigo.",
              "Para o ambiente de desenvolvimento: rodar o script da subtarefa anterior uma vez sobre um Espaço semeado com a versão atual e salvar o resultado como `apps/api/src/bootstrap/crm-demo.sql` (só dados), aplicado por `npm run bootstrap:crm-demo -w @n1/api`."
            ],
            "pronto": "`npm run check -w @n1/dominio` passa com o seed novo; um Espaço de desenvolvimento novo, depois de `bootstrap:crm-demo`, mostra Contatos e Conversas na Caixa."
          },
          {
            "n": "Remover o modelo antigo",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "Os dois modelos convivem; a ponte `canais-projetados.ts` existe só por isso.",
            "fazer": [
              "Em `packages/dominio/src/types/crm.ts`: apagar `Contact`, `Company`, `Deal`, `Funnel`, `Stage`, `Channel`, `Conversation`, `Message`, `Participant`, `Draft`, `ContactCompanyLink`, `CompanyCompanyLink`, `DistinctFromLink` e afins. Ficam `Queue`, `Inbox` e `BusinessHours` (Filas e Caixa continuam em `registros`).",
              "Mover `ChannelType`, `ProvedorDeCanal`, `ChannelCapabilities`, `CHANNEL_CAPABILITIES` e `capacidadesDoCanal` (`operations/conversations.ts:20` e `:115`, usados por `apps/api/src/servicos/crm/mensagens.ts:37`) para `packages/dominio/src/crm/capacidades.ts`, e ajustar `provedores-de-canal.ts`.",
              "Apagar `operations/contacts.ts`, `conversations.ts`, `deals.ts`, `iniciar-conversa.ts`, `criarCanal` e `configurarCanal` de `operations/canais.ts`, e `marketingConsentMissing` (`derive.ts:443`); tirar essas operações de `OPERACOES` (`operations/registro.ts:420`) e de `apps/api/src/rotas/esquemas-de-argumentos.ts`.",
              "Tirar `contacts`, `companies`, `deals`, `funnels`, `contactCompanyLinks`, `companyCompanyLinks`, `distinctFromLinks`, `channels` e `conversations` de `DataState` (`state.ts`) e de `TODAS` (`colecoes.ts`).",
              "Apagar `apps/api/src/persistencia/canais-projetados.ts` e o teste, as chamadas em `rotas/estado.ts:41` e `persistencia/unidade-de-trabalho.ts:137` e `:189`, e `canalAntigoEmConflito` (`repositorios/crm/referencias.ts:63`).",
              "Atualizar `CONTEXT.md` da raiz (parágrafos da Fase 7 e 8 sobre convivência) e `apps/api/src/persistencia/CONTEXT.md` (seção “A ponte dos Canais”)."
            ],
            "pronto": "`npm run check` passa; uma busca por `state.contacts`, `state.conversations`, `state.deals`, `state.channels` e `canais-projetados` em `packages/` e `apps/` não acha nada (salvo o resto de Grupos e Flows, se a decisão for (B))."
          }
        ]
      },
      {
        "id": "3.6",
        "n": "Porta de entrada de mensagens",
        "objetivo": "Hoje não existe endereço para um provedor entregar mensagem: `registrarRecebida` não tem rota e só grava numa Conversa já aberta. Aqui nasce o caminho único (webhook, fila de entrada, recebimento) que as Sessões 4, 7, 8 e 9 só precisam ligar.",
        "pronto": "Uma chamada do provedor de teste ao webhook, com o worker ligado, cria Contato, Conversa e Mensagem nas tabelas; a mesma chamada repetida não grava nada novo.",
        "subs": [
          {
            "n": "Definir a interface do provedor de mensageria",
            "cam": [
              "api"
            ],
            "hoje": "Não existe interface de provedor de mensagens. As Ferramentas têm um provedor simulado próprio só para Grupos (`packages/dominio/src/operations/ferramentas/provedor-simulado.ts`).",
            "fazer": [
              "Arquivo novo `apps/api/src/mensageria/provedor.ts` com `interface ProvedorDeMensageria`. Mora no `apps/api` porque é entrada e saída de rede; os tipos que ela usa vêm do domínio (`TipoIdentificadorContato`, `StatusDeEntrega`, `ConexaoDoCanal`).",
              "`readonly provedor: ProvedorDeCanal`: `whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph` ou `email-imap-smtp`.",
              "`verificarChamada(chamada: { cabecalhos: Record<string, string>; corpoCru: Buffer }, segredo: string): boolean`: confere a assinatura ou o token da chamada ao webhook.",
              "`interpretarChamada(corpo: unknown): readonly EventoDoProvedor[]`, com três formas: `{ tipo: 'mensagem', idExterno, criadoEm, remetente: { tipo: TipoIdentificadorContato, valor, nomeExibido? }, conteudo?, anexos?: { referenciaNoProvedor, tipoDeMidia, nome }[], emRespostaAIdExterno?, assunto?, cargaBruta }`; `{ tipo: 'status', idExterno, status: StatusDeEntrega, em, motivo? }`; `{ tipo: 'conexao', conexao: ConexaoDoCanal, motivo? }`.",
              "`enviar(canal: CanalParaProvedor, envio: EnvioAoProvedor): Promise<ResultadoDoEnvio>` (ver 3.7), `baixarMidia(canal, referenciaNoProvedor): Promise<{ bytes: Uint8Array; tipoDeMidia: string; nome?: string }>` (ver 3.9) e `estadoDaConexao(canal): Promise<ConexaoDoCanal>`.",
              "`CanalParaProvedor` = o `Canal` de `crm/canais.ts` mais a credencial decifrada do cofre (Sessão 1, 1.4). Só existe dentro do `apps/api` e nunca vai para log.",
              "`apps/api/src/mensageria/registro.ts`: `provedorDoCanal(canal)` devolve o provedor de teste quando `conexao_simulada = true`, senão a implementação do `canal.provedor`; sem implementação, erro `PROVEDOR_INDISPONIVEL`.",
              "Provedor de teste `apps/api/src/mensageria/provedores/teste.ts`: guarda em memória o que recebeu em `enviar`, aceita o segredo fixo de teste e lê um JSON simples em `interpretarChamada`."
            ],
            "pronto": "`apps/api/src/mensageria/provedor.test.ts` é um conjunto de testes que recebe uma implementação e passa com o provedor de teste; as Sessões 4, 7, 8 e 9 rodam o mesmo conjunto contra a sua."
          },
          {
            "n": "Fazer o recebimento completo: Contato, Conversa e Mensagem",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`registrarRecebida` (`apps/api/src/servicos/crm/mensagens.ts:141`) exige `conversaId` e não muda a situação da Conversa. A regra completa só existe no modelo antigo: `receiveMessage` (`packages/dominio/src/operations/conversations.ts:315`) entra na Conversa aberta, reabre a resolvida dentro da janela da Caixa (`inbox.reopenWindowHours`), senão abre outra (RN-CXE-09), e devolve a `ativo` o Contato arquivado ou na lixeira (RN-CON-13).",
            "fazer": [
              "Domínio, `packages/dominio/src/crm/recebimento.ts` (novo): `destinoDaRecebida({ aberta, ultimaResolvida, janelaDeReaberturaHoras, agora })` → `{ acao: 'usar', conversaId } | { acao: 'reabrir', conversaId } | { acao: 'abrir' }`, com a regra de `receiveMessage` (pendente volta a aberta); e `contatoDaRecebida(estado)` para RN-CON-13 (`mesclado` segue para o sobrevivente).",
              "Serviço `apps/api/src/servicos/crm/recebimento.ts` (novo): `receberMensagem(workspaceId, canalId, evento)`, numa transação.",
              "Passo 1: se `obterPorIdExterno` (`repositorios/crm/mensagens.ts:236`) já acha a Mensagem, devolve `repetida: true` sem tocar em nada.",
              "Passo 2: normaliza o remetente (`normalizarIdentificadorDeContato`, `packages/dominio/src/crm/normalizacao.ts:118`) e acha o Contato por `detentorDoIdentificador` (`repositorios/crm/contatos.ts:380`), ou cria com `modo_criacao = 'automatico_mensagem'`, dono `canal.proprietario_padrao_id`, senão `canal.configurado_por`, e `origem = canal.origem_padrao_id`.",
              "Passo 3: aplica `destinoDaRecebida` com a janela de `inbox.reopenWindowHours` (lida de `plataforma.registros`, coleção `inbox`); Conversa nova nasce com `fila_id = canal.fila_padrao_id` e sem atribuído.",
              "Passo 4: grava a Mensagem com o `inserirRecebida` atual.",
              "Devolve `{ mensagem, conversa, contato, contatoNovo, conversaNova, conversaReaberta, repetida }`: é o que a Sessão 5 (Tarefa) e a Sessão 16 (Agente) usam para o passo seguinte.",
              "`registrarRecebida` sai da interface `ServicoDeMensagens` e vira o passo 4."
            ],
            "pronto": "Testes de serviço contra o Postgres real: Contato novo; Contato arquivado volta a `ativo`; Conversa aberta reaproveitada; resolvida dentro da janela reabre (`reaberturas` soma 1); resolvida fora da janela abre outra; a mesma Mensagem duas vezes grava uma linha só."
          },
          {
            "n": "Criar a rota de webhook por Canal",
            "cam": [
              "api"
            ],
            "hoje": "Não existe. As rotas públicas de hoje (`apps/api/src/rotas/formularios-publicos.ts`) mostram o molde: fora do hook de JWT, com limite de taxa.",
            "fazer": [
              "`POST /webhooks/mensageria/:canalId` em `apps/api/src/rotas/webhooks-de-mensageria.ts` (novo), registrada fora do hook de JWT, com limite de taxa e o corpo cru preservado para conferir assinatura.",
              "Acha o Canal pelo id (o Espaço vem do Canal, não da chamada) e pede ao provedor `verificarChamada` com o segredo do webhook guardado no cofre.",
              "Canal inexistente, arquivado ou chamada não verificada: a mesma resposta 401, sem dizer o motivo, para não revelar quais Canais existem.",
              "Verificada: grava a chamada em `plataforma.webhooks_recebidos` e responde 200 na hora; nada é processado dentro da requisição."
            ],
            "pronto": "Testes de rota: sem assinatura → 401 e nada gravado; com a do provedor de teste → 200 e uma linha `pendente` em `webhooks_recebidos`."
          },
          {
            "n": "Processar a fila de entrada",
            "cam": [
              "api"
            ],
            "hoje": "Não existe fila de entrada. O worker do outbox (`apps/api/src/persistencia/outbox-worker.ts`) já tem o molde de reivindicar, tentar de novo e desistir.",
            "fazer": [
              "Tabela `plataforma.webhooks_recebidos` (migração nova da 3.1): `id`, `workspace_id`, `canal_id`, `provedor`, `corpo jsonb`, `recebido_em`, `estado` (`pendente`, `processando`, `processado`, `falhou`), `tentativas`, `locked_at`, `locked_by`, `ultimo_erro`.",
              "Worker `apps/api/src/mensageria/processador-de-entrada.ts`: reivindica com `for update skip locked` (molde de `reivindicar`, `outbox-worker.ts:157`), roda `interpretarChamada` e trata cada evento: `mensagem` → `receberMensagem`; `status` → subtarefa seguinte; `conexao` → `definirConexao` do Canal (`repositorios/crm/canais.ts:209`).",
              "Falha → volta a `pendente` com `backoff` (`outbox-worker.ts:84`); `processando` com `locked_at` vencido volta a `pendente`. Reprocessar é seguro porque `receberMensagem` reconhece a repetida.",
              "Ligado em `apps/api/src/index.ts` por `MENSAGERIA_WORKER_ATIVO=true`, como o worker do outbox (`index.ts:175`).",
              "O `corpo` tem dado pessoal: as linhas `processado` são apagadas no prazo de retenção da Sessão 19."
            ],
            "pronto": "Teste: gravar uma chamada, simular queda do worker no meio (`locked_at` vencido) e religar processa a Mensagem uma vez só."
          },
          {
            "n": "Gravar o status de entrega que o provedor informa",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`plataforma.mensagens` tem `status_entrega`, `status_entrega_em` e `motivo_falha`, mas só o envio preenche (`statusInicialDeEnvio`, `packages/dominio/src/crm/mensagens.ts:192`).",
            "fazer": [
              "Domínio: `proximoStatusDeEntrega(atual, novo)` em `crm/mensagens.ts`, que só avança (`pendente` → `enviada` → `entregue` → `lida`; `falhou` só a partir de `pendente` ou `enviada`).",
              "Repositório: `atualizarStatusDeEntrega(workspaceId, canalId, idExterno, status, em, motivo?)` em `repositorios/crm/mensagens.ts`, chamado pelo processador para eventos `status`."
            ],
            "pronto": "Teste: um `lida` seguido de um `entregue` atrasado continua `lida`.",
            "nota": "A Sessão 4 (4.2, “Status, reações e mensagens apagadas”) só traduz o formato da Evolution para este evento."
          }
        ]
      },
      {
        "id": "3.7",
        "n": "Porta de saída de mensagens",
        "objetivo": "Hoje a Mensagem enviada fica gravada como `enviada` e não sai para lugar nenhum. Aqui ela passa pela fila de saída que já existe (outbox) e é entregue pelo provedor do Canal, com tentativas e status.",
        "pronto": "Uma resposta escrita na Caixa, num Canal simulado, chega ao provedor de teste e fica `enviada` com `id_externo`; com erro transitório, a fila tenta de novo.",
        "subs": [
          {
            "n": "Enfileirar o envio na mesma transação da Mensagem",
            "cam": [
              "dom",
              "api",
              "banco"
            ],
            "hoje": "`ServicoDeMensagens.enviar` (`apps/api/src/servicos/crm/mensagens.ts:91`) grava a Mensagem com `statusInicialDeEnvio` (`enviada` se o Canal está `conectada`, `pendente` se não) e para aí.",
            "fazer": [
              "Evento novo `mensagem.enviar.v1` em `EVENTOS` (`apps/api/src/persistencia/outbox.ts:33`), com payload `{ mensagemId, conversaId, canalId }`: sem texto e sem telefone, como os outros eventos.",
              "`statusInicialDeEnvio` passa a devolver sempre `pendente` para `enviada`: só o provedor diz que saiu.",
              "Em `enviar`, se a direção é `enviada` e o Canal está `conectada`, gravar o evento com `gravarEventos(cliente, …)` no mesmo cliente da Mensagem.",
              "Índice único (migração nova da 3.1) `(workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'mensagem.enviar.v1'`: a mesma Mensagem nunca entra duas vezes na fila.",
              "Quando o Canal volta a `conectada` (evento `conexao` da 3.6), enfileirar as Mensagens `pendente` dele: nada é descartado (B69)."
            ],
            "pronto": "Teste de serviço: enviar grava a Mensagem `pendente` e uma linha `mensagem.enviar.v1` no outbox; se o insert do evento falha, a Mensagem também não fica."
          },
          {
            "n": "Entregar pelo provedor em vez de HTTP",
            "cam": [
              "api"
            ],
            "hoje": "O worker (`entregar`, `apps/api/src/persistencia/outbox-worker.ts:230`) só faz POST no serviço `automation/`, pelo caminho de `CAMINHO_POR_EVENTO` (`:63`), e só liga com `OUTBOX_DESTINO_URL` e `OUTBOX_TOKEN` (`apps/api/src/index.ts:175`).",
            "fazer": [
              "`OpcoesOutboxWorker` (`outbox-worker.ts:116`) ganha `tiposDeEvento?: readonly NomeDeEvento[]` (`reivindicar` filtra por `event_type`) e `entregador?: (linha) => Promise<ResultadoDeEntrega>`, usado no lugar do POST.",
              "Entregador `apps/api/src/mensageria/entregar-mensagem.ts`: carrega Mensagem, Conversa, Canal e o Identificador do Contato do tipo que o Canal resolve (`TIPO_DE_IDENTIFICADOR_DO_CANAL`, `packages/dominio/src/crm/conversas.ts:92`), monta o envio e chama `provedorDoCanal(canal).enviar`.",
              "`EnvioAoProvedor` = `{ mensagemId, destino: { tipo, valor }, conteudo?, anexos?: { urlAssinada, tipoDeMidia, nome }[], emRespostaAIdExterno?, assunto?, modelo?: { idNoProvedor, idioma, variaveis } }`. `ResultadoDoEnvio` = `{ ok: true, idExterno } | { ok: false, transitorio: boolean, motivo }`.",
              "Aceito: grava `id_externo`, `status_entrega = 'enviada'` e `status_entrega_em`. Recusa permanente: `falhou` com `motivo_falha`. Transitória: a linha volta a `pending` com o backoff de hoje.",
              "Um segundo worker em `index.ts`, ligado por `MENSAGERIA_WORKER_ATIVO`, só com `mensagem.enviar.v1`; o worker atual passa `tiposDeEvento` com os quatro eventos de hoje."
            ],
            "pronto": "Teste em `apps/api/src/e2e/mensageria.test.ts`: enviar por `POST /mensagens` num Canal simulado faz o provedor de teste receber uma chamada e a Mensagem ficar `enviada` com `id_externo`; com o provedor devolvendo erro transitório duas vezes, a terceira tentativa entrega."
          },
          {
            "n": "Mostrar a entrega no fio e deixar tentar de novo",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "O fio antigo mostra `deliveryStatus` da Mensagem antiga; não há como reenviar uma que falhou.",
            "fazer": [
              "Rota `POST /mensagens/:id/reenviar`: só para `falhou`; volta a `pendente` e enfileira de novo.",
              "No fio (`features/crm/conversation-thread.tsx`), cada Mensagem enviada mostra pendente, enviada, entregue ou lida; `falhou` mostra o `motivo_falha` e o botão “Tentar de novo”."
            ],
            "pronto": "Com o provedor de teste recusando de vez, a Mensagem aparece “falhou” com o motivo; “Tentar de novo” com o provedor aceitando a deixa “enviada”."
          }
        ]
      },
      {
        "id": "3.8",
        "n": "Tempo real",
        "objetivo": "Hoje a tela pergunta a cada 5 s se a revisão do Espaço mudou, e as tabelas do CRM não mexem nessa revisão: uma Mensagem que chega não aparece sem recarregar. Aqui o servidor passa a avisar a tela.",
        "pronto": "Com duas abas abertas na mesma Conversa, a Mensagem que chega pelo webhook aparece nas duas em menos de 2 s.",
        "subs": [
          {
            "n": "Como mandar as novidades para a tela?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "`AcompanhanteDaRevisao` (`apps/web/src/dados/store.ts:319`) chama `GET /estado/revisao` (`apps/api/src/rotas/estado.ts:63`) a cada `INTERVALO_DA_REVISAO_MS` = 5 s (`store.ts:312`) e, se mudou, recarrega o Espaço inteiro. As telas do CRM leem por SWR e não são avisadas.",
            "opcoes": [
              "(A) Supabase Realtime, que já vem com o banco",
              "(B) Canal próprio no `apps/api` (SSE), alimentado por `LISTEN/NOTIFY` do Postgres"
            ],
            "muda": "(A) exige expor o schema `plataforma` ao Realtime com regras por linha, o contrário do que a Sessão 1 fecha. (B) cerca de 1 dia, e a regra de acesso continua no `apps/api`, onde já está.",
            "recomendo": "(B).",
            "peso": "produto"
          },
          {
            "n": "Publicar os eventos do CRM no banco",
            "cam": [
              "api"
            ],
            "hoje": "Nenhuma escrita do CRM avisa ninguém; só a escrita de Canal soma a revisão do Espaço (`avancarRevisaoDoEspaco`, `repositorios/crm/referencias.ts`).",
            "fazer": [
              "`apps/api/src/mensageria/avisar.ts`: `avisarCrm(cliente, evento)` faz `pg_notify('crm_eventos', json)` no mesmo cliente da transação; o Postgres só entrega no `commit`.",
              "Payload só com ids: `{ workspaceId, tipo: 'mensagem.nova' | 'mensagem.status' | 'conversa.mudou', conversaId, mensagemId? }`.",
              "Chamado por `receberMensagem`, `enviar`, `atualizarStatusDeEntrega` e pelos gestos da Conversa (resolver, reabrir, atribuir, mover, lixeira)."
            ],
            "pronto": "Teste: uma conexão em `LISTEN crm_eventos` recebe o evento depois do `commit` e nada depois de um `rollback`."
          },
          {
            "n": "Abrir a rota de eventos para a tela",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "`GET /eventos` em `apps/api/src/rotas/eventos.ts` (novo), `text/event-stream`, com o JWT no `Authorization`, como as outras rotas.",
              "Uma conexão `LISTEN crm_eventos` por processo, fora do pool; cada assinante recebe só os eventos do próprio Espaço e só se pode `ler` `conversa` (`exigir`, `apps/api/src/servicos/crm/acesso.ts:39`).",
              "Batida a cada 25 s, para o proxy não cortar a conexão."
            ],
            "pronto": "Teste de rota: um Membro de outro Espaço conectado em `/eventos` não recebe o evento; sem token, 401."
          },
          {
            "n": "Ouvir na tela",
            "cam": [
              "web"
            ],
            "hoje": "Só a releitura a cada 5 s.",
            "fazer": [
              "`apps/web/src/dados/tempo-real.ts`: `fetch` com o token e leitura do corpo em fluxo (o `EventSource` do navegador não manda `Authorization`).",
              "Montado no `StoreProvider` (`store.ts:296`), ao lado de `AcompanhanteDaRevisao`.",
              "A cada evento, `mutate` das chaves de `useConversas`, `useMensagens(conversaId)` e do resumo das Tarefas conversacionais.",
              "Reconecta com espera crescente; sem conexão, volta à releitura de 5 s."
            ],
            "pronto": "Duas abas na mesma Conversa: a recebida simulada pelo webhook aparece nas duas em menos de 2 s; derrubar a api e religar reconecta sozinho."
          }
        ]
      },
      {
        "id": "3.9",
        "n": "Mídia nas mensagens",
        "objetivo": "Hoje a Mensagem nova só tem texto: o anexo é uma referência externa sem arquivo, o upload não aceita áudio nem vídeo e a Caixa só envia texto. Aqui áudio, imagem, vídeo e documento passam a ir e vir guardados no bucket.",
        "pronto": "Um áudio recebido pelo provedor de teste toca na Conversa mesmo depois de o link do provedor expirar, e uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada.",
        "subs": [
          {
            "n": "Ligar o anexo da Mensagem a um arquivo guardado",
            "cam": [
              "dom"
            ],
            "hoje": "`AnexoDaMensagem` (`packages/dominio/src/crm/mensagens.ts:61`) tem só `tipoDeMidia`, `nome` e `referenciaExterna`; `validarNovaMensagem` (`:128`) exige texto e não aceita anexo.",
            "fazer": [
              "`AnexoDaMensagem` ganha `objectKey?: string` (o arquivo no bucket), `tamanhoBytes?: number` e `baixado: boolean` (falso enquanto só há a referência do provedor). A coluna `mensagens.anexos` já é jsonb: não muda o schema.",
              "`NovaMensagem` ganha `anexos?: readonly { objectKey, nome, tipoDeMidia }[]`; `validarNovaMensagem` aceita texto ou anexo (INV-CXE-07) e confere o tipo contra `sendableMediaTypes` das capacidades do Canal."
            ],
            "pronto": "Testes de domínio: Mensagem só com anexo é aceita; vídeo num Canal de e-mail (que não envia vídeo) é recusado."
          },
          {
            "n": "Aceitar áudio e vídeo nos anexos de Mensagem",
            "cam": [
              "api"
            ],
            "hoje": "`TIPOS_ACEITOS` (`apps/api/src/servicos/storage-uploads.ts:53`) tem só PDF, XML, JPEG, PNG e WebP, e é a mesma lista do Formulário público (`rotas/formularios-publicos.ts:46`).",
            "fazer": [
              "Lista própria `TIPOS_ACEITOS_NA_MENSAGEM` (os de hoje mais `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `video/mp4`, `video/3gpp`), sem alargar o Formulário.",
              "`assinaturaConfereComTipo` (`storage-uploads.ts:114`) ganha as assinaturas de OGG (`OggS`), MP3 (`ID3` ou `0xFF 0xFB`) e MP4/3GP (`ftyp` no byte 4).",
              "Teto de tamanho próprio para vídeo, por variável de ambiente, como `UPLOAD_MAX_BYTES`."
            ],
            "pronto": "Teste: um OGG verdadeiro é aceito, um arquivo de texto renomeado para `.ogg` é recusado, e o Formulário público continua recusando áudio."
          },
          {
            "n": "Rotas de upload e download de anexo de Mensagem",
            "cam": [
              "api"
            ],
            "hoje": "O anexo de Tarefa já faz isso (`apps/api/src/rotas/anexos-da-tarefa.ts:108`, com `formIdDaTarefa`); para Mensagem não existe.",
            "fazer": [
              "`POST /mensagens/anexos` com `{ conversaId, nome, tipoDeMidia, tamanhoBytes }`: abre a sessão (`abrirSessaoDeUpload` com `formId = conversa-<id>`) e emite o ticket; a chave segue `workspace/<ws>/conversas/<conversaId>/<uuid>`.",
              "`POST /mensagens` aceita `anexos` com o `objectKey` confirmado (`confirmarObjeto`) e consome a sessão na mesma transação.",
              "`GET /mensagens/:id/anexos/:indice` confere o acesso à Conversa e devolve `urlDeDownload` (`storage-uploads.ts:289`)."
            ],
            "pronto": "Teste de rota: um `objectKey` de outra Conversa é recusado; o download de um Membro sem acesso volta 403."
          },
          {
            "n": "Baixar a mídia do provedor ao receber",
            "cam": [
              "api"
            ],
            "hoje": "Não existe: a recebida guarda só o que vier em `anexos`.",
            "fazer": [
              "No processador de entrada, antes da transação: para cada anexo com `referenciaNoProvedor`, chamar `baixarMidia`, subir ao bucket com a chave da subtarefa anterior e gravar `objectKey` com `baixado: true`.",
              "Se o download falhar, a Mensagem é gravada assim mesmo com `baixado: false` e a referência; uma nova tentativa roda na próxima passada do worker."
            ],
            "pronto": "Teste com o provedor de teste: o link do provedor deixa de responder depois do recebimento e o anexo continua abrindo pela URL assinada."
          },
          {
            "n": "Anexar e tocar mídia no fio",
            "cam": [
              "web"
            ],
            "hoje": "O compositor de `features/crm/conversation-thread.tsx` envia só texto; `apps/web/src/dados/envio-ao-bucket.ts` já sobe arquivo por URL assinada para Formulário e Tarefa.",
            "fazer": [
              "Botão de anexar no compositor, usando `envio-ao-bucket.ts`; só oferece os tipos que o Canal envia (`sendableMediaTypes`).",
              "No fio: `<audio>`, `<video>`, `<img>` e link de documento, com a URL de `GET /mensagens/:id/anexos/:indice`."
            ],
            "pronto": "Anexar uma imagem pela Caixa mostra a imagem no fio e o provedor de teste recebe a URL assinada."
          },
          {
            "n": "Ligar a limpeza de arquivos órfãos",
            "cam": [
              "api"
            ],
            "hoje": "`coletarOrfaos` (`apps/api/src/servicos/storage-uploads.ts:305`) apaga do bucket o que foi enviado e nunca virou anexo, mas só o teste a chama.",
            "fazer": [
              "Rodar uma vez por dia a partir de `apps/api/src/index.ts`, ligado por `COLETA_DE_ORFAOS_ATIVA=true`, protegido por `pg_try_advisory_lock` para só uma instância rodar.",
              "Logar só as contagens (`sessoesExpiradas`, `objetosRemovidos`)."
            ],
            "pronto": "Teste: uma sessão expirada criada no teste some do bucket na rodada seguinte."
          }
        ]
      }
    ],
    "ajuste": "+9 dias: o modelo antigo do CRM é usado por cerca de 70 arquivos da tela e 33 do domínio, e a sessão recebeu a Tarefa conversacional (que estava na Sessão 5) e a ponte do Painel."
  },
  {
    "id": "5",
    "n": "Lista conversacional",
    "dias": [
      2,
      2
    ],
    "dep": [
      "4"
    ],
    "desc": "Liga a Lista conversacional ao WhatsApp real: a mensagem que chega cria ou atualiza a Tarefa, e a resposta escrita na Tarefa sai pelo WhatsApp. Depende da Evolution (Sessão 4) e da porta de entrada da Sessão 3. Levar a Tarefa conversacional para as tabelas novas saiu daqui e foi para a Sessão 3 (tarefa 3.3).",
    "partida": [
      "A Tarefa conversacional cria, troca o Canal e liga o Negócio pelas tabelas novas (Sessão 3, 3.3).",
      "`receberMensagem` (Sessão 3, 3.6) devolve `{ contato, conversa, contatoNovo, conversaNova, conversaReaberta, repetida }` para o passo seguinte.",
      "A ficha da Tarefa mostra o fio com o mesmo `ConversationThread` da Caixa (`apps/web/src/features/estrutura/tarefa-completa.tsx:2189`), e o envio sai pela fila de saída (Sessão 3, 3.7).",
      "Um número conectado pela Evolution (Sessão 4)."
    ],
    "pronto": "Uma mensagem de um celular para o número conectado cria (ou atualiza) a Tarefa na Lista conversacional certa, e a resposta escrita na ficha da Tarefa chega no celular.",
    "tarefas": [
      {
        "id": "5.1",
        "n": "Entrada automática pela Lista conversacional",
        "objetivo": "Hoje a Tarefa conversacional só nasce quando alguém a cria. Com o WhatsApp real, a mensagem de um Contato novo cai só na Caixa de Entrada. Aqui se decide e se constrói o que a mensagem faz na Lista.",
        "pronto": "A primeira mensagem de um número novo cria Contato, Conversa e uma Tarefa na Lista; as seguintes não criam outra.",
        "subs": [
          {
            "n": "Mensagem nova cria Tarefa?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "A Tarefa conversacional só nasce pelo diálogo da Lista ou pelo botão do fio.",
            "opcoes": [
              "(A) Sim: mensagem de um Contato sem Tarefa aberta na Lista cria uma; com Tarefa aberta, só atualiza o cartão",
              "(B) Não: a mensagem só aparece na Caixa de Entrada, e alguém cria a Tarefa"
            ],
            "muda": "Com (A), a Lista vira a fila de atendimento. Com (B), a Caixa de Entrada continua sendo a fila e esta tarefa encolhe para meio dia.",
            "recomendo": "(A), porque é o propósito da Lista conversacional.",
            "peso": "produto"
          },
          {
            "n": "E se o Canal estiver em mais de uma Lista conversacional?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "`validarCanaisDeAtendimento` (`packages/dominio/src/operations/canais.ts:133`) deixa o mesmo Canal em várias Listas.",
            "opcoes": [
              "(A) Um Canal só pode estar em uma Lista conversacional: marcar em outra é recusado",
              "(B) A Tarefa nasce na primeira Lista, pela ordem da Estrutura",
              "(C) Nasce uma Tarefa em cada Lista"
            ],
            "muda": "(A) é uma recusa a mais na configuração e deixa a regra óbvia. (B) esconde de onde a Tarefa veio. (C) duplica o atendimento.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "E se a Tarefa do Contato já estiver concluída?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Nada acontece com a Tarefa quando chega mensagem.",
            "opcoes": [
              "(A) Reabre a Tarefa concluída, voltando ao Status inicial da Lista",
              "(B) Cria uma Tarefa nova e deixa a concluída como histórico",
              "(C) Segue a Conversa: se a Conversa reabriu (dentro da janela da Caixa), reabre a Tarefa; se nasceu Conversa nova, cria Tarefa nova"
            ],
            "muda": "(A) junta atendimentos diferentes na mesma Tarefa. (B) cria Tarefa até para um “obrigado” logo depois de concluir. (C) usa a mesma janela que já decide a Conversa.",
            "recomendo": "(C).",
            "peso": "produto"
          },
          {
            "n": "Decidir no domínio o que a mensagem faz com a Tarefa",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe regra; `tarefasConversacionaisDoContato` (`packages/dominio/src/derive-conversacional.ts:137`) já acha as Tarefas do Contato.",
            "fazer": [
              "`tarefaDaRecebida(state, { canalId, contatoId, conversaId, conversaNova, conversaReaberta })` em `packages/dominio/src/operations/tarefas-conversacionais.ts` → `{ acao: 'nada' } | { acao: 'criar', listId } | { acao: 'atualizar', taskId, statusId? }`.",
              "Acha a Lista conversacional cujo `canaisDeAtendimento` tem o Canal, as Tarefas ativas dela com Vínculo para o Contato, e aplica as três decisões acima.",
              "Se a decisão de “mais de uma Lista” for (A), `validarCanaisDeAtendimento` passa a recusar Canal já usado em outra Lista conversacional."
            ],
            "pronto": "Testes de domínio de cada caso: Contato sem Tarefa; com Tarefa aberta; com Tarefa concluída e Conversa reaberta; com Tarefa concluída e Conversa nova; Canal fora de qualquer Lista."
          },
          {
            "n": "Criar ou atualizar a Tarefa quando a mensagem chega",
            "cam": [
              "api"
            ],
            "hoje": "O processador de entrada (Sessão 3, `apps/api/src/mensageria/processador-de-entrada.ts`) para em `receberMensagem`.",
            "fazer": [
              "Depois de `receberMensagem` com `repetida: false`, chamar `executar()` com `tarefaDaRecebida` e, conforme o resultado, `criarTarefaConversacional` (com Contato, Canal e Conversa já lidos, sem abrir Conversa) ou a troca de Status.",
              "Ator: o Membro “Agente do pipeline” (`resolverMembroAgenteDoPipeline`, `apps/api/src/persistencia/credenciais-de-servico.ts:96`), como as integrações já fazem. Responsável da Tarefa nova: o atribuído da Conversa, se houver; senão nenhum.",
              "Roda depois do `commit` da Mensagem: falhar aqui não perde a Mensagem. A linha de `webhooks_recebidos` volta a `pendente`, e reprocessar é seguro porque `tarefaDaRecebida` acha a Tarefa já criada."
            ],
            "pronto": "Teste em `apps/api` com o provedor de teste: a primeira chamada de um número novo cria Contato, Conversa e Tarefa; a segunda não cria outra Tarefa; repetir a mesma chamada do webhook não duplica nada."
          },
          {
            "n": "Mostrar a Tarefa nova na Lista sem recarregar",
            "cam": [
              "web"
            ],
            "hoje": "A Tarefa criada pelo servidor só aparece na próxima releitura da revisão (até 5 s), e o cartão não sabe que chegou mensagem.",
            "fazer": [
              "Em `apps/web/src/dados/tempo-real.ts` (Sessão 3), um evento `mensagem.nova` também chama `verificarRevisao()` do store.",
              "O resumo das Tarefas conversacionais (`useResumoDasTarefas`) é revalidado no mesmo evento."
            ],
            "pronto": "Com a Lista aberta, a Tarefa nova aparece em menos de 2 s, e o cartão mostra o trecho da última mensagem."
          }
        ]
      },
      {
        "id": "5.2",
        "n": "Responder pela Tarefa pelo WhatsApp",
        "objetivo": "A ficha da Tarefa já embute o fio da Caixa. Depois da Sessão 3 o envio sai pela fila; falta garantir que, na Tarefa, a resposta vai pela Conversa da Tarefa e que quem atende vê se chegou.",
        "pronto": "A resposta escrita na ficha da Tarefa chega no WhatsApp e mostra “entregue” na ficha.",
        "subs": [
          {
            "n": "Responder sempre pela Conversa da Tarefa",
            "cam": [
              "web"
            ],
            "hoje": "No fio, “Responder por” escolhe o Canal pelo padrão do Contato (`canalPadraoDeResposta`, `packages/dominio/src/derive-conversacional.ts:271`); dentro da Tarefa, pode cair num Canal que não é o da Lista.",
            "fazer": [
              "`ConversationThread` ganha a prop `conversaFixaId`, passada pela ficha (`tarefa-completa.tsx:2189`) com a Conversa do Vínculo “conversa da Tarefa”.",
              "Com ela, “Responder por” mostra só os Canais da Lista (`canaisDaLista`), com o da Tarefa marcado; escolher outro chama a troca de Canal da Tarefa (Sessão 3, 3.3)."
            ],
            "pronto": "Teste de componente: responder na ficha grava a Mensagem com o `conversaId` do Vínculo, e o seletor não mostra Canal fora da Lista."
          },
          {
            "n": "Testar a resposta contra a Evolution de homologação",
            "cam": [
              "api"
            ],
            "hoje": "Os testes de envio da Sessão 3 usam o provedor de teste.",
            "fazer": [
              "Teste em `apps/api/src/e2e/` que roda só com as variáveis da Evolution de homologação: cria a Tarefa conversacional num Canal Evolution, envia por `POST /mensagens` e espera a Mensagem ficar `enviada` com `id_externo` e depois `entregue` pelo webhook."
            ],
            "pronto": "O teste passa contra a Evolution de homologação e é pulado sem as variáveis."
          }
        ]
      },
      {
        "id": "5.3",
        "n": "Validar de ponta a ponta com número real",
        "objetivo": "Ver o fluxo inteiro com um celular de verdade, antes de liberar para a equipe.",
        "pronto": "Você aprova os seis passos do roteiro.",
        "subs": [
          {
            "n": "Percorrer o roteiro com um celular",
            "cam": [
              "voce"
            ],
            "hoje": "—",
            "fazer": [
              "1. Conectar o número de teste pela Evolution (Sessão 4) e marcá-lo como Canal da Lista conversacional.",
              "2. Do seu celular, mandar “oi” para o número.",
              "3. Conferir: a Tarefa nasce na Lista com o nome do Contato (ou o número), e o cartão mostra “oi”.",
              "4. Abrir a Tarefa e responder; conferir no celular e ver “entregue” na ficha.",
              "5. Mandar um áudio do celular; conferir que ele toca na ficha.",
              "6. Concluir a Tarefa e mandar outra mensagem; conferir que acontece o que a decisão da 5.1 manda."
            ],
            "pronto": "Os seis passos funcionam; o que falhar vira subtarefa nesta tarefa."
          }
        ]
      }
    ]
  }
];
