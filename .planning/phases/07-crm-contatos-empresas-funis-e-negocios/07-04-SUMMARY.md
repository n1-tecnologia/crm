---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 04
subsystem: crm
tags: [fastify, pg, zod, funis, etapas, lixeira, migracao-de-negocios, vitest]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-01: ResultadoCrm, repositorio pg, banco-crm.ts, rotas/crm/comum; 07-02: podeNoCrm, exigir, comTransacao/traduzirErroDePg, semearMembro; 07-03: sql.ts (contemTexto)"
provides:
  - "@n1/dominio/crm/funis: Funil, Etapa, NovoFunil, EdicaoDeFunil, FunilDetalhado, ContagemDeNegocios, MapeamentoDeEtapas, LIMITE_DE_ETAPAS_POR_FUNIL, validarNovoFunil, validarNomeDeEtapa, validarProbabilidadeDeEtapa, etapaInicial, validarReordenacao, validarRemocaoDeEtapa, validarMudancaDeEstado, validarPrivacidade, deveNascerPadrao, validarNovoPadrao, validarMigracao, fraseFunilComNegocios, fraseEtapaComNegocios, fraseFunilComNegociosAbertos, chaveDeNome"
  - "repositorios/crm/funis.ts: RepositorioDeFunis + criarRepositorioDeFunisPg (funilPadrao() e contarNegocios() para 07-08)"
  - "servicos/crm/funis.ts: ServicoDeFunis + criarServicoDeFunis e os codigos FUNIL_NOME_EM_USO, ETAPA_NOME_EM_USO, FUNIL_PADRAO, FUNIL_PRIVADO, FUNIL_INATIVO, ORDEM_EM_CONFLITO, ORDEM_INVALIDA, ETAPA_COM_NEGOCIOS, ULTIMA_ETAPA, FUNIL_COM_NEGOCIOS, FUNIL_COM_NEGOCIOS_ABERTOS, MIGRACAO_INVALIDA, ETAPA_DESTINO_INVALIDA, LIMITE_DE_ETAPAS, FUNIL_FORA_DA_LIXEIRA, TRANSICAO_INVALIDA"
  - "rotas/crm/funis.ts: rotasDeFunis (15 rotas) e OpcoesDeCrm.funis"
affects: [07-07, 07-08]

actuals:
  tokens: 29308
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Reordenar Etapas e UM UPDATE ... SET ordem = CASE id WHEN ... END; deslocar e recompactar tambem sao um comando so (etapas_ordem_uq e deferrable initially immediate: conferida no fim do comando)"
    - "Decisao do Funil padrao serializada por pg_advisory_xact_lock(hashtext('funil-padrao:<ws>')) dentro da transacao; o indice parcial funis_padrao_uq (nao deferrable) e a rede"
    - "Pre-checagem para o 409 rico (D-07) e FRASES por constraint como rede contra corrida; bloqueios.negocios = { total, itens: [] }"
    - "Migracao de Negocios: um UPDATE por par com funil_id e etapa_id juntos (a FK composta exige)"

key-files:
  created:
    - packages/dominio/src/crm/funis.ts
    - packages/dominio/src/crm/funis.test.ts
    - apps/api/src/repositorios/crm/funis.ts
    - apps/api/src/servicos/crm/funis.ts
    - apps/api/src/servicos/crm/funis.test.ts
    - apps/api/src/rotas/crm/funis.ts
    - apps/api/src/rotas/crm/funis.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "Valor mal formado (nome vazio, probabilidade fora de 0..100, Funil sem Etapa) e 400 VALOR_INVALIDO com o campo; regra de negocio e 409 com codigo (mesma linha de 07-03)"
  - "Editar atributos e Etapas de Funil so quando ativo: arquivado ou na lixeira e 409 FUNIL_INATIVO (restaurar e o caminho), como Contato"
  - "ContagemDeNegocios e disjunta: abertos/ganhos/perdidos contam so Negocios ativos por situacao, arquivados e naLixeira contam por estado em qualquer situacao; total e a soma. A recusa de arquivar (RN-FUN-12) usa outra contagem: situacao = aberto em qualquer estado"
  - "Remapear (RN-FUN-08) so troca etapa_id: a probabilidade que o Negocio sobrescreveu fica intacta; um Negocio sem sobrescrita passa a usar a probabilidade da Etapa de destino (RN-FUN-18)"
  - "definirPadrao devolve 409 FUNIL_INATIVO (arquivado/lixeira) ou FUNIL_PRIVADO; chamar de novo no Funil que ja e padrao e idempotente"
  - "Remocao de Etapa checa ULTIMA_ETAPA antes de ETAPA_COM_NEGOCIOS: com uma Etapa so, remapear nao ajuda"

patterns-established:
  - "escrita()/escritaDeEtapa() no servico de Funis: exigir -> validar sem banco -> comTransacao -> Funil travado (for update) -> 404 se nao e deste Espaco"
  - "RED de rota por servico falso que registra chamadas; o ciclo completo vai no bloco describeComBanco"

requirements-completed: [CRM-D1, CRM-A1, CRM-A2]

duration: 11 min
completed: 2026-10-10
plan_head_before: a9023723b78a2ac94c4c4240f26d0331660d36eb
plan_head_after: 49eb2a7002d502e3c8a932df34f60727b402d48b
commits: 6
status: complete

coverage:
  - id: D1
    description: "Regras puras de Funil/Etapa no dominio (criacao atomica RN-FUN-04, nomes RN-FUN-03, reordenacao, ultima Etapa, Funil padrao RN-FUN-16 e D-13, migracao, frases de D-07), as mesmas para a tela e a api"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/funis.test.ts (casos a-i, 35 testes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Funil padrao que nasce sozinho (D-13), criacao atomica com Etapas ordem 1..n, nome unico entre ativos e arquivados, definir padrao em transacao"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/funis.test.ts#(a), (b), (c) contra Postgres 16 local"
        status: pass
    human_judgment: false
  - id: D3
    description: "Etapas: posicao com deslocamento, nome unico no Funil, reordenacao e recompactacao em um comando, edicao"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/funis.test.ts#(d), (k)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-07: Etapa ou Funil com Negocio (qualquer situacao/estado, inclusive lixeira) e 409 com bloqueios.negocios.total; ULTIMA_ETAPA; remapear e migrar resolvem; destino de outro Espaco e 404"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/funis.test.ts#(e), (f), (g), (h)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-14 e isolamento: Membro recebe 403 em toda escrita (13 operacoes), Convidado le, Funil de outro Espaco e 404, privado so gravado"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/funis.test.ts#(i), (j)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Contrato REST de Funil/Etapa: corpos .strict() sem padrao (T-07-14), tetos de 40 (T-07-16), rotas sem corpo, 409 com codigo e bloqueios intactos, ciclo do Administrador por app.inject e 403 de Membro"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/funis.test.ts (19 testes: 17 sem banco, 2 com banco)"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 04: Funis e Etapas no backend Summary

**CRUD REST de Funil e Etapa sobre o Postgres, com o Funil padrao que nasce sozinho (D-13), configuracao restrita a Administrador/Proprietario (D-14), reordenacao em um unico UPDATE, e as recusas 409 de D-07 com os dois caminhos de resolucao que as telas vao chamar (remapear Etapa e migrar Negocios de Funil).**

## Performance

- **Duration:** ~11 min (cronometrado a partir da subida do Postgres, ate a ultima verificacao; a leitura inicial do contexto nao foi cronometrada)
- **Completed:** 2026-10-10T02:21Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 8 (7 criados, 1 modificado)

## Accomplishments

- **Dominio:** `crm/funis.ts` com os tipos camelCase da 007 (sem `workspaceId`; `EdicaoDeFunil` nao declara `padrao`), as regras puras e as tres frases de 409 que citam a contagem e apontam o caminho (migrar/remapear). Comparacao de nome por `trim().toLocaleLowerCase("pt-BR")`, a mesma de `lower(btrim(nome))`. `LIMITE_DE_ETAPAS_POR_FUNIL = 40` fica no dominio para a rota e a tela usarem o mesmo teto.
- **Repositorio:** `criarRepositorioDeFunisPg` com todo `WHERE` por `workspace_id = $1`; listagem com `totalEtapas` e `negociosAbertos` por subconsulta; `listarEtapas` com as contagens por `count(*) filter` agrupadas por Etapa; `reordenar` em um `UPDATE ... CASE`; `deslocarOrdens` e a recompactacao apos remover tambem em um comando; `remapear` e `migrar` (funil e etapa no mesmo `UPDATE`); `funilPadrao` pronto para 07-08.
- **Servico:** 15 operacoes. Toda escrita passa por `exigir(..., "funil")` antes de abrir a transacao. `criar` decide o padrao com `deveNascerPadrao` dentro da transacao, sob lock consultivo por Espaco; `definirPadrao` desmarca e depois marca (o indice parcial nao e deferrable); `removerEtapa`/`enviarParaLixeira`/`excluirPermanentemente` recusam com `bloqueios.negocios`; `arquivar` recusa so Negocio `aberto` (RN-FUN-12); `remapearEtapa` e `migrarNegocios` resolvem os 409.
- **Rotas:** as 15 rotas da tabela de `<interfaces>`, corpos `.strict()` sem `padrao`, `etapas` 1..40, `etapaIds` 1..40, mapeamento ate 40 pares, nenhuma rota sem corpo declara `body`. `rotasDeCrm` monta `criarServicoDeFunis` por padrao e aceita `OpcoesDeCrm.funis` para teste.
- Verificado contra Postgres 16 local (container `crm-n1-pg-0704`, removido ao fim): `src/rotas/crm src/servicos/crm src/app.test.ts` = 6 arquivos, 107 testes, nenhum pulado (o servico tambem passa com `TZ=UTC`); dominio inteiro 76 arquivos, 1613 testes; `npm run typecheck` verde nos tres workspaces.

## Task Commits

1. **Task 1: Regras de Funil e Etapa no dominio**
   - RED `34e45c9` (test) - GREEN `390a27a` (feat)
2. **Task 2: Repositorio e servico de Funis, com D-07, D-13 e D-14**
   - RED `5795308` (test) - GREEN `984b771` (feat)
3. **Task 3: Rotas REST de Funil e Etapa, registradas em rotasDeCrm**
   - RED `c64e518` (test) - GREEN `49eb2a7` (feat)

Base do plano (HEAD anterior ao primeiro commit): `a9023723b78a2ac94c4c4240f26d0331660d36eb`.

**Plan metadata:** commits `docs(07-04)` seguintes a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/funis.ts`, `funis.test.ts` - tipos e regras puras (35 testes)
- `apps/api/src/repositorios/crm/funis.ts` - repositorio pg de Funis, Etapas, contagem, remapeamento e migracao
- `apps/api/src/servicos/crm/funis.ts`, `funis.test.ts` - servico e 11 casos contra Postgres local
- `apps/api/src/rotas/crm/funis.ts`, `funis.test.ts` - 15 rotas e 19 testes (servico falso e banco)
- `apps/api/src/rotas/crm/index.ts` - `OpcoesDeCrm.funis` e registro de `rotasDeFunis`

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: forma invalida e 400 `VALOR_INVALIDO`, regra e 409; Funil arquivado/na lixeira nao se edita (`FUNIL_INATIVO`); a contagem de Negocios por Etapa e disjunta; remapear nao toca a probabilidade que o Negocio sobrescreveu.

## Deviations from Plan

### Auto-fixed Issues

None - o codigo foi escrito como o plano descreve. O unico ajuste durante a execucao foi de teste (ordem alfabetica numa asserção do caso (c)), corrigido antes do commit GREEN.

### Registros (nao sao correcoes de codigo)

1. **Evidencia de RED.** Seguindo 07-02/07-03, cada fase usou um alvo cuja falha e de uma linha, executado isoladamente com `-t`, e todos deram `RED_EVIDENCE_OK` no classificador: dominio "aceita um Funil com uma Etapa" (esqueleto devolve `fail("pendente")`); servico "(a) D-13: o primeiro Funil nao privado nasce padrao..." (esqueleto devolve 404 `pendente`, o `valor()` do teste lanca uma linha); rotas "(a) POST /funis com padrao no corpo responde 400" (rota inexistente, 404). O registro de evidencia teve de ficar dentro do diretorio do projeto (o classificador recusa caminho fora dele) e foi apagado depois.
2. **RED com esqueleto.** O RED do dominio levou os tipos completos e as funcoes devolvendo `fail("pendente")`; o do servico levou a interface completa com cada metodo devolvendo 404 `pendente`; o das rotas levou `OpcoesDeCrm.funis` e o servico montado, sem `rotasDeFunis` (o arquivo de rotas ficou fora do commit RED). O repositorio e as rotas entraram so no GREEN.
3. **Funcoes e codigos alem da lista do plano.** `chaveDeNome` e `validarProbabilidadeDeEtapa` (dominio) e `travarPadrao`/`nomeEmUso` (repositorio) sao auxiliares que a lista nominal nao trazia; os codigos `FUNIL_PRIVADO`, `FUNIL_INATIVO`, `ORDEM_INVALIDA`, `MIGRACAO_INVALIDA`, `ETAPA_DESTINO_INVALIDA`, `LIMITE_DE_ETAPAS`, `FUNIL_FORA_DA_LIXEIRA` e `TRANSICAO_INVALIDA` completam o que o plano chamou so de "409". `FUNIL_INATIVO` e `ETAPA_NAO_ENCONTRADA`/`FUNIL_NAO_ENCONTRADO` seguem a tabela "Recusas 409" do UI-SPEC e o padrao de Contato.
4. **`removerEtapa` do repositorio recebe `funilId`** (alem do `etapaId`) para recompactar as ordens do Funil na mesma chamada; a assinatura nominal do plano nao o trazia.
5. **Guarda de branch protegida.** Como em 07-01..07-03, os commits foram feitos em `main` por decisao do orquestrador (`branching_strategy: none`); `git.allow_default_branch_commits` nao foi alterado.
6. **Suite de `apps/api` inteira nao foi rodada** (dezenas de minutos; `lote-contas-a-pagar.test.ts` falha contra o banco remoto, fora do escopo). Verificacao escopada a `src/rotas/crm src/servicos/crm src/app.test.ts` com Postgres local, mais dominio inteiro e `npm run typecheck`.

**Total deviations:** 0 auto-fixed. **Impact:** nenhum no escopo.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0704` foi removido ao fim (`docker ps -q --filter name=crm-n1-pg-0704` vazio).

## Known Stubs

None.

## Threat Flags

None - nao ha superficie nova alem da do `<threat_model>`: T-07-13 (toda escrita por `exigir(..., "funil")`; 13 operacoes dao 403 a `membro`, caso (i), e a rota (e)), T-07-14 (`padrao` fora dos esquemas `.strict()`, 400 provado nas rotas), T-07-15 (destino lido com `workspace_id` da sessao, 404 para Funil de outro Espaco, caso (g); FK composta como segunda barreira) e T-07-16 (zod `max(40)` em `etapas`, `etapaIds` e chaves do mapeamento) estao mitigados e testados.

## Next Phase Readiness

- 07-07 religa `migrate-funnel-dialog` e `remove-stage-dialog` sobre `POST /funis/:id/migrar-negocios` e `POST /etapas/:id/remapear`; os codigos de 409 e `bloqueios.negocios.total` seguem a tabela "Recusas 409" do UI-SPEC.
- 07-08 usa `criarRepositorioDeFunisPg(...).funilPadrao(workspaceId)` (RN-NEG-03) e `listarEtapas` para a Etapa inicial (`etapaInicial` no dominio).
- `apps/api/migracoes/007-crm.sql` continua nao rastreado (D-12): 07-05 o edita e a fase o commita.

## Self-Check: PASSED

- Arquivos criados presentes em disco (7 criados, verificados com `[ -f ]`).
- Commits `34e45c9`, `390a27a`, `5795308`, `984b771`, `c64e518`, `49eb2a7` presentes na ancestralidade de HEAD (`commits: 6` medido por `rev-list`).
- Criterios de aceitacao reexecutados e verdes: `export function deveNascerPadrao` (1), `EdicaoDeFunil` sem `padrao` (0 ocorrencias no bloco), `CASE` no repositorio (1), `workspace_id = $1` no repositorio (26), `"funil"` no servico (6), `rotasDeFunis` em `index.ts` (2), `"/funis/:id/etapas/ordem"` (1), `"/etapas/:id/remapear"` (1), 0 ocorrencias de `persistencia/`/`from "pg"` em `rotas/crm/funis.ts`, container removido.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
