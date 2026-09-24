---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 24
subsystem: testing
tags: [contract-test, automations, whatsapp, outbox, canal, cr-02, d5-19, gap-closure]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 13)
    provides: "destinoDeCanal alinhado à Solicitação (D5-19), CANAL_LISTA_ID/CANAL_CAMPO_EMPRESA_ID/CANAL_CAMPO_WHATSAPP_ID derivadas do catálogo real, PedidoDeNotificacaoPorCanal.indicePasso — este plano deriva o par evento/DTO a partir exatamente desse código"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 17)
    provides: "eventosDeNotificacaoPorCanal/execucoesNovas (apps/api/src/persistencia/eventos-de-canal.ts) — a ponte pura entre o domínio e o outbox que este plano chama diretamente, sem banco"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 18)
    provides: "notificar-canal-routes.ts alinhado a fld_sp_z_whatsapp, gate EMPRESA_SEM_CANAL, ROTULOS_CONHECIDOS exportado — o lado que este plano prova contra o DTO real, não contra stubs"
provides:
  - "contratos/notificar-canal-v1/ — três fixtures canônicas (campo.gasto-novo, rotulos.gasto-novo, sem-canal.tria) geradas do seed real (buildSeed + evoluirConfiguracaoDeSolicitacoes + evoluirConfiguracaoPorEmpresa), do gatilho real (runListAutomations/pedidosDeNotificacaoPorCanal) e do DTO v1 real (paraDtoV1) — nunca fabricadas à mão"
  - "apps/api/src/contratos/notificar-canal.contrato.test.ts — gerador/verificador: ATUALIZAR_CONTRATO=1 regenera; sem a variável, compara por toEqual contra o JSON versionado"
  - "../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts — consumidor: lê as fixtures por listagem de diretório, chama a rota real (montarRotasDeNotificacaoPorCanal) com o adapter real (criarPlataformaAdapter, valida o DTO pelo schema real)"
  - "O Critério 4 do 05-VERIFICATION.md (\"um teste de contrato ponta a ponta\") deixa de ser missing: os dois lados agora reprovam deriva um do outro, não só a própria metade isolada"
affects: ["05-VERIFICATION.md (re-verificação do Critério 4)", "qualquer plano futuro que toque destinoDeCanal, paraDtoV1, EVENTOS['automacao.notificar-canal.v1'] ou notificar-canal-routes.ts — o contrato agora fica vermelho na deriva, dos dois lados"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixtures cross-repo geradas de um lado (seed real → domínio real → DTO real) e consumidas pelo outro (rota real → adapter real), lidas pelo caminho relativo entre os dois checkouts irmãos — o mesmo precedente de contratos/payment-requests-v1/, agora no sentido plataforma → automation/ (evento de outbox), não só automation/ → plataforma (contrato HTTP v1)"
    - "Normalização mínima e documentada: só identidade de instância de teste (eventId, occurredAt, taskId, executionId, readableId, createdAt/updatedAt) vira literal fixo — o que o contrato fixa (campoDestinoId, destinoTipo, rotulos, mensagemId, fields.*) nunca é tocado, é lido direto do resultado real"
    - "Fixture sintética documentada: quando o caminho real não produz evento (recusa antes de qualquer execução concluída), o payload é montado à mão no MESMO schema do outbox e marcado com um campo de documentação (\"sintetico\": true) que o consumidor remove antes de postar — nunca um campo que o schema .strict() da rota precisa aceitar"
    - "Consumidor lê fixtures por listagem de diretório (readdirSync), não por nome fixo — uma fixture nova entra na suíte sem editar o arquivo; ausência do diretório é falha explícita, nunca skip condicional"

key-files:
  created:
    - contratos/notificar-canal-v1/README.md
    - contratos/notificar-canal-v1/campo.gasto-novo.json
    - contratos/notificar-canal-v1/rotulos.gasto-novo.json
    - contratos/notificar-canal-v1/sem-canal.tria.json
    - apps/api/src/contratos/notificar-canal.contrato.test.ts
    - ../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts (repositório irmão)
  modified: []

key-decisions:
  - "As DUAS Automações de Canal (modo campo e modo rótulos) disparam na MESMA Solicitação do Marcos Paulo (uma criação, runListAutomations uma vez) — não duas Tarefas separadas: o par consumidor recebe o DTO de UMA Tarefa real, e as duas fixtures (campo.gasto-novo/rotulos.gasto-novo) compartilham o mesmo bloco `tarefa`, só o `evento`/`esperado` diverge por Automação."
  - "sem-canal.tria reusa as MESMAS duas Automações já publicadas, aplicadas a uma segunda Solicitação (Empresa \"Tria Company\", sem avisosPorCanal) — não uma terceira Automação dedicada: o domínio recusa nos dois modos pelo MESMO motivo (Integração sem avisosPorCanal.whatsapp), então zero eventos reais, confirmado por asserção antes de montar a fixture sintética."
  - "IDs normalizados são literais descritivos sem dígitos corridos (`tsk-fixture-canal-marcos-paulo`, `evt-fixture-canal-campo`, etc.), não UUIDs gerados — decisão deliberada para que o grep de 9+ dígitos do aceite (T-5-79, nenhuma sequência que pareça telefone) passe sem exceção a justificar no SUMMARY."
  - "O marcador `\"sintetico\": true` fica DENTRO do objeto `evento` da fixture (não num campo irmão no nível raiz) — o consumidor faz `const { sintetico, ...resto } = fixture.evento` antes de postar `resto`, porque o schema `.strict()` da rota do automation/ rejeitaria um campo desconhecido."
  - "O teste consumidor despacha a asserção por FORMATO de `fixture.esperado` (`\"http\" in esperado` / `\"destinos\" in esperado` / `\"rotulos\" in esperado`), não por `fixture.caso` — mais genérico, mais fiel ao texto do plano (\"fixture nova entra sozinha\"), e uma fixture com um `esperado` de formato desconhecido falha alto e claro (`assert.fail`) em vez de ser ignorada."
  - "Números de rótulo no teste consumidor são os MESMOS fakes já usados em `notificar-canal-routes.test.ts` (05-18) — reaproveitados, não reinventados, para não introduzir uma segunda fonte de \"número de teste\" no mesmo repositório."

requirements-completed: [AUTO-02]

# Metrics
duration: ~65min
completed: 2026-09-24
---

# Phase 05 Plan 24: O contrato ponta a ponta de `notificar-canal.v1` — gerador (crm-n1) e consumidor (automation/) Summary

**Três fixtures cross-repo (`contratos/notificar-canal-v1/`), geradas do seed real e do DTO v1 real por um teste em `crm-n1` e consumidas pela rota real + adapter real em `automation/` — o Critério 4 do `05-VERIFICATION.md` ("um teste de contrato ponta a ponta") deixa de ser `missing`.**

## Performance

- **Duration:** ~65 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 6 (5 novos em `crm-n1`, 1 novo no repositório irmão `../financeiro-tria`; nenhum arquivo existente modificado)

## Accomplishments

- **Task 1 — o lado gerador/verificador (`crm-n1`).** `apps/api/src/contratos/notificar-canal.contrato.test.ts` monta o Estado por `buildSeed()` + `evoluirConfiguracaoDeSolicitacoes` + `evoluirConfiguracaoPorEmpresa`, publica as duas Automações de Canal reais (modo campo: `canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID`; modo rótulos: `canalDestinatariosDaEmpresa: true`) sobre a Lista real (`CANAL_LISTA_ID`), cria a Solicitação do Marcos Paulo com Campos preenchidos (`fld_sp_c_empresa`, `fld_sp_z_whatsapp`, Nome do fornecedor, Valor, Data Vencimento — na mesma ordem de `submitForm`, Campos antes do gatilho), dispara `tarefaCriada` uma vez (as duas Automações disparam na MESMA Tarefa) e deriva `eventosDeNotificacaoPorCanal`/`paraDtoV1` — nunca fabricados à mão. Cada payload é validado contra `EVENTOS["automacao.notificar-canal.v1"]` e cada DTO contra `EsquemasV1.getTask.resposta` ANTES de virar fixture. Uma segunda Solicitação (Tria Company, sem `avisosPorCanal`) prova zero eventos reais nas duas Automações, e a fixture `sem-canal.tria.json` carrega um evento **sintético** (marcado `"sintetico": true`) no mesmo formato validado pelo schema real. `ATUALIZAR_CONTRATO=1` regenera as três fixtures; sem a variável, o gerado normalizado é `toEqual` contra o JSON versionado. Um caso de controle prova que a comparação reprova uma mutação (`campoDestinoId` trocado por `fd_cp_whatsapp`).
- **Task 2 — o lado consumidor (`../financeiro-tria/automation`).** `src/http/notificar-canal.contrato.test.ts` lê TODAS as fixtures de `crm-n1/contratos/notificar-canal-v1/` por listagem de diretório (o mesmo precedente de `adapters/plataforma.test.ts`), sobe a rota real (`montarRotasDeNotificacaoPorCanal`) com `obterTarefa` vindo do ADAPTER real (`criarPlataformaAdapter(...).getTask`, contra um servidor HTTP efêmero devolvendo `fixture.tarefa` — o DTO passa pelo schema real do adapter, não um stub tipado à mão) e um `enviarWhatsApp` espião. Despacha a asserção pelo FORMATO de `fixture.esperado`: `destinos` → 202, um envio; `rotulos` → todo rótulo pertence a `ROTULOS_CONHECIDOS`, 202, um envio por rótulo na ordem declarada; `http`/`code` → status e código de erro exatos, zero envios. Um teste de controle prova `422 DESTINO_INDISPONIVEL` para `campoDestinoId` mutado para um Campo de Contas a pagar.
- **README.md** (`contratos/notificar-canal-v1/README.md`) documenta o que cada fixture prova, quem gera, quem consome, como regenerar, a regra de normalização, e a convenção do marcador `sintetico`.

## Task Commits

Cada task foi commitada atomicamente, no repositório de quem tem os arquivos:

1. **Task 1: O lado gerador/verificador (crm-n1)** — `7f1ce89` (test), checkout principal do `crm-n1`
2. **Task 2: O lado consumidor (../financeiro-tria/automation)** — `0e71af8` (test), repositório irmão `financeiro-tria`, branch `main`

**Plan metadata:** este `SUMMARY.md` — commitado pelo orquestrador junto com `STATE.md`/`ROADMAP.md`, conforme instruído.

_Nota CON-05: o commit `0e71af8` é do repositório irmão `../financeiro-tria`, um repositório git distinto de `crm-n1`. Só um arquivo de código deste plano vive lá; os outros cinco (as três fixtures, o README e o teste gerador) vivem em `crm-n1`._

## Files Created/Modified

- `contratos/notificar-canal-v1/README.md` (novo) — o que cada fixture prova, quem gera/consome, como regenerar, normalização, convenção `sintetico`.
- `contratos/notificar-canal-v1/campo.gasto-novo.json` (novo) — modo campo, destino em `fld_sp_z_whatsapp`/`requesterWhatsApp`.
- `contratos/notificar-canal-v1/rotulos.gasto-novo.json` (novo) — modo rótulos, `["mari", "marcos", "grupo-financeiro"]` da Integração real do Marcos Paulo.
- `contratos/notificar-canal-v1/sem-canal.tria.json` (novo) — recusa por Empresa sem canal, evento sintético, `esperado: { http: 422, code: "EMPRESA_SEM_CANAL" }`.
- `apps/api/src/contratos/notificar-canal.contrato.test.ts` (novo) — gerador/verificador, 5 testes (3 fixtures + 1 asserção de zero eventos da Tria Company + 1 controle de mutação).
- `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts` (novo, repositório irmão) — consumidor, 4 testes (3 fixtures lidas por diretório + 1 controle de mutação).

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: uma Solicitação real para as duas fixtures do Marcos Paulo (campo+rótulos disparam juntos); `sem-canal.tria` reusa as mesmas duas Automações sobre uma segunda Solicitação, sem Automação dedicada; ids normalizados são literais descritivos sem dígitos corridos (nunca UUID gerado, para o grep de "parece telefone" passar sem exceção); o marcador `sintetico` fica dentro do `evento` e o consumidor o remove antes de postar; o consumidor despacha por formato de `esperado`, não por nome de caso; números de rótulo de teste reaproveitam os fakes já existentes em `notificar-canal-routes.test.ts` (05-18).

## Deviations from Plan

None — plano executado exatamente como escrito. As três fixtures foram geradas na primeira tentativa (`ATUALIZAR_CONTRATO=1`), inspecionadas, e tanto o teste gerador quanto o consumidor passaram de primeira depois de escritos — nenhum ajuste de comportamento de produção foi necessário. O único ajuste foi editorial: a doc-string inicial de `carregarFixtures()` usava a palavra "skip" para dizer que NÃO existe skip condicional, o que fazia `grep -n "skip"` (um dos critérios de aceite) encontrar uma ocorrência apesar de não haver skip de verdade — reescrita para não usar a palavra, sem mudar o comportamento nem o sentido do comentário.

## Issues Encountered

None. `npm run typecheck -w @n1/api`, a geração das fixtures, as duas execuções seguidas sem `ATUALIZAR_CONTRATO`, `npm run lint`, `npx tsx --test` e `npm run build` do lado do `automation/` passaram todos de primeira.

## Prova de deriva (feita e desfeita nesta sessão, não commitada — acceptance criteria da Task 2)

**(a) Mutar `CAMPO_ID_PARA_CHAVE` no `automation/` deixa o teste CONSUMIDOR vermelho.** Troquei temporariamente a chave de `CAMPO_ID_PARA_CHAVE` em `notificar-canal-routes.ts` de `fld_sp_z_whatsapp` para um id inexistente (`fld_sp_z_whatsapp_MUTADO_PARA_PROVAR_DERIVA`) e rodei `npx tsx --test --test-concurrency=1 src/http/notificar-canal.contrato.test.ts`: o caso `campo.gasto-novo` falhou (`422 DESTINO_INDISPONIVEL` em vez do `202` esperado) — 3 passed, 1 failed. Revertido com `git diff --stat` confirmando zero diferença.

**(b) Mutar `CANAL_CAMPO_WHATSAPP_ID` no domínio (`crm-n1`) sem regenerar deixa o teste GERADOR vermelho.** Troquei temporariamente `CANAL_CAMPO_WHATSAPP_ID` em `packages/dominio/src/operations/automations.ts` para apontar para outro Campo real do catálogo (`fld_sp_i_nome_do_fornecedor`, "Nome do fornecedor") e rodei o teste gerador: a suíte falhou (`fixture: fields.requesterWhatsApp vazio no DTO do Marcos Paulo` — porque `CANAL_CAMPO_WHATSAPP_ID` e `CAMPO_FORNECEDOR_ID` passaram a apontar para o MESMO Campo, e a segunda escrita de Campo no teste sobrescreveu a primeira, deixando `fld_sp_z_whatsapp` — o Campo que `paraDtoV1` de fato lê para `requesterWhatsApp` — vazio). Resultado: vermelho, como o critério pede, por um caminho concreto e reproduzível (não um crash de import — `campoDoCatalogo` não lançou porque o novo id/rótulo eram um par válido do catálogo real). Revertido com `git diff --stat` confirmando zero diferença. Depois do revert, os dois testes (gerador e consumidor) voltaram a passar 100% — confirmado por reexecução de ambos.

## User Setup Required

None — nenhuma configuração de serviço externo, nenhuma migração, nenhuma variável de ambiente. Os dois testes são puros (sem banco, sem rede — o servidor HTTP efêmero do `automation/` roda em porta local, dentro do próprio teste).

## Verificação executada nesta sessão (regras operacionais do projeto)

- `npm run typecheck -w @n1/api` — verde, `===EXIT=0===`.
- `(cd apps/api && npx vitest run src/contratos/notificar-canal.contrato.test.ts --testTimeout=20000)` — 5/5 verde, rodado TRÊS vezes (geração + duas verificações consecutivas sem `ATUALIZAR_CONTRATO`), sempre `===EXIT=0===` e o mesmo resultado.
- `npm run lint` (workspace `@n1/web`, único com `eslint`) — verde.
- Greps de aceite da Task 1: `fld_sp_z_whatsapp` em `campo.gasto-novo.json` = 1 (≥1); `"mari"` em `rotulos.gasto-novo.json` = 2 (≥1); `EMPRESA_SEM_CANAL` em `sem-canal.tria.json` = 1 (exato); `grep -cE "[0-9]{9,}"` nos três arquivos = 0/0/0.
- `npx tsx --test --test-concurrency=1 src/http/notificar-canal.contrato.test.ts` (`../financeiro-tria/automation`) — 4/4 verde, `===EXIT=0===`, rodado duas vezes (antes e depois da prova de deriva).
- `npm run build` (`../financeiro-tria/automation`, `tsc --noEmit`) — verde, `===EXIT=0===`, rodado duas vezes.
- `npm test` (`../financeiro-tria/automation`, suíte completa) — **224/225** — a única falha é a pré-existente `src/tenants/tria/payment-rules.test.ts:37` (`resolve responsavel por centro de custo com fallback`, mesma linha documentada desde a Fase 4/05-18); 221 testes pré-existentes + 4 novos deste plano = 225, sem nenhuma falha nova fora do arquivo pré-existente.
- Greps de aceite da Task 2: `grep -c "notificar-canal-v1"` = 3 (≥1); `grep -c "criarPlataformaAdapter"` = 3 (≥1); `grep -n "skip"` = 0 ocorrências (nenhum pulo condicional).
- `git -C ../financeiro-tria diff --cached --name-only` conferido ANTES do commit — exatamente `automation/src/http/notificar-canal.contrato.test.ts`, nenhum dos 89 arquivos pré-existentes sujos.
- Checkout principal do `crm-n1` confirmado ANTES de começar (`[ -f .git ]` falso — é diretório, não worktree; `git rev-parse --abbrev-ref HEAD` = `reestrutura-monorepo-e-plano-financeiro`), como as regras operacionais do plano exigem (o teste do `automation/` lê `../../../../crm-n1/contratos/...` a partir da posição real do checkout).
- Nenhum comando proibido rodado (`npm run check`, `npm test` no `crm-n1`, `npm run test -w @n1/api`, `npx vitest run` sem caminho).
- Todos os comandos seguiram `cmd > "$LOG" 2>&1; echo "===EXIT=$?===" >> "$LOG"` — nunca pipe entre comando e código de saída.
- Nenhuma migração aplicada, nenhum `--apply`, nenhum deploy: nenhum comando de banco rodou nesta sessão (os dois testes são puros).

## Next Phase Readiness

- O Critério 4 do `05-VERIFICATION.md` ("um teste de contrato ponta a ponta que monte a Tarefa pelo seed real, rode `pedidosDeNotificacaoPorCanal`, passe o payload pelo schema do `automation/` e resolva o destino contra o DTO real — hoje cada lado testa só a própria metade") tem agora exatamente esse teste, dos dois lados — confirmado por leitura E por execução nesta sessão, não só por existência do arquivo.
- Qualquer deriva futura em `destinoDeCanal`, `paraDtoV1`, `EVENTOS["automacao.notificar-canal.v1"]` ou `notificar-canal-routes.ts` fica vermelha em um dos dois testes — demonstrado nesta sessão com as duas provas de deriva (feitas e revertidas).
- Nenhum bloqueio para a re-verificação da Fase 5: este plano não tocou `ws_n1`, não aplicou migração, não mudou comportamento de produção — só adicionou testes puros e fixtures versionadas.
- CR-02 (`05-REVIEW.md`) tem agora sua prova ponta a ponta permanente; os outros itens do `05-VERIFICATION.md` (Critério 1 `--apply` pendente, Critério 2 CR-01, Critério 3 relógio desligado) continuam fora do escopo deste plano de fechamento de lacunas específico.

## Self-Check: PASSED

- `contratos/notificar-canal-v1/README.md` — FOUND em disco.
- `contratos/notificar-canal-v1/campo.gasto-novo.json` — FOUND em disco.
- `contratos/notificar-canal-v1/rotulos.gasto-novo.json` — FOUND em disco.
- `contratos/notificar-canal-v1/sem-canal.tria.json` — FOUND em disco.
- `apps/api/src/contratos/notificar-canal.contrato.test.ts` — FOUND em disco.
- Commit `7f1ce89` — FOUND em `git log --oneline --all` (crm-n1).
- `../financeiro-tria/automation/src/http/notificar-canal.contrato.test.ts` — FOUND em disco.
- Commit `0e71af8` — FOUND em `git -C ../financeiro-tria log --oneline --all`.
- Reexecução final nesta sessão, depois de todas as provas de deriva revertidas: `crm-n1` 5/5 verde; `automation/` 4/4 verde + `npm run build` verde.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
