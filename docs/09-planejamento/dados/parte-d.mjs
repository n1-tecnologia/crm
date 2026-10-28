// Parte d do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "4",
    "n": "WhatsApp não oficial (Evolution API)",
    "dias": [
      1,
      2
    ],
    "dep": [
      "3"
    ],
    "desc": "Liga o primeiro provedor real: números comuns de WhatsApp, conectados por QR code pela Evolution API. A Evolution é um servidor que conversa com o WhatsApp como se fosse um aparelho conectado ao celular. Cada número vira um Canal `whatsapp-nao-oficial` com a sua própria instância na Evolution (instância = uma sessão de WhatsApp lá dentro). Vem antes dos outros provedores porque destrava a Lista conversacional (Sessão 5) e as Ferramentas (Sessão 6).",
    "partida": [
      "O Canal `whatsapp-nao-oficial` já nasce `desconectada` em `plataforma.canais` pela página `/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-nao-oficial` (`apps/web/src/features/crm/conectar-provedor.tsx`).",
      "A única conexão é o botão “Simular conexão” da ficha do Canal (`apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx:318-326`), que chama `POST /canais/:id/simular-conexao` (`apps/api/src/rotas/crm/canais.ts:93`) e grava `conexao_simulada = true` pela regra `proximaConexao` (`packages/dominio/src/crm/canais.ts:131`).",
      "As capacidades do não oficial já estão certas: sem janela de 24 h e sem modelo (`capacidadesDoCanal`, `packages/dominio/src/operations/conversations.ts:115`).",
      "Da Sessão 1: o cofre de credenciais cifradas e o servidor onde a Evolution vai rodar.",
      "Da Sessão 3: a interface de provedor, a rota de webhook por provedor com fila de entrada, a porta de saída pela outbox, o tempo real, a mídia nas mensagens e o CRM unificado nas tabelas novas.",
      "Os avisos das Automações do Financeiro já saem por uma Evolution, mas de fora: o evento `automacao.notificar-canal.v1` vai pela outbox ao serviço externo `automation/` (`/webhooks/plataforma/notificar-canal`, `apps/api/src/persistencia/outbox-worker.ts:67`), que envia pela instância fixa `numeropvmarcos`."
    ],
    "pronto": "Dois números conectados por QR code pela ficha do Canal recebem e respondem texto, imagem e áudio pela Caixa de Entrada, cada um nas suas Conversas; os tiques de entregue e lida aparecem; desligar o celular muda o estado do Canal sem ninguém clicar nada; e “Simular conexão” não existe mais em produção.",
    "tarefas": [
      {
        "id": "4.1",
        "n": "Pré-requisitos",
        "objetivo": "Ter os números e a Evolution prontos antes de escrever código. Hoje não há número escolhido nem Evolution instalada, e sem os dois nada desta sessão pode ser testado.",
        "pronto": "A lista de números está anotada e a Evolution responde no servidor.",
        "subs": [
          {
            "n": "Separar os números e os celulares",
            "cam": [
              "voce"
            ],
            "hoje": "Nenhum número escolhido.",
            "fazer": [
              "Escolher pelo menos dois números para testar. Um deles pode ser o que vai para produção.",
              "Cada número precisa estar ativo no WhatsApp (de preferência o WhatsApp Business) num celular que fique ligado e com internet: a Evolution funciona como um aparelho conectado a ele.",
              "Não usar o número da instância `numeropvmarcos`: ela é do `automation/` (ver a decisão de 4.5).",
              "Anotar nesta tarefa, para cada número: o número, o nome do Canal (ex.: “Comercial”) e quem fica com o celular."
            ],
            "pronto": "A lista está anotada nesta tarefa.",
            "nota": "A API não oficial vai contra os termos do WhatsApp: um número pode ser bloqueado se mandar muita mensagem para quem não o tem salvo. Use números que aguentem esse risco."
          },
          {
            "n": "Instalar a Evolution API no servidor da Sessão 1",
            "cam": [
              "infra"
            ],
            "hoje": "A Sessão 1 (1.6) deixa o servidor pronto, sem a Evolution.",
            "fazer": [
              "Subir a Evolution API v2 por Docker, com um Postgres só dela (variáveis `DATABASE_PROVIDER=postgresql` e `DATABASE_CONNECTION_URI`). Nunca o banco da plataforma.",
              "Definir a chave global `AUTHENTICATION_API_KEY` e o endereço público `SERVER_URL`, atrás de HTTPS.",
              "Fechar o painel `/manager` da Evolution para fora (só por VPN ou por IP liberado).",
              "Gravar no `.env` do `apps/api` duas variáveis novas, `EVOLUTION_URL` e `EVOLUTION_API_KEY`, e documentá-las em `apps/api/.env.example`."
            ],
            "pronto": "Uma chamada a `GET /instance/fetchInstances` na Evolution, com a chave global no cabeçalho `apikey`, responde 200 com a lista vazia.",
            "nota": "Conferir no repositório oficial (`EvolutionAPI/evolution-api`) o nome atual da imagem Docker e das variáveis antes de instalar."
          }
        ]
      },
      {
        "id": "4.2",
        "n": "Conexão por QR code",
        "objetivo": "Conectar um número de verdade lendo um QR code na ficha do Canal. Hoje a ficha só tem “Simular conexão”, que marca o Canal como conectado sem falar com ninguém.",
        "pronto": "Criar um Canal não oficial, clicar em “Conectar” e ler o QR code com o celular deixa o Canal “conectada” na tela, sem recarregar.",
        "subs": [
          {
            "n": "Ensinar a conexão real ao domínio",
            "cam": [
              "dom"
            ],
            "hoje": "`AcaoDeConexao` (`packages/dominio/src/crm/canais.ts:129`) só tem `simular_conexao` e `desconectar`, e `proximaConexao` (`:131`) só trata essas duas. `AcaoCrm` (`packages/dominio/src/crm/permissoes.ts:47`) não tem “conectar”.",
            "fazer": [
              "Acrescentar a `AcaoDeConexao` três ações: `conectar` (a pessoa pede o QR code), `conexao_confirmada` (o provedor avisou que conectou) e `conexao_perdida` (o provedor avisou que caiu). `desconectar` fica.",
              "Em `proximaConexao`: `conexao_confirmada` leva a `conectada` com `conexaoSimulada` falso; `conexao_perdida` leva a `com_erro`; `conectar` é recusado num Canal arquivado ou já conectado e não muda a conexão.",
              "Acrescentar `conectar` a `AcaoCrm` em `permissoes.ts`, com a mesma regra de quem pode `simular_conexao` hoje.",
              "Nova função `conferirNumeroConectado(canal, numeroDoProvedor)` em `canais.ts`: compara o número que o provedor diz ter conectado com o `identificadorExterno` do Canal e recusa se forem diferentes."
            ],
            "pronto": "Testes em `packages/dominio/src/crm/canais.test.ts` cobrem as quatro ações e o caso do número diferente."
          },
          {
            "n": "Criar o cliente da Evolution no apps/api",
            "cam": [
              "api"
            ],
            "hoje": "Nenhum código do `apps/api` chama a Evolution. O único que chama está no `automation/` (`adapters/evolution.ts`, fora deste repositório).",
            "fazer": [
              "Criar `apps/api/src/provedores/evolution/cliente.ts` (dentro da pasta de provedores que a Sessão 3 criar), com `fetch`, cabeçalho `apikey` e tempo limite em toda chamada.",
              "Uma função por chamada da Evolution v2: `criarInstancia` (`POST /instance/create`, com `integration: WHATSAPP-BAILEYS` e `qrcode: true`), `pedirQrCode` (`GET /instance/connect/{instancia}`), `estadoDaConexao` (`GET /instance/connectionState/{instancia}`), `configurarWebhook` (`POST /webhook/set/{instancia}`), `sairDaSessao` (`DELETE /instance/logout/{instancia}`), `apagarInstancia` (`DELETE /instance/delete/{instancia}`), `enviarTexto` (`POST /message/sendText/{instancia}`), `enviarMidia` (`POST /message/sendMedia/{instancia}`), `enviarAudio` (`POST /message/sendWhatsAppAudio/{instancia}`) e `baixarMidia` (`POST /chat/getBase64FromMediaMessage/{instancia}`).",
              "Nome da instância: `n1-<workspaceId>-<canalId>`, para nunca colidir entre Espaços de Trabalho nem com a `numeropvmarcos`.",
              "Os erros da Evolution viram os erros da interface de provedor da Sessão 3 (transitório ou permanente) e passam por `sanitizarErro` (`apps/api/src/persistencia/outbox-worker.ts:108`) antes de ir para o log."
            ],
            "pronto": "Testes em `apps/api/src/provedores/evolution/cliente.test.ts` contra `criarServidorFalso` (`apps/api/src/testes/servidor-falso.ts`) cobrem cada função, uma resposta 401 e um tempo esgotado.",
            "nota": "Os caminhos acima são os da Evolution API v2. Conferir na documentação da versão instalada antes de codificar."
          },
          {
            "n": "Criar a rota de conectar",
            "cam": [
              "api"
            ],
            "hoje": "`POST /canais/:id/simular-conexao` (`apps/api/src/rotas/crm/canais.ts:93`) chama `simularConexao` (`apps/api/src/servicos/crm/canais.ts:255`), que só grava a marca no banco.",
            "fazer": [
              "Nova rota `POST /canais/:id/conectar` em `rotas/crm/canais.ts`, servida por uma função nova `conectar` em `servicos/crm/canais.ts`.",
              "O serviço confere o Papel com `exigir` e a ação `conectar`. Para `whatsapp-nao-oficial`: cria a instância se ainda não existe; guarda no cofre da Sessão 1 o token da instância que a Evolution devolve; aponta o webhook da instância para a rota de webhook da Sessão 3 (ver 4.4); devolve o QR code (imagem em base64) e o código de pareamento.",
              "Se a instância já existe e está desconectada, só pede um QR code novo (`pedirQrCode`).",
              "Nada grava `conectada` aqui: o Canal só muda quando a Evolution confirmar (4.3)."
            ],
            "pronto": "Teste em `apps/api/src/rotas/crm/canais.test.ts`: `POST /canais/:id/conectar` devolve o QR code, a credencial fica cifrada no cofre e o Canal continua `desconectada`."
          },
          {
            "n": "Mostrar o QR code na ficha do Canal",
            "cam": [
              "web"
            ],
            "hoje": "A página de conectar mostra um quadro tracejado “disponível quando a integração chegar” (`apps/web/src/features/crm/conectar-provedor.tsx:136-145`, texto em `apps/web/src/features/crm/conectar-canal.ts:40-43`). Depois de criar, ela só abre a ficha (`conectar-provedor.tsx:91`). A ficha mostra “Simular conexão” (`[canal]/page.tsx:318-326`).",
            "fazer": [
              "Na ficha `[canal]/page.tsx`, para o provedor `whatsapp-nao-oficial`, trocar “Simular conexão” por “Conectar”. O clique chama `conectarCanal(id)` (nova, em `apps/web/src/dados/crm/canais.ts`) e abre um painel com o QR code e os passos de `ORIENTACAO_DO_PROVEDOR` (`conectar-canal.ts:33`).",
              "O QR code expira em poucos segundos: trocar a imagem a cada QR novo que chegar pelo tempo real (evento `QRCODE_UPDATED`, 4.3) ou, na falta, pedir outro a cada 30 s enquanto o painel estiver aberto.",
              "Quando o Canal chegar `conectada` pelo tempo real da Sessão 3, mostrar “Conectado” e fechar o painel.",
              "Na página de conectar, depois de criar o Canal, abrir a ficha já com o painel do QR code.",
              "Trocar o texto do quadro reservado em `conectar-canal.ts` por “Depois de criar o Canal, o QR code aparece aqui.”"
            ],
            "pronto": "Criar um Canal não oficial e ler o QR code com o celular põe o Canal em “conectada” na tela, sem recarregar."
          }
        ]
      },
      {
        "id": "4.3",
        "n": "Estado da conexão",
        "objetivo": "O Canal mostra o estado real do número. Hoje o estado só muda pelos botões da ficha: se o celular desliga, a tela continua dizendo “conectada” e as mensagens somem sem aviso.",
        "pronto": "Desligar a internet do celular muda o Canal para “com erro”; remover o aparelho no celular muda para “desconectada”.",
        "subs": [
          {
            "n": "Tratar os eventos de conexão da Evolution",
            "cam": [
              "api"
            ],
            "hoje": "Nenhum evento de fora chega ao Canal.",
            "fazer": [
              "No tratador da Evolution na rota de webhook da Sessão 3, tratar `CONNECTION_UPDATE`: estado `open` gera `conexao_confirmada`; `close` com o motivo de sessão encerrada (o aparelho foi removido no celular) gera `desconectar`; `close` por outro motivo gera `conexao_perdida`; `connecting` não muda nada.",
              "Na confirmação, ler o número conectado (vem no evento ou em `GET /instance/fetchInstances`) e passar por `conferirNumeroConectado`. Se for outro número: sair da sessão (`sairDaSessao`), pôr o Canal em `com_erro` e mostrar “Este QR code foi lido por outro número.”",
              "Gravar pela `definirConexao` de `apps/api/src/repositorios/crm/canais.ts:209`, avançar a revisão do Espaço e avisar a tela pelo tempo real.",
              "Tratar `QRCODE_UPDATED` repassando o QR novo à tela pelo tempo real."
            ],
            "pronto": "Teste em `apps/api` com eventos `CONNECTION_UPDATE` de exemplo: `open` deixa o Canal `conectada` com `conexao_simulada = false`; `close` por queda deixa `com_erro`; número diferente deixa `com_erro`."
          },
          {
            "n": "Conferir a conexão de tempos em tempos",
            "cam": [
              "api"
            ],
            "hoje": "Não existe. Um webhook perdido deixaria o estado errado para sempre.",
            "fazer": [
              "Rotina no `apps/api`, no mesmo molde de `apps/api/src/automacoes/scheduler-worker.ts`, que a cada 5 min chama `estadoDaConexao` para cada Canal `whatsapp-nao-oficial` ativo e corrige o banco quando diverge.",
              "Ligada pela variável `EVOLUTION_CONFERENCIA_ATIVA`, desligada no ambiente local, e iniciada em `apps/api/src/index.ts` como os outros workers."
            ],
            "pronto": "Com o celular desligado, mudar à mão `conexao` para `conectada` no banco: em até 5 min ela volta para `com_erro`."
          },
          {
            "n": "Desconectar e arquivar de verdade",
            "cam": [
              "api"
            ],
            "hoje": "`desconectar` e `arquivar` (`apps/api/src/servicos/crm/canais.ts:257` e `:259`) só mudam o banco; o celular continua conectado à Evolution.",
            "fazer": [
              "`desconectar` chama `sairDaSessao` antes de gravar `desconectada`.",
              "`arquivar` chama `sairDaSessao` e `apagarInstancia` e apaga a credencial do Canal no cofre.",
              "Se a Evolution falhar, nada é gravado e a rota devolve “Não foi possível falar com o WhatsApp. Tente de novo.”"
            ],
            "pronto": "Desconectar pela ficha faz o aparelho sumir de “Aparelhos conectados” no celular."
          },
          {
            "n": "Tirar “Simular conexão” da produção",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "A rota `POST /canais/:id/simular-conexao`, o serviço `simularConexao`, o botão da ficha e a marca `MarcaDeConexaoSimulada` (`apps/web/src/features/crm/selo-do-provedor.tsx`) valem para todo mundo.",
            "fazer": [
              "Registrar a rota só quando a variável `PERMITIR_CONEXAO_SIMULADA=true` (homologação e testes; nunca em produção).",
              "O botão da ficha só aparece quando a api diz que a simulação está ligada (um campo novo na resposta de `GET /estado`).",
              "Os testes que simulam conexão ligam a variável: `apps/api/src/e2e/canais-fluxo.test.ts`, `apps/api/src/rotas/crm/canais.test.ts`, `apps/api/src/servicos/crm/canais.test.ts` e `apps/web/src/features/crm/ficha-do-canal.test.tsx`.",
              "A coluna `conexao_simulada` fica: ela marca os Canais simulados que já existem."
            ],
            "pronto": "Em produção, `POST /canais/:id/simular-conexao` devolve 404 e o botão não aparece; `npm run check` passa."
          }
        ]
      },
      {
        "id": "4.4",
        "n": "Mensagens",
        "objetivo": "Receber e responder pela Caixa de Entrada. Hoje a Sessão 3 deixa pronta a porta de entrada e de saída, mas nada entende o formato da Evolution, nem tiques, reações ou mensagens apagadas.",
        "pronto": "Uma mensagem mandada do celular aparece na Caixa de Entrada; a resposta chega no celular; os tiques e as reações aparecem na tela.",
        "subs": [
          {
            "n": "Proteger o webhook da Evolution",
            "cam": [
              "api"
            ],
            "hoje": "A rota de webhook da Sessão 3 confere a origem por provedor. A Evolution não assina o webhook como a Meta assina.",
            "fazer": [
              "Ao configurar o webhook da instância (`configurarWebhook`), usar um endereço com um segredo aleatório por Canal, guardado no cofre: `/webhooks/evolution/<canalId>/<segredo>`, dentro da rota da Sessão 3.",
              "A rota confere o segredo em tempo constante e confere que o campo `instance` do corpo é a instância daquele Canal. Senão, 401 sem processar.",
              "Assinar só os eventos usados: `QRCODE_UPDATED`, `CONNECTION_UPDATE`, `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e `MESSAGES_DELETE`. Os de grupo entram na Sessão 6."
            ],
            "pronto": "Teste: uma chamada com segredo errado, ou com a instância de outro Canal, recebe 401 e não grava nada na fila de entrada."
          },
          {
            "n": "Traduzir a mensagem recebida da Evolution",
            "cam": [
              "api"
            ],
            "hoje": "O recebimento completo (achar ou criar Contato e Conversa) vem da Sessão 3; ele recebe `MensagemRecebidaDoProvedor` (`packages/dominio/src/crm/mensagens.ts:110`) e nada traduz o formato da Evolution para ela.",
            "fazer": [
              "Criar `apps/api/src/provedores/evolution/traduzir.ts`, que transforma o evento `MESSAGES_UPSERT` na entrada do recebimento.",
              "Mapear: `key.id` para `idExterno`; `key.remoteJid` para o número do Contato; `pushName` para o nome sugerido do Contato novo; `messageTimestamp` para `criadoEm`; o texto de `message.conversation` ou `message.extendedTextMessage.text` para `conteudo`; imagem, vídeo, áudio, documento e figurinha para anexo, baixado por `baixarMidia` e guardado pela mídia da Sessão 3; a mensagem citada (`contextInfo.stanzaId`) para `emRespostaAId`, quando a citada existir aqui.",
              "`key.fromMe` verdadeiro (digitada no próprio celular): gravar como `enviada`, ator `integration` (o Canal), status `enviada`. Se o `key.id` já existe porque a plataforma enviou, o índice `mensagens_id_externo_uq` (008, linha 194) descarta a repetida.",
              "Guardar o evento inteiro em `carga_bruta`.",
              "Ignorar por enquanto as mensagens de grupo (`remoteJid` terminado em `@g.us`) e de status (`status@broadcast`): grupos são da Sessão 6."
            ],
            "pronto": "Testes em `apps/api/src/provedores/evolution/traduzir.test.ts` com eventos reais gravados: texto, imagem, áudio, resposta citada, `fromMe` e mensagem de grupo ignorada.",
            "nota": "Para ter eventos reais: apontar o webhook da instância de teste para um endereço de captura e salvar os corpos em `apps/api/src/provedores/evolution/exemplos/`, sem dados de clientes. Conferir se a versão instalada entrega o remetente como `@lid` (identificador oculto do WhatsApp, sem número) em vez do número; se entregar, tratar antes de ligar em produção."
          },
          {
            "n": "Juntar o número com e sem o nono dígito",
            "cam": [
              "dom"
            ],
            "hoje": "`normalizarWhatsapp` (`packages/dominio/src/crm/normalizacao.ts:72`) só repassa para `normalizarTelefone` (`:57`), que aceita +55 com 12 ou 13 dígitos sem juntar os dois. O WhatsApp entrega muitos celulares antigos sem o nono dígito (`551187654321`), e o mesmo Contato pode estar cadastrado com ele (`+5511987654321`): viraria um Contato repetido.",
            "fazer": [
              "Nova função `variantesDoNumeroBrasileiro(numero)` em `normalizacao.ts`: para +55 com DDD e celular, devolve as duas formas, com e sem o 9.",
              "O recebimento da Sessão 3 procura o Contato pelas duas formas antes de criar um novo. Contato novo grava a forma com o 9 como `valor` do identificador `whatsapp`.",
              "O envio usa o número como o WhatsApp o conhece: o `remoteJid` da última mensagem recebida na Conversa."
            ],
            "pronto": "Teste: uma mensagem de `551187654321@s.whatsapp.net` cai no Contato cadastrado com `+5511987654321`, sem criar outro."
          },
          {
            "n": "Enviar texto e mídia pela Evolution",
            "cam": [
              "api"
            ],
            "hoje": "A porta de saída da Sessão 3 entrega a um provedor de teste; não há provedor Evolution.",
            "fazer": [
              "Implementar `enviar` da interface de provedor em `apps/api/src/provedores/evolution/`: texto por `enviarTexto`; imagem, vídeo e documento por `enviarMidia`, com a URL assinada do arquivo; áudio por `enviarAudio` (chega como mensagem de voz).",
              "Resposta citada: mandar o `idExterno` da Mensagem respondida no campo de citação.",
              "Na volta, gravar o `key.id` devolvido em `id_externo` da Mensagem `enviada`: é ele que liga os tiques depois.",
              "Canal fora de `conectada`: não tentar. A Mensagem fica `pendente` (regra B69) e a outbox tenta de novo quando o Canal voltar."
            ],
            "pronto": "Pela Caixa de Entrada, um texto, uma imagem e um áudio chegam ao celular, e no banco as três Mensagens têm `id_externo` preenchido."
          },
          {
            "n": "Gravar tiques, reações, edições e mensagens apagadas",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "As colunas `status_entrega`, `status_entrega_em`, `reacoes`, `marcacao_exclusao` e `edicoes_externas` existem em `plataforma.mensagens` (008, linhas 153-159), mas o repositório (`apps/api/src/repositorios/crm/mensagens.ts`) só insere e lê, e o tipo `Mensagem` as declara como `unknown` (`packages/dominio/src/crm/mensagens.ts:96-99`).",
            "fazer": [
              "No domínio: tipar `Reacao` (`autor`, `emoji`, `em`), `MarcacaoDeExclusao` (`porQuem`, `em`) e `EdicaoExterna` (`conteudoAnterior`, `em`), e criar `proximoStatusDeEntrega(atual, novo)`, que só avança (`enviada`, depois `entregue`, depois `lida`); `falhou` é final.",
              "No repositório: `atualizarStatusDeEntrega`, `registrarReacao`, `marcarExclusao` e `registrarEdicaoExterna`, achando a Mensagem por (`canal_id`, `id_externo`).",
              "No tratador da Evolution: `MESSAGES_UPDATE` vira status (`DELIVERY_ACK` = entregue; `READ` e `PLAYED` = lida; `ERROR` = falhou); a reação (`reactionMessage` dentro de `MESSAGES_UPSERT`) vira reação na Mensagem citada, nunca uma Mensagem nova; `MESSAGES_DELETE` vira marcação de exclusão (o conteúdo fica guardado); a edição (`editedMessage`) vira edição externa.",
              "No fio da Conversa (`apps/web/src/features/crm/conversation-thread.tsx`): mostrar os tiques, as reações embaixo da Mensagem e “mensagem apagada”."
            ],
            "pronto": "Ler no celular uma mensagem enviada pela plataforma vira tique de lida na tela, e reagir a ela no celular mostra a reação embaixo dela; um teste em `apps/api` cobre os quatro eventos."
          }
        ]
      },
      {
        "id": "4.5",
        "n": "Vários números",
        "objetivo": "Dois ou mais números ao mesmo tempo, cada um com as suas Conversas. Hoje isso só foi testado com Canais simulados, e os avisos do Financeiro seguem por uma Evolution de fora.",
        "pronto": "Dois números conectados em homologação, sem misturar Conversas, e a decisão dos avisos do Financeiro tomada.",
        "subs": [
          {
            "n": "Testar com dois números reais",
            "cam": [
              "voce"
            ],
            "hoje": "Testado só com Canais simulados (`apps/api/src/e2e/canais-fluxo.test.ts`).",
            "fazer": [
              "Conectar em homologação os dois números da lista de 4.1.",
              "Do mesmo celular, mandar mensagem para os dois números e responder pelos dois na Caixa de Entrada.",
              "Conferir que o mesmo Contato tem uma Conversa por Canal e que cada resposta sai pelo número da Conversa."
            ],
            "pronto": "A consulta `select canal_id, count(*) from plataforma.conversas where contato_id = '<id do Contato>' group by canal_id` devolve duas linhas, e cada resposta chegou pelo número certo."
          },
          {
            "n": "Os avisos do Financeiro passam a sair por um Canal daqui?",
            "cam": [
              "dec",
              "api"
            ],
            "decisao": true,
            "hoje": "As Automações do Financeiro gravam o evento `automacao.notificar-canal.v1` (`apps/api/src/persistencia/eventos-de-canal.ts`). O worker da outbox o entrega ao `automation/`, que busca o número na Tarefa e envia pela instância `numeropvmarcos` (`sendText` e `sendListMessage`). Os textos dos avisos (`gasto-novo` e `relatorio`) moram no `automation/`. A mesma instância recebe os extratos que chegam por WhatsApp (`/webhook/receber-whatsapp-doc/:origem`).",
            "opcoes": [
              "(A) Sim: o worker monta a Mensagem e envia pela porta de saída, por um Canal conectado aqui",
              "(B) Não: continuam pelo `automation/` como estão"
            ],
            "muda": "(A) tira a dependência do `automation/` para avisar, mas exige trazer os textos `gasto-novo` e `relatorio` para o domínio, escolher qual Canal envia e abrir a Conversa com o solicitante na Caixa de Entrada: cerca de 1 dia. E o número `numeropvmarcos` não pode virar Canal aqui sem antes tirar do `automation/` a recepção de extratos, porque cada instância da Evolution tem um endereço de webhook configurado. (B) não muda nada.",
            "recomendo": "(B) nesta sessão. (A) numa sessão do Financeiro, depois de duas semanas com os números estáveis, usando um número novo e não o `numeropvmarcos`.",
            "peso": "arrumacao"
          }
        ]
      }
    ],
    "ajuste": "+1 dia: provisionar a instância é rápido, mas a sessão também liga o QR code na tela, o webhook, o envio de texto e mídia, os tiques de entrega e o número com e sem o nono dígito."
  },
  {
    "id": "6",
    "n": "Ferramentas: Grupos e Comunidades",
    "dias": [
      3,
      5
    ],
    "dep": [
      "4"
    ],
    "nota": "Os Flows foram para a Sessão 7: são recurso da API oficial da Meta, e a Evolution não os suporta.",
    "desc": "Grupos e Comunidades de WhatsApp deixam de ser simulados e passam a ser os grupos reais dos números conectados pela Evolution na Sessão 4. Hoje o domínio e as telas estão prontos, mas o “provedor” é uma lista fixa em código, e toda operação grava direto em `plataforma.registros` sem falar com ninguém. Esta sessão separa a regra (domínio) da chamada ao WhatsApp (api), cria rotas próprias para os gestos que mexem no WhatsApp e põe um seletor de número no topo da seção.",
    "partida": [
      "Domínio pronto: 23 operações de Grupo (`packages/dominio/src/operations/ferramentas/grupos.ts`), 13 de Comunidade (`comunidades.ts`), captação (`captacao.ts`), participações (`participacoes.ts`) e notas; tipos em `packages/dominio/src/types/ferramentas.ts`.",
      "O provedor é simulado e mora dentro das operações: `GRUPOS_NO_PROVEDOR`, `gerarJid` e `gerarEnderecoDeConvite` (`provedor-simulado.ts`) são chamados em `grupos.ts:156`, `:165`, `:298`, `:382` e `:528` e em `comunidades.ts:70` e `:89`.",
      "Toda operação roda pelo `run()` da tela e por `POST /operacoes/:nome`, gravando em `plataforma.registros`.",
      "As capacidades são por tipo de Canal, não por provedor: `CAPACIDADES_DE_ATIVOS.whatsapp` (`capacidades.ts:36`) dá grupos e Flows a qualquer WhatsApp, oficial ou não.",
      "Telas prontas em `apps/web/src/app/(shell)/ferramentas/` e `apps/web/src/features/ferramentas/`, com um filtro `?canal=` em cada aba e um seletor de Canal em cada diálogo.",
      "Três botões de simulação (“Simular pedido”, “Simular clique” e “Simular entrada”) que só mudam a tela, porque as funções estão fora do registro de operações.",
      "Não existe página pública para o Link de captação: clicar nele hoje não leva a lugar nenhum.",
      "Da Sessão 4: o cliente da Evolution, o webhook protegido por Canal e os números conectados."
    ],
    "pronto": "Ao escolher um número no topo de Ferramentas, aparecem os Grupos reais dele; criar um Grupo, mudar o nome e adicionar ou remover participante pela tela muda o grupo no WhatsApp; um grupo criado no celular aparece na tela em segundos; o Link de captação leva ao convite do grupo; nenhum botão “Simular” nem código de regra aparece na tela.",
    "tarefas": [
      {
        "id": "6.1",
        "n": "Levantar o que a Evolution faz com grupos",
        "objetivo": "Saber o que dá para ligar antes de ligar. O domínio prevê Comunidades, Pedidos de Entrada e aprovação de entrada, e ninguém conferiu se a Evolution faz isso.",
        "pronto": "Existe a tabela operação do domínio → chamada da Evolution, e a decisão sobre o que falta está tomada.",
        "subs": [
          {
            "n": "Montar a tabela operação → chamada da Evolution",
            "cam": [
              "api"
            ],
            "hoje": "O plano supunha que a Evolution faz tudo o que o domínio prevê.",
            "fazer": [
              "Na documentação da versão instalada, achar a chamada de cada gesto: criar grupo (`POST /group/create`), listar grupos com participantes (`GET /group/fetchAllGroups`), participantes (`GET /group/participants`), adicionar, remover, promover e rebaixar (`POST /group/updateParticipant` com `add`, `remove`, `promote` e `demote`), nome (`POST /group/updateGroupSubject`), descrição (`POST /group/updateGroupDescription`), foto (`POST /group/updateGroupPicture`), configurações (`POST /group/updateSetting` com `announcement` ou `not_announcement` e `locked` ou `unlocked`), link de convite (`GET /group/inviteCode` e `POST /group/revokeInviteCode`) e sair (`DELETE /group/leaveGroup`).",
              "Marcar o que não tiver chamada: criar Comunidade, vincular Grupo a Comunidade, Grupo de avisos, listar, aprovar e recusar Pedido de Entrada, e a configuração “administradores aprovam entrada” (`administradoresAprovamEntrada`).",
              "Testar cada chamada uma vez contra um número de homologação e anotar o formato da resposta."
            ],
            "pronto": "A tabela está anexada a esta tarefa, com “existe”, “não existe” ou “existe com diferença” para cada operação exportada de `grupos.ts` e `comunidades.ts`.",
            "nota": "Os caminhos acima são os da Evolution API v2. A tarefa existe justamente para não supor."
          },
          {
            "n": "O que fazer com o que a Evolution não faz?",
            "cam": [
              "dec",
              "web"
            ],
            "decisao": true,
            "hoje": "O domínio tem 13 operações de Comunidade e o fluxo de Pedido de Entrada (`receberPedidoDeEntrada`, `aprovarPedidoDeEntrada` e `recusarPedidoDeEntrada`, `grupos.ts:704-760`), e as telas os mostram.",
            "opcoes": [
              "(A) Esconder na tela o que não existe no provedor e deixar o domínio parado até haver suporte",
              "(B) Deixar visível como “só na plataforma”, sem efeito no WhatsApp",
              "(C) Implementar direto na biblioteca que a Evolution usa por baixo (Baileys), fora da API dela"
            ],
            "muda": "(A) é o mais honesto e só custa esconder. (B) engana: a pessoa aprova um pedido que não existe no WhatsApp. (C) exige manter uma versão própria da Evolution: vários dias, e quebra a cada versão nova.",
            "recomendo": "(A), revendo a cada versão nova da Evolution.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "6.2",
        "n": "Capacidades por provedor",
        "objetivo": "Cada número só oferece o que o provedor dele faz. Hoje as capacidades de Ferramentas são do tipo `whatsapp`, então um número oficial aceita criar Grupo e um não oficial aceita Flow.",
        "pronto": "Criar Grupo num número oficial e publicar Flow num número não oficial são recusados pelo domínio.",
        "subs": [
          {
            "n": "Fazer as capacidades de Ferramentas dependerem do provedor",
            "cam": [
              "dom"
            ],
            "hoje": "`CAPACIDADES_DE_ATIVOS` (`packages/dominio/src/operations/ferramentas/capacidades.ts:35`) é indexado por `ChannelType`, e `recusaDoCanal` (`permissoes.ts:42-53`) lê `CAPACIDADES_DE_ATIVOS[canal.channelType]`. Há 9 leituras desse objeto no domínio e na tela.",
            "fazer": [
              "Criar `capacidadesDeAtivosDoCanal(canal)` em `capacidades.ts`, no mesmo molde de `capacidadesDoCanal` (`operations/conversations.ts:115`): parte do tipo e sobrepõe por provedor.",
              "`whatsapp-nao-oficial`: grupos sim; Comunidades e Pedidos de Entrada conforme a decisão de 6.1; Flows não.",
              "`whatsapp-cloud`: Flows sim; Grupos e Comunidades não.",
              "Trocar as 9 leituras de `CAPACIDADES_DE_ATIVOS[...]` pela função nova, e a frase de `recusaDoCanal` para “Este número não administra grupos.” (e equivalentes)."
            ],
            "pronto": "Testes no domínio: `criarGrupo` com um Canal `whatsapp-cloud` recusa com “Este número não administra grupos.”; `publicarVersao` de um Flow com Canal `whatsapp-nao-oficial` recusa."
          }
        ]
      },
      {
        "id": "6.3",
        "n": "Tirar o provedor de dentro das operações",
        "objetivo": "As operações passam a receber o que o WhatsApp respondeu, em vez de inventar. Hoje elas geram o identificador do grupo e o link de convite no meio da regra, e o domínio não pode chamar o WhatsApp porque não faz entrada e saída.",
        "pronto": "Nenhuma operação de `packages/dominio/src/operations/ferramentas/` importa `provedor-simulado.ts` fora dos testes e do seed.",
        "subs": [
          {
            "n": "Separar a conferência do efeito em cada operação externa",
            "cam": [
              "dom"
            ],
            "hoje": "`criarGrupo` gera o identificador com `gerarJid` e o link com `gerarEnderecoDeConvite` (`grupos.ts:156` e `:165`); `importarGruposDoCanal` lê `GRUPOS_NO_PROVEDOR` (`:298`); `sincronizarGrupo` inventa um link (`:382`); `regenerarLinkDeConvite` também (`:528`); `criarComunidade` gera dois identificadores (`comunidades.ts:70` e `:89`).",
            "fazer": [
              "Para cada operação com efeito no WhatsApp, criar uma função pura `conferir<Operacao>(state, membroId, entrada)` que só valida e devolve o que pedir ao provedor. A operação atual passa a receber na entrada um campo `doProvedor` com o que o WhatsApp respondeu (identificador do grupo, link, lista de grupos, participantes).",
              "Operações: `criarGrupo`, `importarGruposDoCanal`, `sincronizarGrupo`, `editarGrupo`, `adicionarParticipantes`, `removerParticipante`, `promoverParticipante`, `rebaixarParticipante`, `regenerarLinkDeConvite`, `enviarLinkDeConvite`, `sairDoGrupo` e `enviarMensagemAoGrupo`, mais as de Comunidade que a decisão de 6.1 mantiver.",
              "Os eventos que já vêm de fora ficam como estão: `registrarEntradaNoGrupo` (`grupos.ts:795`), `registrarSaidaDoGrupo` (`:825`) e `receberPedidoDeEntrada` (`:704`).",
              "`provedor-simulado.ts` fica só para os testes e o seed (`seed-ferramentas.ts`)."
            ],
            "pronto": "Os testes do domínio passam com o `doProvedor` montado à mão, e um teste novo prova que `criarGrupo` grava o identificador que veio em `doProvedor`."
          }
        ]
      },
      {
        "id": "6.4",
        "n": "Rotas de Ferramentas que falam com o WhatsApp",
        "objetivo": "Os gestos que mexem no WhatsApp passam por rotas próprias no `apps/api`. Hoje tudo vai por `POST /operacoes/:nome`, que aplica a operação sem efeito externo, e a tela aplica antes de o servidor confirmar.",
        "pronto": "Criar um Grupo pela tela faz o grupo aparecer no celular do número escolhido, e `POST /operacoes/criarGrupo` não existe mais.",
        "subs": [
          {
            "n": "Criar as rotas e o serviço de Grupos",
            "cam": [
              "api",
              "dom"
            ],
            "hoje": "Não há rota de Ferramentas: tudo passa por `POST /operacoes/:nome` (`apps/api/src/rotas/operacoes.ts`).",
            "fazer": [
              "Criar `apps/api/src/rotas/ferramentas.ts`, registrada em `apps/api/src/app.ts`, e o serviço `apps/api/src/servicos/ferramentas/grupos.ts`.",
              "Cada rota: (1) roda `conferir<Operacao>` sobre o estado; (2) chama a Evolution pelo cliente da Sessão 4, com a credencial do Canal tirada do cofre; (3) roda a operação com `doProvedor` dentro de `executar` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`).",
              "Rotas: `POST /ferramentas/grupos`, `POST /ferramentas/canais/:canalId/importar-grupos`, `POST /ferramentas/grupos/:id/sincronizar`, `PATCH /ferramentas/grupos/:id`, `POST /ferramentas/grupos/:id/participantes`, `DELETE /ferramentas/grupos/:id/participantes/:participacaoId`, `POST /ferramentas/grupos/:id/participantes/:participacaoId/promover` e `.../rebaixar`, `POST /ferramentas/grupos/:id/link/regenerar`, `POST /ferramentas/grupos/:id/convites`, `POST /ferramentas/grupos/:id/sair` e `POST /ferramentas/grupos/:id/mensagens`.",
              "Se a Evolution aceitou e a gravação falhou, registrar no log e marcar o Grupo para sincronizar: o WhatsApp não desfaz criar grupo.",
              "Tirar essas operações de `OPERACOES` em `packages/dominio/src/operations/registro.ts` (bloco de `ferramentas/grupos.ts`, linhas 237-261), para ninguém criar um Grupo sem passar pelo WhatsApp. Ficam lá as que não saem da plataforma: captação, notas, arquivar, restaurar e lixeira."
            ],
            "pronto": "Teste em `apps/api` com `criarServidorFalso` no lugar da Evolution: `POST /ferramentas/grupos` chama `/group/create` e grava o Grupo com o identificador devolvido; `POST /operacoes/criarGrupo` responde 404."
          },
          {
            "n": "Fazer as telas chamarem as rotas novas",
            "cam": [
              "web"
            ],
            "hoje": "Os diálogos e popups chamam as operações pelo `run()` (`apps/web/src/dados/store.ts:373`), que aplica na tela na hora e depois manda para `POST /operacoes`.",
            "fazer": [
              "Criar `apps/web/src/dados/ferramentas.ts`, no molde de `apps/web/src/dados/crm/canais.ts`: uma função por rota, e `rehidratar()` depois do sucesso.",
              "Trocar o `run(...)` por essas funções em `criar-grupo-dialog.tsx`, `importar-grupos-dialog.tsx`, `grupo-popup.tsx`, `participacoes.tsx`, `conversa-do-grupo.tsx` e no menu de sincronizar de `tela-de-ferramentas.tsx` (que hoje chama `sincronizarGrupo` e `sincronizarComunidade` direto).",
              "Enquanto a chamada roda, o botão fica ocupado com “Enviando ao WhatsApp…”; na recusa, mostra a frase da api."
            ],
            "pronto": "Criar um Grupo pela tela faz o grupo aparecer no celular do número escolhido, e a tela só mostra o Grupo depois que a api confirma."
          }
        ]
      },
      {
        "id": "6.5",
        "n": "Seletor de número",
        "objetivo": "Escolher o número uma vez, no topo, e tudo vir dele. Hoje cada aba tem o seu filtro de Canal e cada diálogo pergunta o Canal de novo, misturando números oficiais e não oficiais.",
        "pronto": "Trocar o número no topo troca os Grupos e Comunidades mostrados, e nenhum diálogo pergunta o número.",
        "subs": [
          {
            "n": "Pôr o seletor no topo de Ferramentas",
            "cam": [
              "web"
            ],
            "hoje": "Cada aba tem o seu filtro `?canal=` (`aba-grupos.tsx:44`, `aba-comunidades.tsx:25`, `aba-flows.tsx:25`), com todo Canal `whatsapp` ativo, de qualquer provedor (`aba-grupos.tsx:42`).",
            "fazer": [
              "Em `tela-de-ferramentas.tsx`, um `Select` no `PageHeader` com os Canais da aba: Grupos e Comunidades listam os `whatsapp-nao-oficial` conectados; Flows lista os `whatsapp-cloud` (Sessão 7).",
              "O número escolhido fica em `?canal=` (para sobreviver ao F5, como pede `url.ts`) e a última escolha fica no `localStorage`, com leitura e escrita dentro de try/catch.",
              "Tirar os filtros de Canal das três abas: elas leem o `?canal=` do topo.",
              "Sem número conectado: estado vazio com o link para conectar um (`/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-nao-oficial`)."
            ],
            "pronto": "Trocar o número no topo troca a lista de Grupos; recarregar a página mantém o número escolhido."
          },
          {
            "n": "Tirar os seletores de Canal dos diálogos",
            "cam": [
              "web"
            ],
            "hoje": "`criar-grupo-dialog.tsx:203` (“Canal administrador”), `importar-grupos-dialog.tsx:54`, `criar-comunidade-dialog.tsx:60` e `criar-flow-dialog.tsx:59` (“Canal publicador”) pedem o Canal de novo.",
            "fazer": [
              "Os quatro diálogos recebem o Canal do topo e mostram só o nome dele, sem campo.",
              "`definirCanalDoGrupo` (`grupos.ts:453`) continua no popup do Grupo, para trocar o número administrador."
            ],
            "pronto": "Nenhum diálogo de criar ou importar tem campo de Canal, e o Grupo criado fica no número do topo."
          }
        ]
      },
      {
        "id": "6.6",
        "n": "Sincronização",
        "objetivo": "O que está no WhatsApp aparece aqui e continua atualizado. Hoje importar lê uma lista fixa e nada muda sozinho.",
        "pronto": "Um grupo criado no celular do número conectado aparece em Ferramentas em até 10 s, sem clicar em importar.",
        "subs": [
          {
            "n": "Receber os eventos de grupo da Evolution",
            "cam": [
              "api"
            ],
            "hoje": "A Sessão 4 ignora tudo o que vem de `@g.us`.",
            "fazer": [
              "Assinar no webhook da instância os eventos `GROUPS_UPSERT`, `GROUP_UPDATE` e `GROUP_PARTICIPANTS_UPDATE`.",
              "`GROUPS_UPSERT` (o número entrou num grupo, ou alguém criou um no celular): `importarGruposDoCanal` só daquele grupo.",
              "`GROUP_UPDATE`: nome, descrição e configurações pela `sincronizarGrupo` com `doProvedor`.",
              "`GROUP_PARTICIPANTS_UPDATE`: `add` chama `registrarEntradaNoGrupo`; `remove` chama `registrarSaidaDoGrupo`; `promote` e `demote` mudam o papel da participação.",
              "Tudo pela fila de entrada da Sessão 3, como as mensagens."
            ],
            "pronto": "Teste em `apps/api` com os três eventos de exemplo; e, com o celular, criar um grupo faz ele aparecer na tela em até 10 s."
          },
          {
            "n": "Importar tudo ao conectar e conferir uma vez por dia",
            "cam": [
              "api"
            ],
            "hoje": "Importar é um botão (`importar-grupos-dialog.tsx`) que lê `GRUPOS_NO_PROVEDOR`.",
            "fazer": [
              "Quando um Canal `whatsapp-nao-oficial` conecta (4.3), importar os grupos dele por `GET /group/fetchAllGroups` com participantes, respeitando `LIMITE_DE_GRUPOS_POR_ESPACO` (200, `capacidades.ts:53`).",
              "Uma rotina diária confere cada Grupo e corrige o que divergiu, porque um webhook pode se perder."
            ],
            "pronto": "Conectar um número que já está em 5 grupos faz os 5 aparecerem sem nenhum clique."
          },
          {
            "n": "Criar o endereço público do Link de captação",
            "cam": [
              "api"
            ],
            "hoje": "Não existe página pública para o Link de captação: `apps/web/src/app/(publico)/` só tem `f/[segredo]` e `p/[segredo]`. `registrarClique` (`captacao.ts:165`) só roda pelo botão “Simular clique”.",
            "fazer": [
              "Rota pública `GET /captacao/:slug` no `apps/api`, sem login, com o limite de taxa das rotas públicas (Sessão 1): roda `registrarClique` dentro de `executar` e responde 302 para o link de convite do Grupo escolhido.",
              "Quem clicou e entrou é casado depois pelo `GROUP_PARTICIPANTS_UPDATE` do item acima, e não por `simularEntradaPorClique`."
            ],
            "pronto": "Abrir o endereço do link num celular leva ao convite do grupo no WhatsApp, e o contador de cliques do link sobe."
          },
          {
            "n": "Tabelas próprias para Grupos e Comunidades?",
            "cam": [
              "dec",
              "banco",
              "api"
            ],
            "decisao": true,
            "hoje": "Grupos, Comunidades, Links de captação e Flows estão em `plataforma.registros` e vão inteiros em todo `GET /estado` e em cada `executar`.",
            "opcoes": [
              "(A) Tabelas próprias numa migração nova, com rotas REST, como o CRM na 007",
              "(B) Continuam em `plataforma.registros`"
            ],
            "muda": "(A) soma de 2 a 3 dias (tabelas, repositório, rotas de leitura e trocar as telas de `state.grupos` para HTTP), mas Grupos com centenas de participações deixam de pesar no carregamento de toda tela. (B) não custa nada agora, mas cada Grupo importado engorda o estado que todo usuário baixa.",
            "recomendo": "(B) nesta sessão, medindo o tamanho do `GET /estado` depois de importar os grupos reais; (A) numa sessão própria se passar de 1 MB.",
            "peso": "arrumacao"
          },
          {
            "n": "Como guardar a Conversa de um Grupo nas tabelas novas?",
            "cam": [
              "dec",
              "banco"
            ],
            "decisao": true,
            "hoje": "A Conversa de grupo é do modelo antigo: `conversaDoGrupoOuCriar` (`grupos.ts:844`) cria uma `Conversation` com `groupIdentifier` em `state.conversations`. A tabela nova `plataforma.conversas` exige `contato_id` (008, linha 78) e não tem campo de grupo, e a Sessão 3 tira o modelo antigo.",
            "opcoes": [
              "(A) Migração nova: `contato_id` passa a aceitar vazio e entra `grupo_id`, com a regra de que um dos dois existe",
              "(B) Tabela própria para as mensagens de grupo",
              "(C) Não guardar mensagens de grupo: Ferramentas só administra o grupo, e enviar ao grupo é só saída"
            ],
            "muda": "(A) reaproveita o fio, o tempo real e a mídia da Caixa de Entrada (cerca de 1 dia), mas mexe no índice `conversas_nao_resolvida_uq`. (B) duplica o fio. (C) é o mais rápido, mas `enviarMensagemAoGrupo` e a aba de conversa do Grupo (`conversa-do-grupo.tsx`) perdem o histórico.",
            "recomendo": "(A). Se a 3.1.3 ficar em (B), as Conversas de Grupo continuam no modelo antigo até esta sessão, e é aqui que elas passam para as tabelas novas.",
            "peso": "produto"
          },
          {
            "n": "Levar a Conversa de Grupo para as tabelas novas e apagar o resto do modelo antigo de Grupos",
            "cam": [
              "dom",
              "api",
              "banco"
            ],
            "hoje": "`conversaDoGrupoOuCriar` (`packages/dominio/src/operations/ferramentas/grupos.ts:844`) cria uma `Conversation` antiga em `state.conversations`, e `conversaDoGrupo` (`packages/dominio/src/derive-ferramentas.ts:145`) a procura lá.",
            "fazer": [
              "Aplicar a forma escolhida na decisão anterior (migração nova).",
              "Trocar `conversaDoGrupoOuCriar` e `conversaDoGrupo` para ler e gravar em `plataforma.conversas`.",
              "Copiar as Conversas de Grupo que já existem em `plataforma.registros` para a tabela nova e apagar as linhas antigas."
            ],
            "pronto": "Uma consulta mostra zero linhas `colecao = 'conversations'` com `groupIdentifier` em `plataforma.registros`, e a aba de conversa do Grupo mostra o histórico vindo da tabela nova."
          }
        ]
      },
      {
        "id": "6.7",
        "n": "Limpeza",
        "objetivo": "Tirar o que só existia para o protótipo. Hoje há botões que fingem ser o WhatsApp e códigos de regra (como `RN-FLW-01`) nos textos que a pessoa lê.",
        "pronto": "Nenhum botão de simular e nenhum código de regra na tela de Ferramentas.",
        "subs": [
          {
            "n": "Tirar os três botões de simulação",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "“Simular pedido” (`apps/web/src/features/ferramentas/pedidos-de-entrada.tsx:44-45`, diálogo em `:120-137`), “Simular clique” (`links-de-captacao.tsx:95`) e “Simular entrada” (`links-de-captacao.tsx:126`) chamam `receberPedidoDeEntrada`, `registrarClique` e `simularEntradaPorClique` pelo `run()`. Essas funções estão fora do registro (`packages/dominio/src/operations/registro.ts:226-233`), então o servidor não as executa: a tela muda e volta no próximo carregamento. (O plano anterior falava em 5 botões; são 3.)",
            "fazer": [
              "Apagar os três botões e o diálogo de pedido simulado.",
              "Apagar `simularEntradaPorClique` (`captacao.ts:188`) do domínio; `registrarClique` fica, usada pela rota pública de 6.6.",
              "Os Pedidos de Entrada passam a vir só do webhook, se a decisão de 6.1 os mantiver.",
              "Atualizar o comentário de `tela-de-ferramentas.tsx:8` (“O provedor é simulado.”)."
            ],
            "pronto": "Nenhuma ocorrência de “Simular” em `apps/web/src/features/ferramentas/` fora dos testes, e os testes de tela que clicavam nesses botões foram apagados ou trocados."
          },
          {
            "n": "Tirar os códigos de regra dos textos",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "Cerca de 60 códigos (como `RN-FLW-01`, `INV-COM-02`, `RN-GRP-08`) aparecem nos textos de `apps/web/src/features/ferramentas/`, e outros cerca de 50 nas frases de recusa de `packages/dominio/src/operations/ferramentas/` (ex.: “… (INV-COM-02).” em `comunidades.ts`), que a tela mostra no aviso.",
            "fazer": [
              "Apagar os códigos e as referências de seção, como “(20.3)”, dos textos visíveis nos dois lugares. Nos comentários do código eles ficam.",
              "Acrescentar um teste em `apps/web` que renderiza as três abas de Ferramentas e os popups e falha se achar o padrão `RN-`, `INV-` ou `DO-` no texto."
            ],
            "pronto": "O teste novo passa, e nenhuma frase de `fail(` em `operations/ferramentas/` contém `(RN-`, `(INV-` ou `(DO-`."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: cerca de 12 rotas novas, telas passando a falar por HTTP, sincronização pelo webhook e a página pública do Link de captação."
  },
  {
    "id": "7",
    "n": "WhatsApp oficial (Cloud API) e Flows",
    "dias": [
      4,
      6
    ],
    "dep": [
      "3",
      "6"
    ],
    "meta": true,
    "desc": "Liga o WhatsApp oficial da Meta (Cloud API): um número da empresa conectado por token, com a janela de 24 h, os modelos de mensagem aprovados pela Meta para falar fora dela e os Flows (formulários interativos dentro do WhatsApp), que só existem na API oficial. Só começa com a empresa verificada na Meta e o número dedicado registrado (7.1).",
    "partida": [
      "O Canal `whatsapp-cloud` já nasce pela página de conectar; o quadro do token é só texto (`apps/web/src/features/crm/conectar-canal.ts:21-32`).",
      "A janela de 24 h já é aplicada no servidor: `validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) recusa fora dela, e o serviço passa `modelosAprovados: []` fixo (`apps/api/src/servicos/crm/mensagens.ts:119`). Fora da janela, nunca sai nada.",
      "O modelo de mensagem só existe como tipo (`MessageTemplate`, `packages/dominio/src/types/crm.ts:368`) e no seed; o Canal da tabela nova chega à tela com `messageTemplates: []` (`apps/api/src/persistencia/canais-projetados.ts:55`).",
      "A Caixa de Entrada já troca o texto livre por um seletor de modelo quando a janela fecha (`apps/web/src/features/crm/conversation-thread.tsx:345-357` e `:1298`), lendo `channel.messageTemplates` do modelo antigo.",
      "Domínio de Flows pronto (`packages/dominio/src/operations/ferramentas/flows.ts`, 27 operações, com versões, telas e componentes) e construtor visual (`apps/web/src/features/ferramentas/flow-builder.tsx`). Publicar, enviar e receber resposta são simulados (`publicarVersao` `:624`, `enviarFlow` `:845`, `receberRespostaDeFlow` `:908`).",
      "Da Sessão 3: interface de provedor, webhook com fila de entrada, porta de saída, mídia e CRM unificado. Da Sessão 4: `POST /canais/:id/conectar` e `proximoStatusDeEntrega`."
    ],
    "pronto": "Um número oficial conectado pela tela conversa pela Caixa de Entrada; fora da janela de 24 h, a resposta só sai escolhendo um modelo aprovado, e chega; um Flow publicado pela tela aparece na conta da Meta, é enviado a um Contato e a resposta dele fica guardada na Conversa.",
    "tarefas": [
      {
        "id": "7.1",
        "n": "Pré-requisitos na Meta",
        "objetivo": "Ter a conta da Meta pronta antes da sessão. Sem empresa verificada, app criado e número registrado, nada desta sessão pode ser testado, e a Meta leva de dias a semanas.",
        "pronto": "Empresa verificada, app ao vivo, número registrado e os cinco dados de 7.1 entregues.",
        "subs": [
          {
            "n": "Verificar a empresa no Meta Business",
            "cam": [
              "voce"
            ],
            "hoje": "Não iniciado.",
            "fazer": [
              "Em business.facebook.com, abrir Configurações do negócio › Central de segurança › Verificação da empresa.",
              "Enviar razão social e CNPJ exatamente como no cartão CNPJ, endereço, telefone e site; confirmar o domínio ou o telefone quando a Meta pedir.",
              "Anotar nesta tarefa o ID do portfólio empresarial."
            ],
            "pronto": "A Central de segurança mostra a empresa como verificada.",
            "nota": "Começar na primeira semana do plano: a Meta pode levar de dias a semanas e às vezes pede documentos de novo."
          },
          {
            "n": "Separar o número dedicado",
            "cam": [
              "voce"
            ],
            "hoje": "Não iniciado.",
            "fazer": [
              "Ter um número que receba SMS ou ligação e que não esteja em uso no aplicativo WhatsApp. Se estiver, apagar a conta do WhatsApp nele antes (não basta desinstalar).",
              "Não usar nenhum dos números da Sessão 4.",
              "Escolher o nome de exibição seguindo as regras da Meta: o nome da empresa ou da marca, como aparece no site."
            ],
            "pronto": "Número e nome de exibição anotados nesta tarefa.",
            "nota": "A Meta tem um modo de coexistência que deixa o mesmo número no aplicativo WhatsApp Business e na API. Conferir se está disponível para a conta antes de apagar a conta do aplicativo."
          },
          {
            "n": "Criar o app, registrar o número e gerar o token",
            "cam": [
              "voce"
            ],
            "hoje": "Não iniciado.",
            "fazer": [
              "Em developers.facebook.com, criar um app do tipo Empresa, ligado ao portfólio verificado, e adicionar o produto WhatsApp.",
              "Em WhatsApp › Configuração da API, adicionar o número dedicado, confirmar pelo código e definir o PIN de duas etapas (guardar o PIN).",
              "No Meta Business, cadastrar uma forma de pagamento na conta do WhatsApp Business: a Meta cobra os modelos de mensagem.",
              "Criar um usuário do sistema administrador, dar a ele o app e a conta do WhatsApp Business, e gerar um token permanente com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.",
              "Publicar uma página de política de privacidade e pôr o app no modo Ao vivo: em modo de desenvolvimento a Meta não manda os webhooks de produção.",
              "Entregar por um canal seguro, nunca por mensagem: ID do app, chave secreta do app, ID da conta do WhatsApp Business (WABA), ID do número (Phone Number ID) e o token. O token vai direto no formulário de conectar (7.2); a chave secreta, no `.env` do `apps/api`."
            ],
            "pronto": "Na Configuração da API do app, o número aparece conectado, e um envio de teste da própria página da Meta chega ao seu celular.",
            "nota": "Para usar o número da própria empresa não é preciso revisão de app. Ela só entra se outras empresas forem conectar números delas pela plataforma (ver a decisão de 7.2)."
          }
        ]
      },
      {
        "id": "7.2",
        "n": "Conexão e mensagens",
        "objetivo": "Receber e enviar pela API oficial. Hoje o Canal oficial só existe no banco, desconectado, e nada fala com a Meta.",
        "pronto": "Um número oficial conectado pela tela conversa pela Caixa de Entrada, com os tiques de entregue e lida.",
        "subs": [
          {
            "n": "Como o número oficial se conecta?",
            "cam": [
              "dec",
              "web",
              "api"
            ],
            "decisao": true,
            "hoje": "A página de conectar diz que o token “será pedido aqui quando a integração existir” (`conectar-canal.ts:26`).",
            "opcoes": [
              "(A) Manual: a pessoa cola o ID do número, o ID da WABA e o token do usuário do sistema num formulário",
              "(B) Cadastro incorporado da Meta (Embedded Signup): um botão abre o login da Meta e devolve tudo sozinho"
            ],
            "muda": "(A) cabe nesta sessão e serve para os números da própria empresa. (B) é o que serve para outras empresas conectarem os números delas, mas exige revisão de app, o app como Provedor de Tecnologia e cerca de 2 dias a mais.",
            "recomendo": "(A) agora; (B) só se a plataforma for usada por outras empresas.",
            "peso": "produto"
          },
          {
            "n": "Criar o cliente da Cloud API",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Criar `apps/api/src/provedores/whatsapp-cloud/cliente.ts`, chamando a Graph API da Meta (`https://graph.facebook.com/<versão>`, com a versão fixa na variável `META_GRAPH_VERSAO`) com o token do Canal tirado do cofre.",
              "Funções: `enviarMensagem` (`POST /{phone-number-id}/messages`, com os tipos `text`, `image`, `audio`, `video`, `document`, `template`, `interactive` e `reaction`), `subirMidia` (`POST /{phone-number-id}/media`), `baixarMidia` (`GET /{media-id}` devolve um endereço temporário, baixado com o mesmo token), `marcarComoLida` (`POST /{phone-number-id}/messages` com `status: read`) e `dadosDoNumero` (`GET /{phone-number-id}`).",
              "Os erros da Graph (`error.code`) viram transitório ou permanente, como pede a interface da Sessão 3; o código 131047 (mensagem fora da janela) vira a mesma recusa de janela de `validarEnvio`."
            ],
            "pronto": "Testes em `apps/api/src/provedores/whatsapp-cloud/cliente.test.ts` contra `criarServidorFalso` cobrem cada função e um token vencido.",
            "nota": "Conferir os nomes dos campos na versão da Graph API escolhida antes de codificar."
          },
          {
            "n": "Conectar pelo token",
            "cam": [
              "api"
            ],
            "hoje": "`POST /canais/:id/conectar` (Sessão 4) só trata o não oficial.",
            "fazer": [
              "Para `whatsapp-cloud`, a rota recebe `phoneNumberId`, `wabaId` e `token`, guarda o token no cofre, chama `dadosDoNumero` e confere que `display_phone_number` é o `identificadorExterno` do Canal (por `conferirNumeroConectado`, da Sessão 4).",
              "Inscreve o app na conta (`POST /{waba-id}/subscribed_apps`) para os webhooks chegarem.",
              "Tudo certo: grava `conexao_confirmada` na hora (aqui não há QR code)."
            ],
            "pronto": "Teste: com o servidor falso respondendo o número certo, o Canal fica `conectada`; com outro número, fica `desconectada` e a rota devolve “Este token é de outro número.”"
          },
          {
            "n": "Receber pelo webhook da Meta",
            "cam": [
              "api",
              "infra"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Na rota de webhook da Sessão 3, o tratador `whatsapp-cloud`: no `GET`, responder `hub.challenge` quando `hub.verify_token` é igual à variável `META_WEBHOOK_VERIFY_TOKEN`; no `POST`, conferir a assinatura `X-Hub-Signature-256` contra `META_APP_SECRET` sobre o corpo cru, antes de qualquer leitura.",
              "A conferência de assinatura fica em `apps/api/src/provedores/meta/assinatura.ts`, para o Instagram (Sessão 8) usar a mesma.",
              "Achar o Canal pelo `metadata.phone_number_id` do evento.",
              "Traduzir `messages` (texto, mídia, `context.id` da mensagem citada, `reaction`, `interactive`) para o recebimento da Sessão 3, e `statuses` (`sent`, `delivered`, `read`, `failed`) para `proximoStatusDeEntrega`.",
              "Responder 200 logo depois de pôr na fila de entrada: a Meta reenvia se demorar.",
              "No painel do app da Meta, em WhatsApp › Configuração, cadastrar o endereço do webhook e o token de verificação e assinar o campo `messages`."
            ],
            "pronto": "Teste: corpo com assinatura errada recebe 401 e não entra na fila; um evento `messages` de exemplo cria a Mensagem na Conversa do Contato."
          },
          {
            "n": "Formulário de conectar da Cloud API",
            "cam": [
              "web"
            ],
            "hoje": "Só o quadro reservado “Token de acesso e número verificado” (`conectar-canal.ts:28-31`) e três passos genéricos (`:23-27`).",
            "fazer": [
              "Na ficha do Canal `whatsapp-cloud` (`[canal]/page.tsx`), o botão “Conectar” abre um formulário com três campos (ID do número, ID da conta do WhatsApp Business e token), cada um dizendo onde achar o dado no painel da Meta.",
              "O token é campo de senha, nunca volta da api e não aparece em log.",
              "Trocar os passos de `ORIENTACAO_DO_PROVEDOR` para `whatsapp-cloud` pelos passos de 7.1."
            ],
            "pronto": "Você conecta o número oficial pela tela, sem ajuda, e o Canal fica “conectada”."
          },
          {
            "n": "Exigir modelo também antes da primeira mensagem do Contato",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "`validarEnvio` libera texto livre quando o Contato nunca mandou nada (`ultimaRecebidaEm === null`, `packages/dominio/src/crm/mensagens.ts:166`). No WhatsApp oficial é o contrário: a empresa só abre conversa com modelo aprovado.",
            "fazer": [
              "Em `validarEnvio`, com `requiresTemplateOutsideWindow` verdadeiro e nenhuma recebida, exigir modelo como se estivesse fora da janela.",
              "Ajustar a frase da Caixa de Entrada (`conversation-thread.tsx:409-415`) para o caso “o Contato ainda não mandou mensagem”."
            ],
            "pronto": "Teste em `packages/dominio/src/crm/mensagens.test.ts`: numa Conversa nova de um Canal `whatsapp-cloud`, sem recebida, texto livre é recusado e modelo aprovado passa."
          }
        ]
      },
      {
        "id": "7.3",
        "n": "Modelos de mensagem",
        "objetivo": "Falar com o cliente depois das 24 h usando modelos aprovados pela Meta. Hoje não há onde guardar modelo, o servidor passa uma lista vazia, e por isso nada sai fora da janela.",
        "pronto": "Fora da janela, a resposta escolhe um modelo aprovado, preenche as variáveis e chega ao celular.",
        "subs": [
          {
            "n": "Criar as tabelas de modelos e de respostas de Flow",
            "cam": [
              "banco",
              "dom"
            ],
            "hoje": "A 008 deixou modelos de fora de propósito (comentário da linha 17). O tipo `MessageTemplate` (`types/crm.ts:368`) só tem `providerId`, `name`, `language`, `body`, `category` e `approval`: não tem onde guardar variáveis, cabeçalho e botões.",
            "fazer": [
              "Migração nova com `plataforma.modelos_de_mensagem`: `workspace_id`, `id`, `canal_id` (FK composta para `plataforma.canais`), `id_no_provedor`, `nome`, `idioma`, `categoria` (`utilidade`, `marketing`, `autenticacao`), `estado` (`aprovado`, `pendente`, `rejeitado`, `pausado`, `desativado`), `motivo_rejeicao`, `componentes` (jsonb, como a Meta devolve), `quantidade_de_variaveis` e `sincronizado_em`; único por (`workspace_id`, `canal_id`, `nome`, `idioma`).",
              "Na mesma migração, `plataforma.respostas_de_flow` (ver 7.4): `workspace_id`, `id`, `mensagem_id` (FK composta para `plataforma.mensagens`), `flow_id`, `versao_id`, `valores` (jsonb), `nao_conforme` e `recebida_em`.",
              "No domínio, `packages/dominio/src/crm/modelos.ts` com o tipo `ModeloDeMensagem` em camelCase e `validarVariaveis(modelo, valores)`: quantidade certa e nenhuma vazia."
            ],
            "pronto": "`npm run migrar -w @n1/api -- --seco` lista a migração nova, ela está aplicada em homologação, e há testes de `validarVariaveis`."
          },
          {
            "n": "Sincronizar os modelos com a Meta",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "`sincronizarModelos(canal)` em `apps/api/src/provedores/whatsapp-cloud/modelos.ts`: lê `GET /{waba-id}/message_templates` (paginado) e grava na tabela nova, apagando os que sumiram na Meta.",
              "Roda ao conectar o Canal, de hora em hora e quando chega o webhook `message_template_status_update` (assinar esse campo no painel do app).",
              "Rota `GET /canais/:id/modelos` em `apps/api/src/rotas/crm/canais.ts`, para a tela."
            ],
            "pronto": "Um modelo criado no Gerenciador do WhatsApp aparece em `GET /canais/:id/modelos`, e quando a Meta o aprova o estado muda sozinho."
          },
          {
            "n": "Criar modelos pela plataforma?",
            "cam": [
              "dec",
              "web",
              "api"
            ],
            "decisao": true,
            "hoje": "A ficha do Canal só lista modelos (`[canal]/page.tsx:210-252`), sem criar.",
            "opcoes": [
              "(A) Só sincronizar: os modelos são criados no Gerenciador do WhatsApp, na Meta",
              "(B) Criar e mandar para aprovação pela plataforma (`POST /{waba-id}/message_templates`)"
            ],
            "muda": "(A) cabe nesta sessão. (B) soma cerca de 1,5 dia: formulário com corpo, variáveis com exemplo, cabeçalho e botões, e as regras de categoria da Meta.",
            "recomendo": "(A) agora; (B) se os modelos mudarem toda semana.",
            "peso": "produto"
          },
          {
            "n": "Usar os modelos aprovados no envio",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`modelosAprovados: []` está fixo em `apps/api/src/servicos/crm/mensagens.ts:119`. `NovaMensagem` (`packages/dominio/src/crm/mensagens.ts:103`) e o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40`) não têm campo de modelo.",
            "fazer": [
              "Acrescentar `modeloId` e `variaveis` a `NovaMensagem` e ao esquema da rota.",
              "No serviço, ler os ids aprovados do Canal na tabela nova e passar em `modelosAprovados`; validar as variáveis com `validarVariaveis`.",
              "Gravar `modelo_usado` (`idNoProvedor` e `nome`, coluna que a 008 já tem) e o texto final, com as variáveis preenchidas, em `conteudo`.",
              "O provedor envia como mensagem `template`, com os `components` e os parâmetros.",
              "Na recusa `JANELA_EXPIRADA`, devolver a lista de modelos aprovados do Canal."
            ],
            "pronto": "Teste em `apps/api/src/servicos/crm/mensagens.test.ts`: fora da janela, sem modelo, dá 409 `JANELA_EXPIRADA` com a lista de modelos; com modelo aprovado e variáveis, grava `modelo_usado` e sai pelo provedor."
          },
          {
            "n": "Escolher o modelo na Caixa de Entrada",
            "cam": [
              "web"
            ],
            "hoje": "O seletor existe (`conversation-thread.tsx:345-357` e `:1298`), mas lê `channel.messageTemplates`, que chega vazio para o Canal da tabela nova, e não pede variáveis. (O plano anterior dizia que não existia.)",
            "fazer": [
              "Ler os modelos aprovados de `GET /canais/:id/modelos` (função nova em `apps/web/src/dados/crm/canais.ts`).",
              "Ao escolher, mostrar a prévia do corpo e um campo por variável (`{{1}}`, `{{2}}`…), pré-preenchendo `{{1}}` com o primeiro nome do Contato.",
              "Na ficha do Canal (`[canal]/page.tsx:210-252`), a lista de modelos lê a mesma rota e mostra o motivo de rejeição."
            ],
            "pronto": "Numa Conversa com a janela fechada, escolher um modelo, preencher a variável e enviar faz a mensagem chegar ao celular."
          }
        ]
      },
      {
        "id": "7.4",
        "n": "Flows",
        "objetivo": "Mandar formulários interativos pelo WhatsApp e guardar as respostas. Hoje o construtor monta o Flow, mas publicar, enviar e receber são de mentira, e o documento gerado não está no formato que a Meta aceita.",
        "pronto": "Um Flow publicado pela tela aparece na Meta, é enviado a um Contato, e a resposta fica guardada e pode ser copiada para o Contato por uma Automação.",
        "subs": [
          {
            "n": "Quais Flows entram nesta sessão?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O domínio tem Flows simples (telas que navegam e concluem) e Flows com ponto de troca de dados (`definirPontoDeTrocaDeDados`, `flows.ts:224`), em que o WhatsApp chama um servidor nosso a cada tela, com o corpo cifrado.",
            "opcoes": [
              "(A) Só Flows sem ponto de troca de dados",
              "(B) Os dois"
            ],
            "muda": "(A) cabe nesta sessão. (B) soma cerca de 2 dias: o endereço público, a cifra com a chave enviada à Meta e responder em poucos segundos a cada tela.",
            "recomendo": "(A), escondendo o ponto de troca de dados na tela até haver um caso de uso.",
            "peso": "produto"
          },
          {
            "n": "Gerar o JSON do Flow no formato da Meta",
            "cam": [
              "dom"
            ],
            "hoje": "`definicaoPublicavel` (`packages/dominio/src/operations/ferramentas/flows-validacao.ts:249`) gera um documento com os nomes do domínio em português (`type: c.tipo`, como `campoDeTexto`, `formulario` e `rodape`, e propriedades como `rotulo`), que a Meta não aceita.",
            "fazer": [
              "Nova função `flowJsonDaMeta(flow, versao)` em `packages/dominio/src/operations/ferramentas/flow-json-meta.ts`, que traduz cada `TipoDeComponente` (`types/ferramentas.ts:240`) para o componente da Meta (ex.: `titulo` → `TextHeading`, `campoDeTexto` → `TextInput`, `areaDeTexto` → `TextArea`, `escolhaUnica` → `RadioButtonsGroup`, `multiplaEscolha` → `CheckboxGroup`, `menuSuspenso` → `Dropdown`, `seletorDeData` → `DatePicker`, `consentimento` → `OptIn`, `formulario` → `Form`, `condicional` → `If`, `rodape` → `Footer`) e cada `TipoDeAcao` para a ação da Meta (`navegar` → `navigate`, `concluir` → `complete`, `trocaDeDados` → `data_exchange`, `abrirEndereco` → `open_url`, `atualizarDados` → `update_data`).",
              "`version` sai de `versaoDeEsquemaDoFlow` (`capacidades.ts:44`, hoje 6.3).",
              "Componente sem equivalente na versão do esquema: a validação de `flows-validacao.ts` recusa antes de publicar."
            ],
            "pronto": "Teste com o Flow do seed (`seed-ferramentas.ts`): o JSON gerado, colado no construtor de Flows do Gerenciador do WhatsApp, não mostra erro.",
            "nota": "Conferir a tabela de componentes e ações na documentação da versão de esquema escolhida."
          },
          {
            "n": "Publicar o Flow na Meta",
            "cam": [
              "api",
              "web",
              "dom"
            ],
            "hoje": "`publicarVersao` (`flows.ts:624`) inventa o id com `gerarIdentificadorDeFlow` e marca `publicado` sem falar com ninguém.",
            "fazer": [
              "Rota `POST /ferramentas/flows/:id/publicar` em `apps/api/src/rotas/ferramentas.ts`, no padrão de 6.4: conferir no domínio; criar o Flow na Meta na primeira vez (`POST /{waba-id}/flows`, com nome e categoria); subir o JSON (`POST /{flow-id}/assets`, arquivo `flow.json`); ler `validation_errors` e, se houver, devolver as mensagens; publicar (`POST /{flow-id}/publish`); gravar com `publicarVersao` recebendo o id real em `doProvedor`.",
              "`despublicarFlow` (`flows.ts:662`) chama `POST /{flow-id}/deprecate`; `sincronizarFlow` (`flows.ts:796`) lê `GET /{flow-id}` para o estado na Meta.",
              "Tirar `publicarVersao`, `despublicarFlow`, `sincronizarFlow` e `enviarFlow` de `OPERACOES` em `registro.ts`; o botão de publicar de `flow-builder.tsx` e de `flow-popup.tsx` chama a rota."
            ],
            "pronto": "Publicar pela tela faz o Flow aparecer como publicado no Gerenciador do WhatsApp; um erro de validação da Meta aparece na tela com o texto dela."
          },
          {
            "n": "Enviar o Flow e receber a resposta",
            "cam": [
              "api",
              "dom"
            ],
            "hoje": "`enviarFlow` (`flows.ts:845`) grava no modelo antigo pelo `sendMessage` e confere a capacidade por `CHANNEL_CAPABILITIES[canal.channelType]` (`:859`), que deixa o não oficial enviar Flow. `receberRespostaDeFlow` (`:908`) inventa o id da resposta com `gerarIdentificadorDeResposta`.",
            "fazer": [
              "Trocar a conferência de `:859` por `capacidadesDeAtivosDoCanal` (6.2).",
              "Enviar pela porta de saída uma mensagem `interactive` do tipo `flow`, com `flow_id`, `flow_cta` (o rótulo do botão), `flow_action: navigate`, a tela inicial e `flow_token` igual ao id da Mensagem enviada. Fora da janela, só por modelo com botão de Flow.",
              "No webhook da Cloud API, a mensagem `interactive` do tipo `nfm_reply` traz `response_json`: achar a Mensagem de origem pelo `flow_token` e chamar `receberRespostaDeFlow` com os valores e o id da mensagem como `identificadorDeRespostaDoProvedor`.",
              "Gravar a resposta estruturada em `plataforma.respostas_de_flow` (7.3), porque `plataforma.mensagens` não tem campo para ela."
            ],
            "pronto": "Enviar um Flow a um Contato real, preencher no celular e concluir grava uma linha em `plataforma.respostas_de_flow`, e a resposta aparece no fio da Conversa."
          },
          {
            "n": "Copiar as respostas para o Contato por Automação",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "Pela regra RN-FLW-14, o Contato não muda sozinho com a resposta: `receberRespostaDeFlow` emite o evento `respostaDeFlowRecebida` (`flows.ts:943`) para as Automações. Mas a ação `contato.definirCampo` (`runAction` em `packages/dominio/src/operations/ferramentas/automacoes.ts`) só grava um valor fixo (`spec.value`), não o que o Contato respondeu. (O plano anterior mandava gravar no Contato direto, o que fere a regra.)",
            "fazer": [
              "Escrever no catálogo de Automações em código (Sessão 18) a Automação “Copiar resposta de Flow para o Contato”: gatilho no evento `respostaDeFlowRecebida` (`flows.ts:943`), parâmetros “qual Flow” e “de qual campo do Flow para qual Campo do Contato”.",
              "Ela grava no Contato da tabela nova (`plataforma.contatos`), conforme a unificação da Sessão 3.",
              "Não mexer no editor visual de Automações: ele sai na Sessão 18, como decidido em 19/10."
            ],
            "pronto": "Teste: uma Automação “Resposta de Flow recebida → definir o Campo E-mail com o campo `email` do Flow” grava no Contato o e-mail que veio na resposta.",
            "nota": "Se a Sessão 7 vier antes da 16, esta Automação nasce como exemplo do catálogo e a 18.2 reaproveita o formato."
          },
          {
            "n": "Levar as Mensagens de Flow para as tabelas novas e apagar o resto do modelo antigo",
            "cam": [
              "dom",
              "api",
              "banco"
            ],
            "hoje": "Envios e respostas de Flow são contados pelas Mensagens antigas: `enviosDoFlow` e `respostasDoFlow` (`packages/dominio/src/derive-ferramentas.ts:275` e `:287`) e `receiveMessage` (`packages/dominio/src/operations/ferramentas/flows.ts:922`).",
            "fazer": [
              "Trocar as três funções para ler e gravar nas tabelas de respostas de Flow criadas na 7.3.",
              "Copiar o que existir em `plataforma.registros` e apagar as linhas antigas.",
              "Com isso, o tipo `Conversation` antigo deixa de ter uso: apagar o tipo, as operações e a coleção `conversations` de `colecoes.ts` e `state.ts`."
            ],
            "pronto": "`npm run check` passa sem o tipo `Conversation` antigo, e um Flow enviado e respondido aparece contado na tela do Flow."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: Cloud API, modelos de mensagem e Flows, incluindo traduzir o Flow para o formato da Meta. Pode virar duas sessões: Cloud API e modelos (4 dias) e Flows (3 dias)."
  },
  {
    "id": "8",
    "n": "Instagram",
    "dias": [
      3,
      3
    ],
    "dep": [
      "3"
    ],
    "meta": true,
    "desc": "Mensagens diretas (Direct) de uma conta profissional do Instagram entram e saem pela Caixa de Entrada. O Instagram tem regras próprias: só se responde a quem escreveu primeiro, dentro de 24 h, e não existe modelo aprovado para falar depois disso. E a pessoa chega identificada por um número interno do Instagram, não pelo @.",
    "partida": [
      "O provedor `instagram-graph` existe (`packages/dominio/src/provedores-de-canal.ts:32`), e o Canal nasce pela página de conectar com o @ da conta como identificador (`identificadorCanonico`, `packages/dominio/src/operations/canais.ts:92-99`).",
      "As capacidades do tipo `instagram` (`packages/dominio/src/operations/conversations.ts:37-52`): janela de 24 h, status `enviada` e `lida`, reações e mídia só de imagem, vídeo e áudio. Mas `requiresTemplateOutsideWindow: true` faz a recusa falar em “Mensagem de modelo”, que o Instagram não tem.",
      "O Contato tem o identificador do tipo `instagram` em `plataforma.contato_identificadores` (`apps/api/migracoes/007-crm.sql:113`), pensado para o @ digitado na ficha.",
      "Da Sessão 3: interface de provedor, webhook com fila de entrada, porta de saída e mídia. Da Sessão 7, se já feita: a conferência de assinatura da Meta em `apps/api/src/provedores/meta/assinatura.ts` e o app da Meta."
    ],
    "pronto": "Uma mensagem mandada ao Direct da conta conectada aparece na Caixa de Entrada no Contato certo, com o @ e o nome; a resposta chega no Instagram; e depois de 24 h sem mensagem do Contato a tela explica que só ele pode reabrir a conversa.",
    "tarefas": [
      {
        "id": "8.1",
        "n": "Pré-requisitos",
        "objetivo": "Ter a conta e as permissões de mensagem antes da sessão. A permissão de mensagens pode depender de revisão da Meta, que leva semanas.",
        "pronto": "Conta profissional pronta, produto Instagram no app da Meta e a permissão de mensagens funcionando.",
        "subs": [
          {
            "n": "Preparar a conta do Instagram e o app da Meta",
            "cam": [
              "voce"
            ],
            "hoje": "Não iniciado.",
            "fazer": [
              "No aplicativo do Instagram, mudar a conta para profissional (Empresa ou Criador de conteúdo), se ainda não for.",
              "No mesmo aplicativo, permitir o acesso de ferramentas conectadas às mensagens (fica em Configurações, na parte de mensagens; o nome do item muda com a versão do aplicativo).",
              "Se a decisão de 8.2 for o login do Facebook: ligar a conta a uma Página do Facebook no Meta Business.",
              "No app da Meta da Sessão 7 (o mesmo serve; se a Sessão 7 ainda não foi feita, criar como em 7.1), adicionar o produto Instagram.",
              "Entregar: o @ da conta e acesso de administrador ao app para quem vai desenvolver."
            ],
            "pronto": "A conta aparece como profissional e o app da Meta tem o produto Instagram."
          },
          {
            "n": "Pedir a permissão de mensagens, se for preciso",
            "cam": [
              "voce"
            ],
            "hoje": "Não iniciado.",
            "fazer": [
              "No painel do app, ver se a permissão de mensagens (`instagram_business_manage_messages` no login do Instagram, ou `instagram_manage_messages` no login do Facebook) está em acesso padrão ou avançado.",
              "Se a conta conectada for de quem tem papel no app, o acesso padrão pode bastar. Se não, pedir o acesso avançado na Revisão do app, com um vídeo da tela mostrando uma mensagem chegando e sendo respondida (dá para gravar em homologação no fim da sessão).",
              "A empresa precisa estar verificada (7.1) e o app no modo Ao vivo."
            ],
            "pronto": "A permissão aparece aprovada, ou o acesso padrão funciona com a conta da empresa.",
            "nota": "A revisão costuma levar de 1 a 4 semanas: pedir logo depois da verificação da empresa."
          }
        ]
      },
      {
        "id": "8.2",
        "n": "Conexão",
        "objetivo": "Ligar a conta profissional do Instagram pela ficha do Canal. Hoje a página de conectar só tem um texto reservado e o `apps/api` não tem nenhum login da Meta.",
        "pronto": "Você conecta a conta pela tela e a ficha mostra “Conectado como @conta”.",
        "subs": [
          {
            "n": "Login do Instagram ou do Facebook?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Os passos de hoje (`apps/web/src/features/crm/conectar-canal.ts:45-56`) supõem o login do Facebook com uma Página ligada.",
            "opcoes": [
              "(A) API do Instagram com login do Instagram: a pessoa entra com a conta do Instagram, sem Página do Facebook",
              "(B) API do Instagram com login do Facebook: entra pela conta do Facebook que administra a Página ligada"
            ],
            "muda": "(A) é mais simples para quem conecta e não depende de Página. (B) serve se a empresa já administra tudo pela Página e quer o mesmo token para o Messenger depois. O resto da sessão muda pouco: endereços da API e nomes das permissões.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "Ligar a conta pelo login da Meta",
            "cam": [
              "api"
            ],
            "hoje": "Não existe login OAuth no `apps/api`.",
            "fazer": [
              "Rota `GET /canais/:id/instagram/autorizar`: redireciona ao login escolhido em 8.2, com um `state` aleatório guardado por 10 min (contra falsificação).",
              "Rota de volta `GET /canais/instagram/retorno`: troca o código pelo token, troca o token curto pelo de longa duração, guarda no cofre, lê o @ da conta e confere com o `identificadorExterno` do Canal (por `conferirNumeroConectado`, da Sessão 4, generalizada para identificador).",
              "Inscreve a conta nos webhooks de mensagens (campo `messages`) e grava `conexao_confirmada`.",
              "Rotina que renova o token de longa duração antes de vencer (cerca de 60 dias) e põe o Canal `com_erro` se a renovação falhar."
            ],
            "pronto": "Teste com `criarServidorFalso` no lugar da Meta: o retorno grava a credencial cifrada e o Canal fica `conectada`; um `state` desconhecido é recusado."
          },
          {
            "n": "Botão de conectar na ficha do Canal",
            "cam": [
              "web"
            ],
            "hoje": "Só o quadro reservado “Autorização da conta” com texto (`conectar-canal.ts:52-55`).",
            "fazer": [
              "Na ficha do Canal `instagram-graph` (`[canal]/page.tsx`), o botão “Conectar” leva à rota de autorizar; na volta, a ficha mostra “Conectado como @conta”.",
              "Trocar os passos de `ORIENTACAO_DO_PROVEDOR` para `instagram-graph` pelos de 8.1."
            ],
            "pronto": "Você conecta a conta pela tela, sem ajuda."
          }
        ]
      },
      {
        "id": "8.3",
        "n": "Mensagens",
        "objetivo": "Receber e responder o Direct. Hoje nada fala com o Instagram, a identidade do Contato não tem onde ficar e a regra da janela fala de um modelo que não existe lá.",
        "pronto": "Uma mensagem direta chega no Contato certo e é respondida; fora das 24 h, a tela explica por que não dá para responder.",
        "subs": [
          {
            "n": "Como guardar a identidade do Contato no Instagram?",
            "cam": [
              "dec",
              "banco",
              "dom"
            ],
            "decisao": true,
            "hoje": "O webhook identifica quem mandou por um id próprio da conta conectada (IGSID), não pelo @, e o @ pode mudar. O tipo `instagram` de `plataforma.contato_identificadores` (007, linha 113) foi pensado para o @ digitado na ficha.",
            "opcoes": [
              "(A) Migração nova: mais um tipo de identificador, para o id do Instagram, com o @ em `valor_exibido`",
              "(B) Guardar o id no tipo `instagram` mesmo, e o @ em `valor_exibido`"
            ],
            "muda": "(A) separa o @ digitado à mão do id do webhook, e o recebimento acha o Contato pelo id. Custa a migração que muda o `check` de tipos (meio dia). (B) não tem migração, mas mistura @ e id no mesmo campo, e a busca por @ quebra.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          },
          {
            "n": "Receber pelo webhook",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Tratador `instagram-graph` na rota de webhook da Sessão 3: verificação por `GET` (`hub.challenge`) e assinatura `X-Hub-Signature-256` pela mesma função de `apps/api/src/provedores/meta/assinatura.ts` (criar aqui se a Sessão 7 ainda não criou).",
              "Achar o Canal pelo id da conta em `entry[].id`.",
              "Traduzir `messaging[].message` (texto, anexos de imagem, vídeo e áudio, `reply_to`), `messaging[].read` e as reações para o recebimento da Sessão 3. Mensagem com `is_echo` (mandada pela própria conta, inclusive pelo aplicativo) vira `enviada`, sem duplicar a que a plataforma mandou.",
              "Contato novo: buscar nome e @ pela API de perfil (`GET /{igsid}` com `fields=name,username`) e gravar o identificador decidido acima.",
              "No painel do app da Meta, cadastrar o endereço do webhook do Instagram e assinar o campo `messages`."
            ],
            "pronto": "Teste com um evento de exemplo: cria o Contato com o @ e o nome, e a Mensagem na Conversa do Canal."
          },
          {
            "n": "Enviar",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Implementar `enviar` da interface de provedor em `apps/api/src/provedores/instagram/`: `POST /{ig-id}/messages` com `recipient.id` igual ao id do Contato e `message.text` ou `message.attachment`.",
              "Respeitar as mídias de `capacidadesDoCanal` (`sendableMediaTypes` do Instagram: imagem, vídeo e áudio).",
              "Ler a confirmação de leitura (`messaging[].read`) por `proximoStatusDeEntrega`."
            ],
            "pronto": "Uma resposta escrita na Caixa de Entrada chega no Direct e, quando lida, aparece como lida."
          },
          {
            "n": "Corrigir a regra da janela do Instagram",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "As capacidades do `instagram` (`conversations.ts:38-40`) dizem `requiresTemplateOutsideWindow: true`; fora da janela, `validarEnvio` responde “Este Canal não tem Mensagem de modelo aprovada”, e o Instagram não tem modelo.",
            "fazer": [
              "Trocar em `ChannelCapabilities` (`packages/dominio/src/types/crm.ts`) o booleano `requiresTemplateOutsideWindow` por um campo de três valores para “depois da janela”: `livre`, `so_modelo` (WhatsApp oficial) e `bloqueado` (Instagram).",
              "`validarEnvio` (`packages/dominio/src/crm/mensagens.ts:162`) responde, no `bloqueado`: “Passaram 24 h desde a última mensagem do Contato: só ele pode reabrir a conversa.” O mesmo vale antes da primeira mensagem dele.",
              "A Caixa de Entrada (`conversation-thread.tsx:345-357`) desliga o campo com essa frase, sem seletor de modelo."
            ],
            "pronto": "Teste em `mensagens.test.ts`: Instagram fora da janela recusa com a frase nova; WhatsApp oficial continua pedindo modelo; não oficial e e-mail continuam livres.",
            "nota": "A Meta permite responder até 7 dias depois com a etiqueta `HUMAN_AGENT`, para atendimento humano, se o app tiver essa permissão. Fica fora desta sessão."
          }
        ]
      }
    ]
  },
  {
    "id": "9",
    "n": "E-mail",
    "dias": [
      3,
      4
    ],
    "dep": [
      "3"
    ],
    "desc": "Uma caixa de e-mail que a empresa já tem vira Canal: os e-mails que chegam viram Conversas na Caixa de Entrada, e a resposta sai pela mesma caixa, no mesmo fio, com assunto e cópias. Antes de tudo é preciso saber de que serviço são as caixas, porque o Microsoft 365 não aceita mais entrar por senha.",
    "partida": [
      "O provedor `email-imap-smtp` existe (`packages/dominio/src/provedores-de-canal.ts:33`), e o Canal nasce com o endereço como identificador (`identificadorCanonico`, `packages/dominio/src/operations/canais.ts:88-91`).",
      "A 008 já tem em `plataforma.mensagens` as colunas `assunto`, `enderecos_adicionais` (para, cópia e cópia oculta) e `em_resposta_a_id` (linhas 148-150), e o tipo `EnderecoAdicional` existe (`packages/dominio/src/crm/mensagens.ts:67`).",
      "A Caixa de Entrada já mostra um campo de assunto quando o Canal tem `hasSubjectAndCopies` (`apps/web/src/features/crm/conversation-thread.tsx:1182-1190`), mas o envio não o leva: `NovaMensagem` (`mensagens.ts:103`) e o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40-47`, `strict`) não têm assunto nem endereços.",
      "As capacidades do `email` (`packages/dominio/src/operations/conversations.ts:73-87`): sem janela, com assunto e cópias, qualquer arquivo e vários por mensagem, corpo formatado.",
      "Da Sessão 3: interface de provedor, fila de entrada, porta de saída, mídia e CRM unificado. Da Sessão 4: `POST /canais/:id/conectar`."
    ],
    "pronto": "Um e-mail mandado para a caixa conectada vira Conversa no Contato do remetente; a resposta escrita na Caixa de Entrada chega a ele com o mesmo assunto e aparece no mesmo fio no programa de e-mail dele; um anexo vai e volta; e a resposta seguinte dele cai na mesma Conversa.",
    "tarefas": [
      {
        "id": "9.1",
        "n": "Escolher como a caixa se conecta",
        "objetivo": "Decidir o jeito de entrar na caixa. O resto da sessão depende disso, e o plano anterior supunha que IMAP com senha serve para qualquer caixa, o que não vale para o Microsoft 365.",
        "pronto": "As caixas estão listadas e a decisão está tomada.",
        "subs": [
          {
            "n": "Dizer quais caixas e de que serviço",
            "cam": [
              "voce"
            ],
            "hoje": "Não se sabe que serviço de e-mail a empresa usa.",
            "fazer": [
              "Listar as caixas que vão virar Canal (ex.: contato@, financeiro@).",
              "Dizer de que serviço é cada uma: Google Workspace (Gmail), Microsoft 365 (Outlook) ou outro (hospedagem com IMAP).",
              "Para Gmail: confirmar que a conta tem verificação em duas etapas e que o administrador do Workspace permite senha de app e IMAP."
            ],
            "pronto": "Lista anotada nesta tarefa."
          },
          {
            "n": "IMAP/SMTP com senha, ou login do Google e da Microsoft?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Não há nenhuma integração de e-mail. A Microsoft desligou o acesso IMAP por senha no Microsoft 365: lá só se entra com login OAuth (a conta autoriza o app, sem senha).",
            "opcoes": [
              "(A) IMAP/SMTP com senha ou senha de app: serve para Gmail com senha de app e para hospedagens comuns, não para Microsoft 365",
              "(B) IMAP/SMTP com login OAuth do Google e da Microsoft: o mesmo protocolo, entrando pela conta em vez da senha",
              "(C) APIs próprias de cada um (Gmail API e Microsoft Graph)"
            ],
            "muda": "(A) é o mais rápido e cabe nos 3 dias, mas deixa o Microsoft 365 de fora. (B) cobre os três casos e soma cerca de 1,5 dia (dois logins e renovação de token; o Google pode exigir verificação do app para o acesso ao e-mail). (C) dá aviso instantâneo de e-mail novo, mas é uma integração por serviço e exige valor novo em `provedor` (migração).",
            "recomendo": "(A) se a lista de 9.1 não tiver Microsoft 365; (B) se tiver.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "9.2",
        "n": "Conexão",
        "objetivo": "Ligar uma caixa de e-mail pela ficha do Canal. Hoje a página só tem um texto reservado e nada testa servidor nenhum.",
        "pronto": "Você conecta uma caixa pela tela, e uma senha errada é avisada na hora.",
        "subs": [
          {
            "n": "Guardar a credencial e testar a conexão",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "`POST /canais/:id/conectar` (Sessão 4) recebe, para `email-imap-smtp`: servidor, porta e segurança do IMAP e do SMTP, usuário e senha (ou o token do login, se a decisão for (B)).",
              "Testar antes de gravar: abrir a sessão IMAP (biblioteca `imapflow`) e listar a caixa de entrada; abrir a sessão SMTP (biblioteca `nodemailer`, função `verify`).",
              "Se os dois responderem, guardar a credencial no cofre e gravar `conexao_confirmada`; se não, devolver qual dos dois falhou e a frase do servidor, sem a senha."
            ],
            "pronto": "Teste com servidores IMAP e SMTP de teste: senha errada devolve “O servidor IMAP recusou o usuário ou a senha.” e nada é gravado; senha certa deixa o Canal `conectada`."
          },
          {
            "n": "Formulário de conexão",
            "cam": [
              "web"
            ],
            "hoje": "Só o quadro reservado “Servidores IMAP e SMTP” com texto (`apps/web/src/features/crm/conectar-canal.ts:64-67`).",
            "fazer": [
              "Na ficha do Canal `email-imap-smtp` (`[canal]/page.tsx`), o botão “Conectar” abre o formulário de IMAP e SMTP.",
              "Preencher sozinho servidor e porta pelo domínio do endereço: Gmail (`imap.gmail.com` 993 e `smtp.gmail.com` 465) e Outlook (`outlook.office365.com` 993 e `smtp.office365.com` 587).",
              "A senha é campo de senha e nunca volta da api."
            ],
            "pronto": "Você conecta uma caixa pela tela, sem ajuda."
          }
        ]
      },
      {
        "id": "9.3",
        "n": "Receber",
        "objetivo": "O e-mail que chega vira Conversa, e as respostas ficam no mesmo fio. Hoje nada lê caixa nenhuma, e o recebimento da Sessão 3 junta por Contato e Canal, sem olhar os cabeçalhos do e-mail.",
        "pronto": "Um e-mail novo aparece na Caixa de Entrada em até 2 min, e uma troca de três e-mails fica numa Conversa só.",
        "subs": [
          {
            "n": "Guardar onde a leitura parou",
            "cam": [
              "banco"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Migração nova com `plataforma.cursores_de_canal`: `workspace_id`, `canal_id`, `pasta`, `uidvalidity`, `ultimo_uid` e `atualizado_em`.",
              "Serve para ler só o que é novo e não repetir e-mail quando o processo reinicia."
            ],
            "pronto": "Migração aplicada em homologação."
          },
          {
            "n": "Buscar os e-mails novos",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Leitor em `apps/api/src/provedores/email/leitor.ts`: uma sessão IMAP por Canal conectado, escutando a caixa de entrada (`IDLE`) e, como reserva, conferindo a cada 2 min.",
              "Para cada e-mail com UID maior que o do cursor: ler o MIME com a biblioteca `mailparser` e pôr na fila de entrada da Sessão 3 com `idExterno` igual ao `Message-ID`, o `assunto`, `remetenteExterno` igual ao endereço do `From` e os endereços de `To` e `Cc` em `enderecosAdicionais`; depois, avançar o cursor.",
              "Corpo: o texto puro vai para `conteudo`; o HTML vai para a mídia como anexo `text/html` e só aparece na tela depois de limpo (sem scripts e sem imagens remotas carregando sozinhas).",
              "Ignorar respostas automáticas (`Auto-Submitted`) e avisos de não entrega, para não abrir Conversa com o servidor.",
              "Ligado pela variável `EMAIL_LEITOR_ATIVO`, desligado no ambiente local, e iniciado em `apps/api/src/index.ts`."
            ],
            "pronto": "Mandar um e-mail para a caixa conectada faz a Conversa aparecer em até 2 min; reiniciar o `apps/api` não cria Mensagem repetida."
          },
          {
            "n": "Juntar as respostas na mesma Conversa",
            "cam": [
              "dom"
            ],
            "hoje": "O recebimento da Sessão 3 acha a Conversa aberta do par Contato e Canal (`abertaDoPar`, `apps/api/src/repositorios/crm/conversas.ts:138`) e não olha cabeçalhos.",
            "fazer": [
              "Função pura `mensagemRespondida(cabecalhos, buscarPorIdExterno)` em `packages/dominio/src/crm/mensagens.ts`: procura o `In-Reply-To` e, se não achar, cada id de `References`, do último para o primeiro, entre as Mensagens do Canal.",
              "Achou: a Mensagem nova vai para a Conversa daquela (reabrindo se estiver resolvida) e grava `em_resposta_a_id`. Não achou: segue a regra da Sessão 3 (Conversa aberta do par, ou nova).",
              "Assunto começando com “Re:” sem cabeçalho não junta sozinho, para não misturar e-mails de assuntos iguais por acaso."
            ],
            "pronto": "Teste em `mensagens.test.ts` com uma troca de três e-mails (enviado, resposta, resposta da resposta): os três ficam na mesma Conversa, cada um apontando para o anterior."
          }
        ]
      },
      {
        "id": "9.4",
        "n": "Enviar",
        "objetivo": "A resposta sai pela caixa conectada, no mesmo fio, com assunto, cópias e anexos. Hoje o assunto digitado na tela não chega ao servidor e nada envia e-mail.",
        "pronto": "A resposta aparece no Gmail do remetente na mesma conversa, e um PDF vai e volta.",
        "subs": [
          {
            "n": "Levar assunto e cópias no envio",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`NovaMensagem` (`packages/dominio/src/crm/mensagens.ts:103-108`) só tem `conversaId`, `direcao`, `conteudo` e `emRespostaAId`; o esquema `NOVA_MENSAGEM` (`apps/api/src/rotas/crm/mensagens.ts:40-47`) é `strict` e recusa qualquer campo a mais; o assunto digitado na tela (`conversation-thread.tsx:1182-1190`) não chega ao servidor.",
            "fazer": [
              "Acrescentar `assunto` e `enderecosAdicionais` a `NovaMensagem` e ao esquema, aceitos só quando o Canal tem `hasSubjectAndCopies` (`validarNovaMensagem` recusa nos outros).",
              "Resposta sem assunto: usar “Re: ” mais o assunto da última recebida.",
              "O serviço `enviar` (`apps/api/src/servicos/crm/mensagens.ts:91`) grava as duas colunas.",
              "A tela manda os dois campos e ganha os campos de cópia e cópia oculta."
            ],
            "pronto": "Teste em `apps/api/src/servicos/crm/mensagens.test.ts`: uma Mensagem `enviada` num Canal de e-mail grava `assunto` e `enderecos_adicionais`; num Canal de WhatsApp, o assunto é recusado."
          },
          {
            "n": "Enviar pelo SMTP mantendo o fio",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Implementar `enviar` da interface de provedor em `apps/api/src/provedores/email/`: `nodemailer` com a credencial do cofre; `From` igual ao endereço do Canal; `Message-ID` gerado por nós e gravado em `id_externo` antes de enviar; `In-Reply-To` e `References` com o `Message-ID` da Mensagem respondida e os anteriores do fio.",
              "Corpo em texto e em HTML simples (o texto da tela com as quebras de linha).",
              "Gravar uma cópia na pasta de enviados por IMAP (`APPEND`), para o e-mail aparecer em Enviados no programa de e-mail; a pasta é a que o servidor marca como de enviados."
            ],
            "pronto": "A resposta enviada pela Caixa de Entrada aparece no Gmail do remetente dentro da mesma conversa, e na pasta Enviados da caixa conectada.",
            "nota": "No Gmail, o envio por SMTP já guarda em Enviados: pular o `APPEND` quando o servidor for do Google, senão aparece duas vezes."
          },
          {
            "n": "Anexos",
            "cam": [
              "api"
            ],
            "hoje": "A mídia da Sessão 3 guarda e serve arquivos; o e-mail aceita qualquer tipo e vários por mensagem (`sendableMediaTypes` do `email`, `conversations.ts:85`).",
            "fazer": [
              "Na entrada: cada anexo do MIME vira arquivo pela mídia da Sessão 3, com nome e tipo; as imagens embutidas no corpo (`cid:`) também.",
              "Na saída: os anexos da Mensagem vão como partes do e-mail, lidos do armazenamento.",
              "Recusar acima de 20 MB no total, com a frase “O e-mail passa de 20 MB: muitos servidores recusam.”"
            ],
            "pronto": "Um PDF recebido abre na Conversa, e um PDF enviado chega ao remetente."
          },
          {
            "n": "Validar com a caixa real",
            "cam": [
              "voce"
            ],
            "hoje": "—",
            "fazer": [
              "Conectar em homologação uma das caixas da lista de 9.1.",
              "Mandar de outro endereço um e-mail com anexo, responder pela Caixa de Entrada, responder de volta pelo programa de e-mail."
            ],
            "pronto": "Os três e-mails ficam numa Conversa só, o anexo abre, e a conversa aparece inteira no programa de e-mail do remetente."
          }
        ]
      }
    ],
    "ajuste": "+1 dia, ou +2 se a decisão for login OAuth, que o Microsoft 365 exige."
  },
  {
    "id": "10",
    "n": "Canal Reunião: investigação",
    "dias": [
      2,
      2
    ],
    "dep": [
      "5"
    ],
    "desc": "Na Lista conversacional entra um Canal novo, “Reunião”: o closer cria uma sala de vídeo e manda o link para o cliente entrar, e um gestor pode entrar na chamada sem que o closer nem o cliente vejam. Antes de implementar, dois dias para decidir a base: um serviço pronto, como o LiveKit, ou a conexão WebRTC feita do zero. O resultado define a Sessão 11.",
    "partida": [
      "Os tipos de Canal são só `whatsapp`, `instagram` e `email` (`packages/dominio/src/provedores-de-canal.ts`), e o banco recusa outros (`canais_tipo_ck`, migração 008, linha 45).",
      "A Lista conversacional define os Canais por onde as conversas nascem (`canaisDeAtendimento`, em `List`, `packages/dominio/src/types/structure.ts`).",
      "Existe a tela da chamada do Closer (`apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx`), mas sem vídeo: o próprio arquivo diz que o protótipo não tem mídia nem servidor. A “Reunião” é uma Tarefa do Tipo Reunião ligada ao Negócio."
    ],
    "pronto": "A decisão “LiveKit ou WebRTC próprio” tomada, e a Sessão 11 escrita com as tarefas e a duração que saírem da investigação.",
    "tarefas": [
      {
        "id": "10.1",
        "n": "Testar as duas opções",
        "objetivo": "Ver funcionando, com o caso real: closer e cliente na sala, e um gestor entrando sem aparecer.",
        "pronto": "Uma página com o resultado de cada opção: o que funcionou, o custo e o esforço.",
        "subs": [
          {
            "n": "Testar o LiveKit",
            "cam": [
              "infra",
              "api"
            ],
            "hoje": "Não existe nenhuma chamada de vídeo no produto.",
            "fazer": [
              "Criar uma sala de teste no LiveKit Cloud (ou num LiveKit no nosso servidor, em Docker).",
              "Gerar um link de entrada para um convidado sem conta (o cliente), com um token de curta duração gerado pelo `apps/api`.",
              "Testar a entrada oculta: um terceiro participante que vê e ouve, não publica áudio nem vídeo e não aparece para os outros. Conferir na documentação do LiveKit a permissão de participante oculto.",
              "Testar no celular do cliente (navegador, sem instalar nada) e com rede ruim.",
              "Anotar o custo (LiveKit Cloud cobra por minuto de participante; o servidor próprio custa a máquina) e se a gravação é possível."
            ],
            "pronto": "Closer, cliente e um gestor oculto numa chamada de teste, com o resultado anotado."
          },
          {
            "n": "Levantar o custo do WebRTC próprio",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Listar o que teria de ser construído: servidor de sinalização (quem entra, quem sai), servidores STUN e TURN (para atravessar redes de empresa e de celular) e um servidor que distribui o vídeo entre os participantes (SFU), porque com o gestor oculto já são três pessoas.",
              "Estimar o esforço de construir e o custo de manter cada peça, incluindo as quedas de conexão e a qualidade no celular."
            ],
            "pronto": "Estimativa em dias e em custo mensal, na mesma página."
          },
          {
            "n": "Confirmar as regras de gravação e da entrada oculta",
            "cam": [
              "voce"
            ],
            "hoje": "Não há regra definida.",
            "fazer": [
              "Definir se as chamadas são gravadas e se a gravação vai para a IA (transcrição, resumo).",
              "Confirmar com quem cuida de LGPD e do jurídico na Tria como fica a entrada oculta do gestor e a gravação: por exemplo, se o convite e a página da sala avisam que a chamada pode ser acompanhada e gravada."
            ],
            "pronto": "Regras escritas na página.",
            "nota": "A entrada sem aviso numa chamada com cliente pode ter implicação legal. Vale fechar isso antes de construir."
          }
        ]
      },
      {
        "id": "10.2",
        "n": "Decidir a base",
        "objetivo": "Escolher a base com o resultado dos testes.",
        "pronto": "Decisão tomada e a Sessão 11 reescrita com ela.",
        "subs": [
          {
            "n": "LiveKit ou WebRTC próprio?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Nenhuma das duas existe no produto.",
            "opcoes": [
              "(A) LiveKit Cloud: o LiveKit hospeda as salas e cobra por uso",
              "(B) LiveKit no nosso servidor: mesmo código, nós mantemos a máquina",
              "(C) WebRTC próprio, feito do zero"
            ],
            "muda": "Define a base da Sessão 11. A duração e as tarefas da Sessão 11 saem desta investigação.",
            "recomendo": "(A) para começar; (B) se o custo por minuto pesar.",
            "peso": "produto"
          },
          {
            "n": "Escrever a Sessão 11 com o resultado",
            "cam": [
              "voce"
            ],
            "hoje": "A Sessão 11 está no cronograma só como marcador de 1 dia, sem tarefas.",
            "fazer": "Com a decisão tomada, me mandar o resultado: eu escrevo as tarefas e as subtarefas da Sessão 11 e ajusto a duração e as datas.",
            "pronto": "Sessão 11 com tarefas, subtarefas e duração."
          }
        ]
      }
    ]
  },
  {
    "id": "11",
    "n": "Canal Reunião: implementação",
    "dias": [
      1,
      1
    ],
    "dep": [
      "10"
    ],
    "bloqueio": "Só começa depois da investigação (Sessão 10). O 1 dia é só um marcador no cronograma: a duração real e as subtarefas ainda não são conhecidas e saem da Sessão 10.",
    "desc": "A implementação do Canal Reunião na Lista conversacional. O que será feito, em quantos dias e com quais subtarefas depende do resultado da investigação (Sessão 10).",
    "partida": [
      "A tela da chamada do Closer existe sem vídeo (`apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx`)."
    ],
    "pronto": "A definir depois da investigação.",
    "tarefas": [
      {
        "id": "11.1",
        "n": "A definir depois da investigação",
        "objetivo": "As tarefas, as subtarefas e a duração desta sessão saem da Sessão 10. Quando a investigação terminar, você me manda o resultado e eu escrevo esta sessão.",
        "pronto": "Sessão escrita com o resultado da investigação.",
        "subs": []
      }
    ]
  }
];
