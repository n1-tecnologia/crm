---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 12
subsystem: inbox-channels
tags: [fastify, postgres, zod, vitest, mensagens, idempotencia, carga-bruta, omnichannel]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "validarEnvio, statusInicialDeEnvio, DIRECOES_DE_ENVIO, MensagemRecebidaDoProvedor (08-05); RepositorioDeMensagens.inserir, COLUNAS_DE_MENSAGEM sem carga_bruta, rotasDeConversas em rotasDeCrm (08-06); capacidadesDoCanal (08-02); mensagens_id_externo_uq (08-04)"
provides:
  - "repositorios/crm/mensagens.ts: listar, ultimaRecebidaEm, inserirRecebida (on conflict do nothing), obterPorIdExterno, cargaBruta, LinhaDeMensagemRecebida"
  - "servicos/crm/mensagens.ts: ServicoDeMensagens (listar, enviar, registrarRecebida) e criarServicoDeMensagens"
  - "GET /mensagens?conversaId= e POST /mensagens (201); OpcoesDeCrm.mensagens"
  - "Codigos: JANELA_EXPIRADA, RESPOSTA_DE_OUTRA_CONVERSA, CONVERSA_NA_LIXEIRA, CANAL_ARQUIVADO, CONVERSA_NAO_ENCONTRADA"
affects: [08-13, 08-14, 08-15]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: 5b0ce13b044aa8605becc1b8584192e086c18792
plan_head_after: 7c8350fb408bc53aadeebfafc447f48a0d92377e

tech-stack:
  added: []
  patterns:
    - "Porta interna sem rota: registrarRecebida(workspaceId, entrada) para a integracao futura, testada so por chamada direta"
    - "Idempotencia por indice parcial: insert on conflict do nothing devolve undefined e o servico le a existente"
    - "Janela de resposta no servidor: validarEnvio com capacidadesDoCanal por (tipo, provedor), independente da tela"

key-files:
  created:
    - apps/api/src/repositorios/crm/mensagens.test.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.test.ts
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/rotas/crm/mensagens.test.ts
  modified:
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "O Canal gravado na recebida e sempre o da Conversa; a entrada nao tem como escolher outro (provado passando um canalId extra)."
  - "criado_em da recebida e o instante do provedor e registrado_em o default now() da plataforma; a lista ordena por (criado_em, seq)."
  - "A FK de em_resposta_a_id tambem dispara para id inexistente; ambos viram a frase RESPOSTA_DE_OUTRA_CONVERSA do plano (sem pre-checagem extra)."
  - "Canal arquivado recusa tambem a nota interna (CANAL_ARQUIVADO), como o plano descreve a ordem das checagens."

patterns-established:
  - "Rota de escrita humana com corpo .strict() cuja direcao vem do z.enum do dominio: o que o dominio nao oferece a rota nao aceita"

requirements-completed: [CXE-A3, CXE-A2]

coverage:
  - id: D1
    description: "registrarRecebida grava a recebida com criado_em do provedor e carga bruta, idempotente por (Canal, id externo): a repeticao devolve a mesma Mensagem com repetida true; o mesmo id externo noutro Canal grava"
    requirement: CXE-A3
    verification:
      - kind: integration
        ref: "apps/api/src/repositorios/crm/mensagens.test.ts#grava a recebida uma vez por (Canal, id externo); apps/api/src/servicos/crm/mensagens.test.ts#registrarRecebida grava uma vez e a 2a igual devolve a mesma Mensagem"
        status: pass
    human_judgment: false
  - id: D2
    description: "Envio no servidor por (tipo, provedor): WhatsApp oficial com ultima recebida de 30 h recebe 409 JANELA_EXPIRADA (campo modelo), o nao oficial envia; status pendente/enviada pela conexao; interna sem status e sem janela"
    requirement: CXE-A3
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts (janela, nao oficial, dentro da janela); apps/api/src/rotas/crm/mensagens.test.ts#POST /mensagens enviada no oficial com recebida de 30 h"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nenhuma resposta HTTP traz carga_bruta/cargaBruta; nao ha rota humana de recebida e o corpo estrito recusa direcao recebida, idExterno, cargaBruta, statusEntrega, ator, canalId, modeloId"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#(b), (c), (f) e nao existe rota de recebida"
        status: pass
    human_judgment: false
  - id: D4
    description: "em_resposta_a de outra Conversa (INV-CXE-10), Conversa na lixeira, Canal arquivado, 404 entre Espacos e Papel (Convidado le, nao envia) aplicados no servico"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts#emRespostaAId de outra Conversa; #Conversa na lixeira, Canal arquivado; #Convidado nao envia"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 12: API de Mensagens Summary

**Mensagem relacional por HTTP: o fio da Conversa em `GET /mensagens`, o envio humano em `POST /mensagens` com a janela de 24 h aplicada no servidor so ao WhatsApp oficial e o status pelo estado da conexao, e a `recebida` entrando apenas pelo `registrarRecebida` interno, idempotente por (Canal, id externo) e com a carga bruta do provedor guardada e nunca devolvida.**

## Performance

- **Duration:** ~11 min
- **Completed:** 2026-10-12T18:40Z
- **Tasks:** 3 (2 TDD, 1 auto)
- **Files modified:** 7 (5 criados, 2 alterados)

## Accomplishments

- Repositorio: `inserirRecebida` com `on conflict (workspace_id, canal_id, id_externo) where id_externo is not null do nothing`, `criado_em` do provedor, Ator = Canal como Integracao, `carga_bruta` em jsonb; `listar` por `(criado_em, seq)`; `ultimaRecebidaEm`; `obterPorIdExterno`; `cargaBruta()` so para ingestao e teste.
- Servico: `enviar` confere Papel, forma, Conversa (404/lixeira), Canal (arquivado) e, para `enviada`, `validarEnvio` com `capacidadesDoCanal({ channelType, provider })`; `registrarRecebida` usa o Canal da Conversa e devolve `repetida: true` na segunda entrega.
- Rotas: `GET /mensagens` (conversaId obrigatorio) e `POST /mensagens` (201), `.strict()`, `direcao` do `z.enum(DIRECOES_DE_ENVIO)`; registradas em `rotasDeCrm` com `OpcoesDeCrm.mensagens`.
- Provas contra Postgres 16 local: 6 casos de repositorio, 12 de servico e 9 + 4 de rota com banco (186 testes verdes nos arquivos tocados e vizinhos de `rotas/crm`, `servicos/crm/conversas`).

## Task Commits

1. **Task 1 RED: teste do repositorio** - `a3cb2f0` (test)
2. **Task 1 GREEN: repositorio de Mensagens** - `74a1327` (feat)
3. **Task 2 RED: teste do servico + esqueleto** - `1419d57` (test)
4. **Task 2 GREEN: servico de Mensagens** - `079d07b` (feat)
5. **Task 3: rotas /mensagens** - `7c8350f` (feat)

**Plan metadata:** commit `docs(08-12): complete ...` (SUMMARY + STATE + ROADMAP)

## Files Created/Modified

- `apps/api/src/repositorios/crm/mensagens.ts` - listar, ultimaRecebidaEm, inserirRecebida, obterPorIdExterno, cargaBruta
- `apps/api/src/servicos/crm/mensagens.ts` - ServicoDeMensagens
- `apps/api/src/rotas/crm/mensagens.ts` - rotasDeMensagens, QUERY_LISTA_DE_MENSAGENS, NOVA_MENSAGEM
- `apps/api/src/rotas/crm/index.ts` - OpcoesDeCrm.mensagens e registro
- `apps/api/src/{repositorios,servicos,rotas}/crm/mensagens.test.ts` - testes

## Decisions Made

Ver `key-decisions`. O nome da FK de "em resposta a" foi conferido no Postgres 16 antes de cadastrar a frase: `mensagens_workspace_id_conversa_id_em_resposta_a_id_fkey`, como o plano previa.

## TDD Gate Compliance

- **Task 1:** RED `a3cb2f0` (`test(08-12)`), GREEN `74a1327` (`feat(08-12)`). Evidencia de RED em TAP (`vitest --reporter=tap`), `gsd_run check tdd-red-evidence` devolveu `RED_EVIDENCE_OK` (`target_test_failed`). Avaliacao semantica: os 6 testes alcancaram a chamada alvo (setup, Canais, Contato e Conversas funcionaram) e falharam com `TypeError: mensagens.inserirRecebida is not a function` / `ultimaRecebidaEm is not a function`, ou seja, falta exatamente a API planejada. Nao houve falha de carga, fixture ou sintaxe.
- **Task 2:** RED `1419d57` com um esqueleto de `ServicoDeMensagens` cujos metodos lancam `nao implementado` (o modulo precisa existir para o teste carregar; sem ele a falha seria de importacao, INVALID_RED). `RED_EVIDENCE_OK`; 11/11 falharam em `Error: nao implementado` depois do setup do cenario. GREEN `079d07b`.
- REFACTOR: nenhum. Task 3 nao era TDD.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Guarda de dados na porta interna `registrarRecebida`**
- **Found during:** Task 2
- **Issue:** a entrada do provedor com `idExterno` vazio, `criadoEm` nao parseavel ou sem conteudo e sem anexo seria recusada pelo banco (`mensagens_conteudo_ck`, erro de data) e viraria um 500 na futura integracao.
- **Fix:** `validarRecebida` no servico devolve 400 `VALOR_INVALIDO` com o campo; um teste novo cobre os tres casos. O teste foi adicionado no commit GREEN (nao existia no RED).
- **Files modified:** `apps/api/src/servicos/crm/mensagens.ts`, `apps/api/src/servicos/crm/mensagens.test.ts`
- **Committed in:** `079d07b`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** so endurece a porta interna; nada muda para as rotas nem para o contrato do plano.

## Issues Encountered

None. O repositorio `api` nao tem script de lint (so `tsc --noEmit`); o typecheck do workspace ficou verde.

## Authentication Gates

None.

## Threat Flags

None. A superficie nova esta toda coberta pelo `threat_model` (T-08-44 a T-08-48); `bodyLimit` e teto de JSONB seguem como `accept` ate existir a rota publica de ingestao. Nem `conteudo` nem `cargaBruta` aparecem em log (nenhum `log`/`console` nos arquivos novos).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-13 (e2e "dois WhatsApps") ja tem como provar por HTTP que o nao oficial envia fora da janela e o oficial recebe 409 `JANELA_EXPIRADA`; a `recebida` de 30 h entra por `registrarRecebida` do servico.
- Pendente por desenho (Deferred): reabertura automatica da Conversa resolvida por Mensagem recebida, Mensagens de modelo e a rota/webhook de ingestao.

## Self-Check: PASSED
