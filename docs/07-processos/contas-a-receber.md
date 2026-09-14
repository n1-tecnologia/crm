# Contas a receber — processo do Financeiro

**O que este documento é:** a especificação do processo de contas a receber que roda no ClickUp (workspace `9011731314`, Lista `901107648977`) traduzida para as entidades da ontologia, para que o processo continue funcionando quando for replicado na plataforma. Companheiro de [contas-a-pagar.md](contas-a-pagar.md); o que os dois compartilham (Espaço, Pasta, campos herdados, papéis) está descrito uma vez lá e só referenciado aqui.

**Fonte dos dados:** Lista, Conjunto de Status e Definições de Campo via API do ClickUp; as **240 Tarefas** da Lista (três páginas, `has_more: false` na última); histórico de status de 10 Tarefas; Comentários e threads das Tarefas `868cpdawp`, `868c88m6m`, `868cpd8yk`, `868f9b1e3`; o registro de cliente `868cphxe6` na Lista "Gestão de clientes". Leitura em 2026-09-14.

**Aviso antes de tudo:** a Lista está **dormente**. A Tarefa mais recente foi criada em 2025-09-16 (`868fktdp6`), o último recebimento registrado é de 2025-10-28 (`868c7qfr8`) e a última mudança de status é de 2026-03-18 (`868c7pmn9` → `descartado`). Contas a pagar, na mesma Pasta, tem lançamentos de setembro de 2026. Ou o recebimento migrou para outra ferramenta, ou parou de ser registrado. O processo descrito abaixo é o que **funcionava entre janeiro e outubro de 2025**; a seção 12 diz o que confirmar antes de replicar.

---

## 1. O que o processo faz

Cada valor a receber de um cliente é **uma Tarefa**: a entrada e cada parcela de um contrato viram Tarefas separadas, todas criadas de uma vez na assinatura, vinculadas ao registro do cliente no CRM. O Financeiro acompanha o vencimento; quando o cliente paga, marca `recebido` e registra a data; quando atrasa, a conta vai para `pendente`, ganha a Tag `em cobrança` e começa uma sequência de cobranças por WhatsApp registrada na própria Tarefa, com escalonamento para o Comercial e para a diretoria. Contas que não serão mais cobradas (inadimplência consolidada, contrato cancelado ou renegociado) são `descartado`.

Também entram na Lista os **saques de plataformas de pagamento** ("Saque TMB", "Saque Xgrow Cariani"): dinheiro já vendido que o Financeiro precisa puxar da plataforma para a conta da empresa.

| Papel | Quem é hoje | O que faz |
| --- | --- | --- |
| **Financeiro** | Maryane Generozo (Responsável em 216 das 240 Tarefas; Isadora nas 23 restantes); Isadora criou as Tarefas de 2025 e conduziu as cobranças | Cria entrada e parcelas, marca recebimento, cobra, registra a cobrança, descarta |
| **Comercial / relacionamento** | Liliane Peres (dona do registro do cliente no CRM), Rafael Souza | É acionado quando a cobrança emperra; negocia renovação e renegociação |
| **Diretoria** | Marcos Paulo | Escalonamento final: liga para o cliente, aprova condições de renovação |
| **Cliente** | Pessoa física ou empresa do contrato | Não tem acesso; só aparece como registro do CRM e como Vínculo |

Não há Agente nem Integração observados nesta Lista: nenhum Comentário automático, nenhum campo preenchido por robô. O campo `Integração manual` existe (herdado) mas está vazio em todas as Tarefas lidas.

---

## 2. Estrutura e relações

```text
Espaço "Gestão"
└── Pasta "Financeiro"
    ├── Lista "Contas a pagar"      (documento irmão)
    └── Lista "Contas a receber"    ← esta
        └── Tarefas do Tipo "Conta" (custom_item_id 1012, o mesmo de Contas a pagar)

Espaço CRM (90112771405)
└── Pasta "CRM"
    └── Lista "Gestão de clientes" (901109161381)
        └── Tarefas do Tipo "Cliente" (1015)  ◄── Vínculo N:1 a partir de cada conta
```

A relação com o cliente é o que dá sentido à Lista. No ClickUp é um campo de relacionamento bidirecional ("Gestão de Clientes" ↔ "Contas a receber") com **rollup de soma do Valor** no lado do cliente: o registro de Gabriela Melo (`868cphxe6`) mostra `rollup.value: 175000` — a soma das 10 Tarefas vinculadas (entrada + 9 parcelas), independentemente de status.

Na ontologia isso é um **Vínculo** tipado Tarefa → Cliente (o Cliente é uma Tarefa de outro Espaço hoje; na plataforma deve ser Empresa ou Contato do CRM, decisão em §12). A soma por cliente é um Painel de contexto sobre o registro do cliente, não um campo.

O cliente, por sua vez, tem Vínculo com **Gestão contratual** (`868ch9wm0`, status `em vigor`): contrato → cliente → parcelas. A cadeia completa é o que permite responder "quanto falta receber deste contrato".

---

## 3. Conjunto de Status

Definido na Lista. Seis Definições:

| # | Status | Categoria (ClickUp) | Categoria na plataforma | Significado | Observado em 240 Tarefas |
| --- | --- | --- | --- | --- | --- |
| 0 | `para receber` | open | `não iniciado` | Aguardando o vencimento | 1 (a única ainda aberta: `868f9b1e3`) |
| 1 | `disponível para saque` | custom | `em andamento` | Saldo liberado na plataforma, saque ainda não feito | **0** |
| 2 | `pendente` | custom | `em andamento` | Venceu sem pagamento; em cobrança | 1 (`868cpdawp`, desde 2025-04-08) |
| 3 | `estornado` | done | `concluído` | Valor devolvido ao cliente | **0** |
| 4 | `descartado` | done | `concluído` | Não será mais cobrado | 47 |
| 5 | `recebido` | closed | `fechado` | Dinheiro na conta | 191 |

**Status inicial padrão:** `para receber`.

### Transições observadas no histórico

```text
para receber ──────────────────────────────────────► recebido
     │                                                   ▲
     └──► pendente ──────────────────────────────────────┤
              │                                          │
              └──► descartado                            │
     ┌───────────────────────────────────────────────────┘
     └──► descartado   (sem passar por pendente: contrato cancelado em lote)

recebido ──► pendente ──► descartado   (recebimento registrado por engano e revertido: 868c7pmn9)
```

Evidências (tempo em cada status):

- Pagou no prazo: `868cpd8y3` (Entrada – Gabriela Melo) — `para receber` 2h39 → `recebido`.
- Atrasou e pagou: `868cpd8yk` (2ª Parcela – Gabriela Melo) — `para receber` 51d → `pendente` 37d → `recebido` em 2025-05-19, vencimento era 2025-04-15.
- Atrasou muito e pagou: `868c88m6m` (11ª Parcela – Kennedy Rodrigues) — vencimento 2024-12-01, `pendente` por 216 dias, `recebido` em 2025-09-02 depois de nove meses de cobrança (thread em §7).
- Atrasou e nunca pagou: `868cpdawp` (1ª Parcela – Daiane Silva) — `pendente` há 523 dias; as parcelas 2ª a 7ª da mesma cliente foram todas para `descartado` com Tag `inadimplência`.
- Cancelamento em lote: Gustavo Gonçalves, parcelas 4ª a 8ª, todas `descartado` sem Tag e sem passar por `pendente`; Ignacio (Yenifer Vinasco), parcelas 4ª a 11ª, `descartado` + `inadimplência` com Responsável trocado para Isadora.
- Reversão: `868c7pmn9` (2ª Parcela – Eduardo Frazão) — `recebido` 15d → `pendente` 343d → `descartado` em 2026-03-18.

`disponível para saque` e `estornado` estão configurados e **nunca foram usados**. `disponível para saque` só faz sentido para os saques de plataforma (Saque TMB / Xgrow), que hoje vão direto de `para receber` para `recebido` (`868fcaf88`: 54 dias em `para receber`, depois `recebido`).

---

## 4. Definições de Campo Personalizado

Oito Definições + um relacionamento. Todas exceto **Data de pagamento** são as mesmas Definições (mesmos IDs) usadas em Contas a pagar — são herdadas do Espaço "Gestão" ou compartilhadas pela Pasta. Ver [contas-a-pagar.md §4](contas-a-pagar.md) para opções completas.

| Rótulo | Tipo de Campo | Obrigatório | Uso nesta Lista |
| --- | --- | --- | --- |
| A-Centro de Custo | seleção única | **sim** | Quem "vendeu": Marcos Paulo, Roberth Resende, Tria Tech… |
| B-BU | seleção única | não | Unidade de negócio da venda |
| C-Empresa | seleção única | não | Empresa que fatura e recebe (Tria Company, PLX digital…) |
| Y-Produto | seleção múltipla | não | **Usado aqui** (ao contrário de Contas a pagar): o produto vendido. Ex.: "Master Private" em Gabriela Melo e nos Saques TMB |
| T-Valor | moeda BRL | não | Valor da parcela. Ex.: `20000` |
| **Data de pagamento** | data | não | Data em que o dinheiro entrou. Definição exclusiva desta Lista |
| U-Integração manual | seleção única | não | Herdado; vazio em toda a Lista |
| W-Equipe | moeda USD | não | Herdado; vazio em toda a Lista |
| Gestão de Clientes | relacionamento (→ Lista `901109161381`) | não | O cliente do contrato; rollup de soma do Valor no lado do cliente |

Atributos nativos em uso: **Nome** (padrão em §5), **Data de vencimento**, **Data de início** (data do contrato ou da entrada — `868cpd8yk` tem início 2025-02-15 e vencimento 2025-04-15), **Prioridade** (`normal` ou vazia; `high` em dois saques urgentes), **Responsável** (um), **Descrição** (log de cobrança, §7), **Anexos** (prints de conversa), **Tags**.

Campos que **faltam** e o processo precisa (hoje vivem no nome, na descrição ou na cabeça de alguém): número da parcela e total de parcelas; forma de recebimento; identificador do contrato. Ver §9.

---

## 5. Nomenclatura e criação

Todo nome segue um de três padrões:

```text
Entrada – <Cliente>
<N>ª Parcela – <Cliente>
Saque <Plataforma>            ex.: "Saque TMB", "Saque Xgrow Cariani"
```

O `<Cliente>` às vezes carrega o nome do contato comercial entre parênteses: "Marco Aurélio (João - Portal de concurso)", "Luan (Brasil Paralelo)", "Ignacio (Yenifer Vinasco)". Isso é a ausência do Vínculo com o cliente sendo compensada no texto — na plataforma o Vínculo resolve.

**Criação em lote na assinatura.** As 10 Tarefas de Gabriela Melo (entrada + 9 parcelas) foram criadas por Isadora em 2025-02-19 entre 12:55 e 12:58, com: Data de início = 2025-02-15 (contrato), Entrada vencendo 2025-02-05 (já paga), parcelas mensais no dia 15 de março a novembro, Valor `20000` cada, Centro de Custo, Empresa, Produto "Master Private", Vínculo com o cliente, Responsável Maryane. O mesmo padrão aparece em todos os clientes de 2025 (Daiane Silva, Sidney Garcês, Gustavo Gonçalves, Igor Ramos — todos criados no mesmo dia, mesmo criador).

**Backfill.** As Tarefas mais antigas (contratos de 2024: Kennedy Rodrigues, Alef e Hanna, Rogério Fameli, Victor Mardine…) foram todas criadas e fechadas entre 2025-01-27 e 2025-01-31 — a carga inicial da Lista, não o processo em operação. `date_closed` delas não é a data do recebimento; **Data de pagamento** é (quando preenchida).

**Saques de plataforma.** "Saque TMB" repete-se com vencimento mensal (jan, mar, abr, mai, jul, ago, set/2025) e Valor `0` — o valor real não era registrado, só o ato de sacar. Criador: Maryane.

---

## 6. Tags

| Tag | Significado | Uso observado |
| --- | --- | --- |
| `em cobrança` | O Financeiro está cobrando ativamente | 20 Tarefas; sempre junto de `pendente` ou de um `recebido` que atrasou |
| `inadimplência` | Cobrança esgotada; cliente não vai pagar | 37 Tarefas; sempre junto de `descartado` |
| `conta tria` | Conta bancária que recebe (mesma convenção de Contas a pagar) | 2 Tarefas, as mais recentes (Romero Albuquerque, ago/2025) — convenção nova que não chegou a se espalhar |

`em cobrança` e `inadimplência` são **estados de cobrança** sobrepostos ao status. Na plataforma cabem melhor como um Campo "Situação de cobrança" (em dia / em cobrança / inadimplente) do que como Tags, porque são mutuamente exclusivos e têm ordem. Se ficarem como Tags, a regra RN-CR-05 impede as duas juntas.

---

## 7. O fluxo, passo a passo

### 7.1 Assinatura → criação (D0 do contrato)

Comercial fecha o contrato (registro em "Gestão contratual" vai para `em vigor`) e o Financeiro cria a série: entrada + N parcelas, conforme §5. Status `para receber`, Responsável Financeiro, Vínculo com o cliente. Não há automação: é criação manual, uma Tarefa por vez (os timestamps de criação distam segundos, não milissegundos).

### 7.2 Vencimento → recebimento

No vencimento o Financeiro confere o extrato. Se entrou: status `recebido`, **Data de pagamento** preenchida. Entradas costumam ser recebidas antes da criação da Tarefa (Gabriela: entrada venceu 02-05, Tarefa criada 02-19, fechada 2h39 depois).

O recebimento é registrado um a um (não há lote como em Contas a pagar); `date_closed` das Tarefas de 2025 varia de dia para dia.

### 7.3 Atraso → cobrança

Se não entrou, a Tarefa vai para `pendente` e recebe a Tag `em cobrança`. Daí em diante, a Tarefa vira o **dossiê da cobrança**:

- A **Descrição** guarda o log de tentativas. `868cpdawp`: *"contato via whatsapp / em 18/02 / em 27/02 / Em 18/03 / Em 08/04"*.
- Cada tentativa gera um **Comentário com print** da conversa (`image.png`) e Menção a quem precisa saber: *"@Liliane da Silva Peres e @João Pedro para conhecimento"* (2025-02-27).
- Quando o cliente alega pagamento, o Financeiro confere e responde: *"@Liliane Peres @Petriv Junior pagamento não localizado"* (2025-08-12, Kennedy).

### 7.4 Escalonamento

A thread de Kennedy Rodrigues (`868c88m6m`, 11ª parcela vencida em 2024-12-01) mostra a cadeia inteira:

1. **2025-04-09** — Isadora (Financeiro) atribui Comentário a Marcos Paulo: *"ainda não finalizaram o contrato anterior e nem deram nenhum valor de entrada do atual"*. Marcos resolve o Comentário.
2. **2025-04-09** — Liliane (Comercial) pergunta a Marcos se ele liberou renovação "12 × 16.875" com a última parcela em aberto; pede a Rafael Souza (Comercial) que formalize a renovação; Rafael pergunta datas de vencimento e atribui a Liliane.
3. **2025-07-21** — Liliane pede ao Financeiro "a última cobrança"; Isadora responde com print de 25/06.
4. **2025-08-12** — "pagamento não localizado". **2025-08-19** — Isadora: "cobrado novamente hoje". **2025-08-20** — Marcos Paulo: *"Me confirma aí que vou ligar para eles"*; Isadora: *"já cobrei algumas vezes a Isabela que é o financeiro deles"*.
5. **2025-09-02** — `recebido`.

Três coisas a reter para a plataforma: a cobrança **mistura três times** na mesma Tarefa (Financeiro cobra, Comercial negocia, Diretoria fecha); a **renovação é negociada com parcela em aberto**, e o Financeiro precisa ver isso; o **contato do cliente** ("Isabela, financeiro deles", "contato 49 8887-7983") aparece solto em Comentário — deveria ser Contato do CRM vinculado.

### 7.5 Desfecho negativo

- **Inadimplência**: parcelas restantes vão para `descartado` com Tag `inadimplência`, muitas vezes em lote no mesmo dia (Daiane Silva 2ª–7ª em 2025-07-24, `868cpdaxk`) e com Responsável trocado para quem cobrou (Isadora nas de Ignacio e Eduardo Frazão).
- **Cancelamento / renegociação**: parcelas restantes vão para `descartado` **sem** Tag (Gustavo Gonçalves 4ª–8ª). A nova série, se houver, é criada como novo contrato.
- **Recebimento revertido**: `recebido` → `pendente` → `descartado` (`868c7pmn9`). Raro, mas o Conjunto precisa permitir reabrir um `fechado`.

---

## 8. Automações a construir

Escopo: Lista "Contas a receber". Nenhuma existe hoje; todas as abaixo substituem trabalho manual observado.

| # | Gatilho | Condição | Ações |
| --- | --- | --- | --- |
| R1 | Contrato entra em `em vigor` (Lista Gestão contratual) | contrato tem valor, entrada e nº de parcelas | Criar a série: 1 Tarefa "Entrada" + N Tarefas "Nª Parcela", com Valor, Data de vencimento mensal, Vínculo ao cliente, Responsável Financeiro, status `para receber` |
| R2 | Data de vencimento + 1 dia | status = `para receber` | Mover para `pendente`; aplicar Tag `em cobrança`; notificar Financeiro |
| R3 | Tarefa entra em `recebido` | Data de pagamento vazia | Preencher Data de pagamento = hoje (o Financeiro pode corrigir) |
| R4 | Tarefa entra em `pendente` há 30 dias | ainda `pendente` | Comentário com Menção ao Responsável do cliente no CRM (Comercial) — o "para conhecimento" de hoje |
| R5 | Tarefa entra em `pendente` há 60 dias | ainda `pendente` | Comentário atribuído à Diretoria (escalonamento da §7.4) |
| R6 | Tarefa entra em `descartado` com Tag `inadimplência` | — | Remover `em cobrança`; marcar o cliente no CRM como inadimplente (campo "Situação" do cliente, a criar) |
| R7 | Saque de plataforma: 1º dia útil do mês | — | Criar "Saque <Plataforma>" em `para receber`, Responsável Financeiro (recorrência por Regra de Recorrência, não por Automação) |

R1 é a única que muda o processo (hoje a série é digitada). O gatilho no contrato é o correto porque é lá que nascem valor, parcelas e datas; se a plataforma não tiver Gestão contratual no primeiro momento, R1 vira um formulário "criar série de parcelas" na própria Lista.

---

## 9. Campos a acrescentar na plataforma

Sem eles o processo não é consultável, só legível:

| Campo | Tipo | Por quê |
| --- | --- | --- |
| Número da parcela / Total | inteiro / inteiro | Hoje está no Nome ("7ª Parcela"). Sem campo, não dá para ordenar, nem saber quantas faltam |
| Tipo de recebimento | seleção: Entrada, Parcela, Saque de plataforma, Avulso | Três coisas diferentes na mesma Lista, distinguíveis só pelo Nome |
| Forma de recebimento | seleção: Pix, Boleto, Cartão, Plataforma | Contas a pagar tem; aqui não |
| Situação de cobrança | seleção: em dia, em cobrança, inadimplente | Substitui as Tags `em cobrança` / `inadimplência` (ver §6) |
| Contrato | Vínculo → Gestão contratual | Hoje o caminho é parcela → cliente → contrato; um cliente com dois contratos quebra a soma |

---

## 10. Permissões

| Papel | Lista "Contas a receber" |
| --- | --- |
| Financeiro | `ver`, `criar`, `editar`, `comentar`, `excluir`, `administrar` |
| Comercial (Responsável do cliente no CRM) | `ver` **as Tarefas dos seus clientes**, `comentar` |
| Diretoria | `ver`, `comentar`, `editar` (status) |
| Cliente | sem acesso |

Hoje Liliane e Rafael (Comercial) veem e comentam a Lista inteira; a restrição "só os seus clientes" é derivada do Vínculo e é o que a LGPD pede para dados de pagamento de terceiros.

---

## 11. Regras que a plataforma deve validar

- **RN-CR-01** — Centro de Custo obrigatório (única obrigatoriedade configurada).
- **RN-CR-02** — Toda Tarefa de tipo Entrada ou Parcela tem Vínculo com exatamente um cliente. (Hoje 2 das 240 não têm — Romero Albuquerque — e a soma do cliente fica errada.)
- **RN-CR-03** — Entrar em `recebido` exige Valor > 0 e Data de pagamento preenchida (R3 preenche se faltar). Exceção: Saques de plataforma, que hoje têm Valor `0` — decidir em §12 se passam a exigir valor.
- **RN-CR-04** — `pendente` só a partir de `para receber` ou `recebido` (reversão); `descartado` a partir de qualquer status não fechado.
- **RN-CR-05** — `em cobrança` e `inadimplência` são mutuamente exclusivas; `inadimplência` só com `descartado`.
- **RN-CR-06** — Uma Tarefa nunca é Subtarefa de outra nesta Lista. (Hoje `868cpdawp` "1ª Parcela – Daiane Silva" é filha de `868c7qreq` "2ª Parcela – Guilherme Vieira" — erro de digitação que a plataforma deve impedir desabilitando Subtarefas na Lista.)
- **RN-CR-07** — (Cliente, Tipo de recebimento, Número da parcela) é único. Hoje há duplicatas: duas "7ª Parcela – Gabriela Melo" (`868cpd8zg` e `868ffg91u`, ambas `recebido`, a segunda criada pelo Comercial) e duas "2ª Parcela – Sidney Garcês" (`868cpdatn`, `868dg4wy3`). A soma por cliente conta as duas.
- **INV-CR-01** — Soma de Valor das Tarefas `recebido` de um contrato ≤ valor do contrato.
- **INV-CR-02** — Data de pagamento ≥ Data de início da Tarefa.

---

## 12. O que não foi verificado e precisa de decisão

- **A Lista está dormente desde outubro de 2025.** Última Tarefa criada 2025-09-16 (`868fktdp6`); a única ainda aberta é `868f9b1e3`, vencimento 2025-11-01, `para receber`; último `recebido` 2025-10-28; nenhuma Tarefa com vencimento em 2026. Antes de replicar, perguntar ao Financeiro onde o recebimento é controlado hoje (Omie? planilha? a plataforma de pagamento?). Se a resposta for "no Omie", este documento vira spec da **Integração** de leitura, não de uma Lista.
- **Cliente = Tarefa em outro Espaço.** No ClickUp o cliente é uma Tarefa do Tipo "Cliente" na Lista "Gestão de clientes". Na plataforma, o CRM tem Contato e Empresa nativos; o Vínculo desta Lista deve apontar para lá, e "Gestão de clientes" deixa de existir como Lista. Decisão de produto.
- **`disponível para saque` e `estornado`** nunca usados em 240 Tarefas. Manter só se os Saques de plataforma passarem a usar o primeiro; o segundo pode ser um Motivo dentro de `descartado`.
- **Valor dos Saques** — todos `0`. Confirmar se o valor sacado deve ser registrado (provável: sim, senão a Lista não fecha com o extrato).
- **Regra de escalonamento** — os prazos de 30 e 60 dias em R4/R5 são propostos a partir de um único caso (Kennedy). O Financeiro precisa dizer o prazo real.
- **Data de pagamento vs `date_closed`** — nas Tarefas de 2025 os dois divergem por horas ou dias; no backfill de janeiro/2025 divergem por meses. A migração deve levar Data de pagamento quando existir e `date_closed` só como fallback.
- **Tag `conta tria`** — apareceu em ago/2025 em duas Tarefas. Se a intenção era espelhar Contas a pagar (qual conta bancária recebe), vira campo "Conta de recebimento", não Tag.
