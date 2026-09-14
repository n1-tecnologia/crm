# ESPAÇO

> Domínio: Estrutura de Trabalho | Documento 02 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Espaço** é o primeiro nível estrutural abaixo do Espaço de Trabalho: a unidade que delimita uma **área de trabalho** com configuração operacional própria. É onde a Estrutura de Trabalho começa (A2.1, A3.1) e é o **ponto de definição mais alto** de tudo o que rege como Tarefas são trabalhadas — Conjunto de Status, Definições de Campo para Tarefas, Tipos de Tarefa, Funcionalidades habilitadas, Visualizações padrão e Automações de escopo estrutural (A4.2, A5.2, B25; RN-ET-14 do documento 01).

Três propriedades o distinguem:

1. **É fronteira de configuração.** O Espaço de Trabalho unifica o universo de dados (Tags, Funis, Localidade); o Espaço particulariza a forma de trabalhar. Duas áreas da mesma organização podem ter fluxos de status, campos e regras incompatíveis entre si e ainda assim compartilhar Contatos, Negócios, Caixa de Entrada e Tags. Essa separação — um universo de dados, vários modos de trabalho — é a razão de o Espaço existir como nível distinto do Espaço de Trabalho.
2. **É fronteira de acesso opcional.** Um Espaço pode ser **privado** (A9.2), interrompendo a herança de permissões do Espaço de Trabalho. É o primeiro ponto em que a organização pode dizer "isto não é para todos".
3. **É contêiner, não conteúdo.** O Espaço nunca contém Tarefas diretamente (A3.2): contém Pastas e Listas, e é a Lista que contém Tarefas. O Espaço organiza o trabalho; não é trabalho.

O Espaço não é um grupo de pessoas, não é um departamento do organograma, não é um projeto e não é uma "pasta de nível superior". É a área de trabalho enquanto conjunto de regras operacionais e de contêineres que as herdam.

## 2. Propósito

1. **Permitir modos de trabalho distintos sob o mesmo universo de dados.** Um Espaço "Atendimento" com status `novo → em triagem → resolvido` e um Espaço "Obras" com `planejado → em execução → entregue` coexistem sem que um contamine o outro, e ambos vinculam Tarefas aos mesmos Negócios e Contatos.
2. **Dar um ponto de definição estável para herança.** Sem um nível fixo onde a configuração começa, cada Lista definiria a sua e a organização não conseguiria padronizar. Com o Espaço, "todas as Listas de Obras usam este fluxo" é uma única definição com modo `herdado` abaixo (B25).
3. **Delimitar acesso por área.** A privacidade no Espaço é o mecanismo mais simples para "só o Financeiro vê o Financeiro", sem criar outro Espaço de Trabalho (o que separaria Contatos e Caixa de Entrada, A1.2).
4. **Ser unidade de reutilização e de análise.** Um Template de Espaço reproduz uma área inteira; um Painel pode tomar "as Tarefas de um Espaço" como Fonte de Dados; uma Automação pode valer para uma área inteira.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, com estado de ciclo de vida (A4.1).
- **Contêiner estrutural** (A3.3): tem exatamente um pai (o Espaço de Trabalho) e filhos estruturais exclusivos (Pastas e Listas diretas).
- **Ponto de definição de configuração** (B25). As configurações que define são objetos de valor ou entidades de configuração contidas (Definições de Status, Definições de Campo), nunca atributos simples.
- **Recurso de permissão** com escopo `subárvore` (B29): conceder sobre o Espaço alcança tudo abaixo.
- **Não é agregado de conteúdo.** Tarefa é raiz do próprio agregado; o Espaço é escopo de herança e de cascata de estado, não responsável pela consistência interna das Tarefas.
- **Não é Ator, não é Sujeito de permissão, não tem Proprietário** (A7 não o lista; seção 10). Tem Criador e Administradores de Espaço (seção 17).
- **Não é objeto de valor, não é Equipe, não é Papel.**

## 4. Fronteira conceitual

### O que é

- A área de trabalho como conjunto de regras operacionais (status, campos, tipos, funcionalidades, visualizações, automações).
- O primeiro contêiner da Estrutura de Trabalho e o pai direto de Pastas e Listas diretas.
- O primeiro ponto em que a privacidade pode ser declarada.

### O que não é

- **Não é Espaço de Trabalho.** Não isola dados, não tem Membros, não define Tags nem Funis. Um Espaço de Trabalho com zero Espaços é válido (A3.1).
- **Não contém CRM, IA nem Painéis** (A2.2). Negócios, Agentes e Painéis relacionam-se com o Espaço por associação (Vínculo, escopo de Automação, Fonte de Dados), nunca por contenção.
- **Não contém Tarefas** (A3.2). "Tarefas do Espaço" é a união derivada das Tarefas de todas as Listas descendentes.
- **Não é Equipe.** Não tem Membros; tem Sujeitos com permissão.
- **Não é Departamento.** A organização pode espelhar o organograma em Espaços, mas o Espaço é definido por como se trabalha, não por quem reporta a quem.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Espaço × Espaço de Trabalho** | Área de trabalho; ponto de definição de status, campos de Tarefa, tipos, funcionalidades, visualizações, automações estruturais; pode ser privado. | Raiz e limite de isolamento; sede de Membros, Papéis, Equipes; ponto de definição de Tags, Funis, Definições de Campo do CRM, Localidade. | Membresia e isolamento só no Espaço de Trabalho; status e campos de Tarefa só a partir do Espaço (RN-ET-13, RN-ET-14). |
| **Espaço × Pasta** | Filho direto do Espaço de Trabalho; primeiro ponto de definição; único nível que pode ser filho da raiz. | Agrupador intermediário dentro de um Espaço; sobrescreve o que o Espaço permite; pode conter Subpastas. | Pasta sempre herda de um Espaço; Espaço nunca herda de nada estrutural. Pasta existe para agrupar Listas dentro de uma área; Espaço existe para definir a área. |
| **Espaço × Lista** | Contêiner de contêineres; nunca contém Tarefas; ponto de definição. | Contêiner operacional; único que contém Tarefas; consome configuração (própria ou herdada). | A Lista é onde o trabalho está; o Espaço é onde as regras estão. Uma Lista direta do Espaço é operacionalmente igual a uma Lista em Pasta. |
| **Espaço × Equipe** | Contêiner de trabalho; recurso sobre o qual se concede permissão. | Grupo nomeado de Membros; Sujeito de permissão e destino de atribuição. | Uma Equipe pode receber acesso a vários Espaços; um Espaço pode ser acessado por várias Equipes. Nenhum contém o outro. "Espaço da Equipe X" é uma concessão, não uma identidade. |
| **Espaço × Departamento organizacional** | Estrutura de trabalho: regras de fluxo e contêineres. | Estrutura de pessoas: subordinação, centro de custo, chefia. | O organograma não existe na ontologia (C13 registra a ausência de atributos organizacionais no Membro). Um departamento pode usar vários Espaços; um Espaço pode servir a vários departamentos. |

## 5. Identidade

O Espaço tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Tudo o mais é atributo.

**Teste de identidade.** Se nome, ícone, cor, descrição, privacidade, todo o Conjunto de Status, todas as Definições de Campo e todo o conteúdo forem alterados, continua sendo o mesmo Espaço: Registros de Atividade, concessões, Fontes de Dados de Painéis, escopos de Automação e proveniência de Templates continuam a apontar para ele. A identidade é a continuidade do contêiner e do seu ponto de definição, não qualquer atributo.

Consequências:

- **Nome não é identidade.** O nome é único entre Espaços com estado próprio `ativo` ou `arquivado` do mesmo Espaço de Trabalho (DO-ESP-16 / B39), para que o caminho estrutural seja único e legível; Automações, Painéis e IA continuam a referenciar por identificador. A unicidade é regra, não identidade: renomear preserva o Espaço.
- **Espaço de Trabalho é parte da identidade, não atributo.** É definido na criação e imutável (INV-ET-01). Não existe "mover Espaço para outro Espaço de Trabalho".
- **Instanciar um Template não preserva identidade.** Dois Espaços criados do mesmo Template são entidades distintas com Definições de Status e de Campo distintas (seção 15; consequência registrada na seção 25).

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Espaço de Trabalho | referência (Espaço de Trabalho) | sim | Pai único, imutável (A1.1, A3.3). |
| Nome | nativo | sim | Editável. Único entre Espaços irmãos `ativo` ou `arquivado` (seção 5; B39). |
| Descrição | nativo | não | Texto livre sobre a finalidade da área. |
| Ícone | nativo | não | Símbolo de apresentação. Sem semântica. |
| Cor | nativo | não | Cor de apresentação. Sem semântica. |
| Estado próprio | nativo | sim | `ativo`, `arquivado`, `na lixeira` (seção 11). |
| Estado efetivo | derivado | sim | Igual ao Estado próprio, porque o pai (Espaço de Trabalho) não usa `arquivado` nem `na lixeira`. Definido aqui para que Pastas e Listas o herdem (DO-ESP-06 / B36). |
| Estado próprio anterior à exclusão | nativo | condicional | Preenchido enquanto `na lixeira`, com o Estado próprio que o Espaço tinha ao ser excluído (`ativo` ou `arquivado`). A restauração devolve o Espaço a esse estado (12.2; B36; INV-ESP-13). |
| Bloqueio por aspecto | objeto de valor | sim | Para cada aspecto configurável de B25 que o Espaço define (Conjunto de Status, Definições de Campo, Tipos de Tarefa, Funcionalidades habilitadas, Visualizações padrão, Automações), o indicador de bloqueio para os descendentes (RN-ESP-09; seção 16.2). Padrão: sem bloqueio. O Espaço não tem modo `herdado`/`sobrescrito` nesses aspectos: é o ponto de definição mais alto (RN-ESP-03). |
| Privado | nativo | sim | Booleano. `verdadeiro` interrompe a herança de permissões do Espaço de Trabalho (A9.2; seção 17). Padrão: `falso`. |
| Ordem | nativo | sim | Posição entre os Espaços do mesmo Espaço de Trabalho (DO-ESP-14). |
| Criador | referência (Membro) | sim | Imutável (A7). |
| Momento de criação | nativo | sim | Imutável. |
| Momento de arquivamento / de envio à lixeira | nativo | condicional | Preenchido no estado correspondente. |
| Previsão de eliminação | derivado | condicional | Momento de envio à lixeira + Política de lixeira do Espaço de Trabalho. |
| Criado a partir de | referência (Template) | não | Proveniência (A8). Sem vínculo vivo. |
| Funcionalidades habilitadas | objeto de valor | sim | Conjunto de indicadores por funcionalidade (seção 15.3). Sempre presente, com padrão da plataforma. |
| Visualizações padrão | objeto de valor | sim | Quais tipos de Visualização estão disponíveis e qual é a inicial nas Listas descendentes que herdam. |

Não são atributos do Espaço, embora sejam definidos nele: Conjunto de Status, Definições de Campo, Tipos de Tarefa, Automações, Visualizações salvas e concessões de permissão. São entidades de configuração contidas ou registros que o referenciam (seções 7 e 8). Poder configurá-los não os torna atributos.

## 7. Entidades internas ou componentes

Entidades internas são as que não existem fora do Espaço e cuja consistência o Espaço garante. Os conceitos transversais aqui referidos (Definição de Campo, Visualização, Template, Tag) estão definidos no Glossário; esta seção só registra o que é específico do Espaço.

### 7.1 Conjunto de Status do Espaço

Sequência ordenada de Definições de Status (A4.2), com ponto de definição no Espaço. É a única configuração cujo primeiro ponto de definição é **obrigatório** no Espaço: toda Lista precisa de exatamente um Conjunto aplicável, e a raiz da cadeia de substituição é o Espaço. Um Espaço recém-criado recebe o Conjunto de Status do Template usado ou, na ausência, o padrão da plataforma.

Regras mínimas (DO-ESP-03): o Conjunto contém ao menos uma Definição de categoria `não iniciado` e ao menos uma de categoria `fechado`. Justificativa: toda Tarefa nasce em um status, e o status inicial precisa ser interpretável como "ainda não começou" por Automações, Painéis e IA sem ler nomes (A4.3); todo fluxo precisa de um fim terminal para que "concluir" tenha significado uniforme. As categorias `em andamento` e `concluído` são opcionais: um fluxo "a fazer → feito" é válido. A primeira Definição de categoria `não iniciado`, na ordem do Conjunto, é o **status inicial padrão** das Tarefas criadas sem status explícito. Nenhuma Definição de Status existe fora de um Conjunto.

### 7.2 Definições de Campo Personalizado para Tarefas

Definições cujo ponto de definição é o Espaço (A5.2). Aplicam-se a todas as Tarefas de todas as Listas descendentes; **acumulam** com as definidas em Pastas, Subpastas e Listas (B25). O nome de cada Definição é único, sem distinção de maiúsculas e de espaços nas extremidades, em todo o caminho efetivo: criar no Espaço uma Definição cujo nome já exista em qualquer Pasta, Subpasta ou Lista descendente é inválido, assim como o inverso (DO-LIS-05; Glossário "Caminho efetivo"). O Valor de Campo pertence à Tarefa (A5.1); o Espaço só contém a Definição. Uma Definição do Espaço nunca se aplica a Tarefas de outro Espaço nem a Contatos, Negócios ou Conversas (cujas Definições são do Espaço de Trabalho, RN-ET-13).

### 7.3 Tipos de Tarefa

Classificações configuráveis (Glossário; C6) com ponto de definição no Espaço. Acumulam com as dos níveis inferiores (DO-ESP-11). Todo Espaço tem ao menos o tipo padrão "tarefa", fornecido pela plataforma e não removível, para que toda Tarefa tenha exatamente um tipo.

### 7.4 Visualizações do Espaço

Visualizações (A8) cujo contêiner é o Espaço apresentam a união das Tarefas das Listas descendentes ou a árvore de Pastas e Listas. Visualizações pessoais pertencem ao Membro, não ao Espaço. As **Visualizações padrão** (atributo, seção 6) são configuração herdável: definem quais tipos ficam disponíveis e qual é a inicial nas Listas descendentes.

### 7.5 O que não é componente

Automações de escopo Espaço pertencem ao Espaço de Trabalho (seção 8 do documento 01) e apenas **referenciam** o Espaço como escopo. Concessões de permissão vivem no Recurso, mas são relações, não componentes. Pastas e Listas são filhos estruturais com identidade e documento próprios, não entidades internas.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | ESP → ET | Exatamente um, imutável (A3.3). |
| contém Pastas | Pasta | contenção | ESP → Pasta | Filhos estruturais exclusivos. Cascata de estado efetivo e de eliminação. |
| contém Listas diretas | Lista | contenção | ESP → Lista | A3.1. Mesma natureza das Listas em Pasta; herdam diretamente do Espaço. |
| contém Conjunto de Status | Definição de Status | contenção | ESP → Definição | Configuração com identidade (seção 7.1). |
| contém Definições de Campo | Definição de Campo Personalizado | contenção | ESP → Definição | Só para entidade-alvo Tarefa (A5.2). |
| contém Tipos de Tarefa | Tipo de Tarefa | contenção | ESP → Tipo | Inclui o tipo padrão da plataforma. |
| contém Visualizações | Visualização | contenção | ESP → Visualização | Só as do contêiner; pessoais são do Membro. |
| é escopo de | Automação | referência | Automação → ESP | A Automação pertence ao Espaço de Trabalho e referencia o Espaço como escopo (B25: acumulam nos descendentes). |
| é Recurso de | Permissão | referência | Permissão → ESP | Concessões diretas e compartilhamentos com escopo `registro` ou `subárvore` (B29). |
| foi criado por | Ator | referência | ESP → Ator | Criador imutável (A7). Na prática é Membro: a criação de Espaço é ato de Membro com permissão de criar Espaços (12.1; seção 17). |
| foi criado a partir de | Template | referência (proveniência) | ESP → Template | Sem vínculo vivo (A8). |
| é Fonte de Dados de | Widget (Painel) | referência | Widget → ESP | "Tarefas do Espaço" como especificação de Fonte de Dados; referência, não cópia. |
| é Âncora de | Painel (de contexto) | referência | Painel → ESP | 0..N Painéis. Sem contenção, sem herança de permissão ou de estado; a Âncora acompanha a movimentação e sobrevive à eliminação como valor `eliminada` (DO-PAI-07). |
| é âncora de | Sessão de Chat | referência | Sessão → ESP | Um Espaço pode ser registro âncora (B21) para "converse sobre esta área". |
| é alvo de | Registro de Atividade | referência | Registro → ESP | Toda ação sobre o Espaço. |
| herda de | Espaço de Trabalho | herança | ET → ESP | Permissões de Papel (salvo privado), Tags, Localidade, Profundidade máxima, Política de lixeira, Automações de escopo Espaço de Trabalho (seção 16). |

Distinção aplicada: **CONTER** (Pastas, Listas diretas, Definições de Status, Definições de Campo, Tipos de Tarefa, Visualizações); **HERDAR** (do Espaço de Trabalho, seção 16); **CONFIGURAR** (Funcionalidades habilitadas, Visualizações padrão, Privado — objetos de valor e atributos); **REFERENCIAR / SER REFERENCIADO** (Template, Automação, Painel, Permissão, Sessão de Chat). O Espaço **não usa** nada (não invoca Modelos, Ferramentas nem Integrações) e **não se relaciona por Vínculo**: Vínculos ligam registros (Tarefa ↔ Negócio), não contêineres. "Tarefas deste Espaço vinculadas a Negócios" é uma consulta derivada, não uma relação do Espaço.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ESP → Espaço de Trabalho | 1 | não | não | pertencimento | A3.3. |
| ET → Espaço | 0..N | sim | sim | estrutural | A3.1; limite pelos Limites impostos (B34). |
| ESP → Pasta | 0..N | sim | sim | estrutural | Espaço só com Listas diretas é válido. |
| ESP → Lista direta | 0..N | sim | sim | estrutural | Espaço só com Pastas é válido. Espaço vazio é válido (seção 20.2). |
| ESP → Conjunto de Status | 1 | não | não | contenção | Raiz obrigatória da cadeia de substituição (DO-ESP-03). |
| Conjunto de Status → Definição de Status | 2..N | não | sim | contenção | Mínimo: uma `não iniciado` e uma `fechado` (DO-ESP-03). |
| ESP → Definição de Campo | 0..N | sim | sim | contenção | Campos são opcionais. |
| ESP → Tipo de Tarefa | 1..N | não | sim | contenção | O tipo padrão sempre existe. |
| ESP → Visualização do contêiner | 0..N | sim | sim | contenção | A apresentação padrão da plataforma não é Visualização salva. |
| Automação → Espaço (escopo) | 0..1 | sim | não | referência | Uma Automação tem exatamente um escopo, que pode ser um Espaço. |
| ESP ← Automação | 0..N | sim | sim | referência | |
| ESP ← Widget (Fonte de Dados) | 0..N | sim | sim | referência | |
| ESP ← Permissão (concessão) | 0..N | sim | sim | referência | Espaço não privado pode não ter nenhuma concessão (só herança). Espaço privado: ao menos uma `administrar` a Membro `ativo` (INV-ESP-06; B38). |
| ESP → Template (proveniência) | 0..1 | sim | não | referência | |
| ESP → Criador | 1 | não | não | referência | |
| ESP → Funcionalidades habilitadas, Visualizações padrão | 1 cada | não | não | objeto de valor | Sempre presentes com padrão da plataforma. |

Nenhuma cardinalidade desta seção carece de base; não há `DECISÃO NECESSÁRIA`.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Espaço de Trabalho → **Espaço** → { Pasta → { Subpasta → Lista } | Lista } | Lista. O Espaço é o único nível estrutural cujo pai é a raiz. Abaixo dele a profundidade máxima de agrupamento é dois (A3.4), de modo que uma Tarefa está a no máximo quatro níveis do Espaço de Trabalho (Espaço, Pasta, Subpasta, Lista).

**Pertencimento (teste de existência).** Pastas, Listas diretas, Definições de Status, Definições de Campo, Tipos de Tarefa e Visualizações do contêiner não existem sem o Espaço: são **dependentes** (contenção). Painéis, Templates e Sessões de Chat existem sem o Espaço: são **associações por referência** e sobrevivem à sua eliminação com a referência inválida (seção 12.4). Automações com escopo no Espaço são caso intermediário: pertencem ao Espaço de Trabalho e apenas referenciam o Espaço, mas o escopo lhes é essencial — ficam inoperantes enquanto o Espaço não está efetivamente `ativo` e são eliminadas com ele (B41). O Espaço não existe sem o Espaço de Trabalho.

**"Pertence a" versus "relaciona-se com".** Uma Lista *pertence* ao Espaço (ou a uma Pasta dele). Uma Automação *relaciona-se com* o Espaço (é o seu escopo). Um Negócio *não se relaciona* com o Espaço: relaciona-se com Tarefas que estão em Listas do Espaço.

**Propriedade.** O Espaço **não tem Proprietário** (DO-ESP-02). A7 lista os registros com Proprietário e o Espaço não está entre eles; a cadeia de responsabilidade do Espaço termina no Proprietário do Espaço de Trabalho, transitivamente. A governança operacional é exercida por quem tem a Ação `administrar` sobre o Espaço com escopo `subárvore` — o **Administrador de Espaço** —, que é uma concessão (B29), não um Papel, não um atributo e não um Proprietário. Justificativa: um Espaço pode ter vários administradores em pé de igualdade e pode ser administrado apenas por Administradores do Espaço de Trabalho; obrigar um único Proprietário criaria sucessão (B28) para uma entidade que não é registro de trabalho, mas contêiner.

**Configurar não é conter.** O Espaço configura Funcionalidades habilitadas (objeto de valor) e contém Definições de Status (entidades). A Automação é configurada com escopo no Espaço, mas pertence ao Espaço de Trabalho.

## 11. Estados

Todos os estados desta seção são **estados de sistema** (A4.1). O Espaço não tem Status (A4.2): Status é das Tarefas; o Espaço define o Conjunto que elas usam.

| Estado | Significado | O que é possível |
| --- | --- | --- |
| `ativo` | Operação normal. | Tudo, conforme permissão. |
| `arquivado` | Retirado da operação, íntegro e consultável. Descendentes ficam com estado efetivo `arquivado` (DO-ESP-06). | Ver; consultar por Painéis; comentar nas Tarefas descendentes (recomendação, para registro histórico); alterar permissões; restaurar; enviar à lixeira; alterar o estado próprio de descendentes e movê-los para fora (RN-ESP-11). Não: criar, editar conteúdo, alterar configuração, disparar Automações. |
| `na lixeira` | Excluído recuperável. Invisível na operação; conta o prazo da Política de lixeira. | Restaurar (dentro do prazo); eliminar permanentemente. Nada mais. |

**Estado efetivo** (DO-ESP-06 / B36): para Pastas, Subpastas, Listas e Tarefas, o estado efetivo é o mais restritivo entre o estado próprio e o estado efetivo do pai (`ativo` < `arquivado` < `na lixeira`). Arquivar o Espaço **não reescreve** o estado próprio dos descendentes: torna o estado efetivo deles `arquivado`. Restaurar o Espaço devolve a cada descendente o seu estado próprio — uma Lista arquivada individualmente antes do arquivamento do Espaço continua arquivada depois da restauração. Registros de Tempo em andamento em Tarefas descendentes são encerrados no ato em que deixam de ter estado efetivo `ativo` (B36). Para o próprio Espaço, estado efetivo e estado próprio coincidem, porque o Espaço de Trabalho não usa esses estados (DO-ET-08).

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Membro com permissão de criar Espaços (seção 17). Produz, atomicamente:

1. O Espaço em estado `ativo`, com Nome (sem colisão com Espaço irmão `ativo` ou `arquivado` — B39), Ordem (última posição), Privado conforme escolha (padrão `falso`).
2. Configuração inicial: se um Template de Espaço foi indicado, ou se o Espaço de Trabalho tem **Template de Espaço padrão** (DO-ESP-09), o Template é instanciado — Conjunto de Status, Definições de Campo, Tipos de Tarefa, Funcionalidades, Visualizações, Automações e árvore de Pastas e Listas são criados como entidades novas com proveniência. Sem Template: Conjunto de Status padrão da plataforma, tipo de Tarefa padrão, Funcionalidades e Visualizações padrão da plataforma, nenhuma Definição de Campo, nenhuma Pasta ou Lista.
3. Concessão de `administrar` com escopo `subárvore` ao Criador (RN-ESP-04).
4. Registro de Atividade "Espaço criado".

A criação é verificada contra o limite de Espaços dos Limites impostos (RN-ET-23).

### 12.2 Transições

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | Administrador de Espaço; Administrador ou Proprietário do Espaço de Trabalho | Estado efetivo dos descendentes passa a `arquivado` (estados próprios não são reescritos — B36). Registros de Tempo em andamento nas Tarefas descendentes são encerrados. Automações de escopo Espaço e de escopos descendentes ficam inoperantes (B41). Vínculos de Tarefas preservados, somente leitura (seção 20.8). Painéis continuam a consultar (DO-ESP-13). Registro de Atividade. |
| `arquivado` | `ativo` | Idem | Descendentes voltam ao estado próprio. Automações voltam a disparar a partir da restauração; eventos ocorridos durante o arquivamento não são reprocessados. |
| `ativo` ou `arquivado` | `na lixeira` | Idem, com confirmação (ação destrutiva) | Estado efetivo dos descendentes passa a `na lixeira`. Fontes de Dados de Painéis no Espaço passam a `indisponível` e a Âncora de Painel de contexto a `indisponível` (documento 21, 11.2 e 7.8). Automações de escopo Espaço ficam inoperantes. Vínculos preservados, invisíveis. Previsão de eliminação calculada. Registro de Atividade. |
| `na lixeira` | `ativo` ou `arquivado` (o Estado próprio anterior à exclusão) | Idem, dentro do prazo | Volta ao estado próprio que tinha ao ser excluído (B36): um Espaço arquivado enviado à lixeira volta `arquivado`. Descendentes voltam ao estado próprio. Fontes de Dados voltam a válidas. Colisão de nome com Espaço `ativo` ou `arquivado` exige renomear antes (B39). |
| `na lixeira` | eliminação permanente | Sistema, ao fim do prazo; ou Administrador de Espaço / Administrador do Espaço de Trabalho, antecipadamente, com confirmação | Não é estado: é o fim (12.4). |

Em Espaço privado, "Administrador ou Proprietário do Espaço de Trabalho" só opera com concessão direta ou por ato de governança registrado (RN-ESP-14, RN-ESP-16). Permissões: arquivar e desarquivar exigem `administrar`; enviar à lixeira e restaurar exigem `excluir`; eliminar antecipadamente exige `administrar` (17.1; B46). Não existe `ativo` → eliminação permanente sem passar pela lixeira (proteção contra exclusão acidental; a eliminação antecipada é sempre a partir de `na lixeira`).

### 12.3 Mudanças que não são transições de estado

- **Tornar privado / não privado.** Altera a origem das permissões efetivas de todos os descendentes (seção 17). Tornar privado exige que o ator seja um Membro `ativo` Administrador de Espaço (ou Administrador ou Proprietário do Espaço de Trabalho); Agentes, Automações e Sujeitos de base Convidado não tornam um Espaço privado, porque não podem receber `administrar` (RN-ESP-17). O ator recebe `administrar` por concessão direta no mesmo ato, o que garante INV-ESP-06 (B38). Responsáveis e Observadores de Tarefas descendentes que perdem `ver` são liberados no mesmo ato (documento de Tarefa, RN-TAR-06). Registro de Atividade.
- **Reordenar.** Altera Ordem deste e dos irmãos. Registro de Atividade.
- **Receber ou ceder Pasta/Lista** (movimentação entre Espaços). Operação atômica com resolução obrigatória de configuração (seção 20.6; DO-ESP-10 / B40).
- **Alterar configuração** (Conjunto de Status, Definições de Campo, Tipos, Funcionalidades, Visualizações padrão, bloqueios). Seções 13 e 15.

### 12.4 Eliminação permanente e cascata

Elimina, em cascata, tudo o que o Espaço contém: Pastas, Subpastas, Listas, Tarefas (com seus agregados: Checklists, Comentários, Registros de Tempo, Valores de Campo, Anexos como referências), Definições de Status, Definições de Campo, Tipos de Tarefa, Visualizações do contêiner e concessões sobre o Espaço e descendentes.

O que apenas referenciava o Espaço sobrevive com a referência resolvida como "eliminado" (DO-ESP-13):

| Referenciador | Efeito |
| --- | --- |
| Vínculo (Tarefa ↔ Negócio, Tarefa ↔ Contato) | Removido, porque um dos lados deixou de existir (A8). O Negócio permanece. |
| Automação com escopo no Espaço (ou em descendente) | **Eliminada com o Espaço** (B41): o escopo lhe é essencial. Execuções passadas preservadas (B18). Automações de outro escopo que referenciavam o Espaço ou descendentes como alvo de Ação sobrevivem com referência inválida; a Ação falha com Registro de Atividade. |
| Widget com Fonte de Dados no Espaço | Passa a `inválido` com causa "fonte eliminada"; permanece no Painel até edição humana (RN-PAI-20). |
| Painel de contexto ancorado ao Espaço | A Âncora passa a `eliminada` (identificador e nome à época como valor); o Painel permanece e o Proprietário é notificado (DO-PAI-07). |
| Template criado a partir do Espaço | Sobrevive intacto: Template é cópia de estrutura, não vínculo vivo (A8). |
| Espaço instanciado a partir de Template que foi eliminado | Idem, no sentido inverso: proveniência aponta para "Template eliminado". |
| Sessão de Chat ancorada | Sobrevive; âncora inválida. |
| Arquivo anexado a Tarefas do Espaço | O Arquivo pertence ao Espaço de Trabalho; só a referência (Anexo) é eliminada. |
| Registro de Atividade | Imutável e preservado (INV-ET-12). |

Nada fora do Espaço de Trabalho é afetado.

## 13. Regras de negócio ontológicas

- **RN-ESP-01.** Todo Espaço pertence a exatamente um Espaço de Trabalho, definido na criação e imutável. Não existe mover Espaço entre Espaços de Trabalho (A1.1, A3.3).
- **RN-ESP-02.** O Espaço contém apenas Pastas e Listas. Nunca contém Tarefas, Subpastas (só via Pasta), Contatos, Negócios, Agentes, Automações, Painéis ou Arquivos (A2.2, A3.1, A3.2).
- **RN-ESP-03.** O Espaço é o ponto de definição mais alto de Conjunto de Status, Definições de Campo para Tarefas, Tipos de Tarefa, Funcionalidades habilitadas, Visualizações padrão e Automações de escopo estrutural (A4.2, A5.2, B25). O Espaço de Trabalho não define nenhum desses aspectos (RN-ET-14).
- **RN-ESP-04.** O Criador do Espaço recebe, no ato de criação, `administrar` com escopo `subárvore`. É concessão revogável por outro Administrador de Espaço ou do Espaço de Trabalho, respeitada INV-ESP-06.
- **RN-ESP-05.** O Conjunto de Status do Espaço contém ao menos uma Definição de categoria `não iniciado` e uma de categoria `fechado`. A primeira `não iniciado` na ordem é o status inicial padrão (DO-ESP-03).
- **RN-ESP-06.** Remover uma Definição de Status do Conjunto, ou substituir o Conjunto, quando existem Tarefas em Listas que herdam esse Conjunto com status atual apontando para a Definição removida, exige um **mapeamento** da Definição removida para uma Definição do Conjunto resultante, informado pelo ator. O mapeamento é aplicado a todas as Tarefas afetadas no mesmo ato, e cada Tarefa registra o evento "status alterado por remapeamento" com ator delegante o Membro que alterou o Conjunto. Sem mapeamento, a alteração é inválida (DO-ESP-04). Tarefas em Listas com Conjunto `sobrescrito` não são afetadas.
- **RN-ESP-07.** Remover uma Definição de Campo do Espaço leva a Definição a `na lixeira`; os Valores de Campo das Tarefas descendentes deixam de ser visíveis e editáveis, mas são retidos até a eliminação permanente da Definição, quando são eliminados (A5.4). Restaurar a Definição restaura os Valores. O ato gera um Registro de Atividade na Definição com a contagem de Tarefas afetadas; o histórico de cada Tarefa deriva a informação desse Registro, sem Registro individual por Tarefa (DO-ESP-05).
- **RN-ESP-08.** Definições de Campo do Espaço acumulam com as dos níveis descendentes; Tipos de Tarefa acumulam; Automações acumulam; Conjunto de Status substitui; Funcionalidades habilitadas e Visualizações padrão substituem, aspecto a aspecto, pelo ponto de definição mais próximo (B25; DO-ESP-11).
- **RN-ESP-09.** Marcar um aspecto como `bloqueado` impede sobrescritas nos descendentes. Para aspectos que **substituem** (Conjunto de Status, Funcionalidades habilitadas, Visualizações padrão), o ato de bloquear é **rejeitado** enquanto houver sobrescritas do aspecto em descendentes, com a lista delas; o ator resolve cada uma explicitamente (remove a sobrescrita, com mapeamento se for Conjunto de Status) e então bloqueia. Para aspectos que **acumulam** (Definições de Campo, Tipos de Tarefa, Automações), bloquear impede a criação de definições novas nos descendentes e as já existentes permanecem: acumulação não substitui nada, logo não há sobrescrita a reverter. Mover um contêiner para sob o Espaço quando este bloqueia um aspecto que substitui e que o contêiner ou um descendente sobrescreve é igualmente rejeitado. Nunca há reversão silenciosa; bloquear nunca é destrutivo (DO-ESP-12 / B25; coerente com RN-ET-17).
- **RN-ESP-10.** Desabilitar uma Funcionalidade no Espaço oculta e impede novos usos nas Tarefas descendentes; não elimina dados existentes (Registros de Tempo, Dependências, estimativas, Regras de Recorrência, Subtarefas, Checklists). Reabilitar os torna visíveis de novo. Recorrência desabilitada suspende a geração de novas ocorrências (B6) enquanto desabilitada, sem retroação ao reabilitar.
- **RN-ESP-11.** O estado efetivo de todo descendente é o mais restritivo entre o próprio e o efetivo do pai. Sobre um registro cujo estado efetivo não é `ativo` são válidas apenas: ver e consultar; comentar nas Tarefas (recomendação); alterar permissões; restaurar o ancestral que o restringe; **alterar o estado próprio** do registro ou de um descendente (arquivar, desarquivar, enviar à lixeira) — o estado efetivo continua derivado, de modo que uma Lista arquivada individualmente sob Espaço arquivado permanece `arquivado` quando o Espaço é restaurado; restaurar de `na lixeira` apenas se o pai não está `na lixeira` (pai `arquivado` é aceito e o registro fica efetivamente `arquivado`); **mover para fora** um descendente cujo estado próprio não é `na lixeira`, para um destino efetivamente `ativo` (RN-ESP-19); e eliminar antecipadamente o que está `na lixeira` por estado próprio. Nenhuma criação, edição de conteúdo, alteração de configuração ou disparo de Automação (DO-ESP-06 / B36).
- **RN-ESP-12.** Um Espaço `arquivado` ou `na lixeira` não dispara Automações de nenhum escopo sobre seus descendentes; eventos ocorridos nesse período não são reprocessados na restauração.
- **RN-ESP-13.** Arquivar ou enviar à lixeira um Espaço nunca é bloqueado por Vínculos, Fontes de Dados, escopos de Automação ou proveniência de Templates que o referenciem. Referências sobrevivem conforme 12.4.
- **RN-ESP-14.** Um Espaço privado interrompe as origens "papel no Espaço de Trabalho" e "herança" para as Ações de conteúdo (ver, comentar, criar, editar, excluir) sobre si e sobre toda a subárvore, inclusive para Administradores e para o Proprietário do Espaço de Trabalho. Só concessão direta e compartilhamento valem (A9.2; B38). A existência e o nome de um Espaço privado não são visíveis a quem não tem `ver` sobre ele nem sobre algum descendente compartilhado (RN-ESP-15).
- **RN-ESP-15.** A privacidade é monotônica para baixo: nenhum descendente de um Espaço privado obtém, por herança, permissão que o Espaço não concede. Um descendente pode ser compartilhado diretamente com um Sujeito sem acesso ao Espaço; esse compartilhamento dá acesso ao descendente e à sua subárvore e expõe apenas os **nomes dos ancestrais** (Espaço › Pasta › Subpasta), para navegação — nunca o conteúdo dos ancestrais, os irmãos nem as demais Listas (DO-ESP-07 / B38).
- **RN-ESP-16.** Todo Espaço privado tem, em todo instante, ao menos um Membro `ativo` com `administrar` sobre ele; quem torna o Espaço privado recebe `administrar` no ato. Se a remoção ou a suspensão de um Membro deixaria o Espaço privado sem Membro `ativo` com `administrar`, a concessão passa (na remoção, exceção a B28) ou é também concedida (na suspensão) ao Sucessor, determinado como em B28, no mesmo ato. Além disso, o Proprietário e os Administradores do Espaço de Trabalho podem, como **ato de governança registrado** (Registro de Atividade com motivo, visível a quem tem acesso ao Espaço), conceder acesso — inclusive `administrar` — sobre um Espaço privado a um Membro `ativo`, inclusive a si mesmos (DO-ESP-08 / B38). Não há outra forma de acesso ao conteúdo de um Espaço privado.
- **RN-ESP-17.** `administrar` sobre um Espaço não é concedível a Sujeitos de Papel com base Convidado nem a Agentes. Agentes recebem no máximo ver, comentar, criar, editar e excluir sobre Espaços (B7, INV-ET-13 por analogia).
- **RN-ESP-18.** Criar Espaços decorre do Papel (Proprietário, Administrador) ou de concessão direta de `criar` sobre o Espaço de Trabalho a Membros ou Equipes de base Membro. Convidados e Agentes não criam Espaços (DO-ESP-15).
- **RN-ESP-19.** Mover uma Lista ou Pasta para outro Espaço é operação atômica que exige `administrar` sobre o contêiner movido e `criar` no contêiner de destino, que deve estar efetivamente `ativo`, e resolve no mesmo ato (DO-ESP-10 / B40): (a) Conjunto de Status, se herdado, por mapeamento por categoria para o Conjunto aplicável no destino (RN-ESP-06) ou, alternativamente e se o destino não bloqueia o aspecto, o contêiner movido passa a sobrescrever com uma cópia do Conjunto de origem, sem remapear Tarefas; um Conjunto `sobrescrito` acompanha o contêiner movido; (b) Valores de Campo de Definições que deixam de se aplicar passam a `arquivado` no agregado de cada Tarefa, preservados e reativáveis (B37); (c) Automações com escopo no contêiner movido (ou em descendente) e Definições próprias o acompanham; as do Espaço de origem deixam de se aplicar; (d) permissões, que passam a ser herdadas do novo pai, mantidas as concessões diretas, os compartilhamentos e a privacidade do contêiner movido; Responsáveis e Observadores que perdem `ver` são liberados; (e) Vínculos e Dependências das Tarefas permanecem. A movimentação é rejeitada se o Espaço de destino bloqueia um aspecto sobrescrito no contêiner movido ou em descendente (RN-ESP-09), se viola a profundidade (A3.4), se há colisão de nome do contêiner com irmão no destino (B39) ou se uma Definição de Campo própria do contêiner movido (ou de descendente) colide com uma Definição do novo caminho (DO-LIS-05). O estado efetivo de origem não impede a movimentação (RN-ESP-11).
- **RN-ESP-20.** Uma Automação com escopo no Espaço aplica-se estruturalmente a todas as Tarefas descendentes, inclusive em Listas privadas; sua efetividade sobre cada Tarefa é limitada pelas permissões com que executa (A6.3; documento 01, seção 17.1). Sem permissão de ver a Tarefa, o Gatilho não é considerado disparado para essa Tarefa e nada é registrado como falha; com permissão de ver mas não de editar, a Execução falha e é registrada (B23). Detalhamento no documento de Automações.
- **RN-ESP-21.** Toda ação sobre o Espaço e suas entidades internas gera Registro de Atividade com ator e, quando aplicável, ator delegante (A6.2).
- **RN-ESP-22.** Instanciar um Template de Espaço cria um Espaço novo com todas as entidades de configuração e a árvore de contêineres como registros novos, com proveniência; nunca reutiliza Definições de Status ou de Campo de outro Espaço. Permissões e privacidade não fazem parte do Template.
- **RN-ESP-23.** O nome do Espaço é obrigatório e único entre Espaços com estado próprio `ativo` ou `arquivado` do mesmo Espaço de Trabalho, sem distinção de maiúsculas e de espaços nas extremidades. Criar, renomear ou restaurar da lixeira com colisão é rejeitado até renomear (DO-ESP-16 / B39).

## 14. Invariantes

- **INV-ESP-01.** Todo Espaço tem exatamente um Espaço de Trabalho, imutável.
- **INV-ESP-02.** Nenhuma Tarefa tem o Espaço como pai direto; toda Tarefa raiz está em uma Lista cujo caminho de contêineres termina em exatamente um Espaço.
- **INV-ESP-03.** Todo Espaço tem exatamente um Conjunto de Status próprio, com ao menos uma Definição `não iniciado` e uma `fechado`.
- **INV-ESP-04.** Toda Tarefa em Lista descendente tem status atual apontando para uma Definição do Conjunto aplicável à sua Lista. Nenhuma alteração de Conjunto deixa Tarefa com status inexistente.
- **INV-ESP-05.** Todo Valor de Campo `ativo` de Tarefa descendente tem uma Definição aplicável `ativo` no Caminho efetivo da Lista; os demais Valores estão retidos sob uma Definição `na lixeira` (A5.4) ou `arquivado` por movimentação (B37).
- **INV-ESP-06.** Todo Espaço privado tem ao menos um Membro `ativo` com `administrar` sobre ele (B38).
- **INV-ESP-07.** O estado efetivo de um descendente nunca é menos restritivo que o estado efetivo do Espaço.
- **INV-ESP-08.** Nenhuma Definição de Status, Definição de Campo, Tipo de Tarefa ou Visualização do contêiner existe sem o seu Espaço.
- **INV-ESP-09.** Nenhum Agente e nenhum Sujeito de base Convidado detém `administrar` sobre um Espaço.
- **INV-ESP-10.** Todo Espaço tem ao menos um Tipo de Tarefa (o padrão da plataforma).
- **INV-ESP-11.** As Ordens dos Espaços de um Espaço de Trabalho são únicas entre si.
- **INV-ESP-12.** Não existem dois Espaços com estado próprio `ativo` ou `arquivado` e o mesmo nome no mesmo Espaço de Trabalho (B39).
- **INV-ESP-13.** Estado próprio anterior à exclusão está preenchido se e somente se o Estado próprio é `na lixeira`, e vale `ativo` ou `arquivado`.

## 15. Personalização

### 15.1 Personalizável no Espaço

Por Administrador de Espaço ou do Espaço de Trabalho, salvo indicação:

- Nome, Descrição, Ícone, Cor, Ordem, Privado.
- Conjunto de Status (Definições: nome, cor, categoria, ordem) e seu bloqueio para descendentes.
- Definições de Campo para Tarefas e seu bloqueio.
- Tipos de Tarefa e seu bloqueio.
- Funcionalidades habilitadas (15.3) e seu bloqueio.
- Visualizações padrão e Visualizações do contêiner.
- Automações de escopo Espaço (documento de Automações).
- Concessões de permissão sobre o Espaço (seção 17).

### 15.2 Não personalizável

Identificador, Espaço de Trabalho, Criador, momento de criação; estados e transições; as quatro categorias de status (A4.3); a existência do tipo de Tarefa padrão; a profundidade máxima (A3.4); a Política de lixeira e a Localidade (do Espaço de Trabalho); Tags (do Espaço de Trabalho, B5).

Não há Campos Personalizados sobre o próprio Espaço: A5.2 restringe Definições a Tarefa e às entidades do CRM. "Centro de custo do Espaço" ou "responsável de área" são pendências análogas a C13 (seção 25).

### 15.3 Funcionalidades habilitadas

Objeto de valor com um indicador por funcionalidade de Tarefa: prioridade, registro de tempo, estimativa, dependências, recorrência, subtarefas, checklists, compartilhamento público, entre outras que o documento de Tarefa enumera. A lista é da plataforma e pode crescer; a ontologia exige apenas que cada funcionalidade tenha um ponto de definição e modo (B25). Desabilitar não destrói (RN-ESP-10). Funcionalidades não incluem Tags nem Comentários, que não são desabilitáveis por Espaço nesta versão.

### 15.4 Templates

- **Template de Espaço**: registro do Espaço de Trabalho (A8; DO-ET-13) que armazena Nome sugerido, Ícone, Cor, Descrição, Conjunto de Status, Definições de Campo, Tipos de Tarefa, Funcionalidades, Visualizações padrão e do contêiner, Automações de escopo Espaço e descendentes, e a árvore de Pastas, Subpastas e Listas com as configurações de cada uma. Opcionalmente, Tarefas de exemplo. **Não** armazena: Privado, concessões, Ordem, Vínculos, Registros de Atividade, Arquivos.
- **Criar Template a partir de um Espaço**: copia; o Espaço não fica ligado ao Template.
- **Template de Espaço padrão** (DO-ESP-09): atributo opcional do Espaço de Trabalho que referencia um Template de Espaço, usado quando um Espaço é criado sem Template explícito. Se o Template referenciado for eliminado, o atributo é limpo e Espaços novos partem do padrão da plataforma. Aplica a recomendação do documento 01 (seção 16) sem criar configuração nova.

## 16. Herança

O Espaço **herda do Espaço de Trabalho** e **é origem de herança** para Pastas, Subpastas e Listas (B25).

### 16.1 O que o Espaço herda (sem poder sobrescrever)

| Aspecto | Origem | Modo no Espaço |
| --- | --- | --- |
| Permissões de Papel | Espaço de Trabalho | `herdado`; interrompido se Privado (A9.2). |
| Tags | Espaço de Trabalho | `herdado`; não sobrescritível (B5). |
| Localidade, Política de lixeira, Profundidade máxima de Subtarefas | Espaço de Trabalho | `herdado`; não sobrescritível (documento 01, seção 16). |
| Automações de escopo Espaço de Trabalho | Espaço de Trabalho | `herdado`; acumulam com as do Espaço. |

### 16.2 O que o Espaço define e transmite

| Aspecto | Ponto de definição | Modo nos descendentes | Acumula ou substitui |
| --- | --- | --- | --- |
| Conjunto de Status | Espaço (obrigatório) | `herdado` (padrão), `sobrescrito`, `bloqueado` | substitui: só um por Lista |
| Definições de Campo para Tarefas | Espaço (opcional) | idem; bloqueio impede Definições novas abaixo, as existentes permanecem (RN-ESP-09) | acumula |
| Tipos de Tarefa | Espaço (o padrão é obrigatório) | idem; bloqueio como Definições de Campo | acumula (DO-ESP-11) |
| Funcionalidades habilitadas | Espaço (obrigatório) | idem, por funcionalidade | substitui por aspecto (DO-ESP-11) |
| Visualizações padrão | Espaço (obrigatório) | idem | substitui (DO-ESP-11) |
| Automações de escopo Espaço | Espaço (opcional) | `herdado`; descendentes acrescentam, não removem | acumula |
| Permissões | Espaço | `herdado`; Pasta ou Lista privada interrompe de novo | união (documento 01, 17.1) |

**Modo `herdado`** significa que o descendente aponta para o ponto de definição do ancestral mais próximo e acompanha as suas alterações. **`sobrescrito`** significa que o descendente tem definição própria e deixa de acompanhar. **`bloqueado`** é declarado no ponto de definição e impede que descendentes passem a `sobrescrito` (RN-ESP-09). Tarefa nunca define nada: consome a configuração resolvida na sua Lista (B25).

## 17. Permissões e visibilidade

### 17.1 O Espaço como Recurso

| Ação | Significado sobre o Espaço | Escopo `registro` | Escopo `subárvore` |
| --- | --- | --- | --- |
| ver | Saber que existe, ler atributos e configuração | Só o Espaço (nome, ícone, configuração), sem descendentes | Espaço e toda a subárvore, inclusive Tarefas |
| comentar | Não se aplica: o Espaço não recebe Comentários (A8) | — | Comentar nas Tarefas descendentes |
| criar | Criar Pastas e Listas diretas | Só filhos diretos | Criar em qualquer nível, inclusive Tarefas |
| editar | Alterar Nome, Descrição, Ícone, Cor | Só o Espaço | Editar qualquer descendente |
| excluir | Enviar o Espaço à lixeira e restaurá-lo da lixeira | Só o Espaço (cascata efetiva inevitável) | Excluir e restaurar descendentes |
| administrar | Configurar (status, campos, tipos, funcionalidades, visualizações, bloqueios), tornar privado, conceder e revogar permissões, arquivar, restaurar, reordenar, mover contêineres, eliminar antecipadamente | — | Sempre `subárvore` (DO-ESP-02): o Administrador de Espaço administra tudo abaixo |
| executar | Não se aplica | — | — |

Concessões sobre o Espaço têm escopo `subárvore` por padrão; `registro` é o caso raro ("veja que a área existe, sem ver o trabalho"). O escopo `próprios` (B29) não se aplica a contêineres; aplica-se a Tarefas ("ver só Tarefas de que é Responsável") e é concedido tendo o Espaço como Recurso com escopo `subárvore` combinado à restrição `próprios` sobre o tipo Tarefa — detalhamento no documento de Tarefa.

### 17.2 Origem e herança

| Situação | Origens que valem sobre o Espaço e subárvore |
| --- | --- |
| Espaço não privado | Papel no Espaço de Trabalho + herança + concessão direta + compartilhamento (união). Membro (Papel de sistema) vê, comenta, cria e edita por padrão (documento 01, 17.2); Convidado nada por Papel. |
| Espaço privado | Só concessão direta e compartilhamento, para as Ações de conteúdo (RN-ESP-14; B38). Proprietário e Administradores do Espaço de Trabalho não veem o conteúdo por Papel; podem conceder acesso (inclusive `administrar`, inclusive a si mesmos) como ato de governança registrado (RN-ESP-16), visível a todos que têm acesso ao Espaço. Exportação total pelo Proprietário (documento 01, 17.2) alcança Espaços privados. |
| Pasta ou Lista privada dentro de Espaço não privado | Interrompe de novo a herança no seu nível, inclusive para o Administrador de Espaço sem concessão direta nela (B38: a privacidade é a mesma em todo nível). Quem a privatiza recebe `administrar` no ato; o Administrador de Espaço obtém acesso por concessão de quem a administra ou, se for Administrador ou Proprietário do Espaço de Trabalho, por ato de governança registrado. |
| Lista compartilhada dentro de Espaço privado | O Sujeito vê a Lista e sua subárvore e os nomes dos ancestrais para navegação; não vê o conteúdo do Espaço nem as demais Listas (RN-ESP-15). |

### 17.3 Papéis de sistema e o Espaço

| Ação | Proprietário do ET | Administrador do ET | Membro | Convidado |
| --- | --- | --- | --- | --- |
| Criar Espaço | sim | sim | só por concessão direta (RN-ESP-18) | não |
| Ver / criar / editar em Espaço não privado | sim | sim | sim (padrão) | só por compartilhamento |
| Ver conteúdo de Espaço privado | só por concessão (pode autoconceder por ato de governança registrado, RN-ESP-16) | idem | só por concessão | só por compartilhamento |
| Administrar Espaço não privado | sim (Papel) | sim (Papel) | só como Administrador de Espaço | não |
| Administrar Espaço privado | por concessão; pode autoconceder por ato de governança registrado (RN-ESP-16) | idem | só como Administrador de Espaço | não |
| Eliminar permanentemente antes do prazo | sim | sim | só como Administrador de Espaço | não |

### 17.4 IA sujeita às mesmas regras

Um Agente é Sujeito com Papel próprio e concessões (documento 01, 17.3). Em Espaço privado, o Agente só age com concessão direta ao próprio Agente; invocado em nome de um Membro com acesso, a permissão efetiva é a interseção (A9.3) — e é vazia se o Agente não tem concessão própria (seção 20.10). Automações seguem RN-ESP-20. Painéis filtram pelo visualizador (B20): um Painel com Fonte de Dados em Espaço privado aparece vazio para quem não tem acesso ao Espaço.

### 17.5 Exceções

Nenhuma além das descritas: ato de governança registrado sobre Espaço privado (RN-ESP-16 / B38), sucessão da concessão `administrar` (B28) e exportação total (documento 01). Não existe "superusuário" que veja Espaços privados silenciosamente.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Espaço criado | 12.1 | identificador, Nome, Privado, Template de origem, Criador | Auditoria; Limites (contagem); Painéis; Automações de escopo Espaço de Trabalho |
| Espaço alterado | Nome, Descrição, Ícone, Cor | aspecto, antes, depois, ator | Auditoria |
| Espaço reordenado | Ordem | ordens antes e depois | Apresentação |
| Espaço tornado privado / não privado | 12.3 | ator, momento | Reavaliação de permissões (B23); Painéis; Agentes |
| Espaço arquivado / restaurado | 12.2 | ator, momento, contagem de descendentes afetados | Automações (parar/retomar); Painéis; Vínculos (somente leitura) |
| Espaço enviado à lixeira / restaurado da lixeira | 12.2 | ator, previsão de eliminação; na restauração, Estado próprio anterior à exclusão | Painéis (fonte indisponível); Automações; Limites |
| Espaço eliminado | 12.4 | identificador, momento, ator ou Sistema | Vínculos (remoção); Automações (escopo inválido); Painéis (fonte eliminada); Templates (proveniência) |
| Conjunto de Status alterado | Inclusão, remoção, reordenação, recategorização de Definição; substituição | Definições antes e depois, mapeamento aplicado, contagem de Tarefas remapeadas | Tarefas (remapeamento); Automações por status; Painéis por categoria |
| Definição de Campo criada / alterada / removida / restaurada | 7.2 | Definição, Tipo de Campo, contagem de Tarefas afetadas | Tarefas (Valores); Painéis; Visualizações; Agentes (Ferramentas de leitura) |
| Tipo de Tarefa criado / alterado / removido | 7.3 | Tipo, Tipo de destino das Tarefas na remoção | Tarefas; IA (semântica) |
| Funcionalidade habilitada / desabilitada | 15.3 | funcionalidade, antes, depois | Tarefas (visibilidade de dados); Automações que dependem da funcionalidade |
| Aspecto bloqueado / desbloqueado; bloqueio rejeitado | RN-ESP-09 | aspecto; na rejeição, sobrescritas descendentes listadas | Pastas e Listas |
| Permissão concedida / revogada sobre o Espaço | 17 | Sujeito, Ação, Escopo, ator; "governança" com motivo quando RN-ESP-16 | Auditoria; Execuções em curso (B23); Painéis |
| Pasta ou Lista movida para / de o Espaço | RN-ESP-19 | contêiner, origem, destino, mapeamentos aplicados, Valores arquivados | Tarefas; Automações; Painéis; permissões |
| Template criado a partir do Espaço / Espaço instanciado de Template | 15.4 | Template, Espaço, ator | Auditoria |

Todos geram Registro de Atividade com o Espaço (ou a entidade interna) como objeto. Eventos que alteram Tarefas em massa (remapeamento, mover) registram o ator delegante nas Tarefas conforme RN-ESP-06 e um Registro agregado no Espaço conforme RN-ESP-07.

## 19. Dependências

**O Espaço depende de:** Espaço de Trabalho (pai, Limites, Política de lixeira, Localidade); Tipos de Campo (global, para Definições de Campo); categorias de status da plataforma (A4.3); tipo de Tarefa padrão e Conjunto de Status padrão fornecidos pela plataforma; Membro Criador.

**Dependem do Espaço:** Pastas, Subpastas, Listas e, transitivamente, Tarefas; Definições de Status, Definições de Campo, Tipos de Tarefa, Visualizações do contêiner.

**Referenciam o Espaço sem depender dele:** Widgets (Fonte de Dados), Templates (proveniência), Sessões de Chat (âncora), Permissões (Recurso), Registros de Atividade. Automações com escopo no Espaço o referenciam e são eliminadas com ele (B41).

**Documentos condicionados por este:** Pasta (03) e Subpasta (04) herdam o modelo de herança e o estado efetivo; Lista (05) recebe a obrigação de ter exatamente um Conjunto aplicável e as regras de movimentação; Tarefa (06) recebe status inicial padrão, remapeamento e retenção de Valores; Automações (19) recebe RN-ESP-20 e o destino de Automação com escopo eliminado; Painéis (21) recebe DO-ESP-13; o documento 01 recebe o atributo Template de Espaço padrão.

## 20. Casos limítrofes e ambiguidades

### 20.1 Lista diretamente no Espaço convivendo com Pastas

Válido (A3.1). A Lista direta herda do Espaço com um nível a menos; é operacionalmente idêntica a uma Lista em Pasta. Ordenação: Pastas são ordenadas entre Pastas e Listas diretas entre Listas diretas (irmãos do mesmo tipo); a apresentação conjunta é decisão de produto, não ontológica. Converter uma Lista direta em Lista de Pasta é uma movimentação dentro do mesmo Espaço: sem Mapeamento de status (o Conjunto aplicável continua sendo o do Espaço, salvo Pasta com Conjunto `sobrescrito`, caso em que RN-ESP-06 se aplica).

### 20.2 Espaço sem nenhum conteúdo

Válido. Existe com identidade, configuração completa (Conjunto de Status, tipo padrão, Funcionalidades, Visualizações padrão), Ordem e permissões. Pode ser privado, arquivado, transformado em Template (Template só de configuração) e eliminado. Um Espaço de Trabalho que usa a plataforma só como CRM pode ter zero Espaços; um Espaço criado "para depois" é o caso equivalente um nível abaixo.

### 20.3 Espaço privado com Lista "pública" dentro

Não existe "pública" como propriedade que amplie acesso: público é apenas "não privado", isto é, "herda". Uma Lista não privada dentro de um Espaço privado herda as permissões efetivas do Espaço — as concessões — e nada mais (RN-ESP-15). Ela não fica visível ao Papel Membro do Espaço de Trabalho. Para dar acesso a alguém sem acesso ao Espaço, a Lista é **compartilhada** diretamente com o Sujeito: ele passa a ver a Lista e suas Tarefas e os nomes do caminho (Espaço › Pasta), sem ver o conteúdo do Espaço nem as demais Listas (B38). Justificativa: a privacidade do Espaço é uma decisão de quem administra a área; um filho não pode desfazê-la por herança, mas um compartilhamento explícito é uma decisão registrada e granular.

### 20.4 Conjunto de Status alterado no Espaço com Tarefas em status que deixa de existir

Aplicação de RN-ESP-06. O ator remove "Em revisão" do Conjunto do Espaço; 340 Tarefas em 12 Listas com Conjunto `herdado` estão nesse status; 2 Listas com Conjunto `sobrescrito` têm "Em revisão" próprio e não são afetadas. A alteração só é válida com um mapeamento ("Em revisão" → "Em andamento", por exemplo). As 340 Tarefas mudam de status no mesmo ato, cada uma com Registro "status alterado por remapeamento" (ator: Sistema; ator delegante: quem alterou). Automações com Gatilho "status alterado" **disparam** para cada Tarefa remapeada? Recomendação: **não** — o remapeamento é mudança de configuração, não de trabalho, e disparar 340 Automações ("notificar responsável quando entra em Em andamento") seria ruído. O evento emitido é "status alterado por remapeamento", distinto de "status alterado", e Gatilhos podem escutá-lo explicitamente. Recategorizar uma Definição (de `em andamento` para `concluído`, por exemplo) não exige mapeamento, mas altera a leitura de Painéis e Automações por categoria e gera evento.

### 20.5 Definição de Campo do Espaço removida com Valores em milhares de Tarefas

Aplicação de RN-ESP-07. A Definição vai a `na lixeira`; 8.000 Valores ficam retidos e invisíveis; um único Registro de Atividade na Definição registra a contagem. Restaurar dentro do prazo devolve tudo. Eliminação permanente elimina os 8.000 Valores. Justificativa de um Registro agregado em vez de 8.000: A6.2 exige que a ação relevante seja registrada; a ação foi uma (sobre a Definição), e o histórico de cada Tarefa pode derivar "o campo X deixou de se aplicar em tal momento" do Registro da Definição. Se o ator quiser preservar os dados, o caminho é converter antes: criar Definição nova de tipo compatível e copiar Valores é operação de produto, não ontológica. Widgets de Painel que usavam a Definição como Métrica, Dimensão ou Filtro ficam `inválido` enquanto ela estiver `na lixeira` e voltam a `válido`, sem ato, na restauração (RN-PAI-20); Visualizações perdem a coluna correspondente no mesmo intervalo.

### 20.6 Mover Lista de um Espaço para outro com Conjuntos de Status e Campos diferentes

Aplicação de RN-ESP-19 (DO-ESP-10 / B40). Lista "Onboarding" sai do Espaço "Vendas" (Conjunto `herdado`, Definições "Valor do contrato" e "Segmento") para o Espaço "Sucesso do cliente" (Conjunto próprio; Definição "Segmento" com o mesmo Tipo de Campo, sem "Valor do contrato"). O ato exige mapeamento, por categoria, de cada Definição de Status de "Vendas" para uma de "Sucesso do cliente" (aplicado às Tarefas da Lista). Os Valores de "Valor do contrato" e de "Segmento" (de "Vendas") passam a `arquivado` no agregado de cada Tarefa (B37): a Definição "Segmento" de "Sucesso do cliente" é outra Definição, ainda que homônima, e começa vazia; copiar os valores arquivados para ela é operação de produto, não ontológica. Se a Lista tinha Conjunto `sobrescrito`, ela o leva consigo; se o destino bloqueia o aspecto, a movimentação é rejeitada até que a sobrescrita seja resolvida (RN-ESP-09). Automações da própria Lista a acompanham; Automações de "Vendas" deixam de se aplicar; as de "Sucesso do cliente" passam a se aplicar dali em diante. Vínculos das Tarefas não mudam. Painéis com Fonte de Dados "Tarefas do Espaço Vendas" deixam de incluir a Lista (derivado). Se "Sucesso do cliente" é privado e "Vendas" não, o ator precisa de `administrar` na Lista e `criar` no destino, e as Tarefas passam a invisíveis a quem só tinha acesso por Papel; Responsáveis que perdem `ver` são liberados.

### 20.7 Automação do Espaço agindo sobre Tarefa de Lista privada

Aplicação de RN-ESP-20. A Automação "ao mudar para Concluído, notificar o Criador", escopo Espaço "Operações", executa com as suas permissões próprias, limitadas pelo teto do Proprietário (próprias ∩ Proprietário atual — DO-AUT-01; B88; documento 01, 17.1). A Lista "Demissões" é privada e a Automação não tem concessão sobre ela (nem a teria por herança: o Proprietário também não tem acesso). Uma Tarefa dessa Lista muda para "Concluído": para a Automação, o evento não é visível; nada dispara, nada falha, nada é registrado na Automação. Se a Automação tem `ver` mas não `editar` na Lista (por concessão própria dentro do teto), uma Ação que edita falha, a Execução passa a `falhou` e o evento é registrado (B23). A Automação **não** ganha acesso por estar "acima" na estrutura: escopo é alcance estrutural; permissão é outra coisa (A6.3). A decisão de que "Gatilho não visível não dispara" evita que Automações se tornem canal de vazamento por efeitos colaterais (notificações revelando existência de Tarefas privadas).

### 20.8 Espaço arquivado com Tarefas vinculadas a Negócios ativos

Arquivar não é bloqueado (RN-ESP-13). As Tarefas ficam com estado efetivo `arquivado`; os Vínculos permanecem e o Negócio continua a exibi-los, marcados como arquivados e somente leitura. Automações de Negócio que criam ou editam Tarefas nessas Listas falham (Lista com estado efetivo `arquivado` não aceita criação — RN-ESP-11) e registram. Painéis de Negócio que contam "Tarefas abertas vinculadas" excluem as arquivadas por padrão. Se o Espaço for eliminado, os Vínculos são removidos e o Negócio perde a referência, preservado o Registro de Atividade do Vínculo. Justificativa: bloquear o arquivamento por Vínculos tornaria impossível encerrar uma área com histórico comercial, que é justamente o caso mais comum.

### 20.9 Espaço arquivado versus Espaço privado

São ortogonais: arquivado é estado (ninguém opera), privado é acesso (só alguns operam). Um Espaço arquivado e privado é consultável só por quem tem concessão; um Espaço arquivado e não privado é consultável por quem o Papel permite. Arquivar não altera permissões; tornar privado não altera estado.

### 20.10 Agente com permissão no Espaço de Trabalho, mas não no Espaço privado

O Agente tem Papel Membro e por isso vê Espaços não privados. No Espaço privado "Diretoria", a origem "papel" está interrompida (RN-ESP-14). (a) **Execução autônoma**: o Agente não vê o Espaço nem suas Tarefas; Ferramentas de busca não retornam nada dele; não há erro, há ausência. (b) **Em nome de um Membro que tem acesso**: permissão efetiva = interseção (A9.3) = vazia para esse Espaço; o Agente responde que não encontrou (ou que não tem acesso, conforme política do documento de Agentes), sem revelar conteúdo. Para que o Agente opere em "Diretoria", um Administrador de Espaço concede ao Agente uma permissão direta (nunca `administrar`, INV-ESP-09). Isso é intencional: um Agente compartilhado por toda a organização não deve, ao ser invocado por um diretor, tornar-se porta para o conteúdo da diretoria, porque sua Memória (Glossário) e seus resultados podem alcançar outros Membros.

### 20.11 Painel cuja Fonte de Dados é um Espaço arquivado

Aplicação de DO-ESP-13. A Fonte de Dados permanece válida: o Widget continua a calcular sobre as Tarefas do Espaço, agora todas com estado efetivo `arquivado`, e o Painel indica que a fonte está arquivada. Justificativa: relatórios históricos ("quanto entregamos no projeto encerrado") são uso legítimo, e arquivar existe para tirar da operação sem perder consulta. Se o Espaço vai à lixeira, a Fonte de Dados passa a `indisponível` (Widget vazio, com indicação "fonte indisponível"); restaurar a devolve a `disponível`. Se é eliminado, os Widgets com Fonte no Espaço passam a `inválido` ("fonte eliminada") e permanecem no Painel até edição humana (RN-PAI-20); a Âncora de um Painel de contexto ancorado ao Espaço passa a `eliminada` e o Painel permanece (DO-PAI-07). B20 continua a valer: o visualizador só vê o que suas permissões sobre o Espaço arquivado permitem.

### 20.12 Criador do Espaço removido do Espaço de Trabalho

Criador é imutável e permanece apontando para o Membro `removido` (A6.4). Sua concessão `administrar` é revogada (RN-ET-09). Se o Espaço é privado e ele era o único Membro `ativo` com `administrar`, a concessão passa ao Sucessor no mesmo ato (RN-ESP-16; exceção de B28 registrada em B38). Se não é privado, o Espaço continua administrável por Administradores do Espaço de Trabalho; ninguém "herda" a autoria.

### 20.13 Bloquear Conjunto de Status com Listas já sobrescritas

Aplicação de RN-ESP-09 (B25). O ato de bloquear é rejeitado; as 3 Listas com Conjunto próprio são listadas ao ator; ele reverte cada uma explicitamente (com mapeamento) e então bloqueia. Nada é revertido automaticamente. Alternativas rejeitadas: reverter em massa (uma mudança de configuração não deve alterar milhares de Tarefas sem decisão explícita por Lista) e bloquear "para o futuro" mantendo as sobrescritas (o bloqueio deixaria de ser verificável: um invariante "nenhum descendente sobrescreve aspecto bloqueado" teria exceções históricas).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Tarefas | Lista | A3.2. "Tarefas do Espaço" é união derivada. |
| Subpastas | Pasta | A3.1. O Espaço só tem Pastas e Listas diretas. |
| Tags | Espaço de Trabalho | B5. Mesmo que uma Tag seja usada só em um Espaço. |
| Definições de Campo de Contato, Empresa, Negócio, Conversa | Espaço de Trabalho | A5.2, RN-ET-13. |
| Valores de Campo | Tarefa | A5.1. O Espaço contém a Definição. |
| Status atual | Tarefa | A4.2. O Espaço contém o Conjunto. |
| Automações de escopo Espaço | Espaço de Trabalho | Documento 01, seção 8; o Espaço é escopo referenciado. Execuções pertencem à Automação (B18). |
| Membros, Equipes, Papéis | Espaço de Trabalho | O Espaço tem Sujeitos com permissão, não membros. |
| Proprietário | Não existe para o Espaço | A7; DO-ESP-02. Governança por `administrar`. |
| Negócios, Contatos, Empresas, Conversas | Espaço de Trabalho (CRM) | A2.2. Relação com o Espaço só por Vínculo de Tarefas. |
| Agentes, Habilidades, Coleções | Espaço de Trabalho (IA) | A2.2. |
| Painéis, Widgets | Painel / Espaço de Trabalho | O Espaço é Fonte de Dados referenciada. |
| Visualizações pessoais | Membro | A8. |
| Ordem pessoal e favoritos | Membro | Preferência de apresentação (DO-ESP-14). |
| Templates de Espaço | Espaço de Trabalho | DO-ET-13. O Espaço é origem ou produto, nunca os possui. |
| Arquivos anexados | Espaço de Trabalho | A8; Anexo é referência da Tarefa. |
| Comentários | Tarefa (e outros registros) | O Espaço não recebe Comentários (A8). |
| Profundidade máxima, Localidade, Política de lixeira | Espaço de Trabalho | B34. |
| Categorias de status | Plataforma | A4.3. |
| Limite de Espaços | Limites impostos (plataforma) | B34. |

## 22. Exemplos conceituais

**Exemplo 1 — Clínica com duas unidades (continuação do documento 01).** "Unidade Centro" e "Unidade Norte" são dois Espaços do mesmo Espaço de Trabalho. Cada um tem Conjunto de Status "Agendado → Em atendimento → Concluído → Faturado (fechado)", criados a partir do Template de Espaço "Unidade clínica", que é o Template de Espaço padrão do Espaço de Trabalho. As Definições "Convênio" (seleção) são duas, uma por Espaço, com o mesmo nome. A Tag "Convênio" é uma só (do Espaço de Trabalho). Um Painel "Faturamento por unidade" tem dois Widgets, um por Espaço; um Painel "Faturamento total" precisa de Fonte de Dados "Tarefas dos Espaços Centro e Norte" e não pode agrupar pela Definição "Convênio", porque são duas Definições distintas (seção 25, questão 1).

**Exemplo 2 — Espaço privado de RH.** O Espaço "Pessoas" é privado. Têm acesso a Equipe "RH" (ver, criar, editar, `subárvore`) e a Administradora Maria (`administrar`). A Lista "Vagas abertas" é compartilhada com a Equipe "Gestores" (ver, comentar): gestores veem as vagas e o nome "Pessoas" no caminho, mas não o conteúdo de "Pessoas" nem a Lista "Desligamentos". O Assistente padrão, perguntado por um gestor sobre desligamentos, não encontra nada (interseção vazia). Maria sai da empresa; Pedro, que a removeu, é o Sucessor e recebe `administrar` sobre "Pessoas" no mesmo ato (RN-ESP-16).

**Exemplo 3 — Reestruturação de fluxo.** O Espaço "Suporte" troca "Em análise" por dois status, "Triagem" e "Investigação". O ator mapeia "Em análise" → "Triagem"; 520 Tarefas em 9 Listas herdadas mudam no ato, com Registro individual; a Lista "Incidentes críticos", com Conjunto sobrescrito, não muda. A Automação "ao entrar em Em análise, atribuir a plantonista" fica com referência a Definição inexistente e é sinalizada como inválida (comportamento definido no documento de Automações).

**Exemplo 4 — Encerramento de projeto.** O Espaço "Obra Rua A" é arquivado após a entrega. Suas 1.200 Tarefas ficam consultáveis; 40 delas vinculadas ao Negócio "Contrato Rua A" (ganho) continuam listadas no Negócio como arquivadas. O Painel "Histórico de obras" segue usando o Espaço como Fonte de Dados. Dois anos depois, o Espaço vai à lixeira e é eliminado: os 40 Vínculos são removidos, os Widgets do Painel sobre o Espaço ficam `inválido` (o Painel permanece — RN-PAI-20), a Automação "alerta de atraso" (escopo no Espaço) é eliminada com ele (B41), e os Registros de Atividade — inclusive as Execuções passadas da Automação — permanecem.

**Exemplo 5 — Espaço vazio como padrão.** A organização cria o Espaço "Modelo" só com configuração (status, campos, funcionalidades), sem Listas, gera um Template a partir dele e o define como Template de Espaço padrão. "Modelo" é então arquivado. Novos Espaços nascem com a configuração; "Modelo" não é mais consultado.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
│   [Template de Espaço padrão 0..1 ──▶ Template]
│
└── ESPAÇO (0..N)  [ET 1; Criador 1; estado próprio: ativo | arquivado | na lixeira; Privado; Ordem; nome único entre irmãos]
    │
    ├── Configuração (ponto de definição; herdada por descendentes — B25)
    │   ├── Conjunto de Status (1) ── Definição de Status (2..N)  [≥1 não iniciado, ≥1 fechado]
    │   ├── Definição de Campo para Tarefa (0..N)          [acumula]
    │   ├── Tipo de Tarefa (1..N; padrão da plataforma)    [acumula]
    │   ├── Funcionalidades habilitadas (objeto de valor)  [substitui por aspecto]
    │   ├── Visualizações padrão (objeto de valor)         [substitui]
    │   └── Visualização do contêiner (0..N)
    │
    ├── Conteúdo estrutural (contenção; estado efetivo herdado)
    │   ├── Pasta (0..N) ──▶ Subpasta (0..N) ──▶ Lista (0..N) ──▶ Tarefa (0..N)
    │   │                └─▶ Lista (0..N) ──▶ Tarefa (0..N)
    │   └── Lista direta (0..N) ──▶ Tarefa (0..N)
    │
    └── Referenciado por (associação; sobrevive à eliminação com referência inválida, salvo Automação)
        ├── Automação (0..N)   [escopo = Espaço; pertence ao ET; eliminada com o Espaço — B41]
        ├── Widget de Painel (0..N)   [Fonte de Dados]
        ├── Permissão (0..N)   [Recurso; escopo registro | subárvore; Administrador de Espaço = administrar/subárvore]
        ├── Template (0..1)   [proveniência "criado a partir de"]
        ├── Sessão de Chat (0..N)   [âncora]
        └── Registro de Atividade (1..N)

Herda do ET: Papel (salvo Privado), Tags, Localidade, Política de lixeira, Profundidade máxima, Automações de escopo ET.
Nunca contém: Tarefa, CRM, IA, Painéis, Membros, Tags, Proprietário.
```

## 24. Decisões ontológicas

- **DO-ESP-01.** O Espaço pertence a exatamente um Espaço de Trabalho, imutavelmente, e contém apenas Pastas e Listas diretas; nunca Tarefas, CRM, IA ou Painéis. Aplica A1.1, A2.2, A3.1, A3.2. CONSOLIDADA.
- **DO-ESP-02 / B45.** O Espaço não tem Proprietário. A governança é exercida pela Ação `administrar` com escopo `subárvore` (Administrador de Espaço), concessão e não Papel; o Criador a recebe na criação. Aplica A7 (que não lista o Espaço) e B29. Consolidada em B45.
- **DO-ESP-03.** O Conjunto de Status do Espaço contém ao menos uma Definição `não iniciado` e uma `fechado`; `em andamento` e `concluído` são opcionais; a primeira `não iniciado` é o status inicial padrão. Aplica A4.3. RECOMENDADA.
- **DO-ESP-04.** Remover ou substituir Definições de Status com Tarefas afetadas exige mapeamento explícito, aplicado no mesmo ato, com evento próprio "status alterado por remapeamento", distinto de "status alterado" e que não dispara Gatilhos de "status alterado". Garante INV-ESP-04. RECOMENDADA.
- **DO-ESP-05.** Remover uma Definição de Campo a leva a `na lixeira` com Valores retidos e invisíveis; a eliminação permanente elimina os Valores; um Registro de Atividade agregado na Definição, não um por Tarefa. Aplica A5.4 e A6.2. RECOMENDADA.
- **DO-ESP-06 / B36, B43.** Cascata de arquivamento e lixeira por **estado efetivo**: o estado próprio dos descendentes não é reescrito; o efetivo é o mais restritivo do caminho; a restauração devolve cada descendente ao seu estado próprio; restaurar da lixeira devolve o registro ao Estado próprio anterior à exclusão (`ativo` ou `arquivado`), nunca força `ativo`; o estado próprio de um descendente pode ser alterado sob ancestral restritivo, e um descendente cujo estado próprio não é `na lixeira` pode ser movido para fora (RN-ESP-11); Registros de Tempo em andamento são encerrados quando a Tarefa deixa de ter estado efetivo `ativo`. Aplica A3.3 sem perder o Estado próprio. Consolidada em B36 (vale para Pasta, Subpasta, Lista e Tarefa); a regra de restauração e de estado próprio sob ancestral restritivo está consolidada em B43.
- **DO-ESP-07 / B38.** Privacidade monotônica para baixo: um descendente de contêiner privado nunca amplia acesso por herança; compartilhamento direto de descendente dá acesso à sua subárvore e expõe apenas os nomes dos ancestrais, nunca o conteúdo nem os irmãos. Aplica A9.2. Consolidada em B38 (e).
- **DO-ESP-08 / B38.** Todo Espaço privado tem ao menos um Membro `ativo` com `administrar`; quem privatiza recebe `administrar` no ato; a concessão passa ao Sucessor quando a remoção ou suspensão a deixaria vazia (exceção a B28, agora registrada em B28 e B38); Proprietário e Administradores do Espaço de Trabalho podem conceder acesso a Espaço privado, inclusive a si mesmos, como ato de governança registrado. Consolidada em B38 (b)–(d).
- **DO-ESP-09.** Template de Espaço padrão é atributo opcional do Espaço de Trabalho que referencia um Template de Espaço, usado quando um Espaço é criado sem Template explícito. Aplica a recomendação do documento 01, seção 16. RECOMENDADA. Atributo adicionado à seção 6 do documento 01.
- **DO-ESP-10 / B40.** Mover Lista ou Pasta entre Espaços é operação atômica que exige `administrar` sobre o contêiner movido e `criar` no destino e resolve status (mapeamento por categoria), Valores de Campo (arquivados no agregado, B37), Automações, Vínculos e permissões no mesmo ato; rejeitada por bloqueio, profundidade ou colisão de nome. Garante INV-ESP-04 e INV-ESP-05. Consolidada em B40.
- **DO-ESP-11 / B25.** Completa B25 nos aspectos que ela não classificava: Tipos de Tarefa acumulam; Funcionalidades habilitadas substituem por aspecto; Visualizações padrão substituem. Incorporada a B25.
- **DO-ESP-12 / B25.** Bloquear um aspecto é rejeitado enquanto houver sobrescritas em descendentes (nunca reversão silenciosa); desabilitar uma Funcionalidade não elimina dados. Nenhuma mudança de configuração é destrutiva por cascata (coerente com RN-ET-17). Incorporada a B25.
- **DO-ESP-13 / B41.** Referências ao Espaço sobrevivem ao seu arquivamento (válidas), à lixeira (indisponíveis) e à eliminação (inválidas): Vínculos de Tarefas são preservados até a eliminação e então removidos; Widgets com Fonte no Espaço ficam `inválido` e a Âncora de Painel de contexto fica `eliminada`, permanecendo o Painel (RN-PAI-20; DO-PAI-07); Template e proveniência sobrevivem. Exceção: Automação com escopo no Espaço fica inoperante enquanto ele não está efetivamente `ativo` e é **eliminada com ele** (B41), com Execuções passadas preservadas. Aplica A8. RECOMENDADA.
- **DO-ESP-14.** Ordem dos Espaços é atributo manual, único entre irmãos, do próprio Espaço; ordenação pessoal e favoritos são preferência do Membro. RECOMENDADA.
- **DO-ESP-15.** Criar Espaço decorre do Papel (Proprietário, Administrador) ou de concessão direta a Membros e Equipes de base Membro; Convidados e Agentes não criam Espaços; Agentes e Sujeitos de base Convidado nunca recebem `administrar` sobre Espaços. Aplica B7, B30. RECOMENDADA.
- **DO-ESP-16 / B39.** Nome de Espaço é único entre Espaços irmãos com estado próprio `ativo` ou `arquivado` do mesmo Espaço de Trabalho; referências continuam a usar o identificador. Consolidada em B39 (substitui a versão anterior, que não exigia unicidade).

Nenhuma decisão contradiz A1–A9 ou B1–B99. As decisões marcadas "/ Bnn" foram consolidadas na constituição na harmonização e na revisão da fase 2; a auditoria da fase 6 aplicou B88 (20.7) e DO-PAI-07 / RN-PAI-20 (12.4, 20.11, DO-ESP-13).

## 25. Questões em aberto

1. **Definições de Campo para Tarefas compartilhadas entre Espaços** (C14). Por A5.2, dois Espaços têm Definições distintas mesmo com o mesmo nome e Tipo (Exemplo 1). Painéis não conseguem agrupar Tarefas de vários Espaços por "Convênio", e Automações de escopo Espaço de Trabalho não conseguem referenciar um campo único. Alternativas e consequência registradas em C14.
2. **Conversão entre níveis** (C15): Pasta promovida a Espaço; Espaço rebaixado a Pasta de outro Espaço. Ontologicamente é criação nova com movimentação de conteúdo (B40) e perda de identidade do contêiner. Registrada em C15.
3. **Atributos organizacionais do Espaço** (centro de custo, área responsável). Registrado em C13 (ampliada para contêineres). Sem Campos Personalizados sobre o Espaço, a alternativa é atributo nativo.
4. **Limite de Espaços e de Definições por Espaço** (C8). Registrado como Limite imposto; valores são política.
5. **Gatilhos sobre remapeamento em massa** (DO-ESP-04) e destino de Automação com referência a Definição de Status removida (Exemplo 3): confirmar no documento de Automações.

Resolvidas neste documento ou na harmonização, sem pendência aberta: regras mínimas do Conjunto de Status (DO-ESP-03); Template de Espaço padrão (DO-ESP-09, aplicado ao documento 01); ausência de Proprietário do Espaço (DO-ESP-02); cascata por estado efetivo (B36); unicidade de nome entre irmãos (B39); visibilidade de contêiner compartilhado — apenas os nomes dos ancestrais são expostos (B38); destino de Automação com escopo eliminado (B41).
