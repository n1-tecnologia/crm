---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 05
subsystem: api
tags: [crm, conversas, mover, atribuir, caixa-de-entrada, vitest, postgres]
status: complete

requires:
  - phase: 14-01
    provides: estado `mesclado` do Contato e `conversas.na_lixeira_em` (011)
  - phase: 14-04
    provides: Contato mesclado somente leitura (usado para recusar destino mesclado)
provides:
  - "validarMover, participantesComContato, Atribuicao e validarAtribuicao em `@n1/dominio/crm/conversas`"
  - "RepositorioDeConversas.trocarContato e definirAtribuicao; agenteAtivo em referencias.ts"
  - "ServicoDeConversas.mover e atribuir"
  - "POST /conversas/:id/mover e POST /conversas/:id/atribuir"
affects: [14-06, 14-14, 15]

actuals:
  tokens: 30000
  tasks: 2
  commits: 4
plan_head_before: b03a3cdb234a44683918ceddb130e25e5976ce17
plan_head_after: b05c39940dab7d38205db7ebc934ad3fd43b07d2
commits: 4

tech-stack:
  added: []
  patterns:
    - "travas em ordem fixa no gesto que cruza Contato e Conversa: lê a Conversa sem trava para saber a origem, trava os dois Contatos em ordem de id, depois a Conversa, e reconfere a origem"
    - "quem recebe uma atribuição é conferido por leitura de `plataforma.registros` no Espaço da sessão (`membroAtivo`, `agenteAtivo`), nunca pelo id do corpo"

key-files:
  created: []
  modified:
    - packages/dominio/src/crm/conversas.ts
    - packages/dominio/src/crm/conversas.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/api/src/repositorios/crm/referencias.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/rotas/crm/conversas.ts
    - apps/api/src/rotas/crm/conversas.test.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "Recusas de `mover` por regra do domínio (destino não ativo, mesmo Contato, Conversa na lixeira) saem como 409 `MOVER_INVALIDO` com o `campo` que o domínio deu; a recusa de atribuir na lixeira usa `TRANSICAO_INVALIDA`."
  - "A colisão só é conferida quando a Conversa movida está aberta ou pendente; a resolvida nunca colide (decisão do planejador, mantida)."
  - "`atribuir` usa `membroAtivo` (já existente em `membros.ts`) em vez de reler `papelDoMembro`: a mesma conferência de estado `ativo` neste Espaço, numa consulta só."
  - "`Conversa.atribuido` passou a usar o tipo `Atribuicao` (mesma forma de antes, só nomeada)."

patterns-established:
  - "Ordem de trava Contatos → Conversa nos gestos de Conversa, para não haver deadlock com a mesclagem (14-09), que trava Contatos e depois move Conversas."

requirements-completed: [UNI-08, UNI-09]

coverage:
  - id: D1
    description: "Mover a Conversa de A para B sem colisão troca o Contato e reescreve o Participante principal do tipo contato; Canal e Mensagens ficam (INV-CXE-04)"
    requirement: UNI-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#mover (3.2.5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Destino com Conversa aberta no mesmo Canal: 409 CONVERSA_JA_ABERTA com a ocupante em bloqueios; com resolverExistente a ocupante fica resolvida sem adiamento e a movida vai; resolvida nunca colide"
    requirement: UNI-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#mover (3.2.5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Destino arquivado/mesclado/mesmo Contato e Conversa na lixeira recusam 409; Convidado 403; Conversa ou Contato de outro Espaço 404"
    requirement: UNI-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#mover (3.2.5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Atribuir grava membro, agente ou null; Membro de outro Espaço, suspenso ou removido e Agente inexistente, de outro Espaço ou pausado recusam 409 ATRIBUIDO_INVALIDO com campo atribuido; lixeira 409; Convidado 403"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#atribuir (3.2.6, parte 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Os dois corpos são .strict(): workspaceId, estado, situacao e campo a mais dão 400 sem chamar o serviço; resolverExistente ausente vira false"
    requirement: UNI-09
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/conversas.test.ts"
        status: pass
    human_judgment: false
---

# Phase 14 Plan 05: Mover e atribuir a Conversa nova Summary

**`POST /conversas/:id/mover` e `/atribuir` no modelo novo: a regra no domínio, uma transação no serviço com travas em ordem fixa, e rotas casca com corpo estrito.**

## Performance

- **Duration:** cerca de 6 min de relógio (14:52 a 14:58 UTC-3 nas marcas dos testes)
- **Tasks:** 2 (cada uma com commit RED e commit GREEN)
- **Files modified:** 10

## Accomplishments

- **Mover (3.2.5).** `validarMover` e `participantesComContato` no domínio; `trocarContato` no repositório; `mover` no serviço. O serviço lê a Conversa sem trava para saber a origem, trava origem e destino em ordem de id, trava a Conversa e reconfere que a origem não mudou. Com Conversa aberta ou pendente, olha o ocupante do par no destino: sem `resolverExistente`, 409 `CONVERSA_JA_ABERTA` com a ocupante em `bloqueios`; com ele, a ocupante é travada e resolvida (zerando o adiamento) no mesmo ato.
- **Atribuir (3.2.6, parte 1).** `Atribuicao` e `validarAtribuicao` no domínio; `definirAtribuicao` (as duas colunas juntas) e `agenteAtivo` na api; `atribuir` no serviço confere Membro ativo ou Agente ativo NESTE Espaço e recusa 409 `ATRIBUIDO_INVALIDO` com campo `atribuido`.
- **Rotas.** Corpos `.strict()` (T-14-11); Papel exigido antes de ler (`mover` e `editar` em `conversa`, sem ação nova em `AcaoCrm`). `rotas/CONTEXT.md` e `packages/dominio/CONTEXT.md` descrevem os gestos e os códigos novos.

## Task Commits

1. **Task 1 RED** — `40247c8` `test(14-05): mover a Conversa para outro Contato, com falha esperada`
2. **Task 1 GREEN** — `303c642` `feat(14-05): mover a Conversa para outro Contato pelo modelo novo`
3. **Task 2 RED** — `9045759` `test(14-05): atribuir a Conversa a Membro ativo ou Agente do Espaço, com falha esperada`
4. **Task 2 GREEN** — `b05c399` `feat(14-05): atribuir a Conversa a Membro ativo ou Agente do Espaço`

## Verification

- `packages/dominio`: `vitest run src/crm/conversas.test.ts src/quem-pode.test.ts src/sem-listas-espelho.test.ts` 36 passam; `tsc --noEmit` limpo.
- `apps/api` contra Postgres 16 de Docker (porta 55605, removido ao fim): `servicos/crm/conversas.test.ts`, `rotas/crm/conversas.test.ts` e `servicos/crm/mensagens.test.ts`, 66 passam, nenhum pulado; `tsc --noEmit` limpo.
- `apps/api` inteiro sem banco (`DATABASE_URL=` vazio, como manda a `<verification>`): 127 arquivos passam, 39 pulados (precisam de banco), 1255 testes passam, 0 falhas. Guarda D-06 de `apps/api` e do domínio passam.
- Os testes de rota da Caixa antiga e o `GET /estado` não foram tocados; não rodei a suíte inteira com banco (13 a 17 min, fora do que o plano pede).

## Deviations from Plan

None - plan executed exactly as written, com duas escolhas de implementação dentro do que o plano deixa aberto:

- `atribuir` usa `membroAtivo` (que já existia em `membros.ts`) em vez de `papelDoMembro(...).estado === "ativo"`; mesma conferência, uma consulta.
- A ordem de trava "em ordem de id" foi aplicada aos dois Contatos (origem e destino) e a Conversa vem depois deles, porque Conversa e Contato são tabelas diferentes e o par que pode dar deadlock com a mesclagem é Contatos → Conversas.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. A superfície nova é a das duas rotas já cobertas por T-14-10, T-14-11 e T-14-12 (todo `where` com `workspace_id`, corpos estritos, travas em ordem).

## Notas para os próximos planos

- `ServicoDeConversas` ganhou `mover` e `atribuir`: qualquer serviço falso de Conversas em teste de outro plano precisa implementar os dois (os testes de rota já foram ajustados).
- `conversas.trocarContato` não confere estado nem colisão: quem chamar fora do serviço (a mesclagem, 14-09) trava e confere por conta própria. A ordem Contatos → Conversa é a que `mover` já assume.
- Mover e atribuir não gravam Registro de Atividade (OQ5 adotada) nem avançam a revisão do Espaço; a Caixa antiga segue no modelo antigo até a Fase 15 (3.4.1).
- A segunda metade da 3.2.6 (Fila e demais campos da atribuição) não está aqui.

## Self-Check: PASSED

- Arquivos de `key-files.modified` existem e estão no histórico dos 4 commits do plano.
- Commits `40247c8`, `303c642`, `9045759`, `b05c399` presentes (`git rev-list --count` desde `plan_head_before` = 4).
- Critérios de aceite: `validarMover`/`participantesComContato` (2), `/conversas/:id/mover` na rota (2), `"mover"` no serviço (1), `validarAtribuicao` (1), `agenteAtivo` (1), `/conversas/:id/atribuir` na rota (2) e no CONTEXT (1).
