# LISTA

> Domínio: Estrutura de Trabalho | Documento 05 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Lista** é o contêiner operacional da Estrutura de Trabalho no qual Tarefas existem. É o único nível da árvore aprovada (A2.1) que contém Tarefas e o último nível que contém alguma coisa: abaixo dela não há contêineres, só trabalho (A3.1). Toda Tarefa raiz nasce, vive e termina dentro de exatamente uma Lista (A3.2, B4); nenhuma Tarefa existe diretamente em um Espaço, em uma Pasta ou em uma Subpasta.

Três propriedades a distinguem de qualquer outra entidade da Estrutura de Trabalho:

1. **É folha da hierarquia de contêineres.** Espaço, Pasta e Subpasta contêm contêineres; a Lista contém Tarefas. Uma Lista nunca contém Lista, Pasta ou Subpasta.
2. **É o ponto em que a herança vira fato.** Todo aspecto configurável da Estrutura (Conjunto de Status, Definições de Campo, Tipos de Tarefa, Funcionalidades habilitadas, Visualizações padrão, Automações, Permissões — B25) é definido em algum nível e **consumido** pela Tarefa por meio da sua Lista. Tarefa nunca define configuração (B25); a Lista é o último nível que define e o único que a Tarefa enxerga.
3. **É a unidade operacional de escopo.** Compartilhar trabalho com um Convidado, alimentar um Widget de Painel, delimitar o Gatilho de uma Automação, conceder acesso a um Agente, instanciar um Template — tudo toma a Lista como unidade natural, porque é a menor porção da estrutura que contém trabalho completo.

A Lista não é uma "Pasta pequena", não é uma forma de apresentação, não é um filtro e não é uma Tarefa grande. Uma Pasta agrupa contêineres; uma Visualização apresenta registros; um Funil ordena Negócios em Etapas; uma Fila distribui Conversas. A Lista contém Tarefas — e só ela contém Tarefas.

## 2. Propósito

1. **Dar existência às Tarefas.** Sem um contêiner obrigatório e único, "onde está esta Tarefa" não teria resposta estável, e herança, permissão e cascata seriam calculadas por Tarefa em vez de por contêiner.
2. **Resolver a configuração em um só ponto.** A Tarefa precisa saber qual Conjunto de Status, quais Definições de Campo, quais Tipos de Tarefa e quais Funcionalidades se aplicam a ela. A Lista responde a todas essas perguntas de uma vez, para todas as suas Tarefas, o que torna a resposta previsível e auditável.
3. **Delimitar operação e acesso.** É o menor recurso da estrutura sobre o qual faz sentido compartilhar, delegar a um Agente ou disparar Automações. Um Convidado que recebe "esta Lista" recebe trabalho inteiro, não fragmentos.
4. **Reutilizar estrutura de trabalho.** Processos repetíveis (onboarding, sprint, obra, evento) são Listas com Tarefas pré-definidas; o Template de Lista captura essa estrutura para instanciação.
5. **Ancorar medição.** "Tarefas desta Lista" é a Fonte de Dados mais frequente de Painéis: a Lista delimita o que se mede sem exigir filtro.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Ator e existente até a eliminação permanente.
- **Contêiner estrutural folha**: participa da cadeia de contenção exclusiva e obrigatória (A3.3), mas só como pai de Tarefas.
- **Não é raiz do agregado das Tarefas.** Tarefa é raiz do próprio agregado (Checklists, Comentários, Registros de Tempo, Valores de Campo — Glossário, "Agregado"). A Lista é o **escopo de pertencimento** das Tarefas e o **ponto de configuração** delas; a consistência que a Lista garante é entre Tarefa e configuração (toda Tarefa tem status válido no Conjunto efetivo; todo Valor de Campo tem Definição efetiva), não a consistência interna de cada Tarefa.
- **É raiz do agregado da sua configuração própria**: Conjunto de Status próprio, Definições de Campo próprias, Visualizações da Lista, Funcionalidades habilitadas e Tipos de Tarefa habilitados não existem sem a Lista.
- **É ponto de definição** no sentido de B25 — o último da cadeia. Nunca é ponto de bloqueio (não há descendente que possa sobrescrever).
- **É Recurso de permissão**, com escopos `registro` (a Lista em si) e `subárvore` (a Lista e suas Tarefas) — B29.
- **Não é Ator, não tem Proprietário (A7 não a lista), não é objeto de valor, não é configuração, não é Visualização.**

## 4. Fronteira conceitual

### O que é

- O contêiner obrigatório e único de toda Tarefa raiz.
- O ponto de resolução de toda configuração consumida por Tarefas.
- A menor unidade estrutural de compartilhamento, escopo de Automação, concessão a Agente e Fonte de Dados.
- A unidade de instanciação de Templates de trabalho repetível.

### O que não é

- **Não é Pasta nem Subpasta.** Pasta e Subpasta agrupam contêineres e nunca contêm Tarefas. Uma Lista pode existir diretamente em um Espaço, sem Pasta; uma Pasta sem Listas é válida, mas não contém trabalho.
- **Não é Tarefa.** Não tem status, Responsável, Prioridade, Checklist, Registro de Tempo, Dependência nem Vínculo. Não "é feita"; contém o que é feito.
- **Não é Visualização.** Uma Visualização em formato "lista" é uma forma de apresentar registros (inclusive de várias Listas); a Lista é o lugar onde os registros existem.
- **Não é Funil nem Fila.** Estes pertencem ao CRM e ordenam ou distribuem Negócios e Conversas; a Lista contém Tarefas com Status.
- **Não é Template de Lista.** O Template armazena estrutura reutilizável; a Lista é a instância viva, sem vínculo com o Template após a instanciação (A8).

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Lista × Pasta** | Contêiner folha; contém 0..N Tarefas; nunca contém contêineres; pai é Espaço, Pasta ou Subpasta. | Agrupador intermediário; contém 0..N Subpastas e 0..N Listas; nunca contém Tarefas; pai é sempre Espaço. | Conteúdo: Tarefas versus contêineres. Ambas definem configuração (B25), mas só a Lista a entrega a Tarefas. |
| **Lista × Subpasta** | Idem; pode ser filha de Subpasta. | Pasta cujo pai é Pasta (B3); contém só Listas; é o limite de profundidade dos agrupadores. | A Subpasta é o último agrupador; a Lista é o último contêiner. Depois da Subpasta só há Listas; depois da Lista só há Tarefas. |
| **Lista × Tarefa** | Contêiner; tem estado de ciclo de vida e atributos descritivos; define configuração. | Unidade de trabalho; tem status atual, Responsáveis, datas, Prioridade, Valores de Campo; consome configuração. | A Lista não tem Status (seção 11) nem Responsável; a Tarefa não contém Tarefas de outra Lista nem define configuração. Subtarefa é Tarefa (B1), nunca "Lista dentro de Tarefa". |
| **Lista × Visualização** | Entidade de domínio; contém Tarefas; escopo de permissão e herança. | Configuração salva de apresentação (lista, quadro, calendário, linha do tempo, tabela) com filtros, agrupamento e ordenação; pertence a um contêiner ou a um Membro (A8). | Uma Visualização "em lista" de um Espaço mostra Tarefas de várias Listas sem que exista uma Lista. Excluir uma Visualização não afeta nenhuma Tarefa; excluir uma Lista afeta todas as suas. |
| **Lista × Funil** | Contém Tarefas; ordena trabalho por Definições de Status do Conjunto efetivo, com categorias fixas (A4.3). | Pertence ao Espaço de Trabalho; ordena Negócios por Etapas, com probabilidade; Negócio tem situação de sistema (A4.4). | Etapa não é Status; Negócio não é Tarefa. Um Negócio pode ter Tarefas vinculadas em qualquer Lista (Vínculo, A8), mas o Funil nunca contém Tarefas e a Lista nunca contém Negócios. |
| **Lista × Fila (Caixa de Entrada)** | Contêiner estrutural com herança de configuração; contém Tarefas; pertence a um Espaço. | Agrupamento operacional de Conversas dentro da Caixa de Entrada única (B11), com Membros e Equipes elegíveis e regras de distribuição. | Fila distribui Conversas a Atendentes; Lista não distribui nada. Fila não tem herança estrutural (o CRM não tem hierarquia, A5.2); Lista tem. |

## 5. Identidade

A Lista tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo ou relação.

**Teste de identidade.** Se a Lista for renomeada, recolorida, reordenada, movida de uma Subpasta para o Espaço, tiver o Conjunto de Status sobrescrito, todas as Definições de Campo trocadas, todas as Tarefas movidas para fora e for arquivada, continua sendo a mesma Lista: os Registros de Atividade continuam a referenciá-la, as Automações com escopo nela continuam a apontar para ela, os Widgets que a têm como Fonte de Dados continuam a referenciá-la, e as Tarefas que um dia a tiveram como Lista continuam a registrar isso no histórico. A identidade é a continuidade do contêiner, não o seu conteúdo nem a sua posição.

Consequências:

- **Nome não é identidade.** O nome é único entre Listas irmãs (mesmo contêiner pai, estados próprios `ativo` e `arquivado`), sem distinção de maiúsculas e de espaços nas extremidades; pode repetir-se entre pais distintos (DO-LIS-06 / B39). Justificativa: o caminho estrutural (Espaço › Pasta › Subpasta › Lista) fica único e legível para Membros, Agentes e Painéis, sem impor unicidade organizacional que impediria "Backlog" em dez Espaços.
- **Pai não é identidade.** Mover a Lista preserva a identidade (seção 12.5).
- **Conteúdo não é identidade.** Uma Lista vazia é a mesma Lista. Uma Lista cujas Tarefas foram todas concluídas é a mesma Lista.
- **Template não é identidade.** Duas Listas instanciadas do mesmo Template são duas Listas distintas com a mesma proveniência.

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Nome | nativo | sim | Nome de exibição. Único entre irmãs (DO-LIS-06). |
| Descrição | nativo | não | Texto livre sobre a finalidade da Lista. |
| Cor | nativo | não | Atributo de apresentação; sem semântica. |
| Ordem | nativo | sim | Posição entre as Listas irmãs do mesmo pai. Sem relação com Prioridade. |
| Contêiner pai | referência (Espaço, Pasta ou Subpasta) | sim | Exatamente um (A3.2). Mutável por operação de mover (seção 12.5). |
| Espaço | derivado | sim | O Espaço no topo do caminho da Lista. Igual ao pai quando a Lista está diretamente no Espaço. |
| Estado próprio | nativo | sim | Estado de ciclo de vida gravado na Lista: `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). Nunca reescrito por cascata (B36). |
| Estado efetivo | derivado | sim | O mais restritivo entre o estado próprio e o estado efetivo do contêiner pai, na ordem `ativo` < `arquivado` < `na lixeira` (B36). Determina o que pode ser feito. |
| Estado próprio anterior à exclusão | nativo | condicional | Preenchido enquanto `na lixeira`, com o estado próprio que a Lista tinha ao ser excluída (`ativo` ou `arquivado`). A restauração a devolve a esse estado (12.2; B36; INV-LIS-15). |
| Modo por aspecto | objeto de valor | sim | Para Conjunto de Status, Funcionalidades habilitadas e Visualização padrão: `herdado` ou `sobrescrito` (B25; seção 16). Nunca `bloqueado`: a Lista não tem descendente que defina configuração (RN-LIS-07). Padrão: `herdado`. |
| Privada | nativo | sim | Booleano. Quando verdadeiro, interrompe a herança de permissões (A9.2; seção 17). Padrão: falso. Só um Membro `ativo` sem base Convidado a marca (RN-LIS-12). |
| Período planejado | objeto de valor | não | Data de início e data de fim da Lista. Descritivo: não restringe nem deriva das datas das Tarefas; Painéis podem compará-lo ao trabalho real. |
| Criador | referência (Ator) | sim | Imutável (A7). Membro, Agente, Automação ou Sistema (na instanciação de Template, o Ator que instanciou). |
| Momento de criação | nativo | sim | Imutável. |
| Proveniência | referência (Template) | não | Template de Lista a partir do qual foi instanciada. Referência histórica, sem vínculo vivo (A8). |
| Momento de arquivamento / envio à lixeira | nativo | condicional | Preenchidos quando no estado correspondente. |
| Previsão de eliminação | derivado | condicional | Momento de envio à lixeira + prazo da Política de lixeira do Espaço de Trabalho (B34). |
| Conjunto de Status efetivo | derivado | sim | O Conjunto resolvido pelo caminho (seção 16). Exatamente um (A4.2, B25). |
| Definições de Campo efetivas | derivado | sim | União das Definições do Caminho efetivo com as próprias (B25). Pode ser vazia. |
| Tipos de Tarefa efetivos | derivado | sim | União dos Tipos de Tarefa do Caminho efetivo com os próprios (acumulam, B25). Inclui sempre o Tipo padrão da plataforma. |
| Funcionalidades efetivas | derivado | sim | Conjunto de Funcionalidades da Tarefa habilitadas, resolvido pelo caminho (ex.: Registro de Tempo, Dependências, Prioridade, Checklists, Recorrência). Catálogo fornecido pela plataforma. |
| Quantidade de Tarefas | derivado | sim | Tarefas raiz `ativo` contidas. Comparada ao Limite imposto (RN-LIS-18). |

**Atributos analisados e rejeitados** (DO-LIS-02): **Status da Lista** — o ClickUp mantém um "status de Lista" independente do status das Tarefas; aqui, a Lista tem apenas estado de ciclo de vida, porque um segundo conceito chamado "status" no contêiner colidiria com A4.2 e obrigaria Automações, Painéis e IA a perguntar "status de quê?". **Prioridade da Lista** — Prioridade é atributo ordinal nativo da Tarefa (Glossário); uma Prioridade no contêiner não altera nenhuma Tarefa e não é herdável, e "Ordem" já posiciona a Lista entre irmãs. **Proprietário** — A7 não o prevê para Lista; governança é por Papel e permissão `administrar` (seção 17). **Responsável da Lista** — Responsável é quem executa trabalho, e a Lista não é trabalho.

Não são atributos, embora sejam configurados na Lista: Conjunto de Status próprio, Definições de Campo próprias, Visualizações da Lista. São componentes com identidade (seção 7). Automações com escopo Lista não são nem atributos nem componentes: pertencem ao Espaço de Trabalho (documento 01, seção 8).

## 7. Entidades internas ou componentes

Componentes são configurações com identidade cuja existência depende da Lista. Tarefas **não** são componentes: são raízes do próprio agregado, contidas estruturalmente pela Lista (seção 8).

### 7.1 Conjunto de Status próprio (0..1)

Presente apenas quando a Lista está em modo `sobrescrito` para Conjunto de Status (B25). Sequência ordenada de Definições de Status, cada uma com nome, cor, categoria fixa (A4.3) e ordem. Quando a Lista está em modo `herdado`, não há componente: o efetivo é o do ancestral mais próximo que o define. Remover a sobrescrita (voltar a `herdado`) elimina o componente e exige mapeamento (RN-LIS-06). Os detalhes de Definição de Status (regras de categoria, reabertura, Status inicial padrão) são do documento de Status; aqui só se registra a posse.

### 7.2 Definições de Campo Personalizado próprias (0..N)

Definições cujo ponto de definição é a Lista (A5.2). Aplicam-se a todas as Tarefas da Lista, inclusive Subtarefas. Cada uma tem exatamente um Tipo de Campo (A5.3) e nome único no caminho efetivo (RN-LIS-08). Removê-la a leva a `na lixeira`, com os Valores de Campo retidos e invisíveis até a eliminação permanente da Definição, que os elimina (A5.4; mesmo tratamento de DO-ESP-05).

### 7.3 Visualizações da Lista (0..N)

Configurações salvas de apresentação das Tarefas desta Lista (A8): tipo (lista, quadro, calendário, linha do tempo, tabela), filtros, agrupamento, ordenação, colunas visíveis. Uma delas pode ser marcada como padrão da Lista; na ausência, aplica-se a Visualização padrão herdada (B25). **Visualizações pessoais** sobre a Lista pertencem ao Membro, não à Lista (A8), e sobrevivem a alterações da Lista até que o Membro as remova.

### 7.4 Funcionalidades habilitadas (objeto de valor, condicional) e Tipos de Tarefa próprios (0..N)

**Funcionalidades habilitadas**: presentes apenas quando a Lista sobrescreve o aspecto (modo substitui, B25); conjunto de indicadores sobre o catálogo fornecido pela plataforma; sem identidade própria. **Tipos de Tarefa próprios**: Tipos cujo ponto de definição é a Lista, com identidade, que acumulam com os do Caminho efetivo (B25; documento de Espaço, 7.3; C6). A Lista não remove Tipos definidos em ancestrais.

### 7.5 Concessões diretas e compartilhamentos sobre a Lista

Permissões cujo Recurso é a Lista (origem: concessão direta ou compartilhamento — A9.1) vivem na Lista, como em qualquer Recurso (documento 01, seção 21). São o único meio de acesso quando a Lista é privada.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a contêiner pai | Espaço, Pasta ou Subpasta | pertencimento (contenção estrutural) | Lista → pai | Exatamente um (A3.2). Cascata de estado do pai para a Lista (A3.3). |
| pertence a Espaço | Espaço | pertencimento (transitivo) | Lista → Espaço | Derivado do caminho. Define o topo da herança. |
| pertence a Espaço de Trabalho | Espaço de Trabalho | pertencimento (transitivo) | Lista → ET | Imutável (RN-ET-01). |
| contém Tarefas raiz | Tarefa | contenção estrutural | Lista → Tarefa | 0..N. Tarefa não existe sem Lista (B4). Cascata de estado. |
| contém Subtarefas (por meio da raiz) | Tarefa (Subtarefa) | contenção transitiva | Lista → Subtarefa | B1: a Subtarefa está na Lista da sua raiz; nunca em outra. |
| define Conjunto de Status próprio | Conjunto de Status | contenção (componente) | Lista → Conjunto | 0..1; só em modo `sobrescrito`. |
| consome Conjunto de Status efetivo | Conjunto de Status | herança (resolução) | ancestral → Lista | Exatamente um, resolvido pelo caminho (DO-LIS-04). |
| define Definições de Campo próprias | Definição de Campo Personalizado | contenção (componente) | Lista → Definição | 0..N. |
| herda Definições de Campo | Definição de Campo Personalizado | herança (acumulação) | ancestrais → Lista | Todas as do caminho (B25). |
| contém Visualizações da Lista | Visualização | contenção (configuração) | Lista → Visualização | 0..N; A8. |
| herda Tipos de Tarefa | Tipo de Tarefa | herança (acumulação) | ancestrais → Lista | Todos os do caminho (B25). |
| herda Funcionalidades, Visualização padrão | configuração | herança (substituição) | ancestral → Lista | Modo `herdado` ou `sobrescrito` (B25). |
| herda Permissões | Permissão | herança | pai → Lista | Interrompida quando privada (A9.2). |
| guarda concessões diretas / compartilhamentos | Permissão | contenção | Lista → Permissão | Recurso = Lista. |
| é escopo de Automações | Automação | associação (escopo) | Automação → Lista | 0..N. A Automação pertence ao ET; a Lista delimita o Gatilho (RN-LIS-09). |
| é Fonte de Dados de Widgets | Widget (Painel) | referência | Widget → Lista | 0..N. Referência, não cópia; o Widget filtra pelo visualizador (B20). |
| é Âncora de | Painel (de contexto) | referência | Painel → Lista | 0..N. Sem contenção nem herança; acompanha a movimentação da Lista; na eliminação passa a `eliminada` como valor e o Painel permanece (DO-PAI-07). |
| é Âncora de | Sessão de Chat | referência inversa | Sessão → Lista | 0..N Sessões. A Lista não conhece Sessões; a âncora não concede permissão e sobrevive como valor à eliminação (B83). |
| é Recurso de permissão de Agentes | Agente | associação (permissão) | Agente → Lista | Concessão direta ou compartilhamento com Sujeito Agente (A6.3). |
| foi instanciada de | Template | referência (proveniência) | Lista → Template | 0..1. Sem vínculo vivo (A8). |
| originou Templates | Template | referência (proveniência) | Template → Lista | 0..N. O Template registra de que Lista foi criado; a Lista não depende disso. |
| foi criada por | Ator | referência | Lista → Ator | Criador imutável. |
| é objeto de Registros de Atividade | Registro de Atividade | referência | Registro → Lista | Registros pertencem ao ET (documento 01). |

Distinção aplicada: **CONTER** (Tarefas, componentes de configuração, concessões), **HERDAR** (Conjunto, Definições, Tipos, Funcionalidades, Visualização padrão, Permissões), **CONFIGURAR** (Privada, Período planejado, modos de herança), **REFERENCIAR** (Template, Criador), **RELACIONAR-SE** por associação (Automação, Widget, Agente). Poder configurar uma Automação "a partir da Lista" não a torna filha da Lista: ela pertence ao Espaço de Trabalho; mas o escopo lhe é essencial, por isso fica inoperante enquanto a Lista não está efetivamente `ativo` e é eliminada com ela (RN-LIS-15; B41).

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Lista → contêiner pai | 1 | não | não | estrutural | A3.2. Sem pai não há caminho de herança nem permissão. |
| Espaço / Pasta / Subpasta → Lista | 0..N | sim | sim | estrutural | A3.1. Um contêiner recém-criado não tem Listas. |
| Lista → Tarefa raiz | 0..N | sim | sim | estrutural | Lista vazia é válida (RN-LIS-04). Limite superior é Limite imposto, não regra (RN-LIS-18). |
| Tarefa raiz → Lista | 1 | não | não | estrutural | B4. Múltiplas Listas é pendência C3. |
| Subtarefa → Lista | 1 (a da raiz) | não | não | estrutural (derivada) | B1. |
| Lista → Conjunto de Status próprio | 0..1 | sim | não | componente | Zero em modo `herdado`. Dois conjuntos na mesma Lista tornariam o status atual ambíguo. |
| Lista → Conjunto de Status efetivo | 1 | não | não | herança | A4.2: só um se aplica. Pressupõe que todo Espaço define um Conjunto (dependência do documento de Espaço, seção 19). |
| Lista → Definição de Campo própria | 0..N | sim | sim | componente | |
| Lista → Definição de Campo efetiva | 0..N | sim | sim | herança | Uma Lista sem nenhuma Definição no caminho é válida: Tarefas têm só atributos nativos. |
| Lista → Visualização da Lista | 0..N | sim | sim | componente | Zero é válido: aplica-se a Visualização padrão herdada ou a da plataforma. |
| Lista → Visualização padrão | 0..1 | sim | não | configuração | |
| Lista → Período planejado | 0..1 | sim | não | objeto de valor | |
| Lista → Criador | 1 | não | não | referência | |
| Lista → Template de origem | 0..1 | sim | não | referência | |
| Automação → Lista (escopo) | 0..1 | sim | não | associativa | Uma Automação tem um único escopo (Glossário); pode não ser uma Lista. |
| Lista ← Automações com escopo nela | 0..N | sim | sim | associativa | |
| Widget → Lista (Fonte de Dados) | 0..N | sim | sim | associativa | Um Widget pode agregar várias Listas; a cardinalidade exata é do documento de Painéis. |
| Lista ← Widgets | 0..N | sim | sim | associativa | |
| Lista ← Sessões de Chat ancoradas | 0..N | sim | sim | associativa | B83. |
| Lista ← Agentes com permissão sobre ela | 0..N | sim | sim | associativa | |
| Lista ← Templates originados dela | 0..N | sim | sim | referência | |
| Lista → concessão direta / compartilhamento | 0..N | sim | sim | contenção | Se privada, 1..N: ao menos uma `administrar` a Membro `ativo` (DO-LIS-15 / B38). |

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** A Lista ocupa a posição de folha na cadeia Espaço → Pasta → Subpasta → Lista → Tarefa. Três caminhos são válidos e só eles (A2.1, A3.1):

| Caminho | Comprimento da herança | O que muda |
| --- | --- | --- |
| Espaço → Lista | 1 ancestral | Nada além do caminho: a Lista herda diretamente do Espaço. |
| Espaço → Pasta → Lista | 2 ancestrais | A Pasta pode sobrescrever ou bloquear aspectos antes de a Lista os receber. |
| Espaço → Pasta → Subpasta → Lista | 3 ancestrais | Idem, com um ponto adicional. É o caminho máximo (A3.4). |

Uma Lista diretamente no Espaço tem exatamente as mesmas capacidades, atributos, permissões e componentes que uma Lista em Subpasta. **A única diferença é o comprimento do caminho de herança** — e, portanto, quantos ancestrais podem ter sobrescrito ou bloqueado um aspecto antes dela. Não existe "Lista de Espaço" como tipo distinto.

**Pertencimento (teste de existência).** A Lista falha no teste sem o seu contêiner pai: eliminado o pai, a Lista é eliminada em cascata (A3.3). As Tarefas falham no teste sem a Lista: são dependentes por contenção. Widgets com a Lista como Fonte de Dados, Painéis de contexto ancorados nela, Agentes com permissão sobre ela e Templates instanciados dela **sobrevivem** à eliminação da Lista (o Widget passa a `inválido`, a Âncora a `eliminada`, a concessão desaparece, o Template segue íntegro) — são associações, não dependências. Automações com escopo Lista pertencem ao Espaço de Trabalho, mas o escopo lhes é essencial: são eliminadas com a Lista (B41).

**"Pertence a" versus "relaciona-se com".** Uma Tarefa *pertence* à Lista. Uma Lista *pertence* ao seu pai. Uma Automação *relaciona-se com* a Lista (escopo). Um Painel *relaciona-se com* a Lista (Fonte de Dados). Um Negócio *relaciona-se com* Tarefas da Lista (Vínculo), nunca com a Lista.

**Propriedade.** A Lista **não tem Proprietário** (A7). Quem responde pela Lista é, por Papel, o Administrador do Espaço de Trabalho e, por permissão, quem tem `administrar` sobre ela ou sobre um ancestral em escopo `subárvore`. Não há sucessão de Listas na remoção de Membro (B28 só transfere propriedades); a remoção do Criador não altera nada na Lista.

**Configurar não é conter.** A Lista configura o seu modo de herança para cada aspecto, mas não contém o Conjunto de Status do Espaço que herda; contém apenas o que define. Um Membro com `administrar` sobre a Lista pode criar uma Automação com escopo nela; a Automação é do Espaço de Trabalho e tem o seu próprio Proprietário.

## 11. Estados

Todos os estados desta seção são **estados de sistema** (A4.1), não personalizáveis. **A Lista não tem Status** (A4.2 restringe Status a Tarefas; DO-LIS-02).

| Estado próprio | Significado | Tarefas contidas | O que pode acontecer |
| --- | --- | --- | --- |
| `ativo` | Operação normal (se o estado efetivo também é `ativo`). | Qualquer estado próprio (`ativo`, `arquivado`, `na lixeira`), conforme ações sobre cada Tarefa. | Criar, mover e editar Tarefas; configurar; ser escopo de Automações ativas; alimentar Widgets. |
| `arquivado` | Retirada da operação corrente, íntegra e recuperável. | Estado efetivo `arquivado` ou mais restrito para todas, sem reescrita do estado próprio (INV-LIS-08; B36). | Ver e exportar; comentar nas Tarefas (recomendação, para registro histórico); alterar permissões; alterar o estado próprio de Tarefas (documento de Tarefa). Não recebe Tarefas novas nem movidas; Automações com escopo nela ficam inoperantes; Widgets podem incluí-la se o filtro pedir arquivadas. Restaurável. |
| `na lixeira` | Excluída de forma recuperável, até o fim do prazo da Política de lixeira. | Estado efetivo `na lixeira` para todas. | Restaurar (RN-LIS-14) ou eliminar permanentemente. Invisível para operação, Automações e Widgets. |

**Estado efetivo** (B36). Uma Lista com estado próprio `ativo` cujo contêiner pai está efetivamente `arquivado` ou `na lixeira` está, para todos os efeitos, no estado do pai; o mesmo vale para cada Tarefa em relação à Lista. Toda regra de "o que pode ser feito" avalia o estado efetivo; toda regra de "o que acontece ao restaurar" avalia o estado próprio. Registros de Tempo em andamento em Tarefas da Lista são encerrados no ato em que a Tarefa deixa de ter estado efetivo `ativo` (DO-LIS-09).

Eliminação permanente não é estado: é o fim da existência da Lista e de tudo o que ela contém (seção 12.4).

**Condições derivadas que não são estados.** "Lista vazia" (zero Tarefas raiz), "Lista só com Tarefas concluídas" (todas as Tarefas `ativo` em Definições de Status de categoria `concluído` ou `fechado`) e "Lista fora do Período planejado" são predicados calculáveis, úteis a Painéis, Automações e Agentes, mas não alteram o estado nem são atributos. Uma Lista só com Tarefas concluídas continua `ativo` até que alguém a arquive: concluir trabalho e encerrar o contêiner são atos distintos, com Atores distintos.

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Ator com permissão `criar` no contêiner de destino (Espaço, Pasta ou Subpasta efetivamente `ativo`). Formas: criação direta; instanciação de Template de Lista (RN-LIS-17); criação por Automação ou Agente (dentro das suas permissões, A6.3). A criação produz a Lista em `ativo`, em modo `herdado` para todos os aspectos, com Ordem ao fim das irmãs, sem Tarefas (exceto na instanciação de Template), Privada = falso, e o Registro de Atividade "Lista criada". Nome que colida com irmã `ativo` ou `arquivado` é rejeitado (DO-LIS-06 / B39).

### 12.2 Transições de estado

| De (próprio) | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | Ator com `administrar` sobre a Lista | Estado efetivo de toda Tarefa passa a `arquivado` por derivação; estados próprios não são reescritos (B36). Tarefas mantêm status atual, Responsáveis, Valores, Vínculos, Dependências. Registros de Tempo em andamento são encerrados no ato (DO-LIS-09). Automações com escopo Lista ficam inoperantes (B41). Registro de Atividade. |
| `arquivado` | `ativo` | Ator com `administrar` | Cada Tarefa volta ao seu estado próprio: as que estavam `ativo` voltam a efetivo `ativo`; as arquivadas individualmente antes permanecem `arquivado` (RN-LIS-13). Permitido mesmo sob pai `arquivado` ou `na lixeira`: o estado efetivo continua derivado (B36). Registros de Tempo não são reabertos. Registro de Atividade. |
| `ativo` ou `arquivado` | `na lixeira` | Ator com `excluir` | Estado próprio anterior à exclusão gravado. Estado efetivo de toda Tarefa passa a `na lixeira`. Automações com escopo Lista ficam inoperantes; Widgets com a Lista como Fonte de Dados ficam sem dados, com indicação de fonte indisponível (mesmo tratamento de DO-ESP-13); concessões permanecem gravadas para a eventual restauração. Previsão de eliminação calculada. Registro de Atividade. |
| `na lixeira` | `ativo` ou `arquivado` (o Estado próprio anterior à exclusão) | Ator com `excluir` (restaurar); só se o pai não estiver `na lixeira` | Restaura a Lista ao estado próprio que tinha ao ser excluída; cada Tarefa volta ao seu estado próprio. Pai `arquivado` é aceito: a Lista fica efetivamente `arquivado`. Se o pai está `na lixeira`, restaura-se o pai antes, ou a restauração indica novo pai efetivamente `ativo` (restauração e movimentação no mesmo ato, com mapeamento — RN-LIS-11). Colisão de nome exige renomear (B39). Widgets voltam a ler a Lista; Automações voltam a operar quando o efetivo for `ativo`. Registro de Atividade. |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo) ou Ator com `administrar` (eliminar agora) | Não é transição de estado: fim (12.4). |

A restauração devolve ao estado próprio anterior, nunca força `ativo`: uma Lista arquivada enviada à lixeira volta `arquivado` (B36). Permissões de ciclo de vida: arquivar e desarquivar exigem `administrar`; enviar à lixeira e restaurar exigem `excluir`; eliminar antecipadamente exige `administrar` (17.1; B46).

### 12.3 Cascata do pai

Quando o contêiner pai é arquivado ou enviado à lixeira, a Lista passa ao estado efetivo correspondente por derivação, sem alteração do seu estado próprio (A3.3; B36). Quando o pai é restaurado, cada Lista volta ao seu estado próprio: as que já estavam `arquivado` ou `na lixeira` por ato próprio permanecem como estavam. Isso evita que a restauração de um Espaço ressuscite Listas que alguém arquivou deliberadamente meses antes, sem precisar gravar "origem do estado" — a informação é derivável do estado próprio. O estado próprio da Lista pode ser alterado por quem tem permissão mesmo com o pai `arquivado` ou `na lixeira` (B36): uma Lista arquivada individualmente sob Pasta arquivada permanece `arquivado` quando a Pasta é restaurada; uma Lista cujo estado próprio não é `na lixeira` pode ser movida para fora do pai restritivo, para um destino efetivamente `ativo` (12.5). Restaurar de `na lixeira` exige pai não `na lixeira` (RN-LIS-14).

### 12.4 Eliminação permanente e cascata

Elimina, no mesmo ato: a Lista; todas as Tarefas raiz e Subtarefas com os seus agregados (Checklists, Comentários, Registros de Tempo, Valores de Campo, Anexos como referências, Regras de Recorrência); Conjunto de Status próprio; Definições de Campo próprias; Visualizações da Lista; concessões diretas e compartilhamentos sobre a Lista; Vínculos que tinham uma Tarefa da Lista como um dos lados (A8: remove-se o Vínculo, não o outro registro); Dependências que envolviam Tarefas da Lista.

Eliminadas também, por dependerem do escopo: Automações com escopo na Lista (B41), com Execuções passadas preservadas. Não são eliminados: Arquivos (pertencem ao Espaço de Trabalho e podem ser referenciados por outros registros — A8); Registros de Atividade (INV-ET-12: continuam a referenciar o identificador da Lista eliminada); Automações de outro escopo que referenciavam a Lista como alvo de Ação (passam a ter referência inválida); Widgets com Fonte na Lista (passam a `inválido` e permanecem no Painel até edição humana — RN-PAI-20); Painéis de contexto ancorados à Lista (a Âncora passa a `eliminada`; o Painel permanece e o Proprietário é notificado — DO-PAI-07); Templates originados da Lista; Visualizações pessoais dos Membros sobre a Lista (pertencem ao Membro; ficam vazias até que ele as remova).

### 12.5 Mover a Lista

Mover não é transição de estado; é alteração do Contêiner pai, dentro do mesmo Espaço de Trabalho (RN-ET-01), para um contêiner efetivamente `ativo` de qualquer Espaço. Operação atômica (B40) que exige `administrar` na Lista e `criar` no destino; o estado efetivo de origem não a impede, desde que o estado próprio da Lista não seja `na lixeira` (B36). Recalcula toda a herança (seção 16): se o Conjunto de Status efetivo mudar, exige mapeamento por categoria (RN-LIS-06) ou, alternativamente e se o destino não bloqueia o aspecto, a Lista passa a sobrescrever com uma cópia do Conjunto de origem, sem remapear Tarefas; Definições herdadas que deixem de ser efetivas têm os seus Valores arquivados no agregado de cada Tarefa (RN-LIS-10; B37); Definições próprias viajam com a Lista e não podem colidir com o novo caminho (RN-LIS-08). Automações com escopo Lista, Widgets, concessões diretas, compartilhamentos e o atributo Privada acompanham a Lista; Vínculos e Dependências das Tarefas permanecem. Permissões de origem `herança` passam a vir do novo pai; Responsáveis e Observadores que perdem `ver` são liberados. Rejeitada se o destino bloqueia um aspecto que a Lista sobrescreve (B25) ou se há colisão de nome (B39). Registro de Atividade com origem, destino e mapeamento aplicado.

## 13. Regras de negócio ontológicas

- **RN-LIS-01.** Toda Lista tem exatamente um contêiner pai — Espaço, Pasta ou Subpasta — do mesmo Espaço de Trabalho (A3.2). Não existe Lista sem pai, nem Lista diretamente no Espaço de Trabalho.
- **RN-LIS-02.** A Lista contém apenas Tarefas. Nunca contém Lista, Pasta, Subpasta, Negócio, Conversa, Documento de Conhecimento ou Painel.
- **RN-LIS-03.** Toda Tarefa raiz pertence a exatamente uma Lista (B4). Toda Subtarefa pertence à Lista da sua Tarefa raiz (B1); a Lista da Subtarefa não é atribuível separadamente.
- **RN-LIS-04.** Lista vazia é válida. Nenhuma condição sobre o conteúdo (zero Tarefas, todas concluídas, todas arquivadas) altera o estado da Lista nem impede ações sobre ela.
- **RN-LIS-05.** O Conjunto de Status efetivo da Lista é resolvido pelo caminho: o próprio, se `sobrescrito`; senão, o do ancestral mais próximo em modo `sobrescrito` (ou o do Espaço, que sempre define um). Exatamente um se aplica (A4.2, B25; DO-LIS-04).
- **RN-LIS-06.** Toda operação que altera o Conjunto de Status efetivo de uma Lista (sobrescrever, remover a sobrescrita, alterar um Conjunto ancestral em uso, remover uma Definição de Status em uso, mover a Lista) exige um **mapeamento** de cada Definição de Status atualmente em uso pelas Tarefas da Lista para exatamente uma Definição do novo Conjunto. Sem mapeamento completo, a operação é inválida. O mapeamento é aplicado no mesmo ato, gera Registro de Atividade por Tarefa e, quando altera a categoria (A4.3), produz os eventos correspondentes (concluída, reaberta).
- **RN-LIS-07.** A Lista só pode sobrescrever um aspecto se nenhum ancestral o tiver marcado `bloqueado` (B25). A Lista nunca marca `bloqueado`: não há descendente que defina configuração.
- **RN-LIS-08.** O nome de uma Definição de Campo Personalizado é único, sem distinção de maiúsculas, no **caminho efetivo**: criar na Lista uma Definição com nome já efetivo (herdado) é inválido; criar em um ancestral uma Definição cujo nome já exista em qualquer Lista ou contêiner descendente também é inválido (DO-LIS-05). Mover uma Lista para um caminho em que haja colisão é inválido até renomear.
- **RN-LIS-09.** Automações com escopo Lista **acumulam** com as de escopo ancestral (B25). O escopo delimita o **Gatilho** (eventos das Tarefas desta Lista e da própria Lista), não a **Ação**: uma Ação pode criar ou alterar Tarefas em outra Lista, dentro das permissões próprias da Automação com o Proprietário como teto (próprias ∩ Proprietário atual — DO-AUT-01; B88; documento 01, 17.1) e das do Agente invocado (RN-AUT-25; DO-LIS-13).
- **RN-LIS-10.** Mover uma Tarefa raiz entre Listas (B40): (a) o status atual é mapeado, por categoria, para o Conjunto efetivo de destino, se a Definição de origem não for a mesma; a categoria nunca muda sem ato explícito; (b) Valores de Campo cujas Definições permanecem efetivas no destino (definidas em ancestral comum) são preservados; os demais passam a `arquivado` no agregado da Tarefa, preservados e reativáveis (B37); (c) Subtarefas acompanham a raiz com as mesmas regras (B1); (d) Vínculos, Dependências, Comentários, Registros de Tempo, Anexos e Tags são preservados; (e) Tipo de Tarefa em uso que não seja efetivo no destino passa ao padrão, e Funcionalidades seguem RN-LIS-21. Exige `editar` na Tarefa e `criar` na Lista de destino.
- **RN-LIS-11.** Mover uma Lista segue 12.5: sempre dentro do Espaço de Trabalho; entre Espaços é permitido; a herança é recalculada; RN-LIS-06, RN-LIS-08 e RN-LIS-10(b) aplicam-se a todas as Tarefas da Lista no mesmo ato (DO-LIS-08 / B40).
- **RN-LIS-12.** Marcar a Lista como privada interrompe a herança de permissões (A9.2): permanecem apenas concessões diretas e compartilhamentos, inclusive para Administradores e para o Proprietário do Espaço de Trabalho. Só um Membro `ativo` sem base Convidado a torna privada (Agentes e Automações não o fazem, porque não recebem `administrar` — B38); no ato, esse Membro recebe concessão direta `administrar` em escopo `subárvore`, para que a Lista nunca fique sem quem a administre; quando o último Membro `ativo` com `administrar` é removido ou suspenso, a concessão passa ao Sucessor no mesmo ato (exceção a B28). O Proprietário e os Administradores do Espaço de Trabalho podem conceder acesso à Lista privada, inclusive a si mesmos, apenas por ato de governança registrado (DO-LIS-15 / B38). Desmarcar restaura a herança sem remover concessões.
- **RN-LIS-13.** Arquivar e restaurar operam por **estado efetivo** (B36): arquivar a Lista não reescreve o estado próprio das Tarefas; restaurá-la devolve a cada Tarefa o seu estado próprio, de modo que só o que estava `ativo` por si volta a efetivo `ativo` (DO-LIS-09). Uma Lista efetivamente `arquivado` não recebe Tarefas novas nem movidas.
- **RN-LIS-14.** Restaurar uma Lista da lixeira devolve-a ao Estado próprio anterior à exclusão (`ativo` ou `arquivado`) e exige contêiner pai não `na lixeira`; pai `arquivado` é aceito e a Lista fica efetivamente `arquivado`. Se o pai estiver `na lixeira`, restaura-se o pai antes, ou a restauração indica novo pai efetivamente `ativo` (restauração e movimentação no mesmo ato). Se o pai foi eliminado permanentemente, a Lista foi eliminada com ele (A3.3).
- **RN-LIS-15.** A eliminação permanente da Lista elimina em cascata tudo o que ela contém (12.4) e as Automações com escopo nela (B41). Registros de Atividade e Arquivos permanecem no Espaço de Trabalho. Widgets com Fonte na Lista ficam `inválido` (RN-PAI-20), a Âncora de Painel de contexto fica `eliminada` (DO-PAI-07) e Automações de outro escopo que a referenciavam permanecem com referência inválida, até que os seus Proprietários os corrijam ou removam.
- **RN-LIS-16.** A Lista não tem Status personalizável, Prioridade, Proprietário nem Responsável (DO-LIS-02, DO-LIS-03).
- **RN-LIS-17.** Instanciar um Template de Lista cria uma Lista nova e, para cada Tarefa descrita no Template, uma Tarefa nova com identidade própria, Criador igual ao Ator que instanciou, status inicial válido no Conjunto efetivo da nova Lista e Proveniência para o Template. As "Tarefas" do Template não são Tarefas: são descrições. Não há vínculo vivo com o Template (A8; DO-LIS-12).
- **RN-LIS-18.** O número máximo de Tarefas por Lista é um **Limite imposto** do Espaço de Trabalho (B34), verificado no ato de criar ou mover Tarefas para a Lista (RN-ET-23). Atingi-lo gera evento e bloqueia a ação; não altera o estado da Lista. Não é regra ontológica: a ontologia admite 0..N (DO-LIS-11).
- **RN-LIS-19.** O nome da Lista é único entre irmãs `ativo` e `arquivado` do mesmo pai, sem distinção de maiúsculas e de espaços nas extremidades. Criar, renomear, mover ou restaurar com colisão é inválido (DO-LIS-06 / B39).
- **RN-LIS-20.** Toda Tarefa da Lista tem Tipo de Tarefa entre os Tipos efetivos (união do caminho, B25). Remover um Tipo próprio em uso exige remapeamento das Tarefas para outro Tipo efetivo, no mesmo ato (mesmo princípio de RN-LIS-06; DO-LIS-14).
- **RN-LIS-21.** Desabilitar uma Funcionalidade na Lista impede novos usos e não destrói dados existentes (Registros de Tempo, Dependências, Checklists permanecem, apenas não editáveis pela Funcionalidade). Mesmo princípio de RN-ET-17: nenhuma cascata destrutiva por mudança de configuração (DO-LIS-14).
- **RN-LIS-22.** Toda ação sobre a Lista e os seus componentes (criar, renomear, mover, reordenar, configurar, sobrescrever, mapear, privar, arquivar, restaurar, excluir, eliminar, conceder) gera Registro de Atividade com Ator e, quando houver, ator delegante (A6.2).
- **RN-LIS-23.** Agentes e Automações estão sujeitos às permissões sobre a Lista como qualquer Sujeito (A6.3). Um Agente com permissão apenas sobre uma Lista não lê, por Vínculo ou Dependência, Tarefas de outra Lista sobre a qual não tenha permissão; a Ferramenta falha e o evento é registrado (B23).

## 14. Invariantes

- **INV-LIS-01.** Toda Lista tem exatamente um contêiner pai, que é um Espaço, uma Pasta ou uma Subpasta do mesmo Espaço de Trabalho.
- **INV-LIS-02.** Nenhuma Lista contém Lista, Pasta ou Subpasta.
- **INV-LIS-03.** Para toda Lista existe exatamente um Conjunto de Status efetivo.
- **INV-LIS-04.** Toda Tarefa da Lista — raiz ou Subtarefa — tem status atual que aponta para uma Definição de Status do Conjunto de Status efetivo da Lista.
- **INV-LIS-05.** Toda Subtarefa está na mesma Lista que a sua Tarefa raiz.
- **INV-LIS-06.** Os nomes das Definições de Campo efetivas de uma Lista são únicos entre si, sem distinção de maiúsculas.
- **INV-LIS-07.** Todo Valor de Campo `ativo` de uma Tarefa da Lista corresponde a uma Definição de Campo efetiva da Lista; Valores `arquivado` por movimentação correspondem a Definições que já foram efetivas (B37).
- **INV-LIS-08.** O estado efetivo de nenhuma Tarefa de uma Lista é menos restritivo que o estado efetivo da Lista, na ordem `ativo` < `arquivado` < `na lixeira` (B36).
- **INV-LIS-09.** Não existem duas Listas irmãs `ativo` ou `arquivado` com o mesmo nome, sem distinção de maiúsculas (B39).
- **INV-LIS-10.** A Lista não possui Status, Prioridade, Proprietário nem Responsável.
- **INV-LIS-11.** Se a Lista é privada, nenhuma permissão efetiva sobre ela tem origem `papel no Espaço de Trabalho` ou `herança do contêiner pai`, e existe ao menos uma concessão direta `administrar` a um Membro `ativo` (B38).
- **INV-LIS-12.** Toda Tarefa da Lista tem Tipo de Tarefa entre os Tipos efetivos da Lista.
- **INV-LIS-13.** Nenhum Template referencia uma Tarefa viva, e nenhuma Tarefa instanciada é referenciada por um Template além da Proveniência.
- **INV-LIS-14.** O estado efetivo da Lista é o mais restritivo entre o seu estado próprio e o estado efetivo do contêiner pai (B36).
- **INV-LIS-15.** Estado próprio anterior à exclusão está preenchido se e somente se o estado próprio é `na lixeira`, e vale `ativo` ou `arquivado`.

## 15. Personalização

**Personalizável na Lista** (por quem tem `administrar` sobre ela, salvo indicação):

- Nome, Descrição, Cor, Ordem (Ordem: quem tem `editar` no pai), Período planejado.
- Privada.
- Modo de cada aspecto de B25 (`herdado` ou `sobrescrito`), quando não bloqueado por ancestral: Conjunto de Status, Funcionalidades habilitadas, Visualização padrão.
- Definições de Campo próprias e Tipos de Tarefa próprios (criar, alterar, remover — com as consequências de A5.4 e de RN-LIS-20); ambos acumulam com os do caminho (B25).
- Visualizações da Lista; Visualizações pessoais (por qualquer Membro com `ver`, pertencem ao Membro).
- Automações com escopo Lista (criação exige também permissão de criar Automações, conforme documento de Automações).
- Criar Template a partir da Lista (com ou sem Tarefas).

**Não personalizável:**

- Identificador, Criador, Momento de criação, Proveniência.
- Estados, transições e cascata.
- Ser folha: não se pode habilitar "Lista dentro de Lista" nem "Tarefa fora de Lista".
- A unicidade de Lista por Tarefa (B4) e o Conjunto de Status efetivo único (A4.2).
- Categorias de status (A4.3), catálogo de Tipos de Campo (A5.3), catálogo de Funcionalidades (plataforma).
- Tags e Templates são definidos no Espaço de Trabalho (B5, A8); a Lista os usa, não os define.
- Limites impostos (B34).

Não há Campos Personalizados sobre a Lista: A5.2 restringe Definições a Tarefa, Contato, Empresa, Negócio e Conversa. "Cliente desta Lista" ou "centro de custo" da Lista ficam na Descrição ou em Definições de Campo das Tarefas (pendência análoga a C13; seção 25).

## 16. Herança

A Lista é o **último ponto de definição** e o **único ponto de consumo**: define para as Tarefas, herda dos ancestrais, e nunca é herdada por ninguém (Tarefa não define configuração — B25). A resolução percorre o caminho da Lista ao Espaço.

| Aspecto | Semântica (B25) | Resolução na Lista | Ao mudar o efetivo |
| --- | --- | --- | --- |
| Conjunto de Status | **substitui** | O próprio se `sobrescrito`; senão o do ancestral mais próximo `sobrescrito`; senão o do Espaço. | Mapeamento obrigatório (RN-LIS-06). |
| Definições de Campo | **acumula** | União de todas as Definições do caminho + próprias. Nomes únicos (RN-LIS-08). | Definição que deixa de ser efetiva por movimentação: Valores `arquivado` no agregado (B37). |
| Automações | **acumula** | Todas as de escopo Espaço de Trabalho, Espaço, Pasta, Subpasta e Lista disparam sobre as Tarefas da Lista. | Nada a mapear: Automações são independentes. |
| Tipos de Tarefa | **acumula** (B25) | União de todos os Tipos do caminho + próprios; o Tipo padrão da plataforma sempre presente. | Tipo em uso que deixa de ser efetivo: remapeamento (RN-LIS-20) ou, na movimentação, Tipo padrão (B40). |
| Funcionalidades habilitadas | substitui | Idem. | Sem destruição de dados (RN-LIS-21). |
| Visualização padrão | substitui | A da Lista, se marcada; senão a do ancestral mais próximo; senão a da plataforma. | Nenhum efeito sobre Tarefas. |
| Permissões | herança | União das origens (documento 01, 17.1); interrompida se privada. | Recalculada ao mover; concessões diretas preservadas. |

**Resolvido pelo caminho, não fixado (DO-LIS-04).** O Conjunto de Status efetivo é atributo derivado, recalculado a partir do caminho a cada consulta, e não uma cópia gravada na Lista. Justificativa: fixar uma cópia criaria dois lugares de verdade (a cópia e o ancestral), e "alterar o Conjunto do Espaço" deixaria de valer para as Listas que já existem, o que contradiz B25. A consequência é o invariante INV-LIS-04: como o efetivo pode mudar por ato em um ancestral, **toda** mudança de Conjunto — em qualquer nível — só é válida com mapeamento aplicado, no mesmo ato, a todas as Listas que herdam daquele nível (RN-LIS-06).

**Modo `bloqueado`.** Quando um ancestral bloqueia um aspecto, a Lista o herda obrigatoriamente e a operação de sobrescrever é inválida (RN-LIS-07). Se a Lista já tinha sobrescrita quando o ancestral tenta bloquear, o ato de bloquear é **rejeitado** com a lista das Listas sobrescritas; o ator reverte cada uma a `herdado` explicitamente (com mapeamento, RN-LIS-06) e então bloqueia (B25). Mover a Lista com sobrescrita para sob um ancestral que bloqueia o aspecto é igualmente rejeitado. Para os aspectos que **acumulam** (Definições de Campo, Tipos de Tarefa, Automações), o bloqueio de um ancestral impede a Lista de criar definições novas; as próprias já existentes permanecem (B25).

## 17. Permissões e visibilidade

### 17.1 A Lista como Recurso

| Ação | Sobre a Lista significa | Escopo `registro` | Escopo `subárvore` |
| --- | --- | --- | --- |
| ver | Ver que a Lista existe, seus atributos e configuração efetiva. | Só a Lista (aparece na árvore; Tarefas não). | A Lista e todas as suas Tarefas e Subtarefas. |
| comentar | — (a Lista não recebe Comentários, seção 21). | — | Comentar nas Tarefas. |
| criar | Criar Tarefas na Lista; instanciar Templates de Tarefa nela; receber Tarefas movidas. | Igual (criar é sobre o conteúdo). | Idem, incluindo Subtarefas. |
| editar | Alterar Nome, Descrição, Cor, Período planejado. | Só a Lista. | Também editar Tarefas. |
| excluir | Enviar à lixeira e restaurar a Lista. | Só a Lista (com cascata obrigatória sobre Tarefas). | Também excluir e restaurar Tarefas individualmente. |
| administrar | Configurar herança, Definições, Visualizações da Lista, Privada; mover; arquivar e desarquivar; eliminar antecipadamente; conceder e compartilhar. | Só a Lista. | Também sobre Tarefas (conceder permissões em Tarefa específica). |
| executar | Não se aplica à Lista. Automações com escopo Lista exigem `executar` na Automação, além das permissões sobre as Tarefas afetadas. | — | — |

### 17.2 Origens e herança

A permissão efetiva sobre a Lista é a união das origens aplicáveis (documento 01, 17.1): Papel no Espaço de Trabalho, concessão direta na Lista, herança do contêiner pai (que por sua vez acumulou as suas), compartilhamento. **Lista privada** remove Papel e herança: só concessão direta e compartilhamento contam, inclusive para Administradores e para o Proprietário do Espaço de Trabalho, que entram apenas por ato de governança registrado (A9.2; RN-LIS-12; B38). Uma Lista dentro de Pasta privada não é automaticamente privada, mas herda a ausência: quem não vê a Pasta não chega à Lista por herança; pode chegar por concessão direta na Lista, caso em que vê a Lista, sua subárvore e os nomes dos ancestrais, nunca o conteúdo da Pasta nem as Listas irmãs.

Permissão em escopo `subárvore` em um ancestral alcança a Lista e as suas Tarefas. Permissão em escopo `próprios` no Espaço alcança, na Lista, apenas as Tarefas em que o Sujeito é Responsável ou Criador (B29).

### 17.3 Convidado com acesso a uma Lista específica

O Papel Convidado não dá nada por origem `papel` (documento 01, 17.2). Compartilhar a Lista com um Convidado, em escopo `subárvore` e ação `ver` (ou mais), é o que lhe dá acesso: vê a Lista, as suas Tarefas e Subtarefas, os Valores de Campo (e, para lê-los, as Definições efetivas, inclusive as definidas em ancestrais que ele não vê), o Conjunto de Status efetivo e os nomes dos ancestrais, para navegação (B38). Não vê o conteúdo do pai, as Listas irmãs, o Espaço, os Membros, a Caixa de Entrada. Tarefas vinculadas em outras Listas aparecem como referência opaca (existe um Vínculo) sem conteúdo. Widgets de Painel cuja Fonte de Dados é essa Lista mostram dados para ele; os demais ficam vazios (B20; documento 01, 20.5).

### 17.4 IA sujeita às mesmas regras

Agentes recebem permissão sobre a Lista por concessão direta ou compartilhamento com Sujeito Agente. Em nome de um Membro, a permissão efetiva é a interseção (A9.3). Uma Automação com escopo Lista age com as suas permissões próprias, limitadas pelo teto do Proprietário (B88; documento 01, 17.1) e, quando invoca Agente, com as deste, tendo a Automação como delegante (DO-AUT-15). Nenhum deles enxerga Tarefas de outra Lista sem permissão sobre aquela Lista (RN-LIS-23). Um Agente com `criar` só nesta Lista pode criar Tarefas aqui e nada mais.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Lista criada | 12.1 | identificador, pai, Criador, Proveniência (se de Template) | Auditoria; Automações (Gatilho em ancestrais); Painéis |
| Lista alterada | Nome, Descrição, Cor, Período planejado | atributo, antes, depois, ator | Auditoria |
| Lista reordenada | Ordem entre irmãs | antes, depois, ator | Apresentação; auditoria |
| Lista movida | 12.5 | pai de origem, pai de destino, mapeamento aplicado, ator | Auditoria; Automações (escopo recalculado); Painéis; Agentes (Contexto) |
| Conjunto de Status sobrescrito / herança restaurada | Mudança de modo | Conjunto anterior, novo, mapeamento, ator | Auditoria; Tarefas (status remapeado); Automações por status; Painéis |
| Mapeamento de status aplicado | RN-LIS-06 | por Tarefa: Definição anterior, nova, categoria anterior, nova | Automações (Tarefa concluída / reaberta); Painéis; Registros de Atividade por Tarefa |
| Definição de Campo criada / alterada / removida na Lista | 7.2 | Definição, Tipo de Campo, ator; na remoção, quantidade de Valores afetados | Auditoria; Tarefas; Painéis (Dimensões); Agentes |
| Tipo de Tarefa habilitado / desabilitado; Funcionalidade habilitada / desabilitada | 7.4 | aspecto, antes, depois, remapeamento (Tipos), ator | Auditoria; apresentação; Agentes |
| Visualização da Lista criada / alterada / removida / marcada padrão | 7.3 | Visualização, ator | Auditoria |
| Lista marcada privada / não privada | RN-LIS-12 | ator, concessão criada | Auditoria; reavaliação de permissões (B23) |
| Permissão concedida / revogada / compartilhada sobre a Lista | 7.5 | Sujeito, Ação, Escopo, ator | Auditoria; Execuções em curso (B23); Painéis |
| Lista arquivada / restaurada | 12.2 | Tarefas afetadas (estado efetivo), Registros de Tempo encerrados, ator | Auditoria; Automações (suspender / retomar); Painéis; notificação a Responsáveis |
| Lista enviada à lixeira / restaurada | 12.2 | Tarefas afetadas, previsão de eliminação, ator; na restauração, Estado próprio anterior à exclusão | Auditoria; Automações (inoperantes / retomar); Painéis; Vínculos (lado inacessível) |
| Lista eliminada | 12.4 | identificador, quantidade eliminada, Automações eliminadas, momento | Auditoria; Automações (eliminadas com o escopo, B41); Widgets (Fonte inválida) |
| Tarefa adicionada à Lista | Criação ou entrada por mover | Tarefa, Lista de origem (se movida), ator | Automações com escopo Lista; Painéis; Limites (RN-LIS-18) |
| Tarefa retirada da Lista | Saída por mover | Tarefa, Lista de destino, ator | Automações; Painéis |
| Limite de Tarefas atingido | RN-LIS-18 | Lista, limite, ator que tentou | Notificação; plataforma |
| Template criado a partir da Lista / Lista instanciada de Template | RN-LIS-17 | Template, Lista, Tarefas criadas, ator | Auditoria; Proveniência |

Todos geram Registro de Atividade com a Lista como objeto (ou a Tarefa, nos eventos por Tarefa) e o Ator, com ator delegante quando aplicável (A6.2).

## 19. Dependências

**A Lista depende de:**

- **Espaço de Trabalho** e, transitivamente, **Espaço** (topo da herança) e o **contêiner pai**. Nenhum pode faltar.
- **Um Conjunto de Status definido no Espaço**: INV-LIS-03 pressupõe que todo Espaço tenha Conjunto de Status (com padrão da plataforma na criação — documento 01, seção 16). Dependência do documento de Espaço.
- **Tipos de Campo** (global, A1.3) para Definições próprias; **catálogo de Funcionalidades** (plataforma); **catálogo de Tipos de Tarefa** (Espaço; C6).
- **Política de lixeira e Limites impostos** do Espaço de Trabalho (B34).

**Dependem da Lista** (contenção): Tarefas e Subtarefas com os seus agregados; Conjunto de Status próprio; Definições de Campo próprias; Tipos de Tarefa próprios; Visualizações da Lista; concessões sobre a Lista. Dependem por escopo: Automações com escopo Lista (eliminadas com ela, B41).

**Relacionam-se sem depender** (associação): Widgets, Agentes com permissão sobre ela, Templates de origem ou destino, Visualizações pessoais.

**Documentos que este documento pressupõe ou condiciona:** Espaço (02), Pasta (03) e Subpasta (04) fornecem os pais e os modos de herança e bloqueio; Tarefa (06) recebe RN-LIS-03, RN-LIS-10, RN-LIS-13 (destino dos Registros de Tempo) e INV-LIS-04/07/08; Status (documento de Conjunto de Status) recebe o mecanismo de mapeamento; Automações recebe RN-LIS-09 e DO-LIS-13; Painéis recebe a Lista como Fonte de Dados e a semântica de Lista `arquivado`; Agentes recebe RN-LIS-23; Templates (na entidade que os documentar) recebe RN-LIS-17.

## 20. Casos limítrofes e ambiguidades

### 20.1 Lista "Backlog" diretamente no Espaço e outra "Backlog" em Pasta do mesmo Espaço

Válido (DO-LIS-06): os pais são distintos, logo não são irmãs. Os caminhos "Vendas › Backlog" e "Vendas › Campanha Q4 › Backlog" são únicos. Ambiguidade só existe para quem referencia por nome sem caminho — Agentes e Automações devem referenciar por identificador. Duas "Backlog" diretamente no mesmo Espaço, ou na mesma Pasta, são inválidas (RN-LIS-19). Uma "Backlog" `na lixeira` não bloqueia o nome; ao restaurá-la com colisão, a restauração exige renomear.

### 20.2 Mover Lista de Subpasta para o Espaço

O caminho encurta de três ancestrais para um. Se a Pasta ou a Subpasta sobrescrevia o Conjunto de Status e a Lista herdava, o efetivo passa a ser o do Espaço: mapeamento obrigatório por categoria (RN-LIS-06). Definições de Campo da Pasta e da Subpasta deixam de ser efetivas: os Valores correspondentes passam a `arquivado` no agregado das Tarefas (RN-LIS-10b; B37), reativáveis se a Lista voltar. Definições próprias da Lista viajam; não há colisão possível, porque o Espaço já era ancestral e INV-LIS-06 já valia — colisão só surge ao mover para um caminho com ancestrais novos (20.3). Automações da Pasta e da Subpasta deixam de disparar sobre a Lista; as da Lista continuam. Permissões herdadas da Pasta desaparecem; concessões diretas na Lista permanecem.

### 20.3 Mover Lista para outro Espaço com Conjunto de Status incompatível

Permitido dentro do Espaço de Trabalho (RN-LIS-11; B40). "Incompatível" significa que Definições de Status em uso não têm correspondente nominal no destino: o Ator mapeia cada uma para uma Definição de **mesma categoria** do Conjunto efetivo de destino (por exemplo, "Em revisão" → "Em andamento"); a categoria de uma Tarefa nunca muda sem ato explícito de mudança de status (INV-TAR-13). Se o destino não tem Definição na categoria em uso (ex.: sem `concluído`, só `fechado`), o Ator escolhe entre as terminais. Se a Lista tem Conjunto próprio (`sobrescrito`) e o destino não bloqueia, ela leva o seu Conjunto e nada é remapeado. Se o destino bloqueia, a movimentação é **rejeitada** até que o Ator reverta a sobrescrita (com mapeamento) na origem (B25). Definições de Campo do Espaço de origem deixam de ser efetivas (Valores `arquivado`, B37); as do Espaço de destino passam a valer, vazias. Colisão entre Definições próprias da Lista e as do novo Espaço bloqueia a operação até renomear (RN-LIS-08); colisão de nome da Lista com irmã no destino idem (B39).

### 20.4 Lista tentando sobrescrever Conjunto de Status quando a Pasta bloqueou

Inválido (RN-LIS-07). A operação é rejeitada com a indicação de qual ancestral bloqueou. O caminho legítimo é desbloquear na Pasta (por quem tem `administrar` nela) ou mover a Lista para fora do bloqueio (o que exige mapeamento, 20.2/20.3). Um Agente com `administrar` só na Lista não contorna o bloqueio: a permissão sobre a Lista não inclui alterar a Pasta.

### 20.5 Definição de Campo criada na Lista com o mesmo nome de uma Definição do Espaço

Inválido (DO-LIS-05). Justificativa: com dois campos "Cliente" efetivos na mesma Tarefa — um do Espaço, outro da Lista — Automações, Painéis, Agentes e a própria apresentação não teriam como escolher; a alternativa de "a mais próxima vence" faria o campo do Espaço desaparecer silenciosamente das Tarefas dessa Lista, quebrando Painéis do Espaço. A colisão é bloqueada nos dois sentidos: criar no Espaço um "Cliente" quando alguma Lista descendente já o tem é igualmente inválido. O que a organização quer nesse cenário costuma ser o campo do Espaço, já efetivo; se quiser um campo diferente, dá-lhe outro nome.

### 20.6 Lista arquivada com Tarefas em andamento, com Responsáveis e Registros de Tempo abertos

Arquivar é permitido: a ontologia não condiciona o arquivamento ao conteúdo (RN-LIS-04). Efeitos (DO-LIS-09 / B36): as Tarefas passam a estado efetivo `arquivado` (estado próprio inalterado) mantendo status atual (continuam "em andamento" no sentido do status) e Responsáveis; os Registros de Tempo em andamento são encerrados no ato, com o Ator que arquivou como ator e o Membro do registro como objeto, porque uma Tarefa efetivamente `arquivado` não recebe trabalho e um cronômetro aberto sobre ela seria tempo atribuído a nada; os Responsáveis são notificados (evento "Lista arquivada" lista as Tarefas afetadas). Ao restaurar, os Registros de Tempo não são reabertos: reiniciar é ato do Membro. Recomendação de produto, fora da ontologia: exigir confirmação quando houver Registros de Tempo abertos. O documento de Tarefa confirma este tratamento (RN-TAR-22).

### 20.7 Tarefa com Subtarefas sendo movida para outra Lista

As Subtarefas acompanham a raiz (B1; RN-LIS-10c): não existe Subtarefa em Lista diferente da raiz (INV-LIS-05). Cada Subtarefa tem o próprio status remapeado e os próprios Valores tratados, com Registro de Atividade próprio. Mover uma Subtarefa isoladamente para outra Lista não é "mover": é primeiro desvinculá-la do pai (ela vira Tarefa raiz na mesma Lista) e depois movê-la — dois atos, definidos no documento de Tarefa.

### 20.8 Automação com escopo nesta Lista criando Tarefa em outra Lista

Válido (DO-LIS-13): o escopo delimita o Gatilho, não a Ação. A Tarefa criada na Lista de destino recebe status inicial do Conjunto efetivo de lá, Tipo efetivo de lá e apenas as Definições de Campo efetivas de lá; a Ação que tentar preencher um campo inexistente no destino falha nesse passo e a Execução registra a falha (B18). A criação exige `criar` na Lista de destino pela própria Automação, dentro do teto do Proprietário (B88): uma Automação cujo Proprietário não tem `criar` na Lista de destino não consegue criar ali, ainda que tenha concessão própria. A Tarefa criada dispara as Automações da Lista de destino (evento "Tarefa adicionada"), o que permite ciclos; prevenção de ciclos é regra do documento de Automações.

### 20.9 Agente com permissão só nesta Lista tentando ler Tarefa vinculada de outra Lista

A Ferramenta "ler Tarefa" falha por falta de permissão (RN-LIS-23; A6.3). O Agente vê que existe um Vínculo e o identificador do outro lado (metadado do Vínculo, que pertence a ambos os registros), mas não o conteúdo. Se o Agente age em nome de um Membro que tem permissão na outra Lista, a interseção continua vazia (A9.3): o que limita é o Agente. A Execução registra a falha e prossegue ou passa a `falhou`, conforme a Habilidade (B23). Não há atalho "seguir Vínculo": Vínculo relaciona, não concede.

### 20.10 Template de Lista com Tarefas pré-criadas

As Tarefas do Template são descrições (nome, Tipo, campos, Checklists, ordem, deslocamentos de data relativos), não Tarefas. Instanciar cria Tarefas novas, com identificadores novos, Criador igual ao Ator que instanciou, status inicial válido no Conjunto efetivo da nova Lista (não o do Template: o Template pode ter sido criado em Espaço com outro Conjunto — se o Template carrega Conjunto próprio e a Lista nova o adota, aplica-se ele; senão, mapeia-se pelo nome ou pela categoria, conforme documento de Templates), Proveniência para o Template. Nenhuma alteração posterior no Template alcança a Lista instanciada; nenhuma alteração na Lista alcança o Template (A8). Instanciar um Template que descreve mais Tarefas do que o Limite imposto permite falha por RN-LIS-18 antes de criar qualquer uma.

### 20.11 Lista vazia

Válida (RN-LIS-04). Uma Lista recém-criada, uma Lista cujas Tarefas foram todas movidas, ou uma Lista que existe como "caixa de entrada de pedidos" ainda sem pedidos. Painéis mostram zero; Automações com Gatilho em Tarefas não disparam; Agentes com acesso a ela veem uma Lista sem trabalho. Nada disso é anômalo.

### 20.12 Lista só com Tarefas concluídas

Condição derivada, não estado (seção 11). A Lista permanece `ativo`; Automações com Gatilho "todas as Tarefas da Lista concluídas" podem reagir (por exemplo, arquivando-a — o que é um ato distinto, com Ator Automação). Sem Automação, a Lista fica `ativo` indefinidamente, o que é correto: "sprint fechada" é decisão de gestão, não consequência aritmética.

### 20.13 Limite de Tarefas por Lista

Não há máximo ontológico (0..N). O máximo operacional é Limite imposto (B34), verificado no ato (RN-LIS-18). Atingi-lo bloqueia criar ou mover Tarefas para a Lista e gera evento; não impede arquivar, mover a Lista, editar Tarefas existentes nem concluí-las. Subtarefas contam ou não para o limite conforme a definição do Limite (plataforma; C8).

### 20.14 Conjunto de Status resolvido pelo caminho: alteração no Espaço com cem Listas herdando

Uma alteração no Conjunto do Espaço afeta simultaneamente todas as Listas que herdam dele (não as sobrescritas). O ato só é válido com um mapeamento que cubra todas as Definições em uso em todas essas Listas (RN-LIS-06); é um único mapeamento (Definição antiga → nova), aplicado a todas, gerando Registro de Atividade por Tarefa afetada. A alternativa — fixar o Conjunto em cada Lista na criação — evitaria o mapeamento em massa ao custo de tornar o Espaço incapaz de governar o fluxo das suas Listas, o que contradiz B25 (DO-LIS-04).

### 20.15 Lista privada dentro de Pasta compartilhada com Convidado

O compartilhamento da Pasta em escopo `subárvore` daria, por herança, acesso à Lista; a Lista privada interrompe a herança (RN-LIS-12), logo o Convidado não a vê, embora veja as irmãs. Para vê-la, precisa de concessão direta na própria Lista. O inverso — Lista não privada em Pasta privada — não dá acesso por herança a quem não vê a Pasta; a Lista é alcançável apenas por concessão direta nela, que expõe os nomes do caminho e nada mais dos ancestrais (17.2; B38).

## 21. O que explicitamente NÃO pertence a esta entidade

Resultado do teste de exclusão: o que parece da Lista, mas pertence a outra entidade.

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Checklists, Comentários, Registros de Tempo, Valores de Campo, Anexos, Regra de Recorrência, Dependências das Tarefas | Tarefa | Agregado da Tarefa; a Lista só contém a raiz. |
| Status atual de cada Tarefa | Tarefa | A Lista fornece o Conjunto; o status atual é atributo da Tarefa (A4.2). |
| Conjunto de Status herdado, Definições de Campo herdadas, Tipos e Funcionalidades herdados | Espaço, Pasta ou Subpasta que os definiu | A Lista os consome; só possui o que define (B25). |
| Categorias de status | Plataforma | A4.3. |
| Automações "da Lista" | Espaço de Trabalho | Pertencem ao ET com Proprietário próprio; a Lista é escopo (documento 01, seção 8). |
| Painel, Widget, Fonte de Dados que aponta para a Lista | Painel | Referência; a Lista não sabe quem a mede. |
| O Agente que tem permissão sobre a Lista, o seu Papel e as suas Execuções | Domínio IA | A Lista guarda só a concessão (o Recurso); o Sujeito é da IA. |
| Visualizações pessoais sobre a Lista | Membro | A8. |
| Tags aplicadas às Tarefas | Espaço de Trabalho (definição); Tarefa (aplicação) | B5. A Lista não define nem recebe Tags. |
| Comentários sobre a Lista | Não existem nesta versão | A8 lista os alvos de Comentário e a Lista não está entre eles (DO-LIS-16; C16). |
| Template de Lista | Espaço de Trabalho | Catálogo do ET (documento 01, 7.6); a Lista referencia por Proveniência. |
| Registros de Atividade sobre a Lista | Espaço de Trabalho | INV-ET-12; sobrevivem à Lista. |
| Arquivos anexados a Tarefas da Lista | Espaço de Trabalho | A8; Anexo é a referência, na Tarefa. |
| Vínculos de Tarefas da Lista com Negócios, Contatos, Conversas | Os dois registros vinculados | A Lista nunca é lado de Vínculo. |
| Prioridade, Responsável, datas de vencimento | Tarefa | Atributos de trabalho; a Lista tem só Período planejado descritivo. |
| Limite de Tarefas por Lista | Limites impostos do Espaço de Trabalho | B34; RN-LIS-18. |
| Ordem manual das Tarefas dentro da Lista | Visualização (recomendação; seção 25) | A ordem depende de agrupamento e ordenação, que são da Visualização. |
| Profundidade máxima de Subtarefas | Espaço de Trabalho | B1; documento 01. |

## 22. Exemplos conceituais

**Exemplo 1 — Lista direta no Espaço.** O Espaço "Marketing" tem Conjunto de Status {A fazer, Fazendo, Feito} e a Definição de Campo "Canal" (seleção única). A Lista "Ideias" é criada diretamente no Espaço, em modo `herdado` para tudo. Suas Tarefas usam {A fazer, Fazendo, Feito} e têm o campo "Canal". A Administradora Maria cria na Lista a Definição "Custo estimado" (moeda): efetiva só em "Ideias". Tenta criar "canal" (minúsculo) na Lista: rejeitado (RN-LIS-08). O caminho de herança tem um ancestral.

**Exemplo 2 — Lista em Subpasta com sobrescrita.** No Espaço "Obras", a Pasta "Residencial" bloqueia o Conjunto de Status {Planejado, Executando, Vistoria, Entregue}. A Subpasta "Casa 12" contém a Lista "Elétrica". Pedro, com `administrar` em "Elétrica", tenta sobrescrever o Conjunto: rejeitado, com indicação de que "Residencial" bloqueou (20.4). Cria a Definição "Circuito" na Lista e a Visualização "Por cômodo" (quadro agrupado por "Cômodo", campo da Subpasta). O caminho tem três ancestrais; as capacidades da Lista são as mesmas do Exemplo 1.

**Exemplo 3 — Mover com mapeamento.** A Lista "Elétrica" é movida para o Espaço "Manutenção", cujo Conjunto é {Aberto, Em atendimento, Fechado}. Pedro mapeia Planejado → Aberto, Executando → Em atendimento, Vistoria → Em atendimento, Entregue → Fechado (o destino não tem Definição de categoria `concluído`; Pedro escolhe a terminal disponível). As 14 Tarefas "Entregue" (categoria `concluído`) passam a "Fechado" (categoria `fechado`): 14 Registros de Atividade, sem evento de reabertura (não houve saída de categoria terminal para não terminal). Os Valores de "Cômodo" (Definição da Subpasta "Casa 12") passam a `arquivado` nas Tarefas (B37); "Circuito" viaja com a Lista. A Automação "ao entrar em Vistoria, notificar engenheiro", de escopo na Pasta "Residencial", deixa de alcançar a Lista.

**Exemplo 4 — Convidado e Agente.** A contadora externa Ana (Convidado) recebe compartilhamento `ver` + `comentar` em escopo `subárvore` na Lista "Notas fiscais". Vê 40 Tarefas e o campo "Fornecedor" (definido no Espaço "Financeiro", que ela não vê). Uma Tarefa tem Vínculo com o Negócio "Contrato Alfa": Ana vê que há um Vínculo, não vê o Negócio. O Agente "Conferente", com `ver` e `editar` só nessa Lista, executa por Automação toda noite: lê as Tarefas, preenche "Conferido em" e tenta ler a Tarefa vinculada "Aprovar pagamento", na Lista "Tesouraria": a Ferramenta falha, a Execução registra a falha e prossegue (20.9).

**Exemplo 5 — Template e arquivamento.** O Template "Onboarding de cliente" descreve 12 Tarefas. Instanciá-lo na Pasta "Clientes 2026" cria a Lista "Onboarding — Beta" com 12 Tarefas novas em "A fazer", Criador = Maria, Proveniência = Template. Três meses depois, com 11 Tarefas "Feito" e uma "Fazendo" com cronômetro aberto de João, Maria arquiva a Lista: as 12 Tarefas passam a estado efetivo `arquivado` (estado próprio `ativo` inalterado), o Registro de Tempo de João é encerrado no ato e ele é notificado; a Tarefa "Fazendo" mantém esse status. Ao restaurar a Lista, as 12 voltam a efetivo `ativo`; o cronômetro não.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
└── Espaço (0..N)  [define Conjunto de Status: sempre 1]
    ├── Lista (0..N)  ───────────────── caminho: 1 ancestral
    ├── Pasta (0..N)
    │   ├── Lista (0..N)  ───────────── caminho: 2 ancestrais
    │   └── Subpasta (0..N)
    │       └── Lista (0..N)  ───────── caminho: 3 ancestrais (máximo)
    │
    └── ... qualquer Lista acima:

LISTA  [pai: 1; estado próprio: ativo | arquivado | na lixeira; estado efetivo derivado; privada; sem Status, Prioridade ou Proprietário]
│
├── Contenção estrutural
│   └── Tarefa raiz (0..N)  [status atual ∈ Conjunto efetivo; Tipo ∈ Tipos efetivos]
│       └── Subtarefa (0..N, até a profundidade do ET)  [mesma Lista — B1]
│
├── Componentes (configuração com identidade; existem só se a Lista define)
│   ├── Conjunto de Status próprio (0..1)  [só em modo sobrescrito]
│   ├── Definição de Campo própria (0..N)  [nome único no caminho efetivo]
│   ├── Tipo de Tarefa próprio (0..N)  [acumula]
│   ├── Visualização da Lista (0..N)  [0..1 padrão]
│   ├── Funcionalidades habilitadas (objeto de valor, se sobrescritas)
│   └── Concessão direta / compartilhamento (0..N)  [Recurso = Lista]
│
├── Derivados (resolvidos pelo caminho — nunca gravados como cópia)
│   ├── Conjunto de Status efetivo (1)      ← substitui
│   ├── Definições de Campo efetivas (0..N) ← acumula
│   ├── Tipos de Tarefa efetivos (1..N)     ← acumula
│   ├── Funcionalidades / Visualização padrão efetivas ← substitui
│   ├── Estado efetivo                     ← max(próprio, efetivo do pai)
│   └── Permissões efetivas               ← herança (interrompida se privada)
│
└── Associações (sobrevivem à Lista, salvo Automação de escopo)
    ├── Automação (0..N) ── escopo = Lista   [pertence ao ET; delimita Gatilho; eliminada com a Lista — B41]
    ├── Widget de Painel (0..N) ── Fonte de Dados = Lista
    ├── Agente (0..N) ── permissão sobre a Lista
    ├── Template (0..1 origem; 0..N derivados) ── proveniência
    └── Visualização pessoal (0..N) ── pertence ao Membro

Lista nunca é lado de Vínculo; Vínculos ligam Tarefas a Negócios, Contatos, Conversas.
```

## 24. Decisões ontológicas

- **DO-LIS-01.** A Lista é o único contêiner de Tarefas e a folha da hierarquia de contêineres; tem exatamente um pai (Espaço, Pasta ou Subpasta) e nunca contém contêineres. Uma Lista diretamente no Espaço difere de uma Lista em Subpasta apenas pelo comprimento do caminho de herança. Aplica A2.1, A3.1, A3.2. CONSOLIDADA.
- **DO-LIS-02 / B45.** A Lista não tem Status personalizável nem Prioridade: tem apenas estado de ciclo de vida (`ativo`, `arquivado`, `na lixeira`) e atributos descritivos (Nome, Descrição, Cor, Ordem, Período planejado). Justificativa: um segundo "status" no contêiner colide com A4.2 e torna ambígua a pergunta "qual o status?" para Automações, Painéis e IA; Prioridade é atributo de Tarefa (Glossário) e no contêiner não teria efeito nem herança. Diverge do ClickUp deliberadamente. RECOMENDADA.
- **DO-LIS-03 / B45.** A Lista não tem Proprietário nem Responsável; tem Criador. Governança por Papel (Administrador) e permissão `administrar`. Não há sucessão de Listas (B28 só transfere propriedades). Aplica A7; consolidada em B45.
- **DO-LIS-04 / B45.** O Conjunto de Status efetivo é derivado, resolvido pelo caminho a cada consulta, nunca fixado na Lista. Invariante: toda Tarefa tem status atual válido no Conjunto efetivo da sua Lista (INV-LIS-04). Consequência: qualquer alteração de Conjunto, em qualquer nível, exige mapeamento atômico de todas as Definições em uso em todas as Listas afetadas (RN-LIS-06). Justificativa: cópia fixada criaria duas verdades e retiraria do Espaço a capacidade de governar o fluxo (B25). RECOMENDADA.
- **DO-LIS-05 / B44.** O nome de Definição de Campo Personalizado é único, sem distinção de maiúsculas, no caminho efetivo; a colisão é proibida nos dois sentidos (Lista contra ancestral; ancestral contra descendente). Justificativa: dois campos homônimos efetivos na mesma Tarefa são indistinguíveis para Automações, Painéis e Agentes; "o mais próximo vence" esconderia silenciosamente o campo do ancestral. RECOMENDADA.
- **DO-LIS-06 / B39.** O nome da Lista é único entre irmãs `ativo` e `arquivado` do mesmo pai, sem distinção de maiúsculas; repete-se livremente entre pais distintos. Justificativa: caminho estrutural único e legível, sem unicidade organizacional. Consolidada em B39 (vale para todos os níveis).
- **DO-LIS-07 / B40.** Mover Tarefa entre Listas mapeia o status por categoria para o Conjunto efetivo de destino, preserva Valores de Definições que permanecem efetivas e **arquiva no agregado** os demais (B37 — substitui a versão anterior, "removidos com registro"); Subtarefas acompanham; Vínculos, Dependências, Comentários, Registros de Tempo, Anexos e Tags são preservados. Aplica A5.4, B1, B4. Consolidada em B40.
- **DO-LIS-08 / B40.** Mover Lista é permitido entre quaisquer contêineres efetivamente `ativo` do mesmo Espaço de Trabalho, inclusive entre Espaços; atômica; recalcula a herança com mapeamento (DO-LIS-04), arquivamento de Valores órfãos (B37) e verificação de colisão (DO-LIS-05, B39); Definições próprias, Automações com escopo, Widgets, concessões diretas, compartilhamentos e o atributo Privada acompanham a Lista; rejeitada por bloqueio no destino. Consolidada em B40.
- **DO-LIS-09 / B36.** Arquivamento é cascata por **derivação** (estado próprio e estado efetivo): restaurar um contêiner devolve a cada Tarefa o seu estado próprio, de modo que só volta a efetivo `ativo` o que estava `ativo` por si — sem gravar "origem do estado", que a versão anterior desta decisão previa e a harmonização eliminou como redundante. Ao arquivar uma Lista, Tarefas mantêm status atual e Responsáveis; Registros de Tempo em andamento são encerrados no ato em que a Tarefa deixa de ter estado efetivo `ativo`, com notificação; não são reabertos na restauração. Consolidada em B36; confirmada pelo documento de Tarefa (RN-TAR-22).
- **DO-LIS-10 / B43.** Lixeira é cascata por derivação; restaurar devolve a Lista ao Estado próprio anterior à exclusão (`ativo` ou `arquivado`) e exige pai não `na lixeira` (pai `arquivado` é aceito), ou restauração indicando novo pai (restauração e movimentação no mesmo ato); o estado próprio de uma Lista é alterável sob pai restritivo e uma Lista não `na lixeira` pode ser movida para fora dele (B36); eliminação permanente elimina tudo o que a Lista contém, inclusive Vínculos e Dependências que envolviam suas Tarefas e as Automações com escopo nela (B41); Arquivos e Registros de Atividade permanecem no Espaço de Trabalho; Widgets e Automações de outro escopo que a referenciavam permanecem inválidos. Aplica A3.3, A4.1, A8, INV-ET-12. RECOMENDADA.
- **DO-LIS-11.** O limite de Tarefas por Lista é Limite imposto (B34), verificado no ato (RN-ET-23), não regra ontológica; a Lista contém 0..N. Aplica B34; sem decisão nova.
- **DO-LIS-12.** Template de Lista descreve Tarefas; instanciar cria Lista e Tarefas como entidades novas, com Criador igual ao Ator que instanciou, status inicial válido no Conjunto efetivo de destino e Proveniência, sem vínculo vivo. Aplica A8. RECOMENDADA quanto ao status inicial (mapeamento por nome ou categoria: documento de Templates).
- **DO-LIS-13 / B41.** Automação com escopo Lista: o escopo delimita o Gatilho (eventos da Lista e das suas Tarefas), não a Ação, que pode alcançar outras Listas dentro das permissões próprias da Automação com o Proprietário como teto (B88) e das do Agente invocado (RN-AUT-25). Automações acumulam ao longo do caminho (B25); ficam inoperantes enquanto a Lista não está efetivamente `ativo` e são eliminadas com ela. Consolidada em B41.
- **DO-LIS-14 / B25.** Funcionalidades habilitadas seguem modo `substitui`; Tipos de Tarefa **acumulam** (B25 — substitui a versão anterior, que os tratava como `substitui`). Remover um Tipo próprio em uso exige remapeamento no ato; desabilitar uma Funcionalidade impede novos usos e não destrói dados existentes (princípio de RN-ET-17). Incorporada a B25.
- **DO-LIS-15 / B38.** Lista privada interrompe as origens `papel` e `herança` (A9.2; documento 01, 17.1), inclusive para Administradores e para o Proprietário do Espaço de Trabalho sem concessão; no ato, o Membro `ativo` que a torna privada (só Membro sem base Convidado o faz) recebe concessão direta `administrar` em escopo `subárvore`; quando o último Membro `ativo` com `administrar` é removido ou suspenso, a concessão passa ao Sucessor (exceção a B28); Proprietário e Administradores concedem acesso a Lista privada apenas por ato de governança registrado; o Proprietário mantém a capacidade de exportar todo o conteúdo (documento 01, 17.2). Consolidada em B38.
- **DO-LIS-16.** A Lista não recebe Comentários nem Tags nesta versão, porque A8 não a lista entre os alvos de nenhum dos dois. Aplica A8; pendência C16.
- **DO-LIS-17.** "Lista vazia", "Lista só com Tarefas concluídas" e "fora do Período planejado" são condições derivadas, não estados nem atributos; nenhuma delas altera o ciclo de vida. Encerrar o contêiner é ato distinto de concluir o trabalho. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. As decisões marcadas "/ Bnn" foram consolidadas na constituição na harmonização e na revisão da fase 2 (DO-LIS-02/03/04 em B45; DO-LIS-05 em B44; DO-LIS-10 em B43); a auditoria da fase 6 aplicou B88 (RN-LIS-09, 17.4, 20.8, DO-LIS-13) e DO-PAI-07 / RN-PAI-20 (10, 12.4, RN-LIS-15).

## 25. Questões em aberto

1. **Comentários e Tags em Lista** (C16). A8 não os prevê (DO-LIS-16). Organizações pedirão "comentar na Lista" (avisos gerais) e "etiquetar Listas" (por cliente, por trimestre). Consequência e alternativas registradas em C16.
2. **Catálogo de Tipos de Tarefa** (C6): se é definido no Espaço ou no Espaço de Trabalho. Este documento assume que o Espaço é o ponto de definição mais alto (coerente com documento 01, seção 16) e que Tipos acumulam ao longo do caminho (B25); se o catálogo for do Espaço de Trabalho, RN-LIS-20 e DO-LIS-14 não mudam.
3. **Subtarefas e o Limite de Tarefas por Lista** (C8): se contam para o limite. Sem consequência ontológica; consequência de produto.
4. **Encerramento operacional distinto de arquivamento** (C18). Times pedirão "fechar a sprint" mantendo a Lista visível e somente leitura. DO-LIS-02 e DO-LIS-17 respondem com arquivamento; "somente leitura sem arquivar" seria nova condição de sistema, registrada em C18.
5. **Tarefa em múltiplas Listas** (C3): rejeitada por B4; este documento depende dela em RN-LIS-03, INV-LIS-04/05/07/08. Reabrir C3 exige rever todos.
6. **Campos Personalizados sobre a Lista** (C13, ampliada): "cliente", "centro de custo", "contrato" da Lista. A5.2 não os prevê; a alternativa (Descrição) não é consultável por Painéis.

Resolvidas neste documento ou na harmonização, sem pendência aberta: Lista sem Status e sem Prioridade (DO-LIS-02); resolução pelo caminho (DO-LIS-04); colisão de nomes de Definição (DO-LIS-05); nomes de Lista entre irmãs (B39); Registros de Tempo no arquivamento (B36, confirmado no documento de Tarefa); limite como Limite imposto (DO-LIS-11); visibilidade de contêineres privados para Administradores e Proprietário do Espaço de Trabalho — só por ato de governança registrado, com sucessão da concessão `administrar` (B38); ordem manual das Tarefas dentro da Lista — pertence à Visualização (ordenação manual salva), não à Lista nem à Tarefa, e por isso difere por Visualização.
