# PAINÉIS

> Domínio: Painéis | Documento 21 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Painel** é a entidade de visualização analítica do Espaço de Trabalho: uma composição nomeada, com Proprietário e permissões próprias, de **Widgets** que representam — por contagem, agregação, segmentação ou listagem — registros de outras entidades da plataforma, calculados no momento da consulta e filtrados pelas permissões de quem consulta.

Três propriedades o distinguem de todo o resto:

1. **É lente, não fonte.** O Painel não armazena dados de negócio: representa ou agrega, **por referência**, informação que pertence a Tarefas, Negócios, Contatos, Empresas, Conversas, Mensagens, Execuções, Documentos de Conhecimento e Registros de Atividade. Nada do que exibe é gravado nele; tudo é derivado no momento da consulta (ou de uma atualização declarada, seção 6). Eliminar um Painel não elimina um único fato; eliminar todas as suas Fontes torna-o vazio, não errado.
2. **É configuração com identidade e governança.** Como o Funil, o Painel é uma configuração persistente e referenciável; diferentemente do Funil, tem **Proprietário** (A7), porque uma leitura analítica é obra de alguém que responde pela sua pertinência e a compartilha com outros.
3. **É relativo ao visualizador.** O mesmo Painel mostra números diferentes a Membros diferentes, porque cada Widget é calculado sobre os registros que o visualizador tem permissão de ver (B20). Isso é uma propriedade do Painel, não um defeito.

O Painel não é um banco de dados, não é um relatório, não é uma Visualização de contêiner, não é uma cópia dos dados e não é fonte de verdade: a fonte de verdade sobre "o que aconteceu" são os Registros de Atividade (A6.2).

## 2. Propósito

1. **Responder perguntas quantitativas sem ler registros um a um.** "Quantas Tarefas venceram este mês", "quanto há em aberto no Funil", "qual o tempo de primeira resposta da Fila" são perguntas sobre conjuntos; a ontologia das entidades responde sobre cada registro. O Painel é o lugar em que o conjunto vira número.
2. **Cruzar domínios sobre o mesmo universo de dados.** Tags do Espaço de Trabalho (B5), categorias de status (A4.3), Membros como Responsável, Proprietário e Atribuído (A7) e a Localidade única (B34) existem para que um único Painel leia Estrutura de Trabalho, CRM e IA com o mesmo vocabulário.
3. **Dar forma reutilizável e compartilhável a uma leitura.** A pergunta analítica, uma vez formulada (Fonte, Métrica, Dimensão, Período), fica persistida e pode ser compartilhada, sem que o compartilhamento amplie o acesso a dados (B20).
4. **Ancorar a leitura no contexto de trabalho.** Um Painel pode ser ancorado a um Espaço, Pasta, Subpasta, Lista, Funil ou Fila (**Painel de contexto**), para que "os números desta Lista" estejam onde a Lista está — por referência, nunca por contenção (A2.2).
5. **Declarar a frescura do que exibe.** Todo Painel informa o momento de referência dos dados que apresenta, para que nenhum número seja lido como mais atual do que é.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, pertencente a exatamente um Espaço de Trabalho (A1.1), raiz do próprio agregado (documento 01, seção 3).
- **Raiz de agregado**: Widgets, Leiaute, Âncora, concessões e compartilhamentos têm consistência garantida pelo Painel e não existem fora dele.
- **Configuração com identidade**: entidade de domínio (A2.1) cujo conteúdo é apenas configuração — referenciável, com estado de ciclo de vida, sem dado de negócio próprio; nisso assemelha-se ao Funil, mas não é item de catálogo (B34). **Com Proprietário** (A7), transferível e sucedido (B28). Nome único entre `ativo`/`arquivado` (RN-PAI-31).
- **Recurso de permissão** (A9.1), com Ações ver, editar, excluir, administrar em escopo `registro` (seção 17). **Não é origem de permissão** sobre nenhum outro Recurso.
- **Consumidor de dados, nunca produtor**: não grava, não altera, não dispara nada nas entidades que lê (INV-PAI-01, INV-PAI-06).
- **Não é Ator**, não é contêiner estrutural, não tem Status personalizável (A4.2), não tem Campos Personalizados nem Tags (A5.2, A8), não é Template, não é objeto de valor.
- **Domínio Painéis não é entidade**: é o agrupamento conceitual, par da Estrutura de Trabalho, do CRM e da IA (A2.2; documento 01, 7.7). A única entidade do domínio é o Painel.

## 4. Fronteira conceitual

### O que é

- Uma composição persistente de Widgets, com Proprietário, permissões e escopo opcional.
- Uma leitura derivada, sob demanda, de registros de outras entidades, filtrada pelo visualizador.
- Um Recurso compartilhável cujo compartilhamento não transmite acesso a dados.
- Um declarante de frescura: todo Painel informa o momento de referência dos seus dados.

### O que não é

- **Não é banco de dados nem cópia.** Nenhum valor exibido é gravado no Painel (INV-PAI-01). "Cache", "materialização" e "atualização programada" são infraestrutura, fora da ontologia; a ontologia exige apenas que a frescura seja declarada.
- **Não é Visualização.** A Visualização (A8) apresenta registros de um contêiner para operá-los (abrir, editar, mover); o Painel analisa conjuntos (agrega, segmenta, mede). Uma Visualização pertence a um contêiner ou a um Membro; o Painel pertence ao Espaço de Trabalho e tem Proprietário.
- **Não é artefato exportado.** A exportação (PDF, planilha, imagem) é um artefato estático produzido a partir do Painel em um momento, fora da ontologia; deixa de obedecer a B20 no instante em que sai da plataforma, e por isso é ato registrado (RN-PAI-24).
- **Não é fonte de verdade.** Um número de Painel é o resultado de um cálculo sobre o que o visualizador vê, no momento em que viu. Prova de "o que aconteceu" é Registro de Atividade (INV-ET-12).
- **Não é contêiner de Listas, Funis ou Filas.** O Painel observa; não contém, não configura e não altera o que observa.
- **Não é Conhecimento.** Painéis não são Documentos e Documentos não são Painéis (B19; DO-CNH-01).
- **Não é Gatilho.** O Painel não emite Eventos consumíveis por Automação; "Métrica abaixo de X" é Gatilho de condição temporal sobre as entidades (DO-AUT-03), não sobre o Painel.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Painel × Fonte de Dados** | Entidade com identidade, Proprietário, permissões, Widgets. | Objeto de valor de configuração de um Widget: qual entidade, em qual escopo, com quais inclusões. Sem identidade, sem cópia. | O Painel existe sem Fontes (vazio); a Fonte não existe fora de um Widget. A Fonte diz *de onde*; o Painel diz *para quem* e *como*. |
| **Painel × Visualização (de contêiner)** | Análise: agrega, segmenta, mede; somente leitura; pertence ao Espaço de Trabalho; tem Proprietário; cruza entidades e domínios. | Apresentação: lista, quadro, calendário, tabela de registros de um contêiner; operacional (editar, mover); pertence a um contêiner ou a um Membro; uma entidade por vez. | A Visualização responde "quais registros e em que ordem"; o Painel responde "quantos, quanto, em quanto tempo". Um Widget "lista de registros" (7.9) é leitura limitada dentro de análise, não Visualização. |
| **Widget × Métrica** | Componente do Painel: uma Fonte, um tipo de Visualização de dados, Métricas, Dimensões, Filtros, Período, posição no Leiaute. Tem Identificador local. | Objeto de valor: uma agregação (contagem, soma, média...) sobre um atributo ou derivado da entidade da Fonte. Sem identidade. | O Widget é o *lugar*; a Métrica é a *pergunta*. Um Widget tem 1..N Métricas; a mesma Métrica pode aparecer em muitos Widgets sem ser "a mesma coisa". |
| **Métrica × Atributo derivado da entidade** | Agregação sobre um conjunto: "média de Dias em Etapa dos Negócios abertos". Calculada pelo Painel. | Valor derivado por registro: "Dias em Etapa" deste Negócio (documento 12, 6.1). Calculado pela entidade. | O derivado é por registro e existe sem Painel; a Métrica agrega derivados ou nativos e só existe em um Widget. O Painel nunca redefine um derivado: consome o que a entidade define. |
| **Dimensão × Filtro** | Atributo de segmentação: divide o resultado em partes ("por Responsável"). Todo valor aparece. | Predicado de seleção: restringe o conjunto ("Responsável = Ana"). Só o que satisfaz entra. | Dimensão multiplica linhas; Filtro reduz registros. Um mesmo atributo pode ser ambos no mesmo Widget ("Tarefas da Equipe Vendas, por Responsável"). |
| **Painel × Artefato exportado** | Vivo, derivado a cada consulta, filtrado pelo visualizador, dentro da plataforma. | Estático, produzido em um momento, congela os números que *aquele* visualizador via, fora da plataforma e fora de B20. | O Painel não "contém" artefatos; a exportação é operação registrada (RN-PAI-24) cujo produto está fora da ontologia. |
| **Painel × Lista / Funil / Fila** | Observa por referência; não contém, não configura, não altera. | Contêm ou agrupam registros; têm regras próprias; são escopos de Automação e Fonte de Dados de Painel. | Eliminar a Lista não elimina o Painel (só invalida Widgets); eliminar o Painel não afeta a Lista. A relação é associação (A2.2). |
| **Painel × Registro de Atividade** | Calcula sobre Registros para Métricas históricas (tempo em status, tempo em Etapa, conversão, Ator). | Fato imutável de uma ação, com Ator, objeto, momento (A6.2); fonte de verdade da auditoria. | O Registro é Fonte de Dados possível (7.2); o Painel nunca é prova: a prova é o Registro. Métricas históricas usam a Ordem, o nome e a categoria *à época* gravados no Registro (DO-FUN-13). |
| **Painel × Conhecimento** | Lê Coleções e Documentos como Fonte apenas para Métricas de catálogo (contagem, versões, atualização, consultas por Execução). | Corpus curado consultável por Agentes e Membros (B19). | O Painel nunca agrega, resume ou exibe **conteúdo** de Documentos (RN-PAI-15); e o Painel não é Documento. |
| **Tipo de Visualização de dados × Visualização** | Forma gráfica de um Widget (número, barras, linhas, pizza, funil, tabela, calendário, lista de registros, texto). Atributo do Widget. | Configuração salva de apresentação de registros de contêiner (A8). | Homonímia parcial deliberadamente evitada: "Visualização" sem qualificador é sempre a de contêiner; a do Widget é sempre "tipo de Visualização de dados". |

## 5. Identidade

O Painel tem **identificador imutável, opaco e atribuído pela plataforma**. Tudo o mais é atributo.

**Teste de identidade.** Se o nome, a descrição, o Proprietário (por transferência ou sucessão), a Âncora, todos os Widgets, o Leiaute, os compartilhamentos e o estado mudarem, continua sendo o mesmo Painel: os Registros de Atividade, as concessões e a Proveniência das cópias feitas a partir dele continuam a referenciá-lo. A identidade é a continuidade da configuração como objeto de governança, não qualquer Widget.

Consequências:

- **Nome não é identidade, mas é único** entre Painéis `ativo` e `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e de espaços nas extremidades (RN-PAI-31; DO-PAI-02). Justificativa: Membros pedem a Agentes "o Painel X" por nome na Ferramenta de leitura (RN-PAI-22), e Registros de Atividade e Proveniência gravam o nome à época; é o mesmo padrão de Funil (DO-FUN-16), Agente (DO-AGE-03), Habilidade (DO-HAB-16), Coleção (DO-CNH-18) e Automação (DO-AUT-20), que estendem B39 por analogia. Um Painel `na lixeira` não reserva o nome.
- **Widget não tem identidade fora do Painel.** Tem **Identificador local** (Glossário), estável dentro do Painel, usado por edições, Registros de Atividade e Leiaute. Nada fora do Painel referencia um Widget (INV-PAI-03). Copiar um Painel produz Widgets novos.
- **Fonte de Dados, Métrica, Dimensão, Filtro, Período e Leiaute são objetos de valor**: substituí-los não muda a identidade de nada; alterá-los é editar o Widget ou o Painel.
- **Copiar não é mover identidade.** Um Painel copiado é outro Painel, com Proveniência (identificador e nome à época do original), sem vínculo vivo (RN-PAI-04).

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável (seção 5). |
| Espaço de Trabalho | referência | sim | Imutável (INV-ET-01). |
| Nome | nativo | sim | Texto curto. Único entre Painéis `ativo`/`arquivado` do Espaço de Trabalho (RN-PAI-31; DO-PAI-02). |
| Descrição | nativo | não | Texto livre sobre o que o Painel responde. |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7; INV-ET-03). Transferível; sucedido em B28. Sempre humano (B7). |
| Criador | referência (Membro) | sim | Imutável (A7). Sempre um Membro: nem Agente, nem Automação, nem a plataforma criam Painéis (RN-PAI-03). |
| Âncora | objeto de valor | não | 0..1. Registro de contexto: Espaço, Pasta, Subpasta, Lista, Funil ou Fila (7.8). Presente e não `eliminada`: **Painel de contexto**; ausente ou `eliminada`: **Painel do Espaço de Trabalho** (distinção derivada). Guarda tipo, identificador e nome à época; validade derivada por visualizador. |
| Widgets | componentes | 0..N | 7.1. Ordenados pelo Leiaute. Sujeitos a Limite imposto (RN-PAI-06). |
| Leiaute | objeto de valor | sim | 7.7. Posição e tamanho de cada Widget (por Identificador local). Vazio quando não há Widgets. |
| Compartilhamentos e concessões | relações | 0..N | Vivem no Painel como Recurso (seção 17). |
| Estado | nativo | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). |
| Estado anterior à exclusão | nativo | condicional | Presente enquanto `na lixeira`: `ativo` ou `arquivado`; a restauração o devolve e o esvazia (B43 por analogia, como Negócio). |
| Proveniência | objeto de valor | não | Painel a partir do qual foi copiado (identificador e nome à época) — RN-PAI-04. Sem vínculo vivo. |
| Momentos | nativo | sim | Criação, última alteração de configuração, arquivamento, envio à lixeira. |
| Previsão de eliminação | derivado | condicional | Envio à lixeira + Política de lixeira (B34). |
| Momento de referência dos dados | derivado | — | Instante a que os dados exibidos se referem, declarado a cada consulta (RN-PAI-19). Não é atributo gravado. Se a plataforma servir dados de uma atualização anterior, o momento é o dessa atualização, não o da consulta. |
| Condição de integridade | derivado | — | `íntegro` (todo Widget válido), `parcialmente inválido` (ao menos um Widget inválido) ou `vazio` (sem Widgets). Leitura para o Proprietário; não é estado (11.2). |

**Não são atributos do Painel**: os valores exibidos (derivados de outras entidades, nunca gravados — INV-PAI-01); os Filtros interativos aplicados por quem consulta (estado de sessão — 7.10); a "última atualização" como carimbo gravado (é o Momento de referência, derivado); contagem de visualizações (não registrada nesta versão — 21).

## 7. Entidades internas ou componentes

### 7.1 Widget

Componente interno do Painel, sem identidade fora dele (Identificador local). Responde a exatamente uma pergunta analítica sobre exatamente uma Fonte de Dados, com uma forma gráfica.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador local | nativo | sim | Estável dentro do Painel (Glossário). |
| Título | nativo | sim | Texto curto. |
| Tipo de Visualização de dados | nativo (enumeração) | sim | `número`, `tabela`, `barras`, `linhas`, `pizza`, `funil`, `calendário`, `lista de registros`, `texto` (7.9). |
| Fonte de Dados | objeto de valor | condicional | Exatamente uma para todo tipo, exceto `texto` (nenhuma). 7.2. |
| Métricas | objetos de valor | 1..N (condicional) | 7.3. Exigidas em `número`, `tabela`, `barras`, `linhas`, `pizza`, `funil`; ausentes em `lista de registros`, `calendário` e `texto`. |
| Dimensões | objetos de valor | 0..N | 7.4. Nenhuma em `número` e `texto`; no máximo duas em `barras`/`linhas`/`tabela`; exatamente uma em `pizza` e `funil` (INV-PAI-05). |
| Filtros fixos | objetos de valor | 0..N | 7.5. Parte da configuração. |
| Período | objeto de valor | 0..1 | 7.6. Ausente: sem recorte temporal. |
| Atributos exibidos | objeto de valor | condicional | Só em `lista de registros` e `calendário`: quais atributos (nativos, derivados ou Valores de Campo) aparecem por registro. |
| Ordenação | objeto de valor | não | Atributo ou Métrica e direção. |
| Limite | nativo (inteiro) | condicional | Obrigatório em `lista de registros` e `calendário`; opcional em `tabela`. Teto pela plataforma (RN-PAI-06). |
| Conteúdo | nativo (texto) | condicional | Só em `texto`: texto autoral do editor (título de seção, explicação). É configuração, não dado de outra entidade. |
| Validade | derivado | — | `válido`, `inválido` (com causa) — 11.2. |

O Widget **não tem**: identidade global, Proprietário, permissões próprias, estado de ciclo de vida, Comentários, Registros de Atividade como objeto raiz (o objeto é o Painel; o Widget é o detalhe).

### 7.2 Fonte de Dados (objeto de valor de configuração)

Especificação de **qual entidade** e **em qual escopo** alimenta o Widget. **Não é entidade, não é cópia, não é conjunto gravado**: é a descrição do conjunto, resolvida a cada consulta contra as permissões do visualizador (B20).

| Elemento | Valores | Regra |
| --- | --- | --- |
| Entidade-alvo | Tarefa, Negócio, Contato, Empresa, Conversa, Mensagem, Execução de Agente, Execução de Automação, Solicitação de Aprovação, Registro de Atividade, Documento de Conhecimento | Exatamente uma. Catálogo fechado nesta versão (DO-PAI-05). Exercício de Habilidade (sem identidade — DO-HAB-11) e Referência de Conhecimento (objeto de valor — DO-CNH-15) nunca são entidade-alvo: entram como Dimensão, Filtro ou Métrica derivada das Execuções. |
| Escopo | Conforme a entidade-alvo (tabela abaixo) | Um ou mais registros do mesmo tipo de escopo, ou o Espaço de Trabalho inteiro. Referência por identidade (INV-PAI-02). |
| Incluir Subtarefas | booleano | Só para Tarefa. Padrão **falso** (DO-STA-09). Verdadeiro habilita "nível", "raiz" e "tem pai" como Dimensões e Filtros. |
| Incluir arquivados | booleano | Padrão **falso**, exceto Negócio (padrão **verdadeiro**: arquivar não altera situação nem receita — documento 12, 11.2). Avalia o **estado efetivo** onde ele existe (Estrutura de Trabalho — B36; Conhecimento — DO-CNH-09) e o **estado próprio** no CRM (Contato, Empresa, Negócio — DO-NEG-09). Não se aplica a entidades sem `arquivado` (Conversa — A4.1; Mensagem, Execução e Registro de Atividade, que não têm estado de ciclo de vida próprio): para elas, o escopo arquivado (Fila, Canal, Agente, Automação) é tratado pela Disponibilidade da Fonte (11.2). `na lixeira` nunca entra (INV-PAI-04). |
| Incluir Ensaios | booleano | Só para Execução de Agente. Padrão **falso** (DO-AGE-13). |

Escopos admitidos por entidade-alvo:

| Entidade-alvo | Escopos | Observações |
| --- | --- | --- |
| Tarefa | Lista(s), Subpasta(s), Pasta(s), Espaço(s), Espaço de Trabalho | Contêineres em qualquer combinação do mesmo Espaço de Trabalho; "Tarefas da Pasta" alcança toda a subárvore. Definições de Campo: RN-PAI-12 (C14). |
| Negócio | Funil(is), Espaço de Trabalho | Etapa nunca é escopo (é Dimensão ou Filtro): Etapa só existe no contexto do Funil (RN-FUN-05). |
| Contato, Empresa | Espaço de Trabalho; para Empresa, também grupo econômico (raiz) | Grupo é derivado por travessia matriz/filial no momento da consulta (DO-EMP-06; documento 11, 20.14). Vínculos `parceira` não agregam. |
| Conversa, Mensagem | Fila(s), Canal(is), Caixa de Entrada | "Conversas da Fila" resolve pela referência **atual** da Conversa à Fila (mutável por transferência — B70): a Conversa que sai da Fila deixa o escopo na próxima consulta. Mensagem exige que a Conversa esteja no escopo; Mensagem `interna` só para quem a vê (documento 14, 17.3). |
| Execução de Agente | Agente(s), Espaço de Trabalho | `ver` sobre a Execução deriva de `ver` sobre o Agente; o delegante vê a própria Execução (documento 17, 17.4). Exercícios de Habilidade entram como Dimensão/Filtro ("Execuções que exerceram a Habilidade X" — DO-HAB-11), nunca como registro contado; as Referências de Conhecimento alimentam a Métrica derivada "Conhecimento consultado" (DO-CNH-15); custo por Cadeia de Execuções é Métrica derivada (B79). Sessões de Chat nunca são Fonte (DO-CHT-13; B85); Execuções originadas em Sessões contam sem expor Mensagens de Chat. |
| Execução de Automação | Automação(ões), Espaço de Trabalho | `ver` deriva de `ver` sobre a Automação (documento 19, 17). Execuções de Agente contidas contam na Fonte "Execução de Agente", não aqui (B18). |
| Solicitação de Aprovação | Agente(s), Automação(ões), Espaço de Trabalho | Entidade interna da Execução com identidade, contada por Painéis (B80; DO-AGE-11). `ver` deriva de `ver` sobre a Execução que a contém (Agente ou Automação); o aprovador designado e o Decisor veem a própria Solicitação (RN-PAI-10). Motivo, Decisão, solicitante, aprovador e Decisor são Dimensões; criação, prazo e decisão são atributos temporais (7.6). |
| Registro de Atividade | Tipo de objeto + escopo do objeto (os mesmos acima) | Fonte para Métricas históricas (tempo em status, transições, ações por Ator). Um Registro entra se o visualizador tem `ver` sobre o objeto **hoje** (RN-PAI-10); Registros cujo objeto foi eliminado não entram (RN-PAI-30). |
| Documento de Conhecimento | Coleção(ões), Espaço de Trabalho | Só Métricas de catálogo e uso (7.3). Conteúdo nunca (RN-PAI-15). |

**Não são Fontes**: Sessão de Chat e Mensagem de Chat (DO-CHT-13; B85); Memória; Exercício de Habilidade, Referência de Conhecimento e Cadeia de Execuções (objetos de valor da Execução — Dimensão, Filtro ou Métrica derivada, DO-HAB-11, DO-CNH-15, B79); Item de Checklist e Checklist (RN-CHK-15: Checklist é Métrica da Tarefa); Membro, Equipe, Papel, Integração (governança — Convidado não vê a lista de Membros; "Membro" aparece só como Dimensão); Etapa, Fila, Canal, Lista como *registros contados* (são escopos ou Dimensões); Arquivo; Vínculo (é Dimensão ou Filtro: "Tarefas vinculadas a Negócio X"); Widget ou Painel (um Painel não lê Painéis); Fragmento.

### 7.3 Métrica (objeto de valor)

Agregação sobre um atributo nativo ou derivado da entidade-alvo, ou sobre Registros de Atividade dela. Forma: **(agregação, atributo, qualificador)**. Agregações: `contagem`, `soma`, `média`, `mínimo`, `máximo`, `taxa` (razão entre duas contagens sob predicados), `duração` (diferença entre dois momentos, agregada), `percentual` (parte ÷ total do mesmo Widget). Nenhuma Métrica é gravada em lugar algum (INV-PAI-01).

Catálogo mínimo por entidade (o produto pode ampliar dentro de RN-PAI-08 e RN-PAI-09):

| Entidade | Métricas | Base |
| --- | --- | --- |
| Tarefa | contagem; contagem por **categoria de status**; Vencidas; Bloqueadas; não atribuídas; soma/média de Estimativa, Tempo registrado, Tempo registrado agregado; média de Progresso de Subtarefas e de Progresso de Checklists; Itens de Checklist abertos e concluídos, por Responsável ou por Ator (RN-CHK-15 — Métricas da Tarefa, nunca Item como registro); duração criação → Momento de conclusão; **tempo em status** e tempo em categoria (Registros "Status alterado"); reaberturas | documento 06, 6.1; DO-CHK-08; A4.3 |
| Negócio | contagem por situação; **soma de Valor por moeda**; **valor ponderado por moeda**; média de Idade, de Dias em Etapa; ciclo (criação → Momento de encerramento); **taxa de conversão entre Etapas** e taxa de ganho (Registros "entrou/saiu de Etapa", "ganho", "perdido"); perdas por Motivo; Previsões vencidas | documento 12, 6.1; DO-FUN-12/13; DO-NEG-04 |
| Contato | contagem; por Origem, Qualificação, Modo de criação, Proprietário; recência de Última interação; sem Identificador; com Suspeita de Duplicidade; Consentimento vigente | documento 10, 6 e 11 |
| Empresa | contagem; Contatos por Empresa; Negócios e valor (aberto, ganho) por Empresa e **por grupo**; filiais | documento 11, 6, 10 |
| Conversa | contagem por estado de conversa; sem Atribuído; **tempo de primeira resposta**; tempo de espera; **tempo de resolução** (criação ou última reabertura → resolução); reaberturas; carga por Atribuído | documento 14, 7.5 |
| Mensagem | contagem por direção; por status de entrega; falhas de envio; por Ator | documento 14, 7.6, 11.4 |
| Execução de Agente | contagem por estado; **taxa de falha**; **custo** (soma, por unidade da plataforma — C8); duração; Solicitações de Aprovação geradas (contagem); por Habilidade exercida (Exercícios — DO-HAB-11); por Modelo; profundidade da Cadeia de Execuções; **custo por Cadeia de Execuções** (soma das Execuções existentes da mesma Cadeia, de Agente e de Automação — B79; Execuções eliminadas com a Automação raiz aparecem como "Execução eliminada" — DO-AUT-17); **Conhecimento consultado** (Documentos e Coleções citados nas Referências de Conhecimento; consultas sem resultado — DO-CNH-15) | documento 17, 7.2, 7.9; DO-HAB-11; B79 |
| Solicitação de Aprovação | contagem por motivo (`autonomia`, `permissão`, `limite`), Decisão e solicitante (Agente ou Automação); por aprovador e por Decisor; **tempo até decisão**; vencidas (`expirada`); pendentes há mais de X horas | documento 17, 7.6; documento 19, 17.5; B80 |
| Execução de Automação | contagem por resultado; falhas; duração; custo (soma das Execuções de Agente contidas); tempo de aprovação; disparos recusados por ciclo | documento 19, 6, 7.7 |
| Registro de Atividade | contagem por ação, Ator, tipo de objeto; duração entre Registros consecutivos do mesmo objeto (base de todo "tempo em") | A6.2 |
| Documento de Conhecimento | contagem por estado, tipo de conteúdo, Fonte; Versões criadas; Atualizações com erro; Documentos consultados e consultas sem resultado (Métrica derivada das Referências de Conhecimento das Execuções — DO-CNH-15; nunca conteúdo — RN-PAI-15) | documento 20, 18 |

Regras de estabilidade que fundamentam o catálogo:

- **Status é sempre lido por categoria** (A4.3) quando a Fonte abrange mais de um Conjunto de Status efetivo; a Dimensão "Definição de Status" só é oferecida quando todas as Listas do escopo resolvem o mesmo Conjunto (RN-PAI-11).
- **Métricas de transição usam o Registro à época** (Etapa por identidade, nome e Ordem à época — DO-FUN-13; Definição de Status e categoria à época — documento 05, 18 "Mapeamento de status aplicado").
- **Moedas não se somam entre si**: toda Métrica sobre Valor produz uma série por moeda (RN-PAI-13).
- **Tempo é calendário por padrão**; "horas úteis" só onde a entidade da Fonte oferece Horário de atendimento (Caixa de Entrada, Fila — documento 14, 6) e enquanto C12 não existir (RN-PAI-14).

### 7.4 Dimensão (objeto de valor)

Atributo pelo qual uma Métrica é segmentada. Toda Dimensão é um atributo nativo, derivado ou de catálogo da entidade-alvo, ou uma referência dela a outra entidade; o Painel não inventa Dimensões.

| Família | Dimensões | Observações |
| --- | --- | --- |
| Fluxo | categoria de status; Definição de Status (RN-PAI-11); situação; estado de conversa; Etapa (por identidade, um Funil por vez); Funil; estado e resultado de Execução | Etapa como Dimensão exige Fonte com escopo em um único Funil (RN-FUN-05). |
| Pessoas | Responsável; Proprietário; Atribuído; Criador; Ator; ator delegante; Equipe (derivada dos Membros) | Membro `removido` aparece como tal (A6.4); Agente é valor legítimo onde A7 o admite. Tarefa com N Responsáveis conta em cada um (RN-PAI-16). |
| Estrutura | Espaço; Pasta; Subpasta; Lista; **nível (de Tarefa)**; raiz; tem pai; Tipo de Tarefa; Prioridade | "nível", "raiz" e "tem pai" só com "incluir Subtarefas" (DO-STA-09). |
| CRM | Origem; Qualificação; Motivo de Perda; Motivo de Ganho; Empresa; grupo econômico (raiz); Canal; Tipo de Canal; Fila; direção de Mensagem; status de entrega | Qualificação segmenta por Definição (DO-CON-05); "converteu" é Filtro escolhido pelo editor, não categoria. |
| IA | Agente; Automação; Habilidade (Exercício); Modelo; nível de autonomia efetivo; Origem da Execução; classe de efeito da Ferramenta; Cadeia de Execuções (Execução raiz — B79); motivo, Decisão, aprovador e Decisor de Solicitação de Aprovação; Coleção e Documento citados em Referência de Conhecimento | Sessão nunca (DO-CHT-13). |
| Transversal | Tag; Valor de Campo de seleção única ou múltipla (RN-PAI-12); Vínculo a registro de outro domínio | Seleção múltipla conta o registro em cada opção (RN-PAI-16). |
| Tempo | período por granularidade: dia, semana, mês, trimestre, ano, no fuso da Localidade, sobre o atributo temporal de referência do Período (7.6) | Data "dia civil" agrupa pelo dia; "instante" é interpretado no fuso (documento 06, 6.2). |

### 7.5 Filtro (objeto de valor)

Predicado sobre atributos da entidade-alvo (nativos, derivados, Valores de Campo, Tags, referências, categorias). Dois lugares, uma só natureza:

- **Filtro fixo**: parte da configuração do Widget; gravado no Painel; editável por quem tem `editar`.
- **Filtro interativo**: aplicado por quem consulta, sobre o resultado dos Filtros fixos; **estado de sessão do visualizador**, nunca do Painel; não é gravado, não é compartilhado, não gera Registro de Atividade (RN-PAI-18). Só restringe: um Filtro interativo jamais amplia o que o Filtro fixo delimita.

Filtros nunca substituem permissão: um Filtro "todas as Listas" não mostra Lista privada a quem não a vê (INV-PAI-07).

### 7.6 Período (objeto de valor)

Recorte temporal do Widget: **intervalo absoluto** (início e fim) ou **relativo** ("últimos 30 dias", "este mês", "trimestre anterior"), sempre com um **atributo temporal de referência** da entidade-alvo:

| Entidade | Atributos temporais de referência |
| --- | --- |
| Tarefa | Momento de criação; Data de início; Data de vencimento; Momento de conclusão; Momento da última alteração |
| Negócio | Momento de criação; Data de fechamento; Data prevista de fechamento; Momento de entrada na Etapa atual |
| Contato, Empresa | Momento de criação; Última interação (Contato) |
| Conversa | Momento de criação; Momento da primeira resposta; Momento de resolução |
| Mensagem | Momento de envio ou recebimento |
| Execução | Início; término |
| Solicitação de Aprovação | Momento de criação; prazo; Momento da decisão |
| Registro de Atividade | Momento |
| Documento | Criação; Versão corrente |

Intervalos relativos são resolvidos a cada consulta no **fuso da Localidade do Espaço de Trabalho** (RN-ET-15); Datas "dia civil" são comparadas sem fuso, instantes são interpretados no fuso (documento 06, 6.2). Alterar a Localidade muda a leitura de Períodos relativos a partir da próxima consulta, sem reescrever nada (RN-ET-16).

### 7.7 Leiaute (objeto de valor)

Posição e tamanho de cada Widget em uma grade, referenciando Widgets por Identificador local. Sem identidade; sem significado de negócio; alterá-lo é editar o Painel (`editar`). O Leiaute não é personalizável por visualizador nesta versão: quem vê o Painel vê o Leiaute do Painel (seção 15).

### 7.8 Âncora (objeto de valor)

Referência de contexto a exatamente um Espaço, Pasta, Subpasta, Lista, Funil ou Fila do mesmo Espaço de Trabalho (INV-ET-07), com identificador e nome à época e **validade derivada por visualizador** (como a Disponibilidade da Fonte, 11.2): `válida` (a âncora existe e o visualizador tem `ver` sobre ela), `arquivada` (estado efetivo `arquivado`), `indisponível` (`na lixeira`, ou o visualizador não tem `ver` — o nome não é exibido, RN-PAI-29) ou `eliminada` (não existe mais; identificador e nome permanecem como valor).

A Âncora faz três coisas e só três: (a) situa o Painel na navegação do registro âncora; (b) serve de escopo padrão às Fontes dos Widgets criados nele (sugestão, não obrigação: um Widget do Painel de contexto pode ter Fonte fora da Âncora); (c) acompanha a Âncora quando ela é movida (a referência é por identidade — B40). A Âncora **não** confere permissão, **não** contém o Painel (A2.2), **não** limita as Fontes e **não** elimina o Painel quando eliminada: passa a `eliminada`, o Painel permanece e nada é reescrito pelo Sistema (DO-PAI-07; 12.4) — mesmo padrão da âncora de Sessão de Chat (DO-CHT-03). Remover ou trocar a Âncora é edição humana (12.2).

### 7.9 Tipo de Visualização de dados (enumeração da plataforma)

| Tipo | O que exige | O que mostra |
| --- | --- | --- |
| `número` | 1 Métrica, 0 Dimensão | Um valor; opcionalmente comparação com o Período anterior (derivada). |
| `barras`, `linhas` | 1..N Métricas, 1..2 Dimensões | Séries por Dimensão. |
| `pizza` | 1 Métrica, 1 Dimensão | Partes de um todo. |
| `funil` (gráfico) | 1 Métrica, 1 Dimensão ordenada (Etapa, categoria de status, ordem de Definições de Status) | Sequência com perda entre posições. Não é o Funil (CRM); usa-o como Dimensão quando a Fonte é Negócio. As posições vêm do **catálogo** (Etapas do Funil, Definições do Conjunto), não dos registros: só são desenhadas para quem tem `ver` sobre esse catálogo (RN-PAI-29). |
| `tabela` | 1..N Métricas, 0..2 Dimensões | Matriz de valores. |
| `lista de registros` | Fonte, Atributos exibidos, Ordenação, Limite | Registros individuais, somente leitura, limitados; cada linha é navegável para quem tem `ver`. Não é Visualização (A8): não edita, não agrupa, não é padrão de contêiner. |
| `calendário` | Fonte, atributo temporal, Limite | Registros posicionados em dias; somente leitura. |
| `texto` | Conteúdo | Texto autoral; sem Fonte. |

O catálogo é da plataforma e pode crescer; a ontologia só exige que cada Widget tenha exatamente um tipo e que os requisitos de Métrica/Dimensão do tipo sejam satisfeitos (INV-PAI-05).

### 7.10 O que não é componente

- **Filtros interativos** (7.5): estado de sessão do visualizador.
- **Valores calculados, cache, materialização, atualização programada**: infraestrutura. A ontologia só conhece o Momento de referência dos dados (6).
- **Artefato exportado**: fora da ontologia (4).
- **Concessões e compartilhamentos**: relações que vivem no Painel como Recurso (documento 01, seção 21), não componentes.
- **As entidades lidas**: Tarefas, Negócios etc. não são "parte" do Painel em nenhum sentido.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | PAI → ET | Exatamente um, imutável (A1.1). Eliminado com ele (B32). |
| é de propriedade de | Membro | propriedade | PAI → Membro | Exatamente um (A7). Transferência e sucessão (B28). |
| foi criado por | Membro | referência | PAI → Membro | Imutável; sempre Membro (RN-PAI-03). |
| contém Widgets | Widget | contenção (composição) | PAI → Widget | 0..N; sem identidade externa (INV-PAI-03). |
| tem Leiaute, Âncora, Proveniência | objetos de valor | configuração | — | Sem identidade. |
| é ancorado a | Espaço, Pasta, Subpasta, Lista, Funil, Fila | referência (associação) | PAI → âncora | 0..1. Nunca contenção (A2.2). Sobrevive à eliminação da âncora como valor `eliminada` (DO-PAI-07). |
| Widget tem Fonte em | Tarefa, Negócio, Contato, Empresa, Conversa, Mensagem, Execução, Solicitação de Aprovação, Registro de Atividade, Documento (por escopo: Lista, Pasta, Subpasta, Espaço, Funil, Fila, Canal, Caixa, Agente, Automação, Coleção, ET) | referência (uso) | Widget → escopo | Referência por identidade, nunca cópia (INV-PAI-02). O escopo não conhece quem o mede. |
| Widget usa | Definição de Status (categoria), Definição de Campo, Tag, Origem, Qualificação, Motivo, Etapa, Habilidade, Modelo | referência (uso como Dimensão/Filtro) | Widget → catálogo | Uso, não contenção. Definição eliminada invalida o Widget (11.2). |
| é Recurso de | Permissão (concessão direta, compartilhamento) | relação de permissão | Sujeito → PAI | Sujeitos: Membro, Equipe, Papel, Agente. Escopo `registro` (seção 17). |
| é objeto de | Registro de Atividade | referência inversa | Registro → PAI | Toda ação sobre o Painel (RN-PAI-23). |
| foi copiado de | Painel | Proveniência (valor) | PAI → PAI | Sem vínculo vivo (RN-PAI-04). |
| consome | Localidade | uso de configuração | ET → PAI | Fuso para Períodos; moeda padrão apenas como rótulo (RN-PAI-13). |

Distinção aplicada: **CONTER** (Widgets); **CONFIGURAR** (Leiaute, Âncora, Fontes, Métricas, Dimensões, Filtros, Períodos); **REFERENCIAR** (Âncora, escopos das Fontes, catálogos, Criador, Proveniência); **USAR** (Localidade); **ser de propriedade de** (Membro); **pertencer** (Espaço de Trabalho). O Painel **não HERDA** de nenhum contêiner e **não se RELACIONA** por Vínculo: Vínculo é entre registros de trabalho (A8), e o Painel não é um deles. Poder tomar a Lista como Fonte não torna o Painel filho da Lista; poder ancorar não torna a Âncora pai do Painel.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Painel | 0..N | sim | sim | pertencimento | Documento 01, seção 9. |
| Painel → Proprietário | 1 | não | não | propriedade | A7. |
| Painel → Widget | 0..N (≤ Limite imposto) | sim | sim | composição | Painel recém-criado é vazio e válido; o teto é da plataforma (RN-PAI-06). |
| Painel → Âncora | 0..1 | sim | não | associativa | Painel do Espaço de Trabalho tem zero; Painel de contexto tem exatamente uma. Duas âncoras tornariam "o contexto" ambíguo. |
| Âncora → Painéis | 0..N | sim | sim | associativa | Uma Lista pode ter vários Painéis de contexto; a Lista não os conhece. |
| Widget → Fonte de Dados | 1 (0 para `texto`) | condicional | não | configuração | Um Widget cruzando duas entidades-alvo exigiria junção, sem semântica estável de permissão (DO-PAI-06). |
| Fonte → escopos | 1..N do mesmo tipo, ou o ET | não | sim | referência | "Tarefas das Listas A e B" é válido; "Tarefas da Lista A e Negócios do Funil X" não. |
| Widget → Métrica | 1..N; 0 em `lista de registros`, `calendário`, `texto` | condicional | sim | configuração | 7.9. |
| Widget → Dimensão | 0..2 | sim | até duas | configuração | Mais de duas Dimensões não tem forma gráfica legível; Filtro cobre o restante (INV-PAI-05). |
| Widget → Filtro fixo | 0..N | sim | sim | configuração | |
| Widget → Período | 0..1 | sim | não | configuração | Um Widget sem Período lê tudo o que a Fonte alcança. |
| Painel → concessão / compartilhamento | 0..N | sim | sim | relação de permissão | Painel não compartilhado é válido (só o Proprietário e os Papéis de governança o veem — 17). |
| Painel → Painel (Proveniência) | 0..1 | sim | não | valor | Cópia de cópia referencia só o original imediato. |
| Painel → Registro de Atividade | 1..N | não | sim | referência inversa | A criação gera o primeiro. |

Sem `DECISÃO NECESSÁRIA` pendente: as cardinalidades decorrem de A7, A2.2, B34 e da forma gráfica.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O Painel não está em nenhuma hierarquia: pertence diretamente ao Espaço de Trabalho, como Contato ou Agente (documento 01, seção 10). Não há "Painel dentro de Painel", "pasta de Painéis" nem herança entre Painéis. O Painel de contexto **não é filho** da sua Âncora: é um Painel do Espaço de Trabalho com uma referência de contexto (A2.2).

**Pertencimento (teste de existência).** O Painel falha no teste sem o Espaço de Trabalho: é eliminado com ele. Widgets, Leiaute e Âncora falham sem o Painel: contenção e configuração. Todas as entidades que o Painel lê (Listas, Funis, Filas, Agentes, Coleções, registros) **passam** no teste: existem sem o Painel e o Painel existe sem elas — com Widgets inválidos, mas existente. Por isso toda relação da seção 8 com elas é **associação por referência**, nunca dependência.

**"Pertence a" versus "relaciona-se com".** Um Widget *pertence* ao Painel. O Painel *pertence* ao Espaço de Trabalho e *é de propriedade de* um Membro. O Painel *relaciona-se com* a Lista (Fonte de Dados), *relaciona-se com* o Funil (Âncora), *usa* a Localidade. Nenhum registro de trabalho *pertence* ao Painel, e o Painel nunca aparece do lado "pertence a" de nada além do Espaço de Trabalho.

**Propriedade.** Exatamente um Proprietário, sempre Membro humano (A7, B7): responde pela pertinência da leitura, tem `administrar` por propriedade (17.1), transfere por ato explícito e é sucedido na remoção (B28; RN-PAI-05). Propriedade é governança, não posse dos dados: o Proprietário não vê mais do que as suas próprias permissões permitem, e o Painel não é calculado com as permissões dele para ninguém (B20).

**Configurar não é conter.** O Proprietário configura Fontes que apontam para Listas; isso não torna as Listas parte do Painel nem o Painel parte das Listas. Um Administrador de Espaço pode criar um Painel de contexto no Espaço; o Painel continua a pertencer ao Espaço de Trabalho e ao seu Proprietário.

## 11. Estados

### 11.1 Estados do Painel (de sistema, A4.1)

| Estado | Significado | O que é possível |
| --- | --- | --- |
| `ativo` | Em uso. | Tudo, conforme permissão. |
| `arquivado` | Retirado do uso corrente, íntegro. Somente leitura. | Ver (dados continuam derivados e atuais na consulta — arquivar o Painel não congela números); restaurar; enviar à lixeira; transferir propriedade; alterar permissões. Não editar Widgets nem Leiaute. |
| `na lixeira` | Excluído de forma recuperável, pelo prazo da Política de lixeira. | Ver (por quem tem `excluir`), restaurar ao Estado anterior à exclusão, eliminar. Oculto em listagens e na navegação da Âncora. |

Eliminação permanente não é estado (A4.1). O Painel **não tem Status** (A4.2) e não tem estado efetivo derivado de ancestral (B36 é da Estrutura de Trabalho): sua Âncora não lhe transmite estado — uma Lista arquivada não arquiva o seu Painel de contexto (a Âncora passa a `arquivada`, 7.8).

### 11.2 Condições derivadas (não são estados)

- **Validade do Widget**: `válido` ou `inválido` com causa — Fonte eliminada (escopo não existe mais); Definição de Campo, Definição de Status, Tag, Motivo, Origem, Qualificação ou Habilidade referenciada eliminada; tipo de Visualização de dados incompatível com as Métricas/Dimensões após alteração de catálogo; Etapa referenciada em Filtro removida. Um Widget inválido **permanece** no Painel, exibe a causa e não é calculado; corrigir a configuração o torna válido; a Definição restaurada da lixeira o revalida sem ato (RN-PAI-20).
- **Disponibilidade da Fonte** por visualizador: `disponível`, `arquivada` (escopo com estado efetivo `arquivado` — dados continuam calculáveis, com indicação; DO-ESP-13), `indisponível` (escopo `na lixeira`, ou o visualizador sem `ver` sobre o escopo — o Widget aparece vazio com "fonte sem acesso", sem revelar o nome), `eliminada` (Widget inválido).
- **Condição de integridade do Painel** (6): `íntegro`, `parcialmente inválido`, `vazio`.
- **Validade da Âncora** (7.8).

Nenhuma condição derivada restringe ações sobre o Painel por si; todas são leituras para o editor e para o visualizador.

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Membro `ativo` com permissão de criar Painéis (17.2). Nem Agente, nem Automação, nem a plataforma criam Painéis: a criação do Espaço de Trabalho não instancia Painel algum (RN-PAI-03). Três formas:

- **Do zero**: nome (único — RN-PAI-31); Âncora opcional (exige `ver` sobre a âncora); zero Widgets. O Criador é o Proprietário inicial.
- **Por cópia** de um Painel do mesmo Espaço de Trabalho sobre o qual o ator tem `ver` (além de `criar` Painéis): Widgets, Leiaute, Filtros fixos e Períodos são copiados; **compartilhamentos, concessões, Proprietário e Âncora não** (a cópia nasce sem Âncora, salvo indicação, e com o ator como Proprietário); Proveniência gravada (RN-PAI-04). Substitui "Template de Painel", que o catálogo de A8 não prevê (DO-PAI-03).
- **Widget copiado entre Painéis**: cria Widget novo no destino (Identificador local novo), sem Proveniência (o Widget não tem identidade que valha a pena rastrear).

Um Painel de contexto pode ser criado a partir da Âncora (Lista, Funil, Fila...) pelo produto; ontologicamente é a criação do zero com Âncora preenchida.

### 12.2 Edição

Adicionar, alterar, reordenar e remover Widgets; alterar Leiaute, nome, descrição; anexar, trocar ou remover Âncora (exige `ver` sobre a nova âncora; remover uma Âncora `eliminada` é a única forma de apagar o seu valor). Cada ato gera Registro de Atividade com o Painel como objeto e o Widget (Identificador local, título) como detalhe (RN-PAI-23). Não há versionamento de Painel nesta versão (seção 25).

### 12.3 Transições de estado

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | `administrar` | Registro de Atividade. Painel some da navegação da Âncora e de listagens correntes; consultável. Compartilhamentos preservados. |
| `arquivado` | `ativo` | `administrar` | Registro de Atividade. |
| `ativo` ou `arquivado` | `na lixeira` | `excluir` | Estado anterior à exclusão gravado; Previsão de eliminação; Registro de Atividade. Oculto para todos, exceto quem tem `excluir`. |
| `na lixeira` | estado anterior | `excluir` | Devolve `ativo` ou `arquivado`, nunca força `ativo` (B43 por analogia). Âncora e Fontes são reavaliadas (podem ter mudado de validade). |
| `na lixeira` | eliminação permanente | Sistema (fim do prazo) ou `administrar` (antecipada) | 12.5. |

### 12.4 Âncora, sucessão e transferência

- **Âncora movida** (Lista para outra Pasta ou Espaço; Pasta rebaixada a Subpasta — B40): a Âncora acompanha por identidade; nada muda no Painel; as Fontes que referenciavam a âncora seguem válidas; Widgets que segmentam por "Espaço" ou "nível" passam a mostrar o novo valor na próxima consulta (comportamento correto, não inconsistência — documento 04, 20.10).
- **Âncora arquivada / na lixeira**: validade `arquivada` / `indisponível` (7.8); o Painel permanece `ativo`; os Widgets com Fonte na âncora seguem DO-ESP-13 (arquivada: calculam, com indicação; lixeira: vazios, "fonte indisponível").
- **Âncora eliminada** (DO-PAI-07): a Âncora passa a `eliminada` (validade derivada; identificador e nome à época permanecem como valor); Widgets com Fonte na âncora eliminada passam a `inválido`; evento "Âncora eliminada" e notificação ao Proprietário, que decide reapontar, remover a Âncora ou excluir o Painel. O Painel **não** é eliminado e **nada é reescrito pelo Sistema** (RN-PAI-20); deixa de aparecer na navegação da âncora (que não existe) e passa a ser listado como Painel do Espaço de Trabalho (distinção derivada, seção 6). Justificativa: diferentemente da Automação (B41), cujo escopo delimita o Gatilho e é constituinte do seu significado, o Painel tem Proprietário, permissões próprias e pode conter Widgets sobre outras Fontes; eliminá-lo por operação sobre outro agregado seria cascata destrutiva por organização (princípio de RN-ET-17). É o mesmo tratamento que a Sessão de Chat dá à sua âncora eliminada (documento 16, 12.6; DO-CHT-03). A alternativa "desanexar pelo Sistema" é rejeitada porque reconfiguraria o Painel sem ato humano e tornaria a validade `eliminada` inalcançável.
- **Proprietário removido**: sucessão no mesmo ato (B28; RN-ET-09a); o Sucessor recebe `administrar` por propriedade; compartilhamentos e concessões do Painel não mudam; Registro de Atividade "Proprietário transferido" com causa `sucessão`.
- **Transferência de propriedade**: ato do Proprietário ou de Membro com Papel de nível Administrador, para Membro `ativo` sem base Convidado (RN-PAI-05); a concessão `administrar` (co-gestão) não transfere.

### 12.5 Eliminação permanente e cascata

Elimina, no mesmo ato: o Painel; todos os Widgets, o Leiaute e a Âncora; concessões e compartilhamentos sobre o Painel. **Não** elimina nada do que o Painel lia: Listas, Funis, Filas, registros, catálogos e Registros de Atividade permanecem intactos, e os Registros de Atividade sobre o Painel continuam a referenciar o seu identificador (INV-ET-12). Painéis copiados a partir dele mantêm a Proveniência como valor. Não há Automação, Sessão, Vínculo ou Execução que dependa do Painel (INV-PAI-06).

### 12.6 Cascata recebida

| Evento externo | Efeito no Painel |
| --- | --- |
| Escopo de Fonte arquivado / restaurado | Disponibilidade `arquivada` / `disponível` (11.2). Sem ato. |
| Escopo de Fonte na lixeira / restaurado | `indisponível` / `disponível`. Sem ato. |
| Escopo de Fonte eliminado (Lista, Funil, Fila, Agente, Automação, Coleção, Espaço...) | Widgets com essa Fonte: `inválido` (causa "fonte eliminada"). Evento "Fonte de Dados invalidada" ao Proprietário. Painel permanece. |
| Registro âncora arquivado / na lixeira / eliminado | Âncora `arquivada` / `indisponível` / `eliminada` (7.8); Painel permanece com o mesmo estado; na eliminação, evento "Âncora eliminada" ao Proprietário (12.4). Sem ato do Sistema sobre o Painel. |
| Definição de Campo, Definição de Status, Tag, Origem, Qualificação, Motivo, Habilidade eliminados | Widgets que os usam como Métrica, Dimensão ou Filtro: `inválido`; restaurados da lixeira antes da eliminação, `válido` de novo sem ato (RN-PAI-20). |
| Conjunto de Status alterado; Etapas reordenadas | Nada gravado muda; Métricas por categoria e por Registro à época continuam corretas (RN-PAI-11; DO-FUN-13). |
| Localidade alterada | Períodos relativos e Dimensões de tempo passam a ser lidos no novo fuso na próxima consulta (RN-ET-16). |
| Membro removido (Responsável, Atribuído, Ator) | Registros e Dimensões continuam a exibi-lo como `removido` (A6.4). Como Proprietário: sucessão (12.4). |
| Espaço de Trabalho suspenso | Nenhum Membro consulta (B31). Painel intacto. |
| Espaço de Trabalho eliminado | Painel eliminado (B32). |

## 13. Regras de negócio ontológicas

- **RN-PAI-01.** O Painel pertence a exatamente um Espaço de Trabalho, imutavelmente, e todo escopo de Fonte, Âncora e catálogo referenciado pertence ao mesmo Espaço de Trabalho (INV-ET-07).
- **RN-PAI-02.** O Painel não grava nenhum valor derivado de outra entidade. O que exibe é calculado a cada consulta (ou reflete uma atualização cujo momento é declarado — RN-PAI-19).
- **RN-PAI-03.** O Criador de um Painel é sempre um Membro `ativo`. Agente, Automação e plataforma não criam nem editam Painéis: Painel é leitura humana, não Ação nem Ferramenta de escrita (DO-PAI-08; RN-PAI-25); a criação do Espaço de Trabalho não instancia Painéis.
- **RN-PAI-04.** Reutilização é por **cópia com Proveniência** (identificador e nome do original à época), sem vínculo vivo: alterar o original não altera a cópia. Copiar exige `ver` sobre o original e `criar` Painéis. Não existe Template de Painel (DO-PAI-03).
- **RN-PAI-05.** O Proprietário é sempre um Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (INV-ET-03); transferência é ato do Proprietário ou de Membro com Papel de nível Administrador, para Membro `ativo` sem Papel de base Convidado; sucessão na remoção (B28), para Sucessor sem base Convidado. A concessão `administrar` não transfere. Agente nunca é Proprietário (B7). O rebaixamento de um Proprietário a Papel de base Convidado é questão transversal (seção 25).
- **RN-PAI-06.** Quantidade de Widgets por Painel, de escopos por Fonte, de Painéis por Espaço de Trabalho e Limite de `lista de registros` são **Limites impostos** (B34), verificados no ato que os consumiria (RN-ET-23), nunca constantes da ontologia. Atingir o limite rejeita o ato com evento; nunca remove Widgets.
- **RN-PAI-07.** Toda Fonte de Dados referencia a entidade-alvo e os escopos por identidade; nome e caminho são resolvidos na consulta com as permissões do visualizador.
- **RN-PAI-08.** Toda Métrica agrega um atributo nativo ou derivado que a entidade-alvo define no seu documento, ou Registros de Atividade dela. O Painel não define derivados por registro; consome-os. "Tempo humano + tempo de IA" por Tarefa é Métrica de duas Fontes (B42), não atributo.
- **RN-PAI-09.** Métricas sobre status usam a **categoria** (A4.3) sempre que a Fonte abrange Listas com Conjuntos de Status efetivos distintos; Métricas históricas usam a Definição e a categoria gravadas no Registro à época.
- **RN-PAI-10.** Um registro entra no cálculo de um Widget se, e somente se, o visualizador tem `ver` sobre ele no momento da consulta, avaliado com as suas permissões efetivas (B20; A9.3 para Agentes em nome de Membro). Para Fonte "Registro de Atividade", vale o `ver` sobre o **objeto** do Registro (objeto eliminado: RN-PAI-30); para Mensagem, o `ver` sobre a Conversa e, para `interna`, a visibilidade de nota interna; para Execução, o `ver` sobre o Agente ou a Automação, e o delegante vê a própria Execução (documento 17, 17.4); para Solicitação de Aprovação, o `ver` sobre a Execução que a contém, e o aprovador designado e o Decisor veem a própria Solicitação (documento 17, 7.6).
- **RN-PAI-11.** A Dimensão "Definição de Status" e a ordenação de `funil` (gráfico) por Definição só são oferecidas quando todos os contêineres do escopo resolvem o mesmo Conjunto de Status efetivo (B45); caso contrário, o Widget segmenta por categoria.
- **RN-PAI-12.** Um Widget cujo escopo abrange contêineres com caminhos efetivos distintos só usa como Métrica, Dimensão ou Filtro: atributos nativos e derivados da Tarefa, Tags, e **Definições de Campo cujo ponto de definição é ancestral comum de todos os contêineres do escopo** (aplicam-se a todas as Tarefas do conjunto — B25, B44). Duas Definições homônimas de Espaços distintos são Definições distintas e nunca são unificadas pelo Painel (C14).
- **RN-PAI-13.** Métricas sobre Valor de Negócio (soma, média, valor ponderado) produzem **uma série por moeda**; o Painel nunca converte moedas (DO-NEG-04). A moeda da Localidade é apenas o rótulo padrão de exibição.
- **RN-PAI-14.** Durações são em tempo de calendário no fuso da Localidade. "Horas úteis" só é oferecido para Fontes cuja entidade dispõe de Horário de atendimento (Conversa, Mensagem — documento 14, 6); para as demais, depende de C12.
- **RN-PAI-15.** Fontes em Documento de Conhecimento e Coleção admitem apenas Métricas de catálogo e uso (contagem, estado, Versões, Atualizações, consultas por Execução). Nenhum Widget exibe, resume, indexa ou agrega **conteúdo** de Documento, Fragmento, Mensagem, Mensagem de Chat, Comentário ou Memória. `lista de registros` sobre Documento exibe título e metadados, nunca conteúdo.
- **RN-PAI-16.** Um registro com N valores em uma Dimensão multivalorada (Responsáveis, Tags, seleção múltipla, Contatos vinculados) conta em cada valor; o total do Widget indica que a soma das partes pode exceder o total de registros. Um registro sem valor conta em "sem valor".
- **RN-PAI-17.** Subtarefas entram na Fonte só quando "incluir Subtarefas" é verdadeiro (DO-STA-09); então cada Tarefa conta uma vez, pelo seu próprio Responsável, status e datas; nada é propagado do pai (documento 07, 20.9).
- **RN-PAI-18.** Filtros interativos são estado de sessão do visualizador: não gravados, não compartilhados, não auditados, restritivos sobre os Filtros fixos e nunca ampliadores.
- **RN-PAI-19.** Toda consulta a um Painel expõe o **Momento de referência dos dados**. Se a plataforma exibir dados de uma atualização anterior à consulta, o momento exibido é o da atualização. O Painel nunca apresenta um número sem o seu momento.
- **RN-PAI-20.** A validade de um Widget é derivada a cada consulta. Nenhum ato do Sistema apaga ou reconfigura Widgets: um Widget inválido permanece, com causa, até edição humana; a restauração do que o invalidou o revalida.
- **RN-PAI-21.** Nenhuma Fonte, Filtro ou Dimensão cruza a fronteira do Espaço de Trabalho (INV-ET-07). Painel consolidado entre Espaços de Trabalho não existe (C1).
- **RN-PAI-22.** Um Agente não usa o Painel como Fonte de Dados: lê as entidades por Ferramenta, com as suas permissões (B19; A6.3). Uma Ferramenta "ler Painel", se a plataforma a oferecer, entrega ao Agente a **configuração** dos Widgets e recalcula cada um com as permissões efetivas do Agente (interseção com o delegante — A9.3; documento 01, 17.3); nunca entrega os números que um Membro viu.
- **RN-PAI-23.** Criação, edição de Widget ou Leiaute, mudança de Âncora, compartilhamento, concessão, transferência de propriedade, arquivamento, exclusão, restauração e eliminação geram Registro de Atividade com o Painel como objeto (A6.2). Consultar um Painel não gera Registro nesta versão (seção 25).
- **RN-PAI-24.** Exportar um Painel (ou Widget) para artefato estático é ato registrado (Registro de Atividade com Painel, Widgets exportados, formato e Momento de referência), porque o artefato deixa de obedecer a B20. O artefato não é entidade da ontologia.
- **RN-PAI-25.** O Painel não emite Eventos consumíveis por Gatilho de Automação, não é escopo de Automação, não é âncora de Sessão de Chat (DO-CHT-02) e não é Recurso de Ferramenta de escrita. "Métrica abaixo de X" é Gatilho `condição temporal` (DO-AUT-03) sobre as entidades.
- **RN-PAI-26.** Um Painel `arquivado` continua a derivar dados atuais quando consultado: arquivar não congela números. Congelar números é exportar (RN-PAI-24).
- **RN-PAI-27.** A Âncora acompanha a movimentação do registro âncora; a eliminação do registro âncora torna a Âncora `eliminada` como valor (DO-PAI-07) e nunca elimina nem reconfigura o Painel.
- **RN-PAI-28.** Em Espaço de Trabalho `suspenso`, Painéis não são consultados por Membros, Agentes ou Automações (B31); a suspensão não altera a configuração.
- **RN-PAI-29.** Toda referência da configuração de um Painel — Âncora, escopos de Fonte, valores de Filtro fixo, Dimensões e ordenações de catálogo (Etapas, Definições de Status, opções de Definição de Campo) — a registro ou catálogo sobre o qual o visualizador não tem `ver` resolve, para ele, como "sem acesso": sem nome, sem contagem e sem indicação de existência; o Widget que dela depende não é calculado nem desenhado. Generaliza "fonte sem acesso" (11.2) a toda a configuração, por B38a e B61.
- **RN-PAI-30.** Um Registro de Atividade cujo objeto foi eliminado permanentemente não entra em nenhum Widget: não há Recurso sobre o qual avaliar `ver`. Métricas de eliminação ("Tarefas eliminadas por mês") são auditoria pela visão de Registros de Atividade (documento 01), não Painel (seção 25).
- **RN-PAI-31.** O nome do Painel é único entre Painéis `ativo` e `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e de espaços nas extremidades; `na lixeira` não reserva o nome; criar, renomear, copiar e restaurar com colisão são rejeitados até renomear (B39 por analogia; DO-PAI-02).

## 14. Invariantes

- **INV-PAI-01.** Nenhum valor derivado de outra entidade é gravado no Painel ou em um Widget. O Painel armazena apenas configuração (nome, descrição, Âncora, Widgets, Leiaute, Proveniência, estado).
- **INV-PAI-02.** Toda Fonte de Dados referencia escopos por identidade dentro do mesmo Espaço de Trabalho; nenhuma Fonte contém registros.
- **INV-PAI-03.** Nenhum registro fora do Painel referencia um Widget: não há Vínculo, menção, âncora, Gatilho, Ferramenta, concessão ou Registro de Atividade que tenha Widget como objeto raiz.
- **INV-PAI-04.** Nenhum registro com estado `na lixeira` (efetivo, onde exista — B36, DO-CNH-09; próprio no CRM — DO-NEG-09), nenhum Contato ou Empresa `mesclado` (B14) e nenhum Registro de Atividade de objeto eliminado (RN-PAI-30) entra em qualquer Métrica, Dimensão, Filtro ou `lista de registros`.
- **INV-PAI-05.** Todo Widget tem exatamente um tipo de Visualização de dados e satisfaz os requisitos de Fonte, Métricas e Dimensões desse tipo (7.9).
- **INV-PAI-06.** Painel não é Ator, não emite Eventos de Gatilho, não é escopo de Automação, não é Fonte de Agente, não é Recurso de escrita: nenhuma entidade da plataforma **depende** de um Painel para existir ou operar.
- **INV-PAI-07.** O conjunto de registros que um Widget considera para um visualizador é subconjunto do que esse visualizador vê pelas suas permissões efetivas no momento da consulta. Nenhum Filtro, Fonte, compartilhamento, propriedade ou Âncora amplia esse conjunto (B20).
- **INV-PAI-08.** Todo Painel tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (INV-ET-03).
- **INV-PAI-09.** Um Painel tem no máximo uma Âncora, do mesmo Espaço de Trabalho, de tipo Espaço, Pasta, Subpasta, Lista, Funil ou Fila. A Âncora nunca é origem de permissão, de estado ou de contenção do Painel.
- **INV-PAI-10.** Um Widget cruza no máximo uma entidade-alvo; agregações entre entidades ocorrem por Fontes distintas em Widgets distintos.
- **INV-PAI-11.** Toda consulta a um Painel carrega um Momento de referência dos dados igual ou anterior ao momento da consulta.
- **INV-PAI-12.** Métricas sobre Valor nunca somam quantias de moedas distintas.

## 15. Personalização

**Personalizável** (por quem tem a permissão indicada):

- Nome, descrição, Âncora (`editar`; a Âncora exige `ver` sobre o registro âncora).
- Widgets: tipo, Fonte, Métricas, Dimensões, Filtros fixos, Período, Atributos exibidos, Ordenação, Limite, título, Conteúdo (`editar`).
- Leiaute (`editar`).
- Compartilhamentos e concessões (`administrar`).
- Proprietário (ato do Proprietário ou de Papel de nível Administrador — RN-PAI-05).
- Filtros interativos (qualquer visualizador; não gravados — RN-PAI-18).

**Não personalizável:**

- Identificador, Criador, Proveniência, Momentos.
- Estados e transições; a regra de estado anterior à exclusão.
- O catálogo de entidades-alvo, de agregações e de tipos de Visualização de dados (da plataforma).
- O filtro por permissões do visualizador (B20): nenhuma configuração o desliga, nem "calcular como o Proprietário".
- O Momento de referência (sempre declarado).
- Leiaute por visualizador; Widgets "pessoais" dentro de Painel compartilhado (seção 25).

Não há Campos Personalizados nem Tags sobre Painel (A5.2, A8). Não há Status (A4.2).

## 16. Herança

O Painel **não herda** de nenhum contêiner: não está na Estrutura de Trabalho (A2.2) e a Âncora não é pai (INV-PAI-09). Recebe do Espaço de Trabalho apenas o que todo registro recebe: Localidade (fuso para Períodos e Dimensões de tempo; moeda como rótulo; idioma como padrão de apresentação — RN-ET-15) e Política de lixeira (B34).

O que o Painel **lê** de herança alheia, sem herdar: o Conjunto de Status efetivo e as Definições de Campo efetivas de cada Lista do escopo (B25, B45) — resolvidos a cada consulta pela Lista, não pelo Painel. É isso que fundamenta RN-PAI-11 e RN-PAI-12: quando o escopo mistura caminhos efetivos distintos, só o que é comum a todos (categoria, nativos, Tags, Definições de ancestral comum) é agregável.

Widgets não herdam nada do Painel além de existir nele: Filtros fixos e Períodos são por Widget; um "Período do Painel" aplicado a todos os Widgets é Filtro interativo de sessão (7.5), não configuração herdada.

## 17. Permissões e visibilidade

### 17.1 O Painel como Recurso

| Ação | Permite | Não permite |
| --- | --- | --- |
| ver | Consultar o Painel (Widgets calculados com as próprias permissões; referências sem acesso resolvem sem nome — RN-PAI-29); aplicar Filtros interativos; copiar para Painel próprio (exige também `criar` — RN-PAI-04); exportar (registrado). | Ver os dados que as próprias permissões não alcançam (INV-PAI-07). |
| editar | Alterar nome, descrição, Âncora, Widgets, Leiaute. | Compartilhar, conceder, arquivar, excluir, transferir. |
| excluir | Enviar à lixeira; restaurar. | Eliminar antecipadamente. |
| administrar | Compartilhar e conceder; arquivar e desarquivar; eliminar antecipadamente. | Transferir propriedade (ato do Proprietário ou de Papel de nível Administrador — RN-PAI-05). Ampliar o que o Painel mostra: `administrar` sobre o Painel não dá `ver` sobre nenhuma Fonte. |

Cada Ação inclui as anteriores na ordem ver, editar, excluir, administrar. Escopo: `registro` (o Painel). `subárvore` não se aplica (não há descendentes). `próprios` (B29) aplica-se: "ver os Painéis de que sou Proprietário ou Criador".

O Proprietário tem `administrar` por propriedade. Agentes recebem no máximo `ver` (para a Ferramenta de leitura de RN-PAI-22); nunca `editar`, `criar` ou `administrar` — Painel não é Recurso de Ferramenta de escrita (RN-PAI-25; DO-PAI-08) e Agentes não compartilham Recursos (padrão de B38 e RN-FUN-17).

### 17.2 Origens e padrão recomendado

- **Papel** (origem "papel"; recomendação, produto pode ajustar): Proprietário do Espaço de Trabalho e Administrador — `ver` e `administrar` sobre todos os Painéis (governança: sucessão, arquivamento de Painéis órfãos, auditoria de compartilhamentos). Membro — `criar` Painéis; `ver`/`editar`/`excluir`/`administrar` sobre os `próprios`; nada sobre os demais sem compartilhamento. Convidado — nada por Papel (documento 01, 17.2).
- **Compartilhamento** (origem "compartilhamento"): com Membros, Equipes ou Papéis, em `ver` ou `editar`. É a única forma de um Painel chegar a quem não é Proprietário nem Administrador.
- **Concessão direta**: `administrar` a Membro ou Equipe (co-gestão do Painel).
- **Herança**: não existe (seção 16). A Âncora não transmite `ver`: quem vê a Lista não vê automaticamente os Painéis de contexto dela, e quem vê o Painel de contexto não vê a Lista por isso (INV-PAI-09). O produto pode oferecer, na criação, "compartilhar com quem tem acesso à âncora" como **ato de compartilhamento explícito** com os Sujeitos atuais — nunca como regra viva (seção 25).

**Painel não pode ser marcado privado**: não é necessário, porque não é visível por padrão a ninguém além do Proprietário e dos Papéis de governança, e porque não contém dados (B20 já impede vazamento). Administradores veem a **configuração** de todo Painel; os **nomes** de escopos que não veem resolvem como "fonte sem acesso" (mesmo padrão de documento 17, 17.4).

### 17.3 Compartilhamento e dados (B20)

Compartilhar um Painel compartilha a **configuração**, nunca os dados. Cada Widget é calculado, para cada visualizador, sobre os registros que ele vê (RN-PAI-10). Consequências assumidas:

- Dois Membros veem números diferentes no mesmo Widget. É comportamento, não erro (20.4).
- Um Convidado com o Painel compartilhado vê o Painel e, em geral, Widgets vazios, salvo as Fontes que também lhe foram compartilhadas (documento 01, 20.5; 20.3).
- **Nomes de escopos, Âncora, Etapas e valores de Filtro sem acesso não são exibidos** (RN-PAI-29): compartilhar a configuração não revela a existência do que o visualizador não vê.
- **Não há indicador derivado de "registros ocultos por permissão"** (DO-PAI-09). Justificativa: um indicador calculado revelaria a existência de registros e contêineres privados que B38a manda não revelar ("não sabe que existe"; documento 03, seção 17: nome não revelado em Painéis), e permitiria a um Convidado sondar a existência de dados construindo Widgets. Em seu lugar, todo Painel carrega a **declaração fixa, não derivada**, de que os valores refletem as permissões do visualizador e o Momento de referência. Alternativa rejeitada: indicador booleano "há dados que você não vê" — vazamento de existência, contrário a B38a.
- **Compartilhamento público por link não existe nesta versão** (DO-PAI-10). Um endereço público não tem Sujeito; B20 exige um visualizador com permissões efetivas; "dados públicos" calculados com as permissões de alguém (o Proprietário) seriam exatamente o canal de vazamento que B20 proíbe. A variante "link público para dados estáticos" é um artefato exportado (RN-PAI-24) com distribuição fora da plataforma — fora da ontologia — e, se o produto quiser hospedá-la, é entidade futura (seção 25).

### 17.4 IA sujeita às mesmas regras

Um Agente que "resume o Painel" recalcula cada Widget com as suas permissões efetivas (interseção com o Membro delegante — A9.3; B23 por Ferramenta), nunca lê os números do Membro (RN-PAI-22); referências sem acesso resolvem para ele como para qualquer visualizador (RN-PAI-29). Um Agente invocado por Automação (autônomo) que use a Ferramenta de leitura usa só as próprias permissões. Nenhum Agente cria ou edita Painel (RN-PAI-03; DO-PAI-08): recomenda, e o Membro configura. Automação não lê Painel (não há Ação "ler Painel") e não é disparada por ele (RN-PAI-25).

### 17.5 Exceções

Nenhuma. A exportação total pelo Proprietário do Espaço de Trabalho (documento 01, 17.2) inclui a configuração dos Painéis, não os seus valores derivados.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Painel criado | 12.1 | identificador, nome, Proprietário, Criador, Âncora, Proveniência | Auditoria; Limites; navegação da Âncora |
| Painel renomeado / descrição alterada | 12.2 | antes, depois, ator | Auditoria |
| Widget adicionado / alterado / removido | 12.2 | Identificador local, título, tipo, Fonte (entidade, escopos), Métricas, Dimensões, Filtros, Período (antes/depois), ator | Auditoria |
| Leiaute alterado | 12.2 | ator | Auditoria (evento agregado por sessão de edição, recomendação) |
| Âncora definida / alterada / removida | 12.2 | antes, depois, ator | Navegação; auditoria |
| Âncora indisponível / eliminada | 12.4, 12.6 (registro âncora na lixeira ou eliminado) | Painel, âncora (tipo, identificador, nome à época), causa, Widgets invalidados | Proprietário (notificação); auditoria |
| Fonte de Dados invalidada / revalidada | 12.6 | Widget, causa (escopo ou catálogo eliminado / restaurado), Sistema | Proprietário (notificação); produto |
| Painel compartilhado / compartilhamento revogado; permissão concedida / revogada | 17 | Sujeito, Ação, ator | Auditoria; Execuções em curso (B23) |
| Proprietário transferido | 12.4 | antes, depois, causa (`transferência`, `sucessão`), ator | Notificação; auditoria |
| Painel arquivado / restaurado | 12.3 | ator | Auditoria; navegação |
| Painel enviado à lixeira / restaurado / eliminado | 12.3, 12.5 | ator, previsão de eliminação; Estado anterior à exclusão; na eliminação, Widgets eliminados | Auditoria; Limites |
| Painel exportado | RN-PAI-24 | Painel, Widgets, formato, Momento de referência, ator | Auditoria |
| Limite atingido | RN-PAI-06 | limite, valor, ator | Proprietário; plataforma (RN-ET-23) |

Todos geram Registro de Atividade com o Painel como objeto e o Widget como detalhe (A6.2). **Nenhum evento de Painel é Gatilho de Automação** (RN-PAI-25). Consultar um Painel e aplicar Filtros interativos não são eventos (RN-PAI-18, RN-PAI-23).

## 19. Dependências

**O Painel depende de:** Espaço de Trabalho (pertencimento, Localidade, Política de lixeira, Limites — documento 01); Membro (Proprietário; sucessão B28); o catálogo de entidades-alvo e dos seus atributos derivados, definidos nos documentos 02–20 (o Painel consome, nunca define); categorias de status (A4.3); Registros de Atividade com valores à época (DO-FUN-13; documento 05, 18); a plataforma (catálogos de agregações e de tipos de Visualização de dados; Limites).

**Dependem do Painel:** nada (INV-PAI-06). Widgets, Leiaute e Âncora são internos. Painéis copiados guardam Proveniência como valor.

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) — confirma Painel na lista de propriedades sucedidas (DO-ET-04) e 20.5; recebe RN-PAI-24 como complemento à exportação registrada; Espaço, Pasta, Subpasta, Lista (02–05) — obedece a DO-ESP-13 (arquivado válido; lixeira indisponível; eliminado inválido), B40 (âncora acompanha), B44/C14 (RN-PAI-12); Tarefa, Subtarefa, Checklist (06–08) — consome os derivados de 6.1, DO-STA-09 (RN-PAI-17), DO-CHK-08 (Checklist só como Métrica), e responde à questão 25.2 do documento 08 (20.16); CRM (10–14) — obedece a DO-CRM-15, DO-FUN-12/13, DO-NEG-04/09, DO-EMP-06, DO-CON-05 e aos derivados de tempo de Conversa; decide C22 para Painéis (RN-PAI-13; DO-PAI-13) e C23 para Painéis (20.17); IA (15–20) — obedece a B18 (Execução como Fonte), B80 (Solicitação de Aprovação contada por Painéis), B79 (custo por Cadeia de Execuções derivado), DO-AGE-13 (Ensaios separados), DO-HAB-11 (Exercício via Execução), DO-CNH-15 ("Conhecimento consultado" derivado das Referências), DO-CHT-13 (Sessão nunca), DO-CNH-01 e RN-PAI-15 (Conhecimento só catálogo), DO-AUT-03 (condição temporal, não Painel); fixa para o documento 17 a Ferramenta `ler Painel` como leitura com recálculo (DO-PAI-17; documento 17, 17.3).

## 20. Casos limítrofes e ambiguidades

### 20.1 Painel cuja Fonte é um Espaço arquivado

Aplicação de DO-ESP-13. A Fonte permanece válida com disponibilidade `arquivada`: as Tarefas do Espaço têm estado efetivo `arquivado` e entram no cálculo **apenas** se "incluir arquivados" for verdadeiro na Fonte; com o padrão (falso), o Widget mostra zero com a indicação "fonte arquivada". Leituras históricas ("quanto entregamos no projeto encerrado") ligam a inclusão. Se o Espaço for à lixeira, `indisponível`; eliminado, Widget `inválido`.

### 20.2 Widget contando Tarefas com e sem Subtarefas

"12 Tarefas atrasadas" não pode depender da granularidade com que cada Equipe decompõe. Por DO-STA-09 (RN-PAI-17), a Fonte exclui Subtarefas por padrão: conta Tarefas raiz. Com "incluir Subtarefas", cada Tarefa conta uma vez pelos próprios atributos, e "nível", "raiz" e "tem pai" ficam disponíveis; "Tarefas por raiz" é a forma de ver "tudo que está sob a entrega X". Dois Widgets lado a lado, um com e outro sem inclusão, são válidos e mostram números distintos por definição — o título de cada um deve dizê-lo (produto).

### 20.3 Painel compartilhado com Convidado

O Convidado vê o Painel (configuração, títulos, Leiaute). Cada Widget é calculado sobre o que ele vê: se só a Lista "Notas fiscais" lhe foi compartilhada, o Widget dessa Lista mostra dados e os demais mostram vazio com "fonte sem acesso" — sem nome do escopo (documento 01, 20.5; exemplo 5). Compartilhar o Painel **não** compartilha a Lista; compartilhar a Lista **não** compartilha o Painel (17.2). Não há indicador de "há mais dados" (DO-PAI-09).

### 20.4 Dois Membros vendo o mesmo Painel com números diferentes

Esperado e correto (B20; INV-PAI-07). Ana, Administradora, vê "valor em aberto: R$ 1,2 mi"; Rui, com escopo `próprios` sobre Negócios, vê "R$ 180 mil" no mesmo Widget. O Painel não é fonte de verdade sobre "o total": é fonte de verdade sobre "o total que você vê, agora". Reuniões que exigem um número único usam o Painel de quem tem o escopo mais amplo, ou exportam (registrado). Um produto que oferecesse "calcular como o Proprietário" violaria B20 e é rejeitado (seção 15).

### 20.5 Proprietário do Painel removido

Sucessão no mesmo ato (B28; RN-ET-09a): o Painel passa ao Sucessor, com Registro de Atividade "Proprietário transferido" (causa `sucessão`). Compartilhamentos e concessões do Painel permanecem; as concessões que o removido tinha sobre **outros** Recursos são revogadas, o que não afeta o Painel (que nunca calcula com as permissões do Proprietário). Se o Sucessor vê menos do que o removido via, verá menos no Painel — B20, não perda de dados.

### 20.6 Widget sobre Definição de Campo removida

O Widget passa a `inválido` com causa "Definição eliminada"; permanece no Painel; não é calculado (RN-PAI-20). Enquanto a Definição está `na lixeira` (RN-ESP-07: Valores retidos), o Widget também é `inválido` (a Definição não é efetiva), e volta a `válido` sem ato se ela for restaurada. Não é estado do Widget: é condição derivada a cada consulta (11.2). O Proprietário é notificado uma vez (evento "Fonte de Dados invalidada").

### 20.7 Métrica de conversão após reordenar Etapas

DO-FUN-13: os Registros "entrou/saiu de Etapa" gravam Etapa por identidade, nome e Ordem à época. A taxa "Proposta → Negociação" soma os mesmos Registros antes e depois da reordenação. O que pode mudar é a classificação avanço/retrocesso de transições **futuras**; as passadas mantêm a classificação gravada. Um `funil` (gráfico) por Etapa usa a Ordem **atual** para dispor as barras e os Registros à época para os valores — e o Widget indica quando houve reordenação no Período (derivado dos Registros "Etapa reordenada"). Nada é reescrito.

### 20.8 Negócios em moedas diferentes

RN-PAI-13 / DO-NEG-04: "soma de Valor" no Funil "Exportação" com Negócios em BRL e USD produz duas séries (BRL 340 mil; USD 52 mil); um `número` com uma Métrica de Valor sobre Fonte multimoeda exibe um valor por moeda. Somar exigiria taxa e data de referência, que nenhuma entidade fornece: C22 fica decidida para Painéis (sem conversão) e restrita à configuração de câmbio (seção 25).

### 20.9 Painel com 50 Widgets

Válido até o Limite imposto (RN-PAI-06). O 51º, se o teto for 50, é rejeitado com evento "Limite atingido" — nunca há remoção automática. A ontologia não fixa o número: a plataforma o define (B34), e o Painel está sujeito. Painéis grandes são sinal de que a organização precisa de vários Painéis; o produto pode sugerir divisão, a ontologia não impõe.

### 20.10 Widget sobre Registro de Atividade de Membro removido

Os Registros permanecem com o Membro `removido` como Ator (A6.4; INV-ET-12). A Dimensão "Ator" o exibe com o nome que tinha e a marca de removido; Métricas "ações por Ator" continuam a atribuí-las a ele; nenhum Sucessor "herda" autoria (documento 01, 20.1). Se ele voltar (mesmo Membro reativado, B27), os mesmos Registros resolvem para um Membro `ativo`, sem migração.

### 20.11 Painel ancorado a Lista movida para outro Espaço

A Âncora acompanha por identidade (RN-PAI-27; B40). O Painel continua a aparecer na navegação da Lista, agora no outro Espaço. Widgets cujo escopo era a Lista seguem válidos. Widgets que segmentavam por "Espaço" mostram o novo Espaço; Widgets sobre uma Definição de Campo do Espaço de origem passam a `inválido` para essa Lista se a Definição deixou de ser efetiva (RN-PAI-12; B37 arquiva os Valores) — e revalidam se a Lista voltar.

### 20.12 Painel ancorado a Lista eliminada

DO-PAI-07: a Âncora passa a `eliminada` (identificador e nome da Lista à época como valor); o Painel permanece, deixa de constar na navegação (a Lista não existe) e é listado como Painel do Espaço de Trabalho; Widgets com Fonte na Lista ficam `inválido` ("fonte eliminada"); o Proprietário é notificado e decide reapontar a Âncora, removê-la ou excluir o Painel. Nada é reescrito pelo Sistema (RN-PAI-20). Alternativas rejeitadas: (a) eliminar com a âncora, como Automação (B41) — o Painel tem Proprietário, permissões e possivelmente Widgets sobre outras Fontes, e eliminá-lo por operação sobre outro agregado é cascata destrutiva por organização (princípio de RN-ET-17); (b) desanexar pelo Sistema — reconfiguraria o Painel sem ato humano e tornaria a validade `eliminada` de 7.8 inalcançável; a Sessão de Chat segue o mesmo padrão (DO-CHT-03).

### 20.13 Agente pedindo "resumo do painel"

O Agente não lê os números do Membro. Recebe, por Ferramenta, a configuração dos Widgets e recalcula cada um com a interseção das suas permissões e das do Membro delegante (RN-PAI-22; A9.3). Se o Agente tem menos acesso, o resumo tem números menores que os do Membro — e o Agente deve dizê-lo (instrução de produto). O Agente que recomenda "criar um Widget de custo por Agente" descreve a configuração; quem a cria é o Membro (RN-PAI-03; DO-PAI-08). Nada disso grava valores (INV-PAI-01).

### 20.14 Painel usado como prova em auditoria

Não é prova. Um número de Painel é o resultado de um cálculo sobre o que **um** visualizador via em **um** momento (Momento de referência), sob uma configuração que pode ter mudado depois (não há versionamento de Painel — seção 25). A prova é o conjunto de Registros de Atividade (INV-ET-12), imutáveis e completos. A exportação registrada (RN-PAI-24) documenta que alguém viu tal número em tal momento — o que é fato sobre a consulta, não sobre a operação.

### 20.15 Painel cuja Fonte é Lista privada e visualizador Administrador sem concessão

B38a: o Administrador não vê a Lista privada nem sabe que existe. O Widget aparece vazio com "fonte sem acesso", sem nome, sem contagem, sem indicador de ocultação (DO-PAI-09). Se ele se conceder acesso por ato de governança registrado (B38b), o Widget passa a calcular na próxima consulta. O Painel não é atalho para dentro de contêiner privado.

### 20.16 "Progresso total da entrega" (questão 25.2 do documento 08)

O Painel oferece Progresso de Subtarefas e Progresso de Checklists como Métricas separadas da Tarefa, ambas derivadas nos seus documentos (DO-STA-06; DO-CHK-08). **Não** existe "progresso total" como derivado da ontologia: um único número exigiria pesar Subtarefas e Itens de Checklist entre si, e nenhum critério é neutro. Se o produto exigir um número, é Métrica composta de Widget (média das duas, ou fórmula declarada no Widget), nunca atributo da Tarefa — e é pendência registrada (seção 25).

### 20.17 Categoria de Qualificação (questão 25.2 do documento 10)

Para Painéis, a ausência de categoria fixa de Qualificação não é bloqueio: a Dimensão "Qualificação" segmenta por Definição (por identidade), estável dentro do Espaço de Trabalho, e "taxa de conversão de Contatos" é uma Métrica `taxa` cujo predicado ("Qualificação ∈ {Cliente, Cliente recorrente}") é escolhido pelo editor do Widget. A necessidade de categoria permanece para Automações e Agentes ("converteu" sem ler nomes) e fica com o documento 10.

### 20.18 Painel `arquivado` consultado meses depois

Mostra dados **atuais** (RN-PAI-26): arquivar preserva a configuração, não os números. Quem precisa de "como estava em março" precisa de um Período absoluto (março) sobre Registros de Atividade à época — o que o Painel faz — ou de uma exportação de março (RN-PAI-24). Não há "instantâneo" de Painel nesta versão (seção 25).

### 20.19 Painel de contexto de Funil privado compartilhado com quem não vê o Funil

Lia ancora o Painel "Aquisições — funil" ao Funil privado "Aquisições" e o compartilha em `ver` com Rui, que não tem `ver` sobre o Funil. Rui vê o Painel (nome e descrição, escolhidos por Lia; títulos e Leiaute). Para ele, a Âncora resolve como `indisponível` **sem nome** (7.8; RN-PAI-29); todo Widget com Fonte "Negócios do Funil Aquisições" aparece vazio com "fonte sem acesso", porque `ver` sobre o Funil privado é pré-requisito para ver os seus Negócios (B61); o `funil` (gráfico) por Etapa **não é desenhado** — as posições viriam do catálogo de Etapas do Funil, que Rui não vê (7.9; RN-PAI-29); um Filtro fixo "Etapa = Proposta" resolve como "sem acesso", sem exibir "Proposta". Rui não sabe quantas Etapas o Funil tem nem se há Negócios. Se Lia lhe conceder `ver` sobre o Funil (ato de governança registrado — B38b), tudo passa a calcular na próxima consulta. O compartilhamento do Painel nunca foi atalho para dentro do Funil privado (INV-PAI-07).

### 20.20 Widget "Tarefas eliminadas por mês" sobre Registros de Atividade

Os Registros "Tarefa eliminada" existem e são imutáveis (INV-ET-12), mas o seu objeto não existe mais: não há Recurso sobre o qual avaliar `ver` (RN-PAI-10). Por RN-PAI-30, esses Registros não entram em Painéis; a contagem de eliminações é consulta de auditoria sobre Registros de Atividade (documento 01), a quem os vê. Registros anteriores da mesma Tarefa (status alterado, tempo em status) saem do Painel no mesmo instante — coerente com "lixeira nunca conta" (INV-PAI-04): eliminado é menos que lixeira. Reabrir se o produto exigir Métricas de eliminação (seção 25).

### 20.21 Proprietário de Painéis rebaixado a Papel de base Convidado

Nenhum documento define o efeito de mudar o Papel de um Membro para base Convidado sobre os registros de que ele é Proprietário (Negócio, Agente, Coleção, Painel). Para o Painel, o rebaixamento não altera a propriedade nem quebra invariante (INV-PAI-08 exige Membro `ativo`/`suspenso`, não Papel): o Membro continua com `administrar` por propriedade sobre os **seus** Painéis, o que é inofensivo — B20 impede que veja dado algum além das suas permissões. Só a transferência e a sucessão exigem destinatário sem base Convidado (RN-PAI-05). A regra transversal é questão em aberto (seção 25).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Os dados exibidos (contagens, somas, tempos) | As entidades-alvo e seus Registros de Atividade | Derivados na consulta; nunca gravados (INV-PAI-01). |
| Atributos derivados por registro (Vencida, Dias em Etapa, Tempo de primeira resposta, Progresso) | Tarefa, Negócio, Conversa... | O Painel agrega; a entidade define (RN-PAI-08). |
| Categoria de status, Definições de Status, Conjuntos | Espaço, Pasta, Subpasta, Lista (A4.2, B45) | O Painel lê por categoria. |
| Definições de Campo, Tags, Origens, Qualificações, Motivos | Espaço de Trabalho e contêineres (A5, B5, B34) | Usados como Dimensão e Filtro. |
| Etapas e sua Ordem | Funil | Dimensão por identidade; Ordem à época nos Registros (DO-FUN-13). |
| Horário de atendimento, dias úteis | Caixa de Entrada / Fila (documento 14); C12 | O Painel consome; não define. |
| Taxa de câmbio, conversão de moeda | Fora da ontologia (pendência) | RN-PAI-13. |
| Filtros interativos e o estado de apresentação do visualizador | Sessão do visualizador | Não são configuração (RN-PAI-18). |
| Cache, materialização, agendamento de atualização | Infraestrutura | Só o Momento de referência é ontológico (RN-PAI-19). |
| Artefato exportado (PDF, planilha) | Fora da ontologia | Ato registrado; produto não é entidade (RN-PAI-24). |
| Registros de Atividade de objetos eliminados | Auditoria (documento 01) | Sem Recurso para `ver`; nunca em Painel (RN-PAI-30). |
| Compartilhamento público por link | Não existe nesta versão | DO-PAI-10. |
| Visualizações (de contêiner), Visualizações pessoais | Contêiner / Membro (A8) | Apresentação operacional, não análise. |
| "Métrica abaixo de X" como Gatilho | Automação (`condição temporal` — DO-AUT-03) | O Painel não dispara nada (RN-PAI-25). |
| Insight em texto gerado por IA | Execução de Agente (saída); entidade futura | Nesta versão, um Agente escreve em Comentário ou Mensagem de Chat, não em Widget (seção 25). |
| Membros, Equipes, Papéis como registros contados | Espaço de Trabalho (governança) | Só como Dimensão; nunca Fonte (7.2). |
| Sessões de Chat, Mensagens de Chat, Memória | Membro / Agente | Nunca Fonte (DO-CHT-13). |
| Exercício de Habilidade, Referência de Conhecimento, Cadeia de Execuções | Execução de Agente / de Automação (objetos de valor) | Dimensão, Filtro ou Métrica derivada; nunca entidade-alvo (DO-PAI-05). |
| Conteúdo de Documento, Fragmentos | Conhecimento | Só catálogo e uso (RN-PAI-15). |
| Itens de Checklist como registros | Tarefa (agregado) | Só Progresso de Checklists como Métrica (DO-CHK-08). |
| Permissão sobre as Fontes | Cada Recurso lido | `administrar` o Painel não dá `ver` sobre nada (17.1). |
| Contagem de consultas ao Painel | Não registrada nesta versão | RN-PAI-23; seção 25. |

## 22. Exemplos conceituais

**Exemplo 1 — Painel de contexto de uma Lista.** Na Lista "Implantação Norte" (Espaço "Operações"), Ana cria o Painel de contexto "Implantação Norte — andamento" (Âncora: a Lista). Widgets: `número` "Tarefas abertas" (Fonte: Tarefas da Lista; Métrica: contagem; Filtro fixo: categoria ∉ {`concluído`, `fechado`}); `barras` "por Responsável e categoria" (Dimensões: Responsável, categoria de status); `linhas` "concluídas por semana, últimas 8 semanas" (Período relativo; atributo de referência: Momento de conclusão); `lista de registros` "Vencidas" (Filtro: Vencida = verdadeiro; Ordenação: Data de vencimento; Limite 20). Ana compartilha com a Equipe "Implantação" em `ver`. O Agente "Provisionador", Responsável por 3 Tarefas, aparece na Dimensão Responsável como qualquer Ator. Quando a Lista é movida para o Espaço "Unidade Norte", o Painel a acompanha. Quando, um ano depois, a Lista é eliminada, a Âncora passa a `eliminada` ("Implantação Norte" fica como nome à época), os quatro Widgets ficam inválidos, Ana é notificada e o exclui.

**Exemplo 2 — Painel comercial com B20.** O Painel "Vendas do trimestre" (Painel do Espaço de Trabalho; Proprietária: Lia, diretora) tem `número` "Valor em aberto" (Fonte: Negócios do Funil "Novos pacientes"; soma de Valor; Filtro: situação = `aberto`), `número` "Ponderado", `funil` (gráfico) "Conversão por Etapa" (Fonte: Registros de Atividade "entrou em Etapa" do Funil; Período: trimestre corrente; Dimensão: Etapa), `barras` "Perdas por Motivo" e `tabela` "Ganhos por Proprietário e mês". Lia vê BRL 1,2 mi em aberto. Rui, vendedor com escopo `próprios`, vê BRL 180 mil no mesmo Widget. Um Negócio em USD aparece como segunda série em ambos. Quando a Administradora remove a Etapa "Qualificado" com remapeamento, o `funil` histórico continua a somar os Registros da Etapa removida (identidade e nome à época) e a exibi-la como "Qualificado (removida)". Um Convidado (contador externo) recebe o Painel: vê os títulos e Widgets vazios.

**Exemplo 3 — Painel de IA e atendimento.** O Painel "Operação de IA" tem `número` "Custo de Execuções, últimos 30 dias" (Fonte: Execuções de Agente do Espaço de Trabalho; soma de Custo; "incluir Ensaios" falso), `barras` "Execuções por Agente e resultado", `número` "Taxa de falha", `tabela` "Solicitações de Aprovação por aprovador e tempo médio até decisão" (Fonte: Solicitações de Aprovação dos Agentes do Espaço de Trabalho — DO-PAI-05), `número` "Custo por Cadeia de Execuções — Triagem" (Fonte: Execuções de Automação da Automação Triagem; soma das Execuções da Cadeia — B79), `barras` "Exercícios por Habilidade", e, do CRM, `número` "Tempo de primeira resposta (horas úteis) — Fila Recepção" (Fonte: Conversas da Fila; média; Período: mês; horas úteis pelo Horário de atendimento da Fila). Sessões de Chat não aparecem; as Execuções originadas nelas contam no custo sem expor nenhuma Mensagem. O Assistente padrão, a pedido de Lia, "resume o Painel": recalcula cada Widget com a interseção das permissões e responde — como não tem `ver` sobre o Agente "Aquisições", o seu custo total é menor que o de Lia, e o Assistente o declara.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Localidade (fuso → Períodos; moeda → rótulo) ── usada por ──►┐
├── Limites impostos (Widgets por Painel, Painéis, Limite de lista) ─►┤
│                                                                     │
└── PAINÉIS (domínio, não entidade)                                   │
    └── PAINEL (0..N)  [Proprietário 1 Membro; Criador Membro; nome único; estado: ativo | arquivado | na lixeira]
        ├── Âncora (0..1, objeto de valor) ──referência──► Espaço | Pasta | Subpasta | Lista | Funil | Fila
        │       (validade derivada por visualizador; acompanha movimentação; `eliminada` como valor na eliminação)
        ├── Leiaute (1, objeto de valor) ── posiciona Widgets por Identificador local
        ├── Proveniência (0..1) ──valor──► Painel copiado
        ├── concessões / compartilhamentos (0..N) ◄── Membro | Equipe | Papel | Agente (só `ver`)
        └── WIDGET (0..N ≤ Limite)  [Identificador local; sem identidade externa; validade derivada]
            ├── Tipo de Visualização de dados (1): número | barras | linhas | pizza | funil | tabela |
            │                                       lista de registros | calendário | texto
            ├── Fonte de Dados (1; 0 em texto) ──referência por identidade──►
            │     entidade-alvo × escopo(s):
            │       Tarefa ─────────► Lista(s) | Subpasta(s) | Pasta(s) | Espaço(s) | ET   [incluir Subtarefas: padrão não]
            │       Negócio ────────► Funil(is) | ET                                   [incluir arquivados: padrão sim]
            │       Contato, Empresa ► ET | grupo econômico (raiz)
            │       Conversa, Mensagem ► Fila(s) | Canal(is) | Caixa de Entrada
            │       Execução de Agente ► Agente(s) | ET                                [incluir Ensaios: padrão não]
            │       Execução de Automação ► Automação(ões) | ET
│       Solicitação de Aprovação ► Agente(s) | Automação(ões) | ET             [contada — B80]
            │       Registro de Atividade ► tipo de objeto + escopo do objeto
            │       Documento de Conhecimento ► Coleção(ões) | ET                     [só catálogo e uso]
            │     (nunca: Sessão de Chat, Memória, Item de Checklist, Membro, Painel, Fragmento;
│      Exercício, Referência de Conhecimento e Cadeia de Execuções só como Dimensão/Métrica)
            ├── Métricas (1..N; 0 em lista/calendário/texto): agregação × atributo/derivado/Registro
            ├── Dimensões (0..2): categoria de status, Responsável, Etapa, Fila, Tag, Valor de Campo, período...
            ├── Filtros fixos (0..N)          ┆  Filtros interativos = estado de sessão (fora do Painel)
            ├── Período (0..1): absoluto | relativo, no fuso da Localidade, sobre atributo temporal de referência
            └── Ordenação, Limite, Atributos exibidos, Conteúdo (conforme o tipo)

Toda consulta:  registros vistos pelo VISUALIZADOR (B20)  →  cálculo  →  valores + Momento de referência
Nada é gravado. Nada dispara Gatilho. Nenhuma aresta atravessa o Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-PAI-01.** Painel é entidade de visualização analítica que **não armazena dados**: toda Métrica, Dimensão e listagem é derivada no momento da consulta a partir de outras entidades, por referência; o Painel guarda apenas configuração. Aplica A2.2, B20 e o Glossário. CONSOLIDADA.
- **DO-PAI-02.** Nome de Painel é único entre Painéis `ativo` e `arquivado` do Espaço de Trabalho, sem distinção de maiúsculas e de espaços nas extremidades; `na lixeira` não reserva (RN-PAI-31). Estende B39 por analogia, como DO-FUN-16, DO-AGE-03, DO-HAB-16, DO-CNH-18 e DO-AUT-20: a Ferramenta de leitura (RN-PAI-22), os Registros de Atividade e a Proveniência referenciam Painéis por nome. RECOMENDADA.
- **DO-PAI-03.** Não existe Template de Painel (o catálogo de A8 não o prevê); reutilização é por **cópia com Proveniência**, sem vínculo vivo, no mesmo padrão de Funil (DO-FUN-14). A cópia não leva compartilhamentos, concessões, Proprietário nem Âncora. RECOMENDADA.
- **DO-PAI-04.** Widget é componente interno do Painel com Identificador local e sem identidade externa; Fonte de Dados, Métrica, Dimensão, Filtro, Período, Leiaute e Âncora são objetos de valor. Nenhum registro fora do Painel referencia um Widget. RECOMENDADA.
- **DO-PAI-05.** Catálogo fechado de entidades-alvo nesta versão: Tarefa, Negócio, Contato, Empresa, Conversa, Mensagem, Execução de Agente, Execução de Automação, **Solicitação de Aprovação** (entidade interna da Execução com identidade, contada por Painéis — B80; DO-AGE-11), Registro de Atividade, Documento de Conhecimento. Do domínio IA entram só essas: **Exercício de Habilidade** (objeto de valor sem identidade — DO-HAB-11) e **Referência de Conhecimento** (DO-CNH-15) não são entidades-alvo — são Dimensão, Filtro ou Métrica derivada das Execuções ("Execuções que exerceram a Habilidade X"; "Conhecimento consultado"); **custo por Cadeia de Execuções** é Métrica derivada (B79). Excluídos: Sessão de Chat e Mensagem de Chat (DO-CHT-13; B85), Memória, Item de Checklist (DO-CHK-08), Membro/Equipe/Papel/Integração, Fragmento, Painel. Coleção e Documento entram só para Métricas de catálogo e uso, nunca conteúdo (RN-PAI-15). RECOMENDADA.
- **DO-PAI-06.** Um Widget tem exatamente uma Fonte de Dados e uma entidade-alvo; cruzamentos entre entidades ocorrem por Widgets distintos. Justificativa: junções entre entidades não têm semântica estável de permissão (qual `ver` governa a linha?) e obrigariam a ontologia a definir chaves de junção. RECOMENDADA.
- **DO-PAI-07.** Painel de contexto: Âncora 0..1 (Espaço, Pasta, Subpasta, Lista, Funil, Fila), referência sem contenção, sem herança de permissão e sem herança de estado, com validade derivada por visualizador; acompanha a movimentação da âncora; na eliminação da âncora a Âncora passa a `eliminada` (identificador e nome à época como valor), os Widgets com Fonte nela ficam `inválido`, o Proprietário é notificado e o Painel **permanece**, sem ato do Sistema sobre a sua configuração (RN-PAI-20); remover ou trocar a Âncora é edição humana. Diverge deliberadamente de B41 (Automação), porque o escopo é constituinte da Automação e a Âncora é apenas contexto de um Painel com Proprietário, permissões próprias e Fontes possivelmente externas à âncora; mesmo padrão da âncora de Sessão de Chat (DO-CHT-03). RECOMENDADA.
- **DO-PAI-08.** Painel é criado e editado apenas por Membros; nunca por Agente, Automação ou plataforma (a criação do Espaço de Trabalho não instancia Painéis). Agentes recebem no máximo `ver` sobre Painéis (Ferramenta de leitura com recálculo — RN-PAI-22); nunca `criar`, `editar` ou `administrar`: Painel não é Recurso de Ferramenta de escrita (RN-PAI-25). Justificativa: Painel é leitura humana; a mesma razão que exclui a Automação exclui o Agente, e o documento 15 adota "criação é humana" para configuração. RECOMENDADA.
- **DO-PAI-09.** Não há indicador derivado de "registros ocultos por permissão" em Widgets. O Painel carrega uma declaração fixa de que os valores refletem as permissões do visualizador, e o Momento de referência. Toda referência da configuração (Âncora, escopos, valores de Filtro fixo, catálogos usados como Dimensão ou ordenação) a registro ou catálogo que o visualizador não vê resolve como "sem acesso", sem nome nem existência, e o Widget dependente não é calculado nem desenhado (RN-PAI-29). Justificativa: um indicador ou um nome revelaria a existência de contêineres, Funis e registros privados (contra B38a e B61) e permitiria sondagem por Convidados. RECOMENDADA.
- **DO-PAI-10.** Não existe compartilhamento público por link de Painel nesta versão: B20 exige um visualizador com permissões efetivas, e dados públicos calculados com as permissões de alguém seriam canal de vazamento. "Link público de dados estáticos" é artefato exportado (fora da ontologia) e, se hospedado pela plataforma, entidade futura. Registrada como pendência (seção 25). RECOMENDADA.
- **DO-PAI-11.** Permissões do Painel: ver, editar, excluir, administrar em escopo `registro`; `próprios` aplica-se; Proprietário tem `administrar` por propriedade; Administradores e Proprietário do Espaço de Trabalho têm `ver` e `administrar` por Papel (governança); Membro cria e governa os próprios; Convidado só por compartilhamento. Painel não pode ser privado (desnecessário: não é visível por padrão e não contém dados). RECOMENDADA.
- **DO-PAI-12.** Métricas sobre status usam categoria (A4.3) quando o escopo abrange Conjuntos de Status distintos; Definição de Status como Dimensão só sob Conjunto efetivo único (B45). Widgets com escopo em caminhos efetivos distintos agregam apenas por nativos, derivados, Tags e Definições de Campo de ancestral comum (B25, B44); Definições homônimas de Espaços distintos nunca são unificadas. Aplica C14 sem alterá-la. RECOMENDADA.
- **DO-PAI-13.** Métricas sobre Valor de Negócio produzem uma série por moeda; o Painel nunca converte. Aplica DO-NEG-04 e **decide C22 para Painéis**; permanece em C22 apenas a configuração de câmbio (taxa e data de referência) do Espaço de Trabalho (seção 25). RECOMENDADA.
- **DO-PAI-14.** Fontes de Dados: "incluir Subtarefas" padrão falso (DO-STA-09); "incluir arquivados" padrão falso, exceto Negócio (verdadeiro — documento 12, 11.2), avaliando o estado efetivo onde exista (B36, DO-CNH-09) e o estado próprio no CRM (DO-NEG-09), inaplicável a entidades sem `arquivado`; "incluir Ensaios" padrão falso (DO-AGE-13); `na lixeira`, `mesclado` e Registros de Atividade de objeto eliminado (RN-PAI-30) nunca entram. RECOMENDADA.
- **DO-PAI-15.** Filtros interativos são estado de sessão do visualizador, restritivos sobre os Filtros fixos, nunca gravados nem auditados. Leiaute é único por Painel (sem personalização por visualizador). RECOMENDADA.
- **DO-PAI-16.** Todo Painel declara o **Momento de referência dos dados** a cada consulta (derivado); cache, materialização e atualização programada são infraestrutura. Arquivar um Painel não congela números; congelar é exportar, ato registrado (RN-PAI-24) cujo produto está fora da ontologia. RECOMENDADA.
- **DO-PAI-17.** Painel não emite Eventos de Gatilho, não é escopo de Automação, não é âncora de Sessão de Chat e não é Fonte para Agentes: um Agente que "lê o Painel" recalcula os Widgets com as suas permissões efetivas (interseção — A9.3). "Métrica abaixo de X" é Gatilho `condição temporal` sobre as entidades (DO-AUT-03). Aplica DO-CHT-02, DO-CHT-13, DO-AUT-03 e documento 01, 17.3. RECOMENDADA.
- **DO-PAI-18.** Registro de Atividade é entidade-alvo admitida para Métricas históricas (tempo em status, tempo em Etapa, conversão, ações por Ator), com valores à época (DO-FUN-13; mapeamento de status gravado), filtrada pelo `ver` atual do visualizador sobre o objeto. O Painel nunca é prova: a prova é o Registro. RECOMENDADA.

Nenhuma decisão contradiz A1–A9 ou B1–B99. DO-PAI-07 diverge de B41 por analogia rejeitada, não por conflito (B41 rege Automação; a Sessão de Chat é o precedente seguido). DO-PAI-02 estende B39 por analogia, como fizeram Funil, Agente, Habilidade, Coleção e Automação.

## 25. Questões em aberto

1. **Conversão de moeda em Painéis** (C22; documento 12, 25.2). Decidida para Painéis: somam por moeda, nunca convertem (DO-PAI-13). Permanece aberta a **configuração de câmbio** (taxa e data de referência — do dia, do fechamento, fixa por período) como objeto de valor ou entidade do Espaço de Trabalho, sem a qual não há consolidação entre moedas em Painéis nem comparação em Automações. Consequência relevante para organizações multinacionais. Recomendação: restringir C22 a esse ponto.
2. **Horário comercial e dias úteis** (C12). Durações são calendário salvo onde há Horário de atendimento (RN-PAI-14). Sem C12, "tempo até conclusão em dias úteis" não existe para Tarefas e Negócios, e Funil, Fila e Painel não concordam sobre "dias".
3. **Visibilidade herdada da Âncora.** Times pedirão "quem vê a Lista vê o seu Painel de contexto". Hoje é compartilhamento explícito (17.2), porque a Âncora não é pai (A2.2) e não é origem de permissão (A9.1). Aceitar exigiria uma nova Origem ("contexto") na tupla de permissão. Consequência de produto: Painéis de contexto pouco visíveis sem ato.
4. **Compartilhamento público / instantâneo hospedado** (DO-PAI-10). Se o produto quiser links públicos, a forma ontologicamente segura é uma entidade futura "Instantâneo de Painel" (dados estáticos, momento, Criador, revogável, auditado — no padrão de Compartilhamento público de Tarefa), nunca o Painel vivo. Candidata a **D-nova**.
5. **Widget de insight gerado por IA.** "Resumo em texto do que este Painel mostra", produzido por Execução de Agente e exibido no Painel, é entidade futura (o Widget guardaria uma saída de Execução, com Momento de referência e Proveniência — o que roça INV-PAI-01 e exige decisão explícita). Hoje, o Agente responde em Sessão de Chat ou Comentário. Candidata a **D-nova**.
6. **Versionamento de Painel e Registro de consulta.** Não há versões de Painel (B24 é da IA) nem Registro de "Painel consultado" (RN-PAI-23). Auditoria de "quem viu o quê" e reprodução de "como estava o Painel em março" exigiriam ambos, com custo de volume. Decidir junto com C9 (retenção).
7. **Métrica composta / fórmula de Widget** (20.16; documento 08, 25.2). "Progresso total", "custo por Negócio ganho", "tempo humano + tempo de IA" (B42) pedem Métrica calculada sobre outras Métricas, possivelmente de Fontes distintas — o que DO-PAI-06 hoje não admite. Consequência: sem isso, o usuário calcula fora da plataforma.
8. **Categoria fixa de Qualificação** (C23; documento 10, 25.2). Resolvida para Painéis por Filtro escolhido pelo editor (20.17); permanece aberta para Automações e Agentes.
9. **Painel consolidado entre Espaços de Trabalho** (C1). Rejeitado por RN-PAI-21; holdings pedirão.
10. **Campos Personalizados em contêineres** (C13, ampliada). "Tarefas por cliente" sem Vínculo de Lista com Empresa (C16) exige Valor de Campo em cada Tarefa; um atributo da Lista consultável por Painéis resolveria, mas depende de C13/C16.
11. **Rebaixamento de Proprietário a Papel de base Convidado** (20.21). Transferência e sucessão exigem destinatário sem base Convidado (B28; RN-PAI-05; RN-AGE-04), mas nenhum documento define o efeito de mudar o Papel de um Membro que é Proprietário de Negócios, Agentes, Coleções ou Painéis. Alternativas: rejeitar o rebaixamento enquanto houver propriedades; exigir transferência no mesmo ato; admitir Proprietário de base Convidado (o que este documento tolera para Painel, por ser inofensivo sob B20). Transversal; candidata a **C-nova**.
12. **Métricas sobre objetos eliminados** (20.20; RN-PAI-30). Registros de Atividade de objetos eliminados não entram em Painéis por falta de Recurso para `ver`; "eliminações por período" fica na auditoria. Se o produto exigir, será preciso definir a quem esses Registros são visíveis (candidato: `administrar` sobre o escopo em que o objeto estava).

Resolvidas neste documento com recomendação, sem pendência: Âncora `eliminada` sem eliminação nem desanexação do Painel (DO-PAI-07); indicador de dados parciais (DO-PAI-09, rejeitado) e referências sem acesso sem nome (RN-PAI-29); Template de Painel (DO-PAI-03, cópia); unicidade de nome (DO-PAI-02, sim — B39 por analogia); criação e edição só por Membro (DO-PAI-08); Subtarefas e arquivados nas Fontes (DO-PAI-14); Sessões de Chat como Fonte (nunca, DO-PAI-05); "nível" como Dimensão (documento 07, 25.4 — sim, com "incluir Subtarefas"; "árvore" como agrupamento não é oferecido: raiz é Dimensão).
