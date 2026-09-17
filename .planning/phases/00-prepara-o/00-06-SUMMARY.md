---
phase: 00-prepara-o
plan: 06
subsystem: docs
tags: [clickup, financeiro, solicitacao-de-pagamento, spec, automation]

# Dependency graph
requires:
  - phase: 00-prepara-o
    provides: "exportação real das 3 Listas do ClickUp + manifesto (Plan 00-05)"
provides:
  - "docs/07-processos/solicitacao-de-pagamento.md — spec §1–§12 no molde de contas-a-pagar.md, lida da Lista real 901109104938 + código do automation/"
  - "D6 fechado: Lista própria 'Solicitações de pagamento' + Vínculo Solicitação → Conta a pagar"
  - "D8 fechado: aprovação por clique é o caminho oficial; classificador de comentário por IA como fallback por 90 dias"
  - "OQ-CMP-01/02/04 absorvidos pelo que a exportação real mostrou"
affects: [fase-2-solicitacao, fase-3-contas-a-pagar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spec de processo legado lida de exportação bruta + código fonte (jq para agregação, sem abrir Tarefa inteira no contexto), com marcador inline ⚠ A confirmar numerado L-NN, resolvido ou fechado em §12"

key-files:
  created:
    - docs/07-processos/solicitacao-de-pagamento.md
  modified: []

key-decisions:
  - "D-06/D-07/D-08 fechados por texto na spec, confirmando as decisões já travadas em 00-CONTEXT.md"
  - "L-02 fechado pela diretriz do dono: só os 4 Status em uso hoje (list.json) são oficiais; histórico de Status não entra"
  - "L-08 fechado pela diretriz do dono: RESUMO funciona como no ClickUp hoje (Markdown nos Comentários), sem critério novo de aceite"
  - "L-04 fechado por código: Cartão vira 4ª opção do Campo Forma de pagamento, mirando o que payment-rules.ts já reconhece"
  - "L-05 fechado: Campo W-Equipe mantido como está, marcado candidato a limpeza (não bloqueia)"
  - "L-06 fechado por evidência de dados: creator=ClickBot em 6/19 Tarefas confirma Formulário coexistindo com criação direta por Membro"
  - "L-10 fechado por código: mesma função (resolveAccountConfig/resolveCategoryCodeAgainstOmie/matchCategory) usada por Solicitação e Contas a pagar — não é uma tabela própria"
  - "L-01, L-03, L-07, L-09, L-11 permanecem abertos em §12 (sem ⚠) — nem a exportação nem o automation/ sustentam a resposta; devolvidos ao dono (ver seção abaixo)"

requirements-completed: [PREP-03]

duration: ~35min (Task 1: 2026-09-16, rascunho + checkpoint; Task 3 desta continuação: ~20min, sem contar a espera pela resposta do dono)
completed: 2026-09-17
---

# Phase 0 Plan 06: Spec da Solicitação de pagamento Summary

**`docs/07-processos/solicitacao-de-pagamento.md` fecha D6/D8, absorve OQ-CMP-01/02/04 pela exportação real da Lista 901109104938 + código do `automation/`, e deixa só 5 decisões genuinamente abertas em §12 — sem nenhum marcador inline pendente.**

## Performance

- **Task 1 (rascunho):** commit `f0311ac`, 2026-09-16T23:57:55-03:00
- **Task 2 (checkpoint human-action):** dono respondeu com diretriz geral (não item-a-item) em 2026-09-17
- **Task 3 (esta continuação):** commit `f095369`, 2026-09-17T00:16:14-03:00
- **Tasks:** 3/3 (2 auto + 1 checkpoint)
- **Files modified:** 1 (`docs/07-processos/solicitacao-de-pagamento.md`)

## Accomplishments

- Spec completa §1–§12 no molde exato de `contas-a-pagar.md`, lida da exportação real (19 Tarefas, `list.json`, `fields.json`) e do código do `automation/` (`payment-rules.ts`, `clickup-payment-mapper.ts`, `payment-automation-service.ts`, `adapters/ai.ts`, `adapters/clickup.ts`, `http/routes.ts`)
- D6 fechado: Lista própria "Solicitações de pagamento" + Vínculo Solicitação → Conta a pagar (momento exato do nascimento da Conta fica em §12, L-01 — não é o `automation/` que faz essa passagem)
- D8 fechado: aprovação por clique é o caminho oficial (S4/S5/S6); classificador de comentário por IA continua como fallback por 90 dias, medido
- OQ-CMP-01 (Cartão): absorvido — vira 4ª opção do Campo, mirando o código
- OQ-CMP-02 (`em revisão`): confirmado que não aparece nesta Lista, não é replicado
- OQ-CMP-04 (validação de documento): confirmado que fica no `automation/`, a spec só descreve onde roda
- Zero marcador `⚠ A confirmar` inline ao final; PII (CPF/CNPJ/e-mail) = 0; `../financeiro-tria` intocado (`git status --porcelain` só leitura)

## Task Commits

1. **Task 1: Rascunhar a spec §1–§12 da exportação real + código do `automation/`** - `f0311ac` (docs) — executado por agente anterior
2. **Task 2: Checkpoint human-action — dono/Financeiro respondeu** - sem commit (decisão registrada na conversa, incorporada na Task 3)
3. **Task 3: Incorporar as respostas, fechar §12, zerar marcadores inline e commitar** - `f095369` (docs)

**Plan metadata:** ver commit final abaixo (STATE.md/ROADMAP.md/REQUIREMENTS.md)

## Files Created/Modified

- `docs/07-processos/solicitacao-de-pagamento.md` - spec do processo de Solicitação de pagamento, §1–§12, 326 linhas, ids `RN-SP-01..08`, `INV-SP-01`, Automações `S1..S8`, lacunas `L-01, L-03, L-07, L-09, L-11` abertas em §12

## Decisions Made

- **L-02 (Conjunto de Status):** fechado pela resposta direta do dono — só os 4 Status hoje em uso (`para fazer`, `em aprovação`, `não aprovado`, `aprovado`) são oficiais; o Status histórico `aprovação head` (evidência em `868e6j5zj`) não entra.
- **L-08 (RESUMO):** fechado pela resposta direta do dono — funciona exatamente como hoje no ClickUp (Markdown publicado nos Comentários/timeline, lido ali); nenhum critério novo de aceite/revisão.
- **L-04 (Cartão):** fechado por derivação de código — `payment-rules.ts` já interpreta "cartão" de texto livre; `Cartão` vira 4ª opção do Campo `M-Forma de pagamento` na plataforma.
- **L-05 (`W-Equipe`):** fechado — Campo fica como está no ClickUp, sem uso, marcado candidato a limpeza futura (não é decisão pendente).
- **L-06 (quem preenche o formulário):** fechado por evidência de dados — `creator` de 6 das 19 Tarefas é `ClickBot` (padrão do ClickUp para Tarefas nascidas de Formulário, inclusive público), as outras 13 têm um Membro nomeado como criador. As duas vias coexistem hoje; a plataforma precisa suportar as duas.
- **L-10 (de-para ERP):** fechado por leitura de código — `resolveAccountConfig`, `resolveCategoryCodeAgainstOmie` e `automationStore.matchCategory` são literalmente as mesmas funções usadas pelo fluxo de Contas a pagar (mesma classe `PaymentAutomationService` do tenant Tria); não há tabela própria da Solicitação — a pendência é a mesma já registrada em `contas-a-pagar.md` §12.
- **L-01, L-03, L-07, L-09, L-11:** permanecem abertos em §12, sem `⚠`, fraseados como decisão pendente (não pergunta urgente) — ver "Devolvido ao dono" abaixo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correção factual] L-11 citava incorretamente que "Liliane Peres" não aparece em nenhum outro documento desta fase**
- **Found during:** Task 3, ao verificar L-11 contra `apps/api/src/importacao/clickup/de-para-usuarios.ts`
- **Issue:** o rascunho da Task 1 afirmava que a pessoa por trás do id `81581814` (`CLICKUP_REVIEWER_IDS`) não constava em nenhum documento da fase; na verdade ela já está catalogada nesse arquivo (variável listada com `entraNoDePara: false`)
- **Fix:** reescrita da entrada L-11 em §12 citando o catálogo real e o motivo pelo qual ela não vira Membro por este levantamento (`entraNoDePara: false`, não falta de catalogação)
- **Files modified:** `docs/07-processos/solicitacao-de-pagamento.md`
- **Verification:** leitura direta de `de-para-usuarios.ts` linhas 383-390 confirmando a entrada
- **Committed in:** `f095369` (parte do commit de Task 3)

---

**Total deviations:** 1 auto-fixed (correção factual, Rule 1)
**Impact on plan:** Sem impacto de escopo — apenas precisão da citação em §12. Nenhuma mudança na decisão registrada.

## Issues Encountered

Nenhum bloqueio técnico. A resposta do dono ao checkpoint (Task 2) foi uma diretriz geral em vez de 11 respostas item-a-item; o orquestrador interpretou essa diretriz e mapeou cada `L-NN` individualmente antes desta continuação (ver `<continuation_state>` do prompt de execução) — cada gap fechado por essa via foi re-verificado contra o código/exportação nesta sessão antes de ser aplicado ao documento (nenhuma resposta foi aceita sem checar a fonte primária).

## Known Stubs

Nenhum. Este plano só produz documentação (`docs/07-processos/solicitacao-de-pagamento.md`); não há UI, componente ou dado renderizado.

## Threat Flags

Nenhum. A spec não introduz superfície nova — só descreve o processo já existente no ClickUp/`automation/`; os greps de PII (CPF, CNPJ de terceiros, e-mail) continuam em zero, e `../financeiro-tria` permanece intocado (D-DEC-11).

## User Setup Required

None - no external service configuration required.

## Devolvido ao dono — decisões que só ele pode tomar

As lacunas abaixo continuam abertas em §12 da spec, sem marcador `⚠` (não bloqueiam a spec, mas precisam de uma decisão antes ou durante o planejamento da Fase 2):

- **L-01:** Como e quando a Conta a pagar nasce de fato de uma Solicitação aprovada — recriação manual pelo Financeiro a partir do RESUMO, Automação nativa do ClickUp fora do `automation/`, ou outro mecanismo? (confirmado por código que o `automation/` não faz essa passagem)
- **L-03:** Na Tarefa `868jxd42g`, por que uma divergência de documento comentada não bloqueou o roteamento para aprovação, como a lógica de rejeição automática sugere para outros casos — foi ignorada por critério do Agente, decisão do Financeiro, ou é uma exceção de negócio fora desta amostra?
- **L-07:** Existe hoje uma segunda cobrança manual quando o Aprovador não responde ao comentário de roteamento — e, se sim, com que texto e prazo?
- **L-09:** Qual a data de revisão do fallback do classificador de comentário (90 dias a partir do go-live da Fase 2) — depende só de quando a Fase 2 entra no ar?
- **L-11:** "Revisor do RESUMO" deve virar um Papel oficial da plataforma, ou a substituição pessoal fixa (dois ids no `automation/`) é suficiente pela Fase 2? (candidata de planejamento, não bloqueante)

## Next Phase Readiness

PREP-03 entregue: a spec no padrão de `contas-a-pagar.md` está pronta para a Fase 2 (SOL-01..09) consumir. PREP-04 (de-para de usuários) segue parcial (revisor FO sem e-mail, já registrado em Plan 00-02). Nenhum blocker novo introduzido por este plano.

---
*Phase: 00-prepara-o*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: docs/07-processos/solicitacao-de-pagamento.md
- FOUND: .planning/phases/00-prepara-o/00-06-SUMMARY.md
- FOUND: commit f0311ac (Task 1)
- FOUND: commit f095369 (Task 3)
