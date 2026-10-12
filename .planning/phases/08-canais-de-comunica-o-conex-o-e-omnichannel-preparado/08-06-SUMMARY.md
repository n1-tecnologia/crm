---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 06
subsystem: inbox-channels
tags: [fastify, postgres, zod, vitest, conversas, mensagens, transacao, omnichannel]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "008 (canais, conversas, mensagens), RepositorioDeCanais, semearCanal/limparEspaco (08-01); comTransacao/exigir/recusa e o padrao de rota com servico falso (08-03); pre-checagem rica de Conversa em Contato (08-04); validarNovaConversa, proximaSituacao, tituloDaConversa, TIPO_DE_IDENTIFICADOR_DO_CANAL, statusInicialDeEnvio (08-05)"
provides:
  - "repositorios/crm/conversas.ts: RepositorioDeConversas (inserir, obter com for update, abertaDoPar, listar, definirSituacao)"
  - "repositorios/crm/mensagens.ts: RepositorioDeMensagens.inserir e COLUNAS_DE_MENSAGEM sem carga_bruta"
  - "servicos/crm/conversas.ts: ServicoDeConversas (listar, obter, criar com a 1a Mensagem atomica, resolver, reabrir)"
  - "GET /conversas, GET /conversas/:id, POST /conversas (201), POST /conversas/:id/resolver|reabrir"
  - "OpcoesDeCrm.conversas para injetar servico falso"
affects: [08-10, 08-12, 08-13, 08-14]

actuals:
  tokens: 14400
  tasks: 3
  commits: 4
plan_head_before: 319b1a759041d6196eba7c8081bec2a251aae5c5
plan_head_after: fc889984a87e991c1d50a8ab70c8854d4ef4e613

tech-stack:
  added: []
  patterns:
    - "Abrir recurso com filho numa transacao so: o repositorio da Mensagem recebe o mesmo PoolClient que inseriu a Conversa"
    - "409 rico com o detentor (bloqueios.conversas) e a mesma frase como rede de SQLSTATE contra a corrida"
    - "Corpo estrito com objeto aninhado .strict(): a direcao da Mensagem de abertura nao vem do cliente"

key-files:
  created:
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/rotas/crm/conversas.ts
    - apps/api/src/rotas/crm/conversas.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "A Conversa nasce com os dois Participantes de ontologia 7.7 (Contato principal e o Membro que abriu como atendente), com id por randomUUID e entrouEm agora; gravados em camelCase no jsonb."
  - "A ordem das checagens em criar e Papel, forma, Canal (404/arquivado), Contato (404/inativo), Identificador do tipo do Canal, par aberto, insercoes; assim o 404 do Canal vem antes do do Contato."
  - "Escolha do Identificador: o principal do tipo que o Canal resolve, senao o mais antigo do tipo; o titulo da Conversa e o nome do Contato ou o valor exibido desse Identificador."
  - "A Conversa nao avanca a revisao do Espaco (avancarRevisaoDoEspaco): Conversa nao e projetada em GET /estado nesta fase, diferente do Canal."
  - "reabrir confere abertaDoPar antes de gravar e deixa o indice conversas_nao_resolvida_uq como rede contra a corrida, com a mesma frase."

patterns-established:
  - "Servico de recurso relacional que cria pai e filho: pre-checa tudo com mensagem rica, grava no mesmo PoolClient, e o rollback leva o pai se o filho falhar"

requirements-completed: [CXE-A2, CXE-A3]

coverage:
  - id: D1
    description: "Abrir Conversa grava Conversa e 1a Mensagem (enviada, Ator = Membro) na mesma transacao; Canal conectado da status enviada e desconectado da pendente; falha da Mensagem nao deixa Conversa"
    requirement: CXE-A3
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#a mesma Ana abre Conversa nos dois WhatsApps; #se a Mensagem falha, nenhuma Conversa fica"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma Conversa aberta por (Contato, Canal) com 409 CONVERSA_JA_ABERTA apontando a existente; o mesmo Contato conversa em outro Canal do mesmo tipo; reabrir respeita a mesma regra"
    requirement: CXE-A3
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#a 2a Conversa aberta do par; #reabrir com outra Conversa aberta do par"
        status: pass
    human_judgment: false
  - id: D3
    description: "Identificador do tipo que o Canal resolve (telefone nao e WhatsApp), Canal arquivado, Contato inativo e 404 entre Espacos"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#Contato sem Identificador do tipo do Canal; #Canal arquivado; #Canal ou Contato de outro Espaco"
        status: pass
    human_judgment: false
  - id: D4
    description: "Resolver e reabrir (A4.5), listagem com filtros, Papel no backend (Convidado 403, Membro cria) e isolamento por Espaco"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts (resolver e reabrir; listar e obter; Convidado)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rotas /conversas: 401, corpo e mensagem aninhada .strict(), estado da lista so ativo/na_lixeira, acoes sem corpo e envelope do 409 com bloqueios.conversas"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/conversas.test.ts#(a)-(f)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 06: API de Conversa relacional Summary

**Uma Conversa relacional abre com a primeira Mensagem numa transacao so (`enviada` em Canal conectado, `pendente` em desconectado), com uma Conversa aberta por (Contato, Canal), o mesmo Contato conversando pelos dois WhatsApps, Identificador `whatsapp` exigido (nunca `telefone`) e resolver/reabrir pelas regras de A4.5, tudo atras de `/conversas` com Papel no backend.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-10-12T17:23Z
- **Tasks:** 3 (1 auto, 1 TDD, 1 auto)
- **Files modified:** 7 (6 criados, 1 alterado)

## Accomplishments

- Repositorios: `RepositorioDeConversas` (todo `WHERE` por `workspace_id = $1`, `for update` opcional, `abertaDoPar`, `definirSituacao` para resolver e reabrir) e `RepositorioDeMensagens.inserir`, com `COLUNAS_DE_MENSAGEM` sem `carga_bruta` (A9) e `seq` convertido de bigint em texto para numero.
- Servico: `criar` confere Papel, forma, Canal, Contato, Identificador do Canal e o par aberto, e grava Conversa e Mensagem no mesmo `PoolClient`; `resolver`/`reabrir` travam a Conversa e usam `proximaSituacao` do dominio; `listar`/`obter` sem transacao, `obter` com o resumo do Canal.
- Rotas: cinco endpoints, corpo `.strict()` com `mensagem` aninhada tambem `.strict()`, lista com `estado` so `ativo|na_lixeira`, acoes sem `body`, sem `DELETE`; registradas em `rotasDeCrm` com `OpcoesDeCrm.conversas`.
- Provas contra Postgres 16 local: 12 casos de servico (inclusive a atomicidade com um byte nulo que o Postgres recusa na Mensagem) e 13 de rota com servico falso.

## Task Commits

1. **Task 1:** `9392573` (feat) - repositorios de Conversa e da primeira Mensagem
2. **Task 2 RED:** `1d0f003` (test) - servico de Conversas, esqueleto que lanca "ainda nao implementada"
3. **Task 2 GREEN:** `5a022db` (feat) - servico de Conversas
4. **Task 3:** `fc88998` (feat) - rotas `/conversas`, testes e registro em `rotasDeCrm`

**Plan metadata:** commit `docs(08-06)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/src/repositorios/crm/conversas.ts` - repositorio de Conversas (novo)
- `apps/api/src/repositorios/crm/mensagens.ts` - `inserir` da Mensagem e `COLUNAS_DE_MENSAGEM` (novo)
- `apps/api/src/servicos/crm/conversas.ts` - servico de Conversas (novo)
- `apps/api/src/servicos/crm/conversas.test.ts` - 12 casos contra Postgres local (novo)
- `apps/api/src/rotas/crm/conversas.ts` - rotas `/conversas` (novo)
- `apps/api/src/rotas/crm/conversas.test.ts` - 13 casos de rota com servico falso (novo)
- `apps/api/src/rotas/crm/index.ts` - registro de `rotasDeConversas` e `OpcoesDeCrm.conversas`

## Decisions Made

Ver `key-decisions` no frontmatter. A de mais efeito a jusante: a Conversa nao avanca a revisao do Espaco, entao 08-10/08-12 nao dependem de `GET /estado` para enxergar Conversas relacionais; elas falam com `/conversas` por HTTP.

## Deviations from Plan

### TDD Gate Compliance (Task 2)

O plano e `type: execute` com `tdd="true"` na tarefa, entao `gsd_run check tdd-red-evidence` nao foi invocado; a evidencia e a saida real do vitest.

- **RED:** `1d0f003`. Contra o Postgres 16 local (`crm-n1-pg-0806`:55586, `migrar()` real), os 12 testes de `conversas.test.ts` falharam com `Error: <metodo>: ainda nao implementada` (esqueleto do servico com tipos definitivos, no mesmo commit para o `tsc` ficar verde, como em 08-05). Avaliacao semantica: cada teste-alvo executou, o banco foi preparado e as fixtures (Contatos, Identificadores, Canais) foram criadas; a falha e do comportamento ausente, nao de sintaxe, importacao, descoberta zero ou fixture. **GREEN:** `5a022db`, 12/12 e `tsc` verdes. Sem REFACTOR.
- **Tasks 1 e 3** nao sao `tdd`: repositorios sem commit de teste proprio (provados pela Task 2) e rotas com testes no mesmo commit.

### Auto-fixed Issues

Nenhuma. Plano executado como escrito.

### Registro de ambiente

**Commits em `main`:** o orquestrador mandou ficar em `main` (isolamento `none`, `branching_strategy: none`); a assertiva de HEAD protegido foi tratada como nao aplicavel, como em 08-01 a 08-05. Nenhum `git update-ref`, stash, clean ou troca de branch. O guard de raiz fixada (#4254) rodou antes de cada commit.

**Lint:** o `lint` do repositorio cobre so `apps/web`; este plano nao toca a web. Typecheck dos tres workspaces verde.

---

**Total deviations:** 0 auto-fixed, 2 registros de TDD/ambiente.
**Impact on plan:** nenhum escopo a mais; todos os criterios de aceitacao foram cumpridos (`grep -c "workspace_id = \$1"` em `conversas.ts` = 6; `carga_bruta` fora de comentario em `mensagens.ts` = 0; `rotasDeConversas` em `index.ts` = 2).

## Issues Encountered

- Nenhum erro de teste ou de tipo alem do RED proposital; os testes passaram na primeira rodada do GREEN e da Task 3.
- Regressao fora do verify do plano: `src/rotas/crm`, `src/servicos/crm`, `src/repositorios/crm` e `src/persistencia` juntos, 28 arquivos e 337 testes verdes, nenhum pulado, contra o Postgres local. A suite inteira da api nao foi rodada (40-50 min).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum alem do `<threat_model>`. Mitigacoes aplicadas: T-08-25 (todo `WHERE` por `workspace_id = $1`; Canal, Contato e Conversa de outro Espaco dao 404, testado), T-08-26 (`NOVA_CONVERSA` e `mensagem` `.strict()`, atribuicao e autoria so da sessao; testes (b)/(c)), T-08-27 (`exigir(..., "conversa")` antes da transacao; 403 testado em criar, resolver e reabrir), T-08-28 (`limite <= 200`, testado), T-08-29 (o servico nao loga `conteudo`).

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0806` (porta 55586) e removido ao final.

## Next Phase Readiness

- 08-12 ganha `RepositorioDeMensagens` para ampliar (listar, enviar, status) e `COLUNAS_DE_MENSAGEM` pronta; deve passar `modelosAprovados: []` a `validarEnvio`.
- 08-13 (e2e "dois WhatsApps lado a lado") tem o caminho: mesmo Contato, duas Conversas em Canais diferentes, `statusEntrega` `enviada` e `pendente`.
- `CXE-A2` e `CXE-A3` sao compartilhados com planos irmaos; a marcacao depende de `requirements.ready-ids`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
