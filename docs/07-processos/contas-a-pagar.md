# Contas a pagar — processo do Financeiro

**O que este documento é:** a especificação do processo de contas a pagar que hoje roda no ClickUp (workspace `9011731314`, Lista `901107637383`) traduzida para as entidades da ontologia, de modo que o mesmo processo continue funcionando quando for replicado na plataforma. Tudo o que está aqui foi lido da configuração e do histórico reais da Lista em 2026-09-13; o que não pôde ser verificado está na seção 12, não no corpo.

**Fonte dos dados:** Lista, Conjunto de Status e Definições de Campo via API do ClickUp; 200 Tarefas (duas páginas de 100, ainda havia mais); histórico de status e Comentários das Tarefas `868k8tn50`, `868kn45zc`, `868kmrrt7`, `868kg61g8`, `868m05xzh`, `868m33vx5`, `868kn7nng`, `868m2wxvx`.

---

## 1. O que o processo faz

Cada conta a pagar é **uma Tarefa**. Ela nasce cerca de um mês antes do vencimento, coleta documento fiscal e dados bancários, é lançada no ERP (Omie), entra em remessa bancária, recebe autorização de quem assina o pagamento e é fechada como paga. Contas recorrentes (aluguel, folha de prestadores, impostos, ferramentas) renascem automaticamente para o mês seguinte no momento em que a atual é paga.

Quatro papéis participam:

| Papel | Quem é hoje | O que faz |
| --- | --- | --- |
| **Financeiro** | Maryane Generozo | Cria e mantém as Tarefas, cobra nota fiscal, gera a remessa, é Responsável em tudo que ainda não foi pago |
| **Aprovador / pagador** | Marcos Paulo (todas as contas); Walter Galvão Neto aprova contas Konq | Autoriza no banco, marca como pago; vira Responsável quando a conta entra em autorização |
| **Pessoa da conta** | O prestador ou colaborador a quem a conta se refere (ex.: Thiago Nascimento) | Emite a nota fiscal, anexa na Tarefa, preenche a data de emissão, responde "feito" |
| **Agente de lançamento** | Usuário "ADM Tria Company" (`87328595`) | Lê a Tarefa, publica o "Resumo de pagamento" com a classificação contábil e move para `lançado omie` |

---

## 2. Estrutura

```text
Espaço "Gestão"
└── Pasta "Financeiro"
    └── Lista "Contas a pagar"        ← única Lista do processo
        └── Tarefas do Tipo "Conta"
```

- **Tipo de Tarefa `Conta`** (no ClickUp, `custom_item_id: 1012`). Toda Tarefa da Lista é desse tipo. O Tipo existe para a plataforma apresentar a Tarefa como conta (valor e vencimento em destaque) e para a IA saber que "Tarefa" aqui significa "obrigação financeira".
- A Lista não tem Subtarefas, Checklists nem Dependências em uso (contagens zero em todas as Tarefas lidas). Não habilitar essas Funcionalidades na Lista.
- **Observadores** padrão de cada Tarefa: Financeiro, Aprovador, a Pessoa da conta e o Agente (Tarefa `868k8tn50`: 4 Observadores, exatamente esses).

---

## 3. Conjunto de Status

Definido na Lista. Oito Definições de Status, nesta ordem:

| # | Status | Categoria (ClickUp) | Categoria na plataforma | Significado |
| --- | --- | --- | --- | --- |
| 0 | `para pagar` | open | `não iniciado` | Conta registrada, aguardando documentação e/ou lançamento |
| 1 | `em lançamento omie` | custom | `em andamento` | Lançamento no ERP em curso (manual ou pelo Agente) |
| 2 | `lançado omie` | custom | `em andamento` | Existe no ERP; pronta para remessa |
| 3 | `em remessa bancária` | custom | `em andamento` | Arquivo de remessa gerado e enviado ao banco |
| 4 | `em autorização bancária` | custom | `em andamento` | Aguardando o Aprovador autorizar no banco |
| 5 | `aprovado` | done | `concluído` | Autorizado (ver 12 — nunca observado em uso) |
| 6 | `negado` | done | `concluído` | Aprovador recusou; a conta volta ao fluxo |
| 7 | `pago` | closed | `fechado` | Pagamento efetuado. Estado terminal; dispara a recorrência |

**Status inicial padrão:** `para pagar`.

### Transições observadas no histórico

```text
para pagar ──► lançado omie ──► em remessa bancária ──► em autorização bancária ──► pago
     │              ▲                                          │
     │              └──────────── negado ◄─────────────────────┘
     │
     └───────────────────────────────────────────────────────► em autorização bancária ──► pago
                                     (contas sem lançamento no ERP — ver 6.4)
```

Evidências:

- Caminho completo: `868k8tn50` — `para pagar` 29d → `lançado omie` 6h40 → `em remessa bancária` 1h18 → `em autorização bancária` 1d5h → `pago`.
- Negação e retorno: `868kg61g8` — `em autorização bancária` 32min → `negado` 19min → `lançado omie` (onde está há 19 dias).
- Pulo do ERP: `868m33vx5` — `para pagar` 17h → `em autorização bancária` 7h → `pago`. `868m05xzh` — `para pagar` 19min → `em autorização bancária`.
- Entrada direta em `lançado omie`: `868m2wxvx` e `868kn7nng` nunca passaram por `para pagar` (Tarefa recorrente criada já lançada — ver 7).

`em lançamento omie` aparece hoje em três Tarefas (condomínio e duas contas de energia, vencimento 2026-10-03), todas com Responsável Financeiro: é o estágio em que o Financeiro está lançando à mão.

**Não** modelar `negado` como terminal: a plataforma deve permitir voltar de `negado` para `lançado omie` (ou `para pagar`) sem apagar o histórico.

---

## 4. Definições de Campo Personalizado

24 Definições. O prefixo de letra no nome é a **ordem de preenchimento no formulário** e deve ser preservado como ordem de exibição, não como parte do rótulo. Seis são definidas no Espaço "Gestão" e herdadas (marcadas ★); as demais são da Lista.

### 4.1 Classificação (quem paga, para quê)

| Ordem | Rótulo | Tipo de Campo | Obrigatório | Opções |
| --- | --- | --- | --- | --- |
| A ★ | Centro de Custo | seleção única | **sim** (único obrigatório) | Marcos Paulo, Renato Cariani, Igor Alves, Kaka Diniz, PLX Apoio, TRIA, Anthony Miranda, Tria Tech, IVL, Roberth Resende, Presidência, USI, Konq, Auton Health, Kops, Inevitaveis |
| B ★ | BU | seleção única | não | Roberth Resende, Igor Alves, CLAIRIS, Marcos Paulo, Instituto Visão Livre, Renato Cariani, TRIA - Apoio Funcional, Kaka Diniz, Iallas Oliveira, Tria Tech, Expert Lucrativo, KONQ, Auton Heath |
| C ★ | Empresa | seleção única | não | Tria Company, Oliveira Participações, EXO Loteamento, EXO Participações, Loovi, PLX digital, IVL, USI, Konq Intermediações, O2, Inevitaveis |
| D | Categoria de pagamento | seleção única | não | Distribuição de Lucro, Impostos, Prestação de Serviços, Móveis e Utensílios, Administrativo, Evento, Contas de consumo, A identificar, Cursos e treinamentos, Comissão, Tráfego Pago, Ferramentas, Insumos, Viagens e Hospedagens, Aporte, Aluguel, Tarifas, Ação Gente e Cultura, Devolução/Estorno de venda, Editora, Correios e Transportadora, Doação, Publicidade de Marca / Patrocínio, Salário |
| Y ★ | Produto | seleção múltipla | não | 63 opções (produtos de lançamento digital). Herdado do Espaço; **não é usado** em nenhuma das Tarefas lidas |

### 4.2 Fornecedor (a quem se paga)

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| E | Pessoa | pessoa (Membro ou Convidado, único) | Quem emite a nota e recebe a cobrança. Preenchido quando o fornecedor é interno (prestador PJ/CPF que está no Espaço de Trabalho) |
| F | Fornecedor | seleção única: CPF, CNPJ | Define qual dos dois campos seguintes vale |
| G | CNPJ | texto | |
| H | CPF | texto | |
| I | Nome do fornecedor | texto | Quando a Pessoa não está no Espaço de Trabalho |
| X | Nome do solicitante | texto | Quem pediu a despesa |
| Z | WhatsApp | telefone | Contato do fornecedor |

### 4.3 Documento e datas

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| J | Anexo | arquivo | A nota fiscal (NFS-e em PDF). É o que a Pessoa da conta anexa |
| K | Data de Emissão | data | Data da nota; a Pessoa preenche junto com o Anexo |
| L | Data Vencimento | data | Duplica a Data de vencimento nativa da Tarefa (ver 12) |
| T | Valor | moeda BRL, 2 casas | Valor a pagar. Ex.: `12000`, `66267.5` |

### 4.4 Pagamento (como se paga)

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| M | Forma de pagamento | seleção única: Chave Pix, Boleto, QRCode Pix | Determina qual dos campos abaixo é exigido |
| N | Chave pix | texto | Quando M = Chave Pix. Frequentemente é o próprio CNPJ |
| O | Código de barras | texto | Quando M = Boleto |
| P | Pix copia e cola | texto | Quando M = QRCode Pix |
| R | Boleto | arquivo | Quando M = Boleto |
| S | QR Code | arquivo | Quando M = QRCode Pix |

### 4.5 Controle

| Ordem | Rótulo | Tipo de Campo | Uso |
| --- | --- | --- | --- |
| U ★ | Integração manual | seleção única: Manual | Marcado quando o lançamento no ERP **não** deve ser feito pelo Agente |
| W ★ | Equipe | moeda **USD** | Herdado do Espaço; vazio em todas as Tarefas lidas. Provável resíduo de outra Lista — não replicar (ver 12) |

Além dos Campos, a Tarefa usa os atributos nativos: **Nome** (nome do fornecedor ou da despesa, ex.: "Aluguel Sala Tria", "Thiago Pereira Da Silva Nascimento"), **Descrição** (uma linha: "Prestação de serviços", "Implantação da operação WhiteLabel Konq"), **Data de vencimento**, **Prioridade** (só `normal` ou vazia), **Responsável** (um), **Observadores** e **Tags**.

---

## 5. Tags

Uma Tag por Tarefa, com o padrão `conta <origem>`. Indica **de qual conta bancária / empresa sai o dinheiro**, e é o eixo principal de filtro do Financeiro:

`conta tria` · `conta konq` · `conta kops` · `conta roberth` · `conta auton` · `conta tf tria` · `conta arkline` · `conta inevitaveis`

Na plataforma as Tags são do Espaço de Trabalho (constituição, B "mesmo universo de dados"); criar essas oito e restringi-las a Tarefas.

---

## 6. O fluxo, passo a passo

Descrito com a Tarefa `868k8tn50` (Thiago, R$ 12.000, vencimento 2026-08-05) como fio condutor; datas em horário de Brasília.

### 6.1 Abertura (D-30)

**2026-07-06** — a Tarefa é criada (pela recorrência do mês anterior, ver 7; contas novas são criadas pelo Financeiro à mão) com: Nome, Descrição, Tag, Centro de Custo, BU, Empresa, Categoria, Pessoa, Fornecedor/CNPJ, Forma de pagamento + chave, Valor, Data de vencimento. Status `para pagar`, Responsável **Financeiro**.

### 6.2 Cobrança da nota fiscal (D-5 a D-2)

**2026-07-31** — o Financeiro comenta com Menção à Pessoa: *"por favor emitir sua nota para o CNPJ 60.076.256/0001-04. Lembrar de anexar a nota no campo anexo e atualizar o campo data de emissão"*. Se não houver resposta, repete a cobrança (**2026-08-03**: *"anexar sua nota ainda hoje"*).

**2026-08-03** — a Pessoa anexa `NFS-e_21_03_08_2026.pdf` no campo Anexo, preenche Data de Emissão e comenta *"feito"*.

A mesma cobrança ocorre para fornecedores externos por e-mail mencionado no Comentário (`868kmrrt7`: `@joaosilva@konq.com.br por favor emitir sua nota para o CNPJ 66.448.849/0001-64`).

### 6.3 Lançamento no ERP (D-1)

**O que o histórico do ClickUp mostra.** **2026-08-04 22:47** — o Agente publica o Comentário "Resumo de pagamento", **atribuído ao Financeiro** e já **resolvido**:

```text
📋 RESUMO DE PAGAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que pagar:    Thiago Pereira Da Silva Nascimento
Centro de custo: Tria Tech
Conta pagamento: TRIA
Categoria:      Prestação serviços - ADM
Código:         2.04.08

📅 Vencimento:        05/08/2026
📅 Previsão pagto:    05/08/2026
💰 Valor:             R$ 12.000,00

💳 Forma de pagamento:
  • Tipo: Chave Pix: 57.587.467/0001-05

📝 Observações: Conta de Pagamento mantida como "TRIA" conforme similaridade
textual e mapeamento por Centro de Custo "Tria Tech". Código da categoria
atualizado conforme código sugerido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O que é e como será utilizado. Caso hajam parcelas, especifique aqui:
Prestação de serviços
```

**22:48** (53 segundos depois) — status vai para `lançado omie`. O Agente é quem move.

O Resumo contém três informações que **não existem nos Campos** e são derivadas pelo Agente: **Conta pagamento** (conta bancária do ERP, inferida do Centro de Custo e da Tag), **Categoria** no vocabulário do ERP ("Prestação serviços - ADM") e **Código** do plano de contas (`2.04.08`). O texto de "Observações" registra a regra usada para inferir. Ou seja: o Agente faz o de-para ClickUp → Omie e deixa a justificativa auditável no Comentário.

Os 53 segundos entre o Resumo e o `lançado omie` enganam: a leitura do `financeiro-tria/automation` (`docs/08-migracao-financeiro/10-levantamento-fluxo-atual-x-documentacao-x-backend.md`, Fluxos 5–7) mostrou que o Resumo do legado nasce **antes** do lançamento, aberto ao Financeiro "para conferência final", e só é lançado depois de o Financeiro mover a conta para `em lançamento omie`. É esse o fluxo que a plataforma reproduz.

**O que a plataforma faz (Fase 6, `docs/08-migracao-financeiro/09-plano-conferencia-do-resumo-e-anexos.md`).** A ponte do `apps/api` (`apps/api/src/automacoes/invocar-agente.ts`) trabalha em dois momentos, e entre eles fica a **Conferência** do Financeiro:

1. **Resumo para conferência (Fluxo 5).** Assim que a conta está completa (`erpMissingFields` vazio) em `para pagar` ou em `em lançamento omie`, o Agente chama `/resolver` e publica o `📋 RESUMO DE PAGAMENTO` no tópico da conta. O bloco é o mesmo, byte a byte (CON-CP-08), e vai **aberto**, mencionando o Financeiro, seguido de `{Financeiro}, confira: responda "ok" para eu lançar, ou diga o que ajustar.` Junto, o Agente abre uma **Conferência**: uma Aprovação de processo (`origin.processStep = "resumo"`) que guarda como dado a conta, a categoria e o código do Resumo, e a impressão dos dados da conta que entram no lançamento (`impressaoDeLancamento`). A Conferência não muda o Status. Com `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE=em-lancamento-omie`, o Resumo só aparece quando a conta entra em `em lançamento omie`.
2. **Conferência ou ajuste (Fluxo 6).** O Financeiro confere pelo botão **"Conferido, pode lançar"** do card "Conferência do Resumo", na conta ou na fila `/ia/aprovacoes` (o caminho oficial), ou respondendo **"ok"** no fio do Resumo. O "ok" é reconhecido pela heurística do legado, sem IA; `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false` faz só o clique conferir. A resposta canônica `✅ Resumo conferido por {nome}` entra no fio, e o fio é resolvido.
   Qualquer outra resposta de um revisor no fio é **pedido de ajuste**; pergunta ("?"), "aguardando" e "vou verificar" são ignoradas. Pelo card, "Pedir ajuste" exige o motivo. O Agente registra `🔁 Ajuste pedido por {nome}: {motivo}` e chama `/resolver` de novo com o pedido. Se o pedido cita um código do plano de contas ("use 2.02.98"), esse código é validado no plano de contas real, sem perguntar ao RAG. Depois o Agente publica o **Resumo revisado no mesmo fio**, com `Revisado a pedido de {nome}: "{pedido}".` e uma Conferência nova.
   Se um Campo que entra no lançamento muda depois da conferência, a Conferência fica desatualizada. O Agente republica o Resumo no fio com `Os dados da conta mudaram depois da conferência.`
   Quem confere: o Financeiro (quando Membro ativo) e Membros de Papel Administrador ou Proprietário que alcançam a conta (`revisoresDoResumo`).
   A ponte só lê **respostas** ao Resumo, nunca um Comentário raiz. O tópico da tela ainda não tem o gesto "Responder"; por isso, na tela de hoje, conferir e pedir ajuste é pelo card.
3. **Lançamento (Fluxo 7).** A ponte só chama `/lancar` quando duas condições valem. A conta tem de ter **entrado** em `em lançamento omie` por movimento, e a Conferência tem de estar aprovada **para os dados atuais**.
   O `/lancar` leva o código de Categoria conferido (`codigoCategoriaConfirmado`), a Data de Emissão e os **anexos**. Os anexos são os Campos Anexo, Boleto e QR Code e os anexos da Tarefa, em URLs assinadas de 5 minutos com o nome original. O Omie recebe o título, e os anexos entram um a um (`IncluirAnexo`).
   O Agente confirma no fio com `✅ Lançado no Omie — título {id} · {conta} · {categoria} ({código}) · anexos {ok} de {total}` e uma linha `• {nome}: não subiu ({erro})` por anexo que falhou. Depois move a conta para `lançado omie`.
   Sem Conferência aprovada, nada vai ao Omie: o próprio Resumo pendente é o pedido.
4. **Falha permanente** (o Omie recusa): o Agente comenta `Não consegui lançar no Omie: {motivo} ({código}). A conta voltou para "para pagar".` e a conta **volta** para `para pagar`, como no legado (D6-03). Mover de novo para `em lançamento omie` reprocessa. Uma falha transitória é tentada de novo nos ciclos seguintes.

Três modos, por `AGENTE_CONTAS_A_PAGAR_MODO`, só com os literais exatos:
- `ensaio` (padrão): nada é gravado; a ponte só registra no log o que publicaria.
- `conferencia`: Resumos, Conferências e revisões de verdade, e **zero** requisições a `/lancar`. Com a conta conferida em `em lançamento omie`, o Agente avisa uma vez `Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência): nada foi lançado, a conta fica aqui.`
- `lancar`: tudo.

Qualquer outro valor cai em `ensaio`, com aviso no log.

Uma gravação na conta (Campo, Status, Comentário, decisão da Conferência) cutuca a ponte, que roda um ciclo em até 2 s; o ciclo por intervalo continua.

A conta importada do ClickUp só entra na ponte depois de ser movida de Status na plataforma (`movidaDepoisDaImportacao`): o legado importado nunca é varrido.

Na tela, o estado da Conferência aparece como pílula ao lado do Status, sem abrir o fio: "Aguardando Resumo", "Resumo para conferir", "Resumo conferido", "Ajuste pedido" e "Resumo desatualizado".

Quando `Integração manual = Manual`, o padrão da plataforma é "o Agente não encosta": sem Resumo e sem `/lancar`. O Financeiro lança à mão e registra pelo diálogo "Lançado no Omie" (D6-04, `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=nao-encosta`). A outra leitura, a do backend legado, é `sem-conferencia`: o Resumo sai com a Conferência dispensada e a conta é lançada ao entrar em `em lançamento omie`.

Fora do `/lancar` por enquanto: Cartão e Link de pagamento, o Departamento Omie no Resumo e o número da NF (fica vazio; o Omie aceita).

### 6.4 Remessa e autorização (D0)

**2026-08-05 05:29** — Financeiro gera o arquivo de remessa no banco e move para `em remessa bancária`.
**06:47** — move para `em autorização bancária` e **troca o Responsável para o Aprovador** (todas as Tarefas nesse status e em `pago` têm Responsável Marcos Paulo; todas as anteriores, Maryane).

Contas pequenas ou urgentes pulam o ERP e a remessa: vão de `para pagar` direto para `em autorização bancária` (`868m33vx5` "Recarga Clara", `868m05xzh` "White Label - BR Consórcio", R$ 20.000). O Aprovador pode registrar a decisão em Comentário (*"Aprovado!"*, Walter Galvão Neto em `868kmrrt7`) ou mover para `negado`.

### 6.5 Pagamento (D0 a D+1)

**2026-08-06 11:44** — Aprovador move para `pago`. É o único status `fechado`; `date_closed` fica gravado.

O pagamento é feito **em lote**: em 2026-09-08 11:58:06, 61 Tarefas com vencimento 2026-09-04 foram fechadas no mesmo segundo (`date_closed: 1788879486552`). A plataforma precisa de **seleção múltipla + mudança de status em lote** na Lista.

---

## 7. Recorrência

A observação mais importante para o processo continuar funcionando: **quando uma conta vai para `pago`, uma cópia para o mês seguinte é criada imediatamente.**

Evidência: "Aluguel Sala Tria" `868kn7nng` (vencimento 2026-09-04) fechada em 2026-09-08 11:58:06; `868m2wxvx` (mesmo nome, vencimento 2026-10-03) criada em 2026-09-08 11:58:10 — quatro segundos depois. As cópias com vencimento 2026-10-05 lidas na primeira página correspondem, nome a nome, às Tarefas fechadas nesse lote de 61.

A cópia:

- mantém Nome, Descrição, Tag, Prioridade, todos os Campos de classificação, fornecedor e pagamento, e o **Valor**;
- **não** copia Anexo nem Data de Emissão (a nota do mês seguinte ainda não existe) — `868m2wxvx` está com ambos vazios;
- Data de vencimento = mesmo dia do mês seguinte, ajustada para o **dia útil anterior** quando cai em fim de semana (05/08 qua → 04/09 sex, porque 05/09 é sábado → 05/10 seg);
- Responsável volta a ser o **Financeiro**;
- status inicial é `para pagar` (todas as cópias lidas, salvo uma) — exceto quando o Financeiro já lança em seguida (`868m2wxvx` nasceu em `lançado omie`).

Na ontologia isso é a **Regra de Recorrência** da Tarefa (B6), com gatilho "ao entrar em status `fechado`", não "em data fixa". Contas avulsas (caução, enxoval, reembolso de viagem) não têm Regra de Recorrência: são criadas e morrem em `pago`.

Vencimentos observados agrupam-se por natureza: folha de prestadores e aluguel no dia 4-5; impostos, comissões e ferramentas no dia 24-25; contas de consumo (energia, condomínio) no dia 3.

---

## 8. Automações a construir

Todas com escopo na Lista "Contas a pagar".

| # | Gatilho | Condição | Ações |
| --- | --- | --- | --- |
| A1 | Tarefa entra em `pago` | Tarefa tem Regra de Recorrência | Criar nova ocorrência conforme seção 7 |
| A2 | Tarefa entra em `pago` | — | Gravar data de fechamento; remover o Financeiro de Responsável se ainda estiver |
| A3 | Tarefa entra em `em autorização bancária` | — | Trocar Responsável: Financeiro → Aprovador |
| A4 | Tarefa sai de `em autorização bancária` para `negado` | — | Notificar Financeiro; Responsável volta ao Financeiro |
| A5 | Data de vencimento − 5 dias | status = `para pagar` **e** Anexo vazio **e** Pessoa preenchida | Comentar com Menção à Pessoa pedindo a nota (texto da seção 6.2, com o CNPJ da Empresa) |
| A6 | Data de vencimento − 2 dias | status = `para pagar` **e** Anexo vazio | Repetir cobrança |
| A7 | ~~Data de vencimento − 1 dia (noite)~~ — **removida** (plano pós-auditoria, 1.5). Hoje: **1º momento da ponte** — conta completa em `para pagar` ou `em lançamento omie` | `erpMissingFields` vazio; conta criada ou movida na plataforma (nunca o legado importado parado); `Integração manual` ≠ Manual | Publicar o Resumo aberto, mencionando o Financeiro, e abrir a Conferência (§6.3, passo 1). Um pedido de ajuste no fio ou no card republica o Resumo revisado no mesmo fio (passo 2). Em `ws_n1` a Automação A7 fica pausada (`npm run contas-a-pagar:configurar -w @n1/api`); quem faz o trabalho dela é a ponte do `apps/api`. |
| A8 | **2º momento da ponte** — a conta **entra** em `em lançamento omie` por movimento | Conferência aprovada para os dados atuais; modo `lancar` | `/lancar` com o código conferido e os anexos; confirmação `✅ Lançado no Omie — …` no fio; mover para `lançado omie`. Na falha permanente, o motivo no fio e a volta para `para pagar` (§6.3, passos 3 e 4). |

**Os dois momentos da ponte, e o que muda cada um sem código.** A7 e A8 não são Automações do Espaço: são a ponte do `apps/api` (`apps/api/src/automacoes/invocar-agente.ts`), ligada por `AGENTE_CONTAS_A_PAGAR_ATIVO=true`. As decisões D6-01..D6-04 da Fase 6 têm um padrão, que segue o ClickUp exceto onde isso seria inseguro. Trocar um padrão é mudar a variável:

| Variável | Padrão | Alternativa |
| --- | --- | --- |
| `AGENTE_CONTAS_A_PAGAR_MODO` | `ensaio` (nada gravado) | `conferencia` (Resumos e Conferências, zero `/lancar`) · `lancar` |
| `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` (D6-01) | `para-pagar` — o Resumo sai assim que a conta fica completa | `em-lancamento-omie` — só ao entrar em `em lançamento omie` |
| `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` (D6-02) | `true` — "ok" no fio confere | `false` — só o clique confere; o fio continua pedindo ajuste |
| `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` (D6-04) | `nao-encosta` — sem Resumo, sem `/lancar` | `sem-conferencia` — Resumo com a Conferência dispensada, e lançamento |
| (D6-03, sem variável) | falha permanente devolve a conta a `para pagar` | ficar em `em lançamento omie` — uma chamada em `registrarFalhaDoLancamento` |

`AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM` e `AGENTE_CONTAS_A_PAGAR_AVISAR_ID` são portas **só de ambiente de teste**. A primeira restringe a ponte às contas cujo título contém o texto; a segunda manda toda Menção da ponte a um Membro no lugar do Financeiro. Em produção ficam vazias. A linha de partida do log diz o que está valendo: `ponte do Agente de lançamento ativa (modo=… resumoAPartirDe=… conferenciaPorComentario=… integracaoManual=… escopo=… avisar=…)`.
| A9 | Tarefa criada | — | Adicionar Observadores: Financeiro, Aprovador, Pessoa (se preenchida) |

A5 e A6 são hoje feitas à mão pelo Financeiro (Comentários de Maryane). Automatizá-las é a única mudança de comportamento proposta neste documento; o texto e os momentos são os observados.

---

## 9. Agente de lançamento

Substitui o usuário "ADM Tria Company". Configuração mínima:

- **Papel:** Convidado com `ver`, `comentar` e `editar` (só status) na Lista "Contas a pagar". Nada fora dela.
- **Invocado por:** a ponte do `apps/api` (`apps/api/src/automacoes/invocar-agente.ts`), em dois momentos (§8, A7/A8): quando a conta fica completa, para publicar o Resumo para conferência; e quando a conta entra em `em lançamento omie` com a Conferência aprovada, para lançar. A ponte roda por intervalo e é cutucada por toda gravação na conta. Até o plano pós-auditoria (1.5), a invocação era pela Automação A7. Sem Gatilho próprio (Agente nunca tem Gatilho — Glossário).
- **Entrada:** Nome, Descrição, Tag, Centro de Custo, Empresa, Categoria de pagamento, Fornecedor (CPF/CNPJ), Forma de pagamento e o campo de pagamento correspondente, Valor, Data de vencimento, Data de Emissão. Mais: os anexos da conta (Campos Anexo, Boleto e QR Code e os anexos da Tarefa, em URLs assinadas com o nome original) e as respostas dos revisores no fio do Resumo. As respostas viram pedido de ajuste para o `/resolver` (`pedidoDeRevisao`, e o código citado como `codigoCategoriaConfirmado`). No lançamento, a entrada é a Conferência aprovada: a tripla conta · categoria · código sai dela, como dado, e nunca é relida do texto do Resumo.
- **Conhecimento:** o de-para para o ERP — (Centro de Custo, Tag) → Conta de pagamento; Categoria de pagamento → Categoria Omie + Código do plano de contas (ex.: Prestação de Serviços + Centro de Custo Tria Tech → "Prestação serviços - ADM", `2.04.08`). Esse mapeamento **não está no ClickUp**; está na cabeça do Agente atual e precisa ser extraído para uma Coleção de Conhecimento antes da migração (ver 12).
- **Ferramentas:** `criar comentário`, `alterar status`, e a Integração com o Omie (lançar conta a pagar). A Integração é do Espaço de Trabalho (Glossário: Integração), com Membro configurador.
- **Saída:** no 1º momento, o Resumo no formato exato da seção 6.3, **aberto**, mencionando o Financeiro, com a chamada para conferir, e uma Conferência pendente. A cada ajuste, o Resumo revisado no mesmo fio e uma Conferência nova. No 2º momento, o título no Omie com os anexos, a confirmação `✅ Lançado no Omie — …` no fio e o Status `lançado omie`. Na falha permanente, o motivo no fio e a volta para `para pagar`. Se qualquer campo obrigatório para o ERP faltar, o Agente comenta o que falta e **não** muda o Status.
- **Nível de autonomia:** comenta, publica o Resumo e abre Conferências sem aprovação. O lançamento no Omie **só acontece sobre uma Conferência aprovada por um humano para os dados atuais** (RN-CP-08); essa é a Política de aprovação do lançamento. O Ensaio é o modo `ensaio` da ponte, e o modo `conferencia` roda o fluxo inteiro sem lançar. A recomendação para a entrada em produção é começar em `conferencia` e passar a `lancar` depois de ver os Resumos certos (roteiro, `08-roteiro-de-producao-pos-correcoes.md`).

---

## 10. Permissões

| Papel | Lista "Contas a pagar" |
| --- | --- |
| Financeiro | `ver`, `criar`, `editar`, `comentar`, `excluir`, `administrar` (edita Definições de Campo e Conjunto de Status) |
| Aprovador | `ver`, `editar` (status e Responsável), `comentar` |
| Pessoa da conta | Convidado: `ver` **só as Tarefas em que é o valor do campo Pessoa**, `comentar`, `editar` restrito aos campos **Anexo** e **Data de Emissão** |
| Agente de lançamento | Convidado conforme seção 9 |
| Demais Membros do Espaço de Trabalho | sem acesso (dados bancários e CPF de terceiros) |

Hoje no ClickUp a Pessoa da conta é Membro pleno e vê a Lista inteira — inclusive chaves Pix e valores dos colegas. A restrição acima é a que o processo precisa, não a que ele tem.

---

## 11. Regras que a plataforma deve validar

- **RN-CP-01** — Centro de Custo é obrigatório na criação (única obrigatoriedade configurada hoje).
- **RN-CP-02** — Sair de `para pagar` exige Valor, Data de vencimento, Forma de pagamento e o dado de pagamento coerente com ela (Chave pix / Código de barras + Boleto / Pix copia e cola + QR Code). Hoje isso é conferido pelo Agente; deve ser Requisito de saída do status.
  Desde o plano pós-auditoria (`docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 2.1), também **Categoria de pagamento**, **Fornecedor** e **Nome do fornecedor**: é o que o lançamento no Omie usa para achar ou cadastrar o fornecedor e classificar a conta. A lista é a mesma de `erpMissingFields` (`packages/dominio/src/operations/financeiro.ts`) — a tela que recusa mover e o Agente que recusa lançar dizem a mesma coisa.
- **RN-CP-03** — Fornecedor = CPF exige CPF preenchido; = CNPJ exige CNPJ preenchido (Requisito de saída de `para pagar`, condicional ao tipo).
- **RN-CP-04** — Entrar em `em autorização bancária` troca o Responsável para o Aprovador (A3). Entrar em `pago` só é permitido ao Aprovador.
- **RN-CP-05** — `pago` é o único status `fechado`. `aprovado` e `negado` são `concluído` e não disparam recorrência.
- **RN-CP-06** — Uma Tarefa recorrente gera **uma** ocorrência por fechamento; fechar duas vezes (reabrir e fechar) não duplica.
- **RN-CP-07** — Exatamente uma Tag `conta *` por Tarefa.
- **INV-CP-01** — Toda Tarefa em `lançado omie` ou posterior tem um Comentário "Resumo de pagamento" ou `Integração manual = Manual`.
- **RN-CP-08** — Nenhuma conta é lançada pelo Agente sem Conferência aprovada para os dados atuais. "Dados atuais" é a impressão de lançamento (`impressaoDeLancamento`): Centro de Custo, Empresa, Categoria, fornecedor, forma e dado de pagamento, Valor, vencimento, Data de Emissão, Tag, título e descrição. Anexos não entram. Mudou um desses depois da conferência: a Conferência fica desatualizada e o Resumo é republicado para conferir de novo (Fase 6, `registrarLancamentoNoOmie` e a ponte).
- **RN-CP-09** — Falha permanente no lançamento devolve a conta a `para pagar` com o motivo num Comentário do Agente (D6-03, `registrarFalhaDoLancamento`). Se a conta não pôde voltar, o Comentário diz o motivo sem afirmar a volta.

---

## 12. O que não foi verificado e precisa de decisão

- **Status `aprovado`** — configurado, mas nenhuma das 200 Tarefas lidas o usa; aprovação vai direto para `pago`. Decidir se entra na plataforma ou se o Conjunto fica com sete.
- **Campos `Data Vencimento` (L) e Data de vencimento nativa** — duplicados; nas Tarefas lidas têm o mesmo valor. Manter só o nativo e migrar L para ele.
- **`Equipe` (W, USD) e `Produto` (Y)** — herdados do Espaço, vazios em toda a Lista. Não replicar na Lista; se o Espaço "Gestão" da plataforma os definir, ocultá-los aqui.
- **De-para ERP** — a tabela (Centro de Custo, Tag, Categoria) → (Conta de pagamento, Categoria Omie, Código) não está em lugar nenhum que a API alcance. Precisa ser exportada do Omie ou ditada pelo Financeiro antes de o Agente funcionar.
- **Quem gera a remessa e como** — o histórico mostra o Financeiro movendo o status; não mostra se o arquivo CNAB sai do Omie ou do banco. Não afeta a plataforma, afeta a Integração.
- **Ordem exata da recorrência** — a regra "mesmo dia, dia útil anterior" foi inferida de três vencimentos consecutivos de uma Tarefa (05/08 → 04/09 → 05/10). Confirmar com o Financeiro antes de codificar.
- **Volume** — mais de 200 Tarefas ativas + histórico; a migração precisa de paginação e de manter `date_created`, `date_closed` e o histórico de status (o "tempo em status" é usado como métrica: 29-31 dias em `para pagar` é o ciclo normal).
