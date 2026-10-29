---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 09
subsystem: ui
tags: [est-03, d-17, 2.1.9, nextjs, pagina-do-espaco, irmaosOrdenados, openCreate]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-04: irmaosOrdenados (ordenacao unica de irmaos); 10-08: Criado por na aba Geral das Configuracoes, que liberou apagar o painel Atributos"
provides:
  - "Pagina do Espaco no formato da Pasta: reguas Listas (com atalhos) e Pastas, uma coluna so"
  - "Menu Criar neste Espaco (Lista, Pasta) por openCreate(..., 'space', id), so com o Espaco ativo"
  - "Privado como Pilula neutra com cadeado no titulo; meta com plural real"
  - "Paineis so quando ha Painel ancorado; vazios do Espaco (A22)"
affects: [10-12, 10-17]

plan_head_before: 490197964304ff0cf70a3be39480899e5e43ebd6
plan_head_after: ede36bda59da5892cf7cbb57b713097abbf85c1e

actuals:
  tokens: 12500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pagina de contentor le Listas e Pastas por irmaosOrdenados + memberReachesContainer (mesma ordenacao da arvore)"
    - "Teste de pagina com params Promise.resolve + Suspense + act, next/navigation mockado para ler o router.replace de openCreate"

key-files:
  created:
    - apps/web/src/features/estrutura/pagina-do-espaco.test.tsx
  modified:
    - apps/web/src/app/(shell)/estrutura/espacos/[espaco]/page.tsx

key-decisions:
  - "Espaco arquivado e vazio mostra o EmptyState sem o botao Nova Lista (a Pasta faz o mesmo: so com o contentor ativo)."
  - "Itens de Lista e Pasta repetem o markup da Pasta em vez de extrair um componente comum: a Pasta tem Sprints e Subpastas proprias, e a extracao ficaria para quando houver um terceiro uso."
  - "Atalho e Painel usam icone sm e nome .app-md truncado com title, igual as Listas, para as tres linhas terem a mesma altura."

patterns-established:
  - "Grupo vazio vira linha .app-meta (Nenhuma Lista. / Nenhuma Pasta.); os dois vazios viram um so EmptyState compact"

requirements-completed: [EST-03]

coverage:
  - id: D1
    description: "Espaco lista Listas (e os atalhos depois delas) e depois Pastas, cada grupo na ordem de irmaosOrdenados, sem o painel Atributos"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#mostra cada grupo na ordem de `order`: inverter duas Listas muda a ordem na tela"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#lista as Listas e depois as Pastas, cada grupo em régua, e não tem mais o painel «Atributos»"
        status: pass
    human_judgment: false
  - id: D2
    description: "Menu Criar neste Espaco (Lista, Pasta) abre o dialogo com o Espaco escolhido; sem Criar em Espaco arquivado"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#o menu «Criar neste Espaço» tem Lista e Pasta, nessa ordem, e «Lista» abre o diálogo com o Espaço já escolhido"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#Espaço arquivado não tem «Criar», mas mostra o selo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Paineis so quando houver; vazios do Espaco (um so EmptyState ou linha por grupo); plural real no cabecalho"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#sem Painel ancorado, nem a régua «Painéis» nem a dica aparecem"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#um Espaço sem Lista nem Pasta mostra um só estado vazio, com «Nova Lista» abrindo o diálogo"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-do-espaco.test.tsx#o cabeçalho conta no plural certo: «1 Lista · 2 Pastas» e «2 Listas · 1 Pasta»"
        status: pass
    human_judgment: false
  - id: D4
    description: "Aparencia da pagina (ordem Listas antes de Pastas, truncamento de nome longo ao lado da Pilula Conversacional, quebra das acoes em tela estreita)"
    verification: []
    human_judgment: true
    rationale: "Layout e truncamento sao visuais (S8 long-text e backstop; I4/A21 o dono confere na UAT)."

duration: 8min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 09: Pagina do Espaco Summary

**A pagina do Espaco passa ao formato da Pasta: reguas Listas (com atalhos) e Pastas ordenadas por `irmaosOrdenados`, menu "Criar neste Espaco" via `openCreate`, "Privado" como Pilula com cadeado, Paineis so quando existirem e vazios que dizem o que falta.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-29T10:00:00Z
- **Completed:** 2026-10-29T10:08:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `espacos/[espaco]/page.tsx` reescrita em uma coluna: `ReguaDeSecao` Listas (Listas diretas e depois os atalhos, contando juntos) e Pastas, com os mesmos itens da pagina da Pasta (abertas, periodo planejado, Conversacional, `StateSeal` se nao ativa).
- Menu "Criar neste Espaco" (Lista, Pasta) chama `openCreate("lista"|"pasta", "space", id)`; so aparece com o Espaco ativo.
- O painel lateral "Atributos" e a coluna de 22rem sairam; "Privado" virou `Pilula` neutra com cadeado no titulo; a meta usa plural real.
- Secao Paineis so existe com Painel ancorado; Espaco sem Lista nem Pasta mostra um so `EmptyState` ("Este Espaço está vazio." + "Nova Lista"); com um grupo vazio, a linha "Nenhuma Lista." / "Nenhuma Pasta.".
- `pagina-do-espaco.test.tsx`: 16 casos, incluindo a ordem invertida pela `order`, o `?criar=` gravado e o acesso de Membro sem alcance a Pasta privada.

## Task Commits

1. **Task 1: Tracador — Listas, Pastas e Criar abrindo o dialogo com o Espaco escolhido** - `18bc764` (feat)
2. **Task 2: Paineis so quando houver, os vazios e o plural do cabecalho** - `ede36bd` (feat)

**Plan metadata:** commit docs(10-09) seguinte a este arquivo.

RED (avaliacao semantica): plano `type: execute`, sem o classificador `tdd-red-evidence`. Na Task 1 rodei os testes antes da pagina nova e 6 dos 8 falharam nas afirmacoes planejadas (regua "Listas" ausente, ordem, menu Criar, selo Privado); os 2 verdes eram o "nao encontrado" e a Pasta privada, que ja funcionavam e entraram como regressao. Os testes e a implementacao de cada tarefa foram num commit so (o RED nao foi commitado separadamente). Tracador: modo `end-of-phase`, `<verify>` so automatizado, reexecutado verde (vitest, tsc, eslint) antes da Task 2.

## Files Created/Modified
- `apps/web/src/app/(shell)/estrutura/espacos/[espaco]/page.tsx` - pagina do Espaco no formato da Pasta
- `apps/web/src/features/estrutura/pagina-do-espaco.test.tsx` - prova de 2.1.9 (16 testes)

## Decisions Made
- Espaco arquivado e vazio mostra o `EmptyState` sem "Nova Lista", como a Pasta.
- Os itens de Lista/Pasta repetem o markup da Pasta em vez de virar componente comum (Sprints e Subpastas da Pasta tornam a extracao prematura).
- Atalho e Painel usam o mesmo icone `sm` e nome `.app-md` truncado com `title` das Listas.

## Deviations from Plan

None - plan executed exactly as written.

O unico ponto fora do roteiro literal: a Task 1 manteve a secao Paineis na forma antiga (caixa com dica) ate a Task 2 trocá-la por regua condicional, para cada commit corresponder ao escopo da sua tarefa.

## Issues Encountered
- `archiveContainer` arquiva em cascata, entao o selo "arquivado" aparece tambem nas Listas; o teste do selo do cabecalho passou a procurar dentro do `h1`.

## Known Stubs

None.

## Threat Flags

None - sem superficie nova: a pagina continua lendo o estado ja recortado por `visibilidadePara` e filtrando com `memberReachesContainer` (T-10-24); "Criar" so com o Espaco ativo e a recusa de `mayBuild` aparece no dialogo (T-10-25).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pronto para 10-12/10-17. Premissa aberta I4/A21: a pagina lista Listas antes de Pastas e a arvore o inverso; o dono confere na UAT.
- Verificacao: `vitest run src/features/estrutura` (103 testes), `tsc --noEmit`, `npm run lint -w @n1/web` (0 erros, 3 avisos antigos fora desta mudanca) e `verificar:tokens` limpos.

## Self-Check: PASSED

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
