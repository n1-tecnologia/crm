---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 08
subsystem: crm
tags: [postgres, fastify, zod, pg, vitest, negocios, funil, regras-de-encerramento]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-02: exigir/resolverProprietario/semearMembro e podeNoCrm; 07-03: comTransacao/traduzirErroDePg e repositorio de Contato; 07-04: repositorio de Funis (obter, obterEtapa, listarEtapas, funilPadrao) e etapaInicial; 07-05: repositorio de Empresa e Empresa na lixeira"
provides:
  - "@n1/dominio/crm/negocios: tipos de Negocio e validarValor, validarNovoNegocio, validarEdicao, validarMovimento, validarGanho, validarPerda, validarReabertura, probabilidadeEfetiva, valorPonderado, VALOR_DECIMAL, MOEDA"
  - "repositorios/crm/negocios.ts (criarRepositorioDeNegociosPg): listar com nomes e probabilidade efetiva, obter, inserir, atualizar, mover, encerrar, reabrir, definirEstado, excluir"
  - "ServicoDeNegocios + criarServicoDeNegocios com D-05 (NEGOCIO_EXIGE_VALOR/MOTIVO), D-14 (reabrir ganho so por administracao), RN-NEG-03, RN-NEG-16 e RN-NEG-18"
  - "rotasDeNegocios (12 rotas) registrada em rotasDeCrm; OpcoesDeCrm.negocios — os quatro recursos do CRM (Contato, Empresa, Funil, Negocio) no ar"
affects: [07-10, 07-11, 07-13]

actuals:
  tokens: 32600
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Papel conferido duas vezes em reabrir: antes da transacao (Convidado nunca descobre o corpo) e de novo com a situacao do Negocio lido for update (D-14, T-07-26)"
    - "Regra de encerramento lida do Funil na MESMA transacao e aplicada pelo dominio (validarGanho/validarPerda); a falha vira 409 com codigo e campo para a tela marcar o Field"
    - "Busca devolve {falha} | {registro}: o servico retorna a recusa pronta e o TypeScript estreita pela ausencia de falha"
    - "Troca de dono grava empresa_id e contato_id no mesmo UPDATE; mover grava funil, etapa e probabilidade=null juntos (FK composta)"

key-files:
  created:
    - packages/dominio/src/crm/negocios.ts
    - packages/dominio/src/crm/negocios.test.ts
    - apps/api/src/repositorios/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.test.ts
    - apps/api/src/rotas/crm/negocios.ts
    - apps/api/src/rotas/crm/negocios.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "Empresa so recebe Negocio novo (ou trocado) quando esta ativa (RN-NEG-06/RN-EMP-08): arquivada tambem e 409 EMPRESA_INATIVA, alem da lixeira que o plano citava. Contato segue o plano: so na lixeira e recusado (RN-CON-19 deixa o arquivado referenciavel)"
  - "Restaurar Negocio aberto recusa tambem Funil nao ativo (409 FUNIL_INATIVO, INV-NEG-03/RN-FUN-14), alem da Empresa na lixeira de RN-NEG-18; a Empresa e conferida para qualquer origem (arquivado ou lixeira)"
  - "Empresa XOR Contato e barrado em tres camadas: refine no corpo de POST /negocios (400), validarNovoNegocio (400 DONO_INVALIDO), e na edicao 409 DONO_INVALIDO (depende do dono gravado) com negocios_dono_ck como rede"
  - "Corpos de ganhar, perder e reabrir sao todos nullish: sem corpo e sem content-type o Fastify 5 entrega null (Pitfall 4); o plano so previa isso para reabrir"
  - "Mover recusa Negocio perdido, nao so ganho (RN-NEG-04: em ganho/perdido a Etapa nao muda): 409 NEGOCIO_ENCERRADO para os dois"
  - "valorPonderado calcula em centavos (Math.round(valor*100) * prob / 100) para nao acumular erro de ponto flutuante; devolve number"

patterns-established:
  - "Codigos de recusa alem da lista do plano, na linha da tabela 'Recusas 409' do UI-SPEC: DONO_INVALIDO, NEGOCIO_ABERTO, NEGOCIO_FORA_DA_LIXEIRA, TRANSICAO_INVALIDA, FUNIL_NAO_ENCONTRADO, ETAPA_NAO_ENCONTRADA, EMPRESA_NAO_ENCONTRADA, CONTATO_NAO_ENCONTRADO, NEGOCIO_NAO_ENCONTRADO"
  - "RED de servico com interface completa devolvendo 404 pendente; RED de rota com OpcoesDeCrm.negocios e sem o arquivo de rotas; repositorio e rotas entram so no GREEN"

requirements-completed: [CRM-D1, CRM-A1, CRM-A3]

duration: 10 min
completed: 2026-10-10
plan_head_before: 5f809896ba02eeab964e2d50632c1c964713c4af
plan_head_after: 4bdc4034246e69983102761ab0fa5e036b97eb54
commits: 6
status: complete

coverage:
  - id: D1
    description: "Regras de Negocio no dominio: Empresa OU Contato, valor decimal em texto, moeda e probabilidade, movimento (RN-NEG-04/16, RN-FUN-14/15, INV-FUN-06), ganho e perda com as Regras de encerramento (D-05), reabertura (RN-FUN-14), probabilidade efetiva (INV-NEG-09), valor ponderado e edicao"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/negocios.test.ts (casos a-g, 36 testes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Criar Negocio sem Funil usa o Funil padrao e a Etapa de menor ordem; sem padrao no Espaco 409 SEM_FUNIL_PADRAO; Funil arquivado, Etapa de outro Funil, Empresa/Contato na lixeira e referencias de outro Espaco recusados; valor e data civil voltam como texto"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(a), (b) e (c) contra Postgres 16 local, TZ=America/Sao_Paulo e TZ=UTC"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mover de Etapa zera a probabilidade sobrescrita e exige Funil ativo; ganhar sem valor e perder sem motivo (Regras de encerramento do Funil) sao 409 NEGOCIO_EXIGE_VALOR/MOTIVO e nada muda; encerrar grava encerrado_em e zera a probabilidade"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(d) e (e)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-14: Membro reabre perdido mas recebe 403 ao reabrir ganho (a situacao vem do banco, nao do corpo); Administrador reabre ganho; reabrir limpa motivo, nota e encerrado_em; reabrir em Funil arquivado exige destino ativo"
    requirement: CRM-A3
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(f) (2 casos); apps/api/src/rotas/crm/negocios.test.ts#(e)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ciclo de vida (D-06): Negocio arquivado e somente leitura (NEGOCIO_INATIVO), restaurar da lixeira com Empresa na lixeira e 409 EMPRESA_NA_LIXEIRA, exclusao permanente so da lixeira"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(g)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Leitura do quadro: listar por Funil, situacao e estado com Empresa/Contato nomeados e probabilidade efetiva, busca por titulo com % literal, paginacao; Negocio de outro Espaco e 404; Convidado le e e 403 em toda escrita"
    requirement: CRM-A3
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/negocios.test.ts#(h) (2 casos)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Contrato REST de Negocio: 12 rotas, corpos .strict() sem situacao/encerradoEm/estado/criadoPor, valor so como texto decimal, filtros validados, corpos opcionais sem content-type e 403/409 passando intactos; o ciclo inteiro por app.inject com o servico real"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/negocios.test.ts (a)-(e), 15 testes, 13 sem banco + 2 com banco"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 08: Negocios no backend Summary

**CRUD REST de Negocio com Empresa OU Contato, Funil padrao e Etapa inicial por omissao e as acoes do quadro (mover, ganhar, perder, reabrir) aplicando as Regras de encerramento do Funil lidas no banco (D-05) e a restricao de reabrir `ganho` so por administracao com a situacao tirada do Negocio gravado (D-14).**

## Performance

- **Duration:** 10 min (cronometrado da subida do Postgres `crm-n1-pg-0708` ate o fim da verificacao; a leitura inicial do contexto foi feita antes e nao entra)
- **Started:** 2026-10-10T03:42Z
- **Completed:** 2026-10-10T03:52Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 8 (7 criados, 1 modificado)

## Accomplishments

- **Dominio** (`crm/negocios.ts`): tipos camelCase da 007 sem `workspaceId`, `valor` como texto decimal (`VALOR_DECIMAL = /^\d{1,13}(\.\d{1,2})?$/` cabe em `numeric(15,2)`) e datas `AAAA-MM-DD`. `validarNovoNegocio` (Empresa XOR Contato, valor, moeda, probabilidade, data real), `validarEdicao` (so `ativo`, troca de dono sem deixar os dois ou nenhum), `validarMovimento` (aberto e ativo, Funil de destino ativo, Etapa do Funil, Etapa explicita para trocar de Funil), `validarGanho`/`validarPerda` (Regra do Funil: valor efetivo > 0, motivo nao vazio, com `field` `valor`/`motivoPerda`), `validarReabertura` (Funil arquivado exige destino ativo) e `probabilidadeEfetiva`/`valorPonderado`.
- **Repositorio:** `criarRepositorioDeNegociosPg` com todo `WHERE` por `workspace_id = $1`, `valor::text` e `data_prevista_fechamento::text`, lista com `left join` de Empresa/Contato (nome de exibicao na propria consulta) e `probabilidade_padrao` da Etapa, troca de dono num `UPDATE` so, `mover` gravando funil+etapa+`probabilidade = null`, `encerrar` com `encerrado_em = now()` e `reabrir` limpando motivo, nota e momento.
- **Servico:** 12 operacoes. Toda escrita passa por `exigir(..., "negocio")` antes de abrir a transacao e carrega o Negocio `for update`; em `reabrir` o Papel e conferido de novo com `{ situacao: negocio.situacao }` (D-14). `criar`: Funil informado ou `funilPadrao` (RN-NEG-03), Etapa informada ou `etapaInicial` (RN-FUN-06), `resolverProprietario`, `criado_por` = sessao. `ganhar`/`perder` leem o Funil na transacao e devolvem 409 `NEGOCIO_EXIGE_VALOR`/`NEGOCIO_EXIGE_MOTIVO` com `campo`. `restaurar` recusa Empresa na lixeira (RN-NEG-18). `FRASES` traduz `negocios_dono_ck`, `negocios_encerramento_ck`, `negocios_motivo_perda_ck`, `negocios_motivo_ganho_ck` e as FKs compostas sem expor o nome do constraint.
- **Rotas:** as 12 rotas do contrato, corpos `.strict()`, `valor` so texto decimal, `QUERY_LISTA` estendida com `funilId`, `situacao`, `empresaId`, `contatoId` (limite ate 200 para o quadro), `rotasDeCrm` monta `criarServicoDeNegocios` por padrao e aceita `OpcoesDeCrm.negocios`. Os quatro recursos do CRM estao no ar.
- Verificado contra Postgres 16 local (container `crm-n1-pg-0708`, porta 55478, removido ao fim): `src/rotas/crm src/servicos/crm src/repositorios/crm src/app.test.ts` = 11 arquivos, 164 testes, nenhum pulado; o servico de Negocios tambem passa com `TZ=UTC`; dominio `src/crm` = 6 arquivos, 616 testes; `npm run typecheck` verde nos tres workspaces.

## Task Commits

1. **Task 1: Regras de Negocio no dominio**
   - RED `7824274` (test) - GREEN `ce522bd` (feat)
2. **Task 2: Repositorio e servico de Negocios, com encerramento e reabertura (D-05, D-14)**
   - RED `adedbdf` (test) - GREEN `1f54fd7` (feat)
3. **Task 3: Rotas REST de Negocio, registradas em rotasDeCrm**
   - RED `43c5b01` (test) - GREEN `4bdc403` (feat)

Base do plano (HEAD anterior ao primeiro commit): `5f809896ba02eeab964e2d50632c1c964713c4af`.

**Plan metadata:** commit `docs(07-08)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/negocios.ts`, `negocios.test.ts` - tipos e regras puras (36 testes)
- `apps/api/src/repositorios/crm/negocios.ts` - repositorio pg de Negocios
- `apps/api/src/servicos/crm/negocios.ts`, `negocios.test.ts` - servico e 12 casos contra Postgres local
- `apps/api/src/rotas/crm/negocios.ts`, `negocios.test.ts` - 12 rotas e 15 testes (servico falso e banco)
- `apps/api/src/rotas/crm/index.ts` - `OpcoesDeCrm.negocios` e registro de `rotasDeNegocios`

## Decisions Made

Ver `key-decisions` no cabecalho. Em resumo: Empresa so ativa recebe Negocio (RN-NEG-06), restaurar tambem confere o Funil (INV-NEG-03), Empresa XOR Contato barrado em tres camadas, corpos de `ganhar`/`perder`/`reabrir` opcionais e `mover` recusa Negocio perdido alem do ganho.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Restaurar Negocio aberto recusa Funil nao ativo**
- **Found during:** Task 2 (servico, `restaurar`)
- **Issue:** o plano so pedia a recusa por Empresa na lixeira (RN-NEG-18); restaurar um Negocio aberto cujo Funil esta arquivado quebraria INV-NEG-03 ("nenhum Negocio aberto referencia Funil arquivado") e a ontologia exige mover no ato.
- **Fix:** `restaurar` devolve 409 `FUNIL_INATIVO` (campo `funilId`) quando o Negocio e `aberto` e o Funil nao esta `ativo`. A tela de "mover no ato" nao existe nesta fase; a saida e restaurar o Funil.
- **Files modified:** `apps/api/src/servicos/crm/negocios.ts`
- **Verification:** o caminho nao tem caso proprio; a regra e uma checagem a mais depois da de Empresa e os 12 casos do servico seguem verdes (ver Known Gaps).
- **Committed in:** `1f54fd7`

**2. [Rule 2 - Missing Critical] Empresa arquivada tambem nao recebe Negocio novo**
- **Found during:** Task 2 (servico, `conferirEmpresa`)
- **Issue:** o plano citava so `na_lixeira`, mas RN-NEG-06/RN-EMP-08 dizem "so uma Empresa ativa" pode receber Negocio novo ou ser definida como dona.
- **Fix:** `conferirEmpresa` exige `estado = 'ativo'` (409 `EMPRESA_INATIVA`); so na criacao e quando a Empresa e trocada na edicao — uma referencia que ja existe sobrevive ao arquivamento.
- **Files modified:** `apps/api/src/servicos/crm/negocios.ts`
- **Verification:** `negocios.test.ts#(b)` (lixeira) e `#editar` (troca para Empresa na lixeira) passam; a Empresa arquivada nao tem caso proprio (ver Known Gaps).
- **Committed in:** `1f54fd7`

**3. [Rule 2 - Missing Critical] Refine de Empresa XOR Contato tambem no corpo da rota**
- **Found during:** Task 3 (rotas)
- **Issue:** sem isso o 400 de "os dois ou nenhum" so apareceria depois de passar pelo Papel e pelo servico; a tela de 07-10/07-11 ganha o 400 de forma na borda, como nos outros recursos.
- **Fix:** `.refine` no `NOVO_NEGOCIO` com a frase "Um Negocio e de uma Empresa ou de um Contato."
- **Files modified:** `apps/api/src/rotas/crm/negocios.ts`
- **Verification:** `rotas/crm/negocios.test.ts#(a) exige Empresa OU Contato`.
- **Committed in:** `4bdc403`

---

**Total deviations:** 3 auto-fixed (3 Rule 2 — regras de ontologia que o plano nao listava)
**Impact on plan:** nenhum escopo novo; todas aplicam RN-NEG-06, INV-NEG-03 e a fronteira de forma ja usada em Contato/Empresa/Funil.

### Registros (nao sao correcoes de codigo)

1. **Evidencia de RED.** Seguindo 07-02..07-05, cada fase usou um alvo cuja falha e de uma linha, executado isoladamente com `-t`, e todos deram `RED_EVIDENCE_OK` no classificador: dominio "aceita titulo com um Contato" (esqueleto devolve `fail("pendente")`, `expected false to be true`); servico "criar sem Funil cai no padrao e na Etapa..." (esqueleto devolve 404 `pendente`, o `valor()` do teste lanca `esperava sucesso, veio 404 PENDENTE: pendente`); rotas "POST /negocios com situacao, encerradoEm, estado, criadoPor ou workspaceId responde 400" (rota inexistente, `expected 404 to be 400`). O registro de evidencia ficou em `.planning/red-tmp/` (dentro do projeto, que o classificador exige) e foi apagado antes de cada commit.
2. **Armadilha do `-t`.** O padrao de `-t` e regex: o nome do alvo comecando com `(a) ...` nao casa como texto literal, e o vitest rodou 0 testes (exit 0, `unexpected_green`). O alvo passou a ser dado sem o prefixo entre parenteses.
3. **RED com esqueleto.** O RED do dominio levou os tipos completos e as funcoes devolvendo `fail("pendente")`; o do servico levou a interface completa devolvendo 404 `pendente` (o repositorio ficou sem commit ate o GREEN); o das rotas levou so `OpcoesDeCrm.negocios`, sem o arquivo de rotas.
4. **Funcoes e codigos alem da lista do plano.** `FunilDeNegocio` (tipo do Funil que o dominio consome), e os codigos `DONO_INVALIDO`, `NEGOCIO_ABERTO`, `NEGOCIO_FORA_DA_LIXEIRA`, `TRANSICAO_INVALIDA`, `FUNIL_NAO_ENCONTRADO`, `ETAPA_NAO_ENCONTRADA`, `EMPRESA_NAO_ENCONTRADA`, `CONTATO_NAO_ENCONTRADO` e `NEGOCIO_NAO_ENCONTRADO` completam o que o plano chamou so de "409"/"404", na linha da tabela "Recusas 409" do UI-SPEC.
5. **Guarda de branch protegida.** Como em 07-01..07-07, os commits foram feitos em `main` por decisao do orquestrador (`branching_strategy: none`).
6. **Suite de `apps/api` inteira nao foi rodada** (`lote-contas-a-pagar.test.ts` falha contra o banco remoto, fora do escopo). Verificacao escopada a `src/rotas/crm src/servicos/crm src/repositorios/crm src/app.test.ts` com Postgres local, mais dominio `src/crm` e `npm run typecheck`.

## Issues Encountered

Nenhum alem do registro 2 (padrao de `-t` tratado como regex).

## Known Gaps

- **Sem caso de teste proprio:** restaurar Negocio aberto com Funil arquivado (deviation 1) e Empresa arquivada como dona de Negocio novo (deviation 2). Ambos sao checagens de uma linha sobre estados que os testes ja exercitam de lado (Funil arquivado em criar/mover, Empresa na lixeira em criar/editar/restaurar).
- **RN-NEG-06 (trocar a Empresa de Negocio `ganho`/`perdido` exige administrar)** nao foi diferenciada: a matriz D-14 de `podeNoCrm` nao tem essa acao, e o plano a deixou fora. Hoje quem pode `editar` pode trocar o dono de um Negocio encerrado.
- **Registro de Atividade das acoes (RN-NEG-15)** segue Deferred, como o plano ja previa: a 007 nao tem tabela de atividade.
- **Controle otimista (T-07-29):** last-write-wins; `atualizado_em` pode virar ETag depois.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: as 12 rotas ficam dentro do limite de confianca "navegador -> /negocios/*" do threat model do plano (T-07-26 a T-07-29), todas com Papel conferido no servico e referencias lidas por `workspace_id` da sessao.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-10 (quadro) e 07-11 (ficha) consomem o contrato REST desta entrega; os codigos `NEGOCIO_EXIGE_VALOR`/`NEGOCIO_EXIGE_MOTIVO` (com `campo`), `NEGOCIO_ENCERRADO`, `NEGOCIO_INATIVO`, `FUNIL_INATIVO`, `ETAPA_INVALIDA` e `SEM_FUNIL_PADRAO` seguem a tabela "Recusas 409" do UI-SPEC.
- 07-13 ainda precisa conferir `plataforma.migracoes` antes do primeiro `migrar` real (a 007 ja corrigida em 07-05).
- Sem bloqueios.

## Self-Check: PASSED

- Arquivos criados existem (7) e `rotas/crm/index.ts` foi modificado.
- Os 6 commits de tarefa (`7824274`, `ce522bd`, `adedbdf`, `1f54fd7`, `43c5b01`, `4bdc403`) sao ancestrais de HEAD.
- Criterios de aceitacao reexecutados: `validarGanho` e `probabilidadeEfetiva` exportadas (1 cada), `valor::text` no repositorio (2), `workspace_id = $1` no repositorio (10), `situacao: negocio.situacao` no servico (1), `rotasDeNegocios` no index (2), `"/negocios/:id/mover"` e `"/negocios/:id/reabrir"` nas rotas (1 cada).

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
