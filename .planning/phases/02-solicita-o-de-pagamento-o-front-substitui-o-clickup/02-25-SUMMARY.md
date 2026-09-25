---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 25
subsystem: api
tags: [postgres, importacao, ledger, supabase-storage, cli, financeiro, clickup]

# Dependency graph
requires:
  - phase: 02-11
    provides: "storage-uploads.ts — envio em duas fases contra o bucket privado do Supabase Storage"
  - phase: 02-15
    provides: "topologia decidida (us-west-2), TLS real do Postgres — pré-requisito do checkpoint do Plan 02-25 antes do --apply real"
  - phase: 02-22
    provides: "solicitacoes.ts (lerSolicitacoesLegadas, classificarLinha), de-para.ts (resolverAutoriaLegada), fixture sanitizada"
provides:
  - "importarLote/reconciliar (importar.ts): lote transacional, ledger na mesma transação da Tarefa, sem evento de saída, idempotente por (origem, legacy_task_id)"
  - "ligarAnexoHistorico (anexos.ts): localiza/confere/sobe anexo histórico ao bucket privado; ambiguidade/ausência vira aviso, nunca aborta"
  - "gerarManifestoDeImportacao (manifesto.ts): relatório sanitizado do ledger, versionado em apps/api/exportacoes/importacao/<runId>/"
  - "CLI solicitacoes:importar (--dry-run padrão / --apply / --resume) e solicitacoes:reconciliar"
affects: [02-27, 02-28, "qualquer plano futuro que precise da Lista Solicitações de pagamento populada com histórico"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lote-por-página: importarLote lê UMA página do legado por chamada e devolve proximoCursor; o CLI itera até acabar (diferente do padrão importarTudo de importar-contas-a-pagar.ts)"
    - "resultado do ledger: só 'importada'|'rejeitada'|'avisada' (migração imutável); 'ambigua' vive dentro de 'rejeitada' com motivo='aprovado_ambiguo'"
    - "Idempotência uniforme: TODA linha com TaskID (válida, rejeitada ou ambígua) é filtrada pelo ledger antes de reprocessar — não só as válidas"
    - "Anexo resolvido antes de executar() (I/O assíncrono), WorkspaceFile/Attachment construídos dentro de operacaoDoLote (mesma transação da Tarefa)"

key-files:
  created:
    - apps/api/src/importacao/financeiro/anexos.ts
    - apps/api/src/importacao/financeiro/importar.ts
    - apps/api/src/importacao/financeiro/manifesto.ts
    - apps/api/src/importacao/financeiro/importar.cli.ts
    - apps/api/src/importacao/financeiro/importar.test.ts
  modified:
    - apps/api/package.json
    - apps/api/src/importacao/financeiro/CONTEXT.md

key-decisions:
  - "WorkspaceFile/Attachment do anexo são construídos em apps/api/importar.ts, não em packages/dominio/src/operations/importacao.ts — esse arquivo não está em files_modified do plano e importarSolicitacaoHistorica não aceita anexo hoje; candidato a subir para o domínio se um segundo consumidor precisar do mesmo padrão"
  - "Dry-run é simulação (classifica, não chama executar()), não uma transação com rollback como o texto do plano descreve — mesmo padrão já em produção em importar-contas-a-pagar.ts; efeito observável idêntico (zero escrita, contagens corretas)"
  - "gerarManifestoDeImportacao aceita resumoDaExecucao opcional: lidas/duplicadas/anexosLigados/anexosAusentes só saem corretos quando o CLI gera o manifesto na hora (soma em memória); reconstruído só do ledger meses depois, esses quatro números saem 0 — o ledger não os guarda por linha"
  - "origem do ledger é parametrizável (opcoes.origem) só para teste — nunca afeta Task.provenance.sourceName, que o domínio trava em 'clickup' literal; mesma técnica de importar-contas-a-pagar.ts para isolar dado de teste do ledger global (sem workspace_id)"

patterns-established:
  - "CLI fino sobre importar.ts/manifesto.ts, no molde de exportar.cli.ts e importar-contas-a-pagar.cli.ts: parsing manual de flags, pool().connect() escopado, encerrar() sempre antes de sair"

requirements-completed: [SOL-09]

duration: ~90min (Tasks 1-2 apenas — Task 3 não executada)
completed: 2026-09-25
---

# Phase 02 Plan 25: Importação histórica das Solicitações de pagamento Summary

**245 Solicitações históricas importadas como Tarefas fechadas em `ws_n1`, idempotente (reaplicação criou 0), ledger reconciliado (`bateComOLedger: true`) e `plataforma.integration_outbox` intocado (0 → 0). A origem tinha 1.114 linhas mas só 843 Solicitações distintas, e só 245 com Centro de Custo e decisão — o resto fica fora, contado por motivo no manifesto.**

## Status

**Concluído — as três Tasks.** Tasks 1-2 (código) foram executadas por executor em worktree; a Task 3 (dry-run e apply reais) foi conduzida com o dono em 2026-09-25, que rodou os comandos contra o `financeiro-tria` (o agente não lê produção). O primeiro dry-run real expôs cinco defeitos do leitor/importador, todos corrigidos e testados antes do `--apply` — ver "Task 3" abaixo.

## Performance

- **Duração:** ~90 min (Tasks 1-2)
- **Tasks:** 2 de 3 (Task 3 é checkpoint humano, deliberadamente não tentada)
- **Arquivos:** 5 criados, 2 modificados

## Accomplishments

- `importar.ts`: `importarLote` (uma página do legado por chamada — classifica, filtra pelo ledger, resolve autoria/anexo, grava Tarefa+ledger na mesma transação sem evento de saída) e `reconciliar` (contagens do ledger vs Tarefas com `provenance.kind === "import"` na Lista)
- `anexos.ts`: `ligarAnexoHistorico` — localiza o anexo pelo manifesto da exportação do ClickUp (achando o nome real em disco, que o manifesto trunca), confere sha256, sobe ao bucket privado com `upsert: false` e caminho aleatório; dry-run nunca grava; ambiguidade/ausência vira aviso reconciliável
- `manifesto.ts`: `gerarManifestoDeImportacao` lê só o ledger (nunca a origem), agrega contagens/categorias; `escreverManifestoDeImportacao` grava MD+JSON atômicos
- `importar.cli.ts`: `solicitacoes:importar` (`--dry-run` padrão, `--apply`, `--resume`) e `solicitacoes:reconciliar --run=<uuid>`
- `importar.test.ts`: 10 casos (a)-(j) contra Postgres real, usando a fixture sanitizada do Plan 02-22 via injeção de leitor (nunca toca o `financeiro-tria`)

## Task Commits

1. **Task 1: Orquestração por lotes, ledger e anexos históricos** — `f8cba87` (feat)
2. **Task 2: CLI, manifesto sanitizado e testes de idempotência** — `9b099ce` (feat, inclui um retrofit pontual de `importar.ts` para testabilidade — ver Deviations)
3. **Task 3 — correções achadas contra o dado real, antes do `--apply`:**
   - `6b860a6` — `taskid_duplicado` gravado no ledger antes da transação apagava, via `on conflict do nothing`, o "importada" da 1ª ocorrência (achado rodando `importar.test.ts` contra Postgres real: `reconciliar` 25 vs `importarLote` 26)
   - `aaa13ab` — `valor`/`documento` não existem na origem; leitor filtra `origem = 'clickup'`
   - `9898bdc` — `created_at` não existe na origem
   - `c4d0a85` — dry-run passa a prever o apply (repetição de TaskID entre páginas), decisão conflitante vira ambígua, manifesto do dry-run deixa de sair zerado
   - `d6e644c` — Empresa por de-para do legado; Data Vencimento só do vencimento real (DD/MM/AAAA)

## Files Created/Modified

- `apps/api/src/importacao/financeiro/anexos.ts` — `ligarAnexoHistorico`, localização do arquivo real em disco (o manifesto trunca o nome), verificação de hash, upload com `upsert: false`
- `apps/api/src/importacao/financeiro/importar.ts` — `importarLote`, `reconciliar`, hash canônico da linha de origem, construção do `WorkspaceFile`/`Attachment` do anexo dentro da transação
- `apps/api/src/importacao/financeiro/manifesto.ts` — `gerarManifestoDeImportacao`, `escreverManifestoDeImportacao`, `manifestoEmMarkdown`
- `apps/api/src/importacao/financeiro/importar.cli.ts` — os três modos do CLI
- `apps/api/src/importacao/financeiro/importar.test.ts` — casos (a)-(j)
- `apps/api/package.json` — scripts `solicitacoes:importar`/`solicitacoes:reconciliar`
- `apps/api/src/importacao/financeiro/CONTEXT.md` — seção dos três comandos, regra do manifesto, desenho do anexo

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: dois pontos onde a implementação diverge do texto literal do plano, ambos documentados em comentário no próprio código e considerados decisões de execução (não bugs):

1. O `WorkspaceFile`/`Attachment` do anexo nascem em `apps/api/importar.ts`, não em `packages/dominio/src/operations/importacao.ts` — esse arquivo de domínio não está em `files_modified` deste plano, e `importarSolicitacaoHistorica` (assinatura atual) não aceita anexo nenhum. Estender o contrato do domínio seria mudança de arquitetura fora do escopo declarado das Tasks 1/2. A construção replica o MESMO formato que `packages/dominio` já usa em dois lugares (`collaboration.ts#attachFile`, `scale.ts#submitForm`) — mesmo `nextId("fil")`, mesmo `state.files.push`/`task.attachments.push` — só que do lado de fora do pacote. Candidato natural a subir para o domínio se um segundo consumidor precisar do mesmo padrão.
2. Dry-run é implementado como simulação (classificar, nunca chamar `executar()`), não como "uma transação que termina em rollback" (texto literal do plano). Segue o padrão já em produção em `importar-contas-a-pagar.ts`. O efeito observável é idêntico — zero escrita, contagens corretas — com menos código novo e sem tocar `unidade-de-trabalho.ts` (fora do `files_modified` das Tasks 1/2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O nome do arquivo de anexo no `MANIFESTO.json` não é o nome real em disco**
- **Found during:** Task 1 (`anexos.ts`)
- **Issue:** `apps/api/src/importacao/clickup/manifesto.ts` trunca o `caminho` de um anexo para `<listId>/attachments/<taskId>/<attId>`, sem o `-<nome original>` que o arquivo de verdade carrega em disco. Montar o caminho direto a partir do manifesto nunca encontraria o arquivo.
- **Fix:** `localizarArquivoReal` lista a pasta do `taskId` e casa pelo prefixo `<attId>-`, recuperando o nome original só para `displayName` (nunca para o caminho do objeto no bucket).
- **Files modified:** `apps/api/src/importacao/financeiro/anexos.ts`
- **Verification:** confirmado contra o `MANIFESTO.json` real da exportação (`apps/api/exportacoes/MANIFESTO.json`, 1 anexo real da Lista de Solicitações) — o caminho ali é `901109104938/attachments/868jk43nw/97df775c`, sem sufixo.
- **Committed in:** `f8cba87`

**2. [Rule 3 - Blocking] `importarLote`/`reconciliar` não tinham como ser testados sem abrir o Postgres real do `financeiro-tria`**
- **Found during:** Task 2 (escrevendo `importar.test.ts`, que o próprio plano pede "injetada no lugar do leitor legado")
- **Issue:** `importarLote` (como commitado na Task 1) chamava `lerSolicitacoesLegadas` diretamente, sem ponto de injeção — o teste não tinha como substituir a fonte pela fixture sanitizada do Plan 02-22 sem uma credencial real.
- **Fix:** acrescentados `opcoes.leitor` (substitui `lerSolicitacoesLegadas`) e `opcoes.origem` (isola a linha do ledger de teste — a tabela `importacao_ledger` não tem `workspace_id`, é global) a `OpcoesDeImportarLote` e a `reconciliar`; ambos opcionais, só o teste os informa, o CLI nunca os expõe — mesmo padrão que `importar-contas-a-pagar.ts` já usa para `origem`.
- **Files modified:** `apps/api/src/importacao/financeiro/importar.ts`
- **Verification:** `npm run typecheck -w @n1/api` — 0; `importar.test.ts` descobre e pula os 10 casos sem `DATABASE_URL` (exit 0).
- **Committed in:** `9b099ce`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Nenhuma mudança de escopo além do que as próprias Tasks 1/2 exigiam para serem testáveis/corretas.
**Impact on plan:** Ambos os fixes são necessários para que a Task 2 cumpra seu próprio critério de aceite ("teste usa a fixture... injetada no lugar do leitor legado"). Nenhum arquivo fora de `files_modified` das Tasks 1/2 foi tocado.

## Issues Encountered

- A coluna `resultado` de `plataforma.importacao_ledger` (migração `003`, imutável) só aceita `'importada' | 'rejeitada' | 'avisada'` — não existe `'ambigua'`. Resolvido reaproveitando a convenção já em produção em `importar-contas-a-pagar.ts`: uma linha `ambigua` vira `resultado = 'rejeitada'`, `motivo = 'aprovado_ambiguo'`; a contagem `ambiguas` do retorno é derivada em memória por esse `motivo`, nunca uma coluna nova.
- `gerarManifestoDeImportacao({runId})`, como descrito no texto do plano, não consegue reconstruir sozinho `lidas`/`duplicadas`/`anexosLigados`/`anexosAusentes` a partir só do ledger (uma linha "duplicada" nunca grava uma segunda entrada de ledger neste `run_id` — ela pertence ao run ANTERIOR). Resolvido com um parâmetro `resumoDaExecucao` opcional: o CLI passa a soma em memória de todas as chamadas de `importarLote` quando gera o manifesto na hora; um `--reconciliar` isolado meses depois ainda funciona, só com esses quatro números em `0` (documentado no cabeçalho de `manifesto.ts`).

## User Setup Required

Nenhuma variável de ambiente nova é obrigatória para as Tasks 1-2 (typecheck e o teste escopado rodam sem elas). Para a Task 3 (não executada), o dono do projeto vai precisar, quando decidir rodar o checkpoint:

- `FINANCEIRO_TRIA_DATABASE_URL_LEITURA` — credencial somente-leitura do Supabase do `financeiro-tria` (nome de env var inventado nesta implementação; documentado no cabeçalho de `importar.cli.ts` — não existe convenção anterior no repositório para isto).
- `SUPABASE_STORAGE_BUCKET`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY` — já devem existir do Plan 02-11 (upload de anexo).
- Confirmar `tasksPerList >= 5000` na Lista "Solicitações de pagamento" (Plan 02-08) antes do primeiro `--apply` real.

## Task 3 — execução real (2026-09-25)

**Importado: run `957a5fdf-9ccb-4892-97b3-63cf5dece9d6`.** Manifestos em `apps/api/exportacoes/importacao/` (ver o `README.md` de lá para ler os três runs).

### O que a origem realmente é

`public.solicitacoes_pagamentos` tem 16 colunas (conferido em `information_schema.columns`) e grava **várias linhas por Solicitação** (até 20 por `TaskID`). 1.114 linhas = **843 Solicitações distintas** + 271 repetições.

| Destino | Linhas |
|---|---|
| Importadas (Tarefa fechada, todas "avisada") | **245** |
| Sem Centro de Custo | 435 |
| Repetição do mesmo TaskID | 271 |
| Sem decisão (`Aprovado` nulo) | 148 |
| Centro de Custo fora do catálogo | 13 |
| Decisão trocada entre linhas (`decisao_conflitante`) | 2 |

Lacunas nas 245: sem Valor, sem CPF/CNPJ, sem data de criação (todas — a origem não tem essas colunas); 35 sem Data Vencimento (só havia previsão de pagamento); 244 sem anexo (a exportação do ClickUp só tinha 1).

### Decisões do dono

1. **Valor e CPF/CNPJ não são importados.** Só existem no texto livre da IA em `comentario`; D-25 proíbe reconstruir de texto livre. O texto inteiro entra como Comentário do RESUMO.
2. **Só entram as Solicitações completas** (Centro de Custo + decisão). As ~580 sem esses dados ficam na tabela antiga, que vira arquivo somente-leitura. Não existe Status fechado para "sem decisão", e o Centro de Custo é o único campo obrigatório da Lista.
3. **Empresa por de-para** do identificador do legado (`tria` → Tria Company, `finq` → Konq Intermediações, `pf` → Marcos Paulo…). Aceito que `tria` também é o padrão do legado quando nada casa.
4. **Data Vencimento só do vencimento real.** `Data_previsao` mistura o vencimento do ClickUp (DD/MM/AAAA) com a previsão de pagamento calculada (AAAA-MM-DD); só o primeiro é vencimento.
5. **Decisão conflitante nunca é resolvida pelo importador** — a 1ª ocorrência vira ambígua (`decisao_conflitante`) em vez de a mais antiga vencer.
6. **Anexos no Supabase Storage agora** (bucket privado `anexos-solicitacoes`, criado pelo dono), migração para servidor próprio vira fase futura.

### Verificação

| Critério | Resultado |
|---|---|
| Dry-run quantifica ausentes/duplicados/ambíguos | `taskid_ausente` 0, `taskid_duplicado` 271, `aprovado_ambiguo` 148, `decisao_conflitante` 2 |
| Ambíguas decididas com o dono antes do apply | Sim — ficam fora (decisão 2) |
| Lista tem o número declarado como importadas | 245 Tarefas `provenance.kind = "import"` na Lista |
| Reaplicação completa cria 0 | Run `1d3f0828`: importadas 0, duplicadas 843 |
| `reconciliar` | `bateComOLedger: true` (245 avisadas + 598 rejeitadas = 843) |
| Outbox não cresceu | 0 antes, 0 depois |
| Manifesto sem dado individual | Nenhum TaskID, CPF, CNPJ, e-mail ou credencial nos três |

**Interrupção no meio do apply:** a 1ª execução parou na página 13 (a do único anexo real) por `SUPABASE_STORAGE_BUCKET` ausente — o dry-run não sobe anexos e não pegou isso. As 28 Tarefas das páginas 1-12 ficaram íntegras (a página 13 falhou antes da transação), e `--resume` completou as 217 restantes sem duplicar.

**Inspeção de 3 Tarefas na interface:** pendente com o dono.

## Next Phase Readiness

- O critério 5 do ROADMAP ("as 1.110 Solicitações históricas") precisa ser reescrito para o que a origem de fato tem: 843 Solicitações, 245 importáveis — decisão 2.
- `DATABASE_SSL_INSECURE=true` segue no `.env` do notebook do dono; o apply rodou sem verificação de TLS. Antes de qualquer execução fora do notebook, fixar `DATABASE_CA_PATH`.
- O bucket `anexos-solicitacoes` foi criado sem limite de tamanho nem restrição de tipo no próprio bucket (o código aplica os limites no envio). É o mesmo bucket que o Formulário público usa.
- Pendência para o 02-28 (corte): linhas novas gravadas pelo pipeline antigo depois deste apply entram numa rodada extra de `--apply` (idempotente) antes de desligar o ClickUp.

## Self-Check: PASSED

- `apps/api/src/importacao/financeiro/anexos.ts` — FOUND
- `apps/api/src/importacao/financeiro/importar.ts` — FOUND
- `apps/api/src/importacao/financeiro/manifesto.ts` — FOUND
- `apps/api/src/importacao/financeiro/importar.cli.ts` — FOUND
- `apps/api/src/importacao/financeiro/importar.test.ts` — FOUND
- Commit `f8cba87` — FOUND (`git log --oneline --all | grep f8cba87`)
- Commit `9b099ce` — FOUND (`git log --oneline --all | grep 9b099ce`)

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Plan: 25 (3 de 3)*
*Completed: 2026-09-25*
