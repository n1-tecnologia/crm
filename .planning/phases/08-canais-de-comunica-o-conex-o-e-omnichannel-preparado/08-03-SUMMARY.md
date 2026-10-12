---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 03
subsystem: inbox-channels
tags: [fastify, postgres, zod, vitest, canais, conexao-simulada, arquivamento, revisao-do-espaco]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "Canal, NovoCanal, validarNovoCanal, 008, RepositorioDeCanais, criarServicoDeCanais, GET/POST /canais, semearCanal (plan 08-01)"
provides:
  - "proximaConexao, validarArquivamento, validarEdicaoDeCanal, EdicaoDeCanal, AcaoDeConexao em @n1/dominio/crm/canais"
  - "RepositorioDeCanais.obter/atualizar/definirConexao/arquivar/ativoEmConflito e filtros tipo/provedor/conexao/q em listar"
  - "repositorios/crm/referencias.ts: filaAtiva, origemAtiva, canalAntigoEmConflito, avancarRevisaoDoEspaco"
  - "ServicoDeCanais.obter/editar/simularConexao/desconectar/arquivar"
  - "GET/PATCH /canais/:id, POST /canais/:id/simular-conexao|desconectar|arquivar"
affects: [08-08, 08-09, 08-14]

actuals:
  tokens: 16600
  tasks: 3
  commits: 5
plan_head_before: 8bd690b2c14446e8fcd86125f960616661d212dc
plan_head_after: 0204d795de9a6dc4a8b4b377240e56062d622717

tech-stack:
  added: []
  patterns:
    - "Transição decidida por função pura do domínio (proximaConexao) e só gravada pelo serviço"
    - "UPDATE com SET montado de um mapa constante de colunas; corpo nunca nomeia coluna"
    - "Unicidade entre acervos: ativoEmConflito (tabela nova) e canalAntigoEmConflito (registros do seed) antes do INSERT/UPDATE"
    - "Revisão do Espaço somada na mesma transação de toda escrita de recurso relacional"

key-files:
  created:
    - apps/api/src/repositorios/crm/referencias.ts
    - apps/api/src/servicos/crm/canais.test.ts
  modified:
    - packages/dominio/src/crm/canais.ts
    - packages/dominio/src/crm/canais.test.ts
    - apps/api/src/repositorios/crm/canais.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/rotas/crm/canais.ts
    - apps/api/src/rotas/crm/canais.test.ts

key-decisions:
  - "A decisão simular/desconectar/arquivar mora no domínio; o serviço traduz a falha em 409 TRANSICAO_INVALIDA e os dois CHECK da 008 ficam como rede contra corrida (FRASES)."
  - "ativoEmConflito e canalAntigoEmConflito devolvem no máximo um detentor, com o nome pesando mais que a conta quando os dois casam."
  - "editar valida o corpo duas vezes de propósito: uma antes da transação (sem banco) e outra dentro do callback, só para estreitar o tipo."
  - "avancarRevisaoDoEspaco não falha sem linha em plataforma.workspaces (0 linhas atualizadas), coberto por teste."

patterns-established:
  - "Recurso relacional que ainda depende do Espaço antigo lê só por referencias.ts, com workspace_id = $1 em toda consulta"

requirements-completed: []

coverage:
  - id: D1
    description: "Transições puras do Canal: conectar em dois atos, desconectar, arquivar, editar (frases exatas da ontologia 12.2 e 11.1)"
    requirement: CXE-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/canais.test.ts#proximaConexao; #validarArquivamento; #validarEdicaoDeCanal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Serviço de Canais contra Postgres 16 local: Fila/Origem por Espaço, unicidade contra o seed (A5), conexão simulada marcada, arquivar desconectando na mesma linha e liberando o número, revisão do Espaço (A4), Papel (B35) e 404 entre Espaços"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais.test.ts (17 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rotas GET/PATCH /canais/:id e as três ações sem corpo: PATCH .strict com três campos, ação sem content-type responde 200, 409 no envelope, sem DELETE, filtros validados"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/canais.test.ts#(a)-(g)"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 03: API completa do Canal Summary

**O Canal conecta em dois atos (simulado e marcado), desconecta, arquiva desconectando na mesma linha e é configurado só em nome, Fila e Origem padrão, com Fila/Origem validadas por Espaço, unicidade de nome e conta valendo também contra o `channels` do seed e a revisão do Espaço somada em toda escrita.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-10-12T16:43Z
- **Tasks:** 3 (2 TDD, 1 auto)
- **Files modified:** 8 (2 criados, 6 alterados)

## Accomplishments

- Domínio: `proximaConexao`, `validarArquivamento` e `validarEdicaoDeCanal` puros, com as frases exatas do plano; as mesmas funções que tela e api aplicam.
- Repositório: `obter` (com `for update`), `atualizar` (SET de um mapa constante de três colunas), `definirConexao`, `arquivar` (um UPDATE que satisfaz os três CHECK da 008) e `ativoEmConflito`; `listar` filtra por `tipo`, `provedor`, `conexao` e `q` (com `contemTexto` + `CLAUSULA_ESCAPE`).
- `referencias.ts`: `filaAtiva`, `origemAtiva`, `canalAntigoEmConflito` e `avancarRevisaoDoEspaco`, todas com `workspace_id = $1`.
- Serviço: `escrita` no molde de Funis (Papel, validação sem banco, transação com Canal travado, 404 fora do Espaço); `criar` ganhou Fila/Origem, a guarda nos dois acervos com `bloqueios.canais` e a revisão.
- Rotas: `GET /canais/:id`, `PATCH /canais/:id` (`.strict()` + `.refine`), as três ações sem `body`, filtros novos em `GET /canais`, `filaPadraoId`/`origemPadraoId` em `POST /canais`; sem `DELETE` (DO-CXE-03).

## Task Commits

1. **Task 1 RED:** `3a06325` (test) - proximaConexao, validarArquivamento, validarEdicaoDeCanal
2. **Task 1 GREEN:** `5497325` (feat) - transições puras do Canal no domínio
3. **Task 2 RED:** `f0f9b99` (test) - serviço de Canais contra Postgres local
4. **Task 2 GREEN:** `d758115` (feat) - repositório, `referencias.ts` e serviço
5. **Task 3:** `0204d79` (feat) - rotas e testes de rota

**Plan metadata:** commit `docs(08-03)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/canais.ts` / `canais.test.ts` - transições e edição do Canal
- `apps/api/src/repositorios/crm/canais.ts` - métodos novos e filtros de `listar`
- `apps/api/src/repositorios/crm/referencias.ts` - leituras do Espaço antigo e revisão (novo)
- `apps/api/src/servicos/crm/canais.ts` - serviço completo
- `apps/api/src/servicos/crm/canais.test.ts` - 17 casos contra Postgres local (novo)
- `apps/api/src/rotas/crm/canais.ts` / `canais.test.ts` - rotas e testes

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

### TDD Gate Compliance (Tasks 1 e 2)

- **Task 1 RED:** `3a06325`. 12 dos 29 testes de `canais.test.ts` falharam com `proximaConexao`/`validarArquivamento`/`validarEdicaoDeCanal is not a function`; os 17 anteriores seguiram verdes. Avaliação semântica: cada teste-alvo executou e falhou por símbolo ausente, não por sintaxe, fixture ou descoberta zero. **GREEN:** `5497325`, 29/29 e `tsc` verdes. Sem REFACTOR.
- **Task 2 RED:** `f0f9b99`. Contra o Postgres 16 local (`crm-n1-pg-0803`:55583, `migrar()` real), 15 dos 17 testes falharam (`servico.obter/editar/simularConexao… is not a function` e a ausência da validação de Fila/Origem e da guarda do seed); os 2 que passaram (listar sem filtro, criar simples) descrevem comportamento que já existia. **GREEN:** `d758115`, 17/17. Sem REFACTOR. O plano é `type: execute` com `tdd="true"` por tarefa, então `gsd_run check tdd-red-evidence` não foi invocado; a evidência é a saída real do vitest.
- **Task 3** não é `tdd`: testes e rotas no mesmo commit.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dublê de `ServicoDeCanais` do teste de rota ficou sem os cinco métodos novos**
- **Found during:** Task 2 (`tsc --noEmit` depois de ampliar a interface do serviço)
- **Issue:** `rotas/crm/canais.test.ts` monta um `ServicoDeCanais` falso literal; com a interface ampliada o typecheck quebrava.
- **Fix:** o dublê ganhou `obter/editar/simularConexao/desconectar/arquivar`, no commit de GREEN da Task 2, para o `tsc` ficar verde em todo commit.
- **Files modified:** `apps/api/src/rotas/crm/canais.test.ts`
- **Committed in:** `d758115`

### Registro de ambiente

**Commits em `main`:** o orquestrador mandou ficar em `main` (isolamento `none`, `branching_strategy: none`); a assertiva de HEAD protegido foi tratada como não aplicável, como em 08-01 e 08-02. Nenhum `git update-ref`, stash, clean ou troca de branch. O guard de raiz fixada (#4254) foi executado antes de cada commit.

**Lint:** o `lint` do repositório cobre só `apps/web` (`npm run lint -w @n1/web`); este plano não toca a web, então ele não se aplica. Typecheck dos três workspaces verde.

---

**Total deviations:** 1 auto-fixed (Rule 3), 2 registros de TDD/ambiente.
**Impact on plan:** nenhum escopo a mais; todos os critérios de aceitação foram cumpridos.

## Issues Encountered

- Nenhum erro de teste ou de tipo além do dublê acima; os testes passaram na primeira rodada de cada GREEN.
- Regressão fora do verify do plano: `src/rotas/crm`, `src/servicos/crm`, `src/repositorios/crm` e `src/persistencia` juntos, 25 arquivos e 289 testes verdes, nenhum pulado, contra o Postgres local. A suíte inteira da api não foi rodada (40-50 min).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do `<threat_model>`. Mitigações aplicadas: T-08-12 (`exigir` por ação antes da transação; 403 testado nas cinco escritas), T-08-13 (`obter` com `workspace_id = $1 and id = $2`; 404 em serviço e rota), T-08-14 (`EDICAO_DE_CANAL` `.strict()` e `COLUNAS_EDITAVEIS`), T-08-15 (`filaAtiva`/`origemAtiva` por Espaço; 409 com `campo`), T-08-16 (`conexao_simulada` e `conectada_em` gravados; só administração), T-08-17 (`canalAntigoEmConflito`), T-08-18 (colunas de mapa constante, `$n`, `ilike` escapado, `ORDER BY` fixo).

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0803` (porta 55583) foi removido ao final.

## Next Phase Readiness

- 08-08 (página de conexão) e 08-09 (ficha do Canal) têm toda a API de que precisam; o cliente HTTP da web ainda não chama `GET/PATCH /canais/:id` nem as ações (é escopo desses planos).
- 08-14: a 008 continua sem ser aplicada no banco da plataforma; `canalAntigoEmConflito` e `avancarRevisaoDoEspaco` só rodam contra `registros`/`workspaces`, que já existem.
- `CXE-A2` e `CXE-D1` são compartilhados com planos irmãos; a marcação depende de `requirements.ready-ids`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
