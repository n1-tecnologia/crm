# Phase 3: Contas a pagar - Context

**Gathered:** 2026-09-22
**Status:** Ready for research

<domain>
## Phase Boundary

O Financeiro opera as Contas a pagar inteiramente no CRM N1: as Tarefas vêm do
ClickUp com o histórico preservado, as automações A1–A9 acontecem sozinhas num
motor que não perde o dia se o processo cair, o Agente lança no Omie de verdade
e as permissões são as que o processo precisa.

O **Motor de Automações (AUTO-01)** mora aqui e é transversal: o Financeiro é o
primeiro cliente, Contas a receber (Phase 5) o segundo, e o gatilho "tempo em
Status" (C34) o terceiro. É a única peça G de risco alto ainda não iniciada —
não existe nada em `apps/api/src/automacoes`. Deve nascer como infraestrutura
genérica, não como sete `if` do Financeiro.

Não inclui: as telas que nunca viveram no ClickUp (Phase 4), Contas a receber
nem os outros tenants (Phase 5).
</domain>

<decisions>
## Decisões travadas nesta discussão

### D3-01 — FINQ sai de escopo; só TRIA

O de-para e as credenciais do Omie ficam restritos à TRIA nesta fase. O
`financeiro-tria` hoje resolve duas empresas por Centro de Custo
(`payment-rules.ts::resolveAccountConfig`), cada uma com `app_key`/`app_secret`
e tabela de categorias próprias:

```
Centro de Custo → FINQ  → conciliador_contas_pagar_finq   ← FORA de escopo
Centro de Custo → TRIA  → conciliador_contas_pagar_tria   ← esta fase
```

A partição por empresa permanece no código legado; esta fase apenas não a
exercita para FINQ. Não remover o caminho FINQ do `financeiro-tria`.

### D3-02 — OQ-CP-04 está respondida: o de-para já existe

A pergunta em aberto do ROADMAP ("o de-para ERP não está onde a API alcance")
foi respondida pelo usuário e confirmada no código: **o banco de categorias já
existe e já está em produção** — é a tabela `conciliador_contas_pagar_tria`,
referenciada por `banco_de_categorias` em `solicitacoes_pagamentos` e resolvida
por `resolveAccountConfig(centroCusto).categoryBank`.

A questão real não é "de onde tirar" e sim "como alcançar", e DEC-08 já decidiu:
os dois schemas vivem em projetos Supabase distintos, **nenhuma leitura cruzada
por JOIN, tudo por HTTP** (OQ-SYN-03). Não gerar um segundo de-para; não
exportar do Omie para criar uma cópia divergente.

### D3-03 — O Agente roda em SOMBRA na primeira semana

"Ensaio" do critério 4 significa: durante a primeira semana o Agente **calcula o
que lançaria e registra ao lado do que o humano de fato lançou**, sem nenhuma
escrita no Omie. Mede-se a taxa de acerto antes de dar a caneta a ele.

Isto é mais conservador que o ensaio da Phase 2 (02-27), onde os dois caminhos
escrevem e a reconciliação confere. Aqui não há escrita do Agente — a comparação
é contra o lançamento humano.

Consequência de projeto: o cálculo do lançamento tem que ser separável da
execução dele. A peça que decide "qual categoria, qual conta, qual valor" não
pode estar entrelaçada com a chamada `IncluirContaPagar`.

### D3-04 — Importação histórica preserva a trilha completa

`date_created`, `date_closed` e **todo o histórico de status** viram Registros de
Atividade com a data original, como o critério 2 exige literalmente. "Tempo em
`para pagar`" (29–31 dias é o ciclo normal) continua mensurável depois da
importação. A data de vencimento vive só no campo nativo, nunca duplicada.

### D3-05 — A regra de recorrência já está modelada; duas lacunas ficam abertas

`seed-financeiro.ts::recorrente()` e `types/structure.ts::RecurrenceRule` já
definem o comportamento, inferido dos dados reais do ClickUp:

```ts
{ frequency: "mensal", interval: 1,
  triggerMode: "aoConcluir",   // nasce ao fechar, não por calendário
  businessDays: "anterior",     // fim de semana → dia útil anterior
  defaultAssigneeMemberId: financeiro,
  copies: { fieldValues: true, fieldValuesExcept: [anexo, dataEmissao], ... } }
```

Respondido pelo modelo:
- **Fim de semana** → antecipa para o dia útil anterior.
- **Escopo da regra** → `recurrence` é por Tarefa; cada conta recorrente carrega
  a sua. Aluguel e assinatura podem divergir sem exceção no código.
- **Reabertura** → `triggerMode: "aoConcluir"` + RN-CP-06 ("uma por fechamento,
  mesmo reabrindo").

**Duas lacunas reais, a decidir antes de codificar A1** (o comentário do tipo diz
"fim de semana", não feriado — a omissão é do modelo, não deste documento):

1. **Feriado.** Não existe no modelo. Uma conta que vence na terça de carnaval
   seria tratada como dia útil. Precisa de fonte de feriados (nacional? estadual?
   bancário?) ou de decisão explícita de ignorá-los.
2. **Dia inexistente no mês.** Conta que vence todo dia 31: em fevereiro vai para
   o dia 28/29, ou transborda para 1º de março? Nenhuma regra hoje.

Não inventar default silencioso. Se a pesquisa não achar a resposta nos dados
reais, isto volta como checkpoint ao usuário.

**Estado em 2026-09-22: as duas voltaram como checkpoint e foram respondidas** —
ver D3-06 (feriado: ignorar) e D3-07 (dia inexistente: saturar no último dia do
mês). A pesquisa confirmou que os dados reais não respondiam nenhuma das duas.

### D3-06 — Feriado na recorrência: ignorar (checkpoint D3-05 lacuna 1, respondido)

A regra de recorrência trata **fim de semana e nada mais**. `businessDays:
"anterior"` continua como está; nenhuma tabela de feriados, nenhuma dependência
de datas nova.

Fundamento: o export real do ClickUp mostra 4 Tarefas vencendo em 2025-02-17
(segunda-feira de Carnaval, não é fim de semana) **sem nenhum deslocamento** —
é o que o processo faz hoje. Não há série mensal cruzando feriado nos dados,
então não há evidência contrária.

Consequência aceita: uma conta que vencer numa terça de Carnaval será tratada
como dia útil. Se isso se revelar errado na operação, a correção é barata (uma
tabela estática de ~12 datas/ano em `packages/dominio`) — não exige redesenhar
A1.

### D3-07 — Dia inexistente no mês: saturar no último dia (checkpoint D3-05 lacuna 2, respondido)

O comportamento que `addMonths` (`packages/dominio/src/operations/collaboration.ts:325-331`)
já implementa é a **intenção do produto**, não um acidente: `Math.min(dia,
últimoDiaDoMêsDestino)`. Conta do dia 31 em janeiro vence em 28/02 (ou 29/02),
nunca transborda para 1º ou 3 de março.

Nenhum código novo. O que muda é o estado: isto deixa de ser uma implementação
não confirmada e passa a ser regra travada, com teste que a prove.

Motivo de não transbordar: transbordo gera duas cobranças perto da virada do
mês — é o que a maioria dos sistemas financeiros evita.

### D3-08 — A conversão Solicitação aprovada → Conta a pagar entra nesta fase

A pesquisa achou um buraco que nenhum requisito nomeado cobre (nem PAG-01…06,
nem SOL-01…09): **nada converte uma Solicitação aprovada numa Conta a pagar
dentro da plataforma**. O status `convertida` existe no catálogo da Lista de
Solicitações mas o código o marca explicitamente como erro (D-14), e quem cria
a Conta hoje é o `payment-automation-service.ts` do `automation/`, escrevendo
na **Lista do ClickUp** via `legacyClickUpRaw().updateTaskStatus`.

Esse caminho morre no critério 1. Arquivada a Lista `901107637383`, uma
Solicitação aprovada no dia seguinte não vira conta nenhuma — e o Financeiro
volta ao ClickUp na mesma semana em que deveria ter parado de abri-lo.

Por isso a operação de conversão é escopo da Fase 3, mesmo fora dos IDs
nomeados: PAG-01 resolve o **histórico**, D3-08 resolve o **fluxo dali para
frente**. Sem as duas, o critério 1 não fecha.

Nasce em `packages/dominio` (é "o que a coisa é": uma Solicitação aprovada
passa a ter uma Conta correspondente), com `convertida` deixando de ser erro.
</decisions>

<canonical_refs>
## Referências canônicas

- `.planning/ROADMAP.md` — Phase 3, critérios 1–5 e a nota sobre AUTO-01
- `.planning/REQUIREMENTS.md` — PAG-01…PAG-06, AUTO-01
- `.planning/PROJECT.md` — DEC-08 (projetos Supabase distintos), DEC-06
  (serialização de escritas por Espaço), DEC-17 (schema `public` do financeiro),
  OQ-CP-04, OQ-CP-06, OQ-CMP-03/05, OQ-PF-03 (C14), OQ-SYN-02, OQ-SYN-03
- `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-CONTEXT.md`
  — decisões da fase anterior que continuam valendo (D-04 Storage opaco, D-13
  Papel sem ocupante fixo, D-15 credencial de serviço, D-19 outbox)
- `docs/08-migracao-financeiro/` — inventário do sistema atual e comparativo
- `ontologia/` — `Automation`, `AutomationExecution`, e as quatro ações
</canonical_refs>

<code_context>
## O que já existe

**AUTO-01 é greenfield no `apps/api`.** `ls apps/api/src/automacoes` não existe.
O que há hoje:

- `packages/dominio/src/operations/automations.ts` e `types/ai.ts` (17 menções a
  `Automation`) — o modelo da ontologia, sem executor.
- `seed-financeiro.ts` — A1–A9 existem como **dados de seed**, não como motor.
  PAG-02 está "em andamento (dados no seed; falta o motor)".
- O cron do `automation/` legado é o antipadrão declarado pelo ROADMAP: "sem
  fila, sem retry persistente".

**A Phase 2 entregou a peça que OQ-SYN-02 perguntava.** O outbox transacional
existe: `apps/api/src/persistencia/outbox.ts` (evento nasce na MESMA transação do
fato de negócio, via o hook `eventos` da Unidade de Trabalho) e
`outbox-worker.ts` (lease por `for update skip locked`, backoff em escada com
jitter, classificação permanente/transitório, `sanitizarErro`). A pergunta
"o webhook de saída de SOL-07 e o motor de Automações são a mesma peça?" agora
tem um lado concreto para comparar — decidir na pesquisa, não presumir.

**Permissão da Pessoa da conta (PAG-06)** é a mesma família do que a Phase 2
resolveu para o Agente do pipeline. `guestFieldWriter` já existe em
`operations/tasks.ts` para exatamente este caso (Convidado que edita só Anexo e
Data de Emissão), e `seed-financeiro.ts` já cria os Grants `gr_cp_pessoa_*`.
PAG-06 está "modelado; backend precisa aplicar".

**Lições da Phase 2 que valem aqui** (cada uma custou tempo):
- Worktree isolado não enxerga produção: sem `DATABASE_URL`, sem `.env`, sem
  resíduo de banco, com identidade de teste diferente da real. Quatro defeitos
  saíram daí.
- Teste que insere linha em banco compartilhado tem que limpar a própria linha.
- Metadado que parece configurar comportamento pode não configurar
  (`editarRestritoA` era morto até a Phase 2 ligá-lo).
- O pooler da Supabase encerra conexão ociosa; o `Pool` precisa de ouvinte de
  `error` ou o processo cai.
</code_context>

<specifics>
## Particularidades desta fase

- **O lote de 61 contas** (critério 5) precisa ser medido contra a serialização
  de escritas por Espaço (DEC-06). Cada uma dispara A1 — 61 recorrências novas
  numa transação, ou 61 transações, é decisão de projeto com consequência real.
- **O RESUMO** tem formato exato em CON-CP-08 e é atribuído ao Financeiro, não ao
  Agente.
- **Idempotência do Omie** é por `codigo_lancamento_integracao`, determinístico —
  o mesmo mecanismo que a Phase 2 usou no 02-27.
- **`REVISAR` abaixo do threshold**: a classificação por RAG tem confiança, e
  abaixo do corte a conta vai para revisão humana em vez de lançar.
- **A Lista `901107637383`** é a do ClickUp a arquivar no fim (critério 1).
</specifics>

<deferred>
## Adiado

- **FINQ e os outros tenants** — D3-01 restringe à TRIA. Marcos Paulo e
  family-office são Phase 5.
- **`notificar` por Canal** — nesta fase `notificar` é in-app; por Canal é
  Phase 5.
- **OQ-PF-03 (C14)** — Definições de Campo de Tarefa em Automação de escopo
  Espaço de Trabalho segue aberta na ontologia. Relevante para AUTO-01, mas não
  bloqueia A1–A9, que são de Lista.
</deferred>
