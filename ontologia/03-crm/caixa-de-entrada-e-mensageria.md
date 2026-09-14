# CAIXA DE ENTRADA E MENSAGERIA

> Domínio: CRM | Documento 14 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Caixa de Entrada** é a **camada de operação conversacional do CRM**: a entidade, única por Espaço de Trabalho (B11), que contém os **Canais** pelos quais a organização conversa com o exterior, as **Filas** que organizam quem atende, e todas as **Conversas** — com suas Mensagens, Participantes e Anexos — havidas entre a organização e os seus Contatos. É o lugar onde a comunicação externa deixa de ser fato solto (uma mensagem que chegou a um número) e passa a ser registro operável (uma Conversa com Contato, estado, Atribuído e histórico).

Quatro propriedades a distinguem de qualquer outra entidade da ontologia:

1. **É única e estrutural.** Nasce com o Espaço de Trabalho, nunca é excluída e nunca é duplicada (INV-ET-08). Não é "uma das caixas": é *a* camada conversacional da organização. Segmentação operacional (Comercial, Suporte, Unidade Norte) é feita por Fila, nunca por múltiplas Caixas (B11; C4).
2. **É raiz de contenção de tudo o que é conversacional.** Canal, Fila, Conversa, Mensagem, Participante e Anexo não têm existência fora dela (A2.5). Contato, Empresa, Negócio e Tarefa relacionam-se com Conversas, mas não as contêm: a Conversa pertence à Caixa de Entrada e apenas **referencia** o Contato (DO-CON-09).
3. **É o ponto de entrada de fatos externos.** Toda Mensagem `recebida` entra na plataforma por um Canal da Caixa de Entrada e é resolvida a um Contato por Identificador de Contato (B13). É a única porta pela qual alguém de fora "fala" com a organização; por isso continua a persistir Mensagens mesmo com o Espaço de Trabalho `suspenso` (B31).
4. **Não tem Proprietário e não é Ator.** A Caixa de Entrada é infraestrutura organizacional, como a Integração (B35): quem responde por uma Conversa é o seu Atribuído; quem responde por um Contato é o Proprietário do Contato; quem configura a Caixa é o Administrador. Nada "pertence" à Caixa no sentido de governança humana.

A Caixa de Entrada não é uma tela de mensagens, não é um Canal, não é uma Fila, não é o Chat com a IA e não é um "e-mail corporativo". É a entidade que dá contexto, estado e responsabilidade a cada episódio de comunicação com um Contato.

Este documento também define as entidades internas que **não recebem documento próprio** (A2.5): Canal (e suas especializações por Tipo de Canal — A2.4), Fila, Conversa, Mensagem, Participante e Anexo, além dos papéis Atendente, Remetente e Destinatário e dos objetos de valor que os acompanham.

## 2. Propósito

1. **Converter comunicação em operação.** Uma mensagem no WhatsApp da empresa é um fato; sem Caixa de Entrada, ninguém sabe quem a viu, quem responde, se foi resolvida. A Conversa, com estado, Fila e Atribuído, é a unidade que torna a comunicação gerenciável e mensurável (tempo de primeira resposta, Conversas abertas por Atendente).
2. **Unificar Canais em um só lugar.** WhatsApp, Instagram, E-mail e Chat do site têm protocolos, limites e capacidades diferentes. A Caixa de Entrada os abstrai como Canais de Tipos distintos, com a mesma Conversa, a mesma Mensagem e o mesmo Contato do outro lado, para que Atendentes, Automações, Agentes e Painéis raciocinem sobre "a Conversa com a Camila" e não sobre "o número da Camila".
3. **Distribuir trabalho conversacional.** Filas respondem "quem atende isto": elegíveis, regra de distribuição, Fila padrão por Canal. É o mecanismo pelo qual uma organização com vinte Atendentes e três Canais não depende de alguém "olhar a caixa".
4. **Ancorar a mensageria no CRM.** Toda Conversa tem exatamente um Contato principal (B12); por ele, deriva-se a Empresa (DO-EMP-08), vinculam-se Negócios e Tarefas (A8) e constrói-se a linha do tempo do relacionamento (documento 10, 8.1). A Caixa de Entrada é o que faz o CRM ter "o que foi dito", e não só "o que foi vendido".
5. **Ser o palco da IA conversacional sem confundi-la com o Chat.** Agentes podem ser Atribuídos a Conversas (B7) e Automações reagem aos seus eventos (B41), sob as mesmas permissões que humanos (A6.3). A Sessão de Chat (IA) é outra coisa: um Membro conversando com a IA. Este documento separa as duas com rigor (seção 4).

## 3. Natureza da entidade

### 3.1 Caixa de Entrada

- **Entidade com identidade própria**, singular por Espaço de Trabalho, em **composição 1:1** com ele (documento 01, 8): criada no ato atômico de criação do Espaço de Trabalho (RN-ET-02), com o mesmo ciclo de vida, sem estado próprio distinto do dele.
- **Raiz do agregado conversacional**: garante a consistência de Canais, Filas e Conversas (e, transitivamente, de Mensagens, Participantes e Anexos) — por exemplo, "no máximo uma Conversa não resolvida por (Contato, Canal)" é invariante que só a Caixa pode sustentar, porque envolve Conversas de qualquer Fila.
- **Escopo de Automação** (B41) e **Fonte de Dados de Painel** ("Conversas de uma Fila", Glossário).
- **Recurso de permissão** para ações de configuração (seção 17). **Não é Ator** (A6.1): quem age é o Canal (Integração), o Membro, o Agente, a Automação ou o Sistema.
- **Não tem Proprietário** (A7 não a lista). **Não tem Criador** distinto do Criador do Espaço de Trabalho. **Não é objeto de valor, não é domínio, não é Canal, não é Fila.**

### 3.2 Entidades internas

| Entidade | Natureza | Identidade | Existe sem a raiz imediata? |
| --- | --- | --- | --- |
| **Canal** | Entidade contida pela Caixa de Entrada; **especialização de Integração** (B35; documento 01, 7.4); Ator (A6.1). | Própria, opaca, imutável. | Não. Sem a Caixa não há Canal. |
| **Fila** | Entidade contida pela Caixa de Entrada; configuração operacional com identidade (referenciada por Conversas, Canais, Automações, Painéis). | Própria, opaca, imutável. | Não. |
| **Conversa** | Entidade contida pela Caixa de Entrada; raiz do subagregado Mensagens + Participantes; referencia Contato, Canal, Fila, Atribuído. | Própria, opaca, imutável. | Não. |
| **Mensagem** | Entidade interna da Conversa (**composição**); imutável salvo marcação de exclusão. | Própria (referenciada por outras Mensagens, por Consentimentos, por Registros de Atividade). | Não. Sem Conversa não há Mensagem. |
| **Participante** | Entidade interna da Conversa; presença de um Contato, Membro ou Agente na Conversa, com papel e momentos. | Própria dentro da Conversa. | Não. |
| **Anexo** | Referência de Mensagem a Arquivo (A8); componente da Mensagem. | Sem identidade além da Mensagem que o contém. | Não. |
| **Atendente, Remetente, Destinatário** | **Papéis**, não entidades (seção 7.8, 7.9). | — | — |
| **Adiamento, Rascunho, Endereços adicionais, Horário de atendimento, Capacidades do Tipo de Canal, Configuração de mensagens de modelo, Disponibilidade de atendimento, Leitura interna, Reação** | **Objetos de valor** (seção 7). | — | — |

Todas obedecem a A1.1: pertencem, transitivamente, a exatamente um Espaço de Trabalho, e nenhuma relação delas cruza a fronteira (INV-ET-07).

## 4. Fronteira conceitual

### O que é

- A camada única de operação conversacional da organização: Canais conectados, Filas de atendimento e todas as Conversas com Contatos.
- A raiz de contenção de Conversas, Mensagens, Participantes e Anexos.
- O ponto em que fatos externos (Mensagens recebidas) se tornam registros do CRM resolvidos a Contatos.
- Um escopo de Automações (B41) e de Fontes de Dados de Painel.

### O que não é

- **Não é um Canal.** Canal é uma conta conectada (um número, uma conta de Instagram, um endereço de e-mail, um site). A Caixa de Entrada contém 0..N Canais; existe vazia, sem nenhum.
- **Não é uma Fila.** Fila é agrupamento operacional dentro da Caixa; existem 0..N. "Caixa de Entrada do Suporte" é uma Fila chamada Suporte.
- **Não é o Chat da IA.** A Sessão de Chat é interação de um Membro com a IA (B21); a Conversa é interação da organização com um Contato. Vocabulário distinto por decisão (Glossário: "chat" não se usa para CRM; "Conversa" não se usa para IA).
- **Não é o Contato nem a Empresa.** Referencia-os; não os contém.
- **Não é uma Lista nem uma Tarefa.** Conversa não é Tarefa: comunicação externa versus trabalho interno (documento 06, 4). Uma Conversa pode gerar Tarefas por Vínculo (seção 8.5).
- **Não é uma Integração genérica.** Integrações que não são Canais (ERP, calendário, assinatura) pertencem diretamente ao Espaço de Trabalho (documento 01, 7.4).
- **Não é caixa de e-mail pessoal.** Um Canal E-mail é um endereço da organização conectado à Caixa; e-mails pessoais de Membros não passam pela plataforma.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Caixa de Entrada × Canal** | Entidade única, raiz de contenção de Canais, Filas e Conversas; sem Tipo de Canal; nunca conectada ou desconectada; criada com o Espaço de Trabalho. | Conta conectada de um Tipo de Canal; Integração (Ator); tem estado de conexão, identificador externo, credenciais, Fila padrão; 0..N por Caixa. | A Caixa é o contêiner; o Canal é a porta. Desconectar todos os Canais não altera a Caixa; a Caixa não "recebe" nada por si — recebe por Canais. |
| **Canal × Tipo de Canal** | Instância corporativa: um número de WhatsApp da Clínica Vida; pertence à Caixa de Entrada; tem credenciais, estado, Fila padrão, configuração (mensagens de modelo). | Enumeração global da plataforma (A1.3): WhatsApp, Instagram, E-mail, Chat do site; declara **capacidades** (anexos, janela de resposta, assunto/cópia, mensagens de modelo, grupos) e quais Tipos de Identificador resolve. | O Tipo de Canal é referenciado, nunca possuído (INV-ET-07 não se aplica: é global). Dois Canais do mesmo Tipo (dois números) são duas contas com as mesmas capacidades. As capacidades são da plataforma; a configuração é do Canal (7.2). |
| **Canal × Integração** | Integração especializada para mensageria: além de nome, tipo, estado, credenciais e Membro configurador, tem Tipo de Canal, identificador externo, Fila padrão e produz Mensagens; contido pela Caixa de Entrada. | Conexão configurada com sistema externo, pertencente diretamente ao Espaço de Trabalho; pode expor Ferramentas; qualquer finalidade. | Todo Canal é Integração (herança de atributos, estados e regras — documento 01, 7.4, B35); nem toda Integração é Canal. A diferença ontológica é o que produz: Canal produz Conversas e Mensagens; Integração genérica produz o que o seu documento definir. Nenhum dos dois tem Proprietário. |
| **Conversa × Mensagem** | Episódio com identidade, estado (`aberta`, `pendente`, `resolvida`), Contato principal, Canal, Fila, Atribuído, Participantes; raiz do subagregado; reabrível. | Unidade de comunicação dentro de uma Conversa; direção, remetente, conteúdo, Anexos, status de entrega; imutável; sem estado de conversa. | Conversa é o "quando e com quem"; Mensagem é o "o quê". Uma Conversa sem Mensagens não existe (INV-CXE-05); uma Mensagem sem Conversa não existe (composição). Resolver a Conversa não altera nenhuma Mensagem. |
| **Conversa × Sessão de Chat (IA)** | Entidade da Caixa de Entrada (CRM); entre a **organização** e exatamente um **Contato** principal por um **Canal**; Mensagens com direção e status de entrega; Atribuído 0..1; Fila; estado de conversa (A4.5); visível a quem tem `ver` na Conversa; sem Proprietário; sobrevive à saída de qualquer Membro; nunca pessoal. | Entidade do domínio IA (B21); entre um **Membro** e a **IA**; Mensagens de Chat com papel (`usuário`, `assistente`, `sistema`, `ferramenta`); Modelo; Contexto; Agente principal 0..1; **pessoal ao Membro** (Proprietário), invisível a outros salvo compartilhamento; pode ser **ancorada** a uma Conversa (Âncora). | O outro lado da Conversa é uma pessoa externa; o outro lado da Sessão é a IA. A Conversa é fato do relacionamento da organização; a Sessão é ferramenta de trabalho de uma pessoa. Uma Sessão ancorada em uma Conversa **lê** a Conversa (com as permissões do Membro, A9.3) e pode **produzir um Rascunho** (7.10) para ela; nunca envia nada ao Contato por si — enviar é ato na Conversa, por Membro ou Agente Atribuído, que gera Mensagem. Nenhuma Mensagem de Chat vira Mensagem sem ato explícito. Uma Conversa nunca contém Mensagens de Chat; uma Sessão nunca contém Mensagens. |
| **Mensagem × Mensagem de Chat** | Unidade de comunicação com o Contato (ou nota interna); pertence à Conversa; tem direção, status de entrega, identificador externo do provedor; sujeita ao Tipo de Canal (janela, modelo). | Unidade de interação com a IA; pertence à Sessão de Chat; tem papel; sem entrega; sem Contato. | Vocabulário canônico distinto (Glossário). O único caminho entre elas é o Rascunho: uma Mensagem de Chat `assistente` pode ser copiada para o Rascunho da Conversa; ao ser enviada, nasce uma Mensagem nova, com Proveniência opcional para a Sessão. |
| **Mensagem × Comentário** | Vai ao Contato (`enviada`), vem do Contato (`recebida`) ou fica entre Atores internos dentro de uma Conversa (`interna`); pertence à Conversa; imutável. | Manifestação de um Ator sobre um registro (Tarefa, Negócio, Contato, Empresa, Documento — A8); nunca vai ao Contato; editável pelo autor; respostas em um nível (DO-TAR-07). | **Conversa não recebe Comentários**: o que seria "comentar a Conversa" é uma Mensagem `interna` (nota interna), que fica na sequência da Conversa, no seu momento, visível a Atores internos (DO-CXE-08). Comentário no Contato sobre a Conversa é possível, mas pertence ao Contato. |
| **Conversa × Negócio** | Episódio de comunicação; sem valor econômico, sem Funil, sem Etapa; estado de conversa; Atribuído; vive na Caixa de Entrada. | Oportunidade comercial com valor, Funil, Etapa, situação, Proprietário; vive no Espaço de Trabalho. | Relação por **Vínculo Conversa-Negócio**, 0..N em ambos os sentidos (A8): uma Conversa pode tratar de dois Negócios; um Negócio pode ter dezenas de Conversas. Nenhum contém o outro; resolver a Conversa não fecha o Negócio; ganhar o Negócio não resolve a Conversa. |
| **Fila × Funil** | Agrupamento operacional de Conversas com elegíveis e regra de distribuição; não ordenada; responde "quem atende"; Conversa em 0..1 Fila, mutável por transferência. | Sequência ordenada de Etapas que Negócios percorrem; responde "em que ponto está"; Negócio em exatamente 1 Funil (B9). | Fila e Funil não se referenciam (documento 13, 4). Uma Conversa vinculada a um Negócio pode estar na Fila "Suporte" enquanto o Negócio está em "Negociação": são dimensões independentes. Fila não tem Etapas; Funil não tem elegíveis. |
| **Fila × Equipe** | Entidade da Caixa de Entrada; agrupa **Conversas**; tem elegíveis (Membros e Equipes), regra de distribuição, Proprietário padrão de Contatos; é destino de transferência. | Entidade de governança do Espaço de Trabalho (documento 01, 7.2); agrupa **Membros**; é Sujeito de permissão e destino de concessão. | A Equipe responde "quem são estas pessoas"; a Fila responde "que Conversas estas pessoas atendem". Uma Fila referencia Equipes como elegíveis; uma Equipe não sabe de Filas. Remover um Membro da Equipe o retira da elegibilidade derivada; não altera Conversas já atribuídas a ele (RN-CXE-24). |
| **Participante × Contato** | Entidade interna da Conversa: presença de um Contato (ou Ator) nela, com papel e momentos de entrada e saída; não existe fora da Conversa. | Pessoa externa com identidade, Identificadores, Proprietário, ciclo de vida próprio; existe antes, durante e depois de qualquer Conversa (documento 10, 4). | O Participante `contato` **referencia** o Contato. Um Contato pode ser Participante de muitas Conversas; eliminar a Conversa elimina o Participante, nunca o Contato; eliminar o Contato substitui a referência por Marcador de Contato eliminado (DO-CON-10). |
| **Participante × Membro** | Presença de um Membro em uma Conversa, com papel `atendente` ou `observador`, entrada e saída. | Relação de um Usuário com o Espaço de Trabalho (Ator, Papel, permissões). | O Membro existe sem Conversas; o Participante é a projeção do Membro dentro de uma Conversa específica. Ter `ver` sobre a Conversa não torna o Membro Participante: Participante é quem **tomou parte** (enviou Mensagem, foi Atribuído, foi adicionado como observador), não quem pode ver. |
| **Atribuído × Proprietário** | Ator (Membro ou Agente — B7) encarregado de **conduzir** uma Conversa; 0..1; liberado na remoção do Membro (B28); pode ser Agente; muda por transferência. | Membro humano que responde pela **governança** de um registro; exatamente 1 quando se aplica (A7); sucedido na remoção. | **Conversa não tem Proprietário** (A7 não a lista; DO-CXE-02). Governança da Conversa é da Fila (elegíveis, `administrar`) e da Caixa; responsabilidade humana pelo relacionamento é do Proprietário do Contato. Atribuído é responsabilidade de execução, como Responsável em Tarefa; por isso admite zero e admite Agente. |

## 5. Identidade

**Caixa de Entrada.** Identificador imutável, opaco, atribuído pela plataforma na criação do Espaço de Trabalho. Por ser única por Espaço de Trabalho, a identidade da Caixa é, na prática, coextensiva à do Espaço de Trabalho: referenciar "a Caixa de Entrada" e "a Caixa de Entrada do Espaço de Trabalho X" é a mesma coisa. Ainda assim, ela tem identificador próprio, porque é Recurso de permissão, escopo de Automação e Fonte de Dados.

**Teste de identidade (Caixa).** Se o prazo de reabertura mudar, a distribuição padrão mudar, o horário de atendimento mudar, todos os Canais forem desconectados e substituídos, todas as Filas forem arquivadas e recriadas e todas as Conversas forem resolvidas, continua sendo a mesma Caixa de Entrada: Automações com escopo nela, Widgets e Registros de Atividade continuam a apontar para ela. A identidade é a continuidade da camada conversacional da organização, não qualquer configuração ou conteúdo.

**Canal.** Identificador próprio, imutável. **O identificador externo não é identidade**: o mesmo número de WhatsApp desconectado e reconectado no mesmo Canal preserva o Canal (e o histórico de Conversas); um Canal novo criado para o mesmo número é outro Canal, e as Conversas antigas permanecem no antigo (seção 20.20). Trocar nome, Fila padrão, Membro configurador, credenciais e configuração de mensagens de modelo preserva o Canal. O Tipo de Canal **é imutável**: um Canal WhatsApp nunca vira Canal E-mail — seriam entidades com capacidades e identificadores incompatíveis (INV-CXE-02).

**Fila.** Identificador próprio, imutável. Nome, elegíveis, regra de distribuição e Proprietário padrão de Contatos são atributos. Nome único entre Filas `ativo` e `arquivado` da Caixa (RN-CXE-31), por legibilidade, não por identidade.

**Conversa.** Identificador próprio, imutável. **Teste de identidade.** Se o estado passar de `aberta` a `resolvida` e de volta a `aberta`, o Atribuído mudar cinco vezes, a Fila mudar, o título for editado, Tags e Valores de Campo forem reescritos e o Contato principal for reapontado por mesclagem (B14), continua sendo a mesma Conversa: as Mensagens continuam nela, os Vínculos com Negócios e Tarefas continuam, os Registros de Atividade continuam. **O par (Contato, Canal) não é identidade**: é a chave do invariante de unicidade de Conversa não resolvida (INV-CXE-03), e o mesmo par produz muitas Conversas ao longo do tempo (B12). Uma Conversa reaberta é a mesma Conversa; uma Conversa criada por Mensagem recebida após o prazo de reabertura é outra (RN-CXE-09).

**Mensagem.** Identificador próprio, imutável. O **identificador externo do provedor** (o identificador que o WhatsApp, o servidor de e-mail ou o Instagram atribuem) é atributo, único por Canal quando presente (INV-CXE-08), usado para deduplicar entregas repetidas do provedor e para correlacionar status de entrega e respostas — mas não é a identidade: uma Mensagem `interna` não tem identificador externo e uma Mensagem `enviada` só o recebe depois de aceita pelo provedor. Como a Mensagem é imutável (RN-CXE-16), o teste de identidade é trivial: nada editável muda; a marcação de exclusão e as transições de status de entrega não criam outra Mensagem.

**Participante.** Identidade interna à Conversa, definida pelo par (Conversa, sujeito referenciado — Contato, Membro ou Agente). Um mesmo Contato não é dois Participantes na mesma Conversa; sair e reentrar reabre o mesmo Participante com novo momento de entrada (o histórico de entradas e saídas fica nos Registros de Atividade). O papel do Participante pode mudar (um Membro `observador` que responde passa a `atendente`), sem criar outro Participante.

**Anexo.** Sem identidade própria: é a referência (Mensagem, Arquivo, ordem). O Arquivo tem identidade (A8); o Anexo não.

## 6. Atributos fundamentais

Esta seção descreve os atributos da **Caixa de Entrada**. Os atributos de Canal, Fila, Conversa, Mensagem, Participante e Anexo estão na seção 7, junto de cada entidade interna.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Espaço de Trabalho | referência | sim | Exatamente um; imutável (INV-ET-08). |
| Prazo de reabertura | nativo (duração) | sim | Intervalo, contado a partir do momento em que a Conversa passou a `resolvida`, durante o qual uma Mensagem recebida do mesmo (Contato, Canal) **reabre** a Conversa em vez de criar outra (B12; RN-CXE-09). Valor padrão da plataforma na criação (recomendação: 72 horas); zero significa "toda Mensagem após resolução cria Conversa nova". Fila e Canal **não** sobrescrevem o prazo nesta versão (DO-CXE-04). |
| Distribuição padrão | nativo (enumeração) | sim | Regra de distribuição aplicada às Conversas que entram em uma Fila cuja regra é "herdar da Caixa": `manual`, `rodízio`, `menor carga` (7.4). Padrão: `manual`. |
| Proprietário padrão de Contatos criados automaticamente | referência (Membro) | não | Membro `ativo` que se torna Proprietário de Contatos criados por Mensagem recebida (DO-CON-08) quando nem a Fila nem o Canal definem um. Resolução: Fila → Canal → Caixa de Entrada → Proprietário do Espaço de Trabalho (DO-CXE-05). Se o Membro deixar de estar `ativo`, o atributo é limpo com Registro de Atividade e a resolução segue ao próximo nível. |
| Horário de atendimento | objeto de valor | não | Dias da semana e faixas de horário (no fuso da Localidade, RN-ET-15) em que a organização se declara disponível; feriados como exceções datadas. Consumido por Automações ("fora do horário, responder mensagem de modelo"), por Painéis ("tempo de primeira resposta em horas úteis") e como padrão de Filas que não definem o seu. **Depende de C12**: enquanto o Espaço de Trabalho não define semana de trabalho, este objeto de valor é a única fonte de "horário útil" da Caixa; quando C12 for decidida, este atributo passa a **referenciar** a configuração global, sobrescrevendo-a apenas se a organização quiser horário de atendimento distinto do horário comercial (DO-CXE-06). |
| Canais | entidade contida 0..N | não | 7.2. |
| Filas | entidade contida 0..N | não | 7.4. |
| Conversas | entidade contida 0..N | não | 7.5. |
| Conversas não resolvidas | derivado | — | Contagem de Conversas `aberta` ou `pendente`. Nunca gravado. |
| Conversas sem Fila | derivado | — | Conversas não resolvidas com Fila vazia (Canal sem Fila padrão; Fila arquivada ou eliminada). Condição operacional para o produto exibir; não é estado. Conversas criadas durante suspensão nascem na Fila padrão do Canal, sem distribuição (20.10). |

Não são atributos da Caixa de Entrada, embora sejam configurados ou vistos nela: Tags (do Espaço de Trabalho, B5), Definições de Campo de Conversa (do Espaço de Trabalho, A5.2), Automações com escopo Caixa de Entrada ou Fila (do Espaço de Trabalho, B41), Widgets de Painel (do Painel), as capacidades dos Tipos de Canal (da plataforma), a Disponibilidade de atendimento (do Membro, 7.8) e as permissões (relações no Recurso).

## 7. Entidades internas ou componentes

### 7.1 Tipo de Canal e suas capacidades (global; referenciado)

O **Tipo de Canal** é entidade global da plataforma (A1.3): WhatsApp, Instagram, E-mail, Chat do site. A Caixa de Entrada o referencia por meio dos Canais; nunca o contém. Cada Tipo de Canal declara um objeto de valor de **Capacidades**, fixo pela plataforma, que a ontologia consome como regra:

| Capacidade | Significado | WhatsApp | Instagram | E-mail | Chat do site |
| --- | --- | --- | --- | --- | --- |
| Tipos de Identificador resolvidos | Quais Tipos de Identificador de Contato (DO-CON-03) o Canal produz ao receber Mensagem. | `identidade de WhatsApp` | `usuário de Instagram` | `e-mail` | `identificador de chat do site` |
| Identificador externo do Canal | O que identifica a conta conectada. | número | conta | endereço de e-mail | site (domínio ou identificador do widget) |
| Anexos suportados | Tipos de mídia e limites de tamanho que o Canal aceita enviar e receber. | imagem, áudio, vídeo, documento, localização, figurinha | imagem, vídeo, áudio | qualquer, por tamanho | imagem, documento |
| Janela de resposta | Prazo, contado da última Mensagem `recebida`, dentro do qual a organização pode enviar Mensagem livre; fora dele, só Mensagem de modelo aprovada. | 24 h | 24 h (7 dias com etiqueta humana, conforme o provedor) | sem janela | sem janela (sessão do visitante) |
| Mensagens de modelo | O Tipo de Canal exige modelos pré-aprovados pelo provedor para envio fora da janela ou iniciado pela organização. | sim | limitado | não | não |
| Assunto e cópia | A Mensagem tem assunto e destinatários adicionais (para, cópia, cópia oculta). | não | não | sim | não |
| Status de entrega reportado | Quais status o provedor confirma. | enviada, entregue, lida | enviada, lida | enviada (entregue e lida só se o provedor reportar) | entregue, lida |
| Edição e exclusão pelo remetente externo | O Contato pode editar ou apagar uma Mensagem já entregue. | sim (prazo do provedor) | sim | não | não |
| Reações | O provedor transmite reações a Mensagens. | sim | sim | não | não |
| Grupos | O provedor entrega Mensagens de conversas com vários participantes externos. | sim (C5) | não | sim (cópias, 20.3) | não |
| Multimodal em uma Mensagem | Uma Mensagem do provedor pode trazer texto e vários anexos juntos. | não (cada mídia é Mensagem separada; legenda acompanha a mídia) | não | sim | sim |
| Identidade anônima | O Canal pode criar Conversa sem identidade verificável da pessoa. | não | não | não | sim (visitante anônimo, 20.19) |

Os valores da tabela são a **leitura desta ontologia** sobre os provedores no momento da escrita; o que a ontologia fixa é que **cada capacidade é atributo do Tipo de Canal, não do Canal nem da Conversa**, e que toda regra deste documento que dependa de uma capacidade a consulta no Tipo de Canal (RN-CXE-05). Mudança de valor pela plataforma não altera a ontologia. Os quatro Tipos são **especializações de Canal por capacidade**, não entidades próprias (A2.4): não há "Canal WhatsApp" como entidade; há Canal com Tipo de Canal WhatsApp.

**O que cada especialização acrescenta ao Canal** (síntese do que a tabela implica):

| Tipo de Canal | Acrescenta ao Canal | Acrescenta à Mensagem | Regra própria |
| --- | --- | --- | --- |
| WhatsApp | Configuração de mensagens de modelo aprovadas (7.3); número como identificador externo; indicador de grupos habilitados. | Mensagem de modelo usada (referência à configuração); identificador externo; reação. | Envio fora da Janela de resposta (24 h) exige Mensagem de modelo (RN-CXE-19). Mídia chega como Mensagens separadas (20.2). |
| Instagram | Conta como identificador externo. | Identificador externo; reação; origem (mensagem direta, resposta a publicação — atributo textual). | Janela de resposta conforme o provedor. |
| E-mail | Endereço como identificador externo; assinatura padrão (texto). | Assunto; Endereços adicionais (para/cópia/cópia oculta — 7.6); identificador externo (Message-ID); referência "em resposta a" por cabeçalho. | Sem janela; Mensagens multimodais em uma só (20.2); cópias não são Participantes (DO-CXE-13). |
| Chat do site | Site como identificador externo; configuração do widget (fora da ontologia). | Metadados da sessão (página de origem — atributo textual). | Contato criado com Identificador `identificador de chat do site`, Não identificado até que o visitante se identifique (20.19). |

### 7.2 Canal

Conta conectada de um Tipo de Canal. **Especialização de Integração** (B35; documento 01, 7.4): tem todos os atributos e estados de Integração e obedece às suas regras; acrescenta os atributos abaixo; é **contido pela Caixa de Entrada**, não diretamente pelo Espaço de Trabalho. É Ator (A6.1): Mensagens `recebida` e status de entrega são fatos registrados pelo Canal.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Caixa de Entrada | referência | sim | Imutável. |
| Nome | nativo | sim | Nome de exibição ("Recepção", "Comercial SP"). Único entre Canais `ativo` da Caixa (RN-CXE-31). |
| Tipo de Canal | referência (global) | sim | Imutável (INV-CXE-02). |
| Identificador externo | nativo | sim | Número, conta, endereço de e-mail ou site, na forma canônica do Tipo de Canal. Único entre Canais `ativo` do Espaço de Trabalho por (Tipo de Canal, valor) (INV-CXE-01): a mesma conta não é conectada duas vezes. Não é identidade (seção 5). |
| Estado de conexão | nativo | sim | `conectada`, `desconectada`, `com erro` (herdado de Integração; seção 11.1). |
| Estado de ciclo de vida | nativo | sim | `ativo`, `arquivado` (seção 11.1). Sem `na lixeira` (DO-CXE-03). |
| Credenciais | objeto de valor sigiloso | condicional | Herdado de Integração; nunca exibido depois de gravado. |
| Membro configurador | referência (Membro) | sim | Administrador que conectou (B35). Rastreabilidade, não governança. Se removido, permanece como valor histórico; a reconexão por outro Administrador o substitui. |
| Criador; momento de criação | referência (Membro); nativo | sim | Imutáveis. |
| Fila padrão | referência (Fila) | não | 0..1. Fila em que Conversas criadas por Mensagem recebida neste Canal entram (RN-CXE-07). Vazio: a Conversa nasce sem Fila. Se a Fila for arquivada, a referência é limpa com Registro de Atividade. |
| Proprietário padrão de Contatos criados automaticamente | referência (Membro) | não | Sobrescreve o da Caixa para Contatos criados por Mensagem neste Canal, quando a Fila não define (DO-CON-08; DO-CXE-05). |
| Origem padrão de Contatos | referência (Origem) | não | Origem atribuída a Contatos criados por Mensagem neste Canal (DO-CON-08; catálogo do Espaço de Trabalho). |
| Configuração de mensagens de modelo | objeto de valor | condicional | 7.3. Só para Tipos de Canal com a capacidade "mensagens de modelo". |
| Grupos habilitados | nativo (booleano) | condicional | Só para Tipos com capacidade "grupos". Quando falso, Mensagens de grupo são persistidas mas a Conversa de grupo nasce `resolvida` e sem distribuição (20.18). Padrão: falso. |
| Momento da última Mensagem recebida / enviada; Conversas não resolvidas | derivados | — | Nunca gravados. |

**Canal não tem Proprietário** (DO-CXE-02): é infraestrutura organizacional; a Fila é o nível operacional de responsabilidade, e o Atribuído é quem responde por cada Conversa. Confirma a recomendação de B35 e do documento 01 (20.11).

### 7.3 Configuração de mensagens de modelo (objeto de valor do Canal)

Conjunto de **Mensagens de modelo** aprovadas pelo provedor para o Canal, cada uma com: identificador no provedor, nome, idioma, corpo com variáveis nomeadas, categoria do provedor (utilidade, marketing, autenticação), estado de aprovação (`aprovado`, `pendente`, `rejeitado`, `pausado`) e momento de sincronização. É **objeto de valor de configuração**: sem identidade própria na ontologia (o identificador é do provedor), substituído integralmente a cada sincronização, sem histórico além dos Registros de Atividade. **Não é Template** (A8): Template instancia entidades; Mensagem de modelo é texto pré-aprovado consumido no envio. **Não é Mensagem**: a Mensagem enviada com um modelo referencia o modelo usado e o texto resultante (7.6). Categoria `marketing` sujeita o envio ao consentimento vigente do Contato (RN-CON-16).

### 7.4 Fila

Agrupamento operacional de Conversas dentro da Caixa de Entrada, que responde "quem atende estas Conversas e como elas são distribuídas". Entidade contida, com identidade (referenciada por Conversas, Canais, Automações com escopo Fila, Widgets e permissões). **Não é Equipe** (agrupa Conversas, não pessoas) e **não é Funil** (não é ordenada; não posiciona nada) — seção 4.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Caixa de Entrada | referência | sim | Imutável. |
| Nome | nativo | sim | Único entre Filas `ativo` e `arquivado` da Caixa, sem distinção de maiúsculas e espaços nas extremidades (RN-CXE-31). |
| Descrição | nativo | não | Texto livre. |
| Estado | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11.2). |
| Elegíveis | associação 0..N | não | Membros e Equipes cujos integrantes podem receber Conversas desta Fila por distribuição ou auto-atribuição. **Elegíveis efetivos** (derivado): união dos Membros elegíveis diretos e dos integrantes `ativo` das Equipes elegíveis, excluídos os `suspenso`, `pendente` e `removido` (RN-ET-08) e, para distribuição automática, os com Disponibilidade `indisponível` (7.8). Fila sem elegíveis é válida: só distribuição `manual` por quem tem `administrar` ou atribuição por Automação. |
| Regra de distribuição | nativo (enumeração) | sim | `herdar da Caixa` (usa a Distribuição padrão), `manual` (Conversa fica sem Atribuído até alguém se auto-atribuir ou ser atribuído), `rodízio` (próximo elegível efetivo disponível, em ordem circular por momento da última atribuição), `menor carga` (elegível efetivo disponível com menos Conversas não resolvidas atribuídas nesta Fila; empate por rodízio). Nenhuma regra atribui a Agente por si: Agente só é Atribuído por ato explícito ou por Automação (RN-CXE-12). |
| Limite de Conversas por Atendente | nativo (inteiro) | não | Teto de Conversas não resolvidas atribuídas a um mesmo Membro nesta Fila pela distribuição automática; atingido o teto, o elegível é pulado; sem elegível disponível, a Conversa fica sem Atribuído com evento "Fila sem capacidade". Não limita atribuição manual. |
| Proprietário padrão de Contatos criados automaticamente | referência (Membro) | não | Primeiro nível da resolução de DO-CON-08 (Fila → Canal → Caixa → Proprietário do Espaço de Trabalho). |
| Horário de atendimento | objeto de valor | não | Sobrescreve o da Caixa para esta Fila (6). Vazio: usa o da Caixa. |
| Criador; momento de criação | referência (Membro); nativo | sim | Imutáveis. Fila **não tem Proprietário** (DO-CXE-02). |
| Conversas não resolvidas; carga por Atendente; tempo médio de espera | derivados | — | Para Painéis; nunca gravados. |

A Fila **não contém** Conversas no sentido de composição: a Conversa pertence à Caixa e **referencia** 0..1 Fila, mutável por transferência (RN-CXE-13). Arquivar a Fila exige que nenhuma Conversa não resolvida a referencie (ou movê-las no mesmo ato — seção 12.3); Conversas `resolvida` continuam a referenciá-la como histórico.

### 7.5 Conversa

Episódio de interação entre a organização e **exatamente um Contato principal** por **exatamente um Canal** (B12). Raiz do subagregado Mensagens + Participantes; contida pela Caixa de Entrada.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Caixa de Entrada | referência | sim | Imutável. |
| Canal | referência (Canal) | sim | Imutável (INV-CXE-04). A Conversa nasceu por este Canal e só ocorre por ele; Canal `arquivado` mantém a referência. |
| Contato principal | referência (Contato) | sim | Contato não `mesclado` do mesmo Espaço de Trabalho, ou Marcador de Contato eliminado (INV-CON-11). Reapontado por mesclagem (B14); substituído por Marcador na eliminação (DO-CON-10). Nunca vazio. |
| Estado de conversa | nativo | sim | `aberta`, `pendente`, `resolvida` (A4.5; seção 11.3). |
| Estado de ciclo de vida | nativo | sim | `ativo`, `na lixeira` (seção 11.3; DO-CXE-03). Sem `arquivado`: `resolvida` é o repouso da Conversa. |
| Fila | referência (Fila) | não | 0..1. Definida na criação pela Fila padrão do Canal (ou por Automação/Membro); alterada por transferência (RN-CXE-13). |
| Atribuído | referência (Membro ou Agente) | não | 0..1 (A7). Membro `ativo` ou `suspenso` (mantém; RN-ET-08) ou Agente do Espaço de Trabalho. Liberado na remoção do Membro (B28). |
| Título | nativo / derivado | sim | Editável; quando não editado, **derivado**: assunto da primeira Mensagem (E-mail) ou primeiros caracteres do texto da primeira Mensagem `recebida` ou `enviada`; se a organização edita, o valor gravado prevalece. |
| Adiamento | objeto de valor | condicional | "Adiada até": momento futuro + motivo opcional + ator. Presente apenas em `pendente`; ao alcançar o momento, o Sistema devolve a Conversa a `aberta` com evento "Adiamento vencido"; uma Mensagem `recebida` antes disso também a devolve a `aberta` e descarta o Adiamento (DO-CXE-09). |
| Rascunho | objeto de valor | não | 7.10. |
| Tags | associação N:N | não | Tags do Espaço de Trabalho aplicáveis a Conversa (B5). |
| Valores de Campo | entidade interna 0..N | não | Um por Definição de Campo Personalizado com entidade-alvo Conversa (A5.2; 7.12). |
| Identificador de grupo | objeto de valor | condicional | Identificador externo do grupo e nome do grupo à época, quando a Conversa é de grupo (capacidade "grupos"; C5; 20.18). Vazio nas Conversas comuns. |
| Momento de criação; Criador | nativo; referência (Ator) | sim | Criador: Sistema (Mensagem recebida), Membro, Agente, Automação ou Integração (com ator delegante, A6.2). |
| Momento da primeira Mensagem recebida; da última Mensagem recebida; da última Mensagem enviada | derivados | — | Das Mensagens. |
| Momento da primeira resposta | derivado | — | Momento da primeira Mensagem `enviada` posterior à primeira `recebida` do episódio corrente (desde a criação ou a última reabertura). Vazio se ainda não houve resposta. |
| Tempo de primeira resposta; tempo de espera atual | derivados | — | Primeira resposta − primeira recebida; agora − última `recebida` sem `enviada` posterior. Em horas úteis quando o Horário de atendimento se aplica. |
| Momento de resolução; momento da última reabertura; quantidade de reaberturas | nativos | condicional | Preenchidos nas transições (seção 12). |
| Janela de resposta aberta até | derivado | — | Última Mensagem `recebida` + janela de resposta do Tipo de Canal (7.1); vazio para Tipos sem janela. Determina se o envio livre é possível (RN-CXE-19). |
| Empresa | derivado | — | Empresa principal do Contato principal (documento 10, 6). **Nunca gravado na Conversa** (DO-EMP-08). |
| Prioridade | — | — | **Não existe prioridade nativa de Conversa nesta versão** (DO-CXE-10): use Tag ou Definição de Campo de seleção única; Filas separam urgência quando necessário. |

Sem "assunto" nativo além do Título: para E-mail, o assunto é atributo da Mensagem (7.6) e alimenta o Título derivado.

### 7.6 Mensagem

Unidade de comunicação dentro de uma Conversa. **Composição**: pertence a exatamente uma Conversa e não existe fora dela; nunca é movida entre Conversas (RN-CXE-15). **Imutável** depois de gravada, salvo marcação de exclusão e transições de status de entrega (RN-CXE-16).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Conversa | referência | sim | Imutável. |
| Direção | nativo | sim | `recebida` (do Contato, via Canal), `enviada` (da organização ao Contato, via Canal), `interna` (nota interna: entre Atores internos; **nunca** vai ao Contato — INV-CXE-09). |
| Remetente | papel resolvido a Participante | condicional | Para `recebida`: o Participante `contato` que a enviou (Contato principal ou Participante adicional em grupo), via o **Identificador de Contato** pelo qual chegou (referência ao Identificador; documento 10, 8). Para `enviada` e `interna` de Membro ou Agente: o Participante correspondente. Para `enviada` por Automação, Integração ou Sistema: **sem Participante**; só o Ator (DO-CXE-12). |
| Ator; ator delegante | referência (Ator); referência 0..1 | sim; condicional | Quem praticou o envio ou registro (A6.1). Agente em nome de Membro registra ambos (A6.2); Agente invocado por Automação registra a Automação como delegante (DO-AUT-15); Agente invocado pela Caixa de Entrada não tem delegante (RN-CXE-23); Automação registra a Automação e, como delegante, o seu Proprietário (ou o acionador, no Gatilho manual — RN-AUT-19); Canal (Integração) é o Ator de toda `recebida`. |
| Conteúdo | nativo (texto) | condicional | Texto da Mensagem. Pode ser vazio se houver ao menos um Anexo (INV-CXE-07). Para `enviada` com Mensagem de modelo: o texto resultante após substituição de variáveis. |
| Anexos | componente 0..N | não | 7.11. Ordenados. |
| Tipo de conteúdo | derivado | — | `texto`, `mídia` (um Anexo, sem texto), `mídia com legenda`, `multimodal` (texto + vários Anexos, ou vários Anexos), `modelo`, `sistema` (Mensagem gerada pela plataforma, ex.: "Conversa transferida" — ver nota abaixo). Nunca gravado. |
| Assunto | nativo | condicional | Só para Tipo de Canal com capacidade "assunto e cópia" (E-mail). |
| Endereços adicionais | objeto de valor 0..N | condicional | Só E-mail. Cada um: tipo (`para`, `cópia`, `cópia oculta`), endereço, nome exibido e **Contato resolvido** (0..1, derivado pela busca de Identificador `e-mail` no momento da consulta; nunca gravado). Não são Participantes (DO-CXE-13; 20.3). |
| Em resposta a | referência (Mensagem) | não | 0..1, Mensagem da **mesma Conversa** (INV-CXE-10). Preenchida por citação explícita (WhatsApp, Instagram) ou por cabeçalho de resposta (E-mail). |
| Mensagem de modelo usada | referência (modelo na Configuração 7.3) | não | Identificador do modelo no provedor + nome e versão à época (valor histórico; sobrevive à ressincronização). |
| Identificador externo | nativo | condicional | Identificador atribuído pelo provedor. Obrigatório em `recebida`; preenchido em `enviada` quando o provedor aceita; ausente em `interna`. Único por Canal (INV-CXE-08); serve à deduplicação de entregas repetidas (RN-CXE-17). |
| Status de entrega | nativo | condicional | Só `enviada`: `pendente`, `enviada`, `entregue`, `lida`, `falhou`, cada um com momento; `falhou` com motivo (seção 11.4). `recebida` e `interna` não têm status de entrega. |
| Leitura interna | objeto de valor 0..N | não | Para `recebida` (e `interna`): lista de (Ator interno, momento) que leram. Derivado do acesso, gravado por acréscimo; alimenta "não lidas" por Membro e o derivado "Momento em que foi lida internamente pela primeira vez". Não é status de entrega: o Contato não sabe disso. |
| Reações | objeto de valor 0..N | não | (Participante, símbolo, momento; removida = registro com símbolo vazio). Só para Tipos de Canal com capacidade "reações"; reações internas (de Membros) são permitidas em qualquer Tipo, nunca enviadas se o Tipo não suportar. Não é Mensagem. |
| Marcação de exclusão | objeto de valor | condicional | (Ator, momento, origem: `remetente externo` — o Contato apagou no provedor —, `interno` — Membro com permissão). O conteúdo e os Anexos deixam de ser exibidos; a Mensagem permanece com marcador. Irreversível. Registros de Atividade e o momento permanecem (RN-CXE-16). |
| Edição pelo remetente externo | objeto de valor 0..N | condicional | Quando o Tipo de Canal transmite edições (WhatsApp, Instagram): lista de (momento, conteúdo anterior). O Conteúdo passa a ser o atual; a Mensagem é a mesma. Mensagens `enviada` e `interna` **não são editáveis** (RN-CXE-16). |
| Momento de criação | nativo | sim | Para `recebida`: momento informado pelo provedor (o momento em que a pessoa enviou); Momento de recebimento pela plataforma é atributo separado. |
| Anonimizada | nativo (booleano) | condicional | Verdadeiro após eliminação do Contato por solicitação do titular (documento 10, 12.5): Conteúdo substituído por marcador e Anexos eliminados. |
| Proveniência | objeto de valor | não | Sessão de Chat de origem (identificador; momento) quando o Conteúdo veio de um Rascunho gerado em Sessão ancorada (7.10). Sem vínculo vivo. |

**Mensagens de sistema.** Fatos da Conversa que o produto exibe na sequência ("Conversa atribuída a Ana", "transferida para Suporte", "resolvida") **não são Mensagens**: são Registros de Atividade da Conversa exibidos na linha do tempo. Uma Mensagem tem sempre um Ator que comunica; a plataforma não "fala" na Conversa (DO-CXE-08). Consequência: nenhuma `interna` é gerada automaticamente por transferência ou atribuição.

**Multimodalidade.** Uma comunicação com texto, áudio e imagem é **uma** Mensagem com Conteúdo e vários Anexos **quando o Tipo de Canal a entrega assim** (E-mail, Chat do site). Quando o provedor entrega cada mídia como item separado (WhatsApp, Instagram), cada item é uma Mensagem, com o mesmo Remetente e momentos próximos; a plataforma **não** as funde (o identificador externo é um por item, e o status de entrega, a citação e a exclusão pelo remetente aplicam-se por item). O agrupamento visual é apresentação (DO-CXE-11; 20.2). No envio pela organização, a regra é a mesma: o Ator compõe uma Mensagem; a plataforma a fragmenta em quantas o Tipo de Canal exigir, e cada fragmento é uma Mensagem com Proveniência comum (referência "parte de" à Mensagem composta, valor histórico).

### 7.7 Participante

Presença de um sujeito — Contato, Membro ou Agente — em uma Conversa. Entidade interna da Conversa; identidade pelo par (Conversa, sujeito) (seção 5).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Conversa | referência | sim | Imutável. |
| Sujeito | referência (Contato, Membro ou Agente) | sim | Exatamente um dos três. Contato: não `mesclado` ou Marcador de Contato eliminado. |
| Papel | nativo | sim | `contato` (exatamente um **principal** — o Contato principal da Conversa — e 0..N **adicionais**, só em Conversas de grupo, C5), `atendente` (Membro que enviou Mensagem `enviada` ou foi Atribuído), `agente` (Agente que foi Atribuído ou enviou Mensagem), `observador` (Membro ou Agente adicionado para acompanhar, sem ter conduzido). O papel de um Membro passa de `observador` a `atendente` ao enviar a primeira `enviada`; nunca o inverso. |
| Momento de entrada | nativo | sim | Primeira participação (criação da Conversa para o principal; primeira Mensagem, atribuição ou adição para os demais). |
| Momento de saída | nativo | condicional | Preenchido quando o Participante deixa a Conversa (Contato adicional sai do grupo; observador removido; Atribuído transferido **não** sai — permanece `atendente` como histórico). Reentrada esvazia o momento de saída e gera Registro de Atividade. |
| Adicionado por | referência (Ator) | condicional | Para `observador` e para Contatos adicionais adicionados por Membro. |

Participante **não é permissão**: ser Participante não concede `ver` (seção 17); ter `ver` não torna Participante. Participante `observador` recebe notificações da Conversa nos termos do Observador de Tarefa (Glossário), condicionado a `ver`. O Contato principal nunca sai: enquanto a Conversa existir, é Participante (INV-CXE-06).

### 7.8 Atendente (papel) e Disponibilidade de atendimento (objeto de valor do Membro)

**Atendente** é um **papel funcional**, não uma entidade (Glossário): o Membro (ou Agente) que conduz Conversas. Um Membro é Atendente de uma Fila quando é elegível efetivo dela (7.4); é Atendente de uma Conversa quando é o seu Atribuído ou Participante `atendente`. Não há registro "Atendente" a criar, excluir ou configurar: configurar um Atendente é configurar a elegibilidade na Fila e a Disponibilidade no Membro.

**Disponibilidade de atendimento** é **objeto de valor do Membro** (DO-CXE-14), não da relação Membro-Fila: valor `disponível`, `ausente` (não recebe distribuição automática; mantém as Conversas que tem) ou `indisponível` (não recebe distribuição automática; o produto pode oferecer redistribuir as suas Conversas não resolvidas, ato explícito), com momento e origem (`Membro`, `Automação`, `horário de atendimento`). Justificativa: uma pessoa está ou não disponível para atender; disponibilidade por Fila obrigaria o mesmo Membro a estar "disponível" em uma Fila e "ausente" em outra no mesmo instante, o que é elegibilidade (já expressa por Fila), não disponibilidade. Membro `suspenso` conta como `indisponível` por derivação (RN-ET-08). Este objeto de valor **amplia os atributos do Membro** do documento 01 (7.1); registrado como impacto (seção 24). Agente não tem Disponibilidade: a sua "disponibilidade" é a permissão e o estado das suas Execuções.

### 7.9 Remetente e Destinatário (papéis da Mensagem)

**Remetente** e **Destinatário** **não são entidades** e não se multiplicam em "Remetente de Mensagem", "Destinatário de E-mail" etc. São **papéis** resolvidos assim:

- **Remetente**: o Participante autor da Mensagem (7.6), quando o Ator é Contato, Membro ou Agente; quando o Ator é Automação, Integração ou Sistema, a Mensagem tem Ator e não tem Remetente-Participante (DO-CXE-12). Justificativa: Participante é quem **toma parte** da Conversa de forma contínua e é notificado, observa, conduz; uma Automação que dispara uma confirmação não toma parte de nada — o fato relevante para auditoria (quem enviou) já está no Ator (A6.2).
- **Destinatário**: derivado, nunca gravado como relação. Para `enviada`: o Contato principal (e, em grupo, os Contatos adicionais) por meio do Identificador de Contato principal do Tipo exigido pelo Canal (documento 10, 7.1); para E-mail, além dele, os Endereços adicionais da Mensagem. Para `recebida`: a organização, representada pelo Canal. Para `interna`: os Atores internos com `ver` na Conversa; uma menção (RN-CXE-22) dirige a notificação, não altera o destinatário.

Não existe "Mensagem para vários Contatos" fora de grupo (C5) ou de Endereços adicionais de E-mail: envio em massa é uma Automação criando uma Mensagem por Conversa (RN-CXE-21).

### 7.10 Rascunho (objeto de valor da Conversa)

Texto (e Anexos pretendidos) ainda não enviado, associado à Conversa: conteúdo, autor (Ator), momento, **origem** (`Membro`, `Agente` — sugestão gerada —, `Sessão de Chat` — copiado de uma Sessão ancorada) e, se gerado por Agente, a Execução de origem. **Um Rascunho por Ator interno por Conversa** (o de Ana não é o de Pedro; a sugestão do Agente é visível a quem tem `ver` e é adotável por qualquer Atendente). Não é Mensagem (nunca tem direção, entrega nem identificador externo), não é Mensagem de Chat, não aparece na sequência da Conversa e não gera evento de Conversa; descartável sem registro além do Registro de Atividade da Execução que o gerou. Enviar um Rascunho cria uma Mensagem `enviada` nova, com Proveniência opcional (7.6), e esvazia o Rascunho. **Decisão** (DO-CXE-15): resposta gerada por Agente é Rascunho, e não Mensagem `interna`, porque (a) uma `interna` é comunicação entre Atores e fica para sempre na Conversa, poluindo o histórico com propostas não adotadas; (b) a sugestão é por natureza descartável e substituível; (c) o Rascunho preserva a autoria da Mensagem final (o Membro que envia é o Ator; o Agente que sugeriu fica na Proveniência e na Execução).

### 7.11 Anexo

Referência de uma Mensagem a um **Arquivo** do Espaço de Trabalho (A8), com **ordem** dentro da Mensagem, **tipo de mídia** (imagem, áudio, vídeo, documento, localização, figurinha, outro — catálogo da plataforma, subconjunto do que o Tipo de Canal suporta), nome exibido, e, opcionalmente, **transcrição ou descrição derivada** (texto gerado a partir de áudio ou imagem, com Ator gerador — Agente — e momento). A transcrição é **possibilidade**, não infraestrutura: a ontologia só fixa que, se existir, é derivada, regenerável, atribuída a um Ator e nunca substitui o Arquivo nem o Conteúdo da Mensagem. Sem identidade própria (seção 5). Remover o Anexo (por marcação de exclusão da Mensagem) remove a referência, não o Arquivo, salvo anonimização (documento 10, 12.5). O mesmo Arquivo pode ser Anexo de várias Mensagens, de Tarefas e de Comentários (A8).

### 7.12 Vínculos da Conversa e Valor de Campo

- **Vínculo Conversa-Negócio** (A8): 0..N; papel textual opcional; visível a quem vê ambos os lados; sem propriedade; lado `na lixeira` oculta; eliminação remove. Detalhado do lado do Negócio no documento 12.
- **Vínculo Conversa-Tarefa** (DO-TAR-08): 0..N; mesmas regras. "Criar Tarefa a partir da Conversa" cria a Tarefa na Lista escolhida com Vínculo automático e Proveniência "criada a partir de Conversa" (documento 06, 12.1; B49 para Valores obrigatórios).
- **Vínculo Conversa-Contato: não existe** (documento 10, 7.6). **Vínculo Conversa-Empresa: não existe** (DO-EMP-08). **Vínculo Conversa-Conversa: não existe nesta versão** (seção 25).
- **Valor de Campo**: entidade interna (A5.1), um por Definição de Campo Personalizado do Espaço de Trabalho com entidade-alvo Conversa (A5.2). Sem hierarquia, sem Valores órfãos (B37 não se aplica); desaparecem com a Definição (A5.4).

### 7.13 O que não é componente

Contato, Empresa, Negócio, Tarefa (relacionados por referência ou Vínculo); Tags e Definições de Campo (catálogos do Espaço de Trabalho); Automações com escopo Caixa ou Fila (do Espaço de Trabalho, B41); Widgets (do Painel); Sessões de Chat ancoradas (do Membro, B21); Execuções de Agente sobre Conversas (do Agente, B18); Tipos de Canal e suas Capacidades (da plataforma); Registros de Atividade (do Espaço de Trabalho); Arquivos (do Espaço de Trabalho); Disponibilidade de atendimento (do Membro); a linha do tempo do Contato (derivada, documento 10, 8.1).

## 8. Relações

### 8.1 Tabela de relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | composição 1:1 | ET → Caixa | Criada com ele; mesmo ciclo de vida (INV-ET-08). |
| contém Canais | Canal | contenção | Caixa → Canal | 0..N. Canal é Integração especializada (B35), contida aqui e só transitivamente pelo ET. |
| contém Filas | Fila | contenção | Caixa → Fila | 0..N. |
| contém Conversas | Conversa | contenção | Caixa → Conversa | 0..N. A Conversa é raiz do subagregado Mensagens + Participantes. |
| Conversa contém Mensagens | Mensagem | composição | Conversa → Mensagem | 1..N. Sem Conversa não há Mensagem; sem Mensagem não há Conversa (INV-CXE-05). |
| Conversa contém Participantes | Participante | composição | Conversa → Participante | 1..N (ao menos o Contato principal). |
| Mensagem contém Anexos | Anexo | componente | Mensagem → Anexo | 0..N; cada Anexo referencia 1 Arquivo. |
| Conversa referencia Contato principal | Contato | referência obrigatória | Conversa → Contato | Exatamente um (B12); reapontado por mesclagem; Marcador na eliminação (DO-CON-09). Não é Vínculo. |
| Participante referencia | Contato, Membro ou Agente | referência | Participante → sujeito | Exatamente um. |
| Mensagem `recebida` referencia Identificador | Identificador de Contato | referência | Mensagem → Identificador | O meio pelo qual chegou (documento 10, 8). Se o Identificador for transferido a outro Contato (DO-CON-12), a Mensagem continua a referenciá-lo e a Conversa continua com o Contato de origem. |
| Conversa ocorre por | Canal | referência obrigatória, imutável | Conversa → Canal | Exatamente um (INV-CXE-04). |
| Conversa está em | Fila | referência | Conversa → Fila | 0..1; mutável por transferência. |
| Conversa é atribuída a | Membro ou Agente | referência (responsabilidade de execução) | Conversa → Ator | 0..1 (A7, B7). Nunca Proprietário. |
| Canal tem Fila padrão | Fila | referência | Canal → Fila | 0..1. |
| Fila tem elegíveis | Membro, Equipe | associação | Fila ↔ Membro/Equipe | 0..N. A Equipe não sabe de Filas. |
| Canal referencia Tipo de Canal | Tipo de Canal | referência (global) | Canal → Tipo | Exatamente um, imutável (A1.3). |
| Canal/Fila/Caixa referenciam Proprietário padrão de Contatos | Membro | referência | → Membro | 0..1 cada (DO-CON-08; DO-CXE-05). |
| Canal referencia Origem padrão | Origem | referência (uso de catálogo) | Canal → Origem | 0..1. |
| Mensagem `enviada` referencia Mensagem de modelo | modelo (na Configuração 7.3) | referência (valor histórico) | Mensagem → modelo | 0..1. |
| Mensagem em resposta a | Mensagem | referência | Mensagem → Mensagem | 0..1, mesma Conversa (INV-CXE-10). |
| Mensagem tem Ator / ator delegante | Ator | referência | Mensagem → Ator | 1 / 0..1 (A6.2). |
| Conversa vinculada a | Negócio, Tarefa | associação (Vínculo) | Conversa ↔ registro | 0..N cada (A8, DO-TAR-08). |
| Conversa tem Tags | Tag | associação N:N | Conversa ↔ Tag | B5. |
| Conversa contém Valores de Campo | Valor de Campo | contenção | Conversa → Valor | 0..N; um por Definição aplicável (A5.2). |
| Conversa tem Rascunhos | Rascunho | objeto de valor | Conversa → Rascunho | 0..N (um por Ator interno). |
| Conversa tem Adiamento | Adiamento | objeto de valor | Conversa → Adiamento | 0..1; só em `pendente`. |
| Caixa / Fila é escopo de | Automação | referência (da Automação) | Automação → Caixa/Fila | B41. Escopo Fila é **ampliação** de B41 (DO-CXE-16). |
| Caixa / Fila / Canal / Conversa é Fonte de Dados de | Widget | referência | Widget → registro | Filtrada pelo visualizador (B20). |
| Fila é Âncora de | Painel (de contexto) | referência inversa | Painel → Fila | 0..N. Sem contenção nem herança de permissão ou estado; na eliminação passa a `eliminada` como valor e o Painel permanece (B102). |
| Conversa é âncora de | Sessão de Chat | referência inversa | Sessão → Conversa | B21. A Conversa não conhece Sessões. |
| Conversa é objeto de | Execução de Agente / Automação | referência inversa | Execução → Conversa | B18. |
| Conversa é derivada em | linha do tempo do Contato / da Empresa | visão derivada | — | Documento 10, 8.1; documento 11, 8.4. |
| Membro tem Disponibilidade de atendimento | Disponibilidade | objeto de valor do Membro | Membro → Disponibilidade | Consumida pelas Filas (7.8). |

Distinção aplicada: a Caixa **CONTÉM** Canais, Filas e Conversas; a Conversa **CONTÉM** (compõe) Mensagens, Participantes e Valores de Campo; a Conversa **REFERENCIA** Contato, Canal, Fila e Atribuído; o Canal **REFERENCIA** o Tipo de Canal (global) e **USA** Origem; a Conversa **RELACIONA-SE** com Negócio e Tarefa por Vínculo; a Caixa **CONFIGURA** prazo de reabertura, distribuição padrão e Horário de atendimento (objetos de valor); a Fila **CONFIGURA** elegíveis e regra de distribuição. Nenhuma entidade deste documento **HERDA** configuração de contêiner (o CRM não tem níveis, A5.2); o que existe é **resolução em cascata de padrões** (Fila → Canal → Caixa → Espaço de Trabalho), que é derivação, não herança no sentido de B25 (seção 16).

### 8.2 Relação com o Contato

Referência obrigatória e nunca vazia (INV-CON-11). **Criação automática** por Mensagem de Identificador desconhecido (RN-CON-12; RN-CXE-06). **Mesclagem** reaponta Contato principal, Participantes e Mensagens (via Identificador) ao sobrevivente, e a Caixa resolve a duplicidade de Conversas não resolvidas no mesmo Canal (RN-CXE-10; 20.17). **Restauração por Mensagem** (DO-CON-15): a Caixa cria ou reabre a Conversa e o Contato volta a `ativo` no mesmo ato. **Eliminação** substitui a referência por Marcador de Contato eliminado; a Conversa permanece (DO-CON-10). **Transferência de Identificador** (DO-CON-12) não move Conversas; "mover Conversa para outro Contato" é ato separado, registrado, permitido só para Conversas cujo Contato principal seja o de origem e que não violem INV-CXE-03 no destino (RN-CXE-11).

### 8.3 Relação com a Empresa

Derivada: a Empresa da Conversa é a Empresa principal do Contato principal no momento da consulta (DO-EMP-08; RN-EMP-15). Nunca gravada, nunca vinculada. "Conversas da Empresa" é visão derivada (documento 11, 8.4). Uma caixa genérica da organização externa (`contato@alfa.com`, número da recepção) é um Contato vinculado à Empresa, e a Conversa é com esse Contato (documento 11, 7.1).

### 8.4 Relação com o Negócio

Vínculo Conversa-Negócio, 0..N em ambos os sentidos (A8). Criado por Membro, Agente ou Automação com `ver` em ambos os lados e `editar` na Conversa. "Criar Negócio a partir da Conversa" cria o Negócio (no Funil padrão, com o Contato principal vinculado com papel a definir e a Empresa derivada sugerida) com Vínculo e Proveniência; detalhado no documento 12. Resolver a Conversa não afeta o Negócio; ganhar ou perder o Negócio não afeta a Conversa.

### 8.5 Relação com a Tarefa

Vínculo Conversa-Tarefa (DO-TAR-08). "Criar Tarefa a partir da Conversa" cria a Tarefa na Lista escolhida (`criar` na Lista), com Vínculo automático, Proveniência "criada a partir de Conversa" e, opcionalmente, o texto de uma Mensagem como descrição inicial (cópia, não referência: a Mensagem não se torna Comentário). A Tarefa pode referenciar o Contato principal por Vínculo Tarefa-Contato, criado no mesmo gesto se o ator quiser (ato explícito, não inferência). Resolver a Conversa não conclui a Tarefa; concluir a Tarefa não resolve a Conversa — uma Automação pode ligar os dois.

### 8.6 Relação com a IA (sem aprofundar; documentos 15–19)

- **Agente como Atribuído** (B7): um Agente pode ser Atribuído a uma Conversa por Membro, por Automação ou por Fila cuja Automação de distribuição o designe (nunca por rodízio ou menor carga, RN-CXE-12). Enquanto Atribuído e `ativo`, o Agente é **invocado pela Caixa de Entrada a cada Mensagem `recebida`** da Conversa (Execução com Origem `Caixa de Entrada`, invocador Sistema, **sem delegante** — RN-AGE-14; RN-AGE-11). Ele **responde ao Contato** apenas se o seu nível de autonomia efetivo (B22; B77) for `autônomo`; em `supervisionado`, enviar Mensagem a Contato é Ferramenta de classe `externa` e gera Solicitação de Aprovação a cada envio (B64), com Tempo limite padrão de 72 horas (B80); em `assistido`, toda Ferramenta que não seja `leitura`. A Mensagem enviada registra o Agente como Ator e o delegante conforme a origem da Execução: o Membro que o acionou na Conversa (interseção de permissões, A9.3); a **Automação**, quando a Execução nasce de Ação "invocar Agente" (DO-AUT-15 — o Agente usa só as próprias permissões, RN-AUT-25); **nenhum**, quando invocado pela chegada de Mensagem (DO-CXE-17).
- **Automação com escopo Caixa de Entrada ou Fila** (B41; DO-CXE-16): reage aos eventos da seção 18 (Mensagem recebida, Conversa criada, sem resposta há X, adiamento vencido, fora do horário) e executa Ações (atribuir, transferir, enviar Mensagem, aplicar Tag, criar Tarefa, invocar Agente). Age com as próprias permissões, tendo as do seu Proprietário como teto (próprias ∩ Proprietário — B88; documento 01, 17.1).
- **Resposta sugerida por Agente**: Rascunho (7.10), nunca Mensagem `interna` (DO-CXE-15).
- **Sessão de Chat ancorada em Conversa** (B21): lê a Conversa com as permissões do Membro; produz Rascunho; nunca envia.
- **Ferramentas** sobre a Caixa (ler Conversa, enviar Mensagem, atribuir, transferir, resolver, criar Tarefa a partir da Conversa) são do catálogo da plataforma (B16), com permissão requerida igual à do Membro (A6.3); avaliadas a cada invocação (B23).

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Caixa de Entrada | 1 | não | não | composição | B11; INV-ET-08. Múltiplas Caixas são C4 (rejeitada). |
| Caixa → Canal | 0..N | sim | sim | estrutural | Caixa vazia é válida (recém-criada; organização sem mensageria). Vários números, contas e endereços coexistem. |
| Canal → Tipo de Canal | 1 | não | não | referência global | Imutável (INV-CXE-02). |
| (Tipo de Canal, identificador externo) → Canal `ativo` | 0..1 | sim | não | — | INV-CXE-01: a mesma conta não é conectada duas vezes no Espaço de Trabalho. |
| Caixa → Fila | 0..N | sim | sim | estrutural | Organização pequena atende sem Filas: Conversas sem Fila, atribuição manual. |
| Canal → Fila padrão | 0..1 | sim | não | referência | Sem Fila padrão, Conversas nascem sem Fila (condição "Conversas sem Fila"). |
| Fila → elegíveis (Membro/Equipe) | 0..N | sim | sim | associativa | Fila sem elegíveis vale para `manual`. |
| Caixa → Conversa | 0..N | sim | sim | estrutural | |
| Conversa → Canal | 1 | não | não | referência | B12; imutável. |
| Conversa → Contato principal | 1 | não | não | referência | B12; INV-CON-11. Zero é impossível: a Conversa é *com alguém*; a criação automática garante o Contato (RN-CON-12). |
| (Contato, Canal) → Conversa `aberta` ou `pendente` (sem grupo) | 0..1 | sim | não | — | INV-CXE-03 (B12). Mais de uma tornaria ambígua a entrada de nova Mensagem. |
| (Contato, Canal) → Conversas (todas) | 0..N | sim | sim | — | Muitos episódios ao longo do tempo (B12). |
| Contato → Conversas não resolvidas em Canais distintos | 0..N | sim | sim | — | Uma por Canal (20.6). |
| Conversa → Fila | 0..1 | sim | não | referência | Conversa sem Fila é válida (Canal sem Fila padrão; Fila arquivada ou eliminada). |
| Conversa → Atribuído | 0..1 | sim | não | responsabilidade | A7. Zero: aguardando distribuição. Vários Atribuídos rejeitados: a responsabilidade por conduzir precisa ser inequívoca; vários Atendentes participam como Participantes (20.13). |
| Conversa → Mensagem | 1..N | não | sim | composição | Uma Conversa nasce com a sua primeira Mensagem (INV-CXE-05). |
| Mensagem → Conversa | 1 | não | não | composição | Imutável (RN-CXE-15). |
| Conversa → Participante | 1..N | não | sim | composição | Ao menos o Contato principal (INV-CXE-06). |
| Conversa → Participante `contato` principal | 1 | não | não | composição | B12. |
| Conversa → Participante `contato` adicional | 0..N | sim | sim | composição | Só em grupo (C5; 20.18). **DECISÃO NECESSÁRIA** em C5 sobre regras de grupo; a cardinalidade é fixada aqui para que o modelo as suporte. |
| Conversa → Participante `atendente`/`agente`/`observador` | 0..N | sim | sim | composição | Dois Atendentes podem ter respondido (20.13). |
| Mensagem → Remetente (Participante) | 0..1 | sim (Automação, Integração, Sistema) | não | papel | DO-CXE-12. |
| Mensagem → Ator | 1 | não | não | referência | A6.1. |
| Mensagem → Anexo | 0..N | sim | sim | componente | Texto sem Anexo; mídia sem texto; multimodal (INV-CXE-07 exige Conteúdo ou Anexo). |
| Anexo → Arquivo | 1 | não | não | referência | A8. |
| Arquivo → Anexos | 0..N | sim | sim | referência inversa | O mesmo Arquivo em várias Mensagens, Tarefas, Comentários. |
| Mensagem → Em resposta a | 0..1 | sim | não | referência | Mesma Conversa (INV-CXE-10). |
| Mensagem → Mensagem de modelo usada | 0..1 | sim | não | referência histórica | Só `enviada` por modelo. |
| Mensagem `recebida` → Identificador de Contato | 1 | não | não | referência | Por onde chegou; Marcador após eliminação do Contato. |
| Mensagem E-mail → Endereços adicionais | 0..N | sim | sim | objeto de valor | DO-CXE-13. |
| Mensagem → Reação | 0..N | sim | sim | objeto de valor | Só Tipos com a capacidade (ou internas). |
| Mensagem → Leitura interna | 0..N | sim | sim | objeto de valor | |
| Conversa → Rascunho | 0..N (um por Ator interno) | sim | sim | objeto de valor | DO-CXE-15. |
| Conversa → Adiamento | 0..1 | sim | não | objeto de valor | Só em `pendente` (INV-CXE-11). |
| Conversa → Vínculo com Negócio | 0..N | sim | sim | associativa | A8; 20.4. |
| Negócio → Vínculo com Conversa | 0..N | sim | sim | associativa | |
| Conversa → Vínculo com Tarefa | 0..N | sim | sim | associativa | DO-TAR-08. |
| Conversa → Tag | 0..N | sim | sim | associativa | B5. |
| Conversa → Valor de Campo | 0..N | sim | sim | contenção | Um por Definição aplicável. |
| Conversa → Empresa (derivada) | 0..1 | sim | não | derivada | DO-EMP-08. |
| Caixa / Fila → Automação (escopo) | 0..N | sim | sim | associativa (referência da Automação) | B41; DO-CXE-16. |
| Fila → Painel (Âncora) | 0..N | sim | sim | associativa | B102. |
| Caixa / Canal / Fila / Conversa → Proprietário | 0 | — | — | — | Nenhuma entidade deste documento tem Proprietário (DO-CXE-02). Sem sucessão (B28), exceto a liberação de Atribuído. |
| Membro → Disponibilidade de atendimento | 1 | não | não | objeto de valor | Sempre presente; padrão `disponível`. |

Única `DECISÃO NECESSÁRIA`: as regras de Conversa de grupo (C5), cuja cardinalidade o modelo já suporta; tudo o mais decorre da constituição ou das decisões da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** A Caixa de Entrada é filha direta do Espaço de Trabalho, par de Contatos, Empresas, Negócios e Funis (A2.2). A sua hierarquia interna tem dois níveis de contenção: Caixa → {Canal, Fila, Conversa} e Conversa → {Mensagem, Participante, Valor de Campo} → {Anexo}. Fila e Canal **não** são níveis acima da Conversa: a Conversa os referencia, e a referência à Fila muda por transferência. Isso é deliberado (DO-CXE-01): se a Fila contivesse Conversas, transferir seria "mover entre contêineres" (B40), arquivar a Fila arquivaria Conversas (B36) e permissões seriam herdadas da Fila — nada disso é desejável para um agrupamento operacional que muda a cada hora.

**Pertencimento (teste de existência).** A Caixa não existe sem o Espaço de Trabalho (composição). Canal, Fila e Conversa não existem sem a Caixa (contenção). Mensagem, Participante e Valor de Campo não existem sem a Conversa (composição). Anexo não existe sem a Mensagem (componente). Contato, Empresa, Negócio, Tarefa, Arquivo, Tag, Membro, Agente, Automação, Sessão de Chat e Tipo de Canal existem sem qualquer entidade deste documento: são referência ou associação. Em particular, **a Conversa sobrevive ao Contato** (Marcador de Contato eliminado, DO-CON-10), **à Fila** (referência limpa, 12.3) e **ao Membro Atribuído** (liberação, B28); não sobrevive ao Canal apenas porque o Canal nunca é eliminado enquanto tiver Conversas (DO-CXE-03).

**"Pertence a" versus "relaciona-se com".** A Conversa *pertence* à Caixa de Entrada. A Conversa *é com* um Contato (referência obrigatória, sem propriedade em nenhum sentido). A Conversa *está em* uma Fila (referência operacional). A Conversa *é atribuída a* um Ator (responsabilidade de execução). A Conversa *relaciona-se com* Negócios e Tarefas (Vínculo). O Contato *não possui* as suas Conversas; a Fila *não possui* as suas Conversas; o Atribuído *não possui* a Conversa.

**Propriedade.** **Nenhuma entidade deste documento tem Proprietário** (DO-CXE-02): Caixa de Entrada, Canal e Fila são infraestrutura organizacional (como Integração — B35 — e Funil — DO-FUN-02), com Criador ou Membro configurador para rastreabilidade e governança por Papel e `administrar`; Conversa tem Atribuído (responsabilidade de execução, 0..1, Membro ou Agente — B7), nunca Proprietário. A responsabilidade humana pelo relacionamento com a pessoa é do Proprietário do Contato (documento 10). Consequências: não há sucessão de Canais, Filas ou Conversas na remoção de Membro (B28); o que ocorre é a liberação do Atribuído (RN-CXE-24) e a limpeza de referências a Proprietário padrão de Contatos (RN-CXE-29).

**Configurar não é conter.** A Caixa configura o prazo de reabertura; isso não torna a Conversa filha da configuração. O Canal configura a Fila padrão; isso não torna a Fila filha do Canal. O Administrador configura Canais; isso não torna o Canal do Administrador (B35).

## 11. Estados

Todos os estados desta seção são **estados de sistema**, não personalizáveis. Nenhuma entidade deste documento tem Status (A4.2). A Caixa de Entrada **não tem estado próprio**: acompanha o Espaço de Trabalho (`ativo`, `suspenso`, `encerrado`; INV-ET-08), e o que muda em `suspenso` está em RN-CXE-27.

### 11.1 Canal

Dois eixos independentes, ambos de sistema:

| Estado de conexão (Integração) | Significado | Recebe? | Envia? |
| --- | --- | --- | --- |
| `conectada` | Credenciais válidas; provedor alcançável. | Sim. | Sim. |
| `desconectada` | Desconexão por ato (Administrador) ou por encerramento do Espaço de Trabalho; credenciais ausentes ou revogadas. | Não. | Não; Mensagens `enviada` ficam `pendente` (20.9). |
| `com erro` | Credenciais expiradas, conta bloqueada pelo provedor, falha persistente. Transição pelo Sistema. | Conforme o erro (o provedor pode reter). | Não; `pendente`. |

| Estado de ciclo de vida | Significado |
| --- | --- |
| `ativo` | Em uso. |
| `arquivado` | Desligado por decisão da organização; sempre `desconectada`; não recebe nem envia; Conversas históricas preservadas e consultáveis; o identificador externo deixa de ser reservado (INV-CXE-01 só conta `ativo`), permitindo reconectar a mesma conta em outro Canal (20.20). Reversível (reativar exige reconectar e ausência de colisão de identificador externo). |

O Canal **não tem `na lixeira` nem eliminação individual** (DO-CXE-03): todas as suas Conversas o referenciam imutavelmente, e eliminar o Canal deixaria Conversas sem Canal. É eliminado apenas com o Espaço de Trabalho (documento 01, 12.4). Um Canal `arquivado` sem nenhuma Conversa pode ser eliminado por Administrador (caso de conexão errada), como exceção verificável.

### 11.2 Fila

`ativo`, `arquivado`, `na lixeira` (A4.1). `arquivado`: não recebe Conversas novas nem transferidas; deixa de ser Fila padrão de Canais (referência limpa); Automações com escopo nela inoperantes (B41); Conversas `resolvida` continuam a referenciá-la; nenhuma Conversa não resolvida a referencia (RN-CXE-32). `na lixeira`: idem, oculta; Conversas `resolvida` continuam a referenciá-la até a eliminação, quando a referência é limpa e o nome à época permanece nos Registros de Atividade. Eliminação permanente não é estado.

### 11.3 Conversa

**Estado de conversa** (A4.5) — o eixo operacional:

| Estado | Definição precisa | Quem aguarda | Entra por | Sai por |
| --- | --- | --- | --- | --- |
| `aberta` | A Conversa **aguarda ação da organização**: há Mensagem `recebida` sem resposta, ou um Atendente decidiu que ainda há algo a fazer. É o estado que conta como "trabalho pendente" da organização. | A organização. | Criação por Mensagem recebida; Mensagem recebida em `pendente` ou em `resolvida` dentro do prazo; adiamento vencido; reabertura manual; ato de Membro/Agente. | Ato para `pendente` ou `resolvida`. |
| `pendente` | A Conversa **aguarda o Contato ou terceiro**: a organização respondeu e espera retorno, ou a Conversa foi adiada (Adiamento, 7.5) até um momento. Não conta como trabalho pendente da organização. | O Contato, um terceiro ou o relógio. | Ato de Membro/Agente/Automação após responder; adiamento. | Mensagem recebida (→ `aberta`, automático); adiamento vencido (→ `aberta`); ato para `aberta` ou `resolvida`. |
| `resolvida` | **Encerrada**: o episódio terminou; nada é aguardado. Estado de repouso. Reabrível. | Ninguém. | Ato de Membro/Agente/Automação; resolução automática por regra (mesclagem, RN-CXE-10; grupo desabilitado, 20.18). | Mensagem recebida dentro do prazo de reabertura (→ `aberta`, mesma Conversa); reabertura manual (→ `aberta`). Após o prazo, nova Mensagem cria **outra** Conversa (RN-CXE-09). |

Decisão sobre a semântica (DO-CXE-07): `aberta` = "bola com a organização"; `pendente` = "bola com o outro lado ou com o tempo"; `resolvida` = "sem bola". A alternativa "`pendente` = ainda não atribuída" foi rejeitada: "sem Atribuído" é condição derivada (Atribuído vazio), e misturá-la ao estado impediria representar "atribuída, aguardando o cliente". O envio de uma Mensagem `enviada` **não muda o estado por si** (a organização pode responder e continuar com algo a fazer); o produto pode oferecer "responder e marcar pendente" e "responder e resolver" como dois atos.

**Estado de ciclo de vida**: `ativo`, `na lixeira` (DO-CXE-03). Sem `arquivado`: `resolvida` cumpre o papel de repouso, e um segundo eixo de arquivamento duplicaria a semântica. `na lixeira` só para Conversa `resolvida` (RN-CXE-33): excluir uma Conversa `aberta` seria apagar trabalho pendente; resolve-se antes. Restaurar devolve `ativo` + `resolvida`. Eliminação permanente ao fim da Política de lixeira elimina Mensagens, Participantes, Anexos (referências), Valores de Campo, Vínculos; Registros de Atividade permanecem (INV-ET-12).

Condições derivadas, não estados: **sem Atribuído**, **sem Fila**, **fora da janela de resposta**, **sem resposta há X**, **não lida** (por Membro), **adiada**, **de grupo**.

### 11.4 Mensagem

A Mensagem **não tem estado de ciclo de vida** (não é arquivada nem vai à lixeira individualmente; acompanha a Conversa) e **não tem estado de conversa**. Tem, para direção `enviada`, o **status de entrega**:

| Status | Significado | Momento | Transições |
| --- | --- | --- | --- |
| `pendente` | Gravada; ainda não aceita pelo provedor (Canal desconectado, fila de saída, aguardando aprovação de Agente já satisfeita). | criação | → `enviada`, `falhou`. |
| `enviada` | Aceita pelo provedor; identificador externo atribuído. | aceite | → `entregue`, `lida`, `falhou` (rejeição posterior do provedor). |
| `entregue` | Provedor confirma entrega ao dispositivo/caixa do Contato. | confirmação | → `lida`. |
| `lida` | Provedor confirma leitura pelo Contato. Terminal. | confirmação | — |
| `falhou` | Não entregue, com **motivo** (Canal desconectado além do prazo, janela expirada sem modelo, número inválido, consentimento ausente, suspensão do Espaço de Trabalho, rejeição do provedor). Terminal. | falha | — Nova tentativa é **nova Mensagem** (RN-CXE-18). |

Quais status o provedor reporta é capacidade do Tipo de Canal (7.1): um Canal E-mail pode parar em `enviada`. Para `recebida`, o análogo interno é a **Leitura interna** (7.6), que não é status de entrega. Mensagem com **Marcação de exclusão** não é estado: é objeto de valor terminal.

### 11.5 Participante

Sem estado. "Presente" e "saiu" derivam do Momento de saída (7.7).

## 12. Ciclo de vida

### 12.1 Caixa de Entrada

Criada, vazia, no ato atômico de criação do Espaço de Trabalho (RN-ET-02; documento 01, 12.1, item 4), com Prazo de reabertura e Distribuição padrão nos valores da plataforma e sem Proprietário padrão de Contatos nem Horário de atendimento. Nunca excluída, arquivada ou duplicada. Eliminada em cascata com o Espaço de Trabalho (documento 01, 12.4), levando Canais, Filas, Conversas, Mensagens, Participantes e Anexos.

### 12.2 Canal

| Transição | Quem | Pré-condição / efeitos |
| --- | --- | --- |
| Criação (`ativo`, `desconectada`) → conexão (`conectada`) | Administrador ou Proprietário do ET (RN-ET-24: gerir Integrações e Canais é governança por Papel) | Tipo de Canal e credenciais; identificador externo obtido do provedor e verificado contra INV-CXE-01 (colisão rejeita a conexão apontando o Canal detentor). Membro configurador = quem conectou. Registro de Atividade; evento "Canal conectado". Sincronização inicial da Configuração de mensagens de modelo, quando aplicável. |
| `conectada` → `com erro` | Sistema | Falha persistente reportada pelo provedor. Evento; notificação aos Administradores. Mensagens `enviada` novas nascem `pendente`. |
| `com erro` → `conectada` | Sistema (recuperação) ou Administrador (reconexão) | Mensagens `pendente` são reenviadas conforme RN-CXE-20. |
| `conectada`/`com erro` → `desconectada` | Administrador; Sistema no encerramento do ET | Registro de Atividade. Conversas não resolvidas permanecem como estão (sem resolução automática). |
| `desconectada` → `conectada` | Administrador | Reconexão com a **mesma conta** (mesmo identificador externo) preserva o Canal; conta diferente é rejeitada — cria-se outro Canal (20.20). Membro configurador atualizado. |
| `ativo` → `arquivado` | Administrador | Exige `desconectada` (ou desconecta no ato). Fila padrão e referências de Canal de origem em Identificadores de Contato preservadas (documento 10, 7.1: limpas só na eliminação). Conversas não resolvidas neste Canal: **permanecem não resolvidas** (o produto lista e recomenda resolver); nenhuma resolução automática (princípio de RN-ET-17). Evento. |
| `arquivado` → `ativo` | Administrador | Exige reconexão e ausência de colisão em INV-CXE-01. |
| `arquivado` sem Conversas → eliminação | Administrador | Exceção verificável (11.1). Registro de Atividade. |

### 12.3 Fila

| Transição | Quem | Pré-condição / efeitos |
| --- | --- | --- |
| Criação (`ativo`) | Administrador ou Proprietário do ET | Nome único (RN-CXE-31); regra de distribuição; elegíveis opcionais. |
| Alterar elegíveis, regra, limite, Proprietário padrão, Horário | `administrar` sobre a Fila | Vale para distribuições futuras; Conversas já atribuídas não mudam (RN-CXE-24). Registro de Atividade. |
| `ativo` → `arquivado` | `administrar` | Rejeitado enquanto houver Conversa `aberta` ou `pendente` na Fila, salvo **transferência no mesmo ato** de todas para outra Fila `ativo` (ou para "sem Fila"), com um evento agregado. Canais que a têm como padrão perdem a referência (Registro em cada Canal). Automações com escopo nela ficam inoperantes (B41). |
| `arquivado` → `ativo` | `administrar` | Nome sem colisão (sempre satisfeito: `arquivado` reserva o nome). |
| `ativo`/`arquivado` → `na lixeira` | `excluir` (Papel de nível Administrador) | Mesma exigência de transferência das não resolvidas. Nome deixa de ser reservado. |
| `na lixeira` → Estado próprio anterior à exclusão (`ativo` ou `arquivado`) | `administrar` | Devolve o estado gravado na entrada na lixeira (B43); nunca força `ativo`. Renomear se colidir. |
| `na lixeira` → eliminação | Sistema (fim do prazo) ou `excluir` | Conversas `resolvida` que a referenciavam ficam com Fila vazia; nome à época permanece nos Registros de Atividade; Automações com escopo nela eliminadas (B41). |

### 12.4 Conversa

**Criação.** Sempre com a primeira Mensagem, no mesmo ato atômico (INV-CXE-05). Quatro origens:

1. **Mensagem recebida** de (Contato, Canal) sem Conversa não resolvida: o Sistema (Ator: o Canal, como Integração) cria a Conversa `aberta`, o Participante `contato` principal, a Mensagem `recebida` e, se necessário, o Contato e o Identificador (RN-CON-12). Fila = Fila padrão do Canal; Atribuído = conforme a regra de distribuição da Fila (RN-CXE-08). Se existir Conversa `resolvida` do par dentro do prazo de reabertura, **reabre** em vez de criar (RN-CXE-09).
2. **Iniciada pela organização**: Membro (ou Agente/Automação com permissão) escolhe Contato e Canal e envia a primeira Mensagem `enviada` (RN-CXE-21: exige Identificador do Contato do Tipo que o Canal resolve, consentimento vigente quando a Finalidade exigir — RN-CON-16 —, e, fora da janela, Mensagem de modelo). Nasce `pendente` (aguarda o Contato) ou `aberta`, por escolha do ator; Atribuído = o ator, salvo indicação; Fila = a padrão do Canal ou a escolhida. Rejeitada se já existir Conversa não resolvida do par (INV-CXE-03): o ator continua nela.
3. **Nota interna inicial**: Membro cria Conversa com um Contato por um Canal apenas com uma Mensagem `interna` (registrar um contato feito fora da plataforma). Nasce `resolvida` ou `aberta`, por escolha. Sujeita a INV-CXE-03.
4. **Mesclagem/transferência de Conversas** nunca cria Conversas: reaponta.

**Transições de estado de conversa** (11.3), todas com Registro de Atividade e evento:

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `aberta` | `pendente` | Membro, Agente Atribuído, Automação | Opcionalmente com Adiamento. |
| `aberta` | `resolvida` | idem | Momento de resolução; Adiamento descartado; Rascunhos preservados (o produto pode descartar). |
| `pendente` | `aberta` | Sistema (Mensagem recebida; adiamento vencido); Membro; Agente; Automação | Adiamento descartado. |
| `pendente` | `resolvida` | Membro, Agente, Automação | |
| `resolvida` | `aberta` (reabertura) | Sistema (Mensagem recebida dentro do prazo — RN-CXE-09); Membro; Agente; Automação (reabertura manual, sem prazo) | Momento da última reabertura; quantidade de reaberturas; **Atribuído preservado se ainda elegível e `ativo`**, senão liberado e redistribuído pela Fila (RN-CXE-08); Fila preservada se `ativo`, senão a padrão do Canal. |

**Atribuição, transferência e escalonamento** (eventos, não estados):

- **Atribuição**: define o Atribuído (Membro `ativo` elegível ou não — elegibilidade só restringe a distribuição automática e a auto-atribuição, não a atribuição por quem tem `administrar` — ou Agente). Por regra da Fila (rodízio, menor carga), por **auto-atribuição** (Membro elegível efetivo toma Conversa sem Atribuído — RN-CXE-14), por Membro com `administrar` sobre a Fila (ou sobre Conversas sem Fila), por Automação ou por Agente com permissão. Registra ator e Atribuído anterior (vazio). O Membro atribuído torna-se Participante `atendente`.
- **Transferência entre Atendentes**: substitui o Atribuído; o anterior permanece Participante `atendente` (histórico). Registra origem e destino.
- **Transferência entre Filas**: altera a referência à Fila; o Atribuído é **mantido** se elegível na Fila de destino ou se o ator o mantiver explicitamente; senão é liberado e a regra da Fila de destino distribui (RN-CXE-13). Evento com Fila de origem e destino.
- **Escalonamento** (Agente → humano): transferência cujo Atribuído anterior é um Agente; a Execução do Agente em andamento é cancelada (`cancelada`, B18) e um Rascunho parcial, se houver, é preservado (20.7). Por ato do Agente (Ferramenta "escalar", com motivo), de Membro, de Automação ou do Contato (uma Automação pode interpretar "falar com humano").
- **Delegação a Agente** (humano → Agente): transferência cujo destino é um Agente; sujeita ao nível de autonomia para o que o Agente pode fazer em seguida (8.6).

**Liberação**: o Atribuído é esvaziado quando o Membro é removido (B28; RN-CXE-24) ou quando um Agente é excluído ou perde a permissão de ver a Conversa (B23); a Conversa permanece na Fila e é redistribuída pela regra dela; sem Fila, fica sem Atribuído com evento "Conversa liberada".

**Lixeira e eliminação**: só de Conversa `resolvida` (RN-CXE-33), por `excluir`; restauração devolve `resolvida`; eliminação conforme 11.3. Eliminação por anonimização do Contato (documento 10, 12.5) **não elimina** a Conversa: anonimiza Mensagens.

### 12.5 Mensagem

Nasce e permanece: `recebida` (registrada pelo Canal, deduplicada por identificador externo — RN-CXE-17), `enviada` (criada por Membro, Agente, Automação ou Integração; status de entrega evolui conforme 11.4) ou `interna` (criada por Membro ou Agente). Não é editada (salvo edição pelo remetente externo transmitida pelo provedor), não é movida, não é eliminada individualmente; recebe Marcação de exclusão (irreversível) e é anonimizada com o Contato. Eliminada apenas com a Conversa.

### 12.6 Participante

Criado com a Conversa (principal), na primeira Mensagem `enviada`/`interna` de um Membro ou Agente, na atribuição, na adição como observador ou na entrada de Contato adicional (grupo). Sai (Momento de saída) por remoção de observador, saída do grupo ou ato explícito; o principal nunca sai. Eliminado com a Conversa.

## 13. Regras de negócio ontológicas

**Caixa, Canal e Fila**

- **RN-CXE-01.** Existe exatamente uma Caixa de Entrada por Espaço de Trabalho, criada com ele, nunca excluída nem duplicada; Canais, Filas e Conversas existem somente dentro dela (B11; A2.5).
- **RN-CXE-02.** Caixa de Entrada, Canal, Fila e Conversa não têm Proprietário; Canal tem Membro configurador (B35) e Criador; Fila tem Criador; Conversa tem Atribuído (0..1). Não há sucessão de nenhuma delas (B28).
- **RN-CXE-03.** Canal é Integração (documento 01, 7.4): obedece às regras de Integração (credenciais sigilosas, estados de conexão, Ator, gestão por Papel de nível Administrador — RN-ET-24) e acrescenta Tipo de Canal imutável, identificador externo único entre Canais `ativo` por (Tipo de Canal, valor), Fila padrão, Proprietário padrão e Origem padrão de Contatos e Configuração de mensagens de modelo.
- **RN-CXE-04.** Canal não tem `na lixeira` nem eliminação individual enquanto tiver Conversas; é arquivado (com desconexão) e eliminado apenas com o Espaço de Trabalho. Um Canal `arquivado` sem Conversas pode ser eliminado por Administrador.
- **RN-CXE-05.** Toda regra que dependa de capacidade de mensageria (anexos suportados, janela de resposta, mensagens de modelo, assunto e cópia, status reportados, reações, grupos, multimodalidade, identidade anônima) consulta as Capacidades do Tipo de Canal; nem o Canal nem a Conversa as redefinem.
- **RN-CXE-06.** Mensagem recebida por um Canal é resolvida ao Contato exclusivamente pelo par (Tipo, Valor) do Identificador de Contato (B13; documento 10, 7.1); sem Identificador correspondente, o Sistema cria Contato, Identificador, Conversa e Mensagem no mesmo ato (RN-CON-12), com Proprietário resolvido na ordem Fila → Canal → Caixa de Entrada → Proprietário do Espaço de Trabalho (DO-CXE-05) e Origem = Origem padrão do Canal. Contato `arquivado` ou `na lixeira` volta a `ativo` (DO-CON-15). Atingido o Limite de Contatos, a Mensagem é persistida em Conversa **sem Contato resolvido** (Contato principal = marcador "não resolvido" com o Identificador recebido), estado `aberta`, sem distribuição, com evento "Limite atingido"; a resolução ocorre quando houver capacidade ou por associação manual a um Contato existente (RN-CON-12), que reaponta a Conversa e aplica INV-CXE-03 (20.1).
- **RN-CXE-07.** Uma Conversa criada por Mensagem recebida entra na Fila padrão do Canal; sem Fila padrão, nasce sem Fila. Automações com escopo Caixa de Entrada podem transferi-la antes da distribuição.
- **RN-CXE-08.** A distribuição automática (regra `rodízio` ou `menor carga` da Fila, ou herdada da Caixa) atribui a Conversa sem Atribuído a um elegível efetivo `disponível` da Fila, respeitando o Limite de Conversas por Atendente; sem candidato, a Conversa fica sem Atribuído com evento "Fila sem capacidade" e é reavaliada quando um elegível se torna disponível ou resolve uma Conversa. A distribuição ocorre na criação, na reabertura sem Atribuído válido, na transferência de Fila sem Atribuído mantido e na liberação.
- **RN-CXE-09.** Mensagem recebida de (Contato, Canal) com Conversa `aberta` ou `pendente` entra nela (`pendente` → `aberta`). Com Conversa `resolvida` cujo Momento de resolução esteja dentro do Prazo de reabertura da Caixa, **reabre** a mesma Conversa (`resolvida` → `aberta`, evento "Conversa reaberta por Mensagem"). Além do prazo, **cria** Conversa nova. Reabertura manual não tem prazo. O prazo é único por Caixa (DO-CXE-04).
- **RN-CXE-10.** Após mesclagem de Contatos (DO-CON-11), se o sobrevivente ficar com duas Conversas `aberta` ou `pendente` no mesmo Canal, a Caixa mantém não resolvida a de **Mensagem mais recente** e marca a outra `resolvida` com causa "mesclagem", sem mover Mensagens, com evento e Registro de Atividade em ambas; o Atribuído e a Fila da que permanece prevalecem (20.17). Aplica-se igualmente à associação manual de Conversa sem Contato resolvido (RN-CXE-06) e a "mover Conversa para outro Contato" (RN-CXE-11).
- **RN-CXE-11.** Mover uma Conversa para outro Contato principal (após transferência de Identificador — DO-CON-12 — ou correção) é ato explícito de Membro com `editar` na Conversa e `ver` em ambos os Contatos, registrado nas duas pontas; rejeitado se o destino já tiver Conversa não resolvida no mesmo Canal, salvo resolução no mesmo ato (RN-CXE-10). Mensagens `recebida` continuam a referenciar o Identificador pelo qual chegaram.
- **RN-CXE-12.** Nenhuma regra de distribuição atribui Conversas a Agentes; Agente é Atribuído somente por ato de Membro, por Automação ou por Ferramenta de outro Agente com permissão (B7). Agente Atribuído responde ao Contato só em nível efetivo `autônomo`; em `supervisionado` e `assistido`, cada envio (Ferramenta de classe `externa`) gera Solicitação de Aprovação (B22; B64; B77), com Tempo limite padrão de 72 horas (B80). O nível pode ser reduzido por Automação, nunca ampliado.
- **RN-CXE-13.** Transferir Conversa entre Filas altera a referência e mantém o Atribuído se ele for elegível efetivo da Fila de destino ou se o ator o mantiver explicitamente; caso contrário, libera e distribui pela regra da Fila de destino. Fila de destino deve estar `ativo`. Evento com origem e destino.
- **RN-CXE-14.** Um Membro elegível efetivo de uma Fila pode auto-atribuir-se Conversas sem Atribuído dessa Fila; tomar uma Conversa já atribuída a outro é transferência e exige `administrar` sobre a Fila ou consentimento do Atribuído atual (o produto decide entre os dois; ambos são registrados).

**Conversa e Mensagem**

- **RN-CXE-15.** Toda Mensagem pertence a exatamente uma Conversa, definida na criação e imutável; Mensagens nunca são movidas, copiadas ou fundidas entre Conversas. Unir episódios é impossível; o que existe é o Vínculo entre registros e a reabertura dentro do prazo.
- **RN-CXE-16.** A Mensagem é imutável após gravada: Conteúdo, Anexos, direção, Remetente, Ator, momento e identificador externo não mudam. Exceções fechadas: transições de status de entrega, Leitura interna e Reações (acréscimo), edição pelo remetente externo transmitida pelo provedor (histórico preservado), Marcação de exclusão (terminal) e anonimização por eliminação do Contato. Mensagens `enviada` e `interna` nunca são editadas: corrige-se enviando outra.
- **RN-CXE-17.** Mensagens `recebida` são deduplicadas pelo identificador externo dentro do Canal: uma segunda entrega do provedor com o mesmo identificador não cria Mensagem nem evento.
- **RN-CXE-18.** Uma Mensagem `falhou` é terminal; reenviar cria Mensagem nova com Proveniência "reenvio de" (referência histórica à falhada). Mensagens `pendente` são reenviadas automaticamente pelo Sistema na reconexão do Canal (RN-CXE-20); nunca ficam `pendente` sem prazo.
- **RN-CXE-19.** Envio de Mensagem `enviada` por Tipo de Canal com janela de resposta, fora da janela (última `recebida` + janela), exige Mensagem de modelo `aprovado` da Configuração do Canal; Mensagem livre é **rejeitada** antes de gravar, para todo Ator; Automação e Agente falham com Registro (B18). Modelo de categoria `marketing` exige consentimento vigente (RN-CON-16).
- **RN-CXE-20.** Com o Canal `desconectada` ou `com erro`, Mensagens `enviada` novas são gravadas `pendente` (o ator é avisado; Automação e Agente registram a pendência, não falha). Na reconexão, o Sistema as envia na ordem de criação, **exceto** as que estiverem fora da janela de resposta sem modelo ou cujo Prazo de validade de envio pendente (configuração da plataforma; recomendação: 24 horas) tenha expirado — essas passam a `falhou` com motivo. Nunca descarte silencioso (DO-CXE-18).
- **RN-CXE-21.** Mensagem `enviada` iniciada pela organização (sem `recebida` anterior no episódio) exige: Contato com Identificador do Tipo que o Canal resolve (o principal daquele Tipo por padrão, documento 10, 7.1); consentimento vigente para a Finalidade quando exigido (RN-CON-16); Canal `conectada` (senão `pendente`); ausência de Conversa não resolvida do par (senão entra nela). Envio a vários Contatos é uma Mensagem por Conversa, cada uma sujeita a estas regras.
- **RN-CXE-22.** Mensagem `interna` é visível apenas a Atores internos com `ver` na Conversa e nunca é transmitida ao Canal, sob nenhuma configuração (INV-CXE-09). Menção a Membro, Equipe ou Agente em `interna` notifica o mencionado se ele tiver `ver` na Conversa (DO-TAR-19 por analogia) e não o torna Participante nem lhe concede permissão; o produto pode oferecer "adicionar como observador" como ato separado (20.14).
- **RN-CXE-23.** Mensagem enviada por Agente registra o Agente como Ator e, como ator delegante (A6.2), o Membro que o acionou na Conversa (interseção de permissões, A9.3); o Agente Atribuído **invocado pela chegada de uma Mensagem** age com Origem `Caixa de Entrada`, **sem delegante** e com as próprias permissões (RN-AGE-11; RN-AGE-14); o Agente **invocado por Ação de Automação** tem a **Automação como delegante** e igualmente só as próprias permissões (DO-AUT-15; RN-AUT-25) — a cadeia de delegantes é derivável da Cadeia de Execuções (B79). Mensagem enviada por Automação registra a Automação como Ator e o seu Proprietário (ou o acionador, no Gatilho manual — RN-AUT-19) como delegante, sem Participante (DO-CXE-12). Permissões e consentimento são verificados na invocação da Ferramenta (B23); se a permissão for revogada após a Mensagem ter sido aceita pelo provedor, a Mensagem permanece e segue o seu status (20.8).
- **RN-CXE-24.** Na remoção de um Membro (B28), toda Conversa de que é Atribuído é liberada no mesmo ato e redistribuída pela regra da sua Fila (sem Fila: fica sem Atribuído, com evento); ele é retirado dos elegíveis de todas as Filas; permanece como Participante `atendente` histórico e como Ator das suas Mensagens. Membro `suspenso` mantém as Conversas atribuídas e não recebe novas (RN-ET-08; Disponibilidade derivada `indisponível`). Sair de uma Equipe ou dos elegíveis **não** libera Conversas já atribuídas.
- **RN-CXE-25.** Conversa não recebe Comentários; a manifestação interna sobre a Conversa é Mensagem `interna` (DO-CXE-08). Fatos da Conversa (atribuição, transferência, resolução) são Registros de Atividade, não Mensagens.
- **RN-CXE-26.** Resposta gerada por Agente ou copiada de Sessão de Chat é Rascunho (objeto de valor, um por Ator interno por Conversa), nunca Mensagem; enviar cria Mensagem nova com Proveniência (DO-CXE-15).
- **RN-CXE-27.** Com o Espaço de Trabalho `suspenso` (B31): Canais permanecem conectados; Mensagens `recebida` são persistidas (Conversa criada ou reaberta pelas regras normais, **sem** distribuição, Automação, Agente ou resposta); nada é enviado — Mensagens `enviada` com status `pendente` no momento da suspensão passam a `falhou` com motivo "suspensão", e nenhuma nova é criada; Adiamentos que vencem durante a suspensão devolvem a Conversa a `aberta` sem distribuição. Na reativação, as Conversas sem Atribuído são distribuídas a partir daquele momento (20.10).
- **RN-CXE-28.** Conversas de grupo (Tipo de Canal com capacidade "grupos"; C5): a Mensagem de grupo é persistida em Conversa com Identificador de grupo, Contato principal = o Contato que enviou a primeira Mensagem do episódio (ou o que a organização designar), Participantes `contato` adicionais para cada remetente resolvido; INV-CXE-03 **não** se aplica a Conversas com Identificador de grupo (a chave delas é (Identificador de grupo, Canal)); com "Grupos habilitados" falso no Canal, a Conversa nasce `resolvida`, sem Fila nem distribuição, e novas Mensagens a reabrem sem distribuir. As demais regras de grupo (quem responde, consentimento, Proprietário de Contatos criados por grupo) permanecem em C5 (20.18).
- **RN-CXE-29.** Proprietário padrão de Contatos (Caixa, Canal, Fila) referencia Membro `ativo`; ao deixar de estar `ativo`, o atributo é limpo com Registro de Atividade e a resolução de DO-CXE-05 segue ao próximo nível; nunca falha: o Proprietário do Espaço de Trabalho é o último nível (INV-ET-02).
- **RN-CXE-30.** Toda ação sobre Caixa, Canal, Fila, Conversa, Mensagem e Participante gera Registro de Atividade com Ator e ator delegante (A6.2), inclusive as do Sistema (criação por Mensagem, reabertura, resolução por mesclagem, liberação, reenvio, adiamento vencido). O Registro de Atividade de Mensagem tem a Conversa como objeto raiz.
- **RN-CXE-31.** Nomes de Fila são únicos entre Filas `ativo` e `arquivado` da Caixa, e nomes de Canal únicos entre Canais `ativo`, sem distinção de maiúsculas e de espaços nas extremidades (modelo de B39 e DO-FUN-16); `na lixeira` não reserva nome.
- **RN-CXE-32.** Fila `arquivado` ou `na lixeira` não recebe Conversas novas nem transferidas e não é referenciada por Conversa `aberta` ou `pendente`; arquivar ou excluir exige transferir as não resolvidas no mesmo ato. Conversas `resolvida` continuam a referenciá-la até a eliminação.
- **RN-CXE-33.** Só Conversa `resolvida` pode ir à lixeira; restaurar devolve `resolvida`. Eliminação permanente elimina Mensagens, Participantes, Anexos (referências), Valores de Campo e Vínculos; Registros de Atividade permanecem; Arquivos permanecem salvo anonimização.
- **RN-CXE-34.** Definições de Campo com entidade-alvo Conversa são do Espaço de Trabalho (A5.2); nem Caixa, nem Fila, nem Canal definem Definições de Campo, Tags ou Automações (RN-ET-13; B41 define escopo, não pertencimento).
- **RN-CXE-35.** Endereços adicionais de Mensagem E-mail (para, cópia, cópia oculta) são objeto de valor da Mensagem; não criam Participantes, Contatos nem Conversas; o Contato resolvido é derivado por consulta. Uma resposta enviada pela organização copia os Endereços adicionais por escolha explícita do ator (o padrão é "responder a todos", conforme o produto), e cada cópia continua a não ser Participante (DO-CXE-13; 20.3).
- **RN-CXE-36.** Chat do site com visitante não identificado cria Contato Não identificado com Identificador `identificador de chat do site` (verificado por posse da sessão); quando o visitante informa e-mail ou telefone, o Membro, uma Automação ou o Sistema (se a capacidade do Canal o verificar) **acrescenta** o Identificador ao mesmo Contato — se o novo Identificador já pertencer a outro Contato, a criação é rejeitada (RN-CON-11) e o caminho é mesclar, o que aplica RN-CXE-10 (20.19).

## 14. Invariantes

- **INV-CXE-01.** Não existem dois Canais `ativo` no mesmo Espaço de Trabalho com o mesmo (Tipo de Canal, identificador externo).
- **INV-CXE-02.** O Tipo de Canal de um Canal nunca muda.
- **INV-CXE-03.** Para cada par (Contato não `mesclado`, Canal), existe no máximo uma Conversa sem Identificador de grupo com estado `aberta` ou `pendente` (B12). Para cada (Identificador de grupo, Canal), no máximo uma não resolvida.
- **INV-CXE-04.** Toda Conversa referencia exatamente um Canal da mesma Caixa de Entrada, imutável, e exatamente um Contato principal (não `mesclado`) ou Marcador de Contato eliminado ou marcador "não resolvido" (RN-CXE-06), do mesmo Espaço de Trabalho.
- **INV-CXE-05.** Toda Conversa tem ao menos uma Mensagem em todo instante; toda Mensagem pertence a exatamente uma Conversa.
- **INV-CXE-06.** Toda Conversa tem exatamente um Participante `contato` principal, que referencia o Contato principal e nunca tem Momento de saída.
- **INV-CXE-07.** Toda Mensagem não anonimizada e sem Marcação de exclusão tem Conteúdo não vazio ou ao menos um Anexo.
- **INV-CXE-08.** Dentro de um Canal, não existem duas Mensagens com o mesmo identificador externo.
- **INV-CXE-09.** Nenhuma Mensagem `interna` é transmitida a um Canal; nenhuma Mensagem `recebida` tem status de entrega; toda Mensagem `enviada` tem exatamente um status de entrega.
- **INV-CXE-10.** "Em resposta a" referencia sempre uma Mensagem da mesma Conversa.
- **INV-CXE-11.** Adiamento existe se e somente se a Conversa está `pendente` com adiamento; o seu momento é posterior ao momento em que foi definido.
- **INV-CXE-12.** O Atribuído de uma Conversa é um Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho ou um Agente do mesmo Espaço de Trabalho; nunca um Membro `pendente` ou `removido`, nunca um Contato (INV-CON-13), nunca mais de um.
- **INV-CXE-13.** Nenhuma Conversa `aberta` ou `pendente` referencia Fila `arquivado` ou `na lixeira`; nenhuma Conversa `na lixeira` está `aberta` ou `pendente`.
- **INV-CXE-14.** Caixa de Entrada, Canal, Fila e Conversa nunca têm Proprietário.
- **INV-CXE-15.** A Fila padrão de um Canal, quando preenchida, é uma Fila `ativo` da mesma Caixa de Entrada.
- **INV-CXE-16.** Proprietário padrão de Contatos (Caixa, Canal, Fila), quando preenchido, é Membro `ativo` do mesmo Espaço de Trabalho.
- **INV-CXE-17.** Toda Mensagem `enviada` por Tipo de Canal com janela de resposta, criada fora da janela, referencia uma Mensagem de modelo.
- **INV-CXE-18.** Nenhuma relação deste documento cruza a fronteira do Espaço de Trabalho (INV-ET-07); Tipos de Canal, únicos elementos globais, são referenciados e nunca contidos.

## 15. Personalização

**Personalizável** (por Administrador ou Proprietário do Espaço de Trabalho, salvo indicação):

- Caixa de Entrada: Prazo de reabertura, Distribuição padrão, Proprietário padrão de Contatos, Horário de atendimento.
- Canais: conectar, desconectar, arquivar; nome; Fila padrão; Proprietário padrão e Origem padrão de Contatos; Grupos habilitados; sincronizar Configuração de mensagens de modelo (o conteúdo dos modelos é aprovado no provedor, não editado aqui). Governança por Papel (RN-ET-24).
- Filas: criar, arquivar, excluir (Papel); nome, descrição, elegíveis, regra de distribuição, Limite por Atendente, Proprietário padrão de Contatos, Horário de atendimento (`administrar` sobre a Fila, concedível a Membros e Equipes — DO-CXE-19).
- Conversa: Título, Tags, Valores de Campo, Fila, Atribuído, estado, Adiamento, Vínculos (`editar`).
- Membro: a própria Disponibilidade de atendimento (o próprio Membro; Administrador; Automação por Horário).
- **Definições de Campo Personalizado** com entidade-alvo Conversa (A5.2), de qualquer Tipo de Campo; **Tags** aplicáveis a Conversa (B5); **Automações** com escopo Caixa de Entrada ou Fila (B41; DO-CXE-16); **Widgets** com Fonte de Dados na Caixa, em Fila, Canal ou Conversas; **Visualizações** pessoais de Conversas.

**Não personalizável:**

- Unicidade da Caixa (B11); ausência de Proprietário; identidade, Criador e momentos.
- Estados de conversa e suas transições (A4.5; 11.3); estados de conexão do Canal; status de entrega; imutabilidade da Mensagem.
- Capacidades dos Tipos de Canal (plataforma); Tipos de Identificador (plataforma).
- O invariante de uma Conversa não resolvida por (Contato, Canal); a resolução de Mensagem por Identificador; a criação automática de Contato.
- Prazo de reabertura por Fila ou Canal (DO-CXE-04); prioridade nativa (DO-CXE-10); Comentários em Conversa (DO-CXE-08).
- Prazo de validade de envio pendente (plataforma; RN-CXE-20).

Não há Campos Personalizados sobre Canal, Fila, Mensagem, Participante ou Anexo (A5.2; C13). "Motivo de resolução" ou "categoria de atendimento" são Definições de Campo de Conversa; "departamento" é Fila; "urgência" é Tag ou Definição de Campo.

## 16. Herança

Nenhuma entidade deste documento **herda** configuração no sentido de B25: o CRM não tem hierarquia de contêineres (A5.2), e Fila e Canal não são níveis acima da Conversa (DO-CXE-01). O que existe é **resolução em cascata de padrões**, derivada a cada consulta, nunca copiada:

| Aspecto | Cadeia de resolução | Natureza |
| --- | --- | --- |
| Proprietário de Contato criado automaticamente | Fila → Canal → Caixa de Entrada → Proprietário do Espaço de Trabalho | Derivação no ato de criação (DO-CON-08; DO-CXE-05); depois, o Proprietário é do Contato. |
| Regra de distribuição | Fila (`herdar da Caixa` → Distribuição padrão da Caixa) | Derivação a cada distribuição. |
| Horário de atendimento | Fila → Caixa de Entrada → (C12: configuração global, quando existir) | Derivação a cada avaliação. |
| Fila da Conversa | Fila padrão do Canal na criação | Padrão inicial, gravado na Conversa; não acompanha mudanças posteriores do Canal. |
| Origem de Contato criado automaticamente | Origem padrão do Canal | Padrão inicial, gravado no Contato. |
| Capacidades | Tipo de Canal | Referência global; não é padrão sobrescritível. |

O que a Caixa recebe do Espaço de Trabalho por **escopo** (documento 01, 16): Definições de Campo de Conversa, Tags, Localidade (fuso do Horário de atendimento e exibição de momentos), Política de lixeira (Conversas e Filas `na lixeira`), Limites impostos (Canais, Contatos criados automaticamente, armazenamento de Anexos), Papéis. A Conversa **não herda** nada da Fila nem do Canal (permissões, Tags, Valores); o Participante não herda nada do Membro além da referência; a Mensagem não herda nada da Conversa além do pertencimento.

## 17. Permissões e visibilidade

### 17.1 Recursos e ações

| Recurso | ver | comentar | criar | editar | excluir | administrar | executar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Caixa de Entrada** | ver a existência, Canais, Filas (nomes) | — | — | — | — | configurar Prazo de reabertura, Distribuição padrão, Proprietário padrão, Horário; conceder permissões | — |
| **Canal** | ver Canal e estado | — | conectar (Papel) | nome, Fila padrão, padrões de Contato, Grupos habilitados | arquivar (Papel) | conceder; sincronizar modelos | — |
| **Fila** | ver Fila, elegíveis, Conversas da Fila (sujeito a `ver` em cada Conversa) | — | criar (Papel) | nome, descrição, Horário | lixeira (Papel) | elegíveis, regra, Limite, Proprietário padrão, arquivar, conceder; atribuir e transferir qualquer Conversa da Fila | — |
| **Conversa** | ler Mensagens (`recebida`, `enviada`, `interna`), Participantes, Anexos, Vínculos cujo outro lado vê, Valores, Rascunho de Agente | — (não há Comentário; `interna` exige `editar`) | iniciar Conversa (Contato + Canal) | enviar Mensagens, `interna`, Título, Tags, Valores, estado, Adiamento, Vínculos, auto-atribuir (se elegível), transferir a própria | lixeira e restaurar (só `resolvida`) | atribuir e transferir a terceiros, mover para outro Contato, marcar exclusão de Mensagem, conceder, compartilhar | — |
| **Mensagem** | — (é o `ver` da Conversa) | — | — (é o `editar` da Conversa) | — (imutável) | Marcação de exclusão (`administrar` na Conversa; ou o próprio Ator autor de `interna`) | — | — |

`executar` não se aplica a nenhum Recurso deste documento. Escopos: `registro` (uma Conversa, uma Fila, um Canal) e `próprios` (Conversas em que o Sujeito é Atribuído ou Criador — B29); `subárvore` não se aplica (a Caixa não é contêiner estrutural). **Fila como escopo de permissão** (DO-CXE-19): uma concessão sobre uma Fila com escopo `registro` alcança a Fila e, por regra desta seção, as Conversas **atualmente** nela — é o mecanismo pelo qual "a Equipe Suporte vê as Conversas da Fila Suporte" sem conceder Conversa a Conversa; a Conversa que sai da Fila deixa de ser vista por essa origem. Não é herança estrutural (B25): é uma origem de permissão avaliada a cada consulta sobre a referência à Fila (registrada como candidata a decisão B; seção 24).

### 17.2 Origens e padrão recomendado

| Papel | Caixa / Canais / Filas (configuração) | Conversas |
| --- | --- | --- |
| Proprietário do ET / Administrador | Tudo (governança por Papel — RN-ET-24; gerir Canais é gerir Integrações). | ver, criar, editar, excluir, administrar em todas (escopo `registro`). |
| Membro | Ver Filas e Canais (nomes, estado). Nada de configuração, salvo `administrar` concedido sobre uma Fila. | Padrão recomendado (documento 01, 17.2): **ver e editar as Conversas das Filas de que é elegível e as sem Fila** (origem: concessão implícita por elegibilidade — DO-CXE-19) e as `próprios` (Atribuído/Criador); Papéis personalizados podem restringir a `próprios` ou ampliar a todas. |
| Convidado | Nada por Papel. | Só Conversas compartilhadas individualmente (`ver`; `editar` se concedido). |
| Agente | Nunca `administrar` sobre Caixa, Canal ou Fila (INV-ET-13 por analogia; B38). | Papel próprio e concessões diretas; ser Atribuído **não** concede `ver` — exige-o (INV-CXE-12 é verificado contra a permissão no ato de atribuir). |

Justificativa do padrão "Conversas da minha Fila": o Atendente precisa ver Conversas que ainda não são suas para auto-atribuir-se (RN-CXE-14) e para cobrir colegas; sem isso, cada Fila exigiria concessão Conversa a Conversa. Restrição "só as minhas" continua possível por Papel personalizado com `próprios`.

### 17.3 Visibilidade de Mensagens `interna` e de Anexos

`interna` é visível a quem tem `ver` na Conversa (é parte dela); não há visibilidade seletiva por Membro (uma `interna` "só para o supervisor" não existe: usa-se Comentário no Contato compartilhado, ou Tarefa). Anexos seguem o `ver` da Conversa; o Arquivo subjacente pode ser referenciado por outros registros com permissões próprias (A8): ver a Mensagem dá acesso ao Arquivo por meio dela, não ao Arquivo em geral.

### 17.4 IA sujeita às mesmas regras

Agente e Automação leem, atribuem, transferem, resolvem e enviam com as suas permissões (A6.3; A9.3 para interseção em nome de Membro); verificadas a cada Ferramenta (B23). A aprovação é decidida por Ferramenta invocada e classe de efeito (B77), conforme a lista consolidada de B64: enviar Mensagem a Contato é `externa` — `supervisionado` exige aprovação (B22); todo nível respeita consentimento (RN-CON-16), janela (RN-CXE-19) e Limites impostos. Marcar exclusão de Mensagem e mover Conversa entre Contatos são `escrita irreversível`: aprovação em `supervisionado`. Toda Solicitação de Aprovação tem Tempo limite padrão de 72 horas (B80). Painéis sobre Conversas filtram pelo visualizador (B20): "Conversas por Atendente" de um Membro com `próprios` mostra só as dele. Sessão de Chat ancorada em Conversa lê com as permissões do Membro; um Agente principal da Sessão sem `ver` na Conversa não a recebe no Contexto.

### 17.5 Exceções

Não há exceções ao isolamento (INV-ET-07). O Sistema cria e reabre Conversas, resolve por mesclagem, libera Atribuídos e reenvia `pendente` sem Sujeito de permissão: ação do Sistema, registrada. O Contato nunca é Sujeito: o que ele "faz" chega como fato do Canal (documento 10, 1).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Canal conectado / desconectado / com erro / reconectado | 12.2 | Canal, Tipo de Canal, identificador externo, ator ou causa | Administradores (notificação); reenvio de `pendente`; Painéis |
| Canal arquivado / reativado | 12.2 | Canal, ator, Conversas não resolvidas à época | Auditoria; produto (lista de pendências) |
| Configuração de mensagens de modelo sincronizada | 7.3 | Canal, modelos aprovados/rejeitados | Automações que usam modelo; Agentes |
| Fila criada / alterada / arquivada / restaurada / excluída | 12.3 | Fila, antes, depois, ator; na transferência agregada, Fila de destino e lista | Automações; Painéis; Canais (Fila padrão limpa) |
| Elegíveis da Fila alterados | 7.4 | Fila, Membros/Equipes antes e depois, ator | Distribuição; permissões (DO-CXE-19) |
| Disponibilidade de atendimento alterada | 7.8 | Membro, antes, depois, origem | Distribuição; Painéis |
| Conversa criada | 12.4 | Conversa, Canal, Contato principal, origem (Mensagem recebida, iniciada, nota interna), Fila, Criador | Automações (boas-vindas, triagem); Painéis; distribuição |
| Mensagem recebida | 12.5 | Conversa, Mensagem, Identificador, Contato, Anexos (tipos), texto | Automações (Gatilho principal da Caixa); Agentes; notificação ao Atribuído; `pendente` → `aberta` |
| Mensagem enviada / entregue / lida / falhou | 11.4 | Mensagem, status, momento, motivo (falha), Ator, delegante | Painéis (entrega); Automações (falha); notificação ao Ator |
| Mensagem interna registrada | 12.5 | Mensagem, Ator, menções | Notificação a mencionados (RN-CXE-22) |
| Mensagem marcada como excluída / editada pelo remetente externo | 7.6 | Mensagem, origem, ator | Auditoria; produto |
| Contato criado automaticamente por Mensagem | RN-CXE-06 | Contato, Identificador, Conversa, Proprietário resolvido, nível da resolução | Documento 10; notificação ao Proprietário; Automações de qualificação |
| Conversa sem Contato resolvido (Limite atingido) | RN-CXE-06 | Conversa, Identificador recebido | Proprietário do ET; produto (associação manual) |
| Conversa atribuída / transferida entre Atendentes / liberada | 12.4 | Conversa, Atribuído anterior e novo, ator, causa (regra, auto-atribuição, remoção, escalonamento) | Notificação; Painéis (carga); Execução de Agente (cancelar no escalonamento) |
| Conversa transferida entre Filas | RN-CXE-13 | Conversa, Fila origem e destino, Atribuído mantido ou liberado, ator | Automações das duas Filas; Painéis |
| Fila sem capacidade | RN-CXE-08 | Fila, Conversa | Administradores; Automações (redirecionar) |
| Estado de conversa alterado (`aberta` / `pendente` / `resolvida`) | 11.3 | Conversa, antes, depois, ator, causa (ato, Mensagem, adiamento vencido, mesclagem, prazo) | Automações (pesquisa de satisfação ao resolver); Painéis (tempo de resolução) |
| Conversa reaberta | RN-CXE-09 | Conversa, causa (Mensagem dentro do prazo, manual), quantidade de reaberturas | Automações; Painéis (reincidência) |
| Conversa adiada / adiamento vencido | 7.5 | Conversa, momento, motivo | Automações; notificação ao Atribuído |
| Sem resposta há X | derivado; não é evento da Caixa | — | Gatilho de agendamento de Automação avaliando "tempo de espera atual" (DO-FUN-12 por analogia) |
| Fora do horário de atendimento | derivado na chegada de Mensagem | Conversa, Fila, Horário aplicável | Automação (resposta automática por modelo) |
| Janela de resposta expirada | derivado; opcionalmente emitido pelo Sistema | Conversa, momento | Automação (enviar modelo antes de expirar); Agentes |
| Rascunho gerado por Agente | 7.10 | Conversa, Agente, Execução | Notificação ao Atribuído; produto |
| Vínculo Conversa-Negócio / Conversa-Tarefa criado / removido | 7.12 | Conversa, destino, ator | Documentos 12 e 06; linha do tempo do Contato |
| Tarefa / Negócio criado a partir da Conversa | 8.4, 8.5 | Conversa, registro criado, Proveniência | Documentos 06 e 12 |
| Contato principal reapontado (mesclagem) / substituído por Marcador (eliminação) / movido (RN-CXE-11) | 8.2 | Conversa, Contato antes e depois, causa | Auditoria; Painéis |
| Conversa resolvida por mesclagem | RN-CXE-10 | Conversa resolvida, Conversa mantida, Contato sobrevivente | Auditoria; Atribuído da resolvida (notificação) |
| Tag aplicada / removida; Valor de Campo alterado | 7.5 | Conversa, Tag/Definição, antes, depois, ator | Automações; Painéis |
| Conversa enviada à lixeira / restaurada / eliminada | 12.4 | Conversa, ator | Auditoria; Vínculos |
| Espaço de Trabalho suspenso / reativado (consumido) | documento 01, 18 | — | Caixa: parar distribuição e envio; na reativação, distribuir as persistidas (RN-CXE-27) |
| Membro removido / suspenso (consumido) | documento 01, 18 | Membro, Sucessor | Caixa: liberar Conversas (RN-CXE-24); limpar Proprietário padrão (RN-CXE-29); retirar de elegíveis |
| Contatos mesclados / Contato eliminado / anonimizado (consumido) | documento 10, 18 | Sobrevivente, absorvido; identificador opaco | Caixa: reapontar, resolver duplicidade (RN-CXE-10); Marcador; anonimizar Mensagens |

Todos geram Registro de Atividade com a entidade como objeto (Mensagem com a Conversa como raiz), Ator e ator delegante (A6.2). "Mensagem recebida" e "Conversa criada" são os Gatilhos mais frequentes do domínio; "Estado de conversa alterado" e "Conversa atribuída" alimentam os Painéis de atendimento.

## 19. Dependências

**A Caixa de Entrada depende de:** Espaço de Trabalho (composição; Localidade; Política de lixeira; Limites impostos — Canais, Contatos, armazenamento; Papéis; Equipes para elegíveis; sucessão e liberação — B28); Tipos de Canal e suas Capacidades (plataforma, A1.3); Tipos de Identificador (documento 10, 7.1); Contato (resolução de Mensagens, criação automática — RN-CON-12 —, restauração — DO-CON-15 —, mesclagem e eliminação — DO-CON-10/11 —, consentimento — RN-CON-16); Origem (catálogo, para Origem padrão do Canal); Arquivo (Anexos, A8); Definições de Campo de Conversa e Tags (catálogos, B34); provedores externos (fora da ontologia: fornecem identificadores externos, status de entrega, aprovação de modelos).

**Dependem da Caixa de Entrada:** Contato (Última interação, linha do tempo — documento 10, 6 e 8.1; Canal de origem do Identificador); Empresa (linha do tempo derivada — documento 11, 8.4); Negócio (Vínculo Conversa-Negócio; "criar Negócio a partir da Conversa"); Tarefa (Vínculo; "criar Tarefa a partir da Conversa" — documento 06, 12.1; B49); Agentes (Atribuído; Ferramentas de mensageria; Rascunho; escalonamento); Automações (escopo Caixa e Fila — B41 ampliada por DO-CXE-16; Gatilhos da seção 18; Ação "enviar Mensagem"); Chat (âncora de Sessão em Conversa — B21); Painéis (Fontes de Dados: Conversas de uma Fila, de um Canal, da Caixa; derivados de tempo); Membro (Disponibilidade de atendimento — ampliação do documento 01, 7.1).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) — confirma a composição 1:1, a persistência em suspensão (B31), a ausência de Proprietário em Canal (B35), e recebe a ampliação do Membro (Disponibilidade) e a resolução de DO-CON-08 com o nível Caixa; Contato (10) — obedece integralmente a DO-CON-03, 08, 09, 10, 11, 12, 15 e resolve a questão 5 daquele documento (RN-CXE-10); Empresa (11) — obedece a DO-EMP-08, RN-EMP-06 e RN-EMP-15; Funil (13) — par sem dependência; Negócio (12) — receberá o Vínculo Conversa-Negócio e "criar Negócio a partir da Conversa"; Agentes (17), Automações (19) e Chat (16) — recebem a seção 8.6, RN-CXE-12, RN-CXE-19, RN-CXE-20, RN-CXE-23, RN-CXE-26 e os Gatilhos; Painéis (21) — recebe os derivados de tempo e as Fontes de Dados.

## 20. Casos limítrofes e ambiguidades

### 20.1 Mensagem recebida de número desconhecido

O Canal WhatsApp "Recepção" recebe Mensagem de `identidade de WhatsApp` sem Identificador correspondente. No mesmo ato atômico (RN-CON-12; RN-CXE-06): Contato Não identificado (Nome vazio; Nome de exibição = rótulo do WhatsApp), Identificador verificado e principal com Canal de origem, Conversa `aberta` na Fila padrão do Canal, Participante `contato` principal, Mensagem `recebida`. Proprietário do Contato: o configurado na Fila; senão no Canal; senão na Caixa de Entrada; senão o Proprietário do Espaço de Trabalho (DO-CON-08; DO-CXE-05). Origem = Origem padrão do Canal. Distribuição pela regra da Fila. **Com o Limite de Contatos atingido**, a Conversa nasce com Contato principal = marcador "não resolvido" (guardando o Identificador recebido), `aberta`, sem Fila nem distribuição, com evento "Limite atingido"; o Atendente pode associá-la manualmente a um Contato existente (que reaponta e aplica INV-CXE-03) ou aguardar capacidade (o Sistema resolve na próxima Mensagem ou por rotina). Não se cria "Contato provisório" (DO-CON-08).

### 20.2 Mensagem com áudio e imagem

Depende da capacidade "multimodal em uma Mensagem" do Tipo de Canal (7.1). **E-mail ou Chat do site**: uma Mensagem com Conteúdo (texto) e dois Anexos (áudio, imagem); Tipo de conteúdo derivado `multimodal`. **WhatsApp ou Instagram**: o provedor entrega três itens (texto, áudio, imagem com legenda opcional), cada um com identificador externo e status próprios; são **três Mensagens** consecutivas, mesmo Remetente, momentos próximos; o produto pode agrupá-las visualmente, mas a ontologia não as funde (DO-CXE-11) — se o Contato apagar a imagem no provedor, só aquela Mensagem recebe Marcação de exclusão. Transcrição do áudio e descrição da imagem, se geradas por Agente, são derivados do Anexo (7.11), não Mensagens nem Conteúdo. No envio pela organização, o Ator compõe uma Mensagem; a plataforma a fragmenta conforme o Tipo, cada fragmento com Proveniência "parte de".

### 20.3 Mensagem de e-mail com cinco destinatários em cópia

O Canal E-mail recebe uma Mensagem de `ana@alfa.com` com cinco endereços em cópia. A Conversa é com o Contato resolvido pelo remetente (Ana); os cinco endereços são **Endereços adicionais** da Mensagem (objeto de valor: tipo `cópia`, endereço, nome exibido), com **Contato resolvido** derivado por consulta a Identificadores `e-mail` no momento da leitura (DO-CXE-13). **Não são Participantes**: não têm Momento de entrada, não recebem papel, não são notificados pela plataforma, não afetam INV-CXE-03 (se um deles tiver Conversa aberta própria no mesmo Canal, nada muda). **Mesmo quando resolvidos a Contatos**, não viram Participantes automaticamente — a decisão de que alguém "toma parte" é da organização (adicionar como Participante `contato` adicional é ato explícito, hoje restrito a grupos, C5). Justificativa: cópias de e-mail são notoriamente ruidosas (listas, assistentes, sistemas), e cada cópia virando Participante ou Contato produziria dezenas de Contatos Não identificados por e-mail recebido. Ao responder, o ator escolhe manter as cópias (Endereços adicionais na `enviada`, tipo `cópia`) — o Destinatário principal continua sendo Ana. Uma resposta enviada **por um dos copiados** cria Conversa própria com ele (resolvido a Contato, com criação automática se necessário) e não é ligada à Conversa de Ana por "em resposta a", que é intra-Conversa (INV-CXE-10); a correlação por cabeçalho fica como Proveniência textual, e o produto pode oferecer "mover para a Conversa de Ana" (rejeitado: Mensagens não mudam de Conversa — RN-CXE-15). Registrado como limitação conhecida (seção 25, questão 3).

### 20.4 Conversa associada a vários Negócios

Permitido: Vínculo Conversa-Negócio é 0..N (A8). Uma Conversa em que o cliente pergunta sobre a renovação (Negócio A) e sobre um serviço novo (Negócio B) tem dois Vínculos, cada um com papel textual opcional. Nenhum dos Negócios contém a Conversa; a linha do tempo de cada um a exibe. Painéis "Conversas por Negócio" contam-na em ambos; "Conversas por Empresa" a contam uma vez (derivada do Contato). Resolver a Conversa não afeta nenhum Negócio.

### 20.5 Conversa reaberta após 40 dias

Prazo de reabertura da Caixa = 72 h (padrão). Uma Mensagem recebida 40 dias após a resolução **cria Conversa nova** (RN-CXE-09), na Fila padrão do Canal, com distribuição normal; a Conversa antiga permanece `resolvida`, e o Atendente vê o histórico pela linha do tempo do Contato (documento 10, 8.1). Se a organização preferir "sempre a mesma Conversa", define prazo alto; se preferir "sempre nova", zero. **Reabertura manual** da antiga, por Membro, é permitida a qualquer tempo — mas rejeitada se já existir Conversa não resolvida do par (INV-CXE-03): o ator resolve a nova antes ou desiste. Justificativa do prazo único por Caixa (DO-CXE-04): o prazo define o que é "um episódio" para Painéis de reincidência e tempo de resolução; variar por Fila tornaria a mesma pergunta incomparável entre Filas.

### 20.6 Contato com Conversa aberta no WhatsApp e outra no Instagram

Duas Conversas, permitido (B12; INV-CXE-03 é por (Contato, Canal)). Podem estar em Filas diferentes, com Atribuídos diferentes. O Atendente de uma vê a outra na linha do tempo do Contato se tiver `ver` nela (RN-CON-21). Não há fusão: são Canais distintos com Mensagens de identificadores externos distintos. O mesmo vale para dois Canais do mesmo Tipo (dois números de WhatsApp): duas Conversas (documento 10, 20.16).

### 20.7 Conversa transferida de Agente para humano no meio de uma resposta em geração

O Agente Atribuído (nível `autônomo`) está em Execução gerando a resposta. Um Membro assume a Conversa (escalonamento, 12.4). No mesmo ato: Atribuído = Membro; a Execução do Agente passa a `cancelada` (B18) com motivo "Conversa transferida"; a próxima Ferramenta que o Agente invocaria ("enviar Mensagem") não é executada — a verificação a cada Ferramenta (B23) inclui "o Agente ainda é Atribuído ou tem permissão de enviar nesta Conversa"; o texto parcial, se a Execução o expôs, é preservado como **Rascunho** do Agente na Conversa (7.10), visível ao novo Atribuído, que o adota ou descarta. Nenhuma Mensagem parcial é enviada. Se a Ferramenta "enviar" já tinha sido aceita pelo provedor antes da transferência, a Mensagem existe e segue o seu status (RN-CXE-23) — a transferência não recolhe o que saiu. Registro de Atividade duplo: transferência e cancelamento.

### 20.8 Permissão do Agente revogada durante o envio

B23: permissões são avaliadas a cada Ferramenta. Três momentos: (a) revogação **antes** da Ferramenta "enviar Mensagem": a chamada falha, a Execução passa a `falhou` (ou `aguardando aprovação`, com Solicitação de motivo `permissão`, aprovável só por quem tem a permissão requerida — DO-AGE-11; B80), nenhuma Mensagem é criada; (b) revogação **entre** a gravação da Mensagem `pendente` e o aceite do provedor: a Mensagem já existe; o Sistema conclui o envio (o ato foi autorizado no momento da invocação) e a Execução termina normalmente — a revogação vale para a próxima Ferramenta; (c) revogação **após** o aceite: nada muda na Mensagem. Justificativa: a permissão autoriza o ato, e o ato é a invocação da Ferramenta; tratar (b) como falha deixaria Mensagem `pendente` que nunca sai nem falha. Registro de Atividade da revogação e da Execução.

### 20.9 Canal desconectado com Mensagens `pendente` de envio

Mensagens `enviada` criadas com o Canal `desconectada`/`com erro` ficam `pendente` (RN-CXE-20). Na reconexão, o Sistema as envia em ordem de criação, **exceto**: (i) as de Tipo de Canal com janela de resposta cuja janela expirou entretanto e que não usam modelo → `falhou` com motivo "janela expirada"; (ii) as que ultrapassaram o Prazo de validade de envio pendente da plataforma (recomendação: 24 h) → `falhou` com motivo "expirada"; (iii) as cuja Conversa foi resolvida por mesclagem ou cujo Contato foi eliminado → `falhou`. Decisão (DO-CXE-18): reenvio automático com validade, nunca reenvio indiscriminado (uma promoção de três dias atrás enviada após reconexão é dano) nem descarte silencioso (o Atendente precisa saber o que não saiu). O Ator é notificado por Mensagem; Automação recebe evento "Mensagem falhou" para reagir.

### 20.10 Espaço de Trabalho suspenso recebendo Mensagens

B31 / RN-CXE-27. Durante a suspensão: Mensagens recebidas são persistidas; Conversas são criadas (`aberta`, na Fila padrão do Canal, **sem Atribuído**) ou reabertas pelas regras normais de prazo; Contatos são criados automaticamente (é persistência de fato, não operação) com Proprietário resolvido normalmente; nenhuma distribuição, Automação, Agente ou resposta; Mensagens `pendente` de envio passam a `falhou`; nada é enviado, inclusive confirmações; Adiamentos vencidos devolvem a `aberta` sem distribuir. Na reativação: as Conversas sem Atribuído entram na distribuição pelas regras de Fila **a partir daquele momento**; Automações com Gatilho "Mensagem recebida" **não** disparam retroativamente para as Mensagens persistidas (DO-ET-09: nada retroativo) — uma Automação de "reativação" pode varrer "Conversas sem resposta" se a organização quiser. Exemplo 4 do documento 01 (22).

### 20.11 Atendente removido do Espaço de Trabalho com 40 Conversas atribuídas

B28 / RN-CXE-24: no ato da remoção, as 40 Conversas são **liberadas** (Atribuído vazio), com um Registro de Atividade por Conversa; cada uma permanece na sua Fila e é redistribuída pela regra dela (rodízio, menor carga) ou fica sem Atribuído aguardando auto-atribuição (`manual`); as sem Fila ficam sem Atribuído com evento "Conversa liberada". O removido é retirado dos elegíveis de todas as Filas e continua Participante `atendente` histórico e Ator das suas Mensagens (A6.4). Não há Sucessor de Conversas (não há propriedade). Se o removido era Proprietário padrão de Contatos em alguma Fila, Canal ou na Caixa, o atributo é limpo (RN-CXE-29). Um Membro **suspenso** com 40 Conversas as **mantém** (RN-ET-08); o produto pode oferecer redistribuir por ato de Administrador.

### 20.12 Janela de resposta do WhatsApp (24 h) expirada

Última Mensagem `recebida` há 30 h; o Atendente tenta enviar texto livre. Rejeitado antes de gravar (RN-CXE-19): fora da janela, o Tipo de Canal só admite Mensagem de modelo `aprovado` da Configuração do Canal (7.3). O Atendente escolhe um modelo, preenche variáveis; a Mensagem nasce com "Mensagem de modelo usada" e Conteúdo resultante. Modelo de categoria `marketing` exige consentimento vigente (RN-CON-16). Um Agente ou Automação que tente texto livre falha com Registro (Execução `falhou`); uma Automação bem construída usa modelo. A resposta do Contato ao modelo reabre a janela (derivado "Janela de resposta aberta até"). Se a janela expira com Mensagens `pendente` (Canal desconectado), elas falham na reconexão (20.9).

### 20.13 Dois Atendentes respondendo à mesma Conversa

Permitido. Ana é Atribuída; Pedro, com `editar` na Conversa (elegível da Fila), envia uma Mensagem. Pedro torna-se Participante `atendente`; o Atribuído continua Ana (a atribuição não muda por enviar Mensagem — mudar exige transferência, RN-CXE-14). Ambos aparecem como Atores das suas Mensagens; Painéis "Mensagens por Atendente" contam cada um; "Conversas por Atribuído" conta só Ana. Justificativa: responsabilidade de conduzir é uma (A7), participação é muitas; cobrir um colega não pode exigir roubar-lhe a Conversa.

### 20.14 Mensagem `interna` que menciona Membro

Ana escreve nota interna "@Pedro, você fecha este orçamento?". Pedro é notificado se tiver `ver` na Conversa (RN-CXE-22; DO-TAR-19 por analogia); a menção **não** o torna Participante, Atribuído nem lhe concede permissão. Se Pedro não tem `ver`, a menção não notifica e o produto avisa Ana. O que Ana quer é provavelmente **transferir** para Pedro ou **adicioná-lo como observador** — dois atos distintos, ambos registrados. Uma `interna` nunca chega ao Contato (INV-CXE-09), mesmo que Ana a envie "por engano" na caixa de resposta: direção é escolha explícita e irreversível na criação.

### 20.15 Mensagem enviada por Automação sem Atribuído

A Automação "confirmação de recebimento" envia Mensagem de modelo ao criar a Conversa, antes de qualquer atribuição. A Mensagem tem Ator = Automação, delegante = Proprietário da Automação, **sem Participante Remetente** (DO-CXE-12) — a Automação não "toma parte"; a Conversa continua sem Atribuído e o estado não muda por si (11.3; a Automação pode marcá-la `pendente` como Ação separada). Momento da primeira resposta: a Mensagem da Automação **conta** como primeira `enviada` (é resposta da organização); Painéis que queiram "primeira resposta humana" filtram pelo tipo de Ator. Sujeita a janela, consentimento e Canal conectado como qualquer envio.

### 20.16 Conversa iniciada pela organização com Contato sem Identificador do Tipo do Canal

Membro tenta iniciar Conversa por WhatsApp com Contato que só tem `e-mail`. Rejeitado (RN-CXE-21): não há para onde enviar. O Membro acrescenta um Identificador `identidade de WhatsApp` (sujeito a INV-CON-02) e tenta de novo; a Mensagem inicial, por ser iniciada pela organização, exige modelo no WhatsApp (fora de janela por definição) e consentimento se a Finalidade exigir. Nasce `pendente` (aguarda o Contato) por padrão.

### 20.17 Contato mesclado com duas Conversas abertas no mesmo Canal

Contatos A (Conversa X `aberta`, Ana) e B (Conversa Y `aberta`, Pedro) no mesmo Canal são mesclados; A sobrevive. Após o reapontamento (DO-CON-11), o sobrevivente teria duas não resolvidas no mesmo Canal — viola INV-CXE-03. A Caixa resolve no mesmo ato (RN-CXE-10): a de **Mensagem mais recente** (digamos Y) permanece `aberta` com Pedro; X passa a `resolvida` com causa "mesclagem", evento e Registro de Atividade em ambas, e Ana é notificada. **Nenhuma Mensagem é movida** (RN-CXE-15): o histórico de X permanece em X, visível na linha do tempo do Contato; Vínculos de X permanecem em X. A próxima Mensagem do Contato entra em Y. Alternativa rejeitada — fundir as Mensagens em uma Conversa — porque quebraria a imutabilidade e a Proveniência das Mensagens e tornaria ambíguos Atribuído, Fila e derivados de tempo. Resolve a questão 5 do documento 10.

### 20.18 Grupo de WhatsApp

Capacidade "grupos" do Tipo de Canal; C5 continua **aberta** para regras completas. O que este documento fixa (RN-CXE-28): a Mensagem de grupo é persistida em uma Conversa com **Identificador de grupo**; Contato principal = o Contato do primeiro remetente do episódio (ou o que a organização designar); cada remetente subsequente é resolvido a Contato (criação automática se necessário) e entra como Participante `contato` **adicional**; INV-CXE-03 não se aplica a Conversas de grupo (a chave é (Identificador de grupo, Canal)), então o Contato pode ter uma Conversa 1:1 e uma de grupo abertas no mesmo Canal; Mensagens `enviada` vão ao grupo (todos os Participantes `contato`). Com "Grupos habilitados" falso no Canal, a Conversa nasce `resolvida`, sem Fila, e novas Mensagens a reabrem sem distribuir — a organização vê que existe, sem operar. Pendentes em C5: consentimento em grupo (a Finalidade `atendimento` de cada Participante?), Proprietário dos Contatos criados por grupo (DO-CXE-05 aplica-se; registrar), regras de saída do grupo, e se o Contato principal deve poder ser trocado.

### 20.19 Chat do site com visitante anônimo

O widget abre sessão; o Canal Chat do site entrega Mensagem com `identificador de chat do site` (identificador de sessão, verificado por posse). Criação automática (RN-CXE-06): Contato Não identificado (documento 10, 5), Identificador, Conversa, Mensagem. Quando o visitante informa e-mail, o Sistema (se o Tipo de Canal verificar) ou o Membro **acrescenta** o Identificador `e-mail` ao mesmo Contato (RN-CXE-36); se o e-mail já pertence a outro Contato, a criação é rejeitada (RN-CON-11) e o caminho é mesclar — o que aplica RN-CXE-10 se ambos tiverem Conversas abertas neste Canal. Um novo visitante anônimo com nova sessão é novo Contato: a plataforma não infere identidade por cookie, endereço IP ou nome digitado (RN-CON-23 por analogia); Suspeita de Duplicidade (documento 10, 7.5) pode sugerir mesclagem. Consequência de produto: Contatos Não identificados de chat acumulam; uma Automação pode arquivá-los após X dias sem Identificador além do de sessão.

### 20.20 Mesmo número conectado em novo Canal; Canal reconectado com outra conta

(a) O Administrador arquiva o Canal "Recepção" (número N) e cria o Canal "Recepção 2" conectando N. Permitido (INV-CXE-01 só conta `ativo`). As Conversas antigas permanecem em "Recepção" (Canal imutável na Conversa, INV-CXE-04); Mensagens novas de N criam Conversas em "Recepção 2"; **o prazo de reabertura não atravessa Canais**: uma Conversa `resolvida` em "Recepção" há 1 h não é reaberta por Mensagem em "Recepção 2" — nasce Conversa nova. O produto deve alertar; a ontologia recomenda **reativar** o Canal antigo em vez de criar outro. (b) Tentar reconectar "Recepção" com o número M ≠ N é rejeitado (12.2): o identificador externo não é identidade, mas a troca de conta em um Canal com Conversas confundiria "por onde esta Conversa ocorreu"; cria-se outro Canal.

### 20.21 Conversa cujo Contato principal foi eliminado

Contato principal = Marcador de Contato eliminado (DO-CON-10); Participante `contato` referencia o Marcador; Mensagens `recebida` referenciam o Marcador no lugar do Identificador; se por solicitação do titular, Conteúdo e Anexos anonimizados e os Rascunhos da Conversa descartados (documento 10, 12.5). A Conversa, se `aberta`, **permanece `aberta`** (é trabalho pendente da organização, mesmo que não se possa responder — não há para onde), e o produto a exibe como "sem Contato"; recomendação: uma Automação a resolve com causa. Novas Mensagens do antigo Identificador criam **novo** Contato (o Identificador foi eliminado) e nova Conversa: não há reabertura (INV-CXE-03 não encontra Contato).

## 21. O que explicitamente NÃO pertence a esta entidade

Resultado do teste de exclusão: o que parece da Caixa de Entrada (ou de Conversa, Canal, Fila), mas pertence a outra entidade.

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Contato ("o cliente da Conversa") | Contato (Espaço de Trabalho) | A Conversa referencia; não contém (DO-CON-09). Eliminar a Conversa não afeta o Contato. |
| Identificador de Contato (número, e-mail) | Contato | B13. A Mensagem referencia o Identificador por onde chegou. |
| Empresa "da Conversa" | Derivada do Contato principal | DO-EMP-08. Nunca gravada. |
| Consentimento para envio | Contato | Documento 10, 7.2. A Caixa o consulta (RN-CON-16). |
| Proprietário do Contato criado automaticamente | Contato | A Caixa só resolve o padrão (DO-CXE-05). |
| Tipo de Canal e Capacidades (janela, anexos, modelos) | Plataforma | A1.3; RN-CXE-05. Referenciados. |
| Mensagens de modelo (texto aprovado) | Provedor externo; Configuração do Canal é cópia sincronizada | Objeto de valor, não Template (7.3). |
| Integração genérica (ERP, calendário) | Espaço de Trabalho | Documento 01, 7.4. Só Canais estão na Caixa. |
| Equipes e Membros elegíveis | Espaço de Trabalho | A Fila referencia; não contém pessoas. |
| Disponibilidade de atendimento | Membro | DO-CXE-14. |
| Horário comercial / semana de trabalho | Espaço de Trabalho (C12) | A Caixa tem Horário de atendimento como padrão até C12 (DO-CXE-06). |
| Tags, Definições de Campo de Conversa | Espaço de Trabalho | Catálogos (B34; A5.2). |
| Automações "da Caixa" ou "da Fila" | Espaço de Trabalho | Escopo, não pertencimento (B41). |
| Negócios e Tarefas "da Conversa" | Negócio / Lista (Tarefa) | Vínculo (A8; DO-TAR-08). |
| Comentários | Contato, Negócio, Tarefa | Conversa não recebe Comentários (DO-CXE-08); a nota interna é Mensagem `interna`. |
| Sessão de Chat ancorada; Mensagens de Chat | Membro (B21) | A Conversa não conhece Sessões; o único caminho é o Rascunho. |
| Rascunho gerado por Agente como "mensagem" | Conversa (objeto de valor), nunca Mensagem | DO-CXE-15. |
| Execuções de Agente sobre a Conversa; Solicitações de Aprovação | Agente / Automação | B18. |
| Arquivos anexados | Espaço de Trabalho (Arquivo) | A8. O Anexo é referência. |
| Transcrição de áudio | Anexo (derivado, opcional) | 7.11. Não é Conteúdo. |
| "Mensagens de sistema" na linha do tempo | Registros de Atividade | DO-CXE-08. |
| Status de entrega de Mensagem `recebida` | Não existe | Leitura interna é outra coisa (7.6). |
| Prioridade da Conversa | Não existe nativa | Tag ou Definição de Campo (DO-CXE-10). |
| Proprietário de Conversa, Canal, Fila ou Caixa | Não existe | DO-CXE-02. |
| Estado de conversa personalizável ("aguardando financeiro") | Não existe | A4.5; use Fila, Tag ou Definição de Campo. |
| Filas como contêineres de Conversas | Não | Referência mutável (DO-CXE-01). |
| Endereços em cópia como Participantes | Não | Objeto de valor da Mensagem (DO-CXE-13). |
| Linha do tempo do Contato / da Empresa | Derivada | Documentos 10 e 11. |
| Painéis de atendimento (tempo de resposta, carga) | Painel (Métricas derivadas) | Nunca gravados na Caixa, Fila ou Conversa. |

## 22. Exemplos conceituais

**Exemplo 1 — Clínica com dois números e três Filas.** A "Clínica Vida" conecta dois Canais WhatsApp ("Centro", "Norte") e um Canal E-mail ("contato@"). Filas: "Recepção Centro" (Fila padrão de "Centro"; elegíveis: Equipe Recepção Centro; `rodízio`; Proprietário padrão de Contatos: Ana), "Recepção Norte" (idem, Norte) e "Financeiro" (`manual`; elegíveis: Beatriz e Carlos; sem Proprietário padrão — cai no Canal, que não define, e então na Caixa, que aponta para a Administradora). Prazo de reabertura 72 h. Um paciente novo escreve ao "Centro": Contato Não identificado, Conversa `aberta` em "Recepção Centro", atribuída por rodízio a Marina. Marina responde, marca `pendente`; o paciente responde no dia seguinte → `aberta` automaticamente; Marina pergunta sobre convênio e escreve `interna` "@Beatriz precisa checar cobertura" (Beatriz é notificada, não vira Participante); transfere para "Financeiro" (Atribuído liberado — Marina não é elegível lá); Beatriz se auto-atribui, resolve. Cinco dias depois o paciente escreve de novo: nova Conversa (além de 72 h), em "Recepção Centro". Painel "tempo de primeira resposta por Fila" lê os derivados.

**Exemplo 2 — Agente atendendo à noite.** A Automação "fora do horário" (escopo Fila "Recepção Centro", Gatilho "Mensagem recebida", Condição "fora do Horário de atendimento") atribui a Conversa ao Agente "Triagem" (nível `supervisionado`, reduzido pela Automação a partir de `autônomo`). O Agente lê a Conversa (com as próprias permissões, sem delegante), gera resposta: como está `supervisionado`, cada envio gera Solicitação de Aprovação ao Proprietário da Automação; até a aprovação, o texto fica como **Rascunho** do Agente. Às 8h, Marina assume (escalonamento): a Execução pendente é cancelada, o Rascunho fica visível, Marina o adota e envia — Mensagem com Ator Marina, Proveniência "Rascunho de Agente Triagem". Se a Automação tivesse mantido `autônomo`, o Agente teria enviado dentro da Janela de resposta (24 h), com Ator Agente e sem delegante.

**Exemplo 3 — Mesclagem e duplicidade de Conversa.** "Maria O." (WhatsApp, Conversa X `aberta` com Pedro) e "Maria Oliveira" (e-mail; e uma Conversa Y `aberta` no mesmo Canal WhatsApp por um segundo número, com Ana) são mescladas; "Maria Oliveira" sobrevive. Duas abertas no mesmo Canal: Y tem Mensagem mais recente → permanece com Ana; X passa a `resolvida` (causa "mesclagem"); Pedro é notificado; as Mensagens de X ficam em X. A próxima Mensagem de qualquer dos dois números entra em Y (B12: Conversa por Canal, não por Identificador).

**Exemplo 4 — E-mail com cópias e Negócios.** Ana (Contato, Empresa Alfa) envia e-mail a "contato@" com quatro pessoas em cópia, assunto "Renovação e módulo novo". Conversa com Ana, Título derivado do assunto, Fila padrão do Canal E-mail; Endereços adicionais: quatro `cópia`, dois deles resolvidos a Contatos existentes (derivado), nenhum Participante. O Atendente vincula a Conversa aos Negócios "Renovação Alfa 2027" e "Módulo Financeiro" e cria a Tarefa "Enviar proposta do módulo" a partir dela (Vínculo + Proveniência; Vínculo Tarefa-Contato com Ana criado no mesmo gesto). Responde "a todos": `enviada` com os mesmos Endereços adicionais. A Empresa "Alfa" exibe a Conversa na linha do tempo por derivação.

**Exemplo 5 — Suspensão e reconexão.** O Espaço de Trabalho é suspenso por 5 dias; 37 Mensagens chegam e são persistidas em 22 Conversas sem Atribuído; 3 Mensagens `pendente` de envio passam a `falhou` ("suspensão"). Na reativação, as 22 são distribuídas pelas regras das Filas naquele momento; nenhuma Automação de "Mensagem recebida" dispara para as 37. No mesmo dia, o Canal "Norte" entra `com erro` (credencial expirada); 6 Mensagens enviadas ficam `pendente`; reconectado 3 h depois, 5 são enviadas e 1 (fora da Janela de resposta de 24 h, texto livre) passa a `falhou` ("janela expirada"); o Atendente reenvia com modelo — Mensagem nova, Proveniência "reenvio de".

## 23. Representação gráfica textual

```
PLATAFORMA
└── Tipo de Canal (WhatsApp | Instagram | E-mail | Chat do site)  [Capacidades: identificadores, anexos, janela, modelos, cópia, grupos, multimodal]
        ▲ referenciado (nunca contido)
ESPAÇO DE TRABALHO
├── Membro (1..N)  [Disponibilidade de atendimento — objeto de valor]  ◄── elegíveis ── Fila
├── Equipe (0..N)  ◄── elegíveis ── Fila
├── Catálogos usados: Tag (Conversa), Definição de Campo (entidade-alvo Conversa), Origem
├── Contato (0..N) ◄────────────── Contato principal (1) ── Conversa
│     └── Identificador de Contato ◄── Mensagem `recebida` (por onde chegou)
├── Automação (0..N; escopo: Caixa de Entrada | Fila — B41 ampliada)
│
└── CAIXA DE ENTRADA (1, composição; sem Proprietário; sem estado próprio)
    │   Prazo de reabertura · Distribuição padrão · Proprietário padrão de Contatos (0..1) · Horário de atendimento (obj. valor; C12)
    │
    ├── CANAL (0..N)  [Integração especializada; Tipo de Canal 1 imutável; identificador externo único entre `ativo`;
    │   │              conexão: conectada | desconectada | com erro; ciclo: ativo | arquivado; sem lixeira; Membro configurador; sem Proprietário]
    │   ├── Fila padrão (0..1) ──────────────────────────┐
    │   ├── Proprietário padrão / Origem padrão de Contatos │
    │   ├── Configuração de mensagens de modelo (obj. valor; só Tipos com modelos)
    │   └── Grupos habilitados (só Tipos com grupos)      │
    │                                                      │
    ├── FILA (0..N)  [ativo | arquivado | na lixeira; nome único; sem Proprietário]  ◄┘
    │   ├── Elegíveis (Membros, Equipes) → elegíveis efetivos (derivado, filtrado por Disponibilidade)
    │   ├── Regra de distribuição: herdar | manual | rodízio | menor carga · Limite por Atendente
    │   ├── Proprietário padrão de Contatos (0..1) · Horário de atendimento (0..1)
    │   └── ◄── referenciada por Conversa (0..1, mutável por transferência)  — NÃO contém
    │
    └── CONVERSA (0..N)  [Canal 1 imutável; Contato principal 1; estado de conversa: aberta | pendente | resolvida;
        │                 ciclo: ativo | na lixeira; Fila 0..1; Atribuído 0..1 (Membro | Agente); Título; Tags; Valores de Campo;
        │                 Adiamento (só pendente); Rascunho (0..N, um por Ator); Identificador de grupo (C5); sem Proprietário; sem prioridade]
        │
        ├── PARTICIPANTE (1..N, composição)  [sujeito: Contato | Membro | Agente; papel: contato (1 principal, 0..N adicionais) |
        │                                     atendente | agente | observador; entrada; saída]
        │
        ├── MENSAGEM (1..N, composição; imutável salvo status, leitura, reações, edição externa, marcação de exclusão)
        │   ├── direção: recebida | enviada | interna     ── interna NUNCA vai ao Canal
        │   ├── Remetente → Participante (0..1; vazio para Automação/Integração/Sistema) · Ator (1) · ator delegante (0..1)
        │   ├── Conteúdo · Tipo de conteúdo (derivado) · Assunto (E-mail) · Endereços adicionais (E-mail; não Participantes)
        │   ├── Em resposta a → Mensagem da mesma Conversa (0..1) · Mensagem de modelo usada (0..1) · identificador externo (único por Canal)
        │   ├── status de entrega (só enviada): pendente | enviada | entregue | lida | falhou(motivo)
        │   ├── Leitura interna (0..N) · Reações (0..N) · Marcação de exclusão · Edição externa · Anonimizada · Proveniência
        │   └── ANEXO (0..N) → Arquivo do ET  [ordem; tipo de mídia; transcrição/descrição derivada opcional]
        │
        ├── Valor de Campo (0..N; um por Definição aplicável)
        └── Vínculos: ↔ Negócio (0..N) · ↔ Tarefa (0..N)        Empresa: DERIVADA do Contato principal

Invariante central: por (Contato, Canal), no máximo UMA Conversa aberta|pendente (sem grupo).
Resolução de padrões (derivação, não herança): Fila → Canal → Caixa de Entrada → Espaço de Trabalho.
Sessão de Chat (IA) ── âncora ──► Conversa (lê; produz Rascunho; nunca envia).  Nenhuma aresta cruza o Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-CXE-01.** Fila e Canal **não contêm** Conversas: a Conversa pertence à Caixa de Entrada e **referencia** Canal (imutável) e Fila (0..1, mutável por transferência). Justificativa: contenção pela Fila tornaria transferência uma movimentação (B40), arquivamento da Fila um estado efetivo (B36) e permissões herdadas de um agrupamento que muda a cada hora. Aplica A2.5, B11, B12. RECOMENDADA.
- **DO-CXE-02.** Caixa de Entrada, Canal, Fila e Conversa **não têm Proprietário**; Canal tem Membro configurador (B35) e Criador, Fila tem Criador, Conversa tem Atribuído (0..1, Membro ou Agente — B7). Não há sucessão (B28); a remoção de Membro libera Atribuídos e limpa Proprietários padrão de Contatos. Confirma a recomendação de B35 e do documento 01 (20.11). RECOMENDADA.
- **DO-CXE-03.** Estados de ciclo de vida: Canal tem `ativo` e `arquivado` (sem `na lixeira`; eliminação individual só sem Conversas), além dos estados de conexão de Integração; Fila tem `ativo`, `arquivado`, `na lixeira` (A4.1); Conversa tem `ativo` e `na lixeira` (sem `arquivado`: `resolvida` é o repouso), e só `resolvida` vai à lixeira; Mensagem e Participante não têm estado de ciclo de vida. Justificativa: Conversa referencia o Canal imutavelmente; um segundo eixo de arquivamento em Conversa duplicaria `resolvida`. Exceções a A4.1 registradas para Canal e Conversa. RECOMENDADA.
- **DO-CXE-04.** O Prazo de reabertura é atributo único da Caixa de Entrada, não sobrescritível por Fila ou Canal; define o que é "um episódio" e não atravessa Canais. RECOMENDADA.
- **DO-CXE-05.** Proprietário de Contato criado automaticamente resolve-se na ordem Fila → Canal → **Caixa de Entrada** → Proprietário do Espaço de Trabalho; cada nível é referência 0..1 a Membro `ativo`, limpa com Registro quando o Membro deixa de estar `ativo`. Fixa a localização delegada por DO-CON-08 (que enuncia a mesma cadeia de quatro níveis). RECOMENDADA.
- **DO-CXE-06.** Horário de atendimento é objeto de valor da Caixa de Entrada (sobrescritível por Fila), única fonte de "horário útil" da mensageria até C12; quando C12 for decidida, passa a referenciar a configuração global e a sobrescrevê-la apenas por escolha da organização. RECOMENDADA; subordinada a C12.
- **DO-CXE-07.** Semântica dos estados de conversa (A4.5): `aberta` = aguarda ação da organização; `pendente` = aguarda o Contato, terceiro ou o relógio (Adiamento); `resolvida` = encerrada, reabrível. Mensagem recebida devolve `pendente` a `aberta`; enviar Mensagem não muda o estado por si. "Sem Atribuído" é condição derivada, não estado. RECOMENDADA.
- **DO-CXE-08.** Conversa **não recebe Comentários** (A8 não a lista); a manifestação interna é Mensagem `interna`, que fica na sequência da Conversa e nunca vai ao Contato. Fatos da Conversa (atribuição, transferência, resolução) são Registros de Atividade, nunca "Mensagens de sistema". RECOMENDADA.
- **DO-CXE-09.** Adiamento ("adiada até") é objeto de valor da Conversa, presente só em `pendente`; ao vencer, o Sistema devolve a `aberta`; Mensagem recebida antes descarta o Adiamento. Não é estado nem Tarefa. RECOMENDADA.
- **DO-CXE-10.** **Sem prioridade nativa de Conversa** nesta versão: Tags, Definições de Campo e Filas separadas cobrem o caso; uma escala fixa duplicaria C17 sem regra da ontologia que a consumisse. RECOMENDADA; reabrir se Painéis exigirem comparabilidade (seção 25).
- **DO-CXE-11.** Multimodalidade: uma comunicação com texto e vários anexos é **uma** Mensagem com Anexos quando o Tipo de Canal a entrega assim; quando o provedor entrega itens separados, cada item é uma Mensagem (identificador externo, status, exclusão por item) e a plataforma não as funde; no envio, a fragmentação exigida pelo Tipo produz Mensagens com Proveniência "parte de". RECOMENDADA.
- **DO-CXE-12.** Remetente e Destinatário são papéis da Mensagem, não entidades: Remetente resolve a um Participante quando o Ator é Contato, Membro ou Agente; Mensagens de Automação, Integração ou Sistema têm Ator e **não têm Participante** (Automação não "toma parte"); Destinatário é derivado. RECOMENDADA.
- **DO-CXE-13.** Destinatários externos em cópia (E-mail) são **Endereços adicionais** — objeto de valor da Mensagem (tipo, endereço, nome, Contato resolvido derivado) — e não Participantes, **mesmo quando resolvidos a Contatos**; não criam Contatos nem Conversas. Justificativa: cópias são ruidosas; Participante é decisão da organização (C5 para grupos). RECOMENDADA.
- **DO-CXE-14.** Disponibilidade de atendimento (`disponível`, `ausente`, `indisponível`; momento; origem) é **objeto de valor do Membro**, não da relação Membro-Fila; elegibilidade é por Fila, disponibilidade é da pessoa; Membro `suspenso` deriva `indisponível`; Agente não tem Disponibilidade. **Amplia os atributos do Membro** (documento 01, 7.1). RECOMENDADA.
- **DO-CXE-15.** Resposta gerada por Agente (ou copiada de Sessão de Chat ancorada) é **Rascunho**, objeto de valor da Conversa (um por Ator interno), nunca Mensagem `interna` nem Mensagem de Chat; enviar cria Mensagem nova com Proveniência. Justificativa: `interna` é comunicação permanente entre Atores; sugestão é descartável, e a autoria da Mensagem final deve ser de quem envia. RECOMENDADA.
- **DO-CXE-16.** **Fila é escopo de Automação**, além da Caixa de Entrada e do Funil: Gatilhos sobre Conversas da Fila e seus eventos; inoperante com a Fila `arquivado`; eliminada com a Fila. **Ampliação já incorporada a B41 e ao Glossário (Automação)**, cuja lista vigente de escopos é Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada e Fila. RECOMENDADA.
- **DO-CXE-17.** Agente acionado por Membro na Conversa age em nome dele (interseção, A9.3; delegante Membro registrado). Agente Atribuído **invocado pela chegada de Mensagem** age com Origem `Caixa de Entrada`, sem delegante e com as próprias permissões (RN-AGE-14); Agente **invocado por Ação de Automação** age com as próprias permissões e com a **Automação como delegante** (DO-AUT-15; RN-AUT-25) — cadeia de atribuição da fase 4 (B79). Nenhuma regra de distribuição atribui a Agente. O nível de autonomia efetivo (B22; B77) decide, por Ferramenta e classe de efeito, se o Agente responde ao Contato sem aprovação (B64; prazo B80). Aplica B7, B22, A9.3. RECOMENDADA.
- **DO-CXE-18.** Mensagens `enviada` com Canal `desconectada`/`com erro` ficam `pendente`; na reconexão são reenviadas em ordem, exceto as fora da janela sem modelo e as além do Prazo de validade de envio pendente (plataforma; recomendação 24 h), que passam a `falhou` com motivo. Nunca descarte silencioso; nunca reenvio sem validade. Na suspensão do Espaço de Trabalho, `pendente` → `falhou` (B31: nada é enviado). RECOMENDADA.
- **DO-CXE-19.** Permissão sobre Conversas: origens Papel, concessão direta, compartilhamento e **elegibilidade de Fila** (Membro elegível efetivo vê e edita as Conversas atualmente na Fila e as sem Fila; concessão sobre uma Fila alcança as Conversas nela, avaliada a cada consulta); escopos `registro` e `próprios` (Atribuído ou Criador); `administrar` sobre a Fila concedível a Membros e Equipes (nunca Agentes nem base Convidado). Não é herança estrutural (B25). **Candidata a decisão B** (nova origem de permissão por referência operacional). RECOMENDADA.
- **DO-CXE-20.** Mensagem recebida de (Contato, Canal) entra na Conversa não resolvida, reabre a `resolvida` dentro do Prazo de reabertura ou cria Conversa nova; reabertura manual não tem prazo, mas respeita INV-CXE-03. Aplica B12. RECOMENDADA.
- **DO-CXE-21.** Mesclagem de Contatos (ou associação/movimentação de Conversa) que produza duas Conversas não resolvidas no mesmo Canal: a de Mensagem mais recente permanece; a outra passa a `resolvida` com causa "mesclagem", sem mover Mensagens, com evento em ambas. Resolve a questão 5 do documento 10 e o item 7 de DO-CON-11. RECOMENDADA.
- **DO-CXE-22.** Conversa de grupo (C5): o modelo suporta Identificador de grupo e Participantes `contato` adicionais; INV-CXE-03 não se aplica a Conversas de grupo (chave (Identificador de grupo, Canal)); "Grupos habilitados" por Canal; com grupos desabilitados, a Conversa nasce `resolvida` sem distribuição. As demais regras permanecem em C5. RECOMENDADA como suporte mínimo; C5 continua ABERTA.
- **DO-CXE-23.** A Mensagem é imutável (Conteúdo, Anexos, direção, Ator, momento, identificador externo), com exceções fechadas: status de entrega, Leitura interna, Reações, edição pelo remetente externo transmitida pelo provedor (histórico preservado), Marcação de exclusão (terminal) e anonimização (DO-CON-10). Mensagens nunca mudam de Conversa; reenvio é Mensagem nova. RECOMENDADA.
- **DO-CXE-24.** Reconexão de Canal só com a mesma conta (mesmo identificador externo); conta diferente é outro Canal; o identificador externo é único entre Canais `ativo` e é liberado pelo arquivamento; o Tipo de Canal é imutável. O prazo de reabertura não atravessa Canais. RECOMENDADA.
- **DO-CXE-25.** Conversa sem Contato resolvido (Limite de Contatos atingido, RN-CON-12) existe como Conversa `aberta` com marcador "não resolvido" que guarda o Identificador recebido, sem Fila nem distribuição, até associação manual ou capacidade; ao resolver, aplica-se DO-CXE-21. Exceção explícita e temporária a B12, exigida por RN-CON-12. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-CXE-05 acrescenta um nível a DO-CON-08; DO-CXE-14 amplia o Membro (documento 01, 7.1); DO-CXE-16 amplia B41 e o Glossário; DO-CXE-19 propõe nova origem de permissão (candidata a B); DO-CXE-03 registra exceções a A4.1 para Canal e Conversa; DO-CXE-25 registra exceção temporária a B12. Nenhuma altera decisão vigente.

## 25. Questões em aberto

1. **Conversas em grupo** (C5). DO-CXE-22 fixa o suporte estrutural; faltam: consentimento por Participante em grupo, Proprietário dos Contatos criados por grupo, troca de Contato principal, saída de Participantes, distribuição de Conversas de grupo, e se Instagram/E-mail devem usar o mesmo modelo. Consequência: sem decisão, grupos ficam "só leitura" (`resolvida` sem distribuição).
2. **Horário comercial** (C12). DO-CXE-06 é provisória; "tempo de primeira resposta em horas úteis" só é comparável a Funil e Painéis quando C12 existir.
3. **Correlação entre Conversas de E-mail.** Uma resposta de um copiado cria Conversa própria; não há Vínculo Conversa-Conversa nem sequência transversal (RN-CXE-15). Alternativas: (a) manter; (b) Vínculo Conversa-Conversa `relacionada a` (amplia A8); (c) Conversa de grupo para E-mail (C5). Consequência relevante para organizações que atendem por e-mail com muitos envolvidos.
4. **Elegibilidade de Fila como origem de permissão** (DO-CXE-19). É a primeira origem "por referência operacional" da plataforma; se rejeitada, "Atendente vê as Conversas da sua Fila" exige concessão à Equipe sobre a Fila (viável) e "Conversas sem Fila" ficam visíveis só a Administradores. Relaciona-se com a questão 1 do documento 10 (escopo "da minha Equipe").
5. **Prioridade nativa de Conversa** (DO-CXE-10). Reabrir se Painéis precisarem de urgência comparável entre Filas e Espaços de Trabalho (C17 por analogia).
6. **Prazo de validade de envio pendente** (DO-CXE-18): Limite da plataforma ou configuração do Espaço de Trabalho (B34)? Recomendação: plataforma nesta versão.
7. **Retenção e anonimização de Mensagens** (C9). O que resta em Mensagens `enviada` (que citam o nome da pessoa), em Leitura interna e em Reações após eliminação por solicitação do titular; prazo de lixeira de Conversas versus obrigação de guarda de atendimento.
8. **Visibilidade seletiva de `interna`.** Hoje toda `interna` é visível a quem vê a Conversa; "nota só para supervisores" exigiria permissão por Mensagem, rejeitada nesta versão por complexidade; registrar se o produto pedir.
9. **Transcrição e descrição de Anexos** (7.11). Se adotadas, decidir custo (C8), consentimento (C7) e se são Fragmentos de Conhecimento (B19 diz que Conversas não são Conhecimento).
10. **Canais compartilhados entre Espaços de Trabalho** (C1). Uma holding com um único número de WhatsApp para várias organizações não é expressável (INV-CXE-01 é por Espaço de Trabalho; A1.2).
11. **Definições de Campo em Canal, Fila e Mensagem** (C13). "Centro de custo" na Fila e "campanha" na Mensagem serão pedidos; A5.2 não os prevê.

Resolvidas neste documento com recomendação, sem pendência aberta: Canal sem Proprietário (DO-CXE-02, fecha a questão de B35 e do documento 01, 20.11); Conversa aberta duplicada após mesclagem (DO-CXE-21, fecha a questão 5 do documento 10); localização do Proprietário padrão de Contatos (DO-CXE-05, fecha a delegação de DO-CON-08); Rascunho versus `interna` (DO-CXE-15); cópias de e-mail (DO-CXE-13); Mensagens `pendente` em Canal desconectado (DO-CXE-18); Disponibilidade no Membro (DO-CXE-14); Fila como escopo de Automação (DO-CXE-16).
