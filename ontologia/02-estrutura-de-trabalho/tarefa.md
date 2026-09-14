# TAREFA

> Domínio: Estrutura de Trabalho | Documento 06 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Tarefa** é a unidade de trabalho identificável da plataforma: a representação de algo que precisa ser feito, com um resultado esperado, que alguém (Membro ou Agente) pode assumir, que progride por status até um fim e cujo percurso fica registrado. É o menor registro da Estrutura de Trabalho que tem identidade própria, histórico próprio e ciclo de vida próprio.

Quatro propriedades a distinguem de qualquer outra entidade:

1. **É operacional.** Espaço, Pasta, Subpasta e Lista existem para organizar e configurar; a Tarefa existe para ser executada. Ela é o único registro da Estrutura de Trabalho sobre o qual se pergunta "quem faz", "até quando" e "em que ponto está".
2. **Tem status.** É a única entidade da ontologia que possui **status atual** (A4.2): um ponteiro para uma Definição de Status do Conjunto de Status efetivo da sua Lista. Nenhuma outra entidade progride por status personalizável; Negócio tem Etapa e situação (A4.4), Conversa tem estado de conversa (A4.5).
3. **Pertence a exatamente uma Lista** (B4, A3.2). A Lista é seu contêiner estrutural, sua fonte de configuração e sua origem de permissão. A Tarefa nunca define configuração: só consome a da Lista (B25).
4. **É raiz de um agregado.** Checklists, Itens de Checklist, Comentários, Registros de Tempo, Valores de Campo, Anexos e a Regra de Recorrência não existem fora dela. Subtarefas são Tarefas com identidade própria, mas estruturalmente dependentes da raiz (B1).

A Tarefa não é um "cartão", não é uma "linha de planilha", não é uma "mensagem para alguém fazer algo" e não é um compromisso de agenda. É o compromisso de trabalho enquanto objeto rastreável.

## 2. Propósito

A Tarefa existe para cinco fins:

1. **Tornar o trabalho endereçável.** Sem uma unidade com identidade, "o que precisa ser feito" fica disperso em Conversas, Comentários e Mensagens. A Tarefa dá ao trabalho um identificador, um lugar (a Lista) e uma trajetória (o status).
2. **Atribuir execução sem confundi-la com governança.** A Tarefa tem Responsáveis (quem executa), nunca Proprietário (A7). A governança é da Lista e dos seus contêineres. Isso permite que Agentes executem (B7) sem que a responsabilidade final deixe de ser humana.
3. **Ser o ponto de convergência entre os domínios.** Um Negócio precisa de trabalho (proposta, visita, contrato); uma Conversa gera trabalho (resolver um problema); um Documento de Conhecimento precisa de revisão. A Tarefa é o registro que o CRM, a Caixa de Entrada, a IA e o Conhecimento referenciam por Vínculo quando "alguém precisa fazer algo" (A2.2).
4. **Alimentar Painéis e IA com semântica estável.** Categorias de status (A4.3), Prioridade ordinal, datas e Responsáveis são atributos com significado fixo, o que permite que Painéis, Automações e Agentes raciocinem sobre "atrasado", "bloqueado", "concluído" sem ler nomes personalizados.
5. **Preservar o histórico da execução.** Cada Tarefa acumula Registros de Atividade, Comentários e Registros de Tempo próprios. Uma ocorrência de trabalho recorrente é uma Tarefa nova (B6) justamente para que o histórico de cada execução não seja sobrescrito.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Ator e existente até a eliminação permanente.
- **Raiz de agregado** (Glossário): responde pela consistência de Checklists, Itens, Comentários, Registros de Tempo, Valores de Campo, Anexos, Regra de Recorrência e Compartilhamento público. Subtarefas integram o agregado para efeito de cascata e de mesma Lista, mas são Tarefas: têm identidade global, Registros de Atividade e permissões próprios.
- **Filho estrutural** de uma Lista (A3.3): contenção exclusiva e obrigatória.
- **Consumidora de configuração**, nunca ponto de definição (B25). Conjunto de Status, Definições de Campo, Tipos de Tarefa, Funcionalidades habilitadas e Automações chegam a ela pela Lista.
- **Recurso de permissão por herança** (A9.2): a Tarefa é Recurso da tupla de permissão, mas a origem normal das permissões sobre ela é a herança da Lista. É unidade de **ampliação** (compartilhamento), não de **restrição** (não pode ser privada) — seção 17.
- **Objeto de Vínculos e de Dependências**: associa-se a registros de outros domínios e a outras Tarefas sem os conter e sem ser contida por eles.
- **Não é Ator.** A Tarefa nunca age. Quem age sobre ela é Membro, Agente, Automação, Integração ou Sistema (A6.1).
- **Não é Evento, não é configuração, não é Template, não é Conversa, não é Execução.**

## 4. Fronteira conceitual

### O que é

- A unidade de trabalho identificável, com status, Responsáveis, datas, Prioridade e Valores de Campo.
- O registro raiz de Comentários, Checklists, Registros de Tempo e Anexos relativos a esse trabalho.
- O único nível da Estrutura de Trabalho que é executado, não apenas organizado.
- O destino padrão de "alguém precisa fazer algo" vindo de qualquer domínio.

### O que não é

- **Não é Lista.** Lista contém Tarefas e define configuração; Tarefa é contida e consome configuração. Uma Lista vazia é válida; uma Tarefa sem Lista não existe.
- **Não é Comentário.** Comentário é manifestação sobre um registro; a descrição da Tarefa é atributo dela, não Comentário (seção 6).
- **Não é Negócio.** Negócio é oportunidade comercial com valor econômico, Funil e situação; Tarefa é trabalho. Um Negócio gera Tarefas; nunca é uma Tarefa.
- **Não é Conversa.** Conversa é episódio de comunicação com um Contato por um Canal; Tarefa é trabalho interno. Uma Conversa pode gerar Tarefas por Vínculo.
- **Não é Evento de calendário.** Tarefa com data e hora não é compromisso de agenda (D8, seção 20.16).
- **Não é Execução de Agente.** Execução é a instância de funcionamento de um Agente; uma Tarefa pode ser objeto de muitas Execuções, e uma Execução pode criar ou alterar muitas Tarefas.
- **Não é Item de Checklist.** Item é componente sem identidade externa (B2).
- **Não é Template.** Template de Tarefa é estrutura reutilizável; instanciar cria uma Tarefa nova.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Tarefa × Lista** | Unidade de trabalho; tem status, Responsáveis, datas; consome configuração; não contém Tarefas de outra raiz. | Contêiner operacional; ponto de definição de Conjunto de Status, Definições de Campo, Funcionalidades, permissões; não é executada. | Lista configura, Tarefa executa. Lista é recurso de restrição de permissão (pode ser privada); Tarefa não. |
| **Tarefa × Subtarefa** | Tarefa raiz: sem pai; determina a Lista de toda a árvore; alvo de cascata. | Tarefa com pai preenchido; mesma entidade (B1); mesma Lista da raiz; profundidade limitada; removida em cascata com o pai. | A diferença é um atributo (Tarefa pai), não uma entidade. O que muda são restrições estruturais, nunca capacidades. |
| **Tarefa × Item de Checklist** | Entidade com identidade, status, datas, Responsáveis 0..N, campos, Comentários, histórico próprio. | Componente interno: texto, ordem, concluído, Responsável 0..1, Subitens; sem status, datas, campos, Comentários ou histórico próprio (B2). | Se precisa de status, data ou Comentário, é Tarefa (ou Subtarefa). Item existe só para enumerar passos de uma Tarefa. |
| **Tarefa × Negócio** | Unidade de trabalho; status personalizável por categoria; Responsáveis 0..N; sem Proprietário; sem valor econômico nativo. | Oportunidade comercial; Etapa em Funil e situação (`aberto`, `ganho`, `perdido`); exatamente um Proprietário; valor econômico. | Negócio responde "quanto vale e em que ponto da venda está"; Tarefa responde "o que precisa ser feito e quem faz". Relacionam-se por Vínculo, nunca por contenção (A2.2). |
| **Tarefa × Conversa** | Trabalho interno; sem Contato obrigatório; sem Canal; Comentários entre Atores internos. | Episódio de interação com exatamente um Contato principal por um Canal; Mensagens; Atribuído 0..1; estado de conversa. | Conversa é comunicação com o exterior; Tarefa é execução interna. Uma Mensagem nunca é Comentário; um Comentário nunca é enviado ao Contato. |
| **Tarefa × Comentário** | Registro raiz; tem status, datas, Responsáveis. | Entidade interna do agregado; manifestação de um Ator sobre a Tarefa; autor, conteúdo, anexos, menções, respostas, resolução. | Comentário não existe fora de um registro. A descrição da Tarefa não é Comentário: é atributo editável sem autor próprio (o histórico de edição está nos Registros de Atividade). |
| **Tarefa × Template de Tarefa** | Trabalho concreto, com status atual, datas absolutas, histórico. | Estrutura reutilizável (título, descrição, Tipo, Checklists, Subtarefas, datas relativas); sem status atual, sem histórico de execução; pertence ao Espaço de Trabalho. | Instanciar cria Tarefa nova com proveniência; alterar o Template não altera Tarefas já criadas (A8). |
| **Tarefa × Execução de Agente** | O trabalho a fazer; pode ter Agente como Responsável. | Instância de funcionamento de um Agente, com Ator invocador, versão, passos e estado próprio (B18); pertence ao Agente. | Ser Responsável não é executar. A execução por Agente acontece em uma Execução, que referencia a Tarefa como objeto ou âncora. |
| **Tarefa × Evento de calendário (D8, futuro)** | Trabalho com início e vencimento opcionais, com ou sem hora; termina por status. | Compromisso com horário definido, participantes e duração; termina por decurso de tempo. | Hoje uma reunião é Tarefa com Tipo apropriado, data com hora e Vínculo a Contato (20.16). Se D8 for adotado, Evento e Tarefa relacionam-se por Vínculo. |

## 5. Identidade

A Tarefa tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo.

**Teste de identidade.** Se o título, a descrição, o status atual, todos os Responsáveis, todas as datas, todos os Valores de Campo, a Prioridade, o Tipo de Tarefa, as Tags e a Lista mudarem, e se a Tarefa passar de raiz a Subtarefa ou o inverso, continua sendo a mesma Tarefa: os Registros de Atividade, os Comentários, os Registros de Tempo, as Dependências e os Vínculos continuam apontando para ela. A identidade é a continuidade do compromisso de trabalho, não qualquer um de seus atributos.

Consequências:

- **Mover de Lista não muda a identidade** (seção 12.4). Vínculos, Dependências e Registros de Atividade permanecem.
- **Mudar de pai não muda a identidade** (B1). Uma Subtarefa desvinculada do pai torna-se Tarefa raiz com o mesmo identificador; uma Tarefa raiz vinculada a um pai torna-se Subtarefa com o mesmo identificador.
- **Mudar de status, ser concluída e reaberta não muda a identidade.** Reabrir é evento sobre a mesma Tarefa (A4.3).
- **Ocorrência de recorrência é outra identidade** (B6): cada ocorrência é uma Tarefa nova, com proveniência para a anterior.
- **Instanciar Template é outra identidade**: a Tarefa criada não é o Template.
- **Título não é identidade**: duas Tarefas podem ter o mesmo título na mesma Lista.

**Identificador legível** (DO-TAR-02, RECOMENDADA). O Espaço de Trabalho pode habilitar um identificador legível para Tarefas: número sequencial único no Espaço de Trabalho, com prefixo opcional (ex.: `OPS-1042`). É atributo derivado da criação, imutável, nunca reutilizado, e **não muda** quando a Tarefa é movida, vinculada a um pai ou restaurada. Subtarefas recebem identificador legível próprio. O identificador legível é conveniência de referência humana; o identificador opaco continua sendo a identidade. Não é definido por Espaço ou Lista porque referências cruzam a estrutura (Vínculos, Dependências, menções) e precisam ser únicas no universo de dados inteiro (A1.1).

## 6. Atributos fundamentais

### 6.1 Atributos nativos

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável (seção 5). |
| Identificador legível | derivado | condicional | Presente se habilitado no Espaço de Trabalho. Imutável. |
| Lista | referência (Lista) | sim | Contêiner estrutural. Exatamente uma (B4). Para Subtarefas, igual à da raiz (INV-TAR-03). |
| Tarefa pai | referência (Tarefa) | não | Preenchido apenas em Subtarefas (B1). Mesma Lista. |
| Tarefa raiz | derivado | condicional | Para Subtarefas, a Tarefa sem pai no topo da árvore. Derivado da cadeia de pais. |
| Posição entre irmãs | nativo | condicional | Ordem de uma Subtarefa entre as irmãs. Para Tarefas raiz, a ordem é configuração da Visualização, não atributo. |
| Título | nativo | sim | Texto curto. Não único. |
| Descrição | nativo (conteúdo rico) | não | Texto formatado com menções e Anexos embutidos. É **atributo**, não Comentário: não tem autor próprio, é editável por quem tem `editar`, e as edições geram Registro de Atividade (DO-TAR-03). |
| Status atual | referência (Definição de Status) | sim | Aponta para uma Definição do Conjunto de Status efetivo da Lista (A4.2; INV-TAR-04). Na criação, a primeira Definição de categoria `não iniciado` do Conjunto, salvo indicação. |
| Categoria de status | derivado | sim | Categoria da Definição apontada (A4.3). É o que Painéis, Automações e IA leem. |
| Tipo de Tarefa | referência (Tipo de Tarefa) | sim | Um dos Tipos disponíveis na Lista (herdados, B25). Padrão: o Tipo "tarefa" fornecido pela plataforma. Altera apresentação, campos padrão e semântica para IA; não altera ciclo de vida (C6; DO-TAR-13). |
| Prioridade | nativo (ordinal) | sim | `urgente`, `alta`, `normal`, `baixa`, `sem prioridade` (padrão). Não personalizável nesta versão. |
| Data de início | objeto de valor (Data) | não | Ver 6.2. |
| Data de vencimento | objeto de valor (Data) | não | Ver 6.2. Início ≤ vencimento quando ambas existem (INV-TAR-07). |
| Momento de conclusão | derivado | condicional | Momento da transição mais recente de uma categoria não terminal (`não iniciado`, `em andamento`) para `concluído` ou `fechado`. Vazio quando o status atual está em categoria não terminal (reabertura o esvazia; o histórico fica nos Registros de Atividade). Passar de `concluído` a `fechado` não o altera. |
| Vencida | derivado | sim | Verdadeiro quando existe Data de vencimento já decorrida e a categoria de status não é `concluído` nem `fechado`. |
| Bloqueada | derivado | sim | Verdadeiro quando existe Dependência `é bloqueada por` cuja Tarefa de origem está `ativo` e em categoria não terminal (seção 8.3). |
| Estimativa | objeto de valor (Duração) | não | Tempo estimado para executar. Atributo, não Registro de Tempo. |
| Tempo registrado | derivado | sim | Soma das durações dos Registros de Tempo da Tarefa (sem Subtarefas). |
| Tempo registrado agregado | derivado | sim | Soma incluindo Subtarefas. |
| Progresso de Subtarefas | derivado | condicional | Proporção das Subtarefas diretas em estado efetivo `ativo` que estão em categoria `concluído` ou `fechado`; Subtarefas efetivamente `arquivado` ou `na lixeira` não contam. Vazio sem Subtarefa direta efetivamente `ativo` (DO-STA-06). |
| Progresso de Checklists | derivado | condicional | Itens contáveis concluídos ÷ Itens contáveis de todos os Checklists da Tarefa (contável = Item de primeiro nível não convertido; Subitens não contam). Vazio sem Item contável. Não agrega Checklists de Subtarefas (DO-CHK-08). |
| Regra de Recorrência | objeto de valor | não | Presente na ocorrência corrente de uma série recorrente (seção 7.6). |
| Proveniência | objeto de valor | não | Origem da criação: Template (identificador, nome à época, versão), ocorrência anterior e origem da série (recorrência), Item de Checklist convertido, ou registro de outro domínio a partir do qual foi criada. Não é referência viva. |
| Compartilhamento público | objeto de valor | não | Ver 7.7. |
| Criador | referência (Ator) | sim | Imutável (A7). Membro, Agente, Automação, Integração ou Sistema (ocorrência de recorrência, RN-TAR-25). Quando Agente age em nome de Membro, ambos constam no Registro de Atividade; o Criador é o Ator que praticou o ato. |
| Momento de criação | nativo | sim | Imutável. |
| Momento da última alteração | derivado | sim | Momento do último Registro de Atividade que alterou o agregado. |
| Estado próprio | nativo | sim | Estado de ciclo de vida gravado na Tarefa: `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). Nunca reescrito por cascata (B36). |
| Estado efetivo | derivado | sim | O mais restritivo entre o estado próprio e o estado efetivo da Lista (e, para Subtarefa, da Tarefa pai), na ordem `ativo` < `arquivado` < `na lixeira` (B36). |
| Estado próprio anterior à exclusão | nativo | condicional | `ativo` ou `arquivado`. Gravado pelo Sistema no envio à lixeira; consumido e esvaziado na restauração (12.3; DO-TAR-18). |
| Momento de arquivamento / envio à lixeira | nativo | condicional | Preenchidos enquanto o estado próprio correspondente vigorar. |
| Previsão de eliminação | derivado | condicional | Momento de envio à lixeira + prazo da Política de lixeira do Espaço de Trabalho (B34). Só para estado próprio `na lixeira`; uma Tarefa efetivamente `na lixeira` por ancestral segue a previsão do ancestral. |

### 6.2 Data como objeto de valor

Uma **Data** de Tarefa é um objeto de valor com duas formas: **dia civil** (sem hora; interpretado como o dia inteiro, sem fuso) ou **instante** (com hora; absoluto, exibido no fuso da Localidade do Espaço de Trabalho, RN-ET-15). A forma é escolhida por Data, não por Tarefa: início pode ser dia civil e vencimento pode ser instante. "Vencida" para dia civil significa o dia seguinte já iniciado no fuso da Localidade. Alterar a Localidade não reescreve Datas (RN-ET-16).

**Datas de Subtarefas versus datas do pai.** Não há propagação automática obrigatória em nenhuma direção (DO-TAR-06, RECOMENDADA): alterar o vencimento do pai não altera o das Subtarefas, e uma Subtarefa pode vencer depois do pai. Justificativa: propagação silenciosa reescreve compromissos que outra pessoa assumiu e destrói informação. A Lista pode habilitar a Funcionalidade "datas de Subtarefas contidas no pai", que passa a **validar** (rejeitar Subtarefa com vencimento posterior ao do pai), nunca a reescrever. Painéis e IA que precisem de "vencimento efetivo da árvore" o calculam como derivado (maior vencimento entre a raiz e suas descendentes).

### 6.3 Valores de Campo Personalizado

Um Valor de Campo pertence ao agregado da Tarefa e só existe se houver Definição de Campo Personalizado aplicável no caminho efetivo da Lista (A5.4; Definições acumulam ao longo de Espaço → Pasta → Subpasta → Lista, B25). Regras específicas da Tarefa:

- **Obrigatoriedade.** Uma Definição obrigatória exige Valor preenchido para que a Tarefa seja **criada** e para transições de status que a Definição declarar (recomendação: obrigatoriedade avaliada na criação e na transição para categoria `concluído` ou `fechado`; entre esses momentos, Valor vazio é tolerado para não impedir rascunhos). O documento de Campos Personalizados fixa o mecanismo; aqui se fixa que a Tarefa nunca fica em estado inválido por Valor obrigatório ausente quando a Definição passou a ser obrigatória depois da criação (a validação ocorre na próxima edição). O mesmo vale para Tarefas criadas por **derivação** — conversão de Item de Checklist, geração de ocorrência de recorrência, instanciação de Template — quando a origem não fornece o Valor: nascem com o Valor obrigatório vazio, a obrigatoriedade é avaliada na próxima edição e nas transições declaradas, e a criação derivada nunca é rejeitada por Valor obrigatório ausente (DO-TAR-20).
- **Tipo relação.** Um Valor de tipo relação referencia registros de outra entidade (Tarefas, Contatos, Negócios...). É Valor de Campo, não Vínculo: pertence à Tarefa, é unilateral, e a Definição determina o tipo-alvo. Vínculo é bidirecional e tipado pela plataforma (A8). Os dois coexistem; o produto não deve gerar um a partir do outro automaticamente.
- **Tipo pessoa** referencia Membro; não faz dele Responsável.
- **Tipo fórmula** é derivado e não é gravado como Valor editável.
- **Valores arquivados.** Quando a Tarefa passa a um caminho em cujo escopo a Definição não se aplica — por movimentação da própria Tarefa ou da sua Lista, Pasta ou Subpasta —, o Valor passa a `arquivado` dentro do agregado: preservado, não exibido, não editável, não consultável por Painéis; reativado se a Definição voltar a aplicar-se (DO-TAR-17 / B37). Isso cumpre A5.4 ("remove ou arquiva") sem destruir dados. Só a eliminação permanente da Definição elimina o Valor.

### 6.4 Configurações consumidas da Lista (não são atributos)

A Tarefa não possui, mas **consome** da sua Lista (B25): Conjunto de Status efetivo; Definições de Campo efetivas (acumuladas); Tipos de Tarefa disponíveis; Funcionalidades habilitadas (Registro de Tempo, Dependências, Estimativa, Compartilhamento público, Subtarefas, Checklists, exigir Subtarefas concluídas, exigir Checklists concluídos, datas de Subtarefas contidas, impedir conclusão de Tarefa bloqueada, entre outras que o documento de Lista definir); Automações aplicáveis (acumuladas); Visualizações padrão; permissões herdadas. Do Espaço de Trabalho consome: Profundidade máxima de Subtarefas, Localidade, Política de lixeira, Tags disponíveis, Templates.

Poder consumir uma configuração não a torna atributo nem filho da Tarefa.

## 7. Entidades internas ou componentes

Entidades internas são as que não existem fora do agregado da Tarefa. Conceitos transversais (Comentário, Anexo, Registro de Tempo) são definidos no Glossário; aqui só o que é específico da Tarefa.

### 7.1 Comentário (na Tarefa)

Manifestação de um Ator sobre a Tarefa (A8). Específico da Tarefa:

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Autor | referência (Ator) | sim | Ator (A6.1; A8): Membro, Agente ou Automação. Comentário de Agente registra o ator delegante, se houver; Comentário criado por Ação de Automação tem autor = a Automação, com delegante conforme DO-AUT-15 (B91). Integração comenta como Sistema, com o Membro configurador como delegante. Imutável. |
| Conteúdo | conteúdo rico | sim | Com menções e Anexos. |
| Anexos | referência (Arquivo) 0..N | não | Referências a Arquivos do Espaço de Trabalho. |
| Menções | referência (registro) 0..N | não | Derivadas do conteúdo. Podem apontar para Membro, Equipe, Agente, Tarefa, Contato, Empresa, Negócio, Conversa ou Documento de Conhecimento. Menção não cria Vínculo nem concede permissão (20.11). |
| Comentário pai | referência (Comentário) | não | Resposta encadeada. **Um nível**: resposta de resposta é resposta ao Comentário raiz do encadeamento. |
| Resolvido | nativo (booleano) + quem + quando | não | Só no Comentário raiz do encadeamento. Indica que o assunto foi tratado; não altera status da Tarefa. |
| Momento de criação; editado (momento) | nativo | sim / não | Edição e exclusão pelo autor ou por quem tem `administrar` sobre a Tarefa ou sobre a Lista que a contém (mesma formulação de DO-EMP-15 e DO-NEG-15; Glossário "Comentário"). Exclusão deixa marcador "Comentário excluído" que preserva o encadeamento; o fato fica no Registro de Atividade. |

Comentário **não é** Mensagem: nunca é enviado a Contato. Comentário **não é** a descrição: a descrição é atributo sem autor próprio. Comentário de Subtarefa pertence à Subtarefa, não é agregado ao pai (Visualizações podem exibir a árvore).

### 7.2 Checklist e Item de Checklist

Componente interno sem identidade externa (B2). A Tarefa tem 0..N Checklists, cada um com nome, ordem e 0..N Itens (texto, ordem, concluído, Responsável 0..1 Membro, Subitens em um nível). Decisões que o documento 08 herda: Item não tem status, datas, campos, Comentários, anexos, Dependências, Registro de Tempo, Tags ou histórico próprio; alterações de Item geram Registro de Atividade **na Tarefa**; o Responsável de Item precisa ter permissão de ver a Tarefa (mesma regra de RN-TAR-06); converter Item em Subtarefa cria Tarefa nova (com pai = a Tarefa do Checklist, título = texto do Item, Responsável = o do Item, Subitens transformados em Checklist da nova Subtarefa) e marca o Item como `convertido`, com referência ao destino (20.15); o Item convertido é terminal e não conta no progresso (DO-CHK-09). Progresso de Checklist e Progresso de Checklists da Tarefa (6.1) são derivados e não alteram status. Eventos de Checklist e de Item são eventos da Tarefa com dados do componente (DO-CHK-12; seção 18).

### 7.3 Registro de Tempo

Entidade interna: período de trabalho registrado por um **Membro** na Tarefa (Glossário). Atributos: Membro, início, fim ou duração (um dos dois, o outro derivado), descrição opcional, Criador (pode diferir do Membro: um Administrador pode registrar por outro; ator delegante registrado). Pode estar "em andamento" (início sem fim) — no máximo um por Membro em todo o Espaço de Trabalho (INV-TAR-12). Um Registro em andamento é encerrado pelo Sistema no ato em que a Tarefa deixa de ter estado efetivo `ativo` (arquivamento ou lixeira da Tarefa ou de qualquer ancestral), com o ator do arquivamento como ator delegante; não é reaberto na restauração (B36). Registro de Tempo de Subtarefa pertence à Subtarefa; "tempo agregado" é derivado. Disponível só se a Funcionalidade estiver habilitada na Lista. Agente não registra tempo: o esforço de Agente é medido pela Execução (B18; B42).

**Tempo em cada status** não é entidade nem atributo: é derivado dos Registros de Atividade de "status alterado" (A6). O mesmo vale para "tempo até conclusão" e "número de reaberturas".

### 7.4 Valor de Campo

Ver 6.3. Pertence ao agregado; existe só com Definição aplicável; pode estar `arquivado` após movimentação.

### 7.5 Anexo

Referência da Tarefa a um Arquivo do Espaço de Trabalho (A8). Um Arquivo pode ser referenciado por várias Tarefas, Comentários, Mensagens e Documentos; remover o Anexo remove a referência, nunca o Arquivo. Anexos aparecem em três lugares do agregado: na descrição (embutidos), na lista de Anexos da Tarefa e em Comentários; ontologicamente são a mesma coisa (referência a Arquivo com contexto de origem). Anexo de Subtarefa pertence à Subtarefa.

### 7.6 Regra de Recorrência

Objeto de valor (B6) presente na **ocorrência corrente** de uma série. Componentes: frequência (diária, semanal, mensal, anual, personalizada), intervalo, dias/posições, **modo de disparo** (`ao concluir`: a próxima ocorrência é gerada quando a corrente entra em categoria `concluído` ou `fechado`; `por calendário`: gerada quando a data devida chega, independentemente do status), comportamento se a corrente ainda estiver aberta no modo `por calendário` (`gerar mesmo assim` | `aguardar conclusão`), término (nunca, após N ocorrências, até uma data), e o que copiar (Checklists — padrão: sim —, Subtarefas, Responsáveis, Observadores, Valores de Campo, Anexos da descrição, Vínculos). Ver seção 12.5 e DO-TAR-14.

### 7.7 Compartilhamento público

Objeto de valor: exposição de leitura da Tarefa (e do seu agregado, inclusive Subtarefas) a quem possuir um endereço secreto, sem ser Membro. Atributos: identificador secreto, ativo, Criador, momento, escopo do que fica visível (Comentários sim/não, Anexos sim/não). Não é Permissão da tupla A9.1 (não há Sujeito), por isso é modelado à parte. Só existe se a Funcionalidade estiver habilitada na Lista; só Membro cria (nunca Agente, RN-TAR-21); só `ver`. Ver 17.4.

### 7.8 Subtarefas (membros do agregado com identidade própria)

Subtarefas são Tarefas (B1). Integram o agregado para cascata (arquivar, lixeira, restaurar, mover, eliminar) e para a regra de mesma Lista; fora disso, têm tudo o que a raiz tem. O documento 07 as detalha; as decisões que ele herda estão em DO-TAR-10.

## 8. Relações

### 8.1 Tabela de relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a Lista | Lista | contenção (pertencimento estrutural) | Lista → Tarefa | Exatamente uma (B4). Cascata da Lista. |
| tem pai | Tarefa | contenção (estrutural, dentro do agregado) | Tarefa → Tarefa | 0..1. Mesma Lista. Cascata do pai (B1). |
| tem Subtarefas | Tarefa | contenção | Tarefa → Tarefa | 0..N. Profundidade limitada pelo Espaço de Trabalho. |
| aponta para status atual | Definição de Status | referência (uso de configuração) | Tarefa → Definição | Do Conjunto efetivo da Lista. |
| é do Tipo | Tipo de Tarefa | referência (uso de configuração) | Tarefa → Tipo | Dos Tipos disponíveis na Lista. |
| tem Responsáveis | Membro ou Agente | associação | Tarefa → Ator | 0..N. Não é propriedade. Responsável precisa ver a Tarefa. |
| tem Observadores | Membro | associação | Tarefa → Membro | 0..N. Recebe notificações dos eventos da Tarefa. Distinta de Responsável. Precisa ver a Tarefa. |
| foi criada por | Ator | referência | Tarefa → Ator | Criador imutável. |
| tem Tags | Tag | associação N:N | Tarefa ↔ Tag | Tags do Espaço de Trabalho (B5), respeitada a restrição de tipo da Tag. |
| contém Comentários, Checklists, Registros de Tempo, Valores de Campo | entidades internas | contenção (agregado) | Tarefa → interna | Sem existência fora da Tarefa. |
| anexa Arquivos | Arquivo | referência | Tarefa → Arquivo | 0..N. Arquivo pertence ao Espaço de Trabalho. |
| vinculada a | Contato, Empresa, Negócio, Conversa, Documento de Conhecimento, Tarefa | associação (Vínculo tipado, bidirecional) | Tarefa ↔ registro | 0..N por tipo. Não implica propriedade (A8). Tarefa ↔ Tarefa é o tipo "relacionada a". |
| depende de / bloqueia | Tarefa | associação tipada, direcional (Dependência) | Tarefa → Tarefa | `bloqueia` / `é bloqueada por` (mesma aresta lida em duas direções) e `aguarda`. Acíclica (INV-TAR-09). |
| criada a partir de | Template de Tarefa | proveniência (objeto de valor) | Tarefa → Template | Sem vínculo vivo (A8). |
| ocorrência de | Tarefa | proveniência (objeto de valor) | Tarefa → Tarefa | Ocorrência anterior e origem da série (B6). |
| é objeto de | Execução de Agente / Automação | referência inversa | Execução → Tarefa | A Tarefa não contém Execuções; elas a referenciam. Visão derivada. |
| é âncora de | Sessão de Chat | referência inversa | Sessão → Tarefa | B21. A Tarefa não conhece Sessões. |
| é registrada em | Registro de Atividade | referência inversa | Registro → Tarefa | "Histórico" é a visão desses Registros (A6). |
| é apresentada por | Visualização | referência inversa | Visualização → Tarefa | Configuração, não relação da Tarefa. |
| exposta por | Compartilhamento público | objeto de valor | Tarefa → exposição | 0..1. |

Distinção aplicada: **CONTER** (entidades internas, Subtarefas), **pertencer** (Lista), **USAR** (Definição de Status, Tipo de Tarefa, Definições de Campo, Tags), **REFERENCIAR** (Arquivo, Ator, Template por proveniência), **RELACIONAR-SE** (Vínculos, Dependências, Responsáveis, Observadores), **HERDAR** (permissões e configuração, sempre via Lista — seção 16). A Tarefa **não CONFIGURA** nada.

### 8.2 Vínculos

Vínculo é conceito transversal (A8). Específico da Tarefa: (a) tipos permitidos nesta versão: Tarefa–Contato, Tarefa–Empresa, Tarefa–Negócio, Tarefa–Conversa, Tarefa–Documento de Conhecimento, Tarefa–Tarefa ("relacionada a", simétrica); (b) um Vínculo pode carregar um papel textual opcional ("proposta de", "acompanhamento de"); (c) todos 0..N, sem exclusividade: uma Tarefa pode estar vinculada a três Negócios e um Negócio a cem Tarefas; (d) Vínculo nunca move a Tarefa, nunca lhe dá Proprietário e nunca a coloca sob permissão do outro registro; (e) o Vínculo é visível apenas a quem vê **ambos** os lados; quem vê um só lado vê a existência de "um registro sem acesso" ou nada, conforme o produto; (f) "Tarefa relacionada a" **não é** Dependência: não bloqueia, não tem direção, não é acíclica por exigência.

### 8.3 Dependências

Relação tipada e direcional entre duas Tarefas do mesmo Espaço de Trabalho (Glossário). Tipos:

- **`bloqueia` / `é bloqueada por`**: uma única aresta A → B lida como "A bloqueia B" e "B é bloqueada por A". Efeito: B fica **Bloqueada** (derivado) enquanto A estiver `ativo` e em categoria não terminal. Bloqueio **não impede** por padrão mudanças de status em B (recomendação: aviso); a Lista pode habilitar a Funcionalidade "impedir conclusão de Tarefa bloqueada".
- **`aguarda`**: A aguarda B; informativa, sem efeito em "Bloqueada". Serve para sequenciamento fraco (linha do tempo).

Regras: permitidas entre Tarefas de Listas e Espaços diferentes do mesmo Espaço de Trabalho (INV-ET-07 proíbe cruzar Espaços de Trabalho); proibidas entre uma Tarefa e ela mesma; proibidas entre pai e descendente (a hierarquia já expressa a relação); **ciclos proibidos** no grafo formado por todas as Dependências, independentemente do tipo (INV-TAR-09). Uma Tarefa `na lixeira` ou `arquivado` não bloqueia (seu efeito é suspenso; a Dependência é preservada e volta a valer na restauração). Eliminação permanente de um lado remove a Dependência. Dependência disponível só se a Funcionalidade estiver habilitada na Lista de **ambas** as Tarefas.

### 8.4 Histórico

Não é entidade nem atributo: é a **visão** dos Registros de Atividade cujo objeto é a Tarefa ou uma entidade do seu agregado (A6.2). Inclui, para Subtarefas, os Registros da própria Subtarefa; a raiz exibe os das descendentes apenas como visão agregada opcional.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Tarefa → Lista | 1 | não | não | estrutural | B4. Zero deixaria a Tarefa sem configuração e sem permissão; várias reabre C3. |
| Lista → Tarefa | 0..N | sim | sim | estrutural | Lista vazia é válida. |
| Tarefa → Tarefa pai | 0..1 | sim | não | estrutural | Raiz não tem pai; Subtarefa tem exatamente um. |
| Tarefa → Subtarefas | 0..N | sim | sim | estrutural | Profundidade limitada (B1; ET). |
| Tarefa → Definição de Status | 1 | não | não | referência | A4.2. Tarefa sem status não tem posição no fluxo. |
| Tarefa → Tipo de Tarefa | 1 | não | não | referência | Padrão "tarefa" garante que nunca é zero (DO-TAR-13). |
| Tarefa → Responsável | 0..N | sim | sim | associativa | Zero: trabalho ainda não atribuído é comum. Vários: trabalho em par. Sem "principal" (A7). |
| Tarefa → Observador | 0..N | sim | sim | associativa | |
| Tarefa → Tag | 0..N | sim | sim | associativa (N:N) | B5. |
| Tag → Tarefa | 0..N | sim | sim | associativa | |
| Tarefa → Comentário | 0..N | sim | sim | contenção | |
| Comentário → resposta | 0..N (um nível) | sim | sim | contenção | Encadeamentos profundos fragmentam a discussão (DO-TAR-07). |
| Tarefa → Checklist | 0..N | sim | sim | contenção | |
| Checklist → Item | 0..N | sim | sim | contenção | Checklist vazio é válido (recém-criado). |
| Item → Responsável | 0..1 | sim | não | associativa | B2. Um só: Item é passo pequeno; se precisa de dois, é Subtarefa. |
| Tarefa → Registro de Tempo | 0..N | sim | sim | contenção | |
| Membro → Registro de Tempo em andamento | 0..1 | sim | não | — | Uma pessoa não trabalha em duas coisas ao mesmo tempo (INV-TAR-12). |
| Tarefa → Valor de Campo | 0..N | sim | sim | contenção | Um por Definição aplicável (INV-TAR-05). |
| Tarefa → Anexo | 0..N | sim | sim | referência | |
| Arquivo → Tarefas que o anexam | 0..N | sim | sim | referência | A8. |
| Tarefa → Vínculo (por tipo de destino) | 0..N | sim | sim | associativa | Nenhum tipo é obrigatório nem exclusivo (DO-TAR-08). |
| Tarefa → Dependência (saída e entrada) | 0..N | sim | sim | associativa | Acíclica. |
| Tarefa → Regra de Recorrência | 0..1 | sim | não | objeto de valor | Só a ocorrência corrente a carrega (DO-TAR-14). |
| Tarefa → Proveniência | 0..1 | sim | não | objeto de valor | Pode registrar mais de uma origem (Template e série), mas é um objeto composto. |
| Tarefa → Compartilhamento público | 0..1 | sim | não | objeto de valor | Um endereço por Tarefa; revogar e recriar gera outro. |
| Tarefa → Criador | 1 | não | não | referência | A7. |
| Execução → Tarefa (objeto) | 0..N | sim | sim | referência inversa | Uma Execução pode tocar muitas Tarefas. |
| Tarefa → Execuções que a referenciam | 0..N | sim | sim | derivada | |
| Template de Tarefa → Tarefas instanciadas | 0..N | sim | sim | proveniência | Sem vínculo vivo. |

Sem `DECISÃO NECESSÁRIA` pendente: todas as cardinalidades acima decorrem da constituição ou estão fixadas em decisões RECOMENDADAS da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** A Tarefa é a folha da cadeia estrutural Espaço → Pasta → Subpasta → Lista → Tarefa, com uma sub-hierarquia interna Tarefa → Subtarefa → Subtarefa (profundidade limitada pelo Espaço de Trabalho, B1). A sub-hierarquia não é um novo nível de configuração: Subtarefas consomem a mesma Lista que a raiz e nada definem.

**Pertencimento (teste de existência).** A Tarefa **não existe sem a Lista** (dependente estrutural). Comentários, Checklists, Itens, Registros de Tempo, Valores de Campo, Anexos (como referências), Regra de Recorrência e Compartilhamento público **não existem sem a Tarefa** (contenção; agregado). Subtarefas não existem sem a raiz (cascata), embora tenham identidade. Arquivos, Tags, Definições de Status, Tipos de Tarefa, Templates, Contatos, Negócios, Conversas, Documentos, Agentes e Membros **existem sem a Tarefa** (associação ou referência).

**"Pertence a" versus "relaciona-se com".** A Tarefa *pertence* à Lista. A Tarefa *relaciona-se com* Negócio, Contato, Conversa, Documento e outras Tarefas (Vínculo, Dependência). Responsável é *relação* com um Ator, não pertencimento: a Tarefa não pertence ao Responsável e o Responsável não pertence à Tarefa.

**Propriedade.** A Tarefa **não tem Proprietário** (A7). A governança da Tarefa (quem decide seu destino, quem concede acesso) é a do seu contêiner: o Administrador da Lista e dos ancestrais. A responsabilidade final (accountability) por uma Tarefa cujos Responsáveis são só Agentes recai sobre os Proprietários desses Agentes (B7), e por uma Tarefa sem Responsáveis, sobre o contêiner. O Criador não é Proprietário: pode perder acesso à Tarefa que criou se a Lista se tornar privada.

**Configurar não é conter.** A Lista configura o Conjunto de Status; a Tarefa o usa. Uma Definição de Status não é filha da Tarefa que a aponta; um Tipo de Tarefa não é filho da Tarefa.

## 11. Estados

Todos os estados desta seção são **estados de sistema** (A4.1), não personalizáveis, independentes do status atual (A4.2).

| Estado | Significado | Efeitos sobre o agregado |
| --- | --- | --- |
| `ativo` | Operação normal. | Agregado editável conforme permissões. Dependências têm efeito. Regra de Recorrência gera ocorrências. |
| `arquivado` | Retirada da operação corrente, sem intenção de excluir. Visível apenas em consultas que incluam arquivados. | Somente leitura, exceto desarquivar e comentar (recomendação: Comentário permitido, para registrar por que foi arquivada). Subtarefas e componentes seguem a raiz por derivação (B36). Não bloqueia outras Tarefas. Regra de Recorrência suspensa. Automações não a tratam como objeto de Gatilhos de mudança. |
| `na lixeira` | Excluída de forma recuperável, pelo prazo da Política de lixeira do Espaço de Trabalho. | Invisível em toda Visualização normal; só listada na lixeira. Somente restaurar ou eliminar. Vínculos e Dependências preservados, sem efeito. Não conta em Painéis. Regra suspensa. |

**Estado efetivo** (B36). Uma Tarefa com estado próprio `ativo` dentro de uma Lista efetivamente `arquivado` ou `na lixeira` está, para todos os efeitos, no estado da Lista (cascata por derivação, A3.3): o estado próprio não é reescrito, e a restauração da Lista devolve à Tarefa o seu estado próprio — uma Tarefa arquivada por si antes do arquivamento da Lista continua arquivada depois. O mesmo vale para Subtarefa em relação ao pai e à raiz. Toda regra de "o que pode ser feito" avalia o estado efetivo. Registros de Tempo em andamento são encerrados no ato em que a Tarefa deixa de ter estado efetivo `ativo` (7.3).

**Status atual × estado.** Uma Tarefa `arquivado` conserva o status que tinha (concluída ou não). Concluir não arquiva; arquivar não conclui. Painéis leem a categoria de status para "concluída" e o estado para "ativa".

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Ator com permissão `criar` na Lista de destino. Origens possíveis: criação direta; instanciação de Template; conversão de Item de Checklist; geração de ocorrência por Regra de Recorrência; criação por Automação, Agente ou Integração; criação "a partir de" outro registro (Conversa, Negócio, Mensagem de Chat), que gera Vínculo automático com o registro de origem e proveniência.

A criação é atômica e produz, no mesmo ato: a Tarefa em estado `ativo`, com status atual válido (primeira Definição de categoria `não iniciado` do Conjunto efetivo, salvo indicação), Tipo de Tarefa (padrão "tarefa"), Prioridade `sem prioridade`, Criador, Momento de criação, Valores de Campo obrigatórios preenchidos (salvo criação derivada, que nasce com eles vazios — DO-TAR-20 / B49), identificador legível se habilitado; e o primeiro Registro de Atividade ("Tarefa criada"). Criar Subtarefa exige, além disso, permissão `editar` sobre o **pai imediato** (DO-STA-10), pai em estado efetivo `ativo` e respeito à Profundidade máxima (INV-TAR-02): ao atingi-la, a criação é rejeitada com Registro de Atividade e evento "Profundidade máxima atingida" (RN-STA-04).

Uma Tarefa recém-criada é completa e válida com apenas título, Lista, status e Criador: Responsáveis, datas, descrição e todo o resto são opcionais.

### 12.2 Transições de status

Mudar o status atual é uma edição (`editar`) que aponta para outra Definição do Conjunto efetivo. Eventos derivados da categoria:

| Transição de categoria | Evento | Efeitos |
| --- | --- | --- |
| não terminal → `concluído` ou `fechado` | concluída | Momento de conclusão preenchido. Tarefas que ela bloqueava passam a "desbloqueada" (se não houver outro bloqueio). No modo `ao concluir`, a Regra de Recorrência gera a próxima ocorrência. Se a Funcionalidade "exigir Subtarefas concluídas" estiver habilitada e houver Subtarefa direta em estado efetivo `ativo` e categoria não terminal, a transição é rejeitada (RN-TAR-18); se "exigir Checklists concluídos" estiver habilitada e houver Item contável `aberto`, idem (RN-CHK-09) — as duas são cumulativas. Valores obrigatórios são validados. |
| `concluído` → `fechado` | status alterado | Momento de conclusão inalterado. |
| `concluído` ou `fechado` → não terminal | reaberta | Momento de conclusão esvaziado. Tarefas que ela bloqueia voltam a "bloqueada". Não gera ocorrência. |
| não terminal → não terminal | status alterado | |

A ontologia **não impõe** ordem entre Definições: qualquer transição dentro do Conjunto é válida, salvo Funcionalidades habilitadas na Lista (o documento de Status pode definir transições restritas; se o fizer, a Tarefa as obedece como configuração consumida).

### 12.3 Arquivar, excluir, restaurar, eliminar

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | `editar` | Momento de arquivamento gravado. Cascata por derivação a Subtarefas e componentes (estados próprios das Subtarefas não reescritos, B36). Registros de Tempo em andamento encerrados. Registro de Atividade. Regra suspensa. |
| `arquivado` | `ativo` | `editar` | Permitido mesmo sob Lista ou Tarefa pai efetivamente `arquivado`: o estado próprio passa a `ativo` e o estado efetivo continua derivado do ancestral até que este seja restaurado (DO-TAR-18). Subtarefas voltam ao estado efetivo que o seu estado próprio determina. Regra retomada (ocorrências perdidas não são geradas, 12.5). |
| `ativo` ou `arquivado` | `na lixeira` | `excluir` | Estado próprio anterior à exclusão e Momento de envio à lixeira gravados. Cascata por derivação a Subtarefas (estados próprios não reescritos). Responsáveis e Observadores preservados (para restauração). Dependências e Vínculos preservados sem efeito. Registro de Atividade. Se for Subtarefa, o pai perde a Subtarefa da contagem de progresso. Permitido sob ancestral efetivamente `arquivado`; sob ancestral efetivamente `na lixeira` a Tarefa não é alvo de ação alguma (só a restauração do ancestral). |
| `na lixeira` | Estado próprio anterior à exclusão (`ativo` ou `arquivado`) | `excluir` na Lista (restaurar é o inverso de excluir) | Exige que o pai imediato — Lista ou Tarefa pai — não esteja efetivamente `na lixeira`; sob pai efetivamente `arquivado`, restaura e permanece efetivamente `arquivado`. Se a Lista está `na lixeira`, restaurá-la primeiro; se a Lista foi eliminada, a Tarefa também foi (20.14). Se era Subtarefa e o pai está `na lixeira` e não é restaurado no mesmo ato, restaura como Tarefa raiz na mesma Lista, com evento "Pai alterado" (causa `restauração`) e Registro de Atividade (RN-TAR-28; DO-STA-05). As Subtarefas voltam ao estado efetivo que o seu estado próprio determina: as que estavam `na lixeira` por ato próprio permanecem (B36). Responsáveis, Observadores e Responsáveis de Item que perderam `ver` durante a exclusão são liberados na restauração (RN-TAR-06). O atributo Estado próprio anterior à exclusão é esvaziado. |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo da Política de lixeira) ou `excluir` explícito ("eliminar agora"), se o produto o oferecer | Não é estado: é o fim. Elimina o agregado inteiro (Subtarefas, Comentários, Checklists, Registros de Tempo, Valores, referências a Arquivos). Não elimina Arquivos (pertencem ao Espaço de Trabalho; um Arquivo sem referências é tratado pelo documento de Arquivos). Remove Vínculos e Dependências dos dois lados. Registros de Atividade permanecem (INV-ET-12), apontando para um objeto inexistente com título preservado no próprio Registro. |

### 12.4 Movimentação

Mover uma Tarefa raiz para outra Lista (do mesmo Espaço de Trabalho, em qualquer Espaço) é um ato único e atômico que preserva a identidade e move a árvore inteira de Subtarefas (B40). Exige `editar` na Tarefa e `criar` na Lista de destino; a Lista de destino precisa estar efetivamente `ativo`. Efeitos:

1. **Status**: se o Conjunto de Status efetivo do destino for diferente, é obrigatório um **mapeamento** de cada Definição em uso na árvore para uma Definição do destino, por categoria. Recomendação: mapeamento automático por categoria (mesma categoria, primeira Definição na ordem) quando o ator não indicar outro; a categoria nunca muda silenciosamente (uma Tarefa concluída não "reabre" ao ser movida) — INV-TAR-13.
2. **Valores de Campo**: Definições que se aplicam nos dois caminhos preservam o Valor; Definições que só existem no destino ficam vazias (obrigatoriedade avaliada na próxima edição, 6.3); Valores cujas Definições não se aplicam no destino passam a `arquivado` no agregado (DO-TAR-17 / B37).
3. **Tipo de Tarefa**: se o Tipo não estiver disponível no destino, passa ao Tipo padrão "tarefa"; Registro de Atividade.
4. **Tags, Vínculos, Dependências, Comentários, Registros de Tempo, Anexos, Regra de Recorrência, Proveniência**: preservados (são do Espaço de Trabalho ou do agregado).
5. **Responsáveis, Observadores e Responsáveis de Item de Checklist**: preservados **se** tiverem permissão de ver o destino; os que não tiverem são liberados com Registro de Atividade (RN-TAR-06; RN-CHK-06), Tarefa a Tarefa na árvore.
6. **Automações**: as do caminho de origem deixam de se aplicar; as do destino passam a aplicar-se; evento "movida" é emitido para ambos os caminhos.
7. **Compartilhamento público**: preservado se a Funcionalidade estiver habilitada no destino; caso contrário, revogado.

Mover uma **Subtarefa** para outra Lista não existe como operação simples: primeiro ela é desvinculada do pai (vira Tarefa raiz na mesma Lista, evento "pai alterado") e depois movida como raiz. Vincular uma Tarefa raiz como Subtarefa de outra exige que ambas estejam na mesma Lista (ou o ato de vincular inclui a movimentação para a Lista da nova raiz, com os efeitos acima) e respeito à profundidade máxima, contando a árvore que ela traz.

### 12.5 Recorrência (B6; DO-TAR-14)

A Tarefa que recebe uma Regra de Recorrência é uma **Tarefa normal**: é a primeira ocorrência da série e a **ocorrência corrente**. Ela não é um "modelo vivo": tem status, Responsáveis, Comentários e histórico como qualquer Tarefa, e é isso que se conclui.

Quando o disparo ocorre (conclusão da corrente no modo `ao concluir`; data devida no modo `por calendário`), o Sistema cria uma **nova Tarefa** na mesma Lista — e, se a corrente é Subtarefa, com o mesmo pai (irmã, DO-STA-08) —, com: título, descrição, Tipo, Prioridade, Tags, Responsáveis, Observadores, Valores de Campo e Anexos da descrição copiados; Checklists copiados (padrão da Regra: sim) como componentes novos, com Itens `aberto` e sem Itens `convertido` (RN-CHK-13); Subtarefas copiadas como Tarefas novas (com status inicial, mesmo nível, Checklists próprios pelas mesmas regras) se a Regra o determinar — níveis além da Profundidade máxima vigente não são copiados, com Registro de Atividade (RN-STA-04); datas deslocadas pelo mesmo intervalo; status inicial do Conjunto; Proveniência "ocorrência de" apontando para a corrente e "origem da série" apontando para a primeira. Comentários, Registros de Tempo, Dependências e Vínculos **não** são copiados (Vínculos podem ser copiados se a Regra o determinar; recomendação: sim para Contato, Empresa e Negócio, pois a recorrência de trabalho comercial costuma ser sobre o mesmo cliente).

No mesmo ato, a Regra é **transferida** à nova Tarefa, que passa a ser a ocorrência corrente; a anterior conserva uma cópia histórica da Regra em Proveniência e deixa de gerar. Editar a Regra edita a série daí em diante; remover a Regra da corrente encerra a série (as ocorrências anteriores não são afetadas). No modo `por calendário` com a corrente ainda aberta, aplica-se o comportamento configurado (`gerar mesmo assim`: duas ocorrências abertas coexistem; `aguardar conclusão`: a próxima só é gerada quando a corrente for concluída, com a data já devida). Corrente em estado efetivo `arquivado` ou `na lixeira` (por si ou por ancestral): nenhuma ocorrência é gerada; ao restaurar, a próxima data devida é recalculada a partir do momento da restauração, e ocorrências perdidas não são geradas retroativamente (mesmo princípio de B31). Término da série: ao atingir a condição de término, a última ocorrência gerada não recebe a Regra.

### 12.6 Cascata recebida

A Tarefa segue a Lista: arquivar, excluir, restaurar e eliminar a Lista aplicam-se a todas as suas Tarefas (A3.3). Eliminar permanentemente uma Lista elimina suas Tarefas mesmo que estas estejam na lixeira por ato próprio anterior. A Tarefa nunca sobrevive à Lista (INV-TAR-01).

## 13. Regras de negócio ontológicas

- **RN-TAR-01.** Toda Tarefa pertence a exatamente uma Lista, definida na criação e alterável apenas por movimentação explícita (12.4), que preserva a identidade (B4).
- **RN-TAR-02.** Uma Subtarefa pertence à mesma Lista da sua Tarefa raiz. Mover a raiz move a árvore; uma Subtarefa só muda de Lista sendo antes desvinculada do pai (B1).
- **RN-TAR-03.** O Nível (de Tarefa) de uma Subtarefa não excede a Profundidade máxima de Subtarefas do Espaço de Trabalho. Reduzir o máximo não elimina Subtarefas existentes (RN-ET-17); impede novas abaixo do limite.
- **RN-TAR-04.** O status atual aponta sempre para uma Definição do Conjunto de Status efetivo da Lista da Tarefa. Alterar o Conjunto efetivo (troca na Lista ou em ancestral, ou movimentação) exige mapeamento das Definições em uso; a categoria da Tarefa não muda sem ato explícito (INV-TAR-13).
- **RN-TAR-05.** Momento de conclusão é derivado: preenchido na transição de categoria não terminal para `concluído` ou `fechado`; esvaziado na reabertura; inalterado entre `concluído` e `fechado`.
- **RN-TAR-06.** Responsável (Membro `ativo` ou Agente) e Observador precisam ter permissão efetiva de `ver` a Tarefa no momento da atribuição; atribuir a quem não tem é inválido. Atribuir **não concede** permissão. Quando uma permissão é revogada (contêiner tornado privado, concessão retirada, Membro removido — B28), os Responsáveis e Observadores que perdem `ver` são liberados no mesmo ato, com Registro de Atividade e evento "responsável removido" (ator: quem revogou; para remoção de Membro, o ator da remoção). Membro `suspenso` mantém a responsabilidade, mas não recebe novas (RN-ET-08).
- **RN-TAR-07.** Não há Responsável principal (A7). Todos os Responsáveis têm a mesma relação com a Tarefa. Ordem entre Responsáveis é apresentação.
- **RN-TAR-08.** A Tarefa não tem Proprietário. Sua governança é a do contêiner. Nenhum documento pode atribuir "Proprietário da Tarefa"; se o produto precisar de "quem responde por esta Tarefa", isso é um Responsável ou uma Definição de Campo tipo pessoa.
- **RN-TAR-09.** A descrição é atributo da Tarefa. Sua edição gera Registro de Atividade com o ator; não gera Comentário.
- **RN-TAR-10.** Um Valor de Campo existe apenas para Definição aplicável no caminho efetivo da Lista (A5.4). Valor de Definição que deixou de se aplicar por movimentação é `arquivado` no agregado e reativado se voltar a aplicar-se (B37); Valor de Definição enviada à lixeira é retido e invisível até a eliminação permanente da Definição, que o elimina, e restaurado com ela (DO-ESP-05; A5.4).
- **RN-TAR-11.** Uma Tag só é aplicável se sua restrição de tipo admitir Tarefa (B5). Remover a Tag do Espaço de Trabalho remove a aplicação de todas as Tarefas.
- **RN-TAR-12.** Anexo é referência: remover o Anexo não remove o Arquivo; remover o Arquivo do Espaço de Trabalho remove o Anexo de todas as Tarefas, com Registro de Atividade em cada uma.
- **RN-TAR-13.** Comentário tem autor imutável (Ator: Membro, Agente ou Automação — B91); só o autor, ou quem tem `administrar` sobre a Tarefa ou sobre a Lista que a contém, edita ou exclui; exclusão preserva o encadeamento com marcador; resolução só no Comentário raiz da thread; respostas têm um nível.
- **RN-TAR-14.** Menção em descrição ou Comentário é referência a registro do mesmo Espaço de Trabalho. Menção a Membro, Equipe ou Agente notifica, sujeita a `ver`; menção a outro registro só cria referência navegável. Menção nunca cria Vínculo, Responsável ou permissão.
- **RN-TAR-15.** Vínculos são 0..N por tipo, bidirecionais, sem propriedade. Remover um lado remove o Vínculo, não o outro registro. Um lado `na lixeira` suspende a exibição do Vínculo; eliminação permanente o remove.
- **RN-TAR-16.** Dependências não formam ciclos, não ligam uma Tarefa a si mesma nem a um ancestral ou descendente, não cruzam Espaços de Trabalho e só existem com a Funcionalidade habilitada nas Listas de ambas as Tarefas. Uma Tarefa `arquivado` ou `na lixeira` não exerce bloqueio. A verificação de ancestral/descendente ocorre ao criar a Dependência e ao rebaixar ou reparentar uma Tarefa, sobre toda a subárvore trazida contra os novos ancestrais (DO-STA-11).
- **RN-TAR-17.** "Bloqueada" não impede mudança de status por padrão; a Lista pode habilitar a Funcionalidade que impede transição para `concluído`/`fechado` de Tarefa bloqueada.
- **RN-TAR-18.** Concluir uma Tarefa com Subtarefas em categoria não terminal é permitido por padrão. A Lista pode habilitar a Funcionalidade "exigir Subtarefas concluídas", que rejeita a transição do pai enquanto houver Subtarefa **direta** em estado efetivo `ativo` e categoria não terminal (Subtarefas efetivamente `arquivado` ou `na lixeira` não impedem; cada nível avalia as suas diretas); "exigir Checklists concluídos" (RN-CHK-09) é cumulativa. Concluir o pai nunca conclui as Subtarefas automaticamente; a Lista pode habilitar Automação para isso, mas não é regra ontológica.
- **RN-TAR-19.** Subtarefa pode estar em qualquer categoria, independentemente do pai. Nenhuma coerência de categoria entre pai e filho é exigida.
- **RN-TAR-20.** Datas não se propagam automaticamente entre pai e Subtarefas em nenhuma direção. A Funcionalidade "datas de Subtarefas contidas no pai" valida, não reescreve.
- **RN-TAR-21.** Compartilhamento público é criado apenas por Membro com permissão `administrar` na Lista (recomendação; produto pode relaxar para `editar`), só se a Funcionalidade estiver habilitada, e concede apenas `ver`. Agente, Automação e Integração nunca o criam. Revogar é imediato. Gera Registro de Atividade.
- **RN-TAR-22.** Registro de Tempo é sempre de um Membro, nunca de Agente (B42); no máximo um "em andamento" por Membro no Espaço de Trabalho; disponível só com a Funcionalidade habilitada. Registro de Tempo por outro Membro exige `administrar` na Lista e registra ator delegante. Um Registro em andamento é encerrado pelo Sistema no ato em que a Tarefa deixa de ter estado efetivo `ativo`, com o ator do arquivamento ou exclusão como ator delegante, e não é reaberto na restauração (B36; confirma DO-LIS-09).
- **RN-TAR-23.** Toda ação sobre a Tarefa ou seu agregado gera Registro de Atividade com ator, objeto (a Tarefa ou a entidade interna), momento, resultado e ator delegante quando houver (A6.2). Alterações de Item de Checklist e de Valor de Campo registram a Tarefa como objeto.
- **RN-TAR-24.** Instanciar um Template de Tarefa cria uma Tarefa nova com Proveniência; valores do Template que dependem de configuração inexistente na Lista de destino (Definições de Campo, Tipo, Definições de Status) são descartados ou mapeados ao padrão, com Registro de Atividade. Alterar ou remover o Template não afeta Tarefas já criadas.
- **RN-TAR-25.** A geração de ocorrência por Regra de Recorrência é ato do Sistema, com a Tarefa corrente como objeto do Registro de Atividade e ator delegante igual ao Membro que definiu a Regra pela última vez. A ocorrência gerada registra o mesmo.
- **RN-TAR-26.** Mudar o Tipo de Tarefa nunca altera status, estado, Responsáveis ou datas; pode alterar os campos exibidos por padrão. Valores de Campo não são removidos pela mudança de Tipo.
- **RN-TAR-27.** Agente que é Responsável não executa a Tarefa por esse fato; a execução ocorre em uma Execução de Agente, iniciada por Automação — Gatilho de `evento` (o evento "responsável atribuído" pode ser Gatilho) ou de `agendamento` (DO-AUT-03; B89) —, com a Automação como delegante (DO-AUT-15; B79), ou por Membro (Sessão de Chat ancorada ou ação direta), com o Membro como delegante; sempre com as permissões da seção 17. A geração de ocorrência por Regra de Recorrência não é Automação: é ato do Sistema (RN-TAR-25).
- **RN-TAR-28.** Restaurar uma Tarefa da lixeira devolve o Estado próprio anterior à exclusão e exige que o pai imediato (Lista ou Tarefa pai) não esteja efetivamente `na lixeira`; sob pai efetivamente `arquivado`, a Tarefa é restaurada e permanece efetivamente `arquivado`. Subtarefa cujo pai está `na lixeira` e não é restaurado no mesmo ato é restaurada como Tarefa raiz na mesma Lista, com evento "Pai alterado" e Registro de Atividade; a relação não é refeita se o pai for restaurado depois (DO-STA-05). Alterar o estado próprio de uma Tarefa (arquivar, desarquivar, excluir, restaurar) sob ancestral efetivamente `arquivado` é permitido; sob ancestral efetivamente `na lixeira`, não (12.3).

## 14. Invariantes

- **INV-TAR-01.** Toda Tarefa existente referencia exatamente uma Lista existente do mesmo Espaço de Trabalho. Nenhuma Tarefa sobrevive à eliminação da sua Lista.
- **INV-TAR-02.** A cadeia de pais de qualquer Tarefa é finita, acíclica, termina em uma Tarefa raiz e tem comprimento ≤ Profundidade máxima do Espaço de Trabalho (salvo árvores anteriores a uma redução, RN-ET-17).
- **INV-TAR-03.** Toda Subtarefa tem a mesma Lista da sua Tarefa raiz.
- **INV-TAR-04.** O status atual de toda Tarefa aponta para uma Definição de Status pertencente ao Conjunto de Status efetivo da sua Lista.
- **INV-TAR-05.** Existe no máximo um Valor de Campo por par (Tarefa, Definição), e todo Valor `ativo` corresponde a uma Definição aplicável ao caminho efetivo da Lista.
- **INV-TAR-06.** Todo Responsável e todo Observador vigente de uma Tarefa tem permissão efetiva de `ver` a Tarefa e, se Membro, está em estado `ativo` ou `suspenso`; nunca `pendente` ou `removido`.
- **INV-TAR-07.** Quando Data de início e Data de vencimento existem, início ≤ vencimento.
- **INV-TAR-08.** Momento de conclusão está preenchido se e somente se a categoria do status atual é `concluído` ou `fechado`.
- **INV-TAR-09.** O grafo dirigido formado por todas as Dependências do Espaço de Trabalho é acíclico, não contém laços nem arestas entre ancestral e descendente.
- **INV-TAR-10.** Nenhum Vínculo, Dependência, Anexo, menção, Responsável ou Observador de uma Tarefa referencia registro de outro Espaço de Trabalho (INV-ET-07).
- **INV-TAR-11.** Uma Tarefa tem no máximo uma Regra de Recorrência, e em toda série recorrente exatamente uma Tarefa (a corrente) a carrega, enquanto a série não terminar.
- **INV-TAR-12.** Um Membro tem no máximo um Registro de Tempo em andamento em todo o Espaço de Trabalho.
- **INV-TAR-13.** Nenhuma operação estrutural (mover, mapear Conjunto, restaurar, instanciar, mudar Tipo) altera a categoria de status de uma Tarefa sem ato explícito de mudança de status.
- **INV-TAR-14.** O estado efetivo de uma Subtarefa nunca é menos restritivo que o estado efetivo do seu pai, e o de uma Tarefa raiz nunca é menos restritivo que o da sua Lista, na ordem `ativo` < `arquivado` < `na lixeira` (B36).
- **INV-TAR-15.** Criador, Momento de criação, identificador e identificador legível são imutáveis.
- **INV-TAR-16.** A Tarefa nunca possui Proprietário nem define configuração (Conjunto de Status, Definição de Campo, Tipo, Funcionalidade, Automação, permissão de restrição).

## 15. Personalização

**Personalizável na própria Tarefa** (por quem tem a permissão indicada): título, descrição, status atual (dentro do Conjunto efetivo), Tipo (dentro dos disponíveis), Prioridade, datas, Estimativa, Responsáveis, Observadores, Tags, Valores de Campo, Anexos, Checklists, Regra de Recorrência, Vínculos, Dependências, Compartilhamento público, posição entre irmãs.

**Personalizável fora da Tarefa e consumido por ela** (B25): Conjunto de Status e Definições (Espaço/Pasta/Subpasta/Lista); Definições de Campo (idem, acumuladas); Tipos de Tarefa; Funcionalidades habilitadas (Registro de Tempo, Estimativa, Dependências, exigir Subtarefas concluídas, impedir conclusão bloqueada, datas contidas, Compartilhamento público); Automações; Visualizações; Tags (Espaço de Trabalho); Templates (Espaço de Trabalho); Profundidade máxima e identificador legível (Espaço de Trabalho).

**Não personalizável:** identificador, Criador, momentos; os estados de sistema e suas transições; as categorias de status; a escala de Prioridade (nesta versão); a estrutura de Comentário (um nível de resposta); a regra de mesma Lista; a ausência de Proprietário; as cardinalidades da seção 9.

**Campos Personalizados** aplicam-se à Tarefa por Definições no caminho da Lista (A5.2). Não existe Definição de Campo "por Tarefa" nem "por Tipo de Tarefa" como ponto de definição; o Tipo apenas seleciona quais Definições existentes são exibidas por padrão.

## 16. Herança

A Tarefa é o **consumidor final do Caminho efetivo** da Estrutura de Trabalho: recebe tudo, define nada (B25).

| Aspecto | Origem | Como chega à Tarefa | Pode a Tarefa sobrescrever? |
| --- | --- | --- | --- |
| Conjunto de Status | Ponto de definição mais próximo acima da Lista (substitui) | Um único Conjunto efetivo por Lista | Não. |
| Definições de Campo | Todos os níveis do caminho (acumulam) | Valores só para Definições do caminho | Não. Só preenche Valores. |
| Tipos de Tarefa | Todos os níveis do caminho (acumulam, B25) | Escolhe um dos disponíveis | Não. |
| Funcionalidades habilitadas | Ponto de definição mais próximo | Determinam o que o agregado pode conter | Não. |
| Automações | Todos os níveis do caminho (acumulam) | Reagem a eventos da Tarefa | Não. |
| Permissões | Herança do contêiner pai (A9.2), salvo contêiner privado | Permissão efetiva sobre a Tarefa | Só amplia (compartilhamento); nunca restringe (17.2). |
| Visualizações padrão | Lista | Apresentação | Não (Visualização pessoal é do Membro). |
| Profundidade máxima, Localidade, Política de lixeira, Tags, Templates | Espaço de Trabalho | Limites e catálogos | Não. |

**Subtarefa herda da raiz** apenas a Lista (e, por consequência, tudo o que a Lista transmite). Subtarefa **não herda** da raiz: status, Responsáveis, datas, Prioridade, Tags, Valores de Campo, Tipo. O produto pode oferecer "copiar do pai" na criação, o que é cópia, não herança. Compartilhamento (17.2) de uma raiz abrange as Subtarefas, porque a exposição é do agregado.

## 17. Permissões e visibilidade

### 17.1 Origem: herança da Lista

A Tarefa é Recurso da tupla (Sujeito, Ação, Recurso, Escopo, Origem) (A9.1), mas a origem normal de toda permissão sobre ela é **herança do contêiner** (A9.2): quem pode `ver`, `comentar`, `criar`, `editar`, `excluir` ou `administrar` na Lista pode o mesmo sobre cada Tarefa dela, salvo o escopo `próprios` (B29), que restringe a Tarefas em que o Sujeito é Responsável ou Criador. Contêiner privado interrompe a herança na Lista ou acima; a Tarefa apenas reflete.

| Ação | Sobre a Tarefa significa |
| --- | --- |
| ver | Ler a Tarefa e o agregado (Comentários, Checklists, Anexos, Valores, Registros de Tempo, histórico); ver Vínculos cujo outro lado também vê. |
| comentar | Criar Comentários e respostas; editar e excluir os próprios; resolver encadeamentos próprios. Não altera nenhum atributo. |
| criar | Criar Tarefas na Lista; criar Subtarefas exige também `editar` no pai imediato (DO-STA-10). |
| editar | Alterar atributos, status, Responsáveis, Observadores, Tags, Valores, Anexos, Checklists, Dependências, Vínculos (exige `ver` no outro lado), Regra de Recorrência; registrar tempo próprio; arquivar e desarquivar; mover (com `criar` no destino). |
| excluir | Enviar à lixeira e restaurar. |
| administrar | Compartilhar (17.2), criar Compartilhamento público, registrar tempo por outro Membro, editar ou excluir Comentários de terceiros. |

### 17.2 A Tarefa como unidade de ampliação, não de restrição

A Tarefa **não pode ser marcada privada** e não tem concessões que subtraiam a herança: quem vê a Lista vê todas as suas Tarefas (dentro do seu escopo). Justificativa: Tarefas privadas dentro de Listas visíveis tornam Painéis, contagens de progresso, Dependências e IA inconsistentes ("a Lista tem 12 Tarefas, você vê 9") e transferem para o nível mais numeroso da estrutura a complexidade de permissão que B3 e B25 mantiveram nos contêineres. Quem precisa de trabalho confidencial cria uma Lista privada.

A Tarefa **pode ser compartilhada** (origem "compartilhamento", A9.1): concessão de `ver`, `comentar` ou `editar` no escopo `registro` a Membro, Equipe ou Agente, aditiva à herança, que abrange todo o agregado inclusive Subtarefas. É o mecanismo pelo qual um Convidado (Papel) recebe uma única Tarefa, e pelo qual um Agente recebe acesso pontual. Compartilhar uma Tarefa não compartilha a Lista nem os registros vinculados. Compartilhamento é preservado na movimentação (DO-TAR-16).

### 17.3 Responsável e permissão

Ser Responsável **não é** ter permissão: é uma relação de execução. A regra é a inversa: para ser Responsável é preciso já ter `ver` (RN-TAR-06). Justificativa: se atribuir concedesse acesso, qualquer Membro com `editar` na Lista poderia ampliar o acesso de terceiros a um contêiner privado apenas atribuindo Tarefas, contornando o Administrador. O fluxo correto é: compartilhar (quem pode administrar) e então atribuir (quem pode editar). Um Responsável com apenas `ver` na Lista pode ser Responsável, mas não altera status — situação válida, embora improdutiva; o produto deve avisar. Recomendação de produto, não regra ontológica: Responsável com `ver` recebe `comentar` sobre a Tarefa por compartilhamento automático criado no ato da atribuição, para poder relatar progresso; se adotado, é um compartilhamento como outro qualquer, revogável.

### 17.4 Compartilhamento público

Exposição de `ver` a quem não é Sujeito (7.7). Não é Permissão; é objeto de valor da Tarefa, criado por Membro com `administrar` (RN-TAR-21), condicionado a Funcionalidade da Lista, revogável, auditado. O que fica visível é limitado ao agregado da Tarefa; Vínculos, registros vinculados e a Lista nunca são expostos. Painéis não contam visitantes públicos como visualizadores.

### 17.5 IA sujeita às mesmas regras

Agente é Sujeito (A6.3). Como Responsável, precisa de `ver`; para mudar status, precisa de `editar`; para comentar, `comentar`. Em nome de um Membro, permissão efetiva é a interseção (A9.3); autônomo, só as próprias. Permissões são avaliadas a cada Ferramenta (B23): um Agente que só pode comentar e tenta alterar status tem a chamada rejeitada e a Execução tratada conforme B23 (20.12). Automação age com as suas permissões próprias, limitadas pelo teto do Proprietário (permissão efetiva = próprias ∩ Proprietário atual — DO-AUT-01; B88; documento 01, 17.1), avaliadas a cada Ação (B23); não há atalho de Sistema para Automação sobre Tarefa. Sistema age apenas para atos derivados de regra (gerar ocorrência, eliminar por prazo, marcar vencida).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Tarefa criada | 12.1 | identificador, Lista, título, Criador, origem (direta, Template, Item convertido, ocorrência, outro registro), pai | Automações; Painéis; notificação a Observadores; Vínculo automático com origem |
| Tarefa atualizada | Alteração de título, descrição, Prioridade, datas, Estimativa, Tipo, Tags, Valor de Campo, Anexo | atributo, antes, depois, ator | Automações; auditoria; Observadores |
| Checklist adicionado / atualizado / removido / concluído / reaberto; Item de Checklist adicionado / atualizado / concluído / reaberto / removido / convertido; Responsável de Item atribuído / removido; Template de Checklist instanciado | Documento 08, seção 18 (DO-CHK-12) | Tarefa (objeto), Checklist, Item, antes/depois, ator | Automações ("Checklist concluído" como Gatilho); Painéis (Progresso de Checklists); Observadores |
| Status alterado | 12.2 | Definição antes/depois, categorias, ator | Automações; Painéis (tempo em status); Dependências |
| Tarefa concluída | Categoria → `concluído`/`fechado` | momento de conclusão, ator | Recorrência (`ao concluir`); Dependências (desbloquear); Painéis; Negócio vinculado (Automações) |
| Tarefa reaberta | Categoria terminal → não terminal | ator, motivo opcional | Dependências (rebloquear); Painéis |
| Responsável atribuído / removido | Alteração de Responsáveis | Ator afetado, ator da ação, causa (edição, revogação de permissão, remoção de Membro, movimentação) | Notificação; Automações (Gatilho para Execução de Agente, RN-TAR-27); Painéis de carga |
| Observador adicionado / removido | Alteração de Observadores | idem | Notificação |
| Comentário adicionado / editado / excluído / resolvido | 7.1 | Comentário, autor, menções | Notificação a mencionados e Observadores; Automações |
| Tarefa vencida | Sistema, no instante em que Vencida passa a verdadeiro | Data de vencimento, Responsáveis | Notificação; Automações; Painéis |
| Tarefa movida | 12.4 | Lista origem/destino, mapeamento de status, Valores arquivados, Responsáveis liberados | Automações dos dois caminhos; Painéis |
| Pai alterado | Promoção, rebaixamento, reparentagem ou restauração como raiz (documento 07, 12.3 e 12.4) | pai antes/depois, raiz antes/depois, nível antes/depois, causa (`promoção`, `rebaixamento`, `reparentagem`, `restauração`), Lista de destino se houve movimentação, Responsáveis liberados | Progresso de Subtarefas dos pais antigo e novo; Painéis; Automações; reavaliação de compartilhamentos |
| Progresso de Subtarefas alterado | No pai, quando uma Subtarefa direta muda de categoria, entra ou sai do estado efetivo `ativo`, é criada, promovida, rebaixada ou eliminada | pai, categoria do pai, progresso antes/depois, Subtarefa causadora | Automações de propagação; Painéis; Observadores do pai |
| Profundidade máxima atingida | Criação, rebaixamento, reparentagem ou conversão de Item rejeitados por RN-STA-04 | pai pretendido, nível pretendido, máximo, ator | Notificação ao ator; Agentes (replanejar) |
| Tarefa arquivada / desarquivada | 12.3 | ator, cascata | Painéis; Recorrência (suspender/retomar) |
| Tarefa excluída (lixeira) / restaurada / eliminada | 12.3 | ator, cascata, Lista de restauração | Vínculos e Dependências (suspender/remover); Painéis; Arquivos (referências) |
| Dependência criada / removida | 8.3 | tipo, origem, destino, ator | Bloqueio derivado; linha do tempo |
| Tarefa bloqueada / desbloqueada | Mudança em "Bloqueada" derivada | Tarefas bloqueadoras vigentes | Notificação a Responsáveis; Automações |
| Vínculo criado / removido | 8.2 | tipo, outro registro, ator | Outro domínio (Negócio, Conversa); Painéis |
| Tag aplicada / removida | | Tag, ator | Automações; Painéis |
| Registro de Tempo criado / alterado / removido; iniciado / parado | 7.3 | Membro, duração | Painéis de esforço |
| Ocorrência gerada | 12.5 | Tarefa corrente, nova Tarefa, Regra | Notificação; Painéis |
| Série de recorrência encerrada | Regra removida ou término atingido | última ocorrência | Notificação |
| Tarefa compartilhada / compartilhamento revogado | 17.2 | Sujeito, ação, ator | Auditoria; reavaliação de Responsáveis (RN-TAR-06) |
| Compartilhamento público criado / revogado | 17.4 | Criador, escopo | Auditoria |
| Template instanciado | 12.1 | Template, versão, Tarefa criada | Auditoria |

Todos geram Registro de Atividade com a Tarefa (ou a entidade interna, com a Tarefa como raiz) como objeto e ator delegante quando aplicável (A6.2). Eventos de Subtarefa são da Subtarefa; a raiz pode ser notificada como agregação.

## 19. Dependências

**A Tarefa depende de** (precisam existir antes):

- **Lista** (e, transitivamente, Espaço e Espaço de Trabalho): contêiner, configuração e permissão.
- **Conjunto de Status efetivo** com ao menos uma Definição: sem ele, não há status atual válido.
- **Tipo de Tarefa** padrão "tarefa" (fornecido pela plataforma, sempre disponível).
- **Ator** com permissão `criar`: para existir.
- **Espaço de Trabalho**: Profundidade máxima, Localidade, Política de lixeira, identificador legível, Tags, Templates.

**Dependem da Tarefa**: Comentários, Checklists, Itens, Registros de Tempo, Valores de Campo, Anexos (referências), Regra de Recorrência, Compartilhamento público, Subtarefas (cascata). Dependem parcialmente: Vínculos e Dependências (removidos na eliminação de um lado); Execuções e Sessões de Chat ancoradas (perdem o objeto, não a existência); Registros de Atividade (permanecem, INV-ET-12).

**Documentos que este documento pressupõe ou condiciona:** Lista (05) fornece Conjunto efetivo, Definições, Funcionalidades e privacidade, e recebe deste a confirmação do encerramento de Registros de Tempo (RN-TAR-22 confirma DO-LIS-09 / B36); Subtarefa (07) e Checklist (08) detalham DO-TAR-10 e DO-TAR-11; Status (09) define Definições, categorias e eventuais transições restritas; Campos Personalizados fixa obrigatoriedade e Valores arquivados (B37); CRM (Contato, Empresa, Negócio, Conversa) e Conhecimento recebem os tipos de Vínculo; Agentes e Automações recebem RN-TAR-27, 17.5 e os Gatilhos da seção 18; Painéis recebem os derivados (categoria, Vencida, Bloqueada, tempo em status, progresso).

## 20. Casos limítrofes e ambiguidades

### 20.1 Tarefa sem Responsável

Válida em qualquer status, inclusive concluída (trabalho registrado a posteriori). Não há "responsável padrão" ontológico; a Lista pode ter Automação que atribui. A accountability recai sobre o contêiner (10). Painéis a contam como "não atribuída".

### 20.2 Tarefa cujo único Responsável é um Agente

Válida (B7). Não há regra que exija um humano entre os Responsáveis, porque a accountability humana já existe: o Proprietário do Agente responde por ele. Ser Responsável não faz o Agente executar (RN-TAR-27); sem Automação ou invocação, a Tarefa fica parada, como ficaria com um humano que não age. Se o Agente perde `ver` (permissão revogada) ou é excluído, é liberado (RN-TAR-06) e a Tarefa passa a ter zero Responsáveis, com evento.

### 20.3 Tarefa concluída com Subtarefas abertas

Permitido por padrão (RN-TAR-18): a raiz pode representar uma entrega considerada feita mesmo com passos residuais. Justificativa da recomendação: exigir sempre engessa uso informal e obriga a concluir Subtarefas irrelevantes só para fechar o pai; proibir sempre impede que Listas rigorosas garantam integridade. Por isso é Funcionalidade da Lista: "exigir Subtarefas concluídas" rejeita a transição enquanto houver Subtarefa direta em estado efetivo `ativo` e categoria não terminal (RN-TAR-18); com "exigir Checklists concluídos" também habilitada, a transição é rejeitada se qualquer uma das duas falhar (documento 08, 20.6). Concluir o pai nunca conclui Subtarefas silenciosamente.

### 20.4 Subtarefa em categoria diferente da do pai

Sempre válido (RN-TAR-19): pai `em andamento` com Subtarefa `concluído`, ou pai `concluído` com Subtarefa `não iniciado` (20.3). Painéis leem cada Tarefa; "progresso de Subtarefas" é derivado do pai. Nenhuma propagação de status em nenhuma direção é ontológica.

### 20.5 Mover para Lista com Conjunto de Status diferente

Mapeamento obrigatório (12.4, RN-TAR-04). Cada Definição em uso na árvore mapeia para uma Definição do destino da **mesma categoria** (INV-TAR-13); se o destino não tiver Definição na categoria (ex.: sem `concluído`, só `fechado`), o ator escolhe entre categorias terminais, nunca uma não terminal para uma terminal sem ato explícito. Momento de conclusão é preservado. O mapeamento fica no Registro de Atividade.

### 20.6 Mover para Lista com Definições de Campo diferentes

Valores cujas Definições não se aplicam no destino **não são descartados**: passam a `arquivado` no agregado (DO-TAR-17 / B37). Justificativa: descartar destrói dados por uma operação de organização; manter como "valores sem definição" ativos viola A5.4. `arquivado` preserva e, se a Tarefa voltar (ou a Definição passar a aplicar-se ao novo caminho), reativa. Valores arquivados não são exibidos, não são consultáveis por Painéis e não impedem eliminação. A mesma regra vale quando é a Lista, a Pasta ou a Subpasta da Tarefa que é movida (B40).

### 20.7 Tarefa vinculada a Negócio que é excluído

Negócio `na lixeira`: o Vínculo é preservado e ocultado (a Tarefa mostra "vinculada a um registro na lixeira" ou nada). Negócio restaurado: Vínculo reaparece. Negócio eliminado permanentemente: Vínculo removido, com Registro de Atividade na Tarefa. A Tarefa nunca é excluída por causa do Negócio: Vínculo não é contenção (A8).

### 20.8 Responsável removido do Espaço de Trabalho

B28: a responsabilidade é liberada no ato da remoção — em Tarefas, Subtarefas e Itens de Checklist (RN-CHK-06) —; a Tarefa fica com os demais Responsáveis ou com zero. Evento "responsável removido" com causa "remoção de Membro", ator igual ao ator da remoção. Não há sucessão de responsabilidade (Sucessor só recebe propriedades e aprovações). Comentários e Registros de Tempo do removido permanecem atribuídos a ele (A6.4). Recomendação de produto: notificar os Observadores e o Administrador da Lista das Tarefas que ficaram sem Responsável.

### 20.9 Dependência circular

A → B (`bloqueia`) e B → A: proibido (INV-TAR-09). A verificação ocorre na criação de cada Dependência, percorrendo o grafo do Espaço de Trabalho inteiro (Dependências cruzam Listas e Espaços). Ciclo por `aguarda` também é proibido, e ciclo misto (`bloqueia` + `aguarda`) idem, porque um grafo único acíclico é o que permite que linha do tempo e "Bloqueada" sejam computáveis. Vincular uma Tarefa como Subtarefa de outra com a qual tem Dependência é rejeitado (RN-TAR-16).

### 20.10 Tarefa recorrente arquivada

A corrente `arquivado` suspende a série: nenhuma ocorrência é gerada. Ao desarquivar, a próxima data devida é calculada a partir do momento da restauração; as ocorrências que teriam sido geradas no intervalo não são criadas retroativamente (12.5). Se a intenção era encerrar a série, remove-se a Regra antes de arquivar. Uma ocorrência **anterior** arquivada não afeta a série (não carrega a Regra).

### 20.11 Comentário que menciona um Contato

Menção é referência tipada a qualquer registro do Espaço de Trabalho (RN-TAR-14). Mencionar um Contato cria uma referência navegável para quem tem `ver` no Contato; não cria Vínculo Tarefa–Contato, não notifica o Contato (Contato não é Ator nem tem caixa de entrada na plataforma) e não expõe a Tarefa ao Contato. O produto pode oferecer "criar Vínculo a partir da menção", ato explícito. Justificativa: inferir Vínculo de texto produz associações não intencionais e muda o que Painéis e IA consideram "trabalho deste cliente".

### 20.12 Agente alterando status em Lista onde só pode comentar

A Ferramenta "alterar status" exige `editar`; o Agente tem `comentar`; a chamada é rejeitada (17.5, B23). A Execução passa a `falhou` ou, se o Agente tiver alternativa, a `aguardando aprovação` com Solicitação de Aprovação a um Membro que possa editar. O Agente pode comentar propondo a mudança. Nenhuma Automação eleva a permissão do Agente (B22: sobrescrita só para menos autonomia).

### 20.13 Tarefa com 500 Comentários e 50 Anexos

Não é problema ontológico: cardinalidades 0..N sem teto. É problema de produto (paginação, resumo por IA) e de Limites impostos (armazenamento de Arquivos, B34). A ontologia só exige que cada Comentário e Anexo pertença ao agregado e que Arquivos sejam referências.

### 20.14 Tarefa restaurada da lixeira cuja Lista foi eliminada permanentemente

Não ocorre: a eliminação da Lista elimina suas Tarefas em cascata, inclusive as que já estavam na lixeira por ato próprio (12.6, INV-TAR-01). Caso vizinho — Lista `na lixeira` e Tarefa `na lixeira` por ato anterior: restaurar a Tarefa é rejeitado até que a Lista seja restaurada (RN-TAR-28); o produto pode oferecer "restaurar em outra Lista", que é restauração seguida de movimentação com todos os efeitos de 12.4.

### 20.15 Item de Checklist convertido em Subtarefa

Cria uma Tarefa nova com pai igual à Tarefa do Checklist — ou, por indicação explícita do Ator, o pai dessa Tarefa ou nenhum, sempre na mesma Lista (documento 08, 12.3) —, com profundidade verificada, título igual ao texto do Item, Responsável igual ao do Item (se tiver `ver`), Subitens transformados em um Checklist da nova Subtarefa, Proveniência "convertida de Item". O Item é marcado como `convertido`, com referência à Subtarefa (objeto de valor: identificador e título à época), é terminal e sai do numerador e do denominador do progresso do Checklist (DO-CHK-09). Se a Tarefa do Checklist está no nível máximo, a conversão é rejeitada antes de qualquer efeito (RN-STA-04; documento 08, 20.5). Não há conversão inversa (Subtarefa → Item) porque destruiria histórico.

### 20.16 Tarefa que representa reunião ou ligação com Contato

Nesta versão é Tarefa com Tipo de Tarefa apropriado ("reunião", "ligação", definidos no Espaço), Data de início como instante, Estimativa como duração, Vínculo a Contato (e a Negócio, se houver) e, após a interação, Comentário com o resultado. É suficiente para "próxima ação" comercial e para Painéis de esforço por Tipo. Não é Evento de calendário (D8): não tem participantes externos, não sincroniza agenda, não termina por decurso de tempo. Se D4 (Atividade de CRM) ou D8 forem adotados, a migração é por Vínculo, sem quebra: a Tarefa continua Tarefa.

### 20.17 Responsável em Lista privada que deixa de ver

Ao tornar uma Lista privada, o Administrador remove a origem "herança" dos Sujeitos não concedidos. Todo Responsável e Observador que perde `ver` é liberado no mesmo ato (RN-TAR-06), com evento e Registro de Atividade por Tarefa. O produto deve mostrar, antes de confirmar, quantas responsabilidades serão liberadas. Alternativa rejeitada: manter o Responsável "sem acesso" — cria Tarefas que aparecem em Painéis de carga de quem não pode abri-las.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Conjunto de Status, Definições de Status | Espaço, Pasta, Subpasta, Lista | A4.2, B25. A Tarefa aponta para uma Definição; não a possui. |
| Definições de Campo Personalizado | Espaço, Pasta, Subpasta, Lista | A5.2. A Tarefa possui Valores. |
| Tipos de Tarefa | Estrutura (ponto de definição) | Configuração consumida (C6). |
| Funcionalidades habilitadas, Automações, Visualizações | Lista e ancestrais; Visualização pessoal ao Membro | B25, A8. |
| Tags (definição) | Espaço de Trabalho | B5. A Tarefa tem aplicações. |
| Arquivos | Espaço de Trabalho | A8. A Tarefa tem Anexos (referências). |
| Templates de Tarefa | Espaço de Trabalho | A8, 7.6 do documento 01. A Tarefa tem Proveniência. |
| Registros de Atividade ("histórico") | Espaço de Trabalho | A6; INV-ET-12. A Tarefa é objeto deles; o histórico é visão. |
| Execuções de Agente / Automação | Agente / Automação | B18. Referenciam a Tarefa. |
| Sessões de Chat ancoradas | Membro | B21. |
| Solicitações de Aprovação sobre a Tarefa | Agente / Automação solicitante | A8. Objeto é a Tarefa; o pedido não é dela. |
| Membros, Equipes (Responsáveis) | Espaço de Trabalho | Responsável é relação. |
| Contatos, Empresas, Negócios, Conversas, Documentos vinculados | Seus domínios | Vínculo é associação (A2.2, A8). |
| Tarefas vinculadas ("relacionada a") e Tarefas dependentes | Elas mesmas | Associação; só Subtarefas são contidas. |
| Proprietário | Não existe | A7. Governança é do contêiner. |
| Profundidade máxima de Subtarefas, Localidade, Política de lixeira, identificador legível (configuração) | Espaço de Trabalho | B34. |
| Notificações | Fora da ontologia (mecanismo de entrega) | Eventos são da Tarefa; notificação é consequência de produto. |
| Ordem manual de Tarefas raiz em uma Lista | Visualização | Apresentação, não atributo. |
| "Tempo em cada status", "atraso", "progresso" | Derivados de Registros de Atividade e atributos | Não são gravados. |
| Etapa, situação, valor econômico | Negócio | A4.4. |
| Mensagens | Conversa | Comentário nunca é Mensagem. |
| Evento de calendário | D8 (futuro) | 20.16. |

## 22. Exemplos conceituais

**Exemplo 1 — Proposta comercial.** Na Lista "Propostas" (Espaço "Comercial"), a vendedora Maria cria a Tarefa "Enviar proposta — Clínica Vida" (OPS-1042), Tipo "tarefa", vencimento em dia civil, Responsáveis: Maria e o Agente "Redator"; Vínculos a Negócio "Pacote 10 sessões" e a Contato "Dra. Camila"; Tag "Convênio". A Automação "ao atribuir Agente Redator, iniciar Execução" invoca o Agente, que (com `editar` na Lista) anexa o rascunho como Arquivo e comenta "rascunho pronto". Maria revisa, muda o status para "Enviada" (categoria `em andamento`) e registra 40 minutos de tempo. Quando o Negócio é ganho, uma Automação do Funil muda o status para "Concluída" (categoria `concluído`): Momento de conclusão preenchido; Registro de Atividade com ator a Automação e Proveniência "Automação X, Execução Y" (B91), sem delegante Membro (B79).

**Exemplo 2 — Árvore e bloqueio.** "Implantar unidade Norte" (raiz) tem Subtarefas "Contratar recepção", "Instalar sistema" e "Treinar equipe". "Treinar equipe" é bloqueada por "Instalar sistema" (Lista "TI", outro Espaço). Enquanto "Instalar sistema" está `em andamento`, "Treinar equipe" exibe Bloqueada; a Lista "Implantação" habilitou "impedir conclusão bloqueada", então marcá-la como concluída é rejeitado. A raiz pode ser concluída com "Treinar equipe" aberta, porque a Lista não habilitou "exigir Subtarefas concluídas". Tentar criar "Instalar sistema é bloqueada por Treinar equipe" é rejeitado por ciclo.

**Exemplo 3 — Recorrência.** "Fechamento mensal" tem Regra: mensal, dia 1, modo `ao concluir`, copiar Checklists e Responsáveis, copiar Vínculo a Empresa "Contabilidade Alfa". Em 3 de setembro João a conclui: o Sistema cria "Fechamento mensal" (OPS-1101) com vencimento 1 de outubro, Checklist desmarcado, Proveniência "ocorrência de OPS-1042 / origem da série OPS-0900", e transfere a Regra. OPS-1042 mantém seus 6 Comentários e 3 horas registradas. Em novembro, João arquiva a corrente por engano; ao desarquivar em janeiro, a próxima ocorrência é calculada para 1 de fevereiro — dezembro e janeiro não são gerados.

**Exemplo 4 — Movimentação.** "Revisar contrato" está em "Jurídico" (Conjunto: A fazer / Em revisão / Aprovado [`concluído`]; Definição de Campo "Risco"). É movida para "Financeiro" (Conjunto: Aberto / Pago [`fechado`]; Definição "Valor"). Mapeamento: "Em revisão" → "Aberto" (mesma categoria `em andamento`); "Risco" → Valor arquivado no agregado; "Valor" → vazio. O Responsável Pedro, sem `ver` em "Financeiro", é liberado com Registro de Atividade. O identificador OPS-0877 não muda; o Vínculo ao Negócio permanece.

**Exemplo 5 — Convidado e compartilhamento.** A contadora Ana (Papel Convidado) precisa de uma única Tarefa da Lista privada "Notas fiscais". O Administrador compartilha a Tarefa "NF setembro" com Ana (`comentar`); só então a analista a atribui como Responsável. Ana vê a Tarefa, suas Subtarefas e Comentários; não vê a Lista nem o Negócio vinculado. Se o compartilhamento for revogado, Ana deixa de ser Responsável no mesmo ato.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Tag (0..N) ──────────────────────────────────── N:N ──┐
├── Template de Tarefa (0..N) ── proveniência ───────────┐│
├── Arquivo (0..N) ── referenciado por Anexo ───────────┐││
├── Membro / Agente ── Responsável (0..N), Observador ──┐│││
└── Espaço → Pasta → Subpasta → LISTA  [define: Conjunto de Status, Definições de Campo,
                                        Tipos, Funcionalidades, Automações, permissões]
                                  │
                                  └── TAREFA (raiz)  [1 Lista; 0 Proprietário; Criador 1;
                                       │             status atual → Definição do Conjunto efetivo;
                                       │             estado próprio: ativo | arquivado | na lixeira; estado efetivo derivado]
                                       │
                                       ├── Atributos: título, descrição (rica), Tipo (1), Prioridade,
                                       │   Data início (0..1), Data vencimento (0..1), Estimativa (0..1),
                                       │   Momento de conclusão (derivado), Vencida / Bloqueada (derivados)
                                       │
                                       ├── Agregado (contenção; sem existência fora)
                                       │   ├── Comentário (0..N) ── resposta (0..N, um nível) ── Anexo → Arquivo
                                       │   ├── Checklist (0..N) ── Item (0..N) [Responsável 0..1] ── Subitem (um nível)
                                       │   ├── Registro de Tempo (0..N) [Membro]
                                       │   ├── Valor de Campo (0..1 por Definição aplicável; ativo | arquivado)
                                       │   ├── Anexo (0..N) → Arquivo
                                       │   ├── Regra de Recorrência (0..1, só na ocorrência corrente)
                                       │   ├── Proveniência (0..1: Template | ocorrência anterior | Item | registro)
                                       │   └── Compartilhamento público (0..1)
                                       │
                                       ├── Subtarefa (0..N) = TAREFA com pai  [mesma Lista; profundidade ≤ máx. do ET;
                                       │     └── Subtarefa (0..N) ...           cascata; identidade própria]
                                       │
                                       ├── Associações (0..N cada; nunca contenção)
                                       │   ├── Responsável → Membro | Agente      (exige ver)
                                       │   ├── Observador → Membro                (exige ver)
                                       │   ├── Tag (N:N)
                                       │   ├── Vínculo ↔ Contato | Empresa | Negócio | Conversa | Documento | Tarefa
                                       │   └── Dependência → Tarefa  [bloqueia / é bloqueada por / aguarda; acíclico;
                                       │                               qualquer Lista ou Espaço do mesmo ET]
                                       │
                                       └── Referenciada por (a Tarefa não os contém)
                                           ├── Registro de Atividade (histórico = visão)
                                           ├── Execução de Agente / Automação (objeto)
                                           ├── Sessão de Chat (âncora)
                                           └── Visualização, Painel (Fonte de Dados)

Nenhuma aresta atravessa a fronteira do Espaço de Trabalho.
A Tarefa consome configuração da Lista; nunca define.
```

## 24. Decisões ontológicas

- **DO-TAR-01.** Tarefa pertence a exatamente uma Lista, definida na criação e alterável só por movimentação explícita que preserva identidade. Aplica B4 e A3.2. CONSOLIDADA.
- **DO-TAR-02.** Identificador legível opcional, habilitado por Espaço de Trabalho, sequencial e único no Espaço de Trabalho, com prefixo opcional, imutável e nunca reutilizado; não muda com movimentação, mudança de pai ou restauração. Justificativa: referências (Vínculos, Dependências, menções) cruzam Espaços e Listas; unicidade por Lista ou Espaço tornaria a referência ambígua. RECOMENDADA.
- **DO-TAR-03.** Descrição é atributo de conteúdo rico da Tarefa (com menções e Anexos), sem autor próprio, editável por `editar`, com histórico nos Registros de Atividade. Não é Comentário. RECOMENDADA.
- **DO-TAR-04.** Momento de conclusão é derivado da transição de categoria: preenchido ao entrar em `concluído` ou `fechado` a partir de categoria não terminal; inalterado entre as duas; esvaziado na reabertura. Reabertura é evento (A4.3). RECOMENDADA.
- **DO-TAR-05.** Responsáveis são 0..N Atores (Membro `ativo` ou Agente), sem principal; Observadores são 0..N Membros, relação distinta. Ambos exigem permissão `ver` prévia; atribuir não concede permissão; perda de `ver` libera a relação no mesmo ato. Tarefa não tem Proprietário (A7). Aplica B7 e B28. RECOMENDADA.
- **DO-TAR-06.** Datas são objetos de valor com forma dia civil ou instante, escolhida por Data. Não há propagação automática entre pai e Subtarefas em nenhuma direção; a Lista pode habilitar validação ("datas de Subtarefas contidas no pai"), nunca reescrita. "Vencimento da árvore" é derivado. RECOMENDADA.
- **DO-TAR-07.** Comentário na Tarefa: autor Ator (Membro, Agente ou Automação — B91; Integração como Sistema com o Membro configurador como delegante), conteúdo rico, Anexos, menções, respostas em um nível, resolução no Comentário raiz do encadeamento, edição e exclusão pelo autor ou por quem tem `administrar` sobre a Tarefa ou sobre a Lista que a contém (formulação comum a DO-EMP-15 e DO-NEG-15), exclusão com marcador. Comentário de Subtarefa pertence à Subtarefa. RECOMENDADA.
- **DO-TAR-08.** Vínculos da Tarefa: com Contato, Empresa, Negócio, Conversa, Documento de Conhecimento e Tarefa ("relacionada a"), todos 0..N, sem exclusividade, sem propriedade, com papel textual opcional; visíveis só a quem vê ambos os lados; lado `na lixeira` oculta, eliminação remove. "Relacionada a" não é Dependência. Aplica A8. RECOMENDADA.
- **DO-TAR-09.** Dependências: `bloqueia`/`é bloqueada por` (uma aresta, duas leituras) e `aguarda` (informativa); permitidas entre Listas e Espaços do mesmo Espaço de Trabalho; proibidas em laço, entre ancestral e descendente e em ciclo, num grafo único acíclico; Tarefa `arquivado` ou `na lixeira` não bloqueia; "Bloqueada" é derivado e não impede transição por padrão (Funcionalidade da Lista pode impedir). RECOMENDADA.
- **DO-TAR-10.** Decisões herdadas pelo documento de Subtarefa: mesma Lista da raiz; profundidade limitada pelo Espaço de Trabalho; cascata de estado; identidade e permissões próprias; nenhuma herança de status, Responsáveis, datas ou Valores da raiz; nenhuma propagação de status ou datas; concluir o pai com Subtarefas abertas é permitido por padrão, com Funcionalidade "exigir Subtarefas concluídas"; desvincular do pai preserva a identidade; criar Subtarefa exige `editar` no pai imediato (DO-STA-10); Subtarefa cujo pai não pode ser restaurado é restaurada como raiz. Aplica B1. RECOMENDADA.
- **DO-TAR-11.** Decisões herdadas pelo documento de Checklist: Item sem identidade externa, Responsável 0..1 Membro com `ver` na Tarefa, alterações registradas na Tarefa, conversão em Subtarefa cria Tarefa nova com Proveniência e marca o Item como `convertido` — terminal, fora do progresso (DO-CHK-09) — (Subitens viram Checklist da nova Subtarefa), rejeitada antes de qualquer efeito no nível máximo, sem conversão inversa; eventos de Checklist e de Item são eventos da Tarefa (DO-CHK-12). Aplica B2. RECOMENDADA.
- **DO-TAR-12.** Instanciar Template de Tarefa cria Tarefa nova com Proveniência (identificador, nome e versão do Template à época) como objeto de valor, não referência viva; elementos do Template sem configuração correspondente no destino são descartados ou mapeados ao padrão, com Registro de Atividade. Aplica A8. RECOMENDADA.
- **DO-TAR-13.** Tipo de Tarefa é referência obrigatória (exatamente um) a um Tipo disponível na Lista, com padrão "tarefa" fornecido pela plataforma; altera apresentação, campos exibidos por padrão e semântica para IA; nunca altera status, estado, ciclo de vida ou Valores. Aplica C6 como assumido. RECOMENDADA.
- **DO-TAR-14.** Recorrência: a Tarefa origem é uma Tarefa normal (primeira ocorrência); a Regra de Recorrência (objeto de valor) vive na **ocorrência corrente**; o disparo é `ao concluir` ou `por calendário` (com comportamento configurável se a corrente estiver aberta); a geração cria Tarefa nova (irmã, se a corrente é Subtarefa — DO-STA-08) com cópia dos atributos estruturais, Checklists com Itens `aberto` e sem Itens convertidos, Subtarefas (como Tarefas novas, sem níveis além da Profundidade máxima) e Vínculos conforme a Regra, Proveniência para a ocorrência anterior e para a origem da série, e transfere a Regra; corrente `arquivado` ou `na lixeira` suspende a série; ocorrências perdidas não são geradas retroativamente. Aplica B6; rejeita "modelo vivo". RECOMENDADA.
- **DO-TAR-15 / B42.** Tempo: Estimativa é atributo (duração); Registro de Tempo é entidade interna de Membro (nunca de Agente), com no máximo um em andamento por Membro no Espaço de Trabalho, encerrado quando a Tarefa deixa de ter estado efetivo `ativo` (B36); tempo em cada status, tempo até conclusão e reaberturas são derivados dos Registros de Atividade. Consolidada em B42 (Registro de Tempo por Agente rejeitado como pendência).
- **DO-TAR-16.** Permissões: origem normal é herança da Lista; a Tarefa não pode ser privada (não restringe) mas pode ser compartilhada (amplia) com Membro, Equipe ou Agente no escopo `registro`, abrangendo o agregado e as Subtarefas, preservado na movimentação; Compartilhamento público é objeto de valor de exposição `ver`, criado só por Membro com `administrar`, condicionado a Funcionalidade da Lista. Aplica A9.1, A9.2, B29. RECOMENDADA.
- **DO-TAR-17 / B37, B40.** Na movimentação (da Tarefa ou do seu contêiner) para caminho com Definições de Campo diferentes, Valores cujas Definições deixam de se aplicar passam a `arquivado` no agregado (preservados, ocultos, reativáveis), não são descartados (B37). Na movimentação para Conjunto de Status diferente, mapeamento obrigatório por categoria; a categoria nunca muda sem ato explícito. Tipo indisponível no destino passa ao padrão. Movimentação é atômica e exige `editar` na Tarefa e `criar` no destino (B40). Aplica A5.4 ("ou arquiva") e B25. Consolidada em B37 e B40.
- **DO-TAR-18 / B36, B43.** Estado próprio (`ativo`, `arquivado`, `na lixeira`) é independente do status; cascata por derivação a Subtarefas e componentes; estado efetivo é o mais restrito entre a Tarefa e seus ancestrais, e a restauração de um ancestral devolve a cada Tarefa o seu estado próprio; restauração devolve o Estado próprio anterior à exclusão (gravado no envio à lixeira) e exige apenas que o pai imediato não esteja efetivamente `na lixeira`; atos sobre o estado próprio de um descendente sob ancestral efetivamente `arquivado` são permitidos, com o estado efetivo derivado (consolidado em B43); eliminação permanente ao fim da Política de lixeira elimina o agregado, remove Vínculos e Dependências e preserva Registros de Atividade. Aplica A4.1, A3.3. Consolidada em B36.
- **DO-TAR-19.** Menção (em descrição ou Comentário) é referência a registro do mesmo Espaço de Trabalho; notifica só Membro, Equipe ou Agente com `ver`; nunca cria Vínculo, Responsável ou permissão. RECOMENDADA.
- **DO-TAR-20 / B49.** Tarefas criadas por derivação (conversão de Item de Checklist, ocorrência de recorrência, instanciação de Template) nascem com Valores de Campo obrigatórios vazios quando a origem não os fornece; a obrigatoriedade é avaliada na próxima edição e nas transições declaradas, nunca na criação derivada. Justificativa: exigir Valor na criação derivada tornaria recorrência e conversão inoperantes em Listas com Definição obrigatória. Aplica A5.4 e o princípio de 6.3. Consolidada em B49.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. As decisões marcadas "/ Bnn" foram consolidadas na constituição na harmonização e na revisão da fase 2; a auditoria da fase 6 aplicou B88 e B91 (17.5, 7.1, RN-TAR-13, RN-TAR-27).

## 25. Questões em aberto

1. **Tarefa em múltiplas Listas** (C3). Mantida rejeitada (B4). Se reaberta, DO-TAR-01, INV-TAR-01, INV-TAR-03, INV-TAR-04 e toda a seção 16 precisam de revisão: a Tarefa deixaria de ter um único Conjunto efetivo.
2. **Tipos de Tarefa: ponto de definição** (C6). Este documento assume Tipo como configuração herdada da estrutura, com padrão "tarefa", acumulando ao longo do caminho (B25). Permanece aberto apenas se o catálogo pode ter ponto de definição no Espaço de Trabalho.
3. **Transições restritas de status.** A ontologia não impõe ordem entre Definições. Se o documento de Status introduzir transições permitidas por Conjunto, a Tarefa as consome; a interação com mapeamento na movimentação (B40) precisará de regra.
4. **Compartilhamento automático ao atribuir Responsável** (17.3). Recomendado como produto (conceder `comentar` no ato da atribuição a quem só tem `ver`); se adotado, precisa constar como origem "compartilhamento" auditável, não como exceção a RN-TAR-06.
5. **Atividade de CRM e Evento de calendário** (D4, D8). Enquanto não existirem, reunião e ligação são Tarefas (20.16). A adoção de qualquer um dos dois exige definir a migração por Vínculo e o que acontece com Painéis de esforço comercial baseados em Tipo de Tarefa.
6. **Aprovação de Tarefa.** "Tarefa aguardando aprovação de alguém" hoje é Definição de Status de categoria `em andamento` ou Solicitação de Aprovação gerada por Agente/Automação. Não há aprovação humana-para-humana como conceito; se o produto exigir, é candidata a atributo de Tarefa ou a entidade futura, não a categoria de status nova.
7. **Limite de Responsáveis e de Subtarefas por Tarefa.** Sem teto ontológico; se a plataforma impuser, é Limite imposto (B34), não regra da entidade.
8. **Prioridade personalizável** (C17). Escala fixa nesta versão. Personalizar exigiria "Definição de Prioridade" com categoria fixa, no mesmo padrão de Status (A4.3). Registrada em C17.

Resolvidas na harmonização, sem pendência aberta: Registro de Tempo por Agente — rejeitado; o esforço de IA está na Execução, e "tempo humano + tempo de IA" é Métrica derivada (B42); modo de herança de Tipos de Tarefa — acumulam (B25).
