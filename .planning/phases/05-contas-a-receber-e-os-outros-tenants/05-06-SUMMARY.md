---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 06
subsystem: dominio
tags: [automations, whatsapp, notificar, outbox, activity]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 01)
    provides: "Integration.avisosPorCanal.whatsapp e o catálogo de 6 Empresas com rótulos estáveis de destinatário"
provides:
  - "ActionSpec.canal/canalCampoDestinoId/canalDestinatariosDaEmpresa/canalMensagemId — o vocabulário de Canal de AUTO-02"
  - "destinoDeCanal — resolução pura do destino (Campo da Tarefa ou rótulos da Empresa), sem default (D5-10)"
  - "case \"notificar\" ganha o ramo de Canal, com recusa visível e sem I/O (D5-09/D3-02)"
  - "PedidoDeNotificacaoPorCanal + pedidosDeNotificacaoPorCanal — o pedido pobre e determinístico que o apps/api (05-07) lê para gravar no outbox"
affects: ["05-07 (outbox grava automacao.notificar-canal.v1 lendo pedidosDeNotificacaoPorCanal)", "rota do canal em automation/ (consome o pedido, resolve o segredo pelo rótulo)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ramo de Canal dentro de um `case` existente, com `return` antecipado — o comportamento anterior (in-app) só roda se `spec.canal` estiver ausente, nenhuma duplicação de lógica"
    - "Resolução de destino isolada numa função pura (`destinoDeCanal`), reusada tanto pela execução (`runAction`) quanto pela leitura pós-hoc (`pedidosDeNotificacaoPorCanal`) — nunca dois lugares decidindo a mesma coisa de formas diferentes"
    - "Recusa e sucesso viram `ActivityEntry` via `recordActivity`, nunca Comentário — mesmo precedente de `recusar()` da Fase 3"
    - "Payload pobre: o pedido carrega id de Campo ou rótulo, nunca o valor/número; quem precisa do dado de verdade busca a Tarefa de volta"

key-files:
  created:
    - packages/dominio/src/operations/automations-canal.test.ts
  modified:
    - packages/dominio/src/operations/automations.ts

key-decisions:
  - "canalCampoDestinoId e canalDestinatariosDaEmpresa são mutuamente exclusivos por construção (XOR): declarar os dois, ou nenhum dos dois, é recusa — nunca uma prioridade implícita entre os dois modos"
  - "mascararDestino expõe os quatro últimos caracteres com separador de espaço (•••• 1234); valores com menos de 4 caracteres mostram só •••• (sem sufixo)"
  - "pedidosDeNotificacaoPorCanal re-resolve o destino chamando a MESMA destinoDeCanal usada em runAction, nunca lê o texto humano de step.output — o texto é para humano, não contrato"
  - "Teste usa CP.fields.whatsapp (já existente, já reachable em CP.listId) no papel do Campo 'Z WhatsApp' da UI-SPEC, e CP.fields.empresa real (o mesmo que destinoDeCanal lê hardcoded) — nenhum Campo/Lista novo criado só para o teste"

requirements-completed: [AUTO-02]

# Metrics
duration: ~14min
completed: 2026-09-24
---

# Phase 05 Plan 06: O canal WhatsApp de `notificar` (AUTO-02) Summary

**`case "notificar"` ganha um ramo de Canal que resolve o destino (Campo da Tarefa ou rótulos da Empresa), recusa visivelmente quando vazio, nunca faz I/O, e produz um pedido pobre e determinístico para o `apps/api` gravar no outbox.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 2 (1 criado, 1 modificado)

## Accomplishments

- `ActionSpec` ganha `canal?: "whatsapp"`, `canalCampoDestinoId?: Id`, `canalDestinatariosDaEmpresa?: boolean` e `canalMensagemId?: "gasto-novo" | "relatorio"` — o enum de dois valores é deliberado (D5-11: escopo é o que o Marcos Paulo já faz, não canal genérico).
- `destinoDeCanal` (função pura, interna) resolve o destino em três formas de recusa antes de qualquer sucesso: os dois modos declarados juntos (ou nenhum), Campo vazio, ou Empresa sem Integração/sem `avisosPorCanal.whatsapp` — em nenhum caminho devolve um destino padrão (D5-10).
- `case "notificar"` ganha o ramo de Canal ANTES do comportamento in-app existente, com `return` antecipado quando `spec.canal === "whatsapp"` — o in-app não roda junto, e nenhum `fetch`/`await`/import de rede entra no arquivo (D5-09/D3-02, verificado por `grep`).
- Ambos os desfechos (recusa e sucesso) viram `ActivityEntry` via `recordActivity` — nunca Comentário fantasma — com `action: "tentou notificar por WhatsApp e recusou"` ou `action: "notificou por WhatsApp"`, e `detail` mascarado (`mascararDestino`: só os quatro últimos caracteres, `••••` fixo).
- `PedidoDeNotificacaoPorCanal` + `pedidosDeNotificacaoPorCanal` (exports novos, fim do arquivo): para cada passo `concluido` de uma Execução, re-resolve o destino chamando a MESMA `destinoDeCanal` — nunca lê `step.output` (texto para humano, não contrato) — e monta um pedido com `campoDestinoId` OU `rotulos`, nunca os dois, e nunca o valor/número.
- `automations-canal.test.ts` (9 testes): os 7 casos do plano (a–g) mais um teste dedicado de "recusa vira Atividade, nunca Comentário" e um de determinismo de `pedidosDeNotificacaoPorCanal`.

## Task Commits

Each task was committed atomically:

1. **Task 1: O vocabulário de Canal e o ramo que recusa em vez de adivinhar** - `fb7e153` (feat)
2. **Task 2: O pedido que o apps/api vai ler, e a Execução que a Tarefa mostra** - `aaad9fd` (feat)

## Files Created/Modified

- `packages/dominio/src/operations/automations.ts` — quatro campos novos em `ActionSpec`, `DestinoDeCanal`/`destinoDeCanal`/`mascararDestino`, o ramo de Canal em `case "notificar"` (com os dois `recordActivity`), `PedidoDeNotificacaoPorCanal`/`pedidosDeNotificacaoPorCanal`
- `packages/dominio/src/operations/automations-canal.test.ts` — 9 testes cobrindo recusa por destino vazio, os dois modos (Campo/Empresa), não-regressão do in-app, mascaramento e determinismo (novo)

## Decisions Made

- `canalCampoDestinoId`/`canalDestinatariosDaEmpresa` são XOR por construção: `porCampo === porEmpresa` (ambos `true`/ambos `false`) é a mesma recusa — evita um `if/else if` que escolheria um modo silenciosamente se alguém declarasse os dois por engano.
- `mascararDestino` usa `•••• 1234` (com espaço) para bater literalmente com o texto da UI-SPEC §5 (`"Campo "Z WhatsApp": •••• {últimos 4 dígitos}"`), e `••••` sozinho quando o valor tem menos de 4 caracteres (nenhum índice negativo fora do array).
- O teste reusa `CP.fields.whatsapp` (Campo real, tipo `phone`, já definido em `CP.listId`) no papel do Campo "Z WhatsApp" da UI-SPEC, em vez de criar um Campo/Lista/Espaço novo só para o teste — `destinoDeCanal` é agnóstico ao NOME do Campo (lê por id), então qualquer Campo de texto reachable serve; e `CP.fields.empresa` é o Campo REAL que a função lê hardcoded no modo Empresa, não um substituto.
- A Integração de "Marcos Paulo" usada no teste (caso c) é empurrada diretamente em `state.integrations` (não via o evolver de 05-01), simulando o resultado de `npm run empresas:configurar -- --apply` já ter rodado — o mesmo padrão de fixture direta que `automations-motor.test.ts` já usa para Automações.

## Deviations from Plan

None — plano executado como escrito. Uma nota de precisão, não uma mudança de escopo: o critério de aceite da Task 2 cita `state.comments`, mas Comentários vivem em `task.comments` (não há coleção `comments` solta em `DataState`); o teste (caso b) afirma `t.comments.length` antes/depois, que é a leitura correta do mesmo requisito ("nenhum Comentário foi criado na Tarefa").

## Issues Encountered

Um ajuste de texto durante a Task 1: o comentário original que documentava a ausência de I/O usava a palavra `fetch` entre crases — que o próprio critério de aceite da Task 1 proíbe via `grep -n "fetch\|XMLHttpRequest\|axios"`. Reescrito para "nenhuma chamada de rede" antes do primeiro commit; nenhum código de produção foi afetado, só o texto do comentário. Verificado com o mesmo `grep` do critério, agora sem ocorrência.

## User Setup Required

None — nenhuma configuração de serviço externo. Este plano não chama a Evolution API nem grava no outbox (isso é 05-07); só produz o pedido em memória que 05-07 vai ler.

## Verificação executada nesta sessão (regras operacionais do projeto)

- `npm run typecheck -w @n1/dominio` — verde
- `npm run typecheck -w @n1/web` — verde
- `npm run typecheck -w @n1/api` — verde
- `npm run test -w @n1/dominio -- automations` — 26/26 verde (Task 1)
- `npm run test -w @n1/dominio -- automations-canal` — 9/9 verde (Task 2)
- `npm run test -w @n1/dominio` (suíte inteira, rápida, autorizada pelas regras operacionais) — 497/497 verde
- `npm run test -w @n1/web` (suíte inteira, rápida) — 167/167 verde
- `npm run lint` — verde
- `grep -n "fetch\|XMLHttpRequest\|axios" packages/dominio/src/operations/automations.ts` — nenhuma linha
- `grep -c "canalMensagemId" packages/dominio/src/operations/automations.ts` — 3 (≥ 3, critério de aceite)
- `grep -rn "MP_WHATSAPP\|5514998380047\|5511933441997\|@g.us" packages/dominio/src/operations/automations.ts packages/dominio/src/operations/automations-canal.test.ts` — nenhuma linha (os matches do mesmo grep em outros arquivos do repositório — `configuracao-por-empresa.ts` comentário do Plan 05-01, e `seed-ferramentas.ts`/`provedor-simulado.ts` do módulo "Ferramentas" — são pré-existentes e fora do escopo `files_modified` deste plano)
- `git -C "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria" status --short` — inalterado por esta sessão (o conjunto de arquivos modificados é o mesmo estado pré-existente já documentado em STATE.md, regeneração shadcn/Lovable de sessões anteriores; nada deste plano tocou o segundo repositório)
- **NÃO executado, por regra operacional do projeto:** `npm run check` completo e qualquer teste de `apps/api` sem filtro de arquivo (a suíte fala com Postgres real e estoura o watchdog de 600s do agente) — fica para o orquestrador/verificador da fase. Este plano não modificou nenhum arquivo de `apps/api`.

## Next Phase Readiness

- AUTO-02 (domínio) está pronto para 05-07 ler `pedidosDeNotificacaoPorCanal(state, execucoes)` depois de rodar a agenda/evento e gravar `automacao.notificar-canal.v1` no outbox — a assinatura já devolve exatamente `taskId`/`automationId`/`executionId`/`canal`/`destinoTipo`/`campoDestinoId`/`rotulos`/`mensagemId`, sem nenhum valor sensível.
- Nenhuma Automação real (A1–A9, R1–R7) foi publicada usando o Canal ainda — isso é decisão de operação/produto, fora deste plano (que só entrega o vocabulário e o executor).
- Nenhum bloqueio para 05-07 ou para a rota nova em `automation/`.

## Self-Check: PASSED

Arquivo criado encontrado em disco (`packages/dominio/src/operations/automations-canal.test.ts`); os dois commits de Task (`fb7e153`, `aaad9fd`) encontrados em `git log --oneline --all`. Verificado por comando, não por leitura: os quatro `FOUND` acima (dois arquivos, dois commits) confirmam.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
