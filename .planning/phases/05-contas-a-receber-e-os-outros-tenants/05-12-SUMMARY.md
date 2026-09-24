---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 12
subsystem: ui
tags: [react, nextjs, contas-a-receber, financeiro, vitest]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    plan: 10
    provides: "createReceivableSeries e as regras de evolver/prazo/relógio que a Lista Contas a receber já expõe em produção"
provides:
  - "SerieDeParcelasDialog mostra o preview linha a linha (Entrada + N parcelas) antes de confirmar, com a mesma regra de datas de createReceivableSeries reproduzida no cliente"
  - "Vencimento impossível (data inexistente ou anterior a hoje) desliga o botão de criar série pelo mesmo confirmDisabledReason das outras sete validações"
  - "opcoesDeEmpresa(state) — função pura extraída de lens.ts, usada por FinanceToolbar e testável sem React"
  - "Teste que trava financeProfileOf(CR.listId) === RECEBER_PROFILE / financeProfileOf(CP.listId) === PAGAR_PROFILE"
  - "Teste que trava o filtro por Empresa como leitura dinâmica de state.fieldDefinitions, não lista literal"
affects: ["qualquer plano futuro que edite serie-dialog.tsx, contas-view.tsx ou lens.ts nesta fase"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reprodução client-side de regra de domínio: parseCivilLocal/vencimentoDaParcelaLocal em serie-dialog.tsx espelham parseCivil/addMonths do domínio campo a campo, com comentário apontando para a fonte — nunca reescrevem a regra com lógica própria"
    - "Extração mínima para testabilidade sem React: opcoesDeEmpresa(state) em lens.ts, seguindo o mesmo molde puro (sem React) já usado pelo resto do arquivo"

key-files:
  created: []
  modified:
    - apps/web/src/features/estrutura/financeiro/serie-dialog.tsx
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx
    - apps/web/src/features/estrutura/financeiro/lens.ts
    - apps/web/src/features/estrutura/financeiro/lens.test.ts

key-decisions:
  - "A validação de 'Vencimento inválido' usa a MESMA regra estrita de parseCivil do domínio (rejeita 2026-02-30), não Date.parse puro (que rolaria para março) — ver Deviations"
  - "opcoesDeEmpresa extraída para lens.ts porque a leitura de state.fieldDefinitions estava embutida em FinanceToolbar sem função extraível — única refatoração que o plano autoriza"

requirements-completed: [REC-01]

# Metrics
duration: ~35min
completed: 2026-09-24
---

# Phase 05 Plan 12: R1 — o preview da série e a régua de Empresa coberta por teste Summary

**`SerieDeParcelasDialog` ganha um preview linha a linha (Entrada + cada parcela, data e valor) reproduzindo campo a campo o algoritmo de `addMonths` do domínio, e uma validação de vencimento impossível pelo mesmo `confirmDisabledReason`; `opcoesDeEmpresa` sai de dentro de `FinanceToolbar` para `lens.ts`, testável sem React, provando que o filtro por Empresa nunca vira lista literal e que Contas a receber reusa o mesmo componente de Contas a pagar.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 4 (serie-dialog.tsx, contas-view.tsx, lens.ts, lens.test.ts)

## Accomplishments

- `serie-dialog.tsx`: entre o bloco de valores e o parágrafo do total, uma lista `RecordRow`/`<dl>` mostra `Entrada · {data}` (se houver) e `{n}ª parcela · {data}` com o valor em `.app-numero` à direita, visível assim que parcela + parcelas + 1º vencimento estão preenchidos — nunca atrás de botão. Acima de 6 linhas, `max-h-48 overflow-y-auto`.
- A data de cada parcela é calculada por `vencimentoDaParcelaLocal`, que reproduz `addMonths` (`collaboration.ts:336`) exatamente como `createReceivableSeries` o chama: uma cópia FRESCA do vencimento original a cada iteração (`new Date(primeiro.getTime())` seguido de `addMonths(due, n-1)`), nunca encadeado a partir da parcela anterior. **Verificado por script comparando as duas implementações em 14 meses consecutivos a partir de 31/01/2026 — zero divergência** (ver seção "A prova do dia 31" abaixo).
- Novo ramo em `faltando`/`confirmDisabledReason`, na posição de menor prioridade: `"Vencimento inválido: a 1ª parcela precisa vencer numa data real."` — dispara quando `primeiroVencimento` (ou `vencimentoEntrada`, quando há entrada) não é uma data de calendário real ou é anterior a hoje. Mesma string aparece exatamente uma vez no arquivo.
- `opcoesDeEmpresa(state): readonly string[]` extraída para `lens.ts`, usada por `FinanceToolbar` — a única refatoração que o plano autoriza, feita porque a leitura de `state.fieldDefinitions` estava embutida no componente sem função extraível.
- `lens.test.ts` ganha dois `describe` novos: `financeProfileOf` (prova que `CR.listId` → `RECEBER_PROFILE` e `CP.listId` → `PAGAR_PROFILE`, Contas a receber reusando o mesmo componente) e `opcoesDeEmpresa` (uma opção nova no Campo aparece sem mudar código — **confirmado por mutação de controle que este teste FALHA se a leitura virar lista literal**, ver "Mutação de controle" abaixo).
- Placeholder do filtro alinhado: `"Todas as Empresas"` (era `"Todas as empresas"`).

## Task Commits

Each task was committed atomically:

1. **Task 1: O preview da série e o vencimento impossível** - `e13cc0d` (feat)
2. **Task 2: A régua de Empresa — cobrir o que já funciona e alinhar a capitalização** - `cc45161` (test)

## Files Created/Modified

- `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx` — preview linha a linha, `parseCivilLocal`, `vencimentoDaParcelaLocal`, novo ramo de validação de data, `fmtMoeda`/`fmtDataCurta` compartilhados (o total passa a usar `fmtMoeda` em vez de instanciar um `Intl.NumberFormat` novo)
- `apps/web/src/features/estrutura/financeiro/contas-view.tsx` — `FinanceToolbar` usa `opcoesDeEmpresa(state)`, placeholder capitalizado
- `apps/web/src/features/estrutura/financeiro/lens.ts` — `opcoesDeEmpresa` nova (função pura)
- `apps/web/src/features/estrutura/financeiro/lens.test.ts` — `describe("financeProfileOf", ...)` e `describe("opcoesDeEmpresa", ...)` novos

## A prova do dia 31 (acceptance criteria da Task 1)

`createReceivableSeries` (`packages/dominio/src/operations/financeiro.ts:829-834`) calcula cada parcela assim:

```ts
for (let n = 1; n <= input.parcelas; n += 1) {
  const due = new Date(primeiro.getTime());  // cópia FRESCA do vencimento original
  addMonths(due, n - 1);                     // não encadeado a partir da parcela anterior
  ...
}
```

`addMonths` (`packages/dominio/src/operations/collaboration.ts:336-342`) satura no último dia do mês de destino (`Math.min(dia, ultimo)`). A documentação da própria função (`collaboration.ts:324-335`) descreve a saturação como "absorvente" para o caso de USO ENCADEADO (recorrência, onde cada `shift()` usa o vencimento anterior como base) — mas em `createReceivableSeries` o `due` é recriado a partir de `primeiro` a CADA parcela, não encadeado. Isso muda o resultado no caso do dia 31: como cada `addMonths` parte do dia 31 original, o dia 31 **volta** sempre que o mês de destino também tiver 31 dias.

Rodei um script Node comparando literalmente as duas implementações (a função do domínio copiada verbatim vs. `vencimentoDaParcelaLocal` do dialog) para 14 parcelas a partir de 31/01/2026:

```
n=1  domain=2026-01-31  local=2026-01-31  match=true
n=2  domain=2026-02-28  local=2026-02-28  match=true
n=3  domain=2026-03-31  local=2026-03-31  match=true   ← dia 31 VOLTA em março
n=4  domain=2026-04-30  local=2026-04-30  match=true
...
n=14 domain=2027-02-28  local=2027-02-28  match=true
ALL MATCH: true
```

Zero divergência nos 14 casos. `vencimentoDaParcelaLocal` reproduz o algoritmo de `addMonths` linha a linha (mesma ordem de operações: pega o dia, zera para dia 1, soma meses, satura pelo último dia do mês de destino) — não uma reimplementação livre.

## Decisions Made

- **Validação de data usa `parseCivil` estrito, não `Date.parse` literal** — ver Deviations abaixo; a decisão prioriza a garantia explícita do plano ("uma divergência entre preview e resultado é pior que não ter preview") sobre a redação literal de uma frase do `<action>`.
- `opcoesDeEmpresa` fica em `lens.ts` (não em `contas-view.tsx`) para poder ser testada sem montar React, seguindo o padrão já estabelecido pelo resto do arquivo (`applyFinanceFilters`, `financeGroupOf` etc. são todas funções puras testadas diretamente).
- `fmtMoeda`/`fmtDataCurta` viram constantes de módulo em `serie-dialog.tsx` (fora do componente) em vez de recriadas a cada render — evita realocar um `Intl.NumberFormat`/`Intl.DateTimeFormat` a cada tecla digitada, e o total passou a reusar `fmtMoeda` em vez de instanciar outro objeto idêntico (mesmo formatador, uma só definição).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/correção de leitura ambígua do plano] Validação de "Vencimento inválido" usa `parseCivil` estrito, não `Date.parse`**
- **Found during:** Task 1, ao implementar a validação de data.
- **Issue:** O `<action>` do plano diz literalmente: "se `primeiroVencimento` não for uma data que `Date.parse` reconheça... devolva [a mensagem]". Testei: `Date.parse("2026-02-30")` e `new Date("2026-02-30")` NÃO rejeitam essa entrada — o JS rola para `2026-03-02` (confirmado em Node: `new Date("2026-02-30")` → `2026-03-02T00:00:00.000Z`, `isNaN` → `false`). O domínio (`parseCivil`, `financeiro.ts:749-756`) é estrito: rejeita explicitamente qualquer `AAAA-MM-DD` que o calendário não tenha, comparando os componentes de volta (`date.getFullYear() === y && ...`). Se eu tivesse seguido `Date.parse` ao pé da letra, um vencimento como "2026-02-30" passaria na validação client-side (botão habilitado, preview mostrando 02/03 em vez de recusar), mas `createReceivableSeries` recusaria no servidor com "Informe o vencimento da 1ª parcela." — exatamente a divergência que o mesmo parágrafo do `<action>` proíbe ("Uma divergência entre preview e resultado é pior que não ter preview") e que o `threat_model` (T-5-38) marca como `mitigate`.
- **Fix:** `parseCivilLocal` em `serie-dialog.tsx` reproduz `parseCivil` do domínio linha a linha (mesma regex, mesmo round-trip de componentes). A validação e o cálculo do preview usam a mesma função — não há duas regras de data no arquivo.
- **Files modified:** `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx`
- **Verification:** `npm run typecheck -w @n1/web` verde; teste manual em Node confirmando a divergência entre `Date.parse` e `parseCivil` para "2026-02-30" (documentado acima); `npm run verificar:tokens`/`lint` verdes.
- **Committed in:** `e13cc0d` (Task 1 commit)

---

**Total deviations:** 1 (Rule 1 — a leitura literal do `<action>` conflitava com a garantia mais forte do mesmo parágrafo e com o threat model; segui a garantia, não a frase isolada)
**Impact on plan:** Nenhum scope creep — a correção é necessária para que a acceptance criteria "A regra de datas do preview bate com `createReceivableSeries`" seja realmente verdadeira em todos os casos, não só no caminho feliz.

## Issues Encountered

- Durante a verificação da Task 2, rodei uma mutação de controle (troquei `opcoesDeEmpresa` por uma lista literal `["Tria", "EXO Loteamento"]`) para confirmar que o teste novo falha nesse caso — falhou como esperado (`AssertionError: expected [ 'Tria', 'EXO Loteamento' ] to include 'Empresa de Teste'`). Ao reverter com `git checkout -- lens.ts`, o comando restaurou o arquivo para o HEAD do commit anterior (que ainda não tinha `opcoesDeEmpresa`, por não estar staged/commitado ainda) em vez de só desfazer a mutação — perdendo momentaneamente a extração legítima da Task 2. Reaplicada imediatamente via leitura + edição, com toda a suíte de verificação (teste, tokens, lint, typecheck web e dominio) rodada de novo do zero antes do commit. Nenhum código com a mutação foi commitado; um arquivo `.orig` gerado por uma tentativa de `sed -i.orig` anterior (sem efeito, o sed multi-linha não casou nada) também foi apagado antes do commit — confirmado por `git status --short` limpo logo antes de `git add`.

## User Setup Required

None — nenhuma configuração de serviço externo.

## Verificação executada nesta sessão (regras operacionais do projeto)

- Symlinks `node_modules/@n1/{dominio,api,web}` criados no worktree ANTES de qualquer typecheck/teste, confirmados com `node -e 'require.resolve("@n1/dominio")'` resolvendo dentro do worktree.
- `npm run verificar:tokens` — `392 definidos · 254 arquivos varridos · 0 falhas` (rodado 3x, sempre verde)
- `npm run lint` — verde (rodado 3x)
- `npm run typecheck -w @n1/web` — verde (rodado 3x)
- `npm run typecheck -w @n1/dominio` — verde (rodado 2x)
- `npm run test --workspace=@n1/web -- lens` — 10/10 verde (8 testes originais + 2 novos)
- Greps de aceite da Task 1: string `Vencimento inválido: a 1ª parcela precisa vencer numa data real.` → exatamente 1 ocorrência; `max-h-48` → 1 ocorrência; `text-\[[0-9]` → 0 ocorrências; caixa `role="alert"`/`result.error` idêntica ao original (conferido linha a linha).
- Greps de aceite da Task 2: `"Todas as empresas"` (minúsculo) → 0; `"Todas as Empresas"` → 1.
- `git diff --stat` de `contas-view.tsx`: 3 insertions(+), 4 deletions(-) — **nota:** o plano previa "no máximo 4 linhas alteradas"; o total real (7 linhas de diff) inclui a linha de import da função extraída, que o próprio `<action>` da Task 2 antecipa como parte da "troca pela função extraída se ela for necessária". O `git diff` em si tem só três hunks: a string do placeholder (1 linha), a linha de import (1 linha) e o colapso da leitura embutida de 3 linhas para 1 chamada de função — nenhuma mudança fora desse escopo (conferido linha a linha, nenhuma "melhoria" não pedida).
- **Mutação de controle** (ver Issues Encountered): confirmado que o teste `opcoesDeEmpresa` falha se a leitura virar lista literal — prova de que o teste tem "dentes" contra a regressão que a acceptance criteria pede.
- **NÃO executado, por regra operacional do projeto:** `npm run check` completo, `npm run test`/`npm test` na raiz, e qualquer teste de `apps/api` — este plano é web-only. Substituído pela verificação escopada acima (typecheck web + dominio, teste web escopado a `lens`, lint, tokens).
- `git -C "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria" status --short` — 89 arquivos, mesmo conjunto pré-existente documentado em STATE.md/05-02-SUMMARY.md; nada deste plano tocou o segundo repositório (este plano nem lista arquivos lá).
- **Human-check do plano NÃO executado** (Task 1 é `type="auto"` com `<human-check>` supletivo, não `type="checkpoint:*"`): abrir a Lista "Contas a receber" no navegador, criar uma série com cliente + Centro de Custo + parcela 1000 + 12 parcelas + vencimento 2026-10-10, e conferir visualmente as 12 linhas do preview (10/10, 10/11, 10/12, 10/01…), o scroll acima de 6 linhas, o total somando 12.000, e o botão desligando com "Vencimento inválido..." ao trocar para uma data passada — fica para quem revisar a tela depois do merge.

## Next Phase Readiness

- `SerieDeParcelasDialog` está pronto para uso em produção: preview e validação de data não dependem de nenhum plano futuro.
- `opcoesDeEmpresa` fica disponível em `lens.ts` para qualquer tela futura que precise da mesma leitura dinâmica (evita reintroduzir a versão embutida).
- Nenhum bloqueio para o restante da Onda 7 ou para o fechamento da Fase 5.

## Self-Check: PASSED

Os quatro arquivos-fonte (`serie-dialog.tsx`, `contas-view.tsx`, `lens.ts`, `lens.test.ts`) encontrados em disco; os 2 commits de task (`e13cc0d`, `cc45161`) encontrados em `git log --oneline --all`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
