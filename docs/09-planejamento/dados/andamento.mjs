// Andamento do plano: o que já foi feito, por subtarefa. Fica separado dos dados do planejamento (parte-*.mjs)
// para que marcar uma subtarefa como feita seja uma linha aqui, e não uma edição em arquivos de 100 KB.
//
// Chave: id da subtarefa, como o cronograma numera (2.1.4 é a 4ª subtarefa da tarefa 2.1).
// estado: "feito" | "parcial" (parte feita, falta algo) | "aguarda" (depende de uma ação do dono)
//         | "dispensada" (não será feita, porque uma decisão escolheu outro caminho; sai da conta de "feitas/total").
// confere: começo do nome da subtarefa. Se o plano mudar de ordem, o gerador para em vez de marcar a errada.
// decidido: só nas subtarefas de decisão; é o texto que o cronograma mostra como "Decidido".
//
// Fonte: as Fases do GSD que cumprem cada Sessão. Fase 9 = Sessão 1 (16 dos 22 planos executados, 09-17 e 09-18
// pulados por decisão do dono, 09-19 em backlog e 09-22 aberto). Sessão 2: Fase 10 = parte A (planos 10-01 a 10-15
// executados em 2026-10-29 e a Task 1 do 10-16; 10-16 e 10-17 sem resumo), Fase 11 = parte B (8 planos, verificada
// e aprovada por você em 29/10) e Fase 12 = parte C (10 planos executados entre 30/10 e 02/11; UAT com os testes
// 1 e 3 ainda bloqueados). A data só aparece quando é conhecida: as entradas da Fase 9 não a trazem.

const EM = "2026-10-29";
const EM_FASE_16 = "2026-11-09";
const EM_LACUNAS_16 = "2026-11-10";
const EM_FASE_15 = "2026-11-06";
const EM_CORTE_15 = "2026-11-07";
const EM_S4 = "2026-11-11";
const EM_S5 = "2026-11-12";
const EM_S5_MESCLADA = "2026-11-13";
// O que existe de prova das telas da Fase 15: o dono aceitou em bloco no UAT (`15-UAT.md`, "pass all", 07/11, "vou verificar em
// prod direto"), e nenhuma foi aberta em navegador autenticado por quem implementou. Vai em toda subtarefa de tela.
const ACEITE_DAS_TELAS = " Telas: aceite do dono em bloco no UAT de 07/11, sem observação em navegador.";
const feito = (confere, plano, nota, em = EM) => ({ confere, estado: "feito", plano, ...(em ? { em } : {}), ...(nota ? { nota } : {}) });
const parcial = (confere, plano, nota, em = EM) => ({ confere, estado: "parcial", plano, ...(em ? { em } : {}), nota });
const aguarda = (confere, plano, nota) => ({ confere, estado: "aguarda", plano, nota });
const dispensada = (confere, plano, nota) => ({ confere, estado: "dispensada", plano, nota });

export const ANDAMENTO = {
  // 2.1 Limpar a UI das subpáginas
  "2.1.1": feito("Tirar o botão", "10-16",
    "Saíram o botão \"Rodar agenda\" da Lista, o item \"Rodar automações por vencimento\" do menu do Financeiro e o texto de ajuda que mandava apertá-lo. Um teste (`sem-rodar-agenda.test.ts`) impede a volta dos dois rótulos. O PR #2 do `n1-tecnologia/crm` entrou na `main` em 04/11 (`2adf633`) depois do D-04 fechado (2.1.3); o `check` e o `seguranca` ficaram verdes e a Vercel publicou a web. Não precisou publicar a API: o PR só mexeu em `apps/web`.", "2026-11-04"),
  "2.1.2": {
    ...feito("O que roda a recorrência", "10-05 e 10-15",
      "O servidor gera a recorrência (plano 10-05) e a lixeira vencida entrou no relógio (plano 10-15). Em 29/10 você escolheu `direto` para a lixeira: a prévia de produção mostrou 65 Tarefas a eliminar, todas em Espaços de teste, e 0 no `ws_n1`."),
    decidido: "Escolha A: o servidor cuida. O agendador passa a visitar também as Listas com Tarefa recorrente por calendário e as que têm Tarefa vencida na lixeira, além das que já visita. Listas que só têm recorrência nascem direto, sem o ensaio da primeira volta; as com Automação por vencimento (Financeiro, Contas a receber) mantêm o ensaio. Essa parte do agendador sai da Sessão 19 e foi feita aqui.",
  },
  "2.1.3": feito("Confirmar que o agendador", "10-16",
    "O agendador está ligado em produção desde 29/10, só no `ws_n1` (`AUTOMACOES_ESPACO_ID=ws_n1`, `AUTOMACOES_LISTA_ID` e `AUTOMACOES_ATOR_MEMBER_ID` vazias, `AGENTE_CONTAS_A_PAGAR_ATIVO` ausente). Em 04/11, `npm run automacoes:previa -w @n1/api -- ws_n1 --agenda --dias 7` (só leitura, banco de produção) listou 30 voltas, de 29/10 a 04/11, todas `concluido`: 0 falhou, 0 `SEM_ATOR`, 0 recusas. As Listas só de recorrência (Lista 1 e Lista do subgrupo) fecham sem ensaio; Contas a pagar tem uma volta por dia; Contas a receber só tem a de 29/10, porque a primeira volta de uma Lista com Automação por vencimento é um ensaio e as seguintes esperam `npm run automacoes:liberar`. Você aceitou o ator humano (Q1) em 29/10. O D-04 está fechado em `10-PROVAS.md`.", "2026-11-04"),
  "2.1.4": feito("Juntar as duas barras", "10-06"),
  "2.1.5": feito("Tirar da Lista as frases", "10-06"),
  "2.1.6": feito("Tirar `Quadro`", "10-06", "A página da Lista caiu de 1.407 para menos de 1.000 linhas."),
  "2.1.7": {
    ...feito("Manter as abas Lista e Tabela", "decisão D-05", "Nada a implementar: as abas ficam como estão."),
    decidido: "Escolha A: manter as abas Lista e Tabela separadas, como estão. A Tabela virar planilha (uma coluna por Campo, editável na célula, cerca de 1,5 dia) fica para depois, se você sentir falta dos Campos durante os testes.",
  },
  "2.1.8": feito("Organizar as Configurações", "10-08"),
  "2.1.9": feito("Deixar a página do Espaço", "10-09"),
  "2.1.10": feito("Tirar os códigos de regra", "10-14", "Os 13 textos ficaram sem código, e um teste de varredura impede a volta."),

  // 2.2 Otimizar o backend do CRUD de Espaço, Pasta e Lista (Fase 12, caminho B da 2.2.2)
  "2.2.1": feito("Medir quanto leva cada etapa", "12-01 e 12-02",
    "A medição por etapa entrou em `executar()` e o comando `npm run gravacao:medir` roda os quatro gestos na VPS, contra o banco de produção, em loopback. O \"antes\" (código `5a74ee7`), mediana de `pedidoMs`: 551,0 ms em `createList`, 531,9 em `updateContainer`, 526,1 em `trashContainer` e 535,5 em `changeTaskStatus`; `hidratar` direto, 147,5 ms. Cada ida ao banco custa cerca de 52 ms (o `select 1` mediu 51,7).", null),
  "2.2.2": {
    ...feito("Como otimizar?", "12-03", "Parada com a tabela \"antes\" na mão, em 02/11.", "2026-11-02"),
    decidido: "Escolha B: ficar em `plataforma.registros` e cortar o custo onde ele está: travar no começo, encadear as chamadas de um gesto e mostrar a mudança na hora. `hidratar` direto mediu 147,5 ms na mediana, abaixo do limite de 300 ms, então a sessão C (tabelas próprias para a Estrutura inteira) não entrou no ROADMAP. A meta é que o ganho que o B der basta, sem alvo numérico por gesto: você aceitou a recomendação em 02/11. As subtarefas 2.2.6 a 2.2.9, do caminho A, ficam dispensadas.",
  },
  "2.2.3": feito("Travar o Espaço de Trabalho", "12-04",
    "`executar()` trava a linha do Espaço no começo da transação e grava com uma tentativa só; as importações longas ficam no regime otimista, para não segurar o `ws_n1`. Duas gravações simultâneas no mesmo Espaço hidratam 2 vezes, não 3 (`unidade-de-trabalho-concorrencia.test.ts`, Postgres 16 local).", "2026-11-02"),
  "2.2.4": feito("Aplicar todas as respostas", "12-05",
    "`gravar` devolve a lista de respostas, uma por chamada, e `enviar` aplica as diferenças em ordem, sem re-hidratar.", "2026-11-02"),
  "2.2.5": feito("Mostrar a mudança na tela", "12-06 a 12-09",
    "A mudança aparece na hora e a recusa do servidor a tira; os pedidos saem um de cada vez, na ordem do clique. O item novo aparece \"Salvando…\" e sem link até o servidor confirmar o id, o clique numa âncora com id pendente é cancelado e fechar a aba com gravação pendente pergunta antes. A web e a API estão em produção desde 02/11. Provado por teste; você deu a subtarefa por concluída em 04/11. Os testes 1 e 3 de `12-UAT.md` (ver na tela de produção e a linha `gravacao medida`) seguem como bloqueados no registro, e `12-VERIFICATION.md` segue `human_needed`.", "2026-11-04"),
  "2.2.6": dispensada("Criar as tabelas de Espaço", "decisão 2.2.2",
    "Fazia parte do caminho A (tabelas próprias de Espaço, Pasta e Lista). A 2.2.2 seguiu pelo B, então não será feita."),
  "2.2.7": dispensada("Criar o serviço e as rotas REST", "decisão 2.2.2",
    "Fazia parte do caminho A. A 2.2.2 seguiu pelo B, então não será feita."),
  "2.2.8": dispensada("Projetar os contêineres das tabelas", "decisão 2.2.2",
    "Fazia parte do caminho A. A 2.2.2 seguiu pelo B, então não será feita."),
  "2.2.9": dispensada("Trocar as telas de contêiner", "decisão 2.2.2",
    "Fazia parte do caminho A. A 2.2.2 seguiu pelo B, então não será feita."),
  "2.2.10": feito("Medir de novo depois da mudança", "12-10",
    "Mesmo comando, na VPS (código `37c1cab`). Mediana de `pedidoMs` de um pedido isolado: 611,9 ms em `createList` (antes, 551,0), 612,1 em `updateContainer` (531,9), 614,4 em `trashContainer` (526,1) e 611,0 em `changeTaskStatus` (535,5), de 11% a 17% a mais, porque a trava no começo custa uma ida e volta (cerca de 51 ms). Você aceitou isso no teste 4 da UAT: o ganho está na tela, que muda na hora, e sob disputa, onde a gravação faz uma tentativa só em vez de até três. A linha `gravacao medida` do serviço real (D-03) ainda não foi observada em produção.", "2026-11-02"),

  // 2.3 Mover e reordenar Pastas e Listas
  "2.3.1": feito("Criar a operação `moveContainer`", "10-03 e 10-18"),
  "2.3.2": feito("Criar a operação `reorderContainers`", "10-04"),
  "2.3.3": feito("Arrastar e soltar", "10-12, 10-13 e 10-19",
    "Arrastar e soltar nativo (sem biblioteca nova), \"Mover para…\" e \"Subir/Descer\" no menu."),

  // 2.4 Converter item do checklist em Subtarefa (Fase 11)
  "2.4.1": feito("Criar no domínio a recusa", "11-01",
    "`conversaoDeItemRecusada`, em `derive.ts`, devolve o motivo; a recusa de `convertChecklistItem` usa a mesma mensagem.", "2026-10-29"),
  "2.4.2": feito("Mostrar o botão só quando", "11-07",
    "\"Converter em Subtarefa\" some em Lista sem Subtarefas e em Tarefa no último nível, e fica na cor normal. Converter mostra o aviso com \"Abrir\", que leva à Subtarefa nova. Aprovado por você em 29/10.", "2026-10-29"),
  "2.4.3": {
    ...feito("Manter a confirmação", "decisão D-01 e 11-07", null, "2026-10-29"),
    decidido: "Escolha B: a conversão confirma com um clique, com o aviso de que não há volta. A digitação do nome do item e a cor de perigo saem.",
  },
  "2.4.4": {
    ...feito("O que fazer com os subitens", "decisão D-02 e 11-01", "`parentItemId` saiu do tipo e do repositório, e `convertChecklistItem` não tem mais ramo de subitens.", "2026-10-29"),
    decidido: "Escolha B: subitens ficam fora do modelo. O checklist tem um nível só, que cobre os seus testes; ninguém usava subitem.",
  },
  "2.4.5": {
    ...feito("Converter também pelo cartão", "decisão D-03", "Nada a implementar: o cartão do Quadro continua só com \"Checklist N de M\".", "2026-10-29"),
    decidido: "Escolha B: converter só com a Tarefa aberta (página, popup ou gaveta). O cartão do Quadro não ganha menu, porque para converter a pessoa precisa ver o item no contexto.",
  },

  // 2.5 Remover a visualização de carga
  "2.5.1": feito("Tirar o tipo `carga`", "10-07"),
  "2.5.2": feito("Tirar `carga` do esquema", "10-07"),
  "2.5.3": feito("Trocar as Visualizações gravadas", "10-17",
    "Migração `010` aplicada em produção em 29/10 (16h27, pelo dono). Antes e depois: 0 Visualizações do tipo `carga` em todos os Espaços de Trabalho; `--seco` com 0 pendentes."),
  "2.5.4": feito("Tirar a aba Carga", "10-07"),
  "2.5.5": {
    ...feito("A capacidade semanal", "10-21", "O valor já gravado em cada Membro fica inerte."),
    decidido: "Escolha A: a capacidade semanal do Membro sai junto com a Carga. O valor já gravado em cada Membro é ignorado, não migrado.",
  },

  // 2.6 Fechar as lacunas do modelo da Estrutura (2.6.1 a 2.6.5 são da Fase 10; 2.6.6 a 2.6.9, da Fase 11)
  "2.6.1": feito("Criar as Visualizações padrão", "10-01"),
  "2.6.2": feito("Usar as Visualizações padrão", "10-10"),
  "2.6.3": feito("Tirar o bloqueio da Lista", "10-17 (parte feita no 10-20)",
    "Migração `010` aplicada em produção em 29/10. Antes e depois: 0 Listas com a chave `blocks` em todos os Espaços de Trabalho."),
  "2.6.4": feito("Tirar o modo `bloqueado`", "10-20"),
  "2.6.5": feito("Criar a operação `setContainerBlock`", "10-02 e 10-11"),
  "2.6.6": feito("Aceitar menções na descrição", "11-02 e 11-05",
    "`Task.descriptionMentions`: `updateTask` grava a menção e recusa Membro inexistente. Na tela, \"@\" na descrição abre o menu de Membros (o mesmo hook do Comentário) e o nome fica destacado.", "2026-10-29"),
  "2.6.7": {
    ...feito("Uma menção na descrição avisa", "decisão D-07 e 11-04", "Quem não enxerga a Tarefa não recebe o aviso, e não há botão de dispensar.", "2026-10-29"),
    decidido: "Escolha B: a menção na descrição avisa a pessoa em Notificações › \"Menções a você\", enquanto o nome estiver na descrição e a Tarefa estiver aberta (fora de categoria terminal). A regra sai do dado, sem guardar estado novo.",
  },
  "2.6.8": feito("Guardar o texto anterior", "11-02 e 11-06",
    "A Atividade \"Descrição alterada\" grava `before` e `after`, cortados em 2.000 caracteres com \"…\". No Feed e na Timeline, \"Ver alteração\" abre os dois textos embaixo da linha; as edições antigas ficam como estavam, sem o botão.", "2026-10-29"),
  "2.6.9": feito("Calcular o tempo registrado", "11-03 e 11-07",
    "`tempoRegistrado`, em `derive.ts`, soma só os lançamentos fechados e marca `emAndamento` quando há cronômetro aberto. A linha \"Rastrear tempo\" e o editor `TaskTime` mostram o mesmo número.", "2026-10-29"),

  // Sessão 1 (Fase 9): segurança dos dados e base de produção
  // 1.1 O que o `GET /estado` envia a mais
  "1.1.1": feito("Filtrar as Sessões de Chat", "09-01 e 09-02", null, null),
  "1.1.2": feito("Esconder a Memória de Usuário", "09-02", null, null),
  "1.1.3": feito("Esconder os segredos dos links", "09-02 e 09-08", null, null),
  "1.1.4": {
    ...feito("O que mais o `GET /estado`", "09-02 e 09-08", null, null),
    decidido: "Escolha A: o Convidado não recebe `agents`, `automations`, `documents`, `collections` nem `skills`; os demais Papéis recebem tudo, como hoje. O CRM antigo fica como está até a Sessão 3 removê-lo, e a regra fina por registro (dono, Equipe, compartilhamento) vai para a Sessão 17.",
  },
  "1.1.5": feito("Aplicar o mesmo recorte", "09-02 e 09-07", null, null),
  "1.1.6": feito("Escrever o teste de vazamento", "09-07 e 09-15", null, null),
  // 1.2 Escritas sem conferência
  "1.2.1": feito("Barrar o Membro suspenso", "09-07", null, null),
  "1.2.2": feito("Pôr a conferência nas operações do CRM antigo", "09-03", null, null),
  "1.2.3": feito("Pôr a conferência nas outras operações", "09-03", null, null),
  "1.2.4": feito("Escrever a tabela de quem confere", "09-09", "A tabela \"Quem pode\" das 286 operações e o teste que a cobra.", null),
  // 1.3 Banco fechado para o `apps/api`
  "1.3.1": feito("Conferir se o schema", "09-04 e 09-20", "A `009` fecha o schema `plataforma` para `anon`, `authenticated` e `public`; foi aplicada em produção em 28/10.", null),
  "1.3.2": {
    ...feito("Como proteger o banco?", "09-04", null, null),
    decidido: "Escolha A: banco só fechado, com o usuário `n1_api`, e sem RLS nesta fase. A RLS por `workspace_id` fica adiada pela decisão 12.1 (mais de uma empresa no sistema), não esquecida.",
  },
  "1.3.3": feito("Escrever a migração `009`", "09-04 e 09-20", "Aplicada em produção em 28/10.", null),
  "1.3.4": feito("Trocar a conexão do `apps/api`", "09-04 e 09-20", "Em produção a api roda como `n1_api` desde 28/10.", null),
  // 1.4 Cofre de credenciais
  "1.4.1": feito("Criar a tabela `plataforma.credenciais`", "09-04", null, null),
  "1.4.2": feito("Cifrar e decifrar", "09-10", "Cofre com AES-256-GCM.", null),
  // 1.5 Segredos fora dos logs
  "1.5.1": feito("Configurar `redact`", "09-05", null, null),
  "1.5.2": feito("Mascarar o segredo no log de acesso do nginx", "09-06 e 09-20", "Provado em Docker (09-06) e aplicado no nginx da VPS (09-20, 28/10).", null),
  // 1.6 Rotas públicas contra abuso
  "1.6.1": feito("Pôr `limit_req`", "09-06 e 09-20", "Provado em Docker (09-06) e aplicado no nginx da VPS (09-20, 28/10).", null),
  "1.6.2": feito("Documentar o `TRUST_PROXY`", "09-06", null, null),
  // 1.7 Ambientes, backup e monitoramento
  "1.7.1": {
    ...feito("Onde fica o banco de homologação?", "09-11", "Decidida. O ambiente de homologação no ar não foi montado: o plano 09-17 foi pulado por decisão sua em 23/10.", null),
    decidido: "Escolha A: a homologação é um segundo projeto Supabase, na organização N1 e na mesma região de produção (`us-west-2`). Separa banco, Auth e Storage, e é nele que a `009`, o `n1_api` e a restauração de backup seriam provados antes de produção.",
  },
  "1.7.2": parcial("Subir o ambiente de homologação", "09-11", "Os scripts por `AMBIENTE`, o usuário `n1crm-hml` e o job `homologacao` estão no repositório. O ambiente no ar não foi montado: 09-17 pulado por decisão sua em 23/10.", null),
  "1.7.3": parcial("Ligar o backup diário", "09-14", "Backup cifrado (age + rclone) e restauração provados em Docker. Ligar na VPS e provar a restauração no seu Mac ficou de fora: 09-18 pulado por decisão sua em 27/10.", null),
  "1.7.4": parcial("Ligar o monitoramento de erros", "09-13 e 09-16", "O Sentry está no código da api e da web e só liga com o DSN preenchido. A prova do alerta ficou em backlog (09-19), e a rota de erro de prova ainda precisa sair (09-22).", null),
  "1.7.5": parcial("Preparar o servidor da Evolution API", "09-14", "Os arquivos da Evolution API estão no repositório. O servidor no ar continua aberto (09-19).", null),
  // Sessão 3 (Fases 14 a 16): base da mensageria e unificação do CRM. Parte A (3.1 a 3.3) = Fase 14, executada e
  // verificada em 05/11 e publicada em produção no mesmo dia por decisão do dono (API na VPS e `main` do `n1` em
  // `49f1b54`). Parte B (3.4 e 3.5) = Fase 15, com andamento depois da 3.3 (o corte em produção foi em 07/11); parte C (3.6 a 3.9) = Fase 16, com andamento ao fim da Sessão 3.
  // 3.1 Decidir o corte e dar ao modelo novo o que falta (Fase 14, planos 14-01 a 14-18)
  "3.1.1": {
    ...feito("Como fazer o corte?", "decisão D-01", "O corte é de uma vez, sem ponte entre o modelo antigo e o novo. A Fase 14 deixou o modelo novo pronto e subiu inteira em 05/11, por decisão sua, com os planos 14-15 a 14-17 junto (eles iam esperar a Fase 15): os ids antigos de Tarefa conversacional respondem 404 em produção, e a Fase 15 troca as telas e roda o script de migração.", "2026-11-04"),
    decidido: "Escolha A: de uma vez. Preparar tudo, ensaiar a migração num Postgres local com uma cópia dos dados reais (não há homologação) e trocar todas as telas no mesmo deploy. Sem pontes que traduzam id antigo e novo.",
  },
  "3.1.2": {
    ...feito("O que o modelo novo precisa ganhar", "decisão D-04", "Entraram notas do Contato, consentimento, mesclagem, transferir Identificador, mover Conversa, atribuir, estrela, leitura e lixeira da Conversa (planos 14-05 a 14-11).", "2026-11-04"),
    decidido: "Escolha B: só o essencial. Somem da tela até uma sessão própria: Tags, vários Contatos por Negócio com papel, histórico de Etapas, Requisitos de Etapa e Anexos de Empresa e Negócio. Continuam guardados em `registros_crm_antigo`; nada é apagado.",
  },
  "3.1.3": {
    ...feito("Quando a Conversa de Grupo", "decisão D-05", "A `011` não ganhou colunas de Grupo nem de Flow.", "2026-11-04"),
    decidido: "Escolha B: Conversas de Grupo e Mensagens de Flow ficam no modelo antigo até as Sessões 6 e 7. Aqui só os Contatos e Canais das Ferramentas passam para os ids novos. O modelo antigo não sai por inteiro na Fase 15.",
  },
  "3.1.4": {
    ...feito("Meus negócios continua", "decisão D-06", "Nada novo depende das Listas espelho (guardas `sem-listas-espelho.test.ts` nas três camadas). A troca da tela é da 3.4.5.", "2026-11-04"),
    decidido: "Escolha B: aposentar as Listas espelho. \"Meus negócios\" vira o quadro de `/crm/funis/[funil]` com o filtro \"meus\"; as Reuniões continuam como Tarefas ligadas ao Negócio novo.",
  },
  "3.1.5": feito("Escrever a migração nova", "14-01 e 14-19", "A `011` (`011-crm-o-que-faltava.sql`) foi ensaiada em 05/11 sobre uma cópia de 2.128 registros do CRM antigo (18 Espaços): contagens iguais antes e depois, tabelas novas vazias e `hidratar` sem falha. Foi aplicada em produção no mesmo dia, depois de um backup manual do schema `plataforma`. Traz `mesclado` no Contato, `contato_consentimentos`, `contato_notas`, `conversa_marcacoes`, `na_lixeira_em` na Conversa, `crm_de_para` e `registros_crm_antigo`.", "2026-11-05"),

  // 3.2 Levar ao modelo novo as operações que só existem no antigo
  "3.2.1": feito("Criar o caminho para gestos", "14-03", "`executarGestoMisto` e `lerDoCrm` (`apps/api/src/servicos/crm/gesto-misto.ts`): o CRM e `plataforma.registros` gravam no mesmo commit, com tudo ou nada provado em Postgres local. Gesto com `aoConfirmar` sai do caminho de duas idas da Fase 13 (aceito: gestos raros).", "2026-11-04"),
  "3.2.2": feito("Mesclar Contatos no modelo novo", "14-04, 14-09 e 14-11", "`POST /contatos/:id/mesclar`, o Contato absorvido some das listas e a ficha dele redireciona para o sobrevivente. Colisão de Conversa segue RN-CXE-10 (fica a de Mensagem mais recente), não \"a do absorvido\". O diálogo de \"Mesclar com…\" está na ficha nova; a prova de tela é a que está sendo feita em produção.", "2026-11-04"),
  "3.2.3": feito("Transferir um Identificador", "14-06 e 14-11", "`POST /contatos/:id/identificadores/:identificadorId/transferir`; as Conversas passadas ficam na origem. Ação \"Transferir\" na ficha nova.", "2026-11-04"),
  "3.2.4": feito("Registrar e respeitar consentimento", "14-08 e 14-11", "`GET` e `POST /contatos/:id/consentimentos`, só inserção; a regra `SEM_CONSENTIMENTO` está pronta e testada para os modelos da Sessão 7. Finalidade conferida no Catálogo em `registros`.", "2026-11-04"),
  "3.2.5": feito("Mover uma Conversa", "14-05, 15-06 e 15-24", "`POST /conversas/:id/mover` com e sem Conversa aberta no destino (14-05) e, na Fase 15, o diálogo da Caixa passou a chamá-la (`moverConversa`), sem a operação antiga." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.2.6": feito("Dar à Conversa nova", "14-05 e 14-07", "Atribuir, lixeira, restaurar, estrela e leitura por Membro, e `GET /conversas` com `atribuidoId`, `filaId`, `comEstrela`, `q`, `naoLidas` e o nome do Contato. Não gravam Registro de Atividade.", "2026-11-04"),
  "3.2.7": feito("Guardar as notas do Contato", "14-06, 14-11, 15-15, 15-20 e 15-25", "`GET` e `POST /contatos/:id/notas` sobre `plataforma.contato_notas`, a seção Notas da ficha nova e, na Fase 15, o fio da Caixa e a Reunião passaram a gravar por essa rota; `addContactNote` saiu do código." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.2.8": feito("Passar ao sucessor", "14-10 e 14-16", "Contatos, Empresas e Negócios do Membro removido passam ao Sucessor no mesmo commit; `GET /membros/:id/sucessao-no-crm` alimenta o diálogo de remoção. As Conversas atribuídas a ele ficam sem Atribuído (liberadas), diferente do texto da subtarefa: ver as perguntas em aberto em `14-PROVAS.md`.", "2026-11-04"),

  // 3.3 Levar a Tarefa conversacional para as tabelas novas
  "3.3.1": {
    ...feito("A Conversa da Tarefa pode nascer", "decisão D-07", "O diálogo de nova Tarefa pede a primeira Mensagem quando não há Conversa aberta no par Contato e Canal; havendo, reaproveita sem Mensagem nova (planos 14-13 e 14-16).", "2026-11-04"),
    decidido: "Escolha A: o diálogo pede a primeira Mensagem quando não há Conversa aberta; havendo uma, reaproveita sem mensagem nova. Mantém INV-CXE-05 e, no WhatsApp oficial fora da janela, essa Mensagem terá de ser modelo (Sessão 7).",
  },
  "3.3.2": feito("Trocar as leituras da Tarefa", "14-02 e 14-17", "`vinculosDoCrmDaTarefa` lê só os Vínculos, `alvoConferido` entra no nascimento e `derive-conversacional.test.ts` passa com o CRM antigo esvaziado do estado. As leituras antigas que o fio ainda usa (`contatoDaTarefa`, `canalDaTarefa`, `negocioDaTarefa` e vizinhas) ficam até a Fase 15.", "2026-11-04"),
  "3.3.3": feito("Criar a leitura em lote", "14-13 e 14-15", "`POST /tarefas-conversacionais/resumo` (até 200 Tarefas numa chamada) e `useResumoDasTarefas` no cartão, na tabela, no cartão de Reunião e na ficha. Perdas conscientes por não haver ponte: Empresa, temperatura, qualificação e estado/Atribuído da Conversa saíram do cartão e da ficha. A prova de tela está sendo feita em produção.", "2026-11-04"),
  "3.3.4": feito("Trocar a criação da Tarefa", "14-13 e 14-16", "`POST /tarefas-conversacionais` grava a Tarefa em `registros` e a Conversa em `plataforma.conversas` no mesmo commit; a operação antiga saiu de `OPERACOES` (14-17). O diálogo antigo da Caixa e da ficha antiga do Contato passam ids antigos, que a rota nova recusa com 404 até a migração dos dados (Fase 15).", "2026-11-04"),
  "3.3.5": feito("Trocar o Canal da Tarefa", "14-14 e 14-16", "`POST /tarefas-conversacionais/:taskId/canal`: reaproveita a Conversa aberta no Canal novo ou abre uma; a Conversa antiga continua na Caixa. A ficha sempre abre um diálogo de confirmação.", "2026-11-04"),
  "3.3.6": feito("Ligar e criar o Negócio", "14-14 e 14-16", "`/negocio` (ligar ou desligar) e `/negocio/novo` (criar na 1ª Etapa); um Vínculo recusado não deixa Negócio. O Negócio cujo dono é a Empresa do Contato não aparece para ligar.", "2026-11-04"),
  "3.3.7": feito("Conferir os Canais da Lista", "14-12", "O servidor lê `plataforma.canais` dentro da transação (`LER_DO_CRM`) e descarta o `canais` que o navegador mandar. Pendência: `instantiateListTemplate` chama `createList` sem `canais` (`planning.ts:364`) e precisa de entrada em `LER_DO_CRM` antes da 3.5.4.", "2026-11-04"),

  // 3.4 e 3.5 Telas no modelo novo e remoção do modelo antigo (Fase 15, planos 15-01 a 15-43; o corte em produção foi o 15-35,
  // em 07/11). Fonte: `.planning/phases/15-*/15-PROVAS.md` e `15-VERIFICATION.md`, conferidos de novo contra a `main` de 11/11:
  // nenhuma coleção antiga lida pela web, os arquivos legados apagados e os guardas de `sem-crm-antigo` passando.
  "3.4.1": feito("Caixa de Entrada: lista e gestos", "15-06, 15-11 e 15-24", "A lista, os contadores das abas, a estrela, atribuir, resolver, reabrir, mover e lixeira da Conversa leem e gravam `plataforma.conversas` por `/conversas`. A linha da Conversa perdeu a prévia da última Mensagem. A Conversa de Grupo segue pelo modelo antigo (F14-D-05)." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.2": feito("Caixa de Entrada: fio e envio", "15-20 e 15-25", "O fio recebe ids e lê Contato, Canais, Conversas e Mensagens pela api; responder é `POST /mensagens` e a Nota grava em `contato_notas`. Sem Rascunho de IA (D-15-11) e sem Mensagem de modelo: fora da janela de 24 h do WhatsApp oficial o envio desliga." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.3": feito("Caixa de Entrada: configurações", "15-12", "A ficha do Canal lê `GET /canais/:id` e salva por `PATCH`; a Fila e as Configurações contam por `GET /conversas`. O popup \"Adicionar Canal\" das Listas só escolhe (D-15-12); o único caminho que cria Canal é a página de conectar." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.4": feito("Fichas de Contato, Empresa", "15-13", "As três fichas perderam o recuo para o modelo antigo: 404 da api é \"não encontrado\", e os arquivos do recuo (as fichas legadas de Contato e de Empresa, `deal-screen`, `restore-copy-dialog` e `import-contacts-dialog`) foram apagados." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.5": feito("Meus negócios e Reuniões", "15-15, 15-26, 15-40 e 15-41", "\"Meus negócios\" virou o filtro `?meus=1` de `/crm/negocios`; a Pasta virou uma Pasta comum e a Lista espelho saiu. A Reunião lê o Negócio novo e perdeu Diagnóstico, Roteiro e Temperatura (o Negócio novo não tem Campos personalizados)." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.6": feito("Busca, Lixeira e Notificações", "15-14", "Contatos, Empresas, Negócios e Conversas vêm das rotas REST; o selo de Notificações soma o `total` de `GET /conversas`. A Busca de Conversa é pelo título." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.7": feito("Início, Configurações e Painel", "15-16, 15-18 e 15-23", "O Início soma no banco por `/crm/inicio/*`; o Painel lê as listas da api; `/configuracoes` lê o Funil padrão de `useFunis` (um Espaço novo nasce sem Funil, D-15-13). Os Painéis semeados abrem zerados até a Fonte apontar para um Funil novo (Sessão 20.3)." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.8": feito("Ferramentas: Contatos e Canais", "15-07, 15-17, 15-22 e 15-38", "Grupos, Comunidades e Flows conferem Canal e Contato nas tabelas; o servidor monta o `crm` e descarta o do navegador. O envio de Flow segue por Conversa 1:1 do modelo antigo (F14-D-05), que o corte esvazia: ver o aviso 73 do `WINDOWS.md`." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.9": feito("IA: alvos, escopos e âncoras", "15-08, 15-10, 15-21 e 15-39", "A Âncora do Chat e do ensaio é nomeada por `POST /crm/nomes`; o escopo Funil da Automação é conferido em `plataforma.funis`; arquivar um Agente solta as Conversas dele nas tabelas." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.4.10": feito("Contas a receber: o cliente", "15-19", "O cliente é um Contato de `plataforma.contatos`, conferido pelo servidor ao criar a série e ao importar; o nome aparece por `POST /crm/nomes`." + ACEITE_DAS_TELAS, EM_FASE_15),
  "3.5.1": feito("Escrever o script de migração", "15-27, 15-28 e 15-29", "`npm run migrar:crm-antigo -w @n1/api -- --espaco <id> --seco|--guardar|--migrar|--verificar`: copia, confere e só então apaga; `--migrar` leva Contatos, Empresas, Negócios, Canais, Conversas e Mensagens com os ids antigos preservados e lista o que não migra. Ensaiado em Docker sobre a cópia de 05/11 e usado no corte de 07/11. Limite: o `ws_n1` só tinha o Funil \"Padrão\", então o mapeador de Contatos, Negócios e Conversas nunca viu dado real; está provado só com dados sintéticos.", EM_FASE_15),
  "3.5.2": feito("Rodar a migração em", "15-30, 15-34 e 15-35", "O plano pedia homologação e produção; o dono decidiu o ensaio local com a cópia dos dados reais (F14-D-02), porque não existe homologação. Ensaiada em Docker sobre a cópia de 05/11 e executada em produção em 07/11 pelo assistente, a pedido escrito do dono: 012 aplicada, o CRM antigo guardado nos 18 Espaços de teste e no `ws_n1` (2.114 linhas saíram de `registros`; as 14 Conversas de Grupo ficam), `--verificar` ok em 19 de 19, API `20b4d01` no ar e web na `main` do n1, com backup do schema `plataforma` antes. O aceite do relatório e das telas é o do UAT de 07/11 (\"pass all\"); o 404 das operações antigas só está provado em teste, não ao vivo.", EM_CORTE_15),
  "3.5.3": feito("Tirar o CRM antigo do seed", "15-29 e 15-31", "`buildSeed()` nasce sem Contatos, Empresas, Funis, Negócios, Canais e Conversas 1:1; a demonstração é `npm run bootstrap:crm-demo` (só banco local).", EM_FASE_15),
  "3.5.4": feito("Remover o modelo antigo", "15-32, 15-33, 15-41, 15-42 e 15-43", "O `DataState` perdeu as oito coleções; 40 operações antigas respondem 404 (provado em teste); a ponte dos Canais saiu. Sobra só a Conversa de Grupo e o Flow (F14-D-05), até as Sessões 6 e 7. O corte de 07/11 tirou o CRM antigo de `registros` em produção; ficam as 14 Conversas de Grupo.", EM_FASE_15),

  // 3.6 Porta de entrada de mensagens (Fase 16, planos 16-01 a 16-03 e 16-06). Provado só com o provedor de teste e
  // com o servidor falso da Evolution, num Postgres 16 de Docker: nada ainda contra a Evolution nem o pooler reais.
  "3.6.1": feito("Definir a interface do provedor", "16-02", "Existe uma interface única de provedor de mensagens (`apps/api/src/mensageria/provedor.ts`) e um conjunto de seis testes de contrato que qualquer provedor novo precisa passar. O provedor de teste só vale para Canal simulado e cada Canal tem o segredo do webhook dele no cofre (corrige o \"segredo fixo\" que o texto da subtarefa previa). `npm run canal:segredo-de-teste` gera o segredo e imprime o `curl` de prova.", EM_FASE_16),
  "3.6.2": feito("Fazer o recebimento completo", "16-01", "Uma mensagem que chega acha o Contato pelo número ou o cria, reaproveita, reabre ou abre a Conversa (RN-CXE-09), reativa o Contato arquivado e grava a Mensagem sem duplicar. Número novo, repetida, Canal de outro Espaço, Canal arquivado, anexo, lixeira e corrida entre duas chamadas estão provados em Postgres local.", EM_FASE_16),
  "3.6.3": feito("Criar a rota de webhook por Canal", "16-03", "`POST /webhooks/mensageria/:canalId` guarda a chamada numa fila e responde na hora. Toda recusa (Canal que não existe, arquivado, sem segredo ou com segredo errado) dá a mesma resposta 401, há teto por IP e a chave do provedor nunca vai para o banco nem para o log. A migração `013` criou a fila e está em produção desde 10/11 (aplicada pela publicação, sem backup do schema, por decisão sua).", EM_FASE_16),
  "3.6.4": feito("Processar a fila de entrada", "16-03 e 16-18", "O processador pega as chamadas da fila sem pisar uma na outra, devolve a que ficou travada, recusa de vez o que nunca vai servir e tenta de novo, com espera crescente, o que foi falha passageira. Liga com `MENSAGERIA_WORKER_ATIVO=true`; está ligado em produção desde 10/11. Com o SIGTERM do `systemctl restart` a API passa a encerrar sozinha, com teto de 15 s (o 16-18 trocou o SIGKILL de 20 s por um tratador único). Publicado em 10/11; o tempo do segundo restart em produção é conferência sua (16-22).", EM_LACUNAS_16),
  "3.6.5": feito("Gravar o status de entrega", "16-06", "O status que o provedor informa (enviada, entregue, lida) muda a Mensagem sem nunca andar para trás: uma \"lida\" seguida de um \"entregue\" atrasado continua \"lida\". Um evento de conexão só muda Canal real, nunca o simulado, e quando o Canal volta ao ar as Mensagens que esperavam são reenfileiradas.", EM_FASE_16),

  // 3.7 Porta de saída de mensagens (16-04, 16-05, 16-06, 16-11)
  "3.7.1": feito("Enfileirar o envio na mesma transação", "16-04", "A resposta escrita na Caixa nasce \"pendente\" e, num Canal conectado, grava o pedido de envio (só ids, sem texto nem telefone) na mesma transação da Mensagem, nos três pontos que gravam Mensagem enviada. O worker antigo do `automation/` passou a ignorar esse tipo de evento.", EM_FASE_16),
  "3.7.2": feito("Entregar pelo provedor", "16-05, 16-20 e 16-21", "Um worker próprio entrega pelo provedor do Canal: a Mensagem passa de \"pendente\" a \"enviada\" com o id do provedor, ou a \"falhou\" com um motivo legível. Falha passageira volta à fila até 5 vezes; resposta ambígua nunca é reenviada sozinha, para o cliente não receber duas vezes. Liga junto com o processador de entrada, por `MENSAGERIA_WORKER_ATIVO`. Depois da verificação da fase, três lacunas se fecharam (16-20 e 16-21): uma linha que volta da fila sem desfecho (trava vencida) fecha como \"sem confirmação\" em vez de reenviar; o aceite do provedor que não grava tenta 3 vezes e depois fecha a Mensagem; a volta do Canal só reabre o que falhou por Canal desconectado; e a resposta sai pelo número por onde o Contato escreveu, não só pelo principal. Provado em Postgres local e publicado em 10/11; a conferência com o celular em produção é sua (16-22).", EM_LACUNAS_16),
  "3.7.3": feito("Mostrar a entrega no fio", "16-06 e 16-11", "O fio mostra Enviando…, Enviada, Entregue e Lida, e a Mensagem que falhou mostra \"Não enviada\", o motivo e o botão \"Tentar de novo\" (`POST /mensagens/:id/reenviar`). O que vale em tela está provado por teste; ver a tela com WhatsApp real é a prova ao vivo (16-16).", EM_FASE_16),

  // 3.8 Tempo real (16-07, 16-08)
  "3.8.1": {
    ...feito("Como mandar as novidades", "decisão D-16-01", "O servidor avisa a tela por um canal próprio no `apps/api`, alimentado por `LISTEN/NOTIFY` do Postgres.", EM_FASE_16),
    decidido: "Escolha B: o próprio `apps/api` avisa a tela por SSE, alimentado por `LISTEN/NOTIFY`. Cada aba só recebe eventos do próprio Espaço e das Conversas que o Membro pode ler, então a regra de acesso continua no backend. Descartado o Supabase Realtime (A), porque exigiria abrir o schema `plataforma` ao Realtime com regras por linha, o contrário do que a Fase 9 fechou. Custa uma conexão fixa a mais no pooler em modo sessão (porta 5432), que produção já usa. Se o pooler real não entregar o `LISTEN`, a tela segue funcionando pela releitura de 5 s; isso só a prova ao vivo (16-16) confirma.",
  },
  "3.8.2": feito("Publicar os eventos do CRM", "16-07", "Mensagem nova, mudança de status e mudança de Conversa saem como aviso no banco, no mesmo commit do gesto (nada chega antes do commit, nada depois de um rollback). Os avisos só levam ids, nunca o texto da Mensagem.", EM_FASE_16),
  "3.8.3": feito("Abrir a rota de eventos", "16-07", "`GET /eventos` (SSE) exige o token, filtra por Espaço e por quem pode ler a Conversa, bate a cada 25 s, confere o Papel de novo a cada minuto, limita 5 abas por Membro e fecha em 45 min para a aba reconectar. Se o ouvinte do banco cair, responde 503 e a tela volta à releitura.", EM_FASE_16),
  "3.8.4": feito("Ouvir na tela", "16-08 e 16-19", "A tela abre o fluxo com `fetch` e o token do Membro (não `EventSource`), reconecta com espera crescente, relê tudo a cada conexão e a cada 5 s enquanto cai, e atualiza só as listas e o fio (sem toast, sem som: D-16-02). Soma-se à releitura por revisão, não a substitui. Medir as duas abas abaixo de 2 s é a prova ao vivo. A aba também corta um fluxo mudo por 60 s e reconecta (a API bate a cada 25 s) e só zera a espera de reconexão depois de 30 s de conexão estável (16-19). Publicado em 10/11; ver a reconexão depois de 2 min sem Wi-Fi é conferência sua (16-22).", EM_LACUNAS_16),

  // 3.9 Mídia nas mensagens (16-09, 16-10, 16-11)
  "3.9.1": feito("Ligar o anexo da Mensagem", "16-09", "O anexo da Mensagem aponta para um arquivo guardado no bucket (chave, tamanho e se já foi baixado). Uma Mensagem tem texto ou um anexo (no máximo um) e o Canal só recebe os tipos de mídia que declara aceitar.", EM_FASE_16),
  "3.9.2": feito("Aceitar áudio e vídeo", "16-09", "Entram áudio (ogg, mp3, m4a, aac), vídeo (mp4, 3gp), docx, xlsx, pptx, csv, txt e zip nos anexos de Mensagem, com a assinatura conferida contra o conteúdo inteiro. Teto de 16 MiB para áudio e vídeo e 25 MiB para o resto. O Formulário público segue como era e continua recusando áudio.", EM_FASE_16),
  "3.9.3": feito("Rotas de upload e download", "16-09", "`POST /mensagens/anexos` (ticket), `POST /mensagens` com `anexos` e `GET /mensagens/:id/anexos/:indice` (endereço assinado novo a cada abertura). Tudo roda sem Supabase nos testes, por uma porta com armazenamento em memória; contra o bucket real ainda não rodou.", EM_FASE_16),
  "3.9.4": feito("Baixar a mídia do provedor", "16-10", "Ao receber, a mídia é baixada, conferida e guardada em `entrada/` antes de a Mensagem ser gravada; se falhar, a Mensagem entra assim mesmo e a mídia é completada nas passadas seguintes, até 3, e depois fica indisponível sem derrubar a Mensagem. Cada passada deixa uma linha de log com os tempos de cada etapa.", EM_FASE_16),
  "3.9.5": feito("Anexar e tocar mídia", "16-11", "O compositor anexa arquivo de verdade, só nas categorias que o Canal aceita, e o fio toca áudio e vídeo, mostra imagem, oferece \"Baixar\" para documento e avisa quando o provedor não entregou o arquivo. Saíram o microfone, a localização, a figurinha e o \"ver uma vez\" (D-16-10). Se o Safari toca o áudio do WhatsApp é a prova ao vivo.", EM_FASE_16),
  "3.9.6": feito("Ligar a limpeza de arquivos órfãos", "16-10", "Uma coleta diária apaga sessões de upload abandonadas e arquivos de `entrada/` que nenhuma Mensagem cita. Liga com `COLETA_DE_ORFAOS_ATIVA=true` (nasce desligada). Limite conhecido: só enxerga os primeiros 500 arquivos de cada Canal.", EM_FASE_16),

  // Sessão 4: o "Conectar" por QR code pelo CRM, o estado real da conexão e a Mensagem digitada no celular. A Fase 16 já tinha
  // adiantado o adaptador mínimo da Evolution (D-16-04 a D-16-06); as PR #7, #8 e #9 (mescladas e publicadas em 11/11) fizeram o
  // resto de 4.2 e 4.3 e a parte `fromMe` de 4.4.2. A PR #10 fez o nono dígito (4.4.3) e a #11 o resto da 4.4 (tiques, reações, edição, apagada e a citação). Prova real: `npm run evolution:fumaca` passou 8 de 8 contra a Evolution 2.4.0
  // da VM, o dono conectou um número de verdade e confirmou que a Mensagem digitada no celular aparece na Caixa (11/11).
  "4.1.1": feito("Separar os números", "dono, 12/11", "Você deu por concluído em 12/11, ao fechar a sessão. Não há neste cronograma uma lista dos números anotada; o que existe em produção são duas instâncias da Evolution ligadas a Canais (uma criada pelo \"Conectar\" do CRM e uma ligada à mão).", "2026-11-12"),
  "4.1.2": feito("Instalar a Evolution API", "instalação do dono e PR #7", "A Evolution 2.4.0 está instalada na VM e responde por HTTPS, a `EVOLUTION_URL` e a `EVOLUTION_API_KEY` estão no `api.env` do servidor e `npm run evolution:fumaca` confirmou em 11/11, contra ela, `fetchInstances` com a chave global (o passo 4 do plano). Você deu a sessão por fechada em 12/11. Fica registrado o que não foi feito: o passo 3 do plano (restringir o acesso externo ao painel da Evolution), que é da infra, e a troca da chave global que foi colada na conversa em 11/11, que você vai fazer.", "2026-11-12"),
  "4.2.1": feito("Ensinar a conexão real", "16-13, 16-17 e PR #7", "O domínio ganhou `conectar` (a pessoa pede o QR code; não muda a conexão) e `conexao_perdida` (a queda leva a `com_erro`; num Canal já desconectado é ignorada), além de `conexao_confirmada` e da conferência do número, que já vinham da Fase 16. `podeConectarPorQrCode` decide o botão da ficha. Uma tentativa de conexão que falha (QR lido por outro número) leva até um Canal `desconectada` a `com_erro`. \"Simular conexão\" recusa o Canal já ligado a um provedor real (16-17). Você conectou um número real em 11/11.", EM_S4),
  "4.2.2": feito("Criar o cliente da Evolution", "16-12, 16-13 e PR #7", "Além de consultar, configurar o webhook, enviar e baixar mídia (Fase 16), o cliente cria a instância `n1-<espaço>-<canal>` (com o token escolhido pelo CRM), pede o QR code, sai da sessão e apaga a instância; o webhook passou a assinar também `CONNECTION_UPDATE`. A chave global da Evolution virou variável da API (`EVOLUTION_API_KEY`, só no `api.env`), o que reverte a decisão T-16-51 da Fase 16; a trava está no código: o cliente só cria e apaga instância `n1-...` e recusa qualquer outra, inclusive a do `automation/`. Conferido contra a Evolution 2.4.0 real em 11/11 pela fumaça (8 de 8: versão, criar com QR válido, token, estado, QR, sair, apagar e conferir que sumiu). Depois de um `connect`, a instância continua na lista por cerca de 1 s depois de apagada; a fumaça espera isso (PR #8) e o produto não depende disso.", EM_S4),
  "4.2.3": feito("Criar a rota de conectar", "PR #7", "`POST /canais/:id/conectar` cria a instância se ela ainda não existe, guarda o token dela e o segredo do webhook no cofre e devolve o QR code e o código de pareamento. Nunca grava `conectada`: quem diz que conectou é a Evolution (4.3.1). É idempotente (reaproveita instância e credencial), e é assim que o painel renova o QR. Sem `EVOLUTION_API_KEY` responde 503 dizendo o que falta. A Evolution é chamada fora da transação, porque segurar o Espaço durante a rede o travaria, e um teste prova a ordem. Publicado em 11/11.", EM_S4),
  "4.2.4": feito("Mostrar o QR code na ficha", "PR #7", "Na ficha do Canal, \"Conectar\" (\"Reconectar\" em `com_erro`) abre o painel com o QR code e os passos de cada provedor; criar o Canal abre a ficha com o painel aberto. O QR é renovado pelo painel a cada cerca de 25 s, e não pelo tempo real como o plano previa (`QRCODE_UPDATED`): o `NOTIFY` do Postgres aceita 8 KB e um QR em base64 passa disso. Você usou o painel num navegador real para conectar um número em 11/11. Limite: um Canal que já está `com_erro` e falha de novo para `com_erro` não muda de estado, então a tela não tem o que observar e a frase \"QR lido por outro número\" só aparece quando o estado muda depois de o painel pedir o QR.", EM_S4),
  "4.3.1": feito("Tratar os eventos de conexão", "PR #7", "`connection.update` entra pelo webhook. O `open` é só um aviso: o processador confere na Evolution, na fonte, se a instância está aberta e se o número é o do Canal, e só então grava `conectada` (`conexao_simulada` falso). `close` de aparelho removido desconecta, outro `close` leva a `com_erro` e `connecting` não muda nada; número diferente sai da sessão e deixa `com_erro`. O `open` real está provado (você conectou em 11/11). `QRCODE_UPDATED` não é tratado: o painel renova o QR (4.2.4). Desde 12/11 (PR #12) a mudança de conexão avisa as abas abertas (`canal.mudou`, só o id do Canal): a tela relê os Canais sozinha, o fio da Conversa mostra \"WhatsApp desconectado\" com o link Reconectar e bloqueia o envio (antes só o `com_erro` avisava, e a Mensagem ficava em \"Enviando…\" sem explicação). Você testou a desconexão com um celular real e confirmou em 12/11 que o app a mostra como desconectada. Sem prova separada: o corpo exato do `connection.update`, e o significado dos `statusReason` (assumi 401 = aparelho removido; qualquer outra razão vira `com_erro`, que a tela também mostra e bloqueia).", EM_S4),
  "4.3.2": feito("Conferir a conexão de tempos", "PR #7", "A cada 5 min a API pergunta à Evolution o estado de cada Canal `whatsapp-nao-oficial` ativo e corrige o banco quando um webhook se perdeu. Liga com `EVOLUTION_CONFERENCIA_ATIVA=true`; **está ligada em produção desde 12/11**, com a sua autorização. Na primeira rodada, em produção, ela conferiu 2 Canais e corrigiu 1: a instância estava fechada na Evolution e o app ainda a mostrava como conectada. É a única rede para a instância apagada no painel da Evolution (a configuração do webhook some junto, e nenhum aviso chega) e para o webhook perdido.", EM_S4),
  "4.3.3": feito("Desconectar e arquivar de verdade", "PR #7", "Desconectar tira o aparelho da sessão antes de gravar `desconectada`; arquivar também apaga a instância e a credencial do cofre. A Evolution é chamada antes da transação: se ela não responder, a rota devolve 502 (\"Não foi possível falar com o WhatsApp. Tente de novo.\") e nada é gravado. Canal sem credencial, simulado ou de outro provedor não chama ninguém, e uma instância que você ligou à mão só ganha \"sair da sessão\" e nunca é apagada. Provado com a Evolution de mentira e, no cliente, pela fumaça real (sair e apagar). Ainda não conferido: desconectar pela ficha e ver o aparelho sumir de \"Aparelhos conectados\" no celular.", EM_S4),
  "4.3.4": feito("Tirar “Simular conexão” da produção", "PR #7", "A rota `POST /canais/:id/simular-conexao` e o botão só existem com `PERMITIR_CONEXAO_SIMULADA=true`; produção não define a variável (conferido no `api.env` da VM em 11/11), o ambiente de teste a liga e um teste prova que sem ela a rota responde 404. O 404 está provado em teste, não ao vivo. A api diz se a simulação está ligada em `GET /canais/:id` (`simulacaoPermitida`) e não em `GET /estado`, como o plano previa, porque o Canal já não está em `/estado` desde a Fase 15. Efeito aceito: os Canais de WhatsApp oficial e de E-mail, que ainda não têm provedor real, deixam de poder \"conectar\" por simulação em produção.", EM_S4),
  "4.4.1": feito("Proteger o webhook da Evolution", "16-03, 16-12 e PR #7, #11", "O segredo vai num cabeçalho configurado no webhook da instância, não na URL (assim não cai no log do nginx), é conferido em tempo constante e a chamada só vale se a instância do corpo for a do Canal. O webhook assina `MESSAGES_UPSERT`, `CONNECTION_UPDATE` e, desde a 4.4.5, `MESSAGES_UPDATE`, `MESSAGES_DELETE` e `MESSAGES_EDITED`. `QRCODE_UPDATED` não entra, porque o painel renova o QR sozinho (4.2.4). A chave de deduplicação da fila de entrada passou a existir só para `messages.upsert`: o tique repete o id da Mensagem e seria descartado como repetido. Atenção: uma instância que já estava conectada guarda a lista de eventos de quando foi ligada; `npm run canal:atualizar-webhook-evolution` a reaplica (feito nas duas instâncias ligadas em 12/11, ver 4.4.5).", EM_S4),
  "4.4.2": feito("Traduzir a mensagem recebida", "16-12, PR #9 e #11", "Texto, imagem, áudio, vídeo, documento e figurinha viram mensagem do CRM. A que você digita no celular (`fromMe`) entra como Mensagem enviada pelo próprio Canal (ator `integration`, status `enviada`, com o avatar \"Celular\" no fio): não reabre uma Conversa resolvida, não acorda uma pendente, não reativa um Contato arquivado e não conta como recebida para a janela de 24 h nem para o número de resposta; o `pushName` dela é o do dono do número e nunca vira o nome do Contato; e, se o eco de uma Mensagem da plataforma chegar antes do aceite, fica uma só. Você confirmou em 11/11, com um celular real, que a Mensagem digitada no aparelho aparece na Caixa (texto; mídia digitada no celular ainda não foi testada). A citação (`contextInfo.stanzaId`) liga a Mensagem à citada da MESMA Conversa e do mesmo Canal; a citada que não existe aqui deixa a Mensagem sem ligação, sem erro. Pelo código da Evolution 2.4.0-rc, o texto que cita chega sem o `contextInfo` (a mídia mantém); você confirmou em 12/11 que a citação funciona num celular real, mas não sei se o texto e a mídia foram testados separadamente. Seguem ignoradas, com motivo, grupo (Sessão 6), localização, contato e enquete. Os exemplos de teste são sintéticos: o plano pedia eventos reais gravados, e isso não foi feito.", EM_S4),
  "4.4.3": feito("Juntar o número com e sem o nono dígito", "PR #10", "`variantesDoNumeroBrasileiro` devolve `[com o 9, sem o 9]` só do celular brasileiro (`55` + DDD + 8 dígitos que começam em 6 a 9; o fixo e o número de fora têm uma forma só). O recebimento procura o Contato pela forma que chegou e depois pela outra; o Contato novo grava a forma com o 9; e a resposta sai pelo número como o WhatsApp o conhece (o da última recebida), só se for o mesmo celular do Identificador. Dois Contatos que já existiam, um com cada forma, não são mesclados sozinhos: a forma que chegou vence e juntá-los é o \"Mesclar\" da ficha. Publicado em 11/11; provado em Postgres local e com a Evolution de mentira, sem teste ao vivo com um celular sem o 9.", EM_S4),
  "4.4.4": feito("Enviar texto e mídia pela Evolution", "16-12 e PR #11", "A resposta escrita na Caixa sai pela instância do Canal (texto, imagem, vídeo, documento e áudio), e resposta ambígua nunca é reenviada sozinha. A resposta citada leva `quoted` (id da Mensagem, chat, de quem era e o texto) em texto, mídia e áudio, e a tela ganhou o botão \"Responder\" (só no WhatsApp não oficial e em Mensagem com id do provedor). Áudio com texto sai como duas mensagens. Texto e imagem chegaram ao celular na prova ao vivo de 10/11, e o texto de novo em 11/11; a citação enviada pelo \"Responder\" foi confirmada por você em 12/11; o áudio ainda não foi visto num celular.", EM_S4),
  "4.4.5": feito("Gravar tiques, reações", "PR #11", "No ar desde 11/11, com o webhook das duas instâncias ligadas reaplicado em 12/11 (`npm run canal:atualizar-webhook-evolution`, com os cinco eventos). O domínio tipa `Reacao`, `MarcacaoDeExclusao` e `EdicaoExterna` e traz as regras da ontologia: a Reação é um registro de acréscimo (vale a última de cada autor), a exclusão é terminal e a edição só vale para a Mensagem recebida (o conteúdo anterior vai ao histórico). O tradutor entende `messages.update` (o tique), `messages.delete`, `messages.edited` e a reação dentro do upsert; o processador os aplica na Mensagem que já existe, sem criar nada. A tela mostra a reação embaixo da bolha, \"Mensagem apagada\" (o conteúdo continua guardado, mas não é exibido), a marca \"editada\" e a citação. Você confirmou em 12/11, com um celular real, o tique, a edição, a apagada, a reação e a citação: os formatos lidos no código da Evolution 2.4.0-rc2 batem com o que ela manda. Limites: dar Reação pela tela não existe (só se mostra), e reação, edição e apagada em grupo são da Sessão 6.", "2026-11-12"),
  "4.5.1": feito("Testar com dois números reais", "dono, 12/11", "Você deu por concluído em 12/11, ao fechar a sessão. Eu não conferi o roteiro do plano (o mesmo Contato com uma Conversa por Canal e cada resposta saindo pelo número da Conversa). O que está provado com celular real é um número por vez: conectar, receber, a mensagem digitada no celular, enviar, tique, edição, apagada, reação, citação e desconectar.", "2026-11-12"),
  "4.5.2": {
    ...feito("Os avisos do Financeiro passam", "decisão 4.5.2", "O item é de arrumação (\"pode seguir a recomendação\"): seguiu-se a (B) do plano. Nada muda no código; os avisos seguem pelo `automation/` e a instância dele nunca é tocada pelo CRM (o cliente só cria e apaga instância `n1-...`). Não foi uma escolha sua em palavras: se quiser a (A), a decisão se reabre.", EM_S4),
    decidido: "Escolha B: os avisos do Financeiro continuam pelo `automation/`, como estão. A (A) fica para uma sessão do Financeiro, depois de duas semanas com os números estáveis e usando um número novo, nunca a instância do `automation/`.",
  },

  // Sessão 5 · Lista conversacional. Em 12/11 a sessão foi conferida contra a `main` do n1 (`4d2fdf0`) e não tinha começado. Depois disso
  // foi implementada (commit `6587eba`, PR #13), a api subiu na VM em 12/11 às 20:37 UTC e o PR foi mesclado em 13/11 (`70057ec`; a web
  // da Vercel de produção publicou no merge). Em 13/11 o dono disse que já fez os testes com um celular (5.3.1) e mandou marcar tudo
  // como concluído: a 5.1.5, 5.1.6, 5.2.1, 5.2.2 e 5.3.1 ficam `feito` sobre esse aceite, sem o detalhe de cada passo (como a 4.5.1).
  // As três decisões ficam `feito` porque a escolha existe, mesmo sem palavra do dono (ver as notas, como na 4.5.2).
  // 5.1
  "5.1.1": {
    ...feito("Mensagem nova cria Tarefa?", "decisão 5.1.1", "Você mandou implementar a S5 sem responder esta decisão, então seguiu-se a recomendação do plano. Não foi uma escolha sua em palavras: se quiser a (B), a decisão se reabre e o código muda numa regra só (`tarefaDaRecebida`).", EM_S5),
    decidido: "Escolha A: a mensagem de um Contato sem Tarefa aberta na Lista do Canal cria uma Tarefa; com Tarefa aberta, só o cartão se atualiza (ele já mostra a última mensagem).",
  },
  "5.1.2": {
    ...feito("E se o Canal estiver em mais de uma Lista", "decisão 5.1.2", "Seguiu-se a recomendação do plano, não uma escolha sua em palavras. A regra está no domínio (`validarCanaisDeAtendimento`): marcar o Canal numa segunda Lista, criando a Lista, configurando ou instanciando um Template, é recusado com o nome do Canal e o da Lista que já o atende. Lista arquivada ou na lixeira não segura o Canal. Os testes de domínio e de api que punham o mesmo Canal em duas Listas foram ajustados. Dado antigo com um Canal em duas Listas não é mexido: a mensagem cria a Tarefa na primeira Lista do estado.", EM_S5),
    decidido: "Escolha A: um Canal só atende em uma Lista conversacional; marcá-lo em outra é recusado.",
  },
  "5.1.3": {
    ...feito("E se a Tarefa do Contato já estiver concluída", "decisão 5.1.3", "Seguiu-se a recomendação do plano, não uma escolha sua em palavras. O plano não dizia o que fazer quando a Tarefa está concluída e a Mensagem cai numa Conversa que já estava aberta (nem nova, nem reaberta agora). Decidi seguir a Conversa também aí: a Tarefa encerrada daquela Conversa reabre. O custo: um \"obrigado\" depois de concluir a Tarefa, com a Conversa ainda aberta, reabre a Tarefa. A alternativa (não fazer nada) deixaria a mensagem fora da Lista, que é a fila de atendimento. Trocar é mudar uma linha de `tarefaDaRecebida`.", EM_S5),
    decidido: "Escolha C: a Tarefa segue a Conversa. A Tarefa concluída da mesma Conversa reabre no Status inicial da Lista; se nasceu uma Conversa nova, nasce uma Tarefa nova e a concluída fica como histórico.",
  },
  "5.1.4": feito("Decidir no domínio o que a mensagem", "PR #13", "Em produção e testado no domínio: `tarefaDaRecebida` (nada, criar ou reabrir), `aplicarTarefaDaRecebida` e `autorizadorDaTarefaDaRecebida`, com testes de cada caso do plano (Contato sem Tarefa, com Tarefa aberta, concluída com Conversa reaberta, concluída com Conversa nova, Canal fora de qualquer Lista, Tarefa na lixeira, Lista arquivada) e da repetição do passo. Dois desvios do plano: a função não recebe \"a Conversa nasceu ou reabriu agora\" (o Vínculo \"conversa da Tarefa\" diz o mesmo e deixa o passo repetível sem duplicar), e devolve `reabrir` no lugar de `atualizar`. Mesclado em 13/11 (PR #13) e usado pelo processador de entrada em produção. Não depende de celular: é uma função pura, provada por teste.", EM_S5_MESCLADA),
  "5.1.5": feito("Criar ou atualizar a Tarefa quando a mensagem", "PR #13", "Em produção: depois de `receberMensagem`, o processador de entrada chama `servicos/crm/tarefa-da-mensagem.ts`, que cria a Tarefa ou reabre a concluída num gesto só e avisa a tela. Se o passo falha, a linha volta à fila e repetir não duplica a Mensagem nem a Tarefa. Desvio do plano: o ator não é o \"Agente do pipeline\", porque ele é Convidado e Convidado não cria Tarefa; quem assina é o sistema, pelo Canal, e o responsável é o atribuído da Conversa quando há. Provado em Postgres local com o provedor de teste: a primeira mensagem de um número novo cria Contato, Conversa, Mensagem e uma Tarefa; a segunda e a repetição do mesmo webhook não criam outra; Canal fora da Lista não cria; Contato arquivado e Lista sem quem possa escrever não derrubam a linha. Roda só onde `MENSAGERIA_WORKER_ATIVO=true`, e está ligado em produção. A api está na VM desde 12/11 às 20:37 UTC (`6587eba`, sem migração), o PR foi mesclado em 13/11 e a VM já roda o mesmo código do merge; o `/saude` responde e o log não mostrou aviso nem erro. Com o celular, vale o seu aceite de 13/11 (roteiro 5.3.1): você disse que já fez os testes e mandou marcar como concluído; não recebi o detalhe de cada passo.", EM_S5_MESCLADA),
  "5.1.6": feito("Mostrar a Tarefa nova", "Fase 16 (3.8.4) e PR #13", "O evento `mensagem.nova` já revalidava o resumo das Tarefas e o cartão mostra o trecho da última mensagem (Fase 16). Desde o merge (13/11, web da Vercel em produção), `mensagem.nova` e `conversa.mudou` (que a api manda depois de criar ou reabrir a Tarefa) também pedem a revisão do Espaço, para a Tarefa nova aparecer sem esperar a releitura de 5 s; se o pedido chega com a pergunta de revisão em voo, ela repete uma vez. Provado em testes de componente e de store e, no navegador, pelo seu teste de 13/11 (roteiro 5.3.1). Você não me passou a medida dos \"menos de 2 s\": o aceite é seu, sem número.", EM_S5_MESCLADA),
  // 5.2
  "5.2.1": feito("Responder sempre pela Conversa", "Fases 14 e 15 e PR #13", "Você já criava a Lista conversacional e respondia pela ficha (Sessões 3 e 4). Desde o merge (13/11), o fio da ficha fica preso à Conversa da Tarefa (`conversaFixaId`): só mostra a aba do Canal dela, o envio vai por ela e o \"Responder por\" oferece só os Canais da Lista. Escolher outro ali não troca de aba: abre o mesmo diálogo \"Trocar o Canal da Tarefa\" do seletor \"Canal\" da ficha. Sem a prop (Caixa de Entrada, ficha do Contato) nada muda. Efeito colateral aceito: o fio da Tarefa deixa de mostrar as abas dos outros Canais (a Conversa deles está em \"Abrir na Caixa de Entrada\"). Está na web de produção desde o merge. Provado em testes de componente e pelo seu teste de 13/11 (roteiro 5.3.1), sem o detalhe de cada passo; eu não abri a tela num navegador autenticado.", EM_S5_MESCLADA),
  "5.2.2": feito("Testar a resposta contra a Evolution", "PR #13", "O teste existe (`apps/api/src/e2e/lista-conversacional-evolution.test.ts`, mesclado em 13/11) e roda sempre, contra o servidor falso da Evolution: cria a Tarefa pela rota, a primeira Mensagem sai pela instância do Canal, fica `enviada` com o id da Evolution e `entregue` quando o aviso de entrega chega pelo webhook. Contra uma Evolution de homologação roda só com `EVOLUTION_HOMOLOGACAO_URL`, `_INSTANCIA`, `_APIKEY` e `_DESTINO` (manda mensagem de verdade e recusa a instância do Financeiro), e esse bloco NUNCA rodou: não há Evolution de homologação configurada aqui. Nele o `entregue` não é provado, porque o aviso da Evolution vai para a URL pública da api, não para o teste; isso ficou no passo 4 da 5.3.1, que você fez com um celular em 13/11 (sem o detalhe de cada passo). O bloco de homologação segue sem rodar.", EM_S5_MESCLADA),
  // 5.3
  "5.3.1": feito("Percorrer o roteiro com um celular", "dono, 13/11", "Você disse em 13/11 que já fez os testes e mandou marcar tudo como concluído. Não recebi o detalhe de cada um dos seis passos (a Tarefa nascendo com o cartão mostrando “oi”, a resposta chegando com “entregue”, o áudio, concluir a Tarefa e mandar outra mensagem), então o que está registrado é o seu aceite, não uma prova que eu tenha visto.", EM_S5_MESCLADA),
};

// Subtarefas que pertencem a uma Fase que ainda não começou. Ficam fora do "feitas/total" da tarefa e da sessão
// (que mede o escopo já em execução) e ganham o selo da Fase. Quando a Fase começar, tire a linha daqui e
// marque as subtarefas em ANDAMENTO. `subs` trava a conta: se a tarefa mudar de tamanho, o gerador para.
// Vazia desde 11/11: a Sessão 3 está registrada por inteiro (Fase 14 = 3.1 a 3.3, Fase 15 = 3.4 e 3.5, Fase 16 = 3.6 a 3.9)
// e a 3.4 e a 3.5 saíram daqui. Uma Fase futura volta a entrar como `{ tarefa: "x.y", fase: n, subs: <total>, de: 1 }`.
const FUTURAS = [];

// Tarefas sem subtarefas que o dono deu por concluídas (a 2.7 só recebe itens quando ele relata algo nos testes).
// Se entrar subtarefa nela, o gerador para: a conta passa a ser a das subtarefas.
const CONCLUIDAS = {
  "2.7": { em: "2026-11-04", nota: "Você deu a tarefa por concluída em 04/11. Se algo novo aparecer nos testes, entra aqui como subtarefa." },
};

export function aplicarAndamento(sessoes) {
  const porId = new Map();
  for (const s of sessoes) for (const t of s.tarefas) t.subs.forEach((su, i) => porId.set(`${t.id}.${i + 1}`, su));
  for (const [id, a] of Object.entries(ANDAMENTO)) {
    const su = porId.get(id);
    if (!su) throw new Error(`andamento.mjs: a subtarefa ${id} não existe no plano`);
    if (!su.n.startsWith(a.confere)) {
      throw new Error(`andamento.mjs: ${id} mudou de nome (esperava começar com "${a.confere}", achou "${su.n.slice(0, 50)}")`);
    }
    const { confere, decidido, ...andamento } = a;
    su.feito = andamento;
    if (decidido) su.decidido = decidido;
  }
  const tarefas = new Map(sessoes.flatMap((s) => s.tarefas.map((t) => [t.id, t])));
  for (const f of FUTURAS) {
    const t = tarefas.get(f.tarefa);
    if (!t) throw new Error(`andamento.mjs: a tarefa ${f.tarefa} não existe no plano`);
    if (t.subs.length !== f.subs) throw new Error(`andamento.mjs: a tarefa ${f.tarefa} tem ${t.subs.length} subtarefas, esperava ${f.subs}`);
    t.subs.forEach((su, i) => {
      if (i + 1 < f.de) return;
      if (su.feito) throw new Error(`andamento.mjs: ${f.tarefa}.${i + 1} está feita e também marcada como da Fase ${f.fase}`);
      su.fase = f.fase;
    });
  }
  for (const [id, c] of Object.entries(CONCLUIDAS)) {
    const t = tarefas.get(id);
    if (!t) throw new Error(`andamento.mjs: a tarefa ${id} não existe no plano`);
    if (t.subs.length) throw new Error(`andamento.mjs: a tarefa ${id} ganhou subtarefas; tire-a de CONCLUIDAS e marque cada uma em ANDAMENTO`);
    t.concluida = c;
  }
  return sessoes;
}
