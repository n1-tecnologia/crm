# AGENTE

> Domínio: IA | Documento 17 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

Um **Agente** é uma entidade de inteligência artificial **configurável**, com **identidade própria** e **Proprietário humano**, capaz de perseguir um **objetivo** por meio de raciocínio (um Modelo) e de capacidades da plataforma — **Ferramentas** que executa, **Habilidades** que exerce e **Conhecimento** que consulta — sempre **sob permissões** que lhe são concedidas e **sob um nível de autonomia** que decide quando um humano precisa aprovar (B7, B15, B16, B17, B22, B33).

O Agente é, ao mesmo tempo, três coisas que a constituição distingue e que nenhuma outra entidade do domínio IA reúne:

1. **É Ator** (A6.1). Age; as suas ações geram Registros de Atividade com ele como ator e, quando age em nome de um Membro, com o Membro como ator delegante (A6.2). Habilidade, Automação e Modelo não são Atores no mesmo sentido: a Habilidade é exercida, a Automação reage sem raciocinar e o Modelo é recurso global sem identidade no Espaço de Trabalho.
2. **É Sujeito de autorização** (A6.3, A9.1, A9.3). Tem Papel, recebe concessões diretas e compartilhamentos, e está sujeito às mesmas regras que humanos, nunca acima delas. A sua permissão efetiva em nome de um Membro é a interseção das duas; autônomo, é só a sua.
3. **É unidade de funcionamento com história.** Cada vez que persegue um objetivo produz uma **Execução de Agente** (B18): registro com identidade, ciclo de vida, passos, custo e resultado. Tudo o que "acontece" com IA na plataforma acontece dentro de uma Execução de Agente (B17): não há exercício de Habilidade, consulta de Conhecimento ou envio de Mensagem por IA fora dela.

O que o Agente **não** é, em uma frase cada: não é a Sessão de Chat (a Sessão é do Membro; o Agente é da organização), não é a Habilidade (a Habilidade é competência sem sujeito; o Agente é o sujeito), não é a Automação (a Automação tem Gatilho; o Agente não tem — é invocado), não é o Modelo (o Modelo é recurso global sem permissões nem Proprietário; o Agente o usa) e não é a Execução (a Execução é um episódio; o Agente é quem o vive).

Uma propriedade **essencial**, não incidental: o Agente **não tem gatilho próprio**. Ele nunca se ativa sozinho. É invocado por um Membro (em Sessão de Chat ou por ação direta sobre um registro), por uma Automação (Ação "invocar Agente") ou por outro Agente (Ferramenta "invocar Agente"). É por isso que "Agente Responsável por uma Tarefa" ou "Agente Atribuído a uma Conversa" (B7) não faz o Agente trabalhar: faz dele o encarregado, e o trabalho ocorre quando algo o invoca. Sem esse traço, Agente e Automação se confundiriam.

## 2. Propósito

- **Dar sujeito às capacidades de IA.** Ferramentas, Habilidades e Conhecimento são capacidades sem vontade; o Agente é quem as combina para um objetivo, e é sobre ele — não sobre elas — que recaem permissão, autonomia, custo e responsabilidade.
- **Governança e accountability humana.** Todo Agente tem exatamente um Proprietário Membro (A7, B7), um Papel que nunca é de governança (B30) e um Registro de Atividade por ação. A organização sabe *quem responde* por cada ato de IA.
- **Reprodutibilidade e auditoria.** A configuração é versionada (B24); cada Execução referencia a Versão de Agente, o Modelo usado, a entrada, os passos, as Referências de Conhecimento e o custo (C8). É possível responder "por que o Agente fez isso" meses depois.
- **Segurança por interseção.** O Agente nunca amplia o acesso de quem o invoca (A9.3): um Membro não vê pelo Agente o que não veria sozinho; um Agente não age além do que lhe foi concedido.
- **Reutilização operacional.** O mesmo Agente é invocado por dezenas de Automações, por Sessões de Chat e por outros Agentes, com o mesmo comportamento e a mesma Memória, sem cópia de configuração.

## 3. Natureza da entidade

- **Entidade com identidade própria**, pertencente ao Espaço de Trabalho (pertencimento: raiz do próprio agregado; o Espaço de Trabalho é o escopo — documento 01, seção 8). Nunca é global (A1.3): mesmo o Assistente padrão é instanciado por Espaço de Trabalho (B33).
- **Ator** (A6.1) e **Sujeito** de permissão (A9.1). A Automação é igualmente Ator e Sujeito, mas com o Proprietário como teto de permissões (DO-AUT-01; B88); a Integração é Ator e não é Sujeito (documento 01, 17.1).
- **Agregado** cuja raiz é o Agente e cujos componentes são: **Versões de Agente** (entidades internas, 7.1), **Execuções de Agente** (entidades internas com ciclo de vida próprio, 7.2), **Memória do Agente** com os seus **Itens de Memória** (entidade interna, 7.5) e **Solicitações de Aprovação** (entidades internas da Execução, 7.6). Objetos de valor: Contexto (7.4), Passo (7.3), Ferramentas permitidas (7.7), Política de aprovação (7.8), Política de retenção de Memória (7.5), Custo (7.9), Proveniência.
- **Associado** a Habilidades por Concessão de Habilidade (documento 18, 7.2 — B15) e a Coleções por concessão de permissão gravada na Coleção (documento 20, 17.3 — DO-CNH-12).
- **Configuração com estado operacional**: diferentemente de Habilidade e Template (definições sem estado), o Agente tem Memória, Execuções e Proprietário. É por isso que o Assistente padrão é instanciado, e não referenciado (DO-ET-11).
- **Não é** contêiner estrutural, não tem Status (A4.2), não tem Campos Personalizados nem Tags (A5.2, A8) e não é Template (o Template de Agente é entidade do catálogo do Espaço de Trabalho, seção 4.5).

## 4. Fronteira conceitual

### O que é

- Um sujeito de IA configurado pela organização: objetivo, instruções, Modelo, Ferramentas permitidas, Habilidades concedidas, Conhecimento acessível, Papel, concessões, nível de autonomia, Política de aprovação, Memória.
- Um Ator com Proprietário, versão e histórico de Execuções.
- Um Recurso de permissão (`ver`, `editar`, `executar`, `administrar` sobre o Agente).
- O único executor de Habilidades e o único consumidor de Modelo em nome da organização fora de Sessões de Chat.

### O que não é

- **Não é Sessão de Chat**: a Sessão é ambiente pessoal de um Membro (B21); o Agente é entidade organizacional que a Sessão pode ter como principal (4.1).
- **Não é Habilidade**: a Habilidade é competência exercida; o Agente é quem a exerce (4.2).
- **Não é Automação**: a Automação reage a Gatilho; o Agente não tem Gatilho (4.3).
- **Não é Modelo**: o Modelo é entidade global que o Agente referencia (4.4).
- **Não é Ferramenta**: a Ferramenta é operação atômica sem raciocínio; o Agente a invoca (4.5).
- **Não é Membro**: o Membro é humano e pode ser Proprietário; o Agente nunca é Proprietário nem Administrador (4.6).
- **Não é Execução de Agente**: a Execução é um episódio; o Agente persiste entre episódios (4.7).
- **Não é o Assistente padrão** enquanto categoria: o Assistente padrão é *um* Agente, com restrições próprias (4.8).

### Comparações

| X × Y | X (Agente) | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Agente × Sessão de Chat** | Entidade da organização, com Proprietário Membro, Papel, Memória do Agente, Execuções; invocável por Automações e por outros Agentes; sobrevive à remoção do Membro (sucessão B28). | Ambiente pessoal de um Membro (B21): sequência de Mensagens de Chat, Contexto, Arquivos, Memória do Usuário, 0..1 Agente principal, âncora opcional; invisível a outros salvo compartilhamento; não é sucedida — vai à lixeira na remoção do Membro (B87). | A Sessão **usa** um Agente como principal; cada turno em que o Agente responde é uma Execução de Agente originada na Sessão (7.2). A Sessão sem Agente explícito usa o Assistente padrão. O Agente não contém Sessões nem Mensagens de Chat. Documento 16. |
| **Agente × Habilidade** | Sujeito: tem Modelo, Memória, permissões, autonomia, Proprietário, custo; exerce. | Definição: instruções, Ferramentas requeridas, contrato, dependências, versão; sem Proprietário, sem permissões, sem Execução própria (DO-HAB-06, INV-HAB-10); é exercida. | O Agente recebe a Habilidade por Concessão (B15, DO-HAB-03) e a exerce como passo de uma Execução (DO-HAB-11). Uma competência que só um Agente usa pode viver nas instruções dele; quando dois precisam dela, é Habilidade (documento 18, 4). |
| **Agente × Automação** | Sem Gatilho; raciocina; invocado; tem Memória; permissões próprias como Sujeito. | Gatilho → Condições → Ações (B16); determinística ou híbrida; escopo estrutural (B41); Sujeito com Papel 0..1 e concessões próprias, com o Proprietário como teto (DO-AUT-01; B88). | A Automação **invoca** o Agente (Ação "invocar Agente"; a Execução de Agente nasce filha e com a Automação como delegante — DO-AUT-15); o Agente **nunca invoca** Automação no sentido de B16 — produz eventos que Gatilhos escutam e pode **acionar** um Gatilho manual pela Ferramenta `acionar Automação` (DO-AUT-24). A Automação pode reduzir o Nível de autonomia efetivo da Execução, nunca ampliá-lo (B22). Uma Execução de Automação pode conter Execuções de Agente (B18). Documento 19. |
| **Agente × Modelo** | Entidade do Espaço de Trabalho, com identidade, Proprietário, permissões, versão; usa um Modelo. | Entidade **global** (A1.3): modelo de inteligência artificial com Capacidades declaradas (DO-HAB-10); sem Proprietário, sem permissões, sem Memória; nunca pertence a um Espaço de Trabalho. | O Agente **referencia** um Modelo principal (ou o Modelo `padrão da plataforma`, DO-AGE-04) e o substitui sem perder identidade (seção 5). Trocar o Modelo é nova Versão de Agente; a Execução registra o Modelo concreto usado. Documento 15. |
| **Agente × Ferramenta** | Raciocina; escolhe e sequencia Ferramentas; tem permissões e autonomia. | Operação atômica com contrato, Recurso-alvo, permissão requerida e classe de efeito (DO-HAB-13); sem raciocínio; do Catálogo (plataforma ∪ Integrações). | O Agente só invoca Ferramentas que lhe são **permitidas** (7.7) e, a cada invocação, sob a permissão requerida sobre o registro concreto (DO-HAB-14, B23). "invocar Agente" é ela própria uma Ferramenta (DO-AGE-08). |
| **Agente × Membro** | Ator de IA; Sujeito com Papel restrito (nunca Proprietário ou Administrador — B30, INV-ET-13); nunca Proprietário de registro algum (B7); pode ser Responsável e Atribuído; tem Proprietário. | Relação de Usuário com o Espaço de Trabalho (A1.4); único Ator humano; pode ser Proprietário, Administrador, aprovador, Sucessor; não tem Proprietário. | Um Agente age *em nome de* um Membro (delegante) com a interseção das permissões (A9.3), ou de forma autônoma com as suas. O Membro responde; o Agente executa. Nenhum atributo de Membro (Papel de governança, Equipe, Sessões, Memória do Usuário) se transfere ao Agente. |
| **Agente × Execução de Agente** | Entidade persistente; configuração versionada; existe entre Execuções; tem Memória. | Entidade interna com identidade e ciclo de vida (B18): um episódio com invocador, delegante, Versão de Agente, Modelo usado, entrada, Contexto, Passos, saídas, custo, momentos e estado. | O Agente **contém** as suas Execuções (pertencem a ele, 7.2); a Execução não existe sem o Agente e referencia a versão dele à época. Pausar ou arquivar o Agente não cancela Execuções em curso; cancelar é ato sobre a Execução (RN-AGE-19). |
| **Agente × Assistente padrão** | Categoria: qualquer Agente do Espaço de Trabalho, criado por Membro ou instanciado de Template. | Um Agente específico, instanciado pela plataforma na criação do Espaço de Trabalho (B33): Proprietário = Proprietário do Espaço de Trabalho, acompanha a transferência; não pode ser excluído, arquivado, pausado nem substituído como padrão; é o executor de toda invocação sem Agente indicado (B17, B21). | Mesma entidade, um exemplar com invariantes adicionais (INV-AGE-11). Tudo o que vale para Agente vale para ele; o que vale só para ele está na seção 12.6. |

### 4.1 Agente e Sessão de Chat: onde termina um e começa o outro

A Sessão de Chat é o **lugar** da interação de um Membro com a IA; o Agente é **quem** responde. Cada resposta do Agente em uma Sessão é uma Execução de Agente com invocador Membro (a Sessão como origem) e delegante o mesmo Membro; a Execução referencia a Sessão (7.2) e grava os seus Passos; a Mensagem de Chat com papel `assistente` é a saída. A Sessão guarda o histórico conversacional (Mensagens de Chat) e a Memória do Usuário; o Agente guarda a Memória do Agente. Nada do que é da Sessão passa a ser do Agente sem Ferramenta explícita (RN-AGE-24). O documento 16 detalha a Sessão.

### 4.2 Agente e Automação: por que o Agente não tem Gatilho

Se o Agente tivesse Gatilho, seria uma Automação com raciocínio, e a distinção B16 desapareceria: haveria dois lugares para dizer "quando isto acontecer, faça aquilo", com regras de escopo (B41), de permissão e de suspensão (B31) duplicadas. A separação mantém uma única entidade que **reage** (Automação, com escopo e Gatilho) e uma única que **raciocina** (Agente, sem escopo, invocado). "Agente agendado" é uma Automação com Gatilho de agendamento cuja Ação invoca o Agente; "Agente que responde a Mensagens" é uma Automação com Gatilho "Mensagem recebida" que o invoca, ou o Agente Atribuído invocado pela Caixa de Entrada a cada Mensagem recebida (RN-AGE-14).

### 4.3 Template de Agente: da plataforma e do Espaço de Trabalho

"Agente fornecido pela plataforma" não é uma terceira natureza de Agente. É um **Template de Agente da plataforma** (A8): global, somente leitura, que descreve objetivo, instruções, Modelo (ou Modelo `padrão da plataforma`), Ferramentas permitidas, Habilidades a conceder (por identidade — documento 18, 20.15), Política de aprovação e nível de autonomia sugeridos. Instanciá-lo cria um Agente do Espaço de Trabalho com Proveniência, sem vínculo vivo (DO-AGE-12). O Assistente padrão é a instanciação obrigatória de um desses Templates na criação do Espaço de Trabalho (B33). O Espaço de Trabalho também cria os seus próprios Templates de Agente a partir de Agentes existentes (catálogo do Espaço de Trabalho — documento 01, 7.6). Um Template não tem Memória, Execuções, Proprietário nem permissões: é definição; o Agente é a instância viva.

## 5. Identidade

O Agente tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade.

**Teste de identidade.** Se o nome, o objetivo, as instruções, o Modelo, as Ferramentas permitidas, as Habilidades concedidas, as Coleções acessíveis, o Papel, o nível de autonomia, a Política de aprovação, o Proprietário e a Política de retenção de Memória mudarem todos — por meio de novas Versões e de atos de governança —, continua sendo o **mesmo Agente**: as Execuções passadas continuam a pertencer a ele (cada uma com a sua versão), a Memória continua a ser a dele, as Tarefas de que é Responsável e as Conversas de que é Atribuído continuam a apontar para ele, as Automações que o invocam continuam válidas, as Sessões que o têm como principal continuam nele. A identidade é a **continuidade do sujeito** como objeto de governança, de responsabilidade e de auditoria, não qualquer conteúdo de configuração.

Consequências:

- **Versão não é identidade.** Cada Versão de Agente tem número sequencial dentro do Agente (7.1) e é referenciada sempre em conjunto com ele ("Agente X, versão 7").
- **Modelo não é identidade.** Substituir o Modelo cria nova Versão do mesmo Agente; a Memória e as Execuções permanecem (20.8). É o que permite que a descontinuação de um Modelo pela plataforma não elimine Agentes.
- **Nome não é identidade**, mas é **único** entre Agentes `rascunho`, `ativo`, `pausado` ou `arquivado` do mesmo Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades (RN-AGE-02), porque Automações, Habilidades (nas instruções), Membros em Sessões de Chat e outros Agentes o referenciam por nome, e ambiguidade tornaria a invocação não determinística (mesmo princípio de B39 e DO-HAB-16). `na lixeira` não reserva o nome.
- **Instanciar um Template cria outra identidade.** O Agente instanciado tem identificador novo e Proveniência (Template, nome e versão à época); não há vínculo vivo (A8).
- **Um Agente nunca muda de Espaço de Trabalho** (A1.1) e nunca se torna global.
- **A Execução tem identidade própria** (B18), interna ao agregado, referenciada por Registros de Atividade, Solicitações de Aprovação, Rascunhos de Conversa (documento 14, 7.10), Referências de Conhecimento, Execuções filhas e Painéis. O Passo não tem identidade (7.3).

## 6. Atributos fundamentais

Os atributos dividem-se em três grupos: os **do Agente** (não versionados: alterá-los não cria Versão), os **da configuração** (versionados: qualquer alteração cria nova Versão de Agente — B24, 7.1) e os **derivados**.

### 6.1 Atributos do Agente (não versionados)

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Opaco, imutável (seção 5). |
| Espaço de Trabalho | referência | sim | Pertencimento; imutável (A1.1). |
| Nome | nativo | sim | Único no Espaço de Trabalho entre Agentes não `na lixeira` (RN-AGE-02). Editável com Registro de Atividade, sem nova Versão: é rótulo, não comportamento. |
| Descrição | nativo | não | Finalidade em linguagem natural, para Membros que escolhem o Agente. Não entra no Contexto. |
| Estado de ciclo de vida | nativo | sim | `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira` (seção 11; exceção a A4.1 — DO-AGE-10). |
| Estado próprio anterior à exclusão | nativo (condicional) | condicional | Enquanto `na lixeira`: o estado anterior (`rascunho`, `ativo`, `pausado` ou `arquivado`), ao qual a restauração devolve (padrão B43). |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7, B7, INV-ET-03). Transferível por ato explícito; sucessão em B28. Para o Assistente padrão, sempre o Proprietário do Espaço de Trabalho (B33). Alterar o Proprietário não cria Versão: é governança, não comportamento. |
| Criador | referência (Membro) | sim | Membro que criou ou instanciou; `Sistema` para o Assistente padrão. Imutável (A7). Nunca um Agente (INV-AGE-03). |
| Papel | referência (Papel) | sim | Exatamente um (B30). Nunca Proprietário do Espaço de Trabalho, Administrador nem Papel personalizado com base neles (INV-ET-13). Padrão na criação: Convidado (DO-AGE-05). Atribuído só por Papel de nível Administrador (governança, RN-ET-24). Não versionado: é permissão, não comportamento; alterações geram Registro de Atividade e são avaliadas na próxima Ferramenta (B23). |
| Proveniência | objeto de valor | condicional | Presente quando instanciado de Template de Agente (do Espaço de Trabalho ou da plataforma): identificador, nome e versão do Template à época. Sem vínculo vivo (A8). |
| Assistente padrão | derivado (booleano) | — | Verdadeiro para o Agente referenciado pelo atributo Assistente padrão do Espaço de Trabalho (documento 01, 6). |
| Versão corrente | derivado (referência a Versão) | — | A Versão de maior número (7.1). Sempre existe (INV-AGE-01). |
| Limite de custo do Agente | objeto de valor | não | Configuração limitante (B34) definida pela organização: teto de consumo por período para este Agente, dentro da cota do Espaço de Trabalho (C8; RN-AGE-27). Não versionado. |
| Política de retenção de Memória | objeto de valor | sim | 7.5. Não versionada (é política de dados, não comportamento); alterações geram Registro de Atividade. |
| Momentos | nativo | sim | Criação, ativação, última alteração, pausa, arquivamento, exclusão, quando aplicáveis. |

### 6.2 Atributos da configuração (versionados — pertencem à Versão de Agente)

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Objetivo | nativo (texto) | sim para ativar | O que o Agente persegue, em uma ou poucas frases ("qualificar leads da Fila Comercial e propor o próximo passo"). Entra no Contexto de toda Execução. Distinto das instruções: o objetivo diz *para quê*; as instruções, *como se comportar*. |
| Instruções | objeto de valor (texto) | sim para ativar | Orientação geral e própria do Agente: identidade, tom, limites, critérios, o que nunca fazer. Entram no Contexto de toda Execução, antes das instruções de qualquer Habilidade exercida (documento 18, 4). Não contêm Conhecimento (B19) nem credenciais. |
| Modelo | referência (Modelo) ou `padrão da plataforma` | sim | Modelo principal (A1.3), exatamente um, **ou** o marcador `padrão da plataforma`, resolvido a cada Execução para o Modelo que a plataforma designa como padrão naquele momento (DO-AGE-04). A Execução grava sempre o Modelo concreto usado. |
| Admite sobrescrita de Modelo | nativo (booleano) | sim | Se verdadeiro, uma Sessão de Chat que o tenha como Agente principal efetivo pode escolher outro Modelo (Modelo escolhido — documento 16, 6), entre os admitidos ao Espaço de Trabalho (Limites impostos, B34); a Execução grava sempre o Modelo concreto usado. Padrão na criação: falso; Assistente padrão: verdadeiro (recomendação — documento 16, 25.4). Versionado porque altera o raciocínio disponível às Execuções. |
| Ferramentas permitidas | objeto de valor (conjunto) | sim (pode ser vazio) | Identificadores estáveis das Ferramentas do Catálogo que o Agente pode invocar (7.7). É a origem da permissão (Agente, `executar`, Ferramenta, `registro`, concessão direta). Vazio: Agente puramente conversacional. |
| Habilidades concedidas | referência (conjunto de Concessões) | sim (pode ser vazio) | A Concessão de Habilidade vive no Espaço de Trabalho (documento 18, 7.2); a Versão de Agente **registra o conjunto de Habilidades concedidas por identidade** (com versão fixada, se houver) no momento da Versão, porque conceder e revogar altera o comportamento (DO-AGE-02). Publicar nova versão da Habilidade **não** cria Versão de Agente (documento 18, 4.3). |
| Nível de autonomia | nativo (enumeração) | sim | `assistido`, `supervisionado`, `autônomo` (B22). Padrão na criação: `assistido`. Classificação por classe de efeito da Ferramenta (DO-HAB-13; seção 13). |
| Política de aprovação | objeto de valor | sim | 7.8: aprovadores configurados (0..N Membros ou Equipes), tempo limite de aprovação, ordem de resolução. |
| Profundidade máxima de invocação | nativo | não | Quantos níveis de "invocar Agente" este Agente admite abaixo de si (DO-AGE-08), sempre ≤ Limite imposto. Vazio: usa o Limite. |
| Memória habilitada | nativo (booleano) | sim | Se falso, o Agente não grava Itens de Memória e nenhum entra no Contexto (7.5). |
| Momento e Ator da Versão | nativo / referência | sim | Quem alterou e quando (7.1). |

**Conhecimento acessível** não é atributo do Agente nem da Versão: é **visão derivada** das concessões gravadas nas Coleções (DO-CNH-12; documento 20, 17.3). O documento de Agentes o exibe; não o possui. Pela mesma razão, **concessões diretas sobre registros** (por exemplo, `ver` sobre uma Lista) e **compartilhamentos** recebidos (documento 06, 17.2) vivem no Recurso, não no Agente.

### 6.3 Atributos derivados

| Atributo | Descrição |
| --- | --- |
| Disponibilidade | `disponível` ou `indisponível` com motivo(s): estado não `ativo`; Modelo referenciado descontinuado ou indisponível; Proprietário não `ativo` nem `suspenso` (impossível por INV-ET-03; listado por completude); Espaço de Trabalho `suspenso`; Limite de custo ou cota de IA atingidos; nenhuma Versão com objetivo e instruções. Recalculada a cada consulta e verificada no início de cada Execução (RN-AGE-08). Não é estado gravado (DO-AGE-04). |
| Conhecimento acessível | Coleções em que o Agente tem `ver` (ou mais), por concessão direta ou Papel (documento 20, 17.3). |
| Habilidades disponíveis | Concessões com Disponibilidade `disponível` (documento 18, 7.2). |
| Responsabilidades | Tarefas de que é Responsável; Conversas de que é Atribuído (B7). Visão derivada; o Agente não as contém. |
| Execuções em curso | Execuções em `pendente`, `executando` ou `aguardando aprovação`. |
| Custo acumulado por período | Soma do Custo das Execuções (7.9) no período; comparado ao Limite de custo do Agente e à cota do Espaço de Trabalho (C8). |

## 7. Entidades internas ou componentes

### 7.1 Versão de Agente

Entidade interna do agregado, com identificador local (número sequencial a partir de 1, único dentro do Agente). **Imutável** depois de criada. Cada alteração de qualquer atributo da configuração (6.2) cria a Versão seguinte com a configuração completa (B24; DO-AGE-02). Não há `rascunho`, `publicada` nem `obsoleta` como na Habilidade: o Agente não é definição publicada, é sujeito operacional, e a sua alteração vale a partir da **próxima Execução** — Execuções em curso terminam na versão com que começaram (RN-AGE-09). Diferentemente da Habilidade, a Versão de Agente **não** é fixável por terceiros: ninguém "fixa a versão 3 do Agente"; quem invoca sempre obtém a corrente.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Número | nativo | sim | Sequencial, nunca reutilizado. |
| Configuração | objetos de valor | sim | Todos os atributos de 6.2, como valor completo (não diferença). |
| Ator | referência (Membro ou Sistema) | sim | Quem produziu a Versão. Nunca um Agente (INV-AGE-04). `Sistema` para a versão 1 do Assistente padrão e para restauração de padrão de plataforma (12.6). |
| Motivo | nativo (texto) | não | Justificativa livre da alteração. |
| Momento | nativo | sim | |

A versão 1 nasce com o Agente (INV-AGE-01). Versões nunca são eliminadas enquanto o Agente existir: toda Execução referencia uma Versão que existiu (INV-AGE-02).

### 7.2 Execução de Agente

Entidade interna do agregado, **com identidade própria** (B18): um episódio em que o Agente persegue um objetivo a partir de uma entrada, produzindo Passos e saídas. Pertence ao Agente; não existe fora dele; nunca é movida. É o **único lugar** em que Ferramentas são invocadas por IA, Habilidades são exercidas (INV-HAB-09), Conhecimento é consultado por Agente e Modelo é consumido em nome da organização (fora de Sessões de Chat, cujas Execuções também são Execuções de Agente — 4.1).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Único no Espaço de Trabalho; referenciável (seção 5). |
| Agente e Versão | referência | sim | Versão corrente no início; fixa até o fim (RN-AGE-09). |
| Estado | nativo | sim | `pendente`, `executando`, `aguardando aprovação`, `concluída`, `falhou`, `cancelada` (B18; 11.2). |
| Origem | nativo (enumeração) | sim | `Sessão de Chat`, `ação direta` (Membro sobre um registro: "pedir ao Agente", "escalar para Agente"), `Automação`, `Agente` (invocação por outro Agente), `Caixa de Entrada` (Agente Atribuído invocado por Mensagem recebida — RN-AGE-14). |
| Ator invocador | referência (Ator) | sim | Membro, Automação (a sua Execução de Automação), Agente (a sua Execução) ou Sistema (Caixa de Entrada). |
| Ator delegante | referência (Ator: Membro ou Automação) | condicional | Ator em nome de quem a Execução age (A6.2): o **Membro** da Sessão ou da ação direta; a **Automação** (a sua Execução) quando a Execução nasce de Ação "invocar Agente" ou de Condição híbrida (DO-AUT-15), inclusive por agendamento; para invocação por Agente, o delegante herdado da Cadeia (DO-AGE-08); para Origem `Caixa de Entrada`, **vazio** (RN-CXE-23). A permissão efetiva é interseção só com delegante **Membro** (A9.3); com delegante Automação ou sem delegante, a Execução é autônoma e usa só as permissões do Agente (RN-AUT-25). Quando a Automação foi acionada manualmente, o seu próprio delegante (Membro ou Agente acionador) consta da Execução dela: a cadeia de delegantes é derivável da Cadeia de Execuções. |
| Cadeia de Execuções | objeto de valor | sim | Sequência ordenada das Execuções (de Automação e de Agente) desde a raiz até esta, inclusive, ligadas por disparo ou invocação, com a Execução-mãe (0..1), a profundidade (0 na raiz) e, para cada elemento, o Agente ou o par (Automação, objeto). Único objeto de cadeia do domínio (B79): serve a DO-AGE-08 (profundidade, sem repetição), a RN-AUT-09 e à auditoria. |
| Execução pai | referência | condicional | Execução de Automação (B18) ou Execução de Agente invocadora. Vazia para origem `Sessão de Chat`, `ação direta` e `Caixa de Entrada`. |
| Sessão de Chat de origem | referência | condicional | Quando a origem é `Sessão de Chat`. |
| Registro âncora | referência | não | Registro sobre o qual a Execução foi solicitada (Tarefa, Conversa, Negócio, Contato, Documento...). Entra no Contexto sob `ver` efetivo. |
| Entrada | objeto de valor | sim (pode ser vazia) | Pedido em linguagem natural e/ou Parâmetros tipados (mesmo sistema de tipos de DO-HAB-09) e Arquivos referenciados; exercício solicitado (Habilidade indicada, 0..1 — documento 18, 7.3). |
| Modelo usado | referência (Modelo) | sim | O Modelo concreto resolvido no início (6.2, `padrão da plataforma` resolvido). Imutável na Execução. |
| Nível de autonomia efetivo | nativo (enumeração) | sim | O menor entre o nível do Agente e o imposto pelo invocador (Automação: B22; Agente invocador: DO-AGE-08). Fixo do início ao fim (RN-AGE-12). |
| Composição do Contexto | objeto de valor | sim | 7.4: **referências** ao que entrou no Contexto, nunca o conteúdo. |
| Passos | objetos de valor (lista ordenada) | 0..N | 7.3. |
| Saídas | objeto de valor | condicional | Texto e/ou Parâmetros tipados e/ou Arquivos produzidos; para origem `Sessão de Chat`, a Mensagem de Chat `assistente` (documento 16); para Agente Atribuído, a Mensagem enviada ou o Rascunho (documento 14, 7.10). |
| Referências de Conhecimento | objetos de valor | 0..N | DO-CNH-15: Documento, Versão, Fragmentos, Coleção, títulos à época. |
| Itens de Memória produzidos | referência | 0..N | Itens de Memória criados por esta Execução (7.5). |
| Custo | objeto de valor | sim | 7.9. |
| Motivo de término | nativo | condicional | Para `falhou` e `cancelada`: causa (permissão negada — B23; Ferramenta indisponível; Modelo indisponível; cota; tempo limite de aprovação; suspensão do Espaço de Trabalho — B31; cancelamento por Membro; Execução de Automação mãe cancelada — INV-AUT-09; Conversa transferida — documento 14, 12.4; Agente pausado antes do início; erro do Modelo). |
| Momentos | nativo | sim | Criação, início, cada mudança de estado, término. |

A Execução é o objeto do custo (C8, B42), da auditoria de IA (A6.2: cada Passo com efeito gera o Registro de Atividade da Ferramenta, e a Execução em si gera Registros de início e término), da Fonte de Dados de Painéis "Execuções de um Agente" (Glossário) e dos Gatilhos "Execução concluída/falhou" (documento 19).

### 7.3 Passo (objeto de valor da Execução)

Unidade ordenada do que a Execução fez. **Sem identidade** (identificador local dentro da Execução, para referência em Registros e no produto). Tipos:

| Tipo | Conteúdo | Observações |
| --- | --- | --- |
| Chamada de Ferramenta | Ferramenta (identificador estável), entrada, resultado ou erro, **permissão avaliada** (as duas verificações de DO-HAB-14: permitida ao Agente; permissão requerida sobre o registro-alvo, com o Sujeito efetivo), classe de efeito, Solicitação de Aprovação gerada (0..1), Registro de Atividade correspondente, custo, momentos. | Toda escrita, toda leitura de registro e toda consulta de Conhecimento é uma chamada de Ferramenta. "invocar Agente" é chamada de Ferramenta cujo resultado referencia a Execução filha (DO-AGE-08). |
| Exercício de Habilidade | Conforme DO-HAB-11 (documento 18, 7.3): Habilidade + versão à época, origem (`solicitado`/`espontâneo`), entrada, saída, Ferramentas chamadas (Passos aninhados), Exercícios aninhados, Solicitações, resultado. | O Exercício contém as suas chamadas de Ferramenta como Passos aninhados. |
| Solicitação de Aprovação | Referência à Solicitação (7.6), motivo (`autonomia`, `permissão` ou `limite`), Ferramenta alvo, decisão e momentos. | A Execução fica `aguardando aprovação` enquanto o Passo não tem decisão. |
| Raciocínio | Resumo do que o Agente decidiu fazer e por quê, na forma que o Modelo produz. Sem efeito. | Atende à auditoria ("por que escolheu esta Ferramenta"); o produto decide o que exibir. Nunca é Registro de Atividade. |
| Memorização | Item de Memória criado (7.5), com origem. | Só existe se Memória habilitada. |

**Por que não tem identidade** (mesmo raciocínio de DO-HAB-11): nada fora da Execução precisa referenciar um Passo de forma independente; Registros de Atividade referenciam a Execução e a Ferramenta; a Solicitação de Aprovação tem identidade própria por ser sucedida e decidida fora da Execução.

### 7.4 Contexto (objeto de valor efêmero da Execução)

O **Contexto** é o conjunto de informações disponibilizado ao Modelo durante a Execução (Glossário): objetivo e instruções do Agente (Versão), instruções da Habilidade em exercício, registro âncora e registros lidos por Ferramenta, Arquivos, Fragmentos de Conhecimento recuperados (sob `ver` efetivo — INV-CNH-09), Itens de Memória elegíveis (7.5), histórico da Sessão de Chat (quando a origem é Sessão), entrada e resultados de Passos anteriores. É **reconstruído a cada Execução** e **não persiste**: o que a Execução grava é a **Composição do Contexto** — referências (identificadores, versões, Posições de Fragmento, identificadores de Item de Memória) e não o conteúdo (DO-AGE-09). Justificativa: gravar o conteúdo duplicaria dados operacionais e de Conhecimento sob a permissão da Execução, exatamente o que B19 e B20 evitam; as referências bastam para reproduzir e auditar (cada referência resolve com a permissão de quem audita, com marcador se eliminada — RN-CNH-22 por analogia).

Tudo o que entra no Contexto entra **sob a permissão efetiva do Sujeito da Execução** (A9.3), avaliada a cada Ferramenta (B23). Não existe "Contexto ampliado por confiança": um Agente com `ver` em uma Coleção respondendo a um Membro sem `ver` não a usa (documento 20, 20.3). O Contexto é **objeto de valor da Execução**, não do Agente: o Agente não "tem Contexto" entre Execuções; tem Memória (7.5), que é outra coisa.

### 7.5 Memória do Agente e Item de Memória

A **Memória do Agente** é a entidade interna que retém, **entre Execuções**, fatos que o Agente aprendeu ou registrou (Glossário: Memória; C7). É distinta da **Memória do Usuário** (pertence a um Membro, alimentada por Sessões de Chat — documento 16) e do **Conhecimento** (corpus curado por humanos — B19, INV-CNH-12). É **uma por Agente** (1:1, criada com ele, vazia) e contém **Itens de Memória** (0..N), entidades internas com identificador local.

| Atributo do Item | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Conteúdo | nativo (texto) | sim | O fato retido ("o Contato X prefere contato por e-mail"; "a Lista Y usa o status 'Em revisão' antes de 'Concluído'"). Curto; não é Documento. |
| Execução de origem | referência | sim | A Execução que o criou. Sobrevive como valor se a Execução for eliminada por retenção. |
| Delegante de origem | referência (Membro) | condicional | O ator delegante da Execução de origem, quando era **Membro**. **Determina a elegibilidade** (DO-AGE-07): um Item com Delegante de origem só entra no Contexto de Execuções com o **mesmo** delegante; um Item sem delegante entra em qualquer Execução do Agente. Execuções com delegante Automação ou sem delegante (autônomas: permissões só do Agente — RN-AUT-25) produzem Itens **sem** Delegante de origem, porque o fato foi obtido sob as permissões próprias do Agente. |
| Registros referenciados | referência | 0..N | Registros a que o fato se refere (Contato, Lista...). Na eliminação permanente de um registro referenciado, o Item é eliminado (RN-AGE-23). |
| Momentos | nativo | sim | Criação, último uso em Contexto, expiração calculada. |
| Origem do ato | nativo (enumeração) | sim | `Agente` (Passo de memorização decidido pelo Agente) ou `Membro` (Membro com `editar` no Agente registrou o fato manualmente). |

**Política de retenção de Memória** (objeto de valor do Agente, 6.1): prazo máximo de retenção por Item (dentro de tetos da plataforma — B34; C7), número máximo de Itens, e se Itens com Delegante de origem são retidos (`sim`, `não`). Itens expirados são eliminados pelo Sistema com Registro de Atividade agregado.

Regras essenciais (detalhadas na seção 13): a Memória é escrita **apenas** pelas Execuções do próprio Agente ou por Membro com `editar` (RN-AGE-22); nunca por outro Agente, por Automação ou por Habilidade; **nunca é Conhecimento** e nunca vira Documento sem Ferramenta "adicionar ao Conhecimento" com permissão (DO-CNH-13); é **legível** por quem tem `ver` no Agente e **editável e apagável** por quem tem `editar` (RN-AGE-22); a Memória de um Agente `pausado` ou `arquivado` é preservada; a de um Agente eliminado é eliminada. Conteúdo de Memória entra no Contexto como **afirmação do Agente**, não como Conhecimento: a saída que se baseia em Memória não gera Referência de Conhecimento, e o produto pode exigir que o Agente diga "segundo a minha memória". A Memória do Agente **pode** reter fatos sobre registros, inclusive Contatos ("o Contato X prefere e-mail"), com Registros referenciados e elegibilidade por delegante — diferentemente da Memória do Usuário, que nunca retém dados de terceiros (DO-CHT-11); a assimetria é deliberada (B78, B86): a Memória do Agente é governada pelo Proprietário, visível por `ver`, sucedida e eliminada em cascata com o registro (RN-AGE-23), o que a mantém dentro da governança do CRM e de C9; a política de retenção e consentimento é C7.

Justificativa da regra de elegibilidade por delegante (DO-AGE-07): sem ela, o Agente que atende a Ana em nome de Ana (vendo o que Ana vê) memorizaria fatos que, na Execução seguinte em nome de Pedro (que não vê o que Ana vê), vazariam para Pedro. A interseção de A9.3 protege as Ferramentas, não a Memória; a elegibilidade por delegante fecha essa porta com uma regra computável, sem inspecionar conteúdo. Itens de Execuções autônomas nasceram sob as permissões próprias do Agente e podem servir a qualquer delegante, porque o Agente já os veria em qualquer interseção que o inclua.

### 7.6 Solicitação de Aprovação

Conceito transversal (A8) detalhado aqui para Agentes; o documento 19 o aplica a Automações. É **entidade interna da Execução** (e, transitivamente, do Agente), **com identidade própria**, porque é decidida fora da Execução, notificada, sucedida na remoção do aprovador (B28, RN-ET-09c) e contada por Painéis.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | |
| Execução e Passo | referência | sim | De onde partiu. |
| Solicitante | referência (Agente) | sim | O Agente da Execução (com o delegante, se houver, como contexto). |
| Motivo | nativo (enumeração) | sim | `autonomia` — a Ferramenta tem classe de efeito que o nível efetivo exige aprovar (B22); `permissão` — o Sujeito efetivo não tem a permissão requerida e há alternativa (B23; DO-AGE-11); `limite` — o Limite de operações por Execução (escritas, inclusive das filhas) foi atingido e a Execução só prossegue com aprovação, qualquer que seja o nível (DO-AUT-18; DO-CON-13). |
| Objeto | objeto de valor | sim | Ferramenta a invocar, entrada completa (o que exatamente será feito: "enviar esta Mensagem a este Contato nesta Conversa"), Recurso-alvo, classe de efeito. Imutável: aprovar é aprovar **isto**; o Agente não altera a entrada depois de aprovada (RN-AGE-17). |
| Aprovador | referência (Membro) | sim | Resolvido na criação pela Política de aprovação (7.8); sempre Membro `ativo` (RN-ET-08). Redirecionado ao Sucessor na remoção (B28). |
| Decisão | nativo (enumeração) | condicional | `aprovada`, `rejeitada` (com motivo textual opcional), `expirada` (tempo limite), `cancelada` (a Execução foi cancelada antes da decisão). |
| Decisor | referência (Membro) | condicional | Quem decidiu; pode diferir do aprovador designado quando outro Membro elegível decide (7.8). |
| Momentos | nativo | sim | Criação, prazo, decisão. |

Uma Solicitação **não é** Tarefa, Comentário nem Mensagem: é pedido de decisão com objeto fixo. Aprovar **não concede permissão** ao Agente (INV-AGE-08): no motivo `autonomia`, a Ferramenta executa com o Sujeito efetivo original; no motivo `permissão`, o aprovador — que deve ele próprio ter a permissão requerida — torna-se **delegante daquele Passo**, e o Registro de Atividade grava Ator Agente e delegante aprovador (DO-AGE-11). Em ambos os casos, as duas verificações de DO-HAB-14 são **refeitas no momento da aprovação**, porque a permissão pode ter sido revogada durante a espera (B23).

### 7.7 Ferramentas permitidas (objeto de valor da Versão)

Conjunto de identificadores estáveis de Ferramentas do Catálogo do Espaço de Trabalho (DO-HAB-13). Para a tupla A9.1, cada elemento é a permissão (Agente, `executar`, Ferramenta, `registro`, concessão direta), com origem na configuração do Agente. Permitir uma Ferramenta ao Agente **não** lhe dá permissão sobre nenhum registro (DO-HAB-14): "criar Tarefa" permitida sem `criar` em Lista alguma é inútil e válido. Ferramentas de Integração `desconectada` ou `com erro` permanecem permitidas e ficam inoperantes (documento 18, 7.4); Ferramentas descontinuadas são removidas do conjunto pelo Sistema na Versão seguinte, com evento. Quem edita o Agente (`editar`) escolhe as Ferramentas; o produto exibe a classe de efeito de cada uma e o Efeito declarado das Habilidades concedidas (DO-HAB-18) antes de confirmar.

### 7.8 Política de aprovação (objeto de valor da Versão)

Define **quem decide** as Solicitações de Aprovação da Execução e **em quanto tempo**:

- **Aprovadores configurados**: 0..N Membros ou Equipes. A ordem de resolução do aprovador designado é (DO-AGE-11): (1) o **ator delegante** da Execução, se Membro `ativo` — quem pediu decide o que pediu; (2) senão, o **Aprovador declarado na Ação "invocar Agente"** da Automação que a invocou (Membro ou Equipe — documento 19, 7.4), quando a Execução é filha de Execução de Automação; (3) senão, o **aprovador configurado** no Agente (Membro `ativo`, ou o primeiro elegível da Equipe conforme o produto; Solicitação visível a toda a Equipe); (4) senão, o **Proprietário do Agente**, se `ativo`; (5) senão, o Proprietário do Espaço de Trabalho. No motivo `limite` em Execução filha de Automação, o aprovador é o Proprietário da Automação (RN-AUT-13).
- **Elegibilidade para decidir**: além do designado, qualquer Membro `ativo` com `administrar` sobre o Agente pode decidir (o produto os notifica conforme configuração). No motivo `permissão`, só quem tem a permissão requerida sobre o registro-alvo pode aprovar (INV-AGE-08).
- **Tempo limite**: duração após a qual a Solicitação passa a `expirada` e a Execução a `cancelada` com motivo (RN-AGE-18). Padrão da plataforma: **72 horas**, único para toda Solicitação de Aprovação (B80), sobrescrevível pela Política de aprovação do Agente e, para Execuções invocadas por Automação, pelo Tempo limite declarado na Ação (documento 19, 7.4); teto como Limite imposto (B34). Uma Solicitação nunca fica pendente sem prazo.

### 7.9 Custo (objeto de valor da Execução)

Medida do consumo da Execução, gravada em unidades definidas pela plataforma (C8): consumo de Modelo (por Modelo usado), número de chamadas de Ferramenta por classe de efeito, número de Execuções filhas, duração. Não é preço; é a base sobre a qual a plataforma aplica cota (Limites impostos, B34) e a organização aplica o Limite de custo do Agente (6.1). O custo de uma Execução filha (invocação por Agente) é **próprio dela**; o custo agregado da cadeia é derivado. Painéis leem custo por Agente, por Automação (soma das Execuções contidas), por Habilidade (soma dos Exercícios) e por Membro delegante, todos derivados.

### 7.10 O que não é componente

Habilidade e Concessão de Habilidade (associação do Espaço de Trabalho — documento 18), Coleção e a concessão de Conhecimento (vivem na Coleção — documento 20), Ferramenta (Catálogo), Modelo (global), Sessão de Chat e Memória do Usuário (do Membro — documento 16), Automação e Execução de Automação (documento 19), Tarefa e Conversa de que é Responsável ou Atribuído (referências inversas), Template de Agente (catálogo do Espaço de Trabalho), Registro de Atividade (do Espaço de Trabalho), Rascunho de Conversa gerado (objeto de valor da Conversa — DO-CXE-15) e Papel (contido pelo Espaço de Trabalho; o Agente o referencia).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | Agente → ET | Raiz do próprio agregado; escopo do ET (documento 01, 8). Imutável. |
| é de propriedade de | Membro | propriedade | Agente → Membro | Exatamente um (A7, B7). Transferência explícita; sucessão B28. |
| foi criado por | Membro / Sistema | referência | Agente → Ator | Criador imutável. Nunca Agente (INV-AGE-03). |
| tem Papel | Papel | referência | Agente → Papel | Exatamente um (B30); nunca de governança (INV-ET-13). |
| contém Versões | Versão de Agente | contenção (composição) | Agente → Versão | 1..N; imutáveis. |
| contém Execuções | Execução de Agente | contenção (composição) | Agente → Execução | 0..N; ciclo de vida próprio (B18). |
| contém Memória | Memória do Agente → Itens | contenção (composição) | Agente → Memória | 1 Memória, 0..N Itens. |
| Execução contém Solicitações | Solicitação de Aprovação | contenção | Execução → Solicitação | 0..N. |
| usa Modelo | Modelo | referência (uso) | Versão → Modelo | Entidade global (A1.3); 1 ou `padrão da plataforma` (DO-AGE-04). |
| tem permitidas | Ferramenta | permissão (`executar`, concessão direta na configuração) | Versão → Ferramenta | 0..N; DO-HAB-14. |
| tem concedidas | Habilidade | associação (Concessão de Habilidade) | Agente ↔ Habilidade | N:N; a Concessão pertence ao ET (documento 18, 7.2); a Versão registra o conjunto por identidade. |
| tem acesso a | Coleção | permissão (concessão gravada na Coleção) | Coleção → Agente | DO-CNH-12; visão derivada "Conhecimento acessível". |
| recebe concessões e compartilhamentos sobre | qualquer Recurso | permissão | Recurso → Agente | Como Sujeito (A9.1); vivem no Recurso. |
| é Responsável por | Tarefa | associação (referência inversa) | Tarefa → Agente | 0..N; B7; exige `ver` na Tarefa (RN-TAR-06). O Agente não contém Tarefas. |
| é Atribuído a | Conversa | associação (referência inversa) | Conversa → Agente | 0..N; B7; RN-CXE-12. |
| é principal de | Sessão de Chat | referência inversa | Sessão → Agente | 0..N; B21. O Agente não conhece Sessões; a Execução referencia a Sessão de origem. |
| é invocado por | Automação (Ação "invocar Agente") | referência inversa | Automação → Agente | 0..N; a Ação falha se o Agente não está `ativo` (RN-AGE-10). |
| invoca / é invocado por | Agente | associação transitória (Execução filha) | Execução → Execução | Ferramenta "invocar Agente" (DO-AGE-08); não é relação gravada no Agente, é relação entre Execuções. |
| Execução é filha de | Execução de Automação | referência | Execução de Agente → Execução de Automação | B18. |
| Execução referencia | registro âncora, Arquivos, Fragmentos, Itens de Memória | referência (Composição do Contexto) | Execução → registro | Só referências (DO-AGE-09). |
| Execução cita | Documento / Versão / Fragmento | Referência de Conhecimento (objeto de valor) | Execução → Documento | DO-CNH-15. |
| Execução produz | Rascunho de Conversa | referência inversa | Conversa → Execução | DO-CXE-15: o Rascunho referencia a Execução de origem. |
| foi instanciado de | Template de Agente | Proveniência (objeto de valor) | Agente → Template | Sem vínculo vivo (A8; DO-AGE-12). |
| é origem de | Template de Agente | referência inversa (Proveniência do Template) | Template → Agente | "criado a partir do Agente X"; sem vínculo vivo. |
| é registrado em | Registro de Atividade | referência inversa | Registro → Agente / Execução | Como Ator (com delegante) e como objeto (A6.2). |
| é Fonte de Dados de | Painel | referência inversa | Widget → Agente | "Execuções de um Agente" (Glossário); filtradas pelo visualizador (B20). |
| é referenciado por | Espaço de Trabalho (Assistente padrão) | referência inversa | ET → Agente | Exatamente um Agente do ET (INV-ET-09). |

Distinção aplicada: **CONTER** (Versões, Execuções, Memória, Solicitações — o agregado); **pertencer** (Espaço de Trabalho); **ser de propriedade de** (Membro); **USAR** (Modelo, Ferramentas, Contexto); **RELACIONAR-SE** (Concessão de Habilidade, Responsável, Atribuído, invocação entre Execuções); **REFERENCIAR** (Papel, Template por Proveniência, Criador, registro âncora); **SER REFERENCIADO** (Sessão, Automação, Conversa, Tarefa, Painel, Espaço de Trabalho). O Agente **não HERDA** configuração de nada (não está na Estrutura de Trabalho) e **não CONFIGURA** nada fora do seu agregado: conceder Habilidade é configurar o Agente; a Habilidade não passa a ser dele (documento 18, 10).

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Agente | 1..N | não | sim | pertencimento | O Assistente padrão sempre existe (INV-ET-09; B33). |
| Agente → ET | 1 | não | não | pertencimento | A1.1. |
| Agente → Proprietário | 1 | não | não | propriedade | A7; B7. Zero deixaria IA sem responsável humano; vários diluiriam. |
| Membro → Agentes de que é Proprietário | 0..N | sim | sim | propriedade inversa | |
| Agente → Papel | 1 | não | não | referência | B30 (um Papel por Sujeito); Convidado por padrão (DO-AGE-05). |
| Agente → Versão | 1..N | não | sim | composição | Versão 1 na criação (INV-AGE-01). |
| Agente → Execução | 0..N | sim | sim | composição | Agente criado e nunca invocado é válido. |
| Execução → Agente | 1 | não | não | composição | Nunca migra. |
| Execução → Versão de Agente | 1 | não | não | referência | Fixa (RN-AGE-09). |
| Execução → Modelo usado | 1 | não | não | referência | Resolvido no início; imutável. |
| Execução → Ator invocador | 1 | não | não | referência | B18. |
| Execução → Ator delegante | 0..1 | sim | não | referência | Membro (Sessão, ação direta, herdado) ou Automação (Ação "invocar Agente"); vazio = Origem `Caixa de Entrada`. Interseção de permissões só com Membro (A9.3). |
| Execução → Execução pai | 0..1 | sim | não | referência | Execução de Automação ou Execução de Agente invocadora; é a Execução-mãe na Cadeia de Execuções (B79). |
| Execução → Execuções filhas | 0..N | sim | sim | referência inversa | Limitadas pela profundidade da Cadeia e sem Agente repetido (DO-AGE-08). Recomendação de Limite imposto: máximo de filhas diretas por Execução (25.3). |
| Execução → Passo | 0..N | sim | sim | objeto de valor | Execução que falha antes do primeiro Passo tem zero. |
| Execução → Solicitação de Aprovação | 0..N | sim | sim | contenção | Uma por Passo que a exija; várias por Execução. |
| Solicitação → aprovador designado | 1 | não | não | referência | Sempre resolúvel (cadeia até o Proprietário do ET — 7.8). |
| Solicitação → Decisão | 0..1 | sim (pendente) | não | objeto de valor | |
| Agente → Modelo (configuração) | 1 (ou `padrão da plataforma`) | não | não | referência | Um Modelo principal por Versão (DO-AGE-04). Modelos secundários (por Ferramenta, por modalidade) são questão 25.2. |
| Agente → Ferramenta permitida | 0..N | sim | sim | permissão | Agente conversacional puro é válido. |
| Agente → Habilidade (Concessão) | 0..N | sim | sim | associativa | B15. |
| Agente → Coleção acessível | 0..N | sim | sim | permissão (derivada) | DO-CNH-12; o Assistente padrão nasce sem nenhuma (documento 20, 17.5). |
| Agente → Memória | 1 | não | não | composição | Criada com o Agente, vazia; `Memória habilitada` = falso a mantém vazia. |
| Memória → Item | 0..N | sim | sim | composição | Limitado pela Política de retenção. |
| Agente → Tarefa (Responsável) | 0..N | sim | sim | associativa inversa | B7. |
| Agente → Conversa (Atribuído) | 0..N | sim | sim | associativa inversa | B7; sem limite ontológico (Limite de Conversas por Atendente da Fila aplica-se a Membros; questão 25.5). |
| Agente → Sessão de Chat (principal) | 0..N | sim | sim | referência inversa | B21. |
| Automação → Agente invocado (por Ação) | 0..1 por Ação | sim (invoca o Assistente padrão — B17) | não | referência | Documento 19. |
| Template de Agente → Agente instanciado | 0..N | sim | sim | Proveniência inversa | Sem vínculo vivo. |
| ET → Assistente padrão | 1 | não | não | referência | B33. |
| Agente → Limite de custo | 0..1 | sim | não | objeto de valor | Cota do ET é o teto (C8). |

Profundidade da Cadeia de Execuções: decidida em B79 (DO-AGE-08) — profundidade total como Limite imposto (recomendação: 5) e sub-limite para subsequências de invocação Agente → Agente (recomendação: 3, mesmo valor de RN-HAB-08), reduzível por Agente. Os valores permanecem em C8.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Nenhuma. O Agente está no domínio IA, par da Estrutura de Trabalho (A2.2): não pertence a Espaço, Pasta, Lista, Funil ou Caixa de Entrada e não tem contêiner intermediário. A **Cadeia de Execuções** (DO-AGE-08; B79) é uma hierarquia **transitória de episódios**, não de Agentes: o Agente A que invoca B não contém B, não o governa e não lhe transmite permissões; terminada a Execução, nada resta além das referências entre Execuções.

**Pertencimento (teste de existência).** O Agente não existe sem o Espaço de Trabalho (eliminado este, elimina-se aquele — B32). Versões, Execuções, Memória, Itens e Solicitações não existem sem o Agente. Concessões de Habilidade não existem sem ambos os lados (INV-HAB-08). Tarefas, Conversas, Sessões, Automações e Coleções existem sem o Agente (são associações ou referências inversas): eliminar o Agente **libera** responsabilidades e **invalida** referências, nunca elimina os registros (12.5).

**"Pertence a" versus "relaciona-se com".** O Agente *pertence* ao Espaço de Trabalho e *é de propriedade de* um Membro; *relaciona-se com* Habilidades (Concessão), Coleções (concessão de permissão), Tarefas (Responsável), Conversas (Atribuído), Sessões (principal), Automações (invocado) e outros Agentes (invocação). Nenhuma dessas relações implica propriedade, contenção ou herança.

**Propriedade.** Exatamente um Proprietário Membro, sempre humano (A7, B7). Três consequências: (a) o Proprietário responde pela governança — tem `administrar` sobre o Agente por propriedade (17.1) e é o aprovador de última instância dentro do Agente (7.8); (b) a **transferência** é ato explícito do Proprietário atual ou de um Administrador, para Membro `ativo` sem base Convidado (RN-AGE-04), com Registro de Atividade; (c) a **sucessão** na remoção do Proprietário é B28: o Agente passa ao Sucessor no mesmo ato, Solicitações de Aprovação de que o removido era aprovador passam ao Sucessor, Execuções autônomas continuam, Execuções em nome do removido falham na próxima Ferramenta (documento 01, 20.6). **O Agente nunca é Proprietário** de registro algum — nem de Tarefas que cria (o Criador é o Agente; o Proprietário, quando o conceito se aplica, é resolvido pela regra do documento da entidade, nunca o Agente), nem de outros Agentes (INV-AGE-03), nem de Coleções, Painéis ou Automações. A cadeia de propriedade termina sempre em um humano (documento 01, 10).

**Configurar não é conter.** O Membro que edita o Agente não passa a ser seu Proprietário; a Automação que o invoca não o contém; o Agente que permite uma Ferramenta não a possui; a Coleção que concede `ver` ao Agente não é dele.

## 11. Estados

### 11.1 Estados do Agente

Estados de ciclo de vida de sistema, não personalizáveis; o Agente não tem Status (A4.2). O conjunto **amplia A4.1** com dois estados próprios, `rascunho` e `pausado`, registrados como **exceção** (DO-AGE-10).

| Estado | Significado | O que é possível | O que não é possível |
| --- | --- | --- | --- |
| `rascunho` | Em configuração; ainda não operacional. Estado de nascimento (exceto Assistente padrão). | Ver, editar (cria Versões), conceder Habilidades, permitir Ferramentas, receber concessões, testar em **ensaio** (12.2), ativar. | Ser invocado por Automação, Sessão, ação direta ou outro Agente; ser Responsável ou Atribuído; produzir Execuções que não sejam de ensaio. |
| `ativo` | Operacional. | Tudo: invocação, Execuções, Memória, responsabilidades. | — |
| `pausado` | Operacional suspenso de forma reversível: **não aceita novas Execuções**; Execuções em curso terminam (RN-AGE-19). | Ver, editar, ativar novamente. Responsabilidades preservadas (o Agente continua Responsável/Atribuído, sem agir; RN-AGE-20). | Iniciar Execução (invocação rejeitada com Registro; Ação de Automação falha; a Sessão com ele como principal passa a "Agente principal indisponível" e bloqueia novas Mensagens até escolha explícita do Proprietário — nunca substituição silenciosa, DO-CHT-12). Novas atribuições como Responsável ou Atribuído são inválidas (mesmo padrão de RN-ET-08). |
| `arquivado` | Retirado de uso, preservado com Memória, Versões e Execuções. | Ver, desarquivar (`administrar`) — devolve a `pausado`, nunca diretamente a `ativo` (B94). | Editar, invocar, ser Responsável/Atribuído: **liberado** de todas as Tarefas e Conversas no ato (RN-AGE-20); Sessões que o têm como principal passam a "Agente principal indisponível" e bloqueiam novas Mensagens até escolha explícita do Proprietário — nunca substituição silenciosa (DO-CHT-12); Automações que o invocam falham na disparada com Registro. |
| `na lixeira` | Excluído de forma recuperável pelo prazo da Política de lixeira. | Ver (por quem tem `excluir`), restaurar — devolve a `pausado` quando o Estado próprio anterior era `ativo` ou `pausado`; `rascunho` e `arquivado` são devolvidos como estavam (B43; B94). | Como `arquivado`, e oculto em toda parte. |

Eliminação permanente não é estado (12.5).

**Por que `rascunho` e `pausado` são necessários** (DO-AGE-10): `rascunho` existe porque um Agente sem objetivo, sem instruções ou sem Ferramentas ainda não deve ser invocável, e "ativo com configuração incompleta" produziria Execuções vazias em Automações já conectadas a ele; `pausado` existe porque a organização precisa interromper um Agente **sem** perder as suas responsabilidades (30 Tarefas, 12 Conversas) e sem arquivá-lo — arquivar libera responsabilidades (o que `pausado` não faz) e é a resposta a "não vamos mais usar", enquanto `pausado` responde a "vamos corrigir e voltar". Nenhum dos dois é Status personalizável: são condições de sistema com semântica fixa, avaliadas por Automações, Sessões e a Caixa de Entrada.

### 11.2 Estados da Execução de Agente

| Estado | Significado | Transições |
| --- | --- | --- |
| `pendente` | Criada; aguardando início (fila, cota, Modelo). | → `executando`; → `cancelada` (Agente pausado antes do início, suspensão do ET, cancelamento, cota, Execução de Automação mãe cancelada — INV-AUT-09); → `falhou` (Disponibilidade `indisponível` verificada no início — RN-AGE-08). |
| `executando` | Em curso: Passos sendo produzidos. | → `aguardando aprovação`; → `concluída`; → `falhou`; → `cancelada` (ato, suspensão, cota, transferência da Conversa, mãe cancelada). |
| `aguardando aprovação` | Bloqueada em uma Solicitação de Aprovação pendente (7.6). Nenhum Passo com efeito é produzido; o Modelo não é consumido. | → `executando` (aprovada, ou rejeitada com alternativa que o Agente decida seguir); → `falhou` (rejeitada sem alternativa); → `cancelada` (expirada — RN-AGE-18; cancelamento; suspensão; mãe cancelada). |
| `concluída` | Terminou com saída. Terminal. | — |
| `falhou` | Terminou por erro ou negação, com motivo (7.2). Terminal. | — |
| `cancelada` | Interrompida antes de concluir, por ato ou por regra, com motivo. Terminal. | — |

Estados terminais são imutáveis. Uma Execução terminal nunca é reaberta: "tentar de novo" é **nova Execução** com Proveniência opcional para a anterior (mesmo princípio de RN-CXE-18 e DO-HAB-11).

### 11.3 Estados da Solicitação de Aprovação

`pendente` (sem Decisão) e, com Decisão, `aprovada`, `rejeitada`, `expirada`, `cancelada` (7.6). Terminais e imutáveis.

### 11.4 Disponibilidade do Agente

Derivada (6.3). Não é estado gravado e não substitui os estados de 11.1: um Agente `ativo` pode estar `indisponível` (Modelo descontinuado; cota) e volta a `disponível` sem ato sobre o estado quando a causa cessa (DO-AGE-04). Um Agente `pausado` é sempre `indisponível` (motivo: pausado).

## 12. Ciclo de vida

### 12.1 Criação

- **Por Membro** com `criar` sobre Agentes (17.2): nasce `rascunho`, versão 1 com a configuração informada (objetivo e instruções podem estar vazios em `rascunho`), Papel Convidado (DO-AGE-05), nível `assistido`, Memória habilitada e vazia, Ferramentas permitidas vazias, sem Concessões, Proprietário = Criador (o produto pode permitir indicar outro Membro `ativo`), Criador = Membro. Nome obrigatório e único (RN-AGE-02). Limite de Agentes do Espaço de Trabalho verificado no ato (RN-ET-23).
- **Por instanciação de Template de Agente** (do Espaço de Trabalho ou da plataforma — DO-AGE-12): mesma permissão; nasce `rascunho` com a configuração do Template e Proveniência; Concessões de Habilidade criadas para as Habilidades que o Template referencia por identidade, quando existem, estão `ativo` e o Membro instanciador tem `executar` sobre elas — as demais são omitidas com Registro, sem falhar (documento 18, 20.15). Memória sempre vazia (Templates não têm Memória).
- **Pela plataforma, na criação do Espaço de Trabalho**: o Assistente padrão, único Agente que nasce `ativo`, com Criador `Sistema`, Proprietário = Proprietário do Espaço de Trabalho, Modelo `padrão da plataforma`, Admite sobrescrita de Modelo verdadeiro (recomendação), nível de autonomia `supervisionado` (recomendação; 25.6), Papel Convidado, Ferramentas permitidas conforme o Template da plataforma (12.6).
- **Um Agente nunca cria Agente** (INV-AGE-03): não existe Ferramenta "criar Agente". Se um Agente "propõe" um Agente, o resultado é texto que um Membro pode usar.

### 12.2 Configuração e Versões

- **Editar** (`editar`): qualquer alteração de 6.2 cria a Versão seguinte, com Ator e Motivo, e vale a partir da próxima Execução (RN-AGE-09). Alterações de 6.1 (nome, descrição, Política de retenção, Limite de custo) não criam Versão; geram Registro de Atividade.
- **Conceder / revogar Habilidade** (`executar` na Habilidade + `editar` no Agente — RN-HAB-12) e **permitir / retirar Ferramenta** (`editar`): criam Versão.
- **Atribuir Papel**: ação de governança por Papel de nível Administrador (RN-ET-24; B30), com as restrições de INV-ET-13; não cria Versão; gera Registro de Atividade e evento "Papel atribuído / alterado" (documento 01, 18).
- **Conceder permissões sobre registros ao Agente** (`ver` em uma Lista, `ver` em uma Coleção): ato de quem tem `administrar` sobre o Recurso, gravado no Recurso (A9.1; DO-CNH-12); não cria Versão.
- **Ensaio** (`editar`): Execução de Agente com marcação `ensaio`, permitida em `rascunho` e `ativo`, em que a Composição do Contexto e as chamadas de Ferramenta de classe `leitura` ocorrem normalmente e toda Ferramenta de escrita (`reversível`, `irreversível`, `externa`) é **simulada** — registrada como Passo com resultado `simulado`, sem efeito e sem Registro de Atividade no registro-alvo (DO-AGE-13; atende à questão 25.5 do documento 18). Consome custo. Nunca grava Memória.
- **Ativar** (`administrar`): `rascunho` → `ativo`, exigindo objetivo e instruções não vazios e Modelo resolúvel (RN-AGE-07). **Pausar / reativar** (`administrar`): `ativo` ↔ `pausado`.
- **Transferir propriedade** (`administrar`; Proprietário atual ou Administrador): para Membro `ativo` sem base Convidado (RN-AGE-04). Para o Assistente padrão, impossível: acompanha a transferência do Espaço de Trabalho (B33).
- **Restaurar padrão** (só para Agentes com Proveniência de Template da plataforma; `administrar`): cria Versão com a configuração da versão corrente do Template, Ator = Membro; Memória e Execuções preservadas (12.6).

### 12.3 Execução

1. **Criação** (`pendente`): por invocação (7.2, Origem). Verificações no ato: Agente `ativo` (RN-AGE-10); invocador com `executar` sobre o Agente (17.1); Disponibilidade (RN-AGE-08); Limite de custo e cota (RN-AGE-27); Cadeia de Execuções sem Agente repetido e dentro da profundidade (DO-AGE-08; B79); Espaço de Trabalho `ativo` (B31). Falha em qualquer verificação: `falhou` (ou `cancelada` para cota/suspensão) com motivo, sem consumo de Modelo.
2. **Início** (`executando`): resolve Versão (corrente), Modelo (concreto), nível de autonomia efetivo, delegante e cadeia; monta o Contexto (7.4).
3. **Passos**: a cada chamada de Ferramenta, as duas verificações de DO-HAB-14 sobre o Sujeito efetivo (interseção com o delegante — A9.3), a classe de efeito contra o nível efetivo (B22; seção 13) e, se necessário, Solicitação de Aprovação (`aguardando aprovação`). Cada Ferramenta com efeito gera o Registro de Atividade que a própria Ferramenta gera, com Ator Agente e delegante (A6.2).
4. **Término**: `concluída` com saídas e Referências de Conhecimento; `falhou` com motivo (B23); `cancelada` por ato de Membro com `administrar` no Agente ou delegante da Execução (RN-AGE-21), por expiração de aprovação (RN-AGE-18), por suspensão do Espaço de Trabalho (B31), por transferência da Conversa (documento 14, 12.4), por cancelamento da Execução de Automação mãe (INV-AUT-09) ou por cota. Memorização (7.5) ocorre durante ou ao fim, se habilitada. Eventos "Execução concluída / falhou / cancelada" (seção 18).

Execuções são **preservadas** enquanto o Agente existir, sujeitas a uma Política de retenção de Execuções definida pela plataforma (C9; 25.4): quando eliminadas, Registros de Atividade permanecem (INV-ET-12) e Solicitações decididas, Rascunhos e Referências mantêm os valores à época.

### 12.4 Transições do Agente

- **Arquivar** (`administrar`): libera Responsável e Atribuído em todas as Tarefas e Conversas (RN-AGE-20; Conversas redistribuídas pela Fila — RN-CXE-24 por analogia; Tarefas ficam com os demais Responsáveis ou zero — documento 06, 20.2); Sessões com ele como principal passam a "Agente principal indisponível" (DO-CHT-12); Automações que o invocam passam a falhar com Registro; Execuções em curso **terminam** (RN-AGE-19); Concessões de Habilidade preservadas (Disponibilidade `indisponível`); Memória preservada. Assistente padrão: impossível (INV-AGE-11).
- **Desarquivar** (`administrar`): volta a **`pausado`**, nunca diretamente a `ativo` (B94: nada volta a agir sem ato explícito de reativação após revisão de responsabilidades, Automações e Sessões); responsabilidades **não** retornam (foram liberadas); Automações voltam a funcionar só depois de reativado.
- **Enviar à lixeira / restaurar** (`excluir`): como arquivar, e oculto; grava o Estado próprio anterior à exclusão (B43); a restauração devolve `pausado` quando o estado anterior era `ativo` ou `pausado`, e devolve `rascunho` ou `arquivado` como estavam — exceção deliberada a B43 por segurança (B94); restauração com colisão de nome é rejeitada até renomear (RN-AGE-02). Assistente padrão: impossível.
- **Renomear, descrever, alterar Política de retenção e Limite de custo**: atos sem Versão, com Registro de Atividade.

### 12.5 Eliminação permanente e cascata

Por prazo da Política de lixeira ou eliminação antecipada (`administrar`). Elimina o Agente, **todas** as Versões, a Memória e os Itens, as Execuções (com Passos e Solicitações), e **remove todas as Concessões de Habilidade** (INV-HAB-08) e todas as concessões de permissão em que o Agente é Sujeito (Coleções, Listas, Tarefas compartilhadas). Efeitos fora do agregado: Tarefas e Conversas já foram liberadas no arquivamento ou na exclusão; Automações que o invocam passam a referência inválida (Ação falha com Registro — B41 por analogia); Templates do Espaço de Trabalho criados a partir dele mantêm a Proveniência como valor; Rascunhos de Conversa que referenciam Execuções eliminadas mantêm identificador como valor; Referências de Conhecimento e Registros de Atividade **permanecem** (INV-ET-12), exibindo "Agente eliminado" com o nome à época. Nenhuma Tarefa, Conversa, Sessão, Habilidade, Coleção, Documento ou Automação é eliminada em cascata. Execuções de Automação que continham Execuções deste Agente permanecem, com a referência à Execução filha como valor. Eliminação do Espaço de Trabalho elimina todos os Agentes, inclusive o Assistente padrão (B32).

### 12.6 O Assistente padrão

Agente instanciado pela plataforma a partir do Template de Agente da plataforma "Assistente padrão", na criação do Espaço de Trabalho, no mesmo ato atômico (documento 01, 12.1). Diferenças em relação a qualquer outro Agente, todas decorrentes de B33 e B17:

- Nasce `ativo`; nunca é `rascunho`, `pausado`, `arquivado` nem `na lixeira`; nunca é eliminado exceto com o Espaço de Trabalho (INV-AGE-11). Justificativa de não admitir `pausado`: toda invocação sem Agente indicado (Automação sem Agente — B17; Sessão sem principal — B21) recai sobre ele; pausá-lo tornaria essas invocações inválidas sem alternativa. Quem quer "desligar a IA" reduz as suas Ferramentas permitidas, o seu nível de autonomia ou as suas permissões, ou pausa as Automações.
- Proprietário = Proprietário do Espaço de Trabalho, sempre; acompanha a transferência (B26, B33); não é transferível por si.
- É **configurável** por Proprietário do Espaço de Trabalho e Administradores (documento 01, 17.2 — ação de Papel) nos mesmos termos de qualquer Agente: objetivo, instruções, Modelo, Ferramentas permitidas, Habilidades concedidas, nível de autonomia, Política de aprovação, Memória; cada alteração cria Versão (20.14). "Restaurar padrão" devolve a configuração do Template da plataforma como nova Versão.
- Não recebe nada por ser padrão: sem concessões, não vê Coleções (documento 20, 17.5), não vê contêineres privados, não envia Mensagens.
- A plataforma pode publicar nova versão do Template "Assistente padrão"; isso **não** altera Assistentes instanciados (Proveniência, sem vínculo vivo — DO-AGE-12); o produto notifica Administradores e oferece "restaurar padrão".

## 13. Regras de negócio ontológicas

- **RN-AGE-01.** Todo Agente pertence a exatamente um Espaço de Trabalho, imutavelmente (A1.1); nunca é global (A1.3). O Assistente padrão é instanciado por Espaço de Trabalho (B33).
- **RN-AGE-02.** O nome é único entre Agentes `rascunho`, `ativo`, `pausado` e `arquivado` do mesmo Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades; `na lixeira` não reserva; criar, renomear, instanciar e restaurar com colisão são rejeitados até renomear.
- **RN-AGE-03.** Todo Agente tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (A7, B7, INV-ET-03), e exatamente um Criador (Membro ou Sistema), imutável. Um Agente nunca é Proprietário de registro algum e nunca é Criador de Agente (INV-AGE-03).
- **RN-AGE-04.** A transferência de propriedade é ato explícito do Proprietário atual ou de Membro com Papel de nível Administrador, para Membro `ativo` sem base Convidado, com Registro de Atividade; o Assistente padrão não é transferível por si (B33). Na remoção do Proprietário aplica-se B28.
- **RN-AGE-05.** Todo Agente tem exatamente um Papel (B30), nunca Proprietário do Espaço de Trabalho, Administrador ou Papel personalizado com base neles (INV-ET-13); o padrão na criação é Convidado (DO-AGE-05). Atribuir Papel a Agente é ação de governança por Papel (RN-ET-24). Toda permissão adicional é concessão direta ou compartilhamento gravados no Recurso.
- **RN-AGE-06.** Toda alteração de atributo da configuração (6.2 — inclusive Admite sobrescrita de Modelo) cria uma Versão de Agente imutável com Ator Membro (ou Sistema); a Versão vale a partir da próxima Execução. Nome, descrição, Proprietário, Papel, Política de retenção de Memória e Limite de custo não são versionados (B24; DO-AGE-02).
- **RN-AGE-07.** Ativar exige objetivo e instruções não vazios e Modelo resolúvel (existente e não descontinuado, ou `padrão da plataforma`). Falha rejeita a ativação sem efeito.
- **RN-AGE-08.** A Disponibilidade (6.3) é verificada no início de toda Execução; `indisponível` faz a Execução passar a `falhou` (ou `cancelada` para cota e suspensão) antes de qualquer consumo de Modelo, com motivo.
- **RN-AGE-09.** Uma Execução resolve a Versão de Agente, o Modelo concreto, o nível de autonomia efetivo, o delegante e a Cadeia de Execuções **no início** e os mantém até o fim, ainda que o Agente seja editado, o Modelo trocado ou o Agente pausado durante a Execução. Permissões, ao contrário, são avaliadas a cada Ferramenta (B23).
- **RN-AGE-10.** Só um Agente `ativo` aceita novas Execuções. Invocar um Agente `rascunho`, `pausado`, `arquivado` ou `na lixeira` é rejeitado com Registro de Atividade; a Ação de Automação falha; a Sessão de Chat informa o Membro. Ensaios (DO-AGE-13) são a única Execução admitida em `rascunho`.
- **RN-AGE-11.** Toda Execução referencia o Ator invocador e, quando houver, o ator delegante — Membro ou Automação (B18, A6.2). Execuções originadas em Sessão de Chat ou ação direta têm delegante = o Membro; originadas em Automação (Ação "invocar Agente", Condição híbrida, inclusive por agendamento) têm delegante = a Automação (DO-AUT-15) e usam só as permissões do Agente (A9.3; RN-AUT-25); originadas na Caixa de Entrada não têm delegante e usam só as permissões do Agente (RN-CXE-23); originadas em outro Agente herdam o delegante da Execução invocadora (DO-AGE-08). A permissão efetiva é interseção apenas com delegante Membro; a cadeia de delegantes (por exemplo, Membro que acionou a Automação que invocou o Agente) é derivável da Cadeia de Execuções (B79).
- **RN-AGE-12.** O nível de autonomia efetivo de uma Execução é o **menor** entre o nível do Agente e o imposto pelo invocador (Automação — B22; Execução de Agente invocadora — DO-AGE-08), na ordem `assistido` < `supervisionado` < `autônomo`. Nenhum invocador amplia a autonomia. A classificação de cada chamada de Ferramenta segue a classe de efeito (DO-HAB-13): `assistido` gera Solicitação de Aprovação para toda Ferramenta que não seja `leitura`; `supervisionado`, para `escrita irreversível` e `externa`; `autônomo`, para nenhuma. A decisão é **por Ferramenta invocada**, nunca pelo Efeito declarado agregado de uma Habilidade (DO-HAB-18). Os documentos de entidade classificam as suas Ferramentas: exigem aprovação em `supervisionado`, por serem `escrita irreversível` ou `externa`, enviar Mensagem a Contato, mesclar Contatos ou Empresas, marcar Negócio `ganho` ou `perdido`, enviar Contato, Empresa ou Negócio à lixeira, trocar a Empresa de Negócio encerrado, marcar exclusão de Mensagem e mover Conversa entre Contatos (B64); eliminar permanentemente e obsoletar são `escrita irreversível` em qualquer domínio. **Criação em lote acima do Limite de operações por Execução exige aprovação em qualquer nível**, inclusive `autônomo` (motivo `limite` — DO-CON-13; DO-AUT-18); mesclagem por Agente é candidata a aprovação também em `autônomo` (recomendação de produto, B64).
- **RN-AGE-13.** Ferramenta "invocar Agente" (DO-AGE-08; B79): exige que o **invocador** a tenha permitida e tenha `executar` sobre o Agente invocado — o Agente invocador, ou o Membro (menção em Sessão — RN-CHT-15), ou a Automação (Ação "invocar Agente", validada na publicação e a cada Ação — RN-AUT-07) — e, quando há **delegante Membro**, que também ele tenha `executar` sobre o invocado (interseção, A9.3; DO-CHT-17); com delegante Automação, a permissão é só a da cadeia de Agentes (RN-AUT-25). O invocado deve estar `ativo`; não pode constar da Cadeia de Execuções da Execução invocadora (sem Agente repetido, direto ou indireto; auto-invocação proibida); a profundidade resultante não pode exceder o Limite imposto da Cadeia, nem a subsequência contígua de invocações Agente → Agente exceder o menor entre a Profundidade máxima de invocação de cada Agente dessa subsequência e o sub-limite imposto. A Execução filha herda delegante e Cadeia, tem nível efetivo ≤ o da invocadora, permissão efetiva = interseção da sua com a de todos os Agentes da Cadeia e com a do delegante Membro, e custo próprio. Violação: a chamada falha antes de criar Execução e a Execução invocadora segue B23. A classe de efeito de "invocar Agente" é `escrita reversível`.
- **RN-AGE-14.** Um Agente Atribuído a uma Conversa (B7; RN-CXE-12) é invocado pela Caixa de Entrada (Origem `Caixa de Entrada`, sem delegante) a cada Mensagem `recebida` da Conversa enquanto for Atribuído e `ativo`; responde ao Contato só com nível efetivo `autônomo`; em `supervisionado` e `assistido`, cada "enviar Mensagem" (classe `externa`) gera Solicitação de Aprovação e o texto fica como Rascunho da Conversa (DO-CXE-15); a transferência da Conversa cancela a Execução em curso (documento 14, 12.4). Um Agente Responsável por uma Tarefa (B7) **não** é invocado pela Tarefa: trabalha quando uma Automação ou um Membro o invoca com a Tarefa como registro âncora (RN-TAR-27).
- **RN-AGE-15.** O Agente só invoca Ferramentas permitidas na sua Versão (7.7) e, a cada invocação, sob a permissão requerida sobre o registro concreto com o Sujeito efetivo (DO-HAB-14; A9.3; B23). Permitir Ferramenta não concede permissão sobre registro; conceder permissão sobre registro não permite Ferramenta. Negação: o Passo registra "negada", e a Execução passa a `falhou` ou, havendo alternativa (Solicitação de Aprovação com motivo `permissão`; Ferramenta opcional de Habilidade; outra Ferramenta), continua (B23; RN-HAB-13).
- **RN-AGE-16.** O Contexto é montado só com o que o Sujeito efetivo pode ver (A9.3, INV-CNH-09) e gravado por referência (DO-AGE-09). Um Agente nunca revela, em saída ou Memória, a existência ou o conteúdo de registro que o Sujeito efetivo não veja.
- **RN-AGE-17.** Toda Solicitação de Aprovação tem objeto fixo (Ferramenta + entrada completa); aprovar executa exatamente o objeto, com as duas verificações de DO-HAB-14 refeitas no momento da aprovação; se falharem, a Solicitação é `aprovada` e o Passo "negada", e a Execução segue B23. Rejeitar devolve a decisão ao Agente (que pode seguir alternativa) ou encerra em `falhou` quando não há alternativa. Aprovar nunca concede permissão ao Agente (INV-AGE-08); no motivo `permissão`, o aprovador deve ter a permissão requerida e torna-se delegante do Passo (DO-AGE-11).
- **RN-AGE-18.** Toda Solicitação tem tempo limite (Política de aprovação; teto da plataforma); expirada, passa a `expirada` e a Execução a `cancelada` com motivo, com evento ao aprovador e ao Proprietário do Agente. O aprovador designado é resolvido na criação pela ordem de 7.8 e sempre é Membro `ativo`; suspensão ou remoção do aprovador durante a pendência redireciona ao próximo da ordem (suspensão) ou ao Sucessor (remoção — B28).
- **RN-AGE-19.** Pausar, arquivar ou excluir um Agente **não cancela** Execuções em curso: terminam na Versão carregada (RN-AGE-09; DO-HAB-17 por analogia). Cancelar é ato sobre a Execução (RN-AGE-21). Exceções que cancelam: suspensão do Espaço de Trabalho (B31), transferência da Conversa (documento 14), expiração de aprovação, cota e cancelamento em cascata pela Execução de Automação mãe (INV-AUT-09; DO-AUT-07).
- **RN-AGE-20.** Só Agente `ativo` pode ser designado Responsável ou Atribuído (B7; RN-TAR-06 exige `ver`). `pausado` preserva as responsabilidades sem agir; `arquivado` e `na lixeira` **liberam** todas no ato, com evento por registro e redistribuição de Conversas pela Fila; a restauração não as devolve.
- **RN-AGE-21.** Cancelar uma Execução é ato de Membro com `administrar` sobre o Agente, do delegante da Execução, ou do Sistema por regra (RN-AGE-19); a Execução passa a `cancelada` com motivo; Passos já produzidos e os seus Registros de Atividade permanecem; o efeito de Ferramentas já executadas **não é revertido** pelo cancelamento (o que saiu, saiu — RN-CXE-23); texto parcial exposto vira Rascunho quando a Execução tem Conversa como âncora (documento 14, 20.7).
- **RN-AGE-22.** A Memória do Agente é escrita apenas por Execuções do próprio Agente (Passo de memorização, com Memória habilitada e fora de ensaio) e por Membro com `editar` no Agente; nunca por outro Agente, Automação, Habilidade ou Integração. É legível por quem tem `ver`, e cada Item é apagável por quem tem `editar`, com Registro de Atividade. Um Item com Delegante de origem só entra no Contexto de Execuções com o mesmo delegante (DO-AGE-07).
- **RN-AGE-23.** A Memória nunca é Conhecimento: nenhum Item vira Documento sem Ferramenta "adicionar ao Conhecimento" com permissão e Proveniência (DO-CNH-13); saída baseada em Memória não gera Referência de Conhecimento. Itens são eliminados pela Política de retenção, pela eliminação permanente de registro que referenciam, ou por Membro; nunca migram entre Agentes.
- **RN-AGE-24.** Nada da Sessão de Chat (Mensagens de Chat, Arquivos, Memória do Usuário) passa ao Agente sem Ferramenta explícita: a Memória do Usuário é do Membro e entra no Contexto de Execuções originadas nas suas Sessões (documento 16), nunca na Memória do Agente.
- **RN-AGE-25.** Um Agente nunca cria, edita, ativa, pausa, arquiva, exclui, elimina, transfere ou reconfigura Agente algum — inclusive a si próprio — nem altera o próprio Papel, Ferramentas permitidas, Concessões, nível de autonomia, Política de aprovação ou Política de retenção: não existem Ferramentas para isso (INV-AGE-04; INV-HAB-04). Toda governança de Agentes tem Ator Membro ou Sistema.
- **RN-AGE-26.** Em Espaço de Trabalho `suspenso` (B31): nenhuma Execução é criada; Execuções em `pendente`, `executando` e `aguardando aprovação` passam a `cancelada` com motivo "suspensão"; Solicitações pendentes passam a `cancelada`; Agentes Atribuídos não são invocados; na reativação nada é retomado retroativamente.
- **RN-AGE-27.** Cota de IA (Limite imposto — B34, C8) e Limite de custo do Agente são verificados na criação da Execução e a cada Passo que consome Modelo; atingidos, a Execução em curso passa a `falhou` com motivo "cota" e novas Execuções são rejeitadas (`cancelada`) com evento "Limite atingido" (RN-ET-23); nunca há suspensão automática do Agente. Custo é gravado na Execução, nunca no Agente.
- **RN-AGE-28.** Toda criação, alteração (Versão), atribuição de Papel, concessão, transferência, ativação, pausa, arquivamento, exclusão, restauração, eliminação, cancelamento de Execução, decisão de Solicitação e edição de Memória gera Registro de Atividade com Ator e delegante (A6.2). Cada Execução gera Registros de início e término; cada Ferramenta com efeito gera o Registro que a própria Ferramenta gera, com Ator Agente e delegante.

## 14. Invariantes

- **INV-AGE-01.** Todo Agente tem ao menos uma Versão; a versão 1 existe desde a criação; a Versão corrente é a de maior número.
- **INV-AGE-02.** Versões são imutáveis e nunca eliminadas enquanto o Agente existir; toda Execução referencia uma Versão que existiu.
- **INV-AGE-03.** Nenhum Agente é Proprietário de registro algum nem Criador de Agente; todo Agente tem exatamente um Proprietário Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho.
- **INV-AGE-04.** Nenhuma configuração, estado, Papel, concessão ou Memória de Agente é alterada por Ator Agente, exceto a Memória do próprio Agente pelas suas Execuções (RN-AGE-22).
- **INV-AGE-05.** Nenhum Agente é titular de Papel de governança (INV-ET-13) e nenhum Agente pratica ação de governança do Espaço de Trabalho (RN-ET-24).
- **INV-AGE-06.** Toda Execução de Agente tem exatamente um Agente, uma Versão, um Modelo usado, um Ator invocador, um nível efetivo e uma Cadeia de Execuções sem Agente repetido e dentro da profundidade máxima (B79); a Cadeia nunca cruza a fronteira do Espaço de Trabalho (INV-ET-07).
- **INV-AGE-07.** A permissão efetiva de uma Execução nunca excede a do Agente, a de qualquer Agente da Cadeia nem a do delegante Membro (A9.3); o nível de autonomia efetivo nunca excede o do Agente nem o imposto por qualquer invocador (B22).
- **INV-AGE-08.** Aprovar uma Solicitação nunca altera as permissões do Agente; uma Solicitação com motivo `permissão` só é aprovável por Membro que tenha a permissão requerida.
- **INV-AGE-09.** Nenhum conteúdo entra no Contexto, na saída ou na Memória de uma Execução sem que o Sujeito efetivo tenha `ver` sobre ele no momento da Ferramenta que o obteve.
- **INV-AGE-10.** Um Item de Memória com Delegante de origem nunca entra no Contexto de Execução com delegante diferente ou sem delegante.
- **INV-AGE-11.** Existe exatamente um Assistente padrão por Espaço de Trabalho (INV-ET-09), sempre `ativo`, com Proprietário igual ao Proprietário do Espaço de Trabalho; nunca é `rascunho`, `pausado`, `arquivado`, `na lixeira`, transferido por si nem eliminado antes do Espaço de Trabalho.
- **INV-AGE-12.** Só Agente `ativo` inicia Execuções não de ensaio e é designado Responsável ou Atribuído; Agente `arquivado` ou `na lixeira` não é Responsável nem Atribuído de registro algum.
- **INV-AGE-13.** Toda Solicitação de Aprovação pendente tem aprovador Membro `ativo` e prazo; nenhuma Execução permanece `aguardando aprovação` além do tempo limite.
- **INV-AGE-14.** Nenhum Agente tem Gatilho: toda Execução tem Origem em Sessão de Chat, ação direta de Membro, Automação, Caixa de Entrada ou outro Agente.

## 15. Personalização

O Agente **é** o objeto de personalização da IA pela organização: objetivo, instruções, Modelo, Ferramentas, Habilidades, Conhecimento, Papel, concessões, autonomia, aprovação, Memória. Além disso:

- **Campos Personalizados**: não se aplicam (A5.2 não lista Agente; pedido análogo a C13 se surgir).
- **Tags**: não se aplicam (A8). Classificação de Agentes ("comercial", "suporte") é atributo de exibição do produto, não Tag.
- **Comentários**: não se aplicam (A8). Discussão sobre um Agente ocorre em Tarefa ou Documento.
- **Status personalizável**: não existe; os estados são de sistema (11).
- **Templates de Agente**: mecanismo de reutilização (A8; DO-AGE-12): um Membro com `ver` no Agente e `criar` sobre Templates cria um Template a partir dele (configuração da Versão corrente, Habilidades por identidade; sem Memória, sem Execuções, sem permissões); instanciar cria Agente `rascunho` com Proveniência.
- **Nível de autonomia, Política de aprovação, Política de retenção e Limite de custo** são personalização de governança, com padrões da plataforma.
- **Entrada da Execução** (pedido, Parâmetros, âncora) é a forma pela qual quem invoca personaliza um episódio sem alterar o Agente.

O Assistente padrão é personalizável nos mesmos termos, salvo o que INV-AGE-11 fixa (12.6).

## 16. Herança

- **Da Estrutura de Trabalho**: nenhuma. O Agente não está na hierarquia (A2.2); não tem ponto de definição nem modo de herança (B25). Permissões que recebe sobre contêineres seguem a herança **do contêiner** (A9.2), como para qualquer Sujeito.
- **Entre Versões**: cada Versão é cópia completa da anterior com a alteração; não é herança — a anterior não influencia a posterior depois de criada.
- **Do Template**: Proveniência, não herança; nova versão do Template não se propaga (DO-AGE-12).
- **Do invocador para a Execução**: o delegante, a cadeia e o teto de autonomia **restringem** a Execução (RN-AGE-11, RN-AGE-12); nada é herdado no sentido de ampliar.
- **Da Habilidade**: nada (INV-HAB-06); o Agente não herda contrato, Ferramentas ou permissões da Habilidade; a Habilidade não herda nada do Agente.
- **Entre Agentes na Cadeia de Execuções**: o invocado não herda permissões, Memória, Ferramentas nem Conhecimento do invocador; herda apenas o delegante e a Autonomia máxima imposta (DO-AGE-08).
- **Do Espaço de Trabalho**: Localidade (idioma padrão do Assistente padrão — RN-ET-15; fuso para momentos), Política de lixeira, Limites impostos, como toda entidade (documento 01, 16).
- **Do Membro Proprietário**: nada. As permissões do Agente não derivam das do Proprietário, que tampouco é teto (diferentemente da Automação, cujo Proprietário é teto, não fonte — DO-AUT-01; B88); o Agente é Sujeito com Papel e concessões próprias. Justificativa: um Agente que herdasse as permissões do Proprietário tornaria a transferência de propriedade uma mudança silenciosa de acesso, e a sucessão B28 poderia ampliar o acesso do Agente ao passar a um Administrador.

## 17. Permissões e visibilidade

### 17.1 O Agente como Recurso

| Ação | Sobre o Agente significa |
| --- | --- |
| ver | Ver nome, descrição, configuração (todas as Versões), Papel, Concessões, Conhecimento acessível, Execuções (com Passos, Composição do Contexto, Solicitações, custo) e Itens de Memória; ver Registros de Atividade do Agente. |
| comentar | Não se aplica (A8). |
| criar | Criar Agente; instanciar Template de Agente. Recurso: o conjunto "Agentes" do Espaço de Trabalho. |
| editar | Alterar configuração (cria Versão); permitir Ferramentas; conceder Habilidades (com `executar` na Habilidade — RN-HAB-12); editar e apagar Itens de Memória; alterar Política de retenção; executar ensaios; renomear e descrever. |
| excluir | Enviar à lixeira; restaurar. |
| administrar | Ativar, pausar, reativar, arquivar, desarquivar, eliminar antecipadamente; transferir propriedade; alterar Limite de custo; cancelar Execuções; decidir Solicitações de Aprovação (elegibilidade adicional — 7.8); compartilhar e conceder permissões sobre o Agente. |
| executar | **Invocar**: escolhê-lo como Agente principal de Sessão de Chat; pedir-lhe ação direta sobre um registro; designá-lo Responsável ou Atribuído (com `editar` no registro); referenciá-lo em Ação "invocar Agente" ou Condição híbrida de Automação (avaliado sobre a Automação como Sujeito, dentro do teto do Proprietário, na publicação e a cada Ação — RN-AUT-07; RN-AUT-04); ser invocado por outro Agente (avaliado sobre o Agente invocador e, quando há delegante Membro, sobre ele — RN-AGE-13). |

Escopos: `registro` (um Agente) e `próprios` (Agentes de que o Sujeito é Proprietário ou Criador — B29). `subárvore` não se aplica. O **Proprietário** tem `administrar` por propriedade (origem: propriedade, avaliada como concessão implícita, irrevogável enquanto for Proprietário — mesmo padrão de Coleção, documento 20, 17.1).

### 17.2 Origens e padrão recomendado

| Papel | Padrão (recomendação; produto pode ajustar) |
| --- | --- |
| Proprietário do ET / Administrador | Tudo sobre todos os Agentes (`ver`, `criar`, `editar`, `excluir`, `administrar`, `executar`); configurar o Assistente padrão (ação de Papel — documento 01, 17.2); atribuir Papel a Agentes (governança). |
| Membro | `ver` e `executar` sobre o Assistente padrão e sobre Agentes compartilhados com ele ou com a sua Equipe (documento 01, 17.2); `criar` por concessão de Administrador (o produto pode conceder por padrão a Membros — 25.7); sobre Agentes de que é Proprietário ou Criador, `editar`, `excluir` e `administrar` em escopo `próprios`. |
| Convidado | Nada por Papel; `executar` só por compartilhamento explícito de um Agente; nunca `criar`, `editar`, `administrar`. |
| Agente (como Sujeito sobre outro Agente) | Apenas `executar`, por concessão direta, para invocá-lo (RN-AGE-13). Nunca `ver` (a configuração alheia não entra em Contexto), `criar`, `editar`, `excluir` ou `administrar` (INV-AGE-04). |

Governança de Agentes (criar, editar, pausar, transferir) **não** é ação de governança do Espaço de Trabalho no sentido de B30 (é concedível por concessão direta), porque Agente é entidade de domínio; **atribuir Papel** a um Agente **é** governança do Espaço de Trabalho (RN-ET-24) e decorre só do Papel do Membro.

### 17.3 O Agente como Sujeito

Tudo o que o Agente pode fazer sobre registros decorre da tupla A9.1 com Sujeito = Agente: **Papel** (Convidado por padrão: nada), **concessões diretas** (por quem tem `administrar` no Recurso; inclusive Coleções — DO-CNH-12 — e Listas), **herança** (do contêiner, quando a concessão é em `subárvore`) e **compartilhamento** (Tarefa compartilhada com o Agente — documento 06, 17.2). Um contêiner privado o exclui como a qualquer Sujeito sem concessão (B38); Agentes nunca recebem `administrar` sobre contêineres nem privatizam (B38, B46). Mais a **camada de Ferramentas** (7.7): sem a Ferramenta permitida, a permissão sobre o registro não tem por onde ser exercida. Permissão efetiva em nome de Membro: interseção (A9.3); em Cadeia de Execuções: interseção de todos os Agentes da Cadeia e do delegante Membro (RN-AGE-13); autônomo (delegante Automação ou nenhum): só a própria.

**Painel.** O Agente recebe, no máximo, `ver` sobre um Painel; a única Ferramenta sobre Painéis é `ler Painel` (classe `leitura`), que entrega ao Agente a **configuração** dos Widgets e recalcula cada um com as suas permissões efetivas (interseção com o delegante Membro — A9.3), nunca os números que um Membro viu (RN-PAI-22; DO-PAI-17). Não existe Ferramenta de escrita sobre Painel: nenhum Agente cria, edita, compartilha ou administra Painéis — propõe em texto, e um Membro configura (RN-PAI-03; DO-PAI-08). O Painel não é Fonte de Dados nem de Conhecimento para o Agente (B19); as Execuções e Solicitações do Agente é que são Fonte de Dados de Painel (DO-PAI-05).

### 17.4 Visibilidade de Execuções e Memória

Execuções, Passos, Composição do Contexto, Solicitações e Itens de Memória são visíveis a quem tem `ver` no Agente, com uma restrição: **as referências dentro deles resolvem com a permissão de quem lê** (um Administrador que vê o Agente mas não vê a Lista privada em que o Agente agiu vê o Passo "criar Tarefa" com o registro-alvo como "registro sem acesso"). O **delegante** de uma Execução vê essa Execução ainda que não tenha `ver` no Agente (é o seu pedido). Painéis sobre Execuções filtram pelo visualizador (B20). Instruções e Memória podem ser sensíveis: organizações restringem `ver` por Papel personalizado ou concessão.

### 17.5 IA sujeita às mesmas regras

Não há atalho: o Agente é Sujeito (A6.3), a Concessão de Habilidade não amplia nada (INV-HAB-06), a aprovação não concede (INV-AGE-08), a Memória não vaza (INV-AGE-10), a Cadeia de Execuções só restringe (INV-AGE-07), o Assistente padrão não tem privilégio (12.6). O Sistema age apenas por regra (eliminação por prazo, expiração de aprovação, retenção de Memória, remoção de Ferramentas descontinuadas, resolução do Modelo `padrão da plataforma`), com Registro de Atividade quando produz efeito. A plataforma publica Templates e Modelos fora da ontologia dos Sujeitos (documento 01, 17.4).

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Agente criado | 12.1 | Agente, Criador, Proprietário, origem (novo, instanciado com Proveniência, Assistente padrão) | Auditoria; Limites (RN-ET-23); produto |
| Versão de Agente criada | 12.2 | Agente, número, Ator, Motivo, resumo das diferenças (Modelo, autonomia, Ferramentas, Habilidades) | Auditoria; Proprietário do Agente (notificação quando autonomia ou Ferramentas de classe `externa`/`irreversível` aumentam); Painéis |
| Papel do Agente atribuído / alterado | 12.2 | Agente, antes, depois, Ator | Auditoria; avaliação de permissões em curso (B23) |
| Propriedade transferida | 12.2, B28 | Agente, Proprietário anterior, novo, Ator, causa (transferência, sucessão) | Auditoria; notificação ao novo Proprietário; Solicitações pendentes |
| Agente ativado / pausado / reativado | 12.2 | Agente, Ator, responsabilidades preservadas (pausa) | Automações que o invocam; Sessões; Caixa de Entrada; produto |
| Agente arquivado / enviado à lixeira / restaurado / eliminado | 12.4, 12.5 | Agente, Ator, Tarefas e Conversas liberadas, Sessões e Automações afetadas, Concessões removidas | Tarefa (Responsável removido); Caixa de Entrada (liberação, redistribuição); Chat; Automações; Auditoria |
| Disponibilidade alterada | 6.3 | Agente, `disponível`/`indisponível`, motivo(s), causa (Modelo descontinuado, cota, pausa, suspensão) | Proprietário (notificação); Automações; Painéis |
| Execução criada / iniciada | 12.3 | Execução, Agente, Versão, Modelo, Origem, invocador, delegante, cadeia, nível efetivo, âncora | Painéis; Automações (Gatilho "Execução iniciada" — documento 19); Sessão de Chat (indicador) |
| Passo com efeito executado | 12.3 | Execução, Ferramenta, registro-alvo, classe de efeito, Sujeito efetivo, resultado | É o Registro de Atividade da própria Ferramenta (RN-AGE-28); Painéis |
| Permissão negada em Execução | RN-AGE-15 | Execução, Ferramenta, registro-alvo, permissão faltante, Sujeito efetivo, desfecho (falhou / alternativa) | Auditoria de segurança; Proprietário do Agente |
| Solicitação de Aprovação criada | 7.6 | Solicitação, Execução, Agente, motivo, objeto, aprovador, prazo | Notificação ao aprovador (e Equipe); produto; Painéis |
| Solicitação decidida / expirada / cancelada | 7.6, RN-AGE-18 | Solicitação, decisão, Decisor, momento | Execução (retoma ou termina); Auditoria; Proprietário |
| Execução concluída / falhou / cancelada | 12.3 | Execução, estado final, motivo, saídas (referências), Referências de Conhecimento, custo, duração, Exercícios de Habilidade | Automações (Gatilhos "Execução concluída/falhou" — documento 19); Execução de Automação pai; Execução de Agente invocadora; Sessão de Chat; Caixa de Entrada (Rascunho/Mensagem); Painéis |
| Agente invocou Agente | RN-AGE-13 | Execução invocadora, Execução filha, profundidade, delegante herdado | Auditoria; Painéis (custo por cadeia) |
| Item de Memória criado / editado / eliminado | 7.5 | Agente, Item, origem (Execução ou Membro), Delegante de origem, causa (memorização, edição, retenção, registro eliminado) | Auditoria; produto ("o que o Agente lembra"); C7 |
| Limite atingido (custo do Agente ou cota de IA) | RN-AGE-27 | Agente, Execução, limite, período | Proprietário; Administradores; Painéis; plataforma (RN-ET-23) |
| Modelo descontinuado (plataforma) | DO-AGE-04 | Modelo, Modelo sucessor sugerido (se houver), Agentes afetados por Espaço de Trabalho | Administradores (notificação com antecedência); Disponibilidade; documento 15 |
| Template de Agente da plataforma atualizado | 12.6 | Template, versão, Agentes com Proveniência | Administradores; produto ("restaurar padrão") |
| Ensaio executado | DO-AGE-13 | Execução (marcação ensaio), Agente, Versão, Passos simulados | Produto; Painéis (separado de Execuções reais) |

Todos geram Registro de Atividade com Ator e delegante (A6.2). Eventos de Exercício de Habilidade são eventos da Execução (documento 18, 18) e constam aqui dentro de "Execução concluída / falhou / cancelada" e "Passo com efeito executado".

## 19. Dependências

**O Agente depende de:** Espaço de Trabalho (pertencimento, Limites impostos, Política de lixeira, `suspenso`, Localidade, Assistente padrão referenciado — documento 01); Membro (Proprietário, Criador, delegante, aprovador, Sucessor — documento 01); Papel (B30; documento 01, 7.3); Modelo e as suas Capacidades (A1.3; DO-HAB-10 — documento 15); Catálogo de Ferramentas (DO-HAB-13 — documento 18, 7.4; Integrações — documento 01, 7.4); Habilidade e Concessão de Habilidade (B15 — documento 18); Coleção e concessão de Conhecimento (DO-CNH-12 — documento 20); Sessão de Chat como origem de Execuções e Memória do Usuário (B21 — documento 16); Automação como invocadora e Execução de Automação como pai (B17, B18 — documento 19); Caixa de Entrada (Atribuído, Rascunho, escalonamento, Ferramentas de mensageria — documento 14); Tarefa (Responsável — documento 06); Template de Agente (A8; catálogo do Espaço de Trabalho — documento 01, 7.6); Registro de Atividade (A6.2); Arquivo (entradas e saídas — A8).

**Dependem do Agente:** Habilidade (executor único; Exercício como Passo — documento 18); Automação (Ação "invocar Agente"; Gatilhos sobre Execuções; redução de autonomia; aprovador indicado — documento 19); Chat (Agente principal; Execuções por turno; Mensagem de Chat `assistente` como saída — documento 16); Conhecimento (consulta por Ferramenta; escrita por Ferramenta com Proveniência; Referência de Conhecimento gravada na Execução — documento 20); Caixa de Entrada (Agente Atribuído; Rascunho gerado; RN-CXE-12, RN-CXE-23 — documento 14); Tarefa (Agente Responsável; RN-TAR-27 — documento 06); Contato, Empresa, Negócio (Ferramentas de leitura e escrita sob permissão — documentos 10–12); Painéis (Fonte de Dados "Execuções de um Agente"; custo, Solicitações, Exercícios — documento 21); Espaço de Trabalho (INV-ET-09; sucessão de Agentes em B28; Limites de Agentes e cota); IA visão geral (definições de Execução, Contexto, Memória, Solicitação de Aprovação herdadas deste documento — documento 15).

**O que este documento fixa para os documentos 15, 16 e 19 herdarem** (DO-AGE-14): Execução de Agente (7.2, 11.2, 12.3), Passo (7.3), Contexto por referência (7.4), Memória do Agente e elegibilidade por delegante (7.5), Solicitação de Aprovação e resolução do aprovador (7.6, 7.8), invocação e cadeia (DO-AGE-08), nível de autonomia efetivo (RN-AGE-12), Modelo `padrão da plataforma` (DO-AGE-04), ensaio (DO-AGE-13).

## 20. Casos limítrofes e ambiguidades

### 20.1 Agente sem Habilidade

"Recepcionista" tem objetivo, instruções, Modelo, Ferramentas "ler Conversa" e "enviar Mensagem", nenhuma Habilidade. Válido (B15): age por instruções, Ferramentas e Conhecimento. As Execuções não têm Exercícios; tudo é chamada de Ferramenta guiada pelas instruções. Se, com o tempo, dois Agentes precisarem do mesmo "roteiro de recepção", ele vira Habilidade (documento 18, 4).

### 20.2 Habilidade concedida a 10 Agentes e removida

Um Administrador envia "qualificar lead" à lixeira. As 10 Concessões passam a `indisponível` (documento 18, 11.1); nenhum Agente é alterado, nenhuma Versão de Agente é criada (a Concessão continua a existir; só a Disponibilidade muda), nenhum Agente muda de estado. Exercícios em curso terminam na versão carregada (RN-HAB-14). Automações que indicam a Habilidade falham na próxima disparada com Registro. Na **eliminação permanente**, as 10 Concessões são removidas (INV-HAB-08) e **aí sim** cada Agente ganha uma Versão nova pelo Sistema (o conjunto de Habilidades concedidas mudou — DO-AGE-02), com Motivo "Habilidade eliminada", e evento aos 10 Proprietários. Execuções passadas preservam o Exercício como valor (documento 18, 20.13).

### 20.3 Proprietário do Agente removido do Espaço de Trabalho

B28 / RN-ET-09. No mesmo ato: o Agente passa ao Sucessor (Registro de Atividade próprio); Solicitações pendentes de que o removido era aprovador passam ao Sucessor; concessões diretas do removido são revogadas (as do Agente não mudam: são do Agente). Execuções em curso: **autônomas** (Automação, Caixa de Entrada) continuam — usam as permissões do Agente, não do Proprietário (documento 01, 20.6a); **em nome do removido** (Sessão dele) falham na próxima Ferramenta, porque a interseção com um Membro `removido` é vazia (B23; 20.6b). Novas Execuções não "exigem" nada além do que já existe: o Agente tem Proprietário (o Sucessor) desde o instante da remoção — não há intervalo sem Proprietário (INV-ET-03). Se o Sucessor for um Administrador, as permissões do Agente **não** aumentam (seção 16: o Agente não herda do Proprietário). A Memória do Agente é preservada; Itens com Delegante de origem = removido nunca mais entram em Contexto (INV-AGE-10) e são elegíveis a eliminação pela Política de retenção (`sim` para reter Itens com delegante não os protege de delegante `removido` — o produto pode eliminá-los no ato; recomendação: eliminar, por C7).

### 20.4 Permissão revogada durante a Execução (B23)

O Agente "Comercial" está `executando` em nome de Ana, com `editar` no Negócio N já verificado em um Passo anterior. Um Administrador retira `editar` de Ana sobre o Funil de N. A próxima chamada "atualizar Negócio" refaz as duas verificações (DO-HAB-14): a interseção já não contém `editar` em N; o Passo registra "negada" com evento "Permissão negada em Execução"; a Execução passa a `falhou` — ou, se o Agente tiver alternativa (há aprovador com `editar` em N e a Política admite motivo `permissão`), a `aguardando aprovação` com Solicitação de motivo `permissão` (DO-AGE-11); aprovada por Pedro (que tem `editar`), o Passo executa com delegante Pedro, e o Registro grava Ator Agente, delegante Pedro. O efeito do Passo anterior **não** é revertido (RN-AGE-21). O mesmo vale para revogação de Concessão de Habilidade (documento 18, 20.2), de concessão de Coleção (documento 20, 20.1) e de Papel do Agente (evento "Papel alterado" → avaliação em curso).

### 20.5 Agente `autônomo` invocado por Automação que impõe `supervisionado`

A Execução nasce com nível efetivo `supervisionado` (RN-AGE-12; B22): "enviar Mensagem" (classe `externa`) gera Solicitação de Aprovação a cada envio, ao aprovador indicado pela Automação (7.8, precedência) ou, na ausência, ao configurado no Agente; o texto fica como Rascunho (DO-CXE-15). Se o Agente invoca outro Agente durante essa Execução, a filha herda o teto `supervisionado` (RN-AGE-13). O inverso — Automação impondo `autônomo` a Agente `assistido` — é ignorado: o efetivo continua `assistido`, com Registro na Execução de Automação (documento 19).

### 20.6 Agente `assistido` tentando enviar Mensagem a Contato

Toda Ferramenta que não seja `leitura` exige aprovação (RN-AGE-12). Ao decidir "enviar Mensagem", a Execução cria Solicitação com objeto fixo (Conversa, texto, Anexos) e passa a `aguardando aprovação`; o texto é gravado como **Rascunho** da Conversa com origem `Agente` e referência à Execução (DO-CXE-15; RN-CXE-26), visível ao Atendente. Três desfechos: **aprovada** — a Ferramenta executa com as verificações refeitas (RN-AGE-17): consentimento, janela de resposta e Mensagem de modelo (RN-CXE-19, RN-CON-16) são verificados pela própria Ferramenta; a Mensagem nasce com Ator Agente e delegante (o Membro da Sessão, ou o aprovador se motivo `permissão`; sem delegante se autônoma — RN-CXE-23); o Rascunho é esvaziado. **Rejeitada** — o Rascunho permanece para o Atendente adotar, editar ou descartar; a Execução segue alternativa ou `falhou`. **Expirada** — Execução `cancelada`, Rascunho preservado (RN-AGE-21). Em nenhum caso o Agente altera o texto depois de aprovado (RN-AGE-17): uma nova redação é nova Solicitação.

### 20.7 Ciclo na Cadeia de Execuções entre Agentes

"Coordenador" invoca "Pesquisador", que tenta invocar "Coordenador". A Cadeia de Execuções do Pesquisador é [Coordenador, Pesquisador] (ou [Automação X, Coordenador, Pesquisador], quando o Coordenador foi invocado por Automação — a Cadeia é uma só, B79); o invocado já consta: a chamada é **rejeitada** antes de criar Execução (RN-AGE-13), com Passo "negada" e motivo "ciclo", e a Execução do Pesquisador segue B23 (alternativa ou `falhou`). Ciclo indireto (A→B→C→A) é rejeitado da mesma forma; profundidade acima do sub-limite de invocações Agente → Agente (A→B→C→D com sub-limite 3) ou da profundidade total da Cadeia idem. Um Agente que, dentro da Cadeia, aciona uma Automação por `acionar Automação` continua a mesma Cadeia (RN-AUT-19): a Automação e o Agente que ela invocar contam para a profundidade total, e um Agente já presente na Cadeia não pode ser invocado de novo por essa via. Auto-invocação (A→A) é o ciclo mais curto e é rejeitada. O que o Pesquisador pode fazer é **retornar** ao Coordenador: a sua saída é o resultado do Passo "invocar Agente" na Execução do Coordenador. Não há "mensagem entre Agentes" fora dessa relação pai–filha: Agentes não têm caixa de entrada.

### 20.8 Modelo descontinuado pela plataforma

A plataforma descontinua o Modelo M (evento "Modelo descontinuado", com antecedência e Modelo sucessor sugerido). Agentes com Modelo `padrão da plataforma` não são afetados: a resolução no início de cada Execução já aponta ao novo padrão (DO-AGE-04). Agentes com M explícito passam a **`indisponível`** (motivo: Modelo descontinuado — 6.3), com evento ao Proprietário e aos Administradores; permanecem `ativo` (não há estado `degradado`: a causa é externa e derivável — 11.4); Execuções novas falham na criação (RN-AGE-08); Execuções em curso terminam com M enquanto a plataforma o mantiver operante no prazo de transição. Um Membro com `editar` troca o Modelo (nova Versão) — ato humano, porque trocar o raciocínio de um Agente é decisão de configuração, não de infraestrutura; o produto pode oferecer "aplicar o sucessor" em lote, que cria uma Versão por Agente com Ator Membro. Habilidades cujas Capacidades requeridas o novo Modelo não atenda ficam `indisponível` (RN-HAB-17).

### 20.9 Agente `pausado` Responsável por 30 Tarefas

Pausar **preserva** as 30 responsabilidades (RN-AGE-20; 11.1): as Tarefas continuam a listá-lo como Responsável, Painéis de carga o contam, Observadores não são notificados de liberação. Nada acontece com as Tarefas, porque um Agente Responsável nunca trabalhava por conta própria: trabalhava quando invocado (RN-AGE-14), e agora a invocação é rejeitada — a Automação "toda manhã, invocar Agente sobre as suas Tarefas" falha com Registro até a reativação. O produto deve mostrar, ao pausar, quantas responsabilidades ficarão paradas. Se a intenção é redistribuir, o caminho é arquivar (libera as 30 no ato, com evento por Tarefa) ou reatribuir manualmente. Ao reativar, tudo retoma sem ato adicional.

### 20.10 Agente agindo em nome de Convidado

Um Convidado com uma Tarefa compartilhada em `comentar` pede ao Assistente padrão (compartilhado com ele em `executar`) que "resuma e conclua a Tarefa". Interseção (A9.3): o Agente vê a Tarefa (o Convidado vê); "alterar status" exige `editar`, que o Convidado não tem — Passo "negada"; Solicitação de motivo `permissão` só é possível se a Política admitir e houver aprovador com `editar` (o Proprietário do Agente, por exemplo) — e, se aprovada, o Passo executa com o aprovador como delegante, o que é correto: um humano com a permissão decidiu. O Convidado nunca obtém, pelo Agente, acesso ao CRM, à Lista da Tarefa ou a Coleções que não lhe foram compartilhadas (INV-AGE-09). Itens de Memória criados nessa Execução têm Delegante de origem = Convidado e só servem a ele (INV-AGE-10).

### 20.11 Agente lendo Coleção que o delegante não acessa

Documento 20, 20.3: interseção — a Coleção A não entra no Contexto; a Ferramenta "consultar Conhecimento" não retorna Fragmentos de A nem revela que A existe (INV-CNH-09); a saída não a cita. O mesmo Agente, invocado por Automação (autônomo), usa A. Um Membro que leia a Execução autônoma e não veja A vê a Referência de Conhecimento como "Documento sem acesso" (17.4). A Memória segue INV-AGE-10: um Item de Memória criado em Execução autônoma a partir de A entra em Contexto de Execução em nome de quem não vê A — **isso é aceito**, porque o fato é uma afirmação do Agente sob as suas próprias permissões, e a proteção de A é feita pela Ferramenta (B19), não pela Memória; organizações que consideram isso vazamento desabilitam a Memória do Agente ou restringem a Política (25.1; C7).

### 20.12 Custo acima do limite

Durante uma Execução longa, o Limite de custo do Agente é atingido no 40º Passo. A Execução passa a `falhou` com motivo "cota" (RN-AGE-27) — não `cancelada`, porque não foi ato nem regra externa ao seu próprio consumo; Passos anteriores permanecem com os seus efeitos; evento "Limite atingido" ao Proprietário e aos Administradores. Novas Execuções do Agente são rejeitadas (`cancelada` na criação) até o próximo período ou até um Administrador elevar o Limite (não versionado; Registro). A cota do Espaço de Trabalho, quando atingida, produz o mesmo efeito para todos os Agentes, inclusive o Assistente padrão, sem suspender o Espaço de Trabalho (RN-ET-23). O Agente Atribuído a Conversas deixa de responder; a Caixa de Entrada registra "Agente indisponível" e a Fila pode redistribuir por Automação (documento 14).

### 20.13 Agente criado por outro Agente

Proibido (INV-AGE-03; RN-AGE-25): não existe Ferramenta "criar Agente", "editar Agente" ou "conceder ao Agente". A governança de sujeitos de IA é humana (B7): um Agente que pudesse criar Agentes multiplicaria sujeitos sem Proprietário deliberado, sem Papel atribuído por Administrador e sem revisão de Ferramentas e autonomia. O que um Agente pode fazer é **invocar** Agentes existentes (DO-AGE-08) e **propor** em texto uma configuração que um Membro cria. Tentativa (por instrução maliciosa ou erro): rejeitada e registrada como "Permissão negada".

### 20.14 Assistente padrão com instruções alteradas pelo Administrador

Permitido: configurar o Assistente padrão é ação do Papel Administrador ou Proprietário do Espaço de Trabalho (documento 01, 17.2). A alteração cria Versão com Ator o Administrador e Motivo; evento ao Proprietário do Espaço de Trabalho (que é o Proprietário do Assistente). Execuções seguintes usam a nova Versão; em curso, terminam na anterior (RN-AGE-09). Um Administrador que remova limites das instruções ("nunca prometa desconto") não amplia nada além do que as Ferramentas permitidas, o Papel e as concessões já admitem — instruções orientam raciocínio; não são permissão (INV-AGE-07). "Restaurar padrão" desfaz por nova Versão (12.6). Um Administrador que suba o nível para `autônomo` e permita "enviar Mensagem" produz um Assistente que responde a Contatos sem aprovação — decisão legítima da organização, auditada e reversível; o produto pode exigir confirmação reforçada (RN-HAB-11 por analogia).

### 20.15 Agente alterando a própria configuração

Proibido (INV-AGE-04; RN-AGE-25). Um Agente "que aprende" retém Itens de Memória (fatos), nunca reescreve instruções, Ferramentas, autonomia ou Papel. Justificativa: a Versão é o objeto de auditoria e de reprodução (B24); se o Agente se editasse, "por que o Agente fez isso" teria como resposta "porque ele decidiu poder"; e a interseção de A9.3 seria contornável por um Agente que ampliasse as próprias Ferramentas. Um Agente pode **propor** alteração (saída de Execução, Comentário em Tarefa); um Membro com `editar` a aplica. Instruções que peçam ao Agente "atualize as suas instruções" são inertes: não há Ferramenta.

### 20.16 Espaço de Trabalho suspenso com Execuções em curso

B31 / RN-AGE-26: todas as Execuções `pendente`, `executando` e `aguardando aprovação` passam a `cancelada` com motivo "suspensão"; Solicitações pendentes passam a `cancelada`; Rascunhos gerados permanecem nas Conversas; nenhum Passo adicional é produzido; Mensagens já aceitas pelo provedor seguem o seu status (RN-CXE-23). Agentes Atribuídos não são invocados pelas Mensagens persistidas durante a suspensão (RN-CXE-27). Na reativação, nada é retomado ou reexecutado retroativamente (DO-ET-09): as Conversas sem resposta entram na distribuição a partir daquele momento; Automações podem varrer o que ficou pendente. Os Agentes mantêm o seu estado (`ativo`, `pausado`); a Disponibilidade volta a `disponível` sem ato.

### 20.17 Agente como Responsável de Tarefa que exige `editar` para concluir

O Agente é Responsável (com `ver` — RN-TAR-06) por uma Tarefa em Lista onde só tem `comentar`. Invocado por Automação para "concluir se o Checklist estiver completo": "alterar status" exige `editar` → negada → Solicitação de motivo `permissão` ao aprovador com `editar`, ou `falhou`; o Agente pode comentar propondo (documento 06, 20.12). A responsabilidade não confere permissão (documento 06, 17.3), para o Agente como para humanos.

### 20.18 Duas Sessões de Chat com o mesmo Agente ao mesmo tempo

Ana e Pedro usam "Comercial" como principal nas suas Sessões. São duas Execuções concorrentes do mesmo Agente, cada uma com o seu delegante, o seu Contexto e a sua interseção; nenhuma vê a outra; Memória compartilhada só nos Itens sem delegante (INV-AGE-10). Não há limite ontológico de concorrência; cota e Limites impostos regulam (C8).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Habilidades e suas Versões | Habilidade (Espaço de Trabalho ou plataforma) | Concedidas, não contidas (B15; DO-HAB-03). |
| Concessão de Habilidade | Espaço de Trabalho (associação) | Sem identidade; eliminada por qualquer lado (documento 18, 7.2). A Versão de Agente só registra o conjunto. |
| Coleções, Documentos, Fragmentos; "Conhecimento acessível" | Coleção (a concessão vive nela) | DO-CNH-12; visão derivada. |
| Ferramentas | Catálogo (plataforma / Integração) | Permitidas, não contidas (DO-HAB-13). |
| Modelo e Capacidades | Entidade global (A1.3) | Referenciado; documento 15. |
| Sessão de Chat, Mensagens de Chat, Memória do Usuário | Membro (B21) | O Agente não conhece Sessões; a Execução referencia a de origem. Documento 16. |
| Gatilho, Condições, escopo, agendamento | Automação | O Agente não tem Gatilho (INV-AGE-14). Documento 19. |
| Execução de Automação | Automação | Pode conter Execuções de Agente (B18), não o inverso. |
| Tarefas de que é Responsável; Conversas de que é Atribuído | Tarefa; Conversa | Associações inversas (B7); liberadas, nunca eliminadas (12.5). |
| Rascunho gerado; Mensagem enviada | Conversa | DO-CXE-15; a Mensagem tem o Agente como Ator, não como Proprietário. |
| Documento de Conhecimento criado por Agente | Coleção | Proveniência registra o Agente (DO-CNH-13). |
| Tarefa, Negócio, Contato criados por Agente | Entidade criada (Criador = Agente; Proprietário conforme o documento da entidade) | O Agente nunca é Proprietário (INV-AGE-03). |
| Registros de Atividade | Espaço de Trabalho | O Agente é Ator ou objeto; o histórico é visão (A6.2). |
| Template de Agente | Catálogo do Espaço de Trabalho / plataforma | Proveniência, sem vínculo vivo (DO-AGE-12). |
| Papel | Espaço de Trabalho | Referenciado (B30). |
| Permissões sobre registros (concessões, compartilhamentos) | Recurso concedido | A9.1: vivem no Recurso; o Agente é Sujeito. |
| Cota de IA | Limites impostos do Espaço de Trabalho (B34) | O Agente tem no máximo um Limite de custo próprio, dentro dela. |
| Custo | Execução | 7.9; nunca atributo do Agente (agregações são derivadas). |
| Registro de Tempo | Membro | Agentes não registram tempo (B42). |
| Comentários, Tags, Campos Personalizados | — | A8/A5 não os preveem (15). |
| Contexto | Execução (objeto de valor efêmero) | Reconstruído a cada Execução; o Agente não "tem Contexto" (7.4). |
| Aprovador | Membro | A Política de aprovação referencia; a decisão é humana (7.8). |
| Painel | Painéis (Criador e Proprietário sempre Membro) | Agente só lê por `ler Painel`, com recálculo (DO-PAI-17); nunca cria nem edita (DO-PAI-08); as Execuções e Solicitações do Agente são Fonte de Dados de Painel, não o inverso (DO-PAI-05). |

## 22. Exemplos conceituais

**Exemplo 1 — Agente Comercial.** A coordenadora comercial (Membro com `criar` sobre Agentes) cria "Comercial": objetivo "qualificar leads da Fila Comercial e propor o próximo passo", instruções com tom e limites, Modelo `padrão da plataforma`, Ferramentas permitidas "ler Contato", "ler Conversa", "ler Negócio", "atualizar Qualificação de Contato", "criar Tarefa", "enviar Mensagem", nível `supervisionado`, Política de aprovação com a Equipe "Vendas" e 12 horas de prazo. Nasce `rascunho`, versão 1, Papel Convidado, Proprietário = coordenadora. Um Administrador atribui Papel personalizado "Agente CRM" (base Membro; `ver` em Contatos e Conversas) e concede `criar` na Lista "Follow-ups"; a coordenadora concede "Qualificar lead" (versão 3) e "Preparar proposta"; cada ato cria Versão (versões 2 a 4). Ensaio sobre uma Conversa real: Ferramentas de leitura executam, "atualizar Qualificação" é simulada. Ativação: versão 4 `ativo`. A Automação "Conversa criada na Fila Comercial → invocar Comercial, exercer Qualificar lead" produz 20 Execuções por dia, autônomas (sem delegante); "atualizar Qualificação" (`reversível`) executa; "enviar Mensagem" (`externa`) gera Solicitação à Equipe Vendas com o texto como Rascunho; Marina aprova em 10 minutos e a Mensagem sai com Ator Comercial, sem delegante (a aprovação de motivo `autonomia` não torna Marina delegante). Cada Execução registra Modelo concreto, versão 4, Exercício de "Qualificar lead v3", Referências à Coleção "Critérios comerciais" (concedida ao Agente) e custo.

**Exemplo 2 — Assistente padrão em Sessão ancorada.** Pedro (Membro) abre uma Sessão de Chat ancorada na Tarefa T e pede "resuma os comentários e crie três Subtarefas". Cada turno é uma Execução do Assistente padrão com invocador e delegante Pedro. Interseção: o Assistente vê T porque Pedro vê; "criar Tarefa" exige `criar` na Lista e `editar` em T (DO-STA-10) — Pedro tem, o Assistente tem por Papel Convidado nada e por concessão nada → interseção vazia → negada. O Administrador concede ao Assistente `criar`/`editar` em `subárvore` no Espaço "Operações"; na Execução seguinte a interseção contém ambos; nível `supervisionado`: "criar Tarefa" é `reversível` e executa; três Subtarefas nascem com Criador Assistente padrão, delegante Pedro. A Memória do Assistente retém "Pedro prefere Subtarefas com verbo no infinitivo" com Delegante de origem Pedro; em Sessão de Ana esse Item não entra no Contexto.

**Exemplo 3 — Cadeia de Execuções.** "Coordenador de propostas" (`autônomo`, Profundidade máxima 2) é invocado por Automação ao ganhar Etapa "Proposta" (Execução com delegante = a Automação, profundidade 1 na Cadeia [Automação, Coordenador]); invoca "Pesquisador" (`executar` concedido) para levantar histórico da Empresa e "Redator" para o texto; cada filha herda o delegante (a Automação, que não entra na interseção), nível ≤ `autônomo`, permissão = interseção com o Coordenador; Redator tenta invocar Coordenador → ciclo → negada; Redator conclui e retorna; Coordenador anexa a proposta ao Negócio (`reversível`) e conclui. Painel "custo por cadeia" soma as três Execuções.

**Exemplo 4 — Saída da coordenadora.** A coordenadora é removida; Maria (Administradora) indica Pedro como Sucessor. "Comercial" passa a Pedro no ato; as 3 Solicitações pendentes de que a coordenadora era aprovadora passam a Pedro; a Execução autônoma em curso termina normalmente; a Execução em nome da coordenadora (Sessão dela) falha na próxima Ferramenta. Nada muda nas permissões do Agente.

## 23. Representação gráfica textual

```
Plataforma (global)
├── Modelo (0..N) ──── Capacidades; "padrão da plataforma" designado
├── Template de Agente da plataforma (0..N) ──── somente leitura; instanciável (Proveniência)
│     └── "Assistente padrão" ──── instanciado obrigatoriamente em cada ET
├── Habilidade da plataforma (0..N)  ·  Ferramenta da plataforma (0..N)

Espaço de Trabalho (1) ──── referencia Assistente padrão (1)
├── Agente (1..N)  [rascunho | ativo | pausado | arquivado | na lixeira]
│   ├── Proprietário (Membro, 1) · Criador (Membro | Sistema) · Papel (1; nunca de governança)
│   ├── Nome · Descrição · Política de retenção de Memória · Limite de custo (0..1) · Proveniência (0..1)
│   ├── Versão de Agente (1..N, imutáveis; corrente = maior número)
│   │   ├── Objetivo · Instruções · Modelo (1 | padrão da plataforma) · Admite sobrescrita de Modelo · Nível de autonomia
│   │   ├── Ferramentas permitidas (0..N) ──── executar ──▶ Ferramenta (Catálogo)
│   │   ├── Habilidades concedidas (conjunto por identidade) ──▶ Concessão de Habilidade (ET) ──▶ Habilidade
│   │   ├── Política de aprovação (aprovadores 0..N; tempo limite) · Profundidade máxima de invocação
│   │   └── Ator · Motivo · Momento
│   ├── Memória do Agente (1)
│   │   └── Item de Memória (0..N) ── Conteúdo · Execução de origem · Delegante de origem (0..1) · Registros referenciados
│   ├── Execução de Agente (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]
│   │   ├── Versão · Modelo usado · Origem (Sessão | ação direta | Automação | Agente | Caixa de Entrada)
│   │   ├── Ator invocador (1) · Ator delegante (0..1: Membro | Automação) · Cadeia de Execuções · Execução pai (0..1) · Sessão de origem (0..1)
│   │   ├── Registro âncora (0..1) · Entrada · Nível de autonomia efetivo · Composição do Contexto (referências)
│   │   ├── Passo (0..N, ordenados, sem identidade)
│   │   │   ├── chamada de Ferramenta ── permissão avaliada ×2 (DO-HAB-14) · classe de efeito · Registro de Atividade
│   │   │   │     └── "invocar Agente" ──▶ Execução filha (outro Agente; sem ciclo; profundidade ≤ limite)
│   │   │   ├── Exercício de Habilidade (DO-HAB-11) ── Passos aninhados
│   │   │   ├── Solicitação de Aprovação ──▶ (entidade, abaixo)
│   │   │   ├── raciocínio · memorização
│   │   ├── Solicitação de Aprovação (0..N)  [pendente | aprovada | rejeitada | expirada | cancelada]
│   │   │     └── motivo (autonomia | permissão | limite) · objeto fixo · aprovador (Membro ativo) · Decisor · prazo
│   │   ├── Saídas · Referências de Conhecimento (0..N) · Itens de Memória produzidos · Custo · Motivo de término
│   │   └── marcação: ensaio (efeitos simulados)
│   ├── (derivado) Disponibilidade · Conhecimento acessível · Habilidades disponíveis · Responsabilidades
│   ◀── Tarefa.Responsável (0..N) · Conversa.Atribuído (0..N) · Sessão de Chat.principal (0..N)
│   ◀── Automação.Ação "invocar Agente" (0..N) · Coleção.concessão (0..N) · Recurso.concessão/compartilhamento
├── Template de Agente do ET (0..N) ──── criado a partir de Agente (Proveniência); sem Memória/Execuções
└── Registro de Atividade (Ator = Agente, delegante = Membro | Automação | vazio)

Invocação:  Membro (Sessão | ação direta) ─┐
            Automação (Ação) ──────────────┼──▶ Execução de Agente ──▶ Passos ──▶ efeitos (sob interseção A9.3, B22, B23)
            Caixa de Entrada (Atribuído) ──┤
            Agente (Ferramenta) ───────────┘        (o Agente NUNCA dispara sozinho — INV-AGE-14)
```

## 24. Decisões ontológicas

- **DO-AGE-01.** Agente é entidade de IA configurável com identidade, Proprietário Membro, Papel, Ferramentas permitidas, Habilidades concedidas, Conhecimento acessível (derivado), nível de autonomia, Memória e Execuções; é Ator (A6.1) e Sujeito (A6.3, A9.1); não tem Gatilho — é invocado por Membro, Automação, Caixa de Entrada ou outro Agente. Aplica A6, A7, A9, B7, B15, B16, B17, B22. CONSOLIDADA.
- **DO-AGE-02.** Versionamento (B24; B74): toda alteração de objetivo, instruções, Modelo, Admite sobrescrita de Modelo, Ferramentas permitidas, conjunto de Habilidades concedidas (por identidade), nível de autonomia, Política de aprovação, Profundidade máxima de invocação ou Memória habilitada cria uma Versão de Agente imutável (cópia completa, Ator, Motivo), válida a partir da próxima Execução; Versões nunca são fixadas por terceiros nem eliminadas enquanto o Agente existir. Nome, descrição, Proprietário, Papel, Política de retenção e Limite de custo não são versionados. Publicar nova versão de Habilidade não versiona o Agente; eliminar Habilidade concedida versiona (Sistema). Justificativa: só o que altera comportamento precisa ser reproduzível; governança e rótulos têm Registro de Atividade. RECOMENDADA.
- **DO-AGE-03.** Nome de Agente é único entre Agentes não `na lixeira` do Espaço de Trabalho (padrão B39, DO-HAB-16), porque Automações, Habilidades, Membros e outros Agentes o referenciam por nome. RECOMENDADA.
- **DO-AGE-04.** O Agente referencia exatamente um Modelo principal **ou** o marcador `padrão da plataforma`, resolvido no início de cada Execução; a Execução grava sempre o Modelo concreto. Não existe estado `degradado`: Modelo descontinuado, cota atingida e suspensão tornam a **Disponibilidade** (derivada) `indisponível` com motivo, sem alterar o estado de ciclo de vida; a substituição de Modelo explícito é sempre ato de Membro (nova Versão). Justificativa: a causa é externa e derivável; gravar estado duplicaria o fato e exigiria reversão manual; o marcador `padrão da plataforma` mantém o Assistente padrão e Agentes simples operantes através de descontinuações. RECOMENDADA; impacto no documento 15 (Modelo declara descontinuação e sucessor; plataforma designa o Modelo que resolve `padrão da plataforma`).
- **DO-AGE-05.** O Agente nasce com Papel **Convidado** (nada por origem "papel") e obtém acesso por concessões diretas, compartilhamentos e, se um Administrador o decidir, Papel Membro ou personalizado de base Membro/Convidado (B30; INV-ET-13). Justificativa: menor privilégio; um Agente com Papel Membro por padrão veria todo o CRM no primeiro minuto. Atribuir Papel a Agente é governança (RN-ET-24). RECOMENDADA.
- **DO-AGE-06.** Nível de autonomia efetivo da Execução = mínimo entre o do Agente e o imposto pelo invocador (Automação — B22; Agente invocador), fixo do início ao fim; aprovação decidida **por Ferramenta invocada** pela classe de efeito (DO-HAB-13, DO-HAB-18): `assistido` aprova tudo que não é `leitura`; `supervisionado` aprova `escrita irreversível` e `externa`; `autônomo` nada. "invocar Agente" tem classe `escrita reversível`. RECOMENDADA.
- **DO-AGE-07.** Memória do Agente: entidade interna 1:1, com Itens de Memória (Conteúdo, Execução de origem, Delegante de origem 0..1, Registros referenciados, momentos), escrita só pelas Execuções do próprio Agente ou por Membro com `editar`; legível por `ver`, apagável por `editar`; sujeita a Política de retenção (objeto de valor, tetos da plataforma — C7). **Elegibilidade por delegante**: Item com Delegante de origem (só quando o delegante da Execução de origem era Membro) só entra no Contexto de Execuções com o mesmo delegante; Item sem delegante (Execução autônoma, inclusive com delegante Automação) entra em qualquer. A Memória do Agente pode reter fatos sobre registros, inclusive Contatos, sob C7 e C9, eliminados com o registro (RN-AGE-23) — assimetria deliberada com a Memória do Usuário (DO-CHT-11; B78, B86). Memória nunca é Conhecimento (DO-CNH-13) e nunca gera Referência de Conhecimento. Justificativa: fecha o vazamento entre delegantes sem inspecionar conteúdo. RECOMENDADA.
- **DO-AGE-08.** **Agente invoca Agente é permitido**, exclusivamente pela Ferramenta "invocar Agente" (permitida ao invocador; `executar` sobre o invocado pelo invocador e pelo delegante Membro; invocado `ativo`), criando Execução filha que herda o delegante e a **Cadeia de Execuções**, tem nível efetivo ≤ o da invocadora, permissão efetiva = interseção de todos os Agentes da Cadeia e do delegante Membro, e custo próprio. A **Cadeia de Execuções é única** (B79): sequência de Execuções de Automação e de Agente ligadas por disparo ou invocação, com Execução-mãe, profundidade total ≤ Limite imposto (recomendação: 5) e, dentro dela, subsequência contígua de invocações Agente → Agente ≤ sub-limite imposto (recomendação: 3), reduzível por Agente (Profundidade máxima de invocação); **sem Agente repetido** nem par (Automação, objeto) repetido na mesma Cadeia (auto-invocação proibida); `acionar Automação` continua a Cadeia (RN-AUT-19). Não há mensagem entre Agentes fora da relação pai–filha. Justificativa: composição de Agentes é útil (coordenador/especialistas) e, com Cadeia registrada, é auditável e não amplia acesso; sem limite e sem proibição de repetição, custo e permissão deixariam de ser computáveis (mesmo princípio de B3, RN-HAB-08); dois objetos de cadeia (um por documento) deixavam a composição Automação → Agente → Automação indefinida. RECOMENDADA.
- **DO-AGE-09.** Contexto é objeto de valor efêmero da Execução, reconstruído a cada Execução sob a permissão efetiva do Sujeito, nunca persistido em conteúdo; a Execução grava a **Composição do Contexto** por referência (registros, Arquivos, Fragmentos com Posição, Itens de Memória, Sessão), resolvida na leitura com a permissão de quem lê e com marcador quando eliminada. Justificativa: evita duplicar dados operacionais e Conhecimento sob a permissão da Execução (B19, B20). RECOMENDADA.
- **DO-AGE-10.** **Exceção a A4.1**: Agente tem estados `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira`. `rascunho`: não invocável (salvo ensaio), não designável; `pausado`: não aceita novas Execuções, Execuções em curso terminam, responsabilidades preservadas; `arquivado`/`na lixeira`: responsabilidades liberadas no ato. Desarquivar e restaurar da lixeira **nunca devolvem diretamente a `ativo`**: devolvem `pausado` quando o estado anterior era `ativo` ou `pausado`, e `rascunho` ou `arquivado` como estavam — exceção deliberada a B43, por segurança (nada volta a agir silenciosamente), idêntica à da Automação (RN-AUT-05; B94). Registrado em A4.1 como exceção de domínio. RECOMENDADA.
- **DO-AGE-11.** Solicitação de Aprovação é entidade interna da Execução **com identidade**, objeto fixo (Ferramenta + entrada completa), motivo `autonomia` (B22) ou `permissão` (alternativa de B23), ou `limite` (Limite de operações por Execução — DO-AUT-18), aprovador resolvido na criação pela ordem: delegante Membro `ativo` → Aprovador declarado na Ação "invocar Agente" da Automação (documento 19, 7.4) → aprovador configurado no Agente (Membro ou Equipe) → Proprietário do Agente → Proprietário do Espaço de Trabalho; decidível também por quem tem `administrar` no Agente; tempo limite obrigatório (padrão da plataforma **72 horas**, comum a toda Solicitação — B80; sobrescrevível pela Política de aprovação e pela Ação da Automação) → `expirada` e Execução `cancelada`. Aprovar **nunca concede permissão**: as duas verificações de DO-HAB-14 são refeitas na aprovação; no motivo `permissão`, só quem tem a permissão requerida aprova e torna-se delegante do Passo, registrado. Sucessão do aprovador por B28. Aplica A8, B22, B23. RECOMENDADA.
- **DO-AGE-12.** "Agente fornecido pela plataforma" é **Template de Agente da plataforma** (global, somente leitura, Habilidades por identidade — documento 18, 20.15); instanciar cria Agente `rascunho` do Espaço de Trabalho com Proveniência, sem vínculo vivo; o Assistente padrão é a instanciação obrigatória, `ativo`, na criação do Espaço de Trabalho (B33), com "restaurar padrão" como nova Versão. Templates de Agente do Espaço de Trabalho são criados a partir de Agentes (sem Memória, Execuções ou permissões). **Proposta de complemento a A1.3**: acrescentar "Template de Agente da plataforma" às entidades globais (ao lado de Habilidade e Ferramenta da plataforma — DO-HAB-02). RECOMENDADA.
- **DO-AGE-13.** **Ensaio**: Execução de Agente com marcação própria, permitida em `rascunho` e `ativo` por quem tem `editar`, em que Ferramentas de leitura executam e toda Ferramenta de escrita é simulada (Passo com resultado `simulado`, sem efeito e sem Registro no registro-alvo); consome custo; nunca grava Memória; Painéis a separam. Resolve a questão 25.5 do documento 18. RECOMENDADA.
- **DO-AGE-14.** Este documento fixa, para os documentos 15, 16 e 19: a Execução de Agente (7.2, 11.2, 12.3), o Passo (7.3), o Contexto por referência (DO-AGE-09), a Memória do Agente (DO-AGE-07), a Solicitação de Aprovação (DO-AGE-11), a Cadeia de Execuções (DO-AGE-08; B79), o nível efetivo (DO-AGE-06), o Modelo `padrão da plataforma` (DO-AGE-04) e o ensaio (DO-AGE-13). Execuções originadas em Sessão de Chat são Execuções de Agente (uma por turno do Agente), com a Mensagem de Chat `assistente` como saída; Execuções de Automação contêm Execuções de Agente e nunca o inverso. RECOMENDADA.
- **DO-AGE-15.** O Agente **não herda permissões do Proprietário, que tampouco é teto**: é Sujeito com Papel e concessões próprias. Assimetria deliberada com a Automação, para a qual o Proprietário é teto (DO-AUT-01; B88): a Automação é regra publicada por um Membro, e o teto impede escalada por configuração; o Agente é sujeito governado por Papel e concessões, e um teto o faria mudar de alcance a cada transferência. Justificativa: transferência e sucessão de propriedade não podem alterar silenciosamente o acesso de um Agente. RECOMENDADA.
- **DO-AGE-16.** Pausar, arquivar ou excluir Agente não cancela Execuções em curso (terminam na Versão carregada); cancelam apenas: ato sobre a Execução (Membro com `administrar` ou delegante), suspensão do Espaço de Trabalho (B31), transferência da Conversa (documento 14), expiração de aprovação, cota e cancelamento em cascata pela Execução de Automação mãe (INV-AUT-09). Cancelar nunca reverte Passos já executados. Aplica B18, DO-HAB-17, RN-ET-17. RECOMENDADA.
- **DO-AGE-17.** Só Agente `ativo` é designado Responsável ou Atribuído; `pausado` preserva; `arquivado` e `na lixeira` liberam no ato com evento por registro e redistribuição de Conversas; a restauração não devolve responsabilidades. Agente Atribuído é invocado pela Caixa de Entrada (Origem `Caixa de Entrada`, sem delegante) a cada Mensagem recebida; Agente Responsável não é invocado pela Tarefa (RN-TAR-27). Aplica B7, RN-CXE-12, RN-CXE-24. RECOMENDADA.
- **DO-AGE-18.** Custo é objeto de valor da Execução (consumo de Modelo por Modelo, chamadas por classe de efeito, filhas, duração), nunca do Agente; cota de IA é Limite imposto (B34) e Limite de custo do Agente é configuração limitante dentro dela; atingir limite faz a Execução `falhou` (motivo "cota") e rejeita novas, com evento, sem suspensão automática (RN-ET-23). Aplica C8 no que é ontológico; a política permanece aberta. RECOMENDADA.

Nenhuma decisão contradiz A1–A9 ou B1–B99. DO-AGE-10 está registrada em A4.1 e B94; DO-AGE-12 está incorporada a A1.3 e B81; DO-AGE-08 está consolidada em B79; DO-AGE-04, DO-AGE-14 e DO-AGE-15 fixam o que os documentos 15, 16 e 19 herdam. As decisões RECOMENDADAS deste documento estão consolidadas na constituição como B74–B82 e B94.

## 25. Questões em aberto

1. **Política de Memória do Agente** (C7). DO-AGE-07 fixa a estrutura e a elegibilidade por delegante; restam decisões de produto e jurídicas: prazo padrão, se Itens com delegante são retidos por padrão, se Memória vinda de Execução autônoma pode servir a delegantes que não veem a origem (20.11), consentimento, e o que o Agente deve declarar ao usar Memória.
2. **Modelos secundários por Ferramenta ou modalidade** (C27). O Agente tem um Modelo principal (DO-AGE-04). Habilidades multimodais (áudio, imagem) podem exigir Modelo distinto; alternativas: (a) trocar o Modelo principal; (b) 0..N Modelos secundários por Capacidade na Versão; (c) a plataforma resolve internamente. Impacta o documento 15 e DO-HAB-10.
3. **Limites de concorrência e de filhas por Execução** (C8). Sem limite ontológico; recomendação de Limite imposto para Execuções concorrentes por Agente e filhas diretas por Execução (RN-AGE-13 só limita profundidade e repetição).
4. **Retenção de Execuções** (C28). Execuções acumulam Passos e Composições de Contexto; a Política de retenção de Execuções é da plataforma (12.3); decidir prazo, o que sobrevive (Solicitações decididas, custo agregado) e a relação com Painéis históricos.
5. **Limite de Conversas por Agente Atribuído.** O Limite de Conversas por Atendente da Fila aplica-se a Membros (documento 14); Agentes não têm teto ontológico. Decidir se a Fila limita Agentes (por custo) ou se a cota basta.
6. **Nível de autonomia inicial do Assistente padrão.** Recomendado `supervisionado` (12.1); `assistido` é mais seguro e mais custoso em aprovações; decisão de produto sem impacto ontológico.
7. **`criar` Agente por Membro por padrão.** Recomendado por concessão (17.2); organizações pequenas preferirão que todo Membro crie Agentes próprios (escopo `próprios`). Decisão de produto.
8. **Aprovação obrigatória por Recurso** (C30; documento 20, 25.7). Uma Coleção, Lista ou Fila poderia exigir aprovação para qualquer escrita de Agente independentemente do nível — ampliação de B22 "por Recurso". Se adotada, a Solicitação ganha motivo `recurso` e a Política de aprovação do Recurso entra na ordem de 7.8.

Resolvidas neste documento com recomendação, sem pendência aberta: Agente invoca Agente (permitido, em Cadeia de Execuções única — DO-AGE-08; B79); Modelo indisponível (Disponibilidade derivada, sem estado — DO-AGE-04); Agente cria/edita Agente ou a si próprio (proibido — INV-AGE-03/04); Papel inicial (Convidado — DO-AGE-05); ensaio (DO-AGE-13); herança de permissões do Proprietário (não — DO-AGE-15). Recebidas da revisão da fase 4: delegante Automação (DO-AUT-15; RN-AGE-11); Aprovador e Tempo limite na Ação "invocar Agente" (7.8); cancelamento pela mãe (DO-AGE-16); atributo Admite sobrescrita de Modelo (6.2); restauração a `pausado` (B94); tempo limite único de 72 horas (B80); lista de B64 e motivo `limite` (RN-AGE-12; 7.6).
