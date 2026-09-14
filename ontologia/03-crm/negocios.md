# NEGÓCIO

> Domínio: CRM | Documento 12 de 21 | Status: APROVADO CONCEITUALMENTE | Versão da ontologia: 0.1

## 1. Definição ontológica

O **Negócio** é a representação, no CRM, de uma **oportunidade comercial identificável com ciclo de vida próprio**: algo que a organização está tentando vender, fechar, renovar ou acordar com uma ou mais partes externas, que começa, progride por um processo comercial (Funil) e termina em um resultado (`ganho` ou `perdido`). Envolve potencialmente uma Empresa, Contatos, um valor econômico e trabalho (Tarefas), mas não se confunde com nenhum deles.

Quatro propriedades o distinguem de qualquer outra entidade da ontologia:

1. **É o "o quê" da relação comercial, não o "quem".** A Empresa é a organização externa; o Contato é a pessoa; o Negócio é **o que está sendo negociado** com eles, agora. Uma Empresa tem vinte Negócios ao longo de dez anos; cada um é uma oportunidade distinta, com o próprio valor, o próprio processo e o próprio desfecho.
2. **Tem resultado.** É a única entidade do CRM cujo ciclo de vida termina em um veredito: `ganho` ou `perdido` (A4.4). Contato e Empresa não "terminam"; Conversa é `resolvida` (episódio encerrado), não vencida ou perdida.
3. **Percorre um processo.** Todo Negócio está em exatamente um Funil e, enquanto `aberto`, em exatamente uma Etapa dele (B9). Ele **percorre** o Funil, não pertence a ele (DO-FUN-01): sobrevive à troca, ao arquivamento e à reconfiguração do Funil.
4. **É raiz de agregado.** Valor, Valores de Campo, Comentários, Anexos e os atributos do Vínculo Contato-Negócio não existem fora dele. Empresa, Contatos, Tarefas, Conversas e Documentos relacionam-se com ele, mas não lhe pertencem nem ele a eles.

O Negócio não é um "cartão no quadro", não é uma "venda", não é um "pedido", não é um "cliente" e não é uma Tarefa. O cartão é uma forma de vê-lo; a venda e o pedido são o que decorre do ganho, fora da ontologia; o cliente é a Empresa ou o Contato; a Tarefa é o trabalho que ele gera.

## 2. Propósito

1. **Tornar a oportunidade um objeto rastreável.** Sem Negócio, "estamos negociando um pacote de dez sessões com a Clínica Vida" seria um Comentário em um Contato, um Campo Personalizado em uma Empresa ou uma Tarefa — nenhum deles com valor, probabilidade, posição em processo e resultado comparáveis entre oportunidades.
2. **Dar a receita futura uma forma mensurável.** Valor, probabilidade efetiva e valor ponderado (seção 6) permitem que Painéis respondam "quanto há em aberto", "quanto se espera fechar" e "quanto foi ganho por período, Etapa, Origem, Proprietário ou Empresa".
3. **Separar oportunidade de trabalho.** Um Negócio gera Tarefas (proposta, visita, contrato) e Conversas (negociação por WhatsApp); ele é o contexto que as reúne, não uma delas (seção 4). Sem essa separação, o CRM viraria uma Lista de Tarefas com valor.
4. **Ser o objeto natural de Automações e Agentes comerciais.** "Ao ganhar", "parado há dez dias", "previsão vencida", "sem próxima atividade" são os Gatilhos e as perguntas mais frequentes do domínio; todos são eventos ou derivados do Negócio (seção 18).
5. **Preservar a história comercial.** Registros de transição com Etapa por identidade, nome e Ordem à época (DO-FUN-13), Motivo de Perda, última Etapa e Proprietário à época permitem responder "em que Etapa perdemos mais" e "quem ganhou o quê" depois de qualquer reorganização de Funis ou de Membros.

## 3. Natureza da entidade

- **Entidade com identidade própria**, persistente, pertencente diretamente ao Espaço de Trabalho (A1.1; A2.2). Sem contêiner intermediário: o CRM não tem hierarquia (A5.2).
- **Raiz de agregado**: Valor (objeto de valor), Valores de Campo, Comentários, Anexos (referências) e a face do Negócio no Vínculo Contato-Negócio (papel, principal) são consistentes sob a sua responsabilidade.
- **Registro operacional, não configuração.** Diferente do Funil (configuração com identidade), o Negócio é o dado que a configuração organiza.
- **Tem Proprietário** (A7): exatamente um Membro, que responde pela governança e pelo destino do Negócio. **Não tem Responsável nem Atribuído**: o trabalho é Tarefa vinculada; o atendimento é Conversa vinculada.
- **Tem situação** (`aberto`, `ganho`, `perdido`), estado de sistema exclusivo do Negócio (A4.4), **ortogonal** ao estado de ciclo de vida (`ativo`, `arquivado`, `na lixeira` — A4.1).
- **Recurso de permissão** (A9.1), com escopos `registro` e `próprios` (B29), filtrado pelo Funil quando este é privado (DO-FUN-10).
- **Fonte de Dados de Painel**, **objeto de Gatilho de Automação** (escopo Funil, B41) e **âncora de Sessão de Chat** (B21).
- **Não é Ator, não é contêiner, não é Tarefa, não é Status, não é objeto de valor.**

## 4. Fronteira conceitual

### O que é

- Uma oportunidade comercial nomeada, com Proprietário, em um Funil e em uma Etapa, com situação, valor opcional, Empresa opcional, Contatos opcionais com papel, previsão de fechamento opcional e histórico.
- A unidade sobre a qual se mede resultado comercial (ganho, perda, conversão, receita esperada).
- O ponto de convergência entre CRM (Empresa, Contatos, Conversas), Estrutura de Trabalho (Tarefas vinculadas) e IA (Agentes que qualificam, movem e resumem).

### O que não é

- **Não é Empresa.** Empresa é quem; Negócio é o quê. A Empresa permanece; o Negócio termina.
- **Não é Contato.** Contato é pessoa; o Negócio envolve pessoas com papéis (decisor, comprador) e pode envolver nenhuma.
- **Não é Funil nem Etapa.** O Funil é o caminho; a Etapa é a posição; o Negócio é o que percorre (DO-FUN-01).
- **Não é Tarefa.** Tarefa é unidade de trabalho com status e Responsáveis; o Negócio é o motivo do trabalho. Um Negócio gera Tarefas; nunca é uma.
- **Não é Conversa.** Conversa é episódio de comunicação com um Contato por um Canal; o Negócio é o assunto comercial ao qual Conversas podem ser vinculadas.
- **Não é Proposta, Orçamento nem Contrato** (D3): esses são artefatos que o Negócio pode ter; hoje, Anexos e Tarefas.
- **Não é Venda, Pedido nem Fatura.** O ganho encerra o Negócio; o que acontece depois (pedido, faturamento, entrega) é de outro sistema ou de entidade futura.
- **Não é "lead".** Lead é Qualificação de Contato (DO-CON-05), não uma fase do Negócio.

### Comparações

| X × Y | X | Y | Critério de distinção |
| --- | --- | --- | --- |
| **Negócio × Empresa** | Oportunidade: valor, Funil, Etapa, situação, Proprietário; termina. Referencia 0..1 Empresa. | Organização externa: nomes, Identificadores, Endereços, hierarquia matriz/filial; permanece. Referenciada por 0..N Negócios. | Teste de existência: a Empresa existe sem Negócio e o Negócio existe sem Empresa (B9). "Empresa com vinte Negócios" é a referência inversa; nunca contenção (RN-EMP-10 adia a eliminação da Empresa enquanto houver Negócio, exatamente porque não há cascata). |
| **Negócio × Contato** | Oportunidade com Contatos em papéis (`decisor`, `comprador`...), 0..N, de qualquer Empresa. | Pessoa física externa, com Identificadores, Consentimentos, Qualificação. | O papel no Negócio é atributo do Vínculo Contato-Negócio; o cargo é atributo do Vínculo Contato-Empresa (DO-CON-04). O mesmo Contato é `decisor` em um Negócio e `técnico` em outro. Eliminar o Contato remove o Vínculo; o Negócio permanece (DO-CON-10). |
| **Negócio × Funil** | Registro operacional com Proprietário e valor; escolhe (ou recebe) o Funil; muda de Funil por ato explícito. | Configuração com identidade do Espaço de Trabalho; sem Proprietário; sequência de Etapas. | O Negócio **percorre**; o Funil **é percorrido** (DO-FUN-01). Nenhuma permissão, estado ou Valor de Campo do Negócio deriva do Funil (exceto a restrição por Funil privado, seção 17). |
| **Negócio × Etapa** | Referencia exatamente uma Etapa (atual ou última) por identidade; carrega a história de todas as Etapas por que passou. | Posição nomeada e ordenada dentro de um Funil; componente do Funil; sem estado; fornece a probabilidade padrão. | Reordenar ou renomear a Etapa não altera o Negócio (RN-FUN-05); remover a Etapa exige remapear o Negócio (RN-FUN-10). A Etapa nunca contém Negócios; "Negócios na Etapa" é consulta. |
| **Negócio × Tarefa** | Oportunidade: situação `aberto`/`ganho`/`perdido`; Proprietário único; valor; sem Responsáveis; sem status. Pertence ao Espaço de Trabalho. | Unidade de trabalho: status personalizável com categoria (A4.3); Responsáveis 0..N; datas; Registros de Tempo. Pertence a uma Lista. | Negócio responde "quanto vale e em que ponto da venda está"; Tarefa responde "o que precisa ser feito e quem faz". Relacionam-se por Vínculo (DO-TAR-08), nunca por contenção (A2.2). Um Negócio gera Tarefas; concluir todas as Tarefas não ganha o Negócio; ganhar o Negócio não conclui as Tarefas (só Automação o faz). |
| **Negócio × Conversa** | Assunto comercial durável, com resultado; vinculado a 0..N Conversas de qualquer Canal. | Episódio de comunicação com exatamente um Contato principal por um Canal (B12), com estado `aberta`/`pendente`/`resolvida`, Atribuído, Fila; pertence à Caixa de Entrada. | A Conversa pode existir sem Negócio (suporte); o Negócio pode existir sem Conversa (venda presencial). Vincular não transfere Proprietário, Atribuído nem permissão. Resolver a Conversa não altera o Negócio; ganhar o Negócio não resolve a Conversa. |
| **Situação do Negócio × Status de Tarefa** | `aberto`, `ganho`, `perdido`: fixa pela plataforma; três valores; ganho/perdido são vereditos; independente da Etapa. | Definição de Status personalizável, com categoria fixa (`não iniciado`, `em andamento`, `concluído`, `fechado`); a posição no fluxo e o resultado estão na mesma dimensão. | Na Tarefa, o resultado é uma categoria de status ("Aprovado" é `concluído`); no Negócio, posição (Etapa) e resultado (situação) são dimensões independentes (DO-FUN-03). Não existe "Etapa Ganho" que ganhe (RN-FUN-20) nem "situação personalizada". |
| **Negócio × Proposta / Contrato (D3)** | Oportunidade; pode ter zero, uma ou várias propostas ao longo do tempo; o valor do Negócio é o valor esperado, não necessariamente o da última proposta. | Artefato comercial com ciclo de vida próprio (rascunho, enviada, aceita, recusada), versões, validade; futuro. | Hoje, proposta é Anexo (Arquivo) e/ou Tarefa vinculada ("Enviar proposta"); "proposta aceita" é Comentário, Valor de Campo ou Etapa. Se D3 for adotada, Proposta referencia o Negócio (N:1) e o Negócio permanece raiz. |
| **Negócio × Venda / Pedido** | Termina em `ganho`; o ganho é o último fato que a ontologia registra sobre a oportunidade. | Compromisso de entrega e cobrança: itens, quantidades, preços finais, faturamento, pagamento; fora da ontologia. | O ganho **encerra** o Negócio; não o transforma em pedido. Integrações podem criar o pedido em outro sistema ao ganhar (Automação); receita realizada, inadimplência e entrega não são atributos do Negócio. Se D2 (Itens de Negócio) for adotada, itens compõem o valor, mas continuam não sendo pedido. |

## 5. Identidade

O Negócio tem um **identificador imutável, opaco e atribuído pela plataforma** na criação. Esse identificador é a identidade; tudo o mais é atributo.

**Teste de identidade.** Se o Título, a Descrição, o Objeto, o Valor (quantia e moeda), a Empresa, todos os Contatos vinculados, o Proprietário, o Funil, a Etapa, a probabilidade, a previsão de fechamento, a Origem, todos os Valores de Campo, as Tags e a situação mudarem — inclusive `perdido` → `aberto` → `ganho` —, continua sendo o mesmo Negócio: os Registros de Atividade, os Comentários, os Vínculos com Tarefas e Conversas, os Anexos e os Widgets que o contam continuam a apontar para ele. A identidade é a **continuidade da oportunidade** enquanto objeto de acompanhamento, não qualquer atributo.

Consequências:

- **Mudar de Funil não muda a identidade** (RN-FUN-15). O histórico de que percorreu o Funil anterior permanece.
- **Trocar a Empresa não muda a identidade.** É correção ou requalificação da oportunidade, registrada (RN-NEG-06).
- **Reabrir não muda a identidade.** É evento sobre o mesmo Negócio (B9).
- **Criar "a partir de" outro Negócio é outra identidade** (pós-venda gerado ao ganhar; renovação): Negócio novo com Proveniência (documento 13, 20.6).
- **Título não é identidade.** Dois Negócios podem ter o mesmo Título, na mesma Empresa, no mesmo Funil (20.16).
- **Contato mesclado não afeta a identidade do Negócio**: o Vínculo migra ao sobrevivente (DO-CON-11).

**Identificador legível** (DO-NEG-02, RECOMENDADA). Análogo ao de Tarefa (DO-TAR-02; Glossário): o Espaço de Trabalho pode habilitar um identificador legível para Negócios — número sequencial único no Espaço de Trabalho, com prefixo próprio, distinto do de Tarefas (ex.: `NEG-0421`). Derivado da criação, imutável, nunca reutilizado, invariante à mudança de Funil, de Empresa, de situação e à restauração. Justificativa: Negócios são citados em Conversas, Comentários, Tarefas, Painéis e por Agentes ("o NEG-0421 parou em Proposta"); Título não é único e o identificador opaco não é pronunciável. A sequência é única no Espaço de Trabalho porque referências cruzam Funis e domínios (A1.1). Impacto no documento 01: novo objeto de valor "Identificador legível de Negócios" (habilitado, prefixo), ao lado do de Tarefas (seção 24).

## 6. Atributos fundamentais

### 6.1 Tabela

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Identificador | nativo | sim | Identidade imutável atribuída pela plataforma. |
| Identificador legível | derivado da criação | condicional | Quando habilitado no Espaço de Trabalho (DO-NEG-02). Imutável. |
| Espaço de Trabalho | referência | sim | Imutável (INV-ET-01). |
| Título | nativo | sim | Nome da oportunidade. Não único (20.16). |
| Objeto | nativo (texto) | não | Descrição textual do produto ou serviço negociado (B10). Substitui catálogo de Produtos nesta versão; estrutura adicional por Definições de Campo (D2 futura). |
| Descrição | nativo (texto longo) | não | Observações livres sobre a oportunidade. Sem autor próprio; histórico nos Registros de Atividade. Não é Comentário. |
| Empresa | referência (Empresa) | não | 0..1. Só Empresa `ativo` ao vincular ou trocar (RN-EMP-08). Preservada quando a Empresa é arquivada; reapontada na mesclagem (DO-EMP-13). |
| Proprietário | referência (Membro) | sim | Exatamente um Membro `ativo` ou `suspenso` (A7; INV-ET-03). Sucessão B28. Distinto de Responsável: o Negócio não tem Responsáveis. |
| Criador | referência (Ator) | sim | Imutável; ator delegante registrado (A6.2). |
| Funil | referência (Funil) | sim | Exatamente um (B9). Substituível por mudança de Funil (RN-FUN-15). |
| Etapa | referência (Etapa do Funil referenciado) | sim | **Etapa atual** enquanto `aberto`; **última Etapa** quando `ganho`/`perdido` (B9). Por identidade, nunca por nome (RN-FUN-05). INV-FUN-06. |
| Valor | objeto de valor (quantia, moeda) | não | 0..1. Quantia decimal não negativa; moeda com padrão da Localidade (RN-ET-15). Vazio é válido. Moeda diferente da padrão é permitida (20.9). |
| Probabilidade sobrescrita | nativo (percentual inteiro 0–100) | não | 0..1. Avaliação própria do Negócio na Etapa atual. Descartada ao mudar de Etapa por progressão (DO-NEG-05). |
| Probabilidade efetiva | derivado | sim | Probabilidade sobrescrita, se existir; senão, a probabilidade padrão da Etapa atual (RN-FUN-18). Para `ganho`: 100; para `perdido`: 0. Nunca gravada. |
| Valor ponderado | derivado | condicional | Quantia × probabilidade efetiva, na moeda do Valor. Vazio se o Valor é vazio. Nunca gravado. |
| Situação | nativo (estado de sistema) | sim | `aberto`, `ganho`, `perdido` (A4.4; seção 11). |
| Motivo de Perda | referência (Motivo de Perda) | condicional | Obrigatório ao marcar `perdido` quando a Regra de encerramento do Funil o exige (DO-FUN-08). Preservado na reabertura como histórico (B9); limpo como atributo corrente (RN-NEG-11). |
| Motivo de Ganho | referência (Motivo de Ganho) | não | Catálogo opcional do Espaço de Trabalho, simétrico a Motivo de Perda (DO-NEG-06). |
| Nota de encerramento | nativo (texto) | não | Texto complementar ao Motivo de Perda ou de Ganho ("preço 30% acima do concorrente X"). |
| Origem | referência (Origem) | não | 0..1. Fonte de aquisição **da oportunidade** (catálogo do Espaço de Trabalho, B34). Pode diferir da Origem do Contato e da Empresa (20.17). |
| Data prevista de fechamento | nativo (dia civil) | não | Estimativa do Proprietário. Base de "previsão vencida". |
| Momento de criação | nativo | sim | Imutável. |
| Momento de encerramento | derivado | condicional | Instante do último Registro de Atividade "ganho" ou "perdido". Vazio enquanto `aberto`; limpo na reabertura (o histórico permanece nos Registros). |
| Data de fechamento | derivado (dia civil) | condicional | Momento de encerramento interpretado no fuso da Localidade. Para Painéis por período. |
| Momento de entrada na Etapa atual | derivado | sim | Instante do último Registro "entrou em Etapa" (inclusive por criação, mudança de Funil, reabertura ou remapeamento). |
| Dias em Etapa | derivado | sim | Agora − momento de entrada na Etapa atual, enquanto `aberto`. Base de "parado há X dias". |
| Idade | derivado | sim | Agora (ou momento de encerramento) − momento de criação. |
| Última atividade | derivado | não | Momento do Registro de Atividade mais recente sobre o Negócio ou seu agregado, ou de evento de Tarefa ou Conversa vinculada visível ao consultante. |
| Próxima atividade | derivado | não | A Tarefa vinculada em categoria não terminal com a menor Data (vencimento ou início) visível ao consultante. Vazio se não há. |
| Previsão vencida | derivado (booleano) | sim | `aberto` e Data prevista de fechamento anterior ao dia civil corrente na Localidade. |
| Estado | nativo (estado de sistema) | sim | `ativo`, `arquivado`, `na lixeira` (A4.1; seção 11). |
| Estado anterior à exclusão | nativo (condicional) | condicional | Presente enquanto `na lixeira`: o estado (`ativo` ou `arquivado`) que o Negócio tinha ao ser excluído; a restauração o devolve a esse estado e o esvazia, nunca forçando `ativo` (B43 aplicada por analogia ao CRM). |
| Proveniência | objeto de valor | não | Origem do registro sem vínculo vivo: importação (Integração, lote), "criado a partir de" Conversa, Contato, Empresa, Tarefa, Mensagem de Chat ou outro Negócio (pós-venda, renovação). |

### 6.2 Valor (objeto de valor)

**Valor** é um objeto de valor composto por **quantia** (decimal, não negativa) e **moeda** (código de moeda). Não tem identidade: alterar a quantia substitui o objeto, com Registro de Atividade "valor alterado" (antes, depois). A moeda nasce com o padrão da Localidade e pode ser outra por Negócio (RN-ET-15); alterar a Localidade não reescreve Valores gravados (RN-ET-16). **Conversão entre moedas é derivada e fora da ontologia**: um Painel que soma Negócios em moedas distintas precisa de taxa e data de referência, que a ontologia não fornece (20.9; seção 25). Valor vazio e Valor zero são coisas diferentes: vazio é "não estimado"; zero é "sem valor econômico" (cortesia, piloto). A Regra de encerramento "exigir valor" (DO-FUN-08) rejeita ambos ao ganhar.

### 6.3 Probabilidade

Três conceitos, um só gravado:

- **Probabilidade padrão da Etapa** — atributo da Etapa (documento 13, 6.2).
- **Probabilidade sobrescrita** — atributo opcional do Negócio: a avaliação do Proprietário de que este Negócio, **nesta Etapa**, difere do padrão.
- **Probabilidade efetiva** — derivada: sobrescrita se existir, senão a padrão da Etapa atual; 100 em `ganho`, 0 em `perdido`. Resolvida a cada consulta (documento 13, seção 16).

**Decisão (DO-NEG-05): a sobrescrita é descartada quando o Negócio muda de Etapa por progressão** (avanço, retrocesso, salto, mudança de Funil, reabertura para outra Etapa), com Registro de Atividade que preserva o valor descartado; **é preservada em remapeamentos obrigatórios** (remoção de Etapa, migração por arquivamento ou lixeira do Funil — RN-FUN-08), porque esses são manutenção de configuração, não progressão, e nenhuma operação de configuração altera dados do Negócio sem ato explícito (INV-FUN-10). Justificativa: a sobrescrita é um juízo sobre o Negócio **em uma posição**; mantê-la ao retroceder de "Negociação" (90%) para "Novo" produz um valor ponderado falso que ninguém lembra de corrigir; descartá-la devolve o Negócio ao padrão calibrado pela organização e obriga o novo juízo a ser explícito. Alternativa rejeitada — manter a sobrescrita — porque cria dado silenciosamente desatualizado e torna "valor ponderado por Etapa" incomparável. O produto pode oferecer "manter a probabilidade" como opção no ato de mover, que grava uma nova sobrescrita (ato explícito, não herança). Ajusta a leitura de "recalculada se herdada" do documento 13 (12.4, 20.6) para "sempre recalculada em progressão" (seção 24).

### 6.4 Valor de Campo

Entidade interna (A5.1). Um por Definição de Campo Personalizado do Espaço de Trabalho cuja entidade-alvo é Negócio (A5.2). Como o CRM não tem hierarquia e as Definições valem em todos os Funis (DO-FUN-07), **não existem Valores órfãos por mudança de Funil** (B37 não se aplica); Valores desaparecem apenas com a Definição (A5.4). Requisitos de Etapa do tipo `campo preenchido` leem Valores do Negócio (DO-FUN-06). Valor de tipo relação é Valor de Campo, não Vínculo (documento 06, 6.3).

**Não são atributos do Negócio**, embora sejam calculados sobre ele: taxa de conversão, posição no ranking, tempo médio, "score" de IA. São Métricas de Painel ou saídas de Execução, nunca gravadas (DO-FUN-12 aplicada ao Negócio).

## 7. Entidades internas ou componentes

### 7.1 Vínculo Contato-Negócio (associação com atributos; face do Negócio)

Vínculo é transversal (A8). Este documento fixa os atributos do Vínculo Contato-Negócio, cuja consistência (papéis, um principal) é garantida pelo agregado do Negócio; o documento 10 já o referencia (7.6).

| Atributo | Natureza | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Contato | referência | sim | Contato não `mesclado` do mesmo Espaço de Trabalho. Reapontado ao sobrevivente na mesclagem (DO-CON-11). |
| Papel no Negócio | nativo (catálogo fixo da plataforma) | sim | `decisor`, `influenciador`, `comprador`, `técnico`, `usuário`, `outro`. Um por Vínculo. `outro` admite rótulo livre (DO-NEG-03). |
| Principal | nativo (booleano) | sim | **Contato principal do Negócio**: no máximo um por Negócio (INV-NEG-06). O primeiro Vínculo nasce principal. Interlocutor padrão para Agentes, Automações e "iniciar Conversa a partir do Negócio". |
| Criador; momento | referência (Ator); nativo | sim | Imutáveis; ator delegante quando houver. |

Regras: no máximo **um Vínculo por par (Contato, Negócio)** — um Contato tem um papel por Negócio; se acumula funções, o papel é o preponderante e o rótulo de `outro` ou um Comentário registra o resto (DO-NEG-03). Os Contatos vinculados **não precisam** pertencer à Empresa do Negócio (20.2): o Vínculo é livre. Desvincular remove o papel e o indicador; o Negócio pode ficar sem Contato principal (válido). Vínculo visível só a quem vê ambos os lados (DO-TAR-08). Catálogo **fixo** nesta versão, pela mesma razão de DO-EMP-07: Painéis e Agentes precisam interpretar "quem decide" sem ler nomes; `outro` com rótulo cobre o resto; catálogo configurável é questão em aberto (seção 25).

### 7.2 Valor

Objeto de valor (6.2). 0..1.

### 7.3 Comentário (no Negócio)

Manifestação de um Ator sobre o Negócio (A8). Aplica-se o modelo de DO-TAR-07 (documento 06, 7.1): autor Ator (Agente incluído, com delegante), conteúdo rico com menções e Anexos, respostas em um nível, resolução no Comentário raiz, edição só pelo autor ou por quem tem `administrar` sobre o Negócio, exclusão com marcador (DO-NEG-15, no padrão de DO-EMP-15). Comentário **não é** Mensagem: nunca chega ao Contato. Comentário **não é** Nota de encerramento nem Descrição.

### 7.4 Valor de Campo

Ver 6.4.

### 7.5 Anexo

Referência do Negócio a um Arquivo do Espaço de Trabalho (A8): propostas, contratos assinados, apresentações. 0..N. Remover o Anexo remove a referência, nunca o Arquivo. Um Arquivo anexado a uma Mensagem da Conversa vinculada **não** vira Anexo do Negócio automaticamente; o produto pode oferecer "anexar ao Negócio" como ato. Proposta e Contrato como entidades são D3.

### 7.6 O que não é componente

- **Registro de transição de Etapa.** Não é entidade interna: é um **Registro de Atividade** (transversal, do Espaço de Trabalho, imutável — INV-ET-12) cujo objeto é o Negócio e cujos dados são: Etapa de origem e de destino **por identidade, nome à época e Ordem à época**, Funil de origem e de destino, origem da entrada (`criação`, `avanço`, `retrocesso`, `salto`, `mudança de Funil`, `reabertura`, `remapeamento`), probabilidade sobrescrita descartada (se houver), tempo de permanência na Etapa de origem, ator e ator delegante (DO-FUN-13; RN-FUN-19). Avanço/retrocesso é **derivado da Ordem à época**, não gravado como tipo pelo ator (18).
- **Histórico / linha do tempo.** Visão derivada (8.2).
- **Tarefas, Conversas, Documentos "do Negócio".** Vínculos (8.1).
- **Empresa, Contatos.** Referência e Vínculos.
- **Motivos de Perda e de Ganho, Origens, Definições de Campo, Tags, Funis.** Catálogos do Espaço de Trabalho (B34).
- **Proposta, Contrato, Itens de Negócio, Produtos.** Entidades futuras (D2, D3).

## 8. Relações

### 8.1 Tabela de relações

| Relação | Destino | Tipo | Direção | Descrição |
| --- | --- | --- | --- | --- |
| pertence a | Espaço de Trabalho | pertencimento | ET → Negócio | Exatamente um, imutável (A1.1). Sem contêiner intermediário. |
| é de propriedade de | Membro | propriedade | Negócio → Membro | Exatamente um Proprietário (A7). Sucessão B28. |
| foi criado por | Ator | referência | Negócio → Ator | Criador imutável; ator delegante registrado. |
| percorre | Funil | referência (obrigatória, substituível) | Negócio → Funil | Exatamente um (B9). Não é pertencimento (DO-FUN-01). |
| está em / terminou em | Etapa | referência | Negócio → Etapa | Etapa atual (aberto) ou última Etapa (encerrado); do Funil referenciado (INV-FUN-06). |
| referencia | Empresa | referência | Negócio → Empresa | 0..1. Só `ativo` ao vincular (RN-EMP-08). Não é Vínculo: é atributo unilateral com regras próprias (RN-EMP-09, RN-EMP-10). |
| vinculado a Contatos | Contato | associação (Vínculo Contato-Negócio) | Negócio ↔ Contato | 0..N, com papel e principal (7.1). |
| vinculado a Tarefas | Tarefa | associação (Vínculo Tarefa-Negócio, DO-TAR-08) | Negócio ↔ Tarefa | 0..N, papel textual opcional. Base de "próxima atividade". |
| vinculado a Conversas | Conversa | associação (Vínculo Conversa-Negócio) | Negócio ↔ Conversa | 0..N. Sem propriedade, sem transferir Atribuído. Detalhado no documento 14 (DO-NEG-13). |
| vinculado a Documentos | Documento de Conhecimento | associação (Vínculo) | Negócio ↔ Documento | 0..N (tabela de preços, contrato-padrão usado). Não torna o Negócio Conhecimento (B19). |
| relacionado a | Negócio | associação (Vínculo simétrico, papel textual opcional) | Negócio ↔ Negócio | 0..N ("renovação de", "upsell de"). Sem cascata, sem herança. |
| contém Valores de Campo, Comentários | entidades internas | contenção (agregado) | Negócio → interna | Sem existência fora do Negócio. |
| anexa Arquivos | Arquivo | referência | Negócio → Arquivo | 0..N. |
| tem Tags | Tag | associação N:N | Negócio ↔ Tag | Tags do Espaço de Trabalho aplicáveis a Negócio (B5). |
| tem Origem | Origem | referência (uso de catálogo) | Negócio → Origem | 0..1. Eliminar a Origem limpa a referência (mesmo modelo de RN-CON-18). |
| tem Motivo de Perda / de Ganho | Motivo de Perda / Motivo de Ganho | referência (uso de catálogo) | Negócio → Motivo | 0..1 cada. Eliminar o Motivo: rejeitado enquanto referenciado por Negócio encerrado (RN-NEG-12). |
| usa Definições de Campo | Definição de Campo Personalizado | referência (uso de configuração) | Negócio → Definição | Do Espaço de Trabalho, entidade-alvo Negócio (A5.2). |
| consome Regras de encerramento, Requisitos, Transições | Funil / Etapa | uso de configuração | Funil → Negócio | O Negócio é validado por elas; não as possui (DO-FUN-06, DO-FUN-08). |
| criado a partir de | Conversa, Contato, Empresa, Tarefa, Negócio, Integração | proveniência (objeto de valor) | Negócio → origem | Sem vínculo vivo (A8). Criar a partir de Conversa/Contato/Empresa também gera o Vínculo ou a referência correspondente (12.1). |
| é objeto de | Execução de Agente / Automação | referência inversa | Execução → Negócio | O Negócio não contém Execuções. |
| é âncora de | Sessão de Chat | referência inversa | Sessão → Negócio | B21. |
| é registrado em | Registro de Atividade | referência inversa | Registro → Negócio | Histórico (A6). |
| é Fonte de Dados de | Widget | referência inversa | Widget → Negócio | Filtrada pelo visualizador (B20). |
| é mencionado em | Comentário, Descrição de Tarefa, Mensagem de Chat | referência inversa (menção) | registro → Negócio | Menção não cria Vínculo (DO-TAR-19). |

Distinção aplicada: **pertencer** (Espaço de Trabalho), **CONTER** (Valores de Campo, Comentários; Valor como objeto de valor), **USAR** (Funil, Etapa, Definições de Campo, Tags, Origem, Motivos), **REFERENCIAR** (Empresa, Arquivo, Ator, Proveniência), **RELACIONAR-SE** (Vínculos com Contato, Tarefa, Conversa, Documento, Negócio). O Negócio **não HERDA** de nenhum nível (seção 16) e **não CONFIGURA** nada: consome a configuração do Funil e do Espaço de Trabalho.

### 8.2 Histórico / linha do tempo (derivada)

Não é entidade nem atributo: é a **visão**, ordenada por momento, que agrega (a) os Registros de Atividade cujo objeto é o Negócio ou um componente do agregado — inclusive os Registros de transição (7.6), de situação, de valor e de Proprietário; (b) as Tarefas vinculadas e seus eventos; (c) as Conversas vinculadas e suas Mensagens; (d) os Comentários; (e) as Execuções de Agente e Automação que o tiveram como objeto. Cada item é exibido apenas a quem tem `ver` sobre ele (mesma regra de RN-CON-21): ver o Negócio não dá acesso às Conversas vinculadas.

## 9. Cardinalidades

| Relação | Cardinalidade | Zero? | Muitos? | Estrutural ou associativa | Justificativa |
| --- | --- | --- | --- | --- | --- |
| Negócio → Espaço de Trabalho | 1 | não | não | pertencimento | A1.1. |
| Espaço de Trabalho → Negócio | 0..N | sim | sim | pertencimento | CRM sem oportunidades registradas é válido. |
| Negócio → Proprietário | 1 | não | não | propriedade | A7, B9. Zero: ninguém responde; vários: ninguém responde. |
| Negócio → Criador | 1 | não | não | referência | A7. |
| Negócio → Funil | 1 | não | não | referência | B9. Zero deixaria o Negócio sem posição; vários tornariam "em que ponto está" ambíguo. |
| Funil → Negócio | 0..N | sim | sim | associativa (referência inversa) | Documento 13, seção 9. |
| Negócio → Etapa | 1 | não | não | referência | Atual ou última (B9; INV-FUN-06). Nunca vazia. |
| Negócio → Empresa | 0..1 | sim | não | referência | B9: venda a pessoa física; oportunidade ainda sem organização identificada. Uma só: a contraparte comercial é única; consórcios são Vínculos de Contatos de várias Empresas (20.2) ou Empresa "consórcio". |
| Empresa → Negócio | 0..N | sim | sim | referência inversa | Vinte Negócios em três Funis é o cliente recorrente (20.3). |
| Negócio → Vínculo Contato-Negócio | 0..N | sim | sim | associativa | B9. Zero: oportunidade recém-aberta, venda institucional. Muitos: comitê de compra (20.2). |
| Negócio → Vínculo por (Contato, Negócio) | 0..1 | sim | não | associativa | Um papel por Contato por Negócio (DO-NEG-03). |
| Negócio → Contato principal | 0..1 | sim | não | — | INV-NEG-06. |
| Contato → Negócio | 0..N | sim | sim | associativa | Documento 10, seção 9. |
| Negócio → Valor | 0..1 | sim | não | objeto de valor | Vazio é "não estimado". |
| Negócio → Probabilidade sobrescrita | 0..1 | sim | não | nativo | Padrão: vazia; a efetiva deriva da Etapa (6.3). |
| Negócio → Motivo de Perda | 0..1 | sim | não | referência | Obrigatório só por Regra de encerramento. |
| Negócio → Motivo de Ganho | 0..1 | sim | não | referência | Sempre opcional (DO-NEG-06). |
| Negócio → Origem | 0..1 | sim | não | referência | |
| Negócio → Tag | 0..N | sim | sim | associativa (N:N) | B5. |
| Negócio → Valor de Campo | 0..N | sim | sim | contenção | Um por Definição aplicável (INV-NEG-08). |
| Negócio → Comentário | 0..N | sim | sim | contenção | |
| Negócio → Anexo | 0..N | sim | sim | referência | |
| Negócio → Tarefa (Vínculo) | 0..N | sim | sim | associativa | DO-TAR-08. Cem Tarefas em um Negócio é válido. |
| Tarefa → Negócio (Vínculo) | 0..N | sim | sim | associativa | Uma Tarefa "visita conjunta" serve a dois Negócios. |
| Negócio → Conversa (Vínculo) | 0..N | sim | sim | associativa | Trinta Conversas de WhatsApp em um Negócio longo (20.15). |
| Conversa → Negócio (Vínculo) | 0..N | sim | sim | associativa | Uma Conversa pode tratar de dois Negócios; fixado em 0..N pelo documento 14 (7.12, 8.4, 20.4), que resolveu a delegação de DO-NEG-13. |
| Negócio → Documento de Conhecimento (Vínculo) | 0..N | sim | sim | associativa | |
| Negócio → Negócio (Vínculo `relacionado a`) | 0..N | sim | sim | associativa | Simétrico; sem laço. |
| Negócio → Proveniência | 0..1 | sim | não | objeto de valor | Composto (pode registrar Integração e registro de origem). |
| Execução → Negócio (objeto) | 0..N | sim | sim | referência inversa | |
| Sessão de Chat → Negócio (âncora) | 0..1 | sim | não | referência inversa | B21. |

Sem `DECISÃO NECESSÁRIA` pendente: todas decorrem da constituição (B9) ou de decisões RECOMENDADAS da seção 24.

## 10. Hierarquia, pertencimento e propriedade

**Hierarquia.** O Negócio não integra a Estrutura de Trabalho nem nenhuma hierarquia. É filho direto do Espaço de Trabalho, par de Contatos, Empresas, Funis e Caixa de Entrada (A2.2). Não há "Negócio pai" nem "Subnegócio": desdobramentos são Negócios distintos com Vínculo `relacionado a` ou Proveniência.

**Pertencimento (teste de existência).** O Negócio **não existe sem o Espaço de Trabalho** (pertencimento). Valores de Campo, Comentários, Valor, Anexos (como referências) e a face do Vínculo Contato-Negócio **não existem sem o Negócio** (contenção; agregado). O Negócio **existe sem** Empresa, Contatos, Tarefas, Conversas, Documentos (associação ou referência opcional). O Negócio **não existe sem Funil e Etapa**, mas isso é **referência obrigatória substituível**, não pertencimento: o Negócio sobrevive ao Funil por migração (RN-FUN-12, RN-FUN-13; DO-FUN-01). A Empresa **existe sem** o Negócio, mas a sua eliminação é adiada enquanto ele existir (RN-EMP-10): dependência inversa, não contenção.

**"Pertence a" versus "relaciona-se com".** O Negócio *pertence* ao Espaço de Trabalho. O Negócio *percorre* o Funil. O Negócio *referencia* a Empresa. O Negócio *relaciona-se com* Contatos, Tarefas, Conversas, Documentos e outros Negócios (Vínculo). O Proprietário é *relação de governança*, não pertencimento: o Negócio não pertence ao Proprietário (transferível; sucedido).

**Propriedade.** Exatamente um Proprietário, Membro `ativo` ou `suspenso` (A7; INV-ET-03). É quem responde pela oportunidade: previsão, valor, próxima atividade, encerramento. **Não é Responsável**: executar a proposta é Tarefa com Responsáveis (que podem ser Agentes, B7); o Proprietário do Negócio é sempre humano. Transferência: pelo Proprietário atual ou por quem tem `administrar` sobre o Negócio, para Membro `ativo` (RN-ET-08), com Registro de Atividade e evento. Atender uma Conversa vinculada ou ser Responsável por Tarefa vinculada **não** transfere propriedade (mesma regra de DO-CON-07). Na remoção do Proprietário, sucessão no mesmo ato (B28; 12.5).

**Configurar não é conter.** O Funil configura Requisitos e Regras de encerramento que o Negócio consome; isso não faz do Negócio filho do Funil. O Espaço de Trabalho define a moeda padrão; o Valor é do Negócio.

## 11. Estados

Todos os estados desta seção são **estados de sistema**. O Negócio não tem Status (A4.2, A4.4). Dois eixos independentes:

### 11.1 Situação (A4.4)

| Situação | Significado | Etapa | Probabilidade efetiva |
| --- | --- | --- | --- |
| `aberto` | Oportunidade em curso; percorre o Funil; conta como "em aberto". | Etapa atual; muda por transição. | Sobrescrita ou padrão da Etapa. |
| `ganho` | Oportunidade convertida; fato comercial positivo; conta como receita ganha. | Última Etapa, preservada (B9); não muda. | 100. |
| `perdido` | Oportunidade não convertida; fato comercial negativo; carrega Motivo de Perda quando exigido. | Última Etapa, preservada; não muda. | 0. |

`ganho` e `perdido` são **terminais reabríveis**: `perdido` → `aberto` por quem tem `editar`; `ganho` → `aberto` só por Administrador (B9). Reabrir é evento, não retorno silencioso.

### 11.2 Estado de ciclo de vida (A4.1)

| Estado | Significado | Efeito sobre a operação |
| --- | --- | --- |
| `ativo` | Registro em uso. | Tudo, conforme permissões e situação. |
| `arquivado` | Fora da operação, preservado como fato comercial. Somente leitura. | Sem transições de Etapa, sem mudança de situação, sem edição; Vínculos preservados; Automações de Gatilho sobre ele não disparam; Visualizações operacionais o ocultam por padrão; Painéis de resultado o incluem (ganhos arquivados são receita). Para operar, restaurar. |
| `na lixeira` | Excluído recuperável, pelo prazo da Política de lixeira. | **Ignorado pelo Funil**: não conta em nenhuma Métrica, Visualização ou Gatilho; Vínculos ocultos; Requisitos e Automações não o veem. Continua a referenciar Funil e Etapa (INV-FUN-06) e participa de remapeamentos obrigatórios (RN-NEG-17). |

Eliminação permanente não é estado: é o fim do registro (12.4).

### 11.3 Ortogonalidade

Os dois eixos combinam-se livremente: um Negócio `ganho` pode ser `arquivado` (caso normal ao fim do ano fiscal); um Negócio `aberto` pode ir à `lixeira` (criado por engano) e voltar; um Negócio `perdido` `na lixeira` continua a referenciar Empresa e Funil. O CRM não tem estado efetivo derivado de ancestrais (B36 não se aplica): o estado do Negócio é o gravado nele. "Parado", "previsão vencida", "sem próxima atividade", "sem Contato" e "duplicado suspeito" são **condições derivadas**, não estados (mesmo princípio de DO-CON-17).

## 12. Ciclo de vida

### 12.1 Criação

Por Membro com `criar` sobre Negócios (e `criar` sobre o Funil, se privado — documento 13, 17.1), por Agente (com `criar`; em nome de Membro, interseção A9.3), por Automação, por Integração (importação) ou "a partir de" outro registro. Ato atômico que produz o Negócio `ativo`, `aberto`, com Título, Proprietário (RN-NEG-02), Criador, Funil (explícito ou o Funil padrão — RN-FUN-06), Etapa (explícita, com Requisitos de `entrada` avaliados, ou a Etapa inicial — DO-FUN-04), moeda padrão da Localidade no Valor se informado, Empresa `ativo` se informada (RN-EMP-08), Vínculos de Contato informados (o primeiro nasce principal), e o primeiro Registro de Atividade mais o Registro de transição "entrou em Etapa" com origem `criação`. Não se cria Negócio em Funil `arquivado` ou `na lixeira` (RN-FUN-14). Definições de Campo de Negócio marcadas obrigatórias **não impedem a criação** (nem a manual nem a derivada): a obrigatoriedade é avaliada na próxima edição e nos Requisitos de Etapa `campo preenchido` (B49 aplicada por analogia; DO-FUN-06).

**Criação "a partir de"** (Proveniência gravada, sem vínculo vivo): de uma **Conversa** — Vínculo Conversa-Negócio e Vínculo com o Contato principal da Conversa (papel `outro` até edição, principal); de um **Contato** — Vínculo com ele (principal); de uma **Empresa** — referência a ela; de uma **Tarefa** — Vínculo Tarefa-Negócio; de outro **Negócio** (pós-venda ao ganhar, renovação) — cópia opcional de Empresa, Contatos, Valor e Tags, Vínculo `relacionado a` opcional, e Proveniência "criado a partir de" (documento 13, 20.6: é criação, não movimentação). De uma **Integração** — Proveniência com a Integração e o identificador externo.

**Proprietário inicial** (RN-NEG-02; mesmo modelo de DO-EMP-16): o Membro que cria; para Agente em nome de Membro, o delegante Membro; para Agente autônomo (sem delegante — Origem `Caixa de Entrada` — ou com a Automação como delegante, DO-AUT-15), Automação ou Integração, o Membro configurado na Automação/Ferramenta e, na ausência, o Proprietário do Agente ou da Automação ou o Membro configurador da Integração. Nunca vazio; nunca Membro não `ativo` (RN-ET-08). Se o Funil é privado e o Proprietário resultante não tem `ver` sobre ele, aplica-se RN-NEG-20.

### 12.2 Transições de situação

| De | Para | Quem | Pré-condições | Efeitos |
| --- | --- | --- | --- | --- |
| `aberto` | `ganho` | `editar` sobre o Negócio (e `ver` no Funil, se privado) | Estado `ativo`. Regra de encerramento "exigir valor" satisfeita se ativa (quantia > 0). Requisitos de `saída` **não** avaliados (o Negócio não sai da Etapa — RN-FUN-11). | Situação `ganho`; última Etapa = Etapa atual; probabilidade sobrescrita descartada (efetiva = 100); Motivo de Ganho e Nota opcionais; Momento de encerramento; Registro de Atividade; evento "Negócio ganho". Tarefas e Conversas vinculadas **não** mudam (Automação pode fazê-lo). |
| `aberto` | `perdido` | `editar` | Estado `ativo`. Regra "exigir Motivo de Perda" satisfeita se ativa (RN-FUN-11); com catálogo vazio e regra ativa, impossível até criar um Motivo (documento 13, 19). | Situação `perdido`; última Etapa preservada; efetiva = 0; Motivo de Perda e Nota gravados; Momento de encerramento; evento "Negócio perdido". |
| `perdido` | `aberto` | `editar` | Estado `ativo`. Funil `ativo`: retorna à última Etapa, com Requisitos de `entrada` avaliados (origem `reabertura`). Funil `arquivado`: exige mover no mesmo ato para Funil `ativo` com Etapa explícita (RN-FUN-14; documento 13, 20.3). Empresa referenciada não pode estar `na lixeira` (INV-EMP-07). | Situação `aberto`; Motivo de Perda e Nota **limpos como atributos correntes e preservados no Registro** (B9); Momento de encerramento limpo; Registro "reaberto" (e "movido de Funil", se for o caso); evento. |
| `ganho` | `aberto` | **Administrador ou Proprietário do Espaço de Trabalho** (B9), com `editar` | Idem à linha anterior. | Idem; Motivo de Ganho limpo e preservado no Registro; evento "Negócio reaberto" com indicação "de ganho". Ação de governança: não concedível por concessão direta (RN-NEG-10). |
| `ganho` | `perdido` / `perdido` → `ganho` | — | **Não existe** transição direta. | Reabrir e encerrar de novo: dois eventos, dois Registros; a história "ganho, depois perdido" fica legível. |

### 12.3 Transições de Etapa e de Funil (enquanto `aberto` e `ativo`)

- **Transição de Etapa** (avanço, retrocesso, salto): ator com `editar` sobre o Negócio (e `ver` no Funil, se privado), respeitando Transições permitidas e Requisitos de `saída` e `entrada` (RN-FUN-07). Efeitos: Etapa atual substituída; sobrescrita descartada (DO-NEG-05); Registro de transição com Ordem à época; eventos "saiu de Etapa" e "entrou em Etapa"; avanço/retrocesso derivado. Rejeição: nenhum efeito parcial; Registro com resultado "rejeitada".
- **Mudança de Funil**: Funil de destino `ativo`, `criar` sobre ele, Etapa de destino **explícita** (RN-FUN-15; DO-FUN-11); Requisitos de `saída` da origem e de `entrada` do destino avaliados; sobrescrita descartada; tudo o mais preservado (Valores de Campo não ficam órfãos — DO-FUN-07). Se o destino é privado e o Proprietário não tem `ver` sobre ele, aplica-se RN-NEG-20. Evento "movido de Funil" e Registro de transição com origem `mudança de Funil`. Para Negócio `ganho`/`perdido`: só em migração obrigatória (RN-FUN-12, RN-FUN-13) ou na reabertura.
- **Remapeamento obrigatório** (Etapa removida; Funil arquivado ou enviado à lixeira): imposto pelo Funil, alcança Negócios de qualquer situação **e de qualquer estado, inclusive `na lixeira`** (RN-NEG-17), sem Requisitos (RN-FUN-08), sem descartar sobrescrita (DO-NEG-05), com Registro de origem `remapeamento` e sem disparar "entrou em Etapa".

### 12.4 Transições de estado

| De | Para | Quem | Pré-condição | Efeitos |
| --- | --- | --- | --- | --- |
| `ativo` | `arquivado` | `editar` | Nenhuma; qualquer situação (20.1). Recomendação de produto: ao arquivar `aberto`, sugerir marcar `perdido`. | Somente leitura; Vínculos preservados; Automações não disparam sobre ele; Registro de Atividade. Nada em cascata. |
| `arquivado` | `ativo` | `editar` | Se `aberto`: Funil `ativo` (senão, mover no ato — RN-FUN-14) e Empresa não `na lixeira`. | Registro de Atividade. |
| `ativo` / `arquivado` | `na lixeira` | `excluir` | Nenhuma: Negócio `aberto` pode ir à lixeira (DO-NEG-09). | Ignorado pelo Funil (11.2); Vínculos ocultos (Tarefa mostra "vinculado a registro na lixeira" — documento 06, 20.7); Sessões ancoradas perdem o objeto; Registro de Atividade; evento. A Empresa referenciada passa a poder ir à lixeira (RN-EMP-09 só conta Negócios `aberto` fora da lixeira). |
| `na lixeira` | estado anterior | `excluir` | **Rejeitada** se o Negócio é `aberto` e a Empresa referenciada está `na lixeira` ou `mesclado` sem resolução (INV-EMP-07): o ator restaura a Empresa ou limpa/troca a referência no mesmo ato (20.12). Funil e Etapa sempre existem (RN-NEG-17). | Vínculos visíveis; Registro de Atividade; evento. |
| `na lixeira` | eliminação permanente | Sistema (fim da Política de lixeira) ou `excluir` (ato explícito) | — | Agregado eliminado; Vínculos removidos (Tarefas, Conversas, Contatos, Documentos, Negócios intactos, com Registro em cada lado); Tags desaplicadas; Anexos removidos (Arquivos permanecem); âncoras limpas; Registros de Atividade permanecem (INV-ET-12) com Título à época; a Empresa referenciada deixa de ter este Negócio como bloqueio de eliminação (RN-EMP-10). Evento "Negócio eliminado". |

### 12.5 Sucessão de Proprietário

Quando o Proprietário é removido do Espaço de Trabalho, todos os seus Negócios — de qualquer situação e estado — passam ao Sucessor no mesmo ato (B28; RN-ET-09a), cada um com Registro de Atividade e evento "Proprietário alterado" com causa `sucessão`. Se algum Negócio percorre Funil privado sobre o qual o Sucessor não tem `ver`, o Sucessor recebe `ver` sobre esse Funil por concessão direta no mesmo ato, registrada (RN-NEG-20; 20.13). Um Proprietário `suspenso` mantém os Negócios; novos não lhe são atribuídos (RN-ET-08). O Negócio nunca fica sem Proprietário nem por um instante (INV-ET-03).

### 12.6 O que acontece com dependentes e relacionados

| Relacionado | Arquivar | Lixeira | Eliminar | Ganho / Perdido |
| --- | --- | --- | --- | --- |
| Valores de Campo, Comentários, Valor, Anexos | intactos, só leitura | intactos, ocultos | eliminados | intactos, editáveis por `editar` (correções) |
| Vínculos (Contato, Tarefa, Conversa, Documento, Negócio) | intactos | ocultos | removidos; outro lado intacto | intactos; novos permitidos (Tarefa pós-venda) |
| Empresa | intacta | pode ir à lixeira se não restar bloqueio | deixa de bloquear eliminação | intacta; trocar exige `administrar` (RN-NEG-06) |
| Tarefas vinculadas | intactas | intactas | intactas, Vínculo removido | intactas; Automação pode concluí-las |
| Conversas vinculadas | intactas | intactas | intactas, Vínculo removido | intactas |
| Automações com Gatilho sobre o Negócio | não disparam | não disparam | — | disparam "ganho"/"perdido" |
| Registros de Atividade | intactos | intactos | permanecem (INV-ET-12) | acrescidos |

## 13. Regras de negócio ontológicas

- **RN-NEG-01.** Todo Negócio pertence a exatamente um Espaço de Trabalho, definido na criação e imutável; nenhuma relação do Negócio cruza a fronteira (INV-ET-07).
- **RN-NEG-02.** Todo Negócio tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho, definido na criação conforme 12.1. Transferência: pelo Proprietário atual ou por quem tem `administrar` sobre o Negócio, para Membro `ativo`, com Registro de Atividade. Na remoção do Proprietário, sucessão no mesmo ato (B28). O Negócio não tem Responsável nem Atribuído.
- **RN-NEG-03.** Todo Negócio referencia exatamente um Funil e exatamente uma Etapa desse Funil, por identidade (B9; INV-FUN-06), em todo estado e situação. Sem Funil explícito na criação, o Funil padrão; sem Etapa explícita, a Etapa inicial (RN-FUN-06).
- **RN-NEG-04.** Enquanto `aberto` e `ativo`, a Etapa muda por ato de Ator com `editar` (e `ver` no Funil, se privado), sob Transições permitidas e Requisitos (RN-FUN-07). Em `ganho`/`perdido` a Etapa é a última e não muda, salvo remapeamento obrigatório ou reabertura. Em `arquivado` ou `na lixeira` nenhuma transição por progressão ocorre.
- **RN-NEG-05.** A probabilidade sobrescrita é descartada, com Registro que preserva o valor, em toda mudança de Etapa por progressão (avanço, retrocesso, salto, mudança de Funil, reabertura para outra Etapa) e ao encerrar; é preservada em remapeamentos obrigatórios. A probabilidade efetiva é derivada e nunca gravada (DO-NEG-05).
- **RN-NEG-06.** A Empresa referenciada, ao ser definida ou trocada, precisa estar `ativo` (RN-EMP-08). A referência sobrevive ao arquivamento da Empresa e é reapontada na mesclagem (DO-EMP-13). Trocar ou remover a Empresa de Negócio `aberto` exige `editar`; de Negócio `ganho`/`perdido`, `administrar` (correção de fato comercial), sempre com Registro (antes, depois).
- **RN-NEG-07.** Vínculo Contato-Negócio: no máximo um por par (Contato, Negócio); papel obrigatório do catálogo fixo (`decisor`, `influenciador`, `comprador`, `técnico`, `usuário`, `outro` com rótulo); no máximo um principal por Negócio; o primeiro nasce principal; Contatos de qualquer Empresa ou de nenhuma; Contato `mesclado` nunca é alvo (resolve ao sobrevivente). Criar ou remover exige `editar` no Negócio e `ver` no Contato; Registro nas duas pontas.
- **RN-NEG-08.** O Valor é objeto de valor (quantia não negativa, moeda); a moeda nasce da Localidade e pode ser outra por Negócio; alterar a Localidade não reescreve Valores (RN-ET-16). Conversão entre moedas não é atributo do Negócio.
- **RN-NEG-09.** Marcar `ganho` exige estado `ativo`, situação `aberto` e a Regra de encerramento "exigir valor" (quantia > 0) quando ativa; marcar `perdido` exige estado `ativo`, situação `aberto` e Motivo de Perda quando a Regra "exigir Motivo de Perda" está ativa (RN-FUN-11; DO-FUN-08). A avaliação é síncrona, bloqueante e vale para todo Ator, sem exceção por Papel. Encerrar não avalia Requisitos de `saída` e não altera a Etapa.
- **RN-NEG-10.** Reabrir `perdido` exige `editar`; reabrir `ganho` exige Papel de nível Administrador ou Proprietário do Espaço de Trabalho, além de `editar`, e não é concedível por concessão direta (B9; RN-ET-24 por analogia). Reabrir retorna à última Etapa com Requisitos de `entrada` avaliados; se o Funil estiver `arquivado`, exige mover para Funil `ativo` com Etapa explícita no mesmo ato (RN-FUN-14).
- **RN-NEG-11.** Ao reabrir, Motivo de Perda ou de Ganho, Nota de encerramento e Momento de encerramento são limpos como atributos correntes e permanecem nos Registros de Atividade (B9). Nenhuma transição direta `ganho` ↔ `perdido` existe.
- **RN-NEG-12.** Eliminar um Motivo de Perda ou de Ganho do catálogo é rejeitado enquanto algum Negócio encerrado (qualquer estado) o referencie; o ator substitui em lote ou arquiva o Motivo (catálogos admitem arquivamento no padrão de B34). Eliminar uma Origem limpa a referência (mesmo modelo de RN-CON-18).
- **RN-NEG-13.** Mover Negócio de Funil exige Funil de destino `ativo`, `criar` sobre ele e Etapa de destino explícita, com Requisitos avaliados (RN-FUN-15; DO-FUN-11); preserva identidade, Valor, Empresa, Vínculos, Valores de Campo, Comentários, Tags e histórico; gera evento com Funil e Etapa de origem e destino.
- **RN-NEG-14.** Toda transição de Etapa, mudança de Funil, remapeamento, reabertura e criação gera um Registro de Atividade de transição com Etapa de origem e destino por identidade, nome à época e Ordem à época, origem da entrada e tempo de permanência (DO-FUN-13; RN-FUN-19). Avanço e retrocesso são derivados da Ordem à época, nunca declarados pelo ator.
- **RN-NEG-15.** Toda ação sobre o Negócio ou seu agregado gera Registro de Atividade com ator e ator delegante quando houver (A6.2). Alterações de Valor, Proprietário, Empresa, situação e Etapa registram antes e depois.
- **RN-NEG-16.** Um Negócio `arquivado` é somente leitura: nenhuma transição de Etapa, situação, Valor, Empresa, Vínculo ou Valor de Campo; a única operação é restaurar (ou enviar à lixeira).
- **RN-NEG-17.** Um Negócio `na lixeira` é ignorado por Métricas, Visualizações, Gatilhos e Requisitos, mas **continua a referenciar Funil e Etapa** e participa de todo remapeamento e migração obrigatórios (RN-FUN-10, RN-FUN-12, RN-FUN-13). Consequência: a restauração nunca encontra Etapa inexistente.
- **RN-NEG-18.** Restaurar da lixeira um Negócio `aberto` cuja Empresa está `na lixeira` ou `mesclado` sem sobrevivente `ativo`/`arquivado` é rejeitado até o ator restaurar a Empresa ou trocar/limpar a referência no mesmo ato (INV-EMP-07). Restaurar Negócio `aberto` cujo Funil está `arquivado` exige mover no ato (RN-FUN-14).
- **RN-NEG-19.** Permissões sobre Negócios são do CRM (Papel, concessão direta, compartilhamento; escopos `registro` e `próprios`); o Funil não é origem de permissão. Quando o Funil é privado, `ver` sobre o Funil é pré-requisito (interseção) para ver, editar, mover ou encerrar o Negócio (DO-FUN-10).
- **RN-NEG-20.** **Todo Proprietário de Negócio tem `ver` sobre o Negócio em todo instante.** Toda operação que violaria isso — mover para Funil privado, privatizar Funil, revogar `ver` sobre Funil privado, sucessão, definir Proprietário na criação em Funil privado — é rejeitada, salvo se, no mesmo ato, o ator (a) conceder `ver` sobre o Funil ao Proprietário (concessão direta registrada) ou (b) transferir a propriedade a Membro `ativo` com `ver`. Na sucessão (B28), a alternativa (a) é aplicada automaticamente ao Sucessor (DO-NEG-10). Resolve a questão 5 do documento 13.
- **RN-NEG-21.** Agentes e Automações criam, editam, movem, encerram e reabrem Negócios apenas com as permissões correspondentes (A6.3; A9.3), sob os mesmos Requisitos, Transições e Regras de encerramento; Agentes nunca reabrem Negócio `ganho` (exige Papel que Agentes não têm — INV-ET-13). Marcar `ganho` ou `perdido`, enviar à lixeira e trocar Empresa de Negócio encerrado são Ferramentas de classe `escrita irreversível` que, em nível `supervisionado`, geram Solicitação de Aprovação (B22; B64; B77; DO-NEG-11).
- **RN-NEG-22.** Não existe mesclagem de Negócios nesta versão. Um Negócio duplicado é encerrado como `perdido` com o Motivo de Perda "Duplicado" (pré-definido pela plataforma, editável) e, opcionalmente, Vínculo `relacionado a` com o Negócio mantido (DO-NEG-12).
- **RN-NEG-23.** "Próxima atividade", "última atividade", "dias em Etapa", "idade", "previsão vencida", "parado há X dias" e "valor ponderado" são derivados, calculados a cada consulta, filtrados pelas permissões do consultante (B20) e nunca gravados no Negócio (DO-NEG-14).
- **RN-NEG-24.** Criar Negócio "a partir de" Conversa, Contato, Empresa, Tarefa ou Negócio grava Proveniência e cria, no mesmo ato, o Vínculo ou a referência correspondente; não move, não transfere propriedade nem altera o registro de origem.

## 14. Invariantes

- **INV-NEG-01.** Todo Negócio tem exatamente um Espaço de Trabalho, imutável.
- **INV-NEG-02.** Todo Negócio tem exatamente um Proprietário, Membro `ativo` ou `suspenso` do mesmo Espaço de Trabalho (INV-ET-03), e nenhum Responsável ou Atribuído.
- **INV-NEG-03.** Todo Negócio, em qualquer situação e estado, referencia exatamente um Funil e exatamente uma Etapa pertencente a esse Funil (INV-FUN-06). Nenhum Negócio `aberto` referencia Funil `arquivado`; nenhum Negócio referencia Funil `na lixeira` (INV-FUN-07).
- **INV-NEG-04.** A situação é exatamente uma entre `aberto`, `ganho`, `perdido`; a única transição de entrada em `ganho` ou `perdido` parte de `aberto`.
- **INV-NEG-05.** Um Negócio `perdido` em Funil com "exigir Motivo de Perda" ativo à época do encerramento tem Motivo de Perda; um Negócio `ganho` em Funil com "exigir valor" ativo à época tem quantia maior que zero. (Alterar a Regra depois não reescreve Negócios encerrados — princípio de RN-ET-17.)
- **INV-NEG-06.** Cada Negócio tem no máximo um Vínculo Contato-Negócio marcado principal e no máximo um Vínculo por Contato.
- **INV-NEG-07.** Nenhum Negócio `aberto` com estado `ativo` ou `arquivado` referencia Empresa `na lixeira` ou `mesclado` (INV-EMP-07); nenhuma referência nova a Empresa aponta para Empresa não `ativo`.
- **INV-NEG-08.** Todo Valor de Campo do Negócio corresponde a exatamente uma Definição de Campo do Espaço de Trabalho com entidade-alvo Negócio; um por Definição.
- **INV-NEG-09.** A probabilidade efetiva de um Negócio `ganho` é 100 e a de um `perdido` é 0; a de um `aberto` está entre 0 e 100 e é derivada.
- **INV-NEG-10.** Todo Proprietário de Negócio tem `ver` sobre o Negócio (RN-NEG-20).
- **INV-NEG-11.** O Momento de encerramento existe se e somente se a situação é `ganho` ou `perdido`.
- **INV-NEG-12.** Nenhum Negócio é Ator, Sujeito de permissão, Contato principal de Conversa, Responsável ou Conhecimento (B19).

## 15. Personalização

**Personalizável** (por `editar`, salvo indicação):

- Título, Objeto, Descrição, Valor (quantia, moeda), Probabilidade sobrescrita, Data prevista de fechamento, Origem, Empresa, Contatos vinculados (papel, principal), Tags, Valores de Campo, Anexos, Vínculos com Tarefas, Conversas, Documentos e Negócios, Motivo de Ganho, Nota de encerramento.
- Funil e Etapa (mudança de Etapa, mudança de Funil), situação (encerrar, reabrir — com as restrições de RN-NEG-10).
- Proprietário (por `administrar` ou pelo Proprietário atual).
- **No Espaço de Trabalho** (Administrador): Definições de Campo de Negócio; catálogos de Motivos de Perda, Motivos de Ganho, Origens; Tags; Identificador legível de Negócios (habilitado, prefixo); moeda padrão (Localidade). **No Funil** (`administrar` sobre o Funil): Etapas, probabilidades padrão, Requisitos, Transições, Regras de encerramento — configuração que o Negócio consome, nunca define.
- **Definições pré-definidas**: nenhuma Definição de Campo de Negócio é instanciada pela plataforma nesta versão (diferente de DO-EMP-10): "produto" e "quantidade" variam demais por segmento para uma pré-definição útil; o Objeto textual (B10) é o mínimo comum. O Motivo de Perda "Duplicado" é pré-definido (DO-NEG-12).

**Não personalizável:** Identificador, Identificador legível (uma vez atribuído), Espaço de Trabalho, Criador, Momento de criação; o conjunto de situações e suas transições; o conjunto de estados; o catálogo de papéis no Negócio; a regra "um Funil, uma Etapa"; a derivação da probabilidade efetiva; a ausência de Responsáveis; a ausência de mesclagem; a ausência de Status.

**Templates.** O catálogo de Templates (A8; documento 01, 7.6) não prevê Template de Negócio, e este documento não o cria: a reutilização é atendida por "criar a partir de" (Proveniência) e por Automações que preenchem Valores padrão. Registrado em 25.

## 16. Herança

O Negócio **não herda e não transmite herança**. O CRM não tem hierarquia de contêineres (A5.2): Definições de Campo, Tags, Motivos, Origens e Funis valem para todo Negócio por serem do Espaço de Trabalho, não por herança. Permissões vêm do Papel, de concessões e de compartilhamentos, filtradas pela privacidade do Funil (seção 17) — filtro, não herança. A Empresa não transmite nada ao Negócio (Proprietário, Tags, Valores, permissões — RN-EMP-12 por simetria); os Contatos tampouco.

Três mecanismos com aparência de herança, todos **derivação ou padrão de criação**:

| Mecanismo | O que é | Por que não é herança |
| --- | --- | --- |
| Probabilidade efetiva | Derivada da Etapa atual quando não sobrescrita (RN-FUN-18). | Resolvida a cada consulta; nada é copiado; mudar a Etapa muda o resultado. |
| Moeda padrão | Valor inicial da moeda do Valor, vindo da Localidade (RN-ET-15). | Copiada na criação; alterar a Localidade não altera o Negócio (RN-ET-16). |
| "Criado a partir de" | Cópia opcional de Empresa, Contatos, Valor, Tags ao criar de outro registro. | Proveniência sem vínculo vivo; divergem livremente depois. |

## 17. Permissões e visibilidade

### 17.1 O Negócio como Recurso

Tupla (Sujeito, Ação, Recurso, Escopo, Origem) (A9.1), com Recurso = um Negócio ou "Negócios" (o tipo, para Papéis). Ações: `ver`, `comentar`, `criar`, `editar`, `excluir`, `administrar`. `executar` não se aplica.

| Ação | Alcance no Negócio |
| --- | --- |
| `ver` | Atributos, Valor, probabilidade, Valores de Campo, Tags, Comentários, Anexos, histórico próprio; Vínculos cujo outro lado o Sujeito também vê; Empresa (nome, se não vê a Empresa — navegação). **Não** inclui o conteúdo de Conversas e Tarefas vinculadas (8.2). |
| `comentar` | Criar Comentários e responder. |
| `criar` | Criar Negócios (aplica-se ao tipo). Em Funil privado, exige também `criar` sobre o Funil. |
| `editar` | Atributos, Valor, probabilidade, Empresa (enquanto `aberto`), Vínculos (com permissão no outro lado), Tags, Valores de Campo, Anexos; mudar de Etapa e de Funil (com `criar` no destino); marcar `ganho`/`perdido`; reabrir `perdido`; arquivar e restaurar. |
| `excluir` | Enviar à lixeira e restaurar da lixeira; eliminar por ato explícito. |
| `administrar` | Transferir Proprietário; trocar Empresa de Negócio encerrado; compartilhar e conceder permissões sobre o Negócio; editar ou excluir Comentários de terceiros. O Proprietário tem `administrar` sobre os próprios Negócios por origem "papel", salvo Papel personalizado que o negue. |
| Reabrir `ganho` | Ação de governança: Papel de nível Administrador ou Proprietário do Espaço de Trabalho, com `editar` (RN-NEG-10). Não concedível. |

Origens: **Papel** (escopo `registro` para todos os Negócios, ou `próprios` — Proprietário ou Criador, B29), **concessão direta** (a Membro, Equipe ou Agente), **compartilhamento** (por quem tem `administrar`). Não há origem "herança" e o Negócio não é privatizável por si: a única restrição é a privacidade do **Funil** (17.3).

### 17.2 Papel de sistema × ações (padrão recomendado; documento 01, 17.2)

| Ação | Proprietário do ET | Administrador | Membro | Convidado |
| --- | --- | --- | --- | --- |
| ver, comentar | todos | todos | todos (ou `próprios`, por Papel personalizado) | só compartilhados |
| criar | sim | sim | sim | não |
| editar, mover, encerrar, reabrir `perdido` | todos | todos | todos (ou `próprios`) | não, salvo compartilhamento com `editar` |
| excluir (lixeira) | todos | todos | `próprios` (recomendação) | não |
| administrar (transferir Proprietário, compartilhar) | todos | todos | `próprios` | não |
| reabrir `ganho` | sim | sim | não | não |
| configurar catálogos (Motivos, Origens, Definições de Campo), Identificador legível | sim | sim | não | não |

"Vendedor vê só os seus Negócios" é Papel personalizado com escopo `próprios`; "os da minha Equipe" não é expressável com B29 (questão 1 do documento 10, que este documento reforça). Nenhuma ação de configuração de catálogo nem reabrir `ganho` é concedível por concessão direta (RN-ET-24).

### 17.3 Funil privado

Aplica-se DO-FUN-10 (documento 13, 17.3): ver, editar, mover ou encerrar um Negócio em Funil privado exige **também** `ver` sobre o Funil por concessão direta ou compartilhamento; a permissão efetiva é a interseção. Este documento acrescenta RN-NEG-20: o Proprietário nunca perde `ver` sobre o próprio Negócio por efeito da privacidade — a operação que o faria exige conceder ou transferir no mesmo ato. Painéis e Visualizações filtram pelo visualizador (B20): um Widget "Negócios em aberto" exclui os de Funis privados que o visualizador não vê.

### 17.4 IA sujeita às mesmas regras

Agentes e Automações agem sobre Negócios apenas com as suas permissões (A6.3; em nome de Membro, interseção A9.3; autônomos, só as próprias), sob os mesmos Requisitos, Transições permitidas e Regras de encerramento de um Membro (RN-FUN-07; documento 13, 20.8). Um Agente sem `ver` sobre o Negócio não o recebe no Contexto nem por Ferramenta, ainda que a Sessão esteja ancorada nele. **Marcar `ganho` ou `perdido`** exige aprovação em nível `supervisionado` (B22; lista consolidada em B64): a Ferramenta correspondente tem classe de efeito `escrita irreversível` (B72; B77) — não é externa em si, mas dispara Automações com efeito externo (cupom, pedido, faturamento) e a reversão de `ganho` exige Administrador, assimetria que a torna irreversível para o próprio Agente (DO-NEG-11). Enviar à lixeira e trocar Empresa de Negócio encerrado são igualmente `escrita irreversível` (B64). Toda Solicitação de Aprovação tem Tempo limite padrão de 72 horas (B80). Um Agente nunca reabre `ganho` (INV-ET-13) e nunca administra Funis (RN-FUN-17). Permissões avaliadas a cada Ferramenta (B23). Integração que importa Negócios age como Ator Integração com o Membro configurador como delegante.

### 17.5 Exceções

Não há exceções ao isolamento (INV-ET-07). Remapeamentos obrigatórios impostos pelo Funil (RN-FUN-10, RN-FUN-12, RN-FUN-13) alteram a Etapa/Funil de Negócios que o ator do remapeamento pode não ver individualmente (escopo `próprios`): são atos de configuração do Funil, registrados no Negócio com o ator do Funil, e não exigem `editar` em cada Negócio — única situação em que um Negócio muda sem `editar` sobre ele.

## 18. Eventos relevantes

| Evento | Quando | Dados essenciais | Consumidores prováveis |
| --- | --- | --- | --- |
| Negócio criado | 12.1 | Negócio, Funil, Etapa, Proprietário, Empresa, Contatos, Valor, Origem, Proveniência, ator, delegante | Automações (escopo Funil e ET); Painéis; Agentes (qualificação) |
| Negócio entrou em Etapa / saiu de Etapa | 12.3 | Etapa de origem e destino (identidade, nome, Ordem à época), origem da entrada, **avanço/retrocesso/salto derivado**, tempo de permanência, sobrescrita descartada, ator | Automações ("ao entrar em Proposta"); Painéis (conversão, tempo em Etapa); Agentes |
| Negócio movido de Funil | RN-NEG-13 | Funil e Etapa de origem e destino, ator | Automações dos dois Funis; Painéis |
| Negócio remapeado | RN-FUN-10/12/13 | Etapa/Funil de origem e destino, causa, ator do Funil | Auditoria; Painéis (não dispara "entrou em Etapa") |
| Valor alterado | 6.2 | antes, depois (quantia, moeda), ator | Painéis (valor em aberto, ponderado); Automações ("valor acima de X") |
| Probabilidade sobrescrita / descartada | 6.3 | antes, depois, causa (ato, progressão), ator | Painéis |
| Negócio ganho | 12.2 | Negócio, Funil, última Etapa, Valor, Motivo de Ganho, Nota, Empresa, Contatos, Proprietário, momento | Automações (pós-venda, Integrações de pedido); Painéis (receita, conversão); Agentes |
| Negócio perdido | 12.2 | idem + Motivo de Perda | Automações (reengajamento); Painéis (perdas por Etapa e Motivo) |
| Negócio reaberto | 12.2 | situação anterior, Etapa de retorno (ou Funil/Etapa de destino), Motivo preservado, ator | Automações; Painéis (recalcular período) |
| Encerramento / transição / reabertura rejeitados | RN-NEG-09, RN-FUN-07 | regra violada (Requisito, Transição, Regra de encerramento, Papel), ator | Registro "rejeitada"; Execução `falhou`; notificação |
| Proprietário alterado | RN-NEG-02, 12.5 | anterior, novo, causa (transferência, sucessão), ator | Notificação; Painéis (por Proprietário); Automações |
| Contato vinculado / desvinculado / papel alterado / principal alterado | 7.1 | Contato, papel, principal, ator | Automações; Painéis (Negócios por Contato); Caixa de Entrada |
| Contato vinculado substituído por mesclagem | DO-CON-11 | absorvido, sobrevivente | Auditoria |
| Empresa definida / alterada / removida | RN-NEG-06 | antes, depois, ator | Painéis (receita por Empresa); Empresa (linha do tempo) |
| Tarefa / Conversa / Documento / Negócio vinculado ou desvinculado | 8.1 | tipo, outro registro, ator | Outro domínio; Painéis; "próxima atividade" |
| Comentário criado; Anexo adicionado; Tag aplicada; Valor de Campo alterado | agregado | conforme o componente | Notificações; Automações; Painéis |
| Negócio arquivado / restaurado / enviado à lixeira / restaurado da lixeira / eliminado | 12.4 | Negócio, ator; na eliminação, Título à época | Painéis; Automações; Tarefas e Conversas (ocultar/restaurar Vínculo); Empresa (bloqueio de eliminação) |
| Restauração rejeitada | RN-NEG-18 | causa (Empresa na lixeira, Funil arquivado) | Produto (orientar) |
| Parado em Etapa há X dias | **derivado** (RN-NEG-23) | — | Gatilho de agendamento avaliando "dias em Etapa" ≥ X (documento 19); depende de C12 para dias úteis |
| Previsão vencida | **derivado** | — | Gatilho de agendamento avaliando "Previsão vencida"; Painéis |
| Sem próxima atividade | **derivado** | — | Gatilho de agendamento; Agentes ("sugerir próximo passo") |

Todos os eventos não derivados geram Registro de Atividade (RN-NEG-15). Os de Etapa pertencem ao histórico do Negócio e são consumidos pelo Funil como escopo (B41).

## 19. Dependências

**O Negócio depende de:** Espaço de Trabalho (existência, Localidade para moeda e fuso, catálogos, Identificador legível); Funil e Etapa (posição obrigatória; Requisitos, Transições, Regras de encerramento); Membro (Proprietário); Empresa (quando referenciada: `ativo` ao vincular); Contato (Vínculos); Definições de Campo de Negócio; Motivos de Perda e de Ganho, Origens, Tags.

**Dependem do Negócio:** Valores de Campo, Comentários, Valor, Anexos (referências) — eliminados com ele; Vínculos (removidos na eliminação; outro lado intacto); a eliminação da Empresa (adiada — RN-EMP-10); Execuções e Sessões ancoradas (perdem o objeto); Widgets (Fonte de Dados "Negócios de um Funil"); Registros de Atividade (permanecem).

**Documentos que este documento pressupõe ou condiciona:** Espaço de Trabalho (01) fornece pertencimento, Proprietário, sucessão (B28), catálogos (B34) e, por DO-NEG-02 e DO-NEG-06, passa a ter o objeto de valor "Identificador legível de Negócios" e o catálogo "Motivos de Ganho"; Funis (13) é obedecido em tudo o que envolve Funil e Etapa, e recebe DO-NEG-05 (leitura de "recalculada se herdada"), RN-NEG-17 (Negócios na lixeira participam de remapeamentos) e RN-NEG-20 (resposta à sua questão 5); Contato (10) recebe os atributos do Vínculo Contato-Negócio (DO-NEG-03); Empresa (11) tem RN-EMP-08/09/10 aplicadas aqui; Tarefa (06) já prevê o Vínculo Tarefa-Negócio e fornece "próxima atividade"; Caixa de Entrada (14) detalha o Vínculo Conversa-Negócio (DO-NEG-13) e a criação "a partir de Conversa"; Automações (19) recebe os Gatilhos da seção 18 e a candidatura a aprovação (DO-NEG-11); Agentes (17) recebe 17.4; Painéis (21) recebe os derivados (RN-NEG-23) e decidiu, para Painéis, a conversão de moeda (DO-PAI-13: uma série por moeda, nunca conversão).

## 20. Casos limítrofes e ambiguidades

### 20.1 Negócio sem Empresa e sem Contato

**Válido ao criar** (B9: Empresa 0..1, Contatos 0..N). Caso real: oportunidade registrada por indicação antes de saber quem é a contraparte; venda institucional sem interlocutor definido; importação parcial. O que a organização pode fazer é exigir por Etapa: Requisito de `entrada` `contato obrigatório` ou `empresa obrigatória` em "Qualificado" (DO-FUN-06) — a exigência é do processo, não da entidade. Painéis listam "Sem Contato" e "Sem Empresa" como condições derivadas. Não se cria Contato ou Empresa fictícios para preencher.

### 20.2 Negócio com cinco Contatos de duas Empresas diferentes

Válido. O Vínculo Contato-Negócio é livre (RN-NEG-07): o comitê de compra da Alfa inclui um consultor da Beta. A **Empresa do Negócio é uma só** (a Alfa, contraparte comercial); a Beta aparece apenas por meio do Contato. Se a venda é de fato conjunta a duas organizações, a organização escolhe: uma Empresa "consórcio" (registro próprio), ou dois Negócios relacionados. A ontologia não deriva a Empresa do Negócio a partir dos Contatos nem exige que os Contatos pertençam à Empresa: são fatos independentes (documento 10, 20.9).

### 20.3 Empresa com vinte Negócios

Caso normal de cliente recorrente (documento 11, 20.3). "Negócios da Empresa" é referência inversa; agrupar por Funil, situação ou período é Visualização ou Painel. Arquivar a Empresa não afeta os vinte (RN-EMP-08 só impede o vigésimo primeiro); enviá-la à lixeira é rejeitado enquanto houver `aberto` fora da lixeira (RN-EMP-09); eliminá-la é adiado enquanto qualquer um existir (RN-EMP-10).

### 20.4 Negócio perdido reaberto após um ano em Funil arquivado

Permitido a quem tem `editar`, **desde que** o Negócio seja movido no mesmo ato para um Funil `ativo` com Etapa de destino explícita e Requisitos de `entrada` avaliados (RN-NEG-10; RN-FUN-14; documento 13, 20.3). Dois Registros: "reaberto" e "movido de Funil". O Motivo de Perda de um ano atrás permanece no histórico; o atributo corrente fica vazio. A sobrescrita, se havia, foi descartada ao encerrar. O Momento de encerramento é limpo; Painéis por período deixam de contá-lo como perdido naquele mês — comportamento intencional: a verdade corrente é "aberto". Se o Painel precisar de "foi perdido em 2025 e reaberto em 2026", lê os Registros.

### 20.5 Negócio ganho reaberto por Membro comum

**Rejeitado** (B9; RN-NEG-10): reabrir `ganho` exige Papel de nível Administrador ou Proprietário do Espaço de Trabalho e não é concedível por concessão direta. Registro de Atividade com resultado "rejeitada". Justificativa: `ganho` alimenta receita, comissão e Integrações; desfazê-lo é correção de fato comercial, não operação de vendedor. O caminho: solicitar a um Administrador (ou Solicitação de Aprovação, se o produto a oferecer para humanos). Um Agente tampouco consegue (INV-ET-13).

### 20.6 Contato principal do Negócio mesclado em outro Contato

O Vínculo migra ao sobrevivente com o mesmo papel e o indicador principal (DO-CON-11; documento 10, 20.7); o Negócio não é alterado em situação, Etapa ou Valor; Registro "Contato vinculado substituído por mesclagem". Se o sobrevivente já tinha Vínculo ao mesmo Negócio, os dois colapsam em um (INV-NEG-06 exige um por par): prevalece o papel do Vínculo mais antigo e o indicador principal se qualquer um o tinha. Registros históricos citam o absorvido, que resolve ao sobrevivente (B14).

### 20.7 Empresa do Negócio eliminada

Não acontece enquanto o Negócio existir: a eliminação permanente da Empresa é **adiada** (RN-EMP-10) em qualquer situação e estado do Negócio, inclusive `na lixeira`. Só depois da eliminação permanente do último Negócio que a referencia a Empresa é eliminada. Se o Negócio é eliminado primeiro, a Empresa (na lixeira) segue o seu prazo. A alternativa "limpar a referência e eliminar" é rejeitada pelo documento 11: a referência de um `ganho` à Empresa é fato comercial.

### 20.8 Negócio movido de Funil sem Etapa de destino ou para Etapa inexistente

**Rejeitado** (RN-NEG-13; DO-FUN-11): a Etapa de destino é obrigatória e precisa pertencer ao Funil de destino `ativo`. Não há mapeamento automático por nome ("Proposta" → "Proposta") nem por posição (2ª → 2ª). Uma Automação com Ação "mover para o Funil X, Etapa Y" cuja Etapa Y foi removida passa a ter referência inválida: a plataforma a torna **inoperante com motivo** até nova Versão, sem edição automática (B93; RN-AUT-21); uma Ação cujo Funil de destino está `arquivado` falha (`falhou`, com registro) a cada disparo até correção (documento 13, 20.13).

### 20.9 Negócio com valor em moeda diferente da padrão

Permitido (RN-NEG-08; RN-ET-15): um Negócio em USD em Espaço de Trabalho com Localidade BRL grava quantia e moeda. **Painéis convertem?** Fora da ontologia: a conversão exige taxa e data de referência (do dia, do fechamento, fixa), que nenhuma entidade fornece. Recomendação: Painéis somam por moeda e exibem totais separados; qualquer conversão é Métrica derivada com política declarada no Widget — registrado como pendência para o documento 21 (seção 25). Automações que comparam "valor > 10.000" comparam quantia na moeda do Negócio; comparar entre moedas é indefinido.

### 20.10 Automação marcando Negócio como ganho sem Motivo ou valor exigido

**Falha** (RN-NEG-09; DO-FUN-06/08; documento 13, 20.8): a Ação "marcar como ganho" é submetida à Regra de encerramento como qualquer Ator; com "exigir valor" ativo e Valor vazio, a Ação é rejeitada, a Execução passa a `falhou` (B18) com a regra violada, Registro "rejeitada" com ator Automação e delegante o seu Proprietário. Nenhum efeito parcial: o Negócio continua `aberto`. A Automação não "preenche o valor para passar"; se isso for desejado, é Ação anterior explícita. O mesmo vale para `perdido` sem Motivo de Perda.

### 20.11 Agente alterando valor de Negócio em Funil privado sem concessão

**Negado** (RN-NEG-19; DO-FUN-10; A9.3): editar um Negócio em Funil privado exige `editar` no Negócio **e** `ver` no Funil; o Agente sem concessão sobre o Funil tem interseção vazia, mesmo invocado por um Membro que vê o Funil (a interseção falha do lado do Agente). A Ferramenta falha, a Execução passa a `falhou` ou `aguardando aprovação` (B23), Registro "negada". O Agente sequer recebe o Negócio no Contexto.

### 20.12 Negócio na lixeira que o Funil conta em Painel

**Não conta** (RN-NEG-17; 11.2): um Negócio `na lixeira` está fora de toda Métrica, Visualização, Gatilho e Requisito, em qualquer situação. Um `ganho` na lixeira não é receita; um `aberto` na lixeira não é "em aberto". O Funil, porém, **não o esquece**: ele continua a referenciar Funil e Etapa e participa de remapeamentos obrigatórios, de modo que a restauração sempre encontra Etapa existente. O que a restauração pode não encontrar é a **Empresa** (que pôde ir à lixeira quando o Negócio deixou de bloqueá-la): então a restauração de um `aberto` é rejeitada até restaurar a Empresa ou trocar/limpar a referência (RN-NEG-18). A hipótese "Etapa não existe mais ao restaurar" foi considerada e descartada: admiti-la exigiria excluir Negócios da lixeira dos remapeamentos e abrir exceção em INV-FUN-06; incluí-los custa nada e mantém o invariante.

### 20.13 Negócio cujo Proprietário é removido do Espaço de Trabalho

Sucessão (B28; 12.5): todos os Negócios do removido passam ao Sucessor no mesmo ato, cada um com Registro e evento "Proprietário alterado" com causa `sucessão`. Se um deles está em Funil privado sobre o qual o Sucessor não tem `ver`, o Sucessor recebe `ver` por concessão direta registrada no mesmo ato (RN-NEG-20) — exceção deliberada, no espírito de B38d, para que INV-NEG-10 não quebre no instante da sucessão; a alternativa (Sucessor Proprietário do que não vê) é o cenário que a questão 5 do documento 13 apontou como indesejável. Tarefas vinculadas de que o removido era Responsável são liberadas (B28); Conversas vinculadas de que era Atribuído também. O removido continua Criador e autor histórico (A6.4).

### 20.14 Negócio vinculado a trinta Conversas de WhatsApp

Válido (0..N): uma negociação de seis meses com o mesmo Contato gera trinta episódios `resolvida` e reaberta (B12). Cada Conversa pertence à Caixa de Entrada; o Vínculo não transfere Atribuído, Fila nem permissão; a linha do tempo do Negócio (8.2) as agrega para quem tem `ver` sobre cada uma. O documento 14 fixou o lado da Conversa também em 0..N (14, 20.4): a mesma Conversa pode tratar de dois Negócios. "Vincular automaticamente toda nova Conversa do Contato principal ao Negócio aberto" é Automação da organização, não regra da plataforma.

### 20.15 Negócio duplicado (mesma Empresa, mesmo objeto)

Válido: não há unicidade de Título, Empresa ou Objeto (RN-NEG-22). A plataforma pode emitir **Suspeita de Duplicidade** (objeto de valor derivado, no padrão de DO-CON-14): par de Negócios `aberto` da mesma Empresa (ou mesmo Contato principal) com Título semelhante; nunca ato automático. **Mesclagem de Negócios não existe nesta versão** (DO-NEG-12): diferente de Contato e Empresa, o Negócio tem situação, Etapa, Valor e histórico de transição que não se somam com sentido (qual Etapa? qual Valor? qual Registro de "entrou em Proposta"?). O caminho: encerrar um como `perdido` com o Motivo pré-definido "Duplicado" (não conta como perda comercial em Painéis que filtrem por esse Motivo), opcionalmente vinculado `relacionado a` ao mantido, e mover Vínculos de Tarefa/Conversa manualmente. Registrado em 25.

### 20.16 Dois Negócios com o mesmo Título no mesmo Funil

Permitido (5). "Renovação anual" para vinte Empresas distintas é o caso normal; o Identificador legível (DO-NEG-02) e a Empresa desambiguam. Unicidade de Título obrigaria a nomes artificiais.

### 20.17 Origem do Negócio diferente da Origem do Contato

Permitido e frequente: o Contato veio de "Instagram" em 2024; o Negócio de 2026 veio de "Indicação". Cada Origem responde à pergunta da própria entidade ("como conhecemos a pessoa" × "como surgiu esta oportunidade"). O produto pode sugerir a Origem do Contato principal como padrão ao criar o Negócio; a ontologia não deriva uma da outra.

### 20.18 Etapa "Ganho" criada no Funil e Negócio movido para ela

Continua `aberto` (RN-FUN-20; documento 13, 20.12): a plataforma não interpreta nomes de Etapa. Ganhar é ato explícito (12.2). A organização que quer o atalho cria a Automação "ao entrar em 'Ganho', marcar como ganho", sujeita a RN-NEG-09 (falha sem valor, se exigido).

### 20.19 Negócio `aberto` arquivado

Permitido (12.4): a organização "congela" uma oportunidade sem declará-la perdida (licitação suspensa). Consequências: somente leitura; não conta como "em aberto" nas Visualizações operacionais (conta ou não em Painéis conforme filtro); Automações de "parado" o ignoram; "dias em Etapa" continua a correr (derivado) e será alto ao restaurar. Se o Funil for arquivado nesse meio-tempo, o Negócio é migrado como qualquer `aberto` (INV-FUN-07 não distingue estado). Recomendação de produto: ao arquivar `aberto`, oferecer "marcar como perdido" antes.

### 20.20 Valor alterado depois de ganho

Permitido a quem tem `editar` sobre Negócio `ativo` (correção do valor final fechado), com Registro (antes, depois) e evento "valor alterado" — Painéis de receita recalculam. A Regra "exigir valor" é reavaliada: reduzir a zero um `ganho` em Funil com a regra ativa é rejeitado (INV-NEG-05). Se a organização quiser congelar valores de Negócios encerrados, arquiva-os (RN-NEG-16) ou restringe por Papel.

## 21. O que explicitamente NÃO pertence a esta entidade

| Parece pertencer | Pertence a | Por quê |
| --- | --- | --- |
| Etapas, probabilidade padrão, Requisitos, Transições, Regras de encerramento | Funil | O Negócio consome; não define (DO-FUN-06/07/08). |
| Situação como "Etapa terminal" | — (não existe) | DO-FUN-03; A4.4. |
| Probabilidade efetiva, valor ponderado, dias em Etapa, próxima/última atividade, previsão vencida, parado | Derivados (consulta, Painel, Gatilho) | Nunca gravados (RN-NEG-23). |
| Taxa de conversão, ranking, "score" | Painéis; Execuções | Métricas e saídas, não atributos. |
| Motivos de Perda e de Ganho, Origens, Tags, Definições de Campo | Espaço de Trabalho (catálogos, B34) | O Negócio referencia. |
| Empresa "do Negócio" e seus dados (CNPJ, endereço, Contatos da Empresa) | Empresa | Referência; nada é copiado ou herdado. |
| Cargo do Contato | Vínculo Contato-Empresa | DO-CON-04. O Negócio conhece o papel no Negócio. |
| Conversas, Mensagens, Atribuído, Fila | Caixa de Entrada | Vínculo; DO-CON-09. |
| Tarefas, Responsáveis, status, Registros de Tempo | Tarefa / Lista | Vínculo (DO-TAR-08). Negócio não tem Responsável. |
| Proposta, Orçamento, Contrato, versões, assinatura | D3 (futuro); hoje Anexo/Tarefa | Não há entidade. |
| Produto, catálogo, itens de linha, preço unitário | D2 (futuro); hoje Objeto e Definições de Campo | B10. |
| Pedido, faturamento, pagamento, entrega, receita realizada | Fora da ontologia (Integração) | O ganho encerra o Negócio (seção 4). |
| Comissão, meta do vendedor | D7 (futuro) / Painéis | Não é atributo do Negócio. |
| Histórico / linha do tempo | Registros de Atividade (Espaço de Trabalho) | Visão derivada (8.2). |
| Registro de transição como entidade própria | Registro de Atividade | Dados estruturados de um Registro (7.6). |
| Sessões de Chat ancoradas, Execuções | IA (Membro; Agente/Automação) | Referência inversa. |
| Concessões e compartilhamentos sobre o Negócio | Relações no Recurso | Não são componentes. |
| Template de Negócio; mesclagem de Negócios | — (não existem nesta versão) | Seção 15; DO-NEG-12. |
| Responsável, Atribuído, Observador | — | O Negócio tem apenas Proprietário (A7). |

## 22. Exemplos conceituais

**Exemplo 1 — Clínica, venda a pessoa física.** Pela Caixa de Entrada, a Dra. Camila (Contato, criada por Mensagem de WhatsApp) pergunta sobre pacotes. A recepcionista Ana cria, a partir da Conversa, o Negócio "Pacote de 10 sessões — Dra. Camila" (NEG-0088): Proveniência "criado a partir de Conversa", Vínculo Conversa-Negócio, Vínculo Contato-Negócio (papel `decisor`, principal), Empresa vazia (pessoa física), Funil padrão "Novos pacientes", Etapa "Novo", Valor R$ 3.200 (moeda da Localidade), Proprietária Ana, Origem "WhatsApp". Um Agente "Qualificador" tenta mover para "Proposta" sem o campo "Plano de saúde": rejeitado (Requisito). Ana preenche, move; a Automação do Funil cria a Tarefa "Enviar proposta" vinculada — que passa a ser a "próxima atividade". Em "Negociação", Ana sobrescreve a probabilidade para 90%. Dez dias depois marca `ganho`: a Regra "exigir valor" está satisfeita; a última Etapa "Negociação" é preservada; a sobrescrita é descartada (efetiva = 100); a Automação "ao ganhar, criar Negócio no Funil 'Retorno de pacientes'" cria um Negócio **novo** com Proveniência. Ao fim do ano, o Negócio é `arquivado`: continua receita de 2026 no Painel.

**Exemplo 2 — B2B com comitê e retrocesso.** O Negócio "Licenças 2027 — Alfa" (NEG-0301) referencia a Empresa Alfa (`ativo`), tem cinco Vínculos de Contato: Marta (`decisor`, principal), Pedro (`comprador`), Lucas (`técnico`), Júlia (`usuário`) e um consultor da Beta (`influenciador`). Em "Negociação" (80%), o Proprietário João sobrescreve para 95% e prevê fechamento em 30/09. Marta pede revisão de escopo: João retrocede para "Proposta" — a sobrescrita de 95% é descartada com Registro, a efetiva passa a 60% (padrão da Etapa), e o Registro de transição grava origem "Negociação" (Ordem 4 à época) → destino "Proposta" (Ordem 3): retrocesso derivado. Em 01/10, "Previsão vencida" torna-se verdadeira; o Gatilho de agendamento dispara um lembrete. Marta é mesclada em outro Contato (duplicata com outro e-mail): o Vínculo migra, o Negócio não muda. Em novembro, João é removido do Espaço de Trabalho; o Negócio passa à Sucessora Carla no mesmo ato.

**Exemplo 3 — Funil privado e perda.** A Proprietária do Espaço de Trabalho move o Negócio "Aquisição da Gama" do Funil "Vendas" para o Funil privado "Aquisições" (Etapa "Due diligence", explícita). O Proprietário do Negócio, o vendedor Rui, não tem `ver` sobre "Aquisições": a operação exige escolher — a Proprietária transfere a propriedade à diretora Lia (RN-NEG-20). Rui, com escopo `próprios`, deixa de ver o Negócio (não é mais Proprietário); o Painel dele deixa de contá-lo. Meses depois, o Negócio é `perdido` em "Due diligence" com Motivo "Risco regulatório" e Nota; o Painel "Perdas por Etapa" (visível só a quem vê o Funil) o conta em "Due diligence". Um ano depois, o Funil "Aquisições" é arquivado; o Negócio `perdido` permanece referenciando-o. Ao ser reaberto por Lia, precisa ser movido a um Funil `ativo` no mesmo ato.

**Exemplo 4 — Duplicidade e Automação que falha.** Dois vendedores criam "Renovação — Delta" em Funis diferentes. A Suspeita de Duplicidade aparece; o gerente encerra um como `perdido` com Motivo "Duplicado" e cria Vínculo `relacionado a` com o mantido. A Automação "ao entrar em 'Fechamento', marcar como ganho" dispara sobre o mantido, que tem Valor vazio em Funil com "exigir valor": a Ação falha, a Execução passa a `falhou`, o Negócio segue `aberto` em "Fechamento"; o vendedor informa o Valor e marca `ganho` manualmente.

## 23. Representação gráfica textual

```
ESPAÇO DE TRABALHO
├── Localidade (moeda padrão) ─────────────────► padrão do Valor
├── Identificador legível de Negócios (0..1, objeto de valor) ─► NEG-0421
├── Catálogos: Motivo de Perda (0..N) · Motivo de Ganho (0..N) · Origem (0..N)
│              Tag (0..N) · Definição de Campo [alvo: Negócio] (0..N)
├── FUNIL (1..N) ── ETAPA (1..N)   [documento 13]
│        ▲ percorre        ▲ está em / terminou em
│        │ (referência 1)  │ (referência 1, por identidade)
│
├── NEGÓCIO (0..N)  [raiz de agregado; pertence ao ET]
│   ├── identidade: Identificador · Identificador legível
│   ├── Título · Objeto (B10) · Descrição · Origem (0..1)
│   ├── Proprietário (1 Membro; sucessão B28) · Criador
│   ├── situação: aberto | ganho | perdido   ─┐ eixos
│   ├── estado:   ativo | arquivado | na lixeira ─┘ ortogonais
│   ├── Valor (0..1, objeto de valor: quantia, moeda)
│   ├── Probabilidade sobrescrita (0..1) ─► efetiva (derivada) ─► valor ponderado (derivado)
│   ├── Motivo de Perda (0..1) · Motivo de Ganho (0..1) · Nota de encerramento
│   ├── Data prevista de fechamento · Momento/Data de fechamento (derivados)
│   ├── Empresa (0..1, referência; só `ativo` ao vincular) ──────► EMPRESA
│   ├── Vínculo Contato-Negócio (0..N; papel; principal ≤1) ◄────► CONTATO
│   ├── Vínculo ◄──► TAREFA (0..N) · CONVERSA (0..N) · DOCUMENTO (0..N) · NEGÓCIO (0..N)
│   ├── Valor de Campo (0..N, contenção) · Comentário (0..N, contenção)
│   ├── Anexo (0..N, referência a Arquivo) · Tag (0..N, N:N)
│   ├── Proveniência (0..1: Conversa | Contato | Empresa | Tarefa | Negócio | Integração)
│   └── derivados: dias em Etapa · idade · última/próxima atividade · previsão vencida
│
├── REGISTRO DE ATIVIDADE (objeto: Negócio) ── inclui Registros de transição:
│        Etapa origem/destino por identidade + nome + Ordem à época; origem da entrada;
│        avanço/retrocesso derivado; sobrescrita descartada; tempo de permanência
├── AUTOMAÇÃO (escopo Funil) ── reage a ──► ganho · perdido · entrou em Etapa · parado (derivado)
├── PAINEL → Widget (Fonte: Negócios de um Funil) ── deriva ──► receita, conversão, ponderado
└── SESSÃO DE CHAT ── ancorada a ──► Negócio (B21)

Negócio → Funil/Etapa: referência obrigatória substituível (percorre; não pertence — DO-FUN-01).
Negócio → Empresa: referência opcional (RN-EMP-08/09/10).  Negócio ↔ Contato: Vínculo com papel.
Nenhuma herança em nenhuma aresta.  Sem Responsável, sem Status, sem mesclagem.
```

## 24. Decisões ontológicas

- **DO-NEG-01.** Negócio é oportunidade comercial identificável, raiz de agregado, pertencente diretamente ao Espaço de Trabalho; referencia exatamente um Funil e uma Etapa (percorre, não pertence — DO-FUN-01), 0..1 Empresa e 0..N Contatos por Vínculo com papel; tem exatamente um Proprietário e nenhum Responsável. Aplica A1.1, A2.2, A4.4, A7, B9. CONSOLIDADA.
- **DO-NEG-02.** **Identificador legível de Negócios**: configuração opcional do Espaço de Trabalho (habilitado, prefixo próprio), análoga a DO-TAR-02, gerando número sequencial único no Espaço de Trabalho, imutável, nunca reutilizado, invariante a mudança de Funil, Empresa, situação e restauração. Justificativa: Negócios são citados por humanos e Agentes fora do CRM; Título não é único. **Impacto no documento 01**: novo objeto de valor na seção 6 e em 7.5. RECOMENDADA.
- **DO-NEG-03.** Vínculo Contato-Negócio: no máximo um por par (Contato, Negócio); **papel obrigatório de catálogo fixo da plataforma** — `decisor`, `influenciador`, `comprador`, `técnico`, `usuário`, `outro` com rótulo livre —; indicador **principal** (≤1 por Negócio; o primeiro nasce principal); Contatos de qualquer Empresa ou de nenhuma. Catálogo fixo pela mesma razão de DO-EMP-07 (interpretável sem ler nomes). Amplia B9 com o valor `usuário`. RECOMENDADA.
- **DO-NEG-04.** Valor é objeto de valor (quantia não negativa, moeda) com moeda padrão da Localidade e moeda própria admitida; vazio ≠ zero; valor ponderado é derivado; conversão entre moedas é derivada e fora da ontologia (Painéis somam por moeda por padrão). Aplica B34, RN-ET-15/16. RECOMENDADA.
- **DO-NEG-05.** A **probabilidade sobrescrita é descartada** (com Registro que preserva o valor) em toda mudança de Etapa por progressão — avanço, retrocesso, salto, mudança de Funil, reabertura para outra Etapa — e ao encerrar; é **preservada** em remapeamentos obrigatórios (RN-FUN-08; INV-FUN-10). Justificativa: a sobrescrita é juízo sobre o Negócio em uma posição; mantê-la ao mudar de posição produz valor ponderado silenciosamente falso. Alternativa rejeitada: manter. **Impacto no documento 13**: "recalculada se herdada" (12.4, 20.6) lê-se "sempre recalculada em progressão". RECOMENDADA.
- **DO-NEG-06.** **Motivo de Ganho** é catálogo opcional do Espaço de Trabalho, simétrico a Motivo de Perda (B34), referenciado 0..1 pelo Negócio `ganho`, nunca obrigatório nesta versão; **Nota de encerramento** é texto complementar a qualquer Motivo. Justificativa: "por que ganhamos" é pergunta de Painel tão legítima quanto "por que perdemos", e um Campo Personalizado não seria interpretável por Automações como catálogo. Amplia a tabela 7.6 do documento 01 e o Glossário; não altera as Regras de encerramento (DO-FUN-08) — exigir Motivo de Ganho é registrado em 25. RECOMENDADA.
- **DO-NEG-07.** Empresa do Negócio: referência unilateral 0..1 (não Vínculo), só a Empresa `ativo` ao definir ou trocar (RN-EMP-08); preservada no arquivamento da Empresa; reapontada na mesclagem (DO-EMP-13); a lixeira e a eliminação da Empresa obedecem a RN-EMP-09/10. Trocar a Empresa de Negócio encerrado exige `administrar`. Aplica DO-EMP-11. RECOMENDADA.
- **DO-NEG-08.** Situação: `aberto`, `ganho`, `perdido`; encerrar exige estado `ativo` e as Regras de encerramento do Funil, sem avaliar Requisitos de `saída` e sem sair da Etapa; reabrir `perdido` por `editar`, reabrir `ganho` por Papel de nível Administrador (não concedível); ao reabrir, retorno à última Etapa com Requisitos de `entrada`, ou mudança de Funil no ato se o Funil está `arquivado`; Motivos e Momento de encerramento limpos como atributos correntes e preservados nos Registros; sem transição direta `ganho` ↔ `perdido`. Aplica B9, DO-FUN-08, DO-FUN-11. CONSOLIDADA (B9) com detalhamento RECOMENDADO.
- **DO-NEG-09.** Estado de ciclo de vida ortogonal à situação: qualquer combinação é válida; `arquivado` é somente leitura; `na lixeira` é ignorado por Métricas, Visualizações, Gatilhos e Requisitos, **mas continua a referenciar Funil e Etapa e participa de remapeamentos e migrações obrigatórios**, de modo que a restauração nunca encontra Etapa inexistente; a restauração de um `aberto` é rejeitada enquanto a Empresa referenciada estiver `na lixeira`/`mesclado` ou o Funil `arquivado` sem resolução no ato. Não há estado efetivo (B36 não se aplica ao CRM). RECOMENDADA.
- **DO-NEG-10.** **Todo Proprietário de Negócio tem `ver` sobre o Negócio em todo instante** (INV-NEG-10). Mover para Funil privado, privatizar Funil, revogar `ver` sobre Funil privado ou definir Proprietário sem `ver` é rejeitado salvo concessão de `ver` ao Proprietário ou transferência de propriedade no mesmo ato; na sucessão (B28), o Sucessor recebe `ver` por concessão registrada automaticamente. Resolve a questão 5 do documento 13; exceção deliberada no espírito de B38d. **Candidata a decisão B.** RECOMENDADA.
- **DO-NEG-11.** Marcar `ganho`/`perdido`, enviar à lixeira e trocar Empresa de Negócio encerrado são, para Agentes em nível `supervisionado`, Ferramentas de classe `escrita irreversível` que geram Solicitação de Aprovação (B22; consolidadas em B64; decisão por Ferramenta em B77; prazo padrão de 72 horas em B80), porque disparam Automações com efeito externo e porque a reversão de `ganho` exige Papel que o Agente não tem. Agentes nunca reabrem `ganho`. Aplica A6.3, B22, INV-ET-13. RECOMENDADA.
- **DO-NEG-12.** **Não há mesclagem de Negócios** nesta versão: situação, Etapa, Valor e histórico de transição não se combinam com sentido. Duplicidade é tratada por Suspeita de Duplicidade (objeto de valor derivado, no padrão de DO-CON-14, nunca automática) e por encerramento do duplicado como `perdido` com o Motivo de Perda **"Duplicado", pré-definido pela plataforma** na criação do Espaço de Trabalho (Proveniência "pré-definida", editável — padrão de DO-EMP-10), com Vínculo `relacionado a` opcional. **Impacto no documento 01**: 12.1 passa a instanciar esse Motivo. RECOMENDADA.
- **DO-NEG-13.** Vínculo Conversa-Negócio: 0..N em ambos os lados (o lado da Conversa foi fixado pelo documento 14, 7.12 e 8.4, que também define a criação "a partir de Conversa"); sem propriedade, sem transferir Atribuído, Fila ou permissão; visível a quem vê ambos. Aplica A8. RECOMENDADA.
- **DO-NEG-14.** Próxima atividade (Tarefa vinculada não terminal de menor Data), última atividade, dias em Etapa, idade, previsão vencida, "parado há X dias" e valor ponderado são **derivados**, calculados a cada consulta, filtrados por B20 e nunca gravados; "parado" e "previsão vencida" são condições avaliadas por Gatilho de agendamento (documento 19), não eventos do Negócio. Aplica DO-FUN-12. RECOMENDADA.
- **DO-NEG-15.** Comentário em Negócio segue DO-TAR-07, com "quem tem `administrar` sobre o Negócio" no lugar de "Administrador do contêiner" (padrão de DO-EMP-15). RECOMENDADA.
- **DO-NEG-16.** Proprietário inicial na criação por Ator não humano: delegante **Membro** (a Automação delegante de DO-AUT-15 não é Membro e não conta); senão, Membro configurado na Automação/Ferramenta; senão, Proprietário do Agente ou da Automação, ou Membro configurador da Integração; nunca vazio; nunca Membro não `ativo`; sujeito a DO-NEG-10 em Funil privado. Padrão de DO-EMP-16. RECOMENDADA.
- **DO-NEG-17.** Produto/serviço é o atributo textual **Objeto** mais Definições de Campo de Negócio; nenhuma Definição de Negócio é pré-definida pela plataforma; Catálogo de Produtos e Itens de Negócio permanecem D2. Aplica B10. CONSOLIDADA.
- **DO-NEG-18.** Registros de transição gravam Etapa de origem e destino por identidade, nome e **Ordem à época**, origem da entrada (`criação`, `avanço`, `retrocesso`, `salto`, `mudança de Funil`, `reabertura`, `remapeamento`), sobrescrita descartada e tempo de permanência; avanço/retrocesso é derivado da Ordem à época, nunca declarado. Aplica DO-FUN-13. RECOMENDADA.
- **DO-NEG-19.** Vínculo Negócio-Negócio `relacionado a`: simétrico, papel textual opcional, sem laço, sem cascata, sem herança; criação "a partir de" outro Negócio grava Proveniência e opcionalmente esse Vínculo. Reutiliza A8 (mesmo modelo de Tarefa–Tarefa, DO-TAR-08). RECOMENDADA.

Nenhuma decisão deste documento contradiz A1–A9 ou B1–B99. DO-NEG-02, DO-NEG-06 e DO-NEG-12 ampliam, respectivamente, os objetos de valor, a tabela 7.6 e o ato de criação do documento 01; DO-NEG-03 acrescenta um valor ao catálogo de B9; DO-NEG-05 ajusta uma leitura do documento 13; DO-NEG-10 responde à questão 5 do documento 13 e é candidata a decisão B.

## 25. Questões em aberto

1. **Exigir Motivo de Ganho.** DO-NEG-06 cria o catálogo sem obrigatoriedade. Se organizações exigirem "motivo de ganho obrigatório", isso é um terceiro indicador nas Regras de encerramento (DO-FUN-08), a decidir junto com o documento 13.
2. **Conversão de moeda em Painéis** (20.9; C22). **Resolvida para Painéis** pelo documento 21 (DO-PAI-13; RN-PAI-13): Métricas sobre Valor produzem uma série por moeda e o Painel nunca converte. Permanece aberta em C22 apenas a **configuração de câmbio** (taxa e data de referência — do dia, do fechamento, fixa por período) do Espaço de Trabalho, sem a qual não há consolidação entre moedas nem comparação entre moedas em Automações. Consequência relevante para organizações multinacionais.
3. **Escopo "da minha Equipe"** (documento 10, questão 1). "Gerente vê os Negócios da sua Equipe" não é expressável com B29; o CRM comercial é onde mais dói. Reforça a candidatura a C-nova.
4. **Data de fechamento informada (importação e retroatividade).** A Data de fechamento é derivada do momento do ato (6.1). Importar Negócios históricos ("ganho em 2024") ou corrigir "fechou na sexta, registrei na segunda" exige uma data informável distinta do momento do Registro. Alternativas: (a) Proveniência de importação carrega "data de fechamento informada", usada por Painéis; (b) atributo "Data de fechamento" gravado, com padrão derivado e editável por `editar`. Consequência para Painéis por período.
5. **Mesclagem de Negócios** (DO-NEG-12). Rejeitada nesta versão; se o produto a exigir, precisa definir qual Etapa, Valor e histórico prevalecem — provavelmente "sobrevivente prevalece, Registros do absorvido migram como visão", no padrão de DO-CON-11.
6. **Catálogo configurável de papéis no Negócio** (DO-NEG-03). "Patrocinador executivo", "jurídico", "financeiro" cabem em `outro` com rótulo; um catálogo configurável seria entidade contida (B34), como a questão 2 do documento 11.
7. **Template de Negócio.** A8 não o prevê; "criar a partir de" e Automações cobrem o caso. Se organizações pedirem "modelos de oportunidade" com Valores de Campo e Tarefas pré-vinculadas, amplia A8.
8. **Itens de Negócio e Valor composto** (D2). Quando adotados, o Valor passa a ser derivado da soma dos itens ou permanece editável com itens como detalhamento? Consequência para RN-NEG-08 e INV-NEG-05.
9. **Proposta / Contrato** (D3) e Requisitos que os consultam ("só ganha com proposta aceita" — documento 13, questão 2).
10. **Dias úteis em "parado" e "previsão vencida"** (C12). Sem horário comercial, "dias" é calendário; Funil, Fila e Painel devem concordar.
11. **Negócio `aberto` arquivado** (20.19). Permitido por simetria com Empresa; se o produto preferir exigir encerramento antes de arquivar, é restrição de produto compatível com esta ontologia.

Resolvidas neste documento com recomendação, sem pendência aberta: descarte da sobrescrita (DO-NEG-05); Identificador legível (DO-NEG-02); catálogo fixo de papéis (DO-NEG-03); lixeira de Negócio `aberto` e participação em remapeamentos (DO-NEG-09); Proprietário sem `ver` em Funil privado (DO-NEG-10, questão 5 do documento 13); mesclagem (DO-NEG-12); Motivo de Ganho como catálogo opcional (DO-NEG-06).
