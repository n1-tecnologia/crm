---
phase: 06-conferencia-do-resumo-e-anexos
plan: 21
subsystem: api
tags: [conferencia-do-resumo, gap-closure, dispensa, integracao-manual, fio, orcamento, g3]

requires:
  - phase: 06-18
    provides: "dispensarConferenciaDoResumo, decisaoDasRespostasPendentes, respostaSemEfeitoNoFio, podeDecidirAConferencia"
  - phase: 06-19
    provides: "o cursor rotativo, a porta G3 estrita, encerrarLancamentoEmCurso, PADROES_DAS_PARADAS"
provides:
  - "TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente e a guarda em dispensarConferenciaDoResumo"
  - "ponte: o sinal pendenteNoFio antes de dispensar; DISPENSA_ADIADA_RESPOSTA_PENDENTE na corrida"
  - "comentar(): Promise<boolean>; lerRespostas honesto (RESPOSTA_SEM_EFEITO só quando gravou); SEM_EFEITO_DESISTIDO local à resposta"
  - "cursor rotativo também gravado no fechamento de G3 (IN-01); código morto do semCodigo removido (IN-02); marca encerrada provada em G3 (IN-03)"
affects: []

tech-stack:
  added: []
  patterns:
    - "desistência local ao id de um Comentário, nunca à conta inteira (estado.parada é reservado para parar a conta; um contador por-resposta em EstadoDaConta é o mecanismo certo para desistir só de uma resposta)"
    - "defesa em dois níveis: a ponte confere o sinal antes de escrever, e o domínio confere de novo dentro da Unidade de Trabalho, contra a corrida entre a leitura e a gravação"

key-files:
  created:
    - packages/dominio/src/operations/dispensa-com-resposta-pendente.test.ts
    - apps/api/src/automacoes/ponte-dispensa-com-resposta.test.ts
    - apps/api/src/automacoes/ponte-resposta-sem-efeito-honesta.test.ts
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/financeiro-textos.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts
    - apps/api/src/automacoes/CONTEXT.md

key-decisions:
  - "dispensarConferenciaDoResumo recusa com aprovacaoPorComentario: true fixo (não virou parâmetro novo): é a leitura mais permissiva que ainda bloqueia todo ajuste, e nenhum chamador precisa de outro valor hoje"
  - "A desistência de uma resposta sem efeito (crm2:WR-05 residual) é rastreada por id de Comentário (semEfeitoDesistidoId/tentativasSemEfeito/semEfeitoTentativaId, campos novos e próprios em EstadoDaConta), NUNCA por estado.parada — parar a conta inteira pararia também uma decisão humana real chegando depois no mesmo fio"
  - "O give-up de uma resposta sem efeito é declarado ANTES da tentativa TENTATIVAS_TRANSITORIAS+1 (sem gravação nessa tentativa), não junto com a 3ª falha — diferente do padrão de comentar() para 'dado faltando' (que desiste na mesma chamada da 3ª falha); a diferença é deliberada: o log de desistência tem de ser honesto sobre não ter tentado de novo"

requirements-completed: [RES-02, RES-03]

duration: ~110 min
completed: 2026-09-30
---

# Phase 6 Plan 21: o Crítico de remarcar "Manual" sobre resposta pendente, WR-05 residual e 3 Informativos — Summary

**`dispensarConferenciaDoResumo` recusa dispensar quando há, no fio da Conferência vigente, uma resposta humana (ajuste ou aprovação) ainda não lida — fechando o caminho que 06-18/06-19 deixaram aberto (remarcar "Integração manual" sobre um Resumo já respondido); `comentar()` agora devolve se gravou de verdade, e `lerRespostas` só afirma ter respondido quando isso é verdade, desistindo de uma resposta específica (nunca da conta inteira) depois de falhar repetidamente.**

## Performance

- **Duration:** ~110 min
- **Completed:** 2026-09-30T20:00Z
- **Tasks:** 2
- **Files modified:** 6 (+ 3 novos)

## Accomplishments

- **Task 1 (Crítico, crm2:CR-01 residual):** `dispensarConferenciaDoResumo` recusa com `recusaDispensaComRespostaPendente` quando `decisaoDasRespostasPendentes(..., { aprovacaoPorComentario: true }).sentido !== "nenhum"`. A ponte calcula o mesmo sinal (`pendenteNoFio`) antes de escolher entre `dispensar`/`lerRespostas`, e trata a recusa do domínio na corrida (resposta chegando entre a leitura do ciclo e a gravação) como adiada (`DISPENSA_ADIADA_RESPOSTA_PENDENTE`), nunca como recusa — sem parar a conta.
- **Task 2 (WR-05 residual + 3 Informativos):** `comentar()` devolve `Promise<boolean>`; `lerRespostas` só registra `RESPOSTA_SEM_EFEITO` quando o Comentário foi de fato gravado. Depois de `TENTATIVAS_TRANSITORIAS` falhas seguidas PARA A MESMA RESPOSTA (pelo id do Comentário — campos novos e próprios `semEfeitoDesistidoId`/`tentativasSemEfeito`/`semEfeitoTentativaId` em `EstadoDaConta`), a ponte desiste só dela (`SEM_EFEITO_DESISTIDO`), nunca tocando `estado.parada`. IN-01: o cursor rotativo também é gravado quando a porta G3 fecha o ciclo no meio do laço. IN-02: a checagem morta de `avisar`/`membroAtivo` no ramo `semCodigo` de `momentoDoResumo` saiu. IN-03: o caso (b) de `ponte-g3-e-orcamento.test.ts` ganhou a asserção da marca "Lançamento no Omie interrompido".

## Task Commits

1. **Task 1: O Crítico — dispensar não engole uma resposta humana pendente** - `e176f7f` (fix)
2. **Task 2: O Aviso (crm2:WR-05 residual) e os três Informativos** - `8186d3a` (fix)

_Nenhuma task teve TDD com RED/GREEN separados em commits distintos: cada uma foi commitada inteira (testes + implementação) depois de verde, seguindo o padrão do resto da fase._

## Files Created/Modified

- `packages/dominio/src/operations/financeiro-textos.ts` — `TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente`
- `packages/dominio/src/operations/financeiro.ts` — a guarda nova em `dispensarConferenciaDoResumo`
- `packages/dominio/src/operations/dispensa-com-resposta-pendente.test.ts` (novo) — 5 casos (a)-(e)
- `packages/dominio/CONTEXT.md` — seção 06-21
- `apps/api/src/automacoes/invocar-agente.ts` — `pendenteNoFio` antes de dispensar, `DISPENSA_ADIADA_RESPOSTA_PENDENTE`; `comentar(): Promise<boolean>`; `lerRespostas` honesto; `EstadoDaConta` com 3 campos novos; cursor no fechamento de G3; checagem morta removida
- `apps/api/src/automacoes/ponte-dispensa-com-resposta.test.ts` (novo) — 3 casos (f)-(h)
- `apps/api/src/automacoes/ponte-resposta-sem-efeito-honesta.test.ts` (novo) — 5 casos (a)-(d) + (f) IN-01
- `apps/api/src/automacoes/ponte-g3-e-orcamento.test.ts` — 1 asserção nova no caso (b) (IN-03)
- `apps/api/src/automacoes/CONTEXT.md` — a frase sobre `comentar()`/`RESPOSTA_SEM_EFEITO`

## Decisões e prova por mutação

**Task 1 — Mutação M1** (reverter a checagem nova no domínio, `financeiro.ts`): derrubou os casos (a), (b), (c) do domínio (`dispensa-com-resposta-pendente.test.ts`). A ponte (`ponte-dispensa-com-resposta.test.ts`) continuou com (f)/(g) verdes mesmo com a mutação — porque a PRÓPRIA ponte já escolhe `lerRespostas` antes de sequer chamar o domínio (a guarda dela é suficiente para o caminho normal) —, mas (h), o caso de corrida (a resposta chega só dentro de `executarOperacao`, depois do sinal já lido pela ponte), falhou: só o domínio, verificando de novo dentro da Unidade de Trabalho, pega essa corrida. Confirma que a defesa em dois níveis (ponte + domínio) é necessária, não redundante.

**Task 2 — Mutações M2/M3/M4** (script manual, restauração conferida por sha256 em todas: OK):
- **M2** (reverter `Promise<boolean>`, `lerRespostas` de volta ao incondicional): derrubou (a) (RESPOSTA_SEM_EFEITO saindo com `comentar()` falhando), (b) (sem o log honesto de desistência) e (d) (sem o campo `semEfeitoDesistidoId`/contador, a lógica antiga nunca desiste e a asserção de "ainda tentando" falha).
- **M3** (tirar `cursor = task.id` do fechamento de G3): derrubou (f) — o ciclo 2 recomeçou da conta errada (a primeira da ordem natural, não a que a porta interrompeu).
- **M4** (a desistência tocando `estado.parada` em vez do campo local): derrubou (d) — com a conta inteira parada, a decisão real de WALTER (`ajuste`) nunca foi lida; `c.decision` continuou `undefined`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/Rule 2 — desenho necessário] Um terceiro campo (`semEfeitoTentativaId`) além dos dois nomeados no plano**
- **Encontrado durante:** Task 2, ao implementar `lerRespostas`.
- **Problema:** o plano nomeia só `semEfeitoDesistidoId` e `tentativasSemEfeito`. Mas sem um campo à parte para saber QUAL resposta o contador `tentativasSemEfeito` está contando (distinto de "já desisti dela", que só é verdade depois do threshold), o contador reseta incorretamente a cada ciclo enquanto a MESMA resposta ainda está sendo tentada (pois `semEfeitoDesistidoId` fica `undefined` durante toda a fase de tentativa) — o que faria a ponte NUNCA desistir. Precisei de um terceiro campo (`semEfeitoTentativaId`) para saber se o id mudou desde a última tentativa.
- **Correção:** campo `semEfeitoTentativaId?: Id` acrescentado a `EstadoDaConta`, documentado inline. A contagem `grep -c "semEfeitoDesistidoId|tentativasSemEfeito"` continua ≥ 3 (a exigência do acceptance_criteria), e o campo extra não contraria nenhuma regra do plano — só a completa.
- **Verificação:** os 5 casos (a)-(e) da ponte passam; M2/M4 confirmam o comportamento correto.
- **Commit:** `8186d3a` (Task 2)

**2. [Detalhe de timing] O give-up é declarado ANTES da tentativa TENTATIVAS_TRANSITORIAS+1, não junto com a 3ª falha**
- **Encontrado durante:** Task 2, lendo a behavior (b) do plano ("No ciclo seguinte (a tentativa TENTATIVAS_TRANSITORIAS+1, ainda para r1)... sem nova gravação de Comentário").
- **Decisão:** essa frase exige que, na 4ª chamada, NENHUMA tentativa de `comentar()` aconteça (nem uma que falhe) — diferente do padrão existente de `comentar()` para "dado faltando" (`COMENTARIO_PENDENTE_DESISTIDO`), que desiste NA MESMA chamada da 3ª falha. Implementei a checagem do threshold ANTES de chamar `comentar()`, não depois: nas 3 primeiras tentativas (ciclos 1-3), `comentar()` é chamado e falha; na 4ª, a ponte já sabe que vai desistir e nem tenta.
- **Por quê é aceitável:** é a leitura literal da behavior (b) do próprio plano, e o "mesmo padrão" citado no `<action>` é só a ideia geral (desistir depois de N falhas), não a semântica exata de timing.
- **Commit:** `8186d3a` (Task 2)

**3. [Detalhe de teste] Ordem real das contas em `ponte-resposta-sem-efeito-honesta.test.ts` (f)**
- **Encontrado durante:** escrever o caso de IN-01: a suposição inicial de que `state.tasks.filter(...)` preserva a ordem "das, trafego, energia" (a ordem da declaração no teste) estava errada — a ordem real é a de `state.tasks` no seed, que não bate com a ordem de criação das variáveis locais no teste.
- **Correção:** o teste deriva a ordem real ANTES de rodar qualquer ciclo (`estado.tasks.filter(mesmo predicate de processarContas)`), e usa "primeira/segunda/terceira" em vez de nomear das/trafego/energia diretamente — a prova fica correta independente da ordem do seed.
- **Commit:** `8186d3a` (Task 2)

---

**Total deviations:** 3 (1 acréscimo de campo por necessidade de desenho, 1 esclarecimento de timing seguindo a behavior literal do plano, 1 correção de suposição no harness de teste)
**Impact on plan:** Nenhum desvio de comportamento em relação ao que o plano pediu — todos ficaram dentro do `<behavior>`/`<action>` como escritos; o campo extra e o ajuste de timing eram necessários para a implementação bater exatamente com a behavior (b) descrita.

## Issues Encountered

Nenhum bloqueio. O único percalço foi o de teste (item 3 acima), resolvido sem afetar produção.

## Verificação bloqueada

Nenhuma — todos os comandos do plano e da fase rodaram sem recusa do classificador.

## Números finais

- `packages/dominio`: 1000/1000 (67 arquivos, +5 casos novos); `tsc --noEmit` limpo.
- `apps/api/src/automacoes/`: 339/339 (19 arquivos, 17 pulados por `DATABASE_URL` vazio — não contam como verde, DEC-09); `tsc --noEmit` limpo.
- `apps/web`: 275/275 (29 arquivos); `tsc --noEmit` limpo.
- `npm run lint -w @n1/web`: 0 erros (os 4 avisos antigos de `app-shell.tsx`/`rotulos.ts` continuam, nada novo).

| Arquivo | Antes | Depois |
|---|---|---|
| `dispensa-com-resposta-pendente` (novo) | — | 5/5 |
| `ponte-dispensa-com-resposta` (novo) | — | 3/3 |
| `ponte-resposta-sem-efeito-honesta` (novo) | — | 5/5 |
| `invocar-agente` | 106 | 106 |
| `ponte-ciclo` | 28 | 28 |
| `ponte-g3-e-orcamento` | 6 | 6 (+1 asserção no caso (b), IN-03) |

## Threat model

- O Crítico (remarcar "Manual" sobre resposta pendente): mitigado em dois níveis — a ponte não tenta dispensar quando há `pendenteNoFio`; o domínio recusa de novo dentro da transação (mutação M1 prova que o nível do domínio pega a corrida que o da ponte não alcança).
- WR-05 residual (log mentiroso + orçamento infinito numa resposta): mitigado por `comentar()` honesto e a desistência local por id de resposta (M2, M4).
- IN-01/IN-02/IN-03: informativos, sem risco de segurança — cobertos por teste/grep conforme o acceptance_criteria do plano.
- Nenhuma superfície nova fora do `<threat_model>` do plano. O domínio continua sem I/O (`import` de `zod` só). Nenhum servidor foi subido além do `servidorFalso` de teste; nada tocou produção; `.env` não foi lido.

## Known Stubs

Nenhum.

## Next Phase Readiness

Os dois resíduos nomeados por `06-REVIEW-3.md` (o Crítico e o Aviso "WR-01") estão fechados, junto com os três Informativos. Não há achados abertos desta revisão. O phase 6 fica sem pendências de fechamento conhecidas a partir deste plano — qualquer rodada futura de revisão deve partir de um novo diff.

## Self-Check: PASSED

- Arquivos criados: `packages/dominio/src/operations/dispensa-com-resposta-pendente.test.ts`, `apps/api/src/automacoes/ponte-dispensa-com-resposta.test.ts`, `apps/api/src/automacoes/ponte-resposta-sem-efeito-honesta.test.ts` — todos existem.
- Commits `e176f7f` e `8186d3a` estão em `git log`.

---
*Phase: 06-conferencia-do-resumo-e-anexos*
*Completed: 2026-09-30*
