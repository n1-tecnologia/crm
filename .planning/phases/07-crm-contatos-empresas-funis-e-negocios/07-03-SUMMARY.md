---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 03
subsystem: crm
tags: [fastify, pg, zod, normalizacao, identificadores, lixeira, vitest]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-01: ResultadoCrm, repositorio pg, banco-crm.ts; 07-02: podeNoCrm, exigir, resolverProprietario, comTransacao, semearMembro"
provides:
  - "@n1/dominio/crm/normalizacao: normalizarEmail/Telefone/Whatsapp/Instagram/Dominio/Documento, normalizarIdentificadorDeContato e de Empresa, PROVEDORES_PUBLICOS_DE_EMAIL"
  - "@n1/dominio/crm/comum: BloqueiosCrm.contatos, validarEnderecos, validarCamposAdicionais"
  - "@n1/dominio/crm/contatos: validarIdentificadorDeContato, primeiroDoTipo, fraseDeContatoBloqueado, fraseDeIdentificadorEmUso, ROTULO_DO_TIPO_DE_IDENTIFICADOR, EdicaoDeIdentificador"
  - "repositorios/crm/sql.ts (escaparIlike, contemTexto, CLAUSULA_ESCAPE) reaproveitavel por Empresas e Negocios"
  - "repositorios/crm/vinculos.ts: listarDoContato, empresasEmQueEhUnicoAdmin (07-05 acrescenta a escrita)"
  - "ServicoDeContatos completo: obter, editar, Identificadores, arquivar, restaurar, enviarParaLixeira (D-09), excluirPermanentemente"
  - "Rotas REST de Contato: GET/PATCH/DELETE /contatos/:id, /identificadores, /arquivar, /restaurar, /permanente"
affects: [07-04, 07-05, 07-06, 07-08]

actuals:
  tokens: 26500
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Papel primeiro, validacao de forma sem banco depois, transacao por ultimo (escrita/edicao no servico)"
    - "Servico pre-checa para o 409 rico (bloqueios) e FRASES por constraint sao a rede contra corrida"
    - "Contato carregado com select ... for update dentro da transacao antes de qualquer transicao"
    - "Busca textual: contemTexto (escapa % _ \\) + ilike ... escape '\\', texto sempre como parametro"
    - "criado_em de Identificador por clock_timestamp(): 'o mais antigo' tem ordem definida dentro da mesma transacao"

key-files:
  created:
    - packages/dominio/src/crm/normalizacao.ts
    - packages/dominio/src/crm/normalizacao.test.ts
    - packages/dominio/src/crm/contatos.test.ts
    - apps/api/src/repositorios/crm/sql.ts
    - apps/api/src/repositorios/crm/vinculos.ts
    - apps/api/src/servicos/crm/contatos.test.ts
  modified:
    - packages/dominio/src/crm/comum.ts
    - packages/dominio/src/crm/contatos.ts
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/contatos.test.ts

key-decisions:
  - "Valor mal formado (normalizacao, limites de enderecos e campos adicionais) e 400 VALOR_INVALIDO com o campo; INV-CON-01 continua 409 (como em 07-01) e a regra de negocio (RN-CON-11, D-09) e 409 com bloqueios"
  - "PATCH de Identificador nao troca o valor canonico (seria outro Identificador): so principal, verificado, valorExibido e rotuloCanal; principal:false no principal atual e 409 PRINCIPAL_OBRIGATORIO (o principal troca ao promover outro)"
  - "Vinculo com Empresa na lixeira fica oculto na ficha do Contato (contatos.md) e nao conta em empresasEmQueEhUnicoAdmin"
  - "Na edicao, texto vazio limpa a coluna (nome, data, foto...); o domínio ainda valida INV-CON-01 sobre o resultado"

patterns-established:
  - "escrita()/edicao() no servico: exigir -> validar sem banco -> comTransacao -> obter com for update -> 404 se nao e deste Espaco"
  - "RED por servico falso que registra chamadas: o teste de rota prova o contrato sem banco"

requirements-completed: [CRM-D1, CRM-A1, CRM-A2]

duration: 14 min
completed: 2026-10-10
plan_head_before: 4ec7590ca4f2029a8dd3654e80b16b296008bb5f
plan_head_after: b7f128a29497be0392483748c718c53a02a50e1f
commits: 6
status: complete

coverage:
  - id: D1
    description: "Normalizacao de Identificadores (e-mail, telefone, Instagram, dominio sem provedor publico, documento) no dominio, a mesma para a tela e para a api"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/normalizacao.test.ts (casos a-f)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Regras de Contato do dominio: validarEnderecos, validarCamposAdicionais, primeiroDoTipo e as frases de 409 (D-09, RN-CON-11)"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/contatos.test.ts (casos g-i)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criar com normalizacao, principal por tipo e data civil AAAA-MM-DD sob TZ=America/Sao_Paulo; RN-CON-11 recusa Identificador de outro Contato nomeando o detentor e aceita o mesmo valor em outro Espaco"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(a) e (b) contra Postgres local (TZ=America/Sao_Paulo e TZ=UTC)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edicao (Proprietario ativo D-11, Contato inativo, INV-CON-01), troca de principal na mesma transacao (INV-CON-03) e promocao do mais antigo ao remover o principal"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(c) e (d)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lixeira (D-06) com D-09: unico admin de Empresa ou Contato de Negocio fora da lixeira e 409 CONTATO_BLOQUEADO com bloqueios e estado inalterado; restaurar, arquivar e exclusao permanente (CONTATO_COM_NEGOCIOS, CONTATO_BLOQUEADO, cascata dos Identificadores)"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(e), (f) e (g)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Isolamento (404 em outro Espaco), busca por nome e por Identificador com % e _ literais, Convidado 403 em toda escrita"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(h) e (i)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Contrato REST de Contato: corpos .strict() com tetos de LIMITES_CRM, DELETE/POST sem corpo e sem content-type, 409 com codigo e bloqueios intactos, ciclo inteiro por app.inject"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/contatos.test.ts (a)-(f), 39 testes, 25 sem banco + 14 com banco"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 03: Contato completo no backend Summary

**CRUD REST completo de Contato sobre o Postgres, com normalizacao de Identificadores no dominio (a mesma para a tela e o endpoint), lixeira que recusa em 409 rico quando o Contato e o unico admin de uma Empresa ou o Contato de um Negocio (D-09), e Identificador ja de outro Contato recusado nomeando o detentor (RN-CON-11).**

## Performance

- **Duration:** ~14 min (o inicio exato nao foi capturado; estimado pelos horarios da primeira e da ultima execucao)
- **Completed:** 2026-10-10T02:02:22Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 12 (6 criados, 6 modificados)

## Accomplishments

- **Dominio:** `normalizacao.ts` (e-mail minusculo; telefone minimo sem biblioteca com `+55` para 10-11 digitos; Instagram sem `@`/URL; dominio sem protocolo/`www`/caminho/porta, recusando 18 provedores publicos com RN-EMP-05; documento so digitos, `documento_fiscal` exige pais). `validarEnderecos`, `validarCamposAdicionais` (T-07-10), `validarIdentificadorDeContato` (valor canonico + `valorExibido`), `primeiroDoTipo` e as frases que a api e a tela mostram nos 409. O dominio continua com `zod` como unica dependencia.
- **Repositorio:** `obter` (com `for update` opcional), `listar` com `q` (nome, sobrenome, nome completo e Identificador) por `ilike ... escape '\'`, `atualizar` com lista fixa de colunas, `definirEstado`, `excluir`, o conjunto de Identificadores (`rebaixarPrincipal`, `detentorDoIdentificador`) e `negociosDoContato` (somente leitura de `plataforma.negocios`). `vinculos.ts` traz `listarDoContato` e `empresasEmQueEhUnicoAdmin`.
- **Servico:** `criar` completo (INV-CON-01, enderecos, campos adicionais, normalizacao, RN-CON-11, principal por tipo, `modo_criacao` sempre `manual`), `editar` (so `ativo`), Identificadores como sub-recurso, `arquivar`/`restaurar`/`enviarParaLixeira` (D-09, pre-checagem dentro da transacao) e `excluirPermanentemente` (so da lixeira; Negocio em qualquer estado e Empresa sem outro admin bloqueiam). Toda escrita: Papel, validacao sem banco, transacao, Contato travado.
- **Rotas:** os 11 verbos/rotas da tabela de `<interfaces>`, corpos `.strict()`, `PATCH {}` e `PATCH` de Identificador vazio sao 400, nenhuma rota sem corpo declara `body`.
- Verificado contra Postgres 16 local (container `crm-n1-pg-0703`, removido ao fim): `src/rotas/crm src/servicos/crm src/app.test.ts` = 4 arquivos, 77 testes, nenhum pulado; o servico tambem passa com `TZ=UTC`.

## Task Commits

1. **Task 1: Normalizacao e regras de Contato no dominio**
   - RED `ab50cb5` (test) - GREEN `b049243` (feat)
2. **Task 2: Repositorio e servico de Contato completos, com D-09 e RN-CON-11**
   - RED `64b5043` (test) - GREEN `0807791` (feat)
3. **Task 3: Rotas REST de Contato completas**
   - RED `01129dc` (test) - GREEN `b7f128a` (feat)

Base do plano (HEAD anterior ao primeiro commit): `4ec7590ca4f2029a8dd3654e80b16b296008bb5f`.

**Plan metadata:** commits `docs(07-03)` seguintes a este arquivo.

## Files Created/Modified

- `packages/dominio/src/crm/normalizacao.ts`, `normalizacao.test.ts` - normalizadores e a lista de provedores publicos
- `packages/dominio/src/crm/comum.ts` - `BloqueiosCrm.contatos`, `validarEnderecos`, `validarCamposAdicionais`
- `packages/dominio/src/crm/contatos.ts`, `contatos.test.ts` - Identificador validado, principal por tipo, frases de 409, `EdicaoDeIdentificador`
- `apps/api/src/repositorios/crm/sql.ts` - `escaparIlike`, `contemTexto`, `CLAUSULA_ESCAPE`
- `apps/api/src/repositorios/crm/contatos.ts` - repositorio completo
- `apps/api/src/repositorios/crm/vinculos.ts` - vinculos do Contato e D-09
- `apps/api/src/servicos/crm/contatos.ts`, `contatos.test.ts` - servico completo e 11 casos contra Postgres
- `apps/api/src/rotas/crm/contatos.ts`, `contatos.test.ts` - rotas REST e 39 testes (servico falso e banco)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: forma invalida e 400 `VALOR_INVALIDO`, regra e 409 (INV-CON-01 segue 409 como em 07-01); o valor canonico de um Identificador nao se edita; vinculo com Empresa na lixeira fica oculto e nao conta para D-09; texto vazio limpa a coluna na edicao.

## Deviations from Plan

### Auto-fixed Issues

None - o codigo foi escrito como o plano descreve.

### Registros (nao sao correcoes de codigo)

1. **Evidencia de RED.** Como em 07-02, o reporter TAP do Vitest com falha de objeto em varias linhas e rejeitado pelo classificador como "Non-TAP data" (`INVALID_RED`, `invalid_record`). Cada fase usou um alvo cuja falha e uma asserção de uma linha, executado isoladamente com `-t`, e todos deram `RED_EVIDENCE_OK`: dominio "recusa mais que o máximo" (esqueleto devolve `ok`); servico "(c) editar muda nome e Proprietário…" (esperava sucesso, veio 404 pendente); rotas "(a) GET /contatos/c1 devolve { ok, dados }…" (rota inexistente, 404). Para os dois ultimos o `-t` usou so um trecho do nome (parenteses e `;` seriam regex), enquanto o campo `command` do registro lista o nome inteiro.
2. **RED com esqueleto.** Os commits RED do dominio e do servico levam um esqueleto que compila e erra (normalizadores e funcoes novas devolvendo `fail("pendente")`; metodos novos do servico devolvendo 404 `pendente`), para o RED ser falha de asserção e nao de carga de modulo. O GREEN os substitui. O RED das rotas nao precisou de esqueleto (as rotas simplesmente nao existiam) e o fake de `ServicoDeContatos` em `rotas/crm/contatos.test.ts` ganhou os metodos novos no RED do servico para manter o typecheck verde.
3. **Casos `(b)` de rota ja verdes no RED.** Os 400 de corpo estrito (`modoCriacao`, `estado`, `criadoPor`, `workspaceId`) ja passavam antes das rotas novas porque o corpo de 07-01 era `.strict()` com poucas chaves; ficam como guarda de regressao para o corpo alargado.
4. **Contrato do dominio estendido.** `EdicaoDeIdentificador` (tipo) entrou em `crm/contatos.ts` e `obterIdentificador` no repositorio, ambos necessarios para o `PATCH` de Identificador e que o plano nao listou nominalmente.
5. **Guarda de branch protegida.** Como em 07-01/07-02, os commits foram feitos em `main` por decisao do orquestrador (`branching_strategy: none`); `git.allow_default_branch_commits` nao foi alterado.
6. **Suite de `apps/api` inteira nao foi rodada** (leva dezenas de minutos). Verificacao escopada a `src/rotas/crm src/servicos/crm src/app.test.ts` com Postgres local, mais dominio inteiro (75 arquivos, 1578 testes) e `npm run typecheck` dos tres workspaces. `verificar:contratos` pulou a verificacao (repositorio irmao `financeiro-tria` ausente nesta maquina).

**Total deviations:** 0 auto-fixed. **Impact:** nenhum no escopo.

## Issues Encountered

- O relatorio TAP de varias falhas de objeto foi rejeitado pelo classificador de RED (ver registro 1); resolvido escolhendo alvos de falha em uma linha.

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0703` foi removido ao fim (`docker ps -q --filter name=crm-n1-pg-0703` vazio).

## Known Stubs

None.

## Threat Flags

None - nao ha superficie nova alem da do `<threat_model>`: T-07-10 (limites de `enderecos`/`camposAdicionais` no zod e em `validarEnderecos`/`validarCamposAdicionais`), T-07-11 (pre-checagem D-09 na transacao + `empresa_exige_admin` e a FK de Negocio traduzidos como rede) e T-07-12 (`escaparIlike`, `q` limitado a 100 caracteres, casos com `50%` e `_`) estao mitigados e testados; T-07-09 (detentor revelado so dentro do mesmo Espaco) aceito e provado pelo caso do mesmo valor em outro Espaco.

## Next Phase Readiness

- 07-05 reaproveita `criarRepositorioDeContatosPg` para criar o admin da Empresa e acrescenta a escrita de vinculo em `repositorios/crm/vinculos.ts`; `escaparIlike`/`contemTexto` servem Empresas e Negocios.
- 07-06 religa as telas de Contato nestas rotas; os codigos `IDENTIFICADOR_EM_USO`, `CONTATO_BLOQUEADO`, `CONTATO_COM_NEGOCIOS`, `CONTATO_INATIVO` e `bloqueios.{empresas,negocios,contatos}` seguem a tabela "Recusas 409" do UI-SPEC.
- `apps/api/migracoes/007-crm.sql` continua nao rastreado (D-12): 07-05 o edita e a fase o commita. A exclusao permanente de Contato cujo unico vinculo admin e com Empresa na lixeira depende do ajuste do trigger previsto em 07-05 (Pitfall 2); ate la o servico a recusa como `CONTATO_BLOQUEADO` pela pre-checagem ou pela rede.

## Self-Check: PASSED

- Arquivos criados presentes em disco (6 criados, verificados com `[ -f ]`).
- Commits `ab50cb5`, `b049243`, `64b5043`, `0807791`, `01129dc`, `b7f128a` presentes na ancestralidade de HEAD (`commits: 6` medido por `rev-list`).
- Criterios de aceitacao reexecutados e verdes: `"gmail.com"` presente, dependencias do dominio = `zod`, `workspace_id = $1` em `vinculos.ts` (3), `CONTATO_BLOQUEADO` no servico (3), `escape` em `sql.ts` (3), rotas `/permanente` (1) e `/identificadores/:identificadorId` (2), 0 ocorrencias de `persistencia/`/`from "pg"` em `rotas/crm/contatos.ts`, container removido.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
