# IA: VISÃO GERAL

> Domínio: IA | Documento 15 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

**IA** é o domínio do Espaço de Trabalho que reúne as entidades pelas quais a organização configura, governa, aciona e audita inteligência artificial como **capacidade nativa da plataforma** (princípio 5.4 da arquitetura aprovada): Chat (a entidade é a **Sessão de Chat**), **Agentes**, **Habilidades**, **Automações** e Conhecimento (as entidades são **Coleção**, **Fonte**, **Documento de Conhecimento**, **Versão de Documento** e **Fragmento**), além das entidades internas sem documento próprio **Ferramenta**, **Contexto**, **Memória**, **Modelo** e **Execução** (A2.1, A2.3, A2.5).

IA **não é uma entidade**: é um domínio, como CRM e Painéis (documento 01, 7.7). Não tem identidade, atributos nem estado. O Espaço de Trabalho não "contém uma IA": contém Agentes, Habilidades, Automações, Coleções e Sessões de Chat, cada uma raiz do próprio agregado, com o Espaço de Trabalho como escopo de existência (documento 01, 8).

Três propriedades definem o domínio e o separam de tudo o que a plataforma faz sem IA:

1. **Nativa, não integrada.** A IA não é uma Integração (A8): Agentes, Habilidades, Automações e Conhecimento são entidades corporativas do Espaço de Trabalho, sujeitas ao isolamento (A1.1, A1.2), à Política de lixeira, aos Limites impostos e à auditoria como qualquer outra. O que é externo é apenas o **Modelo**, entidade global usada e nunca possuída (A1.3), e as Ferramentas expostas por Integrações (DO-HAB-13).
2. **Agentes são Atores sujeitos às mesmas permissões que humanos** (A6.1, A6.3, A9.3). Um Agente tem Papel, recebe concessões e compartilhamentos, nunca é Proprietário nem Administrador (B7, B30, INV-ET-13), e age em nome de um Membro pela interseção das permissões ou de forma autônoma só com as suas. Não existe atalho, superpermissão nem "contexto de confiança" (documento 17, 17.5).
3. **Toda ação é atribuível.** Toda execução de IA passa por um Agente (B17) e ocorre dentro de uma **Execução** (B18), que referencia a versão usada (B24), o Modelo concreto, o Ator invocador, o ator delegante quando houver, cada Passo com a permissão avaliada e o custo. Cada Ferramenta com efeito gera o Registro de Atividade que ela própria gera, com Ator Agente ou Automação e delegante (A6.2). "Por que a IA fez isso" tem resposta exata meses depois.

O que o domínio **não** é, em uma frase cada: não é o operacional (Tarefas, Contatos, Negócios e Conversas não são Conhecimento — B19; Agentes os acessam por Ferramentas); não é a Estrutura de Trabalho nem o CRM (relaciona-se com eles por associação, nunca por contenção — A2.2); não é infraestrutura (mecanismos de recuperação, índices, provedores de Modelo estão fora da ontologia — documento 20, 1).

## 2. Propósito

- **Dar sujeito, governança e história à IA.** Ferramentas, Habilidades e Conhecimento são capacidades sem vontade; o Agente é quem as combina para um objetivo, e é sobre ele que recaem Proprietário, Papel, autonomia e custo (documento 17, 2). A Execução é a história de cada uso.
- **Separar quem raciocina de quem reage.** O Agente raciocina e é invocado; a Automação reage a Gatilho e invoca; a Habilidade é exercida; a Ferramenta é executada (B16). Um único lugar para "quando isto acontecer, faça aquilo" (Automação) e um único para "pense e aja" (Agente) — documento 17, 4.2.
- **Fazer a IA respeitar o que a organização já decidiu sobre acesso.** Permissões avaliadas a cada Ferramenta (B23), interseção com o delegante (A9.3), Conhecimento sob a permissão da Coleção (INV-CNH-09), Memória com elegibilidade por delegante (DO-AGE-07), Sessão que só restringe (INV-CHT-06).
- **Tornar cada resposta e cada ação reproduzível e auditável** (B18, B24; Referência de Conhecimento, DO-CNH-15; Composição do Contexto, DO-AGE-09).
- **Dar à organização uma base de resposta curada** (Conhecimento) distinta do que ela apenas registra (operacional) e do que a IA retém (Memória) — documento 20, 2.
- **Ligar os domínios no tempo.** A Automação é o mecanismo pelo qual um Evento de um domínio produz efeito em outro, com ou sem Agente (documento 19, 2).

## 3. Natureza da entidade

IA é domínio; as naturezas abaixo são as das entidades que ele reúne. A tabela é o **mapa de onde cada conceito está definido com rigor**; este documento não redefine nenhum deles.

### 3.1 Entidades com documento próprio

| Entidade | Natureza | Proprietário | Documento |
| --- | --- | --- | --- |
| Sessão de Chat | Entidade persistente, raiz de agregado; pertence ao Membro; Recurso de permissão; não é Ator. "Chat" é o ambiente, não entidade. | Sim (= Criador, imutável; único registro que admite Proprietário `removido`) | 16 — chat.md |
| Agente | Entidade configurável com identidade; Ator e Sujeito; agregado com Versões, Execuções, Memória do Agente e Solicitações. | Sim (Membro; Assistente padrão: Proprietário do Espaço de Trabalho — B33) | 17 — agentes.md |
| Habilidade | Configuração com identidade, versionada; sem estado operacional; não é Ator nem Sujeito. Variante da plataforma é global (DO-HAB-02). | Não (DO-HAB-06) | 18 — habilidades.md |
| Automação | Configuração com identidade, versionada, com estado operacional e Execuções; Ator e Sujeito de permissão (A9.1; DO-AUT-01; B88). | Sim (Membro; teto de permissões — RN-AUT-04) | 19 — automacoes.md |
| Coleção | Entidade persistente, raiz de agregado; único Recurso de permissão do Conhecimento. | Sim | 20 — conhecimento.md |
| Fonte | Entidade contida pela Coleção, com identidade; não é Ator. | Não (Membro configurador) | 20 — 6.2, 11.2 |
| Documento de Conhecimento | Entidade contida pela Coleção, raiz do próprio agregado (Versões, Fragmentos, Comentários). | Não (governança da Coleção) | 20 — 6.3 |
| Versão de Documento | Entidade interna do Documento, imutável, referenciável de fora. | — | 20 — 6.4 |
| Fragmento | Entidade interna derivada da Versão, regenerável, sem significado de negócio. | — | 20 — 6.5 |

### 3.2 Entidades internas sem documento próprio (A2.5)

| Conceito | Natureza | Onde está definido com rigor |
| --- | --- | --- |
| **Ferramenta** | Operação atômica do Catálogo (plataforma ∪ Integrações), com identificador estável, origem, contrato, Recurso-alvo, permissão requerida e classe de efeito. Não é entidade do Espaço de Trabalho nem componente de agregado: é **usada** (Habilidade, Agente) e **invocada** (Ação de Automação). | habilidades.md 7.4; DO-HAB-13, DO-HAB-14 |
| **Contexto** | Objeto de valor **efêmero** da Execução, reconstruído a cada Execução sob a permissão efetiva do Sujeito; o que persiste é a **Composição do Contexto**, por referência. | agentes.md 7.4 (DO-AGE-09); chat.md 7.6 (DO-CHT-15) |
| **Memória do Agente** | Entidade interna do Agente (1:1), com Itens de Memória; elegibilidade por delegante; nunca é Conhecimento. | agentes.md 7.5 (DO-AGE-07) |
| **Memória do Usuário** | Entidade interna do **Membro** (não da Sessão), com Itens; nunca retém dados de terceiros; nunca sucedida. | chat.md 7.5 (DO-CHT-11); documento 01, 7.1 (B86) |
| **Modelo** | Entidade **global** (A1.3), usada por Versão de Agente e por Sessão (Modelo escolhido), nunca possuída; declara **Capacidades**; a plataforma designa um `padrão da plataforma`. Consolidado na seção 7.4 deste documento. | Glossário; DO-HAB-10 (Capacidades); DO-AGE-04 (`padrão da plataforma`, descontinuação); RN-CHT-19, RN-CNH-26 |
| **Execução de Agente** | Entidade interna do Agente **com identidade** e ciclo de vida (B18): episódio com Passos, Contexto, Solicitações, saídas, custo. | agentes.md 7.2, 11.2, 12.3 |
| **Execução de Automação** | Entidade interna da Automação com identidade e ciclo de vida (B18); pode conter Execuções de Agente. | automacoes.md 7.7, 11.2, 12.5 (DO-AUT-07) |

### 3.3 Demais entidades internas e associações

| Conceito | Natureza | Onde |
| --- | --- | --- |
| Versão de Agente / de Habilidade / de Automação | Entidades internas dos agregados, numeradas, imutáveis depois de criadas/publicadas (B24). | 17, 7.1; 18, 7.1; 19, 7.1 |
| Mensagem de Chat | Entidade interna da Sessão (composição), imutável; papéis `usuário`, `assistente`, `sistema`, `ferramenta`. | 16, 7.2 |
| Item de Memória | Entidade interna da Memória (do Agente ou do Usuário), com identificador local. | 17, 7.5; 16, 7.5 |
| Solicitação de Aprovação | Conceito transversal (A8); **entidade interna da Execução com identidade**, porque é decidida fora dela, notificada, sucedida (B28) e contada por Painéis. | 17, 7.6 (DO-AGE-11); 19, 17.5 (DO-AUT-13) |
| Concessão de Habilidade | **Associação N:N** Agente ↔ Habilidade com atributos, **sem identidade própria** (par), pertencente ao Espaço de Trabalho; é a permissão (Agente, `executar`, Habilidade). | 18, 7.2 (DO-HAB-03) |

### 3.4 Objetos de valor

| Objeto de valor | De quem | Onde |
| --- | --- | --- |
| Passo (chamada de Ferramenta, Exercício de Habilidade, Solicitação, raciocínio, memorização) | Execução de Agente | 17, 7.3; Exercício: 18, 7.3 (DO-HAB-11) |
| Passo (Condição avaliada, Ação executada) | Execução de Automação | 19, 7.7 |
| Composição do Contexto; Cadeia de Execuções; Custo; Entrada; Saídas | Execução de Agente | 17, 7.2, 7.4, 7.9 |
| Cadeia de Execuções (mãe, profundidade, pares e Agentes visitados); Gatilho disparador | Execução de Automação | 19, 7.7; B79 |
| Referência de Conhecimento | Execução de Agente; Mensagem de Chat `assistente` | 20, 7.7 (DO-CNH-15) |
| **Rascunho** | **Conversa** (domínio CRM): um por Ator interno; origem `Membro`, `Agente` ou `Sessão de Chat`; referencia a Execução geradora. Não é entidade de IA: a IA o **produz**. | 14, 7.10 (DO-CXE-15) |
| Ferramentas permitidas; Política de aprovação; Objetivo; Instruções; Profundidade máxima de invocação | Versão de Agente | 17, 6.2, 7.7, 7.8 |
| Política de retenção de Memória; Limite de custo do Agente | Agente | 17, 6.1 |
| Instruções; Contrato de entrada/saída; Requisitos de Ferramenta; Dependências; Coleções recomendadas; Efeito declarado | Versão de Habilidade | 18, 7.1 |
| Gatilho; Condições; Ações; Política de erro; Regra de Agendamento; Autonomia máxima imposta | Versão de Automação | 19, 7.2–7.6 |
| Âncora; Configuração da Sessão (Modelo escolhido, Restrição de Ferramentas, título) | Sessão de Chat | 16, 7.3, 7.4 |
| Conteúdo; Representação derivada; Metadado; Proveniência; Política de atualização; Política de retenção de versões | Versão / Documento / Fonte / Coleção | 20, 7.1–7.5 |

Nenhuma entidade de IA é contêiner estrutural, tem Status (A4.2), Campos Personalizados ou Tags (A5.2, A8 — Tags em Documento são proposta DO-CNH-06).

## 4. Fronteira conceitual

### O que é

- O conjunto {Sessão de Chat, Agente, Habilidade, Automação, Coleção, Fonte, Documento de Conhecimento, Versão, Fragmento} e as entidades internas {Execução de Agente, Execução de Automação, Versões, Mensagem de Chat, Memória do Agente, Memória do Usuário, Item de Memória, Solicitação de Aprovação, Concessão de Habilidade}, com os objetos de valor da seção 3.4.
- O lugar do Espaço de Trabalho em que raciocínio (Agente), reação (Automação), competência (Habilidade), conteúdo curado (Conhecimento) e diálogo pessoal (Sessão) são governados, versionados e auditados.

### O que não é

- **Não é a Estrutura de Trabalho nem o CRM.** Nenhuma entidade de IA é filha de Espaço, Pasta, Lista, Tarefa, Funil ou Caixa de Entrada (A2.2). O escopo de uma Automação é referência essencial, não contenção (B41; documento 19, 10).
- **Não é Integração.** A Integração é conexão configurada (B35); expõe Ferramentas e emite Eventos que a IA usa (documento 19, 4.7).
- **Não é o Membro.** O Membro é o único Ator humano; a IA age em nome dele ou autonomamente, nunca o substitui como Proprietário, Administrador, aprovador ou Sucessor (B7, B30).
- **Não é Painel.** Painéis leem Execuções (de Agente e de Automação) e Solicitações de Aprovação como Fonte de Dados, filtradas pelo visualizador (B20; DO-PAI-05); Sessões não são Fonte (DO-CHT-13). O Painel não é Fonte de Conhecimento nem de Contexto para Agentes: a Ferramenta `ler Painel` (classe `leitura`) entrega a configuração dos Widgets e recalcula cada um com as permissões efetivas do Agente ∩ delegante (DO-PAI-17); nenhum Agente ou Automação cria, edita ou compartilha Painel (DO-PAI-08).
- **Não é infraestrutura.** Provedores, índices, representações vetoriais e mecanismos de busca não são conceitos desta ontologia.

### 4.1 Fronteiras com os outros domínios

| Fronteira | O que atravessa | Como | Onde está decidido |
| --- | --- | --- | --- |
| **IA × Estrutura de Trabalho** | Agente Responsável por Tarefa (B7); Automações com escopo Espaço, Pasta, Subpasta ou Lista; Sessão ancorada a Tarefa ou contêiner; Ferramentas de leitura e escrita sobre Tarefas | Agente Responsável exige `ver` e não é invocado pela Tarefa — trabalha quando Automação ou Membro o invoca com a Tarefa como âncora (RN-TAR-27; RN-AGE-14). Automações acumulam pelo caminho e acompanham o contêiner movido; eliminadas com o escopo (B25, B40, B41). A âncora não é Vínculo e não concede permissão (DO-CHT-03). Agente age com interseção ou permissões próprias, avaliadas a cada Ferramenta (documento 06, 17.5). | documento 06, 8 e 17; 17, RN-AGE-14, RN-AGE-20; 19, 16; 16, 7.4 |
| **IA × CRM** | Agente Atribuído a Conversa (B7); Rascunho gerado por Agente ou copiado de Sessão; Automações com escopo Funil, Caixa de Entrada ou Fila (DO-CXE-16); Sessão ancorada a Contato, Empresa, Negócio ou Conversa; Ferramentas de mensageria | Agente Atribuído é invocado pela Caixa de Entrada a cada Mensagem recebida, sem delegante; responde só em `autônomo`; em `supervisionado`/`assistido` cada envio gera Solicitação e o texto vira Rascunho (RN-CXE-12, RN-CXE-23, DO-CXE-15, DO-AGE-17). Conhecimento **não contém** registros do CRM (B19). Agente nunca cria Funil, nunca recebe `administrar` sobre Funil, Fila, Canal ou Caixa, nunca reabre Negócio `ganho`. | documento 09, 4.1; 14, 7.10, 8.6, RN-CXE-12/23/26; 17, RN-AGE-14; 20, 1 |
| **IA × Painéis** | Entidades-alvo: Execução de Agente, Execução de Automação e Solicitação de Aprovação (DO-PAI-05; B80); Exercícios de Habilidade como Dimensão/Filtro (DO-HAB-11); Coleção e Documento só para Métricas de catálogo e uso (RN-PAI-15); "Conhecimento consultado" e "custo por Cadeia de Execuções" como Métricas derivadas (DO-CNH-15; B79); Ferramenta `ler Painel` | Referência, nunca cópia; filtradas pelas permissões do visualizador (B20), inclusive quando o visualizador é um Agente — que só lê por `ler Painel`, com recálculo na interseção com o delegante (DO-PAI-17), e nunca cria Painel (DO-PAI-08). Sessões de Chat **não** são Fonte de Dados e seus eventos não são Gatilhos (DO-CHT-13, RN-CHT-24; B85); Painel não é Gatilho nem escopo de Automação (RN-PAI-25). | Glossário (Fonte de Dados); 17, 7.2, 17.3; 19, 8; 20, 18; 16, DO-CHT-13; 21, DO-PAI-05/08/17 |
| **IA × Espaço de Trabalho** | Assistente padrão (atributo do Espaço de Trabalho); Limites impostos (cota de IA, Agentes, Sessões, Contexto); Localidade; Papéis; sucessão | O Assistente padrão é instanciado por Espaço de Trabalho, com Proprietário igual ao do Espaço de Trabalho (B33). Toda entidade de IA é eliminada com o Espaço de Trabalho (B32). Em `suspenso`, nada com efeito (B31). | documento 01, 6, 8, 17.3, 20.6 |

### 4.2 Comparações obrigatórias

| X × Y | Critério de distinção | Onde |
| --- | --- | --- |
| **Chat (Sessão de Chat) × Conversa (CRM)** | Membro ↔ IA versus organização ↔ Contato por um Canal. A Sessão pertence ao Membro, é privada (`ver` só por compartilhamento), tem Mensagens de Chat com papel; a Conversa é da Caixa de Entrada, visível a quem tem `ver`, tem Mensagens com direção e entrega. A Sessão pode ancorar-se a uma Conversa e produzir Rascunho; nunca envia. Nenhuma Mensagem de Chat vira Mensagem sem ato de envio. | 16, 4.1; 14, 4 |
| **Agente × Chat** | Quem responde versus onde se responde. O Agente é entidade da organização (Proprietário, Papel, Memória, Execuções, invocável por Automações); a Sessão é episódio pessoal que **usa** 0..1 Agente principal (padrão: Assistente padrão). Cada resposta é uma Execução de Agente com origem na Sessão e delegante o Membro (DO-CHT-04). | 17, 4.1; 16, 4.2 |
| **Agente × Habilidade** | Sujeito versus definição. O Agente tem Modelo, Memória, permissões, autonomia, Proprietário e custo; a Habilidade é competência sem Proprietário, sem permissões, sem Execução própria, exercida por Concessão como Passo da Execução (B15, DO-HAB-11). | 17, 4; 18, 4.3 |
| **Habilidade × Ferramenta** | Competência composta que exige raciocínio versus operação atômica sem raciocínio. A Habilidade **usa** Ferramentas (requeridas, obrigatórias ou opcionais); a Ferramenta tem permissão requerida e classe de efeito e existe sem Habilidade. Só Agentes exercem Habilidades; Agentes e Automações invocam Ferramentas (B16, DO-HAB-13). | 18, 4.1, 7.4 |
| **Agente × Automação** | Raciocina e é invocado versus reage e invoca. O Agente não tem Gatilho (INV-AGE-14); a Automação tem exatamente um (DO-AUT-02), escopo e Execução própria que pode conter Execuções de Agente (B18). A Automação impõe autonomia máxima ao Agente, nunca amplia (B22). O Agente nunca invoca Automação no sentido de B16; pode **acionar** Gatilho manual por Ferramenta (DO-AUT-24). | 17, 4.2; 19, 4.1 |
| **Automação × comportamento estrutural da plataforma** ("workflow implícito") | O que a plataforma faz sempre, para todo Espaço de Trabalho, sem que alguém tenha definido regra (transições de Status, Requisitos de Etapa, cascata de estado, Regra de Recorrência, herança de configuração, distribuição por Fila, sucessão, mesclagem) é comportamento estrutural: emite Eventos, nunca gera Execução. O que só acontece porque um Membro definiu Gatilho → Condições → Ações é Automação. | 19, 4.4–4.6 |
| **Conhecimento × Arquivo** | O Arquivo é matéria (binário transversal do Espaço de Trabalho, A8); o Documento é conhecimento curado sobre essa matéria, com Coleção, Proveniência, Versões e permissão herdada. Todo Arquivo existe sem Conhecimento; um Documento pode existir sem Arquivo. Enviar Arquivo não cria Conhecimento; "adicionar ao Conhecimento" cria (DO-CNH-17). | 20, 4 |
| **Conhecimento × Memória** | Curado por ato humano, governado por Coleção, com proveniência obrigatória e consultável por qualquer Sujeito com `ver` versus retido a partir de interações, pertencente a um Agente ou a um Membro, sob política de retenção (C7), nunca consultável por terceiros. Memória nunca vira Documento sem Ferramenta, permissão e Proveniência (INV-CNH-12, DO-CNH-13). | 20, 4; 17, 7.5 |
| **Memória do Agente × Memória do Usuário** | Do Agente (1:1; governada pelo Proprietário do Agente; legível por `ver`; escrita só pelas Execuções do próprio Agente ou por Membro com `editar`; Itens com Delegante de origem só servem ao mesmo delegante; pode referenciar registros e é eliminada com eles) versus do Membro (entidade interna do Membro; alimentada só por Execuções originadas nas suas Sessões ou por ele; só lida em Execuções em nome dele; nunca retém dados de Contatos, Empresas, Negócios ou terceiros; nunca sucedida; nunca vista por outros, inclusive Administradores). | 17, 7.5 (DO-AGE-07); 16, 7.5 (DO-CHT-11) |
| **Execução de Agente × Execução de Automação** | Pertence ao Agente versus à Automação. Origem: invocação versus Gatilho. Conteúdo: raciocínio, Ferramentas, Exercícios versus Condições e Ações determinísticas. A de Automação é **mãe** de 0..N de Agente; cancelar a mãe cancela as filhas; cancelar a filha faz o passo "invocar Agente" falhar. Custo: a mãe agrega as filhas. Eliminação: com o Agente / com a Automação (DO-AUT-17). | 19, 4.9; 17, 7.2 |
| **Modelo × Agente** | Recurso global sem Proprietário, permissões ou Memória (A1.3) versus entidade do Espaço de Trabalho com identidade, Proprietário, Papel, versão. O Agente **referencia** um Modelo (ou `padrão da plataforma`) e o substitui sem perder identidade; a Execução grava o Modelo concreto usado (DO-AGE-04). | 17, 4, 5; 7.4 deste documento |
| **Contexto × Conhecimento** | Efêmero, reconstruído a cada Execução, gravado por referência versus persistente, versionado, governado. O Contexto **consome** Fragmentos (sob `ver` efetivo); não os possui. Arquivo em Sessão é Contexto, não Documento (RN-CNH-23). | 20, 4; 17, 7.4; 16, 7.6 |
| **Assistente padrão × Agente** | Um exemplar da mesma entidade com invariantes adicionais (INV-AGE-11): instanciado pela plataforma na criação do Espaço de Trabalho a partir de Template global, sempre `ativo`, nunca `rascunho`/`pausado`/`arquivado`/`na lixeira`, Proprietário = Proprietário do Espaço de Trabalho (acompanha a transferência), não transferível por si, executor de toda invocação sem Agente indicado (B17, B21, B33). Configurável nos mesmos termos de qualquer Agente, por Papel Administrador ou Proprietário. Não recebe nada por ser padrão (sem Coleções, sem contêineres privados). | 17, 4.8, 12.6; documento 01, DO-ET-11 |

## 5. Identidade

O domínio IA não tem identidade. Cada entidade tem **identificador opaco, imutável, atribuído pela plataforma**, e passa no teste de identidade pelo mesmo critério: a **continuidade do objeto de governança**, não o seu conteúdo.

| Entidade | Identidade | O que muda sem mudar a identidade | Nome/título único? | Onde |
| --- | --- | --- | --- | --- |
| Sessão de Chat | Própria; Proprietário e Espaço de Trabalho imutáveis; âncora imutável (DO-CHT-03) | Título, Agente principal, Modelo escolhido, Restrição, compartilhamentos | Não | 16, 5 |
| Agente | Própria; continuidade do sujeito | Toda a configuração (por Versões), Modelo, Proprietário, Papel | Sim, entre não `na lixeira` (RN-AGE-02) | 17, 5 |
| Habilidade | Própria; continuidade da competência | Toda a definição (por Versões) | Sim, entre `ativo`/`arquivado` (RN-HAB-02); plataforma tem espaço de nomes próprio | 18, 5 |
| Automação | Própria; **escopo imutável** (RN-AUT-02) | Gatilho, Condições, Ações (por Versões), Proprietário, Papel | Sim, no escopo (RN-AUT-03) | 19, 5 |
| Coleção | Própria | Nome, Proprietário, Fontes, permissões, Documentos | Sim, entre `ativo`/`arquivado` (RN-CNH-02) | 20, 5 |
| Documento de Conhecimento | Própria | Título, Coleção (por movimentação), todo o Conteúdo (por Versões) | Não | 20, 5 |
| Execução (Agente / Automação) | Própria, interna ao agregado; referenciável por Registros, Solicitações, Rascunhos, Referências, Painéis | Estado (até terminal) | — | 17, 5; 19, 7.7 |
| Solicitação de Aprovação | Própria (decidida fora da Execução, sucedida) | Aprovador (sucessão), Decisão | — | 17, 7.6 |
| Versões (Agente, Habilidade, Automação, Documento) | Derivada: (raiz, número sequencial); nunca reutilizada | Nada (imutáveis) | — | 17/18/19, 7.1; 20, 6.4 |
| Concessão de Habilidade | Pelo par (Agente, Habilidade) | Versão fixada | — | 18, 7.2 |
| Passo, Exercício, Fragmento, Item de Memória, Mensagem de Chat | Identificador local (dentro da Execução, Versão, Memória, Sessão); não é identidade ontológica, salvo Mensagem de Chat, que é entidade interna com identificador próprio | — | — | 17, 7.3; 20, 6.5; 16, 7.2 |
| Modelo, Ferramenta | Identificador da plataforma (global) / identificador estável no Catálogo | — | — | Glossário; 18, 7.4 |

Consequências comuns: nenhuma entidade de IA muda de Espaço de Trabalho (A1.1) nem se torna global; instanciar Template ou copiar Habilidade cria **outra** identidade com Proveniência (A8, DO-AGE-12, DO-HAB-07); Modelo não é identidade de nada.

## 6. Atributos fundamentais

O domínio não tem atributos. Os atributos de cada entidade estão nos documentos 16–20. Consolidam-se aqui (a) o que o **Espaço de Trabalho** carrega para o domínio e (b) o **versionamento**, transversal a quatro entidades.

### 6.1 Atributos de IA que vivem no Espaço de Trabalho (documento 01, 6)

| Atributo | Natureza | Descrição |
| --- | --- | --- |
| Assistente padrão | referência (Agente) | Exatamente um Agente do próprio Espaço de Trabalho (INV-ET-09); instanciado na criação (RN-ET-02); executor de toda invocação sem Agente indicado (B17, B21). |
| Limites impostos (parcela de IA) | objeto de valor de origem externa (B34) | Cota de IA (C8); número de Agentes; Sessões; tamanho de Arquivo e de Contexto; profundidade da Cadeia de Execuções e sub-limite de invocação Agente → Agente (B79); operações por Execução (DO-AUT-18); retentativas; teto do tempo limite de aprovação (padrão 72 horas — B80); intervalo mínimo de Atualização e de agendamento; Modelos admitidos. Verificados no ato (RN-ET-23); nunca suspensão automática. |
| Localidade | objeto de valor | Idioma padrão do Assistente padrão; fuso para agendamentos, condições temporais e momentos (RN-ET-15, RN-AUT-17). |
| Política de lixeira | objeto de valor | Prazo de `na lixeira` para Agente, Habilidade, Automação, Coleção, Documento e Sessão. |

### 6.2 Versionamento (B24)

| Entidade | O que versiona | O que **não** versiona | Estados da Versão | Quem cria/publica | Como Execuções referenciam |
| --- | --- | --- | --- | --- | --- |
| Agente | Objetivo, instruções, Modelo, Admite sobrescrita de Modelo, Ferramentas permitidas, conjunto de Habilidades concedidas (por identidade), nível de autonomia, Política de aprovação, Profundidade máxima de invocação, Memória habilitada (DO-AGE-02) | Nome, descrição, Proprietário, Papel, Política de retenção, Limite de custo | Sem estado: toda Versão vale a partir da próxima Execução; corrente = maior número; **não fixável por terceiros** | Membro com `editar`; Sistema (Assistente padrão v1; eliminação de Habilidade; restaurar padrão) | Execução de Agente → (Agente, Versão), fixa do início ao fim (RN-AGE-09) |
| Habilidade | Instruções, contratos, Requisitos de Ferramenta, Dependências, Coleções recomendadas (DO-HAB-04) | Nome, descrição | `rascunho` (0..1), `publicada` (0..N coexistentes), `obsoleta` | Publicar: Membro com `administrar` (ou plataforma) | Exercício → (Habilidade, versão) à época, como valor; Concessão segue a corrente ou fixa (DO-HAB-05) |
| Automação | Gatilho, Regra de Agendamento, Condições, Ações, Política de erro, Autonomia máxima imposta (DO-AUT-19) | Nome, descrição, Proprietário, Papel, concessões, "Reage a Eventos de Automações" | `rascunho` (0..1), `publicada` (**0..1**, a vigente), `obsoleta` | Publicar: Membro com `administrar`; valida teto de permissões (RN-AUT-07) | Execução de Automação → (Automação, Versão), fixa do disparo ao fim (RN-AUT-08) |
| Documento de Conhecimento | Conteúdo (texto próprio e/ou Arquivo) (DO-CNH-08) | Título, Metadado, rótulos | Processamento por Versão: `pendente`, `processado`, `com erro`; uma corrente | Ator com `editar`; Sistema/Integração (Atualização) | Referência de Conhecimento → (Documento, Versão, Fragmentos), resolve com marcador (RN-CNH-22) |

Invariante comum: Versões `publicada`/`obsoleta` (Habilidade, Automação), toda Versão de Agente e toda Versão de Documento são **imutáveis** e nunca eliminadas enquanto a raiz existir (exceção: Versões superadas de Documento, por Política de retenção, com registro mínimo — RN-CNH-15). Execuções em curso terminam na versão com que começaram (RN-AGE-09, RN-HAB-14, RN-AUT-08).

## 7. Entidades internas ou componentes

As entidades internas sem documento próprio (A2.5) estão definidas com rigor nos documentos de Agentes, Chat, Habilidades, Automações e Conhecimento. Esta seção **consolida** as definições, sem alterá-las.

### 7.1 Ferramenta (habilidades.md 7.4; DO-HAB-13, DO-HAB-14)

Operação **atômica**, sem raciocínio, que a plataforma (origem `plataforma`, global) ou uma Integração do Espaço de Trabalho (origem `Integração`; inoperante enquanto a Integração não estiver `conectada`) expõe a Agentes e Automações. Elementos: identificador estável; contrato de entrada e de saída (Tipos de Campo, referência a registro, Arquivo com tipos — DO-HAB-09); **Recurso-alvo**; **permissão requerida** (ação de A9.1 sobre o registro concreto, avaliada **a cada invocação** — B23); **classe de efeito** (`leitura`, `escrita reversível`, `escrita irreversível`, `externa`), que alimenta B22 por invocação. O **Catálogo de Ferramentas** do Espaço de Trabalho é consulta derivada (plataforma ∪ Integrações), não entidade. Descontinuação é evento; a antiga fica inoperante após prazo de transição. Duas verificações independentes em todo uso por Agente: Ferramenta **permitida** ao Agente (`executar` sobre a Ferramenta, configuração da Versão) e permissão requerida sobre o registro-alvo com o Sujeito efetivo (DO-HAB-14). Ferramentas nomeadas pelos documentos: `criar Tarefa`, `ler Contato`, `ler Conversa`, `ler Negócio`, `enviar Mensagem`, `consultar Conhecimento`, `adicionar ao Conhecimento`, `invocar Agente` (`escrita reversível` — DO-AGE-06), `acionar Automação` (`escrita reversível` — DO-AUT-24), `lembrar` (`escrita reversível` — DO-CHT-11), `sugerir resposta` (grava Rascunho — DO-CXE-15), `atualizar Qualificação de Contato`, `ler Painel` (`leitura`: entrega a configuração dos Widgets e recalcula cada um com as permissões efetivas do Agente ∩ delegante — DO-PAI-17; não existe Ferramenta de escrita sobre Painel — DO-PAI-08). Ferramenta **não é** Sujeito, Ator (a Integração é o Ator), Habilidade, Ação de controle nem Recurso com estado próprio.

### 7.2 Contexto (agentes.md 7.4; chat.md 7.6; DO-AGE-09, DO-CHT-15)

Conjunto de informações disponibilizado ao Modelo durante uma Execução: objetivo e instruções do Agente (Versão), instruções da Habilidade em exercício, registro âncora e registros lidos por Ferramenta, Arquivos compatíveis com as Capacidades do Modelo, Fragmentos de Conhecimento recuperados (sob `ver` efetivo — INV-CNH-09), Itens de Memória elegíveis (do Agente; do Usuário quando a origem é Sessão), Mensagens recentes não substituídas da Sessão, entrada e resultados de Passos anteriores. É **objeto de valor efêmero da Execução**: reconstruído a cada Execução, nunca persistido em conteúdo; a Execução grava a **Composição do Contexto** (referências: identificadores, versões, Posições de Fragmento, Itens de Memória, Mensagens, âncora), resolvida na leitura com a permissão de quem lê e com marcador quando eliminada. Tudo entra sob a permissão efetiva do Sujeito (Agente ∩ delegante, ou só Agente se autônomo), avaliada a cada Ferramenta (B23). Limites de tamanho são Limites impostos (B34). O Agente não "tem Contexto" entre Execuções; tem Memória. A Habilidade recebe o Contexto da Execução; não constrói o seu (RN-HAB-16).

### 7.3 Memória (agentes.md 7.5; chat.md 7.5; DO-AGE-07, DO-CHT-11)

Informação retida entre Execuções ou Sessões, sob política de retenção (C7). Duas entidades distintas, nunca uma só:

- **Memória do Agente**: entidade interna 1:1 do Agente, criada vazia com ele; contém Itens de Memória (Conteúdo curto, Execução de origem, **Delegante de origem** 0..1, Registros referenciados, momentos, Origem do ato `Agente`/`Membro`). Escrita **apenas** pelas Execuções do próprio Agente (Passo de memorização; nunca em ensaio) ou por Membro com `editar`; nunca por outro Agente, Automação, Habilidade ou Integração. Legível por `ver`, apagável por `editar`. **Elegibilidade por delegante** (INV-AGE-10): Item com Delegante de origem só entra no Contexto de Execuções com o mesmo delegante; Item sem delegante entra em qualquer. Política de retenção de Memória é objeto de valor do Agente (prazo, número máximo, reter Itens com delegante). Preservada em `pausado`/`arquivado`; eliminada com o Agente e com a eliminação permanente de registro referenciado. Nunca é Conhecimento; nunca gera Referência de Conhecimento.
- **Memória do Usuário**: entidade interna do **Membro** (impacto registrado no documento 01, 7.1), 0..1 por Membro por Espaço de Trabalho, habilitável pelo Membro; Itens com conteúdo sobre o **próprio Membro**, origem (Sessão e Execução, ou `Membro`), estado `ativo`/`desativado`. Escrita só por Ferramenta `lembrar` em Execução originada em Sessão do próprio Membro ou por ele; lida só em Execuções em nome dele; **nunca retém dados de Contatos, Empresas, Negócios ou terceiros**; nunca vista por outros Membros, Administradores ou Agentes fora de Execução em nome do Membro; nunca sucedida (B28); nunca atravessa Espaços de Trabalho.

### 7.4 Modelo (Glossário; A1.3; DO-HAB-10; DO-AGE-04)

Entidade **global da plataforma**, fora de qualquer Espaço de Trabalho: modelo de inteligência artificial **referenciado** por Versões de Agente (exatamente um Modelo principal, ou o marcador `padrão da plataforma`) e por Sessões de Chat (Modelo escolhido, 0..1, quando o Agente admite sobrescrita e o Modelo está disponível ao Espaço de Trabalho por Limites impostos). Nunca pertence a um Espaço de Trabalho; não tem Proprietário, permissões nem Memória; não é Ator nem Sujeito. O que os documentos de IA fixam sobre ele, e que este documento consolida como a definição a ser herdada:

| Elemento | Definição | Origem |
| --- | --- | --- |
| Identificador | Global, da plataforma. | Glossário |
| **Capacidades** | Modalidades de entrada e de saída suportadas (texto; imagem; áudio; vídeo; documentos), no mesmo padrão das Capacidades do Tipo de Canal (documento 14, 7.1). Verificadas: na Disponibilidade da Concessão e no início do exercício (Capacidades de Modelo requeridas da Habilidade — RN-HAB-17); na entrada de Arquivo no Contexto da Sessão (RN-CHT-19; Representação derivada entra no lugar); na consulta de Documento não textual sem Representação derivada (RN-CNH-26; Documento reportado como indisponível, sem erro). | DO-HAB-10, DO-CHT-10, DO-CNH-16 |
| `padrão da plataforma` | Marcador que a plataforma resolve, no início de cada Execução, para o Modelo que designa como padrão naquele momento; a Execução grava sempre o Modelo concreto usado. | DO-AGE-04 |
| Descontinuação | Fato da plataforma, emitido como evento "Modelo descontinuado" com antecedência e Modelo sucessor sugerido. Agentes com Modelo explícito passam a Disponibilidade `indisponível` (sem estado `degradado`); substituição é sempre nova Versão por ato de Membro; Agentes com `padrão da plataforma` não são afetados. | DO-AGE-04; 17, 20.8 |
| Admissão ao Espaço de Trabalho | Quais Modelos o Espaço de Trabalho pode escolher é Limite imposto (B34). | 16, 6 |

Catálogo completo de Capacidades (comprimento de Contexto, uso de Ferramentas) e Modelos secundários por modalidade permanecem em aberto (documento 18, 25.6; documento 17, 25.2; seção 25 deste documento).

### 7.5 Execução (agentes.md 7.2; automacoes.md 7.7; B18)

Registro **com identidade** de uma instância de funcionamento, pertencente ao Agente (Execução de Agente) ou à Automação (Execução de Automação), com estados `pendente`, `executando`, `aguardando aprovação`, `concluída`, `falhou`, `cancelada`; Ator invocador; ator delegante quando houver; versão usada, fixa do início ao fim; Passos com resultado e permissão avaliada; Solicitações de Aprovação; custo; momentos; motivo de término. É o **único lugar** em que Ferramentas são invocadas por IA, Habilidades exercidas, Conhecimento consultado por Agente e Modelo consumido em nome da organização (B17, INV-HAB-09). Estados terminais são imutáveis; "tentar de novo" é Execução nova. Uma Execução de Automação pode conter (ser mãe de) 0..N Execuções de Agente; nunca o inverso (DO-AGE-14). O ator delegante é Membro (Sessão, ação direta, herdado) ou Automação (Ação "invocar Agente", Condição híbrida — DO-AUT-15); só o delegante Membro entra na interseção de permissões (A9.3). Toda Execução carrega a **Cadeia de Execuções** (B79): a sequência de Execuções de Automação e de Agente ligadas por disparo ou invocação, com Execução-mãe, profundidade e elementos visitados (pares (Automação, objeto) e Agentes); único objeto de cadeia do domínio. A Execução de Agente tem, além disso: Origem (`Sessão de Chat`, `ação direta`, `Automação`, `Agente`, `Caixa de Entrada`), Modelo usado, nível de autonomia efetivo, Composição do Contexto, Referências de Conhecimento, Itens de Memória produzidos, marcação de **ensaio** (DO-AGE-13: escritas simuladas, sem efeito, sem Memória). A Execução de Automação tem Gatilho disparador e objeto (ou conjunto, em agendamento). Retenção de Execuções é política da plataforma (C28; documento 17, 25.4).

### 7.6 Solicitação de Aprovação (agentes.md 7.6, 7.8; automacoes.md 17.5; A8)

Entidade interna da Execução com identidade: Execução e Passo; solicitante (Agente ou Automação); motivo (`autonomia` — B22; `permissão` — alternativa de B23; `limite` — Limite de operações por Execução, em qualquer nível — DO-AUT-18, DO-CON-13; nas Automações, também Ação explícita "solicitar aprovação"); **objeto fixo** (Ferramenta + entrada completa; aprovar é aprovar *isto*); aprovador Membro `ativo` resolvido na criação (delegante Membro → Aprovador declarado na Ação "invocar Agente" → configurado no Agente → Proprietário do Agente → Proprietário do Espaço de Trabalho — DO-AGE-11), redirecionado ao Sucessor na remoção (B28); Decisão (`aprovada`, `rejeitada`, `expirada`, `cancelada`); Decisor; tempo limite obrigatório, com padrão único da plataforma de **72 horas**, sobrescrevível pela Política de aprovação do Agente e pela Ação da Automação (B80). **Aprovar nunca concede permissão** (INV-AGE-08): as verificações são refeitas na aprovação; no motivo `permissão`, só quem tem a permissão requerida aprova e torna-se delegante do Passo. Na Automação, aprovação concedida reavalia Condições e pré-condições (RN-AUT-16).

### 7.7 Concessão de Habilidade (habilidades.md 7.2; DO-HAB-03)

Associação N:N Agente ↔ Habilidade sem identidade própria, pertencente ao Espaço de Trabalho: Versão fixada (0..1), Concedida por (Membro), momento, **Disponibilidade** derivada (`disponível`/`indisponível` com motivos). É a única origem de `executar` sobre a Habilidade para o Agente (RN-HAB-12); nunca amplia permissões (INV-HAB-06); eliminada por qualquer dos lados (INV-HAB-08).

### 7.8 Referência de Conhecimento, Passo e Rascunho

- **Referência de Conhecimento** (conhecimento.md 7.7; DO-CNH-15): objeto de valor de saída — Documento e título à época, Versão, Fragmentos com Posição, Coleção — gravado na Execução e na Mensagem de Chat `assistente`; obrigatório em toda saída baseada em Conhecimento (RN-CNH-21); nunca apagado, resolve com marcador (RN-CNH-22). Não é Vínculo nem Proveniência.
- **Passo** (agentes.md 7.3; automacoes.md 7.7): objeto de valor ordenado da Execução, sem identidade (identificador local). Tipos na Execução de Agente: chamada de Ferramenta (com as duas permissões avaliadas, classe de efeito, Registro de Atividade), **Exercício de Habilidade** (DO-HAB-11: Habilidade + versão à época, origem `solicitado`/`espontâneo`, Passos aninhados), Solicitação de Aprovação, raciocínio, memorização. Na Execução de Automação: Condição avaliada, Ação executada (resultado `concluído`, `falhou`, `pulado`, `aguardando`, `cancelado`).
- **Rascunho** (caixa-de-entrada-e-mensageria.md 7.10; DO-CXE-15): objeto de valor da **Conversa** (domínio CRM), um por Ator interno; origem `Membro`, `Agente` (sugestão gerada, com Execução de origem) ou `Sessão de Chat` (copiado). A IA o produz — Agente Atribuído em nível não `autônomo` (RN-AGE-14), Ferramenta `sugerir resposta`, texto parcial de Execução cancelada por transferência — mas ele pertence à Conversa. Enviar cria Mensagem nova com Proveniência; nunca é Mensagem `interna` nem Mensagem de Chat.

## 8. Relações

Tabela-mestra das relações do domínio, insumo para MATRIZ-DE-RELACOES.md. "Propriedade" indica se a relação é de pertencimento/contenção (o destino não existe sem a origem) — sim — ou de associação/referência — não.

| Origem | Relação | Destino | Tipo | Cardinalidade | Propriedade | Documento |
| --- | --- | --- | --- | --- | --- | --- |
| Espaço de Trabalho | contém | Agente | pertencimento | 1..N (Assistente padrão sempre) | sim | 01, 8; 17, 8 |
| Espaço de Trabalho | contém | Habilidade | pertencimento | 0..N | sim | 01, 8; 18, 8 |
| Espaço de Trabalho | contém | Automação | pertencimento | 0..N | sim | 01, 8; 19, 8 |
| Espaço de Trabalho | contém | Coleção | pertencimento | 0..N | sim | 01, 8; 20, 8 |
| Espaço de Trabalho | contém (transitivo, via Membro) | Sessão de Chat | pertencimento | 0..N | sim | 01, 8; 16, 8 |
| Espaço de Trabalho | referencia | Assistente padrão (Agente) | referência | 1 | não | 01, 8 |
| Espaço de Trabalho | contém | Concessão de Habilidade | associação contida | 0..N | sim | 18, 7.2 |
| Membro | contém | Sessão de Chat | propriedade (pertencimento) | 0..N; Sessão → Membro 1, imutável | sim | 16, 8 |
| Membro | contém | Memória do Usuário → Itens | contenção | 0..1 → 0..N | sim | 16, 7.5 |
| Membro | é Proprietário de | Agente / Automação / Coleção | propriedade | 1 por registro; Membro → 0..N | não (governança) | 17, 8; 19, 8; 20, 8 |
| Agente | contém | Versão de Agente | composição | 1..N | sim | 17, 7.1 |
| Agente | contém | Execução de Agente | composição | 0..N | sim | 17, 7.2 |
| Agente | contém | Memória do Agente → Item de Memória | composição | 1 → 0..N | sim | 17, 7.5 |
| Execução de Agente | contém | Solicitação de Aprovação | contenção | 0..N | sim | 17, 7.6 |
| Execução de Agente | compõe-se de | Passo (inclui Exercício de Habilidade) | objeto de valor | 0..N | sim | 17, 7.3; 18, 7.3 |
| Execução de Agente | grava | Composição do Contexto; Referências de Conhecimento; Custo | objeto de valor | 1; 0..N; 1 | sim | 17, 7.2 |
| Agente | tem Papel | Papel | referência | 1 (Convidado padrão; nunca governança) | não | 17, 8 |
| Versão de Agente | usa | Modelo | referência (uso) | 1 ou `padrão da plataforma` | não | 17, 8 |
| Versão de Agente | tem permitidas (`executar`) | Ferramenta | permissão (concessão na configuração) | 0..N | não | 17, 7.7 |
| Agente | tem concedidas | Habilidade | associação (Concessão de Habilidade) | N:N (0..N ambos os lados) | não | 18, 7.2 |
| Coleção | concede acesso a | Agente | permissão (`ver`, opcionalmente `criar`/`editar`), gravada na Coleção | N:N | não | 20, 17.3 |
| Recurso (qualquer) | concede / compartilha com | Agente (Sujeito) | permissão | 0..N | não | 17, 17.3 |
| Tarefa | tem Responsável | Agente | associação (referência inversa) | 0..N; exige `ver` | não | 06, 8; 17, 8 |
| Conversa | tem Atribuído | Agente | associação (referência inversa) | 0..1 por Conversa | não | 14; 17, 8 |
| Sessão de Chat | usa como principal | Agente | referência | 0..1 (vazio = Assistente padrão) | não | 16, 8 |
| Sessão de Chat | usa | Modelo (escolhido) | referência | 0..1 | não | 16, 8 |
| Sessão de Chat | contém | Mensagem de Chat | composição | 0..N | sim | 16, 7.2 |
| Sessão de Chat | ancora-se a | Tarefa, Negócio, Contato, Empresa, Conversa, Documento, Espaço, Pasta, Subpasta, Lista | referência (Âncora, objeto de valor) | 0..1, imutável | não | 16, 7.4 |
| Sessão de Chat | é compartilhada com | Membro, Equipe | permissão (`ver`, `registro`) | 0..N; nunca Agente | não | 16, 17 |
| Execução de Agente | tem origem em | Sessão de Chat | referência | 0..1 | não | 16, 8 |
| Mensagem de Chat `assistente`/`ferramenta` | é saída de | Execução de Agente | referência | 1 | não | 16, DO-CHT-04 |
| Mensagem de Chat | referencia | Arquivo | referência | 0..N | não | 16, 8 |
| Execução de Agente | invoca (Ferramenta `invocar Agente`) | Execução de Agente (filha) | associação transitória entre Execuções | 0..N filhas; pai 0..1 | não | 17, DO-AGE-08 |
| Execução de Agente | alimenta / consome | Memória do Usuário (Itens) | referência | 0..N | não | 16, 8 |
| Habilidade | contém | Versão de Habilidade | composição | 1..N | sim | 18, 7.1 |
| Versão de Habilidade | requer | Ferramenta | referência (uso) | 0..N (obrigatória/opcional) | não | 18, 8 |
| Versão de Habilidade | depende de | Habilidade | associação (Dependência), acíclica | 0..N; profundidade ≤ Limite | não | 18, 8 |
| Versão de Habilidade | recomenda | Coleção | referência (declaração) | 0..N | não | 18, 8 |
| Automação | tem escopo em | Espaço de Trabalho / Espaço / Pasta / Subpasta / Lista / Funil / Caixa de Entrada / Fila | referência essencial | 1, imutável; eliminada com o escopo | não (mas dependente) | 19, 8; B41; DO-CXE-16 |
| Automação | tem Papel | Papel | referência | 0..1 | não | 19, 8 |
| Automação | contém | Versão de Automação | composição | 1..N | sim | 19, 7.1 |
| Automação | contém | Execução de Automação | composição | 0..N | sim | 19, 7.7 |
| Versão de Automação | compõe-se de | Gatilho; Condições; Ações; Política de erro; Regra de Agendamento | objeto de valor | 1; 0..N; 1..N; 1; 0..1 | sim | 19, 7.2–7.6 |
| Ação "invocar Agente" | invoca | Agente | referência (uso) | 1 (padrão Assistente padrão) | não | 19, 7.4 |
| Ação "invocar Agente" | indica | Habilidade | referência | 0..1 | não | 19, 8 |
| Ação de escrita | usa | Ferramenta | referência (uso) | 1 | não | 19, DO-AUT-05 |
| Execução de Automação | é mãe de | Execução de Agente | referência (contenção lógica, B18) | 0..N; filha → mãe 0..1 | não (a filha pertence ao Agente) | 19, 4.9 |
| Execução de Automação | contém | Solicitação de Aprovação | contenção | 0..N | sim | 19, 7.7 |
| Gatilho `evento` | escuta | Eventos do escopo e descendentes | referência por tipo | — | não | 19, 7.2 |
| Agente (Ferramenta `acionar Automação`) | aciona | Automação (Gatilho manual) | referência; exige `executar` | 0..N | não | 19, RN-AUT-19 |
| Coleção | contém | Fonte | contenção | 1..N (uma `envio manual`) | sim | 20, 8 |
| Coleção | contém | Documento de Conhecimento | contenção | 0..N | sim | 20, 8 |
| Documento | tem Fonte | Fonte (mesma Coleção) | referência obrigatória | 1 | não | 20, 8 |
| Documento | contém | Versão de Documento | composição | 1..N; uma corrente | sim | 20, 8 |
| Versão de Documento | contém | Fragmento | contenção derivada | 0..N | sim | 20, 8 |
| Versão de Documento | referencia | Arquivo | referência | 0..1 | não | 20, 8 |
| Documento | contém | Comentário | contenção (agregado) | 0..N | sim | 20, 7.6 |
| Documento | vincula-se a | Tarefa, Negócio, Contato, Empresa, Documento | associação (Vínculo) | 0..N | não | 20, DO-CNH-07 |
| Fonte `Integração` | referencia | Integração | referência | 1 | não | 20, 8 |
| Execução de Agente / Mensagem `assistente` | cita | Documento, Versão, Fragmentos, Coleção | Referência de Conhecimento (objeto de valor) | 0..N | não | 20, 7.7 |
| Execução de Agente | produz | Rascunho (Conversa) | referência inversa (o Rascunho referencia a Execução) | 0..1 por Conversa e Ator | não | 14, 7.10 |
| Registro criado por IA (Tarefa, Documento, Mensagem, Comentário...) | tem Proveniência a | Sessão / Execução / Automação | Proveniência (objeto de valor no destino) | — | não | 16, 8; 19, RN-AUT-26 |
| Agente / Automação | é instanciado ou duplicado de | Template de Agente / Template de contêiner / Automação | Proveniência | 0..1 | não | 17, DO-AGE-12; 19, 4.8 |
| Registro de Atividade | referencia como ator (com delegante) e como objeto | Agente, Automação, Execução, Sessão, Coleção... | referência inversa | — | não | A6.2; todos |
| Widget (Painel) | tem como Fonte de Dados | Execução de Agente / de Automação; Solicitação de Aprovação; Documento de Conhecimento (só catálogo e uso; Coleção apenas como escopo da Fonte — B101); Exercícios, "Conhecimento consultado" e custo por Cadeia como Dimensão/Métrica derivada | referência inversa | — | não | 17, 8; 19, 8; 20, 18; 21, DO-PAI-05 |

Distinção aplicada ao domínio: **CONTER** (Versões, Execuções, Memória do Agente, Solicitações, Mensagens de Chat, Fontes, Documentos, Fragmentos); **pertencer** (ao Espaço de Trabalho; Sessão ao Membro); **USAR** (Modelo, Ferramenta, Contexto, Agente por Sessão e por Ação); **REFERENCIAR** (escopo, Papel, âncora, Arquivo, Habilidade indicada, Proveniência); **RELACIONAR-SE** (Concessão de Habilidade, Dependência, Responsável, Atribuído, Vínculo, invocação entre Execuções); **CONFIGURAR** (Sessão configura a si; Automação impõe autonomia máxima; Coleção concede a Agentes) — nunca torna o configurado filho de quem configura. **HERDAR**: só a permissão da Coleção pelos Documentos e Fragmentos, e os escopos de Automação pelo caminho (B25).

## 9. Cardinalidades

As cardinalidades estão justificadas em cada documento (16–20, seção 9). Consolidam-se as que estruturam o domínio:

| Relação | Cardinalidade | Justificativa resumida | Onde |
| --- | --- | --- | --- |
| Espaço de Trabalho → Agente | 1..N | O Assistente padrão sempre existe (B33, INV-ET-09). | 17, 9 |
| Agente → Proprietário | 1 | A7, B7: accountability humana; zero ou vários quebrariam. | 17, 9 |
| Agente → Papel; Automação → Papel | 1; 0..1 | B30 (um Papel por Sujeito); Automação sem Papel age só por concessões (DO-AUT-01). | 17, 9; 19, 9 |
| Agente → Habilidade | 0..N ↔ 0..N (Concessão) | B15: Agente sem Habilidade é válido; Habilidade não concedida é válida. | 18, 9 |
| Agente → Modelo (Versão) | 1 ou `padrão da plataforma` | DO-AGE-04; Modelos secundários em aberto. | 17, 9 |
| Agente → Memória do Agente | 1 (0..N Itens) | Criada com o Agente, vazia. | 17, 9 |
| Membro → Memória do Usuário | 0..1 (0..N Itens) | Uma por Membro por Espaço de Trabalho. | 16, 9 |
| Execução → Ator invocador; → ator delegante | 1; 0..1 | B18; vazio (Origem `Caixa de Entrada`) ou delegante Automação = autônoma; só o delegante Membro entra na interseção (A9.3; RN-AUT-25). | 17, 9; 19, 9 |
| Execução de Automação → Execução de Agente filha | 0..N; inversa 0..1 | B18; contenção lógica. | 19, 9 |
| Execução de Agente → Execução filha (invocação) | 0..N; sem Agente repetido; profundidade ≤ Limite da Cadeia de Execuções | DO-AGE-08; B79. | 17, 9 |
| Sessão → Agente principal; → Âncora; → Execução não terminal | 0..1; 0..1 imutável; ≤ 1 por vez | B21; DO-CHT-03; RN-CHT-09. | 16, 9 |
| Mensagem `assistente` → Execução de origem | 1 | DO-CHT-04: não há resposta sem Execução. | 16, 9 |
| Habilidade → Versão `publicada`; Automação → Versão `publicada` | 0..N; **0..1** | Concessões fixam versão de Habilidade; ninguém fixa versão de Automação (DO-HAB-04, DO-AUT-19). | 18, 9; 19, 9 |
| Versão de Automação → Gatilho | 1 | DO-AUT-02: objeto do Gatilho com tipo único. | 19, 9 |
| Automação → escopo | 1, imutável | B41; DO-AUT-20. | 19, 9 |
| Coleção → Coleção (pai) | 0 | DO-CNH-03: sem aninhamento. | 20, 9 |
| Documento → Coleção; → Fonte; → Versão corrente | 1; 1; 1 | DO-CNH-04; INV-CNH-03; INV-CNH-06. | 20, 9 |
| Coleção → Fonte `envio manual` | 1 | INV-CNH-02. | 20, 9 |
| Solicitação → aprovador designado | 1, sempre resolúvel | Cadeia até o Proprietário do Espaço de Trabalho (DO-AGE-11). | 17, 9 |
| Habilidade → Proprietário | 0 | DO-HAB-06. | 18, 9 |

Cadeia de Execuções (B79): objeto único para Execuções de Automação e de Agente; profundidade total ≤ Limite imposto (recomendação: 5); subsequência contígua de invocações Agente → Agente ≤ sub-limite (recomendação: 3), reduzível por Agente (DO-AGE-08; RN-AUT-09). Os valores permanecem em C8.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O domínio IA não tem hierarquia de contêineres. Nenhuma entidade de IA está sob Espaço, Pasta, Lista, Funil ou Caixa de Entrada (A2.2), e nenhuma se aninha (Coleção não contém Coleção — DO-CNH-03). As únicas cadeias são de **agregado** (Agente → Versão/Execução/Memória; Coleção → Fonte/Documento → Versão → Fragmento; Sessão → Mensagem) e a **Cadeia de Execuções**, transitória (disparo e invocação entre Execuções de Automação e de Agente — B79), que não é hierarquia de entidades: terminada a Execução, restam referências.

**Pertencimento (teste de existência).**

| Contêiner | Contém | O contido existe sem o contêiner? |
| --- | --- | --- |
| Espaço de Trabalho | Agentes, Habilidades, Automações, Coleções, Sessões (via Membro), Concessões de Habilidade | Não (B32). Habilidades e Ferramentas da plataforma e Modelos existem sem ele (globais). |
| Agente | Execuções de Agente, Memória do Agente e Itens, Versões, Solicitações (via Execução) | Não. Eliminado o Agente, tudo isso é eliminado (documento 17, 12.5). |
| Automação | Execuções de Automação, Versões | Não (DO-AUT-17). As Execuções de Agente filhas existem sem a mãe (pertencem ao Agente). |
| Coleção | Fontes, Documentos | Não. |
| Documento | Versões, Fragmentos, Comentários | Não. |
| Sessão de Chat | Mensagens de Chat | Não. Execuções originadas na Sessão existem sem ela (pertencem ao Agente). |
| Membro | Memória do Usuário, Sessões de Chat | Não. Na remoção do Membro vão à lixeira e são eliminadas ao fim do prazo, salvo reconvite (DO-CHT-16; B87). |

**Associações (nenhum lado depende do outro).** Agente — Habilidade (Concessão de Habilidade, eliminada por qualquer dos lados — INV-HAB-08); Agente — Coleção (concessão gravada na Coleção — DO-CNH-12); Agente — Ferramenta (`executar` na configuração do Agente — 7.7 do documento 17); Sessão → Agente principal (uso; Agente arquivado torna o principal indisponível, a Sessão permanece — DO-CHT-12); Automação → Agente (invoca; Agente eliminado torna a Ação inválida — RN-AUT-21); Execução de Automação ⊃ Execução de Agente (contenção **lógica**: a filha pertence ao Agente, é referenciada e cancelada em cascata pela mãe — INV-AUT-09); Agente → Modelo (referência a entidade global; descontinuação torna o Agente indisponível, nunca o elimina — DO-AGE-04); Habilidade → Habilidade (Dependência acíclica; eliminar a requerida torna a dependente indisponível — 18, 10); Automação → escopo (referência essencial: a Automação **não sobrevive** à eliminação do escopo, sem ser contida por ele — B41).

**Propriedade.** Propriedade é governança, não contenção (documento 01, 10). Têm Proprietário — sempre um Membro, nunca um Agente (B7, INV-AGE-03) — Agente, Automação, Coleção e Sessão de Chat (A7). Não têm: Habilidade (DO-HAB-06; governança por Papel e `administrar`; Criador e Publicador para rastreabilidade), Fonte (Membro configurador — DO-CNH-05), Documento, Versão, Fragmento, Execução, Solicitação, Concessão, Ferramenta, Modelo. Consequências: (a) só registros com Proprietário entram na sucessão de B28 (Agente, Automação, Coleção — nunca Sessão e Memória do Usuário, exceção única); (b) o Proprietário tem `administrar` por propriedade (Agente, Coleção); (c) para a Automação o Proprietário é também **teto** de permissões (RN-AUT-04), para o Agente **não** é (DO-AGE-15) — assimetria deliberada registrada em ambos os documentos; (d) o Assistente padrão tem como Proprietário o Proprietário do Espaço de Trabalho e acompanha a transferência (B33); (e) a cadeia de propriedade termina sempre em um humano: Fragmento → Versão → Documento → Coleção → Proprietário → Espaço de Trabalho → Proprietário do Espaço de Trabalho.

**"Pertence a" versus "relaciona-se com".** Um Agente *pertence* ao Espaço de Trabalho e *é de propriedade de* um Membro; *relaciona-se com* Habilidades, Coleções, Tarefas, Conversas, Sessões, Automações e outros Agentes. Uma Execução de Agente *pertence* ao Agente e *é referenciada* pela Sessão, pela Execução de Automação mãe, pelo Rascunho, pelas Referências e pelos Registros de Atividade. **Configurar não é conter**: conceder Habilidade configura o Agente; permitir Ferramenta não a possui; a Automação impõe autonomia sem conter o Agente; a Coleção concede acesso sem tornar o Agente parte dela; a Sessão restringe Ferramentas sem contê-las.

## 11. Estados

Todos os estados do domínio são **estados de sistema** (A4.1), não personalizáveis; nenhuma entidade de IA tem Status (A4.2). Exceções a A4.1 já registradas: Agente (DO-AGE-10) e Automação (DO-AUT-09). Condições derivadas não são estados.

| Entidade | Estados | Exceção a A4.1? | Condições derivadas (não são estados) | Onde |
| --- | --- | --- | --- | --- |
| Agente | `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira` (+ Estado próprio anterior à exclusão, B43; desarquivar e restaurar devolvem `pausado`, nunca `ativo` — B94) | **Sim** (DO-AGE-10): `rascunho` (não invocável, salvo ensaio) e `pausado` (não aceita novas Execuções; responsabilidades preservadas). Assistente padrão: só `ativo` (INV-AGE-11). | Disponibilidade (`disponível`/`indisponível` com motivo) | 17, 11 |
| Versão de Agente | Sem estado (imutável; corrente = maior número) | — | — | 17, 7.1 |
| Automação | `rascunho`, `ativo`, `pausado`, `arquivado`, `na lixeira` (+ Estado anterior à exclusão; restaurar devolve `pausado`, nunca `ativo` — RN-AUT-05) | **Sim** (DO-AUT-09) | Inoperante (escopo não efetivamente `ativo`, ET `suspenso`, Proprietário `suspenso`, referência inválida); Natureza (`determinística`/`híbrida`) | 19, 11.1 |
| Versão de Automação | `rascunho` (0..1), `publicada` (0..1), `obsoleta` | — (estado de versão) | — | 19, 11.3 |
| Habilidade | `ativo`, `arquivado`, `na lixeira` | Não | — | 18, 11.1 |
| Versão de Habilidade | `rascunho` (0..1), `publicada` (0..N), `obsoleta` | — (estado de versão) | Versão corrente (derivada) | 18, 11.2 |
| Concessão de Habilidade | Sem estado | — | Disponibilidade (`disponível`/`indisponível` com motivos) | 18, 11.3 |
| Sessão de Chat | `ativo`, `arquivado`, `na lixeira` (+ Estado próprio anterior à exclusão) | Não | Agente principal indisponível; âncora `válida`/`indisponível`/`eliminada`; Execução em andamento; aguardando aprovação | 16, 11 |
| Mensagem de Chat | Sem estado próprio (segue a Sessão) | — | `substituída` | 16, 11 |
| Item de Memória do Usuário | `ativo`, `desativado` | — (entidade interna) | — | 16, 11 |
| Item de Memória do Agente | Sem estado; eliminado por retenção, por registro eliminado ou por Membro | — | Elegibilidade por delegante | 17, 7.5 |
| Coleção | Estado próprio `ativo`, `arquivado`, `na lixeira` (+ Estado próprio anterior à exclusão) | Não (B36/B43 estendidos — DO-CNH-09) | Privada (atributo) | 20, 11.1 |
| Documento de Conhecimento | Estado próprio `ativo`, `arquivado`, `na lixeira`; **estado efetivo** derivado da Coleção (DO-CNH-09) | Não | Estado de processamento (da Versão corrente); Desatualizado; Ausente na origem | 20, 11.1 |
| Versão de Documento | Processamento: `pendente`, `processado`, `com erro` (único atributo mutável) | — (estado de processamento, não ciclo de vida) | — | 20, 11.3 |
| Fonte | Operacional: `ativo`, `pausado`, `com erro`; sem ciclo de vida próprio (segue a Coleção); `envio manual` sempre `ativo` | — | — | 20, 11.2 |
| Fragmento | Sem estado | — | — | 20, 6.5 |
| Execução de Agente | `pendente`, `executando`, `aguardando aprovação`, `concluída`, `falhou`, `cancelada` (B18); terminais imutáveis | — (entidade interna) | Marcação `ensaio` (DO-AGE-13) | 17, 11.2 |
| Execução de Automação | Idem (B18); terminais imutáveis; `concluída` pode carregar indicador de falhas parciais | — | — | 19, 11.2 |
| Solicitação de Aprovação | `pendente`; com Decisão: `aprovada`, `rejeitada`, `expirada`, `cancelada` (terminais) | — | — | 17, 11.3 |
| Modelo | Sem estado no Espaço de Trabalho; "descontinuado" é fato da plataforma (evento) refletido na Disponibilidade do Agente | — | — | 17, 20.8; 7.4 |
| Ferramenta | Sem estado próprio; de Integração segue o estado da Integração; "descontinuada" é evento | — | — | 18, 7.4 |

Consequências transversais de estado: Agente `pausado`/`arquivado`/`na lixeira` e Habilidade `arquivado` **não cancelam** Execuções em curso (terminam na versão carregada — RN-AGE-19, DO-HAB-17); Automação `pausado` não cancela, `arquivado`/`na lixeira` **cancela** (DO-AUT-09); Sessão `arquivado` termina sem cancelar, `na lixeira` cancela (DO-CHT-05).

## 12. Ciclo de vida

O ciclo de vida de cada entidade está nos documentos 16–20 (seção 12). O que o domínio fixa como padrão comum:

1. **Criação é humana.** Agente, Habilidade, Automação, Coleção e Sessão são criados por Membro (ou pela plataforma/Sistema: Assistente padrão, Habilidades globais, Documentos por Atualização de Fonte configurada por Membro). Nenhum Agente cria, edita, publica, pausa, arquiva, concede ou reconfigura Agente, Habilidade ou Automação — inclusive a si próprio (INV-AGE-03/04, INV-HAB-04, INV-AUT-10). Agente e Automação tampouco criam ou editam Painel (RN-PAI-03; DO-PAI-08) nem Funil, Fila, Canal ou Caixa de Entrada (B95). Agente cria Documento de Conhecimento e Coleção apenas por Ferramenta, com permissão e Proveniência (RN-CNH-25, RN-CNH-01).
2. **Operação passa por Execução.** Ver 7.5 e o ciclo reduzido na seção 23: Gatilho ou Sessão → Agente (Versão corrente) → Execução → Contexto → Passos → Solicitações → efeitos com Registro de Atividade → estado terminal.
3. **Configuração não interrompe trabalho em curso** (RN-ET-17 por analogia): editar cria Versão que vale na próxima Execução; pausar/arquivar Agente ou Habilidade deixa Execuções terminarem. Interromper é ato sobre a Execução (RN-AGE-21) ou consequência de arquivar/excluir Automação ou Sessão, de suspensão do Espaço de Trabalho (B31), de transferência da Conversa, de expiração de aprovação ou de cota.
4. **Restauração devolve o Estado próprio anterior à exclusão** (B43) — com uma exceção declarada por segurança: Agente e Automação desarquivados ou restaurados da lixeira voltam a `pausado`, nunca diretamente a `ativo` (RN-AUT-05; DO-AGE-10; B94).
5. **Eliminação permanente e cascata.** Agente: elimina Versões, Memória, Execuções, Solicitações; remove Concessões e concessões em que é Sujeito; libera nada (já liberado no arquivamento); invalida referências em Automações e Sessões; Registros e Referências permanecem. Habilidade: elimina Versões; remove Concessões; Execuções passadas preservadas com o Exercício como valor. Automação: elimina Versões e Execuções (DO-AUT-17); Execuções de Agente filhas permanecem. Coleção: elimina Fontes, Documentos, Vínculos, concessões; Referências resolvem com marcador. Sessão: elimina Mensagens; preserva Arquivos, Execuções, Itens de Memória e Proveniências. Nada em IA elimina Tarefa, Conversa, Negócio, Contato ou Arquivo referenciado por outro registro (RN-CNH-24). Eliminação do Espaço de Trabalho elimina tudo (B32).
6. **Cascatas recebidas.** Membro removido: sucessão (B28) para Agente, Automação, Coleção e Solicitações pendentes; Sessões e Memória do Usuário vão à lixeira e são eliminadas por prazo, salvo reconvite (B87). Escopo eliminado: Automação eliminada (B41). Integração eliminada: Ferramentas dela deixam o Catálogo; Fontes `com erro`. Modelo descontinuado: Disponibilidade `indisponível`. Registro âncora eliminado: âncora `eliminada`; a Sessão permanece. Contato eliminado: Itens de Memória do Agente que o referenciam são eliminados (RN-AGE-23); Documentos vinculados são marcados para revisão de curadoria (DO-CNH-13).

## 13. Regras de negócio ontológicas

Regras do domínio como um todo; cada uma consolida decisões já tomadas e aponta a fonte. Nenhuma é nova.

- **RN-IA-01.** Toda execução de IA passa por um Agente e ocorre dentro de uma Execução de Agente; Automações que usam IA invocam um Agente (padrão: Assistente padrão); não existe exercício de Habilidade, consulta de Conhecimento por IA, resposta em Sessão nem consumo de Modelo em nome da organização fora de uma Execução (B17, B18; INV-HAB-09; DO-CHT-04).
- **RN-IA-02.** Agentes e Automações são Atores (A6.1) e sujeitos de autorização (A6.3) com Papel e concessões próprios, nunca Papel de governança (INV-ET-13; DO-AUT-01); nunca são Proprietários, Administradores, aprovadores ou Sucessores; nunca praticam ação de governança do Espaço de Trabalho (RN-ET-24).
- **RN-IA-03.** A permissão efetiva de toda ação de IA é avaliada **a cada Ferramenta invocada**, sobre o registro concreto, com o Sujeito efetivo: Agente ∩ delegante Membro ∩ todos os Agentes da Cadeia de Execuções, em nome de Membro; só o Agente (e os Agentes da Cadeia) em Execução autônoma — delegante Automação ou nenhum; Automação ∩ Proprietário atual (A9.3; B23; RN-AGE-13; RN-AUT-04; RN-AUT-25). Revogação durante a Execução faz a próxima chamada falhar (B23).
- **RN-IA-04.** Nenhuma relação de IA amplia acesso: Concessão de Habilidade (INV-HAB-06), aprovação de Solicitação (INV-AGE-08), Configuração da Sessão (INV-CHT-06), compartilhamento de Sessão (RN-CHT-22), invocação em cadeia (INV-AGE-07), Painel (B20), Memória (INV-AGE-10, INV-CHT-09) e Contexto (INV-AGE-09, INV-CNH-09) só restringem ou preservam.
- **RN-IA-05.** Toda ação com efeito praticada por IA gera Registro de Atividade no registro-alvo com Ator (Agente ou Automação) e ator delegante quando houver; Execuções geram Registros de início e término; a privacidade da Sessão nunca alcança o efeito (A6.2; RN-AGE-28; RN-AUT-28; INV-CHT-08).
- **RN-IA-06.** Aprovação é decidida **por Ferramenta invocada** pela classe de efeito e pelo nível de autonomia efetivo (mínimo entre o do Agente e o imposto pelo invocador — B22; DO-AGE-06), nunca pelo Efeito declarado agregado de uma Habilidade (DO-HAB-18); toda Solicitação tem objeto fixo, aprovador Membro `ativo` e prazo (INV-AGE-13); aprovar nunca concede (INV-AGE-08) e, na Automação, reavalia Condições (RN-AUT-16).
- **RN-IA-07.** Agente, Habilidade e Automação são versionados (B24); Execuções referenciam a versão usada, fixa do início ao fim; Versões publicadas e de Agente são imutáveis e nunca eliminadas enquanto a raiz existir (INV-AGE-02, INV-HAB-03, INV-AUT-02). Documento de Conhecimento versiona Conteúdo (DO-CNH-08).
- **RN-IA-08.** Só há um elemento com Gatilho no domínio: a Automação (exatamente um por Versão — DO-AUT-02). Agente (INV-AGE-14), Habilidade e Sessão (RN-CHT-24) não têm Gatilho; eventos da Sessão nunca disparam Automações; Automação nunca cria Sessão (DO-CHT-13).
- **RN-IA-09.** Conhecimento é corpus curado por ato humano com Proveniência obrigatória; registros operacionais não são Conhecimento e são acessados por Ferramentas sob a permissão do seu domínio (B19); Memória, Sessões, Conversas e resultados de Execução nunca viram Documento por inferência (INV-CNH-12; DO-CNH-13); toda saída baseada em Conhecimento grava Referência de Conhecimento (RN-CNH-21).
- **RN-IA-10.** Contexto é efêmero e gravado por referência (DO-AGE-09, DO-CHT-15); Memória do Agente é do Agente com elegibilidade por delegante (DO-AGE-07); Memória do Usuário é do Membro e nunca retém dados de terceiros (DO-CHT-11); nenhuma das três é Conhecimento.
- **RN-IA-11.** Em Espaço de Trabalho `suspenso` (B31): nenhuma Execução é criada; Execuções não terminais e Solicitações pendentes passam a `cancelada`; Gatilhos não disparam; ocorrências perdidas não são repostas; Mensagens persistidas só se tornam elegíveis a Gatilhos e a Agentes Atribuídos a partir da reativação (RN-AGE-26; RN-AUT-23; RN-CHT-25; RN-HAB-19; RN-CXE-27).
- **RN-IA-12.** Cota de IA é Limite imposto (B34, C8) verificado na criação da Execução e a cada Passo que consome Modelo; Limite de custo do Agente é configuração limitante dentro dela; atingido, a Execução em curso passa a `falhou` (motivo "cota") e novas são rejeitadas, com evento, nunca suspensão automática (RN-AGE-27; RN-ET-23). Custo é objeto de valor da Execução, nunca atributo do Agente, da Automação ou da Habilidade (DO-AGE-18).
- **RN-IA-13.** Nomes são únicos por tipo, sem distinção de maiúsculas e espaços nas extremidades, entre registros não `na lixeira` (padrão B39): Agente no Espaço de Trabalho (RN-AGE-02), Habilidade no Espaço de Trabalho (RN-HAB-02), Automação no escopo (RN-AUT-03), Coleção no Espaço de Trabalho (RN-CNH-02). Título de Sessão e de Documento não é único.
- **RN-IA-14.** A **Cadeia de Execuções** é única (B79): sequência de Execuções de Automação e de Agente ligadas por disparo (Evento cujo ator é Execução anterior; `acionar Automação`) ou invocação (Ação "invocar Agente"; Condição híbrida; Ferramenta "invocar Agente"), sem Agente repetido (auto-invocação proibida — DO-AGE-08) e sem par (Automação, objeto) repetido (DO-AUT-11), com profundidade total ≤ Limite imposto (recomendação 5) e subsequência de invocações Agente → Agente ≤ sub-limite (recomendação 3, reduzível por Agente); `acionar Automação` continua a Cadeia, nunca a reinicia (RN-AUT-19); Automação nunca reage a Evento de que é ator ou delegante (INV-AUT-08). Violação é recusada antes de criar Execução, com Registro.
- **RN-IA-15.** Nenhuma relação de IA cruza a fronteira do Espaço de Trabalho (INV-ET-07): Contexto, Memória, Sessões, Concessões, Referências, Fontes e cadeias são do Espaço de Trabalho; só Modelo, Habilidade da plataforma, Ferramenta da plataforma e Template de Agente da plataforma são globais e apenas referenciados (A1.3; DO-HAB-02; DO-AGE-12).

## 14. Invariantes

- **INV-IA-01.** Existe exatamente um Assistente padrão por Espaço de Trabalho, sempre `ativo`, com Proprietário igual ao Proprietário do Espaço de Trabalho (INV-ET-09; INV-AGE-11).
- **INV-IA-02.** Toda Execução de Agente tem exatamente um Agente, uma Versão, um Modelo concreto usado, um Ator invocador, um nível de autonomia efetivo e uma cadeia acíclica dentro da profundidade máxima (INV-AGE-06); toda Execução de Automação tem exatamente uma Versão vigente à época, um Gatilho disparador e um Ator invocador (INV-AUT-11).
- **INV-IA-03.** A permissão efetiva de uma Execução nunca excede a do Agente, a de qualquer delegante ou Agente da cadeia, nem, para a Automação, a do seu Proprietário atual (INV-AGE-07; INV-AUT-04); o nível de autonomia efetivo nunca excede o do Agente nem o imposto por qualquer invocador (B22).
- **INV-IA-04.** Nenhum conteúdo entra no Contexto, na saída, na Memória ou em Mensagem de Chat de uma Execução sem que o Sujeito efetivo tenha `ver` sobre ele no momento da Ferramenta que o obteve (INV-AGE-09; INV-CHT-07; INV-CNH-09).
- **INV-IA-05.** Nenhum Agente é Proprietário de registro algum, Criador de Agente, titular de Papel de governança ou autor de alteração de configuração de Agente, Habilidade ou Automação (INV-AGE-03/04/05; INV-HAB-04; INV-AUT-10).
- **INV-IA-06.** Nenhum Exercício de Habilidade existe fora de uma Execução de Agente; nenhuma resposta de IA em Sessão existe sem Execução; nenhuma Execução de Agente invocada por Automação existe fora da relação filha → mãe (INV-HAB-09; INV-CHT-05; INV-AUT-09).
- **INV-IA-07.** Toda Solicitação de Aprovação pendente tem aprovador Membro `ativo` e prazo; nenhuma Execução permanece `aguardando aprovação` além do tempo limite; aprovar nunca altera as permissões do solicitante (INV-AGE-08; INV-AGE-13).
- **INV-IA-08.** Item de Memória do Agente com Delegante de origem nunca entra em Contexto de Execução com delegante diferente ou sem delegante (INV-AGE-10); Memória do Usuário só é lida em Execuções em nome do seu Membro e nunca atravessa Membros ou Espaços de Trabalho (INV-CHT-09).
- **INV-IA-09.** Nenhum Documento ou Versão é criado sem ato de Ator com permissão na Coleção e Proveniência (INV-CNH-12); nenhum Fragmento existe sem Versão nem tem permissão própria (INV-CNH-10/11); toda Referência de Conhecimento sobrevive ao destino do que cita (INV-CNH-15).
- **INV-IA-10.** Toda Automação referencia exatamente um escopo existente do seu Espaço de Trabalho e não sobrevive à sua eliminação (INV-AUT-01); toda Versão de Automação tem exatamente um Gatilho (INV-AUT-03); nenhuma Automação reage a Evento de que é ator ou delegante (INV-AUT-08).
- **INV-IA-11.** Sessão de Chat tem exatamente um Proprietário, igual ao Criador, sempre Membro, imutável; nenhuma Sessão é criada por Ator não humano; só o Proprietário escreve (INV-CHT-01/02/03/04).
- **INV-IA-12.** Nenhuma Habilidade tem Proprietário, Memória, Execução própria, permissões próprias ou nível de autonomia (INV-HAB-10); nenhum Sujeito de Espaço de Trabalho altera Habilidade da plataforma (INV-HAB-07).
- **INV-IA-13.** Nenhuma relação de IA cruza a fronteira do Espaço de Trabalho (INV-ET-07; INV-AGE-06; INV-CHT-12; INV-CNH-13).

## 15. Personalização

A IA **é** o objeto de personalização do domínio: o Agente (objetivo, instruções, Modelo, Ferramentas, Habilidades, Conhecimento, Papel, autonomia, aprovação, Memória), a Habilidade (instruções, contratos, Ferramentas, Dependências), a Automação (Gatilho, Condições, Ações, Política de erro), a Coleção (Fontes, Políticas, concessões) e a Sessão (Configuração da Sessão, que só restringe) — todos detalhados nas seções 15 dos documentos 16–20. Não se aplicam a nenhuma entidade de IA: Campos Personalizados (A5.2), Tags (A8; proposta DO-CNH-06 para Documento), Comentários (A8; exceto Documento de Conhecimento — 20, 7.6), Status personalizável (A4.2), Visualizações. Templates: Template de Agente (do Espaço de Trabalho e da plataforma — DO-AGE-12); não existe Template de Habilidade (copiar — DO-HAB-07) nem de Automação (duplicar; Templates de contêiner carregam Automações — DO-AUT-16).

### 15.1 Multimodalidade

O domínio suporta conteúdo de qualquer modalidade **sem modelar infraestrutura**, por quatro mecanismos já decididos:

| Mecanismo | O que faz | Onde |
| --- | --- | --- |
| **Arquivo como entrada e saída** (A8) | Arquivos do Espaço de Trabalho entram na Execução (Entrada; Arquivos da Sessão; Anexos de Mensagem lidos por Ferramenta) e saem dela (Arquivos produzidos, Criador = Agente, delegante = Membro — DO-CHT-10). Contratos de Habilidade e de Ferramenta declaram Parâmetros de tipo Arquivo com tipos aceitos (DO-HAB-09). Nenhum é Documento de Conhecimento sem "adicionar ao Conhecimento" (DO-CNH-17). | 16, 6, 7.2; 18, 7.1; 20, RN-CNH-23 |
| **Capacidades do Modelo** (DO-HAB-10) | O Modelo declara modalidades de entrada e saída; a Habilidade deriva Capacidades requeridas do contrato; a compatibilidade é verificada na Disponibilidade e no início do exercício (RN-HAB-17), na entrada de Arquivo no Contexto (RN-CHT-19) e na consulta de Documento (RN-CNH-26). Incompatibilidade nunca converte: torna indisponível, com motivo. | 7.4 deste documento |
| **Representação derivada** (20, 7.2) | Texto derivado de Conteúdo não textual (transcrição, descrição, extração), regenerável, atribuído a Ator gerador; nunca substitui o Conteúdo; permite consulta por Modelo que não suporta o tipo; Fragmentos com Posição própria do tipo (página, intervalo de tempo, região). Mesmo padrão da transcrição de Anexo (14, 7.11). | 20, 7.2; DO-CNH-16 |
| **Anexos de Mensagem** (CRM) | Mensagens recebidas com mídia são lidas por Ferramenta sob permissão; transcrição de Anexo pertence à Mensagem e não é Fragmento (B19). | 14, 7.11; 20, 21 |

Questões correlatas em aberto: Modelos secundários por modalidade (17, 25.2) e catálogo de Capacidades (18, 25.6).

## 16. Herança

- **Da Estrutura de Trabalho**: nenhuma entidade de IA herda configuração (B25): não têm ponto de definição nem modo de herança. Exceção de mecanismo, não de entidade: as **Automações acumulam pelo caminho** como aspecto configurável dos contêineres (B25), com `bloqueado` impedindo criação em descendentes; no CRM acumulam por analogia (Espaço de Trabalho + Funil; Espaço de Trabalho + Caixa + Fila — 19, 16). Permissões que Agentes e Automações recebem sobre contêineres seguem a herança **do contêiner** (A9.2), como para qualquer Sujeito; contêiner privado os exclui (B38).
- **Dentro do domínio**: Documentos, Versões e Fragmentos herdam a permissão da Coleção — único aspecto herdado do Conhecimento (20, 16); o estado efetivo do Documento deriva da Coleção (DO-CNH-09). Nada mais é herdado: Agente não herda da Habilidade nem a Habilidade do Agente (INV-HAB-06); o Agente invocado não herda permissões, Memória, Ferramentas ou Conhecimento do invocador — só o delegante e a Autonomia máxima imposta (DO-AGE-08); a Sessão não herda do Agente (usa como teto); a cópia de Habilidade e a instância de Template não herdam da origem (Proveniência).
- **Do Proprietário**: o Agente **não** herda permissões do Proprietário (DO-AGE-15); a Automação tem o Proprietário como **teto**, não como fonte (RN-AUT-04).
- **Do Espaço de Trabalho**: Localidade, Política de lixeira e Limites impostos, como toda entidade (01, 16).
- **Entre versões**: cópia como ponto de partida, não herança.

## 17. Permissões e visibilidade

### 17.1 Atores de IA

| Aspecto | Agente | Automação | Assistente padrão |
| --- | --- | --- | --- |
| **Natureza na tupla A9.1** | Ator (A6.1) e Sujeito (A9.1). | Ator (A6.1) e Sujeito (A9.1, emendada — B88) com Papel 0..1 e concessões próprias, teto no Proprietário (DO-AUT-01). | Idem Agente. |
| **Como obtém permissões** | Papel (Convidado por padrão — DO-AGE-05; nunca Proprietário/Administrador — INV-ET-13; atribuído só por Papel de nível Administrador — RN-ET-24) + concessões diretas e compartilhamentos gravados no Recurso (Listas, Tarefas, Coleções — DO-CNH-12) + camada de Ferramentas permitidas (`executar` por Ferramenta — DO-HAB-14) + Concessões de Habilidade (`executar` por Habilidade — RN-HAB-12). Em nome de Membro: **interseção** Agente ∩ Membro (A9.3); em cadeia: interseção de toda a cadeia (RN-AGE-13); autônomo (Automação, Caixa de Entrada, agendamento): só as próprias. Nunca `administrar` sobre contêineres; nunca privatiza (B38, B46). | Papel (0..1; nunca de governança) + concessões diretas; permissão efetiva = **próprias ∩ Proprietário atual**, avaliada a cada Ação (RN-AUT-04); publicar é rejeitado se as próprias excedem o teto; Proprietário `suspenso` → teto vazio → inoperante. Ação "invocar Agente": o Agente executa com as **próprias** permissões (RN-AUT-25); acionada por Agente (`acionar Automação`): executa com as próprias, não na interseção com o acionador (DO-AUT-24). Gatilho só dispara se a Automação tem `ver` sobre o objeto (RN-ESP-20). | Como qualquer Agente: Papel Convidado, nada por ser padrão (sem Coleções, sem contêineres privados, sem Mensagens) — 17, 12.6. Configurável por Proprietário do Espaço de Trabalho e Administradores (ação de Papel — 01, 17.2). |
| **Proprietário** | Exatamente um Membro `ativo` ou `suspenso` (A7, B7); transferência por Proprietário ou Administrador para Membro `ativo` sem base Convidado (RN-AGE-04); **não** é fonte nem teto das permissões do Agente (DO-AGE-15). | Exatamente um Membro (A7); é o **teto** de permissões e o ator delegante padrão (RN-AUT-04; DO-AUT-15); transferência com aviso das Ações que passarão a falhar. | Sempre o Proprietário do Espaço de Trabalho; acompanha a transferência; não transferível por si (B33). |
| **Como as ações são registradas** (A6.2) | Ator = Agente; delegante = Membro (Sessão, ação direta; herdado na Cadeia de Execuções — DO-AGE-08) ou **Automação** (Ação "invocar Agente", Condição híbrida, inclusive por agendamento — DO-AUT-15; RN-AGE-11); vazio na Origem `Caixa de Entrada` (RN-CXE-23); no Passo aprovado por motivo `permissão`, delegante = aprovador (DO-AGE-11). A interseção de permissões só considera delegante Membro. Cada Execução: Registros de início e término; cada Ferramenta com efeito: o Registro da própria Ferramenta. | Ator = Automação; delegante = Proprietário (Gatilhos `evento`, `agendamento`, `condição temporal`) ou acionador (Gatilho `manual`: Membro ou Agente) — DO-AUT-15. Ferramentas invocadas por Agente dentro de "invocar Agente": Ator = Agente, delegante = Automação (DO-AUT-15). Comentário por Ação: autor = Automação (DO-AUT-21). Cadeia (mãe, profundidade, pares) gravada na Execução (RN-AUT-09). | Como Agente; Criador `Sistema` na versão 1. |
| **Como funciona a aprovação** (B22) | Por Ferramenta, pela classe de efeito e pelo nível efetivo = min(Agente, imposto pelo invocador) (DO-AGE-06): `assistido` aprova tudo que não é `leitura`; `supervisionado`, `irreversível` e `externa`; `autônomo`, nada. Motivo `autonomia`, `permissão` (alternativa de B23) ou `limite` (DO-AUT-18; DO-CON-13). Aprovador resolvido na criação: delegante Membro `ativo` → Aprovador declarado na Ação "invocar Agente" → configurado no Agente (Membro/Equipe) → Proprietário do Agente → Proprietário do Espaço de Trabalho; também decidível por quem tem `administrar` no Agente; no motivo `permissão`, só quem tem a permissão requerida (DO-AGE-11). Em Sessão: o Proprietário da Sessão (RN-CHT-11 — é o delegante). Tempo limite obrigatório (padrão da plataforma 72 h, sobrescrevível pela Política de aprovação — B80) → `expirada`, Execução `cancelada` (RN-AGE-18). Objeto fixo; verificações refeitas na aprovação (RN-AGE-17). | Explícita (Ação "solicitar aprovação") ou implícita (Ferramenta `irreversível`/`externa` quando a Versão declara exigir; exigência do documento da entidade a todo Ator não humano; limite de operações por Execução — RN-AUT-13). Aprovador declarado ou Proprietário da Automação; tempo limite (padrão 72 h, sobrescrevível na Ação — B80) → `cancelada`; aprovação reavalia Condições e pré-condições (RN-AUT-16) — DO-AUT-13. Impõe ao Agente invocado autonomia máxima (min), nunca amplia (RN-AUT-25). | Como Agente; nível inicial recomendado `supervisionado` (17, 25.6). |
| **Revogação durante a Execução** (B23) | Avaliada a cada Ferramenta: a próxima chamada falha (Passo "negada", evento "Permissão negada em Execução"); Execução → `falhou` ou `aguardando aprovação` (motivo `permissão`) se houver alternativa; efeitos anteriores não são revertidos (RN-AGE-15, RN-AGE-21). Vale para Papel, concessões, Concessão de Habilidade, concessão de Coleção e permissões do delegante (17, 20.4). | Avaliada a cada Ação (RN-AUT-04; B23): Ação falha; Política de erro decide (`interromper` padrão); efeitos permanecem; Proprietário notificado (RN-AUT-18). Redução de permissões do Proprietário reduz o teto na próxima Ação (19, 20.4). | Como Agente. |
| **Suspensão do Espaço de Trabalho** (B31) | Nenhuma Execução criada; `pendente`/`executando`/`aguardando aprovação` → `cancelada` (motivo "suspensão"); Solicitações pendentes canceladas; Agente Atribuído não invocado por Mensagens persistidas; nada retomado na reativação; estado do Agente preservado; Disponibilidade volta sem ato (RN-AGE-26). | Nenhum Gatilho dispara; Execuções não terminais e filhas → `cancelada`; ocorrências e Eventos do período não repostos; Mensagens persistidas elegíveis só a partir da reativação (RN-AUT-23). | Como Agente. |
| **Sucessão** (B28) | Proprietário removido → Agente passa ao Sucessor no mesmo ato; Solicitações pendentes de que o removido era aprovador → Sucessor; Execuções autônomas continuam; Execuções em nome do removido falham na próxima Ferramenta (interseção vazia); permissões do Agente não mudam, mesmo que o Sucessor seja Administrador (DO-AGE-15; 17, 20.3; 01, 20.6). Itens de Memória com Delegante de origem = removido nunca mais entram em Contexto (INV-AGE-10). | Proprietário removido → Automação passa ao Sucessor, **continua `ativo`**, Sucessor notificado com a lista; teto passa a ser o do Sucessor (DO-AUT-14). Proprietário `suspenso` → inoperante. | Acompanha a transferência de propriedade do Espaço de Trabalho (B26, B33); o Proprietário do Espaço de Trabalho nunca é removido sem transferência prévia (RN-ET-05). |

### 17.2 Recursos de IA e ações

Cada entidade de IA é Recurso da tupla (A9.1) com ações `ver`, `criar`, `editar`, `excluir`, `administrar` e `executar` definidas no seu documento (17, 17.1; 18, 17.1; 19, 17.1; 20, 17.1; 16, 17.1). Padrões comuns: escopos `registro` e `próprios` (Proprietário/Criador — B29); `subárvore` só indiretamente para Automações (por `administrar` no contêiner de escopo); o Proprietário tem `administrar` por propriedade (Agente, Coleção); governança de Agentes, Habilidades e Automações é concedível por concessão direta (não é governança do Espaço de Trabalho no sentido de B30), exceto **atribuir Papel a Agente**, que é governança (RN-ET-24). Sobre a Sessão de Chat, nenhum Papel — inclusive Proprietário do Espaço de Trabalho e Administrador — dá `ver`; só o compartilhamento pelo Proprietário; o ato de governança de B38b não se aplica (DO-CHT-09). "Criar Sessão" não é permissão própria: decorre de `executar` sobre o Agente principal efetivo (DO-CHT-08).

### 17.3 Visibilidade de Execuções, Contexto e Memória

Execuções, Passos, Composição do Contexto, Solicitações e Itens de Memória são visíveis a quem tem `ver` no Agente ou na Automação, com **resolução das referências pela permissão de quem lê** ("registro sem acesso"); o delegante vê a sua Execução ainda sem `ver` no Agente (17, 17.4; 19, 17.1). Painéis sobre Execuções filtram pelo visualizador (B20) e nunca expõem Mensagens de Chat (RN-CHT-24). Memória do Usuário nunca é exibida a terceiros.

### 17.4 IA sujeita às mesmas regras — síntese

Não há atalho em nenhum ponto do domínio: Agente é Sujeito (A6.3); Automação tem teto (RN-AUT-04); a Concessão de Habilidade não amplia (INV-HAB-06); aprovar não concede (INV-AGE-08); Memória não vaza (INV-AGE-10); cadeia só restringe (INV-AGE-07); Sessão só restringe (INV-CHT-06); Coleção é o único Recurso do Conhecimento e o Assistente padrão nasce sem nenhuma (20, 17.5); o Sistema age apenas por regra (eliminação por prazo, expiração, retenção, resolução do Modelo `padrão da plataforma`, Indexação), com Registro quando produz efeito; a plataforma publica Modelos, Templates e Habilidades globais fora da ontologia dos Sujeitos (01, 17.4).

## 18. Eventos relevantes

Consolidação por entidade; os dados essenciais e consumidores estão na seção 18 do documento fonte. Todos geram Registro de Atividade com Ator e delegante (A6.2), exceto "Mensagem `usuário` gravada" (RN-CHT-28).

| Grupo | Eventos | Documento fonte | Observações transversais |
| --- | --- | --- | --- |
| Agente | criado; Versão criada; Papel atribuído/alterado; propriedade transferida; ativado/pausado/reativado; arquivado/lixeira/restaurado/eliminado; Disponibilidade alterada; Limite atingido; ensaio executado; Item de Memória criado/editado/eliminado; Agente invocou Agente | 17, 18 | Gatilhos de Automação em escopo Espaço de Trabalho; "Modelo descontinuado" e "Template de Agente da plataforma atualizado" são eventos da plataforma consumidos aqui |
| Execução de Agente | criada/iniciada; Passo com efeito executado (= Registro da Ferramenta); Permissão negada em Execução; Solicitação criada/decidida/expirada/cancelada; concluída/falhou/cancelada | 17, 18 | "Execução concluída/falhou" são Gatilhos (19, 7.2); consumidos por Execução de Automação mãe, Execução invocadora, Sessão, Caixa de Entrada (Rascunho/Mensagem), Painéis |
| Sessão de Chat | criada; renomeada; Agente principal/Modelo/Restrição alterados; Mensagem `usuário` gravada (sem Registro); Execução originada/concluída/falhou/cancelada/aguardando aprovação; Ferramenta invocada na Sessão; Mensagem substituída; Arquivo enviado/gerado; Arquivo não suportado; compartilhada/revogada; arquivada/excluída/restaurada/eliminada; âncora indisponível/eliminada; Agente principal indisponível; Memória do Usuário (Item gravado/removido/desativado; habilitada/desabilitada); Limite atingido | 16, 18 | **Nenhum é Gatilho de Automação** (RN-CHT-24); eventos das Ferramentas sobre registros-alvo são Gatilhos normais |
| Habilidade | criada; renomeada; rascunho criado/descartado; Versão publicada/obsoletada; concedida/revogada; versão fixada/liberada; Disponibilidade alterada; arquivada/lixeira/restaurada/eliminada; Habilidade da plataforma atualizada/obsoletada/arquivada; Ferramenta descontinuada; Exercício iniciado/concluído/falhou/cancelado (evento da Execução) | 18, 18 | "Ferramenta descontinuada" é consumido também por Automações (Ações inválidas) |
| Automação | criada; renomeada/propriedade/Papel/concessões/"Reage a Eventos" alterados; rascunho criado/descartado; Versão publicada; publicação rejeitada; ativada/pausada/retomada/arquivada/restaurada/lixeira/eliminada; inoperante/operante; acionada manualmente; referência inválida detectada | 19, 18 | Consome: suspensão/reativação do Espaço de Trabalho; escopo arquivado/restaurado/eliminado; Proprietário removido/suspenso; alterações em Agente, Habilidade, Ferramenta, Integração, Definição de Campo |
| Execução de Automação | criada (disparo); iniciada/concluída/falhou/cancelada; aguardando aprovação/aprovação concedida/rejeitada/vencida; Passo executado/falhou/pulado/retentado; disparo recusado por ciclo/profundidade; disparo recusado por idempotência; Limite de operações atingido | 19, 18 | "Execução concluída/falhou" é Gatilho de outras Automações só com "Reage a Eventos de Automações" (DO-AUT-11) |
| Conhecimento | Coleção criada/renomeada; propriedade transferida; privada/pública; permissão concedida/revogada; compartilhada; Concessão a Agente criada/revogada; Coleção arquivada/.../eliminada; Fonte adicionada/reconfigurada/pausada/reativada/eliminada; Fonte com erro; Atualização iniciada/concluída; Documento criado; Versão criada; Documento processado/com erro; Documento atualizado; movido; arquivado/desarquivado (ato, ausente na origem, reapareceu); excluído/restaurado/eliminado; Versão eliminada por retenção; Fragmentos regenerados; Comentário; Vínculo criado/removido; **Conhecimento consultado**; Limite atingido | 20, 18 | Gatilhos disponíveis em escopo Espaço de Trabalho (Coleção não é escopo — 20, 25.4); "Conhecimento consultado" é registrado na Execução |
| Plataforma (consumidos pelo domínio) | Modelo descontinuado; Template de Agente da plataforma atualizado; Habilidade da plataforma atualizada/obsoletada/arquivada; Ferramenta descontinuada | 17, 18; 18, 18 | Fatos fora da ontologia dos Sujeitos; refletidos em Disponibilidade e notificação a Administradores |

## 19. Dependências

**O domínio depende de:** Espaço de Trabalho (pertencimento, Assistente padrão, Limites impostos, Localidade, Política de lixeira, `suspenso`, Papéis, sucessão — documento 01); Membro (Proprietário, Criador, delegante, aprovador, Sucessor, Memória do Usuário); entidades globais (Modelo e Capacidades; Habilidade, Ferramenta e Template de Agente da plataforma — A1.3 e propostas DO-HAB-02/DO-AGE-12); Integrações (Ferramentas de Integração; Fontes `Integração` — 01, 7.4; B35); Arquivo (A8); Registro de Atividade (A6.2); Tipos de Campo como sistema de tipos dos contratos (A5.3); catálogo de Eventos de cada entidade (seções 18 dos documentos 02–14) para Gatilhos; escopos de Automação (documentos 02–05, 13, 14); Conversa e Rascunho (documento 14); Tarefa (Responsável — documento 06); Contato, Empresa, Negócio (Ferramentas sob permissão — documentos 10–12).

**Dependem do domínio:** Tarefa (Agente Responsável; Automações do caminho; âncora; RN-TAR-27); contêineres (Automações com escopo; RN-ESP-20; DO-LIS-13); Caixa de Entrada e Conversa (Agente Atribuído; Rascunho; Automações de Fila; Ferramentas de mensageria — RN-CXE-12/23/26); Funis e Negócios (Gatilhos e Ações sobre Etapas; Vínculo com Documento); Contatos e Empresas (Vínculos com Documento; qualificação por Agente; criação em lote por Automação); Painéis (entidades-alvo Execução de Agente, Execução de Automação e Solicitação de Aprovação; Exercícios, Coleções e "Conhecimento consultado" como Dimensão ou Métrica derivada; Ferramenta `ler Painel` — documento 21, DO-PAI-05/17); Espaço de Trabalho (INV-ET-09; sucessão de Agentes, Automações e Coleções; Memória do Usuário no Membro — DO-CHT-11).

**Dependências internas ao domínio** (ordem de leitura recomendada): Habilidades (18) fixa Ferramenta (DO-HAB-13), Capacidades do Modelo (DO-HAB-10), Concessão e Exercício; Agentes (17) fixa Execução de Agente, Passo, Contexto, Memória do Agente, Solicitação, Cadeia de Execuções, nível efetivo, `padrão da plataforma`, ensaio (DO-AGE-14; B79); Chat (16) fixa Sessão, Mensagem de Chat, Memória do Usuário e o Contexto de Sessão; Automações (19) fixa Execução de Automação, Gatilho, Condição, Ação, cadeia de atribuição; Conhecimento (20) fixa Coleção, Fonte, Documento, Versão, Fragmento, Referência de Conhecimento e a concessão a Agentes. Este documento consolida e não redefine.

## 20. Casos limítrofes e ambiguidades

Cenários transversais resumidos; a resolução completa está no documento indicado.

### 20.1 Agente sem Habilidade
Válido (B15): age por instruções, Ferramentas permitidas e Conhecimento acessível; Execuções sem Exercícios. Quando dois Agentes precisam do mesmo roteiro, ele vira Habilidade. — 17, 20.1; 18, 4.

### 20.2 Habilidade em vários Agentes
A mesma versão é exercida por todos; o que difere é o Agente (permissões, autonomia, Modelo): para um a Concessão pode estar `indisponível` (Ferramenta obrigatória não permitida; Modelo incompatível). Nova versão publicada alcança no próximo exercício quem segue a corrente; quem fixou não muda. Arquivar a Habilidade torna todas as Concessões `indisponível` sem versionar Agentes; eliminá-la remove as Concessões e versiona cada Agente pelo Sistema. — 18, 20.1, 20.2, 20.5; 17, 20.2.

### 20.3 Documento removido durante Execução
O Contexto já montado permanece; a Execução termina com o que tem; a próxima consulta não encontra o Documento (estado efetivo `na lixeira`); a Referência de Conhecimento gravada resolve com marcador, preservando identificador e título à época. A resposta não é invalidada retroativamente. — 20, 20.1; RN-CNH-22.

### 20.4 Permissão revogada durante Execução
Avaliação a cada Ferramenta (B23): a próxima chamada é negada; Execução → `falhou` ou `aguardando aprovação` com motivo `permissão` (aprovador que tenha a permissão torna-se delegante do Passo); efeitos anteriores permanecem. Mesmo tratamento para Concessão de Habilidade, concessão de Coleção, Papel do Agente, e para a Automação (teto reduzido → Ação falha; Política de erro). — 17, 20.4; 18, 20.2; 20, 17.3; 19, 20.4.

### 20.5 Automação executada por Agente
Agente aciona Gatilho manual por Ferramenta `acionar Automação` (com `executar` e Ferramenta permitida); a Execução de Automação nasce com Ator invocador = Agente e delegante das Ações = Agente; executa com as **próprias** permissões da Automação, não na interseção com o acionador; a Cadeia de Execuções continua a partir da Execução do Agente, nunca reinicia (B79). Não é "Agente invoca Automação" no sentido de B16. — 19, 20.1; DO-AUT-24.

### 20.6 Agente invocando Agente
Permitido só por Ferramenta `invocar Agente` (permitida ao invocador; `executar` sobre o invocado do invocador e do delegante Membro; invocado `ativo`): Execução filha herda delegante e Cadeia de Execuções, nível efetivo ≤ o da invocadora, permissão = interseção dos Agentes da Cadeia e do delegante Membro, custo próprio. Sem Agente repetido (auto-invocação incluída); profundidade total ≤ Limite da Cadeia e subsequência Agente → Agente ≤ min(Profundidade máxima de cada Agente, sub-limite); violação é recusada antes de criar Execução. Se um Agente da Cadeia aciona uma Automação que invoca outro Agente, tudo é a mesma Cadeia (B79). Em Sessão, toda a Cadeia referencia a Sessão e o Membro, que precisa de `executar` sobre cada invocado; saídas aparecem com Agente autor respectivo. Não há mensagem entre Agentes fora da relação pai–filha. — 17, 20.7, DO-AGE-08; 16, 20.14, DO-CHT-17.

### 20.7 Proprietário removido
Sucessão no mesmo ato (B28): Agente, Automação e Coleção passam ao Sucessor; Solicitações pendentes idem; Execuções autônomas continuam; Execuções em nome do removido falham na próxima Ferramenta; permissões do Agente não mudam; Automação continua `ativo` com o teto do Sucessor; Coleção privada nunca fica inacessível (Proprietário tem `administrar` por propriedade). Sessões e Memória do Usuário do removido não são sucedidas: vão à lixeira e são eliminadas por prazo, salvo reconvite (DO-CHT-16; B87). Habilidades não entram na sucessão (sem Proprietário). — 17, 20.3; 19, 20.5; 20, 20.4; 16, 20.1; 01, 20.6.

### 20.8 Espaço de Trabalho suspenso
Nenhuma Execução é criada; todas as não terminais e Solicitações pendentes → `cancelada` (motivo "suspensão"); nenhum Gatilho dispara; Habilidades não são exercidas nem publicadas; Rascunhos gerados permanecem; Mensagens persistidas não invocam Agentes Atribuídos nem disparam Gatilhos até a reativação; nada é retomado retroativamente; Agentes mantêm o estado e a Disponibilidade volta sem ato. — 17, 20.16; 19, 20.6; 16, 20.7; RN-HAB-19; 14, RN-CXE-27.

### 20.9 Custo acima do limite
Limite de custo do Agente ou cota de IA atingidos: a Execução em curso passa a `falhou` (motivo "cota"; não `cancelada`); Passos anteriores mantêm efeitos; novas Execuções são rejeitadas (`cancelada` na criação) até o próximo período ou elevação do limite por Administrador (não versionada); evento "Limite atingido"; nunca suspensão do Agente ou do Espaço de Trabalho. Agente Atribuído deixa de responder; a Fila pode redistribuir por Automação. Limite de operações por Execução de Automação (escritas) leva a `aguardando aprovação` com Solicitação ao Proprietário (RN-AUT-13). — 17, 20.12; RN-AGE-27; 19, 20.18; RN-ET-23.

### 20.10 Outros já resolvidos nos documentos
Agente criado ou alterado por Agente (proibido — 17, 20.13, 20.15); Automação criada por Agente ou por Automação (proibido — 19, 20.14, 20.15); Automação que invoca Agente cujo Evento a dispararia (não reage a Evento de que é delegante — 19, 20.2); Modelo descontinuado (Disponibilidade, sem estado — 17, 20.8); Agente `pausado` Responsável por Tarefas (preserva; não age — 17, 20.9); Agente em nome de Convidado (interseção quase vazia — 17, 20.10; 16, 20.12); Agente com Coleção que o delegante não vê (não usa — 20, 20.3; 17, 20.11); Memória do Usuário com dado de Contato (recusa — 16, 20.6); Arquivo em Sessão versus Documento (Contexto, não Conhecimento — 20, 20.16); duas Automações contraditórias no mesmo Evento (serialização e desempate — 19, 20.17); aprovação após o objeto mudar (reavaliação — 19, 20.13).

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer à IA | Pertence a | Por quê |
| --- | --- | --- |
| Modelo | Plataforma (global, A1.3) | Usado e referenciado; nunca possuído; sem Proprietário ou permissões. |
| Habilidade, Ferramenta e Template de Agente da plataforma | Plataforma (global) | Referenciados ou copiados/instanciados com Proveniência (DO-HAB-02; DO-AGE-12). |
| Ferramentas de Integração; credenciais | Integração (Espaço de Trabalho, B35) | A Integração é o Ator e a origem; a IA usa. |
| Rascunho de resposta | Conversa (CRM) — DO-CXE-15 | A IA o produz; a Conversa o contém, um por Ator interno. |
| Mensagem enviada por Agente ou Automação; Comentário; Tarefa, Negócio, Contato, Documento criados por IA | Registro-alvo / seu domínio | IA é Ator (e Criador); nunca Proprietário (INV-AGE-03); Proveniência aponta à Execução, Sessão ou Automação. |
| Tarefas de que o Agente é Responsável; Conversas de que é Atribuído | Tarefa; Conversa | Associações inversas (B7); liberadas, nunca eliminadas. |
| Registros de Atividade das ações de IA | Registro-alvo / Espaço de Trabalho | A IA é Ator ou objeto; o histórico é visão (A6.2). |
| Arquivos enviados ou gerados | Espaço de Trabalho (A8) | Referenciados por Mensagens de Chat, Execuções e Versões de Documento. |
| Memória do Usuário | Membro (documento 01, 7.1) | Pessoal; atravessa Sessões; nunca sucedida (DO-CHT-11). |
| Papel de Agente ou Automação | Espaço de Trabalho | Referenciado (B30). |
| Concessões e compartilhamentos a Agentes | Recurso concedido (Lista, Tarefa, Coleção...) | A9.1: vivem no Recurso; "Conhecimento acessível" é visão derivada. |
| Escopo de Automação | Estrutura de Trabalho / CRM | Referência essencial, não contenção (B41). |
| Comportamentos estruturais (transições de Status, Requisitos de Etapa, cascata, Recorrência, herança, distribuição por Fila, sucessão, mesclagem) | Plataforma / configuração do contêiner | Não são Automações; emitem Eventos (19, 4.4). |
| Registro de Tempo de Agente | — (não existe) | Agente não registra tempo; esforço de IA é Execução (B42). |
| Cota de IA; Limites | Limites impostos do Espaço de Trabalho (B34) | A IA está sujeita; não define. |
| Métricas de IA ("Documentos mais consultados", custo por Cadeia de Execuções, tempo até decisão de Solicitações) | Painéis (derivadas de Execuções e Solicitações — DO-PAI-05) | Nunca atributos das entidades de IA. |
| Transcrição de Anexo de Mensagem | Mensagem (CRM) | Não é Fragmento (B19; 14, 7.11). |
| Documento colaborativo; Fonte interna; Portal | D1, D5, D9 (futuro) | Fora desta versão. |
| Mecanismos de recuperação, índices, provedores | Infraestrutura | Fora da ontologia. |

## 22. Exemplos conceituais

**Exemplo 1 — Uma Conversa atravessa o domínio inteiro.** Uma Mensagem chega pelo WhatsApp na Fila "Recepção". A Automação "Triagem" (escopo Fila; Proprietária Maria) dispara (Gatilho `evento`, `ver` sobre a Conversa), avalia uma Condição híbrida invocando o Assistente padrão com a Habilidade "Classificar intenção" (Execução de Agente filha, autônoma, sem delegante; contrato de saída estruturado; Coleção "FAQ" concedida ao Assistente e consultada por Ferramenta, com Referência de Conhecimento gravada). Saída `agendamento` → a Ação "invocar Agente Agendador" impõe autonomia máxima `supervisionado`; o Agendador (`autônomo` por configuração) executa `supervisionado`: "enviar Mensagem" (`externa`) gera Solicitação de Aprovação — aprovador: o configurado na Política do Agente, porque não há delegante — e o texto fica como Rascunho da Conversa. A Atendente aprova; a Mensagem sai com Ator Agendador e delegante = a Automação "Triagem" (DO-AUT-15; RN-AGE-11); a Cadeia de Execuções é [Triagem, Assistente padrão] para a Condição e [Triagem, Agendador] para a Ação (B79). A Execução de Automação registra dois passos de Agente, versões usadas e custo agregado; cada Ferramenta com efeito tem Registro de Atividade na Conversa. Nada disso criou Sessão de Chat (DO-CHT-13).

**Exemplo 2 — Um Membro pede à IA e a governança responde.** Pedro abre uma Sessão ancorada na Tarefa T e pede ao Agente "Comercial" (principal) "resuma e envie a proposta ao decisor". Execução com origem Sessão, delegante Pedro, Contexto = T + Mensagens recentes + Memória do Usuário de Pedro + Memória do Agente (só Itens sem delegante ou com delegante Pedro). O Agente lê o Negócio vinculado (interseção: Pedro vê), gera o PDF (Arquivo, Criador = Agente, delegante = Pedro), invoca "invocar Agente" sobre "Redator" (Pedro tem `executar`; cadeia [Comercial, Redator]; Redator tenta invocar Comercial → ciclo → negada). "enviar Mensagem" em `supervisionado` → Solicitação com aprovador = Pedro (delegante), exibida na Sessão; aprovada, a Mensagem nasce na Conversa de e-mail com Ator Agente, delegante Pedro; a Sessão recebe a Mensagem `assistente` com Referências de Conhecimento. O gerente de Pedro não vê a Sessão, mas vê no Negócio e na Conversa os Registros "Agente Comercial (em nome de Pedro)". Um Administrador que retirasse `editar` de Pedro no Funil durante a Execução faria a próxima Ferramenta falhar (B23) sem reverter o PDF já gerado.

## 23. Representação gráfica textual

Convenções: `│`/`└──` contenção; `──` associação; `→` invocação/uso; `⋯` derivação/referência de valor.

### 23.1 Mapa conceitual da IA

```
PLATAFORMA (global; referenciada, nunca possuída — A1.3)
├── Modelo (0..N) ⋯ Capacidades (modalidades); um designado `padrão da plataforma`; descontinuação = evento
├── Habilidade da plataforma (0..N) ── somente leitura; concedida por Concessão; copiável (DO-HAB-02)
├── Ferramenta da plataforma (0..N) ── Catálogo global (DO-HAB-13)
└── Template de Agente da plataforma (0..N) ── instanciável; "Assistente padrão" instanciado em todo ET (DO-AGE-12)

ESPAÇO DE TRABALHO (1) ── referencia Assistente padrão (1) ── Limites impostos (cota de IA…) ── Localidade
│
├── Membro (1..N)  [único Ator humano]
│   ├── Memória do Usuário (0..1)  [habilitada?]
│   │   └── Item de Memória (0..N)  [ativo | desativado]  ⋯ origem: Sessão/Execução | Membro
│   └── SESSÃO DE CHAT (0..N)  [ativo | arquivado | na lixeira]   Proprietário = Criador, imutável; nunca sucedida
│       ├── Âncora (0..1, imutável) ⋯ Tarefa | Negócio | Contato | Empresa | Conversa | Documento | Espaço | Pasta | Subpasta | Lista
│       ├── Configuração da Sessão: Modelo escolhido (0..1) → Modelo; Restrição de Ferramentas (só reduz)
│       ├── Agente principal (0..1) → Agente   (vazio = Assistente padrão)
│       ├── Compartilhamento (0..N) ── Membro | Equipe   (`ver`; nunca Agente)
│       └── Mensagem de Chat (0..N; imutável; ordem)  [usuário | assistente | sistema | ferramenta]
│             ├── `assistente`/`ferramenta` ⋯ Execução de Agente de origem (1); Referências de Conhecimento (0..N)
│             ├── Arquivo (0..N) ⋯ Arquivo do ET  (enviado | gerado: Criador = Agente, delegante = Membro)
│             └── Substitui (0..1) ⋯ Mensagem da mesma Sessão e papel
│
├── AGENTE (1..N)  [rascunho | ativo | pausado | arquivado | na lixeira]   Ator; Sujeito; Proprietário (1 Membro); Papel (1)
│   ├── Versão de Agente (1..N, imutáveis; corrente = maior número)
│   │   ├── Objetivo · Instruções · Nível de autonomia · Política de aprovação · Profundidade máxima de invocação · Memória habilitada
│   │   ├── Modelo (1 | `padrão da plataforma`) → Modelo
│   │   ├── Ferramentas permitidas (0..N) ── `executar` → Ferramenta (Catálogo)
│   │   └── Habilidades concedidas (conjunto por identidade) ⋯ Concessão de Habilidade
│   ├── Memória do Agente (1)
│   │   └── Item de Memória (0..N) ⋯ Execução de origem; Delegante de origem (0..1); Registros referenciados
│   ├── EXECUÇÃO DE AGENTE (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]  (ensaio?)
│   │   ├── Versão · Modelo usado · Origem (Sessão | ação direta | Automação | Agente | Caixa de Entrada)
│   │   ├── Ator invocador (1) · Ator delegante (0..1: Membro | Automação) · Cadeia de Execuções · Execução pai (0..1) · Sessão de origem (0..1)
│   │   ├── Registro âncora (0..1) · Entrada · Nível de autonomia efetivo · Composição do Contexto (referências) · Custo
│   │   ├── Passo (0..N, ordenados, sem identidade)
│   │   │   ├── chamada de Ferramenta → Ferramenta  ⋯ permissão avaliada ×2 · classe de efeito · Registro de Atividade
│   │   │   │     ├── `invocar Agente` → Execução filha (outro Agente; sem ciclo; profundidade ≤ limite)
│   │   │   │     ├── `consultar Conhecimento` → Fragmentos (sob `ver` efetivo) ⋯ Referência de Conhecimento
│   │   │   │     ├── `acionar Automação` → Execução de Automação (Gatilho manual)
│   │   │   │     └── `enviar Mensagem` | `lembrar` | `adicionar ao Conhecimento` | `criar Tarefa` | …
│   │   │   ├── Exercício de Habilidade ⋯ (Habilidade, versão à época); Passos aninhados
│   │   │   ├── Solicitação de Aprovação · raciocínio · memorização
│   │   ├── Solicitação de Aprovação (0..N)  [pendente | aprovada | rejeitada | expirada | cancelada]
│   │   │     └── motivo (autonomia | permissão | limite) · objeto fixo · aprovador (Membro ativo) · Decisor · prazo
│   │   └── Saídas (texto, Parâmetros, Arquivos) ⋯ Mensagem `assistente` | Rascunho (Conversa) | registro-alvo
│   ◀── Tarefa.Responsável (0..N) · Conversa.Atribuído (0..N) · Sessão.principal (0..N) · Automação.Ação (0..N)
│   ◀── Coleção.concessão (0..N) · Recurso.concessão/compartilhamento (0..N)
│
├── Concessão de Habilidade (0..N; associação N:N sem identidade)  Agente ── Habilidade  ⋯ Versão fixada (0..1); Disponibilidade (derivada)
│
├── HABILIDADE (0..N)  [ativo | arquivado | na lixeira]   sem Proprietário; Criador
│   └── Versão de Habilidade (1..N)  [rascunho 0..1 | publicada 0..N | obsoleta]
│       ├── Instruções · Contrato de entrada · Contrato de saída (Tipos de Campo | referência | Arquivo) · Efeito declarado (derivado)
│       ├── Requisito de Ferramenta (0..N) → Ferramenta  [obrigatória | opcional]
│       ├── Dependência (0..N) ── Habilidade  (acíclica; profundidade ≤ limite)
│       └── Coleção recomendada (0..N) ⋯ Coleção  (declaração, não concessão)
│
├── AUTOMAÇÃO (0..N)  [rascunho | ativo | pausado | arquivado | na lixeira]   Ator; Proprietário (1, teto); Papel (0..1)
│   ├── escopo (1, imutável) ⋯ Espaço de Trabalho | Espaço | Pasta | Subpasta | Lista | Funil | Caixa de Entrada | Fila  (eliminada com ele — B41)
│   ├── Versão de Automação (1..N)  [rascunho 0..1 | publicada 0..1 | obsoleta]
│   │   ├── Gatilho (1): evento | agendamento (+ Regra de Agendamento) | manual | condição temporal
│   │   ├── Condições (0..N) ── Condição híbrida → Agente (saída estruturada; sem escrita)
│   │   ├── Ações (1..N, ordenadas)
│   │   │   ├── Ação de escrita → Ferramenta (Catálogo)  [classe de efeito; permissão requerida]
│   │   │   └── Ação de controle: ramificar | invocar Agente [Habilidade 0..1; autonomia máxima] | solicitar aprovação | aguardar | notificar | encerrar
│   │   └── Política de erro · Autonomia máxima imposta · Publicador
│   └── EXECUÇÃO DE AUTOMAÇÃO (0..N)  [pendente | executando | aguardando aprovação | concluída | falhou | cancelada]
│         ├── Versão · Gatilho disparador · objeto (0..1 | conjunto) · Ator invocador (Sistema | Membro | Agente) · delegante
│         ├── Cadeia de Execuções (mãe 0..1; profundidade; pares (Automação, objeto) e Agentes) · Passos (Condição | Ação) · Custo (agrega filhas)
│         ├── Execução de Agente filha (0..N) → pertence ao Agente; cancelada com a mãe
│         └── Solicitação de Aprovação (0..N)
│
├── IA › CONHECIMENTO (camada)
│   └── COLEÇÃO (0..N)  [ativo | arquivado | na lixeira]   Proprietário (1); privada?; único Recurso de permissão
│       ├── ── Agente (concessão `ver` [`criar`, `editar`]; N:N)
│       ├── Fonte (1..N)  [ativo | pausado | com erro]   envio manual (1) | URL (0..N) | Integração (0..N) ⋯ Integração
│       └── DOCUMENTO DE CONHECIMENTO (0..N)  [estado próprio; estado efetivo ⋯ Coleção]   Fonte (1); Proveniência (1); Metadado (0..1)
│           ├── Versão de Documento (1..N; imutável; uma corrente)  [pendente | processado | com erro]
│           │   ├── Conteúdo: texto próprio e/ou ⋯ Arquivo (0..1)
│           │   ├── Representação derivada (0..N; regenerável)
│           │   └── Fragmento (0..N; derivado; Posição)
│           ├── Comentário (0..N)  [nunca Conteúdo]
│           └── Vínculo ── Tarefa | Negócio | Contato | Empresa | Documento
│
├── Arquivo (0..N) ◀── Mensagem de Chat · Execução (Entrada/Saídas) · Versão de Documento
└── Registro de Atividade ◀── Ator = Agente | Automação (+ delegante); objeto = qualquer entidade de IA

Relações IA ↔ outros domínios: sempre associação, referência ou Proveniência; nunca contenção (A2.2).
Nenhuma aresta atravessa a fronteira do Espaço de Trabalho (INV-ET-07); só Modelo, Habilidade/Ferramenta/Template da plataforma são globais.
```

### 23.2 O ciclo de uma ação de IA

```
ORIGEM                                  AGENTE                 EXECUÇÃO DE AGENTE
Sessão de Chat (Membro; delegante) ─┐                          [pendente → executando]
Ação direta de Membro (delegante) ──┤                             │ Versão corrente · Modelo concreto · nível efetivo = min(Agente, imposto)
Automação (Ação "invocar Agente";   ├──→ Agente `ativo` ──→ Execução (identidade; Ator invocador; delegante 0..1; Cadeia de Execuções)
  delegante = Automação; autonomia  ─┤   (nunca dispara         │
  máxima; Aprovador 0..1)            │    sozinho)              │
Caixa de Entrada (Atribuído;        │    sozinho)              ▼
  Mensagem recebida; sem delegante)─┤                       CONTEXTO (efêmero; sob Agente ∩ delegante ∩ cadeia)
Agente (Ferramenta "invocar         │                          âncora · registros lidos · Arquivos compatíveis · Fragmentos (`ver`)
  Agente"; herda delegante e cadeia)┘                          · Memória do Agente (elegível) · Memória do Usuário (se Sessão)
                                                               · instruções (Agente, Habilidade) · Mensagens recentes
                                                                  │  gravado por referência (Composição do Contexto)
                                                                  ▼
                                                             PASSOS (ordenados)
                                                               ├── chamada de Ferramenta ── 2 verificações a cada chamada (B23):
                                                               │     permitida ao Agente? · permissão requerida no registro (Sujeito efetivo)?
                                                               │     classe de efeito × nível efetivo (B22) ──┐
                                                               ├── Exercício de Habilidade (Concessão disponível; versão fixa)
                                                               ├── consulta de Conhecimento (Coleção sob `ver`) ⋯ Referência
                                                               └── raciocínio · memorização                    │
                                                                                                               ▼
                                                             SOLICITAÇÃO DE APROVAÇÃO (quando exigida)  [aguardando aprovação]
                                                               objeto fixo · aprovador (delegante → Automação → Agente → Proprietário → ET)
                                                               aprovada (verificações refeitas) | rejeitada | expirada → cancelada
                                                                  │
                                                                  ▼
                                                             EFEITOS (sempre por Ferramenta atômica)
                                                               registro-alvo alterado/criado · Mensagem enviada · Rascunho (Conversa)
                                                               Arquivo gerado · Documento adicionado · Execução filha · Item de Memória
                                                                  │
                                                                  ▼
                                                             REGISTROS DE ATIVIDADE
                                                               início/término da Execução · um por Ferramenta com efeito no registro-alvo
                                                               (Ator = Agente; delegante = Membro | Automação | vazio | aprovador no motivo `permissão`)
                                                               · Referências de Conhecimento · Custo · eventos "Execução concluída/falhou/cancelada"
                                                                  │
                                                                  ▼
                                                             [concluída | falhou | cancelada]  →  Mensagem `assistente` (Sessão) | saída à Execução de Automação mãe
                                                                                                  | Rascunho/Mensagem (Conversa) | Gatilhos de Automações
```

## 24. Decisões ontológicas

Este documento não toma decisão nova. Registra, numeradas para referência, as decisões estruturantes já vigentes que o domínio obedece, com a sua origem. Nenhuma é RECOMENDADA aqui.

- **DO-IA-01.** Consolida **B15**: Agente não possui Habilidades; recebe Concessão (N:N); Agente sem Habilidade é válido. Detalhada em DO-HAB-03. CONSOLIDAÇÃO.
- **DO-IA-02.** Consolida **B16**: Ferramenta ≠ Habilidade ≠ Automação; só a Automação tem Gatilho; Automação invoca Agente, Agente não invoca Automação (pode acionar Gatilho manual — DO-AUT-24). Detalhada em DO-HAB-13, DO-AUT-05. CONSOLIDAÇÃO.
- **DO-IA-03.** Consolida **B17**: toda execução de IA passa por um Agente (padrão: Assistente padrão); não há exercício de Habilidade sem Agente. Detalhada em INV-HAB-09, DO-CHT-04, DO-AUT-04. CONSOLIDAÇÃO.
- **DO-IA-04.** Consolida **B18**: Execução de Agente e de Automação são entidades internas com identidade e seis estados; a de Automação pode conter a de Agente; toda Execução referencia invocador e delegante. Detalhada em DO-AGE-14, DO-AUT-07, DO-AUT-15. CONSOLIDAÇÃO.
- **DO-IA-05.** Consolida **B19**: Conhecimento é corpus curado (Coleção → Documento → Versão → Fragmento); registros operacionais são acessados por Ferramenta. Detalhada em DO-CNH-01, DO-CNH-12, DO-CNH-13. CONSOLIDAÇÃO.
- **DO-IA-06.** Consolida **B20** aplicado à IA: Painéis sobre Execuções de Agente e de Automação, Solicitações de Aprovação (B80), Exercícios (Dimensão) e Conhecimento (catálogo e uso) filtram pelo visualizador, inclusive quando é um Agente por `ler Painel` (DO-PAI-17); Sessões não são Fonte de Dados (DO-CHT-13; B85); Agente nunca cria Painel (DO-PAI-08). CONSOLIDAÇÃO.
- **DO-IA-07.** Consolida **B21**: Sessão de Chat é pessoal (Proprietário = Criador, imutável), ancorável (catálogo de âncoras em DO-CHT-02), com 0..1 Agente principal; invisível salvo compartilhamento; nunca sucedida. Detalhada em DO-CHT-01, DO-CHT-03, DO-CHT-09. CONSOLIDAÇÃO.
- **DO-IA-08.** Consolida **B22**: autonomia em três níveis, atributo do Agente, sobrescrevível por Automação só para menos; decidida por Ferramenta pela classe de efeito. Detalhada em DO-AGE-06, DO-HAB-18, DO-AUT-13. CONSOLIDAÇÃO.
- **DO-IA-09.** Consolida **B23**: permissões avaliadas a cada Ferramenta; revogação faz a próxima chamada falhar (`falhou` ou `aguardando aprovação` com motivo `permissão`). Detalhada em DO-HAB-14, DO-AGE-11, RN-AUT-04. CONSOLIDAÇÃO.
- **DO-IA-10.** Consolida **B24**: Agente, Habilidade e Automação versionam; Execuções referenciam a versão; modelos de versão distintos e justificados (DO-AGE-02: sem estado, não fixável; DO-HAB-04/05: várias `publicada`, fixável; DO-AUT-19: uma `publicada`). CONSOLIDAÇÃO.
- **DO-IA-11.** Consolida **B33**: Assistente padrão instanciado por Espaço de Trabalho, Proprietário = Proprietário do Espaço de Trabalho, sempre `ativo`, nunca eliminado antes do Espaço de Trabalho, configurável por Papel. Detalhada em INV-AGE-11, 17, 12.6. CONSOLIDAÇÃO.
- **DO-IA-12.** Consolida **A2.5** e o mapa da seção 3: Ferramenta (DO-HAB-13), Contexto (DO-AGE-09, DO-CHT-15), Memória do Agente (DO-AGE-07) e do Usuário (DO-CHT-11), Modelo (Glossário; DO-HAB-10; DO-AGE-04; consolidado em 7.4) e Execução (DO-AGE-14; DO-AUT-07) não recebem documento; este documento aponta onde estão definidos. CONSOLIDAÇÃO.
- **DO-IA-13.** Consolida as **exceções a A4.1** já registradas: Agente (DO-AGE-10: `rascunho`, `pausado`) e Automação (DO-AUT-09: `rascunho`, `pausado`), e a extensão de B36/B43 ao Conhecimento (DO-CNH-09). CONSOLIDAÇÃO.
- **DO-IA-14.** Consolida a **governança humana** do domínio: Agente, Habilidade, Automação e Coleção são criados e reconfigurados por Membro (ou Sistema/plataforma); nunca por Agente ou Automação (INV-AGE-03/04, INV-HAB-04, INV-AUT-10/DO-AUT-22; RN-CNH-01). CONSOLIDAÇÃO.
- **DO-IA-15.** Consolida a **cadeia de atribuição** e a **sucessão** para Atores de IA (seção 17.1): A6.2, A9.3, B28, DO-AGE-08, DO-AGE-11, DO-AGE-15, DO-AUT-14, DO-AUT-15, DO-AUT-24, RN-CXE-23 — harmonizados na revisão da fase 4 (25.1): delegante da Execução de Agente invocada por Automação é a Automação; Aprovador declarado na Ação; Cadeia de Execuções única (B79). CONSOLIDAÇÃO.

Propostas de alteração à constituição formuladas pelos documentos de IA e **incorporadas na revisão da fase 4**: DO-HAB-02 e DO-AGE-12 (A1.3 passa a listar Habilidade, Ferramenta e Template de Agente da plataforma como globais — B81); DO-HAB-06 (omissão de Habilidade em A7 confirmada — B71); DO-AUT-01 (Automação é Sujeito de A9.1, com teto do Proprietário — B88); DO-AUT-05 (verbete Ação do Glossário — B91); DO-AUT-17 (B41 emendada); DO-CHT-11 (Memória do Usuário no Membro — B86; documento 01, 7.1); DO-CHT-02 (âncoras — B83); DO-CHT-16 (adotada — B87; C11 fechada); DO-AUT-21 (autor de Comentário = Automação — B91; impacto no documento 06 registrado); DO-CXE-16 adotada por DO-AUT-20 (Fila como escopo, B41). Permanece como proposta obedecida na forma vigente: DO-CNH-06 (Tags em Documento, B5).

## 25. Questões em aberto

### 25.1 Inconsistências detectadas entre documentos de IA — resolvidas na revisão da fase 4

Cada item registra a resolução do orquestrador e onde foi aplicada.

1. **Delegante da Execução de Agente invocada por Automação.** Resolvido: ator = Agente, delegante = a Automação (DO-AUT-15); o delegante é Ator de qualquer tipo (Membro, Automação, Agente ou Integração — B18), e a interseção de permissões só considera delegante Membro (A9.3; RN-AUT-25); Origem `Caixa de Entrada` continua sem delegante; a cadeia de delegantes é derivável da Cadeia de Execuções. Aplicado em agentes.md 7.2, 7.5, RN-AGE-11, DO-AGE-07; 17.1 e 23.2 deste documento.
2. **Aprovador indicado pela Automação.** Resolvido: a Ação "invocar Agente" ganha Aprovador (0..1 Membro ou Equipe) e Tempo limite de aprovação (0..1), com precedência sobre a Política de aprovação do Agente (DO-AGE-11, passo 2). Aplicado em automacoes.md 7.4, 17.5, DO-AUT-13; agentes.md 7.8.
3. **Cancelamento pela Execução de Automação mãe.** Resolvido: acrescentado a DO-AGE-16, RN-AGE-19, 11.2 e ao Motivo de término (agentes.md 7.2).
4. **Agente criando Automação.** Resolvido: chat.md 4.7 corrigido — nem Sessão nem Agente criam Automações (INV-AUT-10; B95).
5. **Duas cadeias, dois limites.** Resolvido: **Cadeia de Execuções** única (B79) — sequência de Execuções de Automação e de Agente ligadas por disparo ou invocação; profundidade total ≤ Limite imposto (recomendação 5); subsequência de invocações Agente → Agente ≤ sub-limite (recomendação 3), reduzível por Agente; sem Agente nem par (Automação, objeto) repetidos; `acionar Automação` continua a Cadeia (RN-AUT-19). "Cadeia de invocação" e "cadeia de disparo" passam a sinônimos não canônicos. Aplicado em agentes.md 7.2, 9, RN-AGE-13, INV-AGE-06, DO-AGE-08; automacoes.md 7.7, RN-AUT-09, RN-AUT-19, INV-AUT-07, DO-AUT-11; chat.md RN-CHT-16, DO-CHT-17; Glossário; seções 3.4, 7.5, 9, 10, RN-IA-03, RN-IA-14 e 23 deste documento.
6. **Atributo "Admite sobrescrita de Modelo".** Resolvido: definido em agentes.md 6.2 (booleano, versionado; padrão falso; Assistente padrão verdadeiro — recomendação), DO-AGE-02 e RN-AGE-06; chat.md 25.4 atualizado.
7. **`executar` para invocar Agente.** Resolvido: exigido do invocador (Agente, Membro ou Automação — esta validada na publicação e a cada Ação, RN-AUT-07) e, quando há delegante Membro, do delegante (interseção — A9.3). Enunciado em RN-AGE-13, agentes.md 17.1, DO-CHT-17 e chat.md 12.2.
8. **Automação como Sujeito de A9.1.** Resolvido: A9.1 emendada (Automação é Sujeito; teto do Proprietário como regra — B88); documento 01, 17.1 corrigido; agentes.md 3, 4, 16 e DO-AGE-15 reescritos.
9. **Ação × Ferramenta.** Resolvido: verbete Ação do Glossário reescrito conforme DO-AUT-05 (B91).
10. **Execuções eliminadas com a Automação.** Resolvido: B41 emendada — Execuções são eliminadas com a Automação e com o Agente; Registros de Atividade e efeitos permanecem (DO-AUT-17; agentes.md 12.5).
11. **Códigos de estado com gênero.** Resolvido: códigos de estado de ciclo de vida são invariáveis em gênero para toda entidade (`ativo`, `arquivado`, `na lixeira`, `rascunho`, `pausado`, `mesclado`), inclusive Automação, Sessão de Chat e Fonte de Conhecimento; estados de domínio (`aberta`/`pendente`/`resolvida` de Conversa; `pendente`…`cancelada` de Execução; `publicada`/`obsoleta` de Versão) mantêm os nomes. Regra registrada em A4.1; aplicada em automacoes.md, conhecimento.md, habilidades.md e neste documento.
12. **Restauração da lixeira.** Resolvido: Agente e Automação desarquivados ou restaurados da lixeira voltam a `pausado`, nunca diretamente a `ativo` — exceção deliberada a B43, por segurança (B94). Aplicado em agentes.md 11.1, 12.4, DO-AGE-10; automacoes.md já a adotava (RN-AUT-05).
13. **Memória do Agente com dados de Contato × Memória do Usuário.** Resolvido como assimetria deliberada registrada: a Memória do Agente pode reter fatos sobre registros, inclusive Contatos, com elegibilidade por delegante (DO-AGE-07), sujeita a C7/C9 e eliminada com o registro; a Memória do Usuário nunca retém dados de terceiros (DO-CHT-11). Registrado em C7, B78 e B86; agentes.md 7.5.
14. **Tempo limite de aprovação.** Resolvido: padrão da plataforma de 72 horas para toda Solicitação de Aprovação, sobrescrevível pela Política de aprovação do Agente e, na Automação, na Ação (B80). Aplicado em agentes.md 7.8, DO-AGE-11; automacoes.md 17.5, DO-AUT-13; 7.6 e 17.1 deste documento.
15. **Habilidade sem Proprietário × A7**: confirmado (B71). **Template de Agente da plataforma × A1.3**: incorporado (B81; documento 01, 12.4, 21, 23). **Arquivos gerados pela IA × A8**: sem contradição. **Estados de Agente/Automação × A4.1**: registrados em A4.1 e B94.

### 25.2 Questões em aberto do domínio

1. **Política de Memória** (C7): prazos, retenção de Itens com delegante, consentimento, uso de Memória de Execução autônoma por delegantes que não veem a origem (17, 25.1; 16, 25.5); C7 já cobre a Memória do Agente com dados de Contatos.
2. **Cota, custo e valores dos Limites impostos de IA** (C8): limites por Espaço de Trabalho, Membro, Agente, Habilidade; concorrência e filhas por Execução; custo de Indexação; profundidades da Cadeia de Execuções, aninhamento, operações por Execução, retentativas, tempos limite, frequências (17, 25.3; 18, 25.1, 25.2; 19, 25.1; 20, 25.8) — a ontologia só exige existência e efeito registrado.
3. **Retenção de Execuções e de Mensagens substituídas** (C28; C9): prazo, o que sobrevive, relação com Painéis históricos (17, 25.4; 16, 25.7).
4. **Acesso corporativo excepcional a Sessões** (C29): ordem judicial ou obrigação regulatória; se existir, procedimento da plataforma com registro, nunca permissão de Administrador (16, 25.2). O destino das Sessões de Membro removido está resolvido (B87; C11 fechada).
5. **Modelo** (C27): Modelos secundários por modalidade (17, 25.2); catálogo de Capacidades (18, 25.6); Modelos admitidos por Espaço de Trabalho (16, 25.4).
6. **Aprovação obrigatória por Recurso** (C30): Coleção, Lista ou Fila exigindo aprovação para escrita de Agente independentemente do nível — ampliação de B22 (17, 25.8; 20, 25.7).
7. **Agente autor de Habilidade ou de Automação**: proibido (INV-HAB-04, DO-AUT-22; B95); reabrir só com consequência para B7 (18, 25.4; 19, 25.4).
8. **Escopos de Automação** em Contato/Empresa (C25) e em Coleção (20, 25.4) — impacta B41.
9. **Fluxo editorial de Documento** e compartilhamento de Documento individual (20, 25.2, 25.3).
10. **Compartilhamento de Habilidades e Conhecimento entre Espaços de Trabalho** (C1; 18, 25.3; 20, 20.11).
