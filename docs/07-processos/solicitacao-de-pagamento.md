# Solicitação de pagamento — processo do Financeiro

**O que este documento é:** a especificação do processo de solicitação de pagamento que hoje roda no ClickUp (workspace `9011731314`, Lista `901109104938`, "Solicitação de pagamento"), traduzida para as entidades da ontologia, de modo que o mesmo processo continue funcionando quando for replicado na plataforma. Este é o processo que **antecede** Contas a pagar (`docs/07-processos/contas-a-pagar.md`): é aqui que um pedido nasce, é validado e aprovado, antes de virar uma obrigação financeira em curso. Tudo o que está aqui foi lido da configuração real da Lista, das 19 Tarefas nela exportadas e do código do `automation/` (repositório `financeiro-tria`, fora deste monorepo); o que não pôde ser verificado está na seção 12, não no corpo.

**Aviso de volume:** esta Lista tem hoje só **19 Tarefas** (18 em `não aprovado`, 1 em `aprovado`), não as ~1.110 linhas registradas historicamente em `solicitacoes_pagamentos` no Supabase do `financeiro-tria` (achado do Plan 00-05, `.planning/phases/00-prepara-o/00-05-SUMMARY.md`). O pipeline não mantém a Tarefa de Solicitação como histórico permanente depois de processada — este documento descreve o **processo**, lido de uma amostra pequena mas real e do código que o automatiza; não é, e não pretende ser, cobertura de 1.110 casos históricos. A origem dessas ~1.110 linhas para importação é assunto da Fase 2/3, não desta spec.

**Fonte dos dados:** exportação real de 2026-09-17T02:40:34.413Z (`apps/api/exportacoes/MANIFESTO.md`, commit `d35183c`) — Lista, Conjunto de Status e Definições de Campo via `list.json`/`fields.json`; as 19 Tarefas da Lista (`tasks/page-000.json`), com `time_in_status` disponível para todas (`timeInStatusDisponivel: true`) e 46 Comentários lidos por amostragem das Tarefas `868c61zje`, `868jxd42g`, `868e6j5zj`, `868hc5pyu`, `868jk43nw`, `868g2wt02`, `868jm5qnm`, `868jqwerp`. Código do `automation/` (commit de trabalho no momento da leitura, `financeiro-tria/automation/src/tenants/tria/`): `payment-rules.ts`, `clickup-payment-mapper.ts`, `payment-automation-service.ts`, `adapters/ai.ts` (classificador e prompts), `adapters/clickup.ts` (os 7 métodos do adapter), `http/routes.ts` (os 5 webhooks do tenant Tria).

**Lacunas respondidas pelo dono/Financeiro em 2026-09-17:** o dono deu uma diretriz geral em vez de responder cada `L-NN` isoladamente — (a) só os quatro Status hoje em uso em `list.json` são oficiais, o histórico de Status não entra; (b) o RESUMO DE PAGAMENTO funciona exatamente como no ClickUp hoje — Markdown publicado nos Comentários, lido ali, sem critério novo de aceite; (c) todo o resto deve ser definido "do mesmo jeito que está no ClickUp" — ou seja, derivado da exportação real e do código do `automation/`, nunca inventado. As lacunas que essa diretriz permitiu fechar por código estão resolvidas no corpo abaixo, sem marcador; o que nem a exportação nem o `automation/` sustentam continua em aberto na §12, agora sem o símbolo `⚠` (é uma decisão pendente, não uma pergunta ao dono sobre esta revisão).

---

## 1. O que o processo faz

Uma Solicitação de pagamento é **uma Tarefa** desta Lista. Ela nasce com fornecedor, documento (CPF/CNPJ), valor e forma de pagamento; o Agente do pipeline valida prazo e documento, audita o anexo (nota fiscal/comprovante) por IA, publica um comentário roteando para o Aprovador certo (por Centro de Custo e Valor), aguarda a resposta desse Aprovador no mesmo tópico, e — se aprovada — publica o mesmo formato de `📋 RESUMO DE PAGAMENTO` que `contas-a-pagar.md` §6.3 descreve. É este RESUMO que liga os dois processos (D6): a Solicitação termina aqui; o que acontece depois, na Lista "Contas a pagar", está descrito naquele outro documento — e o momento exato da passagem de uma para a outra é uma lacuna real (ver §2 e §12, L-01).

Cinco papéis participam:

| Papel | Quem é hoje | O que faz |
| --- | --- | --- |
| **Solicitante** | quem abre o pedido | Preenche fornecedor, documento, valor, forma de pagamento e o anexo (nota fiscal/comprovante) — ver §12 (L-06) sobre se é sempre um Membro ou também alguém sem conta no ClickUp |
| **Aprovador / "estrategista"** | Elifas (Finq; Presidência com Valor ≥ R$ 5.000); Fabíola (Presidência e TRIA com Valor < R$ 5.000); Thiago (Auton Health, Tria Tech, TRIA com Valor ≥ R$ 5.000); Iallas (Igor Alves, Roberth Resende) — roteado por Centro de Custo e Valor (`payment-rules.ts`, `APPROVAL_ROUTES`) | Recebe o comentário "Fulano, para aprovação" com Menção e responde no mesmo tópico aprovando ou reprovando |
| **Financeiro / "Contas a Pagar"** | Maryane Generozo | Acompanha as Solicitações, aciona o Fluxo Manual quando não passa pela automação, é a Responsável default de toda Tarefa nova |
| **Revisor do RESUMO** | Maryane Generozo, Liliane Peres (`DEFAULT_REVIEWER_IDS` do código da Tria) | Responde no tópico do RESUMO pedindo ajuste antes da liberação final (`revise_summary`) |
| **Agente do pipeline** | Usuário "ADM Tria Company" (`87328595`) — o mesmo Usuário que atua em Contas a pagar | Valida prazo e documento, audita o anexo, publica o comentário de roteamento e o RESUMO, muda o Status |

---

## 2. Estrutura

```text
Espaço "Gestão"
└── Pasta "Financeiro"
    ├── Lista "Solicitações de pagamento"   ← este documento (D-06)
    │   └── Tarefas do Tipo próprio da Lista (custom_item_id 3)
    └── Lista "Contas a pagar"              ← docs/07-processos/contas-a-pagar.md
```

- **D-06 (fecha D6 do plano):** a Solicitação vive numa **Lista própria**, "Solicitações de pagamento", ao lado de "Contas a pagar" na mesma Pasta "Financeiro" — não como Status iniciais da Lista de Contas. Os motivos observados: o Aprovador e o prazo da Solicitação são próprios (roteamento por Centro de Custo/Valor, prazo de dias 5, 15 e 25 — ver §6), e nem toda Conta a pagar nasce de uma Solicitação (Contas recorrentes, por exemplo, nascem direto na outra Lista, `contas-a-pagar.md` §7).
- **Tipo de Tarefa próprio** (`custom_item_id: 3`) em 18 das 19 Tarefas lidas — distinto do Tipo `Conta` (`custom_item_id: 1012`) usado em Contas a pagar. Uma única Tarefa (`868jqwerp`) está com o Tipo `Conta` em vez do Tipo próprio da Lista — inconsistência pontual de configuração, não um padrão.
- **Vínculo Solicitação → Conta a pagar (D-06):** o RESUMO publicado ao final da aprovação (§6.3, mesmo formato de `contas-a-pagar.md`) é o que carrega os dados de uma Lista para a outra hoje — via leitura humana e recriação manual, não por uma referência estruturada entre as duas Tarefas. Na plataforma, o Vínculo deve ser um campo de relação real (Solicitação → Conta a pagar), preenchido no momento em que a Conta nasce.
  Confirmado no código: nenhum dos 7 métodos do adapter (`adapters/clickup.ts`) cria ou move uma Tarefa entre Listas — `processManualPayment` (`payment-automation-service.ts`) só valida que a Tarefa recebida pertence a `CLICKUP_LIST_SOLICITACAO_PAGAMENTO_ID` **ou** `CLICKUP_LIST_CONTAS_PAGAR_ID` e opera na mesma Tarefa, nunca cria uma nova na outra Lista. O código também referencia nomes de Status que não existem no Conjunto atual desta Lista (`lançado omie`, `em lançamento omie`, `para pagar` — ver §3), sinal de que ele foi escrito pensando na Tarefa já do lado de Contas a pagar. Não é o `automation/` que faz a passagem — **isso não está automatizado**. Como e quando a Conta a pagar nasce, de fato, de uma Solicitação aprovada (recriação manual pelo Financeiro a partir do RESUMO, uma Automação nativa do ClickUp fora do `automation/`, ou outro mecanismo) é uma decisão que só o Financeiro pode confirmar — ver §12, L-01.
- A Lista não usa Subtarefas nem Checklists nas Tarefas lidas (`subtasks: null`, `checklists: []` em todas as amostradas).

---

## 3. Conjunto de Status

Definido na Lista. Quatro Definições de Status, nesta ordem:

| # | Status | Categoria (ClickUp) | Categoria na plataforma | Significado | Uso nas 19 Tarefas |
| --- | --- | --- | --- | --- | --- |
| 0 | `para fazer` | open | `não iniciado` | Solicitação criada, aguardando validação do Agente | 0 |
| 1 | `em aprovação` | custom | `em andamento` | Configurado para aguardar a resposta do Aprovador | 0 |
| 2 | `não aprovado` | done | `concluído` | Documento/anexo/valor rejeitado pelo Agente **ou** Aprovador respondeu negativamente | 18 |
| 3 | `aprovado` | closed | `fechado` | Aprovador respondeu positivamente; RESUMO publicado | 1 |

**Status inicial padrão:** `para fazer`.

`em revisão` — citado em `02-comparativo-com-a-plataforma.md` como um Status usado só pela Lista MP/FO (OQ-CMP-02) — **não aparece** no Conjunto de Status atual desta Lista (`list.json` lista exatamente os quatro acima) nem em uso em nenhuma das 19 Tarefas lidas. A resposta a OQ-CMP-02, pelo que esta exportação mostra: `em revisão` é específico da Lista MP/FO e não deve ser replicado no Conjunto de Status da Solicitação da Tria.

Note-se que **dois dos quatro Status configurados — `para fazer` e `em aprovação` — não aparecem em uso em nenhuma das 19 Tarefas lidas** (mesmo padrão de `contas-a-pagar.md` §12 com o status `aprovado` daquela Lista: configurado, mas não observado). O código do pipeline (`payment-automation-service.ts`) também nunca escreve `em aprovação` — ele passa de `para fazer` direto para `não aprovado` ou `aprovado`, usando o **comentário** de roteamento ("Fulano, para aprovação") como o sinal de que a Solicitação está aguardando aprovador, não uma mudança de Status.

O dono/Financeiro confirmou (2026-09-17): o Conjunto de Status oficial para a plataforma é exatamente o que está em uso hoje — os quatro Status de `list.json`, sem os dois não observados virarem lacuna. O histórico de um Status já ter sido diferente (evidência de `868e6j5zj`, abaixo) não entra na spec como uma decisão a tomar; `em aprovação` continua definido na Lista de origem, mas a plataforma não precisa replicar seu uso — o comentário de roteamento já cumpre esse papel (§6.3).

### Transições observadas no histórico

A API do ClickUp não expõe histórico cronológico de mudança de status (`00-RESEARCH.md`, Pitfall 1); as transições abaixo vêm de `time_in_status` (tempo acumulado por status, aproximado) e de Comentários datados das Tarefas citadas por id — não de uma trilha de auditoria completa.

```text
para fazer ──► não aprovado
para fazer ──► em aprovação ──► não aprovado
para fazer ──► aprovado
```

Evidências:

- Caminho direto ao aprovado: `868c61zje` — `para fazer` 1 min → `aprovado`. Sem nenhum Comentário; criada e fechada pelo mesmo agente automático (`ClickBot`) em 68 segundos. Um caso atípico entre as 19 Tarefas — não há evidência de um Aprovador humano neste caso específico.
- Rejeição depois de divergência do Agente: `868jxd42g` — o Agente comenta uma divergência de datas no documento, o Financeiro faz a Menção de roteamento ("@Iallas Oliveira para aprovação"), o Agente publica o RESUMO, e a Tarefa termina em `não aprovado` (`para fazer` 21h → `não aprovado`, onde está há mais de 100 dias). A ordem exata entre "RESUMO publicado" e "status virou não aprovado" para este caso específico não está clara nos dados (ver §12, L-03).
- Passagem por `em aprovação` que depois reprova: `868e6j5zj` — única Tarefa da amostra que passa por `em aprovação` (180 dias) antes de `não aprovado`; o histórico também registra uma passagem por um Status chamado **`aprovação head`**, que **não existe** no Conjunto de Status atual da Lista — evidência de que o Conjunto de Status já foi diferente do que é hoje. O dono confirmou que só o Conjunto atual é oficial para a plataforma; esse Status antigo não entra.
- Rejeição por resposta humana explícita: `868hc5pyu` — o Agente comenta a regra de prazo (citada literalmente em §6.1), depois roteia para Iallas Oliveira ("Iallas, Para aprovação"), que responde **"nao aprovado"** no próprio tópico; a Tarefa vai para `não aprovado` (`para fazer` 3h29 → `não aprovado`, onde está há mais de 220 dias).

**Não** modelar `não aprovado` como um estado exclusivamente terminal de "recusa definitiva": nos dados lidos ele também é usado para "precisa de correção e reenvio" (documento inválido, anexo ausente, auditoria reprovada — ver §6), sem nenhum campo que distinga os dois motivos.

---

## 4. Definições de Campo Personalizado

25 Definições (`fields.json`). Como em `contas-a-pagar.md`, o prefixo de letra no nome é a ordem de preenchimento no formulário e deve ser preservado como ordem de exibição, não como parte do rótulo.

### 4.1 Classificação (quem paga, para quê)

| Ordem | Rótulo | Tipo de Campo | Obrigatório | Opções | Uso nas 19 Tarefas |
| --- | --- | --- | --- | --- | --- |
| A | Centro de Custo | seleção única | **sim** (único obrigatório) | Marcos Paulo, Renato Cariani, Igor Alves, Kaka Diniz, PLX Apoio, TRIA, Anthony Miranda, Tria Tech, IVL, Roberth Resende, Presidência, USI, Konq, Auton Health, Kops, Inevitaveis | 19 — usados: Roberth Resende (5), Marcos Paulo (4), Igor Alves (3), TRIA (2), Tria Tech (2), Renato Cariani (2), PLX Apoio (1) |
| B | BU | seleção única | não | Roberth Resende, Igor Alves, CLAIRIS, Marcos Paulo, Instituto Visão Livre, Renato Cariani, TRIA - Apoio Funcional, Kaka Diniz, Iallas Oliveira, Tria Tech, Expert Lucrativo, KONQ, Auton Heath | 0 |
| C | Empresa | seleção única | não | Tria Company, Oliveira Participações, EXO Loteamento, EXO Participações, Loovi, PLX digital, IVL, USI, Konq Intermediações, O2, Inevitaveis | 18 — sempre "Tria Company" |
| D | Categoria de pagamento | seleção única | não | Distribuição de Lucro, Impostos, Prestação de Serviços, Móveis e Utensílios, Administrativo, Evento, Contas de consumo, A identificar, Cursos e treinamentos, Comissão, Tráfego Pago, Ferramentas, Insumos, Viagens e Hospedagens, Aporte, Aluguel, Tarifas, Ação Gente e Cultura, Devolução/Estorno de venda, Editora, Correios e Transportadora, Doação, Publicidade de Marca / Patrocínio, Salário | 17 — a mais usada é "Prestação de Serviços" (8) |
| Y | Produto | seleção múltipla | não | 63 opções (produtos de lançamento digital) | 0 — não usado em nenhuma Tarefa lida |

### 4.2 Fornecedor (a quem se paga)

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| E | Pessoa | pessoa (Membro ou Convidado, único) | 3 Tarefas — quando o fornecedor é interno (mesmo papel do Campo homônimo em Contas a pagar) |
| F | Fornecedor | seleção única: CPF, CNPJ | 15 Tarefas — CNPJ em 13, CPF em 2 |
| G | CNPJ | texto | 12 Tarefas |
| H | CPF | texto | 2 Tarefas |
| I | Nome do fornecedor | texto | 2 Tarefas — quando a Pessoa não está no Espaço de Trabalho |
| X | Nome do solicitante | texto | 15 Tarefas |
| Z | WhatsApp | telefone | 15 Tarefas |

### 4.3 Documento e datas

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| J | Anexo | arquivo | 18 Tarefas — a nota fiscal ou comprovante que o Agente audita (§6) |
| K | Data de Emissão | data | 15 Tarefas |
| L | Data Vencimento | data | 16 Tarefas — mesma duplicação com a Data de vencimento nativa observada em `contas-a-pagar.md` §12 |
| T | Valor | moeda BRL, 2 casas | 19 Tarefas — presente em todas |

### 4.4 Pagamento (como se paga)

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| M | Forma de pagamento | seleção única: Chave Pix, Boleto, QRCode Pix | 18 Tarefas — Chave Pix em 16, QRCode Pix em 2, **Boleto em nenhuma** |
| N | Chave pix | texto | 16 Tarefas |
| O | Código de barras | texto | 1 Tarefa |
| P | Pix copia e cola | texto | 0 |
| Q | Link de pagamento | **url** | 2 Tarefas |
| R | Boleto | arquivo | 0 |
| S | QR Code | arquivo | 0 |

O Campo de seleção `M-Forma de pagamento` **não tem `Cartão` como opção configurada** — só Chave Pix, Boleto e QRCode Pix (`fields.json`). O código do `automation/` (`payment-rules.ts`, `detectPaymentMethod`/`parsePaymentMethod`) sabe interpretar "cartão" a partir de texto livre e associa esse método ao Campo `Q-Link de pagamento` (`link_pagamento`). O Campo Q existe e foi usado 2 vezes nesta amostra (`868e6j5zj`, `868c61zje`) — mas nos dois casos a Forma de pagamento selecionada era "QRCode Pix", não "Cartão", e um dos dois links não parece ser um link de pagamento real.

Decisão (D-08, "do mesmo jeito que está no ClickUp"): como o código já suporta Cartão como método real — só ausente desta amostra de 19 Tarefas por raridade, não por não existir —, `Cartão` entra como quarta opção do Campo `M-Forma de pagamento` na plataforma, espelhando o que o `automation/` já reconhece.

### 4.5 Controle

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| U | Integração manual | seleção única: Manual | 0 — não usado em nenhuma das 19 Tarefas lidas |
| W | Equipe | moeda | 0 — mesmo padrão órfão observado em `contas-a-pagar.md` §12 (Campo herdado, vazio) |

O Campo `W-Equipe` fica na tabela de Campos exatamente como está hoje no ClickUp (D-08), sem uso registrado em nenhuma das 19 Tarefas — mesmo padrão órfão já visto em `contas-a-pagar.md` §12 para o Campo homônimo. Candidato a limpeza quando a Lista for arquivada; não é uma decisão pendente que bloqueie a spec.

Além dos Campos, a Tarefa usa os atributos nativos: **Nome** (descrição curta do pagamento), **Descrição** (às vezes concatena os mesmos dados dos Campos como texto livre — `clickup-payment-mapper.ts` trata isso explicitamente), **Data de vencimento**, **Responsável**, **Observadores** (Financeiro e o Agente, no mínimo) e **Tags**.

---

## 5. Tags

Só **uma** ocorrência de Tag em toda a amostra: `conta tria`, numa única Tarefa. Isso contrasta com as oito Tags de `contas-a-pagar.md` §5 (uma por conta bancária/empresa) — nesta Lista, o eixo de "de qual conta sai o dinheiro" parece não ser controlado por Tag na Solicitação; o código (`computeTaskTag`, `payment-rules.ts`) calcula essa mesma Tag a partir da Conta de pagamento resolvida (§9), mas só quando a Tarefa já está do lado de Contas a pagar. Não replicar as oito Tags de Contas a pagar nesta Lista sem confirmar o uso.

---

## 6. O fluxo, passo a passo

Descrito com a Tarefa `868jxd42g` (fio condutor principal) e `868hc5pyu`/`868e6j5zj`/`868jk43nw` como evidência complementar; datas em horário de Brasília.

### 6.1 Abertura

**868jxd42g** foi criada em 2026-01... — a Tarefa nasce com Centro de Custo, Empresa, Categoria, Fornecedor/CNPJ, Forma de pagamento + chave, Valor, Anexo, Nome do solicitante e WhatsApp preenchidos. Status inicial `para fazer`.

O Agente (`ADM Tria Company`) valida o prazo (`evaluateRequestDeadline`, `payment-rules.ts`): a Solicitação precisa ser criada com pelo menos **2 dias úteis** de antecedência do próximo dia de pagamento (dias **5, 15 e 25** do mês). Fora do prazo, o Agente comenta o texto observado literalmente na Tarefa `868hc5pyu`:

```text
Conforme alinhamento da diretoria, os pagamentos devem ser solicitados até 2 dias úteis
antes da próxima data de pagamento que acontecerá no dia 05/02/2026, ou seja, sua
solicitação será realocada para os pagamentos do dia [data seguinte da sequência].
```

Isso **não bloqueia** a criação — só desloca a previsão de pagamento para o ciclo seguinte (dia 5, 15 ou 25 mais adiante).

### 6.2 Validação de documento e anexo

O Agente detecta o tipo de documento pela contagem de dígitos (`detectDocumentType`): 11 dígitos = CPF (validado por dígito verificador, `isValidCpf`, sem consulta externa), 14 dígitos = CNPJ (consultado em `publica.cnpj.ws`, `adapters/public-apis.ts`) — essa validação **fica no `automation/`** (D-08): a spec só descreve onde roda, não a reimplementa. Documento ausente ou com contagem de dígitos inválida reprova a Tarefa (`não aprovado`) direto, sem chegar ao Aprovador.

Em seguida o Agente audita o Anexo (nota fiscal ou comprovante) por IA: extrai o total do documento e cruza com o Valor informado. Na Tarefa `868jxd42g`, essa auditoria encontrou uma divergência real e comentou:

> "Vencimento não encontrado no documento. Data de Emissão divergente (informado: [data]; documento: [data])."

Anexo ausente ou total do documento ilegível/divergente também reprova a Tarefa (`não aprovado`) nesta etapa, antes de rotear para o Aprovador.

O código distingue os dois caminhos que levam a `não aprovado` por onde estão implementados, não por um campo na Tarefa: a rejeição automática passa por um método comum (`rejectTask`, `payment-automation-service.ts`) chamado nos pontos de validação de prazo/documento/anexo, sempre com um Comentário explicando o motivo técnico da recusa; a rejeição por decisão humana sai do fluxo de aprovação por comentário (`classifyApproval`, `adapters/ai.ts`, chamado a partir do handler de comentário de aprovação), com o Comentário-resposta do próprio Aprovador como evidência. Os dois caminhos escrevem o mesmo Status (`não aprovado`) via `CLICKUP_STATUS_REPROVADO` — não há um valor de Status ou Campo que registre qual dos dois foi.

O que o código não explica: na Tarefa `868jxd42g`, a divergência de documento foi comentada e a Tarefa mesmo assim seguiu para o roteamento de aprovação — não reprovou de imediato pelo caminho automático, como a lógica de `rejectTask` sugere para outros casos. Se essa divergência foi ignorada por critério do Agente, se o Financeiro decidiu seguir mesmo assim, ou se há uma exceção de negócio não capturada nesta amostra de 19 Tarefas é uma decisão que só o Financeiro pode confirmar — ver §12, L-03.

### 6.3 Roteamento e aprovação

Passando pela validação, o Agente resolve o Aprovador certo por Centro de Custo e Valor (`resolveResponsible`, §11 RN-SP-03) e comenta, com Menção e o Aprovador como Assignee do comentário:

> "**Fulano, para aprovação**"

O Aprovador responde no mesmo tópico. Uma resposta só é aceita como decisão de aprovação quando vem **do próprio Aprovador designado** e é uma **resposta dentro do tópico de roteamento** (nunca um comentário raiz nem de outra pessoa — o código trata isso como correção de um bug anterior em que os próprios comentários automáticos da IA eram mal-interpretados como aprovação). A resposta é classificada por um classificador de texto (heurística + IA, `adapters/ai.ts`, `classifyApproval`) em **aprovado / reprovado / irrelevante** — categorias observadas por palavras como "aprov", "ok", "libera" (aprovado) versus "reprov", "não", "corrigir" (reprovado). É este classificador que hoje decide sozinho — não há, no código lido, nenhum mecanismo de aprovação **por clique** em funcionamento; esse é o caminho que a Fase 2 introduz (ver §8, D-07).

Evidência real: na Tarefa `868hc5pyu`, Iallas Oliveira respondeu literalmente **"nao aprovado"** no tópico — o classificador reconheceu a negativa e a Tarefa foi para `não aprovado`. Na Tarefa `868e6j5zj`, duas pessoas diferentes foram mencionadas em sequência ("@Petriv Junior para aprovação", depois "@Marcos Paulo para aprovação") antes da decisão final — um padrão de escalonamento entre aprovadores que os dados não explicam totalmente.

Se aprovada, o Status vai para `aprovado`. Se reprovada, vai para `não aprovado` e um Comentário avisa o Solicitante: "Sua solicitação foi reprovada, verifique o comentário do Especialista."

### 6.4 O RESUMO DE PAGAMENTO

Aprovada a Solicitação, o Agente resolve a Conta de pagamento e a Categoria contábil (mesmo mecanismo descrito em `contas-a-pagar.md` §6.3/§9: de-para por Centro de Custo, banco vetorial validado contra o Omie real) e publica o comentário no **mesmo formato exato**:

```text
📋 RESUMO DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que pagar:    [nome]
Centro de custo: [centro de custo]
Conta pagamento: [conta de pagamento resolvida]
Categoria:      [categoria]
Código:         [código do plano de contas]

📅 Vencimento:        [data]
📅 Previsão pagto:    [data]
💰 Valor:             [valor]

💳 Forma de pagamento:
  • [chave/código/link]

📝 Observações: [regra usada para inferir, se houver]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
[texto livre do Solicitante]
```

É este RESUMO — o mesmo contrato entre os dois sistemas descrito em `contas-a-pagar.md` §6.3 (CON-CP-08) — que, na hipótese de trabalho deste documento, é o gatilho para o nascimento da Conta a pagar (ver §2, L-01).

O Revisor do RESUMO (Financeiro, Liliane Peres) pode responder no tópico pedindo ajuste antes da liberação final (`revise_summary`); o Agente reprocessa a categoria e republica o RESUMO revisado.

Evidência de negociação fora do formato estruturado: na Tarefa `868jk43nw`, o Aprovador comentou em texto livre — "ACABEI DE APROVAR UMA DE [valor]", "TEM MAIS ESSA DE [valor]?" — antes de a Financeiro responder "vamos desconsiderar essa" para outra Tarefa relacionada. Esse tipo de negociação humana, fora do fluxo estruturado, não está descrito em nenhum comentário automatizado.

O dono/Financeiro confirmou (2026-09-17): o RESUMO funciona do mesmo jeito que já funciona no ClickUp — é aceito ou revisado exatamente como hoje, sem um critério novo de aceite a ser desenhado para a plataforma. A negociação em texto livre da Tarefa `868jk43nw` acima é o comportamento observado, não uma exceção a corrigir; a plataforma só precisa reproduzir o mecanismo técnico (`revise_summary`) e manter o tópico do RESUMO como o lugar onde essa negociação acontece.

### 6.5 Fluxo Manual

Quando o Campo `U-Integração manual = Manual` é selecionado (webhook `task-updated`), o pipeline **pula** as validações de prazo, documento e aprovação (Fluxos 1–3) e vai direto para resolver Conta/Fornecedor/Categoria e publicar o RESUMO, com `Aprovado = true` marcado diretamente pelo Financeiro. Nenhuma das 19 Tarefas lidas usou este caminho (0 usos do Campo `U`), mas o código está ativo e documentado como um bypass intencional, não um caso de borda.

### 6.6 O que os dados não mostram

Quem preenche o formulário de abertura: a exportação mostra `creator` de 6 das 19 Tarefas como `ClickBot` — o autor sintético que o ClickUp atribui a Tarefas nascidas de um Formulário, inclusive um Formulário público sem login — enquanto as outras 13 têm um Membro do Workspace identificado individualmente como `creator`. As duas vias coexistem hoje: um Formulário gera parte das Solicitações (confirmando a hipótese sugerida pelos Campos `X-Nome do solicitante`/`Z-WhatsApp`, que duplicam dados que um Membro já teria) e Membros abrem outras diretamente na Lista. A plataforma precisa suportar as duas entradas — um formulário aberto a quem não tem conta e a criação direta por um Membro.

Quando o Aprovador não responde ao comentário de roteamento: nenhum lembrete, cobrança repetida ou timeout foi encontrado no código (`payment-automation-service.ts`, `payment-rules.ts`) nem observado nas 19 Tarefas lidas — diferente das cobranças A5/A6 de nota fiscal em `contas-a-pagar.md`, que também não estão automatizadas mas pelo menos têm o texto e o intervalo documentados a partir de Comentários reais do Financeiro. Aqui não há nem o mecanismo automatizado nem evidência de uma segunda cobrança manual equivalente na amostra — se ela existe hoje, e com que texto e prazo, é uma decisão que só o Financeiro pode confirmar — ver §12, L-07.

---

## 7. Recorrência

Nenhuma evidência de recorrência nesta Lista: o código do `automation/` para esta Lista não cria novas Tarefas a partir de uma existente, e nenhuma das 19 Tarefas lidas tem nome ou padrão de data sugerindo ser cópia de outra. A Regra de Recorrência (Contas nascendo automaticamente todo mês) pertence à Lista "Contas a pagar" (`contas-a-pagar.md` §7) — uma Solicitação é, por natureza, um pedido pontual que termina no RESUMO (§6.4); a recorrência, se houver, nasce do lado de Contas a pagar depois que o Vínculo (§2) é estabelecido.

---

## 8. Automações a construir

Todas com escopo na Lista "Solicitações de pagamento", espelhando os passos já automatizados no `automation/` (D-08 — a plataforma absorve o que o pipeline já faz, sem reimplementar validação de documento):

| # | Gatilho | Condição | Ações |
| --- | --- | --- | --- |
| S1 | Tarefa criada | — | Validar prazo (dias 5, 15 e 25, com pelo menos 2 dias úteis de antecedência); se fora do prazo, comentar a realocação (§6.1) |
| S2 | Tarefa criada | Integração manual vazio | Validar documento (CPF por dígito; CNPJ via `publica.cnpj.ws`) — reprovar (`não aprovado`) e comentar se inválido |
| S3 | Documento validado | Anexo preenchido | Auditar o anexo por IA contra o Valor informado — reprovar e comentar se ausente/divergente/ilegível |
| S4 | Documento e anexo validados | — | **Solicitar Aprovação** (Automação `solicitarAprovacao`) do Aprovador resolvido por Centro de Custo e Valor (RN-SP-03) — o caminho oficial da plataforma (D-07) |
| S5 | Aprovador responde à Solicitação de Aprovação | Resposta = aprovar | Publicar o RESUMO DE PAGAMENTO (mesmo formato de `contas-a-pagar.md` §6.3); mudar Status para `aprovado` |
| S6 | Aprovador responde à Solicitação de Aprovação | Resposta = reprovar | Mudar Status para `não aprovado`; notificar o Solicitante |
| S7 | Integração manual = Manual | — | Pular S1–S6; ir direto para S5 marcando `Aprovado` pelo Financeiro (Fluxo Manual, §6.5) |
| S8 | Nenhuma resposta à Solicitação de Aprovação por 90 dias corridos, a contar do go-live da Fase 2 (D-07) | Classificador de comentário continua ativo como fallback | Registrar a métrica "aprovações por comentário / total de aprovações"; revisar se desligar o fallback na data de revisão (ver §12, L-09) |

**D-07 (fecha D8 do plano):** a aprovação **por clique** — a Solicitação de Aprovação nativa da plataforma — é o caminho oficial a partir da Fase 2 (S4/S5/S6). O classificador de comentário por IA (o que existe hoje, §6.3) continua ativo como **fallback por 90 dias**, medido pela métrica acima; se ninguém usar o caminho por comentário nesse período, ele é desligado. A data exata de revisão depende de quando a Fase 2 entra no ar — ver §12, L-09.

---

## 9. Agente de lançamento

O mesmo Usuário "ADM Tria Company" (`87328595`) que atua em `contas-a-pagar.md` §9 participa desta Lista, mas com um escopo diferente: aqui ele **valida e roteia** (S1–S6), não lança no Omie. Configuração equivalente:

- **Papel:** Convidado com `ver`, `comentar` e `editar` (só status) na Lista "Solicitações de pagamento". Nada fora dela.
- **Invocado por:** as Automações S1–S3 (validação) e S5 (publicação do RESUMO). Sem Gatilho próprio.
- **Entrada:** Centro de Custo, Fornecedor (CPF/CNPJ), Categoria de pagamento, Valor, Forma de pagamento e o Campo de pagamento correspondente, Anexo.
- **Conhecimento:** confirmado no código — é literalmente o **mesmo mecanismo** de `contas-a-pagar.md` §9, não uma cópia paralela: `resolveAccountConfig`, `resolveCategoryCodeAgainstOmie` e `automationStore.matchCategory` são as mesmas funções chamadas tanto pelo fluxo da Solicitação (`ensureSupplierAndCategory`, `selectAccount`) quanto pelo de Contas a pagar, dentro da mesma classe `PaymentAutomationService` do tenant Tria — (Centro de Custo) → Conta de pagamento; Categoria de pagamento → Categoria Omie + Código do plano de contas. Não há uma tabela de-para própria da Solicitação; a pendência é a mesma já registrada em `contas-a-pagar.md` §12 (a tabela não está em lugar que a API alcance) — não uma lacuna nova desta spec.
- **Ferramentas:** `criar comentário`, `alterar status`, consulta a `publica.cnpj.ws` (validação de CNPJ), auditoria de anexo por IA (extração de total e cruzamento de dados), classificador de aprovação por comentário (fallback, §8).
- **Saída:** o comentário de roteamento ("Fulano, para aprovação") e, se aprovado, o RESUMO no formato de `contas-a-pagar.md` §6.3. Se qualquer validação falhar, o Agente comenta o motivo, muda o Status para `não aprovado` e não chega a rotear para aprovação.
- **Nível de autonomia:** age sem aprovação humana para validar, comentar e mudar Status entre `para fazer` e `não aprovado`/`aprovado`; a decisão de aprovar em si é sempre humana (Aprovador designado) ou explicitamente delegada (Fluxo Manual).

---

## 10. Permissões

| Papel | Lista "Solicitações de pagamento" |
| --- | --- |
| Solicitante | `ver`, `criar`, `comentar` — só as próprias Solicitações (ver §12, L-06 sobre quem pode ser Solicitante) |
| Aprovador | `ver`, `comentar` — só as Solicitações roteadas para ele (por Centro de Custo/Valor) |
| Financeiro | `ver`, `criar`, `editar`, `comentar`, `excluir`, `administrar` |
| Revisor do RESUMO | `ver`, `comentar` nas Solicitações já aprovadas (tópico do RESUMO) |
| Agente do pipeline | Convidado conforme seção 9 |
| Demais Membros do Espaço de Trabalho | sem acesso (dados de fornecedor, documento e forma de pagamento) |
| Cliente | sem acesso |

Hoje no ClickUp o Aprovador e o Financeiro têm acesso pleno à Lista inteira (mesma observação de `contas-a-pagar.md` §10) — a restrição acima é a que o processo precisa, não a que ele tem.

---

## 11. Regras que a plataforma deve validar

- **RN-SP-01** — Centro de Custo é obrigatório na criação (único Campo obrigatório configurado hoje, igual ao padrão de `contas-a-pagar.md` RN-CP-01).
- **RN-SP-02** — O Documento deve ser coerente com o Fornecedor selecionado (CPF exige CPF preenchido e válido por dígito verificador; CNPJ exige CNPJ preenchido e validado contra `publica.cnpj.ws`) antes de a Solicitação avançar para aprovação.
- **RN-SP-03** — O Aprovador é resolvido por Centro de Custo e, quando o Centro de Custo é "Presidência" ou "TRIA", também pelo Valor: **Valor ≥ R$ 5.000** roteia para Elifas/Thiago; **Valor < R$ 5.000** roteia para Fabíola.
- **RN-SP-04** — A Solicitação deve ser criada com pelo menos 2 dias úteis de antecedência do próximo dia de pagamento (dias 5, 15 e 25 do mês); fora do prazo, a previsão de pagamento é realocada para o ciclo seguinte, sem bloquear a criação.
- **RN-SP-05** — Uma decisão de aprovação só é aceita quando vem do próprio Aprovador designado, em resposta dentro do tópico de roteamento — nunca de um comentário raiz nem de outra pessoa.
- **RN-SP-06** — O Anexo (nota fiscal ou comprovante) é obrigatório antes do roteamento para aprovação; o valor do documento deve ser coerente com o Valor informado.
- **RN-SP-07** — Aprovar publica o RESUMO DE PAGAMENTO (mesmo formato de `contas-a-pagar.md` §6.3) antes de qualquer passagem para Contas a pagar.
- **RN-SP-08** — Uma Solicitação com Integração manual = Manual pula as validações automáticas de prazo, documento, anexo e aprovação, e assume `Aprovado = true` diretamente pelo Financeiro.
- **INV-SP-01** — Uma Solicitação nunca chega a `aprovado` sem um Comentário de decisão do Aprovador designado dentro do tópico de roteamento, ou sem Integração manual = Manual.

---

## 12. O que não foi verificado e precisa de decisão

O dono/Financeiro respondeu à rodada de lacunas em 2026-09-17 (ver "Fonte dos dados"). Isso fechou L-02 e L-08 diretamente, e permitiu fechar L-04, L-05, L-06 e L-10 derivando a resposta da exportação e do código do `automation/` — cada um está resolvido no corpo do documento, sem marcador. O que segue abaixo é só o que nem a exportação nem o código sustentam, e que nenhuma das duas respostas do dono cobriu: são decisões pendentes, não perguntas endereçadas a ele nesta rodada.

- **L-01 — Momento em que a Conta a pagar nasce da Solicitação (§2).** Confirmado pelo código que **não é o `automation/`** que faz a passagem: nenhum dos 7 métodos do adapter cria ou move uma Tarefa entre Listas, e `processManualPayment` só aceita a Tarefa já estar numa das duas Listas — nunca cria uma nova. Como e quando a Conta a pagar nasce de fato (recriação manual pelo Financeiro a partir do RESUMO, uma Automação nativa do ClickUp fora do `automation/`, ou outro mecanismo) continua sem resposta.
- **L-03 — Critério humano por trás da divergência não bloqueante (§6.2).** O código distingue tecnicamente rejeição automática (`rejectTask`) de rejeição por decisão humana (`classifyApproval`), mas os dois escrevem o mesmo Status `não aprovado`, sem campo que registre qual foi. O que o código não explica: por que a divergência de documento comentada na Tarefa `868jxd42g` não bloqueou o roteamento para aprovação, como a lógica de `rejectTask` sugere para outros casos — ignorada por critério do Agente, decisão do Financeiro, ou exceção de negócio fora desta amostra de 19 Tarefas?
- **L-07 — Cobrança quando o Aprovador não responde (§6.6).** Nem o código nem as 19 Tarefas lidas mostram lembrete, cobrança repetida ou timeout — diferente de `contas-a-pagar.md`, onde A5/A6 pelo menos têm o texto e o intervalo documentados a partir de Comentários reais. Existe hoje uma segunda cobrança manual equivalente, e com que texto/prazo?
- **L-09 — Data de revisão do fallback do classificador (§8, D-07).** Os 90 dias contam a partir do go-live da Fase 2, que ainda não tem data; a data de revisão exata só pode ser calculada quando a Fase 2 entrar no ar.
- **L-11 — Papel "Revisor do RESUMO" (§1, §10) — candidata para o planejamento da Fase 2, não uma pergunta a responder agora.** O código da Tria fixa hoje dois ids como revisores permitidos via `CLICKUP_REVIEWER_IDS` (Financeiro e Liliane Peres); o catálogo de variáveis do de-para (`apps/api/src/importacao/clickup/de-para-usuarios.ts`) já lista essa variável, mas com `entraNoDePara: false` — ou seja, Liliane Peres é conhecida (aparece em `usuarios-vistos.json`) mas não vira Membro por este levantamento, porque a variável não é tratada como identidade a convidar. Mirando exatamente o que o ClickUp faz hoje: os dois ids fixos continuam sendo a regra até a Fase 2 decidir se "Revisor" vira um Papel oficial da plataforma ou se a substituição pessoal configurada no `automation/` é suficiente.
- **Item herdado do Plan 00-02 (não resolvido por esta spec):** o ClickUp user id `81581802` ("revisor FO", 559 ocorrências nas três Listas exportadas) continua sem e-mail real resolvido — não afeta este documento, mas bloqueia convidá-lo como Membro na importação (Fase 2/3).
