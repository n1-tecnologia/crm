# FUNIL

> Domínio: CRM | Documento 13 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Funil** é a estrutura que representa um **processo organizado de progressão de Negócios**: uma sequência ordenada, finita e nomeada de **Etapas**, pertencente ao Espaço de Trabalho, que Negócios percorrem do início ao fim enquanto estão `aberto`. O Funil é o **caminho**; a Etapa é uma **posição** nesse caminho; o Negócio é o que **percorre** o caminho; a **situação** do Negócio (`aberto`, `ganho`, `perdido`) é o **resultado** do percurso, e não uma posição nele (A4.4).

Quatro propriedades o distinguem de qualquer outra entidade da ontologia:

1. **É um processo, não um contêiner.** O Funil não contém Negócios: é referenciado por eles. Um Negócio sobrevive à troca de Funil, ao arquivamento do Funil e à remoção da Etapa em que estava; um Funil sobrevive à eliminação de todos os Negócios que o percorreram. Nenhum dos dois falha no teste de existência sem o outro.
2. **É ordenado.** A ordem das Etapas é total e estrita: para quaisquer duas Etapas de um mesmo Funil, uma precede a outra. É essa ordem que dá sentido a "avançar", "retroceder", "taxa de conversão" e "probabilidade crescente".
3. **É configuração com identidade.** O Funil é um catálogo do Espaço de Trabalho (B34; documento 01, 7.6): entidade contida, com identidade própria, referenciável por Negócios, Automações, Painéis e permissões. Não é objeto de valor.
4. **Não interpreta resultados.** O Funil não sabe o que é "ganhar". Nenhuma Etapa é vitória ou derrota; ganho e perda são situações de sistema do Negócio, avaliadas fora da sequência de Etapas (seções 4 e 11).

O Funil não é um "quadro de vendas", não é uma tela de colunas, não é uma Lista de Negócios e não é um fluxo de Status. É a definição do processo pelo qual a organização decide que uma oportunidade comercial evolui.

## 2. Propósito

1. **Dar posição a cada Negócio.** Sem Funil, "em que ponto da venda está" seria um texto livre ou um Campo Personalizado, incomparável entre Negócios e ininterpretável por Painéis, Automações e Agentes.
2. **Tornar a progressão mensurável.** Taxa de conversão entre Etapas, tempo médio em Etapa e valor ponderado só existem porque as posições são discretas, ordenadas e estáveis (seção 6, derivados).
3. **Separar posição de resultado.** Um Negócio `perdido` na Etapa "Proposta" carrega duas informações distintas — onde estava e como terminou. Colapsá-las em uma única dimensão (uma Etapa "Perdido") destruiria a métrica "em que Etapa perdemos mais" (seção 24, DO-FUN-03).
4. **Permitir processos diferentes na mesma organização.** Vendas, pós-venda, renovação e parcerias têm Etapas distintas. Vários Funis no mesmo Espaço de Trabalho, com o mesmo universo de Contatos, Empresas, Tags e Definições de Campo (B5, A5.2), atendem a isso sem duplicar o CRM.
5. **Ser o escopo natural de Automações e Painéis comerciais.** "Ao entrar na Etapa X" e "Negócios deste Funil" são, respectivamente, o Gatilho e a Fonte de Dados mais frequentes do domínio (B41; Glossário, Fonte de Dados).

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, contida pelo Espaço de Trabalho (pertencimento direto; documento 01, seção 8).
- **Raiz de agregado**: garante a consistência das suas Etapas (ordem total, ao menos uma Etapa, unicidade de nome, Requisitos e Transições permitidas referenciando Etapas do próprio Funil). Etapa não existe fora do Funil.
- **Não é raiz do agregado de Negócio.** O Negócio é raiz do próprio agregado (documento 12); o Funil é referenciado por ele. Consequência: nenhuma operação sobre o Funil pode alterar silenciosamente um Negócio — toda alteração que afeta Negócios (remover Etapa, arquivar, eliminar) exige ato explícito de remapeamento ou migração (seção 12).
- **Configuração de processo**, análoga em função ao Conjunto de Status da Estrutura de Trabalho, mas com modelo diferente (seção 4): sem herança, sem categorias fixas, sem ponto de definição variável — o único ponto de definição é o Espaço de Trabalho (RN-ET-13).
- **Recurso de permissão** (A9.1): existem Ações sobre ele (ver, editar, administrar, excluir) e ele condiciona o acesso aos Negócios que o percorrem quando privado (seção 17).
- **Escopo de Automação** (B41) e **Fonte de Dados de Painel** (Glossário).
- **Não é Ator, não é objeto de valor, não é Status, não é contêiner estrutural, não tem Proprietário** (A7 não o lista; tem Criador; governança por Papel e permissão `administrar`, como a Lista — DO-LIS-03).

## 4. Fronteira conceitual

### O que é

- A definição de um processo de progressão comercial: nome, sequência ordenada de Etapas, regras de transição e de entrada em Etapa, regras de encerramento.
- Uma referência obrigatória de todo Negócio (B9): todo Negócio está em exatamente um Funil e, enquanto `aberto`, em exatamente uma Etapa dele.
- Um escopo: de Automações (Gatilhos sobre Negócios que o percorrem), de Painéis (Fonte de Dados "Negócios de um Funil") e, quando privado, de visibilidade.

### O que não é

- **Não é Etapa.** Etapa é posição; Funil é a sequência de posições. Uma Etapa fora de um Funil não tem significado.
- **Não é Status nem Conjunto de Status.** Status é conceito de Tarefa (A4.2). Negócio não tem status personalizável (A4.4). Etapa e Definição de Status são coisas diferentes com regras diferentes (comparações abaixo).
- **Não é Negócio.** O Negócio é a oportunidade, com valor, Proprietário, Contatos e situação. O Funil é o caminho que ela percorre.
- **Não é a situação do Negócio.** `aberto`, `ganho` e `perdido` são estados de sistema do Negócio (A4.4), não Etapas (DO-FUN-03).
- **Não é Lista.** Lista contém Tarefas; Funil é percorrido por Negócios que pertencem ao Espaço de Trabalho, não ao Funil.
- **Não é Fila.** Fila distribui Conversas entre Atendentes; Funil ordena a progressão de Negócios. Ambos são do CRM; não se contêm nem se herdam.
- **Não é Automação.** O Funil não executa nada; Automações com escopo Funil reagem a eventos dele.
- **Não é Painel nem relatório.** Métricas de conversão são derivadas de Registros de Atividade por Painéis; o Funil não as armazena.
- **Não é Template.** O catálogo de Templates do documento 01 não prevê Template de Funil; o Funil é copiável (seção 15).

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Funil × Etapa** | Entidade com identidade, contida pelo Espaço de Trabalho; raiz de agregado; escopo de Automação e Painel; Recurso de permissão. | Entidade interna do Funil; posição nomeada e ordenada; identidade estável dentro do Funil; nunca referenciada sem o Funil. | Funil responde "qual processo"; Etapa responde "em que ponto do processo". Negócios referenciam a Etapa (e, por ela, o Funil); permissões e Automações referenciam o Funil, nunca a Etapa isolada. |
| **Etapa × Definição de Status** | Posição em um processo de progressão de Negócios; ordem total; probabilidade padrão; sem categoria fixa; Requisitos de Etapa; identidade estável dentro do Funil. | Configuração de status de Tarefa (nome, cor, ordem) com **categoria fixa** da plataforma (`não iniciado`, `em andamento`, `concluído`, `fechado` — A4.3); pertence a um Conjunto de Status; herdada pela estrutura. | A Definição de Status carrega o resultado do trabalho na categoria (`concluído`, `fechado`); a Etapa nunca carrega resultado — o resultado do Negócio está na situação. Definições de Status são resolvidas por herança ao longo do caminho efetivo (B25); Etapas não têm herança: o Funil é definido uma vez no Espaço de Trabalho. |
| **Funil × Conjunto de Status** | Definido exclusivamente no Espaço de Trabalho (RN-ET-13); vários Funis coexistem em paralelo e um Negócio está em exatamente um; sem categorias; mudança de Funil é ato sobre o Negócio (remapeamento explícito de Etapa). | Definido em Espaço, Pasta, Subpasta ou Lista; resolvido por herança com modo `herdado`/`sobrescrito`/`bloqueado` (B25); exatamente um se aplica a cada Lista; categorias fixas permitem mapeamento por categoria (B40). | O Conjunto de Status é uma **configuração herdada por contêiner**; o Funil é uma **entidade escolhida por registro**. Uma Tarefa não escolhe seu Conjunto (é o da Lista); um Negócio escolhe (ou recebe) seu Funil. Não existe "mapeamento por categoria" entre Funis: Etapas não têm categoria, e todo remapeamento é explícito, Etapa a Etapa. |
| **Funil × Lista** | Não contém nada além de Etapas; Negócios o **percorrem** e pertencem ao Espaço de Trabalho; sem herança de configuração; sem Definições de Campo próprias (A5.2); sem Status. | Contêiner estrutural que **contém** Tarefas (A3.2); ponto de definição de Conjunto de Status, Definições de Campo, Funcionalidades (B25); Tarefa não existe sem Lista. | Teste de existência: a Tarefa é eliminada com a Lista; o Negócio sobrevive ao Funil (migração obrigatória, seção 12). Um Negócio pode ter Tarefas vinculadas em qualquer Lista (Vínculo, A8), mas o Funil nunca contém Tarefas e a Lista nunca contém Negócios (documento 05, seção 4). |
| **Funil × Fila** | Sequência ordenada de posições; o Negócio está em uma Etapa por vez e a muda por transição; sem Membros elegíveis; sem regra de distribuição. | Agrupamento operacional de Conversas na Caixa de Entrada, com Membros/Equipes elegíveis e regras de distribuição (Glossário); não é ordenada. | Fila responde "quem atende"; Funil responde "em que ponto está". Uma Conversa pode ser vinculada a um Negócio (A8), mas Fila e Funil não se referenciam. |
| **Funil × Automação** | Estrutura passiva: define posições e valida transições (Requisitos). Nunca executa Ação, envia Mensagem, cria Tarefa ou muda Negócio por iniciativa própria. | Reação determinística ou híbrida a Gatilho → Condição → Ação (B16), com escopo que pode ser um Funil (B41). | O Funil emite eventos (seção 18) e valida; a Automação reage e age. Um Requisito de Etapa que rejeita uma transição não é Automação: é validação síncrona sem Ação (DO-FUN-06). |
| **Etapa × Situação do Negócio** | Posição em um Funil; personalizável (nome, ordem, probabilidade); 1..N por Funil; o Negócio a muda por transição enquanto `aberto`. | Estado de sistema do Negócio: `aberto`, `ganho`, `perdido` (A4.4); fixo pela plataforma; interpretável sem ler nomes; transições regidas por B9 e pelo documento 12. | Um Negócio `ganho` continua a referenciar a última Etapa em que estava (B9): posição e resultado coexistem e são independentes. Uma Etapa chamada "Ganho" é apenas uma posição (seção 20.12). |
| **Funil × Negócio** | Caminho; entidade de configuração; sem valor econômico, sem Proprietário. | Oportunidade comercial; registro operacional com valor, Proprietário, Contatos, Empresa, situação; **referencia** exatamente um Funil. | O Negócio **percorre** o Funil, não pertence a ele (DO-FUN-01). "Negócios deste Funil" é uma consulta por referência, não uma relação de contenção. |

## 5. Identidade

O Funil tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo.

**Teste de identidade (Funil).** Se o nome, a descrição, a cor, a ordem de exibição, todas as Etapas (renomeadas, reordenadas, acrescidas, removidas com remapeamento), os Requisitos, as Transições permitidas, as Regras de encerramento e a privacidade mudarem, continua sendo o mesmo Funil: os Negócios que o referenciam, as Automações com escopo nele, os Widgets que o usam como Fonte de Dados, as concessões sobre ele e os Registros de Atividade continuam a apontar para ele. A identidade é a continuidade do processo enquanto referência, não qualquer configuração.

**Teste de identidade (Etapa).** A Etapa é entidade interna do Funil com **identidade estável dentro dele**: tem identificador próprio, imutável, atribuído na criação. Renomear a Etapa, mudar sua ordem, cor, descrição, probabilidade padrão ou Requisitos preserva a Etapa. Consequências obrigatórias:

- **Negócios referenciam a Etapa pelo identificador**, nunca pelo nome nem pela posição. Reordenar Etapas não move nenhum Negócio; renomear "Proposta" para "Proposta enviada" não altera nenhum Negócio (RN-FUN-05).
- **Registros de Atividade de transição registram a Etapa por identidade** (com o nome à época, preservado no próprio Registro). Painéis históricos continuam corretos após reordenação ou renomeação (seção 20.5).
- **A Etapa não existe fora do Funil.** Não pode ser movida para outro Funil; "a mesma Etapa em dois Funis" não existe — são duas Etapas com identidades distintas, mesmo homônimas (seção 20.7).
- **Nome não é identidade** de Funil nem de Etapa. O nome do Funil é único no Espaço de Trabalho entre Funis `ativo` e `arquivado` (documento 01, seção 3, "escopo de unicidade"; RN-FUN-02); o nome da Etapa é único dentro do seu Funil (RN-FUN-03). Unicidade é regra de legibilidade, não de identidade.

## 6. Atributos fundamentais

### 6.1 Funil

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Espaço de Trabalho | referência | sim | Imutável (INV-ET-01). |
| Nome | nativo | sim | Único entre Funis `ativo` e `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades (RN-FUN-02). |
| Descrição | nativo | não | Texto livre. |
| Cor | nativo | não | Apresentação. |
| Ordem de exibição | nativo | sim | Posição do Funil entre os Funis do Espaço de Trabalho. Apresentação; não é identidade. |
| Estado | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). |
| Privado | nativo | sim | Booleano. Quando verdadeiro, interrompe as origens "papel" e "herança" para o Funil e para os Negócios que o percorrem (seção 17; B38 aplicado). Padrão: falso. |
| Regras de encerramento | objeto de valor | sim | Dois indicadores: **exigir Motivo de Perda** ao marcar `perdido` e **exigir valor** (maior que zero) ao marcar `ganho`. Padrão: ambos falsos. Configuração do Funil que o Negócio consome (DO-FUN-08). |
| Criador | referência (Membro) | sim | Imutável (A7). Funil não tem Proprietário. |
| Momento de criação | nativo | sim | Imutável. |
| Etapa inicial | derivado | sim | A Etapa de menor ordem. Não é gravada: reordenar altera a Etapa inicial automaticamente (DO-FUN-04). |
| É o Funil padrão | derivado | sim | Verdadeiro quando o atributo **Funil padrão** do Espaço de Trabalho aponta para este Funil (DO-FUN-09). Lido, não gravado no Funil. |
| Proveniência | objeto de valor | não | Funil a partir do qual foi copiado (identificador e nome à época), quando criado por cópia (seção 15). Sem vínculo vivo. |

**Não são atributos do Funil**, embora sejam calculados sobre ele ou configurados nele: quantidade de Negócios `aberto`, valor total, valor ponderado, taxa de conversão entre Etapas, tempo médio em Etapa, Negócios "parados". São **derivados** para Painéis (Métricas sobre a Fonte de Dados "Negócios de um Funil" e sobre Registros de Atividade de transição) e não são gravados no Funil (DO-FUN-12). Também não são atributos: Etapas (componentes, seção 7), Automações com escopo no Funil (pertencem ao Espaço de Trabalho, B41), concessões (vivem no Recurso, mas são relações).

### 6.2 Etapa

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável, estável dentro do Funil (seção 5). |
| Funil | referência | sim | Imutável. Etapa não muda de Funil. |
| Nome | nativo | sim | Único dentro do Funil (RN-FUN-03). |
| Ordem | nativo | sim | Inteiro; ordem total e estrita entre as Etapas do Funil (INV-FUN-03). Alterável por reordenação; nunca altera Negócios (RN-FUN-05). |
| Probabilidade padrão | nativo | sim | Percentual inteiro de 0 a 100. Valor que um Negócio nesta Etapa assume como probabilidade quando não a sobrescreve (documento 12). Não precisa ser crescente ao longo do Funil (recomendação: a plataforma alerta, não impede). |
| Cor | nativo | não | Apresentação. |
| Descrição | nativo | não | Orientação para quem opera ("o que precisa estar pronto para entrar aqui"). |
| Requisitos de Etapa | objeto de valor (0..N) | não | Validações avaliadas na entrada ou na saída da Etapa (seção 7.2). |
| Transições permitidas | objeto de valor (0..N) | não | Conjunto de Etapas do mesmo Funil para as quais um Negócio nesta Etapa pode ir. Vazio significa **todas** (seção 7.3). |

**Sem "tipo de etapa".** Toda Etapa é uma Etapa de progressão. Não existe Etapa terminal, Etapa de ganho nem Etapa de perda (DO-FUN-03). Não existe categoria de Etapa análoga à categoria de status (A4.3): o que Automações, Painéis e IA precisam interpretar sem ler nomes — se o Negócio terminou e como — está na situação do Negócio; o que precisam ordenar está na Ordem.

## 7. Entidades internas ou componentes

### 7.1 Etapa (1..N)

Entidade interna do agregado Funil, com identidade (seção 5) e atributos (6.2). Sem ciclo de vida próprio: não tem estado `arquivado` nem `na lixeira`; existe enquanto pertence ao Funil e deixa de existir quando removida, o que exige remapeamento de todo Negócio que a referencie (RN-FUN-10). Não recebe Comentários, Tags, Vínculos, Definições de Campo, Automações com escopo próprio (o escopo é o Funil, B41) nem concessões de permissão (o Recurso é o Funil).

### 7.2 Requisito de Etapa (objeto de valor, 0..N por Etapa)

Um **Requisito de Etapa** é uma condição que um Negócio precisa satisfazer para **entrar** em uma Etapa ou para **sair** dela. É objeto de valor de configuração, sem identidade, composto por:

- **Momento**: `entrada` ou `saída`.
- **Tipo**: `campo preenchido` (referencia uma Definição de Campo Personalizado de Negócio do Espaço de Trabalho — A5.2 — que deve ter Valor não vazio), `contato obrigatório` (ao menos um Contato vinculado), `empresa obrigatória` (Empresa preenchida), `valor obrigatório` (valor maior que zero), `proprietário obrigatório` (sempre satisfeito por B9; existe para simetria com outros tipos e pode ser omitido pelo produto). O catálogo de tipos é da plataforma e pode crescer; a ontologia exige apenas que cada tipo seja verificável sobre o próprio Negócio e seus Vínculos, sem consultar outros registros nem executar nada.

Regras de avaliação:

- Requisitos de `entrada` são avaliados em toda operação que coloque um Negócio na Etapa: transição dentro do Funil (avanço ou retrocesso), criação do Negócio diretamente na Etapa, mudança de Funil com esta Etapa como destino, reabertura de Negócio que retorna a esta Etapa (documento 12). Requisitos de `saída` são avaliados em toda transição que retire o Negócio da Etapa, inclusive retrocesso e mudança de Funil; **não** são avaliados quando o Negócio é marcado `ganho` ou `perdido`, porque ele não sai da Etapa (B9: a última Etapa é preservada).
- A avaliação é **síncrona e bloqueante**: se um Requisito não é satisfeito, a operação é **rejeitada inteira**, com o Requisito violado identificado. Não existe "entrar com pendência".
- Requisitos valem para **todo Ator** — Membro, Agente, Automação, Integração — sem exceção por Papel (A6.3). Um Administrador não "força" a entrada; para isso altera o Requisito, com Registro de Atividade.
- **Remapeamentos obrigatórios** (remoção de Etapa, migração por arquivamento, RN-FUN-10 e RN-FUN-12) **não** avaliam Requisitos de `entrada` na Etapa de destino: são operações de manutenção da configuração, não progressão do Negócio; bloqueá-las deixaria o ator preso entre um Requisito e uma remoção. O Registro de Atividade indica "remapeado" e não "avançou". Recomendação registrada em DO-FUN-06.
- Remover a Definição de Campo referenciada por um Requisito remove o Requisito no mesmo ato, com Registro de Atividade (A5.4 aplicada à configuração que a referencia).

**Requisito não é Automação** (DO-FUN-06). Requisito é validação: avalia e aceita ou rejeita, sem Ação, sem Execução, sem Gatilho. Automação é reação: dispara depois de um evento, executa Ações, tem Execução com estado (B18). "Ao entrar em Proposta, criar Tarefa" é Automação; "só entra em Proposta com valor preenchido" é Requisito. Uma Automação que tenta mover um Negócio para uma Etapa cujo Requisito falha tem sua Ação rejeitada e a Execução passa a `falhou` com registro (seção 20.8).

### 7.3 Transições permitidas (objeto de valor, 0..N por Etapa)

Por padrão, de qualquer Etapa um Negócio pode ir para **qualquer outra Etapa do mesmo Funil**, avançando ou retrocedendo, saltando Etapas (DO-FUN-05). Uma Etapa pode, opcionalmente, restringir isso declarando o conjunto de Etapas de destino permitidas. O conjunto vazio significa "sem restrição". As mesmas regras de avaliação de Requisitos aplicam-se: síncrona, bloqueante, para todo Ator, não avaliada em remapeamentos obrigatórios. Uma Transição permitida só pode referenciar Etapas do mesmo Funil (INV-FUN-05); remover a Etapa referenciada a retira de todos os conjuntos no mesmo ato.

Transições permitidas e Requisitos são complementares: a primeira responde "para onde pode ir"; o segundo, "em que condição". Ambos são configuração do Funil, não regras de negócio da plataforma: um Funil sem nenhum dos dois é válido e é o padrão.

### 7.4 O que não é componente

Negócios (referenciam o Funil, não são contidos); Automações com escopo Funil (pertencem ao Espaço de Trabalho, B41); Widgets com Fonte de Dados no Funil (pertencem ao Painel); concessões diretas e compartilhamentos sobre o Funil (vivem no Recurso como relações — documento 01, seção 21); Motivos de Perda (catálogo do Espaço de Trabalho, valem para todos os Funis — documento 01, 7.6); Definições de Campo de Negócio (do Espaço de Trabalho, A5.2 — o Funil só as **referencia** em Requisitos, nunca as define — DO-FUN-07).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | Funil → ET | Exatamente um, imutável. Eliminado com o Espaço de Trabalho (12.4 do documento 01). |
| contém Etapas | Etapa | contenção (composição) | Funil → Etapa | 1..N. Etapa não existe fora do Funil. |
| é percorrido por | Negócio | referência (do Negócio para o Funil) | Negócio → Funil | O Negócio referencia exatamente um Funil (B9). O Funil não contém Negócios. |
| posiciona | Negócio | referência (do Negócio para a Etapa) | Negócio → Etapa | Etapa atual (enquanto `aberto`) ou última Etapa (quando `ganho`/`perdido`), sempre uma Etapa do Funil referenciado (INV-FUN-06). |
| é padrão de | Espaço de Trabalho | referência (do ET para o Funil) | ET → Funil | Exatamente um Funil `ativo` é o Funil padrão do Espaço de Trabalho (DO-FUN-09). |
| é escopo de | Automação | referência (da Automação para o Funil) | Automação → Funil | B41. Inoperante enquanto o Funil não está `ativo`; eliminada com ele. |
| é Fonte de Dados de | Widget | referência | Widget → Funil | "Negócios de um Funil". Referência, não cópia. Fica inválida na eliminação. |
| é Âncora de | Painel (de contexto) | referência | Painel → Funil | 0..N. Sem contenção nem herança de permissão ou estado; na eliminação passa a `eliminada` como valor e o Painel permanece (B102). |
| foi criado por | Ator | referência | Funil → Ator | Criador, imutável (A7). Na prática é Membro (Administrador ou Proprietário do Espaço de Trabalho — 12.1) ou o Sistema, para o Funil padrão (DO-FUN-09). |
| Requisito referencia | Definição de Campo de Negócio | referência (uso) | Etapa → Definição | Só Definições do Espaço de Trabalho cujo tipo de entidade-alvo é Negócio. |
| foi copiado de | Funil | proveniência | Funil → Funil | Valor histórico, sem vínculo vivo. |
| é Recurso de | Permissão | relação | Sujeito → Funil | Concessões diretas e compartilhamentos sobre o Funil (seção 17). |

Distinção aplicada: o Funil **CONTÉM** Etapas; **é REFERENCIADO por** Negócios, Automações, Widgets e pelo atributo Funil padrão; **USA** (referencia) Definições de Campo de Negócio em Requisitos; **CONFIGURA** Regras de encerramento, Requisitos e Transições (objetos de valor); **não HERDA** nada nem transmite herança: o CRM não tem hierarquia (A5.2), e o Funil não é nível de nada.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Funil | 1..N | não | sim | estrutural (pertencimento) | O Funil padrão é criado com o Espaço de Trabalho e nunca é eliminado enquanto for padrão (DO-FUN-09). Altera a cardinalidade condicionada do documento 01 (0..N, "se o documento de Funis decidir criar um Funil padrão"). |
| ET → Funil `ativo` | 1..N | não | sim | derivada | O Funil padrão é sempre `ativo` (INV-FUN-08). Consequência: sempre há um Funil `ativo` enquanto houver Negócios `aberto` — e mesmo sem eles. |
| ET → Funil padrão | 1 | não | não | referência | Todo Negócio exige Funil (B9); criar um Negócio sem indicar Funil precisa de destino determinístico. Vários padrões tornariam a escolha ambígua. |
| Funil → Etapa | 1..N | não | sim | composição | Funil sem Etapas não posiciona Negócio nenhum: inválido (INV-FUN-02). Uma única Etapa é válida (20.2). Sem limite ontológico; teto é Limite imposto (B34). |
| Etapa → Funil | 1 | não | não | composição | Imutável. |
| Funil → Negócio | 0..N | sim | sim | associativa (por referência do Negócio) | Funil recém-criado ou de nicho pode não ter Negócios. |
| Negócio → Funil | 1 | não | não | referência | B9. Mudança de Funil é substituição de referência com remapeamento de Etapa (documento 12). |
| Negócio → Etapa | 1 | não | não | referência | Etapa atual enquanto `aberto`; última Etapa quando encerrado (B9). Nunca vazia. |
| Etapa → Negócio | 0..N | sim | sim | associativa | Etapa vazia é comum. |
| Etapa → Requisito de Etapa | 0..N | sim | sim | objeto de valor | Padrão: nenhum. |
| Etapa → Transições permitidas | 0..N | sim (= todas) | sim | objeto de valor | Padrão: nenhum registro, que significa sem restrição. |
| Requisito → Definição de Campo de Negócio | 0..1 | sim (tipos nativos) | não | referência | Só o tipo `campo preenchido` referencia uma Definição. |
| Funil → Automação (escopo) | 0..N | sim | sim | associativa (referência da Automação) | B41. |
| Funil → Widget (Fonte de Dados) | 0..N | sim | sim | associativa | |
| Funil → Painel (Âncora) | 0..N | sim | sim | associativa | B102. |
| Funil → Regras de encerramento | 1 | não | não | objeto de valor | Sempre presente, com ambos os indicadores falsos por padrão. |
| Funil → Criador | 1 | não | não | referência | A7. |
| Funil → Proprietário | 0 | — | — | — | Funil não tem Proprietário (A7 não o lista; DO-FUN-02). Não há sucessão de Funis (B28). |

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O Funil não integra a Estrutura de Trabalho nem nenhuma hierarquia de contêineres. É filho direto do Espaço de Trabalho, par de Contatos, Empresas, Negócios e Caixa de Entrada (A2.2). Sua única hierarquia interna é Funil → Etapa, de um nível.

**Pertencimento (teste de existência).** A Etapa falha no teste de existência sem o Funil: é **contenção** (composição). O Funil falha no teste sem o Espaço de Trabalho: é **pertencimento**. O Negócio **não** falha no teste sem o Funil: é movido para outro antes que o Funil deixe de existir (RN-FUN-12, RN-FUN-13) — logo, Funil → Negócio é **associação por referência**, e o Negócio **percorre** o Funil em vez de pertencer a ele (DO-FUN-01). A escolha tem consequências concretas: (a) mover um Negócio de Funil não é "mover entre contêineres" (B40 não se aplica; não há Valores de Campo órfãos, porque as Definições de Negócio são do Espaço de Trabalho e valem em todo Funil — A5.2); (b) arquivar um Funil não arquiva Negócios (não há estado efetivo derivado, B36 não se aplica); (c) permissões sobre Negócios não são herdadas do Funil — são do CRM, filtradas pela visibilidade do Funil quando privado (seção 17).

**"Pertence a" versus "relaciona-se com".** O Funil *pertence* ao Espaço de Trabalho. O Negócio *relaciona-se com* o Funil (referência obrigatória, mas substituível). A Automação *relaciona-se com* o Funil (escopo). A Etapa *pertence* ao Funil.

**Propriedade.** O Funil não tem Proprietário: é configuração organizacional, como a Lista (DO-LIS-03) e a Integração (B35). Tem Criador (rastreabilidade). Governança: Papel Administrador ou Proprietário do Espaço de Trabalho para criar, excluir e definir o padrão (ação de configuração de catálogo — documento 01, 17.2); permissão `administrar` sobre o Funil, concedível a Membros e Equipes, para gerir Etapas, Requisitos, Transições, Regras de encerramento e privacidade (DO-FUN-10). Não há sucessão de Funis na remoção de Membros (B28 só transfere propriedades), exceto a concessão `administrar` sobre Funil privado que ficaria sem administrador (B38d aplicado).

**Configurar não é conter.** O Funil configura Requisitos que referenciam Definições de Campo; isso não torna as Definições filhas do Funil (A5.2; DO-FUN-07). O Funil configura Regras de encerramento que o Negócio consome; isso não torna a situação do Negócio um atributo do Funil.

## 11. Estados

Todos os estados desta seção são **estados de sistema**. O Funil não tem Status (A4.2), e a Etapa não é estado de nada: é posição.

### 11.1 Estados do Funil (A4.1)

| Estado | Significado | Negócios que o referenciam |
| --- | --- | --- |
| `ativo` | Recebe Negócios novos e movidos; transições de Etapa ocorrem; Automações com escopo nele operam; aparece nas Visualizações do CRM. | Qualquer situação. |
| `arquivado` | Fechado a operação: não recebe Negócios novos nem movidos; nenhum Negócio `aberto` o referencia (RN-FUN-12); Negócios `ganho`/`perdido` continuam a referenciá-lo como histórico, consultáveis e com Painéis funcionando; Automações inoperantes (B41); configuração somente leitura. | Só `ganho` e `perdido`. |
| `na lixeira` | Excluído recuperável, pelo prazo da Política de lixeira; nenhum Negócio de nenhuma situação o referencia (RN-FUN-13); invisível nas Visualizações; Automações inoperantes; Widgets que o referenciam ficam vazios. | Nenhum. |

Eliminação permanente não é estado: é o fim do registro e das suas Etapas (12.5).

### 11.2 Etapa

A Etapa **não tem estado**. Existe ou não existe. "Etapa desativada" (mantida para histórico, fechada a novos Negócios) foi considerada e não adotada nesta versão: o histórico está nos Registros de Atividade, que preservam a Etapa por identidade e nome (seção 5), e um estado por componente duplicaria o mecanismo de arquivamento do Funil (seção 25, questão 1).

### 11.3 O que não é estado do Funil

A situação do Negócio (`aberto`, `ganho`, `perdido`) é estado do Negócio (A4.4). "Funil vazio", "Funil sem Negócios abertos" e "Funil padrão" são condições derivadas, não estados (mesmo princípio de DO-LIS-17).

## 12. Ciclo de vida

### 12.1 Criação

**Funil padrão.** Criado no ato atômico de criação do Espaço de Trabalho (DO-FUN-09), com nome fornecido pela plataforma na Localidade do Espaço de Trabalho (ex.: "Vendas"), Etapas padrão da plataforma (recomendação: "Novo", "Qualificado", "Proposta", "Negociação", com probabilidades crescentes), Regras de encerramento falsas, não privado, e referenciado pelo atributo Funil padrão do Espaço de Trabalho. Criador: o primeiro Membro. É um Funil comum: renomeável, reconfigurável, substituível como padrão por outro Funil `ativo`.

**Demais Funis.** Criados por Administrador ou Proprietário do Espaço de Trabalho (configuração de catálogo — documento 01, 17.2), de três formas: (a) **do zero**, informando nome e ao menos uma Etapa — a criação é atômica: Funil e Etapas nascem no mesmo ato, e um Funil sem Etapas nunca existe (INV-FUN-02); (b) **por cópia** de outro Funil do Espaço de Trabalho, com Etapas, Requisitos, Transições e Regras de encerramento copiados, Proveniência preenchida, sem Negócios, sem Automações, sem concessões (seção 15); (c) **por padrão da plataforma**, com as mesmas Etapas do Funil padrão. Nasce `ativo`, com Ordem de exibição ao final.

### 12.2 Transições de estado

| De | Para | Quem | Pré-condição | Efeitos |
| --- | --- | --- | --- | --- |
| `ativo` | `arquivado` | `administrar` sobre o Funil | Nenhum Negócio `aberto` o referencia (em qualquer estado, inclusive `na lixeira` — RN-NEG-17). Se houver, a operação exige **migração no mesmo ato**: Funil de destino `ativo` e mapeamento explícito de cada Etapa em uso para uma Etapa do destino (RN-FUN-12). Não pode ser o Funil padrão (INV-FUN-08). | Registro de Atividade; evento "Funil arquivado"; para cada Negócio migrado, evento "Negócio movido de Funil" (evento único agregado, com a lista). Automações com escopo ficam inoperantes (B41). |
| `arquivado` | `ativo` | `administrar` | Nome sem colisão com Funil `ativo`/`arquivado` (RN-FUN-02; sempre satisfeita, porque o arquivado reservava o nome). | Registro de Atividade; Automações voltam a operar. |
| `ativo` ou `arquivado` | `na lixeira` | `excluir` sobre o Funil (Papel de nível Administrador) | Nenhum Negócio de nenhuma situação nem estado o referencia. Se houver, exige migração no mesmo ato, inclusive de Negócios `ganho`/`perdido` e `na lixeira`, com mapeamento de Etapas (RN-FUN-13). Não pode ser o Funil padrão. | Registro de Atividade; Widgets ficam vazios; Automações inoperantes; o nome deixa de ser reservado (B39, por analogia). |
| `na lixeira` | Estado próprio anterior à exclusão (`ativo` ou `arquivado`) | `administrar` | Nome sem colisão; se colidir, renomear no ato. | Registro de Atividade. Devolve o Estado próprio anterior à exclusão, gravado na entrada na lixeira (B43); nunca força `ativo`. |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo) ou `excluir` explícito | Já não há Negócios referenciando (garantido na entrada na lixeira). | Elimina Funil e Etapas; elimina Automações com escopo nele e, com elas, as suas Execuções — Registros de Atividade, efeitos e Execuções de Agente filhas permanecem (B41; DO-AUT-17); Widgets com Fonte de Dados nele passam a referência inválida; Registros de Atividade permanecem (INV-ET-12), com nome do Funil e das Etapas preservados neles. |

### 12.3 Ciclo de vida da Etapa

| Operação | Quem | Pré-condição / efeitos |
| --- | --- | --- |
| Criar Etapa | `administrar` | Nome único no Funil; Ordem informada ou ao final. Não afeta Negócios. Se inserida antes da atual Etapa inicial, passa a ser a Etapa inicial (derivada) — Negócios existentes não se movem. |
| Alterar nome, cor, descrição, probabilidade padrão | `administrar` | Não afeta a Etapa atual de nenhum Negócio. Alterar probabilidade padrão recalcula a probabilidade efetiva dos Negócios que não a sobrescrevem; os que a sobrescrevem mantêm a sua (20.9; documento 12). Registro de Atividade. |
| Reordenar | `administrar` | Ordem total mantida (INV-FUN-03). Nenhum Negócio muda de Etapa (RN-FUN-05). Painéis históricos não são afetados (20.5). |
| Alterar Requisitos / Transições permitidas | `administrar` | Vale para transições futuras; Negócios já na Etapa não são reavaliados nem expulsos (não há cascata destrutiva por mudança de configuração — princípio de RN-ET-17). |
| Remover Etapa | `administrar` | Rejeitada se for a única (INV-FUN-02). Exige **remapeamento no mesmo ato** de todo Negócio que a referencie — `aberto` (Etapa atual) e `ganho`/`perdido` (última Etapa), em qualquer estado, inclusive `na lixeira` (RN-NEG-17) — para outra Etapa do mesmo Funil (RN-FUN-10). Remove-a das Transições permitidas das demais Etapas. Evento único agregado com a lista de Negócios remapeados. Registros de Atividade históricos preservam a Etapa removida por identidade e nome. Sem lixeira: a remoção é definitiva. |

### 12.4 Entrada e saída de Negócios (o que o Funil impõe ao Negócio)

O ciclo de vida do Negócio é do documento 12. Este documento fixa o que o Funil impõe:

- **Entrada.** Um Negócio criado sem Funil explícito vai para o Funil padrão; sem Etapa explícita, para a Etapa inicial do Funil escolhido. Um Negócio **pode ser criado diretamente em qualquer Etapa** de um Funil `ativo`, com Requisitos de `entrada` avaliados e evento "Negócio entrou em Etapa" emitido com origem "criação" (DO-FUN-04). Não se cria Negócio em Funil `arquivado` ou `na lixeira`.
- **Transição.** Enquanto `aberto`, o Negócio muda de Etapa por ato de um Ator com `editar` sobre o Negócio (e `ver` sobre o Funil, se privado), respeitando Transições permitidas e Requisitos de `saída` da origem e de `entrada` do destino. Avanço, retrocesso e salto são iguais para a ontologia; Painéis os distinguem pela Ordem.
- **Saída por encerramento.** Ao ser marcado `ganho` ou `perdido`, o Negócio **não sai da Etapa**: a última Etapa é preservada (B9). O Funil impõe as Regras de encerramento: se "exigir Motivo de Perda" está ativo, marcar `perdido` sem Motivo de Perda é rejeitado; se "exigir valor" está ativo, marcar `ganho` com valor vazio ou zero é rejeitado (DO-FUN-08).
- **Saída por mudança de Funil.** Mover um Negócio para outro Funil exige Funil de destino `ativo` e **Etapa de destino explícita** (remapeamento obrigatório; não há mapeamento automático por nome ou posição — DO-FUN-11), com Requisitos de `saída` da Etapa de origem e de `entrada` da Etapa de destino avaliados. A probabilidade sobrescrita é **descartada** (com Registro que preserva o valor) e a efetiva passa a ser a padrão da Etapa de destino, como em toda progressão (DO-NEG-05); só os remapeamentos obrigatórios a preservam. Vínculos, Contatos, Empresa, Valores de Campo, Comentários, Tags e Registros de Atividade do Negócio permanecem (Definições de Negócio são do Espaço de Trabalho — A5.2 —, logo nada fica órfão). Permitido para Negócio `aberto` por qualquer Ator com `editar` no Negócio; para Negócio `ganho`/`perdido`, só em migração obrigatória (RN-FUN-12, RN-FUN-13) ou na reabertura (20.3).
- **Reabertura.** Um Negócio `perdido` (ou `ganho`, por Administrador — B9) que volta a `aberto` retorna à sua última Etapa, se o Funil estiver `ativo`; se o Funil estiver `arquivado`, a reabertura exige mover o Negócio para um Funil `ativo` no mesmo ato, com Etapa de destino explícita (20.3).

### 12.5 Cascata e dependentes

Eliminar permanentemente o Funil elimina as Etapas (composição) e as Automações com escopo nele (B41). Não elimina Negócios (já migrados), Motivos de Perda, Definições de Campo, Painéis (só o Widget fica inválido) nem Registros de Atividade. Na eliminação do Espaço de Trabalho, tudo é eliminado (documento 01, 12.4).

## 13. Regras de negócio ontológicas

- **RN-FUN-01.** Todo Funil pertence a exatamente um Espaço de Trabalho, imutável, e só nele é definido; nenhum Espaço, Pasta, Lista, Fila ou outro Funil define Funis (RN-ET-13).
- **RN-FUN-02.** O nome do Funil é único entre os Funis `ativo` e `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e de espaços nas extremidades. Um Funil `na lixeira` não reserva o nome; criar, renomear ou restaurar com colisão é rejeitado até renomear (mesmo modelo de B39).
- **RN-FUN-03.** O nome da Etapa é único dentro do seu Funil, com o mesmo critério. Etapas de Funis distintos podem ser homônimas.
- **RN-FUN-04.** A criação de um Funil é atômica e inclui ao menos uma Etapa; a remoção da única Etapa é rejeitada.
- **RN-FUN-05.** Reordenar, renomear ou reconfigurar Etapas nunca altera a Etapa atual, a última Etapa nem a situação de nenhum Negócio. Negócios referenciam Etapas por identidade.
- **RN-FUN-06.** A Etapa inicial de um Funil é a de menor Ordem. Um Negócio criado sem Etapa explícita nasce nela; um Negócio pode ser criado em qualquer Etapa do Funil, sujeito aos Requisitos de `entrada`.
- **RN-FUN-07.** Por padrão, um Negócio `aberto` pode ir de qualquer Etapa para qualquer outra Etapa do mesmo Funil. Transições permitidas restringem os destinos; Requisitos de Etapa condicionam a entrada e a saída. Ambos são avaliados de forma síncrona e bloqueante, para todo Ator, sem exceção por Papel.
- **RN-FUN-08.** Requisitos e Transições permitidas **não** são avaliados em remapeamentos obrigatórios (remoção de Etapa, migração por arquivamento ou lixeira). O Registro de Atividade distingue "remapeado" de "avançou/retrocedeu".
- **RN-FUN-09.** Um Requisito de Etapa só referencia Definições de Campo Personalizado do Espaço de Trabalho cujo tipo de entidade-alvo é Negócio; é removido no mesmo ato em que a Definição é removida. Um Funil não define Definições de Campo.
- **RN-FUN-10.** Remover uma Etapa exige, no mesmo ato, o remapeamento de todo Negócio que a referencie (como Etapa atual ou última Etapa), em qualquer situação e em qualquer estado — inclusive `na lixeira` (DO-NEG-09; RN-NEG-17) —, para outra Etapa do mesmo Funil, com evento único agregado. Não existe Negócio referenciando Etapa inexistente (INV-FUN-06).
- **RN-FUN-11.** Marcar um Negócio como `ganho` ou `perdido` não altera sua Etapa; a última Etapa é preservada (B9). O Funil impõe as Regras de encerramento: Motivo de Perda obrigatório e valor obrigatório, quando ativados.
- **RN-FUN-12.** Arquivar um Funil exige que nenhum Negócio `aberto`, em qualquer estado (inclusive `na lixeira` — RN-NEG-17), o referencie; havendo, a operação exige migração de todos, no mesmo ato, para um Funil `ativo` com mapeamento explícito de Etapas. Negócios `ganho`/`perdido` permanecem referenciando o Funil `arquivado`.
- **RN-FUN-13.** Enviar um Funil à lixeira exige que nenhum Negócio, de nenhuma situação nem estado (inclusive `na lixeira`), o referencie; havendo, exige migração no mesmo ato, com mapeamento de Etapas. Um Funil `na lixeira` ou eliminado nunca é referenciado por Negócio.
- **RN-FUN-14.** Um Funil `arquivado` ou `na lixeira` não recebe Negócios criados nem movidos, e nenhuma transição de Etapa ocorre nele. Reabrir um Negócio cujo Funil está `arquivado` exige movê-lo a um Funil `ativo` no mesmo ato.
- **RN-FUN-15.** Mover um Negócio de Funil exige Funil de destino `ativo` e Etapa de destino explícita, com Requisitos avaliados; gera evento "Negócio movido de Funil" com Funil e Etapa de origem e destino. Não há mapeamento automático por nome ou posição.
- **RN-FUN-16.** O Espaço de Trabalho tem exatamente um Funil padrão, sempre `ativo` e **nunca privado**, criado na criação do Espaço de Trabalho; só é alterado por Administrador ou Proprietário, apontando para outro Funil `ativo` não privado; o Funil padrão não pode ser arquivado, enviado à lixeira, eliminado nem tornado privado enquanto for padrão. Justificativa: um Funil padrão privado faria a criação de Negócio sem Funil explícito exigir `criar` sobre um Funil privado (17.1) e violaria RN-NEG-20 para todo Proprietário sem `ver`.
- **RN-FUN-17.** Criar, excluir e definir como padrão um Funil são ações de configuração de catálogo do Espaço de Trabalho (documento 01, 17.2; RN-ET-24): decorrem do Papel de nível Administrador ou Proprietário. Administrar um Funil existente (Etapas, Requisitos, Transições, Regras de encerramento, privacidade, concessões) decorre de `administrar` sobre o Funil, concedível a Membros e Equipes. Agentes nunca recebem `administrar` sobre Funis nem criam Funis (INV-ET-13; B38 por analogia).
- **RN-FUN-18.** Alterar a probabilidade padrão de uma Etapa altera a probabilidade efetiva dos Negócios nela que não a sobrescrevem; Negócios com probabilidade sobrescrita mantêm o valor. Nenhuma probabilidade de Negócio é reescrita por gravação.
- **RN-FUN-19.** Toda operação sobre o Funil e suas Etapas, e toda transição de Etapa de Negócio, gera Registro de Atividade com ator e, quando houver, ator delegante (A6.2), registrando Etapas por identidade e nome à época.
- **RN-FUN-20.** A plataforma não interpreta nomes de Etapa. Uma Etapa chamada "Ganho", "Fechado" ou "Perdido" é Etapa de progressão comum; a situação do Negócio só muda por ato explícito de encerramento (20.12).

## 14. Invariantes

- **INV-FUN-01.** Todo Funil tem exatamente um Espaço de Trabalho, imutável.
- **INV-FUN-02.** Todo Funil existente tem ao menos uma Etapa, em todo instante.
- **INV-FUN-03.** As Etapas de um Funil têm Ordens distintas: a ordem é total e estrita.
- **INV-FUN-04.** Nomes de Funil são únicos entre `ativo` e `arquivado` no Espaço de Trabalho; nomes de Etapa são únicos dentro do Funil.
- **INV-FUN-05.** Toda Transição permitida e todo Requisito de Etapa referenciam apenas Etapas do mesmo Funil e Definições de Campo de Negócio do mesmo Espaço de Trabalho.
- **INV-FUN-06.** Todo Negócio referencia exatamente um Funil e exatamente uma Etapa, e a Etapa pertence ao Funil referenciado.
- **INV-FUN-07.** Nenhum Negócio `aberto` referencia Funil `arquivado` ou `na lixeira`; nenhum Negócio referencia Funil `na lixeira`.
- **INV-FUN-08.** O Espaço de Trabalho referencia exatamente um Funil padrão, que está `ativo` e não é privado. Consequência: existe ao menos um Funil `ativo` e não privado por Espaço de Trabalho.
- **INV-FUN-09.** Nenhuma Etapa carrega resultado: não existe Etapa cuja entrada altere a situação do Negócio.
- **INV-FUN-10.** Nenhuma operação sobre a configuração do Funil (reordenar, renomear, alterar Requisitos, Transições ou probabilidade) altera a Etapa ou a situação de um Negócio sem ato explícito de remapeamento registrado.
- **INV-FUN-11.** Um Funil nunca tem Proprietário.

## 15. Personalização

**Personalizável** (por `administrar` sobre o Funil, salvo indicação):

- Nome, Descrição, Cor, Ordem de exibição (esta também por Papel Administrador, para o conjunto de Funis).
- Etapas: criar, remover (com remapeamento), renomear, reordenar, cor, descrição, probabilidade padrão.
- Requisitos de Etapa e Transições permitidas por Etapa.
- Regras de encerramento (exigir Motivo de Perda; exigir valor).
- Privado e concessões sobre o Funil (seção 17).
- Automações com escopo Funil (documento 19); Widgets com o Funil como Fonte de Dados (documento 21).
- Funil padrão do Espaço de Trabalho (Papel Administrador ou Proprietário).

**Não personalizável:** Identificador, Espaço de Trabalho, Criador, momento de criação; estados e transições do Funil; ausência de estado da Etapa; a regra "toda Etapa é de progressão" (não há tipo de Etapa); a situação do Negócio e sua independência da Etapa; Definições de Campo (do Espaço de Trabalho: o Funil apenas as referencia); Motivos de Perda (catálogo do Espaço de Trabalho); ausência de Proprietário.

**Cópia, não Template.** O catálogo de Templates (A8; documento 01, 7.6) não prevê Template de Funil, e este documento não o cria: um Funil é uma configuração pequena, sem conteúdo, cuja reutilização é atendida por **cópia** de um Funil existente (12.1b), com Proveniência. Um "Template de Funil" formal só se justificaria com Funis fornecidos pela plataforma por segmento (imobiliário, clínicas, SaaS), o que é registrado como recomendação futura (DO-FUN-14; seção 25).

Não há Campos Personalizados sobre o Funil nem sobre a Etapa (A5.2).

## 16. Herança

O Funil **não herda e não transmite herança**. O CRM não tem hierarquia de contêineres (A5.2): Definições de Campo de Negócio, Tags, Motivos de Perda e Origens valem em todos os Funis por serem do Espaço de Trabalho, não por herança. Permissões sobre o Funil vêm do Papel e de concessões diretas (seção 17), sem "contêiner pai". A Etapa não herda nada do Funil: seus atributos são próprios.

O único mecanismo com aparência de herança é a **probabilidade efetiva** do Negócio: se o Negócio não sobrescreve a probabilidade, a efetiva é a probabilidade padrão da sua Etapa atual, resolvida a cada consulta (derivação, não cópia; RN-FUN-18). É uma regra de derivação de atributo do Negócio (documento 12), não herança de configuração no sentido de B25.

## 17. Permissões e visibilidade

### 17.1 O Funil como Recurso

| Ação | Significado sobre o Funil |
| --- | --- |
| `ver` | Ver o Funil, suas Etapas, Requisitos e Transições; pré-requisito para ver os Negócios que o percorrem quando o Funil é privado. |
| `criar` | Criar Negócios neste Funil e mover Negócios para ele (além de `criar`/`editar` sobre Negócio, do CRM). |
| `editar` | Alterar Nome, Descrição, Cor. |
| `administrar` | Etapas, Requisitos, Transições, Regras de encerramento, Privado, conceder permissões, arquivar e restaurar. Nunca para Agentes nem para Sujeitos de base Convidado. |
| `excluir` | Enviar à lixeira (com migração). Só Papel de nível Administrador (configuração de catálogo). |
| `comentar`, `executar` | Não se aplicam: o Funil não recebe Comentários e não é executável. |

Escopo: `registro` (o Funil). `subárvore` não se aplica (o Funil não é contêiner estrutural). `próprios` não se aplica ao Funil (não tem Proprietário, Responsável, Atribuído; Criador não confere acesso por si).

### 17.2 Origens

| Papel | Funil não privado | Funil privado |
| --- | --- | --- |
| Proprietário do ET / Administrador | ver, criar, editar, administrar, excluir; definir Funil padrão | Nada por origem "papel" (B38a); entram por ato de governança registrado (B38b) ou concessão. `excluir` e "definir padrão" continuam a exigir o Papel, mas o Funil privado só é excluído por quem também tem `ver`/`administrar` por concessão. |
| Membro | ver, criar | Nada sem concessão. |
| Convidado | Nada por Papel; só compartilhamento | Só compartilhamento (nunca `administrar`). |
| Agente | Papel próprio (ver, criar, editar conforme Papel); concessões diretas; nunca `administrar` | Só concessão direta (nunca `administrar`). |

Concessões diretas a Membros e Equipes somam ao Papel; `administrar` sobre um Funil é a forma de delegar a um gerente comercial a gestão de Etapas sem torná-lo Administrador do Espaço de Trabalho (DO-FUN-10). Criar Funil, excluir e definir padrão permanecem governança por Papel (RN-FUN-17).

### 17.3 Visibilidade de Negócios: do CRM, filtrada pelo Funil

Permissões sobre Negócios são **do CRM em geral**, por Papel e concessão, com escopo `registro` ou `próprios` (B29; documento 01, 17.2: "vendedor vê só seus Negócios"). O Funil **não** é origem de permissão sobre Negócios e não os "herda" a ninguém. Existe uma única interação, opcional, na direção restritiva (DO-FUN-10):

- **Funil não privado**: ver um Negócio depende só da permissão sobre Negócio. Quem vê Negócios vê os Funis não privados que eles percorrem (o Funil não é segredo).
- **Funil privado** (B38 aplicado ao Funil): ver, editar ou mover um Negócio que o percorre exige **também** `ver` sobre o Funil por concessão direta ou compartilhamento. A permissão efetiva sobre o Negócio é a interseção. Consequências: (a) o Proprietário de um Negócio **nunca perde `ver` sobre ele** (RN-NEG-20; INV-NEG-10): mover um Negócio para Funil privado, privatizar um Funil ou revogar `ver` sobre Funil privado é **rejeitado** salvo se, no mesmo ato, o ator conceder `ver` sobre o Funil ao Proprietário ou transferir a propriedade a Membro `ativo` com `ver`; na sucessão (B28), o Sucessor recebe `ver` automaticamente (DO-NEG-10); (b) todo Funil privado tem ao menos um Membro `ativo` com `administrar`, e quem o privatiza recebe `administrar` no ato (B38c); (c) quando o último Membro `ativo` com `administrar` é removido ou suspenso, a concessão passa ao Sucessor (B38d, exceção a B28); (d) a exportação total pelo Proprietário do Espaço de Trabalho alcança Funis privados (documento 01, 17.2); (e) o Funil padrão nunca é privado (RN-FUN-16; INV-FUN-08).

Justificativa da alternativa rejeitada ("permissões de Negócio por Funil como origem"): tornaria o Funil um contêiner de permissão, contradizendo DO-FUN-01 (Negócio percorre, não pertence) e criando duas fontes de verdade para a mesma pergunta ("quem vê este Negócio"). A restrição opcional por privacidade atende ao caso real (Funil privado de fusões, de parcerias, de diretoria) sem inverter o modelo.

### 17.4 IA sujeita às mesmas regras

Um Agente move Negócios de Etapa com `editar` sobre o Negócio (e `ver` sobre o Funil, se privado), sob Requisitos e Transições permitidas iguais aos de um Membro (A6.3). Em nome de um Membro, a interseção (A9.3). Um Agente nunca cria Funil, nunca administra Etapas, nunca recebe `administrar` (RN-FUN-17). Painéis sobre Funis filtram pelo visualizador (B20): um Widget "Negócios do Funil Diretoria" aparece vazio a quem não tem `ver` sobre o Funil privado.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Funil criado | 12.1 | Funil, Etapas iniciais, origem (padrão da plataforma, do zero, cópia com Proveniência), ator | Auditoria; Painéis |
| Funil alterado | Nome, Descrição, Cor, Ordem, Regras de encerramento | antes, depois, ator | Auditoria |
| Funil arquivado / restaurado / enviado à lixeira / restaurado da lixeira | 12.2 | Funil, ator; na migração, Funil de destino e mapeamento de Etapas | Automações (inoperante/reativar); Painéis; Negócio (migração) |
| Funil eliminado | 12.2 | Funil, nomes das Etapas, momento | Automações (eliminação, B41); Painéis (Widget inválido) |
| Funil padrão alterado | RN-FUN-16 | Funil anterior, novo, ator | Auditoria; criação de Negócios sem Funil explícito |
| Funil tornado privado / público; permissão concedida / revogada sobre o Funil | 17 | Funil, Sujeito, Ação, ator | Auditoria; Execuções (B23); Painéis (B20) |
| Etapa criada / alterada / reordenada | 12.3 | Funil, Etapa, antes, depois (inclusive Ordem e probabilidade padrão), ator | Auditoria; Painéis (probabilidade efetiva; ordem) |
| Requisitos ou Transições permitidas alterados | 12.3 | Etapa, antes, depois, ator | Auditoria; Automações (prever rejeições) |
| Etapa removida (com remapeamento) | 12.3 | Etapa removida (identidade e nome), Etapa de destino, lista de Negócios remapeados, ator — evento único agregado | Auditoria; Painéis; Automações (não dispara "entrou em Etapa" por remapeamento — RN-FUN-08) |
| Negócio entrou em Etapa | Criação, transição, mudança de Funil, reabertura | Negócio, Funil, Etapa de destino, Etapa de origem (se houver), origem da entrada (criação, avanço, retrocesso, mudança de Funil, reabertura, remapeamento), ator, ator delegante | Automações (Gatilho principal do Funil); Painéis (tempo em Etapa, conversão); Agentes |
| Negócio saiu de Etapa | Transição, mudança de Funil | Negócio, Etapa de origem, Etapa de destino, tempo de permanência, ator | Automações; Painéis |
| Negócio movido de Funil | RN-FUN-15 | Negócio, Funil e Etapa de origem e destino, ator | Automações dos dois Funis; Painéis |
| Negócio ganho / perdido / reaberto | Documento 12 | Negócio, Funil, última Etapa, Motivo de Perda, valor | Automações com escopo Funil (Gatilhos naturais); Painéis (conversão por Etapa) |
| Negócio parado em Etapa há X dias | Derivado; não é evento do Funil | — | Gatilho de agendamento de Automação avaliando "tempo na Etapa atual" (derivado do último "entrou em Etapa") |
| Transição rejeitada | Requisito, Transição permitida ou Regra de encerramento não satisfeitos | Negócio, Etapa de origem e destino, regra violada, ator | Registro de Atividade com resultado "rejeitada"; Execução de Automação (`falhou`); notificação ao ator |

Todos geram Registro de Atividade (RN-FUN-19). Os de Negócio têm o Negócio como objeto e o Funil/Etapa como dados; pertencem ao histórico do Negócio, e o Funil os consome como escopo (B41).

## 19. Dependências

**O Funil depende de:** Espaço de Trabalho (existência, unicidade de nome, Localidade para o nome do Funil padrão); Definições de Campo de Negócio do Espaço de Trabalho (para Requisitos do tipo `campo preenchido`); Motivos de Perda (para a Regra "exigir Motivo de Perda" ter o que exigir — a regra pode estar ativa com catálogo vazio, caso em que marcar `perdido` é impossível até criar um Motivo; a plataforma alerta ao ativar).

**Dependem do Funil:** Etapas (composição); a referência obrigatória de todo Negócio (B9 — migração antes da lixeira); Automações com escopo nele (B41 — eliminadas com ele); Widgets com o Funil como Fonte de Dados (referência inválida na eliminação); o atributo Funil padrão do Espaço de Trabalho (nunca fica vazio: RN-FUN-16).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) passa a criar o Funil padrão no ato de criação e a ter o atributo Funil padrão (impacto registrado em 24); Negócio (12) obedece a este documento em tudo o que envolve Funil e Etapa (etapa atual, última Etapa, probabilidade efetiva, mudança de Funil, reabertura, Regras de encerramento); Automações (19) recebe os Gatilhos da seção 18 e o escopo Funil (B41); Painéis (21) recebe os derivados (conversão, tempo em Etapa, valor ponderado); Caixa de Entrada (14) é par: nenhuma dependência.

## 20. Casos limítrofes e ambiguidades

### 20.1 Funil sem Etapas

Inválido (INV-FUN-02). A criação exige ao menos uma Etapa no mesmo ato; a remoção da última é rejeitada. Justificativa: um Funil sem Etapas não posiciona nenhum Negócio e violaria INV-FUN-06 no primeiro Negócio criado nele; permitir "Funil vazio a configurar depois" cria um estado intermediário que Automações e Painéis precisariam tratar.

### 20.2 Funil com uma única Etapa

Válido. Um Funil "Renovações" com a única Etapa "Em renovação" é um processo de um passo: o Negócio entra, e termina `ganho` ou `perdido`. Conversão entre Etapas é vazia; conversão para `ganho` é calculável. Nenhuma regra exige mínimo de duas.

### 20.3 Negócio `perdido` reaberto em Funil arquivado

O Funil `arquivado` não aceita transições nem Negócios `aberto` (RN-FUN-12, RN-FUN-14). A reabertura é aceita apenas se, no mesmo ato, o Negócio for movido para um Funil `ativo` com Etapa de destino explícita (Requisitos de `entrada` avaliados). Registro de Atividade duplo: "reaberto" e "movido de Funil". Alternativa rejeitada — reativar o Funil automaticamente — porque a decisão de reabrir um processo inteiro não deve decorrer de um ato sobre um único Negócio.

### 20.4 Etapa removida com 300 Negócios

A remoção exige remapeamento de todos os 300 (abertos e encerrados que a tenham como última Etapa) para uma Etapa do mesmo Funil, indicada pelo ator, no mesmo ato atômico (RN-FUN-10). Gera **um** evento agregado "Etapa removida" com a lista dos 300 e um Registro de Atividade por Negócio com origem "remapeado" — não 300 eventos "Negócio entrou em Etapa", e nenhuma Automação de "entrou em Etapa" dispara (RN-FUN-08). Requisitos de `entrada` da Etapa de destino não são avaliados. Se o ator quiser Negócios em Etapas diferentes, move-os antes, individualmente, com Requisitos.

### 20.5 Reordenar Etapas com Painel de conversão histórico

Painéis de conversão e de tempo em Etapa são calculados sobre Registros de Atividade de "entrou/saiu de Etapa", que registram a Etapa **por identidade** e nome à época (RN-FUN-19). Reordenar altera apenas a Ordem atual; "conversão de A para B" continua a somar os mesmos Registros. O que muda é a **leitura**: se B passou a preceder A, a transição A → B, antes "avanço", passa a ser exibida como "retrocesso" pela Ordem atual. Recomendação para Painéis: classificar avanço/retrocesso pela Ordem vigente à época, gravada no Registro (Ordem de origem e de destino como dados do evento), e não pela Ordem atual. Registrado em DO-FUN-13.

### 20.6 Negócio movido do Funil de vendas para o Funil de pós-venda

Permitido para Negócio `aberto` com `editar` no Negócio e `criar` no Funil de destino (RN-FUN-15). O ator escolhe a Etapa de destino ("Onboarding"); Requisitos de `saída` de "Negociação" e de `entrada` de "Onboarding" são avaliados; a probabilidade sobrescrita, se havia, é descartada com Registro, e a efetiva passa a ser a padrão de "Onboarding" (DO-NEG-05). O Negócio mantém identidade, valor, Contatos, Empresa, Valores de Campo (Definições são do Espaço de Trabalho), Comentários, Vínculos e histórico. Os Painéis do Funil de vendas deixam de contá-lo como `aberto`; o histórico de que percorreu "Vendas" permanece nos Registros. Caso frequente: o produto pode oferecer "ao ganhar, criar Negócio no Funil de pós-venda" por Automação — isso cria um **novo** Negócio com Proveniência, o que é diferente de mover; a escolha é do documento 12 e do produto.

### 20.7 Dois Funis com Etapas de nomes iguais

Permitido (RN-FUN-03 é por Funil). "Proposta" em "Vendas" e "Proposta" em "Parcerias" são Etapas distintas, com identidades, Requisitos e probabilidades independentes. Automações e Painéis referenciam Etapas por identidade, sempre no contexto de um Funil; um Gatilho "entrou em Proposta" pertence a uma Automação com escopo em um Funil (B41), portanto não há ambiguidade. Agentes que recebem "mover para Proposta" resolvem o nome dentro do Funil do Negócio.

### 20.8 Automação movendo Negócio para Etapa que exige campo vazio

A Ação "mover para Etapa X" é submetida aos Requisitos como qualquer Ator (RN-FUN-07). O Requisito rejeita; a Ação falha; a Execução de Automação passa a `falhou` (B18) com o Requisito violado registrado; Registro de Atividade com resultado "rejeitada", ator Automação e ator delegante o seu Proprietário. Nenhuma transição parcial ocorre. A Automação não "preenche o campo para passar": se isso for desejado, é uma Ação anterior, explícita, na mesma Automação.

### 20.9 Probabilidade da Etapa alterada com Negócios existentes

A probabilidade efetiva do Negócio é derivada (seção 16). Alterar a padrão de "Negociação" de 60% para 70% muda a efetiva de todos os Negócios em "Negociação" que a herdam; os que sobrescreveram (ex.: 90%, por avaliação do vendedor) mantêm 90% (RN-FUN-18). Nada é gravado nos Negócios; o valor ponderado dos Painéis muda na próxima consulta. Registro de Atividade na Etapa, não em cada Negócio.

### 20.10 Funil padrão excluído

Rejeitado enquanto for padrão (RN-FUN-16). O ator define outro Funil `ativo` como padrão e então arquiva ou exclui (com migração). Se só existe um Funil, ele é o padrão e não pode ser removido: o Espaço de Trabalho sempre tem um Funil `ativo` (INV-FUN-08). Alternativa rejeitada — Funil padrão opcional, com "criar Negócio sem Funil" falhando — porque B9 exige Funil em todo Negócio e a falha de criação por ausência de configuração é pior experiência do que um Funil padrão sempre presente.

### 20.11 Agente criando Funil

Rejeitado. Criar Funil é configuração de catálogo do Espaço de Trabalho, ação de governança por Papel de nível Administrador (documento 01, 17.2; RN-ET-24); Agentes nunca têm esse Papel (INV-ET-13) e nunca recebem `administrar` sobre Funis (RN-FUN-17). "Administrar o CRM" não é um Recurso: o CRM é domínio, não entidade (documento 01, 7.7). O que um Agente pode fazer: propor a criação a um Membro (Solicitação de Aprovação, A8) — quem cria é o Membro aprovador, com o Agente como ator solicitante no Registro de Atividade. O Agente pode mover Negócios entre Etapas com `editar`.

### 20.12 Etapa "Ganho" criada pelo usuário como Etapa comum

Permitido (RN-FUN-20): é uma Etapa de progressão chamada "Ganho". A plataforma não a interpreta: Negócios nela continuam `aberto`, contam como Negócios em aberto, disparam "entrou em Etapa" e não "Negócio ganho"; Painéis de conversão para `ganho` não a consideram. Recomendação de produto: ao criar Etapa com nome "Ganho", "Perdido", "Fechado" ou equivalentes na Localidade, orientar que a situação é registrada por "marcar como ganho/perdido", e oferecer a Automação "ao entrar nesta Etapa, marcar como ganho" para quem quiser o atalho — a Automação torna explícito o que a Etapa não faz. Alternativa "etapas terminais" rejeitada em DO-FUN-03.

### 20.13 Negócio criado por Automação em Funil arquivado

Rejeitado (RN-FUN-14): a Ação falha e a Execução passa a `falhou` com registro. Uma Automação com Ação "criar Negócio no Funil X" cujo Funil X foi arquivado passa a falhar a cada disparo até ser corrigida; ao arquivar um Funil, a plataforma lista as Automações de outros escopos que o referenciam como alvo (mesmo princípio de B41 para alvos de Ação). Se o Funil X for **eliminado**, a referência torna-se inválida e a Automação passa a inoperante com motivo até nova Versão (B93; RN-AUT-21).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Negócios "do Funil" | Espaço de Trabalho (o Negócio é raiz do próprio agregado) | Referência, não contenção (DO-FUN-01). |
| Situação `aberto`/`ganho`/`perdido` | Negócio | Estado de sistema do Negócio (A4.4). |
| Motivos de Perda | Espaço de Trabalho (catálogo) | Valem para todos os Funis (documento 01, 7.6). O Funil só decide se são obrigatórios. |
| Definições de Campo de Negócio | Espaço de Trabalho (A5.2) | O Funil as referencia em Requisitos; nunca as define (DO-FUN-07). |
| Valores de Campo, valor, moeda, Contatos, Empresa, Proprietário do Negócio | Negócio | Atributos e relações do Negócio; o Funil os valida em Requisitos, não os possui. |
| Probabilidade efetiva de um Negócio | Negócio (derivada) | A Etapa fornece o padrão; o Negócio pode sobrescrever. |
| Automações "do Funil" | Espaço de Trabalho | O Funil é escopo (B41). |
| Taxa de conversão, tempo em Etapa, valor ponderado, Negócios parados | Painéis (Métricas derivadas de Registros de Atividade) | Não são gravados no Funil (DO-FUN-12). |
| Registros de Atividade de transição | Espaço de Trabalho; objeto: Negócio | O Funil aparece como dado; o histórico é do Negócio. |
| Concessões sobre o Funil | Relações no Recurso | Não são componentes. |
| Visualização em colunas ("quadro") | Visualização (A8) do CRM ou pessoal | O Funil é o processo; o quadro é uma forma de vê-lo. |
| Filas, Conversas | Caixa de Entrada | Par no CRM; sem relação com Funil. |
| Tarefas "da Etapa" | Lista (Vínculo com o Negócio) | Um Negócio tem Tarefas vinculadas; a Etapa não contém nada. |
| Proprietário | — | Funil não tem Proprietário (INV-FUN-11). |
| Template de Funil | — (cópia com Proveniência) | Não previsto em A8 (DO-FUN-14). |
| Tempo esperado por Etapa, "dias parado" | Automação (parâmetro do Gatilho) / Painel | Não é atributo da Etapa nesta versão (seção 25). |

## 22. Exemplos conceituais

**Exemplo 1 — Clínica com dois processos.** A "Clínica Vida" nasce com o Funil padrão "Vendas" (Etapas "Novo", "Qualificado", "Proposta", "Negociação"; 10/30/60/80%). A Administradora renomeia-o para "Novos pacientes" e cria, por cópia, o Funil "Retorno de pacientes" com Etapas "Contato", "Agendamento" (probabilidade 90%). Em "Proposta" define o Requisito de `entrada` "campo preenchido: Plano de saúde" (Definição de Campo de Negócio do Espaço de Trabalho) e ativa "exigir Motivo de Perda". O Negócio "Pacote de 10 sessões — Dra. Camila" nasce em "Novo" pelo Funil padrão; o Agente "Qualificador" tenta movê-lo para "Proposta" sem Plano de saúde: rejeitado, Execução `falhou`, Registro com o Requisito. A recepcionista preenche o campo e move; a Automação com escopo no Funil "ao entrar em Proposta, criar Tarefa 'Enviar proposta' na Lista Propostas" dispara. O Negócio é `perdido` em "Negociação" com Motivo "Preço"; permanece referenciando "Negociação" como última Etapa; o Painel "Perdas por Etapa" o conta em "Negociação".

**Exemplo 2 — Reorganização.** A gerente comercial (Membro com `administrar` sobre "Novos pacientes", sem ser Administradora do Espaço de Trabalho) remove a Etapa "Qualificado", com 300 Negócios (240 abertos, 60 encerrados com ela como última Etapa), remapeando todos para "Novo": um evento agregado; nenhuma Automação de "entrou em Novo" dispara; nenhum Requisito é avaliado. Em seguida reordena "Negociação" antes de "Proposta": nenhum Negócio se move; o Painel de conversão histórico continua correto porque lê Registros por identidade de Etapa; a leitura avanço/retrocesso usa a Ordem gravada no evento.

**Exemplo 3 — Funil privado.** A Proprietária cria o Funil "Aquisições" e o marca como privado; recebe `administrar` no ato e concede `ver` e `criar` à Equipe "Diretoria". Um vendedor com Papel Membro e escopo `próprios` sobre Negócios não vê nenhum Negócio de "Aquisições" (a interseção falha em `ver` sobre o Funil); quando a Proprietária moveu para lá um Negócio de que ele era Proprietário, a operação exigiu, no mesmo ato, conceder-lhe `ver` sobre o Funil ou transferir a propriedade — ela transferiu à diretora (RN-NEG-20). O Painel "Negócios em aberto" da diretora inclui "Aquisições"; o mesmo Painel compartilhado com o vendedor exibe o Widget vazio (B20).

**Exemplo 4 — Arquivamento.** Terminada a campanha, a Administradora arquiva o Funil "Black Friday 2026". Restam 12 Negócios `aberto`: a operação exige migrá-los para "Novos pacientes" com mapeamento ("Interesse" → "Novo", "Fechando" → "Negociação"). Os 480 Negócios `ganho`/`perdido` permanecem referenciando o Funil arquivado; o Painel anual continua a lê-los. Em janeiro, um Negócio `perdido` da campanha é reaberto: exige mover para "Novos pacientes" no mesmo ato. Dois anos depois, o Funil vai à lixeira: os 480 precisam ser migrados antes; a Automação "ao ganhar, enviar cupom" com escopo nele é eliminada com o Funil ao fim do prazo, junto com as suas Execuções; os Registros de Atividade e os cupons enviados permanecem (B41; DO-AUT-17).

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Funil padrão ──────────────────────────► referencia exatamente 1 Funil `ativo`
├── Catálogos: Definição de Campo de Negócio (0..N), Motivo de Perda (0..N)
│                     ▲ referenciados por Requisitos            ▲ exigido por Regras de encerramento
│
├── FUNIL (1..N)  [estado: ativo | arquivado | na lixeira; Privado; Criador; sem Proprietário]
│   ├── Regras de encerramento (objeto de valor: exigir Motivo de Perda; exigir valor)
│   ├── Proveniência (0..1: copiado de Funil)
│   └── ETAPA (1..N, composição; ordem total e estrita; identidade estável)
│         ├── nome, ordem, probabilidade padrão, cor, descrição
│         ├── Requisito de Etapa (0..N, objeto de valor: momento entrada|saída; tipo)
│         └── Transições permitidas (0..N, objeto de valor; vazio = todas)
│
├── NEGÓCIO (0..N; documento 12)  ── referencia ──► 1 Funil  e  1 Etapa desse Funil
│     situação: aberto | ganho | perdido   (estado do Negócio, NÃO Etapa)
│     etapa atual (aberto) / última Etapa (ganho, perdido)
│     probabilidade efetiva = sobrescrita ?? probabilidade padrão da Etapa (derivada)
│
├── AUTOMAÇÃO (0..N; escopo pode ser um Funil — B41)  ── reage a ──► eventos de Etapa/situação
└── PAINEL → Widget (Fonte de Dados: Negócios de um Funil) ── deriva ──► conversão, tempo, ponderado

Funil → Negócio: associação por referência (o Negócio PERCORRE; não pertence).
Funil → Etapa: contenção (composição).  Nenhuma herança em nenhuma aresta.
```

## 24. Decisões ontológicas

- **DO-FUN-01.** O Negócio **percorre** e **referencia** o Funil; não pertence a ele. Funil → Negócio é associação por referência; Funil → Etapa é composição. Justificativa: o Negócio sobrevive à troca de Funil, ao arquivamento (como histórico) e à remoção de Etapa (por remapeamento); tratá-lo como contido exigiria cascata, estado efetivo (B36) e Valores órfãos (B37) que não fazem sentido no CRM (A5.2). Aplica A2.2, B9. RECOMENDADA.
- **DO-FUN-02.** O Funil é entidade contida pelo Espaço de Trabalho, com identidade, sem Proprietário (tem Criador); governança por Papel e `administrar`; sem sucessão. Aplica A7, B34; alinhada a DO-LIS-03 e B35. CONSOLIDADA.
- **DO-FUN-03.** **Toda Etapa é de progressão.** Não existem Etapas terminais, de ganho ou de perda, nem "tipo de etapa" ou categoria de Etapa; `ganho`/`perdido` são situações do Negócio (A4.4), que preserva a última Etapa (B9). Alternativa rejeitada — "etapas terminais" (Etapas marcadas como ganho/perda, como no ClickUp e em vários CRMs): mistura posição com resultado, obriga o Negócio a "sair" da Etapa em que de fato terminou, destrói Painéis "em que Etapa perdemos" e "conversão por Etapa", e cria dois caminhos para o mesmo fato (marcar como ganho × arrastar para a coluna "Ganho"). RECOMENDADA.
- **DO-FUN-04.** A Etapa inicial é derivada (menor Ordem), não gravada. Um Negócio pode ser criado diretamente em qualquer Etapa de um Funil `ativo`, com Requisitos de `entrada` avaliados e evento "entrou em Etapa" com origem "criação". Justificativa: importações, Integrações e Agentes criam Negócios já qualificados; forçar a Etapa inicial geraria transições artificiais. RECOMENDADA.
- **DO-FUN-05.** Transição padrão: de qualquer Etapa para qualquer Etapa do mesmo Funil, avanço, retrocesso e salto. **Transições permitidas** por Etapa são objeto de valor opcional; vazio significa todas. RECOMENDADA.
- **DO-FUN-06.** **Requisito de Etapa** é objeto de valor de configuração (momento `entrada`/`saída`; tipo verificável sobre o próprio Negócio e seus Vínculos), avaliado de forma síncrona e bloqueante para todo Ator, sem exceção por Papel, e **não avaliado em remapeamentos obrigatórios**. Requisito é validação; Automação é reação (B16): Requisito não tem Gatilho, Ação nem Execução. Remover a Definição referenciada remove o Requisito. RECOMENDADA.
- **DO-FUN-07.** O Funil **não define Definições de Campo**; Definições de Negócio são do Espaço de Trabalho (A5.2) e valem em todos os Funis. "Exigir campo X neste Funil" é Requisito de Etapa referenciando a Definição existente. Justificativa: Definições por Funil criariam Valores órfãos na troca de Funil e duas fontes de Definições para a mesma entidade. CONSOLIDADA (A5.2).
- **DO-FUN-08.** **Regras de encerramento** são objeto de valor do Funil (exigir Motivo de Perda; exigir valor ao ganhar) que o Negócio consome ao mudar de situação. Justificativa: a exigência varia por processo (vendas exige motivo; pós-venda não), e o Motivo de Perda continua catálogo do Espaço de Trabalho. É configuração do Funil sobre uma transição do Negócio, não atributo do Negócio nem Requisito de Etapa (o Negócio não sai da Etapa ao encerrar). RECOMENDADA.
- **DO-FUN-09.** O **Funil padrão** é criado no ato atômico de criação do Espaço de Trabalho, com Etapas padrão da plataforma, e é referenciado pelo atributo **Funil padrão** do Espaço de Trabalho (exatamente um, sempre `ativo` e nunca privado, não arquivável, não excluível nem privatizável enquanto padrão). Consequência: ET → Funil passa a 1..N e existe sempre ao menos um Funil `ativo` (o invariante "um Funil `ativo` enquanto houver Negócios `aberto`" decorre dele). **Impacto no documento 01**: 12.1 passa a incluir o Funil padrão (item 7), a seção 6 ganha o atributo Funil padrão (referência obrigatória) e a linha ET → Funil da seção 9 passa a 1..N — o documento 01 já previa esta delegação. RECOMENDADA.
- **DO-FUN-10.** Permissões sobre Negócios são do CRM (Papel, concessão, escopo `registro`/`próprios` — B29); o Funil não é origem de permissão sobre Negócios. Restrição opcional única: **Funil privado**, com as regras de B38 (interrompe "papel" e "herança" inclusive para Administradores; ato de governança registrado; ao menos um Membro `ativo` com `administrar`; sucessão da concessão), em que `ver` sobre o Funil é pré-requisito (interseção) para ver/editar os Negócios que o percorrem. Criar, excluir e definir padrão são governança por Papel; administrar Etapas é `administrar` sobre o Funil, concedível a Membros e Equipes, nunca a Agentes nem a base Convidado. RECOMENDADA.
- **DO-FUN-11.** Mover Negócio de Funil exige Etapa de destino explícita; não há mapeamento automático por nome ou posição. Arquivar exige migração de todos os Negócios `aberto`; enviar à lixeira exige migração de todos os Negócios de qualquer situação; remover Etapa exige remapeamento de todos os que a referenciam, com evento único agregado. Alternativa rejeitada — Negócio "órfão" com Funil/Etapa como valor histórico congelado — porque viola B9 (referência a exatamente um Funil e uma Etapa). RECOMENDADA.
- **DO-FUN-12.** Taxa de conversão, tempo em Etapa, valor ponderado e "parado há X dias" são derivados de Registros de Atividade e atributos de Negócio, calculados por Painéis e Gatilhos; nunca gravados no Funil ou na Etapa. RECOMENDADA.
- **DO-FUN-13.** Registros de Atividade de transição gravam Etapa de origem e destino por identidade, nome à época e Ordem à época; Painéis classificam avanço/retrocesso pela Ordem gravada, não pela atual. Justificativa: reordenação não pode reescrever história. RECOMENDADA (condiciona o documento 21).
- **DO-FUN-14.** Não há Template de Funil: o Funil é copiável dentro do Espaço de Trabalho, com Proveniência. Funis fornecidos pela plataforma por segmento são recomendação futura, não entidade. Aplica A8 sem ampliá-lo. RECOMENDADA.
- **DO-FUN-15.** A Etapa não tem estado nem lixeira: é componente; sua remoção é definitiva e exige remapeamento (RN-FUN-10). "Etapa desativada" é registrada como questão em aberto, não adotada. RECOMENDADA.
- **DO-FUN-16.** Nome de Funil único no Espaço de Trabalho entre `ativo` e `arquivado`; nome de Etapa único no Funil; `na lixeira` não reserva nome. Estende B39 ao Funil por analogia (caminho "Funil › Etapa" legível para Automações, Painéis e Agentes). RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-FUN-09 altera a cardinalidade condicionada do documento 01 nos termos que o próprio documento 01 previa. DO-FUN-10 estende B38 a um Recurso fora da Estrutura de Trabalho e é candidata a decisão B.

## 25. Questões em aberto

1. **Etapa desativada.** Organizações pedirão "fechar uma Etapa a novos Negócios sem removê-la" (histórico legível na interface, não só nos Registros). Hoje a resposta é remover com remapeamento (DO-FUN-15). Consequência: sem estado por Etapa, uma Etapa obsoleta com Negócios encerrados só sai remapeando-os, o que altera a "última Etapa" gravada nesses Negócios (a verdade histórica permanece nos Registros).
2. **Requisitos que consultam outros registros.** "Só entra em Fechamento com a Tarefa 'Contrato' concluída" ou "com Proposta aceita" (D3) exigem Requisitos que leem Vínculos e outras entidades. DO-FUN-06 limita o Requisito ao próprio Negócio e seus Vínculos diretos; ampliar exige definir permissões de leitura do validador e comportamento quando o registro vinculado é inacessível ao ator.
3. **Transições restritas por Sujeito.** "Só gerente retrocede de Negociação" é restrição por Papel sobre uma transição, não prevista (Transições permitidas são por Etapa, iguais para todos). Consequência: sem isso, o controle é feito por Automação reativa (desfazer com registro), o que é pior do que validação.
4. **Tempo esperado por Etapa e dias úteis.** "Negócio parado" e prazos por Etapa dependem de C12 (horário comercial). Se o produto quiser um "prazo esperado" como atributo da Etapa (para alertas sem Automação), isso deve ser decidido junto com C12 para que "dias" signifique o mesmo em Funil, Fila e Painel.
5. **Funil privado e escopo `próprios`.** **Resolvida** pelo documento 12 (DO-NEG-10; RN-NEG-20; INV-NEG-10): o Proprietário nunca perde `ver` sobre o próprio Negócio; a operação que o faria é rejeitada salvo concessão ou transferência no mesmo ato; na sucessão, concessão automática ao Sucessor. Aplicada em 17.3 (a).
6. **Funis fornecidos pela plataforma por segmento** (DO-FUN-14). Se adotados, exigem decidir se são Templates (ampliando A8) ou Funis pré-criados (o que infla o Espaço de Trabalho recém-criado).
