// Parte e do plano (ver dados/index.mjs). Edite aqui e rode `node docs/09-planejamento/gerar.mjs`.
export const SESSOES = [
  {
    "id": "T",
    "n": "Reunião 1 de escopo da IA",
    "trilha": true,
    "inicioFixo": "2026-10-19",
    "duracao": 1,
    "dep": [],
    "realizada": true,
    "desc": "Realizada em 19/10. Abaixo, o que ficou decidido, o que cada decisão muda no plano e os pontos que merecem atenção. O que não foi decidido foi para o levantamento de escopo da IA (T2), com prazos.",
    "partida": [
      "Nenhuma IA de verdade estava ligada ao produto: as telas existiam, mas as respostas eram texto pronto ou não aconteciam."
    ],
    "pronto": "Realizada em 19/10. Seis decisões registradas.",
    "tarefas": [
      {
        "id": "T.1",
        "n": "O que foi decidido",
        "objetivo": "As seis decisões da reunião de 19/10, com o que cada uma muda no plano.",
        "pronto": "Decisões registradas.",
        "subs": [
          {
            "n": "O que é um Plugin",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Um pacote que junta Skills, Conhecimento e Automações e se instala num Agente de uma vez.",
            "muda": "Plugin vira um tipo novo no domínio e uma tela própria, na Sessão 18. A aba atual “Plugins”, que só lista Ferramentas, passa a se chamar “Ferramentas”.",
            "atencao": "Na sua nota, o Plugin não inclui Ferramentas nem Integrações. Um Plugin que dependa de uma Integração (por exemplo, um Plugin Financeiro que usa o Omie) só funciona onde ela estiver conectada."
          },
          {
            "n": "O que é uma Integração",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Uma conexão que o time escolhe colocar, em dois níveis: da empresa (todos usam a mesma, como o Omie) e pessoal (cada pessoa conecta a sua, como a Google Agenda). Começa com Omie, Google Agenda e Miro. Usar o Composio, se der.",
            "muda": "Entra uma sessão nova, a Sessão 15 · Integrações. Hoje a Integração não tem dono (`Integration`, `packages/dominio/src/types/workspace.ts:182`) e conectar só troca o estado na tela; ela ganha o nível empresa ou pessoal e passa a conectar de verdade.",
            "atencao": "O Composio tem Google Agenda e Miro e foi feito para conexões por usuário, mas não tem o Omie: a página do toolkit não existe. O Omie fica como Ferramenta nossa, chamando a API do Omie com a chave da empresa guardada no cofre da Sessão 1. Preço por chamada e onde os tokens dos usuários ficam guardados ainda precisam ser confirmados: as fontes que achei se contradizem. Por isso o levantamento de escopo da IA traz uma prova de conceito do Composio (T2.2)."
          },
          {
            "n": "O que é o Conhecimento",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Banco vetorial padrão.",
            "muda": "Confirma o `pgvector` no Postgres que já usamos, na Sessão 17. Falta escolher o modelo que gera os embeddings (decisão 17.4.1)."
          },
          {
            "n": "O que é uma Automação",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Uma rotina escrita em código pelo time, sem botão de criar na tela. O Agente consegue acioná-la. A lista das Automações ainda vai ser definida.",
            "muda": "A Sessão 18 troca o editor visual por um catálogo em código e deixa o Agente acionar as Automações. Saem as tarefas antigas de completar o editor: ramificar, acionar pela tela e consertar Notificar e Aguardar.",
            "atencao": "Hoje existe um editor visual de 1.310 linhas, e as Automações do Financeiro rodam sozinhas, por evento e por horário. Ficaram em aberto duas perguntas: uma Automação também roda sozinha ou só quando um Agente chama? E o que acontece com as do Financeiro? A Sessão 18 fica bloqueada até a lista chegar."
          },
          {
            "n": "O que é uma Habilidade",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Uma Skill em arquivo .md.",
            "muda": "A Habilidade de hoje (com versões, contratos de entrada e saída e requisitos de Ferramenta, `packages/dominio/src/types/ai.ts:58-84`) vira um texto `SKILL.md`: nome e descrição no cabeçalho e as instruções no corpo. É o mesmo formato dos Agent Skills do Claude. Entra na Sessão 14, e a aba “Habilidades” passa a se chamar “Skills”."
          },
          {
            "n": "O que um Agente pode receber",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "decidido": "Cinco poderes: Ferramenta, Base de conhecimento, Integração, Plugin e Skill. Avaliar se existe um framework para construir os Agentes.",
            "muda": "O Construtor, na Sessão 14, passa a ter um passo para cada poder. A escolha do framework é o primeiro item do levantamento (T2.1), em 20/10.",
            "atencao": "Dois pontos: falta decidir se uma Ferramenta nova se cria só no código ou também pela tela (por exemplo, uma chamada HTTP configurada com endereço e credencial), o que foi para o levantamento (T2.4). E as Automações também precisam entrar como poder, porque a sua nota diz que o Agente as aciona."
          }
        ]
      }
    ],
    "vocab": [
      [
        "Agente",
        "O funcionário virtual. Recebe poderes: Ferramentas, Conhecimento, Integrações, Plugins, Skills e as Automações que pode acionar.",
        "Atendente comercial que responde leads no WhatsApp"
      ],
      [
        "Ferramenta",
        "Uma ação que o Agente executa no sistema ou fora dele: ler e gravar registros, chamar um endereço HTTP.",
        "Criar uma Tarefa; consultar uma conta no Omie"
      ],
      [
        "Skill",
        "Um arquivo .md com as instruções de como fazer um trabalho.",
        "qualificar-lead.md"
      ],
      [
        "Conhecimento",
        "A biblioteca que o Agente consulta, buscada por significado num banco vetorial.",
        "Tabela de preços, política de reembolso"
      ],
      [
        "Automação",
        "Uma rotina escrita em código pelo time, que o Agente pode acionar. Não se cria pela tela.",
        "A lista ainda vai ser definida por você"
      ],
      [
        "Integração",
        "Uma conexão com um sistema de fora. Da empresa (todos usam a mesma) ou pessoal (cada um conecta a sua).",
        "Omie (empresa); Google Agenda (pessoal); Miro"
      ],
      [
        "Plugin",
        "Um pacote que junta Skills, Conhecimento e Automações e se instala num Agente de uma vez.",
        "Plugin Financeiro: Skill de conferência, base do plano de contas e a Automação de lançamento"
      ]
    ],
    "sigla": "R1"
  },
  {
    "id": "T2",
    "sigla": "LV",
    "selo": "Pesquisa",
    "n": "Levantamento de escopo da IA",
    "trilha": true,
    "inicioFixo": "2026-10-20",
    "fimFixo": "2026-10-22",
    "dep": [
      "T"
    ],
    "desc": "Três dias de pesquisa, não de desenvolvimento. Você pesquisa cada ponto que ficou aberto na Reunião 1 e decide no dia marcado para ele. Cada item diz o que pesquisar, as opções, o que cada opção muda no plano e a minha recomendação. Quando decidir um item, me mande a resposta: eu registro no planejamento (o item vira “Decidida”) e ajusto as sessões que ele afeta.",
    "partida": [
      "Seis decisões tomadas na Reunião 1 (19/10).",
      "18 decisões em aberto e a lista de Automações, agrupadas por assunto abaixo."
    ],
    "pronto": "Todos os itens decididos e registrados no planejamento até qui 22/10.",
    "tarefas": [
      {
        "id": "T2.1",
        "n": "Base da IA: framework e modelo",
        "inicio": "2026-10-20",
        "prazo": "2026-10-20",
        "objetivo": "As duas escolhas que tudo o mais da IA usa. Precisam vir primeiro.",
        "pronto": "Framework e modelo decididos.",
        "subs": [
          {
            "n": "Qual framework usar para os Agentes?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-20",
            "bloqueia": "13",
            "pesquisar": [
              "Ler a documentação do Tool Runner do SDK da Anthropic (TypeScript), de Managed Agents e do Claude Agent SDK.",
              "Responder para cada um: o Agente roda no nosso servidor, com a permissão de quem pergunta? Dá para pedir aprovação antes de uma Ferramenta que grava? A resposta chega aos poucos na tela? Como se mede o custo?",
              "Opcional: uma prova de conceito no `apps/api`, com uma Ferramenta que lista as Tarefas do Membro. Posso fazer em paralelo enquanto você pesquisa os outros itens."
            ],
            "hoje": "Não há IA ligada ao produto.",
            "opcoes": [
              "(A) SDK da Anthropic com o Tool Runner, rodando no nosso servidor",
              "(B) Managed Agents: a Anthropic roda o Agente e um ambiente de arquivos para ele",
              "(C) Claude Agent SDK: o Claude Code como biblioteca"
            ],
            "muda": "Define a base da Sessão 13 e de todas as sessões de IA depois dela.",
            "recomendo": "(A). As Ferramentas são operações do nosso domínio e precisam rodar no nosso servidor, com a permissão do Membro. O Tool Runner dá o laço pronto e um ponto para pedir aprovação antes de executar. O mesmo SDK aceita servidores MCP, como o do Composio.",
            "peso": "produto"
          },
          {
            "n": "Qual modelo de IA usar?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-20",
            "bloqueia": "13",
            "pesquisar": [
              "Ver a página de preços da Anthropic.",
              "No Console da Anthropic, fazer a mesma tarefa típica (por exemplo, resumir uma Conversa e sugerir a resposta) nos três modelos e comparar qualidade e tempo."
            ],
            "hoje": "Os três modelos que aparecem no seletor do Chat são fictícios.",
            "opcoes": [
              "(A) Um só, o mais forte: Claude Opus 5.5 (US$ 4 por milhão de tokens de entrada e US$ 20 de saída)",
              "(B) Dois: Claude Haiku 5.5 (US$ 0,10 e US$ 0,50) para respostas simples e Claude Opus 5.5 para tarefas complexas, com cada Agente escolhendo o seu",
              "(C) Um só, intermediário: Claude Sonnet 5.5 (US$ 2 e US$ 10)"
            ],
            "muda": "A Sessão 13 liga o produto aos modelos escolhidos. Preços da tabela da Anthropic de outubro de 2026.",
            "recomendo": "(B).",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "T2.2",
        "n": "Integrações",
        "inicio": "2026-10-20",
        "prazo": "2026-10-20",
        "objetivo": "Como as Integrações da empresa e as pessoais funcionam, e se o Composio serve.",
        "pronto": "As três escolhas feitas.",
        "subs": [
          {
            "n": "Usar o Composio para Google Agenda e Miro?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-20",
            "bloqueia": "15",
            "pesquisar": [
              "Criar uma conta gratuita no Composio, conectar a sua Google Agenda e um quadro do Miro, e testar uma ação de cada (listar eventos, listar quadros).",
              "Anotar: o preço do plano que serve; onde ficam guardados os tokens das pessoas; se dá para rodar no nosso servidor; como uma conexão fica “da empresa” ou “de uma pessoa”.",
              "Conferir se a Google Agenda e o Miro têm servidor MCP oficial, que seria a alternativa sem o Composio.",
              "Lembrar: o Composio não tem o Omie."
            ],
            "hoje": "Nenhuma Integração conecta de verdade: conectar só troca o estado na tela.",
            "opcoes": [
              "(A) Composio para tudo o que ele tiver; o Omie e o que faltar viram Ferramentas nossas",
              "(B) Integrações nossas para tudo, uma por uma"
            ],
            "muda": "Com (A), a Sessão 15 faz só a ponte com o Composio e as telas de conexão, e cada Integração nova do catálogo dele custa pouco; em troca, paga-se por chamada e depende-se de um serviço de fora. Com (B), cada Integração é código nosso, cerca de 1 a 2 dias por Integração.",
            "recomendo": "(A), se o preço e o lugar onde os dados ficam forem aceitáveis.",
            "peso": "produto"
          },
          {
            "n": "Onde a pessoa conecta as Integrações?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-20",
            "bloqueia": "15",
            "pesquisar": [
              "Ver como o ClickUp, o HubSpot ou o Notion separam as integrações da empresa das pessoais."
            ],
            "ver": "Configurações › Integrações e IA › Personalizar › Integrações.",
            "hoje": "Duas telas listam as mesmas Integrações: IA › Personalizar › Integrações e Configurações › Integrações.",
            "opcoes": [
              "(A) As da empresa em Configurações › Integrações (só administrador); as pessoais em Minha conta › Conexões (cada um a sua)",
              "(B) Tudo numa tela só, com uma coluna “empresa / pessoal”"
            ],
            "muda": "Define as telas da Sessão 15. Nos dois casos, a aba de Integrações de IA › Personalizar sai do menu.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          },
          {
            "n": "Quando o Agente usa uma Integração pessoal, de quem é a conexão?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-20",
            "bloqueia": "15",
            "pesquisar": [
              "Pensar em três casos reais da Tria. Por exemplo: o Agente marca uma reunião, na agenda de quem? Cria uma nota no Miro, no quadro de quem?"
            ],
            "hoje": "Ainda não existe conexão pessoal.",
            "opcoes": [
              "(A) De quem está conversando com o Agente no Chat; num atendimento de cliente pela Caixa de Entrada, só as conexões da empresa",
              "(B) Sempre a do dono do Agente"
            ],
            "muda": "Define a regra de permissão das Integrações nas Sessões 15 e 16. Com (B), um Agente compartilhado usaria a agenda do dono para todo mundo.",
            "recomendo": "(A).",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "T2.3",
        "n": "Custo, memória e telas do Chat",
        "inicio": "2026-10-21",
        "prazo": "2026-10-21",
        "objetivo": "O que a Sessão 13 precisa saber para ligar a IA com segurança: quanto gastar, o que guardar e o que a pessoa vê.",
        "pronto": "As três escolhas feitas, com os valores do teto.",
        "subs": [
          {
            "n": "Quanto a IA pode gastar por mês?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "13",
            "pesquisar": [
              "Estimar quantas conversas com IA a Tria terá por dia: no Chat interno e, mais tarde, no atendimento a clientes.",
              "Multiplicar pelo custo de uma resposta medido no teste do modelo (T2.1)."
            ],
            "hoje": "Não há limite, porque não há IA ligada.",
            "opcoes": [
              "Teto mensal por empresa, por Agente ou os dois: diga o valor em reais",
              "Ao chegar no teto: (A) só avisa; (B) pausa o Agente; (C) passa a pedir aprovação para tudo"
            ],
            "muda": "A Sessão 13 grava quanto cada resposta custou e confere o teto antes de chamar a IA.",
            "recomendo": "Os dois tetos; aviso ao chegar em 80% e pausa em 100%.",
            "peso": "produto"
          },
          {
            "n": "O que o Agente lembra de uma conversa para outra?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "14",
            "pesquisar": [
              "Listar o que vale o Agente lembrar (por exemplo, como o cliente prefere ser chamado, o que ele já comprou).",
              "Confirmar com quem cuida de LGPD na Tria por quanto tempo guardar o histórico."
            ],
            "hoje": "Existe um espaço de memória do Agente, mas nada grava nele. O histórico de cada trabalho do Agente fica guardado para sempre.",
            "opcoes": [
              "Entre conversas: (A) o Agente guarda fatos úteis, e a pessoa pode ver e apagar; ou (B) cada conversa começa do zero",
              "Histórico de cada trabalho do Agente: guardar por 90 dias, 1 ano ou para sempre"
            ],
            "muda": "Define a memória da Sessão 14 e a limpeza automática da Sessão 19.",
            "recomendo": "(A), e guardar o histórico por 1 ano.",
            "peso": "produto"
          },
          {
            "n": "O que a pessoa vê no Chat depois de mandar uma mensagem?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "13",
            "pesquisar": [
              "Usar o Claude.ai, o ChatGPT e o Copilot numa tarefa com várias etapas e anotar o que cada um mostra enquanto trabalha e como pede confirmação antes de agir."
            ],
            "ver": "IA › Chat: mande uma mensagem.",
            "hoje": "A mensagem fica gravada e aparece um aviso de protótipo. Não há resposta.",
            "opcoes": [
              "Enquanto o Agente trabalha, mostrar o que ele está fazendo (“consultando suas Tarefas…”)? Sim ou não",
              "Quando ele precisa de licença, o botão Aprovar aparece na própria conversa? Ou só na fila de aprovações?",
              "No fim, a conversa lista o que ele fez (Tarefa criada, mensagem enviada)? Sim ou não"
            ],
            "muda": "Define a tela do Chat da Sessão 13 e onde ficam as aprovações da Sessão 14.",
            "recomendo": "Sim, na própria conversa, e sim.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "T2.4",
        "n": "Agentes e Ferramentas",
        "inicio": "2026-10-21",
        "prazo": "2026-10-21",
        "objetivo": "Como nasce uma Ferramenta nova e como se cria um Agente.",
        "pronto": "As duas escolhas feitas.",
        "subs": [
          {
            "n": "Como nasce uma Ferramenta nova?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "14",
            "pesquisar": [
              "Listar as 10 primeiras Ferramentas que os Agentes da Tria vão precisar (por exemplo: criar Tarefa, consultar Contato, consultar conta no Omie, marcar reunião).",
              "Marcar em cada uma se ela é do nosso sistema ou de um sistema de fora (chamada HTTP)."
            ],
            "hoje": "As Ferramentas são uma lista fixa no código (`TOOLS`, `packages/dominio/src/seed.ts:2596`), e nenhuma executa de verdade.",
            "opcoes": [
              "(A) Só no código: o time escreve cada Ferramenta",
              "(B) Também pela tela: um administrador configura uma Ferramenta de HTTP (endereço, método, credencial do cofre) ou de tabela (quais campos o Agente lê e grava)",
              "(C) (A) agora e (B) depois"
            ],
            "muda": "(A) cabe na Sessão 14. (B) soma cerca de 3 dias e abre um risco: um Agente com acesso a qualquer endereço da internet.",
            "recomendo": "(C).",
            "peso": "produto"
          },
          {
            "n": "Quais são os passos para criar um Agente?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "14",
            "pesquisar": [
              "Criar um agente em dois produtos (por exemplo, os GPTs do ChatGPT e os agentes do Copilot Studio) e anotar os passos de cada um."
            ],
            "ver": "IA › Agentes › Novo Agente.",
            "hoje": "O Construtor pergunta nome, descrição, instruções e uma frase de abertura, e a prévia responde texto pronto.",
            "opcoes": [
              "(A) 1) o que ele faz; 2) como se comporta; 3) Ferramentas; 4) Conhecimento; 5) Integrações; 6) Plugins; 7) Skills; 8) Automações que pode acionar; 9) quanto age sozinho; 10) onde atende; 11) testar numa conversa de ensaio; 12) publicar",
              "(B) Os passos com mudanças (diga quais)"
            ],
            "muda": "A Sessão 14 constrói o Construtor nesses passos, com uma IA que ajuda a preencher cada um.",
            "recomendo": "(A).",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "T2.5",
        "n": "O Agente atendendo clientes",
        "inicio": "2026-10-21",
        "prazo": "2026-10-21",
        "objetivo": "Como o Agente pega uma Conversa de cliente, com quanta liberdade, e o que acontece quando ninguém aprova a tempo.",
        "pronto": "As três escolhas feitas.",
        "subs": [
          {
            "n": "Como o Agente pega uma Conversa de cliente?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "16",
            "pesquisar": [
              "Mapear como o atendimento da Tria funciona hoje: quem atende primeiro, quando a conversa passa para outra pessoa e por quê."
            ],
            "hoje": "O Construtor tem um campo “Onde atende” (Chat, WhatsApp, API, Webhook), mas nada usa esse campo.",
            "opcoes": [
              "(A) Por Conversa: cada Canal tem um Agente padrão que recebe as Conversas novas, e uma pessoa pode clicar em “Assumir” a qualquer momento e depois devolver",
              "(B) Por canal: o Agente atende tudo o que chega pelos canais marcados, sem uma pessoa poder assumir"
            ],
            "muda": "Com (A), a Sessão 16 cria o Agente padrão do Canal e o botão “Assumir”, e o campo “Onde atende” sai do Construtor.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "Com quanta liberdade o Agente começa a responder clientes?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "16",
            "pesquisar": [
              "Escolher os dois primeiros Agentes que vão atender clientes e decidir, para cada um, o que ele pode responder sozinho."
            ],
            "hoje": "Três níveis: assistido (pede licença para quase tudo), supervisionado (pede licença para mandar mensagem a cliente e para o que não dá para desfazer) e autônomo (não pede).",
            "opcoes": [
              "(A) Supervisionado: a resposta fica como rascunho na Conversa e uma pessoa aprova com um clique",
              "(B) Autônomo desde o início"
            ],
            "muda": "Define o modo que todo Agente novo recebe. Os dois modos são construídos na Sessão 16.",
            "recomendo": "(A) nas primeiras semanas; depois, autônomo Agente por Agente.",
            "peso": "produto"
          },
          {
            "n": "Onde a pessoa aprova, e o que acontece se ninguém aprovar a tempo?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-21",
            "bloqueia": "14",
            "pesquisar": [
              "Definir quem vai aprovar as respostas do Agente e em quanto tempo essa pessoa consegue responder num dia normal."
            ],
            "ver": "IA › Aprovações.",
            "hoje": "Há dois tipos de aprovação na mesma tela (IA › Aprovações): o do Financeiro, que funciona e não tem prazo, e o do Agente, que ainda não existe de verdade e teria prazo de 72 h.",
            "opcoes": [
              "Onde: (A) numa fila só, com atalho na barra do topo, ao lado de Minhas Tarefas; ou (B) cada tipo no seu lugar: pagamento no Financeiro e pedido do Agente dentro da própria Conversa",
              "Quanto tempo o pedido do Agente espera numa Conversa com cliente: 72 h ou 4 h",
              "Se ninguém aprovar a tempo: o Agente desiste, ou a Conversa passa para uma pessoa"
            ],
            "muda": "Define onde a Sessão 14 mostra os pedidos e o que a Sessão 16 faz quando um pedido vence.",
            "recomendo": "(A), 4 h, e a Conversa passa para uma pessoa: um cliente não pode ficar três dias sem resposta.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "T2.6",
        "n": "Automações",
        "inicio": "2026-10-22",
        "prazo": "2026-10-22",
        "objetivo": "Como as Automações em código convivem com o que já roda, e quais são.",
        "pronto": "As duas escolhas feitas e a lista entregue.",
        "subs": [
          {
            "n": "Uma Automação roda sozinha ou só quando um Agente chama?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-22",
            "bloqueia": "18",
            "pesquisar": [
              "Ver as Automações do Financeiro que rodam hoje (IA › Personalizar › Automação) e o que acontece no Contas a pagar se elas pararem."
            ],
            "hoje": "As Automações do Financeiro rodam sozinhas: por evento (Tarefa criada, mudança de status) e por horário (vencimento).",
            "opcoes": [
              "(A) As duas coisas: roda sozinha quando tiver um gatilho no código, e um Agente também pode acioná-la",
              "(B) Só quando um Agente chama"
            ],
            "muda": "(B) obriga a reescrever as Automações do Financeiro como algo que um Agente dispara, ou elas param de rodar.",
            "recomendo": "(A).",
            "peso": "produto"
          },
          {
            "n": "O que acontece com o editor e as Automações que já existem?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-22",
            "bloqueia": "18",
            "pesquisar": [
              "Mesma consulta do item anterior: quais Automações existem e quem depende delas."
            ],
            "ver": "IA › Personalizar › Automação.",
            "hoje": "Há um editor visual de Automações (`apps/web/src/features/ia/automacoes/editor-de-automacao.tsx`, 1.310 linhas), e as Automações do Financeiro rodam pelo motor do domínio.",
            "opcoes": [
              "(A) O editor sai; as Automações que existem continuam rodando e aparecem numa lista só de leitura",
              "(B) O editor sai, e as do Financeiro são reescritas como código no catálogo novo"
            ],
            "muda": "(A) cabe na Sessão 18. (B) soma cerca de 2 dias e exige cuidado para não parar o Financeiro.",
            "recomendo": "(A) agora; (B) quando as Automações em código estiverem rodando.",
            "peso": "produto"
          },
          {
            "n": "Entregar a lista das Automações",
            "cam": [
              "voce"
            ],
            "prazo": "2026-10-22",
            "bloqueia": "18",
            "hoje": "A lista ainda não existe.",
            "fazer": "Listar as Automações a implementar. Para cada uma: o que faz, quando roda (sozinha ou acionada por um Agente), quem pode acionar e quais dados usa.",
            "pronto": "Lista entregue. A Sessão 18 só começa com ela."
          }
        ]
      },
      {
        "id": "T2.7",
        "n": "Arrumação",
        "inicio": "2026-10-22",
        "prazo": "2026-10-22",
        "objetivo": "Três escolhas de organização. Não pedem pesquisa: basta concordar ou não com a recomendação.",
        "pronto": "As três escolhas feitas.",
        "subs": [
          {
            "n": "Onde se define o que o Agente pode consultar?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-22",
            "bloqueia": "14",
            "pesquisar": [
              "Nenhuma: ler a situação e a recomendação."
            ],
            "hoje": "No Construtor você marca as bases do Agente, mas é só um rótulo; o que vale de verdade é o acesso dado na Coleção.",
            "opcoes": [
              "(A) Vale o acesso da Coleção; o Construtor só mostra e edita esse acesso",
              "(B) Vale o que o Construtor marca, e ele cria o acesso"
            ],
            "muda": "Nos dois casos sobra um lugar só. (A) mantém a regra de permissão onde ela já está.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          },
          {
            "n": "No Chat, a pessoa pode escolher uma Skill para a conversa?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-22",
            "bloqueia": "14",
            "pesquisar": [
              "Nenhuma: ler a situação e a recomendação."
            ],
            "hoje": "Dá para escolher uma Habilidade no Chat, mas o sistema aceita qualquer uma se o pedido vier por fora da tela.",
            "opcoes": [
              "(A) Fica, só com as Skills que o Agente da conversa tem",
              "(B) Sai: o Agente decide sozinho qual Skill usar"
            ],
            "muda": "(A) corrige a regra. (B) tira o botão. Meio dia, na Sessão 14.",
            "recomendo": "(A).",
            "peso": "arrumacao"
          },
          {
            "n": "O que fazer com os “Agentes” do Financeiro que não usam IA?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "prazo": "2026-10-22",
            "bloqueia": "14",
            "pesquisar": [
              "Nenhuma: ler a situação e a recomendação."
            ],
            "hoje": "O “Agente de lançamento” é uma rotina fixa que lança contas no Omie, e o “Agente do pipeline” é um usuário de serviço.",
            "opcoes": [
              "(A) Renomear para o que são: “Rotina de lançamento” e “Usuário de serviço”",
              "(B) Transformar em Agentes de verdade, com IA"
            ],
            "muda": "(A) troca só textos, meio dia. (B) é um projeto à parte, com custo de IA a cada lançamento.",
            "recomendo": "(A) agora; (B) depois, se fizer sentido.",
            "peso": "arrumacao"
          }
        ]
      },
      {
        "id": "T2.8",
        "n": "Fechamento",
        "inicio": "2026-10-22",
        "prazo": "2026-10-22",
        "objetivo": "Conferir, no fim do terceiro dia, que tudo foi decidido e registrado.",
        "pronto": "Planejamento atualizado com todas as decisões.",
        "subs": [
          {
            "n": "Atualizar o planejamento com as decisões",
            "cam": [
              "voce"
            ],
            "prazo": "2026-10-22",
            "bloqueia": "13",
            "hoje": "Cada decisão é registrada à medida que você me manda a resposta.",
            "fazer": [
              "Conferir que nenhum item ficou sem resposta.",
              "Eu ajusto as Sessões 13 a 18 e as datas com o que foi decidido, e escrevo `docs/09-planejamento/ESCOPO-DA-IA.md` com todas as decisões da Reunião 1 e do levantamento.",
              "Você revisa e aprova."
            ],
            "pronto": "Nenhum item em aberto, e o documento de escopo aprovado."
          }
        ]
      }
    ]
  },
  {
    "id": "13",
    "n": "IA: ligação com o modelo e Chat respondendo",
    "dias": [
      4,
      5
    ],
    "dep": [
      "T2"
    ],
    "desc": "A base de todas as sessões de IA. O `apps/api` passa a falar com o Claude por um único arquivo, grava tokens e custo de cada chamada e serve uma rota de streaming. O Chat deixa de ser protótipo: a pergunta vira uma Execução, e a resposta chega aos poucos e fica gravada como mensagem do assistente.",
    "partida": [
      "`sendChatMessage` (`packages/dominio/src/operations/ai.ts:955`) grava só a mensagem do usuário, com `fileIds: []`; a tela avisa que é protótipo (`apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx:221`).",
      "`createChatSession` e `configureChatSession` (`ai.ts:675` e `:773`) já gravam Agente, Modelo, Habilidade, Âncora e pasta; sem Agente escolhido, responde o Assistente padrão (`workspace.defaultAgentId` = `agt_padrao`, também criado pelo bootstrap de produção).",
      "`AgentExecution` (`packages/dominio/src/types/ai.ts:256`) tem passos, custo (`ExecutionCost`, `:249`) e referências; hoje só o ensaio determinístico (`ensaiarAgente`, `operations/ia/agentes.ts:428`) cria Execuções.",
      "Os modelos são três fictícios (`MODELOS_DA_PLATAFORMA`, `seed.ts:2595`), copiados por Espaço em `plataforma.registros`.",
      "Toda gravação passa por `executar()` (`apps/api/src/persistencia/unidade-de-trabalho.ts:116`), uma transação com `statement_timeout` de 80% de 30 s: uma chamada ao modelo não cabe dentro dela.",
      "Dois defeitos achados: criar Agente pelo Construtor recebe 400, e “Permitir Ferramenta” não grava."
    ],
    "pronto": "Com `IA_ATIVA=true` em homologação, uma pergunta em `/ia/chat/<sessão>` recebe a resposta do Claude aparecendo aos poucos; a mensagem `assistente` fica gravada com `executionId`, a Execução fica `concluida` com tokens e custo, e a chamada aparece em `plataforma.consumo_de_ia`. Criar Agente pelo Construtor funciona, e uma Ferramenta permitida continua permitida depois de recarregar.",
    "tarefas": [
      {
        "id": "13.1",
        "n": "Ligação com o modelo",
        "objetivo": "Não existe chamada a modelo em lugar nenhum. Aqui nasce o único ponto do `apps/api` que fala com o Claude, com streaming, contagem de tokens e teto de gasto, e o catálogo de modelos passa a ser o real.",
        "pronto": "`npm run ia:conferir -w @n1/api` responde em homologação, e a linha da chamada aparece em `plataforma.consumo_de_ia` com tokens e custo.",
        "subs": [
          {
            "n": "Criar as chaves da Anthropic",
            "cam": [
              "voce"
            ],
            "hoje": "Não existe chave nem variável de IA em `apps/api/.env.example`.",
            "fazer": [
              "No Console da Anthropic, criar um workspace para o CRM N1 com limite de gasto mensal.",
              "Criar uma chave para homologação e outra para produção.",
              "Pôr cada uma em `ANTHROPIC_API_KEY` no ambiente do `apps/api` correspondente."
            ],
            "pronto": "Em homologação, `npm run ia:conferir -w @n1/api` (subtarefa seguinte) responde “ok”.",
            "nota": "A chave fica no ambiente do servidor, não no cofre de credenciais da Sessão 1 (1.4), que guarda as credenciais dos Canais."
          },
          {
            "n": "Criar o cliente do modelo no apps/api",
            "cam": [
              "api"
            ],
            "hoje": "Não existe. `apps/api/package.json` não tem pacote de IA.",
            "fazer": [
              "Instalar `@anthropic-ai/sdk` em `@n1/api` (`npm i @anthropic-ai/sdk -w @n1/api`).",
              "Criar `apps/api/src/ia/modelo/porta-do-modelo.ts`: a interface neutra `PortaDoModelo` com `responder(pedido, aoEvento, sinal)`. O pedido leva modelo, sistema, mensagens, ferramentas e `maxTokens`; a resposta devolve texto, chamadas de Ferramenta, uso (`entrada`, `saida`, `leituraDeCache`, `escritaDeCache`) e motivo de parada.",
              "Criar `apps/api/src/ia/modelo/cliente-anthropic.ts`, o único arquivo que importa o SDK. Usa `client.messages.stream(...)`, repassa cada trecho de texto a `aoEvento`, pega a resposta final com `finalMessage()` e lê `usage.input_tokens`, `output_tokens`, `cache_read_input_tokens` e `cache_creation_input_tokens`.",
              "Criar `apps/api/src/ia/modelo/modelo-falso.ts`, uma `PortaDoModelo` roteirizada para os testes, sem rede.",
              "Variáveis novas, lidas por `carregarEnv()` (`apps/api/src/persistencia/conexao.ts`) e documentadas em `apps/api/.env.example`: `ANTHROPIC_API_KEY`, `IA_ATIVA` (padrão `false`; desligada, as rotas de IA respondem 503 com motivo) e `IA_TEMPO_LIMITE_MS` (padrão 120000).",
              "Criar o comando `npm run ia:conferir -w @n1/api` (`apps/api/src/ia/conferir.cli.ts`), que faz uma pergunta curta e imprime tokens e custo."
            ],
            "pronto": "`apps/api/src/ia/modelo/cliente-anthropic.test.ts` faz uma pergunta real e recebe texto com `uso.entrada > 0`; o teste pula sem `ANTHROPIC_API_KEY`, como os testes de banco pulam sem `DATABASE_URL`.",
            "nota": "Usa o framework escolhido no levantamento (T2.1). Se houver prova de conceito, ela já deixa o esqueleto pronto."
          },
          {
            "n": "Trocar o catálogo de modelos pelos reais",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`MODELOS_DA_PLATAFORMA` (`packages/dominio/src/seed.ts:2595`) tem `mdl_base`, `mdl_rapido` e `mdl_legado`. O tipo `Model` (`types/ai.ts:18`) não tem provedor nem preço. A coleção `models` é copiada para cada Espaço (`packages/dominio/src/colecoes.ts:24`).",
            "fazer": [
              "`Model` ganha `idNoProvedor` (por exemplo, `claude-opus-5-5`) e `preco` em US$ por milhão de tokens (`entrada`, `saida`, `leituraDeCache`, `escritaDeCache`).",
              "Reescrever `MODELOS_DA_PLATAFORMA` com os modelos escolhidos na T.4. Manter os ids `mdl_base` (forte) e `mdl_rapido` (rápido), para não mexer nas Versões e Sessões que já os referenciam; `mdl_legado` continua descontinuado.",
              "Criar `apps/api/src/bootstrap/modelos-de-ia.cli.ts` (`npm run ia:modelos -w @n1/api`, com `--seco`), que regrava a coleção `models` de cada Espaço existente."
            ],
            "pronto": "`select id, dados->>'idNoProvedor' from plataforma.registros where colecao = 'models'` devolve os modelos reais em homologação, e o seletor de Modelo do Chat mostra os nomes novos."
          },
          {
            "n": "Gravar o consumo e aplicar o teto de gasto",
            "cam": [
              "dom",
              "banco",
              "api"
            ],
            "hoje": "`ExecutionCost` (`types/ai.ts:249`) só tem `modelUnits`, `toolCalls`, `childExecutions` e `durationMs`. `Agent.costLimit` (`types/ai.ts:344`) existe e nada o lê. O Espaço de Trabalho não tem cota.",
            "fazer": [
              "No domínio, `ExecutionCost` ganha `tokens` (entrada, saída, leitura e escrita de cache) e `custoUsd`; uma função pura `custoDaChamada(modelo, uso)` em `packages/dominio/src/derive-ia.ts` calcula o valor pelo `preco` do Modelo.",
              "O Espaço de Trabalho ganha o teto mensal decidido na T.4 (`types/workspace.ts`).",
              "Migração nova: tabela `plataforma.consumo_de_ia` (workspace_id, id, origem, agente_id, execucao_id, conversa_id, modelo, tokens de entrada, saída e cache, custo_usd, criado_em). Toda chamada da `PortaDoModelo` grava uma linha, inclusive as que não são Execução (assistente do Construtor, 14.4).",
              "Antes de chamar o modelo, `apps/api/src/ia/teto.ts` soma o mês em `plataforma.consumo_de_ia` e compara com o teto do Espaço e o `costLimit` do Agente. Acima do teto, a Execução falha antes de consumir (regra RN-AGE-08); em 80%, grava um aviso ao Proprietário do Agente."
            ],
            "pronto": "Um teste em `apps/api` com teto de US$ 0,01 e o `modelo-falso` prova que a segunda pergunta falha com o motivo “Limite de custo atingido” sem chamar o modelo."
          }
        ]
      },
      {
        "id": "13.2",
        "n": "Chat respondendo",
        "objetivo": "Hoje enviar no Chat grava a mensagem e nada responde. Aqui a mensagem abre uma Execução, o `apps/api` chama o modelo fora da transação, a resposta chega aos poucos por streaming e fica gravada como mensagem do assistente.",
        "pronto": "Uma pergunta em `/ia/chat/<sessão>` recebe resposta aparecendo aos poucos, e depois de recarregar a resposta continua lá, com o link da Execução.",
        "subs": [
          {
            "n": "Criar as operações do turno do Chat no domínio",
            "cam": [
              "dom"
            ],
            "hoje": "Só existe `sendChatMessage` (`operations/ai.ts:955`). A verificação de disponibilidade existe (`disponibilidadeDoAgente`, `derive-ia.ts:221`) e a resolução do modelo também, mas é privada (`modeloResolvido`, `operations/ia/agentes.ts:388`).",
            "fazer": [
              "Criar `packages/dominio/src/operations/ia/turno-do-chat.ts` com quatro funções puras.",
              "`abrirTurnoDoChat(state, memberId, sessionId, conteudo, fileIds)`: as mesmas recusas de `sendChatMessage`, mais Agente ativo (RN-AGE-10) e disponível (RN-AGE-08); grava a mensagem `usuario` e uma `AgentExecution` com origem `sessaoDeChat`, estado `executando`, delegante o Membro, `chatSessionId` e a Âncora.",
              "`montarContextoDoTurno(state, executionId)`: devolve sistema (instruções da Versão), mensagens (histórico da Sessão) e a `ContextComposition`, só com o que o Membro vê (RN-AGE-16; Âncora de Tarefa passa por `memberSeesTask`). Nada do formato da Anthropic: o domínio não conhece o provedor.",
              "`fecharTurnoDoChat(state, executionId, saida)`: grava a mensagem `assistente` com `executionId` e `complete: true`, o custo e a Execução `concluida`.",
              "`falharTurnoDoChat(state, executionId, motivo, textoParcial?)`: com texto parcial, grava `assistente` com `complete: false`; sem texto, uma mensagem `sistema` com o motivo (chat.md, seção do ciclo da Sessão).",
              "Exportar `modeloResolvido` de `agentes.ts` para as duas usarem a mesma regra.",
              "As quatro NÃO entram em `operations/registro.ts`: só o `apps/api` as chama, senão qualquer cliente poderia forjar uma resposta do assistente por `POST /operacoes/:nome`. Acrescentá-las à lista de proibidas do teste `registro.test.ts:39`."
            ],
            "pronto": "`turno-do-chat.test.ts` cobre: turno aberto e fechado, Agente pausado recusado, Âncora que o Membro não vê fora do contexto, texto parcial gravado como incompleto."
          },
          {
            "n": "Criar a rota de streaming do Chat",
            "cam": [
              "api"
            ],
            "hoje": "Não existe rota de IA. Nenhuma rota do `apps/api` usa `text/event-stream`.",
            "fazer": [
              "Criar `apps/api/src/rotas/ia/chat.ts`, registrada em `apps/api/src/app.ts` junto das outras.",
              "`POST /ia/sessoes/:sessaoId/mensagens`, corpo validado por zod `{ conteudo, fileIds? }`, Membro sempre de `request.membro`.",
              "Passo 1: `executar()` com `abrirTurnoDoChat`; a transação fecha aqui.",
              "Passo 2: abrir a resposta com `reply.hijack()` e `reply.raw.writeHead(200, ...)`, copiando os cabeçalhos de CORS de `reply.getHeaders()` (com `hijack`, o `@fastify/cors` não escreve sozinho).",
              "Passo 3: conferir o teto (13.1), chamar `PortaDoModelo.responder` com um `AbortController` e mandar eventos SSE: `aceita` (`{ mensagemId, execucaoId }`), `texto` (`{ delta }`), `fim` (`{ mensagemId, custo }`) e `erro` (`{ erro }`). A Sessão 14 acrescenta `passo` e `aprovacao`.",
              "Passo 4: `executar()` com `fecharTurnoDoChat`, ou `falharTurnoDoChat` se o modelo falhar ou a pessoa fechar a conexão.",
              "Criar `apps/api/src/ia/reconciliar-turnos.ts`, chamado ao subir a API em `apps/api/src/index.ts`: Execuções `executando` mais velhas que `IA_TEMPO_LIMITE_MS` viram `falhou` com motivo “Interrompida”, para um processo derrubado no meio não deixar Sessão travada."
            ],
            "pronto": "`apps/api/src/rotas/ia/chat.test.ts`, com o `modelo-falso`, recebe `aceita`, dois `texto` e `fim`; depois, em `plataforma.registros`, a Sessão tem a mensagem `assistente` com `executionId` e a Execução está `concluida` com custo."
          },
          {
            "n": "Mostrar a resposta chegando no Chat",
            "cam": [
              "web"
            ],
            "hoje": "A tela da Sessão envia com `run(sendChatMessage)` (`ia/chat/[sessao]/page.tsx:163`), e a home do Chat também (`ia/chat/page.tsx:114`). A nota de protótipo está em `page.tsx:221` e no comentário do topo (linhas 10 a 13).",
            "fazer": [
              "Criar `apps/web/src/dados/ia/chat-ao-vivo.ts` com `enviarNoChat(sessaoId, conteudo, aoEvento, sinal)`: `fetch` em `${NEXT_PUBLIC_API_URL}/ia/sessoes/:id/mensagens` com o token de `clienteDoNavegador().auth.getSession()` (o mesmo de `dados/sessao-provider.tsx:39`), lendo `response.body.getReader()` e separando os eventos SSE. `EventSource` não serve: não faz POST nem manda `Authorization`.",
              "As duas páginas trocam `run(sendChatMessage)` por `enviarNoChat`. Enquanto chega texto, um balão do assistente cresce na tela; no `fim`, chamar `verificarRevisao()` do store (`dados/store.ts`) para trazer a mensagem gravada.",
              "Botão “Parar” no compositor: aborta o `fetch`; o servidor grava o parcial como incompleto.",
              "Tirar a nota de protótipo (`page.tsx:221`) e o trecho do comentário que diz que não há Modelo."
            ],
            "pronto": "Em homologação, a resposta aparece palavra a palavra; recarregar a página mostra a mesma resposta; “Parar” deixa o balão marcado como incompleto."
          },
          {
            "n": "Renomear, arquivar e compartilhar a Sessão",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "Não existem operações para isso. O tipo já tem `title`, `titleEdited`, `lifecycle` e `sharedWithMemberIds`/`sharedWithTeamIds` (`types/ai.ts:403`).",
            "fazer": [
              "Em `packages/dominio/src/operations/ai.ts`: `renomearSessaoDeChat`, `arquivarSessaoDeChat`, `desarquivarSessaoDeChat` (RN-CHT-06: escrever em arquivada exige desarquivar antes), `compartilharSessaoDeChat` e `revogarCompartilhamentoDaSessao`. Só o Proprietário (RN-CHT-07), com Registro de Atividade (RN-CHT-28).",
              "Registrar as cinco em `operations/registro.ts` e em `operations/index.ts`, e os esquemas em `apps/api/src/rotas/esquemas/ia.ts`.",
              "Na tela da Sessão, um menu no cabeçalho (`PageHeader`, ações) com as três ações."
            ],
            "pronto": "Testes de domínio para as cinco; pela tela, renomear muda o título na lista do Chat e arquivar deixa a Sessão só leitura.",
            "nota": "Compartilhar só é seguro depois que a Sessão 1 (1.1) parar de mandar as Sessões de Chat de todos pelo `GET /estado`."
          }
        ]
      },
      {
        "id": "13.3",
        "n": "Anexos e voz",
        "objetivo": "O “+” do compositor mostra “Anexar arquivo” e “Anexar imagem” desligados, e o microfone também (P34 e P35). Aqui o anexo passa a ir junto para o modelo, e você decide o ditado.",
        "pronto": "Uma pergunta sobre um PDF anexado é respondida com o conteúdo do PDF.",
        "subs": [
          {
            "n": "Anexar arquivo e imagem no Chat",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "Os itens estão desligados com `SEM_ARQUIVOS` e `SEM_IMAGENS` (`apps/web/src/features/ia/compositor-do-chat.tsx:77-78`, usados em `:186-187`). `ChatMessage.fileIds` existe (`types/ai.ts:371`), mas `sendChatMessage` grava sempre `[]` (`ai.ts:975`) e recusa texto vazio. O envio de arquivo da Tarefa já existe: `POST /tarefas/:taskId/anexos/ticket` e `/confirmar` (`apps/api/src/rotas/anexos-da-tarefa.ts:96` e `:119`), sobre `apps/api/src/servicos/storage-uploads.ts`.",
            "fazer": [
              "No domínio, `abrirTurnoDoChat` aceita `fileIds` e texto vazio quando há arquivo; quando o Modelo efetivo não lê o tipo (`Model.capabilities.inputs`), grava a mensagem `sistema` da regra RN-CHT-19.",
              "No `apps/api`, `POST /ia/sessoes/:sessaoId/anexos/ticket` e `/confirmar`, no mesmo molde dos anexos da Tarefa.",
              "Em `rotas/ia/chat.ts`, baixar cada arquivo do bucket e mandar ao modelo: PDF como bloco `document` em base64, imagem como bloco `image`.",
              "Na tela, ligar os dois itens do “+”, mostrar os arquivos como fichas no compositor e no balão."
            ],
            "pronto": "Em homologação, anexar um PDF de 3 páginas e perguntar “qual é o total da página 2?” recebe o valor certo."
          },
          {
            "n": "Decidir o ditado no Chat",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "O microfone está desligado com `SEM_VOZ` (`compositor-do-chat.tsx:79`, `:433`). A pendência P35 lembra que você pediu, em 2026-09-23, que o áudio não fosse guardado em lugar nenhum. O Claude não transcreve áudio.",
            "opcoes": [
              "(A) Ditado pelo navegador (Web Speech API): rápido, mas no Chrome o áudio vai para os servidores do Google",
              "(B) Gravar e transcrever no servidor, com um serviço de transcrição contratado à parte",
              "(C) Sem ditado por agora"
            ],
            "muda": "(A): um gancho `useDitado` no compositor, reaproveitando as mensagens de falha do microfone do Início; meio dia. (B): rota de upload de áudio, contrato com outro provedor e o áudio passando pelo servidor; 1 a 2 dias. (C): o botão sai do compositor.",
            "recomendo": "(C) agora, para não contrariar o pedido de não mandar áudio para fora; (A) se você aceitar o Google.",
            "peso": "produto"
          }
        ]
      },
      {
        "id": "13.4",
        "n": "Corrigir o que está quebrado",
        "objetivo": "Dois defeitos da IA que existem hoje, sem modelo nenhum: criar Agente pelo Construtor volta 400, e permitir ou retirar uma Ferramenta mostra sucesso e não grava.",
        "pronto": "Os dois corrigidos, cada um com teste.",
        "subs": [
          {
            "n": "Corrigir o 400 ao criar Agente pelo Construtor",
            "cam": [
              "api"
            ],
            "hoje": "A tela chama `createAgent(data, id, entrada, { ativar })` (`apps/web/src/features/ia/agent-builder/agent-builder.tsx:131`), e o gravador manda dois argumentos: o rascunho e `{ ativar }`. O esquema aceita só um: `createAgent: z.tuple([AGENT_DRAFT])` (`apps/api/src/rotas/esquemas/construtor-de-agentes.ts:37`). Uma tupla do zod recusa elemento a mais, e `POST /operacoes/createAgent` responde 400. O teste `construtor-de-agentes.test.ts` (caso b) passa porque manda só `[rascunho]`.",
            "fazer": [
              "Trocar para `createAgent: z.tuple([AGENT_DRAFT, opcional(z.object({ ativar: z.boolean().optional() }).strict())])`, com `opcional` de `./fragmentos`.",
              "No teste, acrescentar o caso `[rascunho, { ativar: true }]` e o caso `[rascunho, { ativar: true, lixo: 1 }]` (recusado)."
            ],
            "pronto": "`construtor-de-agentes.test.ts` passa com os dois casos novos, e publicar um Agente novo pela tela, com e sem “Ativar”, cria o Agente sem erro."
          },
          {
            "n": "Fazer “Permitir Ferramenta” e “Retirar” gravarem",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`permitirFerramenta` e `retirarFerramenta` (`packages/dominio/src/operations/ia/agentes.ts:351` e `:355`) funcionam, mas não estão em `operations/registro.ts` (os imports de `ia/agentes` em `:332-342` e a lista em `:675-683` não as têm) nem em `operations/index.ts`. O gravador não as vê: a cópia local aceita, a tela mostra sucesso (`features/ia/agentes/permitir-ferramenta-dialog.tsx:65` e `agente-completo.tsx:186`) e nada vai ao servidor.",
            "fazer": [
              "Acrescentar as duas a `registro.ts` (import e lista) e a `operations/index.ts` (`instrumentar`).",
              "Acrescentar `permitirFerramenta: z.tuple([ID, z.string()])` e `retirarFerramenta: z.tuple([ID, z.string()])` em `apps/api/src/rotas/esquemas/ia-agentes.ts` e ajustar o teste de cobertura dele (8 para 10 operações)."
            ],
            "pronto": "`registro.test.ts` e `ia-agentes.test.ts` passam; pela tela, permitir uma Ferramenta e recarregar mostra a Ferramenta permitida e a Versão nova."
          }
        ]
      }
    ],
    "ajuste": "+1 dia: cliente do modelo, catálogo, teto de custo, rota com streaming, tela, ações da Sessão, anexos e os dois defeitos."
  },
  {
    "id": "14",
    "n": "IA: Agentes e seus poderes",
    "dias": [
      5,
      7
    ],
    "dep": [
      "13"
    ],
    "desc": "Os Agentes deixam de ser roteiro e passam a agir, com os poderes decididos em 19/10: Ferramentas, Conhecimento, Integrações, Plugins, Skills e as Automações que podem acionar. Tudo dentro da permissão de quem os aciona.",
    "partida": [
      "CRUD de Agente com Versões (`operations/agent-builder.ts`, `operations/ia/agentes.ts`), Concessões de Habilidade (`operations/ia/habilidades.ts:537`), autonomia e política de aprovação na Versão (`types/ai.ts:298`).",
      "Catálogo de Ferramentas com classe de efeito (`TOOLS`, `packages/dominio/src/seed.ts:2596`).",
      "O ensaio é determinístico: um passo por Ferramenta permitida, leitura `concluido` e escrita `simulado` (`ensaiarAgente`, `operations/ia/agentes.ts:485-512`).",
      "Aprovar um pedido de Agente marca a Execução `concluida` sem executar a Ferramenta (`decideApproval`, `operations/ai.ts:180`); nenhuma operação cria esse pedido; expirar só acontece no clique (`ai.ts:153`).",
      "Cancelar Execução e apagar Item de Memória já funcionam e estão ligados na ficha (`agentes.ts:548` e `:593`; `agente-completo.tsx:442` e `:704`).",
      "A rota de streaming e a `PortaDoModelo` existem desde a Sessão 13."
    ],
    "pronto": "No Chat, um Agente `supervisionado` lê uma Tarefa e cria outra a pedido; ao tentar uma escrita que exige aprovação, para, o pedido aparece na fila e na própria conversa, e depois de aprovado a Ferramenta roda e a resposta continua. Os passos reais aparecem em `/ia/execucoes/<id>`.",
    "tarefas": [
      {
        "id": "14.1",
        "n": "Ferramentas executando",
        "objetivo": "As Ferramentas existem só no Catálogo; nenhuma executa. Aqui o modelo recebe as Ferramentas que o Agente pode usar, o `apps/api` executa cada chamada sobre o domínio com as duas verificações da regra DO-HAB-14 (a Ferramenta está permitida e o Sujeito pode mexer no registro) e cada uma vira um passo da Execução.",
        "pronto": "No Chat, “crie uma Tarefa ‘Ligar para o João’ na Lista Comercial” cria a Tarefa, com o Agente como autor e o Membro como delegante.",
        "subs": [
          {
            "n": "Ligar as Ferramentas da Estrutura às operações do domínio",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe ligação entre o id da Ferramenta e uma operação. As operações que existem: `createTask`, `addTaskComment`, `changeTaskStatus` (`operations/tasks.ts`); a leitura de Conhecimento só existe no ensaio (`referenciasDoEnsaio`, `agentes.ts:400`).",
            "fazer": [
              "Criar `packages/dominio/src/operations/ia/ferramentas-do-agente.ts` com a tabela `EXECUTORES`: `ler_tarefa` (leitura), `criar_tarefa` → `createTask`, `criar_comentario` → `addTaskComment`, `alterar_status` → `changeTaskStatus`, `consultar_conhecimento` (primeiros Fragmentos das Coleções concedidas, até a Sessão 17) e `lembrar` (14.4).",
              "`executarFerramenta(state, executionId, toolId, entrada)` roda a operação como o Membro delegante e depois marca o registro criado com `createdBy` = o Agente e `createdByDelegate` = o Membro (`types/primitives.ts:67-69`); grava o passo `ferramenta` na Execução.",
              "As outras Ferramentas do Catálogo ficam fora da tabela; o Construtor as mostra como “ainda não executa”. As do CRM (`ler_contato`, `ler_negocio`, `ler_conversa`, `enviar_mensagem`, `sugerir_resposta`, `atualizar_qualificacao`, `atualizar_campos_contato`) entram na Sessão 16."
            ],
            "pronto": "`ferramentas-do-agente.test.ts`: `criar_tarefa` cria a Tarefa com o Agente como autor; Ferramenta fora da tabela devolve passo `falhou` com motivo.",
            "nota": "Se o levantamento escolher Ferramentas configuráveis pela tela (T2.4), entram aqui mais cerca de 3 dias: Ferramenta de HTTP (endereço, método, credencial do cofre) e de tabela (quais campos o Agente lê e grava)."
          },
          {
            "n": "Conferir a permissão de quem aciona",
            "cam": [
              "dom"
            ],
            "hoje": "Existem as peças, não a conta. Lado do Agente: `agentSeesTask` (`packages/dominio/src/derive.ts:1037`) e as concessões com `subjectKind` = 'agent'; o Agente nasce com o Papel Convidado (regra B76). Lado do Membro: `taskWriteRefusal` (`derive.ts:932`), `taskCommentRefusal` (`derive.ts:952`), `listWriteRefusal` (`operations/tasks.ts:1373`).",
            "fazer": [
              "Criar `recusaDaFerramenta(state, execucao, toolId, alvo)` em `ferramentas-do-agente.ts`: a Ferramenta está em `allowedToolIds` da Versão da Execução e não foi tirada pela restrição da Sessão (`toolRestriction`); o Agente alcança o registro; e, havendo delegante Membro, o Membro também alcança (regra A9.3: a permissão efetiva é a interseção).",
              "`executarFerramenta` chama a recusa antes de rodar; recusado, o passo fica `negada`, com `toolAllowed` e `resourcePermitted` preenchidos.",
              "Função pura `exigeAprovacao(autonomia, classeDeEfeito)` com a tabela da regra RN-AGE-12: `assistido` pede para tudo que não é leitura; `supervisionado`, para `escritaIrreversivel` e `externa`; `autonomo`, nunca."
            ],
            "pronto": "Teste: um Agente acionado por um Convidado tenta `criar_tarefa` numa Lista que o Convidado não edita e o passo fica `negada`; a mesma chamada por um Membro com acesso cria a Tarefa."
          },
          {
            "n": "Rodar o laço do Agente no apps/api",
            "cam": [
              "api"
            ],
            "hoje": "A rota do Chat (13.2) faz uma chamada só, sem Ferramentas.",
            "fazer": [
              "Criar `apps/api/src/ia/execucao/laco-do-agente.ts`: monta `tools` com as Ferramentas executáveis da Versão (nome = id da Ferramenta, descrição = `Tool.description`, esquema de entrada de `apps/api/src/ia/execucao/esquemas-das-ferramentas.ts`, em zod convertido por `z.toJSONSchema`, com `strict: true`) e `tool_choice` `auto`.",
              "Com `stop_reason` `tool_use`: validar cada entrada pelo zod; para cada chamada, um `executar()` curto com `executarFerramenta`; devolver todos os `tool_result` numa mensagem só, com `is_error` na recusa; repetir até `end_turn` ou até `IA_MAX_PASSOS` (variável nova, padrão 10).",
              "A rota do Chat passa a usar o laço e manda um evento `passo` por Ferramenta. Cada chamada também grava uma mensagem `ferramenta` na Sessão, que a tela já desenha (`ia/chat/[sessao]/page.tsx:305`)."
            ],
            "pronto": "`laco-do-agente.test.ts`, com o `modelo-falso` roteirizado para chamar `ler_tarefa` e depois `criar_tarefa`, termina com dois passos `concluido` na Execução e a Tarefa em `plataforma.registros`; a tela `/ia/execucoes/<id>` mostra os dois."
          }
        ]
      },
      {
        "id": "14.2",
        "n": "Skills em arquivo .md",
        "objetivo": "Na reunião de 19/10 ficou decidido que uma Habilidade é uma Skill em arquivo .md. A Habilidade de hoje, com contratos e requisitos, vira um texto `SKILL.md` que o Agente lê quando precisa.",
        "pronto": "Você envia um `SKILL.md`, concede a um Agente, e o Agente segue as instruções dele no Chat.",
        "subs": [
          {
            "n": "Trocar a Habilidade por Skill em `.md`",
            "cam": [
              "dom"
            ],
            "hoje": "`Skill` e `SkillVersion` (`packages/dominio/src/types/ai.ts:58-84`) guardam instruções, contratos de entrada e saída, requisitos de Ferramenta e dependências, com rascunho e versões (`packages/dominio/src/operations/ia/habilidades.ts`).",
            "fazer": [
              "A Skill passa a ser um texto `SKILL.md`: um cabeçalho com `name` e `description` e as instruções em Markdown no corpo.",
              "Mantém versões e a Concessão a Agente; saem contratos, requisitos e dependências.",
              "Migrar as Habilidades que existem: as instruções viram o corpo; o nome e a descrição viram o cabeçalho."
            ],
            "pronto": "Teste: uma Skill criada a partir de um `SKILL.md` volta igual ao ser lida."
          },
          {
            "n": "Enviar e editar a Skill na tela",
            "cam": [
              "web"
            ],
            "hoje": "A aba “Habilidades” (`/ia/personalizar/habilidades`) tem formulário com contratos e requisitos.",
            "fazer": [
              "A aba passa a se chamar “Skills”.",
              "Botão para enviar um arquivo `.md` e um editor de texto para ajustar.",
              "Erro claro se faltar `name` ou `description` no cabeçalho."
            ],
            "pronto": "Você envia `qualificar-lead.md` e ele aparece na lista, pronto para conceder."
          },
          {
            "n": "Usar as Skills do Agente na conversa",
            "cam": [
              "api"
            ],
            "hoje": "As Habilidades nunca entram na conversa com o modelo.",
            "fazer": [
              "No começo de cada conversa, o Agente recebe o nome e a descrição de todas as Skills dele.",
              "Quando precisa de uma, chama a Ferramenta `ler_skill` e recebe o corpo do `.md`, como nos Agent Skills do Claude. Assim uma Skill longa só ocupa a conversa quando é usada."
            ],
            "pronto": "Teste: o Agente com a Skill “Qualificar lead” lê a Skill e faz as perguntas dela."
          },
          {
            "n": "Recusar Skill sem Concessão na Sessão",
            "cam": [
              "dom"
            ],
            "hoje": "`createChatSession` e `configureChatSession` aceitam qualquer Habilidade ativa (`operations/ai.ts:703` e `:808`); o `agt_padrao` não tem Concessão (P36).",
            "fazer": [
              "Se a T.2 escolheu (A): as duas operações recusam com a frase de `motivoDeHabilidadeForaDoAgente` (`derive-ia.ts:135`); `seed.ts` e `bootstrap-gestao.ts` dão ao `agt_padrao` as Concessões das Habilidades da plataforma.",
              "Se escolheu (B): tirar `skillId` de `ChatSession` e o chip do compositor."
            ],
            "pronto": "Teste: escolher na Sessão uma Habilidade não concedida ao Agente é recusado."
          }
        ]
      },
      {
        "id": "14.3",
        "n": "Aprovações de Agente",
        "objetivo": "Nenhuma operação cria pedido de aprovação de Agente, aprovar não executa nada e o prazo só vence quando alguém clica. Aqui o Agente para quando a autonomia exige, o pedido aparece onde a T.2 decidiu, e aprovar retoma a Execução de onde parou.",
        "pronto": "Um Agente `assistido` para antes de criar a Tarefa; aprovado pela fila, a Tarefa é criada e a resposta continua no Chat; um pedido vencido expira sozinho.",
        "subs": [
          {
            "n": "Criar o pedido de aprovação quando a autonomia exige",
            "cam": [
              "dom",
              "banco"
            ],
            "hoje": "Só o seed tem pedido de Agente (`seed.ts:3067`). O tipo já tem o objeto fixo (Ferramenta, entrada, alvo, classe; `ApprovalRequest`, `types/ai.ts:146`) e a origem com prazo (`:104`).",
            "fazer": [
              "Criar `solicitarAprovacaoDaFerramenta(state, executionId, toolId, entrada, alvo)` em `ferramentas-do-agente.ts`: o aprovador vem de `approvalPolicy` (regra RN-AGE-18), o prazo de `timeoutHours` ou do prazo decidido na T.2; a Execução fica `aguardandoAprovacao` e o passo `aguardando`. Fora do registro de operações.",
              "O laço (14.1) chama `exigeAprovacao` antes de cada escrita e, quando exige, para e grava o pedido.",
              "Migração nova: tabela `plataforma.continuacoes_de_execucao` (workspace_id, execucao_id, mensagens jsonb, criado_em) com a conversa exata com o modelo até a parada. Retomar precisa devolver ao modelo o mesmo conteúdo do assistente com o `tool_use` pendente; a Execução só guarda referências (regra DO-AGE-09). A linha é apagada quando a Execução termina."
            ],
            "pronto": "Teste em `apps/api`: Agente `assistido` pede `criar_tarefa`, a Execução fica `aguardandoAprovacao`, o pedido existe em `plataforma.registros` (coleção `approvals`) e a continuação em `plataforma.continuacoes_de_execucao`."
          },
          {
            "n": "Retomar a Execução depois da decisão",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`decideApproval` (`operations/ai.ts:118`), aprovado, empurra um passo `concluido` e marca a Execução `concluida` (`ai.ts:176-191`) sem rodar a Ferramenta. A fila chama a operação pelo `run` (`ia/aprovacoes/page.tsx:153`).",
            "fazer": [
              "`decideApproval`, aprovado, passa a deixar a Execução `executando`, sem passo novo; recusado, devolve a decisão ao Agente (regra RN-AGE-17).",
              "Rota nova `POST /ia/aprovacoes/:id/decisao` em `apps/api/src/rotas/ia/aprovacoes.ts`, corpo `{ decisao, motivo? }`: `executar()` com `decideApproval`; se aprovado, `executarFerramenta` com o objeto exato do pedido, refazendo as duas verificações; depois o laço continua com o `tool_result`, a partir de `plataforma.continuacoes_de_execucao`, e a resposta vira mensagem `assistente` na Sessão.",
              "A fila (`ia/aprovacoes/page.tsx:153`) passa a chamar essa rota para pedidos de Agente; os de processo continuam como estão."
            ],
            "pronto": "Teste da rota: aprovar cria a Tarefa e a Execução termina `concluida` com o passo da Ferramenta; recusar termina `falhou` com o motivo; a Sessão tem a mensagem de resposta."
          },
          {
            "n": "Expirar os pedidos vencidos sozinho",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "A expiração está dentro de `decideApproval` (`ai.ts:153-172`) e só roda quando alguém tenta decidir depois do prazo.",
            "fazer": [
              "Extrair para `expirarAprovacoesVencidas(state, agora)` em `operations/ai.ts`, com ator Sistema e o mesmo Registro de Atividade.",
              "Criar o trabalhador `apps/api/src/ia/expirar-aprovacoes.ts`, ligado em `apps/api/src/index.ts`, rodando a cada `IA_EXPIRACAO_INTERVALO_MS` (padrão 300000)."
            ],
            "pronto": "Teste: um pedido com prazo no passado vira `expirada` e a Execução `cancelada` sem ninguém clicar."
          },
          {
            "n": "Mostrar os pedidos reais na fila e na conversa",
            "cam": [
              "web"
            ],
            "hoje": "`/ia/aprovacoes` lista `state.approvals` (`aprovacoes/page.tsx:144`); na demonstração só aparece o do seed. A mensagem `ferramenta` do Chat mostra “aguardando aprovação” como texto (`ia/chat/[sessao]/page.tsx:61`).",
            "fazer": [
              "Mostrar os pedidos de Agente no lugar decidido na T.2.",
              "Se a T.3 escolheu aprovar dentro da conversa: Aprovar e Recusar na mensagem `ferramenta` com `toolResult` `aguardandoAprovacao`, chamando a rota de decisão."
            ],
            "pronto": "Um pedido real aparece na fila e na conversa, e aprovar por qualquer um dos dois lugares retoma a Execução."
          }
        ]
      },
      {
        "id": "14.4",
        "n": "Construtor, ensaio e prévia",
        "objetivo": "O assistente do Construtor é um roteiro de quatro perguntas, a prévia responde texto pronto, o ensaio inventa passos e a autonomia não tem campo. Aqui os três passam a usar o modelo, nos passos aprovados na T.3, e cancelar uma Execução para o modelo de verdade.",
        "pronto": "Você cria um Agente pelo Construtor conversando com o assistente, escolhe a autonomia, testa na prévia com respostas reais e publica.",
        "subs": [
          {
            "n": "Um passo do Construtor para cada poder",
            "cam": [
              "web",
              "dom"
            ],
            "hoje": "O Construtor pergunta nome, descrição, instruções e uma frase de abertura (`apps/web/src/features/ia/agent-builder/build-assistant.ts`).",
            "fazer": [
              "Montar o Construtor nos passos decididos no levantamento (T2.4).",
              "Um passo para cada poder: Ferramentas, Conhecimento, Integrações (Sessão 15), Plugins (Sessão 18), Skills e Automações (Sessão 18). Os passos de Integrações, Plugins e Automações aparecem quando essas sessões estiverem prontas."
            ],
            "pronto": "Você cria um Agente com uma Ferramenta, uma Coleção e uma Skill pelo Construtor, e a ficha mostra os três."
          },
          {
            "n": "Fazer o ensaio chamar o modelo",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`ensaiarAgente` (`operations/ia/agentes.ts:428`) cria passos fixos (`:485-512`) sem modelo; o diálogo o chama pelo `run` (`features/ia/agentes/ensaiar-dialog.tsx:65`).",
            "fazer": [
              "Separar de `ensaiarAgente` as verificações (Agente em rascunho ou ativo, instruções, modelo) numa função `abrirEnsaio`, fora do registro de operações; o laço fixo sai.",
              "Rota `POST /ia/agentes/:id/ensaio` (SSE), com o laço da 14.1 em modo ensaio: leituras rodam; escritas viram passo `simulado` sem chamar a operação; nada vai para a Memória (regra B82).",
              "`ensaiar-dialog.tsx` chama a rota e mostra a resposta chegando."
            ],
            "pronto": "Teste: um ensaio que pede `criar_tarefa` termina com o passo `simulado` e nenhuma Tarefa nova em `plataforma.registros`."
          },
          {
            "n": "Pôr autonomia e aprovadores no Construtor",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`AgentDraft` (`operations/agent-builder.ts:19-29`) não tem autonomia; `conteudoDoRascunho` grava `assistido` e o próprio autor como aprovador (`agent-builder.ts:78-79`). `accessPoints` é obrigatório (`agent-builder.ts:50`).",
            "fazer": [
              "`AgentDraft` e `AGENT_DRAFT` (`apps/api/src/rotas/esquemas/construtor-de-agentes.ts:15`) ganham `autonomy` (padrão da T.5) e `approverMemberIds`.",
              "Aplicar a T.2 (Conhecimento por Concessão) e a T.5 (`accessPoints` sai, se escolhida a opção A) no rascunho, no esquema e em `features/ia/agent-builder/agent-config-panel.tsx`.",
              "A ficha (`agente-completo.tsx:494`) passa a abrir o Construtor para trocar a autonomia, criando Versão nova."
            ],
            "pronto": "Testes do esquema e de `createAgent`; pela tela, um Agente publicado como `supervisionado` mostra esse nível na ficha."
          },
          {
            "n": "Fazer o assistente do Construtor usar o modelo",
            "cam": [
              "api",
              "web"
            ],
            "hoje": "O roteiro mora em `features/ia/agent-builder/build-assistant.ts` e é chamado em `agent-builder.tsx:187-203` (`construir`).",
            "fazer": [
              "Rota `POST /ia/construtor/assistente`, corpo `{ rascunho, historico, mensagem }`: chama o modelo com saída estruturada (`output_config.format`) no formato `{ fala, alteracoes }`, onde `alteracoes` são campos do rascunho; não cria Execução, mas grava o consumo em `plataforma.consumo_de_ia` (13.1).",
              "`construir` aplica `alteracoes` com `alterar` e mostra `fala`; `build-assistant.ts` sai."
            ],
            "pronto": "Em homologação, “quero um Agente que responda dúvidas de preço no WhatsApp” preenche nome, descrição e instruções."
          },
          {
            "n": "Decidir como a prévia funciona para um Agente ainda não salvo",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "A prévia (`agent-builder.tsx:158-171`) roda antes de o Agente existir. A regra B82 diz que o ensaio é uma Execução gravada, e uma Execução precisa de `agentId`.",
            "opcoes": [
              "(A) A primeira prévia salva o Agente em rascunho e roda um ensaio de verdade",
              "(B) A prévia chama o modelo com o rascunho sem gravar Execução; só o consumo fica registrado"
            ],
            "muda": "(A): a prévia usa a rota de ensaio, com passos e custo na ficha; aparecem Agentes em rascunho que ninguém publicou. (B): uma rota a mais, `POST /ia/construtor/previa`, e a prévia não mostra passos.",
            "recomendo": "(A): uma regra só para testar Agente.",
            "peso": "produto"
          },
          {
            "n": "Fazer cancelar parar o modelo",
            "cam": [
              "api"
            ],
            "hoje": "`cancelarExecucao` (`agentes.ts:548`) já grava e está ligada na ficha (`agente-completo.tsx:442`), mas só muda o registro: o modelo continuaria respondendo.",
            "fazer": [
              "Criar `apps/api/src/ia/execucao/em-curso.ts`, um mapa `executionId → AbortController`, preenchido pelo laço.",
              "Em `apps/api/src/rotas/operacoes.ts`, depois de confirmar `cancelarExecucao`, abortar o controlador da Execução.",
              "O laço relê o estado da Execução antes de cada Ferramenta, para o caso de outro processo da API ter cancelado."
            ],
            "pronto": "Teste: cancelar durante uma resposta do `modelo-falso` interrompe o streaming e nenhuma Ferramenta posterior roda."
          },
          {
            "n": "Fazer a Ferramenta “lembrar” gravar na Memória",
            "cam": [
              "dom"
            ],
            "hoje": "Nenhuma operação cria `AgentMemoryItem` (`types/ai.ts:285`); apagar já funciona (`agentes.ts:593`).",
            "fazer": [
              "Se a T.4 escolheu (A): o executor de `lembrar` grava o Item com `executionId` e `originDelegateMemberId`, só com `memoryEnabled` e fora de ensaio (regra RN-AGE-22).",
              "`montarContextoDoTurno` inclui os Itens de mesmo delegante (DO-AGE-07) e grava os ids em `memoryItemIds`."
            ],
            "pronto": "Teste: “me chame de Zé” numa Sessão aparece no contexto de outra Sessão do mesmo Membro e não na de outro Membro."
          }
        ]
      }
    ],
    "ajuste": "+2 dias: Skills em .md com leitura sob demanda, um passo do Construtor para cada poder, retomada depois da aprovação e expiração dos pedidos."
  },
  {
    "id": "16",
    "n": "IA: Agente na Caixa de Entrada",
    "dias": [
      3,
      5
    ],
    "dep": [
      "4",
      "7",
      "14"
    ],
    "desc": "O Agente passa a atender Contatos pelos Canais conectados. A mensagem chega pela porta de entrada da Sessão 3; se a Conversa está atribuída a um Agente ativo, ele é acionado só com as próprias permissões (não há pessoa delegante, regra RN-AGE-11); o modelo responde com o contexto da Conversa; em `autonomo` a resposta sai pela porta de saída da Sessão 3 e pelo provedor da Sessão 4; nos outros níveis vira rascunho com pedido de aprovação; e uma pessoa pode assumir a qualquer momento.",
    "partida": [
      "A regra RN-AGE-14 (`ontologia/04-ia/agentes.md:460`) define o caminho: Agente atribuído a uma Conversa é acionado a cada mensagem recebida; a autonomia decide envio direto ou rascunho com aprovação; transferir a Conversa cancela a Execução em curso.",
      "`plataforma.conversas` (migração 008) aceita `atribuido_tipo` = 'agente'; o domínio já tem `Conversa.atribuido` (`packages/dominio/src/crm/conversas.ts:54`); não há rota que atribua (`ServicoDeConversas`, `apps/api/src/servicos/crm/conversas.ts:56`, só lista, obtém, cria, resolve e reabre).",
      "`plataforma.canais` tem `fila_padrao_id` e `proprietario_padrao_id`, sem Agente. Fila não tem tabela (decisão D-09 da 008).",
      "Rascunho de Conversa ficou fora da 008 de propósito (comentário do topo da migração).",
      "`plataforma.mensagens` aceita `ator_tipo` = 'agent'. A janela de 24 h só vale no WhatsApp oficial: o não oficial não tem janela (`capacidadesDoCanal`, `packages/dominio/src/operations/conversations.ts:115-125`).",
      "Das sessões anteriores: porta de entrada e de saída (3.2 e 3.3), tempo real (3.4), Caixa de Entrada nas tabelas novas (3.1), Evolution (4.2) e o laço do Agente com aprovações (14.1 e 14.3)."
    ],
    "pronto": "Num número da Evolution conectado, uma mensagem do celular numa Conversa atribuída a um Agente recebe resposta dele: direto em `autonomo`, ou como rascunho que uma pessoa aprova pela Caixa de Entrada nos outros níveis; clicar “Assumir” para o Agente na hora.",
    "tarefas": [
      {
        "id": "16.1",
        "n": "Atribuição",
        "objetivo": "A tabela aceita um Agente como responsável pela Conversa, mas nada atribui, o Canal não tem Agente padrão e arquivar um Agente não solta as Conversas dele. Aqui nascem a coluna, a rota e as regras.",
        "pronto": "Uma Conversa nova num Canal com Agente padrão já nasce atribuída a ele, e arquivar o Agente devolve a Conversa sem responsável.",
        "subs": [
          {
            "n": "Criar a migração do Agente padrão e do rascunho",
            "cam": [
              "banco"
            ],
            "hoje": "`plataforma.canais` não tem coluna de Agente; não existe tabela de rascunho.",
            "fazer": [
              "Migração nova: `alter table plataforma.canais add column agente_padrao_id text` (sem FK: o Agente vive em `plataforma.registros`).",
              "Na mesma migração, `plataforma.rascunhos_de_conversa` (workspace_id, id, conversa_id, origem 'agente' ou 'membro', autor_tipo, autor_id, execucao_id, aprovacao_id, conteudo, situacao 'aberto' / 'enviado' / 'descartado', criado_em), com FK composta para `plataforma.conversas` e no máximo um rascunho aberto de Agente por Conversa.",
              "Rodar `npm run migrar -w @n1/api -- --seco` antes de aplicar."
            ],
            "pronto": "Migração aplicada em homologação; `npm run migrar -w @n1/api -- --seco` não lista mais nada."
          },
          {
            "n": "Atribuir e desatribuir a Conversa",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existe operação nem rota. A regra RN-AGE-20 diz que só Agente `ativo` pode ser atribuído.",
            "fazer": [
              "Em `packages/dominio/src/crm/conversas.ts`, `validarAtribuicao(alvo, { agenteAtivo })`.",
              "Em `servicos/crm/conversas.ts`, `atribuir(membro, id, alvo)`, com `alvo` = `{ tipo: 'membro' | 'agente', id }` ou `null`; o estado do Agente é lido direto em `plataforma.registros` (colecao = 'agents').",
              "Rota `PATCH /conversas/:id/atribuicao` em `apps/api/src/rotas/crm/conversas.ts`."
            ],
            "pronto": "Teste da rota: atribuir a um Agente pausado volta 409; a um ativo grava `atribuido_tipo` = 'agente' em `plataforma.conversas`."
          },
          {
            "n": "Configurar o Agente padrão do Canal",
            "cam": [
              "dom",
              "api",
              "web"
            ],
            "hoje": "`Canal` (`packages/dominio/src/crm/canais.ts:34`) tem `filaPadraoId` e `proprietarioPadraoId`; a ficha do Canal é `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx`.",
            "fazer": [
              "`Canal` e `EdicaoDeCanal` (`canais.ts:107`) ganham `agentePadraoId`; `validarEdicaoDeCanal` aceita.",
              "Repositório e serviço de Canais gravam a coluna nova.",
              "Na ficha do Canal, um seletor com os Agentes ativos.",
              "No recebimento completo da Sessão 3 (3.2), a Conversa nova nasce atribuída ao Agente padrão quando ele está ativo; senão, ao proprietário padrão."
            ],
            "pronto": "Uma mensagem simulada pelo webhook num Canal com Agente padrão cria a Conversa com `atribuido_tipo` = 'agente'."
          },
          {
            "n": "Soltar as Conversas ao arquivar o Agente",
            "cam": [
              "api"
            ],
            "hoje": "`arquivarAgente` e `enviarAgenteALixeira` (`operations/ia/agentes.ts:221` e `:254`) mudam só o Agente. A regra RN-AGE-20 diz: pausado mantém as Conversas sem agir; arquivado e na lixeira as liberam.",
            "fazer": [
              "Em `apps/api/src/rotas/operacoes.ts`, ao rodar essas duas operações, passar a `executar()` um `aoConfirmar` (`persistencia/unidade-de-trabalho.ts:74`) que, na mesma transação, limpa `atribuido_tipo`/`atribuido_id` das Conversas do Agente e `agente_padrao_id` dos Canais.",
              "Pausado não muda nada nas tabelas: o acionamento (16.2) é que confere o estado."
            ],
            "pronto": "Teste: arquivar um Agente com duas Conversas deixa as duas sem responsável e o Canal sem Agente padrão."
          }
        ]
      },
      {
        "id": "16.2",
        "n": "Acionar o Agente",
        "objetivo": "Nada acontece quando chega mensagem numa Conversa de Agente. Aqui a porta de entrada passa a abrir uma Execução para cada mensagem recebida, com o contexto da Conversa e só as permissões do Agente.",
        "pronto": "A mensagem chega pelo webhook e nasce uma Execução com origem `caixaDeEntrada`, visível em `/ia/execucoes/<id>`.",
        "subs": [
          {
            "n": "Abrir a Execução ao chegar mensagem",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existe. A origem `caixaDeEntrada` já está no tipo (`AgentExecution.origin`, `types/ai.ts:262`).",
            "fazer": [
              "No domínio, `abrirExecucaoDaCaixa(state, agentId, conversa)` em `packages/dominio/src/operations/ia/execucao-da-caixa.ts`, fora do registro: Agente ativo e disponível, origem `caixaDeEntrada`, invocador Sistema, sem delegante, Âncora `conversation`.",
              "Criar `apps/api/src/ia/caixa-de-entrada/acionar-agente.ts` com `acionarAgenteDaConversa(workspaceId, conversaId, mensagemId)`, chamado pela fila de entrada da Sessão 3 depois de gravar uma mensagem `recebida` que não é repetida.",
              "Uma Execução por mensagem (regra RN-AGE-14), uma de cada vez por Conversa (`pg_advisory_xact_lock` pelo id da Conversa)."
            ],
            "pronto": "Teste: duas mensagens seguidas numa Conversa de Agente geram duas Execuções, a segunda começando depois de a primeira terminar; numa Conversa de pessoa, nenhuma."
          },
          {
            "n": "Montar o contexto da Conversa",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "No domínio, `montarContextoDaConversa({ versao, contato, mensagens, trechos, memoria })`, pura: os dados vêm das tabelas e o `apps/api` os passa.",
              "O `apps/api` lê as últimas mensagens em `plataforma.mensagens` (variável `IA_HISTORICO_DA_CONVERSA`, padrão 30), o Contato em `plataforma.contatos` e os trechos de `consultar_conhecimento` (primeiros Fragmentos até a Sessão 17).",
              "A `ContextComposition` grava os ids lidos."
            ],
            "pronto": "Em homologação, o Agente responde chamando o Contato pelo nome e citando um trecho da Coleção concedida."
          },
          {
            "n": "Executar as Ferramentas do CRM com as permissões do Agente",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "As Ferramentas do CRM existem só no Catálogo. Os serviços do CRM recebem um `MembroDaSessao` (`apps/api/src/plugins/autenticacao.ts`), nunca um Agente.",
            "fazer": [
              "Criar `apps/api/src/ia/execucao/ferramentas-do-crm.ts` com `ler_contato`, `ler_conversa`, `ler_negocio`, `sugerir_resposta`, `atualizar_qualificacao` e `enviar_mensagem`, chamando os serviços de `apps/api/src/servicos/crm/`.",
              "Os serviços passam a aceitar um ator Agente além do Membro, gravando `ator_tipo` = 'agent'.",
              "No domínio, `recusaDoAgenteNoCrm(state, agentId, toolId, alvo)` usa só as concessões do Agente e o Papel dele (Convidado, regra B76), sem interseção com pessoa (regra RN-AGE-11)."
            ],
            "pronto": "Teste: um Agente sem `editar` no Contato tenta `atualizar_qualificacao` e o passo fica `negada`."
          }
        ]
      },
      {
        "id": "16.3",
        "n": "Responder",
        "objetivo": "Hoje nada sai em nome do Agente. Aqui a resposta sai direto em `autonomo` ou vira rascunho com pedido de aprovação nos outros níveis, como manda a regra RN-AGE-14.",
        "pronto": "Os dois caminhos funcionando com um número da Evolution.",
        "subs": [
          {
            "n": "Enviar direto em autônomo",
            "cam": [
              "api"
            ],
            "hoje": "`ServicoDeMensagens.enviar` (`apps/api/src/servicos/crm/mensagens.ts:46`) só envia em nome de um Membro.",
            "fazer": [
              "`enviarComoAgente(workspaceId, agentId, { conversaId, conteudo, execucaoId })` em `servicos/crm/mensagens.ts`: grava a mensagem `enviada` com `ator_tipo` = 'agent', sem delegante, e a manda pela porta de saída da Sessão 3 (3.3), que entrega à Evolution (4.2).",
              "O executor de `enviar_mensagem` chama `enviarComoAgente` quando `exigeAprovacao` (14.1) diz que não precisa."
            ],
            "pronto": "Com um Agente `autonomo`, a mensagem mandada do celular recebe a resposta no celular."
          },
          {
            "n": "Rascunho e aprovação nos outros níveis",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "Não existe rascunho de Conversa até a migração da 16.1.",
            "fazer": [
              "Quando `enviar_mensagem` exige aprovação: gravar o texto em `plataforma.rascunhos_de_conversa` com `execucao_id`, e criar o pedido com `solicitarAprovacaoDaFerramenta` (14.3), objeto fixo { Ferramenta `enviar_mensagem`, texto, Conversa }, prazo da T.2.",
              "Aprovado pela rota de decisão (14.3): `enviarComoAgente` com exatamente o texto do pedido (regra RN-AGE-17) e o rascunho vira `enviado`.",
              "Recusado: o rascunho fica aberto para a pessoa. Expirado: a Conversa passa para o proprietário padrão do Canal, como decidido na T.2."
            ],
            "pronto": "Teste em `apps/api`: Agente `supervisionado` responde, o rascunho e o pedido existem, aprovar envia o texto e marca o rascunho `enviado`."
          },
          {
            "n": "Respeitar a janela de 24 h do WhatsApp oficial",
            "cam": [
              "api"
            ],
            "hoje": "Só o WhatsApp oficial tem janela; o não oficial não (`capacidadesDoCanal`, `operations/conversations.ts:120`). Modelos de mensagem aprovados só chegam na Sessão 7 (7.3).",
            "fazer": [
              "Antes de enviar, ler as capacidades do Canal; fora da janela, o Agente não manda texto livre: grava rascunho e passa a Conversa para uma pessoa.",
              "Quando a Sessão 7 estiver pronta, o Agente pode escolher um modelo aprovado."
            ],
            "pronto": "Teste com um Canal `whatsapp-cloud` e a última mensagem recebida há 25 h: nada é enviado, e a Conversa fica com o proprietário padrão.",
            "nota": "Depende da Sessão 7 para a parte dos modelos; com só a Evolution conectada, esta subtarefa fica no teste."
          }
        ]
      },
      {
        "id": "16.4",
        "n": "Pessoa e Agente",
        "objetivo": "Uma pessoa precisa assumir a Conversa a qualquer momento e poder devolver. Pela regra RN-AGE-14, transferir cancela o que o Agente estiver fazendo, e o texto que já tinha saído vira rascunho.",
        "pronto": "Ao clicar “Assumir”, o Agente para na hora, e “Devolver” faz a próxima mensagem ser respondida por ele.",
        "subs": [
          {
            "n": "Assumir a Conversa",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "`cancelarExecucao` (`operations/ia/agentes.ts:548`) exige um Membro que administre o Agente; não há cancelamento pelo Sistema.",
            "fazer": [
              "No domínio, `cancelarPorTransferencia(state, executionId)`, ator Sistema, motivo “Conversa transferida”; cancela também os pedidos pendentes da Execução.",
              "A rota de atribuição (16.1), ao trocar de Agente para Membro, chama essa operação, aborta o modelo pelo `em-curso.ts` (14.4) e grava o texto parcial como rascunho (regra RN-AGE-21)."
            ],
            "pronto": "Teste: assumir durante uma resposta do `modelo-falso` deixa a Execução `cancelada` e nenhuma mensagem `enviada` do Agente."
          },
          {
            "n": "Devolver ao Agente",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "A mesma rota de atribuição, de Membro para Agente ativo.",
              "A próxima mensagem `recebida` aciona o Agente; o que chegou antes não é respondido de novo."
            ],
            "pronto": "Teste: depois de devolver, a mensagem seguinte gera uma Execução."
          },
          {
            "n": "Mostrar o atendimento do Agente na Caixa de Entrada",
            "cam": [
              "web"
            ],
            "hoje": "O fio da Conversa é `apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` e não mostra quem atende nem rascunho.",
            "fazer": [
              "No cabeçalho do fio, “Atendido por <Agente>” e os botões Assumir e Devolver.",
              "Acima do campo de resposta, o rascunho aberto do Agente com Aprovar (rota de decisão da 14.3), Editar (assume a Conversa, põe o texto no campo e recusa o pedido com motivo “editado pela pessoa”) e Descartar.",
              "Na lista (`caixa-de-entrada/page.tsx`), um filtro “Com Agente”.",
              "O rascunho aparece sem recarregar pelo tempo real da Sessão 3 (3.4)."
            ],
            "pronto": "Você opera uma Conversa com Agente só pela tela: vê o rascunho, aprova, assume e devolve."
          }
        ]
      },
      {
        "id": "16.5",
        "n": "Limites do atendimento",
        "objetivo": "Sem limite, um Agente pode conversar sem fim com um Contato e gastar além do teto. Aqui ele tem teto por Conversa e por dia, e você decide se ele atende em horário definido.",
        "pronto": "Ao passar do teto, a Conversa vai para uma pessoa com uma nota interna.",
        "subs": [
          {
            "n": "Teto por Conversa e por dia",
            "cam": [
              "api"
            ],
            "hoje": "Só existe o teto mensal da Sessão 13 (`apps/api/src/ia/teto.ts`).",
            "fazer": [
              "Variáveis `IA_MAX_RESPOSTAS_POR_CONVERSA_DIA` (padrão 30) e `IA_MAX_CUSTO_POR_CONVERSA_DIA_USD`, somadas em `plataforma.consumo_de_ia` pela coluna `conversa_id`.",
              "Ao atingir, `acionarAgenteDaConversa` não chama o modelo: atribui a Conversa ao proprietário padrão do Canal e grava uma mensagem `interna` “O Agente atingiu o limite do dia”."
            ],
            "pronto": "Teste com teto de 2 respostas: a terceira mensagem passa a Conversa para a pessoa e não cria Execução."
          },
          {
            "n": "Decidir se o Agente atende em horário definido",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Não há horário de atendimento nos Canais (`plataforma.canais`, migração 008).",
            "opcoes": [
              "(A) O tempo todo",
              "(B) Só em horário definido; fora dele, avisa que alguém responde depois",
              "(C) Só fora do horário comercial, quando não há pessoas"
            ],
            "muda": "(A) não muda nada. (B) e (C) exigem a coluna `horario_de_atendimento` (jsonb) em `plataforma.canais` numa migração nova, o campo na ficha do Canal e a conferência em `acionarAgenteDaConversa`: meio dia.",
            "recomendo": "(C): é onde o Agente mais ajuda no começo.",
            "peso": "produto"
          }
        ]
      }
    ],
    "ajuste": "+2 dias: tabela de rascunhos, atribuição, acionamento, Ferramentas do CRM com o Agente como ator, assumir e devolver, e limites."
  },
  {
    "id": "15",
    "n": "IA: Integrações da empresa e pessoais",
    "dias": [
      4,
      5
    ],
    "dep": [
      "1",
      "14"
    ],
    "ajuste": "+1 dia: além da ponte com o Composio, cada Integração (Omie, Google Agenda, Miro) precisa de teste com conta real.",
    "desc": "As Integrações passam a conectar de verdade, em dois níveis: da empresa (todos usam a mesma, como o Omie) e pessoal (cada pessoa conecta a sua, como a Google Agenda). Começa com Omie, Google Agenda e Miro. Esta sessão supõe as escolhas recomendadas no levantamento (T2.2: Composio para o que ele tiver); se a escolha for outra, as tarefas 15.2 e 15.5 mudam.",
    "partida": [
      "`Integration` (`packages/dominio/src/types/workspace.ts:182`) tem estado, quem configurou e Ferramentas expostas, mas não tem dono nem nível.",
      "`conectarIntegracao` e `desconectarIntegracao` (`packages/dominio/src/operations/ia/integracoes.ts:89` e `:125`) só trocam o estado: nenhuma conexão real.",
      "O lançamento no Omie acontece no serviço externo `automation/`, chamado pela ponte `apps/api/src/automacoes/invocar-agente.ts`; a Integração guarda só o rótulo da conta (`contaRotulo`).",
      "O cofre de credenciais da Sessão 1 guarda segredos cifrados."
    ],
    "pronto": "Um Membro conecta a própria Google Agenda pela tela e o Agente lista os eventos dele no Chat; outro Membro não vê esses eventos; o Agente consulta uma conta a pagar no Omie com a conexão da empresa.",
    "tarefas": [
      {
        "id": "15.1",
        "n": "Conexões da empresa e pessoais no domínio",
        "objetivo": "Hoje uma Integração não tem dono: não dá para ter a Google Agenda de cada pessoa. Ela passa a ter nível (empresa ou pessoal) e, no pessoal, um dono.",
        "pronto": "Testes do domínio provam que um Membro não vê nem usa a conexão pessoal de outro.",
        "subs": [
          {
            "n": "Dar nível e dono à conexão",
            "cam": [
              "dom"
            ],
            "hoje": "`Integration` (`packages/dominio/src/types/workspace.ts:182`) não tem dono, e a ontologia diz que Integração não tem Proprietário (regra B35).",
            "fazer": [
              "Criar o tipo `Conexao` no domínio: a Integração (Omie, Google Agenda, Miro), o nível (`empresa` ou `pessoal`), o Membro dono quando é pessoal, o estado (conectada, desconectada, com erro) e a referência à credencial no cofre.",
              "Regras: só administrador conecta e desconecta a da empresa; só o próprio Membro mexe na pessoal; ninguém lê a credencial.",
              "Registrar em Atividade quem conectou e desconectou, sem a credencial."
            ],
            "pronto": "Testes do domínio para as três regras."
          },
          {
            "n": "Criar a tabela de conexões",
            "cam": [
              "banco"
            ],
            "hoje": "Não existe.",
            "fazer": "Migração nova com `plataforma.conexoes`: `id`, `workspace_id`, `integracao`, `nivel`, `membro_id` (vazio quando é da empresa), `estado`, `credencial_id` (no cofre) ou o id da conta conectada no Composio, `conectado_em` e `conectado_por`.",
            "pronto": "Migração aplicada em homologação."
          },
          {
            "n": "Escolher a conexão certa quando o Agente usa uma Integração",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "No Chat, usar a conexão pessoal de quem está conversando; na falta dela, a da empresa.",
              "Num atendimento de cliente (Caixa de Entrada, Sessão 16), usar só as conexões da empresa.",
              "Seguir a regra que o levantamento escolher (T2.2), se for diferente."
            ],
            "pronto": "Teste: o mesmo Agente, perguntado por dois Membros, lê a agenda de cada um."
          }
        ]
      },
      {
        "id": "15.2",
        "n": "Ponte com o Composio",
        "objetivo": "Usar o Composio para as Integrações que ele tem, em vez de escrever o login e as chamadas de cada sistema.",
        "pronto": "Uma conexão pessoal e uma da empresa feitas pelo Composio, usadas pelo Agente.",
        "subs": [
          {
            "n": "Criar a ponte com o Composio",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Criar `apps/api/src/integracoes/composio.ts`, o único arquivo que fala com o Composio, com a chave no ambiente (`COMPOSIO_API_KEY`).",
              "Usar como “usuário” do Composio o id do Membro, para as conexões pessoais, e o id do Espaço de Trabalho, para as da empresa."
            ],
            "pronto": "Teste de integração contra a conta de homologação do Composio."
          },
          {
            "n": "Conectar pela tela",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Rota `POST /conexoes/:integracao/iniciar`: pede ao Composio o link de autorização e devolve para a tela abrir.",
              "Rota `POST /conexoes/:id/confirmar`: na volta, grava a conexão como conectada.",
              "Rota `DELETE /conexoes/:id`: desconecta no Composio e aqui."
            ],
            "pronto": "Conectar e desconectar a Google Agenda de um usuário de teste pela tela."
          },
          {
            "n": "Oferecer ao Agente as ações da conexão certa",
            "cam": [
              "api"
            ],
            "hoje": "As Ferramentas de Integração existem só no catálogo, sem executar.",
            "fazer": "Ao montar a conversa do Agente, pedir ao Composio as ações das Integrações que o Agente tem como poder, usando a conexão escolhida pela regra da 15.1, pelo servidor MCP do Composio ou pelo SDK dele (o que a prova de conceito indicar).",
            "pronto": "No Chat, o Agente lista os próximos eventos da Google Agenda de quem pergunta."
          }
        ]
      },
      {
        "id": "15.3",
        "n": "Telas de conexão",
        "objetivo": "Cada pessoa conecta as suas Integrações, e o administrador conecta as da empresa.",
        "pronto": "As duas telas funcionando e a aba antiga fora do menu.",
        "subs": [
          {
            "n": "Integrações da empresa em Configurações",
            "cam": [
              "web"
            ],
            "hoje": "`/configuracoes/integracoes` é só leitura (contas do Omie por Empresa) e `/ia/personalizar/conectores` repete a lista.",
            "fazer": [
              "`/configuracoes/integracoes` lista as Integrações da empresa com Conectar e Desconectar, só para administrador.",
              "Tirar a aba Integrações de IA › Personalizar (`apps/web/src/features/ia/personalizar/secoes.ts:17`)."
            ],
            "pronto": "O administrador conecta o Miro da empresa pela tela."
          },
          {
            "n": "Conexões pessoais em Minha conta",
            "cam": [
              "web"
            ],
            "hoje": "Minha conta não tem conexões.",
            "fazer": "Nova seção Conexões em Minha conta: as Integrações pessoais disponíveis, com Conectar e Desconectar, e o estado de cada uma.",
            "pronto": "Um Membro conecta a própria Google Agenda e vê “Conectada”."
          }
        ]
      },
      {
        "id": "15.4",
        "n": "Omie como Ferramenta nossa",
        "objetivo": "O Composio não tem o Omie. As ações do Omie que o Agente usa viram Ferramentas nossas, com a chave da empresa no cofre.",
        "pronto": "O Agente consulta uma conta a pagar no Omie a pedido no Chat.",
        "subs": [
          {
            "n": "Escolher as primeiras ações do Omie para o Agente",
            "cam": [
              "voce"
            ],
            "hoje": "Hoje o Omie só recebe lançamentos, pelo serviço externo `automation/`.",
            "fazer": "Escolher de duas a quatro ações para começar (por exemplo: consultar uma conta a pagar, consultar um fornecedor, listar contas a vencer).",
            "pronto": "Lista de ações escolhida."
          },
          {
            "n": "Escrever as Ferramentas do Omie",
            "cam": [
              "api"
            ],
            "hoje": "As chaves do Omie ficam no `automation/`; a Integração guarda só o rótulo da conta (`contaRotulo`, `packages/dominio/src/types/workspace.ts`).",
            "fazer": [
              "Guardar a chave do Omie de cada Empresa no cofre da Sessão 1, como conexão da empresa.",
              "Escrever cada ação escolhida como Ferramenta em `apps/api`, chamando a API do Omie com essa chave.",
              "O lançamento que já funciona pelo `automation/` continua como está."
            ],
            "pronto": "Teste: a Ferramenta “consultar conta a pagar” devolve a conta certa da Empresa certa."
          }
        ]
      },
      {
        "id": "15.5",
        "n": "Google Agenda e Miro",
        "objetivo": "As duas primeiras Integrações pelo Composio, prontas para o Agente usar.",
        "pronto": "As duas aparecem como poder no Construtor e funcionam no Chat.",
        "subs": [
          {
            "n": "Ligar a Google Agenda (pessoal)",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": "Habilitar no Composio as ações de listar eventos, criar evento e procurar horário livre, e oferecê-las ao Agente que tem a Google Agenda como poder.",
            "pronto": "No Chat, o Agente marca um evento na agenda de quem pediu, depois de aprovado."
          },
          {
            "n": "Ligar o Miro",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": "Habilitar no Composio as ações de listar quadros e criar notas num quadro.",
            "pronto": "No Chat, o Agente cria uma nota num quadro de teste."
          }
        ]
      }
    ]
  },
  {
    "id": "18",
    "n": "IA: Automações em código e Plugins",
    "dias": [
      4,
      6
    ],
    "dep": [
      "14",
      "17"
    ],
    "ajuste": "+2 dias: o tamanho depende da lista de Automações, que ainda não chegou.",
    "desc": "As Automações deixam de ser criadas pela tela e passam a ser rotinas escritas em código pelo time, que o Agente pode acionar. Entram também os Plugins: pacotes de Skills, Conhecimento e Automações que se instalam num Agente de uma vez. Esta sessão supõe as escolhas recomendadas no levantamento (T2.6). Fica bloqueada até a lista de Automações chegar.",
    "partida": [
      "Editor visual de Automações em `apps/web/src/features/ia/automacoes/editor-de-automacao.tsx` (1.310 linhas), aberto em `/ia/automacoes/[automacao]`.",
      "Motor no domínio (`runListAutomations`, `packages/dominio/src/operations/automations.ts:696`) que já roda as Automações do Financeiro por evento e por horário.",
      "A aba “Plugins” (`apps/web/src/features/ia/personalizar/secoes.ts:19`) só lista as Ferramentas; não existe tipo Plugin."
    ],
    "pronto": "Ninguém cria Automação pela tela; as do Financeiro continuam rodando; o Agente aciona uma Automação do catálogo; um Plugin instalado num Agente traz as Skills, o Conhecimento e as Automações dele.",
    "tarefas": [
      {
        "id": "18.1",
        "n": "Tirar o editor visual",
        "objetivo": "Na reunião de 19/10 ficou decidido que Automação não se cria pela tela. O editor sai, sem parar o que já roda.",
        "pronto": "Não há como criar ou editar Automação pela tela, e as do Financeiro continuam disparando.",
        "subs": [
          {
            "n": "Tirar o editor e os botões de criar e editar",
            "cam": [
              "web"
            ],
            "hoje": "O editor existe em `apps/web/src/features/ia/automacoes/editor-de-automacao.tsx`, com rota em `/ia/automacoes/[automacao]` e botão de criar na lista de IA › Personalizar › Automação.",
            "fazer": [
              "Apagar o editor e a rota de edição.",
              "Manter a lista em IA › Personalizar › Automação, só de leitura: nome, o que faz, quando roda e a última execução."
            ],
            "pronto": "A lista abre, sem botão de criar nem de editar."
          },
          {
            "n": "Manter as Automações do Financeiro rodando",
            "cam": [
              "dom"
            ],
            "hoje": "As Automações do Financeiro são registros em `plataforma.registros`, rodados por `runListAutomations` e pelo agendador (`apps/api/src/automacoes/scheduler-worker.ts`).",
            "fazer": [
              "Não mexer no motor nesta sessão.",
              "Tirar do domínio as operações do editor que ficam sem uso (`packages/dominio/src/operations/ia/automacoes-editor.ts`), mantendo as que o motor usa."
            ],
            "pronto": "Uma Solicitação de pagamento nova continua disparando as Automações do Financeiro em homologação."
          }
        ]
      },
      {
        "id": "18.2",
        "n": "Catálogo de Automações em código",
        "objetivo": "Ter um lugar no código onde cada Automação nova é escrita, descrita para o Agente e registrada.",
        "pronto": "Uma Automação de exemplo no catálogo roda por horário e aparece na lista.",
        "subs": [
          {
            "n": "Criar o formato do catálogo",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Criar `packages/dominio/src/automacoes/catalogo/`, com um arquivo por Automação.",
              "Cada arquivo diz: id, nome, descrição (que o Agente lê), parâmetros com tipos, efeito (leitura, escrita ou externo), gatilho opcional (evento ou horário) e a função que executa.",
              "Cada execução gera um registro de Execução de Automação, como hoje."
            ],
            "pronto": "Teste da Automação de exemplo."
          },
          {
            "n": "Rodar as Automações com gatilho",
            "cam": [
              "api"
            ],
            "hoje": "O agendador só conhece as Automações gravadas no banco.",
            "fazer": "O agendador e o motor de eventos passam a rodar também as Automações do catálogo que têm gatilho.",
            "pronto": "A Automação de exemplo roda sozinha no horário marcado."
          }
        ]
      },
      {
        "id": "18.3",
        "n": "O Agente aciona Automações",
        "objetivo": "Na reunião de 19/10 ficou decidido que o Agente consegue acessar as Automações. Cada Automação do catálogo vira um poder que o Agente pode receber.",
        "pronto": "No Chat, o Agente aciona a Automação de exemplo e a Execução aparece registrada.",
        "subs": [
          {
            "n": "Transformar cada Automação em Ferramenta do Agente",
            "cam": [
              "api"
            ],
            "hoje": "Não existe.",
            "fazer": [
              "Cada Automação do catálogo vira uma Ferramenta com o nome, a descrição e os parâmetros dela.",
              "O Agente só vê as Automações que recebeu como poder no Construtor (Sessão 14).",
              "Automação de efeito externo passa pela aprovação da Sessão 14."
            ],
            "pronto": "Teste: o Agente sem o poder não vê a Automação; com o poder, aciona e a Execução é registrada."
          }
        ]
      },
      {
        "id": "18.4",
        "n": "Implementar as Automações da lista",
        "objetivo": "Escrever no catálogo as Automações que você listar. Esta tarefa ganha uma subtarefa por Automação quando a lista chegar.",
        "pronto": "Todas as Automações da lista no catálogo, cada uma com teste.",
        "subs": [
          {
            "n": "Escrever cada Automação da lista no catálogo",
            "cam": [
              "dom",
              "api"
            ],
            "hoje": "A lista ainda não chegou (item T2.6.3 do levantamento).",
            "fazer": "Uma subtarefa por Automação, criada quando a lista chegar, no padrão da 18.2.",
            "pronto": "Cada Automação com teste e aparecendo na lista.",
            "nota": "Bloqueada até a lista chegar."
          }
        ]
      },
      {
        "id": "18.5",
        "n": "Plugins",
        "objetivo": "Um Plugin junta Skills, Conhecimento e Automações e se instala num Agente de uma vez.",
        "pronto": "Instalar um Plugin num Agente faz aparecer na ficha dele, de uma vez, as Skills, as Coleções e as Automações do Plugin.",
        "subs": [
          {
            "n": "Criar o tipo Plugin no domínio",
            "cam": [
              "dom"
            ],
            "hoje": "Não existe tipo Plugin; “Plugins” é só o nome da aba que lista Ferramentas.",
            "fazer": [
              "Criar `Plugin` em `packages/dominio/src/types/ai.ts`: nome, descrição, Skills, Coleções de Conhecimento e Automações do catálogo.",
              "Operações: criar, editar, arquivar, instalar num Agente e desinstalar.",
              "Instalar concede as Skills, o acesso às Coleções e o acionamento das Automações. Desinstalar retira só o que veio do Plugin, sem mexer no que o Agente já tinha."
            ],
            "pronto": "Testes de instalar e desinstalar, incluindo um Agente que já tinha uma das Skills."
          },
          {
            "n": "Telas de Plugins",
            "cam": [
              "web"
            ],
            "hoje": "A aba “Plugins” (`apps/web/src/features/ia/personalizar/secoes.ts:19`) lista Ferramentas.",
            "fazer": [
              "A aba atual passa a se chamar “Ferramentas”.",
              "Nova aba “Plugins”, com a lista de pacotes e a tela de montar um Plugin escolhendo Skills, Coleções e Automações.",
              "No Construtor (Sessão 14), o passo Plugins instala e desinstala."
            ],
            "pronto": "Você monta um Plugin pela tela e o instala num Agente."
          },
          {
            "n": "Quem pode criar um Plugin?",
            "cam": [
              "dec"
            ],
            "decisao": true,
            "hoje": "Não existe Plugin.",
            "opcoes": [
              "(A) Administrador, pela tela, juntando Skills, Coleções e Automações que já existem",
              "(B) Só o time, no código"
            ],
            "muda": "(A) é a tela da tarefa anterior. (B) tira a tela de montar e deixa só a de instalar.",
            "recomendo": "(A): o Plugin só junta peças que já existem, então não há risco de criar algo que o time não escreveu.",
            "peso": "arrumacao"
          }
        ]
      }
    ],
    "bloqueio": "Só começa com a lista de Automações (item T2.6.3 do levantamento)."
  }
];
