# INVENTÁRIO DE TELAS

Fase 2 — Mapa / Manual de UX · Versão 1.0 · 2026-09-10
Fonte de verdade: `ontologia/` v1.0. Padrões que toda tela obedece: `PADROES-TRANSVERSAIS.md` (não repetidos aqui).

**51 telas + 32 diálogos** (D16–D32 entraram em 2026-09-17, com a Lista conversacional e os fluxos de criação da IA). Cada ficha traz: propósito, entidades e atributos exibidos (conferidos contra a seção 6 do documento), estados representados (seção 11), ações e as regras que a interface faz valer (seção 13), cardinalidades dos controles (matriz), estado vazio e permissões.

Convenção: **[E]** entidade · **[A]** atributo · **[D]** derivado · **[VO]** objeto de valor · **⟨n⟩** documento da ontologia.

---

# I. SESSÃO E INÍCIO

## T00 · Login — `/login` ⟨01⟩

**Propósito.** A porta fictícia do protótipo: usuário e senha, sem backend. A ontologia distingue Usuário (a identidade que autentica) de Membro (a relação com o Espaço de Trabalho — A1.4); o produto navegável simula só o segundo (T01), então aqui qualquer usuário e senha entram. Alcançada pelo menu da conta ("Sair"); nada redireciona para ela.

**Exibe.** A marca (monograma em marca-d'água, logo completa) à esquerda; à direita o cartão com Usuário e Senha.

**Estados.** Campo vazio ao enviar → erro inline "Informe o usuário e a senha." Enviando → botão em pendência (`carregando`) até o Início chegar.

**Ações e regras.** Entrar (navega ao Início no ato); ir a T01 para escolher o Membro.

**Cardinalidade.** Dois campos obrigatórios.

## T01 · Entrar — `/entrar` ⟨01⟩

**Propósito.** Escolher qual Membro simula a sessão. Substitui a autenticação; a ontologia distingue Usuário (identidade global) de Membro (relação com o Espaço de Trabalho) — A1.4 — e o produto navegável simula só o segundo.

**Exibe.** [E] Membro: Nome de exibição no Espaço de Trabalho [A], Papel [A], Estado [A], Equipes [A], Disponibilidade de atendimento [VO]. [E] Espaço de Trabalho: Nome [A], Estado [A].

**Estados.** Membro `pendente` (não entra — "Convite não aceito"), `ativo`, `suspenso` (entra em modo somente leitura, com aviso), `removido` (não entra — "Participação encerrada em 12/08"). Espaço de Trabalho `suspenso` exibe aviso e permite entrar só ao Proprietário e Administradores, sem ações com efeito (RN-ET-19).

**Ações e regras.** Entrar como o Membro escolhido. Regra visível: um Membro `pendente` não age e não integra Equipes (RN-ET-12); um `suspenso` tem permissões efetivas vazias para ações com efeito (RN-ET-08).

**Cardinalidade.** Seleção única obrigatória (1 Membro).

**Estado vazio.** Não se aplica: RN-ET-02 garante ao menos o primeiro Membro.

**Permissões.** Nenhuma — é a porta de entrada.

---

## T02 · Início — `/` ⟨06, 12, 14, 16⟩

**Propósito.** A apresentação do produto — e, rolando, o **resumo da pessoa** (desde 2026-09-24; ver "Exibe"). **Desde 2026-09-23** o palco é PRETO de borda a borda e nele só há o **robô 3D** do Spline (`design/cena-spline.tsx`, a cena do componente `splite` do 21st.dev), centralizado, de perto — da cabeça ao meio da barriga —, virando a cabeça para o cursor em qualquer ponto da tela; a pedido: "quero tudo preto sem a logo N1 e o efeito animado… crie o robô na tela de início". Saíram a marca 3D, o campo vivo (as ondas), os orbes e as estrelas; no mesmo dia, também a pedido, saíram o **holofote** que seguia o cursor POR CIMA do palco (ele voltou no fim do dia, a pedido, ATRÁS do robô — ver "Exibe"), a **saudação** e o **campo da pergunta** ao Assistente ("remova") — o Assistente segue no menu (IA › Chat). **Antes disso**, foi refeita em 2026-09-17 e **refeita do zero outra vez em 2026-09-21**, quando o usuário mandou recomeçar mantendo só a identidade visual, com movimento e efeito de mouse, e sem o Explorar: um palco sem rolagem em que o fundo inteiro é o campo vivo — um tecido de ondas de traços desde 2026-09-22, e por cima a marca em 3D, a saudação e a pergunta. Deixou de responder "o que espera por mim" com quatro números; essa leitura voltou para o menu lateral e para a barra global — **e voltou a responder em 2026-09-24, ABAIXO do palco, rolando**: o resumo com as Tarefas, os Leads a atender, as Mensagens novas e as estatísticas da pessoa, só leitura e atalhos ("O que voltou em 2026-09-24", abaixo). Não inventa entidade nova e não altera nada.

**Exibe (desde 2026-09-23).** **Desde 2026-09-24 a tela ROLA** ("nesta tela de início, quando o user rolar para baixo ele deve conseguir fazer o scroll normal e o robô deve ir desaparecendo conforme o scroll, fazendo o efeito reverso de entrada; conforme for rolando, a tela muda e vira uma tela de informações e acesso rápido: minhas tarefas, tasks atuais se tiver, quantas estão em atraso e afins, leads a serem atendidos, se há novas mensagens e um menu de estatística daquele user na semana, mês e afins"): o palco, da altura da tela, fica PRESO no topo (`sticky`) e, rolando, a entrada do robô toca AO CONTRÁRIO, por posição de rolagem (`features/inicio/saida-do-palco.ts`: `p` = quanto rolou ÷ a altura do palco) — os controles do palco (a saudação, o botão de voz, a caixa, o balão e o atalho "Seu resumo") esmaecem primeiro (somem em p = 0,25) e deixam de receber o ponteiro; a câmera volta ao rosto pela curva da entrada invertida (a maior parte entre p 0,1 e 0,45); o robô esmaece e desfoca entre p 0,15 e 0,7 (o `revelar` do palco ao contrário, até `--chegada-desfoque`); o holofote apaga ao primeiro pixel rolado —, enquanto o **RESUMO** (`features/inicio/resumo-do-inicio.tsx`) sobe por cima como uma folha no FUNDO DO SISTEMA — o `--page` das outras telas, sem pontilhado (2026-09-25: "quando o user rolar para baixo, essa segunda visão não deve ter bg de pontilhados, e a cor não deve ser preta: deve voltar a respeitar o sistema e manter a cor de bg que está em outras telas"; até então era preta e pontilhada como o palco) —: o título "Seu resumo" com a data e a hora de referência ("Quinta-feira, 24 de setembro · atualizado às 16:39 BRT"); cinco **atalhos** — Tarefas abertas (`tarefasAbertasDoMembro`, a mesma da barra global, e o destino é o recorte "Abertas" de T12a, criado para ter o MESMO número; "n em andamento" é o grupo Em andamento do bloco abaixo), Vencidas (`?recorte=vencidas`; "venceu há 10 horas" para um instante, "venceu em 23/09/2026" para um dia civil, em erro), Para hoje (`?recorte=hoje`; o detalhe é da própria agenda: "próxima às 10:00", "1 já passou" ou "nenhum horário hoje"), Leads a atender (rola até o bloco) e Mensagens novas (`/crm/caixa-de-entrada?escopo=minhas`; "em n Conversas") —; **Suas Tarefas** numa lista só, da mais urgente à mais folgada — as Vencidas (com o marcador Vencida), as Em andamento (as "tasks atuais": categoria `em andamento`), as dos próximos 7 dias e o resto —, cada linha com o Selo do Tipo, identificador · Lista · vencimento e a Pílula do Status, cinco e "Mostrando n de m · Ver todas" (até 2026-09-25 em grupos com régua; as réguas saíram para as três listas começarem na mesma altura); **Leads a atender** (`leadsAAtender`: Contatos de que sou Proprietário com a Qualificação "Lead", sem contato ainda — "Sem contato há 5 meses" — ou esperando a nossa resposta — "Esperando resposta há 2 horas", em aviso, leva à Conversa; o corte diz "Ver todos"); **Mensagens novas** (`conversasComMensagensNovas`: as Conversas ATIVAS atribuídas a mim com Mensagem `recebida` não lida — a MESMA conta da aba "Não lidos" da Caixa de Entrada, resolvidas inclusive (P32) —, destacadas, em duas linhas como as vizinhas: o nome e "há 9 horas"; "12 não lidas" e o começo da última Mensagem); e **Estatísticas** (`estatisticasDoMembro`): Semana · Mês · Trimestre · Ano (os últimos 7 dias, 30 dias, 13 semanas, 12 meses, comparados ao período anterior de mesma duração, no fuso do Espaço de Trabalho), quatro métricas do que EU fiz — Tarefas concluídas, Mensagens enviadas, Conversas resolvidas, Negócios ganhos (com o Valor numa moeda só) — com a variação em relação ao período anterior, cada uma um botão que escolhe o gráfico em colunas (por dia, por semana ou por mês). **A diagramação do resumo** (2026-09-25: "a tela para ser rediagramada e repensada o design é essa, gostaria de mais alinhamento nos itens") é UMA GRADE para as três faixas — atalhos, blocos e estatísticas —, com colunas iguais e um vão só, e cada bloco embaixo dos atalhos dele: larga (resumo com 80 rem ou mais), cinco colunas — um atalho por coluna; Suas Tarefas sob os três atalhos de Tarefa, Leads sob o de Leads, Mensagens sob o de Mensagens; o gráfico sob as Tarefas e as quatro métricas, 2×2, sob Leads e Mensagens, na mesma altura —; média (36 rem ou mais), os três atalhos de Tarefa em terços e Leads e Mensagens em metades, Suas Tarefas na largura toda e, embaixo, Leads e Mensagens nas metades, as métricas nas metades e o gráfico na largura toda; estreita, uma coluna. As três listas têm a mesma anatomia de linha (a marca num quadrado do tamanho do Selo, o título e uma linha de meta), começam na mesma altura e as linhas têm a mesma altura; o cabeçalho de cada bloco nunca quebra (numa coluna estreita o link fica só com a seta); o título "Seu resumo" à esquerda e a data à direita, nas pontas da grade. Com o robô fora da vista (p = 1), a cena para de desenhar, a conversa por voz acaba e o **robô flutuante** aparece no canto — tocá-lo volta ao palco ("Voltar ao robô"; o foco vai ao título do palco). No alto à direita do palco, o atalho **"Seu resumo"** rola até o resumo e leva o foco ao título dele. Movimento reduzido: na saída, só a opacidade (a câmera parada e sem desfoque), e as rolagens programáticas são instantâneas. No mesmo dia, **o robô acompanha a pessoa fora do Início** ("quando o user mudar de tela, quero que o robô passe a ser um botão flutuante no canto inferior direito"): em qualquer outra tela ele é um círculo pequeno no canto inferior direito, com o rosto dele, e tocá-lo volta aqui (MAPA-DE-NAVEGACAO §2). No mesmo dia, a **saudação** volta ("em algum lugar na tela quero a mensagem de bom dia, boa tarde, boa noite com o nome do usuário"): no alto à esquerda do palco, "Boa tarde, Thiago" — a hora do Espaço de Trabalho, o primeiro nome no acento, só depois da hidratação. O **balão de respostas nasce recolhido** ("este chat deve vir por padrão recolhido… apenas um ícone de balão de mensagem ao lado da cabeça"): um botão redondo com o ícone de mensagem e a contagem; tocado, abre o histórico, e "Recolher" volta ao ícone; uma resposta nova o abre sozinha. A **caixa do chat é maior** ("aumente a caixa de texto"): 40 rem de largura e o campo na altura do alvo de toque. Sobre o preto, um **pontilhado** em padrão (fim do dia: "o background onde é preto, atrás do robô, atrás da luz, deve ter um background com pontilhados em pattern") — atrás da luz e do robô; e, dentro do palco (fora das barras laterais e do header), o **cursor** é um ponto pequeno com um anel fino ("uma bolinha pequena com círculo fino em volta"), que fica lilás sobre o que se toca e vira o cursor de texto nos campos. Só o robô — decoração (canvas, boca e camadas da logo `aria-hidden`, fora da ordem de foco), ocupando o palco inteiro —, um `h1` "Início" apenas para leitor de tela e, SEMPRE À VISTA desde 2026-09-24 (o chat é fixo: "quero que a opção de chat seja fixa na tela, ao invés de depender da interação na logo do peito"; até então a logo do peito pressionada a abria), a **caixa do assistente** no pé do palco (`features/inicio/caixa-do-assistente.tsx`; "ao pressionar o N1 no peito, quero que abra uma caixa de texto pequena no centro logo abaixo… quero um microfone também… ao invés do mic já abrir assim que apertar no logo do peito"): um campo pequeno, em transparência sobre o robô — "Pergunte ao robô…", com o cursor já dentro e SEM borda roxa ao abrir ("não deve abrir com essa borda selecionada em roxo": o foco só firma a hairline) —, ao lado o botão do microfone, o envio e o X; embaixo, o estado em palavras; em cima da linha, as **opções do robô** — Silenciar e Legenda — e, com uma delas ligada, o **balão de chat ao lado da cabeça** (`features/inicio/balao-do-robo.tsx`; "deve aparecer ao lado da cabeça dele em um balão de chat"): as respostas em texto desta sessão, cada uma com a pergunta ("Você: …" ou "Você, pelo microfone"), numa lista que rola; a resposta em curso aparece letra a letra no ritmo da fala. E, **no centro à esquerda do palco, o botão de voz** (`features/inicio/botao-de-voz.tsx`; "um botão de microfone relativamente grande… é o que inicia o bate-papo por voz com o robô"): um microfone redondo de 4,5 rem na mesma transparência; ligado, acende no acento e três **ondas** em volta do ícone crescem com o nível do som captado (subida na hora, queda lenta); embaixo, o estado em palavras (as mesmas frases da caixa) — com movimento reduzido as ondas ficam paradas. **A boca** ("no mesmo padrão gráfico dos olhos"): pontos brancos como os dos olhos, no rosto; fechada é uma linha de 9 pontos; quando o robô responde, mexe bem de leve no ritmo do som dele — só o centro acima e abaixo da linha acende (1 a 5 pontos). A câmera fica **parada da cintura para cima** ("bem maior… meio da barriga, bem close"): a cena do Spline abria colada no rosto e recuava sozinha até o corpo inteiro; agora essa abertura é parada no carregamento e substituída por uma **entrada curta** — a câmera nasce no mesmo rosto, segura meio segundo e recua em 2,5 s até a pose final ("volte o efeito de entrada dele com zoom out, porém bem mais fechado"). **Reflexos roxos** ("apenas alguns reflexos, não todos… no tom da N1"): a única luz da cena, um contraluz por trás do robô, fica no roxo da marca (`--reflexo-robo` = `--roxo-500`, #9601C5) e pinta só as bordas de ombros, braços e pescoço; e o **reflexo de cromo do rosto** ("o reflexo branco da cara deve ser roxo também"), que vem de uma textura só da cabeça (matcap), é retingido no navegador do preto ao roxo da marca e, no brilho mais forte, ao lilás do acento. O corpo e os tubos do pescoço mantêm os próprios reflexos. O robô só aparece depois de tingido (~0,2 s), para o rosto nunca piscar branco. **A logo da N1 no peito** ("com efeito de sobrepor"): o monograma da marca em duas camadas de **Sobrepor** (`mix-blend-mode: overlay`) em lilás, com a trama de carbono aparecendo por dentro, presa ao tronco — gira junto quando o robô acompanha o cursor. **Com o mouse em cima da logo, ela acende** ("destacado com luz"): uma terceira camada em modo Tela, lilás claro, com o halo roxo; ao sair, apaga. É a própria logo que acende, parada no peito. **E um holofote segue o mouse ATRÁS do robô** (fim de 2026-09-23: "quero que o efeito de luz esteja vinculado ao mouse na tela de início, assim como no padrão do prompt do robô; a luz deve passar sempre atrás do robô"): um disco de luz branca e suave (o `Spotlight` do componente do robô) que acompanha o mouse com inércia pelo palco; no preto ele aparece, e atrás do corpo some — contorna a silhueta quando passa pela cabeça e pelos ombros, sem nunca cobrir o robô nem nada da tela; sai do palco, apaga; com movimento reduzido ou no toque, não acende. Decorativa: não é link nem controle. Enquanto a cena desce, um indicador de carregamento; sem a cena (rede, Spline fora do ar) o robô some e o palco fica preto. O que vem a seguir neste parágrafo descreve o palco de 2026-09-21/22.
**Exibe.** A saudação pela hora do Espaço de Trabalho (Boa noite 0–4 h e 18 h+, Bom dia 5–11 h, Boa tarde 12–17 h), com o primeiro nome do Membro no acento; e o campo "Pergunte ao seu assistente…", com o envio `aria-disabled` ("Escreva a pergunta primeiro.") enquanto vazio. Mais nada: desde 2026-09-21 a tela não tinha link nenhum — até 2026-09-24, quando o resumo abaixo do palco os trouxe de volta ("Exibe", acima). Acima do texto, a **marca em 3D** (`design/marca-3d.tsx`, `aria-hidden`): o monograma do manual como peça com espessura, flutuando devagar e virando para o cursor onde quer que ele esteja na capa, com um brilho correndo pela face e uma sombra no chão. Ao fundo, decoração sem leitura: o campo vivo (`aria-hidden`, sem foco e sem clique) cobrindo a capa inteira — desde 2026-09-22 um tecido de ondas de traços, linhas finas que ondulam juntas com trechos de luz correndo por elas; até então, a grade de pontos —, com o cursor abrindo e acendendo o tecido por onde passa (sem luz por cima dele), mais os orbes e as estrelas da atmosfera — o campo é só o fundo; o monograma de pontos que ele desenhou por algumas horas em 2026-09-21 saiu a pedido do usuário. Do armazém, só o nome do Membro e a hora do Espaço de Trabalho chegam à tela. A capa toma a tela inteira, sem card: sem cantos, borda ou sombra, e sem respiro do corpo (2026-09-21).

**Estados.** Os do assistente, ditos em palavras sob o campo (`role=status`): respondendo ("Respondendo…", com a boca mexendo) · e os do microfone — desligado (a caixa abre assim: só o campo, nada é pedido) · pedindo · ouvindo ("Pode falar — estou ouvindo.", com o medidor de barras) · escutando ("Ouvindo você…") · e a **conversa simulada** (fim de 2026-09-23: "quando o microfone não puder ser conectado quero que simule a fala e faça uma conversa entre o robô e a fala simulada, e quando eu pressionar novamente a conversa encerra"): QUALQUER falha do microfone — bloqueado no navegador, pedido fechado sem resposta, **permitido no navegador mas bloqueado pelo sistema**, em uso por outro programa, nenhum microfone, página sem conexão segura, navegador sem microfone, microfone que caiu no meio, erro — deixa de ser um aviso longo e vira conversa: o estado diz o motivo em poucas palavras ("Nenhum microfone encontrado — simulando a sua fala.") e o ponto da conversa — a fala simulada entre aspas, "Respondendo…" ou "Toque de novo para encerrar a conversa." — o leitor de tela ouve o motivo UMA vez, quando a conversa começa (o ponto da conversa fica só à vista; com o balão, ele anuncia pergunta e resposta). O caminho para resolver o microfone (com o passo a passo de cada sistema) fica na dica do botão e no leitor de tela; no Windows, a caixa mostra o atalho para as configurações. As retentativas automáticas de antes (o robô "voltava a ouvir sozinho") saíram: para tentar o microfone de verdade, encerra-se a conversa e toca-se de novo. Se o microfone padrão não abre, o assistente tenta os outros aparelhos antes de desistir. (Até 2026-09-23, o envio da pergunta era o único controle que desligava — e dizia por quê.)

**Ações e regras.** **Desde 2026-09-24 a CAIXA DO ASSISTENTE é FIXA no palco** ("quero que a opção de chat seja fixa na tela, ao invés de depender da interação na logo do peito"): sempre à vista, sem X e sem Esc, e sem roubar o foco ao chegar na tela; a logo do peito voltou a ser só decoração — acende no hover, não é botão. Histórico: **no fim de 2026-09-23, a logo do peito abria e fechava a CAIXA DO ASSISTENTE** (primeiro como assistente de voz — "quando pressionar o logo em destaque no peito, abra a opção de pesquisa com voz… apenas habilite o microfone e reaja à fala, não armazene o áudio em lugar algum" —, e horas depois como caixa: "para o user digitar o que ele quer saber e o robô responde… ao invés do mic já abrir assim que apertar no logo"). Naquele dia a logo era um botão (`aria-pressed`, acesa com a caixa aberta) e o cursor nascia no campo; hoje a caixa está sempre lá e o microfone continua sem abrir sozinho. Duas formas de perguntar: **digitar** e Enter (ou o envio, `aria-disabled` "Escreva a pergunta primeiro." enquanto vazio) — o robô responde com o que o app JÁ SABE (`respostas-do-robo.ts` reconhece a intenção por palavras, sem acento: tarefas, notificações, negócios, contatos, conversas, quem é você, saudação; o panorama do Membro é lido do armazém na hora, `panorama-do-robo.ts`; o que não reconhece, ele diz que não sabe e diz o que sabe), com o som dele "dizendo" a resposta (uma sílaba por palavra, até 40, ~7 s), e o campo limpa; o texto é lido no navegador só para reconhecer a pergunta e nada sai dele (P30). Uma pergunta nova no meio da resposta corta a anterior (uma voz só). Ou **o botão do microfone** (`aria-pressed`; nunca desligado — sem microfone, tocar começa a conversa simulada e, com ela em curso, "Encerrar a conversa simulada"), que abre o microfone: aí o robô **só reage**: percebe pelo NÍVEL do som que alguém começou e parou de falar e responde com um **som de robô sintetizado** — mais longo quanto mais ouviu — mexendo a boca com ele. **Nada é gravado, transcrito, enviado ou guardado**; o microfone não chega aos alto-falantes; enquanto responde o robô não se ouve. **Silenciar** (fim de 2026-09-23: "as respostas do robô se tornem texto e deve aparecer ao lado da cabeça dele em um balão de chat… salvas, permitindo o user rolar e ver todas elas da sessão atual"): sem som — e sem contexto de áudio —, a resposta aparece letra a letra no balão, com a boca mexendo no mesmo ritmo; **Legenda** ("a voz dele sair e a resposta ficar salva"): a voz sai e o texto aparece em sincronia com o som. Silenciado, Legenda fica pressionada e desligada, com o motivo ("Silenciado, as respostas já saem em texto."). As respostas ficam nesta aba (`sessionStorage`, até 50 — fechou a aba, foram) e o modo vale entre recargas (`localStorage`). **A conversa simulada**, quando o microfone não pode ser usado: uma "pessoa" simulada, com OUTRA voz (mais grave e macia, com vibrato, sem o anel metálico do robô), faz as perguntas de um roteiro — quem é você, tarefas vencidas, notificações, funil de vendas, contatos recentes, conversas abertas, e de volta ao começo —; as ondas do botão reagem à fala dela; o robô responde de verdade (o panorama do Membro), com a voz, a boca e, silenciado ou com legenda, o balão ("Fala simulada: …"); ~1,4 s depois, a próxima pergunta. Tocar de novo no microfone (qualquer dos dois) encerra na hora — a fala simulada e a resposta em curso param e nada mais acontece; esconder a aba e fechar a caixa também encerram; uma pergunta digitada no meio cala a fala simulada, e ela volta depois da resposta. Nada disso usa microfone. **O botão de voz do palco** liga o mesmo microfone SEM precisar da caixa ("quando ativo… reaja à captura sonora com ondas em torno do ícone e então o robô responde"): pressionado, pede o microfone, mostra as ondas e o robô responde ao fim da fala — pela voz e, silenciado ou com legenda, no balão (que aparece também com a caixa fechada enquanto o microfone está ligado ou o robô responde); pressionado de novo, desliga. O botão do microfone da caixa é o mesmo interruptor (um só estado). Desligar o microfone: o botão dele de novo. A caixa não fecha mais (desde 2026-09-24: sem X, sem Esc, sem a logo); sair da tela desliga o microfone e o indicador do navegador apaga; esconder a aba desliga o microfone e encerra a conversa simulada. Não há reconhecimento de fala nem busca de verdade neste modelo. Até então, perguntar era a única ação da tela: cria uma Sessão de Chat com a pergunta dentro (B83) e navega a ela — o protótipo não executa Modelo nenhum, a resposta nasceria de uma Execução. Enquanto a navegação está a caminho, o envio gira. Mais nada daqui: Status, Aprovações e o resto vivem nas telas de destino, alcançadas pelo menu lateral — e, desde 2026-09-24, pelos atalhos e pelas linhas do resumo, abaixo do palco.

**Cardinalidade.** No palco: a caixa do assistente (campo, microfone, envio, Silenciar, Legenda), o botão de voz, o alternar do balão e o atalho "Seu resumo" — a logo do peito é decoração desde 2026-09-24 (foi UM botão no fim de 2026-09-23; até então, só o campo da pergunta). No resumo (2026-09-24): cinco atalhos, cada linha listada é um link, quatro períodos e quatro métricas.

**Estado vazio.** No palco não se aplica. No resumo (2026-09-24), cada bloco tem o seu — "Nenhuma Tarefa aberta com você.", "Nenhum Lead esperando por você.", "Nenhuma Mensagem nova." —, os atalhos com zero ficam recolhidos (`data-atenuado`) e dizem o zero em palavras ("nada vencido", "nada nos próximos 7 dias"), e uma métrica zerada mostra 0 e "igual vs. antes".

**Permissões.** No palco, nenhuma (desde o fim de 2026-09-23 nenhuma Sessão de Chat nasce daqui). No resumo (2026-09-24), tudo é DO MEMBRO LOGADO: Tarefas atribuídas a ele (`tarefasAbertasDoMembro`, a mesma da barra global; as concluídas das estatísticas passam por `memberSeesTask` — B103), Contatos de que é Proprietário, Conversas de que é Atribuído (ser Atribuído exige `ver`), Negócios de que é Proprietário e Registros de Atividade de que é Ator; nada do Espaço de Trabalho inteiro, nenhuma contagem do que ele não vê.

**O que saiu em 2026-09-21, e para onde foi.** No refazer do fim do dia, o link **Explorar** do rodapé — era a porta para `/estrutura` (Visão geral), que hoje se alcança pelo menu lateral — e toda a cenografia do palco anterior: a esfera de pontos da direita, o anel tracejado em volta e os trilhos de luz, trocados pelo campo vivo que cobre a capa. Ainda no mesmo dia, o monograma que o campo desenhava com os próprios pontos saiu — "não deve ser nesse efeito pontilhado" — e a marca voltou como a peça 3D flutuante acima da saudação. Antes dele, no mesmo dia: do topo, o HUD (Espaço de Trabalho à esquerda; data e hora no fuso da Localidade à direita) e o fio de luz sob ele — "remova isso do topo". Do centro, a marca de apresentação e a marca-d'água atrás do globo; o globo deixou de ser clicável (era a porta para `/ia/chat`) e virou fundo — quem fala com o Assistente é o campo. Do rodapé, as quatro **portas** com contagem, cada uma de volta para onde a leitura já morava: **Caixa de Entrada**, **Minhas Tarefas**, **Negócios** e **Painéis** são itens do menu lateral e das suas telas; as duas pendências continuam com número à vista na barra global (as Conversas atribuídas e não resolvidas em T51, pelo sino; as Tarefas vencidas em Minhas Tarefas). Os Negócios `aberto` de que sou Proprietário e os Painéis fora da lixeira não têm mais contagem em lugar nenhum — cada um se lê na sua tela. O atalho `?recorte=vencidas` de T12a continua válido, mas ficou sem chamador quando a porta saiu.

**O que saiu em 2026-09-23, e por quê.** A marca 3D, o campo vivo (as ondas de traços), os orbes e as estrelas — o usuário pediu o palco preto, sem a logo e sem o efeito animado, com o robô. `design/marca-3d.tsx` e `design/campo-vivo.tsx` foram apagados junto com o CSS e os tokens que só eles usavam; estão no histórico do git (antes de `0bb0e13`).

**O que voltou em 2026-09-24, e como.** A pedido ("nesta tela de início, quando o user rolar para baixo ele deve conseguir fazer o scroll normal e o robô deve ir desaparecendo conforme o scroll, fazendo o efeito reverso de entrada; conforme for rolando, a tela muda e vira uma tela de informações e acesso rápido: minhas tarefas, tasks atuais se tiver, quantas estão em atraso e afins, leads a serem atendidos, se há novas mensagens e um menu de estatística daquele user na semana, mês e afins"), a tela voltou a ROLAR e a RESPONDER "o que espera por mim" — o contrário do que 2026-09-21 tinha decidido ("um palco sem rolagem", "a tela não tem link nenhum", "nada de listas", as quatro portas de volta ao menu). A diferença: nada disso volta AO PALCO. O palco continua a apresentação, inteiro e sem link; o resumo vive ABAIXO dele, e só aparece rolando, enquanto o robô sai ao contrário da entrada. As derivações são as das telas de destino e da barra global ("os números nunca discordam"), e o `?recorte=` de T12a voltou a ter chamador. Nada é entidade nova: o resumo é uma visão derivada por Membro, como a Notificação (PENDENCIAS-FRONTEND A8); "Leads a atender" e as estatísticas do Membro estão registrados em DECISOES-E-PENDENCIAS C38.

## T03 · Minha conta — `/minha-conta` ⟨01 (7.1), 16 (7.5)⟩

**Propósito.** O único lugar em que o Membro governa o que é dele e de mais ninguém: a sua Disponibilidade e a sua Memória do Usuário.

**Exibe.** [E] Membro: Nome de exibição no Espaço de Trabalho [A], Usuário [A], Papel [A], Equipes [A], Momento de ingresso [A], Disponibilidade de atendimento [VO] (valor, momento, origem). [E] Memória do Usuário: habilitada [A]; [E] Item de Memória: conteúdo [A], origem [A] (Sessão e Execução, ou `Membro`), momento [A], estado [A] (`ativo`/`desativado`).

**Estados.** Disponibilidade `disponível` / `ausente` / `indisponível` (Membro `suspenso` deriva `indisponível`, controle somente leitura). Item de Memória `ativo` / `desativado`.

**Ações e regras.** Editar Nome de exibição; alterar Disponibilidade; habilitar/desabilitar a Memória do Usuário; desativar ou remover Item. Regras visíveis: a Memória do Usuário **nunca retém dados de terceiros** — o painel explica que pedidos como "lembre que o cliente X prefere e-mail" são recusados e redirecionados a Comentário ou Valor de Campo (DO-CHT-11); nunca é vista por outros Membros, Administradores ou Agentes fora de Execução em nome do Membro (INV-CHT-09); não é sucedida (B86).

**Cardinalidade.** Disponibilidade: seleção única. Itens: lista com remoção individual.

**Estado vazio.** "Nenhum fato memorizado ainda. A IA registra aqui preferências suas quando você pede." / Memória desabilitada: "Memória desativada. Nada é gravado e nada entra nas suas conversas."

**Permissões.** Só o próprio Membro. Não existe rota de terceiro.

---

## T04 · Busca global — `/buscar?q=` ⟨transversal⟩

**Propósito.** Encontrar registro por nome ou conteúdo indexável, respeitando permissões.

**Exibe.** Resultados agrupados por entidade: Tarefa, Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Espaço, Pasta, Subpasta, Lista, Agente, Habilidade, Automação, Coleção, Painel, Funil. Cada resultado: Nome de exibição, tipo, caminho ou contexto, selo de estado quando não `ativo`.

**Estados.** Arquivados aparecem só com o filtro "Incluir arquivados"; `na lixeira` nunca aparece; `mesclado` nunca aparece (resolve ao sobrevivente — B14).

**Ações e regras.** Filtrar por tipo e por estado; abrir. Regra visível: "A busca respeita as suas permissões" — declaração fixa, sem indicador de quantidade oculta (B103 por analogia).

**Cardinalidade.** Filtro de tipos: múltiplo.

**Estado vazio.** "Nada encontrado para *termo*. A busca respeita as suas permissões."

**Permissões.** Cada resultado exige `ver` sobre o próprio registro. Sessão de Chat de terceiro nunca aparece (DO-CHT-09). Conteúdo de Fragmento, Mensagem e Memória nunca é exposto na busca.

---

# II. ESTRUTURA DE TRABALHO

## T05 · Espaços — `/estrutura` ⟨02⟩

**Propósito.** Ver e governar o primeiro nível estrutural.

**Exibe.** [E] Espaço: Nome [A], Descrição [A], Ícone [A], Cor [A], Ordem [A], Privado [A], Estado próprio [A], Estado efetivo [D], Criador [A], Momento de criação [A]. Contagens derivadas de Pastas e Listas visíveis ao consultante.

**Estados.** `ativo`, `arquivado` (com alternador), `na lixeira` (só na Lixeira).

**Ações e regras.** Criar Espaço (com ou sem Template; o Template de Espaço padrão é aplicado quando nenhum é escolhido — DO-ESP-09); reordenar (exige `administrar` — B46); arquivar; enviar à lixeira. Regras visíveis: nome único entre Espaços `ativo`/`arquivado` (RN-ESP-23); Convidados e Agentes não criam Espaços (RN-ESP-18).

**Cardinalidade.** Template na criação: seleção única opcional (0..1).

**Estado vazio.** "Nenhum Espaço ainda. Um Espaço delimita uma área de trabalho com status, campos e permissões próprios." + [Novo Espaço]

**Permissões.** Criar: Papel Proprietário/Administrador ou `criar` sobre o Espaço de Trabalho. Espaço privado só aparece a quem tem concessão direta ou compartilhamento (B38a).

---

## T06 · Espaço — `/estrutura/espacos/[espaco]` ⟨02⟩

**Propósito.** Operar dentro de uma área: ver Pastas e Listas diretas e alcançar a configuração.

**Exibe.** Cabeçalho (T-padrão §1) sem Proprietário — o Espaço não tem (B45). Grade de [E] Pasta (Nome, Ícone, Cor, Nível [D], contagem de Listas) e [E] Lista direta (Nome, Cor, Período planejado [VO], Quantidade de Tarefas [D]). Abas: **Conteúdo** · **Painéis** (Painéis de contexto ancorados neste Espaço — B102) · **Acesso** · **Atividade**.

**Estados.** Estado próprio e Estado efetivo (coincidem no Espaço — o Espaço de Trabalho não usa `arquivado`/`na lixeira`). Selo `arquivado` torna a tela somente leitura, com "Restaurar".

**Ações e regras.** Criar Pasta; criar Lista direta; renomear; reordenar filhos; tornar privado; arquivar; enviar à lixeira; instanciar Template; abrir configurações. Regras visíveis: o Espaço contém **apenas** Pastas e Listas — nunca Tarefas (RN-ESP-02); tornar privado exige Membro `ativo` sem base Convidado e concede `administrar` a quem privatiza, no mesmo ato (RN-ESP-16); em estado efetivo não `ativo`, só leitura, alteração de permissões, restauração e movimentação de descendentes para fora (RN-ESP-11).

**Cardinalidade.** Nenhum seletor de Proprietário, Status ou Prioridade — não existem para contêiner (B45).

**Estado vazio.** "Este Espaço está vazio. Crie uma Pasta para agrupar trabalho ou uma Lista para começar." + [Nova Pasta] [Nova Lista]

**Permissões.** `ver` para abrir; `criar` para Pasta/Lista; `administrar` para arquivar, privar e reordenar; `excluir` para lixeira (B46).

---

## T07 · Configurações do Espaço — `/estrutura/espacos/[espaco]/configuracoes` ⟨02⟩

**Propósito.** Definir a configuração que as Tarefas de toda a subárvore consomem, e tornar a herança legível.

**Exibe.** Abas por aspecto:
- **Conjunto de Status** — [E] Conjunto de Status → [E] Definição de Status: nome, cor, categoria [A] (`não iniciado`, `em andamento`, `concluído`, `fechado`), ordem. Marca do **status inicial padrão** [D] (primeira `não iniciado` na ordem).
- **Campos** — [E] Definição de Campo Personalizado (entidade-alvo Tarefa): nome, Tipo de Campo, opções, obrigatoriedade, ponto de definição [D].
- **Tipos de Tarefa** — [E] Tipo de Tarefa, com o tipo padrão da plataforma não removível.
- **Funcionalidades** — [VO] Funcionalidades habilitadas, indicador por funcionalidade.
- **Visualizações padrão** — [VO] tipos disponíveis e inicial.
- **Bloqueio por aspecto** — [VO] indicador de bloqueio para descendentes, por aspecto.
- **Acesso** — concessões diretas, compartilhamentos, indicador Privado.

**Estados.** Nenhum estado próprio nesta tela além do estado do Espaço; Definição de Campo removida vai para `na lixeira` com os Valores retidos e invisíveis (RN-ESP-07).

**Ações e regras.** Editar Conjunto de Status; remover Definição de Status **com Mapeamento obrigatório** (D01) quando há Tarefas em uso (RN-ESP-06); criar/remover Definição de Campo; criar Tipo de Tarefa; habilitar/desabilitar Funcionalidade; bloquear aspecto. Regras visíveis: o Conjunto exige ao menos uma Definição `não iniciado` e uma `fechado` (RN-ESP-05); nome de Definição de Campo é único em todo o caminho efetivo, nos dois sentidos (B44); **bloquear é rejeitado enquanto houver sobrescritas descendentes** — a tela lista cada uma com um caminho para resolver (RN-ESP-09); desabilitar Funcionalidade não apaga dados (RN-ESP-10).

**Cardinalidade.** Categoria da Definição de Status: seleção única obrigatória. Tipo de Campo: única obrigatória. Funcionalidades: múltiplas.

**Estado vazio.** Campos: "Nenhuma Definição de Campo neste Espaço. As Tarefas usarão apenas os atributos nativos." Tipos: nunca vazio (tipo padrão).

**Permissões.** `administrar` sobre o Espaço.

---

## T08 · Pasta / Subpasta — `/estrutura/pastas/[pasta]` ⟨03, 04⟩

**Propósito.** Mesma tela para os dois níveis de agrupamento. A diferença é o que ela oferece.

**Exibe.** Cabeçalho com caminho efetivo e Nível [D] (1 = Pasta, 2 = Subpasta). Grade de [E] Subpasta (só quando Nível 1) e [E] Lista. Abas: **Conteúdo** · **Painéis** · **Acesso** · **Atividade**.
[A] exibidos: Nome, Descrição (único texto livre — a Pasta não recebe Valores de Campo, DO-PAS-13), Ícone, Cor, Ordem, Contêiner pai, Privada, Estado próprio, Estado efetivo [D], Criador, Template de origem [A].

**Estados.** `ativo`, `arquivado`, `na lixeira`; Estado efetivo derivado do Espaço e da Pasta pai (B36). O cabeçalho nomeia o ancestral que restringe.

**Ações e regras.** Criar Subpasta (**ausente** na Subpasta — A3.4, RN-SUB-02); criar Lista; mover; promover (Subpasta → Espaço) / rebaixar (Pasta sem Subpastas → dentro de Pasta); privar; arquivar; excluir. Regras visíveis: mover Pasta com Subpastas para dentro de Pasta é rejeitado, sem achatamento (RN-SUB-11); a Pasta não contém Tarefas (RN-PAS-02); movimentação atômica com Mapeamento de status, Valores de Campo arquivados e Tipos remapeados (RN-PAS-14).

**Cardinalidade.** Contêiner pai: seleção única obrigatória, restrita a destinos válidos.

**Estado vazio.** Pasta: "Esta Pasta está vazia. Crie uma Subpasta ou uma Lista." Subpasta: "Esta Subpasta está vazia. Crie uma Lista." (sem oferta de Subpasta).

**Permissões.** `ver`; `criar` para filhos; `administrar` para privar, arquivar, mover, reordenar; `excluir` para lixeira (B46).

---

## T09 · Configurações da Pasta / Subpasta — `/estrutura/pastas/[pasta]/configuracoes` ⟨03, 04⟩

**Propósito.** Ver e alterar o modo de herança por aspecto neste nível.

**Exibe.** Por aspecto: modo [VO] (`herdado` / `sobrescrito` / `bloqueado`), ponto de definição [D] nomeado, valor efetivo. Componentes quando `sobrescrito`: Conjunto de Status sobrescrito, Definições de Campo próprias, Tipos de Tarefa próprios, Visualizações do contêiner. Aba Acesso com as quatro origens de permissão.

**Estados.** Reflete o estado da Pasta.

**Ações e regras.** Sobrescrever / voltar a herdar (com Mapeamento — RN-PAS-06); criar Definição de Campo própria; bloquear aspecto para descendentes. Regras visíveis: aspecto bloqueado por ancestral não é sobrescrevível, com o ancestral nomeado (RN-SUB-05); acumulam Definições de Campo, Tipos e Automações; substituem Conjunto de Status, Funcionalidades e Visualizações padrão (RN-SUB-06).

**Cardinalidade.** Modo por aspecto: seleção única por aspecto.

**Estado vazio.** "Tudo herdado de *Comercial*. Sobrescreva um aspecto para definir o próprio."

**Permissões.** `administrar`.

---

## T10 · Lista — `/estrutura/listas/[lista]` ⟨05, 06⟩

**Propósito.** O contêiner operacional. Quatro Visualizações da mesma coleção de Tarefas.

**Exibe.** Cabeçalho com **Caminho efetivo** completo, Nome, Cor, Período planejado [VO], selo de estado. Abas: **Tarefas** · **Painéis** · **Acesso** · **Atividade**. Seletor de Visualização: **Lista** · **Quadro** · **Calendário** · **Tabela**.

| Visualização | O que mostra | Regra |
| --- | --- | --- |
| Lista | Tarefas agrupadas por Status (Definição), com Subtarefas recolhíveis e Progresso de Subtarefas [D] no pai | documento 06, 6.1; DO-STA-06 |
| Quadro | Colunas = Definições do **Conjunto de Status efetivo** [D], na ordem; arrastar altera o Status. **Desde o fim de 2026-09-23, o quadro PADRÃO** ("tudo que for quadro, a visualização deve ser igual à da segunda imagem" — o quadro de Negócios): cada coluna com a contagem num selo, o Status numa pílula da cor dele, o "+", e o subtítulo (a categoria, e numa Lista financeira a soma em R$); vazia, um tracejado com "+". Cada Tarefa é um **cartão de Tarefa** com a anatomia do card de Negócio — o ícone do Tipo num círculo (vermelho vencida, âmbar bloqueada), o título e o identificador · Tipo, as pílulas (prioridade, Tags, Vencida/Bloqueada), o destaque **Prazo** e o rodapé **Responsável | Subtarefas/Checklist**; numa Conta, a contraparte no subtítulo, o destaque **Valor** e o rodapé **Vencimento | Responsável** | RN-LIS-05, A4.3 |
| Calendário | Tarefas posicionadas por Data (dia civil sem fuso; instante no fuso da Localidade) | documento 06, 6.2 |
| Tabela | Colunas configuráveis: atributos nativos, derivados e Valores de Campo efetivos | documento 05, 7.3 |

[A] por Tarefa: Título, Identificador legível [D], Status atual, Categoria [D], Tipo de Tarefa, Prioridade, Datas, Vencida [D], Bloqueada [D], Responsáveis (Membro ou Agente), Tags, Progresso de Checklists [D], Progresso de Subtarefas [D], Estimativa, Tempo registrado [D].

**Estados.** Estado próprio e efetivo da Lista; estado efetivo de cada Tarefa. Lista `arquivado`: não recebe Tarefas novas nem movidas; Automações com escopo nela ficam inoperantes (documento 05, 11).

**Ações e regras.** Criar Tarefa rápida (nasce no **status inicial padrão** — Glossário) **escolhendo o Tipo** (2026-09-22): a barra de criação e o compositor de cada grupo trazem o `SeletorDeTipoDeTarefa` à esquerda do título, já no Tipo padrão da Lista (o do nível mais próximo — numa Lista do Financeiro, "Conta"), e a escolha vale para a Tarefa que nasce ali; numa Lista que enxerga **um Tipo só** o seletor não aparece. O aviso da criação nomeia o Tipo que nasceu, não a lente da tela. Antes disso o Tipo era imposto e só se trocava depois, na ficha; mudar Visualização; filtrar; agrupar; arrastar entre colunas; mover Tarefa para outra Lista (com Mapeamento — D01); arquivar Tarefa; abrir configurações. Regras visíveis: a Lista contém **apenas** Tarefas (RN-LIS-02); "Lista vazia" e "Lista só com Tarefas concluídas" são condições derivadas e **não** arquivam a Lista (RN-LIS-04, documento 05, 11); o Limite de Tarefas por Lista é Limite imposto verificado no ato (RN-LIS-18).

**Modelo conversacional (C35, 2026-09-17).** A Lista tem um **Modelo de Tarefa** [A] nativo — `operacional` (a Tarefa de gestão, a de sempre) ou `conversacional` (a Tarefa comercial: nasce de um Contato e traz a conversa dele por Vínculos) — escolhido em D16 e trocado só em T11 enquanto ela está vazia. Numa Lista conversacional a tela muda de lente: o cabeçalho leva o balão e conta "n Tarefas · m Contatos" (pessoas, não Vínculos); **nunca há compositor por título** — a barra traz [Nova Tarefa], que abre D17 ("Escolha o Contato e o Canal — a Tarefa nasce com a conversa dele"), o "+" de um grupo ou coluna abre o mesmo diálogo já no Status dele, `?nova-tarefa=1` (o "+" da árvore) também, e "De modelo" fica desligado com a frase do domínio ("Nesta Lista toda Tarefa nasce de um Contato."); **Formulário público não cria Tarefa aqui** (2026-09-18): `createForm`, `updateForm` e `submitForm` recusam com "Nesta Lista toda Tarefa nasce de um Contato: um Formulário público não cria Tarefa aqui.", o editor de Formulários desliga [Novo Formulário], o ativar/pausar e Editar com essa frase, um Formulário que sobrou fica "Desatualizado" (só arquivar) e a página `/f` o mostra como indisponível; a Tarefa criada abre no popup no lugar do diálogo. Só **quatro Visualizações** — Lista · Quadro · Calendário · Tabela: Linha do tempo e Carga são da gestão de esforço e saem. A **Tabela** ganha as colunas **Contato** (rosto + nome) e **Canal** (pílula do Tipo de Canal), lidas dos Vínculos — a Tarefa não guarda nenhum dos dois. O **Quadro** é o `QuadroNegocios` sem subtotal em dinheiro, no quadro padrão (a mesma coluna e a mesma anatomia de cartão do quadro de Negócios, desde o fim de 2026-09-23): a Tarefa que espelha um Negócio vira o card de Negócio; a que nasce de um Contato vira o **cartão conversacional** — o rosto e a empresa do Contato; as pílulas da Tarefa (com o ícone do Tipo), do Canal e da temperatura; o destaque **Última mensagem** (e há quanto tempo); o rodapé **Responsável | Prazo** —; a que não tem nem um nem outro, o cartão de Tarefa. Precedência das lentes na página: **financeira > espelho comercial > conversacional** — o espelho de "Meus negócios" é o caso particular (conversacional **com** Negócio obrigatório e a barra "Iniciar conversa"); Pós-venda (`Comercial › Pós-venda`, seed) é a conversacional pura. Na árvore lateral a Lista conversacional leva o ícone de balão, e Espaço e Pasta a marcam com a pílula "Conversacional".

**Cardinalidade.** Responsáveis: múltiplo. Status: único. Tags: múltiplo. Tipo: único. Modelo de Tarefa: único, obrigatório.

**Estado vazio.** "Nenhuma Tarefa nesta Lista ainda." + [Nova Tarefa]. Quadro: cada coluna vazia diz "Nenhuma Tarefa em *Em revisão*" e **permanece**.

**Permissões.** `ver` para abrir; `criar` para Tarefa; `editar` para alterar Tarefa; Lista privada só por concessão ou compartilhamento (RN-LIS-12).

---

## T11 · Configurações da Lista — `/estrutura/listas/[lista]/configuracoes` ⟨05⟩
**Canais de atendimento (C36, 2026-09-22).** Na Lista conversacional, abaixo do Modelo de Tarefa, o bloco `CanaisDeAtendimento` grava na hora (`definirCanaisDaLista`): marcar e desmarcar contas, ligar e desligar tipos, e "Adicionar {tipo}" (D33), que conecta a conta e já a marca. A última conta não sai ("A Lista precisa de ao menos um canal de atendimento."); sem canais (a Lista que virou conversacional depois de nascer), um aviso `role=status` diz que nenhuma Tarefa nasce nela até configurá-los. Quem não administra a Lista vê tudo desligado com o motivo.

**Propósito.** Ver o que a Lista consome do caminho e o que ela define.

**Exibe.** **Conjunto de Status efetivo** [D] com o ponto de definição; **Definições de Campo efetivas** [D] (união do caminho + próprias, com origem por item); **Tipos de Tarefa efetivos** [D]; **Funcionalidades efetivas** [D]; Período planejado [VO]; Visualizações da Lista [E]; Automações aplicáveis (acumuladas do caminho, com escopo de cada uma); concessões e indicador Privada.

**Estados.** Reflete o estado da Lista.

**Ações e regras.** Sobrescrever Conjunto de Status (com Mapeamento — RN-LIS-06); criar Definição de Campo própria; habilitar/desabilitar Funcionalidade; definir Período planejado; salvar Visualização; marcar como privada. Regras visíveis: a Lista **nunca** marca `bloqueado` (não tem descendente que defina configuração — RN-LIS-07); a Lista não tem Status, Prioridade, Proprietário nem Responsável (RN-LIS-16); desabilitar Funcionalidade preserva dados existentes (RN-LIS-21); remover Tipo de Tarefa em uso exige remapeamento (RN-LIS-20).

**Modelo de Tarefa (C35, 2026-09-17).** Uma `CaixaDeConfiguracoes` "Modelo de Tarefa" com uma linha — Toggle **"Tarefas conversacionais"** ("Cada Tarefa nasce de um Contato e traz a conversa dele; a Lista tem acesso ao CRM. Desligado: Tarefa operacional, a padrão.") — chama `alterarModeloDaLista`. A ajuda diz que o modelo **é da Lista e não herda**: uma Pasta pode ter Listas dos dois modelos (não é aspecto de B25, não aparece na tabela de modos). O Toggle fica desligado, com o motivo no lugar da dica, quando a Lista já tem Tarefa — **contando as da lixeira**, porque restaurá-las traria o modelo errado de volta: "O modelo de Tarefa não muda numa Lista que já tem Tarefas."; e com a recusa de `administrar` quando é ela que vale. Numa Lista operacional com Formulário ativo o Toggle também fica desligado: "Arquive os Formulários antes: nesta Lista a Tarefa nasce de um Contato." (2026-09-18).

**Cardinalidade.** Período planejado: duas datas opcionais. Funcionalidades: múltiplas. Modelo de Tarefa: único.

**Estado vazio.** Visualizações: "Nenhuma Visualização salva. A Lista usa a Visualização padrão herdada de *Comercial*." · Automações aplicáveis: "Nenhuma Automação alcança esta Lista."

**Permissões.** `administrar` para configurar e privar; `editar` para Visualizações do contêiner.

---

## T12 · Tarefa — `/estrutura/tarefas/[tarefa]` ⟨06, 07, 08⟩

**Propósito.** O documento central do domínio. Painel lateral por padrão, com alternância para página cheia.

**Exibe.**

*Cabeçalho:* Caminho efetivo, Título, Identificador legível [D], selo de estado (com o ancestral que o causa, quando efetivo), Criador com delegante, Momento de criação. **Sem Proprietário** (RN-TAR-08).

*Barra de atributos:*
| Atributo | Controle | Regra |
| --- | --- | --- |
| Status atual | Seletor único agrupado por **categoria** (`não iniciado`, `em andamento`, `concluído`, `fechado`) | A4.2, A4.3 |
| Responsáveis | Seletor **múltiplo** de Membro `ativo` **ou Agente**, filtrado por `ver` na Tarefa | B7, RN-TAR-06 |
| Prioridade | Seletor único fixo: urgente, alta, normal, baixa, sem prioridade | Glossário; não personalizável (C17) |
| Datas | Data de início e Data de vencimento, cada uma com forma **dia civil** ou **instante** | documento 06, 6.2 |
| Tipo de Tarefa | Seletor único entre os Tipos efetivos — na ficha (trocar) e, desde 2026-09-22, **na criação** (escolher) | RN-LIS-20 |
| Tags | Múltiplo, do catálogo do Espaço de Trabalho | B5 |
| Estimativa | Duração, só com a Funcionalidade habilitada | documento 06, 6.1 |
| Observadores | Múltiplo de Membro com `ver` | Glossário |

*Derivados exibidos:* Categoria de status, Vencida, Bloqueada, Momento de conclusão, Tempo registrado, Tempo registrado agregado, Progresso de Subtarefas, Progresso de Checklists, Nível (de Tarefa), Tarefa raiz, Momento da última alteração.

*Seções:*
- **Descrição** — atributo de conteúdo rico com menções e Anexos embutidos; **sem autor próprio**; editar gera Registro de Atividade (RN-TAR-09).
- **Valores de Campo** — um por Definição efetiva, com a origem nomeada; agrupador recolhido "Campos não aplicáveis neste caminho" para os `arquivado` (B37).
- **Subtarefas** — árvore até a Profundidade máxima; "Nova Subtarefa" desabilitada no nível máximo com o motivo (RN-STA-04).
- **Checklists** — [E] Checklist (nome, ordem, Progresso [D], Concluído [D]) → [E] Item (texto, ordem, Concluído, momento e Ator que concluiu, Responsável 0..1 **Membro**, Condição [D] `aberto`/`concluído`/`convertido`) → [E] Subitem (um nível). Ação "Converter em Subtarefa" (D13).
- **Dependências** — `bloqueia`, `é bloqueada por`, `aguarda`; sem ciclo, nunca com ancestral ou descendente (RN-TAR-16).
- **Vínculos** — Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Tarefa.
- **Anexos** — referências a Arquivo.
- **Registros de Tempo** — por Membro, com um "em andamento" por Membro no Espaço de Trabalho (INV-TAR-12). **Agente não registra tempo** (B42) — o esforço de IA aparece como Execução.
- **Comentários** — padrão §6.
- **Atividade** — padrão §4.
- **Recorrência** — Regra de Recorrência [VO] na ocorrência corrente, com modo de disparo e o que copiar.
- **Compartilhamento público** — [VO], só com a Funcionalidade habilitada, só criado por Membro, só `ver` (RN-TAR-21).

**Estados.** `ativo`, `arquivado`, `na lixeira`, com Estado efetivo derivado da Lista e da Tarefa pai. Status atual é **independente** do estado: uma Tarefa `arquivado` conserva o status que tinha (documento 06, 11).

**Ações e regras.** Alterar Status; atribuir; criar Subtarefa; promover/rebaixar/reparentar; converter Item; registrar tempo; comentar; vincular; criar Dependência; mover de Lista (D01); arquivar; excluir. **Ações de remoção dentro do agregado** (todas são edições da Tarefa, exigem `editar` e geram Registro de Atividade com a Tarefa como objeto — checklist.md 12.2 e 17): remover Checklist, Item ou Subitem; remover Responsável de Item; remover Dependência; remover Vínculo; remover Anexo (remove a referência, nunca o Arquivo — RN-TAR-12); excluir Registro de Tempo; remover Tag; remover Observador; revogar Compartilhamento público. Regras visíveis: atribuir a quem não tem `ver` é inválido, e atribuir **não concede** permissão (RN-TAR-06); Responsável que perde `ver` é liberado no mesmo ato, com evento (RN-TAR-06); concluir com Subtarefas ou Checklists abertos é permitido **salvo** Funcionalidade habilitada (RN-TAR-18, RN-CHK-09); "Bloqueada" não impede conclusão por padrão (RN-TAR-17); Item convertido é terminal e sai do progresso (B48); datas não se propagam entre pai e Subtarefa (RN-TAR-20).

**Ficha conversacional (C35, 2026-09-17).** Quando a Lista é conversacional e a Tarefa tem Contato (por Vínculo próprio ou, na Subtarefa, pelo da raiz; na Tarefa-espelho, pelo Contato principal do Negócio), `TarefaCompleta` passa a **três regiões**: a **ficha** (a de sempre), a **conversa** (o `ConversationThread` com o Contato, aberto no Canal da Tarefa e depois livre entre os Canais dele — dá para responder dali) e a **Atividade** (que nasce recolhida sob a conversa e só é coluna inteira na terceira largura). Abaixo de `@4xl` (refeito em 2026-09-18) conversa e Atividade empilham sob a ficha: o fio de Mensagens tem altura definida (`--conversa-empilhada-min` — dois balões, nunca menos), a ficha fica com o resto e só há duas rolagens (o fio e a ficha); o Rascunho do Agente nasce recolhido numa linha ("Rascunho de X · não enviado" + Ver, um só gatilho que alterna sem perder o foco) e a Atividade recolhida é o botão "Atividade N" no cabeçalho da Conversa; o compositor fica à vista a 1024×768, no popup e na página; de `@4xl` viram a segunda coluna; de `@6xl` (ou o popup em tela cheia) cada região é uma coluna. Na ficha entra a seção **CRM**, em `LinhaDeProp`: **Contato** (rosto, nome, o Identificador que o Canal da Tarefa resolve, Qualificação e Temperatura como pílulas; link à ficha), **Canal** (pílula do Tipo + nome; editável — `trocarCanalDaTarefa` troca a Conversa vinculada, e o fio segue o Canal novo; um Canal desconectado fica na lista com o motivo), **Conversa** (estado com ponto quando `aberta`, Atribuído, "Abrir na Caixa de Entrada"), **Empresa** (a principal do Contato) e **Negócio** (o vinculado com Funil › Etapa e [Trocar], ou "Vazio" editável — `vincularNegocioATarefa` só aceita Negócio **aberto do Contato**; `null` desvincula). O menu ganha **Abrir na Caixa de Entrada** (desligado "Esta Tarefa ainda não tem Conversa.") e **Criar Negócio a partir desta Tarefa** (diálogo: Funil obrigatório com a primeira Etapa dita na dica, Título — vazio, o da Tarefa —, Valor em reais; `criarNegocioDaTarefa` nasce com o Contato na 1ª Etapa e já vinculado; desligado com "Esta Tarefa já tem Negócio vinculado." ou "Esta Tarefa não tem Contato vinculado."). Tarefa conversacional **sem** Contato cai no layout de sempre com o aviso "Tarefa conversacional sem Contato: vincule um Contato ou mova para uma Lista operacional." A Tarefa **não guarda** Contato, Conversa nem Negócio em campo próprio: tudo é Vínculo (RN-TAR-15) e o Canal vem da Conversa (INV-CXE-04).

**Cardinalidade.** Ver tabela acima. Responsável de Item: **0..1 Membro**, nunca Agente (B48). Ficha conversacional: Contato 1; Conversa 0..1; Negócio 0..1.

**Estado vazio.** Por seção: "Nenhuma Subtarefa." / "Nenhum Checklist." / "Nenhuma Dependência." / "Nenhum Vínculo." / "Nenhum Anexo." / "Nenhum Comentário ainda." / "Nenhum tempo registrado." / "Nenhum campo personalizado se aplica a esta Lista." Conversa da ficha conversacional: "sem Conversa" na linha, e o fio vazio do Contato.

**Permissões.** `ver` para abrir; `comentar` para Comentário; `editar` para atributos, Checklists e Subtarefas; `criar` na Lista + `editar` no pai para Subtarefa (RN-STA-15); `administrar` na Lista para Compartilhamento público e Registro de Tempo por outro Membro.

---

## T12a · Minhas Tarefas — `/estrutura/tarefas` ⟨06⟩

**Propósito.** As Tarefas ativas em recortes, sem entidade nova: o que está atribuído a mim, o que venceu, o que tem hora hoje, o que vence nesta semana e tudo do Espaço de Trabalho. É o destino do item da barra global e da porta da Início (a porta saiu em 2026-09-21 e voltou em 2026-09-24 como atalho do resumo, abaixo do palco — Tarefas abertas, Vencidas e Para hoje chegam com `?recorte=`). **Desde 2026-09-24 há um sexto recorte, "Abertas"** (`?recorte=abertas`): as atribuídas a mim fora de categoria terminal — a MESMA conta da barra global e do atalho "Tarefas abertas" do Início, que "Atribuídas a mim" (concluídas inclusive) não dava.

**Exibe.** Abas com contador (2026-09-18): **Atribuídas a mim** · **Vencidas** · **Hoje** (Tarefas abertas atribuídas a mim com vencimento em instante cujo dia civil, no fuso do Espaço de Trabalho, é o de hoje — ordenadas pela hora) · **Esta semana** (abertas, não vencidas, vencendo até hoje + 7 dias, dia civil ou instante) · **Todas do Espaço de Trabalho**; a tabela Título · Lista · Status · Categoria · Prioridade · Vencimento · Estado. A aba inicial vem de `?recorte=minhas|vencidas|hoje|semana|todas` (valor inválido → Atribuídas a mim).

**Estado vazio.** Por recorte: "Nada atribuído a você." · "Nenhuma Tarefa sua está vencida." · "Nenhum horário marcado para hoje." · "Nada seu vence nos próximos 7 dias." · "Nenhuma Tarefa ativa."

**Permissões.** As mesmas derivações da barra global (`tarefasAbertasDoMembro`): os números nunca discordam.

---

# III. CRM

## T13 · Contatos — `/crm/contatos` ⟨10⟩

**Propósito.** Inventário de pessoas com quem a organização se relaciona.

**Exibe.** Tabela de [E] Contato: Nome de exibição [D], Cargo de exibição [D], Empresa principal [D], Qualificação [A], Origem [A], Proprietário [A], Modo de criação [A], Última interação [D], Tags [A], Identificador principal [D], Estado [A]. Painel lateral de **Suspeitas de Duplicidade** [VO derivado].

**Estados.** `ativo`, `arquivado` (com filtro), `na lixeira` (só na Lixeira), `mesclado` (nunca listado — resolve ao sobrevivente).

**Ações e regras.** Criar Contato; **importar em lote (D15)**; filtrar; abrir mesclagem (D03); marcar par como `distinto de`. Regras visíveis: a única exigência de conteúdo é Nome **ou** ao menos um Identificador (INV-CON-01); "Não identificado" é condição derivada, não estado (documento 10, 11); Suspeita de Duplicidade é calculada, nunca gravada (RN-CON-10).

**Cardinalidade.** Filtros múltiplos; Qualificação e Origem: seleção única no registro.

**Estado vazio.** Tabela: "Nenhum Contato ainda. Contatos também são criados automaticamente quando uma Mensagem chega por um Canal." + [Novo Contato] · Painel de Suspeitas: "Nenhuma suspeita no momento. Suspeitas são calculadas a cada consulta, nunca gravadas."

**Permissões.** Papel, concessão direta, compartilhamento; escopo `registro` ou `próprios` (B29) — "vendedor vê só os seus" filtra sem avisar.

---

## T14 · Ficha do Contato — `/crm/contatos/[contato]` ⟨10⟩

**Propósito.** Tudo o que se sabe e se pode fazer sobre uma pessoa.

**Exibe.**

*Cabeçalho:* Foto [A], Nome de exibição [D], Cargo de exibição [D], selo de estado, Proprietário [A], Criador com delegante, Modo de criação [A] (imutável).

*Atributos:* Nome, Sobrenome, Qualificação (0..1 Definição de Qualificação), Origem (0..1), Data de nascimento (dia civil), Idioma, Fuso horário, Descrição, Tags, Valores de Campo (Definições do Espaço de Trabalho com entidade-alvo Contato), Última interação [D], Estado anterior à exclusão [A] quando `na lixeira`.

*Seções:*
- **Identificadores** — [E] Identificador de Contato: Tipo (`telefone`, `e-mail`, `identidade de WhatsApp`, `usuário de Instagram`, `identificador de chat do site`), Valor canônico, Valor exibido, Canal de origem, Rótulo informado pelo Canal, Verificado, Principal (≤1 por Tipo). Ações: acrescentar, marcar principal, transferir (D11).
- **Consentimentos** — [VO] histórico monotônico; tabela do vigente por (Finalidade, Tipo de Canal) + histórico completo com origem e evidência. Registrar consentimento é **acrescentar**, nunca editar (RN-CON-17).
- **Endereços** — [VO] 0..N, ≤1 principal.
- **Empresas** — [E] Vínculo Contato-Empresa: papel (cargo), Empresa principal do Contato, Contato principal da Empresa, início, fim. Ações: vincular, marcar principal, **encerrar** (preenche fim — nunca apaga).
- **Negócios** — Vínculos Contato-Negócio com papel do catálogo fixo.
- **Conversas** — por Canal, derivadas (o Contato não contém Conversas).
- **Tarefas** — Vínculos. **Implementado (2026-09-17):** o painel `TarefasDoContato` (terceira coluna, ao lado de Empresas e Negócios) lista as Tarefas conversacionais ativas que nasceram deste Contato (`tarefasConversacionaisDoContato`: Vínculo Tarefa→Contato **e** Lista conversacional), a mais recente primeiro, em duas linhas (título; Status e Lista), fatiada em 5 com "Mostrando 5 de n."; o botão **[Nova Tarefa conversacional]** abre D17 com o Contato fixo — Lista e Canal são escolha do diálogo. Vazio: "Nenhuma Tarefa conversacional com este Contato."
- **Documentos** — Vínculos a Documento de Conhecimento.
- **`distinto de`** — Vínculos que suprimem Suspeita de Duplicidade.
- **Comentários** e **Linha do tempo**.
- **Estado pré-mesclagem** — só em `mesclado`, com [Restaurar cópia] (D10).

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado` (terminal, aponta o sobrevivente).

**Ações e regras.** Editar; mesclar (D03); arquivar; enviar à lixeira; restaurar; transferir propriedade. Regras visíveis: **cargo pertence ao Vínculo, não ao Contato** — o campo não existe na ficha (RN-CON-06); Identificador duplicado é rejeitado com o detentor nomeado e as duas saídas (RN-CON-11); Contato `arquivado` ou `na lixeira` volta a `ativo` ao receber Mensagem (RN-CON-13) — a ficha explica isso no selo; a mesclagem é irreversível (RN-CON-15); ver o Contato não concede ver as suas Conversas, Negócios e Tarefas — a linha do tempo é filtrada item a item (RN-CON-21).

**Cardinalidade.** Qualificação 0..1; Origem 0..1; Empresas 0..N com ≤1 principal; Negócios 0..N; Identificadores 0..N com ≤1 principal por Tipo; Proprietário exatamente 1 Membro.

**Estado vazio.** Uma frase por seção (§14 dos padrões): Identificadores e Consentimentos com o texto que explica a consequência; "Nenhum Endereço." / "Nenhuma Empresa vinculada." / "Nenhum Negócio." / "Nenhuma Conversa." / "Nenhuma Tarefa vinculada." / "Nenhum Documento vinculado." / "Nenhum Contato marcado como distinto." / "Nenhum Comentário ainda."

**Permissões.** `ver`, `editar`, `administrar` (mesclar, transferir propriedade, editar Comentário de terceiro).

---

## T15 · Empresas — `/crm/empresas` ⟨11⟩

**Propósito.** Inventário de organizações externas.

**Exibe.** Tabela de [E] Empresa: Nome de exibição [D], Identificador principal [D], Empresa matriz [A], Empresa raiz do grupo [D], Contato principal [D], Origem [A], Proprietário [A], Tags, Estado [A]; derivados de negócio (Negócios `aberto`, receita ganha, filiais) como colunas opcionais. Painel de **Sugestões de Vínculo** [VO transitório].

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado`.

**Ações e regras.** Criar; filtrar; aceitar/descartar Sugestão de Vínculo. Regra visível: a plataforma **nunca** cria o Vínculo por conta própria — o aceite é ato de Membro, Agente ou Automação, com Registro (RN-EMP-07).

**Cardinalidade.** Origem 0..1; Tags múltiplas.

**Estado vazio.** Tabela: "Nenhuma Empresa ainda." + [Nova Empresa] · Painel de Sugestões: "Nenhuma sugestão. Sugestões surgem quando o domínio do e-mail de um Contato coincide com o de uma Empresa."

**Permissões.** Como Contatos.

---

## T16 · Ficha da Empresa — `/crm/empresas/[empresa]` ⟨11⟩

**Propósito.** A organização externa e o seu grupo.

**Exibe.** Cabeçalho: Nome de exibição [D], selo, Proprietário, Criador. Atributos: Nome fantasia, Razão social (ao menos um — INV-EMP-01), Descrição, Origem, Tags, Valores de Campo (inclusive as Definições pré-definidas Segmento, Porte, Setor — DO-EMP-10), Última interação [D].

*Seções:*
- **Identificadores** — [E] Identificador de Empresa: tipo (`domínio`, `documento fiscal` com país, `telefone`), valor normalizado, verificado, principal.
- **Grupo** — Empresa matriz [A], filiais [D], Empresa raiz do grupo [D], com a árvore navegável.
- **Empresas relacionadas** — [E] Vínculo Empresa-Empresa tipado: `parceira`, `concorrente`, `fornecedora de`/`cliente de`, `outro` com rótulo.
- **Contatos** — Vínculos com papel, principal e vigência.
- **Negócios** — referências (0..N).
- **Conversas** — **derivadas** dos Contatos vinculados, somente leitura (B53).
- **Endereços**, **Anexos**, **Comentários**, **Linha do tempo**.

**Estados.** `ativo`, `arquivado`, `na lixeira`, `mesclado`.

**Ações e regras.** Editar; definir matriz; vincular Empresa/Contato; mesclar; arquivar; enviar à lixeira. Regras visíveis: **não existe Conversa com Empresa** — a seção diz "derivadas dos Contatos vinculados" (RN-EMP-15); nada é herdado entre matriz e filiais (RN-EMP-12); só Empresa `ativo` recebe novo Negócio, Vínculo, filial ou matriz (RN-EMP-08); enviar à lixeira é rejeitado com Negócio `aberto` ou filial, listando os impedimentos (RN-EMP-09); a eliminação é adiada enquanto houver qualquer Negócio (RN-EMP-10); domínio de provedor público de e-mail é rejeitado como Identificador (RN-EMP-05).

**Cardinalidade.** Empresa matriz 0..1; Identificadores 0..N com ≤1 principal por tipo; Contatos 0..N com ≤1 principal.

**Estado vazio.** "Nenhum Contato vinculado." / "Nenhum Negócio." / "Nenhuma filial."

**Permissões.** Como Contato.

---

## T17 · Negócios — `/crm/negocios` ⟨12, 13⟩

**Propósito.** Operar o funil comercial. Quadro por padrão.

**Exibe.** Seletor de **Funil** (obrigatório — todo Negócio percorre exatamente um). Abas **Abertos** · **Ganhos** · **Perdidos**. Visualizações **Quadro** (colunas = Etapas por Ordem, com probabilidade padrão no cabeçalho e soma de Valor por moeda) e **Tabela**.

[A] por cartão: Título, Identificador legível [D], Empresa, Contato principal [D], Valor [VO] por moeda, Probabilidade efetiva [D], Valor ponderado [D], Dias em Etapa [D], Previsão vencida [D], Próxima atividade [D], Proprietário, Tags.

**Estados.** Situação `aberto` / `ganho` / `perdido` (abas) **e** estado de ciclo de vida `ativo` / `arquivado` / `na lixeira` (filtro), ortogonais (documento 12, 11.3).

**Ações e regras.** Arrastar entre Etapas; criar Negócio; marcar `ganho`/`perdido` (D07); mover de Funil; filtrar. Regras visíveis: **Requisitos de Etapa** e **Transições permitidas** são avaliados de forma síncrona e bloqueante para todo Ator, sem exceção por Papel (RN-FUN-07) — a coluna de destino mostra o Requisito ao arrastar e o cartão volta com o Requisito nomeado; Etapa nunca carrega resultado (B58) — uma Etapa chamada "Ganho" continua de progressão (RN-FUN-20); Negócio `arquivado` é somente leitura (RN-NEG-16); `na lixeira` é ignorado pelo Funil mas continua a referenciar Etapa (RN-NEG-17).

**Cardinalidade.** Funil: seleção única obrigatória. Etapa: única obrigatória.

**Estado vazio.** Quadro sem Negócios: cada coluna diz "Nenhum Negócio nesta Etapa" e **permanece**. Funil sem Negócios: "Nenhum Negócio em *Vendas B2B*." + [Novo Negócio]

**Permissões.** Papel, concessão, compartilhamento; escopos `registro` e `próprios`. Funil privado: `ver` sobre o Funil é pré-requisito por interseção (RN-NEG-19).

---

## T18 · Ficha do Negócio — `/crm/negocios/[negocio]` ⟨12⟩

**Propósito.** A oportunidade e o seu percurso.

**Exibe.** Cabeçalho: Título, Identificador legível [D], selos de **situação** e de **estado**, Proprietário, Criador com delegante.

*Atributos:* Objeto (texto — substitui catálogo de Produtos, B10), Descrição, Funil, Etapa, Valor [VO] (quantia + moeda), Probabilidade sobrescrita [A] / efetiva [D], Valor ponderado [D], Data prevista de fechamento, Origem, Motivo de Perda / de Ganho, Nota de encerramento, Momento de encerramento [D], Data de fechamento [D], Momento de entrada na Etapa atual [D], Dias em Etapa [D], Idade [D], Previsão vencida [D], Última atividade [D], Próxima atividade [D], Tags, Valores de Campo.

*Seções:* **Empresa** (0..1, só `ativo` ao definir); **Contatos** (Vínculo com papel do catálogo fixo `decisor`/`influenciador`/`comprador`/`técnico`/`usuário`/`outro`, ≤1 principal); **Conversas** (Vínculo Conversa-Negócio); **Tarefas** (Vínculo); **Documentos** (Vínculo); **Negócios relacionados** (`relacionado a`); **Anexos**; **Comentários**; **Histórico de transições** — Registros de Atividade com Etapa de origem e destino **por nome à época** e **Ordem à época**, origem da entrada e tempo de permanência (B62).

**Estados.** Situação (com `ganho`/`perdido` terminais reabríveis) × ciclo de vida.

**Ações e regras.** Mover de Etapa; marcar `ganho` (pede valor quando a Regra exige) ou `perdido` (pede Motivo quando exige) — D07; reabrir; mover de Funil (D08, com Etapa explícita); vincular Contato com papel; trocar Empresa; transferir propriedade; arquivar; excluir. Regras visíveis: reabrir `ganho` exige Papel de nível Administrador e **nunca** é feito por Agente (RN-NEG-10, RN-NEG-21); ao reabrir, Motivo e Nota são limpos como atributos correntes e **permanecem** nos Registros (RN-NEG-11); não há transição direta `ganho` ↔ `perdido`; a probabilidade sobrescrita é **descartada** em toda progressão, com o valor preservado no Registro, e **preservada** em remapeamento (RN-NEG-05); não existe mesclagem de Negócios — duplicado fecha como `perdido` com Motivo "Duplicado" (RN-NEG-22); o Negócio **não tem Responsável** (RN-NEG-02); o Proprietário tem `ver` em todo instante (RN-NEG-20).

**Cardinalidade.** Empresa 0..1; Contatos 0..N com ≤1 principal; Funil 1; Etapa 1; Valor 0..1; Motivo 0..1.

**Estado vazio.** Contatos: "Nenhum Contato vinculado. Vincule ao menos um para avançar até *Proposta*." (quando o Requisito existe). Demais seções: "Nenhuma Conversa vinculada." / "Nenhuma Tarefa vinculada." / "Nenhum Documento vinculado." / "Nenhum Negócio relacionado." / "Nenhum Anexo." / "Nenhum Comentário ainda." / Histórico: nunca vazio (a criação já gera Registro de transição — RN-NEG-14).

**Permissões.** `ver`, `editar`, `administrar` (trocar Empresa de Negócio encerrado, transferir propriedade); Papel Administrador para reabrir `ganho`.

---

## T19 · Funis — `/crm/funis` ⟨13⟩

**Propósito.** Governar os processos de progressão.

**Exibe.** [E] Funil: Nome, Descrição, Cor, Ordem de exibição, Estado, Privado, **É o Funil padrão** [D], Etapa inicial [D], contagem de Negócios `aberto` [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; definir como padrão; copiar; arquivar (D08); enviar à lixeira (D08). Regras visíveis: existe **exatamente um** Funil padrão, sempre `ativo` e **nunca privado**, não arquivável nem excluível enquanto for padrão (RN-FUN-16); criar, excluir e definir padrão são governança por Papel de nível Administrador (RN-FUN-17).

**Cardinalidade.** Funil padrão: exatamente 1.

**Estado vazio.** Não se aplica: o Funil padrão é criado com o Espaço de Trabalho (RN-ET-02).

**Permissões.** Papel Administrador para criar/excluir/definir padrão; `administrar` sobre o Funil para configurá-lo.

---

## T20 · Funil — `/crm/funis/[funil]` ⟨13⟩

**Propósito.** Configurar Etapas, validações e regras de encerramento.

**Exibe.** Cabeçalho sem Proprietário (o Funil não tem — B57), com Criador. Lista ordenada de [E] Etapa: Nome, Ordem, Probabilidade padrão, Cor, Descrição, contagem de Negócios [D]. Por Etapa: [VO] **Requisitos de Etapa** (momento `entrada`/`saída`; tipo `campo preenchido` / `contato obrigatório` / `empresa obrigatória` / `valor obrigatório`) e [VO] **Transições permitidas** (vazio = todas). Do Funil: [VO] **Regras de encerramento** (exigir Motivo de Perda; exigir valor ao ganhar). Aba **Painéis** (Painéis de contexto ancorados no Funil — B102).

**Estados.** `ativo`, `arquivado`, `na lixeira`. A Etapa **não tem estado** (13, 11.2) — a interface não oferece arquivar Etapa.

**Ações e regras.** Criar/renomear/reordenar Etapa; **remover Etapa** (D02 obrigatório); definir Requisitos; definir Transições; definir Regras de encerramento; tornar privado; arquivar; excluir; copiar. Regras visíveis: reordenar, renomear ou reconfigurar Etapas **nunca** altera Negócio algum — Negócios referenciam Etapas por identidade (RN-FUN-05); remover Etapa exige remapear todo Negócio que a referencia, **inclusive `na lixeira`** (RN-FUN-10); Requisitos e Transições não são avaliados em remapeamentos (RN-FUN-08); Requisito é validação, Automação é reação (7.2 do documento 13); o Funil não define Definições de Campo — apenas as referencia em Requisitos (RN-FUN-09); Funil privado exige `ver` como pré-requisito para os Negócios (B61), e o Proprietário de Negócio nunca perde `ver` (B63).

**Cardinalidade.** Etapas 1..N (remover a única é rejeitado — RN-FUN-04); Requisitos 0..N por Etapa; Transições 0..N.

**Estado vazio.** Não se aplica: todo Funil tem ao menos uma Etapa.

**Permissões.** `administrar` sobre o Funil; **nunca concedível a Agente** (RN-FUN-17).

---

## T21 · Caixa de Entrada — `/crm/caixa-de-entrada` e `/crm/caixa-de-entrada/[conversa]` ⟨14⟩

**Propósito.** A operação conversacional. Três colunas.

**Coluna 1 — Filas e Canais.** [E] Fila: Nome, Conversas não resolvidas [D], Regra de distribuição, Limite por Atendente. [E] Canal: Nome, Tipo de Canal, Estado de conexão, Estado de ciclo de vida. Filtros: minhas, sem Atribuído, sem Fila, não lidas, adiadas, por estado de conversa.

**Coluna 2 — Conversas.** [E] Conversa: Título [A/D], Contato principal (Nome de exibição [D]), Canal, Estado de conversa, Atribuído (Membro **ou Agente**), Fila, Tempo de espera atual [D], última Mensagem, marcadores (adiada, fora da janela, não lida, de grupo, sem Contato resolvido).

**Coluna 3 — Conversa aberta.**
- Cabeçalho: Contato principal, Canal, Empresa [D] (derivada do Contato principal), Estado de conversa, Atribuído, Fila, Janela de resposta aberta até [D], Tags, Valores de Campo.
- Sequência: [E] Mensagem por **direção** (`recebida`, `enviada`, `interna`), com Ator e delegante, Conteúdo, Anexos, Assunto e Endereços adicionais (E-mail), Status de entrega (só `enviada`), Reações, Leitura interna, Marcação de exclusão, Edição pelo remetente externo, "Em resposta a", Mensagem de modelo usada. Fatos da Conversa (atribuição, transferência, resolução) aparecem como **Registros de Atividade**, nunca como Mensagens (DO-CXE-08).
- Compositor: abas **Responder** e **Nota interna**; [VO] **Rascunho** (um por Ator interno) com o Rascunho de IA destacado e [Usar] / [Descartar]; seletor de Mensagem de modelo quando fora da janela.
- Painel do Contato: Identificadores, Qualificação, Consentimentos vigentes, Negócios (Vínculo Conversa-Negócio), Tarefas, ações [Criar Tarefa a partir da Conversa] e [Criar Negócio a partir da Conversa]. **Implementado (2026-09-17):** o painel **Tarefas** é o mesmo `TarefasDoContato` da ficha do Contato (T14), e **[Criar Tarefa a partir da Conversa]** abre D17 com o Contato **e o Canal desta Conversa** já dados — só a Lista conversacional é escolha; a Tarefa nasce com a Conversa aberta neste Canal (`criarTarefaConversacional` reaproveita a que está aberta). A aba **Tarefa** do compositor (`ConversationThread`) também sabe o modelo: o seletor de Lista diz "Conversacional" ou "Operacional" ao lado de cada uma; numa conversacional o título vira `criarTarefaConversacional` com este Contato e o Canal ativo da aba ("Tarefa criada com o Contato e atribuída a você."), numa operacional continua `createTask` pelo título.

**Estados.** Estado de conversa `aberta` / `pendente` / `resolvida`; ciclo de vida `ativo` / `na lixeira` (**sem `arquivado`**); status de entrega por Mensagem; estado de conexão do Canal.

**Ações e regras.** Auto-atribuir; atribuir a Membro ou Agente; transferir de Fila; responder; nota interna; adiar (define Adiamento); resolver; reabrir; mover Conversa para outro Contato (D12); vincular a Negócio; criar Tarefa/Negócio a partir da Conversa. Regras visíveis:
- Enviar Mensagem **não muda o estado por si** — existem "Responder e marcar pendente" e "Responder e resolver" como atos distintos (DO-CXE-07).
- Fora da janela de resposta, só Mensagem de modelo `aprovado`; Mensagem livre é rejeitada **antes de gravar**, para todo Ator (RN-CXE-19).
- Canal `desconectada`/`com erro`: a Mensagem nasce `pendente` com aviso do prazo de 24 h; nunca há descarte silencioso (B69).
- Mensagem é **imutável** e nunca muda de Conversa; reenviar cria Mensagem nova (RN-CXE-15, RN-CXE-18).
- Agente Atribuído em nível `supervisionado`/`assistido` **não envia**: gera Solicitação de Aprovação e o texto vira Rascunho (RN-AGE-14, B64).
- Só Conversa `resolvida` vai à lixeira (RN-CXE-33).
- Mensagem recebida dentro do Prazo de reabertura reabre a **mesma** Conversa; fora dele cria outra (RN-CXE-09).
- Conversa sem Contato resolvido (Limite de Contatos atingido) exibe o marcador "não resolvido" e a ação [Associar a um Contato] (RN-CXE-06).

**Cardinalidade.** Atribuído 0..1; Fila 0..1; Canal 1 imutável; Contato principal 1; Rascunho 1 por Ator interno; Tags múltiplas.

**Estado vazio.** Coluna 1 sem Filas: "Nenhuma Fila. As Conversas chegam sem Fila e ficam sem Atribuído até alguém se auto-atribuir." + [Nova Fila] · Coluna 1 sem Canais: "Nenhum Canal conectado." + [Conectar Canal] · Coluna 2: "Nenhuma Conversa com estes filtros." + [Limpar filtros] · Compositor sem Rascunho: nada exibido (o Rascunho é opcional).

**Listas longas.** A sequência de Mensagens carrega do mais recente para trás, com [Carregar anteriores] e a data de cada bloco; a ordem é a da sequência e nunca é reordenável. A coluna 2 pagina por rolagem com ordenação por última Mensagem.

**Permissões.** Papel, concessão, compartilhamento e — exclusivamente aqui — **elegibilidade de Fila**: o Membro elegível efetivo vê e edita as Conversas **atualmente** na Fila e as sem Fila (B70). Ser Atribuído **não** concede `ver`; exige-o (Glossário).

---

## T22 · Configurações da Caixa — `/crm/caixa-de-entrada/configuracoes` ⟨14⟩

**Propósito.** Configurar o que vale para toda a mensageria.

**Exibe.** [E] Caixa de Entrada: Prazo de reabertura [A], Distribuição padrão [A], Proprietário padrão de Contatos [A], Horário de atendimento [VO], Conversas não resolvidas [D], Conversas sem Fila [D]. Listas de Canais e de Filas.

**Estados.** A Caixa **não tem estado próprio**: acompanha o Espaço de Trabalho (RN-CXE-27) — o aviso de suspensão aparece aqui.

**Ações e regras.** Editar configurações; abrir Canal ou Fila; criar Fila; conectar Canal. Regras visíveis: existe **exatamente uma** Caixa por Espaço de Trabalho, nunca excluída nem duplicada (RN-CXE-01); o Prazo de reabertura é único e **não** sobrescritível por Fila ou Canal (DO-CXE-04); a Caixa não tem Proprietário (RN-CXE-02); a resolução do Proprietário padrão de Contatos é Fila → Canal → Caixa → Proprietário do Espaço de Trabalho e **nunca falha** (RN-CXE-29).

**Cardinalidade.** Distribuição padrão: seleção única. Proprietário padrão: 0..1 Membro `ativo`.

**Estado vazio.** Canais: "Nenhum Canal conectado. Sem Canal, a Caixa não recebe nem envia Mensagens." + [Conectar Canal]

**Permissões.** Papel de nível Administrador (RN-CXE-03; RN-ET-24).

---

## T23 · Canal — `/crm/caixa-de-entrada/configuracoes/canais/[canal]` ⟨14⟩

**Propósito.** Uma conta conectada e as suas capacidades.

**Exibe.** Nome, Tipo de Canal (imutável), Identificador externo, Estado de conexão, Estado de ciclo de vida, Membro configurador, Criador, Fila padrão (0..1), Proprietário padrão de Contatos (0..1), Origem padrão de Contatos (0..1), Grupos habilitados (quando o Tipo suporta), [VO] Configuração de mensagens de modelo → Mensagens de modelo (identificador no provedor, nome, idioma, corpo com variáveis, categoria, estado de aprovação), tabela de **Capacidades do Tipo de Canal** (só leitura). Derivados: última Mensagem recebida/enviada, Conversas não resolvidas.

**Estados.** Conexão `conectada`/`desconectada`/`com erro`; ciclo de vida `ativo`/`arquivado` — **sem `na lixeira`** (DO-CXE-03).

**Ações e regras.** Reconectar; definir Fila padrão; sincronizar modelos; habilitar grupos; arquivar (exige `desconectada`). Regras visíveis: o Canal **não tem Proprietário** (RN-CXE-02); não pode ser excluído enquanto tiver Conversas — só arquivado (RN-CXE-04); toda regra de mensageria consulta as Capacidades do **Tipo de Canal**, e nem Canal nem Conversa as redefinem (RN-CXE-05); com "Grupos habilitados" falso, Mensagens de grupo são persistidas mas a Conversa nasce `resolvida`, sem distribuição (RN-CXE-28).
**Implementado (C36, 2026-09-22):** o painel Configuração edita o **Setor (Fila padrão)** e a **Origem padrão** por `configurarCanal` — um `Select` pequeno na própria linha, desligado com "Só quem administra o Espaço de Trabalho conecta e configura Canais." para quem não administra; o aviso do resultado aparece sob o painel. O resto (reconectar, modelos, grupos, arquivar) segue só leitura.

**Cardinalidade.** Fila padrão 0..1; Origem padrão 0..1.

**Estado vazio.** Modelos: "Nenhuma Mensagem de modelo sincronizada. Fora da janela de resposta, este Canal não poderá enviar Mensagens livres."

**Permissões.** Papel de nível Administrador.

---

## T24 · Fila — `/crm/caixa-de-entrada/configuracoes/filas/[fila]` ⟨14⟩

**Propósito.** Quem atende e como as Conversas são distribuídas.

**Exibe.** Nome, Descrição, Estado, [E] Elegíveis (Membros e Equipes) com **elegíveis efetivos** [D], Regra de distribuição (`herdar da Caixa`/`manual`/`rodízio`/`menor carga`), Limite de Conversas por Atendente, Proprietário padrão de Contatos, Horário de atendimento [VO] (sobrescreve o da Caixa), Criador. Derivados: Conversas não resolvidas, carga por Atendente, tempo médio de espera. Aba **Painéis** (B102).

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Editar elegíveis; mudar Regra; arquivar; excluir. Regras visíveis: a Fila **não contém** Conversas — é referenciada por elas (DO-CXE-01), e o texto da tela diz isso; arquivar ou excluir exige transferir as não resolvidas **no mesmo ato** (RN-CXE-32); nenhuma regra de distribuição atribui a **Agente** (RN-CXE-12) — o seletor de elegíveis não lista Agentes; Fila sem elegíveis é válida (só distribuição manual); `administrar` sobre a Fila nunca é concedido a Agente nem a base Convidado (B70).

**Cardinalidade.** Elegíveis: múltiplo (Membros e Equipes). Regra: única.

**Estado vazio.** "Nenhum elegível. As Conversas desta Fila ficarão sem Atribuído até alguém se auto-atribuir."

**Permissões.** Papel de nível Administrador ou `administrar` sobre a Fila.

---

# IIIa. FERRAMENTAS (assunto próprio do trilho, abaixo de IA; docs 23–25)

## T20a · Ferramentas — `/ferramentas/grupos` · `/ferramentas/comunidades` · `/ferramentas/flows` ⟨23, 24, 25⟩

**Propósito.** Um assunto próprio do trilho (abaixo de IA), com os três gerenciadores dos Ativos de Canal do WhatsApp como telas do painel: **Grupos** (grupos espelhados, com Participações), **Comunidades** (agregados de Grupos com um Grupo de avisos) e **Flows** (formulários interativos versionados). O provedor é simulado em memória.

**Exibe.** Grupos: Links de Captação (nome, `/l/slug`, Critério, elegíveis agora, cliques, próximo destino) e a lista de Grupos (Nome + marcadores sem privilégio / Canal ausente / link inválido / esgotado / Pedidos pendentes, Canal + Papel do Canal, Ocupação `vigentes / teto` + faixa, Captação + cliques, Link de convite, Comunidade + papel, Sincronização). Comunidades: Nome + marcadores, Canal + Papel, Grupos vinculados `n / limite`, Membros [D, RN-COM-06], Grupo de avisos, Sincronização. Flows: Nome, Categoria, Canal publicador, Versão publicada, rascunho, estado no provedor, Envios · Respostas · Taxa [D].

**Popups (formato da Tarefa).** Grupo (`?grupo=`): propriedades espelhadas à esquerda (Nome, Canal, Papel, Ocupação, Link de convite + Regenerar, Sincronização, Identificador externo, Origem) e as da plataforma à direita (Configurações ×4 como Toggle — desligados com motivo —, Captação ativa, Limite de cliques, Teto, Cliques contabilizados + Zerar, Comunidade, Estado); seções Participações (encerradas escondidas; promover/rebaixar/remover; Adicionar participante), Pedidos de Entrada (aprovar/recusar com motivo; simular), Links de Captação elegíveis (ou o motivo de inelegibilidade), Conversa de grupo (compositor que cria a Conversa — RN-GRP-13); aside Atividade. Comunidade (`?comunidade=`): propriedades, Grupos (vincular/desvincular; o avisos não é desvinculável), Enviar à Comunidade (= Grupo de avisos; "enviar a todos os Grupos" desligado explicando DO-COM-05). Flow (`?flow=`): propriedades (Canal publicador, Ponto de troca de dados, métricas), Versões (criar rascunho a partir de, descartar), Envios, Enviar a um Contato.

**Ações e regras.** Novo Grupo · Novo Link · Importar do Canal · Sincronizar tudo · Nova Comunidade · Novo Flow (→ construtor). Sair do Grupo / da Comunidade exige o nome digitado quando o Canal é o único administrador (24, 20.6). Ferramentas externas recusadas na ordem: lixeira → arquivado → sem Canal → Canal desconectado → `nunca conferido` (RN-ATV-08) → inacessível → sem privilégio (RN-GRP-05); a mesma frase vale para o botão desligado e para a operação.

**Estado vazio.** Sem Grupo: "Crie um Grupo pelo Canal, ou importe os grupos de que o Canal já participa."

**Permissões.** Membro ativo (não Convidado) para as Ferramentas; Proprietário/Administrador para sair, vincular/desvincular, publicar, despublicar, trocar Canal publicador, regenerar chaves.

---

## T20b · Construtor de Flow — `/ferramentas/flows/[flow]` ⟨23⟩

**Propósito.** Editar o rascunho de um Flow (só ele é editável — RN-FLW-04), validar (7.5) e publicar (DO-FLW-03).

**Exibe.** Três colunas: Telas (ordem = navegação padrão; `?tela=` seleciona); a Tela selecionada (Título, Identificador — renomear reescreve as Ações, RN-FLW-08 —, Terminal, Dados de Tela) e os Componentes (Selo por grupo do catálogo, Tipo, Nome, obrigatório, problemas; ↑↓; menu Duplicar / Mover para dentro de… / Remover); clicar num Componente abre o formulário gerado da spec do Tipo (limites com contadores, Ação com Tela de destino e carga útil, Condição). À direita: Validação ao vivo com "ir", Publicar, Versões, pré-visualização em moldura de telefone (o Rodapé navega). Abaixo de `xl` as colunas empilham.

**Ações e regras.** Publicar desligado com motivo (arquivado → sem Canal → desconectado → N problemas); Rodapé único e último (7.5.6); `concluir` só em Tela terminal; `troca de dados` exige Ponto (RN-FLW-10); Nome único na Versão (INV-FLW-04).

---

# IV. IA

**Nota (2026-09-17) — Personalizar é o hub.** O painel do assunto IA tem dois itens: **Chat** e **Personalizar**. `/ia/personalizar/[secao]` é o hub das seis seções — **Agentes · Habilidades · Automação · Conhecimento · Integrações · Plugins** (slugs `agente`, `habilidades`, `automacao`, `conhecimento`, `conectores`, `plugins`) — e cada seção é **o inventário** da entidade (uma lista por entidade): `CatalogGrid` com busca, a ação principal da seção à direita do título e, por cartão, os fatos, o selo, as condições vivas, a ação e o menu "⋯" — cada item desligado com a frase que a operação recusaria. Por isso as listas antigas **redirecionam**: `/ia/habilidades` → `/ia/personalizar/habilidades`, `/ia/conhecimento` → `/ia/personalizar/conhecimento`, `/ia/automacoes` → `/ia/personalizar/automacao`, `/ia/agentes/lista` → `/ia/personalizar/agente`. As fichas continuam nas rotas de sempre (`/ia/agentes/[agente]`, `/ia/habilidades/[habilidade]`, `/ia/automacoes/[automacao]`, `/ia/conhecimento/[colecao]`, `/ia/conhecimento/documentos/[documento]`), e `/ia/agentes` é o **Construtor de Agentes** (`?editar=<id>` abre um existente). Vocabulário (C34): "Plugins" é o rótulo de produto do Catálogo de Ferramentas — cada cartão leva a pílula "Ferramenta"; o Catálogo tem 39 Ferramentas (2026-09-18: entraram as 8 do processo comercial — criar, mover e perder Negócio, vincular Conversa, atualizar Campos de Contato e de Negócio, alterar Proprietário — e cada Ferramenta, Habilidade e Agente do seed tem descrição própria; o Evento "Contato criado por Mensagem" entra para a Caixa de Entrada, RN-CXE-06); "Conectores" saiu em favor de "Integrações" (o slug `conectores` fica); no Chat o chip chama-se "Habilidade". Aprovações (T36) não está no painel: alcança-se pelas Notificações da barra global.

## T25 · Chat — Sessões — `/ia/chat` ⟨16⟩

**Propósito.** As Sessões do Membro logado. Nada mais: Sessão é pessoal.

**Exibe.** [E] Sessão de Chat: Título [A/D], Âncora [VO] (tipo + nome à época + validade [D]), Agente principal efetivo [D], Modelo efetivo [D], momento da última Mensagem, Estado, Custo acumulado [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`. Condições derivadas: Agente principal indisponível; âncora `indisponível`/`eliminada`.

**Ações e regras.** Criar Sessão (com Âncora opcional, escolhida entre Tarefa, Negócio, Contato, Empresa, Conversa, Documento, Espaço, Pasta, Subpasta, Lista); arquivar; excluir. Regras visíveis: **só um Membro `ativo` cria Sessão**, e apenas com `executar` sobre o Agente principal efetivo (RN-CHT-02); a Âncora é fixada na criação e **imutável** (B83); Coleção, Caixa, Fila, Funil, Painel, Agente e outra Sessão **não** são âncoras — o seletor não as oferece.

**Cardinalidade.** Âncora 0..1; Agente principal 0..1 (vazio = Assistente padrão).

**Estado vazio.** "Nenhuma Sessão ainda. Abra uma conversa com o Assistente padrão ou ancore em um registro para começar com contexto." + [Nova Sessão]

**Permissões.** Só o Proprietário. Sessões compartilhadas com o Membro aparecem em uma seção separada, somente leitura (RN-CHT-22).

---

## T26 · Sessão de Chat — `/ia/chat/[sessao]` ⟨16⟩

**Propósito.** Conversar com a IA, com contexto e com rastro.

**Exibe.** Cabeçalho: Título editável, **Âncora como chip** com tipo, nome à época e validade (`válida`/`indisponível`/`eliminada`), Agente principal (trocável), Modelo efetivo, Restrição de Ferramentas, Custo acumulado [D].
Sequência de [E] Mensagem de Chat por **papel**:
| Papel | Como aparece |
| --- | --- |
| `usuário` | Fala do Membro Proprietário |
| `assistente` | Resposta da IA, com **Referências de Conhecimento** e link para a Execução |
| `ferramenta` | **Registro** compacto (Ferramenta, resultado, resumo, link para o Passo) — nunca como fala (DO-CHT-07) |
| `sistema` | Fato da Sessão: Agente trocado, Modelo trocado, Restrição alterada, âncora indisponível, Execução cancelada, Arquivo não suportado |

Mensagem substituída aparece recolhida e marcada. Solicitação de Aprovação inline com o **objeto fixo** legível, prazo e [Aprovar] [Recusar].

**Estados.** Sessão `ativo`/`arquivado`/`na lixeira`; Execução em andamento (`executando`, `aguardando aprovação`); Mensagem `substituída` [D].

**Ações e regras.** Enviar Mensagem; anexar Arquivo; trocar Agente principal; trocar Modelo (só se o Agente admite sobrescrita); restringir Ferramentas; regenerar; decidir Aprovação; compartilhar (`ver` a Membro ou Equipe); arquivar. Regras visíveis:
- Mensagens de Chat são **imutáveis** e nunca eliminadas individualmente; a única eliminação é a da Sessão inteira (RN-CHT-12).
- No máximo **uma Execução não terminal por Sessão**: enviar durante uma Execução é rejeitado ou enfileirado (RN-CHT-09).
- Sessão `arquivado` não aceita Mensagem: desarquivar é ato explícito (RN-CHT-06).
- Agente principal indisponível **bloqueia** novas Mensagens até escolha explícita — **nunca há substituição silenciosa** (RN-CHT-26).
- A Restrição de Ferramentas **só reduz**: Ferramentas disponíveis = permitidas ao Agente ∩ Restrição (RN-CHT-08).
- A Sessão é privada, **as ações não**: toda Ferramenta com efeito gera Registro de Atividade no registro-alvo com Ator Agente e delegante Membro (RN-CHT-10).
- Arquivo cujo tipo o Modelo não suporta permanece na Sessão, **não entra no Contexto** e gera Mensagem `sistema`; se houver Representação derivada, ela entra no lugar (RN-CHT-19).
- Compartilhar dá **só `ver`**, nunca a Agente, e não amplia acesso a registros citados (RN-CHT-22).

**Cardinalidade.** Agente principal 0..1; Modelo escolhido 0..1; Restrição: múltipla (Ferramentas ou classes de efeito); compartilhamentos 0..N.

**Estado vazio.** "Sessão nova. Pergunte alguma coisa." + sugestões derivadas da Âncora quando houver.

**Listas longas.** As Mensagens de Chat carregam do mais recente para trás, com [Carregar anteriores]; Mensagens substituídas ficam recolhidas e não contam na paginação.

**Permissões.** Proprietário escreve; compartilhados só leem (INV-CHT-04). **Nenhum Papel** dá acesso a Sessão alheia, nem ao Proprietário do Espaço de Trabalho (RN-CHT-23).

---

## T27 · Agentes — `/ia/agentes` ⟨17⟩

**Propósito.** Inventário dos sujeitos de IA.

**Exibe.** [E] Agente: Nome, Descrição, Estado, Disponibilidade [D] com motivo, Proprietário, Papel, Assistente padrão [D], Versão corrente [D], Execuções em curso [D], Custo acumulado por período [D].

**Estados.** `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; instanciar Template de Agente (da plataforma ou do Espaço de Trabalho); ativar; pausar; arquivar; excluir. Regras visíveis: **o Assistente padrão não pode ser excluído nem deixar de ser `ativo`** — as ações não são oferecidas (B33, INV-AGE-11); ativar exige objetivo, instruções e Modelo resolúvel (RN-AGE-07); instanciar Template cria Agente `rascunho` com Proveniência, sem vínculo vivo (B81).

**Implementado (2026-09-17).** O inventário é a seção **Agentes** de Personalizar (`/ia/personalizar/agente`; `/ia/agentes/lista` redireciona) — `AgentesCatalogo`: cartão com o selo de estado, as condições de Disponibilidade (`disponibilidadeDoAgente`: Modelo descontinuado ou inexistente, sem objetivo, sem instruções), as pílulas "Assistente padrão", `vN`, autonomia, Modelo, `n Habilidades`, `n Ferramentas` e o Proprietário; menu **Abrir no Construtor · Ativar/Pausar · Ensaiar (`?ensaiar=1` na ficha) · Arquivar…/Desarquivar**, cada item com a recusa de `permissoes-ia`/`agentes.ts` ("O Assistente padrão nunca é pausado (INV-AGE-11).", "Desarquive o Agente antes: ele volta a pausado (B94).", o motivo de `motivoParaNaoAtivar`). **[Novo Agente]** leva a `/ia/agentes`, que é o **Construtor**: um Agente novo nasce em `rascunho` por [Salvar rascunho] ou já `ativo` por [Publicar e ativar] (RN-AGE-07 aplicada no ato — `createAgent(…, { ativar })`); um existente (`?editar=<id>`) só ganha [Publicar versão N] — o estado muda na ficha (D1), e a Versão fotografa as Habilidades concedidas em `grantedSkillIds`. **Pendente:** instanciar Template de Agente e atribuir Papel ao Agente (P17).

**Cardinalidade.** Template na instanciação: única.

**Estado vazio.** Não se aplica: o Assistente padrão existe desde a criação do Espaço de Trabalho (RN-ET-02).

**Permissões.** Governança de Agentes é concedível por concessão direta, **exceto atribuir Papel**, que é governança por Papel (B95, RN-ET-24).

---

## T28 · Agente — `/ia/agentes/[agente]` ⟨17⟩

**Propósito.** Configurar, governar e auditar um Agente. Oito abas.

**Aba Configuração** (versionada). Objetivo, Instruções, Modelo (ou marcador `padrão da plataforma`), Admite sobrescrita de Modelo, Nível de autonomia (`assistido`/`supervisionado`/`autônomo`), [VO] Política de aprovação (aprovadores 0..N Membros ou Equipes; tempo limite, padrão 72 h), Profundidade máxima de invocação, Memória habilitada. Não versionados: Nome, Descrição, Proprietário, Papel, Política de retenção de Memória, Limite de custo. Aviso permanente: "Alterar isto cria a versão N, válida a partir da próxima Execução."

**Aba Habilidades.** [E] Concessão de Habilidade: Habilidade, Versão fixada (0..1; vazio = segue a corrente), Concedida por, momento, **Disponibilidade** [D] com motivo. Ação: conceder (exige `executar` na Habilidade e `editar` no Agente — RN-HAB-12), fixar versão, revogar. Exibe o **Efeito declarado** [D] de cada Habilidade antes de confirmar (RN-HAB-11).

**Aba Conhecimento.** **Conhecimento acessível** [D] — as Coleções em que o Agente tem `ver`. Visão derivada, **somente leitura**: as concessões vivem na Coleção, e a tela diz isso e linka para **T34 › aba Acesso** (DO-CNH-12).

**Aba Ferramentas.** [VO] Ferramentas permitidas, cada uma com **classe de efeito** (`leitura`, `escrita reversível`, `escrita irreversível`, `externa`), Recurso-alvo e permissão requerida. Aviso: "Permitir uma Ferramenta não concede permissão sobre nenhum registro." (DO-HAB-14).

**Aba Permissões.** Papel do Agente (nunca Proprietário nem Administrador nem base neles), concessões diretas e compartilhamentos recebidos, com o Recurso de cada um.

**Aba Execuções.** [E] Execução de Agente: Estado, Origem (`Sessão de Chat`/`ação direta`/`Automação`/`Agente`/`Caixa de Entrada`), Ator invocador, ator delegante, Versão usada, Modelo usado, Nível de autonomia efetivo, marcação de **Ensaio**, Custo [VO], Motivo de término, momentos. Detalhe: [VO] **Passos** (chamada de Ferramenta com as duas permissões avaliadas; Exercício de Habilidade; Solicitação de Aprovação; raciocínio; memorização), [VO] **Composição do Contexto** (referências, nunca conteúdo), Referências de Conhecimento, **Cadeia de Execuções** com profundidade.

**Aba Memória.** [E] Memória do Agente → [E] Item de Memória: Conteúdo, Execução de origem, **Delegante de origem** (0..1), Registros referenciados, momentos, Origem do ato. [VO] Política de retenção de Memória. Explicação visível da **elegibilidade por delegante**: um Item com delegante só entra em Execuções do mesmo delegante (B78).

**Aba Versões.** [E] Versão de Agente: número, Ator, motivo, momento; configuração completa (nunca diferença).

**Estados.** Os cinco do Agente + estados de Execução + Disponibilidade [D].

**Ações e regras.** Editar (cria Versão); ativar/pausar/arquivar/excluir; **ensaiar** (única Execução admitida em `rascunho`; escritas `simulado`, sem efeito, sem Memória — B82); transferir propriedade; cancelar Execução; apagar Item de Memória. Regras visíveis:
- Pausar, arquivar ou excluir **não cancela** Execuções em curso: terminam na Versão carregada (RN-AGE-19).
- `pausado` **preserva** responsabilidades; `arquivado` e `na lixeira` as **liberam** no ato, e a restauração não as devolve (RN-AGE-20).
- Restaurar devolve a `pausado`, nunca a `ativo` (B94).
- Um Agente **nunca** cria nem reconfigura Agente, Habilidade ou Automação — inclusive a si próprio (RN-AGE-25).
- O Agente não herda permissões do Proprietário, que também não é teto (B76) — assimetria com a Automação, explicada na aba Permissões.

**Implementado (2026-09-17).** `AgenteCompleto` substitui as oito abas por **painéis numa ficha** no formato das fichas de IA: cabeçalho com o `StateSeal`, a pílula `vN` e o `ConditionMarker` de Disponibilidade com os motivos; botão primário contextual — **[Ativar]** em rascunho e pausado, **[Ensaiar]** em ativo — e o menu **Editar no Construtor** (`/ia/agentes?editar=`) · **Ensaiar** · **Pausar/Ativar** · **Transferir propriedade…** (D23) · **Arquivar/Desarquivar** · **Enviar à lixeira/Restaurar** (Restaurar também recusa a colisão de nome: "Já existe um Agente chamado “X”: renomeie antes de restaurar (RN-AGE-02)."), cada um com a recusa da operação. Painéis: **Habilidades concedidas** (+Conceder → D20; por Concessão, a Disponibilidade com motivos e o menu Fixar versão… · Seguir a corrente · Revogar — `fixarVersaoDaConcessao`, `revogarHabilidade`), **Ferramentas permitidas** (+Permitir → D21; classe de efeito; `ConditionMarker` "inoperante" quando a Integração está desconectada; Retirar — `retirarFerramenta`), **Conhecimento acessível** (as Concessões gravadas na Coleção, com Revogar; e as declarações do Construtor sem Concessão, marcadas "declarada no Construtor, sem concessão", com [Conceder] → D27), **Execuções** (lista com a pílula "ensaio"; **Cancelar** — `cancelarExecucao`, "Cancelar exige administrar o Agente ou ser o delegante da Execução (RN-AGE-21)."; o detalhe abre em `/ia/execucoes/[execucao]`) e **Memória do Agente** (Apagar — `apagarItemDeMemoria`). Aside: **Configuração** (Proprietário, Papel, Estado, Versão corrente, autonomia, Modelo, Política de aprovação, Ativado/Pausado, Objetivo), **Versões** (número, motivo — "Habilidade “X” concedida", "Ferramenta “Y” permitida", "Publicada no Construtor" —, autor) e **Configuração do Construtor** (quebra-gelos, Conhecimento declarado, formato de resposta, pontos de acesso). Conceder, revogar, permitir e retirar **criam Versão** (RN-AGE-06, D8) — todas pela mesma fábrica (`montarVersaoDoAgente`, 2026-09-18), que fotografa as Concessões reais em `grantedSkillIds` (o seed grava as seedadas na Versão 1); dar Coleção não. **Ensaiar** (D22) grava uma Execução real com `rehearsal`, determinística. **Pendente:** a aba Permissões (só o Papel aparece, em Configuração) e atribuir Papel (P17); o Modelo não executa — o ensaio é determinístico (P14).

**Cardinalidade.** Modelo 1 (ou marcador); Papel 1; Proprietário 1; Ferramentas 0..N; Habilidades 0..N; aprovadores 0..N.

**Estado vazio.** Habilidades: "Nenhuma Habilidade concedida. O Agente age apenas com as instruções, as Ferramentas permitidas e o Conhecimento a que tem acesso." · Ferramentas: "Nenhuma Ferramenta permitida. O Agente é puramente conversacional: responde, mas não lê nem altera registro algum." · Conhecimento: "Nenhuma Coleção acessível." · Memória: "Nenhum fato memorizado." · Execuções: "Nenhuma Execução ainda." + [Ensaiar].

**Permissões.** `ver` para abrir; `editar` para configurar e para a Memória; `administrar` para transferir, cancelar Execução e decidir Solicitação; Papel de nível Administrador para atribuir Papel.

---

## T29 · Habilidades — `/ia/habilidades` ⟨18⟩

**Propósito.** Catálogo de competências reutilizáveis.

**Exibe.** [E] Habilidade: Nome, Descrição, Pertencimento (Espaço de Trabalho ou `plataforma`), Estado, Versão corrente [D], **Efeito declarado** [D] da corrente, número de Agentes com Concessão.

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; **copiar** Habilidade da plataforma (não existe Template de Habilidade — B71); arquivar; excluir. Regra visível: a Habilidade **não tem Proprietário** — a coluna não existe (B71); Habilidade `arquivado` torna toda Concessão `indisponível` (documento 18, 11.1).

**Implementado (2026-09-17).** `/ia/habilidades` redireciona para a seção **Habilidades** de Personalizar — `HabilidadesCatalogo`: ações **[Copiar da plataforma]** (D19) e **[Nova Habilidade]** (D18), desligadas para Convidado ("O Papel Convidado não cria Habilidade."); cartão com o selo `vN` (ou "sem versão publicada"), pertencimento ("da plataforma" / "do Espaço de Trabalho"), o **Efeito declarado** da corrente (`efeitoDeclarado`: sem efeito · escrita reversível · escrita irreversível · efeito externo), "rascunho vN" quando há, `n Agentes` com Concessão e o estado; menu **Criar rascunho a partir da vN · Publicar rascunho vN · Conceder a um Agente… (D20) · Arquivar…/Restaurar**, com as frases de `habilidades.ts` ("A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04).", "Não há rascunho para publicar.", "Só uma Habilidade ativa é concedida."). Arquivar confirma dizendo quantas Concessões ficam indisponíveis (RN-HAB-14). **Pendente:** enviar Habilidade à lixeira.

**Cardinalidade.** —

**Estado vazio.** "Nenhuma Habilidade. Agentes funcionam sem elas, apenas com instruções, Ferramentas e Conhecimento." + [Nova Habilidade] [Copiar da plataforma]

**Permissões.** `administrar` para publicar; `executar` + `editar` no Agente para conceder.

---

## T30 · Habilidade — `/ia/habilidades/[habilidade]` ⟨18⟩

**Propósito.** Definir e versionar a competência.

**Exibe.** Cabeçalho sem Proprietário, com Criador e Publicador por Versão. Cinco abas — **Versão · Ferramentas · Dependências · Agentes · Versões**:
- **Versão** — [E] Versão de Habilidade: Número, Estado da versão, Instruções, [VO] Contrato de entrada (Parâmetros: nome, tipo, obrigatório, padrão, descrição — Tipos de Campo, referência a registro, Arquivo com tipos), [VO] Contrato de saída (estruturado, texto, Arquivos produzidos), [VO] Requisitos de Ferramenta (obrigatória/opcional), [VO] Dependências, [VO] Coleções recomendadas, Capacidades de Modelo requeridas [D], **Efeito declarado** [D].
- **Ferramentas** — [VO] Requisitos de Ferramenta da Versão exibida, cada um marcado **obrigatória** ou **opcional**, com a classe de efeito e o motivo quando torna a Concessão `indisponível` (RN-HAB-18).
- **Dependências** — [VO] Dependências da Versão exibida, com Versão fixada opcional, profundidade e o fecho transitivo de Ferramentas obrigatórias (RN-HAB-09).
- **Agentes** — Concessões, com Versão fixada e Disponibilidade [D] por Agente.
- **Versões** — histórico com `rascunho` (0..1) / `publicada` (0..N) / `obsoleta`.

**Estados.** Habilidade `ativo`/`arquivado`/`na lixeira`; Versão `rascunho`/`publicada`/`obsoleta`; Disponibilidade da Concessão [D].

**Ações e regras.** Editar rascunho; publicar; obsoletar; conceder a Agente; fixar versão. Regras visíveis: **no máximo um `rascunho`** por Habilidade (RN-HAB-04); publicar valida instruções, nomes de Parâmetros únicos, Ferramentas existentes, Dependências acíclicas dentro da profundidade e Coleções existentes — e a falha em qualquer item rejeita sem efeito, listando o que falta (RN-HAB-06); versões `publicada`/`obsoleta` são **imutáveis** (RN-HAB-07); **Coleção recomendada é declaração, não concessão** — o acesso segue a concessão do Agente (RN-HAB-10); obsoletar a versão fixada torna a Concessão `indisponível`, sem rejeitar (B71).

**Implementado (2026-09-17).** `HabilidadeCompleta` troca as cinco abas por **uma ficha com painéis**: cabeçalho com o estado, a Versão corrente e o rascunho; **[Publicar vM]** (D31) com a mesma recusa que a operação daria; menu **Copiar para o Espaço de Trabalho** (só da plataforma, D19) · **Criar rascunho a partir da corrente** · **Descartar rascunho** ("Este é a única Versão da Habilidade: descartá-la a deixaria vazia (INV-HAB-01).") · **Conceder a um Agente** (D20; desligado com o motivo — Habilidade não ativa, Convidado, ou nenhum Agente governável) · **Arquivar/Restaurar**. Propriedades em `LinhaDeProp`: Nome e Descrição (editáveis em linha, sem Versão nova), Pertencimento, Criador, Proveniência ("cópia de …"), Agentes com Concessão. O **rascunho** é editado em `RascunhoDaHabilidade` — Instruções (obrigatórias para publicar), **Contrato de entrada** e **Contrato de saída** em `ContratoEditor` (linhas nome · tipo · obrigatório · descrição, [Adicionar Parâmetro]; nome saneado a identificador, repetido ou começando por dígito fica `invalid` no ato), Toggle "Também devolve texto", **Ferramentas exigidas** (`MultiSelect` + Toggle "obrigatória" por Ferramenta), **Dependências** (`MultiSelect`; ciclo e profundidade > 3 calculados ao vivo e recusados antes do clique — RN-HAB-08) e **Coleções recomendadas**; um só **[Gravar rascunho]** (`editarRascunhoDaHabilidade`) que aceita rascunho pela metade. A **Versão corrente** aparece em leitura ("Uma Versão publicada não é editada (RN-HAB-07)"); a tabela **Versões** tem menu por linha (Obsoletar · Criar rascunho a partir desta · Descartar). Aside: **Validação** viva (`validarRascunhoDaHabilidade`, a lista de RN-HAB-06/08 com o campo), **Agentes com Concessão** (Disponibilidade por Agente; Fixar versão… · Seguir a corrente · Revogar; [Conceder]) e o Registro de Atividade recolhido. Habilidade da plataforma é só leitura, com o motivo em cada controle (INV-HAB-07). Versões não têm id (D4): o realce acende a linha da Versão tocada.

**Cardinalidade.** Requisitos de Ferramenta 0..N; Dependências 0..N; Coleções recomendadas 0..N; Versão fixada 0..1.

**Estado vazio.** "Nenhum Agente tem esta Habilidade concedida."

**Permissões.** `administrar` para publicar e obsoletar; `executar` para conceder.

---

## T31 · Automações — `/ia/automacoes` ⟨19⟩

**Propósito.** Inventário das regras reativas, por escopo.

**Exibe.** [E] Automação agrupada por **Escopo** (Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada, Fila): Nome, Descrição, Natureza [D] (`determinística`/`híbrida`), Estado, **Inoperante** [D] com motivo, Proprietário, Versão vigente [D], última Execução e contagem por resultado [D].

**Estados.** `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira`. **Inoperante** é condição derivada, exibida com motivo (escopo não `ativo`, Espaço de Trabalho `suspenso`, Proprietário `suspenso`, referência inválida) — nunca como selo de estado (documento 19, 11.1).

**Ações e regras.** Criar (escolhendo escopo, **imutável**); duplicar; pausar; arquivar; excluir. Regras visíveis: o escopo delimita o **Gatilho**, não a Ação (RN-LIS-09); mudar de escopo é duplicar e arquivar (RN-AUT-02); a Automação é eliminada com o escopo (B41).

**Implementado (2026-09-17).** `/ia/automacoes` redireciona para a seção **Automação** de Personalizar — `AutomacoesCatalogo`: **[Nova Automação]** (D30; ao criar, abre o editor); cartão com o selo de estado, a condição **"inoperante: motivo"** (`inoperante`: escopo eliminado/arquivado/na lixeira, Espaço de Trabalho suspenso, Proprietário removido/suspenso/pendente, sem Versão vigente, referência inválida — a cabeça na pílula, o motivo inteiro no `title`; desde 2026-09-18 a Concessão indisponível conta como referência inválida, e no seed nenhuma Automação publicada nasce inoperante), o tipo de Gatilho, "escopo: …", "híbrida"/"determinística", a pílula **"executa no protótipo"** (`escopoExecutaNoPrototipo`: só o par escopo × Gatilho que os motores rodam — Lista por Tarefa criada, entrada em Status e distância do vencimento; Grupo/Comunidade/Espaço de Trabalho pelos Eventos de Grupo; Flow e Espaço de Trabalho por Resposta de Flow), `n execuções` e o Proprietário; menu **Abrir editor · Pausar/Retomar/Restaurar · Duplicar · Arquivar…**, com as recusas de `recusaDeAdministrarAutomacao`. A lista não agrupa por escopo: o escopo é pílula e a busca da grade o alcança. **Pendente:** enviar à lixeira pelo cartão (fica no editor); acionar manualmente (P15).

**Cardinalidade.** Escopo: seleção única obrigatória, imutável.

**Estado vazio.** "Nenhuma Automação. Uma Automação reage a um Gatilho, avalia Condições e executa Ações." + [Nova Automação]

**Permissões.** `administrar` para publicar; `executar` para acionar manualmente.

---

## T32 · Automação — editor — `/ia/automacoes/[automacao]` ⟨19⟩

**Propósito.** Compor Gatilho → Condições → Ações e auditar Execuções.

**Aba Editor** (sobre a Versão `rascunho`):
- **Gatilho** — exatamente um por Versão: `evento` (Evento do catálogo sobre o escopo e descendentes, com filtro de subtipo), `agendamento` ([VO] Regra de Agendamento, no fuso da Localidade), `manual` (Membro com `executar`, ou Agente pela Ferramenta `acionar Automação`), `condição temporal` (predicado periódico, uma vez por registro por entrada).
- **Condições** — predicados sobre o objeto do Gatilho, relacionados diretos, dados do Evento e Contexto; conjunção/disjunção/negação; **Condição híbrida** (classificação por Agente com contrato de saída estruturado, Ferramentas de escrita rejeitadas) marcada com o selo `híbrida`.
- **Ações** — lista ordenada. **Ações de escrita** exibem a Ferramenta invocada, a classe de efeito e a permissão requerida. **Ações de controle** (ramificar, invocar Agente, solicitar aprovação, aguardar, notificar, encerrar) são visualmente distintas e não têm classe de efeito.
- **Ação "invocar Agente"** — Agente (padrão: Assistente padrão), Habilidade indicada (0..1), entrada, **Autonomia máxima imposta**, **Aprovador** (0..1 Membro ou Equipe), **Tempo limite**.
- [VO] **Política de erro** — `interromper` (padrão) / `continuar`; retentativa só para falha transitória de Ferramenta de Integração; notificação ao Proprietário.

**Aba Execuções.** [E] Execução de Automação: Estado, Gatilho disparador [VO], Objeto, Ator invocador, ator delegante, Versão usada, Motivo, [VO] Passos (Condição avaliada / Ação executada, com resultado `concluído`/`falhou`/`pulado`/`aguardando`/`cancelado`, permissão avaliada, tentativas), **Execuções de Agente filhas**, Solicitações de Aprovação, **Cadeia de Execuções**, Custo.

**Aba Versões** e **Aba Permissões** (Papel 0..1, concessões próprias, **teto do Proprietário** explicado).

**Estados.** Automação (5) + Versão (`rascunho`/`publicada`/`obsoleta`) + Execução (6).

**Ações e regras.** Editar rascunho; publicar; acionar manualmente; pausar; transferir propriedade. Regras visíveis:
- **Um Gatilho por Versão**: quem precisa de dois Eventos cria duas Automações (DO-AUT-02).
- Publicar valida escopo × Gatilho, ao menos uma Ação, Ferramentas existentes, Agentes `ativo` com `executar`, Habilidades concedidas, Definições efetivas e o **teto de permissões do Proprietário** — e rejeita sem efeito, listando o que falta (RN-AUT-07, RN-AUT-04).
- Publicar torna a Versão anterior `obsoleta` no mesmo ato (DO-AUT-19).
- Restaurar devolve a `pausado`, nunca a `ativo` (RN-AUT-05).
- **Limite de operações por Execução**: ao atingi-lo, a Execução passa a `aguardando aprovação` com Solicitação ao Proprietário, **em qualquer nível de autonomia** (RN-AUT-13).
- Aprovação concedida **reavalia** Condições e pré-condições antes de executar (RN-AUT-16).
- Disparo que fecharia ciclo (par (Automação, objeto) repetido, Agente repetido, profundidade excedida) **não cria Execução**: gera "disparo recusado por ciclo" com a Cadeia e notifica (RN-AUT-09).
- Eventos "por remapeamento" **não** disparam Gatilhos ordinários (RN-AUT-22).
- Uma Automação nunca cria nem reconfigura Automação alguma (RN-AUT-24).

**Implementado (2026-09-17).** `EditorDeAutomacao`, no molde do Construtor de Flow: cabeçalho com estado, Versão e **[Publicar vN]** (D31), menu **Pausar/Retomar · Duplicar · Descartar rascunho · Arquivar/Restaurar · Enviar à lixeira** (Restaurar exige `administrar` e recusa a colisão de nome no escopo — RN-AUT-03; Duplicar abre a cópia com o Toast); faixas que dizem por que a tela é só leitura ("sem rascunho": a vigente em leitura, com "criar rascunho a partir dela" — INV-AUT-02) ou por que **o motor deste protótipo não a executa** (o par escopo × Gatilho fora de `escopoExecutaNoPrototipo`). Três abas: **Editor · Execuções · Versões**. O Editor tem **três colunas** — **Gatilho**, **Condições**, **Ações** — com o bloco selecionado na URL (`?bloco=gatilho|condicoes|acoes&indice=`), e cada bloco editado por `BlocoForm`, um formulário montado da spec (`automacao-spec.ts`): Gatilho por tipo (evento → Evento do catálogo com família e escopo explícitos, mais o Status quando o Evento pede subtipo; agendamento → frequência, intervalo, dias da semana, hora; manual; condição temporal → dias em relação ao vencimento); Condição por tipo (atributo → Status; Valor de Campo → Definição, operador, valor; pertencimento e temporal → expressão, não executam; híbrida → Agente, Habilidade, expressão); Ação de escrita por Ferramenta do Catálogo (`tarefa.definirResponsavel`/`removerResponsavel` → Membro; `adicionarObservadores`; `alterarStatus` → Status; `comentar` → modelo com `{{cliente}} {{titulo}} {{vencimento}} {{campo:<id>}}` e menções; `definirCampo`; `contato.adicionarTag`; `contato.definirCampo`; `mensagem.enviarAoContato` → modelo e Canal; as demais → `params` em JSON) ou de controle (Invocar Agente → Agente, Habilidade, entrada, autonomia máxima, aprovador, tempo limite; Solicitar aprovação; Aguardar; Notificar; Encerrar). Tudo que o tipo admite aparece e o que o protótipo executa leva a pílula **"executa no protótipo"** (D5: as dez Ferramentas dos motores entraram no Catálogo). As três Ferramentas legadas do Catálogo (`alterar_status`, `criar_comentario`, `enviar_mensagem`) não entram na Ação nova; numa Ação existente levam a pílula **"legado"** com a equivalente que o motor executa (2026-09-18). As colunas não abrem rolagem horizontal (`min-w-0` nas listas). As Ações reordenam por `SetaDeOrdem`. Abaixo das colunas: **Validação** ao vivo (`validarAutomacao`, com "ir" até o bloco do problema — a mesma lista que `publishAutomation` responde, primeiro problema com `field` = bloco; desde 2026-09-18 inclui a Concessão indisponível na Condição híbrida e em Invocar Agente — RN-AUT-07: "A Habilidade “X” está indisponível para o Agente “Y”: …" —, e `inoperante` diz o mesmo como referência inválida), **Política de erro** (interromper/continuar, retentativas, teto de autonomia) e **Atributos** (Nome, Descrição, escopo com link, Proprietário, "Reage a Eventos de Automações"). **Pendente:** acionar manualmente e ramificar ("Ramificação não entra neste protótipo.") — P15; a aba Permissões e transferir propriedade ("Transferir a propriedade fica fora deste protótipo.").

**Cardinalidade.** Gatilho 1; Condições 0..N; Ações 1..N para publicar; Autonomia máxima 0..1; Aprovador 0..1.

**Estado vazio.** Editor: "Escolha um Gatilho para começar." Execuções: "Nenhuma Execução ainda."

**Permissões.** `administrar` para publicar; `executar` para acionar; Papel para atribuir Papel à Automação.

---

## T33 · Conhecimento — Coleções — `/ia/conhecimento` ⟨20⟩

**Propósito.** Inventário do corpus curado.

**Exibe.** [E] Coleção: Nome, Descrição, Proprietário, Privada, Estado próprio, quantidade de Documentos [D], momento da última Atualização [D], Agentes com acesso [D].

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; arquivar; excluir. Regras visíveis: **Coleção não contém Coleção** — não existe "Nova subcoleção" (RN-CNH-03); um Espaço de Trabalho nasce **sem** Coleções e nenhuma é obrigatória (B96); arquivar a Coleção pausa as Fontes e a retira das consultas de Agentes no ato (documento 20, 11.1).

**Implementado (2026-09-17).** `/ia/conhecimento` redireciona para a seção **Conhecimento** de Personalizar — `ConhecimentoCatalogo`: **[Nova Coleção]** (D24; nasce com a Fonte Envio manual — RN-CNH-04 — e abre a ficha); cartão com o selo "privada" quando é, `n documentos`, `n fontes`, `n Agentes com acesso`, o Proprietário e o estado; menu **Adicionar Documento… (D25) · Dar acesso a um Agente… (D27) · Arquivar…/Restaurar**, com as recusas de `recusaNaColecao` ("Esta Coleção é privada: só o Proprietário age nela.", "O Papel Convidado não age sobre Coleções."). Arquivar confirma o efeito (Fontes pausadas, Agentes deixam de consultá-la, Concessões ficam). **Pendente:** enviar Coleção à lixeira.

**Cardinalidade.** Proprietário exatamente 1.

**Estado vazio.** "Nenhuma Coleção. Conhecimento é conteúdo curado que Agentes consultam — Tarefas, Contatos e Negócios não são Conhecimento." + [Nova Coleção]

**Permissões.** `ver` para listar; Coleção privada só a Proprietário, concessões e compartilhamentos (B97).

---

## T34 · Coleção — `/ia/conhecimento/[colecao]` ⟨20⟩

**Propósito.** Governar Documentos, Fontes e acesso.

**Exibe.** Abas:
- **Documentos** — [E] Documento: Título, Tipo de conteúdo, Fonte, Estado próprio, Estado efetivo [D], Estado de processamento [D], **Desatualizado** [D], Ausente na origem desde [A].
- **Fontes** — [E] Fonte: Tipo (`envio manual` implícita e não removível; `URL`; `Integração`), Nome, [VO] Configuração, [VO] Política de atualização, Membro configurador, Estado operacional, Marca de versão da origem [VO], resultado da última Atualização.
- **Acesso** — Proprietário, Privada, concessões a **Agentes** (`ver`, opcionalmente `criar`/`editar`), compartilhamentos a Membros e Equipes.
- **Retenção** — [VO] Política de retenção de versões.

**Estados.** Coleção (3) + Fonte (`ativo`/`pausado`/`com erro`) + Documento (próprio e efetivo) + processamento da Versão corrente.

**Ações e regras.** Adicionar Documento; configurar Fonte; atualizar Fonte; conceder acesso a Agente; tornar privada; arquivar; excluir. Regras visíveis: a Coleção é o **único Recurso de permissão** do Conhecimento — Documento, Versão e Fragmento herdam e nunca têm permissão própria (B97), e a tela diz isso na aba Acesso; toda Coleção tem exatamente uma Fonte `envio manual`, não removível (RN-CNH-04); eliminar Fonte com Documentos exige **escolha explícita** (manter como `envio manual` ou enviar à lixeira) — nunca eliminação silenciosa (RN-CNH-19); Atualização que não encontra um Documento o **arquiva**, nunca o envia à lixeira nem o elimina (RN-CNH-18); "Agente tem acesso" é concessão gravada aqui, e a aba Conhecimento do Agente é só a visão derivada (DO-CNH-12).

**Implementado (2026-09-17).** `ColecaoCompleta`: cabeçalho com o estado e a privacidade, **[Adicionar Documento]** (D25) e o menu **Nova Fonte (D26) · Dar acesso a um Agente (D27) · Tornar privada/pública (`editarColecao`) · Arquivar/Restaurar**; as quatro abas — **Documentos** (tabela com Tipo, Fonte, estado e processamento; menu por Documento: Mover para outra Coleção (D29) · Nova Versão (D28) · Arquivar/Restaurar), **Fontes** (tipo e estado operacional; a Envio manual marcada "Fonte implícita: não pode ser removida, pausada nem reconfigurada (RN-CNH-04)"), **Acesso** (as Concessões a Agentes com as ações e Revogar — `revogarColecao`) e **Retenção** (a Política de retenção de versões, em leitura). Cada controle desligado repete a frase de `recusaNaColecao`/`recusaNoDocumento`. **Pendente:** atualizar/sincronizar Fonte (URL e Integração não sincronizam — P16); eliminar Fonte com a escolha de RN-CNH-19; editar a Política de retenção.

**Cardinalidade.** Fontes 1..N; concessões a Agentes 0..N.

**Estado vazio.** "Nenhum Documento. Envie um arquivo ou configure uma Fonte." + [Adicionar Documento] [Nova Fonte]

**Permissões.** `ver`/`comentar`/`criar`/`editar`/`excluir`/`administrar` conforme RN-CNH-06.

---

## T35 · Documento de Conhecimento — `/ia/conhecimento/documentos/[documento]` ⟨20⟩

**Propósito.** O conteúdo curado, versionado e rastreável.

**Exibe.** Cabeçalho sem Proprietário (governança da Coleção — B97), com Criador, Coleção e Fonte. Atributos: Título (editável sem criar Versão), Tipo de conteúdo, Versão corrente [D], Estado próprio, Estado efetivo [D], Estado de processamento [D], Desatualizado [D], Ausente na origem desde [A].
Seções: **Conteúdo** da Versão corrente ([VO] texto próprio e/ou Arquivo) + [VO] **Representações derivadas** com o Ator gerador; [VO] **Metadado** (autor original, idioma, data do conteúdo, rótulos, resumo); [VO] **Proveniência** (Fonte, origem específica, Ator que adicionou com delegante, momento, marca de versão da origem, copiado de) — **obrigatória e nunca esvaziada**; **Versões** com Origem da Versão; **Vínculos** (Tarefa, Negócio, Contato, Empresa, Documento); **Comentários** (podem citar Versão e Posição); **Execuções que consultaram** [D] (derivado das Referências de Conhecimento).

**Estados.** Ciclo de vida (próprio e efetivo) × processamento (`pendente`/`processado`/`com erro`), explicitamente distintos na tela (documento 20, 11.3).

**Ações e regras.** Nova Versão; editar Metadado; restaurar Versão; mover de Coleção; comentar; arquivar; excluir. Regras visíveis: o Conteúdo de uma Versão é **imutável** — toda alteração cria Versão nova (RN-CNH-12); **só a Versão corrente é consultável** (RN-CNH-13); restaurar Versão anterior **cria Versão nova**, nunca reordena o histórico (RN-CNH-14); falha de processamento **não** remove nem arquiva o Documento: ele continua visível, comentável e vinculável, apenas não entra em Contexto (RN-CNH-20); movimentação entre Coleções é restrita a Fonte `envio manual` (RN-CNH-08); Documento não recebe Tags — usa rótulos livres do Metadado (B5; `conhecimento.md`, 7.3. DO-CNH-06 é **proposta** de admiti-las, não adotada); Comentários **nunca** são Conteúdo e nunca geram Fragmentos (INV-CNH-08).

**Implementado (2026-09-17).** `DocumentoCompleto`: Título, Coleção, Tipo (acompanha a Versão corrente: nova Versão e restauração recalculam o Tipo de conteúdo, com o Registro "Tipo de conteúdo: PDF → texto" — 2026-09-18), Fonte em `LinhaDeProp` (Título editável em linha, sem Versão — RN-CNH-12); **[Nova Versão]** (D28) e o menu **Restaurar Versão… · Mover para outra Coleção (D29) · Arquivar/Restaurar · Enviar à lixeira**; o **Conteúdo** da Versão corrente (com as Representações derivadas quando existem); o painel **Fragmentos** (o que entra em Contexto — sem eles a Versão está `pendente` ou `com erro`; texto colado rende um Fragmento por parágrafo, URL e arquivo um só, áudio e vídeo nenhum e ficam pendentes — D9); **Versões** com "Restaurar esta Versão" por linha (`restaurarVersaoDoDocumento` cria a N+1 com origem `restauracao`, RN-CNH-14; "Esta já é a Versão corrente." na corrente); **Comentários** como conversa (`NotasDoRegistro` → `comentarDocumento`); no aside, **Proveniência** (Fonte, origem específica — "texto colado", a URL ou o nome do arquivo —, Ator, momento) e **Metadado** (Rótulos e Resumo editáveis — `editarDocumento`). **Pendente:** Vínculos e "Execuções que consultaram"; a Fonte URL não recaptura (P16).

**Cardinalidade.** Coleção 1; Fonte 1; Versões 1..N com exatamente 1 corrente; Vínculos 0..N.

**Estado vazio.** Comentários: "Nenhum comentário." Execuções que consultaram: "Nenhuma Execução citou este Documento ainda."

**Permissões.** Herdadas da Coleção, sem exceção (RN-CNH-17).

---

## T36 · Aprovações — `/ia/aprovacoes` ⟨17, 19⟩

**Propósito.** Decidir o que a IA não pode fazer sozinha.

**Exibe.** [E] Solicitação de Aprovação: solicitante (Agente ou Automação), **Motivo** (`autonomia`, `permissão`, `limite`, ou Ação explícita da Automação), [VO] **Objeto fixo** (Ferramenta + entrada completa + Recurso-alvo + classe de efeito), aprovador designado, prazo (padrão 72 h), Decisão, Decisor, Execução de origem com a Cadeia.

**Estados.** `pendente` e, com Decisão, `aprovada`/`rejeitada`/`expirada`/`cancelada` (terminais).

**Ações e regras.** Aprovar; recusar com motivo; abrir Execução. Regras visíveis: **aprovar é aprovar exatamente aquilo** — o objeto é imutável e nova redação é nova Solicitação (RN-AGE-17); **aprovar nunca concede permissão**: as duas verificações são refeitas no momento da aprovação e podem resultar em "negada" (RN-AGE-17); no motivo `permissão`, **só quem tem a permissão requerida** aprova, e se torna delegante do Passo (DO-AGE-11); vencido o prazo, a Solicitação fica `expirada` e a Execução `cancelada` (RN-AGE-18); na Automação, aprovar **reavalia** Condições (RN-AUT-16).

**Cardinalidade.** Decisão: única.

**Estado vazio.** "Nenhuma Solicitação de Aprovação pendente para você."

**Permissões.** O aprovador designado; quem tem `administrar` sobre o Agente ou a Automação; no motivo `permissão`, só quem tem a permissão requerida (B80).

---

# V. PAINÉIS

## T37 · Painéis — `/paineis` ⟨21⟩

**Propósito.** Inventário das leituras analíticas.

**Exibe.** [E] Painel: Nome, Descrição, Proprietário, [VO] Âncora com validade [D], **Painel de contexto** vs. **Painel do Espaço de Trabalho** [D], Condição de integridade [D] (`íntegro`/`parcialmente inválido`/`vazio`), Estado.

**Estados.** `ativo`, `arquivado`, `na lixeira`.

**Ações e regras.** Criar; **copiar** (com Proveniência; sem compartilhamentos, concessões, Proprietário nem Âncora); arquivar; excluir. Regras visíveis: **não existe Template de Painel** (B108); a plataforma **não instancia** Painéis na criação do Espaço de Trabalho (RN-PAI-03); nome único entre `ativo`/`arquivado` (RN-PAI-31).

**Cardinalidade.** Âncora 0..1.

**Estado vazio.** "Nenhum Painel ainda. Um Painel lê as entidades com as permissões de quem o consulta e nunca guarda dados." + [Novo Painel]

**Permissões.** Membro cria e governa os próprios; Convidado só por compartilhamento; Agente recebe no máximo `ver` (B20, B107).

---

## T38 · Painel — `/paineis/[painel]` ⟨21⟩

**Propósito.** Ler números que respeitam quem está olhando.

**Exibe.** Cabeçalho com Nome, Proprietário, [VO] Âncora com validade, e — **em toda consulta** — o **Momento de referência dos dados** [D] com a declaração fixa "Os valores refletem as suas permissões." Grade de [E] Widget conforme o [VO] Leiaute.

Por Widget: Título, Tipo de Visualização de dados (`número`, `barras`, `linhas`, `pizza`, `funil`, `tabela`, `lista de registros`, `calendário`, `texto`), [VO] Fonte de Dados (entidade-alvo do catálogo fechado × escopos por identidade × inclusões: Subtarefas, arquivados, Ensaios), [VO] Métricas, [VO] Dimensões (0..2), [VO] Filtros fixos, [VO] Período com Atributo temporal de referência, Ordenação, Limite, Validade [D].

**Estados.** Painel (3). Condições derivadas: Widget `inválido` com causa; Disponibilidade da Fonte por visualizador (`disponível`/`arquivada`/`indisponível`/`eliminada`); Condição de integridade.

**Ações e regras.** Criar, editar e **remover** Widget (documento 21, 12.2 — configuração sem lixeira, confirmação simples); reordenar Leiaute; aplicar **Filtro interativo** (estado de sessão, nunca gravado); definir, trocar e **remover** Âncora (remover uma Âncora `eliminada` é a única forma de apagar o seu valor — documento 21, 12.2); compartilhar; exportar (ato registrado); arquivar. Regras visíveis:
- Um Widget = **uma** Fonte = **uma** entidade-alvo; cruzamentos exigem Widgets distintos (B101).
- Status é lido por **categoria** quando o escopo mistura Conjuntos de Status; a Dimensão "Definição de Status" só aparece sob Conjunto efetivo único (RN-PAI-11).
- Valor de Negócio produz **uma série por moeda**; o Painel **nunca converte** (RN-PAI-13).
- **Fonte sem acesso**: o Widget não é calculado nem desenhado, e nem o nome do escopo é revelado (RN-PAI-29).
- Widget inválido **permanece** com a causa; nada é apagado pelo Sistema; a restauração do que o invalidou o revalida (RN-PAI-20).
- Arquivar **não congela** números; congelar é exportar (RN-PAI-26, RN-PAI-24).
- Registro com N valores em Dimensão multivalorada conta em **cada** valor, e a tela avisa que a soma das partes pode exceder o total (RN-PAI-16).
- Conteúdo de Documento, Fragmento, Mensagem, Mensagem de Chat, Comentário e Memória **nunca** é exibido nem agregado (RN-PAI-15).
- Sessão de Chat nunca é Fonte (B85).

**Cardinalidade.** Fonte 1 (0 em `texto`); Métricas 1..N conforme o tipo; Dimensões 0..2; Filtros 0..N; Período 0..1; Âncora 0..1.

**Estado vazio.** "Este Painel está vazio." + [Novo Widget] · Widget sem resultado: "Nenhum registro no período." (distinto de "Fonte sem acesso").

**Permissões.** `ver`/`editar`/`excluir`/`administrar` em escopo `registro`, cumulativas; o Proprietário tem `administrar` por propriedade; **não existe link público** (B104).

---

# VI. CONFIGURAÇÕES

## T39 · Configurações — visão geral — `/configuracoes` ⟨01⟩

**Exibe.** [E] Espaço de Trabalho: Nome, Estado, Proprietário do Espaço de Trabalho [D], Criador, Momento de criação, [VO] Localidade (fuso, moeda, idioma), [VO] Política de lixeira, Profundidade máxima de Subtarefas, [VO] Identificador legível de Tarefas, [VO] Identificador legível de Negócios, Funil padrão, Assistente padrão, Template de Espaço padrão, [VO] Limites impostos, [VO] Suspensões vigentes, Momento de encerramento, Previsão de eliminação [D].

**Estados.** `ativo`, `suspenso`, `encerrado`.

**Ações e regras.** Editar configurações; transferir propriedade (D05); **suspender** (confirmação simples, com o efeito quantificado: "N Membros ficarão sem ações com efeito; Execuções em curso serão canceladas; Mensagens recebidas serão persistidas sem distribuição"); **reativar** (exige levantar cada suspensão por quem a impôs); encerrar (confirmação por digitação). Regras visíveis: alterar a Localidade **não reescreve** valores já gravados (RN-ET-16); reduzir a Profundidade máxima **não elimina** Subtarefas existentes — congela as árvores legadas e informa quantas ficaram além do limite (RN-ET-17); os Limites impostos vêm da plataforma e o Espaço de Trabalho **não os define** (B34); encerrar é ato exclusivo do Proprietário (RN-ET-20); reativar exige levantar **todas** as suspensões, cada uma por quem a impôs (B31).

**Cardinalidade.** Funil padrão exatamente 1; Template de Espaço padrão 0..1.

**Estado vazio.** —

**Permissões.** Papel Proprietário / Administrador; encerrar só Proprietário.

---

## T40 · Membros — `/configuracoes/membros` ⟨01⟩

**Exibe.** [E] Membro: Nome de exibição, Usuário, [VO] Identidade convidada (enquanto `pendente` sem Usuário), Estado, Papel, Equipes, Convidado por, Momento de ingresso, Momento de remoção, Sucessor, Disponibilidade de atendimento.

**Estados.** `pendente`, `ativo`, `suspenso`, `removido`.

**Ações e regras.** Convidar; reenviar convite; **revogar convite** (confirmação simples; não gera Sucessor — o Membro `pendente` não é Proprietário de nada); atribuir Papel; **suspender** (confirmação simples, com o efeito nomeado: "mantém Papel, Equipes, propriedades e responsabilidades, e perde todas as ações com efeito"); reativar; remover (D04). Regras visíveis: **o registro de Membro nunca é apagado** (RN-ET-10) — `removido` continua listado com filtro; o Proprietário não pode ser suspenso nem removido sem transferência prévia (RN-ET-05); um Membro tem **exatamente um** Papel (RN-ET-06); Membros `pendente` contam para o Limite de Membros (RN-ET-23); só `ativo`/`suspenso` integram Equipes (RN-ET-12); um Administrador pode suspender, remover ou rebaixar outro Administrador (RN-ET-25).

**Cardinalidade.** Papel: único obrigatório. Equipes: múltiplo.

**Estado vazio.** Não se aplica.

**Permissões.** Governança por Papel; **não concedível** por concessão direta nem compartilhamento (RN-ET-24).

---

## T41 · Membro — `/configuracoes/membros/[membro]` ⟨01⟩

**Exibe.** Os atributos de T40 + **propriedades** (registros de que é Proprietário: Contatos, Empresas, Negócios, Agentes, Automações, Painéis, Coleções), **responsabilidades** (Tarefas como Responsável, Conversas como Atribuído, Itens de Checklist), **Solicitações de Aprovação** em que é aprovador, concessões diretas, Registros de Atividade.

**Ações e regras.** Atribuir Papel; suspender; remover com Sucessor (D04). A tela **antecipa a sucessão**: mostra exatamente o que será transferido e o que será liberado, antes de confirmar (B28). Regras visíveis: Sessões de Chat e Memória do Usuário **não** são sucedidas — vão à lixeira e são eliminadas ao fim do prazo, salvo reconvite (B87); a concessão `administrar` sobre contêiner privado que ficaria órfã passa ao Sucessor (B38d); autoria e Registros permanecem com o Membro `removido` (A6.4).

**Cardinalidade.** Sucessor: único, Membro `ativo` sem base Convidado.

**Estado vazio.** "Este Membro não é Proprietário de nenhum registro."

**Permissões.** Papel de nível Administrador.

---

## T42 · Equipes — `/configuracoes/equipes` ⟨01⟩

**Exibe.** [E] Equipe: nome (único no Espaço de Trabalho), descrição, Membros, Criador.
**Ações e regras.** Criar/editar/excluir; incluir Membros. Regra visível: a Equipe **não tem Papel** — permissões de Equipe são concessões diretas (documento 01, 7.2); só Membros `ativo` ou `suspenso` integram (RN-ET-12).
**Cardinalidade.** Membros: múltiplo. **Estado vazio.** "Nenhuma Equipe." **Permissões.** Papel de nível Administrador.

---

## T43 · Papéis — `/configuracoes/papeis` ⟨01⟩

**Exibe.** [E] Papel de sistema (Proprietário do Espaço de Trabalho, Administrador, Membro, Convidado — imutáveis) e [E] Papel personalizado com **base** declarada. Matriz de Permissões por Ação (`ver`, `comentar`, `criar`, `editar`, `excluir`, `administrar`, `executar`) e Recurso.
**Ações e regras.** Criar Papel personalizado com base (nunca Proprietário); editar permissões **dentro do teto da base**; **excluir Papel personalizado (D14)** — exige **Papel de destino dos titulares** no mesmo ato (documento 01, 18: "na remoção, Papel de destino dos titulares"). Papéis de sistema não oferecem exclusão. A tela **avisa** quando um rebaixamento a base Convidado deixaria propriedades com o titular, listando os registros (C32 — `PENDENCIAS-FRONTEND.md`). Regras visíveis: a base é teto e nível (B30); Papéis de sistema não são renomeados, excluídos nem reduzidos (RN-ET-06); Agentes e Automações nunca recebem base Proprietário ou Administrador (INV-ET-13).
**Cardinalidade.** Base: única obrigatória. **Estado vazio.** "Nenhum Papel personalizado." **Permissões.** Papel de nível Administrador.

---

## T44 · Tags — `/configuracoes/tags` ⟨01⟩

**Exibe.** [E] Tag: nome, cor, **restrição de tipo** (Tarefa, Contato, Empresa, Negócio, Conversa), uso [D].
**Ações e regras.** Criar/editar/excluir. Regra visível: Tags são definidas **só** no Espaço de Trabalho (RN-ET-13); excluir remove a aplicação de todos os registros, com aviso quantificado (RN-TAR-11).
**Cardinalidade.** Restrição: múltipla. **Estado vazio.** "Nenhuma Tag." **Permissões.** Papel de nível Administrador.

---

## T45 · Campos do CRM — `/configuracoes/campos` ⟨01⟩

**Exibe.** [E] Definição de Campo Personalizado por **entidade-alvo** (Contato, Empresa, Negócio, Conversa): nome, Tipo de Campo, opções, obrigatoriedade. Marca das Definições instanciadas na criação (Segmento, Porte, Setor — DO-EMP-10).
**Ações e regras.** Criar/editar/arquivar. Regras visíveis: Definições para **Tarefa** não vivem aqui — vivem em Espaço, Pasta, Subpasta ou Lista (RN-ET-14), e a tela diz isso com link; remover a Definição remove ou arquiva os Valores (A5.4); Requisito de Etapa que a referencia é removido no mesmo ato (RN-FUN-09).
**Cardinalidade.** Tipo de Campo e entidade-alvo: únicos obrigatórios. **Estado vazio.** Por entidade-alvo. **Permissões.** Papel de nível Administrador.

---

## T46 · Catálogos — `/configuracoes/catalogos` ⟨01⟩

**Exibe.** [E] Origem, [E] Definição de Qualificação (nome, cor, ordem), [E] Finalidade de Consentimento (com indicador "exige consentimento para envio"), [E] Motivo de Perda (com "Duplicado" pré-definido), [E] Motivo de Ganho. Uso [D] por item.
**Ações e regras.** Criar/editar/arquivar; substituir referências. Regras visíveis: eliminar Motivo referenciado por Negócio encerrado é **rejeitado** — substitua em lote ou arquive (RN-NEG-12); eliminar Origem, Qualificação ou Finalidade limpa a referência ou exige substituta, e **nenhum registro é eliminado ou alterado de outra forma** (RN-CON-18, RN-CRM-18); registros de Consentimento preservam o nome da Finalidade à época (RN-CON-18).
**Cardinalidade.** — **Estado vazio.** Não se aplica: itens iniciais são instanciados na criação (B34). **Permissões.** Papel de nível Administrador.

---

## T47 · Templates — `/configuracoes/templates` ⟨01, 08⟩

**Exibe.** [E] Template de Espaço, de Pasta, de Lista, de Tarefa, de Checklist, de Agente (do Espaço de Trabalho) e os **Templates de Agente da plataforma** (globais, somente leitura). Por Template: nome, conteúdo descrito, Criador, uso.
**Ações e regras.** Criar a partir de registro; editar; excluir; definir Template de Espaço padrão. Regras visíveis: instanciar cria entidades novas **sem vínculo vivo**, com Proveniência (A8); **Template de Pasta que contém Subpastas só é instanciável em um Espaço** (B47); **não existe Template de Habilidade** (copiar), **de Automação** (duplicar; Templates de contêiner as carregam) nem **de Painel** (copiar) — a tela explica cada caso; Templates de Agente do Espaço de Trabalho não levam Memória, Execuções nem permissões (B81).
**Cardinalidade.** Template de Espaço padrão: 0..1. **Estado vazio.** "Nenhum Template." **Permissões.** Papel de nível Administrador.

---

## T48 · Integrações — `/configuracoes/integracoes` ⟨01⟩

**Exibe.** [E] Integração: nome, tipo de sistema externo, Estado (`conectada`/`desconectada`/`com erro`), Membro configurador, Criador, Ferramentas expostas [D]. Canais aparecem como **link para a Caixa de Entrada**, não editáveis aqui (o Canal é contido pela Caixa — documento 01, 7.4).
**Ações e regras.** Conectar; reconectar; desconectar (confirmação por ser externa); **remover** (confirmação por digitação: destrói credenciais irrecuperáveis e o diálogo enumera a cascata — Ferramentas expostas que ficam inoperantes, Canais e Fontes de Conhecimento que dependem dela, Automações cujas Ações passarão a falhar). Regras visíveis: a Integração **não tem Proprietário** e não é sucedida (B35); credenciais nunca são exibidas depois de gravadas; Ferramentas de Integração `desconectada` permanecem permitidas e ficam **inoperantes** (documento 18, 7.4).
**Implementado (2026-09-17).** Cada cartão ganhou o menu de `useIntegracoesMenu` — **Conectar/Reconectar** (ato direto; o aviso conta Ferramentas operantes, Habilidades disponíveis de novo e Fontes reativadas) e **Desconectar…** (D32) — o mesmo da seção Integrações de Personalizar, para os dois lugares dizerem a mesma coisa; a recusa de `recusaDeAdministrarIntegracao` ("Conectar ou desconectar uma Integração é ato de Administrador (B35).") desliga o item. **Pendente:** criar Integração (P18) e remover.
**Cardinalidade.** — **Estado vazio.** "Nenhuma Integração." **Permissões.** Papel de nível Administrador.

---

## T49 · Lixeira — `/configuracoes/lixeira` ⟨transversal, B43⟩

**Propósito.** O único lugar em que registros `na lixeira` aparecem.

**Exibe.** Por tipo de entidade: nome à época, quem excluiu e quando, **Estado próprio anterior à exclusão** [A], **Previsão de eliminação** [D], e — para registros de cadeia — o ancestral que os restringe.

**Estados.** `na lixeira` (todos). Entidades **sem** `na lixeira` não aparecem: Canal (DO-CXE-03), Etapa, Mensagem, Fragmento, Participante, Registro de Atividade, Versões.

**Ações e regras.** Restaurar; eliminar antecipadamente. Regras visíveis: restaurar devolve o **Estado próprio anterior à exclusão**, nunca força `ativo` — e a tela mostra para onde volta (B43); Agente e Automação voltam a `pausado` (B94); Conversa volta a `resolvida`; restaurar exige pai não efetivamente `na lixeira`, com a alternativa de escolher novo pai (RN-LIS-14); Subtarefa cujo pai não é restaurado volta como Tarefa raiz (RN-TAR-28); colisão de nome bloqueia até renomear (B39); Contato/Empresa `mesclado` **não aparecem** (a mesclagem é irreversível — B14).

**Cardinalidade.** Novo pai na restauração: seleção única opcional.

**Estado vazio.** "A lixeira está vazia. Registros excluídos ficam aqui por 30 dias."

**Permissões.** `excluir` para ver e restaurar; `administrar` para eliminar antecipadamente (B46).

---

## T50 · Auditoria — `/configuracoes/auditoria` ⟨01, A6.2⟩

**Propósito.** A visão global dos Registros de Atividade.

**Exibe.** [E] Registro de Atividade: Ator (com tipo), ação, objeto (tipo + nome à época), momento, resultado, **ator delegante**. Filtros por Ator, tipo de Ator, tipo de objeto, período, ação.

**Estados.** Registros são imutáveis e não têm estado (Glossário).

**Ações e regras.** Filtrar; abrir objeto (quando ainda existe e o visualizador tem `ver`). Regras visíveis: o Registro sobrevive à eliminação do objeto, preservando o nome à época (INV-ET-12); **atos de governança registrados** (entrada em contêiner privado) aparecem com o motivo, visíveis a quem tem acesso ao recurso (B38b); eliminação permanente é auditoria, **não** Painel (RN-PAI-30).

**Cardinalidade.** Filtros múltiplos.

**Listas longas.** Ordenação padrão por momento, decrescente; paginação por bloco com [Carregar anteriores]. A contagem total só é exibida quando não depende de permissão por linha (B103).

**Estado vazio.** "Nenhum Registro de Atividade com estes filtros."

**Permissões.** Papel de nível Administrador; cada linha ainda filtrada por `ver` sobre o objeto, quando ele existe.

---

## T51 · Notificações — `/notificacoes` (e o sino da barra global) ⟨transversal⟩

**Propósito.** Reunir o que espera pela pessoa. A contagem do sino na barra global é o mesmo `total` desta tela — e, desde 2026-09-21, também a do item **Notificações** no painel do Trabalho: um derive só (`notificacoesDoMembro`, `data/derive.ts`), filtrado pelo Membro, nos três lugares. **Não é entidade da ontologia** — "notificação não é registro da ontologia" (documento 19, 7.4): é visão derivada de Eventos e Registros de Atividade dirigidos ao Membro logado. Registrado em `PENDENCIAS-FRONTEND.md`, A1. Na barra, o sino e Minhas Tarefas têm o rótulo sempre na árvore acessível (visível de `lg`; `sr-only` abaixo — "Minhas Tarefas — 3 atribuídas, 0 vencidas") e o número só entra depois da hidratação: o HTML do servidor traz o rótulo, nunca a contagem (2026-09-18).

**Exibe.** Itens derivados, agrupados por origem, cada um com Ator e ator delegante, objeto (tipo + nome), momento e o que aconteceu:
- **Aprovações** — Solicitação de Aprovação em que o Membro é aprovador designado ou pode decidir, com prazo (B80).
- **Menções** — em descrição, Comentário ou Mensagem `interna`, sujeitas a `ver` sobre o registro (RN-TAR-14, RN-CXE-22).
- **Responsabilidades** — atribuição e liberação de Responsável, Atribuído e Responsável de Item.
- **Observação** — eventos das Tarefas em que é Observador (Glossário).
- **Propriedade** — o que passou a ser seu por transferência ou sucessão (B28), e Automações que continuam `ativo` sob o seu teto (DO-AUT-14).
- **Execuções e falhas** — Execução `falhou`, disparo recusado por ciclo e referência inválida, para o Proprietário da Automação (RN-AUT-18).
- **Sistema** — Contato restaurado por Mensagem recebida, Adiamento vencido, Documento arquivado por ausência na origem, Item de Memória expirado, Limite atingido.

**Estados.** Nenhum: os itens não têm estado de ciclo de vida. "Lida / não lida" é **estado de sessão do visualizador**, como o Filtro interativo (B103 por analogia) — não é persistido e não sobrevive à troca de Membro.

**Ações e regras.** Abrir o registro (destino: a tela do objeto); marcar como lida; marcar todas como lidas; filtrar por origem. Regras visíveis: cada item é filtrado pela permissão efetiva sobre o **objeto**, avaliada na consulta — um item cujo objeto o Membro deixou de ver **desaparece**, sem contagem residual (B103 por analogia); nenhuma notificação revela nome ou existência de registro sem `ver`; a notificação **não** substitui o Registro de Atividade, que continua em T50 e na aba Atividade do objeto.

**Cardinalidade.** Filtro de origens: múltiplo.

**Listas longas.** Ordenação por momento, decrescente; paginação com [Carregar anteriores].

**Estado vazio.** "Nada novo para você." · Com filtro: "Nada nesta categoria."

**Permissões.** Só o próprio Membro; não existe rota de terceiro.

---

# VII. DIÁLOGOS

Cada um é sobreposição com endereço próprio (ver `MAPA-DE-NAVEGACAO.md` §4). Todos: **confirmar desabilitado até a entrada ser válida**; rejeição não produz efeito parcial.

## D01 · Mapeamento de status — `?mapear-status=`
**Exibe.** Cada Definição de Status **em uso** pelas Tarefas afetadas → seletor de Definição do Conjunto resultante, com a **categoria** de origem e de destino visíveis. Contagem de Tarefas por Definição. Aviso quando a categoria muda ("12 Tarefas passarão de *em andamento* para *concluído* e gerarão o evento de conclusão").
**Regra.** Sem mapeamento completo, a operação é **inválida** (RN-LIS-06). Aplicado no mesmo ato; a categoria nunca muda sem ato explícito (B40). Gera Registro por Tarefa.
**Origem.** Sobrescrever/voltar a herdar Conjunto; alterar Conjunto ancestral; remover Definição em uso; mover Lista, Pasta, Subpasta ou Tarefa.

## D02 · Remapeamento de Etapa — `?remapear-etapa=`
**Exibe.** Etapa a remover (ou Funil a arquivar/excluir) → destino por Etapa, com a contagem de Negócios por situação **e por estado, inclusive `na lixeira`**.
**Regra.** Obrigatório e no mesmo ato; **não** avalia Requisitos de `entrada`; **preserva** a probabilidade sobrescrita; gera Registro com origem `remapeamento`, nunca "avançou" (RN-FUN-08, RN-FUN-10, RN-NEG-05).

## D03 · Mesclar Contatos / Empresas — `?mesclar=`
**Exibe.** Os dois registros lado a lado; escolha do sobrevivente; o que **migra** (Identificadores, Vínculos, Tags, Valores de Campo, Consentimentos, Endereços, componentes) e o que fica no **Estado pré-mesclagem** do absorvido; as referências que serão reapontadas (Conversas, Negócios, Tarefas, âncoras).
**Regra.** Só entre registros `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), por Ator com `administrar` sobre ambos; o sobrevivente resulta `ativo` se um dos dois era; **irreversível** — confirmação por digitação (B14). Se produzir duas Conversas não resolvidas no mesmo Canal, a de Mensagem mais recente permanece e a outra é resolvida com causa "mesclagem" — o diálogo avisa (RN-CXE-10).

## D04 · Remover Membro com Sucessor — `?remover-membro=`
**Exibe.** Seletor de **Sucessor** (Membro `ativo` sem base Convidado; padrão: o ator da remoção). Lista do que será **transferido** (propriedades por tipo; Solicitações de Aprovação pendentes; concessão `administrar` de contêiner privado que ficaria órfã) e do que será **liberado** (Tarefas como Responsável, Itens de Checklist, Conversas como Atribuído). Aviso: "As Sessões de Chat e a Memória do Usuário irão para a lixeira e serão eliminadas em 30 dias."
**Regra.** B28, B87, B38d, RN-ET-09.

## D05 · Transferir propriedade do Espaço de Trabalho — `?transferir-propriedade=`
**Exibe.** Destinatário (Membro `ativo`); Papel que o Proprietário atual passará a ter (padrão: Administrador).
**Regra.** Ato único e atômico; nenhum Administrador transfere nem se autopromove (RN-ET-04). Confirmação por digitação.

## D06 · Ato de governança registrado — `?acesso-governanca=`
**Exibe.** Recurso privado (contêiner, Funil ou Coleção); Sujeito (podendo ser o próprio ator); Ações a conceder; **motivo obrigatório**.
**Como o ator chega ao recurso.** B38a esconde o contêiner privado inclusive do Proprietário do Espaço de Trabalho e dos Administradores, e a ontologia exige que a via de B38b exista sem dizer por onde. A interface adota: o diálogo é aberto **a partir da Auditoria (T50)**, onde os Registros de Atividade do recurso privado aparecem para quem tem o Papel — nome do objeto e ator, nunca conteúdo —, e a partir de um **campo de identificador** para quem recebeu a referência por fora. Não existe listagem navegável de recursos privados. Registrado em `PENDENCIAS-FRONTEND.md`, A7.
**Regra.** Única via de entrada sem concessão prévia; **nunca silenciosa** — gera Registro de Atividade com motivo, visível a quem tem acesso ao recurso (B38b, B61, DO-CNH-11).

## D07 · Encerrar Negócio — `?ganhar=` / `?perder=`
**Exibe.** Ao ganhar: quantia e moeda quando a Regra "exigir valor" está ativa; Motivo de Ganho (opcional); Nota de encerramento. Ao perder: Motivo de Perda quando a Regra o exige; Nota.
**Regra.** Avaliação síncrona e bloqueante para **todo Ator, sem exceção por Papel**; não avalia Requisitos de `saída`; **não altera a Etapa** (RN-NEG-09, RN-FUN-11). Valor vazio e valor zero são rejeitados igualmente quando "exigir valor" está ativa (documento 12, 6.2).

## D08 · Migrar Negócios de Funil — `?migrar-negocios=`
**Exibe.** Funil de destino (`ativo`) e mapeamento explícito de Etapas; contagem por situação e estado.
**Regra.** Arquivar exige migrar os `aberto`; enviar à lixeira exige migrar **todos**, inclusive `na lixeira`; **sem mapeamento por nome ou posição** (RN-FUN-12, RN-FUN-13, RN-FUN-15).

## D09 · Decidir Solicitação de Aprovação — `?aprovar=`
**Exibe.** Objeto fixo em linguagem clara ("Enviar esta Mensagem a *Marina Alves* na Conversa X"), Ferramenta, classe de efeito, Recurso-alvo, solicitante, motivo, prazo, Execução e Cadeia.
**Regra.** Aprovar é aprovar **isto**; as verificações são refeitas na aprovação e podem resultar em "negada"; no motivo `permissão`, só quem tem a permissão requerida aprova (B80, RN-AGE-17).

## D10 · Restaurar cópia de registro `mesclado` — `?restaurar-copia=`
**Exibe.** O Estado pré-mesclagem do absorvido, campo a campo; aviso de que será criado um **registro novo** com Proveniência, e de que o absorvido permanece `mesclado`.
**Regra.** Única saída da mesclagem; **não** reativa o absorvido (RN-CON-15, B14).

## D11 · Transferir Identificador de Contato — `?transferir-identificador=`
**Exibe.** Identificador; Contato de destino; aviso: "Só a resolução futura muda. Conversas e Mensagens passadas permanecem com *Contato de origem*."
**Regra.** Exige `editar` em ambos; Registro nas duas pontas; mover Conversas específicas é **ato separado** (DO-CON-12, RN-CON-09).

## D12 · Mover Conversa para outro Contato — `?mover-conversa=`
**Exibe.** Contato de destino; aviso sobre Conversa não resolvida existente no mesmo Canal.
**Regra.** Exige `editar` na Conversa e `ver` em ambos os Contatos; **rejeitado** se o destino já tiver Conversa não resolvida no mesmo Canal, salvo resolução no mesmo ato (RN-CXE-11, RN-CXE-10).

## D14 · Excluir Papel personalizado — `?excluir-papel=`
**Exibe.** Papel a excluir; contagem e lista dos **titulares** (Membros e Agentes); seletor de **Papel de destino** para cada grupo de titulares, com a base do destino visível; aviso do que muda em permissões efetivas.
**Regra.** A ontologia exige, no evento de remoção, o **Papel de destino dos titulares** (documento 01, 18). Confirmar desabilitado enquanto houver titular sem destino — mesmo padrão de D01. Papéis de sistema **não** são excluíveis (RN-ET-06). Destino de Agente nunca pode ser Proprietário, Administrador nem base neles (INV-ET-13). Aplicado no mesmo ato, com Registro de Atividade por titular.

## D15 · Importar Contatos — `?importar-contatos=`
**Exibe.** Quatro passos: (1) arquivo e mapeamento de colunas para atributos e Identificadores; (2) **escolha explícita para colisões** — "rejeitar a linha" ou "tratar como atualização do Contato existente"; (3) Proprietário dos Contatos criados (padrão: o ator) e Origem a atribuir; (4) pré-visualização com as primeiras linhas já classificadas.
Durante: **progresso** com contagem ("312 de 2.000 linhas"). Ao fim: **resultado** com o balanço ("1.847 criados · 61 tratados como atualização · 92 rejeitados") e a lista navegável dos rejeitados com o motivo por linha.
**Regra.** A ontologia define a importação: "cada linha é um Contato; linhas cujo Identificador colide com um Contato existente são **rejeitadas ou tratadas como atualização, conforme escolha explícita do ator na importação**, nunca criam duplicata"; Proprietário = o Membro indicado, padrão o ator (documento 10, 12.1). O **Modo de criação** dos Contatos criados é `importação`, imutável (documento 10, 6). Nenhuma linha cria duplicata de Identificador (RN-CON-11). A importação conta para o **Limite imposto de Contatos**, verificado no ato: atingido o limite, a importação para com o balanço parcial e o evento "Limite atingido" (RN-CON-20, RN-ET-23). Confirmar desabilitado até a escolha de colisão estar feita.

## D13 · Converter Item de Checklist em Subtarefa — `?converter-item=`
**Exibe.** Item; Tarefa pai da Subtarefa (padrão: a Tarefa do Checklist; alternativas: o pai dessa Tarefa, ou nenhum, na mesma Lista); aviso de que Subitens migram como Checklist da nova Subtarefa e de que o Item fica `convertido`, terminal e fora do progresso.
**Regra.** Ato único, **sem conversão inversa**; **rejeitado antes de qualquer efeito** se resultar em nível além da Profundidade máxima (B48, RN-CHK-10).

---

Os diálogos abaixo entraram em 2026-09-17 (Lista conversacional e os fluxos de criação da IA). Só D16, D17 e o atalho de D22 têm parâmetro de URL; os demais abrem por botão ou menu da tela de origem e vivem em estado dela (`ConfirmDialog`, `wide` quando há seções). Em todos, o botão de confirmar desligado repete a recusa que a operação daria (`confirmDisabledReason`) e o erro da operação aparece em `<p role="alert">` sem fechar o diálogo.

## D16 · Nova Lista — `?criar=lista:<tipoDoPai>:<idDoPai>`
**Origem.** O "+" da árvore, do Espaço (T06) e da Pasta (T08).
**Canais de atendimento (C36, 2026-09-22).** Escolhido o modelo conversacional, entra o bloco **Canais de atendimento** logo abaixo: quatro linhas — WhatsApp, E-mail, Instagram, LinkedIn —, cada uma com o seu Toggle; ligar abre as contas já conectadas no Espaço de Trabalho daquele tipo, como caixas de marcar com o nome, o identificador (quando difere do nome), o **Setor** (Fila padrão) e a **Origem** padrão, e o botão **Adicionar {tipo}** (D33). Conta desconectada não se marca ("Desconectado — reconecte nas configurações da Caixa de Entrada."); "Criar" fica desligado com "Ative ao menos um canal de atendimento." até haver uma conta marcada; voltar a operacional apaga a escolha.
**Exibe.** Nome; Descrição; **Modelo de Tarefa** (`SeletorDeModelo`: `radiogroup` com duas peças `role="radio"` — **Operacional** "A Tarefa de gestão: título, Status, Responsável e datas — sem Contato nem conversa." e **Conversacional** "Cada Tarefa nasce de um Contato e traz a conversa dele; a Lista tem acesso ao CRM." —, só quando o tipo é Lista; dica "Depois que a Lista tiver Tarefas, o modelo não muda."); Localização; Template de Lista; Privada.
**Operação.** `createList` (ou `instantiateListTemplate` quando o Template traz configuração), com `modeloDeTarefa`; ausente, `operacional`. O Registro de Atividade da criação diz "Modelo conversacional: cada Tarefa nasce de um Contato".
**Regra.** O modelo é atributo nativo da Lista, não aspecto herdável (C35); muda depois só em T11, enquanto ela está vazia.

## D17 · Nova Tarefa conversacional — `?nova-tarefa=1` na Lista conversacional (T10); botão da Caixa de Entrada (T21) e da ficha do Contato (T14)
**Tipo de Tarefa (2026-09-22).** O diálogo traz o campo **Tipo de Tarefa** ao lado do Título quando a Lista enxerga mais de um ("O Tipo padrão da Lista" é a opção vazia); `criarTarefaConversacional` recebe `taskTypeId` e repassa a `createTask`.
**Exibe.** `NovaTarefaConversacionalDialog`: **Lista** (só quando não vem fixa: as Listas conversacionais ativas ao alcance do Membro, **excluídas as cópias do Funil** — ali a Tarefa nasce pelo Negócio, em "Iniciar conversa"; sem nenhuma: "Crie uma Lista com o modelo conversacional primeiro." ou, se só há cópias do Funil, "Nas cópias do Funil a Tarefa nasce pelo Negócio, em “Iniciar conversa”: crie uma Lista conversacional própria."); **Contato** (obrigatório; fixo quando vem da Conversa ou da ficha — "O Contato é o desta conversa."); **Canal** (obrigatório; só os Canais ativos que alcançam um Identificador do Contato — `canaisQueAlcancam` —, preenchido sozinho quando só um alcança; desconectado aparece com "desconectado"; sem nenhum: "Acrescente um Identificador ao Contato que um Canal alcance."); Título (opcional — vazio, o nome do Contato); Status (o inicial da Lista, ou o do "+" que abriu); Responsável (padrão: quem cria); **Negócio** (opcional: um Negócio aberto do Contato).
**Operação.** `criarTarefaConversacional`: abre (ou reaproveita) a Conversa no Canal e cria a Tarefa com os Vínculos Contato · Conversa · Negócio (papéis "contato da Tarefa", "conversa da Tarefa", "Negócio da Tarefa") e Proveniência `contact`; recusada a Tarefa, a Conversa é desfeita. Recusas: "Esta Lista é operacional: a Tarefa nasce pelo título, sem Contato.", "Escolha um Contato ativo.", "Escolha o Canal em que a conversa acontece.", "O Canal X está desconectado: escolha outro Canal ou reconecte-o.", "Este Negócio não é deste Contato.", e a de Identificador que a Conversa dá.
**Regra.** RN-TAR-15 (Vínculos), C35. Na Lista, a Tarefa criada abre no popup no lugar do diálogo. O diálogo volta aos props a cada abertura (2026-09-18): o "+" de um grupo abre no Status dele, o botão no inicial da Lista.

## D18 · Nova Habilidade — `/ia/personalizar/habilidades` › [Nova Habilidade]
**Exibe.** Nome (único entre as Habilidades — RN-HAB-02); Descrição. "Nasce ativa, com a Versão 1 em rascunho: escreva as instruções, publique e conceda a um Agente." — [Criar e abrir] leva à ficha (T30), que chega com o Toast "Habilidade “X” criada, com a Versão 1 em rascunho." (`marcarChegada`, 2026-09-18 — o mesmo em D19, D24, D25 e no Duplicar da Automação).
**Operação.** `criarHabilidade` ("Dê um nome à Habilidade.", "Já existe uma Habilidade chamada “X”.", "O Papel Convidado não cria Habilidade.").

## D19 · Copiar da plataforma — `/ia/personalizar/habilidades` › [Copiar da plataforma]; ficha da Habilidade da plataforma (T30) › "Copiar para o Espaço de Trabalho"
**Exibe.** Habilidade (só as da plataforma; fixa quando vem da ficha); Versão (a corrente por padrão; qualquer publicada). "A cópia é uma Habilidade nova do Espaço de Trabalho: Versão 1 em rascunho idêntica à Versão escolhida, com Proveniência e sem vínculo vivo (DO-HAB-07). As Concessões não migram."
**Operação.** `copiarHabilidadeDaPlataforma` ("Só uma Habilidade da plataforma é copiada por aqui; as do Espaço de Trabalho são editadas.", "A Habilidade da plataforma não tem Versão publicada para copiar."). Nome `X (cópia)`; nada é exercível sem publicar (RN-HAB-05).

## D20 · Conceder Habilidade — menu do cartão e ficha da Habilidade (T30) › "Conceder a um Agente"; ficha do Agente (T28) › [Conceder]
**Exibe.** Agente (fixo quando vem da ficha do Agente; senão os que o Membro governa — `agentesGovernaveisPor`; sem nenhum, o Select fica desligado com o motivo); Habilidade (fixa quando vem da Habilidade — entra mesmo sem Versão publicada, com "sem Versão publicada" e o aviso de que a Concessão nasce indisponível; senão só ativa com Versão publicada); Versão (seguir a corrente, ou fixar uma publicada — RN-HAB-03); o **Efeito declarado**; aviso RN-HAB-11 quando o efeito é externo ou irreversível num Agente autônomo; aviso "A Concessão nascerá indisponível até permitir …" quando uma Ferramenta obrigatória não está permitida — antecipa, não bloqueia.
**Operação.** `concederHabilidade` ("Um Agente arquivado ou na lixeira não recebe Concessões.", "Só uma Habilidade ativa é concedida.", "Esta Habilidade já está concedida a este Agente.", "Só uma Versão publicada pode ser fixada (RN-HAB-03)."); cria a Versão seguinte do Agente com o motivo "Habilidade “X” concedida" (D8, RN-AGE-06). Quem abre o diálogo (ficha e cartão da Habilidade) diz por que não pode, na ordem da operação: "Só uma Habilidade ativa é concedida." → "O Papel Convidado não edita Agente." → "Você não governa nenhum Agente que possa receber Concessões." (`recusaDeConcederAAlgumAgente`, 2026-09-18).

## D21 · Permitir Ferramenta — `/ia/personalizar/plugins` › "Dar a um Agente" (Ferramenta fixa); ficha do Agente (T28) › [Permitir] (Agente fixo)
**Exibe.** Agente; Ferramenta (classe de efeito e Recurso-alvo); aviso "Permitir uma Ferramenta não concede permissão sobre nenhum registro" (DO-HAB-14); aviso B22 quando é externa ou irreversível num Agente autônomo; aviso "A Integração X está desconectada: a Ferramenta fica permitida e inoperante até reconectar (7.7)".
**Operação.** `permitirFerramenta` ("A Ferramenta “id” não existe no Catálogo.", "Esta Ferramenta já está permitida ao Agente.", "Restaure o Agente antes de editar."); cria a Versão N+1 do Agente ("Ferramenta “X” permitida"). Retirar é o menu da ficha (`retirarFerramenta`), sem diálogo.

## D22 · Ensaiar — ficha do Agente (T28) › [Ensaiar] ou `?ensaiar=1` (atalho do catálogo)
**Exibe.** Pedido (obrigatório; "Respondido com as instruções da Versão N."); Âncora opcional (uma Tarefa, um Negócio ou um Contato ativo — DO-AGE-09). Ao concluir, leva à Execução.
**Operação.** `ensaiarAgente`: uma Execução real gravada com `rehearsal`, origem `acaoDireta`, Versão e Modelo resolvidos; passos determinísticos — o raciocínio e uma chamada por Ferramenta permitida (leitura `concluido`, escrita `simulado` "Escrita não aplicada: ensaio (B82)"), Referências de Conhecimento até 3 quando `consultar_conhecimento` está permitida e há Coleção concedida; nunca grava Memória; Modelo descontinuado → nasce e termina `falhou` (RN-AGE-08). Recusas: "Só um Agente em rascunho ou ativo ensaia (DO-AGE-13).", "Escreva o pedido do ensaio.", "Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer."
**Regra.** B82; a única Execução que um rascunho admite (RN-AGE-10). O Modelo não executa (P14). `?ensaiar=1` é lido uma vez e limpo da URL na chegada: voltar da Execução não reabre o diálogo (2026-09-18).

## D23 · Transferir Agente — ficha do Agente (T28) › "Transferir propriedade…"
**Exibe.** Novo Proprietário (Membro ativo sem base Convidado — RN-AGE-04). É governança: não cria Versão.
**Operação.** `transferirAgente` ("O Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33).", "O novo Proprietário precisa ser um Membro ativo sem base Convidado (RN-AGE-04).", "Este Membro já é o Proprietário.").

## D24 · Nova Coleção — `/ia/personalizar/conhecimento` › [Nova Coleção]
**Exibe.** Nome (único — RN-CNH-02); Descrição; Toggle **Privada**. "Nasce com a Fonte Envio manual" — [Criar e abrir] leva à ficha (T34).
**Operação.** `criarColecao`: Coleção `ativo`, Proprietário quem cria, Fonte Envio manual no mesmo ato (RN-CNH-04), Política de retenção padrão ("Dê um nome à Coleção.", "Já existe uma Coleção chamada “X”.", "O Papel Convidado não cria Coleção.").

## D25 · Adicionar Documento — ficha da Coleção (T34) › [Adicionar Documento]; menu do cartão em Personalizar
**Exibe.** `wide`: Coleção (fixa da ficha, ou escolhível do catálogo); Título; Rótulos (separados por vírgula — Metadado, mudam sem Versão); abas de origem **Colar texto** (cada parágrafo vira um Fragmento) · **Endereço web** (captura simulada: um Fragmento com a página) · **Arquivo** (só nome, tamanho e tipo saem do navegador; até 25 MB; áudio e vídeo ficam `pendente`).
**Operação.** `adicionarDocumento`: Documento `ativo` com a Versão 1, Fragmentos simulados (D9), Fonte = Envio manual da Coleção e Proveniência `fonte` com a origem específica ("Cole ou escreva o texto do Documento.", "O arquivo passa de 25 MB.", "Dê um título ao Documento.", "Restaure a Coleção antes.").

## D26 · Nova Fonte — ficha da Coleção (T34) › "Nova Fonte"
**Exibe.** Tipo (**URL** ou **Integração**); Nome; Endereço (começa por http:// ou https://) ou Integração (uma desconectada faz a Fonte nascer `com erro` — o diálogo avisa, não recusa); Política de atualização (**Manual** "atualiza quando alguém pede" · **Periódica** "atualiza a cada N horas", com Intervalo em horas).
**Operação.** `adicionarFonte` ("Dê um nome à Fonte.", "O endereço da Fonte começa por http:// ou https://.", "A Integração indicada não existe neste Espaço de Trabalho.", "A Política periódica precisa de um intervalo em horas maior que zero."). A Envio manual ninguém adiciona (RN-CNH-04). A Fonte não sincroniza (P16).

## D27 · Dar acesso a Agente — ficha da Coleção (T34) › "Dar acesso a um Agente"; menu do cartão; ficha do Agente (T28) › [Conceder] em Conhecimento acessível
**Exibe.** Coleção (fixa ou escolhível); Agente (fixo ou escolhível); **Ações** (`ver` obrigatória — "sem ela não há consulta" —, `criar` e `editar` "só valem por Ferramenta com permissão").
**Operação.** `concederColecao` ("Toda concessão a Agente inclui ver (17.3).", "Este Agente já tem acesso a esta Coleção: revogue e conceda de novo para mudar as ações.", "Um Agente na lixeira não recebe acesso."). A Concessão vive na Coleção; o Agente a exibe como visão derivada (DO-CNH-12). Não cria Versão de Agente.

## D28 · Nova Versão de Documento — ficha do Documento (T35) › [Nova Versão]; menu do Documento na Coleção (T34)
**Exibe.** Título "Nova Versão (vN+1)"; abas **Colar texto** · **Arquivo** (a captura de URL é da Fonte, não da edição).
**Operação.** `novaVersaoDoDocumento`: Versão N+1 com origem `edicao`, torna-se corrente no ato, a anterior recebe "Superada em" e guarda os Fragmentos (RN-CNH-12, RN-CNH-13). Recusa: "Um Documento arquivado não recebe Versão nova."

## D29 · Mover Documento — ficha do Documento (T35) › "Mover para outra Coleção"; menu do Documento na Coleção (T34)
**Exibe.** Coleção de destino ("Sai de “X”."; só ativas e diferentes da origem).
**Operação.** `moverDocumento` ("Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08)."). Identidade, Versões, Comentários e Proveniência acompanham; a permissão passa a ser a do destino.

## D30 · Nova Automação — `/ia/personalizar/automacao` › [Nova Automação]
**Exibe.** `wide`: Nome; Descrição; **Escopo** (tipo — Espaço de Trabalho, Espaço, Pasta, Lista, Funil, Caixa de Entrada, Fila, Grupo, Comunidade, Flow — e o registro; "Fixado na criação e nunca mudado depois (RN-AUT-02)"); **Gatilho inicial** opcional (tipo e, por evento, só os Eventos que ocorrem no escopo — `eventosDoEscopo` —, cada um dizendo se "executa no protótipo"). [Criar e abrir o editor].
**Operação.** `criarAutomacao`: rascunho com a Versão 1 em rascunho, Proprietário quem cria ("Dê um nome à Automação.", "O escopo indicado não existe.", "Já existe uma Automação chamada “X” neste escopo (RN-AUT-03).", "O Evento “X” não ocorre no escopo desta Automação.", "O Papel Convidado não cria Automação.").

## D31 · Publicar Versão — ficha da Habilidade (T30) › [Publicar vM]; editor da Automação (T32) › [Publicar vN]
**Exibe.** Habilidade: "a nova passa a ser a corrente; a publicada anterior **permanece** publicada, exercível pelas Concessões que a fixaram, até ser obsoletada (B71)", o Efeito declarado (RN-HAB-11) e, havendo problemas de validação, a lista com a regra de cada um e o botão desligado. Automação: o que a Versão faz (Gatilho, Condições, Ações); "A Versão N, hoje publicada, passa a obsoleta no mesmo ato" ou, em rascunho, "a Automação passa a ativa: a partir daqui o Gatilho dispara Execuções reais"; os problemas de `validarAutomacao` desligam o botão com o mesmo motivo que `publishAutomation` responderia.
**Operação.** `publicarVersaoDaHabilidade` ("O rascunho tem n problema(s) de validação. Corrija antes de publicar (RN-HAB-06)." — e o Registro "Validação falhou"; "Publicar e obsoletar exigem administrar esta Habilidade: o Criador ou um Administrador.") · `publishAutomation` (o primeiro problema, com `field` = bloco; DO-AUT-19).

## D33 · Adicionar Canal — o botão "Adicionar {tipo}" do bloco Canais de atendimento (D16, T11)
**Origem.** O bloco **Canais de atendimento** do diálogo de criação da Lista conversacional (D16) e das Configurações da Lista (T11). No D16 o diálogo de criação se apaga enquanto este está no ar (os diálogos não empilham) e volta com a conta nova já marcada.
**Exibe.** Título "Adicionar WhatsApp" (ou E-mail, Instagram, LinkedIn — o tipo vem da linha que pediu; sem ele, um campo "Tipo de Canal"); **Nome** (como a conta aparece na Caixa de Entrada); o **identificador do tipo**, com rótulo, exemplo e dica próprios — Número com o código do país, Endereço de e-mail, Usuário do Instagram (com ou sem @), Página ou perfil do LinkedIn (company/… ou in/…, ou o endereço completo); **Setor** (a Fila padrão: "Nenhum — a Conversa nasce sem Fila" ou uma Fila ativa); **Origem** (Nenhuma ou uma Origem do catálogo).
**Operação.** `criarCanal`: Administrador (B35) → nome → forma canônica do identificador ("O número com o código do país…") → nome único entre ativos (RN-CXE-31: "Já existe um Canal chamado “X”.") → a mesma conta não conecta duas vezes (INV-CXE-01: "Esta conta já está conectada como “X”.") → Fila e Origem válidas. Nasce **conectada** (o protótipo simula o provedor — C36), com Atividade "Canal conectado". O botão fica desligado com a frase de cada recusa antes do clique; quem não administra o Espaço de Trabalho vê "Adicionar" desligado com o motivo.
**Regra.** Um Canal é da Caixa de Entrada, não da Lista: a conta nova passa a existir para todo o Espaço de Trabalho e fica marcada na Lista que a criou.

## D32 · Desconectar Integração — `/ia/personalizar/conectores` e `/configuracoes/integracoes` (T48) › menu "Desconectar…"
**Exibe.** "As Ferramentas que ela expõe seguem permitidas aos Agentes e ficam inoperantes até reconectar; nada é retirado em silêncio (18, 7.4)." e o **impacto** contado (`impactoDaIntegracao`): n Ferramentas inoperantes (nomeadas), n Habilidades com Concessão indisponível, n Fontes de Conhecimento com erro (nomeadas com a Coleção) — a mesma contagem que o Registro de Atividade grava. Confirmação destrutiva. Conectar/Reconectar é ato direto, sem diálogo, com o aviso do que volta a operar.
**Operação.** `desconectarIntegracao` / `conectarIntegracao` ("Conectar ou desconectar uma Integração é ato de Administrador (B35).", "A Integração já está desconectada.", "A Integração já está conectada."). Desconectar torna `com erro` as Fontes que a referenciam (20.6); reconectar as devolve a `ativo`.
