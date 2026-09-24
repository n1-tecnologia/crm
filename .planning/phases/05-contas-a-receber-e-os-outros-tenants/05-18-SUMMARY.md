---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 18
subsystem: automation
tags: [webhooks, whatsapp, evolution-api, multi-tenant, idempotency, retry, gap-closure]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 15)
    provides: "receipts-da-plataforma.ts — módulo neutro reivindicarReceipt/fecharReceipt/falhou_retentavel, consumido por esta rota em vez de recriado"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 08)
    provides: "notificar-canal-routes.ts — a rota original que este plano corrige (CR-02, WR-02, CR-03, WR-03)"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 04)
    provides: "tenantDaEmpresa/TENANT_POR_EMPRESA — a tabela que o gate EMPRESA_SEM_CANAL consulta"
provides:
  - "notificar-canal-routes.ts alinhado a D5-19: só aceita fld_sp_z_whatsapp (Solicitação), nunca fd_cp_whatsapp (Contas a pagar)"
  - "Gate 422 EMPRESA_SEM_CANAL: só a Empresa do Marcos Paulo recebe envio por esta rota, nos dois modos de destino"
  - "ROTULOS_CONHECIDOS exportado — fonte única para o mapa rótulo → número e para um futuro teste de contrato (05-24)"
  - "Retentativa honesta de falha transitória (falhou_retentavel) e classificação de erro que distingue ErroPermanenteDaPlataforma/ErroTransitorioDaPlataforma ANTES da regex da Evolution"
  - "Log sanitizado: console.error com code/http/erro.name, nunca o objeto erro nem o corpo cru da Evolution"
affects:
  - "05-24 (contrato ponta a ponta que prova o alinhamento domínio ↔ automation/ para fld_sp_z_whatsapp) — este plano deixou o comentário do mapeamento apontando para lá"
  - "Critério 4 do ROADMAP (Fase 5) — fecha a metade `automation/` de CR-02/CR-03/WR-02/WR-03 do 05-REVIEW.md; a outra metade (domínio, CR-05, formulário público) é escopo de outros planos do fechamento de lacunas"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consumir módulo neutro (receipts-da-plataforma.ts) em vez de recriar a lógica de receipt duas vezes — a mesma rota que antes tinha a doutrina de RECRIAR autenticação agora divide isso em dois: autenticação continua recriada (superfície nova, não acopla ao contrato v1); receipt vem do módulo neutro (não é o contrato v1, é compartilhado de propósito)"
    - "Classificação de erro por instanceof de classes de erro do domínio (ErroPermanenteDaPlataforma/ErroTransitorioDaPlataforma) ANTES de qualquer heurística por regex de mensagem — a heurística vira fallback, não a primeira linha de defesa"
    - "Gate de Empresa por tenantDaEmpresa lido da Tarefa via getTask, nunca do corpo do evento — mesma disciplina fail-closed de TENANT_POR_EMPRESA (05-04) aplicada a uma segunda rota"
    - "Log de erro como uma única string interpolada (nunca o objeto Error nem seu .message) — o padrão que WR-03 pede vale para qualquer rota que chame um adapter de terceiro cujo corpo de erro pode conter dado sensível"

key-files:
  created: []
  modified:
    - ../financeiro-tria/automation/src/http/notificar-canal-routes.ts
    - ../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts

key-decisions:
  - "CAMPO_ID_PARA_CHAVE trocou de fd_cp_whatsapp (Contas a pagar, mapeamento errado) para fld_sp_z_whatsapp (Solicitação de pagamento) — D5-19: a Lista-alvo de AUTO-02 é 'Solicitações de pagamento', e requesterWhatsApp no DTO v1 já é exatamente esse Campo."
  - "O gate EMPRESA_SEM_CANAL roda uma vez, logo depois de obterTarefa, ANTES de resolver destino — vale para os dois modos (campo e rótulos), porque os dois herdam a mesma instância Evolution/números do Marcos Paulo (WR-02)."
  - "ROTULOS_CONHECIDOS é a fonte única de chaves: numeroPorRotuloReal() monta o mapa a partir dela (via um segundo objeto NUMERO_POR_ROTULO_CONHECIDO tipado pelas chaves de ROTULOS_CONHECIDOS), não um literal duplicado que pudesse divergir."
  - "receipts-da-plataforma.ts (módulo neutro de 05-15) substituiu a cópia local de ClienteDeReceipts/inserirReceiptSeNovo/marcarReceipt — CR-03 aterrissa uma vez, consumida pelas duas rotas plataforma → automation/ (webhooks-plataforma.ts desde 05-15, esta rota desde este plano)."
  - "classificarErroDeEnvio ganhou httpStatus numérico e checa as duas classes de erro do adapter da plataforma ANTES da regex textual da Evolution — um 404 permanente do getTask não é mais classificado como transitório (o defeito que CR-03 descreveu)."
  - "O resumo gravado no receipt em falha (fecharReceipt) é sempre `code=... http=...`, nunca erro.message — a mesma disciplina do log aplicada à persistência, para que nem o Postgres do automation/ guarde o corpo cru da Evolution."

requirements-completed: []  # AUTO-02 continua sem requirements-completed aqui — esta é a metade `automation/`; a metade domínio (CR-05, formulário público → evento de Canal) e o teste de contrato ponta a ponta (05-24) ainda faltam para AUTO-02 fechar por completo (05-VERIFICATION.md Critério 4).

# Metrics
duration: ~65min
completed: 2026-09-24
---

# Phase 05 Plan 18: A rota de Canal fala de Solicitação e não perde mensagem em falha transitória (CR-02, WR-02, CR-03, WR-03) Summary

**`../financeiro-tria/automation/src/http/notificar-canal-routes.ts` alinhada à decisão D5-19 (aceita `fld_sp_z_whatsapp`, não mais `fd_cp_whatsapp`), com um gate `422 EMPRESA_SEM_CANAL` que restringe todo envio à Empresa do Marcos Paulo, consumindo o módulo neutro de receipts de 05-15 para reenviar de verdade numa falha transitória (nunca mais "duplicated" sobre um evento que nunca teve efeito), e um log que nunca carrega o corpo de erro da Evolution.**

## Performance

- **Duration:** ~65min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 2, ambos em `../financeiro-tria/automation/src/http/` (nenhum arquivo em `crm-n1`)

## Accomplishments

- **Task 1 — a rota fala de Solicitação e só notifica a Empresa que tem canal (CR-02, WR-02).** `CAMPO_ID_PARA_CHAVE` passou a ser `{ fld_sp_z_whatsapp: "requesterWhatsApp" }` — o mapeamento errado `fd_cp_whatsapp` (que apontava para um Campo de Contas a pagar) saiu; qualquer outro id, incluindo o antigo, continua `422 DESTINO_INDISPONIVEL`. `TarefaParaNotificar.fields` ganhou `company: string | null`. Logo depois de `obterTarefa`, ANTES de resolver destino (nos dois modos, `campo` e `rotulos`), um gate novo chama `tenantDaEmpresa(tarefa.fields.company)`: qualquer coisa fora de `"marcos-paulo"` fecha o receipt `falhou` com código `EMPRESA_SEM_CANAL` e responde `422` sem nenhum envio — a instância Evolution e os números continuam sendo, hoje, só os do Marcos Paulo, então nenhuma outra Empresa pode sair por essa rota até existir um mapa rótulo → número por tenant. `ROTULOS_CONHECIDOS = ["mari", "marcos", "grupo-financeiro"] as const` foi exportado, e `numeroPorRotuloReal()` passou a montar o mapa a partir dessa lista (via um objeto auxiliar tipado pelas chaves dela), em vez de um literal separado que pudesse divergir.
- **Task 2 — retentativa honesta e log sem número (CR-03, WR-03).** A cópia local de `ClienteDeReceipts`/`inserirReceiptSeNovo`/`marcarReceipt`/`TABELA_RECEIPTS` foi apagada; a rota agora importa `reivindicarReceipt`/`fecharReceipt` de `./receipts-da-plataforma.ts` (o módulo neutro que 05-15 criou para `webhooks-plataforma.ts`, agora também consumido aqui — CR-03 corrigido uma vez, não duas). `classificarErroDeEnvio` ganhou `httpStatus` numérico e passou a checar `instanceof ErroPermanenteDaPlataforma` (código do erro, `retryable: false`) e `instanceof ErroTransitorioDaPlataforma` (`retryable: true`) ANTES da regex textual da Evolution — um 404 permanente do `getTask` (ex.: `ENTIDADE_NAO_ENCONTRADA`) não é mais classificado como transitório por padrão. No `catch`, `fecharReceipt` grava `falhou_retentavel` se o erro for retentável, `falhou` se não — o `resumo` gravado é sempre `code=... http=...`, nunca `erro.message`. O `console.error` virou uma única string interpolada (`code`, `http`, `erro.name`) — nunca o objeto `erro`, então o corpo de erro da Evolution (que costuma repetir o número de destino) nunca chega ao log do processo nem ao receipt no Postgres.

## Task Commits

Cada task foi commitada atomicamente no repositório irmão `../financeiro-tria` (branch `main`):

1. **Task 1: A rota fala de Solicitação e só notifica a Empresa que tem canal (CR-02, WR-02)** — `20ac4e2` (feat) — `automation/src/http/notificar-canal-routes.ts`, `notificar-canal-routes.test.ts` (+5 testes, `q`–`u`, agora 21)
2. **Task 2: Retentativa honesta e log sem número (CR-03, WR-03)** — `5f9241b` (fix) — `automation/src/http/notificar-canal-routes.ts`, `notificar-canal-routes.test.ts` (+7 testes, `v`–`z`, agora 28)

**Plan metadata:** este arquivo (`05-18-SUMMARY.md`), escrito em `crm-n1` mas **deixado sem commit de propósito** — o orquestrador é quem commita `STATE.md`/`ROADMAP.md`/este SUMMARY, conforme instruído na tarefa deste executor.

_Nota CON-05: as SHAs acima são do repositório irmão `../financeiro-tria`, um repositório git distinto de `crm-n1`. Nenhum arquivo de código deste plano vive em `crm-n1`._

## Files Created/Modified

- `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` — `CAMPO_ID_PARA_CHAVE` só `fld_sp_z_whatsapp`; `TarefaParaNotificar.fields.company`; gate `EMPRESA_SEM_CANAL`; `ROTULOS_CONHECIDOS` exportado; receipts consumidos de `receipts-da-plataforma.ts`; `classificarErroDeEnvio` com `httpStatus` e checagem de classes de erro antes da regex; log sanitizado (modificado)
- `../financeiro-tria/automation/src/http/notificar-canal-routes.test.ts` — testes `(f)`–`(p)` atualizados para o novo id de Campo e `company: "Marcos Paulo"` no stub padrão; 12 testes novos `(q)`–`(z)` cobrindo os dois gates, a retentativa honesta e a sanitização de log (modificado)

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o mapeamento de Campo segue D5-19 (Solicitação, não Contas a pagar); o gate de Empresa é único e roda antes de qualquer resolução de destino, nos dois modos; `ROTULOS_CONHECIDOS` é a fonte única para o mapa de números; CR-03 passou a ser corrigido num módulo neutro compartilhado em vez de duplicado; a classificação de erro prioriza as classes tipadas do adapter sobre a heurística de regex; e a disciplina de "nunca o corpo cru do erro" vale tanto para o log quanto para o `resumo` gravado no receipt.

## Deviations from Plan

None — plano executado exatamente como escrito. As task 1 e task 2 tocaram os mesmos dois arquivos (`notificar-canal-routes.ts`/`.test.ts`), como o próprio plano previa (`files_modified` idêntico nas duas tasks), e cada uma foi commitada separadamente com `git diff --cached --name-only` conferido antes de cada commit.

## Issues Encountered

None. `npm run build` (`tsc --noEmit`) verde na primeira tentativa depois de cada task; nenhum retrabalho de tipo.

## Verificação executada nesta sessão

- **Task 1:** `cd ../financeiro-tria/automation && npx tsx --test --test-concurrency=1 src/http/notificar-canal-routes.test.ts` → **21/21**, `===EXIT=0===`. `npm run build` → `===EXIT=0===`.
- **Task 2:** `npx tsx --test --test-concurrency=1 src/http/notificar-canal-routes.test.ts src/http/receipts-da-plataforma.test.ts` → **42/42** (21 + 21, execução conjunta), `===EXIT=0===`. `npm run build` → `===EXIT=0===`.
- **Suíte completa do `automation/`:** `npm test` → **220/221** — a única falha é a pré-existente `src/tenants/tria/payment-rules.test.ts:37` (documentada nas regras operacionais deste plano) — confirmado que nenhuma falha nova apareceu fora dos arquivos deste plano.
- **Acceptance criteria Task 1 (greps):** `grep -n "fd_cp_whatsapp"` só aparece em comentário histórico (linha 228, "mapeamento errado apontando para um Campo de outra Lista"); `grep -c 'fld_sp_z_whatsapp: "requesterWhatsApp"'` = 1; `grep -c "EMPRESA_SEM_CANAL"` = 3 (≥ 2); `grep -c "tenantDaEmpresa"` = 2 (≥ 1); `grep -c "export const ROTULOS_CONHECIDOS"` = 1.
- **Acceptance criteria Task 2 (greps):** `grep -n "function inserirReceiptSeNovo\|function marcarReceipt"` não devolve nada; `grep -c "receipts-da-plataforma"` = 2; `grep -n "console.error(.*, erro)"` não devolve nada; `grep -n "ErroPermanenteDaPlataforma\|ErroTransitorioDaPlataforma"` mostra os dois dentro de `classificarErroDeEnvio`, antes da regex `falhou: (\d{3})` (confirmado por leitura das linhas 286-318).
- **Teste "500 → retentativa → reenvio":** `(v)` afirma 2 tentativas totais de `enviarWhatsApp` (1 falha + 1 sucesso), `chamadas.length === 1` na segunda entrega, `concluido` no fim, e terceira entrega `duplicated` sem nova chamada.
- **Teste de log:** `(z)` espiona `console.error`/`console.warn` com `mock.method` em dois cenários (503 transitório, 400 permanente) e afirma que nenhum argumento registrado é uma instância de `Error` nem contém o número de telefone (`5511999998888`) ou o texto `Evolution sendText falhou`.
- **Escopo do `git add`:** `git -C ../financeiro-tria diff --cached --name-only` conferido antes de cada um dos dois commits — exatamente os dois arquivos do plano, nunca os ~89 arquivos sujos pré-existentes (confirmado: `git diff --name-only` sem os commits mostra os mesmos 89 arquivos de sempre).
- **Nenhum arquivo fora de escopo tocado:** `git show --stat --name-only` dos dois commits (`20ac4e2`, `5f9241b`) lista só `notificar-canal-routes.ts`/`.test.ts`. `adapters/evolution.ts` não aparece em nenhum dos dois commits. `adapters/plataforma.ts` aparece no histórico entre a base e HEAD (`git log --oneline 3860ed4..HEAD -- automation/src/adapters/plataforma.ts`), mas em um commit de terceiro (`6db51b8`, WR-14, fora deste plano) — confirmado que nenhum dos dois commits DESTE plano (`20ac4e2`, `5f9241b`) toca esse arquivo. Nenhum `payment-automation-service.ts` aparece em nenhum dos dois commits.
- **Nenhuma migração aplicada, nenhum deploy:** nenhum comando de banco ou deploy rodou nesta sessão.

## User Setup Required

Nenhum nesta sessão. Nota operacional herdada de 05-08/05-15: `automation/` com este código ainda não está deployado em produção (deploy é escopo de 05-05/05-23); nenhuma Automação real usa o canal WhatsApp ainda (decisão de produto, D5-11).

## Next Phase Readiness

- CR-02 (mapeamento de Campo) e WR-02 (gate de Empresa) do `05-REVIEW.md`, do lado `automation/`, estão corrigidos e testados.
- CR-03 (receipt sem retentativa honesta) e WR-03 (log com número) do `05-REVIEW.md`, do lado `automation/`, estão corrigidos e testados — a mesma correção que 05-15 aplicou a `webhooks-plataforma.ts` agora cobre as duas rotas plataforma → `automation/`.
- **O que continua faltando para AUTO-02 fechar ponta a ponta (Critério 4, `05-VERIFICATION.md`):** o lado do domínio (`destinoDeCanal`) já fala de Solicitação desde 05-13 (merge `6e0d6d5`, Onda 1 — nota do orquestrador: a versão original desta linha dizia o contrário porque o executor não via esse merge); CR-05 (o evento de Canal só nasce em 2 dos 4 caminhos que criam/movem uma Solicitação) e o teste de contrato ponta a ponta de 05-24 continuam pendentes. Este plano é declaradamente só a metade `automation/` de D5-21.
- Nenhum bloqueio para outros planos do fechamento de lacunas: os dois arquivos tocados (`notificar-canal-routes.ts`/`.test.ts`) não se sobrepõem aos que os demais planos de gap-closure tocam.

## Self-Check: PASSED

Arquivo criado encontrado em disco: `.planning/phases/05-contas-a-receber-e-os-outros-tenants/05-18-SUMMARY.md`. Ambos os commits do repositório irmão encontrados: `git -C ../financeiro-tria log --oneline --all | grep 20ac4e2` → FOUND; `grep 5f9241b` → FOUND. Arquivo `../financeiro-tria/automation/src/http/notificar-canal-routes.ts` lido e confirmado em disco com as duas mudanças. `npm test` re-executado nesta sessão: 220/221, único gap é o pré-existente documentado.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
