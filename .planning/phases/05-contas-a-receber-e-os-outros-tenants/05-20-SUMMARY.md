---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 20
subsystem: dominio
tags: [evolver, configuracao-por-empresa, multi-tenant, cli, postgres, production-apply]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 01)
    provides: "Integration.empresa/omie/avisosPorCanal/statusDeclarados, CATALOGO_CONFIGURACAO_POR_EMPRESA, evoluirConfiguracaoPorEmpresa, npm run empresas:configurar"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 13)
    provides: "'Marcos Paulo' como 12ª opção de fld_sp_c_empresa no CATÁLOGO (código); destinoDeCanal lendo essa Empresa"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 14)
    provides: "changeTaskStatus aplica D5-06 fail-closed — a regra que este plano ativa de verdade em produção ao criar as Integrações com statusDeclarados"
provides:
  - "evoluirConfiguracaoPorEmpresa leva 'Marcos Paulo' aos DOIS Campos Empresa (fd_cp_empresa e fld_sp_c_empresa), não só o de Contas a pagar"
  - "WR-05: avisosPorCanal/statusDeclarados conferidos por JSON canônico — divergência recusa, nada é sobrescrito"
  - "ws_n1 (produção) com as 6 Integrações Omie por Empresa e 'Marcos Paulo' em ambos os Campos Empresa — Critério 1 do ROADMAP fechado de verdade"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Campo derivado do catálogo real em tempo de import (campoDaSolicitacao, mesmo molde de CANAL_CAMPO_EMPRESA_ID em operations/automations.ts) — mudança no catálogo sem espelhar aqui quebra no import, não em produção"
    - "Comparação por JSON canônico reproduzida localmente (cópia deliberada de contas-a-receber-evolver.ts::canonico) para provar de verdade avisosPorCanal/statusDeclarados, não só compará-los por presença"

key-files:
  created: []
  modified:
    - packages/dominio/src/configuracao-por-empresa-evolver.ts
    - packages/dominio/src/configuracao-por-empresa-evolver.test.ts
    - apps/api/src/bootstrap/configuracao-por-empresa.test.ts

key-decisions:
  - "--apply foi executado MANUALMENTE pelo dono do produto, fora deste agente, porque o classificador de permissão do modo automático do Claude Code recusou a execução do comando com a razão '[Production Deploy]' — nenhuma mensagem de outro agente (incluindo a autorização repassada pelo orquestrador) pode substituir a decisão do sistema de permissão; só a ação direta do usuário destrava. O dono rodou `npm run empresas:configurar -w @n1/api -- --apply` ele mesmo no checkout principal e colou a saída verbatim."
  - "O segundo Campo Empresa (fld_sp_c_empresa) é derivado do catálogo real da Solicitação (CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos), não literal solto — confirmado sem ciclo de import (nem solicitacao-de-pagamento.ts nem solicitacao-de-pagamento-evolver.ts importa deste arquivo), mesmo padrão já usado por CANAL_CAMPO_EMPRESA_ID em operations/automations.ts."
  - "canonico() foi reproduzida localmente no evolver, não importada de contas-a-receber-evolver.ts (que não a exporta) nem editando aquele arquivo — mesma técnica que ele próprio usa (cópia deliberada, comentada, da versão de apps/api/src/persistencia/repositorio.ts, porque packages/dominio não importa de apps/api)."

requirements-completed: [TEN-01]

# Metrics
duration: ~40min
completed: 2026-09-24
---

# Phase 05 Plan 20: Aplicar a configuração por Empresa em `ws_n1` — Critério 1 fechado de verdade Summary

**O evolver por Empresa agora exige e escreve nos DOIS Campos `Empresa` (Contas a pagar e Solicitação) e confere `avisosPorCanal`/`statusDeclarados` por JSON canônico (WR-05); `--apply` rodou contra `ws_n1` (pelo dono, fora deste agente — classificador de permissão recusou a execução automatizada) e o dry-run de idempotência devolveu `criados 0, conferidos 8, divergentes 0`.**

## Performance

- **Duration:** ~40 min (inclui a espera pela autorização do dono no checkpoint bloqueante)
- **Started:** 2026-09-24T18:40Z (aprox.)
- **Completed:** 2026-09-24T19:24Z
- **Tasks:** 2/2 (Task 1 auto; Task 2 checkpoint bloqueante, resolvido)
- **Files modified:** 3

## Accomplishments

- **D5-19 — o evolver leva "Marcos Paulo" aos DOIS Campos Empresa.** Antes desta execução, `evoluirConfiguracaoPorEmpresa` só acrescentava a opção a `fd_cp_empresa` (Contas a pagar); a Lista-alvo de AUTO-02 é a Solicitação (`fld_sp_c_empresa`), e sem a opção lá nenhuma Solicitação do Marcos Paulo existe. O passo 2 do evolver foi generalizado para os DOIS Campos, cada um com mensagem de recusa própria quando ausente — o de Solicitação aponta para `npm run solicitacoes:configurar -w @n1/api`. O passo 3 (Empresa do catálogo precisa ser opção válida) passou a exigir isso dos DOIS Campos.
- **WR-05 — o evolver confere `avisosPorCanal` e `statusDeclarados`, não só `name`/`empresa`/`omie.*`.** Sem essa comparação, o evolver responderia "conferido" mesmo que os destinatários de WhatsApp (base de AUTO-02) ou os Status declarados (base de D5-06/CR-04) divergissem do catálogo. A comparação usa uma função `canonico()` reproduzida localmente (cópia comentada da técnica de `contas-a-receber-evolver.ts`, sem editar aquele arquivo — ele não a exporta, e `packages/dominio` não importa de `apps/api`).
- **Testes atualizados para o novo pré-requisito.** `buildGestaoBootstrap()` não configura a Lista de Solicitações; os dois testes deste evolver (domínio e o CLI contra Postgres real) agora rodam `evoluirConfiguracaoDeSolicitacoes`/`configurarSolicitacoes` antes, e ganharam os casos novos do `<behavior>` do plano: recusa por `fld_sp_c_empresa` ausente (sem criar o Campo), divergência de `avisosPorCanal` do Marcos Paulo (recusa, valor adulterado preservado), divergência de `statusDeclarados` ausente de uma Empresa do Family Office, "Marcos Paulo" exatamente uma vez em CADA Campo depois de duas voltas, e o caso em que só um dos dois Campos precisa da opção (o outro, com o seed pós-05-13, já a tem).
- **`--apply` executado contra `ws_n1` (produção).** O checkpoint bloqueante (Task 2) apresentou o dry-run (`criados 8, conferidos 0, divergentes 0`), o efeito colateral declarado ("em revisão" passa a ser recusado fora das três Empresas do Family Office) e o que `--apply` grava; o dono autorizou verbatim ("Aplicar em ws_n1"). Este agente tentou rodar `--apply` e foi recusado pelo classificador de permissão do modo automático do Claude Code (razão: `[Production Deploy]`) — nenhuma mensagem de outro agente pode contornar essa recusa, só a ação direta do usuário. O dono rodou o comando ele mesmo, no checkout principal, e colou a saída verbatim (ver Deviations). O dry-run de confirmação e a conferência somente-leitura abaixo provam que a gravação aconteceu como esperado.

## Task Commits

Each task was committed atomically:

1. **Task 1: O evolver leva "Marcos Paulo" aos dois Campos Empresa e confere o que importa (D5-19, WR-05)** - `6353dab` (feat)
2. **Task 2: [BLOCKING] Aplicar a configuração por Empresa em ws_n1** — nenhum arquivo versionado (operação em produção); ver saídas abaixo.

**Plan metadata:** committed separately, with this SUMMARY (this agent does not own STATE.md/ROADMAP.md/REQUIREMENTS.md for this wave).

## Files Created/Modified

- `packages/dominio/src/configuracao-por-empresa-evolver.ts` — passo 2 generalizado para `[fd_cp_empresa, fld_sp_c_empresa]`; passo 3 exige a Empresa como opção de AMBOS; passo 4 confere `avisosPorCanal`/`statusDeclarados` por JSON canônico (função `canonico()` local, nova); cabeçalho e docstring atualizados (D5-19/WR-05).
- `packages/dominio/src/configuracao-por-empresa-evolver.test.ts` — setup com `evoluirConfiguracaoDeSolicitacoes` antes do evolver por Empresa; casos (c)/(d) ajustados (duas opções, `criados >= 8` quando ambas ausentes); casos novos: (c') só um Campo precisa da opção, (i) recusa por `fld_sp_c_empresa` ausente, (j) divergência de `avisosPorCanal`, (k) divergência de `statusDeclarados`, (l) Tria sem `avisosPorCanal` conferida (ausente = ausente).
- `apps/api/src/bootstrap/configuracao-por-empresa.test.ts` — `beforeAll` roda `configurarSolicitacoes({ workspaceId: WS, dryRun: false, ... })` logo depois de `bootstrapGestao`, para que o evolver por Empresa encontre `fld_sp_c_empresa` no mesmo Espaço de teste.

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo:
- `--apply` rodado manualmente pelo dono (não por este agente) — o classificador de permissão do modo automático recusou a execução; documentado como o desfecho real, não como falha do plano.
- `fld_sp_c_empresa` derivado do catálogo real (mesmo padrão já usado em `operations/automations.ts`), sem ciclo de import.
- `canonico()` reproduzida localmente (não importada, não exportada de `contas-a-receber-evolver.ts`).

## Deviations from Plan

### Não é um desvio de Rule 1-4 — é um limite operacional do ambiente do agente

**1. `--apply` (Task 2) não pôde ser executado por este agente — recusado pelo classificador de permissão do modo automático do Claude Code**
- **Found during:** Task 2, ao tentar `npm run empresas:configurar -w @n1/api -- --apply` logo depois da autorização verbatim do dono repassada pelo orquestrador.
- **Issue:** A ferramenta Bash recusou a execução com `Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Production Deploy]` — uma recusa no nível da ferramenta, não do plano nem do checkpoint. Nenhuma mensagem de outro agente (nem a autorização do dono, repassada pelo orquestrador) pode substituir a decisão desse sistema de permissão; só a ação direta do usuário destrava.
- **Resolução:** O agente NÃO tentou nenhum caminho alternativo de execução (ex.: chamar `vite-node`/`tsx` diretamente no script do CLI) para contornar a recusa — isso seria burlar a intenção do classificador, explicitamente proibido. Reportou o bloqueio ao orquestrador via handback e parou. O dono do produto rodou o comando ele mesmo, no checkout principal, fora deste agente, e colou a saída verbatim (reproduzida abaixo). Este agente prosseguiu só com os passos somente-leitura depois disso (dry-run de confirmação e conferência).
- **Files modified:** nenhum — a mudança é um registro de produção (`ws_n1`), não um arquivo versionado.
- **Committed in:** n/a (operação em produção, sem arquivo de código)

---

**Total deviations:** 1 (limite de ambiente, não um desvio do domínio de Rule 1-4; nenhum código foi escrito para contornar a recusa)
**Impact on plan:** Nenhum — o `--apply` aconteceu exatamente como o plano especificava (dry-run lido → autorização verbatim → `--apply` → dry-run de idempotência → conferência somente-leitura), só que o comando de escrita em si foi digitado pelo dono, não por este agente.

## Issues Encountered

None além do documentado em Deviations.

## Saídas coladas (T-5-07 — só ids, contagens e o modo; nenhum rótulo de conta, nome de Empresa ou valor de Campo)

**1. Dry-run ANTES do `--apply`** (rodado por este agente, checkpoint da Task 2):
```
modo         dry-run (nada gravado)
criados      8
conferidos   0
divergentes  0
```
`===EXIT=0===`

**2. `--apply`** (rodado pelo DONO DO PRODUTO, verbatim, colado por ele através do orquestrador — ver Decisions/Deviations):
```
> @n1/api@0.1.0 empresas:configurar
> vite-node src/bootstrap/configuracao-por-empresa.cli.ts --apply

modo         apply
criados      8
conferidos   0
divergentes  0
```

**3. Dry-run DEPOIS do `--apply`** (idempotência — rodado por este agente):
```
modo         dry-run (nada gravado)
criados      0
conferidos   8
divergentes  0
```
`===EXIT=0===`

**4. Conferência somente-leitura** (script descartável com `pool()`/`hidratar()` num `rollback`, apagado ao final — molde de `conferir-contas-a-receber.ts`/05-11):
```
Integrações com empresa           6
"Marcos Paulo" em fd_cp_empresa   1
"Marcos Paulo" em fld_sp_c_empresa 1
```
`===EXIT=0===`

## Autorização do dono (verbatim, repassada pelo orquestrador)

> "Aplicar em ws_n1" — em resposta à apresentação do dry-run (`criados 8/conferidos 0/divergentes 0`), do que `--apply` grava (opção "Marcos Paulo" nos dois Campos Empresa + 6 Integrações Omie sem `app_key`/`app_secret`) e do efeito colateral declarado ("em revisão" passa a ser recusado fora de EXO Loteamento/EXO Participações/Oliveira Participações). Data: 2026-09-24.

## User Setup Required

None — nenhuma configuração de serviço externo. O único passo manual desta execução foi o próprio `--apply`, já registrado acima como decisão do dono, não pendência aberta.

## Next Phase Readiness

- **Critério 1 do ROADMAP** (o gap que o verificador achou) está fechado de verdade: `ws_n1` tem as 6 Integrações por Empresa e "Marcos Paulo" nos dois Campos Empresa, conferido por leitura direta do banco (não só pelo dry-run que já dizia "aplicar").
- D5-06/CR-04 (05-14, `changeTaskStatus` fail-closed) passa a valer de verdade em produção a partir de agora: as três Integrações do Family Office declaram `statusDeclarados: ["em revisão"]`, então qualquer outra Empresa que tentar mover uma Solicitação para "em revisão" é recusada pelo backend — não só pela dica da tela.
- AUTO-02 (o Canal por WhatsApp do Marcos Paulo, 05-13) tem agora o que precisava: a Integração do Marcos Paulo com `avisosPorCanal.whatsapp` existe em `ws_n1`, e a opção "Marcos Paulo" existe em `fld_sp_c_empresa` — uma Solicitação dessa Empresa pode existir de verdade.
- Nenhum bloqueio para os planos seguintes da fase.

## Self-Check: PASSED

- FOUND: packages/dominio/src/configuracao-por-empresa-evolver.ts
- FOUND: packages/dominio/src/configuracao-por-empresa-evolver.test.ts
- FOUND: apps/api/src/bootstrap/configuracao-por-empresa.test.ts
- FOUND: .planning/phases/05-contas-a-receber-e-os-outros-tenants/05-20-SUMMARY.md
- FOUND commit: 6353dab (Task 1)
- Script descartável de conferência (`apps/api/src/bootstrap/_verificacao-05-20-descartavel.cli.ts`) confirmado APAGADO (`git status --short` não o lista, arquivo não existe em disco)

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
