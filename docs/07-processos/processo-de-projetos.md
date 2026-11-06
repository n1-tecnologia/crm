# Configuração do Processo de Projetos

Manual de configuração e operação • Versão 1.0 • 06/11/2026

Este documento consolida o processo definido na conversa. As regras de responsáveis, obrigatoriedade e aprovação são a configuração proposta para iniciar a operação. O documento descreve o que configurar; não representa uma configuração já aplicada à ferramenta.

## 1. Hierarquia

```text
ESPAÇO: Produto e Tecnologia
└── PASTA: Processo de Projetos
    ├── 01. Recebimento de demandas
    ├── 02. Briefing e levantamento de requisitos
    ├── 03. Análise de viabilidade
    ├── 04. Definição e aprovação do escopo
    ├── 05. Especificação das funcionalidades
    ├── 06. UX/UI e prototipação
    ├── 07. Validação da solução
    ├── 08. Planejamento técnico e das entregas
    ├── 09. Desenvolvimento
    ├── 10. Testes e qualidade
    ├── 11. Homologação
    ├── 12. Implantação
    ├── 13. Operação assistida
    └── 14. Encerramento e transição para manutenção
```

**Descrição do espaço:** Centraliza a gestão de demandas e projetos de tecnologia, desde o recebimento e a análise de impacto e receita até o planejamento, desenvolvimento, entrega e transição para suporte.

**Descrição da pasta:** Organiza o processo padrão de projetos em 14 fases, com estados, responsáveis, informações e critérios de aprovação próprios de cada fase. Todos os clientes seguem o mesmo processo.

**Subpastas:** não criar. Cliente é um campo personalizado, nunca uma pasta ou lista.

**Unidade de trabalho:** cada tarefa principal representa uma demanda/projeto e mantém sua identidade durante todo o processo. Atividades, funcionalidades e correções são subtarefas vinculadas. Não criar uma cópia do projeto em cada lista.

## 2. Convenções de configuração

### Tipos de campo

- Texto curto: informação breve, nome, contato ou identificador.
- Texto longo: explicação, critérios ou justificativa.
- Seleção única: uma opção dentre as opções expressamente definidas.
- Seleção múltipla: mais de uma opção aplicável.
- Pessoa: usuário interno cadastrado na ferramenta. Para pessoas externas, usar texto curto com nome e contato.
- Data: dia, mês e ano. Data e hora: horário no fuso America/Sao_Paulo.
- Moeda: reais brasileiros, duas casas decimais. Campo vazio significa desconhecido; zero significa valor confirmado como zero.
- Número: unidade indicada no nome ou na observação; não misturar horas com pontos.
- URL: link para documento, evidência ou registro externo. Não inserir senhas, tokens ou credenciais.
- Relacionamento: vínculo com uma ou várias tarefas, conforme a observação do campo.
- Sim/Não: escolha explícita; vazio significa ainda não respondido.

### Escopo dos campos

Criar os campos comuns e comerciais uma única vez na pasta, reutilizando os mesmos campos nas listas. Exibir os comerciais principalmente nas listas 01, 03 e 14. Criar os demais campos na lista indicada. Ao mover uma tarefa, preservar os valores das fases anteriores. Se a ferramenta exigir, disponibilizar os mesmos campos no destino ou mantê-los no nível da pasta com visualização restrita por lista; não recriar campos homônimos.

As regras de obrigatoriedade deste manual são regras operacionais. Implementá-las como validações se a ferramenta oferecer esse recurso; caso contrário, usar checklist de passagem e revisão do responsável. Não presumir que uma mudança de status executa automaticamente uma validação.

### Campos nativos

| Campo | Configuração de uso |
|---|---|
| Nome da tarefa | Nome curto do projeto ou demanda; manter ao mover entre listas. |
| Descrição | Resumo atualizado e contexto geral. |
| Responsável | Uma pessoa responsável pela fase atual; colaboradores podem ser adicionados sem diluir essa responsabilidade. |
| Prioridade | Urgente, Alta, Normal e Baixa. Ordena o trabalho; não substitui impacto nem urgência justificada. |
| Data de início | Início planejado da fase atual. |
| Prazo | Limite da fase atual. Registrar os valores anteriores no histórico antes de atualizar. |
| Anexos | Prints, arquivos e evidências pertinentes, com acesso controlado. |
| Comentários e histórico | Registrar decisões, movimentações e comunicações. |
| Subtarefas | Atividades, funcionalidades e correções do projeto, com responsável e prazo próprios. |

### Categorias dos estados

Neste documento, **Entrada** significa trabalho ainda não iniciado; **Em andamento**, execução, espera ou revisão; **Saída da fase**, fase aprovada, mas projeto ainda aberto; **Encerrado**, demanda terminada. Mapear essas categorias às disponíveis na sua ferramenta.

Os estados de saída das listas 01 a 13 não devem concluir globalmente o projeto. Eles autorizam a movimentação para a lista seguinte. Somente “Não aprovada”, “Inviável”, “Cancelado” e “Encerrado” encerram a tarefa principal.

Adicionar **Cancelado** a todas as listas: categoria Encerrado; exige motivo, decisor e comunicação. Para pausas e bloqueios, usar os campos comuns abaixo e preservar o estado atual, evitando perder a posição no processo.

## 3. Campos comuns a todas as listas

| Nome | Tipo | Observação |
|---|---|---|
| Cliente | Seleção única | Identifica o cliente. Cadastrar uma opção por cliente, com nome padronizado. Deixar vazio apenas quando a origem for interna e não houver cliente relacionado. |
| Solicitante | Texto curto | Nome e contato de quem pediu a demanda; pode ser uma pessoa interna ou externa. |
| Origem | Seleção única | Opções: Cliente; Comercial; Suporte; Direção; Equipe interna. Indica de onde veio a solicitação. |
| Tipo de demanda | Seleção única | Opções: Novo projeto; Nova funcionalidade; Melhoria; Integração; Correção; Demanda técnica. Classifica a natureza do trabalho. |
| Saúde do projeto | Seleção única | Opções: No prazo; Em risco; Atrasado; Pausado. Em risco indica ameaça ao compromisso; Atrasado indica prazo vencido; Pausado indica suspensão deliberada. |
| Situação de execução | Seleção única | Opções: Normal; Bloqueada; Pausada. Registra impedimento ou suspensão sem substituir o estado da fase. |
| Motivo do impedimento ou pausa | Texto longo | Explica o impedimento ou a decisão de suspender o trabalho. Obrigatório quando a execução não for Normal. |
| Responsável pelo desbloqueio ou retomada | Pessoa | Pessoa interna que acompanha a resolução ou a retomada. Obrigatório quando a execução não for Normal. |
| Próxima revisão do impedimento ou pausa | Data | Data para revisar a situação, sem significar promessa de resolução. Obrigatória quando a execução não for Normal. |
| Decisor da fase | Texto curto | Nome e papel de quem aprovou ou rejeitou a passagem. Para decisões financeiras, deve ter autoridade sobre orçamento e receita. |
| Data da decisão da fase | Data | Data da decisão mais recente. O histórico de cada fase deve preservar os valores anteriores. |
| Motivo do cancelamento | Texto longo | Justificativa exigida antes de usar Cancelado. Informar também as obrigações ou pendências que permanecem. |

**Regra para Cliente:** não criar pastas por cliente. Caso no futuro exista um cadastro próprio de clientes com identificadores, migrar este campo para relacionamento, sem manter duas fontes concorrentes.

### Campos comerciais compartilhados

| Nome | Tipo | Observação |
|---|---|---|
| Relação com receita | Seleção múltipla | Opções: Receita direta; Expansão de contrato; Retenção de receita; Sem receita associada; A confirmar. As três primeiras podem coexistir. Sem receita associada e A confirmar devem ser usadas isoladamente. |
| Modelo de cobrança | Seleção única | Opções: Única; Recorrente; Única + recorrente; Sem cobrança adicional. Descreve a cobrança associada à demanda. |
| Receita única prevista | Moeda | Valor bruto esperado da cobrança pontual. Não representa lucro, faturamento realizado ou pagamento recebido. |
| Receita mensal adicional prevista | Moeda | Aumento bruto esperado da receita mensal; excluir a mensalidade existente e valores já incluídos em outra previsão. |
| Receita mensal em risco | Moeda | Receita mensal existente sujeita à perda se a demanda não for atendida. Registrar evidência do risco; não somar como receita nova. |
| Situação comercial | Seleção única | Opções: Não apresentada; Em negociação; Proposta aceita; Contrato assinado; Não se aplica. Não comprova recebimento financeiro. |
| Evidência comercial | URL | Link para proposta, contrato ou negociação que fundamenta valores e condições. |
| Responsável comercial | Pessoa | Pessoa interna que confirma a oportunidade, os valores, as condições e a evidência comercial. |

## 4. Configuração das listas

### 01. Recebimento de demandas

**Descrição da lista:** Centraliza a entrada e a avaliação inicial das demandas. Nesta lista, analisamos o problema, o público afetado, os impactos, a urgência e a relação com receita para decidir se a demanda deve avançar para o briefing.

**Responsável pela fase:** responsável pela triagem de produto. **Entrada:** nova solicitação identificada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| Nova demanda | Entrada | Registrar pedido, solicitante e origem; designar responsável; verificar duplicidade e se o pedido deve seguir para suporte. |
| Em tramitação | Em andamento | Entender o problema; analisar público, abrangência, frequência, impacto, prazo e receita; validar informações comerciais. |
| Aguardando informações | Em andamento | Registrar perguntas específicas, pessoa que responderá e prazo; acompanhar o retorno e voltar para Em tramitação. |
| Qualificada | Saída da fase | Registrar decisão favorável e responsável pelo briefing. Qualificação autoriza aprofundar; não autoriza desenvolver. |
| Não aprovada | Encerrado | Registrar motivo, justificativa e possível condição de reavaliação; comunicar o solicitante. |

#### Campos personalizados específicos

Além dos campos comuns e comerciais:

| Nome | Tipo | Observação |
|---|---|---|
| Problema a resolver | Texto longo | Dificuldade atual e contexto em que acontece; distinguir necessidade de solução sugerida. |
| Público afetado | Texto curto | Usuários, equipes ou perfis de clientes que enfrentam o problema. |
| Abrangência | Texto curto | Quantidade com unidade. Exemplo: 30 usuários de 5 clientes. |
| Frequência do problema | Seleção única | Opções: Pontual; Diária; Semanal; Mensal; Outra. Indica recorrência. |
| Categoria do impacto | Seleção múltipla | Opções: Receita; Custos; Operação; Experiência do usuário; Contrato; Segurança. |
| Intensidade do impacto | Seleção única | Opções: Baixa; Média; Alta. Baixa: incômodo localizado com alternativa simples. Média: prejuízo ou retrabalho recorrente. Alta: atividade importante impedida ou consequência financeira/contratual relevante. |
| Justificativa do impacto | Texto longo | Exemplos e evidências que sustentam a classificação, incluindo números quando disponíveis. |
| Resultado esperado | Texto longo | Benefício pretendido, preferencialmente mensurável. |
| Data necessária | Data | Data solicitada para entrega; é uma necessidade informada, ainda não um compromisso aprovado. |
| Motivo da data | Texto longo | Restrição que explica o prazo, como contrato, evento ou início de operação. |
| Consequência de não fazer | Texto longo | Efeito de adiar ou rejeitar, incluindo custo, perda ou permanência do problema. |
| Informação pendente | Texto longo | Perguntas exatas que impedem concluir a triagem. |
| Responsável pelo retorno | Texto curto | Nome e contato de quem fornecerá as informações, inclusive pessoas externas. |
| Prazo para retorno | Data | Data combinada para resposta e acompanhamento. |
| Justificativa da decisão | Texto longo | Razões para qualificar ou não aprovar. Obrigatória nos dois resultados. |
| Motivo da não aprovação | Seleção única | Opções: Fora de escopo; Sem aderência; Benefício insuficiente; Informações insuficientes; Retirada pelo solicitante; Adiada. |
| Condição de reavaliação | Texto longo | Evento, mudança ou informação que permite retomar uma demanda encerrada ou adiada. |
| Demanda original | Relacionamento | Vínculo com a tarefa original quando o registro for duplicado. |
| Encaminhamento da triagem | Seleção única | Opções: Processo de projetos; Suporte; Duplicada. Distingue encaminhamento de rejeição de negócio. |
| Destino do encaminhamento | URL | Link do chamado de suporte ou do registro de destino. Obrigatório quando encaminhada para suporte. |

**Obrigatório na entrada:** nome, solicitante, origem e problema; cliente se externo. Em Nova demanda, definir responsável antes da análise. Tipo e Encaminhamento da triagem devem ser definidos na tramitação.

**Obrigatório ao aguardar informações:** informação pendente, responsável pelo retorno e prazo para retorno. Não encerrar automaticamente por silêncio; revisar e registrar a decisão de encerramento.

**Critério de qualificação:** problema, público, frequência, impacto, justificativa, resultado esperado, consequência de não fazer e relação com receita esclarecidos; sem pendência essencial. Relação com receita não pode permanecer A confirmar. Valores, cobrança, responsável e evidência comercial são exigidos quando aplicáveis. Uma demanda sem receita pode avançar com benefício ou obrigação justificados.

**Saída:** Qualificada → lista 02, A agendar. Não aprovada → permanece encerrada nesta lista. Duplicadas e solicitações de suporte: vincular destino, registrar o encaminhamento na justificativa e encerrar administrativamente usando Não aprovada, sem classificá-las como rejeição de negócio; o motivo de não aprovação não é exigido nesses dois encaminhamentos.

### 02. Briefing e levantamento de requisitos

**Descrição da lista:** Aprofunda a demanda qualificada, documentando objetivos, usuários, processos atuais, requisitos iniciais, restrições e critérios de sucesso para estabelecer um entendimento comum antes da análise de viabilidade.

**Responsável pela fase:** responsável de produto ou analista de requisitos. **Entrada:** demanda qualificada e solicitante disponível.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A agendar | Entrada | Identificar participantes e combinar a reunião de briefing. |
| Reunião agendada | Em andamento | Confirmar data, participantes e materiais prévios. |
| Em levantamento | Em andamento | Entrevistar envolvidos e levantar necessidades, processo atual e restrições. |
| Aguardando informações | Em andamento | Solicitar informações faltantes com responsável e prazo registrados. |
| Em documentação | Em andamento | Consolidar respostas e requisitos no briefing. |
| Aguardando validação | Em andamento | Encaminhar o documento ao aprovador para confirmar o entendimento. |
| Ajustes solicitados | Em andamento | Registrar divergências e corrigir o briefing antes de reenviar. |
| Briefing aprovado | Saída da fase | Registrar o aceite da versão documentada. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Data da reunião de briefing | Data e hora | Horário combinado com os participantes. |
| Participantes do briefing | Texto longo | Nomes, papéis e contatos dos envolvidos. |
| Objetivo do projeto | Texto longo | Resultado de negócio que o projeto pretende atingir. |
| Processo atual | Texto longo | Como a atividade funciona hoje, incluindo alternativas manuais. |
| Perfis de usuários | Texto longo | Grupos de usuários, suas necessidades e diferenças de acesso. |
| Documento de briefing | URL | Fonte central do levantamento e dos requisitos iniciais. |
| Sistemas envolvidos | Texto longo | Plataformas existentes, integrações previstas e responsáveis pelos sistemas. |
| Restrições conhecidas | Texto longo | Limites técnicos, financeiros, contratuais, operacionais ou de prazo. |
| Critérios de sucesso | Texto longo | Resultados que permitirão avaliar o sucesso; registrar indicador e referência inicial quando disponíveis. |
| Aprovador do briefing | Texto curto | Nome e papel de quem pode confirmar o entendimento. |
| Pendências do briefing | Texto longo | Perguntas em aberto, com quem responde e prazo para cada uma. |
| Versão do briefing | Texto curto | Identificação da versão submetida à aprovação. |
| Evidência da aprovação do briefing | URL | Registro do aceite com referência à versão aprovada. |

**Obrigatoriedade:** reunião e participantes antes de Reunião agendada; pendências detalhadas ao aguardar informações; documento, versão, objetivo, processo, perfis, sistemas, restrições, critérios e aprovador antes de solicitar validação. Usar “Não se aplica” justificado quando pertinente.

**Critério de saída:** entendimento validado, sem pendência essencial, com evidência, decisor e data de aprovação. **Destino:** lista 03, A analisar.

### 03. Análise de viabilidade

**Descrição da lista:** Avalia a possibilidade técnica, a capacidade de execução, os custos, o prazo e o retorno econômico da demanda, registrando riscos e condições para decidir se o projeto deve continuar.

**Responsável pela fase:** responsável técnico, com apoio comercial e financeiro. **Entrada:** briefing aprovado.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A analisar | Entrada | Conferir briefing e definir participantes da avaliação. |
| Em análise técnica | Em andamento | Avaliar integrações, tecnologia, dados, segurança e capacidade técnica. |
| Em estimativa de custos e prazo | Em andamento | Estimar esforço, custos, dependências e duração com premissas explícitas. |
| Em análise de receita e rentabilidade | Em andamento | Validar previsões comerciais e comparar benefícios com custos no horizonte definido. |
| Aguardando informações | Em andamento | Obter acessos informativos, cotações ou respostas necessárias; registrar responsável e prazo. |
| Aguardando decisão | Em andamento | Apresentar parecer e condições ao decisor autorizado. |
| Viável | Saída da fase | Registrar autorização para seguir e as condições aceitas. |
| Inviável | Encerrado | Registrar impedimentos ou desequilíbrio econômico que inviabilizam a continuidade e comunicar. |

#### Campos personalizados específicos

Reutilizar os campos comerciais compartilhados; revisar valores e evidências nesta fase.

| Nome | Tipo | Observação |
|---|---|---|
| Responsável técnico | Pessoa | Quem responde pela avaliação técnica. |
| Parecer técnico | Texto longo | Conclusão técnica e requisitos necessários para executar. |
| Esforço preliminar em horas | Número | Estimativa inicial do esforço total; ainda sujeita ao planejamento detalhado. |
| Custo estimado de desenvolvimento | Moeda | Custo incremental de construção, incluindo equipe, terceiros e despesas previstas. |
| Custo mensal adicional de operação | Moeda | Infraestrutura, licenças, suporte e outros custos mensais adicionais. |
| Prazo estimado em dias úteis | Número | Duração preliminar, considerando capacidade e dependências. |
| Orçamento disponível | Moeda | Limite de investimento informado ou aprovado. |
| Dependências externas | Texto longo | Fornecedores, sistemas, acessos ou decisões externos à equipe. |
| Riscos e premissas | Texto longo | Incertezas, probabilidade qualitativa, consequências e premissas das estimativas. |
| Horizonte financeiro em meses | Número | Período usado na comparação econômica; inteiro positivo. |
| Memória da análise financeira | URL | Cálculo com receitas, custos, início da recorrência, impostos e demais premissas aplicáveis. |
| Parecer financeiro | Texto longo | Resultado econômico e justificativa para executar, inclusive quando o benefício for não financeiro. |
| Recomendação de viabilidade | Seleção única | Opções: Executar; Executar com condições; Não executar. |
| Condições para execução | Texto longo | Condições aceitas, seus responsáveis e quando precisam ser atendidas. |
| Pendências de viabilidade | Texto longo | Informações faltantes, responsáveis e prazos. |
| Aprovador da viabilidade | Texto curto | Decisor com autoridade técnica e financeira ou referência aos dois aprovadores. |
| Evidência da decisão de viabilidade | URL | Registro da decisão e das condições aceitas. |

**Regras financeiras:** não somar receita em risco como receita nova. Não tratar negociação como receita contratada nem contrato como pagamento recebido. Cálculo simples de referência para receita nova: receita única + receita mensal adicional × meses efetivamente cobrados no horizonte. Subtrair custos do mesmo período e registrar tributos e outras deduções pertinentes; o resultado simplificado não deve ser chamado de lucro líquido. Retenção e benefícios internos exigem avaliação separada e justificativa.

**Critério de saída:** parecer técnico, esforço, custos, prazo, riscos, orçamento ou autorização de investimento, horizonte e parecer financeiro documentados; recomendação e decisão aprovadas. Condições que bloqueiam a próxima fase precisam estar cumpridas. **Destino:** Viável → lista 04, A definir. Inviável → encerramento nesta lista, com motivo na evidência e no parecer.

### 04. Definição e aprovação do escopo

**Descrição da lista:** Define e formaliza as entregas, os limites, as premissas e os critérios de aceite do projeto, estabelecendo a referência aprovada para especificação e controle de mudanças.

**Responsável pela fase:** responsável de produto ou projeto. **Entrada:** viabilidade aprovada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A definir | Entrada | Reunir briefing, parecer e condições aprovadas. |
| Em elaboração | Em andamento | Escrever entregas, exclusões, premissas e critérios de aceite. |
| Em revisão interna | Em andamento | Conferir coerência com capacidade, receita, custos e compromissos. |
| Aguardando aprovação | Em andamento | Submeter a versão do escopo ao aprovador. |
| Ajustes solicitados | Em andamento | Registrar mudanças e revisar a versão; se afetarem viabilidade, retornar à lista 03. |
| Escopo aprovado | Saída da fase | Registrar o aceite e congelar a referência aprovada. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Documento de escopo | URL | Fonte oficial do escopo do projeto. |
| Versão do escopo | Texto curto | Identificador da versão submetida e aprovada. |
| Entregas previstas | Texto longo | Resultados e componentes incluídos. |
| Fora do escopo | Texto longo | Exclusões explícitas para evitar expectativas indevidas. |
| Premissas e obrigações do cliente | Texto longo | Dados, materiais, acessos e decisões que dependem do cliente. |
| Critérios de aceite do projeto | Texto longo | Condições verificáveis para aceitar a entrega global. |
| Aprovador do escopo | Texto curto | Nome e papel de quem autoriza o escopo. |
| Data de aprovação do escopo | Data | Data do aceite da versão. |
| Evidência da aprovação do escopo | URL | Registro de aprovação com referência à versão. |

**Critério de saída:** todos os campos preenchidos, exclusões e obrigações claras, critérios verificáveis e aceite registrado. **Destino:** lista 05, A especificar.

### 05. Especificação das funcionalidades

**Descrição da lista:** Detalha o comportamento esperado das funcionalidades, suas regras de negócio, permissões, requisitos não funcionais e critérios de aceite para orientar design, implementação e testes.

**Responsável pela fase:** produto ou análise funcional. **Entrada:** escopo aprovado.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A especificar | Entrada | Identificar funcionalidades previstas no escopo. |
| Em especificação | Em andamento | Documentar fluxos, regras, exceções e critérios por funcionalidade. |
| Aguardando esclarecimentos | Em andamento | Resolver dúvidas com responsável e prazo registrados. |
| Em revisão | Em andamento | Revisar clareza e consistência com produto e equipe técnica. |
| Ajustes solicitados | Em andamento | Corrigir inconsistências ou lacunas antes de nova revisão. |
| Especificação aprovada | Saída da fase | Registrar validação da versão funcional. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Documento de especificação | URL | Fonte do detalhamento funcional. |
| Versão da especificação | Texto curto | Versão que será usada como referência. |
| Regras de negócio | Texto longo | Resumo das regras e referência às seções correspondentes no documento. |
| Perfis e permissões | Texto longo | Ações e acessos autorizados por perfil. |
| Requisitos não funcionais | Texto longo | Segurança, desempenho, acessibilidade, disponibilidade e outros requisitos com critérios verificáveis. |
| Critérios de aceite das funcionalidades | URL | Documento com condições de aceite por funcionalidade e referência ao escopo. |
| Questões em aberto | Texto longo | Dúvidas, responsáveis e prazos para resposta. |
| Revisor funcional | Pessoa | Responsável interno pela revisão do comportamento esperado. |
| Evidência da aprovação da especificação | URL | Registro de aprovação da versão. |

**Critério de saída:** funcionalidades do escopo cobertas, regras e permissões descritas, exceções consideradas, critérios testáveis e nenhuma questão essencial aberta. **Destino:** lista 06, A iniciar.

### 06. UX/UI e prototipação

**Descrição da lista:** Transforma a especificação em fluxos, telas e protótipos, considerando os dispositivos previstos e os estados de interação necessários para validar a experiência antes do desenvolvimento.

**Responsável pela fase:** design. **Entrada:** especificação aprovada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A iniciar | Entrada | Conferir especificação e referências visuais. |
| Em desenho de fluxos | Em andamento | Estruturar jornadas, navegação e alternativas. |
| Em criação de telas | Em andamento | Desenhar interfaces, componentes e estados. |
| Em prototipação | Em andamento | Conectar telas para demonstrar interações. |
| Em revisão interna | Em andamento | Conferir cobertura funcional, usabilidade e viabilidade de implementação. |
| Ajustes solicitados | Em andamento | Corrigir pontos da revisão e reenviar. |
| Pronto para validação | Saída da fase | Identificar a versão que será apresentada aos envolvidos. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Responsável pelo design | Pessoa | Quem responde pelas interfaces e protótipo. |
| Fluxos de navegação | URL | Jornadas e caminhos previstos. |
| Arquivo de design | URL | Fonte editável das telas e componentes. |
| Protótipo navegável | URL | Versão interativa usada na validação. |
| Versão do protótipo | Texto curto | Identificação da versão apresentada. |
| Dispositivos contemplados | Seleção múltipla | Opções: Desktop; Tablet; Celular. |
| Referência visual | URL | Marca, biblioteca de componentes ou design system adotado. |
| Pendências de design | Texto longo | Itens abertos, responsáveis e prazos. |
| Revisor de design | Pessoa | Quem revisa a proposta internamente. |
| Evidência da revisão de design | URL | Registro da revisão e das decisões. |

**Critério de saída:** fluxos e telas cobrem o escopo; há estados de vazio, carregamento, erro e sucesso, confirmações destrutivas e validação de formulários quando aplicáveis; revisão interna concluída. Para demandas sem interface, registrar dispensa justificada e aprovada, preservando a passagem no histórico. **Destino:** lista 07, A agendar.

### 07. Validação da solução

**Descrição da lista:** Apresenta funcionalidades e protótipos aos envolvidos, registra feedbacks, resolve ajustes e formaliza a aprovação da solução que será planejada e desenvolvida.

**Responsável pela fase:** produto, com apoio de design e área técnica. **Entrada:** solução pronta para apresentação.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A agendar | Entrada | Definir participantes e agenda de validação. |
| Apresentação agendada | Em andamento | Confirmar horário e versão a apresentar. |
| Em validação | Em andamento | Apresentar cenários e recolher decisões e feedbacks. |
| Aguardando retorno | Em andamento | Acompanhar decisão pendente com prazo combinado. |
| Ajustes solicitados | Em andamento | Classificar feedbacks como correções ou mudanças de escopo. |
| Em ajustes | Em andamento | Executar ajustes dentro do escopo e voltar à validação. |
| Solução aprovada | Saída da fase | Registrar aceite da versão e eventuais exceções. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Data da apresentação | Data e hora | Horário da validação. |
| Participantes da validação | Texto longo | Nomes, papéis e contatos dos envolvidos. |
| Versão apresentada | Texto curto | Referência exata da solução avaliada. |
| Registro dos feedbacks | URL | Comentários, decisões e encaminhamentos. |
| Ajustes obrigatórios | Texto longo | Mudanças necessárias para aprovação, com responsável. |
| Solicitações fora do escopo | Texto longo | Novos pedidos que precisam de avaliação antes de incorporação. |
| Prazo para retorno da validação | Data | Data combinada para a decisão. |
| Aprovador da solução | Texto curto | Quem tem autoridade para aprovar. |
| Data da aprovação da solução | Data | Data do aceite. |
| Evidência da aprovação da solução | URL | Registro que identifica a versão aprovada. |

**Critério de saída:** ajustes obrigatórios concluídos ou formalmente dispensados; pedidos novos separados; versão e aceite registrados. Mudanças relevantes retornam às listas 03/04 e depois atualizam especificação e design. **Destino:** lista 08, A planejar.

### 08. Planejamento técnico e das entregas

**Descrição da lista:** Organiza a execução da solução aprovada, definindo arquitetura, tarefas, estimativas, capacidade, dependências, testes e sequência de entregas para estabelecer um plano executável.

**Responsável pela fase:** liderança técnica e responsável pelo projeto. **Entrada:** solução aprovada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A planejar | Entrada | Conferir referências aprovadas e equipe disponível. |
| Em definição técnica | Em andamento | Definir arquitetura, integrações e decisões de implementação. |
| Em detalhamento de tarefas | Em andamento | Dividir funcionalidades em atividades executáveis e vinculadas. |
| Em estimativa | Em andamento | Estimar esforço e revisar custos com a equipe. |
| Em definição do cronograma | Em andamento | Conciliar prioridades, dependências e capacidade real. |
| Em revisão | Em andamento | Validar execução, compromissos e estratégia de testes. |
| Planejamento aprovado | Saída da fase | Registrar plano e autorização para iniciar a execução. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Plano técnico | URL | Arquitetura e decisões de implementação. |
| Plano de entregas | URL | Marcos, funcionalidades e sequência planejada. |
| Equipe envolvida | Pessoas | Profissionais previstos na execução. |
| Esforço detalhado em horas | Número | Estimativa consolidada após o detalhamento. |
| Capacidade alocada em horas por semana | Número | Disponibilidade efetiva da equipe para este projeto. |
| Dependências críticas | Texto longo | Condições, responsáveis e datas que afetam o plano. |
| Previsão de publicação | Data | Projeção atual de entrada em produção. |
| Plano de testes | URL | Cenários, ambientes, responsáveis e critérios de aprovação. |
| Aprovador do planejamento | Pessoa | Responsável por validar recursos e compromissos. |
| Evidência da aprovação do planejamento | URL | Registro do plano aprovado. |

**Critério de saída:** subtarefas com responsáveis, estimativas e dependências; capacidade confirmada; cronograma e testes aprovados. Se o detalhamento alterar significativamente custo ou prazo aprovado, reavaliar viabilidade e escopo antes de seguir. **Destino:** lista 09, A iniciar.

### 09. Desenvolvimento

**Descrição da lista:** Executa a implementação da solução planejada, acompanha impedimentos e revisões de código e prepara uma versão identificada para testes internos.

**Responsável pela fase:** liderança técnica. **Entrada:** planejamento aprovado e condições de início atendidas.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A iniciar | Entrada | Confirmar ambiente, acessos e tarefas prontas. |
| Em desenvolvimento | Em andamento | Implementar funcionalidades e verificações técnicas. |
| Em revisão de código | Em andamento | Revisar implementação, segurança, erros e aderência aos critérios. |
| Ajustes solicitados | Em andamento | Registrar problemas encontrados na revisão. |
| Em ajustes | Em andamento | Corrigir os pontos e retornar à revisão. |
| Pronto para testes | Saída da fase | Disponibilizar versão revisada e identificada no ambiente de testes. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Líder técnico | Pessoa | Quem coordena a implementação. |
| Versão de entrega | Texto curto | Identificador da versão em construção. |
| Repositório | URL | Local do código, sem credenciais no link. |
| Registro das alterações técnicas | URL | Página com PRs, alterações e referências da entrega. |
| Ambiente de testes | URL | Endereço onde a versão será verificada. |
| Evidência da revisão técnica | URL | Revisões e resultados das verificações técnicas. |
| Pendências de implementação | Texto longo | Itens ainda não concluídos e encaminhamento de cada um. |

Usar os campos comuns para bloqueios; não criar um segundo campo de bloqueio nesta lista.

**Critério de saída:** subtarefas da entrega implementadas e revisadas; verificações técnicas previstas executadas; ambiente e versão disponíveis; nenhuma pendência bloqueadora. **Destino:** lista 10, A testar.

### 10. Testes e qualidade

**Descrição da lista:** Verifica a entrega em relação aos requisitos e critérios de aceite, registra defeitos, acompanha correções e retestes e decide se a versão está pronta para homologação.

**Responsável pela fase:** qualidade ou pessoa designada para testes. **Entrada:** versão identificada pronta para teste.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A testar | Entrada | Conferir versão, ambiente, dados e roteiro. |
| Em testes | Em andamento | Executar testes previstos e registrar evidências. |
| Falhas identificadas | Em andamento | Registrar defeitos reproduzíveis e classificar severidade. |
| Em correção | Em andamento | Equipe técnica corrige falhas; manter os registros vinculados. |
| Em reteste | Em andamento | Confirmar correções e verificar regressões pertinentes. |
| Aprovado para homologação | Saída da fase | Emitir parecer e registrar exceções aceitas. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Responsável pela qualidade | Pessoa | Quem coordena a avaliação. |
| Versão em teste | Texto curto | Versão efetivamente testada. |
| Execução dos testes | URL | Cenários, resultados, data e evidências. |
| Falhas identificadas | Relacionamento | Vínculos com subtarefas de defeito; cada falha tem reprodução, esperado, observado e severidade. |
| Maior severidade em aberto | Seleção única | Opções: Nenhuma; Baixa; Média; Alta; Crítica. Reflete a falha aberta mais grave. |
| Pendências aceitas em qualidade | Texto longo | Falhas não bloqueadoras aceitas, seus efeitos, responsáveis e prazo de tratamento. |
| Aprovador das exceções de qualidade | Pessoa | Quem autorizou seguir com pendências. |
| Parecer de qualidade | Texto longo | Resumo da cobertura, limitações e decisão de liberação. |

**Severidade:** Crítica = indisponibilidade essencial, perda/corrupção de dados ou exposição grave; Alta = função importante impedida sem alternativa aceitável; Média = prejuízo parcial com alternativa; Baixa = efeito pequeno sem impedir o uso.

**Critério de saída:** testes executados, sem falhas críticas ou altas abertas; demais pendências aceitas explicitamente; parecer e versão registrados. **Destino:** lista 11, A disponibilizar.

### 11. Homologação

**Descrição da lista:** Disponibiliza a entrega ao cliente ou área solicitante para validar os cenários de negócio e os critérios de aceite, acompanhar ajustes e registrar a autorização para implantação.

**Responsável pela fase:** responsável pelo projeto; validação executada pelo cliente ou área solicitante. **Entrada:** versão aprovada em qualidade.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A disponibilizar | Entrada | Preparar ambiente, acessos e instruções para o cliente. |
| Aguardando testes do cliente | Em andamento | Cliente recebeu a entrega e ainda não iniciou a validação. |
| Em homologação | Em andamento | Cliente executa cenários e informa resultados. |
| Ajustes solicitados | Em andamento | Separar defeitos de novos pedidos e registrar tratamento. |
| Em ajustes | Em andamento | Corrigir itens acordados e executar testes internos das alterações. |
| Aguardando revalidação | Em andamento | Entregar versão corrigida para nova conferência. |
| Homologado | Saída da fase | Registrar aceite da versão e exceções. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Responsável pela homologação no cliente | Texto curto | Nome e contato de quem coordena os testes de negócio. |
| Ambiente de homologação | URL | Endereço da entrega para validação, sem credenciais. |
| Versão em homologação | Texto curto | Versão disponibilizada e, ao final, aceita. |
| Roteiro de homologação | URL | Cenários de negócio ligados aos critérios de aceite. |
| Prazo de homologação | Data | Data combinada para retorno do cliente. |
| Feedbacks de homologação | URL | Registro dos testes, ocorrências e decisões. |
| Pendências aceitas na homologação | Texto longo | Exceções aceitas e encaminhamentos. |
| Aprovador do aceite de homologação | Texto curto | Pessoa autorizada a aceitar pelo cliente ou área solicitante. |
| Data do aceite de homologação | Data | Data da aprovação. |
| Evidência do aceite de homologação | URL | Confirmação explícita referente à versão. |

**Critério de saída:** critérios atendidos, defeitos bloqueadores resolvidos, aceite explícito e exceções registradas. Silêncio não é aceite. Mudanças de escopo exigem reavaliação; não incorporá-las como correções automaticamente. **Destino:** lista 12, A planejar.

### 12. Implantação

**Descrição da lista:** Prepara e executa a publicação da versão homologada, incluindo ambiente, migração, comunicação, treinamento, reversão e verificação do funcionamento em produção.

**Responsável pela fase:** responsável técnico pela implantação. **Entrada:** homologação registrada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A planejar | Entrada | Definir janela, responsáveis, comunicação e sequência. |
| Em preparação do ambiente | Em andamento | Configurar infraestrutura, permissões, monitoramento e dados. |
| Aguardando liberação | Em andamento | Obter autorização e conferir condições de publicação. |
| Implantação agendada | Em andamento | Confirmar horário e avisar envolvidos. |
| Em implantação | Em andamento | Executar publicação e migração conforme o plano. |
| Em verificação de produção | Em andamento | Validar funções essenciais, integrações e integridade dos dados. |
| Em correção da implantação | Em andamento | Corrigir falha ou reverter; repetir preparação e autorização conforme necessário. |
| Implantado | Saída da fase | Confirmar publicação bem-sucedida e iniciar acompanhamento. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Responsável pela implantação | Pessoa | Quem conduz e coordena a publicação. |
| Versão a publicar | Texto curto | Versão homologada autorizada para produção. |
| Janela de implantação | Data e hora | Início autorizado; informar duração e limite no plano. |
| Ambiente de produção | URL | Endereço da solução em produção. |
| Plano de implantação | URL | Procedimento, responsáveis, comunicações e verificações. |
| Necessita migração de dados? | Sim/Não | Define se existe transferência ou alteração de dados a executar. |
| Plano de migração | URL | Procedimento, backup, validação e recuperação; obrigatório quando houver migração. |
| Plano de reversão | URL | Condições e procedimento para restaurar a operação anterior. |
| Aprovador da publicação | Pessoa | Quem autoriza executar, considerando aceite e condições técnicas. |
| Evidência da autorização de publicação | URL | Registro explícito da autorização. |
| Resultado da implantação | Seleção única | Opções: Publicada; Revertida; Parcial. Apenas Publicada autoriza marcar Implantado. |
| Evidência da verificação em produção | URL | Resultados das verificações pós-publicação. |
| Material de treinamento | URL | Instruções ou treinamento necessário para os usuários. |
| Comunicação e treinamento realizados | Texto longo | Registra público informado, data e treinamento; justificar quando não aplicável. |

**Critério de saída:** autorização, publicação e verificações concluídas; migração validada quando houver; usuários orientados; resultado Publicada. Revertida ou Parcial permanece nesta fase. **Destino:** lista 13, A iniciar.

### 13. Operação assistida

**Descrição da lista:** Acompanha o uso inicial em produção, monitora estabilidade e incidentes, verifica correções e prepara a transferência para a operação regular de suporte.

**Responsável pela fase:** responsável pelo acompanhamento técnico e funcional. **Entrada:** implantação concluída e verificada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A iniciar | Entrada | Confirmar período, responsáveis, indicadores e canais de atendimento. |
| Em acompanhamento | Em andamento | Monitorar uso, disponibilidade, erros e retorno dos usuários. |
| Incidente identificado | Em andamento | Registrar ocorrência, impacto, severidade e responsável. |
| Em correção | Em andamento | Resolver incidente conforme procedimento de mudança e publicação. |
| Em verificação | Em andamento | Confirmar resolução e estabilidade; voltar ao acompanhamento se ainda dentro do período. |
| Operação estabilizada | Saída da fase | Confirmar critérios de estabilização e encaminhar pendências não bloqueadoras. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Responsável pelo acompanhamento | Pessoa | Quem coordena o período assistido. |
| Início da operação assistida | Data | Primeiro dia do acompanhamento. |
| Fim previsto da operação assistida | Data | Data prevista, ajustada por decisão explícita se necessário. |
| Monitoramento | URL | Painéis, alertas e registros usados na avaliação. |
| Incidentes vinculados | Relacionamento | Subtarefas ou registros das ocorrências, com severidade, impacto e solução. |
| Critérios de estabilização | Texto longo | Condições objetivas, incluindo período de observação e limites aceitáveis de falha. |
| Resultado observado | Texto longo | Estabilidade e resultados iniciais, sem atribuir ganhos ainda não medidos. |
| Pendências para suporte | Texto longo | Itens não bloqueadores, com responsáveis e tratamento acordado. |
| Evidência da estabilização | URL | Registro que demonstra o atendimento aos critérios. |

**Critério de saída:** período de observação cumprido, critérios atendidos, nenhuma ocorrência crítica ou alta em aberto e pendências menores aceitas e encaminhadas. **Destino:** lista 14, A encerrar.

### 14. Encerramento e transição para manutenção

**Descrição da lista:** Formaliza a conclusão do projeto, consolida documentação e resultados, registra o aceite final e transfere responsabilidades, condições de manutenção e pendências para o suporte.

**Responsável pela fase:** responsável pelo projeto. **Entrada:** operação estabilizada.

#### Estados

| Estado | Categoria | O que acontece |
|---|---|---|
| A encerrar | Entrada | Conferir entregas, aceites, obrigações e pendências. |
| Em documentação final | Em andamento | Consolidar documentação técnica, operacional e de uso. |
| Em transferência para suporte | Em andamento | Transferir conhecimento, contatos e responsabilidades; confirmar recebimento. |
| Aguardando aceite final | Em andamento | Solicitar confirmação formal de encerramento. |
| Encerrado | Encerrado | Registrar aceite, data e destino das pendências; preservar histórico. |

#### Campos personalizados específicos

| Nome | Tipo | Observação |
|---|---|---|
| Documentação final | URL | Referência consolidada de uso, operação e documentação técnica. |
| Responsável pelo suporte | Pessoa | Quem assume o atendimento após a entrega. |
| Registro da transferência para suporte | URL | Confirmação de recebimento, treinamento e responsabilidades. |
| Condições de manutenção e garantia | Texto longo | Cobertura, prazos, exclusões e referência ao contrato vigente. |
| Pendências aceitas no encerramento | Texto longo | Cada item deve ter destino, responsável, prazo ou condição de tratamento. |
| Custo realizado do projeto | Moeda | Custo efetivamente apurado; informar a fonte no registro financeiro. |
| Resultado comercial confirmado | URL | Fonte de contratação e faturamento; distinguir contratado, faturado e recebido. |
| Avaliação dos critérios de sucesso | Texto longo | Resultado comparado aos critérios do briefing; indicar o que ainda exige medição futura. |
| Aprovador do encerramento | Texto curto | Quem está autorizado a confirmar o término. |
| Aceite final | URL | Evidência explícita de encerramento e eventuais ressalvas. |
| Data do encerramento | Data | Data da conclusão formal. |
| Aprendizados | Texto longo | Decisões, dificuldades e orientações úteis para projetos futuros. |

**Critério de saída:** aceite final, documentação e transferência confirmados; pendências com destino; resultados e custos apurados ou medição futura atribuída a responsável e data. Se não houver pendência, registrar “Nenhuma”.

Novas melhorias entram na lista 01 como novas demandas relacionadas ao projeto encerrado. Suporte contínuo ocorre no fluxo de suporte; esta lista conclui a transferência, não mantém o projeto eternamente em manutenção.

## 5. Subtarefas e execução em paralelo

O estado da tarefa principal representa a situação do projeto como um todo. Dentro de Desenvolvimento, diferentes funcionalidades podem estar em implementação, revisão e testes ao mesmo tempo. Só mover o projeto para Pronto para testes quando o conjunto da entrega estiver pronto.

Criar subtarefas com título, descrição, responsável, prazo, critérios de aceite e evidências pertinentes. Para bugs, acrescentar passos para reproduzir, resultado esperado, resultado observado e severidade. Para funcionalidades, vincular a seção da especificação e o protótipo. Usar checklists para passos simples que não precisam de dono ou prazo próprios.

Se a ferramenta herdar estados da lista nas subtarefas, usar esses estados conforme aplicável e registrar passos menores em checklist. Não criar uma segunda estrutura de listas de funcionalidades sem necessidade operacional comprovada.

Para entregas em versões distintas, registrar a versão em cada subentrega e seus aceites. O encerramento da tarefa principal exige conclusão do escopo contratado; uma publicação parcial não conclui o projeto.

## 6. Regras de movimentação e aprovação

1. Na criação: usar lista 01, Nova demanda; execução Normal; prioridade Normal; não atribuir impacto ou receita automaticamente.
2. Antes de avançar: conferir campos obrigatórios, evidências, pendências e condições da fase.
3. Ao aprovar: registrar decisor, data, justificativa e link de evidência na tarefa. Salvar no histórico um resumo com fase, versão e decisão.
4. Ao mover: preservar a tarefa, anexos, comentários, subtarefas e campos anteriores; selecionar explicitamente o primeiro estado da lista de destino; atribuir o responsável e o prazo da nova fase.
5. Não automatizar saltos antes de validar critérios e preservação de dados. Uma automação futura deve verificar as condições e registrar o que executou.
6. Se reprovado em revisão: usar Ajustes solicitados e retornar para o estado de execução correspondente após registrar o que deve mudar.
7. Se houver mudança de escopo: registrar pedido e impacto; retornar à viabilidade e ao escopo quando afetar receita, custo, prazo ou obrigação; atualizar documentos e aprovações subsequentes afetados.
8. Se pausado: preencher os campos comuns, definir revisão e manter o estado da fase. Na retomada, revisar prazos e condições.
9. Se cancelado: preencher motivo, decisor, data, comunicação e tratamento das pendências financeiras ou contratuais; encerrar sem mover para fases seguintes.
10. Se reaberto: registrar motivo e responsável; manter o histórico e retornar ao estado apropriado. Demandas novas não devem reabrir um projeto entregue apenas para aproveitar seu cadastro.

**Comunicação das decisões:** o responsável pela fase informa o solicitante sobre qualificação, rejeição, pedido de informação, alterações de compromisso e encerramento. Registrar data, destinatário e referência da comunicação nos comentários.

## 7. Visualizações e ordem de configuração

### Visualizações padrão

- **Em cada lista — Quadro por status:** operação diária e filas de espera.
- **Em cada lista — Tabela de configuração:** título, cliente, responsável, prioridade, prazo, saúde, situação de execução e campos pertinentes à fase.
- **Na pasta — Projetos por fase:** agrupar pela lista atual, com filtros por cliente, responsável e saúde.
- **Na pasta — Pendências:** filtrar situações Bloqueada/Pausada e prazos de retorno ou revisão vencidos.
- **Comercial — Receita:** exibir cliente, relação com receita, situação comercial, valores e responsável; manter receita em risco separada de receita nova. Não somar valores das subtarefas ao projeto se forem apenas desdobramentos da mesma receita.
- **Histórico — Encerradas:** incluir tarefas encerradas para consulta, separadas da fila ativa.

### Acesso e configuração visual

- Campos financeiros e evidências comerciais devem ser acessíveis somente às pessoas autorizadas pela empresa. Ocultar coluna é organização visual, não controle de permissão.
- Evitar acesso de clientes externos à pasta inteira. Se for necessário compartilhar uma tarefa, conferir também documentos, comentários, anexos e campos visíveis.
- Sugestão de cores: entrada cinza; execução azul; espera amarelo; ajustes laranja; saída aprovada verde; rejeição/cancelamento vermelho. Cor não substitui o nome do estado.
- Notificações: avisar responsável quando atribuído; mencionar quem deve responder; lembretes vinculados a prazo. Não criar alertas recorrentes sem responsável ou ação esperada.

### Sequência de implantação do processo

1. Criar espaço e pasta com as descrições deste documento.
2. Criar campos comuns e comerciais uma única vez.
3. Criar as 14 listas na ordem indicada e colar as descrições.
4. Configurar estados próprios em cada lista, incluindo Cancelado.
5. Criar campos específicos e colar as observações; cadastrar as opções exatamente como documentadas.
6. Montar um modelo de tarefa por fase com checklist dos critérios de passagem, sem criar cópias da mesma demanda em todas as fases.
7. Definir pessoas para os papéis de triagem, produto, técnico, financeiro, qualidade e suporte.
8. Configurar visualizações e permissões.
9. Executar os cenários de validação abaixo antes de operar com demandas reais.

## 8. Checklist de validação da configuração

- [ ] Registrar uma demanda externa e uma interna; conferir regra de Cliente.
- [ ] Qualificar uma demanda com receita direta, uma com recorrência, uma de retenção e uma sem receita; conferir evidências e valores sem dupla contagem.
- [ ] Impedir qualificação com relação com receita A confirmar ou pendência essencial aberta.
- [ ] Registrar pedido de informação, responsável e prazo; devolver à análise após resposta.
- [ ] Encaminhar duplicada e suporte com vínculo, sem registrá-las como rejeição comercial.
- [ ] Mover uma tarefa por todas as listas e verificar campos, anexos, subtarefas, histórico, status inicial e responsável.
- [ ] Confirmar que saída de fase não encerra globalmente o projeto.
- [ ] Simular rejeição, pausa, cancelamento e reabertura com justificativas preservadas.
- [ ] Simular mudança de escopo com reavaliação financeira e nova versão aprovada.
- [ ] Simular falha em testes, correção, reteste e aceite de exceção não bloqueadora.
- [ ] Simular implantação revertida e confirmar que não avança como Implantado.
- [ ] Conferir aceite explícito de homologação e encerramento; ausência de resposta não aprova.
- [ ] Conferir permissão de acesso financeiro e compartilhamento externo com usuário de teste.

Este checklist verifica a configuração na ferramenta. Sua execução cabe à implantação do processo; a produção deste documento não significa que esses cenários já foram executados.
