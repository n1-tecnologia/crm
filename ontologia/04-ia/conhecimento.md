# CONHECIMENTO

> Domínio: IA | Documento 20 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

**Conhecimento** é a camada corporativa de conteúdo **curado**, com **proveniência** e **permissões**, mantido pela organização para ser **consultado** — por Membros, diretamente, e por Agentes, por meio de Ferramenta. Pertence ao domínio IA (A2.3) porque a sua razão de existir é alimentar raciocínio: um conteúdo entra no Conhecimento para que alguém (humano ou Agente) o encontre e o use como base de uma resposta, de uma decisão ou de uma ação.

Conhecimento **não é uma entidade**: é uma camada, como CRM e Painéis são domínios (documento 01, 7.7). As entidades são:

- **Coleção** — agrupamento nomeado de Documentos de Conhecimento, com Proprietário e permissões próprias; a unidade de governança e de concessão de acesso.
- **Fonte** — origem de onde Documentos entram em uma Coleção: envio manual, URL ou Integração; define proveniência e política de atualização.
- **Documento de Conhecimento** — a unidade de conhecimento com identidade: um título, um tipo de conteúdo, uma sequência de Versões, Metadados, Proveniência obrigatória.
- **Versão de Documento** — cada estado do conteúdo de um Documento, imutável depois de criado; uma delas é a corrente.
- **Fragmento** — porção derivada de uma Versão, usada para recuperação; sem significado de negócio próprio, regenerável.

Os objetos de valor são **Conteúdo** (o material de uma Versão), **Representação derivada** (texto derivado de conteúdo não textual), **Metadado**, **Proveniência**, **Política de atualização**, **Política de retenção de versões** e **Referência de Conhecimento** (a citação que uma saída de Agente faz a Documento, Versão e Fragmentos). **Atualização** e **Indexação conceitual** são operações com eventos, não entidades.

Três propriedades distinguem o Conhecimento de todo o resto que a plataforma armazena:

1. **É curado.** Um conteúdo só é Conhecimento porque um Membro (ou um Agente autorizado por um Membro) decidiu que ele deve ser consultável, colocando-o em uma Coleção. Nada entra por inferência, por acúmulo de uso ou por "aprendizado" de Agente (seção 14, INV-CNH-12).
2. **Tem proveniência obrigatória.** Todo Documento sabe de onde veio, quem o adicionou, quando e a partir de que versão da origem (INV-CNH-05). Um conteúdo sem origem rastreável não é Conhecimento; é rascunho.
3. **É consultável sob permissão.** A Coleção é o Recurso de permissão; Documentos e Fragmentos herdam e nunca têm permissão própria. Um Fragmento de Documento que o Sujeito não pode ver nunca entra no Contexto de uma Execução (INV-CNH-09).

O que **não** é Conhecimento, por decisão vigente (B19): Tarefas, Contatos, Empresas, Negócios, Conversas, Mensagens e qualquer outro registro operacional da plataforma. Eles são a realidade operacional, mudam a cada instante e têm permissões próprias no seu domínio; Agentes os acessam por Ferramentas (ler Negócio, listar Tarefas), sujeitos às permissões daquele domínio. Duplicá-los no corpus criaria uma segunda cópia da realidade, com permissões divergentes. Uma Fonte interna que sincronize registros para o Conhecimento é entidade futura (D5), fora desta versão.

"Indexação conceitual", neste documento, significa apenas **o fato de um conteúdo ter se tornado consultável**. Como isso ocorre — representações, índices, mecanismos de busca — é infraestrutura e não é descrito aqui.

## 2. Propósito

O Conhecimento existe para cinco fins:

1. **Dar aos Agentes uma base de resposta governada.** Sem Conhecimento, um Agente responde só com o que o Modelo sabe e com o que as Ferramentas retornam do operacional. Com Conhecimento, responde a partir do que a organização decidiu que é verdade — o manual, a tabela de preços vigente, a política de atendimento — e cita de onde tirou.
2. **Separar o que a organização afirma do que ela registra.** Um Negócio registra um fato comercial; um Documento "Política de descontos" afirma uma regra. O primeiro é operacional e muda; o segundo é curado e versionado. Misturá-los faz o Agente tratar um caso isolado como regra.
3. **Tornar a consulta auditável.** Cada Execução que consultou Conhecimento registra Documento, Versão e Fragmentos usados (Referência de Conhecimento). "Esta resposta baseou-se em quê?" tem resposta exata, mesmo depois de o Documento mudar.
4. **Governar o acesso em um só lugar.** A Coleção é a unidade de permissão e de concessão a Agentes. Quem administra a Coleção decide quem consulta; ninguém precisa reconfigurar cada Agente quando um Documento é adicionado.
5. **Manter a proveniência e a atualidade.** Fontes URL e Integração trazem conteúdo externo com política de atualização; Versões preservam o histórico; um Documento cuja origem sumiu ou cuja Fonte parou de sincronizar é identificado como tal, não silenciosamente desatualizado.

## 3. Natureza da entidade

| Entidade / conceito | Natureza | Identidade | Agregado |
| --- | --- | --- | --- |
| Coleção | Entidade persistente, raiz de agregado. Recurso de permissão. Tem Proprietário (A7). | Própria, opaca, imutável. | Raiz: contém Fontes e Documentos; garante que toda Fonte e todo Documento têm exatamente uma Coleção e que existe exatamente uma Fonte `envio manual`. |
| Fonte | Entidade contida pela Coleção, com identidade (é referenciada por Documentos e por Atualizações). Não é Ator; a Integração subjacente, quando houver, é o Ator (A6.1). | Própria, opaca. | Membro do agregado da Coleção. |
| Documento de Conhecimento | Entidade persistente contida pela Coleção, raiz do próprio agregado (Versões, Fragmentos, Comentários, Metadados, Proveniência). Objeto de Vínculo, Comentário, menção e âncora de Sessão de Chat. | Própria, opaca, imutável. | Raiz: Versões, Fragmentos, Comentários, Metadado, Proveniência. |
| Versão de Documento | Entidade interna do Documento; imutável depois de criada; referenciável de fora (Referência de Conhecimento). | Derivada: (Documento, número sequencial). | Membro do agregado do Documento. Contém Conteúdo e Fragmentos. |
| Fragmento | Entidade interna **derivada** da Versão; regenerável; sem significado de negócio; referenciável por Referência de Conhecimento. | Local à Versão (identificador estável dentro dela). | Membro do agregado do Documento, via Versão. |
| Conteúdo, Representação derivada, Metadado, Proveniência, Políticas, Referência de Conhecimento | Objetos de valor. | Nenhuma. | Vivem na entidade que os carrega. |
| Atualização, Indexação conceitual | Operações do Sistema (ou de Integração) com eventos e Registros de Atividade. | Nenhuma; o Registro de Atividade tem. | — |
| Conhecimento | Camada, não entidade. Sem identidade, atributos ou estado. | — | — |

Nenhuma entidade desta camada é Ator. Quem age sobre o Conhecimento é um Membro, um Agente, uma Integração (por Fonte), o Sistema (Indexação conceitual, retenção) ou uma Automação (por Agente, B17).

## 4. Fronteira conceitual

### O que é

- Conteúdo que a organização curou para ser consultado: manuais, políticas, tabelas, contratos-padrão, gravações de treinamento, apresentações, páginas do site institucional, artigos de uma base externa conectada.
- Conteúdo de qualquer tipo de mídia: texto, imagem, áudio, vídeo, PDF, planilha ou arquivo estruturado, página web. O tipo não muda o que a coisa é; muda como ela é representada para consulta.
- Conteúdo com história: cada mudança é uma Versão; consultas passadas referenciam a Versão que viram.

### O que não é

- **Não é o operacional.** Tarefa, Contato, Empresa, Negócio, Conversa e Mensagem não são Documentos de Conhecimento (B19). Um Agente que precisa saber "qual o valor do Negócio X" usa a Ferramenta "ler Negócio", não consulta Conhecimento.
- **Não é Arquivo.** Arquivo é binário transversal do Espaço de Trabalho (A8). Um Documento *referencia* 0..1 Arquivo por Versão; o mesmo Arquivo pode ser Anexo de uma Tarefa e base de um Documento. Enviar um Arquivo não cria Conhecimento; adicioná-lo a uma Coleção cria.
- **Não é Memória.** Memória é o que um Agente ou um Membro retém a partir de interações, sujeita a política de retenção (Glossário; C7). Conhecimento é o que a organização publicou. Um Agente não escreve no Conhecimento por ter "aprendido" algo.
- **Não é Contexto.** Contexto é o objeto de valor efêmero montado a cada Execução (Glossário). Fragmentos recuperados **entram** no Contexto; o Contexto não é Conhecimento, e um Arquivo enviado em uma Sessão de Chat é Contexto da Sessão, não Documento (20.16).
- **Não é Documento colaborativo.** Documentos editáveis de trabalho (D1, futuro) são artefatos de produção; só se tornam Conhecimento quando publicados em uma Coleção, gerando um Documento de Conhecimento com Proveniência.
- **Não é Habilidade.** Habilidade é competência exercida (instruções, Ferramentas, contrato); Conhecimento é conteúdo consultado. Uma Habilidade "atender reclamação" pode requerer a Ferramenta "consultar Conhecimento"; o manual de reclamações é Documento.
- **Não é Comentário.** Comentários sobre um Documento são manifestações de Atores sobre ele, não conteúdo do Documento; nunca são fragmentados nem consultados como Conhecimento (INV-CNH-08).
- **Não é Pasta.** Coleção agrupa Documentos para governança e consulta; Pasta agrupa Listas de Tarefas na Estrutura de Trabalho (A2.2). Coleção não contém Tarefas; Pasta não contém Documentos.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Conhecimento × Arquivo** | Camada curada de Documentos consultáveis, com proveniência, versões e permissões por Coleção. | Binário identificável do Espaço de Trabalho, referenciado por Tarefas, Mensagens, Comentários, Sessões de Chat e Documentos (A8). | O Arquivo é matéria; o Documento é conhecimento sobre essa matéria. Todo Arquivo existe sem Conhecimento; um Documento pode existir sem Arquivo (conteúdo textual próprio). |
| **Documento de Conhecimento × Arquivo** | Unidade de conhecimento: título, Versões, Metadados, Proveniência, Coleção, permissões herdadas, Comentários, Vínculos. | Binário com tipo, tamanho e Criador; sem Versões de conteúdo, sem Coleção, sem Proveniência de curadoria. | Substituir o Arquivo de um Documento cria nova Versão do mesmo Documento; o Arquivo antigo continua a existir. Eliminar o Documento não elimina o Arquivo se outro registro o referenciar (RN-CNH-24). |
| **Documento × Versão** | Identidade estável do conhecimento ("a Política de descontos"). Tem estado de ciclo de vida, Comentários, Vínculos, Tags/rótulos. | Um estado do conteúdo em um momento ("a Política de descontos como estava em março"). Imutável; tem Conteúdo, Fragmentos, estado de processamento. | Consultas e Referências apontam para Versões; governança, Vínculos e Comentários apontam para o Documento. Restaurar uma Versão antiga cria Versão nova (RN-CNH-14). |
| **Documento × Fragmento** | Unidade de negócio com identidade e proveniência; o que um Membro adiciona, edita, arquiva. | Porção derivada de uma Versão, gerada pelo Sistema para recuperação; sem permissão, sem estado, sem evento próprio. | Um Fragmento nunca é criado, editado ou removido por um Ator humano; muda apenas por regeneração. Referência de Conhecimento cita Fragmentos, mas a permissão é a do Documento. |
| **Coleção × Fonte** | Onde os Documentos ficam e sob que governança (Proprietário, permissões, concessões a Agentes). | De onde os Documentos vêm e como se atualizam (tipo, configuração, política de atualização, Membro configurador). | Uma Coleção sem Fonte configurada tem ao menos a `envio manual` implícita; uma Fonte sem Coleção não existe. Permissão é da Coleção; proveniência é da Fonte. |
| **Coleção × Pasta** | Agrupador do domínio IA; contém Documentos; Proprietário; unidade de concessão a Agentes; sem aninhamento. | Agrupador da Estrutura de Trabalho; contém Subpastas e Listas; sem Proprietário (B45); herança de configuração (B25). | A Coleção não é nível de herança de Status, Campos ou Automações; a Pasta não é Recurso de consulta de Agente. Relacionam-se só por Vínculo entre Tarefa e Documento (A2.2). |
| **Conhecimento × Memória** | Curado por ato humano; governado por Coleção; proveniência obrigatória; consultável por qualquer Sujeito com `ver`. | Retida automaticamente a partir de interações; pertence a um Agente ou a um Membro; política de retenção (C7); nunca consultável por terceiros. | Memória pode lembrar "o cliente prefere e-mail"; Conhecimento afirma "a política de contato é X". Um Agente não converte Memória em Documento sem Ferramenta, permissão e ato registrado (INV-CNH-12). |
| **Conhecimento × Contexto** | Persistente, versionado, governado. | Efêmero, reconstruído a cada Execução; reúne âncora, Arquivos, Fragmentos recuperados, Memória, histórico (Glossário). | O Contexto consome Fragmentos; não os possui. Um Arquivo no Contexto de uma Sessão não está no Conhecimento (20.16). |
| **Conhecimento × Registros operacionais (Tarefa, Contato, Negócio, Conversa)** | Afirmações curadas, relativamente estáveis, sobre "como as coisas são ou devem ser". | Fatos operacionais em mudança contínua, com permissões e ciclo de vida do seu domínio. | Agentes acessam registros por Ferramentas do domínio (B19); acessam Conhecimento pela Ferramenta "consultar Conhecimento". Um Documento pode se *relacionar* com um Negócio (Vínculo); nunca *é* o Negócio. |
| **Conhecimento × Habilidade** | Conteúdo consultável: "o que sabemos". | Competência exercida por um Agente: "o que sabemos fazer" (B16). | Habilidade tem contrato de entrada/saída e Ferramentas requeridas; Documento tem Conteúdo e Versões. Uma Habilidade pode *requerer* acesso a Conhecimento; não o *contém*. |
| **Conhecimento × Comentário** | Conteúdo publicado da organização, versionado, fragmentado. | Manifestação de um Ator sobre um registro (A8), inclusive sobre um Documento; com autor, respostas, resolução. | Comentário em Documento é conversa *sobre* o conhecimento; nunca entra em Fragmento nem em Contexto como Conhecimento (INV-CNH-08). Para corrigir o conteúdo, cria-se Versão. |

## 5. Identidade

**Coleção.** Identificador opaco, imutável, atribuído na criação. *Teste de identidade*: se nome, descrição, Proprietário, Fontes, todas as permissões e todos os Documentos mudarem, continua sendo a mesma Coleção — as concessões a Agentes, as Referências de Conhecimento e os Registros de Atividade continuam a apontar para ela. Nome não é identidade, mas é **único entre Coleções com estado próprio `ativo` ou `arquivado` no Espaço de Trabalho**, sem distinção de maiúsculas e espaços nas extremidades (RN-CNH-02), pelo mesmo motivo de B39: Agentes, Ferramentas e Membros referem-se a Coleções por nome ("consultar a Coleção Políticas de RH"), e homônimos tornariam a referência ambígua.

**Fonte.** Identificador opaco. *Teste*: alterar configuração, política de atualização, Membro configurador ou estado preserva a Fonte; os Documentos continuam a apontar para ela. Trocar a URL de uma Fonte URL para outra página é *reconfiguração* da mesma Fonte (a Atualização seguinte trata os Documentos que deixaram de existir na origem conforme RN-CNH-18) — não cria Fonte nova. A Fonte `envio manual` de cada Coleção é identificada pela Coleção: existe exatamente uma, criada com ela, e não é removível.

**Documento de Conhecimento.** Identificador opaco, imutável. *Teste*: se título, tipo de conteúdo, Metadados, rótulos, Coleção (por movimentação), Arquivo referenciado e todo o Conteúdo mudarem — cada mudança de conteúdo gerando Versão —, continua sendo o mesmo Documento: Vínculos, Comentários, âncoras de Sessão e Referências de Conhecimento a Versões antigas continuam válidos. Título **não é único** (como o título de Tarefa, B39): dois Documentos "Tabela de preços" em Coleções distintas são normais; na mesma Coleção são permitidos, com aviso de produto.

**Versão de Documento.** Identidade derivada: (Documento, número sequencial a partir de 1). Imutável: uma Versão nunca tem seu Conteúdo alterado; "editar" cria a próxima. Uma Versão eliminada por retenção nunca tem seu número reutilizado (INV-CNH-06).

**Fragmento.** Identificador local, estável dentro da Versão, usado por Referências de Conhecimento e Registros de Atividade. Não é identidade ontológica: regenerar os Fragmentos de uma Versão produz Fragmentos novos, com identificadores novos; Referências a Fragmentos antigos permanecem como valor histórico com marcador (RN-CNH-22). Mesmo princípio do Identificador local de Item de Checklist (Glossário).

**Objetos de valor** (Conteúdo, Representação derivada, Metadado, Proveniência, Políticas, Referência de Conhecimento) não têm identidade: são comparados por valor e substituídos, não editados.

## 6. Atributos fundamentais

### 6.1 Coleção

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade. |
| Nome | nativo | sim | Único entre Coleções `ativo`/`arquivado` do Espaço de Trabalho (RN-CNH-02). |
| Descrição | nativo (texto) | não | Para que serve a Coleção; consumida por Membros e por Agentes ao escolher onde consultar. Não é Conteúdo nem é fragmentada. |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7; INV-ET-03). Sucessão por B28. |
| Criador | referência (Ator) | sim | Imutável. Membro ou Agente (com Ferramenta e permissão). |
| Estado próprio | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1). |
| Estado próprio anterior à exclusão | nativo (condicional) | condicional | Preenchido enquanto `na lixeira` (B43, por analogia). |
| Privada | nativo (booleano) | sim | Quando verdadeiro, interrompe a origem "papel" (17.2). Padrão: falso. |
| Política de retenção de versões | objeto de valor | sim | Quantas Versões superadas reter por Documento e/ou por quanto tempo (seção 7.5). Padrão da plataforma; dentro de tetos da plataforma (B34). |
| Momento de criação | nativo | sim | Imutável. |
| Quantidade de Documentos, Momento da última Atualização | derivados | — | Leituras; não gravados. |

### 6.2 Fonte

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade. |
| Coleção | referência (Coleção) | sim | Exatamente uma; imutável (RN-CNH-05). |
| Tipo | nativo (enumeração da plataforma) | sim | `envio manual`, `URL`, `Integração`. Imutável. |
| Nome | nativo | sim | Para `envio manual`, fixo pela plataforma ("Envio manual"). |
| Configuração | objeto de valor | condicional | `URL`: endereço, se inclui páginas ligadas (página única ou site), profundidade de coleta declarada pela plataforma. `Integração`: referência à Integração do Espaço de Trabalho (B35) e o repositório/escopo externo selecionado. `envio manual`: vazia. Credenciais nunca vivem aqui: vivem na Integração (documento 01, 7.4). |
| Política de atualização | objeto de valor | condicional | `manual` (só quando um Ator pede) ou `periódica` (intervalo declarado, dentro de tetos da plataforma). Não se aplica a `envio manual`. |
| Membro configurador | referência (Membro) | condicional | Membro que configurou a Fonte `URL` ou `Integração`; rastreabilidade, não governança (mesmo princípio de B35). Vazio para `envio manual`. |
| Estado | nativo | sim | `ativo`, `pausado`, `com erro` (seção 11.2). A Fonte `envio manual` está sempre `ativo`. |
| Momento da última Atualização; resultado da última Atualização | nativos | não | Preenchidos pelo Sistema a cada Atualização (seção 12.4). |
| Marca de versão da origem | objeto de valor | não | O que a origem informa sobre a sua própria versão (data de modificação, identificador de revisão), registrado na última Atualização; copiado para a Proveniência das Versões criadas. |

### 6.3 Documento de Conhecimento

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade. |
| Coleção | referência (Coleção) | sim | Exatamente uma (DO-CNH-04). Alterável só por movimentação (RN-CNH-08). |
| Fonte | referência (Fonte) | sim | Exatamente uma, da mesma Coleção (INV-CNH-03). |
| Título | nativo | sim | Editável sem criar Versão (não é conteúdo). Não único. |
| Tipo de conteúdo | nativo (enumeração da plataforma) | sim | `texto`, `imagem`, `áudio`, `vídeo`, `PDF`, `arquivo estruturado` (planilha e afins), `página web`. Descreve o Documento; a Versão corrente deve ser compatível (INV-CNH-07). |
| Versão corrente | referência (Versão) | sim | A Versão que representa o Documento agora. Normalmente a de maior número; pode ser outra apenas transitoriamente (12.3). |
| Estado próprio | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1). |
| Estado efetivo | derivado | — | O mais restritivo entre o próprio e o da Coleção (B36, por analogia — DO-CNH-09). |
| Estado próprio anterior à exclusão | nativo (condicional) | condicional | Preenchido enquanto `na lixeira` (B43). |
| Estado de processamento | derivado | — | O estado de processamento da Versão corrente: `pendente`, `processado`, `com erro` (11.3). |
| Ausente na origem desde | nativo (condicional) | não | Preenchido pelo Sistema quando uma Atualização não encontra o Documento na origem (RN-CNH-18). Esvaziado se reaparecer. |
| Desatualizado | derivado | — | Verdadeiro quando a Fonte está `pausado`, `com erro`, ou a Integração subjacente está `desconectada`/`com erro`, ou a Política de atualização `periódica` não é cumprida há mais de um intervalo (20.6). |
| Metadado | objeto de valor | não | Seção 7.3. |
| Proveniência | objeto de valor | sim | Seção 7.4. Obrigatória (INV-CNH-05). |
| Criador | referência (Ator) | sim | Imutável. |
| Momento de criação | nativo | sim | Imutável. |

### 6.4 Versão de Documento

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Número | nativo | sim | Sequencial por Documento, a partir de 1; nunca reutilizado. |
| Conteúdo | objeto de valor | sim | Seção 7.1. Imutável. |
| Representações derivadas | objeto de valor 0..N | não | Seção 7.2. Regeneráveis; não fazem parte do Conteúdo. |
| Estado de processamento | nativo | sim | `pendente`, `processado`, `com erro` (11.3). Único atributo mutável da Versão. |
| Origem da Versão | objeto de valor | sim | Como surgiu: `envio` (Ator), `edição` (Ator), `Atualização` (Fonte, marca de versão da origem), `restauração` (Versão de origem), `publicação` (D1, futuro). Com Ator, ator delegante e momento. |
| Momento de criação | nativo | sim | Imutável. |
| Superada em | nativo | não | Momento em que deixou de ser corrente. |

### 6.5 Fragmento

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador local | nativo | sim | Estável dentro da Versão. |
| Versão | referência (Versão) | sim | Exatamente uma; imutável. |
| Posição | objeto de valor | sim | Onde está na Versão: ordem sequencial e localização própria do tipo (intervalo de texto, página, intervalo de tempo em áudio/vídeo, região de imagem, intervalo de linhas em arquivo estruturado). Serve à citação. |
| Conteúdo derivado | derivado | sim | O trecho, sempre derivado do Conteúdo ou de uma Representação derivada da Versão. |

Não há atributo de permissão, estado, autor ou momento no Fragmento: tudo isso é do Documento e da Versão.

## 7. Entidades internas ou componentes

### 7.1 Conteúdo (objeto de valor da Versão)

O material propriamente dito de uma Versão. Composto por, ao menos um dos dois (INV-CNH-04):

- **Texto próprio** — conteúdo textual armazenado no Documento (rico ou simples). Documentos de tipo `texto` e `página web` normalmente o têm.
- **Arquivo** — referência a exatamente um Arquivo do Espaço de Trabalho (A8). Documentos de tipo `imagem`, `áudio`, `vídeo`, `PDF` e `arquivo estruturado` normalmente o têm.

Um Documento pode ter ambos (texto de apresentação mais o PDF). O Conteúdo é **imutável** por Versão: qualquer alteração — trocar o Arquivo, editar o texto — cria Versão nova (RN-CNH-12). O Arquivo referenciado é do Espaço de Trabalho e pode ser referenciado por outros registros; a Versão o *referencia*, não o *contém*.

### 7.2 Representação derivada (objeto de valor da Versão)

Texto **derivado** de Conteúdo não textual: transcrição de áudio ou vídeo, descrição de imagem, extração de texto de PDF ou de arquivo estruturado. Mesmo padrão da transcrição de Anexo (documento 14, 7.11): é possibilidade, não infraestrutura; se existir, é derivada, regenerável, atribuída a um Ator gerador (Sistema ou Agente) com momento, e **nunca substitui o Conteúdo** nem é o Documento. Uma Versão pode ter 0..N Representações derivadas (uma por tipo de derivação). Fragmentos podem ser gerados do Conteúdo ou de uma Representação derivada; a Posição do Fragmento diz de qual. Um Modelo que não entende o tipo do Conteúdo pode consultar o Documento pela Representação derivada (20.8).

### 7.3 Metadado (objeto de valor do Documento)

Descrição do Documento, distinta do Conteúdo: **autor original** (texto livre; não é Criador nem Membro — pode ser uma pessoa externa ou uma organização), **idioma** do conteúdo, **data do conteúdo** (quando o material foi produzido ou passou a valer; distinta do momento de criação do Documento), **rótulos** (lista de textos livres, definidos por Documento, sem catálogo), **resumo** (texto curto, editável, não fragmentado por padrão). Editar Metadado não cria Versão. Rótulos são o mecanismo de classificação nesta versão; Tags do Espaço de Trabalho aplicadas a Documentos são proposta de ampliação de B5 (DO-CNH-06, seção 24).

### 7.4 Proveniência (objeto de valor do Documento e da Versão)

De onde o Documento veio. Ampliação do verbete do Glossário para Documento de Conhecimento, com os elementos:

| Elemento | Obrigatório | Conteúdo |
| --- | --- | --- |
| Fonte | sim | Identificador e tipo da Fonte de origem (mesmo depois de a Fonte ser eliminada, como valor histórico). |
| Origem específica | condicional | `envio manual`: identificador do Arquivo enviado (se houver) ou "texto digitado"; `URL`: o endereço exato da página; `Integração`: identificador do item no repositório externo. Quando o Documento foi criado a partir de um registro da plataforma (Conversa, Sessão de Chat, Comentário, Tarefa), o identificador desse registro e o seu tipo. |
| Ator que adicionou | sim | Membro, Agente (com ator delegante) ou Integração (com Membro configurador como delegante), conforme A6.2. |
| Momento de adição | sim | Quando entrou no Conhecimento. |
| Marca de versão da origem | condicional | O que a origem informou sobre a sua versão no momento da coleta. |
| Copiado de | condicional | Quando o Documento é cópia de outro Documento (20.2): identificador do Documento e número da Versão copiada, à época. Sem vínculo vivo. |

Cada **Versão** carrega a sua Origem da Versão (6.4), que é a parte da Proveniência que muda a cada atualização. A Proveniência do Documento é a da primeira Versão mais a Fonte; nunca é esvaziada (INV-CNH-05). Sobrevive à eliminação da Fonte, do Arquivo, do Membro (que passa a `removido`) e do registro de origem, como valor histórico.

### 7.5 Políticas (objetos de valor)

- **Política de atualização** (da Fonte `URL` ou `Integração`): `manual` ou `periódica` com intervalo. Dentro de tetos da plataforma (intervalo mínimo é Limite imposto, B34).
- **Política de retenção de versões** (da Coleção): número máximo de Versões superadas retidas por Documento e/ou prazo desde "Superada em". A Versão corrente nunca é alcançada (INV-CNH-06). Versões eliminadas por retenção deixam Referências de Conhecimento com marcador (RN-CNH-22). Padrão da plataforma; a organização ajusta dentro de tetos.

### 7.6 Comentário (no Documento)

Manifestação de um Ator sobre o Documento (A8), com as mesmas propriedades do Comentário na Tarefa (documento 06, 7.1): autor Ator (Agente incluído, com delegante), conteúdo rico com Anexos e menções, respostas em um nível, resolução no Comentário raiz, edição só pelo autor ou por quem tem `administrar` na Coleção, exclusão com marcador. Específico do Documento: o Comentário é sobre o **Documento**, não sobre uma Versão, mas pode **citar** uma Versão e uma Posição (objeto de valor opcional "trecho comentado"), para revisão de conteúdo. Comentários **não são Conteúdo**: nunca geram Fragmentos, nunca entram em Contexto como Conhecimento e não são alcançados por Atualização (INV-CNH-08). Exigem `comentar` na Coleção.

### 7.7 Referência de Conhecimento (objeto de valor de saída)

A citação que uma Execução de Agente (ou uma Mensagem de Chat com papel `assistente`) faz ao Conhecimento consultado: **Documento** (identificador e título à época), **Versão** (número), **Fragmentos** (0..N identificadores locais com Posição) e **Coleção** (identificador e nome à época). É gravada na Execução (B18) e, quando a saída é Mensagem de Chat, nela. Não é Vínculo (não é bidirecional nem editável) e não é Proveniência (a saída não *vem* do Documento; *baseia-se* nele). Sobrevive à eliminação do que cita, com marcador (RN-CNH-22). Serve a auditoria ("em que se baseou"), a produto ("ver fonte") e a Painéis ("Documentos mais consultados", derivado).

### 7.8 O que não é componente

Arquivo (transversal; referenciado), Integração (do Espaço de Trabalho; referenciada pela Fonte), Modelo (global; a compatibilidade com o tipo de conteúdo é verificada, não contida), Agente (recebe concessão; não é parte da Coleção), Execução (pertence ao Agente; referencia Documento e Versão), Sessão de Chat (do Membro; pode ancorar-se a um Documento, B21).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| Coleção pertence a | Espaço de Trabalho | pertencimento | ET → Coleção | 0..N por ET (documento 01, 8). Nunca migra. |
| Coleção é de propriedade de | Membro | propriedade | Coleção → Membro | Exatamente um Proprietário (A7). Sucessão (B28). |
| Coleção contém Fontes | Fonte | contenção | Coleção → Fonte | 1..N; exatamente uma `envio manual` (INV-CNH-02). |
| Coleção contém Documentos | Documento | contenção | Coleção → Documento | 0..N. Cascata de estado por derivação (DO-CNH-09) e de eliminação. |
| Coleção concede acesso a | Agente | permissão (concessão direta) | Coleção → Agente | "Agente tem acesso à Coleção" é uma concessão `ver` (ou mais) em escopo `registro` ao Agente como Sujeito (17.3). Não é contenção nem associação de domínio. |
| Fonte referencia Integração | Integração | referência | Fonte → Integração | Só tipo `Integração`; a Integração pertence ao ET (B35) e pode alimentar Fontes de várias Coleções. |
| Fonte foi configurada por | Membro | referência | Fonte → Membro | Membro configurador; rastreabilidade. |
| Documento tem Fonte | Fonte | referência (obrigatória, mesma Coleção) | Documento → Fonte | Exatamente uma. |
| Documento contém Versões | Versão | contenção (agregado) | Documento → Versão | 1..N; uma corrente. |
| Versão referencia Arquivo | Arquivo | referência | Versão → Arquivo | 0..1. O Arquivo pertence ao ET; pode ser referenciado por outros registros. |
| Versão contém Fragmentos | Fragmento | contenção (derivada) | Versão → Fragmento | 0..N; existem só após processamento. |
| Documento contém Comentários | Comentário | contenção (agregado) | Documento → Comentário | 0..N. |
| Documento tem Metadado, Proveniência | objetos de valor | composição de valor | Documento → valor | Proveniência 1; Metadado 0..1. |
| Documento vinculado a | Tarefa, Negócio, Contato, Empresa, Documento | associação (Vínculo tipado, bidirecional) | Documento ↔ registro | 0..N por tipo. Tarefa–Documento (DO-TAR-08) e Negócio–Documento (documento 12) já existem; Contato–Documento, Empresa–Documento e Documento–Documento ("relacionado a") são definidos aqui (DO-CNH-07). Não implica propriedade nem permissão. |
| Documento foi criado a partir de | Conversa, Sessão de Chat, Comentário, Tarefa, Documento (cópia) | proveniência (objeto de valor) | Documento → registro | Sem vínculo vivo. Não existe Vínculo Documento–Conversa: a Conversa é origem, não relação. |
| Documento é objeto de | Execução de Agente | referência inversa (Referência de Conhecimento) | Execução → Documento, Versão, Fragmento | O Documento não conhece Execuções; a visão "consultado por" é derivada. |
| Documento é âncora de | Sessão de Chat | referência inversa | Sessão → Documento | B21. |
| Documento é mencionado em | Comentário, descrição de Tarefa | referência inversa | registro → Documento | DO-TAR-19: menção não cria Vínculo nem permissão. |
| Documento tem rótulos | Metadado | objeto de valor | — | Sem catálogo. Tags: proposta (DO-CNH-06). |
| Coleção é registrada em | Registro de Atividade | referência inversa | Registro → Coleção/Documento | Histórico é a visão (A6). |
| Coleção é escopo de Fonte de Dados de | Painel (Widget cuja entidade-alvo é Documento de Conhecimento) | referência inversa | Widget → Coleção | A entidade-alvo é o Documento; a Coleção é escopo referenciado por identidade (B101). Só Métricas de catálogo e uso (contagem, estado, Versões, Atualizações), nunca conteúdo (RN-PAI-15); "Conhecimento consultado" é Métrica derivada das Referências de Conhecimento das Execuções (DO-CNH-15; DO-PAI-05). |

Distinção aplicada: a Coleção **CONTÉM** Fontes e Documentos e **é de propriedade de** um Membro; o Documento **CONTÉM** Versões, Fragmentos e Comentários; a Versão **REFERENCIA** Arquivo; a Fonte **REFERENCIA** Integração e Membro configurador; a Coleção **CONFIGURA** políticas (objetos de valor) e **concede** acesso a Agentes (permissão, não relação de domínio); o Documento **RELACIONA-SE** por Vínculo com registros de outros domínios; Documento e Fragmento **HERDAM** permissão da Coleção, e nada mais é herdado. Nenhuma entidade desta camada **USA** configuração da Estrutura de Trabalho (Status, Campos, Funcionalidades): a Coleção não é nível da estrutura.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Coleção | 0..N | sim | sim | pertencimento | ET recém-criado não tem Coleção; nenhuma é obrigatória (DO-CNH-02). |
| Coleção → Proprietário | 1 | não | não | propriedade | A7. |
| Coleção → Coleção (pai) | 0 | — | — | — | Sem aninhamento nesta versão (DO-CNH-03). |
| Coleção → Fonte | 1..N | não | sim | contenção | A `envio manual` é criada com a Coleção (INV-CNH-02); `URL` e `Integração` são opcionais e podem ser várias. |
| Coleção → Fonte `envio manual` | 1 | não | não | contenção | Uma por Coleção; implícita; não removível. |
| Fonte → Coleção | 1 | não | não | contenção | Fonte pertence a exatamente uma Coleção (DO-CNH-05). Uma origem que deva alimentar duas Coleções é configurada como duas Fontes. |
| Fonte `Integração` → Integração | 1 | não | não | referência | Sem Integração `conectada` não há Atualização; a Fonte passa a `com erro` (20.6). |
| Integração → Fontes | 0..N | sim | sim | referência inversa | A mesma Integração pode alimentar Fontes de várias Coleções. |
| Coleção → Documento | 0..N | sim | sim | contenção | Coleção vazia é válida (recém-criada). |
| Documento → Coleção | 1 | não | não | contenção | DO-CNH-04. Duas Coleções tornariam a permissão efetiva ambígua (união? interseção?) e a concessão a Agentes imprevisível. |
| Documento → Fonte | 1 | não | não | referência | Sem Fonte não há Proveniência; várias Fontes para um Documento tornariam "de onde veio" ambíguo. |
| Fonte → Documento | 0..N | sim | sim | referência inversa | Fonte recém-configurada ou sem itens. |
| Documento → Versão | 1..N | não | sim | contenção | Criar o Documento cria a Versão 1 (RN-CNH-10). |
| Documento → Versão corrente | 1 | não | não | referência | INV-CNH-06. |
| Versão → Conteúdo | 1 | não | não | objeto de valor | Texto próprio e/ou Arquivo (INV-CNH-04). |
| Versão → Arquivo | 0..1 | sim | não | referência | Um Documento com dois Arquivos é dois Documentos (ou um Arquivo estruturado). |
| Arquivo → Versões que o referenciam | 0..N | sim | sim | referência inversa | O mesmo Arquivo pode ser base de vários Documentos e Anexo de Tarefas (A8). |
| Versão → Representação derivada | 0..N | sim | sim | objeto de valor | Uma por tipo de derivação. |
| Versão → Fragmento | 0..N | sim | sim | contenção derivada | Zero enquanto `pendente` ou `com erro`. |
| Fragmento → Versão | 1 | não | não | contenção | Imutável. |
| Documento → Comentário | 0..N | sim | sim | contenção | |
| Documento → Metadado | 0..1 | sim | não | objeto de valor | Composto; ausência total é válida. |
| Documento → Proveniência | 1 | não | não | objeto de valor | INV-CNH-05. |
| Documento → Vínculo (por tipo de destino) | 0..N | sim | sim | associativa | Nenhum obrigatório nem exclusivo. |
| Documento → Tag | 0 (nesta versão) | — | — | — | Proposta DO-CNH-06; até adoção, rótulos no Metadado. |
| Coleção → Agente com concessão | 0..N | sim | sim | permissão | Coleção sem Agente é consultada só por Membros. |
| Agente → Coleções com concessão | 0..N | sim | sim | permissão | Agente sem Conhecimento é válido (B15: age só com instruções e Ferramentas). |
| Execução → Referência de Conhecimento | 0..N | sim | sim | objeto de valor | Uma Execução pode consultar muitos Documentos ou nenhum. |
| Documento → Execuções que o referenciaram | 0..N | sim | sim | derivada | |
| Sessão de Chat → Documento (âncora) | 0..1 | sim | não | referência | B21. |

Sem `DECISÃO NECESSÁRIA` pendente: as cardinalidades decorrem de A7, A8, B19, B21, B35 e das decisões RECOMENDADAS da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Há uma cadeia curta e sem herança de configuração: Espaço de Trabalho → Coleção → Documento → Versão → Fragmento. A Coleção não se aninha (DO-CNH-03): profundidade ilimitada tornaria a permissão efetiva de um Documento dependente de um caminho — exatamente o que B3 rejeitou na Estrutura de Trabalho — e transformaria "Agente tem acesso à Coleção" em "Agente tem acesso à Coleção e às filhas, salvo as privadas", que é imprevisível para quem concede. Um único nível de aninhamento foi analisado e rejeitado nesta versão: não há caso de uso que ele resolva e que a combinação nome + descrição + rótulos + concessão a várias Coleções não resolva; se o produto exigir, é a questão 25.1.

**Pertencimento (teste de existência).** A Coleção não existe sem o Espaço de Trabalho. Fonte e Documento não existem sem a Coleção (contenção; eliminada a Coleção, são eliminados). Versão, Fragmento, Comentário, Metadado e Proveniência não existem sem o Documento (agregado). Arquivo, Integração, Membro, Agente, Tarefa, Negócio, Contato, Empresa e Modelo existem sem qualquer entidade desta camada (referência ou associação). Execuções e Sessões de Chat sobrevivem à eliminação do Documento, com Referências e âncoras marcadas.

**"Pertence a" versus "relaciona-se com".** Um Documento *pertence* a uma Coleção e *tem* uma Fonte. Um Documento *relaciona-se com* um Negócio (Vínculo) e *baseia* uma Execução (Referência). Um Agente *tem acesso a* uma Coleção (permissão): a Coleção não pertence ao Agente nem o Agente à Coleção; remover um não elimina o outro.

**Propriedade.** A Coleção tem Proprietário (A7): um Membro que responde pela curadoria — o que entra, quem consulta, quais Agentes acessam. Documento, Fonte, Versão e Fragmento **não têm Proprietário**: a governança é a da Coleção, como a da Tarefa é a da Lista (documento 06, 10). O Criador de um Documento não é seu Proprietário e pode perder acesso se a Coleção se tornar privada. A cadeia de responsabilidade é: Fragmento → Versão → Documento → Coleção → Proprietário (Membro) → Espaço de Trabalho → Proprietário do Espaço de Trabalho.

**Configurar não é conter.** A Coleção configura a Política de retenção; a Fonte configura a Política de atualização; ambas são objetos de valor. O Membro configurador configura a Fonte, mas a Fonte pertence à Coleção. O Administrador que concede acesso a um Agente não torna o Agente parte da Coleção.

## 11. Estados

Todos os estados desta seção são **estados de sistema** (A4.1), não personalizáveis. Não há Status (A4.2) em nenhuma entidade desta camada: "rascunho / publicado / obsoleto" como fluxo editorial de Documento não existe nesta versão (questão 25.3).

### 11.1 Estado de ciclo de vida: Coleção e Documento

| Estado próprio | Coleção | Documento |
| --- | --- | --- |
| `ativo` | Consultável por quem tem `ver`; recebe Documentos; Fontes atualizam. | Consultável (se `processado`); versionável; vinculável. |
| `arquivado` | Visível a quem tem `ver` como histórico; **não consultável por Agentes**; não recebe Documentos; Fontes ficam `pausado` pelo Sistema. | Visível como histórico; **não consultável por Agentes**; não versionável; Vínculos preservados. |
| `na lixeira` | Oculta; eliminação ao fim da Política de lixeira (A4.1), em cascata. | Oculto; Vínculos ocultos; eliminação ao fim do prazo. |

O **estado efetivo** do Documento é o mais restritivo entre o seu estado próprio e o da Coleção, na ordem `ativo` < `arquivado` < `na lixeira` (DO-CNH-09, aplicando o modelo de B36 a esta cadeia de dois níveis). Arquivar a Coleção não grava estado nos Documentos; restaurá-la devolve a cada um o seu estado próprio. Toda regra de "pode ser consultado" avalia o estado efetivo.

### 11.2 Estado da Fonte

| Estado | Significado | Transições |
| --- | --- | --- |
| `ativo` | Atualiza conforme a Política de atualização (ou aceita envios, se `envio manual`). | → `pausado` (Ator com `administrar`; Sistema, ao arquivar a Coleção); → `com erro` (Sistema, após Atualização falha). |
| `pausado` | Não atualiza; Documentos permanecem; Desatualizado passa a verdadeiro após um intervalo. | → `ativo` (Ator com `administrar`; Sistema, ao restaurar a Coleção, se estava `ativo` antes). |
| `com erro` | Última Atualização falhou (origem inacessível, Integração `desconectada` ou `com erro`, credenciais expiradas). Documentos permanecem. | → `ativo` (Atualização bem-sucedida, manual ou periódica); → `pausado` (Ator). |

A Fonte `envio manual` está sempre `ativo` enquanto a Coleção tem estado efetivo `ativo`. A Fonte não tem `arquivado` nem `na lixeira` próprios: segue a Coleção; pode ser **eliminada** por Ator com `administrar` (12.5).

### 11.3 Estado de processamento: Versão (e, por derivação, Documento)

| Estado | Significado | Quem transita |
| --- | --- | --- |
| `pendente` | Versão criada; Indexação conceitual não concluída; sem Fragmentos. Documento visível a Membros; **não consultável por Agentes** nesta Versão. | Sistema, na criação. |
| `processado` | Consultável: Fragmentos existem. | Sistema, ao concluir a Indexação. |
| `com erro` | Indexação falhou (tipo não suportado, Arquivo corrompido, limite excedido). Sem Fragmentos. O Documento **não é removido** (RN-CNH-20). | Sistema. Reprocessamento (→ `pendente`) por Ator com `editar` ou pelo Sistema. |

Distinção obrigatória: **estado de ciclo de vida** responde "o Documento existe e está disponível?"; **estado de processamento** responde "a Versão corrente já é consultável?". Um Documento `ativo` e `com erro` existe, é visível, é vinculável e comentável, mas não entra em Contexto. Um Documento `arquivado` e `processado` tem Fragmentos, mas não entra em Contexto porque o ciclo de vida o impede. Quando a Versão corrente muda, o estado de processamento do Documento muda com ela; Versões superadas mantêm o seu (uma Versão superada `com erro` não impede nada).

## 12. Ciclo de vida

### 12.1 Criação da Coleção

Ato de um Membro com permissão de criar Coleções (Papel Membro ou superior; nunca Convidado) ou de um Agente com Ferramenta e permissão (raro; Proprietário é sempre o Membro delegante, RN-CNH-01). Atômica: cria a Coleção `ativo`, o Proprietário (o Criador, ou outro Membro `ativo` indicado), a Fonte `envio manual`, a Política de retenção com padrão da plataforma e o Registro de Atividade. Sem Documentos. Não existe Coleção padrão do Espaço de Trabalho (DO-CNH-02): "adicionar ao Conhecimento" sem Coleção existente exige criar uma.

### 12.2 Criação do Documento (três caminhos, uma regra)

Todo caminho cria, no mesmo ato, o Documento `ativo`, a Versão 1 com Conteúdo e estado `pendente`, a Proveniência e o Registro de Atividade; e dispara a Indexação conceitual (12.6). Exige `criar` na Coleção (RN-CNH-06).

1. **Envio manual.** Um Membro (ou Agente por Ferramenta) adiciona texto próprio e/ou um Arquivo (novo ou já existente no Espaço de Trabalho) a uma Coleção. Fonte = a `envio manual` da Coleção. Inclui "adicionar ao Conhecimento" a partir de uma Sessão de Chat (Arquivo ou trecho), de uma Conversa (Mensagens selecionadas ou resumo), de um Comentário ou de uma Tarefa: a Proveniência registra o registro de origem (7.4); **não** é criado Vínculo automático com Conversa (não existe esse tipo) — com Tarefa, Negócio, Contato ou Empresa, o Vínculo é opcional e explícito.
2. **Atualização de Fonte `URL` ou `Integração`.** O Sistema (ou a Integração, como Ator) cria um Documento por item novo encontrado, com Proveniência apontando ao endereço ou ao identificador externo e à marca de versão da origem. O Membro configurador é o ator delegante (A6.2).
3. **Cópia.** Um Ator com `ver` na origem e `criar` no destino copia um Documento para outra Coleção: Documento novo, Versão 1 com Conteúdo igual ao da Versão copiada, Proveniência "copiado de" (7.4), Fonte = `envio manual` do destino. Sem vínculo vivo: as cópias evoluem independentemente (20.2).

Publicação de Documento colaborativo (D1) será um quarto caminho, com Origem da Versão `publicação`.

### 12.3 Versões

- **Edição** (texto próprio alterado, Arquivo substituído) por Ator com `editar`: cria Versão N+1 `pendente`, que passa a corrente no mesmo ato; a anterior recebe "Superada em". Fragmentos da anterior permanecem enquanto a Versão existir (servem a Referências históricas), mas só a corrente é consultável (RN-CNH-13).
- **Atualização** que detecta conteúdo diferente na origem: idem, com Origem da Versão `Atualização`.
- **Restauração de Versão** por Ator com `editar`: cria Versão N+1 cujo Conteúdo é igual ao da Versão escolhida, com Origem `restauração` (referência à Versão de origem). Nunca reaponta a corrente para trás nem apaga histórico (RN-CNH-14). Fragmentos são regenerados (a Versão é nova).
- **Retenção**: ao fim da Política de retenção de versões, o Sistema elimina Versões superadas (Conteúdo, Representações, Fragmentos), preservando número, momentos e Origem como registro mínimo dentro do Documento, para que Referências de Conhecimento resolvam com marcador "Versão eliminada por retenção" (RN-CNH-22). Um Arquivo referenciado só por uma Versão eliminada segue RN-CNH-24.

### 12.4 Atualização (sincronização de Fonte)

Operação do Sistema (Fonte `URL`) ou da Integração (Fonte `Integração`), disparada pela Política `periódica` ou por pedido manual de Ator com `editar` na Coleção. Efeitos, atômicos por item e registrados:

| Situação encontrada | Efeito |
| --- | --- |
| Item novo na origem | Documento novo (12.2, caminho 2). |
| Item existente com conteúdo diferente | Versão nova (12.3). Metadados que a origem fornece (título, autor, idioma, data) atualizam o Documento sem criar Versão além da de conteúdo. |
| Item existente sem mudança | Nada; "Momento da última Atualização" da Fonte avança. |
| Item que deixou de existir na origem | Documento passa a estado próprio `arquivado` pelo Sistema, com "Ausente na origem desde" preenchido (RN-CNH-18). **Não** vai à lixeira: remoção na origem pode ser transitória ou erro, e a lixeira elimina por prazo sem ato humano; arquivar preserva e sinaliza, e um curador decide. Se reaparecer, o Sistema o desarquiva **apenas se** o arquivamento foi do Sistema (o estado próprio `arquivado` por ato de Membro não é revertido). |
| Origem inacessível | Nenhum Documento é alterado; Fonte → `com erro`; evento. |
| Documento `na lixeira` por ato humano reaparece na origem | Não é restaurado nem recriado enquanto estiver `na lixeira` (o curador o excluiu); após eliminação permanente, uma Atualização futura o recria como Documento novo. |

A Atualização nunca altera Documentos de outra Fonte nem Documentos cuja Fonte é `envio manual`. Uma Atualização em curso quando a Coleção é arquivada ou enviada à lixeira é cancelada; os itens já aplicados permanecem.

### 12.5 Arquivar, excluir, restaurar, eliminar, mover

- **Coleção**: arquivar/desarquivar exige `administrar`; lixeira/restaurar exige `excluir` (mesmo padrão de B46). Arquivar pausa as Fontes (Sistema) e retira a Coleção das consultas de Agentes no mesmo ato (a próxima Ferramenta "consultar Conhecimento" não a encontra; B23). Lixeira: idem, e Vínculos dos Documentos ficam ocultos. Restaurar devolve o Estado próprio anterior à exclusão (B43) e reativa as Fontes que o Sistema pausou. Eliminação permanente (fim da Política de lixeira, ou antecipada por `administrar`): elimina Fontes, Documentos e seus agregados, Vínculos e concessões; revoga a concessão dos Agentes com evento "Concessão a Agente revogada" (causa `eliminação`); Referências de Conhecimento em Execuções passam a resolver com marcador; Registros de Atividade permanecem (INV-ET-12).
- **Documento**: arquivar/desarquivar exige `editar`; lixeira/restaurar exige `excluir`. Restaurar exige que a Coleção não esteja efetivamente `na lixeira`. Eliminação permanente elimina Versões, Representações, Fragmentos, Comentários, Metadado; remove Vínculos; limpa âncoras de Sessão; Proveniência desaparece com o Documento (mas a Referência de Conhecimento nas Execuções guarda identificador e título à época). O Arquivo referenciado permanece se qualquer outro registro o referenciar; caso contrário é eliminado (RN-CNH-24, mesmo critério da Foto de Contato, documento 10, 12.5).
- **Fonte** `URL` ou `Integração`: eliminar exige `administrar` na Coleção e é rejeitado enquanto houver Documentos `ativo` ou `arquivado` que a referenciem, salvo escolha explícita no mesmo ato: **manter os Documentos** (passam à Fonte `envio manual`, com Proveniência preservada e Origem da Versão futura `edição`; deixam de ser atualizados) ou **enviá-los à lixeira** (RN-CNH-19). Nunca eliminação silenciosa de Documentos por remoção de Fonte.
- **Movimentação de Documento** entre Coleções do mesmo Espaço de Trabalho (RN-CNH-08): atômica; exige `excluir` na origem e `criar` no destino; permitida só para Documentos de Fonte `envio manual` (passam à `envio manual` do destino); Documentos de Fonte sincronizada não são movidos (seriam recriados pela Atualização seguinte) — usa-se cópia. Versões, Fragmentos, Comentários, Vínculos e Referências acompanham; a permissão passa a ser a do destino; Sujeitos que perdem `ver` deixam de ver, sem evento próprio além de "Documento movido".

### 12.6 Indexação conceitual

Operação do Sistema sobre cada Versão nova: `pendente` → `processado` (Fragmentos criados; evento "Documento processado") ou → `com erro` (evento com causa). Pode incluir a geração de Representações derivadas. Uma mudança de Modelo, de mecanismo ou de política da plataforma pode exigir **regeneração** dos Fragmentos de Versões correntes: é operação do Sistema, sem evento de negócio (apenas Registro de Atividade agregado), sem mudança de Versão, sem efeito sobre permissões, Vínculos ou Referências — Referências a Fragmentos antigos passam a resolver com marcador "Fragmento regenerado" mantendo Versão e Posição (20.14).

### 12.7 Cascata recebida

Eliminação do Espaço de Trabalho elimina tudo (documento 01, 12.4). Remoção do Proprietário: sucessão (B28). Remoção do Membro configurador de Fonte: nada muda na Fonte; o ator delegante das Atualizações passa a ausente (mesmo tratamento de 20.11 do documento 01). Integração `desconectada`: Fontes que a referenciam passam a `com erro` na próxima Atualização (20.6). Eliminação de um Arquivo (se o produto permitir eliminação direta): Versões que o referenciam ficam com Conteúdo inválido; a Versão corrente passa a `com erro` e o evento é registrado — recomendação: a plataforma rejeita eliminar Arquivo referenciado por Versão corrente (questão 25.5).

## 13. Regras de negócio ontológicas

- **RN-CNH-01.** Toda Coleção tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho, definido na criação e alterável por transferência explícita (por Proprietário atual ou Administrador) ou sucessão (B28). Agente nunca é Proprietário (B7).
- **RN-CNH-02.** O nome de uma Coleção é único entre Coleções com estado próprio `ativo` ou `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e espaços nas extremidades; `na lixeira` não reserva nome; criar, renomear ou restaurar com colisão é rejeitado até renomear.
- **RN-CNH-03.** Coleção não contém Coleção. Não existe atributo "Coleção pai" (DO-CNH-03).
- **RN-CNH-04.** Toda Coleção é criada com exatamente uma Fonte `envio manual`, que não pode ser removida, pausada por Ator nem reconfigurada. Fontes `URL` e `Integração` são adicionadas por Ator com `administrar`.
- **RN-CNH-05.** Uma Fonte pertence a exatamente uma Coleção, definida na criação e imutável. Para que a mesma origem externa alimente duas Coleções, configuram-se duas Fontes; os Documentos resultantes são distintos.
- **RN-CNH-06.** Criar Documento exige `criar` na Coleção; editar conteúdo (nova Versão), Metadado, título, arquivar e pedir Atualização exigem `editar`; enviar à lixeira, restaurar e mover exigem `excluir` (mover exige também `criar` no destino); configurar Fontes, Políticas, privacidade, compartilhar, conceder a Agentes e transferir propriedade exigem `administrar`; comentar exige `comentar`; consultar exige `ver`.
- **RN-CNH-07.** Um Documento pertence a exatamente uma Coleção e tem exatamente uma Fonte, da mesma Coleção (DO-CNH-04).
- **RN-CNH-08.** Movimentação de Documento entre Coleções é atômica, restrita a Documentos de Fonte `envio manual`, preserva identidade, Versões, Comentários, Vínculos e Referências, e submete o Documento às permissões da Coleção de destino no mesmo ato. Nunca cruza Espaços de Trabalho (A1.2).
- **RN-CNH-09.** Todo Documento tem Proveniência preenchida na criação, com Fonte, Ator que adicionou e momento; nenhum ato posterior a esvazia. Cada Versão registra a sua Origem da Versão.
- **RN-CNH-10.** Criar um Documento cria a Versão 1 no mesmo ato. Um Documento nunca existe sem Versão nem sem Versão corrente.
- **RN-CNH-11.** Toda Versão tem Conteúdo com texto próprio, Arquivo, ou ambos. Uma Versão sem nenhum dos dois é inválida.
- **RN-CNH-12.** O Conteúdo de uma Versão é imutável. Toda alteração de conteúdo cria Versão nova, que se torna corrente no mesmo ato. Título, Metadado e rótulos alteram-se sem criar Versão.
- **RN-CNH-13.** Só a Versão corrente é consultável (entra em Contexto). Versões superadas existem para auditoria e restauração; suas Referências continuam resolvíveis enquanto a Versão existir.
- **RN-CNH-14.** Restaurar uma Versão anterior é ato humano (Membro com `editar`; Agente só com Ferramenta e aprovação conforme B22) que cria Versão nova com o mesmo Conteúdo e Origem `restauração`; nunca apaga nem reordena o histórico.
- **RN-CNH-15.** A Política de retenção de versões nunca elimina a Versão corrente nem a Versão 1 enquanto for a única; elimina apenas Versões superadas, preservando número, momentos e Origem como registro mínimo para resolução de Referências.
- **RN-CNH-16.** Fragmentos são criados, regenerados e eliminados exclusivamente pelo Sistema, sempre a partir do Conteúdo ou de Representação derivada de uma Versão; nenhum Ator cria ou edita Fragmento; nenhum Fragmento existe sem Versão.
- **RN-CNH-17.** Fragmento e Versão não são Recursos de permissão. Toda avaliação de permissão sobre eles resolve para a Coleção do Documento.
- **RN-CNH-18.** Atualização que não encontra um Documento na origem o arquiva (estado próprio `arquivado`, ator Sistema, "Ausente na origem desde" preenchido) e nunca o envia à lixeira nem o elimina. O Sistema só desarquiva o que o próprio Sistema arquivou por essa causa.
- **RN-CNH-19.** Eliminar uma Fonte com Documentos exige escolha explícita entre manter os Documentos (passam à Fonte `envio manual`) ou enviá-los à lixeira. Não há eliminação silenciosa.
- **RN-CNH-20.** Falha de Indexação conceitual nunca remove, arquiva ou altera o ciclo de vida do Documento: a Versão passa a `com erro`, o Documento permanece visível, comentável e vinculável, e apenas não é consultável até reprocessamento.
- **RN-CNH-21.** Toda Execução de Agente e toda Mensagem de Chat de papel `assistente` que se baseie em Conhecimento registra Referências de Conhecimento com Documento, Versão e Fragmentos. Uma saída "baseada em Conhecimento" sem Referência é inválida.
- **RN-CNH-22.** Referências de Conhecimento nunca são apagadas por eliminação, arquivamento, lixeira, movimentação, retenção de Versão ou regeneração de Fragmento do que citam: passam a resolver com marcador (`Documento na lixeira`, `Documento eliminado`, `Versão eliminada por retenção`, `Fragmento regenerado`, `sem permissão`), preservando identificadores e título à época.
- **RN-CNH-23.** Um Arquivo enviado em uma Sessão de Chat, anexado a uma Mensagem, a um Comentário ou a uma Tarefa não é Documento de Conhecimento. Só o ato "adicionar ao Conhecimento", com `criar` em uma Coleção, o torna base de um Documento (com Proveniência ao registro de origem).
- **RN-CNH-24.** A eliminação permanente de um Documento (ou de uma Versão por retenção) não elimina o Arquivo referenciado se qualquer outro registro do Espaço de Trabalho o referenciar; se nenhum o referenciar, o Arquivo é eliminado no mesmo ato.
- **RN-CNH-25.** Agente cria, edita, move, arquiva ou exclui Documento apenas por Ferramenta, com a permissão requerida na Coleção e, em nome de Membro, na interseção com a permissão do delegante (A9.3); é ação com efeito sob B22 (`assistido`: Solicitação de Aprovação; `supervisionado`: executa por ser reversível — lixeira —, exceto eliminação antecipada, que exige aprovação; `autônomo`: executa). A Proveniência registra o Agente e o delegante.
- **RN-CNH-26.** Documento de tipo de conteúdo não textual sem Representação derivada é consultável apenas por Agentes cujo Modelo suporta o tipo; para os demais, o Documento é reportado ao Agente como indisponível (não como inexistente), sem erro de Execução (20.8).
- **RN-CNH-27.** Toda ação sobre Coleção, Fonte, Documento e Versão gera Registro de Atividade com ator e, quando aplicável, ator delegante (A6.2). Regeneração de Fragmentos gera Registro de Atividade agregado por Versão, não por Fragmento.
- **RN-CNH-28.** Limites impostos (B34) aplicáveis: tamanho de Arquivo por Documento, quantidade de Documentos por Coleção e por Espaço de Trabalho, intervalo mínimo de Atualização, Versões retidas máximas. São verificados no ato (RN-ET-23) e nunca são regras desta entidade.

## 14. Invariantes

- **INV-CNH-01.** Toda Coleção pertence a exatamente um Espaço de Trabalho e tem exatamente um Proprietário, Membro `ativo` ou `suspenso` desse Espaço de Trabalho.
- **INV-CNH-02.** Toda Coleção tem exatamente uma Fonte `envio manual`.
- **INV-CNH-03.** Todo Documento tem exatamente uma Coleção e exatamente uma Fonte, e a Fonte pertence à mesma Coleção.
- **INV-CNH-04.** Toda Versão tem Conteúdo com texto próprio ou Arquivo (ou ambos).
- **INV-CNH-05.** Todo Documento tem Proveniência com Fonte, Ator que adicionou e momento de adição.
- **INV-CNH-06.** Todo Documento tem ao menos uma Versão e exatamente uma Versão corrente; números de Versão são únicos por Documento e nunca reutilizados; a Versão corrente nunca é eliminada por retenção.
- **INV-CNH-07.** O Conteúdo da Versão corrente é compatível com o Tipo de conteúdo do Documento.
- **INV-CNH-08.** Comentários, Descrição de Coleção, Metadado (exceto o que a plataforma declarar consultável, como resumo) e Registros de Atividade nunca geram Fragmentos nem entram em Contexto como Conhecimento.
- **INV-CNH-09.** Nenhum Fragmento de Documento sobre o qual o Sujeito efetivo da Execução não tem `ver` (Agente ∩ delegante, ou só Agente se autônomo; estado efetivo `ativo`; Versão corrente `processado`) entra no Contexto de qualquer Execução ou Sessão de Chat.
- **INV-CNH-10.** Fragmento e Versão nunca têm permissão própria; a permissão efetiva sobre eles é a da Coleção do Documento.
- **INV-CNH-11.** Todo Fragmento referencia exatamente uma Versão existente e uma Posição dentro dela.
- **INV-CNH-12.** Nenhum Documento ou Versão é criado sem ato de um Ator com permissão `criar`/`editar` na Coleção registrado com Proveniência: Memória de Agente ou de Usuário, histórico de Sessão, resultado de Execução ou conteúdo de Conversa nunca se tornam Conhecimento por inferência ou automaticamente. (Exceção única, e explícita: Atualização de Fonte configurada por um Membro, que é o ato humano prévio.)
- **INV-CNH-13.** Nenhuma Coleção, Fonte, Documento, Versão, Fragmento, concessão ou Referência atravessa a fronteira de um Espaço de Trabalho (A1.2; INV-ET-07). Uma Fonte `Integração` só referencia Integração do mesmo Espaço de Trabalho.
- **INV-CNH-14.** Um Documento com estado efetivo `arquivado` ou `na lixeira`, ou cuja Versão corrente não está `processado`, nunca entra em Contexto.
- **INV-CNH-15.** Toda Referência de Conhecimento gravada continua a existir enquanto existir a Execução ou a Mensagem de Chat que a contém, independentemente do destino do que cita.
- **INV-CNH-16.** Nenhuma entidade desta camada é Ator, Sujeito de permissão ou Responsável.

## 15. Personalização

**Personalizável (por quem tem `administrar` na Coleção, salvo indicação):**

- Nome, descrição, Proprietário (transferência), privacidade, Política de retenção de versões da Coleção.
- Fontes `URL` e `Integração`: configuração, Política de atualização, estado `ativo`/`pausado`.
- Concessões a Membros, Equipes e Agentes; compartilhamentos.
- Por Documento (`editar`): título, Metadado (autor original, idioma, data do conteúdo, rótulos, resumo), Tipo de conteúdo (com Versão compatível), Vínculos.

**Não personalizável:**

- Identidade, Criador, momentos, Proveniência, Origem das Versões.
- Estados e transições (ciclo de vida, Fonte, processamento).
- A Fonte `envio manual` (existência, nome, estado).
- O modo como Fragmentos são gerados; a Posição; a Representação derivada (regenerável pelo Sistema, não editável — uma transcrição corrigida à mão é **texto próprio** de uma Versão nova, não Representação derivada).
- Limites impostos.

Não há Campos Personalizados sobre Coleção ou Documento nesta versão (A5.2 não os lista). Necessidades de classificação usam rótulos do Metadado; classificação compartilhada com Tarefas e Negócios é a proposta de Tags (DO-CNH-06). Não há Conjunto de Status, Tipo de Documento configurável nem Templates de Coleção/Documento nesta versão (25.3).

## 16. Herança

A camada de Conhecimento tem **um único aspecto herdado**: a **permissão**, da Coleção para os seus Documentos, Versões e Fragmentos (seção 17). Não há ponto de definição, modo de herança nem bloqueio (B25 não se aplica): a Coleção não é nível da Estrutura de Trabalho e não define Status, Campos, Tipos, Automações ou Visualizações.

Herança de **estado** é por derivação (DO-CNH-09): o estado efetivo do Documento deriva do estado próprio da Coleção, sem gravar nos Documentos, com restauração ao estado próprio (B36 por analogia). A Fonte não tem estado de ciclo de vida próprio: segue a Coleção.

Nada é herdado **do** Espaço de Trabalho além de escopo (pertencimento), Localidade (idioma padrão como sugestão de Metadado; fuso para momentos), Política de lixeira e Limites. Nada é herdado **de** Agente ou de Habilidade: a concessão de uma Coleção a um Agente não é herdada por Agentes criados a partir de Template de Agente, salvo se o Template a declarar — decisão do documento de Agentes.

Automações com escopo em Coleção não existem nesta versão (B41 lista os escopos: Espaço de Trabalho, Espaço, Pasta, Subpasta, Lista, Funil, Caixa de Entrada, Fila); eventos desta camada são Gatilhos disponíveis em escopo Espaço de Trabalho (25.4).

## 17. Permissões e visibilidade

### 17.1 A Coleção como Recurso

A Coleção é o **único Recurso de permissão** desta camada. Tupla (Sujeito, Ação, Recurso = Coleção, Escopo, Origem) (A9.1).

| Ação | Sobre a Coleção significa |
| --- | --- |
| ver | Ver a Coleção (nome, descrição, Fontes, Documentos, Versões, Metadados, Proveniência, Comentários, histórico); **consultar** (o Fragmento entra em Contexto). Ver Vínculos cujo outro lado também vê. |
| comentar | Criar Comentários e respostas em Documentos; editar e excluir os próprios. |
| criar | Adicionar Documentos (envio manual, cópia para cá, "adicionar ao Conhecimento"). |
| editar | Criar Versões (editar conteúdo, substituir Arquivo, restaurar Versão), editar título e Metadado, criar e remover Vínculos (exige `ver` no outro lado), arquivar e desarquivar Documentos, pedir Atualização, pedir reprocessamento. |
| excluir | Enviar Documentos à lixeira e restaurar; mover Documentos para outra Coleção (com `criar` no destino); enviar a Coleção à lixeira e restaurá-la. |
| administrar | Renomear e descrever a Coleção; configurar Fontes e Políticas; arquivar e desarquivar a Coleção; tornar privada; compartilhar; conceder e revogar permissões a Membros, Equipes e Agentes; transferir propriedade; eliminar antecipadamente; editar ou excluir Comentários de terceiros. |
| executar | Não se aplica. |

**Escopo.** `registro` é o único escopo com significado sobre Coleção: a permissão alcança a Coleção **e todos os seus Documentos, Versões e Fragmentos** (herança, RN-CNH-17). Não existe `subárvore` (não há descendentes estruturais além dos Documentos, já alcançados). `próprios` (B29) aplica-se ao tipo Coleção: "só as Coleções em que o Sujeito é Proprietário ou Criador" — mecanismo de restrição por Papel personalizado ("consultor vê só as suas Coleções").

**Origem.** Papel no Espaço de Trabalho (padrão recomendado: Papel Membro tem `ver`, `comentar` e `criar` sobre Coleções não privadas — recomendação de produto, ajustável; Administrador e Proprietário do Espaço de Trabalho têm `administrar` sobre Coleções não privadas; Convidado, nada por Papel), concessão direta (a Membro, Equipe ou Agente), compartilhamento (a Membro ou Equipe, tipicamente Convidados). O Proprietário da Coleção tem `administrar` por ser Proprietário (origem: propriedade, avaliada como concessão implícita; nunca revogável enquanto for Proprietário).

### 17.2 Coleção privada

Uma Coleção `privada` interrompe as origens "papel" e "herança": só Proprietário, concessões diretas e compartilhamentos contam — inclusive contra Administradores e Proprietário do Espaço de Trabalho (mesmo princípio de B38a). Administradores entram apenas por ato de governança registrado, com motivo, visível a quem tem acesso à Coleção (B38b, por analogia — DO-CNH-11). Diferença em relação aos contêineres estruturais: a Coleção tem Proprietário, então nunca fica sem Membro com `administrar` (INV-CNH-01 + sucessão B28); por isso B38c e B38d não precisam de regra própria aqui. Só Membro `ativo` sem base Convidado torna uma Coleção privada; Agentes não o fazem (B46, por analogia).

**Documento não é Recurso de restrição nem de ampliação nesta versão** (DO-CNH-10): não pode ser privado, não recebe concessão nem compartilhamento individual. Quem vê a Coleção vê todos os seus Documentos. Justificativa: a Coleção é a unidade de concessão a Agentes; permissão por Documento faria "Agente tem acesso à Coleção" significar "a parte da Coleção que ele pode ver", e a avaliação por Fragmento (INV-CNH-09) passaria a depender de dois níveis. Quem precisa de confidencialidade por Documento cria uma Coleção. Compartilhar um Documento individual é questão 25.2.

### 17.3 Agentes

"Agente tem acesso à Coleção" é uma **concessão direta** de `ver` (para consultar) — e, quando o produto o exigir, de `criar`/`editar` (para adicionar ou versionar) — ao Agente como Sujeito, feita por quem tem `administrar` na Coleção. É atributo da Coleção (a concessão vive no Recurso), não do Agente; o documento de Agentes exibe "Conhecimento acessível" como visão derivada das concessões. Um Agente pode ter Papel (Glossário) e obter `ver` por ele sobre Coleções não privadas, se o Papel o conceder.

**Permissão efetiva na consulta** (A9.3, B19): em nome de um Membro, **interseção** — só Coleções em que Agente **e** Membro têm `ver`; autônomo (Automação, agendamento), só as do Agente. Avaliada a cada invocação da Ferramenta "consultar Conhecimento" (B23), não no início da Execução: revogar uma concessão durante a Execução faz a próxima consulta não retornar Fragmentos daquela Coleção; Fragmentos já no Contexto permanecem (20.1). A Ferramenta nunca retorna Fragmento de Documento que o Sujeito efetivo não pode ver (INV-CNH-09) e nunca revela a existência de Coleções sem `ver`.

**Escrita por Agente**: RN-CNH-25. Um Agente com `criar` em uma Coleção e Ferramenta "adicionar ao Conhecimento" pode criar Documentos a partir de uma Conversa, de uma Sessão ou de um resultado de Execução; a Proveniência registra Agente, delegante e registro de origem; B22 governa a aprovação.

### 17.4 Integração e Sistema

A Integração age como Ator nas Atualizações da Fonte que a referencia, com o Membro configurador como delegante (documento 01, 7.4); não é Sujeito da tupla — cria Documentos na Coleção da Fonte por força da configuração feita por quem tinha `administrar`. Sistema age para Indexação conceitual, retenção, arquivamento por ausência na origem e eliminação por prazo.

### 17.5 IA sujeita às mesmas regras

Não há atalho: o Assistente padrão (B33) não tem acesso a nenhuma Coleção sem concessão; um Agente com `ver` em "Políticas de RH" respondendo a um Convidado sem acesso a ela não usa essa Coleção (20.3); Painéis sobre Conhecimento filtram pelo visualizador (B20). Compartilhamento público de Documento não existe.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Coleção criada / renomeada / descrição alterada | 12.1; edição | Coleção, Proprietário, ator | Auditoria; Agentes (catálogo de Coleções consultáveis) |
| Propriedade da Coleção transferida | RN-CNH-01; sucessão B28 | antigo e novo Proprietário, ator, causa | Auditoria; notificação |
| Coleção tornada privada / pública; permissão concedida / revogada; Coleção compartilhada / compartilhamento revogado | 17.1–17.2 | Sujeito, ação, ator | Auditoria; Execuções em curso (B23) |
| Concessão a Agente criada / revogada | 17.3 | Agente, ação, ator, causa (ato, eliminação da Coleção) | Documento de Agentes ("Conhecimento acessível"); Execuções em curso |
| Coleção arquivada / desarquivada / excluída / restaurada / eliminada | 12.5 | ator, quantidade de Documentos, Fontes pausadas/reativadas | Agentes; Painéis; Fontes; Referências |
| Fonte adicionada / reconfigurada / pausada / reativada / eliminada | 12.5; 11.2 | Fonte, tipo, configuração (sem credenciais), ator; na eliminação, destino dos Documentos | Auditoria; Integrações |
| Fonte com erro | Atualização falha | Fonte, causa, momento | Notificação ao Proprietário e ao Membro configurador; Painéis |
| Atualização iniciada / concluída | 12.4 | Fonte, ator (Sistema/Integração, delegante), Documentos criados / versionados / arquivados por ausência / inalterados | Auditoria; Painéis; notificação |
| Documento criado | 12.2 | Documento, Coleção, Fonte, tipo, caminho (envio, Atualização, cópia), Proveniência, ator | Auditoria; Automações (Gatilho em escopo Espaço de Trabalho); Vínculo opcional |
| Versão criada | 12.3 | Documento, número, Origem da Versão, ator | Auditoria; Sessões ancoradas (aviso de conteúdo novo); Painéis |
| Documento processado / com erro de processamento | 12.6 | Documento, Versão, causa | Agentes (passa a consultável); notificação ao ator que criou a Versão |
| Documento atualizado (título, Metadado, Tipo) | edição | atributo, antes, depois, ator | Auditoria |
| Documento movido | 12.5 | Coleção origem/destino, ator | Auditoria; reavaliação de Sessões ancoradas |
| Documento arquivado / desarquivado | 12.5; RN-CNH-18 | ator (Membro ou Sistema), causa (`ato`, `ausente na origem`, `reapareceu na origem`) | Curadoria (notificação ao Proprietário); Agentes |
| Documento excluído (lixeira) / restaurado / eliminado | 12.5 | ator, Coleção | Vínculos; âncoras; Referências (marcador); Arquivos (RN-CNH-24) |
| Versão eliminada por retenção | 12.3 | Documento, número | Referências (marcador) |
| Fragmentos regenerados | 12.6 | Versão, causa, quantidade | Referências (marcador); nenhum consumidor de negócio |
| Comentário adicionado / editado / excluído / resolvido | 7.6 | Documento, autor, menções, trecho | Notificação; auditoria |
| Vínculo criado / removido | 8 | tipo, outro registro, ator | Outro domínio; Painéis |
| Conhecimento consultado | Cada invocação da Ferramenta "consultar Conhecimento" com resultado | Execução, Sujeito efetivo (Agente, delegante), Coleções consultadas, Referências de Conhecimento retornadas, Documentos indisponíveis por tipo (RN-CNH-26) | Auditoria; Painéis ("Documentos mais consultados", "consultas sem resultado"); custo (C8) |
| Limite atingido | RN-CNH-28 | limite, valor, ator | Notificação; plataforma |

Todos geram Registro de Atividade com a Coleção ou o Documento como objeto (Versão e Fragmento como componentes, com o Documento como raiz) e ator delegante quando aplicável (A6.2). "Conhecimento consultado" é registrado na Execução, com a Coleção como objeto secundário.

## 19. Dependências

**A camada depende de** (precisam existir antes ou fora):

- **Espaço de Trabalho** (01): pertencimento, Proprietário e sucessão (B28), Papéis e modelo de permissão (A9, B29, B30, B38), Política de lixeira, Localidade, Limites impostos (B34), Integrações e Membro configurador (B35).
- **Membro**: Proprietário, Criador, Membro configurador, Sujeitos.
- **Arquivo** (A8): base de Versões de conteúdo não textual.
- **Integração** (01, 7.4): Fontes `Integração`.
- **Agente, Ferramenta, Execução, Contexto** (documentos 17–18): a Ferramenta "consultar Conhecimento", a gravação de Referências de Conhecimento na Execução e a montagem do Contexto.
- **Modelo** (global, A1.3): capacidades por tipo de conteúdo, para RN-CNH-26.
- **Plataforma**: catálogo de Tipos de conteúdo, tetos de Políticas, Limites.

**Dependem da camada**: Referências de Conhecimento em Execuções e Mensagens de Chat (resolvem com marcador quando o citado desaparece); Sessões de Chat ancoradas a Documento (B21); Vínculos de Tarefa, Negócio, Contato e Empresa com Documento; Widgets de Painel com Fonte de Dados em Coleção; Habilidades que declaram requerer a Ferramenta "consultar Conhecimento" (não uma Coleção específica — a Coleção é concedida ao Agente, não à Habilidade).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) — confirma "Coleção" na lista de propriedades sucedidas (DO-ET-04) e em 20.13; Tarefa (06) — Vínculo Tarefa–Documento (DO-TAR-08) e menções (DO-TAR-19); Contatos (10) e Empresas (11) — recebem os Vínculos Documento–Contato e Documento–Empresa (DO-CNH-07) e a pendência LGPD (25.6); Negócios (12) — Vínculo já previsto; Caixa de Entrada (14) — recebe RN-CNH-23 (Arquivo de Mensagem não é Documento) e a resposta à sua questão 9 (transcrição de Anexo não é Fragmento de Conhecimento: Conversas não são Conhecimento, B19; "adicionar ao Conhecimento" é o único caminho); IA — visão geral (15), Chat (16), Agentes (17), Habilidades (18), Automações (19) — recebem a Ferramenta "consultar Conhecimento", a Referência de Conhecimento, a concessão de Coleção como visão derivada "Conhecimento acessível", RN-CNH-25 e os Gatilhos da seção 18; Painéis (21) — recebem "Conhecimento consultado" como Fonte de Dados derivada.

## 20. Casos limítrofes e ambiguidades

### 20.1 Documento removido enquanto um Agente o consulta

A Execução já invocou "consultar Conhecimento" e recebeu Fragmentos da Versão 3 do Documento D; em seguida, um Membro envia D à lixeira. O Contexto é objeto de valor efêmero já montado: a Execução **termina** com o que tem (B23 avalia permissão por Ferramenta, e a Ferramenta já retornou). A próxima invocação, na mesma ou em outra Execução, não encontra D (estado efetivo `na lixeira`, INV-CNH-14). A saída da Execução grava a Referência de Conhecimento (D, Versão 3, Fragmentos); ao ser exibida, resolve com marcador `Documento na lixeira` e, após eliminação, `Documento eliminado`, preservando identificador e título à época (RN-CNH-22). A resposta não é invalidada retroativamente: baseou-se no que era Conhecimento no momento — é isso que a auditoria precisa saber.

### 20.2 Documento presente em duas Coleções

Não é permitido (DO-CNH-04; INV-CNH-03). Alternativas, todas explícitas: (a) **cópia** com Proveniência "copiado de" — dois Documentos, evolução independente, cada um sob a permissão da sua Coleção; (b) **Vínculo Documento–Documento** "relacionado a" (DO-CNH-07) — o Documento continua em uma só Coleção e o Vínculo é visível a quem vê ambos; (c) **conceder ao Agente as duas Coleções**. Justificativa: um Documento em duas Coleções teria permissão efetiva ambígua (união amplia acesso silenciosamente; interseção esconde de quem tem uma das Coleções) e uma Atualização de Fonte não saberia a qual Coleção obedecer.

### 20.3 Agente com acesso à Coleção A respondendo a Membro sem acesso a A

Interseção (A9.3; B19): a consulta em nome do Membro não inclui A. Os Fragmentos de A nunca entram no Contexto (INV-CNH-09), a resposta não os cita e a Ferramenta não revela que A existe. Se o mesmo Agente rodar autônomo (por Automação), usa A. Um Agente não é canal de vazamento: "o Agente sabe" não significa "o Membro pode saber".

### 20.4 Coleção cujo Proprietário é removido

Sucessão no mesmo ato (B28; RN-ET-09a): a Coleção passa ao Sucessor, com Registro de Atividade próprio; concessões diretas do removido são revogadas; Fontes que ele configurou permanecem, com delegante ausente. Se a Coleção é privada e o removido era o único com acesso, o Sucessor (que é Proprietário) tem `administrar` por propriedade: a Coleção nunca fica inacessível. Membro `suspenso` continua Proprietário (INV-ET-03), sem agir; transferências passam a exigir Administrador.

### 20.5 Fonte URL que muda de conteúdo

A Atualização detecta diferença e cria Versão nova (12.4), com Origem `Atualização` e marca de versão da origem; a anterior fica superada e é retida pela Política de retenção. Referências de Execuções antigas continuam a apontar para a Versão antiga (RN-CNH-13, RN-CNH-22). Se a página mudou de assunto por completo, é ainda o mesmo Documento (a identidade é o endereço na origem, não o assunto); o curador pode arquivá-lo e criar outro. Se a página passou a exigir autenticação ou desapareceu, o Documento é arquivado pelo Sistema com "Ausente na origem desde" (RN-CNH-18), nunca eliminado.

### 20.6 Fonte Integração desconectada

A Integração passa a `desconectada` (documento 01, 11.3); a próxima Atualização falha; a Fonte passa a `com erro` com evento; **os Documentos permanecem** `ativo` e consultáveis — o conteúdo já curado não deixa de ser verdade porque a conexão caiu. O atributo derivado Desatualizado passa a verdadeiro e é exibido a Membros e informado ao Agente na consulta (o produto decide se o Agente cita "possivelmente desatualizado"). Reconectar a Integração e atualizar devolve a Fonte a `ativo`.

### 20.7 Arquivo de 2 GB de vídeo

Não há regra ontológica sobre tamanho: é Limite imposto (B34; RN-CNH-28), verificado no ato de criação do Documento (RN-ET-23). Se aceito, o Documento é de tipo `vídeo`, a Versão referencia o Arquivo, a Indexação pode gerar Representação derivada (transcrição) e Fragmentos com Posição em intervalos de tempo; se a Indexação falhar por limite, Versão `com erro`, Documento preservado (RN-CNH-20).

### 20.8 Documento em áudio consultado por Agente cujo Modelo não entende áudio

Se a Versão corrente tem Representação derivada (transcrição), os Fragmentos dela são consultáveis por qualquer Modelo: o Agente consulta e cita (Posição em intervalo de tempo). Se não tem, o Documento é **indisponível** para esse Agente (RN-CNH-26): a Ferramenta o informa como "existe, não consultável por tipo", a Execução não falha e o evento "Conhecimento consultado" registra a indisponibilidade. A compatibilidade é verificada contra as capacidades declaradas do Modelo (entidade global); nenhuma infraestrutura é descrita. Um Agente cujo Modelo entende áudio consulta o Conteúdo diretamente.

### 20.9 Membro tentando adicionar Documento a Coleção onde só pode ver

Negado (RN-CNH-06): `criar` é necessário. O mesmo vale para Agente em nome dele, mesmo que o Agente tenha `criar` (interseção). Um Convidado com compartilhamento `comentar` pode comentar e não pode adicionar.

### 20.10 Documento contendo dados pessoais de Contato

Um Documento pode conter dados pessoais (transcrição de reunião, proposta com nome e CPF). A eliminação do Contato — por prazo ou por solicitação do titular (documento 10, 12.5) — **não alcança automaticamente Documentos de Conhecimento**: o Documento não é parte do agregado do Contato, e a plataforma não inspeciona conteúdo para decidir eliminação. Recomendação (DO-CNH-13): (a) o evento "Contato eliminado permanentemente" passa a ter como consumidor a camada de Conhecimento, que marca para **revisão de curadoria** todo Documento com Vínculo ao Contato eliminado (o Vínculo é removido, como todos; a marca é derivada do Registro de Atividade); (b) o produto orienta a criar Vínculo Documento–Contato ao adicionar conteúdo que trate de um Contato; (c) o que fazer com Documentos sem Vínculo é decisão jurídica registrada em C9 (25.6). Nunca eliminação automática: destruir conhecimento curado por inferência é dano irreversível.

### 20.11 Conhecimento compartilhado entre Espaços de Trabalho

Proibido (A1.2; INV-CNH-13; C1). Uma holding com duas empresas que queiram o mesmo manual mantém dois Documentos, um em cada Espaço de Trabalho, sem ligação. Uma Fonte URL apontando para uma página pública é conteúdo externo, não compartilhamento entre Espaços de Trabalho — mesmo que a página seja publicada por outra organização que também use a plataforma.

### 20.12 Agente criando Documento de Conhecimento a partir de uma Conversa

Permitido apenas por Ferramenta "adicionar ao Conhecimento", com `criar` na Coleção de destino e `ver` na Conversa, na interseção com o delegante (RN-CNH-25). Sob B22: `assistido` gera Solicitação de Aprovação; `supervisionado` executa (criar Documento é reversível pela lixeira); `autônomo` executa. A Proveniência registra a Conversa, o Agente e o delegante; não há Vínculo Documento–Conversa. Recomendação de produto, não regra: dado o risco de dados pessoais (20.10), a Coleção pode exigir aprovação para escrita de Agente independentemente do nível — se adotado, é configuração da Coleção (25.7). O Agente **nunca** cria Documento por conta própria a partir de Memória ou de "ter aprendido" (INV-CNH-12).

### 20.13 Fragmentos regenerados após mudança de Modelo

Operação do Sistema (12.6) sem efeito ontológico: mesmas Versões, mesmos Documentos, mesmas permissões, mesmos Vínculos. Referências antigas passam a resolver com marcador `Fragmento regenerado`, mantendo Documento, Versão e Posição — a Posição é o que permite reencontrar o trecho. Nenhum evento de negócio; Registro de Atividade agregado por Versão.

### 20.14 Versão corrente restaurada para anterior

Ato humano (RN-CNH-14): cria Versão N+1 igual à Versão escolhida, com Origem `restauração`. A Versão N (a que estava corrente) fica superada e retida por política; Referências a N continuam válidas. Não existe "voltar o ponteiro": apagaria o fato de que N foi corrente por um período e foi consultada.

### 20.15 Fonte reconfigurada para outra origem

Trocar a URL de uma Fonte ou o repositório de uma Fonte `Integração` é reconfiguração (mesma identidade). Na Atualização seguinte, tudo o que existia na origem antiga e não existe na nova é arquivado com "Ausente na origem desde" (RN-CNH-18); o que existe na nova é criado. O curador que quer descartar o antigo os envia à lixeira em lote. Alternativa mais limpa, recomendada pelo produto: eliminar a Fonte antiga (RN-CNH-19) e criar outra.

### 20.16 Arquivo enviado em Sessão de Chat versus Documento de Conhecimento

Um Membro envia um PDF em uma Sessão de Chat. É **Contexto da Sessão** (Glossário: Sessão tem Arquivos; Contexto reúne Arquivos): pessoal, não versionado, não curado, sem Proveniência de curadoria, visível só ao Membro. Não é Documento (RN-CNH-23). Se o Membro (ou o Agente, por Ferramenta e permissão) executa "adicionar ao Conhecimento" indicando uma Coleção, nasce um Documento cuja Versão 1 referencia **o mesmo Arquivo** e cuja Proveniência aponta à Sessão. O Arquivo passa a ser referenciado por dois registros (A8).

### 20.17 O mesmo Arquivo anexado a uma Tarefa e base de um Documento

Válido e frequente: a proposta anexada à Tarefa "Enviar proposta" é a mesma que serve de base ao Documento "Modelo de proposta". São dois registros com finalidades distintas referenciando um binário. Remover o Anexo da Tarefa não afeta o Documento; eliminar o Documento não elimina o Arquivo enquanto a Tarefa o anexar (RN-CNH-24). Substituir o Arquivo no Documento cria Versão; a Tarefa continua a anexar o antigo.

### 20.18 Coleção arquivada com Fonte `periódica`

A Fonte é pausada pelo Sistema; nenhuma Atualização ocorre; nada é enfileirado; ao restaurar, a Fonte volta a `ativo` e a próxima Atualização ocorre no próximo intervalo — ocorrências perdidas não são executadas retroativamente (mesmo princípio de B31).

### 20.19 Documento colaborativo (D1) e Conhecimento

Quando D1 existir, um Documento colaborativo é artefato de trabalho na Estrutura de Trabalho, editável, sem Coleção. Publicá-lo em uma Coleção cria um Documento de Conhecimento com Origem `publicação` e Proveniência ao Documento colaborativo e à sua versão à época; edições posteriores no colaborativo não alteram o Documento de Conhecimento até nova publicação (nova Versão). Não é o mesmo registro: o colaborativo é rascunho vivo; o Documento de Conhecimento é o que foi publicado.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Arquivo (o binário) | Espaço de Trabalho | A8. A Versão referencia. |
| Integração e credenciais | Espaço de Trabalho | B35; documento 01, 7.4. A Fonte referencia. |
| Tarefas, Contatos, Empresas, Negócios, Conversas, Mensagens | Seus domínios | B19. Nunca são Conhecimento; Vínculo ou Proveniência apenas. |
| Memória do Agente / do Usuário | Agente / Membro | Glossário; INV-CNH-12. |
| Contexto; Arquivos de Sessão de Chat | Execução / Sessão de Chat | Efêmero e pessoal (B21). RN-CNH-23. |
| Ferramenta "consultar Conhecimento" e "adicionar ao Conhecimento" | Catálogo de Ferramentas da plataforma (B16) | Operações expostas a Agentes; o Conhecimento é o Recurso, não a Ferramenta. |
| Concessão de Coleção a Agente | Coleção (o Recurso) | A9.1: a concessão vive no Recurso; "Conhecimento acessível" do Agente é visão derivada. |
| Execuções que consultaram; Referências de Conhecimento | Agente (Execução) / Sessão (Mensagem de Chat) | B18; 7.7. O Documento é citado; não contém a citação. |
| Capacidades do Modelo por tipo de conteúdo | Modelo (global) | A1.3. Verificadas, não contidas. |
| "Documentos mais consultados", "consultas sem resultado" | Painel (derivado de Execuções) | Não são atributos do Documento. |
| Tags (definição) | Espaço de Trabalho | B5. Aplicação a Documento é proposta (DO-CNH-06). |
| Sessão de Chat ancorada a Documento | Membro | B21. |
| Solicitação de Aprovação para escrita de Agente | Agente / Automação solicitante | A8. O objeto é o Documento; o pedido não é dele. |
| Comentários (como Conteúdo) | Documento (agregado), mas fora do Conteúdo | INV-CNH-08: nunca são Conhecimento. |
| Transcrição de Anexo de Mensagem | Mensagem (Anexo) | Documento 14, 7.11. Não é Fragmento (B19). |
| Documento colaborativo | D1 (futuro), Estrutura de Trabalho | 20.19. |
| Fonte interna (registros → corpus) | D5 (futuro) | B19. |
| Mecanismo de recuperação, índices, representações | Infraestrutura | Fora da ontologia. |
| Notificações | Fora da ontologia | Eventos são da entidade; entrega é produto. |

## 22. Exemplos conceituais

**Exemplo 1 — Políticas de atendimento.** A Administradora Maria cria a Coleção "Políticas de atendimento" (Proprietária: Maria). Adiciona por envio manual o PDF "Política de trocas v2024" (Documento, tipo `PDF`, Versão 1, Proveniência: envio manual, Maria, Arquivo X) e o texto "Horário de atendimento" (tipo `texto`, texto próprio). Concede `ver` ao Agente "Atendente". Um cliente pergunta pelo WhatsApp sobre trocas; a Automação da Fila invoca o Agente, que roda autônomo, consulta a Coleção (só as próprias permissões), recebe Fragmentos da Versão 1 do PDF (Posição: página 3) e responde; a Execução grava a Referência de Conhecimento. Em março, Maria substitui o PDF: Versão 2 `pendente` → `processado`; a Versão 1 fica superada. Uma auditoria em abril pergunta em que a resposta de fevereiro se baseou: Referência → Versão 1, página 3, ainda retida.

**Exemplo 2 — Site institucional como Fonte.** Pedro (`administrar` na Coleção "Site") adiciona a Fonte `URL` "https://exemplo.com.br/ajuda" (site, `periódica`, diária). A primeira Atualização cria 40 Documentos de tipo `página web`, Proveniência: Fonte "Site", endereço de cada página, ator Sistema, delegante Pedro. Uma página é removida do site: o Documento é arquivado pelo Sistema com "Ausente na origem desde"; Pedro recebe notificação e decide enviá-lo à lixeira. Outra página muda: Versão nova. O provedor do site cai por um dia: Fonte `com erro`, 39 Documentos continuam consultáveis, com Desatualizado verdadeiro.

**Exemplo 3 — Interseção de permissão.** A Coleção "Salários e benefícios" é privada; só o RH tem `ver`. O Agente "Assistente de RH" tem concessão `ver` nela. Ana (Papel Membro, sem acesso) pergunta ao Agente, em uma Sessão de Chat, "qual o teto do vale-alimentação?". A consulta em nome de Ana não inclui a Coleção; o Agente responde que não tem essa informação. A mesma pergunta, feita por Carla (RH), é respondida com Referência de Conhecimento.

**Exemplo 4 — Áudio e Modelo.** O Documento "Treinamento de vendas — gravação" (tipo `áudio`, Arquivo de 90 minutos) tem Representação derivada (transcrição gerada pelo Sistema). O Agente "Coach", cujo Modelo não processa áudio, consulta pela transcrição e cita "minuto 42–44". O Agente "Analista", cujo Modelo processa áudio, consulta o Conteúdo diretamente. Se a transcrição não existisse, "Coach" veria o Documento como indisponível.

**Exemplo 5 — Da Conversa ao Conhecimento.** Em uma Conversa, o cliente explica um procedimento de integração que a equipe não documentava. O Atendente pede ao Assistente padrão (`supervisionado`, com `criar` na Coleção "Base técnica") que "adicione isso ao Conhecimento". A Ferramenta cria o Documento "Procedimento de integração — relato do cliente" com Proveniência à Conversa, Agente e delegante (o Atendente); o Atendente, ciente de que o relato cita o nome do cliente, cria Vínculo Documento–Contato. Meses depois o cliente pede eliminação de dados: o Contato é eliminado, o Vínculo é removido e o Documento aparece na revisão de curadoria do Proprietário da Coleção, que o edita (Versão nova, sem o nome).

## 23. Representação gráfica textual

```
PLATAFORMA (fora da ontologia)
└── Modelo (capacidades por tipo de conteúdo — verificadas, não contidas)

ESPAÇO DE TRABALHO
├── Arquivo (0..N) ◄────────────────────────── referenciado por Versão (0..1 por Versão)
├── Integração (0..N) ◄──────────────────────── referenciada por Fonte `Integração`
├── Membro ── Proprietário (1 por Coleção); Membro configurador (0..1 por Fonte)
├── Agente ── concessão `ver` [`criar`, `editar`] sobre Coleção (permissão; N:N)
│
└── IA › CONHECIMENTO (camada, não entidade)
    └── COLEÇÃO (0..N)  [Proprietário 1; nome único; privada?; Política de retenção;
        │                estado próprio: ativo | arquivado | na lixeira; sem aninhamento]
        │
        ├── FONTE (1..N; contenção)
        │   ├── `envio manual` (exatamente 1; implícita; sempre ativa)
        │   ├── `URL` (0..N)         [configuração; Política de atualização; Membro configurador;
        │   └── `Integração` (0..N)   estado: ativo | pausado | com erro; marca de versão da origem]
        │
        └── DOCUMENTO DE CONHECIMENTO (0..N; contenção)  [1 Coleção; 1 Fonte da mesma Coleção;
            │   título; tipo de conteúdo; estado próprio + estado efetivo (derivado da Coleção);
            │   estado de processamento (derivado da Versão corrente); Ausente na origem desde;
            │   Desatualizado (derivado); Criador]
            │
            ├── Proveniência (1; objeto de valor; obrigatória)
            ├── Metadado (0..1; autor original, idioma, data do conteúdo, rótulos, resumo)
            │
            ├── VERSÃO (1..N; contenção; imutável)  [número; Origem da Versão;
            │   │   estado de processamento: pendente | processado | com erro; uma corrente]
            │   ├── Conteúdo (1): texto próprio e/ou → Arquivo (0..1)
            │   ├── Representação derivada (0..N; regenerável; Ator gerador)
            │   └── FRAGMENTO (0..N; derivado; regenerável)  [Identificador local; Posição;
            │                                                  sem permissão, estado ou evento próprios]
            │
            ├── Comentário (0..N) ── resposta (um nível) ── Anexo → Arquivo   [nunca Conteúdo]
            │
            ├── Vínculo ↔ Tarefa | Negócio | Contato | Empresa | Documento   (associação; 0..N)
            │
            └── Referenciado por (o Documento não os contém)
                ├── Execução de Agente / Mensagem de Chat ── Referência de Conhecimento
                │     (Documento + Versão + Fragmentos + Coleção; sobrevive com marcador)
                ├── Sessão de Chat (âncora, B21)
                ├── Registro de Atividade (histórico = visão)
                └── Painel (Fonte de Dados derivada das Execuções)

Operações do Sistema/Integração: Atualização (Fonte → Documentos/Versões; ausente → arquivado)
                                 Indexação conceitual (Versão pendente → processado | com erro)
Permissão: Coleção é o único Recurso; Documento, Versão e Fragmento herdam. Agente: concessão ∩ delegante.
Nenhuma aresta atravessa a fronteira do Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-CNH-01.** Conhecimento é camada, não entidade. As entidades são Coleção, Fonte, Documento de Conhecimento, Versão de Documento e Fragmento; Conteúdo, Representação derivada, Metadado, Proveniência, Políticas e Referência de Conhecimento são objetos de valor; Atualização e Indexação conceitual são operações. Registros operacionais não são Conhecimento. Aplica A2.3, A2.5 e B19. CONSOLIDADA.
- **DO-CNH-02.** Não existe Coleção padrão nem obrigatória: um Espaço de Trabalho nasce sem Coleções (0..N, documento 01), e "adicionar ao Conhecimento" exige indicar uma Coleção existente. Justificativa: uma Coleção padrão receberia tudo o que ninguém classificou, e "tudo" com uma só permissão é o oposto de curadoria. RECOMENDADA.
- **DO-CNH-03.** Coleção não se aninha: nem hierarquia ilimitada nem um nível. Justificativa: a Coleção é a unidade de concessão a Agentes e de permissão; aninhamento torna a permissão efetiva dependente de caminho (o que B3 rejeitou) e "acesso à Coleção" ambíguo. Agrupamento é resolvido por nome, descrição, rótulos e concessão múltipla. RECOMENDADA.
- **DO-CNH-04.** Um Documento pertence a exatamente uma Coleção e tem exatamente uma Fonte, da mesma Coleção. "Aparecer" em outra Coleção é cópia com Proveniência, Vínculo Documento–Documento ou concessão de ambas as Coleções. Justificativa: permissão e Atualização inequívocas (20.2). RECOMENDADA.
- **DO-CNH-05.** Uma Fonte pertence a exatamente uma Coleção; toda Coleção tem exatamente uma Fonte `envio manual`, implícita, criada com ela e não removível; Fontes `URL` e `Integração` são 0..N. A Fonte `Integração` referencia uma Integração do Espaço de Trabalho (B35) e tem Membro configurador, não Proprietário; não há sucessão de Fontes. RECOMENDADA.
- **DO-CNH-06.** **PROPOSTA DE ALTERAÇÃO À DECISÃO B5 (e ao verbete Tag de A8):** incluir Documento de Conhecimento entre as entidades a que Tags do Espaço de Trabalho se aplicam. Justificativa: a mesma Tag "Convênio" já qualifica Tarefas, Contatos, Negócios e Conversas; Documentos sobre convênios ficariam fora do "mesmo universo de dados" que B5 protege, e Agentes e Painéis não os cruzariam. Enquanto não adotada, este documento obedece a B5: Documentos usam rótulos livres no Metadado (7.3), sem catálogo. RECOMENDADA (proposta).
- **DO-CNH-07.** Vínculos de Documento de Conhecimento: com Tarefa (já em DO-TAR-08), Negócio (já no documento 12), Contato e Empresa (novos) e Documento ("relacionado a", simétrico), todos 0..N, sem exclusividade, sem propriedade, visíveis só a quem vê ambos os lados. Não existe Vínculo Documento–Conversa: a Conversa é origem, registrada em Proveniência. Aplica A8. RECOMENDADA.
- **DO-CNH-08.** Versão de Documento é entidade interna imutável, sequencial, com Conteúdo (texto próprio e/ou Arquivo, ao menos um), Representações derivadas regeneráveis, Origem da Versão e estado de processamento próprio. Toda alteração de conteúdo cria Versão; título e Metadado não. Só a Versão corrente é consultável; restauração cria Versão nova; retenção elimina apenas superadas, preservando registro mínimo para Referências. RECOMENDADA.
- **DO-CNH-09.** Estado próprio e estado efetivo (B36) aplicam-se à cadeia Coleção → Documento: arquivar ou excluir a Coleção não grava estado nos Documentos; restaurar devolve o estado próprio; Estado próprio anterior à exclusão (B43) vale para ambas. A Fonte segue a Coleção e tem apenas estado operacional (`ativo`, `pausado`, `com erro`). RECOMENDADA (propõe estender B36/B43 explicitamente ao Conhecimento).
- **DO-CNH-10.** A Coleção é o único Recurso de permissão da camada; Documento, Versão e Fragmento herdam e nunca têm permissão própria; Documento não pode ser privado nem compartilhado individualmente nesta versão. Escopo `registro` alcança os Documentos; `subárvore` não se aplica; `próprios` aplica-se a Coleções por Proprietário ou Criador (B29). RECOMENDADA.
- **DO-CNH-11.** Coleção pode ser privada, com a semântica de B38a e B38b (interrompe origem "papel"; Administradores entram só por ato de governança registrado); o Proprietário tem `administrar` por propriedade, o que dispensa B38c/d. Só Membro `ativo` sem base Convidado privatiza (B46). RECOMENDADA.
- **DO-CNH-12.** "Agente tem acesso à Coleção" é concessão direta de `ver` (e, opcionalmente, `criar`/`editar`) ao Agente como Sujeito, gravada na Coleção; "Conhecimento acessível" no Agente é visão derivada. Permissão efetiva na consulta é interseção com o delegante (A9.3), avaliada a cada Ferramenta (B23); Fragmento sem `ver` nunca entra em Contexto; Documento com estado efetivo não `ativo` ou Versão corrente não `processado` nunca entra em Contexto. Aplica B19. RECOMENDADA.
- **DO-CNH-13.** Um Agente só escreve no Conhecimento por Ferramenta, com permissão e Proveniência; Memória, Sessões, Conversas e resultados de Execução nunca viram Documento automaticamente; a exceção explícita é a Atualização de Fonte, cujo ato humano prévio é a configuração. A eliminação de Contato não alcança Documentos; Documentos com Vínculo ao Contato eliminado são marcados para revisão de curadoria (derivado), nunca eliminados automaticamente. RECOMENDADA (a parte LGPD subordinada a C9).
- **DO-CNH-14.** Atualização que não encontra o Documento na origem o arquiva pelo Sistema (com "Ausente na origem desde"), nunca o envia à lixeira nem o elimina; o Sistema só desarquiva o que arquivou por essa causa. Eliminar uma Fonte com Documentos exige escolha explícita (manter como `envio manual` ou lixeira). Falha de Indexação nunca altera o ciclo de vida do Documento. Justificativa: nenhuma operação automática destrói conhecimento curado (mesmo princípio de RN-ET-17). RECOMENDADA.
- **DO-CNH-15.** Referência de Conhecimento (Documento, Versão, Fragmentos, Coleção, títulos à época) é objeto de valor obrigatório em toda saída de Agente baseada em Conhecimento, gravado na Execução ou na Mensagem de Chat; nunca é apagada pelo destino do que cita e resolve com marcador. RECOMENDADA.
- **DO-CNH-16.** Documento pode ser de qualquer tipo de conteúdo; Representação derivada é objeto de valor regenerável da Versão, nunca o Documento; a consulta por Agente cujo Modelo não suporta o tipo usa a Representação derivada se existir, senão o Documento é indisponível (sem erro de Execução). Compatibilidade é verificada contra capacidades do Modelo (global); nenhuma infraestrutura é modelada. RECOMENDADA.
- **DO-CNH-17.** Arquivos de Sessão de Chat, Anexos de Mensagem, Comentário e Tarefa não são Documentos; só "adicionar ao Conhecimento" com `criar` em uma Coleção cria Documento, referenciando o mesmo Arquivo e com Proveniência ao registro de origem. Documento colaborativo (D1) só é Conhecimento quando publicado em Coleção (Origem `publicação`). Aplica B19, B21, A8. RECOMENDADA.
- **DO-CNH-18.** Nome de Coleção é único entre Coleções `ativo`/`arquivado` do Espaço de Trabalho (mesmo critério de B39); título de Documento não é único. Movimentação de Documento entre Coleções é atômica, restrita a Documentos de Fonte `envio manual`, preserva identidade e histórico e submete o Documento às permissões do destino. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99, exceto a proposta explícita DO-CNH-06 sobre B5, obedecida na forma vigente até decisão. As decisões RECOMENDADAS deste documento estão consolidadas na constituição como B96–B99 (DO-CNH-03/04/05, DO-CNH-09/10/12, DO-CNH-15, DO-CNH-13/17); DO-CNH-09 estende B36/B43 ao Conhecimento (B94).

## 25. Questões em aberto

1. **Aninhamento de Coleções.** Rejeitado nesta versão (DO-CNH-03). Se o produto exigir "subcoleções", precisará decidir se a concessão a Agente se propaga e como Coleções privadas se comportam dentro de públicas; reabrir junto com B3.
2. **Compartilhamento de Documento individual.** DO-CNH-10 o proíbe. Pedido provável: "mostrar este único Documento a um Convidado". Se adotado, é ampliação (nunca restrição), no padrão da Tarefa (DO-TAR-16), e INV-CNH-09 passa a avaliar Coleção **ou** compartilhamento do Documento.
3. **Fluxo editorial de Documento** (rascunho / em revisão / publicado / obsoleto). Hoje não há Status em Documento (A4.2 restringe Status a Tarefas). Alternativas: (a) Coleção "em revisão" separada; (b) condição de sistema `rascunho` que impede consulta (nova condição, a decidir antes de ampliar A4.1, como C18); (c) esperar D1. Consequência: sem isso, um Documento é consultável no instante em que é `processado`.
4. **Automações com escopo em Coleção e Gatilhos de Conhecimento.** B41 não lista Coleção como escopo. Eventos da seção 18 ("Documento criado", "Fonte com erro", "Documento arquivado por ausência na origem") são úteis como Gatilhos; decidir se em escopo Espaço de Trabalho apenas ou se Coleção passa a escopo (impacta B41).
5. **Eliminação de Arquivo referenciado por Versão corrente.** Recomendação: rejeitar (12.7). Decidir junto com o documento que tratar Arquivo como transversal e com C9.
6. **Dados pessoais em Documentos (LGPD)** (C9). DO-CNH-13 marca para revisão os Documentos vinculados ao Contato eliminado; Documentos sem Vínculo não são identificáveis sem inspeção de conteúdo. Decisão jurídica e de produto: se a plataforma deve oferecer busca de curadoria por dados do titular antes da eliminação, e se Representações derivadas contam como dado pessoal.
7. **Aprovação obrigatória para escrita de Agente por Coleção** (C30). Recomendação de produto em 20.12: uma Coleção poderia exigir aprovação humana para qualquer Documento criado por Agente, independentemente do nível de autonomia (B22 permite sobrescrever para menos, por Automação; aqui seria por Recurso). Se adotado, é atributo da Coleção e ampliação de B22.
8. **Custo de Indexação e de consulta** (C8). Indexação de vídeo longo e Representações derivadas consomem cota; a ontologia só registra o evento; a política é aberta. Documentos vinculados ao Contato eliminado e dados pessoais sem Vínculo: C9 (item 6).
9. **Fonte interna** (D5). Sincronizar registros da plataforma (por exemplo, Tarefas concluídas de uma Lista como "lições aprendidas") para uma Coleção. Se adotada, a Proveniência já comporta (7.4, "origem específica"); a questão é a permissão do conteúdo copiado, que deixa de ser a do domínio de origem — exatamente o risco que B19 evita.

Resolvidas neste documento com recomendação, sem pendência aberta: Coleção padrão (não obrigatória, DO-CNH-02); Documento em duas Coleções (rejeitado, DO-CNH-04); Fonte em várias Coleções (rejeitado, DO-CNH-05); remoção na origem (arquivar, DO-CNH-14); restauração de Versão (Versão nova, DO-CNH-08); Tags em Documento (proposta DO-CNH-06, obedecendo B5 até decisão); Vínculo Documento–Conversa (não existe; Proveniência, DO-CNH-07).
