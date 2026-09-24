---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 16
subsystem: api+dominio
tags: [importacao, contas-a-receber, clickup, civildate, marco-zero, cli]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-11 — a importação histórica das 240 Contas a receber em ws_n1, MARCO_ZERO já gravado; este plano corrige o CÓDIGO da importação para a PRÓXIMA execução, não os dados já gravados (isso é 05-22)"
provides:
  - "instanteDaDataDePagamento (apps/api/src/importacao/clickup/contas-a-receber.ts) — a precedência de D5-16 (Campo \"Data de pagamento\" sobre date_closed) extraída e exportada, para que 05-22 use a MESMA regra na correção auditada dos dados já importados"
  - "EntradaDeContaAReceberHistorica.dataPagamento: CivilDate, resolvido em America/Sao_Paulo pelo mapeador — o domínio não corta mais um Instant em UTC (CR-06 fechado)"
  - "decidirMarcoZero (apps/api/src/importacao/clickup/politica-do-marco-zero.ts) — decisão pura sobre o MARCO_ZERO de Contas a receber; o CLI só executa"
affects: [05-22, futuro-relogio-de-contas-a-receber]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Precedência de mapeamento extraída para função pura exportada (instanteDaDataDePagamento), para que uma correção futura (05-22) reuse a MESMA regra em vez de reimplementá-la contra o export cru"
    - "Decisão de CLI extraída para função pura testada isoladamente (decidirMarcoZero, molde igual ao de outras políticas do domínio) — o CLI vira composição, nunca decisão"

key-files:
  created:
    - apps/api/src/importacao/clickup/politica-do-marco-zero.ts
    - apps/api/src/importacao/clickup/politica-do-marco-zero.test.ts
  modified:
    - packages/dominio/src/operations/importacao-contas-a-receber.ts
    - packages/dominio/src/operations/importacao-contas-a-receber.test.ts
    - apps/api/src/importacao/clickup/contas-a-receber.ts
    - apps/api/src/importacao/clickup/contas-a-receber.test.ts
    - apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts
    - apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts

key-decisions:
  - "CR-06: comoDiaCivil (America/Sao_Paulo) resolvido no MAPEADOR, não no domínio. O domínio antes cortava um Instant UTC nos 10 primeiros caracteres (comoDiaCivilDoInstante); um fechamento entre 21:00 e 23:59 de Brasília caía no dia seguinte em UTC — Campo recebia D+1. O domínio agora só valida o formato AAAA-MM-DD e grava sem cortar; fora do formato desfaz a importação daquela conta (Rule do Campo, nunca grava lixo)."
  - "O epoch de origem para comoDiaCivil vem de Date.parse(instante) sobre o Instant que instanteDaDataDePagamento já resolveu — round-trip exato porque o Instant foi gerado por new Date(ms).toISOString() a partir do MESMO epoch; evita duplicar a leitura do campo/date_closed."
  - "WR-07: dry-run da importação (sem --apply) nunca recusa por rejeitadas — decidirMarcoZero devolve 'nenhuma' sempre que apply é false, independente da contagem. Antes, o CLI saía com código 1 mesmo em dry-run quando havia rejeições; agora a recusa (exit 1) só existe quando --apply de fato tentaria gravar a marca pela metade. As contagens de rejeitadas continuam impressas no console em qualquer modo — nenhuma informação foi perdida, só o exit code deixou de confundir dry-run com falha."
  - "importar-contas-a-pagar.cli.ts (o irmão de Contas a pagar) tem o MESMO --so-marco-zero-sem---apply que este plano corrigiu em Contas a receber — NÃO foi tocado aqui (fora do files_modified do plano); já estava registrado como item aberto em 05-CONTEXT.md (\"novo\" na tabela Deferred to follow-up) e continua aberto."
requirements-completed: [REC-01]

patterns-established:
  - "Precedência de mapeamento exportada como função pura, nomeada pelo que resolve (instanteDaDataDePagamento), devolvendo {instante, origem} em vez de só o valor — a origem alimenta tanto a lacuna quanto uma futura auditoria (05-22) sem recalcular"

# Metrics
duration: ~35min
completed: 2026-09-24
---

# Phase 5 Plan 16: Dois defeitos da importação de Contas a receber, corrigidos para a PRÓXIMA execução (CR-06, WR-07) Summary

**A Data de pagamento importada passa a ser o dia civil de São Paulo (não mais um `Instant` UTC cortado), com a precedência de D5-16 exportada para 05-22; e o CLI só grava `MARCO_ZERO` quando a importação termina sem rejeição e só com `--apply`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 de 2
- **Files modified:** 6 modificados + 2 criados

## Accomplishments

- `instanteDaDataDePagamento` (apps/api) extrai a precedência de D5-16 (Campo "Data de pagamento" sobre `date_closed`) para uma função pura exportada, que `mapearContaAReceber` agora chama — a mesma regra fica disponível para a correção auditada de 05-22 sobre os dados já importados em `ws_n1`.
- `dataPagamento` vira `CivilDate`, resolvido em `America/Sao_Paulo` pelo mapeador com `comoDiaCivil` (o mesmo formatador do vencimento) — o domínio deixou de cortar um `Instant` UTC nos 10 primeiros caracteres, o defeito que dava D+1 para fechamentos entre 21:00 e 23:59 de Brasília (CR-06).
- O domínio agora valida o formato `AAAA-MM-DD` antes de gravar; fora do formato desfaz a importação daquela conta com a categoria do Campo, nunca grava lixo.
- `decidirMarcoZero` (nova, pura) decide o que o CLI de Contas a receber faz com `MARCO_ZERO`: nenhuma importação parcial (`rejeitadas > 0`) grava a marca, e `--so-marco-zero` sem `--apply` só consulta e relata — nunca escreve (WR-07).
- CLI reescrito para só EXECUTAR a decisão: a checagem de `rejeitadas` corre antes de qualquer chamada a `marcarMarcoZero` no fluxo normal.

## Task Commits

1. **Task 1: A Data de pagamento é o dia civil de São Paulo, resolvido no mapeador (CR-06)** — `5864ca8` (fix) — `fix(05-16): Data de pagamento é o dia civil de São Paulo, resolvido no mapeador (CR-06)` — `packages/dominio/src/operations/importacao-contas-a-receber.ts`, `packages/dominio/src/operations/importacao-contas-a-receber.test.ts`, `apps/api/src/importacao/clickup/contas-a-receber.ts`, `apps/api/src/importacao/clickup/contas-a-receber.test.ts`, `apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts`.
2. **Task 2: `MARCO_ZERO` só depois de terminar, e nunca sem `--apply` (WR-07)** — `885d754` (fix) — `fix(05-16): MARCO_ZERO só depois de terminar, e nunca sem --apply (WR-07)` — `apps/api/src/importacao/clickup/politica-do-marco-zero.ts`, `apps/api/src/importacao/clickup/politica-do-marco-zero.test.ts`, `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts`.

_Nota de concorrência: o commit `63f0ea6` (`docs(05-15): completa o plano de receipts retentáveis...`) aparece entre os dois commits deste plano no `git log` — é o executor irmão do plano 05-15, rodando em paralelo na mesma árvore (conforme instruído); nenhum arquivo deste plano foi tocado por ele._

## Files Created/Modified

- `packages/dominio/src/operations/importacao-contas-a-receber.ts` — `EntradaDeContaAReceberHistorica.dataPagamento` vira `CivilDate`; `comoDiaCivilDoInstante` removida; validação de formato `AAAA-MM-DD` antes de gravar, com recusa (`desfazer`) fora do formato.
- `packages/dominio/src/operations/importacao-contas-a-receber.test.ts` — caso D5-16 reescrito para `CivilDate` de entrada; novo caso cobrindo o formato inválido desfazendo a importação.
- `apps/api/src/importacao/clickup/contas-a-receber.ts` — nova função exportada `instanteDaDataDePagamento`; `mapearContaAReceber` passa a chamá-la e resolve `dataPagamento` com `comoDiaCivil(Date.parse(instante))`.
- `apps/api/src/importacao/clickup/contas-a-receber.test.ts` — as duas asserções antigas (epoch → `Instant`) viram epoch → `CivilDate`; quatro novos casos cobrindo as fronteiras 22:30 BRT (01:30Z), 02:59:59Z, 03:00Z e a precedência Campo > `date_closed`; um caso direto de `instanteDaDataDePagamento`.
- `apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts` — `dataPagamento: "2026-01-01T12:00:00.000Z"` → `dataPagamento: "2026-01-01"` (única mudança, per plano).
- `apps/api/src/importacao/clickup/politica-do-marco-zero.ts` (novo) — `decidirMarcoZero`, `DecisaoDoMarcoZero`.
- `apps/api/src/importacao/clickup/politica-do-marco-zero.test.ts` (novo) — os cinco/seis casos da decisão pura.
- `apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts` — `--so-marco-zero` sem `--apply` só consulta/relata (nunca chama `marcarMarcoZero`); no fluxo normal, a checagem de `rejeitadas` corre ANTES do bloco de gravação da marca.

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o corte de fuso mora só no mapeador (CR-06); o domínio valida formato em vez de reconverter; e a recusa por exit-code-1 do CLI passa a existir só quando `--apply` de fato tentaria gravar uma marca pela metade — dry-run nunca "recusa" porque nunca escreveria de qualquer forma (mas continua reportando as contagens de rejeitadas no console, em ambos os modos).

## Diff lido para a acceptance criteria de WR-07

Leitura do diff de `importar-contas-a-receber.cli.ts` confirmando os três pontos do plano:

1. O ramo `--so-marco-zero` sem `--apply` (`decisao.acao === "relatar"`) executa só um `select 1 from plataforma.automacao_agenda ...` e um `console.log` — nenhuma chamada a `marcarMarcoZero` nesse caminho (a chamada só existe depois do `return` do ramo `relatar`, dentro do ramo `gravar`).
2. No fluxo normal, `decidirMarcoZero({ soMarcoZero: false, apply, rejeitadas: resultado.rejeitadas })` (linha 151) roda antes de qualquer `marcarMarcoZero` do fluxo normal (linha 162) — confirmado por `grep -n` (ver Acceptance Criteria abaixo).
3. `git diff --name-only` não lista `importar-contas-a-pagar.cli.ts` — o irmão de Contas a pagar não foi tocado.

## Acceptance Criteria — evidência

```
$ grep -n "comoDiaCivilDoInstante\|slice(0, 10)" packages/dominio/src/operations/importacao-contas-a-receber.ts
(sem saída — grep exit 1)

$ grep -c "export function instanteDaDataDePagamento" apps/api/src/importacao/clickup/contas-a-receber.ts
1
$ grep -c "instanteDaDataDePagamento" apps/api/src/importacao/clickup/contas-a-receber.ts
4   # export + JSDoc + declaração + chamada em mapearContaAReceber

$ grep -n "rejeitadas\|marcarMarcoZero" apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts
25:   (`marcarMarcoZero` devolve `false`, o CLI relata "já existia").
43:import { diaCivilDeHoje, marcarMarcoZero } from "./marco-zero";
113:      const gravou = await marcarMarcoZero(cliente, { workspaceId, listId: CR.listId, diaCivil });
137:      `rejeitadas ${resultado.rejeitadas} · puladas ${resultado.puladas}`,
148:  // `marcarMarcoZero`: `rejeitadas > 0` recusa a marca (a checagem que hoje
151:  const decisao = decidirMarcoZero({ soMarcoZero: false, apply, rejeitadas: resultado.rejeitadas });
162:      const gravouAgora = await marcarMarcoZero(cliente, { workspaceId, listId: CR.listId, diaCivil });
# linha 151 (rejeitadas do fluxo normal) < linha 162 (marcarMarcoZero do fluxo normal) — OK
# linha 113 é o ramo --so-marco-zero (gravar com --apply), não o fluxo normal

$ grep -c "decidirMarcoZero" apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts
4

$ git diff --name-only
apps/api/src/importacao/clickup/importar-contas-a-receber.cli.ts
# (após o commit de Task 2 — importar-contas-a-pagar.cli.ts não aparece)
```

## Verificação — comandos e resultados exatos

Task 1:
```
$ npm run typecheck -w @n1/dominio && npm run test -w @n1/dominio -- importacao-contas-a-receber && npm run typecheck -w @n1/api
===EXIT=0=== (typecheck dominio) · 9 passed (9) (teste dominio) · ===EXIT=0=== (typecheck api)

$ (cd apps/api && npx vitest run src/importacao/clickup/contas-a-receber.test.ts --testTimeout=20000)
Test Files  1 passed (1) · Tests  22 passed (22) · ===EXIT=0===

$ (cd apps/api && npx vitest run src/importacao/clickup/importar-contas-a-receber.test.ts --testTimeout=20000)   # 1ª execução
Test Files  1 passed (1) · Tests  9 passed (9) · 0 pulados · Duration 42.66s · ===EXIT=0===

$ (cd apps/api && npx vitest run src/importacao/clickup/importar-contas-a-receber.test.ts --testTimeout=20000)   # 2ª execução
Test Files  1 passed (1) · Tests  9 passed (9) · 0 pulados · Duration 30.28s · ===EXIT=0===
```

Rodado no checkout principal (main working tree, não worktree), com `apps/api/.env` presente — `DATABASE_URL` carregado, teste de banco NÃO pulou nas duas execuções (confirmado: "9 passed (9)" nas duas, nenhum "skipped" na saída).

Task 2:
```
$ npm run typecheck -w @n1/api
===EXIT=0===

$ (cd apps/api && npx vitest run src/importacao/clickup/politica-do-marco-zero.test.ts --testTimeout=20000)
Test Files  1 passed (1) · Tests  6 passed (6) · ===EXIT=0===
```

Nenhum comando proibido rodado (`npm run check`, `npm test`, `npm run test -w @n1/api`, `npx vitest run` sem caminho) e nenhuma execução do CLI de importação (dry-run ou `--apply`) contra `ws_n1` ou qualquer outro Espaço — as únicas execuções foram os arquivos de teste listados acima, por caminho, um por comando.

## Deviations from Plan

None — plano executado exatamente como escrito. As duas Tasks eram `tdd="true"`; os testes foram escritos/atualizados junto com a implementação (RED/GREEN não foi seguido como três commits separados porque o plano pediu um único commit por Task, no molde do resto da fase — mesma disciplina dos planos irmãos 05-13/05-14/05-15 desta rodada de fechamento de lacunas).

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuração externa necessária. Nenhum `--apply` foi executado; `ws_n1` não foi tocado por este plano (a correção dos dados já importados fica para 05-22, atrás de checkpoint humano).

## Next Phase Readiness

- `instanteDaDataDePagamento` está pronto para 05-22 reusar exatamente a mesma precedência (Campo > `date_closed`) na correção auditada das 240 Contas a receber já importadas em `ws_n1` — nenhuma reimplementação necessária, só chamar a função exportada contra o export já em disco.
- `decidirMarcoZero` fecha WR-07 para Contas a receber. **Item aberto, não deste plano:** `importar-contas-a-pagar.cli.ts` tem o mesmo `--so-marco-zero` sem `--apply` (já registrado na tabela "Deferred to follow-up" do plano, linha "(novo) `--so-marco-zero` de Contas a PAGAR também escreve sem `--apply`").
- Nenhum dado em `ws_n1` foi alterado por este plano — é correção de código para a PRÓXIMA importação. As 240 contas já importadas (05-11) continuam com a Data de pagamento potencialmente cortada em UTC nas linhas onde `date_closed` caiu entre 00:00 e 03:00 UTC (fallback `data-de-pagamento-por-date-closed`); 05-22 é quem audita e corrige isso, com checkpoint humano.

## Deferred to follow-up (fora de D5-21 — registrados para não se perderem, copiado do plano)

Itens do `05-REVIEW.md` e achados deste planejamento que o dono NÃO incluiu no fechamento de lacunas (D5-21). Nenhum plano 05-13..05-25 os implementa; o próximo `/gsd-plan-phase` ou uma fase própria os recebe.

| Item | O quê | Onde | Por que fica |
|---|---|---|---|
| WR-01 | `ajustarPrazosDeCobranca` quebra o evolver/conferência de Contas a receber depois do 1º ajuste (compara `temporalPredicate` de R4/R5 com o seed) | `apps/api/src/bootstrap/contas-a-receber.ts`, `packages/dominio/src/contas-a-receber-evolver.ts` | Fora de D5-21; nenhum ajuste de prazo foi aplicado em `ws_n1` ainda |
| WR-06 | CLI de Empresas imprime rótulos de conta/nomes de Empresa na divergência | `apps/api/src/bootstrap/configuracao-por-empresa.cli.ts` | Fora de D5-21; 05-20 roda o CLI e não deve ver divergência |
| WR-08 | Cliente homônimo resolvido pelo primeiro nome, sem lacuna | `apps/api/src/importacao/clickup/contas-a-receber.ts:254-258` | `ws_n1` tem 0 Contatos/Empresas; sem efeito nas 240 |
| WR-09 | Cópia velha do domínio de `Empresa` no mapeador (sem "Marcos Paulo") | `apps/api/src/importacao/clickup/contas-a-receber.ts:138-141` | Nenhuma das 240 tem essa Empresa (0 rejeições) |
| WR-10 | Rejeição de domínio vai para o ledger como terminal e com texto que pode ter valor de Campo | `apps/api/src/importacao/clickup/importar-contas-a-receber.ts` | 0 rejeições na importação real |
| WR-12 | Diálogo de série recusa data passada que o domínio aceita; preview sem teto | `apps/web/src/features/estrutura/financeiro/serie-dialog.tsx` | Fora de D5-21 (tela) |
| WR-13 | Saque recorrente nasce com vencimento no mês corrente (passado) | `apps/api/src/bootstrap/contas-a-receber.ts:206-212` | Nenhuma Automação temporal condiciona "disponível para saque" (R2/R4/R5 = "para receber"/"pendente", `seed-contas-a-receber.ts:165-188`) — ver 05-25 |
| WR-14 | Cast esconde o 5º Status no `automation/` | `../financeiro-tria/automation/src/adapters/plataforma.ts:284-304` | Fora de D5-21 |
| WR-15 | Workspace fixo `ws_config_empresa_teste` no teste de Empresas | `apps/api/src/bootstrap/configuracao-por-empresa.test.ts:21` | Fora de D5-21 |
| IN-01 | `--resume` documentado e nunca lido | `importar-contas-a-receber.cli.ts:15-16` | Informativo |
| IN-02 | Tela de Integrações conta Empresas sem Integração como Integrações | `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx` | Informativo |
| IN-03 | Dry-run da importação suja a árvore versionada | `importar-contas-a-receber.ts:424-465` | Informativo (as duas pastas não rastreadas do `git status` de hoje) |
| IN-04 | `--lote` inválido vira lote único | `importar-contas-a-receber.cli.ts:66` | Informativo |
| (novo) | `--so-marco-zero` de Contas a PAGAR também escreve sem `--apply` (irmão de WR-07) | `apps/api/src/importacao/clickup/importar-contas-a-pagar.cli.ts` | WR-07 do review cobre só Contas a receber — **não corrigido neste plano, confirmado por `git diff --name-only`** |
| (novo) | Receipt parado em `recebido` porque o processo morreu no meio do efeito responde `duplicado` para sempre | `../financeiro-tria/automation/src/http/receipts-da-plataforma.ts` (05-15) | Exige lease por tempo; comportamento idêntico ao de hoje |
| (novo) | PERS-08/D11 — `apps/api` sem processo de produção declarado: o relógio (05-25) e a entrega real do Canal dependem dele | `.planning/REQUIREMENTS.md` PERS-08 | Decisão de infraestrutura, fase 1/2 |
| (D5-20) | Portar a fonte "plataforma" para os serviços de Marcos Paulo e Family Office; só então executar o corte 05-05 (Tasks 2/3) | `../financeiro-tria/automation/src/tenants/{marcos-paulo,family-office}/` | Decisão do dono: fase própria |

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*

## Self-Check: PASSED

Todos os arquivos citados (criados/modificados) confirmados em disco com `[ -f ... ]`; os três hashes de commit (`5864ca8`, `885d754`, `6a47243`) confirmados em `git log --oneline --all`. Nenhum item faltando.
