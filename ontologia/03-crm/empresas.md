# EMPRESA

> Domínio: CRM | Documento 11 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

A **Empresa** é a representação, no CRM, de uma **organização externa identificável** com a qual a organização do Espaço de Trabalho mantém ou pode manter relacionamento: pessoa jurídica, órgão público, associação, unidade de negócio de outra organização, empresa estrangeira ou organização de fato sem registro formal. É o sujeito coletivo do relacionamento — a contraparte que permanece enquanto pessoas entram e saem dela e enquanto negociações começam e terminam.

Três propriedades a distinguem de qualquer outra entidade:

1. **É organização, não pessoa.** A Empresa não conversa, não se autentica, não responde mensagens, não consente. Quem conversa são Contatos vinculados a ela (documento 10; B12). Tudo o que "a Empresa disse" é, ontologicamente, algo que um Contato disse em uma Conversa.
2. **É o "quem" durável do relacionamento.** Um Negócio é o que está sendo negociado agora; uma Conversa é um episódio; um Contato é uma pessoa que pode mudar de emprego. A Empresa sobrevive a todos eles: uma organização com vinte Negócios ao longo de dez anos e três gerações de interlocutores é uma única Empresa.
3. **É externa.** Nunca é a organização que usa a plataforma. O Espaço de Trabalho é o continente do CRM; a Empresa é conteúdo dele (documento 01, 4). Se a organização decidir registrar-se como Empresa do próprio CRM, isso cria um registro comum, sem nenhuma ligação ontológica com o Espaço de Trabalho.

A Empresa não é uma "conta", não é uma "pasta do cliente", não é um "grupo de Contatos" e não é um campo de texto no Negócio. É a organização externa enquanto objeto de relacionamento rastreável.

## 2. Propósito

1. **Dar ao relacionamento B2B um sujeito estável.** Sem Empresa, o histórico comercial com uma organização fica fragmentado entre os Contatos que passaram por ela e os Negócios que a mencionaram por texto. A Empresa é o ponto ao qual Contatos, Negócios, Tarefas e Comentários se prendem para que "tudo o que temos com a Alfa" seja uma pergunta respondível.
2. **Identificar organizações de forma verificável.** Documento fiscal e domínio são identificadores do mundo real. Como Identificadores de Empresa (seção 7.1), permitem detectar duplicidade, sugerir Vínculos de Contatos e reconciliar dados de Integrações sem depender de nome.
3. **Representar estrutura corporativa.** Grupos econômicos (holding → controlada → filial) e relações entre organizações (parceira, fornecedora, concorrente) são fatos do mercado que Painéis e Agentes precisam ler ("valor em aberto no grupo Alfa", "esta Empresa é concorrente de um cliente").
4. **Ancorar responsabilidade humana pelo relacionamento.** Cada Empresa tem exatamente um Proprietário (A7), que responde pela sua governança — quem a mantém correta, quem decide mesclar ou arquivar — sem que isso se confunda com quem executa Tarefas ou conduz Conversas.
5. **Alimentar Painéis e IA com uma dimensão organizacional.** Receita por Empresa, Negócios por grupo econômico, Conversas por cliente: nada disso é computável se a organização externa for apenas texto.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Ator e existente até a eliminação permanente.
- **Raiz de agregado**: responde pela consistência de Identificadores de Empresa, Endereços, Valores de Campo e Comentários, que não existem fora dela.
- **Pertence diretamente ao Espaço de Trabalho** (documento 01, 8), sem contêiner intermediário: o CRM não tem hierarquia de contêineres (A5.2). Escopo de unicidade dos seus Identificadores é o Espaço de Trabalho.
- **Tem Proprietário** (A7): exatamente um Membro. Não tem Responsável nem Atribuído.
- **Nó de duas relações entre Empresas**, de naturezas distintas: a hierarquia matriz/filial (relação estrutural opcional, árvore) e o Vínculo Empresa-Empresa (associação tipada, grafo livre). Nenhuma das duas é contenção: uma filial existe sem a matriz.
- **Objeto de Vínculos** com Contato (B8), Tarefa (DO-TAR-08) e de referência por Negócio (B9). Nunca contém nenhum deles.
- **Recurso de permissão** sem herança de contêiner: origem papel, concessão direta, compartilhamento e escopo `próprios` (B29).
- **Não é Ator.** A Empresa nunca age. **Não é Contato, não é Negócio, não é Conversa, não é Espaço de Trabalho, não é Equipe, não é configuração, não é Template.**

## 4. Fronteira conceitual

### O que é

- Uma organização externa identificável, com ou sem registro formal.
- O ponto de convergência do relacionamento coletivo: Contatos que a representam, Negócios negociados com ela, Tarefas feitas para ela.
- Um nó de estrutura corporativa (matriz/filial) e de rede de mercado (parceira, fornecedora, concorrente).

### O que não é

- **Não é Contato.** Contato é pessoa física (A1.4; Glossário). A Empresa não tem telefone pelo qual "ela" fala: tem Contatos com Identificadores de Contato. Um telefone registrado na Empresa (7.1) é dado de referência, nunca resolve Mensagens.
- **Não é Negócio.** Negócio é o que está sendo negociado, com Funil, Etapa, valor e situação (A4.4, B9). A Empresa é com quem. Um Negócio pode não ter Empresa (venda a pessoa física); uma Empresa pode não ter Negócios.
- **Não é o Espaço de Trabalho.** A organização dona do Espaço de Trabalho não é Empresa de si mesma (documento 01, 4). Um registro de Empresa com o nome da própria organização é apenas um registro.
- **Não é Equipe.** Equipe é grupo interno de Membros (A8). A Empresa é externa e não tem Membros.
- **Não é Conversa nem tem Conversas.** Conversa é sempre com um Contato principal (B12). "As Conversas da Empresa" é uma visão derivada (seção 8.4).
- **Não é catálogo nem configuração.** Segmento, porte e setor são Valores de Campo (seção 15), não atributos com semântica de sistema.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Empresa × Contato** | Organização externa; não age, não conversa; identificada por documento fiscal e domínio; tem Proprietário. | Pessoa física externa; conversa por Canais; identificada por telefone, e-mail e identidades em Canal (B13); tem Proprietário. | Só Contato é resolvido a partir de Mensagens recebidas. Um Contato pode estar em 0..N Empresas (B8); uma Empresa não "é" nenhum dos seus Contatos. Sem Contatos, a Empresa é válida; sem Empresa, o Contato é válido. |
| **Empresa × Negócio** | Quem: a organização com quem se negocia. Sem Funil, sem valor, sem situação. Dura enquanto o relacionamento durar. | O quê: uma oportunidade com Funil, Etapa, valor, situação (`aberto`, `ganho`, `perdido`). Dura um ciclo comercial. | Negócio referencia 0..1 Empresa (B9); Empresa tem 0..N Negócios ao longo do tempo. Fechar um Negócio não altera a Empresa; arquivar a Empresa não fecha Negócios (seção 12). |
| **Empresa × Espaço de Trabalho** | Conteúdo do CRM: organização externa registrada. | Continente do CRM: a organização que registra. Raiz, isolamento, membresia. | O Espaço de Trabalho tem Membros; a Empresa tem Contatos vinculados. Nada do Espaço de Trabalho (Papéis, Localidade, Limites) aparece na Empresa. Registrar a própria organização como Empresa não cria ligação (20.1). |
| **Empresa × Equipe** | Organização externa; tem Contatos (pessoas externas) vinculados; objeto de relacionamento comercial. | Grupo interno de Membros; Sujeito de permissão e destino de distribuição (Filas). | Equipe responde "quem, dentro da organização"; Empresa responde "com quem, fora dela". Uma Equipe pode ser Sujeito de permissão sobre Empresas; uma Empresa nunca é Sujeito de nada. |
| **Empresa matriz × Empresa parceira** | Relação estrutural: atributo "Empresa matriz" (0..1) forma uma árvore acíclica; expressa controle/pertencimento corporativo; base de agregações de grupo. | Relação associativa: Vínculo Empresa-Empresa tipado (`parceira`, `fornecedora de`/`cliente de`, `concorrente`); grafo livre, N:N, possivelmente cíclico. | Hierarquia é única por Empresa (uma só matriz) e acíclica; associação é múltipla e sem ordem. Painéis agregam pela hierarquia, nunca pelo Vínculo. Uma Empresa pode ser filial de A e parceira de A ao mesmo tempo (fatos distintos). |
| **Empresa × Identificador de Empresa** | Entidade com identidade, agregado, Proprietário, ciclo de vida. | Entidade interna: (tipo, valor, verificado, principal) que identifica a Empresa no mundo real; único por (tipo, valor) no Espaço de Trabalho. | O Identificador não existe fora da Empresa; a Empresa existe sem Identificadores (20.2). Trocar todos os Identificadores não muda a Empresa (seção 5). |

## 5. Identidade

A Empresa tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo, componente ou relação.

**Teste de identidade.** Se a razão social mudar (reestruturação societária), o nome fantasia mudar (rebranding), o CNPJ mudar (fusão que gera nova pessoa jurídica, incorporação), o domínio mudar, todos os Contatos forem substituídos, o Proprietário for transferido e a matriz for outra, continua sendo a mesma Empresa: os Negócios ganhos há cinco anos continuam sendo dela, os Registros de Atividade continuam se referindo a ela, os Vínculos permanecem. A identidade é a **continuidade do relacionamento**, não qualquer identificador do mundo real.

Consequências:

- **Documento fiscal não é identidade.** É um Identificador de Empresa (7.1): forte, único no Espaço de Trabalho, mas substituível. Uma organização que trocou de CNPJ mantém a mesma Empresa com o Identificador antigo removido (ou mantido como não principal, se o produto quiser preservar histórico fiscal).
- **Nome não é identidade.** Duas Empresas podem ter o mesmo nome fantasia ("Alfa" em duas cidades); a unicidade vive nos Identificadores, não no nome (INV-EMP-02). Nome igual gera sugestão de duplicidade, nunca rejeição.
- **Mesclagem preserva a identidade da absorvida** (B14): a Empresa absorvida passa a `mesclado` e aponta para a sobrevivente; referências históricas à absorvida continuam válidas e resolvem para a sobrevivente. A identidade da absorvida não desaparece: torna-se um apelido resolvido.
- **Hierarquia não é identidade.** Mudar a matriz de uma filial move o nó na árvore; a filial permanece a mesma Empresa.

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Nome fantasia | nativo | condicional | Nome pelo qual a organização é conhecida no mercado. Editável. Ao menos um entre Nome fantasia e Razão social é obrigatório (INV-EMP-01). |
| Razão social | nativo | condicional | Denominação registrada da pessoa jurídica. Editável. Vazio para organizações de fato. |
| Nome de exibição | derivado | sim | Nome fantasia; na sua ausência, Razão social. É o que Visualizações, menções, Painéis e Agentes exibem. Nunca gravado. |
| Estado | nativo | sim | `ativo`, `arquivado`, `na lixeira`, `mesclado` (seção 11). |
| Proprietário | referência (Membro) | sim | Membro `ativo` ou `suspenso` que responde pela Empresa (A7, INV-ET-03). Transferível; sucedido na remoção (B28). |
| Criador | referência (Ator) | sim | Imutável (A7). Pode ser Agente, Automação ou Integração, com ator delegante registrado (A6.2). |
| Momento de criação | nativo | sim | Imutável. |
| Descrição | nativo (texto longo) | não | Contexto livre sobre a organização. Não é Comentário: não tem autor próprio; alterações ficam no Registro de Atividade. |
| Empresa matriz | referência (Empresa) | não | 0..1. A Empresa da qual esta é filial/controlada (seção 10). Mesmo Espaço de Trabalho; nunca ela própria nem uma descendente (INV-EMP-05). |
| Empresa raiz do grupo | derivado | sim | O ancestral sem matriz na cadeia de Empresas matriz; a própria Empresa quando não tem matriz. Nunca gravado. |
| Origem | referência (Origem) | não | 0..1. Fonte de aquisição do relacionamento (catálogo do Espaço de Trabalho, B34). Amplia o uso de Origem, hoje definido para Contato e Negócio (DO-EMP-09). |
| Identificadores de Empresa | entidade interna | não | 0..N (7.1). |
| Endereços | objeto de valor | não | 0..N (7.2). |
| Valores de Campo | entidade interna | condicional | Um por Definição de Campo Personalizado aplicável a Empresa (A5; 7.3). |
| Tags | associação | não | 0..N Tags do Espaço de Trabalho (B5). |
| Contato principal | derivado | não | O Contato do Vínculo Contato-Empresa marcado "principal da Empresa" (8.2). 0..1. Nunca gravado na Empresa. |
| Mesclada em | referência (Empresa) | condicional | Preenchido apenas no estado `mesclado`: a sobrevivente (B14). |
| Momento de arquivamento / de envio à lixeira | nativo | condicional | Preenchidos enquanto `arquivado` / `na lixeira`. |
| Estado anterior à exclusão | nativo (condicional) | condicional | Presente enquanto `na lixeira`: o estado (`ativo` ou `arquivado`) que a Empresa tinha ao ser excluída; a restauração a devolve a esse estado e o esvazia, nunca forçando `ativo` (B43 aplicada por analogia ao CRM; mesmo atributo de Contato e Negócio). |
| Última interação | derivado | não | Momento do item mais recente da linha do tempo (8.4). Nunca gravado. |

Não são atributos, embora apareçam junto da Empresa: número e valor de Negócios `aberto`, receita ganha, quantidade de Contatos, quantidade de filiais, valor agregado do grupo — todos **derivados** para Visualizações e Painéis. Não são atributos: Segmento, Porte, Setor — são Valores de Campo de Definições pré-definidas (seção 15).

## 7. Entidades internas ou componentes

### 7.1 Identificador de Empresa

Entidade interna análoga ao Identificador de Contato (B13): o meio pelo qual a Empresa é reconhecida no mundo real e pelo qual a plataforma detecta duplicidade e sugere Vínculos. Sem existência fora da Empresa.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Tipo | nativo (catálogo da plataforma) | sim | `domínio`, `documento fiscal`, `telefone`. Catálogo fixo da plataforma nesta versão (DO-EMP-03). |
| Valor | nativo | sim | Normalizado por tipo: domínio em minúsculas, sem protocolo nem `www`; documento fiscal apenas dígitos, com país; telefone em formato internacional. A normalização é regra da plataforma; a ontologia exige que a unicidade se avalie sobre o valor normalizado. |
| País | nativo | condicional | Obrigatório para `documento fiscal` (CNPJ é o tipo brasileiro; documentos estrangeiros usam o mesmo tipo com país próprio). |
| Verificado | nativo (booleano) + momento + origem | não | Confirmado por fonte externa (Integração, consulta cadastral) ou por Membro. Não altera unicidade. |
| Principal | nativo (booleano) | não | No máximo um principal por tipo por Empresa (INV-EMP-03). |
| Momento de criação; Criador | nativo / referência | sim | Auditoria (A6.2). |

**O que não é Identificador de Empresa.** (a) **Identidade em Canal** (número de WhatsApp, usuário de Instagram): a resolução de Mensagens recebidas é feita exclusivamente por Identificador de Contato (B13); admitir identidade em Canal na Empresa criaria dois caminhos de resolução e contradiria B12 (toda Conversa tem Contato principal). O número geral da organização externa, se conversa, é um Contato ("Recepção da Alfa") vinculado à Empresa. (b) **E-mail**: mesma razão; caixas genéricas (`contato@alfa.com`) que enviam Mensagens são Contatos. O que a Empresa guarda é o **domínio**. (c) **Endereço**: é objeto de valor (7.2), não identifica. (d) **Site**: é o domínio; a URL completa pode ser Valor de Campo do tipo URL.

**Telefone de Empresa versus telefone de Contato.** Um `telefone` de Empresa é dado de referência ("central: +55 11 3000-0000") e **nunca resolve Mensagens**. A unicidade de Identificador de Empresa é avaliada entre Identificadores de Empresa; o mesmo número pode existir como Identificador de Contato de um Contato (a recepção que responde no WhatsApp) sem conflito (DO-EMP-03).

**Domínios que não identificam.** Domínios de provedores públicos de e-mail (`gmail.com`, `outlook.com`, `hotmail.com` e equivalentes, em lista mantida pela plataforma) são rejeitados como Identificador de Empresa (RN-EMP-05): identificam um provedor, não uma organização, e gerariam sugestões de Vínculo em massa.

### 7.2 Endereço

Objeto de valor (sem identidade), 0..N por Empresa. Componentes: **tipo** (`sede`, `cobrança`, `entrega`, `outro`, com rótulo livre quando `outro`), logradouro, número, complemento, bairro, cidade, região/estado, país, código postal, **principal** (no máximo um por Empresa). Pode haver vários Endereços do mesmo tipo (várias entregas). Um Endereço é substituído, não editado com histórico próprio: a alteração fica no Registro de Atividade da Empresa. Endereço não é filial: uma organização com três locais e um só CNPJ é uma Empresa com três Endereços; três CNPJs são três Empresas em hierarquia (20.4).

### 7.3 Valor de Campo

Um por Definição de Campo Personalizado com entidade-alvo Empresa (A5.1, A5.2). Definições vivem no Espaço de Trabalho; o Valor pertence ao agregado. Existe só com Definição aplicável; remover a Definição remove ou arquiva os Valores (A5.4). Como o CRM não tem hierarquia de contêineres, não há Valores órfãos por movimentação (B37 não se aplica). Definições pré-definidas (Segmento, Porte, Setor) em 15.

### 7.4 Comentário

Manifestação de um Ator sobre a Empresa (A8), com as mesmas regras do Comentário em Tarefa (documento 06, 7.1): autor Ator (Agente incluído, com ator delegante), conteúdo rico com menções e Anexos, respostas em um nível, resolução no Comentário raiz, edição só pelo autor ou por quem tem `administrar` sobre a Empresa, exclusão com marcador. Diferença única: não existe "Administrador do contêiner"; o papel equivalente é quem tem `administrar` sobre a Empresa (seção 17). Comentário não é Mensagem: nunca chega a um Contato. Comentário sobre um Negócio da Empresa pertence ao Negócio; a linha do tempo da Empresa (8.4) apenas o exibe.

### 7.5 Anexo

Referência a Arquivo do Espaço de Trabalho (A8), na Empresa ou em Comentários. Contrato social, cartão CNPJ, apresentação institucional são Anexos — nunca atributos e nunca Identificadores. Remover o Anexo remove a referência, não o Arquivo.

### 7.6 O que tem identidade própria e não é componente

Vínculo Contato-Empresa (8.2), Vínculo Empresa-Empresa (8.3), Negócio, Tarefa, Contato: relações ou entidades com existência própria. Sugestão de Vínculo (8.5) é objeto de valor transitório, não componente.

## 8. Relações

### 8.1 Tabela de relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | ET → Empresa | Exatamente um, imutável (A1.1). Sem contêiner intermediário. |
| é de propriedade de | Membro | propriedade | Empresa → Membro | Exatamente um Proprietário (A7). Sucessão em B28. |
| foi criada por | Ator | referência | Empresa → Ator | Criador imutável; ator delegante registrado. |
| contém Identificadores, Endereços, Valores de Campo, Comentários | entidades internas / objetos de valor | contenção (agregado) | Empresa → interna | Sem existência fora da Empresa. |
| tem matriz | Empresa | relação estrutural opcional (hierarquia) | Empresa → Empresa | 0..1. Árvore acíclica (10; INV-EMP-05). Não é contenção: a filial existe sem a matriz. |
| tem filiais | Empresa | derivada (inversa de "tem matriz") | Empresa → Empresa | 0..N. Nunca gravada. |
| vinculada a Contatos | Contato | associação (Vínculo Contato-Empresa, B8) | Empresa ↔ Contato | N:N, com papel e dois indicadores de principal (8.2). |
| vinculada a Empresas | Empresa | associação (Vínculo Empresa-Empresa, tipado) | Empresa ↔ Empresa | N:N; simétrico ou direcionado por tipo (8.3). |
| é referenciada por Negócios | Negócio | referência inversa | Negócio → Empresa | 0..N. Negócio referencia 0..1 Empresa (B9). A Empresa não contém Negócios. |
| vinculada a Tarefas | Tarefa | associação (Vínculo Tarefa-Empresa, DO-TAR-08) | Empresa ↔ Tarefa | 0..N, papel textual opcional. |
| vinculada a Documentos de Conhecimento | Documento de Conhecimento | associação (Vínculo) | Empresa ↔ Documento | 0..N, sem propriedade (conhecimento.md DO-CNH-07 / B99). |
| tem Tags | Tag | associação N:N | Empresa ↔ Tag | Tags do Espaço de Trabalho (B5), respeitada a restrição de tipo da Tag. |
| tem Origem | Origem | referência (uso de catálogo) | Empresa → Origem | 0..1. |
| usa Definições de Campo | Definição de Campo Personalizado | referência (uso de configuração) | Empresa → Definição | Definições do Espaço de Trabalho com entidade-alvo Empresa (A5.2). |
| anexa Arquivos | Arquivo | referência | Empresa → Arquivo | 0..N. |
| foi mesclada em | Empresa | referência (apelido) | Empresa → Empresa | Só no estado `mesclado`; exatamente uma (B14). Cadeias são resolvidas até a sobrevivente `ativo`/`arquivado`/`na lixeira`. |
| é objeto de | Execução de Agente / Automação | referência inversa | Execução → Empresa | A Empresa não contém Execuções. |
| é âncora de | Sessão de Chat | referência inversa | Sessão → Empresa | B83 (que amplia B21) lista Empresa entre as âncoras, adotando DO-EMP-14. A Empresa não conhece Sessões. |
| é registrada em | Registro de Atividade | referência inversa | Registro → Empresa | Histórico (A6). |
| é Fonte de Dados de | Painel (Widget) | referência inversa | Painel → Empresa | Filtrada pelo visualizador (B20). |

Distinção aplicada: **pertencer** (Espaço de Trabalho), **CONTER** (Identificadores, Endereços, Valores, Comentários), **USAR** (Definições de Campo, Tags, Origem), **REFERENCIAR** (Arquivo, Ator, apelido de mesclagem), **RELACIONAR-SE** (Vínculos com Contato, Empresa, Tarefa; referência inversa de Negócio), **hierarquia sem contenção** (matriz/filial). A Empresa **não HERDA** nada e **não CONFIGURA** nada (seção 16).

### 8.2 Vínculo Contato-Empresa e os dois indicadores de principal

O Vínculo Contato-Empresa (B8) é uma associação N:N com **papel** (cargo/função) e indicador de **principal**. Este documento fixa que "principal" são **duas perguntas distintas sobre o mesmo Vínculo**:

- **Empresa principal do Contato** (lado do Contato): entre as Empresas de um Contato, qual é a sua afiliação primária. No máximo um Vínculo com esse indicador por Contato (B8).
- **Contato principal da Empresa** (lado da Empresa): entre os Contatos de uma Empresa, qual é o interlocutor primário. No máximo um Vínculo com esse indicador por Empresa (INV-EMP-04).

**Decisão: um único Vínculo com dois indicadores independentes** (DO-EMP-05). Justificativa: um "Contato principal da Empresa" gravado na Empresa como referência separada admitiria estado inconsistente (Contato principal sem Vínculo, ou com Vínculo removido); no Vínculo, o indicador só existe enquanto a relação existir. Os indicadores são independentes: o interlocutor primário da Alfa pode ter a Beta como afiliação primária (consultor). Desvincular remove ambos os indicadores; a Empresa pode ficar sem Contato principal (válido, 20.8). Os demais atributos do Vínculo — papel, início e fim (vigência; encerrar em vez de apagar) — são fixados no documento 10 (DO-CON-02); este documento só exige os dois indicadores.

### 8.3 Vínculo Empresa-Empresa

Associação tipada entre duas Empresas do mesmo Espaço de Trabalho, distinta da hierarquia. Tipos nesta versão (catálogo fixo da plataforma, DO-EMP-07):

| Tipo | Direcionalidade | Leitura |
| --- | --- | --- |
| `parceira` | simétrico | A é parceira de B ⇔ B é parceira de A. |
| `concorrente` | simétrico | Idem. |
| `fornecedora de` / `cliente de` | direcionado (uma aresta, duas leituras) | A é fornecedora de B ⇔ B é cliente de A. Mesmo modelo de `bloqueia`/`é bloqueada por` em Dependência (documento 06, 8.3). |
| `outro` | simétrico, com rótulo livre | Para relações não previstas. |

Regras: no máximo um Vínculo por (par de Empresas, tipo, direção); proibido entre uma Empresa e ela mesma; ciclos permitidos (A fornece a B, B fornece a A é fato possível); não implica hierarquia, permissão, propriedade ou agregação; visível só a quem vê ambos os lados. Um Vínculo com Empresa `na lixeira` fica oculto; a eliminação de um lado remove o Vínculo. Matriz e filial **não** precisam de Vínculo para se relacionar: a hierarquia já o expressa; um Vínculo `fornecedora de` entre matriz e filial é fato adicional válido.

### 8.4 Linha do tempo (derivada)

Não é entidade nem atributo: é a **visão** que agrega, em ordem temporal, (a) os Registros de Atividade da Empresa e do seu agregado; (b) os Negócios que a referenciam e os seus eventos; (c) as Conversas cujo Contato principal está vinculado à Empresa (Vínculo vigente no momento da consulta); (d) as Tarefas vinculadas; (e) os Comentários da Empresa. Cada item é exibido apenas a quem tem `ver` sobre ele (uma Conversa que o visualizador não vê não aparece, sem indicar a lacuna). A linha do tempo **não** inclui filiais por padrão; a agregação de grupo é opção de Visualização e de Painel, sempre derivada (seção 16). A linha do tempo de uma Empresa não muda o que pertence a quem: uma Conversa continua pertencendo à Caixa de Entrada e tendo um Contato principal (DO-EMP-08).

### 8.5 Sugestão de Vínculo por domínio

Quando um Contato tem Identificador de Contato do tipo e-mail cujo domínio coincide com um Identificador de Empresa do tipo `domínio`, a plataforma emite uma **Sugestão de Vínculo** (objeto de valor transitório: Contato, Empresa, evidência, momento), consumível por Membros com `editar` em ambos, por Agentes com as mesmas permissões e por Automações. **A plataforma nunca cria o Vínculo por conta própria** (DO-EMP-04): o domínio é evidência forte, não prova (consultores, e-mails de ex-funcionários, subdomínios de terceiros). Uma organização que queira automatizar o aceite o faz por Automação explícita (Gatilho "Sugestão de Vínculo emitida" → Ação "vincular"), com a Automação como ator e Registro de Atividade — decisão da organização, não da plataforma. Sugestão rejeitada não é reemitida para o mesmo par enquanto a evidência não mudar. O mesmo mecanismo aplica-se ao caso inverso: ao registrar um `domínio` na Empresa, sugestões são emitidas para Contatos existentes com e-mail nesse domínio.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Empresa → Espaço de Trabalho | 1 | não | não | pertencimento | A1.1. |
| Espaço de Trabalho → Empresa | 0..N | sim | sim | pertencimento | CRM só com pessoas físicas é válido. |
| Empresa → Proprietário | 1 | não | não | propriedade | A7. Zero deixaria a Empresa sem governança; vários diluiriam. |
| Empresa → Criador | 1 | não | não | referência | A7. |
| Empresa → Identificador de Empresa | 0..N | sim | sim | contenção | Organização de fato pode não ter documento nem domínio (20.2). Vários: domínio + documento + telefone; múltiplos domínios. |
| Identificador → principal por tipo | 0..1 | sim | não | — | INV-EMP-03. |
| Empresa → Endereço | 0..N | sim | sim | objeto de valor | Vários locais; nenhum é obrigatório. |
| Empresa → Valor de Campo | 0..N | sim | sim | contenção | Um por Definição aplicável. |
| Empresa → Comentário | 0..N | sim | sim | contenção | |
| Empresa → Tag | 0..N | sim | sim | associativa (N:N) | B5. |
| Empresa → Origem | 0..1 | sim | não | referência | Muitas Empresas são registradas sem origem conhecida. |
| Empresa → Empresa matriz | 0..1 | sim | não | estrutural opcional | Uma organização tem no máximo uma controladora direta; joint ventures com dois controladores são Vínculo `parceira` entre os controladores e matriz única escolhida (20.15). |
| Empresa → filiais | 0..N | sim | sim | derivada | Sem limite de quantidade nem de profundidade (DO-EMP-06). |
| Empresa → Contato (Vínculo) | 0..N | sim | sim | associativa | B8. Empresa sem Contatos é válida (20.2). |
| Contato → Empresa (Vínculo) | 0..N | sim | sim | associativa | B8. |
| Empresa → Vínculo "Contato principal da Empresa" | 0..1 | sim | não | — | INV-EMP-04. |
| Contato → Vínculo "Empresa principal do Contato" | 0..1 | sim | não | — | B8. |
| Empresa → Vínculo Empresa-Empresa | 0..N | sim | sim | associativa | Por (par, tipo, direção) no máximo um. |
| Negócio → Empresa | 0..1 | sim | não | referência | B9. |
| Empresa → Negócios | 0..N | sim | sim | referência inversa | Vinte Negócios em três Funis é o caso normal de cliente recorrente (20.3). |
| Empresa → Tarefa (Vínculo) | 0..N | sim | sim | associativa | DO-TAR-08. |
| Empresa → Documento de Conhecimento (Vínculo) | 0..N | sim | sim | associativa | conhecimento.md DO-CNH-07 / B99. Documento → Empresa também 0..N. |
| Empresa → Anexo | 0..N | sim | sim | referência | |
| Empresa `mesclado` → sobrevivente | 1 | não | não | referência | B14. |
| Empresa → absorvidas | 0..N | sim | sim | referência inversa | Uma sobrevivente pode ter absorvido várias. |
| Empresa → Sugestão de Vínculo pendente | 0..N | sim | sim | objeto de valor transitório | |

Sem `DECISÃO NECESSÁRIA` pendente: todas as cardinalidades decorrem da constituição ou estão fixadas em decisões RECOMENDADAS da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Pertencimento.** A Empresa pertence ao Espaço de Trabalho e falha no teste de existência sem ele. Seus componentes (Identificadores, Endereços, Valores, Comentários) falham no teste de existência sem a Empresa: contenção. Contato, Negócio, Tarefa e outras Empresas passam no teste: associação ou referência.

**Hierarquia matriz/filial.** É uma **relação estrutural opcional, não contenção**: o atributo Empresa matriz (0..1) forma uma **floresta de árvores acíclicas** sobre as Empresas do Espaço de Trabalho. Decisão (DO-EMP-06): **sem limite fixo de profundidade**. Justificativa: grupos econômicos reais têm holding → controlada → filial → unidade; um limite de um nível obrigaria a achatar a estrutura e perder a semântica de "grupo"; um limite arbitrário (3, 5) seria contornado por Vínculos, que não agregam. A proteção necessária é a aciclicidade (INV-EMP-05), não a profundidade. A plataforma pode impor um Limite imposto (B34) sem alterar a ontologia. Derivados: **Empresa raiz do grupo**, **nível** (0 para raiz), **grupo** (conjunto de Empresas com a mesma raiz).

O que a hierarquia **não** faz: a filial não herda Proprietário, Contatos, Negócios, Tags, Valores de Campo, Comentários, permissões nem estado da matriz (seção 16). Arquivar a matriz não arquiva filiais; não há estado efetivo (B36 é da Estrutura de Trabalho). O que a hierarquia faz: permite agregações derivadas — "Negócios do grupo", "valor em aberto do grupo", "Contatos do grupo" — computadas por Painéis e Visualizações a partir da árvore, sempre filtradas pelo visualizador (B20).

**"Pertence a" versus "relaciona-se com".** A Empresa *pertence* ao Espaço de Trabalho. *É de propriedade de* um Membro (governança, não contenção). *Tem como matriz* outra Empresa (estrutura sem contenção). *Relaciona-se com* Contatos, Empresas, Tarefas (Vínculos) e *é referenciada por* Negócios. Nada pertence à Empresa exceto seus componentes internos.

**Propriedade.** Exatamente um Proprietário, sempre Membro (B7), transferível por ato explícito, sucedido em B28. Não existe Responsável, Atribuído ou "gerente de conta" como termo ontológico (A7); "quem cuida desta conta" é o Proprietário. Se a organização precisar de vários papéis internos por Empresa (executivo comercial, suporte, financeiro), usa Definições de Campo do tipo pessoa (Membro), que são atributos sem semântica de governança.

## 11. Estados

Estados de sistema, não personalizáveis. A Empresa não tem Status (A4.2) nem situação (A4.4).

| Estado | Significado | O que é permitido |
| --- | --- | --- |
| `ativo` | Relacionamento vigente ou possível. | Tudo, conforme permissões. Único estado em que novos Negócios, novos Vínculos e nova matriz podem apontar para ela (RN-EMP-08). |
| `arquivado` | Relacionamento encerrado ou dormente; registro preservado e consultável. | Ver, comentar. Vínculos, Negócios e hierarquia existentes permanecem; nada novo aponta para ela. Contatos vinculados seguem conversando normalmente (20.13). Reversível. |
| `na lixeira` | Excluída de forma recuperável, por prazo da Política de lixeira. | Ver (por quem tem `excluir`), restaurar. Oculta em Visualizações, Painéis, sugestões e Ferramentas de Agente. Vínculos ficam ocultos, não removidos. |
| `mesclado` | Absorvida por outra Empresa (B14). Terminal. | Nada. Toda referência a ela resolve para a sobrevivente. Não é restaurável (20.5). |

Eliminação permanente não é estado: é o fim do registro (A4.1). Derivados de operação, não estados: "sem Contatos", "sem Negócios", "com Negócios `aberto`", "raiz de grupo".

## 12. Ciclo de vida

### 12.1 Criação

Por Membro com `criar` sobre Empresas, por Agente (com `criar`; em nome de Membro, interseção A9.3), por Automação, por Integração (importação, sincronização) ou pelo Sistema (nunca nesta versão). Ato atômico que produz a Empresa `ativo` com ao menos um nome (INV-EMP-01), Proprietário definido (RN-EMP-02), Criador, Identificadores informados (validados por unicidade antes de gravar — uma colisão rejeita a criação inteira e aponta a Empresa existente, RN-EMP-04) e o primeiro Registro de Atividade. Proveniência opcional: registro de origem (ex.: "criada a partir do domínio do Contato X", "importada da Integração Y").

**Proprietário inicial** (RN-EMP-02): o Membro que cria; para Agente em nome de Membro, o ator delegante Membro; para Agente autônomo (sem delegante, ou com a Automação como delegante — DO-AUT-15), Automação ou Integração, o Membro configurado na Automação/Ferramenta e, na sua ausência, o Proprietário do Agente ou da Automação ou o Membro configurador da Integração. Nunca vazio; nunca Membro que não esteja `ativo` (RN-ET-08).

### 12.2 Transições

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | `editar` | Registro de Atividade. Nada em cascata: Contatos, Negócios, filiais, Vínculos permanecem como estão. Sugestões de Vínculo pendentes são descartadas. |
| `arquivado` | `ativo` | `editar` | Registro de Atividade. |
| `ativo` / `arquivado` | `na lixeira` | `excluir` | **Rejeitado** se existir Negócio `aberto` (situação) não `na lixeira` que a referencie, ou filial com estado `ativo`/`arquivado` (RN-EMP-09). Vínculos ocultados; referências de Negócios `ganho`/`perdido` preservadas; Empresa matriz preservada (a filial na lixeira continua a apontar para a matriz). Sugestões descartadas. |
| `na lixeira` | estado anterior | `excluir` | Restaura com Vínculos, Identificadores e referências. Se um Identificador colidir com outra Empresa criada entretanto, a restauração é rejeitada até resolução (mesclar ou remover o Identificador) — INV-EMP-02 não admite exceção. |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo) ou `excluir` (ato explícito) | **Adiada** enquanto houver Negócio não eliminado que a referencie (RN-EMP-10): a Empresa permanece `na lixeira` e o evento "eliminação adiada" é emitido; a eliminação ocorre no ciclo seguinte ao da eliminação do último Negócio. Ao eliminar: agregado eliminado; Vínculos (Contato, Empresa, Tarefa) removidos; Tags desaplicadas; Anexos removidos (Arquivos permanecem); Registros de Atividade permanecem (INV-ET-12); Empresas `mesclado` que apontavam para ela são eliminadas no mesmo ato (RN-EMP-13). |
| `ativo` / `arquivado` | `mesclado` | `administrar` sobre **ambas** as Empresas | 12.3. |

Não existe transição a partir de `mesclado`.

### 12.3 Mesclagem (B14)

Ato atômico entre duas Empresas do mesmo Espaço de Trabalho, cada uma `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), uma **sobrevivente** e uma **absorvida**, praticado por Ator com `administrar` sobre **ambas** (Agente: Ferramenta de classe `escrita irreversível`, sujeita a aprovação em `supervisionado` — B22; B64; B77) — regra única com Contato (documento 10, 12.4; B14). **Estado resultante da sobrevivente**: `ativo` se ao menos uma das duas era `ativo`; `arquivado` só se ambas eram `arquivado`. A re-referência de Negócios e a migração de Vínculos e filiais por mesclagem são **migração, não relação nova**: RN-EMP-08 não se aplica a elas. Efeitos, no mesmo ato:

1. **Atributos nativos**: os da sobrevivente prevalecem; os vazios da sobrevivente são preenchidos pelos da absorvida (Razão social, Descrição, Origem). O ator pode escolher campo a campo; a regra acima é o padrão.
2. **Identificadores**: união (não há colisão possível entre as duas por INV-EMP-02). Indicadores de principal da sobrevivente prevalecem; os da absorvida só valem onde a sobrevivente não tinha principal do tipo.
3. **Endereços**: união; principal da sobrevivente prevalece.
4. **Valores de Campo**: sobrevivente prevalece; vazios preenchidos pela absorvida (mesma regra do item 1).
5. **Tags**: união.
6. **Vínculos Contato-Empresa**: migram para a sobrevivente. Se o mesmo Contato estava vinculado a ambas, permanece um Vínculo (o da sobrevivente; papel da sobrevivente). "Contato principal da Empresa" da sobrevivente prevalece; o da absorvida vale só se a sobrevivente não tinha. "Empresa principal do Contato" que apontava para a absorvida passa a apontar para a sobrevivente, salvo se o Contato já tinha a sobrevivente como principal — então nada muda; se o Contato tinha a absorvida como principal e a sobrevivente como não principal, o Vínculo resultante é principal.
7. **Negócios**: passam a referenciar a sobrevivente. Situação, Funil, Etapa intactos.
8. **Vínculos com Tarefas e Vínculos Empresa-Empresa**: migram; os que se tornariam laço (absorvida ↔ sobrevivente) são removidos; duplicatas por (par, tipo, direção) colapsam. Tudo com Registro de Atividade.
9. **Hierarquia**: a sobrevivente **ocupa o lugar da absorvida na árvore**: as filiais da absorvida passam a ter a sobrevivente como matriz. Se a sobrevivente não tinha matriz e a absorvida tinha, a sobrevivente assume a matriz da absorvida. Se a absorvida era ancestral da sobrevivente, a sobrevivente assume a matriz da absorvida (o avô) e a aresta que formaria ciclo é removida. Se a absorvida era descendente da sobrevivente, o subárvore da absorvida é religado à sobrevivente. Em todo caso o resultado é verificado contra INV-EMP-05 antes de gravar; violação rejeita a mesclagem inteira (20.6).
10. **Comentários e Anexos**: migram com autoria intacta.
11. **Proprietário, Criador, Momento de criação**: os da sobrevivente. O Proprietário da absorvida deixa de ser Proprietário de algo (não há "co-propriedade").
12. **Absorvida**: passa a `mesclado`, com Mesclada em = sobrevivente; conserva os próprios Registros de Atividade; toda referência histórica a ela resolve para a sobrevivente. Registros de Atividade sobre a mesclagem são gravados em ambas.
13. **Sugestões de Vínculo** pendentes da absorvida são reavaliadas contra a sobrevivente.

Mesclar mais de duas é sequência de mesclagens. Desfazer mesclagem não existe nesta versão (seção 25).

### 12.4 O que acontece com dependentes

| Dependente | Arquivar | Lixeira | Eliminar | Mesclar |
| --- | --- | --- | --- | --- |
| Identificadores, Endereços, Valores, Comentários | intactos | intactos, ocultos | eliminados | migram |
| Vínculos Contato-Empresa | intactos | ocultos | removidos (Contatos intactos) | migram |
| Negócios | intactos; nenhum novo | só `ganho`/`perdido` (bloqueio se `aberto`) | bloqueio até eliminação deles | re-referenciam |
| Filiais | intactas; nenhuma nova | bloqueio se houver | não há (bloqueio) | religadas |
| Vínculos Empresa-Empresa, Tarefa-Empresa | intactos | ocultos | removidos | migram (laços removidos) |
| Conversas dos Contatos | intactas (não são da Empresa) | intactas | intactas | intactas |
| Registros de Atividade | intactos | intactos | permanecem (INV-ET-12) | permanecem em ambas |
| Empresas `mesclado` que apontam para esta | intactas | intactas | eliminadas junto | passam a apontar para a nova sobrevivente (cadeia resolvida) |

## 13. Regras de negócio ontológicas

- **RN-EMP-01.** Toda Empresa pertence a exatamente um Espaço de Trabalho, definido na criação e imutável. Nenhuma relação da Empresa cruza a fronteira (INV-ET-07).
- **RN-EMP-02.** Toda Empresa tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho, definido na criação conforme 12.1. Transferência: pelo Proprietário atual ou por quem tem `administrar` sobre a Empresa, para Membro `ativo` (RN-ET-08), com Registro de Atividade. Na remoção do Proprietário, sucessão no mesmo ato (B28).
- **RN-EMP-03.** A Empresa tem ao menos um entre Nome fantasia e Razão social em todo instante; o Nome de exibição é derivado e nunca gravado.
- **RN-EMP-04.** Um Identificador de Empresa é único por (tipo, valor normalizado) entre todas as Empresas do Espaço de Trabalho em qualquer estado exceto `mesclado`, cujos Identificadores já migraram. Criar, editar, importar ou restaurar com colisão é rejeitado, com indicação da Empresa detentora; o caminho para consolidar é a mesclagem (12.3).
- **RN-EMP-05.** Identificadores do tipo `domínio` cujo valor esteja na lista de provedores públicos de e-mail mantida pela plataforma são rejeitados.
- **RN-EMP-06.** Identificadores de Empresa nunca resolvem Mensagens recebidas nem criam Conversas; a resolução é exclusiva do Identificador de Contato (B13). A unicidade de Identificador de Empresa é avaliada entre Identificadores de Empresa, não contra Identificadores de Contato.
- **RN-EMP-07.** A plataforma emite Sugestões de Vínculo por coincidência de domínio e nunca cria o Vínculo por conta própria. O aceite é ato de Membro, de Agente com permissão ou de Automação configurada pela organização, sempre com Registro de Atividade.
- **RN-EMP-08.** Só uma Empresa `ativo` pode receber: novo Negócio que a referencie, novo Vínculo (Contato, Empresa, Tarefa), nova filial (ser definida como matriz de outra) ou nova matriz. Relações existentes sobrevivem ao arquivamento. Uma Empresa `na lixeira` ou `mesclado` não pode ser alvo de nenhuma relação nova.
- **RN-EMP-09.** Enviar à lixeira é rejeitado enquanto existir Negócio com situação `aberto` e estado diferente de `na lixeira` que referencie a Empresa, ou filial com estado `ativo` ou `arquivado`. O ator resolve antes: fecha, move ou envia à lixeira os Negócios; reatribui ou envia à lixeira as filiais. O produto pode oferecer essas resoluções em um gesto, cada uma sujeita às próprias regras.
- **RN-EMP-10.** A eliminação permanente é adiada enquanto existir qualquer Negócio não eliminado (em qualquer situação e estado) que referencie a Empresa. A alternativa "remover a referência e eliminar" é rejeitada: a referência de um Negócio `ganho` à Empresa é fato comercial cuja perda corrompe receita por Empresa em Painéis. O caminho ontologicamente correto para "não quero mais ver esta Empresa" é arquivar.
- **RN-EMP-11.** Definir a Empresa matriz é rejeitado se o destino for a própria Empresa, uma descendente dela, uma Empresa de estado diferente de `ativo`, ou uma Empresa `mesclado` (a resolução para a sobrevivente é responsabilidade do ator, não do Sistema). Remover a matriz torna a Empresa raiz do próprio grupo; as filiais dela permanecem com ela.
- **RN-EMP-12.** Nenhum atributo, Valor de Campo, Tag, Vínculo, Proprietário, permissão ou estado é herdado ou propagado entre matriz e filiais, em nenhuma direção. Agregações de grupo são derivadas.
- **RN-EMP-13.** Uma Empresa `mesclado` permanece enquanto a sobrevivente existir e é eliminada no mesmo ato da eliminação permanente da sobrevivente. Mesclar a sobrevivente em uma terceira faz as absorvidas anteriores resolverem para a nova sobrevivente (cadeia resolvida, sem gravar apelidos intermediários).
- **RN-EMP-14.** Toda ação sobre a Empresa ou seu agregado gera Registro de Atividade com ator e ator delegante quando houver (A6.2). Alterações em Vínculos geram Registro nas duas pontas.
- **RN-EMP-15.** Não existe Conversa com Empresa nem Vínculo Conversa-Empresa. A visão de Conversas da Empresa é derivada dos Contatos vinculados (8.4).
- **RN-EMP-16.** Um Agente cria, edita, vincula, arquiva ou mescla Empresas apenas com as permissões correspondentes (A6.3, A9.3); mesclar e enviar à lixeira são Ferramentas de classe `escrita irreversível` para efeito de B22 (B64; B77).

## 14. Invariantes

- **INV-EMP-01.** Toda Empresa em qualquer estado tem Nome fantasia ou Razão social não vazio.
- **INV-EMP-02.** Não existem duas Empresas, em estados `ativo`, `arquivado` ou `na lixeira`, no mesmo Espaço de Trabalho, com Identificador de Empresa do mesmo (tipo, valor normalizado).
- **INV-EMP-03.** Cada Empresa tem no máximo um Identificador principal por tipo e no máximo um Endereço principal.
- **INV-EMP-04.** Cada Empresa tem no máximo um Vínculo Contato-Empresa marcado "Contato principal da Empresa"; cada Contato tem no máximo um marcado "Empresa principal do Contato" (B8).
- **INV-EMP-05.** O grafo formado pelo atributo Empresa matriz é uma floresta: nenhuma Empresa é ancestral de si mesma.
- **INV-EMP-06.** Toda Empresa tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (INV-ET-03).
- **INV-EMP-07.** Nenhum Negócio `aberto` com estado `ativo` ou `arquivado` referencia Empresa `na lixeira` ou `mesclado`; nenhuma Empresa `ativo` ou `arquivado` tem como matriz uma Empresa `na lixeira` ou `mesclado`.
- **INV-EMP-08.** Toda Empresa `mesclado` referencia exatamente uma Empresa cujo estado não é `mesclado` (após resolução de cadeia), do mesmo Espaço de Trabalho.
- **INV-EMP-09.** Nenhum Vínculo Empresa-Empresa liga uma Empresa a si mesma; existe no máximo um por (par, tipo, direção).
- **INV-EMP-10.** Nenhuma Empresa é Contato principal de Conversa, Participante, Sujeito de permissão, Responsável, Atribuído ou Ator.

## 15. Personalização

**Personalizável pela organização** (no Espaço de Trabalho, por Administrador ou Proprietário do Espaço de Trabalho, salvo indicação):

- **Definições de Campo Personalizado** com entidade-alvo Empresa (A5.2), de qualquer Tipo de Campo (A5.3), inclusive relação (Empresa → outra entidade) e pessoa (Membro).
- **Definições pré-definidas** (DO-EMP-10): na criação do Espaço de Trabalho, a plataforma instancia três Definições de Campo com entidade-alvo Empresa — **Segmento**, **Porte** e **Setor** — do tipo seleção única, com opções iniciais sugeridas, marcadas por Proveniência "pré-definida pela plataforma". São Definições como quaisquer outras: a organização edita opções, renomeia, torna obrigatórias ou arquiva. Nenhuma regra de sistema, Painel nativo ou Agente depende delas por nome: dependem, se quiserem, por referência à Definição. Justificativa: a semântica de "porte" varia por país e por organização; um atributo nativo imporia uma escala única sem nenhuma regra da ontologia que a consumisse (diferentemente de categoria de status, A4.3). Pré-definir garante que Painéis e importações comecem com uma dimensão organizacional comum sem congelar a semântica.
- **Tags** (B5) e **Origens** (B34), com Empresa como tipo de entidade elegível.
- **Automações** com Gatilhos em eventos de Empresa (seção 18).
- Por Membro: Visualizações pessoais de Empresas.

**Não personalizável:**

- Identificador, Criador, momento de criação, estados e transições.
- Catálogo de tipos de Identificador de Empresa (plataforma; extensível por versão da ontologia, não por Espaço de Trabalho).
- Tipos de Endereço e tipos de Vínculo Empresa-Empresa (plataforma; `outro` com rótulo cobre o restante; catálogo configurável é questão em aberto, seção 25).
- Unicidade de Identificador, aciclicidade da hierarquia, unicidade de Proprietário.
- Regras de lixeira e eliminação (RN-EMP-09, RN-EMP-10).

## 16. Herança

A Empresa **não herda de nada**: não está em contêiner da Estrutura de Trabalho (A2.2), e o CRM não tem níveis (A5.2). Recebe do Espaço de Trabalho, por **escopo** e não por herança: Definições de Campo do CRM, Tags, Origens, Localidade (para exibição de valores derivados), Política de lixeira, Papéis.

**A hierarquia matriz/filial não é canal de herança** (RN-EMP-12). Tabela do que **não** flui:

| Aspecto | Flui de matriz para filial? | O que existe em vez disso |
| --- | --- | --- |
| Proprietário | não | Cada Empresa tem o seu; transferência em lote é ato repetido, um Registro por Empresa. |
| Permissões | não | Ver uma matriz não dá `ver` sobre filiais; compartilhar uma filial não expõe a matriz além do nome (17.2). |
| Contatos, Negócios, Tarefas, Comentários | não | Agregação derivada "do grupo" em Visualizações e Painéis. |
| Tags, Valores de Campo, Origem | não | Automação da organização pode copiar por regra, com Registro. |
| Estado | não | Arquivar a matriz não arquiva filiais; não há estado efetivo (B36 é da Estrutura de Trabalho). |
| Identificadores, Endereços | não | A filial tem os próprios (CNPJ de filial é distinto do da matriz). |

Justificativa: a árvore corporativa representa controle no mundo real, não organização interna do CRM. Herança de permissão por ela tornaria o acesso dependente de um fato externo editável por quem tem `editar` (definir matriz ampliaria acesso), o que contornaria o modelo de permissões.

## 17. Permissões e visibilidade

### 17.1 Modelo

A Empresa é Recurso da tupla (Sujeito, Ação, Recurso, Escopo, Origem) (A9.1). Origens aplicáveis: papel no Espaço de Trabalho, concessão direta, compartilhamento. Não há herança de contêiner. Escopos: `registro` (uma Empresa) e `próprios` (Empresas em que o Sujeito é Proprietário ou Criador — B29); `subárvore` não se aplica (a hierarquia matriz/filial não é subárvore estrutural; DO-EMP-12). Padrão do Papel Membro (documento 01, 17.2): ver todas as Empresas; Papéis personalizados podem restringir a `próprios`. Convidado: nada sem compartilhamento.

| Ação | Sobre a Empresa significa |
| --- | --- |
| ver | Ler a Empresa e o agregado; ver Vínculos e hierarquia cujo outro lado também vê; ver a linha do tempo filtrada. |
| comentar | Criar Comentários e respostas; editar e excluir os próprios. |
| criar | Criar Empresas (o Proprietário inicial é definido por RN-EMP-02). |
| editar | Alterar atributos, Identificadores, Endereços, Valores, Tags, Origem, Anexos; arquivar e desarquivar; criar e remover Vínculos (exige `ver` no outro lado; para Vínculo Contato-Empresa, `editar` em ambos); definir e remover matriz (exige `editar` na filial e `ver` na matriz); aceitar Sugestões de Vínculo. |
| excluir | Enviar à lixeira, restaurar, eliminar por ato explícito. |
| administrar | Compartilhar; transferir Proprietário; mesclar (exigido em **ambas** as Empresas — 12.3); editar ou excluir Comentários de terceiros. O Proprietário tem `administrar` sobre a própria Empresa por origem "papel", salvo Papel personalizado que o negue. |

### 17.2 Vínculos, hierarquia e agregações

- Um Vínculo é visível só a quem vê **ambos** os lados; quem vê um lado só vê "registro sem acesso" ou nada, conforme o produto (mesma regra de DO-TAR-08).
- Na hierarquia, quem vê a filial e não a matriz vê apenas o **Nome de exibição** da matriz (navegação), nunca o conteúdo. Quem vê a matriz e não todas as filiais vê a lista das que vê.
- Agregações de grupo em Painéis e Visualizações somam apenas os registros que o visualizador vê (B20). "Valor em aberto do grupo Alfa" difere entre visualizadores com escopos distintos — comportamento intencional, não erro.
- A linha do tempo (8.4) obedece à permissão de cada item: Conversas exigem `ver` na Conversa; Negócios, `ver` no Negócio.

### 17.3 IA sujeita às mesmas regras

Agente é Sujeito (A6.3). Criar Empresa a partir do domínio de um Contato exige `criar` sobre Empresas e `ver` sobre o Contato; em nome de Membro, interseção (A9.3); autônomo, só as próprias. Aceitar Sugestão de Vínculo exige `editar` em ambos; mesclar exige `administrar` em ambas. Mesclar e enviar à lixeira são Ferramentas de classe `escrita irreversível`: em `supervisionado`, geram Solicitação de Aprovação (B22; lista consolidada em B64; decisão por Ferramenta em B77), com Tempo limite padrão de 72 horas (B80). Permissões avaliadas a cada Ferramenta (B23). Automação age com as próprias permissões, tendo as do seu Proprietário como teto (B88; documento 01, 17.1). Integração que importa Empresas age como Ator Integração, com o Membro configurador como delegante.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Empresa criada | 12.1 | identificador, nomes, Proprietário, Criador, ator delegante, Proveniência | Automações; Painéis; Sugestões de Vínculo (domínio) |
| Empresa atualizada | Alteração de nome, Descrição, Origem, Endereço, Valor de Campo, Anexo | atributo, antes, depois, ator | Automações; auditoria |
| Identificador adicionado / removido / verificado / principal alterado | 7.1 | tipo, valor, ator | Sugestões de Vínculo; Integrações; auditoria |
| Sugestão de Vínculo emitida / aceita / rejeitada | 8.5 | Contato, Empresa, evidência, ator | Automações (aceite configurado); notificação ao Proprietário |
| Contato vinculado / desvinculado; papel alterado; principal (de qualquer lado) alterado | 8.2 | Contato, Empresa, papel, indicadores, ator | Documento 10; Painéis; linha do tempo |
| Vínculo Empresa-Empresa criado / removido | 8.3 | tipo, direção, outra Empresa, ator | Painéis; Agentes (contexto de mercado) |
| Matriz definida / alterada / removida | 10 | matriz antes/depois, raiz antes/depois, ator | Painéis (agregação de grupo); auditoria |
| Proprietário transferido | RN-EMP-02 | antes, depois, ator, causa (ato, sucessão B28) | Notificação; Painéis por Proprietário |
| Tag aplicada / removida | | Tag, ator | Automações; Painéis |
| Comentário adicionado / editado / excluído / resolvido | 7.4 | Comentário, autor, menções | Notificação a mencionados e ao Proprietário |
| Vínculo com Tarefa criado / removido | | Tarefa, ator | Documento 06 |
| Negócio passou a referenciar / deixou de referenciar a Empresa | Criação, edição ou mesclagem | Negócio, Empresa antes/depois | Painéis; linha do tempo (evento do Negócio, refletido aqui) |
| Empresa arquivada / desarquivada | 12.2 | ator | Painéis; Automações |
| Empresa enviada à lixeira / restaurada / eliminada / eliminação adiada | 12.2 | ator, causa do adiamento (Negócios pendentes) | Vínculos (ocultar/remover); Painéis; notificação ao Proprietário no adiamento |
| Empresas mescladas | 12.3 | sobrevivente, absorvida, resumo das migrações, ator | Todos os domínios que referenciam Empresa; Painéis; auditoria |
| Envio à lixeira / definição de matriz rejeitados | RN-EMP-09, RN-EMP-11 | motivo, registros bloqueantes | Produto (orientar o ator); auditoria |

Todos geram Registro de Atividade com a Empresa (ou o componente, com a Empresa como raiz) como objeto e ator delegante quando aplicável (A6.2). Eventos de Vínculo são gravados nas duas pontas.

## 19. Dependências

**A Empresa depende de** (precisam existir antes): **Espaço de Trabalho** (pertencimento, catálogos, Política de lixeira); **Membro** `ativo` para Proprietário; **Ator** com `criar`. Opcionalmente: Origens, Tags, Definições de Campo (para Valores), lista de provedores públicos da plataforma (RN-EMP-05), outra Empresa `ativo` (para matriz ou Vínculo).

**Dependem da Empresa**: Identificadores, Endereços, Valores de Campo, Comentários, Anexos (referências), Sugestões de Vínculo. Dependem parcialmente: Vínculos (removidos na eliminação); Negócios (bloqueiam a eliminação, RN-EMP-10); filiais (bloqueiam a lixeira, RN-EMP-09); Empresas `mesclado` (eliminadas com a sobrevivente); Execuções e Sessões de Chat ancoradas (perdem o objeto); Registros de Atividade (permanecem).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) fornece pertencimento, Proprietário, sucessão (B28), catálogos (B34) e, por DO-EMP-10, passa a instanciar três Definições de Campo na criação; Contato (10) fixa o lado do Contato do Vínculo Contato-Empresa e recebe os dois indicadores de principal (DO-EMP-05) e a Sugestão de Vínculo (DO-EMP-04); Negócio (12) recebe RN-EMP-08 a RN-EMP-10 (referência a Empresa `ativo`; bloqueio de lixeira e adiamento de eliminação); Caixa de Entrada (14) recebe RN-EMP-06 e RN-EMP-15 (nenhuma resolução nem Vínculo por Empresa); Tarefa (06) já prevê o Vínculo Tarefa-Empresa; Agentes e Automações recebem 17.3 e os Gatilhos da seção 18; Painéis recebem as agregações derivadas por hierarquia (seção 16, 17.2).

## 20. Casos limítrofes e ambiguidades

### 20.1 A própria organização registrada como Empresa

Permitido e sem efeito ontológico. A organização "Clínica Vida" pode criar a Empresa "Clínica Vida" (para vincular Contatos que são seus próprios funcionários-clientes, por exemplo). O registro não referencia o Espaço de Trabalho, não recebe Membros, não herda Localidade nem Limites, e pode ser arquivado ou eliminado como qualquer outro. Membro ≠ Contato (A1.4) e Espaço de Trabalho ≠ Empresa são independentes: o funcionário que é Contato vinculado a essa Empresa continua sem ligação com o seu Membro (documento 01, 20.4).

### 20.2 Empresa sem Contatos e sem Identificadores

Válida. Uma Empresa criada a partir de uma lista de prospecção ("Alfa Ltda, São Paulo") pode existir só com nome e Endereço. Sem Identificadores, a plataforma não detecta duplicidade por valor — apenas sugere por similaridade de nome, se o produto oferecer. Sem Contatos, não há Conversas derivadas; Negócios podem existir (Negócio com Empresa e sem Contatos é válido por B9). O produto deve exibir a lacuna, não a ontologia impedi-la.

### 20.3 Empresa com 20 Negócios em três Funis

Caso normal de cliente recorrente. A Empresa não sabe de Funis: cada Negócio tem o seu (B9). "Negócios da Empresa" é a referência inversa; agrupar por Funil, situação ou período é Visualização ou Painel. Nenhum limite ontológico. Arquivar a Empresa com Negócios `aberto` é permitido (arquivamento é livre, 12.2); enviar à lixeira não (RN-EMP-09).

### 20.4 Empresa com 500 filiais

Válida: a cardinalidade é 0..N sem teto (DO-EMP-06). A árvore pode ser larga (500 filiais diretas) ou profunda (holding → 5 controladas → 100 filiais cada). Consequência de produto: agregações de grupo são derivadas por travessia da árvore e devem ser computadas sob demanda ou materializadas por Painéis, nunca gravadas na Empresa. Uma rede de 500 lojas com CNPJ único e 500 endereços é **uma** Empresa com 500 Endereços, não 500 filiais (7.2): filial exige identidade organizacional própria (Identificador próprio, Contatos próprios, Negócios próprios). O critério é "negocia-se com ela como organização distinta?".

### 20.5 Ciclo matriz/filial

A é matriz de B; tentar definir A com matriz B é rejeitado (RN-EMP-11; INV-EMP-05). O mesmo para ciclos longos (A → B → C → A). A verificação é feita no ato de definir a matriz, percorrendo os ancestrais do destino; como cada Empresa tem no máximo uma matriz, o percurso é linear. Mesclagem (12.3, item 9) também verifica antes de gravar. Não existe estado intermediário com ciclo.

### 20.6 Empresa mesclada que era matriz de outras

A sobrevivente ocupa o lugar da absorvida (12.3, item 9): as filiais da absorvida passam a apontar para a sobrevivente. Se a sobrevivente era filial da absorvida (mesclar a controlada na holding, com a controlada sobrevivendo), a sobrevivente assume a matriz da absorvida e as irmãs passam a suas filiais — sem ciclo. Se a absorvida era filial da sobrevivente, as filiais da absorvida sobem um nível. Registros de Atividade "matriz alterada" são gravados em cada filial religada, com a mesclagem como causa.

### 20.7 Empresa excluída com Negócios `aberto`

Enviar à lixeira é rejeitado (RN-EMP-09) com a lista de Negócios bloqueantes. O ator decide por Negócio: fechar (`ganho`/`perdido`), mover para outra Empresa, remover a referência (Negócio sem Empresa é válido, B9) ou enviar o Negócio à lixeira. Só então a Empresa vai à lixeira. Se o ator quer apenas "sumir com ela", arquiva: livre e reversível. A alternativa "lixeira em cascata" é rejeitada porque Negócio não pertence à Empresa.

### 20.8 Contato principal da Empresa desvinculado

Remover o Vínculo remove o indicador; a Empresa fica sem Contato principal. Válido (0..1). A ontologia não promove automaticamente outro Contato: escolher interlocutor é decisão humana (ou de Agente com permissão). O produto pode sugerir. O Contato desvinculado, se tinha a Empresa como "Empresa principal do Contato", também perde esse indicador — ambos vivem no Vínculo removido (DO-EMP-05).

### 20.9 Duas Empresas com o mesmo CNPJ

Impossível por INV-EMP-02. A tentativa (criação, edição, importação, restauração da lixeira) é rejeitada e aponta a detentora; o caminho é mesclar. Matriz e filial têm CNPJs distintos (a raiz difere no sufixo no Brasil): são Identificadores distintos, sem conflito. Se uma Integração importar a mesma organização duas vezes com CNPJ formatado de modos diferentes, a normalização (7.1) faz colidir, como deve.

### 20.10 Empresa que é também Contato (profissional autônomo)

Uma pessoa física que atua como fornecedora ("Dra. Ana, consultora, CNPJ MEI") é **Contato** (pessoa, conversa) e, se a organização precisar registrar a pessoa jurídica (documento fiscal, Endereço de cobrança, Negócios em nome da PJ), **uma Empresa distinta vinculada** ao Contato por Vínculo Contato-Empresa com papel "titular" e ambos os indicadores de principal. Não há unificação: Contato conversa e consente; Empresa tem documento fiscal e Negócios. Unificar criaria uma entidade que conversa e tem CNPJ, quebrando B12 e B13. Recomendação ao produto: criar os dois em um gesto, com Vínculo, quando o Contato tiver documento fiscal informado (DO-EMP-13).

### 20.11 Proprietário removido do Espaço de Trabalho

Sucessão (B28): todas as Empresas de que era Proprietário passam ao Sucessor no mesmo ato, um Registro de Atividade por Empresa. Comentários e Registros do removido continuam assinados por ele. Nada muda em Contatos, Negócios ou hierarquia. Se o removido era Proprietário de 300 Empresas, são 300 transferências no mesmo ato.

### 20.12 Agente criando Empresa a partir do domínio do e-mail de um Contato

Permitido com `criar` sobre Empresas e `ver` sobre o Contato (17.3). O Agente cria a Empresa com Identificador `domínio` (rejeitado se provedor público, RN-EMP-05; rejeitado se o domínio já existe em outra Empresa, RN-EMP-04 — nesse caso o Agente deve propor Vínculo, não criar). Proprietário: o ator delegante, se em nome de Membro; senão, o Membro configurado, senão o Proprietário do Agente (RN-EMP-02). O Vínculo Contato-Empresa **não** é criado automaticamente pela plataforma: o Agente, que tem `editar` em ambos, pode criá-lo como ação própria — é ato do Agente, com Registro, não inferência da plataforma (RN-EMP-07). Em `assistido`, tudo aguarda aprovação; em `supervisionado`, criar e vincular são reversíveis e executam.

### 20.13 Empresa arquivada com Contatos ativos conversando

Conversas são com Contatos (B12) e nada devem à Empresa. Os Vínculos permanecem; a linha do tempo da Empresa arquivada continua a acumular as Conversas desses Contatos; Filas, Atribuídos e Automações de Conversa não consultam o estado da Empresa. O que o arquivamento impede é apenas relação **nova** (RN-EMP-08): um Negócio novo para essa Empresa exige desarquivá-la. Um Agente que perceba Conversas comerciais com Contatos de Empresa `arquivado` pode sugerir desarquivar; não o faz sem `editar`.

### 20.14 Painel agregando valor de Negócios de um grupo econômico

O Widget usa Fonte de Dados "Negócios cujas Empresas pertencem ao grupo de raiz X": o conjunto é derivado pela travessia da árvore de matriz/filial no momento da consulta, filtrado pelas permissões do visualizador (B20). Reestruturar o grupo (mover uma filial) altera o resultado na próxima consulta; nada é gravado. Vínculos Empresa-Empresa (`parceira`) **não** entram na agregação: só hierarquia agrega (seção 4, comparação matriz × parceira).

### 20.15 Joint venture com dois controladores

A hierarquia admite uma matriz (0..1). A organização escolhe uma como matriz (a controladora majoritária ou a operacional) e registra a outra por Vínculo `parceira` ou `outro` com rótulo "co-controladora". Agregações de grupo seguem a matriz escolhida. Matriz múltipla é rejeitada porque tornaria "grupo" ambíguo e a agregação de Painéis dupla.

### 20.16 Dois Contatos afirmam ser "o principal" da Empresa

Só um Vínculo pode ter o indicador (INV-EMP-04). Marcar o segundo desmarca o primeiro no mesmo ato, com Registro de Atividade. Se a organização precisa de "principal por assunto" (comercial, financeiro, técnico), isso é o **papel** do Vínculo, não o indicador.

### 20.17 Restauração da lixeira com Identificador que colidiu entretanto

Cenário: enquanto a Empresa estava `na lixeira`, alguém tenta criar outra com o mesmo CNPJ. A criação é **rejeitada**: INV-EMP-02 considera os estados `ativo`, `arquivado` e `na lixeira`, portanto o registro `na lixeira` **reserva** o Identificador (diferentemente do nome de contêiner em B39, que não é reservado). Consequência: a colisão na restauração só poderia ocorrer se o Identificador tivesse sido removido da Empresa na lixeira — o que não é possível, pois um registro `na lixeira` não é editável — ou após a eliminação permanente, quando já não há o que restaurar. A cláusula de rejeição na restauração (12.2) é, portanto, defesa contra inconsistência, não caminho esperado. Justificativa da reserva: liberar o CNPJ durante a lixeira produziria duas Empresas legítimas com o mesmo documento após a restauração, sem mesclagem possível sem perda. O custo (não poder recriar até restaurar ou eliminar) é aceitável: o ator restaura em vez de recriar.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Negócios "da Empresa" | Negócio (raiz própria) | Negócio referencia a Empresa (B9); não é contido. Fechar, mover, eliminar são atos sobre o Negócio. |
| Contatos "da Empresa" | Contato | Vínculo N:N (B8). Desvincular não elimina o Contato. |
| Conversas "da Empresa" | Caixa de Entrada / Contato principal | B12. A Empresa só as vê por derivação (8.4). |
| Telefone e e-mail que resolvem Mensagens | Identificador de Contato | B13; RN-EMP-06. |
| Cargo/função de uma pessoa na Empresa | Vínculo Contato-Empresa (papel) | É atributo da relação, não do Contato nem da Empresa. |
| "Gerente de conta", "vendedor da conta" | Proprietário (A7) ou Valor de Campo tipo pessoa | Não existe Responsável nem Atribuído em Empresa. |
| Segmento, Porte, Setor | Definição de Campo Personalizado (pré-definida) + Valor de Campo | Sem semântica de sistema (15). |
| Valor em aberto, receita, quantidade de Contatos e filiais | Derivados (Visualização, Painel) | Nunca gravados na Empresa. |
| Filiais | Cada filial (Empresa própria) | Hierarquia sem contenção; "filiais" é derivado do atributo Empresa matriz das filhas. |
| Tarefas "para a Empresa" | Tarefa (Lista) | Vínculo (DO-TAR-08). |
| Proposta, contrato, orçamento | Anexo (Arquivo) hoje; D3 no futuro | Artefatos comerciais não são atributos. |
| Consentimento | Contato | Organização não consente; pessoa consente (Glossário). |
| Definições de Campo, Tags, Origens | Espaço de Trabalho | Catálogos (B34); a Empresa os usa. |
| Sugestão de Vínculo | Objeto de valor transitório do par (Contato, Empresa) | Nem componente nem entidade. |
| Registros de Atividade | Espaço de Trabalho | A Empresa é objeto deles (INV-ET-12). |
| Permissões de Membros sobre a Empresa | O Recurso (concessão) e o Papel | A Empresa não "tem Membros". |
| Sessões de Chat ancoradas | Membro | B21. |
| Execuções que a leram ou alteraram | Agente / Automação | B18. |

## 22. Exemplos conceituais

**Exemplo 1 — Cliente recorrente.** A Empresa "Alfa Logística" (Razão social "Alfa Transportes Ltda", CNPJ, domínio `alfalog.com.br`, Endereço sede e dois de entrega) tem Proprietário Pedro. Vínculos: Marina (papel "diretora de operações", Contato principal da Empresa), Luís ("comprador"), Carla ("financeiro"; Empresa principal do Contato é a Beta, onde é sócia — Vínculo com a Alfa não principal). Vinte Negócios ao longo de quatro anos em "Vendas", "Renovações" e "Serviços"; três `aberto`. Quando Marina escreve pelo WhatsApp, a Conversa é dela; aparece na linha do tempo da Alfa porque Marina está vinculada. Pedro sai da empresa: Maria o remove e indica Ana como Sucessora; a Alfa e as outras 40 Empresas de Pedro passam a Ana no mesmo ato.

**Exemplo 2 — Grupo econômico.** "Holding Gama" é raiz; "Gama Varejo" e "Gama Indústria" têm Gama como matriz; "Gama Varejo Sul" tem "Gama Varejo" como matriz. Cada uma tem CNPJ, Contatos e Proprietário próprios (Varejo com João, Indústria com Ana). O Painel "Grupo Gama" soma Negócios `aberto` das quatro; João, cujo Papel restringe Negócios a `próprios`, vê só os seus na mesma soma. Tentar definir "Holding Gama" com matriz "Gama Varejo Sul" é rejeitado (ciclo). "Gama Varejo" é ainda `fornecedora de` "Alfa Logística" (Vínculo) — fato de mercado que não entra em nenhuma soma.

**Exemplo 3 — Duplicidade por importação.** Uma Integração importa "ALFA TRANSPORTES LTDA" com CNPJ formatado; a normalização colide com a Alfa existente e a importação é rejeitada apontando a detentora. A Integração, configurada para isso, gera Sugestão de mesclagem; Ana mescla a importada (absorvida) na Alfa (sobrevivente): dois Endereços novos e um telefone migram; nenhum Contato duplicado; a absorvida passa a `mesclado` e os Registros da Integração continuam a resolver para a Alfa.

**Exemplo 4 — Agente e domínio.** O Agente "Qualificador", em nome de Ana, lê um Contato novo com e-mail `carlos@delta.com`. Não há Empresa com domínio `delta.com`: cria a Empresa "Delta" (Proprietária Ana), com o domínio como Identificador, e vincula Carlos com papel "desconhecido". Outro Contato, `julia@gmail.com`, não gera nada (provedor público). Um terceiro, `rita@alfalog.com.br`, gera Sugestão de Vínculo com a Alfa; o Agente, que tem `editar` em ambos, aceita e registra o Vínculo como ação própria em nome de Ana.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Catálogos usados: Tag, Origem, Definição de Campo (entidade-alvo Empresa; 3 pré-definidas: Segmento, Porte, Setor)
│
└── EMPRESA (0..N)  [pertence ao ET; Proprietário 1 (Membro); Criador 1; estado: ativo | arquivado | na lixeira | mesclado]
    │
    ├── Atributos: Nome fantasia / Razão social (≥1), Nome de exibição (derivado), Descrição, Origem (0..1),
    │              Empresa matriz (0..1) ─── Empresa raiz do grupo (derivada), Mesclada em (só `mesclado`)
    │
    ├── Agregado (contenção)
    │   ├── Identificador de Empresa (0..N)  [tipo: domínio | documento fiscal | telefone; único por (tipo, valor) no ET; principal ≤1 por tipo]
    │   ├── Endereço (0..N, objeto de valor)  [tipo: sede | cobrança | entrega | outro; principal ≤1]
    │   ├── Valor de Campo (0..N; 1 por Definição aplicável)
    │   ├── Comentário (0..N; respostas em 1 nível)
    │   └── Anexo → Arquivo do ET (0..N)
    │
    ├── Hierarquia (estrutural, sem contenção, acíclica, sem limite de profundidade)
    │   └── filiais (0..N, derivadas de "Empresa matriz" das filhas)   ── nada herdado; agregação derivada
    │
    ├── Associações (Vínculos; visíveis a quem vê ambos os lados)
    │   ├── Contato (N:N) via Vínculo Contato-Empresa  [papel; Contato principal da Empresa ≤1; Empresa principal do Contato ≤1 por Contato]
    │   ├── Empresa (N:N) via Vínculo Empresa-Empresa  [parceira | concorrente | fornecedora de / cliente de | outro]
    │   ├── Tarefa (0..N) via Vínculo Tarefa-Empresa
    │   └── Tag (N:N)
    │
    ├── Referências inversas (a Empresa não contém)
    │   ├── Negócio (0..N) ── Negócio → Empresa 0..1  [bloqueia lixeira se `aberto`; adia eliminação se existir]
    │   ├── Empresa `mesclado` (0..N absorvidas) → esta
    │   ├── Execução, Sessão de Chat (âncora), Registro de Atividade, Widget de Painel
    │   └── Sugestão de Vínculo (objeto de valor transitório; Contato × Empresa por domínio)
    │
    └── Derivados (nunca gravados): Contato principal, linha do tempo (Registros + Negócios + Conversas dos Contatos
        vinculados + Tarefas + Comentários), Última interação, contagens e somas, grupo econômico

Não existe: Conversa com Empresa; Vínculo Conversa-Empresa; Identificador de Empresa que resolva Mensagens;
herança por matriz/filial; Responsável ou Atribuído em Empresa; Empresa do próprio Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-EMP-01.** Empresa é organização externa identificável, pertencente diretamente ao Espaço de Trabalho, com identidade opaca e imutável; documento fiscal, domínio e nome são atributos ou Identificadores, nunca identidade. Aplica A1.1, A1.4 e B14. CONSOLIDADA.
- **DO-EMP-02.** Nome fantasia e Razão social são atributos nativos distintos, ao menos um obrigatório; Nome de exibição é derivado (fantasia, senão razão social). Nome não é único. RECOMENDADA.
- **DO-EMP-03.** Identificador de Empresa é entidade interna análoga a B13, com tipos `domínio`, `documento fiscal` (com país) e `telefone`, valor normalizado, verificado e principal (≤1 por tipo); único por (tipo, valor) no Espaço de Trabalho entre Empresas `ativo`, `arquivado` e `na lixeira` (a lixeira reserva o Identificador). Identidade em Canal e e-mail **não** são Identificadores de Empresa; nenhum Identificador de Empresa resolve Mensagens; a unicidade não é cruzada com Identificadores de Contato. Domínios de provedores públicos são rejeitados. Justificativa: um único caminho de resolução de Mensagens (B12, B13). RECOMENDADA.
- **DO-EMP-04.** Coincidência de domínio entre e-mail de Contato e Identificador de Empresa gera **Sugestão de Vínculo** (objeto de valor transitório), nunca Vínculo automático pela plataforma; aceite por Membro, Agente com permissão ou Automação configurada pela organização, sempre com Registro de Atividade. RECOMENDADA.
- **DO-EMP-05.** "Contato principal da Empresa" e "Empresa principal do Contato" são **dois indicadores independentes no mesmo Vínculo Contato-Empresa** (B8), com no máximo um de cada por Empresa e por Contato, respectivamente; desvincular remove ambos; a Empresa pode ficar sem Contato principal. Justificativa: indicador fora do Vínculo admite estado inconsistente. RECOMENDADA; o documento 10 adota o lado do Contato.
- **DO-EMP-06.** Hierarquia matriz/filial é relação estrutural opcional expressa pelo atributo Empresa matriz (0..1), formando floresta acíclica **sem limite fixo de profundidade** (Limite imposto da plataforma é admissível, B34); Empresa raiz do grupo e filiais são derivadas; nada é herdado ou propagado pela hierarquia (Proprietário, Contatos, Negócios, Tags, Valores, permissões, estado); agregações de grupo são derivadas e filtradas por visualizador (B20). Rejeita limite de um nível (perde "grupo") e herança de permissão (tornaria o acesso dependente de fato externo editável). RECOMENDADA.
- **DO-EMP-07.** Vínculo Empresa-Empresa é associação N:N tipada com catálogo fixo da plataforma nesta versão: `parceira` e `concorrente` (simétricos), `fornecedora de`/`cliente de` (uma aresta, duas leituras) e `outro` com rótulo; no máximo um por (par, tipo, direção); sem laço; ciclos permitidos; nunca agrega, nunca herda. Catálogo configurável é questão em aberto. RECOMENDADA.
- **DO-EMP-08.** Não existe Conversa com Empresa nem Vínculo Conversa-Empresa; "Conversas da Empresa" é visão derivada das Conversas cujo Contato principal está vinculado à Empresa. Justificativa: B12 exige Contato principal; um segundo caminho (direto) divergiria do primeiro com o tempo. Mensagem de número ou caixa genérica da organização externa cria Contato ("Recepção da Alfa") vinculado à Empresa. RECOMENDADA; o documento de Caixa de Entrada a adota.
- **DO-EMP-09.** Origem (catálogo do Espaço de Trabalho) aplica-se também a Empresa (0..1). Amplia o verbete do Glossário, hoje restrito a Contato e Negócio. RECOMENDADA.
- **DO-EMP-10.** Segmento, Porte e Setor **não** são atributos nativos: são três Definições de Campo Personalizado com entidade-alvo Empresa, do tipo seleção única, instanciadas pela plataforma na criação do Espaço de Trabalho com Proveniência "pré-definida", editáveis e arquiváveis pela organização, sem nenhuma regra de sistema que dependa delas. Justificativa: semântica variável; nada na ontologia as consome (diferente de A4.3). Impacta o ato de criação do documento 01 (12.1). RECOMENDADA.
- **DO-EMP-11.** Ciclo de vida: arquivamento livre e sem cascata; envio à lixeira **rejeitado** enquanto houver Negócio `aberto` (não `na lixeira`) que a referencie ou filial `ativo`/`arquivado`; eliminação permanente **adiada** enquanto houver Negócio não eliminado que a referencie (evento "eliminação adiada"); nunca "remover a referência e eliminar". Só Empresa `ativo` recebe relações novas (Negócio, Vínculo, matriz, filial). Registro `na lixeira` reserva Identificadores. Justificativa: a referência de Negócio à Empresa é fato comercial; a lixeira é antecâmara da eliminação e não pode deixar Negócios `aberto` apontando para o vazio. RECOMENDADA.
- **DO-EMP-12.** Permissões sobre Empresa: origens papel, concessão direta e compartilhamento; escopos `registro` e `próprios` (Proprietário ou Criador); `subárvore` não se aplica (hierarquia matriz/filial não é contêiner); Vínculos e hierarquia visíveis só a quem vê ambos os lados (nome da matriz como exceção de navegação). Aplica A9.1, B29. RECOMENDADA.
- **DO-EMP-13.** Mesclagem (B14): entre Empresas `ativo` ou `arquivado`, por Ator com `administrar` em ambas (regra única com Contato); a sobrevivente resulta `ativo` se uma das duas era `ativo`; sobrevivente prevalece, vazios preenchidos pela absorvida; Identificadores, Endereços, Tags, Vínculos, Negócios, filiais e Comentários migram; laços e duplicatas colapsam; a sobrevivente ocupa o lugar da absorvida na árvore, com verificação de aciclicidade antes de gravar; a absorvida passa a `mesclado` (terminal, sem restauração), permanece enquanto a sobrevivente existir e é eliminada com ela; cadeias de mesclagem resolvem para a sobrevivente final. Profissional autônomo é Contato e, se necessário, Empresa distinta vinculada — nunca unificação. RECOMENDADA.
- **DO-EMP-14.** Empresa pode ser âncora de Sessão de Chat (B21 lista Tarefa, Negócio, Contato, Conversa, Documento). Amplia B21 sem alterá-la. RECOMENDADA; o documento de Chat a adota.
- **DO-EMP-15.** Comentário em Empresa segue o modelo de DO-TAR-07, com "quem tem `administrar` sobre a Empresa" no lugar de "Administrador do contêiner". RECOMENDADA.
- **DO-EMP-16.** Proprietário inicial na criação por Ator não humano: ator delegante **Membro** (a Automação delegante de DO-AUT-15 não é Membro e não conta); senão, Membro configurado na Automação/Ferramenta; senão, Proprietário do Agente ou da Automação, ou Membro configurador da Integração. Nunca vazio; nunca Membro não `ativo`. Aplica A7, B7, RN-ET-08. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-EMP-09, DO-EMP-10 e DO-EMP-14 ampliam, respectivamente, o verbete Origem do Glossário, o ato de criação do documento 01 e a lista de âncoras de B21; nenhuma delas altera decisão vigente.

## 25. Questões em aberto

1. **Vigência do Vínculo Contato-Empresa.** **Resolvida** pelo documento 10 (DO-CON-02; RN-CON-06): o Vínculo tem início e fim; a saída da pessoa **encerra** o Vínculo (fim preenchido), nunca o apaga; reingresso cria Vínculo novo; "passou pela Alfa" é consultável. A linha do tempo (8.4) considera Vínculos vigentes no momento da consulta; Painéis históricos leem os encerrados.
2. **Catálogo configurável de tipos de Vínculo Empresa-Empresa** (DO-EMP-07). Organizações pedirão tipos próprios com direcionalidade e rótulo inverso ("distribuidora de", "representante de"). Seria uma nova entidade contida no Espaço de Trabalho (B34); `outro` com rótulo cobre o caso sem semântica de direção.
3. **Desfazer mesclagem.** `mesclado` é terminal (DO-EMP-13). Mesclagens erradas exigirão recriar a Empresa e redistribuir Vínculos e Negócios manualmente. Um "desfazer" exigiria guardar a partição original de cada migração, o que a ontologia não prevê. Consequência de produto relevante; sem base para decidir.
4. **Eliminação de dados de Empresa por solicitação** (C9). LGPD aplica-se a pessoas; Empresa não tem dado pessoal próprio, mas Contatos vinculados têm. Eliminar um Contato por solicitação afeta a linha do tempo da Empresa (Conversas eliminadas). A decidir com C9.
5. **Limite imposto de filiais e de profundidade** (B34, C8). DO-EMP-06 não fixa teto; se a plataforma impuser, é Limite imposto, não regra da entidade. Registrar se e qual.
6. **Empresa como escopo de Automação** (C25). B41 lista Funil, Caixa de Entrada e Fila como escopos do CRM; Empresa (ou "grupo econômico") como escopo de Gatilho ("quando qualquer Negócio do grupo Gama for ganho") não está previsto; hoje é Condição sobre o Negócio com escopo Espaço de Trabalho (documento 19). Registrada em C25.
7. **Vínculo de contêiner com Empresa** (C16). "Pasta do cliente Alfa ↔ Empresa Alfa" está registrado em C16; este documento não o resolve e não o impede.
8. **Sugestão de duplicidade por similaridade de nome.** Sem Identificadores, a única detecção possível é por nome; a ontologia só exige que seja sugestão (nunca mesclagem automática). Se o produto adotar, o critério de similaridade é dele.
