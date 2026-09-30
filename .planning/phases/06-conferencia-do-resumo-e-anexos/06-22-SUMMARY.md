---
phase: 06-conferencia-do-resumo-e-anexos
plan: 22
subsystem: api
tags: [conferencia-do-resumo, gap-closure, dispensa, integracao-manual, fio, d6-02, d6-04]

requires:
  - phase: 06-21
    provides: "TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente, a guarda em dispensarConferenciaDoResumo, o sinal pendenteNoFio na ponte"
provides:
  - "dispensarConferenciaDoResumo(state, ator, conferenciaId, opcoes?) — 4º parâmetro opcional aprovacaoPorComentario (padrão true)"
  - "a ponte (invocar-agente.ts) passa decisoes.conferenciaPorComentario (a política real) nos 3 pontos de checagem/dispensa, em vez de true fixo"
affects: []

tech-stack:
  added: []
  patterns:
    - "a guarda de resposta pendente recebe a política do CHAMADOR (opcoes?.aprovacaoPorComentario, padrão true que preserva o comportamento anterior), em vez de assumir um valor fixo — o mesmo padrão já usado por respostaSemEfeitoNoFio e decisaoDasRespostasPendentes"

key-files:
  created:
    - packages/dominio/src/operations/dispensa-respeita-comentario.test.ts
    - apps/api/src/automacoes/ponte-dispensa-respeita-comentario.test.ts
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/automacoes/invocar-agente.ts

key-decisions:
  - "opcoes é o 4º parâmetro, OPCIONAL, com um único campo aprovacaoPorComentario também opcional (padrão true) — exatamente como 06-REVIEW-4 descreveu, para que nenhum chamador existente (06-18, 06-21, os 4 arquivos de teste que já chamam a função sem esse argumento) precise de edição"
  - "o domínio recebe a política do CHAMADOR em vez de consultar o workspace sozinho — dispensarConferenciaDoResumo não tem acesso a OpcoesDeDecisao (D6-02 é uma decisão só da ponte, nunca persistida no state); a ponte é quem sabe a política real e a repassa"

requirements-completed: [RES-02, RES-03]

duration: ~35 min
completed: 2026-09-30
---

# Phase 6 Plan 22: a checagem de resposta pendente respeita a política real de conferência por comentário — Summary

**`dispensarConferenciaDoResumo` ganha um 4º parâmetro opcional `opcoes?.aprovacaoPorComentario` (padrão `true`); a ponte passa a política REAL do espaço de trabalho (`decisoes.conferenciaPorComentario`) nos 3 pontos onde antes havia `true` fixo — fechando a regressão do 06-21 que travava a dispensa `sem-conferencia` para sempre atrás de um "ok" trivial quando o workspace desliga a conferência por comentário.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-30T20:32Z
- **Tasks:** 1
- **Files modified:** 3 (+ 2 novos)

## Accomplishments

- **Task 1 (Aviso, crm2:WR-01 residual, 06-REVIEW-4):** `dispensarConferenciaDoResumo` (`financeiro.ts`) ganhou o 4º parâmetro opcional `opcoes?: { readonly aprovacaoPorComentario?: boolean }`; a constante `aprovacaoPorComentario = opcoes?.aprovacaoPorComentario ?? true` substitui o `true` fixo na chamada a `decisaoDasRespostasPendentes` dentro da guarda de resposta pendente. `invocar-agente.ts` troca `{ aprovacaoPorComentario: true }` por `{ aprovacaoPorComentario: decisoes.conferenciaPorComentario }` nos 3 pontos exatos que o plano nomeou: a pré-checagem `pendenteNoFio`, a chamada dentro de `dispensar()`, e a chamada dentro de `momentoDoResumo` (defesa em profundidade, logo depois de publicar um Resumo novo). O ramo `ajuste` de `decisaoDasRespostasPendentes` ignora a opção de qualquer forma — continua bloqueando em qualquer política, sem mudança.

## Task Commits

1. **Task 1: A checagem de resposta pendente respeita a política real de conferência por comentário** - `1c265d8` (fix)

_Task única, commitada inteira (testes + implementação) depois de verde — mesmo padrão do resto da fase; sem RED/GREEN em commits separados._

## Files Created/Modified

- `packages/dominio/src/operations/financeiro.ts` — `dispensarConferenciaDoResumo` com o 4º parâmetro opcional; comentário da guarda atualizado citando 06-22/06-REVIEW-4
- `packages/dominio/src/operations/dispensa-respeita-comentario.test.ts` (novo) — 4 casos (a)-(d) do domínio
- `packages/dominio/CONTEXT.md` — assinatura de `dispensarConferenciaDoResumo` atualizada com `opcoes?`; seção nova "06-22 — a checagem de resposta pendente respeita a política real de conferência por comentário"
- `apps/api/src/automacoes/invocar-agente.ts` — os 3 pontos de chamada/checagem passando `decisoes.conferenciaPorComentario`
- `apps/api/src/automacoes/ponte-dispensa-respeita-comentario.test.ts` (novo) — 4 casos (e)-(h) da ponte

## Decisões e prova por mutação

Reverti manualmente o parâmetro opcional em `financeiro.ts` (assinatura de volta a 3 parâmetros, `aprovacaoPorComentario: true` fixo na guarda) e os 3 call sites em `invocar-agente.ts` (de volta a `{ aprovacaoPorComentario: true }` / sem o 4º argumento), confirmando por `sha256sum` antes e depois da restauração que os arquivos voltaram ao estado exato pós-correção:

- **Domínio** (`dispensa-respeita-comentario.test.ts`): caso **(a)** falhou — `r.ok` `false` em vez de `true`, com o erro `recusaDispensaComRespostaPendente` (o "ok" sob política desligada voltou a bloquear). Casos (b)-(d) continuaram verdes (não dependem do parâmetro novo, ou testam justamente o comportamento padrão que a mutação não muda).
- **Ponte** (`ponte-dispensa-respeita-comentario.test.ts`): casos **(e)**, **(g)** e **(h)** falharam — `c2.decision` ficou `undefined` (no caso (h), em todos os 5 ciclos, reproduzindo exatamente a sonda de `06-REVIEW-4.md`: "decision apos 5 ciclos: undefined"). Caso **(f)** continuou verde (ajuste sempre bloqueia, com ou sem a correção — não é afetado pela mutação).

Restaurei os dois arquivos a partir das cópias de backup e reconfirmei: domínio 17/17, ponte 15/15, os 3 `tsc --noEmit` limpos — tudo voltou ao estado pós-correção sem diferença residual (`git status --short` mostra só os 5 arquivos esperados).

## Deviations from Plan

None - plan executado exatamente como escrito. Os 3 call sites, os nomes de arquivo, a assinatura do parâmetro opcional e os 8 casos de comportamento (a)-(h) saíram como o `<action>`/`<behavior>` descreveram.

## Issues Encountered

Nenhum bloqueio.

## Verificação bloqueada

Nenhuma — todos os comandos do plano rodaram sem recusa do classificador.

## Números finais

- `packages/dominio`: 1004/1004 (68 arquivos, +4 casos novos); `tsc --noEmit` limpo.
- `apps/api` (os 3 arquivos nomeados pelo `<verify>`, `DATABASE_URL=` vazio): 15/15 (4 novos + 3 + 8 existentes, intocados); `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo (3º tsc do checklist da fase).
- Os 4 arquivos protegidos (`dispensa-com-resposta-pendente.test.ts`, `dispensa-so-enquanto-manual.test.ts`, `ponte-dispensa-com-resposta.test.ts`, `ponte-dispensa-e-fio.test.ts`): `git diff --stat` vazio — zero edição, 100% verdes.

| Comando (grep) | Resultado |
|---|---|
| `grep -c "aprovacaoPorComentario: decisoes.conferenciaPorComentario" invocar-agente.ts` | 6 (3 pré-existentes de planos anteriores — `respostaSemEfeitoNoFio`, `decisaoDasRespostasPendentes` da leitura do lote, e a opção de `publicarResumoParaConferencia` — + 3 novos deste plano: `pendenteNoFio`, `dispensar()`, `momentoDoResumo`; `git diff` confirma que só os 3 novos mudaram nesta task) |
| `grep -c "aprovacaoPorComentario: true"` somado nos dois arquivos | 0 |

## Threat model

- A guarda de resposta pendente (06-21) continua existindo e recusando — só a POLÍTICA que ela consulta mudou de fixa para real. Nenhuma superfície nova: a mesma checagem, os mesmos dois arquivos, nenhum I/O novo no domínio.
- A correção falha para o lado seguro tanto antes quanto depois: um ajuste de verdade continua bloqueando em qualquer política (o ramo `ajuste` ignora a opção); a mudança só afeta o ramo `aprovacao`, e só quando a própria política do workspace já diz que esse "ok" não vale como decisão.
- Nenhum servidor subido além do `servidorFalso` de teste; nada tocou produção; `.env` não foi lido.

## Known Stubs

Nenhum.

## Next Phase Readiness

O Aviso único que `06-REVIEW-4.md` achou está fechado: a combinação `integracaoManual: "sem-conferencia"` + `conferenciaPorComentario: false` não trava mais a dispensa atrás de um "ok" trivial. Não há achados abertos desta rodada de revisão. Qualquer verificação futura (06-REVIEW-5, se houver) deve partir de um novo diff a partir do commit `1c265d8`.

## Self-Check: PASSED

- Arquivos criados: `packages/dominio/src/operations/dispensa-respeita-comentario.test.ts`, `apps/api/src/automacoes/ponte-dispensa-respeita-comentario.test.ts` — ambos existem.
- Commit `1c265d8` está em `git log`.

---
*Phase: 06-conferencia-do-resumo-e-anexos*
*Completed: 2026-09-30*
