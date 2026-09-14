# CRM — VISÃO GERAL

> Domínio: CRM | Documento 09 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **CRM** é o **domínio do Espaço de Trabalho que representa o relacionamento da organização com pessoas e organizações externas e o processo comercial que decorre dele**. Não é uma entidade: é o agrupamento conceitual, par da Estrutura de Trabalho, da IA e dos Painéis (A2.2), das entidades que respondem a quatro perguntas — **com quem** a organização se relaciona (Contato, Empresa), **o que** está sendo negociado (Negócio), **por qual processo** a negociação progride (Funil) e **o que foi dito** (Caixa de Entrada, com Canais, Filas, Conversas e Mensagens).

Cinco propriedades distinguem o domínio de tudo o mais no Espaço de Trabalho:

1. **Tudo nele é externo ou trata do externo.** Contato e Empresa representam quem está fora; Mensagens `recebida` são fatos vindos de fora; Negócio é o que se negocia com quem está fora. Nada no CRM é Ator: Contato nunca age (RN-CON-04), Empresa nunca age (INV-EMP-10), e o que o Contato "faz" chega como fato registrado por um Canal (documento 10, 1).
2. **Não tem hierarquia de contêineres.** Contato, Empresa, Negócio e Funil pertencem diretamente ao Espaço de Trabalho; a Caixa de Entrada é composição 1:1 com ele (A5.2; B11). Não há Espaço, Pasta ou Lista no CRM; por isso não há herança de configuração (B25), estado efetivo (B36) nem Valores de Campo órfãos por movimentação (B37). Os catálogos que o CRM consome são definidos uma única vez, no Espaço de Trabalho (B34).
3. **As entidades relacionam-se por associação, nunca por contenção entre si.** Empresa não contém Contatos (B8), Funil não contém Negócios (DO-FUN-01), Fila não contém Conversas (DO-CXE-01), Contato não contém Conversas (DO-CON-09). As únicas contenções são internas aos agregados de cada entidade (seção 10).
4. **Tem um único ponto de entrada de fatos externos.** Toda Mensagem `recebida` entra por um Canal da Caixa de Entrada e é resolvida a exatamente um Contato pelo par (Tipo, Valor) de um Identificador de Contato (B13; RN-CON-12; RN-CXE-06). Empresa e Negócio não recebem comunicação (RN-EMP-06).
5. **Separa "quem responde" de "quem conduz".** Contato, Empresa e Negócio têm Proprietário (A7); Conversa tem Atribuído (0..1, Membro ou Agente — B7); Caixa de Entrada, Canal, Fila e Funil não têm Proprietário (DO-CXE-02; DO-FUN-02). Ninguém no CRM tem Responsável: o trabalho é Tarefa vinculada (A2.2; DO-TAR-08).

O CRM não é uma "tela de clientes", não é uma lista de leads, não é um "quadro de vendas" e não é uma caixa de mensagens. É o subconjunto do Espaço de Trabalho em que o mundo externo à organização é representado com identidade, história e responsabilidade.

## 2. Propósito

1. **Dar identidade estável ao mundo externo.** Pessoas mudam de telefone e de emprego; organizações mudam de nome e de CNPJ; oportunidades mudam de Funil. Contato, Empresa e Negócio existem para que a história do relacionamento sobreviva a essas mudanças (documento 10, 5; 11, 5; 12, 5).
2. **Converter comunicação em operação.** A Caixa de Entrada transforma uma mensagem que chegou a um número em uma Conversa com Contato, estado, Fila e Atribuído — gerenciável, distribuível e mensurável (documento 14, 2).
3. **Tornar a venda mensurável e governável.** Negócio e Funil dão à receita futura valor, posição, probabilidade e resultado comparáveis entre oportunidades, com histórico de transição por identidade de Etapa (DO-FUN-13; DO-NEG-18).
4. **Ancorar o trabalho, a IA e os Painéis no relacionamento.** Tarefas vinculam-se a Contatos, Empresas, Negócios e Conversas (DO-TAR-08); Agentes atendem Conversas e alteram Negócios por Ferramentas (B7, B19); Painéis leem Contatos, Negócios por Funil e Conversas por Fila (Glossário, Fonte de Dados).
5. **Sustentar a conformidade.** Consentimentos por Finalidade e Tipo de Canal, eliminação por solicitação do titular e anonimização de Mensagens só são possíveis porque os dados pessoais convergem no Contato (DO-CON-06; DO-CON-10; C9).

## 3. Natureza da entidade

O CRM **não é entidade**: não tem identidade, atributos nem estado próprios (documento 01, 7.7). "Administrar o CRM" não é um Recurso de permissão; o que existe são Recursos por entidade e ações de configuração de catálogo por Papel (RN-ET-24). Este documento descreve, portanto, a natureza das entidades que compõem o domínio e das relações entre elas.

| Entidade | Natureza | Raiz de agregado? | Proprietário? | Documento |
| --- | --- | --- | --- | --- |
| Contato | Entidade com identidade; pessoa física externa; pertence ao ET | Sim (Identificadores, Consentimentos, Endereços, Comentários, Valores de Campo) | Sim, 1 | 10 |
| Empresa | Entidade com identidade; organização externa; pertence ao ET | Sim (Identificadores de Empresa, Endereços, Comentários, Valores, Anexos) | Sim, 1 | 11 |
| Negócio | Entidade com identidade; oportunidade comercial; registro operacional; pertence ao ET | Sim (Valor, Valores de Campo, Comentários, Anexos, face do Vínculo Contato-Negócio) | Sim, 1 | 12 |
| Funil | Entidade com identidade; **configuração** de processo; catálogo do ET | Sim (Etapas, Requisitos, Transições, Regras de encerramento) | Não (Criador) | 13 |
| Caixa de Entrada | Entidade única, composição 1:1 com o ET; infraestrutura conversacional | Sim (Canais, Filas, Conversas) | Não | 14 |
| Canal | Entidade contida pela Caixa; especialização de Integração; Ator | Não | Não (Membro configurador) | 14 |
| Fila | Entidade contida pela Caixa; configuração operacional com identidade | Não | Não (Criador) | 14 |
| Conversa | Entidade contida pela Caixa; raiz do subagregado Mensagens + Participantes | Sim | Não (Atribuído 0..1) | 14 |
| Mensagem, Participante, Anexo | Entidades internas da Conversa (Anexo: componente da Mensagem) | Não | Não | 14 |

## 4. Fronteira conceitual

### O que é

- O conjunto {Contato, Empresa, Negócio, Funil, Caixa de Entrada} e as entidades internas destes (Identificadores, Vínculos, Etapa, Canal, Fila, Conversa, Mensagem, Participante, Anexo, Consentimento).
- O lugar do Espaço de Trabalho em que fatos externos são resolvidos a registros (Mensagem → Contato) e em que a oportunidade comercial é acompanhada até um resultado (`ganho`/`perdido`).

### O que não é

- **Não é a Estrutura de Trabalho.** Nenhuma entidade do CRM é filha de Espaço, Pasta, Lista ou Tarefa (A2.2). Tarefas "do Contato" ou "do Negócio" são Tarefas em uma Lista, vinculadas (DO-TAR-08).
- **Não é a IA.** Agentes agem sobre o CRM como Atores sujeitos às mesmas permissões (A6.3); Sessões de Chat podem ancorar-se a registros do CRM, mas pertencem ao Membro (B21). Conversa não é Sessão de Chat; Mensagem não é Mensagem de Chat (Glossário).
- **Não é Conhecimento.** Contatos, Negócios e Conversas não são Documentos de Conhecimento: Agentes os acessam por Ferramentas, sujeitos a permissão (B19; INV-NEG-12).
- **Não é Painel.** Painéis leem o CRM como Fonte de Dados e derivam Métricas; nada é gravado no CRM por Painéis (B20; DO-FUN-12; RN-NEG-23).
- **Não contém o Membro nem o Usuário.** Contato ≠ Membro ≠ Usuário (A1.4); nenhuma inferência os liga (RN-CON-23).

### 4.1 Fronteira com os outros domínios

| Fronteira | O que atravessa | Como | Onde está decidido |
| --- | --- | --- | --- |
| **CRM × Estrutura de Trabalho** | Tarefa ↔ Contato, Empresa, Negócio, Conversa | Vínculo (associação bidirecional, sem propriedade). "Criar Tarefa a partir de Conversa/Negócio" cria a Tarefa na Lista escolhida com Vínculo automático e Proveniência; concluir Tarefas não altera Negócio nem Conversa (só Automação). "Próxima atividade" do Negócio é derivada das Tarefas vinculadas. | DO-TAR-08; documento 14, 8.5; documento 12, 6.1, 12.1; RN-NEG-24 |
| **CRM × IA (Agentes)** | Agente como Atribuído de Conversa; Agente lendo e alterando Contato, Empresa, Negócio, Conversa por Ferramentas | Agente é Ator com as próprias permissões (ou interseção, em nome de Membro — A9.3), avaliadas a cada Ferramenta (B23). O Agente Atribuído é invocado pela Caixa de Entrada a cada Mensagem `recebida` (Origem `Caixa de Entrada`, sem delegante — RN-AGE-14); invocado por Ação de Automação, tem a Automação como delegante (DO-AUT-15). Nunca cria Funil, nunca recebe `administrar` sobre Funil, Fila, Canal ou Caixa; nunca reabre Negócio `ganho`. As ações que exigem aprovação em `supervisionado` são a lista consolidada de **B64** (enviar Mensagem a Contato; mesclar; marcar `ganho`/`perdido`; enviar Contato, Empresa ou Negócio à lixeira; trocar Empresa de Negócio encerrado; marcar exclusão de Mensagem; mover Conversa entre Contatos), decididas por Ferramenta e classe de efeito (B77), com Tempo limite padrão de 72 horas (B80). | B7; RN-CXE-12; DO-CXE-17; RN-FUN-17; DO-CON-13; DO-NEG-11; RN-EMP-16; B64 |
| **CRM × IA (Automações)** | Automação com escopo Funil, Caixa de Entrada ou Fila | O escopo delimita o Gatilho (eventos da seção 18); a Ação pode alcançar outros registros dentro das permissões. Inoperante com escopo `arquivado`; eliminada com o escopo. | B41; DO-CXE-16 (Fila amplia B41) |
| **CRM × IA (Chat)** | Sessão de Chat ancorada a Contato, Empresa, Negócio ou Conversa | A Sessão lê o registro com as permissões do Membro e pode produzir Rascunho para a Conversa; nunca envia Mensagem por si. | B21; DO-EMP-14 (Empresa como âncora); DO-CXE-15 |
| **CRM × IA (Conhecimento)** | Nada é contido | Registros do CRM **não** são Conhecimento; Negócio pode vincular-se a Documento de Conhecimento sem tornar-se um. | B19; documento 12, 8.1 |
| **CRM × Painéis** | Fontes de Dados: Contatos, Empresas (e grupo econômico por hierarquia), Negócios de um Funil, Conversas de uma Fila/Canal/Caixa | Referência, nunca cópia; filtrada pelas permissões do visualizador; derivados (valor ponderado, conversão por Etapa, tempo de primeira resposta, Última interação) nunca gravados no CRM; conversão de moeda fora da ontologia. | B20; DO-FUN-12; DO-FUN-13; RN-NEG-23; documento 11, 20.14; documento 14, 18 |

### 4.2 Comparações

| X × Y | Critério de distinção |
| --- | --- |
| **Contato × Empresa** | Pessoa física × organização externa. Só o Contato tem Identificadores que resolvem Mensagens e é Contato principal de Conversa; a Empresa tem documento fiscal, domínio e hierarquia matriz/filial. Ligam-se por Vínculo Contato-Empresa N:N com papel (cargo), dois indicadores de principal, início e fim; cada um existe sem o outro (B8; DO-CON-02; DO-EMP-05; RN-EMP-06). |
| **Empresa × Negócio** | Quem × o quê. A Empresa permanece; o Negócio termina (`ganho`/`perdido`). Negócio referencia 0..1 Empresa (atributo unilateral, não Vínculo); a Empresa não contém Negócios, mas a sua lixeira é bloqueada por Negócio `aberto` e a sua eliminação é adiada por qualquer Negócio (B9; DO-NEG-07; DO-EMP-11). |
| **Negócio × Funil** | O que percorre × o caminho. Negócio é registro operacional com Proprietário e valor; Funil é configuração com identidade, sem Proprietário. Negócio referencia exatamente um Funil, substituível por mudança explícita; o Funil nunca contém Negócios e nunca é origem de permissão sobre eles (DO-FUN-01; DO-FUN-10). |
| **Funil × Etapa** | Sequência × posição. Etapa é entidade interna do Funil, com identidade estável dentro dele, sem estado; Negócios referenciam a Etapa por identidade, nunca por nome ou posição. Permissões e Automações referenciam o Funil, nunca a Etapa isolada (RN-FUN-05; DO-FUN-15). Toda Etapa é de progressão: não existe Etapa de ganho ou perda (DO-FUN-03). |
| **Conversa × Mensagem** | Episódio × unidade de comunicação. A Conversa tem estado, Contato principal, Canal, Fila, Atribuído; a Mensagem tem direção, Ator, conteúdo, Anexos e status de entrega, e é imutável. Composição: sem Conversa não há Mensagem; sem Mensagem não há Conversa (INV-CXE-05; DO-CXE-23). |
| **Conversa × Sessão de Chat** | Organização ↔ Contato por um Canal × Membro ↔ IA. A Conversa pertence à Caixa de Entrada, é visível a quem tem `ver`, não tem Proprietário; a Sessão pertence ao Membro, é pessoal, pode ancorar-se à Conversa para ler e produzir Rascunho, nunca envia (B21; documento 14, 4; DO-CXE-15). |
| **Caixa de Entrada × Fila** | Contêiner único × agrupamento operacional. A Caixa contém Canais, Filas e todas as Conversas; a Fila responde "quem atende" (elegíveis, regra de distribuição) e é **referenciada** pela Conversa (0..1, mutável por transferência), nunca a contém. Segmentação é por Fila, nunca por múltiplas Caixas (B11; DO-CXE-01). |
| **Canal × Tipo de Canal** | Conta conectada da organização × enumeração global da plataforma. O Canal tem credenciais, estado de conexão, Fila padrão, Membro configurador e pertence à Caixa; o Tipo de Canal (WhatsApp, Instagram, E-mail, Chat do site) declara capacidades fixas e é referenciado, nunca possuído. As quatro especializações são Canais por Tipo, não entidades (A1.3; A2.4; RN-CXE-05). |
| **Contato × Membro × Usuário** | Pessoa externa registrada no CRM × relação de um Usuário com o Espaço de Trabalho (Ator, Papel) × identidade global que se autentica. Contato nunca age, nunca é Proprietário, Responsável ou Atribuído; Membro nunca é Contato principal de Conversa; nenhuma referência liga Contato a Usuário ou Membro além de Proprietário, Criador e Valor de Campo tipo pessoa (A1.4; RN-CON-23; INV-CON-10; INV-CON-13). |

## 5. Identidade

O domínio não tem identidade própria. **A identidade do CRM é a do Espaço de Trabalho**: o CRM de um Espaço de Trabalho é o conjunto das suas entidades de CRM, e não existe "outro CRM" no mesmo Espaço de Trabalho nem um CRM que atravesse Espaços de Trabalho (A1.1, A1.2). A única entidade do domínio cuja identidade é coextensiva à do Espaço de Trabalho é a Caixa de Entrada (documento 14, 5).

**Teste de identidade (aplicado ao domínio).** Se todos os Contatos, Empresas, Negócios, Funis, Canais, Filas e Conversas forem criados, mesclados, arquivados ou eliminados, e todas as configurações (Funil padrão, Prazo de reabertura, catálogos) forem alteradas, o CRM continua sendo o do mesmo Espaço de Trabalho. As identidades relevantes são as de cada entidade, todas opacas, imutáveis e atribuídas pela plataforma; nenhum identificador do mundo real (telefone, CNPJ, número de WhatsApp, Título de Negócio, nome de Funil) é identidade (documentos 10–14, seção 5). A mesclagem preserva a identidade do absorvido em Contato e Empresa (B14); não há mesclagem de Negócios (DO-NEG-12) nem de Conversas (RN-CXE-15).

## 6. Atributos fundamentais

Como o domínio não é entidade, os seus "atributos" são as **configurações do Espaço de Trabalho que o CRM consome**. Nenhuma delas pertence a uma entidade do CRM; todas são definidas por Papel de nível Administrador ou Proprietário do Espaço de Trabalho (RN-ET-13; RN-ET-24), salvo indicação.

| Configuração | Natureza | Obrigatório | Onde vive | Descrição |
| --- | --- | --- | --- | --- |
| Funil padrão | referência (Funil `ativo`, não privado) | sim | Espaço de Trabalho | Destino de Negócios criados sem Funil explícito; criado com o ET; não arquivável, não excluível nem privatizável enquanto padrão (DO-FUN-09; RN-FUN-16). |
| Identificador legível de Negócios | objeto de valor (habilitado, prefixo) | não | Espaço de Trabalho | Número sequencial único no ET, imutável; distinto do de Tarefas (DO-NEG-02). |
| Localidade (moeda, fuso, idioma) | objeto de valor | sim | Espaço de Trabalho | Moeda padrão do Valor do Negócio; fuso do Horário de atendimento e das Datas; idioma padrão de exibição do Contato (RN-ET-15; DO-NEG-04). |
| Política de lixeira; Limites impostos | objetos de valor | sim | Espaço de Trabalho | Prazo de eliminação de Contato, Empresa, Negócio, Fila e Conversa `na lixeira`; tetos de Contatos, Canais, armazenamento (B34; RN-CON-20). |
| Prazo de reabertura | duração | sim | Caixa de Entrada | Define "um episódio": Mensagem dentro do prazo reabre a Conversa `resolvida`; fora, cria outra. Único por Caixa; não atravessa Canais (DO-CXE-04; DO-CXE-24). |
| Distribuição padrão | enumeração (`manual`, `rodízio`, `menor carga`) | sim | Caixa de Entrada | Regra usada por Filas com `herdar da Caixa` (documento 14, 6). |
| Proprietário padrão de Contatos criados automaticamente | referência (Membro `ativo`) 0..1 em cada nível | não | Fila → Canal → Caixa de Entrada → Proprietário do ET | Resolvido nessa ordem no ato de criação automática; nunca falha (DO-CON-08; DO-CXE-05; RN-CXE-29). |
| Origem padrão de Contatos | referência (Origem) 0..1 | não | Canal | Origem gravada em Contatos criados por Mensagem no Canal (DO-CON-08). |
| Horário de atendimento | objeto de valor | não | Caixa de Entrada (sobrescritível por Fila) | Única fonte de "horário útil" da mensageria até C12 (DO-CXE-06). |
| Finalidades que exigem consentimento | indicador por Finalidade | sim (padrão da plataforma) | Espaço de Trabalho | `marketing` exige; `atendimento` e `transacional` não, por padrão (RN-CON-16). |
| Critérios adicionais de Suspeita de Duplicidade | configuração | não | Espaço de Trabalho | Além dos mínimos de RN-CON-10 (documento 10, 15). |
| Visibilidade padrão do CRM por Papel personalizado | escopo `registro` ou `próprios` | não | Papel | "Vendedor vê só os seus" (B29; DO-CON-16; documento 12, 17.2). |
| Regras de encerramento | objeto de valor por Funil | sim (padrão: ambos falsos) | Funil | Exigir Motivo de Perda ao perder; exigir valor ao ganhar (DO-FUN-08). |

Os catálogos (Origens, Motivos, Qualificações, Finalidades, Definições de Campo, Tags, Funis) são entidades contidas com identidade, não atributos; estão na seção 15.

## 7. Entidades internas ou componentes

Os componentes do domínio são as suas entidades. A tabela distingue as que recebem documento próprio das que são descritas dentro de outro documento (A2.5).

| Entidade | Documento próprio? | Descrita em | Natureza | Contida por |
| --- | --- | --- | --- | --- |
| Contato | Sim (10) | — | Entidade, raiz de agregado | Espaço de Trabalho (pertencimento) |
| Empresa | Sim (11) | — | Entidade, raiz de agregado | Espaço de Trabalho (pertencimento) |
| Negócio | Sim (12) | — | Entidade, raiz de agregado | Espaço de Trabalho (pertencimento) |
| Funil | Sim (13) | — | Entidade de configuração, raiz de agregado | Espaço de Trabalho (catálogo) |
| Caixa de Entrada | Sim (14) | — | Entidade única, composição 1:1 | Espaço de Trabalho |
| Etapa | Não | 13, 6.2 e 7.1 | Entidade interna com identidade estável; sem estado | Funil (composição) |
| Canal (e as quatro especializações por Tipo de Canal) | Não (A2.4, A2.5) | 14, 7.1 e 7.2 | Entidade contida; especialização de Integração; Ator | Caixa de Entrada |
| Fila | Não (A2.5) | 14, 7.4 | Entidade contida; configuração operacional | Caixa de Entrada |
| Conversa | Não (A2.5) | 14, 7.5 | Entidade contida; raiz do subagregado | Caixa de Entrada |
| Mensagem | Não (A2.5) | 14, 7.6 | Entidade interna, imutável | Conversa (composição) |
| Participante | Não (A2.5) | 14, 7.7 | Entidade interna; identidade pelo par (Conversa, sujeito) | Conversa (composição) |
| Anexo | Não (A2.5) | 14, 7.11 (também 11, 7.5; 12, 7.5) | Componente: referência a Arquivo, sem identidade | Mensagem (ou Empresa, Negócio, Comentário) |
| Identificador de Contato | Não (B13) | 10, 7.1 | Entidade interna com identidade no agregado; único por (Tipo, Valor) no ET | Contato |
| Identificador de Empresa | Não | 11, 7.1 | Entidade interna análoga; tipos `domínio`, `documento fiscal`, `telefone`; nunca resolve Mensagens | Empresa |
| Vínculo Contato-Empresa | Não (A8) | 10, 7.6 (lado do Contato); 11, 8.2 (dois indicadores de principal) | Associação N:N com atributos: papel, principal (dois lados), início, fim | Nenhum (relação entre dois registros) |
| Vínculo Contato-Negócio | Não (A8) | 12, 7.1 (atributos); 10, 7.6 | Associação com papel de catálogo fixo e principal; consistência garantida pelo agregado do Negócio | Nenhum (face no Negócio) |
| Vínculo Conversa-Negócio | Não (A8) | 14, 7.12 e 8.4; 12, 8.1 (DO-NEG-13) | Associação 0..N em ambos os lados; sem propriedade | Nenhum |
| Consentimento | Não | 10, 7.2 | Objeto de valor com histórico monotônico; vigente derivado por (Finalidade, Tipo de Canal) | Contato |
| Registro de transição de Etapa | Não | 12, 7.6; 13, DO-FUN-13 | **Não é entidade interna**: é Registro de Atividade com dados estruturados (Etapa por identidade, nome e Ordem à época) | Espaço de Trabalho (Registro de Atividade) |
| Requisito de Etapa; Transições permitidas; Regras de encerramento | Não | 13, 7.2, 7.3, 6.1 | Objetos de valor de configuração | Etapa / Funil |
| Rascunho; Adiamento; Endereços adicionais; Leitura interna; Reação; Marcação de exclusão | Não | 14, 7 | Objetos de valor | Conversa / Mensagem |
| Suspeita de Duplicidade; Sugestão de Vínculo | Não | 10, 7.5; 11, 8.5 | Objetos de valor derivados e transitórios; nunca entidades | Ninguém |
| Disponibilidade de atendimento | Não | 14, 7.8 | Objeto de valor do **Membro** (não do CRM), consumido por Filas | Membro |

Entidades de fora do domínio que o CRM referencia sem conter: Tipo de Canal e Tipo de Identificador (plataforma), Membro (Proprietário, Atribuído, elegível), Agente (Atribuído), Arquivo (Foto, Anexos, evidência), Tarefa e Documento de Conhecimento (Vínculo), Sessão de Chat (âncora), Automação (escopo), Widget (Fonte de Dados), Registro de Atividade (histórico).

## 8. Relações

Tabela-mestra das relações do CRM — insumo direto para a MATRIZ-DE-RELACOES.md. "Propriedade" indica se a relação é de contenção/pertencimento (o destino falha no teste de existência sem a origem); "não" indica associação, referência ou responsabilidade. Nenhuma relação abaixo é nova: cada linha aponta o documento e a decisão que a fixou.

| Origem | Relação | Destino | Tipo | Cardinalidade (origem → destino / inversa) | Propriedade | Decidida em |
| --- | --- | --- | --- | --- | --- | --- |
| Espaço de Trabalho | contém | Contato | pertencimento | 0..N / 1 | sim | 10, RN-CON-01; 01, 8 |
| Espaço de Trabalho | contém | Empresa | pertencimento | 0..N / 1 | sim | 11, RN-EMP-01 |
| Espaço de Trabalho | contém | Negócio | pertencimento | 0..N / 1 | sim | 12, RN-NEG-01 |
| Espaço de Trabalho | contém (catálogo) | Funil | pertencimento | 1..N / 1 | sim | 13, DO-FUN-09 (altera 0..N do doc. 01) |
| Espaço de Trabalho | referencia como padrão | Funil | referência | 1 / 0..1 | não | 13, RN-FUN-16 |
| Espaço de Trabalho | possui | Caixa de Entrada | composição 1:1 | 1 / 1 | sim | 14, RN-CXE-01; B11 |
| Caixa de Entrada | contém | Canal | contenção | 0..N / 1 | sim | 14, 8.1 |
| Caixa de Entrada | contém | Fila | contenção | 0..N / 1 | sim | 14, 8.1 |
| Caixa de Entrada | contém | Conversa | contenção | 0..N / 1 | sim | 14, DO-CXE-01 |
| Conversa | contém | Mensagem | composição | 1..N / 1 | sim | 14, INV-CXE-05; RN-CXE-15 |
| Conversa | contém | Participante | composição | 1..N / 1 | sim | 14, INV-CXE-06 |
| Mensagem | contém | Anexo | componente | 0..N / 1 | sim | 14, 7.11 |
| Anexo | referencia | Arquivo | referência | 1 / 0..N | não | A8; 14, 9 |
| Funil | contém | Etapa | composição | 1..N / 1 | sim | 13, INV-FUN-02 |
| Contato | contém | Identificador de Contato | contenção | 0..N / 1 | sim | 10, DO-CON-03; B13 |
| Contato | registra | Consentimento | objeto de valor (histórico) | 0..N / — | sim | 10, DO-CON-06 |
| Contato / Empresa | tem | Endereço | objeto de valor | 0..N / — | sim | 10, 7.3; 11, 7.2 |
| Empresa | contém | Identificador de Empresa | contenção | 0..N / 1 | sim | 11, DO-EMP-03 |
| Contato / Empresa / Negócio / Conversa | contém | Valor de Campo | contenção | 0..N / 1 | sim | A5; 10, 7.7; 11, 7.3; 12, 6.4; 14, 7.12 |
| Contato / Empresa / Negócio | contém | Comentário | contenção | 0..N / 1 | sim | 10, 7.4; DO-EMP-15; DO-NEG-15 (Conversa não recebe — DO-CXE-08) |
| Empresa / Negócio | anexa | Arquivo | referência (Anexo) | 0..N / 0..N | não | 11, 7.5; 12, 7.5 |
| Contato | tem Foto | Arquivo | referência | 0..1 / 0..N | não | contatos.md 6 (10, 8–9) |
| Contato | vinculado a | Empresa | Vínculo Contato-Empresa (papel, 2 indicadores de principal, início, fim) | 0..N / 0..N; ≤1 vigente por par | não | B8; DO-CON-02; DO-EMP-05 |
| Contato | vinculado a | Negócio | Vínculo Contato-Negócio (papel de catálogo fixo, principal) | 0..N / 0..N; ≤1 por par | não | B9; DO-NEG-03 |
| Negócio | referencia | Empresa | referência unilateral | 0..1 / 0..N | não | B9; DO-NEG-07; DO-EMP-11 |
| Negócio | percorre | Funil | referência obrigatória substituível | 1 / 0..N | não | DO-FUN-01; RN-NEG-03 |
| Negócio | está em / terminou em | Etapa | referência por identidade | 1 / 0..N | não | INV-FUN-06; RN-FUN-05 |
| Conversa | é com | Contato (principal) | referência obrigatória | 1 / 0..N | não | B12; DO-CON-09; INV-CON-11 |
| Conversa | ocorre por | Canal | referência obrigatória, imutável | 1 / 0..N | não | INV-CXE-04 |
| Conversa | está em | Fila | referência mutável | 0..1 / 0..N | não | DO-CXE-01; RN-CXE-13 |
| Conversa | é atribuída a | Membro ou Agente | responsabilidade de execução | 0..1 / 0..N | não | A7; B7; DO-CXE-02 |
| Conversa | vinculada a | Negócio | Vínculo Conversa-Negócio | 0..N / 0..N | não | DO-NEG-13; 14, 7.12 e 8.4 |
| Participante | referencia | Contato, Membro ou Agente | referência | 1 / 0..N | não | 14, 7.7 |
| Mensagem `recebida` | chegou por | Identificador de Contato | referência | 1 / 0..N | não | 14, 8.1; 10, 8 |
| Mensagem | em resposta a | Mensagem (mesma Conversa) | referência | 0..1 / 0..N | não | INV-CXE-10 |
| Canal | é de | Tipo de Canal | referência global, imutável | 1 / 0..N | não | A1.3; INV-CXE-02 |
| Canal | tem Fila padrão | Fila | referência | 0..1 / 0..N | não | INV-CXE-15 |
| Fila | tem elegíveis | Membro, Equipe | associação | 0..N / 0..N | não | 14, 7.4 |
| Fila / Canal / Caixa | referencia Proprietário padrão de Contatos | Membro | referência | 0..1 / 0..N | não | DO-CON-08; DO-CXE-05 |
| Canal | referencia Origem padrão | Origem | referência (catálogo) | 0..1 / 0..N | não | 14, 7.2 |
| Empresa | tem matriz | Empresa | hierarquia estrutural sem contenção (floresta acíclica) | 0..1 / 0..N | não | DO-EMP-06; INV-EMP-05 |
| Empresa | vinculada a | Empresa | Vínculo Empresa-Empresa tipado | 0..N / 0..N; ≤1 por (par, tipo, direção) | não | DO-EMP-07 |
| Contato | `distinto de` | Contato | Vínculo simétrico | 0..N / 0..N | não | DO-CON-14 |
| Negócio | `relacionado a` | Negócio | Vínculo simétrico | 0..N / 0..N | não | DO-NEG-19 |
| Contato / Empresa | mesclado em | Contato / Empresa (sobrevivente) | referência (só em `mesclado`) | 0..1 / 0..N | não | B14; DO-CON-11; DO-EMP-13 |
| Contato / Empresa / Negócio | é de propriedade de | Membro | propriedade (governança) | 1 / 0..N | não | A7; DO-CON-07; RN-EMP-02; RN-NEG-02 |
| Toda entidade do CRM | foi criada por | Ator | referência (Criador) | 1 / 0..N | não | A7 |
| Contato / Empresa / Negócio / Conversa | vinculado a | Tarefa | Vínculo | 0..N / 0..N | não | DO-TAR-08; 14, 8.5 |
| Negócio | vinculado a | Documento de Conhecimento | Vínculo | 0..N / 0..N | não | 12, 8.1; B19 |
| Contato / Empresa | vinculado a | Documento de Conhecimento | Vínculo | 0..N / 0..N | não | conhecimento.md DO-CNH-07 / B99 |
| Contato / Empresa / Negócio / Conversa | tem | Tag | associação N:N | 0..N / 0..N | não | B5 |
| Contato / Empresa / Negócio | tem | Origem | referência (catálogo) | 0..1 / 0..N | não | B34; DO-EMP-09 |
| Contato | tem | Definição de Qualificação | referência (catálogo) | 0..1 / 0..N | não | DO-CON-05 |
| Negócio | tem | Motivo de Perda / Motivo de Ganho | referência (catálogo) | 0..1 cada / 0..N | não | DO-FUN-08; DO-NEG-06; RN-NEG-12 |
| Requisito de Etapa | referencia | Definição de Campo (Negócio) | referência (uso) | 0..1 / 0..N | não | RN-FUN-09 |
| Automação | tem escopo em | Funil / Caixa de Entrada / Fila | referência (escopo) | 1 / 0..N | não | B41; DO-CXE-16 |
| Sessão de Chat | ancorada a | Contato / Empresa / Negócio / Conversa | referência inversa | 0..1 / 0..N | não | B21; DO-EMP-14 |
| Widget | tem Fonte de Dados em | Contatos, Empresas, Negócios de um Funil, Conversas de Fila/Canal/Caixa | referência | — | não | B20; Glossário |
| Registro de Atividade | tem como objeto | qualquer entidade do CRM | referência inversa | 0..N / 1 | não | A6.2; INV-ET-12 |

Distinção aplicada ao domínio inteiro: **CONTER** (agregados: Caixa → Canal/Fila/Conversa; Conversa → Mensagem/Participante; Funil → Etapa; Contato → Identificadores; Empresa → Identificadores; todos → Valores de Campo e Comentários); **REFERENCIAR** (Conversa → Contato/Canal/Fila/Atribuído; Negócio → Funil/Etapa/Empresa; Canal → Tipo de Canal); **RELACIONAR-SE** (todos os Vínculos); **USAR** (catálogos do Espaço de Trabalho); **CONFIGURAR** (Caixa configura prazo e distribuição; Funil configura Requisitos e Regras de encerramento; Fila configura elegíveis). **Nenhuma entidade do CRM HERDA** (seção 16).

## 9. Cardinalidades

As cardinalidades já estão decididas nos cinco documentos; esta seção consolida as que sustentam o domínio e registra a única `DECISÃO NECESSÁRIA` remanescente.

| Relação | Cardinalidade | Zero? | Muitos? | Natureza | Justificativa (documento fonte) |
| --- | --- | --- | --- | --- | --- |
| ET → Caixa de Entrada | 1 | não | não | composição | Única por ET; múltiplas Caixas são C4, rejeitada (B11; 14, 9). |
| ET → Funil | 1..N | não | sim | pertencimento | Funil padrão criado com o ET e sempre `ativo` (DO-FUN-09; INV-FUN-08). |
| Funil → Etapa | 1..N | não | sim | composição | Funil sem Etapa não posiciona nada (INV-FUN-02); uma só Etapa é válida (13, 20.2). |
| Negócio → Funil / Etapa | 1 / 1 | não | não | referência | B9: sem posição, "em que ponto está" é indefinido; vários tornam a pergunta ambígua (12, 9). |
| Negócio → Empresa | 0..1 | sim | não | referência | Venda a pessoa física; contraparte comercial única (B9; 12, 9). |
| Negócio ↔ Contato | 0..N / 0..N, ≤1 por par | sim | sim | associativa | Comitê de compra; um papel por Contato por Negócio (DO-NEG-03). |
| Contato ↔ Empresa | 0..N / 0..N, ≤1 vigente por par | sim | sim | associativa | Consultor em várias; Empresa em prospecção sem pessoas (B8; DO-CON-02; 11, 9). |
| Contato → Identificador de Contato | 0..N | sim | sim | contenção | Pessoa indicada sem dados; dois telefones (10, 9). (Tipo, Valor) → Contato não `mesclado`: 0..1 (INV-CON-02). |
| Conversa → Contato principal | 1 | não | não | referência | A Conversa é *com alguém*; a criação automática garante o Contato (B12; RN-CON-12). Exceção temporária: marcador "não resolvido" por Limite atingido (DO-CXE-25). |
| (Contato, Canal) → Conversa `aberta`/`pendente` | 0..1 | sim | não | invariante | B12; INV-CXE-03. Não se aplica a Conversas de grupo (DO-CXE-22). |
| Conversa → Canal | 1, imutável | não | não | referência | O episódio ocorre por uma porta (INV-CXE-04). |
| Conversa → Fila | 0..1, mutável | sim | não | referência | Conversa sem Fila é válida (Canal sem Fila padrão; Fila arquivada ou eliminada); Fila não contém (DO-CXE-01). |
| Conversa → Atribuído | 0..1 | sim | não | responsabilidade | Aguardando distribuição; vários Atribuídos rejeitados (A7; 14, 9). |
| Conversa → Mensagem | 1..N | não | sim | composição | Nasce com a primeira Mensagem (INV-CXE-05). |
| Conversa ↔ Negócio | 0..N / 0..N | sim | sim | associativa | Uma Conversa trata de dois Negócios; um Negócio tem trinta Conversas (14, 20.4; 12, 20.14). |
| Contato / Empresa / Negócio → Proprietário | 1 | não | não | propriedade | A7; zero deixa sem governança, vários diluem (10, 11, 12, seção 9). |
| Caixa / Canal / Fila / Conversa / Funil → Proprietário | 0 | — | — | — | Infraestrutura e configuração; sem sucessão (DO-CXE-02; DO-FUN-02; INV-CXE-14; INV-FUN-11). |
| Empresa → Empresa matriz | 0..1 | sim | não | estrutural sem contenção | Uma controladora direta; sem limite de profundidade (DO-EMP-06). |
| Caixa → Canal / Fila | 0..N | sim | sim | contenção | Caixa vazia é válida (14, 9). |

`DECISÃO NECESSÁRIA` única e já registrada: regras de Conversa de grupo (C5) — o modelo suporta Participantes `contato` adicionais (DO-CXE-22), mas consentimento, Proprietário dos Contatos criados por grupo e troca de Contato principal permanecem abertos (14, 25.1). Todas as demais cardinalidades decorrem da constituição ou de decisões RECOMENDADAS dos documentos 10–14.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O CRM não tem hierarquia de contêineres (A2.2; A5.2). Contato, Empresa, Negócio e Funil são filhos diretos do Espaço de Trabalho; a Caixa de Entrada é composição 1:1 com ele. As únicas hierarquias internas são de agregado, com no máximo dois níveis: Caixa → {Canal, Fila, Conversa} → Conversa → {Mensagem, Participante, Valor de Campo} → Anexo (14, 10); Funil → Etapa (13, 10); Contato → {Identificador, Consentimento, Endereço, Comentário, Valor}; Empresa → {Identificador, Endereço, Comentário, Valor, Anexo}; Negócio → {Valor, Valor de Campo, Comentário, Anexo}. A hierarquia matriz/filial de Empresas é estrutural, mas **não é contenção** (DO-EMP-06). Consequência para todo o domínio: não há estado efetivo (B36), Valores de Campo órfãos por movimentação (B37), movimentação entre contêineres (B40) nem herança de configuração (B25).

### 10.1 Propriedade versus associação (teste de existência)

| O que | Pertence a (falha no teste de existência sem) | Apenas se associa ou referencia |
| --- | --- | --- |
| Canal, Fila, Conversa | Caixa de Entrada (14, 10) | — |
| Mensagem, Participante, Valor de Campo de Conversa | Conversa (INV-CXE-05/06) | — |
| Anexo | Mensagem (ou Empresa, Negócio, Comentário) | Arquivo é referenciado, pertence ao ET (A8) |
| Etapa, Requisitos, Transições permitidas, Regras de encerramento | Funil (DO-FUN-01; 13, 7) | Negócio referencia a Etapa; não é contido |
| Identificador de Contato, Consentimento, Endereço, Comentário, Valor de Campo, Estado pré-mesclagem | Contato (10, 10) | Conversas, Negócios, Tarefas existem sem o Contato |
| Identificador de Empresa, Endereço, Comentário, Valor de Campo | Empresa (11, 10) | Contatos, Negócios, filiais, Tarefas existem sem a Empresa |
| Valor, Valor de Campo, Comentário, face do Vínculo Contato-Negócio | Negócio (12, 10) | Empresa, Contatos, Tarefas, Conversas, Documentos existem sem o Negócio |
| Contato, Empresa, Negócio, Funil, Caixa de Entrada | Espaço de Trabalho (A1.1) | — |
| Contato ↔ Empresa | — | Vínculo Contato-Empresa; eliminar um lado remove o Vínculo, não o outro (RN-CON-07) |
| Contato ↔ Negócio | — | Vínculo Contato-Negócio; o Negócio permanece sem o Contato (DO-CON-10) |
| Negócio → Empresa | — | Referência; a eliminação da Empresa é adiada, nunca em cascata (RN-EMP-10) |
| Negócio → Funil / Etapa | — | Referência obrigatória substituível; o Negócio sobrevive por migração (RN-FUN-12/13) |
| Conversa → Contato | — | Referência obrigatória; a Conversa sobrevive ao Contato por Marcador (DO-CON-10) |
| Conversa → Fila / Atribuído | — | Referência mutável; responsabilidade liberável (RN-CXE-13; RN-CXE-24) |
| Conversa ↔ Negócio | — | Vínculo; nenhum contém o outro (DO-NEG-13) |
| Qualquer coisa do CRM ↔ Tarefa | — | Vínculo; a Tarefa pertence à sua Lista (A2.2; DO-TAR-08) |

**"Pertence a" versus "relaciona-se com".** A Conversa *pertence* à Caixa e *é com* um Contato; o Contato *não possui* as suas Conversas (DO-CON-09). O Negócio *percorre* o Funil e *referencia* a Empresa; a Empresa *não possui* os seus Negócios (DO-FUN-01; 11, 21). A Fila *não possui* as Conversas que agrupa (DO-CXE-01). O Proprietário *responde* pelo registro; o registro *não pertence* ao Membro — a remoção do Membro transfere (B28), nunca elimina.

### 10.2 Termos de responsabilidade no CRM

| Termo (A7) | Quem tem | Quem não tem | Fonte |
| --- | --- | --- | --- |
| **Proprietário** (exatamente um Membro `ativo` ou `suspenso`; sucessão por B28) | Contato, Empresa, Negócio | Caixa de Entrada, Canal, Fila, Conversa (DO-CXE-02; INV-CXE-14), Funil (DO-FUN-02; INV-FUN-11), Etapa, Mensagem, Participante | DO-CON-07; RN-EMP-02; RN-NEG-02 |
| **Atribuído** (0..1; Membro ou Agente; liberado na remoção) | Conversa | Todas as demais | A7; B7; DO-CXE-17 |
| **Responsável** | **Ninguém no CRM.** O trabalho é Tarefa vinculada, com Responsáveis próprios | Contato, Empresa, Negócio (INV-NEG-02), Conversa | A7; DO-TAR-08 |
| **Criador** (imutável) | Todas as entidades com identidade | — | A7 |
| **Membro configurador** (rastreabilidade, não governança) | Canal (como Integração) | — | B35; RN-CXE-02 |
| **Administrador** (Papel) | Governança de catálogos, Funis, Canais, Filas, Caixa; reabrir Negócio `ganho` | — | RN-ET-24; RN-FUN-17; RN-NEG-10 |

"Gerente de conta", "vendedor da conta" e "dono da Conversa" não existem como termos: são, respectivamente, o Proprietário da Empresa (11, 21), o Proprietário do Negócio e o Atribuído da Conversa (14, 4). Atender uma Conversa ou ser Responsável por Tarefa vinculada nunca transfere propriedade de Contato ou Negócio (RN-CON-05; 12, 10).

## 11. Estados

Todos os estados do CRM são **estados de sistema** (A4.1, A4.4, A4.5): nenhuma entidade do domínio tem Status personalizável (A4.2), e nenhum dos estados abaixo pode ser renomeado, acrescido ou removido pela organização. Etapa não é estado (é posição); Qualificação não é estado (é atributo de catálogo); "lead", "parado", "sem Atribuído", "Não identificado" são condições derivadas.

| Entidade | Eixo | Valores | Observações | Fonte |
| --- | --- | --- | --- | --- |
| Contato | ciclo de vida | `ativo`, `arquivado`, `na lixeira`, `mesclado` | `mesclado` é terminal e exclusivo de Contato e Empresa (B14). Mensagem recebida devolve `arquivado`/`na lixeira` a `ativo` (DO-CON-15). | DO-CON-17 |
| Empresa | ciclo de vida | `ativo`, `arquivado`, `na lixeira`, `mesclado` | Lixeira rejeitada com Negócio `aberto` ou filial; eliminação adiada enquanto houver Negócio (DO-EMP-11). | 11, 11 |
| Negócio | **situação** | `aberto`, `ganho`, `perdido` | Terminais reabríveis; `ganho` → `aberto` só por Papel de nível Administrador (B9). Sem transição direta `ganho` ↔ `perdido`. | A4.4; DO-NEG-08 |
| Negócio | ciclo de vida | `ativo`, `arquivado`, `na lixeira` | Ortogonal à situação: qualquer combinação é válida; `na lixeira` continua a referenciar Funil e Etapa. Guarda Estado anterior à exclusão (B43 por analogia). | DO-NEG-09 |
| Funil | ciclo de vida | `ativo`, `arquivado`, `na lixeira` | `arquivado`: só Negócios `ganho`/`perdido` o referenciam; `na lixeira`: nenhum. Funil padrão sempre `ativo`. | 13, 11.1; INV-FUN-07/08 |
| Etapa | — | **sem estado** | Existe ou não existe; remoção exige remapeamento. | DO-FUN-15 |
| Caixa de Entrada | — | **sem estado próprio** | Acompanha o Espaço de Trabalho (`ativo`, `suspenso`, `encerrado`). | 14, 11; RN-CXE-27 |
| Canal | conexão (Integração) | `conectada`, `desconectada`, `com erro` | Herdado de Integração. | 14, 11.1 |
| Canal | ciclo de vida | `ativo`, `arquivado` | **Sem `na lixeira`**: Conversas o referenciam imutavelmente; eliminação individual só sem Conversas. Exceção a A4.1. | DO-CXE-03 |
| Fila | ciclo de vida | `ativo`, `arquivado`, `na lixeira` | Arquivar/excluir exige transferir as Conversas não resolvidas. | 14, 11.2; RN-CXE-32 |
| Conversa | **estado de conversa** | `aberta`, `pendente`, `resolvida` | `aberta` = aguarda a organização; `pendente` = aguarda o Contato ou o relógio (Adiamento); `resolvida` = repouso, reabrível. | A4.5; DO-CXE-07 |
| Conversa | ciclo de vida | `ativo`, `na lixeira` | **Sem `arquivado`** (`resolvida` é o repouso); só `resolvida` vai à lixeira. Exceção a A4.1. | DO-CXE-03; RN-CXE-33 |
| Mensagem `enviada` | status de entrega | `pendente`, `enviada`, `entregue`, `lida`, `falhou` | `lida` e `falhou` terminais; reenvio é Mensagem nova. `recebida` e `interna` não têm status de entrega. | 14, 11.4; INV-CXE-09 |
| Mensagem, Participante, Anexo | — | **sem estado de ciclo de vida** | Acompanham a Conversa; Marcação de exclusão é objeto de valor terminal, não estado. | DO-CXE-03; DO-CXE-23 |
| Identificador de Contato / de Empresa | — | sem estado | Verificado e principal são atributos. | 10, 7.1; 11, 7.1 |

Eliminação permanente não é estado em nenhuma linha: é o fim do registro (A4.1). As exceções a A4.1 introduzidas pelo domínio — `mesclado` (Contato, Empresa), Canal sem `na lixeira`, Conversa sem `arquivado` — estão registradas na seção 25.

## 12. Ciclo de vida

O domínio não tem ciclo de vida próprio; o que tem é o **ciclo de vida do relacionamento**, que atravessa as cinco entidades. A narrativa abaixo mostra, a cada passo, o que nasce, o que é referenciado e quais Vínculos são criados. Os ciclos de vida de cada entidade (criação, transições, lixeira, eliminação, mesclagem) estão nos documentos 10–14, seção 12.

### 12.1 Percurso ontológico: da Mensagem ao trabalho

| Passo | Fato | O que nasce | O que é referenciado / criado como relação | Fonte |
| --- | --- | --- | --- | --- |
| 1 | Uma pessoa escreve ao número de WhatsApp da organização. | **Mensagem** `recebida` (Ator: o Canal). | O Canal produz (Tipo, Valor); a resolução procura um Identificador de Contato (RN-CXE-06). | 14, 12.4; B13 |
| 2 | O Identificador não existe. | **Contato** (Não identificado; Modo `automático por Mensagem`), **Identificador de Contato** (verificado, principal, Canal de origem), **Conversa** `aberta`, **Participante** `contato` principal — tudo no mesmo ato atômico. | Proprietário do Contato resolvido Fila → Canal → Caixa → Proprietário do ET (DO-CXE-05); Origem = Origem padrão do Canal; Fila = Fila padrão do Canal (RN-CXE-07); Atribuído pela regra da Fila (RN-CXE-08). Nenhum Vínculo: Conversa → Contato é referência (DO-CON-09). | RN-CON-12; DO-CON-08 |
| 3 | O Atendente identifica a pessoa e a organização dela. | Nada novo se já existirem; senão **Empresa**. | Nome do Contato preenchido; **Vínculo Contato-Empresa** (papel, principal); Sugestão de Vínculo por domínio se houver e-mail (DO-EMP-04); Consentimento `atendimento` registrado (DO-CON-06). Empresa da Conversa passa a ser derivada (DO-EMP-08). | 10, 7.6; 11, 8.2 |
| 4 | A pessoa quer comprar. | **Negócio** `aberto`, `ativo`, "criado a partir de Conversa". | Referência ao **Funil** padrão e à **Etapa** inicial (ou explícitas — DO-FUN-04); **Vínculo Conversa-Negócio**; **Vínculo Contato-Negócio** (principal); Empresa derivada sugerida como referência; Proprietário = quem cria; Proveniência gravada; Registro de transição com origem `criação`. | RN-NEG-24; 14, 8.4; DO-NEG-13 |
| 5 | A negociação progride. | Nada novo: **Registros de Atividade** de transição (Etapa por identidade, nome e Ordem à época). | Requisitos e Transições permitidas do Funil validam cada passo (DO-FUN-06); a probabilidade sobrescrita é descartada a cada progressão (DO-NEG-05); Automações com escopo Funil reagem a "entrou em Etapa" (B41). A Conversa pode ser `resolvida` e reaberta várias vezes (B12); Conversas novas do mesmo Contato são vinculadas ao Negócio por ato (12, 20.14). | 12, 12.3; 13, 12.4 |
| 6 | O trabalho é executado. | **Tarefas** em Listas da Estrutura de Trabalho ("Enviar proposta"), criadas a partir da Conversa ou do Negócio. | **Vínculo Tarefa-Negócio**, **Vínculo Tarefa-Conversa**, **Vínculo Tarefa-Contato** (atos explícitos); Proveniência "criada a partir de". A Tarefa vinculada não terminal de menor Data é a "próxima atividade" do Negócio (derivada). Responsáveis existem só na Tarefa. | DO-TAR-08; 14, 8.5; DO-NEG-14 |
| 7 | O Negócio é fechado. | Nada novo: situação `ganho` (ou `perdido`, com Motivo de Perda). | Última Etapa preservada (B9); Regras de encerramento do Funil avaliadas (DO-FUN-08); Motivo de Ganho opcional (DO-NEG-06). Tarefas e Conversas vinculadas **não** mudam por si; Automação pode concluí-las, resolver a Conversa, alterar a Qualificação do Contato para "cliente" (DO-CON-05) e criar Negócio novo de pós-venda com Proveniência (13, 20.6). | 12, 12.2 |
| 8 | O relacionamento continua. | Novas **Conversas** (episódios), novos **Negócios**; nunca novos Contatos para a mesma pessoa (INV-CON-02). | Linha do tempo do Contato e da Empresa agrega tudo por derivação (10, 8.1; 11, 8.4). | B12; 10, 2 |

Em nenhum passo uma entidade do CRM contém outra fora do seu agregado: a Conversa nasce na Caixa, o Negócio nasce no Espaço de Trabalho, a Tarefa nasce na Lista; o que os liga são referências e Vínculos.

### 12.2 Fim de vida e cascata entre entidades

| Ato | Efeito sobre as outras entidades do CRM | Fonte |
| --- | --- | --- |
| Contato mesclado | Identificadores, Vínculos, Tags, Consentimentos, Comentários migram; Conversas, Participantes e Mensagens reapontam; se sobrar duas Conversas não resolvidas no mesmo Canal, a de Mensagem mais recente permanece e a outra passa a `resolvida` (DO-CXE-21). Negócios não mudam (12, 20.6). | DO-CON-11; RN-CXE-10 |
| Contato eliminado (prazo ou titular) | Vínculos removidos; Conversas e Negócios permanecem; Marcador de Contato eliminado nas Conversas; Itens de Memória do Agente que o referenciam eliminados (B78); Mensagens anonimizadas e Rascunhos descartados se por solicitação do titular. | DO-CON-10; 14, 20.21; RN-AGE-23 |
| Empresa mesclada | Vínculos, Negócios, filiais, Comentários migram; a sobrevivente ocupa o lugar na árvore, com verificação de aciclicidade. | DO-EMP-13 |
| Empresa à lixeira / eliminada | Rejeitada com Negócio `aberto` fora da lixeira ou filial `ativo`/`arquivado`; eliminação adiada enquanto houver Negócio; Contatos intactos. | DO-EMP-11; RN-CON-07 |
| Negócio eliminado | Vínculos removidos (Contatos, Tarefas, Conversas intactos); a Empresa deixa de ter este Negócio como bloqueio. | 12, 12.4 |
| Funil arquivado / à lixeira / Etapa removida | Migração ou remapeamento obrigatório de todo Negócio que o referencie — inclusive `na lixeira` —, sem Requisitos, sem descartar sobrescrita, com evento agregado; Automações com escopo nele inoperantes e, na eliminação, eliminadas. | RN-FUN-10/12/13; RN-NEG-17; B41 |
| Fila arquivada / à lixeira | Transferência das Conversas não resolvidas no mesmo ato; Canais perdem a Fila padrão; Conversas `resolvida` continuam a referenciá-la até a eliminação. | RN-CXE-32; 14, 12.3 |
| Canal arquivado | Sempre desconectado; Conversas preservadas e ainda referenciando-o; sem lixeira (eliminação só sem Conversas). | DO-CXE-03; RN-CXE-04 |
| Conversa eliminada | Mensagens, Participantes, Anexos (referências), Valores, Vínculos eliminados; Contato, Negócio, Tarefa, Arquivo intactos. | RN-CXE-33 |
| Membro removido | Contatos, Empresas e Negócios passam ao Sucessor (B28); Conversas atribuídas são liberadas e redistribuídas; Proprietário padrão de Contatos limpo; elegibilidade retirada; concessão `administrar` sobre Funil privado passa ao Sucessor (B38d). | RN-ET-09a; RN-CXE-24; RN-CXE-29; RN-NEG-20 |
| Espaço de Trabalho suspenso | Mensagens recebidas persistidas sem distribuição, Automação, Agente ou resposta; `pendente` de envio → `falhou`. | B31; RN-CXE-27 |
| Espaço de Trabalho eliminado | Tudo o que está nesta tabela é eliminado em cascata. | B32 |

## 13. Regras de negócio ontológicas

As regras abaixo são **transversais**: cada uma consolida regras já fixadas em dois ou mais documentos do CRM. Nenhuma cria obrigação nova; a fonte está indicada.

- **RN-CRM-01.** Nenhuma entidade do CRM é Ator, Sujeito de permissão, Proprietário, Responsável, Atribuído ou aprovador. Contato e Empresa nunca agem; Negócio, Conversa e Funil nunca agem. O único Ator do domínio é o Canal, como Integração (RN-CON-04; INV-EMP-10; INV-NEG-12; 14, 3.2).
- **RN-CRM-02.** Toda entidade do CRM pertence, direta ou transitivamente, a exatamente um Espaço de Trabalho, sem contêiner intermediário; nenhuma relação do domínio cruza a fronteira (A1.1; INV-ET-07; RN-CON-01; RN-EMP-01; RN-NEG-01; RN-FUN-01; INV-CXE-18).
- **RN-CRM-03.** Entidades do CRM relacionam-se entre si por referência ou Vínculo, nunca por contenção: Empresa não contém Contatos nem Negócios; Funil não contém Negócios; Fila e Canal não contêm Conversas; Contato não contém Conversas (B8; DO-FUN-01; DO-CXE-01; DO-CON-09). Eliminar um lado de um Vínculo remove o Vínculo, nunca o outro lado (A8).
- **RN-CRM-04.** Toda Mensagem `recebida` é resolvida a exatamente um Contato pelo par (Tipo, Valor) de um Identificador de Contato; sem correspondência, o Sistema cria Contato, Identificador, Conversa e Mensagem no mesmo ato atômico; Identificadores de Empresa nunca resolvem Mensagens (B13; RN-CON-12; RN-CXE-06; RN-EMP-06).
- **RN-CRM-05.** O par (Tipo, Valor) de Identificador de Contato é único entre Contatos não `mesclado` do Espaço de Trabalho, inclusive `arquivado` e `na lixeira`; a colisão é rejeitada com indicação do detentor e o caminho é mesclar ou transferir (INV-CON-02; RN-CON-11). O mesmo modelo vale para Identificador de Empresa entre Empresas não `mesclado` (INV-EMP-02).
- **RN-CRM-06.** Contato, Empresa e Negócio têm exatamente um Proprietário, Membro `ativo` ou `suspenso`, transferível por ato registrado e sucedido na remoção do Membro (B28); atender Conversa ou executar Tarefa vinculada nunca transfere propriedade (DO-CON-07; RN-EMP-02; RN-NEG-02; RN-CON-05).
- **RN-CRM-07.** Caixa de Entrada, Canal, Fila, Conversa e Funil não têm Proprietário e não são sucedidos; a governança é por Papel de nível Administrador e por `administrar` concedido sobre o registro (DO-CXE-02; DO-FUN-02; RN-FUN-17; DO-CXE-19).
- **RN-CRM-08.** Todo Negócio referencia exatamente um Funil e uma Etapa desse Funil, em todo estado e situação; nenhuma operação de configuração do Funil altera um Negócio sem ato explícito de remapeamento registrado; Negócios `na lixeira` participam dos remapeamentos obrigatórios (B9; INV-FUN-06; INV-FUN-10; RN-NEG-17).
- **RN-CRM-09.** Posição e resultado são dimensões independentes do Negócio: a Etapa nunca carrega resultado, a situação nunca é uma Etapa, e a última Etapa é preservada ao encerrar (A4.4; DO-FUN-03; RN-FUN-11; RN-FUN-20).
- **RN-CRM-10.** Por par (Contato não `mesclado`, Canal) existe no máximo uma Conversa `aberta` ou `pendente` (fora de grupo); Mensagem recebida entra nela, reabre a `resolvida` dentro do Prazo de reabertura da Caixa ou cria Conversa nova (B12; INV-CXE-03; RN-CXE-09; DO-CXE-04).
- **RN-CRM-11.** Cargo é atributo do Vínculo Contato-Empresa; papel no Negócio é atributo do Vínculo Contato-Negócio; nenhum dos dois é atributo do Contato (DO-CON-04; DO-NEG-03).
- **RN-CRM-12.** Todo Vínculo do CRM é visível apenas a quem vê ambos os lados; ver um Contato, uma Empresa ou um Negócio não concede ver as Conversas, os Negócios ou as Tarefas vinculados — a linha do tempo é filtrada item a item (RN-CON-21; 11, 17.2; 12, 8.2; DO-TAR-08).
- **RN-CRM-13.** Mesclagem existe para Contato e Empresa com regra única: entre dois registros `ativo` ou `arquivado` (nunca `na lixeira` nem `mesclado`), por Ator com `administrar` sobre ambos; o sobrevivente resulta `ativo` se um dos dois era `ativo`; é irreversível e preserva a identidade do absorvido em `mesclado`; não existe mesclagem de Negócios nem de Conversas (B14; DO-CON-11; DO-EMP-13; DO-NEG-12; RN-CXE-15).
- **RN-CRM-14.** Agentes e Automações agem sobre o CRM apenas com as suas permissões (interseção em nome de Membro), avaliadas a cada Ferramenta, sob os mesmos Requisitos, Regras de encerramento, consentimento e janela de resposta que um Membro; nunca criam ou administram Funis, Filas, Canais ou a Caixa; nunca reabrem Negócio `ganho`; as ações que exigem aprovação em `supervisionado` são as de B64, decididas por Ferramenta e classe de efeito (B77), com prazo padrão de 72 horas (B80) (A6.3; A9.3; B22; B23; RN-FUN-17; RN-NEG-21; RN-CXE-12; DO-CON-13; RN-EMP-16).
- **RN-CRM-15.** Registros do CRM não são Conhecimento; Agentes os acessam por Ferramentas, sujeitos a permissão (B19; INV-NEG-12).
- **RN-CRM-16.** Derivados do CRM — Última interação, linha do tempo, Empresa da Conversa, Cargo de exibição, probabilidade efetiva, valor ponderado, dias em Etapa, próxima atividade, tempo de primeira resposta, elegíveis efetivos — são calculados a cada consulta, filtrados por B20 e nunca gravados (DO-FUN-12; DO-NEG-14; DO-EMP-08; 10, 6; 14, 7.5).
- **RN-CRM-17.** Toda ação sobre qualquer entidade do CRM gera Registro de Atividade com Ator e ator delegante, inclusive as do Sistema (criação automática, restauração por Mensagem, resolução por mesclagem, remapeamento, eliminação por prazo) (A6.2; RN-CON-22; RN-EMP-14; RN-NEG-15; RN-FUN-19; RN-CXE-30).
- **RN-CRM-18.** Eliminar um item de catálogo do Espaço de Trabalho (Origem, Qualificação, Finalidade, Motivo, Definição de Campo, Tag) nunca elimina nem altera de outra forma um registro do CRM: limpa a referência, exige substituto ou é rejeitado enquanto referenciado (RN-CON-18; RN-NEG-12; A5.4; princípio de RN-ET-17).

## 14. Invariantes

- **INV-CRM-01.** Toda entidade do CRM tem exatamente um Espaço de Trabalho, imutável, e nenhuma referência a entidade de outro Espaço de Trabalho (INV-ET-07).
- **INV-CRM-02.** Existe exatamente uma Caixa de Entrada e ao menos um Funil `ativo` (o Funil padrão) por Espaço de Trabalho (INV-ET-08; INV-FUN-08).
- **INV-CRM-03.** Todo Contato, Empresa e Negócio tem exatamente um Proprietário Membro `ativo` ou `suspenso`; nenhuma Caixa, Canal, Fila, Conversa ou Funil tem Proprietário (INV-CON-09; INV-EMP-06; INV-NEG-02; INV-CXE-14; INV-FUN-11).
- **INV-CRM-04.** Nenhuma entidade do CRM ocupa posição de Responsável; Atribuído existe apenas em Conversa, 0..1 (INV-CON-13; INV-NEG-02; INV-CXE-12).
- **INV-CRM-05.** Não existem dois Identificadores de Contato com o mesmo (Tipo, Valor canônico) em Contatos não `mesclado`, nem dois Identificadores de Empresa com o mesmo (tipo, valor normalizado) em Empresas não `mesclado` (INV-CON-02; INV-EMP-02).
- **INV-CRM-06.** Toda Conversa referencia exatamente um Canal (imutável) e exatamente um Contato principal não `mesclado` — ou Marcador de Contato eliminado ou marcador "não resolvido" —, e tem ao menos uma Mensagem e um Participante `contato` principal (INV-CXE-04/05/06; INV-CON-11).
- **INV-CRM-07.** Para cada (Contato, Canal) há no máximo uma Conversa `aberta` ou `pendente` sem Identificador de grupo (INV-CXE-03).
- **INV-CRM-08.** Todo Negócio referencia exatamente um Funil e uma Etapa desse Funil; nenhum Negócio `aberto` referencia Funil `arquivado`; nenhum Negócio referencia Funil `na lixeira` ou Etapa inexistente (INV-FUN-06/07; INV-NEG-03).
- **INV-CRM-09.** Nenhuma Etapa altera a situação de um Negócio; a situação é exatamente uma entre `aberto`, `ganho`, `perdido`, com entrada em `ganho`/`perdido` só a partir de `aberto` (INV-FUN-09; INV-NEG-04).
- **INV-CRM-10.** Nenhum Negócio `aberto` com estado `ativo` ou `arquivado` referencia Empresa `na lixeira` ou `mesclado`; nenhuma referência nova aponta para Empresa não `ativo` (INV-EMP-07; INV-NEG-07).
- **INV-CRM-11.** `mesclado` é terminal; todo Contato ou Empresa `mesclado` referencia exatamente um sobrevivente não `mesclado`, sem cadeia (INV-CON-05/06; INV-EMP-08).
- **INV-CRM-12.** Cada Contato tem no máximo um Vínculo Contato-Empresa principal e no máximo um vigente por Empresa; cada Empresa tem no máximo um Contato principal; cada Negócio tem no máximo um Contato principal e um Vínculo por Contato (INV-CON-04; INV-EMP-04; INV-NEG-06).
- **INV-CRM-13.** A hierarquia matriz/filial de Empresas é uma floresta acíclica (INV-EMP-05).
- **INV-CRM-14.** Nenhuma Mensagem `interna` é transmitida a um Canal; toda Mensagem pertence a exatamente uma Conversa e nunca muda de Conversa (INV-CXE-09; RN-CXE-15).
- **INV-CRM-15.** Todo Proprietário de Negócio tem `ver` sobre o Negócio em todo instante, inclusive em Funil privado (INV-NEG-10).
- **INV-CRM-16.** Nenhuma entidade do CRM tem Status personalizável, estado efetivo derivado de ancestral ou Valor de Campo sem Definição aplicável (A4.2; B36 não se aplica; A5.4).

## 15. Personalização

O CRM não define configuração própria: **consome** catálogos e objetos de valor do Espaço de Trabalho (B34; documento 01, 7.6) e configurações locais de Funil, Caixa, Canal e Fila (seção 6). Os cinco documentos ampliaram a lista de catálogos do documento 01; a tabela consolida o conjunto vigente.

### 15.1 Catálogos do Espaço de Trabalho usados pelo CRM

| Catálogo (entidade contida, com identidade) | Usado por | Previsto no doc. 01, 7.6? | Decidido em |
| --- | --- | --- | --- |
| Origens | Contato, Negócio, Empresa (0..1 cada); Origem padrão de Canal | Sim (Contato, Negócio) | B34; DO-EMP-09 amplia a Empresa |
| Motivos de Perda | Negócio `perdido`; Regra de encerramento do Funil | Sim | B34; DO-FUN-08; "Duplicado" pré-definido (DO-NEG-12) |
| Motivos de Ganho | Negócio `ganho` (opcional) | **Não** — ampliação | DO-NEG-06 |
| Definições de Qualificação | Contato (0..1) | **Não** — ampliação | DO-CON-05 |
| Finalidades de Consentimento (com indicador "exige consentimento") | Consentimento do Contato; RN-CON-16 | **Não** — ampliação | DO-CON-06 |
| Definições de Campo Personalizado por entidade-alvo (Contato, Empresa, Negócio, Conversa) | Valores de Campo; Requisitos de Etapa `campo preenchido` | Sim | A5.2; DO-FUN-07; DO-EMP-10 (Segmento, Porte, Setor pré-definidas) |
| Tags (com restrição opcional de tipo de entidade) | Contato, Empresa, Negócio, Conversa | Sim | B5 |
| Funis (com Etapas, Requisitos, Transições, Regras de encerramento) | Negócio; Automações; Painéis | Sim | DO-FUN-09 (Funil padrão criado com o ET) |
| Identificador legível de Negócios (objeto de valor) | Negócio | **Não** — ampliação | DO-NEG-02 |

Catálogos **da plataforma**, referenciados e nunca personalizáveis: Tipos de Canal e Capacidades (RN-CXE-05), Tipos de Identificador de Contato (DO-CON-03), tipos de Identificador de Empresa (DO-EMP-03), tipos de Vínculo Empresa-Empresa (DO-EMP-07), papéis no Negócio (DO-NEG-03), tipos de Requisito de Etapa (DO-FUN-06), tipos de Endereço, lista de provedores públicos de e-mail (RN-EMP-05).

### 15.2 Configuração local e Templates

Configuração com ponto de definição na própria entidade do CRM: Etapas, Requisitos, Transições, Regras de encerramento e privacidade do Funil (`administrar` sobre o Funil — DO-FUN-10); Prazo de reabertura, Distribuição padrão, Proprietário padrão e Horário de atendimento da Caixa; Fila padrão, padrões de Contato, Grupos habilitados e mensagens de modelo do Canal; elegíveis, regra, limite e Horário da Fila (`administrar` sobre a Fila — DO-CXE-19). **Não há Template** de Contato, Empresa, Negócio, Funil ou Conversa: o Funil é copiável com Proveniência (DO-FUN-14); o Negócio é "criado a partir de" (12, 15). **Não há Campos Personalizados** em Identificador, Vínculo, Etapa, Canal, Fila, Mensagem ou Participante (A5.2; C13).

**Não personalizável em todo o domínio:** estados e transições (seção 11); a resolução de Mensagem por Identificador; a unicidade de Identificadores; a regra "um Funil, uma Etapa"; a ausência de Proprietário em Caixa/Canal/Fila/Conversa/Funil; a ausência de Responsável; a irreversibilidade da mesclagem; o invariante de uma Conversa não resolvida por (Contato, Canal); a ausência de prioridade nativa de Conversa (DO-CXE-10) e de Status.

## 16. Herança

**Nenhuma entidade do CRM herda configuração** no sentido de B25: não há contêineres, ponto de definição variável, modo `herdado`/`sobrescrito`/`bloqueado` nem caminho efetivo. Tudo o que o CRM recebe do Espaço de Trabalho chega por **escopo** (catálogos, Localidade, Política de lixeira, Limites impostos, Papéis) — o mesmo para todo registro, sem sobrescrita (10, 16; 11, 16; 12, 16; 13, 16; 14, 16). Nenhuma entidade do CRM **transmite** nada: uma Tag na Empresa não aparece nos Contatos; o Proprietário da Empresa não é Proprietário dos Negócios; a matriz não transmite nada às filiais (RN-EMP-12); a Fila não transmite permissões à Conversa; o Funil não transmite permissões ao Negócio (DO-FUN-10).

Cinco mecanismos com aparência de herança, todos derivação ou padrão de criação:

| Mecanismo | Natureza | Fonte |
| --- | --- | --- |
| Proprietário de Contato criado automaticamente: Fila → Canal → Caixa → Proprietário do ET | Resolução em cascata no ato de criação; depois, o Proprietário é do Contato | DO-CON-08; DO-CXE-05 |
| Regra de distribuição `herdar da Caixa`; Horário de atendimento Fila → Caixa (→ C12) | Derivação a cada avaliação | 14, 16 |
| Probabilidade efetiva = sobrescrita, senão padrão da Etapa atual | Derivação a cada consulta; nunca copiada | RN-FUN-18; DO-NEG-05 |
| Moeda do Valor do Negócio; Fila da Conversa; Origem do Contato automático | Padrão inicial copiado na criação; não acompanha mudanças posteriores | RN-ET-15/16; RN-CXE-07 |
| "Criado a partir de" (Negócio de Conversa/Contato/Empresa/Negócio; Funil por cópia) | Proveniência sem vínculo vivo | RN-NEG-24; DO-FUN-14 |

## 17. Permissões e visibilidade

Toda entidade do CRM com identidade é Recurso da tupla (Sujeito, Ação, Recurso, Escopo, Origem) (A9.1). Origens: Papel, concessão direta, compartilhamento; **sem** origem "herança de contêiner pai" (não há pai). Escopos: `registro` e `próprios` (B29); `subárvore` não se aplica a nenhum Recurso do CRM (a hierarquia matriz/filial e o Funil não são contêineres — DO-EMP-12; 13, 17.1). Agentes e Automações são Sujeitos às mesmas regras (A6.3), avaliadas a cada Ferramenta (B23).

| Recurso | `próprios` resolve para | Privatizável? | Quem administra | Governança só por Papel (RN-ET-24) | Fonte |
| --- | --- | --- | --- | --- | --- |
| Contato | Proprietário, Criador | Não | `administrar`: transferir Proprietário, mesclar, eliminar por titular, compartilhar | Configurar catálogos | DO-CON-16 |
| Empresa | Proprietário, Criador | Não | `administrar`: compartilhar, transferir, mesclar (em ambas) | Configurar catálogos | DO-EMP-12; DO-EMP-13 |
| Negócio | Proprietário, Criador | Não por si; **filtrado pelo Funil privado** (interseção com `ver` no Funil) | `administrar`: transferir, trocar Empresa de encerrado, compartilhar | Reabrir `ganho`; configurar catálogos | RN-NEG-19/20; DO-FUN-10 |
| Funil | — (não se aplica) | **Sim**, exceto o Funil padrão (B38 aplicado: interrompe "papel" inclusive para Administradores; ao menos um Membro `ativo` com `administrar`; RN-FUN-16) | `administrar`: Etapas, Requisitos, Transições, Regras, privacidade, concessões | Criar, excluir, definir padrão | DO-FUN-10; RN-FUN-17 |
| Caixa de Entrada | — | Não | `administrar`: prazo, distribuição, padrões, Horário | Tudo | 14, 17.1 |
| Canal | — | Não | Papel (gerir Integrações) | Conectar, arquivar | RN-CXE-03 |
| Fila | — | Não | `administrar` (concedível a Membros e Equipes): elegíveis, regra, limite, atribuir/transferir qualquer Conversa | Criar, excluir | DO-CXE-19 |
| Conversa | Atribuído, Criador | Não | `administrar`: atribuir a terceiros, mover para outro Contato, marcar exclusão de Mensagem | — | 14, 17.1 |

**Padrão recomendado** (documento 01, 17.2, adotado pelos cinco documentos): o Papel Membro vê e edita todos os Contatos, Empresas e Negócios (escopo `registro`) e vê e edita as Conversas das Filas de que é elegível e as sem Fila (**elegibilidade de Fila como origem de permissão** — DO-CXE-19, candidata a decisão B); Administrador e Proprietário do ET têm também `excluir` e `administrar`; Convidado nada vê por Papel. Restrição ("vendedor vê só os seus") é Papel personalizado com `próprios`; "da minha Equipe" não é expressável (questão 1 do doc. 10; reforçada pelos docs. 12 e 14). Ver um registro não concede ver os vinculados (RN-CRM-12). Painéis filtram pelo visualizador (B20).

**IA sujeita às mesmas regras.** Agente nunca recebe `administrar` sobre Funil, Fila, Canal ou Caixa nem cria Funil (RN-FUN-17; 14, 17.2); ser Atribuído não concede `ver`, exige-o (INV-CXE-12); um Agente sem `ver` não recebe o registro no Contexto nem por Ferramenta, ainda que a Sessão esteja ancorada nele (10, 17.4; 12, 17.4; 14, 17.4). Ações que geram Solicitação de Aprovação em `supervisionado` (lista consolidada em **B64**, decidida por Ferramenta e classe de efeito — B77): enviar Mensagem a Contato (`externa`); mesclar, marcar `ganho`/`perdido`, enviar à lixeira, marcar exclusão de Mensagem, mover Conversa entre Contatos, trocar Empresa de Negócio encerrado (`escrita irreversível`); criação em lote acima do Limite de operações por Execução exige aprovação em qualquer nível, com motivo `limite` (DO-CON-13; DO-AUT-18). Toda Solicitação tem Tempo limite padrão de 72 horas (B80). Origem: DO-CON-13; DO-NEG-11; RN-EMP-16; RN-CXE-12.

**Exceções.** Não há exceção ao isolamento. O Sistema cria e restaura Contatos, cria e reabre Conversas, resolve por mesclagem, libera Atribuídos, reenvia `pendente` e remapeia Negócios sem Sujeito de permissão: ação do Sistema, registrada (10, 17.5; 12, 17.5; 14, 17.5).

## 18. Eventos relevantes

Tabela consolidada dos eventos do domínio, agrupados por entidade emissora e apontando o documento fonte (onde estão os dados essenciais completos). Todos geram Registro de Atividade com Ator e ator delegante (A6.2). Os marcados como **derivado** não são eventos: são condições avaliadas por Gatilho de agendamento (DO-FUN-12; DO-NEG-14).

| Entidade | Eventos | Consumidores prováveis | Fonte |
| --- | --- | --- | --- |
| Contato | criado (por Modo); atualizado; Identificador adicionado/removido/verificado/principal/transferido; Vínculo Contato-Empresa criado/alterado/encerrado/removido; Vínculo Contato-Negócio/Tarefa criado/removido; Proprietário transferido; Qualificação alterada; Origem alterada; Consentimento registrado; Tag; Comentário; Valor de Campo; arquivado/restaurado; restaurado por Mensagem recebida; lixeira/restaurado; Suspeita de Duplicidade detectada/descartada; mesclados; desdobrado de mesclagem; eliminado; anonimizado; Limite de Contatos atingido | Caixa de Entrada (resolução, reapontar); Automações (boas-vindas, qualificação, "cliente antigo voltou"); Painéis (aquisição, qualidade de dados); Negócios, Tarefas, Sessões | 10, 18 |
| Empresa | criada; atualizada; Identificador adicionado/removido/verificado/principal; Sugestão de Vínculo emitida/aceita/rejeitada; Contato vinculado/desvinculado/papel/principal; Vínculo Empresa-Empresa criado/removido; matriz definida/alterada/removida; Proprietário transferido; Tag; Comentário; Vínculo com Tarefa; Negócio passou a/deixou de referenciar; arquivada/desarquivada; lixeira/restaurada/eliminada/eliminação adiada; mescladas; lixeira/matriz rejeitadas | Automações (aceite de Sugestão); Painéis (grupo econômico); Contato; Negócio; auditoria | 11, 18 |
| Negócio | criado; entrou em Etapa / saiu de Etapa (com Ordem à época e avanço/retrocesso derivado); movido de Funil; remapeado; Valor alterado; probabilidade sobrescrita/descartada; ganho; perdido; reaberto; encerramento/transição/reabertura rejeitados; Proprietário alterado (transferência, sucessão); Contato vinculado/desvinculado/papel/principal; Contato substituído por mesclagem; Empresa definida/alterada/removida; Tarefa/Conversa/Documento/Negócio vinculado ou desvinculado; Comentário, Anexo, Tag, Valor de Campo; arquivado/restaurado/lixeira/restaurado/eliminado; restauração rejeitada; **derivados**: parado em Etapa há X, previsão vencida, sem próxima atividade | Automações com escopo Funil e ET (pós-venda, reengajamento, Integrações de pedido); Painéis (receita, conversão, tempo em Etapa); Agentes; Empresa (linha do tempo); Tarefas e Conversas (Vínculos) | 12, 18 |
| Funil / Etapa | Funil criado; alterado; arquivado/restaurado/lixeira/restaurado/eliminado (com mapeamento de Etapas na migração); Funil padrão alterado; tornado privado/público; permissão concedida/revogada; Etapa criada/alterada/reordenada; Requisitos ou Transições alterados; Etapa removida com remapeamento (evento único agregado); transição rejeitada | Automações (inoperante/reativar; prever rejeições); Painéis (probabilidade, ordem, Widget inválido); Negócio (migração); auditoria | 13, 18 |
| Caixa de Entrada / Canal / Fila | Canal conectado/desconectado/com erro/reconectado; arquivado/reativado; mensagens de modelo sincronizadas; Fila criada/alterada/arquivada/restaurada/excluída (com transferência agregada); elegíveis alterados; Disponibilidade de atendimento alterada (Membro); Fila sem capacidade | Administradores; reenvio de `pendente`; distribuição; permissões (DO-CXE-19); Painéis | 14, 18 |
| Conversa | criada (por origem); atribuída/transferida entre Atendentes/liberada; transferida entre Filas; estado de conversa alterado; reaberta; adiada/adiamento vencido; Contato principal reapontado/substituído por Marcador/movido; resolvida por mesclagem; sem Contato resolvido (Limite); Vínculo com Negócio/Tarefa criado/removido; Tarefa/Negócio criado a partir da Conversa; Tag; Valor de Campo; lixeira/restaurada/eliminada; Rascunho gerado por Agente; **derivados**: sem resposta há X, fora do horário, janela expirada | Automações com escopo Caixa e Fila (triagem, pesquisa de satisfação, resposta fora do horário); Painéis (tempo de resposta, carga, reincidência); Agentes; Negócio e Tarefa; Contato e Empresa (linha do tempo) | 14, 18 |
| Mensagem | recebida (Gatilho principal da Caixa); enviada/entregue/lida/falhou; interna registrada (menções); marcada como excluída; editada pelo remetente externo; Contato criado automaticamente por Mensagem | Automações; Agentes; notificação ao Atribuído e a mencionados; Painéis (entrega); Contato (criação, restauração) | 14, 18 |
| Consumidos de outros domínios | Membro removido/suspenso (liberar Atribuídos, suceder Proprietários, limpar padrões, retirar elegíveis); Espaço de Trabalho suspenso/reativado (parar distribuição e envio; distribuir persistidas); Definição de Campo removida (Valores e Requisitos removidos); Tarefa concluída/alterada (próxima atividade; linha do tempo) | Caixa de Entrada; Contato; Empresa; Negócio; Funil | 01, 18; 06, 18 |

Eventos que **outros domínios precisam consumir** para manter invariantes do CRM: "Contatos mesclados" e "Contato eliminado" (INV-CON-11; INV-CXE-04), "Membro removido" (INV-ET-03; RN-CXE-24), "Etapa removida" e "Funil arquivado" (INV-FUN-06/07), "Empresa mesclada" (INV-EMP-07).

## 19. Dependências

**O CRM depende de:**

- **Espaço de Trabalho** (documento 01): pertencimento e composição (Caixa); Membros (Proprietário, Atribuído, elegíveis, Membro configurador); Equipes (elegíveis, Sujeitos); Papéis (governança de catálogos, Funis, Canais, Filas; reabrir `ganho`); catálogos (seção 15); Localidade (moeda do Valor, fuso do Horário de atendimento e das Datas, idioma de exibição); Política de lixeira; Limites impostos (Contatos, Canais, armazenamento); sucessão (B28); regra de contêineres privados aplicada ao Funil (B38); Integração como base do Canal (7.4); Registros de Atividade; Arquivos (A8).
- **Plataforma** (A1.3): Tipos de Canal e Capacidades, Tipos de Identificador, Tipos de Campo, provedores externos (identificadores externos, status de entrega, aprovação de modelos — fora da ontologia).
- **Estrutura de Trabalho** (documento 06): Vínculo Tarefa ↔ Contato/Empresa/Negócio/Conversa (DO-TAR-08); "criar Tarefa a partir de" (12.1; B49); modelo de Comentário (DO-TAR-07); "próxima atividade" (DO-NEG-14).

**Dependem do CRM:**

- **IA** — Agentes (17): Atribuído de Conversa, invocado pela Caixa de Entrada a cada Mensagem `recebida` sem delegante (RN-AGE-14) ou por Automação com a Automação como delegante (DO-AUT-15); Ferramentas sobre Contato, Empresa, Negócio, Conversa; Rascunho; escalonamento; RN-CXE-12/19/20/23; DO-CON-13; DO-NEG-11; aprovações de B64. Automações (19): escopos Funil, Caixa de Entrada e Fila (B41; DO-CXE-16); Gatilhos da seção 18; Limite de operações por Execução (RN-CON-20; DO-AUT-18). Chat (16): âncoras em Contato, Empresa, Negócio e Conversa (B21; B83; DO-EMP-14); Rascunho a partir de Sessão (DO-CXE-15). Conhecimento (20): Vínculo Negócio ↔ Documento; Conversas **não** são Conhecimento (B19); a eliminação de Contato marca para revisão de curadoria os Documentos vinculados (B99).
- **Painéis** (21): Fontes de Dados (Contatos, Empresas e grupo econômico, Negócios de um Funil, Conversas de Fila/Canal/Caixa); derivados (valor ponderado, conversão por Etapa com Ordem à época — DO-FUN-13 —, tempo de primeira resposta, Última interação); decididas para Painéis a conversão de moeda (DO-PAI-13: uma série por moeda; resta a configuração de câmbio em C22) e a categoria de Qualificação (21, 20.17: Filtro do editor; C23 segue aberta para Automações e Agentes); pendência de dias úteis (C12).
- **Espaço de Trabalho** (01) recebe ampliações registradas pelos cinco documentos: Funil padrão no ato de criação e como atributo (DO-FUN-09); Identificador legível de Negócios (DO-NEG-02); catálogos Motivos de Ganho, Definições de Qualificação, Finalidades de Consentimento (DO-NEG-06; DO-CON-05; DO-CON-06); Definições de Campo pré-definidas de Empresa e Motivo de Perda "Duplicado" instanciados na criação (DO-EMP-10; DO-NEG-12); Disponibilidade de atendimento como objeto de valor do Membro (DO-CXE-14); Origem aplicável a Empresa (DO-EMP-09); cardinalidade ET → Funil 1..N.

**Ordem de leitura recomendada** para implementar sem inventar conceitos: 01 → 09 (este) → 10 → 11 → 13 → 12 → 14; o documento 12 depende de 13 (Funil e Etapa) e o 14 depende de 10 (resolução, mesclagem, Marcador).

## 20. Casos limítrofes e ambiguidades

Cenários transversais — que envolvem duas ou mais entidades do CRM — resumidos, com o documento e a seção que os resolvem. Os cenários internos a uma entidade estão nos respectivos documentos (seção 20).

| Cenário | Resolução | Onde |
| --- | --- | --- |
| Mensagem de número desconhecido | Contato, Identificador, Conversa e Mensagem no mesmo ato; Proprietário Fila → Canal → Caixa → Proprietário do ET; Origem do Canal; sem "Contato provisório" | 10, 20.5; 14, 20.1; DO-CON-08; DO-CXE-05 |
| Limite de Contatos atingido na chegada de Mensagem | Conversa `aberta` com marcador "não resolvido", sem distribuição; associação manual ou capacidade; exceção temporária a B12 | RN-CON-12; DO-CXE-25 |
| Contato `arquivado` ou `na lixeira` recebe Mensagem | Volta a `ativo` no mesmo ato; Conversa criada ou reaberta; evento próprio | DO-CON-15; 10, 20.12 |
| Mesclagem de Contatos com duas Conversas não resolvidas no mesmo Canal | A de Mensagem mais recente permanece; a outra `resolvida` com causa "mesclagem"; nenhuma Mensagem movida | DO-CXE-21; 14, 20.17; 10, 25.5 (resolvida) |
| Contato mesclado que é principal de Negócio `ganho` | Vínculo migra ao sobrevivente; Negócio não muda; Vínculos duplicados colapsam | 10, 20.7; 12, 20.6 |
| Pedido de eliminação de dados (LGPD) com Negócios e Conversas | Contato e agregado eliminados; Negócios permanecem sem Vínculo; Conversas permanecem com Marcador e Mensagens anonimizadas; subordinado a C9 | DO-CON-10; 10, 20.8; 14, 20.21 |
| Conversa cujo Contato foi eliminado, ainda `aberta` | Permanece `aberta` (trabalho pendente) com Marcador; nova Mensagem do antigo Identificador cria Contato e Conversa novos | 14, 20.21 |
| Identificador transferido entre Contatos com Conversa aberta | Só a resolução futura muda; a Conversa fica com a origem; "mover Conversa" é ato separado sujeito a INV-CXE-03 | DO-CON-12; RN-CXE-11; 10, 20.14 |
| Contato em duas Empresas; muda de Empresa | Dois Vínculos vigentes, um principal; mudar é encerrar (fim) e criar outro; Negócios não mudam de Empresa | DO-CON-02; 10, 20.2 e 20.9 |
| Profissional autônomo (pessoa e PJ) | Contato e Empresa distintos, vinculados; nunca unificação | DO-EMP-13; 11, 20.10 |
| Caixa genérica da organização externa (`contato@`, recepção) | É um Contato vinculado à Empresa; a Conversa é com ele; Empresa nunca resolve Mensagens | DO-EMP-03; DO-EMP-08; 11, 7.1 |
| E-mail com cinco pessoas em cópia | Endereços adicionais da Mensagem; não são Participantes nem Contatos; resposta de um copiado cria Conversa própria | DO-CXE-13; 14, 20.3 |
| Agente cria Empresa a partir do domínio do e-mail do Contato | Permitido com `criar` e `ver`; Vínculo é ato do Agente, nunca inferência; provedor público rejeitado | DO-EMP-04; 11, 20.12 |
| Empresa à lixeira com Negócios `aberto` | Rejeitado com a lista; o ator fecha, move, limpa a referência ou envia o Negócio à lixeira; arquivar é livre | DO-EMP-11; 11, 20.7; 12, 20.3 |
| Negócio `na lixeira` e o Funil / a Empresa mudam entretanto | Participa de remapeamentos (Etapa sempre existe); restauração de `aberto` rejeitada se a Empresa está `na lixeira`/`mesclado` ou o Funil `arquivado` sem resolução no ato | DO-NEG-09; 12, 20.12; RN-NEG-18 |
| Negócio `perdido` reaberto em Funil `arquivado` | Só com mudança para Funil `ativo` e Etapa explícita no mesmo ato; dois Registros | RN-FUN-14; 13, 20.3; 12, 20.4 |
| Negócio movido para Funil privado cujo Proprietário não vê | Rejeitado salvo concessão de `ver` ou transferência de propriedade no ato; na sucessão, concessão automática ao Sucessor | DO-NEG-10; 12, 20.13; 13, 25.5 (resolvida) |
| Etapa chamada "Ganho" criada no Funil | Etapa de progressão comum; Negócio continua `aberto`; ganhar é ato explícito ou Automação | RN-FUN-20; 13, 20.12; 12, 20.18 |
| Etapa removida com 300 Negócios | Remapeamento atômico para Etapa do mesmo Funil, sem Requisitos, evento único agregado, sem "entrou em Etapa" | RN-FUN-10; 13, 20.4 |
| Automação move ou ganha Negócio violando Requisito ou Regra | Ação rejeitada; Execução `falhou`; nenhum efeito parcial; a Automação não "preenche para passar" | 13, 20.8; 12, 20.10 |
| Conversa vinculada a dois Negócios; Negócio com trinta Conversas | Ambos válidos (0..N nos dois lados); nenhum contém o outro | 14, 20.4; 12, 20.14 |
| Agente Atribuído transferido para humano no meio da resposta | Execução `cancelada`; texto parcial vira Rascunho; nada parcial é enviado | 14, 20.7 |
| Mensagem fora da Janela de resposta; Canal desconectado com `pendente` | Só Mensagem de modelo; `pendente` reenviadas na reconexão com validade, senão `falhou` com motivo | RN-CXE-19; DO-CXE-18; 14, 20.9 e 20.12 |
| Espaço de Trabalho suspenso recebendo Mensagens | Persistidas sem distribuição, Automação, Agente ou resposta; distribuídas na reativação; nada retroativo | B31; RN-CXE-27; 14, 20.10 |
| Atendente / vendedor removido do Espaço de Trabalho | Contatos, Empresas e Negócios ao Sucessor; Conversas liberadas e redistribuídas; sem Sucessor de Conversas | 10, 20.13; 11, 20.11; 12, 20.13; 14, 20.11 |
| Mesma pessoa em dois Canais Instagram; dois números no mesmo Canal | Dois Identificadores; uma Conversa por (Contato, Canal); dois números no mesmo Canal caem na mesma Conversa | 10, 20.3 e 20.16; 14, 20.6 |
| Grupo de WhatsApp | Identificador de grupo; Contato principal = primeiro remetente; Participantes adicionais; INV-CXE-03 não se aplica; regras completas em C5 | DO-CXE-22; 14, 20.18 |
| Contato que também é Membro; a própria organização como Empresa | Dois registros sem ligação; nenhuma inferência | A1.4; 10, 20.10; 11, 20.1 |
| Negócio duplicado | Sem mesclagem; encerrar como `perdido` "Duplicado" e vincular `relacionado a` | DO-NEG-12; 12, 20.15 |

## 21. O que explicitamente NÃO pertence ao CRM

Resultado do teste de exclusão aplicado ao domínio: o que parece do CRM, mas pertence a outro domínio ou a outra entidade.

| Parece pertencer ao CRM | Pertence a | Por quê |
| --- | --- | --- |
| Tarefas "do Contato", "do Negócio", "da Conversa" (ligação, reunião, proposta) | Lista (Estrutura de Trabalho) | Vínculo, nunca contenção (A2.2; DO-TAR-08). Atividade de CRM como entidade é D4. |
| Responsável, status, prioridade, Registro de Tempo | Tarefa | Ninguém no CRM tem Responsável nem Status (A7; A4.2). |
| Membro, Usuário, Equipe | Espaço de Trabalho / plataforma | Contato ≠ Membro ≠ Usuário (A1.4); Equipe agrupa Membros, Fila agrupa Conversas. |
| Catálogos (Origens, Motivos, Qualificações, Finalidades, Tags, Definições de Campo, Funis como catálogo) | Espaço de Trabalho | Configuração com identidade, definida uma vez (B34; RN-ET-13). O CRM só referencia. |
| Tipos de Canal, Capacidades, Tipos de Identificador | Plataforma | A1.3; nunca contidos. |
| Sessão de Chat ancorada; Mensagens de Chat; Memória do Agente sobre um Contato | Membro / Agente (IA) | B21; B78 (a Memória do Agente pode reter fatos sobre Contatos; Itens eliminados com a eliminação permanente do Contato — RN-AGE-23); C7. O único caminho para a Conversa é o Rascunho (DO-CXE-15). |
| Agentes, Automações e suas Execuções | IA | O CRM é objeto e escopo; nunca contém (B18; B41). |
| Ferramentas de CRM (criar Contato, enviar Mensagem, mover Negócio) | Catálogo da plataforma (B16) | Operações expostas a Agentes; não são entidades do CRM. |
| Coleções, Documentos de Conhecimento, Fragmentos | Conhecimento (IA) | Registros do CRM não são Conhecimento (B19); Negócio ↔ Documento é Vínculo. |
| Painéis, Widgets, Métricas (receita, conversão, tempo de resposta, carga) | Painéis | Derivados nunca gravados no CRM (B20; DO-FUN-12; RN-NEG-23). |
| Arquivos (Foto, Anexos, evidências) | Espaço de Trabalho (Arquivo) | A8; o CRM referencia por Anexo ou atributo. |
| Registros de Atividade, linhas do tempo, Registro de transição | Espaço de Trabalho (Registro de Atividade); visões derivadas | INV-ET-12; 12, 7.6; 10, 8.1. |
| Integrações que não são Canais (ERP, calendário, assinatura) | Espaço de Trabalho | Só Canais estão na Caixa (14, 4). |
| Horário comercial / semana de trabalho | Espaço de Trabalho (C12) | A Caixa tem Horário de atendimento como provisório (DO-CXE-06). |
| Disponibilidade de atendimento | Membro | DO-CXE-14. |
| Produto, catálogo, itens, preço; Proposta, Contrato; Pedido, fatura, comissão, meta | D2, D3, D7 (futuras) ou fora da ontologia | B10; 12, 4 e 21. |
| Portal do cliente; Contato como Convidado | C2 / D9 | Exigiria ligação Usuário ↔ Contato, hoje proibida (RN-CON-23). |
| "Administrar o CRM" como Recurso | Não existe | O CRM é domínio, não entidade (documento 01, 7.7). |

## 22. Exemplos conceituais

**Exemplo 1 — Uma pessoa, cinco entidades, três domínios.** Uma Mensagem chega ao Canal WhatsApp "Recepção" da Clínica Vida de um número desconhecido. No mesmo ato nascem o Contato "Camila S." (Não identificado; Proprietária Ana, configurada na Fila "Recepção Centro"; Origem "WhatsApp orgânico", do Canal), o Identificador `identidade de WhatsApp`, a Conversa `aberta` na Fila e a Mensagem `recebida`; o rodízio atribui a Marina. Marina preenche Nome e Sobrenome, registra Consentimento `atendimento` e, a partir da Conversa, cria o Negócio "Pacote de 10 sessões — Camila" (NEG-0088): Funil padrão "Novos pacientes", Etapa "Novo", Vínculo Conversa-Negócio, Vínculo Contato-Negócio (`decisor`, principal), Empresa vazia, Proveniência "criado a partir de Conversa". A Automação do Funil "ao entrar em Proposta, criar Tarefa 'Enviar proposta' na Lista Propostas" cria a Tarefa vinculada ao Negócio e ao Contato — a Tarefa vive na Lista, com Responsável Marina; o Negócio não tem Responsável. A Conversa é `resolvida`; Camila responde no dia seguinte e, dentro das 72 h, a mesma Conversa reabre. Dez dias depois o Negócio é `ganho` em "Negociação" (última Etapa preservada; Regra "exigir valor" satisfeita); uma Automação muda a Qualificação de Camila para "cliente" e outra cria o Negócio "Retorno — Camila" no Funil "Retorno de pacientes", novo, com Proveniência. O Painel "Receita por Origem" conta o NEG-0088 em "WhatsApp orgânico"; o Painel "Tempo de primeira resposta por Fila" lê os derivados da Conversa. Em nenhum momento uma entidade conteve outra: Contato, Conversa, Negócio e Tarefa ligaram-se por referência e Vínculo.

**Exemplo 2 — B2B com grupo econômico, Funil privado e sucessão.** A Empresa "Gama Varejo" (matriz "Holding Gama"; Identificadores CNPJ e domínio `gamavarejo.com.br`; Proprietário João) tem Marta como Contato principal da Empresa (Vínculo com papel "diretora de compras"). Rita, `rita@gamavarejo.com.br`, escreve pelo Canal E-mail com quatro pessoas em cópia: a Conversa é com Rita (Contato criado automaticamente, com Sugestão de Vínculo à Gama Varejo pelo domínio, aceita por João); os copiados são Endereços adicionais, não Participantes. João cria o Negócio "Licenças 2027 — Gama Varejo" com cinco Contatos em papéis distintos, um deles consultor da Beta (a Empresa do Negócio continua sendo uma só). A Proprietária do Espaço de Trabalho move o Negócio para o Funil privado "Contas estratégicas"; João não tem `ver` nele, e a operação exige transferir a propriedade a Lia ou conceder `ver` a João no ato — ela concede. João é removido meses depois: os seus 40 Contatos, 12 Empresas e 7 Negócios passam à Sucessora Carla no mesmo ato, com `ver` sobre o Funil privado concedido automaticamente; as 9 Conversas de que era Atribuído são liberadas e redistribuídas pelas Filas; nenhuma Conversa, Fila ou Funil é sucedido, porque nenhum tem Proprietário. O Painel "Valor em aberto do grupo Gama" soma os Negócios de todas as Empresas com raiz "Holding Gama" — só os que a visualizadora vê.

## 23. Representação gráfica textual

### 23.1 Grafo conceitual completo do CRM

Legenda: `│`, `├──`, `└──` = **contenção** (o filho não existe sem o pai); `──` / `◄──►` = **associação ou referência** (cada lado existe sem o outro); `⋯` = **derivação** (nunca gravada). Cardinalidades como origem → destino.

```
PLATAFORMA (referenciada; nunca contida)
└── Tipo de Canal (4; Capacidades) · Tipo de Identificador · Tipo de Campo

ESPAÇO DE TRABALHO  [raiz; Localidade; Política de lixeira; Limites impostos; Funil padrão (ref. 1)]
│
├── Governança (doc. 01): Membro (1..N) [Disponibilidade de atendimento] · Equipe · Papel · Integração (não Canal)
│         ▲ Proprietário (1) de Contato, Empresa, Negócio        ▲ Atribuído (0..1) de Conversa ── também Agente
│         ▲ elegíveis (0..N) de Fila                              ▲ Membro configurador de Canal
│
├── Catálogos (contenção no ET; referência no CRM)
│   ├── Origem (0..N) ─────────────── Contato · Empresa · Negócio · Origem padrão de Canal
│   ├── Definição de Qualificação (0..N) ── Contato
│   ├── Finalidade de Consentimento (0..N) ── Consentimento
│   ├── Motivo de Perda (0..N) · Motivo de Ganho (0..N) ── Negócio; Regra de encerramento do Funil
│   ├── Tag (0..N) ── Contato · Empresa · Negócio · Conversa (N:N)
│   └── Definição de Campo por entidade-alvo (0..N) ── Valores de Campo; Requisito de Etapa
│
├── CONTATO (0..N)  [ativo | arquivado | na lixeira | mesclado; Proprietário 1; Qualificação 0..1; Origem 0..1]
│   ├── Identificador de Contato (0..N)  [único no ET por (Tipo, Valor); principal ≤1 por Tipo]  ◄── Mensagem `recebida` (por onde chegou)
│   ├── Consentimento (0..N, histórico só acréscimo) · Endereço (0..N) · Comentário (0..N) · Valor de Campo (0..N)
│   ├── Mesclado em ── Contato sobrevivente (0..1; só em `mesclado`) + Estado pré-mesclagem
│   ├── ◄──► Vínculo Contato-Empresa (0..N) [papel/cargo; principal do Contato ≤1; principal da Empresa ≤1; início; fim] ◄──► EMPRESA
│   ├── ◄──► Vínculo Contato-Negócio (0..N) [papel de catálogo; principal ≤1 por Negócio; ≤1 por par] ◄──► NEGÓCIO
│   ├── ◄──► Vínculo `distinto de` (0..N, simétrico) ◄──► Contato
│   ├── ◄──► Vínculo (0..N) ◄──► TAREFA (Estrutura de Trabalho)
│   ├── ◄── Contato principal (1) de CONVERSA (0..N)   ◄── Participante `contato`
│   └── ⋯ Nome de exibição · Cargo de exibição · Empresa principal · Última interação · linha do tempo · Suspeita de Duplicidade
│
├── EMPRESA (0..N)  [ativo | arquivado | na lixeira | mesclado; Proprietário 1; Origem 0..1]
│   ├── Identificador de Empresa (0..N)  [domínio | documento fiscal | telefone; único no ET; nunca resolve Mensagens]
│   ├── Endereço (0..N) · Comentário (0..N) · Valor de Campo (0..N; Segmento, Porte, Setor pré-definidas) · Anexo → Arquivo
│   ├── Empresa matriz ── Empresa (0..1; floresta acíclica; sem contenção, sem herança)  ⋯ filiais · raiz do grupo
│   ├── ◄──► Vínculo Empresa-Empresa (0..N) [parceira | concorrente | fornecedora de/cliente de | outro] ◄──► Empresa
│   ├── ◄──► Vínculo (0..N) ◄──► TAREFA
│   ├── ◄── referenciada por NEGÓCIO (0..N)  [bloqueia lixeira se `aberto`; adia eliminação]
│   ├── Mesclada em ── Empresa sobrevivente (0..1)
│   └── ⋯ Contato principal · Conversas da Empresa (via Contatos vinculados) · linha do tempo · agregações de grupo
│
├── FUNIL (1..N)  [ativo | arquivado | na lixeira; Privado; Regras de encerramento; Criador; SEM Proprietário]
│   ├── ETAPA (1..N)  [identidade estável; ordem total; probabilidade padrão; sem estado]
│   │   ├── Requisito de Etapa (0..N; entrada | saída; tipo) ── Definição de Campo (Negócio)
│   │   └── Transições permitidas (0..N; vazio = todas)
│   ├── ◄── referenciado por NEGÓCIO (0..N)  — percorre; NÃO pertence
│   ├── ◄── escopo de AUTOMAÇÃO (0..N) · Fonte de Dados de WIDGET
│   └── ⋯ Etapa inicial · É o Funil padrão · conversão · tempo em Etapa
│
├── NEGÓCIO (0..N)  [situação: aberto | ganho | perdido ⊥ estado: ativo | arquivado | na lixeira; Proprietário 1; SEM Responsável]
│   ├── ── Funil (1, substituível) · ── Etapa (1, por identidade; atual ou última)
│   ├── ── Empresa (0..1, referência unilateral; só `ativo` ao definir)
│   ├── Valor (0..1: quantia, moeda) · Probabilidade sobrescrita (0..1) · Motivo de Perda/Ganho (0..1) · Nota · Data prevista · Origem (0..1)
│   ├── Valor de Campo (0..N) · Comentário (0..N) · Anexo → Arquivo (0..N) · Tag (N:N) · Proveniência (0..1)
│   ├── ◄──► Vínculo Contato-Negócio ◄──► CONTATO (0..N)
│   ├── ◄──► Vínculo Conversa-Negócio ◄──► CONVERSA (0..N)
│   ├── ◄──► Vínculo ◄──► TAREFA (0..N) · DOCUMENTO DE CONHECIMENTO (0..N) · Negócio `relacionado a` (0..N)
│   ├── ◄── Registro de Atividade de transição (Etapa por identidade, nome e Ordem à época; origem da entrada)
│   └── ⋯ probabilidade efetiva · valor ponderado · dias em Etapa · idade · próxima/última atividade · previsão vencida
│
└── CAIXA DE ENTRADA (1, composição; SEM Proprietário; sem estado próprio)
    │   Prazo de reabertura · Distribuição padrão · Proprietário padrão de Contatos (0..1) · Horário de atendimento
    ├── CANAL (0..N)  [Integração especializada; Tipo de Canal 1 imutável; conexão: conectada | desconectada | com erro;
    │   │              ciclo: ativo | arquivado (sem lixeira); Membro configurador; SEM Proprietário]
    │   ├── ── Fila padrão (0..1) · ── Proprietário padrão de Contatos (0..1) · ── Origem padrão (0..1)
    │   ├── Configuração de mensagens de modelo (obj. valor) · Grupos habilitados
    │   └── ◄── Canal de origem de Identificador de Contato (0..N)
    ├── FILA (0..N)  [ativo | arquivado | na lixeira; nome único; Criador; SEM Proprietário]
    │   ├── ── elegíveis (Membros, Equipes; 0..N) ⋯ elegíveis efetivos (filtrados por Disponibilidade)
    │   ├── Regra de distribuição · Limite por Atendente · Proprietário padrão de Contatos (0..1) · Horário (0..1)
    │   ├── ◄── referenciada por CONVERSA (0..N, mutável por transferência) — NÃO contém
    │   └── ◄── escopo de AUTOMAÇÃO (0..N)
    └── CONVERSA (0..N)  [estado de conversa: aberta | pendente | resolvida; ciclo: ativo | na lixeira (sem arquivado);
        │                  Canal 1 imutável; Contato principal 1; Fila 0..1; Atribuído 0..1 (Membro | Agente); SEM Proprietário]
        ├── PARTICIPANTE (1..N)  [Contato | Membro | Agente; contato (1 principal, 0..N adicionais em grupo) | atendente | agente | observador]
        ├── MENSAGEM (1..N; imutável)  [recebida | enviada | interna; Ator 1; Remetente → Participante 0..1;
        │   │                            status de entrega (só enviada): pendente | enviada | entregue | lida | falhou]
        │   ├── ANEXO (0..N) ── Arquivo do ET (1)
        │   ├── Em resposta a ── Mensagem da mesma Conversa (0..1) · Mensagem de modelo usada (0..1) · identificador externo
        │   └── Endereços adicionais (E-mail; obj. valor; não Participantes) · Leitura interna · Reações · Marcação de exclusão
        ├── Valor de Campo (0..N) · Tag (N:N) · Adiamento (0..1; só pendente) · Rascunho (0..N; um por Ator interno)
        ├── ◄──► Vínculo Conversa-Negócio ◄──► NEGÓCIO (0..N) · ◄──► Vínculo ◄──► TAREFA (0..N)
        ├── ◄── âncora de SESSÃO DE CHAT (lê; produz Rascunho; nunca envia)
        └── ⋯ Empresa (do Contato principal) · Título · primeira resposta · tempo de espera · janela de resposta aberta até

Invariantes centrais: (Tipo, Valor) de Identificador → ≤1 Contato não mesclado · (Contato, Canal) → ≤1 Conversa não resolvida ·
Negócio → exatamente 1 Funil e 1 Etapa dele · Contato/Empresa/Negócio → exatamente 1 Proprietário · nenhuma aresta cruza o ET.
Resolução de padrões (derivação, não herança): Fila → Canal → Caixa de Entrada → Proprietário do Espaço de Trabalho.
```

### 23.2 Grafo reduzido: as sete relações que sustentam o CRM

```
            Vínculo Contato-Empresa (N:N; cargo; principal ×2)
   CONTATO ◄──────────────────────────────────────────────► EMPRESA
      ▲ ▲                                                       ▲
      │ │ Vínculo Contato-Negócio (N:N; papel; principal)       │ referência 0..1
      │ └──────────────────────────────────────► NEGÓCIO ───────┘
      │                                              │
      │ Contato principal (1)                        │ percorre (referência 1; substituível)
      │                                              ▼
   CONVERSA ◄──── Vínculo Conversa-Negócio ────►   FUNIL ├── ETAPA (contenção 1..N)
      ▲                    (N:N)
      │ contenção (0..N)
   CAIXA DE ENTRADA ├── CANAL (0..N) ── referenciado pela Conversa (1, imutável)
                    └── FILA (0..N) ── referenciada pela Conversa (0..1, mutável)

   1. Caixa de Entrada ─contém─► Conversa (e Conversa ─contém─► Mensagem)     contenção     (B11; DO-CXE-01; INV-CXE-05)
   2. Conversa ─é com─► Contato principal (1)                                   referência    (B12; DO-CON-09)
   3. Contato ◄─Vínculo─► Empresa (N:N, cargo, principal)                       associação    (B8; DO-CON-02; DO-EMP-05)
   4. Contato ◄─Vínculo─► Negócio (N:N, papel, principal)                       associação    (B9; DO-NEG-03)
   5. Negócio ─referencia─► Empresa (0..1)                                      referência    (B9; DO-NEG-07)
   6. Negócio ─percorre─► Funil (1) ─contém─► Etapa (1..N)                      ref. + cont.  (DO-FUN-01; INV-FUN-06)
   7. Conversa ◄─Vínculo─► Negócio (N:N)                                        associação    (DO-NEG-13; doc. 14, 8.4)

   Toda entidade do CRM ◄─Vínculo─► Tarefa (associação; A2.2; DO-TAR-08) — a única aresta para a Estrutura de Trabalho.
```

## 24. Decisões ontológicas

Este documento **não toma decisões novas**. Consolida as decisões estruturantes já tomadas pela constituição e pelos documentos 10–14, para que a MATRIZ-DE-RELACOES.md e os documentos de IA e Painéis as referenciem por um único ponto. Cada item aponta a origem; o status é o da origem.

- **DO-CRM-01.** O CRM é domínio, não entidade: sem identidade, atributos, estado ou Recurso de permissão próprio; suas entidades são pares da Estrutura de Trabalho e relacionam-se com ela só por Vínculo. Origem: A2.1, A2.2, A2.3; documento 01, 7.7. CONSOLIDADA.
- **DO-CRM-02.** Sem hierarquia de contêineres: Contato, Empresa, Negócio e Funil pertencem diretamente ao Espaço de Trabalho; a Caixa de Entrada é composição 1:1. Consequência: B25, B36, B37 e B40 não se aplicam ao CRM. Origem: A5.2; B11; DO-CON-01; DO-EMP-01; DO-NEG-01; DO-FUN-02; RN-CXE-01. CONSOLIDADA.
- **DO-CRM-03.** Contato ≠ Membro ≠ Usuário; nenhuma entidade do CRM é Ator (exceto o Canal, como Integração) nem Sujeito de permissão. Origem: A1.4; RN-CON-04; INV-EMP-10; INV-NEG-12. CONSOLIDADA.
- **DO-CRM-04.** Contato × Empresa é N:N por Vínculo com papel (cargo), dois indicadores independentes de principal, início e fim; cargo pertence ao Vínculo. Origem: B8; DO-CON-02; DO-CON-04; DO-EMP-05. RECOMENDADA.
- **DO-CRM-05.** Negócio: Empresa opcional (referência unilateral), Contatos 0..N com papel de catálogo fixo, exatamente um Funil e uma Etapa (percorre, não pertence), exatamente um Proprietário, nenhum Responsável; situação ortogonal ao estado de ciclo de vida; sem mesclagem. Origem: B9; B10; DO-FUN-01; DO-NEG-01/03/07/08/09/12. CONSOLIDADA (B9) com detalhamento RECOMENDADO.
- **DO-CRM-06.** Toda Etapa é de progressão; posição e resultado são dimensões independentes; Registros de transição gravam Etapa por identidade, nome e Ordem à época; Funil padrão criado com o Espaço de Trabalho e sempre `ativo`; remapeamento explícito em toda remoção de Etapa, arquivamento ou lixeira de Funil, alcançando Negócios `na lixeira`. Origem: A4.4; DO-FUN-03/09/11/13; DO-NEG-05/09/18. RECOMENDADA.
- **DO-CRM-07.** Caixa de Entrada única por Espaço de Trabalho; Canal (especialização de Integração), Fila e Conversa contidos por ela; Fila e Canal não contêm Conversas; segmentação por Fila. Origem: B11; A2.4; A2.5; DO-CXE-01. CONSOLIDADA.
- **DO-CRM-08.** Conversa é episódio por (Contato principal, Canal), no máximo uma não resolvida por par; Mensagem recebida entra, reabre dentro do Prazo de reabertura (único por Caixa) ou cria outra; Mensagem é imutável e nunca muda de Conversa; sem Comentários em Conversa (nota interna é Mensagem `interna`); sugestão de Agente é Rascunho. Origem: B12; DO-CXE-04/07/08/15/20/23. RECOMENDADA.
- **DO-CRM-09.** Identificador de Contato é entidade interna, único por (Tipo, Valor) entre Contatos não `mesclado` (inclusive `arquivado` e `na lixeira`), único caminho de resolução de Mensagens; Identificador de Empresa é análogo, nunca resolve Mensagens. Mensagem de Identificador desconhecido cria Contato, Identificador, Conversa e Mensagem atomicamente, com Proprietário resolvido Fila → Canal → Caixa → Proprietário do ET. Origem: B13; DO-CON-03/08/15; DO-EMP-03; DO-CXE-05/25. RECOMENDADA.
- **DO-CRM-10.** Mesclagem de Contato e de Empresa é atômica e irreversível; o absorvido passa a `mesclado` (terminal, estado exclusivo dessas duas entidades) e continua resolvível ao sobrevivente; Conversas não resolvidas duplicadas no mesmo Canal são resolvidas pela Caixa (a mais recente permanece). Origem: B14; DO-CON-11/17; DO-EMP-13; DO-CXE-21. RECOMENDADA.
- **DO-CRM-11.** Termos de responsabilidade: Proprietário em Contato, Empresa e Negócio; Atribuído (Membro ou Agente) só em Conversa; nenhum Responsável no CRM; Caixa, Canal, Fila, Conversa e Funil sem Proprietário e sem sucessão. Origem: A7; B7; B35; DO-CON-07; DO-FUN-02; DO-CXE-02. CONSOLIDADA.
- **DO-CRM-12.** Permissões do CRM são por Papel, concessão direta e compartilhamento, com escopos `registro` e `próprios`; sem herança de contêiner; Funil privado (B38 aplicado) é a única restrição, por interseção, sobre Negócios, e o Proprietário de Negócio nunca perde `ver`; elegibilidade de Fila é origem de permissão sobre Conversas. Origem: A9; B29; DO-CON-16; DO-EMP-12; DO-FUN-10; DO-NEG-10; DO-CXE-19 (as duas últimas candidatas a decisão B). RECOMENDADA.
- **DO-CRM-13.** Catálogos consumidos pelo CRM são do Espaço de Trabalho: Origens, Motivos de Perda, Motivos de Ganho, Definições de Qualificação, Finalidades de Consentimento, Definições de Campo por entidade-alvo, Tags, Funis, Identificador legível de Negócios — os cinco últimos ampliando B34 e a tabela 7.6 do documento 01. Origem: B5; B34; DO-CON-05/06; DO-EMP-09/10; DO-NEG-02/06/12; DO-FUN-07/09. RECOMENDADA.
- **DO-CRM-14.** IA sobre o CRM: Agente pode ser Atribuído de Conversa e age por Ferramentas com as próprias permissões (ou interseção); Automação tem escopo Funil, Caixa de Entrada ou Fila; Sessão de Chat ancora-se a Contato, Empresa, Negócio ou Conversa e nunca envia; registros do CRM não são Conhecimento; Agentes nunca administram Funis, Filas, Canais ou Caixa nem reabrem `ganho`. Origem: B7; B19; B21; B22; B23; B41; DO-CXE-16/17; DO-EMP-14; DO-NEG-11; RN-FUN-17. RECOMENDADA.
- **DO-CRM-15.** Painéis leem o CRM como Fonte de Dados (Contatos, Empresas e grupo econômico, Negócios de um Funil, Conversas por Fila/Canal/Caixa), filtrados pelo visualizador; todo derivado é calculado e nunca gravado; avanço/retrocesso é classificado pela Ordem à época. Origem: B20; DO-FUN-12/13; DO-NEG-14; DO-EMP-06. RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. As exceções e ampliações à constituição introduzidas pelos documentos 10–14 (`mesclado`; Canal sem `na lixeira`; Conversa sem `arquivado`; Fila como escopo de Automação; Disponibilidade no Membro; novos catálogos; ET → Funil 1..N; Origem em Empresa; Empresa como âncora) estão registradas nos respectivos documentos e resumidas na seção 25.2 para incorporação à constituição.

## 25. Questões em aberto

### 25.1 Questões transversais ao CRM (já registradas nos documentos fonte)

1. **Escopo de permissão "da minha Equipe"** (10, 25.1; 12, 25.3; 14, 25.4). Não expressável com B29; o CRM comercial é onde mais dói. Candidata a C-nova.
2. **Conversas em grupo** (C5; 14, 25.1). Suporte estrutural fixado (DO-CXE-22); consentimento, Proprietário de Contatos criados por grupo e troca de principal em aberto.
3. **Retenção, anonimização e prova de consentimento** (C9; 10, 25.3; 11, 25.4; 14, 25.7). DO-CON-10 é recomendação até C9.
4. **Horário comercial e dias úteis** (C12; 13, 25.4; 12, 25.10; 14, 25.2). "Parado há X dias", "tempo de primeira resposta em horas úteis" e prazos por Etapa só são comparáveis entre Funil, Fila e Painel quando C12 existir.
5. **Categoria fixa de Qualificação** (C23; 10, 25.2). **Resolvida para Painéis** (documento 21, 20.17: Filtro escolhido pelo editor); permanece aberta para Automações e Agentes, que sem ela leem nomes ("cliente").
6. **Conversão de moeda em Painéis** (C22; 12, 25.2). **Resolvida para Painéis** (DO-PAI-13; RN-PAI-13: uma série por moeda, nunca conversão); resta em C22 a configuração de câmbio (taxa e data de referência) do Espaço de Trabalho.
7. **Catálogos configuráveis** hoje fixos: papéis no Negócio (12, 25.6), tipos de Vínculo Empresa-Empresa (11, 25.2). Ampliariam B34.
8. **Campos Personalizados em Vínculos, Identificadores, Etapa, Canal, Fila, Mensagem** (C13; 10, 25.4; 14, 25.11).
9. **Entidades futuras que atravessam o CRM**: Atividade de CRM (D4), Produto/Itens (D2), Proposta/Contrato (D3), Portal do cliente (C2/D9), Vínculo Conversa-Conversa (14, 25.3), Empresa como escopo de Automação (11, 25.6), Template de Negócio (12, 25.7), Etapa desativada (13, 25.1).

### 25.2 Inconsistências detectadas entre documentos do CRM

Detectadas na escrita desta visão geral e **todas resolvidas na revisão transversal do CRM** (achados em `revisoes/fase3-crm.md`); a resolução aplicada consta de cada item.

1. **Probabilidade sobrescrita na mudança de Funil** — `funis.md` 12.4 e 20.6 diziam "recalculada se herdada"; `negocios.md` DO-NEG-05/RN-NEG-05 fixam descarte em toda progressão. **Resolvida**: `funis.md` 12.4 e 20.6 reescritos conforme DO-NEG-05 (descartada em progressão; preservada em remapeamento).
2. **Nível "Caixa de Entrada" na resolução do Proprietário de Contato automático** — **Resolvida**: `contatos.md` DO-CON-08, 12.1 (3), 15, 20.5 e 21 enunciam Fila → Canal → Caixa de Entrada → Proprietário do ET (DO-CXE-05).
3. **Estado `mesclado` e A4.1** — **Resolvida**: A4.1 registra as exceções de domínio (`mesclado` em Contato e Empresa; Canal sem `na lixeira`; Conversa sem `arquivado`).
4. **Lado da Conversa no Vínculo Conversa-Negócio** — **Resolvida**: `negocios.md` 9, 20.14 e DO-NEG-13 fixam 0..N em ambos os lados, conforme o documento 14.
5. **Funil com ou sem Proprietário** — coerentes; nenhuma inconsistência.
6. **Negócios `na lixeira` em remapeamentos** — **Resolvida**: `funis.md` RN-FUN-10/12/13, 12.2 e 12.3 explicitam "em qualquer estado, inclusive `na lixeira`" (DO-NEG-09).
7. **Pré-condições e permissões de mesclagem, Contato × Empresa** — **Resolvida** com regra única (B14 ampliada): ambos os registros `ativo` ou `arquivado`; `administrar` sobre ambos; sobrevivente resulta `ativo` se um deles era `ativo`; migração por mesclagem não é relação nova para RN-EMP-08. Aplicada em `contatos.md` 12.2/12.4/DO-CON-11 e `empresas.md` 12.2/12.3/17.1/DO-EMP-13.
8. **Edição de Comentário de terceiros** — **Resolvida**: `contatos.md` 7.4 adota "quem tem `administrar` sobre o Contato" (padrão de DO-EMP-15/DO-NEG-15).
9. **Vigência do Vínculo Contato-Empresa** — **Resolvida**: `empresas.md` 25.1 marcada como fechada por DO-CON-02; 8.2 cita início/fim.
10. **Cardinalidade ET → Funil** — **Resolvida**: documento 01 (6, 9, 12.1, RN-ET-02, 23) atualizado para 1..N com Funil padrão.
11. **Dois indicadores de principal no Vínculo Contato-Empresa** (detectada na revisão) — `contatos.md` 7.6 e 12.4 descreviam um só indicador; DO-EMP-05 fixa dois. **Resolvida**: `contatos.md` 7.6, 12.4 (item 3) e DO-CON-02 incorporam o indicador "Contato principal da Empresa".
12. **Proprietário e Funil privado** (detectada na revisão) — `funis.md` 17.3 (a) e 22 admitiam que o Proprietário deixasse de ver o próprio Negócio; RN-NEG-20 rejeita. **Resolvida**: `funis.md` 17.3, 22 e 25.5 alinhados a DO-NEG-10; Funil padrão nunca privado (RN-FUN-16).
