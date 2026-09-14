# HABILIDADE

> Domínio: IA | Documento 18 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

Uma **Habilidade** é uma competência empacotada, reutilizável e versionada: um conjunto declarado de **instruções** dirigidas a um executor com raciocínio, de **Ferramentas requeridas**, de um **contrato de entrada e de saída** e de **dependências** (outras Habilidades), que um Agente pode **exercer** durante uma Execução (B15, B16, B17, B24).

A Habilidade descreve *como fazer algo bem definido* ("qualificar um lead", "resumir uma Conversa", "preparar uma proposta a partir de um Negócio") sem dizer *quando* fazê-lo nem *quem* o fará. Não age, não reage, não decide: é definição. O que age é o Agente que a exerce; o que reage é a Automação que invoca o Agente; o que executa operações concretas sobre a plataforma são as Ferramentas que a Habilidade requer.

Três propriedades a distinguem dos vizinhos:

1. **Exige raciocínio para ser exercida.** Uma Ferramenta é executada; uma Habilidade é exercida. Só um Agente (com Modelo) a exerce, porque suas instruções pressupõem interpretação, escolha de Ferramentas e composição de resultado (B16).
2. **Não tem gatilho.** Nada a dispara. Ela é exercida quando um Agente, dentro de uma Execução, decide ou é solicitado a exercê-la (B17).
3. **É definição sem estado operacional.** Não tem Memória, Sessões, Execuções próprias nem permissões próprias (DO-ET-11). Tudo o que "acontece" com uma Habilidade acontece na Execução de um Agente.

A Habilidade pertence ao Espaço de Trabalho (**Habilidade do Espaço de Trabalho**) ou é **fornecida pela plataforma** (global, somente leitura, referenciada pelos Espaços de Trabalho — B15; documento 01, seção 8).

## 2. Propósito

- **Reutilização de competência.** A mesma maneira de qualificar um lead serve ao Agente comercial, ao Assistente padrão e ao Agente de triagem, sem ser copiada nas instruções de cada um.
- **Governança separada da do Agente.** Quem sabe *como* a organização qualifica leads (a área comercial) não é necessariamente quem configura Agentes. A Habilidade é o objeto de governança da competência; o Agente, o da atuação.
- **Auditoria e reprodução.** Cada Execução registra "Habilidade X, versão Y, exercida com esta entrada, estas Ferramentas e este resultado" (B24). Sem Habilidade versionada, o comportamento do Agente só é reconstruível lendo instruções livres.
- **Contrato explícito para Automações e Painéis.** Uma Automação que invoca um Agente para "qualificar lead" precisa saber o que entregar e o que receberá; um Painel precisa contar "quantas qualificações a Habilidade fez e quantas falharam". O contrato de entrada/saída dá a ambos um objeto estável.
- **Fronteira de segurança legível.** A Habilidade declara as Ferramentas que usa e os efeitos que produz; quem a concede a um Agente vê antes o que ela pode fazer (B22).

## 3. Natureza da entidade

- **Entidade com identidade própria**, pertencente ao Espaço de Trabalho (pertencimento, não contenção estrutural: é raiz do próprio agregado, cujo escopo é o Espaço de Trabalho — documento 01, seção 8). A variante fornecida pela plataforma é entidade global (seção 24, DO-HAB-02).
- **Configuração com identidade**, no mesmo sentido em que Funil e Template o são (B34): tem identificador, ciclo de vida, versões e permissões, mas não tem estado operacional, Proprietário (DO-HAB-06) nem é Ator (A6.1).
- **Agregado** cuja raiz é a Habilidade e cujos componentes são as **Versões de Habilidade** (entidades internas, seção 7.1) e, dentro de cada Versão, os objetos de valor Contrato de entrada, Contrato de saída, Instruções, Requisitos de Ferramenta e Dependências.
- **Associada** a Agentes por **Concessão de Habilidade** (seção 7.2), associação N:N com atributos, sem identidade própria (B15).
- **Não é** Ator, Sujeito de permissão, Recurso executável por si, Template (seção 4) nem contêiner.

## 4. Fronteira conceitual

### O que é

- Uma competência descrita como instruções + Ferramentas requeridas + contrato + dependências, com versão.
- Um objeto de concessão: existe para ser concedida a Agentes (B15).
- Um objeto de auditoria: toda Execução que a exerce referencia a sua versão (B24).
- Uma unidade de reutilização entre Agentes do mesmo Espaço de Trabalho e, quando fornecida pela plataforma, entre Espaços de Trabalho (sem quebrar A1.2: a plataforma é global; o Espaço de Trabalho apenas a referencia).

### O que não é

- **Não é Ferramenta.** Não é operação atômica nem é executada sem raciocínio (4.1).
- **Não é Automação.** Não tem Gatilho, Condições nem Ações; não reage (4.2).
- **Não é Agente.** Não tem Modelo, Memória, Proprietário, permissões, nível de autonomia nem identidade de Ator; não age (4.4).
- **Não é Template de Agente.** Template gera entidades novas sem vínculo vivo; a Habilidade é referenciada viva por concessão (4.5).
- **Não é instrução do Agente.** As instruções do Agente definem quem ele é e como se comporta em geral; a Habilidade define como executar uma competência específica, reutilizável por vários Agentes (4.6).
- **Não é Ação de Automação.** Ação é passo determinístico; a Habilidade é exercida com raciocínio (4.7).
- **Não é Documento de Conhecimento.** Documento é lido; Habilidade é exercida (4.8).
- **Não é Execução.** Não tem ciclo de vida de funcionamento; é exercida dentro de uma Execução de Agente (seção 7.3).

### 4.1 O que faz uma Habilidade ser diferente de uma Ferramenta?

| Critério | Ferramenta | Habilidade |
| --- | --- | --- |
| Natureza | Operação **atômica** exposta pela plataforma ou por uma Integração (B16). | Competência **composta**, que orquestra zero ou mais Ferramentas segundo instruções. |
| Raciocínio | Nenhum. Recebe entrada válida, produz saída ou erro, sempre da mesma maneira. | Exige um executor com raciocínio (Agente com Modelo) para interpretar instruções, escolher e sequenciar Ferramentas e compor a saída. |
| Contrato | Entrada/saída tipados, fixos, definidos pela origem (plataforma ou Integração). | Entrada/saída tipados, definidos por quem cria a Habilidade (seção 6). |
| Permissão | Declara a **permissão requerida** sobre o Recurso-alvo (ex.: "criar Tarefa" requer `criar` na Lista); avaliada a cada invocação (B23). | Não tem permissão própria. Fica `indisponível` ao Agente que não tenha permissão de usar cada Ferramenta obrigatória (seção 6, Disponibilidade). |
| Origem | Catálogo da plataforma (global) ou da Integração (pertence ao Espaço de Trabalho enquanto a Integração existir). | Espaço de Trabalho (criada por Membro) ou plataforma (global). |
| Versão | Assinatura mantida pela origem; a Habilidade a requer por identificador estável. | Versionada explicitamente (`rascunho`, `publicada`, `obsoleta` — B24). |
| Quem usa | Agentes (por Ferramentas permitidas) e Automações (como Ações). | Apenas Agentes, por concessão (B15, B17). |

**Exemplo.** "Qualificar lead" é uma Habilidade: instrui o executor a ler o Contato, ler as Conversas recentes, comparar com os critérios de qualificação e atualizar a Qualificação do Contato com justificativa. Ela requer as Ferramentas "ler Contato", "ler Conversa" e "atualizar Qualificação de Contato" (documento 10). Cada uma dessas Ferramentas é atômica, existe sem a Habilidade e é usada por outras Habilidades e por Automações. A Habilidade sem essas Ferramentas não é exercível; as Ferramentas sem a Habilidade continuam disponíveis.

**Cardinalidades.** Uma Habilidade requer 0..N Ferramentas (zero é válido: "resumir Conversa" só precisa do Contexto — seção 20.10). Uma Ferramenta é requerida por 0..N Habilidades. Ferramentas existem sem Habilidades; Habilidades sem Ferramentas obrigatórias são puramente cognitivas.

### 4.2 O que faz uma Habilidade ser diferente de uma Automação?

| Critério | Automação | Habilidade |
| --- | --- | --- |
| Estrutura | Gatilho → Condições → Ações (B16). | Instruções + Ferramentas requeridas + contrato + dependências. |
| Iniciativa | **Reage**: um Gatilho (evento, agendamento, acionamento manual) a dispara. É quem invoca. | **Não reage a nada.** É exercida por um Agente dentro de uma Execução de Agente. |
| Determinismo | Determinística ou híbrida (quando invoca Agente). | Sempre exercida com raciocínio. |
| Escopo | Definida em um escopo (Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada, Fila — B41). | Sem escopo estrutural; pertence ao Espaço de Trabalho inteiro. |
| Execução | Tem Execução de Automação própria (B18). | Não tem Execução própria; é passo de uma Execução de Agente (7.3). |
| Relação entre elas | Pode invocar um Agente indicando a Habilidade que ele deve exercer. **Nunca invoca a Habilidade diretamente** (B17). | Nunca invoca Automação; o Agente que a exerce pode produzir eventos que Gatilhos escutam (B16). |

**Exemplo.** A Automação "quando Conversa criada na Fila Comercial → invocar Agente Comercial para qualificar lead" tem Gatilho (Conversa criada), Condição (Fila = Comercial) e Ação (invocar Agente, com a Habilidade "qualificar lead" indicada como exercício solicitado). A Execução de Automação contém a Execução do Agente (B18); a Execução do Agente contém o Exercício da Habilidade. Remover a Automação não afeta a Habilidade; remover a Habilidade torna a Ação da Automação inválida na próxima disparada, com Registro de Atividade (20.9).

### 4.3 Um Agente possui Habilidades ou apenas recebe permissão para utilizá-las?

**Recebe concessão** (B15). A relação "Agente — tem concedida — Habilidade" é uma associação N:N (Concessão de Habilidade, 7.2). A Habilidade existe independentemente do Agente; o Agente existe independentemente da Habilidade. Consequências:

1. **Existência independente.** Remover a Habilidade retira a concessão de todos os Agentes; remover o Agente elimina as suas concessões e não afeta a Habilidade. Um Agente sem Habilidades é válido (B15).
2. **Versionamento independente.** A Habilidade evolui por versões; o Agente evolui por versões (B24). Publicar nova versão da Habilidade **não** cria nova Versão de Agente: a concessão referencia a Habilidade por identidade. A versão efetivamente exercida é registrada na Execução, não na configuração do Agente.
3. **Versão seguida ou fixada.** Por padrão, a concessão **segue a versão `publicada` mais recente** da Habilidade (Versão corrente). A concessão pode, por ato explícito, **fixar** uma versão `publicada` específica. Recomendação: seguir por padrão, porque o objetivo de versionar é auditoria e reprodução (B24), não congelamento; fixar é exceção para Agentes sensíveis (ex.: um Agente `autônomo` que envia Mensagens a Contatos), em que a organização quer validar cada versão antes de adotá-la (DO-HAB-05).
4. **Permissões não são transferidas.** A Habilidade não tem permissões; portanto nada "passa" ao Agente pela concessão. O Agente precisa ter, por sua própria configuração (Ferramentas permitidas — Glossário, Agente) e pelas suas permissões sobre os registros (A6.3, A9.3), o direito de usar cada Ferramenta obrigatória da Habilidade. Se não tiver, a Habilidade fica **`indisponível`** para ele — atributo **derivado** da concessão (seção 6), recalculado a cada consulta e verificado no início de cada exercício e a cada Ferramenta invocada (B23). Conceder Habilidade nunca é atalho de permissão (INV-HAB-06).
5. **Concessão é a origem da permissão `executar`.** Para efeito da tupla de permissão (A9.1), a Concessão de Habilidade **é** a permissão (Agente, `executar`, Habilidade, `registro`, concessão direta). Não há outra forma de um Agente obter `executar` sobre uma Habilidade: nem por Papel, nem por compartilhamento (RN-HAB-12).

A alternativa rejeitada — Habilidade como componente do Agente ("o Agente possui as suas Habilidades") — tornaria impossível reutilizar a mesma competência entre Agentes sem cópia, exigiria versionar o Agente a cada mudança de competência e faria a governança da competência coincidir com a do Agente, o que a seção 2 mostra ser indesejável.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Habilidade × Ferramenta** | Competência composta; exige raciocínio; versionada; concedida a Agentes. | Operação atômica; sem raciocínio; contrato e permissão requerida; catálogo da plataforma ou da Integração. | 4.1. Habilidade **usa** Ferramentas; nunca as contém nem as define. |
| **Habilidade × Automação** | Sem gatilho; exercida por Agente; sem escopo estrutural. | Gatilho → Condições → Ações; escopo; invoca Agente. | 4.2. Automação invoca Agente que exerce Habilidade; nunca a Habilidade diretamente (B17). |
| **Habilidade × Agente** | Definição de competência; sem Modelo, Memória, permissões, autonomia, Proprietário; não é Ator. | Ator com identidade, objetivo, instruções, Modelo, Ferramentas permitidas, Conhecimento acessível, permissões, nível de autonomia, Proprietário (Glossário). | O Agente **exerce**; a Habilidade **é exercida**. Tudo o que é sujeito (permissão, autonomia, responsabilidade, custo) está no Agente e na sua Execução. |
| **Habilidade × Template** | Referenciada viva por concessão; alterar a versão publicada altera o que os Agentes que a seguem exercem. | Registro que armazena estrutura reutilizável; instanciar cria entidades novas sem vínculo vivo, só Proveniência (A8). | Habilidade não é instanciada: é concedida. A única operação "de Template" que existe é **copiar** uma Habilidade da plataforma para o Espaço de Trabalho, que cria Habilidade nova com Proveniência (DO-HAB-07). Não existe "Template de Habilidade". |
| **Habilidade × Instruções do Agente** | Competência **específica e reutilizável** ("como qualificar lead"), com contrato e Ferramentas declaradas, versionada por si. | Orientação **geral e própria** do Agente ("você é o assistente comercial da Clínica Vida; seja objetivo; nunca prometa desconto"), versionada com o Agente. | Instruções do Agente moldam todo exercício; as instruções da Habilidade valem só durante o exercício e são as mesmas para todo Agente que a exerce. Uma competência que só um Agente usa pode viver nas instruções dele; quando dois Agentes precisam dela, é Habilidade. |
| **Habilidade × Ação de Automação** | Exercida com raciocínio; resultado não determinístico; passo de Execução de Agente. | Passo **determinístico** de uma Automação: invocação de uma Ferramenta do catálogo ou Ação de controle (aguardar, ramificar, solicitar aprovação, invocar Agente) (Glossário). | Uma Ação "invocar Agente" pode indicar uma Habilidade; a Ação continua determinística (invoca sempre o mesmo Agente com a mesma indicação); o que é não determinístico é o exercício, dentro da Execução do Agente. |
| **Habilidade × Documento de Conhecimento** | Procedimento **executável**: contrato, Ferramentas, dependências; exercido; versionado por publicação. | Conteúdo **consultável**: texto, imagem, áudio, PDF com versões, proveniência e Fragmentos; lido por Membros e Agentes (B19). | Um Documento pode descrever um procedimento ("Política de qualificação de leads"), mas continua sendo lido: não tem contrato, não declara Ferramentas e não é exercido. A Habilidade pode **declarar** que consulta esse Documento (Coleções recomendadas, seção 6); o acesso segue a concessão de Conhecimento do Agente. |
| **Habilidade do Espaço de Trabalho × Habilidade da plataforma** | Pertence ao Espaço de Trabalho; criada, editada e publicada por Membros; eliminável. | Global (fora de qualquer Espaço de Trabalho); somente leitura; versionada pela plataforma; referenciada por concessão; copiável. | Mesma entidade, dois pertencimentos (DO-HAB-02). Copiar cria uma Habilidade do Espaço de Trabalho com Proveniência; conceder referencia a global. |

## 5. Identidade

A Habilidade tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade.

**Teste de identidade.** Se o nome, a descrição, as instruções, o contrato de entrada, o contrato de saída, as Ferramentas requeridas, as dependências, as Coleções recomendadas e os tipos de Arquivo aceitos mudarem — por meio de novas versões —, continua sendo a mesma Habilidade: as Concessões continuam a apontar para ela, as Execuções passadas continuam a referenciá-la (com a versão da época), as Automações que a indicam continuam válidas. A identidade é a **continuidade da competência** como objeto de governança e concessão, não qualquer conteúdo.

Consequências:

- **Versão não é identidade.** Cada Versão de Habilidade tem número sequencial e estado próprios (7.1), mas é componente do agregado; nada fora dele referencia uma versão sem referenciar a Habilidade.
- **Nome não é identidade**, mas é **único** entre Habilidades `ativo` ou `arquivado` do mesmo Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades (RN-HAB-02). Justificativa: Agentes e Automações referenciam Habilidades por nome em instruções e indicações; ambiguidade tornaria o exercício solicitado não determinístico (mesmo princípio de B39). Habilidades da plataforma têm espaço de nomes próprio; o produto as distingue visualmente. Um registro `na lixeira` não reserva o nome.
- **Copiar da plataforma cria outra identidade.** A cópia tem identificador novo e Proveniência (identificador, nome e versão da Habilidade da plataforma à época); não há vínculo vivo (DO-HAB-07).
- **Uma Habilidade nunca muda de Espaço de Trabalho** (A1.1) nem se torna global.

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Opaco, imutável (seção 5). |
| Pertencimento | nativo | sim | Espaço de Trabalho, ou `plataforma` (global). Imutável. |
| Nome | nativo | sim | Único no Espaço de Trabalho entre `ativo`/`arquivado` (RN-HAB-02). Editável sem nova versão (é atributo da Habilidade, não da Versão). |
| Descrição | nativo | não | Finalidade em linguagem natural, para Membros que concedem e para Agentes que decidem exercer. Atributo da Habilidade. |
| Estado de ciclo de vida | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). |
| Criador | referência (Ator) | sim | Membro que a criou; `Sistema` para Habilidades da plataforma e para o ato de cópia (o Membro copiador é Criador da cópia). Imutável (A7). |
| Proveniência | objeto de valor | condicional | Presente quando criada por cópia de Habilidade da plataforma: identificador, nome e versão de origem à época. Sem vínculo vivo (DO-HAB-07). |
| Versões | entidades internas | 1..N | Toda Habilidade tem ao menos a versão 1 (`rascunho` na criação). Seção 7.1. |
| Versão corrente | derivado (referência a Versão) | não | A Versão `publicada` de maior número, 0..1. Vazia enquanto nenhuma versão foi publicada ou todas foram obsoletadas. É o que uma concessão sem versão fixada exerce. |
| Concessões | associações | 0..N | Concessões de Habilidade a Agentes (7.2). |
| Momentos | nativo | sim | Criação, última alteração, arquivamento e exclusão quando aplicáveis. |

Os atributos que **definem a competência** pertencem à **Versão de Habilidade** e são imutáveis depois de publicados (7.1): Instruções, Contrato de entrada, Contrato de saída, Requisitos de Ferramenta, Dependências, Coleções recomendadas, Capacidades de Modelo requeridas, Efeito declarado (derivado). Alterá-los é criar nova versão (B24).

**Disponibilidade** (derivado da Concessão, não da Habilidade — 7.2): `disponível` ou `indisponível` com motivo. Não é atributo da Habilidade porque a mesma Habilidade é `disponível` para um Agente e `indisponível` para outro.

## 7. Entidades internas ou componentes

### 7.1 Versão de Habilidade

Entidade interna do agregado Habilidade, com identificador local (número sequencial a partir de 1, único dentro da Habilidade). Não existe fora da Habilidade; é referenciada externamente **sempre em conjunto com ela** (Execuções: "Habilidade X, versão Y"; Concessões com versão fixada).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Número | nativo | sim | Sequencial, nunca reutilizado. |
| Estado da versão | nativo | sim | `rascunho` (editável; não exercível), `publicada` (imutável; exercível), `obsoleta` (imutável; não exercível; preservada para histórico). Ver 11.2. |
| Instruções | objeto de valor (texto) | sim para publicar | Orientação ao executor: objetivo, critérios, passos sugeridos, formato de saída. Texto; pode citar por nome as Ferramentas requeridas, os parâmetros de entrada e as Coleções recomendadas. Não contém Conhecimento (B19) nem credenciais. |
| Contrato de entrada | objeto de valor | sim (pode ser vazio) | Lista ordenada de **Parâmetros**: nome (único no contrato), tipo, obrigatório, valor padrão, descrição. Tipos: os Tipos de Campo da plataforma (A5.3 — texto, número, data, seleção...), **referência a registro** (com o tipo de entidade: Contato, Negócio, Conversa, Tarefa, Documento de Conhecimento...) e **Arquivo** (com os tipos aceitos: imagem, áudio, vídeo, PDF, documento, planilha). Multimodalidade é declarada aqui (DO-HAB-09). |
| Contrato de saída | objeto de valor | sim (pode ser só texto) | Forma do resultado: **estruturado** (Parâmetros tipados como no contrato de entrada), **texto** (resultado em linguagem natural) ou ambos; e 0..N **Arquivos produzidos** com tipos declarados. |
| Requisitos de Ferramenta | objeto de valor | sim (pode ser vazio) | Lista de Ferramentas requeridas por identificador estável, cada uma marcada **obrigatória** ou **opcional**. Obrigatória: sem ela a Habilidade é `indisponível`. Opcional: a Habilidade é exercível sem ela, com instruções que preveem a ausência. |
| Dependências | objeto de valor | sim (pode ser vazio) | Lista de outras Habilidades requeridas (por identidade; versão fixada opcional). Acíclica; profundidade limitada (RN-HAB-08). |
| Coleções recomendadas | objeto de valor | não | Coleções de Conhecimento que as Instruções pressupõem. Declaração, não concessão: o acesso segue a concessão de Conhecimento do Agente (RN-HAB-10). |
| Capacidades de Modelo requeridas | derivado | — | Derivadas do contrato de entrada e de saída: modalidades que o Modelo do Agente precisa suportar (texto; imagem; áudio; vídeo; documentos). Verificadas contra as Capacidades do Modelo (DO-HAB-10). |
| Efeito declarado | derivado | — | O efeito mais severo entre as Ferramentas requeridas (obrigatórias e opcionais) e as Dependências: `nenhum` (nenhuma Ferramenta de escrita), `reversível`, `irreversível`, `externa` (classes das Ferramentas, 7.4). Usado para exibição na concessão e para governança (RN-HAB-11); a aprovação em tempo de exercício continua por Ferramenta (B22, B23). |
| Publicador | referência (Membro) | condicional | Membro que publicou a versão; `Sistema` para versões da plataforma. Rastreabilidade (análogo ao Membro configurador da Integração, B35), não governança. |
| Momentos | nativo | sim | Criação, publicação, obsolescência. |

Regras de edição: no máximo **uma** versão `rascunho` por Habilidade em cada instante (RN-HAB-04); criar novo rascunho copia a Versão corrente (ou o rascunho descartado) como ponto de partida; descartar o rascunho não é obsoletar (o rascunho é eliminado; a numeração não retrocede).

### 7.2 Concessão de Habilidade

Associação N:N entre Agente e Habilidade, **sem identidade própria** (identificada pelo par), com atributos. Pertence ao Espaço de Trabalho e é eliminada quando qualquer dos lados é eliminado (B15).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Agente | referência | sim | Agente do Espaço de Trabalho. |
| Habilidade | referência | sim | Habilidade do Espaço de Trabalho ou da plataforma. |
| Versão fixada | referência (Versão) | não | Vazio: segue a Versão corrente. Preenchido: exerce essa versão enquanto `publicada`. |
| Concedida por | referência (Membro) | sim | Membro que concedeu (Ator; um Agente nunca concede — INV-HAB-04). |
| Momento | nativo | sim | |
| Disponibilidade | derivado | — | `disponível` ou `indisponível` com motivo(s): Habilidade não `ativo`; sem versão exercível (nenhuma `publicada`, ou fixada `obsoleta`); Ferramenta obrigatória não permitida ao Agente; Ferramenta obrigatória de Integração `desconectada` ou `com erro`; Dependência `indisponível`; Modelo do Agente sem capacidade requerida; Espaço de Trabalho `suspenso`. Recalculada a cada consulta; verificada no início do exercício e a cada Ferramenta (B23). |

A Concessão é, para a tupla de permissão (A9.1), a permissão (Agente, `executar`, Habilidade, `registro`, concessão direta) — 4.3, item 5.

### 7.3 Exercício de Habilidade (objeto de valor da Execução de Agente)

A Habilidade **não tem Execução própria**. Quando um Agente a exerce, a sua Execução de Agente (B18) registra um **Exercício de Habilidade** como **passo**: objeto de valor, sem identidade, contido pela Execução (que pertence ao Agente). Atributos: Habilidade (identificador, nome e versão **à época**, preservados como valor mesmo depois da eliminação da Habilidade), origem do exercício (`solicitado` — indicado pelo invocador da Execução: Automação, Membro em Sessão de Chat, outro Agente; ou `espontâneo` — decidido pelo Agente), entrada (valores dos Parâmetros; referências a registros e Arquivos), saída (conforme contrato), Ferramentas chamadas (cada uma com entrada, resultado, permissão avaliada e Registro de Atividade correspondente), Exercícios aninhados (Dependências exercidas), Solicitações de Aprovação geradas, resultado (`concluído`, `falhou` com motivo, `cancelado`), momentos e custo (C8, medido na Execução).

**Por que não tem identidade** (recomendação DO-HAB-11): nada fora da Execução precisa referenciar "este exercício" de forma independente — Painéis contam Exercícios como Fonte de Dados derivada das Execuções ("Execuções do Agente X que exerceram a Habilidade Y"); Registros de Atividade referenciam a Execução e a Ferramenta; a Solicitação de Aprovação referencia a Execução. Dar-lhe identidade criaria uma segunda entidade de ciclo de vida com os mesmos estados de Execução, sem ganho. Se o produto precisar de "reexecutar só este exercício", isso é uma nova Execução de Agente com exercício solicitado e a mesma entrada.

### 7.4 Ferramenta (definição para os documentos 15, 17 e 19)

Ferramenta não tem documento próprio (A2.5) e não é componente da Habilidade: é **usada** por ela. Fica definida aqui com o rigor de que os demais documentos dependem.

**Definição.** Ferramenta é uma **operação atômica**, sem raciocínio, que a plataforma ou uma Integração expõe a Agentes e Automações, com **contrato de entrada e de saída**, **permissão requerida**, **Recurso-alvo**, **classe de efeito** e **origem** (B16). "Atômica" significa: ou produz integralmente o seu efeito e a sua saída, ou falha sem efeito parcial; não há Ferramenta que "faz várias coisas".

| Elemento | Descrição |
| --- | --- |
| Identificador estável | Nome único no Catálogo de Ferramentas (ex.: `criar Tarefa`, `ler Contato`, `enviar Mensagem`, `consultar Conhecimento`). Para Ferramentas de Integração, qualificado pela Integração. Habilidades e Automações a requerem por esse identificador. |
| Origem | `plataforma` (global; existe em todo Espaço de Trabalho; imutável pelo Espaço de Trabalho) ou `Integração` (exposta por uma Integração do Espaço de Trabalho — documento 01, 7.4; existe enquanto a Integração existir; inoperante enquanto a Integração não estiver `conectada`). Canais expõem as Ferramentas de mensageria (documento 14, 8.6). |
| Contrato de entrada e de saída | Parâmetros tipados, com o mesmo sistema de tipos do contrato de Habilidade (Tipos de Campo, referência a registro, Arquivo com tipos). Mantido pela origem; a Habilidade não o altera. |
| Recurso-alvo | Tipo de entidade (e, quando aplicável, contêiner) sobre o qual opera: `criar Tarefa` → Lista; `ler Contato` → Contato; `enviar Mensagem` → Conversa. |
| Permissão requerida | Ação da tupla A9.1 sobre o Recurso-alvo: `criar Tarefa` requer `criar` na Lista; `atualizar Qualificação de Contato` requer `editar` no Contato. Avaliada **a cada invocação**, sobre o registro concreto, com a permissão efetiva do Ator (A6.3; A9.3; B23). Ferramentas de leitura requerem `ver`. |
| Classe de efeito | `leitura` (sem efeito), `escrita reversível` (o efeito pode ser desfeito pela própria plataforma: editar atributo, aplicar Tag, criar registro que vai à lixeira), `escrita irreversível` (excluir permanentemente, mesclar, marcar Negócio `ganho` — conforme cada documento de entidade classifica), `externa` (produz efeito fora da plataforma: enviar Mensagem a Contato, chamar sistema externo por Integração). Recomendação: toda Ferramenta de escrita de origem `Integração` é `externa`. A classe alimenta B22: `assistido` aprova toda escrita; `supervisionado` aprova `irreversível` e `externa`; `autônomo` executa dentro das permissões. |
| Uso por Agente | O Agente só invoca Ferramentas que lhe são **permitidas** (configuração do Agente, documento 17: permissão `executar` sobre a Ferramenta). Permitir a Ferramenta não dispensa a permissão requerida sobre o registro: são duas verificações (RN-HAB-13). |
| Uso por Automação | Ações de Automação que alteram registros são invocações de Ferramentas do mesmo catálogo (Glossário, Ação); o documento 19 acrescenta Ações de controle (aguardar, ramificar, solicitar aprovação, invocar Agente). |
| Catálogo de Ferramentas | Conjunto derivado, por Espaço de Trabalho: Ferramentas da plataforma ∪ Ferramentas das Integrações do Espaço de Trabalho. Não é entidade; é consulta. |
| Alteração de contrato pela origem | Compatível (novo parâmetro opcional; novo campo de saída): Habilidades que a requerem não são afetadas. Incompatível (parâmetro obrigatório novo, remoção, mudança de tipo): a origem publica Ferramenta com identificador novo e marca a antiga como descontinuada; Habilidades que requerem a descontinuada ficam `indisponível` com motivo, e o evento "Ferramenta descontinuada" é emitido (20.14). |

Ferramenta **não é** Sujeito, Ator (a Integração é o Ator; a Ferramenta é o meio), Habilidade, Ação de controle nem Recurso com estado próprio; Ferramentas de Integração seguem o estado da Integração.

### 7.5 O que não é componente

Agente, Execução, Modelo, Coleção, Arquivo, Ferramenta, Solicitação de Aprovação e Contexto são referenciados ou usados, nunca contidos (seção 21).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | Habilidade → ET | Raiz do próprio agregado; escopo do ET (documento 01, 8). Habilidade da plataforma não tem esta relação (global). |
| contém Versões | Versão de Habilidade | contenção (composição) | Habilidade → Versão | 1..N; sem existência fora. |
| é concedida a | Agente | associação (Concessão) | Habilidade ↔ Agente | N:N; 7.2. Eliminada por qualquer dos lados. |
| requer Ferramentas | Ferramenta | referência (uso) | Versão → Ferramenta | Por identificador estável; obrigatória ou opcional. A Ferramenta não conhece a Habilidade. |
| depende de | Habilidade | associação (Dependência) | Versão → Habilidade | N:N acíclica, profundidade limitada (RN-HAB-08). Versão fixada opcional. |
| recomenda Coleções | Coleção | referência | Versão → Coleção | Declaração; não concede acesso (RN-HAB-10). Coleção eliminada: a referência fica inválida, a Habilidade continua exercível. |
| é exercida em | Execução de Agente | referência inversa (Exercício) | Execução → Habilidade + versão | A Execução referencia; a Habilidade não conhece as suas Execuções (consulta derivada). |
| é indicada por | Automação (Ação "invocar Agente") | referência | Automação → Habilidade | Exercício solicitado (7.3). Habilidade eliminada: referência inválida, Ação falha com Registro (B41 por analogia). |
| foi criada por | Membro / Sistema | referência | Habilidade → Ator | Criador imutável (A7). |
| foi publicada por | Membro / Sistema | referência | Versão → Ator | Publicador (7.1). |
| foi copiada de | Habilidade da plataforma | Proveniência (objeto de valor) | Habilidade → origem | Sem vínculo vivo (DO-HAB-07). |
| requer capacidades de | Modelo | referência derivada | Versão → capacidades | Verificação de compatibilidade (DO-HAB-10); a Habilidade não referencia um Modelo específico. |
| é referenciada por | Template de Agente | referência | Template → Habilidade | O Template de Agente (A8) lista Habilidades a conceder na instanciação, por identidade; ausente ou não `ativo`, a concessão é omitida com Registro (20.15). |

Distinção aplicada: **CONTER** (Versões); **USAR** (Ferramentas, Contexto da Execução); **REFERENCIAR** (Coleções recomendadas, Criador, Publicador, Proveniência); **RELACIONAR-SE** (Concessão, Dependência — associações); **SER REFERENCIADA** (Execução, Automação, Template de Agente). A Habilidade **não herda** de nada e **não configura** nada fora de si.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Habilidade | 0..N | sim | sim | pertencimento | Um ET pode operar só com Habilidades da plataforma ou sem nenhuma (documento 01, 9). |
| Habilidade → ET | 1 (ou plataforma) | não (salvo global) | não | pertencimento | A1.1. |
| Habilidade → Versão | 1..N | não | sim | composição | A versão 1 nasce com a Habilidade (12.1). |
| Habilidade → Versão `publicada` | 0..N | sim | sim | composição | Várias podem coexistir `publicada` para que concessões fixadas continuem exercíveis; a corrente é a de maior número (DO-HAB-04). |
| Habilidade → Versão `rascunho` | 0..1 | sim | não | composição | Um rascunho por vez evita dois futuros concorrentes para a mesma competência (RN-HAB-04). |
| Habilidade → Versão corrente | 0..1 | sim | não | derivado | Vazia até a primeira publicação ou depois de obsoletar todas. |
| Habilidade → Agente (Concessão) | 0..N | sim | sim | associativa | Habilidade criada e ainda não concedida é válida. |
| Agente → Habilidade (Concessão) | 0..N | sim | sim | associativa | B15. |
| Concessão → Versão fixada | 0..1 | sim | não | referência | Padrão: segue a corrente. |
| Versão → Ferramenta requerida | 0..N | sim | sim | referência | Zero: Habilidade puramente cognitiva (20.10). |
| Ferramenta → Habilidade que a requer | 0..N | sim | sim | referência inversa | Ferramentas existem sem Habilidades. |
| Versão → Dependência (Habilidade) | 0..N | sim | sim | associativa | Composição é opcional (DO-HAB-08). |
| Habilidade → dependentes | 0..N | sim | sim | associativa inversa | |
| Versão → Coleção recomendada | 0..N | sim | sim | referência | |
| Versão → Parâmetro de entrada / de saída | 0..N | sim | sim | objeto de valor | Contrato vazio é válido ("resumir a Conversa do Contexto"). |
| Execução de Agente → Exercício | 0..N | sim | sim | objeto de valor (contido) | Uma Execução pode exercer várias Habilidades, a mesma várias vezes, ou nenhuma. |
| Exercício → Habilidade + Versão | 1 | não | não | referência (valor à época) | Sobrevive à eliminação da Habilidade como valor. |
| Automação (Ação) → Habilidade indicada | 0..1 por Ação "invocar Agente" | sim | não | referência | Invocar Agente sem Habilidade indicada é válido (o Agente decide). |
| Habilidade → Proprietário | 0 | — | — | — | Não tem (DO-HAB-06). |

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Nenhuma. A Habilidade está no domínio IA, par da Estrutura de Trabalho (A2.2); não pertence a Espaço, Pasta, Lista, Funil ou Caixa de Entrada e não tem contêiner intermediário. Dependências entre Habilidades formam um grafo acíclico, não uma hierarquia de contenção: a Habilidade dependente **usa** a requerida, não a contém; eliminar a requerida não elimina a dependente (torna-a `indisponível`).

**Pertencimento (teste de existência).** A Habilidade do Espaço de Trabalho não existe sem ele: eliminado o Espaço de Trabalho, ela é eliminada (B32). As Versões não existem sem a Habilidade. A Concessão não existe sem ambos os lados. O Exercício não existe sem a Execução. A Habilidade da plataforma existe sem qualquer Espaço de Trabalho.

**"Pertence a" versus "relaciona-se com".** A Habilidade *pertence* ao Espaço de Trabalho; *relaciona-se com* Agentes (Concessão), com outras Habilidades (Dependência) e com Coleções (recomendação). Agente e Habilidade existem um sem o outro (B15).

**Propriedade.** A Habilidade **não tem Proprietário** (DO-HAB-06, RECOMENDADA). A7 não a lista, e três razões sustentam a omissão: (a) é configuração com identidade sem estado operacional — como Funil e Template, que também não têm Proprietário (documento 12, 4; B34); (b) não é Ator, não age e não tem permissões próprias — a accountability humana (B7) que o Proprietário garante recai sobre o Agente que a exerce e o seu Proprietário; (c) Habilidades da plataforma são globais e não poderiam ter Proprietário Membro, e uma assimetria "com Proprietário no Espaço de Trabalho, sem Proprietário na plataforma" duplicaria regras de sucessão (B28) sem função. A governança é por Papel e por concessão `administrar` (seção 17); a rastreabilidade, por Criador e Publicador. Consequência: Habilidades **não entram na sucessão** de B28; remover o Membro Criador ou Publicador não as afeta.

**Configurar não é conter.** Conceder Habilidades a um Agente é configurar o Agente; não torna a Habilidade componente dele. Declarar Ferramentas requeridas é usar; não torna a Ferramenta componente da Habilidade.

## 11. Estados

### 11.1 Estados da Habilidade

Estado de ciclo de vida de sistema (A4.1), não personalizável; não há Status.

| Estado | Significado | O que é possível |
| --- | --- | --- |
| `ativo` | Em uso normal. | Ver, editar rascunho, publicar, conceder, exercer (se houver versão exercível). |
| `arquivado` | Retirada de uso, preservada. | Ver, restaurar. **Não** conceder, não editar, não publicar, não exercer: toda Concessão fica `indisponível` (motivo: arquivada). Exercícios em andamento terminam (12.3). Oculta em listas de concessão e para Agentes. |
| `na lixeira` | Excluída de forma recuperável, pelo prazo da Política de lixeira. | Ver (por quem tem `excluir`), restaurar. Concessões `indisponível`; oculta em toda parte. |

Eliminação permanente não é estado: é o fim do registro (12.4).

### 11.2 Estados da Versão de Habilidade

| Estado | Significado | Transições |
| --- | --- | --- |
| `rascunho` | Em edição; não exercível; não concedível como versão fixada. | → `publicada` (publicar); → eliminada (descartar). |
| `publicada` | Imutável; exercível; fixável. | → `obsoleta` (obsoletar). Nunca volta a `rascunho`. |
| `obsoleta` | Imutável; **não** exercível; preservada para Execuções passadas. | Terminal. Nunca é eliminada enquanto a Habilidade existir (INV-HAB-03). |

Estado de Versão e estado da Habilidade são independentes: uma Habilidade `arquivado` mantém as suas versões `publicada` (inexercíveis por causa do estado da Habilidade, não do estado da versão).

### 11.3 Disponibilidade da Concessão

Derivada (7.2). Não é estado gravado: é avaliada a cada consulta e a cada verificação de exercício.

## 12. Ciclo de vida

### 12.1 Criação

- **Por Membro** com `criar` sobre Habilidades (seção 17): nasce `ativo`, com a versão 1 em `rascunho`, Criador = Membro, sem Concessões. Nome obrigatório e único (RN-HAB-02).
- **Por cópia de Habilidade da plataforma** (DO-HAB-07): mesma permissão; nasce `ativo` com a versão 1 em `rascunho` **idêntica** à versão da plataforma escolhida (a corrente por padrão), com Proveniência; Criador = Membro copiador. A cópia não é publicada automaticamente: nada é exercível sem publicação explícita por um Membro (RN-HAB-05). As Concessões à Habilidade da plataforma não migram para a cópia.
- **Por instanciação de Template de Agente**: não cria Habilidades; cria Concessões às Habilidades que o Template referencia (20.15).
- **Pela plataforma**: Habilidades globais são criadas e versionadas fora da ontologia dos Sujeitos (17.5); o Espaço de Trabalho as vê como `ativo` com Versão corrente.
- **Um Agente nunca cria Habilidade** (INV-HAB-04). Se um Agente "propõe" uma competência nova, o resultado é texto (saída de Execução, Comentário, Documento) que um Membro pode transformar em Habilidade.

### 12.2 Versões

- **Editar** = editar o rascunho (`editar`). Se não há rascunho, "editar" cria um novo rascunho a partir da Versão corrente (número seguinte). No máximo um rascunho (RN-HAB-04).
- **Publicar** (`administrar`) valida o rascunho (RN-HAB-06: instruções presentes; nomes de Parâmetros únicos; Ferramentas requeridas existentes no Catálogo do Espaço de Trabalho; Dependências existentes, `ativo`, sem ciclo e dentro da profundidade; Coleções recomendadas existentes) e o torna `publicada`, Publicador = Membro. A nova versão passa a ser a corrente; as Concessões que seguem a corrente passam a exercê-la a partir do **próximo** exercício (20.5). A versão anterior permanece `publicada` (exercível por concessões que a fixaram) até ser obsoletada.
- **Obsoletar** (`administrar`) uma versão `publicada`: concessões fixadas nela ficam `indisponível` com motivo e evento (20.7); se era a corrente, a corrente passa a ser a `publicada` de maior número restante, ou vazia. Obsoletar não afeta Execuções passadas.
- **Descartar rascunho** (`editar`): elimina o rascunho; a numeração não é reutilizada.

### 12.3 Transições da Habilidade

- **Arquivar / desarquivar** (`administrar`): todas as Concessões passam a `indisponível` / voltam a ser avaliadas. Exercícios em andamento **terminam com a versão carregada** (20.2); novos exercícios não a encontram. Automações que a indicam falham na próxima disparada com Registro. Um rascunho existente é preservado.
- **Enviar à lixeira / restaurar** (`excluir`): como arquivar, e além disso oculta. Restaurar devolve ao estado anterior à exclusão (`ativo` ou `arquivado`), no mesmo padrão de B43; colisão de nome na restauração é rejeitada até renomear (RN-HAB-02).
- **Renomear, alterar descrição**: atos sobre a Habilidade, sem nova versão, com Registro de Atividade.

### 12.4 Eliminação permanente e cascata

Por prazo da Política de lixeira ou por eliminação antecipada (`administrar`). Elimina a Habilidade e **todas** as suas Versões (inclusive `obsoleta`); **remove todas as Concessões**; Dependências de outras Habilidades para ela passam a referência inválida (as dependentes ficam `indisponível` com motivo e evento); Automações que a indicam passam a referência inválida; Templates de Agente que a referenciam deixam de concedê-la (20.15). **Execuções passadas são preservadas** (B18): o Exercício guarda identificador, nome e versão como valor (20.13). Nenhum Agente, Automação, Registro de Atividade ou Execução é eliminado em cascata. Eliminação do Espaço de Trabalho elimina as suas Habilidades (B32); Habilidades da plataforma não são afetadas.

### 12.5 Ciclo de vida das Habilidades da plataforma vistas pelo Espaço de Trabalho

A plataforma publica versões (as Concessões que seguem a corrente passam a exercê-las; as fixadas não mudam — 20.6), obsoleta versões (concessões fixadas ficam `indisponível`) e pode arquivar uma Habilidade global (todas as Concessões, em todos os Espaços de Trabalho, ficam `indisponível`, com evento). Nenhum Sujeito do Espaço de Trabalho edita, publica, arquiva ou elimina uma Habilidade da plataforma (INV-HAB-07).

## 13. Regras de negócio ontológicas

- **RN-HAB-01.** Toda Habilidade pertence a exatamente um Espaço de Trabalho ou é global da plataforma; o pertencimento é imutável (A1.1; DO-HAB-02).
- **RN-HAB-02.** O nome é único entre Habilidades `ativo` ou `arquivado` do mesmo Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades; `na lixeira` não reserva; criar, renomear e restaurar com colisão são rejeitados até renomear. Habilidades da plataforma têm espaço de nomes próprio.
- **RN-HAB-03.** Só uma Versão `publicada` é exercível. `rascunho` e `obsoleta` nunca são exercidas, ainda que fixadas ou indicadas.
- **RN-HAB-04.** Existe no máximo uma Versão `rascunho` por Habilidade em cada instante.
- **RN-HAB-05.** Nenhuma versão passa a `publicada` sem ato explícito de um Membro com `administrar` (ou da plataforma, para Habilidades globais). Cópia da plataforma nasce `rascunho`.
- **RN-HAB-06.** Publicar valida: Instruções não vazias; nomes de Parâmetros únicos por contrato; toda Ferramenta requerida existe no Catálogo do Espaço de Trabalho (plataforma ou Integração existente, ainda que desconectada); toda Dependência existe, está `ativo`, tem Versão corrente (ou a versão fixada `publicada`), não forma ciclo e respeita a profundidade máxima; Coleções recomendadas existem. Falha em qualquer item rejeita a publicação sem efeito.
- **RN-HAB-07.** Versões `publicada` e `obsoleta` são imutáveis em todos os seus atributos. Corrigir é publicar nova versão.
- **RN-HAB-08.** Dependências formam um grafo dirigido **acíclico** (uma Habilidade nunca depende de si mesma, direta ou transitivamente) com **profundidade máxima** definida como Limite imposto pela plataforma (B34; recomendação: 3 níveis abaixo da Habilidade raiz). Adicionar uma Dependência que criaria ciclo ou excederia a profundidade é rejeitado no rascunho e na publicação (20.8).
- **RN-HAB-09.** Exercer uma Habilidade com Dependências exerce as Dependências **dentro** do mesmo Exercício (aninhados), sem exigir Concessão separada das Dependências ao Agente; as Ferramentas obrigatórias de toda a cadeia precisam ser permitidas ao Agente e a Disponibilidade é avaliada sobre o fecho transitivo (DO-HAB-08).
- **RN-HAB-10.** Coleções recomendadas são declaração. O Agente só consulta as Coleções a que tem acesso por concessão própria de Conhecimento (documento 20); sem acesso, o exercício prossegue sem elas e o Exercício registra a ausência.
- **RN-HAB-11.** O Efeito declarado é exibido a quem concede e a quem publica; o produto pode exigir aprovação de Administrador para conceder Habilidade com efeito `externa` ou `irreversível` a Agente `autônomo`. A aprovação em tempo de exercício segue B22 **por Ferramenta invocada**, com a classe de efeito da Ferramenta (7.4), nunca pelo Efeito declarado agregado.
- **RN-HAB-12.** A única origem de `executar` sobre uma Habilidade para um Agente é a Concessão de Habilidade. Papel, herança e compartilhamento não a concedem. Conceder exige `executar` sobre a Habilidade e `editar` sobre o Agente por parte do Membro concedente.
- **RN-HAB-13.** Ao exercer, o Agente invoca cada Ferramenta requerida sob duas verificações independentes: a Ferramenta é permitida ao Agente (`executar` sobre a Ferramenta) e a permissão requerida sobre o registro-alvo é satisfeita pela permissão efetiva do Ator (A6.3; A9.3). Ambas a cada invocação (B23). Falha em Ferramenta obrigatória: o Exercício passa a `falhou` e a Execução segue B23 (`falhou` ou `aguardando aprovação` se houver alternativa). Falha em Ferramenta opcional: o Exercício prossegue com o fato no Contexto.
- **RN-HAB-14.** O exercício resolve a versão **no início** (corrente, ou fixada) e a mantém até o fim, mesmo que outra versão seja publicada ou a Habilidade seja arquivada durante o exercício (20.2, 20.5).
- **RN-HAB-15.** Entrada que viole o contrato (Parâmetro obrigatório ausente, tipo incompatível, Arquivo de tipo não aceito, referência a registro que o Agente não vê) impede o início do exercício, com registro do motivo; o Agente não "adivinha" Parâmetros obrigatórios. Referência a registro sem `ver` é tratada como ausente (A6.3): o Agente não recebe o conteúdo nem confirmação de existência além do que o Vínculo ou a entrada já revelam.
- **RN-HAB-16.** A Habilidade recebe o Contexto da Execução que a exerce (Glossário, Contexto); não constrói Contexto próprio nem o retém entre exercícios. Tudo o que persiste é Memória do Agente (documento 17), sujeita às suas regras.
- **RN-HAB-17.** Compatibilidade de Modelo: no início do exercício, as Capacidades de Modelo requeridas são verificadas contra as Capacidades do Modelo do Agente; incompatibilidade impede o exercício com motivo registrado (20.11). A verificação também alimenta a Disponibilidade da Concessão.
- **RN-HAB-18.** Ferramenta obrigatória de Integração não `conectada` torna a Concessão `indisponível`; o exercício que tentar invocá-la falha como em RN-HAB-13 (20.4).
- **RN-HAB-19.** Em Espaço de Trabalho `suspenso`, nenhuma Habilidade é exercida nem publicada; exercícios em andamento são cancelados com a Execução (B31).
- **RN-HAB-20.** Toda criação, edição de rascunho, publicação, obsolescência, concessão, fixação de versão, revogação, arquivamento, exclusão, restauração e eliminação gera Registro de Atividade com Ator (A6.2). Exercícios são registrados na Execução (B18), e cada Ferramenta invocada gera o Registro que a própria Ferramenta gera.

## 14. Invariantes

- **INV-HAB-01.** Toda Habilidade tem ao menos uma Versão; a versão 1 existe desde a criação.
- **INV-HAB-02.** Em cada instante, uma Habilidade tem no máximo uma Versão `rascunho` e no máximo uma Versão corrente (a `publicada` de maior número).
- **INV-HAB-03.** Nenhuma Versão `publicada` ou `obsoleta` é alterada ou eliminada enquanto a Habilidade existir; toda Execução que referencia (Habilidade, versão) referencia uma versão que existiu.
- **INV-HAB-04.** Nenhum Agente cria, edita, publica, obsoleta, arquiva, exclui, elimina ou concede Habilidade, nem para si nem para outro Agente. Todos esses atos têm Ator Membro (ou Sistema/plataforma).
- **INV-HAB-05.** O grafo de Dependências é acíclico e respeita a profundidade máxima em todo estado válido; uma publicação nunca o viola.
- **INV-HAB-06.** Conceder uma Habilidade nunca amplia as permissões efetivas do Agente sobre Ferramentas ou registros. A permissão efetiva do Agente é a mesma antes e depois da concessão.
- **INV-HAB-07.** Nenhum Sujeito de um Espaço de Trabalho altera uma Habilidade da plataforma; um Espaço de Trabalho só a referencia (concede) ou a copia.
- **INV-HAB-08.** Toda Concessão referencia um Agente e uma Habilidade existentes; a eliminação de qualquer dos dois elimina a Concessão no mesmo ato.
- **INV-HAB-09.** Nenhum Exercício de Habilidade existe fora de uma Execução de Agente (B17). Não há exercício por Automação, Integração, Sistema ou Membro sem Agente.
- **INV-HAB-10.** A Habilidade não tem Proprietário, Memória, Execução própria, permissões próprias nem nível de autonomia.
- **INV-HAB-11.** A versão exercida em um Exercício é única e fixa do início ao fim do exercício.

## 15. Personalização

A Habilidade **é** configuração: tudo o que a define (instruções, contratos, Ferramentas, Dependências, Coleções recomendadas) é personalização da competência pela organização, versionada. Não há, além disso, personalização no sentido de A5/A8:

- **Campos Personalizados**: não se aplicam (A5.2 não lista Habilidade; pedido análogo ao de C13 se surgir).
- **Tags**: não se aplicam (A8). Classificação de Habilidades, se necessária ao produto, é atributo de exibição, não Tag.
- **Comentários**: não se aplicam (A8). Discussão sobre uma Habilidade ocorre em Tarefa ou Documento.
- **Status personalizável**: não existe; os estados são de sistema (11).
- **Parâmetros de entrada** são a forma pela qual quem exerce personaliza um exercício, sem alterar a Habilidade.

Habilidades da plataforma não são personalizáveis pelo Espaço de Trabalho; a personalização é feita copiando (12.1).

## 16. Herança

- **Da Estrutura de Trabalho**: nenhuma. A Habilidade não está na hierarquia (A2.2) e não tem ponto de definição nem modo de herança (B25).
- **Entre versões**: um rascunho **começa como cópia** da Versão corrente; não é herança — depois de criado, evolui de forma independente.
- **Entre Dependências**: a dependente **não herda** contrato, Ferramentas nem instruções da requerida; as Ferramentas da requerida contam para a Disponibilidade (RN-HAB-09), o que é uso transitivo, não herança.
- **Da plataforma para a cópia**: Proveniência, não herança; nova versão da Habilidade global **não** se propaga à cópia.
- **Do Agente**: a Habilidade não herda permissões, Modelo, nível de autonomia ou Memória do Agente; o Agente não herda nada da Habilidade (INV-HAB-06). O exercício ocorre **sob** as permissões e a autonomia do Agente.
- **Do Espaço de Trabalho**: Localidade (idioma padrão, fuso) como padrão de apresentação dos exercícios, como toda entidade (documento 01, 16).

## 17. Permissões e visibilidade

### 17.1 Recursos e ações

Recurso **Habilidade** (e o conjunto "Habilidades" do Espaço de Trabalho, para `criar`):

| Ação | Sobre a Habilidade do Espaço de Trabalho | Sobre a Habilidade da plataforma |
| --- | --- | --- |
| ver | Ver nome, descrição, versões (inclusive rascunho), contratos, Ferramentas, Dependências, Concessões, Registros de Atividade. | Idem, exceto rascunho (não existe para o ET). |
| comentar | Não se aplica (A8). | Não se aplica. |
| criar | Criar Habilidade nova; copiar da plataforma (cria no ET). | — (copiar é `criar` no ET). |
| editar | Editar o rascunho; criar rascunho novo a partir da corrente; descartar rascunho; renomear; alterar descrição. | Nunca (INV-HAB-07). |
| excluir | Enviar à lixeira; restaurar. | Nunca. |
| administrar | Publicar; obsoletar; arquivar e desarquivar; eliminar antecipadamente; conceder permissões sobre a Habilidade. | Nunca. |
| executar | **Poder concedê-la a Agentes** (com `editar` no Agente) e fixar/liberar versão na Concessão. Para o Agente, `executar` existe apenas como Concessão (RN-HAB-12). | Idem. |

Escopos: `registro` (uma Habilidade) e `próprios` (Habilidades de que o Sujeito é Criador — B29). `subárvore` não se aplica.

### 17.2 Origens e padrão recomendado

| Papel | Padrão (recomendação; produto pode ajustar) |
| --- | --- |
| Proprietário do ET / Administrador | Tudo sobre todas as Habilidades do ET (`ver`, `criar`, `editar`, `excluir`, `administrar`, `executar`); `ver` e `executar` sobre as da plataforma. |
| Membro | `ver` sobre todas as Habilidades do ET e da plataforma (são configuração, não dados operacionais); nenhuma outra ação por Papel. `criar`, `editar`, `executar` e `administrar` por concessão direta de um Administrador, em `registro` ou `próprios` (ex.: "a coordenadora comercial administra as Habilidades que criou"). Papéis personalizados de base Membro podem restringir `ver`. |
| Convidado | Nada por Papel; `ver` só por compartilhamento. Nunca `criar`, `editar`, `administrar` ou `executar`. |
| Agente | **Nunca** `criar`, `editar`, `excluir`, `administrar` ou `executar`-como-concedente (INV-HAB-04; INV-ET-13 por analogia). `executar` só como Concessão (RN-HAB-12). `ver` não é necessário para exercer: as instruções são carregadas pela Execução; um Agente pode ter `ver` para listar Habilidades disponíveis quando o Contexto o exigir. |

Governança de Habilidades **não** é ação de governança do Espaço de Trabalho no sentido de B30 (é concedível por concessão direta), porque Habilidade é configuração de domínio, como Funil, e não estrutura organizacional.

### 17.3 Visibilidade das instruções

Quem tem `ver` sobre a Habilidade lê as instruções. Instruções não devem conter dados operacionais nem credenciais (7.1): a única forma de o exercício acessar dados é por Ferramenta ou Conhecimento, sob permissão. Uma organização que considere instruções sensíveis restringe `ver` por Papel personalizado ou concessão.

### 17.4 IA sujeita às mesmas regras

O Agente exerce a Habilidade com as suas permissões (A6.3); em nome de um Membro, pela interseção (A9.3); autônomo, só as próprias. A Concessão não amplia nada (INV-HAB-06). Cada Ferramenta é verificada duas vezes (RN-HAB-13) a cada invocação (B23). Nível de autonomia (B22) decide, por Ferramenta e pela classe de efeito, se há Solicitação de Aprovação; a Automação pode reduzir o Nível de autonomia efetivo, nunca ampliá-lo. Painéis sobre Exercícios filtram pelo visualizador (B20): um Membro que não vê o Agente não vê os seus Exercícios.

### 17.5 Exceções

Não há exceções ao isolamento (INV-ET-07). A plataforma cria, versiona, obsoleta e arquiva Habilidades globais fora da ontologia dos Sujeitos (documento 01, 17.4). O Sistema elimina por prazo de lixeira e recalcula Disponibilidade sem Sujeito de permissão: ação do Sistema, registrada quando produz efeito (evento "Disponibilidade alterada").

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Habilidade criada | 12.1 | Habilidade, Criador, origem (nova, cópia com Proveniência) | Auditoria; produto (lista) |
| Habilidade renomeada / descrição alterada | 12.3 | Habilidade, antes, depois, Ator | Auditoria; Automações que a indicam por nome |
| Rascunho criado / descartado | 12.2 | Habilidade, número da versão, base, Ator | Auditoria |
| Versão publicada | 12.2 | Habilidade, versão, Publicador, Efeito declarado, Ferramentas requeridas, Dependências; contagem de Concessões que seguem a corrente | Agentes (próximo exercício); Administradores (notificação quando o Efeito declarado aumenta); Painéis |
| Versão obsoletada | 12.2 | Habilidade, versão, Ator, Concessões fixadas afetadas | Notificação aos Proprietários dos Agentes afetados; Disponibilidade |
| Habilidade concedida / revogada | 7.2 | Agente, Habilidade, versão fixada, Membro concedente, Efeito declarado | Auditoria; Proprietário do Agente; Disponibilidade |
| Versão fixada / liberada na Concessão | 7.2 | Agente, Habilidade, versão, Ator | Auditoria |
| Disponibilidade alterada | 7.2 | Agente, Habilidade, `disponível`/`indisponível`, motivo(s), causa (arquivamento, Ferramenta não permitida, Integração desconectada, Modelo incompatível, Dependência, obsolescência) | Proprietário do Agente (notificação); Painéis; produto (alertas) |
| Habilidade arquivada / desarquivada / enviada à lixeira / restaurada / eliminada | 12.3, 12.4 | Habilidade, Ator, Concessões afetadas, Automações e Dependências que a referenciam | Auditoria; Disponibilidade; Automações (referência inválida) |
| Habilidade da plataforma atualizada / obsoletada / arquivada | 12.5 | Habilidade global, versão, Espaços de Trabalho com Concessão | Administradores (notificação); Disponibilidade |
| Ferramenta descontinuada (origem) | 7.4 | Ferramenta, substituta (se houver), Habilidades que a requerem | Administradores; Disponibilidade; documento 19 (Ações) |
| Exercício iniciado / concluído / falhou / cancelado | 7.3 | Execução, Agente, Habilidade + versão, origem do exercício, entrada (referências), resultado, motivo, Ferramentas chamadas, Solicitações geradas, custo | Painéis (Fonte de Dados: Execuções); Automações (Gatilho "Execução concluída/falhou" — documento 19); Proprietário do Agente |

Eventos de Exercício são **eventos da Execução** (B18), não da Habilidade; constam aqui porque a carregam como dado.

## 19. Dependências

**A Habilidade depende de:** Espaço de Trabalho (pertencimento, Limites impostos, Política de lixeira, `suspenso` — documento 01); Catálogo de Ferramentas (plataforma e Integrações — 7.4; documento 01, 7.4); Agente como executor e Execução de Agente como recipiente do Exercício (B17, B18 — documento 17); Modelo e as suas Capacidades (DO-HAB-10 — documento 15); Tipos de Campo como sistema de tipos do contrato (A5.3); Arquivo (entradas e saídas multimodais — A8); Coleção (recomendação — documento 20); Registro de Atividade (A6.2); Membro (Criador, Publicador, concedente).

**Dependem da Habilidade:** Agente (Concessões; Ferramentas permitidas coerentes com as requeridas — documento 17); Automação (Ação "invocar Agente" com Habilidade indicada; Gatilhos sobre Execuções — documento 19); Execução (Exercício como passo — documento 15/17); Painéis (Fonte de Dados derivada "Execuções que exerceram a Habilidade X" — documento 21); Template de Agente (referência a Habilidades a conceder — A8); Sessão de Chat (Membro pede ao Agente principal que exerça uma Habilidade: exercício solicitado — documento 16); IA visão geral (definição de Ferramenta herdada de 7.4 — documento 15).

## 20. Casos limítrofes e ambiguidades

### 20.1 Habilidade usada por múltiplos Agentes

"Qualificar lead" concedida ao Agente Comercial (`autônomo`), ao Assistente padrão (`supervisionado`) e ao Agente de Triagem (`assistido`). A mesma versão é exercida pelos três; o que difere é o Agente: permissões (o de Triagem não tem "atualizar Qualificação" permitida → Concessão `indisponível` para ele, com motivo), autonomia (o Assistente gera Solicitação de Aprovação ao chamar "atualizar Qualificação" se essa Ferramenta for classificada `irreversível`; se `reversível`, executa), Modelo (capacidades). Uma nova versão publicada alcança os três no próximo exercício, salvo quem fixou. Painéis mostram "exercícios por Agente" a partir das Execuções.

### 20.2 Habilidade removida com Agentes em Execução exercendo-a

Um Administrador arquiva (ou envia à lixeira) "qualificar lead" enquanto duas Execuções a exercem. Cada exercício em andamento **termina com a versão carregada** (RN-HAB-14): as instruções já estão na Execução e as Ferramentas continuam a ser verificadas uma a uma (B23). Novas Execuções não a encontram: exercício solicitado falha com motivo "Habilidade indisponível (arquivada)"; exercício espontâneo não a lista. Eliminação permanente durante o exercício: idem, e o Exercício preserva nome, identificador e versão como valor (20.13). Não há cancelamento em cascata: arquivar configuração não interrompe trabalho em curso; interromper é ato sobre a Execução (documento 17).

### 20.3 Habilidade que requer Ferramenta que o Agente não pode usar

"Qualificar lead" requer "atualizar Qualificação de Contato" (obrigatória). O Agente de Triagem não tem essa Ferramenta permitida. A Concessão existe, mas a Disponibilidade é `indisponível` (motivo: Ferramenta obrigatória não permitida), visível ao Membro concedente no ato (o produto deve avisar antes de concluir a concessão) e ao Proprietário do Agente. Se, mesmo assim, uma Automação solicitar o exercício, ele **falha antes de começar**, com Registro. Se a Ferramenta é permitida mas o Agente não tem `editar` sobre o Contato concreto, a Disponibilidade é `disponível` (não há como avaliar o registro-alvo antes), o exercício começa e **falha na invocação** (RN-HAB-13; B23), com Registro "negada"; a Execução passa a `falhou` ou `aguardando aprovação` se houver alternativa — aprovação não é concessão (INV-AGE-08; A9.3).

### 20.4 Habilidade que requer Integração desconectada

"Emitir cobrança" requer a Ferramenta "criar cobrança" da Integração financeira. Integração `desconectada`: a Concessão fica `indisponível` (RN-HAB-18), com evento "Disponibilidade alterada" ao Proprietário do Agente e ao Administrador; reconectar restaura sem ato adicional. Se a desconexão ocorre **durante** o exercício, a invocação falha (RN-HAB-13). Integração eliminada: a Ferramenta deixa de existir no Catálogo; a Habilidade continua `ativo`, `indisponível` para todos, até que nova versão substitua a Ferramenta.

### 20.5 Nova versão publicada durante uma Execução

Versão 4 publicada enquanto três exercícios da versão 3 correm. Os três terminam na versão 3 (INV-HAB-11); os Exercícios registram "versão 3". O próximo exercício de cada Concessão que segue a corrente usa a 4. Uma Execução longa que exerce a Habilidade duas vezes (antes e depois da publicação) registra dois Exercícios com versões diferentes: correto e auditável.

### 20.6 Habilidade fornecida pela plataforma alterada pela plataforma

A plataforma publica a versão 12 de "resumir Conversa". Espaços de Trabalho cujas Concessões seguem a corrente passam a exercer a 12 no próximo exercício; Concessões com versão fixada na 11 não mudam (12.5), até que a plataforma obsolete a 11 — então ficam `indisponível` com evento, e um Membro com `executar` libera ou refixa. A cópia feita por um Espaço de Trabalho na versão 9 não é afetada (Proveniência, não vínculo). Nenhum Espaço de Trabalho é consultado: a plataforma governa o global (17.5); o produto deve notificar Administradores com antecedência quando o Efeito declarado aumentar.

### 20.7 Versão obsoletada com Concessões fixadas

Obsoletar a versão 2 quando quatro Agentes a fixaram: o ato é permitido (não é rejeitado como o bloqueio de B25), porque obsolescência é decisão de governança sobre uma competência que a organização não quer mais em uso; as quatro Concessões passam a `indisponível` com motivo "versão fixada obsoleta", evento aos Proprietários dos Agentes, e o produto lista as Concessões afetadas antes de confirmar. Execuções passadas na versão 2 permanecem íntegras (INV-HAB-03).

### 20.8 Habilidade com dependência circular

"Preparar proposta" depende de "calcular desconto", que um Membro tenta fazer depender de "preparar proposta". A adição é **rejeitada** no rascunho (RN-HAB-08), com a cadeia que fecharia o ciclo. Ciclo indireto (A→B→C→A) é igualmente rejeitado; profundidade acima do Limite imposto também. Publicar revalida o fecho transitivo, porque uma Dependência pode ter mudado desde a edição do rascunho (RN-HAB-06).

### 20.9 Automação tentando invocar Habilidade sem Agente

Impossível por construção (B17; INV-HAB-09): a Ação de Automação é "invocar Agente", com Habilidade indicada opcionalmente. Uma Automação sem Agente indicado invoca o Assistente padrão (B17). A Habilidade indicada sem Concessão ao Agente invocado: a Ação falha com Registro "Habilidade não concedida ao Agente"; a Automação não concede (INV-HAB-04). Um Membro em Sessão de Chat "usa" uma Habilidade pedindo ao Agente principal que a exerça — sempre há Agente.

### 20.10 Habilidade sem Ferramentas

"Resumir Conversa": instruções, contrato de entrada (referência a Conversa, ou nada — usa o registro âncora do Contexto), contrato de saída (texto), zero Ferramentas requeridas. Válida: competência puramente cognitiva. Efeito declarado `nenhum`; nunca gera Solicitação de Aprovação, em qualquer nível de autonomia. A Conversa chega pelo Contexto da Execução, que já respeita `ver` do Agente (documento 14, 17.4); se o Agente não vê a Conversa, a entrada é tratada como ausente (RN-HAB-15).

### 20.11 Habilidade com entrada multimodal (áudio) exercida por Agente cujo Modelo não suporta áudio

"Transcrever e classificar ligação" declara Parâmetro "gravação" (Arquivo: áudio). O Agente usa um Modelo cujas Capacidades (DO-HAB-10) não incluem áudio. A Disponibilidade é `indisponível` (motivo: Modelo incompatível) desde a concessão — o produto avisa; se o Modelo do Agente for trocado depois, a Disponibilidade é recalculada. Um exercício solicitado falha antes de começar com motivo registrado (RN-HAB-17). A Habilidade **não** converte a entrada (transcrever seria outra Habilidade ou Ferramenta); a ontologia registra que a compatibilidade é verificada, não como se resolve (documento 15).

### 20.12 Membro sem permissão concedendo Habilidade a Agente

Membro com `editar` no Agente mas sem `executar` na Habilidade: negado (RN-HAB-12), com Registro "negada". Membro com `executar` na Habilidade mas sem `editar` no Agente: negado. Convidado: negado por Papel. Agente tentando conceder a si mesmo ou a outro por Ferramenta: não existe tal Ferramenta (INV-HAB-04); qualquer tentativa é rejeitada e registrada.

### 20.13 Habilidade `arquivado` (ou eliminada) ainda referenciada por Execuções passadas

Execuções de meses anteriores referenciam "qualificar lead v3". Arquivada: a referência resolve normalmente (a Habilidade existe). Eliminada: o Exercício preserva identificador, nome e versão como **valor** (7.3), no mesmo padrão de Proveniência; Painéis históricos continuam a contar; o produto exibe "Habilidade eliminada" em vez de navegar. Nada é reescrito (B18; A6.4 por analogia).

### 20.14 Ferramenta da plataforma descontinuada

A plataforma substitui "atualizar Qualificação de Contato" por "atualizar Qualificação de Contato (v2)" com contrato incompatível. Toda Habilidade que requer a antiga fica `indisponível` (7.4), com evento aos Administradores listando as Habilidades; cada uma precisa de nova versão que requeira a nova Ferramenta. A plataforma deve manter a Ferramenta descontinuada operante por prazo de transição; a ontologia só exige que a descontinuação seja evento e que a Disponibilidade reflita.

### 20.15 Template de Agente que referencia Habilidade inexistente ou arquivada

Instanciar um Template de Agente que lista "qualificar lead": se a Habilidade está `ativo` e o Membro instanciador tem `executar` sobre ela, a Concessão é criada; senão, é omitida com Registro e o Agente nasce sem ela — a instanciação **não falha** (mesmo princípio de B49: origem que não fornece não impede a criação). O Template referencia por identidade, nunca copia a Habilidade.

### 20.16 Dois rascunhos concorrentes

Dois Membros com `editar` querem evoluir a mesma Habilidade em direções diferentes. Só há um rascunho (RN-HAB-04): o segundo edita o mesmo rascunho (edição concorrente é problema de produto, não de ontologia). Se as direções são incompatíveis, a resposta ontológica é **duas Habilidades** (copiar e renomear), não duas linhas de versão da mesma.

### 20.17 Exercício espontâneo de Habilidade com efeito `externa` por Agente `autônomo`

O Agente Comercial, `autônomo`, decide por conta própria exercer "enviar proposta" (que requer "enviar Mensagem", `externa`). Nada o impede ontologicamente: a Concessão existe, a Ferramenta é permitida, o nível é `autônomo`. O que protege a organização é RN-HAB-11 (governança na concessão: o produto pode exigir aprovação de Administrador para conceder Habilidade `externa` a Agente `autônomo`) e os consentimentos e janelas da mensageria (RN-CON-16; RN-CXE-19), verificados na Ferramenta. A Habilidade não decide autonomia; o Agente e a Automação que o invocou decidem (B22).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Execução / Exercício | Execução de Agente (Agente) | A Habilidade não funciona; é exercida (B17, B18; 7.3). |
| Ferramentas | Catálogo da plataforma / Integração | Usadas, não contidas (7.4). Alterar a Ferramenta é ato da origem. |
| Permissões sobre registros | Agente (Sujeito) | A Habilidade não é Sujeito (A9.1); INV-HAB-06. |
| Nível de autonomia e Solicitações de Aprovação | Agente e Execução | B22; a Habilidade só declara efeitos. |
| Modelo | Agente (referência) | A Habilidade declara capacidades requeridas; não escolhe Modelo. |
| Memória | Agente / Membro | RN-HAB-16. |
| Contexto | Execução | Recebido, não construído (RN-HAB-16). |
| Conhecimento (Coleções, Documentos) | Domínio Conhecimento | Recomendado, não contido (B19; RN-HAB-10). |
| Gatilho, Condições, escopo | Automação | 4.2. |
| Proprietário | — (não existe) | DO-HAB-06. |
| Custo | Execução (C8) | Medido no Agente que exerce. |
| Comentários, Tags, Campos Personalizados | — | A8/A5 não os preveem (15). |
| Ferramentas permitidas ao Agente | Agente | Configuração do executor; a Habilidade só requer. |
| Habilidade da plataforma | Plataforma (global) | Referenciada ou copiada; nunca contida (DO-HAB-02). |
| Resultado do exercício (Contato qualificado, Tarefa criada) | Registro-alvo | O efeito pertence à entidade alterada; o Exercício guarda a saída, não o registro. |

## 22. Exemplos conceituais

**Exemplo 1 — Qualificar lead.** A coordenadora comercial (Membro com `criar` e `administrar` sobre Habilidades por concessão) cria "Qualificar lead": entrada {Contato: referência a Contato, obrigatório}; saída {qualificação: seleção (frio, morno, quente); justificativa: texto}; Ferramentas obrigatórias "ler Contato", "ler Conversa", "atualizar Qualificação de Contato"; opcional "ler Negócio"; Coleção recomendada "Critérios comerciais"; Efeito declarado `reversível`. Publica a versão 1. Um Administrador a concede ao Agente Comercial (segue a corrente) e ao Assistente padrão (fixada na 1). A Automação "Conversa criada na Fila Comercial → invocar Agente Comercial, exercer Qualificar lead com Contato = Contato principal" roda vinte vezes por dia; cada Execução registra o Exercício com as três Ferramentas chamadas e a saída. Quando a coordenadora publica a versão 2 (novo critério), o Agente Comercial passa a usá-la no exercício seguinte; o Assistente continua na 1 até alguém liberar a fixação.

**Exemplo 2 — Resumir Conversa (plataforma).** Habilidade global, zero Ferramentas, entrada vazia (usa a Conversa âncora do Contexto), saída texto. Todo Espaço de Trabalho a vê. A Clínica Vida a concede ao Assistente padrão; a atendente, em Sessão de Chat ancorada em uma Conversa, pede "resuma"; a Execução do Assistente exerce a versão corrente da plataforma. A Clínica quer um resumo com formato próprio: copia (nasce rascunho v1 com Proveniência "plataforma: Resumir Conversa v12"), edita as instruções, publica, concede a cópia e revoga a global. A partir daí, novas versões da plataforma não a afetam.

**Exemplo 3 — Composição.** "Preparar proposta" (entrada: Negócio; saída: Arquivo PDF + texto) depende de "Calcular desconto" (entrada: Negócio; saída: percentual) e requer "ler Negócio", "ler Empresa", "gerar Arquivo", "anexar Arquivo a Negócio". Um Agente com "Preparar proposta" concedida exerce "Calcular desconto" aninhado sem Concessão separada (RN-HAB-09), desde que tenha permitidas as Ferramentas de ambas. Tentar fazer "Calcular desconto" depender de "Preparar proposta" é rejeitado (20.8).

**Exemplo 4 — Indisponibilidade.** "Emitir cobrança" requer a Ferramenta "criar cobrança" da Integração financeira. Na madrugada a Integração entra em `com erro`; as duas Concessões ficam `indisponível`; o Proprietário de cada Agente é notificado; a Automação de faturamento que a indica falha com Registro até a reconexão. Nada é eliminado; nada precisa ser reconfigurado.

## 23. Representação gráfica textual

```
Plataforma (global)
├── Habilidade da plataforma (0..N) ──── somente leitura; referenciada por Concessão; copiável
│   └── Versão (1..N)  [rascunho | publicada | obsoleta]
├── Ferramenta da plataforma (0..N) ──── catálogo global
└── Modelo (0..N) ──── declara Capacidades

Espaço de Trabalho (1)
├── Habilidade (0..N)  [ativo | arquivado | na lixeira]   sem Proprietário; Criador
│   ├── Versão de Habilidade (1..N)  [rascunho 0..1 | publicada 0..N | obsoleta 0..N]
│   │   ├── Instruções (1)
│   │   ├── Contrato de entrada (1): Parâmetro (0..N) — tipo: Tipo de Campo | referência a registro | Arquivo(tipos)
│   │   ├── Contrato de saída (1): Parâmetro (0..N) e/ou texto; Arquivos produzidos (0..N)
│   │   ├── Requisito de Ferramenta (0..N) ──── usa ──▶ Ferramenta (plataforma | Integração)  [obrigatória | opcional]
│   │   ├── Dependência (0..N) ──── usa ──▶ Habilidade  (acíclico; profundidade ≤ Limite imposto)
│   │   ├── Coleção recomendada (0..N) ──── referencia ──▶ Coleção (acesso: concessão do Agente)
│   │   ├── Capacidades de Modelo requeridas (derivado)
│   │   ├── Efeito declarado (derivado): nenhum | reversível | irreversível | externa
│   │   └── Publicador (Membro | Sistema)
│   ├── Versão corrente (derivado, 0..1) = publicada de maior número
│   ├── Proveniência (0..1) ──── "copiada de" Habilidade da plataforma (id, nome, versão à época)
│   └── Concessão de Habilidade (0..N) ◀──── N:N ────▶ Agente (0..N Habilidades)
│         ├── Versão fixada (0..1)   [vazio = segue a corrente]
│         ├── Concedida por (Membro)
│         └── Disponibilidade (derivado): disponível | indisponível(motivos)
│
├── Integração (0..N) ──── expõe ──▶ Ferramenta de Integração (0..N)   [inoperante se não conectada]
│
└── Agente (1..N)
    ├── Ferramentas permitidas (0..N) ──── executar ──▶ Ferramenta
    ├── Concessões de Habilidade (0..N)
    └── Execução de Agente (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]
        └── Exercício de Habilidade (0..N, objeto de valor, passo)
              ├── Habilidade + versão (valor à época; sobrevive à eliminação)
              ├── origem: solicitado | espontâneo
              ├── entrada / saída (conforme contrato)
              ├── Ferramenta chamada (0..N) → Registro de Atividade; permissão avaliada a cada uma (B23)
              ├── Exercício aninhado (0..N) — Dependências
              ├── Solicitação de Aprovação (0..N) — por Ferramenta, conforme B22
              └── resultado: concluído | falhou | cancelado

Automação ── Ação "invocar Agente" [Habilidade indicada 0..1] ──▶ Agente ──▶ Execução ──▶ Exercício
             (nunca invoca a Habilidade diretamente — B17)
```

## 24. Decisões ontológicas

- **DO-HAB-01.** Habilidade é competência empacotada (instruções, Ferramentas requeridas, contrato de entrada/saída, dependências), versionada, sem gatilho, exercida somente por Agente dentro de uma Execução de Agente. Aplica B15, B16, B17, B24. CONSOLIDADA.
- **DO-HAB-02.** Habilidades fornecidas pela plataforma são **entidades globais** (fora de qualquer Espaço de Trabalho), somente leitura, referenciadas por Concessão e copiáveis. Ferramentas da plataforma são igualmente globais. Incorporada a A1.3 ("Habilidade da plataforma", "Ferramenta da plataforma" e "Template de Agente da plataforma" entre as entidades globais — B81). RECOMENDADA.
- **DO-HAB-03.** "Agente — tem concedida — Habilidade" é associação N:N com atributos (Concessão de Habilidade: versão fixada 0..1, concedente, momento, Disponibilidade derivada), sem identidade própria, eliminada por qualquer dos lados. A Concessão é a única origem de `executar` sobre a Habilidade para o Agente. Aplica B15 e A9.1. RECOMENDADA.
- **DO-HAB-04.** Versionamento (B24): Versões com estados `rascunho` (0..1 por Habilidade), `publicada` (0..N coexistentes, imutáveis) e `obsoleta` (imutável, não exercível, nunca eliminada enquanto a Habilidade existir); Versão corrente = `publicada` de maior número (0..1). Publicação por ato explícito de Membro com `administrar`. Execuções referenciam (Habilidade, versão). RECOMENDADA.
- **DO-HAB-05.** A Concessão **segue a Versão corrente por padrão** e pode fixar uma versão `publicada`. Obsoletar a versão fixada torna a Concessão `indisponível` (não é rejeitado). Justificativa: versionar serve à auditoria, não ao congelamento; fixação é exceção para Agentes sensíveis. RECOMENDADA.
- **DO-HAB-06.** Habilidade **não tem Proprietário**; tem Criador (imutável) e, por Versão, Publicador (rastreabilidade). Governança por Papel e concessão `administrar`; não entra na sucessão de B28. Coerente com A7 (que não a lista), B34 (configuração com identidade) e B35 (padrão de Integração). A constituição confirma a omissão em A7 como intencional (B71). RECOMENDADA.
- **DO-HAB-07.** Não existe Template de Habilidade. Reutilizar uma Habilidade da plataforma com alterações é **copiar**: cria Habilidade do Espaço de Trabalho, versão 1 `rascunho` idêntica à origem, com Proveniência (identificador, nome, versão à época), sem vínculo vivo. Concessões não migram. RECOMENDADA.
- **DO-HAB-08.** Composição é **permitida**: Dependências N:N **acíclicas** com profundidade máxima como Limite imposto (recomendação: 3). Exercer a dependente exerce as requeridas aninhadas, sem Concessão separada; a Disponibilidade e as Ferramentas permitidas são avaliadas sobre o fecho transitivo. Justificativa: proibir composição obrigaria a duplicar instruções entre Habilidades que compartilham subcompetências, contra a seção 2; permitir sem limite tornaria a Disponibilidade e o Efeito declarado não computáveis com previsibilidade (mesmo princípio de B3). RECOMENDADA.
- **DO-HAB-09.** O contrato de entrada e de saída usa como sistema de tipos os **Tipos de Campo** da plataforma (A5.3), mais **referência a registro** (com tipo de entidade) e **Arquivo** (com tipos aceitos). Multimodalidade é declarada por Parâmetro; a Habilidade não converte modalidades. RECOMENDADA.
- **DO-HAB-10.** O **Modelo declara Capacidades** (modalidades de entrada e saída suportadas), atributo da entidade global Modelo a ser registrado no documento 15, no mesmo padrão das Capacidades do Tipo de Canal (documento 14, 7.1). A Habilidade deriva as Capacidades requeridas do contrato; a compatibilidade é verificada na Disponibilidade e no início do exercício. RECOMENDADA; impacto no documento 15.
- **DO-HAB-11.** O **Exercício de Habilidade** é objeto de valor (passo) da Execução de Agente, sem identidade: registra Habilidade + versão (valor à época), origem (`solicitado`/`espontâneo`), entrada, saída, Ferramentas chamadas, Exercícios aninhados, Solicitações e resultado. Painéis o consomem via Execuções. Aplica B17, B18. RECOMENDADA.
- **DO-HAB-12.** O Recurso "Habilidade" tem as ações `ver`, `criar`, `editar` (rascunho, nome, descrição), `excluir` (lixeira), `administrar` (publicar, obsoletar, arquivar, eliminar, conceder permissões) e `executar` (= poder concedê-la a Agentes, junto com `editar` no Agente). Escopos `registro` e `próprios` (Criador). Agente nunca tem nenhuma delas salvo `executar` como Concessão; `ver` opcional. Padrão: Administrador tudo; Membro `ver`; Convidado nada. Governança de Habilidades é concedível por concessão direta (não é governança do Espaço de Trabalho no sentido de B30). RECOMENDADA.
- **DO-HAB-13.** **Ferramenta** (definição herdada pelos documentos 15, 17 e 19): operação atômica com identificador estável, origem (`plataforma` global | `Integração` do Espaço de Trabalho), contrato tipado (mesmo sistema de DO-HAB-09), Recurso-alvo, permissão requerida (ação de A9.1 avaliada a cada invocação sobre o registro concreto — B23) e **classe de efeito** (`leitura`, `escrita reversível`, `escrita irreversível`, `externa`), que alimenta B22 por invocação. Ferramentas de escrita de Integração são `externa`. O Catálogo de Ferramentas do Espaço de Trabalho é derivado (plataforma ∪ Integrações). Descontinuação é evento; Habilidades que requerem a descontinuada ficam `indisponível`. Ações de Automação que alteram registros invocam Ferramentas deste catálogo. RECOMENDADA.
- **DO-HAB-14.** Usar uma Ferramenta em exercício exige duas verificações independentes: Ferramenta permitida ao Agente (`executar` sobre a Ferramenta, configuração do Agente) e permissão requerida sobre o registro-alvo (permissão efetiva do Ator, A9.3). Conceder Habilidade não satisfaz nenhuma das duas (INV-HAB-06). Aplica A6.3, B23. RECOMENDADA.
- **DO-HAB-15.** Coleções recomendadas são declaração; o acesso do Agente a Conhecimento segue exclusivamente a sua concessão de Conhecimento (documento 20). A Habilidade não contém Conhecimento (B19). RECOMENDADA.
- **DO-HAB-16.** O nome da Habilidade é único no Espaço de Trabalho entre `ativo`/`arquivado` (padrão B39), porque Agentes e Automações a referenciam por nome. RECOMENDADA.
- **DO-HAB-17.** Arquivar ou excluir uma Habilidade não interrompe exercícios em andamento (terminam na versão carregada) e não cancela Execuções; eliminar remove Concessões e preserva Execuções passadas com a referência como valor. Aplica B18, RN-ET-17 (nenhuma cascata destrutiva por mudança de configuração). RECOMENDADA.
- **DO-HAB-18.** O Efeito declarado (derivado, o mais severo da cadeia) serve à exibição e à governança da concessão (o produto pode exigir aprovação de Administrador para conceder `externa`/`irreversível` a Agente `autônomo`); a aprovação em exercício é sempre **por Ferramenta** (B22, B23), nunca pelo agregado. RECOMENDADA.

Nenhuma decisão contradiz A1–A9 ou B1–B99. DO-HAB-02 está incorporada a A1.3 (B81); DO-HAB-06 confirmada (B71); DO-HAB-10 e DO-HAB-13 fixam o que os documentos 15, 17 e 19 herdam (B72, B75). As decisões RECOMENDADAS deste documento estão consolidadas na constituição como B71–B73 e B95.

## 25. Questões em aberto

1. **Valor da profundidade máxima de Dependências** (RN-HAB-08; C8). Recomendado 3 como Limite imposto; produto confirma. Análogo a C20.
2. **Custo por Habilidade** (C8). O custo é medido na Execução; "custo por Habilidade" é Métrica derivada de Exercícios. Se a cota de IA precisar ser aplicada por Habilidade (ex.: limitar "transcrever ligação"), isso exige política em C8, não atributo da Habilidade.
3. **Compartilhamento de Habilidades entre Espaços de Trabalho** (C1). Uma holding quererá publicar Habilidades próprias para várias unidades sem que sejam da plataforma. Hoje: cópia manual em cada Espaço de Trabalho, sem vínculo. Exigiria exceção controlada a A1.2 ou um nível intermediário de publicação.
4. **Agente autor de Habilidade.** INV-HAB-04 proíbe; um caso de produto futuro ("o Agente aprende e propõe uma Habilidade") pode ser atendido como rascunho criado por Membro a partir de saída do Agente. Reabrir se o produto exigir autoria direta, com consequência para B7 (accountability) e para a governança de publicação.
5. **Avaliação e teste de versões antes da publicação** — resolvida: o ensaio é Execução de Agente com marcação própria, leituras reais e escritas simuladas (DO-AGE-13; B82). Uma Versão `rascunho` continua não exercível (RN-HAB-03): testar um rascunho é publicá-lo e ensaiá-lo por um Agente com a Concessão fixada nessa versão, ou copiar a Habilidade.
6. **Catálogo de Capacidades do Modelo** (DO-HAB-10; C27). Quais capacidades a plataforma enumera (modalidades; comprimento de Contexto; uso de Ferramentas) é do documento 15; este documento só depende de "modalidades de entrada e saída".
7. **Restrição de `ver` sobre instruções por padrão.** Recomendado `ver` para Membro (17.2); organizações com processos sensíveis podem preferir `ver` só para Administradores. Decisão de produto sem impacto ontológico.
