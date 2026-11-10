---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 04
subsystem: api
tags: [crm, contatos, mesclagem, rn-con-14, vitest, postgres]

requires:
  - phase: 14-01
    provides: estado `mesclado` do Contato (`EstadoDoContato`, `mescladoEmId`) e a constraint `contatos_mesclado_ck`
provides:
  - recusa 409 `CONTATO_MESCLADO` em toda escrita do serviço de Contatos
  - recusa `CONTATO_MESCLADO` ao dar Negócio, vínculo ou admin de Empresa a um Contato absorvido
  - parágrafo "Contato mesclado (Fase 14)" em `apps/api/src/servicos/CONTEXT.md`
affects: [14-09, 14-14]

actuals:
  tokens: 3700
  tasks: 2
  commits: 3
plan_head_before: 990ce256ac63602a1f23b73fdec692779893c3e0
plan_head_after: aacc9b38911a8f4e6a22ed470d93a35ca8a897a3
commits: 3

tech-stack:
  added: []
  patterns:
    - "regra de estado no helper `escrita`, antes de qualquer regra de transição, para cobrir todos os gestos de uma vez"

key-files:
  created: []
  modified:
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.test.ts
    - apps/api/src/servicos/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.test.ts
    - apps/api/src/servicos/crm/empresas.ts
    - apps/api/src/servicos/crm/empresas.test.ts
    - apps/api/src/servicos/CONTEXT.md

key-decisions:
  - "A recusa de `mesclado` mora no helper `escrita` de `contatos.ts`, não em `edicao`: assim `arquivar`, `restaurar`, lixeira e exclusão permanente também recusam, e antes de `TRANSICAO_INVALIDA`/`CONTATO_FORA_DA_LIXEIRA`."
  - "Em Empresas a recusa entrou em `carregarContato`, que serve vincular, trocar admin e criar com Contato admin existente: as quatro portas por onde um Contato entra numa Empresa."
  - "Contato `arquivado` continua aceito em Negócio (RN-CON-19), como o plano decidiu."

patterns-established:
  - "Teste de Contato absorvido: marcar por SQL com `poolDoDono()` (`estado = 'mesclado', mesclado_em_id, mesclado_em`), porque só a mesclagem (14-09) grava o estado."

requirements-completed: [UNI-05]

coverage:
  - id: D1
    description: "Editar, adicionar/editar/remover Identificador, arquivar, restaurar, lixeira e exclusão permanente de um Contato mesclado dão 409 CONTATO_MESCLADO com a frase da regra, e a linha do banco não muda; obter continua liberado"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#RN-CON-14: Contato `mesclado` é somente leitura"
        status: pass
    human_judgment: false
  - id: D2
    description: "Criar ou editar Negócio com Contato mesclado recusa com 409 CONTATO_MESCLADO (campo contatoId) e nada é gravado; Contato arquivado continua aceito"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(i) RN-CON-14"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vincular um Contato mesclado a uma Empresa, ou criá-la com ele como admin, recusa com 409 CONTATO_MESCLADO e nada é gravado"
    requirement: UNI-05
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/empresas.test.ts#(j) RN-CON-14"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 04: Contato mesclado somente leitura nos serviços do CRM novo Summary

**Recusa 409 `CONTATO_MESCLADO` no helper `escrita` de Contatos e na conferência de Contato de Negócios e Empresas, provada contra Postgres 16 descartável, para que um Contato absorvido não seja editado, restaurado, nem ganhe Negócio ou vínculo.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-04T17:43:00Z (aproximado)
- **Completed:** 2026-11-04T17:51:51Z
- **Tasks:** 2
- **Files modified:** 7 (nenhum criado)

## Accomplishments

- Os oito gestos de escrita de `ServicoDeContatos` sobre um Contato `mesclado` voltam 409 `CONTATO_MESCLADO` com a frase de RN-CON-14, e a linha em `plataforma.contatos` fica idêntica. `obter` segue liberado.
- Antes da correção, `restaurar` e `enviarParaLixeira` estouravam `contatos_mesclado_ck` no banco (erro 500 em vez de 409); o furo do Pitfall 6 era real.
- `conferirContato` (Negócios, em criar e em editar) e `carregarContato` (Empresas: vincular, trocar admin, criar com admin existente) recusam o absorvido; `arquivado` continua aceito em Negócio.
- `servicos/CONTEXT.md` registra a regra, quem a aplica e quem grava o estado.

## Task Commits

1. **RED (Tasks 1 e 2):** `d44e19a` (test) os testes dos três serviços, com falha esperada
2. **Task 1 GREEN:** `f8ad476` (feat) `contatoMesclado()` e a conferência em `escrita`
3. **Task 2 GREEN:** `aacc9b3` (feat) `conferirContato`, `carregarContato` e `servicos/CONTEXT.md`

**Plan metadata:** commit de docs que fecha o plano (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

- **RED** (`d44e19a`): 10 de 46 testes dos três arquivos falharam contra o Postgres 16 com 001 a 011. Avaliação semântica: cada falha é a ausência planejada da recusa, o alvo executou. Editar, Identificadores, arquivar e excluir davam `CONTATO_INATIVO`/`TRANSICAO_INVALIDA`/`CONTATO_FORA_DA_LIXEIRA` em vez de `CONTATO_MESCLADO`; `restaurar` e `enviarParaLixeira` estouravam `contatos_mesclado_ck`; Negócio e Empresa aceitavam o absorvido ("esperava recusa, veio sucesso"). Nenhuma falha de carga, fixture ou sintaxe. O classificador `check tdd-red-evidence` não foi rodado (o vitest não persiste TAP/JUnit neste repositório); a evidência é o relatório colado na execução.
- **GREEN** (`f8ad476`, `aacc9b3`): os três arquivos passam, 46/46; `servicos/crm` + `rotas/crm` 272/272.
- **REFACTOR:** nenhum commit.

## Files Created/Modified

- `apps/api/src/servicos/crm/contatos.ts` - `contatoMesclado()` e a conferência de estado em `escrita`.
- `apps/api/src/servicos/crm/negocios.ts` - `conferirContato` recusa `mesclado` antes da lixeira.
- `apps/api/src/servicos/crm/empresas.ts` - `carregarContato` recusa `mesclado` antes da lixeira.
- `apps/api/src/servicos/crm/{contatos,negocios,empresas}.test.ts` - os casos de RN-CON-14 (`poolDoDono` passou a ser importado em Negócios e Empresas).
- `apps/api/src/servicos/CONTEXT.md` - parágrafo "Contato mesclado (Fase 14)".

## Decisions Made

Ver `key-decisions`. A única que um plano seguinte precisa lembrar: a Tarefa conversacional (14-14) exige Contato `ativo` e deve conferir isso no próprio serviço; `conferirContato` de Negócios aceita `arquivado`.

## Deviations from Plan

None - plan executed exactly as written.

Observação: o plano mandava `escrita` recusar o `mesclado`; o `edicao` não precisou mudar, porque envolve `escrita` e a recusa vem antes de `CONTATO_INATIVO`. Em Empresas o plano falava de `empresas.ts:222` (uma conferência); a função `carregarContato` serve quatro portas, e todas passaram a recusar, o que o must_have ("vincular um Contato `mesclado` a uma Empresa") exige.

## Issues Encountered

Nenhum. Os guardas de D-06 (`sem-listas-espelho.test.ts`, domínio e api) passam; nenhum literal proibido foi escrito.

## Verification

- Postgres 16 descartável (`crm-n1-pg-1404`, porta 55604, removido ao fim): `contatos.test.ts` + `negocios.test.ts` + `empresas.test.ts` 46/46; `servicos/crm` + `rotas/crm` 272/272.
- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run`: 1241 passando, 567 puladas (sem banco), 1 todo; `npx tsc --noEmit` ok. `definirEstado` continua tipado com `EstadoCrm` (sem `mesclado`).
- Critérios de aceite: `CONTATO_MESCLADO` presente em `contatos.ts`, `negocios.ts` e `empresas.ts`; `mesclado` aparece 14 vezes em `contatos.test.ts` e 6 em `servicos/CONTEXT.md`.
- Não rodada: a suíte inteira da api com banco (13 a 17 min, `lote-contas-a-pagar (d)` falha por rede conhecida).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para a mesclagem (14-09): o absorvido já é terminal e somente leitura em Contatos, Negócios e Empresas.
- Em aberto para quem mexer em `FRASES_DE_CONTATOS`: ainda não traduz `contatos_mesclado_em_fk` nem as `contato_consentimentos_*` (não era escopo deste plano).
- A mesclagem (14-09) não pode usar `escrita` de Contatos para gravar o estado: ela grava por repositório próprio, porque `escrita` agora recusa o absorvido (e `definirEstado` não aceita `mesclado`).

## Self-Check: PASSED

- Arquivos modificados existem e estão nos commits `d44e19a`, `f8ad476` e `aacc9b3`, todos na branch (conferido com `git merge-base --is-ancestor`).
- Migrações 001 a 011 intocadas; nada fora de `files_modified` foi alterado.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
