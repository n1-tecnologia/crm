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

**2026-08-04 22:47** — o Agente publica o Comentário "Resumo de pagamento", **atribuído ao Financeiro** e já **resolvido**:

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

Quando `Integração manual = Manual`, o Financeiro lança à mão e move para `em lançamento omie` → `lançado omie` sem Agente.

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
| A7 | Data de vencimento − 1 dia (noite) | status = `para pagar` **e** Integração manual vazio **e** Valor preenchido | Invocar o Agente de lançamento (seção 9) |
| A8 | Agente concluiu com sucesso | — | Mover para `lançado omie` |
| A9 | Tarefa criada | — | Adicionar Observadores: Financeiro, Aprovador, Pessoa (se preenchida) |

A5 e A6 são hoje feitas à mão pelo Financeiro (Comentários de Maryane). Automatizá-las é a única mudança de comportamento proposta neste documento; o texto e os momentos são os observados.

---

## 9. Agente de lançamento

Substitui o usuário "ADM Tria Company". Configuração mínima:

- **Papel:** Convidado com `ver`, `comentar` e `editar` (só status) na Lista "Contas a pagar". Nada fora dela.
- **Invocado por:** Automação A7. Sem Gatilho próprio (Agente nunca tem Gatilho — Glossário).
- **Entrada:** Nome, Descrição, Tag, Centro de Custo, Empresa, Categoria de pagamento, Fornecedor (CPF/CNPJ), Forma de pagamento e o campo de pagamento correspondente, Valor, Data de vencimento.
- **Conhecimento:** o de-para para o ERP — (Centro de Custo, Tag) → Conta de pagamento; Categoria de pagamento → Categoria Omie + Código do plano de contas (ex.: Prestação de Serviços + Centro de Custo Tria Tech → "Prestação serviços - ADM", `2.04.08`). Esse mapeamento **não está no ClickUp**; está na cabeça do Agente atual e precisa ser extraído para uma Coleção de Conhecimento antes da migração (ver 12).
- **Ferramentas:** `criar comentário`, `alterar status`, e a Integração com o Omie (lançar conta a pagar). A Integração é do Espaço de Trabalho (Glossário: Integração), com Membro configurador.
- **Saída:** o Comentário no formato exato da seção 6.3, atribuído ao Financeiro e resolvido; depois a mudança de status. Se qualquer campo obrigatório para o ERP faltar, o Agente comenta o que falta, **não** muda o status e deixa o Comentário aberto atribuído ao Financeiro.
- **Nível de autonomia:** age sem aprovação para comentar e mover status; o lançamento no ERP em si deve exigir Ensaio na primeira semana e Política de aprovação depois, decisão de produto.

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
- **RN-CP-03** — Fornecedor = CPF exige CPF preenchido; = CNPJ exige CNPJ preenchido.
- **RN-CP-04** — Entrar em `em autorização bancária` troca o Responsável para o Aprovador (A3). Entrar em `pago` só é permitido ao Aprovador.
- **RN-CP-05** — `pago` é o único status `fechado`. `aprovado` e `negado` são `concluído` e não disparam recorrência.
- **RN-CP-06** — Uma Tarefa recorrente gera **uma** ocorrência por fechamento; fechar duas vezes (reabrir e fechar) não duplica.
- **RN-CP-07** — Exatamente uma Tag `conta *` por Tarefa.
- **INV-CP-01** — Toda Tarefa em `lançado omie` ou posterior tem um Comentário "Resumo de pagamento" ou `Integração manual = Manual`.

---

## 12. O que não foi verificado e precisa de decisão

- **Status `aprovado`** — configurado, mas nenhuma das 200 Tarefas lidas o usa; aprovação vai direto para `pago`. Decidir se entra na plataforma ou se o Conjunto fica com sete.
- **Campos `Data Vencimento` (L) e Data de vencimento nativa** — duplicados; nas Tarefas lidas têm o mesmo valor. Manter só o nativo e migrar L para ele.
- **`Equipe` (W, USD) e `Produto` (Y)** — herdados do Espaço, vazios em toda a Lista. Não replicar na Lista; se o Espaço "Gestão" da plataforma os definir, ocultá-los aqui.
- **De-para ERP** — a tabela (Centro de Custo, Tag, Categoria) → (Conta de pagamento, Categoria Omie, Código) não está em lugar nenhum que a API alcance. Precisa ser exportada do Omie ou ditada pelo Financeiro antes de o Agente funcionar.
- **Quem gera a remessa e como** — o histórico mostra o Financeiro movendo o status; não mostra se o arquivo CNAB sai do Omie ou do banco. Não afeta a plataforma, afeta a Integração.
- **Ordem exata da recorrência** — a regra "mesmo dia, dia útil anterior" foi inferida de três vencimentos consecutivos de uma Tarefa (05/08 → 04/09 → 05/10). Confirmar com o Financeiro antes de codificar.
- **Volume** — mais de 200 Tarefas ativas + histórico; a migração precisa de paginação e de manter `date_created`, `date_closed` e o histórico de status (o "tempo em status" é usado como métrica: 29-31 dias em `para pagar` é o ciclo normal).
