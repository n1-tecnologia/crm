// Parte b do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "2",
    "n": "Clone ClickUp: ajustes e lacunas",
    "dias": [
      3,
      8
    ],
    "dep": [
      "1"
    ],
    "desc": "Fecha a Estrutura de Trabalho (Espaço, Pasta, Lista e Tarefa) antes da mensageria. Entra aqui o que você pediu (limpar as telas, gravar mais rápido, converter item do checklist, tirar a Carga) e o que falta no modelo em relação ao artefato “Estrutura de Trabalho N1” e à ontologia (`ontologia/02-estrutura-de-trabalho/`). A lista dos seus testes da Estrutura precisa fechar até a véspera do início; o que vier dela entra na 2.7.",
    "partida": [
      "Espaço, Pasta e Lista têm criar, editar, arquivar, desarquivar, enviar à lixeira e restaurar (`packages/dominio/src/operations/structure.ts`). Não existe mover nem reordenar contêiner.",
      "Toda gravação passa por `POST /operacoes/:nome` (`apps/api/src/rotas/operacoes.ts`), que hidrata o Espaço de Trabalho inteiro de `plataforma.registros` (`hidratar`, `apps/api/src/persistencia/repositorio.ts:63`) e disputa a revisão de `plataforma.workspaces` (`executar`, `apps/api/src/persistencia/unidade-de-trabalho.ts:116`).",
      "A página da Lista (`apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`) tem 1.404 linhas e 6 abas: Lista, Quadro, Calendário, Tabela, Linha do tempo e Carga.",
      "`convertChecklistItem` (`packages/dominio/src/operations/tasks.ts:590`) funciona. A única tela que o chama é `apps/web/src/features/estrutura/tarefa-completa.tsx`, a mesma peça usada na página da Tarefa, no popup (`task-panel.tsx`) e no drawer do Financeiro (`financeiro/conta-drawer.tsx`).",
      "O bloqueio por aspecto (`blocks`) existe no tipo e é conferido por `blockedAbove` (`packages/dominio/src/operations/configuration.ts:42`), mas só o seed o preenche (`packages/dominio/src/seed.ts:290`, Espaço Marketing)."
    ],
    "pronto": "Você aprova as telas da Lista, do Espaço, da Pasta e das Configurações depois da limpeza; os tempos de gravação antes e depois estão anotados na 2.2; mover uma Lista para outra Pasta funciona pela árvore; nenhuma Lista oferece a Carga; e `npm run check` passa com os testes novos de bloqueio, visualizações padrão, menções na descrição e tempo registrado.",
    "tarefas": [
      {
        "id": "2.1",
        "n": "Limpar a UI das subpáginas",
        "objetivo": "As telas da Estrutura ainda têm peças de protótipo: um botão de depuração, frases que explicam a regra, códigos internos como “(B25)” e uma tabela didática nas Configurações. A página da Lista tem 1.404 linhas, com dois componentes inteiros dentro dela. Depois desta tarefa, cada tela mostra só o que a pessoa usa.",
        "pronto": "Você abre a Lista, o Espaço, a Pasta e as Configurações e aprova cada uma; a página da Lista fica abaixo de 1.000 linhas.",
        "subs": [
          {
            "n": "Tirar o botão “Rodar agenda da Lista (hoje)” e o item “Rodar automações por vencimento (hoje)”",
            "cam": [
              "web"
            ],
            "hoje": "`RunScheduledButton` (`apps/web/src/features/estrutura/bulk-status-bar.tsx:189`) aparece em duas barras da página da Lista (`listas/[lista]/page.tsx:716`, Lista conversacional, e `:784`, Lista comum) sempre que a Lista tem Automação por vencimento ou Tarefa recorrente por calendário. Ele roda `runScheduledAutomations` e `runCalendarRecurrences` na hora, pelo navegador. No Financeiro, o menu “Automatizar” tem o mesmo gesto (`features/estrutura/financeiro/contas-view.tsx:381`). O agendador do servidor (`apps/api/src/automacoes/scheduler-worker.ts`) já roda as duas coisas sozinho.",
            "fazer": [
              "Cumprir antes a decisão abaixo, para nenhuma Lista perder a recorrência.",
              "Apagar `RunScheduledButton` de `bulk-status-bar.tsx` e as duas chamadas em `listas/[lista]/page.tsx`.",
              "Apagar o item “Rodar automações por vencimento (hoje)” do menu “Automatizar” em `contas-view.tsx`; se o menu ficar vazio, apagar o menu."
            ],
            "pronto": "Numa Lista com Tarefa recorrente por calendário, o botão não aparece; `grep -rn 'Rodar agenda' apps/web/src` e `grep -rn 'Rodar automações por vencimento' apps/web/src` não acham nada."
          },
          {
            "n": "O que roda a recorrência das Listas sem Automação depois que o botão sair?",
            "cam": [
              "dec",
              "api"
            ],
            "decisao": true,
            "hoje": "O agendador só visita as Listas que têm uma Automação publicada com gatilho `condicaoTemporal` (`scheduler-worker.ts:268–302`). Uma Lista que só tem Tarefa recorrente por calendário (`recurrence.triggerMode = porCalendario`) depende do botão para gerar a próxima ocorrência. A Sessão 19 (19.1, “Lixeira e recorrência em todas as Listas”) resolve isso, mas vem bem depois.",
            "opcoes": [
              "(A) Trazer para cá a subtarefa da 19.1: o agendador passa a visitar também as Listas com Tarefa recorrente por calendário e as com Tarefa vencida na lixeira",
              "(B) Tirar o botão da barra e deixá-lo só no menu “…” da Lista, para quem administra, até a Sessão 19",
              "(C) Tirar o botão e aceitar que a recorrência por calendário fique parada nessas Listas até a Sessão 19"
            ],
            "muda": "(A) soma cerca de meio dia aqui e tira meio dia da 19.1: muda a consulta que monta os pares (Espaço de Trabalho, Lista) em `scheduler-worker.ts`. (B) custa uma hora e deixa um gesto manual escondido. (C) não custa nada, mas Tarefas recorrentes deixam de nascer sem aviso.",
            "recomendo": "(A): é a mesma consulta que a 19.1 mudaria, e o botão sai de vez.",
            "peso": "produto"
          },
          {
            "n": "Confirmar que o agendador está ligado em produção",
            "cam": [
              "infra",
              "voce"
            ],
            "hoje": "O agendador só sobe com `AUTOMACOES_WORKER_ATIVO=true` (`apps/api/src/index.ts:192`); o exemplo de ambiente traz `false` (`apps/api/.env.example:101`). A primeira volta de cada Lista roda em ensaio e não grava até alguém liberar (`scheduler-worker.ts:39`).",
            "fazer": [
              "Conferir no ambiente de produção do `apps/api` que `AUTOMACOES_WORKER_ATIVO=true`.",
              "Liberar cada Lista em ensaio com `npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>`."
            ],
            "pronto": "O log de produção do `apps/api` mostra “scheduler de Automações ativo” (`apps/api/src/index.ts:217`) e, no dia seguinte, uma linha nova em `plataforma.automacao_agenda` para cada Lista com agenda."
          },
          {
            "n": "Juntar as duas barras de seleção em lote numa só",
            "cam": [
              "web"
            ],
            "hoje": "`BulkStatusBar` é montada em dois lugares da página da Lista: dentro da barra do Financeiro, no lugar de `FinanceToolbar`, só com itens marcados (`listas/[lista]/page.tsx:795`), e no corpo da página nas outras Listas (`:849`). O botão “Selecionar várias” está escrito duas vezes (`:702` e `:770`), e a lente financeira tem um terceiro botão, “Sair da seleção” (`:805`).",
            "fazer": [
              "Criar `apps/web/src/features/estrutura/selecao-em-lote.tsx` com o componente `SelecaoEmLote`: recebe `tasks`, `definitions`, `selecionadas`, `onSelecionar`, `onRelatorio` e `report`; desenha o botão “Selecionar várias” / “Sair da seleção” e, com itens marcados, a `BulkStatusBar`.",
              "A página monta `SelecaoEmLote` uma vez, logo abaixo das abas, nas três lentes (comum, conversacional e financeira). A barra do Financeiro passa a mostrar sempre `FinanceToolbar`.",
              "O relatório do lote continua guardado fora da seleção (`relatorioDeLote`, `page.tsx:173`), como hoje."
            ],
            "pronto": "Os testes de `bulk-status-bar.test.tsx` passam; na Lista comum e em Contas a pagar, marcar duas Tarefas mostra a mesma barra no mesmo lugar; `listas/[lista]/page.tsx` não importa mais `BulkStatusBar`."
          },
          {
            "n": "Tirar da Lista as frases de explicação e o botão que nasce desligado",
            "cam": [
              "web"
            ],
            "hoje": "A página da Lista tem: a nota sob o Quadro “Arrastar altera o Status. As validações da Lista continuam valendo…” (`listas/[lista]/page.tsx:1268`); o complemento “— o filtro vale em todas as Visualizações” depois da contagem filtrada (`:893`); as frases de ajuda ao lado do botão principal nas Listas de Meus negócios (`:680`) e na conversacional (`:697`); e o botão “De modelo” da Lista conversacional, que nasce sempre desligado com o motivo `TAREFA_SEM_CONTATO` (`:698`).",
            "fazer": [
              "Apagar a nota do Quadro e as duas frases de ajuda.",
              "Trocar a frase da contagem por “Mostrando X de Y Tarefas.”",
              "Apagar o botão “De modelo” da barra conversacional."
            ],
            "pronto": "Na Lista conversacional (Pós-venda) a barra mostra só “Nova Tarefa” e “Selecionar várias”; no Quadro de qualquer Lista não há texto abaixo das colunas."
          },
          {
            "n": "Tirar `Quadro`, `Tabela` e as barras de criação de dentro da página da Lista",
            "cam": [
              "web"
            ],
            "hoje": "As funções `Quadro` (`listas/[lista]/page.tsx:1175`, cerca de 100 linhas) e `Tabela` (`:1282`, cerca de 120 linhas) moram no arquivo da página. As três barras de criação (Meus negócios, conversacional e comum, `:668–788`) estão escritas em sequência no JSX.",
            "fazer": [
              "Mover `Quadro` para `apps/web/src/features/estrutura/quadro-de-tarefas.tsx` e `Tabela` para `apps/web/src/features/estrutura/tabela-plana.tsx`, sem mudar o comportamento.",
              "Mover as três barras de criação para `apps/web/src/features/estrutura/barra-de-criacao.tsx`, um componente `BarraDeCriacao` que recebe a lente (`comum`, `conversacional`, `espelhoComercial`, `financeira`) e os callbacks que a página já tem (`create`, `setNovaConversacional`, `setIniciandoConversa`)."
            ],
            "pronto": "`wc -l` da página dá menos de 1.000; `npm run check` passa; criar uma Tarefa pela barra e arrastar um cartão no Quadro funcionam como antes."
          },
          {
            "n": "Manter as abas Lista e Tabela separadas?",
            "cam": [
              "dec",
              "web"
            ],
            "decisao": true,
            "hoje": "As 6 abas da Lista (`listas/[lista]/page.tsx:658`): Lista (`TabelaDeTarefas`, `tabela-de-tarefas.tsx`: grupos por Status, “+” por grupo, seleção e ações rápidas; no Financeiro, `FinanceTable` e `FinanceCards`); Quadro (colunas por Status, arrastar muda o Status; na conversacional, `QuadroNegocios`); Calendário (`CalendarioMensal`); Tabela (`Tabela`: lista plana com 6 colunas fixas — Título, Status, Categoria, Prioridade, Vencimento, Responsáveis — e edição na linha de Status, Prioridade e Vencimento, sem Campos); Linha do tempo (`LinhaDoTempo`, `planning-views.tsx`); Carga (sai na 2.5). A Lista financeira esconde a Carga; a conversacional esconde a Carga e a Linha do tempo (`:660–662`). Lista e Tabela mostram quase o mesmo.",
            "opcoes": [
              "(A) Manter as duas como estão",
              "(B) Tirar a aba Tabela",
              "(C) Fazer a Tabela virar planilha: sem grupos, uma coluna por Campo da Lista, editável na célula, como a visualização Tabela do ClickUp"
            ],
            "muda": "(A) não custa nada. (B) custa uma hora; as Visualizações salvas do tipo `tabela` passam a abrir na aba Lista. (C) custa cerca de 1,5 dia e entraria na 2.7 ou numa sessão própria.",
            "recomendo": "(A) nesta sessão; (C) depois, se você sentir falta dos Campos na Tabela durante os testes.",
            "peso": "produto"
          },
          {
            "n": "Organizar as Configurações do contêiner em abas",
            "cam": [
              "web"
            ],
            "hoje": "`ContainerSettings` (`apps/web/src/features/estrutura/container-settings.tsx:91`) empilha tudo numa rolagem só, nesta ordem: a tabela “Aspectos configuráveis” (`:220`, 6 linhas com a explicação da regra e as colunas “Neste nível”, “Origem do valor” e “Como compõe”); a grade com Conjunto de Status efetivo, Funcionalidades efetivas, Definições de Campo acumuladas, Formulários (só Lista) e Tipos de Tarefa acumulados (`:274–364`); Modelo de Tarefa (só Lista, `:370`); Canais de atendimento (só Lista conversacional, `:400`); e, por último, Identidade e Ciclo de vida (`:430`). A tabela lista Visualizações padrão e Automações, que não têm editor nesta tela.",
            "fazer": [
              "Trocar a rolagem por `Abas` (`features/shell/ui`), com a aba ativa na URL (`?aba=`): Geral (Identidade, Privado, quem criou e Ciclo de vida), Status, Funcionalidades, Campos, Tipos de Tarefa, Visualizações (o editor nasce na 2.6) e, só na Lista, Formulários e “Modelo e canais”.",
              "Apagar a tabela “Aspectos configuráveis”, a constante `ASPECTS` e `REGRA_DOS_MODOS`.",
              "No topo de cada aba de aspecto, uma linha curta: “Herdado de Espaço Comercial” ou “Definido aqui”. Se um ancestral bloqueia o aspecto, “Bloqueado por Pasta X” e os editores desligados com esse motivo. O botão de bloquear nasce na 2.6."
            ],
            "pronto": "Abrir `/estrutura/listas/<id>/configuracoes?aba=campos` cai direto na aba Campos; o texto “Aspectos configuráveis” não aparece em nenhuma tela."
          },
          {
            "n": "Deixar a página do Espaço no mesmo formato da página da Pasta",
            "cam": [
              "web"
            ],
            "hoje": "A página do Espaço (`apps/web/src/app/(shell)/estrutura/espacos/[espaco]/page.tsx`) usa caixas (`Painel`): Listas diretas e atalhos, Pastas, Painéis (sempre, mesmo vazio, com a dica “Um Painel é criado em Painéis…”) e o painel lateral “Atributos” (`:147`), que só mostra Criado por e Privado. Não tem botão de criar. A página da Pasta (`pastas/[pasta]/page.tsx`) já usa seções com `ReguaDeSecao`, mostra as Tarefas abertas de cada Lista e tem o menu “Criar” (`useCreateContainerDialog`).",
            "fazer": [
              "Reescrever a página do Espaço no formato da Pasta: seções Listas (com os atalhos e a contagem de abertas) e Pastas, e o menu “Criar” com Pasta e Lista, pelo `openCreate` de `useCreateContainerDialog`.",
              "Apagar o painel “Atributos”: Privado vira um selo ao lado do título (`Pilula` “Privado”), e Criado por vai para a aba Geral das Configurações.",
              "Mostrar a seção Painéis só quando houver Painel ancorado no Espaço."
            ],
            "pronto": "Num Espaço sem Painel, a página mostra só Listas e Pastas; “Criar › Lista” abre o diálogo com o Espaço já escolhido."
          },
          {
            "n": "Tirar os códigos de regra dos textos da Estrutura",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "Há 9 códigos em texto visível em `apps/web/src/features/estrutura`: `create-container-dialog.tsx:383` (A3.4), `:428` (B38), `:441` (RN-ESP-03) e `:442` (B25); `tarefa-completa.tsx:1496` (INV-CP-01), `:1524` (RN-CR-02) e `:1537` (RN-CR-07); `financeiro/serie-dialog.tsx:117` (RN-CR-01) e `:150` (RN-CR-07). Mais 4 em recusas do domínio que chegam às telas da Estrutura: `packages/dominio/src/operations/structure.ts:430` (B47) e `operations/financeiro.ts:1810`, `:1824` e `:1827`. O de `pastas/[pasta]/page.tsx:167` está num comentário e não aparece.",
            "fazer": [
              "Apagar o código entre parênteses de cada um dos 13 textos, sem mudar o resto da frase.",
              "Criar o teste `apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts`: lê os `.tsx` de `features/estrutura` e de `app/(shell)/estrutura`, descarta comentários e falha se achar `(RN-…)`, `(INV-…)`, `(B<número>)` ou `(A<número>.<número>)`."
            ],
            "pronto": "O teste novo passa; o diálogo “Criar Espaço” mostra a ajuda sem “(RN-ESP-03)”; criar uma série de parcelas sem Centro de Custo mostra “Centro de Custo é obrigatório.”"
          }
        ]
      },
      {
        "id": "2.2",
        "n": "Otimizar o backend do CRUD de Espaço, Pasta e Lista",
        "objetivo": "Cada gravação, de um nome de Lista a um Status de Tarefa, carrega o Espaço de Trabalho inteiro, roda a operação e disputa uma única revisão por Espaço de Trabalho: duas pessoas gravando ao mesmo tempo, mesmo em coisas diferentes, fazem uma delas recomeçar do zero. A tela só mostra a mudança quando o servidor responde. Nunca se mediu quanto disso pesa; esta tarefa mede, decide e corta o custo onde ele está.",
        "pronto": "Os tempos de `createList`, `updateContainer`, `trashContainer` e `changeTaskStatus` medidos em produção antes e depois estão anotados; criar uma Lista aparece na árvore antes da resposta do servidor; duas gravações simultâneas no mesmo Espaço de Trabalho não hidratam de novo.",
        "subs": [
          {
            "n": "Medir quanto leva cada etapa de uma gravação",
            "cam": [
              "api",
              "banco"
            ],
            "hoje": "`executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`) faz, por tentativa: `hidratar` (um `select` de todo `plataforma.registros` do Espaço de Trabalho, `repositorio.ts:63`), `syncIdSequence`, a operação, o `update plataforma.workspaces set revisao = revisao + 1 where revisao = $2` e `gravar` (diff por JSON canônico de todos os registros, `repositorio.ts:161`). Nada disso é medido. O único número é o comentário de `repositorio.ts:9`, “cerca de 900 registros e 475 KB”, de antes do Financeiro e do CRM.",
            "fazer": [
              "Em `executar()`, medir com `performance.now()` a duração de `hidratar`, da operação, da trava da revisão e de `gravar`, mais o número de tentativas e de linhas lidas, e devolver isso num campo `medicao` de `ResultadoTransacao`.",
              "Em `rotasDeOperacoes` (`apps/api/src/rotas/operacoes.ts`), registrar `medicao` com `request.log.info` junto do nome da operação.",
              "Rodar em produção, 10 vezes cada: criar Lista, renomear Lista, enviar à lixeira um Espaço com Listas e mudar o Status de uma Tarefa. Anotar mediana e pior caso de cada etapa.",
              "Rodar no banco de produção: `select colecao, count(*), pg_size_pretty(sum(pg_column_size(dados))::bigint) from plataforma.registros where workspace_id = '<id>' group by colecao order by sum(pg_column_size(dados)) desc;` e anotar o total."
            ],
            "pronto": "Uma tabela com os quatro gestos e as etapas (hidratar, operação, trava, gravar, tentativas), mais o tamanho real de `plataforma.registros`, anotada nesta tarefa antes da decisão abaixo."
          },
          {
            "n": "Como otimizar?",
            "cam": [
              "dec",
              "banco",
              "api",
              "web"
            ],
            "decisao": true,
            "hoje": "Gravar um contêiner custa o mesmo que gravar uma Tarefa: hidratar tudo, operar e comparar tudo. Mas contêiner se edita pouco; o que se grava o tempo todo é Tarefa. As operações de contêiner também escrevem fora dele: `createSpace` cria Tipo de Tarefa, Pasta e concessões (`structure.ts:103–135`); `trashContainer` e `archiveContainer` fecham cronômetros das Tarefas abaixo (`structure.ts:552`). E 23 arquivos do domínio e cerca de 22 da tela leem `state.spaces`, `state.folders` e `state.lists` direto do `DataState`.",
            "opcoes": [
              "(A) Tabelas próprias só para Espaço, Pasta e Lista, com rotas REST como as do CRM e uma projeção que os devolve ao `DataState`",
              "(B) Ficar em `plataforma.registros` e cortar o custo onde ele está: travar no começo em vez de repetir, encadear as chamadas de um gesto e mostrar a mudança na hora",
              "(C) Tabelas próprias para a Estrutura inteira (contêineres e Tarefas), numa sessão nova depois desta"
            ],
            "muda": "(A) custa 4 a 5 dias: migração, repositório, serviço, rotas, projeção de leitura e escrita (como a dos Canais) e troca das telas. Só acelera a gravação de contêiner, que é rara; a de Tarefa continua igual. (B) custa cerca de 2 dias e vale para toda gravação, Tarefa inclusive. (C) é o que resolve de vez, mas são 8 a 10 dias e mexe na maior parte do domínio.",
            "recomendo": "(B) agora. Se a medição mostrar `hidratar` acima de 300 ms na mediana, planejar (C) como sessão própria. (A) não compensa: paga o preço de uma migração para acelerar o gesto menos usado.",
            "peso": "produto"
          },
          {
            "n": "Travar o Espaço de Trabalho no começo da transação em vez de repetir a gravação",
            "cam": [
              "api"
            ],
            "hoje": "`executar()` lê a revisão, hidrata, roda a operação e só no fim tenta `update plataforma.workspaces … where revisao = $2` (`unidade-de-trabalho.ts:162`). Se outra gravação entrou no meio, desfaz e recomeça, até 3 vezes: quem perde hidrata o Espaço de Trabalho de novo, e no terceiro conflito a tela recebe 409 e re-hidrata tudo por `GET /estado` (`apps/web/src/dados/store.ts:172`).",
            "fazer": [
              "Logo depois de `inicioDaTransacao()`, rodar `select revisao from plataforma.workspaces where workspace_id = $1 for update` e só então `hidratar`.",
              "O `update … revisao = revisao + 1` deixa de conferir a revisão (a linha já está travada). O `55P03` do `lock_timeout` continua virando conflito, como manda `apps/api/src/persistencia/CONTEXT.md`.",
              "Atualizar a seção “Os prazos do servidor e a trava esgotada” do `CONTEXT.md` da persistência."
            ],
            "pronto": "Um teste novo em `unidade-de-trabalho-trava.test.ts` dispara duas `executar()` ao mesmo tempo no mesmo Espaço de Trabalho: as duas gravam com uma tentativa cada e `hidratar` roda exatamente 2 vezes (pula sem `DATABASE_URL`, como os outros).",
            "nota": "Só com (B)."
          },
          {
            "n": "Aplicar todas as respostas de um gesto com várias chamadas, sem re-hidratar",
            "cam": [
              "web"
            ],
            "hoje": "Quando um `run` chama mais de uma operação, `transporteHttp.gravar` (`apps/web/src/dados/transporte.ts:171`) manda as chamadas em sequência, todas com a mesma `pedido.revisao`, e devolve só a última resposta. O store compara a `revisaoAnterior` dessa última com a sua (`store.ts:129`), elas não batem, e ele re-hidrata o Espaço de Trabalho inteiro. O caso conhecido é `(shell)/page.tsx` (cria a Sessão de Chat e manda a mensagem). A ação em lote de Status não entra aqui: é uma operação só, `alterarStatusEmLote`.",
            "fazer": [
              "`gravar` passa a devolver a lista de respostas, uma por chamada, parando na primeira que não for `diferenca`.",
              "`enviar` (`store.ts:123`) aplica as diferenças em ordem: cada uma só se a `revisaoAnterior` dela for a revisão atual do store; se uma não encaixar, aí sim re-hidrata."
            ],
            "pronto": "Um teste em `apps/web/src/dados/store.test.ts` com transporte falso: um `run` com duas chamadas aplica as duas diferenças e não chama `hidratar`.",
            "nota": "Só com (B)."
          },
          {
            "n": "Mostrar a mudança na tela antes da resposta do servidor",
            "cam": [
              "web"
            ],
            "hoje": "`rodarNaCopia` (`apps/web/src/dados/store.ts:205`) roda a operação numa cópia, manda as chamadas e descarta a cópia: o `data` real só muda quando a diferença volta (`store.ts:142`). Criar uma Lista pelo diálogo (`features/estrutura/create-container-dialog.tsx:217`) espera essa volta para navegar.",
            "fazer": [
              "O store guarda dois estados: `confirmado` (o que o servidor já devolveu) e `data` (o que a tela mostra). Uma operação aceita localmente vira o novo `data` na hora.",
              "Quando a diferença volta, aplicá-la em `confirmado` e refazer por cima as chamadas ainda pendentes, pelo registro `OPERACOES` (`@n1/dominio/operations/registro`), para obter o novo `data`.",
              "Se o servidor recusar, `data` volta a ser `confirmado` mais as pendentes, e `lastResult` mostra o erro, como hoje.",
              "O diálogo de criação continua esperando o id do servidor para navegar (`runConfirmado`), mas a árvore (`StructureTree`, `features/shell/app-shell.tsx:600`) já mostra a Lista nova."
            ],
            "pronto": "Um teste em `store.test.ts` com transporte lento: depois de `run(createList)`, `data.lists` já tem a Lista antes de o transporte responder; se o transporte devolver `ok: false`, a Lista some e `lastResult.error` traz a mensagem.",
            "nota": "Só com (B). O empurrão de mudanças entre telas abertas (trocar a pergunta a cada 5 s por tempo real) é da 3.4."
          },
          {
            "n": "Criar as tabelas de Espaço, Pasta e Lista",
            "cam": [
              "banco"
            ],
            "hoje": "Espaço, Pasta e Lista são linhas de `plataforma.registros` com `colecao` igual a `spaces`, `folders` ou `lists` e o objeto inteiro em `dados` (jsonb).",
            "fazer": [
              "Migração nova com `plataforma.espacos`: `workspace_id`, `id`, `nome`, `descricao`, `icone`, `cor`, `ordem` (double precision), `privado` (boolean), `estado` (`ativo`, `arquivado`, `naLixeira`), `estado_antes_da_lixeira`, `arquivado_em`, `na_lixeira_em`, `modos` (jsonb), `bloqueios` (jsonb), `conjunto_de_status` (jsonb, obrigatório), `funcionalidades` (jsonb), `visualizacoes_padrao` (jsonb), `atalhos` (jsonb), `campos_herdados_fora` (jsonb), `proveniencia` (jsonb), `criado_por` (jsonb), `criado_em`, `atualizado_em`, chave `(workspace_id, id)`.",
              "`plataforma.pastas`: as mesmas colunas (sem `atalhos`, com `conjunto_de_status` opcional) mais `pai_tipo` (`space` ou `folder`), `pai_id`, `espaco_id` e `sprint` (jsonb).",
              "`plataforma.listas`: as colunas comuns (sem `bloqueios`) mais `pai_tipo`, `pai_id`, `espaco_id`, `modelo_de_tarefa`, `canais_de_atendimento`, `periodo_planejado`, `campos_editaveis_por_convidado` e `compartilhada_por_campos` (jsonb).",
              "Índice único do nome entre irmãos fora da lixeira, com a mesma regra de `nameTaken` (`structure.ts:33`: sem diferença de maiúsculas).",
              "Copiar os dados de `plataforma.registros` para as três tabelas e apagar as linhas copiadas na mesma migração."
            ],
            "pronto": "`npm run migrar -w @n1/api -- --seco` lista a migração; aplicada em homologação, `select count(*)` de cada tabela bate com o de `plataforma.registros` antes dela.",
            "nota": "Só com (A)."
          },
          {
            "n": "Criar o serviço e as rotas REST de contêiner",
            "cam": [
              "api"
            ],
            "hoje": "Tudo passa por `POST /operacoes/:nome` com `createSpace`, `createFolder`, `createList`, `updateContainer`, `archiveContainer`, `unarchiveContainer`, `trashContainer` e `restoreContainer` (`apps/api/src/rotas/esquemas/estrutura.ts:92–99`).",
            "fazer": [
              "`apps/api/src/repositorios/estrutura/conteineres.ts`: o SQL das três tabelas, no padrão de `repositorios/crm/funis.ts`.",
              "`apps/api/src/servicos/estrutura/conteineres.ts`: numa transação, trava o Espaço de Trabalho, monta o `DataState` com os contêineres das tabelas e o resto de `plataforma.registros`, roda a operação que já existe em `structure.ts` (a regra fica onde está), grava os contêineres nas tabelas e o resto (Tipos de Tarefa, concessões, Atividade, Tarefas da cascata) em `plataforma.registros`, e soma 1 à revisão do Espaço de Trabalho.",
              "Rotas em `apps/api/src/rotas/estrutura/`: `GET`/`POST /espacos`, `PATCH /espacos/:id`, `POST /espacos/:id/arquivar`, `/desarquivar`, `/restaurar`, `DELETE /espacos/:id` (lixeira), e o mesmo para `/pastas` e `/listas`.",
              "Tirar as 8 operações de `POST /operacoes/:nome`: o nome devolve 404 dizendo a rota nova."
            ],
            "pronto": "Testes em `apps/api/src/rotas/estrutura/*.test.ts` no padrão dos do CRM: criar, editar, arquivar e enviar à lixeira cada um, e `POST /operacoes/createList` devolve 404.",
            "nota": "Só com (A)."
          },
          {
            "n": "Projetar os contêineres das tabelas no `DataState`",
            "cam": [
              "api"
            ],
            "hoje": "Os Canais da 008 fazem isso (`apps/api/src/persistencia/canais-projetados.ts`): entram em `GET /estado` e em `executar()`, nunca em `hidratar()`.",
            "fazer": [
              "Criar `apps/api/src/persistencia/conteineres-projetados.ts` no mesmo formato: carregar as três tabelas para `state.spaces`, `state.folders` e `state.lists` em `rotas/estado.ts` e em `executar()`.",
              "Ao contrário dos Canais, a projeção também escreve: `overrideStatusSet`, `setContainerFeature`, `alterarModeloDaLista` e `definirCanaisDaLista` mudam o contêiner por `POST /operacoes`. Comparar a fotografia de antes com a de depois e gravar o que mudou nas tabelas, e tirar os projetados do estado antes de `gravar()`."
            ],
            "pronto": "Um teste prova que `setContainerFeature` por `POST /operacoes` grava em `plataforma.listas` e que nenhuma linha `colecao = 'lists'` volta para `plataforma.registros`.",
            "nota": "Só com (A)."
          },
          {
            "n": "Trocar as telas de contêiner para as rotas novas",
            "cam": [
              "web"
            ],
            "hoje": "O diálogo de criação (`create-container-dialog.tsx:217`) e a Identidade e o Ciclo de vida (`identidade-e-ciclo-de-vida.tsx:68`, `:206`, `:217`, `:241`, `:262`) chamam as operações por `run`/`runConfirmado`.",
            "fazer": [
              "Criar `apps/web/src/dados/estrutura/conteineres.ts` com `criarEspaco`, `criarPasta`, `criarLista`, `editarConteiner`, `arquivar`, `desarquivar`, `enviarParaLixeira` e `restaurar`, sobre um `chamarApi` igual a `chamarCrm` (`dados/crm/cliente-crm.ts:50`).",
              "As duas telas passam a chamá-las; depois de cada uma, o store aplica o registro devolvido em `data` (uma função nova `aplicarRegistro` em `store.ts`)."
            ],
            "pronto": "Criar uma Lista pela tela grava uma linha em `plataforma.listas` e nenhuma em `plataforma.registros`.",
            "nota": "Só com (A)."
          },
          {
            "n": "Medir de novo depois da mudança",
            "cam": [
              "api"
            ],
            "hoje": "Os números de antes ficam anotados na primeira subtarefa.",
            "fazer": "Repetir as mesmas medições, com os mesmos quatro gestos, depois do que a decisão escolheu.",
            "pronto": "A tabela desta tarefa tem as colunas “antes” e “depois” preenchidas."
          }
        ]
      },
      {
        "id": "2.3",
        "n": "Mover e reordenar Pastas e Listas",
        "objetivo": "Hoje só a Tarefa se move (`moveTask`, `packages/dominio/src/operations/tasks.ts:469`); Pasta e Lista ficam para sempre onde nasceram, e a ordem é a de criação. A ontologia descreve mover, promover, rebaixar e reordenar (RN-ESP-19, RN-SUB-11 e RN-SUB-12, “Reordenar” em `ontologia/02-estrutura-de-trabalho/espaco.md:222`). Esta tarefa cria as duas operações e o gesto na árvore.",
        "pronto": "Arrastar uma Lista para outra Pasta na árvore leva as Tarefas junto, pede o mapeamento de Status quando o Conjunto muda, e a ordem nova continua depois de recarregar.",
        "subs": [
          {
            "n": "Criar a operação `moveContainer` para Pasta e Lista",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe. `parentType` e `parentId` são `readonly` em `Folder` e `List` (`packages/dominio/src/types/structure.ts:221` e `:232`).",
            "fazer": [
              "Tirar `readonly` de `parentType` e `parentId` em `Folder` e `List`.",
              "Criar `moveContainer(state, actingMemberId, tipo: \"folder\" | \"list\", id, destino: { parentType, parentId }, mapeamento?: StatusMapping[])` em `structure.ts`, reusando `StatusMapping` de `tasks.ts:455`.",
              "Recusar quando: falta `administrar` no movido ou `criar` no destino; o destino não está efetivamente ativo; o nome já existe entre os irmãos do destino (`nameTaken`); uma Pasta com Subpastas iria para dentro de outra Pasta (RN-SUB-11) ou qualquer Pasta iria para dentro de uma Subpasta (RN-SUB-02); o destino bloqueia um aspecto que o movido ou um descendente sobrescreve (RN-ESP-09, via `blockedAbove`); o destino fica no mesmo lugar ou abaixo do próprio movido.",
              "Se o Conjunto de Status herdado muda, exigir o mapeamento de cada Status em uso nas Tarefas abaixo, como `moveTask` faz, e aplicá-lo.",
              "Valores de Campo cujas Definições deixam de valer passam a `state: \"arquivado\"` (B37), como em `moveTask`.",
              "Uma Pasta que vai para o Espaço vira Pasta de nível 1 (“Subpasta promovida a Pasta”); uma Pasta sem Subpastas que vai para outra Pasta vira Subpasta (“Pasta rebaixada a Subpasta”). Cada caso grava a Atividade com esse nome; os outros gravam “Lista movida” ou “Pasta movida”, com origem e destino em `before` e `after`.",
              "Registrar em `operations/registro.ts`, `operations/index.ts` e no esquema `apps/api/src/rotas/esquemas/estrutura.ts` (sem esquema o `satisfies EsquemasCompletos` não compila)."
            ],
            "pronto": "Um teste novo `packages/dominio/src/operations/mover-conteiner.test.ts` cobre: Lista para outra Pasta com o mesmo Conjunto (as Tarefas ficam e não mudam de Status); para um Espaço com outro Conjunto sem mapeamento (recusa) e com mapeamento (Status trocados); Campo que deixa de valer (Valor arquivado); Pasta com Subpastas para dentro de Pasta (recusa); promoção e rebaixamento (Atividade com o nome certo); destino que bloqueia Status sobrescrito no movido (recusa)."
          },
          {
            "n": "Criar a operação `reorderContainers`",
            "cam": [
              "dom"
            ],
            "hoje": "`order` nasce como o número de irmãos na criação (`structure.ts:93`, `:227`, `:352`) e nenhuma operação a muda. A árvore ordena por `order` (`features/shell/app-shell.tsx:645`).",
            "fazer": [
              "Criar `reorderContainers(state, actingMemberId, pai: { type: \"workspace\" | \"space\" | \"folder\", id }, ids: Id[])` em `structure.ts`: recebe a permutação completa dos irmãos (Pastas e Listas do mesmo pai, ou os Espaços do Espaço de Trabalho), como `PUT /funis/:id/etapas/ordem` faz com as Etapas.",
              "Recusar se faltar ou sobrar id, se faltar `editar` no pai, ou se o pai não estiver ativo; gravar uma Atividade “Ordem alterada” no pai.",
              "Registrar em `registro.ts`, `index.ts` e `esquemas/estrutura.ts`."
            ],
            "pronto": "Teste em `mover-conteiner.test.ts`: reordenar três Listas de uma Pasta grava `order` 0, 1 e 2 na ordem pedida, e uma lista de ids incompleta é recusada."
          },
          {
            "n": "Arrastar e soltar na árvore e “Mover para…” no menu",
            "cam": [
              "web"
            ],
            "hoje": "A árvore (`StructureTree`, `features/shell/app-shell.tsx:600`, com `TreeSpace` `:667`, `TreeFolder` `:764`, `TreeList` `:840` e o menu de cada item em `TreeRow` `:1040`, com o `ActionMenu` em `:1140`) não arrasta nada. A árvore de Chat ao lado já move Sessão entre pastas (`moveChatSessionToFolder`, `app-shell.tsx:931`).",
            "fazer": [
              "Arrastar uma Lista ou Pasta sobre outro item da árvore: soltar no meio de um Espaço ou Pasta chama `moveContainer`; soltar entre dois irmãos chama `reorderContainers`.",
              "Item “Mover para…” no menu de Pasta e de Lista, abrindo um diálogo novo `features/estrutura/mover-conteiner-dialog.tsx` com a escolha do destino; quando o Conjunto de Status muda, o diálogo mostra a tabela de mapeamento, no mesmo formato de `move-task-dialog.tsx`.",
              "A recusa do domínio aparece no diálogo ou num `Toast`, sem mover nada."
            ],
            "pronto": "Arrastar a Lista “Propostas” para a Pasta “Clientes” na árvore move a Lista e as Tarefas dela; arrastar uma Pasta com Subpastas para dentro de outra Pasta mostra a recusa e nada muda."
          }
        ]
      },
      {
        "id": "2.4",
        "n": "Converter item do checklist em Subtarefa",
        "objetivo": "A conversão existe e funciona, mas assusta e engana: o botão é vermelho, a confirmação exige digitar o nome do item, o botão aparece numa Lista sem Subtarefas e no limite de níveis, e a mensagem de limite pede uma escolha que a tela não oferece. Subitem de checklist nem aparece na tela, e nenhuma operação o cria. Depois desta tarefa, o botão só aparece quando dá para converter, e converter é um clique e uma confirmação.",
        "pronto": "Numa Lista com Subtarefas, converter um item cria a Subtarefa e o aviso leva até ela; numa Lista sem Subtarefas ou numa Tarefa no último nível, o botão não aparece.",
        "subs": [
          {
            "n": "Criar no domínio a recusa da conversão antes do clique",
            "cam": [
              "dom"
            ],
            "hoje": "As recusas só aparecem depois da confirmação: `convertChecklistItem` (`packages/dominio/src/operations/tasks.ts:590`) recusa o item de segundo nível (`:606`) e o nível acima de `state.workspace.maxSubtaskDepth` (`:612`), e quem recusa a Lista sem Subtarefas é o `createTask` chamado por dentro (`tasks.ts:137`, “Esta Lista não usa Subtarefas.”).",
            "fazer": [
              "Criar `conversaoDeItemRecusada(state, actingMemberId, taskId)` em `packages/dominio/src/derive.ts`, devolvendo o motivo ou `undefined`: sem escrita na Tarefa, `features.subtarefas` desligada na Lista, ou `taskLevel(state, task) + 1 > state.workspace.maxSubtaskDepth` (`derive.ts:307`).",
              "`convertChecklistItem` passa a chamar essa função primeiro.",
              "Trocar a mensagem de `tasks.ts:614` (“Escolha outra Tarefa pai ou converta a partir de um nível acima.”) por “Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui.”"
            ],
            "pronto": "Teste em `packages/dominio/src/operations/operations.test.ts`: `conversaoDeItemRecusada` devolve o motivo para Lista sem Subtarefas e para Tarefa no nível máximo, e `undefined` numa Tarefa de primeiro nível com Subtarefas ligadas; a mensagem nova aparece na recusa de `convertChecklistItem`."
          },
          {
            "n": "Mostrar o botão só quando a conversão é possível, na cor normal",
            "cam": [
              "web"
            ],
            "hoje": "Em `apps/web/src/features/estrutura/tarefa-completa.tsx:1783` o botão “Converter em Subtarefa” aparece sempre que a Tarefa é editável, com `style={{ color: \"var(--erro)\" }}` (`:1789`). A confirmação é `destructive` (`:802`), exige digitar o texto do item (`:803–820`) e, ao converter, usa `run` e mostra “Item convertido em Subtarefa: X” sem caminho até ela (`:410–416`).",
            "fazer": [
              "Mostrar o botão só se `conversaoDeItemRecusada` devolver `undefined`.",
              "Tirar a cor de erro do botão e o `destructive` da confirmação.",
              "Trocar `run` por `runConfirmado` e pôr no aviso o link “Abrir” para a Subtarefa, com o id que o servidor devolveu.",
              "A confirmação por texto digitado segue a decisão abaixo."
            ],
            "pronto": "Numa Lista sem Subtarefas o botão não aparece; numa com Subtarefas ele aparece na cor normal, converter mostra o aviso com “Abrir”, e o link abre a Subtarefa nova."
          },
          {
            "n": "Manter a confirmação por nome digitado?",
            "cam": [
              "dec",
              "web"
            ],
            "decisao": true,
            "hoje": "Para converter, a pessoa digita o texto inteiro do item (`tarefa-completa.tsx:803`). A conversão não tem volta, mas não apaga nada: o item fica marcado como convertido, com o link para a Subtarefa. No ClickUp, converter é um clique no menu do item.",
            "opcoes": [
              "(A) Manter a digitação do nome",
              "(B) Confirmar com um clique, sem digitar, com o aviso de que não há volta",
              "(C) Converter direto, sem confirmação"
            ],
            "muda": "(A) não muda nada. (B) e (C) custam minutos. Com (C), um clique errado deixa uma Subtarefa a mais para enviar à lixeira.",
            "recomendo": "(B).",
            "peso": "produto"
          },
          {
            "n": "O que fazer com os subitens de checklist?",
            "cam": [
              "dec",
              "dom",
              "web"
            ],
            "decisao": true,
            "hoje": "O tipo prevê subitem (`ChecklistItem.parentItemId`, `types/structure.ts:282`), e `convertChecklistItem` leva os subitens para um Checklist da Subtarefa nova (`tasks.ts:627`). Mas nenhuma operação cria subitem (`addChecklistItem`, `tasks.ts:896`, não aceita pai), nenhum seed tem subitem, e a Tarefa completa esconde os que existirem (`tarefa-completa.tsx:1693`). Na prática, subitem não existe.",
            "opcoes": [
              "(A) Criar subitens: `addChecklistItem` aceita `parentItemId`, a tela mostra o subitem recuado sob o item, e um subitem também pode virar Subtarefa",
              "(B) Deixar subitens fora: tirar `parentItemId` do tipo e a migração de subitens de `convertChecklistItem`"
            ],
            "muda": "(A) custa cerca de 1 dia (domínio, esquema da API e tela) e entra nesta tarefa. (B) custa uma hora e simplifica o modelo; se um dia quiser subitens, eles voltam como trabalho novo.",
            "recomendo": "(B) nesta sessão: ninguém usa subitem hoje, e o checklist de um nível cobre os seus testes.",
            "peso": "produto"
          },
          {
            "n": "Converter também pelo cartão do Quadro?",
            "cam": [
              "dec",
              "web"
            ],
            "decisao": true,
            "hoje": "Só dá para converter com a Tarefa aberta (página, popup ou drawer, todos pela `tarefa-completa.tsx`). O cartão do Quadro (`features/estrutura/cartao-de-tarefa.tsx`) não mostra os itens do checklist.",
            "opcoes": [
              "(A) Sim: o cartão ganha um menu com os itens do checklist e “Converter em Subtarefa”",
              "(B) Não: só com a Tarefa aberta"
            ],
            "muda": "(A) custa cerca de meio dia de tela. (B) não custa nada.",
            "recomendo": "(B): para converter a pessoa precisa ver o item no contexto, e a Tarefa aberta dá esse contexto.",
            "peso": "arrumacao"
          }
        ]
      },
      {
        "id": "2.5",
        "n": "Remover a visualização de carga",
        "objetivo": "A aba Carga soma a estimativa das Tarefas por Responsável e por semana, contra a capacidade semanal de cada Membro. Você pediu para tirá-la. Ela está espalhada por domínio, API e tela, e há Visualizações salvas que podem guardar o tipo `carga` no banco.",
        "pronto": "Nenhuma Lista oferece a Carga; a API recusa salvar uma Visualização do tipo `carga`; nenhuma Visualização gravada tem esse tipo.",
        "subs": [
          {
            "n": "Tirar o tipo `carga` e o cálculo `workload` do domínio",
            "cam": [
              "dom"
            ],
            "hoje": "`View.kind` aceita `carga` (`packages/dominio/src/types/structure.ts:111`). `workload()` e `WorkloadCell` estão em `packages/dominio/src/derive.ts:1196–1227`. O teste “Carga: estimativa cai na semana do vencimento…” está em `operations/operations.test.ts:3361`.",
            "fazer": [
              "Tirar `carga` da união `View.kind`.",
              "Apagar `workload` e `WorkloadCell` de `derive.ts`. `weekStartOf` (`derive.ts:1173`) fica: a Linha do tempo usa (`planning-views.tsx:71`).",
              "Apagar do teste de `operations.test.ts:3361` a parte da carga; a parte de capacidade segue a decisão abaixo."
            ],
            "pronto": "`npm run check` passa; `grep -rn workload packages apps --include='*.ts' --include='*.tsx'` não acha nada fora de `node_modules`."
          },
          {
            "n": "Tirar `carga` do esquema da API",
            "cam": [
              "api"
            ],
            "hoje": "`VIEW_KIND` em `apps/api/src/rotas/esquemas/escala.ts:12` aceita `carga`, e a linha `:104` confere que o esquema é igual ao tipo do domínio.",
            "fazer": "Tirar `carga` de `VIEW_KIND`; a conferência de `:104` passa a valer sozinha.",
            "pronto": "Um teste em `apps/api/src/rotas/esquemas/escala.test.ts` prova que `saveView` com `kind: carga` é recusado com 400."
          },
          {
            "n": "Trocar as Visualizações gravadas do tipo `carga` para `lista`",
            "cam": [
              "banco"
            ],
            "hoje": "Uma Visualização salva com a aba Carga aberta guarda `kind: carga` em `plataforma.registros` (`colecao = 'views'`). Depois da mudança, `abaDaView` (`apps/web/src/features/estrutura/tipo-de-visualizacao.ts:22`) devolveria uma aba que não existe.",
            "fazer": [
              "Contar antes: `select count(*) from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga';`.",
              "Migração nova (só dados): `update plataforma.registros set dados = jsonb_set(dados, '{kind}', '\"lista\"') where colecao = 'views' and dados->>'kind' = 'carga';`. Pode ser a mesma migração de dados da 2.6 (Listas sem `blocks`)."
            ],
            "pronto": "Depois da migração, a contagem acima dá 0."
          },
          {
            "n": "Tirar a aba Carga da tela",
            "cam": [
              "web"
            ],
            "hoje": "A aba está em `listas/[lista]/page.tsx:658` (com os filtros das lentes em `:660` e `:662`) e desenha `CargaDeTrabalho` (`:993`; componente em `features/estrutura/planning-views.tsx:293`). `TipoDeAba` e `ROTULO_DA_ABA` têm `carga` (`tipo-de-visualizacao.ts:11` e `:19`). Não há teste de tela da Carga.",
            "fazer": [
              "Tirar `carga` de `TipoDeAba` e de `ROTULO_DA_ABA`.",
              "Tirar `carga` do array de abas da página e simplificar os dois filtros: a financeira deixa de filtrar; a conversacional filtra só `linha`.",
              "Apagar `CargaDeTrabalho` de `planning-views.tsx` e os imports que sobrarem (`workload`, `memberCapacityMinutes`)."
            ],
            "pronto": "A Lista mostra 5 abas (Lista, Quadro, Calendário, Tabela, Linha do tempo); a Lista conversacional mostra 4."
          },
          {
            "n": "A capacidade semanal do Membro sai junto?",
            "cam": [
              "dec",
              "dom",
              "web"
            ],
            "decisao": true,
            "hoje": "Cada Membro tem `weeklyCapacityMinutes` (`packages/dominio/src/types/workspace.ts:128`), editado por `setMemberCapacity` (`operations/planning.ts:42`) no `CapacityEditor` (`app/(shell)/configuracoes/membros/page.tsx:468`) e mostrado na coluna “Capacidade/sem” (`:346`). Só a Carga lê esse número.",
            "opcoes": [
              "(A) Sai junto: tipo, operação, esquema da API, editor e coluna",
              "(B) Fica, para um uso futuro"
            ],
            "muda": "(A) custa cerca de uma hora: tira `weeklyCapacityMinutes`, `memberCapacityMinutes`, `setMemberCapacity` (de `planning.ts`, `registro.ts`, `index.ts` e `apps/api/src/rotas/esquemas/planejamento.ts`), o `CapacityEditor`, a coluna e o trecho de capacidade do teste de `operations.test.ts:3373–3376`. (B) deixa um campo na tela de Membros que não muda nada.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          }
        ]
      },
      {
        "id": "2.6",
        "n": "Fechar as lacunas do modelo da Estrutura",
        "objetivo": "Comparando o modelo com o artefato “Estrutura de Trabalho N1” e com a ontologia, faltam cinco coisas: as Visualizações padrão do Espaço não têm onde morar; a Lista aceita bloqueio, que não tem efeito nela; nenhuma operação grava bloqueio; a descrição da Tarefa não aceita menção e o histórico não guarda o texto anterior; e o tempo registrado é somado só na tela, de dois jeitos diferentes. Cada lacuna sai com tipo, operação, teste e tela.",
        "pronto": "Mudar as Visualizações no Espaço muda as abas das Listas abaixo; bloquear os Status num Espaço impede uma Lista de mudá-los; uma menção na descrição avisa a pessoa; o histórico mostra o texto anterior da descrição; e a Tarefa e o seu editor de tempo mostram o mesmo total.",
        "subs": [
          {
            "n": "Criar as Visualizações padrão no Espaço, herdadas pelas Listas",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`defaultViews` existe só como nome de aspecto (`ConfigurableAspect`, `types/structure.ts:84`) e como linha da tabela das Configurações; não há campo nem operação. Hoje a Lista abre na Visualização salva marcada `isDefault` dela, ou na aba Lista (`listas/[lista]/page.tsx:121–124`), e as abas são fixas. A ontologia diz que o Espaço define “quais tipos de Visualização estão disponíveis e qual é a inicial nas Listas descendentes que herdam” (`ontologia/02-estrutura-de-trabalho/espaco.md:94`), e que o aspecto substitui (RN-ESP-08).",
            "fazer": [
              "Em `types/structure.ts`: `type TipoDeVisualizacao = View[\"kind\"]` e `interface VisualizacoesPadrao { disponiveis: TipoDeVisualizacao[]; inicial: TipoDeVisualizacao }`; campo opcional `defaultViews?: VisualizacoesPadrao` em `StructuralContainerBase`; campo `views: VisualizacoesPadrao` em `EffectiveListConfig`.",
              "Constante `VISUALIZACOES_DA_PLATAFORMA` (as cinco abas, inicial `lista`) para o Espaço que ainda não definiu: assim os dados atuais não precisam de migração.",
              "`effectiveContainerConfig` (`derive.ts:176`) resolve `views` pelo ponto de definição mais próximo, como faz com `features`.",
              "Operação `setContainerDefaultViews(state, actingMemberId, tipo, id, valor | null)` em `operations/configuration.ts`, ao lado de `setContainerFeature` (`:825`): exige administrar, contêiner ativo e `blockedAbove(…, \"defaultViews\")` vazio; recusa `disponiveis` vazio e `inicial` fora de `disponiveis`; `null` volta a herdar; grava `modes.defaultViews` e uma Atividade “Visualizações padrão alteradas” com antes e depois.",
              "`saveView` (`operations/scale.ts:117`) recusa salvar uma Visualização de tipo que a Lista não tem disponível.",
              "Registrar em `registro.ts`, `index.ts` e `apps/api/src/rotas/esquemas/configuracao.ts`."
            ],
            "pronto": "Teste novo `packages/dominio/src/operations/visualizacoes-padrao.test.ts`: o Espaço tira o Calendário e as Listas abaixo deixam de tê-lo; uma Pasta sobrescreve e a Lista dela segue a Pasta; `null` volta ao Espaço; `inicial` fora de `disponiveis` é recusado; `saveView` de tipo indisponível é recusado."
          },
          {
            "n": "Usar as Visualizações padrão na Lista e editá-las nas Configurações",
            "cam": [
              "web"
            ],
            "hoje": "As abas são uma lista fixa em `listas/[lista]/page.tsx:658`, filtrada só pela lente (financeira, conversacional). Não há editor.",
            "fazer": [
              "A página monta as abas de `config.views.disponiveis`, ainda filtradas pela lente.",
              "A aba inicial passa a ser: a Visualização salva `isDefault` da Lista, se o tipo dela estiver disponível; senão, `config.views.inicial`.",
              "Aba “Visualizações” nas Configurações (a da 2.1): uma caixa por tipo e a escolha da inicial, chamando `setContainerDefaultViews`, com “Voltar a herdar” quando o contêiner tem definição própria."
            ],
            "pronto": "Desmarcar “Calendário” nas Configurações do Espaço Entrega faz a aba sumir de todas as Listas dele; escolher “Quadro” como inicial faz as Listas sem Visualização padrão própria abrirem no Quadro."
          },
          {
            "n": "Tirar o bloqueio da Lista",
            "cam": [
              "dom",
              "banco"
            ],
            "hoje": "`blocks` está em `StructuralContainerBase` (`types/structure.ts:184`), herdado também por `List`, e `createList` grava `blocks: {}` (`operations/structure.ts:358`). Bloquear impede os níveis ABAIXO de sobrescrever; abaixo da Lista só há Tarefa, que nunca define nada (ontologia, `espaco.md:344`). Bloqueio na Lista não tem efeito.",
            "fazer": [
              "Mover `blocks` de `StructuralContainerBase` para `Space` e `Folder`.",
              "Tirar `blocks: {}` de `createList` e de `solicitacao-de-pagamento-evolver.ts:158`.",
              "Em `blockedAbove` (`configuration.ts:42`) e em `instantiateListTemplate` (`operations/planning.ts:391`), ler `blocks` só de Espaço e Pasta.",
              "Na migração de dados da 2.5: `update plataforma.registros set dados = dados - 'blocks' where colecao = 'lists';`."
            ],
            "pronto": "`npm run check` passa (o tipo não deixa escrever `blocks` numa Lista); depois da migração, `select count(*) from plataforma.registros where colecao = 'lists' and dados ? 'blocks'` dá 0."
          },
          {
            "n": "Tirar o modo `bloqueado` que ninguém grava",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "`InheritanceMode` tem `herdado`, `sobrescrito` e `bloqueado` (`types/structure.ts:73`), e o bloqueio também mora em `blocks`. Nenhum código grava `modes[…] = \"bloqueado\"`; só `container-settings.tsx` lê, para pintar a etiqueta. Um contêiner pode sobrescrever e bloquear ao mesmo tempo, coisa que um modo único não expressa.",
            "fazer": [
              "Tirar `bloqueado` de `InheritanceMode`; o bloqueio fica só em `blocks`.",
              "Tirar `MODE_LABEL.bloqueado` de `container-settings.tsx` (a tabela já sai na 2.1)."
            ],
            "pronto": "`grep -rn 'bloqueado' packages/dominio/src/types/structure.ts` não acha nada; `npm run check` passa."
          },
          {
            "n": "Criar a operação `setContainerBlock` e o botão de bloquear",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`blockedAbove` confere o bloqueio ao sobrescrever Status (`configuration.ts:660`), ao criar Campo (`:146`), ao criar Tipo de Tarefa (`:737`), ao mudar Funcionalidade (`:838`) e ao instanciar Template de Lista (`planning.ts:389`). Não confere ao criar Automação (`criarAutomacao`, `operations/ia/automacoes-editor.ts:194`). Nenhuma operação grava `blocks`: só o seed (`seed.ts:290`).",
            "fazer": [
              "Criar `setContainerBlock(state, actingMemberId, tipo: \"space\" | \"folder\", id, aspecto, bloqueado: boolean)` em `configuration.ts`: exige administrar e contêiner ativo.",
              "Para os aspectos que substituem (`statusSet`, `features`, `defaultViews`), recusar enquanto algum descendente sobrescrever o aspecto, e listar quais na mensagem (RN-ESP-09). Para os que acumulam (`fieldDefinitions`, `taskTypes`, `automations`), bloquear vale só para o que for criado depois.",
              "Função auxiliar `sobrescritasAbaixo(state, tipo, id, aspecto)` em `derive.ts`, usada pela operação e pela tela.",
              "Passar a chamar `blockedAbove(…, \"automations\")` em `criarAutomacao` quando o escopo for Pasta ou Lista.",
              "Atividade “Aspecto bloqueado” / “Aspecto desbloqueado” com o aspecto em `detail`.",
              "Registrar em `registro.ts`, `index.ts` e `esquemas/configuracao.ts`.",
              "Nas abas de aspecto das Configurações de Espaço e Pasta (2.1), um interruptor “Bloquear para os níveis abaixo”; com sobrescritas abaixo, ele fica desligado e mostra a lista delas, cada uma com link para as Configurações dela."
            ],
            "pronto": "Teste novo `packages/dominio/src/operations/bloqueio-de-aspecto.test.ts`: bloquear Status num Espaço sem sobrescrita abaixo funciona e `overrideStatusSet` numa Lista dele passa a ser recusado; com uma Pasta que sobrescreve, o bloqueio é recusado e a mensagem nomeia a Pasta; bloquear Campos deixa os existentes e recusa um novo; bloquear Automações recusa `criarAutomacao` numa Lista abaixo."
          },
          {
            "n": "Aceitar menções na descrição da Tarefa",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "A descrição é texto simples, editada em `TaskTitleDescriptionEditor` (`apps/web/src/features/estrutura/task-editors.tsx:41`) e mostrada em `tarefa-completa.tsx:963–976`. Menção existe só no Comentário: `Comment.mentions` (`types/primitives.ts:189`), o menu do “@” do `CommentComposer` (`task-editors.tsx:471–520`) e `pendingMentions` (`derive.ts:1071`), que alimenta “Menções a você” em `app/(shell)/notificacoes/page.tsx:77`.",
            "fazer": [
              "Campo `descriptionMentions?: { type: \"member\"; id: Id }[]` em `Task` (`types/structure.ts`).",
              "`UpdateTaskInput` (`tasks.ts:1419`) ganha `descriptionMentions`; `updateTask` grava junto com a descrição e recusa Membro inexistente, como `addTaskComment` faz (`tasks.ts:1764`). Atualizar o esquema de `updateTask` em `apps/api/src/rotas/esquemas/tarefas.ts`.",
              "Tirar do `CommentComposer` a lógica do “@” para um hook `useMencoes` em `features/estrutura/mencoes.ts`, e usá-lo no editor da descrição.",
              "Na Tarefa completa, o nome mencionado aparece destacado na descrição.",
              "O aviso à pessoa mencionada segue a decisão abaixo."
            ],
            "pronto": "Teste em `operations.test.ts`: `updateTask` com descrição “@Júlia revisar” e a menção grava `descriptionMentions`; Membro inexistente é recusado. Na tela, digitar “@Jú” na descrição abre o menu de Membros."
          },
          {
            "n": "Uma menção na descrição avisa a pessoa?",
            "cam": [
              "dec",
              "dom",
              "web"
            ],
            "decisao": true,
            "hoje": "A menção num Comentário aparece em Notificações › “Menções a você” até a conversa ser resolvida (`pendingMentions`, `derive.ts:1071`). A descrição não tem “resolvido”, e não existe registro de “já vi”.",
            "opcoes": [
              "(A) Não avisa: a menção só destaca o nome",
              "(B) Avisa em “Menções a você” enquanto o nome estiver na descrição e a Tarefa estiver aberta (fora de categoria terminal)"
            ],
            "muda": "(A) não custa nada além da subtarefa acima. (B) custa cerca de 2 horas: `pendingMentions` passa a ler também `descriptionMentions`, e a tela de Notificações mostra o trecho da descrição.",
            "recomendo": "(B): é o que o ClickUp faz, e a regra sai do dado, sem guardar estado novo.",
            "peso": "produto"
          },
          {
            "n": "Guardar o texto anterior a cada edição da descrição",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "`updateTask` grava só “Descrição alterada”, sem `before` nem `after` (`packages/dominio/src/operations/tasks.ts:1458`). O Título grava os dois (`:1453`). A linha do tempo mostra `(antes → depois)` no meio da frase (`apps/web/src/features/tarefa/timeline.tsx:294`), o que não serve para um texto longo.",
            "fazer": [
              "Em `tasks.ts:1458`, gravar `before` e `after` com a descrição antiga e a nova, cortadas em 2.000 caracteres com “…” no fim.",
              "Em `timeline.tsx`, para a ação “Descrição alterada”, mostrar só “Descrição alterada” e um botão “Ver alteração”, que abre o texto anterior e o novo, um embaixo do outro."
            ],
            "pronto": "Teste em `operations.test.ts`: editar a descrição de “A” para “B” grava uma Atividade com `before: \"A\"` e `after: \"B\"`; uma descrição de 3.000 caracteres grava 2.000 e “…”. Na tela, “Ver alteração” mostra os dois textos."
          },
          {
            "n": "Calcular o tempo registrado no domínio",
            "cam": [
              "dom",
              "web"
            ],
            "hoje": "Há duas somas diferentes na tela: `tarefa-completa.tsx:1199` soma `durationMinutes` de todos os lançamentos (o aberto conta 0) e o editor `TaskTime` soma só os fechados (`features/estrutura/collaboration-editors.tsx:199`). Painéis e IA não têm de onde ler.",
            "fazer": [
              "Criar `tempoRegistrado(state, taskId)` em `packages/dominio/src/derive.ts`, devolvendo `{ minutos, lancamentos, emAndamento, minutosComSubtarefas }`: soma os fechados, diz se há cronômetro aberto e soma também as Subtarefas.",
              "`tarefa-completa.tsx:1199` e `collaboration-editors.tsx:199` passam a usar a função."
            ],
            "pronto": "Teste novo `packages/dominio/src/tempo-registrado.test.ts`: uma Tarefa com lançamentos de 30 e 45 min e um cronômetro aberto devolve 75 min e `emAndamento: true`; com uma Subtarefa de 20 min, `minutosComSubtarefas` é 95. Na tela, a linha “Rastrear tempo” e o editor mostram o mesmo número."
          }
        ]
      },
      {
        "id": "2.7",
        "n": "Itens relatados nos testes",
        "objetivo": "O que você relatar nos testes da Estrutura entra aqui, um por subtarefa, no mesmo formato das outras.",
        "pronto": "Cada item aprovado por você.",
        "subs": []
      }
    ],
    "ajuste": "+5 dias: a conferência no código achou 42 subtarefas, incluindo mover e reordenar contêineres e as lacunas do modelo. Se a otimização for por tabelas próprias, soma mais 2 a 3 dias."
  }
];
