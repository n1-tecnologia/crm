---
phase: 00-prepara-o
plan: 03
subsystem: api
tags: [clickup, exportacao, retomada, path-traversal, ssrf, atomic-write, importacao]

# Dependency graph
requires:
  - phase: 00-prepara-o (plan 01)
    provides: "criarClienteClickUp / ClienteClickUp / ErroClickUp / hostPermitido em cliente.ts; paginarPorPagina / paginarPorCursor em paginacao.ts"
provides:
  - "exportarClickUp(opcoes) em apps/api/src/importacao/clickup/exportar.ts — orquestra Lista → Campos → Membros → Tarefas (abertas+arquivadas) → detalhe → Comentários → time_in_status → anexos, um arquivo por recurso/página"
  - "sanitizarNomeDeArquivo / caminhoDoAnexo / gravarAtomico / lerSeValido / coletarAnexos / coletarUsuarios — utilitários reutilizáveis pelo CLI e manifesto (Plan 00-04)"
  - "LISTAS / TODAS_AS_LISTAS / TAMANHO_MAXIMO_DE_ANEXO / OpcoesDaExportacao / ContagensDaLista / UsuarioVisto / ResultadoDaExportacao / AnexoReferenciado"
affects: ["00-04 (CLI + manifesto)", "00-05 (execução real)", "Fase 2/3 (importação consome o layout de disco produzido aqui)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retomada pelo filesystem: lerSeValido antes de qualquer chamada de rede (materializarRecurso e os buscadores de página) — nenhum mecanismo de checkpoint separado"
    - "Smoke test de recurso opcional: a PRIMEIRA falha da execução desliga o recurso globalmente (time_in_status); falhas depois da primeira só contam, não abortam"
    - "Contagem de requisições por wrapper fino (getContado/baixarContado) em vez de instrumentar o ClienteClickUp — nenhuma mudança em cliente.ts"
    - "corpoCru gravado bruto (gravarAtomico), nunca JSON.stringify(json) — só os dois artefatos DERIVADOS (usuarios-vistos.json, execucao.json) são serializados por este módulo"

key-files:
  created: []
  modified:
    - apps/api/src/importacao/clickup/exportar.ts
    - apps/api/src/importacao/clickup/exportar.test.ts

key-decisions:
  - "time_in_status é smoke-testado por EXECUÇÃO inteira (variável timeInStatusDisponivel no escopo de exportarClickUp, não por Lista): a primeira falha 4xx desliga o recurso para todas as Listas/Tarefas subsequentes da mesma chamada — layout do plano ('a limitação é registrada no resultado') não especificava o escopo exato; optou-se pelo mais conservador (execução), coerente com 'é um ClickApp do Workspace', não da Lista"
  - "Anexo já em disco com tamanho > 0 conta em anexosBaixados (não um contador separado) — necessário para que uma retomada produza as MESMAS contagens que a execução original (teste de comportamento (c) exige 'contagens iguais')"
  - "anexos: 'nenhuma' ainda soma em ContagensDaLista.anexos (a referência foi vista), mas nunca incrementa anexosBaixados/anexosPulados — é política de decisão, não uma recusa de segurança"

patterns-established:
  - "Wrapper de contagem (getContado/baixarContado) sobre um ClienteClickUp injetado — reutilizável por qualquer orquestrador futuro que precise contar 'requisições desta execução' sem tocar o cliente HTTP"

requirements-completed: []

# Metrics
duration: ~16min
completed: 2026-09-16
---

# Phase 00 Plan 03: Exportador ClickUp — orquestração, retomada e segurança de anexo Summary

**`exportarClickUp(opcoes)` exporta uma Lista inteira do ClickUp (Tarefas abertas+arquivadas, Campos, Membros, Comentários paginados, `time_in_status` best-effort, anexos com allowlist de host e teto de tamanho) em JSON bruto por recurso/página, retomável do disco sem repetir requisições e sem tocar o Postgres — provado contra um cliente falso por 12 testes sem rede.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-09-16T20:49:49-03:00 (aprox., a partir do `last_updated` de STATE.md ao fim do Plan 00-02)
- **Completed:** 2026-09-16T21:05:17-03:00
- **Tasks:** 2
- **Files modified:** 2 (`exportar.ts`, `exportar.test.ts` — ambos criados na Task 1, ampliados na Task 2)

## Accomplishments
- `sanitizarNomeDeArquivo`/`caminhoDoAnexo` fecham path traversal por `title` de anexo hostil (T-0-06): ids validados por regex antes de qualquer `path.resolve`, resultado sempre conferido contra a pasta esperada
- `gravarAtomico`/`lerSeValido` tornam o filesystem o checkpoint da exportação: `.tmp` + `rename`, nunca reserializa o `corpoCru` da API
- `coletarAnexos`/`coletarUsuarios` fazem leitura defensiva do JSON bruto (Pitfall 5 — campo só existe quando preenchido), com dedupe por id e contagem de ocorrências (D-12)
- `exportarClickUp` orquestra as 8 etapas do RESEARCH.md (Lista → Campos → Membros → Tarefas × 2 passadas → detalhe → Comentários → `time_in_status` → anexos) com retomada real: uma segunda execução completa faz `requisicoes === 0` e não reescreve nenhum arquivo
- Smoke test de `time_in_status`: a primeira falha 4xx da execução desliga o recurso globalmente (1 única requisição desperdiçada, nunca 1000+); com `timeInStatus: "nao"`, zero tentativas
- Anexos: allowlist de host (T-0-07) e `TAMANHO_MAXIMO_DE_ANEXO` (T-0-08) recusam download sem abortar a exportação — sempre um aviso com o id, nunca a URL de terceiro
- 12 casos de teste (5 utilitários + 7 de orquestração) contra um cliente falso com rotas em memória, sem rede; `npm run check` verde nos três workspaces (dominio 253, api 109, web 53)

## Task Commits

Each task was committed atomically:

1. **Task 1: Utilitários do exportador — gravação atômica, retomada, sanitização de anexo, coleta de anexos e de usuários** - `ae701b6` (feat)
2. **Task 2: `exportarClickUp` — orquestração por Lista, retomável, com smoke test de `time_in_status` e anexos com política** - `a398408` (feat)

_Nenhuma task usou TDD formal separado em commits (test → feat); os testes nasceram junto com o código em cada task, num commit único, como o restante do módulo já faz (Plans 00-01/00-02)._

## Files Created/Modified
- `apps/api/src/importacao/clickup/exportar.ts` - `LISTAS`, `TODAS_AS_LISTAS`, `TAMANHO_MAXIMO_DE_ANEXO`, `OpcoesDaExportacao`, `ContagensDaLista`, `UsuarioVisto`, `ResultadoDaExportacao`, `AnexoReferenciado`, `sanitizarNomeDeArquivo`, `caminhoDoAnexo`, `gravarAtomico`, `lerSeValido`, `coletarAnexos`, `coletarUsuarios`, `exportarClickUp`
- `apps/api/src/importacao/clickup/exportar.test.ts` - 12 casos: sanitização/path traversal (a), gravação atômica/retomada (b/c legado da Task 1), coleta de anexos/usuários (d/e da Task 1); execução completa contra cliente falso (a), byte-a-byte do `corpoCru` (b), retomada sem rede (c), smoke test de `time_in_status` (d), anexos pulados/política/cache (e), amostra por `limiteDeTarefas` (f), `usuarios-vistos.json` e ausência de token em log/avisos (g)

## Decisions Made
Ver `key-decisions` no frontmatter. Resumo: `time_in_status` é smoke-testado por execução inteira (não por Lista) porque é um ClickApp do Workspace; um anexo já em disco conta como `anexosBaixados` para que a retomada produza as mesmas contagens da execução original; `anexos: "nenhuma"` ainda soma em `anexos` (referência vista) mas nunca em `anexosBaixados`/`anexosPulados`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `caminhoDoAnexo` usava `JSON.stringify` na mensagem de erro, violando o teto do acceptance criterion**
- **Found during:** Task 2, ao conferir `grep -c "JSON.stringify" ... ≤ 2` (o critério existe para provar que só `usuarios-vistos.json`/`execucao.json` são serializados por este módulo — o resto é `corpoCru` bruto)
- **Issue:** A mensagem de erro de `caminhoDoAnexo` usava `JSON.stringify(taskId)`/`JSON.stringify(attachmentId)` só para aspas de depuração, empurrando a contagem de linhas com `JSON.stringify` para 3
- **Fix:** Trocado por interpolação de template literal com aspas literais (`taskId="${taskId}"`), sem `JSON.stringify` — a mensagem de erro continua legível
- **Files modified:** apps/api/src/importacao/clickup/exportar.ts
- **Verification:** `grep -c "JSON.stringify" apps/api/src/importacao/clickup/exportar.ts` = 2; `npm run typecheck -w @n1/api` e os 12 testes seguem verdes
- **Committed in:** a398408 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug de acceptance criterion, corrigido antes do commit)
**Impact on plan:** Nenhum desvio de escopo; o ajuste só trocou como uma mensagem de erro interna é montada.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. `exportarClickUp` ainda não é chamado por nenhum CLI (chega no Plan 00-04); não há execução real contra a API do ClickUp nesta plan.

## Next Phase Readiness
- `exportarClickUp` e todos os utilitários de `<interfaces>` do plano existem, tipados e testados — o Plan 00-04 (`exportar.cli.ts`, `manifesto.ts`) pode compor diretamente contra este contrato
- PREP-02 continua **não** marcado como completo em `.planning/REQUIREMENTS.md` — por instrução explícita desta execução, só fecha no Plan 00-05 (exportação real + manifesto commitado)
- Nenhum bloqueio para 00-04: o layout de disco (`<listId>/list.json`, `tasks/page-NNN.json`, `task/<id>.json`, `comments/<id>/page-NNN.json`, `time-in-status/<id>.json`, `attachments/<id>/...`, `usuarios-vistos.json`, `execucao.json`) já é exatamente o que `apps/api/exportacoes/CONTEXT.md` (Plan 00-01) previu

---
*Phase: 00-prepara-o*
*Completed: 2026-09-16*

## Self-Check: PASSED

Both created/modified files found on disk (`apps/api/src/importacao/clickup/exportar.ts`, `apps/api/src/importacao/clickup/exportar.test.ts`); both commits (`ae701b6`, `a398408`) found in `git log`.
