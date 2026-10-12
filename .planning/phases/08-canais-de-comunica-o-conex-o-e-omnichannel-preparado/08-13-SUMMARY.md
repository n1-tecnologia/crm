---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 13
subsystem: testing
tags: [e2e, fastify, postgres, vitest, canais, whatsapp, caixa-de-entrada]

requires:
  - phase: 08-04
    provides: invariantes da 008 (conta unica entre provedores, conversa nao resolvida unica)
  - phase: 08-07
    provides: executar() e GET /estado com Canais relacionais (relational true)
  - phase: 08-12
    provides: Mensagem REST (janela por provedor, status por conexao, registrarRecebida)
provides:
  - cenario e2e "dois WhatsApps lado a lado" por HTTP sobre buildApp() real contra Postgres local
  - CONTEXT.md de rotas/, repositorios/ e e2e/ descrevendo a Caixa de Entrada da Fase 8
affects: [08-14, verificacao da fase 08]

tech-stack:
  added: []
  patterns:
    - "e2e sequencial por letras (a)-(i), tokens por SESSOES, um buildApp() por Espaco"
    - "registrarRecebida chamado direto pelo servico real (nao ha rota humana de recebida)"

key-files:
  created:
    - apps/api/src/e2e/canais-fluxo.test.ts
  modified:
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/repositorios/CONTEXT.md
    - apps/api/src/e2e/CONTEXT.md

key-decisions:
  - "O teste e escrito sobre as rotas ja entregues; nenhum codigo de producao mudou (nenhum bug encontrado nos planos anteriores)"
  - "Nao-vacuidade provada por mutacao temporaria de producao, restaurada do HEAD antes de commitar, em vez de um RED fabricado"

patterns-established:
  - "Cenario de fase: um arquivo e2e por fase, rodando so contra Postgres local (describeComBanco), com container crm-n1-pg-08NN na porta 55580+NN"

requirements-completed: [CXE-V1, CXE-A2, CXE-A3, CXE-A4]

actuals:
  tokens: 16000
  tasks: 2
  commits: 2
plan_head_before: d3af7c0f4a7e43ad97c0d1d4059967d67ff63ed1
plan_head_after: f698ead6e9f407e8e36547a9e98af629a70849d2

coverage:
  - id: D1
    description: "Cenario e2e (a)-(i): dois WhatsApps (oficial e nao oficial) com numeros distintos, INV-CXE-01, B35, D-08, D-11/D-12, D-02, A9, B69 e isolamento entre Espacos, por HTTP"
    requirement: "CXE-V1"
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/canais-fluxo.test.ts (9 testes, Postgres 16 local em 55593)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CONTEXT.md de rotas/, repositorios/ e e2e/ atualizados com a Caixa de Entrada, a carga bruta fora das leituras (A9) e o cenario novo"
    verification: []
    human_judgment: true
    rationale: "Documentacao prosa: so um leitor julga se descreve bem o que passou a existir"

duration: 15min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 13: Cenario e2e "dois WhatsApps lado a lado" Summary

**Cenario e2e por HTTP sobre buildApp() real contra Postgres 16 local provando a fase 8 no servidor (conta unica entre provedores, janela de 24 h por provedor, B69, A9, isolamento de Espaco), mais os tres CONTEXT.md da api atualizados.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-10-12T18:55Z
- **Tasks:** 2
- **Files modified:** 4 (1 criado, 3 editados)

## Accomplishments

- `canais-fluxo.test.ts`: nove `it` sequenciais (a)-(i), todos passando contra `crm-n1-pg-0813` (porta 55593); so o JWT e a resolucao do Membro sao injetados.
- Provado por HTTP: "Comercial" (oficial) e "Suporte" (nao oficial) nascem `desconectada`; o mesmo numero no outro provedor da 409 `CANAL_CONTA_EM_USO`; Membro recebe 403 ao conectar e simular; "Simular conexao" marca `conexaoSimulada`; `GET /estado` traz os dois com `relational: true` e a contagem de `channels` em `plataforma.registros` nao muda; mesmo Contato com uma Conversa em cada Canal e 409 `CONVERSA_JA_ABERTA` na repeticao; fora das 24 h o oficial da 409 `JANELA_EXPIRADA` e o nao oficial envia; a resposta do fio nao contem `carga_bruta`/`cargaBruta`; depois de "Desconectar" a Mensagem nasce `pendente`; Membro de outro Espaco recebe 404 no Canal, na Conversa e na Mensagem e lista vazia.
- Documentos vivos: secao "Rotas REST da Caixa de Entrada (Fase 8)" em `rotas/CONTEXT.md` (tabela de rotas, sem rota humana de recebida, codigos 404/409, a ponte do `/estado`); os quatro repositorios novos e a regra de `carga_bruta` (A9) em `repositorios/CONTEXT.md`; o cenario e o comando em `e2e/CONTEXT.md`.

## Task Commits

1. **Task 1: cenario "dois WhatsApps lado a lado"** - `b64b2c4` (test)
2. **Task 2: documentos vivos da api** - `f698ead` (docs)

**Plan metadata:** commit docs(08-13) a seguir (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

Task 1 e `tdd="true"`, mas testa comportamento ja entregue em 08-01..08-12. O teste passou na primeira execucao: **nao ha RED fabricado**.

- **Classificacao:** teste de caracterizacao/integracao de comportamento existente (passa de primeira por construcao); o gate RED vale como "RED nao aplicavel".
- **Evidencia de nao-vacuidade:** mutacao temporaria de producao — `statusInicialDeEnvio` em `packages/dominio/src/crm/mensagens.ts` devolvendo sempre `"enviada"` e `if (false && !envio.ok)` em `apps/api/src/servicos/crm/mensagens.ts`. Resultado: 2 de 9 falharam, (g) `expected 201 to be 409` (janela) e (h) `expected 'enviada' to be 'pendente'` (B69). Os dois arquivos foram restaurados com `git checkout --` e a suite voltou a 9/9 verdes.
- **Commits:** `test(08-13)` presente (`b64b2c4`); nenhum `feat(08-13)` porque nenhuma mudanca de producao foi necessaria.

## Files Created/Modified

- `apps/api/src/e2e/canais-fluxo.test.ts` - o cenario (a)-(i)
- `apps/api/src/rotas/CONTEXT.md` - secao das rotas REST da Caixa de Entrada
- `apps/api/src/repositorios/CONTEXT.md` - repositorios de Canal, Conversa, Mensagem e referencias; A9
- `apps/api/src/e2e/CONTEXT.md` - o cenario `canais-fluxo` e o comando

## Decisions Made

- Nenhuma mudanca de producao: o cenario nao expos bug nos planos anteriores.
- A nao-vacuidade foi provada por mutacao restaurada (ver TDD Gate Compliance), conforme instrucao do orquestrador.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Nenhum de produto. Dois tropecos de ambiente, sem efeito no resultado: `timeout` nao existe no macOS (comando refeito sem ele) e o primeiro `git checkout` da mutacao rodou no diretorio errado (refeito da raiz; confirmado por `git status` limpo antes do commit).

## Verification

- `npx vitest run src/e2e/canais-fluxo.test.ts src/e2e/crm-fluxo.test.ts src/persistencia/migrar-seco.test.ts` (Postgres local 55593, `TZ=America/Sao_Paulo`): 3 arquivos, 20 testes, 0 pulados.
- `npx tsc --noEmit -p apps/api`: limpo.
- `grep -c` dos criterios da Task 2: secao das rotas 1, `COLUNAS_DE_MENSAGEM` 1, `canais-fluxo` 2, `simular-conexao` 2, `registrarRecebida` 1; `grep -c "96666-0001|96666-0002"` no teste >= 2.
- A suite completa de `apps/api` nao foi rodada (40-50 min), conforme orientacao.
- Container `crm-n1-pg-0813` removido ao final.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superficie nova: o plano so acrescenta teste e documentacao. T-08-50 (IDOR entre Espacos) e T-08-51 (teste so em banco local) mitigados como planejado.

## Next Phase Readiness

Pronto para 08-14 (checkpoint de decisao da 008 imutavel): a evidencia de servidor esta no `canais-fluxo.test.ts`.

## Self-Check: PASSED

- FOUND: apps/api/src/e2e/canais-fluxo.test.ts
- FOUND commits: b64b2c4, f698ead (ancestrais de HEAD)

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
