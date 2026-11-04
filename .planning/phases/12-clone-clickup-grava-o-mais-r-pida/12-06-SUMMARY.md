---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 06
subsystem: web
tags: [store, confirmado, data, fila, otimista, rehidratacao]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: Transporte.gravar com a lista de respostas e enviar que aplica cada diferença em ordem (12-05); o servidor com a trava no começo e uma tentativa só (12-04)
provides:
  - StoreShape.confirmado (o que o servidor devolveu) ao lado de data (o que a tela mostra), com copy-on-write
  - run/runConfirmado que põem a cópia aceita em data na hora; a recusa, a falha e o conflito a tiram e mostram o erro do servidor em lastResult
  - fila serial de gravações e de re-hidratações (processarFila), com o primeiro envio síncrono
  - refazerPendentes, que reconstrói data sobre confirmado pelo registro OPERACOES
  - apps/web/CONTEXT.md com o modelo novo
affects: [12-07, 12-08, 12-09, 12-10]

actuals:
  tokens: 10346
  tasks: 2
  commits: 5
plan_head_before: 5b1ee87f95ed03eba9264af1503f694abf4a257b
plan_head_after: 38d8627ae05b03c084021d30e9392243af8c0b5a

tech-stack:
  added: []
  patterns:
    - "Dois estados no store (confirmado/data): só confirmado recebe aplicarDiferenca; data é confirmado com as pendentes refeitas por cima, e é o MESMO objeto quando nada está a caminho"
    - "Fila serial com laço (processarFila): o primeiro gravar é chamado antes do primeiro await; quem enfileira só põe o item"
    - "A pendente que respondeu sai da fila ANTES da reconstrução; a que falha ao ser refeita sai com o erro e nunca é enviada"

key-files:
  created: []
  modified:
    - apps/web/src/dados/store.ts
    - apps/web/src/dados/store.test.ts
    - apps/web/CONTEXT.md
    - apps/web/src/features/shell/arvore-menu.test.tsx
    - apps/web/src/features/shell/arvore-arrastavel.test.tsx
    - apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx
    - apps/web/src/features/tarefa/painel-aprovacao.test.tsx

key-decisions:
  - "Copy-on-write: a cópia que o run já clonava vira data; confirmado continua o objeto anterior, que ninguém muta. Sem pendente otimista, data === confirmado."
  - "Quando uma pendente falha ao ser refeita por cima, o erro dela resolve a promessa dela mas NÃO encobre em lastResult a recusa que a derrubou (a causa continua à vista). Só aparece em lastResult quando não houve outra falha no mesmo ciclo."
  - "O pedido é montado na hora do envio (revisao = revisaoDoServidor corrente), não na hora do clique: o segundo pedido leva a revisão que a resposta do primeiro devolveu."
  - "rehidratar() público virou um item da fila (promessa que resolve ou rejeita como antes); a re-hidratação de dentro de enviar chama a função interna direto, sem entrar na fila."
  - "PedidoDeGravacao.copia continua sendo a cópia do clique (só o transporte em memória, de teste, a lê); não é atualizada pela reconstrução."

patterns-established:
  - "Teste de store com transporte que não responde até o teste soltar (segurarGravacoes) para afirmar o que a tela mostra ANTES da resposta"

requirements-completed: []

coverage:
  - id: D1
    description: "run(createList) põe a Lista em data antes de o transporte responder, e não em confirmado; a confirmação põe a Lista do servidor em confirmado e data é o mesmo objeto"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts describe 'D-13 — a mudança aparece na hora' e o caso (b)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A recusa do servidor (ok:false), a falha de transporte e o conflito tiram a mudança de data e lastResult traz a mensagem do servidor; data volta a ser o mesmo objeto que confirmado"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts D-13 (recusa, falha), D-16 (conflito) e o caso (f)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dois e três run seguidos saem um de cada vez, na ordem do clique, e as respostas entram na revisão (7→8→9→10) sem re-hidratar"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts describe 'D-16 — um pedido por vez' (dois e três run)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A recusa do primeiro refaz o segundo (independente: segue e é confirmado; dependente: falha ao ser refeito, some com o erro e o transporte é chamado uma vez só)"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts D-16 (recusado + independente; criar e renomear)"
        status: pass
    human_judgment: false
  - id: D5
    description: "rehidratar() de fora com um pedido em voo espera a resposta; a Lista que o pedido criou aparece uma vez só (Pitfall 3); com a fila vazia roda na hora; verificarRevisao não pergunta com gravação na fila"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts D-16 (Pitfall 3, fila vazia, verificarRevisao) e os casos (i), (m), (o), (q)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Os testes de tela da Fase 10 e o do painel de aprovação afirmam o lugar novo já na tela, com aria-busy/diálogo até a resposta, e a recusa devolve o estado antigo com o erro"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "arvore-menu.test.tsx, arvore-arrastavel.test.tsx, mover-conteiner-dialog.test.tsx, painel-aprovacao.test.tsx (suíte web inteira: 92 arquivos, 867 testes)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A tela responde mais depressa ao clique no navegador de verdade (o ganho percebido de GRV-05) e o custo do structuredClone de confirmado com pendentes no ws_n1"
    requirement: GRV-05
    verification: []
    human_judgment: true
    rationale: "Provado só por transporte falso e jsdom. A premissa A8 do plano (custo do clone no navegador) não foi medida; a medição clique-até-tela é trabalho à parte (Deferred) e o 'depois' é do 12-10."

duration: 15min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 06: A mudança na tela antes da resposta, e os pedidos em fila Summary

**`store.ts` passa a guardar `confirmado` (o que o servidor devolveu, único alvo de `aplicarDiferenca`) e `data` (o que a tela mostra, com a cópia aceita pelo domínio já dentro, no mesmo objeto de `confirmado` quando nada está a caminho); as gravações saem uma de cada vez, na ordem do clique, e a recusa, a falha ou o conflito tiram só a mudança recusada e mostram a mensagem do servidor, refazendo o que depende dela por cima do `confirmado` pelo registro `OPERACOES`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-11-02
- **Tasks:** 2 de 2 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 7 (nenhum novo), 684 linhas acrescentadas e 84 removidas

## Accomplishments

- **Dois estados (D-13).** `StoreShape.confirmado` (leitura). Estado inicial: `confirmado` e `data` são o mesmo objeto. `rodarNaCopia`: a cópia que o domínio aceita e que registrou ao menos uma chamada (`otimistaPara`) vira `data` na hora; a `Pendente` guarda as `chamadas` clonadas por `structuredClone` (o gravador as guarda por referência), a `copia`, o `resultado` e o `concluir` da promessa de `runConfirmado`. Uma cópia aceita sem nenhuma chamada registrada não vira `data` e continua indo ao transporte, que responde a falha de hoje.
- **Refazer por cima (D-13, D-14).** `refazerPendentes()`: sem pendente otimista, `data = confirmado` (zero cópia); com, `structuredClone(confirmado)`, `syncIdSequence(copia, sequenciaDoServidor)` e, em ordem, cada chamada por `OPERACOES[nome](copia, memberId, ...args)` (cast `OperacaoDoRegistro`, o mesmo de `apps/api/src/rotas/operacoes.ts`). Se uma pendente recusa ou lança ao ser refeita, sai da fila, a promessa dela resolve com o erro, e a reconstrução recomeça do `confirmado` sem ela.
- **`enviar`.** Monta o pedido na hora do envio (`revisao: revisaoDoServidor`). As diferenças entram em `confirmado`; `estado` (transporte em memória) vira `confirmado`; resposta fora de ordem e conflito chamam a re-hidratação interna (`hidratarAgora`, que só põe em `confirmado`). Nenhum caso toca `data`: `terminar(pendente, resultado)` tira a pendente da fila ANTES de `refazerPendentes()` e só então resolve a promessa.
- **A fila (D-16, Pitfall 3, Pitfall 8).** `processarFila()` é um laço sobre `fila: ItemDaFila[]` com `emVoo`. O `transporte.gravar` do primeiro item é chamado antes do primeiro `await` (o caso (b) afirma a chamada logo depois de `run()`); os seguintes esperam. `rehidratar()` público é um item `rehidratar` da mesma fila (resolve ou rejeita como antes): espera o pedido em voo, busca `GET /estado` e refaz só o que ainda não saiu. `pendentes` conta os itens `gravar` na fila; `verificarRevisao` não mudou.
- **Documentação.** O cabeçalho de `store.ts` e o parágrafo de `apps/web/CONTEXT.md` descrevem `confirmado`/`data`, a fila e o D-14; a frase de que o estado real só muda quando o diff volta saiu dos dois, e dos cabeçalhos dos três testes de tela que a repetiam.

## Task Commits

1. **Task 1 (traçador), RED** — `0d38e3b` (test): 6 casos falharam nas asserções planejadas (a Lista não estava em `data` antes da resposta; `confirmado` inexistente; o caso (b) reescrito falhou em `expected false to be true` ao procurar o comentário em `data`).
2. **Task 1 (traçador), GREEN** — `16c5e41` (feat): `confirmado`/`data`, `refazerPendentes`, `OPERACOES`; os testes de tela reescritos.
3. **Task 2, RED** — `20da81c` (test): cinco casos do `describe` "D-16 — um pedido por vez" falharam (`gravar` chamado 2 vezes em vez de 1, ordem `[A, B, C]` em vez de `[A]`, revisão 7 em vez de 9, `hidratar` chamado antes de o pedido responder).
4. **Task 2, GREEN** — `46fd425` (feat): a fila serial, `rehidratar` na fila e o `CONTEXT.md` da web.
5. **Cabeçalhos** — `38d8627` (test): os comentários de `arvore-arrastavel.test.tsx` e `mover-conteiner-dialog.test.tsx` passam a citar D-13.

**Plan metadata:** commit `docs(12-06)` que carrega este SUMMARY, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): o `<verify>` era só automatizado; foi rodado de ponta a ponta (`tsc`, `src/dados` e a suíte web inteira) antes de a Task 2 começar, sem checkpoint.

## TDD Gate Compliance

Task 1: `test(12-06)` (`0d38e3b`) antes de `feat(12-06)` (`16c5e41`), RED legítimo: os testes novos falharam na asserção planejada, não em erro de sintaxe, importação ou fixture. Dois dos casos novos (o `run` sem chamadas e a fila vazia) já passavam no RED por descreverem comportamento que o plano manda preservar; ficam como guardas, não como prova do comportamento novo. Nenhum `refactor`.

Task 2: `test(12-06)` (`20da81c`) antes de `feat(12-06)` (`46fd425`), RED legítimo: cinco dos oito casos falharam por causa do envio em paralelo (planejado). Os outros três (recusa do primeiro com o segundo independente, fila vazia, `verificarRevisao`) passaram já no RED porque o envio em paralelo da Task 1 produz o mesmo resultado nesses cenários; seguem como guardas e continuam passando com a fila.

## Os testes de tela reescritos

Pitfall 10: D-13 inverte o que esses testes afirmavam sobre o estado entre o clique e a resposta. Nenhum foi apagado nem afrouxado; cada um passou a afirmar o lugar novo já na tela.

| Arquivo | Teste | Antes | Depois |
|---|---|---|---|
| `features/shell/arvore-menu.test.tsx` (:385) | durante a gravação a árvore fica aria-busy… | `filhosDe(P)` igual a `[alfa, beta, gama]` ("a tela ainda não mudou") | `filhosDe(P)` igual a `[beta, alfa, gama]`; `aria-busy`, itens desligados e `gravar` 1 vez ficam |
| `features/shell/arvore-arrastavel.test.tsx` (:262) | o traçador: soltar «dentro» da Pasta… | `paiNaArvore(PROPOSTAS)` igual a `fld_propostas` com o servidor segurado | igual a `fld_clientes`; `ul[aria-busy]` e a ausência do aviso ficam até soltar |
| `features/shell/arvore-arrastavel.test.tsx` (:466, :478) | durante a gravação a árvore fica aria-busy… (A4) | não afirmava a ordem durante a espera (já passava) | acrescenta `filhosDe(P)` igual a `[GAMA, ALFA, BETA]` durante a espera; as asserções antigas ficam |
| `features/estrutura/mover-conteiner-dialog.test.tsx` (:451) | enquanto grava, o botão fica carregando com "Movendo…"… | não afirmava a árvore durante a espera (já passava) | acrescenta que a Lista já está sob `spc_ops` na árvore; "Movendo…", o diálogo aberto, o aviso ausente e o parâmetro `mover` ficam |
| `features/tarefa/painel-aprovacao.test.tsx` (:228) | CTAs desabilitados e label «Aprovando…» (e) | esperava o botão «Aprovando…» desabilitado com o servidor segurado | reescrito: a decisão já aparece ("Aprovação concluída"), o diálogo fecha e o aviso "Solicitação aprovada; a Execução retomou." é dado uma vez; depois a recusa do servidor devolve "Aprovação pendente" |

O último não estava na lista do plano: apareceu ao rodar a suíte inteira, como o Pitfall 10 prevê. `useDecisaoDeAprovacao` trata a decisão em `data` como sucesso, então com D-13 o diálogo fecha e o aviso de sucesso sai antes da resposta. Ver "Pendências" abaixo.

O caso "a recusa do servidor vai ao Toast de erro com a frase, e a árvore fica como estava" (`arvore-menu.test.tsx`) passa sem mudar a asserção final (D-14).

## Verification

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx vitest run src/dados`: 10 arquivos, 119 testes, todos passaram.
- `cd apps/web && npx vitest run` (suíte web inteira): 92 arquivos, 867 testes, todos passaram.
- `npm run lint -w @n1/web`: exit 0 (0 erros; 2 avisos de variável não usada em `features/ia/conhecimento/rotulos.ts` e `features/shell/app-shell.tsx`, anteriores a este plano e fora de escopo).
- Critérios de aceitação: `readonly confirmado: DataState` (1); `OPERACOES[` (1); `syncIdSequence` (3); a frase "só muda quando o diff volta" não existe mais em `store.ts`; `aria-busy` 5/5/1 e `Movendo…` 2 e `get("mover")).toBe(ALFA)` 2 nos três arquivos de tela; `D-16` em `store.ts` (2); `confirmado` em `apps/web/CONTEXT.md` (7); o caso (b) afirma o comentário em `data` e ausente em `confirmado`.
- `git status --porcelain -- apps/api packages`: vazio. Nenhum commit do plano toca `apps/api` nem `packages/dominio`.
- `npm test` da raiz não foi rodado (inclui `apps/api`, que fala com o banco do `.env`); `npm run build` da web é do orquestrador. Nada foi publicado nem acessado em produção.

## Decisions Made

Ver `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Teste que afirmava o estado intermediário] `painel-aprovacao.test.tsx` (e) reescrito**
- **Found during:** Task 1 (suíte web inteira)
- **Issue:** o teste esperava o botão «Aprovando…» com o servidor segurado; com D-13 a decisão já está em `data`, o controlador a toma por sucesso e o diálogo fecha.
- **Fix:** o teste afirma o contrato novo (decisão na hora, diálogo fechado, aviso uma vez) e a volta a "Aprovação pendente" quando o servidor recusa. A tela de produção (`painel-aprovacao.tsx`) não foi mexida.
- **Files modified:** `apps/web/src/features/tarefa/painel-aprovacao.test.tsx`
- **Commit:** `16c5e41`

### Registrados, sem mudança de comportamento

**2. [Escolha dentro do plano] O erro de uma pendente refeita não encobre a causa em `lastResult`**
- O plano diz que `lastResult` recebe o erro da pendente que falha ao ser refeita. Se a causa (a recusa do servidor que a derrubou) já está em `lastResult` no mesmo ciclo, o erro da refeita ("Lista não encontrada") a encobriria e a pessoa nunca veria o motivo real. `refazerPendentes(causaJaMostrada)` mantém a causa; sem outra falha no ciclo o erro da refeita aparece. A promessa da pendente refeita resolve sempre com o erro dela. Provado no caso "criar e renomear".

**3. [Plano] `otimistaPara` e a lista de exceções**
- `otimistaPara(chamadas)` é `chamadas.length > 0`, como o plano manda; o 12-07 acrescenta a lista de operações que esperam o servidor.

---

**Total deviations:** 1 auto-fixada (Rule 1, um teste de tela); 2 registradas sem mudança de comportamento.
**Impact on plan:** nenhum no escopo. Ver a pendência sobre a aprovação.

## Issues Encountered

Nenhum.

## Pendências e o que ficou em aberto

- **Decisão de aprovação fecha o diálogo antes da resposta.** Com D-13, `decideProcessApproval` (e a conferência do resumo, que usa o mesmo molde em `painel-conferencia-do-resumo.tsx`) mostra "Aprovação concluída" e o aviso de sucesso antes de o servidor responder; se ele recusa, a Solicitação volta a pendente com o erro no cartão, mas o diálogo já fechou. É a decisão de produto de "o que espera o servidor" (12-07): se uma aprovação não deve parecer decidida antes da confirmação, `decideProcessApproval` entra na lista de exceções de D-13. Não foi alterada aqui.
- **Custo do `structuredClone` de `confirmado` com pendentes** (premissa A8): não medido no navegador. Com fila de um não há clone a mais; com dois cliques seguidos há um clone e um refazer por resposta.
- **`runConfirmado(...).local.value`** passa a ser um objeto vivo dentro de `data` e fica velho depois da reconstrução; quem só lê `local.ok` não sofre, quem navega usa o `confirmado` (o diálogo de criação já faz isso). Registrado em `apps/web/CONTEXT.md`.
- **GRV-05** não foi marcado como concluído: o ID é compartilhado com 12-07, 12-08 e 12-09 (a lista de exceções, o "salvando" sem link, a guarda de navegação), e só fecha com o último deles.

## Known Stubs

None.

## Threat Flags

None. T-12-14 (mudança mostrada e recusada): mitigado, a pendente sai, `data` volta a `confirmado` mais as pendentes que sobram e `lastResult` traz a mensagem do servidor; casos de recusa e falha. T-12-15 (reconstrução que refaz o que o servidor confirmou): mitigado, a pendente sai da fila antes de reconstruir e `rehidratar` de fora entra na fila; caso do Pitfall 3. T-12-16 (pendente cuja reconstrução falhou enviada ao servidor): mitigado, a que falha sai antes do envio; caso "criar e renomear" com `gravar` chamado uma vez. O aviso ao fechar a aba continua do 12-09.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-07 consulta `OPERACOES_QUE_ESPERAM` em `otimistaPara(chamadas)`; o ponto de extensão já existe em `store.ts`.
- 12-08 pode ler `confirmado` (já exposto no `StoreShape`) para o "salvando" sem link.
- 12-09 pode ler `pendentes` (agora a contagem de gravações na fila) para o aviso ao fechar a aba.
- Nada foi publicado: o código novo da web só chega ao dono por um deploy mandado por ele.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `apps/web/src/dados/store.ts`, `store.test.ts`, `apps/web/CONTEXT.md` e `painel-aprovacao.test.tsx`: FOUND.
- `git merge-base --is-ancestor` para `0d38e3b`, `16c5e41`, `20da81c`, `46fd425` e `38d8627`: FOUND.
- `git rev-list --count 5b1ee87..HEAD` = 5 (medido imediatamente antes de escrever o SUMMARY, a partir do registro em disco do ponto de partida).
