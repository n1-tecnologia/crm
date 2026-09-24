---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 13
subsystem: ui
tags: [nextjs, react, server-components, financeiro, design-system, csv, upload, xmlhttprequest]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "lerDoFinanceiro/Leitura, useRevalidarAoFocar, MolduraDeLeitura, BotaoAtualizar (04-06) — o fetch e os três estados que estas duas telas reusam sem reescrever"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "GET /financeiro/plano-contas na borda do apps/api (04-05)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "As seis rotas POST /financeiro/* e o proxy POST /financeiro/extratos/:origem (04-10)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "importarPlanoDeContas/removerLinhaDoPlanoDeContas/executarWorkflow em dados/acoes.ts (04-11)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "O botão 'Executar agora' desabilitado e a cópia literal do ConfirmDialog reservada em key-decisions (04-08)"
provides:
  - "lerCsvDePlanoDeContas em apps/web/src/features/financeiro/dados/csv-plano-de-contas.ts"
  - "FiltroDeEmpresa em .../componentes/filtro-de-empresa.tsx"
  - "lerPlanoDeContas/LinhaDoPlanoDeContas em .../dados/plano-contas.ts"
  - "TabelaDoPlanoDeContas, FormularioDeExtrato em .../componentes/"
  - "As rotas /financeiro/plano-contas e /financeiro/extratos (+ loading.tsx de cada)"
  - "O botão 'Executar agora' de Workflows ligado de verdade a executarWorkflow"
affects: [04-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parser de CSV escrito à mão (sem dependência): separador detectado pela contagem de ; vs , na primeira linha, aspas com escape (\"\"), cabeçalho casado por normalização (minúsculas, sem acento, sem espaço/underscore) — mesma disciplina de D4-10b (CVE-2023-30533 do pacote xlsx sem correção no npm)"
    - "Dois filtros de URL independentes na mesma tela (?empresa= e ?tipo=), cada um lendo/escrevendo via useSearchParams + router.replace preservando o outro parâmetro (new URLSearchParams(searchParams.toString()) antes de mutar) — nunca marcarSeMuda, porque filtro não é navegação"
    - "Tela sem dado até um filtro obrigatório ser escolhido: page.tsx (Server Component) decide ANTES de montar o componente client, passando linhas=null em vez de chamar a leitura com empresa vazio; o componente mostra EmptyState mas mantém o filtro visível e funcional"
    - "Upload de arquivo binário direto ao apps/api via XMLHttpRequest (não fetch) para expor upload.onprogress — mesmo padrão de UploadDeArquivos, mas de um arquivo por vez e sem sessão em duas fases (o destino é o apps/api, não um bucket com URL assinada)"
    - "Comentário de cabeçalho nunca cita o literal que o próprio grep de aceitação do plano busca (a frase proibida de D4-10, marcarSeMuda) — mesma armadilha documentada em 04-06/04-11: o grep não distingue prosa de código"

key-files:
  created:
    - apps/web/src/features/financeiro/dados/csv-plano-de-contas.ts
    - apps/web/src/features/financeiro/dados/csv-plano-de-contas.test.ts
    - apps/web/src/features/financeiro/dados/plano-contas.ts
    - apps/web/src/features/financeiro/componentes/filtro-de-empresa.tsx
    - apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx
    - apps/web/src/features/financeiro/componentes/formulario-de-extrato.tsx
    - apps/web/src/app/(shell)/financeiro/plano-contas/page.tsx
    - apps/web/src/app/(shell)/financeiro/plano-contas/loading.tsx
    - apps/web/src/app/(shell)/financeiro/extratos/page.tsx
    - apps/web/src/app/(shell)/financeiro/extratos/loading.tsx
  modified:
    - apps/web/src/features/financeiro/componentes/painel-de-workflows.tsx

key-decisions:
  - "Rótulos humanos das seis Empresas vieram de financeiro-tria/src/contexts/OrganizationContext.tsx (ORGANIZATIONS) — a única fonte com de-para real encontrada no repositório-irmão (tria→Tria, finq→'FINQ / Konq', pf→'Marcos Paulo', exo_loteamentos→'EXO Loteamento', exo_participacoes→'EXO Participações', oliveira_participacoes→'Oliveira Participações'). Nenhum nome foi inventado; o read_first do plano previa recair em Title Case só se nenhuma fonte existisse, e uma existia."
  - "'Importar CSV' fica desabilitado até Empresa E Tipo estarem escolhidos, apesar de o UI-SPEC não descrever esse guard explicitamente. apps/api/src/rotas/financeiro.ts (04-10) valida CORPO_IMPORTAR_PLANO_CONTAS com empresa e tipo OBRIGATÓRIOS (zod sem .optional(), ao contrário da leitura GET, onde os dois são opcionais) — abrir o diálogo de import sem os dois escolhidos terminaria em 400 garantido. Rule 2 (funcionalidade crítica ausente): o botão diz por quê está desabilitado (regra §11), consistente com o resto do design system."
  - "meta do PageHeader de Plano de contas mostra '{N} linha(s)', não '{N} de 276' como o UI-SPEC descreve. A leitura já chega FILTRADA por empresa/tipo do lado do apps/api — não há uma segunda chamada 'sem filtro' de onde tirar o total real de 276, e hardcodar esse número ficaria stale na primeira linha importada ou removida (mesmo raciocínio já registrado por 04-11 para Notas fiscais/Produtos, que abriu esse precedente nesta fase)."
  - "Sem ?empresa= a tela nunca chama lerPlanoDeContas: page.tsx decide isso e passa linhas=null direto para TabelaDoPlanoDeContas, que renderiza EmptyState mas mantém BarraDeFiltros (FiltroDeEmpresa + Select de Tipo) visível e funcional — é o próprio filtro que resolve o pedido. Documentado em comentário nos dois arquivos (D4-09/D4-10)."
  - "Texto de ajuda de Extratos diverge do UI-SPEC por decisão do próprio plano (não uma escolha do executor): 'PDF, CSV, XLSX/XLS ou OFX do extrato...' em vez de 'PDF, imagem ou planilha', porque parseRecebimento (financeiro-tria/automation) não despacha imagem — prometer um formato que o parser descarta em silêncio seria o tipo de mentira que esta fase existe para eliminar."

requirements-completed: [TELA-01]

# Metrics
duration: ~90min
completed: 2026-09-24
---

# Phase 4 Plan 13: Plano de contas, Extratos e o botão de Workflows Summary

**As duas últimas leituras do Financeiro — Plano de contas (a tabela que o Agente consulta de verdade, com import CSV que afirma a consequência) e Extratos do Marcos (único formulário, upload com progresso) — mais o botão "Executar agora" de Workflows, que passa a disparar de verdade.**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 11 (10 criados, 1 modificado)

## Accomplishments

- **`csv-plano-de-contas.ts`** (`dados/`, sem `server-only` — roda no navegador): `lerCsvDePlanoDeContas`, um parser de CSV escrito à mão sem dependência nova (D4-10b, `.xlsx` fica de fora por CVE-2023-30533 sem correção no npm). Detecta separador (`;` vs `,`) pela contagem na primeira linha, respeita aspas com escape (`""`), casa cabeçalho por normalização (minúsculas, sem acento, sem espaço/underscore), ignora coluna desconhecida, pula linha em branco, recusa acima de 2000 linhas (o mesmo teto do `apps/api`) e trata CRLF como quebra de linha. 10 casos de teste, todos verdes.
- **`filtro-de-empresa.tsx`**: `FiltroDeEmpresa`, `Select` dentro de `BarraDeFiltros` lendo/escrevendo `?empresa=` via `useSearchParams`/`router.replace` (nunca `push`, nunca o marcador de navegação do shell). As seis empresas técnicas de `EMPRESAS_PERMITIDAS` com rótulos humanos confirmados em `financeiro-tria/src/contexts/OrganizationContext.tsx` — nenhum nome inventado.
- **`plano-contas.ts`** (`dados/`, `server-only`): `lerPlanoDeContas(empresa, tipo)` → `{ id, conteudo }`, espelhando `LinhaDoPlanoDeContasDto` de `leituras-plataforma-dtos.ts` (04-01). Nunca chamada com `empresa` vazio — essa decisão é do `page.tsx`.
- **`tabela-do-plano-de-contas.tsx`**: a tela inteira — `BarraDeFiltros` (`FiltroDeEmpresa` + `Select` de Tipo, o segundo filtro de URL independente vivendo neste mesmo arquivo), `RecordList` (`id`, `Conteúdo` decomposto em `<span className="app-meta">` empilhados, `ActionMenu` de remoção), o `ConfirmDialog` de remoção com a cópia literal do UI-SPEC, e o diálogo de import `wide` que **afirma** a consequência para o Agente ("Esta tabela é a mesma que o Agente consulta...") atrás de um `Toggle` obrigatório — nunca a frase que nega, que a versão anterior de D4-10 continha por engano. "Importar CSV" fica desabilitado até Empresa e Tipo estarem escolhidos (ver Decisions).
- **`formulario-de-extrato.tsx`**: `FormularioDeExtrato`, o único formulário das oito telas — `Select` das sete origens (rótulos pt-BR, valores técnicos preservados), campo de arquivo desabilitado até uma Origem ser escolhida, upload de um arquivo por vez via `XMLHttpRequest` até `POST /financeiro/extratos/:origem` no `apps/api` (nunca o `automation/` direto — D4-01), barra de progresso pintada com `var(--acento)`, os quatro estados (`aguardando`/`enviando`/`enviado`/`falhou`) e limpeza automática do formulário depois de um envio bem-sucedido.
- **`painel-de-workflows.tsx`** (modificado): o botão "Executar agora" deixa de estar sempre desabilitado — agora abre um `ConfirmDialog` com a cópia literal reservada em `04-08-SUMMARY.md` (`title="Executar {nome} agora"`, a `description` sobre não duplicar execução em andamento, `confirmLabel="Executar"`) e chama `executarWorkflow(key)`; o resultado (a corrida é assíncrona, `202`) vira `Toast` neutro com a ação "Atualizar agora" (`router.refresh()`). A correção de tipo de `corDeExecucao`/`COR_NEUTRA_DE_EXECUCAO` feita antes desta execução foi preservada sem alteração.
- Quatro arquivos de rota (`plano-contas/page.tsx`+`loading.tsx` forma `"tabela"`, `extratos/page.tsx`+`loading.tsx` forma `"formulario"`). `extratos/page.tsx` é a única das oito sem `MolduraDeLeitura` — não há leitura, só formulário.

## Task Commits

Each task was committed atomically:

1. **Task 1: O leitor de CSV e o filtro de Empresa** - `994aa24` (feat)
2. **Task 2: Plano de contas — lista, remoção e o import que diz a verdade** - `aab9473` (feat)
3. **Task 3: Extratos, e o botão de Workflows que deixa de ser desabilitado** - `1ce4626` (feat)

_No plan-metadata commit for STATE.md/ROADMAP.md — este executor roda em worktree isolado; o orquestrador é dono desses arquivos depois do merge (instrução explícita do prompt desta execução)._

## Files Created/Modified

- `apps/web/src/features/financeiro/dados/csv-plano-de-contas.ts` - `lerCsvDePlanoDeContas`
- `apps/web/src/features/financeiro/dados/csv-plano-de-contas.test.ts` - 10 casos
- `apps/web/src/features/financeiro/dados/plano-contas.ts` - `lerPlanoDeContas`, `LinhaDoPlanoDeContas`
- `apps/web/src/features/financeiro/componentes/filtro-de-empresa.tsx` - `FiltroDeEmpresa`
- `apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx` - `TabelaDoPlanoDeContas`
- `apps/web/src/features/financeiro/componentes/formulario-de-extrato.tsx` - `FormularioDeExtrato`
- `apps/web/src/app/(shell)/financeiro/plano-contas/page.tsx` + `loading.tsx` - a rota
- `apps/web/src/app/(shell)/financeiro/extratos/page.tsx` + `loading.tsx` - a rota
- `apps/web/src/features/financeiro/componentes/painel-de-workflows.tsx` - "Executar agora" ligado a `executarWorkflow`

## Decisions Made

Ver `key-decisions` no frontmatter — resumo:

- **Rótulos humanos das Empresas confirmados, não inventados** — `financeiro-tria/src/contexts/OrganizationContext.tsx` (`ORGANIZATIONS`) é a única fonte real.
- **"Importar CSV" desabilitado sem Empresa+Tipo** — o `apps/api` (04-10) exige os dois no corpo do import; abrir o fluxo sem eles garantiria 400.
- **`meta` de Plano de contas é `"{N} linha(s)"`, não `"{N} de 276"`** — mesmo raciocínio de staleness que 04-11 já registrou para Notas fiscais/Produtos; a leitura chega filtrada, sem total real disponível.
- **Sem `?empresa=`, a leitura nunca é chamada** — `page.tsx` decide isso antes de montar o componente; o filtro continua visível para resolver o próprio pedido.
- **Texto de ajuda de Extratos lista os formatos reais** (PDF/CSV/XLSX/XLS/OFX) em vez do texto do UI-SPEC — decisão já registrada no próprio `PLAN.md` (`<action>` do Task 3), não uma divergência introduzida aqui.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] "Importar CSV" desabilitado até Empresa e Tipo estarem escolhidos**
- **Found during:** Task 2, lendo `CORPO_IMPORTAR_PLANO_CONTAS` em `apps/api/src/rotas/financeiro.ts` (04-10) para confirmar o contrato antes de escrever `confirmarImportacao`.
- **Issue:** O schema zod do endpoint de import exige `empresa` e `tipo` como campos obrigatórios (sem `.optional()`), ao contrário da leitura `GET /financeiro/plano-contas`, onde os dois são opcionais. O `PLAN.md`/UI-SPEC não descrevem um guard explícito para o botão "Importar CSV" além do fluxo do próprio diálogo — mas nada impedia a pessoa de escolher um CSV sem Empresa/Tipo selecionados no filtro, abrir o diálogo de import e receber 400 do `apps/api` só na hora de confirmar.
- **Fix:** O botão "Importar CSV" recebe `disabled`/`disabledReason="Escolha a Empresa e o Tipo antes de importar."` quando `?empresa=`/`?tipo=` não estão os dois preenchidos com um tipo válido (`"pagar"`/`"receber"`) — regra §11 do sistema (controle desligado sempre diz por quê), mesma disciplina já usada em toda a tela.
- **Files modified:** `apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx`
- **Verification:** `npm run typecheck -w @n1/web` verde; leitura do código confirma que `confirmarImportacao` só roda com `tipo` já estreitado para `"pagar" | "receber"` (checagem redundante mantida por segurança de tipo, já que o botão nunca abre o seletor de arquivo sem isso).
- **Committed in:** `aab9473` (Task 2)

**2. [Rule 1 - Bug] Dois comentários de cabeçalho reescritos para não colidir com o próprio `grep` de aceitação do plano**
- **Found during:** Task 1 (`filtro-de-empresa.tsx`) e Task 2 (`tabela-do-plano-de-contas.tsx`), ao rodar os `grep` de aceitação antes de seguir para o próximo task.
- **Issue:** O comentário de `filtro-de-empresa.tsx` citava literalmente `marcarSeMuda` para explicar que o componente NÃO o usa — o próprio `grep -cE "router.push|marcarSeMuda"` do acceptance criteria (que deve devolver `0`) não distingue prosa de código, e contava `1`. O mesmo aconteceu em `tabela-do-plano-de-contas.tsx`, cujo comentário citava a frase proibida de D4-10 ("não é isto que o Agente lê") para explicar por que a versão anterior estava errada — `grep -ci "não é isto que o agente"` também não distingue prosa, e contava `1` em vez do `0` esperado.
- **Fix:** Os dois comentários foram reescritos para transmitir a mesma explicação sem repetir o literal buscado ("o marcador de navegação do shell" em vez de nomeá-lo; "a versão anterior... continha a frase oposta" em vez de citá-la). Mesma armadilha já documentada em `04-06-SUMMARY.md` e `04-11-SUMMARY.md` — nenhum agente desta fase até agora escapou dela na primeira tentativa.
- **Files modified:** `apps/web/src/features/financeiro/componentes/filtro-de-empresa.tsx`, `apps/web/src/features/financeiro/componentes/tabela-do-plano-de-contas.tsx`
- **Verification:** os dois `grep` voltam a `0` depois do ajuste (confirmado antes de cada commit).
- **Committed in:** `994aa24` (Task 1), `aab9473` (Task 2) — nenhum dos dois arquivos existiu numa versão com o comentário antigo em nenhum commit final.

---

**Total deviations:** 2 (1 funcionalidade crítica ausente adicionada — Rule 2 — e 1 ajuste de comentário em dois arquivos para não colidir com o próprio grep de aceitação — Rule 1). Nenhuma mudança de comportamento visível além do guard do botão de import; o restante segue o `PLAN.md`/`UI-SPEC.md` literalmente, incluindo o desvio de copy de Extratos que o próprio plano já instruía.

## Issues Encountered

- **Verificação escopada, seguindo o `hard_constraint` explícito desta execução.** Rodei `npm run typecheck -w @n1/web` (verde, 3× — uma vez por task), `npm run lint -w @n1/web` (verde), `npm run verificar:tokens -w @n1/web` (verde, `392 definidos · 254 arquivos varridos · 0 falhas`) e `npm run test -w @n1/web` (verde, **17 arquivos / 167 testes** — os 157 anteriores + os 10 novos de `csv-plano-de-contas.test.ts`). `npm run build -w @n1/web` e `npm run check` (raiz) NÃO foram executados — o worktree não tem `apps/web/.env.local` e o `hard_constraint` desta sessão proíbe qualquer comando que possa acionar a suíte de `apps/api` (Postgres real, `fileParallelism: false`, watchdog de 600s). Máquina sob carga normal nesta execução (só um agente irmão, 04-09, rodando em paralelo no repositório externo) — nenhum `Test timed out` observado, ao contrário das ondas anteriores desta fase.
- **Conferência manual do upload de Extratos e do disparo de Workflow feita por rastreamento de código, não por servidor real no ar** — mesma limitação documentada em 04-06/04-08/04-11: sem `apps/api` rodando neste worktree, a trilha foi conferida por leitura. `FormularioDeExtrato.enviar` → `enviarExtrato` (XHR) → `POST /financeiro/extratos/:origem`; falha de rede/status fora de 2xx cai em `estado === "falhou"` com "Tentar novamente"; sucesso cai em `"enviado"` e limpa o formulário após 1.5s. `PainelDeWorkflows.confirmarExecucao` → `executarWorkflow(key)` → `escreverNoFinanceiro` (04-11) → `{ ok: true }` no 202, roteado para o `Toast` neutro; `{ ok: false, erro }` em qualquer outro desfecho, roteado para o `Toast` de erro.
- **`.xlsx` continua fora de escopo, por decisão travada da pesquisa (D4-10b)** — o texto de ajuda da tela de Plano de contas o menciona explicitamente como indisponível; nenhum pacote de planilha foi instalado (`git diff --stat apps/web/package.json` permanece vazio, confirmado antes de cada commit).
- **A lacuna do filtro de Plataforma em Notas fiscais (documentada em 04-11 e no `deferred-items.md` da fase) não foi tocada** — fora do escopo deste plano, que não modifica `tabela-de-notas-fiscais.tsx`.

## User Setup Required

None - no external service configuration required. `NEXT_PUBLIC_API_URL` já é a variável que `dados/acoes.ts` (04-11) e `dados/leitura.ts` (04-06) usam; `formulario-de-extrato.tsx` reusa a mesma, sem credencial nova.

## Next Phase Readiness

- As oito leituras do Financeiro (Dashboard, Notas fiscais, Produtos, Plano de contas, Extratos, Workflows, Problemas, Aprovações pendentes) existem agora no CRM N1 — este plano fecha as duas últimas telas e a pendência de Workflows que 04-08 deixou marcada.
- **Para 04-14 (o corte):** a semana de uso real pode começar a contar depois que este plano for mergeado e o build/typecheck completos rodarem no checkout principal (com `.env.local` e `apps/api` acessível) — nenhum bloqueio de código novo foi introduzido, mas `npm run build -w @n1/web` e `npm run check` não foram executados neste worktree (ver Issues Encountered), consistente com todos os planos anteriores desta fase que rodaram em worktree isolado.
- Nenhum bloqueio novo para o corte: `.xlsx` continua fora de escopo por decisão travada (D4-10b), e a lacuna de Plataforma em Notas fiscais (04-11) segue como trabalho futuro documentado, não urgente para o corte.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Todos os 10 arquivos criados e o 1 arquivo modificado listados em Files Created/Modified existem no disco.
- Os 3 hashes de commit (`994aa24`, `aab9473`, `1ce4626`) existem em `git log`.
