# CONTATO

> Domínio: CRM | Documento 10 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Contato** é a representação, dentro de um Espaço de Trabalho, de uma **pessoa física identificável** com quem a organização mantém ou pode manter relacionamento. É o registro que responde à pergunta "com quem a organização fala, vende, atende ou pretende falar", independentemente de essa pessoa trabalhar em alguma Empresa, de já ter comprado algo ou de ter iniciado a conversa.

Quatro propriedades o distinguem de qualquer outra entidade da ontologia:

1. **É externo.** O Contato está do lado de fora da organização. Ele nunca age na plataforma: não é Ator, não tem Papel, não tem permissões, não recebe notificações da plataforma. Tudo o que "o Contato faz" (enviar uma Mensagem, responder a um e-mail) chega à plataforma como fato registrado por um Canal, nunca como ação de um Sujeito (A1.4, A6.1).
2. **É pessoa, não organização.** Empresa representa a organização externa; Contato representa a pessoa. A relação entre os dois é associativa (Vínculo Contato-Empresa, B8): um Contato existe sem Empresa e uma Empresa existe sem Contatos.
3. **É o ponto de resolução da mensageria.** Toda Mensagem recebida por um Canal é resolvida a um Contato por meio de um **Identificador de Contato** (B13). O Contato é a única entidade do CRM que "recebe" comunicação; Empresa e Negócio não têm Identificadores.
4. **É raiz de agregado.** Identificadores de Contato, Consentimentos, Endereços, Valores de Campo e Comentários sobre o Contato não existem fora dele. Conversas, Negócios e Tarefas relacionam-se com ele, mas não lhe pertencem.

O Contato não é um "lead", não é um "cliente", não é um "número de WhatsApp" e não é um "usuário". Lead e cliente são qualificações que o Contato recebe (seção 6); o número é um Identificador que o Contato possui; o usuário é uma entidade global sem ligação com ele (A1.4).

## 2. Propósito

O Contato existe para cinco fins:

1. **Dar identidade estável a uma pessoa externa.** Telefones mudam, e-mails mudam, nomes são grafados de formas diferentes em cada Canal. Sem um registro que sobreviva a essas mudanças, cada Conversa seria com "alguém" e o histórico de relacionamento não existiria.
2. **Unificar os Canais em uma pessoa.** A mesma pessoa fala pelo WhatsApp, responde por e-mail e comenta no Instagram. O Contato é o ponto em que esses fatos convergem, por meio dos seus Identificadores, para que a organização veja uma pessoa e não três remetentes.
3. **Ancorar o relacionamento comercial e de atendimento.** Negócios envolvem Contatos com papel; Conversas têm um Contato principal; Tarefas vinculam-se a Contatos. O Contato é o eixo em torno do qual a **linha do tempo** do relacionamento é derivada.
4. **Sustentar a conformidade.** Consentimentos, pedido de eliminação de dados e anonimização (LGPD, C9) só são possíveis se houver um registro que reúna os dados pessoais de uma pessoa em um só lugar.
5. **Responsabilizar alguém internamente.** Todo Contato tem exatamente um Proprietário (A7): um Membro humano que responde pela qualidade do registro e pelo destino do relacionamento.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, criada por um Ator e existente até a eliminação permanente.
- **Raiz de agregado**: garante a consistência de Identificadores de Contato, Consentimentos, Endereços, Valores de Campo, Comentários sobre o Contato e o Estado pré-mesclagem (seção 7).
- **Pertence diretamente ao Espaço de Trabalho** (documento 01, seção 8): o CRM não tem contêineres intermediários (A5.2). Não tem pai estrutural, não herda configuração de nenhum nível e não pode ser movido.
- **Recurso de permissão** (A9.1) sem hierarquia: a origem das permissões é o Papel, a concessão direta e o compartilhamento; o escopo `próprios` (B29) resolve para o Proprietário e o Criador.
- **Objeto de Vínculos**: associa-se a Empresas, Negócios, Tarefas, Conversas e a outros Contatos (`distinto de`, seção 7.6) sem os conter e sem ser contido por eles.
- **Ponto de resolução de Mensagens**: é referenciado por Conversas (Contato principal, B12) e por Participantes.
- **Não é Ator, não é Sujeito de permissão, não é Usuário, não é Membro, não é Empresa, não é Negócio, não é configuração.**

## 4. Fronteira conceitual

### O que é

- A pessoa física externa enquanto objeto de relacionamento da organização.
- O agregado que reúne os meios de alcançar essa pessoa (Identificadores) e as autorizações que ela deu (Consentimentos).
- O ponto de convergência da linha do tempo de Conversas, Negócios, Tarefas e Comentários sobre a pessoa.

### O que não é

- **Não é Empresa.** Empresa é organização; Contato é pessoa. Uma pessoa jurídica com um único sócio é uma Empresa e um Contato, dois registros vinculados.
- **Não é Usuário.** Usuário é identidade global de quem se autentica na plataforma; Contato nunca se autentica (A1.4; portal do cliente é C2/D9).
- **Não é Membro.** Membro é a relação de um Usuário com o Espaço de Trabalho e é Ator; Contato não age (20.10).
- **Não é Participante de Conversa.** Participante é a presença de um Contato (ou de um Ator) em uma Conversa específica; o Contato existe antes, durante e depois de qualquer Conversa.
- **Não é Identificador de Contato.** O Identificador é o meio de alcance (um número, um e-mail); o Contato é a pessoa. Um Contato sem Identificadores é válido (pessoa conhecida por indicação, ainda sem dados de contato); um Identificador sem Contato não existe.
- **Não é Negócio.** Negócio é uma oportunidade com valor e situação; um Contato pode ter zero ou muitos Negócios, com papéis diferentes em cada um.
- **Não é "lead".** Lead é uma **Qualificação** do Contato (seção 6), não uma entidade nem um estado de sistema.
- **Não é Conversa nem Mensagem.** Essas pertencem à Caixa de Entrada e apenas referenciam o Contato (20.7).

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Contato × Empresa** | Pessoa física; tem Identificadores, Consentimentos, data de nascimento; é o Contato principal de Conversas. | Organização externa; tem razão social, documento de organização, endereço; não tem Identificadores nem Conversas. | Mensagens são resolvidas a Contatos, nunca a Empresas. A ligação entre os dois é Vínculo Contato-Empresa com papel (cargo) e principal (B8). |
| **Contato × Usuário** | Registro corporativo dentro de um Espaço de Trabalho; pessoa externa; sem autenticação. | Entidade global da plataforma; pessoa que se autentica; existe fora de qualquer Espaço de Trabalho. | Nenhuma referência liga um ao outro (A1.4). A coincidência de e-mail entre um Usuário e um Contato não tem significado ontológico (20.10). |
| **Contato × Membro** | Objeto de relacionamento; não age; tem Proprietário. | Ator interno; tem Papel, Equipes, permissões; é Proprietário, Responsável, Atribuído, autor. | Membro está do lado de dentro; Contato, do lado de fora. Um Contato nunca é Proprietário, Responsável ou Atribuído de nada; um Membro nunca é Contato principal de uma Conversa. |
| **Contato × Participante de Conversa** | Pessoa, com identidade e histórico próprios, independente de qualquer Conversa. | Presença de um Contato ou de um Ator em uma Conversa, com papel (contato, atendente, agente, observador); entidade interna da Conversa. | O Participante **referencia** o Contato. Excluir a Conversa remove o Participante, não o Contato. Um Contato pode ser Participante de muitas Conversas ao mesmo tempo (uma por Canal, B12). |
| **Contato × Identificador de Contato** | A pessoa; permanece quando todos os Identificadores mudam. | Meio de alcance (tipo, valor); entidade interna do Contato; único no Espaço de Trabalho por (tipo, valor). | O Identificador é como a plataforma **encontra** o Contato; o Contato é **quem** ela encontra. Trocar todos os Identificadores não cria outro Contato (seção 5). |
| **Contato × Negócio** | Pessoa; sem valor econômico; sem Funil; sem situação. | Oportunidade comercial com valor, Funil, Etapa e situação (`aberto`, `ganho`, `perdido`). | Um Negócio referencia 0..N Contatos com papel (decisor, influenciador...) por Vínculo Contato-Negócio (B9). O papel do Contato no Negócio não é atributo do Contato (seção 6). |
| **Contato × "Lead"** | Entidade com identidade e ciclo de vida. | Valor de Qualificação (definição configurável do Espaço de Trabalho) que um Contato pode ter em um momento. | "Converter lead em contato" não existe: o Contato já é Contato; o que muda é a Qualificação. Situação de Negócio (`ganho`) e Qualificação (`cliente`) são coisas distintas, embora uma Automação possa derivar a segunda da primeira. |

## 5. Identidade

O Contato tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo ou componente.

**Teste de identidade.** Se o nome for corrigido, o telefone for trocado, o e-mail for substituído, a Empresa vinculada mudar, o Proprietário for transferido, a Qualificação passar de "lead" a "cliente" e todos os Valores de Campo forem reescritos, continua sendo o mesmo Contato: as Conversas passadas continuam a ser com ele, os Negócios continuam a envolvê-lo e os Registros de Atividade continuam a referenciá-lo. **O que identifica é o registro, não o identificador de contato.**

Consequências:

- **Nenhum Identificador de Contato é identidade.** Telefone e e-mail são meios de alcance, mutáveis e transferíveis (RN-CON-09). A unicidade de (tipo, valor) no Espaço de Trabalho (INV-CON-02) é uma regra de integridade da resolução de Mensagens, não a definição de quem é o Contato.
- **Nome não é identidade.** Dois Contatos podem ter o mesmo nome. Nome igual gera **suspeita** de duplicidade (seção 7.5), nunca certeza.
- **A mesclagem preserva a identidade do absorvido** (B14): o Contato absorvido passa a `mesclado` e continua a existir como registro que aponta para o sobrevivente; referências históricas a ele permanecem válidas e são resolvidas ao sobrevivente (seção 12.4).
- **Contato "não identificado" não é outra entidade.** Um Contato criado automaticamente a partir de uma Mensagem de número desconhecido é um Contato comum cujo Nome está vazio; "não identificado" é condição derivada (seção 6), não estado.

## 6. Atributos fundamentais

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Nome | nativo | não | Primeiro nome (ou nome completo, se a organização não separar). Pode estar vazio em Contato criado automaticamente (INV-CON-01 exige Nome ou Identificador). |
| Sobrenome | nativo | não | Sobrenome(s). |
| Nome de exibição | derivado | sim | Nome + Sobrenome; se ambos vazios, o rótulo informado pelo Canal do Identificador principal (nome de perfil); se também vazio, o valor exibido do Identificador principal; se não há Identificador, "Contato sem nome". Nunca gravado; recalculado. |
| Não identificado | derivado | — | Verdadeiro quando Nome e Sobrenome estão vazios. Condição, não estado (seção 11). |
| Estado | nativo | sim | Estado de ciclo de vida: `ativo`, `arquivado`, `na lixeira`, `mesclado` (seção 11). |
| Mesclado em | referência (Contato) | condicional | Sobrevivente da mesclagem. Obrigatório e imutável no estado `mesclado`; vazio nos demais (INV-CON-06). |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7; INV-ET-03). Transferível; sucedido na remoção do Membro (B28). |
| Criador | referência (Ator) | sim | Imutável. Pode ser Membro, Agente, Automação, Integração (importação, Canal) ou Sistema. Ator delegante registrado quando houver (A6.2). |
| Momento de criação | nativo | sim | Imutável. |
| Modo de criação | nativo | sim | `manual`, `importação`, `automático por Mensagem`, `automático por Automação ou Agente`, `desdobrado de mesclagem` (12.4). Imutável; alimenta Painéis e regras de duplicidade. |
| Origem | referência (Origem) | não | Definição configurável do catálogo de Origens do Espaço de Trabalho (B34; documento 01, 7.6). Indica a fonte de aquisição (campanha, indicação, site, Canal). 0..1. Não confundir com Modo de criação: uma Origem "Instagram" pode ser atribuída a um Contato criado manualmente. |
| Qualificação | referência (Definição de Qualificação) | não | Posição do Contato no relacionamento (lead, prospecto, cliente, ex-cliente...), escolhida entre as Definições de Qualificação do Espaço de Trabalho (DO-CON-05). 0..1. Não é Status (A4.2), não é situação de Negócio (A4.4). |
| Cargo de exibição | derivado | — | O papel (cargo) do Vínculo Contato-Empresa principal vigente. Cargo **não é atributo do Contato**: pertence ao Vínculo com a Empresa (DO-CON-04). Sem Vínculo principal, vazio. |
| Empresa principal | derivado | — | A Empresa do Vínculo Contato-Empresa principal vigente. 0..1. |
| Data de nascimento | nativo (dia civil) | não | Sem hora, sem fuso. |
| Idioma | nativo | não | Idioma preferido da pessoa. Padrão de exibição: idioma da Localidade do Espaço de Trabalho (RN-ET-15), sem gravar. |
| Fuso horário | nativo | não | Fuso da pessoa, para Automações e agendamento de envio. Padrão de exibição: fuso da Localidade, sem gravar. |
| Foto | referência (Arquivo) | não | 0..1 Arquivo do Espaço de Trabalho (A8). Pode ter sido obtida de um Canal (perfil); a proveniência fica no Arquivo. |
| Descrição | nativo (texto longo) | não | Observações livres sobre a pessoa. Sem autor próprio; histórico nos Registros de Atividade. Não é Comentário (7.4). |
| Identificadores de Contato | entidade interna 0..N | não | Seção 7.1. |
| Consentimentos | objeto de valor com histórico | não | Seção 7.2. |
| Endereços | objeto de valor 0..N | não | Seção 7.3. |
| Tags | associação N:N | não | Tags do Espaço de Trabalho aplicáveis a Contato (B5). |
| Valores de Campo | entidade interna 0..N | não | Um por Definição de Campo Personalizado do Espaço de Trabalho com entidade-alvo Contato (A5.2). |
| Estado pré-mesclagem | objeto de valor | condicional | Cópia dos atributos, Identificadores, Vínculos, Tags, Valores de Campo, Consentimentos e Endereços no instante da mesclagem. Presente apenas em `mesclado` (12.4). |
| Estado anterior à exclusão | nativo (condicional) | condicional | Presente enquanto `na lixeira`: o estado (`ativo` ou `arquivado`) que o Contato tinha ao ser excluído; a restauração o devolve a esse estado e o esvazia, nunca forçando `ativo` (B43 aplicada por analogia ao CRM; mesmo atributo do Negócio, documento 12, 6.1). |
| Momento de arquivamento / de envio à lixeira / de mesclagem | nativo | condicional | Preenchidos no respectivo estado; esvaziados na restauração. |
| Última interação | derivado | — | Momento da Mensagem mais recente (recebida ou enviada) de qualquer Conversa cujo Contato principal é este. Derivado da Caixa de Entrada; nunca gravado no Contato. |

**Sobre "cargo".** Cargo é uma propriedade da relação entre uma pessoa e uma organização, não da pessoa: a mesma pessoa é diretora em uma Empresa e conselheira em outra (B8). Gravar cargo no Contato obrigaria a escolher um e perder o outro, ou a duplicar o Contato. Por isso o cargo é o atributo **papel** do Vínculo Contato-Empresa, e o Contato expõe apenas o derivado "Cargo de exibição". Pessoa sem Empresa que exerce uma função ("consultor independente", "médico autônomo") registra-a na Descrição ou em uma Definição de Campo; não é cargo, porque não há organização do outro lado.

**Sobre a Qualificação.** "Lead", "prospecto", "cliente" são posições em um relacionamento, mutuamente exclusivas em um dado momento e ordenáveis. Tags não servem: são N:N, não exclusivas e sem ordem — um Contato com Tags "lead" e "cliente" ao mesmo tempo é contradição que a plataforma não detectaria. Situação de Negócio não serve: um Contato com um Negócio `ganho` e dois `perdido` é cliente; um sem Negócio pode ser cliente por venda registrada fora da plataforma. Por isso este documento recomenda o atributo **Qualificação**, referência a uma **Definição de Qualificação** do Espaço de Trabalho (catálogo no padrão de Origem e Motivo de Perda, B34), 0..1 por Contato, alterada por ato explícito, Automação ou Agente, com Registro de Atividade (DO-CON-05).

## 7. Entidades internas ou componentes

### 7.1 Identificador de Contato

Entidade interna do Contato (B13): o meio pelo qual um Canal alcança a pessoa e pelo qual a plataforma resolve uma Mensagem recebida ao seu Contato. Tem identidade própria dentro do agregado (é referenciado por Mensagens e por Registros de Atividade), mas não existe fora do Contato.

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Tipo | referência (Tipo de Identificador) | sim | Catálogo da plataforma: `telefone`, `e-mail`, `identidade de WhatsApp`, `usuário de Instagram`, `identificador de chat do site`. Cresce com os Tipos de Canal (A1.3). Um Tipo de Canal declara quais Tipos de Identificador resolve. |
| Valor | nativo | sim | Forma **canônica** do identificador (telefone em formato internacional normalizado; e-mail em minúsculas; identidades de Canal como o Canal as fornece). Chave de unicidade com o Tipo (INV-CON-02). |
| Valor exibido | nativo | não | Forma como foi informado ou como o Canal o apresenta. Apenas apresentação. |
| Canal de origem | referência (Canal) | não | Canal pelo qual o Identificador foi aprendido (Mensagem recebida). Vazio quando informado manualmente ou importado. Se o Canal for eliminado, a referência é limpa; o Identificador permanece. |
| Rótulo informado pelo Canal | nativo | não | Nome de perfil ou apelido que o Canal associa ao identificador (nome no WhatsApp, nome de usuário no Instagram). Não é o Nome do Contato; alimenta o Nome de exibição quando o Nome está vazio. |
| Verificado | nativo (booleano) + momento + meio | não | Verdadeiro quando houve prova de posse: Mensagem recebida por esse identificador, confirmação por código ou verificação declarada por Membro. Identificador aprendido de Mensagem recebida nasce verificado. |
| Principal | nativo (booleano) | sim | No máximo um principal por Tipo por Contato (INV-CON-03). O primeiro Identificador de cada Tipo nasce principal. Determina o destino padrão de envios iniciados pela organização. |
| Criador; momento de criação | referência (Ator); nativo | sim | Imutáveis. Ator delegante quando houver. |

Regras próprias: um Contato pode ter vários Identificadores do mesmo Tipo (dois telefones, dois e-mails); a mesma pessoa pode ter dois `usuário de Instagram` porque a identidade fornecida por esse Tipo de Canal é distinta para cada conta conectada (o valor difere; a unicidade por (tipo, valor) permanece). `telefone` e `identidade de WhatsApp` são Tipos distintos mesmo quando os dígitos coincidem: o primeiro é um número discável; o segundo é uma identidade que um Canal WhatsApp resolve. O produto pode propor criar um a partir do outro; a ontologia não os funde.

**Resolução de Mensagem recebida.** Ao receber uma Mensagem, o Canal produz (Tipo, Valor) do remetente; a plataforma procura o Identificador com esse par entre os Contatos não `mesclado` do Espaço de Trabalho. Encontrado: a Mensagem pertence a uma Conversa cujo Contato principal é o Contato detentor do Identificador (B12). Não encontrado: um Contato é criado automaticamente com esse Identificador (RN-CON-12). A resolução nunca usa Nome, e-mail semelhante ou qualquer heurística: só o par exato.

### 7.2 Consentimento

Objeto de valor **com histórico** dentro do agregado do Contato. Não tem identidade; é uma sequência de registros que nunca são editados nem removidos (apenas acrescentados), da qual se deriva o **consentimento vigente** por (Finalidade, Tipo de Canal).

| Componente | Descrição |
| --- | --- |
| Finalidade | Definição do catálogo de Finalidades de Consentimento do Espaço de Trabalho (DO-CON-06), com padrões da plataforma: `atendimento`, `transacional`, `marketing`. |
| Tipo de Canal | Tipo de Canal a que a decisão se aplica (WhatsApp, E-mail...); ou "todos". |
| Decisão | `concedido` ou `revogado`. |
| Momento | Quando a decisão foi tomada pela pessoa (pode diferir do momento do registro). |
| Origem | Como a decisão chegou: Mensagem recebida (referência à Mensagem), formulário do site, declaração verbal registrada por Membro, importação, Automação. |
| Evidência | 0..1 Arquivo (gravação, formulário) ou referência à Mensagem. |
| Registrado por; momento de registro | Ator e instante do registro. Imutáveis. |

O consentimento vigente para (Finalidade, Tipo de Canal) é a decisão mais recente por Momento entre os registros aplicáveis (o registro "todos" aplica-se a qualquer Tipo de Canal, e um registro específico posterior o sobrepõe para aquele Tipo). Automações e Agentes consultam o vigente antes de enviar Mensagens de uma Finalidade (RN-CON-16). A LGPD é o contexto que exige o histórico; a ontologia não detalha a lei.

### 7.3 Endereço

Objeto de valor: rótulo (residencial, comercial, outro), logradouro, número, complemento, bairro, cidade, estado, país, código postal, principal (no máximo um). 0..N por Contato. Sem identidade: substituir um Endereço não tem "quem era antes" além do Registro de Atividade.

### 7.4 Comentário (no Contato)

Manifestação de um Ator sobre o Contato (A8). Aplica-se o modelo definido para Tarefa (documento 06, 7.1, DO-TAR-07): autor Ator (Agente incluído), conteúdo rico com menções e Anexos, respostas em um nível, resolução no Comentário raiz, edição e exclusão de Comentário de terceiros só por quem tem `administrar` sobre o Contato (no CRM não há "Administrador do contêiner"; mesmo padrão de DO-EMP-15 e DO-NEG-15), exclusão com marcador. Comentário **não é** Mensagem: nunca é enviado ao Contato e o Contato nunca o vê. Comentário **não é** Descrição.

### 7.5 Suspeita de Duplicidade (objeto de valor derivado)

Não é entidade. É o resultado da avaliação de um par de Contatos não `mesclado` contra as regras de detecção (RN-CON-10): par (Contato A, Contato B), motivo (nome idêntico, telefones equivalentes em formatos distintos, e-mail com domínio e nome local iguais, rótulo de Canal igual ao Nome de outro Contato), força (`suspeita` — a força `certa` não existe como suspeita: Identificador igual é impossível por INV-CON-02 e é interceptado na criação, RN-CON-11), momento da avaliação. É recalculável e descartável. A única persistência associada é a decisão "não são a mesma pessoa", registrada como Vínculo Contato-Contato de tipo `distinto de` (7.6), que suprime a suspeita entre aquele par.

### 7.6 Vínculos do Contato

Vínculo é transversal (A8). Específico do Contato:

- **Vínculo Contato-Empresa** (B8): atributos **papel** (cargo ou função, texto livre), **dois indicadores independentes de principal** — **Empresa principal do Contato** (lado do Contato; no máximo um por Contato, sempre entre os vigentes — INV-CON-04) e **Contato principal da Empresa** (lado da Empresa; no máximo um por Empresa — INV-EMP-04; DO-EMP-05) —, **início** (dia civil, opcional), **fim** (dia civil; preenchido = Vínculo encerrado), Criador, momento. No máximo um Vínculo **vigente** (sem fim) por par (Contato, Empresa); Vínculos encerrados ao mesmo par podem coexistir (histórico de reingresso). Mudar de Empresa é **encerrar** o Vínculo (preencher fim) e criar outro, nunca apagar (RN-CON-06); encerrar remove ambos os indicadores.
- **Vínculo Contato-Negócio** (B9): papel no Negócio de catálogo fixo da plataforma (`decisor`, `influenciador`, `comprador`, `técnico`, `usuário`, `outro` com rótulo — DO-NEG-03) e indicador de Contato principal do Negócio. Detalhado no documento de Negócios. O papel no Negócio é atributo desse Vínculo; o papel na Empresa é atributo do outro. Não existe "papel do Contato" isolado.
- **Vínculo Contato-Tarefa** (DO-TAR-08): 0..N, papel textual opcional.
- **Vínculo Contato-Conversa**: **não existe**. A relação Conversa → Contato é referência de Contato principal (B12) e Participante; não é Vínculo. Uma Conversa pode ser vinculada a um Negócio (A8), não a um segundo Contato.
- **Vínculo Contato-Contato `distinto de`**: simétrico, sem papel; registra que dois Contatos foram avaliados e não são a mesma pessoa. Suprime Suspeita de Duplicidade. Removível.

Todo Vínculo é visível apenas a quem vê ambos os lados (mesma regra de DO-TAR-08).

### 7.7 Valor de Campo

Entidade interna (A5.1). Um por Definição de Campo Personalizado do Espaço de Trabalho cuja entidade-alvo é Contato (A5.2). Como o CRM não tem hierarquia, não há Valores `arquivado` por movimentação (B37 não se aplica); Valores desaparecem apenas com a Definição (A5.4). Valor de tipo relação (referência a Tarefas, Negócios, Membros...) é Valor de Campo, não Vínculo (documento 06, 6.3).

## 8. Relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | ET → Contato | Exatamente um, imutável (A1.1). Sem contêiner intermediário. |
| é de propriedade de | Membro | propriedade | Contato → Membro | Exatamente um Proprietário (A7). Sucessão em B28. |
| foi criado por | Ator | referência | Contato → Ator | Criador imutável; ator delegante quando houver. |
| contém Identificadores | Identificador de Contato | contenção (agregado) | Contato → Identificador | 0..N. Sem existência fora do Contato; transferível entre Contatos (RN-CON-09). |
| registra Consentimentos | Consentimento | objeto de valor (histórico) | Contato → Consentimento | 0..N registros, só acréscimo. |
| tem Endereços | Endereço | objeto de valor | Contato → Endereço | 0..N. |
| contém Comentários | Comentário | contenção (agregado) | Contato → Comentário | 0..N. |
| contém Valores de Campo | Valor de Campo | contenção (agregado) | Contato → Valor | 0..N; um por Definição aplicável. |
| tem Foto | Arquivo | referência | Contato → Arquivo | 0..1. Arquivo pertence ao Espaço de Trabalho. |
| tem Origem | Origem | referência (uso de catálogo) | Contato → Origem | 0..1. Eliminar a Origem limpa a referência (RN-CON-18). |
| tem Qualificação | Definição de Qualificação | referência (uso de catálogo) | Contato → Definição | 0..1. Idem. |
| tem Tags | Tag | associação N:N | Contato ↔ Tag | Tags do Espaço de Trabalho aplicáveis a Contato (B5). |
| vinculado a Empresas | Empresa | associação (Vínculo Contato-Empresa) | Contato ↔ Empresa | 0..N, com papel, principal, início, fim (B8). |
| vinculado a Negócios | Negócio | associação (Vínculo Contato-Negócio) | Contato ↔ Negócio | 0..N, com papel no Negócio (B9). |
| vinculado a Tarefas | Tarefa | associação (Vínculo) | Contato ↔ Tarefa | 0..N (DO-TAR-08). |
| vinculado a Documentos de Conhecimento | Documento de Conhecimento | associação (Vínculo) | Contato ↔ Documento | 0..N, sem propriedade (conhecimento.md DO-CNH-07 / B99). Na eliminação permanente do Contato, os Documentos vinculados são marcados para revisão de curadoria, nunca eliminados (B99). |
| distinto de | Contato | associação (Vínculo simétrico) | Contato ↔ Contato | 0..N. Suprime suspeita de duplicidade. |
| mesclado em | Contato | referência | Contato → Contato | 0..1; obrigatório em `mesclado`. Nunca em cadeia (RN-CON-14). |
| é Contato principal de | Conversa | referência inversa | Conversa → Contato | 0..N Conversas (B12). A Conversa pertence à Caixa de Entrada. |
| participa de | Conversa | referência inversa (Participante) | Participante → Contato | 0..N. |
| é remetente de | Mensagem | referência inversa (via Identificador) | Mensagem → Identificador → Contato | Mensagens `recebida` referenciam o Identificador pelo qual chegaram. |
| é âncora de | Sessão de Chat | referência inversa | Sessão → Contato | B21. O Contato não conhece Sessões. |
| é objeto de | Execução de Agente / Automação | referência inversa | Execução → Contato | Visão derivada. |
| é registrado em | Registro de Atividade | referência inversa | Registro → Contato | A linha do tempo é visão derivada (8.1). |
| é mencionado em | Comentário, Descrição de Tarefa | referência inversa (menção) | registro → Contato | Menção não cria Vínculo nem notifica o Contato (DO-TAR-19). |

Distinção aplicada: **pertencer** (Espaço de Trabalho), **CONTER** (Identificadores, Comentários, Valores de Campo; Consentimentos e Endereços como objetos de valor), **USAR** (Origem, Qualificação, Tags, Definições de Campo), **REFERENCIAR** (Arquivo, Ator, Contato sobrevivente), **RELACIONAR-SE** (Vínculos com Empresa, Negócio, Tarefa, Contato). O Contato **não HERDA** de nenhum nível (seção 16) e **não CONFIGURA** nada.

### 8.1 Linha do tempo

Não é entidade nem atributo: é a **visão derivada**, ordenada por momento, que agrega (a) Registros de Atividade cujo objeto é o Contato ou um componente do seu agregado, (b) Conversas cujo Contato principal é ele (e as Mensagens delas), (c) Negócios vinculados e seus eventos, (d) Tarefas vinculadas e seus eventos, (e) Comentários sobre o Contato, e (f) para um sobrevivente de mesclagem, os mesmos itens dos Contatos `mesclado` que apontam para ele. Cada item é exibido apenas se o visualizador tem `ver` sobre ele (RN-CON-21): ver o Contato não dá acesso às suas Conversas nem aos seus Negócios.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Contato → Espaço de Trabalho | 1 | não | não | pertencimento | A1.1. |
| Contato → Proprietário | 1 | não | não | propriedade | A7. Zero deixaria o Contato sem quem responda; vários diluem. |
| Contato → Criador | 1 | não | não | referência | A7. |
| Contato → Identificador | 0..N | sim | sim | contenção | Zero: pessoa conhecida sem dados de contato (indicação). Muitos: dois telefones, dois e-mails. |
| Identificador → Contato | 1 | não | não | contenção | Entidade interna. |
| (Tipo, Valor) → Contato não `mesclado` | 0..1 | sim | não | — | INV-CON-02: o par resolve a no máximo um Contato. |
| Contato → Identificador principal por Tipo | 0..1 | sim | não | — | INV-CON-03. |
| Contato → Consentimento (registro) | 0..N | sim | sim | objeto de valor | Só acréscimo. |
| Contato → Endereço | 0..N | sim | sim | objeto de valor | No máximo um principal. |
| Contato → Comentário | 0..N | sim | sim | contenção | |
| Contato → Valor de Campo | 0..N | sim | sim | contenção | Um por Definição aplicável (INV-CON-07). |
| Contato → Foto | 0..1 | sim | não | referência | |
| Contato → Origem | 0..1 | sim | não | referência | Origem desconhecida é comum. |
| Contato → Qualificação | 0..1 | sim | não | referência | Contato ainda não avaliado é válido; exclusividade é a razão de não ser Tag (DO-CON-05). |
| Contato → Tag | 0..N | sim | sim | associativa | B5. |
| Contato → Vínculo Contato-Empresa | 0..N | sim | sim | associativa | B8. Pessoa física sem Empresa; consultor em várias. |
| Contato → Vínculo Contato-Empresa vigente por Empresa | 0..1 | sim | não | associativa | Reingresso cria outro Vínculo após encerrar o anterior. |
| Contato → Vínculo Contato-Empresa principal | 0..1 | sim | não | associativa | INV-CON-04. |
| Empresa → Contato | 0..N | sim | sim | associativa | Empresa sem pessoas conhecidas é válida (documento de Empresas). |
| Contato → Negócio | 0..N | sim | sim | associativa | B9. |
| Negócio → Contato | 0..N | sim | sim | associativa | B9 (venda sem pessoa nomeada é rara, mas válida). |
| Contato → Tarefa | 0..N | sim | sim | associativa | DO-TAR-08. |
| Contato → Documento de Conhecimento (Vínculo) | 0..N | sim | sim | associativa | conhecimento.md DO-CNH-07 / B99. Documento → Contato também 0..N. |
| Contato → Conversa (como principal) | 0..N | sim | sim | referência inversa | B12. No máximo uma `aberta` ou `pendente` por Canal (regra da Caixa de Entrada). |
| Contato → Contato `distinto de` | 0..N | sim | sim | associativa | |
| Contato → Mesclado em | 0..1 | sim | não | referência | Exatamente um quando `mesclado`. |
| Contato sobrevivente → Contatos `mesclado` que o apontam | 0..N | sim | sim | referência inversa | Vários absorvidos em um sobrevivente. |
| Contato → Estado pré-mesclagem | 0..1 | sim | não | objeto de valor | Só em `mesclado`. |

Sem `DECISÃO NECESSÁRIA` pendente: todas decorrem da constituição ou das decisões da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** Não há. O Contato pertence diretamente ao Espaço de Trabalho, sem Espaço, Pasta ou Lista (A2.2, A5.2). Não tem pai estrutural, não tem filhos estruturais, não é movido. A "hierarquia" que o usuário percebe (Empresa → pessoas) é associação (B8), não contenção: eliminar uma Empresa não elimina os seus Contatos (RN-CON-07).

**Pertencimento (teste de existência).** O Contato **não existe sem o Espaço de Trabalho**. Identificadores, Consentimentos, Endereços, Comentários sobre o Contato, Valores de Campo e o Estado pré-mesclagem **não existem sem o Contato** (agregado). Empresas, Negócios, Tarefas, Conversas, Mensagens, Arquivos, Tags, Origens, Qualificações, Membros **existem sem o Contato**: são associação ou referência. Conversas e Mensagens em particular pertencem à Caixa de Entrada (A2.5, B11) e apenas referenciam o Contato (DO-CON-09).

**"Pertence a" versus "relaciona-se com".** O Contato *pertence* ao Espaço de Trabalho. O Contato *relaciona-se com* Empresa, Negócio, Tarefa e outro Contato (Vínculo). Conversa *referencia* o Contato: nem pertence a ele nem ele a ela. O Proprietário *responde* pelo Contato: propriedade é governança, não contenção — o Contato não pertence ao Membro, e a remoção do Membro transfere a propriedade (B28), nunca elimina o Contato.

**Propriedade.** Exatamente um Proprietário, sempre Membro `ativo` ou `suspenso` (INV-ET-03). Transferível por ato explícito de quem tem `administrar` sobre o Contato (o próprio Proprietário, um Administrador, ou Automação/Agente com essa permissão), com Registro de Atividade. O Atribuído de uma Conversa **não** se torna Proprietário do Contato por atender (RN-CON-05); uma Automação pode fazê-lo, como ato registrado.

## 11. Estados

Todos os estados são de sistema (A4.1). O Contato **não tem Status** (A4.2) e **não tem situação** (A4.4). Qualificação (seção 6) é atributo configurável, não estado: um Contato `arquivado` continua "cliente".

| Estado | Significado | Pode ser editado? | Resolve Mensagens? | Aparece em listagens e Painéis? |
| --- | --- | --- | --- | --- |
| `ativo` | Registro em uso. | Sim. | Sim. | Sim. |
| `arquivado` | Relacionamento encerrado ou dormente; registro preservado, oculto por padrão. | Não (restaurar antes). Comentários: não. | **Sim**: uma Mensagem recebida o devolve a `ativo` (RN-CON-13). | Só com filtro explícito. |
| `na lixeira` | Excluído de forma recuperável, até o fim da Política de lixeira. | Não. | **Sim**: o Identificador continua reservado; a Mensagem o restaura a `ativo` com Registro de Atividade (RN-CON-13). | Só na lixeira. |
| `mesclado` | Absorvido por outro Contato (B14). Terminal. Referências resolvem ao sobrevivente. | Não, nunca. | Não: os Identificadores migraram ao sobrevivente. | Não; acessível por referência histórica. |

Condições derivadas, não estados: **Não identificado** (Nome vazio), **Sem Identificador**, **Com suspeita de duplicidade**, **Sem consentimento vigente para marketing**. Painéis e Automações podem filtrá-las; nenhuma delas restringe ações por si.

## 12. Ciclo de vida

### 12.1 Criação

Cinco modos (atributo Modo de criação), todos gerando Registro de Atividade "Contato criado":

1. **Manual**: Membro (ou Agente em nome de Membro) com `criar` sobre Contatos. Proprietário padrão: o Criador (ou o Membro delegante); pode ser outro Membro `ativo`.
2. **Importação**: Integração ou Membro em lote. Cada linha é um Contato; linhas cujo Identificador colide com um Contato existente são **rejeitadas ou tratadas como atualização**, conforme escolha explícita do ator na importação, nunca criam duplicata (RN-CON-11). Proprietário: o Membro indicado na importação; padrão, o ator.
3. **Automático por Mensagem** (RN-CON-12): o Canal recebe Mensagem de (Tipo, Valor) sem Identificador correspondente. O Sistema cria, no mesmo ato atômico, o Contato (Nome vazio ou Rótulo informado pelo Canal; Modo `automático por Mensagem`; Origem = a Origem configurada no Canal, se houver), o Identificador (verificado, principal, Canal de origem), a Conversa e a Mensagem. **Proprietário**: o Membro `ativo` configurado como Proprietário padrão de Contatos na Fila que recebeu a Conversa; na ausência, o configurado no Canal; na ausência, o configurado na Caixa de Entrada; na ausência, o Proprietário do Espaço de Trabalho (DO-CON-08; DO-CXE-05). A configuração vive na Fila, no Canal e na Caixa de Entrada (documento 14, 6, 7.2, 7.4); a resolução nunca falha, porque o Proprietário do Espaço de Trabalho é o último nível (RN-CXE-29).
4. **Automático por Automação ou Agente**: sujeito às mesmas regras de duplicidade, permissões (A6.3) e Limites impostos (RN-CON-20). Proprietário, na mesma cadeia de DO-EMP-16 e DO-NEG-16: o delegante **Membro** da Execução (a Automação delegante de um Agente invocado por Ação — DO-AUT-15 — não é Membro e não conta); senão, o Membro `ativo` configurado na Automação ou na Ferramenta; senão, o Proprietário do Agente ou da Automação. Nunca vazio; nunca Membro não `ativo` (RN-ET-08).
5. **Desdobrado de mesclagem**: criação de um Contato novo a partir do Estado pré-mesclagem de um Contato `mesclado` (12.4), com Proveniência.

Em todos os modos, INV-CON-01 (Nome ou Identificador) e INV-CON-02 (unicidade) são verificados no ato.

### 12.2 Transições

| De | Para | Quem | Efeitos |
| --- | --- | --- | --- |
| `ativo` | `arquivado` | Ator com `editar` | Registro de Atividade. Vínculos preservados; Conversas e Negócios não são afetados. Suspeitas de duplicidade deixam de ser calculadas para ele. |
| `arquivado` | `ativo` | Ator com `editar`; **Sistema**, ao receber Mensagem (RN-CON-13) | Registro de Atividade com causa ("restaurado por Mensagem recebida" quando for o caso). |
| `ativo` ou `arquivado` | `na lixeira` | Ator com `excluir` | Registro de Atividade. Vínculos ficam ocultos (DO-TAR-08: lado `na lixeira` oculta); Negócios `aberto` que o têm como único Contato continuam válidos; Conversas continuam a referenciá-lo. Identificadores continuam reservados (INV-CON-02 inclui `na lixeira`). |
| `na lixeira` | estado anterior | Ator com `excluir`; **Sistema**, ao receber Mensagem (RN-CON-13) | Registro de Atividade. Vínculos voltam a ser visíveis. |
| `ativo` ou `arquivado` | `mesclado` | Ator com `administrar` sobre **ambos** os Contatos | Mesclagem (12.4). Terminal. |
| `na lixeira` | eliminação permanente | Sistema, ao fim da Política de lixeira; ou Ator com `administrar`, por solicitação do titular (12.5) | Não é estado: é o fim do registro. |

Um Contato `na lixeira` não pode ser mesclado (nem como sobrevivente nem como absorvido) sem restauração prévia; Contatos `ativo` e `arquivado` podem ser mesclados em qualquer combinação (regra única com Empresa, B14); um Contato `mesclado` não transita para nenhum outro estado (INV-CON-05).

### 12.3 Sucessão de Proprietário

Quando o Proprietário é removido do Espaço de Trabalho, todos os seus Contatos passam ao Sucessor no mesmo ato (B28; RN-ET-09a), cada um com Registro de Atividade próprio. Um Proprietário `suspenso` mantém os Contatos; novos Contatos não podem ser atribuídos a ele (RN-ET-08). O Contato nunca fica sem Proprietário nem por um instante (INV-ET-03).

### 12.4 Mesclagem

Operação atômica entre dois Contatos do mesmo Espaço de Trabalho, cada um `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), praticada por Ator com `administrar` sobre ambos, que designa um **sobrevivente** e um **absorvido** (B14). **Estado resultante do sobrevivente**: `ativo` se ao menos um dos dois era `ativo`; `arquivado` só se ambos eram `arquivado` — assim nenhuma Conversa `aberta` migrada fica com Contato oculto (20.12). No mesmo ato:

1. O absorvido grava o **Estado pré-mesclagem** (cópia dos seus atributos, Identificadores, Vínculos, Tags, Valores de Campo, Consentimentos e Endereços) e passa a `mesclado`, com Mesclado em = sobrevivente e Momento de mesclagem.
2. **Identificadores** migram todos ao sobrevivente (a unicidade é preservada porque o absorvido deixa de contar). Um Identificador principal do absorvido só permanece principal se o sobrevivente não tinha principal daquele Tipo.
3. **Vínculos** migram; Vínculos ao mesmo destino com o mesmo papel são fundidos (um só permanece, o mais antigo). Indicador **Empresa principal do Contato**: o do sobrevivente prevalece; se o sobrevivente não tinha, o do absorvido passa a principal. Indicador **Contato principal da Empresa** (DO-EMP-05): migra com o Vínculo; na fusão de dois Vínculos à mesma Empresa, o resultante o conserva se qualquer um o tinha (INV-EMP-04 mantido: no máximo um dos dois o tinha). Vínculos `distinto de` entre os dois são removidos (a mesclagem os contradiz); os demais `distinto de` migram.
4. **Tags**: união. **Consentimentos**: união dos históricos (o vigente é recalculado; o registro mais recente vence, qualquer que seja a origem). **Endereços**: união, mantendo o principal do sobrevivente.
5. **Atributos nativos** (Nome, Sobrenome, Data de nascimento, Idioma, Fuso, Foto, Descrição, Origem, Qualificação) e **Valores de Campo**: regra de precedência — o valor do sobrevivente prevalece quando preenchido; vazio recebe o do absorvido; Descrição é concatenada; seleção múltipla é unida; o ator pode sobrescrever a regra campo a campo no ato (escolha registrada). **Proprietário**: o do sobrevivente.
6. **Comentários** migram ao sobrevivente com autor e momento preservados.
7. **Conversas** (Contato principal e Participantes), **Mensagens** (via Identificador), **Vínculos com Negócios e Tarefas** (inclusive os ocultos por lado `na lixeira`), **âncoras de Sessão de Chat** e **Valores de Campo de tipo relação** em outros registros passam a referenciar o sobrevivente. Se, após a migração, o sobrevivente ficar com duas Conversas `aberta` ou `pendente` no mesmo Canal (B12), a Caixa de Entrada mantém a de Mensagem mais recente e marca a outra `resolvida` com causa "mesclagem", sem mover Mensagens (DO-CXE-21; RN-CXE-10; documento 14, 20.17).
8. **Registros de Atividade** do absorvido permanecem com o absorvido (INV-ET-12); a linha do tempo do sobrevivente os inclui por resolução (8.1).
9. Registro de Atividade "Contatos mesclados" no sobrevivente e no absorvido, com a lista do que migrou e das escolhas de precedência.
10. Se o absorvido já era sobrevivente de mesclagens anteriores, os Contatos `mesclado` que o apontavam passam a apontar ao novo sobrevivente (**sem cadeia**, RN-CON-14).

**Irreversibilidade.** A mesclagem é **irreversível**: o absorvido nunca volta a `ativo`, porque Mensagens, Vínculos e Valores gravados após a mesclagem não podem ser atribuídos a um dos dois com segurança. O que existe é a **restauração de cópia**: criar um Contato novo (Modo `desdobrado de mesclagem`, Proveniência para o absorvido) a partir do Estado pré-mesclagem, e mover para ele, por atos explícitos e registrados, os Identificadores e Vínculos que o ator decidir. O absorvido permanece `mesclado` (DO-CON-11).

### 12.5 Eliminação permanente e anonimização

Dois caminhos, ambos irreversíveis:

- **Fim da Política de lixeira** (A4.1; RN-ET-18): o Sistema elimina o Contato e o seu agregado (Identificadores, Consentimentos, Endereços, Comentários, Valores de Campo, Estado pré-mesclagem), remove todos os Vínculos, elimina os Contatos `mesclado` que o apontavam (eles não têm existência independente do sobrevivente), limpa as âncoras de Sessão de Chat e elimina os **Itens de Memória do Agente** que o referenciam (B78; RN-AGE-23). **Conversas e Mensagens permanecem** na Caixa de Entrada, referenciando um **Marcador de Contato eliminado** (identificador opaco do Contato, sem dados pessoais) no lugar do Contato principal, do Participante e do Identificador remetente. **Negócios permanecem** (o valor econômico é fato da organização), perdendo o Vínculo. Registros de Atividade permanecem, apontando para o identificador opaco (INV-ET-12). O Arquivo da Foto é eliminado se nenhum outro registro o referenciar.
- **Solicitação do titular** (LGPD; C9): Ator com `administrar` executa "eliminar por solicitação do titular" sobre um Contato em qualquer estado exceto `mesclado` (para esse, a solicitação aplica-se ao sobrevivente). Além dos efeitos acima, o conteúdo das Mensagens `recebida` e `enviada` das Conversas dele é **anonimizado** (substituído por marcador; Anexos eliminados), os Rascunhos dessas Conversas são descartados, o Rótulo informado pelo Canal e o Valor dos Identificadores são eliminados sem retenção, e Comentários e Valores de Campo em outros registros que mencionem o Contato preservam apenas a menção como marcador. A Conversa em si (momentos, Canal, Fila, Atribuído, estado) permanece como fato operacional. Registro de Atividade "Contato anonimizado por solicitação do titular", com o ator e a evidência da solicitação (Arquivo).

Ambos são **recomendações** (DO-CON-10) subordinadas a C9: o que Registros de Atividade podem reter, o prazo para atender a solicitação e a conservação de prova de consentimento revogado são decisões jurídicas e de produto.

## 13. Regras de negócio ontológicas

- **RN-CON-01.** Contato representa exatamente uma pessoa física. Organizações são Empresas; a mesma realidade "empresa de um sócio só" é um Contato e uma Empresa vinculados.
- **RN-CON-02.** Um Contato existe sem Empresa, sem Negócio, sem Conversa, sem Identificador e sem Qualificação. A única exigência de conteúdo é Nome ou ao menos um Identificador (INV-CON-01).
- **RN-CON-03.** Todo Contato tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (A7, INV-ET-03), transferível por ato registrado e sucedido na remoção do Membro (B28).
- **RN-CON-04.** Contato nunca é Ator, Sujeito de permissão, Proprietário, Responsável, Atribuído ou aprovador. Nada na plataforma é "do Contato" no sentido de governança.
- **RN-CON-05.** Atender uma Conversa, ser Responsável por Tarefa vinculada ou ser Proprietário de Negócio vinculado não altera o Proprietário do Contato. A transferência de propriedade é sempre ato explícito (de Membro, Automação ou Agente), com Registro de Atividade.
- **RN-CON-06.** Cargo é atributo do Vínculo Contato-Empresa, não do Contato. A saída de uma pessoa de uma Empresa **encerra** o Vínculo (preenche fim) e nunca o apaga; reingresso cria Vínculo novo. Apagar um Vínculo é ato distinto de encerrá-lo, reservado a correção de erro, e gera Registro de Atividade.
- **RN-CON-07.** Eliminar, arquivar ou enviar à lixeira uma Empresa não elimina, arquiva nem envia à lixeira os seus Contatos; apenas encerra (na eliminação, remove) os Vínculos. O inverso também vale.
- **RN-CON-08.** Todo Identificador de Contato tem exatamente um Tipo do catálogo da plataforma e um Valor canônico; a normalização é responsabilidade da plataforma no ato de gravação, e dois valores que normalizam para o mesmo canônico são o mesmo Identificador.
- **RN-CON-09.** Um Identificador pode ser transferido de um Contato a outro por Ator com `editar` em ambos, com Registro de Atividade nos dois. A transferência move apenas o Identificador e a resolução futura; Conversas e Mensagens passadas permanecem com o Contato de origem. O ator pode, em ato separado e registrado, mover Conversas específicas ao destino (DO-CON-12).
- **RN-CON-10.** Suspeita de Duplicidade é calculada, nunca gravada como entidade; os critérios mínimos são: Nome de exibição idêntico (normalizado), telefones equivalentes com Tipos distintos (`telefone` × `identidade de WhatsApp`), e-mails que diferem apenas em maiúsculas ou pontuação tolerada pelo domínio, Rótulo informado pelo Canal idêntico ao Nome de outro Contato. O Vínculo `distinto de` suprime a suspeita para o par.
- **RN-CON-11.** Criar ou editar um Identificador cujo (Tipo, Valor) já pertence a outro Contato não `mesclado` (inclusive `arquivado` ou `na lixeira`) é **rejeitado**, com indicação do Contato existente; o ator pode então restaurar, mesclar ou transferir. Nenhuma operação (manual, importação, Automação, Agente, Canal) cria um segundo Contato com o mesmo Identificador.
- **RN-CON-12.** Mensagem recebida de (Tipo, Valor) sem Identificador correspondente cria, no mesmo ato atômico, Contato, Identificador (verificado, principal, com Canal de origem), Conversa e Mensagem. Proprietário conforme 12.1 (3). A criação automática está sujeita aos Limites impostos; atingido o limite de Contatos, a Mensagem é persistida em Conversa sem Contato resolvido, com evento "Limite atingido" (RN-ET-23), e a resolução ocorre quando houver capacidade ou quando um Membro a associar manualmente. O tratamento dessa Conversa é do documento de Caixa de Entrada.
- **RN-CON-13.** Mensagem recebida por Identificador de Contato `arquivado` ou `na lixeira` devolve o Contato a `ativo` no mesmo ato, com Registro de Atividade de causa "restaurado por Mensagem recebida" e evento próprio. Justificativa: a pessoa falou com a organização; o registro dormente ou descartado deixou de refletir a realidade, e a alternativa (criar outro Contato) violaria INV-CON-02.
- **RN-CON-14.** Mesclado em aponta sempre para um Contato não `mesclado`. Ao mesclar um sobrevivente anterior, todos os `mesclado` que o apontavam são reapontados ao novo sobrevivente no mesmo ato. Referências históricas resolvem em um passo.
- **RN-CON-15.** A mesclagem é irreversível; a restauração de cópia (12.4) cria um Contato novo com Proveniência e nunca reativa o absorvido.
- **RN-CON-16.** Envio de Mensagem iniciada pela organização (Membro, Agente ou Automação) de uma Finalidade que exija consentimento verifica o consentimento vigente do Contato para (Finalidade, Tipo de Canal). Quais Finalidades exigem consentimento é configuração do Espaço de Trabalho (padrão da plataforma: `marketing` exige; `atendimento` e `transacional` não). A ausência de consentimento vigente bloqueia Automação e Agente; para Membro, o produto decide entre bloquear e alertar, com Registro de Atividade em qualquer caso.
- **RN-CON-17.** Registros de Consentimento nunca são editados nem removidos; uma correção é um registro novo. Migram integralmente na mesclagem.
- **RN-CON-18.** Eliminar uma Origem, uma Definição de Qualificação ou uma Finalidade de Consentimento do catálogo do Espaço de Trabalho exige indicar a substituta ou aceitar que os Contatos fiquem sem o valor; nenhum Contato é eliminado ou alterado de outra forma (princípio de RN-ET-17). Registros de Consentimento preservam o nome da Finalidade à época como valor histórico.
- **RN-CON-19.** Um Contato `arquivado` ou `na lixeira` continua a ser referenciado por Conversas, Negócios e Vínculos; nada é removido por arquivamento ou lixeira. Só a eliminação permanente remove Vínculos (12.5).
- **RN-CON-20.** Criação de Contatos por Automação, Agente ou importação conta para o Limite imposto de Contatos do Espaço de Trabalho (B34) e para o Limite de operações por Execução, Limite imposto definido no documento de Automações (DO-AUT-18; RN-AUT-13); criar Contato é Ferramenta de classe `escrita reversível` (lixeira) para efeito de B22/B77, mas a criação em lote acima do limite por Execução exige aprovação, qualquer que seja o nível de autonomia (DO-CON-13; motivo `limite` — B80).
- **RN-CON-21.** Ver um Contato não concede ver as suas Conversas, os seus Negócios nem as suas Tarefas: cada item da linha do tempo é filtrado pela permissão efetiva do visualizador sobre o próprio item (mesmo princípio de B20).
- **RN-CON-22.** Toda ação sobre o Contato e o seu agregado gera Registro de Atividade com ator e, quando houver, ator delegante (A6.2), incluindo as praticadas pelo Sistema (criação automática, restauração por Mensagem, eliminação por prazo).
- **RN-CON-23.** Nenhuma inferência por coincidência de e-mail, telefone ou nome liga um Contato a um Usuário ou a um Membro (A1.4; C2). A organização que queira registrar a coincidência usa uma Definição de Campo de tipo pessoa, que é referência voluntária, não identidade (documento 01, 20.4).

## 14. Invariantes

- **INV-CON-01.** Todo Contato não `mesclado` tem Nome não vazio ou ao menos um Identificador de Contato.
- **INV-CON-02.** Não existem dois Identificadores de Contato com o mesmo (Tipo, Valor canônico) em Contatos não `mesclado` do mesmo Espaço de Trabalho, qualquer que seja o estado desses Contatos (`ativo`, `arquivado`, `na lixeira`).
- **INV-CON-03.** Cada Contato tem no máximo um Identificador principal por Tipo.
- **INV-CON-04.** Cada Contato tem no máximo um Vínculo Contato-Empresa principal, e ele é vigente (sem fim). Para cada par (Contato, Empresa) existe no máximo um Vínculo vigente.
- **INV-CON-05.** `mesclado` é terminal: nenhum Contato sai desse estado.
- **INV-CON-06.** Um Contato está em `mesclado` se e somente se Mesclado em está preenchido; o destino é um Contato não `mesclado` do mesmo Espaço de Trabalho, distinto dele mesmo.
- **INV-CON-07.** Um Contato `mesclado` não possui Identificadores, Vínculos, Tags nem Valores de Campo ativos: tudo migrou ao sobrevivente; o que resta é o Estado pré-mesclagem e os Registros de Atividade.
- **INV-CON-08.** Cada Contato tem no máximo um Valor de Campo por Definição de Campo Personalizado aplicável, e nenhum Valor sem Definição (A5.4).
- **INV-CON-09.** Todo Contato tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (INV-ET-03), e exatamente um Criador.
- **INV-CON-10.** Nenhum Contato referencia Usuário, Membro (exceto como Proprietário, Criador ou Valor de Campo de tipo pessoa) ou qualquer entidade de outro Espaço de Trabalho (INV-ET-07).
- **INV-CON-11.** Toda Conversa referencia, como Contato principal, um Contato não `mesclado` do mesmo Espaço de Trabalho ou um Marcador de Contato eliminado; nunca um Contato `mesclado` (as referências são reapontadas no ato da mesclagem).
- **INV-CON-12.** O histórico de Consentimento é monotônico: só cresce; nenhum registro é alterado ou removido enquanto o Contato existir.
- **INV-CON-13.** Contato nunca ocupa posição de Ator: não é Proprietário, Responsável, Atribuído, aprovador, Criador nem autor de Comentário ou de Mensagem `enviada` ou `interna`.

## 15. Personalização

**Personalizável pelo Espaço de Trabalho** (Administrador ou Proprietário do Espaço de Trabalho; RN-ET-13):

- **Definições de Campo Personalizado** com entidade-alvo Contato (A5.2), com todos os Tipos de Campo (A5.3), inclusive relação e fórmula.
- **Origens** (catálogo, B34).
- **Definições de Qualificação** (catálogo; DO-CON-05): nome, cor, ordem; a plataforma fornece um conjunto inicial editável (lead, prospecto, cliente, ex-cliente).
- **Finalidades de Consentimento** (catálogo; DO-CON-06) e quais exigem consentimento para envio (RN-CON-16).
- **Tags** aplicáveis a Contato (B5).
- **Critérios adicionais de Suspeita de Duplicidade** além dos mínimos de RN-CON-10 (por exemplo, incluir Data de nascimento + Nome), como configuração do Espaço de Trabalho.
- **Proprietário padrão de Contatos criados automaticamente** (na Fila, no Canal e na Caixa de Entrada; documento 14; DO-CXE-05).
- **Visibilidade padrão do CRM por Papel personalizado** (escopo `registro` ou `próprios`; seção 17).

**Não personalizável:**

- Identidade, Criador, momento e Modo de criação.
- Estados e transições (seção 11 e 12), inclusive a restauração por Mensagem (RN-CON-13).
- Catálogo de Tipos de Identificador (da plataforma) e a regra de unicidade (INV-CON-02).
- A regra "cargo pertence ao Vínculo" e "um principal por Contato".
- A irreversibilidade da mesclagem.
- Os atributos nativos da seção 6: não podem ser removidos nem renomeados; o produto pode ocultá-los na apresentação.

Não há "tipos de Contato" (pessoa física × jurídica) nesta versão: pessoa jurídica é Empresa. Não há Campos Personalizados sobre Identificador de Contato, Vínculo Contato-Empresa ou Consentimento (A5.2 não os prevê; questão 4 da seção 25).

## 16. Herança

O Contato **não herda configuração de nenhum nível**: o CRM não tem hierarquia de contêineres (A5.2), e o Contato não é contêiner de nada com configuração. Ele **consome** configuração do Espaço de Trabalho:

| Aspecto | Fonte | Modo |
| --- | --- | --- |
| Definições de Campo (entidade-alvo Contato) | Espaço de Trabalho | Aplicam-se a todos os Contatos; não sobrescritíveis (documento 01, seção 16). |
| Tags, Origens, Definições de Qualificação, Finalidades de Consentimento | Espaço de Trabalho | Catálogos únicos. |
| Localidade (idioma, fuso) | Espaço de Trabalho | Padrão de exibição quando Idioma e Fuso do Contato estão vazios; nunca gravado (RN-ET-15). |
| Permissões | Papel + concessão direta + compartilhamento | Sem origem "herança do contêiner pai" (não há pai). |
| Política de lixeira, Limites impostos | Espaço de Trabalho | Valem para o Contato como para todo registro. |

O Contato **não transmite** nada: Identificadores, Consentimentos e Comentários não herdam do Contato — pertencem a ele. Vínculos não propagam propriedade, permissões nem Tags entre Contato, Empresa e Negócio: uma Tag na Empresa não aparece nos seus Contatos; o Proprietário da Empresa não é Proprietário dos Contatos vinculados.

## 17. Permissões e visibilidade

### 17.1 O Contato como Recurso

Tupla (Sujeito, Ação, Recurso, Escopo, Origem) (A9.1), com Recurso = um Contato ou "Contatos" (o tipo, para Papéis). Ações aplicáveis: `ver`, `comentar`, `criar`, `editar`, `excluir`, `administrar`. `executar` não se aplica.

| Ação | Alcance no Contato |
| --- | --- |
| `ver` | Atributos, Identificadores, Consentimentos, Endereços, Tags, Valores de Campo, Comentários; Vínculos cujo outro lado o Sujeito também vê. **Não** inclui Conversas, Negócios e Tarefas vinculados (RN-CON-21). |
| `comentar` | Criar Comentários e responder. |
| `criar` | Criar Contatos (manual, importação); aplica-se ao tipo, não a um registro. |
| `editar` | Atributos, Identificadores (criar, editar, remover, transferir — com `editar` também no destino), Consentimentos (acrescentar registro), Endereços, Tags, Valores de Campo, Qualificação, Origem, Vínculos (com permissão correspondente no outro lado), arquivar e restaurar. |
| `excluir` | Enviar à lixeira e restaurar da lixeira. |
| `administrar` | Transferir Proprietário, mesclar (em ambos), eliminar por solicitação do titular, compartilhar, conceder permissões sobre o Contato. |

Origens: **Papel** (escopo `registro` para todos os Contatos, ou `próprios`), **concessão direta** (a Membro, Equipe ou Agente, sobre um Contato ou sobre o tipo), **compartilhamento** (um Membro com `administrar` compartilha um Contato específico). Não há origem "herança do contêiner pai" nem privacidade por registro: o Contato, como a Tarefa (DO-TAR-16), é unidade de **ampliação**, não de **restrição**.

### 17.2 Visibilidade: "todos" versus "meus"

Padrão recomendado (documento 01, 17.2): o Papel de sistema **Membro** vê, cria, comenta e edita todos os Contatos (escopo `registro`); **Administrador** e **Proprietário do Espaço de Trabalho** têm também `excluir` e `administrar`; **Convidado** não vê nenhum Contato por Papel, só os compartilhados. Justificativa: o CRM é o "mesmo universo de dados" da organização (B5); a Caixa de Entrada distribui Conversas de qualquer Contato a qualquer Fila, e um atendente que não vê o Contato não consegue atender.

Restrição ("vendedor vê só os seus") é feita por **Papel personalizado** com escopo `próprios` sobre Contatos (B29): o Sujeito vê os Contatos de que é Proprietário ou Criador. Ampliação é feita por concessão direta ou compartilhamento pelo Proprietário do Contato (ou Administrador). "Contatos da minha Equipe" **não é expressável** com os escopos de B29 (`próprios` não abrange Equipe); registrado como questão 1 da seção 25.

### 17.3 Papel de sistema × ações sobre Contatos (padrão recomendado)

| Ação | Proprietário do ET | Administrador | Membro | Convidado |
| --- | --- | --- | --- | --- |
| ver, comentar | todos | todos | todos (ou `próprios`, por Papel personalizado) | só compartilhados |
| criar | sim | sim | sim | não |
| editar | todos | todos | todos (ou `próprios`) | não, salvo compartilhamento com `editar` |
| excluir (lixeira) | todos | todos | `próprios` (recomendação) | não |
| administrar (transferir Proprietário, mesclar, compartilhar) | todos | todos | `próprios` (o Proprietário administra os seus) | não |
| eliminar por solicitação do titular; exportar dados do Contato | sim | sim | não | não |
| configurar catálogos (Origens, Qualificações, Finalidades, Definições de Campo) | sim | sim | não | não |

Nenhuma ação de configuração de catálogo é concedível por concessão direta (RN-ET-24). O produto pode ajustar os padrões de Membro; a ontologia fixa apenas que Convidado nada vê por Papel e que `administrar` sobre um Contato inclui mesclar e transferir.

### 17.4 IA sujeita às mesmas regras

Agentes e Automações criam, editam, qualificam e mesclam Contatos apenas com as suas permissões (A6.3; A9.3: em nome de Membro, interseção). Um Agente sem `ver` sobre um Contato não o recebe no Contexto nem por Ferramenta, ainda que a Sessão de Chat esteja ancorada nele. A aprovação é decidida por Ferramenta invocada e classe de efeito (B77), conforme a lista consolidada de B64: enviar Mensagem a Contato é `externa` — em nível `supervisionado` exige aprovação (B22), e em qualquer nível respeita o consentimento vigente (RN-CON-16); mesclar e enviar à lixeira são `escrita irreversível` — em `supervisionado` exigem aprovação; recomendação de produto: exigir aprovação de mesclagem mesmo em `autônomo` (DO-CON-13). Toda Solicitação de Aprovação tem Tempo limite padrão de 72 horas (B80). Painéis sobre Contatos filtram pelo visualizador (B20).

### 17.5 Exceções

Não há exceções ao isolamento (INV-ET-07). O Sistema cria e restaura Contatos por Mensagem recebida (RN-CON-12, RN-CON-13) sem Sujeito de permissão: é ação do Sistema, registrada, não uma permissão.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Contato criado | 12.1 | Contato, Modo de criação, Criador, Proprietário, Identificador inicial, Origem | Automações (boas-vindas, qualificação); Painéis (aquisição); Caixa de Entrada (criação automática); Limites |
| Contato atualizado | Alteração de atributo nativo, Endereço, Descrição | Contato, atributo, antes, depois, ator | Auditoria; Automações |
| Identificador adicionado / removido / verificado / tornado principal | 7.1 | Contato, Identificador (Tipo, Valor), ator, Canal de origem | Caixa de Entrada (resolução); duplicidade; Automações |
| Identificador transferido | RN-CON-09 | Identificador, Contato de origem, Contato de destino, ator | Caixa de Entrada; auditoria |
| Vínculo Contato-Empresa criado / alterado / encerrado / removido | 7.6 | Contato, Empresa, papel, principal, início, fim, ator | Empresa (contagem, principal); Painéis; Negócios (Empresa proposta ao criar Negócio para o Contato) |
| Vínculo Contato-Negócio / Contato-Tarefa criado / removido | 7.6 | Contato, destino, papel, ator | Linha do tempo; Painéis |
| Proprietário transferido | RN-CON-05; B28 | Contato, antigo, novo, ator (ou Sistema com Sucessor) | Notificação; Painéis por Proprietário; Filas |
| Qualificação alterada | 6 | Contato, antes, depois, ator | Automações (mudança de Funil, boas-vindas de cliente); Painéis (conversão) |
| Origem definida / alterada | 6 | Contato, antes, depois, ator | Painéis de aquisição |
| Consentimento registrado | 7.2 | Contato, Finalidade, Tipo de Canal, decisão, momento, origem | Automações (envio permitido/bloqueado); auditoria |
| Tag aplicada / removida | B5 | Contato, Tag, ator | Automações; Visualizações |
| Comentário adicionado / editado / excluído / resolvido | 7.4 | Contato, Comentário, autor, menções | Notificações a mencionados; linha do tempo |
| Valor de Campo alterado | 7.7 | Contato, Definição, antes, depois, ator | Automações; Painéis |
| Contato arquivado / restaurado | 12.2 | Contato, ator, causa | Visualizações; Painéis |
| Contato restaurado por Mensagem recebida | RN-CON-13 | Contato, estado anterior, Conversa, Canal | Caixa de Entrada; notificação ao Proprietário; Automações ("cliente antigo voltou") |
| Contato enviado à lixeira / restaurado da lixeira | 12.2 | Contato, ator | Auditoria; Vínculos (ocultar/exibir) |
| Suspeita de Duplicidade detectada / descartada | 7.5; RN-CON-10 | Par de Contatos, motivo; no descarte, ator | Notificação ao Proprietário; Painéis de qualidade de dados |
| Contatos mesclados | 12.4 | Sobrevivente, absorvido, lista do que migrou, escolhas de precedência, ator | Caixa de Entrada (reapontar Conversas; resolver duplicidade de Conversa aberta); Negócios; Tarefas; Sessões de Chat; Painéis |
| Contato desdobrado de mesclagem | 12.4 | Contato novo, Contato `mesclado` de origem, ator | Auditoria |
| Contato eliminado permanentemente | 12.5 | Identificador opaco, causa (prazo ou solicitação do titular), ator | Caixa de Entrada (Marcador de Contato eliminado); Negócios; Arquivos; plataforma (C9) |
| Contato anonimizado por solicitação do titular | 12.5 | Identificador opaco, ator, evidência | Caixa de Entrada (anonimizar Mensagens); auditoria |
| Limite de Contatos atingido | RN-CON-12; RN-ET-23 | limite, ator ou Canal que tentou | Proprietário do Espaço de Trabalho; plataforma |

Todos geram Registro de Atividade com o Contato como objeto (e o componente afetado, quando houver), o ator e o ator delegante (A6.2). Os eventos de mesclagem e eliminação são os únicos que outros domínios **precisam** consumir para manter INV-CON-11.

## 19. Dependências

**O Contato depende de:**

- **Espaço de Trabalho** (documento 01): pertencimento, Proprietário (Membro), catálogos (Origens, Tags, Definições de Campo do CRM, Qualificações, Finalidades), Localidade, Política de lixeira, Limites impostos, regra de sucessão (B28).
- **Tipos de Canal e Tipos de Identificador** (plataforma, A1.3): para Identificadores existirem e Mensagens serem resolvidas.
- **Arquivo** (A8): Foto, evidência de Consentimento, Anexos de Comentário.
- **Tipos de Campo** (A5.3): Valores de Campo.

**Dependem do Contato:**

- **Caixa de Entrada** (Conversa, Participante, Mensagem): toda Conversa referencia um Contato principal (B12) e resolve Mensagens por Identificador (B13); recebe deste documento RN-CON-12, RN-CON-13, o Marcador de Contato eliminado, a anonimização (12.5) e a regra de Conversa aberta duplicada após mesclagem (12.4, item 7).
- **Empresa**: Vínculo Contato-Empresa (7.6), com cargo, principal, início e fim; RN-CON-06 e RN-CON-07.
- **Negócio**: Vínculo Contato-Negócio com papel; comportamento na mesclagem e na eliminação do Contato (20.7, 20.8).
- **Tarefa** (documento 06): Vínculo Tarefa-Contato (DO-TAR-08); menções (DO-TAR-19).
- **Agentes, Automações**: Ferramentas de criação, qualificação, mesclagem e envio, sujeitas a RN-CON-16 e RN-CON-20; Gatilhos da seção 18.
- **Chat**: âncora de Sessão (B21).
- **Painéis**: Fontes de Dados sobre Contatos, com derivados (Não identificado, Última interação, Qualificação, Origem, Proprietário).

**Documentos que este documento condiciona:** Empresa (11) herda o Vínculo Contato-Empresa como definido em 7.6; Negócio (12) herda o papel no Vínculo Contato-Negócio e os efeitos de mesclagem/eliminação; Caixa de Entrada (14) herda a criação automática, a restauração por Mensagem, o Proprietário padrão de Contatos e o Marcador de Contato eliminado; Automações (19) herda RN-CON-20 e DO-CON-13.

## 20. Casos limítrofes e ambiguidades

### 20.1 Contato sem Empresa

Válido e comum (pessoa física cliente, paciente, aluno). Nenhum atributo do Contato exige Empresa; Cargo de exibição e Empresa principal ficam vazios. Negócios com esse Contato têm Empresa vazia (B9). Não se cria "Empresa pessoa física" para preencher o vazio: isso duplicaria a pessoa como organização e quebraria RN-CON-01.

### 20.2 Contato em duas Empresas com cargos diferentes

Dois Vínculos Contato-Empresa vigentes, cada um com o seu papel ("Diretora financeira" na Alfa, "Conselheira" na Beta), no máximo um principal (INV-CON-04). O Cargo de exibição é o do principal; a ficha exibe ambos. Um Negócio com a Beta vincula-se ao Contato com papel no Negócio ("decisor"), independente do cargo — os dois papéis não se confundem (7.6).

### 20.3 Contato com dois telefones e dois e-mails

Quatro Identificadores: dois de Tipo `telefone` (um principal), dois de Tipo `e-mail` (um principal). Envios iniciados pela organização usam o principal do Tipo que o Canal exige; Mensagens recebidas por qualquer um resolvem ao mesmo Contato e à mesma Conversa daquele Canal (B12: a Conversa é por Canal, não por Identificador — duas Mensagens de telefones diferentes da mesma pessoa no mesmo Canal WhatsApp caem na mesma Conversa `aberta`). Se a organização preferir uma Conversa por número, é decisão da Caixa de Entrada, não do Contato.

### 20.4 Dois Contatos com o mesmo telefone

Impossível (INV-CON-02). A segunda tentativa — manual, importação, Automação, Agente — é rejeitada com indicação do Contato existente (RN-CON-11), inclusive se ele estiver `arquivado` ou `na lixeira` (o ator restaura, mescla ou transfere). A única forma de "dois Contatos com o mesmo telefone" existirem é um deles estar `mesclado`, e nesse caso o Identificador já não é dele (INV-CON-07). Telefones que diferem só no formato ("+55 11 9…" e "11 9…") são o mesmo Valor canônico (RN-CON-08).

### 20.5 Mensagem recebida de número desconhecido

O Sistema cria Contato, Identificador, Conversa e Mensagem atomicamente (RN-CON-12). O Contato nasce `ativo`, Não identificado (Nome vazio; Nome de exibição = Rótulo informado pelo Canal ou o número), com Identificador verificado e principal, Origem = a configurada no Canal (se houver), Modo `automático por Mensagem`, Proprietário = Membro configurado na Fila, senão no Canal, senão na Caixa de Entrada, senão o Proprietário do Espaço de Trabalho (DO-CON-08; DO-CXE-05). Não se cria um "Contato provisório" nem se espera identificação: a Mensagem é um fato, e a Conversa precisa de Contato principal (B12). O atendente identifica a pessoa depois (preenche Nome, vincula Empresa) ou detecta que é alguém já cadastrado com outro número e **mescla** (ou transfere o Identificador, se o novo registro não tiver mais nada).

### 20.6 Contato mesclado "que era Proprietário de algo"

Não existe: Contato nunca é Proprietário, Responsável, Atribuído nem aprovador (RN-CON-04, INV-CON-13). O que existe é o Contato mesclado ser **referenciado** por Negócios, Conversas e Tarefas; essas referências migram ao sobrevivente (12.4). A confusão nasce de chamar de "dono" o Contato principal de uma Conversa — ele não é dono de nada; a Conversa pertence à Caixa de Entrada.

### 20.7 Contato mesclado referenciado por Negócio ganho

O Vínculo Contato-Negócio migra ao sobrevivente com o mesmo papel; o Negócio `ganho` não é reaberto nem alterado (a situação e a última Etapa são preservadas, B9); o Registro de Atividade do Negócio recebe "Contato vinculado substituído por mesclagem". Painéis que contam "Negócios ganhos por Contato" passam a atribuí-los ao sobrevivente; os Registros de Atividade históricos do Negócio continuam a citar o absorvido, que resolve ao sobrevivente (B14). Se o sobrevivente já tinha Vínculo ao mesmo Negócio com o mesmo papel, os dois Vínculos são fundidos.

### 20.8 Contato que pede exclusão de dados (LGPD) tendo Negócios e Conversas

Ator com `administrar` executa a eliminação por solicitação do titular (12.5). Negócios permanecem (valor, Funil, situação são fatos comerciais da organização), sem Vínculo ao Contato e com marcador na linha do tempo; Conversas permanecem como fatos operacionais, com Contato principal substituído por Marcador de Contato eliminado e Mensagens anonimizadas; Comentários sobre o Contato são eliminados; Itens de Memória do Agente que o referenciam são eliminados (B78; RN-AGE-23); Registros de Atividade permanecem apontando ao identificador opaco. **Documentos de Conhecimento não são alcançados**: o Conhecimento é corpus curado fora do agregado do Contato (B19); o documento 20 (DO-CNH-13) marca para revisão de curadoria os Documentos com Vínculo ao Contato eliminado, nunca os elimina automaticamente; Documentos sem Vínculo ficam em C9. O que a organização precisa reter por obrigação legal (prova de consentimento revogado, registros fiscais em Negócios) e por quanto tempo é decisão jurídica (C9). Se o Contato estiver `mesclado`, a solicitação recai sobre o sobrevivente — a pessoa é uma só.

### 20.9 Contato que muda de Empresa

O Vínculo com a Empresa anterior é **encerrado** (fim preenchido, principal removido) e um Vínculo novo é criado com a nova Empresa, com novo papel e, normalmente, principal (RN-CON-06). Negócios vinculados ao Contato e à Empresa anterior não mudam: a Empresa do Negócio é atributo do Negócio, não derivado do Contato. Painéis podem responder "quem trabalhava na Alfa em 2025" pelo histórico de Vínculos. Apagar o Vínculo antigo é erro de modelagem que a ontologia desencoraja: perde a resposta a essa pergunta.

### 20.10 Contato que também é Membro

Dois registros sem ligação (A1.4; documento 01, 20.4). O funcionário que compra da própria empresa é Membro quando age no Espaço de Trabalho e Contato quando fala pelo WhatsApp da empresa. A resolução de Mensagem por Identificador (7.1) nunca consulta Usuários. O Membro pode, se tiver `ver` sobre Contatos, ver o próprio registro de Contato — consequência que o produto deve reconhecer e que a ontologia não impede. Nenhuma inferência liga os dois (RN-CON-23); portal do cliente é C2/D9.

### 20.11 Agente criando Contatos em massa por Automação

Cada criação é verificada contra INV-CON-01, INV-CON-02, as permissões do Agente (A9.3) e os Limites impostos (RN-CON-20). Acima do Limite de operações por Execução (Limite imposto — DO-AUT-18), a Execução passa a `aguardando aprovação` (B18) e a Solicitação de Aprovação, de motivo `limite` (B80), vai ao Proprietário da Automação (DO-CON-13; RN-AUT-13). Contatos criados assim têm Modo `automático por Automação ou Agente`, Criador = o Agente com a Automação como ator delegante (DO-AUT-15), e Proprietário resolvido pela cadeia de 12.1 (4): o Membro configurado na Automação ou na Ferramenta, senão o Proprietário do Agente ou da Automação. Uma Execução que falhe no meio não deixa Contatos parciais sem Identificador e sem Nome (cada criação é atômica individualmente; o lote não é).

### 20.12 Contato arquivado recebendo Mensagem

O Identificador continua reservado (INV-CON-02) e resolve ao Contato `arquivado`; o Sistema o devolve a `ativo` no mesmo ato, cria (ou reabre) a Conversa e registra "restaurado por Mensagem recebida" (RN-CON-13), com evento próprio para que uma Automação notifique o Proprietário. O mesmo vale para `na lixeira`. A alternativa — persistir a Mensagem em uma Conversa de Contato `arquivado` sem reativá-lo — deixaria uma Conversa `aberta` com Contato oculto, invisível nas listagens padrão; a outra alternativa — criar outro Contato — violaria a unicidade.

### 20.13 Proprietário do Contato removido do Espaço de Trabalho

Sucessão (B28; RN-ET-09a): todos os Contatos do removido passam ao Sucessor no mesmo ato, cada um com Registro de Atividade. Vínculos, Conversas e Negócios não mudam. Se o Sucessor tiver Papel com escopo `próprios`, passa a ver esses Contatos porque agora é Proprietário deles. O Membro `removido` continua a aparecer como Criador e como autor de Comentários históricos (A6.4).

### 20.14 Identificador transferido de um Contato para outro

Permitido a quem tem `editar` nos dois (RN-CON-09), com Registro de Atividade em ambos. Move apenas o Identificador e a resolução futura de Mensagens; a Conversa `aberta` daquele Canal, se houver, continua com o Contato de origem até ser resolvida, e novas Mensagens do Identificador criam Conversa no destino — a Caixa de Entrada pode oferecer "mover a Conversa junto" como ato separado (DO-CON-12). Se o Contato de origem ficar sem Nome e sem Identificador, a transferência é rejeitada até que se dê um Nome a ele ou se opte por mesclar (INV-CON-01). Transferir o único Identificador verificado de um Contato não altera os Consentimentos, que são da pessoa, não do meio — cabe ao ator avaliar se a transferência implica pessoa diferente (caso em que os Consentimentos não se aplicam ao destino) ou correção de cadastro da mesma pessoa (caso em que o certo é mesclar).

### 20.15 Contato sem nenhum Identificador que precisa ser contatado

Válido (INV-CON-01 exige só o Nome). Não pode receber Mensagens iniciadas pela organização (não há para onde enviar); Automações de envio falham com Registro de Atividade. Painéis o listam como "Sem Identificador". É o caso da pessoa indicada por terceiro ("o cunhado do João, chamado Pedro") até que se obtenha um telefone.

### 20.16 Mesma pessoa em dois Canais Instagram conectados

Cada Canal Instagram fornece uma identidade própria da pessoa; resultam dois Identificadores de Tipo `usuário de Instagram` com valores distintos no mesmo Contato (7.1). Conversas são por (Contato, Canal): pode haver uma `aberta` em cada Canal (B12). Não é duplicidade nem inconsistência.

## 21. O que explicitamente NÃO pertence a esta entidade

Resultado do teste de exclusão: o que parece do Contato, mas pertence a outra entidade.

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Conversas e Mensagens | Caixa de Entrada | A2.5, B11. A Conversa referencia o Contato principal; excluir o Contato não exclui Conversas (12.5; DO-CON-09). |
| Participante | Conversa | Entidade interna da Conversa que referencia o Contato. |
| Cargo | Vínculo Contato-Empresa | Propriedade da relação pessoa–organização (DO-CON-04). |
| Papel no Negócio (decisor, influenciador...) | Vínculo Contato-Negócio | B9. Varia por Negócio. |
| Negócios, valor total comprado, "cliente desde" | Negócio (e derivados de Painel) | O Contato não tem valor econômico; "cliente desde" é derivado do primeiro Negócio `ganho` ou da Qualificação, conforme o Painel. |
| Empresa do Negócio | Negócio | Não é derivada da Empresa principal do Contato. |
| Definições de Campo, Origens, Definições de Qualificação, Finalidades, Tags | Espaço de Trabalho | Catálogos (B34, RN-ET-13). O Contato só referencia. |
| Tipos de Identificador, Tipos de Canal | Plataforma | A1.3. |
| Canal de origem | Caixa de Entrada | O Identificador o referencia; não o contém. |
| Proprietário padrão de Contatos criados automaticamente | Fila / Canal / Caixa de Entrada | Configuração operacional da Caixa de Entrada (DO-CON-08; DO-CXE-05). |
| Foto (o binário) | Arquivo (Espaço de Trabalho) | A8. O Contato referencia. |
| Tarefas "do Contato" (reunião, ligação) | Lista (Tarefa) | Vínculo, nunca contenção (A2.2; documento 06, 20.16). |
| Sessão de Chat ancorada no Contato | Membro | B21. |
| Memória do Agente sobre o Contato | Agente | B78: pode reter fatos sobre o Contato, com elegibilidade por delegante; Itens eliminados com a eliminação permanente do Contato (RN-AGE-23); política em C7. |
| Suspeita de Duplicidade | Ninguém (derivado) | Objeto de valor calculado (7.5); a única persistência é o Vínculo `distinto de`. |
| Linha do tempo | Ninguém (derivado) | Visão dos Registros de Atividade e dos registros que o referenciam (8.1). |
| Usuário, Membro "correspondente" | Plataforma / Espaço de Trabalho | A1.4. Não há ligação (RN-CON-23). |
| Status, situação, Etapa | Tarefa / Negócio | A4.2, A4.4. Contato tem Qualificação, que é atributo. |
| Regras de distribuição, Fila do Contato | Fila | O Contato não "está em uma Fila"; as suas Conversas estão. |

## 22. Exemplos conceituais

**Exemplo 1 — Paciente que chega pelo WhatsApp.** Uma Mensagem chega ao Canal WhatsApp "Recepção" de um número desconhecido. O Sistema cria o Contato (Nome vazio; Nome de exibição "Camila S." pelo rótulo do WhatsApp), o Identificador (`identidade de WhatsApp`, verificado, principal, Canal de origem "Recepção"), a Conversa na Fila "Recepção Centro" e a Mensagem; Proprietário = Ana, configurada na Fila; Origem = "WhatsApp orgânico", configurada no Canal. A atendente preenche Nome "Camila", Sobrenome "Souza", Data de nascimento, aplica a Tag "Convênio" e registra Consentimento (`atendimento`, WhatsApp, `concedido`, origem: Mensagem recebida). Uma Automação muda a Qualificação para "lead". Duas semanas depois, o Negócio "Pacote 10 sessões" é `ganho`; outra Automação muda a Qualificação para "cliente". A pessoa nunca deixou de ser o mesmo Contato.

**Exemplo 2 — Consultor em duas Empresas.** Pedro é Contato com Vínculos vigentes à "Alfa" (papel "Consultor de TI", principal) e à "Beta" (papel "Sócio"). O Negócio "Migração de sistema — Beta" vincula Pedro com papel no Negócio "decisor". Quando Pedro deixa a Alfa, o Vínculo recebe fim = 2026-08-31 e deixa de ser principal; o Vínculo com a Beta passa a principal; Cargo de exibição passa a "Sócio". O Painel "Contatos por Empresa em 2025" ainda o mostra na Alfa.

**Exemplo 3 — Duplicidade e mesclagem.** A importação de uma planilha cria "Maria Oliveira" com e-mail maria@alfa.com. Meses depois, uma Mensagem de um número desconhecido cria o Contato "Maria O." (rótulo do WhatsApp). O Sistema detecta Suspeita de Duplicidade por nome semelhante e notifica a Proprietária. Ela confirma que é a mesma pessoa e mescla: sobrevivente "Maria Oliveira" (tem mais dados); o Identificador de WhatsApp migra e passa a principal do seu Tipo; a Conversa aberta passa a referenciar a sobrevivente; o Contato "Maria O." fica `mesclado`, com Estado pré-mesclagem gravado. Um relatório antigo que citava "Maria O." resolve à sobrevivente. Se a Proprietária tivesse concluído que são pessoas distintas, criaria o Vínculo `distinto de` e a suspeita não voltaria.

**Exemplo 4 — Pedido de eliminação.** João, cliente com 3 Negócios (2 `ganho`) e 40 Conversas, pede a eliminação dos seus dados. A Administradora anexa o e-mail do pedido como Arquivo e executa "eliminar por solicitação do titular". O Contato, os Identificadores, os Consentimentos, os Comentários e os Valores de Campo são eliminados; as 40 Conversas permanecem, com Contato principal = Marcador de Contato eliminado e Mensagens anonimizadas; os 3 Negócios permanecem, sem Vínculo a Contato, e o Painel de faturamento não muda. Registros de Atividade citam apenas o identificador opaco. O que fazer com a nota fiscal do Negócio é obrigação legal fora da ontologia (C9).

**Exemplo 5 — Vendedor removido.** Carlos, Proprietário de 300 Contatos, é removido; Maria, que o remove, indica Beatriz como Sucessora. No mesmo ato, 300 Registros de Atividade "Proprietário transferido" e os Contatos passam a Beatriz. Uma Mensagem que chega no dia seguinte de um Contato `arquivado` de Carlos reativa o Contato (RN-CON-13); o Proprietário já é Beatriz, que é notificada pela Automação "cliente antigo voltou".

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Catálogos usados pelo Contato (contenção no ET; referência no Contato)
│   ├── Origem (0..N) ──────────────────────────────┐
│   ├── Definição de Qualificação (0..N) ───────────┤
│   ├── Finalidade de Consentimento (0..N) ─────────┤
│   ├── Tag (0..N, aplicável a Contato) ────────────┤
│   └── Definição de Campo (entidade-alvo Contato) ─┤
│                                                   │
├── Membro (1..N) ◄── Proprietário (1) ── Criador (Ator, 1)
│                                                   │
└── CONTATO (0..N)  [estado: ativo | arquivado | na lixeira | mesclado; Modo de criação]
    │  ├── Nome, Sobrenome, Data de nascimento, Idioma, Fuso, Descrição
    │  ├── Nome de exibição, Não identificado, Cargo de exibição, Empresa principal, Última interação  (derivados)
    │  ├── Origem (0..1) ◄──────────────────────────┘
    │  ├── Qualificação (0..1)
    │  ├── Foto → Arquivo (0..1)
    │  └── Mesclado em → Contato (0..1; obrigatório em `mesclado`) + Estado pré-mesclagem
    │
    ├── Agregado (contenção; não existe fora do Contato)
    │   ├── Identificador de Contato (0..N)  [Tipo, Valor canônico, Canal de origem 0..1, verificado, principal ≤1 por Tipo]
    │   │       └── único no ET por (Tipo, Valor) entre Contatos não `mesclado`
    │   ├── Consentimento (0..N registros, só acréscimo)  [Finalidade, Tipo de Canal, decisão, momento, origem, evidência]
    │   ├── Endereço (0..N, principal ≤1)
    │   ├── Comentário (0..N; respostas em um nível)
    │   └── Valor de Campo (0..N; um por Definição aplicável)
    │
    ├── Associações (Vínculo; cada lado existe sem o outro)
    │   ├── Vínculo Contato-Empresa (0..N)  [papel/cargo; Empresa principal do Contato ≤1 por Contato; Contato principal da Empresa ≤1 por Empresa; início, fim] ──► Empresa
    │   ├── Vínculo Contato-Negócio (0..N)  [papel no Negócio] ──────────────────────► Negócio
    │   ├── Vínculo Contato-Tarefa (0..N)  [papel textual] ──────────────────────────► Tarefa
    │   ├── Vínculo `distinto de` (0..N, simétrico) ────────────────────────────────► Contato
    │   └── Tag (N:N)
    │
    └── Referenciado por (o Contato não os contém)
        ├── Conversa (0..N; Contato principal — Caixa de Entrada)
        │     ├── Participante → Contato
        │     └── Mensagem `recebida` → Identificador de Contato
        ├── Sessão de Chat (âncora, Membro)
        ├── Execução de Agente / Automação (objeto)
        └── Registro de Atividade (objeto) ─── Linha do tempo (visão derivada, filtrada por permissão)

Contato nunca referencia Usuário nem Membro além de Proprietário, Criador e Valor de Campo tipo pessoa.
Nenhuma aresta atravessa a fronteira do Espaço de Trabalho.
```

## 24. Decisões ontológicas

- **DO-CON-01.** Contato é pessoa física identificável, externa, pertencente diretamente ao Espaço de Trabalho, sem contêiner intermediário e sem qualquer ligação com Usuário ou Membro. Aplica A1.4, A2.2, A5.2. CONSOLIDADA.
- **DO-CON-02.** Contato existe sem Empresa; a relação é N:N por Vínculo Contato-Empresa com papel (cargo), dois indicadores independentes de principal — Empresa principal do Contato (no máximo um por Contato, sempre vigente) e Contato principal da Empresa (no máximo um por Empresa; DO-EMP-05) —, início e fim; mudança de Empresa encerra o Vínculo, não o apaga; no máximo um Vínculo vigente por par. Aplica B8; acrescenta início/fim e a regra de encerramento; adota o lado da Empresa de DO-EMP-05. RECOMENDADA.
- **DO-CON-03.** Identificador de Contato é entidade interna com Tipo (catálogo da plataforma alinhado aos Tipos de Canal), Valor canônico, Valor exibido, Canal de origem, Rótulo informado pelo Canal, verificado e principal (no máximo um por Tipo); único no Espaço de Trabalho por (Tipo, Valor) entre Contatos não `mesclado`, inclusive `arquivado` e `na lixeira`; a criação colidente é rejeitada com indicação do existente. `telefone` e `identidade de WhatsApp` são Tipos distintos. Aplica B13. RECOMENDADA.
- **DO-CON-04.** Cargo pertence ao Vínculo Contato-Empresa, não ao Contato; o Contato expõe apenas "Cargo de exibição" e "Empresa principal" como derivados do Vínculo principal. Justificativa: cargo é propriedade da relação pessoa–organização; gravá-lo no Contato obriga a perder o segundo cargo ou duplicar a pessoa. RECOMENDADA.
- **DO-CON-05.** "Lead", "prospecto", "cliente" são valores de **Qualificação**: atributo 0..1 do Contato que referencia uma **Definição de Qualificação**, catálogo do Espaço de Trabalho no padrão de Origem e Motivo de Perda (B34), com padrões iniciais da plataforma. Rejeitadas as alternativas Tag (não exclusiva, sem ordem) e estado de sistema (não personalizável, colide com A4.1) e derivação de situação de Negócio (cliente sem Negócio na plataforma é comum). Sem categoria fixa nesta versão (questão 2 da seção 25). **Amplia a lista de catálogos de B34 / documento 01, 7.6.** RECOMENDADA.
- **DO-CON-06.** Consentimento é objeto de valor com histórico monotônico (Finalidade, Tipo de Canal, decisão, momento, origem, evidência, registrado por); o vigente é derivado por (Finalidade, Tipo de Canal); Finalidades de Consentimento são catálogo do Espaço de Trabalho com padrões da plataforma (`atendimento`, `transacional`, `marketing`) e indicação de quais exigem consentimento para envio. **Amplia B34 / documento 01, 7.6.** RECOMENDADA.
- **DO-CON-07.** Proprietário do Contato é exatamente um Membro `ativo` ou `suspenso` (A7); transferência sempre explícita e registrada; atender Conversa ou ser Responsável por Tarefa vinculada não transfere propriedade; sucessão por B28. RECOMENDADA.
- **DO-CON-08.** Mensagem recebida de Identificador desconhecido cria atomicamente Contato (Nome vazio, "Não identificado" como condição derivada), Identificador, Conversa e Mensagem; Proprietário resolvido na ordem Fila → Canal → Caixa de Entrada → Proprietário do Espaço de Trabalho, cada nível uma referência 0..1 a Membro `ativo` configurada no documento 14 (DO-CXE-05; RN-CXE-29); Origem = a configurada no Canal. Não existe "Contato provisório" nem estado de identificação. RECOMENDADA.
- **DO-CON-09.** Conversas e Mensagens pertencem à Caixa de Entrada e apenas referenciam o Contato (Contato principal, Participante, Identificador remetente); não há Vínculo Contato-Conversa. Arquivar, enviar à lixeira ou eliminar o Contato nunca elimina Conversas; a mesclagem reaponta as referências; a eliminação substitui a referência por Marcador de Contato eliminado. Aplica A2.5, B11, B12. RECOMENDADA.
- **DO-CON-10.** Eliminação permanente do Contato (por prazo de lixeira ou por solicitação do titular) elimina o agregado, remove Vínculos, elimina os `mesclado` que o apontam, preserva Conversas, Negócios e Registros de Atividade com identificador opaco; a eliminação por solicitação do titular anonimiza adicionalmente o conteúdo das Mensagens e elimina Rótulos e Valores sem retenção. RECOMENDADA, subordinada a C9 (retenção legal, prazo de atendimento, prova de consentimento revogado).
- **DO-CON-11.** Mesclagem: atômica, entre dois Contatos `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), por Ator com `administrar` em ambos; o sobrevivente resulta `ativo` se ao menos um era `ativo`; o absorvido passa a `mesclado` (terminal) com Estado pré-mesclagem e Mesclado em; união de Identificadores, Vínculos (fundidos por destino e papel; indicadores de principal conforme 12.4), Tags, Consentimentos, Endereços e Comentários; precedência do sobrevivente em atributos e Valores de Campo (vazio recebe do absorvido; Descrição concatenada; seleção múltipla unida; escolha campo a campo permitida e registrada); Conversas, Negócios, Tarefas, âncoras e Valores de tipo relação reapontados; sem cadeia de `mesclado`. **Irreversível**; a única saída é a restauração de cópia (Contato novo, com Proveniência, a partir do Estado pré-mesclagem). Aplica B14. RECOMENDADA.
- **DO-CON-12.** Identificador é transferível entre Contatos por Ator com `editar` em ambos, movendo só o Identificador e a resolução futura; Conversas passadas ficam com a origem, movíveis por ato separado; rejeitada se deixar a origem sem Nome e sem Identificador. RECOMENDADA.
- **DO-CON-13.** Criação de Contatos por Automação ou Agente conta para os Limites impostos e para o Limite de operações por Execução (Limite imposto — DO-AUT-18); acima dele exige aprovação em qualquer nível de autonomia (motivo `limite` — B80); mesclagem por Agente exige aprovação em `supervisionado` (`escrita irreversível` — B64; B77) e, por recomendação de produto, também em `autônomo`. Aplica A6.3, B22, B34. RECOMENDADA.
- **DO-CON-14.** Suspeita de Duplicidade é objeto de valor derivado (par, motivo, momento), nunca entidade; a decisão "não são a mesma pessoa" é Vínculo Contato-Contato `distinto de`, simétrico e removível, que suprime a suspeita. Identificador igual não é suspeita: é colisão rejeitada na criação (DO-CON-03). Aplica A8 (reuso de Vínculo). RECOMENDADA.
- **DO-CON-15.** Mensagem recebida por Identificador de Contato `arquivado` ou `na lixeira` devolve o Contato a `ativo` no mesmo ato, com Registro de Atividade de causa e evento próprio. Justificativa: a pessoa falou; o registro deve refletir a realidade, e criar outro Contato violaria a unicidade. RECOMENDADA.
- **DO-CON-16.** Visibilidade padrão de Contatos: todos os Membros com acesso ao CRM veem todos os Contatos (escopo `registro` no Papel de sistema Membro); restrição por Papel personalizado com escopo `próprios` (Proprietário ou Criador); ampliação por concessão direta ou compartilhamento; Convidado nada vê por Papel; o Contato não é privatizável. Ver o Contato não dá acesso a Conversas, Negócios ou Tarefas vinculados: a linha do tempo é filtrada item a item. Aplica A9, B29, B20 e o padrão do documento 01, 17.2. RECOMENDADA.
- **DO-CON-17.** Estados do Contato: `ativo`, `arquivado`, `na lixeira` (A4.1) e `mesclado` (B14), este terminal e exclusivo de Contato e Empresa. Não há Status nem situação. "Não identificado", "Sem Identificador" e "Com suspeita de duplicidade" são condições derivadas. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-CON-05 e DO-CON-06 **ampliam** B34 (dois catálogos novos: Definições de Qualificação e Finalidades de Consentimento) e a tabela 7.6 do documento 01, sem contradizê-los; registradas como ampliação, não como divergência.

## 25. Questões em aberto

1. **Escopo de permissão "da minha Equipe" no CRM.** B29 define `registro`, `subárvore` e `próprios`; "vendedor vê os Contatos da sua Equipe" (Proprietário pertence a uma Equipe do Sujeito) não é expressável. Alternativas: (a) manter — a organização usa concessão direta à Equipe sobre cada Contato (inviável em escala); (b) acrescentar escopo `equipe` a B29; (c) tratar por Automação que concede à Equipe ao transferir Proprietário. Consequência relevante para organizações com times comerciais regionais. Candidata a C-nova.
2. **Categoria fixa de Qualificação** (C23). DO-CON-05 não impõe categoria (como A4.3 faz para Status). **Resolvida para Painéis** pelo documento 21 (20.17): a Dimensão "Qualificação" segmenta por Definição, e "converteu" é Filtro escolhido pelo editor do Widget. **Permanece aberta para Automações e Agentes**, que sem categoria leem nomes ("cliente") para saber se um Contato converteu; com ela (`potencial`, `cliente`, `inativo`, `descartado`), a plataforma interpretaria Qualificações personalizadas.
3. **Retenção e anonimização** (C9). O que os Registros de Atividade podem reter após a eliminação por solicitação do titular; prazo para atender; conservação de prova de consentimento revogado; anonimização de Mensagens `enviada` (contêm o nome da pessoa no texto). DO-CON-10 é recomendação até C9 ser decidida.
4. **Campos Personalizados em Vínculo Contato-Empresa e em Identificador de Contato.** A5.2 não os prevê. Organizações pedirão "departamento" e "ramal" no Vínculo, "horário preferido" no Identificador. Amplia C13.
5. **Conversa aberta duplicada após mesclagem** (12.4, item 7). **Resolvida** pelo documento 14 (DO-CXE-21; RN-CXE-10): a de Mensagem mais recente permanece; a outra passa a `resolvida` com causa "mesclagem", sem mover Mensagens.
6. **Contato que vira Convidado / portal do cliente** (C2, D9). Exigiria ligação Usuário ↔ Contato, hoje proibida por A1.4 e RN-CON-23.
7. **Atividade de CRM** (D4). Reunião e ligação com Contato são Tarefas vinculadas (documento 06, 20.16); se D4 for adotada, a linha do tempo (8.1) passa a incluí-la e a migração é por Vínculo.
8. **Limite por Execução para criação em lote** (RN-CON-20, DO-CON-13). **Resolvida** pelo documento 19 (DO-AUT-18): é **Limite imposto** da plataforma, não configuração do Espaço de Trabalho; ao atingi-lo, a Execução passa a `aguardando aprovação` com Solicitação de motivo `limite` (B80), em qualquer autonomia. O valor numérico permanece em C8.

Resolvidas neste documento com recomendação, sem pendência aberta: cargo no Vínculo (DO-CON-04); Qualificação como catálogo e não Tag (DO-CON-05); Suspeita de Duplicidade como derivado (DO-CON-14); irreversibilidade da mesclagem com restauração de cópia (DO-CON-11); restauração por Mensagem recebida (DO-CON-15); Proprietário de Contato criado automaticamente (DO-CON-08); Conversas pertencem à Caixa de Entrada (DO-CON-09).
