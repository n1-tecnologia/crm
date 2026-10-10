---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 02
subsystem: crm
tags: [fastify, pg, permissoes, cors, transacao, sqlstate, vitest]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-01: POST/GET /contatos, ResultadoCrm, repositorio pg, banco-crm.ts e chamarCrm no web"
provides:
  - "@n1/dominio/crm/permissoes: podeNoCrm, ehAdministracao, AcaoCrm, RecursoCrm (matriz de D-14)"
  - "apps/api: AcessoAoCrm (criarAcessoAoCrmPg, exigir, resolverProprietario) lendo members -> roles de plataforma.registros"
  - "apps/api: comTransacao, traduzirErroDePg, FrasesDeRestricao (SQLSTATE 23505/23503/23514 -> 409 sem nome de constraint)"
  - "POST /contatos aceita proprietarioId (Membro ativo do mesmo Espaco)"
  - "CORS com PATCH, PUT e DELETE so para a allowlist"
  - "testes/banco-crm.ts: semearMembro"
  - "repositorios/CONTEXT.md com o padrao de repositorio do CRM"
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13]

requires_detail: "07-03..07-08 compoem exigir, resolverProprietario, comTransacao e semearMembro em vez de reinventa-los"

actuals:
  tokens: 12600
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Papel lido do banco a cada chamada (members -> roles em UMA consulta com left join) e aplicado no servico antes de qualquer leitura ou escrita"
    - "Servico pre-checa para dar a mensagem rica; o SQLSTATE traduzido por comTransacao e a rede contra corrida"
    - "commit dentro do try com o catch de traducao: o constraint trigger deferido so dispara no commit"
    - "Teste de rota sem banco injeta so o acesso falso e deixa o servico real: a recusa de Papel vem antes de qualquer pool()"

key-files:
  created:
    - packages/dominio/src/crm/permissoes.ts
    - packages/dominio/src/crm/permissoes.test.ts
    - apps/api/src/repositorios/crm/membros.ts
    - apps/api/src/servicos/crm/acesso.ts
    - apps/api/src/servicos/crm/transacao.ts
    - apps/api/src/servicos/crm/transacao.test.ts
    - apps/web/src/dados/crm/cliente-crm.test.ts
  modified:
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/crm/contatos.test.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/app.ts
    - apps/api/src/app.test.ts
    - apps/api/src/repositorios/CONTEXT.md

key-decisions:
  - "D-14: podeNoCrm devolve a frase de recusa (string | undefined), mesma forma de mayWriteDeal; a matriz e avaliada na ordem desconhecido, ler, escrita so ativo, convidado, funil, reabrir ganho"
  - "D-10: o Papel e lido de plataforma.registros a cada requisicao, nao do token; MembroDaSessao ficou intocado (autenticacao.test.ts:96 faz toEqual dele)"
  - "D-11: proprietarioId invalido (removido, inexistente ou de outro Espaco) cai na mesma recusa 409 PROPRIETARIO_INVALIDO; criado_por nunca vem do corpo"
  - "T-07-06: traduzirErroDePg so traduz 23505/23503/23514 com constraint cadastrado em FrasesDeRestricao; o resto e relancado e vira o 500 generico"

patterns-established:
  - "exigir(acesso, membro, acao, recurso) antes de ler ou criar; resolverProprietario para o proprietarioId do corpo"
  - "comTransacao(pool, fn, frases): recusa -> rollback; sucesso -> commit; erro -> rollback protegido, traduz ou relanca; release no finally"

requirements-completed: [CRM-D1, CRM-A1, CRM-A2, CRM-V1]

duration: 6 min
completed: 2026-10-10
plan_head_before: b066a67b723da3d03e985db8ba1d23ed77898241
plan_head_after: a0a297d8382b7cd540a51d9e728d3909ad04a620
commits: 6
status: complete

coverage:
  - id: D1
    description: "podeNoCrm implementa a matriz de D-14 (leitura, escrita so ativo, Convidado so consulta, Funil e reabrir Negocio ganho so da administracao)"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/permissoes.test.ts (480 casos em tabela)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Convidado recebe 403 em POST /contatos e nada e gravado; a consulta members -> roles de plataforma.registros resolve a base do Papel"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(g) Convidado ativo recebe 403 em POST /contatos e nada e gravado"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(i) Convidado recebe 403 em POST /contatos com o acesso falso"
        status: pass
    human_judgment: false
  - id: D3
    description: "proprietarioId so aceita Membro ativo do mesmo Espaco (409 PROPRIETARIO_INVALIDO); criadoPor continua o da sessao"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/contatos.test.ts#(h) removido, inexistente, de outro Espaco e outro Membro ativo"
        status: pass
    human_judgment: false
  - id: D4
    description: "comTransacao faz commit/rollback e traduz 23505/23503/23514, inclusive o trigger deferido no commit, sem expor nome de constraint"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/transacao.test.ts#(a)-(d) contra Postgres local"
        status: pass
    human_judgment: false
  - id: D5
    description: "CORS libera PATCH, PUT e DELETE so para a allowlist; /v1/integrations/* continua sem cabecalho CORS"
    requirement: CRM-A1
    verification:
      - kind: unit
        ref: "apps/api/src/app.test.ts#CORS para as rotas REST do CRM"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cliente HTTP do web provado: Bearer sempre, content-type so com corpo, 409 vira ErroDeApi com codigo e bloqueios, sem sessao nao chama fetch"
    requirement: CRM-V1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/cliente-crm.test.ts#(f)"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 02: Papel, Proprietario e transacao do CRM Summary

**Permissao por Papel (D-14) e troca de Proprietario (D-11) aplicadas no servico com o Papel lido de `plataforma.registros`, `comTransacao` que traduz SQLSTATE (incluindo o trigger deferido no commit) em 409 sem vazar nome de constraint, CORS para PATCH/PUT/DELETE so da allowlist e o cliente HTTP do web provado por teste.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-10-10T01:36:01Z
- **Completed:** 2026-10-10T01:42:00Z
- **Tasks:** 2 (ambas `tdd="true"`)
- **Files modified:** 15 (7 criados, 8 modificados)

## Accomplishments

- `@n1/dominio/crm/permissoes`: `podeNoCrm` devolve a frase de recusa em pt-BR (ou `undefined`) e implementa a matriz inteira de D-14; provada em tabela (Papeis x recursos x acoes x estados).
- Backend: `AcessoAoCrm` (`papelDe`, `membroAtivo`) lendo `members` -> `roles` em uma consulta com `left join`, `exigir` (403 `PERMISSAO`) antes de listar e criar Contato, `resolverProprietario` (409 `PROPRIETARIO_INVALIDO`). Um Convidado ja e barrado no unico endpoint que existe, e nada e gravado.
- `comTransacao`/`traduzirErroDePg`/`FrasesDeRestricao`: os servicos 07-03..07-08 abrem a transacao por aqui. Provado contra o Postgres local o caso que importa: a Empresa sem Contato admin so falha no `commit`, e o `catch` que cerca o `commit` o traduz.
- `app.ts`: `methods` do CORS agora tem PATCH, PUT e DELETE; origem fora da allowlist e `/v1/integrations/*` continuam sem cabecalho.
- `cliente-crm.test.ts` (web): 7 casos; um mutante (content-type sempre enviado) faz o caso do DELETE falhar, entao o teste de fato protege o Pitfall 4.
- `repositorios/CONTEXT.md` documenta o padrao inaugurado em `crm/`.

## Task Commits

Task 1 (Papel e Proprietario):
1. RED dominio - `5f2560b` (test)
2. GREEN dominio - `3443c36` (feat)
3. RED api - `b5f6a96` (test)
4. GREEN api - `793e972` (feat)

Task 2 (transacao, CORS, cliente web):
5. RED - `0c24b7a` (test)
6. GREEN - `a0a297d` (feat)

Base do plano (HEAD anterior ao primeiro commit): `b066a67b723da3d03e985db8ba1d23ed77898241`.

**Plan metadata:** commit `docs(07-02)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/permissoes.ts`, `permissoes.test.ts` - matriz de Papel do CRM e a prova em tabela
- `apps/api/src/repositorios/crm/membros.ts` - `papelDoMembro` e `membroAtivo` (`workspace_id = $1` em tudo)
- `apps/api/src/servicos/crm/acesso.ts` - `AcessoAoCrm`, `exigir`, `resolverProprietario`
- `apps/api/src/servicos/crm/contatos.ts` - `deps.acesso`; `listar` exige `ler`, `criar` exige `criar` e resolve o Proprietario
- `apps/api/src/rotas/crm/contatos.ts`, `index.ts` - `proprietarioId` no corpo; `OpcoesDeCrm.acesso`
- `apps/api/src/servicos/crm/transacao.ts`, `transacao.test.ts` - transacao com traducao de SQLSTATE
- `apps/api/src/testes/banco-crm.ts` - `semearMembro`
- `apps/api/src/rotas/crm/contatos.test.ts` - Papel (g), Proprietario (h) e acesso falso (i)
- `apps/api/src/app.ts`, `app.test.ts` - CORS
- `apps/api/src/repositorios/CONTEXT.md` - padrao de repositorio
- `apps/web/src/dados/crm/cliente-crm.test.ts` - prova do cliente HTTP

## Decisions Made

Ver `key-decisions` no frontmatter. `MembroDaSessao` ficou intocado (`git diff b066a67..HEAD -- apps/api/src/plugins/autenticacao.ts` vazio).

## Deviations from Plan

### Auto-fixed Issues

None - o codigo foi escrito como o plano descreve.

### Registros (nao sao correcoes de codigo)

1. **Teste (i) injeta so `acesso`, nao `{ contatos: falso, acesso: falso }`.** Com o servico falso o acesso nunca seria consultado e o 403 nao poderia sair dele; deixar o servico real com o acesso falso prova o que o caso (i) quer provar (a recusa de Papel vem antes de qualquer `pool()`).
2. **RED com esqueleto.** Para o RED ser uma falha de assercao (e nao de carga de modulo, que o `tdd-red-evidence` classifica como `INVALID_RED`), os commits RED de `permissoes.ts` e `transacao.ts` levam um esqueleto que compila e erra (`podeNoCrm` sempre `undefined`; `comTransacao` sem `begin`/`commit`/`rollback`). O GREEN os substitui. A evidencia de cada alvo foi validada com `gsd_run check tdd-red-evidence` (`RED_EVIDENCE_OK`): "Membro pendente nao le o CRM", "(g) Convidado ativo recebe 403 ... e nada e gravado", "(b) fn que devolve recusa faz rollback ...", "preflight de PATCH da origem da allowlist libera o metodo". Para os dois ultimos o registro usa a execucao isolada do alvo (`-t`), porque o reporter TAP do Vitest imprime valores esperado/obtido de objeto em varias linhas e o parser de TAP rejeita o relatorio completo como "Non-TAP data".
3. **`cliente-crm.test.ts` nasce verde.** O cliente e do 07-01; o plano pede a prova dele (T-07-07), nao codigo novo. Como controle no lugar do RED, um mutante (`content-type` sempre enviado) foi aplicado, o caso do DELETE falhou, e o arquivo foi restaurado por `git checkout -- <arquivo>`.
4. **Guarda de branch protegida.** Como no 07-01, os commits foram feitos em `main` por decisao do orquestrador (`branching_strategy: none`); `git.allow_default_branch_commits` nao foi alterado.
5. **`apps/api` inteiro nao foi rodado** (a suite leva dezenas de minutos). Verificacao escopada: `src/rotas/crm src/servicos/crm src/app.test.ts` (3 arquivos, 42 testes, nenhum pulado) contra `postgres:16` local, mais dominio inteiro (73 arquivos, 1531 testes), web inteiro (38 arquivos, 337 testes), typecheck dos tres workspaces e lint (0 erros; 3 warnings pre-existentes em `app-shell.tsx`).

**Total deviations:** 0 auto-fixed. **Impact:** nenhum no escopo.

## Issues Encountered

- O relatorio TAP completo com varias falhas de objeto foi rejeitado pelo classificador de RED (ver registro 2); resolvido com execucao isolada do alvo.

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0702` foi removido ao fim (`docker ps -q --filter name=crm-n1-pg-0702` vazio).

## Known Stubs

None.

## Threat Flags

None - os unicos pontos novos de superficie (`proprietarioId` no corpo, CORS de PATCH/PUT/DELETE) sao os do `<threat_model>` do plano (T-07-40, T-07-04) e estao mitigados e testados.

## Next Phase Readiness

- 07-03..07-08 compoem `exigir`, `resolverProprietario`, `comTransacao` (com `FrasesDeRestricao` por agregado) e `semearMembro`; `criarServicoDeContatos` agora recebe `{ pool, acesso }`.
- `apps/api/migracoes/007-crm.sql` continua nao rastreado (D-12): 07-05 o edita e a fase o commita.
- Verificacao visual de `/crm/contatos` continua para o fim da fase.

## Self-Check: PASSED

- Arquivos criados presentes em disco (7 criados, verificados com `[ -f ]`).
- Commits `5f2560b`, `3443c36`, `b5f6a96`, `793e972`, `0c24b7a`, `a0a297d` presentes na ancestralidade de HEAD (`commits: 6` medido por `rev-list`).
- Criterios de aceitacao reexecutados e verdes: `podeNoCrm`, `r.colecao = 'roles'`, `PROPRIETARIO_INVALIDO`, `"PATCH", "PUT", "DELETE"` presentes; `Nasce vazia` = 0; `autenticacao.ts` sem diff; container removido.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
