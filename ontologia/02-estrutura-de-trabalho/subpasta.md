# SUBPASTA

> Domínio: Estrutura de Trabalho | Documento 04 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Subpasta** é uma Pasta cujo pai é uma Pasta. Não é uma entidade distinta: é o nome que a árvore aprovada (A2.1) dá a uma Pasta que ocupa o nível 2 (Nível de Pasta) abaixo de um Espaço. Tudo o que uma Pasta é — agrupador estrutural com identidade própria, ponto de definição de configuração para as Listas que contém, Recurso de permissão, contêiner sujeito a cascata — a Subpasta também é. O que a distingue é exclusivamente a **posição**: o pai é uma Pasta, não um Espaço. Dessa posição decorre uma única restrição própria: não pode conter Subpastas (A3.4, B3).

Definir a Subpasta por posição, e não por natureza, tem consequência direta: "ser Subpasta" é uma condição derivada, que se adquire e se perde por movimentação, sem criar nem destruir registro. Uma Pasta movida para dentro de outra Pasta passa a ser Subpasta; uma Subpasta movida para o Espaço passa a ser Pasta. A identidade permanece (seção 5).

Diferenciação dos vizinhos: da Pasta, difere pelo pai (Pasta, não Espaço) e por não poder conter agrupadores; da Lista, difere por não conter Tarefas; do Espaço, difere por não ser filha do Espaço de Trabalho nem origem da herança estrutural.

## 2. Propósito

1. **Segundo Nível de Pasta.** Organizações precisam de "área → projeto → frente" (Espaço → Pasta → Subpasta) antes de chegar às Listas operacionais. Com um único Nível de Pasta, ou as Pastas acumulam dezenas de Listas, ou os Espaços se multiplicam para representar projetos.
2. **Fechar a profundidade.** A Subpasta é o nível em que a árvore deixa de se ramificar em agrupadores. Existe nomeada para que "último Nível de Pasta" seja um conceito verificável, não uma consequência acidental de um limite numérico.
3. **Registrar as restrições.** A arquitetura a nomeia (A2.1), e as restrições que decorrem de estar abaixo de uma Pasta — pai obrigatoriamente Pasta, três níveis de herança, permissão herdada da Pasta, proibição de conter Subpastas — precisam de registro para que os documentos de Lista, Automações, Painéis e Agentes tratem "nível" como valor estável (B3).

Este documento não repete o que é comum a Pasta: atributos, configuração e permissões são definidos no documento de Pasta e aqui apenas referidos. Este documento registra a diferença.

## 3. Natureza da entidade

- **Especialização contextual de Pasta**, no mesmo sentido em que Subtarefa é especialização contextual de Tarefa (B1): mesma entidade, mesma identidade global, mesmas capacidades, restrições decorrentes da posição.
- **Contêiner estrutural** da Estrutura de Trabalho: filho estrutural de exatamente uma Pasta (A3.3); pai estrutural de 0..N Listas (A3.1).
- **Ponto de definição** de configuração (B25): Conjunto de Status, Definições de Campo para Tarefas, Tipos de Tarefa, Visualizações padrão, Funcionalidades habilitadas; escopo possível de Automações.
- **Recurso de permissão** (A9.1): sobre ela existem Ações (ver, comentar, criar, editar, excluir, administrar) com Escopo `registro` ou `subárvore` (B29).
- **Não é Ator**, não é objeto de valor, não é configuração e **não tem Proprietário**: A7 não lista contêineres estruturais; governança é por concessão `administrar` (Administrador de Espaço — concessão, não Papel; Glossário) e, sobre contêineres não privados, pelo Papel Administrador do Espaço de Trabalho.
- **Não é raiz de agregado** de Listas nem de Tarefas: ambas são raízes dos próprios agregados. A Subpasta é o escopo estrutural delas, responsável pela cascata, não pela consistência interna.
- **Nível** (atributo derivado, seção 6) = 2. É a única propriedade em que Subpasta e Pasta diferem.

## 4. Fronteira conceitual

### O que é

- Uma Pasta no nível 2 (Nível de Pasta).
- O último contêiner de agrupamento antes da Lista.
- O terceiro ponto de definição no Caminho efetivo Espaço → Pasta → Subpasta → Lista.

### O que não é

- **Não é um tipo de contêiner próprio.** Não existe "tipo = Subpasta" independente da posição; retirada da Pasta, é Pasta.
- **Não é uma Pasta com menos capacidades.** As capacidades são idênticas; a única restrição é estrutural.
- **Não é agrupador recursivo.** Não há "Subpasta de Subpasta"; a profundidade é finita e fixa (A3.4).
- **Não é Lista.** Não contém Tarefas; Tarefas só existem em Listas (A3.2).
- **Não é Espaço.** Não é filha do Espaço de Trabalho, não é o primeiro ponto de definição de Conjunto de Status e não existe sem Pasta.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Pasta × Subpasta** | Pai: Espaço. Nível 1. Contém 0..N Subpastas e 0..N Listas. Herda do Espaço. | Pai: Pasta. Nível 2. Contém apenas Listas. Herda da Pasta e, por ela, do Espaço. | Só pai e nível distinguem. Mesma identidade, atributos, configuração e permissões. A distinção é posicional e reversível por movimentação (seção 12.3). |
| **Subpasta × Lista** | Agrupador; contém Listas; define configuração para descendentes; não tem Tarefas. | Contêiner operacional; único nível em que Tarefas existem; consome e pode sobrescrever configuração; último ponto de definição. | A Lista é onde o trabalho existe; a Subpasta é onde Listas são agrupadas. Lista sem Subpasta é válida (pai Espaço ou Pasta); Subpasta sem Listas é válida, mas vazia. |
| **Subpasta × Espaço** | Nível 2; pai Pasta; recebe herança de dois ancestrais; sua privacidade é interrupção de herança. | Primeiro nível estrutural; pai Espaço de Trabalho; origem da herança estrutural (Conjunto de Status, Definições de Campo para Tarefas); não herda configuração de estrutura. | O Espaço origina a herança; a Subpasta é o último elo antes da Lista. Ambos são contêineres com as mesmas Ações de permissão. |
| **Subpasta × "Pasta aninhada genérica"** | Profundidade fixa: exatamente um nível abaixo de uma Pasta de nível 1. Nível é constante (2). | Pasta que contém Pasta que contém Pasta, sem limite. Nível é variável e ilimitado. | Rejeitada (B3). Com recursão ilimitada: (a) a configuração efetiva de uma Lista exige percorrer uma cadeia de tamanho arbitrário e "o que se aplica aqui" deixa de ser enumerável; (b) Painéis e Agentes não podem usar "nível" como Dimensão estável nem raciocinar sobre "projeto" e "frente" com significado fixo; (c) permissões `subárvore`, Templates e movimentações passam a ter custo e semântica indefinidos; (d) a árvore aprovada (A2.1) nomeia quatro contêineres e nenhuma recursão. Generalizar trocaria um conceito nomeado e verificável por um grafo sem vocabulário. |

## 5. Identidade

A Subpasta tem o identificador de Pasta: imutável, opaco, atribuído pela plataforma. Não existe um segundo espaço de identificadores para Subpastas.

**Teste de identidade.** Se nome, descrição, configuração, permissões, conteúdo e o próprio pai mudarem, continua sendo o mesmo registro: Registros de Atividade, proveniência de Templates, Fontes de Dados de Painéis, escopos de Automação e concessões continuam a referenciá-lo.

**Teste de identidade aplicado ao nível.** Uma Pasta movida para dentro de outra Pasta torna-se Subpasta e permanece o mesmo registro? Análise: (a) nada do que a referencia depende do pai — Painéis, Automações, concessões, Templates e Registros de Atividade apontam para o identificador; (b) as Listas contidas não mudam de pai; (c) o que muda é o valor derivado "nível" e o conjunto de ancestrais, exatamente o que muda em qualquer movimentação de Pasta entre Espaços; (d) criar um registro novo obrigaria a migrar todas as referências e romperia o histórico, sem benefício. **Decisão (DO-SUB-02): sim.** A identidade é preservada nos dois sentidos: **rebaixamento** (Pasta → Subpasta, ao ser movida para dentro de uma Pasta) e **promoção** (Subpasta → Pasta, ao ser movida para o Espaço). O nível e a herança são recalculados (seção 16.3) e um evento é registrado (seção 18).

Consequências: nome não é identidade (é único entre irmãs `ativo` ou `arquivado` da mesma Pasta, B39, mas renomear preserva o registro); pai não é identidade; nível não é identidade.

## 6. Atributos fundamentais

Todos são atributos de Pasta. "Pasta pai" e "Nível" são os mesmos atributos com valores específicos: em uma Pasta de nível 1, o pai é o Espaço e o nível é 1.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável; o mesmo de Pasta. |
| Nome | nativo | sim | Editável. Único entre irmãs `ativo` ou `arquivado` da mesma Pasta (RN-PAS-04; B39). |
| Descrição | nativo | não | |
| Pasta pai (Contêiner pai) | referência (Pasta) | sim | Exatamente uma Pasta de nível 1 do mesmo Espaço de Trabalho. É o valor do atributo "Contêiner pai" de Pasta que faz de uma Pasta uma Subpasta. Alterável só por movimentação (12.3). |
| Espaço | derivado | sim | O Espaço da Pasta pai. Nunca gravado separadamente. |
| Nível | derivado | sim | 2. Pasta com pai Espaço: 1; Pasta com pai Pasta: 2. Não existe 3. |
| Estado próprio | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; B36). |
| Estado efetivo | derivado | sim | O mais restritivo entre o estado próprio e o dos ancestrais (seção 11; B36). |
| Estado próprio anterior à exclusão | nativo | condicional | Preenchido enquanto `na lixeira`, com o estado próprio que a Subpasta tinha ao ser excluída (`ativo` ou `arquivado`). A restauração a devolve a esse estado (12.2; B36; INV-SUB-12). |
| Privada | nativo | sim | Booleano; padrão falso. Verdadeiro interrompe a herança de permissões da Pasta (A9.2). Só um Membro `ativo` sem base Convidado a marca (RN-SUB-08). |
| Ordem | nativo | sim | Posição entre as irmãs dentro da Pasta. |
| Criador | referência (Ator) | sim | Imutável (A7). Membro, Agente, Automação ou Sistema. |
| Momento de criação | nativo | sim | Imutável. |
| Template de origem | referência (Template) | não | Proveniência "criada a partir de" (A8). Sem vínculo vivo. |
| Configuração por aspecto | objeto de valor | sim | Para cada aspecto de B25: modo (`herdado`, `sobrescrito`, `bloqueado`) e, se sobrescrito, o valor próprio (seção 16). |

O documento de Pasta representa o pai como o atributo único "Contêiner pai" (Espaço ou Pasta), com a regra de que só uma Pasta de nível 1 pode ser alvo (RN-PAS-01).

## 7. Entidades internas ou componentes

Idênticos aos de Pasta; a Subpasta não tem componente próprio.

| Componente | Natureza | Observação |
| --- | --- | --- |
| Definições de Campo Personalizado com ponto de definição Subpasta | configuração contida, com identidade | A5.2. Aplicam-se às Tarefas de todas as Listas da Subpasta, acumulando com as do Espaço e da Pasta. Nome único em todo o caminho efetivo, nos dois sentidos (DO-LIS-05). |
| Conjunto de Status sobrescrito | configuração contida | Existe só se o modo for `sobrescrito`; substitui o herdado (B25). |
| Tipos de Tarefa, Visualizações da Subpasta, Funcionalidades habilitadas | configuração contida | Conforme modo por aspecto. |
| Concessões de permissão sobre a Subpasta | configuração contida | A concessão vive no Recurso (documento 01, seção 21). |

Não são componentes: Listas (filhas estruturais com identidade e agregado próprios); Tarefas (dois níveis abaixo); Automações de escopo Subpasta (pertencem ao Espaço de Trabalho; a Subpasta é escopo — documento 01, seção 8); Templates (catálogo do Espaço de Trabalho).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Pasta | contenção | Subpasta → Pasta | Exatamente uma, obrigatoriamente de nível 1. Remover a Pasta remove a Subpasta em cascata (A3.3). |
| pertence transitivamente a | Espaço, Espaço de Trabalho | pertencimento derivado | Subpasta → Espaço → ET | Derivado do pai; nunca gravado. O Espaço de Trabalho é imutável (A1.1). |
| contém | Lista | contenção | Subpasta → Lista | 0..N. Cada Lista tem exatamente um pai (A3.2). Cascata. |
| herda de | Pasta, Espaço | herança | Pasta → Subpasta | Configuração (B25) e permissões (A9.2), na ordem Espaço → Pasta → Subpasta. |
| transmite a | Lista | herança | Subpasta → Lista | Toda Lista da Subpasta parte da configuração efetiva da Subpasta. |
| é escopo de | Automação | referência | Automação → Subpasta | Automação de escopo Subpasta aplica-se às Tarefas das suas Listas; a Automação pertence ao ET. |
| é Fonte de Dados de | Painel (Widget) | referência | Painel → Subpasta | "Tarefas das Listas desta Subpasta"; filtrado pelo visualizador (B20). |
| é Âncora de | Painel (de contexto) | referência | Painel → Subpasta | 0..N. Sem contenção nem herança; acompanha promoção, rebaixamento e movimentação (referência por identidade); na eliminação passa a `eliminada` como valor e o Painel permanece (DO-PAI-07). |
| é Âncora de | Sessão de Chat | referência inversa | Sessão → Subpasta | 0..N Sessões. A Subpasta não conhece Sessões; a âncora não concede permissão e sobrevive como valor à eliminação (B83). |
| é Recurso de | Permissão | referência | Permissão → Subpasta | Escopo `registro` ou `subárvore`. |
| foi criada a partir de | Template | referência (proveniência) | Subpasta → Template | 0..1. |

Distinção aplicada: **CONTER** (Listas; configuração com identidade), **HERDAR** (de Pasta e Espaço), **CONFIGURAR** (aspectos B25), **REFERENCIAR** (Template, Criador). A Subpasta não USA nada nem se RELACIONA por Vínculo: Vínculo é entre registros de domínio (A8); contêineres não são alvo de Vínculo nesta versão.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Subpasta → Pasta pai | 1 | não | não | estrutural | Sem Pasta pai não é Subpasta: é Pasta (A3.3). |
| Pasta → Subpasta | 0..N | sim | sim | estrutural | Pasta sem Subpastas é o caso comum. |
| Subpasta → Lista | 0..N | sim | sim | estrutural | Subpasta vazia é válida (recém-criada, em reorganização). |
| Subpasta → Subpasta ou Pasta | 0 | — | — | proibida | A3.4. |
| Subpasta → Tarefa (direta) | 0 | — | — | proibida | A3.2. |
| Subpasta → Definição de Campo (ponto de definição) | 0..N | sim | sim | estrutural | Acumulam (B25). |
| Subpasta → Conjunto de Status sobrescrito | 0..1 | sim | não | estrutural | Zero se `herdado`; só um se aplica. |
| Subpasta → Concessão de permissão | 0..N | sim | sim | estrutural | |
| Automação → Subpasta (escopo) | 0..1 por Automação; 0..N por Subpasta | sim | sim | associativa | Automação tem um escopo; Subpasta pode ser escopo de várias. |
| Painel → Subpasta (Fonte de Dados) | N:N | sim | sim | associativa | |
| Sessão de Chat → Subpasta (Âncora) | 0..N por Subpasta | sim | sim | associativa | B83. |

Nenhuma DECISÃO NECESSÁRIA: todas decorrem de A3.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Espaço de Trabalho → Espaço → Pasta → Subpasta → Lista → Tarefa. A Subpasta é o quarto nó e o último agrupador. Abaixo dela só existem contêineres operacionais (Lista) e unidades de trabalho (Tarefa).

**Pertencimento (teste de existência).** Enquanto Subpasta, o registro não existe sem a Pasta pai: eliminada a Pasta, a Subpasta é eliminada em cascata, nunca promovida automaticamente (RN-SUB-14). A dependência é de posição, não de identidade: o mesmo registro pode existir como Pasta se for promovido antes. As Listas dependem da Subpasta pelo mesmo critério.

**Propriedade.** A Subpasta não tem Proprietário (A7). A responsabilidade sobre ela é exercida por quem tem `administrar`, herdado da Pasta ou concedido; sobre Subpasta não privada, a cadeia termina nos Administradores e no Proprietário do Espaço de Trabalho; sobre Subpasta Privada, em quem tem concessão direta, sempre ao menos um Membro `ativo` (B38; seção 17).

**Configurar não é conter; "pertence a" não é "relaciona-se com".** A Subpasta configura Conjunto de Status, Definições de Campo e Visualizações; é escopo de Automações e Fonte de Dados de Painéis, que pertencem ao Espaço de Trabalho e apenas a referenciam; referencia um Template, catálogo do Espaço de Trabalho. Ela pertence à Pasta e a nada mais.

## 11. Estados

Estados de sistema (A4.1): `ativo`, `arquivado`, `na lixeira`. Não há Status (A4.2) em contêineres.

O **estado efetivo** é derivado (B36): o mais restritivo na cadeia, na ordem `ativo` < `arquivado` < `na lixeira`.

| Estado próprio | Estado efetivo do pai | Estado efetivo | Consequência |
| --- | --- | --- | --- |
| `ativo` | `ativo` | `ativo` | Operação normal. |
| `ativo` | `arquivado` | `arquivado` | Somente leitura; nenhuma criação de Lista ou Tarefa nem ação estrutural; Automações de escopo Subpasta não disparam. |
| `arquivado` | `ativo` | `arquivado` | Idem. |
| `ativo` ou `arquivado` | `na lixeira` | `na lixeira` | Invisível nas Visualizações; sujeita à eliminação com o pai. |
| `na lixeira` | qualquer | `na lixeira` | Idem. |

O estado próprio é preservado durante a cascata: uma Subpasta já `arquivado` dentro de uma Pasta que é arquivada e depois restaurada continua `arquivado`. Só assim a restauração do ancestral devolve cada descendente ao estado que tinha. Registros de Tempo em andamento em Tarefas da subárvore são encerrados no ato em que a Tarefa deixa de ter estado efetivo `ativo` (B36).

## 12. Ciclo de vida

### 12.1 Criação

Quatro origens, todas resultando em `ativo`, todos os aspectos `herdado`, Privada falso:

- (a) **Criação direta** dentro de uma Pasta de nível 1, por Ator com `criar` na Pasta.
- (b) **Rebaixamento**: movimentação de uma Pasta sem Subpastas para dentro de outra Pasta. Não é criação de registro (seção 5).
- (c) **Instanciação de Template** de Pasta dentro de uma Pasta; o Template não pode conter Subpastas (20.6).
- (d) **Criação por Automação ou Agente**, sujeita às mesmas regras e permissões (A6.3).

### 12.2 Transições

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | `administrar` | Cascata por derivação: Listas e Tarefas passam a efetivo `arquivado`, sem reescrita do estado próprio (B36). Registros de Tempo em andamento encerrados. Automações de escopo Subpasta ficam inoperantes (B41). Registro de Atividade. |
| `arquivado` | `ativo` | idem | Descendentes que estavam `ativo` por conta própria voltam a efetivo `ativo`. Permitido mesmo sob Pasta `arquivado` ou `na lixeira`: o efetivo continua derivado (B36; RN-SUB-10). |
| `ativo` ou `arquivado` | `na lixeira` | `excluir` | Cascata. Prazo da Política de lixeira do Espaço de Trabalho. Estado próprio anterior à exclusão gravado para restauração. |
| `na lixeira` | Estado próprio anterior à exclusão (`ativo` ou `arquivado`) | `excluir` | Exige Pasta pai não `na lixeira`; Pasta `arquivado` é aceita e a Subpasta fica efetivamente `arquivado`. Se a Pasta pai está `na lixeira`, restaura-se a Pasta (a Subpasta volta junto), ou a restauração indica outro pai — restauração e movimentação no mesmo ato (RN-PAS-13, B40). |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo) ou ação explícita com `administrar` | Não é estado. Cascata total: Listas, Tarefas, Definições de Campo com ponto de definição na Subpasta e seus Valores (A5.4), concessões, Visualizações, Automações de escopo Subpasta (eliminadas com ela, com Execuções passadas preservadas — B41). Registros de Atividade permanecem. Widgets com essa Fonte de Dados passam a `inválido` e permanecem no Painel até edição humana (RN-PAI-20); a Âncora de Painel de contexto passa a `eliminada` e o Painel permanece (DO-PAI-07). |

### 12.3 Movimentação

| Movimento | Válido? | Efeito |
| --- | --- | --- |
| Subpasta → outra Pasta do mesmo Espaço | sim | Pai muda; nível permanece 2; herança recalculada (16.3). Evento "Subpasta movida". |
| Subpasta → Pasta de outro Espaço, mesmo Espaço de Trabalho | sim (B40; regras de RN-PAS-14) | Além do anterior, o Espaço derivado muda; o Conjunto de Status efetivo pode mudar, com mapeamento por categoria; Valores de Campo de Definições que deixam de se aplicar ficam `arquivado` (B37). |
| Subpasta → Espaço | sim | **Promoção**: passa a Pasta de nível 1, Contêiner pai passa a ser o Espaço, herança recalculada com um ancestral a menos. Evento "Subpasta promovida a Pasta". Identidade preservada (DO-SUB-02). |
| Pasta sem Subpastas → dentro de Pasta | sim | **Rebaixamento**: passa a Subpasta. Evento "Pasta rebaixada a Subpasta". |
| Pasta com Subpastas → dentro de Pasta | **não** | Criaria nível 3. Rejeitada sem achatamento automático (DO-SUB-03 / B40; 20.2). |
| Qualquer agrupador → dentro de Subpasta | **não** | A3.4. |
| Lista → de Subpasta para Pasta, Espaço ou outra Subpasta | sim | Regra da Lista (B40); efeito na herança em 20.8. |

Nenhuma movimentação cruza o Espaço de Trabalho (A1.1) nem altera identidade ou Registros de Atividade anteriores. Toda movimentação exige `administrar` sobre o contêiner movido e `criar` no destino, que deve estar efetivamente `ativo`; é atômica, dispara o recálculo da seção 16.3 e pode ser rejeitada por conflito de bloqueio (RN-SUB-12), por profundidade, por colisão de nome no destino (B39, B40) ou por colisão de Definição de Campo própria com o novo caminho (DO-LIS-05). O estado efetivo de origem não impede a movimentação de um registro cujo estado próprio não é `na lixeira` (RN-SUB-10).

## 13. Regras de negócio ontológicas

- **RN-SUB-01.** Toda Subpasta tem exatamente uma Pasta pai, e essa Pasta tem nível 1. Reciprocamente, toda Pasta cujo pai é uma Pasta é uma Subpasta.
- **RN-SUB-02.** Subpasta não contém Pasta nem Subpasta; contém apenas Listas. Criar ou mover um agrupador para dentro de uma Subpasta é inválido para qualquer Ator: Membro, Agente, Automação, Integração ou instanciação de Template.
- **RN-SUB-03.** Subpasta não contém Tarefas diretamente (A3.2).
- **RN-SUB-04.** A Subpasta tem as mesmas capacidades de configuração de uma Pasta (B25) e pode sobrescrever qualquer aspecto que não esteja bloqueado pelo Espaço ou pela Pasta.
- **RN-SUB-05.** Aspecto bloqueado pelo Espaço ou pela Pasta não pode ser sobrescrito na Subpasta nem nas suas Listas. Um bloqueio definido na Subpasta impede sobrescrita nas suas Listas.
- **RN-SUB-06.** Definições de Campo e Automações acumulam ao longo de Espaço → Pasta → Subpasta → Lista; Conjunto de Status substitui: cada Lista tem exatamente um Conjunto efetivo, o do ponto de definição mais próximo.
- **RN-SUB-07.** Permissões da Subpasta são herdadas da Pasta (A9.2). Se Privada, só concessão direta e compartilhamento contam, para qualquer Sujeito, humano ou Agente, inclusive Administradores e o Proprietário do Espaço de Trabalho (B38).
- **RN-SUB-08.** Toda Subpasta Privada tem, em todo instante, ao menos um Membro `ativo` com `administrar` por concessão direta; só um Membro `ativo` sem base Convidado a torna Privada, e recebe `administrar` no ato (Agentes e Automações não privatizam, porque não recebem `administrar`). Quando o último é removido ou suspenso, a concessão passa ao Sucessor no mesmo ato (exceção a B28). Administradores e o Proprietário do Espaço de Trabalho **não** mantêm `administrar` sobre Subpasta Privada por Papel; podem conceder acesso a ela, inclusive a si mesmos, apenas por **ato de governança registrado** (Registro de Atividade com motivo, visível a quem tem acesso à Subpasta). Substitui a versão anterior desta regra ("Administradores mantêm `administrar`"), rejeitada na harmonização por B38: um acesso silencioso por Papel tornaria a privacidade nominal. (20.9). Aplica B38.
- **RN-SUB-09.** Compartilhar uma Subpasta (ou uma Lista dela) com um Sujeito que não vê a Pasta concede acesso ao Recurso compartilhado e aos nomes dos ancestrais para navegação, nunca ao conteúdo dos ancestrais nem às irmãs. Coerente com o documento 01, seção 22, exemplo 5. Aplica B38 (e).
- **RN-SUB-10.** O estado efetivo é o mais restritivo da cadeia; o estado próprio é preservado na cascata (seção 11; B36). Em Subpasta com estado efetivo diferente de `ativo` não ocorre criação, edição de conteúdo, alteração de configuração nem disparo de Automação. Permanecem válidos: restaurar o ancestral; alterar permissões; alterar o **estado próprio** da Subpasta ou de uma Lista dela (arquivar, desarquivar, enviar à lixeira; restaurar de `na lixeira` só se o pai não está `na lixeira`); **mover para fora** a Subpasta ou uma Lista dela quando o estado próprio do registro movido não é `na lixeira`, para destino efetivamente `ativo` (B40); eliminar antecipadamente o que está `na lixeira` por estado próprio. Consequência: uma Lista arquivada individualmente sob Pasta arquivada permanece `arquivado` quando a Pasta é restaurada (RN-PAS-11).
- **RN-SUB-11.** Mover uma Pasta que contém Subpastas para dentro de outra Pasta é rejeitado. Não há achatamento automático: o ator promove ou move as Subpastas antes (DO-SUB-03 / B40).
- **RN-SUB-12.** Após movimentação que altere ancestrais (da Subpasta ou de uma Lista dela), a configuração efetiva de todos os descendentes é recalculada. Sobrescritas locais são mantidas quando o novo ancestral não bloqueia o aspecto. Se bloqueia, a movimentação é rejeitada com a lista dos conflitos; nunca há reversão silenciosa de sobrescritas (B25; princípio de RN-ET-17: nenhuma cascata destrutiva por mudança de configuração). Colisão de nome com irmã `ativo` ou `arquivado` no destino também rejeita (B39).
- **RN-SUB-13.** Instanciar um Template de Pasta que contém Subpastas dentro de uma Pasta é rejeitado (DO-SUB-04 / B47; 20.6).
- **RN-SUB-14.** Eliminar permanentemente a Pasta pai elimina a Subpasta e toda a sua subárvore. Não existe promoção automática de Subpastas órfãs.
- **RN-SUB-15.** Promoção e rebaixamento preservam identidade, referências (Painéis, Automações, concessões, Templates de origem) e Registros de Atividade; geram evento próprio e recálculo de herança.
- **RN-SUB-16.** Toda ação sobre a Subpasta gera Registro de Atividade com ator e, quando houver, ator delegante (A6.2).

## 14. Invariantes

- **INV-SUB-01.** Toda Subpasta tem exatamente uma Pasta pai de nível 1, do mesmo Espaço de Trabalho.
- **INV-SUB-02.** Nenhuma Subpasta tem filho estrutural que seja Pasta ou Subpasta.
- **INV-SUB-03.** O nível de qualquer Pasta é 1 ou 2; nível(Subpasta) = nível(Pasta pai) + 1 = 2.
- **INV-SUB-04.** O caminho de qualquer Tarefa até o seu Espaço contém no máximo dois agrupadores.
- **INV-SUB-05.** Para todo aspecto de B25 que **substitui** (Conjunto de Status, Funcionalidades habilitadas, Visualizações padrão): se o modo no Espaço ou na Pasta é `bloqueado`, o modo na Subpasta e nas suas Listas é `herdado`. Para aspectos que **acumulam** (Definições de Campo, Tipos de Tarefa, Automações), o bloqueio impede definições novas na Subpasta e nas Listas; as existentes permanecem (B25).
- **INV-SUB-06.** Toda Lista da Subpasta tem exatamente um Conjunto de Status efetivo.
- **INV-SUB-07.** Estado efetivo da Subpasta ≥ estado efetivo da Pasta pai; estado efetivo de cada Lista ≥ o da Subpasta (ordem `ativo` < `arquivado` < `na lixeira`).
- **INV-SUB-08.** Subpasta não tem Proprietário.
- **INV-SUB-09.** O identificador de uma Subpasta nunca muda por promoção, rebaixamento ou movimentação.
- **INV-SUB-10.** Toda Subpasta Privada tem ao menos um Membro `ativo` com `administrar` por concessão direta (RN-SUB-08; B38). Sobre Subpasta não privada, o Papel Administrador do Espaço de Trabalho garante `administrar`.
- **INV-SUB-11.** Não existem duas Subpastas irmãs com estado próprio `ativo` ou `arquivado` e o mesmo nome na mesma Pasta (B39).
- **INV-SUB-12.** Estado próprio anterior à exclusão está preenchido se e somente se o estado próprio é `na lixeira`, e vale `ativo` ou `arquivado`.

## 15. Personalização

Idêntica à de Pasta. Personalizável por quem tem `editar` (nome, descrição, cor, ícone, ordem) ou `administrar` (Privada, por Membro `ativo`; arquivar e desarquivar; Conjunto de Status, Definições de Campo, Tipos de Tarefa, Visualizações padrão, Funcionalidades habilitadas — cada um `herdado`, `sobrescrito` ou `bloqueado` para as Listas; concessões; Automações de escopo Subpasta, conforme documento de Automações).

Não personalizável: identificador, Criador, momento de criação, nível, profundidade, pai (só por movimentação), estados e transições, a proibição de conter Subpastas, e qualquer aspecto bloqueado por ancestral.

## 16. Herança

### 16.1 Cadeia

Espaço (primeiro ponto de definição) → Pasta → Subpasta → Lista. A Tarefa consome a configuração da sua Lista e nunca define (B25). O Espaço de Trabalho não é nível dessa cadeia (documento 01, seção 16).

### 16.2 Aspectos no terceiro nível

| Aspecto | Combinação (B25) | O que a Subpasta recebe | O que pode fazer |
| --- | --- | --- | --- |
| Conjunto de Status | substitui | O efetivo da Pasta (próprio ou herdado do Espaço). | Sobrescrever, se nem Espaço nem Pasta bloqueiam; bloquear para as Listas. |
| Definições de Campo para Tarefas | acumulam | Todas as do Espaço e da Pasta. | Acrescentar as próprias; nunca remover herdadas. |
| Tipos de Tarefa | acumulam (B25) | Todos os do Espaço e da Pasta. | Acrescentar os próprios; nunca remover herdados. |
| Visualizações padrão, Funcionalidades habilitadas | substituem (B25) | O efetivo da Pasta. | Sobrescrever ou bloquear, salvo bloqueio superior. Desabilitar Funcionalidade nunca apaga dados. |
| Automações | acumulam | Todas as de escopo Espaço de Trabalho, Espaço e Pasta. | Ser escopo de Automações próprias; nunca desativar as herdadas. |
| Permissões | herdadas | As permissões efetivas sobre a Pasta. | Acrescentar concessões; interromper com Privada (17). |

A diferença operacional do terceiro nível: a Subpasta pode receber bloqueios de **dois** ancestrais, e a Lista abaixo dela, de **três**. É o maior número de pontos de definição possível na plataforma; "nível" é o que permite a Painéis e Agentes saber, sem percorrer a árvore, quantos são.

### 16.3 Recálculo em movimentação

Ao mudar de ancestrais (Subpasta movida, promovida ou rebaixada; Lista movida para fora ou para dentro), para cada aspecto e para cada descendente: modo `herdado` passa a resolver no novo ancestral mais próximo; modo `sobrescrito` é mantido, salvo bloqueio no novo ancestral, o que rejeita a movimentação (RN-SUB-12). Definições de Campo dos antigos ancestrais deixam de se aplicar; Definições dos novos passam a aplicar-se. Valores de Campo de Definições que deixaram de se aplicar passam a `arquivado` no agregado da Tarefa (DO-SUB-05 / B37): preservados e ocultos, não eliminados — A5.4 só elimina Valores quando a Definição é removida, e mudança de posição não remove Definição alguma; se a Tarefa voltar ao escopo, os Valores reaparecem. Detalhamento no documento de Tarefa.

## 17. Permissões e visibilidade

| Elemento | Na Subpasta |
| --- | --- |
| Sujeito | Membro, Equipe, Papel, Agente (A9.1). |
| Recurso | A própria Subpasta. |
| Ação | ver, comentar, criar (Listas), editar, excluir, administrar. `executar` não se aplica. |
| Escopo | `registro` (só a Subpasta) ou `subárvore` (Subpasta, Listas e Tarefas). `próprios` não se aplica a contêineres (B29). |
| Origem | Papel no Espaço de Trabalho; herança da Pasta (que já carrega a do Espaço); concessão direta; compartilhamento. |
| Herança | Padrão. Permissão efetiva = união das origens (documento 01, 17.1). |
| Exceção | Privada: origens "papel" e "herança" deixam de contar, inclusive para Administradores e para o Proprietário do Espaço de Trabalho; só concessão direta e compartilhamento. Sempre ao menos um Membro `ativo` com `administrar`; Proprietário e Administradores entram apenas por ato de governança registrado (RN-SUB-08; B38). |

**Subpasta Privada dentro de Pasta não privada**: válido; quem vê a Pasta não vê a Subpasta sem concessão; as Listas herdam da Subpasta, logo ficam igualmente restritas. **Subpasta não privada dentro de Pasta Privada**: "não privada" significa "herda", e o que herda é a restrição da Pasta; a Subpasta é tão restrita quanto a Pasta. Não existe "Subpasta pública" como estado: Privada é só uma interrupção.

**IA sujeita às mesmas regras.** Um Agente sem `ver` na Subpasta não a lista, não lê suas Listas e não cria Listas nela, mesmo invocado por quem pode (interseção, A9.3). Um Agente autônomo usa só as próprias permissões. Painéis com Fonte de Dados na Subpasta filtram pelo visualizador (B20).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Subpasta criada | 12.1 (a), (c), (d) | identificador, Pasta pai, Criador, Template de origem | Auditoria; Automações (Gatilho); Painéis |
| Pasta rebaixada a Subpasta | 12.3 | identificador, Espaço de origem, Pasta pai nova, ator | Auditoria; recálculo de herança; Painéis (Dimensão nível) |
| Subpasta promovida a Pasta | 12.3 | identificador, Pasta pai antiga, Espaço de destino, ator | Idem |
| Subpasta movida | 12.3 | identificador, Pasta pai antiga e nova, ator | Idem |
| Configuração da Subpasta alterada | Mudança de modo ou valor de um aspecto | aspecto, modo antes e depois, ator | Listas descendentes (recálculo); Tarefas (Mapeamento de status, se Conjunto de Status) |
| Subpasta marcada / desmarcada como Privada | 17 | ator | Reavaliação de permissões; Execuções em curso (B23) |
| Permissão concedida / revogada na Subpasta | Concessão ou compartilhamento | Sujeito, Ação, Escopo, ator | Auditoria; Execuções (B23) |
| Subpasta arquivada / restaurada | 12.2 | identificador, ator, descendentes afetados | Automações (parar/retomar); Painéis |
| Subpasta enviada à lixeira / restaurada | 12.2 | identificador, ator, Estado próprio anterior à exclusão | Idem; Visualizações |
| Subpasta eliminada | 12.2 | identificador, momento, contagem de descendentes, Automações eliminadas | Automações (eliminadas com o escopo, B41); Painéis |
| Movimentação rejeitada por profundidade ou bloqueio | RN-SUB-02, 11, 12, 13 | tentativa, motivo, ator | Auditoria; Execução de Agente ou Automação (falha registrada) |

Todos geram Registro de Atividade. Eventos sobre Listas e Tarefas descendentes são dos respectivos documentos.

## 19. Dependências

**A Subpasta depende de**: Pasta pai (nível 1) e, por ela, Espaço e Espaço de Trabalho; do documento de Pasta, para tudo o que é comum. **Dependem da Subpasta**: suas Listas e, transitivamente, suas Tarefas; Definições de Campo com ponto de definição nela; concessões e Visualizações da Subpasta; Automações com escopo nela (eliminadas com ela, B41). Painéis a referenciam, mas sobrevivem à sua eliminação (Widgets `inválido`; Âncora de Painel de contexto `eliminada` — RN-PAI-20; DO-PAI-07).

**Documentos condicionados**: Pasta (atributo "contêiner pai", regras de rebaixamento e de movimentação de Pasta com Subpastas); Lista (movimentação entre níveis, Mapeamento de status); Tarefa (Valores de Campo fora de escopo, DO-SUB-05); Automações (escopo inexistente, criação de estrutura por Agente); Painéis (Dimensão "nível"); Templates (Template de Pasta com ou sem Subpastas).

## 20. Casos limítrofes e ambiguidades

### 20.1 Criar Subpasta dentro de Subpasta

Inválido (RN-SUB-02, INV-SUB-02). Vale para criação direta, movimentação, Template e Agente. A resposta correta ao ator é a alternativa: criar uma Lista na Subpasta, ou criar a nova Subpasta como irmã (na mesma Pasta). A ontologia não oferece "agrupamento virtual" abaixo de Subpasta; se o produto quiser separar Listas dentro de uma Subpasta, o mecanismo é Visualização com agrupamento, não estrutura.

### 20.2 Mover Pasta com Subpastas para dentro de outra Pasta

Rejeitado (RN-SUB-11). Alternativas consideradas: (a) **achatar automaticamente** — as Subpastas da Pasta movida viram irmãs dela, ou suas Listas sobem para a Pasta movida: altera a estrutura de registros que o ator não escolheu mover e recalcula herança em silêncio; (b) **exigir achatamento explícito** — o ator escolhe o destino de cada Subpasta antes: correto, mas é uma sequência de movimentações individuais, cada uma já prevista em 12.3; (c) **rejeitar** com a lista das Subpastas que impedem. Recomendação: (c). O ator faz (b) por movimentações explícitas, cada uma com evento próprio. DO-SUB-03 / B40.

### 20.3 Subpasta cuja Pasta pai é arquivada

O estado próprio permanece `ativo`; o efetivo passa a `arquivado` (seção 11). Nenhuma Lista ou Tarefa é criada nela; Automações de escopo Subpasta não disparam; Painéis continuam a lê-la (registros arquivados são dados). Restaurar a Pasta devolve a Subpasta ao efetivo `ativo`. Enquanto a Pasta está arquivada, quem tem `administrar` na Subpasta pode arquivá-la individualmente (ela permanecerá `arquivado` quando a Pasta for restaurada) ou movê-la para fora, para um destino efetivamente `ativo` em que tenha `criar` (RN-SUB-10; B40): o arquivamento restringe a operação sobre o conteúdo, não os atos de governança sobre os descendentes. Alternativa rejeitada: proibir a extração — obrigaria a restaurar a Pasta inteira (reativando dezenas de Listas) para salvar uma Subpasta, e B36 já admite que descendentes tenham estado próprio distinto do ancestral.

### 20.4 Subpasta Privada dentro de Pasta não privada, e o inverso

Tratado na seção 17. O caso perigoso é o inverso: um Administrador de Pasta Privada marca uma Subpasta como "não privada" acreditando abri-la ao Espaço. Não abre: "não privada" herda a restrição da Pasta. Para abrir, concede-se na Subpasta aos Sujeitos desejados (concessão direta), o que não exige tornar a Pasta visível (RN-SUB-09).

### 20.5 Conjunto de Status sobrescrito quando a Pasta (ou o Espaço) bloqueia

Dois momentos. **Bloqueio anterior**: a sobrescrita é rejeitada na configuração (RN-SUB-05). **Bloqueio posterior** (a Subpasta já sobrescreveu e a Pasta passa a bloquear): reverter a sobrescrita obrigaria a remapear o status de todas as Tarefas da subárvore em silêncio. Regra (DO-SUB-06 / B25): o ato de bloquear é rejeitado enquanto houver sobrescritas descendentes, com a lista delas; o ator resolve cada uma (remove a sobrescrita, com remapeamento explícito) e então bloqueia. Mesmo princípio de RN-SUB-12. O caso simétrico — promover uma Subpasta com sobrescrita para um Espaço que bloqueia — é rejeitado por RN-SUB-12. Esta regra vale para todo nível e foi incorporada a B25 (documentos de Espaço, Pasta e Lista harmonizados).

### 20.6 Template de Pasta que contém Subpastas instanciado dentro de uma Pasta

O Template descreve uma Pasta de nível 1 com Subpastas. Instanciá-lo dentro de uma Pasta produziria nível 3. Alternativas: achatar (as Subpastas do Template viram Listas? viram irmãs?) ou rejeitar. Recomendação (DO-SUB-04): rejeitar, indicando que o Template só pode ser instanciado em um Espaço, ou que o Template para uso dentro de Pastas deve ser um Template de Pasta sem Subpastas. Achatar inventaria uma estrutura que o autor do Template não desenhou. Consequência para o documento de Templates: um Template de Pasta declara se contém Subpastas, e isso determina onde pode ser instanciado.

### 20.7 Agente ou Automação criando estrutura além da profundidade

Um Agente que, ao "organizar o projeto", cria Pasta → Subpasta → agrupador dentro da Subpasta: a terceira Ferramenta falha (RN-SUB-02), a Execução registra a falha e, conforme o nível de autonomia e o documento de Agentes, passa a `falhou` ou continua com o erro no Contexto. As entidades já criadas permanecem: cada Ferramenta é atômica e válida por si; não há reversão automática de estrutura válida. A rejeição é a mesma para humanos; Agentes não têm atalho (A6.3). O Contexto do Agente deve conter a profundidade máxima como fato, para que o Agente planeje sem tentar.

### 20.8 Lista movida de Subpasta para Espaço (sobe dois níveis)

Recálculo (16.3) com dois ancestrais a menos. Conjunto de Status: se a Lista o sobrescrevia, mantém, salvo bloqueio no Espaço (rejeição); se herdava da Subpasta ou da Pasta, passa a herdar do Espaço, com mapeamento de status das Tarefas por categoria (B40). Definições de Campo da Pasta e da Subpasta deixam de se aplicar; Valores `arquivado` no agregado (DO-SUB-05 / B37). Automações de escopo Pasta e Subpasta deixam de disparar para essa Lista; as do Espaço continuam; as de escopo na própria Lista a acompanham. Permissões: a Lista passa a herdar do Espaço; se a Subpasta era Privada, a Lista deixa de estar sob a restrição — o ator que move precisa de `administrar` na Lista e `criar` no destino (B40), e a mudança de visibilidade é registrada (evento "Permissão" por recálculo). Painéis com Fonte de Dados "Tarefas da Subpasta X" deixam de incluí-la.

### 20.9 Subpasta Privada cujo único concessionário é removido

Sem a exceção de B28 (B38), a remoção revogaria a única concessão (RN-ET-09) e a Subpasta ficaria sem nenhum Sujeito com acesso: sem Proprietário para suceder, sem herança por ser Privada. Com RN-SUB-08, a concessão `administrar` passa ao Sucessor da remoção no mesmo ato; e, se ainda assim for preciso reatribuir a governança, o Proprietário ou um Administrador do Espaço de Trabalho concede acesso por ato de governança registrado — nunca por acesso silencioso de Papel. INV-SUB-10. Alternativa rejeitada na harmonização: "Administradores mantêm `administrar` sobre todo contêiner Privado" — tornaria a privacidade nominal para o nível que mais precisa dela (RH, diretoria) e contradiria A9.2.

### 20.10 Pasta rebaixada que era escopo de Automações e Fonte de Dados de Painéis

Continuam válidos: escopo e Fonte de Dados apontam para o identificador (RN-SUB-15). Um Painel que segmenta por Dimensão "nível" passa a exibir o registro em nível 2. Uma Automação cuja Condição dependa de "nível = 1" deixa de casar; é comportamento correto, não inconsistência.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Tarefas | Lista | A3.2: só Listas contêm Tarefas. |
| Listas (como componentes) | Elas mesmas (raiz de agregado) | São filhas estruturais com identidade; a Subpasta é escopo, não agregado. |
| Automações de escopo Subpasta | Espaço de Trabalho | Documento 01, seção 8; a Subpasta é escopo. |
| Templates de Subpasta | Espaço de Trabalho (catálogo) | A8. Não existe "Template de Subpasta": é Template de Pasta sem Subpastas. |
| Conjunto de Status herdado | Pasta ou Espaço (ponto de definição) | Só o sobrescrito é da Subpasta. |
| Definições de Campo herdadas | Espaço ou Pasta | Idem; acumulam, não se copiam. |
| Valores de Campo | Tarefa | A5.1. |
| Permissões herdadas | Pasta / Espaço / Papel | A Subpasta guarda só concessões diretas e compartilhamentos sobre si. |
| Proprietário | Não existe | A7 não lista contêineres. |
| Nível | Derivado da posição | Não é atributo gravado; muda com o pai. |

## 22. Exemplos conceituais

**Exemplo 1 — Agência.** Espaço "Clientes"; Pasta "Cliente Alfa" (nível 1); Subpastas "Site" e "Campanha Q4" (nível 2); em "Site", Listas "Design", "Desenvolvimento", "QA". O Espaço define o Conjunto de Status "Aberto → Em progresso → Revisão → Concluído" e o bloqueia. "Cliente Alfa" acrescenta a Definição de Campo "Centro de custo". "Site" acrescenta "Ambiente" (seleção). A Lista "QA" tenta sobrescrever o Conjunto de Status: rejeitado (bloqueio do Espaço, INV-SUB-05). Uma Tarefa em "QA" tem três Definições de Campo aplicáveis: as do Espaço, "Centro de custo" e "Ambiente".

**Exemplo 2 — Reorganização.** A Pasta "Campanhas 2026" (nível 1, Espaço "Marketing") cresceu; a Administradora a move para dentro da Pasta "Marketing Digital". Como "Campanhas 2026" não tem Subpastas, o rebaixamento é válido: vira Subpasta, mesmo identificador; o Painel "Campanhas" continua a lê-la; a Automação "ao concluir, notificar" continua com o mesmo escopo. Meses depois, ela tenta mover "Marketing Digital" (que agora contém "Campanhas 2026") para dentro de "Diretoria": rejeitado (RN-SUB-11), com a indicação de que "Campanhas 2026" precisa ser promovida ou movida antes.

**Exemplo 3 — Privacidade.** Pasta "RH" não privada no Espaço "Administrativo". A Subpasta "Desligamentos" é marcada Privada por Maria, que recebe `administrar` no ato e concede acesso a Pedro. Um Agente de recrutamento, invocado por um Membro que vê "RH", pede "liste as Listas de RH": recebe todas, exceto as de "Desligamentos" (interseção, A9.3). Maria é removida: como era a única com `administrar`, a concessão passa ao Sucessor indicado na remoção (RN-SUB-08). Se ninguém com `administrar` estiver disponível, o Administrador do Espaço de Trabalho concede acesso a um terceiro por ato de governança registrado, com motivo, visível a Pedro (B38).

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
└── Espaço (0..N)                     [nível 0: origem da herança estrutural]
    ├── Lista (0..N)                  [pai Espaço]
    └── Pasta (0..N)                  [nível 1; pai Espaço]
        ├── Lista (0..N)              [pai Pasta]
        └── SUBPASTA (0..N)           [nível 2; pai Pasta; = Pasta com pai Pasta]
            ├── Lista (0..N)          [pai Subpasta; 1 Conjunto de Status efetivo]
            │   └── Tarefa (0..N)
            ├── Definição de Campo (0..N, ponto de definição)  ─ acumula com Espaço e Pasta
            ├── Conjunto de Status sobrescrito (0..1)          ─ substitui o herdado
            ├── Concessão de permissão (0..N)
            └── ✗ Subpasta / Pasta / Tarefa                    (proibido: A3.4, A3.2)

Herança:   Espaço ──► Pasta ──► Subpasta ──► Lista ──► Tarefa (consome)
Bloqueio:  desce; sobrescrita: só onde nenhum ancestral bloqueou
Permissão: Papel ∪ herança da Pasta ∪ concessão ∪ compartilhamento
           Privada: só concessão ∪ compartilhamento (≥1 Membro ativo com administrar;
                    Proprietário/Administradores do ET só por ato de governança registrado — B38)

Referências (não contenção):  Automação ──escopo──► Subpasta
                              Painel/Widget ──Fonte de Dados──► Subpasta
                              Subpasta ──proveniência──► Template

Movimentação:  Pasta(sem Subpastas) ⇄ Subpasta   (rebaixar / promover; mesma identidade)
               Pasta(com Subpastas) → dentro de Pasta   ✗ rejeitado
```

## 24. Decisões ontológicas

- **DO-SUB-01.** Subpasta é uma Pasta cujo pai é uma Pasta: mesma entidade, mesma identidade, mesmas capacidades; única restrição própria: não contém Subpastas nem Pastas. Profundidade máxima de agrupamento: dois níveis. Aplica A3.4 e B3. CONSOLIDADA.
- **DO-SUB-02 / B40.** "Nível" é atributo derivado (1 ou 2), não identidade. Rebaixamento (Pasta → Subpasta) e promoção (Subpasta → Pasta) preservam identificador, referências e histórico; recalculam herança; geram evento. Justificativa: seção 5. Incorporada a B40 e ao Glossário ("Nível", "Promoção / Rebaixamento").
- **DO-SUB-03 / B40.** Mover uma Pasta com Subpastas para dentro de outra Pasta é rejeitado, com a lista das Subpastas impeditivas; não há achatamento automático. Justificativa: 20.2. Consolidada em B40.
- **DO-SUB-04 / B47.** Um Template de Pasta que contém Subpastas só pode ser instanciado em um Espaço; instanciá-lo dentro de uma Pasta é rejeitado. O Template declara se contém Subpastas. Justificativa: 20.6. Consolidada em B47; o documento de Templates a referencia.
- **DO-SUB-05 / B37.** Quando uma movimentação retira uma Tarefa do escopo de uma Definição de Campo (mudança de ancestrais), os Valores de Campo passam a `arquivado` no agregado da Tarefa: preservados e ocultos, não eliminados; reaparecem se a Tarefa voltar ao escopo. Justificativa: A5.4 só elimina Valores na remoção da Definição; RN-ET-17 veda cascata destrutiva por mudança de configuração. Consolidada em B37.
- **DO-SUB-06 / B25.** Bloquear um aspecto em um nível é rejeitado enquanto houver sobrescritas em descendentes, com a lista delas; o ator as resolve explicitamente antes. Simetricamente, movimentação para sob um ancestral que bloqueia um aspecto sobrescrito é rejeitada. Justificativa: 20.5; nenhuma reversão silenciosa de configuração. Incorporada a B25; vale para Espaço, Pasta, Subpasta e Lista.
- **DO-SUB-07 / B38.** Contêineres privados ocultam o conteúdo de todos sem concessão, inclusive Administradores e Proprietário do Espaço de Trabalho; estes só entram por ato de governança registrado; todo contêiner privado tem ao menos um Membro `ativo` com `administrar`, e a concessão passa ao Sucessor na remoção. **Substitui** a versão anterior desta decisão ("Administradores mantêm `administrar` sobre todo contêiner Privado"), rejeitada na harmonização (20.9). Consolidada em B38.
- **DO-SUB-08 / B38.** Compartilhar um contêiner ou Lista com quem não vê os ancestrais concede o Recurso e os nomes do caminho, nunca o conteúdo dos ancestrais. Coerente com o documento 01 (exemplo 5). Consolidada em B38 (e).

Nenhuma decisão contradiz A1–A9 ou B1–B99. As decisões marcadas "/ Bnn" foram consolidadas na constituição na harmonização e na revisão da fase 2; a auditoria da fase 6 aplicou DO-PAI-07 / RN-PAI-20 (12.2, 19) e B47 (DO-SUB-04).

## 25. Questões em aberto

Nenhuma pendência aberta específica da Subpasta. Resolvidas na harmonização da fase 2: movimentação de Subpasta entre Espaços — válida, atômica, com mapeamento de status por categoria e Valores arquivados (B40); Automação cujo escopo foi eliminado — eliminada com o escopo, inoperante enquanto o escopo está `arquivado` ou `na lixeira` (B41; a recomendação anterior deste documento, "passa a inativa", foi substituída); unicidade de nome entre irmãs — exigida (B39), o que acrescenta a colisão de nome no destino como condição de rejeição de rebaixamento, promoção e movimentação (RN-SUB-12).
