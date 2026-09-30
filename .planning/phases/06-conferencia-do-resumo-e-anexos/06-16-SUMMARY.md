---
phase: 06-conferencia-do-resumo-e-anexos
plan: 16
subsystem: financeiro-tria/automation (coorte plataforma: S5 assíncrono, receipts de aprovação, worker)
tags: [gap-closure, s5, receipts, cas, ordem-das-decisoes, worker, sanitizacao, redacao, fin2-cr-01, fin2-wr-03, fin2-wr-04, fin2-wr-05, fin2-wr-06, fin2-in-04, fin2-in-08, fin2-in-10]
requires:
  - phase: 06-09
    provides: "publicarResumoDaDecisao depois do 202, reprocessarAprovacoesPresas, receipt com payload"
  - phase: 06-10
    provides: "executarResumoDaPlataforma com lerTarefa, detalheSanitizadoDaFalha, conferidoNoOmie"
provides:
  - "receipts: listarReceiptsDaTarefa, gravarPayloadDoReceipt, fecharReceipt(..., { tentativaEsperada }) -> boolean (CAS por attempts)"
  - "webhooks: marca payload.decisaoGravada, decisaoSuperada/decisaoQueSupera por occurredAt + event_id, S5-only na varredura, limite 2 por reivindicação, encerrarAprovacoesEsgotadas (passada final terminal em maxTentativas + 1), portaDeReceiptsDaAprovacao, logs só com código e resumo sanitizado"
  - "serviço: ErroDoResumoEmAndamento, PortaDeReceiptsDaAprovacao, publicarResumoDaDecisao(..., decisaoVigente?), Status relido antes do S5 e antes do createComment, ignorado 'decisao_superada', step()/ListarCategorias sanitizados na plataforma, conferidoNoOmie com as flags"
  - "contas-a-pagar-resolucao: reprovacaoDaCategoriaNoPlano (o 06-17 reusa)"
  - "worker: duas trilhas no timer (fila+comentários / aprovações), encerramento no ciclo"
  - "omie.ts: redigirValores sem diferenciar maiúsculas nem acentos"
affects: [06-17, 06-20]
tech-stack:
  added: []
  patterns:
    - "Decisão gravada registrada no receipt; a varredura só refaz o que falta (S5), nunca a decisão já gravada"
    - "Ordem das decisões da mesma Tarefa pelo occurredAt do outbox, empate pelo event_id; receipt sem marca não entra na ordem"
    - "Fechamento de receipt por CAS de attempts: quem perdeu o lease não sobrescreve o desfecho de quem reivindicou"
    - "Dobra de texto (NFD, sem marcas, minúsculas) com mapa de índice para redigir o trecho original"
key-files:
  created:
    - ../financeiro-tria/automation/src/adapters/omie-redacao.test.ts
  modified:
    - ../financeiro-tria/automation/src/http/receipts-da-plataforma.ts
    - ../financeiro-tria/automation/src/http/receipts-da-plataforma.test.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
    - ../financeiro-tria/automation/src/http/routes.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts
    - ../financeiro-tria/automation/src/http/worker-da-plataforma.ts
    - ../financeiro-tria/automation/src/http/worker-da-plataforma.test.ts
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/README.md
key-decisions:
  - "decisaoSuperada é implementada por uma decisaoQueSupera que devolve o event_id da decisão mais nova, para o console.info do descarte citar os dois ids"
  - "Na varredura, exigirDecisaoDaPlataforma vem antes de decisaoSuperada (mesma ordem do handler)"
  - "fecharReceipt sem tentativaEsperada mantém o comportamento de antes (erro do cliente devolve false em silêncio, sem console.warn novo); com tentativaEsperada, 0 linhas => console.warn do desfecho perdido"
  - "O encerramento compartilha o limite (padrão 2) da varredura e conta só o que reivindicou; o resumo gravado do abandono é fixo ('abandonada depois de <n> tentativas')"
  - "Nas duas trilhas, cada uma registra a própria linha de log do ciclo; processarCiclo() mantém formato de retorno e linha de log de antes"
requirements-completed: [RES-05]
metrics:
  duration: "~25 min"
  completed: 2026-09-30
  tasks: 3
  files: 14
---

# Phase 6 Plan 16: S5 assíncrono sem decisão velha, sem dedup que engole evento, sem varredura em série e sem receipt preso — Summary

**A decisão de aprovação agora fica registrada no receipt (`decisaoGravada`), e a varredura de um receipt com a marca refaz só o S5. Uma decisão mais velha que a última gravada para a Tarefa (pelo `occurredAt` do outbox) não é aplicada, nem no webhook nem na varredura. O S5 relê o Status da Solicitação antes de gastar Omie e de novo antes de comentar, e consulta a vigência que o webhook passa. Um segundo S5 da mesma Tarefa volta pela varredura em vez de virar sucesso, e o fechamento do receipt é CAS por `attempts`. O worker roda as aprovações numa trilha própria, com no máximo 2 retomadas por passada, e fecha de vez o que esgotou as tentativas. Os logs saem sanitizados, a redação ignora maiúsculas e acentos, e "conferido no Omie" passa a exigir as flags do plano de contas. A sequência da revisão (aprovada → reprovada → varredura) está provada ponta a ponta com o serviço real e não publica nada.**

## Commits (financeiro-tria, branch main, BASE `0ad567e`, sem push)

| Task | Commit | O quê |
|---|---|---|
| 1 | `c03eb07` | receipts (leitura por Tarefa, payload, CAS), webhook com a marca e a ordem, varredura S5-only com limite 2, `encerrarAprovacoesEsgotadas`, `portaDeReceiptsDaAprovacao`, logs sanitizados, 3º parâmetro no tipo `PaymentService` |
| 2 | `522752c` | Status relido duas vezes, vigência, `ErroDoResumoEmAndamento`, recusa da repetição com receipt pendente, `step()`/`ListarCategorias` sanitizados, `reprovacaoDaCategoriaNoPlano` e `conferidoNoOmie` com as flags, `receiptsDaAprovacao` em `routes.ts` |
| 3 | `c535dee` | worker em duas trilhas + encerramento no ciclo, `redigirValores` sem maiúsculas nem acentos, X1/X1b/X2/F10 pelo webhook, README |

Cada commit tem só os caminhos da task (`git diff --cached --stat` conferido), CR por arquivo igual ao de HEAD (0 em todos; o arquivo novo tem 0), e `git status --short | wc -l` = 89 depois de cada um.

## Testes

- **Antes (BASE `0ad567e`), `npm test` isolado:** 708 testes, 708 pass, 0 fail.
- **Depois (HEAD `c535dee`), `npm test` isolado:** 751 testes, 751 pass, 0 fail (≈18 s). São 43 novos:
  - `receipts-da-plataforma.test.ts`: RC1–RC3 (3);
  - `webhooks-plataforma.test.ts`: V1–V7, Z2, L1, W1–W5, Y1, P1 (16);
  - `contas-a-pagar-resolucao.test.ts`: RP1 (1);
  - `payment-automation-service.plataforma.test.ts`: S1–S4, Z1, Q1, Q2, Q3, N1, F8, F9, X1, X1b, X2, F10 (15);
  - `worker-da-plataforma.test.ts`: K3, K5 (2);
  - `omie-redacao.test.ts` (novo): 6.
- `npx tsc --noEmit -p .` verde em cada task; `npx tsc --noEmit -p tsconfig.scripts.json` verde na Task 3.
- `payment-automation-service.legado.test.ts` verde e sem diff (`git diff --stat 0ad567e..HEAD -- …legado.test.ts` vazio). `git diff --stat 0ad567e..HEAD -- ../supabase/migrations` vazio. `git diff --ignore-cr-at-eol --stat` vazio.

## Critérios de aceite conferidos

- `webhooks-plataforma.test.ts`: 1 linha removida (só o payload de A1). `receipts-da-plataforma.test.ts`, `worker-da-plataforma.test.ts` e `contas-a-pagar-resolucao.test.ts`: 0 linhas removidas.
- `grep -c decisaoGravada webhooks-plataforma.ts` = 10; `grep -c tentativaEsperada receipts-da-plataforma.ts` = 5; `console.error(…, erro)` em `webhooks-plataforma.ts` = 0; `event_type` só os três de sempre; `STATUS_DE_RECEIPT` intocada.
- `deduped: true` dentro de `publicarResumoDaDecisao` = 0; `detalheSanitizadoDaFalha` em `step()` = 1; `receiptsDaAprovacao` em `routes.ts` = 1; `export function reprovacaoDaCategoriaNoPlano` = 1; `contas-a-pagar-resolucao.ts` só com acréscimos; `approval-comment:${runId}:rejected-comment` do legado presente (1).
- `emAndamentoDasAprovacoes` no worker = 4, `encerrarAprovacoesEsgotadas` = 3; `new RegExp` em `redigirValores` = 0.

## Mutações (script em `exec-06-16/`, sobre o arquivo commitado; restauradas com `git checkout --` e conferidas com `git diff --quiet`)

| # | Mutação | Falhou |
|---|---|---|
| M1 | varredura ignora `decisaoGravada` | V1 (e W1) |
| M2 | handler não grava a marca | V2, 06-09 A1 |
| M3 | `decisaoSuperada` sempre falsa | V3, V4, V5 (e V6, V7) |
| M4 | vigência vira `async () => true` | V6 |
| M5 | `fecharReceipt` ignora `tentativaEsperada` | Z2 (e RC3) |
| M6 | passada final fecha `falhou_retentavel` no transitório | W2, W5 |
| M7 | `limite` volta a contar candidatos | L1, 06-09 A5 |
| M8 | `console.error(…, erro)` de volta no S5 | Y1 |
| M9 | sem o retorno por Status logo depois do `lerTarefa` | S1 (e S4) |
| M10 | `antesDePublicar` ignorado em `postPaymentSummary` | S2, S3 |
| M11 | deduplicação volta a `{ deduped: true }` | Z1 (estoura o relógio de 2 s e falha, sem pendurar) |
| M12 | sem a consulta à porta em `repetirResumoDaPlataforma` | Q1, Q3 |
| M13 | `conferidoNoOmie` sem `reprovadas` | N1 |
| M14 | `step()` com `error.message` também na plataforma | F8 |
| M15 | aviso do `ListarCategorias` cru também na plataforma | F9 |
| M16 | `step()` sanitizando também a fonte ClickUp | **nenhum teste falhou** (legado + plataforma: 56/56 verdes). Sem teste do legado que a pegue; a proteção que sobra é `step()` ter um único ramo por `origemAtual()` e o legado ficar sem diff |
| M17 | `iniciar()` com um `emAndamento` só para as duas trilhas | K3 (fila em 1 consulta, esperado 3) |
| M18 | `processarAprovacoes` sem `encerrarAprovacoesEsgotadas` | K5 |
| M19 | `redigirValores` de volta ao `split(alvo)` | `omie-redacao.test.ts` (3 de 6 casos), F10 |
| M20 | M1 com o serviço real | X1b (o RESUMO sai: 1, esperado 0). X1 continua verde: a ordem por `occurredAt` ainda protege, como o plano espera |
| M21 | M3 com o serviço real | X2 (segundo RESUMO, o de A) |
| M22 | M1 + M3 juntas | X1 (e X1b, X2): o defeito da revisão inteiro de volta |

## Edições de testes existentes (só a lista fechada)

- `webhooks-plataforma.test.ts`, 06-09 A1: o `deepEqual` do payload passou a esperar também `decisaoGravada: true`.
- `payment-automation-service.plataforma.test.ts`:
  - `plataformaComTarefa`: devolve a Tarefa de `atual()` com o `status` da Tarefa que a própria `padrao.getTask` já devolve;
  - `comCenarioDoResumo`: opções novas `categorias` (padrão igual à lista de antes) e `receiptsDaAprovacao` (repassada ao construtor só quando presente).
- Imports novos só acrescentados no topo. A2–A7, K1, K2, (b), (c), (d), R4, E1, L6 e todo o resto seguem verdes sem edição.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Os seis `console.error(…, erro)` do módulo, não quatro**
- **Found during:** Task 1
- **Issue:** o plano cita quatro (comentário, decisão, S5, varredura), mas `montarHandler` e a resolução de tenant de `/comentario-criado` também registravam o objeto do erro; o critério `grep -nE 'console\.error\(.*, erro\)'` = 0 exige os seis.
- **Fix:** todos viram uma linha com o prefixo de antes, o `eventId`, o código e o resumo sanitizado.
- **Commit:** `c03eb07`

**2. [Rule 3 - Blocking] Q1–Q3 separados em três testes**
- **Found during:** Task 2 (mutação M12)
- **Issue:** escritos como um teste só, a M12 só mostrava a primeira asserção (Q1); o plano pede Q1 e Q3 falhando.
- **Fix:** separados em Q1, Q2 e Q3 no commit da Task 3 (testes criados por este plano, sem linha removida em relação à BASE). M12 rodada de novo: Q1 e Q3 falham.
- **Commit:** `c535dee`

**3. Amend no commit da Task 1 (não publicado)**
- O cabeçalho do módulo (item 5 da Task 1) ficou de fora do primeiro commit por um `Edit` que falhou. Foi incluído com `git commit --amend` só com esse caminho, antes de qualquer outra coisa (o hash final é `c03eb07`).

Fora isso, o plano foi executado como escrito.

## Conferência do E2E do crm-n1 (só leitura)

`apps/api/src/e2e/dois-servicos-suporte.ts#criarClienteDeReceiptsFalso` grava `attempts: 0` no insert (a CAS do fechamento bate), aceita `update(...).eq(...).eq(...).select()` (a marca e o fechamento funcionam) e responde `[]` a `select().eq("task_id", …)` (sem decisão gravada ⇒ nada superado). O `criarServicoFalso` não marca `resumoPendente` ⇒ o receipt fecha `concluido` no 202, como antes. Nada a mudar lá.

## Known Stubs

Nenhum.

## Deferred (do plano, confirmados)

- fin2:WR-05, parte "ideal" (prazo total por S5): os adapters não aceitam `AbortSignal`.
- Parte do fin2:WR-03 que é do legado: `step()` da fonte ClickUp continua gravando `error.message` (M16 mostra que nenhum teste do legado cobre isso).
- Resíduo do fin2:CR-01: duas decisões da mesma Tarefa entregues em paralelo antes de qualquer uma gravar a marca. Sem trava por Tarefa no banco (seria migração, só do dono, pelo SQL Editor). O RESUMO segue protegido pela releitura do Status.
- Receipts de antes deste plano (sem `decisaoGravada` nem `occurredAt`) não entram na ordem; para eles vale a releitura do Status.

Nenhuma migração foi necessária, nem `event_type`, status de receipt ou coluna nova.

## Verificação bloqueada

Nenhuma.

## Self-Check: PASSED

- Commits `c03eb07`, `522752c`, `c535dee` presentes em `financeiro-tria` (`git log --oneline 0ad567e..HEAD`).
- `automation/src/adapters/omie-redacao.test.ts` existe; os 13 arquivos modificados estão nos três commits.
- Suíte isolada 751/751; `git status --short | wc -l` = 89; `git diff --ignore-cr-at-eol --stat` vazio.
