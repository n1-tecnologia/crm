---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 10
subsystem: api
tags: [aes-256-gcm, node-crypto, cofre, credenciais, postgres, aad]

requires:
  - phase: 09-04
    provides: "plataforma.credenciais (migração 009) com o índice parcial credenciais_ativa_unica"
  - phase: 09-06
    provides: "bloco de variáveis do .env.example e base de segurança do apps/api"
provides:
  - "servicos/cofre.ts: cifrar, decifrar, lerChavesDoCofre, guardarCredencial, lerCredencial (AES-256-GCM, AAD amarrado à linha)"
  - "COFRE_CHAVE, COFRE_CHAVE_VERSAO e as _ANTERIOR documentadas no .env.example, sem valor"
  - "seção Cofre de credenciais em servicos/CONTEXT.md (API, AAD, quem chama, troca de chave)"
affects: [09-17, 09-20, sessao-4, sessao-7, sessao-8, sessao-9, evolution, meta, email]

actuals:
  tokens: 6000
  tasks: 2
  commits: 4
plan_head_before: 455dbba97fc3cd48e811ae731c34f8689d77f9bf
plan_head_after: 2ef0b8d0e1352113bb5be4d923aafe7299a89288

tech-stack:
  added: []
  patterns:
    - "Cifra pura (cifrar/decifrar) separada da persistência (guardarCredencial/lerCredencial), que recebe o cliente de quem chama e deixa a transação com ele"
    - "Chave de teste sempre gerada em memória com randomBytes(32); nenhum arquivo de teste lê o .env"
    - "Teste estrutural que varre rotas/ para garantir que nenhuma importa o módulo sensível"

key-files:
  created:
    - apps/api/src/servicos/cofre.ts
    - apps/api/src/servicos/cofre.test.ts
  modified:
    - apps/api/.env.example
    - apps/api/src/servicos/CONTEXT.md

key-decisions:
  - "AAD = JSON de [workspaceId, donoTipo, donoId, tipo, versaoDaChave]; decisão costly, barata de trocar agora porque nenhuma credencial existe antes da Sessão 4."
  - "A etiqueta tem authTagLength 16 fixo no Decipheriv, para o GCM não aceitar etiqueta curta."
  - "A chave anterior só existe se COFRE_CHAVE_ANTERIOR estiver preenchida; com ela, COFRE_CHAVE_ANTERIOR_VERSAO passa a ser obrigatória."
  - "Re-cifrar credenciais com a chave nova fica para depois; o procedimento de troca está em servicos/CONTEXT.md."

requirements-completed: [SEG-05]

coverage:
  - id: D1
    description: "A cifra do cofre: AES-256-GCM com IV de 12 bytes novo a cada gravação, etiqueta de 16 bytes, AAD amarrado à linha; falha com chave errada, dono trocado, etiqueta truncada e texto adulterado."
    requirement: "SEG-05"
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/cofre.test.ts#cofre: cifra AES-256-GCM sem banco"
        status: pass
    human_judgment: false
  - id: D2
    description: "As chaves por ambiente: COFRE_CHAVE de 32 bytes em base64 e COFRE_CHAVE_VERSAO válida, com mensagem clara; chave anterior opcional lê linhas da versão anterior e versão desconhecida lança."
    requirement: "SEG-05"
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/cofre.test.ts#cofre: chaves por ambiente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gravar e ler no Postgres local: a coluna segredo_cifrado não contém o texto (UTF-8 nem base64); duas gravações do mesmo dono deixam uma ativa e a anterior revogada; chave errada e linha copiada para outro dono_id lançam; dono sem credencial devolve undefined."
    requirement: "SEG-05"
    verification:
      - kind: integration
        ref: "DATABASE_URL=postgres://postgres:x@localhost:55610/postgres npx vitest run src/servicos/cofre.test.ts (18 passed, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhuma rota importa servicos/cofre (teste estrutural sobre rotas/**/*.ts fora de testes)."
    requirement: "SEG-05"
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/cofre.test.ts#cofre: nenhuma rota devolve o segredo"
        status: pass
    human_judgment: false
  - id: D5
    description: "A COFRE_CHAVE real de homologação e produção, gerada e com cópia fora da VPS com o dono (09-17 e 09-20)."
    requirement: "SEG-05"
    verification: []
    human_judgment: true
    rationale: "Esta fase prova a cifra só com chaves descartáveis em memória; gerar, guardar e fazer a cópia da chave de cada ambiente é do dono nos checkpoints de 09-17 e 09-20."

duration: 3min
completed: 2026-10-23
status: complete
---

# Phase 9 Plan 10: Cofre de credenciais Summary

**Cofre de credenciais com AES-256-GCM do `node:crypto`, IV novo por gravação, AAD amarrado à linha (Espaço, dono, tipo, versão) e chave por ambiente fora do banco, provado contra Postgres local: a coluna não guarda o texto, a anterior é revogada e nenhuma rota importa o cofre**

## Performance

- **Duration:** 3 min
- **Started:** 2026-10-23T02:10:57Z
- **Completed:** 2026-10-23T02:14:00Z
- **Tasks:** 2 (ambas TDD: RED, GREEN)
- **Files modified:** 4

## Accomplishments

- `cifrar`/`decifrar` puros: IV de 12 bytes, etiqueta de 16 fixa no `Decipheriv`, AAD com o JSON de `[workspaceId, donoTipo, donoId, tipo, versao]`. Chave errada, dono trocado, etiqueta truncada e texto adulterado lançam.
- `lerChavesDoCofre` com mensagens claras (`COFRE_CHAVE precisa ter 32 bytes (base64).`, versão inválida, chave ausente) e leitura por versão com `COFRE_CHAVE_ANTERIOR`; versão desconhecida lança `A chave da versão N não está configurada.`
- `guardarCredencial` (revoga a ativa, insere a nova, no cliente de quem chama, devolve só `{ id }`) e `lerCredencial` (decifra a ativa ou `undefined`), provadas contra Postgres 16 local na porta 55610.
- `.env.example` com `COFRE_CHAVE=` e `COFRE_CHAVE_VERSAO=1` sem valor e as `_ANTERIOR` comentadas; `servicos/CONTEXT.md` com a seção "Cofre de credenciais (Fase 9)", inclusive o procedimento de troca de chave.

## Prova do TDD

- **RED 1 (`cofre.test.ts`, sem banco):** 13 de 13 casos falharam com `não implementado` (e `expected [Function] to throw error matching ... but got 'não implementado'`) contra um esqueleto que lança. Avaliação semântica: o arquivo foi descoberto, os 13 alvos executaram e falharam porque o comportamento planejado não existia; não é erro de import, sintaxe ou fixture. O esqueleto exporta todos os nomes, por isso o RED é de comportamento.
- **RED 2 (bloco `describeComBanco`):** 4 casos de banco falharam com `não implementado` (`18 tests | 4 failed`); o teste estrutural das rotas já passava, porque nenhuma rota importa o cofre hoje, e existe como trava contra regressão, não como RED.
- O comando `gsd_run check tdd-red-evidence` não foi usado: a avaliação semântica foi feita à mão sobre a saída do vitest.

## Task Commits

1. **Task 1: cifra e chaves por ambiente, sem banco** - `e6935aa` (test, RED) e `842fbe4` (feat, GREEN)
2. **Task 2: gravar e ler no banco, rotas sem o cofre, variáveis documentadas** - `51ea690` (test, RED) e `2ef0b8d` (feat, GREEN)

**Plan metadata:** commit `docs(09-10)` seguinte (este SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/servicos/cofre.ts` - a cifra, as chaves por ambiente e a gravação/leitura em `plataforma.credenciais`.
- `apps/api/src/servicos/cofre.test.ts` - 18 casos: 13 sem banco, 4 contra Postgres local e 1 estrutural.
- `apps/api/.env.example` - `COFRE_CHAVE`, `COFRE_CHAVE_VERSAO` e as `_ANTERIOR` comentadas, sem valor.
- `apps/api/src/servicos/CONTEXT.md` - seção "Cofre de credenciais (Fase 9)".

## Decisions Made

- AAD amarrado a `[workspaceId, donoTipo, donoId, tipo, versaoDaChave]`, como a pesquisa propôs; é decisão `costly` (trocá-la depois da Sessão 4 obriga a re-cifrar tudo) e ficou escrita no `CONTEXT.md`.
- `COFRE_CHAVE_ANTERIOR` preenchida torna `COFRE_CHAVE_ANTERIOR_VERSAO` obrigatória e com 32 bytes; sem a anterior, só a chave atual existe.
- O teste de banco apaga as próprias linhas de `plataforma.credenciais` por `workspace_id` no `afterAll`, sem alterar `limparEspaco` (que é de outros planos).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx eslint` direto nos dois arquivos não roda: não há `eslint.config.*` na raiz nem em `apps/api` (o lint do projeto passa por outro caminho em `npm run check`). Não foi rodado `npm run check` completo; só `tsc --noEmit` do `apps/api` (verde) e o vitest de `src/servicos` e `src/seguranca` (14 arquivos, 150 testes, 0 pulados).

## Verificação do plano

- `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55610/postgres npx vitest run src/servicos/cofre.test.ts`: 1 arquivo, 18 testes, 0 pulados.
- `cd apps/api && DATABASE_URL= npx vitest run src/servicos/cofre.test.ts` (Task 1, sem banco): 13 passam e os 4 de banco pulam, como esperado nessa variante.
- `cd apps/api && npx tsc --noEmit`: verde.
- Critérios de aceitação: `"aes-256-gcm"` aparece 2 vezes e `setAAD` 2 vezes em `cofre.ts`; `^COFRE_CHAVE=` e `^COFRE_CHAVE_VERSAO=` uma vez cada no `.env.example`; `CONTEXT.md` contém "Cofre de credenciais".

## User Setup Required

None neste plano. A geração da `COFRE_CHAVE` de homologação e de produção, com cópia fora da VPS, é do dono nos checkpoints de 09-17 e 09-20 (`openssl rand -base64 32`).

## Known Stubs

None.

## Threat Flags

None - nenhuma superfície nova além da registrada no `<threat_model>` do plano (T-09-47 a T-09-51 mitigadas por cifra, AAD, `authTagLength`, teste estrutural das rotas e leitura por versão).

## Next Phase Readiness

- Pronto: as Sessões 4, 7, 8 e 9 podem chamar `guardarCredencial`/`lerCredencial` a partir de serviços de provedor. 09-12 (varredura de rotas da suíte) pode reaproveitar a ideia do teste estrutural. 09-17 e 09-20 precisam gerar a `COFRE_CHAVE` de cada ambiente e guardar a cópia.
- Atenção: aplicar a 009 e usar o cofre num ambiente sem `COFRE_CHAVE` faz `lerChavesDoCofre()` lançar com mensagem clara; quem chamar deve ler as chaves na subida, não na primeira credencial.

## Self-Check: PASSED

Arquivos conferidos com `[ -f ]`: `cofre.ts` e `cofre.test.ts`. Commits `e6935aa`, `842fbe4`, `51ea690` e `2ef0b8d` são ancestrais de HEAD.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
