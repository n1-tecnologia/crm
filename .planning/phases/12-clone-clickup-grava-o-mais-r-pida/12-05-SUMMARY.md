---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 05
subsystem: web
tags: [store, transporte, diferenca, revisao, hidratacao]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: o servidor grava com a trava no começo e uma tentativa só (12-04); a parada do dono, sem meta numérica (12-03)
provides:
  - Transporte.gravar com a lista de respostas (uma por chamada, em ordem), aceitando ainda uma resposta só para as fakes de teste
  - transporteHttp e transporteEmMemoria que devolvem sempre a lista
  - enviar (store.ts) que percorre as respostas e aplica cada diferença só se a revisaoAnterior bater com a revisão do servidor que o store tem
  - respostasDe (interna) e a prova de GRV-04 em store.test.ts
affects: [12-06, 12-10]

actuals:
  tokens: 5040
  tasks: 2
  commits: 3
plan_head_before: 954dd956a224a5cfdd8f409e54dfdc7084c6cca9
plan_head_after: e63e6b8dca0d665554559d00e8d55114c542d160

tech-stack:
  added: []
  patterns:
    - "Contrato com união (resposta | lista) na interface e normalização num ponto só (respostasDe): as ~48 fakes de teste seguem valendo sem edição"
    - "Auxiliares de teste que falham se a implementação real não devolver lista (gravarLista), em vez de normalizar por cima"

key-files:
  created: []
  modified:
    - apps/web/src/dados/transporte.ts
    - apps/web/src/dados/transporte.test.ts
    - apps/web/src/dados/store.ts
    - apps/web/src/dados/store.test.ts

key-decisions:
  - "Transporte.gravar devolve Promise<RespostaDeGravacao | readonly RespostaDeGravacao[]>; as duas implementações reais sempre devolvem lista e store.ts normaliza com Array.isArray em respostasDe (Open Question 2). Nenhuma fake de teste foi editada."
  - "O resultado de enviar é o da última resposta processada; uma lista vazia (só possível numa fake) cai no catch e vira a frase genérica de falha, em vez de resolver como sucesso."
  - "Uma diferença que não encaixa re-hidrata uma vez e devolve na hora: o GET /estado já traz as chamadas seguintes, que o servidor confirmou antes de gravar() devolver (D-12)."

patterns-established:
  - "enviar percorre as respostas com switch dentro do laço: diferença que encaixa segue para a próxima; estado, conflito, falha e diferença fora de ordem terminam com return"

requirements-completed: [GRV-04]

coverage:
  - id: D1
    description: "transporteHttp devolve a lista de respostas na ordem das chamadas e para na primeira que não for diferença; zero chamadas devolve uma lista com a falha de hoje, sem fetch; transporteEmMemoria devolve uma lista de um estado"
    requirement: GRV-04
    verification:
      - kind: unit
        ref: "apps/web/src/dados/transporte.test.ts (g, g2, f, i e os casos de uma chamada)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um run com duas chamadas recebe duas diferenças encadeadas (7→8, 8→9), aplica as duas, termina em revisaoDoServidor 9 e não chama hidratar"
    requirement: GRV-04
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts caso (s)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A resposta que não encaixa re-hidrata uma vez (D-12); conflito no meio aplica as anteriores e re-hidrata; falha no meio aplica as anteriores sem re-hidratar; recusa do servidor dentro de uma diferença aplica a diferença vazia e marca lastResult; o caso (d) segue com a mesma asserção"
    requirement: GRV-04
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts casos (t), (u), (v), (w) e (d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Existe, em produção, um gesto de tela que faça duas operações do registro numa closure só"
    requirement: GRV-04
    verification: []
    human_judgment: true
    rationale: "Hoje nenhum: o chat faz dois run separados (RESEARCH A7). O comportamento vale como robustez e para a fila do 12-06, e é provado por transporte falso; se uma tela passar a fazer isso, herda o comportamento sem mudança."

duration: 6min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 05: A lista de respostas de um gesto no store Summary

**`transporteHttp` e `transporteEmMemoria` passam a devolver a lista de respostas (uma por chamada, em ordem) e `enviar` aplica cada diferença encadeada só se a `revisaoAnterior` bater com a revisão que o store tem, de modo que um `run` com duas chamadas termina na revisão 9 sem `GET /estado`; a resposta fora de ordem, o conflito e a outra pessoa gravando no meio continuam recarregando o Espaço.**

## Performance

- **Duration:** 6 min
- **Completed:** 2026-11-02T13:38Z
- **Tasks:** 2 de 2 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 4 (nenhum novo), 277 linhas acrescentadas e 87 removidas

## Accomplishments

- **Contrato.** `Transporte.gravar` devolve `RespostaDeGravacao | readonly RespostaDeGravacao[]` (JSDoc citando D-11 e a decisão da Open Question 2). `store.ts` normaliza com `respostasDe`/`Array.isArray`. As fakes de teste que devolvem uma resposta só não foram tocadas.
- **`transporteHttp.gravar`** acumula as respostas, uma por chamada, e para depois da primeira que não for `diferenca`; com zero chamadas devolve `[{ tipo: "falha", erro: "Esta ação não passa por uma operação do domínio e não foi gravada." }]` sem chamar `fetch`. **`transporteEmMemoria.gravar`** devolve uma lista de um `estado`. O comentário que citava `(shell)/page.tsx` foi reescrito: cada chamada é uma transação no servidor, o cliente aplica as respostas em ordem, e hoje nenhuma tela faz duas operações numa closure só.
- **`enviar`** percorre as respostas. Cada `diferenca` é comparada com `get().revisaoDoServidor` no momento (a primeira contra a revisão do store, a segunda contra a que a primeira devolveu); se encaixa, `aplicarDiferenca` e avança `revisaoDoServidor`/`sequenciaDoServidor`; se não, `rehidratar()` uma vez e devolve. `conflito` aplica as anteriores, re-hidrata e mostra o erro; `falha` aplica as anteriores e mostra o erro sem re-hidratar. O resultado devolvido é o da última resposta processada ou o erro que interrompeu a lista.
- **Provas.** `store.test.ts`: (s) duas diferenças encadeadas 7→8 e 8→9, revisão 9, `hidratarMock` sem chamada, `confirmado` com o resultado da última; (t) segunda com `revisaoAnterior` 10: a primeira entra, `hidratarMock` 1 vez, estado final do `GET /estado` falso; (u) diferença e conflito; (v) diferença e falha (`hidratarMock` 0 vezes); (w) segunda com recusa do servidor. O caso (d) não mudou. `transporte.test.ts`: os casos de uma chamada passam por `gravarPrimeira`, (g) vira a lista 7→8, 8→9, (g2) prova que a lista para no conflito sem disparar a terceira chamada, (f) e (i) pela lista.

## Task Commits

1. **Task 1 (traçador), RED** — `be6cad7` (test): 10 dos 14 casos de `transporte.test.ts` falharam em "esperava a lista de respostas (D-11)" e o caso (s) falhou em `expect(servidor).toEqual({ ok: true, value: undefined })` (recebeu `undefined`: a lista inteira caía no `switch` sem `tipo`).
2. **Task 1 (traçador), GREEN** — `72b89f7` (feat): contrato com lista, `transporteHttp`/`transporteEmMemoria` e o laço de `enviar`.
3. **Task 2** — `e63e6b8` (test): os quatro casos de borda (t)–(w). Sem RED possível: ver "TDD Gate Compliance".

**Plan metadata:** commit `docs(12-05)` que carrega este SUMMARY, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): o `<verify>` era só automatizado; foi rodado de ponta a ponta (`tsc` e os dois arquivos de teste) antes de a Task 2 começar, sem checkpoint.

## TDD Gate Compliance

Task 1: `test(12-05)` (`be6cad7`) antes de `feat(12-05)` (`72b89f7`), RED legítimo: falhou nas asserções planejadas (lista esperada; resultado da última resposta), não em erro de sintaxe, importação ou fixture. Nenhum `refactor`.

Task 2: **verde inesperado na fase RED, investigado.** Os quatro casos de borda passaram na primeira execução porque o laço de `enviar` escrito na Task 1 já termina com `return` em toda resposta que não é uma diferença que encaixa (a diferença fora de ordem, o conflito e a falha saem do laço exatamente como o plano descreve para a Task 2). Não há código de produção para a Task 2; ela ficou só com o commit `test`, que fixa as bordas. Para provar que os testes não são vácuos, foi feita uma mutação temporária e revertida em `store.ts`: (1) com a comparação de revisão desligada, falharam (d), (j) e (t); (2) sem o `rehidratar()` do `conflito`, falharam (e) e (u). O arquivo foi restaurado da cópia salva (`git diff` vazio) antes do commit.

## Verification

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx vitest run src/dados/store.test.ts src/dados/transporte.test.ts`: 2 arquivos, 33 testes, todos passaram.
- `cd apps/web && npx vitest run src/dados`: 10 arquivos, 105 testes, todos passaram.
- `cd apps/web && npx vitest run` (suíte web inteira): 92 arquivos, 853 testes, todos passaram.
- `npm run lint -w @n1/web`: exit 0 (0 erros; 2 avisos de variável não usada em `features/ia/conhecimento/rotulos.ts` e `features/shell/app-shell.tsx`, anteriores a este plano e fora de escopo).
- Critérios de aceitação: `readonly RespostaDeGravacao[]` em `transporte.ts` (1); `Array.isArray` em `store.ts` (1); `(shell)/page.tsx` em `transporte.ts` (0); `revisaoAnterior: 8` em `store.test.ts` (2); os casos (s), (t), (u), (v) e (w) afirmam `hidratarMock` com `not.toHaveBeenCalled`/`toHaveBeenCalledTimes`; o caso (d) tem a mesma asserção de antes.
- `git status --porcelain -- apps/api packages`: vazio. Nenhum commit do plano toca `apps/api` nem `packages/dominio`.
- `npm test` da raiz não foi rodado (inclui `apps/api`, que fala com o banco do `.env`); `npm run build` da web é do orquestrador.

## Decisions Made

Ver `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

Nenhum.

### Registrados, sem mudança de código

**1. [TDD] Os testes da Task 2 passaram antes de qualquer código novo**
- **Found during:** Task 2 (fase RED)
- **Issue:** o plano espera RED na Task 2; o laço da Task 1 já cobre as bordas.
- **Fix:** nenhuma mudança de produção; o commit da Task 2 é só de teste e foi verificado por mutação (ver "TDD Gate Compliance").

**2. [Escopo de teste] Os casos de uma chamada de `transporte.test.ts` foram ajustados, não só o (g)**
- O plano manda ajustar o caso (g); como `transporteHttp.gravar` agora devolve lista, todos os casos de uma chamada (a, b, c, d, e, j) passaram a ler a primeira resposta por `gravarPrimeira`. O auxiliar `gravarLista` falha se a implementação real não devolver lista, para que a união do tipo não esconda uma regressão do contrato.

---

**Total deviations:** 0 auto-fixados; 2 registrados sem mudança de comportamento.
**Impact on plan:** nenhum no escopo. GRV-04 está provado por transporte falso, como o plano diz.

## Issues Encountered

Nenhum.

## Known Stubs

None.

## Threat Flags

None. T-12-13 (diferença aplicada sobre revisão que não é a dela): mitigado por `enviar`, que compara a `revisaoAnterior` de CADA resposta com a revisão corrente do store e, se não bate, re-hidrata em vez de aplicar; provado pelos casos (d), (t) e (j).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-06 (a fila) herda o contrato: `Transporte.gravar` devolve lista e `enviar` a percorre em ordem. Não foi aberto.
- A premissa A7 do plano continua valendo: nenhuma tela de produção faz hoje duas operações numa closure só; o comportamento é robustez e preparação da fila, sem ganho medido nesta etapa (a medição "depois" é do 12-10).
- Nada foi publicado: o código novo da web só chega ao dono por um deploy mandado por ele.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `apps/web/src/dados/transporte.ts`, `transporte.test.ts`, `store.ts` e `store.test.ts`: FOUND.
- `git merge-base --is-ancestor` para `be6cad7`, `72b89f7` e `e63e6b8`: FOUND.
- `git rev-list --count 954dd95..HEAD` = 3 (medido imediatamente antes de escrever o SUMMARY, a partir do registro em disco do ponto de partida).
