# Funil comercial — SDR e Closer

**O que este documento é:** o mapa entre o processo comercial da N1 Digital e as entidades da ontologia que o sustentam no protótipo. Cada linha aponta para o identificador que existe em `app/src/data/seed.ts` — se o identificador não estiver lá, a linha está errada, não o código.

**Decisão de escopo:** o Espaço de Trabalho tem **quatro Funis**: SDR, Closer, Validação Full Face Avançado (§3a) e Venda direta (§3b). Os Funis anteriores (Vendas B2B e Pós-venda) foram removidos junto com os Negócios que viviam neles.

---

## 1. Por que dois Funis e não um

O SDR entrega **reunião**. O Closer entrega **receita**. São dois compromissos diferentes, medidos por números diferentes, cobrados de pessoas diferentes.

Num Funil só, a Etapa "Agendamento" seria ao mesmo tempo o fim do trabalho de um e o começo do trabalho do outro — e a taxa de conversão de qualquer ponto passaria a misturar dois esforços. Dois Funis tornam a passagem um **evento explícito**: o Negócio muda de Funil, muda de Responsável, e a mudança fica no histórico.

A troca de Funil é feita por `moveDealToFunnel` (`app/src/data/operations/deals.ts`), que verifica os Requisitos de entrada da Etapa de destino, recusa Convidado, grava `entryOrigin: "mudancaDeFunil"` e registra a atividade.

---

## 2. Funil SDR — `fnl_sdr`

Da chegada do lead à reunião agendada com o Closer.

| Etapa | Id | Prob. | Requisito |
| --- | --- | --- | --- |
| Novo Lead | `sdr_novo` | 5% | — |
| Contato Inicial | `sdr_contato` | 10% | — |
| Conexão | `sdr_conexao` | 20% | saída: `fd_conexao_em` preenchido |
| Qualificação | `sdr_qualificacao` | 35% | saída: os seis campos do roteiro |
| Qualificado | `sdr_qualificado` | 50% | saída: `fd_data_reuniao` preenchido |
| Agendamento | `sdr_agendamento` | 60% | entrada: Contato obrigatório |

Encerramento: **Motivo de Perda obrigatório**, valor no ganho não obrigatório — o SDR não fecha valor.

Três escolhas que não são óbvias:

- **Conexão só vira Etapa com fato gravado.** `fd_conexao_em` é a data e hora em que o lead concordou em ser qualificado. Sem esse campo, "conexão" seria opinião do SDR sobre a própria conversa.
- **O roteiro é Requisito de SAÍDA da Qualificação.** Sair sem os seis campos é dizer que qualificou sem ter perguntado.
- **Agendamento exige Contato.** Entregar ao Closer um Negócio sem Contato vinculado é entregar uma reunião com ninguém. Por isso o registro do Negócio tem o painel "Contatos vinculados" com o controle de vincular — a tela precisa oferecer o que a Etapa cobra.

### O roteiro de qualificação

Seis Campos do Negócio, todos em `fieldDefinitions`, todos Requisito de saída da Etapa Qualificação:

| Campo | Id | Tipo | A pergunta |
| --- | --- | --- | --- |
| Critério de fit | `fd_criterio_fit` | texto longo | Esta empresa é do tipo que a N1 atende? |
| Critério de decisão | `fd_criterio` | texto longo | Por qual régua o cliente vai comparar a N1 com a alternativa? |
| Dor | `fd_dor` | texto longo | O que dói hoje, com o custo que isso tem? |
| Decisor | `fd_decisor` | texto | Quem assina? |
| Orçamento | `fd_orcamento` | moeda | Quanto existe reservado? |
| Prazo | `fd_prazo` | seleção única | Em quanto tempo precisa estar rodando? |

**Quatro desses seis são o BANT** — Orçamento (Budget), Decisor (Authority), Dor (Need), Prazo (Timing), o roteiro da IBM dos anos 1960. Os dois Critérios não são, e a razão de existirem é que o BANT diz se a pessoa **pode** comprar e não diz **o que faz ela escolher você**.

Os dois medem coisas diferentes e por isso não cabem no mesmo campo:

- **Fit** pergunta se vale a pena continuar. É a decisão da N1 sobre o lead, e conversa com os "Sinais de fit" (`fd_sinais_fit`) que o Agente enriquecedor levanta no Contato — o campo do Negócio é a conclusão do SDR sobre aqueles sinais.
- **Decisão** pergunta o que faz a N1 ganhar. É a decisão do lead sobre a N1. Um lead que passa nos quatro do BANT e reprova aqui é exatamente o que vira `perdido` com Motivo "Concorrente" no Closer.

Cada Campo carrega a sua pergunta em `description`, e a ficha do Negócio mostra essa pergunta abaixo do rótulo: "Critério" sozinho não diz a ninguém o que preencher.

Mais três campos de apoio, fora do roteiro:

`fd_result_qual` (resultado da qualificação — Qualificado / Desqualificado), `fd_data_reuniao` e `fd_sdr_origem` (o SDR que originou, para o Closer saber a quem devolver).

O **Resumo do perfil** (`fd_resumo_perfil`) é campo do **Contato**, não do Negócio — e por isso deliberadamente **não** é Requisito de Etapa: o Requisito só lê Valores de Campo do Negócio.

---

## 3. Funil Closer — `fnl_closer`

Da reunião agendada ao contrato assinado.

| Etapa | Id | Prob. | Requisito |
| --- | --- | --- | --- |
| Agendamento | `clo_agendamento` | 60% | — |
| Call | `clo_call` | 70% | — |
| Negociação | `clo_negociacao` | 80% | entrada: valor obrigatório |
| Fechamento | `clo_fechamento` | 90% | — |

Encerramento: **Motivo de Perda e valor no ganho, ambos obrigatórios**.

- **"Venda" não é Etapa.** `ganho` é a situação do Negócio. Fechamento é a Etapa do contrato em assinatura, e ela existe porque o Negócio **ainda pode ser perdido** ali: um estado onde se perde é Etapa, não é momento.
- **Negociação exige valor.** Negociar sem valor é negociar o quê.

---

## 3a. Funil Validação Full Face Avançado — `fnl_validacao`

Do sinal pago à contratação. A pessoa paga para entrar no processo de aplicação, passa por uma call de validação e só avança à venda se for aprovada.

| Etapa | Id | Prob. | Requisito |
| --- | --- | --- | --- |
| Sinal pago | `val_sinal` | 15% | entrada: Contato obrigatório e `fd_sinal_pago_em` preenchido |
| Aguardando agendamento | `val_aguardando` | 20% | saída: `fd_data_reuniao` preenchido |
| Call agendada | `val_agendada` | 35% | entrada: `fd_data_reuniao` preenchido |
| Call realizada | `val_realizada` | 50% | saída: `fd_validacao` preenchido |
| Em análise | `val_analise` | 55% | — (opcional: só quando a decisão não sai na hora) |
| Aprovado | `val_aprovado` | 75% | entrada: `fd_resultado_validacao` preenchido |
| Venda | `val_venda` | 90% | entrada: valor obrigatório; saída: `fd_pagamento` preenchido |

Encerramento: **Motivo de Perda e valor no ganho, ambos obrigatórios**.

A jornada descrita pelo comercial tem nove passos — os sete acima mais "Não aprovado" e "Ganho". Os dois últimos **não são Etapas**, pela mesma razão do Closer (§3):

- **Ganho** é a situação do Negócio. Ganhar é sair do Funil com contrato e pagamento confirmados, não parar numa coluna.
- **Não aprovado** é perda com Motivo `cat_perda_naoaprov`. Sai de Call realizada ou de Em análise, e é assim que o Painel de perdas a distingue de "Preço" ou "Concorrente". A tratativa do sinal fica em `fd_tratativa_sinal` (Devolvido integralmente / Retido conforme política / Convertido em crédito).

Quatro Campos do Negócio são deste Funil: `fd_sinal_pago_em` (data e hora do sinal — o fato que abre o processo), `fd_validacao` (o que a call confirmou e o que não bate com o perfil), `fd_resultado_validacao` (Aprovado / Não aprovado) e `fd_tratativa_sinal`. `fd_data_reuniao` e `fd_pagamento` são compartilhados com os outros Funis.

---

## 3b. Funil Venda direta — `fnl_venda_direta`

Venda pelo WhatsApp numa conversa só, sem passagem entre SDR e Closer.

| Etapa | Id | Prob. | Requisito |
| --- | --- | --- | --- |
| Novo lead | `vd_novo` | 5% | — |
| Primeiro contato | `vd_contato` | 10% | — |
| Em qualificação | `vd_qualificacao` | 30% | saída: `fd_criterio_fit`, `fd_dor`, `fd_prazo`, `fd_orcamento` — perfil, necessidade, momento, potencial |
| Oferta apresentada | `vd_oferta` | 55% | entrada: valor obrigatório; saída: `fd_plano` |
| Em negociação | `vd_negociacao` | 75% | saída: `fd_pagamento` |

Encerramento: **Motivo de Perda e valor no ganho, ambos obrigatórios**. "Ganho" (pagamento confirmado) e "Perdido" (não avançou, desistiu, sem perfil) são situação do Negócio, não Etapa — os Motivos já existentes cobrem os três casos: Sem resposta, Vai fazer depois, Desqualificado.

A qualificação reusa quatro dos seis Campos do roteiro do SDR (§2): é o mesmo entendimento, feito por uma pessoa só.

---

## 4. Quem faz

| Equipe | Id | Membros |
| --- | --- | --- |
| SDR | `team_sdr` | Júlia Prado, Marcos Lima |
| Closers | `team_closers` | Rafael Nunes |

As Equipes não são decoração: elas dão as Elegíveis da Fila, dão as permissões, e são por elas que o Painel separa um papel do outro.

---

## 5. Motivos de Perda

O Catálogo de Motivos é do Espaço de Trabalho e **não** é particionado por Funil: a separação abaixo é de uso, não de configuração. Ela importa porque o SDR perde no começo do funil e o Closer perde no fim — um Painel que misturasse os dois diria que "preço" é um problema de prospecção. É por isso que cada Painel lê o Motivo dentro do seu próprio Funil.

**Do SDR:** Sem resposta (`cat_perda_semresp`), Sem conexão (`cat_perda_semconex`), Sem agendamento (`cat_perda_semagend`), Não é decisor (`cat_perda_naodecisor`), Desqualificado (`cat_perda_desqual`), Não compareceu (`cat_perda_naocomp`).

**Do Closer:** Preço (`cat_perda_preco`), Prazo (`cat_perda_prazo`), Sem orçamento (`cat_perda_semorc`), Concorrente (`cat_perda_concor`), Sem retorno (`cat_perda_semret`), Duplicado (`cat_perda_dup`).

---

## 6. As sete Automações

Todas em `processoComercial()`, no fim de `app/src/data/seed.ts`.

| Automação | Id | O que faz |
| --- | --- | --- |
| Entrada no SDR | `aut_sdr_entrada` | Todo lead que chega por Mensagem vira Negócio no Funil SDR |
| Enriquecimento do lead | `aut_sdr_enriquecimento` | Analisa o perfil público e devolve o resumo antes da abordagem |
| Abordagem realizada | `aut_sdr_abordagem` | Mensagem enviada ao lead move o Negócio para Contato Inicial |
| Abordagem respondida | `aut_sdr_resposta` | Primeira resposta do lead move o Negócio para Conexão |
| Conexão confirmada | `aut_sdr_conexao` | Classifica a resposta e grava o fato da conexão |
| Passagem ao Closer | `aut_sdr_passagem` | Entrega o Negócio qualificado ao Closer, com a call já criada |
| Proteções de tempo do SDR | `aut_sdr_prazos` | Retomada em 2 dias; perda com Motivo em 7, 10 ou 14 dias conforme a Etapa |

A última é a que impede o funil de virar cemitério: um Negócio parado não fica parado para sempre, ele é perdido **com Motivo** — que é o que alimenta o Painel.

---

## 7. Os Agentes do processo

| Agente | Id | Autonomia | Habilidade concedida |
| --- | --- | --- | --- |
| Enriquecedor de leads | `agt_enriquecedor` | autônomo | Analisar perfil público (`skl_analisar_perfil`) |
| Classificador de conexão | `agt_classificador` | assistido | Classificar conexão (`skl_classificar_conexao`) |
| Qualificador SDR | `agt_sdr` | supervisionado | Abordar lead (`skl_abordar_lead`) |

O Enriquecedor é autônomo porque só **lê** e escreve num campo interno. O Classificador é assistido porque o que ele decide **move o Negócio de Etapa** — e uma decisão que move o funil passa por gente. O Qualificador é supervisionado porque o que ele produz **sai da plataforma** e chega ao lead.

---

## 8. Os dois Painéis

Um Painel por papel, e não um Painel do comercial. Misturar os dois faz o número de um justificar o do outro — que é exatamente o que o processo separa.

**SDR** (`pnl_sdr`, ancorado em `fnl_sdr`): Negócios por Etapa, Em prospecção agora, Leads por Origem, Desqualificação por Motivo, Carteira por SDR.

**Closer** (`pnl_closer`, ancorado em `fnl_closer`): Negócios por Etapa, Valor em aberto, Ganhos por mês, Negócios por situação, Perdas por Motivo.

Dinheiro nunca é consolidado entre moedas (RN-PAI-13): sem dimensão, a leitura devolve uma linha por moeda; com dimensão, um recorte que tenha mais de uma moeda é **recusado** em vez de somado.

---

## 9. Onde isso aparece na interface

| O quê | Onde |
| --- | --- |
| Os quatro Funis | `/crm/funis` |
| O quadro de Etapas | `/crm/funis/fnl_sdr`, `/crm/funis/fnl_closer`, `/crm/funis/fnl_validacao` e `/crm/funis/fnl_venda_direta` |
| O registro do Negócio | `/crm/negocios/[id]` — conversa no meio, Negócio e Contatos à direita, qualificação à esquerda |
| Os Painéis | `/paineis/pnl_sdr` e `/paineis/pnl_closer` |
| As Automações | `/automacoes` |
| Os Agentes | `/agentes` |
