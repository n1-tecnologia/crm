# ESPAÇO DE TRABALHO

> Domínio: Raiz organizacional | Documento 01 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Espaço de Trabalho** é a entidade-raiz organizacional da plataforma: a representação de uma organização (empresa, unidade de negócio, equipe autônoma) como um universo fechado de pessoas, dados, configurações e operação. Tudo o que a organização registra, configura, executa ou conversa existe dentro de exatamente um Espaço de Trabalho e nunca fora dele (A1.1).

Três propriedades o distinguem de qualquer outra entidade da ontologia:

1. **É raiz.** Não tem pai. Toda entidade corporativa — Espaço, Tarefa, Contato, Negócio, Conversa, Agente, Painel, Arquivo, Registro de Atividade — pertence a ele direta ou transitivamente. Nada corporativo existe acima dele; acima dele só existe a plataforma, que não é entidade da ontologia.
2. **É limite de isolamento.** Nenhuma entidade de um Espaço de Trabalho pode ser referenciada ou acessada a partir de outro (A1.2). É a fronteira que a plataforma multi-inquilino (multi-tenant) usa para separar organizações. O isolamento é uma propriedade do Espaço de Trabalho, não uma permissão negada: não existe Sujeito capaz de atravessá-lo.
3. **É a sede da governança.** Define quem são os Membros, com que Papéis e em que Equipes; quem responde pela organização (o Proprietário do Espaço de Trabalho); e quais configurações valem para todos os domínios ao mesmo tempo.

O Espaço de Trabalho não é uma "pasta grande", não é o "usuário administrador" e não é a "conta de cobrança". É a organização enquanto sujeito de dados e de operação. A relação comercial entre essa organização e a plataforma (plano, cobrança, limites contratados) existe, impõe limites ao Espaço de Trabalho e pode suspendê-lo, mas não é parte da ontologia: o Espaço de Trabalho é objeto dessa relação, não a contém.

## 2. Propósito

O Espaço de Trabalho existe para cinco fins, cada um deles impossível de atender sem uma entidade-raiz explícita:

1. **Separar organizações.** Duas empresas que usam a mesma plataforma não podem ver, referenciar ou inferir dados uma da outra. Sem uma raiz nomeada, o isolamento seria uma propriedade difusa de cada entidade em vez de um invariante único.
2. **Unificar o universo de dados.** Tags, Funis, Definições de Campo do CRM, Motivos de Perda, Origens, moeda padrão e fuso horário precisam valer simultaneamente para Tarefas, Contatos, Negócios, Conversas e Painéis. Se cada domínio definisse os seus, a mesma Tag "VIP" em uma Tarefa e em um Contato seriam rótulos distintos, e Painéis e IA não poderiam cruzá-los (B5).
3. **Ancorar a responsabilidade humana.** Toda cadeia de Proprietários termina em um Membro humano, e todo Membro termina no Espaço de Trabalho, que tem exatamente um Proprietário do Espaço de Trabalho. É a garantia de que nenhum registro fica sem alguém que responda por ele (A7, B7).
4. **Delimitar auditoria e retenção.** Registros de Atividade, política de lixeira e eliminação de dados têm escopo organizacional. O Espaço de Trabalho é a unidade sobre a qual se responde "o que esta organização fez" e "o que acontece com os dados desta organização".
5. **Ser a unidade de operação contínua.** Integrações, Canais, Automações agendadas e Agentes autônomos operam em nome da organização mesmo sem nenhum Membro conectado. Precisam de um contexto que exista independentemente de sessões humanas.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Usuário e existente até sua eliminação permanente.
- **Raiz de um agregado de governança**: Membros, Equipes, Papéis, configurações globais e Integrações têm sua consistência garantida pelo Espaço de Trabalho (exemplo: nunca zero Proprietários; nunca um Membro em Equipe de outro Espaço de Trabalho).
- **Não é raiz de agregado de todo o conteúdo.** Tarefa, Negócio, Contato, Conversa, Agente e Painel são raízes dos próprios agregados. O Espaço de Trabalho é o **escopo de pertencimento** deles, não o responsável pela consistência interna deles. Confundir os dois levaria a tratar toda a organização como um único objeto transacional.
- **Escopo**: é o escopo de unicidade (nome de Tag, Identificador de Contato por tipo e valor, nome de Funil), de permissões (origem "papel no Espaço de Trabalho") e de auditoria.
- **Recurso de permissão**: o próprio Espaço de Trabalho é um Recurso sobre o qual existem Ações (administrar, encerrar, transferir propriedade).
- **Não é Ator.** O Espaço de Trabalho nunca age. Ações "da organização" são praticadas por um Membro, por um Agente, por uma Automação, por uma Integração ou pelo Sistema (A6.1).
- **Não é objeto de valor, não é configuração, não é Papel, não é Usuário.**

## 4. Fronteira conceitual

### O que é

- A organização como universo fechado de dados e operação.
- O ponto de definição das configurações que valem para todos os domínios.
- A sede da membresia: o único lugar em que Usuários se tornam Membros.
- O escopo de isolamento, unicidade e auditoria.

### O que não é

- **Não é Espaço.** Espaço é o primeiro nível da Estrutura de Trabalho, contido pelo Espaço de Trabalho. Um Espaço de Trabalho com zero Espaços é válido; um Espaço sem Espaço de Trabalho não existe.
- **Não é um contêiner da Estrutura de Trabalho.** Não contém Tarefas diretamente, não define Conjunto de Status, não é nível de herança de Status (A4.2). A Estrutura de Trabalho começa no Espaço.
- **Não é Usuário nem conta de pessoa.** Uma pessoa pode criar vários Espaços de Trabalho e participar de vários; o Espaço de Trabalho sobrevive à saída de qualquer pessoa, inclusive do seu criador.
- **Não é Empresa (CRM).** Empresa é uma organização externa com quem a organização se relaciona. O Espaço de Trabalho é a organização que se relaciona. A própria organização não é registrada como Empresa de si mesma.
- **Não é plano, assinatura ou fatura.** Limites e suspensões chegam ao Espaço de Trabalho de fora; a relação comercial não é modelada aqui.
- **Não é a plataforma.** Usuário, Modelo, Tipo de Canal e Tipo de Campo são da plataforma e apenas referenciados (A1.3).

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Espaço de Trabalho × Espaço** | Raiz organizacional; limite de isolamento; sede da membresia; define Tags, Funis, CRM, IA, Painéis. | Primeiro nível da Estrutura de Trabalho; delimita uma área de trabalho com Conjunto de Status, Definições de Campo para Tarefas e permissões próprias. | Membresia e isolamento só existem no Espaço de Trabalho. Status e Tarefas só existem a partir do Espaço. CRM, IA e Painéis nunca são filhos de Espaço (A2.2). |
| **Espaço de Trabalho × Usuário** | Organização; entidade corporativa; pode ter muitos Membros. | Pessoa que se autentica; entidade global da plataforma; pode ser Membro de muitos Espaços de Trabalho. | O Espaço de Trabalho não contém Usuários: contém Membros, que referenciam Usuários. Encerrar um Espaço de Trabalho não afeta nenhum Usuário; excluir um Usuário não encerra nenhum Espaço de Trabalho. |
| **Membro × Contato** | Relação de um Usuário com o Espaço de Trabalho; Ator interno; tem Papel, Equipes, permissões; autor de ações. | Pessoa externa registrada no CRM; nunca se autentica na plataforma por meio desse registro; objeto de relacionamento comercial. | Membro age dentro da organização; Contato é com quem a organização fala. Um mesmo ser humano pode ser ambos, sem ligação ontológica (A1.4; C2). |
| **Equipe × Papel** | Grupo nomeado de Membros; agrupa pessoas para atribuição e concessão de permissão; um Membro pode estar em várias. | Conjunto nomeado de permissões; define o que um Sujeito pode fazer; um Membro tem exatamente um. | Equipe responde "quem"; Papel responde "o que pode". Uma Equipe pode receber concessões, mas não é um Papel; um Papel não tem Membros, tem titulares. |
| **Proprietário do Espaço de Trabalho × Administrador** | Membro único que responde pela organização; único que transfere propriedade e encerra o Espaço de Trabalho; não pode ser removido nem suspenso por ninguém. | Papel com permissão de administrar o Espaço de Trabalho: Membros, Papéis, Equipes, configurações, Integrações; pode haver vários. | Administrador administra; Proprietário responde. Toda ação de Administrador cabe ao Proprietário; a recíproca não vale (transferir, encerrar, remover Administradores). |
| **Integração × Canal** | Conexão configurada entre o Espaço de Trabalho e um sistema externo; Ator; pode expor Ferramentas; qualquer finalidade. | Integração especializada para mensageria: conta conectada de um Tipo de Canal pela qual Conversas ocorrem; vive na Caixa de Entrada. | Todo Canal é uma Integração; nem toda Integração é um Canal. Canal é descrito no documento de Caixa de Entrada; a Integração genérica pertence ao Espaço de Trabalho. |
| **Espaço de Trabalho × Empresa (CRM)** | A organização que usa a plataforma. | Organização externa com quem a organização se relaciona. | Empresa é conteúdo do CRM; o Espaço de Trabalho é o continente do CRM. |

## 5. Identidade

O Espaço de Trabalho tem um **identificador imutável, opaco e atribuído pela plataforma** no momento da criação. Esse identificador é a identidade; tudo o mais é atributo.

**Teste de identidade.** Se o nome mudar, o Proprietário do Espaço de Trabalho for transferido, todos os Membros forem substituídos, todas as configurações forem alteradas e todo o conteúdo for arquivado, continua sendo o mesmo Espaço de Trabalho: os Registros de Atividade continuam se referindo a ele, os identificadores de todas as entidades continuam pertencendo a ele e a fronteira de isolamento continua a mesma. A identidade é a continuidade do universo de dados, não qualquer atributo.

Consequências:

- **Nome não é identidade.** Dois Espaços de Trabalho podem ter o mesmo nome. Não se exige unicidade global de nome (recomendação adotada, sem consequência de produto relevante): a plataforma não expõe nomes entre organizações, e a unicidade criaria vazamento de informação ("este nome já está em uso" revela a existência de outra organização).
- **Proprietário não é identidade.** A transferência de propriedade preserva o Espaço de Trabalho; não cria outro.
- **Criador não é identidade.** O primeiro Membro (Criador) pode ser removido; o registro de que ele criou permanece (Criador é imutável, A7; Membro nunca é apagado, A6.4).
- **Membro** tem identidade própria derivada do par (Usuário, Espaço de Trabalho): existe no máximo um Membro por par. Um Usuário reconvidado após remoção reativa o mesmo Membro, o que preserva a atribuição de autoria histórica (DO-ET-03).

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Nome | nativo | sim | Nome de exibição da organização. Editável. Não único globalmente (seção 5). |
| Estado | nativo | sim | Estado de ciclo de vida: `ativo`, `suspenso`, `encerrado` (seção 11). |
| Proprietário do Espaço de Trabalho | derivado | sim | O Membro `ativo` titular do Papel Proprietário do Espaço de Trabalho (INV-ET-02). A titularidade do Papel é a fonte; este atributo é a sua leitura, não um segundo registro. |
| Criador | referência (Membro) | sim | O primeiro Membro, criado no mesmo ato atômico da criação (seção 12.1). Imutável. Criador é Ator (A7), e Usuário só é Ator por meio de um Membro (A6.1). |
| Momento de criação | nativo | sim | Imutável. |
| Localidade | objeto de valor | sim | Fuso horário padrão, moeda padrão, idioma padrão. Valores iniciais definidos na criação; editáveis. |
| Profundidade máxima de Subtarefas | nativo | sim | Maior Nível (de Tarefa) admitido abaixo da Tarefa raiz (B1; recomendação: 3). Limitado pelo teto da plataforma. |
| Política de lixeira | objeto de valor | sim | Prazo de retenção de registros `na lixeira` antes da eliminação permanente (A4.1; C9). Limitado por mínimo e máximo da plataforma. |
| Limites impostos | objeto de valor | sim | Conjunto de limites que a plataforma impõe ao Espaço de Trabalho (Membros, Espaços, Agentes, armazenamento, cota de IA — C8). Origem externa; o Espaço de Trabalho não os define, está sujeito a eles. |
| Assistente padrão | referência (Agente) | sim | Agente instanciado neste Espaço de Trabalho a partir do Template de Agente da plataforma homônimo (DO-ET-11). Usado quando nenhum Agente é escolhido (B17, B21). |
| Template de Espaço padrão | referência (Template) | não | Template de Espaço usado quando um Espaço é criado sem Template explícito (DO-ESP-09). Se o Template referenciado for eliminado, o atributo é limpo. 0..1. |
| Identificador legível de Tarefas | objeto de valor | não | Configuração opcional: habilitado (booleano) e prefixo (texto curto). Quando habilitado, toda Tarefa recebe número sequencial único no Espaço de Trabalho, imutável e nunca reutilizado (DO-TAR-02; Glossário "Identificador legível"). |
| Identificador legível de Negócios | objeto de valor | não | Configuração opcional análoga, com sequência e prefixo próprios, distintos dos de Tarefas (ex.: `NEG-0421`); imutável, nunca reutilizado, invariante a mudança de Funil, Empresa, situação e restauração (DO-NEG-02). |
| Funil padrão | referência (Funil) | sim | Funil `ativo` e não privado para o qual vão os Negócios criados sem Funil explícito. Criado no ato de criação (seção 12.1); alterado só por Administrador ou Proprietário, apontando para outro Funil `ativo` não privado; o Funil apontado não pode ser arquivado, enviado à lixeira, eliminado nem tornado privado enquanto for padrão (DO-FUN-09; RN-FUN-16; INV-FUN-08). Exatamente um. |
| Suspensões vigentes | objeto de valor | condicional | Zero, uma ou duas suspensões (no máximo uma por origem: plataforma, Proprietário), cada uma com momento e motivo. Presente enquanto `suspenso`; a reativação exige levantar todas (seção 12.2). |
| Momento de encerramento | nativo | não | Preenchido quando `encerrado`. |
| Previsão de eliminação | derivado | não | Momento de encerramento + prazo de retenção de encerramento (seção 12). |

Não são atributos do Espaço de Trabalho, embora sejam definidos ou criados nele: Tags, Funis, Motivos de Perda, Motivos de Ganho, Origens, Definições de Qualificação, Finalidades de Consentimento, Definições de Campo do CRM, Papéis, Equipes, Integrações e a Caixa de Entrada. São entidades contidas (seções 7 e 8). Poder configurá-las não as torna atributos.

## 7. Entidades internas ou componentes

Entidades internas são aquelas que não têm existência fora do agregado de governança do Espaço de Trabalho. As entidades dos domínios (Contato, Agente, Painel...) pertencem ao Espaço de Trabalho, mas são raízes dos próprios agregados e são descritas nos seus documentos.

### 7.1 Membro

Relação de um Usuário com o Espaço de Trabalho (A1.4). Tem identidade própria (é referenciado como Criador, Proprietário, Responsável, Atribuído, autor) mas não existe fora do Espaço de Trabalho.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Usuário | referência (Usuário) | condicional | Obrigatório nos estados `ativo`, `suspenso`, `removido`. No estado `pendente` pode estar vazio: o convite é dirigido a uma identidade externa (e-mail) e o Usuário só é vinculado no aceite (DO-ET-03). |
| Identidade convidada | objeto de valor | condicional | E-mail (ou outra identidade aceita pela plataforma) para o qual o convite foi emitido. Obrigatório enquanto `pendente` sem Usuário. |
| Estado | nativo | sim | `ativo`, `pendente`, `suspenso`, `removido` (seção 11). |
| Papel | referência (Papel) | sim | Exatamente um Papel (DO-ET-07). Enquanto `pendente`, é o Papel pretendido. |
| Nome de exibição no Espaço de Trabalho | nativo | não | Sobrescreve, apenas dentro deste Espaço de Trabalho, o nome do Usuário. |
| Convidado por | referência (Membro) | condicional | Membro que emitiu o convite. Vazio apenas para o primeiro Membro, criado com o Espaço de Trabalho. |
| Momento de ingresso | nativo | condicional | Momento em que passou a `ativo` pela primeira vez. |
| Momento de remoção | nativo | condicional | Preenchido enquanto `removido`. |
| Sucessor | referência (Membro) | condicional | Membro que recebeu, na remoção, as propriedades e aprovações pendentes do removido (DO-ET-04 / B28). Preenchido na remoção de um Membro `ativo` ou `suspenso`; vazio na revogação de convite. Nova remoção após reativação sobrescreve o valor; o histórico completo está nos Registros de Atividade. |
| Disponibilidade de atendimento | objeto de valor | sim | `disponível` (padrão), `ausente` ou `indisponível`, com momento e origem (`Membro`, `Automação`, `horário de atendimento`). Consumida pelas Filas da Caixa de Entrada para distribuição automática de Conversas; Membro `suspenso` deriva `indisponível`. É da pessoa, não da relação Membro-Fila (DO-CXE-14; documento 14, 7.8). Agente não tem Disponibilidade. |
| Memória do Usuário | entidade interna | 0..1 | Entidade interna do Membro (não da Sessão de Chat), com Itens de Memória sobre o próprio Membro; habilitável por ele; alimentada só por Execuções originadas nas suas Sessões ou por ele; nunca retém dados de Contatos, Empresas, Negócios ou terceiros; nunca vista por outros Membros ou Administradores; nunca sucedida; enviada à lixeira com as Sessões na remoção do Membro (DO-CHT-11; DO-CHT-16; B86, B87; documento 16, 7.5). |

O Membro é o **único Ator humano** dentro do Espaço de Trabalho. Nenhuma entidade corporativa referencia Usuário diretamente: a única referência a Usuário é o atributo Usuário do próprio Membro.

### 7.2 Equipe

Grupo nomeado de Membros (A8). Atributos: nome (único no Espaço de Trabalho), descrição, Membros (0..N), Criador. Uma Equipe pode ser Sujeito de permissão e destino de distribuição (Filas, atribuição). Não tem Papel: permissões de Equipe são concessões diretas à Equipe. Só Membros `ativo` ou `suspenso` integram Equipes; a remoção de um Membro o retira de todas (RN-ET-12).

### 7.3 Papel

Conjunto nomeado de permissões (A8, A9.4). Dois tipos:

- **Papéis de sistema**: Proprietário do Espaço de Trabalho, Administrador, Membro, Convidado. Existem em todo Espaço de Trabalho desde a criação, não podem ser renomeados, excluídos nem ter seu conjunto mínimo de permissões reduzido.
- **Papéis personalizados** (DO-ET-07 / B30): criados por Administrador, declaram um Papel de sistema como **base** (Administrador, Membro ou Convidado; nunca Proprietário). A base é o **teto**: um Papel personalizado nunca concede o que a sua base não concede; pode conceder menos (INV-ET-17). A base também define o **nível** pelo qual as regras de sistema o tratam: um Papel de base Administrador conta como Administrador em RN-ET-04 a RN-ET-07, RN-ET-24 e na seção 17.2.

O Papel Proprietário do Espaço de Trabalho tem exatamente um titular (INV-ET-02). Os demais têm 0..N.

### 7.4 Integração

Conexão configurada com um sistema externo (A8). Atributos: nome, tipo de sistema externo, estado (`conectada`, `desconectada`, `com erro`), credenciais (objeto de valor sigiloso, nunca exibido depois de gravado), Criador, **Membro configurador** (o Administrador que a conectou; rastreabilidade, não governança — DO-ET-16 / B35). É um Ator (A6.1): ações originadas nela registram a Integração como ator, com o Membro configurador como ator delegante quando a ação decorre de uma configuração explícita. Pode expor Ferramentas a Agentes (B16). **Canal** é a especialização de Integração para mensageria: tem os atributos e estados de Integração e obedece às regras desta seção, mas é **contido pela Caixa de Entrada** (e, transitivamente, pelo Espaço de Trabalho), não diretamente pelo Espaço de Trabalho. É descrito no documento de Caixa de Entrada.

### 7.5 Configurações globais (objetos de valor)

Localidade, Política de lixeira, Profundidade máxima de Subtarefas, Identificador legível de Tarefas, Identificador legível de Negócios, Limites impostos. Não têm identidade; existem como atributos compostos do Espaço de Trabalho (seção 6). O Template de Espaço padrão (0..1) e o Funil padrão (exatamente 1) são referências a entidades contidas (Template, Funil), não objetos de valor.

### 7.6 Catálogos definidos no Espaço de Trabalho (entidades contidas, descritas em outros documentos)

| Catálogo | Documento que o detalha | Por que é definido aqui |
| --- | --- | --- |
| Tags | Estrutura de Trabalho / CRM (uso) | Mesma Tag qualifica Tarefas, Contatos, Empresas, Negócios e Conversas (B5). |
| Definições de Campo Personalizado do CRM (Contato, Empresa, Negócio, Conversa) | CRM | O CRM não tem hierarquia de contêineres (A5.2). Três Definições com entidade-alvo Empresa (Segmento, Porte, Setor) são instanciadas na criação, editáveis e arquiváveis (DO-EMP-10). |
| Motivos de Perda | Negócio | Valem para todos os Funis. O Motivo "Duplicado" é instanciado na criação (DO-NEG-12). |
| Motivos de Ganho | Negócio | Simétricos aos Motivos de Perda; opcionais (DO-NEG-06). |
| Origens | Contato / Empresa / Negócio | Aquisição é medida na organização inteira (DO-EMP-09 amplia a Empresa). |
| Definições de Qualificação | Contato | Posição no relacionamento (lead, prospecto, cliente…), exclusiva e ordenável; catálogo com padrões da plataforma (DO-CON-05). |
| Finalidades de Consentimento | Contato (Consentimento) | `atendimento`, `transacional`, `marketing` como padrões da plataforma, com indicador "exige consentimento para envio" (DO-CON-06; RN-CON-16). |
| Funis | Funis | Negócios de qualquer Espaço, Equipe ou Canal progridem nos mesmos Funis. O Funil padrão é criado com o Espaço de Trabalho (DO-FUN-09). |
| Templates (de Espaço, Pasta, Lista, Tarefa, Checklist, Agente) | Entidades que os usam | Reutilização é organizacional. |

### 7.7 O que não é componente: os domínios

**CRM, IA e Painéis não são entidades.** São domínios — agrupamentos conceituais de entidades pares da Estrutura de Trabalho (A2.2). Não têm identidade, atributos nem estado. O Espaço de Trabalho não "contém um CRM": contém Contatos, Empresas, Negócios, Funis e uma Caixa de Entrada. A única exceção nominal é a **Caixa de Entrada**, que é uma entidade (única, B11) e não um domínio. "Conhecimento" é igualmente uma camada; as entidades são Coleções, Documentos de Conhecimento e Fragmentos.

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| contém Membros | Membro | contenção | ET → Membro | Agregado de governança. Membro não existe fora. |
| contém Equipes | Equipe | contenção | ET → Equipe | Idem. |
| contém Papéis | Papel | contenção | ET → Papel | Papéis de sistema instanciados na criação; personalizados criados depois. |
| contém Integrações | Integração | contenção | ET → Integração | Integrações que não são Canais. Canais são contidos pela Caixa de Entrada (7.4) e só transitivamente pelo ET. |
| é de propriedade de | Membro | propriedade | ET → Membro | Exatamente um Proprietário do Espaço de Trabalho. |
| foi criado por | Membro | referência | ET → Membro | Criador imutável: o primeiro Membro (12.1). |
| contém Espaços | Espaço | contenção | ET → Espaço | Raiz da Estrutura de Trabalho (A3.1). Cascata na eliminação. |
| contém Contatos, Empresas, Negócios | Contato, Empresa, Negócio | pertencimento | ET → registro | Pertencem diretamente ao ET, sem contêiner intermediário. |
| contém Funis | Funil | pertencimento | ET → Funil | Raiz do próprio agregado (Etapas); documento próprio. |
| possui Caixa de Entrada | Caixa de Entrada | contenção (composição 1:1) | ET → Caixa de Entrada | Única, criada com o ET, sem existência separada (B11). |
| contém Sessões de Chat | Sessão de Chat | pertencimento | ET → Sessão de Chat | Cada uma pertence a um Membro (B21); transitivamente ao ET. |
| contém Agentes | Agente | pertencimento | ET → Agente | Inclui o Assistente padrão instanciado. |
| contém Habilidades | Habilidade | pertencimento | ET → Habilidade | Habilidades fornecidas pela plataforma são referenciadas, não contidas (B15). |
| contém Automações | Automação | pertencimento | ET → Automação | Independentemente do escopo de definição (Espaço, Lista, Funil...), a Automação pertence ao ET. |
| contém Coleções de Conhecimento | Coleção | pertencimento | ET → Coleção | Conhecimento é do domínio IA (A2.3). |
| contém Painéis | Painel | pertencimento | ET → Painel | |
| contém Tags, Definições de Campo do CRM, Motivos de Perda, Motivos de Ganho, Origens, Definições de Qualificação, Finalidades de Consentimento, Templates | catálogos | contenção | ET → catálogo | Configuração com identidade (B34). |
| contém Arquivos | Arquivo | contenção | ET → Arquivo | Todo Arquivo pertence ao ET (A8); registros o referenciam. |
| contém Registros de Atividade | Registro de Atividade | contenção | ET → Registro | Toda auditoria tem escopo do ET. Imutáveis. |
| referencia Assistente padrão | Agente | referência | ET → Agente | Aponta para um dos Agentes contidos. |
| usa Modelos | Modelo | referência (uso) | ET → Modelo | Por meio de Agentes e Sessões de Chat; o ET não possui Modelos. |
| referencia Tipos de Canal, Tipos de Campo | entidades globais | referência | ET → global | Por meio de Canais e Definições de Campo. |
| está sujeito a Limites | Limites impostos | objeto de valor de origem externa | plataforma → ET | O ET não define; recebe. |

Distinção aplicada: **CONTER** (Membros, Equipes, Papéis, Integrações, Espaços, catálogos, Arquivos, Registros de Atividade, Caixa de Entrada), **pertencimento** (registros de domínio, que têm agregado próprio mas escopo do ET), **USAR** (Modelo), **REFERENCIAR** (Tipos globais, Assistente padrão, Criador), **CONFIGURAR** (Localidade, política de lixeira, profundidade). Critério: **contenção** quando a consistência da entidade é garantida pelo agregado de governança do ET ou ela é configuração com identidade sem agregado próprio; **pertencimento** quando a entidade é raiz do próprio agregado e o ET é apenas o seu escopo. O Espaço de Trabalho **não HERDA** nada: é a origem de toda herança.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| ET → Membro | 1..N | não | sim | estrutural | Ao menos o Proprietário. Um ET sem Membros não tem quem responda por ele. |
| ET → Proprietário do ET | 1 | não | não | propriedade | A7: exatamente um. Vários Proprietários diluiriam a responsabilidade; zero a eliminaria. |
| Membro → Usuário | 0..1 enquanto `pendente`; 1 depois | sim (só `pendente`) | não | referência | Convite pode preceder a existência do Usuário (DO-ET-03 / B27). |
| Usuário → Membro por ET | 0..1 | sim | não | associativa | No máximo um Membro por (Usuário, ET). |
| Usuário → Membros (todos os ETs) | 0..N | sim | sim | associativa | Usuário participa de vários ETs; cada relação é independente. |
| Membro → Papel | 1 | não | não | referência | Um Papel por Membro (DO-ET-07). Múltiplos Papéis tornam a origem da permissão ambígua; concessões adicionais vão por Equipe ou concessão direta. |
| Membro → Equipe | 0..N | sim | sim | associativa | Pessoas atuam em várias frentes. |
| Equipe → Membro | 0..N | sim | sim | associativa | Equipe vazia é válida (recém-criada, em reorganização). |
| ET → Papel | 4..N | não | sim | estrutural | Quatro Papéis de sistema sempre existem; personalizados são opcionais. |
| ET → Equipe | 0..N | sim | sim | estrutural | Organizações pequenas não precisam de Equipes. |
| ET → Integração | 0..N | sim | sim | estrutural | |
| ET → Espaço | 0..N | sim | sim | estrutural | A3.1. ET recém-criado ou usado só para CRM pode não ter Espaços. |
| ET → Caixa de Entrada | 1 | não | não | composição | B11. Criada com o ET; não pode ser excluída nem duplicada. |
| ET → Canal | 0..N | sim | sim | estrutural (via Caixa de Entrada) | Sem Canais, a Caixa de Entrada existe vazia. |
| ET → Contato / Empresa / Negócio | 0..N | sim | sim | pertencimento | |
| ET → Funil | 1..N | não | sim | pertencimento | O Funil padrão é criado com o ET e nunca é eliminado enquanto for padrão (DO-FUN-09; seção 12.1). Negócio exige Funil (B9). |
| ET → Funil padrão | 1 | não | não | referência | Exatamente um Funil `ativo` e não privado (RN-FUN-16; INV-FUN-08); criar Negócio sem Funil explícito precisa de destino determinístico. |
| ET → Agente | 1..N | não | sim | pertencimento | O Assistente padrão sempre existe (DO-ET-11). |
| ET → Assistente padrão | 1 | não | não | referência | B17 e B21 dependem da sua existência. |
| ET → Habilidade / Automação / Coleção / Sessão de Chat / Painel | 0..N | sim | sim | pertencimento | |
| ET → Tag / Definição de Campo CRM / Motivo de Perda / Motivo de Ganho / Origem / Definição de Qualificação / Finalidade de Consentimento / Template | 0..N | sim | sim | estrutural | Catálogos vazios são válidos; a criação instancia itens iniciais em alguns (12.1), todos editáveis e arquiváveis. |
| ET → Arquivo | 0..N | sim | sim | estrutural | |
| ET → Registro de Atividade | 1..N | não | sim | estrutural | A criação gera o primeiro. |
| ET → Localidade / Política de lixeira / Limites | 1 cada | não | não | objeto de valor | Sempre presentes, com valores padrão da plataforma. |
| ET → Suspensão vigente | 0..2 | sim | no máximo duas (uma por origem) | objeto de valor | Plataforma e Proprietário podem suspender independentemente; cada origem é levantada por quem a impôs (12.2). |
| Papel personalizado → Papel de sistema base | 1 | não | não | referência | Define o nível (DO-ET-07). |

Papéis personalizados existem (DO-ET-07 / B30): A9.4 fala em Papéis "mínimos", o que admite outros; a base obrigatória em um Papel de sistema mantém o nível computável.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O Espaço de Trabalho é o topo. Abaixo dele há uma única cadeia de contenção estrutural (Espaço → Pasta → Subpasta → Lista → Tarefa) e vários conjuntos de entidades de pertencimento direto (CRM, IA, Painéis, transversais). A hierarquia estrutural tem regras de herança e cascata (A3, B25); o pertencimento direto não tem herança de configuração, apenas escopo.

**Pertencimento (teste de existência).** Toda entidade listada na seção 8 falha no teste de existência sem o Espaço de Trabalho: eliminado ele, nenhuma delas tem sentido nem sobrevive. Por isso todas são **dependentes** (contenção ou pertencimento), nunca associações. As únicas relações de associação que o Espaço de Trabalho mantém são com entidades globais (Modelo, Tipos de Canal, Tipos de Campo e, por meio do Membro, Usuário), que sobrevivem a ele.

**"Pertence a" versus "relaciona-se com".** Um Contato *pertence* ao Espaço de Trabalho (não existe sem ele, não pode migrar para outro). Um Contato *relaciona-se com* uma Empresa (Vínculo; cada um existe sem o outro). O Espaço de Trabalho nunca aparece do lado "relaciona-se com" de nenhuma entidade corporativa.

**Propriedade (Proprietário).** Propriedade é governança, não contenção. O Espaço de Trabalho *contém* seus Membros e *é de propriedade de* um deles. A propriedade tem três características: é única, é transferível por ato explícito, e é sempre humana (B7). A cadeia de propriedade da plataforma é: registro → Proprietário (Membro) → Espaço de Trabalho → Proprietário do Espaço de Trabalho (Membro). Ela termina em um humano e nunca sai do Espaço de Trabalho.

**Configurar não é conter.** O Espaço de Trabalho configura a Localidade, mas Localidade é objeto de valor. O Administrador configura Integrações, mas a Integração pertence ao Espaço de Trabalho, não ao Administrador. Um Papel concede permissão de configurar catálogos; isso não torna o Papel pai dos catálogos.

## 11. Estados

Todos os estados desta seção são **estados de sistema**, não personalizáveis. Não há Status (A4.2) no Espaço de Trabalho nem nas suas entidades internas.

### 11.1 Estados do Espaço de Trabalho

| Estado | Significado | Quem pode operar |
| --- | --- | --- |
| `ativo` | Operação normal. Todos os Atores agem dentro das permissões. | Todos. |
| `suspenso` | Operação interrompida de forma reversível. Nenhum Membro age; Automações e Agentes não executam; Integrações não enviam; entrada de Mensagens é apenas persistida (DO-ET-09). | Proprietário e Administradores: apenas ações sem efeito (ver nome, estado, motivo). Proprietário: reativar a própria suspensão e encerrar. Plataforma: reativar a sua, encerrar. |
| `encerrado` | Fim de uso declarado. Conteúdo íntegro, inacessível a todos os Atores exceto para restauração ou exportação, até a eliminação permanente ao fim do prazo de retenção. | Proprietário: restaurar dentro do prazo. |

O Espaço de Trabalho **não** usa os estados `arquivado` e `na lixeira` de A4.1. Justificativa: ele é o escopo da lixeira e do arquivamento; não pode estar na própria lixeira. `encerrado` cumpre para o Espaço de Trabalho o papel que `na lixeira` cumpre para as demais entidades: retenção seguida de eliminação (exceção de raiz registrada em A4.1; DO-ET-08 e DO-ET-17 / B32). Eliminação permanente não é estado: é o fim da existência do registro e de todo o seu conteúdo.

### 11.2 Estados do Membro

| Estado | Significado | Pode agir? | Pode ser referenciado como Proprietário / Responsável / Atribuído? |
| --- | --- | --- | --- |
| `pendente` | Convite emitido e não aceito. Usuário pode ainda não existir. | Não. | Não. Também não integra Equipes (RN-ET-12). |
| `ativo` | Participação plena conforme Papel. | Sim. | Sim. |
| `suspenso` | Participação interrompida de forma reversível (afastamento, investigação, bloqueio). Mantém Papel, Equipes, propriedades e responsabilidades. Permissões efetivas para ações com efeito: vazias. | Não. | Sim, mantém as existentes; novas atribuições são bloqueadas (RN-ET-08). |
| `removido` | Saiu ou foi removido. Registro preservado para autoria e auditoria (A6.4). | Não. | Como autor histórico, sim. Como Proprietário, Responsável ou Atribuído vigente, não (DO-ET-04). |

Distinção obrigatória: o **estado `pendente`** (convite não aceito) não é o **Papel Convidado** (acesso limitado a recursos compartilhados). Um Membro `ativo` pode ter Papel Convidado; um Membro `pendente` pode ter Papel pretendido Administrador. Ver seção 20.9.

### 11.3 Estados da Integração

`conectada`, `desconectada`, `com erro`. Detalhados no documento de Caixa de Entrada para Canais; aqui só se registra que uma Integração `desconectada` ou `com erro` não age como Ator até reconectar.

## 12. Ciclo de vida

### 12.1 Criação

Ato de um Usuário autenticado. A criação é atômica e produz, no mesmo ato:

1. O Espaço de Trabalho em estado `ativo`, com Localidade, política de lixeira, profundidade máxima e Limites com valores padrão da plataforma.
2. O primeiro Membro (`ativo`), vinculado ao Usuário que praticou o ato, com o Papel Proprietário do Espaço de Trabalho. É o Criador do Espaço de Trabalho.
3. Os quatro Papéis de sistema.
4. A Caixa de Entrada única, vazia (B11).
5. O Assistente padrão, como Agente do Espaço de Trabalho cujo Proprietário é o primeiro Membro (DO-ET-11).
6. O primeiro Registro de Atividade ("Espaço de Trabalho criado"), com ator o primeiro Membro.
7. O **Funil padrão**, com nome e Etapas padrão da plataforma na Localidade, referenciado pelo atributo Funil padrão (DO-FUN-09; documento 13, 12.1).
8. Itens iniciais de catálogo, todos com Proveniência "pré-definido pela plataforma", editáveis e arquiváveis: o Motivo de Perda **"Duplicado"** (DO-NEG-12); as três Definições de Campo com entidade-alvo Empresa **Segmento, Porte e Setor** (DO-EMP-10); as Definições de Qualificação e as Finalidades de Consentimento iniciais (DO-CON-05; DO-CON-06).

Sem Espaços, sem Equipes, sem Integrações, sem Canais. Um Espaço de Trabalho recém-criado é vazio de conteúdo e completo de governança e de configuração mínima.

### 12.2 Transições do Espaço de Trabalho

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `suspenso` | Plataforma (inadimplência, abuso, limite crítico) ou Proprietário (pausa voluntária) | Registro de Atividade com motivo e origem. Execuções em andamento passam a `cancelada` (B18) com motivo "Espaço de Trabalho suspenso". Gatilhos de agendamento deixam de disparar. |
| `suspenso` | `ativo` | Quem suspendeu (plataforma reativa suspensões da plataforma; Proprietário reativa as próprias) | Registro de Atividade. Ocorrências de agendamento perdidas **não** são executadas retroativamente (DO-ET-09). Mensagens persistidas durante a suspensão tornam-se visíveis e elegíveis a Automações a partir da reativação. |
| `ativo` ou `suspenso` | `encerrado` | Proprietário (ato explícito, com confirmação) ou plataforma (fim de relação comercial após prazo) | Registro de Atividade. Integrações são desconectadas; Canais deixam de receber. Todas as Execuções passam a `cancelada`. Todos os Membros perdem acesso, exceto o Proprietário para restauração e exportação. Previsão de eliminação é calculada. |
| `encerrado` | `ativo` | Proprietário, dentro do prazo de retenção; se o encerramento foi da plataforma, só depois de a plataforma o permitir | Registro de Atividade. Integrações permanecem desconectadas até reconexão manual (credenciais podem ter expirado). |
| `encerrado` | eliminação permanente | Sistema, ao fim do prazo | Não é transição de estado: é o fim. Ver 12.4. |

Não existe transição `suspenso` → `suspenso` com nova origem: se plataforma e Proprietário suspenderam, ambas constam em Suspensões vigentes (seção 6) e a reativação exige que ambas sejam levantadas, cada uma por quem a impôs (INV-ET-16).

### 12.3 Ciclo de vida do Membro

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| — | `pendente` | Administrador ou Proprietário | Membro criado com Identidade convidada, Papel pretendido e Convidado por. Se já existir Membro `removido` para o mesmo Usuário, ele é reativado para `pendente` em vez de criar outro (DO-ET-03). |
| `pendente` | `ativo` | O destinatário do convite, ao aceitar autenticado | Usuário vinculado; Momento de ingresso preenchido; Equipes pretendidas aplicadas. Se já existir Membro `ativo` ou `suspenso` para o mesmo Usuário neste ET (convite duplicado por identidade diferente), o aceite falha por unicidade (INV-ET-04) e o Membro `pendente` passa a `removido` (revogação pelo Sistema). |
| `pendente` | `removido` | Administrador (revogação) ou Sistema (expiração, duplicidade) | Registro de Atividade. Nada a suceder: um Membro `pendente` nunca teve responsabilidades; Sucessor fica vazio. |
| `ativo` | `suspenso` | Administrador ou Proprietário; nunca sobre o Proprietário (RN-ET-05) | Sessões de Chat e Memória preservadas. Responsabilidades preservadas. Novas atribuições bloqueadas. Execuções "em nome de" esse Membro falham na próxima Ferramenta (B23, A9.3). Solicitações de Aprovação pendentes de que é aprovador permanecem pendentes; a elegibilidade de outro aprovador é definida no documento de Agentes. |
| `suspenso` | `ativo` | Administrador ou Proprietário | Registro de Atividade. |
| `ativo` ou `suspenso` | `removido` | Administrador ou Proprietário (remoção); o próprio Membro (saída); nunca o Proprietário sem transferência prévia (RN-ET-05) | **Sucessão** (DO-ET-04): propriedades transferidas ao Sucessor; Responsável e Atribuído liberados; retirado de todas as Equipes; concessões diretas revogadas, exceto `administrar` sobre contêiner privado que ficaria sem administrador, que passa ao Sucessor (B38); convites emitidos por ele permanecem válidos; Sessões de Chat e Memória do Usuário não são sucedidas: o Sistema as envia à lixeira e as elimina ao fim do prazo da Política de lixeira, salvo reconvite (RN-ET-09e; B87). |
| `removido` | `pendente` | Administrador ou Proprietário | Reativação do mesmo Membro. Papel é redefinido no novo convite; Equipes, concessões e propriedades já transferidas ao Sucessor não são restauradas. |

### 12.4 Eliminação permanente do Espaço de Trabalho e cascata

Ao fim do prazo de retenção de `encerrado`, a plataforma elimina permanentemente, em cascata, **tudo** o que pertence ao Espaço de Trabalho: Espaços e toda a Estrutura de Trabalho, Contatos, Empresas, Negócios, Funis, a Caixa de Entrada com Canais, Conversas e Mensagens, Sessões de Chat, Agentes (inclusive o Assistente padrão instanciado), Habilidades, Automações, Coleções e Documentos de Conhecimento, Painéis, Tags, Definições de Campo, Templates, Arquivos, Integrações, Equipes, Papéis, Membros e Registros de Atividade.

Não são afetados: Usuários, Modelos, Tipos de Canal, Tipos de Campo, Habilidades, Ferramentas e Templates de Agente fornecidos pela plataforma (A1.3; B81), outros Espaços de Trabalho em que os mesmos Usuários sejam Membros.

Recomendação (DO-ET-10 / B32; prazo e conteúdo em C9): a plataforma retém, fora do Espaço de Trabalho, um registro mínimo de que ele existiu (identificador, nome, Criador, momentos de criação e eliminação) para fins legais — registro da plataforma, não entidade da ontologia.

## 13. Regras de negócio ontológicas

- **RN-ET-01.** Toda entidade corporativa pertence, direta ou transitivamente, a exatamente um Espaço de Trabalho, definido na criação e imutável. Não existe operação "mover para outro Espaço de Trabalho" (A1.1, A1.2).
- **RN-ET-02.** A criação de um Espaço de Trabalho é atômica e produz o primeiro Membro como Proprietário, os quatro Papéis de sistema, a Caixa de Entrada única, o Assistente padrão, o Funil padrão e os itens iniciais de catálogo (seção 12.1).
- **RN-ET-03.** O Proprietário do Espaço de Trabalho é sempre um Membro `ativo` deste Espaço de Trabalho, com o Papel Proprietário do Espaço de Trabalho.
- **RN-ET-04.** A transferência de propriedade é um ato único e atômico do Proprietário atual para um Membro `ativo` (o destinatário recebe o Papel Proprietário; o antigo Proprietário recebe o Papel Administrador, salvo escolha explícita de outro Papel). Nenhum Administrador pode transferir propriedade nem se auto-promover. Gera Registro de Atividade com ambos os Membros.
- **RN-ET-05.** O Proprietário não pode ser suspenso, removido nem sair do Espaço de Trabalho enquanto for o Proprietário. A saída exige transferência prévia. Se o Proprietário estiver inacessível, a recuperação de propriedade é procedimento da plataforma, não ação de Administrador (C10). Um Usuário que seja Proprietário de algum Espaço de Trabalho não pode ser excluído da plataforma sem transferência prévia; a exclusão de um Usuário implica a remoção, com sucessão (RN-ET-09), de todos os seus Membros, com o Proprietário de cada Espaço de Trabalho como Sucessor padrão (DO-ET-05 / B26).
- **RN-ET-06.** Um Membro tem exatamente um Papel. O Papel Proprietário do Espaço de Trabalho tem exatamente um titular. Os Papéis de sistema não podem ser excluídos, renomeados ou ter suas permissões mínimas reduzidas.
- **RN-ET-07.** Agentes podem ter Papel (Glossário), mas nunca Proprietário do Espaço de Trabalho nem Administrador, nem Papel personalizado cuja base seja um deles. A responsabilidade final por governança é humana (B7, DO-ET-07 / B30).
- **RN-ET-08.** Um Membro `suspenso` mantém suas propriedades e responsabilidades, mas não pode receber novas: designar como Proprietário, Responsável, Atribuído ou aprovador um Membro que não esteja `ativo` é inválido. Um Membro `suspenso` tem permissões efetivas vazias para ações com efeito.
- **RN-ET-09.** Remover um Membro é uma operação de **sucessão** (DO-ET-04 / B28): (a) todo registro de que ele é Proprietário passa ao Sucessor, um Membro `ativo` cujo Papel não tenha base Convidado, informado pelo ator da remoção — na ausência de indicação, o próprio ator da remoção; se o ator é o próprio removido (saída) ou o Sistema, o Proprietário do Espaço de Trabalho; (b) toda Tarefa (inclusive Subtarefa) e todo Item de Checklist de que é Responsável e toda Conversa de que é Atribuído são liberados (ficam sem esse Ator; o que decorre disso é definido nos documentos de Tarefa, de Checklist e de Caixa de Entrada — RN-TAR-06, RN-CHK-06); (c) toda Solicitação de Aprovação pendente de que é aprovador passa ao Sucessor; (d) autoria (Criador, autor de Comentários e Mensagens) e Registros de Atividade permanecem apontando para o Membro `removido`; (e) Sessões de Chat e Memória do Usuário **não** são sucedidas: são pessoais (B21); o Sistema as envia à lixeira no ato, com o Membro `removido` como Proprietário (exceção única a INV-ET-03), e as elimina ao fim do prazo da Política de lixeira; reconvite dentro do prazo (RN-ET-11) as restaura ao mesmo Membro (DO-CHT-16; B87); (f) concessões diretas do removido são revogadas, **exceto** a concessão `administrar` sobre um contêiner privado (Espaço, Pasta, Subpasta ou Lista) que ficaria sem nenhum Membro `ativo` com `administrar`, que passa ao Sucessor no mesmo ato (B38). Cada transferência gera Registro de Atividade próprio.
- **RN-ET-10.** O registro de Membro nunca é eliminado enquanto o Espaço de Trabalho existir (A6.4). Só é eliminado na eliminação permanente do Espaço de Trabalho.
- **RN-ET-11.** Existe no máximo um Membro por par (Usuário, Espaço de Trabalho). Reconvidar um Usuário removido reativa o Membro existente.
- **RN-ET-12.** Só Membros `ativo` ou `suspenso` integram Equipes. A remoção de um Membro o retira de todas as Equipes. Um convite pode registrar Equipes pretendidas, aplicadas no aceite.
- **RN-ET-13.** Tags, Funis, Motivos de Perda, Motivos de Ganho, Origens, Definições de Qualificação, Finalidades de Consentimento, Definições de Campo do CRM, Papéis personalizados, Equipes e Integrações são definidos exclusivamente no Espaço de Trabalho. Nenhum Espaço, Pasta, Lista ou Funil pode definir os seus próprios.
- **RN-ET-14.** Definições de Campo para Tarefas não são definidas no Espaço de Trabalho (A5.2). O ponto de definição mais alto para Tarefas é o Espaço.
- **RN-ET-15.** A Localidade do Espaço de Trabalho fornece os valores padrão de moeda (Negócio), fuso horário (datas de Tarefa, agendamentos, Períodos de Painel) e idioma (Assistente padrão, Templates). Registros podem guardar valor próprio quando o domínio o exigir (ex.: Negócio em moeda diferente), sem alterar o padrão.
- **RN-ET-16.** Alterar a Localidade não reescreve valores já gravados: datas e valores permanecem; só a interpretação padrão de novos registros muda. Gera Registro de Atividade.
- **RN-ET-17.** Reduzir a profundidade máxima de Subtarefas não elimina Subtarefas existentes além do novo limite; impede novas criações abaixo dele e gera Registro de Atividade. Árvores além do novo limite ficam estruturalmente congeladas — só decrescem de nível — sem eliminação nem promoção (DO-STA-07); o evento "Configuração global alterada" informa quantas Tarefas ficaram além do limite. Não existe cascata destrutiva por mudança de configuração.
- **RN-ET-18.** A política de lixeira só pode variar dentro dos limites mínimo e máximo da plataforma. Reduzi-la não elimina imediatamente registros já na lixeira além do novo prazo: a eliminação ocorre no próximo ciclo, após Registro de Atividade da alteração.
- **RN-ET-19.** Em `suspenso`, nenhum Ator do tipo Usuário, Agente ou Automação pratica ação com efeito, com duas exceções: o Proprietário pode reativar a própria suspensão e encerrar; a plataforma pode reativar a sua, encerrar e eliminar por prazo. Integrações apenas persistem entrada: Canais persistem Mensagens (DO-ET-09 / B31); demais Integrações, conforme o respectivo documento. Sistema pode agir (auditoria, eliminação por prazo).
- **RN-ET-20.** Encerrar o Espaço de Trabalho é ato exclusivo do Proprietário (ou da plataforma). Administradores não podem encerrar.
- **RN-ET-21.** Toda ação sobre o Espaço de Trabalho e suas entidades internas (Membros, Equipes, Papéis, Integrações, configurações) gera Registro de Atividade com ator e, quando aplicável, ator delegante (A6.2).
- **RN-ET-22.** Nenhuma permissão, concessão, compartilhamento ou Papel pode dar a um Sujeito acesso a recurso de outro Espaço de Trabalho. A regra não tem exceção nesta versão (C1).
- **RN-ET-23.** Limites impostos são verificados no momento da ação que os consumiria (convidar Membro, criar Espaço, criar Agente, enviar Arquivo, iniciar Execução). Atingir um limite gera evento; não gera suspensão automática, que é decisão da plataforma. Membros `pendente` contam para o limite de Membros (DO-ET-15 / B34).
- **RN-ET-24.** As ações de governança sobre o Espaço de Trabalho (convidar, suspender e remover Membros; atribuir Papéis; criar Papéis personalizados e Equipes; configurar; gerir Integrações; transferir propriedade; encerrar) decorrem exclusivamente dos Papéis de sistema Proprietário e Administrador (ou de Papéis personalizados com base Administrador). Não são concedíveis por concessão direta nem por compartilhamento a Sujeitos de outro nível (DO-ET-07 / B30).
- **RN-ET-25.** Um Administrador pode suspender, remover ou rebaixar outro Administrador, com Registro de Atividade. Justificativa: exigir o Proprietário para toda mudança de Administrador cria gargalo; a proteção absoluta é a do Proprietário (RN-ET-05). Produto pode restringir (DO-ET-07 / B30).

## 14. Invariantes

- **INV-ET-01.** Toda entidade corporativa tem exatamente um Espaço de Trabalho, e ele nunca muda.
- **INV-ET-02.** Todo Espaço de Trabalho existente tem exatamente um Membro `ativo` com o Papel Proprietário do Espaço de Trabalho.
- **INV-ET-03.** Todo registro que possui Proprietário aponta para um Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho; nunca para um Membro `pendente` ou `removido`. Exceção única: Sessão de Chat de Membro `removido` (RN-ET-09e).
- **INV-ET-04.** Não existem dois Membros no mesmo Espaço de Trabalho vinculados ao mesmo Usuário, nem dois Membros `pendente` com a mesma Identidade convidada.
- **INV-ET-05.** Todo Membro `ativo`, `suspenso` ou `removido` referencia exatamente um Usuário.
- **INV-ET-06.** Todo Membro tem exatamente um Papel, e esse Papel pertence ao mesmo Espaço de Trabalho.
- **INV-ET-07.** Nenhuma relação (Vínculo, referência, Anexo a Arquivo, instanciação de Template, aplicação de Tag, concessão, compartilhamento, Fonte de Dados de Painel, Contexto de Agente) cruza a fronteira de um Espaço de Trabalho.
- **INV-ET-08.** Existe exatamente uma Caixa de Entrada por Espaço de Trabalho, com o mesmo ciclo de vida dele.
- **INV-ET-09.** Existe pelo menos um Agente por Espaço de Trabalho (o Assistente padrão), e o atributo Assistente padrão aponta para um Agente do mesmo Espaço de Trabalho.
- **INV-ET-10.** Os quatro Papéis de sistema existem em todo Espaço de Trabalho.
- **INV-ET-11.** Todo Membro de Equipe está em estado `ativo` ou `suspenso`.
- **INV-ET-12.** Registros de Atividade são imutáveis e nunca são eliminados individualmente; só desaparecem com a eliminação do Espaço de Trabalho.
- **INV-ET-13.** Nenhum Agente é titular dos Papéis Proprietário do Espaço de Trabalho ou Administrador, nem de Papel personalizado cuja base seja um deles.
- **INV-ET-14.** Um Espaço de Trabalho `encerrado` tem Previsão de eliminação preenchida e posterior ao momento de encerramento.
- **INV-ET-15.** Os valores da Localidade, da política de lixeira e da profundidade máxima estão sempre dentro dos limites da plataforma.
- **INV-ET-16.** Um Espaço de Trabalho `suspenso` tem ao menos uma Suspensão vigente; um Espaço de Trabalho `ativo` ou `encerrado` não tem nenhuma.
- **INV-ET-17.** Um Papel personalizado nunca concede permissão que o seu Papel de sistema base não concede.

## 15. Personalização

**Personalizável pelo Espaço de Trabalho** (por Administrador ou Proprietário, salvo indicação):

- Nome do Espaço de Trabalho; Nome de exibição de cada Membro dentro do Espaço de Trabalho (pelo próprio Membro ou por Administrador).
- Localidade (fuso horário, moeda, idioma).
- Profundidade máxima de Subtarefas (até o teto da plataforma).
- Política de lixeira (entre mínimo e máximo da plataforma).
- Template de Espaço padrão (DO-ESP-09), Funil padrão (DO-FUN-09), Identificador legível de Tarefas (DO-TAR-02) e Identificador legível de Negócios (DO-NEG-02).
- Catálogos: Tags, Funis, Motivos de Perda, Motivos de Ganho, Origens, Definições de Qualificação, Finalidades de Consentimento, Definições de Campo do CRM, Templates.
- Disponibilidade de atendimento de cada Membro (pelo próprio Membro, por Administrador ou por Automação — DO-CXE-14).
- Papéis personalizados e suas permissões (dentro do nível do Papel base).
- Equipes.
- Integrações e Canais.
- Assistente padrão: configurável (instruções, Habilidades concedidas, Conhecimento) nos termos do documento de Agentes; não substituível por outro Agente nem excluível (DO-ET-11 / B33).

**Não personalizável:**

- Identificador, Criador, momento de criação.
- Estados e transições do Espaço de Trabalho e do Membro.
- Os quatro Papéis de sistema (nome e permissões mínimas).
- Unicidade do Proprietário; unicidade da Caixa de Entrada.
- Limites impostos (vêm da plataforma).
- A fronteira de isolamento.

Não há Campos Personalizados sobre o Espaço de Trabalho, sobre Membros, Equipes, Papéis ou Integrações nesta versão: A5.2 restringe Definições a Tarefa, Contato, Empresa, Negócio e Conversa. Necessidades como "matrícula do funcionário" ou "centro de custo" do Membro são pendência (C13).

## 16. Herança

O Espaço de Trabalho **não herda de nada**: é a origem de toda herança da plataforma. Ele é o ponto de definição de:

| Aspecto | Como se propaga | Modo nos descendentes (B25) |
| --- | --- | --- |
| Permissões de Papel | Origem "papel no Espaço de Trabalho"; valem em todo recurso não privado. | Contêineres privados interrompem (A9.2); CRM e IA não têm hierarquia, então Papel + concessão direta + escopo `próprios` (seção 17). |
| Tags | Aplicáveis em todo o universo de dados. | Não sobrescritível; uma Tag pode restringir tipos de entidade (B5). |
| Definições de Campo do CRM | Aplicam-se a todos os registros do tipo-alvo. | Não sobrescritível: o CRM não tem níveis. |
| Automações de escopo Espaço de Trabalho | Acumulam com as dos níveis inferiores (B25). | `herdado`; níveis inferiores acrescentam, não removem. |
| Localidade | Valor padrão para todos os registros. | Registro pode guardar valor próprio (RN-ET-15); nenhum nível intermediário redefine o padrão nesta versão. |
| Profundidade máxima de Subtarefas | Vale para todas as Listas. | Não sobrescritível. |
| Política de lixeira | Vale para todos os registros. | Não sobrescritível. |

**O que o Espaço de Trabalho não define e portanto não transmite:** Conjunto de Status, Definições de Campo para Tarefas, Tipos de Tarefa, Visualizações padrão e Funcionalidades habilitadas. O primeiro ponto de definição desses aspectos é o Espaço (A4.2, A5.2, B25). Um Espaço recém-criado parte dos padrões da plataforma ou do **Template de Espaço padrão** (atributo opcional da seção 6, que referencia um Template — DO-ESP-09); em nenhum caso o Espaço de Trabalho define esses aspectos diretamente.

## 17. Permissões e visibilidade

### 17.1 Modelo conceitual (A9)

Uma Permissão é a tupla **(Sujeito, Ação, Recurso, Escopo, Origem)**.

| Elemento | Valores | Observações |
| --- | --- | --- |
| Sujeito | Membro, Equipe, Papel, Agente, Automação | Agente e Automação são Sujeitos com Papel e concessões próprias (A9.1; A6.3). A Automação tem o Proprietário como **teto**: permissão efetiva = próprias ∩ Proprietário atual, avaliada a cada Ação (DO-AUT-01; B88); o Agente não tem teto no Proprietário (DO-AGE-15). A Integração é Ator (A6.1), não Sujeito: age por força da configuração de quem tinha `administrar`, com o Membro configurador como delegante (documento 14; documento 20, 17.4). |
| Ação | ver, comentar, criar, editar, excluir, administrar, executar | `administrar` inclui configurar, compartilhar e conceder permissões sobre o Recurso. `executar` aplica-se a Agentes, Automações, Habilidades e Ferramentas. |
| Recurso | uma entidade ou um contêiner | Inclui o próprio Espaço de Trabalho. |
| Escopo | `registro`, `subárvore`, `próprios` (DO-ET-06 / B29) | `registro`: só o Recurso. `subárvore`: o Recurso e todos os descendentes estruturais (só para contêineres). `próprios`: entre os registros do tipo do Recurso, só aqueles em que o Sujeito é Proprietário, Responsável, Atribuído ou Criador. `próprios` é o que permite "vendedor vê só seus Negócios" sem hierarquia no CRM. |
| Origem | papel no Espaço de Trabalho, propriedade (o Proprietário tem `administrar` sobre o registro — documentos 17, 20 e 21), concessão direta, herança do contêiner pai, compartilhamento e, exclusivamente para Conversas, elegibilidade de Fila (B70) | Ordem de avaliação: concessões e compartilhamentos somam ao Papel; um contêiner privado remove a origem "papel" e "herança" e deixa apenas concessão direta e compartilhamento (A9.2). A elegibilidade de Fila é origem por referência operacional, avaliada a cada consulta sobre a Fila atual da Conversa, nunca herança estrutural (documento 14; A9.1). Nenhuma origem subtrai; restrição é ausência de concessão. |

A **permissão efetiva** de um Sujeito sobre um Recurso é a união das permissões de todas as origens aplicáveis, exceto em contêiner privado, em que apenas concessão direta e compartilhamento contam. Para Agente em nome de Membro, a permissão efetiva é a interseção das duas (A9.3).

### 17.2 Papéis de sistema e o Espaço de Trabalho como Recurso

| Ação sobre o Espaço de Trabalho | Proprietário | Administrador | Membro | Convidado |
| --- | --- | --- | --- | --- |
| Ver o Espaço de Trabalho (nome, Membros, Equipes) | sim | sim | sim | só o próprio Membro e o que lhe foi compartilhado |
| Convidar, suspender, remover Membros | sim | sim, inclusive sobre outros Administradores (RN-ET-25); nunca sobre o Proprietário | não | não |
| Atribuir Papéis | sim | sim, até Administrador; nunca Proprietário | não | não |
| Criar e editar Papéis personalizados, Equipes | sim | sim | não | não |
| Configurar Localidade, política de lixeira, profundidade, catálogos | sim | sim | não | não |
| Gerir Integrações e Canais | sim | sim | não | não |
| Configurar o Assistente padrão | sim | sim | não | não |
| Transferir propriedade | sim | não | não | não |
| Suspender voluntariamente, encerrar, restaurar | sim | não | não | não |
| Exportar todo o conteúdo | sim | sim, com Registro de Atividade (recomendação; produto pode restringir) | não | não |
| Ver conteúdo de contêiner privado (Espaço, Pasta, Subpasta, Lista) sem concessão | não | não | não | não |
| Conceder acesso a contêiner privado, inclusive a si mesmo, por ato de governança registrado (B38) | sim | sim | não | não |

Nenhuma dessas ações é concedível por concessão direta nem por compartilhamento: decorrem exclusivamente do Papel (RN-ET-24). Um Papel personalizado herda a coluna do seu Papel base, nunca mais (INV-ET-17). A privacidade de contêiner (A9.2) vale contra o Papel: Proprietário e Administradores só entram em contêiner privado por concessão, e a única via de autoconcessão é o ato de governança registrado, com motivo, visível a quem tem acesso ao contêiner (B38).

**Padrões dos Papéis Membro e Convidado sobre conteúdo** (recomendação; produto pode ajustar):

- **Membro**: ver, comentar, criar, editar nos Espaços não privados (origem: papel + herança); no CRM, ver todos os Contatos e Empresas, e sobre Negócios e Conversas escopo conforme o Papel (o Papel de sistema Membro dá ver/editar em escopo `registro` para todos; Papéis personalizados podem restringir a `próprios`); na IA, usar o Assistente padrão e os Agentes compartilhados; criar Sessões de Chat próprias; ver Painéis compartilhados.
- **Convidado**: nada por origem "papel". Só o que lhe for compartilhado, no escopo do compartilhamento. Nunca vê a lista de Membros, o CRM inteiro, Integrações ou configurações. Não cria Espaços, Agentes ou Automações.

### 17.3 IA sujeita às mesmas regras

Agentes são Sujeitos com Papel próprio (nunca Administrador ou Proprietário — INV-ET-13) e concessões diretas. Não há atalho: um Agente sem permissão de ver um Contato não o vê, mesmo invocado por quem vê (interseção, A9.3). Um Agente autônomo age só com as suas próprias permissões. Painéis filtram pelo visualizador, não pelo Proprietário do Painel (B20), inclusive quando o visualizador é um Agente consultando um Painel por Ferramenta.

### 17.4 Exceções

Não há exceções ao isolamento. As únicas "superpermissões" são as do Proprietário sobre o próprio Espaço de Trabalho (transferir, encerrar) e as da plataforma (suspender, reativar, eliminar por prazo, recuperar propriedade), que não são permissões de nenhum Sujeito da ontologia.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Espaço de Trabalho criado | Criação atômica | identificador, Criador, primeiro Membro, Localidade inicial | Auditoria; provisionamento da Caixa de Entrada, do Assistente padrão, do Funil padrão e dos itens iniciais de catálogo; Painéis: nenhum (a plataforma não instancia Painéis — RN-PAI-03; documento 21, 12.1) |
| Espaço de Trabalho renomeado | Alteração de nome | antes, depois, ator | Auditoria |
| Configuração global alterada | Localidade, política de lixeira, profundidade | aspecto, antes, depois, ator; quantidade de Tarefas além do novo limite, quando a profundidade é reduzida | Auditoria; Painéis (recalcular fuso); Estrutura de Trabalho (validar profundidade) |
| Propriedade transferida | RN-ET-04 | antigo e novo Proprietário, ator | Auditoria; Assistente padrão (novo Proprietário); notificação |
| Espaço de Trabalho suspenso / reativado | 12.2 | origem, motivo, momento | Automações (parar/retomar Gatilhos); Integrações (pausar/retomar envio); Execuções (cancelar) |
| Espaço de Trabalho encerrado / restaurado | 12.2 | ator, previsão de eliminação | Integrações (desconectar); Membros (perda de acesso); plataforma (agendar eliminação) |
| Espaço de Trabalho eliminado | Fim do prazo | identificador, momento | Plataforma (registro mínimo, DO-ET-10) |
| Membro convidado | 12.3 | Identidade convidada, Papel pretendido, Equipes pretendidas, Convidado por | Notificação; Limites (contagem de Membros) |
| Convite aceito / revogado / expirado | 12.3 | Membro, Usuário (no aceite) | Auditoria; Equipes (aplicar pretendidas) |
| Membro suspenso / reativado | 12.3 | Membro, ator, motivo | Execuções em nome do Membro (falhar); Filas (excluir da distribuição) |
| Membro removido | 12.3 | Membro, ator (ou Sistema, na exclusão do Usuário — RN-ET-05), Sucessor, lista de propriedades transferidas e responsabilidades liberadas | Todos os domínios (aplicar sucessão); Equipes; Filas; Solicitações de Aprovação |
| Papel atribuído / alterado | Mudança de Papel de um Membro ou Agente | Sujeito, antes, depois, ator | Auditoria; avaliação de permissões em curso (B23) |
| Papel personalizado criado / alterado / removido | Gestão de Papéis | Papel, base, permissões, ator; na remoção, Papel de destino dos titulares | Auditoria; reavaliação de permissões |
| Equipe criada / alterada / removida; Membro adicionado / retirado de Equipe | Gestão de Equipes | Equipe, Membros, ator | Filas; concessões a Equipe; Automações |
| Permissão concedida / revogada sobre o Espaço de Trabalho | Concessão direta | Sujeito, Ação, Escopo, ator | Auditoria; Execuções (B23) |
| Integração conectada / desconectada / com erro | Gestão e operação de Integrações | Integração, tipo, ator ou causa | Caixa de Entrada (Canais); Agentes (Ferramentas disponíveis) |
| Limite atingido | RN-ET-23 | limite, valor, ator que tentou | Notificação ao Proprietário; plataforma |

Todos geram Registro de Atividade. Os que envolvem Membro registram o Membro afetado como objeto e o ator da ação como ator; quando um Agente ou Automação pratica a ação em nome de alguém, o ator delegante é registrado (A6.2).

## 19. Dependências

**O Espaço de Trabalho depende de** (entidades que precisam existir antes ou fora dele):

- **Usuário** (global): para ter Membros (o Criador é o primeiro Membro).
- **Modelo** (global): para o Assistente padrão funcionar.
- **Tipos de Canal e Tipos de Campo** (global): para Canais e Definições de Campo existirem.
- **Habilidades, Ferramentas e Templates de Agente fornecidos pela plataforma** (globais — A1.3; B81): referenciados pelo Assistente padrão, que é instanciado do Template "Assistente padrão".
- **Plataforma**: fornece Limites, padrões de Localidade, prazos mínimo e máximo de lixeira e de retenção de `encerrado`.

**Dependem do Espaço de Trabalho**: todas as entidades corporativas (seção 8). Nenhuma delas pode ser criada antes dele nem sobreviver à sua eliminação.

**Documentos que este documento pressupõe ou condiciona:** Espaço (02) recebe a raiz da Estrutura; CRM (Contatos, Empresas, Negócios, Funis, Caixa de Entrada) recebe catálogos, Definições de Campo e a Caixa de Entrada única; IA (Chat, Agentes, Habilidades, Automações, Conhecimento) recebe o Assistente padrão, o modelo de permissões e a regra de sucessão; Painéis recebem a Localidade e B20 aplicado a Convidados.

## 20. Casos limítrofes e ambiguidades

### 20.1 Membro removido que era Proprietário de Negócios, Responsável por Tarefas e Proprietário de Agentes

Aplicação de RN-ET-09. Os Negócios e Agentes passam ao Sucessor no mesmo ato; cada transferência gera Registro de Atividade próprio, com o Membro removido como objeto e o ator da remoção como ator. As Tarefas perdem esse Responsável e podem ficar com zero Responsáveis (válido). Comentários, Mensagens e Registros de Atividade continuam a exibir o Membro `removido` como autor, com o nome que ele tinha. Ninguém "herda a autoria". Risco tratado: sem Sucessor obrigatório, INV-ET-03 seria violado no instante da remoção; por isso o Sucessor é resolvido no mesmo ato, e por padrão é quem remove — sempre um Membro `ativo` com Papel Administrador ou Proprietário.

### 20.2 Único Proprietário tentando sair

Impossível por RN-ET-05: a saída exige transferência prévia para um Membro `ativo`. Se ele for o único Membro `ativo`, precisa convidar alguém e esperar o aceite, ou encerrar o Espaço de Trabalho. A ontologia não admite Espaço de Trabalho sem Proprietário nem por um instante (INV-ET-02). Caso o Proprietário perca acesso à sua conta (Usuário) sem transferir, o Espaço de Trabalho fica governado apenas pelos Administradores, que não podem transferir; a recuperação é procedimento da plataforma (C10).

### 20.3 Usuário que é Membro de dois Espaços de Trabalho

Dois Membros independentes, com Papéis, Equipes, Sessões de Chat, Memória do Usuário e Nome de exibição próprios em cada um. Nada de um Espaço de Trabalho aparece no outro: o Assistente padrão de um não conhece as Sessões do outro; uma Tarefa de um não pode ser vinculada a um Negócio do outro (INV-ET-07). O que é comum é apenas o Usuário (autenticação, preferências pessoais da plataforma, como tema e idioma da interface — atributos do Usuário, não do Membro). Remover o Membro em um deles não afeta o outro. Memória do Usuário pertence ao Membro (Glossário), justamente para não atravessar a fronteira.

### 20.4 Pessoa que é Membro e Contato no mesmo Espaço de Trabalho

Dois registros sem ligação ontológica (A1.4). O funcionário-cliente aparece como Membro quando age dentro da organização e como Contato quando conversa pelo WhatsApp com a organização. Consequências que a ontologia não resolve, e que o produto precisa reconhecer: (a) o Membro pode, se tiver permissão sobre Contatos, ver e editar o próprio registro de Contato e as Conversas em que é Contato; (b) a Caixa de Entrada resolve a Mensagem recebida por Identificador de Contato (B13), nunca por Usuário, então mensagens de um Membro ao número da empresa criam Conversa normalmente; (c) uma organização que queira indicar a coincidência pode fazê-lo por uma Definição de Campo tipo "pessoa" no Contato, o que é referência voluntária, não identidade. Unificação é pendência C2 e não deve ser implementada por inferência (mesmo e-mail, mesmo telefone).

### 20.5 Convidado externo tentando ver um Painel

O Convidado só tem permissão por compartilhamento. Se o Painel não foi compartilhado com ele, não o vê. Se foi, vê o Painel, mas cada Widget é filtrado pela permissão efetiva do visualizador (B20): como o Convidado não tem permissão sobre as Fontes de Dados (Tarefas de uma Lista, Negócios de um Funil), o Painel aparece vazio, a menos que as Listas ou os registros também tenham sido compartilhados com ele. Compartilhar o Painel não compartilha os dados. Isso é intencional: Painel não é canal de vazamento.

### 20.6 Agente executando após o Proprietário do Agente ser removido

Dois casos. (a) **Execução autônoma** (por Automação ou agendamento): o Agente usa só as próprias permissões (A9.3); a remoção do Proprietário não as altera; a Execução continua; o Agente passa ao Sucessor (RN-ET-09a), e Solicitações de Aprovação que tinham o removido como aprovador passam ao Sucessor (RN-ET-09c). (b) **Execução em nome do Membro removido**: a permissão efetiva é a interseção com as permissões de um Membro `removido`, que são vazias; a próxima Ferramenta invocada falha, a Execução passa a `falhou` e o evento é registrado (B23). Em nenhum caso o Agente fica sem Proprietário ou continua agindo em nome de quem já não é Membro.

### 20.7 Espaço de Trabalho suspenso com Automações agendadas e Conversas chegando pelo WhatsApp

**Automações**: Gatilhos de agendamento não disparam; nada é enfileirado; na reativação, as ocorrências perdidas não são executadas retroativamente (DO-ET-09) — uma Automação que "envia lembrete toda segunda" não envia dez lembretes atrasados. Gatilhos por evento também não disparam, pois nenhum Ator produz eventos durante a suspensão, exceto Integrações.

**Mensagens recebidas**: o Canal continua conectado e as Mensagens recebidas são **persistidas** (Conversa criada ou reaberta, sem Atribuído, sem distribuição por Fila, sem Automação, sem Agente, sem resposta automática). Justificativa: a Mensagem é o registro de um fato do mundo real — o cliente falou com a organização — e perder esse fato é dano de integridade que a reativação não repara; já a resposta tardia é dano operacional que a reativação repara. A alternativa (rejeitar ou não persistir) transfere o custo da suspensão comercial ao Contato, que não é parte da relação comercial com a plataforma. Nenhuma Mensagem é enviada durante a suspensão, inclusive confirmações automáticas. Na reativação, as Conversas persistidas tornam-se elegíveis a distribuição e Automações a partir daquele momento (não retroativamente). Ver DO-ET-09 / B31.

### 20.8 Encerramento e retenção/eliminação de dados

Ao encerrar, o conteúdo fica íntegro e inacessível pelo prazo de retenção de `encerrado` (definido pela plataforma, não pela política de lixeira do Espaço de Trabalho: a política de lixeira é decisão da organização; a retenção de encerramento é proteção contra encerramento acidental e obrigação legal, e não pode ser reduzida pela organização). Dentro do prazo, só o Proprietário pode restaurar ou exportar. Ao fim, eliminação em cascata total (12.4). Registros de Atividade são eliminados junto: não existe auditoria de um Espaço de Trabalho que não existe mais, salvo o registro mínimo da plataforma (DO-ET-10 / B32). Contatos com pedido de eliminação pendente (LGPD, C9) são eliminados de qualquer forma na cascata. Membros são eliminados; Usuários não.

### 20.9 Estado `pendente` versus Papel Convidado

O estado `pendente` significa "convite não aceito"; o Papel Convidado significa "acesso limitado ao que foi compartilhado". Um Convidado (Papel) `ativo` é um Membro pleno na ontologia (é Ator, tem Registros de Atividade), apenas com poucas permissões. Um Membro `pendente` (estado) não é Ator ainda. O estado chamava-se "convidado" na primeira versão deste documento e foi renomeado na constituição (A4.1) e no Glossário para eliminar a colisão; este documento usa `pendente` em código para o estado e Convidado com inicial maiúscula para o Papel.

### 20.10 Administrador tentando remover o Proprietário ou a si mesmo

Remover o Proprietário: inválido (RN-ET-05). Remover a si mesmo (saída): válido, com sucessão; o Sucessor padrão não pode ser ele próprio, então, quando o ator da remoção é o próprio removido, o Sucessor padrão é o Proprietário do Espaço de Trabalho (RN-ET-09a), salvo Sucessor explícito.

### 20.11 Integração que age depois de seu Administrador configurador ser removido

A Integração pertence ao Espaço de Trabalho, não ao Membro. Continua conectada. O ator delegante das ações passa a ser registrado como ausente, com a Integração como ator único, até que outro Administrador a reconfigure. Não há sucessão de Integrações porque Integração não tem Proprietário (A7 não a lista; DO-ET-16 / B35); tem Membro configurador, que é rastreabilidade, não governança. Decidido no documento de Caixa de Entrada (DO-CXE-02): Canal **não** tem Proprietário; é infraestrutura organizacional, e a Fila é o nível operacional em que a responsabilidade se atribui (Atribuído por Conversa).

### 20.12 Limite de Membros atingido com convites pendentes

Um Membro `pendente` conta para o limite de Membros (senão, convites em massa burlariam o limite até o aceite). Regra em RN-ET-23 (DO-ET-15 / B34); limites em si são C8.

### 20.13 Administrador concede "administrar o Espaço de Trabalho" a um Convidado por concessão direta

Inválido (RN-ET-24). Concessões diretas e compartilhamentos somam permissões sobre conteúdo (Espaços, Listas, Painéis, Coleções), nunca ações de governança do Espaço de Trabalho, que decorrem só do Papel. Sem isso, os Papéis de sistema seriam contornáveis e "Administrador" deixaria de ter significado verificável.

### 20.14 Usuário exclui a própria conta na plataforma sendo Proprietário de um Espaço de Trabalho

A exclusão é bloqueada até que ele transfira a propriedade ou encerre o Espaço de Trabalho (RN-ET-05). Nos demais Espaços de Trabalho em que é Membro, a exclusão do Usuário produz remoção com sucessão (RN-ET-09), com o Proprietário de cada um como Sucessor padrão e o Sistema como ator. O Membro `removido` continua a referenciar o identificador do Usuário excluído (INV-ET-05): a autoria histórica não se perde.

## 21. O que explicitamente NÃO pertence a esta entidade

Resultado do teste de exclusão: o que parece do Espaço de Trabalho, mas pertence a outra entidade.

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Usuário | Plataforma | Global; sobrevive ao Espaço de Trabalho (A1.3). O Espaço de Trabalho contém Membros. |
| Modelo, Tipo de Canal, Tipo de Campo | Plataforma | Catálogos globais referenciados (A1.3). |
| Habilidades, Ferramentas e Templates de Agente fornecidos pela plataforma | Plataforma (A1.3; B81) | Concedidas, permitidas ou instanciadas com Proveniência, nunca contidas (B15, B16, DO-AGE-12). |
| Plano, assinatura, fatura, cobrança | Relação comercial (fora da ontologia) | O Espaço de Trabalho recebe Limites; não modela a relação. |
| Conjunto de Status, Definições de Status | Espaço, Pasta, Subpasta, Lista | A4.2. O Espaço de Trabalho não é nível da estrutura. |
| Definições de Campo para Tarefas | Espaço, Pasta, Subpasta, Lista | A5.2. Só as do CRM são do Espaço de Trabalho. |
| Tipos de Tarefa, Visualizações padrão, Funcionalidades habilitadas | Espaço e descendentes | B25 (ponto de definição na estrutura). |
| Tarefas | Lista | Nunca existem diretamente sob o Espaço de Trabalho (A3.2). |
| Canais, Filas, Conversas, Mensagens | Caixa de Entrada | O Espaço de Trabalho possui a Caixa de Entrada; ela contém isso (A2.5, B11). |
| Etapas | Funil | Entidade interna do Funil. |
| Identificadores de Contato | Contato | Entidade interna; a unicidade é por Espaço de Trabalho, mas o registro é do Contato (B13). |
| Execuções | Agente / Automação | B18. |
| Memória do Agente / Memória do Usuário | Agente / Membro | Glossário. O Espaço de Trabalho é só o escopo. |
| Sessões de Chat | Membro (Proprietário) | B21. Pessoais; o Espaço de Trabalho não as lê. |
| Visualizações pessoais | Membro | A8. |
| Preferências da interface (tema, idioma da interface, notificações pessoais) | Usuário | Atributos globais da pessoa, iguais em todos os Espaços de Trabalho. |
| Widgets, Fontes de Dados | Painel | Componentes internos. |
| Fragmentos, versões de Documento | Documento de Conhecimento | Derivados internos. |
| Concessões diretas sobre um Espaço, Lista, Painel, Coleção | O Recurso concedido | A concessão vive no Recurso; o Espaço de Trabalho só guarda concessões sobre si mesmo. |
| Prazo de reabertura de Conversa, regras de distribuição | Caixa de Entrada / Fila | Configuração operacional do CRM (B12). |
| Probabilidade padrão de Etapa | Etapa | |
| Nível de autonomia | Agente | B22. |

## 22. Exemplos conceituais

**Exemplo 1 — Clínica com duas unidades.** A "Clínica Vida" cria um Espaço de Trabalho. Dra. Camila é a Proprietária. Cria dois Espaços ("Unidade Centro", "Unidade Norte"), um Funil "Novos pacientes" (do Espaço de Trabalho, usado pelas duas unidades), a Tag "Convênio" (aplicada a Contatos e a Tarefas de faturamento), conecta um número de WhatsApp (Canal, na Caixa de Entrada única) e cria as Filas "Recepção Centro" e "Recepção Norte". A Equipe "Recepção" reúne cinco Membros. A Localidade define fuso America/Sao_Paulo e moeda BRL, que o Negócio "Pacote de 10 sessões" usa por padrão. Não há segundo Espaço de Trabalho: as unidades são Espaços, porque compartilham pacientes, Funil e Caixa de Entrada.

**Exemplo 2 — Holding.** O grupo "Alfa" tem três empresas com clientes distintos e regras de privacidade distintas. Cria três Espaços de Trabalho. O diretor é Usuário único e Membro (Proprietário) dos três. Um Contato da empresa 1 não existe na empresa 2. Se as empresas quiserem um Painel consolidado, isso é pendência C1: hoje não há como.

**Exemplo 3 — Saída de um vendedor.** João, Membro com Papel Membro, é Proprietário de 40 Negócios, Responsável por 12 Tarefas e Proprietário do Agente "Qualificador". A Administradora Maria o remove e indica Pedro como Sucessor. No mesmo ato: 40 Negócios e o Agente passam a Pedro (41 Registros de Atividade de transferência, mais o da remoção); 12 Tarefas ficam sem Responsável; João sai da Equipe "Vendas"; os Comentários de João seguem assinados por ele. O Agente "Qualificador", que roda por Automação toda manhã, continua rodando com as próprias permissões. Três meses depois, João volta: Maria o convida; o Membro de João é reativado (`removido` → `pendente` → `ativo`), e os seus Comentários antigos voltam a resolver para um Membro `ativo`, sem nenhuma migração.

**Exemplo 4 — Inadimplência.** A plataforma suspende o Espaço de Trabalho "Loja Beta" por falta de pagamento. Durante 5 dias: nenhum Membro entra; a Automação "cobrança semanal" não dispara; 37 Mensagens chegam pelo WhatsApp e são persistidas em 22 Conversas sem Atribuído. No 6º dia, pagamento confirmado; reativação. As 22 Conversas aparecem na Caixa de Entrada e são distribuídas pelas regras de Fila; a Automação "cobrança semanal" dispara na próxima segunda, não retroativamente.

**Exemplo 5 — Convidado.** A contadora externa Ana é Membro `ativo` com Papel Convidado. Recebe compartilhamento da Lista "Notas fiscais" e do Painel "Faturamento mensal". Vê e comenta as Tarefas da Lista; abre o Painel e vê apenas os Widgets cuja Fonte de Dados é essa Lista; os Widgets sobre Negócios aparecem vazios. Não vê a lista de Membros nem a Caixa de Entrada.

## 23. Representação gráfica textual

```
PLATAFORMA (fora da ontologia; entidades globais referenciadas)
├── Usuário (0..N Membros em Espaços de Trabalho distintos)
├── Modelo, Tipo de Canal, Tipo de Campo
└── Habilidades, Ferramentas e Templates de Agente fornecidos pela plataforma

ESPAÇO DE TRABALHO  [1 Proprietário; Criador = primeiro Membro; estado: ativo | suspenso | encerrado; Suspensões vigentes 0..2; Funil padrão (ref. 1)]
│
├── Governança (agregado do Espaço de Trabalho)
│   ├── Membro (1..N)  [Usuário 0..1→1; Papel 1; estado; Disponibilidade de atendimento]
│   │     ├── Memória do Usuário (0..1, entidade interna do Membro)
│   │     └── Sessão de Chat (0..N, pertence ao Membro)
│   ├── Papel (4..N)  [4 de sistema + personalizados, base 1]
│   ├── Equipe (0..N)  ── Membro (N:N, só ativo/suspenso)
│   └── Integração (0..N, exceto Canais)  [Canal é especialização, contido pela Caixa de Entrada]
│
├── Configurações (objetos de valor)
│   ├── Localidade (fuso, moeda, idioma)
│   ├── Política de lixeira
│   ├── Profundidade máxima de Subtarefas
│   ├── Identificador legível de Tarefas · Identificador legível de Negócios
│   └── Limites impostos (origem: plataforma)
│
├── Catálogos (contenção; detalhados nos domínios)
│   ├── Tag (0..N)
│   ├── Definição de Campo do CRM (0..N; Segmento, Porte, Setor pré-definidas para Empresa)
│   ├── Motivo de Perda (0..N; "Duplicado" pré-definido) · Motivo de Ganho (0..N)
│   ├── Origem (0..N)
│   ├── Definição de Qualificação (0..N) · Finalidade de Consentimento (0..N)
│   └── Template (0..N)
│
├── ESTRUTURA DE TRABALHO
│   └── Espaço (0..N) → Pasta → Subpasta → Lista → Tarefa   [documentos 02+]
│
├── CRM (domínio, não entidade; par da Estrutura)
│   ├── Contato (0..N)
│   ├── Empresa (0..N)
│   ├── Negócio (0..N)
│   ├── Funil (1..N; o Funil padrão sempre existe)
│   └── Caixa de Entrada (1, composição) → Canal, Fila, Conversa
│
├── IA (domínio, não entidade; par da Estrutura)
│   ├── Agente (1..N)  [inclui Assistente padrão ─── referenciado pelo ET]
│   ├── Habilidade (0..N)
│   ├── Automação (0..N)
│   └── Coleção de Conhecimento (0..N)
│
├── PAINÉIS (domínio, não entidade; par da Estrutura)
│   └── Painel (0..N)
│
└── Transversais
    ├── Arquivo (0..N)
    └── Registro de Atividade (1..N, imutáveis)

Relações de domínio ↔ Estrutura: sempre associação (Vínculo), nunca contenção.
Nenhuma aresta atravessa a fronteira do Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-ET-01.** O Espaço de Trabalho é a raiz e o limite de isolamento; toda entidade corporativa pertence a exatamente um, imutavelmente. Aplica A1.1 e A1.2. CONSOLIDADA.
- **DO-ET-02.** Existe exatamente um Proprietário do Espaço de Trabalho, titular do Papel homônimo; a transferência é ato atômico exclusivo do Proprietário atual para um Membro `ativo`. Aplica A7 e A9.4; define o mecanismo de transferência. RECOMENDADA (B26).
- **DO-ET-03.** Membro é único por (Usuário, Espaço de Trabalho). No estado `pendente`, o Membro pode existir sem Usuário, dirigido a uma Identidade convidada; o Usuário é vinculado no aceite. Reconvidar um Usuário removido reativa o mesmo Membro. O Criador do Espaço de Trabalho é o primeiro Membro, criado no mesmo ato atômico (Criador é Ator, A7; Usuário só é Ator por meio de Membro, A6.1). Justificativa: preserva a atribuição de autoria histórica sem migração e permite convidar quem ainda não tem conta. RECOMENDADA (B27).
- **DO-ET-04.** Remoção de Membro é uma operação de sucessão: propriedades (Negócio, Contato, Empresa, Agente, Automação, Painel, Coleção) passam a um Sucessor `ativo` sem base Convidado (padrão: o ator da remoção; se o ator é o próprio removido ou o Sistema, o Proprietário do Espaço de Trabalho); responsabilidades de execução (Responsável, Atribuído) são liberadas; aprovações pendentes passam ao Sucessor; autoria e Registros de Atividade permanecem com o Membro `removido`; Sessões de Chat e Memória do Usuário não são sucedidas — vão à lixeira e são eliminadas por prazo, salvo reconvite (B21; DO-CHT-16; B87). Complementa A6.4 e A7: sem sucessão no mesmo ato, INV-ET-03 quebraria no instante da remoção. RECOMENDADA (B28).
- **DO-ET-05.** O Proprietário não pode ser suspenso, removido nem sair sem transferência prévia, e o seu Usuário não pode ser excluído da plataforma sem transferência ou encerramento; a exclusão de um Usuário implica remoção com sucessão em todos os seus Espaços de Trabalho. Recuperação de propriedade com Proprietário inacessível é procedimento da plataforma, não permissão de Administrador (C10). RECOMENDADA (B26).
- **DO-ET-06.** O elemento Escopo da tupla de permissão (A9.1) assume os valores `registro`, `subárvore` e `próprios`. `próprios` é o mecanismo de restrição em domínios sem hierarquia de contêineres (CRM, IA). RECOMENDADA (B29).
- **DO-ET-07.** Um Membro tem exatamente um Papel. Papéis personalizados são permitidos e declaram um Papel de sistema base (Administrador, Membro ou Convidado), que é teto de permissões e nível para as regras de sistema. Os quatro Papéis de sistema são imutáveis. Agentes podem ter Papel, mas nunca Proprietário ou Administrador, nem base neles. Ações de governança do Espaço de Trabalho decorrem só do Papel, nunca de concessão direta ou compartilhamento. Administrador pode suspender, remover ou rebaixar outro Administrador. Aplica A9.4 e B7. RECOMENDADA (B30).
- **DO-ET-08.** O Espaço de Trabalho tem estados próprios (`ativo`, `suspenso`, `encerrado`) e não usa `arquivado` nem `na lixeira` (A4.1), porque é o escopo desses mecanismos. `encerrado` implica prazo de retenção definido pela plataforma seguido de eliminação permanente em cascata; dentro do prazo, só o Proprietário restaura ou exporta. Registrada como exceção de raiz em A4.1; a retenção e a eliminação estão em B32.
- **DO-ET-09.** Em `suspenso`: nenhum Membro, Agente ou Automação age; Execuções em andamento são canceladas; Gatilhos de agendamento não disparam e ocorrências perdidas não são executadas retroativamente; Canais permanecem conectados e Mensagens recebidas são persistidas sem distribuição, Automação, Agente ou resposta; nada é enviado. Justificativa: integridade do registro de fatos externos sem operação em nome de uma organização suspensa. RECOMENDADA (B31).
- **DO-ET-10.** A eliminação permanente do Espaço de Trabalho elimina tudo o que lhe pertence, inclusive Membros e Registros de Atividade; entidades globais não são afetadas. A plataforma pode reter registro mínimo (identificador, nome, Criador, momentos) fora da ontologia. Relacionada a C9. RECOMENDADA (B32).
- **DO-ET-11.** O Assistente padrão é instanciado em cada Espaço de Trabalho, na criação, como um Agente pertencente ao Espaço de Trabalho, cujo Proprietário é o Proprietário do Espaço de Trabalho e acompanha a transferência de propriedade. Não pode ser excluído nem substituído por outro Agente como padrão; pode ser configurado nos termos do documento de Agentes. Concilia a origem na plataforma (Template de Agente da plataforma — Glossário) com "Proprietário é sempre Membro humano" (B7) e com o isolamento (A1.2: Memória e Sessões do Assistente não podem ser globais) e com A1.3 (o Assistente não está entre as entidades globais). A assimetria com Habilidades fornecidas pela plataforma (referenciadas, B15) é intencional: Habilidade é definição sem estado; o Assistente tem Memória, Sessões e configuração próprias. RECOMENDADA (B33).
- **DO-ET-12.** A Caixa de Entrada é composição 1:1 do Espaço de Trabalho, criada com ele, com o mesmo ciclo de vida. Aplica B11; sem decisão nova.
- **DO-ET-13.** Tags, Funis, Motivos de Perda, Motivos de Ganho, Origens, Definições de Qualificação, Finalidades de Consentimento, Definições de Campo do CRM e Templates são entidades contidas pelo Espaço de Trabalho (têm identidade), não atributos nem objetos de valor. Localidade, política de lixeira, profundidade máxima e Limites são objetos de valor. RECOMENDADA (B34).
- **DO-ET-14.** Só Membros `ativo` ou `suspenso` integram Equipes; convites podem carregar Equipes pretendidas, aplicadas no aceite. RECOMENDADA (B27).
- **DO-ET-15.** Distinguem-se Limites impostos (origem: plataforma; o Espaço de Trabalho está sujeito) de configurações limitantes definidas pelo Espaço de Trabalho (Profundidade máxima de Subtarefas, Política de lixeira), estas sempre dentro de tetos da plataforma. Membros `pendente` contam para o limite de Membros. RECOMENDADA (B34).
- **DO-ET-16.** Integração não tem Proprietário (coerente com A7, que não a lista); tem Membro configurador, para rastreabilidade. Não há sucessão de Integrações. RECOMENDADA (B35); a decidir para Canal no documento de Caixa de Entrada.
- **DO-ET-17.** A retenção de `encerrado` é definida pela plataforma e não pela política de lixeira do Espaço de Trabalho, porque protege contra encerramento acidental e atende a obrigações legais que a organização não pode reduzir. RECOMENDADA (B32).

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-ET-08 consta como exceção de raiz em A4.1. As decisões RECOMENDADAS deste documento estão consolidadas na constituição como B26–B35; a auditoria da fase 6 aplicou B70 (17.1), RN-PAI-03 (18) e RN-CHK-06 (RN-ET-09 b).

## 25. Questões em aberto

1. **Recuperação de propriedade com Proprietário inacessível** (C10). Quem, na plataforma, pode designar novo Proprietário, com que prova (verificação de identidade, maioria de Administradores)? Sem isso, um Espaço de Trabalho pode ficar sem quem transfira, encerre ou exporte.
2. **Compartilhamento entre Espaços de Trabalho** (C1). Holdings precisarão de Painéis consolidados ou Contatos compartilhados; exigiria exceção controlada a INV-ET-07.
3. **Contato que vira Convidado / portal do cliente** (C2, D9). Exigiria ligação Usuário ↔ Contato, hoje proibida por A1.4.
4. **Cotas e limites** (C8). Que limites existem e o que acontece ao atingi-los (recomendação: bloqueio da ação, nunca suspensão automática — RN-ET-23).
5. **Destino das Sessões de Chat e da Memória do Usuário de um Membro removido** — resolvida na revisão da fase 4: lixeira no ato da remoção e eliminação por prazo, salvo reconvite (DO-CHT-16; B87; C11 fechada). Resta o acesso corporativo excepcional (C29).
6. **Campos Personalizados em Membro, Equipe e Integração** (C13). A5.2 não os prevê; organizações pedirão "centro de custo", "matrícula", "cargo" no Membro.
7. **Retenção e eliminação** (C9). Prazo de retenção de `encerrado`, conteúdo do registro mínimo da plataforma, pedido de eliminação de Contato durante `encerrado`.
8. **Horário comercial e semana de trabalho** (C12). Automações, Filas e Painéis precisarão de "dias úteis"; não está na lista de configurações deste documento. Sem decisão, cada domínio inventará o seu.

Resolvidas neste documento com recomendação, sem pendência aberta: persistência de Mensagens durante suspensão (DO-ET-09 / B31, reversível por produto); Administrador remover outro Administrador (RN-ET-25); unicidade global de nome (seção 5, não exigida); Template de Espaço padrão (atributo adicionado à seção 6 na harmonização da fase 2, DO-ESP-09); Identificador legível de Tarefas (idem, DO-TAR-02); renomeação do estado "convidado" para `pendente` (aplicada, A4.1). Recebidas do CRM na revisão da fase 3: Funil padrão criado com o Espaço de Trabalho e ET → Funil 1..N (DO-FUN-09); Identificador legível de Negócios (DO-NEG-02); catálogos Motivos de Ganho, Definições de Qualificação e Finalidades de Consentimento (DO-NEG-06, DO-CON-05, DO-CON-06); Motivo de Perda "Duplicado" e Definições pré-definidas de Empresa instanciados na criação (DO-NEG-12, DO-EMP-10); Disponibilidade de atendimento no Membro (DO-CXE-14); Canal sem Proprietário (DO-CXE-02). Recebidas da IA na revisão da fase 4: Memória do Usuário como entidade interna do Membro (DO-CHT-11; 7.1); Automação como Sujeito de A9.1 com teto do Proprietário (DO-AUT-01; 17.1); Sessões e Memória do Usuário de Membro removido à lixeira (DO-CHT-16; RN-ET-09e); Habilidade, Ferramenta e Template de Agente da plataforma como entidades globais (DO-HAB-02, DO-AGE-12; 12.4, 19, 21, 23).
