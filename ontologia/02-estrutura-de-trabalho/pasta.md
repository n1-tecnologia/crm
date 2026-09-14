# PASTA

> Domínio: Estrutura de Trabalho | Documento 03 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Pasta** (Folder) é o agrupador estrutural intermediário da Estrutura de Trabalho: um contêiner nomeado, contido por exatamente um Espaço, que reúne Subpastas e Listas sob um contexto comum e que pode redefinir, para essa subárvore, parte da configuração que o Espaço lhe transmite. Ela ocupa a posição entre o Espaço (que delimita uma área de trabalho) e a Lista (que é o único lugar em que Tarefas existem).

Três propriedades a distinguem de qualquer vizinho:

1. **É intermediária e opcional.** Não é raiz de nada (tem pai obrigatório) e não é folha operacional (nunca contém Tarefas). Uma Lista pode existir diretamente no Espaço, sem Pasta (A3.1). A Pasta existe quando um conjunto de Listas precisa compartilhar contexto, configuração ou permissão que não é o do Espaço inteiro.
2. **É ponto de definição de configuração.** É um dos quatro níveis (Espaço, Pasta, Subpasta, Lista) em que Conjunto de Status, Definições de Campo para Tarefas, Tipos de Tarefa, Visualizações, Funcionalidades habilitadas, Automações e Permissões podem ser definidos, sobrescritos ou bloqueados (B25).
3. **É Recurso de permissão com escopo `subárvore`.** Conceder ou negar acesso à Pasta alcança tudo o que ela contém (B29); marcá-la como privada interrompe a herança de permissão vinda do Espaço (A9.2).

Uma Pasta não é "um projeto": pode representar um projeto, uma frente, um cliente ou um ciclo, mas "projeto" não é entidade desta ontologia (seção 4). Também não é uma "pasta grande" nem um "Espaço pequeno": Espaço é o primeiro ponto de definição da estrutura e não tem pai estrutural; Pasta sempre tem.

Neste documento, "Pasta" sem qualificação designa a Pasta cujo pai é um Espaço. A Subpasta é uma Pasta cujo pai é uma Pasta (B3): tudo o que se diz aqui vale para ela, exceto as restrições registradas no documento de Subpasta (não conter Subpastas; pai Pasta).

## 2. Propósito

A Pasta existe para quatro fins, nenhum deles atendido pelo Espaço nem pela Lista:

1. **Contexto compartilhado abaixo do Espaço.** Um Espaço "Marketing" pode ter dezenas de Listas; sem agrupador, o Espaço vira uma lista plana de Listas e o contexto ("estas seis Listas são a campanha de lançamento") fica só no nome. A Pasta torna o contexto um registro com identidade, descrição e ciclo de vida próprios.
2. **Herança intermediária.** Configurar status, campos ou Automações Lista por Lista repete configuração; configurá-los no Espaço obriga todas as Listas do Espaço a segui-los. A Pasta é o nível em que "estas Listas seguem este fluxo" se define uma vez e se herda (B25).
3. **Unidade de permissão.** Uma Pasta privada dentro de um Espaço aberto permite que um subconjunto de trabalho tenha acesso restrito sem criar outro Espaço (A9.2, B29). É o menor agrupador de Listas que pode ser compartilhado ou fechado como um todo.
4. **Unidade de projeto (sem entidade Projeto).** Arquivar, mover, instanciar a partir de Template e medir (Painéis) uma Pasta é operar sobre "o projeto inteiro" com um único ato, sem que a ontologia precise de uma entidade Projeto com ciclo de vida próprio.

**Qual é o valor ontológico de um agrupador opcional?** O de ser o único ponto da estrutura em que os três mecanismos acima (contexto, herança, permissão) podem coincidir sem coincidir com o Espaço. Sem ela, a organização escolhe entre Espaços demais (fragmentando Definições de Campo e Automações) ou Listas demais (repetindo configuração). A opcionalidade é deliberada: obrigar Pasta criaria níveis vazios em Espaços simples e tornaria a profundidade da árvore um custo fixo.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Ator e existente até a eliminação permanente.
- **Contêiner estrutural** (A3): relação de contenção exclusiva e obrigatória com seus filhos (Subpastas e Listas); cascata de estado sobre eles.
- **Ponto de definição** (B25): mantém a configuração que sobrescreve e o modo (`herdado`, `sobrescrito`, `bloqueado`) de cada aspecto configurável.
- **Recurso de permissão** (A9.1) com escopo `registro` ou `subárvore`; pode ser **privada**.
- **Escopo de Automações e de Fontes de Dados de Painel**: Automações com escopo Pasta pertencem ao Espaço de Trabalho e apenas a referenciam como escopo; Painéis podem tomar "Tarefas da Pasta" como Fonte de Dados. Nenhum dos dois é filho da Pasta.
- **Não é raiz de agregado de conteúdo.** Tarefa é raiz do próprio agregado; a Pasta é escopo de pertencimento transitivo, não responsável pela consistência interna das Tarefas.
- **Não é Ator.** Nunca age; ações "da Pasta" são de um Membro, Agente, Automação ou Sistema.
- **Não tem Proprietário.** A7 não lista contêineres entre as entidades com Proprietário; a governança da Pasta decorre do Papel Administrador no Espaço de Trabalho e de concessões `administrar` sobre ela (DO-PAS-03).
- **Não é objeto de valor, não é configuração, não é Template** (o Template de Pasta é outra entidade, do catálogo do Espaço de Trabalho).

## 4. Fronteira conceitual

### O que é

- Agrupador nomeado de Subpastas e Listas, com pai obrigatório (um Espaço).
- Nível de herança e sobrescrita de configuração da Estrutura de Trabalho.
- Recurso de permissão que pode fechar (privada) ou abrir (compartilhamento) uma subárvore.
- Unidade de arquivamento, movimentação e instanciação de estrutura.

### O que não é

- **Não é Espaço.** Não tem configuração "de origem": tudo o que a Pasta não sobrescreve vem do Espaço. Não pode existir sem Espaço; o Espaço existe sem Pastas.
- **Não é Lista.** Nunca contém Tarefas. Uma Pasta com uma única Lista não é "uma Lista com nome duplo": a Lista continua sendo o contêiner das Tarefas.
- **Não é Projeto.** "Projeto" é interpretação organizacional; a ontologia só conhece Pasta, Lista e Tarefa. Uma Pasta pode representar um projeto, um cliente, um ciclo ou um departamento.
- **Não é Template de Pasta.** O Template é um registro do catálogo do Espaço de Trabalho que armazena estrutura reutilizável; a Pasta é a instância viva.
- **Não é Tag nem Visualização.** Tag classifica registros sem contê-los; Visualização apresenta registros sem contê-los. A Pasta contém.
- **Não é Coleção de Conhecimento, Fila nem Funil.** São agrupadores de outros domínios (IA, CRM), relacionados à estrutura só por associação (A2.2).

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Espaço × Pasta** | Primeiro nível da estrutura; sem pai estrutural; primeiro ponto de definição de Conjunto de Status e Definições de Campo para Tarefas (A4.2, A5.2); contém Pastas e Listas. | Nível intermediário; pai obrigatório (Espaço); só sobrescreve ou herda; contém Subpastas e Listas. | Espaço origina configuração; Pasta a especializa. Sem Espaço não há Pasta; sem Pasta há Espaço com Listas diretas. |
| **Pasta × Subpasta** | Pai é um Espaço; pode conter Subpastas. | Pai é uma Pasta; não pode conter Subpastas (A3.4). Mesma entidade, mesmas capacidades (B3). | Só o tipo do pai e a profundidade restante distinguem as duas. Mover uma Pasta sem Subpastas para dentro de outra Pasta a torna Subpasta (RN-PAS-15). |
| **Pasta × Lista** | Agrupa contêineres; nunca contém Tarefas; opcional. | Contém Tarefas; único nível operacional; obrigatória para que uma Tarefa exista (A3.2). | A pergunta "onde está a Tarefa?" tem sempre uma Lista como resposta e nunca uma Pasta. A Lista pode existir sem Pasta; a Pasta sem Lista é válida mas vazia de trabalho. |
| **Pasta × Projeto** | Entidade da ontologia: contêiner com identidade, estado, configuração e permissões. | Conceito organizacional, não entidade: pode ser uma Pasta, uma Lista, um Espaço ou uma Tarefa com Subtarefas, conforme a escala. | A ontologia não fixa qual nível "é o projeto"; Painéis e Agentes tratam a Pasta como contêiner, não como projeto. Necessidades de "projeto" que a Pasta não cobre (data de entrega, cliente, orçamento) vão para a seção 25. |
| **Pasta × Template de Pasta** | Instância viva, com filhos reais, estado, permissões e histórico. | Registro do catálogo do Espaço de Trabalho que descreve estrutura e configuração reutilizáveis; não contém Tarefas reais nem tem permissões de conteúdo. | Instanciar cria uma Pasta nova com proveniência para o Template; alterar o Template depois não altera nenhuma Pasta (A8). Criar Template a partir de uma Pasta copia estrutura, não identidade. |

## 5. Identidade

A Pasta tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo.

**Teste de identidade.** Se o nome, a descrição, o ícone, a cor e a ordem mudarem, a Pasta for movida para outro Espaço, todas as Listas forem substituídas, o Conjunto de Status for sobrescrito e a Pasta for arquivada e restaurada, continua sendo a mesma Pasta: os Registros de Atividade, as concessões diretas, as Automações com escopo nela e as Fontes de Dados de Painel continuam a apontar para o mesmo identificador.

Consequências:

- **Nome não é identidade.** Duas Pastas com o mesmo nome em Espaços distintos são Pastas distintas. Entre irmãos `ativo` ou `arquivado` do mesmo pai, o nome é único por regra (RN-PAS-04 / B39), para que Agentes, Automações e Membros a referenciem por caminho sem ambiguidade; a unicidade é regra, não identidade.
- **Pai não é identidade.** Mover a Pasta para outro Espaço preserva a Pasta (RN-PAS-14).
- **Tornar-se Subpasta não cria outra entidade.** Uma Pasta movida para dentro de outra Pasta conserva o identificador (B3).
- **Template de origem não é identidade.** Dez Pastas instanciadas do mesmo Template são dez identidades sem vínculo entre si (A8).

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável. |
| Nome | nativo | sim | Nome de exibição. Único entre irmãos `ativo` ou `arquivado` do mesmo pai (RN-PAS-04; B39). |
| Descrição | nativo | não | Texto livre sobre o propósito da Pasta. Único texto livre da Pasta: ela não recebe Valores de Campo (DO-PAS-13). |
| Ícone | nativo | não | Símbolo de apresentação. |
| Cor | nativo | não | Cor de apresentação. |
| Ordem | nativo | sim | Posição entre os irmãos do mesmo tipo (Pastas do mesmo pai). Reordenar não é mover (RN-PAS-05). |
| Contêiner pai | referência (Espaço ou Pasta) | sim | Exatamente um. Espaço para Pasta; Pasta para Subpasta. Alterado só pela operação de mover. |
| Espaço | derivado | sim | O Espaço em que a Pasta está: o próprio pai, ou o Espaço da Pasta pai. |
| Espaço de Trabalho | derivado | sim | O do Espaço. Imutável (INV-ET-01). |
| Privada | nativo | sim | Booleano. Quando verdadeiro, interrompe a herança de permissão do pai (A9.2; seção 17). Padrão: falso. |
| Estado próprio | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). |
| Estado efetivo | derivado | sim | O mais restritivo entre o estado próprio e os estados efetivos dos ancestrais (DO-PAS-04 / B36). |
| Estado próprio anterior à exclusão | nativo | condicional | Preenchido enquanto `na lixeira`, com o estado próprio que a Pasta tinha ao ser excluída (`ativo` ou `arquivado`). A restauração a devolve a esse estado (12.2; B36; INV-PAS-12). |
| Modo por aspecto configurável | objeto de valor | sim | Para cada aspecto de B25: `herdado`, `sobrescrito` ou `bloqueado`, mais o indicador de bloqueio para descendentes (seção 16). Padrão: `herdado`, sem bloqueio. |
| Criador | referência (Ator) | sim | Imutável (A7). |
| Momento de criação | nativo | sim | Imutável. |
| Template de origem | referência (Template) | não | Proveniência "criado a partir de" (A8). Referência informativa; sobrevive à eliminação do Template como valor histórico. |
| Momento de arquivamento / de envio à lixeira | nativo | condicional | Preenchidos enquanto no estado correspondente. |
| Previsão de eliminação | derivado | condicional | Momento de envio à lixeira + Política de lixeira do Espaço de Trabalho. Só enquanto `na lixeira` pelo estado próprio. |

Não são atributos, embora sejam definidos na Pasta: o Conjunto de Status sobrescrito, as Definições de Campo adicionais, os Tipos de Tarefa adicionais e as Visualizações do contêiner. São configuração com identidade contida pela Pasta (seção 7). Poder configurá-las não as torna atributos.

## 7. Entidades internas ou componentes

A Pasta não tem entidades internas de domínio. Tem **configuração contida**, sem existência fora dela:

| Componente | O que é | Existe se |
| --- | --- | --- |
| Conjunto de Status sobrescrito | Sequência ordenada de Definições de Status definida nesta Pasta (A4.2). Substitui o do Espaço para toda a subárvore que não sobrescrever de novo. | Modo do aspecto = `sobrescrito`. |
| Definições de Campo Personalizado adicionais | Definições para Tarefas cujo ponto de definição é esta Pasta (A5.2). Acumulam com as do Espaço; aplicam-se às Tarefas de todas as Listas descendentes. | 0..N. |
| Tipos de Tarefa adicionais | Tipos cujo ponto de definição é esta Pasta (DO-PAS-11). | 0..N. |
| Visualizações do contêiner | Visualizações que apresentam as Tarefas da subárvore (A8). Visualizações pessoais pertencem ao Membro, não à Pasta. | 0..N. |
| Concessões diretas e compartilhamentos | Permissões cujo Recurso é a Pasta (seção 17). A concessão vive no Recurso concedido. | 0..N. |

**O que parece componente e não é**: Subpastas e Listas são entidades contidas com identidade e documento próprios; Automações com escopo Pasta pertencem ao Espaço de Trabalho (seção 8); Tarefas pertencem às Listas; Templates pertencem ao catálogo do Espaço de Trabalho.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço (ou Pasta, se Subpasta) | pertencimento (contenção invertida) | Pasta → pai | Exatamente um pai (A3.2, A3.3). Fonte da herança de configuração e de permissão. |
| contém Subpastas | Pasta (Subpasta) | contenção | Pasta → Subpasta | 0..N. Só quando o pai da Pasta é um Espaço (A3.4). |
| contém Listas | Lista | contenção | Pasta → Lista | 0..N. Cascata de estado. |
| contém configuração | Conjunto de Status, Definições de Campo, Tipos de Tarefa, Visualizações | contenção | Pasta → configuração | Seção 7. Removida com a Pasta. |
| herda de | Espaço (e Pasta pai) | herança | pai → Pasta | Todo aspecto em modo `herdado` (B25). |
| transmite a | Subpasta, Lista | herança | Pasta → descendentes | Todo aspecto que define ou repassa; pode bloquear. |
| é escopo de | Automação | referência (escopo) | Automação → Pasta | Automações com escopo Pasta pertencem ao Espaço de Trabalho e aplicam-se à subárvore. Não são contidas (seção 3). |
| é referenciada por | Automação (Ação), Painel (Fonte de Dados), Contexto de Agente, Sessão de Chat (âncora) | referência | outro → Pasta | Referências dentro do mesmo Espaço de Trabalho (INV-ET-07). Não implicam contenção nem propriedade. |
| é Âncora de | Painel (de contexto) | referência | Painel → Pasta | 0..N. Sem contenção nem herança; acompanha a movimentação; na eliminação passa a `eliminada` como valor e o Painel permanece (DO-PAI-07). |
| é Recurso de | Permissão | permissão | Sujeito → Pasta | Ações ver, comentar, criar, editar, excluir, administrar; escopo `registro` ou `subárvore` (B29). |
| foi criada a partir de | Template | referência (proveniência) | Pasta → Template | 0..1. Sem vínculo vivo (A8). |
| foi criada por | Ator | referência | Pasta → Ator | Criador, imutável. |
| gera | Registro de Atividade | referência | Registro → Pasta | Toda ação sobre a Pasta (A6.2). |

Distinção aplicada: **CONTER** (Subpastas, Listas, configuração própria), **HERDAR** (do pai; para os descendentes), **REFERENCIAR** (Template de origem, Criador; ser referenciada por Automações, Painéis, Contextos), **CONFIGURAR** (modo por aspecto, privacidade). A Pasta **não USA** nada e **não se RELACIONA** por Vínculo: Vínculo é entre registros de conteúdo (Tarefa, Negócio, Contato, Conversa — A8); Vínculo de contêiner é questão aberta (seção 25). A Pasta **não é de propriedade** de ninguém (DO-PAS-03).

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Pasta → pai (Espaço ou Pasta) | 1 | não | não | estrutural | A3.2, A3.3. Pasta sem pai não existe; dois pais tornariam herança e cascata ambíguas. |
| Espaço → Pasta | 0..N | sim | sim | estrutural | A3.1. Espaço só com Listas diretas é válido. |
| Pasta → Subpasta | 0..N (0 se a Pasta é Subpasta) | sim | sim | estrutural | A3.1, A3.4. |
| Pasta → Lista | 0..N | sim | sim | estrutural | Pasta recém-criada ou só com Subpastas é válida (seção 20.1, 20.2). |
| Pasta → Tarefa | 0 | — | — | — | Nunca direta (A3.2). Só transitivamente via Lista. |
| Pasta → Conjunto de Status sobrescrito | 0..1 | sim | não | contenção | Só um se aplica por nível (B25). |
| Pasta → Definição de Campo / Tipo de Tarefa / Visualização | 0..N | sim | sim | contenção | Acumulam com o Espaço. |
| Pasta → Automação com escopo Pasta | 0..N | sim | sim | referência | Automação pertence ao Espaço de Trabalho; a Pasta é escopo. |
| Automação → escopo Pasta | 0..1 | sim | não | referência | Uma Automação tem exatamente um escopo, que pode ou não ser uma Pasta. |
| Pasta → Template de origem | 0..1 | sim | não | referência | Proveniência opcional. |
| Template de Pasta → Pastas instanciadas | 0..N | sim | sim | referência (proveniência) | Sem vínculo vivo; o Template não "contém" instâncias. |
| Pasta → concessão direta / compartilhamento | 0..N | sim | sim | permissão | Pasta privada: ≥ 1 concessão `administrar` a Membro `ativo` (INV-PAS-07). |
| Pasta → Membro Administrador | derivado | — | — | permissão | Não há Proprietário; há Sujeitos com `administrar` (DO-PAS-03). |
| Painel / Sessão de Chat / Contexto → Pasta | 0..N | sim | sim | referência | A Pasta não conhece quem a referencia. |

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Espaço de Trabalho → Espaço → **Pasta** → Subpasta → Lista → Tarefa (A2.1). A Pasta está no terceiro nível a partir da raiz e é o primeiro nível opcional: abaixo do Espaço, a Lista pode aparecer diretamente. A profundidade de agrupamento abaixo do Espaço é no máximo dois (Pasta → Subpasta; A3.4, B3).

**Pertencimento (teste de existência).** A Pasta falha no teste sem o Espaço: eliminado ele, ela é eliminada (A3.3). Subpastas, Listas e a configuração contida falham sem a Pasta. Automações com escopo Pasta sobrevivem à Pasta enquanto ela está `arquivado` ou `na lixeira` (ficam inoperantes) e são eliminadas com ela na eliminação permanente (DO-PAS-10). Painéis, Sessões de Chat e Templates sobrevivem: a referência fica inválida, o registro continua.

**"Pertence a" versus "relaciona-se com".** Uma Lista *pertence* à Pasta (não existe sem ela; só sai por movimentação explícita). Uma Automação *relaciona-se com* a Pasta (a referencia como escopo). Um Painel *relaciona-se com* a Pasta (Fonte de Dados). Um Negócio nunca pertence a uma Pasta e nesta versão não se relaciona com ela (seção 25).

**Propriedade.** A Pasta não tem Proprietário (A7 não lista contêineres). A cadeia de responsabilidade passa pelo Espaço de Trabalho: quem responde pela Pasta é quem tem `administrar` sobre ela — por Papel (Administrador do Espaço de Trabalho, quando a Pasta não é privada), por herança do Espaço, ou por concessão direta (obrigatória quando privada). Sem Proprietário não há sucessão (B28) de Pastas; há sucessão da concessão `administrar` de Pasta privada (DO-PAS-09 / B38).

**Configurar não é conter.** A Pasta configura o modo de herança e a privacidade; isso é atributo. A Pasta contém o Conjunto de Status que sobrescreve; isso é contenção de configuração. A Pasta é escopo de Automações; isso é referência.

## 11. Estados

Todos os estados desta seção são **estados de sistema** (A4.1). A Pasta não tem Status (A4.2): Status é das Tarefas; a Pasta apenas define ou herda o Conjunto que as Tarefas das suas Listas usam.

| Estado próprio | Significado | Ações permitidas sobre a Pasta e a subárvore |
| --- | --- | --- |
| `ativo` | Operação normal. | Todas, conforme permissão. |
| `arquivado` | Conteúdo íntegro, fora da operação corrente. Não recebe Tarefas, Listas nem Subpastas novas; Automações com escopo nela ou em descendentes não disparam; Gatilhos por evento em Tarefas da subárvore não disparam. | Ver; comentar (recomendação: sim, para registro histórico); restaurar; enviar à lixeira; alterar permissões; alterar o estado próprio de descendentes e movê-los para fora (RN-PAS-11). Nunca editar conteúdo. |
| `na lixeira` | Excluída de forma recuperável. Invisível na estrutura; visível apenas na lixeira para quem tem `excluir` ou `administrar`. | Restaurar ao Estado próprio anterior à exclusão; eliminar permanentemente (antes do prazo, por quem tem `administrar`); mover para fora descendentes cujo estado próprio não é `na lixeira` (RN-PAS-11). |

**Estado efetivo** (DO-PAS-04 / B36): uma Pasta cujo Espaço está `arquivado` é efetivamente `arquivado`, mesmo com estado próprio `ativo`; uma Pasta cujo Espaço está `na lixeira` é efetivamente `na lixeira`. O estado efetivo é o mais restritivo na ordem `ativo` < `arquivado` < `na lixeira`. Toda regra de "o que pode ser feito" avalia o estado efetivo; toda regra de "o que acontece ao restaurar" avalia o estado próprio. Registros de Tempo em andamento em Tarefas da subárvore são encerrados no ato em que a Tarefa deixa de ter estado efetivo `ativo` (B36).

Eliminação permanente não é estado: é o fim do registro e de tudo o que ele contém (seção 12.4).

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Ator com permissão `criar` no contêiner pai (Espaço, ou Pasta para Subpasta), no mesmo Espaço de Trabalho. Produz a Pasta em estado `ativo`, com nome, pai, ordem (última entre os irmãos, salvo indicação), privacidade (padrão: não privada), todos os aspectos em modo `herdado` e o primeiro Registro de Atividade. Formas de criação:

- **Direta**: vazia, sem filhos.
- **A partir de Template de Pasta**: cria a Pasta e, no mesmo ato, as Subpastas, Listas, configuração sobrescrita, Visualizações e Automações de escopo descritas no Template, mais Tarefas modelo quando o Template as tiver (DO-PAS-12). Registra Template de origem. Não copia privacidade nem concessões: a Pasta nova nasce herdando as permissões do pai. Um Template que contém Subpastas só pode ser instanciado em um Espaço; instanciá-lo dentro de uma Pasta é rejeitado (RN-SUB-13 / DO-SUB-04; B47).
- **Por Agente ou Automação**: mesmas regras e mesmas permissões (A6.3); Registro de Atividade com ator e ator delegante (A6.2).

Criar a Pasta como privada exige que o Criador seja um Membro `ativo` sem base Convidado e receba, no mesmo ato, `administrar` por concessão direta (INV-PAS-07). Agentes e Automações não criam Pastas privadas nem privatizam Pastas, porque não podem receber `administrar` (B38).

### 12.2 Transições de estado

| De (próprio) | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | Sujeito com `administrar` na Pasta | Registro de Atividade. Estado efetivo de Subpastas, Listas e Tarefas passa a `arquivado` por derivação; estados próprios não são reescritos (B36). Registros de Tempo em andamento nas Tarefas da subárvore são encerrados. Execuções de Automações com escopo na subárvore em andamento concluem; novas não iniciam. Vínculos preservados (seção 20.7). Evento "Pasta arquivada" com contagem de Tarefas afetadas e de Vínculos com registros ativos. |
| `arquivado` | `ativo` | Idem | Registro de Atividade. Descendentes voltam ao estado próprio de cada um: uma Lista que já estava `arquivado` por si permanece arquivada. Permitido mesmo sob ancestral `arquivado` ou `na lixeira`: o estado efetivo continua derivado (B36). |
| `ativo` ou `arquivado` | `na lixeira` | Sujeito com `excluir` | Registro de Atividade; Estado próprio anterior à exclusão gravado; Previsão de eliminação calculada. Subárvore efetivamente `na lixeira`. Automações com escopo na subárvore não disparam; Automações de outros escopos que referenciam a Pasta ou seus descendentes passam a ter referência inválida (seção 20.8). Fontes de Dados de Painéis na subárvore passam a `indisponível` (Widgets vazios, com indicação) e a Âncora de Painel de contexto a `indisponível` (documento 21, 11.2 e 7.8). Vínculos preservados até a eliminação. |
| `na lixeira` | `ativo` ou `arquivado` (o Estado próprio anterior à exclusão) | Sujeito com `excluir` | Registro de Atividade. Exige pai não `na lixeira` (RN-PAS-13); pai `arquivado` é aceito e a Pasta fica efetivamente `arquivado`. Se o pai está `na lixeira`, restaura-se o pai antes, ou a restauração indica outro pai — restauração e movimentação no mesmo ato, com as exigências de RN-PAS-14. Nomes conflitantes entre irmãos são resolvidos antes (RN-PAS-04). |
| `na lixeira` | eliminação permanente | Sistema, ao fim do prazo; ou Sujeito com `administrar`, antes | Não é transição: é o fim (12.4). |

**Descendentes sob Pasta restritiva** (B36; RN-PAS-11). O estado próprio de uma Subpasta, Lista ou Tarefa pode ser alterado por quem tem permissão mesmo com a Pasta `arquivado` ou `na lixeira`; o efetivo continua limitado pelo ancestral. Consequência: uma Lista arquivada individualmente sob Pasta arquivada permanece `arquivado` quando a Pasta é restaurada. Um descendente `na lixeira` por estado próprio só é restaurado se o seu pai não está `na lixeira` (ou indicando outro pai, como acima). Um descendente cujo estado próprio não é `na lixeira` pode ser movido para fora da Pasta restritiva, para um destino efetivamente `ativo`, por quem tem `administrar` no descendente e `criar` no destino (B40).

### 12.3 Movimentação

- **Reordenar** entre irmãos: altera Ordem; não é mover; gera Registro de Atividade.
- **Mover para outro Espaço** (RN-PAS-14 / B40): atômica; exige mapeamento explícito do Conjunto de Status que a subárvore herdava do Espaço de origem; Valores de Campo de Definições do Espaço de origem passam a `arquivado` nas Tarefas (B37); Tipos de Tarefa em uso indisponíveis no destino passam ao padrão. Permissões herdadas passam a vir do novo Espaço; concessões diretas e privacidade da Pasta são preservadas. Automações do Espaço de origem deixam de se aplicar; Automações com escopo na Pasta continuam. Vínculos e Dependências permanecem. Detalhe em 20.6.
- **Mover para dentro de outra Pasta** (torna-se Subpasta — rebaixamento) ou **promover Subpasta a Pasta** (RN-PAS-15): só quando a profundidade resultante respeita A3.4. Mesma exigência de mapeamento quando o novo Caminho efetivo muda o que se herda; rejeitada se o novo ancestral bloqueia aspecto sobrescrito ou se há colisão de nome no destino (B40).
- **Mover Lista para dentro ou para fora da Pasta**: operação da Lista, descrita no documento de Lista; a Pasta apenas registra o evento de conteúdo alterado.

### 12.4 Eliminação permanente e cascata

Ao fim da Política de lixeira, ou por ato de quem tem `administrar`, a Pasta é eliminada com tudo o que contém: Subpastas, Listas, Tarefas (com seus agregados: Checklists, Comentários, Registros de Tempo, Valores de Campo, Anexos como referências), configuração contida, Visualizações do contêiner, concessões e compartilhamentos, Automações com escopo na Pasta ou em descendentes (DO-PAS-10), e todos os Vínculos que tenham um lado na subárvore (A8: remover um lado remove o Vínculo, não o outro registro).

Não são eliminados: Arquivos (pertencem ao Espaço de Trabalho; perdem apenas as referências), Registros de Atividade (imutáveis, INV-ET-12), o Template de origem, Painéis (Widgets com Fonte na subárvore ficam `inválido` — RN-PAI-20; a Âncora de Painel de contexto fica `eliminada` e o Painel permanece — DO-PAI-07), Sessões de Chat ancoradas (Âncora `eliminada` — B83), Tags (perdem aplicações), Negócios, Contatos e Conversas antes vinculados.

## 13. Regras de negócio ontológicas

- **RN-PAS-01.** Toda Pasta tem exatamente um contêiner pai — um Espaço, ou uma Pasta quando é Subpasta — do mesmo Espaço de Trabalho, definido na criação e alterável apenas pela operação de mover (A3.2, A3.3). Não existe Pasta órfã nem Pasta diretamente no Espaço de Trabalho.
- **RN-PAS-02.** Uma Pasta contém apenas Subpastas e Listas. Nunca contém Tarefas (A3.2) e nunca contém uma Pasta que, por sua vez, contenha Pastas (A3.4). Toda tentativa de criar Tarefa tendo a Pasta como contêiner é inválida; o contêiner de Tarefa é sempre uma Lista.
- **RN-PAS-03.** A Pasta é opcional: uma Lista pode ter um Espaço como pai (A3.1). Nenhuma regra desta ontologia exige Pasta para que trabalho exista.
- **RN-PAS-04.** O nome é obrigatório e não vazio. Entre irmãos com estado próprio `ativo` ou `arquivado` sob o mesmo pai, o nome é único (comparação insensível a maiúsculas e espaços nas extremidades). Restaurar da lixeira ou mover para um pai onde o nome já existe exige renomear antes (DO-PAS-05 / B39). Vale igualmente para Subpastas entre irmãs da mesma Pasta.
- **RN-PAS-05.** Ordem é posição entre irmãos do mesmo tipo sob o mesmo pai (Pastas entre Pastas; Listas entre Listas). Reordenar não altera pai, herança nem permissões e gera Registro de Atividade.
- **RN-PAS-06.** Conjunto de Status: em modo `herdado`, aplica-se o do ancestral mais próximo que o define; em `sobrescrito`, o da Pasta, para toda a subárvore que não sobrescrever de novo; o nível mais próximo da Lista vence. Se um ancestral marcou o aspecto como bloqueado, a Pasta não pode sobrescrever. Sobrescrever ou voltar a herdar quando existem Tarefas na subárvore exige **mapeamento** explícito de cada Definição de Status antiga para uma nova; sem mapeamento completo a operação é inválida (DO-PAS-06). Bloquear é **rejeitado** enquanto houver Subpastas ou Listas com Conjunto `sobrescrito`; o ator reverte cada uma (com mapeamento) e então bloqueia (B25). Toda Tarefa afetada recebe Registro de Atividade de alteração de status por mapeamento.
- **RN-PAS-07.** Definições de Campo Personalizado acumulam (B25): as Tarefas da subárvore recebem as Definições do Espaço, da Pasta e dos níveis abaixo. A Pasta não remove nem altera Definições cujo ponto de definição é o Espaço; pode bloquear a criação de Definições novas nos descendentes (as existentes permanecem — B25). O nome de cada Definição é único, sem distinção de maiúsculas e de espaços nas extremidades, em todo o caminho efetivo: criar na Pasta um nome já efetivo por herança, ou já existente em qualquer descendente, é inválido (DO-LIS-05). Remover uma Definição da Pasta a leva a `na lixeira`, com os Valores da subárvore retidos e invisíveis até a eliminação permanente da Definição, que os elimina (A5.4; mesmo tratamento de DO-ESP-05).
- **RN-PAS-08.** Automações com escopo Pasta aplicam-se a todos os eventos da subárvore e acumulam com as dos ancestrais (B25). Pertencem ao Espaço de Trabalho; a Pasta é escopo. Não disparam enquanto o estado efetivo da Pasta não for `ativo`. A Pasta pode bloquear a criação de Automações nos descendentes.
- **RN-PAS-09.** Pasta privada: a origem "herança do contêiner pai" e a origem "papel" deixam de contar para a Pasta e sua subárvore, inclusive para Administradores e para o Proprietário do Espaço de Trabalho; só concessão direta e compartilhamento contam (A9.2; B38). Só um Membro `ativo` sem base Convidado torna a Pasta privada, e recebe `administrar` por concessão direta no mesmo ato. O Proprietário e os Administradores do Espaço de Trabalho podem conceder acesso à Pasta privada, inclusive a si mesmos, por ato de governança registrado (Registro de Atividade com motivo). A privacidade nunca amplia acesso: uma Pasta não privada dentro de contêiner privado herda apenas as concessões desse contêiner; compartilhar a Pasta com quem não vê o Espaço expõe apenas os nomes dos ancestrais (DO-PAS-08 / B38).
- **RN-PAS-10.** O estado efetivo de qualquer registro da subárvore é o mais restritivo entre o seu estado próprio e os estados efetivos de seus ancestrais. A cascata é derivação, não escrita: arquivar ou enviar a Pasta à lixeira não altera o estado próprio dos descendentes, e restaurá-la devolve a cada descendente o seu próprio estado (DO-PAS-04 / B36).
- **RN-PAS-11.** Em Pasta efetivamente `arquivado` ou `na lixeira`, nenhuma ação com efeito sobre conteúdo da subárvore é válida — inclusive por Agente ou Automação (A6.3) — exceto: comentar (só em `arquivado`); alterar permissões; restaurar a Pasta ou o ancestral que a restringe; enviar à lixeira; alterar o **estado próprio** de um descendente (arquivar, desarquivar, enviar à lixeira; restaurar de `na lixeira` só se o pai do descendente não está `na lixeira`); **mover para fora** um descendente cujo estado próprio não é `na lixeira`, para destino efetivamente `ativo` (B40); eliminar antecipadamente o que está `na lixeira` por estado próprio (B36; 12.2). Vínculos existentes são preservados; Vínculos novos com registros da subárvore são inválidos.
- **RN-PAS-12.** A eliminação permanente ocorre ao fim da Política de lixeira do Espaço de Trabalho ou por ato explícito de quem tem `administrar`, e é em cascata (12.4). A eliminação permanente de um ancestral inclui a Pasta independentemente do estado próprio e do prazo próprio dela (B36); a eliminação da Pasta pelo seu próprio prazo, ou por ato explícito, permanece possível enquanto o ancestral existir.
- **RN-PAS-13.** Restaurar da lixeira devolve a Pasta ao Estado próprio anterior à exclusão (`ativo` ou `arquivado`) e exige que o pai não esteja `na lixeira`; pai `arquivado` é aceito. Se o pai está `na lixeira`, restaura-se o pai antes, ou a restauração indica outro pai (restauração e movimentação no mesmo ato, com as exigências de RN-PAS-14). Pai eliminado não ocorre: a eliminação do pai eliminou a Pasta (A3.3, B36).
- **RN-PAS-14.** Mover Pasta para outro Espaço é ato atômico que exige `administrar` na Pasta e `criar` no Espaço de destino, que deve estar efetivamente `ativo` (DO-PAS-07 / B40): (a) cada Conjunto de Status herdado do Espaço de origem por qualquer Lista da subárvore é mapeado, por categoria, para o Conjunto aplicável no destino (ou a Pasta passa a sobrescrever com uma cópia, se o destino não bloqueia); (b) Valores de Campo de Definições do Espaço de origem passam a `arquivado` no agregado de cada Tarefa, preservados e reativáveis (B37) — Definições do Espaço de destino começam vazias; (c) Tipos de Tarefa do Espaço de origem em uso e indisponíveis no destino passam ao padrão, com Registro de Atividade. Sobrescritas e bloqueios já existentes na Pasta ou abaixo dela são preservados; se o destino bloqueia um aspecto sobrescrito na Pasta ou em descendente, a movimentação é **rejeitada** com a lista dos conflitos (B25). Concessões diretas, compartilhamentos e privacidade da Pasta são preservados; permissões herdadas passam a vir do destino; Responsáveis e Observadores que perdem `ver` são liberados. Automações com escopo no Espaço de origem deixam de se aplicar; as de escopo na Pasta ou abaixo continuam. Vínculos e Dependências permanecem. Colisão de nome no destino rejeita a operação até renomear (B39); colisão entre uma Definição de Campo própria da Pasta (ou de descendente) e uma Definição do novo caminho rejeita igualmente (DO-LIS-05). O estado efetivo de origem não impede a movimentação (RN-PAS-11).
- **RN-PAS-15.** Uma Pasta pode ser movida para dentro de outra Pasta do mesmo Espaço (tornando-se Subpasta) somente se não contiver Subpastas. Uma Subpasta pode ser promovida a Pasta (pai passa a ser o Espaço). Ambas são movimentações: preservam identidade e exigem mapeamento do que o novo Caminho efetivo deixa de fornecer.
- **RN-PAS-16.** Instanciar um Template de Pasta cria uma Pasta nova com proveniência para o Template e sem vínculo vivo (A8): alterar ou eliminar o Template depois não afeta a Pasta. Um Template que contém Subpastas só é instanciável em um Espaço (RN-SUB-13 / DO-SUB-04; B47). Criar Template a partir de uma Pasta copia estrutura e configuração (DO-PAS-12); nunca copia identidade, estado, permissões, privacidade, Registros de Atividade nem Vínculos.
- **RN-PAS-17.** Toda ação sobre a Pasta gera Registro de Atividade com ator e, quando houver, ator delegante (A6.2). Agentes e Automações estão sujeitos às mesmas permissões que Membros (A6.3): uma tentativa sem permissão é registrada como negada e a Execução segue B23.
- **RN-PAS-18.** A Pasta não tem Proprietário. Quem tem `administrar` sobre ela responde por sua governança. Quando o último Membro `ativo` com `administrar` por concessão direta em Pasta privada é removido ou suspenso, a concessão passa (na remoção, exceção a B28) ou é também concedida (na suspensão) ao Sucessor, determinado como em B28, no mesmo ato (DO-PAS-09 / B38).

## 14. Invariantes

- **INV-PAS-01.** Toda Pasta tem exatamente um pai (Espaço ou Pasta) do mesmo Espaço de Trabalho, e esse Espaço de Trabalho nunca muda.
- **INV-PAS-02.** Nenhuma Pasta contém Tarefas diretamente.
- **INV-PAS-03.** Nenhuma Pasta cujo pai é uma Pasta contém Pastas (profundidade máxima dois abaixo do Espaço).
- **INV-PAS-04.** Não existem duas Pastas irmãs com estado próprio `ativo` ou `arquivado` e o mesmo nome sob o mesmo pai (B39).
- **INV-PAS-05.** Para cada Pasta e cada aspecto configurável, o modo é exatamente um entre `herdado`, `sobrescrito` e `bloqueado`; se um ancestral bloqueou o aspecto, o modo da Pasta é `herdado`.
- **INV-PAS-06.** Toda Tarefa da subárvore tem status atual pertencente ao Conjunto de Status efetivo da sua Lista; nenhuma operação sobre a Pasta (sobrescrever, bloquear, mover) deixa uma Tarefa com status fora do Conjunto aplicável.
- **INV-PAS-07.** Toda Pasta privada tem, em todo instante, ao menos um Membro `ativo` com `administrar` por concessão direta (B38).
- **INV-PAS-08.** O estado efetivo de qualquer registro da subárvore nunca é menos restritivo que o estado efetivo da Pasta.
- **INV-PAS-09.** Uma Pasta com Previsão de eliminação preenchida está `na lixeira` pelo estado próprio, e a previsão é posterior ao momento de envio à lixeira.
- **INV-PAS-10.** Nenhuma referência à Pasta (escopo de Automação, Fonte de Dados, âncora, Template de origem, concessão) cruza a fronteira do Espaço de Trabalho (INV-ET-07).
- **INV-PAS-11.** Nenhuma Pasta tem Proprietário nem Valores de Campo.
- **INV-PAS-12.** Estado próprio anterior à exclusão está preenchido se e somente se o estado próprio é `na lixeira`, e vale `ativo` ou `arquivado`.

## 15. Personalização

**Personalizável na Pasta** (por quem tem `administrar` sobre ela, salvo indicação):

- Nome, descrição, ícone, cor (quem tem `editar`); ordem (quem tem `editar` no pai).
- Privacidade (`administrar`, por Membro `ativo` sem base Convidado), com a exigência de INV-PAS-07.
- Conjunto de Status: herdar, sobrescrever (definindo Definições de Status próprias, cada uma com categoria fixa — A4.3) ou bloquear para os descendentes.
- Definições de Campo Personalizado adicionais para Tarefas, e bloqueio de novas nos descendentes.
- Tipos de Tarefa adicionais, e bloqueio.
- Visualizações do contêiner e Visualização padrão da Pasta.
- Funcionalidades habilitadas para a subárvore (modo substitui, por funcionalidade — DO-PAS-11 / B25; desabilitar nunca apaga dados).
- Automações com escopo Pasta (criadas por quem tem `administrar` na Pasta e permissão de criar Automações; pertencem ao Espaço de Trabalho).
- Criar Template de Pasta a partir dela; instanciar Templates dentro dela.

**Não personalizável:**

- Identificador, Criador, momento de criação, Template de origem.
- Estados e transições; a derivação do estado efetivo.
- O que pode conter (Subpastas e Listas) e a profundidade máxima.
- Definições cujo ponto de definição é um ancestral (só o ancestral as altera).
- Tags, Equipes, Papéis, Funis: definidos exclusivamente no Espaço de Trabalho (RN-ET-13).
- Campos Personalizados **sobre a Pasta**: não existem. A5.2 destina Definições a Tarefas, Contatos, Empresas, Negócios e Conversas; a Pasta define Campos para as Tarefas da subárvore, mas não recebe Valores (DO-PAS-13; seção 25).

## 16. Herança

A Pasta é simultaneamente **herdeira** do Espaço (e da Pasta pai, se Subpasta) e **transmissora** para Subpastas e Listas. Para cada aspecto (B25):

| Aspecto | Modo de herança | O que a Pasta pode fazer | O que a Pasta pode bloquear para os descendentes |
| --- | --- | --- | --- |
| Conjunto de Status | Substitui: só um se aplica por Lista; o nível mais próximo vence. | Herdar do Espaço ou sobrescrever com Conjunto próprio (salvo bloqueio do Espaço). | Sim: impede Subpastas e Listas de sobrescrever; bloquear é rejeitado enquanto houver sobrescritas abaixo (20.5; B25). |
| Definições de Campo para Tarefas | Acumula: Espaço + Pasta + Subpasta + Lista. | Acrescentar Definições próprias. Nunca remover as do Espaço. | Sim: impede Definições novas abaixo; as já existentes abaixo permanecem (acumulação não é sobrescrita). |
| Tipos de Tarefa | Acumula (DO-PAS-11 / B25). | Acrescentar Tipos próprios. | Sim. |
| Automações | Acumula: todas as do Caminho efetivo se aplicam. | Ser escopo de Automações próprias. | Sim: impede Automações novas com escopo abaixo. |
| Visualizações padrão | Substitui (DO-PAS-11 / B25). | Definir a Visualização padrão da subárvore. | Sim. |
| Funcionalidades habilitadas | Substitui, por funcionalidade: o nível mais próximo que define vence (B25). Desabilitar nunca apaga dados. | Habilitar ou desabilitar funcionalidades para a subárvore. | Sim: impede sobrescrever abaixo; rejeitado enquanto houver sobrescritas. |
| Permissões | Herda do pai (A9.2); concessões somam. | Receber concessões diretas e compartilhamentos; tornar-se privada (interrompe). | A privacidade é o bloqueio: descendentes de Pasta privada só herdam das concessões da Pasta. |
| Tags, Localidade, Profundidade máxima de Subtarefas, Política de lixeira | Vêm do Espaço de Trabalho; nenhum nível intermediário redefine. | Nada. | Nada. |

**Modo `bloqueado`** é sempre imposto pelo ancestral e lido no descendente: a Pasta pode bloquear tanto o que sobrescreve quanto o que apenas herda e repassa. Bloquear quando já existem sobrescritas abaixo é rejeitado com a lista delas; o ator as reverte explicitamente (com mapeamento, RN-PAS-06) e então bloqueia — nunca descarte silencioso (B25). Mover um contêiner com sobrescrita para sob a Pasta quando ela bloqueia o aspecto é igualmente rejeitado.

**Ponto de definição** de cada configuração é imutável: uma Definição de Campo criada na Pasta permanece da Pasta; para "subi-la" ao Espaço cria-se outra no Espaço e mapeiam-se os Valores.

## 17. Permissões e visibilidade

| Elemento | Na Pasta |
| --- | --- |
| Sujeito | Membro, Equipe, Papel, Agente (A9.1). |
| Recurso | A Pasta (contêiner). |
| Ações | `ver` (a Pasta, nome, descrição, estrutura de filhos); `comentar` (em escopo `subárvore`: comentar nas Tarefas da subárvore); `criar` (Subpastas e Listas na Pasta; em `subárvore`, também Tarefas nas Listas); `editar` (atributos de apresentação; em `subárvore`, editar conteúdo); `excluir` (enviar à lixeira e restaurar; em `subárvore`, o mesmo para descendentes); `administrar` (configuração, herança e bloqueios, privacidade, conceder e compartilhar, arquivar e desarquivar, mover, eliminar permanentemente). `executar` não se aplica. |
| Escopo | `registro` (só a Pasta) ou `subárvore` (Pasta e todos os descendentes estruturais — B29). `próprios` não se aplica a contêineres. |
| Origem | Papel no Espaço de Trabalho; herança do Espaço (ou da Pasta pai); concessão direta; compartilhamento. Em Pasta privada: só as duas últimas (A9.2). |

**Herança.** A permissão efetiva de um Sujeito sobre uma Pasta não privada é a união do que lhe chega pelo Papel, pela herança do pai (que já inclui a herança dos ancestrais do pai) e pelas concessões e compartilhamentos na própria Pasta. Uma concessão `subárvore` na Pasta alcança Subpastas, Listas e Tarefas; uma concessão `registro` alcança só a Pasta (útil para "ver que existe" sem ver conteúdo).

**Pasta privada.** Interrompe a herança: Papel e herança deixam de contar para a Pasta e sua subárvore. Quem não tem concessão direta ou compartilhamento não vê a Pasta nem sabe que existe: a listagem do Espaço não a exibe, e o nome não é revelado em buscas, Painéis ou respostas de Agente. Um Administrador do Espaço de Trabalho sem concessão não a vê; ele e o Proprietário podem conceder acesso a si mesmos ou a outro Membro apenas por **ato de governança registrado** (Registro de Atividade com motivo, visível a quem tem acesso à Pasta — B38). Por isso INV-PAS-07 exige sempre um Membro `ativo` com `administrar`, e RN-PAS-18 transfere a concessão ao Sucessor na remoção.

**Privacidade não amplia** (DO-PAS-08 / B38). Não existe Pasta "pública": existe Pasta não privada, que herda o que o pai transmite. Dentro de um Espaço privado, uma Pasta não privada é vista só por quem vê o Espaço. Compartilhar diretamente a Pasta com um Sujeito (origem compartilhamento) é o único modo de dar acesso à Pasta a quem não vê o Espaço; isso não concede nada sobre o Espaço: o Sujeito vê apenas os nomes dos ancestrais, para navegação, nunca o conteúdo do Espaço nem as Pastas irmãs.

**IA sujeita às mesmas regras.** Um Agente com `ver` na Pasta e sem `criar` não cria Lista nela, nem em nome de um Membro que poderia (interseção, A9.3). Um Agente autônomo usa só as próprias permissões. Um Painel que tome a Pasta como Fonte de Dados filtra pelas permissões do visualizador (B20): quem não vê a Pasta vê o Widget vazio.

**Exceções.** Nenhuma silenciosa. Não há Sujeito que veja Pastas privadas sem concessão; as vias de entrada são a sucessão de RN-PAS-18 e o ato de governança registrado do Proprietário ou de um Administrador do Espaço de Trabalho (B38), além da exportação total pelo Proprietário (documento 01, 17.2).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Pasta criada | 12.1 | identificador, pai, nome, privada, Template de origem, ator | Auditoria; Automações do Espaço (gatilho "Pasta criada"); Limites (contagem, se houver) |
| Pasta alterada | nome, descrição, ícone, cor | aspecto, antes, depois, ator | Auditoria |
| Pasta reordenada | Ordem alterada | pai, ordem antes e depois | Apresentação |
| Pasta movida | RN-PAS-14, RN-PAS-15 | pai antes e depois, mapeamentos aplicados, Valores arquivados, contagem de Tarefas afetadas | Auditoria; Automações (reavaliar escopo); Painéis (Fonte de Dados); Agentes (Contexto) |
| Movimentação ou bloqueio rejeitado | RN-PAS-06, RN-PAS-14, RN-PAS-15 | tentativa, motivo (profundidade, bloqueio, colisão de nome), conflitos listados, ator | Auditoria; Execução de Agente ou Automação (falha registrada) |
| Configuração da Pasta alterada | sobrescrita, retorno a herdado, bloqueio, Definição de Campo ou Tipo criado/removido | aspecto, modo antes e depois, mapeamento aplicado | Tarefas da subárvore (remapear status/valores); Painéis; Automações |
| Privacidade alterada | Privada ligada/desligada | antes, depois, concessões criadas no mesmo ato | Reavaliação de permissões em curso (B23); Painéis; Filas de notificação |
| Permissão concedida / revogada na Pasta | Concessão ou compartilhamento | Sujeito, Ação, Escopo, ator | Auditoria; Execuções (B23) |
| Pasta arquivada / restaurada | 12.2 | contagem de Tarefas e Vínculos afetados, ator | Automações (parar/retomar); Painéis; Negócios e Conversas vinculados (indicação de arquivado) |
| Pasta enviada à lixeira / restaurada | 12.2 | previsão de eliminação, Automações com referência invalidada, ator; na restauração, Estado próprio anterior à exclusão | Automações; Painéis; Sessões de Chat ancoradas |
| Pasta eliminada | 12.4 | identificador, contagem eliminada, Vínculos removidos | Auditoria; Automações (eliminar as de escopo); Painéis; Templates (proveniência histórica) |
| Template criado a partir da Pasta / Template instanciado na Pasta | RN-PAS-16 | Template, Pasta, ator | Auditoria; catálogo de Templates |
| Ação negada na Pasta | RN-PAS-17 | Sujeito, Ação tentada, ator delegante | Auditoria; Execuções de Agente (B23); Solicitações de Aprovação |

Todos geram Registro de Atividade com a Pasta como objeto.

## 19. Dependências

**A Pasta depende de:**

- **Espaço** (pai) e, transitivamente, **Espaço de Trabalho**: existência, herança de configuração, herança de permissão, Política de lixeira.
- **Conjunto de Status efetivo resolvido pelo Caminho efetivo**, quando em modo `herdado`.
- **Tipos de Campo** (global) para as Definições de Campo que cria.
- **Template de Pasta** (opcional) na criação por instanciação; depois, só proveniência.
- **Papéis e concessões** do Espaço de Trabalho para ser governada.

**Dependem da Pasta:** Subpastas, Listas e, transitivamente, Tarefas (existência); configuração contida; Automações com escopo na Pasta (eliminadas com ela); Painéis, Sessões de Chat e Contextos que a referenciam (referência, não existência).

**Documentos que este documento pressupõe ou condiciona:** Espaço (02) fornece o pai e a origem da herança; Subpasta (04) herda todas as regras daqui com as restrições de B3; Lista (05) recebe as regras de contêiner pai, mapeamento e estado efetivo; Tarefa recebe a regra de status por mapeamento; Automações recebe DO-PAS-10 e o gatilho "ação negada"; Painéis recebe a Pasta como Fonte de Dados sujeita a B20; Templates (nas entidades que os usam) recebe DO-PAS-12.

## 20. Casos limítrofes e ambiguidades

### 20.1 Pasta vazia

Válida indefinidamente (0..N filhos). Tem valor como contexto e como ponto de definição preparado antes do conteúdo (configura-se o Conjunto de Status e as Definições de Campo, depois criam-se Listas que já os herdam). Nenhuma regra elimina Pastas vazias automaticamente.

### 20.2 Pasta só com Listas, ou só com Subpastas

Ambas válidas (A3.1). Pasta só com Listas é o caso comum. Pasta só com Subpastas é um agrupador de agrupadores: não contém trabalho diretamente, mas Painéis com Fonte de Dados na Pasta agregam as Tarefas de todas as Subpastas. Uma Pasta pode ter ambos ao mesmo tempo; a Ordem é mantida por tipo (RN-PAS-05).

### 20.3 Pasta privada dentro de Espaço não privado

Caso de uso principal da privacidade. Quem vê o Espaço não vê a Pasta nem seu nome. O Criador recebe `administrar` no mesmo ato (INV-PAS-07) e concede aos demais. Painéis do Espaço que agregam "Tarefas do Espaço" excluem a subárvore para quem não tem concessão (B20). Automações do Espaço continuam a ter a subárvore no seu escopo (herança de configuração não é herança de permissão), mas Gatilho e Ações valem com as permissões com que a Automação executa (documento 01, 17.1; RN-ESP-20): sem `ver` na Pasta privada, os eventos da subárvore não são visíveis à Automação — nada dispara, nada falha, nada é registrado, para que a Automação não se torne canal de vazamento; com `ver` mas sem `editar`, a Ação falha, a Execução passa a `falhou` e o evento é registrado (B23).

### 20.4 Pasta não privada dentro de Espaço privado

A visibilidade não amplia a do pai (DO-PAS-08). "Não privada" significa "herda", e o que se herda de um pai privado são apenas as concessões dele. Ninguém vê a Pasta sem ver o Espaço, salvo compartilhamento direto da Pasta, que é concessão explícita e não decorre da flag. Recomenda-se que não exista mecanismo de "tornar pública" uma Pasta em Espaço privado; a alternativa (flag que amplia) faria da Pasta um canal de vazamento do Espaço.

### 20.5 Pasta sobrescreve o Conjunto de Status quando Listas já sobrescreveram o seu

Precedência: o nível mais próximo da Tarefa vence. Sobrescrever na Pasta sem bloquear não altera as Listas que já sobrescreviam; altera só as que herdavam (e estas exigem mapeamento das Tarefas existentes, RN-PAS-06). Bloquear na Pasta enquanto há Listas que sobrescrevem é rejeitado, com a lista delas (B25); o ator reverte cada Lista a `herdado` explicitamente, com mapeamento do Conjunto dela para o da Pasta, e só então bloqueia. O bloqueio nunca descarta status silenciosamente (INV-PAS-06).

### 20.6 Mover Pasta para Espaço cujo Conjunto de Status é incompatível

Se as Listas da subárvore herdavam o Conjunto do Espaço de origem, no destino não há Conjunto igual: o ator escolhe entre (a) mapear Definição a Definição, por categoria, para o Conjunto do destino, (b) fazer a Pasta passar a sobrescrever com uma cópia do Conjunto de origem (possível só se o destino não bloqueia o aspecto), ou (c) cancelar. Valores de Campo de Definições do Espaço de origem passam a `arquivado` nas Tarefas (RN-PAS-14b / B37); Tipos de Tarefa, RN-PAS-14c. Se o destino bloqueia o Conjunto de Status, (b) é inválida; e se a Pasta ou alguma Lista da subárvore já sobrescrevia o Conjunto, a movimentação é rejeitada até que as sobrescritas sejam resolvidas (B25). Vínculos das Tarefas com Negócios e Conversas não são afetados (mesmo Espaço de Trabalho). Automações do Espaço de origem deixam de agir na subárvore no mesmo ato; Automações do Espaço de origem que referenciam a Pasta como alvo de Ação continuam válidas (a referência não cruza Espaço de Trabalho), mas o documento de Automações decide se avisa o Proprietário da Automação. A operação é atômica: ou todos os mapeamentos se aplicam ou nada muda.

### 20.7 Arquivar Pasta com Tarefas vinculadas a Negócios e Conversas ativos

Arquivar não é bloqueado por Vínculos: o Vínculo não implica propriedade (A8) e o Negócio segue `aberto`. As Tarefas ficam efetivamente `arquivado`; do lado do Negócio ou da Conversa, o Vínculo permanece e a Tarefa aparece como arquivada; nenhuma Automação age sobre ela; um Agente que a consulte por Ferramenta a lê como arquivada. O evento "Pasta arquivada" informa a contagem de Vínculos com registros ativos, para que produto avise antes. Enviar à lixeira mantém os Vínculos até a eliminação permanente, quando são removidos sem afetar Negócios e Conversas.

### 20.8 Excluir Pasta com Automações definidas nela e com Automações do Espaço que a referenciam

Automações com escopo na Pasta: pertencem ao Espaço de Trabalho, ficam inoperantes enquanto a Pasta está `na lixeira` e são eliminadas com ela na eliminação permanente (DO-PAS-10 / B41): escopo é essencial a uma Automação, e uma Automação "na Pasta X" sem X não tem significado; restaurar a Pasta as reativa. Automações do Espaço (ou de outro escopo) que referenciam a Pasta ou seus descendentes como alvo de Ação ("criar Lista na Pasta X") passam a ter referência inválida: continuam existindo, disparam, e a Ação falha com Execução `falhou` e Registro de Atividade; o evento "Pasta enviada à lixeira" lista essas Automações para que o ator decida. Não se bloqueia a exclusão por referências: bloquear tornaria Automações donas de contêineres.

### 20.9 Template de Pasta instanciado várias vezes e depois alterado

Cada instância é uma Pasta com identidade própria e Template de origem preenchido. Alterar o Template não altera nenhuma (A8); eliminar o Template preserva a proveniência como valor histórico. Não há "propagar alteração para instâncias" nesta versão: se o produto quiser, é operação explícita de reaplicação com mapeamento, nunca vínculo vivo. As instâncias podem divergir livremente.

### 20.10 Agente tentando criar Lista em Pasta onde só tem permissão de ver

A Ferramenta "criar Lista" exige `criar` na Pasta. Em nome de um Membro: permissão efetiva é a interseção (A9.3); mesmo que o Membro pudesse, o Agente não pode. Autônomo: só as próprias. A chamada falha, a Execução passa a `falhou` ou a `aguardando aprovação` se houver alternativa (B23), e o Registro de Atividade guarda a tentativa negada (RN-PAS-17). Aprovação não é concessão: um aprovador humano não "empresta" permissão ao Agente; se a ação deve ocorrer, o aprovador a pratica ele mesmo ou concede `criar` ao Agente.

### 20.11 Mover Pasta com Subpastas para dentro de outra Pasta

Inválido (RN-PAS-15, A3.4): resultaria em três níveis. O ator precisa primeiro promover ou mover as Subpastas. Não há achatamento automático.

### 20.12 Restaurar Pasta cujo Espaço está na lixeira ou foi eliminado

Espaço eliminado permanentemente: o caso não ocorre, porque a eliminação do Espaço eliminou a Pasta, mesmo que ela estivesse `na lixeira` por ato próprio anterior (A3.3, B36). Espaço `na lixeira`: a Pasta `na lixeira` por estado próprio não é restaurada no lugar (RN-PAS-13); restaura-se o Espaço primeiro, ou a restauração indica outro Espaço como pai — restauração e movimentação no mesmo ato, com mapeamento e demais exigências de RN-PAS-14. Espaço `arquivado`: a restauração é aceita e a Pasta fica efetivamente `arquivado`.

### 20.13 Pasta arquivada e Automação agendada que cria Tarefa na sua Lista

A Automação (de qualquer escopo) dispara pelo agendamento, mas a Ação "criar Tarefa" na Lista efetivamente `arquivado` é inválida (RN-PAS-11): Execução `falhou`, Registro de Atividade. Recomendação ao documento de Automações: Automações com escopo dentro de Pasta arquivada nem disparam (RN-PAS-08); as de escopo externo disparam e falham na Ação.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Tarefas "da Pasta" | Lista | A3.2. A Pasta só as alcança transitivamente. |
| Automações "da Pasta" | Espaço de Trabalho | A Pasta é escopo (referência), não contêiner (documento 01, seção 8). |
| Template de Pasta | Catálogo do Espaço de Trabalho | Reutilização é organizacional (documento 01, 7.6). |
| Conjunto de Status herdado, Definições de Campo do Espaço | Espaço | Ponto de definição imutável (B25). A Pasta os consome e repassa. |
| Status atual, Valores de Campo, Responsáveis, datas | Tarefa | A Pasta define configuração; o valor é do registro (A5.1). |
| Visualizações pessoais | Membro | A8. |
| Proprietário | Não existe para contêineres | A7 não lista contêineres; governança por `administrar` (DO-PAS-03). |
| Campos Personalizados sobre a Pasta | Não existem | A5.2 não prevê contêineres como entidade-alvo (seção 25). |
| Tags, Equipes, Papéis | Espaço de Trabalho | RN-ET-13. Uma Tag aplicada a Tarefas da Pasta não pertence à Pasta. |
| Vínculos das Tarefas com Negócios, Contatos, Conversas | Os dois registros vinculados | A8. A Pasta não é lado de Vínculo. |
| Comentários "na Pasta" | Tarefas (ou outros registros comentáveis) | A8 não lista contêineres como comentáveis; `comentar` em `subárvore` age sobre as Tarefas. |
| Membros "da Pasta" | Espaço de Trabalho | Concessão direta é permissão sobre a Pasta, não membresia dela. |
| Painéis, Fontes de Dados que a referenciam | Painel | Referência, não contenção. |
| Registros de Atividade sobre a Pasta | Espaço de Trabalho | Imutáveis; sobrevivem à Pasta (INV-ET-12). |
| Arquivos anexados a Tarefas da subárvore | Espaço de Trabalho | A8; a eliminação da Pasta remove referências, não Arquivos. |
| Política de lixeira, prazo de eliminação | Espaço de Trabalho | B34. A Pasta só deriva a Previsão de eliminação. |

## 22. Exemplos conceituais

**Exemplo 1 — Agência com clientes.** No Espaço "Atendimento", a agência cria uma Pasta por cliente: "Cliente Alfa", "Cliente Beta". Cada Pasta contém as Listas "Briefings", "Produção", "Aprovações". O Espaço define o Conjunto de Status padrão (A fazer, Em produção, Em aprovação, Concluído, Cancelado); a Pasta "Cliente Beta" o sobrescreve para incluir "Aguardando cliente" (categoria `em andamento`), com mapeamento vazio porque ainda não havia Tarefas. A Definição de Campo "Número do job" está no Espaço; "Aprovador no cliente" está só na Pasta "Cliente Beta". Ao encerrar o contrato, a Pasta "Cliente Alfa" é arquivada em um ato: 3 Listas e 214 Tarefas ficam efetivamente arquivadas; os 12 Vínculos com o Negócio "Alfa — renovação" permanecem e o Negócio, ainda `aberto`, exibe as Tarefas como arquivadas.

**Exemplo 2 — Pasta privada em Espaço aberto.** No Espaço "Pessoas" (visível a todos os Membros), a Pasta "Reestruturação Q4" é criada privada por um Administrador, que recebe `administrar` no mesmo ato e concede `ver` e `editar` em `subárvore` à Equipe "Diretoria". Os demais Membros não veem a Pasta na listagem do Espaço; o Painel "Tarefas por Espaço" mostra a Diretoria com 40 Tarefas a mais do que os outros veem. O Assistente padrão, sem concessão, responde "não encontrei" a perguntas sobre a reestruturação. Quando o Administrador é removido e é o único com `administrar`, a concessão passa ao Sucessor indicado na remoção.

**Exemplo 3 — Movimentação entre Espaços.** A Pasta "Lançamento App" nasce em "Marketing" e precisa ir para "Produto". Suas 4 Listas herdavam o Conjunto de Status de "Marketing" (Ideia, Em produção, Publicado); "Produto" usa (Backlog, Em desenvolvimento, Em teste, Entregue) e bloqueia sobrescrita. O ator mapeia: Ideia → Backlog, Em produção → Em desenvolvimento, Publicado → Entregue; a Definição de Campo "Canal de mídia" (do Espaço "Marketing") tem 60 Valores, que passam a `arquivado` nas Tarefas (B37); se a organização quiser continuar a usá-los, cria Definição equivalente na Pasta e copia os valores — operação de produto, não ontológica. A operação é atômica; 88 Tarefas recebem Registro de Atividade de status por mapeamento; a Automação "avisar no Slack ao publicar", de escopo "Marketing", deixa de agir; a Automação "criar checklist de QA", de escopo na Pasta, continua.

**Exemplo 4 — Template.** A Pasta "Onboarding — modelo" vira Template de Pasta com 3 Listas, 5 Visualizações, 2 Definições de Campo e 1 Automação de escopo. O RH instancia "Onboarding — Ana", "Onboarding — Bruno". Cada uma nasce não privada, herdando permissões do Espaço "RH", com Template de origem preenchido. Um mês depois o Template ganha uma quarta Lista; "Ana" e "Bruno" não mudam.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
└── Espaço (0..N)  [origem da herança da estrutura]
    ├── Lista direta (0..N)  ──── Pasta é opcional
    └── PASTA (0..N)  [pai: 1 Espaço; estado próprio + efetivo; privada?; sem Proprietário]
        ├── Configuração contida
        │   ├── Conjunto de Status sobrescrito (0..1)  [modo: herdado | sobrescrito | bloqueado]
        │   ├── Definição de Campo adicional (0..N)   [acumula]
        │   ├── Tipo de Tarefa adicional (0..N)       [acumula]
        │   └── Visualização do contêiner (0..N)
        ├── Concessão direta / compartilhamento (0..N; ≥1 administrar se privada)
        ├── Subpasta (0..N)  [= Pasta com pai Pasta; não contém Subpasta]
        │   └── Lista (0..N) → Tarefa (0..N)
        └── Lista (0..N) → Tarefa (0..N)

Referências à Pasta (não contenção):
  Automação [escopo = Pasta] ─── pertence ao Espaço de Trabalho; eliminada com a Pasta
  Painel (Fonte de Dados) ─── filtra por permissão do visualizador
  Sessão de Chat / Contexto (âncora) ─── perde a âncora na eliminação
  Template de Pasta ←── proveniência "criada a partir de"; sem vínculo vivo

Herança: Espaço ⇒ Pasta ⇒ Subpasta ⇒ Lista ⇒ Tarefa (só consome)
Estado efetivo: max(próprio, efetivo do pai), ordem ativo < arquivado < na lixeira
Nenhuma aresta atravessa a fronteira do Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-PAS-01.** A Pasta é agrupador opcional: uma Lista pode ter um Espaço como pai. Aplica A3.1. CONSOLIDADA.
- **DO-PAS-02.** Subpasta é a mesma entidade Pasta com pai Pasta; este documento é a fonte das regras comuns, e o documento de Subpasta registra apenas as restrições. Aplica B3. CONSOLIDADA.
- **DO-PAS-03.** A Pasta não tem Proprietário; a governança decorre de `administrar` (Papel, herança ou concessão direta). Decorre de A7, que não lista contêineres. Consequência: não há sucessão de Pastas em B28, só da concessão `administrar` de Pasta privada (DO-PAS-09 / B38). RECOMENDADA.
- **DO-PAS-04 / B36.** A cascata de estado é **derivação**: cada registro tem estado próprio e estado efetivo (o mais restritivo entre o próprio e os efetivos dos ancestrais). Arquivar ou enviar a Pasta à lixeira não reescreve descendentes; restaurar devolve a cada um o seu estado próprio; restaurar da lixeira devolve a Pasta ao Estado próprio anterior à exclusão; o estado próprio de um descendente é alterável sob Pasta restritiva e um descendente não `na lixeira` pode ser movido para fora (RN-PAS-11). Justificativa: cascata por escrita perde a informação de quais descendentes já estavam arquivados por si e obriga a restaurar tudo ou nada. Consolidada em B36 (vale para Espaço, Subpasta, Lista e Tarefa).
- **DO-PAS-05 / B39.** Nome de Pasta é único entre irmãos `ativo` ou `arquivado` do mesmo pai. Justificativa: Agentes, Automações e Membros referenciam contêineres por caminho; ambiguidade de caminho torna Ferramentas e Ações não determinísticas. Consolidada em B39 (vale para todos os níveis).
- **DO-PAS-06.** Sobrescrever ou retornar a herdado o Conjunto de Status quando há Tarefas na subárvore exige mapeamento explícito e completo de Definições de Status; sem ele a operação é inválida. Bloquear é rejeitado enquanto houver sobrescritas descendentes (B25). Preserva INV-PAS-06 e A4.2. RECOMENDADA.
- **DO-PAS-07 / B40.** Mover Pasta entre Espaços é atômico, exige `administrar` na Pasta e `criar` no destino; mapeia o Conjunto de Status por categoria; arquiva Valores de Campo órfãos (B37); preserva concessões, privacidade, configuração própria, Vínculos e Dependências; troca a fonte de herança de permissão e de Automações; rejeitada por bloqueio, profundidade ou colisão de nome. Consolidada em B40.
- **DO-PAS-08 / B38.** Privacidade é monotônica: não existe flag que amplie visibilidade além da do pai; "não privada" significa "herda". Acesso a uma Pasta sem acesso ao Espaço só por compartilhamento direto, que expõe apenas os nomes dos ancestrais. Justificativa: evita que contêineres se tornem canal de vazamento (mesmo princípio de B20). Consolidada em B38 (e).
- **DO-PAS-09 / B38.** Toda Pasta privada tem, em todo instante, ao menos um Membro `ativo` com `administrar` por concessão direta; quem privatiza (sempre um Membro `ativo` sem base Convidado) a recebe no ato; ao remover ou suspender o último, a concessão passa ao Sucessor no mesmo ato — exceção a B28, agora registrada em B28 e B38. Proprietário e Administradores do Espaço de Trabalho concedem acesso a Pasta privada apenas por ato de governança registrado. Consolidada em B38 (b)–(d).
- **DO-PAS-10 / B41.** Automações cujo escopo é uma Pasta (ou descendente) ficam inoperantes enquanto o escopo não está efetivamente `ativo` e são eliminadas na eliminação permanente do escopo. Automações de outros escopos que referenciam a Pasta como alvo de Ação não bloqueiam a exclusão; passam a ter referência inválida. Consolidada em B41; o documento de Automações a referencia.
- **DO-PAS-11 / B25.** Modos de propagação dos aspectos que B25 não fixava: Tipos de Tarefa **acumulam**; Visualizações padrão **substituem**; Funcionalidades habilitadas **substituem**, por funcionalidade (a versão anterior — "restringem" — foi substituída na harmonização por B25; desabilitar nunca apaga dados). Incorporada a B25.
- **DO-PAS-12.** Template de Pasta captura estrutura (Subpastas, Listas), configuração sobrescrita (Conjunto de Status, Definições de Campo, Tipos de Tarefa, Visualizações), Automações de escopo (copiadas como Automações novas na instanciação) e, opcionalmente, Tarefas modelo. Não captura privacidade, concessões, estado, Vínculos nem Registros de Atividade. Instância nasce herdando permissões do pai. Aplica A8. RECOMENDADA.
- **DO-PAS-13.** A Pasta não recebe Valores de Campo: Definições de Campo criadas nela têm como entidade-alvo Tarefas. Aplica A5.2. CONSOLIDADA; a ampliação é questão aberta (C13).

Nenhuma decisão contradiz A1–A9 ou B1–B99. As decisões marcadas "/ Bnn" foram consolidadas na constituição na harmonização e na revisão da fase 2; a auditoria da fase 6 aplicou DO-PAI-07 / RN-PAI-20 (12.2, 12.4) e B47 (12.1, RN-PAS-16).

## 25. Questões em aberto

1. **Pasta como lado de Vínculo** (C16). A8 define Vínculo entre registros de conteúdo; "Pasta do cliente Alfa ↔ Empresa Alfa" ou "Pasta ↔ Negócio" seria a forma natural de ligar um projeto ao CRM. Consequência e alternativas registradas em C16.
2. **Campos Personalizados sobre contêineres** (C13, ampliada). "Data de entrega do projeto", "orçamento", "gerente" na Pasta não existem (DO-PAS-13). Consequência: organizações usarão a descrição como campo livre. Alternativa: incluir Pasta e Lista como entidades-alvo em A5.2.
3. **Limite de Pastas por Espaço e de profundidade de conteúdo** (C8). Limites impostos hoje não listam Pastas. Consequência de produto, não ontológica.
4. **Reaplicação de Template em instâncias existentes.** Sem vínculo vivo (A8), "atualizar todas as Pastas criadas do Template X" seria operação explícita com mapeamento. Consequência: sem ela, padronização posterior é manual.

Resolvidas neste documento ou na harmonização, sem pendência aberta: cascata por derivação (B36); privacidade monotônica (B38); sucessão de `administrar` em Pasta privada (B38); destino de Automações de escopo na eliminação (B41); conteúdo do Template de Pasta (DO-PAS-12); exposição dos ancestrais a quem tem acesso só por compartilhamento — apenas os nomes, para navegação (B38); modo de herança de Tipos de Tarefa — acumulam (B25; o ponto de definição mais alto permanece o Espaço, C6).
