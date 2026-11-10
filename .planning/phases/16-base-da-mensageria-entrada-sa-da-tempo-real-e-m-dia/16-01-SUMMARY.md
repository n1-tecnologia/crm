---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 01
subsystem: api
tags: [postgres, fastify, mensageria, recebimento, vitest, tdd]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: tabelas do CRM novo (contatos, identificadores, conversas, mensagens, canais) e os repositórios `pg`
provides:
  - "`receberMensagem(workspaceId, canalId, evento)`: o recebimento completo (3.6.2) numa transação só, idempotente por (Canal, idExterno)"
  - "`@n1/dominio/crm/recebimento`: `RecebidaDoProvedor`, `destinoDaRecebida`, `contatoDaRecebida`, `JANELA_DE_REABERTURA_PADRAO_HORAS`"
  - "`registrarRecebida` fora de `ServicoDeMensagens`: a recebida tem uma porta só"
affects: [16-02, 16-03, 16-10, 16-11, 16-12]

actuals:
  tokens: 18500
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "retry de uma tentativa na transação inteira quando o 23505 é de um índice único nomeado (corrida do número novo)"
    - "corrida testada de forma determinística: uma transação rival segura o INSERT até o serviço bloquear, e só então confirma"

key-files:
  created:
    - packages/dominio/src/crm/recebimento.ts
    - packages/dominio/src/crm/recebimento.test.ts
    - apps/api/src/servicos/crm/recebimento.ts
    - apps/api/src/servicos/crm/recebimento.test.ts
  modified:
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.test.ts
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.test.ts
    - apps/api/src/e2e/canais-fluxo.test.ts
    - apps/api/src/repositorios/crm/conversas.ts
    - packages/dominio/src/crm/mensagens.ts

key-decisions:
  - "O tipo do evento (`RecebidaDoProvedor`) mora no domínio, não no módulo do provedor da api: 16-02 compõe `EventoDoProvedor` a partir dele."
  - "Pendente que volta a aberta NÃO usa `definirSituacao(..., 'aberta')`: o UPDATE próprio zera `adiada_ate` e não soma `reaberturas` (ver desvio 1)."
  - "A Conversa resolvida que está na lixeira não reabre; abre-se outra (a lixeira só guarda resolvidas)."
  - "`inbox.reopenWindowHours` lido de `plataforma.registros` (coleção `inbox`); ausente ou inválido, 72 h."
  - "Contato novo: nome = `nomeExibido` ou o próprio valor normalizado; `criado_por` = proprietário (Proprietário padrão do Canal, senão `configurado_por`)."
  - "Segunda falha da corrida (ou qualquer outro erro) sobe como exceção, não como recusa 409: quem chama (o processador, 16-03) decide a retentativa."

patterns-established:
  - "A recebida só entra por `receberMensagem`; nenhuma rota humana e nenhum teste grava recebida direto no repositório."
  - "Teste de corrida com `pg_stat_activity.wait_event_type = 'Lock'` como barreira, não com `sleep`."

requirements-completed: [MSG-01]

coverage:
  - id: D1
    description: "Número desconhecido que manda Mensagem vira Contato (automatico_mensagem, dono do Canal, Identificador normalizado), Conversa (Fila do Canal, sem atribuído) e Mensagem recebida, numa transação só"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#um número desconhecido vira Contato, Conversa e Mensagem recebida"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#o Contato novo nasce automatico_mensagem, dono do Canal, com o Identificador whatsapp normalizado"
        status: pass
    human_judgment: false
  - id: D2
    description: "O mesmo idExterno no mesmo Canal devolve repetida e não grava Contato, Conversa nem Mensagem, inclusive em corrida"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#a mesma Mensagem entregue de novo devolve repetida e não grava Contato, Conversa nem Mensagem"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#dois recebimentos simultâneos do mesmo id externo gravam uma Mensagem só e um deles volta repetida"
        status: pass
    human_judgment: false
  - id: D3
    description: "RN-CXE-09: aberta reaproveitada, pendente volta a aberta, resolvida dentro da janela reabre (reaberturas +1), fora da janela ou na lixeira abre outra; janela vinda de inbox"
    requirement: MSG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/recebimento.test.ts#destinoDaRecebida (RN-CXE-09)"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#a Conversa resolvida há 10 h (janela de 72 h) é reaberta"
        status: pass
    human_judgment: false
  - id: D4
    description: "RN-CON-13: Contato arquivado ou na lixeira volta a ativo ao receber; mesclado é recusado com 409"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#o Contato %s que recebe Mensagem volta a ativo na mesma transação (RN-CON-13)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pitfall 11: dois recebimentos simultâneos do mesmo número novo terminam com um Contato e uma Conversa; o 23505 de contato_identificadores_unico refaz a transação uma vez"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/recebimento.test.ts#perder a corrida do Identificador (23505 em contato_identificadores_unico) refaz a transação e cai no Contato que ganhou"
        status: pass
    human_judgment: false
  - id: D6
    description: "registrarRecebida sai de ServicoDeMensagens e a recebida tem uma porta só; webhook-meta.ts intocado"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts + src/rotas/crm/mensagens.test.ts + src/e2e/canais-fluxo.test.ts (70 passed com recebimento.test.ts)"
        status: pass
    human_judgment: false

plan_head_before: 596945fed644e9718465871d77d60d8c2d52219d
plan_head_after: 9228a4e59b17c4b586c4fc86b7e9cd0cf0141536

duration: 8min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 01: Recebimento completo de Mensagem (receberMensagem) Summary

**`receberMensagem` numa transação só: acha o Contato pelo Identificador normalizado exato ou o cria (`automatico_mensagem`), reaproveita, reabre ou abre a Conversa por `destinoDaRecebida` (RN-CXE-09), reativa o Contato arquivado (RN-CON-13), grava a Mensagem de forma idempotente e refaz uma vez a corrida do número novo.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-09T17:06:57Z
- **Completed:** 2026-11-09T17:14:05Z
- **Tasks:** 3
- **Files modified:** 11 (4 criados, 7 alterados)

## Accomplishments

- Domínio: `crm/recebimento.ts` com o tipo do evento (`RecebidaDoProvedor`) e as duas decisões puras, 14 testes (a janela nos dois lados do limite, Conversa na lixeira, mesclado).
- Api: `servicos/crm/recebimento.ts` e 27 testes contra o Postgres 16 local (Docker, porta 55716), nenhum pulado: número novo, repetida, Canal de outro Espaço (404), arquivado (409), tipo de remetente que o Canal não resolve, anexo, reabertura, janela do `inbox`, lixeira, RN-CON-13, mesclado e três corridas.
- `registrarRecebida` saiu da interface de Mensagens; os testes de serviço, rota e e2e que semeavam recebida passam por `receberMensagem` (70 testes verdes nos quatro arquivos). `MensagemRecebidaDoProvedor` (sem importador) saiu do domínio.
- O recebimento não sobe a revisão do Espaço e o módulo não tem `log`/`console`.

## Task Commits

1. **Task 1 (traçador), RED** - `fb6cb94` (test): testes de domínio e de serviço contra esqueletos que devolvem `abrir`/`manter`/409; 8 e 12 falhas por asserção.
2. **Task 1, GREEN** - `68a6255` (feat): domínio e serviço completos; 14 e 12 testes passando.
3. **Task 2** - `46a6602` (test): reabertura, janela, lixeira, RN-CON-13, mesclado e corridas (a lógica já tinha entrado no GREEN da Task 1; ver "TDD Gate Compliance").
4. **Task 3** - `2bf122f` (refactor): `registrarRecebida` fora da interface, testes migrados.
5. **Ajuste de comentário** - `9228a4e` (docs).

**Plan metadata:** commit `docs(16-01)` seguinte (SUMMARY, STATE, ROADMAP).

## Files Created/Modified

- `packages/dominio/src/crm/recebimento.ts` - `RecebidaDoProvedor`, `destinoDaRecebida`, `contatoDaRecebida`, `JANELA_DE_REABERTURA_PADRAO_HORAS`
- `packages/dominio/src/crm/recebimento.test.ts` - 14 testes
- `apps/api/src/servicos/crm/recebimento.ts` - `criarServicoDeRecebimento`, `receberMensagem`, `ResultadoDoRecebimento`
- `apps/api/src/servicos/crm/recebimento.test.ts` - 27 testes de banco
- `apps/api/src/servicos/crm/mensagens.ts` (+ `.test.ts`), `rotas/crm/mensagens.ts` (+ `.test.ts`), `e2e/canais-fluxo.test.ts` - `registrarRecebida` removido
- `apps/api/src/repositorios/crm/conversas.ts` - `LinhaNovaDeConversa` aceita `atribuido: null` e `criadoPor.tipo: "integration"`
- `packages/dominio/src/crm/mensagens.ts` - `MensagemRecebidaDoProvedor` removido

## Decisions Made

Ver `key-decisions`. Em resumo: o tipo do evento é do domínio; a corrida sobe como exceção na segunda falha; pendente→aberta tem UPDATE próprio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pendente que volta a aberta não pode usar `definirSituacao(..., "aberta")`**
- **Found during:** Task 2
- **Issue:** o plano manda `definirSituacao(ws, id, "aberta")` para a pendente. Esse método não zera `adiada_ate`, e a Conversa pendente com Adiamento violaria `conversas_adiamento_ck` (23514); além disso soma `reaberturas`, que é da resolvida reaberta, não da pendente.
- **Fix:** `UPDATE ... set situacao = 'aberta', adiada_ate = null, adiamento_motivo = null` dentro do serviço; a resolvida reaberta continua por `definirSituacao`.
- **Files modified:** `apps/api/src/servicos/crm/recebimento.ts`
- **Verification:** `recebimento.test.ts#a Conversa pendente com Adiamento volta a aberta...` (falha sem o UPDATE, por mutação).
- **Committed in:** `68a6255`

**2. [Rule 3 - Blocking] `LinhaNovaDeConversa` não aceitava Conversa sem atribuído nem criador `integration`**
- **Found during:** Task 1
- **Issue:** o plano pede `atribuido: null` e `criadoPor: { tipo: "integration", id: canal.id }`, mas o repositório tipava `atribuido` como Membro obrigatório e lia `linha.atribuido.tipo` (TypeError com `null`). `repositorios/crm/conversas.ts` não está em `files_modified`.
- **Fix:** alargamento mínimo do tipo e do `INSERT` (`atribuido?.tipo ?? null`); `criado_por_tipo` não tem CHECK na 008.
- **Files modified:** `apps/api/src/repositorios/crm/conversas.ts`
- **Verification:** `tsc` da api, e `conversas.test.ts`, `tarefas-conversacionais.test.ts`, `mesclagem.test.ts`, `repositorios/crm/mensagens.test.ts` (119 passando).
- **Committed in:** `68a6255`

**3. [Rule 1 - Bug] Teste de "23505 em `conversas_nao_resolvida_uq`" não é alcançável**
- **Found during:** Task 2
- **Issue:** a FK da Conversa nova pega `for key share` no Contato e o `for update` do recebimento espera por ela, então a corrida da Conversa se resolve no lock do Contato e nunca chega ao 23505. O índice continua de rede.
- **Fix:** o teste prova o resultado (a Conversa aberta pela outra transação é usada, não duplicada) e o comentário explica o mecanismo; `conversas_nao_resolvida_uq` segue no conjunto de constraints que disparam o retry.
- **Files modified:** `apps/api/src/servicos/crm/recebimento.test.ts`
- **Committed in:** `46a6602`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>`; todas protegem a correção (a 1 e a 3) ou destravam o tipo (a 2). Sem scope creep.

## TDD Gate Compliance

- **RED (Task 1):** `fb6cb94`. Domínio: 8 falhas e 6 passes em 14 testes, todas por asserção sobre o esqueleto (`abrir`/`manter`). Api: 12 de 12 falhando contra o esqueleto 409 "não implementado" (a falha é a asserção do comportamento, não import nem fixture; o Postgres rodou e a migração foi aplicada). Avaliação semântica: o teste-alvo executou e falhou na asserção planejada. O `gsd_run check tdd-red-evidence` não foi usado: o plano é `type: execute` e `workflow.tdd_mode` é `false`.
- **GREEN (Task 1):** `68a6255`, 14 e 12 testes passando.
- **Task 2:** a lógica de reabertura, reativação e retry foi escrita junto do GREEN da Task 1 (é a mesma função de serviço), então os testes da Task 2 passaram de primeira ("unexpected green" por construção, não por teste errado). Para provar que os testes enxergam as regras, cinco mutações temporárias foram aplicadas e revertidas: sem `reativar` (2 testes falham), `TENTATIVAS = 1` (2 falham, incluindo a corrida determinística do Identificador), pendente sem UPDATE (1), janela do `inbox` ignorada (1), `naLixeira` sempre falso (1). O RED separado da Task 2 não existe.
- **REFACTOR:** `9228a4e` só ajusta comentário.

## Issues Encountered

- Um `npx eslint` rodado da raiz tentou baixar o `eslint` do registro (o ESLint do repositório só existe em `apps/web`; `apps/api` não tem lint). Nada foi instalado no projeto (`package-lock.json` sem diff); o gate de tipos (`tsc`) cobre `apps/api`. Registrado por transparência.
- A corrida do número novo não aparece de forma confiável com `Promise.all` simples (o resultado depende de quem chega ao INSERT primeiro); por isso o retry é provado pela transação rival que segura o Identificador até o serviço bloquear.

## Verification Run

- `packages/dominio`: `vitest run src/crm/recebimento.test.ts` 14 passando; `vitest run src/crm` 838 passando; `tsc --noEmit` ok.
- `apps/api` (Postgres 16 em Docker, 55716, `npm run migrar` antes, contêiner removido no fim): `recebimento.test.ts` 27; com `mensagens.test.ts`, `rotas/crm/mensagens.test.ts` e `e2e/canais-fluxo.test.ts` 70 passando em 4 arquivos, nenhum pulado; mais `conversas.test.ts`, `tarefas-conversacionais.test.ts`, `repositorios/crm/mensagens.test.ts`, `mesclagem.test.ts` 119 passando; `tsc --noEmit` ok.
- `apps/web`: `tsc --noEmit` ok.
- Critérios de aceite: `destinoDaRecebida`/`contatoDaRecebida` 1 cada; `automatico_mensagem` 2; `avancarRevisaoDoEspaco` 0; `log.`/`console.` 0; importações proibidas no domínio 0; `conversas_nao_resolvida_uq` 2, `contato_identificadores_unico` 2; `registrarRecebida` fora do `webhook-meta.ts` 0; diff de `webhook-meta.ts` vazio; `package-lock.json` sem diff.
- Não rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. A superfície nova (`receberMensagem`) está coberta pelos T-16-01 (Espaço do Canal, teste de outro Espaço dá 404), T-16-02 (sem log) e T-16-03 (só o Identificador normalizado exato).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-02 compõe `EventoDoProvedor` a partir de `RecebidaDoProvedor` (`@n1/dominio/crm/recebimento`); 16-03 chama `receberMensagem` dentro do processador de entrada.
- `receberMensagem` lança na segunda falha da corrida e em qualquer erro de banco; o processador (16-03) deve tratar exceção como "tentar de novo" e recusa 4xx como permanente. A recusa `409 CONTATO_MESCLADO` não deveria ocorrer (o Identificador do mesclado vive no sobrevivente); se ocorrer, é dado inconsistente, não retentativa.
- O `emRespostaAIdExterno` do evento ainda não é gravado: `LinhaDeMensagemRecebida` não tem esse campo e o plano não o pedia.
- O anexo entra com `referenciaExterna = referenciaNoProvedor`; o 16-09 troca pelo anexo baixado.

## Self-Check: PASSED

- Arquivos criados existem: `packages/dominio/src/crm/recebimento.ts`, `packages/dominio/src/crm/recebimento.test.ts`, `apps/api/src/servicos/crm/recebimento.ts`, `apps/api/src/servicos/crm/recebimento.test.ts`.
- Commits na branch: `fb6cb94`, `68a6255`, `46a6602`, `2bf122f`, `9228a4e`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
