---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 10
subsystem: api
tags: [nomes, lote, crm, unnest, ordinality, permissao, swr, tdd, ucr-08]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-04: TIPOS_DE_OBJETO_DO_CRM; 15-37: GET /atividades e o molde de rota/servico de leitura; 15-09: RECURSO_DO_TIPO por tipo no servico de Atividades"
provides:
  - "POST /crm/nomes: { alvos: [{ tipo, id }] } (ate 200) devolve { tipo, id, nome | null } NA ORDEM pedida, so do Espaco da sessao, uma consulta por tipo"
  - "Tipo que o Papel nao le, id desconhecido e id de outro Espaco voltam iguais, com nome null (nunca 403 por item)"
  - "@n1/dominio/crm/nomes: AlvoDoCrm, NomeDoAlvo, NOMES_MAXIMO"
  - "useNomesDoCrm(alvos), chaveDeNomes e nomeDe em apps/web/src/dados/crm/nomes.ts (uma chamada por lista, chave estavel, lotes de 200)"
affects: [15-21, 15-15, 15-08]

plan_head_before: db8c82d63845067e0c133527a8a6eaf26948b639
plan_head_after: dc06f095257ab32340403f19e56baec2fd748bc1

actuals:
  tokens: 11900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Lote por POST com unnest ... with ordinality + left join por workspace_id: uma linha por posicao pedida, repeticao e id desconhecido incluidos"
    - "Permissao por tipo no servico (podeNoCrm ler) antes de ir ao banco; o tipo negado nem chega a consulta e volta null"
    - "Chave de SWR com alvos unicos e ordenados: a mesma lista em outra ordem compartilha a chamada e o cache"

key-files:
  created:
    - packages/dominio/src/crm/nomes.ts
    - packages/dominio/src/crm/nomes.test.ts
    - apps/api/src/repositorios/crm/nomes.ts
    - apps/api/src/servicos/crm/nomes.ts
    - apps/api/src/servicos/crm/nomes.test.ts
    - apps/api/src/rotas/crm/nomes.ts
    - apps/api/src/rotas/crm/nomes.test.ts
    - apps/web/src/dados/crm/nomes.ts
    - apps/web/src/dados/crm/nomes.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/servicos/crm/atividades.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O nome nao filtra por estado: o que esta na lixeira ou arquivado ainda tem nome (a Auditoria e a IA citam o objeto eliminado); quem pode ler o tipo le o nome, como em GET /<recurso>?estado="
  - "Contato mesclado responde o nome dele mesmo, sem seguir mesclado_em_id (e referencia historica, nao o cartao da Tarefa); sem nome, usa o Identificador principal e por fim 'Contato sem nome' (nomeDeExibicaoDoContato); Empresa usa nome fantasia, senao razao social"
  - "Membro removido ou desconhecido recebe tudo null, nao 403: a regra do plano e 'nunca 403 por item', e a resposta nao revela se o id existe"
  - "O servico confere de novo o teto de 200 e o tipo (400 campo alvos) porque tambem e chamado sem a rota; a lista vazia responde antes de ler Papel ou banco"
  - "RECURSO_DO_TIPO e ehTipoDoCrm passaram a ser exportados de servicos/crm/atividades.ts para o servico de nomes reutilizar o mesmo mapa tipo -> recurso em vez de duplicar"
  - "nomeDe devolve string | null | undefined: undefined (ainda nao sei) e diferente de null (a api respondeu sem nome)"

patterns-established:
  - "Servico de leitura em lote sem transacao: deps.pool() direto, sem comTransacao, porque nada grava e nao ha leitura que precise de snapshot unico"

requirements-completed: [UCR-08]

coverage:
  - id: D1
    description: "POST /crm/nomes devolve o nome de ids do CRM novo na ordem pedida, so do Espaco da sessao, com null para id desconhecido ou de outro Espaco"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/nomes.test.ts#(a) tracador e (d) o mesmo id em dois Espacos (Postgres local 55710)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O tipo que o Papel nao le volta com nome null (nunca 403 por item) e os outros tipos da mesma chamada continuam com nome"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/nomes.test.ts#(b) Papel sem ler num tipo e (f) Membro removido"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os seis tipos (Contato, Empresa, Negocio, Conversa, Funil, Canal) tem nome; a leitura nao grava Atividade nem sobe a revisao do Espaco"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/nomes.test.ts#(c) os seis tipos e (h) e leitura"
        status: pass
    human_judgment: false
  - id: D4
    description: "Borda UCR-08: a mesma lista pedida duas vezes devolve o mesmo resultado e lista vazia nao vai ao banco"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/nomes.test.ts#(g) repeticao e (i) lista vazia"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rota recusa 201 alvos, tipo desconhecido, campo a mais e pedido sem Authorization antes de chegar ao servico"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/nomes.test.ts (15 casos, servico falso)"
        status: pass
    human_judgment: false
  - id: D6
    description: "useNomesDoCrm agrupa os alvos numa chamada com chave estavel: dois componentes com os mesmos alvos em ordens diferentes fazem uma chamada so"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/nomes.test.ts#(e) dois componentes (mutacao de controle: sem o sort, 4 de 10 falham)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Prohibition UCR-08 (privacidade): a rota nunca devolve o nome de um registro de outro Espaco nem de um tipo que o Papel nao pode ler"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/nomes.test.ts#(a), (b), (d)"
        status: pass
    human_judgment: true
    rationale: "A prohibition esta marcada verification: judgment no plano; os casos provam Espaco e Papel, mas a revisao de que nenhum caminho novo vaza nome fica com o revisor."

duration: 13min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 10: Nomes do CRM novo em lote Summary

**`POST /crm/nomes` dá o nome de até 200 ids do CRM novo (Contato, Empresa, Negócio, Conversa, Funil, Canal) numa chamada, na ordem pedida, só do Espaço da sessão e só do que o Papel lê, e `useNomesDoCrm` o entrega à web com chave estável e cache SWR.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-06T12:20:00Z
- **Completed:** 2026-11-06T12:34:00Z
- **Tasks:** 2 (a 1 é traçador TDD; a 2 é TDD de limites)
- **Files modified:** 14 (9 criados, 5 alterados)

## Accomplishments

- Domínio: `AlvoDoCrm`, `NomeDoAlvo` e `NOMES_MAXIMO` (200) em `@n1/dominio/crm/nomes`, reaproveitando `TIPOS_DE_OBJETO_DO_CRM`.
- Repositório: uma consulta por tipo presente, `unnest($2::text[]) with ordinality` + `left join ... on x.workspace_id = $1 and x.id = e.id`, uma linha por posição pedida (id repetido incluído).
- Serviço: o Papel é lido uma vez; cada tipo passa por `podeNoCrm(…, "ler", recurso)`; só os alvos legíveis vão ao banco; lista vazia responde antes de ler Papel ou banco; teto e tipo conferidos de novo (400, campo `alvos`).
- Rota `POST /crm/nomes` com zod `.strict()` (`alvos` máx. 200, `tipo` em `TIPOS_DE_OBJETO_DO_CRM`, `id` 1–64), registrada em `rotas/crm/index.ts` (`rotasDeNomes`, opção `nomes` para injeção em teste).
- Web: `useNomesDoCrm` (lotes de 200, `keepPreviousData`, sem repetir 4xx), `chaveDeNomes` (alvos únicos e ordenados) e `nomeDe` (`string | null | undefined`).

## TDD

- **RED** (`8e2b0f9`): teste do serviço contra o Postgres local com um esboço do serviço que devolve `nome: null` para tudo. Comando: `vitest run src/servicos/crm/nomes.test.ts` com as duas URLs em `localhost:55710`. Resultado: 8 falhos, 2 passando (`(b)` e `(f)` passavam à toa por esperar `null`). O alvo `(a) traçador` falhou na asserção planejada: esperado `[{deal, N, "Proposta Acme"}, {contact, X, null}, …]`, recebido `nome: null` na primeira posição. Uma primeira versão do fixture de Empresa falhou por fixture (`precisa de ao menos um Contato admin vigente`, trigger deferido da 007); foi corrigida (Empresa e admin na mesma instrução) e o caso `(c)` voltou a falhar pela asserção de nomes. Avaliação semântica: o alvo executou e falhou pela razão certa (nenhum nome resolvido); o classificador `check tdd-red-evidence` não foi usado (`workflow.tdd_mode` é `false` e o `vitest` rodou com o reporter padrão, não TAP).
- **GREEN** (`434cc74`): repositório, serviço, rota, registro e hook; 10/10 no serviço.
- **Task 2** (`dc06f09`): testes do domínio (2), da rota (15) e do hook (10); mutação de controle no hook (tirar o `sort` da chave derruba 4 de 10).
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): o nome de um Negócio da tabela pelo serviço** — `8e2b0f9` (test, RED), `434cc74` (feat, GREEN)
2. **Task 2: limites, recusas e o hook provados** — `dc06f09` (test + CONTEXT das três camadas)

**Plan metadata:** commit `docs(15-10)` deste SUMMARY, STATE e ROADMAP.

## Files Created/Modified

- `packages/dominio/src/crm/nomes.ts` — tipos do alvo e o teto de 200.
- `apps/api/src/repositorios/crm/nomes.ts` — `nomesDosAlvos`: uma consulta por tipo, ordem preservada.
- `apps/api/src/servicos/crm/nomes.ts` — `criarServicoDeNomes`: Papel por tipo, teto, lista vazia.
- `apps/api/src/rotas/crm/nomes.ts` — `POST /crm/nomes`, `NOMES_DOS_ALVOS` `.strict()`.
- `apps/api/src/rotas/crm/index.ts` — registro de `rotasDeNomes` e a opção `nomes`.
- `apps/api/src/servicos/crm/atividades.ts` — passa a exportar `RECURSO_DO_TIPO` e `ehTipoDoCrm` (sem mudar comportamento).
- `apps/web/src/dados/crm/nomes.ts` — `useNomesDoCrm`, `chaveDeNomes`, `nomeDe`.
- Testes: `servicos/crm/nomes.test.ts` (Postgres local), `rotas/crm/nomes.test.ts` (serviço falso), `dados/crm/nomes.test.ts` (jsdom), `crm/nomes.test.ts` (domínio).
- `CONTEXT.md` de `apps/api/src/rotas`, `apps/web` e `packages/dominio` dizem o que a rota devolve e quem decide o `null`.

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: o nome não filtra por estado (a lixeira ainda tem nome), Contato mesclado responde o nome dele, Membro removido recebe tudo `null`, e o mapa tipo → recurso de permissão é compartilhado com o serviço de Atividades.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture de Empresa no teste do serviço**
- **Found during:** Task 1 (RED)
- **Issue:** inserir uma Empresa por SQL puro falha no commit (`precisa de ao menos um Contato admin vigente`, constraint trigger deferido da 007).
- **Fix:** `semearEmpresa` cria a Empresa e o vínculo `contato_empresa` com `admin = true` na mesma instrução (CTE).
- **Files modified:** `apps/api/src/servicos/crm/nomes.test.ts`
- **Commit:** `8e2b0f9`

**2. [Rule 2 - Missing critical] Teto e tipo conferidos de novo no serviço**
- **Found during:** Task 1
- **Issue:** o plano põe o teto de 200 no zod da rota, mas o serviço também é chamado sem a rota (T-15-30: "uma consulta por tipo" só segura o DoS se o lote for limitado onde quer que entre).
- **Fix:** o serviço recusa mais de `NOMES_MAXIMO` e tipo desconhecido com 400 (`campo: "alvos"`); caso `(i)` do teste.
- **Files modified:** `apps/api/src/servicos/crm/nomes.ts`
- **Commit:** `434cc74`

**Total deviations:** 2 auto-fixed (1 bloqueio de fixture, 1 correção de segurança). **Impact:** nenhum no contrato do plano.

## Known Limitation (registrada em `.planning/WINDOWS.md`)

- **Membro `suspenso` recebe 403 em `POST /crm/nomes`.** A rota é leitura, mas é POST e herda `recusarSuspensoNaEscrita` (WR-03 segue aberto, D-15-07), como o resumo da Tarefa conversacional. O plano já previa isso; o `useNomesDoCrm` devolve `erro` e o mapa fica vazio, e `nomeDe` devolve `undefined`. Quem consumir (15-21, Contas a receber) mostra o id enquanto o WR-03 não liberar leituras por POST. Linha `deviation` aberta registrada.
- **WINDOWS #13 (15-08, ancorar Chat em Negócio/Contato/Empresa/Conversa nomeia pelo id até o 15-21 mandar nomes) continua ABERTO:** esta rota e este hook existem, mas nenhuma tela os chama ainda; quem passa a chamá-los é o 15-21.

## Known Stubs

Nenhum. `useNomesDoCrm` ainda não tem chamador (é o contrato que o 15-21 e as telas de Contas a receber vão usar), o que é o escopo do plano e não um stub.

## Threat Flags

Nenhum. A superfície nova (`POST /crm/nomes`) é a do threat model do plano: T-15-29 (Espaço da sessão em toda consulta, `podeNoCrm` por tipo, `null` para tipo negado e id desconhecido, casos entre Espaços) e T-15-30 (teto 200 no zod e no serviço, uma consulta por tipo) estão mitigados e provados.

## Verification

- Task 1 (`<automated>`, contêiner novo `crm-n1-pg-1510`, porta 55710, duas URLs explícitas, migração 001–012): `nomes.test.ts` 10/10; junto de `atividades.test.ts` (serviço e rota) e `tarefas-conversacionais.test.ts`: 98/98.
- Task 2 (`<automated>`): domínio 2/2, rota 15/15, web 10/10; `tsc --noEmit` limpo em dominio, api e web; `eslint` limpo no arquivo novo da web; `verificar:tokens` 0 falhas.
- Contêiner parado ao fim.

## Self-Check: PASSED

Arquivos criados conferidos no disco; commits `8e2b0f9`, `434cc74`, `dc06f09` presentes no ramo.
