---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 01
subsystem: inbox-channels
tags: [postgres, fastify, nextjs, zod, vitest, canais, provedor, migracao-008]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "007-crm.sql (crm_toque_atualizado_em, plataforma.contatos), padrão repositório/serviço/rota REST do CRM, banco-crm.ts"
provides:
  - "ProvedorDeCanal e a tabela PROVEDORES (@n1/dominio/provedores-de-canal), D-01"
  - "@n1/dominio/crm/canais: Canal, NovoCanal, FiltroDeCanais, validarNovoCanal"
  - "podeNoCrm com canal/conversa/mensagem (B35)"
  - "008-canais-conversas-mensagens.sql inteira (canais, conversas, mensagens)"
  - "GET/POST /canais (Canal nasce desconectada) e semearCanal para os testes"
  - "ponte persistencia/canais-projetados.ts: Canais relacionais em GET /estado, com guarda to_regclass"
  - "cliente HTTP de Canais, selos de provedor/origem e a página [provedor] mínima"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08, 08-09, 08-12, 08-13, 08-14]

actuals:
  tokens: 24000
  tasks: 2
  commits: 2
plan_head_before: 75eff894ca8ee283a444dd0de05548fb3615d215
plan_head_after: 0be3eec75becf320aef4b8d7410b81ced2cc01a7

tech-stack:
  added: []
  patterns:
    - "projeção de tabela relacional em state.channels só em GET /estado, nunca em hidratar()"
    - "guarda to_regclass com cache só do resultado positivo"
    - "provedor como atributo do Canal (CHECK da 008 = tabela do domínio)"

key-files:
  created:
    - packages/dominio/src/provedores-de-canal.ts
    - packages/dominio/src/crm/canais.ts
    - packages/dominio/src/crm/canais.test.ts
    - apps/api/migracoes/008-canais-conversas-mensagens.sql
    - apps/api/src/repositorios/crm/canais.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/rotas/crm/canais.ts
    - apps/api/src/rotas/crm/canais.test.ts
    - apps/api/src/persistencia/canais-projetados.ts
    - apps/api/src/persistencia/canais-projetados.test.ts
    - apps/web/src/dados/crm/canais.ts
    - apps/web/src/dados/crm/canais.test.ts
    - apps/web/src/features/crm/selo-do-provedor.tsx
    - apps/web/src/features/crm/conectar-provedor.tsx
    - apps/web/src/features/crm/conectar-provedor.test.tsx
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page.tsx"
  modified:
    - packages/dominio/src/types/crm.ts
    - packages/dominio/src/crm/comum.ts
    - packages/dominio/src/crm/permissoes.ts
    - packages/dominio/src/crm/permissoes.test.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/estado.ts
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx"

key-decisions:
  - "A 008 nasce inteira (Canal, Conversa e Mensagem), copiada sem mudança de nome do SQL provado em 08-RESEARCH; só o Canal é exercitado aqui."
  - "O INSERT de POST /canais nunca envia conexao/estado/conexao_simulada: os defaults da 008 garantem Canal desconectada."
  - "A projeção entra só em GET /estado (acrescentarCanaisProjetados logo depois de hidratar); hidratar() e registros ficam intactos (medido: contagem de colecao='channels' igual antes e depois)."
  - "ID do Canal projetado é o UUID cru da tabela; não colide com chn_* do seed."

patterns-established:
  - "Rota de recurso novo do CRM: esquema .strict() local, serviço com exigir() antes da transação, FRASES para SQLSTATE"
  - "Teste de página web: Server Component chamado como função async e renderizado dentro do StoreProvider"

requirements-completed: []

coverage:
  - id: D1
    description: "Provedor do Canal no domínio (ProvedorDeCanal, PROVEDORES, validarNovoCanal, permissões de Canal por Papel)"
    requirement: CXE-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/canais.test.ts; packages/dominio/src/crm/permissoes.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Migração 008 (canais, conversas, mensagens) aplicada pelo migrar() real em Postgres 16 local, com o CHECK canais_provedor_tipo_ck espelhando a tabela do domínio"
    requirement: CXE-A1
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#(o)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET/POST /canais: Canal nasce desconectada, 403 para Membro (B35), 409 de nome e conta, 400 para campos proibidos, isolamento entre Espaços"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/canais.test.ts#(a)-(i)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ponte: Canal relacional em GET /estado sem ir para plataforma.registros; banco sem a 008 não quebra"
    requirement: CXE-A4
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#(j)-(n)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Página [provedor] cria o Canal e a lista das Configurações mostra selo do provedor e marca de origem (cadastrado/demo); slug inválido vira notFound()"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/conectar-provedor.test.tsx#(p)(q)"
        status: pass
    human_judgment: true
    rationale: "Aparência real da página e da lista (layout, selos) só se confere com olho humano; o teste prova o comportamento, não o visual. Fica para a UAT de fim de fase."
  - id: D6
    description: "Cliente HTTP de Canais: corpo e cabeçalhos do POST, 409 rico como ErroDeApi, invalidação só no sucesso"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/canais.test.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 01: Traçador de Canais Summary

**Um Administrador cria um Canal `desconectada` pela página de orientação do provedor; ele grava em `plataforma.canais` (008, aplicada pelo `migrar()` real), volta pela ponte de `GET /estado` como Canal relacional e aparece na lista das Configurações com selo do provedor e marca "cadastrado", ao lado dos Canais do seed marcados "demo".**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-12T15:58:16Z
- **Completed:** 2026-10-12T16:07Z
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files modified:** 24 (16 criados, 8 alterados)

## Accomplishments

- Domínio: `ProvedorDeCanal` e a tabela `PROVEDORES` (um provedor pertence a um tipo só), `validarNovoCanal` (tipo derivado do provedor, identificador canônico), `BloqueiosCrm.canais/conversas` e a regra B35 em `podeNoCrm` (Canal só para Administrador/Proprietário; Conversa e Mensagem seguem "Membro pode, Convidado só lê").
- A 008 inteira, idempotente, sem credencial de provedor, reaproveitando `crm_toque_atualizado_em()` da 007 (que não foi tocada). O `CHECK canais_provedor_tipo_ck` recusa (23514) o tipo trocado para cada um dos quatro provedores.
- API: repositório `pg`, serviço (Papel antes da transação, `FRASES` para nome/conta em uso) e rotas `GET/POST /canais` com corpo `.strict()` que recusa `workspaceId`, `tipo`, `conexao`, `estado`, `configuradoPor` e `conexaoSimulada`.
- Ponte: `carregarCanaisProjetados` com guarda `to_regclass` (banco sem a 008 devolve `[]` com uma consulta só) e `acrescentarCanaisProjetados` chamada só em `GET /estado`; a contagem de `colecao = 'channels'` em `plataforma.registros` não muda.
- Web: `criarCanal`/`useCanais`/`chaveDeCanais`, `SeloDoProvedor`/`SeloDeOrigem`/`MarcaDeConexaoSimulada`, a página `[provedor]` (Server Component que valida o slug com `ehProvedorDeCanal` e chama `notFound()`) e `ConectarProvedor`.

## Task Commits

1. **Task 1: Traçador** - `10949c7` (feat) — 23 arquivos
2. **Task 2: Cliente HTTP de Canais a fundo** - `0be3eec` (test) — ver "TDD Gate Compliance"

**Plan metadata:** commit `docs(08-01)` seguinte a este arquivo.

## Tracer feedback gate

Modo `end-of-phase`, auto-mode inativo, `<verify>` da Task 1 só com `<automated>` e sem `gate="blocking-human"`: os quatro comandos do verify foram re-executados de ponta a ponta antes de seguir para a Task 2 (domínio 515 verdes + tsc; api 21 verdes, nenhum pulado, contra o Postgres 16 em `crm-n1-pg-0801`:55581; web 3 verdes; `npm run typecheck` e eslint dos arquivos web em exit 0). Registro: "Tracer verified end-to-end — expanding". Nenhum checkpoint sintetizado.

## Decisions Made

- A 008 foi copiada do SQL provado em `08-RESEARCH.md` sem alterar nome de tabela, coluna, constraint ou índice (são o contrato com os `FRASES`).
- `inserir` nunca envia `conexao`, `conexao_simulada`, `estado` nem datas; o default da 008 é a garantia de que nenhum Canal nasce `conectada` por este caminho.
- `limparEspaco` apaga `mensagens`, `conversas`, `canais` antes de `negocios` (ordem de FK).
- O destino do `router.push` do formulário é `/crm/caixa-de-entrada/configuracoes`; 08-08 troca por `/canais/<id>` sob o mesmo prefixo.

## Deviations from Plan

### TDD Gate Compliance (Task 2)

**1. [Fail-fast rule 1 - RED inesperadamente verde] Os testes do cliente HTTP passaram antes de qualquer implementação**
- **Found during:** Task 2 (passo RED)
- **Issue:** `criarCanal`, `chaveDeCanais` e a invalidação só no sucesso já existiam desde a Task 1: o traçador precisava do cliente HTTP inteiro para atravessar a fatia. Os três comportamentos da Task 2 nasceram implementados, então não há RED honesto a produzir (`gsd_run check tdd-red-evidence` não se aplica: não houve falha de teste-alvo). O plano previa o caso ("Se algum comportamento falhar, corrigir `canais.ts`, não o teste").
- **Investigação:** o teste não está errado. Prova de que ele não é vacuoso: mutação temporária de `canais.ts` (invalidar antes da chamada, acrescentar `tipo` ao corpo, trocar o limite padrão 50 por 25) derrubou 3 dos 4 testes; `canais.ts` foi restaurado de `HEAD` e voltou a 4/4.
- **Fix:** nenhuma mudança de produção; só o commit `test(08-01)`. Sem commit `feat(08-01)` de GREEN (nada a implementar) e sem `refactor`.
- **Files modified:** `apps/web/src/dados/crm/canais.test.ts`
- **Commit:** `0be3eec`

### Auto-fixed Issues

**2. [Rule 1 - critério de aceitação] Comentário citava `apps/api` em `dados/crm/canais.ts`**
- **Found during:** verificação dos critérios de aceitação da Task 1
- **Issue:** `grep -c "apps/api" apps/web/src/dados/crm/canais.ts` devia ser 0 (web nunca importa a api); o cabeçalho mencionava o caminho em texto.
- **Fix:** o comentário passou a dizer "rota da api". Nenhuma mudança de comportamento.
- **Committed in:** `10949c7`

### Registro de ambiente

**3. Commits em `main`:** o resolvedor (`git.base-branch --is-protected main`) trata `main` como protegida (não há `git.allow_default_branch_commits` no `config.json`), mas o orquestrador mandou explicitamente ficar em `main`, sem worktree nem troca de branch, e o projeto usa `branching_strategy: none` com o histórico de fases todo em `main`. A assertiva de HEAD do protocolo de commit foi, por isso, tratada como não aplicável a este modo sequencial; nenhum `git update-ref`, stash, clean ou troca de branch foi feito. Decisão do dono se quiser a trava ligada neste fluxo.

---

**Total deviations:** 1 TDD gate (RED verde, documentado), 1 auto-fix trivial, 1 registro de ambiente.
**Impact on plan:** nenhum escopo a mais; a fatia e os critérios de aceitação foram cumpridos.

## Issues Encountered

- Nenhum erro de teste ou de tipo durante a execução; os testes de api, domínio e web passaram na primeira rodada.
- Regressão conferida fora do verify do plano: suíte inteira do domínio (1702) e do web (510) verdes; da api, só os arquivos vizinhos (`src/rotas/crm`, `migrar-seco`, `persistencia`) com 109 verdes. A suíte inteira da api não foi rodada (40-50 min no checkout principal, conforme `STATE.md`).

## Known Stubs

Nenhum. A página `[provedor]` é deliberadamente mínima (sem passos, QR/token, Fila/Origem), mas isso é escopo declarado de 08-08, não valor vazio ligado à tela.

## Threat Flags

Nenhum além do `<threat_model>` do plano. Mitigações aplicadas: T-08-01 (escopo por `workspace_id`, teste h), T-08-02 (`.strict()` + tipo derivado, teste b), T-08-03 (B35, teste g), T-08-04 (`FRASES` sem nome de constraint), T-08-05 (guarda `to_regclass`, testes j/k), T-08-06 (projeção fora de `hidratar`, teste n), T-08-08 (slug validado, teste q).

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0801` (porta 55581) foi subido para os testes e pode ser removido: `docker rm -f crm-n1-pg-0801`.

## Next Phase Readiness

- 08-02..08-05 podem partir dos contratos exportados aqui (provedores, `Canal`, `podeNoCrm`, `BloqueiosCrm`, `semearCanal`).
- A 008 ainda NÃO foi aplicada no banco da plataforma (08-14); a guarda `to_regclass` cobre `GET /estado` até lá.
- Pendência de requisitos: `CXE-D1/A1/A2/A4/W1/V1` são compartilhados com planos irmãos, então nenhum foi marcado como concluído por este plano (`requirements.ready-ids` → 0/6).

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
