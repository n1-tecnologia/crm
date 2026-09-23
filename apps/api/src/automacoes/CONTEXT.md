# automacoes

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

O RELÓGIO do motor de Automações (AUTO-01): quem chama
`runScheduledAutomations` (`packages/dominio/src/operations/automations.ts`)
pelo menos uma vez por (Espaço de Trabalho, Lista, dia civil). Nenhuma regra
de negócio mora aqui — o que uma Automação faz, quando ela dispara e a
idempotência de "isto já rodou" são de `@n1/dominio`. Esta pasta só garante
que a chamada acontece.

| Arquivo | O que faz |
|---|---|
| `scheduler-worker.ts` | `criarSchedulerWorker()` — o poller: lease por `for update skip locked` sobre `plataforma.automacao_agenda`, catch-up do dia perdido, Ator de sistema, e o gate da primeira volta em ensaio. |
| `scheduler-worker.test.ts` | Os 19 casos (item Wave 0 de `03-VALIDATION.md`) — puros (a)-(e) e (s), os demais contra Postgres real. |
| `liberar.cli.ts` | CLI fino de liberação da primeira volta em ensaio — só compõe `liberarLista()`. |
| `invocar-agente.ts` (Plan 03-11) | `criarPonteDoAgente()` — a ponte HTTP do Agente de lançamento: resolve o de-para contra `automation/` (03-07) antes da Unidade de Trabalho e injeta o resultado no motor pela opção `rodarAgenda` do scheduler acima. |
| `invocar-agente.test.ts` | Os quinze casos: puros (a)-(e), HTTP contra `servidorFalso` (f)-(m) — sempre, sem `DATABASE_URL` —, e (n)-(o) contra Postgres real. |

## Por que não é fila, e por que a tabela existe

A Automação de agenda não cruza limite de processo: `runScheduledAutomations`
é uma função pura chamada dentro da MESMA transação da Unidade de Trabalho
(`executar()`, `../persistencia/unidade-de-trabalho.ts`). O outbox
(`../persistencia/outbox-worker.ts`) existe para o que SAI do processo depois
do commit — por isso `scheduler-worker.ts` copia a FORMA do outbox (lease,
trava de concorrência única, classificação de erro, `sanitizarErro()`) e não
o seu papel de negócio: não há fila nova e não há watermark novo.

`plataforma.automacao_agenda` (03-01, `005-agenda-de-automacoes.sql`) não é
fonte de idempotência — essa continua em `AutomationExecution`/`jaRodou`, no
domínio. A tabela existe para duas coisas que só o banco dá: exclusão mútua
entre instâncias do `apps/api` (a reivindicação é `for update skip locked`) e
auditoria de "o dia foi processado" (uma linha `falhou`, ou `processando` com
`locked_at` vencido, é o sinal de que o processo caiu antes de fechar o dia).

## O vocabulário de `last_error_code`

A coluna se chama `last_error_code` porque é a que 03-01 criou; aqui ela
carrega o "motivo do último evento não rotineiro daquele dia" — uma coluna
`motivo` dedicada seria o refinamento óbvio numa migração futura (as
migrações são numeradas e imutáveis, DEC-10, e `005` já está aplicada).
`CODIGOS_DA_AGENDA` (`scheduler-worker.ts`) é o vocabulário fechado:

| Código | Quem escreve | Significa |
|---|---|---|
| `MARCO_ZERO` | Plan 03-10, ao terminar a importação histórica | Fixa o dia em que a agenda desta Lista começa a contar — nenhum dia anterior nasce. |
| `ENSAIO_PRIMEIRA_VOLTA` | `scheduler-worker.ts` | A primeira volta REAL desta (Espaço, Lista) mediu e não gravou — ver seção abaixo. |
| `LEASE_EXPIRADO` | `scheduler-worker.ts` | Uma linha `processando` tinha `locked_at` mais velho que `leaseMs`: o processo caiu antes de fechar o dia. |
| `RECUSA_DO_DOMINIO` | `scheduler-worker.ts` | `runScheduledAutomations`/`executar()` devolveram `ok: false` sem conflito de revisão (ex.: falta a concessão de `administrar`). |
| `CONFLITO_DE_REVISAO` | `scheduler-worker.ts` | `executar()` devolveu `{ conflito: true }` — transitório, a próxima volta tenta de novo. |
| `ERRO_INESPERADO` | `scheduler-worker.ts` | Exceção não classificada durante o processamento da linha. |

Quem lê `last_error_code`/`last_error_summary` para qualquer fim — log, CLI,
tela futura — importa `CODIGOS_DA_AGENDA` em vez de repetir os literais.

## A primeira volta em ensaio (Task 2, D3-03)

As contas importadas por 03-09/03-10 que ficam em `para pagar` com
vencimento no passado satisfazem `hoje >= disparo` em qualquer dia civil
futuro. Sem gate, a primeira volta do agendador sobre a Lista de Contas a
pagar dispararia A5/A6 (Comentário de cobrança) e A7 (invocação do Agente)
em lote, no dia seguinte à importação — nenhuma das contas importadas
autorizou isso, e não é um comportamento que se desfaz depois.

A primeira volta REAL de cada (Espaço, Lista) — a que `primeiraVoltaPendente`
identifica pela ausência de qualquer linha `concluido` cujo `last_error_code`
não seja `MARCO_ZERO` nem `ENSAIO_PRIMEIRA_VOLTA` — roda em ENSAIO: `rodarAgenda`
é chamada dentro da transação (o cálculo acontece de verdade), as contagens
são capturadas, e o resultado é forçado a `ok: false` para que a Unidade de
Trabalho desfaça tudo (`unidade-de-trabalho.ts`, o mesmo caminho de rollback
de uma recusa legítima do domínio). A linha fecha `concluido` com
`last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` e as contagens do que TERIA
acontecido — nunca `failures[].title`/`.reason` (T-3-04).

Enquanto existir uma linha de ensaio não liberada para um par, `semear()` não
cria dia novo para ele — a Lista fica parada, visível, esperando gente.
Liberar é ato explícito:

```
npm run automacoes:liberar -w @n1/api -- <workspaceId> <listId>
```

`liberarLista()` só apaga o `last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'` das
linhas daquele par — nunca toca `MARCO_ZERO` e nunca toca outro par. Depois de
liberada, a volta seguinte processa de verdade. `ensaioNaPrimeiraVolta: false`
(opção do worker) desativa o gate inteiro — a porta para uma Lista que nasce
sem backlog e não precisa do ritual.

## Onde o Plan 03-11 pluga

A ponte HTTP do Agente (`invocar-agente.ts`, que nasce nesta mesma pasta)
resolve o de-para por HTTP **antes** da Unidade de Trabalho — chamada de rede
não entra em transação e não entra em `packages/dominio` — e entra no worker
por um caminho só: a opção `rodarAgenda`, cuja assinatura é a de
`runScheduledAutomations` (tipo `RodarAgenda`, exportado). Lease, catch-up,
contabilidade da linha, saneamento e o gate da primeira volta continuam
intocados. Em `../index.ts`, 03-11 acrescenta o seu próprio bloco `if` **ao
lado** de `AUTOMACOES_WORKER_ATIVO`, sem reescrevê-lo.

## A ponte do Agente (`invocar-agente.ts`)

**(1) Por que o de-para é um MAPA e não uma pergunta por Tarefa.**
`RodarAgenda` é síncrona — a mesma assinatura de `runScheduledAutomations`,
chamada dentro da MESMA transação de `executar()`. No instante em que o
domínio precisa do de-para já não há mais oportunidade de `await`: todo
`fetch` acontece ANTES, num pré-passo (`aquecer()`) que hidrata o Espaço só
para LER — nunca dentro de uma Unidade de Trabalho (precedente:
`../bootstrap/solicitacoes.ts`, o dry-run que hidrata e dá `rollback`) — e
monta o de-para de todas as candidatas de uma vez.

**(2) O cache por (Espaço, Lista, dia civil) e o relógio próprio.** A ponte
aquece um cache em memória com relógio mais curto que o do agendador
(`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, padrão 15min, contra 1h de
`AUTOMACOES_INTERVALO_MS`) — de propósito, para o cache estar quente quando o
agendador reivindicar a linha do dia. Cache FRIO para o par configurado é
recusa (`fail`), NUNCA um lançamento com o de-para do protótipo: o agendador
fecha a linha `falhou`/`RECUSA_DO_DOMINIO` e a reivindica de novo na volta
seguinte, já quente. Cada aquecimento descarta as entradas de dias
anteriores — o cache não cresce sem fim.

**(3) Os dois modos (D3-03).**

| `AGENTE_CONTAS_A_PAGAR_MODO` | Resolve para | O que a ponte alcança |
|---|---|---|
| ausente, vazio, ou qualquer valor que não seja o literal `lancar` | `"ensaio"` (padrão) | só `/v1/integrations/contas-a-pagar/resolver` — o endereço que 03-07 construiu sem porta de escrita. Rehearsar e escrever por acidente é impossível por construção. |
| `"lancar"` (literal, exato) | `"lancar"` | `/resolver` e, para candidata com `veredito: "resolvida"`, `/lancar` — exige `PLATAFORMA_LANCAMENTO_TOKEN` e `AGENTE_CONTAS_A_PAGAR_URL` presentes; sem eles, recusa permanente `CONFIGURACAO_AUSENTE`, nunca uma queda silenciosa para ensaio. |

Um valor definido e desconhecido (erro de digitação, `"true"`, `"0"`) cai em
`"ensaio"` COM aviso, nomeando só a variável — nunca o seu conteúdo.

**(4) A ponte só age sobre o par configurado.** `rodarAgenda` compara
`(workspaceId, listId)` recebidos contra os configurados; qualquer outro par
(mesmo Espaço, outra Lista) delega direto a `runScheduledAutomations`, sem
cache e sem recusa — a ponte não pode quebrar a agenda das outras Listas.

**(5) PAG-04, a metade CNPJ, mora aqui.** `CNPJ_POR_EMPRESA` foi apagada de
`packages/dominio` (03-11, Task 1); o token `{{cnpjEmpresa}}` de A5 passa a
ler `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` (`lerCnpjPorEmpresa()`, que
derruba o mapa INTEIRO ao primeiro valor fora do formato de CNPJ — meia
tabela é pior que nenhuma). Sem a variável, ou com a Empresa da Tarefa
ausente do mapa, o texto de A5 diz `da Empresa <nome>` — nunca um número
inventado.

**(6) O que o relatório de Ensaio (Plan 03-14) lê daqui:** nada de novo —
`invocar-agente.ts` não grava tabela nenhuma. O que ele PRODUZ é o
`OpcoesDaAgenda` que `runScheduledAutomations` recebe, e o que sobra no
`DataState` depois disso (`AgentExecution` com `rehearsal: true`, a
`AutomationExecution` de A7 fechando `concluida` com um passo) é a mesma
superfície que `03-08-SUMMARY.md`/`03-04-SUMMARY.md` já documentaram — 03-14
lê `plataforma.registros`, não este arquivo.
