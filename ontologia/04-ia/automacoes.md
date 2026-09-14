# AUTOMAÇÃO

> Domínio: IA | Documento 19 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

Uma **Automação** é um mecanismo **determinístico ou híbrido** de reação, definido pela organização em um **escopo**, que responde a um **Gatilho** avaliando **Condições** e executando uma sequência ordenada de **Ações** (B16). Sem IA, a cadeia é GATILHO → CONDIÇÃO → AÇÃO; com IA, é GATILHO → CONDIÇÃO → AGENTE → AÇÃO, porque toda execução de IA passa por um Agente (B17): a Automação invoca o Agente, recebe a sua saída e continua.

A Automação é um **Ator** (A6.1) e um **sujeito de autorização** (A6.3): pratica ações registráveis com permissões próprias, nunca acima das de um humano. Diferencia-se dos seus vizinhos por três propriedades:

1. **Reage; não raciocina.** Um Gatilho a dispara; Condições e Ações são avaliadas sempre da mesma maneira para a mesma entrada. Quando precisa de interpretação (classificar uma Mensagem, decidir um texto), delega a um Agente e volta a ser determinística sobre a saída estruturada dele. O Agente raciocina; a Automação encadeia.
2. **Tem Gatilho; Habilidade e Ferramenta não têm.** A Habilidade é competência exercida por Agente (documento 18); a Ferramenta é operação atômica (DO-HAB-13). A Automação é o único elemento do domínio IA que **começa sozinho**, a partir de um Evento, de um agendamento ou de um acionamento.
3. **É configuração com identidade, versão e estado operacional.** Como Agente e Habilidade, é versionada (B24). Diferentemente da Habilidade, tem Proprietário (A7), permissões, Execuções (B18) e estados próprios de operação (`ativo`, `pausado`).

A Automação **pertence ao Espaço de Trabalho** (documento 01, seção 8) e **referencia exatamente um escopo** — Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada ou Fila (B41; DO-CXE-16) — que delimita o que o seu Gatilho enxerga, não o que as suas Ações alcançam (DO-LIS-13).

## 2. Propósito

- **Eliminar trabalho de coordenação repetitivo.** "Ao ganhar o Negócio, criar a Tarefa de onboarding"; "Mensagem recebida fora do horário, responder com modelo"; "Tarefa vencida, notificar o Responsável". Sem Automação, cada regra operacional depende de alguém lembrar.
- **Dar previsibilidade à operação.** Uma Automação faz sempre o mesmo, com registro de cada passo. É o instrumento pelo qual a organização transforma política em comportamento auditável.
- **Ligar os domínios.** Estrutura de Trabalho, CRM e IA são pares (A2.2) e só se relacionam por associação. A Automação é o mecanismo que faz um Evento de um domínio produzir efeito em outro (Conversa → Tarefa; Negócio → Mensagem; Execução de Agente → Etapa).
- **Governar a IA no tempo.** Agentes não invocam Automações (B16) nem agem "sozinhos" fora de uma Execução; a Automação é o que decide **quando** um Agente é chamado, **com que Habilidade** e **com que autonomia máxima** (B22).
- **Fornecer a Painéis e à auditoria um objeto estável.** Cada Execução de Automação registra Gatilho, versão, passos, resultado, Execuções de Agente filhas e custo (B18; C8).

## 3. Natureza da entidade

- **Entidade com identidade própria**, pertencente ao Espaço de Trabalho (pertencimento, não contenção estrutural: a Automação é raiz do próprio agregado e o Espaço de Trabalho é o seu escopo de existência, A1.1).
- **Ator** (A6.1) e **Sujeito de autorização** (A6.3, A9.1) com **Papel e concessões próprias**, análogo ao Agente, com o Proprietário como teto de permissões (DO-AUT-01; B88).
- **Configuração versionada** (B24): o agregado contém **Versões de Automação** (entidade interna, 7.1), cada uma com Gatilho, Condições, Ações, Política de erro e Regra de Agendamento como **objetos de valor**.
- **Agregado com estado operacional**: contém **Execuções de Automação** (entidade interna com identidade e ciclo de vida próprio, B18; 7.7).
- **Associada por referência** ao escopo (B41), ao Proprietário (A7), aos Agentes invocados, às Habilidades indicadas, às Ferramentas do Catálogo, às Integrações chamadas e aos registros-alvo das Ações.
- **Não é** contêiner, Habilidade, Ferramenta, Agente, Integração, Template, Visualização nem regra estrutural da plataforma (seção 4).

## 4. Fronteira conceitual

### O que é

- Uma regra **reativa** (Gatilho → Condições → Ações), definida em um escopo, com Proprietário, versão, permissões próprias e Execuções.
- Um **Ator**: os Registros de Atividade das suas Ações têm ator = Automação e ator delegante = Proprietário (ou o acionador, no Gatilho manual — 17.3).
- Um **orquestrador determinístico** de Ferramentas e de Agentes: toda Ação de escrita é uma Ferramenta do Catálogo (DO-HAB-13); toda IA é um Agente invocado (B17).
- Um **objeto de governança humana**: criada, publicada, pausada e arquivada por Membros; nunca por Agente nem por outra Automação (INV-AUT-10).

### O que não é

- **Não é Agente.** Não tem Modelo, Memória, instruções, Habilidades concedidas nem raciocínio; não decide o que fazer, só faz o que a versão publicada diz (4.1).
- **Não é Habilidade.** Não é competência exercida; é reação que pode pedir a um Agente que exerça uma competência (4.2; B17).
- **Não é Ferramenta nem Ação.** A Ferramenta é uma operação atômica; a Ação é o uso de uma Ferramenta (ou um passo de controle) dentro de uma Automação; a Automação é o todo (4.3).
- **Não é regra estrutural da plataforma.** Transições de Status, Requisitos de Etapa, cascata de estado, Regra de Recorrência e herança de configuração são comportamentos fixos da plataforma, não Automações (4.4).
- **Não é Regra de Recorrência** (4.5) nem **Gatilho de agendamento** por si (4.6).
- **Não é Integração.** A Integração é conexão; a Automação pode chamá-la por Ferramenta (4.7).
- **Não é Template** (4.8) nem **Visualização** (uma Visualização filtra, não age).
- **Não é Execução.** A Execução é a instância de funcionamento, contida pela Automação (4.9).
- **Não é disparada por Painel nem age sobre Painel.** O Painel não emite Eventos consumíveis por Gatilho, não é escopo (B41) nem Recurso de Ação; "Métrica abaixo de X" é Gatilho `condição temporal` sobre as entidades (DO-AUT-03; DO-PAI-17; RN-PAI-25). A Automação não lê Painel — não há Ação "ler Painel"; um Agente que ela invoque pode usar a Ferramenta `ler Painel` com as próprias permissões (documento 21, 17.4).

### 4.1 Automação × Agente

| Critério | Automação | Agente |
| --- | --- | --- |
| Início | **Gatilho** (Evento, agendamento, acionamento). Começa sozinha. | **Invocação** (por Automação, por Membro em Sessão de Chat ou ação direta, pela Caixa de Entrada quando Atribuído a Conversa, ou por outro Agente — INV-AGE-14). Nunca começa sozinho. |
| Comportamento | **Determinístico**: mesma entrada, mesmos passos. Híbrida quando um passo é um Agente. | **Raciocínio**: interpreta instruções, escolhe Ferramentas, compõe saída; não determinístico. |
| Configuração | Gatilho, Condições, Ações, Política de erro. | Objetivo, instruções, Modelo, Habilidades, Ferramentas permitidas, Conhecimento, autonomia. |
| Autonomia | Não tem nível de autonomia próprio: aprovação decorre da classe de efeito de cada Ferramenta e da Ação "solicitar aprovação"; **impõe** ao Agente invocado autonomia menor ou igual (B22). | Tem nível de autonomia (`assistido`, `supervisionado`, `autônomo`). |
| Execução | Execução de Automação, que **contém** 0..N Execuções de Agente (B18). | Execução de Agente, filha quando invocada por Automação. |
| Relação | Invoca Agente. | Nunca invoca Automação; pode **acionar** um Gatilho manual por Ferramenta (20.1) e produz Eventos que Gatilhos escutam (B16). |

### 4.2 Automação × Habilidade

Registrada no documento 18, 4.2, e adotada aqui sem alteração: a Automação tem Gatilho, escopo e Execução própria; a Habilidade não tem nenhum dos três. A Ação "invocar Agente" pode **indicar** 0..1 Habilidade a exercer; a Automação nunca invoca a Habilidade diretamente (B17; INV-HAB-09).

### 4.3 Automação × Ferramenta × Ação

| Conceito | O que é | Quem define | Tem Execução? |
| --- | --- | --- | --- |
| **Ferramenta** | Operação atômica do Catálogo (plataforma ou Integração), com contrato, Recurso-alvo, permissão requerida e classe de efeito (DO-HAB-13). | Plataforma / Integração. | Não; gera Registro de Atividade por invocação. |
| **Ação** | Passo ordenado de uma Versão de Automação: **invocação de uma Ferramenta** com parâmetros (fixos ou derivados do Contexto da Execução) **ou Ação de controle** (ramificar, aguardar, solicitar aprovação, invocar Agente, notificar). Objeto de valor (7.4). | Membro que edita a Automação. | Não; é passo de uma Execução de Automação. |
| **Automação** | Gatilho + Condições + Ações + Política de erro, em um escopo, com Proprietário e versão. | Membro. | Sim (Execução de Automação). |

Fórmula adotada pelo Glossário (DO-AUT-05; B91): **toda Ação de escrita É uma invocação de Ferramenta**; as Ações de controle não são Ferramentas (não têm Recurso-alvo nem classe de efeito) e existem apenas dentro de Automações.

### 4.4 Automação × comportamento estrutural da plataforma ("workflow implícito")

| Comportamento | Natureza | Configurável como Automação? | Gera Execução de Automação? |
| --- | --- | --- | --- |
| Transição de Status de Tarefa (categorias, status inicial padrão, mapeamento) | Regra estrutural (A4.2, A4.3, B45). | Não. A Automação pode **reagir** a "status alterado" e **executar** "alterar status". | Não. |
| Requisito de Etapa e Transições permitidas (Funil) | Validação síncrona e bloqueante (DO-FUN-06). | Não. Faz uma Ação da Automação **falhar** (20.10). | Não. |
| Cascata de estado (arquivar, lixeira; estado efetivo) | Derivação (B36). | Não. | Não. |
| Regra de Recorrência de Tarefa | Objeto de valor da Tarefa; gera ocorrências (B6). | Não (4.5). | Não. |
| Herança de configuração (B25) | Resolução pelo caminho. | Não. | Não. |
| Distribuição de Conversas por Fila (rodízio, menor carga) | Regra operacional da Fila (documento 14, 7.4). | Não; Automação pode **atribuir** explicitamente. | Não. |
| Sucessão de Proprietário (B28), Mesclagem (B14) | Operações da plataforma. | Não. | Não. |

Critério único: o que a plataforma faz **sempre, para todo Espaço de Trabalho, sem que ninguém tenha criado uma regra** é comportamento estrutural. O que **só acontece porque um Membro definiu Gatilho, Condições e Ações** é Automação. Comportamentos estruturais emitem Eventos que Automações consomem; nunca são Automações "ocultas" nem geram Execução.

### 4.5 Automação × Regra de Recorrência

A Regra de Recorrência é objeto de valor **de uma Tarefa** que faz a plataforma gerar a próxima ocorrência da **mesma série** (B6). Não tem Gatilho, Condições nem Ações; produz sempre o mesmo efeito (nova Tarefa com Proveniência) sobre a própria série. Uma Automação de agendamento que "cria uma Tarefa toda segunda" produz Tarefas **sem série** (Proveniência "criada por Automação X, Execução Y"), sem Ocorrência corrente e sem "encerrar série". A ontologia mantém ambas porque respondem a perguntas diferentes: "esta Tarefa se repete" (Recorrência) versus "toda segunda, faça isto" (Automação).

### 4.6 Automação × Gatilho de agendamento × Regra de Recorrência de Tarefa

| | Gatilho de agendamento | Regra de Recorrência |
| --- | --- | --- |
| Pertence a | Versão de Automação (objeto de valor Regra de Agendamento, 7.2). | Tarefa (objeto de valor). |
| Produz | Execução de Automação, que pode fazer qualquer coisa. | Nova Tarefa da série, sempre. |
| Fuso | Localidade do Espaço de Trabalho (RN-AUT-17). | Idem (documento 06). |
| Suspensão (B31) | Ocorrências perdidas não são repostas. | Idem, por analogia (documento 01, 20.7). |
| Objeto | Nenhum objeto de Gatilho; a Condição pode selecionar registros do escopo (7.3). | A Tarefa corrente. |

### 4.7 Automação × Integração

A Integração é **conexão** configurada com sistema externo, sem Proprietário, com Membro configurador (B35). Ela **expõe Ferramentas** ao Catálogo (DO-HAB-13) e **emite Eventos** (Canal: Mensagem recebida; Integração de Conhecimento: Atualização). A Automação **usa** a Integração por Ferramenta (Ação "chamar Integração" = invocar Ferramenta de origem `Integração`, classe `externa`) e **escuta** os seus Eventos. Integração `desconectada` torna a Ação inoperante: falha transitória sujeita a retentativa limitada (RN-AUT-14).

### 4.8 Automação × Template

A8 não prevê Template de Automação e este documento não o cria (DO-AUT-16). Automações de escopo Espaço, Pasta, Subpasta e Lista são **carregadas** por Templates de contêiner (documento 02, 15.4): instanciar o Template cria Automações novas, com Proveniência, sem vínculo vivo. Reutilizar uma Automação isolada é **duplicar** (nova identidade, versão 1 `rascunho`, Proveniência).

### 4.9 Execução de Automação × Execução de Agente

| | Execução de Automação | Execução de Agente |
| --- | --- | --- |
| Pertence a | Automação. | Agente. |
| Origem | Gatilho (Evento, agendamento, manual, condição temporal). | Invocação (Automação, Membro, Caixa de Entrada, outro Agente). |
| Conteúdo | Passos determinísticos (Condições avaliadas, Ações com resultado), Execuções de Agente filhas. | Passos de raciocínio, Ferramentas chamadas, Exercícios de Habilidade (DO-HAB-11). |
| Relação | **Pai** de 0..N Execuções de Agente (B18). | **Filha** de 0..1 Execução de Automação. |
| Aprovação | Ação "solicitar aprovação" ou Ferramenta cuja classe de efeito exige aprovação. | Por Ferramenta, conforme nível de autonomia efetivo (B22). |
| Cancelamento | Cancelar a mãe cancela as filhas em andamento. | Cancelar a filha faz o passo "invocar Agente" da mãe falhar, sujeito à Política de erro. |
| Custo | Soma dos próprios passos e das filhas (C8). | Próprio. |

## 5. Identidade

A Automação tem **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade.

**Teste de identidade.** Se o nome, a descrição, o Gatilho, as Condições, as Ações, a Política de erro, o Proprietário (por transferência ou sucessão), o Papel e as concessões mudarem — por novas versões ou por atos sobre a Automação —, continua sendo a mesma Automação: as Execuções passadas continuam a referenciá-la (com a versão da época), o escopo continua a listá-la, os Painéis continuam a contá-la, os Registros de Atividade continuam a tê-la como ator. A identidade é a **continuidade da regra como objeto de governança**, não o seu conteúdo.

Consequências:

- **Versão não é identidade** (7.1). Execuções referenciam (Automação, versão).
- **Escopo é imutável** (RN-AUT-02). Uma Automação "da Lista X" não passa a ser "da Lista Y": isso é outra Automação (duplicar e arquivar a original). Justificativa: o escopo define o universo de Eventos que a Automação viu ao longo da vida; trocá-lo tornaria as Execuções passadas incomparáveis com as futuras e contornaria a governança de quem administra cada contêiner (17.1). O escopo acompanha o contêiner quando este é **movido** (B40): a identidade do contêiner é a mesma, logo o escopo é o mesmo.
- **Nome não é identidade**, mas é **único** entre Automações `rascunho`, `ativo`, `pausado` ou `arquivado` do mesmo escopo, sem distinção de maiúsculas e espaços nas extremidades (RN-AUT-03), porque Registros de Atividade, Painéis e Ferramentas de acionamento manual a referenciam por nome dentro do escopo (padrão B39). `na lixeira` não reserva.
- **Uma Automação nunca muda de Espaço de Trabalho** (A1.1).

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Opaco, imutável (seção 5). |
| Espaço de Trabalho | referência | sim | Pertencimento; imutável (A1.1). |
| Escopo | referência (tipo + identidade) | sim | Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada ou Fila (B41; DO-CXE-16). Imutável (RN-AUT-02). |
| Nome | nativo | sim | Único no escopo entre não `na lixeira` (RN-AUT-03). Atributo da Automação, não da Versão. |
| Descrição | nativo | não | Finalidade em linguagem natural. |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7); sucessão por B28. Teto de permissões (INV-AUT-04). |
| Papel | referência (Papel) | não | Papel atribuído à Automação como Sujeito (DO-AUT-01); nunca Proprietário nem Administrador nem base neles (B30 por analogia ao Agente). Sem Papel, só concessões diretas. |
| Concessões | permissões | 0..N | Concessões diretas e compartilhamentos em que a Automação é Sujeito. |
| Natureza | derivado | — | `determinística` (nenhuma Condição híbrida e nenhuma Ação "invocar Agente" na Versão vigente) ou `híbrida`. |
| Estado | nativo | sim | `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira` (seção 11; DO-AUT-09). |
| Versão vigente | derivado (referência a Versão) | não | A Versão `publicada`, 0..1. Vazia em `rascunho`. |
| Versões | entidades internas | 1..N | Seção 7.1. |
| Execuções | entidades internas | 0..N | Seção 7.7. |
| Reage a Eventos de Automações | nativo (booleano) | sim | Padrão **falso**: Eventos cujo ator é uma Automação (esta ou outra) não disparam o Gatilho (DO-AUT-11). Verdadeiro habilita encadeamento explícito, ainda sujeito ao limite de cadeia; nunca habilita reagir aos **próprios** Eventos (INV-AUT-08). |
| Criador | referência (Ator) | sim | Membro; imutável (A7). Nunca Agente nem Automação (INV-AUT-10). |
| Proveniência | objeto de valor | condicional | Template de contêiner ou Automação de que foi duplicada (identificador, nome, versão à época). Sem vínculo vivo. |
| Estado anterior à exclusão | nativo | condicional | Preenchido enquanto `na lixeira`, com o estado que tinha (`rascunho`, `ativo`, `pausado`, `arquivado`); a restauração o devolve (padrão B43). |
| Momentos | nativo | sim | Criação, última alteração, última publicação, pausa, arquivamento, exclusão. |
| Última Execução; contagem por resultado | derivado | — | Consultas sobre as Execuções; alimentam Painéis. |

Os atributos que **definem o comportamento** pertencem à **Versão de Automação** e são imutáveis depois de publicados (7.1): Gatilho, Regra de Agendamento, Condições, Ações, Política de erro, Autonomia máxima imposta a Agentes. Alterá-los é criar nova versão (B24).

**Atributos analisados e rejeitados.** *Nível de autonomia da Automação*: a Automação não raciocina; o que "aprova" é a classe de efeito de cada Ferramenta e a Ação explícita; um nível próprio duplicaria B22 sem sujeito que o exerça (a Automação impõe autonomia máxima ao Agente invocado, o que é atributo da Ação, não da Automação). *Prioridade entre Automações*: a ordem é por objeto e por momento do Evento (RN-AUT-11); prioridade tornaria a ordem dependente de configuração de outras Automações, contra a previsibilidade da seção 2. *Escopo múltiplo*: rejeitado pela mesma razão de "um Gatilho por Automação" (DO-AUT-02).

## 7. Entidades internas ou componentes

### 7.1 Versão de Automação (entidade interna)

Componente do agregado com identificador local (número sequencial a partir de 1, único dentro da Automação), referenciado de fora sempre junto com a Automação ("Automação X, versão Y" — B24).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Número | nativo | sim | Sequencial, nunca reutilizado. |
| Estado da versão | nativo | sim | `rascunho` (editável; não executável), `publicada` (imutável; a vigente; **no máximo uma** por Automação), `obsoleta` (imutável; não executável; preservada para Execuções passadas). |
| Gatilho | objeto de valor | sim para publicar | Seção 7.2. Exatamente um (DO-AUT-02). |
| Condições | objeto de valor | sim (pode ser vazio) | Seção 7.3. Vazio significa "sempre". |
| Ações | objeto de valor (lista ordenada) | sim (≥ 1 para publicar) | Seção 7.4. |
| Política de erro | objeto de valor | sim | Seção 7.5. |
| Autonomia máxima imposta | nativo (enumeração) | não | `assistido`, `supervisionado` ou `autônomo`; aplica-se a toda Ação "invocar Agente" da versão que não declare a própria. O Agente executa com min(próprio, imposto) (B22). |
| Publicador | referência (Membro) | condicional | Membro que publicou; rastreabilidade. |
| Momentos | nativo | sim | Criação, publicação, obsolescência. |

Diferença deliberada em relação à Habilidade (DO-HAB-04; DO-AUT-19): a Automação tem **no máximo uma** Versão `publicada`, porque ninguém "fixa" versão de Automação — o Gatilho dispara sempre a vigente. Publicar nova versão torna a anterior `obsoleta` no mesmo ato; Execuções em andamento terminam na versão em que começaram (RN-AUT-08). No máximo uma `rascunho` por Automação.

### 7.2 Gatilho (objeto de valor da Versão)

Origem da Execução (Glossário). Quatro tipos (DO-AUT-03). Exatamente um por Versão (DO-AUT-02): quem precisa reagir a dois Eventos cria duas Automações — a alternativa ("vários Gatilhos por Automação") faz o objeto do Gatilho ter tipos diferentes por disparo, o que torna Condições e Ações ambíguas ("o Contato" de qual Evento?) e as Execuções incomparáveis.

| Tipo | O que dispara | Objeto do Gatilho | Observações |
| --- | --- | --- | --- |
| **evento** | Um **Evento do catálogo da plataforma** (seções 18 dos documentos de entidade) sobre uma entidade **do escopo ou dos seus descendentes** (B41): Tarefa criada, status alterado, Tarefa vencida, Responsável atribuído, Checklist concluído, Negócio entrou em Etapa, Negócio ganho/perdido, Valor alterado, Conversa criada, Mensagem recebida, Estado de conversa alterado, Conversa transferida, Contato criado, Qualificação alterada, Documento de Conhecimento publicado, Execução de Agente concluída/falhou, Tag aplicada, Valor de Campo alterado, entre outros. | O registro sobre o qual o Evento ocorreu e os dados essenciais do Evento (antes/depois, ator, ator delegante). | O catálogo de Eventos é da plataforma e cresce com ela; a ontologia exige que cada Evento tenha tipo de entidade-objeto e dados essenciais estáveis. Um Gatilho pode restringir por subtipo (ex.: "status alterado **para** categoria `concluído`"), o que é filtro do Gatilho, não Condição. |
| **agendamento** | Uma **Regra de Agendamento**: objeto de valor análogo à Regra de Recorrência (frequência, dias, horário, término), interpretada no fuso da Localidade do Espaço de Trabalho (RN-AUT-17). | Nenhum objeto. A Execução parte de um **conjunto de registros do escopo** selecionado pelas Condições (7.3), ou de nada ("todo dia às 8h, enviar resumo"). | Ocorrências perdidas em suspensão não são repostas (B31). |
| **manual** | Acionamento explícito por **Membro** (com `executar` sobre a Automação) ou por **Agente** por meio da Ferramenta `acionar Automação` (com `executar`; RN-AUT-19), sobre um registro do escopo indicado no acionamento ou sem registro. | O registro indicado (0..1). | O acionador é registrado como Ator invocador da Execução e como ator delegante das Ações (17.3). |
| **condição temporal** | Avaliação **periódica** de um predicado temporal sobre registros do escopo: "Negócio parado na Etapa há X dias", "Conversa sem resposta há X horas", "Tarefa sem atualização há X dias". A plataforma avalia o predicado em intervalo definido como Limite imposto e dispara **uma vez por registro por entrada na condição** (RN-AUT-10). | O registro que passou a satisfazer o predicado. | Não é Evento (nada "acontece" no registro); é derivado (documentos 13 e 14, seção 18: "não é evento do Funil/da Caixa"). Distinto do agendamento: aqui há objeto e a disparada é por registro. |

**Visibilidade do Gatilho.** Um Evento só é considerado disparado para a Automação se ela tem `ver` sobre o objeto do Evento (RN-ESP-20). Sem `ver`, nada dispara, nada falha, nada é registrado — a Automação não é canal de vazamento por efeito colateral (documento 02, 20.7).

### 7.3 Condição (objeto de valor da Versão)

**Predicado** avaliado sobre (a) o objeto do Gatilho, (b) os seus relacionados diretos (Lista e caminho da Tarefa; Funil, Etapa, Empresa, Contatos do Negócio; Canal, Fila, Contato principal da Conversa; Tarefa pai; Vínculos), (c) os dados do Evento (antes/depois, ator) e (d) o Contexto da Execução (momento, resultado de passos anteriores, saída de Agente). Composta por conjunção, disjunção e negação de **predicados atômicos**:

- comparação de atributo nativo (status, categoria de status, Prioridade, situação, estado de conversa, Etapa, Valor, datas) com operadores `=`, `≠`, `<`, `≤`, `>`, `≥`, `contém`, `está em`, `está vazio`, `mudou de/para`;
- comparação sobre **Valor de Campo** de uma Definição de Campo Personalizado **efetiva no escopo** (A5.2; B44): a Condição referencia a Definição por identidade; se a Definição deixar de existir, a Condição é inválida e a Execução `falhou` com Registro (RN-AUT-21);
- pertencimento: Tag aplicada, Responsável/Atribuído/Proprietário é Membro, Equipe ou Agente; Contato tem consentimento vigente para Finalidade (RN-CON-16);
- temporal: dia da semana e horário no fuso da Localidade; dentro/fora do Horário de atendimento (documento 14; subordinado a C12);
- **Condição híbrida**: um **passo de classificação por Agente** — a Automação invoca um Agente (com Habilidade indicada 0..1) cujo contrato de saída é **estruturado** (seleção única, booleano, número — DO-HAB-09) e compara a saída com valores. Marca a Automação como `híbrida`; gera Execução de Agente filha; o Agente executa com efeito `nenhum` esperado (Ferramentas de escrita são rejeitadas no passo de Condição — RN-AUT-06). Se a Execução de Agente falha, a Condição é indeterminada e a Execução de Automação `falhou` (20.8).

No Gatilho de **agendamento**, as Condições funcionam como **seleção**: "Negócios `aberto` do Funil com previsão vencida" produz o conjunto sobre o qual as Ações são executadas, uma vez por registro, na mesma Execução (RN-AUT-12).

Uma Condição **lê**; nunca escreve. Toda leitura respeita as permissões da Automação (17.4): um relacionado que a Automação não vê é tratado como ausente (mesmo princípio de RN-HAB-15).

### 7.4 Ação (objeto de valor da Versão; lista ordenada)

Cada Ação tem **ordem**, **tipo**, **parâmetros** (valores fixos ou expressões sobre o Contexto: "Contato principal do Negócio", "saída.qualificação", "Responsável da Tarefa") e um **alvo** (registro do Gatilho, relacionado, registro criado por Ação anterior, ou registro fixo por identidade). Dois grupos:

**Ações de escrita — sempre uma Ferramenta do Catálogo (DO-HAB-13; DO-AUT-05).** A Ação referencia a Ferramenta por identificador estável; a Ferramenta traz contrato, Recurso-alvo, permissão requerida e classe de efeito. Exemplos: alterar registro (status, Prioridade, datas, Etapa, situação, estado de conversa, Valor de Campo, Qualificação); criar registro (Tarefa, Subtarefa, Negócio, Contato, Comentário, Mensagem `interna`, Documento de Conhecimento); mover (Tarefa entre Listas; Negócio entre Etapas/Funis; Conversa entre Filas); atribuir (Responsável, Atribuído, Proprietário); aplicar/remover Tag; criar Vínculo; **criar Tarefa a partir de X** (Conversa, Negócio, Mensagem, Execução) — com Vínculo e Proveniência, como definido nos documentos 06, 12 e 14; **enviar Mensagem** em Conversa (classe `externa`; sujeita a janela, consentimento e Canal — RN-CXE-19, RN-CON-16); **chamar Integração** (Ferramenta de origem `Integração`; `externa`).

**Ações de controle — não são Ferramentas.**

| Ação | O que faz | Regras |
| --- | --- | --- |
| **ramificar** | Avalia uma Condição interna e segue um de dois ramos (cada ramo é uma lista ordenada de Ações). | Aninhamento máximo é Limite imposto (recomendação: 3 — DO-AUT-06). Ramos não convergem em variáveis: o Contexto após a ramificação é o do ramo executado. |
| **invocar Agente** | Cria Execução de Agente filha com Agente (1; padrão: Assistente padrão — B17), Habilidade indicada (0..1), entrada (conforme contrato), autonomia máxima imposta, **Aprovador** (0..1 Membro ou Equipe) e **Tempo limite de aprovação** (0..1) para as Solicitações da Execução filha. Aguarda o término; a saída estruturada entra no Contexto. | A Execução filha tem a Automação como ator delegante (DO-AUT-15) e o Agente executa com as **próprias** permissões (A9.3; execução autônoma), nunca com as da Automação; a Automação nunca concede Habilidade nem Ferramenta (INV-HAB-04). A Automação precisa de `executar` sobre o Agente (RN-AUT-07). O Aprovador declarado tem precedência sobre o configurado no Agente e cede só ao delegante Membro, que aqui não existe (DO-AGE-11; B80); sem Aprovador nem Tempo limite declarados, valem a Política de aprovação do Agente e o padrão da plataforma (72 horas). Habilidade não concedida ao Agente: a Ação falha (documento 18, 20.9). |
| **solicitar aprovação** | Cria Solicitação de Aprovação (A8) com aprovador (Membro, Equipe ou Papel resolvido a Membros `ativo`), objeto (o registro-alvo e a descrição do que virá), e tempo limite. A Execução passa a `aguardando aprovação`. | Aprovada: continua, com **reavaliação das Condições** (RN-AUT-16). Rejeitada ou vencida: `cancelada` com motivo. Sem aprovador `ativo` resolvível: Proprietário da Automação. |
| **aguardar** | Suspende a Execução por duração (até um máximo — Limite imposto) ou até um Evento sobre o objeto (ex.: "até o Contato responder"), com tempo limite obrigatório. | A Execução permanece `executando` em espera; o objeto pode mudar entretanto, por isso as Ações seguintes releem o estado (RN-AUT-15). Vencido o limite sem Evento: segue por um ramo "expirou" se declarado; senão, a Ação falha. |
| **notificar** | Envia notificação a Membros, Equipes, Responsáveis/Atribuído/Proprietário do objeto, ou ao Proprietário da Automação. | Notificação não é registro da ontologia; a Ação gera Registro de Atividade. Nunca notifica Contatos (isso é "enviar Mensagem"). |
| **encerrar** | Termina a Execução como `concluída` antes do fim da lista. | Usada dentro de ramos. |

**Limite de operações por Execução.** O número de escritas de uma Execução (contando as das Execuções de Agente filhas) é limitado por Limite imposto (B34); ao atingi-lo, a Execução passa a `aguardando aprovação` com Solicitação ao Proprietário, qualquer que seja a autonomia (RN-CON-20; DO-CON-13; RN-AUT-13). É o que impede que "para cada Contato da lista, enviar Mensagem" alcance dez mil Contatos por engano.

### 7.5 Política de erro (objeto de valor da Versão)

| Elemento | Valores | Padrão |
| --- | --- | --- |
| Ao falhar uma Ação | `interromper` (a Execução passa a `falhou`; Ações seguintes não executam; efeitos já produzidos **permanecem** — não há reversão automática) ou `continuar` (a Ação é marcada `falhou`, a Execução prossegue e termina `concluída com falhas`, resultado registrado como `concluída` com indicador de falhas parciais). | `interromper`. |
| Retentativa | Somente para **falhas transitórias de Ferramenta de Integração** (Integração `desconectada`/`com erro`, indisponibilidade do sistema externo): número de tentativas (≤ Limite imposto; recomendação: 3) e intervalo. Falhas de permissão, de validação (Requisito de Etapa, janela de mensageria, contrato) e de referência inválida **nunca** são retentadas: são determinísticas. | Sem retentativa. |
| Notificação de falha | Proprietário da Automação sempre (RN-AUT-18); opcionalmente outros Membros. | Proprietário. |

Não existe retentativa ilimitada nem "reexecutar automaticamente a Automação inteira": reexecução é ato humano (acionamento manual sobre o mesmo objeto) que cria Execução nova.

### 7.6 Regra de Agendamento (objeto de valor da Versão, condicional)

Presente quando o Gatilho é `agendamento` (DO-AUT-12): frequência (minutos, horas, dias, semanas, meses), dias da semana ou do mês, horário, data de início e término opcional, tudo no fuso da Localidade (RN-AUT-17). Frequência mínima é Limite imposto. Mesma família da Regra de Recorrência (Glossário), com semântica distinta (4.6).

### 7.7 Execução de Automação (entidade interna com identidade)

Registro de uma instância de funcionamento (B18; DO-AUT-07), pertencente à Automação, com identificador próprio e ciclo de vida (11.2).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Opaco; referenciável por Registros de Atividade, Solicitações de Aprovação, Execuções de Agente filhas, Painéis. |
| Automação; Versão | referência | sim | (Automação, número da versão) usada do início ao fim (RN-AUT-08). A Execução é eliminada com a Automação (12.4); os Registros de Atividade preservam o nome à época. |
| Gatilho disparador | objeto de valor | sim | Tipo; Evento (identificador do Evento, tipo, momento, ator, ator delegante) para `evento`; ocorrência para `agendamento`; acionador para `manual`; predicado e momento de entrada para `condição temporal`. |
| Objeto | referência (0..1; ou conjunto para agendamento) | condicional | Registro-objeto do Gatilho, por identidade, com tipo e nome à época. |
| Ator invocador | referência (Ator) | sim | `Sistema` para `evento`, `agendamento` e `condição temporal`; Membro ou Agente para `manual` (B18). |
| Ator delegante | referência (0..1) | condicional | Proprietário da Automação, ou o acionador manual (17.3). |
| Estado | nativo | sim | `pendente`, `executando`, `aguardando aprovação`, `concluída`, `falhou`, `cancelada` (B18; 11.2). |
| Motivo | nativo | condicional | Em `falhou` e `cancelada`: causa (Ação, Ferramenta, permissão negada, Requisito violado, ciclo detectado, limite, aprovação rejeitada/vencida, suspensão, arquivamento). |
| Passos | objeto de valor (lista) | sim | Um por Condição avaliada e por Ação executada: ordem, tipo, Ferramenta (se houver), entrada, resultado (`concluído`, `falhou`, `pulado`, `aguardando`, `cancelado`), permissão avaliada, Registro de Atividade gerado, momentos, tentativas. |
| Execuções de Agente filhas | referências | 0..N | Uma por "invocar Agente" e por Condição híbrida (B18). |
| Solicitações de Aprovação | entidades internas (com identidade — documento 17, 7.6) | 0..N | Geradas por Ações explícitas e implícitas e pelo Limite de operações. |
| Cadeia de Execuções | objeto de valor | sim | Sequência das Execuções (de Automação e de Agente) desde a raiz até esta, ligadas por disparo (Evento cujo ator é Execução anterior; acionamento por Agente) ou invocação: Execução-mãe (0..1), profundidade (0 na raiz) e, por elemento, o Agente ou o par (Automação, objeto). Único objeto de cadeia do domínio (B79; RN-AUT-09; DO-AGE-08). |
| Momentos | nativo | sim | Criação, início, fim; duração derivada. |
| Custo | nativo | sim | Recursos consumidos, incluindo os das filhas (C8). |

### 7.8 O que não é componente

Agente, Habilidade, Ferramenta, Integração, Solicitação de Aprovação (referenciada), o escopo, os registros-alvo, os Registros de Atividade e o Contexto são referenciados ou usados, nunca contidos (seção 21).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | Automação → ET | Raiz do agregado; eliminada com o ET (B32). |
| tem escopo em | Espaço de Trabalho / Espaço / Pasta / Subpasta / Lista / Funil / Caixa de Entrada / Fila | referência (essencial) | Automação → escopo | Exatamente um; imutável; inoperante com escopo não efetivamente `ativo`; **eliminada com o escopo** (B41; DO-CXE-16). Escopo Espaço de Trabalho nunca é eliminado sem eliminar a Automação. |
| tem Proprietário | Membro | referência (propriedade) | Automação → Membro | Exatamente um (A7); sucessão (B28); teto de permissões (INV-AUT-04). |
| tem Papel | Papel | referência | Automação → Papel | 0..1 (DO-AUT-01). |
| contém Versões | Versão de Automação | contenção (composição) | Automação → Versão | 1..N. |
| contém Execuções | Execução de Automação | contenção (composição) | Automação → Execução | 0..N; eliminadas com a Automação, inclusive quando esta é eliminada em cascata do escopo; os Registros de Atividade e os efeitos permanecem (B41, emendada por DO-AUT-17). |
| escuta Eventos de | entidades do escopo e descendentes | referência (por tipo) | Gatilho → tipo de Evento | O Evento não conhece a Automação; a disparada é derivada. |
| invoca | Agente | referência (uso) | Ação → Agente | 0..N por Versão; Agente eliminado: referência inválida, Ação falha. |
| indica | Habilidade | referência | Ação "invocar Agente" → Habilidade | 0..1 por Ação (documento 18, 8). |
| usa | Ferramenta | referência (uso) | Ação de escrita → Ferramenta | Por identificador estável; descontinuada: Ação inválida na próxima disparada (documento 18, 20.14). |
| chama | Integração | referência (uso, via Ferramenta) | Ação → Integração | Integração eliminada: referência inválida. |
| age sobre | registros-alvo | referência | Ação → registro | Dentro das permissões; alvo fixo eliminado: referência inválida, Ação falha (B41). |
| gera | Registro de Atividade | referência inversa | Registro → Automação (ator) | Ator = Automação; delegante conforme 17.3. |
| gera | Solicitação de Aprovação | referência inversa | Solicitação → Execução | Solicitante = Automação. |
| é mãe de | Execução de Agente | referência (contenção lógica, B18) | Execução de Automação → Execução de Agente | A filha pertence ao Agente; a mãe a referencia e a cancela em cascata. |
| foi acionada por | Membro / Agente | referência | Execução → Ator | Gatilho manual. |
| foi criada por | Membro | referência | Automação → Criador | Imutável. |
| foi criada a partir de | Template de contêiner / Automação | Proveniência | Automação → origem | Sem vínculo vivo. |
| é Fonte de Dados de | Widget | referência inversa | Widget → Automação / Execuções | Painéis contam Execuções por resultado (B20). |

Distinção aplicada: **CONTER** (Versões, Execuções); **USAR** (Ferramentas, Integrações, Agentes, Contexto); **REFERENCIAR** (escopo, Proprietário, Papel, Habilidade indicada, alvos, Criador, Proveniência); **CONFIGURAR** (a Automação é configurada pelo escopo — o Administrador do contêiner a administra — sem ser componente dele); **SER REFERENCIADA** (Registros, Solicitações, Widgets, Execuções de Agente). A Automação **herda** apenas o que a seção 16 descreve.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Automação | 0..N | sim | sim | pertencimento | Espaço de Trabalho sem Automações é válido. |
| Automação → ET | 1 | não | não | pertencimento | A1.1. |
| Automação → escopo | 1 | não | não | referência essencial | B41: sem escopo não há Gatilho delimitado. |
| escopo → Automação | 0..N | sim | sim | referência inversa | Acumulam pelo caminho (B25). |
| Automação → Proprietário | 1 | não | não | referência | A7. |
| Membro → Automações de que é Proprietário | 0..N | sim | sim | referência inversa | |
| Automação → Papel | 0..1 | sim | não | referência | Sem Papel, age só por concessões diretas. |
| Automação → Versão | 1..N | não | sim | composição | Versão 1 nasce com a Automação. |
| Automação → Versão `publicada` | 0..1 | sim | não | composição | Uma vigente (7.1). |
| Automação → Versão `rascunho` | 0..1 | sim | não | composição | |
| Versão → Gatilho | 1 | não | não | objeto de valor | DO-AUT-02. |
| Versão → Condição atômica | 0..N | sim | sim | objeto de valor | Vazio = sempre. |
| Versão → Ação | 1..N (para publicar) | não | sim | objeto de valor | Automação sem Ação não faz nada; rascunho pode ter zero. |
| Ação "invocar Agente" → Agente | 1 | não | não | referência | Padrão Assistente padrão (B17). |
| Ação "invocar Agente" → Habilidade | 0..1 | sim | não | referência | Documento 18, 9. |
| Ação de escrita → Ferramenta | 1 | não | não | referência | DO-AUT-05. |
| Automação → Execução | 0..N | sim | sim | composição | |
| Execução → Versão | 1 | não | não | referência | RN-AUT-08. |
| Execução → Execução de Agente filha | 0..N | sim | sim | referência (B18) | |
| Execução de Agente → Execução de Automação mãe | 0..1 | sim | não | referência | Só quando invocada por Automação. |
| Execução → Solicitação de Aprovação | 0..N | sim | sim | contenção | Entidade interna da Execução com identidade (documento 17, 7.6; documento 15, 3.3); contada por Painéis (B80). |
| Evento → Execução por Automação | 0..1 | sim | não | derivado | Idempotência: o mesmo Evento dispara a mesma Automação no máximo uma vez (INV-AUT-06). |
| Execução → objeto do Gatilho | 0..1 (ou conjunto, em agendamento) | sim | condicional | referência | |
| Execução → Execução-mãe na cadeia | 0..1 | sim | não | referência | Raiz da cadeia tem zero. |

Nenhuma cardinalidade requer `DECISÃO NECESSÁRIA`: as escolhas com base insuficiente estão registradas como DO-AUT RECOMENDADA (seção 24).

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Nenhuma: a Automação está no domínio IA (A2.1) e não é filha de Espaço, Pasta, Lista, Funil ou Caixa de Entrada (A2.2). O **escopo** é referência essencial, não contenção: a Automação "da Lista X" pertence ao Espaço de Trabalho e referencia a Lista. A consequência prática (eliminada com o escopo, inoperante com ele arquivado, administrada por quem administra o escopo, acompanhando-o na movimentação) decorre de B41, não de contenção.

**Pertencimento (teste de existência).** A Automação não existe sem o Espaço de Trabalho (B32) nem sem o escopo (B41): eliminado o escopo, é eliminada. Versões e Execuções não existem sem a Automação. A Execução de Agente filha existe sem a Execução de Automação mãe? Sim: pertence ao Agente (B18); a eliminação da Automação deixa na filha uma referência à mãe como valor (identificador e nome à época).

**"Pertence a" versus "relaciona-se com".** A Automação *pertence* ao Espaço de Trabalho; *tem escopo em* um contêiner; *relaciona-se com* Agentes, Habilidades, Ferramentas, Integrações e registros-alvo, todos existentes sem ela e ela sem eles (a referência inválida faz Ações falharem; não elimina a Automação).

**Propriedade.** A Automação **tem Proprietário** (A7): exatamente um Membro `ativo` ou `suspenso`, que responde pela governança e pelo destino da regra — e, por A6.3 e B7, é a **accountability humana** de tudo o que a Automação faz (por isso é o ator delegante padrão, 17.3). Transferência de propriedade é ato do Proprietário ou de Administrador; sucessão por B28 (12.6). O Proprietário não é o "executor": a Automação executa com permissões próprias, limitadas pelas dele (17.2).

**Configurar não é conter.** O Administrador de um contêiner configura as Automações com escopo nele (17.1) sem que elas sejam componentes do contêiner; a Automação configura a autonomia máxima do Agente invocado sem que o Agente seja componente dela.

## 11. Estados

### 11.1 Estados da Automação (DO-AUT-09)

Estado de sistema, não personalizável. **Exceção registrada a A4.1**, análoga à que o documento de Agentes adota: aos três estados de ciclo de vida somam-se dois estados operacionais, porque uma regra reativa precisa distinguir "existe mas não reage" de "arquivada".

| Estado | Significado | Gatilho dispara? | O que é possível |
| --- | --- | --- | --- |
| `rascunho` | Criada; nenhuma versão publicada. | Não. | Editar, publicar (→ `ativo`), excluir. |
| `ativo` | Versão vigente em operação. | Sim (se o escopo está efetivamente `ativo` e o ET não está `suspenso`). | Editar rascunho da próxima versão, publicar, pausar, arquivar, excluir, acionar manualmente. |
| `pausado` | Retirada de operação temporariamente, por ato humano. | Não; Eventos ocorridos durante a pausa **não** são repostos ao reativar. | Retomar (→ `ativo`), editar, publicar (permanece `pausado`), arquivar, excluir. Execuções em andamento **terminam** (inclusive `aguardando aprovação`, que continuam a aguardar — 20.12). |
| `arquivado` | Fora de uso, preservada com histórico. | Não. | Ver, restaurar (→ `pausado`, nunca diretamente `ativo` — RN-AUT-05), excluir. Execuções em andamento são **canceladas** no ato (inclusive `aguardando aprovação`). Não editável. |
| `na lixeira` | Excluída de forma recuperável, pelo prazo da Política de lixeira. | Não. | Ver (com `excluir`), restaurar ao estado anterior à exclusão (padrão B43; se era `ativo`, volta `pausado` — RN-AUT-05). Execuções em andamento canceladas. |

**Inoperante** não é estado gravado: é condição derivada de uma Automação `ativo` cujo escopo não está efetivamente `ativo` (B41), cujo Espaço de Trabalho está `suspenso` (B31), cujo Proprietário está `suspenso` (RN-AUT-04) ou cuja Versão vigente contém referência inválida detectada. Exibida com motivo; cessa sem ato quando a causa cessa.

### 11.2 Estados da Execução de Automação (B18)

| Estado | Significado | Transições |
| --- | --- | --- |
| `pendente` | Criada pelo disparo; aguardando vez na fila de execução (serialização por objeto, RN-AUT-11). | → `executando`; → `cancelada` (pausa não cancela; arquivamento, exclusão, suspensão do ET, cancelamento manual cancelam). |
| `executando` | Avaliando Condições ou executando Ações; inclui espera em "aguardar". | → `aguardando aprovação`; → `concluída`; → `falhou`; → `cancelada`. |
| `aguardando aprovação` | Solicitação de Aprovação pendente. | → `executando` (aprovada, Condições reavaliadas); → `cancelada` (rejeitada, vencida, arquivamento, suspensão). |
| `concluída` | Todas as Ações executaram ou "encerrar" foi alcançado; com indicador de falhas parciais quando a Política é `continuar`. | Terminal. |
| `falhou` | Uma Ação ou Condição falhou com Política `interromper`; ciclo detectado; limite; referência inválida. | Terminal. |
| `cancelada` | Interrompida por ato ou por regra (aprovação negada/vencida, arquivamento, suspensão, cancelamento pela mãe). | Terminal. |

Estados terminais são imutáveis. Não existe "reexecutar": é Execução nova.

### 11.3 Estados da Versão

`rascunho` → `publicada` → `obsoleta` (7.1). `publicada` nunca volta a `rascunho`; `obsoleta` é terminal e nunca eliminada enquanto a Automação existir (INV-AUT-02).

## 12. Ciclo de vida

### 12.1 Criação

Por **Membro** com `criar` sobre Automações no escopo pretendido (17.1): nasce `rascunho`, versão 1 `rascunho`, Criador e Proprietário = o Membro (Proprietário alterável no ato por Administrador), escopo fixado, sem Papel (o Membro pode atribuir um Papel ou concessões antes de publicar), "Reage a Eventos de Automações" = falso. Por **instanciação de Template de contêiner** (4.8): nasce no estado que o Template declarar (`rascunho` por padrão; `ativo` só se o instanciador tiver `administrar` no escopo criado e o teto de permissões for satisfeito — RN-AUT-04), Proprietário = instanciador, com Proveniência. Por **duplicação**: `rascunho`, Proveniência. **Nunca por Agente, por Automação ou por Integração** (INV-AUT-10): governança humana, coerente com INV-HAB-04 e DO-ESP-15. Um Convidado nunca cria (documento 01, 17.2).

### 12.2 Versões

- **Editar** (`editar`): edita o rascunho; se não há, cria um a partir da vigente (número seguinte). Um rascunho por vez.
- **Publicar** (`administrar` sobre a Automação): valida (RN-AUT-07: Gatilho presente e compatível com o escopo; Ações ≥ 1; Ferramentas existentes no Catálogo; Agentes `ativo` e Habilidades indicadas `ativo` com Versão corrente; Definições de Campo referenciadas efetivas no escopo; alvos fixos existentes; aninhamento e limites respeitados; **teto de permissões**: a Automação não tem permissão que o Proprietário não tenha — RN-AUT-04) e torna o rascunho `publicada`; a anterior passa a `obsoleta`. Em `rascunho`, publicar leva a Automação a `ativo`; em `ativo` ou `pausado`, o estado não muda. Execuções em andamento terminam na versão anterior (RN-AUT-08).
- **Descartar rascunho** (`editar`).

### 12.3 Transições de estado

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `rascunho` | `ativo` | `administrar` (publicar) | Passa a escutar Gatilhos a partir do momento; nada retroativo. |
| `ativo` | `pausado` | `administrar` | Execuções `executando` e `aguardando aprovação` terminam; Execuções `pendente` (já disparadas) também executam — a pausa só impede **novas** disparadas. |
| `pausado` | `ativo` | `administrar` | Eventos do período não são repostos; agendamentos perdidos não são repostos. |
| `ativo` / `pausado` / `rascunho` | `arquivado` | `administrar` | Execuções não terminais → `cancelada` com motivo; Solicitações pendentes canceladas. |
| `arquivado` | `pausado` | `administrar` | Nunca diretamente `ativo` (RN-AUT-05): a reativação é ato explícito depois de revisar. |
| qualquer | `na lixeira` | `excluir` | Como arquivar; grava Estado anterior à exclusão. |
| `na lixeira` | anterior (com `ativo` → `pausado`) | `excluir` (restaurar) | Colisão de nome no escopo é rejeitada até renomear (RN-AUT-03). |

Renomear, alterar descrição, transferir Proprietário, atribuir Papel ou concessões e alternar "Reage a Eventos de Automações" são atos sobre a Automação, sem nova versão, com Registro de Atividade — exceto o teto de permissões, reavaliado no ato (RN-AUT-04).

### 12.4 Eliminação permanente e cascata

Por prazo da Política de lixeira, por eliminação antecipada (`administrar`) ou **em cascata do escopo** (B41) ou do Espaço de Trabalho (B32). Elimina Versões (inclusive `obsoleta`) e **Execuções** com seus passos; **Registros de Atividade permanecem** com a Automação como ator (nome e identificador à época, A6.4 por analogia); Solicitações de Aprovação pendentes são canceladas; Execuções de Agente filhas permanecem (pertencem ao Agente) com a referência à mãe como valor; registros criados pelas Ações permanecem (a Proveniência "criado por Automação X" é valor). Automações de outro escopo que referenciam a eliminada como alvo de "acionar Automação" passam a referência inválida. B41 foi emendada nesse sentido (DO-AUT-17): as Execuções são eliminadas com a Automação; Registros de Atividade e efeitos permanecem.

### 12.5 Ciclo de vida da Execução

Disparo (7.2) → verificação de idempotência e de ciclo (RN-AUT-09, INV-AUT-06) → `pendente` na fila do objeto (RN-AUT-11) → `executando`: Condições (leitura; híbridas geram filha) → Ações em ordem (cada escrita: permissão da Automação avaliada sobre o registro concreto — B23; classe de efeito → aprovação implícita quando aplicável — 17.5) → estado terminal. Cancelamento manual por Membro com `administrar` sobre a Automação, ou pelo Sistema (arquivamento, suspensão, Execução-mãe cancelada).

### 12.6 Sucessão e mudanças no Proprietário

- **Proprietário removido** (B28): a Automação passa ao Sucessor no mesmo ato, com Registro e **notificação ao Sucessor**; permanece `ativo`; o teto passa a ser o do Sucessor e é reavaliado na próxima Ação (RN-AUT-04). Recomendação: continuar ativa, porque pausar todas as Automações de um Membro removido pararia a operação da organização sem aviso; o Sucessor recebe a lista e decide (DO-AUT-14).
- **Proprietário suspenso**: a Automação fica **inoperante** (não dispara; Execuções em andamento terminam — RN-AUT-04), porque o teto de um Membro `suspenso` é vazio (documento 01, 20.6 por analogia); Administrador pode transferir a propriedade para retomar.
- **Permissões do Proprietário reduzidas**: nada muda na Automação; a Ação que exceder o novo teto falha na próxima Execução (B23; 20.4).

## 13. Regras de negócio ontológicas

- **RN-AUT-01.** Toda Automação pertence a exatamente um Espaço de Trabalho e é um Ator (A6.1) e um sujeito de autorização (A6.3): age com Papel e concessões próprios, nunca com as permissões de outro Sujeito (DO-AUT-01).
- **RN-AUT-02.** O escopo é definido na criação e imutável. Acompanha o contêiner de escopo quando este é movido (B40). Mudar de escopo é duplicar e arquivar.
- **RN-AUT-03.** O nome é único entre Automações não `na lixeira` do mesmo escopo, sem distinção de maiúsculas e espaços nas extremidades; criar, renomear e restaurar com colisão são rejeitados até renomear.
- **RN-AUT-04.** **Teto de permissões.** A permissão efetiva da Automação sobre cada registro é a interseção das suas próprias permissões com as do seu Proprietário atual, avaliada a cada Ação sobre o registro concreto (B23). Publicar é rejeitado se o Papel ou as concessões da Automação excederem as do Proprietário no momento; transferir a propriedade a um Membro cujo teto seria menor é permitido, com aviso das Ações que passarão a falhar. Proprietário `suspenso` implica teto vazio: a Automação fica inoperante.
- **RN-AUT-05.** Restaurar do arquivamento ou da lixeira nunca devolve a Automação diretamente a `ativo`: devolve a `pausado` (ou ao estado anterior, se não era `ativo`), para que a reativação seja ato explícito após revisão de referências.
- **RN-AUT-06.** Uma Condição só lê. Uma Condição híbrida invoca um Agente com contrato de saída estruturado e com Ferramentas de escrita rejeitadas durante o passo; a Execução de Agente correspondente é filha e a sua falha torna a Condição indeterminada, com a Execução de Automação `falhou`.
- **RN-AUT-07.** Publicar valida, sem efeito em caso de falha: Gatilho compatível com o escopo (Eventos de Tarefa exigem escopo da Estrutura; de Negócio, Funil ou Espaço de Trabalho; de Conversa e Mensagem, Caixa de Entrada ou Fila; de Contato, Execução e Conhecimento, Espaço de Trabalho); ao menos uma Ação; Ferramentas existentes no Catálogo; Agentes `ativo` e a Automação com `executar` sobre cada Agente invocado (Ação "invocar Agente" e Condição híbrida), dentro do teto — reavaliado a cada Ação (RN-AUT-04; RN-AGE-13); Habilidades indicadas `ativo` com Versão corrente e concedidas ao Agente; Definições de Campo efetivas no escopo; alvos fixos existentes e não `na lixeira`; aninhamento de ramificação e demais Limites impostos; teto de permissões (RN-AUT-04).
- **RN-AUT-08.** Uma Execução usa a Versão vigente no momento do disparo, do início ao fim, ainda que outra seja publicada, a Automação seja pausada ou o escopo seja arquivado durante a Execução; arquivar ou excluir a Automação cancela.
- **RN-AUT-09.** **Cadeia de Execuções e ciclo** (B79). Toda Execução registra a Cadeia de Execuções: a Execução-mãe (a Execução de Automação ou de Agente cujo Evento, acionamento ou invocação a originou), a profundidade e os elementos já visitados — pares (Automação, objeto) e Agentes. A Cadeia é uma só para Execuções de Automação e de Agente: a Execução de Agente invocada por Ação ou Condição híbrida tem profundidade mãe + 1, e um Agente que aciona uma Automação (RN-AUT-19) a continua. A profundidade total máxima é Limite imposto (recomendação: 5); dentro dela, a subsequência contígua de invocações Agente → Agente respeita o sub-limite de DO-AGE-08 (recomendação: 3). Um disparo que excederia a profundidade, cujo par (Automação, objeto) já consta da Cadeia, ou que invocaria Agente já presente nela, **não cria Execução**: gera Registro de Atividade "disparo recusado por ciclo" com a Cadeia, e notificação ao Proprietário da Automação recusada (INV-AUT-07).
- **RN-AUT-10.** Um Gatilho de condição temporal dispara uma vez por registro por **entrada** na condição; o registro só volta a disparar depois de deixar de satisfazer o predicado e satisfazê-lo de novo. O intervalo de avaliação é Limite imposto.
- **RN-AUT-11.** **Serialização por objeto.** Execuções cujo objeto do Gatilho é o mesmo registro executam uma de cada vez, na ordem dos momentos dos Eventos que as dispararam; Execuções sobre objetos distintos são independentes e concorrem. Execuções de agendamento sem objeto são serializadas por Automação. Não há outra regra ontológica de ordem: volume e vazão são Limites impostos (20.7).
- **RN-AUT-12.** Em Gatilho de agendamento, as Ações executam uma vez por registro selecionado pelas Condições, dentro da mesma Execução, cada registro como passo próprio com resultado próprio; a Política de erro decide se a falha em um registro interrompe os demais.
- **RN-AUT-13.** O número de escritas de uma Execução (inclusive das filhas) é limitado por Limite imposto; ao atingi-lo, a Execução passa a `aguardando aprovação` com Solicitação ao Proprietário da Automação, qualquer que seja a autonomia dos Agentes envolvidos (RN-CON-20; DO-CON-13). Aprovada, prossegue até o próximo múltiplo do limite; rejeitada ou vencida, `cancelada`.
- **RN-AUT-14.** Retentativa só para falhas transitórias de Ferramenta de origem `Integração`, limitada em número (≤ Limite imposto) e intervalo; falhas de permissão, validação, contrato ou referência inválida nunca são retentadas. Nunca há retentativa da Execução inteira.
- **RN-AUT-15.** Após "aguardar" e após "invocar Agente", as Ações seguintes releem o estado do objeto; parâmetros derivados são resolvidos no momento de cada Ação, não no disparo.
- **RN-AUT-16.** Aprovação concedida faz a Execução **reavaliar as Condições** e as pré-condições da Ação aprovada (Requisitos, janela, consentimento, permissão) antes de executá-la; se deixaram de valer, a Ação é marcada `pulado` com motivo "condição deixou de valer após aprovação" e a Política de erro decide o restante.
- **RN-AUT-17.** Regras de Agendamento, condições temporais e predicados de horário são interpretados no fuso da Localidade do Espaço de Trabalho (B34); dias úteis dependem de C12 e, até lá, do Horário de atendimento da Caixa de Entrada quando o escopo for Caixa ou Fila (DO-CXE-06).
- **RN-AUT-18.** Toda Execução `falhou`, todo disparo recusado por ciclo e toda detecção de referência inválida notificam o Proprietário da Automação; a plataforma pode agregar notificações repetidas, nunca suprimi-las.
- **RN-AUT-19.** Acionamento manual exige `executar` sobre a Automação. Um Agente aciona por meio da Ferramenta `acionar Automação` (classe `escrita reversível`; Recurso-alvo: Automação), sujeita às duas verificações de DO-HAB-14; a Execução registra o Agente como Ator invocador e ator delegante das Ações, e **continua** a Cadeia de Execuções da Execução do Agente (mãe = essa Execução; profundidade +1; Agentes e pares já visitados herdados — RN-AUT-09; B79), nunca a reinicia. Um Membro aciona diretamente. A Automação executa com as próprias permissões (RN-AUT-04), não com a interseção com o acionador: `executar` é a porta de entrada, e quem a concede responde por isso (17.3; DO-AUT-24).
- **RN-AUT-20.** Eventos cujo ator é uma Automação não disparam Gatilhos de Automações com "Reage a Eventos de Automações" = falso; nenhuma Automação reage a Eventos cujo ator é ela própria, em qualquer configuração (INV-AUT-08). Eventos cujo ator é um Agente invocado por Automação carregam a Automação como ator delegante e são tratados como Eventos de Automação para este fim.
- **RN-AUT-21.** Uma referência inválida em Condição ou Ação (Definição de Campo, Etapa, Lista, Agente, Habilidade, Ferramenta descontinuada, Integração, alvo fixo eliminado) faz o passo falhar na disparada, com Registro e notificação; a Automação passa a exibir-se inoperante com motivo até nova versão. Nada é editado automaticamente.
- **RN-AUT-22.** Eventos "por remapeamento" (status alterado por remapeamento — DO-ESP-04; Negócio remapeado por remoção de Etapa ou migração de Funil — RN-FUN-08; Tipo de Tarefa remapeado; migração em massa por movimentação de contêiner) **não** disparam Gatilhos de "status alterado", "entrou em Etapa" ou equivalentes. A plataforma emite para eles Eventos próprios ("... por remapeamento") que uma Automação pode escutar explicitamente (DO-AUT-23).
- **RN-AUT-23.** Em Espaço de Trabalho `suspenso` (B31): nenhum Gatilho dispara; Execuções não terminais passam a `cancelada`; ocorrências de agendamento e Eventos do período não são repostos; na reativação, Mensagens persistidas tornam-se elegíveis a Gatilhos a partir daquele momento (RN-CXE-27).
- **RN-AUT-24.** Uma Automação nunca cria, edita, publica, pausa, arquiva, exclui, transfere ou concede permissão sobre Automações — nem sobre si mesma; não existe Ferramenta para isso (INV-AUT-10). Um Agente igualmente não. Esses atos têm Ator Membro (ou Sistema, na cascata).
- **RN-AUT-25.** Uma Ação "invocar Agente" impõe ao Agente autonomia efetiva = min(nível do Agente, autonomia máxima imposta pela Ação ou pela Versão); nunca amplia (B22). O Agente executa com as próprias permissões (A9.3, execução autônoma); a Automação não lhe transfere nada.
- **RN-AUT-26.** Ações que criam registros com Proprietário (Contato, Negócio) resolvem o Proprietário inicial conforme o documento da entidade (DO-NEG-16, DO-CON-08 e DO-CXE-05): Membro configurado na Ação; senão, o Proprietário da Automação (ou o acionador manual, no Gatilho manual); nunca vazio. Registros criados têm Criador = Automação e Proveniência "criado por Automação X, Execução Y".
- **RN-AUT-27.** Comentário criado por Ação tem autor = Automação como Ator, com ator delegante conforme 17.3 (DO-AUT-21). Mensagem enviada por Ação tem Ator = Automação, delegante idem, sem Participante Remetente (DO-CXE-12).
- **RN-AUT-28.** Toda criação, edição de rascunho, publicação, pausa, retomada, arquivamento, exclusão, restauração, transferência de propriedade, alteração de Papel ou concessões, acionamento manual, disparo recusado, e cada passo de Execução com efeito, gera Registro de Atividade (A6.2).

## 14. Invariantes

- **INV-AUT-01.** Toda Automação referencia exatamente um escopo existente do seu próprio Espaço de Trabalho; nenhuma Automação sobrevive à eliminação do escopo.
- **INV-AUT-02.** Toda Automação tem ao menos uma Versão; no máximo uma `rascunho` e no máximo uma `publicada` em cada instante; Versões `publicada` e `obsoleta` são imutáveis e nunca eliminadas enquanto a Automação existir; toda Execução referencia uma Versão que existiu.
- **INV-AUT-03.** Toda Versão tem exatamente um Gatilho.
- **INV-AUT-04.** Em nenhuma Ação a permissão efetiva da Automação excede a do seu Proprietário atual sobre o registro-alvo, nem a de um Membro com o mesmo Papel e concessões; a Automação nunca tem Papel Proprietário ou Administrador nem base neles.
- **INV-AUT-05.** Toda Ação de escrita de uma Versão `publicada` referencia uma Ferramenta do Catálogo com classe de efeito e permissão requerida; não existe escrita fora do Catálogo.
- **INV-AUT-06.** Um mesmo Evento dispara uma mesma Automação no máximo uma vez; um mesmo acionamento manual cria no máximo uma Execução; uma mesma ocorrência de agendamento cria no máximo uma Execução.
- **INV-AUT-07.** Nenhuma Cadeia de Execuções excede a profundidade máxima, contém duas vezes o mesmo par (Automação, objeto) nem duas vezes o mesmo Agente (B79).
- **INV-AUT-08.** Nenhuma Automação reage a um Evento de que é ator ou ator delegante.
- **INV-AUT-09.** Toda Execução de Agente invocada por uma Execução de Automação é filha dela, referencia-a, e é cancelada quando ela é cancelada.
- **INV-AUT-10.** Toda Automação tem Criador Membro; nenhum ato de configuração de Automação tem Ator Agente ou Automação.
- **INV-AUT-11.** Toda Execução tem Ator invocador; Execuções por `evento`, `agendamento` e `condição temporal` têm o Proprietário como ator delegante das suas Ações; Execuções por `manual` têm o acionador.
- **INV-AUT-12.** Duas Execuções sobre o mesmo objeto nunca estão simultaneamente `executando` (fora de espera de "aguardar" ou de aprovação).
- **INV-AUT-13.** Nenhuma Execução produz efeito enquanto o Espaço de Trabalho está `suspenso`, o escopo não está efetivamente `ativo`, a Automação não está `ativo` (salvo término de Execução já iniciada, RN-AUT-08) ou o Proprietário não está `ativo`.

## 15. Personalização

A Automação **é** personalização: tudo o que a define (Gatilho, Condições, Ações, Política de erro, autonomia imposta) é configuração da organização, versionada. Além disso:

- **Campos Personalizados** sobre a Automação: não se aplicam (A5.2). Condições e Ações **consomem** Definições de Campo efetivas no escopo (7.3, 7.4).
- **Tags** e **Comentários** sobre a Automação: não se aplicam (A8). Ações **aplicam** Tags e **criam** Comentários em registros-alvo.
- **Status personalizável**: não existe; os estados são de sistema (11).
- **Visualizações**: não se aplicam; listas de Automações e de Execuções são apresentação do produto.
- **Parâmetros do acionamento manual**: o Membro ou Agente que aciona pode fornecer valores de entrada declarados pela Versão (mesmo sistema de tipos de DO-HAB-09), sem alterar a Automação.

## 16. Herança

- **Da Estrutura de Trabalho**: as Automações **acumulam** ao longo do caminho (B25): sobre uma Tarefa disparam as de escopo Espaço de Trabalho, Espaço, Pasta, Subpasta e Lista. Não há `sobrescrito` (uma Automação da Lista não substitui uma da Pasta); há `bloqueado`: um ancestral pode impedir a **criação** de Automações novas em descendentes, mantendo as existentes (B25; RN-ESP-09). Ponto de definição = escopo.
- **No CRM e na Caixa de Entrada**: acumulam por analogia — sobre um Negócio disparam as de escopo Espaço de Trabalho e Funil; sobre uma Conversa, as de escopo Espaço de Trabalho, Caixa de Entrada e Fila (DO-CXE-16). Não há bloqueio, porque não há hierarquia de contêineres (A5.2).
- **Entre versões**: um rascunho começa como cópia da vigente; não é herança.
- **Do Proprietário**: a Automação **não herda** as permissões do Proprietário; ele é **teto** (RN-AUT-04). Do Papel: herda as permissões do Papel como qualquer Sujeito.
- **Do Agente invocado**: nada; e o Agente nada herda dela (RN-AUT-25).
- **Do Espaço de Trabalho**: Localidade (fuso) para agendamento e predicados temporais; Limites impostos; Política de lixeira.
- **Do escopo**: estado efetivo (inoperância, B41) e governança (quem administra o escopo administra as Automações nele — 17.1). Não herda permissões de dados do escopo: escopo é alcance, não permissão (RN-ESP-20).

## 17. Permissões e visibilidade

### 17.1 A Automação como Recurso

| Ação | Significado sobre a Automação |
| --- | --- |
| ver | Ver nome, descrição, escopo, Proprietário, Versões (inclusive rascunho), Execuções e seus passos, Registros de Atividade. Ver uma Execução não amplia `ver` sobre os registros-alvo: os passos exibem identificadores e nomes à época; o conteúdo segue a permissão do visualizador (B20 por analogia). |
| comentar | Não se aplica (A8). |
| criar | Criar Automação com escopo no Recurso (o `criar` é sobre "Automações do escopo": exige `administrar` sobre o contêiner de escopo — Espaço, Pasta, Subpasta, Lista, Funil, Fila —, ou Papel Administrador para escopo Espaço de Trabalho e Caixa de Entrada); duplicar. |
| editar | Editar rascunho; renomear; alterar descrição; descartar rascunho. |
| excluir | Enviar à lixeira; restaurar. |
| administrar | Publicar; pausar; retomar; arquivar; eliminar antecipadamente; transferir propriedade; atribuir Papel e concessões à Automação (dentro do próprio teto — RN-AUT-04); cancelar Execuções; conceder permissões sobre a Automação. |
| executar | Acionar manualmente (Gatilho `manual`); para Agente, por Ferramenta (RN-AUT-19). |

Escopos: `registro` e `próprios` (Automações de que o Sujeito é Proprietário ou Criador — B29). `subárvore` aplica-se indiretamente: `administrar` em `subárvore` sobre um contêiner alcança as Automações com escopo nele e nos descendentes.

**Padrão recomendado.** Proprietário do ET e Administradores: tudo sobre todas. Administrador de contêiner (concessão `administrar` em `subárvore`): tudo sobre as de escopo na sua subárvore. Membro: `ver` sobre Automações cujo escopo ele vê; `criar` só por concessão `administrar` no escopo; `executar` por concessão. Convidado: nada por Papel; `executar` por compartilhamento é permitido (ex.: "solicitar reabertura") e é a única interação. Agente: `executar` por concessão (RN-AUT-19); nunca `criar`, `editar`, `excluir` ou `administrar` (INV-AUT-10).

### 17.2 Com que permissões a Automação executa (DO-AUT-01)

A Automação é **Sujeito** com Papel próprio (0..1) e concessões diretas, como o Agente (documento 01, 17.3), e a sua permissão efetiva sobre cada registro é **próprias ∩ Proprietário atual**, avaliada a cada Ação (RN-AUT-04; B23). Duas alternativas foram rejeitadas:

- **"Executa como o Proprietário"** (a Automação usa as permissões do Proprietário): auditoria confusa (os Registros teriam de fingir que o Proprietário agiu, ou o ator Automação teria permissões que ninguém concedeu explicitamente a ela); um Administrador que cria uma Automação daria a ela poder de Administrador sobre tudo, sem que isso conste em nenhuma concessão; e a sucessão (B28) mudaria silenciosamente o alcance de todas as Automações do removido.
- **"Permissões próprias sem teto"**: um Membro com `criar` conseguiria configurar uma Automação com Papel mais amplo que o seu — escalada de privilégio por configuração, contra A6.3.

Com o teto, a Automação **nunca faz o que o Proprietário não poderia fazer** e **só faz o que lhe foi concedido**; ambas as condições constam de registros consultáveis. A constituição incorporou a decisão: A9.1 lista a Automação entre os Sujeitos, com o teto do Proprietário como regra (B88).

### 17.3 Cadeia de atribuição (A6.2)

| Situação | Ator do Registro | Ator delegante | Execução |
| --- | --- | --- | --- |
| Ação executada por Automação disparada por `evento`, `agendamento` ou `condição temporal` | Automação | Proprietário da Automação | Ator invocador = Sistema. |
| Ação executada por Automação acionada manualmente por Membro | Automação | Membro acionador | Ator invocador = Membro. |
| Ação executada por Automação acionada por Agente (Ferramenta) | Automação | Agente acionador | Ator invocador = Agente; cadeia continua a partir da Execução do Agente. |
| Ferramenta invocada por Agente dentro de "invocar Agente" | Agente | Automação | Execução de Agente filha da Execução de Automação (DO-AUT-15). |
| Automação B disparada por Evento cujo ator é a Automação A (com "Reage a Eventos de Automações") | Automação B | Proprietário de B | Cadeia: mãe = Execução de A; profundidade +1. |

O delegante responde "em nome de quem"; a permissão efetiva é sempre a da Automação (17.2). A alternativa "ator = Automação, delegante = Agente" para as Ferramentas invocadas pelo Agente foi rejeitada: esconderia que houve raciocínio (o Agente escolheu a Ferramenta) e quebraria a leitura do Registro pelas regras de Agente (B22, B23), que se aplicam ao Agente e não à Automação.

### 17.4 Leitura em Condições e Contexto

Condições e parâmetros derivados leem apenas o que a Automação vê (RN-AUT-04). O Gatilho sobre objeto invisível não dispara (RN-ESP-20). Uma Automação que **vê** a Tarefa mas não **edita** a Lista falha na Ação, com Registro (documento 02, 20.7). Lista privada dentro do escopo: só com concessão direta à Automação (B38; Automação nunca recebe `administrar` sobre contêineres — B46).

### 17.5 Aprovação (B22 aplicada à Automação)

Duas origens de Solicitação de Aprovação:

1. **Explícita**: Ação "solicitar aprovação" (7.4), com aprovador declarado.
2. **Implícita**: uma Ação de escrita cuja Ferramenta tem classe de efeito `irreversível` ou `externa` gera Solicitação **quando a Versão declara "exigir aprovação para efeitos irreversíveis/externos"** (equivalente a impor autonomia `supervisionado` à própria Automação) ou quando o documento da entidade a exige de todo Ator não humano (DO-CON-13: mesclagem; RN-AUT-13: limite de operações). Sem essa declaração, a Automação `ativo` executa o que lhe é permitido — é o que o Proprietário publicou e assinou (padrão análogo a `autônomo`, com o teto de 17.2). Ao invocar Agente, a aprovação é do Agente, por Ferramenta, no nível efetivo imposto (RN-AUT-25).

Aprovador: o declarado na Ação; senão o Proprietário da Automação. Aprovador removido: Sucessor (B28). Tempo limite: padrão da plataforma de **72 horas**, comum a toda Solicitação de Aprovação (B80), sobrescrevível na Ação ("solicitar aprovação" e "invocar Agente"); teto como Limite imposto; vencido, `cancelada`. Aprovação não é concessão: a Ação aprovada ainda é verificada contra permissões e pré-condições (RN-AUT-16).

### 17.6 IA sujeita às mesmas regras

Agente e Automação são Sujeitos com permissões próprias (A6.3). O Agente invocado usa apenas as suas (A9.3); a Automação usa apenas as suas com teto; nenhuma amplia a outra. Painéis sobre Execuções filtram pelo visualizador (B20).

### 17.7 Exceções

Nenhuma ao isolamento (INV-ET-07). O Sistema dispara, serializa, recusa por ciclo, cancela por suspensão e elimina por prazo sem ser Sujeito, com Registro quando há efeito.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Automação criada | 12.1 | Automação, escopo, Proprietário, origem (direta, Template, duplicação), Criador | Auditoria; Administrador do escopo |
| Automação renomeada / descrição alterada / propriedade transferida / Papel ou concessões alterados / "Reage a Eventos de Automações" alterado | 12.3 | antes, depois, ator; Ações que passam a exceder o teto | Auditoria; notificação ao novo Proprietário |
| Rascunho criado / descartado | 12.2 | versão, ator | Auditoria |
| Versão publicada | 12.2 | versão, Publicador, Gatilho, Ferramentas usadas, Agentes invocados, natureza, versão obsoletada | Auditoria; Painéis; Execuções em curso (terminam na anterior) |
| Publicação rejeitada | RN-AUT-07 | motivos (referência inválida, teto excedido, limite) | Notificação ao ator |
| Automação ativada / pausada / retomada / arquivada / restaurada / enviada à lixeira / eliminada | 12.3, 12.4 | Automação, ator ou Sistema (cascata do escopo), Execuções canceladas | Auditoria; escopo; Painéis |
| Automação inoperante / operante | 11.1 | causa (escopo não `ativo`, ET `suspenso`, Proprietário `suspenso`, referência inválida) | Notificação ao Proprietário; produto |
| Execução criada (disparo) | 7.7 | Execução, Gatilho disparador, objeto, Ator invocador, cadeia | Painéis; Sistema (fila por objeto) |
| Execução iniciada / concluída / falhou / cancelada | 11.2 | Execução, resultado, motivo, passos com resultado, duração, custo | **Gatilhos de outras Automações** (com "Reage a Eventos de Automações"); Painéis; Proprietário (falhas) |
| Execução aguardando aprovação / aprovação concedida / rejeitada / vencida | 17.5 | Execução, Solicitação, aprovador, decisão | Notificação; Painéis (tempo de aprovação) |
| Passo executado / falhou / pulado / retentado | 7.7 | Execução, ordem, Ferramenta, alvo, permissão avaliada, tentativa | Registro de Atividade do alvo (com ator Automação) |
| Disparo recusado por ciclo ou profundidade | RN-AUT-09 | Automação, objeto, cadeia | Proprietário; Painéis |
| Disparo recusado por idempotência | INV-AUT-06 | Automação, Evento | Auditoria (diagnóstico) |
| Limite de operações atingido | RN-AUT-13 | Execução, contagem, limite | Proprietário (Solicitação) |
| Referência inválida detectada | RN-AUT-21 | Automação, passo, referência | Proprietário; Administrador do escopo |
| Automação acionada manualmente | 7.2 | Automação, acionador, objeto, parâmetros | Auditoria |
| Espaço de Trabalho suspenso / reativado; escopo arquivado / restaurado / eliminado; Proprietário removido / suspenso; Agente / Habilidade / Ferramenta / Integração / Definição de Campo alterados (consumidos) | documentos 01, 02–05, 13, 14, 17, 18 | — | Automações: cancelar, tornar inoperante, suceder, marcar referência inválida |

Todos geram Registro de Atividade com a Automação (ou a Execução) como objeto; os passos com efeito geram, além disso, o Registro que a Ferramenta gera no registro-alvo, com ator Automação e delegante conforme 17.3.

## 19. Dependências

**A Automação depende de:** Espaço de Trabalho (pertencimento, Localidade, Limites impostos, Política de lixeira, `suspenso`, Papéis — documento 01); escopo (Espaço, Pasta, Subpasta, Lista — documentos 02–05; Funil — 13; Caixa de Entrada e Fila — 14); catálogo de Eventos de cada entidade (seções 18 dos documentos 06–14, 17, 18, 20); Catálogo de Ferramentas (DO-HAB-13; Integrações — documento 01, 7.4); Agente e Execução de Agente (B17, B18 — documento 17); Habilidade (indicação — documento 18); Definições de Campo (A5; B44); Solicitação de Aprovação (A8); Registro de Atividade (A6.2); Membro (Proprietário, Criador, Publicador, acionador, aprovador; sucessão B28).

**Dependem da Automação:** Agente (invocação; Ferramenta `acionar Automação`; autonomia imposta — documento 17); Caixa de Entrada (distribuição por Automação, resposta automática, Automações de Fila — documento 14); Funis e Negócios (Gatilhos e Ações sobre Etapas e situação — documentos 12, 13); Contatos (criação em lote, qualificação — documento 10); Tarefa e contêineres (Automações do caminho; RN-ESP-20; DO-LIS-13 — documentos 02–06); Conhecimento (Gatilho "Documento publicado" — documento 20); Painéis (Fonte de Dados "Execuções de uma Automação" — documento 21); Chat (acionamento manual pelo Assistente em Sessão de Chat — documento 16); IA visão geral (Execução e Ferramenta — documento 15).

**Documentos que este documento condiciona:** 01 e a constituição incorporaram DO-AUT-01 (Automação como Sujeito de A9.1 — B88) e DO-AUT-17 (B41 emendada); 06 recebe RN-AUT-27 (autor de Comentário = Automação — B91); 10 recebe o Limite de operações por Execução como Limite imposto (DO-AUT-18); 14 tem DO-CXE-16 adotado; 17 recebe a cadeia de atribuição (DO-AUT-15: delegante = Automação), a Ferramenta `acionar Automação`, a autonomia imposta e o Aprovador declarado na Ação.

## 20. Casos limítrofes e ambiguidades

### 20.1 Automação executada por Agente

O Agente Comercial, durante uma Execução, invoca a Ferramenta `acionar Automação` sobre "Reprocessar proposta" com o Negócio X como objeto. Permitido se o Agente tem `executar` sobre a Automação (concessão) e a Ferramenta lhe é permitida (DO-HAB-14). A Execução de Automação nasce com Ator invocador = Agente; as Ações têm ator = Automação e delegante = Agente; a Cadeia de Execuções continua a partir da Execução do Agente (profundidade +1; Agentes e pares visitados herdados — RN-AUT-09; B79): um Agente já presente na Cadeia não pode ser invocado de novo por esta Automação. A Automação executa com as **próprias** permissões (RN-AUT-19), não com as do Agente: se o Agente não pode mover o Negócio mas a Automação pode, o movimento ocorre — foi isso que quem concedeu `executar` autorizou. Não é Agente invocando Automação no sentido de B16 (o Agente não a "contém" nem a governa): é um Ator acionando um Gatilho manual.

### 20.2 Automação invocando Agente que dispara Evento que aciona a mesma Automação

"Ao criar Comentário em Tarefa, invocar Agente para responder" — o Agente responde criando um Comentário. O Evento "Comentário adicionado" tem ator = Agente e delegante = Automação (17.3): é Evento de Automação para efeito de RN-AUT-20; com "Reage a Eventos de Automações" = falso (padrão), não dispara. Mesmo com o indicador verdadeiro, a Automação não reage a Evento de que é delegante (INV-AUT-08). Se uma **segunda** Automação B reage ao Comentário e invoca um Agente que comenta de novo, A ↔ B: a cadeia cresce até que o par (A, Tarefa) reapareça — recusado por ciclo na segunda passagem (RN-AUT-09), com Registro e notificação a ambos os Proprietários. O limite de profundidade cobre o caso em que os objetos mudam a cada passo (A cria Tarefa nova → B cria outra → …): recusado na profundidade máxima.

### 20.3 Automação da Lista criando Tarefa em Lista privada sem permissão

"Ao concluir Tarefa na Lista Comercial, criar Tarefa na Lista Financeiro (privada)". A Automação não tem concessão na Lista Financeiro; o seu Proprietário tem. A permissão efetiva é próprias ∩ Proprietário = vazia para `criar` (RN-AUT-04): a Ação falha, a Execução `falhou` com "permissão negada", Registro na Execução (não na Lista privada, que a Automação não vê) e notificação ao Proprietário. Correção: um Membro com `administrar` sobre a Lista Financeiro concede `criar` à Automação por ato de governança. Caso simétrico (DO-LIS-13, 20.8): com a concessão, a Tarefa nasce com o Conjunto de Status, o Tipo e as Definições de Campo efetivas do destino; preencher um campo inexistente lá falha nesse passo.

### 20.4 Permissão do Proprietário reduzida após a publicação

A Automação foi publicada quando o Proprietário era Administrador; ele passa a Membro com Papel personalizado sem `editar` em Negócios de outros. A Automação continua `ativo`; a próxima Ação "alterar Etapa" sobre um Negócio de outro Proprietário encontra teto vazio e falha (RN-AUT-04; B23), com Registro e notificação. A plataforma deve, no ato de alterar o Papel, listar as Automações de que o Membro é Proprietário e que passarão a falhar (recomendação de produto; a ontologia só exige o teto e a falha registrada). Alternativa rejeitada: "congelar o teto no momento da publicação" tornaria a Automação mais poderosa que quem responde por ela, contra A6.3.

### 20.5 Proprietário removido

B28: a Automação passa ao Sucessor no mesmo ato, continua `ativo` e o Sucessor é notificado com a lista recebida (DO-AUT-14). Se o teto do Sucessor for menor, as Ações afetadas passam a falhar (20.4). Solicitações de Aprovação pendentes em que o removido era aprovador passam ao Sucessor. Execuções em andamento continuam (a permissão é reavaliada por Ação). A alternativa "pausar na sucessão" foi rejeitada porque pararia silenciosamente processos operacionais (distribuição de Conversas, confirmações) no instante de uma saída de pessoal; a alternativa "eliminar" contraria A7 e B28.

### 20.6 Espaço de Trabalho suspenso

B31 / RN-AUT-23: nenhum Gatilho dispara; Execuções `pendente`, `executando` e `aguardando aprovação` passam a `cancelada` com motivo "Espaço de Trabalho suspenso"; Execuções de Agente filhas idem. Na reativação, nada é reposto: ocorrências de agendamento perdidas não executam; Mensagens persistidas durante a suspensão tornam-se elegíveis a Gatilhos "Mensagem recebida" e "Conversa criada" **a partir da reativação** — o Evento de persistência ocorreu durante a suspensão e não dispara; o produto pode oferecer acionamento manual em lote sobre as Conversas persistidas, que cria Execuções novas com acionador humano (documento 01, 20.7).

### 20.7 Dez mil Eventos em um minuto

Importação de 10.000 Contatos dispara "Contato criado" para uma Automação de escopo Espaço de Trabalho. Regras ontológicas: um Evento → no máximo uma Execução por Automação (INV-AUT-06); Execuções sobre objetos distintos concorrem, sobre o mesmo objeto serializam (RN-AUT-11); cada Execução respeita o Limite de operações (RN-AUT-13). Vazão, tamanho da fila, prioridade entre Automações e descarte por sobrecarga são **Limites impostos** (B34), não regras da ontologia — com uma exigência: **nenhuma Execução disparada é descartada silenciosamente**; se a plataforma recusar por limite, é Evento "disparo recusado por limite" com Registro e notificação ao Proprietário. Recomendação de produto: importações declaram "sem Automações" como opção explícita, registrada.

### 20.8 Condição por IA cuja Execução de Agente falha

"Mensagem recebida → [Agente classifica intenção] → se `reclamação`, transferir para Fila Suporte". O Agente falha (Modelo indisponível; Habilidade `indisponível`; permissão negada; contrato de saída violado). A Condição é indeterminada; a Execução de Automação `falhou` com motivo "Condição híbrida indeterminada" e referência à Execução filha (RN-AUT-06). A Política de erro não muda isso: `continuar` aplica-se a Ações, não a Condições — uma Automação não escolhe um ramo sem saber qual. Falha transitória de Modelo pode ser retentada? Não pela Automação (RN-AUT-14 restringe a Integrações); se o documento 17 definir retentativa de Execução de Agente, ela ocorre dentro da filha. Alternativa de configuração: declarar na Condição híbrida um **valor padrão em caso de falha** (ex.: tratar como `outro`), o que a torna determinada e a Execução prossegue com o fato registrado — permitido como opção explícita da Versão (DO-AUT-04).

### 20.9 "Enviar Mensagem" fora da janela do WhatsApp

A Ação invoca a Ferramenta `enviar Mensagem` em Conversa cujo Tipo de Canal tem janela de resposta expirada. A Ferramenta rejeita Mensagem livre (RN-CXE-19): a Ação falha com "fora da janela; modelo exigido"; Política de erro decide. A Automação correta declara Mensagem de modelo `aprovado` como parâmetro; a Ferramenta então envia (sujeita a consentimento — RN-CON-16 — e Canal conectado — RN-CXE-20: `pendente` não é falha). Nada disso é regra da Automação: é capacidade do Tipo de Canal verificada pela Ferramenta (documento 14, 7.1).

### 20.10 Automação em Funil movendo Negócio para Etapa com Requisito não atendido

DO-FUN-06 / documento 13, 20.8: a Ação "mover para Etapa Proposta" é submetida ao Requisito "valor preenchido" como qualquer Ator; rejeitada; a Execução `falhou` com o Requisito violado; Registro "rejeitada" com ator Automação e delegante Proprietário. A Automação não contorna: se o valor deve ser preenchido, é uma Ação anterior explícita ("alterar Valor"), sujeita à sua própria permissão. Uma Automação que **reage** a "Requisitos alterados" (documento 13, 18) pode avisar o Proprietário de que passará a falhar — recomendação de produto.

### 20.11 Remapeamento em massa

Remover "Em revisão" do Conjunto de Status do Espaço remapeia 340 Tarefas (RN-ESP-06). O Evento é "status alterado por remapeamento" (DO-ESP-04) e **não dispara** Gatilhos "status alterado" (RN-AUT-22): remapeamento é manutenção de configuração, não trabalho. Mesmo tratamento para remoção de Etapa com remapeamento (RN-FUN-08), migração por arquivamento de Funil, remapeamento de Tipo de Tarefa e mapeamento por movimentação de contêiner (B40). Quem precisa reagir escuta o Evento "por remapeamento" explicitamente. Confirma a questão 5 do documento 02.

### 20.12 Automação `pausado` com Execuções `aguardando aprovação`

Pausar não cancela: as Execuções em andamento terminam (RN-AUT-08) e as `aguardando aprovação` continuam a aguardar até decisão ou tempo limite; aprovada, a Execução prossegue **na versão em que começou**, com reavaliação de Condições (RN-AUT-16). Arquivar ou excluir a Automação cancela todas, inclusive as `aguardando aprovação`, com Solicitações canceladas e aprovadores notificados. Justificativa: pausa é "não dispare mais"; arquivamento é "esta regra não existe mais em operação".

### 20.13 Aprovação concedida após o objeto mudar

"Negócio entrou em Fechamento → solicitar aprovação ao gerente → marcar como ganho". Entre a Solicitação e a aprovação (dois dias), o vendedor moveu o Negócio de volta a Proposta. Aprovada, a Execução **reavalia** as Condições e as pré-condições (RN-AUT-16): a Condição "Etapa = Fechamento" não vale mais; a Ação é `pulado` com motivo; com Política `interromper`, a Execução termina `falhou` (motivo "condição deixou de valer após aprovação") — o aprovador é notificado. Alternativa rejeitada: executar o que foi aprovado "porque foi aprovado" — a aprovação foi dada sobre um estado que não existe mais.

### 20.14 Automação que edita a própria configuração

Não existe Ferramenta que crie, edite, publique, pause ou conceda permissão sobre Automações (RN-AUT-24; INV-AUT-10). Uma Automação "que se desativa após rodar uma vez" é expressa como Condição ("nenhuma Execução `concluída` desta Automação sobre este objeto" — leitura sobre as próprias Execuções, permitida) ou como decisão humana. Uma Automação "que cria outra Automação para cada cliente" é substituída por uma Automação de escopo mais alto com Condições. Justificativa: configuração que se reescreve destrói a auditabilidade (qual versão fez o quê?) e a governança humana (quem publicou?).

### 20.15 Automação criada por Agente

Proibido (INV-AUT-10; RN-AUT-24), coerente com INV-HAB-04 e com a exigência de accountability humana (B7): o Proprietário responde pela Automação, e um Agente não pode criar uma obrigação para um humano. Um Agente que "sugere uma Automação" produz texto (saída de Execução, Comentário, Documento) que um Membro transforma em rascunho — o produto pode oferecer "criar a partir da sugestão", com Criador = Membro. Reabrir só com consequência para B7 (25.4).

### 20.16 Escopo arquivado com Execução em "aguardar"

A Lista de escopo é arquivada enquanto uma Execução aguarda "até o Contato responder" (5 dias). B41: a Automação fica inoperante; a Execução em andamento **termina** (RN-AUT-08) — a espera continua; se o Evento chega, as Ações seguintes executam sobre uma Tarefa efetivamente `arquivado`, e a Ferramenta de escrita rejeita (somente leitura, B36): a Ação falha com Registro. Eliminação da Lista elimina a Automação e cancela a Execução (12.4).

### 20.17 Duas Automações reagindo ao mesmo Evento com Ações contraditórias

"Tarefa criada → Prioridade alta" (Espaço) e "Tarefa criada → Prioridade baixa" (Lista). Ambas disparam (acumulam, B25); sobre o mesmo objeto serializam na ordem dos momentos dos Eventos — idêntica para as duas — e, em empate, pela ordem do caminho (ancestral primeiro) e depois pela ordem de criação da Automação (RN-AUT-11, desempate como Limite/regra de plataforma registrada em DO-AUT-08). Resultado: Prioridade baixa (a da Lista executa por último). A contradição é de configuração; o produto pode alertar ao publicar ("outra Automação do caminho altera o mesmo atributo no mesmo Evento").

### 20.18 Gatilho de agendamento com Condição que seleciona 50.000 registros

"Toda segunda, para Contatos sem interação há 90 dias, aplicar Tag inativo". A seleção retorna 50.000; o Limite de operações por Execução (RN-AUT-13) faz a Execução parar em `aguardando aprovação` no primeiro múltiplo, com a contagem total; o Proprietário aprova (prossegue até o próximo múltiplo) ou cancela. Não há "aprovar tudo de uma vez" ontologicamente; o produto pode oferecer aprovação com contagem declarada, que é uma aprovação por lote.

### 20.19 Ferramenta de Integração descontinuada em Versão vigente

DO-HAB-13 / documento 18, 20.14: a Versão vigente referencia Ferramenta descontinuada; na próxima disparada o passo falha (RN-AUT-21), a Automação exibe-se inoperante com motivo e o Proprietário é notificado. A Automação **não** é editada automaticamente para a Ferramenta substituta; um Membro publica nova versão. Durante o prazo de transição da plataforma, a descontinuada ainda opera.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| O escopo (Lista, Funil, Fila…) | Estrutura de Trabalho / CRM | Referenciado como alcance do Gatilho; a Automação não o contém nem é contida (A2.2; B41). |
| Ferramentas | Catálogo (plataforma / Integração) | Usadas pelas Ações; alterá-las é ato da origem (DO-HAB-13). |
| Agente invocado e a sua Execução | Agente | A Execução de Agente é filha por referência; pertence ao Agente (B18). |
| Habilidade indicada | Espaço de Trabalho / plataforma | Indicada por identidade; nunca contida nem concedida pela Automação (B15, B17). |
| Nível de autonomia | Agente | A Automação só impõe um máximo à invocação (B22). |
| Permissões do Proprietário | Membro | Teto, não fonte (RN-AUT-04). |
| Solicitação de Aprovação | Conceito transversal (A8) | Gerada e referenciada pela Execução; tem ciclo próprio e passa ao Sucessor (B28). |
| Registros criados pelas Ações (Tarefa, Negócio, Mensagem, Comentário) | Entidade-alvo | A Automação é Criador; o registro pertence ao seu contêiner ou ao Espaço de Trabalho, com Proveniência como valor. |
| Registros de Atividade das Ações | Registro-alvo (histórico) | A Automação é ator; o Registro pertence ao objeto. |
| Regra de Recorrência | Tarefa | 4.5. |
| Requisitos de Etapa, transições de Status, cascata, herança | Plataforma / configuração do contêiner | 4.4. |
| Distribuição de Conversas por Fila | Fila | Regra operacional; a Automação pode atribuir explicitamente. |
| Horário de atendimento, Localidade | Caixa de Entrada / Espaço de Trabalho | Consumidos por Condições e agendamento. |
| Notificações | Produto | Efeito de Ação sem registro na ontologia além do Registro de Atividade. |
| Integração | Espaço de Trabalho | Conexão usada por Ferramenta (4.7). |
| Template de contêiner que carrega Automações | Catálogo de Templates | Instanciar cria Automações novas com Proveniência (4.8). |
| Limites (vazão, profundidade, operações, retentativas, aninhamento) | Limites impostos (B34) | A ontologia exige existência e efeito registrado; valores são da plataforma. |
| Custo | Execução (C8) | Atributo da Execução, agregado das filhas; política é aberta. |
| Painel | Painéis | Não é Gatilho, escopo nem alvo de Ação (DO-PAI-17; RN-PAI-25); as Execuções e Solicitações da Automação são Fonte de Dados de Painel (DO-PAI-05). |

## 22. Exemplos conceituais

**Exemplo 1 — Determinística, Estrutura de Trabalho.** A Administradora Maria cria, na Lista "Onboarding" (escopo Lista), "Boas-vindas": Gatilho `evento` "Tarefa criada"; Condição "Tipo de Tarefa = Cliente novo"; Ações: (1) atribuir Responsável = Equipe Sucesso (Ferramenta `atribuir Responsável`, `escrita reversível`); (2) aplicar Tag "novo"; (3) criar Subtarefa "Ligar em 24 h" com data = criação + 1 dia; (4) notificar Responsáveis. Política `interromper`. Maria dá à Automação Papel "Operador de Onboarding" (só `ver`/`editar`/`criar` na Lista) — dentro do seu próprio teto — e publica (versão 1; `ativo`). Cada Tarefa criada com o Tipo gera uma Execução com quatro passos, ator Automação, delegante Maria. Seis meses depois Maria sai; Pedro é Sucessor: a Automação continua `ativo` sob Pedro, que recebe a notificação; como Pedro é Membro comum sem `criar` em outras Listas, nada muda aqui (o escopo e as Ações estão na mesma Lista).

**Exemplo 2 — Híbrida, Caixa de Entrada.** Na Fila "Recepção" (escopo Fila, DO-CXE-16), "Triagem": Gatilho "Conversa criada"; Condição híbrida: invocar Assistente padrão com Habilidade "Classificar intenção" (saída: seleção {agendamento, dúvida, reclamação, outro}; valor padrão em falha: `outro`); ramificar: `agendamento` → transferir para Fila "Agenda" e invocar Agente Agendador (autonomia máxima imposta `supervisionado`; Habilidade "Agendar consulta"); `reclamação` → transferir para "Suporte", aplicar Tag "urgente", notificar Proprietário da Fila; senão → enviar Mensagem de modelo "Recebemos sua mensagem". A Execução de Automação contém duas Execuções de Agente filhas no ramo `agendamento`; o Agendador, `autônomo` por configuração, executa `supervisionado` aqui: cada `enviar Mensagem` gera Solicitação de Aprovação à Atendente. A Mensagem de modelo do ramo padrão tem ator Automação, delegante o Proprietário da Automação, sem Participante Remetente (DO-CXE-12).

**Exemplo 3 — Agendamento e condição temporal, Funil.** No Funil "Vendas": (a) "Parados" — Gatilho `condição temporal` "Negócio `aberto` na mesma Etapa há 10 dias": Ações: comentar no Negócio ("parado há 10 dias") e notificar o Proprietário do Negócio; dispara uma vez por Negócio por entrada na condição (RN-AUT-10); (b) "Resumo semanal" — Gatilho `agendamento` "segundas 8h" (fuso da Localidade): Condição seleciona Negócios `aberto` com previsão vencida; Ação por registro: aplicar Tag "previsão vencida"; ao fim, invocar Agente Analista para gerar um Documento de Conhecimento "Resumo da semana" na Coleção "Comercial". Durante uma suspensão de 9 dias, a segunda perdida não é reposta (B31).

**Exemplo 4 — Ciclo e recusa.** "Sincronizar prazo" na Lista A copia a data da Tarefa para a Tarefa vinculada na Lista B; "Sincronizar prazo" na Lista B faz o inverso, ambas com "Reage a Eventos de Automações" = verdadeiro (o Administrador quis encadear). A da Lista A altera B (Evento com ator Automação A) → a de B dispara (profundidade 1) e altera A → o par (Automação A, Tarefa A) já consta da cadeia: disparo recusado, Registro e notificação aos dois Proprietários. Com o indicador falso (padrão), a segunda nem dispara e o par nunca oscila.

## 23. Representação gráfica textual

```
Espaço de Trabalho (1)
├── Papel (0..N) ◀──── referencia ──── Automação (Sujeito, 0..1 Papel)
├── Escopos possíveis: Espaço de Trabalho | Espaço | Pasta | Subpasta | Lista | Funil | Caixa de Entrada | Fila
│      ▲ referencia (1, imutável; eliminada com o escopo — B41; inoperante se não efetivamente ativo)
│      │
├── Automação (0..N)  [rascunho | ativo | pausado | arquivado | na lixeira]   Ator; Proprietário (1 Membro, teto); Criador (Membro)
│   ├── Reage a Eventos de Automações (booleano; padrão falso)
│   ├── Proveniência (0..1) — Template de contêiner | Automação duplicada
│   ├── Versão de Automação (1..N)  [rascunho 0..1 | publicada 0..1 (vigente) | obsoleta 0..N]
│   │   ├── Gatilho (1): evento | agendamento (+ Regra de Agendamento) | manual | condição temporal
│   │   ├── Condições (0..N predicados; conjunção/disjunção/negação)
│   │   │     └── Condição híbrida (0..N) ──▶ invoca Agente [Habilidade 0..1], saída estruturada; sem escrita
│   │   ├── Ações (1..N, ordenadas)
│   │   │     ├── Ação de escrita ──── usa ──▶ Ferramenta (Catálogo: plataforma | Integração) [classe de efeito; permissão requerida]
│   │   │     └── Ação de controle: ramificar (ramos; aninhamento ≤ Limite) | invocar Agente [Habilidade 0..1; autonomia máx.; Aprovador 0..1; tempo limite 0..1]
│   │   │                            | solicitar aprovação (aprovador; tempo limite) | aguardar (duração | Evento; limite) | notificar | encerrar
│   │   ├── Política de erro: interromper | continuar; retentativa (só Integração, ≤ Limite); notificação
│   │   ├── Autonomia máxima imposta (0..1)
│   │   └── Publicador (Membro)
│   └── Execução de Automação (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]
│         ├── Versão usada (1, fixa do início ao fim)
│         ├── Gatilho disparador (Evento | ocorrência | acionador | predicado) ; objeto (0..1 | conjunto)
│         ├── Ator invocador (Sistema | Membro | Agente) ; ator delegante (Proprietário | acionador)
│         ├── Cadeia de Execuções: Execução-mãe (0..1), profundidade (≤ Limite), pares (Automação, objeto) e Agentes visitados (B79)
│         ├── Passo (0..N): Condição avaliada | Ação executada → resultado; permissão avaliada; Registro de Atividade
│         ├── Execução de Agente filha (0..N) ──▶ pertence ao Agente (B18); cancelada com a mãe
│         ├── Solicitação de Aprovação (0..N)
│         └── custo; momentos
│
├── Agente (1..N) ──── Ferramenta `acionar Automação` ──▶ Gatilho manual (com `executar`)
└── Registro de Atividade: ator = Automação; delegante = Proprietário | acionador   (Ferramenta do Agente: ator = Agente; delegante = Automação)

Evento (ator ≠ Automação) ──▶ Gatilho `evento` ──▶ [idempotência; ciclo; visibilidade] ──▶ Execução (fila por objeto)
Evento (ator = Automação A) ──▶ Automação B só se "Reage a Eventos de Automações"; nunca A ──▶ A
```

## 24. Decisões ontológicas

- **DO-AUT-01.** A Automação é **Ator** (A6.1) e **Sujeito de autorização com Papel (0..1, nunca Proprietário/Administrador nem base neles) e concessões próprias**, análogo ao Agente; a sua permissão efetiva sobre cada registro é **próprias ∩ Proprietário atual**, avaliada a cada Ação (B23). Publicar é rejeitado se as próprias excedem o teto. Rejeita "executa como Proprietário" (auditoria opaca; poder sem concessão; sucessão altera alcance) e "próprias sem teto" (escalada por configuração). Incorporada a A9.1 e ao documento 01, 17.1 (B88). RECOMENDADA.
- **DO-AUT-02.** **Exatamente um Gatilho por Automação** (por Versão). Vários Eventos = várias Automações. Justificativa: objeto do Gatilho com tipo único torna Condições, Ações e Execuções comparáveis. RECOMENDADA.
- **DO-AUT-03.** Tipos de Gatilho: `evento` (qualquer Evento do catálogo sobre o escopo e descendentes, com filtro de subtipo), `agendamento` (Regra de Agendamento, objeto de valor da Versão, fuso da Localidade), `manual` (Membro ou Agente por Ferramenta `acionar Automação`) e `condição temporal` (predicado avaliado periodicamente; dispara uma vez por registro por entrada na condição). "Parado há X" é condição temporal, não Evento. RECOMENDADA.
- **DO-AUT-04.** **Condição híbrida**: uma Condição pode ser um passo de classificação por Agente (Habilidade indicada 0..1) com contrato de saída estruturado, sem Ferramentas de escrita, com Execução de Agente filha; a falha torna a Condição indeterminada e a Execução `falhou`, salvo valor padrão em falha declarado na Versão. Marca a Automação como `híbrida` (derivado). RECOMENDADA.
- **DO-AUT-05.** Ações são lista ordenada de objetos de valor da Versão. **Toda Ação de escrita é invocação de uma Ferramenta do Catálogo** (DO-HAB-13), com a sua classe de efeito e permissão requerida; **Ações de controle** (ramificar, invocar Agente, solicitar aprovação, aguardar, notificar, encerrar) não são Ferramentas e existem só em Automações. Precisa o Glossário ("sinônimo estrutural de Ferramenta"). RECOMENDADA.
- **DO-AUT-06.** Ramificação binária por Condição interna; **aninhamento máximo é Limite imposto** (recomendação: 3); aguardar tem duração máxima e tempo limite obrigatório (Limite imposto). RECOMENDADA.
- **DO-AUT-07.** **Execução de Automação** é entidade interna com identidade, estados de B18, Gatilho disparador com Evento e objeto, versão fixa, Ator invocador, ator delegante, passos com resultado e permissão avaliada, Execuções de Agente filhas (canceladas em cascata), Solicitações, cadeia, momentos e custo agregado. Estados terminais imutáveis; não há reexecução, só Execução nova. Aplica B18. RECOMENDADA.
- **DO-AUT-08.** **Serialização por objeto e idempotência por Evento**: Execuções sobre o mesmo objeto executam uma de cada vez na ordem dos Eventos (desempate: ordem do caminho, ancestral primeiro; depois ordem de criação da Automação); objetos distintos concorrem; um Evento dispara cada Automação no máximo uma vez. Nenhum descarte silencioso por limite. Vazão e fila são Limites impostos. RECOMENDADA.
- **DO-AUT-09.** Estados da Automação: `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira` — **exceção registrada a A4.1**, análoga à do Agente. Pausar não cancela Execuções (terminam; `aguardando aprovação` aguardam); arquivar e excluir cancelam; restaurar devolve a `pausado`, nunca diretamente a `ativo`. "Inoperante" é condição derivada com motivo. RECOMENDADA.
- **DO-AUT-10.** **Política de erro** por Versão: `interromper` (padrão; efeitos já produzidos permanecem) ou `continuar` (`concluída` com falhas parciais); **retentativa limitada e configurável apenas para falhas transitórias de Ferramenta de Integração** (≤ Limite imposto; recomendação: 3); nunca para permissão, validação ou referência inválida; nunca da Execução inteira; Proprietário sempre notificado. RECOMENDADA.
- **DO-AUT-11.** **Proteção contra ciclos**: toda Execução carrega a **Cadeia de Execuções** (B79 — objeto único para Execuções de Automação e de Agente: mãe, profundidade, pares (Automação, objeto) e Agentes visitados); profundidade total máxima é Limite imposto (recomendação: 5), com sub-limite para invocações Agente → Agente (DO-AGE-08); disparo que repetiria um par ou um Agente, ou excederia a profundidade, é recusado com Registro e notificação; `acionar Automação` continua a Cadeia. **Uma Automação nunca reage a Eventos de que é ator ou delegante**; por padrão não reage a Eventos de nenhuma Automação (atributo "Reage a Eventos de Automações", padrão falso, habilitável por Membro para encadeamento explícito). Eventos de Agente invocado por Automação contam como Eventos de Automação. RECOMENDADA.
- **DO-AUT-12.** Agendamento: Regra de Agendamento (objeto de valor da Versão, família da Regra de Recorrência, semântica distinta — 4.5/4.6), fuso da Localidade; ocorrências perdidas em suspensão, pausa ou inoperância **não são repostas** (B31); Condições selecionam registros e as Ações executam por registro na mesma Execução. RECOMENDADA.
- **DO-AUT-13.** **Aprovação**: explícita (Ação "solicitar aprovação") ou implícita (Ferramenta `irreversível`/`externa` quando a Versão declara exigir aprovação para esses efeitos, ou quando o documento da entidade exige de todo Ator não humano; limite de operações por Execução). Aprovador declarado ou Proprietário; sucessão B28; tempo limite padrão da plataforma de 72 horas, comum a toda Solicitação (B80), sobrescrevível na Ação → `cancelada`. A Ação "invocar Agente" declara Aprovador (0..1 Membro ou Equipe) e Tempo limite (0..1) para as Solicitações da Execução filha, com precedência sobre a Política de aprovação do Agente (DO-AGE-11). **Aprovação concedida reavalia Condições e pré-condições antes de executar.** A Automação impõe ao Agente invocado autonomia máxima (min com a do Agente), nunca amplia (B22). RECOMENDADA.
- **DO-AUT-14.** **Sucessão**: Proprietário removido → Automação passa ao Sucessor e **continua `ativo`**, com notificação e lista; teto passa a ser o do Sucessor. Proprietário `suspenso` → inoperante. Aplica B28, A7. RECOMENDADA.
- **DO-AUT-15.** **Cadeia de atribuição**: Ações da Automação registram ator = Automação e delegante = Proprietário (Gatilhos `evento`, `agendamento`, `condição temporal`) ou acionador (Gatilho `manual`: Membro ou Agente); Ferramentas invocadas por Agente dentro de "invocar Agente" registram ator = Agente e delegante = Automação, e a Execução de Agente é **filha** da Execução de Automação. Aplica A6.2, B18. Coerente com RN-CXE-23 e documento 13, 20.8. RECOMENDADA.
- **DO-AUT-16.** **Não existe Template de Automação** (A8). Automações são carregadas por Templates de contêiner (documento 02, 15.4) e reutilizadas por **duplicação** (nova identidade, versão 1 `rascunho`, Proveniência). RECOMENDADA.
- **DO-AUT-17.** Eliminação da Automação (inclusive em cascata do escopo, B41) elimina Versões e **Execuções**; Registros de Atividade, registros criados (com Proveniência como valor) e Execuções de Agente filhas (com referência à mãe como valor) permanecem. B41 foi emendada nesse sentido ("os Registros de Atividade e os efeitos das Execuções passadas são preservados; as Execuções, componentes do agregado, são eliminadas com a Automação — e com o Agente, documento 17, 12.5"), coerente com B18 (Execução pertence à Automação) e com A3.3 por analogia. RECOMENDADA.
- **DO-AUT-18.** **Limite de operações por Execução** (escritas, inclusive das filhas) é **Limite imposto** da plataforma (B34), não configuração do Espaço de Trabalho; ao atingi-lo, `aguardando aprovação` com Solicitação ao Proprietário, em qualquer autonomia; aprovação libera até o próximo múltiplo. Resolve a questão 8 do documento 10 (RN-CON-20; DO-CON-13). RECOMENDADA.
- **DO-AUT-19.** Versionamento (B24): Versões `rascunho` (0..1), `publicada` (**0..1 — a vigente**), `obsoleta` (0..N, imutáveis, nunca eliminadas com a Automação viva); publicar obsoleta a anterior no mesmo ato; Execuções terminam na versão em que começaram. Difere de DO-HAB-04 (várias `publicada`) porque ninguém fixa versão de Automação. RECOMENDADA.
- **DO-AUT-20.** **Escopo imutável**; acompanha o contêiner movido (B40); mudar de escopo é duplicar e arquivar. Fila é escopo (adota DO-CXE-16). Gatilho compatível com o escopo é validado na publicação. Nome único no escopo (padrão B39). RECOMENDADA.
- **DO-AUT-21.** **Comentário criado por Automação tem autor = Automação** (Ator, A6.1), com delegante conforme DO-AUT-15 — não "como Sistema" nem "por meio de Agente". Justificativa: esconder o Ator real quebra A6.2. **Impacto no documento 06, 7.1** (Autor: Membro ou Agente → Membro, Agente ou Automação). RECOMENDADA.
- **DO-AUT-22.** **Governança humana**: Automação é criada, editada, publicada, pausada, arquivada, excluída, transferida e permissionada apenas por Membro (ou Sistema em cascata); nunca por Agente nem por Automação, nem sobre si mesma; não existe Ferramenta para isso. Coerente com INV-HAB-04, DO-ESP-15, B7. RECOMENDADA.
- **DO-AUT-23.** Eventos "por remapeamento" (DO-ESP-04, RN-FUN-08, Tipos de Tarefa, movimentação) **não disparam** Gatilhos dos Eventos ordinários correspondentes; são Eventos próprios, escutáveis explicitamente. Confirma DO-ESP-04 e a questão 5 do documento 02. RECOMENDADA.
- **DO-AUT-24.** Acionamento manual por Agente é Ferramenta `acionar Automação` (`escrita reversível`; requer `executar` sobre a Automação); a Automação acionada executa com as **próprias** permissões, não com a interseção com o acionador; a cadeia continua. Justificativa: interseção faria a mesma regra comportar-se diferentemente por acionador, contra a previsibilidade da seção 2; a porta é `executar`. RECOMENDADA.

Nenhuma decisão contradiz A1–A9 ou B1–B99. DO-AUT-01 está incorporada a A9.1 (B88); DO-AUT-05 ao Glossário (B91); DO-AUT-09 a A4.1 e B94; DO-AUT-11 a B79; DO-AUT-17 a B41; DO-AUT-20 adota DO-CXE-16 (ampliação de B41); DO-AUT-21 impacta o documento 06 (B91). As decisões RECOMENDADAS deste documento estão consolidadas na constituição como B79, B80, B88–B95.

## 25. Questões em aberto

1. **Valores dos Limites impostos** (C8; B34): profundidade da Cadeia de Execuções (recomendação 5; sub-limite de invocação Agente → Agente 3), aninhamento de ramificação (3), operações por Execução, retentativas (3), duração máxima de "aguardar", tempo limite de aprovação (padrão 72 h), intervalo de avaliação de condição temporal, frequência mínima de agendamento, vazão e fila. Produto confirma; a ontologia só exige existência e efeito registrado.
2. **Dias úteis e horário comercial** (C12). Agendamento "em dias úteis" e condição temporal "há 3 dias úteis" dependem de configuração global inexistente; até lá, Automações de escopo Caixa/Fila usam o Horário de atendimento (DO-CXE-06) e as demais só calendário civil.
3. **Aprovação implícita por padrão.** DO-AUT-13 faz a Automação executar efeitos `irreversível`/`externa` sem aprovação salvo declaração na Versão. Alternativa mais conservadora: exigir aprovação por padrão e permitir dispensa explícita. Consequência de produto (fricção × risco); sem impacto no modelo.
4. **Agente autor de Automação** (20.15). Proibido por DO-AUT-22; reabrir só com consequência para B7 e para a governança de publicação; análogo à questão 4 do documento 18.
5. **Automação de escopo Contato/Empresa** (C25). B41 e DO-CXE-16 não preveem escopo no CRM fora de Funil, Caixa e Fila; Gatilhos de Contato e Empresa hoje só com escopo Espaço de Trabalho. Se organizações precisarem segmentar (por Origem, por Qualificação), a resposta é Condição, não escopo; registrar se a granularidade de governança (quem administra Automações de Contato) exigir escopo próprio.
6. **Reversão de efeitos de Execução `falhou`.** DO-AUT-10 mantém efeitos parciais. "Desfazer a Execução" exigiria compensação por Ferramenta, que a ontologia não define; registrar como possível capacidade futura de produto, restrita a Ferramentas `escrita reversível`.
7. **Prioridade entre Automações no mesmo Evento e objeto** (20.17). O desempate de DO-AUT-08 é regra de plataforma; se organizações precisarem de ordem explícita, isso é atributo novo ("ordem no escopo") a decidir.
8. **Execuções órfãs versus eliminadas** — resolvida: B41 emendada (Execuções eliminadas com a Automação e com o Agente; Registros e efeitos permanecem — DO-AUT-17).
