---
phase: 00-prepara-o
plan: 04
subsystem: api
tags: [clickup, manifesto, sha256, cli, vite-node, integracao, importacao]

# Dependency graph
requires:
  - phase: 00-prepara-o (plan 01)
    provides: "criarClienteClickUp / ClienteClickUp / ErroClickUp em cliente.ts"
  - phase: 00-prepara-o (plan 03)
    provides: "exportarClickUp(opcoes) / LISTAS / ContagensDaLista em exportar.ts"
provides:
  - "gerarManifesto / hashDoArquivo / listarArquivos / contarRecursos / manifestoEmMarkdown / escreverManifesto em apps/api/src/importacao/clickup/manifesto.ts"
  - "npm run exportar:clickup -w @n1/api (exportar.cli.ts) — CLI completo com --lista/--amostra/--sem-anexos/--sem-time-in-status/--pasta/--so-manifesto"
  - "exportar.integration.test.ts — contrato provado contra a API real; resposta à Open Question 2 do RESEARCH.md"
  - "apps/api/src/importacao/clickup/CONTEXT.md com os contratos finais (não mais 'chega no Plan 00-0N')"
affects: ["00-05 (execução real + manifesto commitado)", "00-07 (fechamento da fase)", "Fase 2/3 (importação consome o formato do disco e o manifesto)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manifesto sempre reconta do disco (contarRecursos), nunca confia em execucao.json — só usa execucao.json para o que o disco não pode recontar (amostra, avisos, anexosPulados/timeInStatusIndisponivel)"
    - "hashAgregado = sha256 das linhas '<sha256>  <caminho>\\n' em ordem binária de caminho — nunca localeCompare, para não depender de locale da máquina"
    - "attachmentId pode conter '.' (nunca é segmento de diretório sozinho — sempre concatenado com o nome sanitizado); só taskId continua restrito a [A-Za-z0-9_-]"

key-files:
  created:
    - apps/api/src/importacao/clickup/manifesto.ts
    - apps/api/src/importacao/clickup/manifesto.test.ts
    - apps/api/src/importacao/clickup/exportar.cli.ts
    - apps/api/src/importacao/clickup/exportar.integration.test.ts
  modified:
    - apps/api/src/importacao/clickup/exportar.ts
    - apps/api/src/importacao/clickup/exportar.test.ts
    - apps/api/src/importacao/clickup/CONTEXT.md

key-decisions:
  - "contarRecursos nunca confia em contagens de uma execução anterior — sempre relê list.json/fields.json/members.json/tasks/task/comments/time-in-status/attachments do disco; só anexosPulados/timeInStatusIndisponivel (o que FALTOU, e por isso não deixou rastro em disco) vêm de execucao.json quando existir, senão 0"
  - "Anexo entra no manifesto como <listId>/attachments/<taskId>/<attachmentId> — o nome original nunca atravessa (D-02); comprovado por fixture com nome que tenta vazar CPF (nota-fulano-123.456.789-00.pdf)"
  - "pastaDeSaida do manifesto é fixa (apps/api/exportacoes/, resolvida por import.meta.url), não configurável por flag — o manifesto sempre vai para o lugar versionado, mesmo quando --pasta aponta a exportação para outro lugar"

patterns-established:
  - "Todo teste de integração contra o ClickUp real segue o padrão persistencia.test.ts: carregarEnv() + const d = temToken ? describe : describe.skip; grava só em mkdtemp, nunca na pasta versionada"

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-09-16
---

# Phase 00 Plan 04: Manifesto, CLI e teste de integração do exportador ClickUp Summary

**`manifesto.ts` (sha256 por arquivo + hashAgregado determinístico, contagens recontadas do disco, markdown/JSON sem PII), `npm run exportar:clickup -w @n1/api` (CLI completo no padrão `vite-node`) e `exportar.integration.test.ts` provado contra a API real do ClickUp — 4/4 casos verdes, respondendo que `time_in_status` está DISPONÍVEL no Workspace Tria.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 7 (4 criados, 3 modificados)

## Accomplishments

- `gerarManifesto`/`contarRecursos`/`listarArquivos` recontam tudo do disco (nunca confiam em memória de execução anterior); `hashDoArquivo` por streaming; `hashAgregado` determinístico e sensível a 1 byte
- `manifestoEmMarkdown` prova, por fixture com nome de anexo "vazador" (`nota-fulano-123.456.789-00.pdf`), que nenhum e-mail/CPF/CNPJ/nome de anexo atravessa para o documento versionado
- `exportar.cli.ts` compõe `carregarEnv → criarClienteClickUp → exportarClickUp → gerarManifesto → escreverManifesto`, loga em `exportacao.log`, sai com `exit 1` e instrução clara sem `CLICKUP_API_TOKEN` (confirmado com `CLICKUP_API_TOKEN=` — o `.env` local tem token real, então `env -u` sozinho não bastava, exatamente a ressalva prevista no plano)
- `exportar.integration.test.ts` rodou de verdade (token presente no ambiente): Campos reais de Contas a pagar (24), smoke test de `time_in_status` **disponível**, amostra real de 3 Tarefas de Contas a receber e retomada real com 0 requisições — 4/4 em ~11s
- Bug real encontrado e corrigido rodando o CLI contra a API: um anexo embutido em Comentário pode ter `id` em formato de nome de arquivo (UUID + extensão), que a validação de caminho original recusava
- `npm run check` verde nos três workspaces (dominio 253, api 120, web 53)

## Task Commits

Each task was committed atomically:

1. **Task 1: `manifesto.ts` — sha256 por arquivo, contagens do disco, markdown sem PII, determinismo** - `c9d36f0` (feat)
2. **Task 2: `exportar.cli.ts` — o comando `npm run exportar:clickup`, log em arquivo, manifesto ao final** - `db4d959` (feat)
3. **Task 3: `exportar.integration.test.ts` — contra a API real, só com `CLICKUP_API_TOKEN`** - `564fa66` (test)

_Nenhuma task usou TDD formal separado em commits (test → feat); os testes nasceram junto com o código em cada task, como o restante do módulo já faz (Plans 00-01/00-03)._

## Files Created/Modified

- `apps/api/src/importacao/clickup/manifesto.ts` - `EntradaDoManifesto`, `Manifesto`, `hashDoArquivo`, `listarArquivos`, `contarRecursos`, `gerarManifesto`, `manifestoEmMarkdown`, `escreverManifesto`
- `apps/api/src/importacao/clickup/manifesto.test.ts` - 7 casos (a-f do plano + `escreverManifesto`): sha256 conhecido, contagens de fixture, exclusões/truncamento de anexo, ausência de PII no markdown, determinismo + 1 byte muda só 1 hash, `.gitignore` preso ao teste
- `apps/api/src/importacao/clickup/exportar.cli.ts` - `npm run exportar:clickup -w @n1/api`; parse de `--lista`/`--amostra`/`--sem-anexos`/`--sem-time-in-status`/`--pasta`/`--so-manifesto` sem biblioteca
- `apps/api/src/importacao/clickup/exportar.integration.test.ts` - 4 casos contra a API real (Campos, smoke `time_in_status`, amostra real, retomada real); pula sem `CLICKUP_API_TOKEN`
- `apps/api/src/importacao/clickup/exportar.ts` - `ID_DE_ANEXO_VALIDO` novo (permite `.` no id do anexo); `caminhoDoAnexo` recusa explicitamente `.`/`..` exatos
- `apps/api/src/importacao/clickup/exportar.test.ts` - caso (b) ampliado: id de anexo com ponto (UUID + extensão) resolve normalmente; `.`/`..` continuam recusados
- `apps/api/src/importacao/clickup/CONTEXT.md` - contratos finais de `exportar.ts`/`exportar.cli.ts`/`manifesto.ts` (as três seções "chega no Plan 00-0N" substituídas por descrição real)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o manifesto sempre reconta do disco (nunca confia em `execucao.json` além do que o disco não pode recontar — o que faltou); o nome original de um anexo nunca atravessa para o manifesto; a pasta de saída do manifesto é fixa (não segue `--pasta`), porque o manifesto pertence sempre ao lugar versionado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `caminhoDoAnexo` recusava `attachmentId` com ponto — descoberto rodando o CLI contra a API real**

- **Found during:** Task 2, ao verificar o CLI contra a Lista de Solicitação de pagamento real (smoke check da própria task, não um teste do plano)
- **Issue:** A validação `ID_DE_CAMINHO_VALIDO = /^[A-Za-z0-9_-]+$/` era aplicada igualmente a `taskId` e `attachmentId`. Um anexo embutido num Comentário real veio com `id: "97df775c-b4ab-4bec-beac-dbcf74311b45.png"` (formato de nome de arquivo, não um id simples do ClickUp) — a exportação lançava e abortava antes de terminar a Lista.
- **Fix:** Nova constante `ID_DE_ANEXO_VALIDO = /^[A-Za-z0-9._-]+$/` (permite `.`), aplicada só a `attachmentId` — que nunca é um segmento de diretório sozinho (sempre concatenado como `${attachmentId}-${nome sanitizado}`, um único nome de arquivo); `taskId` continua com a regra estrita original, porque ele SIM vira um segmento de diretório via `path.resolve`. Guarda extra: `attachmentId === "." || attachmentId === ".."` continua recusado explicitamente. A checagem de caminho resolvido (`alvo.startsWith(pasta + path.sep)`) já existente continua como segunda camada de defesa.
- **Files modified:** apps/api/src/importacao/clickup/exportar.ts, apps/api/src/importacao/clickup/exportar.test.ts (caso (b) ampliado)
- **Verification:** novo caso em `exportar.test.ts` prova o id com ponto resolvendo normalmente e `.`/`..` continuando a lançar; os 47 testes do módulo (incluindo os 12 pré-existentes de `exportar.test.ts`) seguem verdes; `npm run typecheck -w @n1/api` verde
- **Committed in:** `db4d959` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug de segurança/robustez, corrigido em código pré-existente de Plan 00-03, descoberto ao exercitar o CLI novo desta plan contra a API real)
**Impact on plan:** Sem desvio de escopo — o bug bloquearia qualquer exportação real de uma Lista com esse formato de anexo (inclusive a exportação real do Plan 00-05); corrigi-lo agora evita que o Plan 00-05 tropece no mesmo ponto no meio de uma execução de 35-45 minutos.

## Auth Gates

Nenhum gate de autenticação novo. `CLICKUP_API_TOKEN` já estava presente em `apps/api/.env` neste ambiente (herdado de sessões anteriores do dono) — por isso o CLI (Task 2) e o teste de integração (Task 3) rodaram de verdade contra a API real, não apenas no caminho "sem token". Isso está documentado no plano como cenário esperado.

### Verificação do caminho "sem token" (Task 2)

Como `apps/api/.env` tem `CLICKUP_API_TOKEN` real, `env -u CLICKUP_API_TOKEN` sozinho não bastava: `-u` remove a variável do ambiente do processo filho, mas `carregarEnv()` só copia do `.env` para `process.env` as chaves ainda **ausentes** (`process.env[chave] === undefined`) — e depois de `-u`, a chave está ausente, então `carregarEnv()` a repõe a partir do arquivo, anulando o `-u`. A verificação real usou `CLICKUP_API_TOKEN=` (variável DEFINIDA como string vazia, não ausente): nesse caso `carregarEnv()` não sobrescreve, e o CLI viu `token === ""`, disparando corretamente:
```
CLICKUP_API_TOKEN ausente em apps/api/.env — ver apps/api/.env.example
```
com `exit 1`. Comportamento conferido tanto por execução real quanto por leitura do código (`token === undefined || token.length === 0`).

## Issues Encountered

Nenhum bloqueio. Um smoke check manual da Task 2 (rodar o CLI contra `apps/api/exportacoes/clickup/` por engano, sem `--pasta`) gravou `MANIFESTO.json`/`MANIFESTO.md` de uma amostra de teste na pasta versionada real — arquivos **untracked**, removidos antes de qualquer commit (`rm apps/api/exportacoes/MANIFESTO.*`); confirmado por `git status --short` que nada de exportação/manifesto de teste ficou no repositório em nenhum commit desta plan.

## Resposta à Open Question 2 do RESEARCH.md

`GET /task/{id}/time_in_status` está **disponível** no Workspace Tria (`9011731314`): o smoke test contra a Tarefa `868k8tn50` (citada em `contas-a-pagar.md`) devolveu um corpo com `status_history`/`current_status` definido, sem erro 4xx. O ClickApp "Total time in Status" está ligado. **Implicação para o Plan 00-05:** a exportação real pode gravar `time_in_status` por Tarefa sem o smoke test desligar o recurso — mas continua sendo tempo acumulado por status (aproximado), nunca uma trilha de auditoria cronológica (Pitfall 1 do RESEARCH.md).

## User Setup Required

None - `CLICKUP_API_TOKEN` já configurado em `apps/api/.env` neste ambiente (fornecido pelo dono fora deste repositório).

## Next Phase Readiness

- Tudo que o Plan 00-05 precisa para rodar a exportação real das 3 Listas e commitar a prova de paridade existe e está testado: `exportarClickUp`, `npm run exportar:clickup`, `gerarManifesto`/`escreverManifesto`
- **PREP-02 continua NÃO marcado como completo** em `.planning/REQUIREMENTS.md` — por instrução explícita desta execução (`project_notes`), só fecha no Plan 00-05 (exportação real completa + `MANIFESTO.md`/`MANIFESTO.json` commitados)
- Nenhum bloqueio para 00-05: o bug de `attachmentId` com ponto (corrigido nesta plan) removeu o único risco conhecido de a exportação real da Lista de Solicitação abortar no meio por causa de um anexo de Comentário

---
*Phase: 00-prepara-o*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 7 created/modified files found on disk (`manifesto.ts`, `manifesto.test.ts`, `exportar.cli.ts`, `exportar.integration.test.ts`, `CONTEXT.md`, `exportar.ts`, `exportar.test.ts`); all 3 task commits (`c9d36f0`, `db4d959`, `564fa66`) found in `git log`.
