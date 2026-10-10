---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 05
subsystem: crm
tags: [postgres, constraint-trigger, fastify, zod, pg, vitest, empresas, vinculos, lixeira]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-02: exigir/resolverProprietario/semearMembro; 07-03: comTransacao/traduzirErroDePg, repositorio e servico de Contato, vinculos.ts (leitura); 07-04: padrao de rotas e servico de Funis"
provides:
  - "apps/api/migracoes/007-crm.sql corrigida (D-12) e commitada: crm_confere_admin ignora Empresa na_lixeira + constraint trigger empresas_exige_admin_estado"
  - "@n1/dominio/crm/empresas: tipos de Empresa/Identificador/Vinculo e validarEmpresa, validarIdentificadorDeEmpresa, validarMatriz, adminsVigentes, validarRetiradaDeAdmin, fraseDeEmpresaBloqueada, FRASE_EMPRESA_SEM_ADMIN"
  - "repositorios/crm/empresas.ts (criarRepositorioDeEmpresasPg) e escrita de vinculo em repositorios/crm/vinculos.ts"
  - "ServicoDeEmpresas + criarServicoDeEmpresas com D-08, RN-EMP-09/10"
  - "rotasDeEmpresas (15 rotas) registrada em rotasDeCrm; OpcoesDeCrm.empresas; NOVO_CONTATO exportado"
affects: [07-06, 07-08, 07-09, 07-13]

actuals:
  tokens: 43900
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Corpo opcional de POST (encerrar, restaurar) e z.object(...).strict().nullish(): sem corpo e sem content-type o Fastify 5 entrega null ao validador"
    - "Empresa na lixeira nao exige admin; sair da lixeira exige, via constraint trigger deferido 'after update of estado'"
    - "Servico pre-checa para o 409 rico (bloqueios) e o SQLSTATE traduzido por FRASES e a rede contra corrida"
    - "Prova de trigger deferido em SQL puro: cada caso numa transacao propria, desfecho do commit numa linha ('ok' ou '<sqlstate>/<constraint>')"

key-files:
  created:
    - apps/api/src/repositorios/crm/admin-da-empresa.test.ts
    - apps/api/src/repositorios/crm/empresas.ts
    - apps/api/src/servicos/crm/empresas.ts
    - apps/api/src/servicos/crm/empresas.test.ts
    - apps/api/src/rotas/crm/empresas.ts
    - apps/api/src/rotas/crm/empresas.test.ts
    - packages/dominio/src/crm/empresas.ts
    - packages/dominio/src/crm/empresas.test.ts
  modified:
    - apps/api/migracoes/007-crm.sql
    - apps/api/src/repositorios/crm/vinculos.ts
    - apps/api/src/rotas/crm/contatos.ts
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "D-12 cumprido: a correcao entrou direto na 007 (nenhuma 008) e a 007 foi commitada pela primeira vez neste plano; 07-13 Task 1 ainda precisa conferir plataforma.migracoes antes do primeiro migrar real"
  - "RN-EMP-05 (dominio de provedor publico) e regra de negocio: 409 DOMINIO_PUBLICO; forma mal formada de Identificador de Empresa continua 400 VALOR_INVALIDO"
  - "INV-EMP-01 (Empresa sem nome fantasia nem razao social) e 409 EMPRESA_SEM_NOME, como INV-CON-01 em 07-03"
  - "Admin de Empresa pode ser Contato arquivado, nao Contato na lixeira (409 CONTATO_INATIVO); Contato ou matriz de outro Espaco e 404"
  - "trocarAdmin deixa o vinculo do admin anterior vigente e com admin=false (so rebaixa); encerrar e outro ato"
  - "Matriz so e revalidada quando muda: uma matriz atual arquivada depois nao trava a edicao de outros campos da filial"
  - "Arquivar Empresa nao toca os vinculos (continua exigindo admin); so a lixeira os encerra (fim = hoje, ou o inicio se for posterior)"

patterns-established:
  - "Restaurar da lixeira insere um vinculo admin NOVO e preserva os encerrados como historico"
  - "RN-EMP-09 olha so Negocio aberto fora da lixeira e filial ativa/arquivada; RN-EMP-10 olha qualquer Negocio e qualquer filial"

requirements-completed: [CRM-D1, CRM-A1, CRM-A2]

duration: 12 min
completed: 2026-10-10
plan_head_before: ce4133f29438dd57d7d96adb40037bba62be1775
plan_head_after: f09ccd2c3ff05645b348a7595e2d761a312ef0b2
commits: 6
status: complete

coverage:
  - id: D1
    description: "007 corrigida e commitada (D-12): enviar a Empresa a lixeira encerrando os vinculos passa no commit, voltar da lixeira sem admin falha com empresa_exige_admin, arquivada continua exigindo admin"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/repositorios/crm/admin-da-empresa.test.ts (casos a-f contra Postgres 16 local, container recriado)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Regras de Empresa no dominio: INV-EMP-01, RN-EMP-05, documento fiscal com pais, matriz sem ciclo e ativa, admin vigente e retirada do ultimo admin, frase de Empresa bloqueada"
    requirement: CRM-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/empresas.test.ts (casos g-k, 18 testes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Criar Empresa + admin (Contato existente ou novo) numa transacao so; Identificador em uso, dominio publico e Contato de outro Espaco ou na lixeira nao deixam nenhuma linha"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/empresas.test.ts#(a), (b) e (c)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Matriz sem ciclo, vinculos (repetir o par, ULTIMO_ADMIN ao rebaixar/encerrar, trocar admin) e Identificadores de Empresa"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/empresas.test.ts#(c), (d) e (e)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lixeira (RN-EMP-09, D-08) encerra os vinculos e preserva os Contatos; restaurar da lixeira exige admin (EMPRESA_SEM_ADMIN); exclusao permanente so da lixeira e sem Negocio nem filial (RN-EMP-10)"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/empresas.test.ts#(f), (g) e (h)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Papel (membro cria/exclui, convidado so le) e isolamento: Empresa, Contato admin e matriz de outro Espaco sao 404; busca com % literal"
    requirement: CRM-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/empresas.test.ts#(i); apps/api/src/rotas/crm/empresas.test.ts (Convidado e outro Espaco)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Contrato REST de Empresa e vinculo: corpos .strict(), admin OU novoContato, corpos opcionais sem content-type, 409 com bloqueios intactos e o ciclo inteiro por app.inject"
    requirement: CRM-A1
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/empresas.test.ts (a)-(e), 15 testes, 12 sem banco + 3 com banco"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 05: Empresas e vinculo Contato-Empresa no backend Summary

**007 corrigida e commitada para aceitar a lixeira de Empresa (D-12) e exigir admin ao restaurar, mais CRUD REST completo de Empresa e vinculo em que a Empresa nasce com o Contato admin numa transacao so, vai a lixeira encerrando os vinculos e volta pedindo quem a administra (D-08, RN-EMP-09/10).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-10T02:31:48Z
- **Completed:** 2026-10-10T02:43:23Z
- **Tasks:** 3 (todas `tdd="true"`: RED -> GREEN, sem REFACTOR)
- **Files modified:** 12 (8 criados, 4 modificados; a 007 conta como modificada e entra pela primeira vez no git)

## Accomplishments

- **A 007 (D-12).** `crm_confere_admin` so exige admin de Empresa com `estado <> 'na_lixeira'` e o constraint trigger `empresas_exige_admin_estado` (`after update of estado`, deferrable initially deferred) exige admin ao sair da lixeira. Sem a correcao, a lixeira de D-08 falhava no commit (Pitfall 2). Provado em Postgres 16 por SQL puro, 6 casos, cada um numa transacao propria, com `code`/`constraint` do erro do `pg` lidos no commit. O arquivo foi commitado pela primeira vez (era untracked desde 07-01); nenhuma `008`.
- **Dominio** (`crm/empresas.ts`): tipos de Empresa, Identificador e vinculo, `validarEmpresa` (INV-EMP-01), `validarIdentificadorDeEmpresa` (domínio de provedor público recusado, documento fiscal exige país e vira só dígitos), `validarMatriz` (própria, ciclo e não ativa), `adminsVigentes`/`validarRetiradaDeAdmin` ("Indique o novo admin antes de retirar o último.") e `fraseDeEmpresaBloqueada`.
- **Repositorio:** `criarRepositorioDeEmpresasPg` (lista com busca por nome e Identificador, `ancestraisDe` por CTE recursiva limitada a 50 níveis, `filiaisDe`, Identificadores, `negociosDaEmpresa` somente leitura) e a escrita de vinculo em `vinculos.ts` (`inserirVinculo`, `atualizarVinculo`, `encerrarVinculo`, `encerrarVigentesDaEmpresa`, `listarDaEmpresa`, `obterVinculo`, `vinculoVigente`).
- **Servico:** `criar` grava Empresa, Contato novo (se houver) e vinculo admin em UMA `comTransacao`; lixeira recusa com Negócio aberto fora da lixeira ou filial ativa/arquivada (`EMPRESA_BLOQUEADA` com `bloqueios`) e senão encerra os vínculos e preserva os Contatos; `restaurar` da lixeira sem admin é `EMPRESA_SEM_ADMIN`; `ULTIMO_ADMIN` ao rebaixar/encerrar o último; `trocarAdmin` numa transação; exclusão permanente só da lixeira, sem Negócio (`EMPRESA_COM_NEGOCIOS`) nem filial (`EMPRESA_COM_FILIAIS`).
- **Rotas:** as 15 rotas do contrato, corpos `.strict()`, `admin` como `{ contatoId } | { novoContato }`, `NOVO_CONTATO` exportado de `rotas/crm/contatos.ts`, `OpcoesDeCrm.empresas` e registro padrão em `rotasDeCrm`.
- Verificado contra Postgres 16 local (container `crm-n1-pg-0705`, removido ao fim): `src/rotas/crm src/servicos/crm src/repositorios/crm src/app.test.ts` = 9 arquivos, 137 testes, nenhum pulado; dominio `src/crm` = 5 arquivos, 580 testes; `npm run typecheck` verde nos três workspaces. O serviço de Empresas passa com `TZ=America/Sao_Paulo` e os de `src/servicos/crm src/repositorios/crm` também com `TZ=UTC`.

## Task Commits

1. **Task 1: A 007 corrigida (D-12) e as regras de Empresa no dominio**
   - RED `f9edb3f` (test) - GREEN `ffbac44` (feat)
2. **Task 2: Repositorio e servico de Empresas e vinculos (D-08, RN-EMP-09/10)**
   - RED `30940b0` (test) - GREEN `95b6315` (feat)
3. **Task 3: Rotas REST de Empresa e vinculo, registradas em rotasDeCrm**
   - RED `9fab761` (test) - GREEN `f09ccd2` (feat)

Base do plano (HEAD anterior ao primeiro commit): `ce4133f29438dd57d7d96adb40037bba62be1775`.

**Plan metadata:** commit `docs(07-05)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/migracoes/007-crm.sql` - D-12: `crm_confere_admin` com `estado <> 'na_lixeira'`, trigger `empresas_exige_admin_estado`, cabeçalho e comentário do porquê
- `apps/api/src/repositorios/crm/admin-da-empresa.test.ts` - prova SQL do trigger corrigido (casos a-f)
- `packages/dominio/src/crm/empresas.ts`, `empresas.test.ts` - tipos e regras de Empresa (casos g-k)
- `apps/api/src/repositorios/crm/empresas.ts` - repositório de Empresas
- `apps/api/src/repositorios/crm/vinculos.ts` - escrita de vínculo do lado da Empresa
- `apps/api/src/servicos/crm/empresas.ts`, `empresas.test.ts` - serviço e 9 casos contra Postgres (a-i)
- `apps/api/src/rotas/crm/empresas.ts`, `empresas.test.ts` - rotas REST e 15 testes (sem e com banco)
- `apps/api/src/rotas/crm/contatos.ts` - só `export` e o nome `NOVO_CONTATO`
- `apps/api/src/rotas/crm/index.ts` - `OpcoesDeCrm.empresas` e registro de `rotasDeEmpresas`

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: a correção do trigger vive na própria 007 (D-12); RN-EMP-05 e INV-EMP-01 são 409 (regra), forma mal formada é 400; o admin é um Contato do mesmo Espaço fora da lixeira (arquivado vale); a troca de admin só rebaixa o anterior; a matriz só é revalidada quando muda; arquivar não mexe nos vínculos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corpo opcional de POST chegava `null` ao validador do Fastify 5**
- **Found during:** Task 3 (GREEN), primeiro teste das rotas `restaurar` e `encerrar` sem corpo e sem `content-type`
- **Issue:** com `z.object(...).strict().optional()` a requisição sem corpo respondia 400 "expected object, received null": o Fastify 5 entrega `null` (não `undefined`) quando não há corpo.
- **Fix:** `CORPO_DE_ENCERRAMENTO` e `CORPO_DE_RESTAURACAO` passaram a `.nullish()` e a rota usa `request.body ?? {}`. Comentado no código.
- **Files modified:** `apps/api/src/rotas/crm/empresas.ts`
- **Verification:** casos (b) do plano e "os verbos sem corpo chegam ao serviço sem content-type"
- **Committed in:** `f09ccd2`

**2. [Rule 1 - Bug] Defeito no meu próprio teste de lista**
- **Found during:** Task 3 (GREEN)
- **Issue:** `q=rota%20lista` não casa com "Acme (rota) lista" (o ")" entre as palavras); era erro do teste, não da rota.
- **Fix:** `q` passou a `encodeURIComponent("(rota) lista")`.
- **Files modified:** `apps/api/src/rotas/crm/empresas.test.ts`
- **Committed in:** `f09ccd2`

---

**Total deviations:** 2 auto-fixed (2 Rule 1). **Impact:** nenhum no escopo; ambos achados e corrigidos dentro da própria Task 3.

### Registros (nao sao correcoes de codigo)

1. **Evidencia de RED.** Como em 07-02/07-03, o relatório TAP do Vitest com falha de objeto em várias linhas é rejeitado pelo classificador como "Non-TAP data". Cada fase usou um alvo cuja falha é uma asserção de uma linha, executado isoladamente com `-t`, e todos deram `RED_EVIDENCE_OK`: domínio "o nome de exibição prefere o nome fantasia" (esqueleto devolve `pendente`); SQL caso (b) (o desfecho do commit passou a ser uma string de uma linha, `23514/empresa_exige_admin` em vez de `ok`, contra a 007 ainda sem a correção); serviço "criar com Contato existente grava…" (esperava sucesso, veio 404 `pendente`); rotas "POST /empresas sem admin responde 400" (rota inexistente, 404). O `-t` usa só um trecho do nome (parênteses seriam regex); o campo `command` do registro lista esse trecho. Os registros foram escritos em `.planning/red-tmp/` (dentro do projeto, exigência do classificador) e apagados depois.
2. **RED com esqueleto.** Os commits RED do domínio e do serviço levam um esqueleto que compila e erra (funções do domínio devolvendo `fail("pendente")`; métodos do serviço devolvendo 404 `pendente`); o RED das rotas leva só o tipo `OpcoesDeCrm.empresas` para o typecheck dos testes. O GREEN os substitui. O RED do SQL não precisou de esqueleto (a 007 original, então untracked, já reproduzia a falha).
3. **Container recriado entre RED e GREEN do SQL.** `migrar` registra o NOME do arquivo em `plataforma.migracoes` e não reaplica; o RED aplicou a 007 original no container, então ele foi recriado antes de provar a 007 corrigida (como o plano já avisava).
4. **Caso extra no serviço (f).** Além do plano, o caso (f) prova que o Contato que era admin de uma Empresa na lixeira pode ser enviado à lixeira e excluído de vez (pendência anotada em 07-03): o vínculo dele já foi encerrado e o trigger corrigido não exige admin de Empresa na lixeira.
5. **Códigos de recusa acrescentados** além dos listados no plano, todos seguindo a tabela "Recusas 409" do UI-SPEC: `EMPRESA_SEM_NOME`, `EMPRESA_INATIVA`, `EMPRESA_FORA_DA_LIXEIRA`, `DOMINIO_PUBLICO`, `CONTATO_INATIVO`, `MATRIZ_NAO_ENCONTRADA` (404), `VINCULO_NAO_ENCONTRADO` (404), `VINCULO_ENCERRADO`, `VINCULO_NAO_E_ADMIN`, `ADMIN_JA_E_ESTE`, `PERIODO_INVALIDO`, `TRANSICAO_INVALIDA`. `bloqueios.empresas` carrega a detentora de um documento/domínio já em uso (plano, caso c).
6. **Guarda de branch protegida.** Como em 07-01..07-04, os commits foram feitos em `main` por decisão do orquestrador (`branching_strategy: none`); `git.allow_default_branch_commits` não foi alterado.
7. **Suite de `apps/api` inteira não foi rodada** (leva dezenas de minutos e `lote-contas-a-pagar.test.ts` falha contra o banco remoto, fora do escopo). Verificação escopada a `src/rotas/crm src/servicos/crm src/repositorios/crm src/app.test.ts`, mais domínio `src/crm` e `npm run typecheck` dos três workspaces.
8. **Sem lint de `apps/api`/`packages/dominio`:** `npm run lint` só existe no workspace web (não tocado por este plano).

## Issues Encountered

- O relatório TAP de falha com objeto foi rejeitado pelo classificador de RED (ver registro 1); resolvido escolhendo alvos de falha em uma linha.
- Um `sed -i` de BSD falhou no meio de uma cadeia e deixou um `tsc` rodando no diretório errado; refeito com a ferramenta de edição. Sem efeito no repositório.

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0705` foi removido ao fim (`docker ps -q --filter name=crm-n1-pg-0705` vazio). A 007 editada NÃO foi aplicada em nenhum banco da plataforma (o agente não aplica migração em produção).

## Known Stubs

None.

## Threat Flags

None - não há superfície nova além da do `<threat_model>`: T-07-17 (último admin: `validarRetiradaDeAdmin` no serviço + trigger corrigido + casos SQL a-f e de serviço e/g), T-07-18 (Contato/matriz lidos com o `workspace_id` da sessão, 404 de outro Espaço, casos a e i), T-07-19 (domínio de provedor público recusado, caso c) e T-07-20 (edição da 007 só porque nunca foi aplicada; 07-13 Task 1 confere `plataforma.migracoes` antes do primeiro `migrar`) estão mitigados e testados; T-07-SC aceito (nenhum pacote novo).

## Next Phase Readiness

- 07-06 (telas de Contato) não depende deste plano; 07-09 religa as telas de Empresa sobre as rotas do `<interfaces>` do plano, com os códigos da tabela "Recusas 409" do UI-SPEC (`EMPRESA_SEM_ADMIN` abre o pedido de admin, `ULTIMO_ADMIN` abre "Trocar admin", `EMPRESA_BLOQUEADA` lista Negócios e Filiais).
- 07-08 (Negócios) referencia Empresas: `negociosDaEmpresa` já lê `plataforma.negocios`; `empresas.estado` e o 404 de outro Espaço valem para o `empresaId` do Negócio.
- **07-13 Task 1** continua obrigada a conferir `plataforma.migracoes` (por `migrar --seco`) antes do primeiro `migrar` real e a parar se a 007 já constar como aplicada: a 007 mudou depois do commit de 07-01.

## Self-Check: PASSED

- Arquivos criados presentes em disco (8 criados, verificados com `[ -f ]`), e `git ls-files --error-unmatch apps/api/migracoes/007-crm.sql` sai 0.
- Commits `f9edb3f`, `ffbac44`, `30940b0`, `95b6315`, `9fab761`, `f09ccd2` presentes na ancestralidade de HEAD (`commits: 6` medido por `rev-list` a partir de `ce4133f`).
- Critérios de aceitação reexecutados e verdes: `estado <> 'na_lixeira'` na 007 = 2, `empresas_exige_admin_estado` = 4, nenhuma migração `008`, `encerrarVigentesDaEmpresa` e `ULTIMO_ADMIN` no serviço (2 e 2), `workspace_id = $1` no repositório de Empresas (18), `rotasDeEmpresas` em `index.ts` (2), `export const NOVO_CONTATO` (1), `/empresas/:id/trocar-admin` nas rotas (2), container removido.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-10*
