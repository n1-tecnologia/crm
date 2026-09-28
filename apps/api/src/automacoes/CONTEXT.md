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
| `invocar-agente.ts` (Plan 03-11; plano pós-auditoria 1.4) | `criarPonteDoAgente()` — a ponte HTTP do Agente de lançamento: lança no Omie a conta que ENTRA em "em lançamento omie" (`/resolver` + `/lancar` do `automation/`, 03-07), publica o Resumo e move para "lançado omie"; e entrega ao scheduler acima uma `rodarAgenda` que nunca lança. |
| `invocar-agente.test.ts` | Puros e HTTP contra `servidorFalso` — todos sem `DATABASE_URL`; o cabeçalho do arquivo diz onde cada item de 1.4 é provado. |

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

## Onde a ponte pluga no agendador

A ponte do Agente (`invocar-agente.ts`) entra no worker por um caminho só: a
opção `rodarAgenda`, cuja assinatura é a de `runScheduledAutomations` (tipo
`RodarAgenda`, exportado). Lease, catch-up, contabilidade da linha,
saneamento e o gate da primeira volta continuam intocados. Em `../index.ts`,
o bloco da ponte vem ANTES do bloco do agendador, porque este usa a
`rodarAgenda` daquela.

## A ponte do Agente (`invocar-agente.ts`)

**(1) O gatilho é o Status, não o calendário** (plano pós-auditoria,
`docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 1.4 e
1.5). A cada ciclo (`AGENTE_CONTAS_A_PAGAR_INTERVALO_MS`, padrão 15 min), a
ponte hidrata o Espaço só para LER e olha as contas ativas da Lista
configurada em "em lançamento omie". Para cada uma: confere o que o Omie
exige (`erpMissingFields`, a mesma regra da saída de "para pagar"), chama
`/resolver` (prazo 10 s) e `/lancar` (prazo 60 s, `Idempotency-Key`
determinística) e, com o lançamento confirmado, publica o Resumo e move a
conta para "lançado omie" numa Unidade de Trabalho só. Nenhuma chamada nasce
para conta em "para pagar": o antigo `aquecer()`, que chamava `/resolver`
para todas elas a cada ciclo por causa da A7, saiu junto com a A7.

**(2) Só o que entrou por movimento.** `entrouPorMovimento` exige que o
último Registro "Status alterado" da conta seja a entrada em "em lançamento
omie" feita na plataforma. A importação do ClickUp também escreve esses
Registros (a trilha do `status_history`), mas sempre com instante anterior
ao da importação (`provenance.at`) — é assim que a conta que NASCEU no Status
é reconhecida. Ela pode já ter sido lançada no Omie pelo processo antigo,
com outro código de integração; a ponte não a lança e pede, uma vez, que
alguém confira e a mova para "para pagar" e de volta. Conta com "Integração
manual" = Manual não é do Agente: nenhuma chamada, nenhum Comentário.

**(3) Uma vez só.** A ponte guarda em memória, por conta, a impressão digital
do que decide o lançamento (Campos, vencimento, Tags, Status e o id do
Registro da entrada). Depois de uma recusa comentada — dado faltando, erro
permanente do `automation/` (`Não consegui lançar no Omie: <details.motivo>
(<code>).`), categoria sem confiança, lançamento não confirmado, ou a
terceira falha transitória seguida (`O Omie não respondeu depois de 3
tentativas…`) — a conta não é mais processada até a impressão mudar: alguém
corrigir um Campo, ou a conta sair e voltar (a volta é um Registro novo).
Conta que sai do Status é esquecida. O `details.motivo` vai para o
Comentário, nunca para o log (T-3-04). A recusa menciona o Financeiro
(`avisadoDoLancamento`), não o Membro de serviço que assina.

**(4) Os dois modos (D3-03).**

| `AGENTE_CONTAS_A_PAGAR_MODO` | Resolve para | O que a ponte faz |
|---|---|---|
| ausente, vazio, ou qualquer valor que não seja o literal `lancar` | `"ensaio"` (padrão) | só `/v1/integrations/contas-a-pagar/resolver` e o registro, em log, do que lançaria — nenhum Comentário, nenhum Status, nada gravado. |
| `"lancar"` (literal, exato) | `"lancar"` | `/resolver`, `/lancar`, Comentários e a troca de Status — exige `PLATAFORMA_LANCAMENTO_TOKEN` e `AGENTE_CONTAS_A_PAGAR_URL`; sem eles, nenhuma requisição, nunca uma queda silenciosa para ensaio. |

Um valor definido e desconhecido (erro de digitação, `"true"`, `"0"`) cai em
`"ensaio"` COM aviso, nomeando só a variável — nunca o seu conteúdo.

**(5) `rodarAgenda` nunca lança.** Para o par configurado, passa ao motor
`lancamento: { rehearsal: false, tarefasLancadas: [], dePara: <vazio, origem
omie> }`: uma A7 legada que ainda esteja ativa falha "Lançamento não
confirmado" antes de invocar o Agente — nunca com o de-para do protótipo
(T-3-39) —, e as outras Automações por data (A5/A6) rodam normalmente, com
o CNPJ da Empresa injetado. Qualquer outro par (mesmo Espaço, outra Lista)
delega direto a `runScheduledAutomations`, sem opções.

**(6) PAG-04, a metade CNPJ, mora aqui.** `CNPJ_POR_EMPRESA` foi apagada de
`packages/dominio` (03-11, Task 1); o token `{{cnpjEmpresa}}` de A5 passa a
ler `AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA` (`lerCnpjPorEmpresa()`, que
derruba o mapa INTEIRO ao primeiro valor fora do formato de CNPJ — meia
tabela é pior que nenhuma). Sem a variável, ou com a Empresa da Tarefa
ausente do mapa, o texto de A5 diz `da Empresa <nome>` — nunca um número
inventado.

**(7) Quem assina.** O Membro de serviço do Papel "Agente do pipeline"
(`resolverMembroAgenteDoPipeline`, só Membro ativo), criado por
`npm run solicitacoes:configurar -w @n1/api -- --apply` (plano pós-auditoria,
2.2). `AUTOMACOES_ATOR_MEMBER_ID` ainda sobrescreve, para teste manual.
