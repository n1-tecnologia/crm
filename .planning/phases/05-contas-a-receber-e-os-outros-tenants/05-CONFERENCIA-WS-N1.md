# Conferência de Contas a receber contra `ws_n1` (D5-02b / D7)

**O que é:** o resultado da conferência SOMENTE LEITURA de `ws_n1` (Plan 05-09,
Task 1: `apps/api/src/bootstrap/conferir-contas-a-receber.ts`) contra o
catálogo de `packages/dominio/src/seed-contas-a-receber.ts`, seguida da
evidência e da resposta de D7 (a pergunta ao Financeiro sobre onde o
recebimento é controlado hoje).

**Prova de que nada foi gravado (Task 2, requisito do checkpoint, antes de
rodar contra produção):**

```
$ grep -c '"apply"\|--apply\|insert into\|update \|delete from' \
    apps/api/src/bootstrap/conferir-contas-a-receber.ts \
    apps/api/src/bootstrap/conferir-contas-a-receber.cli.ts
apps/api/src/bootstrap/conferir-contas-a-receber.ts:0
apps/api/src/bootstrap/conferir-contas-a-receber.cli.ts:0
```

- O CLI e o módulo importam só `canonico` e `hidratar` de
  `apps/api/src/persistencia/repositorio.ts` — nunca `gravar()` nem
  `semear()` (as duas funções do arquivo que de fato têm `insert into` /
  `delete from`, usadas por outros comandos, não por este).
- `hidratar()` (o corpo inteiro, conferido por `sed`) não contém
  `insert`/`update`/`delete`/`drop`/`alter` — só um `select` com `left join`.
- `apps/api/src/persistencia/conexao.ts` (`pool`, `carregarEnv`, `encerrar`)
  não emite SQL nenhum — só abre/fecha o Pool.
- `apps/api/src/persistencia/unidade-de-trabalho.ts` (o caminho de
  `executar()`/`--apply` que `solicitacoes.ts` e `configuracao-por-empresa.ts`
  usam) **nunca é importado** por este módulo nem pelo CLI.
- As duas únicas queries de contagem que o módulo emite (ver Task 1) começam
  com `select` — coladas por inteiro na seção 1 abaixo, junto com o resto da
  saída.
- A transação abre com `begin` e o `finally` sempre chama `rollback`, mesmo
  quando a comparação não muda nada.

Rodado com `npm run contas-a-receber:conferir -w @n1/api` em 2026-09-24,
`DATABASE_URL` apontando para o Supabase de produção (o mesmo que
`npm run bootstrap:gestao` e `npm run empresas:configurar` já usaram nesta
fase). Saída completa e código de saída abaixo, seção 1.

---

## 1. O que `ws_n1` tem hoje

Comando: `npm run contas-a-receber:conferir -w @n1/api` (padrão `--workspace=ws_n1`).
Código de saída: `0`.

```
> @n1/api@0.1.0 contas-a-receber:conferir
> vite-node src/bootstrap/conferir-contas-a-receber.cli.ts

espaço de trabalho   ws_n1
modo                 somente leitura (sem opção de gravar; rollback sempre)

1. Lista             esperada 1 · encontrada 1
2. Status             esperados 6 · encontrados 6
3. Campos             esperados 8 · encontrados 8
4. Automações         esperadas 6 · encontradas 6
5. Concessões         esperadas 0 · encontradas 0
5. Visões             esperadas 2 · encontradas 2

divergências         nenhuma

contagens operacionais (o que responde se a Lista está dormente):
  total de Tarefas em CR.listId   0
  última Tarefa criada em         (nenhuma)
  por Status:
```

**Leitura do resultado:**

- **Zero divergências nas cinco seções.** A Lista (`lst_contas_a_receber`), os
  6 Status (com `entryRequirements`/`entryFromStatusIds` batendo campo a
  campo), os 8 Campos, as 6 Automações `aut_cr_r2`..`aut_cr_r6` (trigger,
  condições e ações comparados por JSON estável) e as 2 Visões estão em
  `ws_n1` exatamente como `seed-contas-a-receber.ts` descreve. Confirma
  D5-02b: `bootstrapGestao()` já aplicou tudo isso em produção na Fase 1
  (Plan 01-05), e nada divergiu desde então.
- **Concessões: 0 esperadas · 0 encontradas — não é lacuna, é o esperado.**
  `gr_cr_diretoria` só é criada quando `applyContasAReceber` roda com
  `fixtures: true`; o bootstrap de produção roda com `fixtures: false`
  (D-07). Zero dos dois lados bate; não é achado, é o desenho.
- **Total de Tarefas em `CR.listId`: 0. Última Tarefa criada: nenhuma.** A
  Lista existe e está corretamente configurada, mas **nenhuma Tarefa foi
  importada do ClickUp para ela ainda** — o bootstrap de produção nunca
  trouxe as 240 Tarefas históricas (isso é trabalho de importação, fora do
  escopo de configuração). Isto é DIFERENTE da "Lista dormente desde
  outubro de 2025" que `docs/07-processos/contas-a-receber.md` descreve no
  ClickUp: lá há 240 Tarefas paradas; aqui há zero Tarefas, porque a
  importação ainda não aconteceu. As duas informações são complementares,
  não a mesma coisa — ver seção 3 do checkpoint da Task 3.

---

## 2. O que a spec pede e o catálogo não tem

Conferência à mão dos cinco Campos de `docs/07-processos/contas-a-receber.md`
§9 contra `CR.fields` (`packages/dominio/src/operations/financeiro.ts:673-699`):

| Campo pedido em §9 | Em `CR.fields`? | id |
| --- | --- | --- |
| Número da parcela / Total de parcelas | **sim**, os dois | `numeroParcela`, `totalParcelas` |
| Tipo de recebimento | **sim** | `tipo` |
| Forma de recebimento | **sim** | `forma` |
| Situação de cobrança | **sim** | `situacao` |
| Contrato (Vínculo → Gestão contratual) | **NÃO** | — |

Bônus, fora da lista de §9 mas decidido em §12/D5-17: `conta tria` (Tag) virou
o Campo "Conta de recebimento" (`contaRecebimento`) — **também presente**. Os
8 Campos de `CR.fields` batem exatamente com: os 5 de §9 (menos Contrato) + o
de §12 (`contaRecebimento`) + `dataPagamento` (§4, nativo da Lista) +
`produto` (herdado do Espaço, §4). Nenhum Campo da spec falta sem explicação.

**LACUNA registrada (padrão D-25), não tarefa a improvisar:** "Contrato" é um
Vínculo → Gestão contratual (spec §2: "cliente, por sua vez, tem Vínculo com
Gestão contratual"). **Gestão contratual não existe na plataforma** —
`.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-CONTEXT.md`
seção `<deferred>` lista "Gestão contratual como Lista (o gatilho 'correto'
de R1, spec §8) — sem ela, R1 é o formulário 'criar série de parcelas' na
própria Lista" como Deferred Idea desta fase. Construir esse Campo antes de
Gestão contratual existir seria um Vínculo apontando para nada — a lacuna
fica registrada aqui, sem criar o Campo nem improvisar um destino.

---

## 3. R1–R7

| # | O que a spec pede (`contas-a-receber.md` §8) | Estado em `ws_n1` / no código | Situação |
| --- | --- | --- | --- |
| R1 | Contrato entra em `em vigor` → cria a série (entrada + N parcelas) | Sem Gestão contratual (ver seção 2), o gatilho por contrato não existe. Mas o formulário equivalente **já existe**: `SerieDeParcelasDialog` (`apps/web/src/features/estrutura/financeiro/serie-dialog.tsx`), montado na tela da Lista (`apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`), chamando a operação de domínio `createReceivableSeries` (`packages/dominio/src/operations/financeiro.ts:764`, já implementada e testada). | **Feito** — como formulário na própria Lista, exatamente a alternativa que D5-02b e `05-CONTEXT.md` previam para quando Gestão contratual não existir. |
| R2 | D+1 do vencimento sem pagamento → `pendente` + Tag/aviso | `aut_cr_r2` presente em `ws_n1`, zero divergência (trigger `vencimento(1)`, condição `status: "para receber"`, ações `alterarStatus`+`comentar`). | **Feito**, aplicado em produção. |
| R3 | Entrar em `recebido` → preencher Data de pagamento | `aut_cr_r3` presente, zero divergência. | **Feito**, aplicado em produção. |
| R4 | 30 dias em cobrança → Comentário ao Comercial | `aut_cr_r4` presente, zero divergência (`vencimento(30)`). Prazo de 30 dias é o valor inicial de configuração (D5-15) — ver seção 4/5 sobre se o Financeiro confirma o prazo real. | **Feito**, aplicado; prazo pendente de confirmação (Task 3). |
| R5 | 60 dias em cobrança → escalona à Diretoria | `aut_cr_r5` presente, zero divergência (`vencimento(60)`). Mesma ressalva de prazo que R4. | **Feito**, aplicado; prazo pendente de confirmação (Task 3). |
| R6 | Descartado com Tag `em cobrança` → `inadimplente` | `aut_cr_r6` presente, zero divergência. | **Feito**, aplicado em produção. |
| R7 | Saque de plataforma: 1º dia útil do mês, por Regra de Recorrência (não Automação) | Não é uma Automação `aut_cr_*` — é Regra de Recorrência sobre a Tarefa (o mesmo mecanismo de A1 na Fase 3, aplicado a uma Tarefa "Saque" existente, não a um catálogo de configuração). A conferência deste plano não mede Regra de Recorrência (ela vive em `Task.recurrence`, por Tarefa, não em `state.automations`) — e não há nenhuma Tarefa "Saque" em `ws_n1` ainda (total de Tarefas = 0, seção 1), então não há o que conferir hoje. | **Pendente** — precisa do mesmo tratamento que A1 recebeu na Fase 3, quando a primeira Tarefa "Saque" for importada ou criada. Anotado como pendência; não planejado aqui (o plano não escreve nenhuma Automação/Regra nova). |

**Nota de leitura:** R2b (`aut_cr_r2b`, "em pendente: Situação em cobrança")
não está listada em §8 como item numerado próprio — é um desdobramento de R2
que o seed já implementa (marca a Situação de cobrança ao entrar em
`pendente`, tanto pelo relógio quanto por ação manual). Também presente em
`ws_n1`, zero divergência, contado dentro dos "6 esperadas · 6 encontradas"
de Automações na seção 1.

---

## 4. A pergunta a D7 e a resposta do Financeiro

_(preenchido pela Task 3 — pendente)_

## 5. O ramo escolhido

_(preenchido pela Task 3 — pendente)_
