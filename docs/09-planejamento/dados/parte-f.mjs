// Parte f do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "17",
    "n": "IA: Conhecimento indexado",
    "dias": [
      3,
      5
    ],
    "dep": [
      "13",
      "14"
    ],
    "desc": "Hoje o Conhecimento guarda Coleções, Fontes, Documentos e Versões de verdade, mas o conteúdo de arquivo e de URL é inventado: vira um único trecho “(simulado)”, nada é indexado e o Agente recebe sempre o primeiro trecho de até três Documentos. Nesta sessão o arquivo sobe ao armazenamento, o texto é extraído e fatiado, cada trecho ganha um vetor de significado (embedding) guardado no Postgres com a extensão `pgvector`, a Ferramenta `consultar_conhecimento` passa a buscar por significado só nas Coleções que o Agente pode ler, e as Fontes de URL se atualizam sozinhas.",
    "partida": [
      "CRUD de Coleção, Fonte, Documento, Versão e Concessão em `packages/dominio/src/operations/ia/conhecimento.ts` (20 operações), gravado em `plataforma.registros` pelo `POST /operacoes/:nome`.",
      "Texto colado já é fatiado por parágrafo em `fragmentarTexto` (`packages/dominio/src/derive-ia.ts:405`).",
      "Arquivo e URL são simulados em `prepararConteudo` (`conhecimento.ts:363`): o arquivo nasce com `objectKey: legado/<id>` (`conhecimento.ts:385`), a URL nunca é baixada (`conhecimento.ts:371`) e os dois rendem um trecho “Conteúdo de … (simulado)” (`fragmentoSimulado`, `conhecimento.ts:354`).",
      "O envio real em duas fases já existe em `apps/api/src/servicos/storage-uploads.ts` (ticket assinado, conferência dos bytes, `urlDeDownload`) e já serve a Tarefa em `apps/api/src/rotas/anexos-da-tarefa.ts`.",
      "As Coleções que um Agente pode ler já são calculadas por `conhecimentoAcessivel` (`derive-ia.ts:242`).",
      "As telas já mostram a referência: o Chat (`apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:355`) e a Execução (`apps/web/src/app/(shell)/ia/execucoes/[execucao]/page.tsx:267`) ligam para o Documento consultado."
    ],
    "pronto": "Você envia um PDF de verdade a uma Coleção concedida a um Agente, pergunta no Chat algo que só está na página 3, e a resposta cita esse Documento; o link abre o Documento já no trecho usado. Nenhum Documento novo tem `objectKey` começando com `legado/`.",
    "tarefas": [
      {
        "id": "17.1",
        "n": "Arquivo de verdade no Conhecimento",
        "objetivo": "Hoje escolher um arquivo no diálogo só lê nome, tamanho e tipo; nenhum byte sobe, e o Arquivo nasce com uma chave fictícia. O arquivo passa a subir pelo mesmo envio em duas fases da Tarefa, e o Documento aponta para o objeto guardado no bucket privado.",
        "pronto": "Um PDF enviado pela tela fica no bucket, aparece na coleção `files` de `plataforma.registros` com `objectKey` começando com `workspace/` e baixa pelo botão “Baixar” do Documento.",
        "subs": [
          {
            "n": "Criar as rotas de envio de arquivo do Conhecimento",
            "cam": [
              "api"
            ],
            "hoje": "Só a Tarefa e o Formulário público pedem ticket de envio: `POST /tarefas/:taskId/anexos/ticket` (`apps/api/src/rotas/anexos-da-tarefa.ts:96`) e `POST /tarefas/:taskId/anexos/confirmar` (`anexos-da-tarefa.ts:119`), com `abrirSessaoDeUpload`, `emitirTicket` e `confirmarObjeto` de `storage-uploads.ts`.",
            "fazer": [
              "Criar `apps/api/src/rotas/conhecimento-arquivos.ts` com `POST /conhecimento/colecoes/:colecaoId/arquivos/ticket` e `POST /conhecimento/colecoes/:colecaoId/arquivos/confirmar`, copiando o desenho de `anexos-da-tarefa.ts`.",
              "A sessão de envio usa o `formId` sintético `colecao-<colecaoId>`, do mesmo jeito que a Tarefa usa `tarefa-<taskId>` (`formIdDaTarefa`, `anexos-da-tarefa.ts`).",
              "Antes de emitir o ticket, hidratar o Espaço e recusar com 403 quando `recusaNaColecao(state, membroId, colecao, 'criar')` (de `operations/ia/permissoes-ia.ts`) devolver motivo.",
              "Na confirmação, conferir o objeto com `confirmarObjeto` e chamar `adicionarDocumentoEnviado` (subtarefa seguinte) dentro de `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts`), na mesma transação que consome a sessão.",
              "Registrar `rotasDeArquivosDoConhecimento` em `apps/api/src/app.ts`, ao lado de `rotasDeAnexosDaTarefa` (`app.ts:208`)."
            ],
            "pronto": "Teste novo `apps/api/src/rotas/conhecimento-arquivos.test.ts`: um Convidado sem `criar` na Coleção recebe 403 no ticket; um Membro com permissão faz ticket, envio e confirmação, e o Documento fica gravado com o `objectKey` do bucket."
          },
          {
            "n": "Aceitar os tipos de documento no envio",
            "cam": [
              "api"
            ],
            "hoje": "`TIPOS_ACEITOS` (`apps/api/src/servicos/storage-uploads.ts:53`) aceita só PDF, XML, JPEG, PNG e WebP, e `assinaturaConfereComTipo` (`storage-uploads.ts:114`) só conhece as assinaturas desses.",
            "fazer": [
              "Criar em `storage-uploads.ts` a lista `TIPOS_DO_CONHECIMENTO`: PDF, `text/plain`, `text/markdown`, `text/csv` e DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).",
              "Em `assinaturaConfereComTipo`, aceitar DOCX pela assinatura de ZIP (`PK` seguido de `03 04`) e texto puro quando os primeiros bytes não têm byte nulo.",
              "As rotas do Conhecimento usam `TIPOS_DO_CONHECIMENTO`; Tarefa e Formulário continuam com `TIPOS_ACEITOS`."
            ],
            "pronto": "Teste na “Seção pura” de `storage-uploads.test.ts`: um DOCX real passa, um PNG renomeado para `.docx` é recusado.",
            "nota": "A Sessão 2.5 também mexe em `TIPOS_ACEITOS` (áudio e vídeo). Quem vier depois junta as duas listas."
          },
          {
            "n": "Gravar o Documento a partir do arquivo conferido",
            "cam": [
              "dom"
            ],
            "hoje": "No caso `arquivo` de `prepararConteudo` (`conhecimento.ts:373-389`) o domínio inventa o `WorkspaceFile` com `objectKey: legado/${fileId}` e já marca a Versão como `processado`, com um `fragmentoSimulado`.",
            "fazer": [
              "Criar em `conhecimento.ts` a operação `adicionarDocumentoEnviado(state, membroId, colecaoId, { title, labels, arquivo })`, em que `arquivo` é o tipo `ArquivoEnviado` que já existe em `packages/dominio/src/operations/anexos-enviados.ts:33`.",
              "O `WorkspaceFile` nasce com o `objectKey` conferido pelo servidor e `state: enviado`. A Versão 1 nasce com `processing: pendente` e `fragments: []`: o texto chega depois, pelo processador da 17.3.",
              "Criar do mesmo jeito `novaVersaoDoDocumentoEnviado` para a Versão nova por arquivo.",
              "Não registrar as duas em `operations/registro.ts`: só a rota de confirmação pode chamá-las, como já acontece com `anexarArquivoEnviado`.",
              "Tirar o caso `kind: arquivo` de `EntradaDeConteudo` (`conhecimento.ts:281-284`) e apagar `fragmentoSimulado` quando ninguém mais o usar."
            ],
            "pronto": "Teste em `operations/ia/conhecimento.test.ts`: o Documento criado por `adicionarDocumentoEnviado` tem Versão 1 `pendente`, sem Fragmentos, e o Arquivo com o `objectKey` recebido."
          },
          {
            "n": "Ligar o diálogo e a ficha do Documento ao envio real",
            "cam": [
              "web"
            ],
            "hoje": "`apps/web/src/features/ia/conhecimento/adicionar-documento-dialog.tsx` lê só nome, tamanho e tipo do arquivo (`ArquivoEscolhido`, linhas 20-24) e chama `adicionarDocumento` pelo `run` (linha 96). A ficha (`documento-completo.tsx`) não tem botão de baixar.",
            "fazer": [
              "Criar `apps/web/src/dados/arquivos-do-conhecimento.ts` com `enviarArquivoAoConhecimento(colecaoId, arquivo, metadados)`, no molde de `enviarArquivoDaTarefa` (`apps/web/src/dados/anexos-da-tarefa.ts:55`) e `envio-ao-bucket.ts`: pede o ticket, sobe os bytes, confirma.",
              "Na aba “Arquivo” do diálogo, trocar o `run(adicionarDocumento)` por essa função e, ao terminar, pedir ao store que confira a revisão (`verificarRevisao`, `store.ts:322`) para o Documento aparecer.",
              "Mostrar no Documento “Processando…” enquanto a Versão estiver `pendente` e “Falhou: <motivo>” quando estiver `comErro`.",
              "Pôr o botão “Baixar” em `documento-completo.tsx`, usando `pedirUrlDeDownload` (`anexos-da-tarefa.ts:90`), que chama `GET /anexos/:fileId/url` (`apps/api/src/rotas/estado.ts:70`).",
              "Apagar o comentário “Fragmentos simulados (D9)” do topo do diálogo (linha 8)."
            ],
            "pronto": "Você envia um PDF pelo diálogo, vê “Processando…”, recarrega e baixa o mesmo arquivo pelo botão."
          }
        ]
      },
      {
        "id": "17.2",
        "n": "Captura de URL de verdade",
        "objetivo": "Hoje uma URL vira o texto fixo “Conteúdo capturado de … (simulado)” e a página nunca é baixada. O servidor passa a baixar a página, tirar o texto legível e guardá-lo na Versão.",
        "pronto": "Um Documento criado com a URL de uma página pública mostra, na ficha, o texto real da página.",
        "subs": [
          {
            "n": "Deixar a Versão de URL pendente no domínio",
            "cam": [
              "dom"
            ],
            "hoje": "O caso `url` de `prepararConteudo` (`conhecimento.ts:369-372`) grava o texto fixo e um `fragmentoSimulado`, já como `processado`.",
            "fazer": [
              "Trocar o caso `url` para gravar a Versão com `processing: pendente`, `content: {}` e `fragments: []`. A URL já fica guardada na Proveniência (`specificOrigin`, preenchida por `origemEspecifica`).",
              "Tirar a frase “A captura é simulada neste protótipo…” do campo Endereço em `adicionar-documento-dialog.tsx:160`."
            ],
            "pronto": "Teste em `conhecimento.test.ts`: `adicionarDocumento` com URL cria a Versão `pendente`, sem texto e sem Fragmentos."
          },
          {
            "n": "Baixar a página com segurança",
            "cam": [
              "api"
            ],
            "hoje": "Não existe nenhum código que faça requisição a uma URL do usuário.",
            "fazer": [
              "Criar `apps/api/src/conhecimento/capturar-url.ts` com `capturarUrl(url): { texto, titulo, tipo } | { erro }`.",
              "Regras: só `http` e `https`; resolver o DNS e recusar endereço privado, loopback ou link-local (para ninguém usar o servidor para ler a rede interna); até 3 redirecionamentos, 15 s de tempo e 5 MB.",
              "HTML: tirar o texto legível com `@mozilla/readability` sobre `linkedom` (duas dependências novas no `apps/api`). PDF por URL: passar pelo extrator da 17.3.",
              "Quem chama é o processador de Documentos da 17.3, que grava o resultado com `registrarProcessamentoDaVersao`."
            ],
            "pronto": "Teste `capturar-url.test.ts`: `http://127.0.0.1` e `http://169.254.169.254` são recusados; uma página HTML de exemplo servida pelo teste devolve o texto do corpo, sem menu e sem rodapé."
          }
        ]
      },
      {
        "id": "17.3",
        "n": "Extrair e fatiar o texto",
        "objetivo": "Nada extrai texto de PDF ou DOCX hoje, e o fatiamento só corta por parágrafo, o que gera trechos enormes num PDF. Um processador no servidor pega cada Versão pendente, extrai o texto, fatia em trechos de tamanho controlado e grava no Documento.",
        "pronto": "Um PDF de 10 páginas enviado vira, em menos de um minuto, uma Versão `processado` com trechos de até cerca de 2.000 caracteres, cada um com a página no localizador.",
        "subs": [
          {
            "n": "Criar o extrator de texto",
            "cam": [
              "api"
            ],
            "hoje": "Não existe; o `apps/api/package.json` não tem nenhuma biblioteca de PDF ou DOCX.",
            "fazer": [
              "Criar `apps/api/src/servicos/extrair-texto.ts` com `extrairTexto(bytes, mime): { texto, paginas?: string[] }`.",
              "PDF com `unpdf` (devolve o texto por página); DOCX com `mammoth`; `text/*` lido como UTF-8.",
              "PDF sem texto (escaneado) devolve erro “PDF sem texto: é imagem”, conforme a decisão abaixo."
            ],
            "pronto": "Teste `extrair-texto.test.ts` com um PDF de duas páginas e um DOCX de exemplo guardados em `apps/api/src/testes/`: o texto e a contagem de páginas batem.",
            "nota": "A Sessão 15.3 (PDF anexado no Chat) precisa do mesmo extrator. Quem fizer primeiro cria; a outra reaproveita."
          },
          {
            "n": "PDF escaneado entra no Conhecimento?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Não há extração de texto, então a pergunta nunca apareceu. Um PDF que é só imagem não tem texto para extrair.",
            "opcoes": [
              "(A) Recusar com o aviso “PDF sem texto” e pedir outro arquivo",
              "(B) Ler a imagem com o modelo (visão do Claude) e guardar a transcrição",
              "(C) Usar um serviço de OCR à parte"
            ],
            "muda": "(A) não custa nada. (B) soma cerca de 1 dia e custo de modelo por página. (C) soma cerca de 1 dia e mais um fornecedor.",
            "recomendo": "(A) agora; (B) quando aparecer o primeiro caso real.",
            "peso": "produto"
          },
          {
            "n": "Fatiar por tamanho, guardando a página",
            "cam": [
              "dom"
            ],
            "hoje": "`fragmentarTexto` (`derive-ia.ts:405`) corta só em linha em branco e dá o localizador `p<n>`. Um PDF extraído vira poucos trechos gigantes.",
            "fazer": [
              "Mudar `fragmentarTexto(texto, opcoes?)` para cortar em parágrafos e juntar até `maxCaracteres` (padrão 2.000), com `sobreposicao` (padrão 200) entre um trecho e o seguinte.",
              "Aceitar `paginas?: string[]`: o localizador vira `pag<n>§<m>` (página e trecho dentro da página).",
              "Texto colado curto continua dando um trecho por parágrafo; os testes atuais de `fragmentarTexto` continuam passando."
            ],
            "pronto": "Teste em `derive-ia.test.ts`: um texto de 9.000 caracteres vira 5 trechos de até 2.000, com sobreposição, e um texto de 3 páginas tem localizadores `pag1§1`, `pag2§1`, `pag3§1`."
          },
          {
            "n": "Gravar o resultado do processamento no domínio",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe operação que leve uma Versão de `pendente` para `processado`. `derivedRepresentations` é `readonly` em `DocumentVersion` (`packages/dominio/src/types/ai.ts:561`).",
            "fazer": [
              "Criar em `conhecimento.ts` `registrarProcessamentoDaVersao(state, documentId, numero, resultado)`, em que `resultado` é `{ ok: true, texto, paginas? }` ou `{ ok: false, motivo }`. O ator é o Sistema (`kind: system`, `types/primitives.ts:36`), porque o Fragmento só é criado pelo Sistema (B97).",
              "Com sucesso: acrescentar a representação `{ kind: extracao, text, by: Sistema, at }`, gerar os Fragmentos com o novo `fragmentarTexto` e marcar `processado`. Com falha: marcar `comErro` e registrar o motivo na Atividade do Documento.",
              "Recusar quando a Versão já não está `pendente`, para duas voltas do processador não gravarem duas vezes.",
              "Tirar o `readonly` de `derivedRepresentations` em `types/ai.ts:561`."
            ],
            "pronto": "Teste em `conhecimento.test.ts`: a Versão `pendente` vira `processado` com N Fragmentos; a segunda chamada é recusada; a falha deixa `comErro` com o motivo."
          },
          {
            "n": "Criar o processador de Documentos pendentes",
            "cam": [
              "api"
            ],
            "hoje": "Não existe. O `apps/api` já tem trabalhadores em segundo plano no mesmo processo: o outbox e o agendador, ligados em `apps/api/src/index.ts:187`.",
            "fazer": [
              "Criar `apps/api/src/conhecimento/processador-de-documentos.ts` com `criarProcessadorDeDocumentos()`, no molde de `criarOutboxWorker`, e ligá-lo em `apps/api/src/index.ts`.",
              "A cada volta (padrão 30 s): achar por SQL em `plataforma.registros` (coleção `documents`) os Documentos cuja Versão corrente está `pendente`; para cada um, baixar o objeto do bucket (arquivo) ou chamar `capturarUrl` (URL), extrair o texto e gravar com `registrarProcessamentoDaVersao` dentro de `executar()`.",
              "Depois de gravar, chamar a indexação da 17.4 para os Fragmentos novos.",
              "Áudio e vídeo continuam `pendente` (transcrição fica fora desta sessão) e o processador os ignora."
            ],
            "pronto": "Teste de integração `processador-de-documentos.test.ts` (pula sem `DATABASE_URL`): um Documento enviado fica `processado` depois de uma volta do processador."
          }
        ]
      },
      {
        "id": "17.4",
        "n": "Índice por significado",
        "objetivo": "Hoje não existe nenhum vetor, então não há como achar o trecho “parecido” com a pergunta. Cada trecho ganha um embedding, guardado numa tabela própria com `pgvector`, e toda Versão nova é indexada sozinha.",
        "pronto": "Depois de enviar um Documento, `select count(*) from plataforma.fragmentos_indexados where documento_id = '<id>'` devolve o mesmo número de Fragmentos da Versão corrente.",
        "subs": [
          {
            "n": "Qual modelo gera os embeddings?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Nenhum. A Anthropic, que é o modelo de conversa da Sessão 13, não oferece embeddings; é preciso outro fornecedor.",
            "opcoes": [
              "(A) Voyage AI `voyage-2.5` (1.024 dimensões, indicado pela Anthropic, bom em português)",
              "(B) OpenAI `text-embedding-3-small` (1.536 dimensões)",
              "(C) Modelo aberto rodando no nosso servidor (por exemplo `multilingual-e5`)"
            ],
            "muda": "Fixa o tamanho da coluna `embedding` e cria mais uma chave de API no servidor. (A) e (B) cobram por volume, cerca de centavos por mil páginas. (C) não cobra por uso, mas soma cerca de 1 dia de infraestrutura e precisa de máquina com mais memória.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "Criar a tabela de trechos com `pgvector`",
            "cam": [
              "banco"
            ],
            "hoje": "Não existe. Os Fragmentos vivem dentro do JSON do Documento, em `plataforma.registros`; nenhuma migração liga extensão (a última é a `008-canais-conversas-mensagens.sql`).",
            "fazer": [
              "Migração nova em `apps/api/migracoes/` com `create extension if not exists vector with schema extensions;`.",
              "Tabela `plataforma.fragmentos_indexados`: `workspace_id text`, `fragmento_id text`, `documento_id text`, `colecao_id text`, `versao int`, `localizador text`, `conteudo text`, `embedding extensions.vector(<dimensão da decisão>)`, `modelo text`, `criado_em timestamptz default now()`; chave primária `(workspace_id, fragmento_id)`.",
              "Índice `hnsw (embedding vector_cosine_ops)` e índice comum em `(workspace_id, colecao_id)` para o filtro de acesso.",
              "Conferir antes com `npm run migrar -w @n1/api -- --seco`."
            ],
            "pronto": "`npm run migrar -w @n1/api -- --seco` lista a migração nova, e depois de aplicada em homologação `select extname from pg_extension where extname = 'vector'` devolve uma linha.",
            "nota": "Confirmado na reunião de 19/10: banco vetorial padrão."
          },
          {
            "n": "Gerar e guardar os embeddings",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Criar `apps/api/src/conhecimento/embeddings.ts` com `gerarEmbeddings(textos): number[][]`, falando com o fornecedor da decisão; chave numa variável de ambiente nova (por exemplo `VOYAGE_API_KEY`) documentada em `apps/api/.env.example`.",
              "Criar `apps/api/src/conhecimento/indexar.ts` com `indexarVersao(workspaceId, documento, versao)`: manda os Fragmentos em lotes de até 100, grava em `plataforma.fragmentos_indexados` e apaga as linhas das Versões anteriores do mesmo Documento (só a corrente é consultável, B98).",
              "Chamado pelo processador da 17.3 depois de `registrarProcessamentoDaVersao`, e também quando texto colado cria ou restaura Versão (essas já nascem `processado`): o processador procura Versões `processado` sem linha na tabela.",
              "Documento enviado à lixeira, arquivado ou movido de Coleção: apagar ou atualizar `colecao_id` das linhas na mesma volta."
            ],
            "pronto": "Teste de integração `indexar.test.ts` (pula sem `DATABASE_URL`, com o fornecedor trocado por um falso): restaurar a Versão 1 troca as linhas da Versão 2 pelas da Versão 3 nova."
          }
        ]
      },
      {
        "id": "17.5",
        "n": "Busca e citação",
        "objetivo": "Hoje o ensaio pega o primeiro trecho de até três Documentos (`referenciasDoEnsaio`), sem olhar a pergunta. A Ferramenta `consultar_conhecimento` passa a buscar os trechos mais próximos da pergunta, só nas Coleções que o Agente e a pessoa podem ler, e a resposta mostra de onde veio cada trecho.",
        "pronto": "Num Espaço com a Política de reembolso e a Tabela de preços, a pergunta “posso devolver depois de 10 dias?” traz o trecho da Política em primeiro lugar, e a citação abre o Documento nesse trecho.",
        "subs": [
          {
            "n": "Buscar por significado nas Coleções permitidas",
            "cam": [
              "api"
            ],
            "hoje": "A Ferramenta `consultar_conhecimento` está só no catálogo (`packages/dominio/src/seed.ts:2604`). O ensaio usa `referenciasDoEnsaio` (`packages/dominio/src/operations/ia/agentes.ts:400`), que devolve o primeiro Fragmento dos três primeiros Documentos.",
            "fazer": [
              "Criar `apps/api/src/conhecimento/buscar.ts` com `buscarConhecimento({ workspaceId, agentId, membroId?, pergunta, k = 6 })`.",
              "Coleções permitidas: as de `conhecimentoAcessivel(state, agentId)` (`derive-ia.ts:242`); quando uma pessoa aciona o Agente, cruzar com as Coleções que ela vê (`recusaNaColecao(..., 'ver')`), a regra de “permissão de quem aciona” da Sessão 16.1.",
              "Gerar o embedding da pergunta e consultar `plataforma.fragmentos_indexados where workspace_id = $1 and colecao_id = any($2) order by embedding <=> $3 limit $4`.",
              "Devolver os trechos e as `KnowledgeReference` (`types/ai.ts:232`) já montadas, com `fragmentIds` dos trechos usados.",
              "Ligar como executor da Ferramenta `consultar_conhecimento` no mecanismo de Ferramentas da Sessão 16.1."
            ],
            "pronto": "Teste `buscar.test.ts` (pula sem `DATABASE_URL`, embeddings falsos e determinísticos): um Agente sem Concessão na Coleção B nunca recebe trecho de B, mesmo quando é o mais próximo."
          },
          {
            "n": "Ensaio com a busca real",
            "cam": [
              "dom"
            ],
            "hoje": "`ensaiarAgente` (`agentes.ts:428`) chama `referenciasDoEnsaio` (`agentes.ts:510`) e não recebe nada de fora.",
            "fazer": [
              "Acrescentar ao `EnsaioInput` o campo opcional `referencias: KnowledgeReference[]`, preenchido pelo `apps/api` com o resultado de `buscarConhecimento`.",
              "Quando vier, `ensaiarAgente` usa essas referências; quando não vier, nenhuma (e não mais os primeiros trechos).",
              "Apagar `referenciasDoEnsaio`."
            ],
            "pronto": "Teste em `operations/ia/agentes.test.ts`: o ensaio grava em `contextComposition.fragmentRefs` exatamente os trechos recebidos."
          },
          {
            "n": "Citar o trecho, não só o Documento",
            "cam": [
              "web"
            ],
            "hoje": "O Chat (`ia/chat/[sessao]/page.tsx:355-363`) e a Execução (`ia/execucoes/[execucao]/page.tsx:267-290`) já ligam para `/ia/conhecimento/documentos/<id>`, mas sem dizer qual trecho. A lista de Fragmentos da ficha (`documento-completo.tsx:255-266`) não tem âncora.",
            "fazer": [
              "Em `documento-completo.tsx`, dar a cada item de Fragmento o `id` HTML `frg-<fragmentId>` e destacar o que vier no endereço.",
              "No Chat e na Execução, o link passa a ser `/ia/conhecimento/documentos/<id>?versao=<n>#frg-<primeiro fragmentId>`, com o localizador (`pag3§2`) ao lado do título.",
              "Quando a referência tem `marker` (Documento na lixeira, Versão eliminada…), mostrar o marcador em vez do link, como a Execução já faz."
            ],
            "pronto": "Você clica na citação de uma resposta e a ficha do Documento abre rolada até o trecho, destacado."
          }
        ]
      },
      {
        "id": "17.6",
        "n": "Atualização das Fontes de URL",
        "objetivo": "Uma Fonte de URL guarda a política “periódica a cada N horas”, mas nada roda (P16 em `docs/PENDENCIAS-FRONTEND.md:409`). Passa a existir “Atualizar agora” e uma rotina que revisita as Fontes no prazo.",
        "pronto": "Mudar o texto da página de uma Fonte periódica de 1 hora gera, na volta seguinte, uma Versão nova com origem “atualização” no Documento.",
        "subs": [
          {
            "n": "Operação de atualizar a Fonte",
            "cam": [
              "dom"
            ],
            "hoje": "`adicionarFonte` (`conhecimento.ts:175`) grava `updatePolicy`, `state` e os campos `lastUpdateAt` e `lastUpdateResult` (`types/ai.ts:537-549`), que ninguém preenche. A origem `atualizacao` de Versão (`DocumentVersion.origin`) nunca é usada.",
            "fazer": [
              "Criar `registrarAtualizacaoDaFonte(state, colecaoId, fonteId, resultado)`, com ator Sistema: se o texto mudou, cria a Versão N+1 com `origin.kind: atualizacao` e `processing: pendente`; se não mudou, só atualiza `lastUpdateAt`; se falhou, põe a Fonte em `comErro` com o motivo em `lastUpdateResult`.",
              "Criar `pedirAtualizacaoDaFonte(state, membroId, colecaoId, fonteId)`, registrada em `operations/registro.ts` e com esquema em `apps/api/src/rotas/esquemas/ia-conhecimento.ts`: marca a Fonte para a próxima volta (exige `editar` na Coleção).",
              "Comparar pelo `originVersionMark` (já existe no tipo): guardar ali um hash do texto capturado."
            ],
            "pronto": "Testes em `conhecimento.test.ts` para os três casos: mudou, não mudou e falhou."
          },
          {
            "n": "Rotina que revisita as Fontes",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "No processador de Documentos da 17.3, acrescentar uma etapa: achar as Fontes `url` ativas com `updatePolicy.kind: periodica` cujo `lastUpdateAt + intervalHours` já passou, ou marcadas por `pedirAtualizacaoDaFonte`; capturar com `capturarUrl` e gravar com `registrarAtualizacaoDaFonte`.",
              "Fontes de Integração ficam de fora: nenhuma Integração real traz documentos hoje; a Fonte continua mostrando “sem sincronização” na tela."
            ],
            "pronto": "Teste de integração com relógio injetado: uma Fonte de 1 hora não roda aos 59 minutos e roda aos 61."
          },
          {
            "n": "Botão “Atualizar agora” na Fonte",
            "cam": [
              "web"
            ],
            "hoje": "A Coleção lista as Fontes (`apps/web/src/features/ia/conhecimento/colecao-completa.tsx`) sem nenhuma ação de atualizar.",
            "fazer": [
              "Pôr “Atualizar agora” em cada Fonte de URL, chamando `pedirAtualizacaoDaFonte` pelo `run`, e mostrar `lastUpdateAt` e `lastUpdateResult`."
            ],
            "pronto": "Você clica em “Atualizar agora”, e em até um minuto a data da última atualização muda."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: seis frentes (armazenamento real, extração de texto, embeddings, busca, citação do trecho e Fontes)."
  },
  {
    "id": "19",
    "n": "Saída do protótipo: LGPD, rotinas e dados reais",
    "dias": [
      3,
      5
    ],
    "dep": [
      "1",
      "3",
      "18"
    ],
    "desc": "O que separa o protótipo do produto em produção. As rotinas de limpeza da lixeira e de recorrência só rodam nas Listas que, por acaso, têm uma Automação de vencimento; só Tarefa expira na lixeira; não há como exportar nem anonimizar os dados de um Contato; a porta fictícia `/login` e vários avisos de “protótipo” continuam na tela; e o teste no navegador cobre só a tela de entrar e o formulário público.",
    "partida": [
      "Expurgo da lixeira (`purgeExpiredTasks`, `packages/dominio/src/operations/tasks.ts:780`) e recorrência por calendário (`runCalendarRecurrences`, `packages/dominio/src/operations/collaboration.ts:546`) já existem e rodam no `agendaDoDia` do agendador (`apps/api/src/automacoes/scheduler-worker.ts:184`).",
      "Produção já nasce sem dados de demonstração: `bootstrap:gestao` (`packages/dominio/src/bootstrap-gestao.ts`) parte de um estado vazio e aplica só os processos do Financeiro.",
      "As rotas públicas `/f/<segredo>` e `/p/<segredo>` já leem do servidor (`GET /v1/public/forms/:secret` e `GET /v1/public/tasks/:secret`); o `apps/web/CONTEXT.md:39-41` ainda diz o contrário.",
      "A tabela `plataforma.mensagens` (008) já tem as colunas `anonimizada` e `carga_bruta`, e uma regra que aceita mensagem anonimizada sem conteúdo.",
      "7 testes ponta a ponta na API (`apps/api/src/e2e/`) e 3 testes Playwright na web (`apps/web/e2e/fumaca.spec.ts` e `formulario-publico.spec.ts`), fora do CI."
    ],
    "pronto": "Em produção: uma Lista sem Automação expurga a lixeira e cria as recorrências do dia; um Contato enviado à lixeira some depois do prazo; um Administrador exporta e anonimiza um Contato pela ficha; `/login` dá 404; e o CI roda os testes de navegador dos fluxos principais contra homologação.",
    "tarefas": [
      {
        "id": "19.1",
        "n": "Rotinas diárias em todas as Listas",
        "objetivo": "Hoje o agendador só visita as Listas que têm uma Automação ativa com gatilho de vencimento; numa Lista comum, a lixeira nunca esvazia e a recorrência por calendário nunca cria a próxima Tarefa. A manutenção passa a ser uma rotina própria, que visita todas as Listas uma vez por dia.",
        "pronto": "Numa Lista sem nenhuma Automação, uma Tarefa na lixeira há 31 dias é eliminada e a Tarefa recorrente de amanhã é criada, sem ninguém abrir a tela.",
        "subs": [
          {
            "n": "Separar a manutenção da agenda de Automações",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`agendaDoDia` (`scheduler-worker.ts:184-197`) roda Automações, recorrência e expurgo juntos, mas só para os pares de `catalogoDeListasComAgenda` (`scheduler-worker.ts:278-303`): Listas com Automação ativa de escopo Lista e Versão publicada com gatilho `condicaoTemporal`. `semear` (`scheduler-worker.ts:413`) semeia só esses pares. As duas operações exigem administrar a Lista (`containerAdminRefusal`).",
            "fazer": [
              "Criar `packages/dominio/src/operations/manutencao.ts` com `manutencaoDoDia(state, dia)`, ator Sistema: percorre todas as Listas ativas do Espaço e chama o miolo de `runCalendarRecurrences` e de `purgeExpiredTasks` sem a checagem de administrador (a checagem fica só nas versões chamadas por pessoa). Não registrar em `operations/registro.ts`.",
              "Criar `apps/api/src/rotinas/manutencao-diaria.ts`: uma vez por dia civil e por Espaço de Trabalho, hidrata, chama `manutencaoDoDia` dentro de `executar()` e grava que rodou.",
              "Migração nova com `plataforma.rotinas_do_dia (workspace_id, rotina, dia_civil, iniciada_em, concluida_em, erro)`, chave `(workspace_id, rotina, dia_civil)`, para não rodar duas vezes com dois processos.",
              "Tirar `runCalendarRecurrences` e `purgeExpiredTasks` de `agendaDoDia`, que volta a cuidar só de Automações.",
              "Ligar a rotina em `apps/api/src/index.ts`, ao lado do agendador."
            ],
            "pronto": "Teste `manutencao-diaria.test.ts` (pula sem `DATABASE_URL`): uma Lista sem Automação, com uma Tarefa na lixeira há 31 dias e uma recorrência vencida, termina a volta sem a Tarefa e com a ocorrência nova; rodar duas vezes no mesmo dia não duplica nada."
          },
          {
            "n": "Quais famílias expiram na lixeira?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Só Tarefa expira (`previsaoDeEliminacao`, `tasks.ts:768`). Documento, Agente, Automação, Pasta, Lista e, no CRM, Contato, Empresa, Negócio, Funil e Conversa ficam na lixeira para sempre.",
            "opcoes": [
              "(A) Tarefa e as entidades do CRM (Contato, Empresa, Negócio, Funil, Conversa)",
              "(B) Todas as famílias que têm lixeira"
            ],
            "muda": "(A) é a subtarefa seguinte. (B) soma cerca de 1 dia para Documento, Agente, Automação, Pasta e Lista.",
            "recomendo": "(A) agora: é onde há dado pessoal. (B) depois.",
            "peso": "produto"
          },
          {
            "n": "Expirar as entidades do CRM na lixeira",
            "cam": [
              "banco",
              "api",
              "dom"
            ],
            "hoje": "As tabelas do CRM têm `estado = 'na_lixeira'` (`apps/api/migracoes/007-crm.sql:72`, `:148`, `:326`, `:422`; `plataforma.conversas` na `008:104`), mas nenhuma guarda quando entrou na lixeira. `excluirPermanentemente` do Contato (`apps/api/src/servicos/crm/contatos.ts:424`) recusa quando há Negócio ou Conversa.",
            "fazer": [
              "Migração nova: coluna `na_lixeira_em timestamptz` em `plataforma.contatos`, `empresas`, `negocios`, `funis` e `conversas`, preenchida com `atualizado_em` para quem já está na lixeira.",
              "Nos repositórios de `apps/api/src/repositorios/crm/` (`definirEstado`, `contatos.ts:299`, e os equivalentes), gravar `na_lixeira_em = now()` ao entrar e `null` ao sair.",
              "No domínio, criar a função pura `vencidoNaLixeira(naLixeiraEm, retentionDays, hoje)` ao lado de `previsaoDeEliminacao` e usar nas duas.",
              "Na rotina diária, excluir o que venceu pelos mesmos serviços de `apps/api/src/servicos/crm/` (respeitando as recusas). Contato vencido que não pode ser excluído por ter Conversa é anonimizado (19.2)."
            ],
            "pronto": "Teste de integração: um Negócio na lixeira há 31 dias some na volta da rotina; um Contato com Conversa vencido fica anonimizado, com a Conversa preservada."
          },
          {
            "n": "Conferir a saúde dos Canais conectados",
            "cam": [
              "api"
            ],
            "hoje": "Nada confere se um Canal `conectada` continua conectado; a queda só aparece quando uma mensagem falha.",
            "fazer": [
              "Na rotina, a cada hora, chamar o estado da conexão de cada Canal `conectada` pela interface de provedor da Sessão 2.3 e, se caiu, gravar `desconectada` em `plataforma.canais.conexao` e avisar o dono do Canal.",
              "As sincronizações de Grupos (6.3), modelos de mensagem (7.3) e Fontes (17.6) ficam nas sessões delas; aqui não se repete."
            ],
            "pronto": "Teste com um provedor falso que responde “desconectado”: o Canal muda de estado e o aviso nasce."
          }
        ]
      },
      {
        "id": "19.2",
        "n": "LGPD: exportar e anonimizar um Contato",
        "objetivo": "Hoje não há como atender a um pedido de dados pessoais: nada exporta o que existe de um Contato, e a exclusão permanente é recusada quando ele tem Conversa. Um Administrador passa a exportar tudo do Contato num arquivo e a anonimizá-lo, apagando os dados pessoais dele e das mensagens, sem perder as contagens.",
        "pronto": "Pela ficha do Contato, um Administrador baixa o arquivo com os dados e depois anonimiza o Contato; a Conversa continua na Caixa de Entrada como “Contato anonimizado”, sem texto, e os Painéis contam a mesma quantidade de mensagens.",
        "subs": [
          {
            "n": "Exportar os dados de um Contato",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "Não existe. As rotas do Contato (`apps/api/src/rotas/crm/contatos.ts:108-161`) vão de listar a excluir permanentemente.",
            "fazer": [
              "No domínio, criar o tipo `ExportacaoDeContato` e a função pura `montarExportacaoDoContato(...)` em `packages/dominio/src/operations/lgpd.ts`, com a lista fechada do que entra.",
              "Criar `GET /contatos/:id/exportacao` em `apps/api/src/rotas/crm/contatos.ts` e o serviço `exportarDadosDoContato` em `apps/api/src/servicos/crm/contatos.ts`, só para Administrador.",
              "O serviço junta: a linha de `plataforma.contatos`, `contato_identificadores`, `contato_empresa`, os Negócios em que ele está, as Conversas e Mensagens dele (texto, data, Canal e o link assinado de cada anexo), e as Tarefas com Vínculo a ele em `plataforma.registros`.",
              "Devolver JSON como download (`Content-Disposition: attachment`) e registrar na Atividade quem exportou e quando.",
              "Na ficha do Contato (`apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx`), botão “Exportar dados (LGPD)”, visível só para Administrador."
            ],
            "pronto": "Teste do serviço em `contatos.test.ts`: o arquivo de um Contato com uma Conversa de 3 mensagens traz as 3 mensagens e os identificadores; um Membro comum recebe 403."
          },
          {
            "n": "Anonimizar um Contato",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "Não existe. `excluirPermanentemente` recusa Contato com Conversa (`apps/api/src/servicos/crm/contatos.ts:441-449`). A 008 já preparou `plataforma.mensagens.anonimizada` e o aviso de que `carga_bruta` precisa ser zerada (`008-canais-conversas-mensagens.sql:131`).",
            "fazer": [
              "No domínio (`operations/lgpd.ts`), escrever a regra do que se apaga e do que fica: apaga nome, sobrenome, nascimento, foto, descrição, endereços, campos adicionais e identificadores; fica o id, a Origem, a Qualificação, as datas e os vínculos com Negócio e Conversa.",
              "Criar `POST /contatos/:id/anonimizar` e o serviço `anonimizarContato`, numa transação: limpar as colunas pessoais de `plataforma.contatos` e gravar o nome “Contato anonimizado”; apagar as linhas de `contato_identificadores`; em `plataforma.mensagens` do Contato, gravar `conteudo = null`, `anexos = '[]'`, `carga_bruta = null`, `remetente_externo = null` e `anonimizada = true`; apagar do bucket os objetos dos anexos.",
              "Uma migração nova acrescenta `anonimizado_em` em `plataforma.contatos`, para a tela e para a exportação saberem.",
              "Na ficha, botão “Anonimizar (LGPD)” com confirmação que exige digitar o nome do Contato; depois disso a ficha fica só leitura."
            ],
            "pronto": "Teste em `apps/api/src/e2e/` (pula sem `DATABASE_URL`): depois de anonimizar, `select count(*) from plataforma.mensagens where conteudo is not null and conversa_id in (<conversas do Contato>)` devolve 0, e a contagem total de mensagens não muda."
          },
          {
            "n": "Por quanto tempo guardar as mensagens?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Sem prazo: mensagem nunca é apagada. O prazo dos registros de Execução da IA é decidido na T.4.",
            "opcoes": [
              "(A) 1 ano",
              "(B) 5 anos",
              "(C) Para sempre, só anonimizando sob pedido"
            ],
            "muda": "Com (A) ou (B), a rotina diária da 19.1 anonimiza as mensagens que passarem do prazo (cerca de meio dia a mais). Com (C), nada muda.",
            "recomendo": "(B): cobre prazos de cobrança e disputa comercial.",
            "peso": "produto"
          },
          {
            "n": "Aplicar os prazos de guarda",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Na rotina diária da 19.1, anonimizar as mensagens mais velhas que o prazo decidido acima e apagar as Execuções de IA mais velhas que o prazo da T.4 (coleções `agentExecutions` e `automationExecutions` em `plataforma.registros`)."
            ],
            "pronto": "Teste com relógio injetado: uma mensagem um dia além do prazo é anonimizada; uma um dia antes, não."
          }
        ]
      },
      {
        "id": "19.3",
        "n": "Tirar o protótipo da tela",
        "objetivo": "Uma pessoa que usa o produto ainda encontra a porta fictícia `/login` (“qualquer usuário e senha entram”) e frases como “neste protótipo”. Tudo isso sai, e a documentação para de dizer que as rotas públicas estão em memória.",
        "pronto": "`/login` responde 404, `grep -rni 'protótipo' apps/web/src --include=*.tsx` só acha comentários de código, e você aprova a revisão final.",
        "subs": [
          {
            "n": "Apagar a porta fictícia `/login`",
            "cam": [
              "web"
            ],
            "hoje": "`apps/web/src/app/login/page.tsx` aceita qualquer usuário e senha (aviso na linha 85). A porta real é `/entrar` (`apps/web/src/app/entrar/page.tsx`), e o `proxy.ts` (`apps/web/src/proxy.ts:17`) nem lista `/login` como pública.",
            "fazer": [
              "Apagar a pasta `apps/web/src/app/login/` e o CSS dela (`.login-marca` em `componentes.css`, se só ela usar)."
            ],
            "pronto": "Teste novo em `apps/web/e2e/fumaca.spec.ts`: sem sessão, `/login` leva a `/entrar`; com sessão, dá 404."
          },
          {
            "n": "Trocar os avisos de protótipo",
            "cam": [
              "web"
            ],
            "hoje": "Avisos na tela: descrição do site (`apps/web/src/app/layout.tsx:18`); Chat (`ia/chat/[sessao]/page.tsx:221`); chamada de vídeo (`crm/reunioes/[reuniao]/page.tsx:375`); Minha conta (`minha-conta/page.tsx:212`); Lixeira (`configuracoes/lixeira/page.tsx:325`); anexar e gravar no Construtor (`features/ia/agent-builder/chat-composer.tsx:36` e `:64`); Automações (`features/ia/rotulos.ts:53-54`, `automacao-spec.ts:298-322`, `:411`, `:506`, `editor-de-automacao.tsx:334`, `:1120`); Conhecimento (`adicionar-documento-dialog.tsx:160`, `colecao-completa.tsx:629`).",
            "fazer": [
              "Para cada aviso: se a função ficou pronta numa sessão anterior (Chat na 11, Automações na 15, Conhecimento na 14), apagar; se não ficou, trocar por texto de produto (por exemplo “Em breve”) e esconder o botão.",
              "`layout.tsx`: descrição “Plataforma de trabalho, CRM e IA”."
            ],
            "pronto": "O `grep` do pronto da tarefa só acha comentários."
          },
          {
            "n": "Corrigir a documentação das rotas públicas",
            "cam": [
              "web"
            ],
            "hoje": "`apps/web/CONTEXT.md:39-41` diz que `/f` e `/p` “continuam em memória, com o seed do produto”, mas as duas páginas já são Server Components que chamam o `apps/api` por `transportePublico` (`apps/web/src/app/(publico)/f/[segredo]/page.tsx` e `(publico)/p/[segredo]/page.tsx`).",
            "fazer": [
              "Reescrever o trecho de `apps/web/CONTEXT.md` e conferir o mesmo erro no `CONTEXT.md` da raiz (“`store.ts` ainda monta o seed”)."
            ],
            "pronto": "Os dois `CONTEXT.md` descrevem o que o código faz."
          },
          {
            "n": "Tirar o seed de demonstração do caminho de produção",
            "cam": [
              "dom"
            ],
            "hoje": "`buildSeed()` (`packages/dominio/src/seed.ts:118`) e `buildProductSeed()` (`seed-produto.ts:18`) não são mais usados pela tela nem pela API em produção, mas `seed.ts` também exporta o catálogo real (`TOOLS`, `MODELOS_DA_PLATAFORMA`), importado por `bootstrap-gestao.ts:21`. Cerca de 156 arquivos de teste usam `buildSeed`.",
            "fazer": [
              "Mover o catálogo para `packages/dominio/src/catalogo-da-plataforma.ts`.",
              "Mover `seed.ts`, `seed-produto.ts`, `seed-comercial.ts`, `seed-pos-venda.ts` e `seed-ferramentas.ts` para `packages/dominio/src/testes/` e tirá-los do `exports` de `packages/dominio/package.json`, deixando só para os testes.",
              "`MEUS_NEGOCIOS_ID`, importado pela tela de `@n1/dominio/seed-comercial` (`apps/web/src/app/(shell)/crm/meus-negocios/page.tsx:13`), vira constante de produto num arquivo próprio.",
              "Manter `seed-financeiro.ts` e `seed-contas-a-receber.ts`: são os processos reais que o `bootstrap:gestao` aplica."
            ],
            "pronto": "`grep -rn '@n1/dominio/seed' apps/web/src apps/api/src | grep -v test` só acha `seed-financeiro` e `seed-contas-a-receber`, e `npm run check` passa."
          }
        ]
      },
      {
        "id": "19.4",
        "n": "Testes no navegador dos fluxos principais",
        "objetivo": "Hoje o Playwright abre a tela de entrar e o formulário público, e nem roda no CI (`.github/workflows/check.yml` só roda `npm run check` e `npm run test`). Passam a existir testes dos cinco fluxos principais, rodando no CI contra homologação.",
        "pronto": "O CI tem um passo de Playwright verde com os cinco fluxos, e um teste quebrado de propósito deixa o passo vermelho.",
        "subs": [
          {
            "n": "Usuário de teste e login no Playwright",
            "cam": [
              "web",
              "infra"
            ],
            "hoje": "`apps/web/playwright.config.ts` sobe `next start` local e nenhum teste faz login. Homologação nasce na Sessão 1.6.",
            "fazer": [
              "Criar em homologação um usuário de teste do Supabase, com senha nos segredos do GitHub (`E2E_EMAIL`, `E2E_SENHA`).",
              "Criar `apps/web/e2e/autenticar.setup.ts`, que entra por `/entrar` e guarda a sessão (`storageState`) para os outros testes; ligar como projeto de setup em `playwright.config.ts`, usando `E2E_BASE_URL` de homologação."
            ],
            "pronto": "Rodar `npm run test:e2e -w @n1/web` com `E2E_BASE_URL` de homologação passa o setup."
          },
          {
            "n": "Escrever os cinco fluxos",
            "cam": [
              "web"
            ],
            "hoje": "Só `fumaca.spec.ts` (1 teste) e `formulario-publico.spec.ts` (2 testes).",
            "fazer": [
              "`e2e/tarefa.spec.ts`: criar Tarefa, mudar Status, comentar, anexar arquivo.",
              "`e2e/caixa-de-entrada.spec.ts`: abrir uma Conversa de teste, responder, ver a mensagem no fio.",
              "`e2e/chat.spec.ts`: perguntar ao Agente e ver a resposta chegar (modelo de homologação).",
              "`e2e/superadmin.spec.ts`: convidar um usuário e dar acesso a um módulo (Sessão 12).",
              "`e2e/entrar.spec.ts`: entrar, sair e ser levado a `/entrar` ao abrir uma página protegida."
            ],
            "pronto": "Os cinco arquivos passam contra homologação."
          },
          {
            "n": "Rodar no CI",
            "cam": [
              "infra"
            ],
            "hoje": "`.github/workflows/check.yml` não instala navegador nem roda Playwright.",
            "fazer": [
              "Criar o job `e2e` em `.github/workflows/check.yml`, depois do `check`: `npx playwright install --with-deps chromium` e `npm run test:e2e -w @n1/web`, com os segredos de homologação."
            ],
            "pronto": "Um pull request mostra o job `e2e` verde."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: rotinas em todas as Listas, lixeira do CRM com coluna nova, LGPD e testes no navegador."
  },
  {
    "id": "20",
    "n": "Painel",
    "dias": [
      4,
      5
    ],
    "dep": [
      "3",
      "19"
    ],
    "desc": "Por último porque o Painel lê dados de todo o resto. Hoje o modelo é rico, mas as telas são só leitura dos 4 Painéis de demonstração, não existe operação de criar ou editar, a leitura só conhece 4 das 11 fontes e 2 das 8 contas (contar e somar), ignora o período e a posição dos Widgets, e lê o CRM antigo, que a Sessão 3 tira do código. Um dia para desenhar com você e o resto para construir.",
    "partida": [
      "Tipos em `packages/dominio/src/types/panels.ts`: `Panel` (`panels.ts:137`), `Widget` (`panels.ts:103`), 11 fontes (`DataSourceTarget`, `panels.ts:9`), 9 tipos de visualização (`DataViewType`, `panels.ts:23`) e 8 contas (`Aggregation`, `panels.ts:60`).",
      "A leitura `widgetReading` (`packages/dominio/src/derive.ts:592`) confere se quem olha alcança o escopo e devolve número, valor por moeda, série ou “sem acesso”; `recordsOfTarget` (`derive.ts:734-764`) só conhece `deal`, `conversation`, `task` e `contact`.",
      "Telas `apps/web/src/app/(shell)/paineis/page.tsx` e `paineis/[painel]/page.tsx`; gráficos `Barras`, `Colunas`, `Funil` e `Rosca` em `apps/web/src/features/paineis/graficos.tsx`.",
      "Os 4 Painéis (SDR, Closer, Atendimento, Operações) existem só no seed de demonstração (`packages/dominio/src/seed.ts:1953-1982`); produção não tem nenhum."
    ],
    "pronto": "O Painel desenhado com você está no ar em produção, montado pela tela, com números que batem com as telas do CRM e das Listas.",
    "tarefas": [
      {
        "id": "20.1",
        "n": "Desenhar com você",
        "objetivo": "Sem saber quem olha e o que precisa ver, a sessão constrói fontes e gráficos que ninguém usa. Fechar no primeiro dia o primeiro Painel real e como ele é montado.",
        "pronto": "Um esboço aprovado por você, com a lista de Widgets (título, fonte, conta, dimensão, período e gráfico).",
        "subs": [
          {
            "n": "O que o primeiro Painel mostra e para quem?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Quatro Painéis de demonstração (SDR, Closer, Atendimento, Operações), só leitura, que não existem em produção.",
            "opcoes": [
              "(A) Um Painel de gestão: vendas (Negócios por Etapa, valor ganho no mês) e atendimento (Conversas abertas por Fila, tempo de primeira resposta)",
              "(B) Um Painel por pessoa: as minhas Tarefas, os meus Negócios e as minhas Conversas",
              "(C) Os dois"
            ],
            "muda": "Define quais fontes de dados e gráficos a 20.3 e a 20.4 constroem primeiro. (C) soma cerca de 1 dia.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "Como se posicionam os Widgets?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O Painel guarda `layout` com x, y, largura e altura por Widget (`LayoutCell`, `panels.ts:121`), mas a tela ignora e põe os Widgets numa grade fixa (`paineis/[painel]/page.tsx:112` e `:125`).",
            "opcoes": [
              "(A) Grade de 12 colunas com larguras fixas (um terço, metade, inteira) e ordem por arrastar na lista",
              "(B) Arrastar e redimensionar livre, como no ClickUp"
            ],
            "muda": "(A) cabe na sessão. (B) soma cerca de 1 dia e uma biblioteca de grade.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          }
        ]
      },
      {
        "id": "20.2",
        "n": "Criar e editar Painel no domínio",
        "objetivo": "Não existe nenhuma operação de Painel: o único lugar que grava em `state.panels` é a transferência de dono ao remover um Membro (`operations/members.ts:246`). Passam a existir as operações de criar, editar, arquivar e montar Widgets, com as regras do documento 21.",
        "pronto": "Testes cobrem criar, editar, arquivar e montar Widgets, e as recusas por permissão e por Widget inválido.",
        "subs": [
          {
            "n": "Operações de Painel e Widget",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existem; `docs/PENDENCIAS-FRONTEND.md:383` lista Painel e Widget entre o que continua sem criação.",
            "fazer": [
              "Criar `packages/dominio/src/operations/paineis.ts` com `criarPainel`, `editarPainel` (nome, descrição, âncora), `arquivarPainel`, `restaurarPainel`, `enviarPainelALixeira`, `adicionarWidget`, `editarWidget`, `removerWidget` e `posicionarWidgets` (grava `layout`).",
              "Regras: o dono é sempre um Membro (A7); só o dono ou um Administrador edita; `texto` não tem Fonte e os outros têm exatamente uma (INV-PAI-03); a conta só usa atributo da entidade-alvo (RN-PAI-08); um Widget por célula de `layout`.",
              "Registrar todas em `operations/registro.ts` e criar `apps/api/src/rotas/esquemas/paineis.ts` com os esquemas de argumento."
            ],
            "pronto": "Testes em `operations/paineis.test.ts`, incluindo a recusa de um Membro que não é dono nem Administrador."
          },
          {
            "n": "Validar o Widget por quem olha",
            "cam": [
              "dom"
            ],
            "hoje": "`WidgetValidity` (`panels.ts:148`) existe, mas nada o calcula.",
            "fazer": [
              "Criar `validadeDoWidget(state, widget)` em `derive.ts`: Fonte eliminada, Funil ou Lista arquivados, atributo que não existe mais; a tela mostra a causa no lugar do gráfico (RN-PAI-20)."
            ],
            "pronto": "Teste: arquivar o Funil de um Widget o deixa inválido com a causa “Funil arquivado”."
          }
        ]
      },
      {
        "id": "20.3",
        "n": "Leitura com dados reais",
        "objetivo": "A leitura de hoje só conta e soma, ignora o período, devolve vazio para 7 das 11 fontes e lê `state.deals`, `state.contacts` e `state.conversations`, o modelo antigo que a Sessão 3 apaga. Ela passa a ser feita no servidor, por uma rota própria, com a regra de conta no domínio e a busca dos registros nas tabelas novas.",
        "pronto": "O Widget “Negócios por Etapa” do Painel de gestão mostra os mesmos números da tela do Funil, e muda quando um Negócio muda de Etapa.",
        "subs": [
          {
            "n": "Separar o plano da leitura do cálculo",
            "cam": [
              "dom"
            ],
            "hoje": "`widgetReading` (`derive.ts:592`) faz tudo junto sobre o `DataState`: escolhe os registros (`recordsOfTarget`, `derive.ts:734`), filtra, agrupa e soma.",
            "fazer": [
              "Criar em `packages/dominio/src/paineis/leitura.ts` duas funções puras: `planoDaLeitura(state, widget, membroId, agora)`, que devolve alvo, escopos, filtros fixos, período resolvido (por exemplo `esteMes` vira datas) e a conta, ou “sem acesso”; e `calcularLeitura(plano, linhas)`, que recebe as linhas já buscadas e devolve o `WidgetReading`.",
              "`calcularLeitura` implementa as 8 contas de `Aggregation`: contagem, soma, média, mínimo, máximo, taxa, duração e percentual (hoje `valueOf`, `derive.ts:679-689`, só trata contagem e soma de `value` e `estimate`).",
              "Aplicar o `period` do Widget, que hoje nem entra no tipo aceito por `widgetReading` (`derive.ts:594-611`).",
              "Manter a regra de moedas (RN-PAI-13) que já existe em `derive.ts:653-675`."
            ],
            "pronto": "Testes em `paineis/leitura.test.ts` para cada conta e para `esteMes`, com linhas montadas no teste.",
            "nota": "A Sessão 3 (tarefa 3.4) deixa uma ponte para o Painel ler as tabelas novas pela tela. Esta tarefa substitui a ponte pela leitura no servidor."
          },
          {
            "n": "Buscar os registros de cada fonte",
            "cam": [
              "api"
            ],
            "hoje": "Não existe; os Painéis vêm inteiros no `GET /estado` e são lidos na tela.",
            "fazer": [
              "Criar `apps/api/src/servicos/paineis/linhas.ts` com uma função por fonte: `deal` em `plataforma.negocios`, `contact` em `plataforma.contatos`, `company` em `plataforma.empresas`, `conversation` em `plataforma.conversas`, `message` em `plataforma.mensagens`; `task`, `agentExecution`, `automationExecution`, `approvalRequest`, `activityRecord` e `knowledgeDocument` do `DataState` hidratado.",
              "Filtrar por quem olha, registro a registro: Tarefa por `memberSeesTask`, Negócio e Contato pela regra de acesso das rotas do CRM (`apps/api/src/servicos/crm/acesso.ts`). Hoje `widgetReading` só confere o escopo, e um escopo `workspace` devolve todas as Tarefas, mesmo as que a pessoa não vê.",
              "Fazer as contas simples no SQL (`count`, `sum` com `group by`) quando a fonte é tabela, para não trazer milhares de linhas."
            ],
            "pronto": "Teste de integração (pula sem `DATABASE_URL`): dois Membros com acessos diferentes recebem números diferentes no mesmo Widget de Tarefas."
          },
          {
            "n": "Rota de leitura do Painel",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Criar `apps/api/src/rotas/paineis.ts` com `GET /paineis/:id/leituras`: hidrata, monta o plano de cada Widget, busca as linhas e devolve `{ widgetId, leitura, validade, momento }` para cada um (o `DataReferenceMoment`, `panels.ts:156`).",
              "Registrar em `apps/api/src/app.ts`."
            ],
            "pronto": "Teste da rota: um Painel com 3 Widgets devolve 3 leituras, e um Widget de Funil que a pessoa não vê devolve “sem acesso”, não zero."
          }
        ]
      },
      {
        "id": "20.4",
        "n": "Telas do Painel",
        "objetivo": "A tela só lê os Painéis do seed, põe todo Widget que não é número, funil ou pizza em barras, e ignora a posição guardada. Passa a ter editor, os gráficos que faltam e a grade decidida na 20.1.",
        "pronto": "Você monta pela tela o Painel desenhado na 20.1, do zero, e ele fica igual ao esboço.",
        "subs": [
          {
            "n": "Ler da rota nova",
            "cam": [
              "web"
            ],
            "hoje": "`paineis/[painel]/page.tsx:69` chama `widgetReading` na tela, sobre o `DataState` do store.",
            "fazer": [
              "Criar `apps/web/src/dados/paineis.ts` com `lerPainel(id)`, chamando `GET /paineis/:id/leituras` com o JWT, e trocar a página para usá-la, com estado de carregando por Widget."
            ],
            "pronto": "A página do Painel faz uma requisição a `/paineis/:id/leituras` e mostra os mesmos números de antes no Espaço de homologação."
          },
          {
            "n": "Editor de Painel",
            "cam": [
              "web"
            ],
            "hoje": "Não existe. `paineis/page.tsx` lista os Painéis sem botão de criar.",
            "fazer": [
              "Em `paineis/page.tsx`, botão “Novo Painel” (nome, descrição, âncora opcional) chamando `criarPainel`.",
              "No Painel, modo “Editar”: “Adicionar Widget” abre um diálogo novo `apps/web/src/features/paineis/widget-dialog.tsx` com Fonte, escopo, conta, dimensão, filtros fixos, período e tipo de gráfico, com prévia da leitura.",
              "Posicionar conforme a decisão da 20.1, gravando por `posicionarWidgets`; a página passa a respeitar `layout`."
            ],
            "pronto": "Você cria o Painel, adiciona quatro Widgets, troca a ordem, recarrega e tudo continua no lugar."
          },
          {
            "n": "Gráficos que faltam",
            "cam": [
              "web"
            ],
            "hoje": "Na leitura em série, `paineis/[painel]/page.tsx:342-347` desenha `Funil` para `funil`, `Rosca` para `pizza` e `Barras` para todo o resto: `linhas`, `tabela`, `listaDeRegistros` e `calendario` aparecem como barras.",
            "fazer": [
              "Criar em `apps/web/src/features/paineis/graficos.tsx` os componentes `Linhas` (série no tempo), `Tabela` (linhas e colunas com total) e `ListaDeRegistros` (registros com os `displayedAttributes`, ligando à ficha).",
              "`calendario`: decidir na 20.1 se entra; se não entrar, tirar do diálogo de Widget."
            ],
            "pronto": "Um Widget de cada tipo aparece com o desenho certo no Painel de teste."
          }
        ]
      }
    ],
    "ajuste": "+1 dia: leitura dos Painéis no servidor, com as 8 contas e o período."
  }
];
