# CHECKLIST

> Domínio: Estrutura de Trabalho | Documento 08 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Checklist** é uma lista nomeada e ordenada de passos de verificação dentro de uma Tarefa. Cada passo é um **Item de Checklist**: um texto que alguém marca como concluído ou não. O Checklist existe para decompor a execução de **uma** Tarefa em passos pequenos demais para merecerem identidade própria: passos que não precisam de status, de datas, de discussão nem de histórico separado, apenas de um "feito / não feito".

Três propriedades o definem:

1. **É componente interno do agregado Tarefa** (B2). Checklist, Item e Subitem não têm identidade fora da Tarefa que os contém. Não são referenciáveis por Vínculo, Dependência, menção, Fonte de Dados de Painel ou Contexto de Agente. Nada na plataforma aponta para um Item; o Item aponta, no máximo, para a Subtarefa em que foi convertido.
2. **É enumeração, não trabalho rastreável.** Um Item registra que um passo foi dado, por quem e quando; não registra como o passo progrediu. O que precisa progredir é Tarefa (ou Subtarefa, B1).
3. **Seu progresso é derivado e informativo.** A proporção de Itens concluídos é calculada, nunca gravada, e não altera o status da Tarefa.

O Checklist não é uma "mini-lista de Tarefas", não é um formulário, não é uma Etapa de Funil e não é a descrição da Tarefa com marcações.

## 2. Propósito

1. **Decompor sem fragmentar.** Uma Tarefa "publicar campanha" tem dez verificações triviais (revisar título, testar link, aprovar imagem). Criar dez Subtarefas espalha o trabalho em dez registros com status, datas e histórico que ninguém preencherá. O Checklist mantém os passos junto da Tarefa, com o custo mínimo de um booleano por passo.
2. **Padronizar execução.** Templates de Checklist permitem que a organização repita o mesmo roteiro (onboarding, fechamento, publicação) em Tarefas diferentes, sem que cada Membro reinvente os passos.
3. **Dar à IA um plano legível.** Um Agente que recebe uma Tarefa com Checklist recebe um plano de execução explícito; pode marcar passos concluídos à medida que age, sem que cada passo vire unidade de trabalho com custo de rastreio próprio.
4. **Oferecer um caminho de promoção.** Quando um passo cresce (precisa de responsável com prazo, discussão, bloqueio), a conversão em Subtarefa (DO-TAR-11) dá a ele identidade, sem exigir que o Checklist tivesse sido projetado como árvore de Tarefas desde o início.

## 3. Natureza da entidade

- **Entidade interna do agregado Tarefa** (Glossário, "Agregado"): a Tarefa responde pela consistência dos seus Checklists; eles não existem sem ela, seguem-na em toda cascata e são registrados no histórico dela.
- **Sem identidade externa.** Possui um **identificador local**, estável e opaco, que serve apenas para endereçar o Checklist e cada Item dentro de edições, Ferramentas e Registros de Atividade da Tarefa. Esse identificador não é identidade ontológica: nenhum registro fora do agregado o referencia (INV-CHK-01).
- **Não é Ator, não é configuração, não é Evento.** Age-se sobre ele; ele não age. Não define nada; consome, pela Tarefa, a Funcionalidade "Checklists" e a Funcionalidade "exigir Checklists concluídos" da Lista.
- **Não tem estado de ciclo de vida próprio** (A4.1): o estado efetivo é o da Tarefa. Item tem uma **condição** binária (concluído ou não) e uma marca terminal (convertido), que não são Status (A4.2) nem estado de sistema.
- **Não é Template**: o Template de Checklist é entidade do catálogo de Templates do Espaço de Trabalho (DO-ET-13); o Checklist é a instância viva dentro da Tarefa, sem vínculo com o Template (A8).
- **Não é Subtarefa**: Subtarefa é Tarefa (B1); Item nunca é.

## 4. Fronteira conceitual

### 4.1 O que é

- Lista nomeada e ordenada de Itens dentro de uma Tarefa; uma Tarefa pode ter vários Checklists, ordenados entre si.
- Item: texto, ordem, concluído (com momento e Ator), Responsável 0..1 Membro, 0..N Subitens.
- Subitem: Item cujo pai é um Item; mesmas propriedades; não contém Subitens.
- Progresso derivado por Checklist e agregado por Tarefa.

### 4.2 O que não é

- **Não é Subtarefa.** Subtarefa tem identidade, status, datas, Responsáveis 0..N, Comentários, histórico e permissões próprios. Item tem um booleano.
- **Não é Comentário.** Comentário é manifestação de um Ator sobre a Tarefa, com autor e respostas encadeadas; Item é passo a executar, sem autor no sentido de Comentário (tem Criador registrado só no Registro de Atividade da Tarefa).
- **Não é a descrição.** Marcações de texto na descrição são formatação; não têm Responsável, progresso nem eventos.
- **Não é Etapa de Funil.** Etapa é posição de um Negócio em um Funil (A4.4). Checklist é sequência de passos de uma Tarefa. Não há relação entre os dois conceitos.
- **Não é Formulário nem Campo Personalizado.** Um Item não guarda valor; guarda concluído ou não. "Preencher o CNPJ" é um Item cujo resultado vive em um Valor de Campo da Tarefa, não no Item.

### 4.3 Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Checklist × Subtarefa** | Componente sem identidade; lista de passos com um booleano cada; progresso derivado; nunca aparece em Visualização nem em Painel como registro. | Tarefa com pai (B1); identidade global, status, datas, Responsáveis 0..N, agregado próprio (inclusive Checklists), permissões próprias, presença em Visualizações e Painéis. | Se um passo precisa ser endereçado de fora da Tarefa, progredir por status, ter prazo ou ser discutido, é Subtarefa. Checklist é a decomposição que **não** merece identidade. |
| **Item de Checklist × Subtarefa** | Texto + concluído + Responsável 0..1 + Subitens (um nível). Sem histórico próprio, sem Comentários, sem datas. Convertível em Subtarefa; não há conversão inversa. | Tarefa completa; pode ter Checklists próprios; pode ter Subtarefas até a Profundidade máxima. | A tabela 4.4 enumera o que o Item não tem. A conversão é a única ponte, unidirecional. |
| **Checklist × Template de Checklist** | Instância viva dentro de uma Tarefa; Itens com condição; Responsáveis vigentes; segue a cascata da Tarefa. | Entidade do catálogo de Templates do Espaço de Trabalho: nome, Itens e Subitens como descrição, Responsável sugerido opcional; sem condição de concluído; não pertence a Tarefa. | Instanciar copia a estrutura para dentro de uma Tarefa e registra Proveniência; alterar o Template depois não alcança Checklists já instanciados (A8). |
| **Checklist × Descrição com lista de marcação** | Componente estruturado: cada Item tem Responsável possível, momento e Ator de conclusão, ordem manual, progresso derivado, eventos da Tarefa com dados do Item, sujeito à Funcionalidade "Checklists". | Texto rico (DO-TAR-03). Uma lista de marcação na descrição é formatação; marcar ou desmarcar é "descrição alterada", sem Responsável, sem progresso, sem evento próprio, sem Template. | Se o produto oferecer "converter lista da descrição em Checklist", é ato explícito que cria Itens novos; nunca inferência. |
| **Item de Checklist × Comentário** | Passo a executar; concluído/não; Responsável; sem autor no sentido de Comentário, sem respostas encadeadas, sem menções, sem Anexos. | Manifestação sobre a Tarefa: autor imutável, conteúdo rico, Anexos, menções, respostas, resolução (DO-TAR-07). | "Resolvido" (Comentário) e "concluído" (Item) são conceitos distintos. Um Item não é lugar de discussão; discute-se em Comentário na Tarefa. Item não é mencionável (não tem identidade). |
| **Checklist × Etapa de Funil** | Passos de execução de uma Tarefa, dentro do agregado; concluídos individualmente; sem ordem imposta de execução. | Posição nomeada e ordenada de um Negócio dentro de um Funil (Glossário); um Negócio está em exatamente uma Etapa por vez. | Nenhuma relação. "Etapas de execução" de uma Tarefa não são Etapas; são Itens. Negócio não tem Checklist: se a organização precisa de roteiro por Etapa, cria Tarefas vinculadas ao Negócio (A2.2), possivelmente por Automação do Funil. |

### 4.4 O que um Item de Checklist NÃO possui e uma Tarefa/Subtarefa possui

| Capacidade | Tarefa / Subtarefa | Item de Checklist | Onde a necessidade vai parar |
| --- | --- | --- | --- |
| Identidade externa referenciável por Vínculo, Dependência, menção, Fonte de Dados, âncora de Sessão de Chat | Sim | **Não** (só identificador local, INV-CHK-01) | Converter em Subtarefa. |
| Status personalizável (A4.2) e categoria de status | Sim | **Não**: booleano concluído | Subtarefa. |
| Prioridade | Sim | **Não** | Ordem manual no Checklist é a única ordenação. |
| Data de início, Data de vencimento, Estimativa | Sim | **Não** | Subtarefa. Prazo do passo é o prazo da Tarefa. |
| Valores de Campo Personalizado | Sim | **Não** | O resultado de um passo vive em Valor de Campo da Tarefa. |
| Tags | Sim | **Não** | Tags são da Tarefa. |
| Comentários | Sim | **Não** | Comentário na Tarefa citando o passo em texto. |
| Anexos | Sim | **Não** | Anexo na Tarefa ou no Comentário. |
| Dependências | Sim | **Não** | Subtarefa com Dependência. |
| Registros de Tempo | Sim | **Não** | Tempo registrado na Tarefa. |
| Observadores | Sim | **Não** | Observadores da Tarefa recebem os eventos de Item. |
| Responsáveis 0..N (Membro ou Agente, B7) | Sim | **Responsável 0..1 Membro** (A7; DO-CHK-02) | Dois responsáveis ou um Agente responsável: Subtarefa. |
| Histórico próprio (visão de Registros de Atividade com o registro como objeto) | Sim | **Não**: alterações de Item são Registros de Atividade **da Tarefa**, com os dados do Item (RN-TAR-23) | Histórico da Tarefa, filtrado por Checklist. |
| Permissões próprias, compartilhamento, Compartilhamento público próprio | Sim | **Não**: as da Tarefa | — |
| Estado de ciclo de vida próprio (`ativo`, `arquivado`, `na lixeira`) | Sim | **Não**: o da Tarefa | — |
| Presença em Visualizações como registro autônomo | Sim | **Não**: aparece apenas dentro da Tarefa | Subtarefa. |
| Contagem em Painéis como unidade de trabalho | Sim | **Não**: Painéis expõem **progresso de Checklist como Métrica da Tarefa** (DO-CHK-08), nunca o Item como registro | Métrica "progresso de Checklists" por Tarefa, Lista, Responsável. |
| Recorrência, Template próprio de Tarefa, Proveniência como registro | Sim | **Não**: só a marca de convertido (destino) e, no Checklist, a Proveniência de Template de Checklist | — |
| Subestrutura ilimitada | Subtarefas até a Profundidade máxima | **Um nível** (Subitem), sem Subitens de Subitem | Além disso, é Subtarefa (DO-CHK-04). |

## 5. Identidade

O Checklist e o Item **não têm identidade ontológica**: não há nada fora da Tarefa que precise reconhecê-los como "o mesmo" ao longo do tempo. Existe um identificador local (seção 3) porque Ferramentas, edições concorrentes e Registros de Atividade precisam dizer *qual* Item foi alterado; esse identificador vive e morre com o agregado.

**Teste de identidade (dentro do agregado).** Se o nome do Checklist, sua ordem, o texto de cada Item, a ordem, o Responsável e a condição mudarem, continua sendo o mesmo Checklist *para o histórico da Tarefa*: os Registros de Atividade dizem "Item X: texto alterado de A para B". Fora do agregado, a pergunta não se coloca: nenhum registro depende de que um Item continue existindo.

Consequências:

- Mover, arquivar, restaurar ou copiar a Tarefa nunca "preserva a identidade" do Checklist, porque não há identidade a preservar; preserva-se o **conteúdo**. Uma cópia da Tarefa produz Checklists novos, indistinguíveis dos originais exceto pelo agregado a que pertencem (RN-CHK-13).
- A Subtarefa criada por conversão **não referencia o Item** (não há o que referenciar). Sua Proveniência é objeto de valor: Tarefa de origem, nome do Checklist e texto do Item à época (DO-TAR-11; RN-CHK-10). A referência é unilateral, do Item para a Subtarefa, e também objeto de valor (identificador e título à época), navegável enquanto a Subtarefa existir.
- Texto de Item não é único: dois Itens iguais no mesmo Checklist são válidos.

## 6. Atributos fundamentais

### 6.1 Checklist

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador local | nativo | sim | Estável dentro do agregado; sem valor fora dele (INV-CHK-01). |
| Tarefa | referência (Tarefa) | sim | O agregado a que pertence. Imutável: um Checklist não migra entre Tarefas (copiar cria outro). |
| Nome | nativo | sim | Texto curto, não vazio, não único. O produto pode preencher um padrão. |
| Ordem | nativo | sim | Posição manual entre os Checklists da mesma Tarefa. Atributo, não Visualização: a ordem é significado compartilhado, não preferência de quem vê (DO-CHK-05). |
| Itens | contenção | — | 0..N Itens ordenados (seção 7). |
| Progresso | derivado | condicional | Itens contáveis concluídos ÷ Itens contáveis. **Contável** = Item de primeiro nível não convertido (Subitens não contam; DO-CHK-06). Vazio (não aplicável) quando não há Item contável: nunca 0% nem 100% por ausência. |
| Concluído | derivado | condicional | Verdadeiro quando há ao menos um Item contável e todos estão concluídos. Base do evento "Checklist concluído" (seção 18). |
| Proveniência | objeto de valor | não | Template de Checklist de origem (identificador, nome e, se houver, versão à época). Sem vínculo vivo (A8). |
| Criador, momento de criação | referência (Ator), nativo | sim | Registrados no Registro de Atividade da Tarefa e mantidos no componente para exibição. Imutáveis. |

### 6.2 Item de Checklist (e Subitem)

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador local | nativo | sim | Idem 6.1. |
| Checklist | referência (Checklist) | sim | Contêiner. Imutável dentro do agregado (mover Item entre Checklists da mesma Tarefa é uma edição de ordem e contêiner, permitida — RN-CHK-04). |
| Item pai | referência (Item) | não | Preenchido apenas em Subitens. Um Subitem não tem Subitens (INV-CHK-03). |
| Texto | nativo | sim | Não vazio (INV-CHK-02). Texto simples com menções opcionais a Membro, Equipe ou Agente, que notificam sob as regras de DO-TAR-19 e não criam Responsável. |
| Ordem | nativo | sim | Posição manual entre irmãos (Itens do mesmo Checklist ou Subitens do mesmo Item). |
| Concluído | nativo (booleano) | sim | Padrão falso. |
| Momento de conclusão | nativo | condicional | Preenchido ao concluir; esvaziado ao reabrir (o histórico fica no Registro de Atividade da Tarefa). |
| Ator que concluiu | referência (Ator) | condicional | Qualquer tipo de Ator (A6.1) com `editar` na Tarefa: Membro, **Agente**, Automação, Integração. Com ator delegante quando houver (A6.2). Esvaziado ao reabrir. |
| Responsável | referência (Membro) | não | 0..1 Membro `ativo` (ou `suspenso`, mantendo) com `ver` na Tarefa (RN-CHK-06). Nunca Agente (DO-CHK-02). Independente do Responsável do Item pai. |
| Convertido | objeto de valor | não | Presente quando o Item foi convertido em Subtarefa: identificador e título da Subtarefa à época, momento, Ator. Item convertido é terminal: não é concluído nem reaberto, não conta no progresso, não tem Subitens (RN-CHK-10). |
| Condição | derivado | sim | `aberto`, `concluído` ou `convertido`. Leitura única para Painéis, Automações e IA. Não é Status nem estado de sistema. |
| Subitens | contenção | — | 0..N, só em Itens de primeiro nível. |

### 6.3 O que o Checklist consome (não são atributos)

Da Lista da Tarefa (B25): Funcionalidade "Checklists" (se desabilitada, Checklists existentes ficam somente leitura, sem destruição — RN-LIS-21; DO-LIS-14) e Funcionalidade "exigir Checklists concluídos" (RN-CHK-09). Do Espaço de Trabalho: Templates de Checklist e Limites impostos (B34). Da Tarefa: permissões, estado efetivo, Lista.

## 7. Entidades internas ou componentes

### 7.1 Item de Checklist

Definido em 6.2. É componente do Checklist, que é componente da Tarefa: dois níveis de contenção sem identidade. Um Item de primeiro nível contém 0..N Subitens.

### 7.2 Subitem

**Subitem é Item com Item pai preenchido**, com exatamente as mesmas propriedades (texto, ordem, concluído com momento e Ator, Responsável 0..1). Não contém Subitens (INV-CHK-03). Não conta no progresso do Checklist; o Item pai tem um progresso próprio derivado (Subitens concluídos ÷ Subitens), exibido como detalhe (DO-CHK-06).

**Aninhamento limitado a um nível.** Justificativa: dois níveis sem identidade já são o máximo que se lê de relance; a partir do terceiro, quem organiza está construindo uma árvore de trabalho que precisa de responsáveis múltiplos, prazos e referências, e essa árvore já existe na ontologia com identidade: Subtarefa (B1, até a Profundidade máxima do Espaço de Trabalho). Permitir profundidade em Itens criaria uma árvore-sombra invisível a Visualizações, Painéis e Dependências (DO-CHK-04).

**Concluir Item com Subitens abertos: permitido** (DO-CHK-07). Coerente com RN-TAR-18 (concluir Tarefa com Subtarefas abertas é permitido por padrão) e com a natureza do Item: o booleano do Item é a palavra final sobre o passo; os Subitens são detalhe. Nenhuma propagação em nenhuma direção: concluir o Item não conclui os Subitens; concluir todos os Subitens não conclui o Item. O produto pode oferecer "concluir Item e Subitens" como ato explícito único, registrado como conclusão de cada um.

### 7.3 Template de Checklist

Entidade do catálogo de Templates do Espaço de Trabalho (A8; DO-ET-13), com identidade e Criador, descrita aqui porque nenhum outro documento a detalha. Conteúdo: nome; Itens e Subitens como **descrição** (texto, ordem, Item pai), sem condição de concluído; por Item, **Responsável sugerido** opcional (Membro). Não pertence a Tarefa, Lista ou Espaço: é reutilizável em qualquer Tarefa do Espaço de Trabalho (INV-ET-07 impede cruzar Espaços de Trabalho).

**Instanciar** (dentro de uma Tarefa, por Ator com `editar`) cria um Checklist novo com todos os Itens abertos, na ordem do Template, com Proveniência; Responsáveis sugeridos são aplicados só se o Membro estiver `ativo` e tiver `ver` na Tarefa; os demais são descartados com Registro de Atividade (RN-CHK-11). Nenhuma alteração posterior no Template alcança o Checklist; nenhuma alteração no Checklist alcança o Template (A8; 20.7).

**Salvar como Template** (ato inverso, por Membro com permissão de criar Templates no Espaço de Trabalho): cria um Template a partir de um Checklist existente, copiando nome, textos, ordem e Subitens, sem condições de concluído e sem Itens convertidos; Responsáveis vigentes viram Responsáveis sugeridos se o Ator assim indicar.

**Template de Checklist × Checklist descrito em Template de Tarefa.** Um Template de Tarefa descreve Checklists como parte da sua estrutura (documento 06, seção 4). Não são Templates de Checklist: são componentes do Template de Tarefa. Um Template de Tarefa **pode referenciar** um Template de Checklist para não duplicar o roteiro; na instanciação, a referência é resolvida e o Checklist criado tem Proveniência para o Template de Checklist. Remover o Template de Checklist referenciado deixa o Template de Tarefa com referência inválida, tratada na instanciação (Checklist omitido, Registro de Atividade).

### 7.4 Progresso (derivado, não componente)

Progresso de Checklist (6.1), progresso de Subitens por Item (7.2) e **Progresso de Checklists da Tarefa** (Itens contáveis concluídos ÷ Itens contáveis, somados sobre todos os Checklists da Tarefa; vazio se não houver Item contável) são derivados: nunca gravados, nunca editáveis, nunca fonte de status. Este último é atributo derivado da Tarefa, listado em tarefa.md 6.1 por pedido deste documento (DO-CHK-08; B48).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a Tarefa | Tarefa | contenção (agregado) | Tarefa → Checklist | Exatamente uma; imutável. Sem existência fora. |
| contém Itens | Item de Checklist | contenção | Checklist → Item | 0..N, ordenados. |
| Item contém Subitens | Item de Checklist | contenção | Item → Item | 0..N; um nível (INV-CHK-03). |
| Item tem Responsável | Membro | associação | Item → Membro | 0..1. Exige `ver` na Tarefa. Não é propriedade nem permissão. |
| Item concluído por | Ator | referência | Item → Ator | 0..1; Membro, Agente, Automação ou Integração; com delegante. |
| Item convertido em | Tarefa (Subtarefa) | objeto de valor (referência unilateral, não viva) | Item → Tarefa | 0..1. Identificador e título à época. A Subtarefa não referencia o Item. |
| criado a partir de | Template de Checklist | proveniência (objeto de valor) | Checklist → Template | 0..1. Sem vínculo vivo (A8). |
| Template de Checklist referenciado por | Template de Tarefa | referência | Template de Tarefa → Template de Checklist | 0..N. Resolvida na instanciação (7.3). |
| é registrado em | Registro de Atividade | referência inversa | Registro → Tarefa (com dados do Item) | O objeto do Registro é a Tarefa; Checklist e Item constam como dados (RN-TAR-23). |
| é lido por | Execução de Agente | referência inversa (via Tarefa) | Execução → Tarefa | O Agente lê o Checklist como parte do agregado (20.12). Nunca referencia o Item como objeto. |

Distinção aplicada: **CONTER** (Itens, Subitens), **pertencer** (Tarefa), **RELACIONAR-SE** (Responsável), **REFERENCIAR** (Ator de conclusão; destino da conversão e Template, ambos por objeto de valor). O Checklist **não USA** configuração diretamente (consome pela Tarefa), **não HERDA** e **não CONFIGURA** nada.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Tarefa → Checklist | 0..N | sim | sim | estrutural | Tarefa sem Checklist é o caso comum. Vários: roteiros distintos (QA, publicação). Sem teto ontológico (20.11). |
| Checklist → Tarefa | 1 | não | não | estrutural | B2. Sem Tarefa não há Checklist; copiar cria outro. |
| Checklist → Item | 0..N | sim | sim | estrutural | Checklist vazio é válido (recém-criado ou esvaziado; 20.1). |
| Item → Item pai | 0..1 | sim | não | estrutural | Primeiro nível sem pai; Subitem com exatamente um. |
| Item → Subitens | 0..N | sim | sim | estrutural | Só em Itens de primeiro nível (INV-CHK-03). |
| Item → Responsável | 0..1 | sim | não | associativa | B2, A7. Um só: se dois precisam executar o mesmo passo, é Subtarefa. |
| Membro → Itens de que é Responsável | 0..N | sim | sim | associativa | Sem teto. |
| Item → Ator que concluiu | 0..1 | sim | não | referência | Preenchido se e somente se concluído (INV-CHK-04). |
| Item → Subtarefa de destino | 0..1 | sim | não | objeto de valor | Um Item converte uma vez (RN-CHK-10). |
| Subtarefa → Item de origem | 0 | — | — | — | Sem referência inversa; Proveniência é objeto de valor. |
| Checklist → Template de Checklist (Proveniência) | 0..1 | sim | não | objeto de valor | Um Checklist vem de no máximo um Template. |
| Template de Checklist → Checklists instanciados | 0..N | sim | sim | proveniência | Sem vínculo vivo. |
| Template de Tarefa → Template de Checklist | 0..N | sim | sim | referência | 7.3. |
| Espaço de Trabalho → Template de Checklist | 0..N | sim | sim | estrutural | Catálogo (DO-ET-13). |

Sem `DECISÃO NECESSÁRIA` pendente: as cardinalidades decorrem de B2, A7 e das decisões RECOMENDADAS da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia interna do agregado.** Tarefa → Checklist → Item → Subitem. É hierarquia de contenção sem identidade nos três níveis inferiores. Coexiste, sem se misturar, com a hierarquia de Subtarefas (Tarefa → Subtarefa → ..., com identidade). Uma Subtarefa tem os seus próprios Checklists; o Checklist da raiz não "vê" os Checklists das Subtarefas (nenhuma agregação automática de progresso entre raiz e Subtarefas; Painéis podem derivar).

**Teste de existência.** Checklist não existe sem a Tarefa; Item não existe sem o Checklist; Subitem não existe sem o Item pai. Todos são eliminados, arquivados, restaurados e movidos com a Tarefa (seção 12). Template de Checklist, Membro (Responsável), Ator de conclusão e Subtarefa de destino existem sem o Checklist.

**Pertencimento versus relação.** O Checklist *pertence* à Tarefa. O Item *relaciona-se* com o seu Responsável (associação, não propriedade: o Item não é "do" Membro) e *referencia* o Ator que o concluiu.

**Propriedade.** Não há Proprietário (A7): nem de Checklist, nem de Item. A governança é a da Tarefa, isto é, a da Lista e dos seus ancestrais (RN-TAR-08). O Template de Checklist, como entidade do Espaço de Trabalho, segue a governança do catálogo de Templates definida no documento 01; A7 não lhe atribui Proprietário.

## 11. Estados

Checklist e Item **não têm estado de ciclo de vida próprio** (A4.1). O estado efetivo é o da Tarefa: em Tarefa `arquivado`, o Checklist é somente leitura; em Tarefa `na lixeira`, invisível; restaurada, volta como estava.

O Item tem uma **condição** derivada (6.2), que não é estado de sistema nem Status:

| Condição | Significado | Transições |
| --- | --- | --- |
| `aberto` | Passo não dado. | → `concluído` (concluir); → `convertido` (converter). |
| `concluído` | Passo dado, com momento e Ator. | → `aberto` (reabrir; momento e Ator esvaziados); → `convertido` (converter; Subtarefa criada em categoria `concluído`, RN-CHK-10). |
| `convertido` | Item promovido a Subtarefa. Terminal. | Nenhuma. Pode ser removido do Checklist sem efeito sobre a Subtarefa. |

A condição não interage com o status da Tarefa: concluir todos os Itens não conclui a Tarefa; concluir a Tarefa não conclui Itens (RN-CHK-08; a Funcionalidade de RN-CHK-09 só rejeita, nunca propaga).

## 12. Ciclo de vida

### 12.1 Criação

Por Ator com `editar` na Tarefa, com a Funcionalidade "Checklists" efetiva na Lista. Origens: criação direta; instanciação de Template de Checklist (7.3); instanciação de Template de Tarefa que descreve Checklists; cópia de Tarefa ou cópia de Checklist de outra Tarefa (12.5); geração de ocorrência por Regra de Recorrência (Checklists copiados com Itens abertos, tarefa.md 12.5); conversão de Item com Subitens (os Subitens tornam-se Checklist da nova Subtarefa, RN-CHK-10); criação por Agente, Automação ou Integração. Um Checklist recém-criado é válido só com nome e Tarefa. Um Item recém-criado é válido só com texto (INV-CHK-02). Registro de Atividade na Tarefa em cada caso.

### 12.2 Alterações

Renomear, reordenar Checklists, adicionar, editar texto, reordenar, mover Item entre Checklists da mesma Tarefa, atribuir ou remover Responsável, concluir, reabrir, remover Item ou Checklist: todas são edições da Tarefa (`editar`) e geram Registro de Atividade com a Tarefa como objeto e os dados do Item (RN-TAR-23). Reordenações podem ser coalescidas em um único Registro por ato do Ator.

Remover um Checklist remove seus Itens; remover um Item remove seus Subitens. Não há lixeira de Checklist ou Item: a remoção é definitiva dentro do agregado (o conteúdo removido fica preservado no Registro de Atividade da Tarefa, como qualquer valor anterior). Justificativa: uma lixeira por componente sem identidade só faria sentido se algo externo pudesse restaurá-lo; nada externo o conhece.

### 12.3 Conversão de Item em Subtarefa (DO-TAR-11; RN-CHK-10)

Ato único de Ator com `editar` na Tarefa e `criar` na Lista (permissões de criar Subtarefa, tarefa.md 12.1), com a Funcionalidade "Subtarefas" efetiva. Cria uma Tarefa nova: pai = a Tarefa do Checklist por padrão — ou, por indicação explícita do Ator, o pai dessa Tarefa (Subtarefa irmã) ou nenhum (Tarefa raiz), sempre na mesma Lista (20.5) —, com profundidade resultante ≤ Profundidade máxima, senão rejeitado antes de qualquer efeito (20.5); título = texto do Item; Responsável = o do Item, se tiver `ver` (RN-TAR-06); Posição entre irmãs = após a última Subtarefa existente, na ordem dos Itens quando a conversão é em lote; status = primeira Definição de categoria `não iniciado` se o Item estava `aberto`, ou primeira Definição de categoria `concluído` (ou `fechado`, se o Conjunto não tiver `concluído`) se o Item estava `concluído`, com Momento de conclusão igual ao da conversão e Registro de Atividade que preserva o momento e o Ator originais; Subitens transformados em um Checklist da nova Subtarefa, com nome igual ao texto do Item, condições e Responsáveis preservados (Responsável sem `ver` descartado); Proveniência "convertida de Item" (Tarefa de origem, nome do Checklist, texto do Item) como objeto de valor; Valores de Campo obrigatórios nascem vazios, com obrigatoriedade avaliada na próxima edição (DO-TAR-20).

No Checklist de origem, o Item passa a `convertido` (destino registrado), perde os Subitens (que foram para a Subtarefa) e deixa de contar no progresso, no numerador e no denominador (DO-CHK-09). Ele **não é removido** automaticamente: a marca preserva, no lugar em que o roteiro foi escrito, o rastro de que o passo cresceu e para onde foi; remover é ato posterior opcional. Sem conversão inversa (Subtarefa → Item): destruiria histórico, Comentários e identidade.

### 12.4 Conversão de Checklist inteiro em conjunto de Subtarefas (DO-CHK-10)

Equivale a converter, em um único ato atômico, cada Item de primeiro nível ainda `aberto` (padrão) — o Ator pode incluir os `concluído` — na ordem do Checklist, com as regras de 12.3. Verificações de profundidade, Funcionalidade e Limites impostos ocorrem antes de criar qualquer Subtarefa; se uma falha, nada é criado. Itens já `convertido` são ignorados. Ao fim, o Checklist permanece com todos os Itens marcados como convertidos e progresso vazio; o produto deve oferecer removê-lo no mesmo fluxo. Não cria uma "Subtarefa agrupadora" para o Checklist: os Itens viram irmãs diretas sob a Tarefa, porque um nível intermediário só existiria para carregar o nome do Checklist e consumiria profundidade (B1) sem trabalho próprio.

### 12.5 Cópia (RN-CHK-13)

**Copiar a Tarefa** copia os Checklists como componentes novos: nome, ordem, Itens, Subitens, ordem e Responsáveis (validados por `ver` no destino); condições de concluído **não** são copiadas por padrão (a cópia é do roteiro, não do histórico; o produto pode oferecer "manter concluídos"); Itens `convertido` não são copiados (já não são Itens; a Subtarefa de destino segue a opção de copiar Subtarefas); Proveniência de Template é copiada. **Copiar um Checklist para outra Tarefa** (mesmo Espaço de Trabalho, INV-ET-07) exige `ver` na origem e `editar` no destino e produz um Checklist novo pelas mesmas regras, sem relação com a origem. "Mover Checklist entre Tarefas" não existe como operação ontológica: é copiar e remover, com Registro de Atividade em ambas as Tarefas.

### 12.6 Cascata recebida (total)

| Operação na Tarefa | Efeito nos Checklists |
| --- | --- |
| Arquivar / desarquivar | Somente leitura / editáveis de novo. Nenhuma alteração de conteúdo. |
| Excluir (lixeira) / restaurar | Invisíveis / visíveis, com condições e Responsáveis preservados. Responsável de Item que perdeu `ver` entre a exclusão e a restauração é liberado na restauração. |
| Eliminar permanentemente | Eliminados com o agregado. Registros de Atividade da Tarefa permanecem (INV-ET-12). Subtarefas nascidas por conversão são Tarefas e seguem a cascata de Subtarefas, não a do Checklist. |
| Mover de Lista | Vão com a Tarefa, intactos. Responsáveis de Item sem `ver` no destino são liberados com Registro de Atividade (mesma regra de tarefa.md 12.4 item 5, que já inclui os Itens). Se a Funcionalidade "Checklists" não for efetiva no destino, ficam somente leitura (RN-LIS-21). |
| Copiar | Checklists novos (12.5). |
| Desabilitar Funcionalidade "Checklists" na Lista | Somente leitura; nada é destruído (RN-LIS-21). Conversão em Subtarefa continua permitida, por ser a saída sancionada do uso de Checklists (DO-CHK-11). |
| Mudar Tipo de Tarefa, status, Responsáveis da Tarefa | Nenhum efeito (RN-TAR-26; RN-CHK-08). |

## 13. Regras de negócio ontológicas

- **RN-CHK-01.** Checklist, Item e Subitem existem apenas dentro de uma Tarefa e só são criados, lidos e alterados pelas permissões dessa Tarefa (B2).
- **RN-CHK-02.** Nome de Checklist e texto de Item são obrigatórios e não vazios; nenhum é único.
- **RN-CHK-03.** A ordem de Checklists na Tarefa, de Itens no Checklist e de Subitens no Item é atributo manual do componente, igual para todos os que veem a Tarefa; não é configuração de Visualização.
- **RN-CHK-04.** Um Item pode ser movido entre Checklists da mesma Tarefa e promovido de Subitem a Item ou rebaixado de Item a Subitem (se não tiver Subitens), preservando condição e Responsável. Nunca entre Tarefas (copiar cria outro).
- **RN-CHK-05.** Aninhamento máximo: Item → Subitem. Um Subitem não recebe Subitens; rebaixar um Item que tem Subitens é rejeitado.
- **RN-CHK-06.** Responsável de Item é 0..1 Membro `ativo` com permissão efetiva de `ver` a Tarefa no momento da atribuição; nunca Agente, Equipe, Automação ou Integração. Atribuir não concede permissão. Perda de `ver` (contêiner privado, concessão retirada, movimentação, remoção de Membro — B28) libera o Responsável no mesmo ato, com Registro de Atividade na Tarefa. Membro `suspenso` mantém, mas não recebe (RN-ET-08).
- **RN-CHK-07.** Concluir e reabrir Item são edições da Tarefa por Ator de qualquer tipo com `editar`, Agente incluído (A6.3; B23 para permissões a cada Ferramenta). Concluir grava momento e Ator (com delegante); reabrir os esvazia. Ser Responsável do Item não é condição nem dispensa de permissão.
- **RN-CHK-08.** Condição de Item e status da Tarefa são independentes: nenhuma propagação em nenhuma direção, entre Tarefa e Itens nem entre Item e Subitens. Automações podem fazê-lo como Ação explícita; não é regra ontológica.
- **RN-CHK-09.** Concluir a Tarefa com Itens `aberto` é permitido por padrão. A Lista pode habilitar a Funcionalidade "exigir Checklists concluídos", que rejeita a transição para categoria `concluído` ou `fechado` enquanto existir Item contável `aberto` em qualquer Checklist da Tarefa (Subitens e Itens convertidos não impedem; Checklist vazio não impede). Mesmo padrão de RN-TAR-18 (DO-TAR-10).
- **RN-CHK-10.** Conversão de Item em Subtarefa segue 12.3: ato único; Tarefa nova com Proveniência (objeto de valor); Item marcado `convertido` com identificador e título da Subtarefa à época; Subitens migram como Checklist da Subtarefa; Item convertido não conta no progresso, não é concluído nem reaberto, e pode ser removido sem efeito sobre a Subtarefa. Eliminar a Subtarefa não altera a marca (o título à época permanece). Sem conversão inversa.
- **RN-CHK-11.** Instanciar Template de Checklist cria Checklist novo com Itens `aberto`, Proveniência e Responsáveis sugeridos aplicados só a Membros `ativo` com `ver` na Tarefa; alterar ou remover o Template depois não afeta Checklists instanciados (A8).
- **RN-CHK-12.** Todo Registro de Atividade sobre Checklist ou Item tem a Tarefa como objeto e carrega nome do Checklist, texto do Item, atributo alterado, valor anterior e novo (RN-TAR-23). Não existe histórico por Item; "histórico do Checklist" é a visão filtrada dos Registros da Tarefa.
- **RN-CHK-13.** Copiar Tarefa ou Checklist cria Checklists novos com o roteiro (nome, Itens, Subitens, ordem, Responsáveis válidos, Proveniência de Template) e sem condições de concluído por padrão e sem Itens convertidos. Não há relação entre original e cópia.
- **RN-CHK-14.** Checklist só é criado ou alterado se a Funcionalidade "Checklists" for efetiva na Lista da Tarefa; desabilitá-la torna os existentes somente leitura, sem destruição (RN-LIS-21), e mantém permitidas a conversão em Subtarefa e a remoção.
- **RN-CHK-15.** Painéis expõem Checklist apenas como Métrica derivada da Tarefa (progresso, Itens abertos, Itens concluídos por Responsável ou por Ator). Nenhuma Fonte de Dados tem Item como registro (B20 continua valendo: o visualizador precisa de `ver` na Tarefa).
- **RN-CHK-16.** Eventos de Checklist e de Item são eventos da Tarefa com dados do componente (seção 18). Automações reagem a eles no escopo da Lista da Tarefa; a Condição da Automação filtra por nome de Checklist, texto de Item, Responsável ou Ator.

## 14. Invariantes

- **INV-CHK-01.** Nenhum registro fora do agregado da Tarefa referencia um Checklist, Item ou Subitem: não há Vínculo, Dependência, menção, Fonte de Dados, âncora de Sessão de Chat, Solicitação de Aprovação ou Contexto com Item como objeto. A Subtarefa convertida referencia apenas a Tarefa de origem (Proveniência).
- **INV-CHK-02.** Todo Item tem texto não vazio; todo Checklist tem nome não vazio e pertence a exatamente uma Tarefa existente.
- **INV-CHK-03.** A cadeia de pais de um Item tem comprimento 0 ou 1: nenhum Subitem tem Subitens.
- **INV-CHK-04.** Momento de conclusão e Ator que concluiu estão preenchidos se e somente se o Item está `concluído`. Item `convertido` não tem nenhum dos dois alterável e tem destino preenchido.
- **INV-CHK-05.** Todo Responsável vigente de Item é Membro `ativo` ou `suspenso` com `ver` na Tarefa; nunca Agente, nunca `pendente` ou `removido`.
- **INV-CHK-06.** Progresso de Checklist, progresso de Subitens e Progresso de Checklists da Tarefa são derivados exclusivamente das condições dos Itens; nunca gravados; vazios quando não há Item contável.
- **INV-CHK-07.** O estado efetivo de todo Checklist é o estado efetivo da sua Tarefa; nunca um Checklist editável em Tarefa `arquivado` ou `na lixeira`.
- **INV-CHK-08.** Um Item é convertido no máximo uma vez e nunca deixa de ser `convertido`.
- **INV-CHK-09.** Nenhum Checklist, Item, Responsável de Item ou Template de Checklist cruza a fronteira do Espaço de Trabalho (INV-ET-07).

## 15. Personalização

**Personalizável no Checklist** (por `editar` na Tarefa): nome, ordem, Itens (texto, ordem, contêiner, Responsável, condição), Subitens. **Personalizável fora e consumido**: Funcionalidade "Checklists" e "exigir Checklists concluídos" (Lista e ancestrais, B25; modo `substitui`, DO-LIS-14); Templates de Checklist (Espaço de Trabalho); Limites impostos (plataforma). **Não personalizável**: a lista de condições de Item; a ausência de status, datas, campos, Comentários e identidade; o aninhamento de um nível; Responsável único e humano; a ausência de propagação; a fórmula de progresso; a ausência de lixeira por componente. Não existe "Definição de Campo para Item" nem "Tipo de Item": se o produto precisar disso, o conceito é Subtarefa com Tipo de Tarefa.

## 16. Herança

O Checklist **nada herda e nada transmite**. Tudo o que o condiciona chega pela Tarefa: Funcionalidades (Lista), permissões (Lista, por herança A9.2, ou compartilhamento da Tarefa), estado efetivo (Tarefa e ancestrais), Templates e Limites (Espaço de Trabalho). Um Subitem não herda do Item pai: nem Responsável, nem condição. Um Checklist de Subtarefa não herda nada do Checklist da raiz e não contribui para o progresso dela. Instanciar Template é cópia com Proveniência, não herança (A8).

## 17. Permissões e visibilidade

Não há tupla de permissão com Checklist ou Item como Recurso (A9.1): o Recurso é sempre a Tarefa, e a origem é a herança da Lista ou o compartilhamento da Tarefa (DO-TAR-16).

| Ação na Tarefa | Sobre Checklists significa |
| --- | --- |
| ver | Ler todos os Checklists, Itens, Subitens, condições, Responsáveis, Ator de conclusão, destino de Itens convertidos (navegável só se também vir a Subtarefa) e o histórico correspondente. Compartilhamento público da Tarefa (17.4 do documento 06) expõe os Checklists como parte do agregado. |
| comentar | Nada sobre Checklists. Comentar sobre um passo é Comentário na Tarefa. |
| editar | Criar, renomear, reordenar, remover Checklists; criar, editar, mover, reordenar, remover Itens; concluir e reabrir; atribuir Responsável (que precisa de `ver`); instanciar Template; copiar de outra Tarefa (com `ver` na origem). |
| criar (na Lista) + editar | Converter Item ou Checklist em Subtarefas (12.3, 12.4). |
| administrar | Nada específico; o que vale para a Tarefa. |

**Responsável de Item e permissão.** Como em RN-TAR-06, ser Responsável exige `ver` prévio e não concede nada. Um Responsável de Item com apenas `ver` ou `comentar` não consegue concluir o próprio Item: situação válida e improdutiva, que o produto deve avisar. A recomendação de compartilhamento automático de 17.3 do documento 06 (conceder `comentar` ao atribuir) **não resolve** este caso, porque concluir exige `editar` (25.1).

**IA sujeita às mesmas regras** (A6.3; 17.5 do documento 06). Um Agente lê Checklists com `ver`, conclui Itens com `editar`, converte com `criar` + `editar`; em nome de um Membro, pela interseção (A9.3); permissão avaliada a cada Ferramenta (B23). Nível de autonomia (B22): concluir Item é ação reversível (reabrir), logo executa em `supervisionado`; converter em Subtarefa cria registro e é reversível apenas por exclusão, logo o documento de Agentes decide se é "irreversível" para efeito de aprovação (recomendação: reversível — a Subtarefa vai à lixeira). Agente nunca é Responsável de Item (DO-CHK-02), mas pode ser Ator que conclui.

## 18. Eventos relevantes

Todos são **eventos da Tarefa** (DO-CHK-12), com objeto = Tarefa e dados do componente; não existem eventos com Item como objeto (INV-CHK-01). Substituem, para Checklists, o evento genérico "Tarefa atualizada" da seção 18 do documento 06, que já os lista.

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Checklist adicionado | 12.1 | Tarefa, nome, origem (direta, Template, cópia, conversão), Ator | Automações; Observadores |
| Checklist atualizado | Renomear, reordenar | Tarefa, nome antes/depois, Ator | Auditoria |
| Checklist removido | 12.2 | Tarefa, nome, Itens removidos (conteúdo), Ator | Auditoria; Painéis |
| Checklist concluído | Derivado: passa a verdadeiro (6.1) | Tarefa, nome, Ator do último Item, momento | **Automações** (Gatilho mais útil: "quando o Checklist 'QA' concluir, mudar status"); Observadores |
| Checklist reaberto | Derivado: deixa de ser verdadeiro por reabertura ou novo Item | Tarefa, nome, Ator | Automações |
| Item de Checklist adicionado | Criação de Item ou Subitem | Tarefa, Checklist, texto, Item pai, Responsável, Ator | Notificação ao Responsável; Automações |
| Item de Checklist atualizado | Texto, ordem, contêiner, Item pai | Tarefa, Checklist, antes/depois, Ator | Auditoria |
| Item de Checklist concluído | RN-CHK-07 | Tarefa, Checklist, texto, Responsável, Ator (e delegante), momento | Automações; Painéis; Observadores; Agentes (progresso de plano) |
| Item de Checklist reaberto | RN-CHK-07 | idem | Automações |
| Responsável de Item atribuído / removido | RN-CHK-06 | Tarefa, Checklist, texto, Membro, causa (edição, revogação, movimentação, remoção de Membro), Ator | Notificação; Painéis de carga (como Métrica, não como registro) |
| Item de Checklist removido | 12.2 | Tarefa, Checklist, texto, condição à época, Ator | Auditoria |
| Item de Checklist convertido | 12.3 | Tarefa, Checklist, texto, Subtarefa criada, Subitens migrados, Ator | Automações ("Tarefa criada" também é emitido para a Subtarefa, com origem "Item convertido") |
| Template de Checklist instanciado | 7.3 | Tarefa, Template (identificador, nome, versão), Responsáveis descartados, Ator | Auditoria |
| Template de Checklist criado / alterado / removido | Catálogo do Espaço de Trabalho | Template, Ator | Auditoria; Templates de Tarefa que o referenciam |

## 19. Dependências

**O Checklist depende de**: a Tarefa (existência, permissões, estado); a Funcionalidade "Checklists" efetiva na Lista (para criar e alterar); um Ator com `editar`. O Item com Responsável depende de um Membro `ativo` com `ver`. A conversão depende da Funcionalidade "Subtarefas", da Profundidade máxima (Espaço de Trabalho) e de `criar` na Lista.

**Dependem do Checklist**: Itens e Subitens (contenção); o progresso derivado; a Funcionalidade "exigir Checklists concluídos" (só tem efeito se houver Itens); Automações cujos Gatilhos são eventos de Checklist (perdem o objeto se o Checklist é removido, sem falhar). A Subtarefa convertida **não** depende do Item: sobrevive à remoção dele.

**Documentos pressupostos ou condicionados**: Tarefa (06) fornece agregado, permissões, cascata, DO-TAR-11 e recebe os impactos listados na seção 24; Subtarefa (07) recebe as regras de conversão (12.3) e a coerência de profundidade; Lista (05) fornece as Funcionalidades "Checklists" e "exigir Checklists concluídos"; Espaço de Trabalho (01) contém os Templates de Checklist no catálogo; Automações e Agentes recebem os eventos da seção 18 e RN-CHK-07; Painéis recebem RN-CHK-15.

## 20. Casos limítrofes e ambiguidades

### 20.1 Checklist vazio

Válido: recém-criado, ou esvaziado por remoções e conversões. Progresso e Concluído vazios (não aplicáveis): nunca conta como 100% nem bloqueia "exigir Checklists concluídos". Painéis o ignoram nas Métricas de progresso. O produto pode sugerir remoção; a ontologia não a impõe.

### 20.2 Item sem texto

Inválido (INV-CHK-02). Um Item "em digitação" é estado de interface, não de domínio: só existe no agregado quando tem texto. Texto só de espaços é vazio.

### 20.3 Responsável de Item que perde acesso à Tarefa

Liberado no mesmo ato da revogação, com Registro de Atividade e evento "Responsável de Item removido" com causa (RN-CHK-06), exatamente como Responsável de Tarefa (DO-TAR-05; 20.17 do documento 06). O Item continua `aberto` ou `concluído` como estava. Alternativa rejeitada: manter "Responsável sem acesso" — geraria Métricas de carga sobre Itens que a pessoa não pode abrir.

### 20.4 Item concluído por Agente

Válido (RN-CHK-07). O Agente, com `editar` na Tarefa (própria ou por interseção com o Membro delegante), conclui o Item; o Registro de Atividade da Tarefa registra o Agente e o delegante. O Agente **não é** Responsável do Item (DO-CHK-02): concluir é ato, ser Responsável é encargo. Se o Item tinha um Membro Responsável, ele permanece registrado como Responsável e o Agente como Ator que concluiu; ambos os fatos são verdadeiros e distintos.

### 20.5 Conversão quando a Tarefa está na Profundidade máxima

Rejeitada antes de qualquer efeito (12.3), porque a Subtarefa nasceria um nível abaixo do permitido (INV-TAR-02; RN-TAR-03). Coerente com o documento de Subtarefa: a Profundidade máxima vale para toda origem de criação. Saídas: converter com **pai explícito** — o pai da Tarefa do Checklist (a nova Tarefa nasce irmã dela) ou nenhum (nasce raiz na mesma Lista) —, que é a mesma operação de 12.3 com pai indicado pelo Ator: o Item é marcado `convertido` e a Tarefa criada tem Proveniência "convertida de Item" (documento 07, 20.4); aumentar a Profundidade máxima (Administrador do Espaço de Trabalho); ou manter como Item. Se a Profundidade foi reduzida após a árvore existir (RN-ET-17), a conversão é igualmente rejeitada: o limite vale para criações novas.

### 20.6 Tarefa concluída com Itens abertos

Permitido por padrão (RN-CHK-09). Justificativa idêntica à de 20.3 do documento 06: exigir sempre obriga a marcar passos irrelevantes só para fechar; proibir sempre impede Listas rigorosas de garantir integridade. A Funcionalidade "exigir Checklists concluídos" é a mesma família de "exigir Subtarefas concluídas" (DO-TAR-10) e ambas podem estar habilitadas simultaneamente: a transição é rejeitada se qualquer uma falhar. Nunca conclui Itens silenciosamente. Itens de Checklists de Subtarefas não contam para a raiz (cada Tarefa avalia os próprios).

### 20.7 Template de Checklist alterado após instanciado

Sem efeito nos Checklists já criados (A8; RN-CHK-11). A Proveniência guarda identificador, nome e versão à época; o produto pode exibir "há versão mais nova do Template" e oferecer reinstanciar, que cria outro Checklist. Remover o Template não remove Checklists instanciados nem apaga a Proveniência.

### 20.8 Automação que reage a "Item concluído"

O evento existe, **como evento da Tarefa** com dados do Item (DO-CHK-12; seção 18). A Automação, no escopo da Lista, filtra por Condição (texto do Item, nome do Checklist, Responsável, Ator). Recomendação: expor também "Checklist concluído" (derivado), que é o Gatilho realmente útil ("quando o roteiro de QA terminar, mover para Em revisão"). Alternativa rejeitada: evento com Item como objeto — exigiria identidade de Item, contrariando B2 e INV-CHK-01, e faria Registros de Atividade apontarem para objetos que não existem fora da Tarefa.

### 20.9 Checklist copiado entre Tarefas

Cria um Checklist novo na Tarefa de destino (12.5; RN-CHK-13): mesmo roteiro, Itens abertos por padrão, Responsáveis mantidos só se tiverem `ver` no destino, Itens convertidos excluídos, sem relação com a origem. Exige `ver` na origem e `editar` no destino; mesmo Espaço de Trabalho. Um Checklist copiado com frequência é sinal de que deveria ser Template de Checklist; o produto pode sugerir "salvar como Template".

### 20.10 Subitem com Responsável diferente do Item

Válido. Responsável de Subitem e do Item pai são independentes (RN-CHK-06; seção 16): o Item "preparar ambiente" pode ser de Ana e o Subitem "liberar acesso VPN" de Pedro. Nenhum herda do outro; nenhum é notificado do outro além dos eventos da Tarefa. Se a coordenação entre os dois exigir prazos ou bloqueio, é Subtarefa com Subtarefa.

### 20.11 100 Checklists numa Tarefa

Sem limite ontológico: Tarefa → Checklist é 0..N. Se a plataforma limitar, é Limite imposto (B34), não regra da entidade, e a criação além do teto é rejeitada com Registro de Atividade. Cem Checklists indicam que a Tarefa deveria ser Lista ou árvore de Subtarefas; a ontologia não decide isso pelo Membro.

### 20.12 Agente lendo Checklist como plano de execução

Uso legítimo e previsto (seção 2). A Ferramenta "ler Tarefa" entrega o agregado, Checklists incluídos, respeitando `ver`. O Agente pode seguir os Itens como plano, concluí-los com `editar` à medida que age (cada conclusão um Registro de Atividade com delegante), criar Checklists como planejamento e converter Itens que descobriu serem trabalho maior (com `criar`). Nada disso muda a natureza do Item: continua sem identidade, sem Execução própria, sem custo próprio (C8 mede na Execução do Agente, que referencia a Tarefa). Se a IA precisar rastrear cada passo como unidade de trabalho com estado, converte em Subtarefas — e aí a rastreabilidade tem custo, o que é o ponto de B2.

### 20.13 Item que precisa de prazo ou de discussão

Não há atributo para isso, deliberadamente (4.4): prazo informal vai no texto; prazo real, discussão ou bloqueio é Subtarefa. Alternativa rejeitada: "data opcional no Item" — cada atributo acrescentado o aproxima de Tarefa até existirem duas entidades de trabalho com semânticas divergentes, o que quebra Painéis ("atrasado" contaria Itens?) e IA.

### 20.14 Subtarefa convertida excluída ou eliminada

O Item permanece `convertido` em qualquer caso (INV-CHK-08): a condição é terminal e o Item nunca volta a `aberto`. Enquanto a Subtarefa está `na lixeira` (por ato próprio ou por ancestral), o destino é exibido como registro na lixeira e a navegação fica suspensa — mesma regra de Vínculo com um lado `na lixeira` (RN-TAR-15); restaurada, a navegação volta. Eliminada permanentemente, a marca conserva identificador e título à época sem navegação (RN-CHK-10), e o roteiro continua a registrar que o passo cresceu e para onde foi. Se o passo precisar ser refeito, cria-se um Item novo: reabrir o convertido apagaria o rastro e reintroduziria o passo no progresso como se a Subtarefa não tivesse existido.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Identidade, permissões, estado de ciclo de vida, histórico | Tarefa | B2; INV-CHK-01, INV-CHK-07; RN-CHK-12. |
| Status, categoria, datas, Prioridade, Estimativa, Tags, Valores de Campo, Comentários, Anexos, Dependências, Registros de Tempo, Observadores | Tarefa / Subtarefa | Tabela 4.4. Item que precisa de qualquer um deles é Subtarefa. |
| Responsáveis múltiplos ou Agente como Responsável | Tarefa (B7) | A7 restringe Item a 0..1 Membro; DO-CHK-02. |
| Template de Checklist (definição) | Espaço de Trabalho (catálogo de Templates, DO-ET-13) | O Checklist tem Proveniência, não o Template. |
| Funcionalidades "Checklists" e "exigir Checklists concluídos" | Lista e ancestrais (B25) | Consumidas pela Tarefa. |
| Limite de Checklists / Itens | Limites impostos (B34) | 20.11. |
| Subtarefa criada por conversão | Tarefa (como Subtarefa, B1) | O Item guarda só uma referência de objeto de valor; a Subtarefa não é filha do Checklist (RN-CHK-10). |
| Checklists das Subtarefas | Cada Subtarefa | Agregado próprio; nenhuma agregação automática de progresso na raiz. |
| Lista de marcação na descrição | Descrição da Tarefa (DO-TAR-03) | Formatação, não componente (4.3). |
| Eventos "de Item" | Tarefa | DO-CHK-12; objeto é sempre a Tarefa. |
| Métricas de progresso em Painéis | Painel (Widget, Métrica sobre Tarefas) | RN-CHK-15: Item nunca é registro de Fonte de Dados. |
| Etapa, roteiro por Etapa de Funil | Negócio / Funil / Automação do Funil | A4.4; 4.3. |
| Execução de Agente que percorre o Checklist | Agente (B18) | Referencia a Tarefa; o Item não é objeto. |
| Notificações ao Responsável de Item | Fora da ontologia | Consequência de produto sobre eventos da Tarefa. |

## 22. Exemplos conceituais

**Exemplo 1 — Publicação.** Na Tarefa "Publicar campanha de setembro" (OPS-2210), Maria instancia o Template de Checklist "Publicação" (Espaço de Trabalho): Checklist "Publicação" com 6 Itens abertos; o Responsável sugerido "Designer" é aplicado ao Item "aprovar arte" porque tem `ver`; o sugerido para "revisar jurídico" é descartado (Membro `removido`), com Registro de Atividade. O Agente "Revisor", invocado por Automação, lê a Tarefa, conclui "verificar links" e "checar ortografia" (Ator: Agente; delegante: a Automação — DO-AUT-15; B79). Progresso: 2/6. Maria conclui os demais; ao chegar a 6/6 o evento "Checklist concluído" dispara a Automação "mover para Em revisão". A Tarefa não foi concluída pelos Itens: a Automação mudou o status por ato explícito.

**Exemplo 2 — Item que cresceu.** No Checklist "Implantação", o Item "migrar dados do sistema antigo" (Responsável: Pedro; 3 Subitens, 1 concluído) revela-se uma semana de trabalho. João converte: nasce a Subtarefa "migrar dados do sistema antigo" (OPS-2231, pai OPS-2210, Responsável Pedro, status "A fazer"), com Checklist "migrar dados do sistema antigo" contendo os 3 Subitens nas condições originais; Proveniência "convertida de Item de 'Implantação' em OPS-2210". No Checklist de origem, o Item aparece como convertido → OPS-2231 e o progresso passa de 2/8 para 2/7. A Tarefa está na profundidade 0; se OPS-2210 fosse uma Subtarefa no nível máximo, a conversão teria sido rejeitada antes de criar OPS-2231.

**Exemplo 3 — Movimentação e acesso.** OPS-2210 é movida para a Lista privada "Marketing — confidencial". Pedro, sem `ver` lá, é liberado como Responsável de Tarefa (RN-TAR-06) **e** dos dois Itens de que era Responsável (RN-CHK-06), com Registros de Atividade na Tarefa. Os Checklists chegam intactos. A Lista de destino não tem a Funcionalidade "Checklists": eles ficam somente leitura; converter "configurar DNS" em Subtarefa continua possível (DO-CHK-11).

**Exemplo 4 — O que não é Checklist.** Na descrição de OPS-2210, Maria escreveu "- [ ] ligar para a gráfica". Marcar essa caixa é "descrição alterada", sem Responsável nem progresso, invisível a Automações de Checklist. Já o Negócio "Campanha — Clínica Vida", na Etapa "Proposta", não tem Checklist: o roteiro de proposta é uma Tarefa vinculada ao Negócio, criada por Automação do Funil ao entrar na Etapa, com o Template de Checklist "Proposta" instanciado nela.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Template de Checklist (0..N)  [nome; Itens/Subitens como descrição; Responsável sugerido 0..1]
│      └── proveniência ─────────────────────────────────────────────┐
├── Template de Tarefa (0..N) ── referencia (0..N) Template de Checklist│
├── Membro ── Responsável de Item (0..1 por Item; nunca Agente) ───────┼──┐
├── Ator (Membro | Agente | Automação | Integração) ── concluiu Item ───┼──┼──┐
└── Lista [Funcionalidades: Checklists; exigir Checklists concluídos]   │  │  │
      └── TAREFA (agregado; permissões; estado)                          │  │  │
            ├── Progresso de Checklists (derivado)                       │  │  │
            ├── CHECKLIST (0..N; ordem manual; sem identidade externa) ◄─┘  │  │
            │     ├── nome · ordem · progresso (derivado) · concluído (derivado)
            │     └── ITEM (0..N; ordem manual)                              │  │
            │           ├── texto · concluído · momento · Ator ◄─────────────┼──┘
            │           ├── Responsável 0..1 ◄───────────────────────────────┘
            │           ├── convertido → (objeto de valor) Subtarefa
            │           └── SUBITEM (0..N) = Item com pai; mesmas propriedades;
            │                 sem Subitens; não conta no progresso do Checklist
            │
            └── Subtarefa (0..N) = TAREFA com pai  [identidade própria; Checklists próprios]
                  └── Proveniência "convertida de Item" (objeto de valor; sem referência ao Item)

Registro de Atividade: objeto = TAREFA, dados = Checklist / Item.   Evento: sempre da TAREFA.
Painel: Métrica da TAREFA (progresso), nunca Item como registro.
Nenhuma aresta entra em Checklist ou Item vinda de fora do agregado (INV-CHK-01).
```

## 24. Decisões ontológicas

- **DO-CHK-01.** Checklist, Item e Subitem são componentes internos do agregado Tarefa, sem identidade externa; possuem identificador local para endereçamento dentro do agregado, que nenhum registro externo referencia. Aplica B2. CONSOLIDADA.
- **DO-CHK-02 / B48.** Responsável de Item é 0..1 **Membro**, nunca Agente. Justificativa: A7 fixa "Item de Checklist (0..1 Membro)"; e Item não é unidade de trabalho rastreável para IA — não há Execução, custo, evento próprio nem permissão que tomem o Item como objeto, de modo que "Agente responsável por Item" seria encargo sem rastro. A coerência com B7 é preservada de outro modo: o Agente pode ser o **Ator que conclui** o Item e, se o passo exige um Agente encarregado, converte-se em Subtarefa, onde B7 se aplica. Alternativa (Agente Responsável de Item por simetria com B7) rejeitada por criar responsabilidade de IA invisível a Execuções e Painéis. RECOMENDADA.
- **DO-CHK-03.** Conclusão de Item grava momento e Ator (qualquer tipo de A6.1, com delegante); reabrir esvazia ambos; o histórico fica no Registro de Atividade da Tarefa. Mesmo padrão de DO-TAR-04. RECOMENDADA.
- **DO-CHK-04.** Aninhamento limitado a um nível (Item → Subitem); Subitem tem as mesmas propriedades do Item. Justificativa: além de um nível sem identidade, o que se constrói é árvore de trabalho, que a ontologia já provê com identidade (Subtarefa, B1); profundidade em Itens criaria árvore-sombra invisível a Visualizações, Painéis e Dependências. RECOMENDADA.
- **DO-CHK-05.** Ordem de Checklists, Itens e Subitens é atributo manual do componente, compartilhado por todos os que veem a Tarefa, não configuração de Visualização (diferente da ordem de Tarefas raiz em uma Lista). Justificativa: a sequência do roteiro é significado, não preferência. RECOMENDADA.
- **DO-CHK-06.** Progresso de Checklist = Itens contáveis concluídos ÷ Itens contáveis, onde contável é Item de primeiro nível não convertido; Subitens não contam no Checklist e têm progresso próprio por Item; vazio sem Item contável. Justificativa: o booleano do Item é a palavra final sobre o passo; contar Subitens tornaria o progresso dependente de quão detalhado alguém foi. RECOMENDADA.
- **DO-CHK-07.** Concluir Item com Subitens abertos é permitido; nenhuma propagação de condição entre Item e Subitens nem entre Tarefa e Itens em nenhuma direção (RN-CHK-08). Coerente com RN-TAR-18/19 e DO-TAR-10. RECOMENDADA.
- **DO-CHK-08.** Painéis expõem Checklist somente como Métrica derivada da Tarefa (progresso, Itens abertos/concluídos por Responsável ou Ator); Item nunca é registro de Fonte de Dados. A Tarefa ganha o atributo derivado **Progresso de Checklists** (impacto em tarefa.md 6.1). RECOMENDADA.
- **DO-CHK-09 / B48.** Item convertido **permanece** no Checklist, marcado `convertido` com identificador e título da Subtarefa à época (objeto de valor), terminal, sem Subitens, fora do numerador e do denominador do progresso; removível sem efeito sobre a Subtarefa; sem conversão inversa. Item `concluído` pode ser convertido e nasce em categoria `concluído`. Justificativa: remover apagaria, do lugar em que o roteiro foi escrito, o rastro de que o passo cresceu; contar como concluído falsearia o progresso. A conversão tem pai padrão (a Tarefa do Checklist) ou pai explícito (o pai dessa Tarefa ou nenhum), sempre na mesma Lista (12.3, 20.5). Detalha DO-TAR-11. RECOMENDADA.
- **DO-CHK-10.** Conversão de Checklist inteiro é a conversão atômica de cada Item de primeiro nível `aberto` (opcionalmente os `concluído`) em Subtarefas irmãs diretas, na ordem do Checklist, sem Subtarefa agrupadora; verificações (profundidade, Funcionalidade, Limites) antes de qualquer criação; tudo ou nada. RECOMENDADA.
- **DO-CHK-11.** Checklist é regido pela Funcionalidade "Checklists" da Lista (catálogo da plataforma, já previsto em espaco.md e lista.md): desabilitada, os existentes ficam somente leitura sem destruição (RN-LIS-21), permanecendo permitidas a remoção e a conversão em Subtarefa como saída. Aplica B25 e DO-LIS-14. RECOMENDADA.
- **DO-CHK-12.** Eventos de Checklist e de Item são eventos da Tarefa com dados do componente (seção 18), inclusive os derivados "Checklist concluído" e "Checklist reaberto"; substituem "Tarefa atualizada" para Checklists (impacto em tarefa.md 18). Nenhum evento tem Item como objeto. Aplica A6.2 e RN-TAR-23. RECOMENDADA.
- **DO-CHK-13.** Template de Checklist é entidade do catálogo de Templates do Espaço de Trabalho (DO-ET-13), com nome, Itens/Subitens como descrição e Responsável sugerido opcional; instanciar cria Checklist novo com Itens abertos e Proveniência (objeto de valor), Responsáveis sugeridos validados por `ver`; sem vínculo vivo; Template de Tarefa pode referenciá-lo, resolvendo a referência na instanciação. Aplica A8. RECOMENDADA.
- **DO-CHK-14.** Cascata total: arquivar, excluir, restaurar, eliminar e mover a Tarefa levam os Checklists intactos (Responsáveis de Item sem `ver` no destino liberados na movimentação — impacto em tarefa.md 12.4); copiar a Tarefa ou o Checklist cria componentes novos com o roteiro, sem condições de concluído e sem Itens convertidos; não há lixeira nem mover entre Tarefas para Checklist. RECOMENDADA.
- **DO-CHK-15.** Concluir a Tarefa com Itens abertos é permitido por padrão; a Lista pode habilitar a Funcionalidade "exigir Checklists concluídos" (rejeita a transição enquanto houver Item contável `aberto`; Subitens, convertidos e Checklists vazios não impedem), cumulativa com "exigir Subtarefas concluídas". Coerente com DO-TAR-10. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. Este documento não propõe alteração a decisão vigente; detalha B2 e DO-TAR-11, e as suas decisões DO-CHK-02, 06, 08, 09, 12 e 15 estão consolidadas em B48. Os impactos pedidos ao documento 06 (Progresso de Checklists em 6.1, eventos de Checklist em 18, Responsáveis de Item em 12.4, Item convertido em 20.15) foram aplicados na revisão.

## 25. Questões em aberto

1. **Responsável de Item que não pode concluir o próprio Item.** RN-CHK-07 exige `editar`; um Responsável com `ver` ou `comentar` (Convidado com Tarefa compartilhada, 17.3 do documento 06) não conclui o que lhe foi atribuído. Alternativas: (a) manter (coerente com status de Tarefa); (b) definir que `comentar` inclui "concluir Item próprio" — cria exceção na tabela de ações; (c) o compartilhamento automático de 25.4 do documento 06 conceder `editar` no escopo `registro`. Consequência de produto: fluxos com Convidados executando roteiros. Recomendação: (a) nesta versão; decidir junto com 25.4 do documento 06.
2. **Progresso de Checklists agregado na árvore de Subtarefas** — resolvida no documento 21 (20.16): não existe "progresso total" como derivado da ontologia; Painéis oferecem Progresso de Subtarefas e Progresso de Checklists como Métricas separadas da Tarefa, e uma Métrica composta é entidade futura (D-nova-3 do documento 21). Este documento continua a não agregar Checklists de Subtarefas na raiz (10). Sem pendência.
3. **Conversão de Item como ação "irreversível" para aprovação de Agente (B22).** Recomendado tratar como reversível (17); o documento de Agentes decide a classificação das Ferramentas.
4. **Governança dos Templates de Checklist.** Quem cria, edita e remove Templates no catálogo do Espaço de Trabalho (Administrador? qualquer Membro?) e se há versão são decisões do documento 01 (catálogo de Templates, DO-ET-13), não deste; 7.3 assume "Membro com permissão de criar Templates" e "versão, se houver".
